/**
 * Unit tests for POST /scout/v1/scouts/me/kyc.
 *
 * Azure Blob Storage, DB, and multer file upload are mocked.
 */

import request from 'supertest';
import express from 'express';
import { scoutRouter } from '../routes/scouts';
import { authMiddleware } from '../middleware/auth';

// ── Mock DB ───────────────────────────────────────────────────────────────────
const mockQuery = jest.fn();
jest.mock('../db/client', () => ({ db: { query: (...args: any[]) => mockQuery(...args) } }));

// ── Mock Azure Blob Storage ───────────────────────────────────────────────────
const mockUploadData = jest.fn().mockResolvedValue({});
const mockGetBlockBlobClient = jest.fn().mockReturnValue({ uploadData: mockUploadData });
const mockGetContainerClient = jest.fn().mockReturnValue({ getBlockBlobClient: mockGetBlockBlobClient });
jest.mock('@azure/storage-blob', () => ({
  BlobServiceClient: jest.fn().mockImplementation(() => ({
    getContainerClient: mockGetContainerClient,
  })),
}));
jest.mock('@azure/identity', () => ({
  DefaultAzureCredential: jest.fn().mockImplementation(() => ({})),
}));

// ── Mock auth ─────────────────────────────────────────────────────────────────
jest.mock('../middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.userId = 'scout-kyc-uuid';
    next();
  },
}));

function buildApp() {
  const app = express();
  app.use('/scout/v1/scouts', authMiddleware, scoutRouter);
  return app;
}

describe('POST /scout/v1/scouts/me/kyc', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockUploadData.mockReset().mockResolvedValue({});
    process.env.AZURE_STORAGE_ACCOUNT_NAME = 'teststorage';
  });

  afterEach(() => {
    delete process.env.AZURE_STORAGE_ACCOUNT_NAME;
  });

  it('400 — rejects request with no file', async () => {
    const res = await request(buildApp())
      .post('/scout/v1/scouts/me/kyc');

    expect(res.status).toBe(400);
    expect(res.body.title).toMatch(/No document/i);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('409 — rejects if scout is already KYC approved', async () => {
    // kyc_status check returns 'approved'
    mockQuery.mockResolvedValueOnce({ rows: [{ kyc_status: 'approved' }] });

    const res = await request(buildApp())
      .post('/scout/v1/scouts/me/kyc')
      .attach('document', Buffer.from('fake-image-data'), { filename: 'id.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(409);
    expect(res.body.title).toMatch(/Already Approved/i);
    expect(mockUploadData).not.toHaveBeenCalled();
  });

  it('202 — uploads file and sets kyc_status = submitted', async () => {
    // kyc_status check — not yet approved
    mockQuery.mockResolvedValueOnce({ rows: [{ kyc_status: null }] });
    // UPDATE scouts
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(buildApp())
      .post('/scout/v1/scouts/me/kyc')
      .attach('document', Buffer.from('fake-image-data'), { filename: 'passport.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(202);
    expect(res.body.kyc_status).toBe('submitted');

    // Blob upload was called
    expect(mockUploadData).toHaveBeenCalledTimes(1);

    // DB UPDATE should set kyc_status = 'submitted'
    const updateCall = mockQuery.mock.calls.find(([sql]: [string]) =>
      typeof sql === 'string' && sql.includes("kyc_status = 'submitted'")
    );
    expect(updateCall).toBeDefined();
    expect(updateCall![1][1]).toBe('scout-kyc-uuid');
  });

  it('202 — accepts PDF documents', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ kyc_status: null }] });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(buildApp())
      .post('/scout/v1/scouts/me/kyc')
      .attach('document', Buffer.from('%PDF-fake'), { filename: 'id.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(202);
  });

  it('202 — allows re-submission when previous was rejected (not approved)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ kyc_status: 'rejected' }] });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(buildApp())
      .post('/scout/v1/scouts/me/kyc')
      .attach('document', Buffer.from('new-id-scan'), { filename: 'id2.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(202);
  });
});
