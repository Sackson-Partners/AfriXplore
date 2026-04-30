# AfriXplore — Week 2 Action Plan

**Start Date:** 2026-04-21
**Focus:** API Hardening + Database Audit + Testing Foundation

---

## Blockers — Complete BEFORE Week 2 Sprint Starts

- [ ] Add `ALLOWED_ORIGINS` to Azure Container Apps (intelligence-api + scout-api)
- [ ] Merge `audit/week1-fixes` PR and deploy to staging
- [ ] Staging smoke test: login flow, protected routes, USSD endpoint

```bash
az containerapp update \
  --name ca-intelligence-api-staging \
  --resource-group afrixplore-rg \
  --set-env-vars "ALLOWED_ORIGINS=https://platform.afrixplore.io,https://admin.afrixplore.io"

az containerapp update \
  --name ca-scout-api-staging \
  --resource-group afrixplore-rg \
  --set-env-vars "ALLOWED_ORIGINS=https://platform.afrixplore.io,https://admin.afrixplore.io"
```

---

## Day 1–2 — Rate Limiting & Structured Logging

- [ ] Install `express-rate-limit` on intelligence-api + scout-api
- [ ] Configure: 100 req/15min general, 5 req/15min on auth endpoints
- [ ] Install `pino` for structured JSON logging (replace all `console.log` calls)
- [ ] Add correlation ID middleware (`x-request-id` header — generate if missing, log with every request)
- [ ] Fix CORS wildcard on msim-api, notification-service, payment-service

---

## Day 3 — Database Audit

- [ ] Audit all SQL queries in services for missing indexes
- [ ] Fix N+1 suspected in intelligence-api clusters route
- [ ] Fix `msim-api` inline `new Pool()` — replace with singleton connection pool
- [ ] Review PostgreSQL connection pool settings (pool size vs Container App instance count)
- [ ] Review sensitive columns — confirm encryption at rest via Azure Flexible Server settings
- [ ] Fix geospatial-worker `clustering.py` status filter bug (`'submitted'` → `'pending'`)
- [ ] Fix ML pipeline `ml_pipeline.py` query bug (`r.photos` → correct join to `mineral_assessments`)

---

## Day 4 — Testing Foundation

- [ ] Write unit tests for `intelligence-api` authMiddleware (valid token, missing token, expired token, wrong audience)
- [ ] Write unit tests for `scout-api` authMiddleware (same cases)
- [ ] Write integration test: unauthenticated request to `/api/v1/clusters` → 401
- [ ] Write integration test: `/scout/v1/ussd` accessible without token → 200
- [ ] Write integration test: `/scout/v1/scouts` without token → 401
- [ ] Target: ≥60% coverage on middleware layer

---

## Day 5 — Admin Web Audit + Payment Service

- [ ] Check `admin-web` for same MsalProvider issue as platform-web
- [ ] Check `admin-web` route protection (authenticated-only routes)
- [ ] Fix MTN MoMo hardcoded sandbox URL in `payment-service/src/services/mobileMoneyService.ts`
- [ ] Add `customer.subscription.updated` handler to Stripe webhook
- [ ] Implement `notification-service/src/handlers/anomalyAlert.ts` (currently 3 TODOs, completely stubbed)

---

## Backlog (Week 3+)

- [ ] Security headers in `next.config.js` (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
- [ ] Fix `serverActions.allowedOrigins: '*.vercel.app'` — too broad, lock to specific domains
- [ ] APIM integration — Container Apps currently bypass APIM (external ingress enabled)
- [ ] PostgreSQL private endpoints (currently uses `0.0.0.0` firewall rule)
- [ ] Enable Azure AD auth on PostgreSQL
- [ ] Swagger/OpenAPI documentation for intelligence-api and scout-api
- [ ] Soft-delete columns on critical tables
- [ ] Remove dead code: `apps/platform-web/src/app/actions/createCheckout.ts`
- [ ] Build the missing dashboard page (StatsBar, AnomalyPanel, AlertInbox components exist but have no page)
