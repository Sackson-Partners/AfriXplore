#!/usr/bin/env ts-node

/**
 * Scheduled data ingestion script
 * Runs periodically to pull data from external sources
 */

import { Pool } from 'pg';
import axios from 'axios';
import { createLogger } from '../../packages/monitoring/src/logger';

const logger = createLogger('scheduled-ingestion');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

interface IngestionSource {
  name: string;
  endpoint: string;
  authToken?: string;
  enabled: boolean;
}

const SOURCES: IngestionSource[] = [
  {
    name: 'MSIM Archive Service',
    endpoint: process.env.MSIM_ARCHIVE_ENDPOINT || 'https://archive.msim.io/api/v1/exports',
    authToken: process.env.MSIM_ARCHIVE_TOKEN,
    enabled: !!process.env.MSIM_ARCHIVE_ENDPOINT,
  },
  {
    name: 'GeoSwarm Scout Reports',
    endpoint: process.env.GEOSWARM_API || 'https://api.geoswarm.io/v1/reports',
    authToken: process.env.GEOSWARM_API_TOKEN,
    enabled: !!process.env.GEOSWARM_API,
  },
];

async function ingestFromSource(source: IngestionSource) {
  logger.info(`Starting ingestion from ${source.name}`);
  const startTime = Date.now();

  try {
    const response = await axios.get(source.endpoint, {
      headers: source.authToken ? { Authorization: `Bearer ${source.authToken}` } : {},
      timeout: 60000, // 60 second timeout
    });

    const records = Array.isArray(response.data) ? response.data : response.data.data;

    if (!records || records.length === 0) {
      logger.warn(`No records returned from ${source.name}`);
      return { success: true, count: 0 };
    }

    logger.info(`Fetched ${records.length} records from ${source.name}`);

    // Process records based on source type
    let processedCount = 0;
    let errorCount = 0;

    for (const record of records) {
      try {
        await processRecord(source.name, record);
        processedCount++;
      } catch (error: any) {
        errorCount++;
        logger.error(`Failed to process record from ${source.name}`, error, { record });
      }
    }

    const duration = Date.now() - startTime;
    logger.info(`Completed ingestion from ${source.name}`, {
      duration: `${duration}ms`,
      processed: processedCount,
      errors: errorCount,
    });

    // Log to ingestion_logs table
    await logIngestion(source.name, records.length, processedCount, errorCount, duration);

    return { success: true, count: processedCount, errors: errorCount };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error(`Ingestion failed for ${source.name}`, error, { duration: `${duration}ms` });
    await logIngestion(source.name, 0, 0, 1, duration, error.message);
    return { success: false, error: error.message };
  }
}

async function processRecord(sourceName: string, record: any) {
  // Route to appropriate processor based on source
  if (sourceName.includes('Archive')) {
    await processArchiveRecord(record);
  } else if (sourceName.includes('GeoSwarm')) {
    await processScoutReport(record);
  } else {
    throw new Error(`Unknown source type: ${sourceName}`);
  }
}

async function processArchiveRecord(record: any) {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO archive_documents (mine_id, title, document_type, file_path, year, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (file_path) DO UPDATE SET
        title = EXCLUDED.title,
        updated_at = NOW()`,
      [record.mine_id, record.title, record.document_type, record.file_path, record.year]
    );
  } finally {
    client.release();
  }
}

async function processScoutReport(record: any) {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO scout_reports (scout_id, mine_id, report_type, observations, confidence_level, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT DO NOTHING`,
      [
        record.scout_id,
        record.mine_id,
        record.report_type,
        record.observations,
        record.confidence_level,
      ]
    );
  } finally {
    client.release();
  }
}

async function logIngestion(
  source: string,
  fetchedCount: number,
  processedCount: number,
  errorCount: number,
  durationMs: number,
  errorMessage?: string
) {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO ingestion_logs (source, fetched_count, processed_count, error_count, duration_ms, error_message, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [source, fetchedCount, processedCount, errorCount, durationMs, errorMessage]
    );
  } finally {
    client.release();
  }
}

async function runScheduledIngestion() {
  logger.info('Starting scheduled ingestion run');

  const results = [];

  for (const source of SOURCES) {
    if (!source.enabled) {
      logger.info(`Skipping disabled source: ${source.name}`);
      continue;
    }

    const result = await ingestFromSource(source);
    results.push({ source: source.name, ...result });
  }

  logger.info('Scheduled ingestion completed', { results });

  await pool.end();

  // Exit with error code if any ingestion failed
  const hasFailures = results.some((r) => !r.success);
  process.exit(hasFailures ? 1 : 0);
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  logger.error('Unhandled rejection', error as Error);
  process.exit(1);
});

// Run ingestion
runScheduledIngestion().catch((error) => {
  logger.error('Fatal error', error);
  process.exit(1);
});
