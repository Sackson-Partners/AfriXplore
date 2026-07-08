#!/bin/bash

##
# Setup Production Environment Variables
# Configures Azure App Service and GitHub Secrets with production environment variables
##

set -e

echo "=================================="
echo "🔐 Environment Variables Setup"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
RESOURCE_GROUP="${RESOURCE_GROUP:-ain-platform-rg}"
APP_NAME_API="${APP_NAME_API:-app-ain-platform-msim-api-prod}"
APP_NAME_PLATFORM="${APP_NAME_PLATFORM:-app-ain-platform-web-prod}"
APP_NAME_ADMIN="${APP_NAME_ADMIN:-app-ain-platform-admin-prod}"
REPO="${REPO:-your-org/ain-platform}"

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
  echo -e "${RED}❌ Azure CLI not found. Install from: https://aka.ms/InstallAzureCLI${NC}"
  exit 1
fi

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
  echo -e "${YELLOW}⚠️  GitHub CLI not found. Skipping GitHub Secrets setup.${NC}"
  echo "   Install from: https://cli.github.com/"
  SKIP_GITHUB=true
fi

# Check if logged in to Azure
if ! az account show &> /dev/null; then
  echo -e "${RED}❌ Not logged in to Azure. Run: az login${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Azure CLI ready${NC}"
echo ""

# ============================================
# Generate Secure Random Secrets
# ============================================
echo "1. Generating secure random secrets..."

METRICS_API_KEY=$(openssl rand -base64 32)
CSRF_SECRET=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 48)

echo -e "${GREEN}✅ Secrets generated${NC}"
echo ""

# ============================================
# Azure App Service - MSIM API
# ============================================
echo "2. Configuring Azure App Service (MSIM API): $APP_NAME_API..."

az webapp config appsettings set \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_NAME_API" \
  --settings \
    NODE_ENV=production \
    METRICS_API_KEY="$METRICS_API_KEY" \
    CSRF_SECRET="$CSRF_SECRET" \
    JWT_SECRET="$JWT_SECRET" \
    METRICS_ALLOWED_IPS="127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16" \
    ALLOWED_ORIGINS="https://platform.ain-platform.com,https://admin.ain-platform.com" \
    LOG_LEVEL=info \
    CIRCUIT_BREAKER_TIMEOUT=30000 \
    CIRCUIT_BREAKER_ERROR_THRESHOLD=0.5 \
    DEFAULT_REQUEST_TIMEOUT=30000 \
    CONVERGENCE_REQUEST_TIMEOUT=120000 \
    FEATURE_CONVERGENCE_ENABLED=true \
  --output none

echo -e "${GREEN}✅ MSIM API configured${NC}"
echo ""

# ============================================
# Azure App Service - Platform Web
# ============================================
echo "3. Configuring Azure App Service (Platform Web): $APP_NAME_PLATFORM..."

az webapp config appsettings set \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_NAME_PLATFORM" \
  --settings \
    NODE_ENV=production \
    NEXT_PUBLIC_API_URL="https://api.ain-platform.com" \
  --output none

echo -e "${GREEN}✅ Platform Web configured${NC}"
echo ""

# ============================================
# Azure App Service - Admin Web
# ============================================
echo "4. Configuring Azure App Service (Admin Web): $APP_NAME_ADMIN..."

az webapp config appsettings set \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_NAME_ADMIN" \
  --settings \
    NODE_ENV=production \
    NEXT_PUBLIC_API_URL="https://api.ain-platform.com" \
  --output none

echo -e "${GREEN}✅ Admin Web configured${NC}"
echo ""

# ============================================
# GitHub Secrets
# ============================================
if [ "$SKIP_GITHUB" != true ]; then
  echo "5. Configuring GitHub Secrets for: $REPO..."

  gh secret set METRICS_API_KEY --body "$METRICS_API_KEY" --repo "$REPO"
  gh secret set CSRF_SECRET --body "$CSRF_SECRET" --repo "$REPO"
  gh secret set JWT_SECRET --body "$JWT_SECRET" --repo "$REPO"

  echo -e "${GREEN}✅ GitHub Secrets configured${NC}"
  echo ""
fi

# ============================================
# Save Secrets Securely
# ============================================
echo "6. Saving secrets to encrypted file..."

SECRETS_FILE="secrets-$(date +%Y%m%d-%H%M%S).txt"
cat > "$SECRETS_FILE" <<EOF
# AIN Platform Production Secrets
# Generated: $(date)
# IMPORTANT: Store this file securely and delete after transferring to Azure Key Vault

METRICS_API_KEY=$METRICS_API_KEY
CSRF_SECRET=$CSRF_SECRET
JWT_SECRET=$JWT_SECRET

# Next Steps:
# 1. Transfer these secrets to Azure Key Vault
# 2. Delete this file
# 3. Configure remaining secrets (DATABASE_URL, AZURE_OPENAI_API_KEY, etc.)
EOF

echo -e "${GREEN}✅ Secrets saved to: $SECRETS_FILE${NC}"
echo ""

# ============================================
# Summary
# ============================================
echo "=================================="
echo "✅ Environment Variables Configured"
echo "=================================="
echo ""
echo "Configured Services:"
echo "  - Azure App Service (MSIM API): $APP_NAME_API"
echo "  - Azure App Service (Platform Web): $APP_NAME_PLATFORM"
echo "  - Azure App Service (Admin Web): $APP_NAME_ADMIN"
if [ "$SKIP_GITHUB" != true ]; then
  echo "  - GitHub Secrets: $REPO"
fi
echo ""
echo "Generated Secrets:"
echo "  - METRICS_API_KEY"
echo "  - CSRF_SECRET"
echo "  - JWT_SECRET"
echo ""
echo "Next Steps:"
echo "  1. Review secrets file: $SECRETS_FILE"
echo "  2. Transfer secrets to Azure Key Vault"
echo "  3. Configure remaining environment variables:"
echo "     - DATABASE_URL (from Azure PostgreSQL)"
echo "     - AZURE_OPENAI_API_KEY"
echo "     - SENTRY_DSN"
echo "     - REDIS_HOST, REDIS_PASSWORD"
echo "     - SENDGRID_API_KEY"
echo "  4. Delete secrets file: rm $SECRETS_FILE"
echo "  5. Restart App Services: az webapp restart ..."
echo ""
