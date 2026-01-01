/**
 * PHTS System - Signature Pad Component
 *
 * HTML5 Canvas-based signature pad for capturing digital signatures.
 * Supports both drawing mode and stored signature mode.
 *
 * Features:
 * - Blue ink stroke drawing
 * - "Use Stored Signature" toggle for approvers
 * - Clear and reset functionality
 * - Export to File/Base64
 *
 * Usage:
 * <SignaturePad
 *   label="ลงชื่อผู้ขอรับเงิน"
 *   onChange={(file) => setSignatureFile(file)}
 *   enableStoredSignature={true}
 * />
 */

'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Button,
  Tooltip,
  CircularProgress,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import GestureIcon from '@mui/icons-material/Gesture';
import CheckIcon from '@mui/icons-material/Check';
import HistoryIcon from '@mui/icons-material/History';
import EditIcon from '@mui/icons-material/Edit';
import { SignatureApi, SignatureData } from '@/lib/api/signatureApi';

type SignatureMode = 'draw' | 'stored';

interface SignaturePadProps {
  label?: string;
  onChange?: (file: File | null) => void;
  onSignatureChange?: (hasSignature: boolean) => void;
  onDataUrlChange?: (dataUrl: string | null) => void;
  width?: number;
  height?: number;
  strokeColor?: string;
  strokeWidth?: number;
  disabled?: boolean;
  required?: boolean;
  error?: boolean;
  helperText?: string;
  initialSignature?: string; // Base64 or URL to load existing signature
  enableStoredSignature?: boolean; // Enable "Use Stored Signature" mode
}

export default function SignaturePad({
  label = 'ลงชื่อ',
  onChange,
  onSignatureChange,
  onDataUrlChange,
  width = 400,
  height = 150,
  strokeColor = '#1565c0', // Blue ink
  strokeWidth = 2,
  disabled = false,
  required = false,
  error = false,
  helperText,
  initialSignature,
  enableStoredSignature = false,
}: SignaturePadProps) {
  const theme = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Stored signature state
  const [mode, setMode] = useState<SignatureMode>('draw');
  const [storedSignature, setStoredSignature] = useState<SignatureData | null>(null);
  const [loadingStored, setLoadingStored] = useState(false);
  const [hasStoredSignature, setHasStoredSignature] = useState(false);

  /**
   * Check if user has a stored signature on mount
   */
  useEffect(() => {
    if (enableStoredSignature) {
      checkStoredSignature();
    }
  }, [enableStoredSignature]);

  /**
   * Check for stored signature availability
   */
  const checkStoredSignature = async () => {
    try {
      const hasStored = await SignatureApi.hasSignature();
      setHasStoredSignature(hasStored);
    } catch (error) {
      console.error('Error checking stored signature:', error);
      setHasStoredSignature(false);
    }
  };

  /**
   * Load stored signature from server
   */
  const loadStoredSignature = async () => {
    setLoadingStored(true);
    try {
      const signature = await SignatureApi.getMySignature();
      if (signature) {
        setStoredSignature(signature);
        setHasSignature(true);
        setIsSaved(true);
        onSignatureChange?.(true);

        // Create File from stored signature and notify parent
        const file = base64ToFile(signature.data_url, `stored_signature_${Date.now()}.png`);
        onChange?.(file);
        onDataUrlChange?.(signature.data_url);
      }
    } catch (error) {
      console.error('Error loading stored signature:', error);
      setStoredSignature(null);
    } finally {
      setLoadingStored(false);
    }
  };

  /**
   * Handle mode change
   */
  const handleModeChange = (_event: React.MouseEvent<HTMLElement>, newMode: SignatureMode | null) => {
    if (!newMode || disabled) return;

    if (newMode === 'stored') {
      // Switch to stored mode - load signature
      setMode('stored');
      loadStoredSignature();
    } else {
      // Switch to draw mode - clear canvas and stored signature
      setMode('draw');
      setStoredSignature(null);
      clearSignature();
    }
  };

  /**
   * Initialize canvas context
   */
  const getContext = useCallback((): CanvasRenderingContext2D | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
    return ctx;
  }, [strokeColor, strokeWidth]);

  /**
   * Get position from mouse or touch event
   */
  const getPosition = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      // Touch event
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    } else {
      // Mouse event
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }
  };

  /**
   * Start drawing
   */
  const startDrawing = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (disabled || mode === 'stored') return;
    e.preventDefault();

    const ctx = getContext();
    if (!ctx) return;

    const pos = getPosition(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
    setHasSignature(true);
    setIsSaved(false);
    onSignatureChange?.(true);
  };

  /**
   * Draw on canvas
   */
  const draw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawing || disabled || mode === 'stored') return;
    e.preventDefault();

    const ctx = getContext();
    if (!ctx) return;

    const pos = getPosition(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  /**
   * Stop drawing and auto-save
   */
  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    // Auto-save signature when drawing stops
    if (hasSignature) {
      saveSignature();
    }
  };

  /**
   * Clear the signature pad
   */
  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    setHasSignature(false);
    setIsSaved(false);
    setStoredSignature(null);
    setMode('draw');
    onChange?.(null);
    onSignatureChange?.(false);
    onDataUrlChange?.(null);
  };

  /**
   * Save signature as File
   */
  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const timestamp = Date.now();
          const file = new File([blob], `signature_${timestamp}.png`, {
            type: 'image/png',
          });
          onChange?.(file);
          onDataUrlChange?.(canvas.toDataURL('image/png'));
          setIsSaved(true);
        }
      },
      'image/png',
      1.0
    );
  };

  /**
   * Get signature as base64 data URL
   */
  const getDataURL = (): string | null => {
    if (mode === 'stored' && storedSignature) {
      return storedSignature.data_url;
    }
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return null;
    return canvas.toDataURL('image/png');
  };

  /**
   * Load initial signature if provided
   */
  useEffect(() => {
    if (initialSignature && canvasRef.current && mode === 'draw') {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
          setHasSignature(true);
          onSignatureChange?.(true);
        };
        img.src = initialSignature;
      }
    }
  }, [initialSignature, onSignatureChange, mode]);

  /**
   * Setup canvas on mount
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Set actual canvas dimensions
      canvas.width = width;
      canvas.height = height;
    }
  }, [width, height]);

  return (
    <Box sx={{ width: '100%' }}>
      {/* Label */}
      {label && (
        <Typography
          variant="body2"
          sx={{
            mb: 1,
            fontWeight: 500,
            color: error ? 'error.main' : 'text.secondary',
          }}
        >
          {label}
          {required && (
            <Typography component="span" color="error.main" sx={{ ml: 0.5 }}>
              *
            </Typography>
          )}
        </Typography>
      )}

      {/* Mode toggle - only show if stored signature is enabled and available */}
      {enableStoredSignature && hasStoredSignature && !disabled && (
        <Box sx={{ mb: 1, '@media print': { display: 'none' } }}>
          <ToggleButtonGroup
            value={mode}
            exclusive
            onChange={handleModeChange}
            size="small"
            aria-label="signature mode"
          >
            <ToggleButton value="draw" aria-label="draw signature">
              <EditIcon fontSize="small" sx={{ mr: 0.5 }} />
              เขียนใหม่
            </ToggleButton>
            <ToggleButton value="stored" aria-label="use stored signature">
              <HistoryIcon fontSize="small" sx={{ mr: 0.5 }} />
              ใช้ลายเซ็นที่บันทึกไว้
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      )}

      {/* Signature Canvas / Stored Signature Display */}
      <Paper
        variant="outlined"
        sx={{
          position: 'relative',
          width: '100%',
          maxWidth: width,
          height: height,
          borderColor: error
            ? 'error.main'
            : hasSignature && isSaved
            ? 'success.main'
            : 'divider',
          borderWidth: error ? 2 : 1,
          borderStyle: 'dashed',
          borderRadius: 1,
          overflow: 'hidden',
          backgroundColor: disabled ? 'action.disabledBackground' : '#fafafa',
          cursor: disabled || mode === 'stored' ? 'default' : 'crosshair',
          '&:hover': {
            borderColor: disabled
              ? undefined
              : error
              ? 'error.main'
              : theme.palette.primary.main,
          },
          '@media print': {
            borderStyle: 'solid',
            borderColor: '#000',
            backgroundColor: 'transparent',
          },
        }}
      >
        {/* Loading spinner for stored signature */}
        {loadingStored && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.8)',
              zIndex: 10,
            }}
          >
            <CircularProgress size={32} />
          </Box>
        )}

        {/* Stored Signature Image */}
        {mode === 'stored' && storedSignature && !loadingStored && (
          <Box
            sx={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src={storedSignature.data_url}
              alt="Stored Signature"
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
              }}
            />
          </Box>
        )}

        {/* Canvas (hidden in stored mode) */}
        <canvas
          ref={canvasRef}
          style={{
            display: mode === 'stored' ? 'none' : 'block',
            width: '100%',
            height: height,
            touchAction: 'none', // Prevent scrolling on touch
          }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />

        {/* Placeholder text when empty (draw mode only) */}
        {!hasSignature && !disabled && mode === 'draw' && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              pointerEvents: 'none',
              color: 'text.disabled',
              '@media print': {
                display: 'none',
              },
            }}
          >
            <GestureIcon sx={{ fontSize: 40, opacity: 0.5, mb: 1 }} />
            <Typography variant="body2" color="text.disabled">
              ลงลายมือชื่อที่นี่
            </Typography>
          </Box>
        )}

        {/* Clear button */}
        {hasSignature && !disabled && (
          <Tooltip title="ล้างลายเซ็น" placement="top">
            <IconButton
              size="small"
              onClick={clearSignature}
              sx={{
                position: 'absolute',
                top: 4,
                right: 4,
                backgroundColor: 'rgba(255,255,255,0.9)',
                '&:hover': {
                  backgroundColor: 'error.light',
                  color: 'white',
                },
                '@media print': {
                  display: 'none',
                },
              }}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        {/* Saved indicator */}
        {isSaved && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 4,
              right: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              color: 'success.main',
              fontSize: '0.75rem',
              '@media print': {
                display: 'none',
              },
            }}
          >
            <CheckIcon sx={{ fontSize: 14 }} />
            <Typography variant="caption" color="success.main">
              {mode === 'stored' ? 'ใช้ลายเซ็นที่บันทึกไว้' : 'บันทึกแล้ว'}
            </Typography>
          </Box>
        )}

        {/* Signature line (for print) */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 20,
            left: '10%',
            right: '10%',
            borderBottom: '1px dotted #999',
            '@media print': {
              borderBottom: '1px dotted #000',
            },
          }}
        />
      </Paper>

      {/* Helper text */}
      {helperText && (
        <Typography
          variant="caption"
          sx={{
            mt: 0.5,
            display: 'block',
            color: error ? 'error.main' : 'text.secondary',
          }}
        >
          {helperText}
        </Typography>
      )}

      {/* Action buttons - hidden on print */}
      <Box
        sx={{
          mt: 1,
          display: 'flex',
          gap: 1,
          '@media print': {
            display: 'none',
          },
        }}
      >
        <Button
          size="small"
          variant="outlined"
          color="error"
          startIcon={<DeleteOutlineIcon />}
          onClick={clearSignature}
          disabled={!hasSignature || disabled}
        >
          ล้าง
        </Button>
      </Box>
    </Box>
  );
}

/**
 * Export utility function to convert base64 to File
 */
export function base64ToFile(base64: string, filename: string): File {
  const arr = base64.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}
