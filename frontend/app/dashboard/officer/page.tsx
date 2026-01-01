/**
 * PTS Officer Dashboard
 * Uses shared ApproverDashboardContent but forces detail-first (no quick actions)
 */
'use client';

import React from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ApproverDashboardContent from '@/components/requests/ApproverDashboard';

export default function OfficerDashboard() {
  return (
    <DashboardLayout title="แดชบอร์ดเจ้าหน้าที่ PTS (PTS Officer)">
      <ApproverDashboardContent
        title="รายการคำขอรอตรวจสอบ"
        subtitle="คำขอที่รอการพิจารณาตรวจสอบความถูกต้อง (ขั้นตอนที่ 2)"
        stepNumber={2}
        allowQuickActions={false}
        basePath="/dashboard/officer/requests"
      />
    </DashboardLayout>
  );
}
