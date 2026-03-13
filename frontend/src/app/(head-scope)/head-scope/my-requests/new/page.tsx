'use client';

import { HeadScopeMyRequestNewPage } from '@/features/head-approval/screens/head-scope-my-request-new-page';
import { HEAD_SCOPE_BASE_PATH } from '@/features/head-approval/head-scope-route';

export default function HeadScopeMyRequestNewRoute() {
  return <HeadScopeMyRequestNewPage basePath={HEAD_SCOPE_BASE_PATH} />;
}
