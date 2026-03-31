import { ApproverRoleDashboardPage } from '@/features/dashboard/approver-role-dashboard';
import { headFinanceDashboardConfig } from '@/features/dashboard/approver-role-dashboard.config';

export default function HeadFinanceDashboardPage() {
  return <ApproverRoleDashboardPage config={headFinanceDashboardConfig} />;
}
