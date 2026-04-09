import path from 'path';
import type { NextConfig } from 'next';

const backendApiTarget = process.env.NEXT_INTERNAL_API_PROXY_TARGET ?? 'http://127.0.0.1:3001';
const extraDevOrigins = (process.env.NEXT_ALLOWED_DEV_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(__dirname),
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  allowedDevOrigins: [
    ...new Set([
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://*.trycloudflare.com',
      '*.trycloudflare.com',
      ...extraDevOrigins,
    ]),
  ],
  async headers() {
    const isProduction = process.env.NODE_ENV === 'production';
    const scriptSrc = isProduction
      ? "script-src 'self' 'unsafe-inline' https:"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:";
    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
      { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
      {
        key: 'Content-Security-Policy',
        value:
          `default-src 'self' https: data: blob:; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; ${scriptSrc}; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; font-src 'self' data: https:; connect-src 'self' https:`,
      },
    ];
    if (isProduction) {
      securityHeaders.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains; preload',
      });
    }

    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendApiTarget}/api/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${backendApiTarget}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
