# AfriXplore

B2B2C geospatial mineral intelligence platform — transforming Africa's artisanal and small-scale miners (ASM) into a continental mineral exploration sensor network.

## Architecture

- **Backend**: Azure Container Apps (Node.js microservices + Python geospatial worker)
- **Database**: Azure PostgreSQL Flexible Server with PostGIS
- **Frontend**: Vercel (Next.js 14 — platform web + admin)
- **Mobile**: React Native / Expo (scout app + field geologist app)
- **Auth**: Microsoft Entra External ID
- **Messaging**: Azure Service Bus
- **Real-time**: Azure SignalR Service
- **IaC**: Azure Bicep
- **CI/CD**: GitHub Actions

## Monorepo Structure

```
apps/           # Frontend apps (Next.js, React Native)
services/       # Backend microservices
packages/       # Shared libraries
infrastructure/ # Bicep IaC + SQL migrations
.github/        # CI/CD workflows
```

## Getting Started

```bash
pnpm install
pnpm dev
```

## Security Status

Last audit: 2026-04-19 · Week 1 critical fixes: ✅ Complete (5 issues resolved)
See [SECURITY.md](./SECURITY.md) for full details.

## Local Development Setup

### Required environment variables

**`services/intelligence-api/.env`**
```
ENTRA_TENANT_ID=your-tenant-id
ENTRA_CLIENT_ID=your-client-id
ALLOWED_ORIGINS=http://localhost:3005
DATABASE_URL=postgresql://...
```

**`services/scout-api/.env`**
```
ENTRA_SCOUT_TENANT_ID=your-ciam-tenant-id
ENTRA_SCOUT_CLIENT_ID=your-ciam-client-id
ALLOWED_ORIGINS=http://localhost:3005
DATABASE_URL=postgresql://...
```

**`apps/platform-web/.env.local`**
```
NEXT_PUBLIC_AZURE_CLIENT_ID=your-client-id
NEXT_PUBLIC_AZURE_TENANT_ID=your-tenant-id
NEXT_PUBLIC_API_URL=http://localhost:3001
```

See each service's `.env.example` for the full variable list.

## Environment Setup

Copy `.env.example` to `.env` and fill in your Azure credentials.
