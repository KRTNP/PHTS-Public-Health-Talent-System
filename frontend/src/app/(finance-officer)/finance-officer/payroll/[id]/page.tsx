'use client';

import { use } from 'react';
import { PayrollDetailContent } from '@/features/payroll/components';

export default function FinanceOfficerPayrollDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <PayrollDetailContent
      periodId={id}
      selectedProfession="all"
      basePath={`/finance-officer/payroll/${id}`}
      showTable={false}
      showSummary={false}
      showSelector
      allowApprovalActions={false}
    />
  );
}
