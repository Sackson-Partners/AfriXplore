import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '@ain/auth';
import { createError } from '../middleware/errorHandler.js';

const router = Router();

const CONVERGENCE_ENGINE_URL = process.env.CONVERGENCE_ENGINE_URL ?? 'http://localhost:3005';

interface ConvergenceScore {
  mine_id: string;
  mine_name: string;
  convergence_score: number;
  breakdown: {
    drone_score: number;
    archive_score: number;
    scout_score: number;
    geology_score: number;
  };
  certified_target: boolean;
  scored_at: string;
}

interface ConvergenceEvent {
  id: string;
  mine_id: string;
  mine_name: string;
  event_type: string;
  previous_score: number | null;
  new_score: number;
  triggered_by: string;
  created_at: string;
}

// POST /convergence/score/:mine_id — trigger convergence score computation
router.post(
  '/score/:mine_id',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { mine_id } = req.params;

      const response = await fetch(`${CONVERGENCE_ENGINE_URL}/v1/score/${mine_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorText = await response.text();
        next(
          createError(
            response.status,
            'Convergence Score Failed',
            `Failed to compute convergence score: ${errorText}`
          )
        );
        return;
      }

      const score = (await response.json()) as ConvergenceScore;
      res.status(200).json(score);
    } catch (err) {
      next(err);
    }
  }
);

// GET /convergence/scores — list all convergence scores with pagination
router.get(
  '/scores',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = parseInt(String(req.query.page ?? '1'), 10);
      const page_size = parseInt(String(req.query.page_size ?? '20'), 10);

      const response = await fetch(
        `${CONVERGENCE_ENGINE_URL}/v1/scores?page=${page}&page_size=${page_size}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        next(
          createError(
            response.status,
            'Convergence Scores Failed',
            `Failed to fetch convergence scores: ${errorText}`
          )
        );
        return;
      }

      const data = await response.json();
      res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }
);

// GET /convergence/events — list convergence events (score changes)
router.get(
  '/events',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = parseInt(String(req.query.page ?? '1'), 10);
      const page_size = parseInt(String(req.query.page_size ?? '20'), 10);

      const response = await fetch(
        `${CONVERGENCE_ENGINE_URL}/v1/events?page=${page}&page_size=${page_size}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        next(
          createError(
            response.status,
            'Convergence Events Failed',
            `Failed to fetch convergence events: ${errorText}`
          )
        );
        return;
      }

      const data = (await response.json()) as {
        data: ConvergenceEvent[];
        total: number;
        page: number;
        page_size: number;
      };

      res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }
);

// GET /convergence/stats — convergence statistics
router.get(
  '/stats',
  requireAuth,
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const response = await fetch(`${CONVERGENCE_ENGINE_URL}/v1/scores?page=1&page_size=1000`);

      if (!response.ok) {
        const errorText = await response.text();
        next(
          createError(
            response.status,
            'Convergence Stats Failed',
            `Failed to fetch convergence stats: ${errorText}`
          )
        );
        return;
      }

      const data = (await response.json()) as {
        data: Array<{ estimated_convergence_score: number; certified_target: boolean }>;
        total: number;
      };

      const certified = data.data.filter((s) => s.certified_target).length;
      const high_potential = data.data.filter((s) => s.estimated_convergence_score >= 60).length;
      const avg_score =
        data.data.length > 0
          ? data.data.reduce((sum, s) => sum + s.estimated_convergence_score, 0) / data.data.length
          : 0;

      res.status(200).json({
        total_mines: data.total,
        certified_targets: certified,
        high_potential_targets: high_potential,
        average_score: Math.round(avg_score * 100) / 100,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
