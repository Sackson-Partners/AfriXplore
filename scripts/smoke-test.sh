#!/usr/bin/env bash
# AIN MSIM Platform smoke test
# Usage: ./scripts/smoke-test.sh [BASE_URL]
set -euo pipefail

BASE_URL="${1:-http://localhost:3002}"
PASS=0
FAIL=0

check() {
  local name="$1"
  local expected_status="$2"
  local method="${3:-GET}"
  local path="${4:-/health/live}"
  local body="${5:-}"

  if [ -n "$body" ]; then
    actual=$(curl -s -o /dev/null -w "%{http_code}" \
      -X "$method" -H "Content-Type: application/json" \
      -d "$body" "${BASE_URL}${path}")
  else
    actual=$(curl -s -o /dev/null -w "%{http_code}" \
      -X "$method" "${BASE_URL}${path}")
  fi

  if [ "$actual" = "$expected_status" ]; then
    echo "  ✓ ${name} (${actual})"
    PASS=$((PASS+1))
  else
    echo "  ✗ ${name} — expected ${expected_status}, got ${actual}"
    FAIL=$((FAIL+1))
  fi
}

echo ""
echo "AIN MSIM API Smoke Test — ${BASE_URL}"
echo "─────────────────────────────────────────"

echo ""
echo "Health endpoints:"
check "Liveness probe"   "200" "GET" "/health/live"
check "Readiness probe"  "200" "GET" "/health/ready"
check "Metrics endpoint" "200" "GET" "/health/metrics"

echo ""
echo "Auth guard (expect 401 without token):"
check "GET /mines → 401"       "401" "GET"  "/mines"
check "GET /mines/:id → 401"   "401" "GET"  "/mines/550e8400-e29b-41d4-a716-446655440000"
check "GET /export/mines → 401" "401" "GET" "/export/mines?format=geojson"
check "GET /search → 401"      "401" "GET"  "/search?q=gold"

echo ""
echo "Input validation (auth-gated routes return 401 before validation runs):"
check "POST /mines no token → 401"       "401" "POST" "/mines" "{}"
check "GET /mines bad UUID no token → 401" "401" "GET"  "/mines/not-a-uuid"
check "GET /export bad format no token → 401" "401" "GET"  "/export/mines?format=xml"

echo ""
echo "404 handling:"
check "Unknown route → 404"    "404" "GET" "/nonexistent"

echo ""
echo "─────────────────────────────────────────"
echo "Results: ${PASS} passed, ${FAIL} failed"
echo ""

[ "$FAIL" -eq 0 ] || exit 1
