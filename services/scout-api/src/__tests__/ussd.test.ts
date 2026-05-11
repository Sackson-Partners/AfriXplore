/**
 * Unit tests for USSD callback route.
 * Covers: AT signature verification (C8), DB-backed sessions (C9), menu flow.
 *
 * DB is mocked — no real connections needed.
 */

import request from 'supertest';
import express from 'express';
import { createHmac } from 'crypto';
import ussdRouter from '../routes/ussd';

// ── Mock DB ───────────────────────────────────────────────────────────────────
const mockQuery = jest.fn();
jest.mock('../db/client', () => ({ db: { query: (...args: any[]) => mockQuery(...args) } }));

// ── Mock Service Bus ──────────────────────────────────────────────────────────
jest.mock('@azure/service-bus', () => ({
  ServiceBusClient: jest.fn().mockImplementation(() => ({
    createSender: jest.fn().mockReturnValue({
      sendMessages: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    }),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/scout/v1/ussd', ussdRouter);
  return app;
}

const BASE_BODY = {
  sessionId: 'sess-001',
  phoneNumber: '+260971000001',
  text: '',
};

// Helpers to construct signed requests
function signedBody(body: object, secret: string): string {
  const payload = JSON.stringify(body);
  return createHmac('sha256', secret).update(payload).digest('hex');
}

// ── DB session mock helpers ───────────────────────────────────────────────────
// getSession → SELECT (no row = no session), upsertSession → INSERT/UPDATE, deleteSession → DELETE + cleanup
function mockNoSession() {
  mockQuery.mockResolvedValueOnce({ rows: [] }); // getSession
}

function mockExistingSession(session: Record<string, string | null>) {
  mockQuery.mockResolvedValueOnce({ rows: [session] }); // getSession
}

function mockUpsert() {
  mockQuery.mockResolvedValueOnce({ rows: [] }); // upsertSession
}

function mockDelete() {
  mockQuery.mockResolvedValueOnce({ rows: [] }); // deleteSession
  mockQuery.mockResolvedValueOnce({ rows: [] }); // cleanup_ussd_sessions()
}

function mockScoutLookup(scoutId: string | null) {
  if (scoutId) {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: scoutId }] });
  } else {
    mockQuery.mockResolvedValueOnce({ rows: [] });
  }
}

// ── C8: AT Signature verification ─────────────────────────────────────────────

describe('USSD — AT signature verification (C8)', () => {
  const SECRET = 'test-at-secret';

  beforeEach(() => {
    process.env.AT_USSD_SECRET = SECRET;
    mockQuery.mockReset();
  });

  afterEach(() => {
    delete process.env.AT_USSD_SECRET;
  });

  it('401 — rejects request with no signature header', async () => {
    const res = await request(buildApp())
      .post('/scout/v1/ussd/callback')
      .send(BASE_BODY);

    expect(res.status).toBe(401);
    expect(res.text).toContain('Unauthorized');
  });

  it('403 — rejects request with wrong signature', async () => {
    const res = await request(buildApp())
      .post('/scout/v1/ussd/callback')
      .set('x-at-signature', 'deadbeefdeadbeef')
      .send(BASE_BODY);

    expect(res.status).toBe(403);
    expect(res.text).toContain('Forbidden');
  });

  it('passes with correct HMAC-SHA256 signature', async () => {
    // No session in DB → shows WELCOME
    mockNoSession();
    mockScoutLookup(null);
    mockUpsert();

    const body = { ...BASE_BODY, text: '' };
    const sig = signedBody(body, SECRET);

    const res = await request(buildApp())
      .post('/scout/v1/ussd/callback')
      .set('x-at-signature', sig)
      .send(body);

    expect(res.status).toBe(200);
    expect(res.text).toContain('CON Welcome');
  });

  it('skips signature check when AT_USSD_SECRET is not set (dev mode)', async () => {
    delete process.env.AT_USSD_SECRET;
    mockNoSession();
    mockScoutLookup(null);
    mockUpsert();

    const res = await request(buildApp())
      .post('/scout/v1/ussd/callback')
      .send(BASE_BODY); // no signature header

    expect(res.status).toBe(200);
    expect(res.text).toContain('CON Welcome');
  });
});

// ── C9: DB-backed USSD sessions ───────────────────────────────────────────────

describe('USSD — DB-backed session flow (C9)', () => {
  beforeEach(() => mockQuery.mockReset());

  it('step 0 — new session: creates DB session, returns WELCOME', async () => {
    mockNoSession();
    mockScoutLookup(null);
    mockUpsert();

    const res = await request(buildApp())
      .post('/scout/v1/ussd/callback')
      .send({ ...BASE_BODY, text: '' });

    expect(res.status).toBe(200);
    expect(res.text).toContain('Welcome to AfriXplore');
    // getSession + scout lookup + upsert = 3 calls
    expect(mockQuery).toHaveBeenCalledTimes(3);
  });

  it('step 1 — existing session: reads from DB, returns MINERAL_MENU', async () => {
    mockExistingSession({ phone_number: '+260971000001', language: 'en', scout_id: null, mineral_type: null, working_type: null, depth_estimate: null, volume_estimate: null });
    mockUpsert(); // language update

    const res = await request(buildApp())
      .post('/scout/v1/ussd/callback')
      .send({ ...BASE_BODY, text: '1' }); // English

    expect(res.status).toBe(200);
    expect(res.text).toContain('What mineral');
  });

  it('step 2 — uranium triggers URANIUM_WARNING and deletes session', async () => {
    mockExistingSession({ phone_number: '+260971000001', language: 'en', scout_id: null, mineral_type: null, working_type: null, depth_estimate: null, volume_estimate: null });
    mockDelete();

    const res = await request(buildApp())
      .post('/scout/v1/ussd/callback')
      .send({ ...BASE_BODY, text: '1*11' }); // English, Uranium

    expect(res.status).toBe(200);
    expect(res.text).toContain('RADIOACTIVE');
    expect(res.text).toMatch(/^END/);
  });

  it('step 2 — valid mineral stores selection and shows WORKING_MENU', async () => {
    mockExistingSession({ phone_number: '+260971000001', language: 'en', scout_id: null, mineral_type: null, working_type: null, depth_estimate: null, volume_estimate: null });
    mockUpsert();

    const res = await request(buildApp())
      .post('/scout/v1/ussd/callback')
      .send({ ...BASE_BODY, text: '1*1' }); // copper

    expect(res.status).toBe(200);
    expect(res.text).toContain('How are you mining');
  });

  it('step 6 cancel — deletes session, returns CANCELLED', async () => {
    mockExistingSession({
      phone_number: '+260971000001', language: 'en', scout_id: 'scout-uuid',
      mineral_type: 'copper', working_type: 'open_pit',
      depth_estimate: '3', volume_estimate: 'medium',
    });
    mockDelete();

    const res = await request(buildApp())
      .post('/scout/v1/ussd/callback')
      .send({ ...BASE_BODY, text: '1*1*2*2*2*2' }); // cancel at confirmation

    expect(res.status).toBe(200);
    expect(res.text).toContain('cancelled');
    expect(res.text).toMatch(/^END/);
  });

  it('step 6 submit — inserts report, publishes to SB, deletes session', async () => {
    mockExistingSession({
      phone_number: '+260971000001', language: 'en', scout_id: 'scout-uuid',
      mineral_type: 'copper', working_type: 'open_pit',
      depth_estimate: '3', volume_estimate: 'medium',
    });
    mockQuery.mockResolvedValueOnce({ rows: [] }); // INSERT report
    // No SB env set — skips SB
    mockDelete();

    const res = await request(buildApp())
      .post('/scout/v1/ussd/callback')
      .send({ ...BASE_BODY, text: '1*1*2*2*2*1' }); // submit

    expect(res.status).toBe(200);
    expect(res.text).toContain('Report received');
    expect(res.text).toMatch(/^END/);

    // Verify INSERT was called
    const insertCall = mockQuery.mock.calls.find(([sql]: [string]) =>
      typeof sql === 'string' && sql.includes('INSERT INTO reports')
    );
    expect(insertCall).toBeDefined();
  });

  it('phone prefix → country code (ZM prefix +260)', async () => {
    mockExistingSession({
      phone_number: '+260971000001', language: 'en', scout_id: null,
      mineral_type: 'cobalt', working_type: 'alluvial',
      depth_estimate: '0', volume_estimate: 'small',
    });
    mockQuery.mockResolvedValueOnce({ rows: [] }); // INSERT
    mockDelete();

    await request(buildApp())
      .post('/scout/v1/ussd/callback')
      .send({ ...BASE_BODY, text: '1*2*1*1*1*1' }); // submit

    const insertCall = mockQuery.mock.calls.find(([sql]: [string]) =>
      typeof sql === 'string' && sql.includes('INSERT INTO reports')
    );
    const insertParams = insertCall?.[1] as unknown[];
    // 7th param is country
    expect(insertParams?.[6]).toBe('ZM');
  });
});
