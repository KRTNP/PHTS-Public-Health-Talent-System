import React from 'react';
import { Box, Typography } from '@mui/material';

type RequestInfoRowProps = Readonly<{
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}>;

export default function RequestInfoRow({ label, value, highlight = false }: RequestInfoRowProps) {
  return (
    <Box mb={2}>
      <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
        {label}
      </Typography>
      <Typography
        variant="body1"
        fontWeight={highlight ? 700 : 500}
        color={highlight ? 'primary.main' : 'text.primary'}
        sx={{ wordBreak: 'break-word' }}
      >
        {value || '-'}
      </Typography>
    </Box>
  );
}
