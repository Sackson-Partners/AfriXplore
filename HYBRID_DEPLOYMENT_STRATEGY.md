# Hybrid Deployment Strategy - Vercel + Azure

**Architecture:** Next.js Frontends on Vercel + Express APIs on Azure Container Apps

---

## 🏗️ Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         VERCEL                                  │
│                    (Next.js Frontends)                          │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │ platform-web │  │  admin-web   │  │ geoswarm-web │        │
│  │ (Port 3000)  │  │ (Port 3001)  │  │ (Port 3004)  │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
│         │                  │                  │                │
└─────────┼──────────────────┼──────────────────┼────────────────┘
          │                  │                  │
          │                  │                  │
          └──────────────────┴──────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AZURE CONTAINER APPS                         │
│                     (Backend APIs)                              │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │  msim-api    │  │ geoswarm-api │  │ convergence  │        │
│  │ (Port 3002)  │  │ (Port 3003)  │  │ (Port 3005)  │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
│         │                  │                  │                │
└─────────┼──────────────────┼──────────────────┼────────────────┘
          │                  │                  │
          └──────────────────┴──────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AZURE DATA SERVICES                          │
│                                                                 │
│  PostgreSQL │ Key Vault │ Storage │ Service Bus                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Why This Architecture?

### Vercel for Frontends ✅
- **Optimized for Next.js** (built by same team)
- **Global Edge Network** (instant worldwide access)
- **Automatic HTTPS** and CDN
- **Preview Deployments** for every PR
- **Zero Config** deployment
- **Free for hobby/pro tiers**

### Azure Container Apps for APIs ✅
- **Backend APIs** need database/service connections
- **Long-running processes** (document ingestion)
- **Background jobs** (convergence scoring)
- **Azure-native integrations** (Key Vault, Service Bus)
- **Cost-effective** for backend workloads

---

## 📋 Deployment Checklist

### Phase 1: Azure Backend APIs ✅ IN PROGRESS
- ✅ Infrastructure provisioning (Running)
- ✅ Docker images built (ACR)
- ⏳ Container Apps deployment (Pending)
- ⏳ Database migrations (Pending)

### Phase 2: Vercel Frontends 🆕
- [ ] Link Vercel projects to GitHub repo
- [ ] Configure environment variables
- [ ] Deploy to Vercel production
- [ ] Update CORS on Azure APIs

---

## 🚀 Deployment Commands

### Deploy Backend APIs to Azure

```bash
# Already in progress!
./deployment-status.sh

# After infrastructure completes:
gh workflow run deploy-production-blue-green.yml \
  --field version=v1.0.0 \
  --field traffic_percentage=10
```

### Deploy Frontends to Vercel

```bash
# Option 1: Via GitHub Actions (Recommended)
gh workflow run deploy-vercel-production.yml \
  --field environment=production

# Option 2: Via Vercel CLI
cd apps/platform-web
vercel --prod

cd ../admin-web
vercel --prod

cd ../geoswarm-web
vercel --prod
```

---

## 🔧 Configuration

### Vercel Environment Variables

Set these in Vercel dashboard for each project:

**platform-web:**
```bash
NEXT_PUBLIC_MSIM_API_URL=https://ca-msim-api-prod.XXXXXXXX.azurecontainerapps.io
NEXT_PUBLIC_GEOSWARM_API_URL=https://ca-geoswarm-api-prod.XXXXXXXX.azurecontainerapps.io
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1...
```

**admin-web:**
```bash
NEXT_PUBLIC_MSIM_API_URL=https://ca-msim-api-prod.XXXXXXXX.azurecontainerapps.io
NEXT_PUBLIC_GEOSWARM_API_URL=https://ca-geoswarm-api-prod.XXXXXXXX.azurecontainerapps.io
```

**geoswarm-web:**
```bash
NEXT_PUBLIC_GEOSWARM_API_URL=https://ca-geoswarm-api-prod.XXXXXXXX.azurecontainerapps.io
NEXT_PUBLIC_MSIM_API_URL=https://ca-msim-api-prod.XXXXXXXX.azurecontainerapps.io
```

### Azure Container Apps CORS

Update CORS to allow Vercel domains:

```bash
# Get Container App details
az containerapp show \
  --name ca-msim-api-prod \
  --resource-group rg-afrixplore-msim-prod

# Update CORS (manual for now, will be in Bicep later)
# Add Vercel domains:
# - https://platform-web-*.vercel.app
# - https://admin-web-*.vercel.app
# - https://geoswarm-web-*.vercel.app
# - https://platform.ain-platform.com (custom domain)
# - https://admin.ain-platform.com (custom domain)
```

---

## 🔗 Linking Vercel Projects

### 1. Link to Existing Vercel Projects

```bash
cd apps/platform-web
vercel link --project=${{ secrets.VERCEL_PROJECT_PLATFORM_WEB_ID }}

cd ../admin-web
vercel link --project=${{ secrets.VERCEL_PROJECT_ADMIN_WEB_ID }}

cd ../geoswarm-web
vercel link --project=<geoswarm-project-id>
```

### 2. Or Create New Projects

```bash
# Install Vercel CLI
pnpm add -g vercel

# Login
vercel login

# Link each app
cd apps/platform-web
vercel

cd ../admin-web
vercel

cd ../geoswarm-web
vercel
```

---

## 📊 Deployment Flow

### Complete Deployment Sequence

1. **Azure Backend APIs** (30-45 min)
   ```bash
   # Infrastructure provisioning ⏳ IN PROGRESS
   ./deployment-status.sh
   
   # Deploy APIs
   gh workflow run deploy-production-blue-green.yml \
     --field version=v1.0.0 \
     --field traffic_percentage=10
   ```

2. **Vercel Frontends** (5-10 min)
   ```bash
   # Deploy all frontends
   gh workflow run deploy-vercel-production.yml \
     --field environment=production
   ```

3. **Update CORS** (5 min)
   ```bash
   # Add Vercel domains to Azure Container Apps CORS
   ```

4. **Verify** (10 min)
   ```bash
   # Test each frontend
   curl https://platform-web-*.vercel.app
   curl https://admin-web-*.vercel.app
   curl https://geoswarm-web-*.vercel.app
   ```

---

## 🎯 Benefits of Hybrid Approach

### Performance
- **Frontends:** Global Edge CDN (Vercel)
- **APIs:** Regional compute near data (Azure)
- **Database:** Single region (Azure South Africa North)

### Cost Optimization
- **Vercel:** Free for reasonable traffic
- **Azure:** Pay for backend compute only
- **Total:** ~$200-400/month (vs $800+ all-Azure)

### Developer Experience
- **Vercel:** Instant preview deployments
- **GitHub Actions:** Automated workflows
- **pnpm Monorepo:** Shared packages
- **TypeScript:** End-to-end type safety

### Scalability
- **Frontends:** Auto-scale globally (Vercel)
- **APIs:** Auto-scale regionally (Azure Container Apps)
- **Database:** Zone-redundant HA (Azure PostgreSQL)

---

## 🔍 Monitoring

### Vercel
- **Analytics:** https://vercel.com/sacksons-projects/analytics
- **Deployments:** https://vercel.com/sacksons-projects
- **Logs:** Real-time in Vercel dashboard

### Azure
- **Container Apps:** Azure Portal
- **Application Insights:** Logs & metrics
- **Database:** Performance metrics

---

## 📋 Next Steps

1. **Wait for Azure infrastructure** (~30 min remaining)
   ```bash
   ./deployment-status.sh
   ```

2. **Deploy backend APIs to Azure** (~30 min)
   ```bash
   gh workflow run deploy-production-blue-green.yml
   ```

3. **Deploy frontends to Vercel** (~10 min)
   ```bash
   gh workflow run deploy-vercel-production.yml
   ```

4. **Configure custom domains** (optional)
   - Vercel: platform.ain-platform.com
   - Vercel: admin.ain-platform.com
   - Vercel: geoswarm.ain-platform.com

---

## 🎉 Summary

**Best of Both Worlds:**
- ✅ Next.js on Vercel (optimized for frontend)
- ✅ APIs on Azure (close to data, enterprise features)
- ✅ Cost-effective (~50% cheaper than all-Azure)
- ✅ Best performance (global CDN + regional compute)
- ✅ Easy deployments (GitHub Actions)

**Your Deployment:**
- Backend APIs: ⏳ Deploying to Azure Container Apps
- Frontends: 🆕 Ready to deploy to Vercel
- Total Time: ~1 hour remaining

---

**View Deployments:**
- Vercel: https://vercel.com/sacksons-projects
- Azure: https://portal.azure.com

**GitHub Workflows:**
- Backend: `.github/workflows/deploy-production-blue-green.yml`
- Frontend: `.github/workflows/deploy-vercel-production.yml`
