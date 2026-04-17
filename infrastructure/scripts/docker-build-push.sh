#!/bin/bash
# AfriXplore — Build all service images and push to Azure Container Registry

set -euo pipefail

ENVIRONMENT=${1:-staging}
ACR_NAME="craafrixxplore${ENVIRONMENT}"
ACR_URL="${ACR_NAME}.azurecr.io"
RG="rg-afrixplore-${ENVIRONMENT}-southafricanorth"
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
log_err()  { echo -e "${RED}  ❌ $1${NC}"; exit 1; }
log_info() { echo "  ℹ️  $1"; }

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   AfriXplore — Docker Build + ACR Push                  ║"
printf "║   Environment: %-42s ║\n" "$ENVIRONMENT"
printf "║   SHA: %-50s ║\n" "$SHORT_SHA"
echo "╚══════════════════════════════════════════════════════════╝"

# ─── LOGIN TO ACR ────────────────────────────────────────────────────────────
log_step "ACR Login"

az acr login --name "$ACR_NAME" 2>&1 | tail -2
log_ok "Logged in to $ACR_URL"

# ─── SERVICE DEFINITIONS ─────────────────────────────────────────────────────
declare -A SERVICES=(
  ["scout-api"]="services/scout-api"
  ["intelligence-api"]="services/intelligence-api"
  ["msim-api"]="services/msim-api"
  ["notification-service"]="services/notification-service"
  ["payment-service"]="services/payment-service"
  ["geospatial-worker"]="services/geospatial-worker"
)

TOTAL=${#SERVICES[@]}
CURRENT=0
FAILED_SERVICES=()

for SERVICE in "${!SERVICES[@]}"; do
  CONTEXT="${SERVICES[$SERVICE]}"
  ((CURRENT++))

  log_step "[$CURRENT/$TOTAL] Building: $SERVICE"
  log_info "Context: $CONTEXT"

  BUILD_START=$(date +%s)

  if docker build \
    --platform linux/amd64 \
    --build-arg NODE_ENV="$ENVIRONMENT" \
    --build-arg BUILD_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --build-arg GIT_SHA="$COMMIT" \
    -t "$ACR_URL/$SERVICE:$SHORT_SHA" \
    -t "$ACR_URL/$SERVICE:$ENVIRONMENT" \
    -t "$ACR_URL/$SERVICE:latest" \
    --label "org.opencontainers.image.revision=$COMMIT" \
    --label "org.opencontainers.image.created=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --label "org.opencontainers.image.source=https://github.com/Sackson-Partners/AfriXplore" \
    "$CONTEXT" 2>&1; then

    BUILD_TIME=$(($(date +%s) - BUILD_START))
    log_ok "Built in ${BUILD_TIME}s"

    docker push "$ACR_URL/$SERVICE:$SHORT_SHA"   2>&1 | tail -2
    docker push "$ACR_URL/$SERVICE:$ENVIRONMENT" 2>&1 | tail -2
    docker push "$ACR_URL/$SERVICE:latest"       2>&1 | tail -2

    log_ok "Pushed: $ACR_URL/$SERVICE:$SHORT_SHA"
  else
    log_warn "Build FAILED for $SERVICE"
    FAILED_SERVICES+=("$SERVICE")
  fi
done

# ─── SUMMARY ─────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   Docker Build Summary                                   ║"
echo "╠══════════════════════════════════════════════════════════╣"

if [ ${#FAILED_SERVICES[@]} -eq 0 ]; then
  echo -e "║   ${GREEN}✅ All $TOTAL images built and pushed successfully${NC}       ║"
  echo "╠══════════════════════════════════════════════════════════╣"
  printf "║   Registry:  %-43s ║\n" "$ACR_URL"
  printf "║   SHA tag:   %-43s ║\n" "$SHORT_SHA"
  printf "║   Env tag:   %-43s ║\n" "$ENVIRONMENT"
  echo "╚══════════════════════════════════════════════════════════╝"
else
  echo -e "║   ${RED}❌ ${#FAILED_SERVICES[@]} image(s) failed: ${FAILED_SERVICES[*]}${NC}"
  echo "╚══════════════════════════════════════════════════════════╝"
  exit 1
fi

echo ""
echo "▶ Images in $ACR_URL:"
echo ""
for SERVICE in "${!SERVICES[@]}"; do
  TAGS=$(az acr repository show-tags \
    --name "$ACR_NAME" \
    --repository "$SERVICE" \
    --orderby time_desc \
    --top 3 \
    --output tsv 2>/dev/null | tr '\n' ', ' | sed 's/,$//' || echo "none")
  printf "  📦 %-30s [%s]\n" "$SERVICE:" "$TAGS"
done
