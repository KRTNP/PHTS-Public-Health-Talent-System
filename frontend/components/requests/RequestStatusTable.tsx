'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
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
  TextField,
  InputAdornment,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { Visibility, Edit, LinearScale, Search } from '@mui/icons-material';
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
  const [searchTerm, setSearchTerm] = useState('');

  const getStepLabel = (step: number, status: RequestStatus | string) => {
    if (status === RequestStatus.APPROVED) return 'อนุมัติแล้ว';
    if (status === RequestStatus.DRAFT) return 'ฉบับร่าง';
    const steps = [
      '',
      '1. หัวหน้าตึกตรวจสอบ',
      '2. หัวหน้ากลุ่มงานพิจารณา',
      '3. เจ้าหน้าที่ พ.ต.ส. ตรวจเอกสาร',
      '4. หัวหน้า HR ตรวจสอบ',
      '5. หัวหน้าการเงินพิจารณา',
      '6. ผู้อำนวยการอนุมัติ',
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

  const filteredRequests = requests.filter((req) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;
    return (
      req.request_no?.toLowerCase().includes(query) ||
      req.request_type.toLowerCase().includes(query)
    );
  });

  if (isMobile) {
    return (
      <Card sx={{ borderRadius: 3, boxShadow: theme.shadows[2], overflow: 'hidden' }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', sm: 'center' }}
          spacing={2}
          sx={{ p: 2, bgcolor: 'background.paper' }}
        >
          <Typography variant="h6" fontWeight={700}>
            รายการคำขอ
          </Typography>
          <TextField
            size="small"
            placeholder="ค้นหาเลขที่เอกสาร..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search color="action" />
                </InputAdornment>
              ),
            }}
          />
        </Stack>

        {loading ? (
          <Box sx={{ p: 4, textAlign: 'center', bgcolor: '#f5f5f5', borderTop: '1px dashed #ccc' }}>
            <Typography color="text.secondary">กำลังโหลดข้อมูล...</Typography>
          </Box>
        ) : filteredRequests.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center', bgcolor: '#f5f5f5', borderTop: '1px dashed #ccc' }}>
            <Typography color="text.secondary">ไม่พบรายการคำขอ</Typography>
            <Button variant="contained" sx={{ mt: 2 }} onClick={() => router.push('/dashboard/user/request')}>
              ยื่นคำขอใหม่
            </Button>
          </Box>
        ) : (
          <Stack spacing={2} sx={{ p: 2, bgcolor: 'background.default' }}>
            {filteredRequests.map((req) => (
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
                        {req.request_no || 'ไม่ระบุเลขเอกสาร'}
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
                        {REQUEST_TYPE_LABELS[req.request_type] || req.request_type}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        จำนวน
                      </Typography>
                      <Typography variant="body2" fontWeight={700} color="success.main">
                        {req.requested_amount?.toLocaleString() || '-'} บาท
                      </Typography>
                    </Box>
                    <Box sx={{ gridColumn: '1 / -1' }}>
                      <Typography variant="caption" color="text.secondary">
                        ขั้นตอน
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
        )}
      </Card>
    );
  }

  return (
    <Card sx={{ borderRadius: 3, boxShadow: theme.shadows[2], overflow: 'hidden' }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        spacing={2}
        sx={{ p: 2, bgcolor: 'background.paper' }}
      >
        <Typography variant="h6" fontWeight={700}>
          รายการคำขอ
        </Typography>
        <TextField
          size="small"
          placeholder="ค้นหาเลขที่เอกสาร..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search color="action" />
              </InputAdornment>
            ),
          }}
        />
      </Stack>

      {loading ? (
        <Box sx={{ p: 4, textAlign: 'center', bgcolor: '#f5f5f5', borderTop: '1px dashed #ccc' }}>
          <Typography color="text.secondary">กำลังโหลดข้อมูล...</Typography>
        </Box>
      ) : filteredRequests.length === 0 ? (
        <Box sx={{ p: 4, textAlign: 'center', bgcolor: '#f5f5f5', borderTop: '1px dashed #ccc' }}>
          <Typography color="text.secondary">ไม่พบรายการคำขอ</Typography>
          <Button variant="contained" sx={{ mt: 2 }} onClick={() => router.push('/dashboard/user/request')}>
            ยื่นคำขอใหม่
          </Button>
        </Box>
      ) : (
        <TableContainer>
          <Table sx={{ minWidth: 650 }}>
            <TableHead sx={{ bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04) }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>วันที่ยื่นคำขอ</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>เลขที่เอกสาร</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>ประเภท</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>ขั้นตอน/สถานะ</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>จำนวน (บาท)</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>สถานะ</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>
                  ดูรายละเอียด
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRequests.map((req) => (
                <TableRow key={req.request_id} hover>
                  <TableCell>{formatDate(req.created_at)}</TableCell>
                  <TableCell>{req.request_no || '-'}</TableCell>
                  <TableCell>{REQUEST_TYPE_LABELS[req.request_type] || req.request_type}</TableCell>
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
                    <Stack direction="row" spacing={1} justifyContent="center">
                      <Tooltip title="ดูรายละเอียด">
                        <IconButton
                          onClick={() => handleView(req.request_id)}
                          sx={{
                            color: 'primary.main',
                            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                            '&:hover': {
                              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.2),
                            },
                            borderRadius: 1.5,
                          }}
                        >
                          <Visibility fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {(req.status === RequestStatus.DRAFT || req.status === RequestStatus.RETURNED) && (
                        <Tooltip title="แก้ไข">
                          <IconButton
                            sx={{
                              color: 'warning.main',
                              bgcolor: (theme) => alpha(theme.palette.warning.main, 0.1),
                              '&:hover': {
                                bgcolor: (theme) => alpha(theme.palette.warning.main, 0.2),
                              },
                              borderRadius: 1.5,
                            }}
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Card>
  );
}
