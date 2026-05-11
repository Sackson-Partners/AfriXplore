/**
 * AfriXplore USSD Menu Handler
 * Africa's Talking USSD callback endpoint
 * 5-step mineral report via feature phone
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { createHmac, timingSafeEqual } from 'crypto';
import { validate, AfricanPhoneSchema } from '@afrixplore/validation';
import { db } from '../db/client';
import { ServiceBusClient } from '@azure/service-bus';
import { v4 as uuidv4 } from 'uuid';

const USSDCallbackSchema = z.object({
  sessionId: z.string().max(50),
  serviceCode: z.string().max(20).optional(),
  phoneNumber: AfricanPhoneSchema,
  text: z.string().max(200).default(''),
  networkCode: z.string().max(10).optional(),
});

const router = Router();

// ─── C8: AFRICA'S TALKING SIGNATURE VERIFICATION ─────────────────────────────
// AT signs USSD callbacks with HMAC-SHA256 using the API key as the secret.
// The signature is sent in the `X-AT-Signature` header as a hex digest of the
// raw request body. In dev/test (no secret configured) the check is skipped.
function atSignatureMiddleware(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.AT_USSD_SECRET;
  if (!secret) {
    // No secret configured — skip in local/dev
    next();
    return;
  }

  const signature = req.headers['x-at-signature'] as string | undefined;
  if (!signature) {
    res.status(401).type('text/plain').send('END Unauthorized');
    return;
  }

  // Re-derive from the raw body (Express JSON middleware already parsed; we use
  // the stringified body as AT does not send raw body separately)
  const payload = JSON.stringify(req.body);
  const expected = createHmac('sha256', secret).update(payload).digest('hex');

  try {
    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      res.status(403).type('text/plain').send('END Forbidden');
      return;
    }
  } catch {
    res.status(403).type('text/plain').send('END Forbidden');
    return;
  }

  next();
}

// ─── PHONE PREFIX → ISO-3166-1 ALPHA-2 COUNTRY ───────────────────────────────
// Ordered longest-prefix-first so +27 doesn't match before +271, etc.
const PHONE_COUNTRY_MAP: [string, string][] = [
  ['+291', 'ER'], ['+267', 'BW'], ['+266', 'LS'], ['+265', 'MW'],
  ['+264', 'NA'], ['+263', 'ZW'], ['+262', 'RE'], ['+261', 'MG'],
  ['+260', 'ZM'], ['+258', 'MZ'], ['+257', 'BI'], ['+256', 'UG'],
  ['+255', 'TZ'], ['+254', 'KE'], ['+253', 'DJ'], ['+252', 'SO'],
  ['+251', 'ET'], ['+250', 'RW'], ['+249', 'SD'], ['+248', 'SC'],
  ['+245', 'GW'], ['+244', 'AO'], ['+243', 'CD'], ['+242', 'CG'],
  ['+241', 'GA'], ['+240', 'GQ'], ['+239', 'ST'], ['+238', 'CV'],
  ['+237', 'CM'], ['+236', 'CF'], ['+235', 'TD'], ['+234', 'NG'],
  ['+233', 'GH'], ['+232', 'SL'], ['+231', 'LR'], ['+230', 'MU'],
  ['+229', 'BJ'], ['+228', 'TG'], ['+227', 'NE'], ['+226', 'BF'],
  ['+225', 'CI'], ['+224', 'GN'], ['+223', 'ML'], ['+222', 'MR'],
  ['+221', 'SN'], ['+220', 'GM'], ['+218', 'LY'], ['+216', 'TN'],
  ['+213', 'DZ'], ['+212', 'MA'], ['+211', 'SS'], ['+20',  'EG'],
  ['+27',  'ZA'],
];

function countryFromPhone(phone: string): string {
  for (const [prefix, iso] of PHONE_COUNTRY_MAP) {
    if (phone.startsWith(prefix)) return iso;
  }
  return 'ZZ'; // unknown
}

// ─── C9: DB-BACKED USSD SESSIONS ─────────────────────────────────────────────
interface USSDSession {
  phoneNumber: string;
  language: string;
  scoutId?: string;
  mineralType?: string;
  workingType?: string;
  depthEstimate?: string;
  volumeEstimate?: string;
}

async function getSession(sessionId: string): Promise<USSDSession | null> {
  const result = await db.query(
    `SELECT phone_number, language, scout_id, mineral_type, working_type,
            depth_estimate, volume_estimate
     FROM ussd_sessions WHERE session_id = $1`,
    [sessionId]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    phoneNumber: row.phone_number,
    language: row.language,
    scoutId: row.scout_id ?? undefined,
    mineralType: row.mineral_type ?? undefined,
    workingType: row.working_type ?? undefined,
    depthEstimate: row.depth_estimate ?? undefined,
    volumeEstimate: row.volume_estimate ?? undefined,
  };
}

async function upsertSession(sessionId: string, session: USSDSession): Promise<void> {
  await db.query(
    `INSERT INTO ussd_sessions (session_id, phone_number, language, scout_id,
       mineral_type, working_type, depth_estimate, volume_estimate, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     ON CONFLICT (session_id) DO UPDATE SET
       language       = EXCLUDED.language,
       scout_id       = EXCLUDED.scout_id,
       mineral_type   = EXCLUDED.mineral_type,
       working_type   = EXCLUDED.working_type,
       depth_estimate = EXCLUDED.depth_estimate,
       volume_estimate = EXCLUDED.volume_estimate,
       updated_at     = NOW()`,
    [
      sessionId,
      session.phoneNumber,
      session.language,
      session.scoutId ?? null,
      session.mineralType ?? null,
      session.workingType ?? null,
      session.depthEstimate ?? null,
      session.volumeEstimate ?? null,
    ]
  );
}

async function deleteSession(sessionId: string): Promise<void> {
  await db.query(`DELETE FROM ussd_sessions WHERE session_id = $1`, [sessionId]);
  // Best-effort cleanup of expired sessions on each completion
  await db.query(`SELECT cleanup_ussd_sessions()`).catch(() => {});
}

// ─── MENU STRINGS ─────────────────────────────────────────────────────────────
const WELCOME =
  'CON Welcome to AfriXplore\n' +
  'Report a mineral finding\n\n' +
  '1. English\n2. Français\n3. Kiswahili';

const MINERAL_MENU =
  'CON What mineral did you find?\n\n' +
  '1. Copper\n2. Cobalt\n3. Lithium\n' +
  '4. Gold\n5. Coltan\n6. Tin\n' +
  '7. Chrome\n8. Graphite\n9. Nickel\n' +
  '10. Manganese\n11. Uranium\n12. Other';

const WORKING_MENU =
  'CON How are you mining?\n\n' +
  '1. River/Alluvial\n2. Open Pit\n' +
  '3. Shallow Shaft\n4. Deep Shaft\n' +
  '5. Tunnel\n6. Surface Pick';

const DEPTH_MENU =
  'CON Estimated depth?\n\n' +
  '1. Surface (0m)\n2. Shallow (1-5m)\n' +
  '3. Medium (5-20m)\n4. Deep (20-50m)\n' +
  '5. Very Deep (>50m)';

const VOLUME_MENU =
  'CON Estimated volume?\n\n' +
  '1. Small (<1 tonne)\n2. Medium (1-10t)\n' +
  '3. Large (>10 tonnes)';

const SUCCESS_MSG =
  'END Report received!\n' +
  'Thank you. AfriXplore will\n' +
  'contact you within 48hrs\n' +
  'if your find is significant.';

const URANIUM_WARNING =
  'END SAFETY WARNING!\n' +
  'Uranium is RADIOACTIVE.\n' +
  'Do NOT handle with bare hands.\n' +
  'Call authorities immediately.';

const CANCELLED = 'END Report cancelled.';
const ERROR_MSG  = 'END Error. Please try again.';

const MINERAL_MAP: Record<string, string> = {
  '1': 'copper',   '2': 'cobalt',   '3': 'lithium',
  '4': 'gold',     '5': 'coltan',   '6': 'tin',
  '7': 'chrome',   '8': 'graphite', '9': 'nickel',
  '10': 'manganese', '11': 'uranium', '12': 'other',
};

const WORKING_MAP: Record<string, string> = {
  '1': 'alluvial',      '2': 'open_pit',
  '3': 'shallow_shaft', '4': 'deep_shaft',
  '5': 'tunnel',        '6': 'surface_pick',
};

const DEPTH_MAP: Record<string, number> = {
  '1': 0, '2': 3, '3': 12, '4': 35, '5': 100,
};

const VOLUME_MAP: Record<string, string> = {
  '1': 'small', '2': 'medium', '3': 'large',
};

// ─── POST /api/v1/ussd/callback ───────────────────────────────────────────────
router.post(
  '/callback',
  atSignatureMiddleware,
  validate(USSDCallbackSchema, 'body'),
  async (req: Request, res: Response) => {
    const { sessionId, phoneNumber, text } = req.body as z.infer<typeof USSDCallbackSchema>;

    res.setHeader('Content-Type', 'text/plain');

    try {
      const inputs = text.split('*').filter(Boolean);
      const stepCount = inputs.length;

      let session = await getSession(sessionId);
      if (!session) {
        session = { phoneNumber, language: 'en' };

        const scout = await db.query(
          'SELECT id FROM scouts WHERE phone = $1 LIMIT 1',
          [phoneNumber]
        );
        if (scout.rows.length > 0) {
          session.scoutId = scout.rows[0].id as string;
        }

        await upsertSession(sessionId, session);
      }

      if (stepCount === 0) return res.send(WELCOME);

      if (stepCount === 1) {
        const lang = inputs[0];
        session.language = lang === '2' ? 'fr' : lang === '3' ? 'sw' : 'en';
        await upsertSession(sessionId, session);
        return res.send(MINERAL_MENU);
      }

      if (stepCount === 2) {
        const mineral = MINERAL_MAP[inputs[1]];
        if (!mineral) return res.send(ERROR_MSG);
        if (mineral === 'uranium') {
          await deleteSession(sessionId);
          return res.send(URANIUM_WARNING);
        }
        session.mineralType = mineral;
        await upsertSession(sessionId, session);
        return res.send(WORKING_MENU);
      }

      if (stepCount === 3) {
        const workingType = WORKING_MAP[inputs[2]];
        if (!workingType) return res.send(ERROR_MSG);
        session.workingType = workingType;
        await upsertSession(sessionId, session);
        return res.send(DEPTH_MENU);
      }

      if (stepCount === 4) {
        session.depthEstimate = String(DEPTH_MAP[inputs[3]] ?? 0);
        await upsertSession(sessionId, session);
        return res.send(VOLUME_MENU);
      }

      if (stepCount === 5) {
        session.volumeEstimate = VOLUME_MAP[inputs[4]] || 'small';
        await upsertSession(sessionId, session);
        const mineral = session.mineralType || 'unknown';
        const working = session.workingType || 'unknown';
        return res.send(
          `CON Confirm report:\n${mineral} via ${working}\n\n1. Submit\n2. Cancel`
        );
      }

      if (stepCount === 6) {
        if (inputs[5] !== '1') {
          await deleteSession(sessionId);
          return res.send(CANCELLED);
        }

        const reportId = uuidv4();
        const country = countryFromPhone(phoneNumber);

        await db.query(
          `INSERT INTO reports (
            id, scout_id, location, mineral_type, working_type,
            depth_estimate_m, volume_estimate, location_source,
            country, status, sync_status, device_id
          ) VALUES (
            $1, $2, ST_SetSRID(ST_MakePoint(0, 0), 4326),
            $3, $4, $5, $6, 'cell_tower',
            $7, 'pending', 'synced', 'ussd'
          )`,
          [
            reportId,
            session.scoutId ?? null,
            session.mineralType,
            session.workingType,
            parseFloat(session.depthEstimate ?? '0'),
            session.volumeEstimate,
            country,
          ]
        );

        const sbConn = process.env.SERVICE_BUS_CONNECTION_STRING;
        if (sbConn) {
          const sbClient = new ServiceBusClient(sbConn);
          const sender = sbClient.createSender('reports-ingested');
          await sender.sendMessages({
            body: {
              reportId,
              scoutId: session.scoutId,
              mineral_type: session.mineralType,
              source: 'ussd',
              phoneNumber,
              timestamp: new Date().toISOString(),
            },
            contentType: 'application/json',
          });
          await sender.close();
          await sbClient.close();
        }

        await deleteSession(sessionId);
        return res.send(SUCCESS_MSG);
      }

      return res.send(ERROR_MSG);
    } catch (error) {
      process.stderr.write(
        JSON.stringify({ level: 'error', service: 'scout-api', ts: new Date().toISOString(), msg: 'USSD handler error', error: (error as Error).message }) + '\n'
      );
      await deleteSession(sessionId).catch(() => {});
      return res.send(ERROR_MSG);
    }
  }
);

export { router as ussdRouter };

export default router;
