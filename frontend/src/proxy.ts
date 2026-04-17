import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const isLocalHostname = (hostname: string): boolean => {
  const normalized = hostname.toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized.endsWith('.local')
  );
};

const getRequestHostname = (request: NextRequest): string => {
  const rawHost = request.headers.get('host') || request.nextUrl.host || request.nextUrl.hostname || '';

  if (rawHost.startsWith('[')) {
    const closingBracket = rawHost.indexOf(']');
    if (closingBracket > 1) return rawHost.slice(1, closingBracket);
  }

  return rawHost.split(':')[0];
};

const isBlockedDevPath = (pathname: string): boolean => {
  if (pathname.startsWith('/__nextjs_')) return true;
  if (pathname.startsWith('/_next/webpack-hmr')) return true;
  if (/^\/_next\/static\/.+\.hot-update\.(js|json|map)$/.test(pathname)) return true;
  if (pathname.startsWith('/_next/') && pathname.endsWith('.map')) return true;
  return false;
};

const LOGIN_QUERY_DENY_KEYS = new Set([
  'password',
  'pass',
  'pwd',
  'token',
  'access_token',
  'refresh_token',
  'citizenid',
  'citizen_id',
]);

const hasSensitiveLoginQuery = (request: NextRequest): boolean => {
  if (request.nextUrl.pathname !== '/login') return false;
  const entries = request.nextUrl.searchParams.entries();
  for (const [key] of entries) {
    if (LOGIN_QUERY_DENY_KEYS.has(String(key).toLowerCase().trim())) {
      return true;
    }
  }
  return false;
};

export function proxy(request: NextRequest) {
  if (hasSensitiveLoginQuery(request)) {
    const cleanUrl = request.nextUrl.clone();
    cleanUrl.search = '';
    return NextResponse.redirect(cleanUrl, 307);
  }

  const pathname = request.nextUrl.pathname;
  const hostname = getRequestHostname(request);
  const isLocalRequest = isLocalHostname(hostname);
  const isDevRuntime = process.env.NODE_ENV !== 'production';
  const allowPublicDev = process.env.NEXT_ALLOW_PUBLIC_DEV === 'true';

  if (isBlockedDevPath(pathname) && (!isDevRuntime || (!allowPublicDev && !isLocalRequest))) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Not found',
        },
      },
      { status: 404 },
    );
  }

  if (isDevRuntime && !allowPublicDev && !isLocalRequest) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'DEV_PUBLIC_ACCESS_BLOCKED',
          message: 'Development mode is not allowed on public hosts',
        },
      },
      { status: 403 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/:path*',
};
