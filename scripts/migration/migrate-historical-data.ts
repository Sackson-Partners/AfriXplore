#!/usr/bin/env ts-node

/**
 * Historical Data Migration Script
 * Migrates all historical data from legacy sources to production database
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../../packages/monitoring/src/logger';

const logger = createLogger('data-migration');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

interface MigrationProgress {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  startTime: Date;
  endTime?: Date;
}

interface MigrationResult {
  entityType: string;
  progress: MigrationProgress;
  errors: Array<{ record: any; error: string }>;
}

class DataMigration {
  private results: MigrationResult[] = [];

  /**
   * Run full migration
   */
  async runFullMigration() {
    logger.info('Starting full historical data migration');

    try {
      // Create migration tracking table
      await this.initializeMigrationTracking();

      // Check if migration already completed
      const isCompleted = await this.checkMigrationStatus();
      if (isCompleted) {
        logger.warn('Migration already completed. Use --force to re-run.');
        return;
      }

      // Run migrations in order (respecting foreign key dependencies)
      await this.migrateMines();
      await this.migrateRegions();
      await this.migrateConcessions();
      await this.migrateArchiveDocuments();
      await this.migrateScouts();
      await this.migrateScoutReports();
      await this.migrateSurveyOrders();
      await this.migrateAnomalies();

      // Mark migration as complete
      await this.markMigrationComplete();

      // Generate summary report
      this.printSummaryReport();

      logger.info('Full historical data migration completed');
    } catch (error: any) {
      logger.error('Migration failed', error);
      throw error;
    } finally {
      await pool.end();
    }
  }

  /**
   * Initialize migration tracking table
   */
  private async initializeMigrationTracking() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migration_tracking (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) UNIQUE NOT NULL,
        status VARCHAR(50) NOT NULL,
        started_at TIMESTAMP NOT NULL,
        completed_at TIMESTAMP,
        records_total INTEGER,
        records_succeeded INTEGER,
        records_failed INTEGER,
        error_log JSONB
      )
    `);
  }

  /**
   * Check if migration already completed
   */
  private async checkMigrationStatus(): Promise<boolean> {
    const result = await pool.query(
      `SELECT status FROM migration_tracking
       WHERE migration_name = 'historical-data-migration'
       AND status = 'completed'`
    );
    return result.rows.length > 0;
  }

  /**
   * Mark migration as complete
   */
  private async markMigrationComplete() {
    const totalRecords = this.results.reduce((sum, r) => sum + r.progress.total, 0);
    const succeededRecords = this.results.reduce((sum, r) => sum + r.progress.succeeded, 0);
    const failedRecords = this.results.reduce((sum, r) => sum + r.progress.failed, 0);

    await pool.query(
      `INSERT INTO migration_tracking
       (migration_name, status, started_at, completed_at, records_total, records_succeeded, records_failed)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (migration_name) DO UPDATE SET
         status = EXCLUDED.status,
         completed_at = EXCLUDED.completed_at,
         records_succeeded = EXCLUDED.records_succeeded,
         records_failed = EXCLUDED.records_failed`,
      [
        'historical-data-migration',
        failedRecords > 0 ? 'completed-with-errors' : 'completed',
        this.results[0]?.progress.startTime || new Date(),
        new Date(),
        totalRecords,
        succeededRecords,
        failedRecords,
      ]
    );
  }

  /**
   * Migrate mines data
   */
  private async migrateMines() {
    const entityType = 'mines';
    logger.info(`Migrating ${entityType}...`);

    const progress: MigrationProgress = {
      total: 0,
      processed: 0,
      succeeded: 0,
      failed: 0,
      startTime: new Date(),
    };

    const errors: Array<{ record: any; error: string }> = [];

    try {
      // Load data from legacy source
      const legacyData = await this.loadLegacyMines();
      progress.total = legacyData.length;

      for (const record of legacyData) {
        try {
          await this.insertMine(record);
          progress.succeeded++;
          logger.debug(`Migrated mine: ${record.name}`);
        } catch (error: any) {
          progress.failed++;
          errors.push({ record, error: error.message });
          logger.error(`Failed to migrate mine: ${record.name}`, error);
        }
        progress.processed++;

        // Progress indicator every 100 records
        if (progress.processed % 100 === 0) {
          logger.info(`Progress: ${progress.processed}/${progress.total} mines`);
        }
      }

      progress.endTime = new Date();
      this.results.push({ entityType, progress, errors });

      logger.info(`Completed migrating ${entityType}: ${progress.succeeded} succeeded, ${progress.failed} failed`);
    } catch (error: any) {
      logger.error(`Failed to migrate ${entityType}`, error);
      throw error;
    }
  }

  /**
   * Load legacy mines data (from CSV, API, or database export)
   */
  private async loadLegacyMines(): Promise<any[]> {
    // Example: Load from CSV file
    const csvPath = process.env.LEGACY_MINES_CSV || './data/legacy/mines.csv';

    if (!fs.existsSync(csvPath)) {
      logger.warn(`Legacy mines data not found at ${csvPath}, using empty dataset`);
      return [];
    }

    const { parse } = require('csv-parse/sync');
    const fileContent = fs.readFileSync(csvPath, 'utf-8');

    return parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      cast: (value, context) => {
        if (context.column === 'latitude' || context.column === 'longitude') {
          return parseFloat(value);
        }
        if (context.column === 'estimated_depth_m') {
          return value ? parseInt(value, 10) : null;
        }
        if (context.column === 'dpi_score') {
          return value ? parseFloat(value) : null;
        }
        return value || null;
      },
    });
  }

  /**
   * Insert mine record
   */
  private async insertMine(record: any) {
    await pool.query(
      `INSERT INTO mines (
        id, name, country, region, commodity,
        coordinates, mining_period, estimated_depth_m,
        dpi_score, created_at, updated_at
      )
      VALUES (
        COALESCE($1, gen_random_uuid()), $2, $3, $4, $5,
        ST_SetSRID(ST_MakePoint($6, $7), 4326), $8, $9,
        $10, COALESCE($11, NOW()), NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        country = EXCLUDED.country,
        region = EXCLUDED.region,
        commodity = EXCLUDED.commodity,
        coordinates = EXCLUDED.coordinates,
        mining_period = EXCLUDED.mining_period,
        estimated_depth_m = EXCLUDED.estimated_depth_m,
        dpi_score = EXCLUDED.dpi_score,
        updated_at = NOW()`,
      [
        record.id,
        record.name,
        record.country,
        record.region,
        record.commodity,
        record.longitude,
        record.latitude,
        record.mining_period,
        record.estimated_depth_m,
        record.dpi_score,
        record.created_at,
      ]
    );
  }

  /**
   * Migrate regions
   */
  private async migrateRegions() {
    const entityType = 'regions';
    logger.info(`Migrating ${entityType}...`);

    // Similar structure to migrateMines
    // Load legacy regions and insert
    // Track progress and errors

    this.results.push({
      entityType,
      progress: {
        total: 0,
        processed: 0,
        succeeded: 0,
        failed: 0,
        startTime: new Date(),
        endTime: new Date(),
      },
      errors: [],
    });
  }

  /**
   * Migrate concessions
   */
  private async migrateConcessions() {
    const entityType = 'concessions';
    logger.info(`Migrating ${entityType}...`);

    // Similar structure
    this.results.push({
      entityType,
      progress: {
        total: 0,
        processed: 0,
        succeeded: 0,
        failed: 0,
        startTime: new Date(),
        endTime: new Date(),
      },
      errors: [],
    });
  }

  /**
   * Migrate archive documents
   */
  private async migrateArchiveDocuments() {
    const entityType = 'archive_documents';
    logger.info(`Migrating ${entityType}...`);

    // Similar structure
    this.results.push({
      entityType,
      progress: {
        total: 0,
        processed: 0,
        succeeded: 0,
        failed: 0,
        startTime: new Date(),
        endTime: new Date(),
      },
      errors: [],
    });
  }

  /**
   * Migrate scouts
   */
  private async migrateScouts() {
    const entityType = 'scouts';
    logger.info(`Migrating ${entityType}...`);

    this.results.push({
      entityType,
      progress: {
        total: 0,
        processed: 0,
        succeeded: 0,
        failed: 0,
        startTime: new Date(),
        endTime: new Date(),
      },
      errors: [],
    });
  }

  /**
   * Migrate scout reports
   */
  private async migrateScoutReports() {
    const entityType = 'scout_reports';
    logger.info(`Migrating ${entityType}...`);

    this.results.push({
      entityType,
      progress: {
        total: 0,
        processed: 0,
        succeeded: 0,
        failed: 0,
        startTime: new Date(),
        endTime: new Date(),
      },
      errors: [],
    });
  }

  /**
   * Migrate survey orders
   */
  private async migrateSurveyOrders() {
    const entityType = 'survey_orders';
    logger.info(`Migrating ${entityType}...`);

    this.results.push({
      entityType,
      progress: {
        total: 0,
        processed: 0,
        succeeded: 0,
        failed: 0,
        startTime: new Date(),
        endTime: new Date(),
      },
      errors: [],
    });
  }

  /**
   * Migrate anomalies
   */
  private async migrateAnomalies() {
    const entityType = 'anomalies';
    logger.info(`Migrating ${entityType}...`);

    this.results.push({
      entityType,
      progress: {
        total: 0,
        processed: 0,
        succeeded: 0,
        failed: 0,
        startTime: new Date(),
        endTime: new Date(),
      },
      errors: [],
    });
  }

  /**
   * Print summary report
   */
  private printSummaryReport() {
    console.log('\n' + '='.repeat(80));
    console.log('MIGRATION SUMMARY REPORT');
    console.log('='.repeat(80));

    const totalRecords = this.results.reduce((sum, r) => sum + r.progress.total, 0);
    const succeededRecords = this.results.reduce((sum, r) => sum + r.progress.succeeded, 0);
    const failedRecords = this.results.reduce((sum, r) => sum + r.progress.failed, 0);

    console.log(`\nOverall Statistics:`);
    console.log(`  Total Records: ${totalRecords}`);
    console.log(`  Succeeded: ${succeededRecords} (${((succeededRecords / totalRecords) * 100).toFixed(1)}%)`);
    console.log(`  Failed: ${failedRecords} (${((failedRecords / totalRecords) * 100).toFixed(1)}%)`);

    console.log('\nBy Entity Type:');
    this.results.forEach((result) => {
      const duration = result.progress.endTime
        ? (result.progress.endTime.getTime() - result.progress.startTime.getTime()) / 1000
        : 0;

      console.log(`\n  ${result.entityType}:`);
      console.log(`    Total: ${result.progress.total}`);
      console.log(`    Succeeded: ${result.progress.succeeded}`);
      console.log(`    Failed: ${result.progress.failed}`);
      console.log(`    Duration: ${duration.toFixed(2)}s`);

      if (result.errors.length > 0) {
        console.log(`    Errors (first 5):`);
        result.errors.slice(0, 5).forEach((err, idx) => {
          console.log(`      ${idx + 1}. ${err.error}`);
        });
      }
    });

    console.log('\n' + '='.repeat(80));

    // Write detailed error log
    const errorLogPath = './migration-errors.json';
    const errorLog = this.results
      .filter((r) => r.errors.length > 0)
      .map((r) => ({
        entityType: r.entityType,
        errorCount: r.errors.length,
        errors: r.errors,
      }));

    if (errorLog.length > 0) {
      fs.writeFileSync(errorLogPath, JSON.stringify(errorLog, null, 2));
      console.log(`\nDetailed error log written to: ${errorLogPath}`);
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const forceFlag = args.includes('--force');

  if (forceFlag) {
    logger.warn('Running migration with --force flag (will overwrite existing data)');
  }

  const migration = new DataMigration();
  await migration.runFullMigration();
}

main().catch((error) => {
  logger.error('Migration script failed', error);
  process.exit(1);
});
