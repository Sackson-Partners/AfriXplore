#!/usr/bin/env bash
# AIN MSIM Platform — Azure provisioning script
# Provisions resource group + all Azure resources via Bicep.
# Run this once before the first deploy.
#
# Prerequisites:
#   az login
#   az account set --subscription <your-subscription-id>
#
# Usage:
#   ./scripts/provision.sh [dev|staging|prod]

set -euo pipefail

ENV="${1:-dev}"
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
RESOURCE_GROUP="rg-ain-${ENV}"
LOCATION="southafricanorth"

echo ""
echo "AIN MSIM Platform — Azure Provisioning"
echo "Environment : ${ENV}"
echo "Subscription: ${SUBSCRIPTION_ID}"
echo "Resource Grp: ${RESOURCE_GROUP}"
echo "Location    : ${LOCATION}"
echo ""

# ── 1. Resource Group ─────────────────────────────────────────────────────────
echo "→ Creating resource group..."
az group create --name "${RESOURCE_GROUP}" --location "${LOCATION}" --output none
echo "  ✓ ${RESOURCE_GROUP}"

# ── 2. Bootstrap Key Vault (for the Bicep parameter reference) ────────────────
BOOTSTRAP_RG="rg-ain-bootstrap"
BOOTSTRAP_KV="kv-ain-bootstrap"

if ! az keyvault show --name "${BOOTSTRAP_KV}" --resource-group "${BOOTSTRAP_RG}" &>/dev/null; then
  echo "→ Creating bootstrap Key Vault for deployment secrets..."
  az group create --name "${BOOTSTRAP_RG}" --location "${LOCATION}" --output none
  az keyvault create \
    --name "${BOOTSTRAP_KV}" \
    --resource-group "${BOOTSTRAP_RG}" \
    --location "${LOCATION}" \
    --enable-rbac-authorization true \
    --output none

  # Grant current user Secrets Officer
  USER_OID=$(az ad signed-in-user show --query id -o tsv)
  az role assignment create \
    --role "Key Vault Secrets Officer" \
    --assignee "${USER_OID}" \
    --scope "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${BOOTSTRAP_RG}/providers/Microsoft.KeyVault/vaults/${BOOTSTRAP_KV}" \
    --output none
  echo "  ✓ ${BOOTSTRAP_KV}"

  echo ""
  echo "  ⚠  Set the postgres admin password in Key Vault:"
  echo "     az keyvault secret set \\"
  echo "       --vault-name ${BOOTSTRAP_KV} \\"
  echo "       --name postgres-admin-password \\"
  echo "       --value '<strong-password>'"
  echo ""
  read -rp "  Press Enter after setting the secret..."
fi

# ── 3. Update subscription ID in parameters file ──────────────────────────────
PARAMS_FILE="infra/parameters.${ENV}.json"
sed -i.bak "s/SUBSCRIPTION_ID/${SUBSCRIPTION_ID}/g" "${PARAMS_FILE}" && rm "${PARAMS_FILE}.bak"

# ── 4. Deploy Bicep template ──────────────────────────────────────────────────
echo "→ Deploying Bicep template (this takes ~5 minutes)..."
OUTPUTS=$(az deployment group create \
  --resource-group "${RESOURCE_GROUP}" \
  --template-file infra/main.bicep \
  --parameters "@${PARAMS_FILE}" \
  --query properties.outputs \
  --output json)

ACR_SERVER=$(echo "${OUTPUTS}" | jq -r '.acrLoginServer.value')
API_FQDN=$(echo "${OUTPUTS}" | jq -r '.containerAppFqdn.value')
KV_URI=$(echo "${OUTPUTS}" | jq -r '.keyVaultUri.value')
PG_HOST=$(echo "${OUTPUTS}" | jq -r '.postgresHost.value')
SEARCH_EP=$(echo "${OUTPUTS}" | jq -r '.searchEndpoint.value')

echo "  ✓ Deployment complete"
echo ""
echo "  ACR              : ${ACR_SERVER}"
echo "  API FQDN         : ${API_FQDN}"
echo "  Key Vault URI    : ${KV_URI}"
echo "  PostgreSQL host  : ${PG_HOST}"
echo "  AI Search        : ${SEARCH_EP}"

# ── 5. GitHub secrets ─────────────────────────────────────────────────────────
echo ""
echo "→ Setting GitHub Actions secrets..."
REPO=$(git remote get-url origin | sed 's/.*github.com[:/]//' | sed 's/\.git$//')

gh secret set AZURE_CLIENT_ID        --repo "${REPO}" --body "$(az ad sp list --display-name "ain-github-${ENV}" --query '[0].appId' -o tsv 2>/dev/null || echo 'TODO')"
gh secret set AZURE_TENANT_ID        --repo "${REPO}" --body "$(az account show --query tenantId -o tsv)"
gh secret set AZURE_SUBSCRIPTION_ID  --repo "${REPO}" --body "${SUBSCRIPTION_ID}"
gh secret set AZURE_POSTGRESQL_CONNECTION_STRING --repo "${REPO}" \
  --body "postgresql://ainuser@${PG_HOST}/ain?sslmode=require"

echo "  ✓ GitHub secrets set (AZURE_CLIENT_ID may need updating if SP was not found)"

# ── 6. Build + push seed image ────────────────────────────────────────────────
echo ""
echo "→ Building and pushing initial Docker image..."
az acr login --name "cracain${ENV}"
IMAGE="${ACR_SERVER}/msim-api:bootstrap"
docker build -f services/msim-api/Dockerfile -t "${IMAGE}" .
docker push "${IMAGE}"
echo "  ✓ Image pushed: ${IMAGE}"

# ── 7. Run DB migrations via Container App Job ────────────────────────────────
echo ""
echo "→ Updating migration job image and running migrations..."
az containerapp job update \
  --name "ca-db-migrate-${ENV}" \
  --resource-group "${RESOURCE_GROUP}" \
  --image "${IMAGE}" \
  --output none

az containerapp job start \
  --name "ca-db-migrate-${ENV}" \
  --resource-group "${RESOURCE_GROUP}" \
  --output none

echo "  Waiting for migrations to complete..."
sleep 30

EXEC_NAME=$(az containerapp job execution list \
  --name "ca-db-migrate-${ENV}" \
  --resource-group "${RESOURCE_GROUP}" \
  --query '[0].name' -o tsv)

STATUS=$(az containerapp job execution show \
  --name "ca-db-migrate-${ENV}" \
  --resource-group "${RESOURCE_GROUP}" \
  --job-execution-name "${EXEC_NAME}" \
  --query 'properties.status' -o tsv)

echo "  ✓ Migration job status: ${STATUS}"

# ── 8. Update Container App with bootstrap image ──────────────────────────────
echo ""
echo "→ Deploying bootstrap image to Container App..."
az containerapp update \
  --name "ca-msim-api-${ENV}" \
  --resource-group "${RESOURCE_GROUP}" \
  --image "${IMAGE}" \
  --output none

echo "  Waiting for rollout..."
sleep 20

echo "→ Running smoke test against staging..."
curl --fail "https://${API_FQDN}/health/ready" && echo "  ✓ /health/ready OK"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Provisioning complete!"
echo ""
echo "Next steps:"
echo "  1. Set Entra External ID values in ${PARAMS_FILE}"
echo "  2. Set AI Search key in Key Vault:"
echo "     az keyvault secret set --vault-name kv-ain-${ENV} --name ain-search-key --value <key>"
echo "  3. Push to 'develop' branch to trigger automated staging deploys"
echo "  4. Admin web:    deploy via 'az staticwebapp deploy' or Azure Static Web Apps"
echo "  5. Platform web: deploy via 'az staticwebapp deploy' or Azure Static Web Apps"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
