/**
 * PHTS System - Back Button Component
 *
 * Modern, consistent back navigation button with smooth hover effects
 */

'use client';

import { Button, ButtonProps } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { alpha } from '@mui/material/styles';

type BackButtonProps = Readonly<
  Omit<ButtonProps, 'onClick'> & {
    to?: string; // ถ้าไม่ใส่ to จะใช้ router.back()
    label?: string;
    onClick?: () => void; // Custom onClick handler (optional)
  }
>;

export default function BackButton({
  to,
  label = 'ย้อนกลับ',
  onClick,
  sx,
  ...props
}: BackButtonProps) {
  const router = useRouter();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (to) {
      router.push(to);
    } else {
      router.back();
    }
  };

  return (
    <Button
      startIcon={<ArrowBack />}
      onClick={handleClick}
      sx={{
        borderRadius: 2,
        fontWeight: 600,
        color: 'text.secondary',
        px: 2,
        '&:hover': {
          color: 'primary.main',
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
          transform: 'translateX(-4px)',
        },
        transition: 'all 0.2s ease',
        ...sx,
      }}
      {...props}
    >
      {label}
    </Button>
  );
}
