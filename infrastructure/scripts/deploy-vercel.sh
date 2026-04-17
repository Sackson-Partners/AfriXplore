#!/bin/bash
# AfriXplore — Deploy platform-web + admin-web to Vercel

set -euo pipefail

ENVIRONMENT=${1:-staging}

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
BOLD='\033[1m'

log_step() { echo -e "\n${BOLD}${BLUE}▶ $1${NC}"; }
log_ok()   { echo -e "${GREEN}  ✅ $1${NC}"; }
log_warn() { echo -e "${YELLOW}  ⚠️  $1${NC}"; }
log_err()  { echo -e "${RED}  ❌ $1${NC}"; exit 1; }
log_info() { echo "  ℹ️  $1"; }

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   AfriXplore — Vercel Deploy                            ║"
printf "║   Environment: %-42s ║\n" "$ENVIRONMENT"
echo "╚══════════════════════════════════════════════════════════╝"

# ─── FETCH AZURE ENDPOINTS ───────────────────────────────────────────────────
log_step "Fetching Azure endpoint URLs"

RG="rg-afrixplore-${ENVIRONMENT}-southafricanorth"

APIM_URL=$(az apim show \
  --name "apim-afrixplore-${ENVIRONMENT}" \
  --resource-group "$RG" \
  --query "gatewayUrl" \
  -o tsv 2>/dev/null || echo "${NEXT_PUBLIC_API_URL:-}")

SIGNALR_HOST=$(az signalr show \
  --name "sigr-afrixplore-${ENVIRONMENT}" \
  --resource-group "$RG" \
  --query "properties.hostName" \
  -o tsv 2>/dev/null || echo "")

[ -n "$APIM_URL" ] && log_ok "APIM: $APIM_URL" || log_warn "APIM URL not found"
[ -n "$SIGNALR_HOST" ] && log_ok "SignalR: $SIGNALR_HOST"

VERCEL_ENV="preview"
[ "$ENVIRONMENT" = "production" ] && VERCEL_ENV="production"

# ─── DEPLOY PLATFORM-WEB ─────────────────────────────────────────────────────
log_step "Deploying platform-web"

cd apps/platform-web

DEPLOY_START=$(date +%s)

if [ "$ENVIRONMENT" = "production" ]; then
  PLATFORM_URL=$(vercel deploy --prod --yes 2>&1 | tail -1)
else
  PLATFORM_URL=$(vercel deploy --yes 2>&1 | tail -1)
fi

DEPLOY_TIME=$(($(date +%s) - DEPLOY_START))
log_ok "platform-web deployed in ${DEPLOY_TIME}s: $PLATFORM_URL"

cd ../..

# ─── DEPLOY ADMIN-WEB ────────────────────────────────────────────────────────
log_step "Deploying admin-web"

cd apps/admin-web

if [ "$ENVIRONMENT" = "production" ]; then
  ADMIN_URL=$(vercel deploy --prod --yes 2>&1 | tail -1)
else
  ADMIN_URL=$(vercel deploy --yes 2>&1 | tail -1)
fi

log_ok "admin-web deployed: $ADMIN_URL"
cd ../..

# ─── SMOKE TESTS ─────────────────────────────────────────────────────────────
log_step "Running smoke tests"

SMOKE_PASS=0
SMOKE_FAIL=0

for TEST_URL in "$PLATFORM_URL" "$ADMIN_URL"; do
  HTTP=$(curl -sf -o /dev/null -w "%{http_code}" -L --max-time 20 \
    "$TEST_URL" 2>/dev/null || echo "000")

  LATENCY=$(curl -sf -o /dev/null -w "%{time_total}" -L --max-time 20 \
    "$TEST_URL" 2>/dev/null || echo "0")
  LATENCY_MS=$(echo "$LATENCY * 1000" | bc 2>/dev/null | cut -d'.' -f1 || echo "0")

  if [[ "$HTTP" =~ ^(200|301|302|307|308)$ ]]; then
    log_ok "HTTP $HTTP (${LATENCY_MS}ms) — $TEST_URL"
    ((SMOKE_PASS++))
  else
    log_warn "HTTP $HTTP — $TEST_URL"
    ((SMOKE_FAIL++))
  fi
done

# ─── SUMMARY ─────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   Vercel Deploy Summary                                  ║"
echo "╠══════════════════════════════════════════════════════════╣"
printf "║   platform-web: %-40s ║\n" "$PLATFORM_URL"
printf "║   admin-web:    %-40s ║\n" "$ADMIN_URL"
echo "╠══════════════════════════════════════════════════════════╣"
printf "║   Smoke tests:  %d passed, %d failed                         ║\n" "$SMOKE_PASS" "$SMOKE_FAIL"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║   https://vercel.com/sackson-partners                   ║"
echo "╚══════════════════════════════════════════════════════════╝"

[ "$SMOKE_FAIL" -eq 0 ] || exit 1
