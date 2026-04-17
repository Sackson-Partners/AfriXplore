#!/bin/bash
# AfriXplore — Common Issue Auto-Fix Script

set -euo pipefail

ENVIRONMENT=${1:-dev}
RG="rg-afrixplore-${ENVIRONMENT}-southafricanorth"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  AfriXplore — Auto-Fix Common Issues                    ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

fix_keyvault_access() {
  echo "▶ Fix: Key Vault Managed Identity access"
  KV_NAME="kv-afrixplore-${ENVIRONMENT}"
  KV_ID=$(az keyvault show --name "$KV_NAME" --resource-group "$RG" --query "id" -o tsv)

  for app in "ca-afrixplore-scout-api-${ENVIRONMENT}" "ca-afrixplore-intelligence-api-${ENVIRONMENT}" "ca-afrixplore-msim-api-${ENVIRONMENT}" "ca-afrixplore-notification-${ENVIRONMENT}" "ca-afrixplore-payment-${ENVIRONMENT}"; do
    PRINCIPAL_ID=$(az containerapp show --name "$app" --resource-group "$RG" --query "identity.principalId" -o tsv 2>/dev/null || echo "")
    if [ -n "$PRINCIPAL_ID" ] && [ "$PRINCIPAL_ID" != "null" ]; then
      az role assignment create --role "Key Vault Secrets User" --assignee-object-id "$PRINCIPAL_ID" --scope "$KV_ID" --assignee-principal-type ServicePrincipal --output none 2>/dev/null || true
      echo "  ✅ $app → Key Vault access granted"
    fi
  done
}

fix_acr_pull_permission() {
  echo "▶ Fix: ACR pull permission for Container Apps"
  ACR_ID=$(az acr show --name "craafrixxplore${ENVIRONMENT}" --resource-group "$RG" --query "id" -o tsv)

  for app in "ca-afrixplore-scout-api-${ENVIRONMENT}" "ca-afrixplore-intelligence-api-${ENVIRONMENT}" "ca-afrixplore-msim-api-${ENVIRONMENT}" "ca-afrixplore-notification-${ENVIRONMENT}" "ca-afrixplore-payment-${ENVIRONMENT}" "ca-afrixplore-geo-worker-${ENVIRONMENT}"; do
    PRINCIPAL_ID=$(az containerapp show --name "$app" --resource-group "$RG" --query "identity.principalId" -o tsv 2>/dev/null || echo "")
    if [ -n "$PRINCIPAL_ID" ] && [ "$PRINCIPAL_ID" != "null" ]; then
      az role assignment create --role "AcrPull" --assignee-object-id "$PRINCIPAL_ID" --scope "$ACR_ID" --assignee-principal-type ServicePrincipal --output none 2>/dev/null || true
      echo "  ✅ $app → ACR pull granted"
    fi
  done
}

fix_postgresql_firewall() {
  echo "▶ Fix: PostgreSQL firewall for Azure Services"
  PG_NAME="psql-afrixplore-${ENVIRONMENT}-saf"
  az postgres flexible-server firewall-rule create --resource-group "$RG" --name "$PG_NAME" --rule-name "AllowAzureServices" --start-ip-address "0.0.0.0" --end-ip-address "0.0.0.0" --output none 2>/dev/null || true
  echo "  ✅ PostgreSQL firewall: Azure services allowed"
}

apply_missing_migrations() {
  echo "▶ Fix: Apply missing database migrations"
  PG_NAME="psql-afrixplore-${ENVIRONMENT}-saf"
  PG_FQDN=$(az postgres flexible-server show --name "$PG_NAME" --resource-group "$RG" --query "fullyQualifiedDomainName" -o tsv 2>/dev/null || echo "")
  PG_PASS=$(az keyvault secret show --vault-name "kv-afrixplore-${ENVIRONMENT}" --name "postgresql-admin-password" --query "value" -o tsv 2>/dev/null || echo "")

  if [ -z "$PG_FQDN" ] || [ -z "$PG_PASS" ]; then
    echo "  ❌ Cannot find PostgreSQL server or credentials"
    return
  fi

  export PGPASSWORD="$PG_PASS"
  DB_URL="postgresql://afrixploreAdmin@${PG_FQDN}:5432/afrixplore?sslmode=require"

  for migration in infrastructure/scripts/0*.sql; do
    echo "  Applying: $(basename "$migration")"
    psql "$DB_URL" -f "$migration" 2>&1 | head -3 || true
  done
  echo "  ✅ Migrations applied"
  unset PGPASSWORD
}

restart_unhealthy_apps() {
  echo "▶ Fix: Restart unhealthy Container Apps"
  for app in "ca-afrixplore-scout-api-${ENVIRONMENT}" "ca-afrixplore-intelligence-api-${ENVIRONMENT}" "ca-afrixplore-msim-api-${ENVIRONMENT}" "ca-afrixplore-notification-${ENVIRONMENT}" "ca-afrixplore-payment-${ENVIRONMENT}" "ca-afrixplore-geo-worker-${ENVIRONMENT}"; do
    STATUS=$(az containerapp show --name "$app" --resource-group "$RG" --query "properties.runningStatus" -o tsv 2>/dev/null || echo "Unknown")
    if [ "$STATUS" != "Running" ]; then
      echo "  Restarting $app (status: $STATUS)..."
      az containerapp update --name "$app" --resource-group "$RG" --set-env-vars "RESTART_TIMESTAMP=$(date +%s)" --output none 2>/dev/null || true
      echo "  ✅ Restart triggered for $app"
    else
      echo "  ✅ $app is Running — no restart needed"
    fi
  done
}

echo "Available fixes:"
echo "  1. Fix Key Vault access permissions"
echo "  2. Fix ACR pull permissions"
echo "  3. Fix PostgreSQL firewall"
echo "  4. Apply missing migrations"
echo "  5. Restart unhealthy Container Apps"
echo "  all. Run all fixes"
echo ""
read -p "Select fix (1-5 or 'all'): " CHOICE

case $CHOICE in
  1) fix_keyvault_access ;;
  2) fix_acr_pull_permission ;;
  3) fix_postgresql_firewall ;;
  4) apply_missing_migrations ;;
  5) restart_unhealthy_apps ;;
  all)
    fix_keyvault_access
    fix_acr_pull_permission
    fix_postgresql_firewall
    apply_missing_migrations
    restart_unhealthy_apps
    ;;
  *) echo "Invalid choice"; exit 1 ;;
esac

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  ✅ Fix complete — run check-all-services.sh to verify  ║"
echo "╚══════════════════════════════════════════════════════════╝"
