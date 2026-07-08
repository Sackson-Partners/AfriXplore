import request from 'supertest';
import express from 'express';
import { Pool } from 'pg';
import missionsRouter from '../missions';
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

describe('Missions API', () => {
  let app: express.Application;
  let mockPool: jest.Mocked<Pool>;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/missions', missionsRouter);
    app.use(errorHandler);

    mockPool = {
      query: jest.fn(),
    } as unknown as jest.Mocked<Pool>;

    mockGetPool.mockReturnValue(mockPool);
    jest.clearAllMocks();
  });

  describe('GET /missions', () => {
    it('should return paginated missions list', async () => {
      const mockMissions = [
        {
          id: 'mission-1',
          survey_order_id: 'order-1',
          mission_date: '2024-06-01',
          status: 'scheduled',
          project_name: 'Project Alpha',
          area_km2: 500,
        },
      ];

      mockPool.query
        .mockResolvedValueOnce({ rows: mockMissions, rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [{ total: '1' }], rowCount: 1 } as never);

      const response = await request(app).get('/missions?limit=50&offset=0');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        data: mockMissions,
        total: 1,
        limit: 50,
        offset: 0,
      });
      expect(mockPool.query).toHaveBeenCalledTimes(2);
    });

    it('should filter missions by status', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never)
        .mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 1 } as never);

      const response = await request(app).get('/missions?status=completed');

      expect(response.status).toBe(200);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE status = $3'),
        expect.arrayContaining(['completed'])
      );
    });

    it('should handle database errors gracefully', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app).get('/missions');

      expect(response.status).toBe(500);
    });

    it('should return empty list when table does not exist', async () => {
      const error = new Error('relation does not exist') as Error & { code?: string };
      error.code = '42P01';
      mockPool.query.mockRejectedValueOnce(error);

      const response = await request(app).get('/missions');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: [], total: 0, limit: 50, offset: 0 });
    });
  });

  describe('GET /missions/:id', () => {
    it('should return mission details', async () => {
      const mockMission = {
        id: 'mission-1',
        survey_order_id: 'order-1',
        mission_date: '2024-06-01',
        status: 'scheduled',
        project_name: 'Project Alpha',
      };

      mockPool.query.mockResolvedValueOnce({ rows: [mockMission], rowCount: 1 } as never);

      const response = await request(app).get('/missions/mission-1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockMission);
    });

    it('should return 404 when mission not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const response = await request(app).get('/missions/nonexistent');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /missions', () => {
    it('should create a new mission', async () => {
      const newMission = {
        survey_order_id: 'order-1',
        mission_date: '2024-06-15',
        pilot_name: 'John Doe',
        aircraft_id: 'AC-001',
      };

      const createdMission = { id: 'mission-new', ...newMission, status: 'scheduled' };

      mockPool.query.mockResolvedValueOnce({ rows: [createdMission], rowCount: 1 } as never);

      const response = await request(app).post('/missions').send(newMission);

      expect(response.status).toBe(201);
      expect(response.body).toEqual(createdMission);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO geoswarm_flight_missions'),
        expect.arrayContaining(['order-1', '2024-06-15'])
      );
    });

    it('should return 400 when required fields are missing', async () => {
      const response = await request(app).post('/missions').send({ pilot_name: 'John' });

      expect(response.status).toBe(400);
    });
  });

  describe('PATCH /missions/:id', () => {
    it('should update mission status', async () => {
      const updatedMission = { id: 'mission-1', status: 'in_flight', updated_at: new Date() };

      mockPool.query.mockResolvedValueOnce({ rows: [updatedMission], rowCount: 1 } as never);

      const response = await request(app).patch('/missions/mission-1').send({ status: 'in_flight' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(updatedMission);
    });

    it('should return 400 when no fields to update', async () => {
      const response = await request(app).patch('/missions/mission-1').send({});

      expect(response.status).toBe(400);
    });

    it('should return 404 when mission not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const response = await request(app).patch('/missions/nonexistent').send({ status: 'completed' });

      expect(response.status).toBe(404);
    });
  });

  describe('GET /missions/stats/summary', () => {
    it('should return mission statistics', async () => {
      const mockStats = {
        scheduled: '2',
        in_flight: '1',
        completed: '5',
        cancelled: '0',
        total: '8',
      };

      mockPool.query.mockResolvedValueOnce({ rows: [mockStats], rowCount: 1 } as never);

      const response = await request(app).get('/missions/stats/summary');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockStats);
    });

    it('should return zeros when table does not exist', async () => {
      const error = new Error('relation does not exist') as Error & { code?: string };
      error.code = '42P01';
      mockPool.query.mockRejectedValueOnce(error);

      const response = await request(app).get('/missions/stats/summary');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        scheduled: 0,
        in_flight: 0,
        completed: 0,
        cancelled: 0,
        total: 0,
      });
    });
  });
});
