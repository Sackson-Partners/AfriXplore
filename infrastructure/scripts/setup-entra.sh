#!/bin/bash
# AfriXplore — Entra External ID Full Setup
# Run once per environment
# Prerequisites: az cli logged in

set -euo pipefail

ENVIRONMENT=${1:-dev}

echo "╔══════════════════════════════════════════════════╗"
echo "║  AfriXplore — Entra External ID Setup            ║"
echo "║  Environment: ${ENVIRONMENT}                     ║"
echo "╚══════════════════════════════════════════════════╝"

echo ""
echo "▶ Step 1: Creating Entra External ID tenant for Scouts..."
echo "  → Go to: portal.azure.com → Azure AD → Create tenant"
echo "  → Type: External (CIAM)"
echo "  → Name: AfriXplore Scouts ${ENVIRONMENT}"
echo "  → Domain: afrixplore-scouts-${ENVIRONMENT}.onmicrosoft.com"
echo ""
read -p "  Enter Scout tenant ID (after creating): " SCOUT_TENANT_ID
read -p "  Enter Platform tenant ID: " PLATFORM_TENANT_ID

echo ""
echo "▶ Step 2: Registering Scout Mobile App..."

SCOUT_APP=$(az ad app create \
  --display-name "AfriXplore Scout App - ${ENVIRONMENT}" \
  --sign-in-audience "AzureADandPersonalMicrosoftAccount" \
  --public-client-redirect-uris \
    "msauth://io.afrixplore.scout/callback" \
    "io.afrixplore.scout://auth" \
    "exp://localhost:8081" \
  --query "{appId:appId, objectId:id}" \
  -o json)

SCOUT_CLIENT_ID=$(echo $SCOUT_APP | jq -r '.appId')
echo "  ✅ Scout App Client ID: ${SCOUT_CLIENT_ID}"

echo ""
echo "▶ Step 3: Registering Platform Web App..."

PLATFORM_APP=$(az ad app create \
  --display-name "AfriXplore Platform - ${ENVIRONMENT}" \
  --sign-in-audience "AzureADMultipleOrgs" \
  --web-redirect-uris \
    "https://platform.afrixplore.io/auth/callback" \
    "https://staging.platform.afrixplore.io/auth/callback" \
    "http://localhost:3005/auth/callback" \
  --query "{appId:appId, objectId:id}" \
  -o json)

PLATFORM_CLIENT_ID=$(echo $PLATFORM_APP | jq -r '.appId')
echo "  ✅ Platform App Client ID: ${PLATFORM_CLIENT_ID}"

echo ""
echo "▶ Step 4: Creating client secrets..."

PLATFORM_SECRET=$(az ad app credential reset \
  --id $PLATFORM_CLIENT_ID \
  --years 2 \
  --query password -o tsv)

echo "  ✅ Platform client secret created"

echo ""
echo "▶ Step 5: Storing credentials in Key Vault..."

KV_NAME="kv-afrixplore-${ENVIRONMENT}"

az keyvault secret set --vault-name $KV_NAME --name "entra-scout-tenant-id" --value $SCOUT_TENANT_ID
az keyvault secret set --vault-name $KV_NAME --name "entra-platform-tenant-id" --value $PLATFORM_TENANT_ID
az keyvault secret set --vault-name $KV_NAME --name "entra-scout-client-id" --value $SCOUT_CLIENT_ID
az keyvault secret set --vault-name $KV_NAME --name "entra-platform-client-id" --value $PLATFORM_CLIENT_ID
az keyvault secret set --vault-name $KV_NAME --name "entra-platform-client-secret" --value $PLATFORM_SECRET

echo "  ✅ All secrets stored in Key Vault"

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  Setup Complete — Add to .env:                   ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo "ENTRA_SCOUT_TENANT_ID=${SCOUT_TENANT_ID}"
echo "ENTRA_PLATFORM_TENANT_ID=${PLATFORM_TENANT_ID}"
echo "ENTRA_SCOUT_CLIENT_ID=${SCOUT_CLIENT_ID}"
echo "ENTRA_PLATFORM_CLIENT_ID=${PLATFORM_CLIENT_ID}"
echo ""
echo "▶ Next: Configure User Flows in Azure Portal"
echo "  → afrixplore-scouts tenant → User flows → New flow"
echo "  → Sign up and sign in → Phone (OTP) → No email required"
