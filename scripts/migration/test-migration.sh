#!/bin/bash

##
# Migration Testing Script
# Tests the historical data migration with sample CSV files
##

set -e

echo "=================================="
echo "Migration Testing Script"
echo "=================================="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable not set"
  echo "   Set it with: export DATABASE_URL='postgresql://user:pass@host:5432/dbname'"
  exit 1
fi

# Parse database name from DATABASE_URL
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
echo "Target database: $DB_NAME"
echo ""

# Safety check: Prevent running on production
if [[ "$DATABASE_URL" == *"production"* ]] || [[ "$DATABASE_URL" == *"prod"* ]]; then
  echo "⚠️  WARNING: This appears to be a PRODUCTION database!"
  echo "   Migration testing should only run on test/staging databases."
  read -p "Type 'TEST ON PRODUCTION' to continue: " confirm
  if [ "$confirm" != "TEST ON PRODUCTION" ]; then
    echo "Aborted."
    exit 1
  fi
fi

# Check if sample data exists
echo "Checking for sample data files..."
if [ ! -f "data/legacy/mines.csv" ]; then
  echo "❌ ERROR: data/legacy/mines.csv not found"
  exit 1
fi
echo "✅ Found data/legacy/mines.csv"

if [ ! -f "data/legacy/regions.csv" ]; then
  echo "⚠️  WARNING: data/legacy/regions.csv not found (optional)"
fi

if [ ! -f "data/legacy/scouts.csv" ]; then
  echo "⚠️  WARNING: data/legacy/scouts.csv not found (optional)"
fi
echo ""

# Backup current database state
echo "Creating pre-test backup..."
BACKUP_FILE="backups/pre-test-$(date +%Y%m%d-%H%M%S).sql"
mkdir -p backups
pg_dump $DATABASE_URL > $BACKUP_FILE
echo "✅ Backup saved to: $BACKUP_FILE"
echo ""

# Run migration
echo "Running migration script..."
ts-node scripts/migration/migrate-historical-data.ts
MIGRATION_EXIT_CODE=$?

if [ $MIGRATION_EXIT_CODE -ne 0 ]; then
  echo ""
  echo "❌ Migration failed with exit code: $MIGRATION_EXIT_CODE"
  echo "   Database state preserved. Check logs for details."
  exit $MIGRATION_EXIT_CODE
fi

echo ""
echo "✅ Migration completed successfully"
echo ""

# Run data integrity verification
echo "Running data integrity verification..."
ts-node scripts/migration/verify-data-integrity.ts
VERIFICATION_EXIT_CODE=$?

if [ $VERIFICATION_EXIT_CODE -ne 0 ]; then
  echo ""
  echo "❌ Data integrity verification failed"
  echo "   Consider rolling back the migration."
  echo ""
  read -p "Do you want to rollback? (yes/no): " rollback
  if [ "$rollback" = "yes" ]; then
    ts-node scripts/migration/rollback-migration.ts
  fi
  exit $VERIFICATION_EXIT_CODE
fi

echo ""
echo "✅ Data integrity verification passed"
echo ""

# Display summary statistics
echo "=================================="
echo "Migration Test Summary"
echo "=================================="
psql $DATABASE_URL -c "
  SELECT 'mines' as table_name, COUNT(*) as record_count FROM mines
  UNION ALL
  SELECT 'regions', COUNT(*) FROM regions
  UNION ALL
  SELECT 'concessions', COUNT(*) FROM concessions
  UNION ALL
  SELECT 'scouts', COUNT(*) FROM scouts
  UNION ALL
  SELECT 'scout_reports', COUNT(*) FROM scout_reports
  ORDER BY table_name;
"

echo ""
echo "=================================="
echo "✅ Migration test completed successfully!"
echo "=================================="
echo ""
echo "Next steps:"
echo "  - Review the migrated data in the database"
echo "  - Check migration-errors.json for any warnings"
echo "  - To rollback: ts-node scripts/migration/rollback-migration.ts"
echo "  - Backup location: $BACKUP_FILE"
echo ""
