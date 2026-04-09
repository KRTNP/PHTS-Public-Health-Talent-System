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
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = forwardedHost || request.headers.get('host') || request.nextUrl.host;
  return (host || '').split(':')[0];
};

const isBlockedDevPath = (pathname: string): boolean => {
  if (pathname.startsWith('/__nextjs_')) return true;
  if (pathname.startsWith('/_next/webpack-hmr')) return true;
  if (pathname.includes('hot-update')) return true;
  if (pathname.startsWith('/_next/') && pathname.endsWith('.map')) return true;
  return false;
};

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const hostname = getRequestHostname(request);
  const isLocalRequest = isLocalHostname(hostname);
  const isDevRuntime = process.env.NODE_ENV !== 'production';
  const allowPublicDev = process.env.NEXT_ALLOW_PUBLIC_DEV === 'true';

  if (!isLocalRequest && isBlockedDevPath(pathname)) {
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
