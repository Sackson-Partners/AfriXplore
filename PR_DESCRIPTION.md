# Week 1 Emergency Security Fixes

## Summary

Resolves 6 critical and high severity issues identified in the AfriXplore full technical audit conducted 2026-04-19.

---

## Changes

### 🔴 Critical — Authentication Bypass Fixed

**intelligence-api** (`services/intelligence-api/src/index.ts`)
- All `/api/v1/*` routes were publicly accessible without authentication
- Fix: `authMiddleware` now applied at router prefix `/api/v1` before all route registrations
- Impact: Unauthorized data access to cluster analytics, export, and target data completely blocked

**scout-api** (`services/scout-api/src/middleware/auth.ts` + `src/index.ts`)
- Scout management and file upload endpoints had zero auth protection
- Fix: New CIAM JWT middleware using JWKS + RS256 validation against Entra CIAM tenant
- Protected: `/scout/v1/scouts`, `/scout/v1/upload`
- Intentionally open: `/scout/v1/auth` (OTP login), `/scout/v1/ussd` (Africa's Talking webhook — no JWT)

**msim-api** (`services/msim-api/src/middleware/auth.ts` + `src/index.ts`)
- Mineral systems API routes had zero auth protection
- Fix: New middleware (same pattern as intelligence-api) applied on `/api/v1`

### 🔴 Critical — CORS Wildcard Restricted

All 4 HTTP-serving APIs (`intelligence-api`, `scout-api`, `msim-api`, `payment-service`, `ai-inference`):
- All were using `cors()` with no origin restriction (accepts requests from any domain)
- Fix: `ALLOWED_ORIGINS` env var, comma-separated, fails closed to `https://platform.afrixplore.io`
- `notification-service`: internal Service Bus consumer only — no HTTP routes, no change needed

> ⚠️ **REQUIRED before merging:** Add `ALLOWED_ORIGINS` to all affected Azure Container Apps (see Pre-Deploy section)

### 🔴 Critical — MsalProvider Missing

**platform-web** (`apps/platform-web/src/components/Providers.tsx` + `src/app/layout.tsx`)
- `MsalProvider` was absent from the component tree — every `useMsal()` call threw at runtime
- Fix: `PublicClientApplication` instantiated at module scope; `<Providers>` wraps `<body>` in layout

### 🟠 High — Next.js CVE Patched

**platform-web + admin-web**
- `next@14.2.5` contains authorization bypass vulnerability GHSA-f82v-jwr5-mffw (CVSS Critical) + 6 HIGH CVEs
- Fix: Bumped to `next@14.2.35` in both apps

### 🔵 Chore — ESLint Hygiene

- `eslint-config-next@14.2.35` requires `@typescript-eslint/parser@^8` — installed in both apps
- `.eslintrc.json` added to `platform-web` and `admin-web` (was missing — `next lint` was broken)
- `pnpm install` now completes with 0 peer dep warnings

---

## Pre-Deploy Manual Steps Required

> ⚠️ **MUST be completed BEFORE merging to production**

```bash
# Add ALLOWED_ORIGINS to Azure Container Apps — STAGING
az containerapp update \
  --name ca-intelligence-api-staging \
  --resource-group afrixplore-rg \
  --set-env-vars "ALLOWED_ORIGINS=https://platform.afrixplore.io,https://admin.afrixplore.io"

az containerapp update \
  --name ca-scout-api-staging \
  --resource-group afrixplore-rg \
  --set-env-vars "ALLOWED_ORIGINS=https://platform.afrixplore.io,https://admin.afrixplore.io"

az containerapp update \
  --name ca-msim-api-staging \
  --resource-group afrixplore-rg \
  --set-env-vars "ALLOWED_ORIGINS=https://platform.afrixplore.io,https://admin.afrixplore.io"

az containerapp update \
  --name ca-payment-staging \
  --resource-group afrixplore-rg \
  --set-env-vars "ALLOWED_ORIGINS=https://platform.afrixplore.io,https://admin.afrixplore.io"
```

Also verify on Vercel dashboard (platform-web → Settings → Environment Variables):
- `NEXT_PUBLIC_AZURE_CLIENT_ID` ✅
- `NEXT_PUBLIC_AZURE_TENANT_ID` ✅

---

## Testing Done

- [x] TypeScript: 0 errors across all affected packages
- [x] Build: all apps/services compile successfully (next build, tsc)
- [x] Next.js 14.2.35 confirmed published on npm
- [x] ESLint: `next lint` passes clean on platform-web and admin-web (0 warnings, 0 errors)
- [x] Security: no hardcoded secrets in diff (`git diff main | grep -i secret`)
- [x] USSD bypass documented with inline comment
- [x] CORS fallback is production domain — fails closed, not open

---

## Files Changed (18 files)

| File | Change |
|------|--------|
| `services/intelligence-api/src/index.ts` | Add authMiddleware + fix CORS |
| `services/intelligence-api/.env.example` | NEW — document required env vars |
| `services/scout-api/src/middleware/auth.ts` | NEW — CIAM JWT middleware |
| `services/scout-api/src/index.ts` | Apply auth to scouts/upload, fix CORS |
| `services/scout-api/.env.example` | NEW — document required env vars |
| `services/msim-api/src/middleware/auth.ts` | NEW — subscriber JWT middleware |
| `services/msim-api/src/index.ts` | Apply auth to /api/v1, fix CORS |
| `services/msim-api/package.json` | Add jsonwebtoken + jwks-rsa |
| `services/payment-service/src/index.ts` | Fix CORS wildcard |
| `services/ai-inference/src/index.ts` | Fix CORS wildcard |
| `apps/platform-web/src/components/Providers.tsx` | NEW — MsalProvider wrapper |
| `apps/platform-web/src/app/layout.tsx` | Wrap body with Providers |
| `apps/platform-web/package.json` | next → 14.2.35, add @typescript-eslint/^8 |
| `apps/platform-web/.eslintrc.json` | NEW — ESLint config |
| `apps/admin-web/package.json` | next → 14.2.35, add @typescript-eslint/^8 |
| `apps/admin-web/.eslintrc.json` | NEW — ESLint config |
| `pnpm-lock.yaml` | Updated |
| `SECURITY.md` | NEW — security policy + patch log |
| `README.md` | Add security status + env var setup guide |
| `WEEK2_PLAN.md` | NEW — week 2 sprint plan |

---

## Reviewer Checklist

- [ ] `authMiddleware` is positioned **before** route registrations in all 3 APIs
- [ ] USSD route bypass has explanatory comment
- [ ] Stripe webhook (`/webhooks/stripe`) correctly excluded from auth in payment-service
- [ ] CORS fallback is production domain (not `*`)
- [ ] `'use client'` is line 1 in `Providers.tsx`
- [ ] `PublicClientApplication` is at **module scope** (not inside component function)
- [ ] `ALLOWED_ORIGINS` added to all affected staging Container Apps before approving
