'use client';

import { use } from 'react';
import { PayrollPeriodLeavesScreen } from '@/features/payroll/screens/pts-officer/PayrollPeriodLeavesScreen';

export const dynamic = 'force-dynamic';

export default function PTSOfficerPayrollLeavesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <PayrollPeriodLeavesScreen periodId={id} />;
}
