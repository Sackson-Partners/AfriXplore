/**
 * AfriXplore USSD Menu Handler
 * Africa's Talking USSD callback endpoint
 * 5-step mineral report via feature phone
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/client';
import { ServiceBusClient } from '@azure/service-bus';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ─── USSD SESSION STORE ───────────────────────────────────────────────────────
interface USSDSession {
  phoneNumber: string;
  step: number;
  data: {
    mineralType?: string;
    workingType?: string;
    depthEstimate?: string;
    volumeEstimate?: string;
  };
  language: string;
  scoutId?: string;
  createdAt: number;
}

const sessions = new Map<string, USSDSession>();

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
  '1': 'alluvial_river', '2': 'open_pit',
  '3': 'shallow_shaft',  '4': 'deep_shaft',
  '5': 'tunnel',         '6': 'surface_pick',
};

const DEPTH_MAP: Record<string, number> = {
  '1': 0, '2': 3, '3': 12, '4': 35, '5': 100,
};

const VOLUME_MAP: Record<string, string> = {
  '1': 'small', '2': 'medium', '3': 'large',
};

// ─── POST /api/v1/ussd/callback ───────────────────────────────────────────────
router.post('/callback', async (req: Request, res: Response) => {
  const { sessionId, phoneNumber, text = '' } = req.body as {
    sessionId: string;
    serviceCode: string;
    phoneNumber: string;
    text: string;
  };

  res.setHeader('Content-Type', 'text/plain');

  try {
    const inputs = text.split('*').filter(Boolean);
    const stepCount = inputs.length;

    let session = sessions.get(sessionId);
    if (!session) {
      session = {
        phoneNumber,
        step: 0,
        data: {},
        language: 'en',
        createdAt: Date.now(),
      };

      const scout = await db.query(
        'SELECT id FROM scouts WHERE phone = $1 LIMIT 1',
        [phoneNumber]
      );
      if (scout.rows.length > 0) {
        session.scoutId = scout.rows[0].id as string;
      }

      sessions.set(sessionId, session);
    }

    if (stepCount === 0) return res.send(WELCOME);

    if (stepCount === 1) {
      const lang = inputs[0];
      session.language = lang === '2' ? 'fr' : lang === '3' ? 'sw' : 'en';
      return res.send(MINERAL_MENU);
    }

    if (stepCount === 2) {
      const mineral = MINERAL_MAP[inputs[1]];
      if (!mineral) return res.send(ERROR_MSG);
      if (mineral === 'uranium') return res.send(URANIUM_WARNING);
      session.data.mineralType = mineral;
      return res.send(WORKING_MENU);
    }

    if (stepCount === 3) {
      const workingType = WORKING_MAP[inputs[2]];
      if (!workingType) return res.send(ERROR_MSG);
      session.data.workingType = workingType;
      return res.send(DEPTH_MENU);
    }

    if (stepCount === 4) {
      session.data.depthEstimate = String(DEPTH_MAP[inputs[3]] ?? 0);
      return res.send(VOLUME_MENU);
    }

    if (stepCount === 5) {
      session.data.volumeEstimate = VOLUME_MAP[inputs[4]] || 'small';
      const mineral = session.data.mineralType || 'unknown';
      const working = session.data.workingType || 'unknown';
      return res.send(
        `CON Confirm report:\n${mineral} via ${working}\n\n1. Submit\n2. Cancel`
      );
    }

    if (stepCount === 6) {
      if (inputs[5] !== '1') {
        sessions.delete(sessionId);
        return res.send(CANCELLED);
      }

      const reportId = uuidv4();

      await db.query(
        `INSERT INTO reports (
          id, scout_id, location, mineral_type, working_type,
          depth_estimate_m, volume_estimate, location_source,
          status, sync_status, device_id
        ) VALUES (
          $1, $2, ST_SetSRID(ST_MakePoint(0, 0), 4326),
          $3, $4, $5, $6, 'cell_tower',
          'submitted', 'synced', 'ussd'
        )`,
        [
          reportId,
          session.scoutId ?? null,
          session.data.mineralType,
          session.data.workingType,
          parseFloat(session.data.depthEstimate ?? '0'),
          session.data.volumeEstimate,
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
            mineral_type: session.data.mineralType,
            source: 'ussd',
            phoneNumber,
            timestamp: new Date().toISOString(),
          },
          contentType: 'application/json',
        });
        await sender.close();
        await sbClient.close();
      }

      sessions.delete(sessionId);
      return res.send(SUCCESS_MSG);
    }

    return res.send(ERROR_MSG);
  } catch (error) {
    console.error('USSD handler error:', error);
    sessions.delete(sessionId);
    return res.send(ERROR_MSG);
  }
});

// Clean up expired sessions every 5 minutes
setInterval(() => {
  const TIMEOUT = 5 * 60 * 1000;
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.createdAt > TIMEOUT) sessions.delete(id);
  }
}, 5 * 60 * 1000);

export { router as ussdRouter };
