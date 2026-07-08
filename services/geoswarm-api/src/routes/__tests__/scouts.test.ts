import request from 'supertest';
import express from 'express';
import { Pool } from 'pg';
import scoutsRouter from '../scouts';
import { errorHandler } from '../../middleware/errorHandler';

// Mock dependencies
jest.mock('@ain/database');
jest.mock('@ain/auth', () => ({
  requireAuth: jest.fn((req, res, next) => {
    req.user = { sub: 'test-user', roles: ['admin'] };
    next();
  }),
}));

import { getPool } from '@ain/database';

const mockGetPool = getPool as jest.MockedFunction<typeof getPool>;

describe('Scouts API', () => {
  let app: express.Application;
  let mockPool: jest.Mocked<Pool>;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/scouts', scoutsRouter);
    app.use(errorHandler);

    mockPool = {
      query: jest.fn(),
    } as unknown as jest.Mocked<Pool>;

    mockGetPool.mockReturnValue(mockPool);
    jest.clearAllMocks();
  });

  describe('GET /scouts', () => {
    it('should return paginated scouts list', async () => {
      const mockScouts = [
        {
          id: 'scout-1',
          country: 'Zambia',
          district: 'Copperbelt',
          status: 'active',
          kyc_status: 'verified',
          badge_level: 'gold',
          points_earned: 1500,
          payouts_usd: 500,
        },
      ];

      mockPool.query
        .mockResolvedValueOnce({ rows: mockScouts, rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [{ total: '1' }], rowCount: 1 } as never);

      const response = await request(app).get('/scouts?limit=50&offset=0');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        data: mockScouts,
        total: 1,
        limit: 50,
        offset: 0,
      });
    });

    it('should filter scouts by country and status', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never)
        .mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 1 } as never);

      const response = await request(app).get('/scouts?country=Zambia&status=active');

      expect(response.status).toBe(200);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE country = $3 AND status = $4'),
        expect.arrayContaining(['Zambia', 'active'])
      );
    });

    it('should return empty list when table does not exist', async () => {
      const error = new Error('relation does not exist') as Error & { code?: string };
      error.code = '42P01';
      mockPool.query.mockRejectedValueOnce(error);

      const response = await request(app).get('/scouts');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: [], total: 0, limit: 50, offset: 0 });
    });
  });

  describe('GET /scouts/:id', () => {
    it('should return scout details', async () => {
      const mockScout = {
        id: 'scout-1',
        country: 'Zambia',
        district: 'Copperbelt',
        status: 'active',
        badge_level: 'gold',
      };

      mockPool.query.mockResolvedValueOnce({ rows: [mockScout], rowCount: 1 } as never);

      const response = await request(app).get('/scouts/scout-1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockScout);
    });

    it('should return 404 when scout not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const response = await request(app).get('/scouts/nonexistent');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /scouts/:id/reports', () => {
    it('should return reports submitted by scout', async () => {
      const mockReports = [
        { id: 'report-1', scout_id: 'scout-1', status: 'validated', mine_name: 'Mufulira Mine' },
      ];

      mockPool.query
        .mockResolvedValueOnce({ rows: mockReports, rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [{ total: '1' }], rowCount: 1 } as never);

      const response = await request(app).get('/scouts/scout-1/reports');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockReports);
      expect(response.body.total).toBe(1);
    });

    it('should return empty list when table does not exist', async () => {
      const error = new Error('relation does not exist') as Error & { code?: string };
      error.code = '42P01';
      mockPool.query.mockRejectedValueOnce(error);

      const response = await request(app).get('/scouts/scout-1/reports');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: [], total: 0, limit: 20, offset: 0 });
    });
  });

  describe('PATCH /scouts/:id', () => {
    it('should update scout status and KYC', async () => {
      const updatedScout = { id: 'scout-1', status: 'active', kyc_status: 'verified' };

      mockPool.query.mockResolvedValueOnce({ rows: [updatedScout], rowCount: 1 } as never);

      const response = await request(app)
        .patch('/scouts/scout-1')
        .send({ status: 'active', kyc_status: 'verified' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(updatedScout);
    });

    it('should return 400 when no fields to update', async () => {
      const response = await request(app).patch('/scouts/scout-1').send({});

      expect(response.status).toBe(400);
    });

    it('should return 404 when scout not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const response = await request(app).patch('/scouts/nonexistent').send({ status: 'inactive' });

      expect(response.status).toBe(404);
    });
  });

  describe('GET /scouts/stats/leaderboard', () => {
    it('should return top scouts by points', async () => {
      const mockLeaderboard = [
        { id: 'scout-1', country: 'Zambia', badge_level: 'platinum', points_earned: 5000, reports_count: '25' },
        { id: 'scout-2', country: 'DRC', badge_level: 'gold', points_earned: 3500, reports_count: '18' },
      ];

      mockPool.query.mockResolvedValueOnce({ rows: mockLeaderboard, rowCount: 2 } as never);

      const response = await request(app).get('/scouts/stats/leaderboard?limit=10');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockLeaderboard);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY points_earned DESC'),
        [10]
      );
    });

    it('should return empty list when table does not exist', async () => {
      const error = new Error('relation does not exist') as Error & { code?: string };
      error.code = '42P01';
      mockPool.query.mockRejectedValueOnce(error);

      const response = await request(app).get('/scouts/stats/leaderboard');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: [] });
    });
  });

  describe('GET /scouts/stats/summary', () => {
    it('should return scout statistics', async () => {
      const mockStats = {
        active: '50',
        inactive: '10',
        kyc_verified: '45',
        kyc_pending: '5',
        total_points: '125000',
        total_payouts_usd: '25000',
        total: '60',
      };

      mockPool.query.mockResolvedValueOnce({ rows: [mockStats], rowCount: 1 } as never);

      const response = await request(app).get('/scouts/stats/summary');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockStats);
    });

    it('should return zeros when table does not exist', async () => {
      const error = new Error('relation does not exist') as Error & { code?: string };
      error.code = '42P01';
      mockPool.query.mockRejectedValueOnce(error);

      const response = await request(app).get('/scouts/stats/summary');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        active: 0,
        inactive: 0,
        kyc_verified: 0,
        kyc_pending: 0,
        total_points: 0,
        total_payouts_usd: 0,
        total: 0,
      });
    });
  });
});
