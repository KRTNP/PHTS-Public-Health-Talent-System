/**
 * Approver Request Detail - with action bar for approve/reject/return
 */
'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box,
  Paper,
  Typography,
  Divider,
  Button,
  Stack,
  CircularProgress,
  Alert,
  Container,
  Snackbar,
} from '@mui/material';
import { ArrowBack, CheckCircle, Cancel, Undo } from '@mui/icons-material';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import StatusChip from '@/components/common/StatusChip';
import FilePreviewList from '@/components/common/FilePreviewList';
import * as requestApi from '@/lib/api/requestApi';
import { RequestWithDetails, PERSONNEL_TYPE_LABELS, REQUEST_TYPE_LABELS } from '@/types/request.types';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import ApprovalDialog, { ApprovalAction } from '@/components/requests/ApprovalDialog';

export default function ApproverRequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const requestId = Number(params.id);

  const [request, setRequest] = useState<RequestWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentAction, setCurrentAction] = useState<ApprovalAction>('approve');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  useEffect(() => {
    const fetchRequest = async () => {
      try {
        const data = await requestApi.getRequestById(requestId);
        setRequest(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (requestId) fetchRequest();
  }, [requestId]);

  const handleAction = (action: ApprovalAction) => {
    setCurrentAction(action);
    setDialogOpen(true);
  };

  const handleConfirmAction = async (comment: string) => {
    if (!request) return;
    setIsSubmitting(true);
    try {
      if (currentAction === 'approve') {
        await requestApi.approveRequest(request.request_id, comment);
        setToast({ open: true, message: 'อนุมัติคำขอเรียบร้อยแล้ว', severity: 'success' });
      } else if (currentAction === 'reject') {
        await requestApi.rejectRequest(request.request_id, comment);
        setToast({ open: true, message: 'ปฏิเสธคำขอเรียบร้อยแล้ว', severity: 'success' });
      } else if (currentAction === 'return') {
        await requestApi.returnRequest(request.request_id, comment);
        setToast({ open: true, message: 'ส่งคืนคำขอแก้ไขเรียบร้อยแล้ว', severity: 'success' });
      }

      setDialogOpen(false);
      setTimeout(() => router.push('/dashboard/approver'), 1500);
    } catch (err: any) {
      setToast({ open: true, message: err.message || 'เกิดข้อผิดพลาด', severity: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (date?: string | Date | null, withTime = false) => {
    if (!date) return '-';
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      return format(d, withTime ? 'd MMM yyyy HH:mm' : 'd MMM yyyy', { locale: th });
    } catch {
      return '-';
    }
  };

  if (loading)
    return (
      <Box p={4} textAlign="center">
        <CircularProgress />
      </Box>
    );
  if (error || !request) return <Alert severity="error">{error || 'ไม่พบข้อมูล'}</Alert>;

  const InfoRow = ({
    label,
    value,
    highlight = false,
  }: {
    label: string;
    value: React.ReactNode;
    highlight?: boolean;
  }) => (
    <Box mb={2}>
      <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
        {label}
      </Typography>
      <Typography
        variant="body1"
        fontWeight={highlight ? 700 : 500}
        color={highlight ? 'primary.main' : 'text.primary'}
      >
        {value || '-'}
      </Typography>
    </Box>
  );

  return (
    <DashboardLayout title={`ตรวจสอบคำขอ: ${request.request_no || `#${request.request_id}`}`}>
      <Container maxWidth="lg" sx={{ py: 3, pb: 10 }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={3}>
          <Button startIcon={<ArrowBack />} onClick={() => router.back()} sx={{ fontWeight: 600 }}>
            ย้อนกลับ
          </Button>
          <Typography variant="h6" fontWeight={700} flexGrow={1}>
            รายละเอียดคำขอ
          </Typography>
          <StatusChip status={request.status} />
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gap: 3,
            gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' },
            alignItems: 'start',
          }}
        >
          <Box>
            <Paper variant="outlined" sx={{ p: 4, borderRadius: 3, mb: 3 }}>
              <Typography variant="h6" fontWeight={700} gutterBottom color="primary.main">
                ข้อมูลบุคลากร
              </Typography>
              <Divider sx={{ mb: 3 }} />
              <Box
                sx={{
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0,1fr))' },
                }}
              >
                <InfoRow
                  label="รหัสประชาชน"
                  value={request.requester?.citizen_id}
                />
                <InfoRow label="ตำแหน่ง" value={request.requester?.position || '-'} />
                <InfoRow label="ประเภทบุคลากร" value={PERSONNEL_TYPE_LABELS[request.personnel_type]} />
                <InfoRow label="ประเภทคำขอ" value={REQUEST_TYPE_LABELS[request.request_type]} />
                <InfoRow label="ตำแหน่งเลขที่" value={request.position_number} />
                <InfoRow label="สังกัด/กลุ่มงาน" value={request.department_group} />
              </Box>

              <Box bgcolor="success.lighter" p={2} borderRadius={2} mt={2}>
                <Box
                  sx={{
                    display: 'grid',
                    gap: 2,
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0,1fr))' },
                  }}
                >
                  <InfoRow
                    label="ยอดเงินที่ขอเบิก"
                    value={request.requested_amount ? `${request.requested_amount.toLocaleString()} บาท` : '-'}
                    highlight
                  />
                  <InfoRow
                    label="มีผลตั้งแต่วันที่"
                    value={formatDate(request.effective_date, false)}
                  />
                </Box>
              </Box>
            </Paper>

            <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                เอกสารแนบ
              </Typography>
              {request.attachments?.length ? (
                <FilePreviewList
                  files={request.attachments.map((f) => ({
                    name: f.original_filename || f.file_name || '',
                    size: f.file_size,
                    type: f.mime_type,
                  })) as any}
                  readOnly
                />
              ) : (
                <Typography color="text.secondary">ไม่มีเอกสารแนบ</Typography>
              )}
            </Paper>
          </Box>

          <Box>
            <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, bgcolor: '#fafafa' }}>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                ประวัติการดำเนินงาน
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Stack spacing={3}>
                {request.actions && request.actions.length > 0 ? (
                  request.actions.map((action, index) => (
                    <Box key={index} position="relative" pl={2} sx={{ borderLeft: '2px solid #e0e0e0' }}>
                      <Box
                        position="absolute"
                        left="-5px"
                        top="0"
                        width="8px"
                        height="8px"
                        borderRadius="50%"
                        bgcolor="primary.main"
                      />
                      <Typography variant="body2" fontWeight={600}>
                        {action.action || action.action_type}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {formatDate(action.action_date || action.created_at, true)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        โดย: {action.actor?.role || '-'}{' '}
                        {action.actor?.citizen_id ? `(${action.actor.citizen_id})` : ''}
                      </Typography>
                      {action.comment && (
                        <Box mt={1} p={1} bgcolor="#fff" border="1px solid #eee" borderRadius={1}>
                          <Typography variant="caption">{action.comment}</Typography>
                        </Box>
                      )}
                    </Box>
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    ยังไม่มีข้อมูลประวัติการดำเนินงาน
                  </Typography>
                )}
              </Stack>
            </Paper>
          </Box>
        </Box>
      </Container>

      <Paper
        elevation={3}
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          p: 2,
          zIndex: 100,
          borderTop: '1px solid #ddd',
          display: 'flex',
          justifyContent: 'center',
          gap: 2,
        }}
      >
        <Button variant="outlined" color="error" startIcon={<Cancel />} onClick={() => handleAction('reject')}>
          ไม่อนุมัติ
        </Button>
        <Button variant="outlined" color="info" startIcon={<Undo />} onClick={() => handleAction('return')}>
          ส่งแก้ไข
        </Button>
        <Button
          variant="contained"
          color="success"
          startIcon={<CheckCircle />}
          onClick={() => handleAction('approve')}
          sx={{ px: 4, fontWeight: 700 }}
        >
          อนุมัติคำขอ
        </Button>
      </Paper>

      <ApprovalDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        request={request}
        action={currentAction}
        onConfirm={handleConfirmAction}
        isSubmitting={isSubmitting}
      />

      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={toast.severity} variant="filled">
          {toast.message}
        </Alert>
      </Snackbar>
    </DashboardLayout>
  );
}
