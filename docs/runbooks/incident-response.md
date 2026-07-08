# Incident Response Runbook

## Incident Severity Levels

### SEV-1: Critical (Production Down)
- **Definition:** Complete service outage, data loss, or security breach
- **Response Time:** Immediate (< 5 minutes)
- **Examples:** API returning 500s, database unavailable, authentication broken
- **Escalation:** Automatic PagerDuty alert to on-call

### SEV-2: High (Major Functionality Impaired)
- **Definition:** Significant feature broken, severe performance degradation
- **Response Time:** < 30 minutes
- **Examples:** Convergence scoring failing, search returning no results, 50%+ error rate

### SEV-3: Medium (Minor Functionality Impaired)
- **Definition:** Non-critical feature broken, affects subset of users
- **Response Time:** < 2 hours
- **Examples:** Export functionality broken, specific country filter not working

### SEV-4: Low (Cosmetic or Minor Issues)
- **Definition:** UI glitch, typo, non-blocking issue
- **Response Time:** Next business day
- **Examples:** Button misaligned, chart tooltip formatting

---

## Incident Response Process

### 1. Detection & Alerting

**Automated Alerts:**
- PagerDuty alerts for SEV-1/SEV-2
- Slack notifications in #ain-platform-incidents
- Email to engineering@ain-platform.com

**Manual Reporting:**
- User reports via support ticket
- Internal team member notice
- Monitoring dashboard observation

### 2. Initial Response (First 5 Minutes)

1. **Acknowledge Incident**
   ```bash
   # Acknowledge PagerDuty alert
   # Post in #ain-platform-incidents:
   "🚨 SEV-X incident detected: [brief description]
   Incident Commander: @your-name
   Status: Investigating"
   ```

2. **Assess Severity**
   - Is production down? → SEV-1
   - Are users significantly impacted? → SEV-2
   - Is it isolated to a feature? → SEV-3

3. **Assign Incident Commander**
   - Usually the on-call engineer
   - IC is responsible for coordination and communication

4. **Create Incident Channel**
   ```
   Slack: Create #incident-2026-07-08-api-down
   Invite: @engineering @cto @customer-success
   ```

### 3. Investigation (First 15 Minutes)

**Check Dashboards:**
```bash
# Grafana
https://grafana.ain-platform.com/d/production-overview

# Application Insights
Azure Portal > Application Insights > ain-platform-prod

# Logs
az webapp log tail --name app-ain-platform-msim-api-prod --resource-group ain-platform-rg
```

**Common Checks:**
- [ ] API health endpoints responding?
- [ ] Database connectivity OK?
- [ ] Recent deployments? (check GitHub Actions)
- [ ] Infrastructure changes? (check Azure Portal)
- [ ] Elevated error rates? (check /metrics)
- [ ] Third-party service issues? (Mapbox, Auth0)

**Diagnostic Commands:**
```bash
# Check API health
curl https://api.ain-platform.com/health

# Check database
psql $DATABASE_URL -c "SELECT 1;"

# Check recent deploys
gh api repos/{org}/ain-platform/actions/runs --jq '.workflow_runs[0:5] | .[] | {status, conclusion, created_at}'

# Check error logs
az monitor app-insights query \
  --app ain-platform-prod \
  --analytics-query "traces | where severityLevel >= 3 | take 50"
```

### 4. Communication

**Status Updates (Every 15 Minutes):**
```
Update in #incident-[name]:
"⏱️ [HH:MM] Status Update:
- Root cause: [investigating/identified/fixed]
- Impact: [X users affected, Y feature down]
- ETA: [resolution time estimate]
- Next steps: [planned actions]"
```

**External Communication:**
- If incident > 30 minutes: Update status page
- If SEV-1 > 1 hour: Email all users
- Customer Success should proactively reach out to enterprise clients

### 5. Mitigation

**Immediate Actions (Choose Applicable):**

**Rollback Deployment:**
```bash
# See deployment.md for rollback steps
# Deploy previous version via GitHub Actions
```

**Database Issues:**
```bash
# Kill long-running queries
psql $DATABASE_URL -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'active' AND query_start < NOW() - INTERVAL '5 minutes';"

# Restart database (last resort)
az postgres flexible-server restart \
  --resource-group ain-platform-rg \
  --name ain-platform-prod
```

**Scale Resources:**
```bash
# Scale up App Service
az appservice plan update \
  --resource-group ain-platform-rg \
  --name asp-ain-platform-production \
  --sku P2v3

# Scale out (more instances)
az appservice plan update \
  --resource-group ain-platform-rg \
  --name asp-ain-platform-production \
  --number-of-workers 5
```

**Toggle Feature Flag:**
```bash
# Disable problematic feature
az webapp config appsettings set \
  --resource-group ain-platform-rg \
  --name app-ain-platform-msim-api-prod \
  --settings FEATURE_CONVERGENCE_ENABLED=false
```

**Rate Limit Adjustment:**
```bash
# Temporarily increase rate limits if legitimate traffic surge
# Update in packages/security/src/rate-limit.ts
# Deploy via GitHub Actions
```

### 6. Resolution

1. **Verify Fix**
   - Run smoke tests
   - Monitor metrics for 15 minutes
   - Check error rates returned to baseline

2. **Close Incident**
   ```
   Post in #incident-[name]:
   "✅ RESOLVED [HH:MM]
   - Duration: [X hours Y minutes]
   - Root cause: [brief explanation]
   - Resolution: [what fixed it]
   - Follow-up: [post-mortem scheduled]"
   ```

3. **Update Status Page**
   - Mark incident as resolved
   - Post resolution summary

### 7. Post-Incident

**Post-Mortem (Within 48 Hours):**
- Schedule 1-hour meeting
- Document in `/docs/post-mortems/YYYY-MM-DD-[incident-name].md`
- Invite: IC, engineering team, relevant stakeholders

**Post-Mortem Template:**
```markdown
# Post-Mortem: [Incident Name]

**Date:** YYYY-MM-DD
**Severity:** SEV-X
**Duration:** X hours Y minutes
**Incident Commander:** @name

## Summary
[1-2 sentence summary]

## Timeline
- HH:MM - Incident detected
- HH:MM - Investigation started
- HH:MM - Root cause identified
- HH:MM - Fix deployed
- HH:MM - Incident resolved

## Root Cause
[Detailed technical explanation]

## Impact
- Users affected: [number or percentage]
- Features impacted: [list]
- Data loss: [yes/no, details]

## Resolution
[What fixed the issue]

## Action Items
- [ ] [Action item 1] - @owner - [due date]
- [ ] [Action item 2] - @owner - [due date]

## Lessons Learned
- What went well:
- What could be improved:
- How to prevent similar incidents:
```

---

## Common Incident Scenarios

### Scenario 1: API Returning 500 Errors

**Symptoms:**
- /health endpoint returns 500
- All API requests failing
- Error logs show database connection errors

**Diagnosis:**
```bash
# Check database connectivity
psql $DATABASE_URL -c "SELECT 1;"

# Check connection pool
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Check App Service logs
az webapp log tail --name app-ain-platform-msim-api-prod
```

**Resolution:**
- If connection pool exhausted: Restart App Service
- If database down: Check Azure PostgreSQL status, restart if needed
- If code bug: Rollback to previous version

### Scenario 2: Search Not Returning Results

**Symptoms:**
- Global search returns empty results
- API call succeeds but data is empty
- No errors in logs

**Diagnosis:**
```bash
# Test search endpoint directly
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.ain-platform.com/search?q=copper"

# Check database for data
psql $DATABASE_URL -c "SELECT COUNT(*) FROM mines;"

# Check Elasticsearch/search index (if applicable)
```

**Resolution:**
- If data exists: Rebuild search index
- If query bug: Hotfix and deploy
- If API issue: Restart service

### Scenario 3: Slow Performance / Timeouts

**Symptoms:**
- Requests taking > 5 seconds
- Users reporting sluggish UI
- Timeout errors

**Diagnosis:**
```bash
# Check P95 latency
curl https://api.ain-platform.com/metrics | grep http_request_duration

# Check database slow queries
psql $DATABASE_URL -c "SELECT query, calls, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"

# Check CPU/memory usage
az monitor metrics list \
  --resource app-ain-platform-msim-api-prod \
  --metric "CpuPercentage,MemoryPercentage"
```

**Resolution:**
- If database slow: Add missing index, optimize query
- If CPU high: Scale up or out
- If memory leak: Restart service, fix code

### Scenario 4: Authentication Failures

**Symptoms:**
- Users cannot log in
- "Invalid token" errors
- 401 Unauthorized responses

**Diagnosis:**
```bash
# Check auth service
curl https://auth.ain-platform.com/health

# Test token verification
curl -H "Authorization: Bearer $TEST_TOKEN" \
  https://api.ain-platform.com/mines?page=1

# Check JWT secret configured
az webapp config appsettings list \
  --resource-group ain-platform-rg \
  --name app-ain-platform-msim-api-prod \
  | grep JWT_SECRET
```

**Resolution:**
- If auth service down: Restart auth service
- If JWT secret changed: Revert to previous secret
- If token expired: Issue new tokens to affected users

---

## Escalation Procedures

### Level 1: On-Call Engineer
- Handles all SEV-2, SEV-3, SEV-4 incidents
- Handles SEV-1 for first 30 minutes

### Level 2: Engineering Lead
- Escalate if SEV-1 unresolved after 30 minutes
- Escalate if additional resources needed

### Level 3: CTO
- Escalate if incident duration > 2 hours
- Escalate if data loss or security breach

### External Escalation
- Azure Support: For infrastructure issues
- Third-party vendors: For service issues (Mapbox, etc.)

---

## Tools & Resources

**Monitoring:**
- Grafana: https://grafana.ain-platform.com
- Azure Portal: https://portal.azure.com
- Application Insights: Azure Portal > ain-platform-prod

**Logs:**
```bash
# Stream live logs
az webapp log tail --name app-ain-platform-msim-api-prod --resource-group ain-platform-rg

# Query Application Insights
az monitor app-insights query --app ain-platform-prod --analytics-query "traces | take 100"
```

**Communication:**
- Slack: #ain-platform-incidents
- PagerDuty: https://ain-platform.pagerduty.com
- Status Page: https://status.ain-platform.com

**Runbooks:**
- Deployment: `/docs/runbooks/deployment.md`
- Database: `/docs/runbooks/database.md`
- Troubleshooting: `/docs/runbooks/troubleshooting.md`
