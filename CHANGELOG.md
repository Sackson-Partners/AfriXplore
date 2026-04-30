# AfriXplore Changelog

All notable changes are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning: [Semantic Versioning](https://semver.org/).

---

## [1.1.0] — 2026-04-20 — Security & Production Readiness Release

### 🔴 Critical Security Issues Resolved

| ID | Service | Issue | Fix |
|---|---|---|---|
| AUTH-BYPASS-001 | intelligence-api | All `/api/v1` routes unprotected | JWT middleware on all routes |
| AUTH-BYPASS-002 | scout-api | Scouts + upload routes unprotected | JWT middleware on all routes |
| AUTH-BYPASS-003 | msim-api | All routes unprotected | JWT middleware on all routes |
| CORS-001 | 5 services | Wildcard CORS `*` | Restricted to origin allowlist |
| MSAL-001 | platform-web | MsalProvider missing | Added to root layout |
| CVE-NEXTJS-001 | platform-web | Next.js 14.2.5 → 14.2.35 | Upgraded (SSRF fix) |
| DB-CRITICAL | scout-api | `rejectUnauthorized: false` | Fixed — TLS verified in prod |
| PAYMENT-ATOMIC | payment-service | Non-atomic payment + earnings | Wrapped in BEGIN/COMMIT |

### 🟠 High Severity Issues Resolved

- Rate limiting on all 5 HTTP services (auth: 5/15min, general: 100/15min)
- Stripe webhook: raw body preserved for signature verification
- MTN MoMo: startup guard blocks sandbox URL in production
- MTN MoMo: env-driven target environment (no more hardcoded strings)
- Geospatial worker: status filter `submitted` → `pending/processing`
- Geospatial worker: O(n²) distance matrix → BallTree (linear complexity)
- Geospatial worker: graceful degradation per pipeline stage

### ✨ Added

**Authentication & Authorization**
- JWT middleware (JWKS RS256) on all 5 HTTP services
- MSAL phone OTP authentication for scout-api (Azure Entra CIAM)
- Admin-web: MsalProvider, route protection middleware, login page
- Role/tier claim extraction from JWT for subscriber-tier gating

**Observability**
- `@afrixplore/telemetry`: structured JSON logging + App Insights wrapper
- Azure Application Insights on all 5 backend services (auto-collect all)
- Azure Application Insights on platform-web + admin-web (SPA tracking)
- Request correlation IDs (`x-request-id` header)
- Phone number redaction in all logs (last 4 digits masked)

**Input Validation**
- `@afrixplore/validation`: shared Zod schemas and `validateRequest` middleware
- Schemas: `AfricanPhoneSchema`, `BboxSchema`, `MoneyAmountSchema`,
  `CurrencySchema`, `PaginationSchema`, `UuidParamSchema`
- Applied to all routes across all 5 HTTP services
- 400 responses include field-level Zod error details (RFC 7807)
- USSD callback: AT-format body validated + `console.error` removed

**Secret Management**
- `@afrixplore/config`: Azure Key Vault client with Managed Identity
- 5-minute in-memory TTL cache; `invalidateSecretCache()` for rotation
- `loadSecrets()` bootstrap pattern in payment-service
- `setup-keyvault.sh`: RBAC grants for all Container App identities

**CI/CD**
- 7-job GitHub Actions pipeline:
  1. install — pnpm frozen-lockfile + cache
  2. quality — tsc + eslint + `console.*` scan + secret pattern scan
  3. security — `pnpm audit --audit-level=high` + no committed `.env`
  4. test — jest coverage + Codecov upload
  5. build — all packages + services + Next.js apps
  6. docker — matrix build for 6 services (no push) + GHA layer cache
  7. e2e — Playwright against staging, HTML report artifact
- Dependabot: weekly npm + GitHub Actions updates (grouped)

**API Documentation**
- Swagger/OpenAPI on all 5 HTTP services (`/docs` dev/staging only)
- Full `@openapi` JSDoc annotations on all routes
- BearerAuth scheme, shared Error + PaginatedResponse schemas

**Notification Service**
- Service Bus consumer: peekLock + retry + dead-letter (MAX=3)
- Graceful SIGTERM/SIGINT shutdown draining in-flight messages
- SMS stubs: `buildSuccessSMS` + `buildFailureSMS` (160-char limit)

**Testing**
- 10 unit tests for MTN MoMo config validation (100% coverage)
- Playwright E2E: auth flow, navigation, 3G performance baseline (Africa)

**Documentation**
- `docs/architecture.md`: 4 Mermaid diagrams (overview, auth flow,
  payment flow, security layers, service dependency map)

### 🔧 Infrastructure

- Docker multi-stage builds for all 6 services
- Azure Container Apps deployment with Managed Identity
- PostGIS + BallTree spatial indexing for geospatial worker

---

## [1.0.0] — Initial Release

- AfriXplore platform launch
- Multi-service monorepo (pnpm workspaces)
- Next.js 14 frontend (platform-web + admin-web)
- 5 HTTP microservices + geospatial worker + notification service
