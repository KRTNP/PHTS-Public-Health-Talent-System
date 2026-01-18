/**
 * PHTS System - Stat Card Component
 *
 * Soft dashboard card for summary metrics.
 */

'use client';

import { Box, Card, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { ReactNode } from 'react';

type StatCardProps = Readonly<{
  title: string;
  value: string | number;
  icon: ReactNode;
  color?: 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'error';
  trend?: string;
}>;

export default function StatCard({ title, value, icon, color = 'primary', trend }: StatCardProps) {
  const theme = useTheme();

  return (
    <Card sx={{ py: 3, px: 3, height: '100%' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 0.5 }}>
            {title}
          </Typography>
          <Typography variant="h4" sx={{ color: 'text.primary' }}>
            {value}
          </Typography>
          {trend && (
            <Typography variant="caption" sx={{ color: `${color}.main`, fontWeight: 700 }}>
              {trend}
            </Typography>
          )}
        </Box>

        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: alpha(theme.palette[color].main, 0.08),
            color: theme.palette[color].main,
          }}
        >
          {icon}
        </Box>
      </Stack>
    </Card>
  );
}
