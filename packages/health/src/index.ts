/**
 * AfriXplore — Unified Health Check System
 * Used by all Container Apps services
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { BlobServiceClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';

export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: string;
  checks: DependencyCheck[];
  environment: string;
}

interface DependencyCheck {
  name: string;
  status: 'up' | 'down' | 'degraded';
  latencyMs?: number;
  details?: string;
  critical: boolean;
}

export function createHealthRouter(
  serviceName: string,
  db?: Pool,
  options: {
    checkServiceBus?: boolean;
    checkBlob?: boolean;
  } = {}
): Router {
  const router = Router();
  const startTime = Date.now();

  // GET /health — Liveness probe (fast)
  router.get('/', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: serviceName,
      timestamp: new Date().toISOString(),
    });
  });

  // GET /health/ready — Readiness probe (checks dependencies)
  router.get('/ready', async (req: Request, res: Response) => {
    const checks: DependencyCheck[] = [];
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (db) {
      const dbCheck = await checkDatabase(db);
      checks.push(dbCheck);

      if (dbCheck.status === 'down' && dbCheck.critical) {
        overallStatus = 'unhealthy';
      } else if (dbCheck.status === 'degraded') {
        overallStatus = 'degraded';
      }
    }

    if (options.checkBlob && process.env.AZURE_STORAGE_ACCOUNT_NAME) {
      const blobCheck = await checkBlobStorage();
      checks.push(blobCheck);
      if (blobCheck.status === 'down' && overallStatus !== 'unhealthy') {
        overallStatus = 'degraded';
      }
    }

    const result: HealthCheckResult = {
      service: serviceName,
      status: overallStatus,
      version: process.env.npm_package_version || '1.0.0',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
      checks,
      environment: process.env.NODE_ENV || 'unknown',
    };

    const httpStatus = overallStatus === 'unhealthy' ? 503 : 200;
    res.status(httpStatus).json(result);
  });

  // GET /health/live — Azure Container Apps liveness probe
  router.get('/live', (req: Request, res: Response) => {
    res.status(200).json({ alive: true });
  });

  return router;
}

async function checkDatabase(db: Pool): Promise<DependencyCheck> {
  const start = Date.now();
  try {
    await db.query('SELECT 1');
    const latencyMs = Date.now() - start;
    return {
      name: 'postgresql',
      status: latencyMs > 1000 ? 'degraded' : 'up',
      latencyMs,
      details: latencyMs > 1000 ? 'High latency detected' : 'Connected',
      critical: true,
    };
  } catch (error) {
    return {
      name: 'postgresql',
      status: 'down',
      latencyMs: Date.now() - start,
      details: (error as Error).message,
      critical: true,
    };
  }
}

async function checkBlobStorage(): Promise<DependencyCheck> {
  const start = Date.now();
  try {
    const credential = new DefaultAzureCredential();
    const client = new BlobServiceClient(
      `https://${process.env.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net`,
      credential
    );
    const iter = client.listContainers();
    await iter.next();
    return {
      name: 'blob_storage',
      status: 'up',
      latencyMs: Date.now() - start,
      details: 'Connected',
      critical: false,
    };
  } catch (error) {
    return {
      name: 'blob_storage',
      status: 'down',
      latencyMs: Date.now() - start,
      details: (error as Error).message,
      critical: false,
    };
  }
}
