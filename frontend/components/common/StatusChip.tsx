/**
 * PHTS System - Status Chip Component
 *
 * Reusable status chip with color-coding for request statuses
 */

'use client';

import React from 'react';
import { Chip, ChipProps } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { RequestStatus, REQUEST_STATUS_LABELS } from '@/types/request.types';
import {
  CheckCircle,
  Cancel,
  HourglassEmpty,
  AssignmentReturn,
  Drafts,
} from '@mui/icons-material';

interface StatusChipProps extends ChipProps {
  status: RequestStatus | string;
}

export default function StatusChip({ status, sx, color, size = 'medium', ...props }: StatusChipProps) {
  const theme = useTheme();

  let chipColor: ChipProps['color'] = color ?? 'default';
  let icon: React.ReactNode = undefined;
  const label: React.ReactNode = REQUEST_STATUS_LABELS[status as RequestStatus] || status;

  switch (status) {
    case RequestStatus.APPROVED:
      chipColor = color ?? 'success';
      icon = <CheckCircle />;
      break;
    case RequestStatus.REJECTED:
      chipColor = color ?? 'error';
      icon = <Cancel />;
      break;
    case RequestStatus.PENDING:
      chipColor = color ?? 'warning';
      icon = <HourglassEmpty />;
      break;
    case RequestStatus.DRAFT:
      chipColor = color ?? 'default';
      icon = <Drafts />;
      break;
    case RequestStatus.RETURNED:
      chipColor = color ?? 'warning';
      icon = <AssignmentReturn />;
      break;
    case RequestStatus.CANCELLED:
      chipColor = color ?? 'default';
      icon = <Cancel />;
      break;
    default:
      break;
  }

  return (
    <Chip
      label={label}
      icon={icon}
      color={chipColor}
      size={size}
      variant="filled"
      sx={{
        fontWeight: 700,
        borderRadius: 2,
        px: 1,
        '& .MuiChip-label': {
          px: 1,
        },
        ...(chipColor === 'default' && {
          backgroundColor: theme.palette.grey[400],
          color: theme.palette.common.white,
        }),
        ...sx,
      }}
      {...props}
    />
  );
}
