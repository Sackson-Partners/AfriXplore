#!/bin/bash
# AfriXplore — Deploy all Container Apps from ACR + run health checks

set -euo pipefail

ENVIRONMENT=${1:-staging}
RG="rg-afrixplore-${ENVIRONMENT}-southafricanorth"
ACR_URL="craafrixxplore${ENVIRONMENT}.azurecr.io"
COMMIT=$(git rev-parse HEAD)
SHORT_SHA=${COMMIT:0:12}

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
BOLD='\033[1m'

log_step() { echo -e "\n${BOLD}${BLUE}▶ $1${NC}"; }
log_ok()   { echo -e "${GREEN}  ✅ $1${NC}"; }
log_warn() { echo -e "${YELLOW}  ⚠️  $1${NC}"; }
log_err()  { echo -e "${RED}  ❌ $1${NC}"; }
log_info() { echo "  ℹ️  $1"; }

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   AfriXplore — Azure Container Apps Deploy              ║"
printf "║   Environment: %-42s ║\n" "$ENVIRONMENT"
printf "║   SHA: %-50s ║\n" "$SHORT_SHA"
echo "╚══════════════════════════════════════════════════════════╝"

# ─── SERVICE → APP NAME MAP ───────────────────────────────────────────────────
declare -A APP_MAP=(
  ["scout-api"]="ca-afrixplore-scout-api-${ENVIRONMENT}"
  ["intelligence-api"]="ca-afrixplore-intelligence-api-${ENVIRONMENT}"
  ["msim-api"]="ca-afrixplore-msim-api-${ENVIRONMENT}"
  ["notification-service"]="ca-afrixplore-notification-${ENVIRONMENT}"
  ["payment-service"]="ca-afrixplore-payment-${ENVIRONMENT}"
  ["geospatial-worker"]="ca-afrixplore-geo-worker-${ENVIRONMENT}"
)

# ─── DEPLOY EACH SERVICE ─────────────────────────────────────────────────────
log_step "Deploying ${#APP_MAP[@]} Container Apps"

DEPLOY_ERRORS=0

for SERVICE in "${!APP_MAP[@]}"; do
  APP="${APP_MAP[$SERVICE]}"
  IMAGE="$ACR_URL/$SERVICE:$SHORT_SHA"

  log_info "Deploying $APP -> $IMAGE"

  if az containerapp update \
    --name "$APP" \
    --resource-group "$RG" \
    --image "$IMAGE" \
    --output none 2>&1; then
    log_ok "$APP updated"
  else
    log_err "Failed to update $APP"
    ((DEPLOY_ERRORS++)) || true
  fi
done

if [ "$DEPLOY_ERRORS" -gt 0 ]; then
  echo ""
  echo "  ❌ $DEPLOY_ERRORS deploy(s) failed — check above"
  exit 1
fi

# ─── WAIT FOR ROLLOUT ────────────────────────────────────────────────────────
log_step "Waiting for rollout (45s)..."

for i in $(seq 1 45); do
  printf "\r  %ds elapsed..." "$i"
  sleep 1
done
echo ""
log_ok "Rollout window complete"

# ─── HEALTH CHECKS ───────────────────────────────────────────────────────────
log_step "Running health checks"

ALL_HEALTHY=true

for SERVICE in scout-api intelligence-api msim-api; do
  APP="ca-afrixplore-${SERVICE}-${ENVIRONMENT}"

  FQDN=$(az containerapp show \
    --name "$APP" \
    --resource-group "$RG" \
    --query "properties.configuration.ingress.fqdn" \
    -o tsv 2>/dev/null || echo "")

  if [ -z "$FQDN" ] || [ "$FQDN" = "null" ]; then
    log_warn "$SERVICE: No FQDN"
    continue
  fi

  SUCCESS=false
  for attempt in 1 2 3; do
    HTTP=$(curl -sf \
      -o /tmp/health_response.json \
      -w "%{http_code}" \
      --max-time 10 \
      "https://${FQDN}/health" 2>/dev/null || echo "000")

    if [ "$HTTP" = "200" ]; then
      log_ok "$SERVICE: healthy — https://$FQDN"
      SUCCESS=true
      break
    else
      log_warn "$SERVICE: HTTP $HTTP (attempt $attempt/3)"
      sleep 10
    fi
  done

  if ! $SUCCESS; then
    log_err "$SERVICE: health check FAILED after 3 attempts"
    echo "  Recent logs:"
    az containerapp logs show \
      --name "$APP" \
      --resource-group "$RG" \
      --tail 20 2>/dev/null | grep -v "^$" | head -20 | sed 's/^/    /' || true
    ALL_HEALTHY=false
  fi
done

# ─── VERIFY IMAGE REVISIONS ──────────────────────────────────────────────────
log_step "Verifying deployed images"

for SERVICE in "${!APP_MAP[@]}"; do
  APP="${APP_MAP[$SERVICE]}"

  ACTIVE_IMAGE=$(az containerapp show \
    --name "$APP" \
    --resource-group "$RG" \
    --query "properties.template.containers[0].image" \
    -o tsv 2>/dev/null || echo "unknown")

  if echo "$ACTIVE_IMAGE" | grep -q "$SHORT_SHA"; then
    log_ok "$SERVICE -> $ACTIVE_IMAGE"
  else
    log_warn "$SERVICE -> $ACTIVE_IMAGE (expected $SHORT_SHA)"
  fi
done

# ─── SUMMARY ─────────────────────────────────────────────────────────────────
SUBSCRIPTION=$(az account show --query id -o tsv 2>/dev/null || echo "unknown")

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   Azure Deploy Summary                                   ║"
if $ALL_HEALTHY; then
  echo -e "║   ${GREEN}✅ All services healthy${NC}                              ║"
else
  echo -e "║   ${YELLOW}⚠️  Some services need attention (see above)${NC}         ║"
fi
echo "╠══════════════════════════════════════════════════════════╣"
echo "║   Azure Portal -> Container Apps:"
printf "║   https://portal.azure.com/#resource/subscriptions/%s ║\n" "${SUBSCRIPTION:0:8}..."
echo "╚══════════════════════════════════════════════════════════╝"

$ALL_HEALTHY || exit 1
