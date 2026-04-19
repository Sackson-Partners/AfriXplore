# AfriXplore — Staging Smoke Test
## Week 1 Fixes — Pre-Production Validation

**Environment:** staging (`*.azurecontainerapps.io` + Vercel preview)
**Date:** _______________
**Tester:** _______________
**Branch:** audit/week1-fixes

---

## Pre-Test Setup

```bash
# Set ALLOWED_ORIGINS on all staging Container Apps before testing
az containerapp update --name ca-intelligence-api-staging --resource-group afrixplore-rg \
  --set-env-vars "ALLOWED_ORIGINS=https://platform.afrixplore.io,https://admin.afrixplore.io"
az containerapp update --name ca-scout-api-staging --resource-group afrixplore-rg \
  --set-env-vars "ALLOWED_ORIGINS=https://platform.afrixplore.io,https://admin.afrixplore.io"
az containerapp update --name ca-msim-api-staging --resource-group afrixplore-rg \
  --set-env-vars "ALLOWED_ORIGINS=https://platform.afrixplore.io,https://admin.afrixplore.io"
az containerapp update --name ca-payment-staging --resource-group afrixplore-rg \
  --set-env-vars "ALLOWED_ORIGINS=https://platform.afrixplore.io,https://admin.afrixplore.io"
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

## Test 4 — CORS

| # | Request Origin | Endpoint | Expected | Actual | Pass? |
|---|---------------|----------|----------|--------|-------|
| 4.1 | `https://platform.afrixplore.io` | intelligence-api | CORS allowed | | |
| 4.2 | `https://admin.afrixplore.io` | intelligence-api | CORS allowed | | |
| 4.3 | `https://evil.com` | intelligence-api | CORS blocked (no ACAO header) | | |
| 4.4 | `http://localhost:3005` (dev with env var set) | intelligence-api | Allowed | | |

## Test 5 — Platform Web MSAL Auth

| # | Action | Expected | Actual | Pass? |
|---|--------|----------|--------|-------|
| 5.1 | Load platform-web homepage | No JS errors in console | | |
| 5.2 | Click Login button | Redirect to Entra login page | | |
| 5.3 | Complete login with valid Entra account | Redirect back, authenticated | | |
| 5.4 | Access protected dashboard page | Renders correctly | | |
| 5.5 | Hard refresh on protected page | Auth preserved (sessionStorage) | | |
| 5.6 | Click Logout | Session cleared, redirect to login | | |

## Test 6 — Next.js App Integrity

| # | Check | Expected | Actual | Pass? |
|---|-------|----------|--------|-------|
| 6.1 | platform-web pricing page loads | `200`, Stripe table renders | | |
| 6.2 | admin-web homepage loads | `200`, no JS errors | | |
| 6.3 | No `X-Powered-By: Next.js 14.2.5` in headers | Shows `14.2.35` or none | | |

## Test 7 — Regression Check

| # | Feature | Expected | Actual | Pass? |
|---|---------|----------|--------|-------|
| 7.1 | USSD flow (Africa's Talking inbound) | Returns USSD menu, no auth error | | |
| 7.2 | Scout OTP login flow | Works end-to-end without token | | |
| 7.3 | Stripe webhook delivery | 200 OK from payment-service | | |
| 7.4 | Health endpoints all services | `200 { status: 'ok' }` | | |

---

## Sign-off

| Item | Status |
|------|--------|
| All critical tests pass (Tests 1–5) | |
| No regressions found | |
| `ALLOWED_ORIGINS` confirmed set in staging | |
| Vercel MSAL env vars confirmed | |

**Signed off by:** _______________
**Date:** _______________
**Ready for production:** YES / NO
