/**
 * User Request Detail - responsive layout, no print button, shows actor names
 */
'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Box,
  Paper,
  Typography,
  Divider,
  Stack,
  CircularProgress,
  Alert,
  Container,
} from '@mui/material';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import StatusChip from '@/components/common/StatusChip';
import BackButton from '@/components/common/BackButton';
import RequestInfoRow from '@/components/requests/RequestInfoRow';
import RequestAttachmentsPanel from '@/components/requests/RequestAttachmentsPanel';
import RequestHistoryPanel from '@/components/requests/RequestHistoryPanel';
import * as requestApi from '@/lib/api/requestApi';
import {
  RequestWithDetails,
  PERSONNEL_TYPE_LABELS,
  REQUEST_TYPE_LABELS,
  RequestStatus,
} from '@/types/request.types';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

const getRequestLabel = (request: RequestWithDetails) =>
  request.request_no || `#${request.request_id}`;

export default function RequestDetailPage() {
  const params = useParams();
  const requestId = Number(params.id);

  const [request, setRequest] = useState<RequestWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRequest = async () => {
      try {
        const data = await requestApi.getRequestById(requestId);
        setRequest(data);
      } catch (err: any) {
        setError(err.message || 'ไม่พบข้อมูลคำขอ');
      } finally {
        setLoading(false);
      }
    };
    if (requestId) fetchRequest();
  }, [requestId]);

  const formatDate = (date?: string | Date | null, withTime = false) => {
    if (!date) return '-';
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      return format(d, withTime ? 'd MMM yyyy HH:mm น.' : 'd MMM yyyy', { locale: th });
    } catch {
      return '-';
    }
  };

  if (loading)
    return (
      <Box p={4} textAlign="center" height="50vh" display="flex" alignItems="center" justifyContent="center">
        <CircularProgress />
      </Box>
    );
  if (error || !request) return <Alert severity="error">{error || 'ไม่พบข้อมูล'}</Alert>;

  const lastAction = request.actions && request.actions.length > 0 ? request.actions[request.actions.length - 1] : null;
  const showWarning =
    (request.status === RequestStatus.RETURNED || request.status === RequestStatus.REJECTED) &&
    lastAction?.comment;

  return (
    <DashboardLayout title={`รายละเอียดคำขอ: ${getRequestLabel(request)}`}>
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Box mb={3}>
          <BackButton to="/dashboard/user" label="กลับไปหน้าหลัก" />
        </Box>

        {showWarning && (
          <Alert severity="warning" variant="filled" sx={{ mb: 3, borderRadius: 2, '& .MuiAlert-message': { width: '100%' } }}>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              {request.status === RequestStatus.RETURNED ? 'คำขอถูกส่งคืนให้แก้ไข' : 'คำขอถูกปฏิเสธ'}
            </Typography>
            <Typography variant="body2">เหตุผล: &quot;{lastAction?.comment}&quot;</Typography>
            <Typography variant="caption" sx={{ opacity: 0.8, mt: 1, display: 'block' }}>
              โดย: {lastAction?.actor?.first_name ? `${lastAction.actor.first_name} ${lastAction.actor.last_name || ''}` : lastAction?.actor?.role}{' '}
              {lastAction?.actor?.role ? `(${lastAction.actor.role})` : ''} เมื่อ {formatDate(lastAction?.action_date || lastAction?.created_at, true)}
            </Typography>
          </Alert>
        )}

        <Box
          sx={{
            display: 'grid',
            gap: 3,
            gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' },
            alignItems: 'start',
          }}
        >
          <Box>
            <Paper variant="outlined" sx={{ p: { xs: 2, md: 4 }, borderRadius: 3, mb: 3 }}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                mb={3}
                spacing={2}
              >
                <Box>
                  <Typography variant="h6" fontWeight={700}>
                    ข้อมูลคำขอ
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    เลขที่: {request.request_no || 'รอระบุ'} | ยื่นวันที่: {formatDate(request.created_at)}
                  </Typography>
                </Box>
                <StatusChip status={request.status} />
              </Stack>
              <Divider sx={{ mb: 3 }} />

              <Box
                sx={{
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0,1fr))' },
                }}
              >
                <RequestInfoRow label="ประเภทบุคลากร" value={PERSONNEL_TYPE_LABELS[request.personnel_type]} />
                <RequestInfoRow label="ประเภทคำขอ" value={REQUEST_TYPE_LABELS[request.request_type]} />
                <RequestInfoRow label="ตำแหน่งเลขที่" value={request.position_number} />
                <RequestInfoRow label="สังกัด/กลุ่มงาน" value={request.department_group} />
                <Box sx={{ gridColumn: '1 / -1' }}>
                  <RequestInfoRow label="ปฏิบัติหน้าที่หลัก" value={request.main_duty} />
                </Box>
              </Box>

              <Box bgcolor="primary.50" p={2} borderRadius={2} mt={2}>
                <Box
                  sx={{
                    display: 'grid',
                    gap: 2,
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0,1fr))' },
                  }}
                >
                  <RequestInfoRow
                    label="ยอดเงินที่ขอ"
                    value={request.requested_amount ? `${request.requested_amount.toLocaleString()} บาท` : '-'}
                    highlight
                  />
                  <RequestInfoRow label="มีผลตั้งแต่วันที่" value={formatDate(request.effective_date, false)} />
                </Box>
              </Box>
            </Paper>

            <RequestAttachmentsPanel
              attachments={request.attachments}
              paperSx={{ p: { xs: 2, md: 3 } }}
            />
          </Box>

          <Box>
            <RequestHistoryPanel actions={request.actions} formatDate={formatDate} />
          </Box>
        </Box>
      </Container>
    </DashboardLayout>
  );
}
