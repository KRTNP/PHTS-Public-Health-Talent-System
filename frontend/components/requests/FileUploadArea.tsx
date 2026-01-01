/**
 * PHTS System - File Upload Area Component
 *
 * Modern drag-and-drop file upload with preview and validation
 */

'use client';

import React, { useState, useCallback, useId, useRef } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Stack,
  Alert,
  Paper,
} from '@mui/material';
import {
  CloudUpload,
  Delete,
  InsertDriveFile,
  Image as ImageIcon,
} from '@mui/icons-material';

interface FileUploadAreaProps {
  files: File[];
  onChange: (files: File[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  acceptedTypes?: string[];
  showList?: boolean;
}

const DEFAULT_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
const DEFAULT_MAX_SIZE_MB = 5;

export default function FileUploadArea({
  files,
  onChange,
  maxFiles = 5,
  maxSizeMB = DEFAULT_MAX_SIZE_MB,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  showList = true,
}: FileUploadAreaProps) {
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const validateFile = useCallback(
    (file: File): string | null => {
      // Check file type
      if (!acceptedTypes.includes(file.type)) {
        return `ประเภทไฟล์ไม่รองรับ: ${file.name}. รองรับเฉพาะ PDF และรูปภาพ (JPG, PNG)`;
      }

      // Check file size
      const fileSizeMB = file.size / (1024 * 1024);
      if (fileSizeMB > maxSizeMB) {
        return `ไฟล์ ${file.name} มีขนาดใหญ่เกินไป (${fileSizeMB.toFixed(2)}MB). ขนาดสูงสุด ${maxSizeMB}MB`;
      }

      return null;
    },
    [acceptedTypes, maxSizeMB]
  );

  const handleFileSelect = useCallback(
    (selectedFiles: FileList | null) => {
      if (!selectedFiles || selectedFiles.length === 0) return;

      setError(null);

      const newFiles = Array.from(selectedFiles);

      // Check max files limit
      if (files.length + newFiles.length > maxFiles) {
        setError(`สามารถอัพโหลดได้สูงสุด ${maxFiles} ไฟล์`);
        return;
      }

      // Validate each file
      for (const file of newFiles) {
        const validationError = validateFile(file);
        if (validationError) {
          setError(validationError);
          return;
        }
      }

      // Add valid files
      onChange([...files, ...newFiles]);
    },
    [files, maxFiles, onChange, validateFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect]
  );

  const handleRemoveFile = useCallback(
    (index: number) => {
      const newFiles = files.filter((_, i) => i !== index);
      onChange(newFiles);
      setError(null);
    },
    [files, onChange]
  );

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <ImageIcon sx={{ fontSize: 40, color: 'info.main' }} />;
    }
    return <InsertDriveFile sx={{ fontSize: 40, color: 'error.main' }} />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <Box>
      {/* Upload Area */}
      <Paper
        variant="outlined"
        sx={{
          p: 3,
          textAlign: 'center',
          borderStyle: 'dashed',
          borderWidth: 2,
          borderColor: isDragging ? 'primary.main' : 'divider',
          backgroundColor: isDragging ? 'action.hover' : 'background.paper',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          '&:hover': {
            borderColor: 'primary.main',
            backgroundColor: 'action.hover',
          },
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        id={inputId}
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png"
        style={{ display: 'none' }}
        ref={inputRef}
        onChange={(e) => handleFileSelect(e.target.files)}
      />
        <CloudUpload sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
        <Typography variant="body1" fontWeight={500} gutterBottom>
          คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่
        </Typography>
        <Typography variant="caption" color="text.secondary">
          รองรับไฟล์ PDF, JPG, PNG (ขนาดสูงสุด {maxSizeMB}MB ต่อไฟล์)
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          อัพโหลดได้สูงสุด {maxFiles} ไฟล์
        </Typography>
      </Paper>

      {/* Error Message */}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* File List */}
      {showList && files.length > 0 && (
        <Stack spacing={1} sx={{ mt: 2 }}>
          <Typography variant="subtitle2" color="text.secondary">
            ไฟล์ที่เลือก ({files.length}/{maxFiles})
          </Typography>
          {files.map((file, index) => (
            <Paper
              key={index}
              variant="outlined"
              sx={{
                p: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              {getFileIcon(file)}
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography variant="body2" noWrap>
                  {file.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatFileSize(file.size)}
                </Typography>
              </Box>
              <IconButton
                size="small"
                color="error"
                onClick={() => handleRemoveFile(index)}
                aria-label="ลบไฟล์"
              >
                <Delete />
              </IconButton>
            </Paper>
          ))}
        </Stack>
      )}
    </Box>
  );
}
