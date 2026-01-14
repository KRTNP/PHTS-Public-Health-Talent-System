/**
 * Head Ward Dashboard
 * Dashboard for HEAD_WARD role - First approval step in the workflow
 */
'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Box, Tab, Tabs, Typography } from '@mui/material';
import ApproverDashboard from '@/components/requests/ApproverDashboard';
import ApprovalHistoryList from '@/components/requests/ApprovalHistoryList';
import { Assignment, History } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { AuthService } from '@/lib/api/authApi';
import { ROLE_ROUTES, UserRole } from '@/types/auth';

export default function HeadWardPage() {
  const router = useRouter();
  const [currentTab, setCurrentTab] = useState(0);

  useEffect(() => {
    const currentUser = AuthService.getCurrentUser();
    if (!currentUser) {
      router.replace('/login');
      return;
    }
    if (currentUser.role !== UserRole.HEAD_WARD) {
      router.replace(ROLE_ROUTES[currentUser.role] || '/login');
    }
  }, [router]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  return (
    <DashboardLayout title="สำหรับหัวหน้าตึก">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          ภาพรวมการอนุมัติ (หัวหน้าตึก)
        </Typography>
        <Typography color="text.secondary">
          ตรวจสอบและอนุมัติคำขอของบุคลากรในตึกที่รับผิดชอบ
        </Typography>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={currentTab} onChange={handleTabChange} aria-label="head ward tabs">
          <Tab icon={<Assignment />} iconPosition="start" label="รายการรออนุมัติ" />
          <Tab icon={<History />} iconPosition="start" label="ประวัติการดำเนินการ" />
        </Tabs>
      </Box>

      {currentTab === 0 && <ApproverDashboard />}
      {currentTab === 1 && <ApprovalHistoryList />}
    </DashboardLayout>
  );
}
