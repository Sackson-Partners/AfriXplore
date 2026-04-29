import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole } from '@ain/auth';
import { validate } from '@ain/validation';
import { CreateSystemSchema, UpdateSystemSchema, UUIDSchema, PaginationSchema } from '@ain/validation';
import { SystemsService } from '../services/systems.service.js';
import { z } from 'zod';

const router = Router();
const service = new SystemsService();

const SystemQuerySchema = PaginationSchema.extend({
  country: z.string().max(100).optional(),
  systemType: z.string().max(50).optional(),
  isPublished: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});

// GET /systems
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query = SystemQuerySchema.parse(req.query);
    const result = await service.list({
      country: query.country,
      systemType: query.systemType,
      isPublished: query.isPublished,
      page: query.page,
      pageSize: query.pageSize,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /systems/:id
router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = UUIDSchema.parse(req.params.id);
    const system = await service.getById(id);
    res.json(system);
  } catch (err) {
    next(err);
  }
});

// POST /systems
router.post(
  '/',
  requireAuth,
  requireRole('admin', 'geologist'),
  validate(CreateSystemSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as z.infer<typeof CreateSystemSchema>;
      const system = await service.create({
        name: body.name,
        systemType: body.type,
        commodities: body.commodity,
        country: body.country[0],
        dataSources: body.alterationTypes,
        confidenceLevel: body.prospectivityScore != null ? Math.round(body.prospectivityScore / 20) : undefined,
      });
      res.status(201).json(system);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /systems/:id
router.patch(
  '/:id',
  requireAuth,
  requireRole('admin', 'geologist'),
  validate(UpdateSystemSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = UUIDSchema.parse(req.params.id);
      const body = req.body as z.infer<typeof UpdateSystemSchema>;
      const system = await service.update(id, {
        name: body.name,
        systemType: body.type,
        commodities: body.commodity,
        country: body.country?.[0],
      });
      res.json(system);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /systems/:id
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
