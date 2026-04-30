/** @type {import('next').NextConfig} */

const securityHeaders = [
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(self), payment=(self "https://js.stripe.com")',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Next.js requires 'unsafe-inline' for hydration; nonces via middleware can tighten this later
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.blob.core.windows.net https://*.afrixplore.io",
      "font-src 'self'",
      "connect-src 'self' https://*.afrixplore.io https://login.microsoftonline.com https://api.stripe.com https://*.blob.core.windows.net",
      "frame-src https://js.stripe.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const headerRules = [
  {
    source: '/(.*)',
    headers: securityHeaders,
  },
];

const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['*.vercel.app', 'afrixplore.com'],
    },
  },
  headers: () => headerRules,
};

module.exports = nextConfig;
