#!/bin/bash
# AfriXplore — Azure Key Vault Setup
# Usage: ./setup-keyvault.sh [staging|production]
# Requires: az login, correct subscription set

set -euo pipefail

ENVIRONMENT=${1:-staging}
RESOURCE_GROUP="afrixplore-rg"
VAULT_NAME="afrixplore-kv-${ENVIRONMENT}"
LOCATION="southafricanorth"
SERVICES=("intelligence-api" "scout-api" "msim-api" "payment-service" "ai-inference" "notification-service")

echo "=== AfriXplore Key Vault Setup: ${ENVIRONMENT} ==="
echo "Vault: ${VAULT_NAME}  RG: ${RESOURCE_GROUP}  Region: ${LOCATION}"

# Create vault with RBAC authorization (preferred over access policies)
az keyvault create \
  --name "${VAULT_NAME}" \
  --resource-group "${RESOURCE_GROUP}" \
  --location "${LOCATION}" \
  --enable-rbac-authorization true \
  --retention-days 90 \
  --output none

VAULT_URI="https://${VAULT_NAME}.vault.azure.net"
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
VAULT_SCOPE="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.KeyVault/vaults/${VAULT_NAME}"

echo "Vault created: ${VAULT_URI}"
echo ""

# Grant each Container App's Managed Identity read access
for SERVICE in "${SERVICES[@]}"; do
  APP_NAME="ca-${SERVICE}-${ENVIRONMENT}"

  PRINCIPAL_ID=$(az containerapp show \
    --name "${APP_NAME}" \
    --resource-group "${RESOURCE_GROUP}" \
    --query "identity.principalId" \
    -o tsv 2>/dev/null || echo "")

  if [ -z "${PRINCIPAL_ID}" ]; then
    echo "⚠️  Container App '${APP_NAME}' not found — skipping"
    continue
  fi

  az role assignment create \
    --role "Key Vault Secrets User" \
    --assignee "${PRINCIPAL_ID}" \
    --scope "${VAULT_SCOPE}" \
    --output none

  # Set vault URI on the Container App
  az containerapp update \
    --name "${APP_NAME}" \
    --resource-group "${RESOURCE_GROUP}" \
    --set-env-vars "AZURE_KEY_VAULT_URI=${VAULT_URI}" \
    --output none

  echo "✅ ${SERVICE}: Secrets User role granted, AZURE_KEY_VAULT_URI set"
done

echo ""
echo "=== Key Vault ready: ${VAULT_URI} ==="
echo ""
echo "Populate secrets:"
echo "  az keyvault secret set --vault-name ${VAULT_NAME} --name database-url --value '<value>'"
echo "  az keyvault secret set --vault-name ${VAULT_NAME} --name service-bus-connection-string --value '<value>'"
echo "  az keyvault secret set --vault-name ${VAULT_NAME} --name momo-subscription-key --value '<value>'"
echo "  az keyvault secret set --vault-name ${VAULT_NAME} --name momo-api-key --value '<value>'"
echo "  az keyvault secret set --vault-name ${VAULT_NAME} --name momo-api-user --value '<value>'"
echo "  az keyvault secret set --vault-name ${VAULT_NAME} --name stripe-secret-key --value '<value>'"
echo "  az keyvault secret set --vault-name ${VAULT_NAME} --name stripe-webhook-secret --value '<value>'"
echo "  az keyvault secret set --vault-name ${VAULT_NAME} --name africas-talking-api-key --value '<value>'"
echo "  az keyvault secret set --vault-name ${VAULT_NAME} --name custom-vision-training-key --value '<value>'"
echo "  az keyvault secret set --vault-name ${VAULT_NAME} --name custom-vision-prediction-key --value '<value>'"
