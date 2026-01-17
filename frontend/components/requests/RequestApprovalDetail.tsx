'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Divider,
  Button,
  CircularProgress,
  Alert,
  Avatar,
  Paper,
  Chip,
  Step,
  Stepper,
  StepLabel,
  StepContent,
  Container,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Person,
  AttachMoney,
  Description,
  History,
  CheckCircle,
  Cancel,
  Reply,
} from '@mui/icons-material';
import FilePreviewList from '@/components/common/FilePreviewList';
import StatusChip from '@/components/common/StatusChip';
import BackButton from '@/components/common/BackButton';
import ApprovalDialog from '@/components/requests/ApprovalDialog';
import * as requestApi from '@/lib/api/requestApi';
import { RequestWithDetails, WORK_ATTRIBUTE_LABELS, RequestStatus } from '@/types/request.types';
import { AuthService } from '@/lib/api/authApi';
import { ROLE_ROUTES, UserRole } from '@/types/auth';

interface RequestApprovalDetailProps {
  requiredRole: UserRole;
  backPath: string;
  pageTitle: string;
}

export default function RequestApprovalDetail({
  requiredRole,
  backPath,
  pageTitle,
}: RequestApprovalDetailProps) {
  const { id } = useParams();
  const router = useRouter();
  const theme = useTheme();

  const [request, setRequest] = useState<RequestWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | 'RETURN'>('APPROVE');

  const fetchRequest = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await requestApi.getRequestById(Number(id));
      setRequest(data);
    } catch (err: any) {
      setError(err.message || 'ไม่สามารถโหลดข้อมูลคำขอได้');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const currentUser = AuthService.getCurrentUser();
    if (!currentUser) {
      router.replace('/login');
      return;
    }
    if (currentUser.role !== requiredRole) {
      router.replace(ROLE_ROUTES[currentUser.role] || '/login');
      return;
    }
    fetchRequest();
  }, [fetchRequest, requiredRole, router]);

  const handleActionClick = (type: 'APPROVE' | 'REJECT' | 'RETURN') => {
    setActionType(type);
    setDialogOpen(true);
  };

  const handleActionConfirm = async (comment: string) => {
    try {
      if (!request) return;

      if (actionType === 'APPROVE') {
        await requestApi.approveRequest(request.request_id, comment);
      } else if (actionType === 'REJECT') {
        await requestApi.rejectRequest(request.request_id, comment);
      } else {
        await requestApi.returnRequest(request.request_id, comment);
      }

      setDialogOpen(false);
      router.push(backPath);
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการดำเนินการ');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', height: '100vh', alignItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error || !request) return <Alert severity="error">{error || 'ไม่พบข้อมูล'}</Alert>;

  const renderWorkAttributes = () => {
    if (!request.work_attributes) return '-';
    return Object.entries(request.work_attributes)
      .filter(([_, value]) => value)
      .map(([key]) => (
        <Chip
          key={key}
          label={WORK_ATTRIBUTE_LABELS[key as keyof typeof WORK_ATTRIBUTE_LABELS]}
          size="small"
          sx={{ mr: 1, mb: 1 }}
        />
      ));
  };

  return (
    <Container maxWidth="xl" sx={{ pb: 12 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" mb={3} spacing={2}>
        <Stack direction="row" spacing={2} alignItems="center">
          <BackButton to={backPath} />
          <Box>
            <Typography variant="h5" fontWeight={700}>
              ตรวจสอบคำขอ: {request.request_no}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" color="text.secondary">
                วันที่ยื่น: {new Date(request.created_at).toLocaleDateString('th-TH')}
              </Typography>
              <StatusChip status={request.status} />
            </Stack>
          </Box>
        </Stack>
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, gap: 3 }}>
        <Stack spacing={3}>
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center" mb={3}>
                <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.light' }}>
                  <Person fontSize="large" />
                </Avatar>
                <Box>
                  <Typography variant="h6" fontWeight={700}>
                    {request.requester?.first_name} {request.requester?.last_name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {request.requester?.position} | {request.department_group}
                  </Typography>
                </Box>
              </Stack>

              <Divider sx={{ mb: 2 }} />

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                <InfoItem label="ประเภทบุคลากร" value={request.personnel_type} />
                <InfoItem label="เลขที่ตำแหน่ง" value={request.position_number} />
                <Box sx={{ gridColumn: { xs: '1', sm: 'span 2' } }}>
                  <InfoItem label="หน้าที่ความรับผิดชอบหลัก" value={request.main_duty} />
                </Box>
                <Box sx={{ gridColumn: { xs: '1', sm: 'span 2' } }}>
                  <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                    ลักษณะงานที่ปฏิบัติ
                  </Typography>
                  {renderWorkAttributes()}
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                <AttachMoney color="primary" />
                <Typography variant="h6" fontWeight={700}>รายละเอียดการขอรับเงิน</Typography>
              </Stack>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                <InfoItem label="ประเภทคำขอ" value={request.request_type} />
                <InfoItem
                  label="วันที่มีผล"
                  value={request.effective_date ? new Date(request.effective_date).toLocaleDateString('th-TH') : '-'}
                />
                <Box sx={{ gridColumn: { xs: '1', sm: 'span 2' } }}>
                  <Box sx={{ p: 2, bgcolor: 'success.lighter', borderRadius: 2, border: '1px dashed', borderColor: 'success.main' }}>
                    <Typography variant="subtitle2" color="success.dark">ยอดเงินที่ขอเบิก</Typography>
                    <Typography variant="h4" color="success.main" fontWeight={700}>
                      {request.requested_amount?.toLocaleString()} บาท
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Stack>

        <Box>
          <Stack spacing={3}>
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                  <Description color="primary" />
                  <Typography variant="h6" fontWeight={700}>เอกสารแนบ</Typography>
                </Stack>
                {request.attachments && request.attachments.length > 0 ? (
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
              </CardContent>
            </Card>

            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                  <History color="primary" />
                  <Typography variant="h6" fontWeight={700}>ประวัติการดำเนินการ</Typography>
                </Stack>
                <Stepper orientation="vertical" activeStep={-1}>
                  {request.actions && request.actions.length > 0 ? (
                    request.actions.map((action, index) => (
                      <Step key={index} expanded active>
                        <StepLabel
                          icon={
                            action.action === 'APPROVE' ? <CheckCircle color="success" /> :
                            action.action === 'REJECT' ? <Cancel color="error" /> :
                            action.action === 'RETURN' ? <Reply color="warning" /> :
                            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'grey.400', ml: 0.5 }} />
                          }
                        >
                          <Typography variant="subtitle2" fontWeight={600}>
                            {action.actor?.first_name} {action.actor?.last_name} ({action.actor?.role})
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(action.created_at).toLocaleString('th-TH')}
                          </Typography>
                        </StepLabel>
                        <StepContent>
                          <Typography variant="body2" sx={{ bgcolor: 'grey.50', p: 1, borderRadius: 1 }}>
                            {action.action} {action.comment ? `- ${action.comment}` : ''}
                          </Typography>
                        </StepContent>
                      </Step>
                    ))
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      ยังไม่มีข้อมูลประวัติการดำเนินงาน
                    </Typography>
                  )}
                </Stepper>
              </CardContent>
            </Card>
          </Stack>
        </Box>
      </Box>

      {request.status === RequestStatus.PENDING && (
        <Paper
          elevation={3}
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            p: 2,
            zIndex: 1000,
            borderTop: `1px solid ${theme.palette.divider}`,
            bgcolor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <Container maxWidth="xl">
            <Stack direction="row" justifyContent="flex-end" spacing={2}>
              <Button variant="outlined" color="warning" startIcon={<Reply />} onClick={() => handleActionClick('RETURN')}>
                ส่งคืนแก้ไข
              </Button>
              <Button variant="outlined" color="error" startIcon={<Cancel />} onClick={() => handleActionClick('REJECT')}>
                ปฏิเสธ
              </Button>
              <Button
                variant="contained"
                color="success"
                size="large"
                startIcon={<CheckCircle />}
                onClick={() => handleActionClick('APPROVE')}
                sx={{ px: 4, boxShadow: theme.shadows[4] }}
              >
                อนุมัติคำขอ
              </Button>
            </Stack>
          </Container>
        </Paper>
      )}

      <ApprovalDialog
        open={dialogOpen}
        type={actionType}
        onClose={() => setDialogOpen(false)}
        onConfirm={handleActionConfirm}
      />
    </Container>
  );
}

function InfoItem({ label, value }: { label: string; value: any }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body1" fontWeight={500}>{value || '-'}</Typography>
    </Box>
  );
}
