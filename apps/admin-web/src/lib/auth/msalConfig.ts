import { Configuration, RedirectRequest } from '@azure/msal-browser';

export const msalConfig: Configuration = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_ADMIN_AZURE_CLIENT_ID!,
    authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_ADMIN_AZURE_TENANT_ID}`,
    redirectUri: typeof window !== 'undefined' ? window.location.origin : '/',
  },
  cache: {
    cacheLocation: 'sessionStorage',
    // Store auth state in cookie so Next.js middleware can read it for SSR redirects
    storeAuthStateInCookie: true,
  },
};

export const loginRequest: RedirectRequest = {
  scopes: ['openid', 'profile', 'email'],
};

/** The role claim value that identifies admin users in the Entra ID token. */
export const ADMIN_ROLE = process.env.NEXT_PUBLIC_ADMIN_ROLE_CLAIM ?? 'AfriXplore.Admin';
