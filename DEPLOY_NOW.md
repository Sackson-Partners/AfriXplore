# 🚀 Deploy AIN Platform to Azure - Execute Now

**Status:** ✅ All code committed and pushed to GitHub  
**Date:** July 18, 2026  
**Environment:** Production (South Africa North)

---

## ✅ Pre-Deployment Checklist

- ✅ Code committed to GitHub: https://github.com/Sackson-Partners/AfriXplore
- ✅ Azure CLI authenticated (Subscription: e919967a-c8ff-4896-977b-360167fa1a84)
- ✅ Production resource group exists: `rg-afrixplore-msim-prod`
- ✅ Deployment scripts created and executable
- ⚠️ Infrastructure not yet provisioned (needs Bicep deployment)

---

## 🎯 Deployment Steps

### **Step 1: Provision Infrastructure with Bicep** (60-90 minutes)

#### 1.1 Create Parameters File

```bash
cd /Users/sackson/ain-platform/infra

# Generate secure passwords
PG_PASSWORD=$(openssl rand -base64 32)
echo "PostgreSQL Password: $PG_PASSWORD" > ~/ain-prod-secrets.txt
chmod 600 ~/ain-prod-secrets.txt

# Create production parameters file
cat > parameters.prod.json <<EOF
{
  "\$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "environment": {
      "value": "prod"
    },
    "location": {
      "value": "southafricanorth"
    },
    "postgresAdminPassword": {
      "value": "$PG_PASSWORD"
    },
    "entraExternalTenantId": {
      "value": "89190235-0737-4836-b894-5c9d8afb00c3"
    },
    "entraClientId": {
      "value": "YOUR_ENTRA_CLIENT_ID_HERE"
    },
    "mapboxToken": {
      "value": "YOUR_MAPBOX_TOKEN_HERE"
    }
  }
}
EOF

echo "✅ Parameters file created"
echo "⚠️  Edit infra/parameters.prod.json and add:"
echo "   - entraClientId (from Azure Entra External ID)"
echo "   - mapboxToken (from Mapbox account)"
```

#### 1.2 Edit Parameters File

```bash
# Open parameters file in your editor
nano infra/parameters.prod.json
# or
code infra/parameters.prod.json

# Update these values:
# - entraClientId: "your-actual-client-id"
# - mapboxToken: "pk.eyJ1..." (if you have one, or leave empty)
```

#### 1.3 Deploy Infrastructure

```bash
cd /Users/sackson/ain-platform

# Deploy infrastructure (this will take 60-90 minutes)
az deployment group create \
  --resource-group rg-afrixplore-msim-prod \
  --template-file infra/main.bicep \
  --parameters @infra/parameters.prod.json \
  --name ain-prod-$(date +%Y%m%d-%H%M%S) \
  --verbose

# Monitor deployment progress
az deployment group show \
  --resource-group rg-afrixplore-msim-prod \
  --name ain-prod-* \
  --query "{State:properties.provisioningState, Timestamp:properties.timestamp}"
```

**Wait for deployment to complete (60-90 minutes)** ☕☕☕

#### 1.4 Verify Infrastructure

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

### **Step 2: Configure GitHub Secrets** (10 minutes)

```bash
cd /Users/sackson/ain-platform

# Generate API keys
PROD_API_KEY=$(openssl rand -base64 32)
METRICS_API_KEY=$(openssl rand -base64 32)

echo "PROD_API_KEY: $PROD_API_KEY" >> ~/ain-prod-secrets.txt
echo "METRICS_API_KEY: $METRICS_API_KEY" >> ~/ain-prod-secrets.txt

# Create service principal for GitHub Actions (if not already exists)
az ad sp create-for-rbac \
  --name "github-actions-ain-prod" \
  --role Contributor \
  --scopes /subscriptions/e919967a-c8ff-4896-977b-360167fa1a84/resourceGroups/rg-afrixplore-msim-prod \
  --sdk-auth > azure-credentials.json

# Set GitHub secrets
gh secret set AZURE_CREDENTIALS < azure-credentials.json
gh secret set PROD_API_KEY --body "$PROD_API_KEY"
gh secret set METRICS_API_KEY --body "$METRICS_API_KEY"

# Verify secrets
gh secret list

# Clean up
rm azure-credentials.json

echo "✅ GitHub secrets configured"
```

---

### **Step 3: Run Database Migrations** (10 minutes)

```bash
# Get database connection string from Key Vault
DB_URL=$(az keyvault secret show \
  --vault-name kv-ain-prod \
  --name ain-postgresql-connection-string \
  --query value -o tsv)

# Option A: Run migrations from local machine
export DATABASE_URL="$DB_URL"
cd /Users/sackson/ain-platform
pnpm install
pnpm db:migrate

# Option B: Create Container App Job for migrations
az containerapp job create \
  --name ca-db-migrate-prod \
  --resource-group rg-afrixplore-msim-prod \
  --environment cae-ain-prod \
  --trigger-type Manual \
  --replica-timeout 1800 \
  --replica-retry-limit 1 \
  --replica-completion-count 1 \
  --parallelism 1 \
  --image cracaindev.azurecr.io/msim-api:latest \
  --cpu 0.5 \
  --memory 1Gi \
  --command "/bin/sh" "-c" "node dist/scripts/migrate.js" \
  --env-vars NODE_ENV=production AZURE_KEY_VAULT_URL=https://kv-ain-prod.vault.azure.net/ \
  --secrets database-url="$DB_URL" \
  --registry-server cracaindev.azurecr.io

# Run migration job
az containerapp job start \
  --name ca-db-migrate-prod \
  --resource-group rg-afrixplore-msim-prod

# Check migration logs
az containerapp job logs show \
  --name ca-db-migrate-prod \
  --resource-group rg-afrixplore-msim-prod
```

---

### **Step 4: Deploy Application via GitHub Actions** (30-60 minutes)

#### Option A: Deploy with GitHub CLI

```bash
cd /Users/sackson/ain-platform

# Create v1.0.0 tag (if not exists)
git tag -a v1.0.0 -m "Production Release v1.0.0 - Initial Launch"
git push origin v1.0.0

# Trigger blue-green deployment with 10% traffic
gh workflow run deploy-production-blue-green.yml \
  --field version=v1.0.0 \
  --field traffic_percentage=10

# Monitor deployment
gh run watch

# Check workflow status
gh run list --workflow=deploy-production-blue-green.yml --limit 5
```

#### Option B: Deploy via GitHub UI

1. Go to: https://github.com/Sackson-Partners/AfriXplore/actions/workflows/deploy-production-blue-green.yml
2. Click "Run workflow"
3. Select:
   - **Branch:** `main`
   - **version:** `v1.0.0`
   - **traffic_percentage:** `10`
4. Click "Run workflow"
5. Monitor progress in Actions tab

---

### **Step 5: Verify Deployment** (10 minutes)

```bash
# Get Container App URL
MSIM_URL=$(az containerapp show \
  --name ca-msim-api-prod \
  --resource-group rg-afrixplore-msim-prod \
  --query properties.configuration.ingress.fqdn -o tsv)

echo "Container App URL: https://$MSIM_URL"

# Test health endpoints
echo "Testing liveness..."
curl -s https://$MSIM_URL/health/live | jq .

echo "Testing readiness..."
curl -s https://$MSIM_URL/health/ready | jq .

# Expected output:
# {
#   "status": "ok",
#   "timestamp": "2026-07-18T...",
#   "checks": {
#     "database": "healthy"
#   }
# }

# Test API endpoint (requires PROD_API_KEY)
curl -s -H "Authorization: Bearer $PROD_API_KEY" \
  https://$MSIM_URL/mines?page=1&limit=1 | jq .

# Check metrics
curl -s -H "Authorization: Bearer $METRICS_API_KEY" \
  https://$MSIM_URL/health/metrics | jq .
```

---

### **Step 6: Monitor for 15 Minutes** (15 minutes)

```bash
# Watch logs in real-time
az containerapp logs show \
  --name ca-msim-api-prod \
  --resource-group rg-afrixplore-msim-prod \
  --follow

# Check metrics every minute
watch -n 60 "curl -s -H 'Authorization: Bearer $METRICS_API_KEY' https://$MSIM_URL/health/metrics | jq '.error_rate, .uptime'"

# Monitor in Azure Portal
open "https://portal.azure.com/#@vamosokohotmail.onmicrosoft.com/resource/subscriptions/e919967a-c8ff-4896-977b-360167fa1a84/resourceGroups/rg-afrixplore-msim-prod/overview"
```

If error rate stays < 5% for 15 minutes, proceed to increase traffic.

---

### **Step 7: Gradually Increase Traffic** (60 minutes)

```bash
# After verifying 10% traffic is healthy, increase to 25%
gh workflow run deploy-production-blue-green.yml \
  --field version=v1.0.0 \
  --field traffic_percentage=25

# Wait 15 minutes, monitor metrics
sleep 900

# Increase to 50%
gh workflow run deploy-production-blue-green.yml \
  --field version=v1.0.0 \
  --field traffic_percentage=50

# Wait 15 minutes, monitor metrics
sleep 900

# Complete cutover to 100%
gh workflow run deploy-production-blue-green.yml \
  --field version=v1.0.0 \
  --field traffic_percentage=100

echo "✅ Production deployment complete!"
```

---

## 🚨 Rollback Procedure (If Needed)

If any issues occur:

```bash
# List all revisions
az containerapp revision list \
  --name ca-msim-api-prod \
  --resource-group rg-afrixplore-msim-prod \
  --query "[].{Name:name, Active:properties.active, Traffic:properties.trafficWeight}" \
  --output table

# Rollback to previous stable revision
PREVIOUS_REVISION="<previous-revision-name>"

az containerapp ingress traffic set \
  --name ca-msim-api-prod \
  --resource-group rg-afrixplore-msim-prod \
  --revision-weight $PREVIOUS_REVISION=100

echo "✅ Rolled back to $PREVIOUS_REVISION"
```

---

## 📊 Post-Deployment Checklist

After deployment completes:

- [ ] Health checks return `{ status: "ok" }`
- [ ] Error rate < 1%
- [ ] Response time < 500ms (p95)
- [ ] Database queries < 100ms
- [ ] Application Insights shows traffic
- [ ] No errors in Container App logs
- [ ] All API endpoints responding correctly
- [ ] Monitoring alerts configured
- [ ] Backup verification completed
- [ ] Documentation updated

---

## 🎯 Quick Reference

### Key URLs
```bash
# GitHub Repository
https://github.com/Sackson-Partners/AfriXplore

# Azure Portal (Production)
https://portal.azure.com/#@vamosokohotmail.onmicrosoft.com/resource/subscriptions/e919967a-c8ff-4896-977b-360167fa1a84/resourceGroups/rg-afrixplore-msim-prod/overview

# GitHub Actions
https://github.com/Sackson-Partners/AfriXplore/actions

# Container App URL (after deployment)
https://ca-msim-api-prod.wittywater-XXXXXXXX.southafricanorth.azurecontainerapps.io
```

### Key Commands
```bash
# Check deployment status
gh run list --workflow=deploy-production-blue-green.yml --limit 1

# View logs
az containerapp logs show \
  --name ca-msim-api-prod \
  --resource-group rg-afrixplore-msim-prod \
  --tail 50

# Check health
curl https://<app-url>/health/ready

# Rollback
az containerapp ingress traffic set \
  --name ca-msim-api-prod \
  --resource-group rg-afrixplore-msim-prod \
  --revision-weight <previous-revision>=100
```

---

## ⏱️ Estimated Timeline

| Step | Duration | Status |
|------|----------|--------|
| 1. Infrastructure provisioning | 60-90 min | ⏳ Pending |
| 2. GitHub secrets configuration | 10 min | ⏳ Pending |
| 3. Database migrations | 10 min | ⏳ Pending |
| 4. Application deployment (10%) | 30 min | ⏳ Pending |
| 5. Verification | 10 min | ⏳ Pending |
| 6. Monitoring | 15 min | ⏳ Pending |
| 7. Traffic scaling (25%, 50%, 100%) | 60 min | ⏳ Pending |
| **Total** | **3-4 hours** | |

---

## 📞 Support

- **Documentation:** See `DEPLOYMENT_SUMMARY.md` for full details
- **Troubleshooting:** See `DEPLOY_TO_AZURE.md` (Section: Troubleshooting)
- **GitHub Issues:** https://github.com/Sackson-Partners/AfriXplore/issues

---

## ✅ Current Status

- ✅ All code committed to GitHub
- ✅ Azure CLI authenticated
- ✅ Production resource group exists
- ⚠️ Infrastructure needs provisioning (run Step 1)
- ⏳ Application not yet deployed

**Next Command:**
```bash
cd /Users/sackson/ain-platform/infra
# Edit parameters.prod.json with your Entra Client ID and Mapbox token
# Then run the deployment:
az deployment group create \
  --resource-group rg-afrixplore-msim-prod \
  --template-file main.bicep \
  --parameters @parameters.prod.json \
  --name ain-prod-$(date +%Y%m%d-%H%M%S)
```

---

**Last Updated:** July 18, 2026  
**Ready to deploy! 🚀**
