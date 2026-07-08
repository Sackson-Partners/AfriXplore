# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take the security of the AIN Platform seriously. If you discover a security vulnerability, please follow these steps:

### 1. **Do NOT Disclose Publicly**

Please do not create public GitHub issues for security vulnerabilities. This could put our users at risk.

### 2. **Report Privately**

Send your vulnerability report to: **security@ain-platform.com**

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### 3. **What to Expect**

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Critical issues within 14 days, others within 30 days

### 4. **Disclosure Policy**

- We will acknowledge your report within 48 hours
- We will keep you informed of our progress
- Once the vulnerability is fixed, we will credit you in the release notes (unless you prefer to remain anonymous)
- We request that you do not disclose the vulnerability publicly until we have released a fix

---

## Security Best Practices

### Authentication & Authorization

#### Azure Entra External ID Integration

The AIN Platform uses **Azure Entra External ID** (formerly Azure AD B2C) for authentication:

```typescript
import { verifyJWT } from '@ain/auth';

// Verify JWT token from Azure Entra
const { isValid, decoded } = await verifyJWT(token);
if (!isValid) {
  return res.status(401).json({ error: 'Invalid token' });
}
```

**Key Security Features:**
- JWT token validation with RS256 algorithm
- Token expiration enforcement
- Issuer and audience validation
- Role-based access control (RBAC)

#### Development Bypass (NOT FOR PRODUCTION)

For local development only:

```bash
# .env.local
DEV_BYPASS_AUTH=true  # NEVER use in staging or production
```

**CI/CD Protection:**
- GitHub Actions workflow checks prevent `DEV_BYPASS_AUTH=true` in staging/production
- Deployment fails if this flag is detected

### API Security

#### Rate Limiting

All API endpoints are protected by rate limiting:

```typescript
// Global rate limit: 200 requests per 15 minutes
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
}));

// Stricter limits for sensitive endpoints
app.use('/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 5 }));
app.use('/convergence', rateLimit({ windowMs: 60 * 1000, max: 10 }));
```

#### CSRF Protection

Cross-Site Request Forgery protection is enabled in production:

```typescript
import { createCSRFProtection } from '@ain/security';

// CSRF protection for state-changing operations
app.use(createCSRFProtection({
  cookie: {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
  }
}));

// Get CSRF token
app.get('/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// Client-side usage
const response = await fetch('/api/mines', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken,
  },
  body: JSON.stringify(data),
});
```

#### Request Timeout

Prevents resource exhaustion from long-running requests:

```typescript
import { createTimeoutMiddleware, TIMEOUT_PRESETS } from '@ain/security';

app.use(createTimeoutMiddleware({
  getTimeout: (req) => {
    if (req.path.startsWith('/convergence')) return TIMEOUT_PRESETS.LONG; // 2 min
    if (req.path.startsWith('/analytics')) return TIMEOUT_PRESETS.MEDIUM; // 60s
    return TIMEOUT_PRESETS.DEFAULT; // 30s
  }
}));
```

#### Circuit Breaker Pattern

Protects against cascade failures from external service outages:

```typescript
import { createOpenAICircuitBreaker } from '@ain/security';

const breaker = createOpenAICircuitBreaker(async (prompt: string) => {
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
  });
  return response.choices[0].message.content;
});

try {
  const result = await breaker.fire(prompt);
} catch (error) {
  // Circuit is open, use fallback
  console.warn('OpenAI service unavailable, using fallback');
}
```

**Circuit Breakers Configured For:**
- OpenAI API (30s timeout, 50% error threshold)
- Azure OpenAI (30s timeout, 50% error threshold)
- Azure Cognitive Search (10s timeout, 50% error threshold)
- Azure Blob Storage (15s timeout, 60% error threshold)
- Convergence Engine (2min timeout, 40% error threshold)
- GeoSwarm API (15s timeout, 50% error threshold)

### Content Security Policy (CSP)

Next.js apps are configured with strict CSP headers:

```javascript
// next.config.mjs
headers: [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://api.mapbox.com",
      "style-src 'self' 'unsafe-inline' https://api.mapbox.com",
      "img-src 'self' data: blob: https://*.mapbox.com",
      "connect-src 'self' https://api.mapbox.com wss://*.mapbox.com",
      "frame-ancestors 'none'",
    ].join('; '),
  },
]
```

**Additional Security Headers:**
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(self)`

### Database Security

#### Parameterized Queries

**Always use parameterized queries** to prevent SQL injection:

```typescript
// ✅ CORRECT: Parameterized query
const result = await pool.query(
  'SELECT * FROM mines WHERE country = $1 AND commodity = $2',
  [country, commodity]
);

// ❌ WRONG: String interpolation (SQL injection risk)
const result = await pool.query(
  `SELECT * FROM mines WHERE country = '${country}'`
);
```

#### Connection Pooling

Database connections are pooled and managed securely:

```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
});
```

#### Row-Level Security (RLS)

PostgreSQL Row-Level Security policies enforce data isolation:

```sql
-- Subscribers can only see their own data
CREATE POLICY subscriber_isolation ON mines
  FOR ALL
  TO ain_app
  USING (subscriber_id = current_setting('app.current_subscriber_id')::uuid);
```

### Secret Management

#### Environment Variables

**Never commit secrets to version control:**

```bash
# .env (gitignored)
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-here
OPENAI_API_KEY=sk-...
AZURE_CLIENT_SECRET=...
```

#### Azure Key Vault (Production)

Production secrets are stored in Azure Key Vault:

```typescript
import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';

const credential = new DefaultAzureCredential();
const client = new SecretClient(process.env.KEY_VAULT_URL!, credential);

const secret = await client.getSecret('DATABASE-URL');
process.env.DATABASE_URL = secret.value;
```

**Key Vault Configuration:**
- Soft-delete enabled (90-day retention)
- Purge protection enabled
- Access via Managed Identity
- Audit logging enabled

### API Key Management

#### Creating API Keys

```typescript
import { createAPIKey } from '@ain/auth';

const { key, id } = await createAPIKey(pool, userId, 'My API Key', 90); // 90 days
console.log('API Key:', key); // ain_live_<32-char-random>
```

**Security Features:**
- Keys are hashed with SHA-256 before storage
- Never stored in plaintext
- Expiration dates enforced
- Last used timestamp tracked
- Can be revoked at any time

#### Using API Keys

```bash
curl -H "Authorization: Bearer ain_live_..." \
  https://api.ain-platform.com/mines
```

#### Rotating API Keys

```typescript
import { rotateAPIKey } from '@ain/auth';

const { key, id } = await rotateAPIKey(pool, oldKeyId, userId, 'Rotated Key');
// Old key is revoked, new key is issued
```

### Secure Development Workflow

#### Pre-Commit Checks

Run security audit before committing:

```bash
./scripts/security-audit.sh
```

This checks for:
- Dependency vulnerabilities
- Hardcoded secrets
- SQL injection patterns
- Insecure configurations
- World-writable files

#### CI/CD Security Scans

GitHub Actions workflows include:

```yaml
- name: Security Audit
  run: pnpm audit --audit-level=high

- name: Dependency Scan
  uses: actions/dependency-review-action@v3

- name: Check for secrets
  run: ./scripts/security-audit.sh
```

#### Automated Dependency Updates

Dependabot automatically creates PRs for security updates:

```yaml
# .github/dependabot.yml
updates:
  - package-ecosystem: "npm"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
```

---

## Security Checklist for Deployments

Before deploying to production, verify:

### Authentication & Authorization
- [ ] `DEV_BYPASS_AUTH=false` (or not set)
- [ ] JWT secrets are stored in Azure Key Vault
- [ ] RBAC policies are enforced
- [ ] API keys use SHA-256 hashing

### API Security
- [ ] Rate limiting enabled
- [ ] CSRF protection enabled
- [ ] Request timeout configured
- [ ] Circuit breakers configured for external services
- [ ] `/health/metrics` endpoint is authenticated

### Headers & CSP
- [ ] Content-Security-Policy configured
- [ ] X-Frame-Options: DENY
- [ ] X-Content-Type-Options: nosniff
- [ ] Strict-Transport-Security enabled (HTTPS only)

### Database
- [ ] Connection string in Azure Key Vault
- [ ] SSL/TLS enabled
- [ ] Parameterized queries used throughout
- [ ] Row-Level Security policies active

### Secrets Management
- [ ] No secrets in code or config files
- [ ] All secrets in Azure Key Vault
- [ ] Key Vault soft-delete enabled (90 days)
- [ ] Access restricted to Managed Identity

### Monitoring & Logging
- [ ] Application Insights enabled
- [ ] Audit logging for authentication
- [ ] Error tracking (Sentry) configured
- [ ] Security events logged

### Infrastructure
- [ ] HTTPS enforced (redirect HTTP → HTTPS)
- [ ] Azure DDoS Protection enabled
- [ ] Network security groups (NSGs) configured
- [ ] Azure Front Door WAF enabled

---

## Incident Response

In the event of a security incident:

1. **Immediate Actions:**
   - Isolate affected systems
   - Preserve logs and evidence
   - Notify security@ain-platform.com

2. **Assessment:**
   - Determine scope of breach
   - Identify affected data
   - Assess ongoing risk

3. **Containment:**
   - Revoke compromised credentials
   - Apply emergency patches
   - Block malicious traffic

4. **Recovery:**
   - Restore from clean backups
   - Rotate all secrets
   - Re-deploy infrastructure

5. **Post-Incident:**
   - Root cause analysis
   - Update security policies
   - Notify affected users (if applicable)

**See [/docs/runbooks/incident-response.md](./docs/runbooks/incident-response.md) for detailed procedures.**

---

## Security Resources

- **Security Email**: security@ain-platform.com
- **Bug Bounty Program**: (To be announced)
- **Security Documentation**: `/docs/runbooks/`
- **Azure Security Center**: https://portal.azure.com
- **OWASP Top 10**: https://owasp.org/Top10/

---

## Compliance

The AIN Platform is designed to comply with:

- **GDPR** (General Data Protection Regulation)
- **SOC 2 Type II** (in progress)
- **ISO 27001** (planned)

For compliance questions, contact: compliance@ain-platform.com

---

Last Updated: 2026-07-08
