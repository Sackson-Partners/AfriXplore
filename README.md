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

## Environment Setup

Copy `.env.example` to `.env` and fill in your Azure credentials.
