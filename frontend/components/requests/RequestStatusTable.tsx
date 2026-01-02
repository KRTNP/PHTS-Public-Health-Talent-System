'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Divider,
  Card,
  CardContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Chip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { Visibility, Edit, LinearScale } from '@mui/icons-material';
import { RequestWithDetails, RequestStatus, REQUEST_TYPE_LABELS } from '@/types/request.types';
import StatusChip from '@/components/common/StatusChip';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

interface RequestStatusTableProps {
  requests: RequestWithDetails[];
  loading?: boolean;
}

export default function RequestStatusTable({ requests, loading = false }: RequestStatusTableProps) {
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const getStepLabel = (step: number, status: string) => {
    if (status === RequestStatus.APPROVED) return 'เสร็จสิ้น';
    if (status === RequestStatus.DRAFT) return 'ร่างคำขอ';
    const steps = [
      '',
      '1. หัวหน้ากลุ่มงาน',
      '2. เจ้าหน้าที่ พ.ต.ส.',
      '3. หัวหน้าฝ่าย HR',
      '4. ผู้อำนวยการ',
      '5. หัวหน้าการเงิน',
    ];
    return steps[step] || `ขั้นตอนที่ ${step}`;
  };

  const handleView = (id: number) => router.push(`/dashboard/user/requests/${id}`);

  const formatDate = (date: Date | string) => {
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      return format(d, 'd MMM yyyy', { locale: th });
    } catch {
      return '-';
    }
  };

  if (loading) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#f5f5f5', border: '1px dashed #ccc' }}>
        <Typography color="text.secondary">กำลังโหลดรายการคำขอ...</Typography>
      </Paper>
    );
  }

  if (!requests || requests.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#f5f5f5', border: '1px dashed #ccc' }}>
        <Typography color="text.secondary">ไม่พบรายการคำขอ</Typography>
        <Button variant="contained" sx={{ mt: 2 }} onClick={() => router.push('/dashboard/user/request')}>
          สร้างคำขอใหม่
        </Button>
      </Paper>
    );
  }

  // Mobile / Tablet: Card layout
  if (isMobile) {
    return (
      <Stack spacing={2}>
        {requests.map((req) => (
          <Card
            key={req.request_id}
            variant="outlined"
            sx={{
              borderRadius: 3,
              border: '1px solid #e0e0e0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            }}
          >
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    {req.request_no || 'ยังไม่มีเลขที่'}
                  </Typography>
                  <Typography variant="h6" fontWeight={700} color="primary.main">
                    {formatDate(req.created_at)}
                  </Typography>
                </Box>
                <StatusChip status={req.status} />
              </Box>

              <Divider sx={{ my: 1.5 }} />

              <Box
                mb={2}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 1,
                }}
              >
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    ประเภท
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {req.request_type === 'NEW_ENTRY' ? 'ยื่นใหม่' : 'ปรับปรุงข้อมูล'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    จำนวนเงิน
                  </Typography>
                  <Typography variant="body2" fontWeight={700} color="success.main">
                    {req.requested_amount?.toLocaleString() || '-'} บาท
                  </Typography>
                </Box>
                <Box sx={{ gridColumn: '1 / -1' }}>
                  <Typography variant="caption" color="text.secondary">
                    สถานะปัจจุบัน
                  </Typography>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <LinearScale color="primary" fontSize="small" />
                    <Typography variant="body2" fontWeight={600} color="primary.main">
                      {getStepLabel(req.current_step, req.status)}
                    </Typography>
                  </Stack>
                </Box>
              </Box>

              <Button
                variant="outlined"
                fullWidth
                startIcon={<Visibility />}
                onClick={() => handleView(req.request_id)}
                sx={{ borderRadius: 2, borderWidth: 2, fontWeight: 600 }}
              >
                ดูรายละเอียด
              </Button>
            </CardContent>
          </Card>
        ))}
      </Stack>
    );
  }

  // Desktop: Table layout
  return (
    <TableContainer component={Paper} elevation={0} variant="outlined" sx={{ borderRadius: 2 }}>
      <Table sx={{ minWidth: 650 }}>
        <TableHead sx={{ bgcolor: 'primary.50' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>วันที่ยื่น</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>เลขที่เอกสาร</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>ประเภท</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>ขั้นตอนปัจจุบัน</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>ยอดเงิน (บาท)</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>สถานะ</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>
                จัดการ
              </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {requests.map((req) => (
            <TableRow key={req.request_id} hover>
              <TableCell>{formatDate(req.created_at)}</TableCell>
              <TableCell>{req.request_no || '-'}</TableCell>
              <TableCell>{REQUEST_TYPE_LABELS[req.request_type]}</TableCell>
              <TableCell>
                <Chip
                  label={getStepLabel(req.current_step, req.status)}
                  size="small"
                  variant="outlined"
                  color="primary"
                  icon={<LinearScale />}
                  sx={{ borderRadius: 1, fontWeight: 500, border: 'none' }}
                />
              </TableCell>
              <TableCell sx={{ fontWeight: 600, color: 'success.main' }}>
                {req.requested_amount?.toLocaleString() || '-'}
              </TableCell>
              <TableCell>
                <StatusChip status={req.status} size="small" />
              </TableCell>
              <TableCell align="center">
                <Tooltip title="ดูรายละเอียด">
                  <IconButton
                    color="primary"
                    onClick={() => handleView(req.request_id)}
                    sx={{ border: '1px solid #eee', mr: 1 }}
                  >
                    <Visibility />
                  </IconButton>
                </Tooltip>
                {(req.status === RequestStatus.DRAFT || req.status === RequestStatus.RETURNED) && (
                  <Tooltip title="แก้ไข">
                    <IconButton color="warning" sx={{ border: '1px solid #eee' }}>
                      <Edit />
                    </IconButton>
                  </Tooltip>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
