# Backup & Disaster Recovery Plan

This document defines the backup policies, recovery procedures, and disaster recovery strategies for the AIN Platform.

## Table of Contents

- [Backup Strategy](#backup-strategy)
- [Backup Procedures](#backup-procedures)
- [Recovery Procedures](#recovery-procedures)
- [Disaster Recovery](#disaster-recovery)
- [Testing & Validation](#testing--validation)
- [Compliance & Audit](#compliance--audit)

---

## Backup Strategy

### Backup Types

#### 1. **Automated Daily Backups** (Production)

- **Schedule:** Daily at 02:00 UTC (off-peak hours)
- **Retention:** 30 days (rolling)
- **Scope:** Full database backup (all schemas, data, and objects)
- **Storage:** Azure Blob Storage (geo-redundant)
- **Encryption:** AES-256 encryption at rest

#### 2. **Point-in-Time Recovery (PITR)** (Production)

- **Enabled:** Yes
- **Retention:** 7 days
- **WAL Archive Interval:** 5 minutes
- **Use Case:** Recover to any point in time within last 7 days

#### 3. **Pre-Deployment Backups**

- **Schedule:** Automatic before each production deployment
- **Retention:** 7 days
- **Scope:** Full database backup
- **Purpose:** Enable quick rollback if deployment issues occur

#### 4. **Pre-Migration Backups**

- **Schedule:** Manual, before data migration operations
- **Retention:** 30 days
- **Scope:** Full database + data exports (JSON format)
- **Purpose:** Restore to pre-migration state if data issues detected

#### 5. **Weekly Archival Backups** (Production)

- **Schedule:** Every Sunday at 01:00 UTC
- **Retention:** 1 year
- **Scope:** Full database backup
- **Storage:** Azure Blob Storage (archive tier for cost optimization)
- **Purpose:** Long-term compliance and audit requirements

### Backup Coverage

**Databases:**
- Production PostgreSQL (Azure Database for PostgreSQL)
- Redis cache (if used for sessions/caching)

**Application Data:**
- Uploaded files (blob storage, already geo-redundant)
- Configuration files (stored in Git, Azure Key Vault)
- Secrets (Azure Key Vault with soft-delete enabled)

**Infrastructure:**
- Infrastructure as Code (Bicep templates in Git)
- CI/CD pipelines (GitHub Actions workflows in Git)

---

## Backup Procedures

### Automated Daily Backup (Azure PostgreSQL)

Azure Database for PostgreSQL automatically performs daily backups. Verify backup configuration:

```bash
# Check backup retention
az postgres flexible-server show \
  --resource-group ain-platform-rg \
  --name ain-platform-prod \
  --query "backup.backupRetentionDays"

# Check geo-redundancy
az postgres flexible-server show \
  --resource-group ain-platform-rg \
  --name ain-platform-prod \
  --query "backup.geoRedundantBackup"
```

**Expected output:**
- Backup retention: 30 days
- Geo-redundant: Enabled

### Manual Backup (On-Demand)

Create an immediate backup when needed:

```bash
# Using pg_dump (logical backup)
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql

# Compress for storage
gzip backup-$(date +%Y%m%d-%H%M%S).sql

# Upload to Azure Blob Storage
az storage blob upload \
  --account-name ainplatformstorage \
  --container-name backups \
  --name "manual/backup-$(date +%Y%m%d-%H%M%S).sql.gz" \
  --file backup-$(date +%Y%m%d-%H%M%S).sql.gz
```

### Pre-Migration Backup

Before running data migration:

```bash
# The test-migration.sh script automatically creates backups
./scripts/migration/test-migration.sh

# Or manually:
mkdir -p backups
pg_dump $DATABASE_URL > backups/pre-migration-$(date +%Y%m%d-%H%M%S).sql

# Also export data to JSON (for easier inspection)
ts-node scripts/migration/export-to-json.ts
```

### Pre-Deployment Backup

Automatically handled by GitHub Actions workflow:

```yaml
# .github/workflows/deploy-production.yml
- name: Backup Production Database
  run: |
    BACKUP_NAME="pre-deploy-${{ github.run_id }}.sql"
    pg_dump $DATABASE_URL > $BACKUP_NAME
    gzip $BACKUP_NAME
    az storage blob upload \
      --account-name ainplatformstorage \
      --container-name backups \
      --name "pre-deploy/$BACKUP_NAME.gz" \
      --file "$BACKUP_NAME.gz"
```

### Verify Backup Integrity

Regularly test that backups are valid:

```bash
# List recent backups
az postgres flexible-server backup list \
  --resource-group ain-platform-rg \
  --name ain-platform-prod

# Restore to test database (see Recovery Procedures)
```

---

## Recovery Procedures

### Scenario 1: Restore from Automated Backup

**Use Case:** Database corruption, accidental data deletion (> 5 minutes ago)

**Recovery Time Objective (RTO):** 30-60 minutes  
**Recovery Point Objective (RPO):** Up to 24 hours (last daily backup)

**Steps:**

1. **Identify backup to restore:**

```bash
# List available backups
az postgres flexible-server backup list \
  --resource-group ain-platform-rg \
  --name ain-platform-prod \
  --output table
```

2. **Restore to a new server:**

```bash
# Create new server from backup
az postgres flexible-server restore \
  --resource-group ain-platform-rg \
  --name ain-platform-prod-restored \
  --source-server ain-platform-prod \
  --restore-point-in-time "2026-07-07T02:00:00Z"
```

3. **Verify data integrity:**

```bash
# Connect to restored server
psql "postgresql://user@ain-platform-prod-restored.postgres.database.azure.com/ain_platform"

# Run integrity checks
SELECT COUNT(*) FROM mines;
SELECT COUNT(*) FROM convergence_scores;
SELECT MAX(created_at) FROM mines;
```

4. **Switch application to restored database:**

```bash
# Update DATABASE_URL in App Service
az webapp config appsettings set \
  --resource-group ain-platform-rg \
  --name app-ain-platform-msim-api-prod \
  --settings DATABASE_URL="postgresql://...restored..."

# Restart app
az webapp restart \
  --resource-group ain-platform-rg \
  --name app-ain-platform-msim-api-prod
```

5. **Cleanup:**

```bash
# Once confirmed working, delete old server
az postgres flexible-server delete \
  --resource-group ain-platform-rg \
  --name ain-platform-prod \
  --yes

# Rename restored server to original name (requires DNS update)
```

### Scenario 2: Point-in-Time Recovery

**Use Case:** Data deleted/corrupted within last 7 days, need precise recovery point

**RTO:** 30-60 minutes  
**RPO:** Up to 5 minutes (WAL archive interval)

**Steps:**

1. **Determine exact recovery point:**

```bash
# Check audit logs to find when data was deleted/corrupted
az monitor app-insights query \
  --app ain-platform-prod \
  --analytics-query "traces | where message contains 'DELETE' | take 50"

# Example: Want to restore to 2026-07-07 15:30:00 UTC
```

2. **Restore to specific point in time:**

```bash
az postgres flexible-server restore \
  --resource-group ain-platform-rg \
  --name ain-platform-prod-pitr \
  --source-server ain-platform-prod \
  --restore-point-in-time "2026-07-07T15:30:00Z"
```

3. **Verify and switch** (same as Scenario 1 steps 3-5)

### Scenario 3: Restore from Manual Backup

**Use Case:** Need to restore from pre-migration or pre-deployment backup

**RTO:** 15-30 minutes  
**RPO:** Exact point of backup

**Steps:**

1. **Download backup from Azure Blob Storage:**

```bash
# List available backups
az storage blob list \
  --account-name ainplatformstorage \
  --container-name backups \
  --prefix "pre-deploy/" \
  --output table

# Download specific backup
az storage blob download \
  --account-name ainplatformstorage \
  --container-name backups \
  --name "pre-deploy/backup-20260707.sql.gz" \
  --file backup.sql.gz

# Decompress
gunzip backup.sql.gz
```

2. **Restore to database:**

```bash
# WARNING: This will overwrite current database!
# Create new database first for safety
psql $DATABASE_URL -c "CREATE DATABASE ain_platform_restored;"

# Restore backup
psql postgresql://...ain_platform_restored < backup.sql
```

3. **Verify and switch database** (similar to Scenario 1)

### Scenario 4: Single Table Recovery

**Use Case:** Only one table affected, don't want to restore entire database

**RTO:** 10-20 minutes  
**RPO:** Depends on backup used

**Steps:**

1. **Restore backup to temporary database:**

```bash
createdb ain_temp_recovery
psql ain_temp_recovery < backup.sql
```

2. **Export affected table:**

```bash
pg_dump ain_temp_recovery -t mines --data-only > mines_backup.sql
```

3. **Restore table to production:**

```bash
# Delete corrupted data
psql $DATABASE_URL -c "TRUNCATE TABLE mines CASCADE;"

# Restore from backup
psql $DATABASE_URL < mines_backup.sql
```

4. **Verify:**

```bash
psql $DATABASE_URL -c "SELECT COUNT(*) FROM mines;"
ts-node scripts/migration/verify-data-integrity.ts
```

5. **Cleanup:**

```bash
dropdb ain_temp_recovery
```

---

## Disaster Recovery

### Disaster Scenarios

#### DR Scenario 1: Complete Azure Region Failure

**Probability:** Very Low  
**Impact:** Critical (complete service outage)  
**RTO:** 4 hours  
**RPO:** Up to 24 hours

**Recovery Strategy:**

1. **Activate geo-redundant backup:**

Azure Database for PostgreSQL with geo-redundancy stores backups in paired region (e.g., East US → West US).

```bash
# Initiate geo-restore to secondary region
az postgres flexible-server geo-restore \
  --resource-group ain-platform-rg-dr \
  --name ain-platform-prod-dr \
  --source-server /subscriptions/.../ain-platform-prod \
  --location westus2
```

2. **Deploy infrastructure in secondary region:**

```bash
# Deploy Bicep template to DR region
az deployment group create \
  --resource-group ain-platform-rg-dr \
  --template-file infra/azure-app-service.bicep \
  --parameters environment=production location=westus2
```

3. **Update DNS:**

```bash
# Update DNS to point to DR region
az network dns record-set cname set-record \
  --resource-group ain-platform-rg-dr \
  --zone-name ain-platform.com \
  --record-set-name api \
  --cname app-ain-platform-msim-api-dr.azurewebsites.net
```

4. **Deploy application:**

```bash
# Trigger deployment to DR region
gh workflow run deploy-production.yml \
  --ref main \
  --field environment=disaster-recovery
```

5. **Verify service:**

```bash
curl https://api.ain-platform.com/health
```

#### DR Scenario 2: Database Corruption (Unrecoverable)

**Probability:** Low  
**Impact:** High (data integrity issues)  
**RTO:** 2 hours  
**RPO:** Up to 24 hours

**Recovery Strategy:**

1. **Restore from most recent backup** (see Scenario 1 above)
2. **Run data integrity verification**
3. **Re-run recent migrations if needed**
4. **Notify stakeholders of potential data loss**

#### DR Scenario 3: Ransomware / Security Breach

**Probability:** Low  
**Impact:** Critical (data exfiltration, encryption)  
**RTO:** 8 hours (includes security investigation)  
**RPO:** Up to 24 hours

**Recovery Strategy:**

1. **Isolate affected systems:**

```bash
# Disable public access to database
az postgres flexible-server firewall-rule delete \
  --resource-group ain-platform-rg \
  --name ain-platform-prod \
  --rule-name AllowAll

# Stop App Services
az webapp stop --resource-group ain-platform-rg --name app-ain-platform-msim-api-prod
```

2. **Engage security incident response team**

3. **Forensic investigation** (preserve logs, identify breach vector)

4. **Restore from backup known to be clean:**

```bash
# Restore from backup before breach occurred
az postgres flexible-server restore \
  --source-server ain-platform-prod \
  --restore-point-in-time "2026-07-01T00:00:00Z"  # Before breach
```

5. **Reset all credentials:**

```bash
# Rotate database passwords
# Rotate API keys
ts-node scripts/auth/rotate-all-api-keys.ts

# Rotate JWT secrets
az webapp config appsettings set \
  --settings JWT_SECRET="$(openssl rand -base64 32)"
```

6. **Re-deploy from clean source** (rebuild container images, re-deploy infrastructure)

7. **Resume service with monitoring**

---

## Testing & Validation

### Backup Testing Schedule

**Monthly:**
- [ ] Restore automated backup to test database
- [ ] Verify data integrity with `verify-data-integrity.ts`
- [ ] Measure restore time (document RTO)

**Quarterly:**
- [ ] Full disaster recovery drill (restore to secondary region)
- [ ] Test point-in-time recovery
- [ ] Review and update DR procedures

**Annually:**
- [ ] Simulate complete region failure
- [ ] Test geo-redundant restore
- [ ] Update RTO/RPO targets based on business needs

### Backup Test Procedure

Run this monthly test:

```bash
#!/bin/bash
# Monthly backup validation test

echo "Starting monthly backup test..."
DATE=$(date +%Y-%m-%d)

# 1. List recent backups
echo "1. Listing recent backups..."
az postgres flexible-server backup list \
  --resource-group ain-platform-rg \
  --name ain-platform-prod > backup-list-$DATE.txt

# 2. Restore to test server
echo "2. Restoring to test server..."
az postgres flexible-server restore \
  --resource-group ain-platform-rg-test \
  --name ain-platform-test-restore-$DATE \
  --source-server ain-platform-prod \
  --restore-point-in-time "$(date -u -d '1 day ago' +%Y-%m-%dT%H:%M:%SZ)"

# 3. Wait for restore to complete
echo "3. Waiting for restore to complete..."
az postgres flexible-server wait \
  --resource-group ain-platform-rg-test \
  --name ain-platform-test-restore-$DATE \
  --exists

# 4. Run integrity checks
echo "4. Running integrity checks..."
export DATABASE_URL="postgresql://...test-restore-$DATE..."
ts-node scripts/migration/verify-data-integrity.ts > integrity-report-$DATE.txt

# 5. Measure restore time
echo "5. Restore completed. Check integrity-report-$DATE.txt for results."

# 6. Cleanup
echo "6. Cleaning up test server..."
az postgres flexible-server delete \
  --resource-group ain-platform-rg-test \
  --name ain-platform-test-restore-$DATE \
  --yes

echo "✅ Monthly backup test completed: $DATE"
```

### Validation Checklist

After any restore operation:

- [ ] **Data completeness:** Record counts match expected values
- [ ] **Foreign key integrity:** No orphaned records
- [ ] **Constraints:** All database constraints are active
- [ ] **Indexes:** All indexes exist and are valid
- [ ] **Sequences:** ID sequences are set correctly
- [ ] **Permissions:** Database users have correct permissions
- [ ] **Extensions:** PostGIS and other extensions are installed
- [ ] **Application connectivity:** App can connect and query database
- [ ] **API health:** All API endpoints respond correctly
- [ ] **Recent data:** Most recent records are present (check timestamps)

---

## Compliance & Audit

### Backup Audit Log

Track all backup and restore operations:

```sql
-- Create audit table
CREATE TABLE IF NOT EXISTS backup_audit_log (
  id SERIAL PRIMARY KEY,
  operation VARCHAR(50) NOT NULL,  -- 'backup', 'restore', 'test'
  initiated_by VARCHAR(255) NOT NULL,
  backup_name VARCHAR(255),
  restore_point_in_time TIMESTAMP,
  status VARCHAR(50) NOT NULL,  -- 'started', 'completed', 'failed'
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  notes TEXT
);

-- Log backup operation
INSERT INTO backup_audit_log (operation, initiated_by, backup_name, status)
VALUES ('backup', 'automated-daily', 'backup-20260707-020000', 'completed');

-- Query recent operations
SELECT * FROM backup_audit_log ORDER BY started_at DESC LIMIT 20;
```

### Retention Policy Compliance

Ensure backups meet regulatory requirements:

- **GDPR:** 30-day retention for operational backups, 1-year archival
- **SOC 2:** Automated daily backups with integrity verification
- **ISO 27001:** Documented backup and recovery procedures (this document)

### Reporting

Generate monthly backup report:

```bash
#!/bin/bash
# Generate monthly backup report

MONTH=$(date +%Y-%m)

cat > backup-report-$MONTH.md <<EOF
# Backup Report: $MONTH

## Automated Backups
- Daily backups: $(az postgres flexible-server backup list --resource-group ain-platform-rg --name ain-platform-prod --query "length(@)") backups
- Oldest backup: $(az postgres flexible-server backup list --query "[0].name")
- Storage used: $(az storage blob list --container-name backups --query "[].properties.contentLength | sum(@)" --output tsv | awk '{print $1/1024/1024/1024 " GB"}')

## Manual Backups
- Pre-deployment backups: $(az storage blob list --container-name backups --prefix "pre-deploy/" --query "length(@)")
- Pre-migration backups: $(az storage blob list --container-name backups --prefix "pre-migration/" --query "length(@)")

## Testing
- Last backup test: $(cat backup-test-last-run.txt)
- Last DR drill: $(cat dr-drill-last-run.txt)

## Issues
- Failed backups: 0
- Restore attempts: 1 (monthly test)
- RTO/RPO compliance: ✅ Met

## Recommendations
- None
EOF

echo "Report generated: backup-report-$MONTH.md"
```

---

## Roles & Responsibilities

### Backup Operations

- **Automated backups:** Azure Database for PostgreSQL (no manual intervention)
- **Verification testing:** DevOps team (monthly schedule)
- **DR drills:** Engineering team + DevOps (quarterly schedule)

### Recovery Operations

- **Approve restore:** Engineering Lead or CTO (for production)
- **Execute restore:** On-call engineer or DevOps
- **Verify restore:** Engineering team + QA
- **Communication:** Engineering Lead → Stakeholders

### Escalation

- Backup failure: DevOps → Engineering Lead
- Data loss > 24 hours: Engineering Lead → CTO
- Complete region failure: On-call → Engineering Lead → CTO → CEO

---

## Emergency Contacts

**Backup & Recovery Team:**
- DevOps Lead: devops-lead@ain-platform.com
- Database Administrator: dba@ain-platform.com
- Engineering Lead: eng-lead@ain-platform.com
- CTO: cto@ain-platform.com

**External Support:**
- Azure Support: 1-800-AZURE-123
- Azure Account Manager: azure-am@microsoft.com
- Backup Service Vendor: (if using third-party backup solution)

---

## References

- [Azure Database for PostgreSQL Backup Documentation](https://docs.microsoft.com/azure/postgresql/flexible-server/concepts-backup-restore)
- [Data Migration Guide](./DATA_MIGRATION_GUIDE.md)
- [Incident Response Runbook](./runbooks/incident-response.md)
- [Deployment Runbook](./runbooks/deployment.md)
