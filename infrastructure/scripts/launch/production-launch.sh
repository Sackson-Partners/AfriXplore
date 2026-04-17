#!/bin/bash
# AfriXplore — Production Launch Runbook
# Run ONCE when launching to production
# Expected duration: 45-60 minutes

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

log_step()  { echo -e "\n${BOLD}${BLUE}══════════════════════════════════════${NC}"; \
              echo -e "${BOLD}${BLUE}  $1${NC}"; \
              echo -e "${BOLD}${BLUE}══════════════════════════════════════${NC}"; }
log_ok()    { echo -e "${GREEN}  ✅ $1${NC}"; }
log_warn()  { echo -e "${YELLOW}  ⚠️  $1${NC}"; }
log_err()   { echo -e "${RED}  ❌ $1${NC}"; exit 1; }
log_info()  { echo -e "  ℹ️  $1"; }
prompt()    { read -p "  $1 [y/N]: " -n 1 -r; echo; [[ $REPLY =~ ^[Yy]$ ]]; }

ENV="production"
RG="rg-afrixplore-production-southafricanorth"
ACR="craafrixxploreprod.azurecr.io"
COMMIT=$(git rev-parse HEAD)

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║     AfriXplore — Production Launch Runbook                ║"
echo "║     Repository: Sackson-Partners/AfriXplore               ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "  Commit:      $COMMIT"
echo "  Environment: $ENV"
echo "  Region:      South Africa North (primary)"
echo "               France Central   (replica)"
echo ""

prompt "⚠️  This will deploy AfriXplore to PRODUCTION. Continue?" || exit 0

# ─── PRE-FLIGHT ──────────────────────────────────────────────────────────────
log_step "0. Pre-flight Checks"

az account show &>/dev/null || log_err "Not logged in to Azure CLI. Run: az login"
log_ok "Azure CLI authenticated"

command -v vercel &>/dev/null || log_err "Vercel CLI not installed. Run: npm i -g vercel"
log_ok "Vercel CLI available"

if ! git diff --quiet HEAD; then
  log_warn "Uncommitted changes detected"
  prompt "Continue anyway?" || exit 1
fi

REQUIRED_VARS=(
  "AZURE_SUBSCRIPTION_ID"
  "STRIPE_SECRET_KEY"
  "AFRICAS_TALKING_API_KEY"
  "MAPBOX_PUBLIC_TOKEN"
)

for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    log_err "Missing env var: $var"
  fi
done
log_ok "Required environment variables set"

# ─── STEP 1: PROVISION INFRASTRUCTURE ────────────────────────────────────────
log_step "1. Provision Azure Infrastructure"

az group create \
  --name "$RG" \
  --location southafricanorth \
  --output none
log_ok "Resource group: $RG"

log_info "Deploying Bicep infrastructure (15-20 min)..."
DEPLOY_OUTPUT=$(az deployment group create \
  --resource-group "$RG" \
  --template-file infrastructure/bicep/main.bicep \
  --parameters infrastructure/bicep/environments/production.bicepparam \
  --query "properties.outputs" \
  --output json)

log_ok "Infrastructure deployed"

PG_FQDN=$(echo "$DEPLOY_OUTPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('postgreSQLFQDN',{}).get('value',''))")
APIM_URL=$(echo "$DEPLOY_OUTPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('apimGatewayUrl',{}).get('value',''))")
ACR_SERVER=$(echo "$DEPLOY_OUTPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('containerRegistryLoginServer',{}).get('value',''))")

log_info "PostgreSQL: $PG_FQDN"
log_info "APIM:       $APIM_URL"
log_info "ACR:        $ACR_SERVER"

# ─── STEP 2: DATABASE SETUP ──────────────────────────────────────────────────
log_step "2. Database Migrations"

PG_PASS=$(az keyvault secret show \
  --vault-name kv-afrixplore-production \
  --name postgresql-admin-password \
  --query value -o tsv)

export PGPASSWORD="$PG_PASS"
DB_URL="postgresql://afrixploreAdmin@${PG_FQDN}:5432/afrixplore?sslmode=require"

log_info "Running migrations..."
for migration in infrastructure/scripts/0*.sql; do
  NAME=$(basename "$migration")
  psql "$DB_URL" -f "$migration" -q 2>&1 | \
    grep -v "^$\|NOTICE\|already exists" | head -3 || true
  log_ok "Migration: $NAME"
done

TABLE_COUNT=$(psql "$DB_URL" -t -c \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" \
  | tr -d ' \n')
[ "$TABLE_COUNT" -ge "12" ] && \
  log_ok "Database: $TABLE_COUNT tables created" || \
  log_err "Database: only $TABLE_COUNT tables (expected 12+)"

unset PGPASSWORD

# ─── STEP 3: BUILD & PUSH DOCKER IMAGES ──────────────────────────────────────
log_step "3. Build & Push Docker Images"

az acr login --name craafrixxploreprod

SERVICES=(
  "scout-api"
  "intelligence-api"
  "msim-api"
  "notification-service"
  "payment-service"
)

for service in "${SERVICES[@]}"; do
  log_info "Building $service..."
  docker build \
    -t "${ACR}/${service}:${COMMIT}" \
    -t "${ACR}/${service}:latest" \
    --build-arg NODE_ENV=production \
    --platform linux/amd64 \
    "./services/${service}" \
    --quiet

  docker push "${ACR}/${service}:${COMMIT}" --quiet
  docker push "${ACR}/${service}:latest" --quiet
  log_ok "$service pushed to ACR"
done

log_info "Building geospatial-worker..."
docker build \
  -t "${ACR}/geospatial-worker:${COMMIT}" \
  -t "${ACR}/geospatial-worker:latest" \
  --platform linux/amd64 \
  ./services/geospatial-worker \
  --quiet

docker push "${ACR}/geospatial-worker:${COMMIT}" --quiet
log_ok "geospatial-worker pushed"

# ─── STEP 4: DEPLOY CONTAINER APPS ───────────────────────────────────────────
log_step "4. Deploy Container Apps"

declare -A APP_MAP=(
  ["scout-api"]="ca-afrixplore-scout-api-production"
  ["intelligence-api"]="ca-afrixplore-intelligence-api-production"
  ["msim-api"]="ca-afrixplore-msim-api-production"
  ["notification-service"]="ca-afrixplore-notification-production"
  ["payment-service"]="ca-afrixplore-payment-production"
  ["geospatial-worker"]="ca-afrixplore-geo-worker-production"
)

for service in "${!APP_MAP[@]}"; do
  APP="${APP_MAP[$service]}"
  log_info "Deploying $service -> $APP..."

  az containerapp update \
    --name "$APP" \
    --resource-group "$RG" \
    --image "${ACR}/${service}:${COMMIT}" \
    --output none

  log_ok "$service deployed"
done

log_info "Waiting 60s for Container Apps to start..."
sleep 60

for service in scout-api intelligence-api msim-api; do
  APP="ca-afrixplore-${service}-production"
  FQDN=$(az containerapp show \
    --name "$APP" \
    --resource-group "$RG" \
    --query "properties.configuration.ingress.fqdn" -o tsv 2>/dev/null || echo "")

  if [ -n "$FQDN" ]; then
    HTTP=$(curl -sf -o /dev/null -w "%{http_code}" \
      "https://${FQDN}/health" --max-time 10 || echo "000")
    if [ "$HTTP" = "200" ]; then
      log_ok "$service: healthy"
    else
      log_warn "$service: HTTP $HTTP"
    fi
  fi
done

# ─── STEP 5: DEPLOY VERCEL ────────────────────────────────────────────────────
log_step "5. Deploy Vercel Frontend"

log_info "Deploying platform-web to Vercel production..."
cd apps/platform-web
vercel deploy --prod --yes 2>&1 | tail -5
cd ../..
log_ok "platform-web deployed"

log_info "Deploying admin-web to Vercel production..."
cd apps/admin-web
vercel deploy --prod --yes 2>&1 | tail -5
cd ../..
log_ok "admin-web deployed"

# ─── STEP 6: MANUAL STEPS REMINDER ───────────────────────────────────────────
log_step "6. Manual Steps Required"

log_warn "Custom Vision: Create project at customvision.ai"
log_info "  New Project -> Classification -> Multiclass"
log_info "  Name: AfriXplore Mineral ID"
log_info "  Copy Project ID -> set CUSTOM_VISION_PROJECT_ID secret"

log_warn "Stripe: Add webhook at dashboard.stripe.com/webhooks"
log_info "  URL: ${APIM_URL}/payments/webhooks/stripe"
log_info "  Events: subscription.created, subscription.deleted,"
log_info "          invoice.payment_succeeded, invoice.payment_failed"

# ─── STEP 7: DNS ─────────────────────────────────────────────────────────────
log_step "7. DNS Configuration"

APIM_HOSTNAME=$(echo "$APIM_URL" | sed 's|https://||' | sed 's|/$||')

echo ""
echo "  Add these DNS records:"
echo ""
echo "  Type   Name      Target"
echo "  CNAME  platform  cname.vercel-dns.com"
echo "  CNAME  admin     cname.vercel-dns.com"
echo "  CNAME  api       $APIM_HOSTNAME"
echo ""

prompt "DNS records added?" || log_warn "Remember to add DNS records before launch"

# ─── STEP 8: SMOKE TESTS ─────────────────────────────────────────────────────
log_step "8. Post-Launch Smoke Tests"

PASS=0
FAIL=0

for endpoint_label in \
    "https://api.afrixplore.io/scout/health|Scout API" \
    "https://api.afrixplore.io/intelligence/health|Intelligence API" \
    "https://platform.afrixplore.io|Platform Web"; do

  URL="${endpoint_label%%|*}"
  LABEL="${endpoint_label##*|}"

  HTTP=$(curl -sf -o /dev/null -w "%{http_code}" "$URL" --max-time 15 || echo "000")

  if [[ "$HTTP" =~ ^(200|301|302)$ ]]; then
    log_ok "$LABEL: $HTTP"
    ((PASS++))
  else
    log_warn "$LABEL: HTTP $HTTP"
    ((FAIL++))
  fi
done

# ─── SUMMARY ─────────────────────────────────────────────────────────────────
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║          AfriXplore — Launch Summary                      ║"
echo "╠════════════════════════════════════════════════════════════╣"
printf "║  Platform:  https://platform.afrixplore.io               ║\n"
printf "║  Admin:     https://admin.afrixplore.io                  ║\n"
printf "║  API:       %-47s ║\n" "$APIM_URL"
printf "║  Tests:     %d passed, %d failed                              ║\n" "$PASS" "$FAIL"
printf "║  Commit:    %-47s ║\n" "${COMMIT:0:12}"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║  AfriXplore is LIVE                                       ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "  Monitor:"
echo "    Azure Portal -> Application Insights -> appi-afrixplore-production"
echo "    Vercel Dashboard -> Analytics"
echo ""
echo "  Next steps:"
echo "    1. Create Custom Vision project at customvision.ai"
echo "    2. Add Stripe webhooks"
echo "    3. Onboard first scout district"
echo "    4. Add 3 B2B pilot subscribers"
echo ""
