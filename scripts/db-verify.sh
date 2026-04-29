#!/usr/bin/env bash
# Verifies the AIN database schema was applied correctly
# Usage: ./scripts/db-verify.sh
set -euo pipefail

: "${AZURE_POSTGRESQL_CONNECTION_STRING:?Need AZURE_POSTGRESQL_CONNECTION_STRING}"

run_query() {
  psql "$AZURE_POSTGRESQL_CONNECTION_STRING" -t -c "$1" 2>/dev/null | tr -d ' \n'
}

echo ""
echo "AIN DB Schema Verification"
echo "─────────────────────────────────────────"

PASS=0
FAIL=0

check_table() {
  local table="$1"
  count=$(run_query "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='${table}' AND table_schema='public'")
  if [ "$count" = "1" ]; then
    echo "  ✓ Table exists: ${table}"
    PASS=$((PASS+1))
  else
    echo "  ✗ Table missing: ${table}"
    FAIL=$((FAIL+1))
  fi
}

check_extension() {
  local ext="$1"
  count=$(run_query "SELECT COUNT(*) FROM pg_extension WHERE extname='${ext}'")
  if [ "$count" = "1" ]; then
    echo "  ✓ Extension: ${ext}"
    PASS=$((PASS+1))
  else
    echo "  ✗ Extension missing: ${ext}"
    FAIL=$((FAIL+1))
  fi
}

echo ""
echo "Extensions:"
check_extension "postgis"
check_extension "uuid-ossp"
check_extension "pg_trgm"

echo ""
echo "Tables:"
check_table "subscribers"
check_table "mineral_systems"
check_table "historical_mines"
check_table "msim_targets"
check_table "msim_documents"
check_table "schema_migrations"

echo ""
echo "Seed data:"
sys_count=$(run_query "SELECT COUNT(*) FROM mineral_systems" 2>/dev/null || echo "0")
mine_count=$(run_query "SELECT COUNT(*) FROM historical_mines" 2>/dev/null || echo "0")
target_count=$(run_query "SELECT COUNT(*) FROM msim_targets" 2>/dev/null || echo "0")
echo "  Mineral systems: ${sys_count}"
echo "  Historical mines: ${mine_count}"
echo "  MSIM targets: ${target_count}"

echo ""
echo "─────────────────────────────────────────"
echo "Schema checks: ${PASS} passed, ${FAIL} failed"
[ "$FAIL" -eq 0 ] || exit 1
