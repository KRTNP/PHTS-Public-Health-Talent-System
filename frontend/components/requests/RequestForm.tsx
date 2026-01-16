'use client';

import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Paper,
  TextField,
  Button,
  Typography,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  CircularProgress,
  Alert,
  Checkbox,
  Stack,
  Divider,
  Stepper,
  Step,
  StepLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {
  NavigateNext,
  NavigateBefore,
  Person,
  Work,
  AttachMoney,
  Description,
  RateReview,
  CheckCircleOutline,
} from '@mui/icons-material';
import {
  PersonnelType,
  PERSONNEL_TYPE_LABELS,
  RequestType,
  REQUEST_TYPE_LABELS,
  WorkAttributes,
  WORK_ATTRIBUTE_LABELS,
  CreateRequestDTO,
} from '@/types/request.types';
import { UserProfile } from '@/types/auth';
import FileUploadArea from './FileUploadArea';
import FilePreviewList from '@/components/common/FilePreviewList';
import SignaturePad from '@/components/common/SignaturePad';
import { AuthService } from '@/lib/api/authApi';
import { apiClient } from '@/lib/axios';

const STEPS = [
  { label: 'ประเภทข้อมูล', icon: <Person /> },
  { label: 'ข้อมูลตำแหน่ง', icon: <Work /> },
  { label: 'รายละเอียดเงิน', icon: <AttachMoney /> },
  { label: 'เอกสารแนบ', icon: <Description /> },
  { label: 'ยืนยันและลงนาม', icon: <RateReview /> },
];

interface RequestFormProps {
  onSubmit: (
    data: CreateRequestDTO,
    files: File[],
    signatureFile?: File,
    licenseFile?: File,
  ) => Promise<void>;
  onSaveDraft?: (data: CreateRequestDTO, files: File[]) => Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

export default function RequestForm({
  onSubmit,
  onSaveDraft,
  isSubmitting = false,
}: RequestFormProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [activeStep, setActiveStep] = useState(0);
  const [userInfo, setUserInfo] = useState<UserProfile | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // --- ลบ State isEditMode ออกแล้ว ---

  const [openReviewDialog, setOpenReviewDialog] = useState(false);
  const [classification, setClassification] = useState<any>(null);
  const [loadingClass, setLoadingClass] = useState(false);
  const [classError, setClassError] = useState<string | null>(null);
  // Form Data
  const [personnelType, setPersonnelType] = useState<PersonnelType | ''>('');
  const [requestType, setRequestType] = useState<RequestType | ''>('');
  const [positionNumber, setPositionNumber] = useState('');
  const [departmentGroup, setDepartmentGroup] = useState('');
  const [mainDuty, setMainDuty] = useState('');
  const [workAttributes, setWorkAttributes] = useState<WorkAttributes>({
    operation: false,
    planning: false,
    coordination: false,
    service: false,
  });
  const [requestedAmount, setRequestedAmount] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptLegal, setAcceptLegal] = useState(false);

  // Helper function to convert ISO datetime to yyyy-MM-dd format for HTML date inputs
  const formatDateForInput = (dateString: string | null | undefined): string => {
    if (!dateString) return '';
    try {
      // Handle ISO format dates (e.g., "2004-05-10T17:00:00.000Z")
      if (dateString.includes('T')) {
        return dateString.split('T')[0];
      }
      // Already in yyyy-MM-dd format
      return dateString;
    } catch {
      return '';
    }
  };

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = AuthService.getCurrentUser();
        if (user) {
          setUserInfo(user);
          // Auto-fill logic
          if (user.department) setDepartmentGroup(user.department);
          if (user.position_number) setPositionNumber(user.position_number);
          if (user.mission_group) setMainDuty(user.mission_group);
          if (user.start_current_position) setEffectiveDate(formatDateForInput(user.start_current_position));

          if (!personnelType) {
            // Logic เลือกประเภทบุคลากรอัตโนมัติ (คงเดิม)
            const emp = (user.employee_type || '').toLowerCase();
            if (emp.includes('ราชการ') && !emp.includes('กระทรวงสาธารณสุข'))
              setPersonnelType(PersonnelType.CIVIL_SERVANT);
            else if (emp.includes('พนักงานราชการ')) setPersonnelType(PersonnelType.GOV_EMPLOYEE);
            else if (emp.includes('กระทรวงสาธารณสุข') || emp.includes('พกส'))
              setPersonnelType(PersonnelType.PH_EMPLOYEE);
            else setPersonnelType(PersonnelType.TEMP_EMPLOYEE);
          }
          if (!requestType) setRequestType(Object.keys(REQUEST_TYPE_LABELS)[0] as RequestType);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingUser(false);
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    if (activeStep === 2) fetchClassification();
  }, [activeStep]);

  const fetchClassification = async () => {
    setLoadingClass(true);
    setClassError(null);
    try {
      const res = await apiClient.get('/api/requests/classification');
      if (res.data?.success) {
        const data = res.data.data;
        setClassification(data);
        if (typeof data?.rate_amount === 'number') setRequestedAmount(String(data.rate_amount));
        if (data?.start_work_date) {
          setEffectiveDate(formatDateForInput(data.start_work_date));
        }
      } else {
        setClassError('ไม่สามารถดึงข้อมูลสิทธิ์ได้');
      }
    } catch (err) {
      setClassError('เกิดข้อผิดพลาดในการเชื่อมต่อระบบ');
    } finally {
      setLoadingClass(false);
    }
  };

  const handleWorkAttributeChange = (key: keyof WorkAttributes) => {
    setWorkAttributes((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const validateStep = (step: number): boolean => {
    setError(null);
    if (step === 0 && (!personnelType || !requestType)) {
      setError('กรุณาระบุข้อมูลให้ครบถ้วน');
      return false;
    }
    if (step === 1) {
      if (!positionNumber.trim() || !departmentGroup.trim() || !mainDuty.trim()) {
        setError('กรุณากรอกข้อมูลให้ครบถ้วน');
        return false;
      }
      if (!Object.values(workAttributes).some((v) => v)) {
        setError('กรุณาเลือกมาตรฐานด้านตำแหน่งอย่างน้อย 1 ข้อ');
        return false;
      }
    }
    if (step === 2 && !effectiveDate) {
      setError('กรุณาระบุวันที่เริ่มมีผล');
      return false;
    }
    if (step === 4 && (!hasSignature || !acceptLegal)) {
      setError('กรุณาลงนามและยอมรับเงื่อนไข');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep((p) => p + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  const handleBack = () => {
    setActiveStep((p) => p - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const handleOpenReview = () => {
    if (validateStep(4)) setOpenReviewDialog(true);
  };

  const handleConfirmSubmit = async () => {
    try {
      setOpenReviewDialog(false);
      const formData: CreateRequestDTO = {
        personnel_type: personnelType as PersonnelType,
        position_number: positionNumber.trim(),
        department_group: departmentGroup.trim(),
        main_duty: mainDuty.trim(),
        work_attributes: workAttributes,
        request_type: requestType as RequestType,
        requested_amount:
          classification?.rate_amount ?? parseFloat(requestedAmount.replace(/,/g, '') || '0'),
        effective_date: effectiveDate,
      };

      // Debug logging to help identify the issue
      console.log('Submitting request with data:', {
        ...formData,
        hasFiles: files.length,
        hasSignature: !!signatureFile,
        hasLicense: !!licenseFile,
      });

      await onSubmit(formData, files, signatureFile || undefined, licenseFile || undefined);
    } catch (err: any) {
      console.error('Request submission error:', err);
      console.error('Error response:', err.response?.data);
      setError(err.response?.data?.error || err.message || 'เกิดข้อผิดพลาด');
    }
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Stack spacing={3}>
            <Box>
              <Typography variant="h6" gutterBottom fontWeight={600} color="primary.main">
                1.1 สถานะบุคลากร
              </Typography>
              <FormControl component="fieldset">
                <RadioGroup
                  value={personnelType}
                  onChange={(e) => setPersonnelType(e.target.value as PersonnelType)}
                >
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                      gap: 2,
                    }}
                  >
                    {Object.entries(PERSONNEL_TYPE_LABELS).map(([key, label]) => (
                      <Paper
                        key={key}
                        variant="outlined"
                        sx={{
                          p: 2,
                          pr: 6,
                          borderRadius: 2,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          position: 'relative',
                          border:
                            personnelType === key
                              ? `2px solid ${theme.palette.primary.main}`
                              : '1px solid #9e9e9e',
                          bgcolor: personnelType === key ? 'primary.50' : 'transparent',
                          boxShadow:
                            personnelType === key ? '0 4px 12px rgba(25, 118, 210, 0.15)' : 'none',
                        }}
                        onClick={() => setPersonnelType(key as PersonnelType)}
                      >
                        {personnelType === key && (
                          <CheckCircleOutline
                            color="primary"
                            sx={{ position: 'absolute', top: 14, right: 14 }}
                          />
                        )}
                        <FormControlLabel
                          value={key}
                          control={<Radio sx={{ display: 'none' }} />}
                          label={<Typography fontWeight={600}>{label}</Typography>}
                          sx={{ m: 0, width: '100%' }}
                        />
                      </Paper>
                    ))}
                  </Box>
                </RadioGroup>
              </FormControl>
            </Box>
            <Divider />
            <Box>
              <Typography variant="h6" gutterBottom fontWeight={600} color="primary.main">
                1.2 วัตถุประสงค์การยื่นคำขอ
              </Typography>
              <FormControl component="fieldset">
                <RadioGroup
                  value={requestType}
                  onChange={(e) => setRequestType(e.target.value as RequestType)}
                >
                  <Stack spacing={2}>
                    {Object.entries(REQUEST_TYPE_LABELS).map(([key, label]) => (
                      <Paper
                        key={key}
                        variant="outlined"
                        sx={{
                          p: 1.5,
                          pr: 6,
                          borderRadius: 2,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          position: 'relative',
                          border:
                            requestType === key
                              ? `2px solid ${theme.palette.primary.main}`
                              : '1px solid #9e9e9e',
                          bgcolor: requestType === key ? 'primary.50' : 'transparent',
                          boxShadow:
                            requestType === key ? '0 4px 12px rgba(25, 118, 210, 0.15)' : 'none',
                        }}
                        onClick={() => setRequestType(key as RequestType)}
                      >
                        {requestType === key && (
                          <CheckCircleOutline
                            color="primary"
                            sx={{ position: 'absolute', top: 12, right: 12 }}
                          />
                        )}
                        <FormControlLabel
                          value={key}
                          control={<Radio sx={{ display: 'none' }} />}
                          label={<Typography fontWeight={500}>{label}</Typography>}
                          sx={{ width: '100%', m: 0 }}
                        />
                      </Paper>
                    ))}
                  </Stack>
                </RadioGroup>
              </FormControl>
            </Box>
          </Stack>
        );

      case 1:
        return (
          <Stack spacing={3}>
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  2. ข้อมูลตำแหน่ง
                </Typography>
                <Alert severity="info" icon={<Person />} sx={{ mb: 2 }}>
                  <Typography variant="subtitle2">
                    ข้อมูลจากระบบ: {userInfo?.first_name} {userInfo?.last_name} (
                    {userInfo?.position})
                  </Typography>
                </Alert>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                    gap: 3,
                  }}
                >
                  <TextField
                    label="เลขที่ตำแหน่ง"
                    fullWidth
                    required
                    variant="outlined"
                    value={positionNumber}
                    onChange={(e) => setPositionNumber(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    label="กลุ่มงาน/แผนก"
                    fullWidth
                    required
                    variant="outlined"
                    value={departmentGroup}
                    onChange={(e) => setDepartmentGroup(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    label="ปฏิบัติหน้าที่หลัก"
                    fullWidth
                    required
                    variant="outlined"
                    value={mainDuty}
                    onChange={(e) => setMainDuty(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Box>
              </CardContent>
            </Card>
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  ลักษณะการปฏิบัติงาน (เลือกได้มากกว่า 1 ข้อ)
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                    gap: 2,
                  }}
                >
                  {Object.entries(WORK_ATTRIBUTE_LABELS).map(([key, label]) => (
                    <Paper
                      key={key}
                      variant="outlined"
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        border: workAttributes[key as keyof WorkAttributes]
                          ? `2px solid ${theme.palette.primary.main}`
                          : '1px solid #9e9e9e',
                        bgcolor: workAttributes[key as keyof WorkAttributes]
                          ? 'primary.50'
                          : 'transparent',
                      }}
                      onClick={() => handleWorkAttributeChange(key as keyof WorkAttributes)}
                    >
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={workAttributes[key as keyof WorkAttributes]}
                            onChange={() => handleWorkAttributeChange(key as keyof WorkAttributes)}
                          />
                        }
                        label={<Typography fontWeight={500}>{label}</Typography>}
                        sx={{ m: 0 }}
                      />
                    </Paper>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Stack>
        );

      case 2:
        return (
          <Stack spacing={3}>
            {loadingClass ? (
              <Box textAlign="center" py={4}>
                <CircularProgress />
              </Box>
            ) : (
              <Card variant="outlined" sx={{ bgcolor: 'primary.50' }}>
                <CardContent>
                  <Typography variant="h6" color="primary.main" gutterBottom>
                    ข้อมูลสิทธิ์ (คำนวณอัตโนมัติ)
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                    <Box>
                      <Typography variant="caption">กลุ่มบัญชี</Typography>
                      <Typography variant="body1" fontWeight="bold">
                        {classification?.group_name || '-'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption">ยอดเงิน</Typography>
                      <Typography variant="h5" color="success.main" fontWeight="bold">
                        {classification?.rate_amount?.toLocaleString() || 0} บาท
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            )}
            {classError && <Alert severity="error">{classError}</Alert>}
            <Alert severity="warning">วันที่มีผลระบบดึงมาให้ หากไม่ถูกต้องสามารถแก้ไขได้</Alert>
            <TextField
              label="วันที่เริ่มมีผล (ตามคำสั่งบรรจุ)"
              type="date"
              fullWidth
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              disabled={loadingClass}
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        );

      case 3:
        return (
          <Box>
            <Typography variant="h6" gutterBottom fontWeight={600}>
              เอกสารประกอบ
            </Typography>
            <Box mb={3}>
              <Typography variant="subtitle2" color="text.secondary">
                1. ใบประกอบวิชาชีพ
              </Typography>
              <FileUploadArea
                files={licenseFile ? [licenseFile] : []}
                onChange={(newFiles) => setLicenseFile(newFiles[0] || null)}
                maxFiles={1}
                showList={false}
              />
              {licenseFile && (
                <FilePreviewList files={[licenseFile]} onRemove={() => setLicenseFile(null)} />
              )}
            </Box>
            <Divider sx={{ mb: 3 }} />
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                2. เอกสารอื่นๆ
              </Typography>
              <FileUploadArea files={files} onChange={setFiles} maxFiles={5} showList={false} />
              <FilePreviewList
                files={files}
                onRemove={(i) => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
              />
            </Box>
          </Box>
        );

      case 4:
        return (
          <Stack spacing={3}>
            <Paper sx={{ p: 3, bgcolor: '#fff3e0', border: '1px solid #ffb74d', borderRadius: 2 }}>
              <Typography variant="subtitle1" fontWeight={700} color="warning.dark">
                ⚠️ คำเตือนทางกฎหมาย
              </Typography>
              <Typography variant="body2">
                ข้าพเจ้าขอรับรองว่าข้อความข้างต้นเป็นความจริงทุกประการ หากแจ้งข้อมูลเท็จ
                อาจมีความผิดตามประมวลกฎหมายอาญา
              </Typography>
            </Paper>

            <Divider />

            <FormControlLabel
              control={
                <Checkbox
                  checked={acceptLegal}
                  onChange={(e) => setAcceptLegal(e.target.checked)}
                />
              }
              label="ข้าพเจ้าตรวจสอบข้อมูลและยินยอมลงนามอิเล็กทรอนิกส์"
            />

            <Box display="flex" flexDirection="column" alignItems="center">
              <Typography variant="h6" gutterBottom fontWeight={600}>
                ลงชื่อผู้ขอรับเงิน
              </Typography>

              <Box
                sx={{
                  border: '2px dashed #9e9e9e',
                  borderRadius: 2,
                  p: 2,
                  width: '100%',
                  maxWidth: 500,
                  bgcolor: '#fafafa',
                  pointerEvents: acceptLegal ? 'auto' : 'none',
                  opacity: acceptLegal ? 1 : 0.6,
                }}
              >
                <SignaturePad
                  width={isMobile ? window.innerWidth - 80 : 450}
                  onChange={setSignatureFile}
                  onSignatureChange={setHasSignature}
                  label="เซ็นชื่อลงในช่องว่าง หรือเลือกใช้ลายเซ็นที่มีอยู่"
                  enableStoredSignature={true}
                />
              </Box>

              <Typography variant="body1" sx={{ mt: 2, fontWeight: 600 }}>
                ({userInfo?.first_name} {userInfo?.last_name})
              </Typography>
            </Box>
          </Stack>
        );

      default:
        return null;
    }
  };

  const renderReviewDialog = () => (
    <Dialog
      open={openReviewDialog}
      onClose={() => setOpenReviewDialog(false)}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white' }}>ตรวจสอบข้อมูล</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} mt={1}>
          <Box display="flex" justifyContent="space-between">
            <Typography color="text.secondary">ชื่อ-สกุล</Typography>
            <Typography fontWeight={600}>
              {userInfo?.first_name} {userInfo?.last_name}
            </Typography>
          </Box>
          <Box display="flex" justifyContent="space-between">
            <Typography color="text.secondary">ประเภท</Typography>
            <Typography fontWeight={600}>
              {REQUEST_TYPE_LABELS[requestType as RequestType]}
            </Typography>
          </Box>
          <Box display="flex" justifyContent="space-between">
            <Typography color="text.secondary">ยอดเงิน</Typography>
            <Typography fontWeight={600}>
              {parseFloat(requestedAmount).toLocaleString()} บาท
            </Typography>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={() => setOpenReviewDialog(false)}>แก้ไข</Button>
        <Button onClick={handleConfirmSubmit} variant="contained" disabled={isSubmitting}>
          ยืนยัน
        </Button>
      </DialogActions>
    </Dialog>
  );

  if (loadingUser)
    return (
      <Box p={4} textAlign="center">
        <CircularProgress />
      </Box>
    );
  if (!userInfo) return <Alert severity="error">โหลดข้อมูลไม่สำเร็จ</Alert>;

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', p: { xs: 1, md: 3 } }}>
      <Box mb={4} textAlign="center">
        <Typography variant="h5" fontWeight={700} color="primary.main">
          แบบฟอร์มขอรับเงิน พ.ต.ส.
        </Typography>
      </Box>
      {!isMobile && (
        <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 5 }}>
          {STEPS.map((step) => (
            <Step key={step.label}>
              <StepLabel>{step.label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      <Paper
        elevation={0}
        variant="outlined"
        sx={{ p: { xs: 2, md: 4 }, borderRadius: 2, minHeight: 400 }}
      >
        {renderStepContent(activeStep)}
      </Paper>
      <Stack
        direction="row"
        justifyContent="space-between"
        mt={4}
        pt={2}
        borderTop="1px dashed #eee"
      >
        <Button
          variant="text"
          color="inherit"
          disabled={activeStep === 0 || isSubmitting}
          onClick={handleBack}
          startIcon={<NavigateBefore />}
          sx={{ visibility: activeStep === 0 ? 'hidden' : 'visible' }}
        >
          ย้อนกลับ
        </Button>
        {activeStep === STEPS.length - 1 ? (
          <Stack direction="row" spacing={2}>
            {onSaveDraft && (
              <Button
                variant="outlined"
                onClick={() => onSaveDraft({} as any, files)}
                disabled={isSubmitting}
              >
                บันทึกร่าง
              </Button>
            )}
            <Button
              variant="contained"
              onClick={handleOpenReview}
              disabled={isSubmitting}
              endIcon={<RateReview />}
            >
              ตรวจสอบและยืนยัน
            </Button>
          </Stack>
        ) : (
          <Button variant="contained" onClick={handleNext} endIcon={<NavigateNext />}>
            ถัดไป
          </Button>
        )}
      </Stack>
      {renderReviewDialog()}
    </Box>
  );
}
