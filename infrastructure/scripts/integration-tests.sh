#!/bin/bash
# AfriXplore — End-to-end integration tests across all platforms

set -euo pipefail

ENVIRONMENT=${1:-staging}
RG="rg-afrixplore-${ENVIRONMENT}-southafricanorth"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
BOLD='\033[1m'

PASS=0
FAIL=0
WARN=0

log_ok()   { echo -e "    ${GREEN}✅ PASS: $1${NC}"; ((PASS++)); }
log_fail() { echo -e "    ${RED}❌ FAIL: $1${NC}"; ((FAIL++)) || true; }
log_warn() { echo -e "    ${YELLOW}⚠️  WARN: $1${NC}"; ((WARN++)) || true; }
log_info() { echo "       $1"; }

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   AfriXplore — Integration Test Suite                   ║"
printf "║   Environment: %-42s ║\n" "$ENVIRONMENT"
echo "╚══════════════════════════════════════════════════════════╝"

# ─── FETCH ENDPOINTS ─────────────────────────────────────────────────────────
APIM_URL=$(az apim show \
  --name "apim-afrixplore-${ENVIRONMENT}" \
  --resource-group "$RG" \
  --query "gatewayUrl" -o tsv 2>/dev/null || echo "")

PG_FQDN=$(az postgres flexible-server show \
  --name "psql-afrixplore-${ENVIRONMENT}-saf" \
  --resource-group "$RG" \
  --query "fullyQualifiedDomainName" -o tsv 2>/dev/null || echo "")

# ─── GROUP 1: CONTAINER APPS ─────────────────────────────────────────────────
echo ""
echo "  ─── Group 1: Container Apps Health ───────────────────"
echo ""

for APP_INFO in \
  "scout-api|ca-afrixplore-scout-api-${ENVIRONMENT}" \
  "intelligence-api|ca-afrixplore-intelligence-api-${ENVIRONMENT}" \
  "msim-api|ca-afrixplore-msim-api-${ENVIRONMENT}" \
  "notification|ca-afrixplore-notification-${ENVIRONMENT}" \
  "payment|ca-afrixplore-payment-${ENVIRONMENT}"; do

  NAME="${APP_INFO%%|*}"
  APP="${APP_INFO##*|}"

  RUNNING=$(az containerapp show \
    --name "$APP" --resource-group "$RG" \
    --query "properties.runningStatus" -o tsv 2>/dev/null || echo "Unknown")

  if [ "$RUNNING" = "Running" ]; then
    FQDN=$(az containerapp show \
      --name "$APP" --resource-group "$RG" \
      --query "properties.configuration.ingress.fqdn" -o tsv 2>/dev/null || echo "")

    if [ -n "$FQDN" ] && [ "$FQDN" != "null" ]; then
      HTTP=$(curl -sf -o /dev/null -w "%{http_code}" \
        "https://${FQDN}/health" --max-time 10 2>/dev/null || echo "000")
      [ "$HTTP" = "200" ] && \
        log_ok "$NAME: running (HTTP 200)" || \
        log_fail "$NAME: health returned HTTP $HTTP"
    else
      log_ok "$NAME: running (worker — no ingress)"
    fi
  else
    log_fail "$NAME: not running (status: $RUNNING)"
    log_info "Recent logs:"
    az containerapp logs show \
      --name "$APP" --resource-group "$RG" \
      --tail 10 2>/dev/null | head -5 | sed 's/^/       /' || true
  fi
done

# ─── GROUP 2: POSTGRESQL ─────────────────────────────────────────────────────
echo ""
echo "  ─── Group 2: PostgreSQL ──────────────────────────────"
echo ""

PG_STATE=$(az postgres flexible-server show \
  --name "psql-afrixplore-${ENVIRONMENT}-saf" \
  --resource-group "$RG" \
  --query "state" -o tsv 2>/dev/null || echo "unknown")

[ "$PG_STATE" = "Ready" ] && \
  log_ok "PostgreSQL: Ready" || \
  log_fail "PostgreSQL: $PG_STATE"

if [ -n "$PG_FQDN" ]; then
  PG_PASS=$(az keyvault secret show \
    --vault-name "kv-afrixplore-${ENVIRONMENT}" \
    --name "postgresql-admin-password" \
    --query value -o tsv 2>/dev/null || echo "")

  if [ -n "$PG_PASS" ]; then
    DB_URL="postgresql://afrixploreAdmin@${PG_FQDN}:5432/afrixplore?sslmode=require"

    POSTGIS=$(PGPASSWORD="$PG_PASS" psql "$DB_URL" -t \
      -c "SELECT PostGIS_version();" 2>/dev/null | tr -d ' \n' || echo "")
    [ -n "$POSTGIS" ] && log_ok "PostGIS: $POSTGIS" || log_fail "PostGIS not installed"

    TABLE_COUNT=$(PGPASSWORD="$PG_PASS" psql "$DB_URL" -t \
      -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" \
      2>/dev/null | tr -d ' \n' || echo "0")
    [ "$TABLE_COUNT" -ge "12" ] && \
      log_ok "Tables: $TABLE_COUNT (all migrations applied)" || \
      log_fail "Tables: $TABLE_COUNT (expected 12+)"

    RLS_COUNT=$(PGPASSWORD="$PG_PASS" psql "$DB_URL" -t \
      -c "SELECT count(*) FROM pg_policies;" \
      2>/dev/null | tr -d ' \n' || echo "0")
    [ "$RLS_COUNT" -ge "5" ] && \
      log_ok "RLS policies: $RLS_COUNT active" || \
      log_warn "RLS policies: $RLS_COUNT (expected 5+)"
  else
    log_warn "Cannot retrieve DB password from Key Vault"
  fi
fi

# ─── GROUP 3: SERVICE BUS ─────────────────────────────────────────────────────
echo ""
echo "  ─── Group 3: Azure Service Bus ──────────────────────"
echo ""

SB_NAME="sb-afrixplore-${ENVIRONMENT}"
SB_STATUS=$(az servicebus namespace show \
  --name "$SB_NAME" --resource-group "$RG" \
  --query "status" -o tsv 2>/dev/null || echo "Unknown")

[ "$SB_STATUS" = "Active" ] && \
  log_ok "Service Bus: Active" || log_fail "Service Bus: $SB_STATUS"

TOPICS=$(az servicebus topic list \
  --namespace-name "$SB_NAME" --resource-group "$RG" \
  --query "[].name" -o tsv 2>/dev/null || echo "")

for TOPIC in reports-ingested anomaly-detected payment-triggered \
             field-dispatched ml-training-ready subscription-changed; do
  echo "$TOPICS" | grep -q "^${TOPIC}$" && \
    log_ok "Topic: $TOPIC" || log_fail "Topic missing: $TOPIC"
done

# ─── GROUP 4: KEY VAULT ───────────────────────────────────────────────────────
echo ""
echo "  ─── Group 4: Key Vault Secrets ──────────────────────"
echo ""

KV="kv-afrixplore-${ENVIRONMENT}"
for SECRET in \
  "postgresql-connection-string" \
  "postgresql-admin-password" \
  "service-bus-connection-string" \
  "entra-scout-tenant-id" \
  "entra-scout-client-id" \
  "entra-platform-tenant-id" \
  "entra-platform-client-id"; do

  EXISTS=$(az keyvault secret show \
    --vault-name "$KV" --name "$SECRET" \
    --query "id" -o tsv 2>/dev/null || echo "")
  [ -n "$EXISTS" ] && log_ok "Secret: $SECRET" || log_fail "Missing: $SECRET"
done

# ─── GROUP 5: APIM ────────────────────────────────────────────────────────────
echo ""
echo "  ─── Group 5: API Management ──────────────────────────"
echo ""

if [ -n "$APIM_URL" ]; then
  SCOUT_HTTP=$(curl -sf -o /dev/null -w "%{http_code}" \
    "${APIM_URL}/scout/health" --max-time 10 2>/dev/null || echo "000")
  [[ "$SCOUT_HTTP" =~ ^(200|401)$ ]] && \
    log_ok "Scout API via APIM: HTTP $SCOUT_HTTP" || \
    log_fail "Scout API via APIM: HTTP $SCOUT_HTTP"

  INTEL_HTTP=$(curl -sf -o /dev/null -w "%{http_code}" \
    "${APIM_URL}/intelligence/api/v1/clusters" --max-time 10 2>/dev/null || echo "000")
  [[ "$INTEL_HTTP" =~ ^(200|401|403)$ ]] && \
    log_ok "Intelligence API via APIM: HTTP $INTEL_HTTP" || \
    log_fail "Intelligence API via APIM: HTTP $INTEL_HTTP"
else
  log_warn "APIM URL not available — skipping APIM tests"
fi

# ─── GROUP 6: ACR IMAGES ─────────────────────────────────────────────────────
echo ""
echo "  ─── Group 6: ACR Images ──────────────────────────────"
echo ""

ACR_NAME="craafrixxplore${ENVIRONMENT}"

for SVC in scout-api intelligence-api msim-api \
           notification-service payment-service geospatial-worker; do
  LATEST_TAG=$(az acr repository show-tags \
    --name "$ACR_NAME" --repository "$SVC" \
    --orderby time_desc --top 1 --output tsv 2>/dev/null || echo "")
  [ -n "$LATEST_TAG" ] && \
    log_ok "$SVC: latest = $LATEST_TAG" || \
    log_fail "$SVC: no image in ACR"
done

# ─── SUMMARY ─────────────────────────────────────────────────────────────────
TOTAL=$((PASS + FAIL + WARN))

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   Integration Test Results                              ║"
echo "╠══════════════════════════════════════════════════════════╣"
printf "║   ✅ Passed:  %-3d                                       ║\n" "$PASS"
printf "║   ❌ Failed:  %-3d                                       ║\n" "$FAIL"
printf "║   ⚠️  Warned:  %-3d                                       ║\n" "$WARN"
printf "║   Total:     %-3d                                       ║\n" "$TOTAL"
echo "╠══════════════════════════════════════════════════════════╣"
if [ "$FAIL" -eq 0 ]; then
  echo -e "║   ${GREEN}✅ ALL TESTS PASSED — Platform ready${NC}                 ║"
else
  echo -e "║   ${RED}❌ $FAIL FAILED — Run: ./infrastructure/scripts/debug/fix-common-issues.sh${NC}"
fi
echo "╚══════════════════════════════════════════════════════════╝"

[ "$FAIL" -eq 0 ] || exit 1
