import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole, requireTier } from '@ain/auth';
import { UUIDSchema, PaginationSchema } from '@ain/validation';
import { TargetsService } from '../services/targets.service.js';
import { z } from 'zod';

const router = Router();
const service = new TargetsService();

const TargetQuerySchema = PaginationSchema.extend({
  systemId: UUIDSchema.optional(),
  mineId: UUIDSchema.optional(),
  status: z.string().max(50).optional(),
});

const CreateTargetSchema = z.object({
  name: z.string().min(2).max(200),
  systemId: UUIDSchema.optional(),
  mineId: UUIDSchema.optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  priorityScore: z.number().min(0).max(10).optional(),
  geologyRationale: z.string().max(2000).optional(),
  recommendedWork: z.string().max(1000).optional(),
  estimatedValueUsd: z.number().positive().optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

// GET /targets — pro+ subscribers only
router.get(
  '/',
  requireAuth,
  requireTier('pro', 'enterprise'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = TargetQuerySchema.parse(req.query);
      const result = await service.list({
        systemId: query.systemId,
        mineId: query.mineId,
        status: query.status,
        page: query.page,
        pageSize: query.pageSize,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// GET /targets/:id
router.get(
  '/:id',
  requireAuth,
  requireTier('pro', 'enterprise'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = UUIDSchema.parse(req.params.id);
      const target = await service.getById(id);
      res.json(target);
    } catch (err) {
      next(err);
    }
  }
);

// POST /targets — admin/geologist only
router.post(
  '/',
  requireAuth,
  requireRole('admin', 'geologist'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = CreateTargetSchema.parse(req.body);
      const target = await service.create({
        name: body.name,
        systemId: body.systemId,
        mineId: body.mineId,
        latitude: body.latitude,
        longitude: body.longitude,
        priorityScore: body.priorityScore,
        geologyRationale: body.geologyRationale,
        recommendedWork: body.recommendedWork,
        estimatedValueUsd: body.estimatedValueUsd,
        dueDate: body.dueDate,
      });
      res.status(201).json(target);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /targets/:id
router.patch(
  '/:id',
  requireAuth,
  requireRole('admin', 'geologist'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = UUIDSchema.parse(req.params.id);
      const body = CreateTargetSchema.partial().parse(req.body);
      const target = await service.update(id, body);
      res.json(target);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /targets/:id
router.delete(
  '/:id',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = UUIDSchema.parse(req.params.id);
      await service.delete(id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

export default router;
