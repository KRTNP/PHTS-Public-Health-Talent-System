'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  Container,
  Typography,
  Card,
  CardContent,
  Stack,
  Avatar,
  CircularProgress,
  Alert,
  Paper,
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
import * as requestApi from '@/lib/api/requestApi';
import { RequestWithDetails, RequestStatus } from '@/types/request.types';

export default function UserDashboard() {
  const router = useRouter();
  const [requests, setRequests] = useState<RequestWithDetails[]>([]);
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
      setError(err.message || 'ไม่สามารถดึงข้อมูลคำขอได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const StatCard = ({
    title,
    value,
    color,
    icon,
  }: {
    title: string;
    value: number | string;
    color: string;
    icon: React.ReactNode;
  }) => (
    <Card sx={{ borderRadius: 3, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="subtitle2" fontWeight={600} sx={{ opacity: 0.7 }}>
              {title}
            </Typography>
            <Typography variant="h3" fontWeight={700} color={color}>
              {value}
            </Typography>
          </Box>
          <Avatar
            sx={{
              bgcolor: `${color}22`,
              color,
              width: 56,
              height: 56,
            }}
          >
            {icon}
          </Avatar>
        </Stack>
      </CardContent>
    </Card>
  );

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
            <Typography variant="h4" fontWeight={700} color="primary.dark" gutterBottom>
              รายการคำขอของฉัน
            </Typography>
            <Typography variant="body1" color="text.secondary">
              ติดตามสถานะและประวัติการยื่นคำขอทั้งหมด
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="large"
            startIcon={<Add />}
            onClick={() => router.push('/dashboard/user/request')}
            sx={{
              borderRadius: 3,
              px: 4,
              py: 1.5,
              fontWeight: 700,
              boxShadow: '0 8px 16px rgba(25, 118, 210, 0.24)',
            }}
          >
            ยื่นคำขอใหม่
          </Button>
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0,1fr))' },
            gap: 2,
            mb: 4,
          }}
        >
          <StatCard
            title="คำขอทั้งหมด"
            value={loading ? '...' : stats.total}
            color="#1976D2"
            icon={<Description />}
          />
          <StatCard
            title="รอดำเนินการ"
            value={loading ? '...' : stats.pending}
            color="#ED6C02"
            icon={<PendingActions />}
          />
          <StatCard
            title="เสร็จสิ้น"
            value={loading ? '...' : stats.completed}
            color="#2E7D32"
            icon={<CheckCircleOutline />}
          />
        </Box>

        {loading ? (
          <Box textAlign="center" py={8}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ borderRadius: 2 }}>
            {error}
          </Alert>
        ) : (
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} mb={2}>
              <Assignment color="primary" />
              <Typography variant="h6" fontWeight={700}>
                รายการล่าสุด
              </Typography>
            </Stack>
            <Paper
              variant="outlined"
              sx={{ borderRadius: 2, overflow: 'hidden', borderColor: 'divider' }}
            >
              <RequestStatusTable requests={requests} />
            </Paper>
          </Box>
        )}
      </Container>
    </DashboardLayout>
  );
}
