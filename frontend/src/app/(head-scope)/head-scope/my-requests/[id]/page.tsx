'use client';

import { HeadScopeMyRequestDetailPage } from '@/features/head-approval/screens/head-scope-my-request-detail-page';
import { HEAD_SCOPE_BASE_PATH } from '@/features/head-approval/head-scope-route';

export default function HeadScopeMyRequestDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  return <HeadScopeMyRequestDetailPage params={params} basePath={HEAD_SCOPE_BASE_PATH} />;
}
