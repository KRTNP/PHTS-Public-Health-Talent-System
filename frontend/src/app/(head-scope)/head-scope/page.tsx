'use client';

export const dynamic = 'force-dynamic';

import { HeadScopeDashboardPage } from '@/features/head-approval/screens/head-scope-dashboard-page';
import { HEAD_SCOPE_BASE_PATH, HEAD_SCOPE_ROLE_TITLE } from '@/features/head-approval/head-scope-route';

export default function HeadScopeDashboardRoute() {
  return <HeadScopeDashboardPage basePath={HEAD_SCOPE_BASE_PATH} roleTitle={HEAD_SCOPE_ROLE_TITLE} />;
}
