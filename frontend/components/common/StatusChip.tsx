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
  Edit,
  AssignmentReturn,
  Drafts,
} from '@mui/icons-material';

interface StatusChipProps extends Omit<ChipProps, 'color'> {
  status: RequestStatus | string;
}

export default function StatusChip({ status, sx, ...props }: StatusChipProps) {
  const theme = useTheme();

  let color: ChipProps['color'] = 'default';
  let icon: React.ReactNode = undefined;
  let label: React.ReactNode = REQUEST_STATUS_LABELS[status as RequestStatus] || status;

  switch (status) {
    case RequestStatus.APPROVED:
      color = 'success';
      icon = <CheckCircle />;
      label = 'อนุมัติแล้ว';
      break;
    case RequestStatus.REJECTED:
      color = 'error';
      icon = <Cancel />;
      label = 'ถูกปฏิเสธ';
      break;
    case RequestStatus.PENDING:
      color = 'warning';
      icon = <HourglassEmpty />;
      label = 'รอพิจารณา';
      break;
    case RequestStatus.DRAFT:
      color = 'default';
      icon = <Drafts />;
      label = 'แบบร่าง';
      break;
    case RequestStatus.RETURNED:
      color = 'warning';
      icon = <AssignmentReturn />;
      label = 'ส่งคืนแก้ไข';
      break;
    case RequestStatus.CANCELLED:
      color = 'default';
      icon = <Cancel />;
      label = 'ยกเลิก';
      break;
    default:
      label = status;
  }

  return (
    <Chip
      label={label}
      icon={icon}
      color={color}
      size="medium"
      variant="filled"
      sx={{
        fontWeight: 700,
        borderRadius: 2,
        px: 1,
        '& .MuiChip-label': {
          px: 1,
        },
        ...(color === 'default' && {
          backgroundColor: theme.palette.grey[400],
          color: theme.palette.common.white,
        }),
        ...sx,
      }}
      {...props}
    />
  );
}
