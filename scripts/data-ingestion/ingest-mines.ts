#!/usr/bin/env ts-node

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

interface MineRecord {
  name: string;
  country: string;
  region?: string;
  commodity: string;
  latitude: number;
  longitude: number;
  mining_period?: string;
  estimated_depth_m?: number;
  dpi_score?: number;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function validateRecord(record: MineRecord): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  if (!record.name || record.name.trim().length === 0) {
    errors.push('Name is required');
  }

  if (!record.country || record.country.trim().length === 0) {
    errors.push('Country is required');
  }

  if (!record.commodity || record.commodity.trim().length === 0) {
    errors.push('Commodity is required');
  }

  if (typeof record.latitude !== 'number' || record.latitude < -90 || record.latitude > 90) {
    errors.push('Invalid latitude');
  }

  if (typeof record.longitude !== 'number' || record.longitude < -180 || record.longitude > 180) {
    errors.push('Invalid longitude');
  }

  if (record.dpi_score !== undefined && (record.dpi_score < 0 || record.dpi_score > 10)) {
    errors.push('DPI score must be between 0 and 10');
  }

  return { valid: errors.length === 0, errors };
}

async function ingestMine(record: MineRecord): Promise<{ success: boolean; id?: string; error?: string }> {
  const client = await pool.connect();

  try {
    // Validate record
    const validation = await validateRecord(record);
    if (!validation.valid) {
      return { success: false, error: validation.errors.join(', ') };
    }

    // Check for duplicate
    const duplicateCheck = await client.query(
      'SELECT id FROM mines WHERE name = $1 AND country = $2',
      [record.name, record.country]
    );

    if (duplicateCheck.rows.length > 0) {
      // Update existing record
      const result = await client.query(
        `UPDATE mines SET
          region = COALESCE($1, region),
          commodity = $2,
          coordinates = ST_SetSRID(ST_MakePoint($3, $4), 4326),
          mining_period = COALESCE($5, mining_period),
          estimated_depth_m = COALESCE($6, estimated_depth_m),
          dpi_score = COALESCE($7, dpi_score),
          updated_at = NOW()
        WHERE id = $8
        RETURNING id`,
        [
          record.region,
          record.commodity,
          record.longitude,
          record.latitude,
          record.mining_period,
          record.estimated_depth_m,
          record.dpi_score,
          duplicateCheck.rows[0].id,
        ]
      );

      return { success: true, id: result.rows[0].id };
    } else {
      // Insert new record
      const result = await client.query(
        `INSERT INTO mines (name, country, region, commodity, coordinates, mining_period, estimated_depth_m, dpi_score)
        VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326), $7, $8, $9)
        RETURNING id`,
        [
          record.name,
          record.country,
          record.region,
          record.commodity,
          record.longitude,
          record.latitude,
          record.mining_period,
          record.estimated_depth_m,
          record.dpi_score,
        ]
      );

      return { success: true, id: result.rows[0].id };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  } finally {
    client.release();
  }
}

async function ingestFromCSV(filePath: string) {
  console.log(`Starting ingestion from ${filePath}...`);

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    cast: (value, context) => {
      // Cast numeric fields
      if (context.column === 'latitude' || context.column === 'longitude') {
        return parseFloat(value);
      }
      if (context.column === 'estimated_depth_m') {
        return value ? parseInt(value, 10) : undefined;
      }
      if (context.column === 'dpi_score') {
        return value ? parseFloat(value) : undefined;
      }
      return value;
    },
  });

  console.log(`Found ${records.length} records to process`);

  let successCount = 0;
  let errorCount = 0;
  const errors: Array<{ record: any; error: string }> = [];

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    console.log(`Processing record ${i + 1}/${records.length}: ${record.name}`);

    const result = await ingestMine(record);

    if (result.success) {
      successCount++;
      console.log(`  ✓ Success (ID: ${result.id})`);
    } else {
      errorCount++;
      console.error(`  ✗ Error: ${result.error}`);
      errors.push({ record, error: result.error || 'Unknown error' });
    }
  }

  console.log('\n=== Ingestion Summary ===');
  console.log(`Total records: ${records.length}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${errorCount}`);

  if (errors.length > 0) {
    console.log('\n=== Errors ===');
    errors.forEach((err, idx) => {
      console.log(`${idx + 1}. ${err.record.name}: ${err.error}`);
    });

    // Write errors to file
    const errorLogPath = path.join(path.dirname(filePath), 'ingestion-errors.json');
    fs.writeFileSync(errorLogPath, JSON.stringify(errors, null, 2));
    console.log(`\nError details written to: ${errorLogPath}`);
  }

  await pool.end();
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: ts-node ingest-mines.ts <csv-file-path>');
  console.error('Example: ts-node ingest-mines.ts data/mines.csv');
  process.exit(1);
}

const filePath = path.resolve(args[0]);
ingestFromCSV(filePath).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
