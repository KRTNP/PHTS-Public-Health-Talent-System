/**
 * FilePreviewList
 *
 * Reusable list with preview/remove actions for File or file-like objects.
 */
'use client';

import React, { useEffect, useState } from 'react';
import {
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
} from '@mui/material';
import { Visibility, InsertDriveFile, DeleteOutline } from '@mui/icons-material';

type FileLike = File | { name: string; size?: number; type?: string; url?: string };

type FilePreviewListProps = Readonly<{
  files: FileLike[];
  onPreview?: (file: FileLike) => void;
  onRemove?: (index: number) => void;
  readOnly?: boolean;
}>;

export default function FilePreviewList({ files, onPreview, onRemove, readOnly }: FilePreviewListProps) {
  const [previewFile, setPreviewFile] = useState<FileLike | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileKey = (file: FileLike) => {
    const size = typeof (file as any).size === 'number' ? (file as any).size : 'na';
    const url = (file as any).url || '';
    const lastModified = file instanceof File ? file.lastModified : '';
    return `${file.name}-${size}-${lastModified}-${url}`;
  };
  const openInNewTab = (url: string) => {
    if (globalThis.window !== undefined) {
      globalThis.window.open(url, '_blank');
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl && globalThis.URL?.revokeObjectURL !== undefined) {
        globalThis.URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handlePreview = (file: FileLike) => {
    if (onPreview) {
      onPreview(file);
      return;
    }
    if ((file as any).url) {
      openInNewTab((file as any).url);
      return;
    }
    if (file instanceof File || (typeof Blob !== 'undefined' && file instanceof Blob)) {
      if (globalThis.URL?.createObjectURL === undefined) return;
      const url = globalThis.URL.createObjectURL(file as File);
      setPreviewFile(file);
      setPreviewUrl(url);
    }
  };

  const handleClose = () => {
    if (previewUrl && globalThis.URL?.revokeObjectURL !== undefined) {
      globalThis.URL.revokeObjectURL(previewUrl);
    }
    setPreviewFile(null);
    setPreviewUrl(null);
  };

  const renderPreviewContent = () => {
    if (!previewFile || !previewUrl) return null;
    const fileType = (previewFile as any).type || '';
    if (fileType.startsWith('image/')) {
      return (
        <Box component="img" src={previewUrl} alt={previewFile.name} sx={{ maxWidth: '100%', height: 'auto', borderRadius: 1 }} />
      );
    }
    if (fileType === 'application/pdf') {
      return (
        <Box
          component="object"
          data={previewUrl}
          type="application/pdf"
          sx={{ width: '100%', height: { xs: 360, md: 520 }, borderRadius: 1 }}
        >
          <Typography variant="body2" color="text.secondary">
            ไม่สามารถพรีวิวไฟล์ PDF ได้ในเบราเซอร์นี้ โปรดกด &quot;เปิดในแท็บใหม่&quot;
          </Typography>
        </Box>
      );
    }
    return (
      <Typography variant="body2" color="text.secondary">
        ไม่รองรับการพรีวิวไฟล์ประเภทนี้ กด &quot;เปิดในแท็บใหม่&quot; เพื่อดาวน์โหลด/ดูไฟล์
      </Typography>
    );
  };

  if (!files.length) return null;

  return (
    <>
      <List dense sx={{ mt: 1 }}>
        {files.map((file, index) => {
          const showPreview = !readOnly;
          const showRemove = onRemove && !readOnly;
          const actions = showPreview || showRemove ? (
            <>
              {showPreview && (
                <Tooltip title="พรีวิว">
                  <IconButton edge="end" onClick={() => handlePreview(file)} sx={{ mr: showRemove ? 1 : 0 }}>
                    <Visibility />
                  </IconButton>
                </Tooltip>
              )}
              {showRemove && (
                <Tooltip title="ลบ">
                  <IconButton edge="end" color="error" onClick={() => onRemove(index)}>
                    <DeleteOutline />
                  </IconButton>
                </Tooltip>
              )}
            </>
          ) : null;
          return (
          <ListItem
            key={fileKey(file)}
            divider
            secondaryAction={actions}
            sx={{ bgcolor: 'grey.50', borderRadius: 1, mb: 0.5 }}
          >
            <ListItemIcon>
              <InsertDriveFile color="primary" />
            </ListItemIcon>
            <ListItemText
              primary={file.name}
              secondary={
                typeof (file as any).size === 'number'
                  ? `${(((file as any).size as number) / 1024 / 1024).toFixed(2)} MB`
                  : undefined
              }
              slotProps={{ primary: { noWrap: true } }}
            />
          </ListItem>
          );
        })}
      </List>

      <Dialog open={Boolean(previewFile)} onClose={handleClose} fullWidth maxWidth="md">
        <DialogTitle>{previewFile?.name || 'พรีวิวไฟล์'}</DialogTitle>
        <DialogContent dividers>{renderPreviewContent()}</DialogContent>
        <DialogActions>
          {previewUrl && (
            <Button onClick={() => openInNewTab(previewUrl)} startIcon={<Visibility />}>
              เปิดในแท็บใหม่
            </Button>
          )}
          <Button onClick={handleClose}>ปิด</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
