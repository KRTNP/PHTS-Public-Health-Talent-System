'use client';

import { use } from 'react';
import { RequestApprovalDetailPage } from '@/features/request/detail/pages/RequestApprovalDetailPage';
import { directorRequestApprovalDetailConfig } from '@/features/request/detail/pages/requestApprovalDetail.config';

export default function DirectorRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <RequestApprovalDetailPage requestId={id} config={directorRequestApprovalDetailConfig} />;
}
