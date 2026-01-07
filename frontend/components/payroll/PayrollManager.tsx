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
  IconButton,
  Tooltip,
  Paper,
} from '@mui/material';
import {
  Calculate,
  History,
  Send,
  LockOpen,
  DateRange,
  Save,
  WarningAmber,
  Edit,
} from '@mui/icons-material';
import { useTheme, alpha } from '@mui/material/styles';
import * as payrollApi from '@/lib/api/payrollApi';
import StatCard from '@/components/dashboard/StatCard';

// Mock data for payroll details
const mockPayrollData = [
  {
    id: 1,
    name: 'นายวรวุฒิ เพ็ชรยัง',
    position: 'นักเทคนิคการแพทย์',
    license_exp: '2025-10-14',
    days: 30,
    rate: 1000,
    total: 1000,
    note: '',
  },
  {
    id: 2,
    name: 'นางสาวพรรณารักษ์ มีอาหาร',
    position: 'นักเทคนิคการแพทย์',
    license_exp: '2023-10-15',
    days: 15,
    rate: 1000,
    total: 500,
    note: 'ใบประกอบหมดอายุ 15 ต.ค.',
  },
  {
    id: 3,
    name: 'นางสาวกชนันทน์ เพ็ชรราช',
    position: 'นายแพทย์',
    license_exp: '2026-05-19',
    days: 0,
    rate: 5000,
    total: 0,
    note: 'ลาศึกษาต่อ',
  },
  {
    id: 4,
    name: 'นายสมชาย ใจดี',
    position: 'พยาบาลวิชาชีพ',
    license_exp: '2027-03-20',
    days: 30,
    rate: 1500,
    total: 1500,
    note: '',
  },
  {
    id: 5,
    name: 'นางสมศรี รักษา',
    position: 'เภสัชกร',
    license_exp: '2026-12-15',
    days: 28,
    rate: 2000,
    total: 1867,
    note: 'ลาป่วย 2 วัน',
  },
];

export default function PayrollManager() {
  const theme = useTheme();
  const [currentPeriod, setCurrentPeriod] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [payrollData, setPayrollData] = useState(mockPayrollData);

  useEffect(() => {
    loadCurrentPeriod();
  }, []);

  const loadCurrentPeriod = async () => {
    try {
      setLoading(true);
      // Mock API call (production: payrollApi.getCurrentPeriod())
      setTimeout(() => {
        setCurrentPeriod({
          period_id: 202501,
          month: 1,
          year: 2025,
          status: 'OPEN', // OPEN, CALCULATING, VERIFYING, CLOSED
          total_employees: 150,
          total_amount: 450000,
          retroactive_amount: 12500,
          last_calculated: '2025-01-25T10:00:00',
        });
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  const handleCalculate = async () => {
    setCalculating(true);
    setProgress(0);

    // Simulate Calculation Process
    const interval = setInterval(() => {
      setProgress((oldProgress) => {
        if (oldProgress === 100) {
          clearInterval(interval);
          setCalculating(false);
          loadCurrentPeriod(); // Reload data
          return 100;
        }
        return Math.min(oldProgress + 10, 100);
      });
    }, 500);

    // Production: await payrollApi.calculateMonthly(currentPeriod.period_id);
  };

  const handleClosePeriod = async () => {
    if (!confirm('ยืนยันการปิดงวดและส่งต่อให้ HR ตรวจสอบ?')) return;
    // Production: await payrollApi.submitPeriod(currentPeriod.period_id);
    alert('ส่งข้อมูลให้ HR เรียบร้อยแล้ว');
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
                      {new Date(currentPeriod?.last_calculated).toLocaleString('th-TH')}
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
            <Chip
              label={`${payrollData.length} คน`}
              color="primary"
              variant="outlined"
              sx={{ fontWeight: 600 }}
            />
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
                    ใบประกอบฯ หมดอายุ
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{ fontWeight: 700, bgcolor: alpha(theme.palette.primary.main, 0.05) }}
                  >
                    วันทำงาน
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
                  <TableCell
                    align="center"
                    sx={{ fontWeight: 700, bgcolor: alpha(theme.palette.primary.main, 0.05) }}
                  >
                    แก้ไข
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {payrollData.map((row) => {
                  const isExpired = new Date(row.license_exp) < new Date();
                  const isPartialDays = row.days < 30;
                  const rowBgColor = isPartialDays
                    ? alpha(theme.palette.warning.main, 0.08)
                    : 'inherit';

                  return (
                    <TableRow
                      key={row.id}
                      sx={{
                        bgcolor: rowBgColor,
                        '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.1) },
                      }}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {row.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {row.position}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        {isExpired ? (
                          <Chip
                            icon={<WarningAmber />}
                            label={row.license_exp}
                            color="error"
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.75rem' }}
                          />
                        ) : (
                          <Typography variant="body2">{row.license_exp}</Typography>
                        )}
                      </TableCell>

                      <TableCell align="center">
                        <TextField
                          defaultValue={row.days}
                          size="small"
                          type="number"
                          slotProps={{
                            htmlInput: { min: 0, max: 31, style: { textAlign: 'center' } },
                          }}
                          sx={{
                            width: 70,
                            '& .MuiOutlinedInput-root': {
                              bgcolor: 'background.paper',
                            },
                          }}
                        />
                      </TableCell>

                      <TableCell align="right">
                        <Typography variant="body2" color="text.secondary">
                          {row.rate.toLocaleString()}
                        </Typography>
                      </TableCell>

                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={700} color="primary.main">
                          {row.total.toLocaleString()}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        <TextField
                          defaultValue={row.note}
                          size="small"
                          fullWidth
                          placeholder="ระบุเหตุผล (เช่น ลาเรียน, ย้าย)"
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              bgcolor: 'background.paper',
                            },
                          }}
                        />
                      </TableCell>

                      <TableCell align="center">
                        <Tooltip title="บันทึกการแก้ไข">
                          <IconButton color="primary" size="small">
                            <Save fontSize="small" />
                          </IconButton>
                        </Tooltip>
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
                  {payrollData.reduce((sum, row) => sum + row.total, 0).toLocaleString()} บาท
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
                  บุคลากรที่ทำงานไม่ครบ 30 วัน
                </Typography>
                <Typography variant="h6" fontWeight={700} color="warning.main">
                  {payrollData.filter((r) => r.days < 30).length} คน
                </Typography>
              </Box>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
