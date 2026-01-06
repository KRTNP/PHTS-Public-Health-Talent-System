'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Stack,
  Divider,
  Alert,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import {
  Description,
  TableChart,
  CheckCircle,
} from '@mui/icons-material';
import * as payrollApi from '@/lib/api/payrollApi';
import * as reportApi from '@/lib/api/reportApi';

export default function FinanceDashboard() {
  const [periods, setPeriods] = useState<payrollApi.PayrollPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetchClosedPeriods();
  }, []);

  const fetchClosedPeriods = async () => {
    try {
      setLoading(true);
      const allPeriods = await payrollApi.getPeriods();
      const closedOnly = allPeriods.filter((p) => p.status === 'CLOSED');
      setPeriods(closedOnly);
    } catch (err: any) {
      setError(err.message || 'ไม่สามารถดึงข้อมูลงวดได้');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (type: 'summary' | 'detail', year: number, month: number) => {
    try {
      setDownloading(true);
      if (type === 'summary') {
        await reportApi.downloadSummaryReport(year, month);
      } else {
        await reportApi.downloadDetailReport(year, month);
      }
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการดาวน์โหลด');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <DashboardLayout title="แดชบอร์ดเจ้าหน้าที่การเงิน (Finance Officer)">
      <Stack spacing={4}>
        <Box>
          <Typography variant="h4" fontWeight={600} gutterBottom>
            ระบบเบิกจ่ายเงิน พ.ต.ส.
          </Typography>
          <Typography variant="body1" color="text.secondary">
            ดาวน์โหลดรายงานและเอกสารประกอบการเบิกจ่ายสำหรับงวดที่ได้รับการอนุมัติแล้ว
          </Typography>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        <Card sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={2} mb={3}>
              <CheckCircle color="success" fontSize="large" />
              <Box>
                <Typography variant="h6" fontWeight={700}>
                  รายการงวดที่พร้อมเบิกจ่าย (Closed Periods)
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  งวดที่ผ่านการตรวจสอบและปิดงวดโดยเจ้าหน้าที่แล้ว
                </Typography>
              </Box>
            </Stack>

            <Divider sx={{ mb: 3 }} />

            {loading ? (
              <Stack spacing={2}>
                <Skeleton height={60} variant="rectangular" sx={{ borderRadius: 2 }} />
                <Skeleton height={60} variant="rectangular" sx={{ borderRadius: 2 }} />
              </Stack>
            ) : periods.length === 0 ? (
              <Box sx={{ p: 5, textAlign: 'center', bgcolor: 'grey.50', borderRadius: 2, border: '1px dashed #ddd' }}>
                <Typography color="text.secondary">ยังไม่มีงวดที่ถูกปิด (กรุณารอเจ้าหน้าที่ปิดงวด)</Typography>
              </Box>
            ) : (
              <TableContainer component={Paper} elevation={0} variant="outlined">
                <Table>
                  <TableHead sx={{ bgcolor: 'grey.100' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>งวดเดือน/ปี</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>สถานะ</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>ดาวน์โหลดรายงาน</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {periods.map((p) => (
                      <TableRow key={p.period_id} hover>
                        <TableCell>
                          <Typography variant="subtitle1" fontWeight={600} color="primary.main">
                            {new Date(0, p.month - 1).toLocaleString('th-TH', { month: 'long' })} {p.year + 543}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label="พร้อมจ่าย" color="success" size="small" variant="outlined" icon={<CheckCircle />} />
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={2} justifyContent="flex-end">
                            <Button
                              variant="outlined"
                              startIcon={<Description />}
                              disabled={downloading}
                              onClick={() => handleDownload('summary', p.year, p.month)}
                            >
                              ใบปะหน้า (Summary)
                            </Button>
                            <Button
                              variant="contained"
                              startIcon={<TableChart />}
                              disabled={downloading}
                              onClick={() => handleDownload('detail', p.year, p.month)}
                              disableElevation
                            >
                              รายละเอียด (Detail)
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      </Stack>
    </DashboardLayout>
  );
}
