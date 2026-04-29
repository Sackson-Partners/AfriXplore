import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole } from '@ain/auth';
import { validate } from '@ain/validation';
import { MineQuerySchema, CreateMineSchema, UpdateMineSchema, UUIDSchema } from '@ain/validation';
import { MinesService } from '../services/mines.service.js';
import { z } from 'zod';

const router = Router();
const service = new MinesService();

// GET /mines
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query = MineQuerySchema.parse(req.query);
    const result = await service.list({
      commodity: query.commodity,
      country: query.country,
      digitisationStatus: query.digitisationStatus,
      systemId: query.systemId,
      search: query.search,
      minLng: query.minLng,
      minLat: query.minLat,
      maxLng: query.maxLng,
      maxLat: query.maxLat,
      page: query.page,
      pageSize: query.pageSize,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /mines/:id
router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = UUIDSchema.parse(req.params.id);
    const mine = await service.getById(id);
    res.json(mine);
  } catch (err) {
    next(err);
  }
});

// POST /mines — admin or geologist
router.post(
  '/',
  requireAuth,
  requireRole('admin', 'geologist'),
  validate(CreateMineSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as z.infer<typeof CreateMineSchema>;
      const mine = await service.create({
        name: body.name,
        commodity: body.commodity,
        latitude: body.latitude,
        longitude: body.longitude,
        country: body.country,
        hostRock: body.hostRock,
        oreGrade: body.oreGrade,
        miningPeriod: body.miningPeriod,
        closureReason: body.closureReason,
        estimatedDepthM: body.estimatedDepthM,
        archiveSource: body.archiveSource,
        systemId: body.systemId,
        productionStats: body.productionStats,
        qualityScore: body.qualityScore,
        createdBy: req.user?.oid,
      });
      res.status(201).json(mine);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /mines/:id — admin or geologist
router.patch(
  '/:id',
  requireAuth,
  requireRole('admin', 'geologist'),
  validate(UpdateMineSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = UUIDSchema.parse(req.params.id);
      const body = req.body as z.infer<typeof UpdateMineSchema>;
      const mine = await service.update(id, {
        name: body.name,
        commodity: body.commodity,
        latitude: body.latitude,
        longitude: body.longitude,
        country: body.country,
        hostRock: body.hostRock,
        oreGrade: body.oreGrade,
        miningPeriod: body.miningPeriod,
        archiveSource: body.archiveSource,
        systemId: body.systemId,
      });
      res.json(mine);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /mines/:id — admin only
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
