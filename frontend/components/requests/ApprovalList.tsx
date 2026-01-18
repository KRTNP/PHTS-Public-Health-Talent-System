'use client';

import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Box,
  Skeleton,
  Alert,
  Stack,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  Divider,
  Chip,
  Avatar,
  Button,
  Checkbox,
  Toolbar,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { CheckCircle, Cancel, Undo, Visibility, Person, AccessTime, AttachMoney, DoneAll } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { RequestWithDetails, REQUEST_TYPE_LABELS } from '@/types/request.types';
import StatusChip from '@/components/common/StatusChip';
import ApprovalDialog from './ApprovalDialog';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

type ApprovalListProps = Readonly<{
  requests: RequestWithDetails[];
  loading?: boolean;
  error?: string | null;
  onApprove: (requestId: number, comment?: string) => Promise<void>;
  onReject: (requestId: number, comment: string) => Promise<void>;
  onReturn: (requestId: number, comment: string) => Promise<void>;
  onRefresh?: () => void;
  showQuickActions?: boolean;
  basePath?: string;
  enableBatchSelection?: boolean;
  onBatchApprove?: (ids: number[]) => Promise<void>;
}>;

export default function ApprovalList({
  requests,
  loading = false,
  error = null,
  onApprove,
  onReject,
  onReturn,
  onRefresh,
  showQuickActions = true,
  basePath = '/dashboard/user/requests',
  enableBatchSelection = false,
  onBatchApprove,
}: ApprovalListProps) {
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RequestWithDetails | null>(null);
  const [currentAction, setCurrentAction] = useState<'APPROVE' | 'REJECT' | 'RETURN'>('APPROVE');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const handleSelectAllClick = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const newSelecteds = requests.map((n) => n.request_id);
      setSelectedIds(newSelecteds);
      return;
    }
    setSelectedIds([]);
  };

  const handleClick = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds((prev) => prev.filter((value) => value !== id));
      return;
    }
    setSelectedIds((prev) => [...prev, id]);
  };

  const handleBatchApproveClick = async () => {
    if (!onBatchApprove || selectedIds.length === 0) return;
    setIsSubmitting(true);
    try {
      await onBatchApprove(selectedIds);
      setSelectedIds([]);
      onRefresh?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSelected = (id: number) => selectedIds.includes(id);

  const handleOpenDialog = (request: RequestWithDetails, action: 'APPROVE' | 'REJECT' | 'RETURN') => {
    setSelectedRequest(request);
    setCurrentAction(action);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    if (!isSubmitting) {
      setDialogOpen(false);
      setSelectedRequest(null);
    }
  };

  const handleConfirm = async (comment: string) => {
    if (!selectedRequest) return;
    setIsSubmitting(true);
    try {
      if (currentAction === 'APPROVE') await onApprove(selectedRequest.request_id, comment);
      else if (currentAction === 'REJECT') await onReject(selectedRequest.request_id, comment);
      else if (currentAction === 'RETURN') await onReturn(selectedRequest.request_id, comment);

      handleCloseDialog();
      onRefresh?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleView = (requestId: number) => {
    router.push(`${basePath}/${requestId}`);
  };

  if (loading) return <Box p={2}><Skeleton height={100} /><Skeleton height={100} /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (requests.length === 0) {
    return (
      <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3, bgcolor: 'grey.50', border: '1px dashed #ddd' }}>
        <Typography color="text.secondary">ไม่มีรายการรออนุมัติ</Typography>
      </Paper>
    );
  }

  const renderBatchToolbar = () => {
    if (!enableBatchSelection || selectedIds.length === 0) return null;
    return (
      <Toolbar
        sx={{
          pl: { sm: 2 },
          pr: { xs: 1, sm: 1 },
          bgcolor: (theme) => alpha(theme.palette.primary.main, theme.palette.action.activatedOpacity),
        }}
      >
        <Typography sx={{ flex: '1 1 100%' }} color="inherit" variant="subtitle1" component="div">
          เลือก {selectedIds.length} รายการ
        </Typography>
        <Tooltip title="อนุมัติทั้งหมดที่เลือก">
          <Button
            variant="contained"
            color="success"
            startIcon={<DoneAll />}
            onClick={handleBatchApproveClick}
            disabled={isSubmitting}
          >
            อนุมัติกลุ่ม
          </Button>
        </Tooltip>
      </Toolbar>
    );
  };

  // Mobile view as cards
  if (isMobile) {
    return (
      <Stack spacing={2}>
        {renderBatchToolbar()}
        {requests.map((req) => {
          const isItemSel = isSelected(req.request_id);
          return (
            <Card
              key={req.request_id}
              variant="outlined"
              sx={{
                borderRadius: 3,
                borderColor: isItemSel ? 'primary.main' : 'grey.200',
                bgcolor: isItemSel ? 'primary.lighter' : 'background.paper',
                position: 'relative',
              }}
            >
            <CardContent>
              {enableBatchSelection && (
                <Box sx={{ position: 'absolute', top: 10, right: 10 }}>
                  <Checkbox
                    checked={isItemSel}
                    onChange={() => handleClick(req.request_id)}
                    color="primary"
                  />
                </Box>
              )}
              <Stack direction="row" justifyContent="space-between" mb={2}>
                <Chip
                  label={`#${req.request_id}`}
                  size="small"
                  sx={{ bgcolor: 'grey.100', fontWeight: 600, color: 'text.secondary' }}
                />
                <StatusChip status={req.status} size="small" />
              </Stack>

              <Stack direction="row" spacing={2} alignItems="center" mb={2}>
                <Avatar sx={{ bgcolor: 'primary.light', color: 'primary.dark' }}>
                  <Person />
                </Avatar>
                <Box>
                  <Typography variant="subtitle1" fontWeight={700}>
                    {req.requester?.citizen_id || 'ไม่ระบุ'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {req.department_group || 'ไม่ระบุแผนก'}
                  </Typography>
                </Box>
              </Stack>

              <Divider sx={{ my: 1.5 }} />

              <Box
                mb={2}
                sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}
              >
                <Box>
                  <Typography variant="caption" color="text.secondary">วันที่ยื่น</Typography>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <AccessTime fontSize="inherit" color="action" />
                    <Typography variant="body2" fontWeight={500}>
                      {format(new Date(req.created_at), 'd MMM yy', { locale: th })}
                    </Typography>
                  </Stack>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">ยอดเงิน</Typography>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <AttachMoney fontSize="inherit" color="success" />
                    <Typography variant="body2" fontWeight={700} color="success.main">
                      {req.requested_amount?.toLocaleString() || '-'}
                    </Typography>
                  </Stack>
                </Box>
              </Box>

              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => handleView(req.request_id)}
                  startIcon={<Visibility />}
                >
                  ตรวจสอบรายละเอียด
                </Button>
                {showQuickActions && (
                  <>
                    <Button
                      variant="contained"
                      color="success"
                      fullWidth
                      onClick={() => handleOpenDialog(req, 'APPROVE')}
                      startIcon={<CheckCircle />}
                      disableElevation
                    >
                      อนุมัติ
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      sx={{ minWidth: 40 }}
                      onClick={() => handleOpenDialog(req, 'REJECT')}
                    >
                      <Cancel />
                    </Button>
                  </>
                )}
              </Stack>
            </CardContent>
          </Card>
        );
        })}
        {showQuickActions && (
          <ApprovalDialog
            open={dialogOpen}
            type={currentAction}
            onClose={handleCloseDialog}
            onConfirm={handleConfirm}
          />
        )}
      </Stack>
    );
  }

  // Desktop table view
  return (
    <>
      <Paper sx={{ width: '100%', mb: 2, borderRadius: 3, overflow: 'hidden' }} elevation={0} variant="outlined">
        {renderBatchToolbar()}
        <TableContainer>
          <Table sx={{ minWidth: 650 }}>
          <TableHead sx={{ bgcolor: 'primary.50' }}>
            <TableRow>
              {enableBatchSelection && (
                <TableCell padding="checkbox">
                  <Checkbox
                    color="primary"
                    indeterminate={selectedIds.length > 0 && selectedIds.length < requests.length}
                    checked={requests.length > 0 && selectedIds.length === requests.length}
                    onChange={handleSelectAllClick}
                  />
                </TableCell>
              )}
              <TableCell sx={{ fontWeight: 700, color: 'primary.dark' }}>ผู้ยื่นคำขอ</TableCell>
              <TableCell sx={{ fontWeight: 700, color: 'primary.dark' }}>ประเภท/วันที่</TableCell>
              <TableCell sx={{ fontWeight: 700, color: 'primary.dark' }}>ยอดเงิน</TableCell>
              <TableCell sx={{ fontWeight: 700, color: 'primary.dark' }}>สถานะ</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, color: 'primary.dark' }}>ดำเนินการ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {requests.map((req) => {
              const isItemSel = isSelected(req.request_id);
              return (
              <TableRow
                key={req.request_id}
                hover
                role="checkbox"
                aria-checked={isItemSel}
                selected={isItemSel}
                sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
              >
                {enableBatchSelection && (
                  <TableCell padding="checkbox">
                    <Checkbox
                      color="primary"
                      checked={isItemSel}
                      onChange={() => handleClick(req.request_id)}
                    />
                  </TableCell>
                )}
                <TableCell>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.lighter', color: 'primary.main', fontSize: 14 }}>
                      <Person fontSize="inherit" />
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle2" fontWeight={600}>
                        {req.requester?.citizen_id || 'ไม่ระบุ'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {req.department_group}
                      </Typography>
                    </Box>
                  </Stack>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight={500}>{REQUEST_TYPE_LABELS[req.request_type]}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {format(new Date(req.created_at), 'd MMM yyyy', { locale: th })}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight={700} color="success.main">
                    {req.requested_amount?.toLocaleString()} บาท
                  </Typography>
                </TableCell>
                <TableCell><StatusChip status={req.status} size="small" /></TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button size="small" variant="outlined" startIcon={<Visibility />} onClick={() => handleView(req.request_id)}>
                      รายละเอียด
                    </Button>
                    {showQuickActions && (
                      <>
                        <Tooltip title="อนุมัติทันที">
                          <IconButton
                            size="small"
                            color="success"
                            sx={{ bgcolor: 'success.lighter', '&:hover': { bgcolor: 'success.light' } }}
                            onClick={() => handleOpenDialog(req, 'APPROVE')}
                          >
                            <CheckCircle />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="ตีกลับ/ไม่อนุมัติ">
                          <IconButton
                            size="small"
                            color="error"
                            sx={{ bgcolor: 'error.lighter', '&:hover': { bgcolor: 'error.light' } }}
                            onClick={() => handleOpenDialog(req, 'RETURN')}
                          >
                            <Undo />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      {showQuickActions && (
        <ApprovalDialog
          open={dialogOpen}
          type={currentAction}
          onClose={handleCloseDialog}
          onConfirm={handleConfirm}
        />
      )}
    </>
  );
}
