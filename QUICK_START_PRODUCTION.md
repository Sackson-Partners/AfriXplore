# Quick Start - Production Deployment

**Your Azure Environment:**
- **Tenant:** vamosokohotmail.onmicrosoft.com
- **Subscription ID:** e919967a-c8ff-4896-977b-360167fa1a84
- **Tenant ID:** 89190235-0737-4836-b894-5c9d8afb00c3
- **Production RG:** rg-afrixplore-msim-prod ✅ (exists)
- **Location:** South Africa North

---

## ⚡ Quick Deploy (Automated)

```bash
# 1. Ensure you're logged in to Azure
az login --tenant 89190235-0737-4836-b894-5c9d8afb00c3

# 2. Run the automated deployment script
./deploy-production.sh v1.0.0

# That's it! The script will:
# - Verify Azure login
# - Check/create production resource group
# - Deploy infrastructure (if needed) with Bicep
# - Build and push Docker images
# - Create/update Container Apps
# - Run health checks
```

**Estimated Time:** 90-120 minutes (first deployment)

---

## 📋 Manual Deployment (Step-by-Step)

### Step 1: Verify Azure Access (2 minutes)

```bash
# Login to Azure
az login --tenant 89190235-0737-4836-b894-5c9d8afb00c3

# Set subscription
az account set --subscription e919967a-c8ff-4896-977b-360167fa1a84

# Verify resource group
az group show --name rg-afrixplore-msim-prod

# Expected output:
# {
#   "name": "rg-afrixplore-msim-prod",
#   "location": "southafricanorth",
#   "provisioningState": "Succeeded"
# }
```

---

### Step 2: Deploy Infrastructure (60-90 minutes)

**Option A: Use Automated Script**
```bash
./deploy-production.sh v1.0.0
```

**Option B: Manual Bicep Deployment**
```bash
cd infra

# Create production parameters (if not exists)
cat > parameters.prod.json <<EOF
{
  "\$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "environment": { "value": "prod" },
    "location": { "value": "southafricanorth" },
    "postgresAdminPassword": { "value": "$(openssl rand -base64 32)" },
    "entraExternalTenantId": { "value": "89190235-0737-4836-b894-5c9d8afb00c3" },
    "entraClientId": { "value": "YOUR_ENTRA_CLIENT_ID" },
    "mapboxToken": { "value": "YOUR_MAPBOX_TOKEN" }
  }
}
EOF

# Edit parameters file
nano parameters.prod.json

# Deploy infrastructure
az deployment group create \
  --resource-group rg-afrixplore-msim-prod \
  --template-file main.bicep \
  --parameters @parameters.prod.json \
  --name ain-prod-$(date +%Y%m%d-%H%M%S)
```

---

### Step 3: Verify Infrastructure (5 minutes)

```bash
# Check Container Apps Environment
az containerapp env show \
  --name cae-ain-prod \
  --resource-group rg-afrixplore-msim-prod

# Check PostgreSQL
az postgres flexible-server show \
  --name psql-ain-prod \
  --resource-group rg-afrixplore-msim-prod

# Check Key Vault
az keyvault show \
  --name kv-ain-prod \
  --resource-group rg-afrixplore-msim-prod

# List all resources
az resource list \
  --resource-group rg-afrixplore-msim-prod \
  --output table
```

---

### Step 4: Build and Push Docker Images (15 minutes)

```bash
# Login to ACR
az acr login --name cracaindev

# Build and push images
docker build -t cracaindev.azurecr.io/msim-api:v1.0.0 \
  -f services/msim-api/Dockerfile .
docker push cracaindev.azurecr.io/msim-api:v1.0.0

docker build -t cracaindev.azurecr.io/geoswarm-api:v1.0.0 \
  -f services/geoswarm-api/Dockerfile .
docker push cracaindev.azurecr.io/geoswarm-api:v1.0.0

docker build -t cracaindev.azurecr.io/convergence-engine:v1.0.0 \
  -f services/convergence-engine/Dockerfile .
docker push cracaindev.azurecr.io/convergence-engine:v1.0.0
```

---

### Step 5: Run Database Migrations (10 minutes)

```bash
# Get database connection string
DB_URL=$(az keyvault secret show \
  --vault-name kv-ain-prod \
  --name ain-postgresql-connection-string \
  --query value -o tsv)

# Create migration job
az containerapp job create \
  --name ca-db-migrate-prod \
  --resource-group rg-afrixplore-msim-prod \
  --environment cae-ain-prod \
  --trigger-type Manual \
  --replica-timeout 1800 \
  --replica-retry-limit 1 \
  --image cracaindev.azurecr.io/msim-api:v1.0.0 \
  --cpu 0.5 \
  --memory 1Gi \
  --command "/bin/sh" "-c" "node dist/scripts/migrate.js" \
  --env-vars NODE_ENV=production \
  --secrets database-url="$DB_URL"

# Run migrations
az containerapp job start \
  --name ca-db-migrate-prod \
  --resource-group rg-afrixplore-msim-prod
```

---

### Step 6: Deploy via GitHub Actions (30 minutes)

```bash
# Option A: Trigger workflow via GitHub UI
# Go to: https://github.com/Sackson-Partners/AfriXplore/actions/workflows/deploy-production-blue-green.yml
# Click "Run workflow"
# Select: version=v1.0.0, traffic_percentage=10

# Option B: Trigger via CLI
gh workflow run deploy-production-blue-green.yml \
  --field version=v1.0.0 \
  --field traffic_percentage=10

# Monitor deployment
gh run watch
```

---

### Step 7: Verify Deployment (5 minutes)

```bash
# Get Container App URL
MSIM_URL=$(az containerapp show \
  --name ca-msim-api-prod \
  --resource-group rg-afrixplore-msim-prod \
  --query properties.configuration.ingress.fqdn -o tsv)

# Test health endpoint
curl https://$MSIM_URL/health/ready | jq .

# Expected output:
# {
#   "status": "ok",
#   "timestamp": "2026-07-18T...",
#   "checks": {
#     "database": "healthy",
#     "redis": "healthy"
#   }
# }
```

---

## 🔍 Monitor Deployment

### Azure Portal
```
https://portal.azure.com/#@vamosokohotmail.onmicrosoft.com/resource/subscriptions/e919967a-c8ff-4896-977b-360167fa1a84/resourceGroups/rg-afrixplore-msim-prod/overview
```

### Container App Logs
```bash
az containerapp logs show \
  --name ca-msim-api-prod \
  --resource-group rg-afrixplore-msim-prod \
  --tail 50 \
  --follow
```

### Application Insights
```bash
az monitor app-insights query \
  --app appi-ain-prod \
  --analytics-query "requests | where timestamp > ago(1h) | summarize count() by resultCode"
```

---

## 🚦 Gradual Traffic Shift

After verifying 10% traffic is healthy:

```bash
# Shift to 25%
gh workflow run deploy-production-blue-green.yml \
  --field version=v1.0.0 \
  --field traffic_percentage=25

# Wait 15 minutes, monitor metrics

# Shift to 50%
gh workflow run deploy-production-blue-green.yml \
  --field version=v1.0.0 \
  --field traffic_percentage=50

# Wait 15 minutes, monitor metrics

# Complete cutover to 100%
gh workflow run deploy-production-blue-green.yml \
  --field version=v1.0.0 \
  --field traffic_percentage=100
```

---

## 🔙 Rollback (If Needed)

```bash
# List revisions
az containerapp revision list \
  --name ca-msim-api-prod \
  --resource-group rg-afrixplore-msim-prod \
  --query "[].{Name:name, Active:properties.active, Traffic:properties.trafficWeight}"

# Rollback to previous revision
PREVIOUS_REVISION="ca-msim-api-prod--<previous-revision-suffix>"

az containerapp ingress traffic set \
  --name ca-msim-api-prod \
  --resource-group rg-afrixplore-msim-prod \
  --revision-weight $PREVIOUS_REVISION=100
```

---

## 📊 Success Criteria

✅ **Deployment is successful when:**

```bash
# 1. Health check returns OK
curl https://<app-url>/health/ready
# Expected: { "status": "ok" }

# 2. API responds correctly
curl https://<app-url>/mines?page=1&limit=1
# Expected: JSON with mine data

# 3. Error rate < 1%
az monitor metrics list \
  --resource /subscriptions/e919967a-c8ff-4896-977b-360167fa1a84/resourceGroups/rg-afrixplore-msim-prod/providers/Microsoft.App/containerApps/ca-msim-api-prod \
  --metric "Requests" \
  --interval PT1H

# 4. Response time < 500ms (p95)
# Check in Application Insights

# 5. Database connections stable
# Check in Azure Portal → PostgreSQL → Monitoring
```

---

## 🆘 Troubleshooting

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

### Database Connection Failed

```bash
# Test connection from local machine
DB_URL=$(az keyvault secret show \
  --vault-name kv-ain-prod \
  --name ain-postgresql-connection-string \
  --query value -o tsv)

psql "$DB_URL" -c "SELECT version();"

# Check firewall rules
az postgres flexible-server firewall-rule list \
  --name psql-ain-prod \
  --resource-group rg-afrixplore-msim-prod
```

### ACR Pull Failed

```bash
# Get managed identity
IDENTITY_ID=$(az containerapp show \
  --name ca-msim-api-prod \
  --resource-group rg-afrixplore-msim-prod \
  --query identity.principalId -o tsv)

# Grant AcrPull role
az role assignment create \
  --assignee $IDENTITY_ID \
  --role AcrPull \
  --scope /subscriptions/e919967a-c8ff-4896-977b-360167fa1a84/resourceGroups/rg-ain-dev/providers/Microsoft.ContainerRegistry/registries/cracaindev
```

---

## 📞 Support

- **Azure Portal:** https://portal.azure.com
- **GitHub Issues:** https://github.com/Sackson-Partners/AfriXplore/issues
- **Deployment Guide:** DEPLOY_TO_AZURE.md
- **Audit Report:** COMPREHENSIVE_AUDIT_REPORT.md

---

## ✅ Quick Checklist

Before deploying:
- [ ] Azure CLI installed and logged in
- [ ] Docker installed and running
- [ ] GitHub CLI installed and authenticated
- [ ] Production resource group verified
- [ ] Entra External ID client ID configured
- [ ] Mapbox token available
- [ ] GitHub secrets configured

After deploying:
- [ ] Health checks passing
- [ ] API endpoints responding
- [ ] Database migrations complete
- [ ] Error rate < 1%
- [ ] Response time < 500ms
- [ ] Monitoring alerts configured
- [ ] Custom domain configured (optional)
- [ ] Documentation updated

---

**Last Updated:** July 18, 2026  
**Environment:** Production (South Africa North)  
**Estimated Time:** 2-4 hours (first deployment)
