#!/usr/bin/env bash
# AfriXplore — Database Migration Runner
# Usage: DATABASE_URL=postgres://... ./run-migrations.sh [migrations_dir]
# Applies all *.sql files in lexicographic order, skipping already-applied ones.
set -euo pipefail

MIGRATIONS_DIR="${1:-$(dirname "$0")}"
DATABASE_URL="${DATABASE_URL:?DATABASE_URL must be set}"

# Create the migrations tracking table if it doesn't exist
psql "$DATABASE_URL" --no-psqlrc -q <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     TEXT PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
SQL

echo "Migration tracker ready."

APPLIED=0
SKIPPED=0
FAILED=0

for migration_file in $(find "$MIGRATIONS_DIR" -maxdepth 1 -name "*.sql" | sort); do
  version=$(basename "$migration_file" .sql)

  # Check if already applied
  already=$(psql "$DATABASE_URL" --no-psqlrc -tAq \
    -c "SELECT 1 FROM schema_migrations WHERE version = '$version'")

  if [ "$already" = "1" ]; then
    echo "  SKIP  $version (already applied)"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  echo "  APPLY $version ..."
  if psql "$DATABASE_URL" --no-psqlrc -q -f "$migration_file"; then
    psql "$DATABASE_URL" --no-psqlrc -q \
      -c "INSERT INTO schema_migrations (version) VALUES ('$version') ON CONFLICT DO NOTHING"
    echo "        ✓ $version applied"
    APPLIED=$((APPLIED + 1))
  else
    echo "        ✗ $version FAILED" >&2
    FAILED=$((FAILED + 1))
    exit 1
  fi
done

echo ""
echo "Migration complete: $APPLIED applied, $SKIPPED skipped, $FAILED failed."
[ "$FAILED" -eq 0 ] || exit 1
