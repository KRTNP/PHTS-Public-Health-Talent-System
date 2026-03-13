'use client';

import { HeadScopeRequestDetailPage } from '@/features/head-approval/screens/head-scope-request-detail-page';
import { HEAD_SCOPE_BASE_PATH } from '@/features/head-approval/head-scope-route';

export default function HeadScopeRequestDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  return <HeadScopeRequestDetailPage params={params} basePath={HEAD_SCOPE_BASE_PATH} />;
}
