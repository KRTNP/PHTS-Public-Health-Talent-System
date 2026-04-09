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
  allowedDevOrigins: [
    ...new Set([
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://*.trycloudflare.com',
      '*.trycloudflare.com',
      'laptop-vpnchdqf-1.tail84384c.ts.net',
      '*.tail84384c.ts.net',
      ...extraDevOrigins,
    ]),
  ],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
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
