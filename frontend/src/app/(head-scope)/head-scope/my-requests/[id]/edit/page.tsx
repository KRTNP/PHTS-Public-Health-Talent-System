'use client';

import { HeadScopeMyRequestEditPage } from '@/features/head-approval/screens/head-scope-my-request-edit-page';
import { HEAD_SCOPE_BASE_PATH } from '@/features/head-approval/head-scope-route';

export default function HeadScopeMyRequestEditRoute({ params }: { params: Promise<{ id: string }> }) {
  return <HeadScopeMyRequestEditPage params={params} basePath={HEAD_SCOPE_BASE_PATH} />;
}
