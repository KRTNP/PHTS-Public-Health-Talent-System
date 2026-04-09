import { ApproverRequestsPage } from '@/features/request/approver-requests-page';
import { headFinanceRequestsPageConfig } from '@/features/request/approver-requests-page.config';

export default function HeadFinanceRequestsPage() {
  return <ApproverRequestsPage config={headFinanceRequestsPageConfig} />;
}
