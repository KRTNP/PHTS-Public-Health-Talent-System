'use client';

export const dynamic = 'force-dynamic';

import { HeadScopeMyRequestsPage } from '@/features/head-approval/screens/head-scope-my-requests-page';
import { HEAD_SCOPE_BASE_PATH } from '@/features/head-approval/head-scope-route';

export default function HeadScopeMyRequestsRoute() {
  return <HeadScopeMyRequestsPage basePath={HEAD_SCOPE_BASE_PATH} />;
}
