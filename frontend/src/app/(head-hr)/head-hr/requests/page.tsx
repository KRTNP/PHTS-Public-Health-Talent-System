import { ApproverRequestsPage } from '@/features/request/approver-requests-page';
import { headHrRequestsPageConfig } from '@/features/request/approver-requests-page.config';

export default function HeadHRRequestsPage() {
  return <ApproverRequestsPage config={headHrRequestsPageConfig} />;
}
