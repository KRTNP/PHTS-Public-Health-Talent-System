/**
 * Approval History List
 *
 * Searchable history table for approver actions.
 */

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Card,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { Search, Visibility } from '@mui/icons-material';
import StatusChip from '@/components/common/StatusChip';
import { useRouter } from 'next/navigation';
import { getApprovalHistory } from '@/lib/api/requestApi';
import { AuthService } from '@/lib/api/authApi';
import { ROLE_ROUTES, UserRole } from '@/types/auth';

type HistoryRow = {
  request_id: number;
  request_no?: string;
  requester?: {
    first_name?: string;
    last_name?: string;
    position?: string;
  };
  request_type?: string;
  status?: string;
  updated_at?: string;
};

const STATUS_FILTERS = ['ALL', 'APPROVED', 'REJECTED', 'RETURNED'] as const;

export default function ApprovalHistoryList() {
  const theme = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<HistoryRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<(typeof STATUS_FILTERS)[number]>('ALL');
  const [detailBasePath, setDetailBasePath] = useState('/dashboard/approver');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const res = await getApprovalHistory();
        setData(res as HistoryRow[]);
      } catch (error) {
        console.error('Error fetching history:', error);
      } finally {
        setLoading(false);
      }
    };

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

    fetchHistory();
  }, []);

  const filteredData = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return data.filter((row) => {
      const matchesSearch =
        row.request_no?.toLowerCase().includes(query) ||
        row.requester?.first_name?.toLowerCase().includes(query) ||
        row.requester?.last_name?.toLowerCase().includes(query);

      const matchesStatus = filterStatus === 'ALL' || row.status === filterStatus;

      return matchesSearch && matchesStatus;
    });
  }, [data, searchTerm, filterStatus]);

  const searchInputProps = {
    startAdornment: (
      <InputAdornment position="start">
        <Search color="action" />
      </InputAdornment>
    ),
  };

  const renderTableBody = () => {
    if (loading) {
      return (
        <TableRow>
          <TableCell colSpan={6} align="center">
            <CircularProgress />
          </TableCell>
        </TableRow>
      );
    }

    if (filteredData.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.secondary' }}>
            ไม่พบประวัติการดำเนินการ
          </TableCell>
        </TableRow>
      );
    }

    return filteredData.map((row) => (
      <TableRow key={row.request_id} hover>
        <TableCell>
          {row.updated_at ? new Date(row.updated_at).toLocaleDateString('th-TH') : '-'}
        </TableCell>
        <TableCell>
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {row.request_no}
          </Typography>
        </TableCell>
        <TableCell>
          <Typography variant="subtitle2">
            {row.requester?.first_name} {row.requester?.last_name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {row.requester?.position}
          </Typography>
        </TableCell>
        <TableCell>{row.request_type}</TableCell>
        <TableCell>
          <StatusChip status={row.status ?? ''} />
        </TableCell>
        <TableCell align="center">
          <IconButton
            size="small"
            color="primary"
            onClick={() => router.push(`${detailBasePath}/requests/${row.request_id}`)}
          >
            <Visibility fontSize="small" />
          </IconButton>
        </TableCell>
      </TableRow>
    ));
  };

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <TextField
          placeholder="ค้นหาชื่อ หรือ เลขที่เอกสาร..."
          size="small"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          sx={{ flexGrow: 1, bgcolor: 'background.paper', borderRadius: 1 }}
          slotProps={{ input: searchInputProps }}
        />

        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          {STATUS_FILTERS.map((status) => (
            <Chip
              key={status}
              label={status === 'ALL' ? 'ทั้งหมด' : status}
              onClick={() => setFilterStatus(status)}
              color={filterStatus === status ? 'primary' : 'default'}
              variant={filterStatus === status ? 'filled' : 'outlined'}
              sx={{ fontWeight: 500 }}
            />
          ))}
        </Stack>
      </Stack>

      <Card sx={{ borderRadius: 3, boxShadow: theme.shadows[2], overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
              <TableRow>
                <TableCell>วันที่ดำเนินการ</TableCell>
                <TableCell>เลขที่เอกสาร</TableCell>
                <TableCell>ผู้ยื่นคำขอ</TableCell>
                <TableCell>ประเภท</TableCell>
                <TableCell>ผลการพิจารณา</TableCell>
                <TableCell align="center">ดูข้อมูล</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {renderTableBody()}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
}
