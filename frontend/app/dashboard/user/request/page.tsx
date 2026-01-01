/**
 * PHTS System - User Request Page
 *
 * Page for creating new PTS requests with A4 paper-style form
 * Includes digital signature support
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Snackbar, Alert, Button } from '@mui/material';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import RequestForm from '@/components/requests/RequestForm';
import { CreateRequestDTO } from '@/types/request.types';
import * as requestApi from '@/lib/api/requestApi';
import { ArrowBack } from '@mui/icons-material';

export default function UserRequestPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const handleSubmit = async (
    data: CreateRequestDTO,
    files: File[],
    signatureFile?: File,
    licenseFile?: File
  ) => {
    setIsSubmitting(true);
    try {
      // Create request with signature (keep signature separate from attachments)
      const request = await requestApi.createRequest(data, files, signatureFile, licenseFile);

      // Automatically submit the request (move from DRAFT to PENDING)
      await requestApi.submitRequest(request.request_id);

      // Show success message
      setToast({
        open: true,
        message: 'ส่งคำขอสำเร็จ! กำลังนำคุณไปยังหน้ารายการคำขอ...',
        severity: 'success',
      });

      // Redirect to user dashboard after 2 seconds
      setTimeout(() => {
        router.push('/dashboard/user');
      }, 2000);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการส่งคำขอ';
      setToast({
        open: true,
        message: errorMessage,
        severity: 'error',
      });
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = async (data: CreateRequestDTO) => {
    setIsSubmitting(true);
    try {
      // Create request as draft (don't submit)
      await requestApi.createRequest(data, []);

      setToast({
        open: true,
        message: 'บันทึกร่างสำเร็จ!',
        severity: 'success',
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการบันทึก';
      setToast({
        open: true,
        message: errorMessage,
        severity: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push('/dashboard/user');
  };

  const handleCloseToast = () => {
    setToast({ ...toast, open: false });
  };

  return (
    <DashboardLayout title="ยื่นคำขอรับค่าตอบแทน พ.ต.ส.">
      <Box
        sx={{
          backgroundColor: '#f4f6f8',
          minHeight: '100vh',
          py: 2,
          '@media print': {
            backgroundColor: 'transparent',
            py: 0,
          },
        }}
      >
        <Box mb={2}>
          <Button
            variant="outlined"
            startIcon={<ArrowBack />}
            onClick={() => router.push('/dashboard/user')}
            sx={{ borderRadius: 2, fontWeight: 600 }}
          >
            Back to dashboard
          </Button>
        </Box>
        <RequestForm
          onSubmit={handleSubmit}
          onSaveDraft={handleSaveDraft}
          onCancel={handleCancel}
          isSubmitting={isSubmitting}
        />
      </Box>

      {/* Toast Notification */}
      <Snackbar
        open={toast.open}
        autoHideDuration={6000}
        onClose={handleCloseToast}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseToast}
          severity={toast.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </DashboardLayout>
  );
}
