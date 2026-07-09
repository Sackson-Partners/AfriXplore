# Production Infrastructure Setup Guide

**Date:** 2026-07-09  
**Status:** 🔧 Infrastructure Provisioning Required

---

## Overview

The production deployment workflow is configured and ready, but the Azure production infrastructure needs to be provisioned. This guide walks through creating the necessary resources.

---

## Current State

### ✅ Completed
- GitHub Secrets configured (AZURE_CREDENTIALS, METRICS_API_KEY, PROD_API_KEY)
- Production deployment workflow updated for Container Apps
- Blue-green deployment strategy with traffic shifting
- Service principal created with Contributor role

### ⚠️ Pending
- Production Container Apps (ca-msim-api-prod, ca-geoswarm-api-prod, ca-convergence-prod)
- Production Azure Container Registry (optional - currently using dev ACR)
- Production PostgreSQL Flexible Server
- Production Redis Cache
- Production Container Apps Environment

---

## Option 1: Automated Provisioning with Bicep (Recommended)

### Prerequisites
```bash
# Ensure you're logged in to Azure
az login
az account set --subscription e919967a-c8ff-4896-977b-360167fa1a84

# Resource group already exists
az group show --name rg-afrixplore-msim-prod
```

### Step 1: Review Bicep Template

The `infra/main.bicep` file should define:
- Container Apps Environment
- PostgreSQL Flexible Server
- Redis Cache
- Container Apps (msim-api, geoswarm-api, convergence-engine)
- Application Insights
- Log Analytics Workspace

### Step 2: Deploy Infrastructure

```bash
# From project root
cd infra

# Deploy to production
az deployment group create \
  --resource-group rg-afrixplore-msim-prod \
  --template-file main.bicep \
  --parameters environment=prod \
  --parameters location=southafricanorth \
  --mode Incremental

# Monitor deployment
az deployment group show \
  --resource-group rg-afrixplore-msim-prod \
  --name main \
  --query properties.provisioningState
```

### Step 3: Configure Secrets

```bash
# Get database connection string
DB_URL=$(az postgres flexible-server show-connection-string \
  --server-name <postgres-server-name> \
  --database-name ain_platform \
  --admin-user adminuser \
  --query connectionStrings.psql_cmd -o tsv)

# Get Redis connection string
REDIS_HOST=$(az redis show \
  --name <redis-name> \
  --resource-group rg-afrixplore-msim-prod \
  --query hostName -o tsv)

REDIS_PASSWORD=$(az redis list-keys \
  --name <redis-name> \
  --resource-group rg-afrixplore-msim-prod \
  --query primaryKey -o tsv)

# Set secrets on Container Apps
az containerapp secret set \
  --name ca-msim-api-prod \
  --resource-group rg-afrixplore-msim-prod \
  --secrets \
    database-url="$DB_URL" \
    redis-password="$REDIS_PASSWORD" \
    metrics-api-key="${{ secrets.METRICS_API_KEY }}"
```

---

## Option 2: Manual Provisioning (Step-by-Step)

### Step 1: Create Container Apps Environment

```bash
# Create Log Analytics Workspace
az monitor log-analytics workspace create \
  --resource-group rg-afrixplore-msim-prod \
  --workspace-name la-afrixplore-prod \
  --location southafricanorth

# Get workspace ID and key
LA_ID=$(az monitor log-analytics workspace show \
  --resource-group rg-afrixplore-msim-prod \
  --workspace-name la-afrixplore-prod \
  --query customerId -o tsv)

LA_KEY=$(az monitor log-analytics workspace get-shared-keys \
  --resource-group rg-afrixplore-msim-prod \
  --workspace-name la-afrixplore-prod \
  --query primarySharedKey -o tsv)

# Create Container Apps Environment
az containerapp env create \
  --name cae-afrixplore-prod \
  --resource-group rg-afrixplore-msim-prod \
  --location southafricanorth \
  --logs-workspace-id $LA_ID \
  --logs-workspace-key $LA_KEY
```

### Step 2: Create PostgreSQL Database

```bash
# Create PostgreSQL Flexible Server
az postgres flexible-server create \
  --resource-group rg-afrixplore-msim-prod \
  --name pg-afrixplore-prod \
  --location southafricanorth \
  --admin-user adminuser \
  --admin-password '<secure-password>' \
  --sku-name Standard_D4s_v3 \
  --tier GeneralPurpose \
  --storage-size 128 \
  --version 15 \
  --high-availability Enabled \
  --zone 1 \
  --standby-zone 2 \
  --public-access None

# Create database
az postgres flexible-server db create \
  --resource-group rg-afrixplore-msim-prod \
  --server-name pg-afrixplore-prod \
  --database-name ain_platform

# Enable PostGIS extension
az postgres flexible-server execute \
  --resource-group rg-afrixplore-msim-prod \
  --name pg-afrixplore-prod \
  --database-name ain_platform \
  --querytext "CREATE EXTENSION IF NOT EXISTS postgis;"
```

### Step 3: Create Redis Cache

```bash
# Create Redis Cache
az redis create \
  --resource-group rg-afrixplore-msim-prod \
  --name redis-afrixplore-prod \
  --location southafricanorth \
  --sku Premium \
  --vm-size P1 \
  --enable-non-ssl-port false \
  --minimum-tls-version 1.2

# Enable data persistence
az redis patch-schedule set \
  --resource-group rg-afrixplore-msim-prod \
  --name redis-afrixplore-prod \
  --schedule-entries '[{"dayOfWeek":"Sunday","startHourUtc":2,"maintenanceWindow":"PT5H"}]'
```

### Step 4: Create Container Apps

#### MSIM API

```bash
az containerapp create \
  --name ca-msim-api-prod \
  --resource-group rg-afrixplore-msim-prod \
  --environment cae-afrixplore-prod \
  --image cracaindev.azurecr.io/msim-api:v1.0.0 \
  --registry-server cracaindev.azurecr.io \
  --registry-identity system \
  --target-port 3000 \
  --ingress external \
  --min-replicas 2 \
  --max-replicas 10 \
  --cpu 1.0 \
  --memory 2Gi \
  --env-vars \
    NODE_ENV=production \
    DATABASE_URL=secretref:database-url \
    REDIS_HOST=secretref:redis-host \
    REDIS_PASSWORD=secretref:redis-password \
    REDIS_TLS=true \
    METRICS_API_KEY=secretref:metrics-api-key \
    SENTRY_DSN=secretref:sentry-dsn \
  --secrets \
    database-url="<postgres-connection-string>" \
    redis-host="redis-afrixplore-prod.redis.cache.windows.net" \
    redis-password="<redis-password>" \
    metrics-api-key="<metrics-api-key>" \
    sentry-dsn="<sentry-dsn>"
```

#### GeoSwarm API

```bash
az containerapp create \
  --name ca-geoswarm-api-prod \
  --resource-group rg-afrixplore-msim-prod \
  --environment cae-afrixplore-prod \
  --image cracaindev.azurecr.io/geoswarm-api:v1.0.0 \
  --registry-server cracaindev.azurecr.io \
  --registry-identity system \
  --target-port 3001 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 5 \
  --cpu 0.5 \
  --memory 1Gi \
  --env-vars \
    NODE_ENV=production \
    DATABASE_URL=secretref:database-url \
  --secrets \
    database-url="<postgres-connection-string>"
```

#### Convergence Engine

```bash
az containerapp create \
  --name ca-convergence-prod \
  --resource-group rg-afrixplore-msim-prod \
  --environment cae-afrixplore-prod \
  --image cracaindev.azurecr.io/convergence-engine:v1.0.0 \
  --registry-server cracaindev.azurecr.io \
  --registry-identity system \
  --target-port 8000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 5 \
  --cpu 1.0 \
  --memory 2Gi \
  --env-vars \
    ENVIRONMENT=production \
    DATABASE_URL=secretref:database-url \
  --secrets \
    database-url="<postgres-connection-string>"
```

### Step 5: Grant ACR Pull Access

```bash
# Get Container App managed identity
MSIM_IDENTITY=$(az containerapp show \
  --name ca-msim-api-prod \
  --resource-group rg-afrixplore-msim-prod \
  --query identity.principalId -o tsv)

# Grant AcrPull role
az role assignment create \
  --assignee $MSIM_IDENTITY \
  --role AcrPull \
  --scope /subscriptions/e919967a-c8ff-4896-977b-360167fa1a84/resourceGroups/rg-ain-dev/providers/Microsoft.ContainerRegistry/registries/cracaindev

# Repeat for other container apps
```

### Step 6: Configure Custom Domain (Optional)

```bash
# Add custom domain
az containerapp hostname add \
  --name ca-msim-api-prod \
  --resource-group rg-afrixplore-msim-prod \
  --hostname api.ain-platform.com

# Bind SSL certificate (managed certificate)
az containerapp hostname bind \
  --name ca-msim-api-prod \
  --resource-group rg-afrixplore-msim-prod \
  --hostname api.ain-platform.com \
  --environment cae-afrixplore-prod \
  --validation-method CNAME
```

---

## Option 3: Copy from Staging

If staging infrastructure is already configured correctly:

```bash
# Export staging configuration
az containerapp show \
  --name ca-msim-api-staging \
  --resource-group afrixplore-rg \
  --output json > staging-config.json

# Modify for production and import
# (adjust resource group, scaling, environment variables)

# Create from configuration
az containerapp create \
  --resource-group rg-afrixplore-msim-prod \
  --yaml production-config.yaml
```

---

## Verification Checklist

After provisioning, verify:

### Infrastructure

```bash
# Check Container Apps Environment
az containerapp env show \
  --name cae-afrixplore-prod \
  --resource-group rg-afrixplore-msim-prod

# Check Container Apps
az containerapp list \
  --resource-group rg-afrixplore-msim-prod \
  --query "[].{Name:name, Status:properties.provisioningState, URL:properties.configuration.ingress.fqdn}" \
  --output table

# Check PostgreSQL
az postgres flexible-server show \
  --name pg-afrixplore-prod \
  --resource-group rg-afrixplore-msim-prod \
  --query "{Name:name, State:state, Version:version}" \
  --output table

# Check Redis
az redis show \
  --name redis-afrixplore-prod \
  --resource-group rg-afrixplore-msim-prod \
  --query "{Name:name, Status:provisioningState, SKU:sku.name}" \
  --output table
```

### Health Checks

```bash
# Get Container App URLs
MSIM_URL=$(az containerapp show \
  --name ca-msim-api-prod \
  --resource-group rg-afrixplore-msim-prod \
  --query properties.configuration.ingress.fqdn -o tsv)

# Test health endpoints
curl https://$MSIM_URL/health/live
curl https://$MSIM_URL/health/ready
```

---

## Run Database Migrations

Before first deployment:

```bash
# Create migration job (if not exists)
az containerapp job create \
  --name ca-db-migrate-prod \
  --resource-group rg-afrixplore-msim-prod \
  --environment cae-afrixplore-prod \
  --trigger-type Manual \
  --replica-timeout 1800 \
  --replica-retry-limit 1 \
  --replica-completion-count 1 \
  --parallelism 1 \
  --image cracaindev.azurecr.io/msim-api:v1.0.0 \
  --cpu 0.5 \
  --memory 1Gi \
  --command "/bin/sh" "-c" "pnpm --filter @ain/database migrate:deploy" \
  --env-vars DATABASE_URL=secretref:database-url \
  --secrets database-url="<postgres-connection-string>"

# Run migrations
az containerapp job start \
  --name ca-db-migrate-prod \
  --resource-group rg-afrixplore-msim-prod
```

---

## Deploy v1.0.0 to Production

Once infrastructure is ready:

```bash
# Trigger deployment workflow
gh workflow run deploy-production-blue-green.yml \
  --field version=v1.0.0 \
  --field traffic_percentage=10

# Monitor deployment
gh run watch

# Gradually increase traffic
gh workflow run deploy-production-blue-green.yml \
  --field version=v1.0.0 \
  --field traffic_percentage=25

# ... continue to 50%, then 100%
```

---

## Cost Estimates (South Africa North Region)

### Monthly Costs

| Resource | SKU | Estimated Cost |
|----------|-----|----------------|
| Container Apps Environment | - | $0 (consumption-based) |
| Container Apps (3 apps) | 1-2 vCPU each | $150-300/month |
| PostgreSQL Flexible Server | Standard_D4s_v3 (HA) | $400-600/month |
| Redis Cache | Premium P1 | $200-300/month |
| Log Analytics | Pay-as-you-go | $50-100/month |
| Application Insights | - | $0-50/month |
| **Total** | | **$800-1,350/month** |

### Cost Optimization

- Use **Spot instances** for non-critical workloads
- Enable **auto-scaling** to scale down during low traffic
- Use **Reserved Capacity** for PostgreSQL (save 30-60%)
- Configure **log retention** policies (30 days)

---

## Troubleshooting

### Container App Not Starting

```bash
# Check logs
az containerapp logs show \
  --name ca-msim-api-prod \
  --resource-group rg-afrixplore-msim-prod \
  --tail 100

# Check replica status
az containerapp replica list \
  --name ca-msim-api-prod \
  --resource-group rg-afrixplore-msim-prod
```

### Database Connection Issues

```bash
# Check firewall rules
az postgres flexible-server firewall-rule list \
  --name pg-afrixplore-prod \
  --resource-group rg-afrixplore-msim-prod

# Allow Container Apps subnet
az postgres flexible-server firewall-rule create \
  --name allow-container-apps \
  --server-name pg-afrixplore-prod \
  --resource-group rg-afrixplore-msim-prod \
  --start-ip-address <subnet-start> \
  --end-ip-address <subnet-end>
```

### ACR Pull Errors

```bash
# Verify managed identity has AcrPull
az role assignment list \
  --assignee <managed-identity-id> \
  --scope /subscriptions/.../registries/cracaindev

# Grant if missing
az role assignment create \
  --assignee <managed-identity-id> \
  --role AcrPull \
  --scope /subscriptions/.../registries/cracaindev
```

---

## Next Steps

1. **Choose provisioning method** (Bicep recommended)
2. **Provision infrastructure** following steps above
3. **Run database migrations**
4. **Trigger deployment workflow**
5. **Monitor and gradually scale to 100%**

---

**Last Updated:** 2026-07-09  
**Status:** Ready for infrastructure provisioning
