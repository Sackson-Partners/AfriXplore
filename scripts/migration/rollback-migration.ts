#!/usr/bin/env ts-node

/**
 * Migration Rollback Script
 * Safely rollback data migration if issues are detected
 */

import { Pool } from 'pg';
import * as readline from 'readline';
import { createLogger } from '../../packages/monitoring/src/logger';

const logger = createLogger('migration-rollback');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

class MigrationRollback {
  /**
   * Run rollback process
   */
  async rollback() {
    logger.warn('Starting migration rollback process');

    // Safety checks
    await this.performSafetyChecks();

    // Confirm with user
    const confirmed = await this.confirmRollback();
    if (!confirmed) {
      logger.info('Rollback cancelled by user');
      return;
    }

    // Create backup before rollback
    logger.info('Creating backup before rollback...');
    await this.createBackup();

    // Perform rollback
    await this.executeRollback();

    // Verify rollback
    await this.verifyRollback();

    logger.info('Migration rollback completed');
    rl.close();
    await pool.end();
  }

  /**
   * Perform safety checks
   */
  private async performSafetyChecks() {
    logger.info('Performing safety checks...');

    // Check if we're in production
    if (process.env.NODE_ENV === 'production') {
      logger.warn('⚠️  WARNING: Running rollback in PRODUCTION environment');

      const response = await question('Type "ROLLBACK PRODUCTION" to confirm: ');
      if (response !== 'ROLLBACK PRODUCTION') {
        logger.error('Incorrect confirmation. Aborting.');
        process.exit(1);
      }
    }

    // Check if migration tracking exists
    const trackingExists = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'migration_tracking'
      ) as exists
    `);

    if (!trackingExists.rows[0].exists) {
      logger.error('Migration tracking table does not exist. Cannot rollback.');
      process.exit(1);
    }

    // Check migration status
    const migrationStatus = await pool.query(`
      SELECT status, started_at, completed_at
      FROM migration_tracking
      WHERE migration_name = 'historical-data-migration'
    `);

    if (migrationStatus.rows.length === 0) {
      logger.error('No migration record found. Nothing to rollback.');
      process.exit(1);
    }

    const status = migrationStatus.rows[0].status;
    logger.info(`Current migration status: ${status}`);
  }

  /**
   * Confirm rollback with user
   */
  private async confirmRollback(): Promise<boolean> {
    console.log('\n' + '='.repeat(80));
    console.log('MIGRATION ROLLBACK');
    console.log('='.repeat(80));
    console.log('\nThis will DELETE all migrated data and restore the database to');
    console.log('the state before migration.');
    console.log('\n⚠️  WARNING: This action cannot be undone after backup is deleted.');
    console.log('='.repeat(80) + '\n');

    const response = await question('Are you sure you want to continue? (yes/no): ');
    return response.toLowerCase() === 'yes';
  }

  /**
   * Create backup before rollback
   */
  private async createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `pre-rollback-${timestamp}`;

    logger.info(`Creating backup: ${backupName}`);

    // Export data to JSON files for each table
    const tables = [
      'mines',
      'regions',
      'concessions',
      'archive_documents',
      'scouts',
      'scout_reports',
      'survey_orders',
      'anomalies',
    ];

    const fs = require('fs');
    const backupDir = `./backups/${backupName}`;

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    for (const table of tables) {
      const result = await pool.query(`SELECT * FROM ${table}`);
      const filePath = `${backupDir}/${table}.json`;
      fs.writeFileSync(filePath, JSON.stringify(result.rows, null, 2));
      logger.info(`Backed up ${table}: ${result.rows.length} records`);
    }

    logger.info(`Backup completed: ${backupDir}`);
  }

  /**
   * Execute rollback
   */
  private async executeRollback() {
    logger.info('Executing rollback...');

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Delete in reverse order (respecting foreign keys)
      const tables = [
        'anomalies',
        'survey_orders',
        'scout_reports',
        'scouts',
        'archive_documents',
        'concessions',
        'regions',
        'mines',
      ];

      for (const table of tables) {
        const result = await client.query(`DELETE FROM ${table}`);
        logger.info(`Deleted from ${table}: ${result.rowCount} records`);
      }

      // Reset sequences
      for (const table of tables) {
        await client.query(`
          SELECT setval(pg_get_serial_sequence('${table}', 'id'), 1, false)
        `).catch(() => {
          // Some tables might not have serial sequences
          logger.debug(`No sequence found for ${table}`);
        });
      }

      // Update migration tracking
      await client.query(`
        UPDATE migration_tracking
        SET status = 'rolled-back',
            completed_at = NULL
        WHERE migration_name = 'historical-data-migration'
      `);

      await client.query('COMMIT');
      logger.info('Rollback transaction committed');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Rollback transaction failed, rolled back', error as Error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Verify rollback
   */
  private async verifyRollback() {
    logger.info('Verifying rollback...');

    const tables = [
      'mines',
      'regions',
      'concessions',
      'archive_documents',
      'scouts',
      'scout_reports',
      'survey_orders',
      'anomalies',
    ];

    for (const table of tables) {
      const result = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
      const count = parseInt(result.rows[0].count, 10);

      if (count !== 0) {
        logger.error(`Verification failed: ${table} still has ${count} records`);
        throw new Error('Rollback verification failed');
      } else {
        logger.info(`Verified ${table}: 0 records`);
      }
    }

    logger.info('Rollback verification passed');
  }
}

// Main execution
async function main() {
  const rollback = new MigrationRollback();
  await rollback.rollback();
}

main().catch((error) => {
  logger.error('Rollback script failed', error);
  process.exit(1);
});
