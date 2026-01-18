import React from 'react';
import { Paper, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import FilePreviewList from '@/components/common/FilePreviewList';
import type { RequestAttachment } from '@/types/request.types';

type RequestAttachmentsPanelProps = Readonly<{
  attachments?: RequestAttachment[];
  title?: string;
  emptyLabel?: string;
  paperSx?: SxProps<Theme>;
}>;

export default function RequestAttachmentsPanel({
  attachments,
  title = 'เอกสารแนบ',
  emptyLabel = 'ไม่มีเอกสารแนบ',
  paperSx,
}: RequestAttachmentsPanelProps) {
  const files =
    attachments?.map((file) => ({
      name: file.original_filename || file.file_name || '',
      size: file.file_size,
      type: file.mime_type,
    })) ?? [];

  return (
    <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, ...paperSx }}>
      <Typography variant="h6" fontWeight={700} gutterBottom>
        {title}
      </Typography>
      {files.length > 0 ? (
        <FilePreviewList files={files as any} readOnly />
      ) : (
        <Typography color="text.secondary">{emptyLabel}</Typography>
      )}
    </Paper>
  );
}
