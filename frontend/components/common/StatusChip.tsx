/**
 * PHTS System - Status Chip Component
 *
 * Reusable status chip with color-coding for request statuses
 */

'use client';

import { Chip, ChipProps } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { RequestStatus, REQUEST_STATUS_LABELS } from '@/types/request.types';

type StatusChipProps = Readonly<
  ChipProps & {
    status: RequestStatus | string;
  }
>;

const STATUS_COLOR_MAP: Record<string, ChipProps['color']> = {
  [RequestStatus.DRAFT]: 'default',
  [RequestStatus.PENDING]: 'warning',
  [RequestStatus.APPROVED]: 'success',
  [RequestStatus.REJECTED]: 'error',
  [RequestStatus.RETURNED]: 'warning',
  [RequestStatus.CANCELLED]: 'default',
};

export default function StatusChip({ status, sx, color, size = 'small', ...props }: StatusChipProps) {
  const theme = useTheme();
  const chipColor: ChipProps['color'] = color ?? STATUS_COLOR_MAP[status] ?? 'default';
  const label: React.ReactNode = REQUEST_STATUS_LABELS[status as RequestStatus] || status;
  const isDefault = chipColor === 'default';

  return (
    <Chip
      label={label}
      size={size}
      sx={{
        fontWeight: 600,
        borderRadius: '8px',
        backgroundColor: isDefault
          ? theme.palette.grey[200]
          : alpha(theme.palette[chipColor].main, 0.16),
        color: isDefault ? theme.palette.grey[800] : theme.palette[chipColor].dark,
        border: 'none',
        ...sx,
      }}
      {...props}
    />
  );
}
