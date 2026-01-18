'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Stack,
  LinearProgress,
  Alert,
  Divider,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Paper,
} from '@mui/material';
import {
  Calculate,
  History,
  Send,
  LockOpen,
  DateRange,
} from '@mui/icons-material';
import { useTheme, alpha } from '@mui/material/styles';
import * as payrollApi from '@/lib/api/payrollApi';

export default function PayrollManager() {
  const theme = useTheme();
  const [currentPeriod, setCurrentPeriod] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [payrollData, setPayrollData] = useState<payrollApi.PayrollPayout[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadCurrentPeriod();
  }, []);

  const loadCurrentPeriod = async (showRefresh = false) => {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const period = await payrollApi.getCurrentPeriod();
      setCurrentPeriod({
        ...period,
        total_employees: period.total_headcount ?? 0,
        retroactive_amount: 0,
        last_calculated: null,
      });
      if (period?.period_id) {
        const payouts = await payrollApi.getPeriodPayouts(period.period_id);
        setPayrollData(payouts);
      } else {
        setPayrollData([]);
      }
      setLoading(false);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
    if (showRefresh) {
      setRefreshing(false);
    }
  };

  const handleCalculate = async () => {
    if (!currentPeriod?.year || !currentPeriod?.month) return;
    try {
      setCalculating(true);
      setProgress(10);
      if (currentPeriod?.period_id) {
        await payrollApi.calculatePeriod(currentPeriod.period_id);
      } else {
        await payrollApi.calculateMonthly(currentPeriod.year, currentPeriod.month);
      }
      setProgress(100);
      await loadCurrentPeriod(true);
    } catch (error) {
      console.error(error);
      alert('ไม่สามารถคำนวณเงินเดือนได้');
    } finally {
      setCalculating(false);
    }
  };

  const handleClosePeriod = async () => {
    if (!confirm('ยืนยันการปิดงวดและส่งต่อให้ HR ตรวจสอบ?')) return;
    if (!currentPeriod?.period_id) return;
    try {
      await payrollApi.submitPeriod(currentPeriod.period_id);
      alert('ส่งข้อมูลให้ HR เรียบร้อยแล้ว');
      await loadCurrentPeriod(true);
    } catch (error) {
      console.error(error);
      alert('ไม่สามารถส่งงวดเดือนไปอนุมัติได้');
    }
  };

  if (loading) return <LinearProgress />;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        ศูนย์ควบคุมการจ่ายเงิน (Payroll Center)
      </Typography>

      {/* 1. Current Period Status Card */}
      <Card
        sx={{
          mb: 4,
          bgcolor: 'primary.dark',
          color: 'white',
          background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
          boxShadow: theme.shadows[4],
        }}
      >
        <CardContent sx={{ p: 4 }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 3,
              alignItems: 'center',
            }}
          >
            <Box>
              <Stack direction="row" spacing={2} alignItems="center" mb={1}>
                <DateRange fontSize="large" />
                <Typography variant="h4" fontWeight={800}>
                  งวดเดือน{' '}
                  {new Date(0, currentPeriod?.month - 1).toLocaleString('th-TH', { month: 'long' })}{' '}
                  {(currentPeriod?.year || 0) + 543}
                </Typography>
              </Stack>
              <Chip
                label={currentPeriod?.status === 'OPEN' ? 'กำลังเปิดใช้งาน' : 'ปิดงวดแล้ว'}
                color={currentPeriod?.status === 'OPEN' ? 'success' : 'default'}
                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 600 }}
              />
            </Box>
            <Box sx={{ textAlign: { xs: 'left', md: 'right' } }}>
              <Typography variant="body1" sx={{ opacity: 0.8 }}>
                ยอดรวมสุทธิ (ประมาณการ)
              </Typography>
              <Typography variant="h2" fontWeight={700}>
                {currentPeriod?.total_amount.toLocaleString()}{' '}
                <span style={{ fontSize: '1.5rem' }}>บาท</span>
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                + ตกเบิก {currentPeriod?.retroactive_amount.toLocaleString()} บาท
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* 2. Control Panel */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 3 }}>
        {/* Actions */}
        <Box>
          <Card variant="outlined" sx={{ borderRadius: 3, height: '100%' }}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} mb={3}>
                เครื่องมือประมวลผล
              </Typography>

              {calculating ? (
                <Box sx={{ width: '100%', mt: 4, mb: 4 }}>
                  <Typography variant="body2" gutterBottom>
                    กำลังคำนวณเงินและตรวจสอบเงื่อนไขวันลา... ({progress}%)
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={progress}
                    sx={{ height: 10, borderRadius: 5 }}
                  />
                </Box>
              ) : (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                    gap: 2,
                  }}
                >
                  <Box>
                    <Button
                      fullWidth
                      variant="contained"
                      size="large"
                      startIcon={<Calculate />}
                      onClick={handleCalculate}
                      disabled={currentPeriod?.status !== 'OPEN'}
                      sx={{
                        py: 2,
                        bgcolor: 'warning.main',
                        '&:hover': { bgcolor: 'warning.dark' },
                      }}
                    >
                      1. ประมวลผลเงินเดือน
                    </Button>
                    <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                      คำนวณยอดเงินตามวันทำงานจริงและหักวันลา
                    </Typography>
                  </Box>

                  <Box>
                    <Button
                      fullWidth
                      variant="contained"
                      size="large"
                      startIcon={<History />}
                      onClick={handleCalculate}
                      disabled={currentPeriod?.status !== 'OPEN'}
                      sx={{ py: 2, bgcolor: 'info.main', '&:hover': { bgcolor: 'info.dark' } }}
                    >
                      2. คำนวณตกเบิก (Retro)
                    </Button>
                    <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                      ตรวจสอบยอดค้างจ่ายย้อนหลังอัตโนมัติ
                    </Typography>
                  </Box>

                  <Box sx={{ gridColumn: { xs: '1', sm: 'span 2' } }}>
                    <Divider sx={{ my: 2 }} />
                    <Button
                      fullWidth
                      variant="contained"
                      size="large"
                      startIcon={<Send />}
                      onClick={handleClosePeriod}
                      disabled={currentPeriod?.status !== 'OPEN'}
                      sx={{ py: 2, bgcolor: 'success.main', fontSize: '1.1rem' }}
                    >
                      3. ปิดงวดและส่งต่อให้ HR
                    </Button>
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>

        {/* Status & Alerts */}
        <Box>
          <Stack spacing={3}>
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                  สถานะระบบ
                </Typography>
                <Stack spacing={2}>
                  <Alert severity="success" icon={<LockOpen />}>
                    งวดเดือน: เปิดใช้งาน
                  </Alert>
                  <Alert severity="info">จำนวนบุคลากร: {currentPeriod?.total_employees} คน</Alert>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      ประมวลผลล่าสุด:
                    </Typography>
                    <Typography variant="body2">
                      {currentPeriod?.last_calculated
                        ? new Date(currentPeriod.last_calculated).toLocaleString('th-TH')
                        : '-'}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                  Workflow Status
                </Typography>
                <Stack spacing={1}>
                  <Chip label="1. Officer (กำลังดำเนินการ)" color="primary" />
                  <Chip label="2. HR Review" variant="outlined" />
                  <Chip label="3. Finance Review" variant="outlined" />
                  <Chip label="4. Director Approval" variant="outlined" />
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Box>
      </Box>

      {/* Payroll Detail Table */}
      <Card variant="outlined" sx={{ borderRadius: 3, mt: 4 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
            <Box>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                ตารางปรับปรุงยอดเงินรายบุคคล
              </Typography>
              <Typography variant="body2" color="text.secondary">
                ตรวจสอบและแก้ไขยอดเงินของแต่ละคนก่อนส่งอนุมัติ
              </Typography>
            </Box>
            <Stack direction="row" spacing={2} alignItems="center">
              <Chip
                label={`${payrollData.length} คน`}
                color="primary"
                variant="outlined"
                sx={{ fontWeight: 600 }}
              />
              <Button
                variant="outlined"
                size="small"
                onClick={() => loadCurrentPeriod(true)}
                disabled={refreshing}
              >
                รีเฟรชรายการ
              </Button>
            </Stack>
          </Stack>

          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{ maxHeight: 500, borderRadius: 2 }}
          >
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell
                    sx={{ fontWeight: 700, bgcolor: alpha(theme.palette.primary.main, 0.05) }}
                  >
                    ชื่อ-สกุล
                  </TableCell>
                  <TableCell
                    sx={{ fontWeight: 700, bgcolor: alpha(theme.palette.primary.main, 0.05) }}
                  >
                    วันทำงาน
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{ fontWeight: 700, bgcolor: alpha(theme.palette.primary.main, 0.05) }}
                  >
                    หักวันลา
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{ fontWeight: 700, bgcolor: alpha(theme.palette.primary.main, 0.05) }}
                  >
                    อัตราเต็ม (บาท)
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{ fontWeight: 700, bgcolor: alpha(theme.palette.primary.main, 0.05) }}
                  >
                    ยอดสุทธิ (บาท)
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 700,
                      bgcolor: alpha(theme.palette.primary.main, 0.05),
                      minWidth: 200,
                    }}
                  >
                    หมายเหตุ
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {payrollData.map((row) => {
                  const eligibleDays = Number(row.eligible_days ?? 0);
                  const deductedDays = Number(row.deducted_days ?? 0);
                  const rowBgColor = deductedDays > 0
                    ? alpha(theme.palette.warning.main, 0.08)
                    : 'inherit';
                  const fullName = `${row.first_name || ''} ${row.last_name || ''}`.trim() || row.citizen_id;

                  return (
                    <TableRow
                      key={row.payout_id}
                      sx={{
                        bgcolor: rowBgColor,
                        '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.1) },
                      }}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {fullName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {row.position_name || '-'}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        <Typography variant="body2">{eligibleDays.toFixed(2)}</Typography>
                      </TableCell>

                      <TableCell align="center">
                        <Typography variant="body2">{deductedDays.toFixed(2)}</Typography>
                      </TableCell>

                      <TableCell align="right">
                        <Typography variant="body2" color="text.secondary">
                          {Number(row.rate || 0).toLocaleString()}
                        </Typography>
                      </TableCell>

                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={700} color="primary.main">
                          {Number(row.total_payable || 0).toLocaleString()}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        <TextField
                          defaultValue={row.remark || ''}
                          size="small"
                          fullWidth
                          placeholder="ระบุเหตุผล (เช่น ลาเรียน, ย้าย)"
                          slotProps={{ input: { readOnly: true } }}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              bgcolor: 'background.paper',
                            },
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          <Box
            sx={{
              mt: 3,
              p: 2,
              bgcolor: alpha(theme.palette.info.main, 0.05),
              borderRadius: 2,
              border: '1px dashed',
              borderColor: 'info.main',
            }}
          >
            <Stack direction="row" spacing={4}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  ยอดรวมที่คำนวณได้
                </Typography>
                <Typography variant="h6" fontWeight={700} color="info.main">
                  {payrollData
                    .reduce((sum, row) => sum + Number(row.total_payable || 0), 0)
                    .toLocaleString()} บาท
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  จำนวนบุคลากรทั้งหมด
                </Typography>
                <Typography variant="h6" fontWeight={700}>
                  {payrollData.length} คน
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  บุคลากรที่มีการหักวันลา
                </Typography>
                <Typography variant="h6" fontWeight={700} color="warning.main">
                  {payrollData.filter((r) => Number(r.deducted_days || 0) > 0).length} คน
                </Typography>
              </Box>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
