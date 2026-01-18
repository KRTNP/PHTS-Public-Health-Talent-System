'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  Container,
  Typography,
  Stack,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Add,
  Description,
  PendingActions,
  CheckCircleOutline,
  Assignment,
} from '@mui/icons-material';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import RequestStatusTable from '@/components/requests/RequestStatusTable';
import StatCard from '@/components/dashboard/StatCard';
import * as requestApi from '@/lib/api/requestApi';
import { AuthService } from '@/lib/api/authApi';
import { UserProfile } from '@/types/auth';
import { RequestWithDetails, RequestStatus } from '@/types/request.types';

export default function UserDashboard() {
  const router = useRouter();
  const [requests, setRequests] = useState<RequestWithDetails[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    completed: 0,
  });

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const data = await requestApi.getMyRequests();
      setRequests(data);

      const pending = data.filter(
        (r) =>
          r.status === RequestStatus.PENDING ||
          r.status === RequestStatus.DRAFT ||
          r.status === RequestStatus.RETURNED
      ).length;

      const completed = data.filter(
        (r) =>
          r.status === RequestStatus.APPROVED ||
          r.status === RequestStatus.REJECTED ||
          r.status === RequestStatus.CANCELLED
      ).length;

      setStats({
        total: data.length,
        pending,
        completed,
      });
      setError(null);
    } catch (err: any) {
      setError(err.message || 'ไม่สามารถเรียกดูข้อมูลคำขอได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // ดึงข้อมูล User เมื่อโหลดหน้าเว็บ
    const currentUser = AuthService.getCurrentUser();
    setUser(currentUser);

    fetchRequests();
  }, []);

  const renderRequests = () => {
    if (loading) {
      return (
        <Box textAlign="center" py={8}>
          <CircularProgress />
        </Box>
      );
    }

    if (error) {
      return (
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          {error}
        </Alert>
      );
    }

    return (
      <Box>
        <Stack direction="row" alignItems="center" spacing={1} mb={2}>
          <Assignment color="primary" />
          <Typography variant="h6" fontWeight={700}>
            รายการคำขอ
          </Typography>
        </Stack>
        <RequestStatusTable requests={requests} />
      </Box>
    );
  };

  return (
    <DashboardLayout title="ระบบยื่นคำขอรับเงิน พ.ต.ส.">
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems="center"
          mb={4}
          spacing={2}
        >
          <Box>
            <Typography variant="h4" fontWeight={700} color="primary.main" gutterBottom>
              สวัสดี, คุณ{user ? `${user.first_name} ${user.last_name}` : '...'}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              ติดตามสถานะและประวัติการยื่นคำขอทั้งหมดของคุณได้ที่นี่
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="large"
            startIcon={<Add />}
            onClick={() => router.push('/dashboard/user/request')}
            sx={{
              px: 4,
              py: 1.5,
              borderRadius: 2,
              fontWeight: 600,
              boxShadow: '0 8px 16px rgba(0, 108, 156, 0.24)',
              background: 'linear-gradient(45deg, #006C9C 30%, #009688 90%)',
            }}
          >
            ยื่นคำขอใหม่
          </Button>
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
            gap: 3,
            mb: 4,
          }}
        >
          <StatCard
            title="คำขอทั้งหมด"
            value={loading ? '...' : stats.total}
            color="primary"
            icon={<Description fontSize="large" />}
          />
          <StatCard
            title="รอดำเนินการ"
            value={loading ? '...' : stats.pending}
            color="warning"
            icon={<PendingActions fontSize="large" />}
          />
          <StatCard
            title="เสร็จสิ้น"
            value={loading ? '...' : stats.completed}
            color="success"
            icon={<CheckCircleOutline fontSize="large" />}
          />
        </Box>

        {renderRequests()}
      </Container>
    </DashboardLayout>
  );
}
