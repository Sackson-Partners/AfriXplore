#!/bin/bash
# AfriXplore — Shared config
# Source this in every script: source infrastructure/scripts/config.sh

export AZURE_SUBSCRIPTION_ID="e919967a-c8ff-4896-977b-360167fa1a84"
export AZURE_TENANT_ID="vamosokohotmail.onmicrosoft.com"
export AZURE_RESOURCE_GROUP="afrixplore-rg"
export AZURE_LOCATION="southafricanorth"

export GITHUB_REPO="Sackson-Partners/AfriXplore"
export GITHUB_ORG="Sackson-Partners"

export VERCEL_TEAM="sacksons-projects"
export VERCEL_SCOPE="sacksons-projects"

export ACR_NAME="craafrixplore"
export ACR_URL="${ACR_NAME}.azurecr.io"

export KV_NAME="kv-afrixplore"
export SB_NAME="sb-afrixplore"
export PG_NAME="psql-afrixplore-saf"
export SIGR_NAME="sigr-afrixplore"
export APIM_NAME="apim-afrixplore"

# Derived
export ENVIRONMENT="${ENVIRONMENT:-staging}"
export RG="${AZURE_RESOURCE_GROUP}"

echo "✅ Config loaded: $ENVIRONMENT | $RG | $AZURE_SUBSCRIPTION_ID"
