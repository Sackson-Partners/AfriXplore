# AIN Platform - Mineral Systems Intelligence

> Unlocking 80 years of colonial African mining intelligence through AI-powered data resurrection and modern drone validation.

## 🎯 Overview

The AIN Platform consists of two primary products:

### **MSIM (Mineral Systems Intelligence)**
Historical mining data platform providing AI-powered exploration targeting based on 20,000+ colonial-era African mines.

### **GeoSwarm**
Autonomous drone swarm technology for modern geophysical surveys, anomaly detection, and exploration validation.

---

## 🏗️ Architecture

This is a **pnpm monorepo** with the following structure:

```
ain-platform/
├── apps/                    # Frontend applications
│   ├── admin-web            # Admin dashboard (Next.js) - Port 3001
│   ├── platform-web         # Main MSIM platform (Next.js) - Port 3000
│   └── geoswarm-web         # GeoSwarm mission control (Next.js)
│
├── services/                # Backend microservices
│   ├── msim-api             # Express API for MSIM (Port 3002)
│   ├── geoswarm-api         # Express API for GeoSwarm (Port 3003)
│   └── convergence-engine   # Python FastAPI for ML scoring (Port 3005)
│
└── packages/                # Shared libraries
    ├── database             # PostgreSQL connection pool
    ├── auth                 # MSAL authentication middleware
    ├── types                # Shared TypeScript types
    ├── config               # Configuration management
    └── validation           # Zod validation schemas
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+ and **pnpm** 9+
- **Docker** & Docker Compose (for local PostgreSQL)
- **Azure CLI** (for cloud deployments)
- **Python 3.11+** (for convergence-engine)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd ain-platform

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env
# Edit .env with your configuration

# Start local PostgreSQL
docker-compose up -d postgres

# Run database migrations
pnpm db:migrate

# Seed initial data
pnpm db:seed
```

### Development

Start all services in development mode:

```bash
# All services concurrently
pnpm dev

# Or individual services:
pnpm --filter @ain/msim-api dev          # Backend API
pnpm --filter @ain/admin-web dev         # Admin dashboard (http://localhost:3001)
pnpm --filter @ain/platform-web dev      # Main platform (http://localhost:3000)
```

---

## 🔧 Configuration

### Environment Variables

Each service requires specific environment variables. See `.env.example` for the complete list.

**Key variables:**

```bash
# Database
AZURE_POSTGRESQL_CONNECTION_STRING=postgresql://user:pass@host:5432/ain?sslmode=require

# Authentication (Azure Entra External ID)
AZURE_ENTRA_TENANT_ID=your-tenant-id
AZURE_ENTRA_CLIENT_ID=your-client-id
AZURE_ENTRA_CLIENT_SECRET=your-client-secret

# Azure Services
AZURE_KEY_VAULT_URL=https://kv-ain-dev.vault.azure.net/
AZURE_STORAGE_ACCOUNT_NAME=staindev
AZURE_AI_SEARCH_ENDPOINT=https://srch-ain-dev.search.windows.net
AZURE_OPENAI_ENDPOINT=https://your-openai.openai.azure.com/

# Frontend
NEXT_PUBLIC_MSIM_API_URL=http://localhost:3002
NEXT_PUBLIC_MAPBOX_TOKEN=your-mapbox-token

# Development bypass (NEVER use in production)
DEV_BYPASS_AUTH=false  # Set to true only for local development
```

### Local Development with Docker

```bash
# Start PostgreSQL + PostGIS
docker-compose up -d

# Stop services
docker-compose down

# Reset database (WARNING: deletes all data)
docker-compose down -v
pnpm db:migrate
pnpm db:seed
```

---

## 📦 Building & Testing

### Build All Packages

```bash
# Build all services and apps
pnpm build

# Build specific workspace
pnpm --filter @ain/msim-api build
```

### Run Tests

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm --filter @ain/msim-api test:coverage

# Type checking
pnpm --filter @ain/msim-api typecheck
```

### Linting

```bash
# Lint all packages
pnpm lint

# Lint specific package
pnpm --filter @ain/platform-web lint
```

---

## 🚢 Deployment

### Azure Infrastructure

Infrastructure is defined in Bicep templates (`infra/main.bicep`).

```bash
# Login to Azure
az login

# Deploy infrastructure (dev environment)
az deployment group create \
  --resource-group rg-ain-dev \
  --template-file infra/main.bicep \
  --parameters @infra/parameters.dev.json

# Deploy infrastructure (production)
az deployment group create \
  --resource-group rg-ain-prod \
  --template-file infra/main.bicep \
  --parameters @infra/parameters.prod.json
```

### CI/CD Pipeline

GitHub Actions automatically deploys to staging on push to `develop` branch:

```bash
# Trigger staging deployment
git push origin develop

# Trigger production deployment (requires approval)
git push origin main
```

### Manual Deployment

```bash
# Build and push Docker images
docker build -f services/msim-api/Dockerfile -t cracaindev.azurecr.io/msim-api:latest .
docker push cracaindev.azurecr.io/msim-api:latest

# Update Container App
az containerapp update \
  --name ca-msim-api-dev \
  --resource-group rg-ain-dev \
  --image cracaindev.azurecr.io/msim-api:latest
```

---

## 🗄️ Database

### Migrations

Migrations are SQL files in `services/msim-api/migrations/`.

```bash
# Run migrations
pnpm db:migrate

# Create new migration
# Create file: services/msim-api/migrations/XXX_description.sql
# Migrations run in alphanumeric order
```

### Seed Data

```bash
# Seed MSIM data (historical mines, regions, etc.)
pnpm db:seed:msim
```

### Database Schema

**Core tables:**
- `subscribers` - User accounts
- `historical_mines` - 20,000+ colonial-era mines
- `msim_mining_records` - Extracted historical production records
- `msim_mineral_extractions` - Detailed mineral production data
- `msim_concessions` - Mining licenses and claims
- `msim_regions` - Geographic exploration regions

**GeoSwarm tables:**
- `geoswarm_survey_orders` - Survey requests
- `geoswarm_flight_missions` - Drone flight plans
- `geoswarm_geophysical_datasets` - Collected sensor data
- `geoswarm_anomalies` - AI-detected targets

---

## 🔐 Security

### Authentication

The platform uses **Azure Entra External ID** (formerly Azure AD B2C) for authentication:

- **Frontend:** MSAL React (`@azure/msal-react`)
- **Backend:** JWT verification middleware

### Development Bypass

For local development without Azure Entra setup:

```bash
# In .env (NEVER in production!)
DEV_BYPASS_AUTH=true
```

This creates a mock user:
```typescript
{ sub: 'dev', roles: ['admin'], email: 'dev@local' }
```

### Production Security

- ✅ Azure Key Vault for secrets
- ✅ Managed identities for service-to-service auth
- ✅ HTTPS only (enforced by Azure Container Apps)
- ✅ CORS restrictions
- ✅ Rate limiting (200 req/15min per IP)
- ✅ Helmet.js security headers

---

## 📊 Monitoring & Logging

### Health Checks

All services expose health check endpoints:

```bash
# Liveness probe (process running?)
curl http://localhost:3002/health/live

# Readiness probe (database connected?)
curl http://localhost:3002/health/ready

# Metrics (memory, uptime, etc.)
curl http://localhost:3002/health/metrics
```

### Application Insights

Production logs and metrics are sent to Azure Application Insights.

```bash
# View logs in Azure Portal
az monitor app-insights query \
  --app msim-api-insights \
  --analytics-query "traces | where timestamp > ago(1h)"
```

---

## 🧪 API Documentation

### MSIM API

**Base URL (dev):** `http://localhost:3002`

#### Core Endpoints

```bash
# Search mines
GET /mines?mineral=copper&region=zambia&limit=50

# Get mine details
GET /mines/:id

# Search historical records
GET /records?mine_id=:id&date_from=1940-01-01

# Get concessions
GET /concessions?region=copperbelt

# Full-text search
GET /msim-search?q=roan+antelope

# Analytics
GET /analytics/production-trends?mineral=copper&region=zambia
```

#### Document Ingestion

```bash
# Upload document for OCR + extraction
POST /archive-revival/ingest
Content-Type: multipart/form-data

{
  "file": <PDF/Image file>,
  "sourceReference": "National Archives Ref: ABC123"
}

# Response:
{
  "status": "success",
  "recordId": "rec_abc123",
  "mineId": "mine_xyz789",
  "extractedRecord": {
    "title": "Roan Antelope Monthly Production Report - June 1955",
    "confidenceScore": 0.94,
    ...
  }
}
```

### GeoSwarm API

**Base URL (dev):** `http://localhost:3003`

```bash
# Create survey order
POST /survey-orders
{
  "areaOfInterest": { "type": "Polygon", "coordinates": [...] },
  "surveyType": ["magnetics", "imagery"],
  "lineSpacing": 100,
  "requestedStartDate": "2024-08-01"
}

# Get survey status
GET /survey-orders/:id

# List flight missions
GET /flight-missions?survey_order_id=:id

# Get anomalies
GET /anomalies?mission_id=:id&confidence_min=0.8
```

---

## 🤝 Contributing

### Development Workflow

1. Create feature branch from `develop`
   ```bash
   git checkout -b feat/my-feature develop
   ```

2. Make changes and commit
   ```bash
   git add .
   git commit -m "feat(msim-api): add new endpoint for xyz"
   ```

3. Push and create PR
   ```bash
   git push origin feat/my-feature
   ```

4. PR must pass:
   - ✅ TypeScript compilation
   - ✅ Linting
   - ✅ Tests
   - ✅ Code review

### Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(scope): Add new feature
fix(scope): Fix bug
docs(scope): Update documentation
chore(scope): Update dependencies
refactor(scope): Refactor code
test(scope): Add tests
```

---

## 📚 Documentation

- **Architecture:** [docs/architecture.md](docs/architecture.md) (TODO)
- **API Reference:** [docs/api-reference.md](docs/api-reference.md) (TODO)
- **Deployment Guide:** [docs/deployment.md](docs/deployment.md) (TODO)
- **User Guide:** [docs/user-guide.md](docs/user-guide.md) (TODO)

---

## 🐛 Troubleshooting

### Common Issues

**Issue: Port already in use**
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

**Issue: Database connection failed**
```bash
# Check PostgreSQL is running
docker-compose ps

# Test connection
psql $AZURE_POSTGRESQL_CONNECTION_STRING -c "SELECT 1"
```

**Issue: Module not found**
```bash
# Clean and reinstall
rm -rf node_modules
pnpm install
```

**Issue: TypeScript compilation errors**
```bash
# Rebuild shared packages first
pnpm --filter "./packages/*" build
pnpm --filter @ain/msim-api build
```

---

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/your-org/ain-platform/issues)
- **Email:** support@ain-platform.com
- **Slack:** #ain-platform-dev

---

## 📄 License

Proprietary - All Rights Reserved

© 2024 AfriXplore Ltd.

---

## 🙏 Acknowledgments

- **Azure OpenAI** for document extraction
- **Mapbox** for geospatial visualization
- **Deck.gl** for advanced map rendering
- **PostGIS** for spatial database capabilities
