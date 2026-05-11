import { Request, Response, NextFunction } from 'express';
import { db } from '../db/client';

/**
 * Subscriber context middleware.
 *
 * Must run AFTER authMiddleware (requires req.userId to be set).
 * Loads the subscriber record from the DB using the Entra object ID,
 * then attaches structured context to the request object.
 *
 * All downstream routes should read from req.subscriber instead of
 * trusting client-supplied headers.
 */
export interface SubscriberContext {
  id: string;
  tier: 'starter' | 'professional' | 'enterprise';
  hasLicensedTerritories: boolean;
  isActive: boolean;
}

declare global {
  namespace Express {
    interface Request {
      subscriber?: SubscriberContext;
    }
  }
}

export async function subscriberMiddleware(req: Request, res: Response, next: NextFunction) {
  // Dev bypass — userId is already a dev stub
  if (process.env.DEV_BYPASS_AUTH === 'true') {
    req.subscriber = {
      id: 'dev-subscriber',
      tier: 'professional',
      hasLicensedTerritories: false,
      isActive: true,
    };
    return next();
  }

  const userId = (req as any).userId as string;
  if (!userId) {
    return res.status(401).json({ type: 'https://afrixplore.io/errors/unauthorized', status: 401 });
  }

  try {
    const result = await db.query(
      `SELECT id, tier, is_active,
              licensed_territories IS NOT NULL AS has_licensed_territories
       FROM subscribers
       WHERE entra_object_id = $1
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({
        type: 'https://afrixplore.io/errors/forbidden',
        title: 'Subscriber account not found',
        status: 403,
      });
    }

    const row = result.rows[0];

    if (!row.is_active) {
      return res.status(403).json({
        type: 'https://afrixplore.io/errors/forbidden',
        title: 'Subscriber account is inactive',
        status: 403,
      });
    }

    req.subscriber = {
      id: row.id,
      tier: row.tier,
      hasLicensedTerritories: row.has_licensed_territories === true,
      isActive: row.is_active,
    };

    return next();
  } catch (err) {
    process.stderr.write(
      JSON.stringify({
        level: 'error', service: 'intelligence-api',
        ts: new Date().toISOString(),
        msg: 'subscriberMiddleware DB error',
        error: String(err),
      }) + '\n'
    );
    return res.status(500).json({ type: 'https://afrixplore.io/errors/internal', status: 500 });
  }
}
