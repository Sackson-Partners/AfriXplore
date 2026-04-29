import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import type { Express } from 'express';

// Mock the DB pool for integration tests
import { vi } from 'vitest';

vi.mock('@ain/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ain/database')>();
  return {
    ...actual,
    getPool: vi.fn(() => ({
      query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
      on: vi.fn(),
    })),
    createPool: vi.fn(() => ({
      query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
      on: vi.fn(),
    })),
  };
});

let app: Express;

beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.AZURE_ENTRA_TENANT_ID = 'test-tenant';
  process.env.AZURE_ENTRA_CLIENT_ID = 'test-client';
  app = createApp();
});

describe('GET /health/live', () => {
  it('returns 200 with ok status', async () => {
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
    expect(res.body.timestamp).toBeDefined();
  });
});

describe('GET /health/ready', () => {
  it('returns 200 when DB is accessible', async () => {
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'connected' });
  });
});

describe('GET /health/metrics', () => {
  it('returns process metrics', async () => {
    const res = await request(app).get('/health/metrics');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('uptime_seconds');
    expect(res.body).toHaveProperty('memory');
    expect(res.body).toHaveProperty('node_version');
  });
});

describe('GET /nonexistent', () => {
  it('returns 404 RFC 7807', async () => {
    const res = await request(app).get('/nonexistent-route');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ status: 404, title: 'Not Found' });
  });
});
