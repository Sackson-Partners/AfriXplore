# Deployment Automation: Scheduled Ingestion

This document explains how to configure automated scheduled data ingestion for the AIN Platform.

## Overview

The scheduled ingestion script (`scripts/data-ingestion/scheduled-ingestion.ts`) pulls data from external sources and updates the database automatically. This document covers three deployment options:

1. **Linux Cron Job** (VM or on-premise)
2. **Azure Functions Timer Trigger** (recommended for Azure)
3. **GitHub Actions Scheduled Workflow**

---

## Option 1: Linux Cron Job

### Prerequisites

- Linux/Unix server with Node.js and TypeScript installed
- Database access (DATABASE_URL environment variable)
- API credentials for data sources

### Setup

1. **Install dependencies:**

```bash
cd /opt/ain-platform
npm install
```

2. **Create environment file:**

```bash
cat > /opt/ain-platform/.env.ingestion <<EOF
DATABASE_URL=postgresql://user:pass@prod-db.postgres.database.azure.com:5432/ain_platform
MSIM_ARCHIVE_ENDPOINT=https://api.msim.org/archive
MSIM_API_KEY=your-msim-api-key
GEOSWARM_ENDPOINT=https://api.geoswarm.com/reports
GEOSWARM_API_KEY=your-geoswarm-api-key
NODE_ENV=production
LOG_LEVEL=info
EOF

chmod 600 /opt/ain-platform/.env.ingestion
```

3. **Create wrapper script:**

```bash
cat > /opt/ain-platform/run-ingestion.sh <<'EOF'
#!/bin/bash

# Load environment variables
set -a
source /opt/ain-platform/.env.ingestion
set +a

# Run ingestion script
cd /opt/ain-platform
/usr/bin/ts-node scripts/data-ingestion/scheduled-ingestion.ts >> /var/log/ain-ingestion.log 2>&1

# Log completion
echo "Ingestion completed at $(date)" >> /var/log/ain-ingestion.log
EOF

chmod +x /opt/ain-platform/run-ingestion.sh
```

4. **Configure cron:**

```bash
# Edit crontab
crontab -e

# Add this line to run every night at 2 AM UTC
0 2 * * * /opt/ain-platform/run-ingestion.sh
```

### Cron Schedule Examples

```bash
# Every day at 2 AM UTC
0 2 * * * /opt/ain-platform/run-ingestion.sh

# Every 6 hours
0 */6 * * * /opt/ain-platform/run-ingestion.sh

# Monday through Friday at 3 AM
0 3 * * 1-5 /opt/ain-platform/run-ingestion.sh

# First day of every month at 1 AM
0 1 1 * * /opt/ain-platform/run-ingestion.sh
```

### Monitoring

```bash
# View ingestion logs
tail -f /var/log/ain-ingestion.log

# Check cron execution
grep CRON /var/log/syslog

# Query ingestion history
psql $DATABASE_URL -c "
  SELECT source_name, started_at, duration_ms, records_processed, records_failed
  FROM ingestion_logs
  ORDER BY started_at DESC
  LIMIT 20;
"
```

### Log Rotation

Configure logrotate to prevent logs from growing indefinitely:

```bash
cat > /etc/logrotate.d/ain-ingestion <<EOF
/var/log/ain-ingestion.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0644 root root
}
EOF
```

---

## Option 2: Azure Functions Timer Trigger (Recommended)

### Prerequisites

- Azure subscription
- Azure Functions Core Tools installed locally
- Azure CLI authenticated

### Setup

1. **Create Function App:**

```bash
# Create resource group (if not exists)
az group create --name ain-platform-rg --location eastus2

# Create storage account for function app
az storage account create \
  --name ainplatformfunctions \
  --resource-group ain-platform-rg \
  --location eastus2 \
  --sku Standard_LRS

# Create Function App (Node.js 20)
az functionapp create \
  --resource-group ain-platform-rg \
  --consumption-plan-location eastus2 \
  --runtime node \
  --runtime-version 20 \
  --functions-version 4 \
  --name ain-platform-ingestion \
  --storage-account ainplatformfunctions \
  --os-type Linux
```

2. **Configure Application Settings:**

```bash
az functionapp config appsettings set \
  --name ain-platform-ingestion \
  --resource-group ain-platform-rg \
  --settings \
    DATABASE_URL="$DATABASE_URL" \
    MSIM_ARCHIVE_ENDPOINT="$MSIM_ARCHIVE_ENDPOINT" \
    MSIM_API_KEY="$MSIM_API_KEY" \
    GEOSWARM_ENDPOINT="$GEOSWARM_ENDPOINT" \
    GEOSWARM_API_KEY="$GEOSWARM_API_KEY" \
    NODE_ENV="production" \
    LOG_LEVEL="info"
```

3. **Create Function Code:**

```bash
# Initialize function project
mkdir azure-functions && cd azure-functions
func init --worker-runtime node --language typescript

# Create timer trigger function
func new --name ScheduledIngestion --template "Timer trigger"
```

4. **Update function code:**

`azure-functions/ScheduledIngestion/index.ts`:

```typescript
import { AzureFunction, Context } from "@azure/functions";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const timerTrigger: AzureFunction = async function (
  context: Context,
  myTimer: any
): Promise<void> {
  context.log("Scheduled ingestion started:", new Date().toISOString());

  try {
    // Run the ingestion script
    const { stdout, stderr } = await execAsync(
      "ts-node ../scripts/data-ingestion/scheduled-ingestion.ts",
      {
        cwd: process.cwd(),
        env: process.env,
      }
    );

    context.log("STDOUT:", stdout);
    if (stderr) {
      context.log.warn("STDERR:", stderr);
    }

    context.log("Scheduled ingestion completed successfully");
  } catch (error) {
    context.log.error("Scheduled ingestion failed:", error);
    throw error; // Trigger Azure Functions retry
  }
};

export default timerTrigger;
```

5. **Configure schedule:**

`azure-functions/ScheduledIngestion/function.json`:

```json
{
  "bindings": [
    {
      "name": "myTimer",
      "type": "timerTrigger",
      "direction": "in",
      "schedule": "0 0 2 * * *"
    }
  ],
  "scriptFile": "../dist/ScheduledIngestion/index.js"
}
```

**Schedule format:** `{second} {minute} {hour} {day} {month} {day-of-week}`

Examples:
- `0 0 2 * * *` - Every day at 2:00 AM
- `0 0 */6 * * *` - Every 6 hours
- `0 30 1 * * *` - Every day at 1:30 AM
- `0 0 3 * * 1-5` - Monday-Friday at 3:00 AM

6. **Deploy to Azure:**

```bash
# Build TypeScript
npm run build

# Deploy
func azure functionapp publish ain-platform-ingestion
```

7. **Verify deployment:**

```bash
# Check function status
az functionapp show \
  --name ain-platform-ingestion \
  --resource-group ain-platform-rg \
  --query "state"

# View logs
az functionapp log tail \
  --name ain-platform-ingestion \
  --resource-group ain-platform-rg
```

### Monitoring Azure Functions

**Application Insights:**

Azure Functions automatically integrates with Application Insights:

```bash
# Query execution history
az monitor app-insights query \
  --app ain-platform-ingestion \
  --analytics-query "requests | where name == 'ScheduledIngestion' | take 50"

# Query failures
az monitor app-insights query \
  --app ain-platform-ingestion \
  --analytics-query "requests | where name == 'ScheduledIngestion' and success == false"
```

**Set up alerts:**

```bash
# Alert on function failures
az monitor metrics alert create \
  --name "ingestion-failures" \
  --resource-group ain-platform-rg \
  --scopes "/subscriptions/{subscription-id}/resourceGroups/ain-platform-rg/providers/Microsoft.Web/sites/ain-platform-ingestion" \
  --condition "count requests/failed > 2" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action-group-ids "/subscriptions/{subscription-id}/resourceGroups/ain-platform-rg/providers/microsoft.insights/actionGroups/ops-team"
```

---

## Option 3: GitHub Actions Scheduled Workflow

### Setup

Create `.github/workflows/scheduled-ingestion.yml`:

```yaml
name: Scheduled Data Ingestion

on:
  schedule:
    # Every day at 2:00 AM UTC (cron format: minute hour day month day-of-week)
    - cron: '0 2 * * *'
  workflow_dispatch:  # Allow manual trigger

jobs:
  ingest-data:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run ingestion script
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          MSIM_ARCHIVE_ENDPOINT: ${{ secrets.MSIM_ARCHIVE_ENDPOINT }}
          MSIM_API_KEY: ${{ secrets.MSIM_API_KEY }}
          GEOSWARM_ENDPOINT: ${{ secrets.GEOSWARM_ENDPOINT }}
          GEOSWARM_API_KEY: ${{ secrets.GEOSWARM_API_KEY }}
          NODE_ENV: production
        run: ts-node scripts/data-ingestion/scheduled-ingestion.ts

      - name: Query ingestion results
        if: always()
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: |
          psql $DATABASE_URL -c "
            SELECT source_name, records_processed, records_failed, duration_ms
            FROM ingestion_logs
            ORDER BY started_at DESC
            LIMIT 1;
          "

      - name: Notify on failure
        if: failure()
        uses: slackapi/slack-github-action@v1
        with:
          webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
          payload: |
            {
              "text": "❌ Scheduled data ingestion failed",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "Scheduled data ingestion failed. Check logs: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
                  }
                }
              ]
            }
```

### Schedule Examples

```yaml
# Every day at 2 AM UTC
- cron: '0 2 * * *'

# Every 6 hours
- cron: '0 */6 * * *'

# Monday through Friday at 3 AM
- cron: '0 3 * * 1-5'

# First day of month at 1 AM
- cron: '0 1 1 * *'

# Multiple schedules
on:
  schedule:
    - cron: '0 2 * * *'   # Daily at 2 AM
    - cron: '0 14 * * *'  # Daily at 2 PM
```

### Configure GitHub Secrets

```bash
# Add secrets via GitHub CLI
gh secret set DATABASE_URL --body "$DATABASE_URL"
gh secret set MSIM_API_KEY --body "$MSIM_API_KEY"
gh secret set GEOSWARM_API_KEY --body "$GEOSWARM_API_KEY"
gh secret set SLACK_WEBHOOK_URL --body "$SLACK_WEBHOOK_URL"

# Or via GitHub UI: Settings > Secrets and variables > Actions > New repository secret
```

### Monitoring

```bash
# List recent workflow runs
gh run list --workflow=scheduled-ingestion.yml --limit 20

# View specific run logs
gh run view <run-id> --log

# Manually trigger workflow
gh workflow run scheduled-ingestion.yml
```

---

## Comparison Matrix

| Feature | Cron Job | Azure Functions | GitHub Actions |
|---------|----------|----------------|----------------|
| **Cost** | Server cost | ~$0.20/month (1M executions free tier) | Free for public repos, included in private |
| **Setup Complexity** | Low | Medium | Low |
| **Scalability** | Manual | Auto-scales | Limited (6 hour timeout) |
| **Monitoring** | Manual logs | Application Insights | GitHub UI + logs |
| **Maintenance** | Manual updates | Auto-patching | Automatic |
| **Best For** | On-premise, VM-based | Azure-native deployments | Small-scale, simple ingestion |
| **Retries** | Manual | Built-in (5 retries) | Manual configuration |
| **Alerting** | External setup | Azure Monitor | GitHub notifications + Slack |

---

## Recommendations

### For Production

**Azure Functions (Option 2) is recommended** because:

1. **Serverless:** No server maintenance, auto-patching, auto-scaling
2. **Integrated monitoring:** Application Insights provides detailed telemetry
3. **Cost-effective:** Pay only for execution time (~$0.20/month at 1 daily execution)
4. **Reliable:** Built-in retry logic, durable execution
5. **Azure-native:** Integrates with VNet, Key Vault, Managed Identity

### For Development/Testing

**GitHub Actions (Option 3)** is suitable for:

- Testing scheduled ingestion before production
- Small-scale deployments
- Projects already using GitHub for CI/CD

### For On-Premise

**Cron Job (Option 1)** if:

- Running on-premise infrastructure
- Already have Linux servers
- Need direct database access (no cloud connectivity)

---

## Security Best Practices

### 1. **Secure Credentials**

**DO NOT hardcode credentials in scripts!**

Use:
- Azure Key Vault (for Azure Functions)
- GitHub Secrets (for GitHub Actions)
- Environment files with restricted permissions (for Cron)

### 2. **Network Security**

- Restrict database access to ingestion service IP/VNet
- Use Azure Private Link for database connectivity
- Enable SSL/TLS for all API connections

### 3. **Least Privilege**

- Create dedicated database user for ingestion with minimal permissions:

```sql
CREATE USER ingestion_service WITH PASSWORD 'secure-password';
GRANT SELECT, INSERT, UPDATE ON mines TO ingestion_service;
GRANT SELECT, INSERT, UPDATE ON archive_documents TO ingestion_service;
GRANT SELECT, INSERT, UPDATE ON scout_reports TO ingestion_service;
GRANT INSERT ON ingestion_logs TO ingestion_service;
-- Do NOT grant DELETE or DROP permissions
```

### 4. **API Key Rotation**

Rotate API keys regularly:

```bash
# Update Azure Function App settings
az functionapp config appsettings set \
  --name ain-platform-ingestion \
  --resource-group ain-platform-rg \
  --settings MSIM_API_KEY="new-rotated-key"

# Restart function app to apply changes
az functionapp restart \
  --name ain-platform-ingestion \
  --resource-group ain-platform-rg
```

---

## Troubleshooting

### Issue: Ingestion not running

**Check schedule configuration:**

```bash
# Azure Functions
az functionapp show \
  --name ain-platform-ingestion \
  --resource-group ain-platform-rg \
  --query "state"

# Cron
crontab -l

# GitHub Actions
gh workflow view scheduled-ingestion.yml
```

### Issue: Authentication failures

**Test API connectivity:**

```bash
# Test MSIM API
curl -H "Authorization: Bearer $MSIM_API_KEY" \
  $MSIM_ARCHIVE_ENDPOINT

# Test GeoSwarm API
curl -H "Authorization: Bearer $GEOSWARM_API_KEY" \
  $GEOSWARM_ENDPOINT
```

### Issue: Database connection timeouts

**Check network connectivity:**

```bash
# Test database connection
psql $DATABASE_URL -c "SELECT 1;"

# Check firewall rules (Azure)
az postgres flexible-server firewall-rule list \
  --resource-group ain-platform-rg \
  --name ain-platform-prod
```

### Issue: High failure rate

**Query ingestion logs:**

```sql
SELECT 
  source_name,
  COUNT(*) as attempts,
  SUM(CASE WHEN records_failed > 0 THEN 1 ELSE 0 END) as failures,
  AVG(duration_ms) as avg_duration_ms
FROM ingestion_logs
WHERE started_at > NOW() - INTERVAL '7 days'
GROUP BY source_name;
```

---

## Support

For issues with scheduled ingestion:

1. Check ingestion logs: `ingestion_logs` table
2. Review application logs (Function App, cron logs, GitHub Actions)
3. Verify API credentials are valid
4. Contact: engineering@ain-platform.com
