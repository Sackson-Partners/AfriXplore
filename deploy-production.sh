#!/bin/bash
##
# AIN Platform - Production Deployment Script
# Deploy to Azure Container Apps in rg-afrixplore-msim-prod
##

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SUBSCRIPTION_ID="e919967a-c8ff-4896-977b-360167fa1a84"
TENANT_ID="89190235-0737-4836-b894-5c9d8afb00c3"
RG_PROD="rg-afrixplore-msim-prod"
RG_DEV="rg-ain-dev"
LOCATION="southafricanorth"
VERSION="${1:-v1.0.0}"

# Resource names
ACR_NAME="cracaindev"
ACR_LOGIN_SERVER="${ACR_NAME}.azurecr.io"
CAE_NAME="cae-ain-prod"
PG_SERVER_NAME="psql-ain-prod"
KV_NAME="kv-ain-prod"
LOG_WORKSPACE_NAME="log-ain-prod"

# Container App names
CA_MSIM_API="ca-msim-api-prod"
CA_GEOSWARM_API="ca-geoswarm-api-prod"
CA_CONVERGENCE="ca-convergence-prod"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}AIN Platform - Production Deployment${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Subscription: ${YELLOW}$SUBSCRIPTION_ID${NC}"
echo -e "Tenant: ${YELLOW}$TENANT_ID${NC}"
echo -e "Resource Group: ${YELLOW}$RG_PROD${NC}"
echo -e "Location: ${YELLOW}$LOCATION${NC}"
echo -e "Version: ${YELLOW}$VERSION${NC}"
echo ""

# Function to print step header
step() {
  echo ""
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}$1${NC}"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Function to print success
success() {
  echo -e "${GREEN}✅ $1${NC}"
}

# Function to print error
error() {
  echo -e "${RED}❌ ERROR: $1${NC}"
  exit 1
}

# Function to print warning
warning() {
  echo -e "${YELLOW}⚠️  WARNING: $1${NC}"
}

# Function to print info
info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if logged in to Azure
step "Step 1: Verify Azure Login"
if ! az account show &>/dev/null; then
  error "Not logged in to Azure. Run: az login"
fi

# Set subscription
info "Setting subscription to $SUBSCRIPTION_ID..."
az account set --subscription "$SUBSCRIPTION_ID" || error "Failed to set subscription"
success "Subscription set"

# Verify resource group exists
step "Step 2: Verify Production Resource Group"
if ! az group show --name "$RG_PROD" &>/dev/null; then
  warning "Production resource group does not exist. Creating..."
  az group create --name "$RG_PROD" --location "$LOCATION" \
    --tags Environment=Production Project=AIN-Platform CostCenter=Mining-Intelligence \
    || error "Failed to create resource group"
  success "Resource group created"
else
  success "Resource group exists"
fi

# Check if infrastructure exists
step "Step 3: Check Existing Infrastructure"
info "Checking for Container Apps Environment..."
if az containerapp env show --name "$CAE_NAME" --resource-group "$RG_PROD" &>/dev/null; then
  success "Container Apps Environment exists"
  INFRA_EXISTS=true
else
  warning "Container Apps Environment does not exist"
  INFRA_EXISTS=false
fi

# Deploy infrastructure if needed
if [ "$INFRA_EXISTS" = false ]; then
  step "Step 4: Deploy Infrastructure with Bicep"

  info "This will deploy:"
  echo "  - Container Apps Environment"
  echo "  - PostgreSQL Flexible Server (with HA)"
  echo "  - Azure Key Vault"
  echo "  - Azure Storage"
  echo "  - Azure Service Bus"
  echo "  - Azure OpenAI"
  echo "  - Azure AI Document Intelligence"
  echo "  - Azure AI Search"
  echo "  - Application Insights"
  echo ""

  read -p "Continue with infrastructure deployment? (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    error "Deployment cancelled by user"
  fi

  # Check if parameters file exists
  if [ ! -f "infra/parameters.prod.json" ]; then
    warning "Production parameters file not found"
    info "Creating template parameters file..."

    cat > infra/parameters.prod.json <<EOF
{
  "\$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "environment": {
      "value": "prod"
    },
    "location": {
      "value": "$LOCATION"
    },
    "postgresAdminPassword": {
      "value": "$(openssl rand -base64 32)"
    },
    "entraExternalTenantId": {
      "value": "$TENANT_ID"
    },
    "entraClientId": {
      "value": "YOUR_ENTRA_CLIENT_ID_HERE"
    },
    "mapboxToken": {
      "value": ""
    }
  }
}
EOF

    warning "Please edit infra/parameters.prod.json and add:"
    echo "  - entraClientId (Azure Entra External ID client ID)"
    echo "  - mapboxToken (Mapbox access token)"
    echo ""
    read -p "Press Enter after editing parameters.prod.json..."
  fi

  info "Deploying infrastructure (this will take 60-90 minutes)..."
  DEPLOYMENT_NAME="ain-prod-$(date +%Y%m%d-%H%M%S)"

  az deployment group create \
    --resource-group "$RG_PROD" \
    --template-file infra/main.bicep \
    --parameters @infra/parameters.prod.json \
    --name "$DEPLOYMENT_NAME" \
    --mode Incremental \
    || error "Infrastructure deployment failed"

  success "Infrastructure deployed successfully"
else
  info "Skipping infrastructure deployment (already exists)"
fi

# Login to ACR
step "Step 5: Login to Azure Container Registry"
info "Logging in to $ACR_LOGIN_SERVER..."
az acr login --name "$ACR_NAME" || error "ACR login failed"
success "ACR login successful"

# Build and push Docker images
step "Step 6: Build and Push Docker Images"

info "Building msim-api..."
docker build -t "$ACR_LOGIN_SERVER/msim-api:$VERSION" -f services/msim-api/Dockerfile . \
  || error "msim-api build failed"
docker push "$ACR_LOGIN_SERVER/msim-api:$VERSION" \
  || error "msim-api push failed"
success "msim-api image pushed"

info "Building geoswarm-api..."
docker build -t "$ACR_LOGIN_SERVER/geoswarm-api:$VERSION" -f services/geoswarm-api/Dockerfile . \
  || error "geoswarm-api build failed"
docker push "$ACR_LOGIN_SERVER/geoswarm-api:$VERSION" \
  || error "geoswarm-api push failed"
success "geoswarm-api image pushed"

info "Building convergence-engine..."
docker build -t "$ACR_LOGIN_SERVER/convergence-engine:$VERSION" -f services/convergence-engine/Dockerfile . \
  || error "convergence-engine build failed"
docker push "$ACR_LOGIN_SERVER/convergence-engine:$VERSION" \
  || error "convergence-engine push failed"
success "convergence-engine image pushed"

# Check if Container Apps exist
step "Step 7: Check Container Apps Status"

MSIM_EXISTS=false
if az containerapp show --name "$CA_MSIM_API" --resource-group "$RG_PROD" &>/dev/null; then
  success "msim-api Container App exists"
  MSIM_EXISTS=true
else
  warning "msim-api Container App does not exist - will create"
fi

# Create or update msim-api Container App
step "Step 8: Deploy msim-api Container App"

if [ "$MSIM_EXISTS" = true ]; then
  info "Updating msim-api with blue-green deployment..."

  REVISION_SUFFIX="green-$(echo $VERSION | tr -d 'v.')"

  az containerapp update \
    --name "$CA_MSIM_API" \
    --resource-group "$RG_PROD" \
    --image "$ACR_LOGIN_SERVER/msim-api:$VERSION" \
    --revision-suffix "$REVISION_SUFFIX" \
    --set-env-vars VERSION="$VERSION" \
    || error "msim-api update failed"

  success "Green revision deployed: $REVISION_SUFFIX"
else
  info "Creating msim-api Container App..."

  # Get managed identity ID
  IDENTITY_ID=$(az identity show \
    --name id-msim-api-prod \
    --resource-group "$RG_PROD" \
    --query id -o tsv 2>/dev/null || echo "")

  if [ -z "$IDENTITY_ID" ]; then
    warning "Managed identity not found, creating..."
    az identity create \
      --name id-msim-api-prod \
      --resource-group "$RG_PROD" \
      --location "$LOCATION" \
      || error "Failed to create managed identity"

    IDENTITY_ID=$(az identity show \
      --name id-msim-api-prod \
      --resource-group "$RG_PROD" \
      --query id -o tsv)
  fi

  az containerapp create \
    --name "$CA_MSIM_API" \
    --resource-group "$RG_PROD" \
    --environment "$CAE_NAME" \
    --image "$ACR_LOGIN_SERVER/msim-api:$VERSION" \
    --user-assigned "$IDENTITY_ID" \
    --registry-server "$ACR_LOGIN_SERVER" \
    --target-port 3002 \
    --ingress external \
    --min-replicas 2 \
    --max-replicas 10 \
    --cpu 1.0 \
    --memory 2Gi \
    --env-vars \
      NODE_ENV=production \
      MSIM_API_PORT=3002 \
      VERSION="$VERSION" \
      AZURE_KEY_VAULT_URL="https://$KV_NAME.vault.azure.net/" \
    || error "msim-api creation failed"

  success "msim-api Container App created"
fi

# Wait for deployment to be ready
step "Step 9: Verify Deployment"

info "Waiting for Container App to be ready..."
sleep 30

MSIM_URL=$(az containerapp show \
  --name "$CA_MSIM_API" \
  --resource-group "$RG_PROD" \
  --query properties.configuration.ingress.fqdn -o tsv)

if [ -z "$MSIM_URL" ]; then
  error "Failed to get Container App URL"
fi

success "Container App URL: https://$MSIM_URL"

# Test health endpoint
info "Testing health endpoint..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if curl -sf "https://$MSIM_URL/health/live" >/dev/null 2>&1; then
    success "Health check passed"
    break
  fi

  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    error "Health check failed after $MAX_RETRIES attempts"
  fi

  info "Waiting for app to be ready... (attempt $RETRY_COUNT/$MAX_RETRIES)"
  sleep 10
done

# Display health check response
info "Health check response:"
curl -s "https://$MSIM_URL/health/ready" | jq . || echo "Failed to get health status"

# Summary
step "Deployment Summary"
echo ""
echo -e "${GREEN}✅ Production deployment successful!${NC}"
echo ""
echo -e "Resource Group: ${BLUE}$RG_PROD${NC}"
echo -e "Version: ${BLUE}$VERSION${NC}"
echo -e "msim-api URL: ${BLUE}https://$MSIM_URL${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Test API endpoints"
echo "2. Run database migrations (if not already done)"
echo "3. Configure custom domain (optional)"
echo "4. Set up monitoring alerts"
echo "5. Gradually shift traffic if using blue-green deployment"
echo ""
echo -e "${BLUE}Health Check:${NC} curl https://$MSIM_URL/health/ready"
echo -e "${BLUE}Portal:${NC} https://portal.azure.com/#@vamosokohotmail.onmicrosoft.com/resource/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RG_PROD/overview"
echo ""
echo -e "${GREEN}Deployment completed successfully! 🎉${NC}"
