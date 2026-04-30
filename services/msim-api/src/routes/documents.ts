import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole } from '@ain/auth';
import { getPool } from '@ain/database';
import { z } from 'zod';
import { getBlobUrl, deleteDocument, ingestDocument } from '../ingestion/index.js';

const router = Router();

const IngestBody = z.object({
  blobName:        z.string().min(1),
  contentType:     z.string().default('application/pdf'),
  sourceReference: z.string().optional(),
});

// GET /documents — list ingestion jobs
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page     = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 20)));
    const offset   = (page - 1) * pageSize;
    const pool     = getPool();

    const [rows, countRow] = await Promise.all([
      pool.query(
        `SELECT id, blob_name, content_type, source_reference,
                processing_status, extracted_record_id, processing_errors, created_at, updated_at
         FROM msim_ingestion_jobs
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        [pageSize, offset],
      ),
      pool.query('SELECT COUNT(*) AS total FROM msim_ingestion_jobs'),
    ]);

    res.json({ data: rows.rows, total: Number(countRow.rows[0].total), page, pageSize });
  } catch (err) {
    next(err);
  }
});

// GET /documents/:id
router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id     = z.string().uuid().parse(req.params.id);
    const pool   = getPool();
    const result = await pool.query('SELECT * FROM msim_ingestion_jobs WHERE id = $1', [id]);

    if (!result.rows[0]) { res.status(404).json({ error: 'Job not found' }); return; }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /documents/ingest
 * Trigger the ingestion pipeline for a blob already uploaded to storage.
 * Responds 202 immediately; pipeline runs asynchronously.
 */
router.post(
  '/ingest',
  requireAuth,
  requireRole('admin', 'geologist'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = IngestBody.parse(req.body);
      const pool = getPool();

      const job = await pool.query<{ id: string }>(
        `INSERT INTO msim_ingestion_jobs (blob_name, content_type, source_reference, processing_status)
         VALUES ($1, $2, $3, 'processing')
         RETURNING id`,
        [body.blobName, body.contentType, body.sourceReference ?? null],
      );

      const jobId = job.rows[0].id;

      // Fire-and-forget
      ingestDocument({
        blobName:        body.blobName,
        contentType:     body.contentType,
        sourceReference: body.sourceReference,
      }).then(async (result) => {
        const status = result.status === 'failed' ? 'failed'
          : result.status === 'partial'           ? 'partial'
          : 'completed';

        await pool.query(
          `UPDATE msim_ingestion_jobs
           SET processing_status = $1, extracted_record_id = $2, processing_errors = $3
           WHERE id = $4`,
          [status, result.recordId, JSON.stringify(result.errors), jobId],
        );
      }).catch(() => {
        pool.query(
          `UPDATE msim_ingestion_jobs SET processing_status = 'failed' WHERE id = $1`,
          [jobId],
        );
      });

      res.status(202).json({ jobId, status: 'processing' });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /documents/:id/url
 * Return the blob URL for a given ingestion job.
 */
router.get('/:id/url', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id     = z.string().uuid().parse(req.params.id);
    const pool   = getPool();
    const result = await pool.query<{ blob_name: string }>(
      'SELECT blob_name FROM msim_ingestion_jobs WHERE id = $1',
      [id],
    );

    if (!result.rows[0]) { res.status(404).json({ error: 'Job not found' }); return; }

    const url = await getBlobUrl(result.rows[0].blob_name);
    res.json({ url });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /documents/:id — admin only, removes job + blob
 */
router.delete(
  '/:id',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id     = z.string().uuid().parse(req.params.id);
      const pool   = getPool();
      const result = await pool.query<{ blob_name: string }>(
        'DELETE FROM msim_ingestion_jobs WHERE id = $1 RETURNING blob_name',
        [id],
      );

      if (!result.rows[0]) { res.status(404).json({ error: 'Job not found' }); return; }

      await deleteDocument(result.rows[0].blob_name).catch(() => null);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

export default router;
