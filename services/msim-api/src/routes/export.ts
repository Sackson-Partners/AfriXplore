import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '@ain/auth';
import { ExportQuerySchema } from '@ain/validation';
import { ExportService } from '../services/export.service.js';
import { z } from 'zod';

const router = Router();
const service = new ExportService();

type ExportQuery = z.infer<typeof ExportQuerySchema>;

// GET /export/mines?format=geojson&commodity=gold&country=...
router.get('/mines', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query = ExportQuerySchema.parse(req.query) as ExportQuery;
    const { data, contentType, filename } = await service.exportMines(
      query.format,
      {
        commodity: query.commodity,
        country: query.country,
        minLng: query.minLng,
        minLat: query.minLat,
        maxLng: query.maxLng,
        maxLat: query.maxLat,
      }
    );
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(data);
  } catch (err) {
    next(err);
  }
});

export default router;
