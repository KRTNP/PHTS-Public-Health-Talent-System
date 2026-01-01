/**
 * Approver Dashboard - Smart Approval Layout
 */
'use client';

import React, { useState, useEffect } from 'react';
import {
  Stack,
  Typography,
  Card,
  CardContent,
  Snackbar,
  Alert,
  Box,
  Chip,
  Container,
  Avatar,
} from '@mui/material';
import { Assignment, PendingActions, CheckCircleOutline } from '@mui/icons-material';
import ApprovalList from './ApprovalList';
import { RequestWithDetails } from '@/types/request.types';
import * as requestApi from '@/lib/api/requestApi';

interface ApproverDashboardContentProps {
  title: string;
  subtitle: string;
  stepNumber: number;
  allowQuickActions?: boolean;
  basePath?: string;
}

export default function ApproverDashboardContent({
  title,
  subtitle,
  stepNumber,
  allowQuickActions = true,
  basePath,
}: ApproverDashboardContentProps) {
  const [requests, setRequests] = useState<RequestWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const fetchPendingRequests = async () => {
    try {
      setLoading(true);
      const data = await requestApi.getPendingRequests();
      setRequests(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'ไม่สามารถดึงรายการรออนุมัติได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingRequests();
  }, []);

  const handleApprove = async (requestId: number, comment?: string) => {
    try {
      await requestApi.approveRequest(requestId, comment);
      setToast({
        open: true,
        message: 'อนุมัติคำขอสำเร็จ',
        severity: 'success',
      });
      await fetchPendingRequests();
    } catch (err: any) {
      throw new Error(err.message || 'ไม่สามารถอนุมัติคำขอได้');
    }
  };

  const handleReject = async (requestId: number, comment: string) => {
    try {
      await requestApi.rejectRequest(requestId, comment);
      setToast({
        open: true,
        message: 'ปฏิเสธคำขอแล้ว',
        severity: 'success',
      });
      await fetchPendingRequests();
    } catch (err: any) {
      throw new Error(err.message || 'ไม่สามารถปฏิเสธคำขอได้');
    }
  };

  const handleReturn = async (requestId: number, comment: string) => {
    try {
      await requestApi.returnRequest(requestId, comment);
      setToast({
        open: true,
        message: 'ส่งคืนคำขอสำเร็จ',
        severity: 'success',
      });
      await fetchPendingRequests();
    } catch (err: any) {
      throw new Error(err.message || 'ไม่สามารถส่งคืนคำขอได้');
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack spacing={4}>
        {/* Header Section */}
        <Box>
          <Typography variant="h4" fontWeight={700} color="primary.dark" gutterBottom>
            {title}
          </Typography>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Chip label={`ขั้นตอนที่ ${stepNumber}`} color="primary" size="small" />
            <Typography variant="body1" color="text.secondary">
              {subtitle}
            </Typography>
          </Stack>
        </Box>

        {/* KPI Cards Section */}
        <Box
          sx={{
            display: 'grid',
            gap: 3,
            gridTemplateColumns: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          }}
        >
          <Box>
            <Card sx={{ borderRadius: 3, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography variant="overline" color="text.secondary" fontWeight={600}>
                      รออนุมัติ
                    </Typography>
                    <Typography variant="h3" fontWeight={700} color="warning.main">
                      {requests.length}
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'warning.lighter', color: 'warning.main', width: 48, height: 48 }}>
                    <PendingActions />
                  </Avatar>
                </Stack>
              </CardContent>
            </Card>
          </Box>

          <Box>
            <Card sx={{ borderRadius: 3, boxShadow: 'none', border: '1px solid #eee', bgcolor: 'grey.50' }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography variant="overline" color="text.secondary" fontWeight={600}>
                      ดำเนินการแล้ว
                    </Typography>
                    <Typography variant="h4" fontWeight={600} color="text.primary">
                      -
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'grey.200', color: 'grey.500', width: 48, height: 48 }}>
                    <CheckCircleOutline />
                  </Avatar>
                </Stack>
              </CardContent>
            </Card>
          </Box>
        </Box>

        {/* Main List Section */}
        <Box>
          <Typography variant="h6" fontWeight={700} gutterBottom sx={{ mb: 2 }}>
            รายการล่าสุด
          </Typography>
          <ApprovalList
            requests={requests}
            loading={loading}
            error={error}
            onApprove={handleApprove}
            onReject={handleReject}
            onReturn={handleReturn}
            onRefresh={fetchPendingRequests}
            showQuickActions={allowQuickActions}
            basePath={basePath}
          />
        </Box>
      </Stack>

      {/* Toast Notification */}
      <Snackbar
        open={toast.open}
        autoHideDuration={6000}
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setToast({ ...toast, open: false })}
          severity={toast.severity}
          variant="filled"
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}
