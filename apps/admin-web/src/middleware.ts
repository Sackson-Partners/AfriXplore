import { NextRequest, NextResponse } from 'next/server';

/**
 * Admin portal route protection.
 *
 * Next.js 14/15: this file is middleware.ts with export middleware().
 * Next.js 16+: rename to proxy.ts, export proxy(), config → proxyConfig.
 * Run `npx @next/codemod@latest upgrade` when upgrading Next.js.
 *
 * MSAL stores auth state in sessionStorage normally, but when
 * `storeAuthStateInCookie: true` it also sets a cookie that includes
 * the client ID in the name. We look for any `msal.*` cookie as a
 * fast liveness signal. Full token validation happens client-side
 * via MsalProvider + AuthenticatedTemplate.
 *
 * For stricter server-side validation, replace this with next-auth
 * or a custom JWT check against the Entra JWKS endpoint.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Already on the login page — let it through
  if (pathname.startsWith('/login')) {
    return NextResponse.next();
  }

  // Let Next.js internals through
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // Check for any MSAL auth cookie (set when storeAuthStateInCookie: true)
  const hasMsalCookie = Array.from(request.cookies.getAll()).some(
    (cookie) => cookie.name.startsWith('msal.')
  );

  if (!hasMsalCookie) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('returnTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
