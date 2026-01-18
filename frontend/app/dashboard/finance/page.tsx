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
  Alert,
  Skeleton,
} from '@mui/material';
import {
  Description,
  TableChart,
  CheckCircle,
  CalendarMonth,
  Download,
} from '@mui/icons-material';
import { useTheme, alpha } from '@mui/material/styles';
import * as payrollApi from '@/lib/api/payrollApi';
import * as reportApi from '@/lib/api/reportApi';
import StatCard from '@/components/dashboard/StatCard';

export default function FinanceDashboard() {
  const theme = useTheme();
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
      setError(null);
      setDownloading(true);
      if (type === 'summary') {
        await reportApi.downloadSummaryReport(year, month);
      } else {
        await reportApi.downloadDetailReport(year, month);
      }
    } catch (err) {
      console.error('Download failed:', err);
      setError('เกิดข้อผิดพลาดในการดาวน์โหลด');
    } finally {
      setDownloading(false);
    }
  };

  const renderReports = () => {
    if (loading) {
      return (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
            gap: 3,
          }}
        >
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} height={200} variant="rectangular" sx={{ borderRadius: 3 }} />
          ))}
        </Box>
      );
    }

    if (periods.length === 0) {
      return (
        <Card
          sx={{
            p: 5,
            textAlign: 'center',
            bgcolor: alpha(theme.palette.grey[100], 0.5),
            borderRadius: 3,
            border: '2px dashed',
            borderColor: 'divider',
          }}
        >
          <Download sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            ยังไม่มีรายงานที่พร้อมดาวน์โหลด
          </Typography>
          <Typography variant="body2" color="text.secondary">
            กรุณารอเจ้าหน้าที่ปิดงวดและอนุมัติรายการ
          </Typography>
        </Card>
      );
    }

    return (
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
          gap: 3,
        }}
      >
        {periods.map((period) => (
          <Card
            key={period.period_id}
            sx={{
              borderRadius: 3,
              boxShadow: theme.shadows[2],
              transition: 'all 0.3s ease',
              '&:hover': {
                boxShadow: theme.shadows[6],
                transform: 'translateY(-4px)',
              },
            }}
          >
            <CardContent sx={{ p: 3 }}>
              {/* Period Header */}
              <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.success.main, 0.1),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CalendarMonth sx={{ fontSize: 32, color: 'success.main' }} />
                </Box>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" fontWeight={700} color="primary.main">
                    {new Date(0, period.month - 1).toLocaleString('th-TH', { month: 'long' })}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    พ.ศ. {period.year + 543}
                  </Typography>
                </Box>
                <Chip label="พร้อมจ่าย" color="success" size="small" icon={<CheckCircle />} sx={{ fontWeight: 600 }} />
              </Stack>

              {/* Description */}
              <Typography variant="body2" color="text.secondary" mb={3}>
                รายงานการเบิกจ่ายเงิน พ.ต.ส. สำหรับงวดที่ปิดแล้ว
              </Typography>

              {/* Download Buttons */}
              <Stack spacing={1.5}>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<Description />}
                  disabled={downloading}
                  onClick={() => handleDownload('summary', period.year, period.month)}
                  sx={{
                    borderRadius: 2,
                    py: 1.2,
                    fontWeight: 600,
                    textTransform: 'none',
                  }}
                >
                  ดาวน์โหลดใบปะหน้า (Summary)
                </Button>
                <Button
                  variant="contained"
                  fullWidth
                  startIcon={<TableChart />}
                  disabled={downloading}
                  onClick={() => handleDownload('detail', period.year, period.month)}
                  sx={{
                    borderRadius: 2,
                    py: 1.2,
                    fontWeight: 600,
                    textTransform: 'none',
                    boxShadow: theme.shadows[2],
                    '&:hover': {
                      boxShadow: theme.shadows[4],
                    },
                  }}
                >
                  ดาวน์โหลดรายละเอียด (Detail)
                </Button>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Box>
    );
  };

  return (
    <DashboardLayout title="แดชบอร์ดเจ้าหน้าที่การเงิน (Finance Officer)">
      <Box>
        {/* Header Section */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            รายงานการเบิกจ่ายเงิน พ.ต.ส.
          </Typography>
          <Typography color="text.secondary">
            ดาวน์โหลดรายงานและเอกสารประกอบการเบิกจ่ายสำหรับงวดที่ได้รับการอนุมัติแล้ว
          </Typography>
        </Box>

        {/* Summary Card */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 2fr' }, gap: 3, mb: 4 }}>
          <StatCard
            title="งวดพร้อมเบิกจ่าย"
            value={periods.length}
            icon={<CheckCircle fontSize="large" />}
            color="success"
          />
          <Card sx={{ p: 3, height: '100%', display: 'flex', alignItems: 'center', bgcolor: 'success.main', color: 'white' }}>
            <Box>
              <Typography variant="h6" fontWeight={700}>ระบบรายงานการเงิน</Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                งวดที่ผ่านการตรวจสอบและปิดงวดโดยเจ้าหน้าที่แล้ว พร้อมให้ดาวน์โหลดรายงาน
              </Typography>
            </Box>
          </Card>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        {/* Section Title */}
        <Typography variant="h6" fontWeight={700} mb={3}>
          รายการรายงานที่พร้อมดาวน์โหลด
        </Typography>

        {/* Reports Grid */}
        {renderReports()}
      </Box>
    </DashboardLayout>
  );
}
