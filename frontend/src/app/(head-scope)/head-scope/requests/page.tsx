'use client';

import { HeadScopeRequestsPage } from '@/features/head-approval/screens/head-scope-requests-page';
import { HEAD_SCOPE_BASE_PATH } from '@/features/head-approval/head-scope-route';

export default function HeadScopeRequestsRoute() {
  return (
    <HeadScopeRequestsPage
      basePath={HEAD_SCOPE_BASE_PATH}
      approverTitle="รายการคำขอที่รออนุมัติ"
      approverDescription="ตรวจสอบคำขอ พ.ต.ส. ในขอบเขตการดูแลก่อนส่งต่อไปยังขั้นตอนถัดไป"
    />
  );
}
