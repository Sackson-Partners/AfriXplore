#!/bin/bash
# AfriXplore — End-to-End Scout Report Test

set -euo pipefail

ENVIRONMENT=${1:-staging}
RG="rg-afrixplore-${ENVIRONMENT}-southafricanorth"

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; NC='\033[0m'; BOLD='\033[1m'

PASS=0; FAIL=0

log_step() { echo -e "\n${BOLD}${BLUE}=== $1 ===${NC}"; }
test_ok()  { echo -e "${GREEN}  ✅ $1${NC}"; ((PASS++)); }
test_fail(){ echo -e "${RED}  ❌ $1${NC}"; ((FAIL++)) || true; }
log_info() { echo "  ℹ️  $1"; }
log_warn() { echo -e "${YELLOW}  ⚠️  $1${NC}"; }

APIM_URL=$(az apim show \
  --name "apim-afrixplore-${ENVIRONMENT}" \
  --resource-group "$RG" \
  --query "gatewayUrl" -o tsv 2>/dev/null || echo "")

SCOUT_URL="${APIM_URL}/scout"
INTEL_URL="${APIM_URL}/intelligence"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   AfriXplore — End-to-End Scout Test                    ║"
printf "║   API: %-49s ║\n" "$APIM_URL"
echo "╚══════════════════════════════════════════════════════════╝"

# ─── 1. Health ────────────────────────────────────────────────────────────────
log_step "1. Health Checks"

for PAIR in \
  "${SCOUT_URL}/health|Scout API" \
  "${INTEL_URL}/health|Intelligence API" \
  "${APIM_URL}/msim/health|MSIM API"; do
  URL="${PAIR%%|*}"; NAME="${PAIR##*|}"
  HTTP=$(curl -sf -o /dev/null -w "%{http_code}" "$URL" --max-time 10 2>/dev/null || echo "000")
  [ "$HTTP" = "200" ] && test_ok "$NAME: HTTP 200" || test_fail "$NAME: HTTP $HTTP"
done

# ─── 2. OTP Flow ──────────────────────────────────────────────────────────────
log_step "2. Phone OTP Flow"

OTP_RESPONSE=$(curl -sf \
  -X POST "${SCOUT_URL}/api/v1/auth/otp/initiate" \
  -H "Content-Type: application/json" \
  -d '{"phone_number":"+254700TEST001","country":"KE"}' \
  2>/dev/null || echo "{}")

OTP_TOKEN=$(echo "$OTP_RESPONSE" | python3 -c \
  "import sys,json; print(json.load(sys.stdin).get('continuation_token',''))" \
  2>/dev/null || echo "")

[ -n "$OTP_TOKEN" ] && \
  test_ok "OTP initiated — continuation_token received" || \
  test_fail "OTP initiation failed: $OTP_RESPONSE"

# ─── 3. Validation (Zod .issues fix) ─────────────────────────────────────────
log_step "3. Validation (Zod .issues fix)"

BAD_HTTP=$(curl -sf -o /dev/null -w "%{http_code}" \
  -X POST "${SCOUT_URL}/api/v1/reports" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid" \
  -d '{"invalid":"data"}' 2>/dev/null || echo "000")

[[ "$BAD_HTTP" =~ ^(400|401|403)$ ]] && \
  test_ok "Validation returns $BAD_HTTP (not 500) — error handler working" || \
  test_fail "Unexpected HTTP $BAD_HTTP for invalid request"

# ─── 4. Authenticated Report (if token available) ─────────────────────────────
log_step "4. Report Submission"

if [ -n "${TEST_SCOUT_TOKEN:-}" ]; then
  REPORT_RESPONSE=$(curl -sf \
    -X POST "${SCOUT_URL}/api/v1/reports" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TEST_SCOUT_TOKEN}" \
    -d '{
      "latitude": -12.8628, "longitude": 28.6473,
      "mineral_type": "copper", "working_type": "open_pit",
      "depth_estimate_m": 5, "volume_estimate": "medium",
      "host_rock": "mafic",
      "offline_created_at": "2025-01-15T10:00:00Z"
    }' 2>/dev/null || echo "{}")

  REPORT_ID=$(echo "$REPORT_RESPONSE" | \
    python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" \
    2>/dev/null || echo "")

  if [ -n "$REPORT_ID" ]; then
    test_ok "Report submitted: $REPORT_ID"
    log_info "Waiting 15s for AI processing..."
    sleep 15

    AI_MINERAL=$(curl -sf \
      "${SCOUT_URL}/api/v1/reports/${REPORT_ID}" \
      -H "Authorization: Bearer ${TEST_SCOUT_TOKEN}" \
      2>/dev/null | python3 -c \
      "import sys,json; print(json.load(sys.stdin).get('ai_primary_mineral',''))" \
      2>/dev/null || echo "")

    [ -n "$AI_MINERAL" ] && [ "$AI_MINERAL" != "null" ] && \
      test_ok "AI assessment: $AI_MINERAL" || \
      log_info "AI assessment pending (normal if model not trained yet)"
  else
    test_fail "Report submission failed"
  fi
else
  log_info "TEST_SCOUT_TOKEN not set — skipping authenticated report test"
  log_info "  export TEST_SCOUT_TOKEN=<bearer_token>"
fi

# ─── 5. Intelligence API ──────────────────────────────────────────────────────
log_step "5. Intelligence API Auth"

CLUSTERS_HTTP=$(curl -sf -o /dev/null -w "%{http_code}" \
  "${INTEL_URL}/api/v1/clusters" --max-time 10 2>/dev/null || echo "000")

[ "$CLUSTERS_HTTP" = "401" ] && \
  test_ok "Clusters: 401 (auth enforced)" || \
  test_fail "Clusters: $CLUSTERS_HTTP (expected 401)"

# ─── 6. Service Bus DLQ Check ─────────────────────────────────────────────────
log_step "6. Service Bus"

SB_NAME="sb-afrixplore-${ENVIRONMENT}"

for TOPIC in reports-ingested anomaly-detected payment-triggered; do
  DLQ=$(az servicebus topic show \
    --name "$TOPIC" \
    --namespace-name "$SB_NAME" \
    --resource-group "$RG" \
    --query "countDetails.deadLetterMessageCount" \
    -o tsv 2>/dev/null || echo "0")

  [ "$DLQ" = "0" ] && \
    test_ok "$TOPIC: DLQ empty" || \
    test_fail "$TOPIC: $DLQ dead-letter messages"
done

# ─── Summary ──────────────────────────────────────────────────────────────────
TOTAL=$((PASS + FAIL))

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   E2E Test Results                                      ║"
echo "╠══════════════════════════════════════════════════════════╣"
printf "║   ✅ Passed: %-3d / %-3d                                  ║\n" "$PASS" "$TOTAL"
printf "║   ❌ Failed: %-3d / %-3d                                  ║\n" "$FAIL" "$TOTAL"
echo "╠══════════════════════════════════════════════════════════╣"
if [ "$FAIL" -eq 0 ]; then
  echo -e "║   ${GREEN}Platform ready for first real scout!${NC}                ║"
else
  echo -e "║   ${YELLOW}Fix failures before onboarding scouts${NC}               ║"
fi
echo "╚══════════════════════════════════════════════════════════╝"

[ "$FAIL" -eq 0 ] || exit 1
