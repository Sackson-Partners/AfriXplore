#!/bin/bash
# AfriXplore — Full Service Health Check & Debug Script
# Usage: ./check-all-services.sh [dev|staging|production]

set -euo pipefail

ENVIRONMENT=${1:-dev}
RG="rg-afrixplore-${ENVIRONMENT}-southafricanorth"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_ok()   { echo -e "${GREEN}  ✅ $1${NC}"; }
log_err()  { echo -e "${RED}  ❌ $1${NC}"; }
log_warn() { echo -e "${YELLOW}  ⚠️  $1${NC}"; }
log_info() { echo -e "${BLUE}  ℹ️  $1${NC}"; }

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  AfriXplore — Service Health Check                      ║"
echo "║  Environment: ${ENVIRONMENT}                             ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

ALL_HEALTHY=true

# ─── 1. RESOURCE GROUP ──────────────────────────────────────────────────────
echo "▶ 1. Resource Group"
RG_STATE=$(az group show --name "$RG" --query "properties.provisioningState" -o tsv 2>/dev/null || echo "NOT_FOUND")
if [ "$RG_STATE" = "Succeeded" ]; then
  log_ok "Resource group exists: $RG"
else
  log_err "Resource group not found: $RG"
  exit 1
fi

# ─── 2. POSTGRESQL ──────────────────────────────────────────────────────────
echo ""
echo "▶ 2. PostgreSQL"
PG_NAME="psql-afrixplore-${ENVIRONMENT}-saf"
PG_STATE=$(az postgres flexible-server show --name "$PG_NAME" --resource-group "$RG" --query "state" -o tsv 2>/dev/null || echo "NOT_FOUND")

if [ "$PG_STATE" = "Ready" ]; then
  log_ok "PostgreSQL: Ready ($PG_NAME)"

  PG_FQDN=$(az postgres flexible-server show --name "$PG_NAME" --resource-group "$RG" --query "fullyQualifiedDomainName" -o tsv 2>/dev/null || echo "")
  PG_PASS=$(az keyvault secret show --vault-name "kv-afrixplore-${ENVIRONMENT}" --name "postgresql-admin-password" --query "value" -o tsv 2>/dev/null || echo "")

  if [ -n "$PG_PASS" ] && [ -n "$PG_FQDN" ]; then
    POSTGIS=$(PGPASSWORD="$PG_PASS" psql "postgresql://afrixploreAdmin@${PG_FQDN}:5432/afrixplore?sslmode=require" -t -c "SELECT PostGIS_version();" 2>/dev/null | tr -d ' \n' || echo "")
    if [ -n "$POSTGIS" ]; then
      log_ok "PostGIS: installed"
    else
      log_warn "PostGIS not installed — run: 001_extensions.sql"
    fi

    TABLE_COUNT=$(PGPASSWORD="$PG_PASS" psql "postgresql://afrixploreAdmin@${PG_FQDN}:5432/afrixplore?sslmode=require" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null | tr -d ' \n' || echo "0")
    if [ "$TABLE_COUNT" -ge "12" ]; then
      log_ok "Database tables: $TABLE_COUNT"
    else
      log_warn "Database tables: $TABLE_COUNT (expected 12+)"
    fi
  fi
else
  log_err "PostgreSQL: $PG_STATE"
  ALL_HEALTHY=false
fi

# ─── 3. CONTAINER REGISTRY ──────────────────────────────────────────────────
echo ""
echo "▶ 3. Container Registry"
ACR_NAME="craafrixxplore${ENVIRONMENT}"
ACR_STATE=$(az acr show --name "$ACR_NAME" --resource-group "$RG" --query "provisioningState" -o tsv 2>/dev/null || echo "NOT_FOUND")

if [ "$ACR_STATE" = "Succeeded" ]; then
  log_ok "ACR: $ACR_NAME.azurecr.io"
  IMAGES=$(az acr repository list --name "$ACR_NAME" --output tsv 2>/dev/null || echo "")
  for service in scout-api intelligence-api msim-api notification-service payment-service geospatial-worker ai-inference; do
    if echo "$IMAGES" | grep -q "^${service}$"; then
      log_ok "Image: $service"
    else
      log_warn "Missing image: $service"
    fi
  done
else
  log_err "ACR: NOT FOUND ($ACR_NAME)"
  ALL_HEALTHY=false
fi

# ─── 4. CONTAINER APPS ──────────────────────────────────────────────────────
echo ""
echo "▶ 4. Container Apps"
SERVICES=(
  "ca-afrixplore-scout-api-${ENVIRONMENT}"
  "ca-afrixplore-intelligence-api-${ENVIRONMENT}"
  "ca-afrixplore-msim-api-${ENVIRONMENT}"
  "ca-afrixplore-notification-${ENVIRONMENT}"
  "ca-afrixplore-payment-${ENVIRONMENT}"
  "ca-afrixplore-geo-worker-${ENVIRONMENT}"
)

for app in "${SERVICES[@]}"; do
  RUNNING=$(az containerapp show --name "$app" --resource-group "$RG" --query "properties.runningStatus" -o tsv 2>/dev/null || echo "NOT_FOUND")
  if [ "$RUNNING" = "Running" ]; then
    FQDN=$(az containerapp show --name "$app" --resource-group "$RG" --query "properties.configuration.ingress.fqdn" -o tsv 2>/dev/null || echo "")
    if [ -n "$FQDN" ] && [ "$FQDN" != "null" ]; then
      HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "https://${FQDN}/health" 2>/dev/null || echo "000")
      if [ "$HTTP_STATUS" = "200" ]; then
        log_ok "$app (health: 200)"
      else
        log_warn "$app (running but health returned $HTTP_STATUS)"
      fi
    else
      log_ok "$app (worker)"
    fi
  else
    log_err "$app: $RUNNING"
    ALL_HEALTHY=false
  fi
done

# ─── 5. SERVICE BUS ─────────────────────────────────────────────────────────
echo ""
echo "▶ 5. Service Bus"
SB_NAME="sb-afrixplore-${ENVIRONMENT}"
SB_STATE=$(az servicebus namespace show --name "$SB_NAME" --resource-group "$RG" --query "status" -o tsv 2>/dev/null || echo "NOT_FOUND")

if [ "$SB_STATE" = "Active" ]; then
  log_ok "Service Bus: Active ($SB_NAME)"
  for topic in reports-ingested anomaly-detected payment-triggered field-dispatched ml-training-ready subscription-changed; do
    EXISTS=$(az servicebus topic show --name "$topic" --namespace-name "$SB_NAME" --resource-group "$RG" --query "name" -o tsv 2>/dev/null || echo "")
    if [ -n "$EXISTS" ]; then
      log_ok "Topic: $topic"
    else
      log_err "Missing topic: $topic"
    fi
  done
else
  log_err "Service Bus: $SB_STATE"
  ALL_HEALTHY=false
fi

# ─── 6. KEY VAULT ───────────────────────────────────────────────────────────
echo ""
echo "▶ 6. Key Vault Secrets"
KV_NAME="kv-afrixplore-${ENVIRONMENT}"
KV_STATE=$(az keyvault show --name "$KV_NAME" --resource-group "$RG" --query "properties.provisioningState" -o tsv 2>/dev/null || echo "NOT_FOUND")

if [ "$KV_STATE" = "Succeeded" ]; then
  log_ok "Key Vault: $KV_NAME"
  for secret in postgresql-connection-string postgresql-admin-password service-bus-connection-string entra-scout-tenant-id entra-platform-tenant-id entra-scout-client-id entra-platform-client-id custom-vision-training-key custom-vision-prediction-key speech-service-key openai-key; do
    EXISTS=$(az keyvault secret show --vault-name "$KV_NAME" --name "$secret" --query "id" -o tsv 2>/dev/null || echo "")
    if [ -n "$EXISTS" ]; then
      log_ok "Secret: $secret"
    else
      log_err "Missing secret: $secret"
    fi
  done
else
  log_err "Key Vault: NOT FOUND ($KV_NAME)"
  ALL_HEALTHY=false
fi

# ─── 7. APIM ────────────────────────────────────────────────────────────────
echo ""
echo "▶ 7. API Management"
APIM_NAME="apim-afrixplore-${ENVIRONMENT}"
APIM_STATE=$(az apim show --name "$APIM_NAME" --resource-group "$RG" --query "provisioningState" -o tsv 2>/dev/null || echo "NOT_FOUND")

if [ "$APIM_STATE" = "Succeeded" ]; then
  GATEWAY_URL=$(az apim show --name "$APIM_NAME" --resource-group "$RG" --query "gatewayUrl" -o tsv)
  log_ok "APIM: $GATEWAY_URL"
else
  log_err "APIM: $APIM_STATE"
  ALL_HEALTHY=false
fi

# ─── 8. SIGNALR ─────────────────────────────────────────────────────────────
echo ""
echo "▶ 8. SignalR Service"
SIGR_NAME="sigr-afrixplore-${ENVIRONMENT}"
SIGR_STATE=$(az signalr show --name "$SIGR_NAME" --resource-group "$RG" --query "provisioningState" -o tsv 2>/dev/null || echo "NOT_FOUND")

if [ "$SIGR_STATE" = "Succeeded" ]; then
  log_ok "SignalR: Running ($SIGR_NAME)"
else
  log_err "SignalR: $SIGR_STATE"
  ALL_HEALTHY=false
fi

# ─── SUMMARY ────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
if $ALL_HEALTHY; then
  echo -e "║  ${GREEN}✅ ALL SERVICES HEALTHY${NC}                              ║"
else
  echo -e "║  ${YELLOW}⚠️  SOME SERVICES NEED ATTENTION${NC}                     ║"
fi
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
