# Deployment Runbook

## Overview
This runbook covers the deployment process for the AIN Platform across staging and production environments.

## Pre-Deployment Checklist

### Staging Deployment
- [ ] All CI tests passing on `main` branch
- [ ] Code review approved and merged
- [ ] Database migrations tested locally
- [ ] Environment variables configured in Azure
- [ ] Staging database backed up

### Production Deployment
- [ ] Staging deployment successful and tested
- [ ] Release notes prepared
- [ ] Git tag created (format: `v1.2.3`)
- [ ] Database backup completed
- [ ] Change management ticket approved
- [ ] On-call engineer notified
- [ ] Rollback plan reviewed

---

## Staging Deployment

### Automatic Deployment
Staging deployments are triggered automatically on merge to `main` branch.

1. **Monitor GitHub Actions**
   - Navigate to: https://github.com/[org]/ain-platform/actions
   - Watch "Deploy to Staging" workflow
   - Expected duration: 10-15 minutes

2. **Verify Deployment**
   ```bash
   # Check API health
   curl https://api-staging.ain-platform.com/health

   # Check web app
   curl https://staging.ain-platform.com

   # Run smoke tests
   npm run test:smoke -- --env=staging
   ```

3. **Monitor Logs**
   ```bash
   # View API logs
   az webapp log tail --name app-ain-platform-msim-api-staging --resource-group ain-platform-rg

   # View Application Insights
   # Navigate to: Azure Portal > Application Insights > ain-platform-staging
   ```

### Troubleshooting Staging Deployment

**Issue: Deployment workflow fails**
- Check GitHub Actions logs for error details
- Common causes:
  - Azure credentials expired → Update `AZURE_CREDENTIALS` secret
  - Database migration failure → Check migration syntax
  - Build errors → Run `pnpm run build` locally

**Issue: Health check fails after deployment**
- Check application logs in Azure Portal
- Verify environment variables are set correctly
- Check database connectivity: `az postgres flexible-server show-connection-string`

---

## Production Deployment

### Manual Approval Process

1. **Create Release Tag**
   ```bash
   git checkout main
   git pull origin main
   git tag -a v1.2.3 -m "Release v1.2.3: [brief description]"
   git push origin v1.2.3
   ```

2. **Trigger Production Workflow**
   - Navigate to: https://github.com/[org]/ain-platform/actions
   - Click "Deploy to Production"
   - Click "Run workflow"
   - Enter version tag: `v1.2.3`
   - Click "Run workflow"

3. **Approve Deployment**
   - Workflow will pause at "Manual Approval Required" step
   - Review deployment plan
   - Click "Review deployments" → "Approve"
   - Deployment will continue

4. **Monitor Deployment**
   ```bash
   # Watch workflow progress
   # Expected duration: 20-30 minutes

   # Database backup completes: ~5 minutes
   # API deployments (rolling): ~10 minutes
   # Migrations run: ~2 minutes
   # Web app deployments: ~5 minutes
   # Smoke tests: ~3 minutes
   ```

5. **Verify Deployment**
   ```bash
   # Check API health
   curl https://api.ain-platform.com/health

   # Check web app
   curl https://ain-platform.com

   # Verify database migrations
   npm run migrate:status -- --env=production

   # Run full smoke test suite
   npm run test:smoke -- --env=production
   ```

6. **Monitor Production**
   - Watch Application Insights for errors (first 30 minutes)
   - Monitor Slack alerts channel
   - Check Grafana dashboards: CPU, memory, request latency
   - Review error rates in `/metrics` endpoint

---

## Rollback Procedure

### When to Rollback
- Critical bugs discovered in production
- Error rate exceeds 5%
- P50 latency exceeds 2 seconds
- Database corruption detected
- Security vulnerability introduced

### Rollback Steps

1. **Initiate Rollback**
   ```bash
   # Identify last known good version
   git tag --sort=-version:refname | head -5

   # Deploy previous version
   # Navigate to GitHub Actions > Deploy to Production
   # Enter previous version tag (e.g., v1.2.2)
   ```

2. **Rollback Database (if needed)**
   ```bash
   # Connect to Azure
   az login

   # Restore from backup
   az postgres flexible-server restore \
     --resource-group ain-platform-rg \
     --name ain-platform-prod \
     --source-server ain-platform-prod \
     --restore-point-in-time "2026-07-08T10:00:00Z"
   ```

3. **Verify Rollback**
   - Run smoke tests
   - Check error rates return to normal
   - Monitor for 15 minutes

4. **Post-Rollback**
   - Update incident ticket
   - Notify team in Slack
   - Schedule post-mortem
   - Create bug fix PR

---

## Database Migration

### Running Migrations

**Staging:**
```bash
# Migrations run automatically in workflow
# Manual trigger if needed:
npm run migrate -- --env=staging
```

**Production:**
```bash
# Migrations run automatically in workflow after API deployment
# Manual trigger if needed (use with caution):
DATABASE_URL=$PRODUCTION_DB_URL npm run migrate
```

### Rolling Back Migrations

```bash
# Rollback last migration
npm run migrate:down -- --env=production

# Check migration status
npm run migrate:status -- --env=production
```

---

## Environment Variables

### Required Secrets (GitHub Secrets)

**Azure:**
- `AZURE_CREDENTIALS` - Service principal credentials
- `AZURE_RG` - Resource group name
- `ACR_LOGIN_SERVER` - Container registry URL
- `ACR_USERNAME` - Registry username
- `ACR_PASSWORD` - Registry password

**Database:**
- `STAGING_DATABASE_URL` - Staging PostgreSQL connection string
- `PRODUCTION_DATABASE_URL` - Production PostgreSQL connection string

**Authentication:**
- `STAGING_JWT_SECRET` - Staging JWT secret (256-bit)
- `PRODUCTION_JWT_SECRET` - Production JWT secret (256-bit)

**Notifications:**
- `SLACK_WEBHOOK_URL` - Deployment notifications
- `EMAIL_USERNAME` - Email notifications sender
- `EMAIL_PASSWORD` - Email password

**API Keys:**
- `MAPBOX_TOKEN` - Mapbox API token
- `STAGING_API_TOKEN` - Staging smoke tests
- `PRODUCTION_API_TOKEN` - Production smoke tests

### Updating Secrets

```bash
# Update in GitHub
# Navigate to: Settings > Secrets > Actions > Update secret

# Update in Azure App Service
az webapp config appsettings set \
  --resource-group ain-platform-rg \
  --name app-ain-platform-msim-api-prod \
  --settings JWT_SECRET=new-secret-value
```

---

## Monitoring Post-Deployment

### Key Metrics to Watch

1. **HTTP Metrics**
   - Request rate (normal: 100-500 req/min)
   - Error rate (threshold: < 1%)
   - P95 latency (threshold: < 2s)

2. **Database Metrics**
   - Connection pool usage (threshold: < 80%)
   - Query latency (threshold: < 500ms)
   - Active connections (threshold: < 100)

3. **Resource Metrics**
   - CPU usage (threshold: < 70%)
   - Memory usage (threshold: < 80%)
   - Disk I/O (threshold: < 80%)

### Dashboards

**Grafana:** https://grafana.ain-platform.com/d/production-overview

**Azure Application Insights:**
- Navigate to: Azure Portal > Application Insights > ain-platform-prod
- View: Live Metrics, Failures, Performance

**Prometheus Metrics:**
```bash
curl https://api.ain-platform.com/metrics
```

---

## Contact Information

**On-Call Engineer:** PagerDuty rotation
**Slack Channel:** #ain-platform-deployments
**Incident Response:** #ain-platform-incidents

**Escalation:**
1. On-call engineer (PagerDuty)
2. Engineering lead (@engineering-lead)
3. CTO (@cto)
