# Data Migration Guide

This guide explains how to prepare and migrate historical data into the AIN Platform database.

## Overview

The migration system consists of three main scripts:

1. **migrate-historical-data.ts** - Main migration script
2. **verify-data-integrity.ts** - Data validation after migration
3. **rollback-migration.ts** - Safe rollback if issues occur

---

## Data Preparation

### CSV Format Requirements

#### Mines Data (`mines.csv`)

**Required columns:**
- `id` - UUID format (e.g., `550e8400-e29b-41d4-a716-446655440001`)
- `name` - Mine name (string)
- `country` - Country name (string)
- `commodity` - Primary commodity (e.g., "Copper", "Gold", "Diamond")
- `latitude` - Decimal degrees, range: -90 to 90
- `longitude` - Decimal degrees, range: -180 to 180

**Optional columns:**
- `region` - Geographic region within country
- `mining_period` - Active period (e.g., "1990-Present", "1950-2010")
- `estimated_depth_m` - Depth in meters (integer, 0-5000)
- `dpi_score` - Discovery Priority Index (decimal, 0.0-10.0)
- `created_at` - ISO 8601 timestamp (e.g., "2020-01-15T10:30:00Z")

**Example:**
```csv
id,name,country,region,commodity,latitude,longitude,mining_period,estimated_depth_m,dpi_score,created_at
550e8400-e29b-41d4-a716-446655440001,Chuquicamata,Chile,Antofagasta,Copper,-22.2969,-68.9031,1910-Present,1000,8.5,2020-01-15T10:30:00Z
```

#### Regions Data (`regions.csv`)

**Required columns:**
- `id` - UUID format
- `name` - Region name
- `country` - Country name

**Optional columns:**
- `boundaries` - WKT POLYGON format (e.g., `POLYGON((lon1 lat1, lon2 lat2, ...))`)
- `mining_intensity` - Enum: "Low", "Medium", "High", "Very High"
- `created_at` - ISO 8601 timestamp

**Example:**
```csv
id,name,country,boundaries,mining_intensity,created_at
650e8400-e29b-41d4-a716-446655440001,Atacama Desert,Chile,"POLYGON((-70.5 -18.0, -69.0 -18.0, -69.0 -27.0, -70.5 -27.0, -70.5 -18.0))",High,2020-01-10T09:00:00Z
```

#### Scouts Data (`scouts.csv`)

**Required columns:**
- `id` - UUID format
- `phone` - E.164 format with country code (e.g., "+56912345678")
- `country` - Country name

**Optional columns:**
- `coordinates` - Not used directly (scouts report from various locations)
- `active` - Boolean (true/false)
- `created_at` - ISO 8601 timestamp

**Example:**
```csv
id,phone,country,coordinates,active,created_at
750e8400-e29b-41d4-a716-446655440001,+56912345678,Chile,-23.6509,-70.3975,true,2020-01-05T08:00:00Z
```

### Data Cleaning Checklist

Before migration, ensure your data meets these requirements:

- [ ] **UUIDs**: All IDs are valid UUIDv4 format
- [ ] **No duplicates**: Check for duplicate mines (same name + country)
- [ ] **Coordinates**: All latitude/longitude values are within valid ranges
- [ ] **Required fields**: Name, country, commodity are not empty
- [ ] **DPI scores**: Values between 0.0 and 10.0 (if present)
- [ ] **Depth values**: Reasonable depths (0-5000m)
- [ ] **Phone numbers**: Include country code with + prefix
- [ ] **Timestamps**: ISO 8601 format with timezone
- [ ] **Character encoding**: UTF-8 (no special characters causing issues)
- [ ] **Line endings**: LF (Unix) or CRLF (Windows) - not mixed

### Recommended Data Cleaning Tools

**Command-line tools:**
```bash
# Check for duplicate mines
awk -F, 'NR>1 {print $2","$3}' mines.csv | sort | uniq -d

# Validate UUIDs
awk -F, 'NR>1 {print $1}' mines.csv | grep -Ev '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'

# Check coordinate ranges
awk -F, 'NR>1 {if ($6<-90 || $6>90 || $7<-180 || $7>180) print $2}' mines.csv

# Validate DPI scores
awk -F, 'NR>1 {if ($10!="" && ($10<0 || $10>10)) print $2,$10}' mines.csv
```

**SQL queries for existing database:**
```sql
-- Find duplicate mines
SELECT name, country, COUNT(*) 
FROM mines_staging 
GROUP BY name, country 
HAVING COUNT(*) > 1;

-- Check coordinate validity
SELECT name, latitude, longitude 
FROM mines_staging 
WHERE latitude < -90 OR latitude > 90 
   OR longitude < -180 OR longitude > 180;

-- Verify required fields
SELECT name FROM mines_staging WHERE commodity IS NULL OR commodity = '';
```

---

## Migration Process

### Step 1: Environment Setup

Set the database connection string:

```bash
# For testing (use staging/test database)
export DATABASE_URL='postgresql://user:pass@localhost:5432/ain_test'

# For production (requires explicit confirmation)
export DATABASE_URL='postgresql://user:pass@prod-db.postgres.database.azure.com:5432/ain_production'
```

**Important:** Always test on a staging database first!

### Step 2: Place Data Files

Place your CSV files in the correct location:

```bash
mkdir -p data/legacy
cp your-mines-data.csv data/legacy/mines.csv
cp your-regions-data.csv data/legacy/regions.csv
cp your-scouts-data.csv data/legacy/scouts.csv
```

Or set environment variables to point to your files:

```bash
export LEGACY_MINES_CSV='/path/to/your/mines.csv'
export LEGACY_REGIONS_CSV='/path/to/your/regions.csv'
export LEGACY_SCOUTS_CSV='/path/to/your/scouts.csv'
```

### Step 3: Run Test Migration

Use the test script to validate everything works:

```bash
./scripts/migration/test-migration.sh
```

This script will:
1. Check that DATABASE_URL is set
2. Verify sample data files exist
3. Create a pre-test database backup
4. Run the migration
5. Run integrity verification
6. Display summary statistics

### Step 4: Run Production Migration

Once testing is successful, run the production migration:

```bash
# Set production database URL
export DATABASE_URL='postgresql://...'

# Run migration
ts-node scripts/migration/migrate-historical-data.ts
```

**Production safety features:**
- Migration tracking prevents duplicate runs
- Progress is logged for monitoring
- Errors are logged to `migration-errors.json`
- Summary report shows success/failure counts

### Step 5: Verify Data Integrity

After migration, run comprehensive integrity checks:

```bash
ts-node scripts/migration/verify-data-integrity.ts
```

This checks:
- Record counts meet minimum thresholds
- Foreign key integrity (no orphaned records)
- Required fields are populated
- Coordinates are within valid bounds
- No duplicate records
- Data quality (DPI scores, depth values)
- Database indexes exist
- Constraints are properly defined

**Exit codes:**
- `0` - All checks passed
- `1` - One or more checks failed (see output for details)

### Step 6: Rollback (if needed)

If issues are detected, you can safely rollback:

```bash
ts-node scripts/migration/rollback-migration.ts
```

**Rollback process:**
1. Requires explicit confirmation
2. Creates backup before rollback (in `./backups/`)
3. Deletes all migrated data (respects foreign keys)
4. Resets database sequences
5. Verifies rollback completed successfully

**Production rollback warning:**
- Requires typing "ROLLBACK PRODUCTION" to confirm
- Creates JSON backups of all tables before deletion
- Cannot be undone after backups are deleted

---

## Monitoring & Troubleshooting

### Check Migration Status

Query the migration tracking table:

```sql
SELECT 
  migration_name,
  status,
  started_at,
  completed_at,
  records_total,
  records_succeeded,
  records_failed
FROM migration_tracking
WHERE migration_name = 'historical-data-migration';
```

### View Error Details

Check the error log file:

```bash
cat migration-errors.json | jq '.'
```

Example error log structure:
```json
[
  {
    "entityType": "mines",
    "errorCount": 2,
    "errors": [
      {
        "record": { "name": "Bad Mine", "latitude": 200 },
        "error": "Coordinate out of bounds"
      }
    ]
  }
]
```

### Common Issues

**Issue: "Migration already completed"**
- **Cause:** Migration tracking table shows status = 'completed'
- **Solution:** Use `--force` flag to re-run: `ts-node scripts/migration/migrate-historical-data.ts --force`
- **Warning:** This will overwrite existing data!

**Issue: "Duplicate key violation"**
- **Cause:** Record with same ID already exists
- **Solution:** Migration uses UPSERT logic, so this should auto-resolve. If it persists, check for concurrent migrations.

**Issue: "Foreign key constraint violation"**
- **Cause:** Child record references non-existent parent (e.g., mine_id doesn't exist)
- **Solution:** Ensure parent entities are migrated first. Migration order: mines → regions → concessions → archive_documents → scouts → scout_reports

**Issue: "Connection pool exhausted"**
- **Cause:** Too many simultaneous database connections
- **Solution:** Migration processes records sequentially to avoid this. Check no other processes are holding connections.

**Issue: "Out of memory"**
- **Cause:** CSV file too large to load into memory
- **Solution:** Split large CSV files into smaller batches (e.g., 10,000 records per file) and run multiple migrations.

### Performance Optimization

For large datasets:

1. **Increase connection pool size:**
   ```typescript
   const pool = new Pool({
     connectionString: process.env.DATABASE_URL,
     max: 20, // Default is 10
   });
   ```

2. **Batch inserts:** Modify migration script to insert in batches of 1000:
   ```typescript
   // Instead of individual inserts, collect records and batch insert
   const batch = [];
   for (const record of legacyData) {
     batch.push(record);
     if (batch.length >= 1000) {
       await insertBatch(batch);
       batch.length = 0;
     }
   }
   ```

3. **Disable indexes during migration:**
   ```sql
   -- Before migration
   DROP INDEX idx_mines_country;
   DROP INDEX idx_mines_commodity;
   
   -- After migration
   CREATE INDEX idx_mines_country ON mines(country);
   CREATE INDEX idx_mines_commodity ON mines(commodity);
   ```

4. **Increase statement timeout:**
   ```sql
   SET statement_timeout = '10min';
   ```

---

## Scheduled Data Ingestion

For ongoing data ingestion from external sources, use the scheduled ingestion script.

### Configuration

Edit `scripts/data-ingestion/scheduled-ingestion.ts` to configure data sources:

```typescript
const SOURCES = [
  {
    name: 'MSIM Archive',
    type: 'archive_documents',
    endpoint: process.env.MSIM_ARCHIVE_ENDPOINT || 'https://api.msim.org/archive',
    authToken: process.env.MSIM_API_KEY,
    enabled: true,
  },
  {
    name: 'GeoSwarm Scout Reports',
    type: 'scout_reports',
    endpoint: process.env.GEOSWARM_ENDPOINT || 'https://api.geoswarm.com/reports',
    authToken: process.env.GEOSWARM_API_KEY,
    enabled: true,
  },
];
```

### Environment Variables

Set API credentials:

```bash
export MSIM_ARCHIVE_ENDPOINT='https://api.msim.org/archive'
export MSIM_API_KEY='your-msim-api-key'
export GEOSWARM_ENDPOINT='https://api.geoswarm.com/reports'
export GEOSWARM_API_KEY='your-geoswarm-api-key'
```

### Manual Run

Test the scheduled ingestion:

```bash
ts-node scripts/data-ingestion/scheduled-ingestion.ts
```

### Automated Scheduling

See `DEPLOYMENT_AUTOMATION.md` for cron job and Azure Functions configuration.

---

## Best Practices

1. **Always test first** - Run migration on staging/test database before production
2. **Backup before migration** - Create database backup (or use `test-migration.sh` which auto-backs up)
3. **Verify after migration** - Run integrity checks to catch issues early
4. **Monitor progress** - Check logs during migration for warnings
5. **Plan for rollback** - Have rollback plan ready before starting production migration
6. **Document data sources** - Keep record of where CSV data came from
7. **Validate data quality** - Clean data before migration, not after
8. **Use transactions** - Migration scripts use transactions to ensure atomicity
9. **Log everything** - Migration produces detailed logs for audit trail
10. **Schedule maintenance window** - Run production migration during low-traffic period

---

## Audit & Compliance

### Migration Audit Trail

All migrations are logged in the `migration_tracking` table:

```sql
SELECT * FROM migration_tracking ORDER BY started_at DESC;
```

### Ingestion Audit Trail

Scheduled ingestions are logged in the `ingestion_logs` table:

```sql
SELECT 
  source_name,
  records_processed,
  records_failed,
  started_at,
  duration_ms
FROM ingestion_logs 
WHERE started_at > NOW() - INTERVAL '7 days'
ORDER BY started_at DESC;
```

### Data Lineage

Track where data came from:

```sql
-- Mines imported from CSV
SELECT COUNT(*) FROM mines WHERE created_at < '2024-01-01';

-- Scout reports from GeoSwarm
SELECT COUNT(*) FROM scout_reports WHERE source = 'geoswarm';

-- Archive documents from MSIM
SELECT COUNT(*) FROM archive_documents WHERE source = 'msim_archive';
```

---

## Support

For migration issues:

1. Check this guide for troubleshooting steps
2. Review `migration-errors.json` for specific error details
3. Check database logs for constraint violations
4. Contact platform team: engineering@ain-platform.com
