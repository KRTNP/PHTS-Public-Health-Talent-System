'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Box, Button, Card, CardContent, Stack, Typography, Alert, Chip } from '@mui/material';
import * as payrollApi from '@/lib/api/payrollApi';

type PayrollApprovalPanelProps = Readonly<{
  requiredStatus: string;
  title: string;
  approveLabel: string;
  onApprove: (periodId: number) => Promise<unknown>;
  onReject: (periodId: number) => Promise<unknown>;
}>;

export default function PayrollApprovalPanel({
  requiredStatus,
  title,
  approveLabel,
  onApprove,
  onReject,
}: PayrollApprovalPanelProps) {
  const [period, setPeriod] = useState<payrollApi.PayrollPeriod | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPeriods = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const periods = await payrollApi.getPeriods();
      const pending = periods.find((p) => p.status === requiredStatus) || null;
      setPeriod(pending);
    } catch (err: any) {
      setError(err.message || 'Failed to load payroll period');
    } finally {
      setLoading(false);
    }
  }, [requiredStatus]);

  useEffect(() => {
    loadPeriods();
  }, [loadPeriods]);

  const handleApprove = async () => {
    if (!period) return;
    try {
      setWorking(true);
      await onApprove(period.period_id);
      await loadPeriods();
    } catch (err: any) {
      setError(err.message || 'Approval failed');
    } finally {
      setWorking(false);
    }
  };

  const handleReject = async () => {
    if (!period) return;
    if (!confirm('Reject this payroll period?')) return;
    try {
      setWorking(true);
      await onReject(period.period_id);
      await loadPeriods();
    } catch (err: any) {
      setError(err.message || 'Rejection failed');
    } finally {
      setWorking(false);
    }
  };

  const renderPeriodContent = () => {
    if (loading) {
      return <Typography color="text.secondary">Loading period...</Typography>;
    }

    if (!period) {
      return <Typography color="text.secondary">No pending period for approval.</Typography>;
    }

    return (
      <Box>
        <Stack direction="row" spacing={2} alignItems="center" mb={2}>
          <Typography variant="body1" fontWeight={600}>
            Period {period.month}/{period.year}
          </Typography>
          <Chip label={period.status} size="small" variant="outlined" />
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Button variant="contained" color="success" onClick={handleApprove} disabled={working}>
            {approveLabel}
          </Button>
          <Button variant="outlined" color="error" onClick={handleReject} disabled={working}>
            Reject Period
          </Button>
        </Stack>
      </Box>
    );
  };

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              {title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Review and approve the current payroll period.
            </Typography>
          </Box>

          {error && <Alert severity="error">{error}</Alert>}

          {renderPeriodContent()}
        </Stack>
      </CardContent>
    </Card>
  );
}
