# AfriXplore Security Policy

## Reporting a Vulnerability

Please report security vulnerabilities to: **security@afrixplore.io**

Do **not** open public GitHub issues for security vulnerabilities.

---

## Week 1 Patches Applied — 2026-04-19

| ID | Severity | Description | Status |
|----|----------|-------------|--------|
| AUTH-BYPASS-001 | 🔴 Critical | intelligence-api had no auth on /api/v1 routes | ✅ Fixed |
| AUTH-BYPASS-002 | 🔴 Critical | scout-api had no auth on /scouts and /upload routes | ✅ Fixed |
| CORS-001 | 🔴 Critical | intelligence-api CORS accepted requests from any origin | ✅ Fixed |
| MSAL-001 | 🔴 Critical | MsalProvider missing — platform-web auth context broken at runtime | ✅ Fixed |
| CVE-NEXTJS-001 | 🟠 High | Next.js 14.2.5 authorization bypass (GHSA-f82v-jwr5-mffw) + 6 HIGH CVEs | ✅ Patched to 14.2.35 |

### Notes

- `/scout/v1/ussd` is intentionally open — it is an inbound webhook from Africa's Talking (feature phone USSD sessions). Africa's Talking does not send JWTs.
- `/scout/v1/auth` is intentionally open — it is the OTP login/registration endpoint.
- CORS `ALLOWED_ORIGINS` env var must be set in Azure Container App configuration before deploying. If unset, the fallback is `https://platform.afrixplore.io` (fails closed, not open).

---

## Known Open Items — Week 2 Queue

- Rate limiting not yet implemented on any API (DoS risk)
- CORS wildcard not yet fixed on msim-api, notification-service, payment-service
- No request/response logging middleware
- Database indexes under review
- Test coverage: 0% (no tests exist)
- admin-web auth guards not yet reviewed

---

## Authentication Architecture

| User Type | Auth Provider | Protocol |
|-----------|--------------|----------|
| Subscribers (platform-web) | Azure Entra ID (`ENTRA_TENANT_ID`) | MSAL / OAuth2 |
| Scouts (mobile app) | Azure Entra CIAM (`ENTRA_SCOUT_TENANT_ID`) | Phone OTP / JWT RS256 |

All JWT validation uses RS256 with JWKS key rotation. Symmetric algorithms (HS256) are explicitly rejected.
