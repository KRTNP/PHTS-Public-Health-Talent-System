/**
 * Approver Dashboard (Head of Department)
 * Quick actions hidden; forces navigation to detail first.
 */
'use client';

import React from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ApproverDashboardContent from '@/components/requests/ApproverDashboard';

export default function ApproverDashboard() {
  return (
    <DashboardLayout title="แดชบอร์ดหัวหน้าแผนก (Head of Department)">
      <ApproverDashboardContent
        title="รายการคำขอรออนุมัติ"
        subtitle="คำขอที่รอการพิจารณาจากหัวหน้าแผนก (ขั้นตอนที่ 1)"
        stepNumber={1}
        allowQuickActions={false}
        basePath="/dashboard/approver/requests"
      />
    </DashboardLayout>
  );
}
