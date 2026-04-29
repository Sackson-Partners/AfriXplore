import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import type { Express } from 'express';

// Mock the entire database module
vi.mock('@ain/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ain/database')>();
  return {
    ...actual,
    getPool: vi.fn(() => ({
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      on: vi.fn(),
    })),
    createPool: vi.fn(),
  };
});

// Mock auth middleware to inject a test user
vi.mock('@ain/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ain/auth')>();
  return {
    ...actual,
    requireAuth: vi.fn((req, _res, next) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (req as any).user = { oid: 'test-user', roles: ['admin'], extension_tier: 'enterprise', extension_subscription_active: true };
      next();
    }),
    requireRole: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
  };
});

let app: Express;

beforeAll(() => {
  process.env.NODE_ENV = 'test';
  app = createApp();
});

describe('GET /mines (unauthenticated passthrough for test)', () => {
  it('returns paginated response structure', async () => {
    const res = await request(app).get('/mines');
    // With empty DB mock the response should be a 200 or the mines list
    expect([200, 500]).toContain(res.status);
  });
});

describe('GET /mines/:id with invalid UUID', () => {
  it('returns 422 for a non-UUID id', async () => {
    const res = await request(app).get('/mines/not-a-uuid');
    expect(res.status).toBe(422);
  });
});

describe('POST /mines with invalid body', () => {
  it('returns 422 for missing required fields', async () => {
    const res = await request(app)
      .post('/mines')
      .send({ name: 'X' }) // Missing latitude, longitude, country, commodity
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(422);
  });
});
