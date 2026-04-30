# AfriXplore — Staging Smoke Test
## Week 4 Production Readiness — Pre-Production Validation

**Environment:** staging (`*.azurecontainerapps.io` + Vercel preview)
**Date:** _______________
**Tester:** _______________
**Branch:** week4/production-readiness

---

## Pre-Test Setup

### 1. Add GitHub Actions secrets (one-time, before first deploy)

These two secrets must exist in **Settings → Secrets → Actions** before the workflow runs:

| Secret name | Value |
|---|---|
| `ALLOWED_ORIGINS` | `https://platform.afrixplore.io,https://admin.afrixplore.io` |
| `MTN_MOMO_BASE_URL` | Production MTN MoMo endpoint (not sandbox) |

### 2. Set ALLOWED_ORIGINS manually on staging Container Apps (if testing before a deploy)

```bash
for APP in ca-intelligence-api-staging ca-scout-api-staging ca-msim-api-staging ca-payment-staging; do
  az containerapp update --name "$APP" --resource-group afrixplore-rg \
    --set-env-vars "ALLOWED_ORIGINS=https://platform.afrixplore.io,https://admin.afrixplore.io"
done
```

### 3. Confirm geospatial-worker replica count (ACA scales to 0 by default)

```bash
az containerapp update --name ca-geo-worker-staging --resource-group afrixplore-rg \
  --min-replicas 1
```

---

## Test 1 — Auth Protection (intelligence-api)

| # | Request | Expected | Actual | Pass? |
|---|---------|----------|--------|-------|
| 1.1 | `GET /api/v1/clusters` — no token | `401 Unauthorized` | | |
| 1.2 | `GET /api/v1/clusters` — expired token | `401 Unauthorized` | | |
| 1.3 | `GET /api/v1/clusters` — valid Entra token | `200 OK` | | |
| 1.4 | `GET /api/v1/clusters` — malformed token | `401 Unauthorized` | | |
| 1.5 | `GET /health` — no token | `200 OK` (health open) | | |

## Test 2 — Auth Protection (scout-api)

| # | Request | Expected | Actual | Pass? |
|---|---------|----------|--------|-------|
| 2.1 | `GET /scout/v1/scouts` — no token | `401 Unauthorized` | | |
| 2.2 | `POST /scout/v1/upload` — no token | `401 Unauthorized` | | |
| 2.3 | `POST /scout/v1/auth/otp/initiate` — no token | `200/400` (open) | | |
| 2.4 | `POST /scout/v1/ussd` — no token | `200` (open, Africa's Talking) | | |
| 2.5 | `GET /scout/v1/scouts` — valid CIAM token | `200 OK` | | |

## Test 3 — Auth Protection (msim-api)

| # | Request | Expected | Actual | Pass? |
|---|---------|----------|--------|-------|
| 3.1 | `GET /api/v1/mineral-systems` — no token | `401 Unauthorized` | | |
| 3.2 | `GET /api/v1/mineral-systems` — valid Entra token | `200 OK` | | |

## Test 4 — Auth Protection (admin-web) ← Week 4 new

| # | Action | Expected | Actual | Pass? |
|---|--------|----------|--------|-------|
| 4.1 | Load admin-web homepage unauthenticated | Redirect to `/login` | | |
| 4.2 | Load any `/dashboard/*` route unauthenticated | Redirect to `/login` via middleware | | |
| 4.3 | Click Login on admin-web | Redirect to Entra login page | | |
| 4.4 | Complete login with valid Entra admin account | Redirect back, `/dashboard` renders | | |
| 4.5 | Hard refresh on `/dashboard` | Auth preserved | | |
| 4.6 | Click Logout | Session cleared, redirect to `/login` | | |

## Test 5 — CORS

| # | Request Origin | Endpoint | Expected | Actual | Pass? |
|---|---------------|----------|----------|--------|-------|
| 5.1 | `https://platform.afrixplore.io` | intelligence-api | CORS allowed | | |
| 5.2 | `https://admin.afrixplore.io` | intelligence-api | CORS allowed | | |
| 5.3 | `https://evil.com` | intelligence-api | CORS blocked (no ACAO header) | | |
| 5.4 | `http://localhost:3005` (dev with env var set) | intelligence-api | Allowed | | |

## Test 6 — Platform Web MSAL Auth

| # | Action | Expected | Actual | Pass? |
|---|--------|----------|--------|-------|
| 6.1 | Load platform-web homepage | No JS errors in console | | |
| 6.2 | Click Login button | Redirect to Entra login page | | |
| 6.3 | Complete login with valid Entra account | Redirect back, authenticated | | |
| 6.4 | Access protected dashboard page | Renders correctly | | |
| 6.5 | Hard refresh on protected page | Auth preserved (sessionStorage) | | |
| 6.6 | Click Logout | Session cleared, redirect to login | | |

## Test 7 — Zod Input Validation ← Week 4 new

| # | Request | Expected | Actual | Pass? |
|---|---------|----------|--------|-------|
| 7.1 | `GET /api/v1/clusters?min_dpi=notanumber` — valid token | `400` with `errors` array | | |
| 7.2 | `GET /api/v1/clusters?min_dpi=999` (out of 0–100 range) | `400` validation error | | |
| 7.3 | `GET /api/v1/clusters?limit=0` (below min 1) | `400` validation error | | |
| 7.4 | `GET /api/v1/mineral-systems` with valid token + valid params | `200 OK` | | |
| 7.5 | POST to any write endpoint with missing required field | `400` with field-level errors | | |

## Test 8 — Rate Limiting ← Week 4 new

| # | Action | Expected | Actual | Pass? |
|---|--------|----------|--------|-------|
| 8.1 | POST `/scout/v1/auth/otp/initiate` 6× in 15 min from same IP | 6th returns `429` | | |
| 8.2 | 429 response includes `Retry-After` header | Header present | | |
| 8.3 | `GET /api/v1/export` 11× in 1 hour (valid token) | 11th returns `429` | | |
| 8.4 | POST `/api/v1/mobile-money` 6× in 1 hour (valid token) | 6th returns `429` | | |

## Test 9 — Health Endpoints ← Week 4 new

```bash
# Run against all 5 HTTP Container Apps
for APP in ca-scout-api-staging ca-intelligence-api-staging ca-msim-api-staging ca-payment-staging ca-notification-staging; do
  FQDN=$(az containerapp show --name "$APP" --resource-group afrixplore-rg \
    --query "properties.configuration.ingress.fqdn" -o tsv)
  HTTP=$(curl -sf -o /dev/null -w "%{http_code}" "https://${FQDN}/health" --max-time 20)
  echo "$APP → $HTTP"
done
```

| # | Service | Expected | Actual | Pass? |
|---|---------|----------|--------|-------|
| 9.1 | `GET /health` — scout-api | `200 { status: "ok" }` | | |
| 9.2 | `GET /health` — intelligence-api | `200 { status: "ok" }` (incl. DB check) | | |
| 9.3 | `GET /health` — msim-api | `200 { status: "ok" }` | | |
| 9.4 | `GET /health` — payment-service | `200 { status: "ok" }` | | |
| 9.5 | `GET /health` — notification-service | `200 { status: "ok" }` | | |

## Test 10 — Azure Application Insights ← Week 4 new

| # | Check | Expected | Actual | Pass? |
|---|-------|----------|--------|-------|
| 10.1 | Make 10 requests to intelligence-api | Requests appear in App Insights Live Metrics | | |
| 10.2 | Trigger a 401 (no token) | Shows up as failed request in App Insights | | |
| 10.3 | platform-web: open browser, navigate 3 pages | Page views appear in App Insights | | |
| 10.4 | Check `APPLICATIONINSIGHTS_CONNECTION_STRING` is set on all Container Apps | No "no instrumentation key" warnings in logs | | |

## Test 11 — Key Vault Secret Loading ← Week 4 new

| # | Check | Expected | Actual | Pass? |
|---|-------|----------|--------|-------|
| 11.1 | payment-service startup logs | No "falling back to env var" warnings | | |
| 11.2 | payment-service with `NODE_ENV=production` + missing `MTN_MOMO_BASE_URL` secret | Startup fails with clear error message | | |
| 11.3 | Managed identity on Container Apps has Key Vault `Secret User` role | `az role assignment list` confirms | | |

## Test 12 — Swagger / OpenAPI Docs ← Week 4 new

| # | Check | Expected | Actual | Pass? |
|---|-------|----------|--------|-------|
| 12.1 | `GET /scout/v1/docs` (staging, `NODE_ENV != production`) | Swagger UI loads | | |
| 12.2 | `GET /api/v1/docs` on intelligence-api (staging) | Swagger UI loads | | |
| 12.3 | `GET /scout/v1/docs.json` (production) | OpenAPI JSON spec returned | | |
| 12.4 | Docs are NOT served at `/*/docs` in production (`NODE_ENV=production`) | `404` | | |

## Test 13 — Next.js App Integrity

| # | Check | Expected | Actual | Pass? |
|---|-------|----------|--------|-------|
| 13.1 | platform-web pricing page loads | `200`, Stripe table renders | | |
| 13.2 | admin-web `/login` page loads | `200`, no JS errors | | |
| 13.3 | Security headers present on platform-web | `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options` in response headers | | |
| 13.4 | Security headers present on admin-web | Same headers present | | |
| 13.5 | No `X-Powered-By: Next.js 14.2.5` in headers | Shows `14.2.35` or none | | |

## Test 14 — Regression Check

| # | Feature | Expected | Actual | Pass? |
|---|---------|----------|--------|-------|
| 14.1 | USSD flow (Africa's Talking inbound) | Returns USSD menu, no auth error | | |
| 14.2 | Scout OTP login flow | Works end-to-end without token | | |
| 14.3 | Stripe webhook delivery | `200 OK` from payment-service | | |
| 14.4 | `GET /api/v1/clusters?data_lag_days=7` — valid token | `200 OK`, parameterised INTERVAL works | | |
| 14.5 | Anomaly alert notification flow | Service Bus message → SignalR push + webhook delivery | | |

---

## Sign-off

| Item | Status |
|------|--------|
| All critical tests pass (Tests 1–9) | |
| App Insights telemetry flowing (Test 10) | |
| Key Vault secrets confirmed in production (Test 11) | |
| Rate limiting verified (Test 8) | |
| No regressions found (Test 14) | |
| `ALLOWED_ORIGINS` confirmed set in GitHub secrets + Container Apps | |
| `MTN_MOMO_BASE_URL` GitHub secret set to production endpoint | |
| Vercel MSAL env vars confirmed (platform-web + admin-web) | |
| Pill tests passing in CI | |

**Signed off by:** _______________
**Date:** _______________
**Ready for production:** YES / NO
