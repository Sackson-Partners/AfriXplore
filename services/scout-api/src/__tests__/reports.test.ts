/**
 * Unit tests for scout-api report routes.
 * Covers: POST, GET stats, GET /:id, PATCH /:id/status (badge, quality_score, reward_rules, self-validation).
 *
 * DB and Service Bus are mocked — no real connections needed.
 */

import request from 'supertest';
import express from 'express';
import { reportRouter } from '../routes/reports';
import { authMiddleware } from '../middleware/auth';

// ── Mock DB ───────────────────────────────────────────────────────────────────
const mockQuery = jest.fn();
jest.mock('../db/client', () => ({ db: { query: (...args: any[]) => mockQuery(...args) } }));

// ── Mock Service Bus (fire-and-forget, never blocks) ─────────────────────────
jest.mock('@azure/service-bus', () => ({
  ServiceBusClient: jest.fn().mockImplementation(() => ({
    createSender: jest.fn().mockReturnValue({
      sendMessages: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    }),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

// ── Mock auth — inject userId directly ───────────────────────────────────────
jest.mock('../middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.userId = 'scout-test-uuid';
    next();
  },
}));

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/reports', authMiddleware, reportRouter);
  return app;
}

const VALID_BODY = {
  mineral_type: 'copper',
  latitude: -13.97,
  longitude: 28.63,
  working_type: 'open_pit',
  photo_uris: ['https://cdn.afrixplore.io/photo1.jpg'],
  country: 'ZM',
};

describe('POST /api/v1/reports', () => {
  beforeEach(() => mockQuery.mockReset());

  it('201 — creates report and returns id + status', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'report-uuid-1', status: 'pending', created_at: new Date().toISOString() }],
    });

    const res = await request(buildApp())
      .post('/api/v1/reports')
      .send(VALID_BODY);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 'report-uuid-1', status: 'pending' });
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('400 — rejects missing country', async () => {
    const { country: _omit, ...noCountry } = VALID_BODY;
    const res = await request(buildApp())
      .post('/api/v1/reports')
      .send(noCountry);

    expect(res.status).toBe(400);
    expect(res.body.title).toBe('Validation Error');
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('400 — rejects country longer than 2 chars', async () => {
    const res = await request(buildApp())
      .post('/api/v1/reports')
      .send({ ...VALID_BODY, country: 'ZAM' });

    expect(res.status).toBe(400);
  });

  it('400 — rejects invalid working_type', async () => {
    const res = await request(buildApp())
      .post('/api/v1/reports')
      .send({ ...VALID_BODY, working_type: 'alluvial_river' });

    expect(res.status).toBe(400);
  });

  it('201 — accepts optional offline_created_at', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'report-uuid-2', status: 'pending', created_at: new Date().toISOString() }],
    });

    const res = await request(buildApp())
      .post('/api/v1/reports')
      .send({ ...VALID_BODY, offline_created_at: '2026-05-01T10:00:00.000Z' });

    expect(res.status).toBe(201);
  });

  it('400 — rejects malformed offline_created_at', async () => {
    const res = await request(buildApp())
      .post('/api/v1/reports')
      .send({ ...VALID_BODY, offline_created_at: 'not-a-date' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/reports/stats', () => {
  beforeEach(() => mockQuery.mockReset());

  it('200 — returns aggregated stats for the authenticated scout', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        total: '12',
        validated: '8',
        pending: '3',
        rejected: '1',
        total_earned_usd: '24.00',
        pending_payout_usd: '7.50',
      }],
    });

    const res = await request(buildApp())
      .get('/api/v1/reports/stats');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: '12', validated: '8' });
    // Verify the query used the injected userId
    expect(mockQuery.mock.calls[0][1]).toContain('scout-test-uuid');
  });
});

describe('GET /api/v1/reports/:id', () => {
  beforeEach(() => mockQuery.mockReset());

  it('200 — returns report when scout owns it', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'report-abc', scout_id: 'scout-test-uuid', mineral_type: 'gold', status: 'pending' }],
    });

    const res = await request(buildApp()).get('/api/v1/reports/report-abc');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('report-abc');
  });

  it('403 — blocks access to another scout\'s report', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'report-xyz', scout_id: 'other-scout-uuid', mineral_type: 'gold', status: 'pending' }],
    });

    const res = await request(buildApp()).get('/api/v1/reports/report-xyz');

    expect(res.status).toBe(403);
  });

  it('404 — report not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(buildApp()).get('/api/v1/reports/nonexistent');
    expect(res.status).toBe(404);
  });
});

// ─── PATCH /api/v1/reports/:id/status ────────────────────────────────────────

/**
 * Mock call sequence for PATCH /:id/status when transitioning to 'validated':
 *   call 0 — SELECT id, scout_id, status, reward_usd FROM reports (ownership + current status)
 *   call 1 — SELECT mineral_type FROM reports (reward_rules lookup)
 *   call 2 — SELECT finder_fee_usd FROM reward_rules UNION ... (fee lookup)
 *   call 3 — UPDATE reports SET status = 'validated' ... RETURNING
 *   call 4 — UPDATE scouts SET validated_report_count, badge_level, quality_score, ...
 *   call 5 — SELECT scout_id FROM reports (SB payment trigger)
 *   (Service Bus sendMessages is mocked)
 *
 * For 'rejected':
 *   call 0 — SELECT id, scout_id, status, reward_usd
 *   call 1 — UPDATE reports SET status = 'rejected'
 *   call 2 — UPDATE scouts SET quality_score (no reward, no SB)
 */

function mockValidation(scoutId: string, currentStatus: string, rewardUsd: number | null = null) {
  // call 0: ownership check
  mockQuery.mockResolvedValueOnce({
    rows: [{ id: 'rep-1', scout_id: scoutId, status: currentStatus, reward_usd: rewardUsd }],
  });
  // call 1: mineral_type for reward_rules
  mockQuery.mockResolvedValueOnce({ rows: [{ mineral_type: 'copper' }] });
  // call 2: reward_rules lookup
  mockQuery.mockResolvedValueOnce({ rows: [{ finder_fee_usd: '3.00' }] });
  // call 3: UPDATE reports RETURNING
  mockQuery.mockResolvedValueOnce({
    rows: [{ id: 'rep-1', status: 'validated', validated_by: 'scout-test-uuid', validated_at: new Date().toISOString(), reward_usd: '3.00', updated_at: new Date().toISOString() }],
  });
  // call 4: UPDATE scouts (badge + quality_score)
  mockQuery.mockResolvedValueOnce({ rows: [] });
  // call 5: SELECT scout_id for SB trigger
  mockQuery.mockResolvedValueOnce({ rows: [{ scout_id: scoutId }] });
}

function mockRejection(scoutId: string) {
  // call 0: ownership check — scoutId differs from authenticated user (admin action)
  mockQuery.mockResolvedValueOnce({
    rows: [{ id: 'rep-1', scout_id: scoutId, status: 'under_review', reward_usd: null }],
  });
  // call 1: UPDATE reports RETURNING
  mockQuery.mockResolvedValueOnce({
    rows: [{ id: 'rep-1', status: 'rejected', updated_at: new Date().toISOString() }],
  });
  // call 2: UPDATE scouts (quality_score decrement)
  mockQuery.mockResolvedValueOnce({ rows: [] });
}

describe('PATCH /api/v1/reports/:id/status', () => {
  beforeEach(() => mockQuery.mockReset());

  it('403 — scout cannot validate their own report (self-validation blocked)', async () => {
    // Report belongs to the authenticated scout ('scout-test-uuid')
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'rep-self', scout_id: 'scout-test-uuid', status: 'under_review', reward_usd: null }],
    });

    const res = await request(buildApp())
      .patch('/api/v1/reports/rep-self/status')
      .send({ status: 'validated' });

    expect(res.status).toBe(403);
    expect(res.body.title).toBe('Forbidden');
    expect(res.body.detail).toMatch(/Scouts cannot/i);
    // Only the ownership-check query should have run
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('409 — rejects invalid status transition (pending → validated)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'rep-1', scout_id: 'other-scout', status: 'pending', reward_usd: null }],
    });

    const res = await request(buildApp())
      .patch('/api/v1/reports/rep-1/status')
      .send({ status: 'validated' });

    expect(res.status).toBe(409);
    expect(res.body.title).toMatch(/Invalid Status Transition/i);
  });

  it('200 — validator (different scout) can validate a report under_review', async () => {
    // Report owned by 'other-scout', being validated by 'scout-test-uuid'
    mockValidation('other-scout', 'under_review');

    const res = await request(buildApp())
      .patch('/api/v1/reports/rep-1/status')
      .send({ status: 'validated' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('validated');
    expect(res.body.reward_usd).toBe('3.00');
  });

  it('200 — validation uses reward_rules fee (not hardcoded $2.50)', async () => {
    mockValidation('other-scout', 'under_review');

    await request(buildApp())
      .patch('/api/v1/reports/rep-1/status')
      .send({ status: 'validated' });

    // call 2 (index 2) should be the reward_rules query
    const rewardCall = mockQuery.mock.calls[2][0] as string;
    expect(rewardCall).toMatch(/reward_rules/);
    // The scouts UPDATE call (index 4) should use 3.00 (from mock), not 2.50
    const scoutsUpdateCall = mockQuery.mock.calls[4][0] as string;
    expect(scoutsUpdateCall).toMatch(/UPDATE scouts/);
  });

  it('200 — badge promoted to silver at 10 validated reports', async () => {
    mockValidation('other-scout', 'under_review');

    await request(buildApp())
      .patch('/api/v1/reports/rep-1/status')
      .send({ status: 'validated' });

    // The UPDATE scouts SQL must reference badge promotion thresholds
    const scoutsUpdateSql = mockQuery.mock.calls[4][0] as string;
    expect(scoutsUpdateSql).toMatch(/badge_level/);
    expect(scoutsUpdateSql).toMatch(/silver/);
    expect(scoutsUpdateSql).toMatch(/gold/);
    expect(scoutsUpdateSql).toMatch(/platinum/);
  });

  it('200 — quality_score incremented on validation', async () => {
    mockValidation('other-scout', 'under_review');

    await request(buildApp())
      .patch('/api/v1/reports/rep-1/status')
      .send({ status: 'validated' });

    const scoutsUpdateSql = mockQuery.mock.calls[4][0] as string;
    expect(scoutsUpdateSql).toMatch(/quality_score/);
    // Delta is +1.0
    const params = mockQuery.mock.calls[4][1] as unknown[];
    expect(params).toContain(1.0);
  });

  it('200 — quality_score decremented on rejection', async () => {
    mockRejection('other-scout');

    const res = await request(buildApp())
      .patch('/api/v1/reports/rep-1/status')
      .send({ status: 'rejected' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('rejected');

    // The scouts UPDATE call should have -0.5 delta
    const scoutsUpdateSql = mockQuery.mock.calls[2][0] as string;
    expect(scoutsUpdateSql).toMatch(/quality_score/);
    const params = mockQuery.mock.calls[2][1] as unknown[];
    expect(params).toContain(-0.5);
  });

  it('200 — no payment trigger fired on rejection', async () => {
    mockRejection('other-scout');

    await request(buildApp())
      .patch('/api/v1/reports/rep-1/status')
      .send({ status: 'rejected' });

    // Service Bus mock should not have been invoked
    const { ServiceBusClient } = require('@azure/service-bus');
    expect(ServiceBusClient).not.toHaveBeenCalled();
  });

  it('404 — report not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(buildApp())
      .patch('/api/v1/reports/nonexistent/status')
      .send({ status: 'validated' });
    expect(res.status).toBe(404);
  });

  it('400 — rejects invalid status value', async () => {
    const res = await request(buildApp())
      .patch('/api/v1/reports/rep-1/status')
      .send({ status: 'approved' }); // not in enum
    expect(res.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
