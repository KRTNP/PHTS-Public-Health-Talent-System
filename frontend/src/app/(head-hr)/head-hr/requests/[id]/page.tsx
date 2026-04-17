'use client';

import { use } from 'react';
import { RequestApprovalDetailPage } from '@/features/request/detail/pages/RequestApprovalDetailPage';
import { headHrRequestApprovalDetailConfig } from '@/features/request/detail/pages/requestApprovalDetail.config';

export default function HeadHRRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <RequestApprovalDetailPage requestId={id} config={headHrRequestApprovalDetailConfig} />;
}
