#!/usr/bin/env ts-node

/**
 * Data Integrity Verification Script
 * Runs comprehensive checks on migrated data
 */

import { Pool } from 'pg';
import { createLogger } from '../../packages/monitoring/src/logger';

const logger = createLogger('data-verification');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

interface ValidationResult {
  checkName: string;
  passed: boolean;
  message: string;
  details?: any;
}

class DataIntegrityVerifier {
  private results: ValidationResult[] = [];

  async runAllChecks() {
    logger.info('Starting data integrity verification');

    // Run all validation checks
    await this.checkRecordCounts();
    await this.checkForeignKeyIntegrity();
    await this.checkRequiredFields();
    await this.checkCoordinateBounds();
    await this.checkDuplicateRecords();
    await this.checkDataQuality();
    await this.checkIndexes();
    await this.checkConstraints();

    // Print report
    this.printReport();

    await pool.end();

    // Exit with error code if any checks failed
    const failedChecks = this.results.filter((r) => !r.passed);
    if (failedChecks.length > 0) {
      logger.error(`${failedChecks.length} integrity checks failed`);
      process.exit(1);
    } else {
      logger.info('All integrity checks passed');
      process.exit(0);
    }
  }

  /**
   * Check record counts match expectations
   */
  private async checkRecordCounts() {
    logger.info('Checking record counts...');

    const tables = [
      { name: 'mines', minExpected: 1 },
      { name: 'regions', minExpected: 0 },
      { name: 'concessions', minExpected: 0 },
      { name: 'archive_documents', minExpected: 0 },
      { name: 'scouts', minExpected: 0 },
      { name: 'scout_reports', minExpected: 0 },
    ];

    for (const table of tables) {
      const result = await pool.query(`SELECT COUNT(*) as count FROM ${table.name}`);
      const count = parseInt(result.rows[0].count, 10);

      if (count < table.minExpected) {
        this.results.push({
          checkName: `Record count: ${table.name}`,
          passed: false,
          message: `Expected at least ${table.minExpected} records, found ${count}`,
          details: { table: table.name, count, minExpected: table.minExpected },
        });
      } else {
        this.results.push({
          checkName: `Record count: ${table.name}`,
          passed: true,
          message: `Found ${count} records`,
          details: { table: table.name, count },
        });
      }
    }
  }

  /**
   * Check foreign key integrity
   */
  private async checkForeignKeyIntegrity() {
    logger.info('Checking foreign key integrity...');

    const checks = [
      {
        name: 'archive_documents.mine_id',
        query: `SELECT COUNT(*) as count FROM archive_documents
                WHERE mine_id IS NOT NULL
                AND NOT EXISTS (SELECT 1 FROM mines WHERE id = archive_documents.mine_id)`,
      },
      {
        name: 'scout_reports.mine_id',
        query: `SELECT COUNT(*) as count FROM scout_reports
                WHERE mine_id IS NOT NULL
                AND NOT EXISTS (SELECT 1 FROM mines WHERE id = scout_reports.mine_id)`,
      },
      {
        name: 'scout_reports.scout_id',
        query: `SELECT COUNT(*) as count FROM scout_reports
                WHERE scout_id IS NOT NULL
                AND NOT EXISTS (SELECT 1 FROM scouts WHERE id = scout_reports.scout_id)`,
      },
    ];

    for (const check of checks) {
      const result = await pool.query(check.query);
      const orphanedCount = parseInt(result.rows[0].count, 10);

      if (orphanedCount > 0) {
        this.results.push({
          checkName: `Foreign key integrity: ${check.name}`,
          passed: false,
          message: `Found ${orphanedCount} orphaned records`,
          details: { field: check.name, orphanedCount },
        });
      } else {
        this.results.push({
          checkName: `Foreign key integrity: ${check.name}`,
          passed: true,
          message: 'No orphaned records found',
        });
      }
    }
  }

  /**
   * Check required fields are populated
   */
  private async checkRequiredFields() {
    logger.info('Checking required fields...');

    const checks = [
      {
        table: 'mines',
        fields: ['name', 'country', 'commodity', 'coordinates'],
      },
      {
        table: 'regions',
        fields: ['name', 'country'],
      },
      {
        table: 'scouts',
        fields: ['phone', 'country'],
      },
    ];

    for (const check of checks) {
      for (const field of check.fields) {
        const nullCheckQuery =
          field === 'coordinates'
            ? `SELECT COUNT(*) as count FROM ${check.table} WHERE ${field} IS NULL OR ST_IsEmpty(${field})`
            : `SELECT COUNT(*) as count FROM ${check.table} WHERE ${field} IS NULL OR ${field} = ''`;

        const result = await pool.query(nullCheckQuery);
        const nullCount = parseInt(result.rows[0].count, 10);

        if (nullCount > 0) {
          this.results.push({
            checkName: `Required field: ${check.table}.${field}`,
            passed: false,
            message: `Found ${nullCount} records with null/empty ${field}`,
            details: { table: check.table, field, nullCount },
          });
        } else {
          this.results.push({
            checkName: `Required field: ${check.table}.${field}`,
            passed: true,
            message: 'All records have valid values',
          });
        }
      }
    }
  }

  /**
   * Check coordinate bounds
   */
  private async checkCoordinateBounds() {
    logger.info('Checking coordinate bounds...');

    const result = await pool.query(`
      SELECT COUNT(*) as count
      FROM mines
      WHERE ST_X(coordinates) < -180
         OR ST_X(coordinates) > 180
         OR ST_Y(coordinates) < -90
         OR ST_Y(coordinates) > 90
    `);

    const invalidCount = parseInt(result.rows[0].count, 10);

    if (invalidCount > 0) {
      this.results.push({
        checkName: 'Coordinate bounds',
        passed: false,
        message: `Found ${invalidCount} records with invalid coordinates`,
        details: { invalidCount },
      });
    } else {
      this.results.push({
        checkName: 'Coordinate bounds',
        passed: true,
        message: 'All coordinates within valid bounds',
      });
    }
  }

  /**
   * Check for duplicate records
   */
  private async checkDuplicateRecords() {
    logger.info('Checking for duplicate records...');

    // Check for duplicate mines (same name + country)
    const minesDuplicates = await pool.query(`
      SELECT name, country, COUNT(*) as count
      FROM mines
      GROUP BY name, country
      HAVING COUNT(*) > 1
    `);

    if (minesDuplicates.rows.length > 0) {
      this.results.push({
        checkName: 'Duplicate mines',
        passed: false,
        message: `Found ${minesDuplicates.rows.length} duplicate mine entries`,
        details: { duplicates: minesDuplicates.rows },
      });
    } else {
      this.results.push({
        checkName: 'Duplicate mines',
        passed: true,
        message: 'No duplicate mines found',
      });
    }
  }

  /**
   * Check data quality
   */
  private async checkDataQuality() {
    logger.info('Checking data quality...');

    // Check DPI scores are in valid range
    const invalidDPI = await pool.query(`
      SELECT COUNT(*) as count
      FROM mines
      WHERE dpi_score IS NOT NULL
        AND (dpi_score < 0 OR dpi_score > 10)
    `);

    if (parseInt(invalidDPI.rows[0].count, 10) > 0) {
      this.results.push({
        checkName: 'DPI score range',
        passed: false,
        message: `Found ${invalidDPI.rows[0].count} records with DPI score outside 0-10 range`,
      });
    } else {
      this.results.push({
        checkName: 'DPI score range',
        passed: true,
        message: 'All DPI scores within valid range',
      });
    }

    // Check for reasonable depth values
    const invalidDepth = await pool.query(`
      SELECT COUNT(*) as count
      FROM mines
      WHERE estimated_depth_m IS NOT NULL
        AND (estimated_depth_m < 0 OR estimated_depth_m > 5000)
    `);

    if (parseInt(invalidDepth.rows[0].count, 10) > 0) {
      this.results.push({
        checkName: 'Depth values',
        passed: false,
        message: `Found ${invalidDepth.rows[0].count} records with unreasonable depth values`,
      });
    } else {
      this.results.push({
        checkName: 'Depth values',
        passed: true,
        message: 'All depth values are reasonable',
      });
    }
  }

  /**
   * Check indexes exist
   */
  private async checkIndexes() {
    logger.info('Checking indexes...');

    const expectedIndexes = [
      'idx_mines_country',
      'idx_mines_commodity',
      'idx_mines_dpi_score',
      'idx_mines_coordinates',
      'idx_archive_documents_mine_id',
      'idx_scout_reports_mine_id',
      'idx_scout_reports_scout_id',
    ];

    for (const indexName of expectedIndexes) {
      const result = await pool.query(
        `SELECT EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE indexname = $1
        ) as exists`,
        [indexName]
      );

      if (!result.rows[0].exists) {
        this.results.push({
          checkName: `Index: ${indexName}`,
          passed: false,
          message: `Index ${indexName} does not exist`,
        });
      } else {
        this.results.push({
          checkName: `Index: ${indexName}`,
          passed: true,
          message: 'Index exists',
        });
      }
    }
  }

  /**
   * Check constraints
   */
  private async checkConstraints() {
    logger.info('Checking constraints...');

    const result = await pool.query(`
      SELECT
        conname as constraint_name,
        contype as constraint_type,
        conrelid::regclass as table_name
      FROM pg_constraint
      WHERE connamespace = 'public'::regnamespace
      ORDER BY conrelid::regclass::text, contype
    `);

    this.results.push({
      checkName: 'Database constraints',
      passed: true,
      message: `Found ${result.rows.length} constraints`,
      details: { constraintCount: result.rows.length },
    });
  }

  /**
   * Print verification report
   */
  private printReport() {
    console.log('\n' + '='.repeat(80));
    console.log('DATA INTEGRITY VERIFICATION REPORT');
    console.log('='.repeat(80));

    const passedCount = this.results.filter((r) => r.passed).length;
    const failedCount = this.results.filter((r) => !r.passed).length;

    console.log(`\nOverall: ${passedCount} passed, ${failedCount} failed\n`);

    // Group results by status
    const passed = this.results.filter((r) => r.passed);
    const failed = this.results.filter((r) => !r.passed);

    if (failed.length > 0) {
      console.log('❌ FAILED CHECKS:');
      failed.forEach((result) => {
        console.log(`  - ${result.checkName}: ${result.message}`);
        if (result.details) {
          console.log(`    Details: ${JSON.stringify(result.details)}`);
        }
      });
      console.log('');
    }

    if (passed.length > 0) {
      console.log('✅ PASSED CHECKS:');
      passed.forEach((result) => {
        console.log(`  - ${result.checkName}: ${result.message}`);
      });
    }

    console.log('\n' + '='.repeat(80));
  }
}

// Main execution
async function main() {
  const verifier = new DataIntegrityVerifier();
  await verifier.runAllChecks();
}

main().catch((error) => {
  logger.error('Verification script failed', error);
  process.exit(1);
});
