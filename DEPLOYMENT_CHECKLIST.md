# Production Deployment Checklist - v1.0.0

## Pre-Deployment Verification

### ✅ Code Changes
- [x] All changes committed
- [x] Version tag created: v1.0.0
- [x] No uncommitted changes
- [x] Tests passing (run `pnpm test`)

### ✅ Security
- [x] Security audit passed
- [x] No critical vulnerabilities
- [x] CSRF protection enabled
- [x] CSP headers configured
- [x] Circuit breakers implemented
- [x] Request timeouts configured
- [x] Metrics endpoint secured

### ✅ Environment Variables
Before deploying, ensure these secrets are configured in:
- Azure App Service (production)
- GitHub Secrets (for workflows)

**Required Secrets:**

```bash
# Authentication
JWT_SECRET=<generate-with-openssl-rand-base64-48>
CSRF_SECRET=<generate-with-openssl-rand-base64-32>

# Monitoring
METRICS_API_KEY=<generate-with-openssl-rand-base64-32>
SENTRY_DSN=<from-sentry-project>
OTEL_EXPORTER_OTLP_ENDPOINT=<opentelemetry-endpoint>

# Azure Services
DATABASE_URL=<azure-postgresql-connection-string>
AZURE_STORAGE_CONNECTION_STRING=<azure-blob-storage>
AZURE_OPENAI_API_KEY=<azure-openai-key>
AZURE_SEARCH_API_KEY=<azure-search-key>

# Redis Cache
REDIS_HOST=<azure-redis-cache-host>
REDIS_PASSWORD=<azure-redis-password>
REDIS_TLS=true

# External APIs
OPENAI_API_KEY=<openai-api-key>
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=<mapbox-token>

# Allowed Origins (CORS)
ALLOWED_ORIGINS=https://platform.ain-platform.com,https://admin.ain-platform.com
```

### ✅ Infrastructure
- [ ] Azure resources provisioned
- [ ] Azure Container Registry accessible
- [ ] Azure App Service created
- [ ] Azure PostgreSQL configured
- [ ] Azure Redis Cache provisioned
- [ ] Azure Key Vault secrets configured
- [ ] Application Insights enabled

---

## Deployment Steps

### Step 1: Push Code and Tag

```bash
# Push commit
git push origin main

# Push tag
git push origin v1.0.0
```

**Status:** Ready to execute ⬆️

### Step 2: Verify GitHub Actions Access

Ensure GitHub has access to:
- Azure (OIDC authentication configured)
- Secrets are set in GitHub repository settings

Required GitHub Secrets:
- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `METRICS_API_KEY`
- `PROD_API_KEY`

### Step 3: Trigger Blue-Green Deployment (10% Traffic)

```bash
# Option A: Using GitHub CLI
gh workflow run deploy-production-blue-green.yml \
  --field version=v1.0.0 \
  --field traffic_percentage=10

# Option B: Via GitHub UI
# 1. Go to Actions → Deploy Production (Blue-Green)
# 2. Click "Run workflow"
# 3. Enter version: v1.0.0
# 4. Select traffic: 10
# 5. Click "Run workflow"
```

**Expected Duration:** 15-20 minutes

**Workflow Steps:**
1. ✅ Validate version tag format
2. ✅ Run security audit
3. ⏸️  Manual approval (review and approve)
4. ✅ Backup production database
5. ✅ Build Docker images (msim-api, convergence-engine, geoswarm-api)
6. ✅ Deploy to green slot
7. ✅ Wait for green slot to be ready
8. ✅ Run smoke tests on green slot
9. ✅ Route 10% traffic to green slot
10. ✅ Monitor for 5 minutes

### Step 4: Monitor Initial Deployment (10% Traffic)

**Monitor for 2-4 hours:**

```bash
# Check error rates
curl -H "Authorization: Bearer $METRICS_API_KEY" \
  https://api.ain-platform.com/health/metrics | jq '.error_rate'

# Check circuit breakers
curl -H "Authorization: Bearer $METRICS_API_KEY" \
  https://api.ain-platform.com/health/metrics | jq '.circuit_breakers'

# Check Sentry for errors
# Visit: https://sentry.io/organizations/ain-platform/issues/

# Check Application Insights
# Visit: Azure Portal → Application Insights → ain-platform-prod
```

**Success Criteria:**
- Error rate < 1%
- No open circuit breakers
- P95 latency < 500ms
- No critical errors in Sentry

### Step 5: Increase Traffic to 25%

After successful 10% monitoring:

```bash
gh workflow run deploy-production-blue-green.yml \
  --field version=v1.0.0 \
  --field traffic_percentage=25
```

**Monitor for 1-2 hours**

### Step 6: Increase Traffic to 50%

```bash
gh workflow run deploy-production-blue-green.yml \
  --field version=v1.0.0 \
  --field traffic_percentage=50
```

**Monitor for 1 hour**

### Step 7: Full Production Deployment (100%)

```bash
gh workflow run deploy-production-blue-green.yml \
  --field version=v1.0.0 \
  --field traffic_percentage=100
```

**This will:**
- Route 100% traffic to green slot
- Swap green slot to production
- Create GitHub release
- Complete deployment

**Monitor for 4-6 hours post-deployment**

---

## Post-Deployment Verification

### Health Checks

```bash
# Liveness
curl https://api.ain-platform.com/health/live

# Readiness
curl https://api.ain-platform.com/health/ready

# Metrics (requires auth)
curl -H "Authorization: Bearer $METRICS_API_KEY" \
  https://api.ain-platform.com/health/metrics
```

### Smoke Tests

```bash
# Test mines endpoint
curl -H "Authorization: Bearer $PROD_API_KEY" \
  https://api.ain-platform.com/mines?page=1&limit=10

# Test convergence endpoint
curl -H "Authorization: Bearer $PROD_API_KEY" \
  https://api.ain-platform.com/convergence/scores?limit=10

# Test search
curl -H "Authorization: Bearer $PROD_API_KEY" \
  https://api.ain-platform.com/search?q=copper
```

### CSRF Protection Test

```bash
# Get CSRF token
TOKEN=$(curl https://api.ain-platform.com/csrf-token | jq -r '.csrfToken')

# Test POST with token
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PROD_API_KEY" \
  -H "X-CSRF-Token: $TOKEN" \
  -d '{"name":"Test","country":"US","commodity":"Copper","latitude":37.5,"longitude":-122.5}' \
  https://api.ain-platform.com/mines
```

### Redis Cache Verification

Check cache hit rates in metrics endpoint or Application Insights.

---

## Rollback Procedure (If Needed)

### Automatic Rollback

The workflow automatically rolls back if:
- Green slot health check fails
- Smoke tests fail
- Error rate exceeds 5% during monitoring

### Manual Rollback

```bash
# Route all traffic back to production slot
az webapp traffic-routing clear \
  --resource-group rg-ain-prod \
  --name app-ain-platform-msim-api-prod
```

Or trigger rollback via GitHub Actions:
1. Go to failed workflow run
2. Re-run with 100% traffic to production

---

## Monitoring Dashboards

### Real-Time Monitoring

1. **Sentry:** https://sentry.io/organizations/ain-platform/issues/
   - Error tracking
   - Performance monitoring
   - User impact

2. **Application Insights:** Azure Portal
   - Request metrics
   - Dependency tracking
   - Custom metrics

3. **OpenTelemetry:** (Configure endpoint)
   - Distributed traces
   - Service map
   - Latency analysis

4. **Azure Monitor:** Azure Portal
   - Infrastructure metrics
   - Auto-scaling events
   - Resource utilization

### Alerts Configuration

Set up alerts for:
- Error rate > 5%
- P95 latency > 2s
- Circuit breaker open
- Memory > 80%
- CPU > 70%

---

## Success Criteria

### ✅ Deployment Successful If:

- [ ] All health checks passing
- [ ] Error rate < 1%
- [ ] P95 latency < 500ms
- [ ] No critical errors in Sentry
- [ ] All circuit breakers closed
- [ ] Cache hit rate > 50%
- [ ] API response times normal
- [ ] No database connection issues

### ❌ Rollback If:

- Error rate > 5%
- P95 latency > 2s
- Multiple circuit breakers open
- Database connectivity issues
- Critical errors in Sentry
- User-reported issues

---

## Communication

### Stakeholder Notification

**Before Deployment:**
- [ ] Notify engineering team (Slack: #engineering)
- [ ] Notify customer success (email)
- [ ] Update status page (optional)

**During Deployment:**
- [ ] Post updates in #deployments channel
- [ ] Monitor #incidents channel

**After Deployment:**
- [ ] Announce successful deployment
- [ ] Share metrics and performance improvements
- [ ] Thank the team

---

## Emergency Contacts

- **On-Call Engineer:** (via PagerDuty)
- **Engineering Lead:** eng-lead@ain-platform.com
- **DevOps Lead:** devops@ain-platform.com
- **CTO:** cto@ain-platform.com

---

## Next Steps After Successful Deployment

1. **Monitor for 24 hours** - Watch dashboards, error rates, performance
2. **Collect user feedback** - Any issues or improvements
3. **Performance optimization** - Based on production metrics
4. **Security hardening** - Address any production-specific concerns
5. **Documentation updates** - Update based on deployment learnings
6. **Plan v1.1.0** - Next feature release

---

**Deployment Date:** 2026-07-08  
**Deployed By:** [Your Name]  
**Version:** v1.0.0  
**Status:** 🚀 READY TO DEPLOY
