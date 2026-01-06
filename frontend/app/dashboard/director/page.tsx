/**
 * PHTS System - Director Dashboard
 *
 * Dashboard for DIRECTOR role - Step 5 approver
 */

'use client';

import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ApproverDashboardContent from '@/components/requests/ApproverDashboard';

export default function DirectorDashboard() {
  return (
    <DashboardLayout title="แดชบอร์ดผู้อำนวยการโรงพยาบาล (Hospital Director)">
      <ApproverDashboardContent
        title="รายการคำขอรออนุมัติ"
        subtitle="คำขอที่รอการพิจารณาจากผู้อำนวยการโรงพยาบาล"
        stepNumber={5}
        enableBatchApproval={true}
      />
    </DashboardLayout>
  );
}
