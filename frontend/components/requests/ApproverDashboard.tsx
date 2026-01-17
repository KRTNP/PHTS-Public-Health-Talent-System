'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  IconButton,
  Tooltip,
  CircularProgress,
  Stack,
  TextField,
  InputAdornment,
  Checkbox,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
} from '@mui/material';
import {
  Visibility,
  Search,
  AssignmentTurnedIn,
  PendingActions,
  CheckCircle,
  PlaylistAddCheck,
  FilterList,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { alpha, useTheme } from '@mui/material/styles';
import * as requestApi from '@/lib/api/requestApi';
import { ScopeItem } from '@/lib/api/requestApi';
import { RequestWithDetails } from '@/types/request.types';
import { AuthService } from '@/lib/api/authApi';
import { ROLE_ROUTES, UserRole } from '@/types/auth';
import StatCard from '@/components/dashboard/StatCard';

interface ApproverDashboardProps {
  allowBatch?: boolean;
}

export default function ApproverDashboard({ allowBatch = false }: ApproverDashboardProps) {
  const router = useRouter();
  const theme = useTheme();
  const [requests, setRequests] = useState<RequestWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [detailBasePath, setDetailBasePath] = useState('/dashboard/approver');

  // State for multi-scope filtering
  const [availableScopes, setAvailableScopes] = useState<ScopeItem[]>([]);
  const [selectedScope, setSelectedScope] = useState<string>('');
  const [showScopeFilter, setShowScopeFilter] = useState(false);

  // State สำหรับ Batch Approval
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchComment, setBatchComment] = useState('');
  const [processingBatch, setProcessingBatch] = useState(false);

  const loadScopes = useCallback(async () => {
    try {
      const scopes = await requestApi.getMyScopes();
      setAvailableScopes(scopes);
      // Show filter if user has multiple scopes
      setShowScopeFilter(scopes.length > 1);
    } catch (error) {
      console.error('Failed to load scopes', error);
    }
  }, []);

  const loadData = useCallback(async (scope?: string) => {
    try {
      setLoading(true);
      const data = await requestApi.getPendingRequests(scope);
      setRequests(data);
      setSelectedIds([]);
    } catch (error) {
      console.error('Failed to load pending approvals', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const currentUser = AuthService.getCurrentUser();
    if (currentUser?.role === UserRole.PTS_OFFICER) {
      setDetailBasePath('/dashboard/officer');
    } else if (currentUser?.role === UserRole.HEAD_HR) {
      setDetailBasePath('/dashboard/hr-head');
    } else if (currentUser?.role === UserRole.HEAD_DEPT) {
      setDetailBasePath('/dashboard/approver');
    } else if (currentUser?.role) {
      setDetailBasePath(ROLE_ROUTES[currentUser.role] || '/dashboard/approver');
    }

    // Load scopes for HEAD_WARD and HEAD_DEPT
    if (currentUser?.role === UserRole.HEAD_WARD || currentUser?.role === UserRole.HEAD_DEPT) {
      loadScopes();
    }

    loadData();
  }, [loadData, loadScopes]);

  // Reload data when scope filter changes
  useEffect(() => {
    if (showScopeFilter) {
      loadData(selectedScope || undefined);
    }
  }, [loadData, selectedScope, showScopeFilter]);

  const filteredRequests = requests.filter((req) =>
    req.requester?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.requester?.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.request_no?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Checkbox Logic
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(filteredRequests.map((r) => r.request_id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: number) => {
    const selectedIndex = selectedIds.indexOf(id);
    let newSelected: number[] = [];

    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selectedIds, id);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selectedIds.slice(1));
    } else if (selectedIndex === selectedIds.length - 1) {
      newSelected = newSelected.concat(selectedIds.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(
        selectedIds.slice(0, selectedIndex),
        selectedIds.slice(selectedIndex + 1),
      );
    }
    setSelectedIds(newSelected);
  };

  const handleBatchConfirm = async () => {
    if (selectedIds.length === 0) return;
    setProcessingBatch(true);
    try {
      await requestApi.batchApproveRequests(selectedIds, batchComment || 'อนุมัติแบบกลุ่ม (Batch Approval)');
      setBatchDialogOpen(false);
      setBatchComment('');
      await loadData();
      alert(`อนุมัติสำเร็จ ${selectedIds.length} รายการ`);
    } catch (error: any) {
      alert('เกิดข้อผิดพลาด: ' + (error.message || 'Unknown error'));
    } finally {
      setProcessingBatch(false);
    }
  };

  if (loading) return <Box textAlign="center" py={8}><CircularProgress /></Box>;

  return (
    <Box>
      {/* 1. Summary Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 2fr' }, gap: 3, mb: 4 }}>
        <StatCard
          title="รอการอนุมัติทั้งหมด"
          value={requests.length}
          icon={<PendingActions fontSize="large" />}
          color="warning"
        />
        <Card sx={{ p: 3, height: '100%', display: 'flex', alignItems: 'center', bgcolor: 'primary.main', color: 'white' }}>
          <Box>
            <Typography variant="h6" fontWeight={700}>ยินดีต้อนรับสู่ระบบอนุมัติ</Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              {allowBatch
                ? 'ท่านสามารถเลือกรายการและกด "อนุมัติรายการที่เลือก" เพื่อดำเนินการพร้อมกันได้'
                : `คุณมีรายการที่ต้องดำเนินการ ${requests.length} รายการ โปรดตรวจสอบความถูกต้องก่อนอนุมัติ`}
            </Typography>
          </Box>
        </Card>
      </Box>

      {/* 2. Toolbar & Batch Actions */}
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems="center" mb={3} spacing={2}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ width: { xs: '100%', md: 'auto' } }}>
          <Typography variant="h6" fontWeight={700} noWrap>
            รายการที่ต้องดำเนินการ
          </Typography>

          {allowBatch && selectedIds.length > 0 && (
            <Button
              variant="contained"
              color="success"
              startIcon={<PlaylistAddCheck />}
              onClick={() => setBatchDialogOpen(true)}
              sx={{ borderRadius: 2, boxShadow: theme.shadows[4] }}
            >
              อนุมัติ {selectedIds.length} รายการ
            </Button>
          )}
        </Stack>

        <Stack direction="row" spacing={2} alignItems="center">
          {showScopeFilter && (
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel id="scope-filter-label">
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <FilterList fontSize="small" />
                  <span>หน่วยงาน</span>
                </Stack>
              </InputLabel>
              <Select
                labelId="scope-filter-label"
                value={selectedScope}
                label="หน่วยงาน"
                onChange={(e) => setSelectedScope(e.target.value)}
              >
                <MenuItem value="">
                  <em>ทั้งหมด ({requests.length})</em>
                </MenuItem>
                {availableScopes.map((scope) => (
                  <MenuItem key={scope.value} value={scope.value}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <span>{scope.label}</span>
                      <Chip
                        label={scope.type === 'UNIT' ? 'งาน' : 'กลุ่มงาน'}
                        size="small"
                        color={scope.type === 'UNIT' ? 'info' : 'secondary'}
                        sx={{ height: 20, fontSize: '0.7rem' }}
                      />
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <TextField
            size="small"
            placeholder="ค้นหาชื่อ หรือ เลขที่เอกสาร..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }}
            sx={{ width: { xs: '100%', md: 300 }, bgcolor: 'background.paper', borderRadius: 1 }}
          />
        </Stack>
      </Stack>

      {/* 3. Data Table */}
      <Card sx={{ borderRadius: 3, boxShadow: theme.shadows[2], overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
              <TableRow>
                {allowBatch && (
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={selectedIds.length > 0 && selectedIds.length < filteredRequests.length}
                      checked={filteredRequests.length > 0 && selectedIds.length === filteredRequests.length}
                      onChange={handleSelectAll}
                    />
                  </TableCell>
                )}
                <TableCell>วันที่ยื่น</TableCell>
                <TableCell>เลขที่เอกสาร</TableCell>
                <TableCell>ผู้ขอ</TableCell>
                <TableCell>ตำแหน่ง</TableCell>
                <TableCell>ประเภท</TableCell>
                <TableCell>ยอดเงิน</TableCell>
                <TableCell align="center">ดูข้อมูล</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={allowBatch ? 8 : 7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    <Stack alignItems="center" spacing={1}>
                      <AssignmentTurnedIn fontSize="large" color="disabled" />
                      <Typography>ไม่พบรายการรออนุมัติ</Typography>
                    </Stack>
                  </TableCell>
                </TableRow>
              ) : (
                filteredRequests.map((req) => {
                  const isSelected = selectedIds.indexOf(req.request_id) !== -1;
                  return (
                    <TableRow key={req.request_id} hover selected={isSelected}>
                      {allowBatch && (
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={isSelected}
                            onChange={() => handleSelectOne(req.request_id)}
                          />
                        </TableCell>
                      )}
                      <TableCell>{new Date(req.created_at).toLocaleDateString('th-TH')}</TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace" fontWeight={600}>
                          {req.request_no}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="subtitle2">
                          {req.requester?.first_name} {req.requester?.last_name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {req.requester?.position}
                        </Typography>
                      </TableCell>
                      <TableCell>{req.request_type}</TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600} color="primary.main">
                          {req.requested_amount?.toLocaleString()} บ.
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="ตรวจสอบและอนุมัติ">
                          <IconButton
                            onClick={() => router.push(`${detailBasePath}/requests/${req.request_id}`)}
                            sx={{
                              color: 'primary.main',
                              bgcolor: alpha(theme.palette.primary.main, 0.1),
                              '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.2) },
                            }}
                          >
                            <Visibility fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Batch Confirm Dialog */}
      <Dialog open={batchDialogOpen} onClose={() => setBatchDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircle color="success" /> ยืนยันการอนุมัติแบบกลุ่ม
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            คุณต้องการอนุมัติรายการที่เลือกจำนวน <strong>{selectedIds.length}</strong> รายการ ใช่หรือไม่?
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={2}
            placeholder="ความเห็นเพิ่มเติม (Optional)"
            variant="outlined"
            value={batchComment}
            onChange={(e) => setBatchComment(e.target.value)}
            sx={{ mt: 2 }}
          />
          <Alert severity="info" sx={{ mt: 2, fontSize: '0.85rem' }}>
            การกระทำนี้จะใช้ลายเซ็นดิจิทัลของคุณประทับลงในทุกรายการที่เลือกทันที
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBatchDialogOpen(false)} disabled={processingBatch}>ยกเลิก</Button>
          <Button
            onClick={handleBatchConfirm}
            variant="contained"
            color="success"
            disabled={processingBatch}
            startIcon={processingBatch ? <CircularProgress size={20} /> : null}
          >
            {processingBatch ? 'กำลังดำเนินการ...' : 'ยืนยันอนุมัติ'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
