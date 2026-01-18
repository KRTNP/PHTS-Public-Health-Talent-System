/**
 * PHTS System - Root Layout
 *
 * Next.js App Router root layout with MUI theme integration
 */

import type { Metadata, Viewport } from 'next';
import { Sarabun } from 'next/font/google';
import ThemeRegistry from '@/theme/ThemeRegistry';

export const metadata: Metadata = {
  title: 'PHTS - Public Health Talent System',
  description: 'ระบบจัดการค่าตอบแทนกำลังคนด้านสาธารณสุข',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

const sarabun = Sarabun({
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className={sarabun.className} style={{ margin: 0, padding: 0 }}>
        <ThemeRegistry>{children}</ThemeRegistry>
      </body>
    </html>
  );
}
