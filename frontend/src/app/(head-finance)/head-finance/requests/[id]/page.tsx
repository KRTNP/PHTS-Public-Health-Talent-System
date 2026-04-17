'use client';

import { use } from 'react';
import { RequestApprovalDetailPage } from '@/features/request/detail/pages/RequestApprovalDetailPage';
import { headFinanceRequestApprovalDetailConfig } from '@/features/request/detail/pages/requestApprovalDetail.config';

export default function HeadFinanceRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <RequestApprovalDetailPage requestId={id} config={headFinanceRequestApprovalDetailConfig} />;
}
