# Quick Deploy to Azure - Production

**Last Updated:** July 18, 2026  
**Target Environment:** Production (South Africa North)  
**Estimated Time:** 4-6 hours

---

## Prerequisites Checklist

Before starting, ensure you have:

```bash
# ✅ Azure CLI authenticated
az login
az account set --subscription e919967a-c8ff-4896-977b-360167fa1a84
az account show  # Verify correct subscription

# ✅ GitHub CLI authenticated
gh auth login
gh auth status

# ✅ Required Azure permissions
# - Owner or Contributor role on subscription
# - User Access Administrator (for RBAC assignments)

# ✅ GitHub repository access
gh repo view Sackson-Partners/AfriXplore
```

---

## Step 1: Provision Azure Infrastructure (60-90 minutes)

### 1.1 Create Resource Group (if not exists)

```bash
az group create \
  --name rg-afrixplore-msim-prod \
  --location southafricanorth \
  --tags \
    Environment=Production \
    Project=AIN-Platform \
    CostCenter=Mining-Intelligence
```

### 1.2 Generate Secure Passwords

```bash
# Generate secure PostgreSQL admin password
PG_PASSWORD=$(openssl rand -base64 32)
echo "PostgreSQL Password: $PG_PASSWORD" > ~/ain-prod-secrets.txt
chmod 600 ~/ain-prod-secrets.txt

# Generate secure API keys
PROD_API_KEY=$(openssl rand -base64 32)
METRICS_API_KEY=$(openssl rand -base64 32)
echo "PROD_API_KEY: $PROD_API_KEY" >> ~/ain-prod-secrets.txt
echo "METRICS_API_KEY: $METRICS_API_KEY" >> ~/ain-prod-secrets.txt
```

### 1.3 Deploy Infrastructure with Bicep

```bash
cd /Users/sackson/ain-platform/infra

# Create parameters file for production
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
      "value": "YOUR_ENTRA_TENANT_ID"
    },
    "entraClientId": {
      "value": "YOUR_ENTRA_CLIENT_ID"
    },
    "mapboxToken": {
      "value": "YOUR_MAPBOX_TOKEN"
    }
  }
}
EOF

# Deploy infrastructure (60-90 minutes)
az deployment group create \
  --resource-group rg-afrixplore-msim-prod \
  --template-file main.bicep \
  --parameters @parameters.prod.json \
  --mode Incremental \
  --name ain-prod-deployment-$(date +%Y%m%d-%H%M%S)

# Monitor deployment status
az deployment group show \
  --resource-group rg-afrixplore-msim-prod \
  --name ain-prod-deployment-* \
  --query properties.provisioningState
```

### 1.4 Verify Infrastructure

```bash
# Check Container Apps Environment
az containerapp env show \
  --name cae-ain-prod \
  --resource-group rg-afrixplore-msim-prod \
  --query "{Name:name, ProvisioningState:properties.provisioningState}"

# Check Container Apps (should be running placeholder images)
az containerapp list \
  --resource-group rg-afrixplore-msim-prod \
  --query "[].{Name:name, Status:properties.provisioningState, URL:properties.configuration.ingress.fqdn}" \
  --output table

# Check PostgreSQL
az postgres flexible-server show \
  --name psql-ain-prod \
  --resource-group rg-afrixplore-msim-prod \
  --query "{Name:name, State:state, FQDN:fullyQualifiedDomainName}"

# Check Key Vault
az keyvault show \
  --name kv-ain-prod \
  --resource-group rg-afrixplore-msim-prod \
  --query "{Name:name, VaultUri:properties.vaultUri}"
```

---

## Step 2: Configure GitHub Secrets (15 minutes)

```bash
# Add Azure credentials (if not already configured)
az ad sp create-for-rbac \
  --name "github-actions-ain-prod" \
  --role Contributor \
  --scopes /subscriptions/e919967a-c8ff-4896-977b-360167fa1a84/resourceGroups/rg-afrixplore-msim-prod \
  --sdk-auth > azure-credentials.json

gh secret set AZURE_CREDENTIALS < azure-credentials.json

# Add API keys
gh secret set PROD_API_KEY --body "$PROD_API_KEY"
gh secret set METRICS_API_KEY --body "$METRICS_API_KEY"

# Verify secrets
gh secret list

# Clean up credentials file
rm azure-credentials.json
```

---

## Step 3: Run Database Migrations (10 minutes)

### 3.1 Create Migration Job

```bash
# Get database connection string from Key Vault
DB_URL=$(az keyvault secret show \
  --vault-name kv-ain-prod \
  --name ain-postgresql-connection-string \
  --query value -o tsv)

# Create Container App Job for migrations
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
  --env-vars \
    NODE_ENV=production \
    AZURE_KEY_VAULT_URL=https://kv-ain-prod.vault.azure.net/ \
  --secrets database-url="$DB_URL" \
  --registry-server cracaindev.azurecr.io
```

### 3.2 Run Migrations

```bash
# Execute migration job
MIGRATION_JOB=$(az containerapp job start \
  --name ca-db-migrate-prod \
  --resource-group rg-afrixplore-msim-prod \
  --query name -o tsv)

# Monitor migration progress
az containerapp job execution show \
  --name ca-db-migrate-prod \
  --resource-group rg-afrixplore-msim-prod \
  --job-execution-name $MIGRATION_JOB

# Check logs
az containerapp job logs show \
  --name ca-db-migrate-prod \
  --resource-group rg-afrixplore-msim-prod \
  --job-execution-name $MIGRATION_JOB
```

---

## Step 4: Deploy Application (Blue-Green) (30-60 minutes)

### 4.1 Tag Release

```bash
cd /Users/sackson/ain-platform

# Create v1.0.0 tag (if not exists)
git tag -a v1.0.0 -m "Production Release v1.0.0 - Initial Launch"
git push origin v1.0.0

# Verify tag
git tag -l "v1.0.0"
```

### 4.2 Trigger Production Deployment (10% Traffic)

```bash
# Start blue-green deployment with 10% traffic
gh workflow run deploy-production-blue-green.yml \
  --field version=v1.0.0 \
  --field traffic_percentage=10

# Monitor deployment
gh run watch

# Check deployment status
gh run list --workflow=deploy-production-blue-green.yml --limit 1
```

### 4.3 Verify Green Revision

```bash
# Get Container App URL
MSIM_URL=$(az containerapp show \
  --name ca-msim-api-prod \
  --resource-group rg-afrixplore-msim-prod \
  --query properties.configuration.ingress.fqdn -o tsv)

# Test health endpoints
curl -s https://$MSIM_URL/health/live | jq .
curl -s https://$MSIM_URL/health/ready | jq .

# Test API endpoint (requires authentication)
curl -s -H "Authorization: Bearer $PROD_API_KEY" \
  https://$MSIM_URL/mines?page=1&limit=1 | jq .
```

### 4.4 Monitor Metrics (5 minutes)

```bash
# Check metrics endpoint (requires METRICS_API_KEY)
curl -s -H "Authorization: Bearer $METRICS_API_KEY" \
  https://$MSIM_URL/health/metrics | jq .

# Expected output:
# {
#   "status": "ok",
#   "uptime": 300,
#   "memory": { "used": 512, "total": 1024 },
#   "error_rate": 0.00,
#   "circuit_breakers": {
#     "convergence": { "state": "closed", "failures": 0 }
#   }
# }
```

### 4.5 Gradually Increase Traffic

```bash
# If 10% traffic is healthy, increase to 25%
gh workflow run deploy-production-blue-green.yml \
  --field version=v1.0.0 \
  --field traffic_percentage=25

# Wait 10 minutes, monitor error rates

# Increase to 50%
gh workflow run deploy-production-blue-green.yml \
  --field version=v1.0.0 \
  --field traffic_percentage=50

# Wait 10 minutes, monitor error rates

# Final cutover to 100%
gh workflow run deploy-production-blue-green.yml \
  --field version=v1.0.0 \
  --field traffic_percentage=100
```

---

## Step 5: Post-Deployment Verification (15 minutes)

### 5.1 Health Check Dashboard

```bash
# Check all services
for service in ca-msim-api-prod ca-geoswarm-api-prod ca-convergence-prod; do
  echo "=== $service ==="
  URL=$(az containerapp show \
    --name $service \
    --resource-group rg-afrixplore-msim-prod \
    --query properties.configuration.ingress.fqdn -o tsv 2>/dev/null || echo "not-found")
  
  if [ "$URL" != "not-found" ]; then
    curl -s https://$URL/health/ready | jq -r '.status'
  fi
done
```

### 5.2 Application Insights Query

```bash
# Get App Insights app ID
APPINSIGHTS_ID=$(az monitor app-insights component show \
  --app appi-ain-prod \
  --resource-group rg-afrixplore-msim-prod \
  --query appId -o tsv)

# Query last 1 hour of logs
az monitor app-insights query \
  --app $APPINSIGHTS_ID \
  --analytics-query "requests | where timestamp > ago(1h) | summarize count() by resultCode" \
  --output table
```

### 5.3 Database Connection Test

```bash
# Connect to PostgreSQL (requires psql client)
PG_HOST=$(az postgres flexible-server show \
  --name psql-ain-prod \
  --resource-group rg-afrixplore-msim-prod \
  --query fullyQualifiedDomainName -o tsv)

psql "postgresql://ainuser:$PG_PASSWORD@$PG_HOST/ain?sslmode=require" \
  -c "SELECT COUNT(*) FROM historical_mines;"

# Expected: 20,000+ rows
```

### 5.4 Cache Connection Test

```bash
# Test Redis connection (requires redis-cli)
REDIS_HOST=$(az redis show \
  --name stain-prod \
  --resource-group rg-afrixplore-msim-prod \
  --query hostName -o tsv 2>/dev/null || echo "not-configured")

if [ "$REDIS_HOST" != "not-configured" ]; then
  redis-cli -h $REDIS_HOST -p 6380 --tls PING
fi
```

---

## Step 6: Configure Custom Domain (Optional) (30 minutes)

### 6.1 Add Custom Domain

```bash
# Add custom domain to Container App
az containerapp hostname add \
  --name ca-msim-api-prod \
  --resource-group rg-afrixplore-msim-prod \
  --hostname api.ain-platform.com

# Bind managed certificate
az containerapp hostname bind \
  --name ca-msim-api-prod \
  --resource-group rg-afrixplore-msim-prod \
  --hostname api.ain-platform.com \
  --environment cae-ain-prod \
  --validation-method CNAME
```

### 6.2 Update DNS Records

```bash
# Get Container App FQDN
CNAME_TARGET=$(az containerapp show \
  --name ca-msim-api-prod \
  --resource-group rg-afrixplore-msim-prod \
  --query properties.configuration.ingress.fqdn -o tsv)

echo "Add CNAME record:"
echo "  Name: api"
echo "  Type: CNAME"
echo "  Value: $CNAME_TARGET"
```

---

## Step 7: Set Up Monitoring Alerts (20 minutes)

### 7.1 Create Alert Rules

```bash
# High error rate alert
az monitor metrics alert create \
  --name "ain-prod-high-error-rate" \
  --resource-group rg-afrixplore-msim-prod \
  --scopes /subscriptions/e919967a-c8ff-4896-977b-360167fa1a84/resourceGroups/rg-afrixplore-msim-prod/providers/Microsoft.App/containerApps/ca-msim-api-prod \
  --condition "avg Percentage HTTP 5xx > 5" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --description "Alert when error rate exceeds 5%"

# High response time alert
az monitor metrics alert create \
  --name "ain-prod-slow-response" \
  --resource-group rg-afrixplore-msim-prod \
  --scopes /subscriptions/e919967a-c8ff-4896-977b-360167fa1a84/resourceGroups/rg-afrixplore-msim-prod/providers/Microsoft.App/containerApps/ca-msim-api-prod \
  --condition "avg RequestDuration > 2000" \
  --window-size 10m \
  --evaluation-frequency 5m \
  --description "Alert when response time exceeds 2s"
```

### 7.2 Configure Action Group (Email/SMS)

```bash
az monitor action-group create \
  --name "ain-prod-oncall" \
  --resource-group rg-afrixplore-msim-prod \
  --short-name "ain-oncall" \
  --email-receiver \
    name="DevOps Team" \
    email-address="devops@ain-platform.com" \
  --sms-receiver \
    name="On-Call Engineer" \
    country-code="27" \
    phone-number="XXXXXXXXXX"
```

---

## Rollback Procedure (Emergency)

If deployment fails or issues are detected:

### Option 1: Automatic Rollback (Built-in)

The workflow automatically rolls back if:
- Smoke tests fail
- Error rate > 5% during monitoring period

### Option 2: Manual Rollback

```bash
# List all revisions
az containerapp revision list \
  --name ca-msim-api-prod \
  --resource-group rg-afrixplore-msim-prod \
  --query "[].{Name:name, Active:properties.active, Traffic:properties.trafficWeight}" \
  --output table

# Route 100% traffic to previous stable revision
STABLE_REVISION="ca-msim-api-prod--previous-revision"

az containerapp ingress traffic set \
  --name ca-msim-api-prod \
  --resource-group rg-afrixplore-msim-prod \
  --revision-weight $STABLE_REVISION=100 \
  --output none

# Deactivate failed revision
FAILED_REVISION="ca-msim-api-prod--green-100"

az containerapp revision deactivate \
  --name ca-msim-api-prod \
  --resource-group rg-afrixplore-msim-prod \
  --revision $FAILED_REVISION
```

---

## Troubleshooting

### Issue: Container App Not Starting

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

### Issue: Database Connection Timeout

```bash
# Check firewall rules
az postgres flexible-server firewall-rule list \
  --name psql-ain-prod \
  --resource-group rg-afrixplore-msim-prod

# Allow Container Apps subnet (if needed)
az postgres flexible-server firewall-rule create \
  --name allow-azure-services \
  --server-name psql-ain-prod \
  --resource-group rg-afrixplore-msim-prod \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

### Issue: ACR Pull Authentication Failed

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

## Post-Deployment Checklist

- [ ] All health checks returning 200 OK
- [ ] Error rate < 1%
- [ ] Response time < 500ms (p95)
- [ ] Database queries executing normally
- [ ] Cache hit rate > 80%
- [ ] Application Insights logging enabled
- [ ] Alert rules triggered (test alerts)
- [ ] Custom domain configured (if applicable)
- [ ] SSL certificate valid
- [ ] Backup verification test passed
- [ ] Rollback plan tested
- [ ] Documentation updated
- [ ] Stakeholders notified

---

## Success Criteria

✅ **Deployment is successful when:**
1. All Container Apps show "Provisioning succeeded"
2. Health checks return `{ status: "ok" }`
3. API endpoints respond correctly
4. Database queries execute in < 100ms
5. Error rate < 1%
6. Application Insights shows traffic

---

## Support Contacts

- **DevOps Team:** devops@ain-platform.com
- **On-Call Engineer:** +27-XXX-XXX-XXXX
- **Azure Support:** portal.azure.com → Support

---

**Last Updated:** July 18, 2026  
**Next Review:** Post-deployment retrospective (within 48 hours)
