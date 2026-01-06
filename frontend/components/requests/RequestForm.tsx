/**
 * PHTS System - Request Form Wizard
 * Responsive stepper with edit toggle, smart signature, file preview dialog.
 */

'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
  FormGroup,
  InputAdornment,
  Divider,
  Stepper,
  Step,
  StepLabel,
  Stack,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {
  Send,
  NavigateNext,
  NavigateBefore,
  Person,
  Work,
  AttachMoney,
  Description,
  RateReview,
  Visibility,
  InsertDriveFile,
  DeleteOutline,
  Edit as EditIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
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
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

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
    licenseFile?: File
  ) => Promise<void>;
  onSaveDraft?: (data: CreateRequestDTO, files: File[]) => Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

export default function RequestForm({
  onSubmit,
  onSaveDraft,
  onCancel,
  isSubmitting = false,
}: RequestFormProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [activeStep, setActiveStep] = useState(0);
  const [userInfo, setUserInfo] = useState<
    (UserProfile & { first_name?: string; last_name?: string; department?: string; position?: string }) | null
  >(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [openReviewDialog, setOpenReviewDialog] = useState(false);
  const [classification, setClassification] = useState<any>(null);
  const [loadingClass, setLoadingClass] = useState(false);
  const [classError, setClassError] = useState<string | null>(null);

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

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = AuthService.getCurrentUser();
        const defaultPersonnel = Object.keys(PERSONNEL_TYPE_LABELS)[0] as PersonnelType;
        const defaultRequest = Object.keys(REQUEST_TYPE_LABELS)[0] as RequestType;
        if (user) {
          setUserInfo(user);
          if (user.department) setDepartmentGroup(user.department);
          if (user.position_number) setPositionNumber(user.position_number);
          if (user.mission_group) setMainDuty(user.mission_group);
          if (user.start_current_position) setEffectiveDate(user.start_current_position);

          if (!personnelType) {
            const emp = (user.employee_type || '').toLowerCase();
            if (emp.includes('ราชการ') && !emp.includes('กระทรวงสาธารณสุข')) {
              setPersonnelType(PersonnelType.CIVIL_SERVANT);
            } else if (emp.includes('พนักงานราชการ')) {
              setPersonnelType(PersonnelType.GOV_EMPLOYEE);
            } else if (emp.includes('กระทรวงสาธารณสุข') || emp.includes('พกส')) {
              setPersonnelType(PersonnelType.PH_EMPLOYEE);
            } else {
              setPersonnelType(PersonnelType.TEMP_EMPLOYEE);
            }
          }
          if (!requestType) setRequestType(defaultRequest);
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
    if (activeStep === 2) {
      fetchClassification();
    }
  }, [activeStep]);

  const fetchClassification = async () => {
    setLoadingClass(true);
    setClassError(null);
    try {
      const res = await apiClient.get('/api/requests/classification');
      if (res.data?.success) {
        const data = res.data.data;
        setClassification(data);
        if (typeof data?.rate_amount === 'number') {
          setRequestedAmount(String(data.rate_amount));
        }
        if (data?.start_work_date && typeof data.start_work_date === 'string') {
          const datePart = data.start_work_date.includes('T')
            ? data.start_work_date.split('T')[0]
            : data.start_work_date;
          setEffectiveDate(datePart);
        }
      } else {
        setClassError('ไม่สามารถดึงข้อมูลสิทธิ์ได้');
      }
    } catch (err) {
      console.error('Failed to load classification', err);
      setClassError('เกิดข้อผิดพลาดในการเชื่อมต่อระบบ');
    } finally {
      setLoadingClass(false);
    }
  };

;

;

  const handleWorkAttributeChange = (key: keyof WorkAttributes) => {
    setWorkAttributes((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const validateStep = (step: number): boolean => {
    setError(null);
    switch (step) {
      case 0:
        if (!personnelType) {
          setError('กรุณาระบุสถานะข้าราชการ/พนักงาน');
          return false;
        }
        if (!requestType) {
          setError('กรุณาระบุประเภทคำขอ');
          return false;
        }
        return true;
      case 1:
        if (!positionNumber.trim()) {
          setError('กรุณากรอกเลขที่ตำแหน่ง');
          return false;
        }
        if (!departmentGroup.trim()) {
          setError('กรุณากรอกกลุ่มงาน/แผนก');
          return false;
        }
        if (!mainDuty.trim()) {
          setError('กรุณากรอกหน้าที่หลัก');
          return false;
        }
        if (!Object.values(workAttributes).some((v) => v)) {
          setError('กรุณาเลือกมาตรฐานด้านตำแหน่งอย่างน้อย 1 ข้อ');
          return false;
        }
        return true;
      case 2:
        if (loadingClass) return false;
        if (!classification || !classification.rate_amount || classification.rate_amount <= 0) {
          setError('ไม่พบข้อมูลสิทธิ์ พ.ต.ส. หรือคุณไม่มีสิทธิ์ได้รับเงิน (กรุณาติดต่อ HR)');
          return false;
        }
        if (!effectiveDate) {
          setError('กรุณาระบุวันที่เริ่มมีผล');
          return false;
        }
        return true;

      case 3:
        return true;
      case 4:
        if (!hasSignature) {
          setError('กรุณาลงลายมือชื่อก่อนยืนยัน');
          return false;
        }
        if (!acceptLegal) {
          setError('กรุณาติ๊กถูก "ข้าพเจ้าตรวจสอบข้อมูลและยินยอม..." ก่อนยืนยัน');
          return false;
        }
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenReview = () => {
    if (validateStep(4)) {
      setOpenReviewDialog(true);
    }
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
        requested_amount: classification?.rate_amount ?? parseFloat(requestedAmount.replace(/,/g, '')),
        effective_date: effectiveDate,
      };
      await onSubmit(formData, files, signatureFile || undefined, licenseFile || undefined);
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการส่งข้อมูล');
    }
  };

  const handleSaveDraft = async () => {
    if (!onSaveDraft) return;
    const formData: CreateRequestDTO = {
      personnel_type: (personnelType as PersonnelType) || (Object.keys(PERSONNEL_TYPE_LABELS)[0] as PersonnelType),
      position_number: positionNumber.trim(),
      department_group: departmentGroup.trim(),
      main_duty: mainDuty.trim(),
      work_attributes: workAttributes,
      request_type: (requestType as RequestType) || (Object.keys(REQUEST_TYPE_LABELS)[0] as RequestType),
      requested_amount: typeof classification?.rate_amount === 'number'
        ? classification.rate_amount
        : requestedAmount
          ? parseFloat(requestedAmount.replace(/,/g, ''))
          : undefined,
      effective_date: effectiveDate || undefined,
    };
    try {
      await onSaveDraft(formData, files);
    } catch (err: any) {
      setError(err.message || 'บันทึกร่างไม่สำเร็จ');
    }
  };

  const currentStepLabel = useMemo(
    () => `ขั้นตอนที่ ${activeStep + 1} / ${STEPS.length}: ${STEPS[activeStep].label}`,
    [activeStep]
  );

  const EditToggle = () => (
    <Box display="flex" justifyContent="flex-end" mb={2}>
      <Button
        variant={isEditMode ? 'contained' : 'outlined'}
        color={isEditMode ? 'primary' : 'inherit'}
        onClick={() => setIsEditMode(!isEditMode)}
        startIcon={isEditMode ? <LockOpenIcon /> : <EditIcon />}
        sx={{ borderRadius: 2, borderWidth: 2, fontWeight: 600, '&:hover': { borderWidth: 2 } }}
      >
        {isEditMode ? 'บันทึกข้อมูล' : 'แก้ไขข้อมูล'}
      </Button>
    </Box>
  );

  const ReviewRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '160px 1fr' },
        gap: 1,
        mb: 1,
      }}
    >
      <Typography component="div" variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography component="div" variant="body2" fontWeight={600} color="text.primary">
        {value}
      </Typography>
    </Box>
  );

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Stack spacing={3}>
            <EditToggle />
            <Box>
              <Typography variant="h6" gutterBottom fontWeight={600} color="primary.main">
                1.1 สถานะบุคลากร
              </Typography>
              <FormControl component="fieldset" disabled={!isEditMode}>
                <RadioGroup value={personnelType} onChange={(e) => setPersonnelType(e.target.value as PersonnelType)}>
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
                          borderRadius: 2,
                          border:
                            personnelType === key ? `2px solid ${theme.palette.primary.main}` : '1px solid #9e9e9e',
                          bgcolor: personnelType === key ? 'primary.50' : 'transparent',
                          opacity: !isEditMode && personnelType !== key ? 0.6 : 1,
                          position: 'relative',
                          transition: 'all 0.2s ease',
                          boxShadow: personnelType === key ? '0 4px 12px rgba(25, 118, 210, 0.15)' : 'none',
                        }}
                        onClick={() => isEditMode && setPersonnelType(key as PersonnelType)}
                      >
                        {personnelType === key && (
                          <CheckCircleOutline color="primary" sx={{ position: 'absolute', top: 10, right: 10 }} />
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
                <RadioGroup value={requestType} onChange={(e) => setRequestType(e.target.value as RequestType)}>
                  <Stack spacing={2}>
                    {Object.entries(REQUEST_TYPE_LABELS).map(([key, label]) => (
                      <Paper
                        key={key}
                        variant="outlined"
                        sx={{
                          p: 1.5,
                          borderRadius: 2,
                          border:
                            requestType === key ? `2px solid ${theme.palette.primary.main}` : '1px solid #9e9e9e',
                          bgcolor: requestType === key ? 'primary.50' : 'transparent',
                          opacity: requestType !== key ? 0.6 : 1,
                        }}
                      >
                        <FormControlLabel
                          value={key}
                          control={<Radio color="primary" />}
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
            <EditToggle />
            <Alert severity="info" icon={<Person fontSize="large" />} sx={{ '& .MuiAlert-message': { width: '100%' } }}>
              <Typography variant="subtitle1" fontWeight={700}>
                {userInfo?.first_name} {userInfo?.last_name}
              </Typography>
              <Typography variant="body2">ตำแหน่ง: {userInfo?.position || '-'}</Typography>
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
                disabled={!isEditMode}
                sx={{ '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: '#000000', color: '#000000' } }}
                InputLabelProps={{ shrink: true }}
                placeholder="เช่น 95635"
              />
              <TextField
                label="กลุ่มงาน/แผนก"
                fullWidth
                required
                variant="outlined"
                value={departmentGroup}
                onChange={(e) => setDepartmentGroup(e.target.value)}
                disabled={!isEditMode}
                sx={{ '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: '#000000', color: '#000000' } }}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="ปฏิบัติหน้าที่หลัก"
                fullWidth
                required
                variant="outlined"
                value={mainDuty}
                onChange={(e) => setMainDuty(e.target.value)}
                disabled={!isEditMode}
                sx={{ '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: '#000000', color: '#000000' } }}
                InputLabelProps={{ shrink: true }}
              />
            </Box>

            <Box>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ mt: 2 }}>
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
                      border: workAttributes[key as keyof WorkAttributes]
                        ? `2px solid ${theme.palette.primary.main}`
                        : '1px solid #9e9e9e',
                      bgcolor: workAttributes[key as keyof WorkAttributes] ? 'primary.50' : 'transparent',
                      opacity: 1,
                    }}
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
            </Box>
          </Stack>
        );

      case 2:
        return (
          <Stack spacing={3}>
            {loadingClass ? (
              <Box textAlign="center" py={4}>
                <CircularProgress />
              </Box>
            ) : classError ? (
              <Alert
                severity="error"
                action={
                  <Button color="inherit" size="small" onClick={fetchClassification}>
                    {'ลองใหม่'}
                  </Button>
                }
              >
                {classError}
              </Alert>
            ) : (
              <Card variant="outlined" sx={{ bgcolor: 'primary.50' }}>
                <CardContent>
                  <Typography variant="h6" color="primary.main" gutterBottom>
                    {'ข้อมูลสิทธิ์ พ.ต.ส. ของคุณ (ระบบคำนวณอัตโนมัติ)'}
                  </Typography>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                      gap: 2,
                    }}
                  >
                    <Box>
                      <Typography variant="caption">{'กลุ่มบัญชี'}</Typography>
                      <Typography variant="body1" fontWeight="bold">
                        {classification?.group_name || '-'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption">{'จำนวนเงินที่ได้รับ'}</Typography>
                      <Typography variant="h5" color="success.main" fontWeight="bold">
                        {classification?.rate_amount?.toLocaleString() || 0} ???
                      </Typography>
                    </Box>
                    <Box sx={{ gridColumn: { xs: '1 / -1', sm: '1 / -1' } }}>
                      <Typography variant="caption">{'เงื่อนไข/เกณฑ์'}</Typography>
                      <Typography variant="body2">
                        {classification?.criteria_text || '-'}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            )}

            <Alert severity="warning">
              {'การแก้ไขข้อมูลในหน้านี้เป็นการแจ้งเปลี่ยนข้อมูลเบื้องต้น ไม่มีผลต่อการคำนวณเงินในรอบนี้'}
            </Alert>

            <TextField
              label="วันที่เริ่มมีผล (ตามคำสั่งบรรจุ/เริ่มปฏิบัติงาน)"
              type="date"
              fullWidth
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              disabled={loadingClass}
              InputLabelProps={{ shrink: true }}
              helperText={
                classification?.start_work_date
                  ? `ระบบดึงจากวันเริ่มงาน: ${(() => {
                      const raw = classification.start_work_date;
                      if (typeof raw !== 'string') return '-';
                      return raw.includes('T') ? raw.split('T')[0] : raw;
                    })()}`
                  : 'กรุณาระบุวันที่ตามคำสั่ง'
              }
            />
          </Stack>
        );

      case 3:
        return (
          <Box>
            <Typography variant="h6" gutterBottom fontWeight={600}>
              เอกสารประกอบการพิจารณา
            </Typography>

            <Box mb={3}>
              <Typography variant="subtitle2" gutterBottom fontWeight={600} color="text.secondary">
                1. ใบประกอบวิชาชีพ (ถ้ามี)
              </Typography>
              <FileUploadArea
                files={licenseFile ? [licenseFile] : []}
                onChange={(newFiles) => setLicenseFile(newFiles[0] || null)}
                maxFiles={1}
                maxSizeMB={5}
                showList={false}
              />
              {licenseFile && (
                <FilePreviewList files={[licenseFile]} onRemove={() => setLicenseFile(null)} />
              )}
            </Box>

            <Divider sx={{ mb: 3 }} />

            <Box mb={2}>
              <Typography variant="subtitle2" gutterBottom fontWeight={600} color="text.secondary">
                2. เอกสารอื่นๆ (คำสั่ง, วุฒิบัตร ฯลฯ)
              </Typography>
              <Alert severity="warning" sx={{ mb: 2, fontWeight: 600 }}>
                สามารถแนบไฟล์ภาพ หรือ PDF (ขนาดไม่เกิน 5MB)
              </Alert>
              <FileUploadArea files={files} onChange={setFiles} maxFiles={5} maxSizeMB={5} showList={false} />
              <FilePreviewList
                files={files}
                onRemove={(index) => setFiles((prev) => prev.filter((_, i) => i !== index))}
              />
            </Box>
          </Box>
        );

      case 4:
        return (
          <Stack spacing={3}>
            <Paper sx={{ p: 3, bgcolor: '#fff3e0', border: '1px solid #ffb74d', borderRadius: 2 }}>
              <Typography variant="subtitle1" fontWeight={700} color="warning.dark" gutterBottom>
                ⚠️ คำเตือนทางกฎหมาย
              </Typography>
              <Typography variant="body2">
                ข้าพเจ้าขอรับรองว่าข้อความข้างต้นเป็นความจริงทุกประการ หากแจ้งข้อมูลเท็จ อาจมีความผิดตามประมวลกฎหมายอาญา
              </Typography>
            </Paper>

            <Divider />

            <FormControlLabel
              control={
                <Checkbox
                  checked={acceptLegal}
                  onChange={(e) => setAcceptLegal(e.target.checked)}
                  color="primary"
                />
              }
              label="ข้าพเจ้าตรวจสอบข้อมูลและยินยอมลงนามอิเล็กทรอนิกส์"
              sx={{ alignItems: 'flex-start' }}
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
      scroll="paper"
    >
      <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 600 }}>
        ตรวจสอบข้อมูลก่อนส่ง
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <Box>
            <Typography
              variant="subtitle2"
              color="primary.main"
              fontWeight={700}
              gutterBottom
              textTransform="uppercase"
            >
              ข้อมูลบุคลากร
            </Typography>
            <ReviewRow label="ชื่อ-สกุล" value={`${userInfo?.first_name} ${userInfo?.last_name}`} />
            <ReviewRow label="ตำแหน่ง" value={userInfo?.position} />
            <ReviewRow label="เลขที่ตำแหน่ง" value={positionNumber} />
            <ReviewRow label="แผนก/งาน" value={departmentGroup} />
          </Box>

          <Divider />

          <Box>
            <Typography
              variant="subtitle2"
              color="primary.main"
              fontWeight={700}
              gutterBottom
              textTransform="uppercase"
            >
              รายละเอียดคำขอ
            </Typography>
            <ReviewRow
              label="ประเภทคำขอ"
              value={<Chip label={REQUEST_TYPE_LABELS[requestType as RequestType]} size="small" color="primary" variant="outlined" />}
            />
            <ReviewRow label="ประเภทบุคลากร" value={PERSONNEL_TYPE_LABELS[personnelType as PersonnelType]} />
            <ReviewRow label="ยอดเงินที่ขอ" value={requestedAmount ? `${parseFloat(requestedAmount).toLocaleString()} บาท` : '-'} />
            <ReviewRow
              label="วันที่มีผล"
              value={effectiveDate ? format(new Date(effectiveDate), 'd MMMM yyyy', { locale: th }) : '-'}
            />
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary">
                {'ลักษณะงานที่เลือก:'}
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1} mt={0.5}>
                {Object.entries(workAttributes).map(([key, checked]) =>
                  checked ? (
                    <Chip
                      key={key}
                      label={WORK_ATTRIBUTE_LABELS[key as keyof WorkAttributes]}
                      size="small"
                    />
                  ) : null
                )}
              </Stack>
            </Box>
          </Box>

          <Divider />

          <Box>
            <Typography
              variant="subtitle2"
              color="primary.main"
              fontWeight={700}
              gutterBottom
              textTransform="uppercase"
            >
              เอกสารแนบ
            </Typography>
            <Stack spacing={1}>
              {licenseFile && (
                <Box display="flex" alignItems="center" gap={1}>
                  <CheckCircleOutline fontSize="small" color="success" />
                  <Typography variant="body2" fontWeight={500}>
                    ใบประกอบวิชาชีพ: {licenseFile.name}
                  </Typography>
                </Box>
              )}
              {files.length > 0 ? (
                files.map((f, i) => (
                  <Box key={i} display="flex" alignItems="center" gap={1}>
                    <InsertDriveFile fontSize="small" color="action" />
                    <Typography variant="body2">{f.name}</Typography>
                  </Box>
                ))
              ) : !licenseFile ? (
                <Typography variant="body2" color="text.secondary">
                  ไม่มีเอกสารแนบ
                </Typography>
              ) : null}
            </Stack>
          </Box>

          <Divider />

          <Box>
            <Typography
              variant="subtitle2"
              color="primary.main"
              fontWeight={700}
              gutterBottom
              textTransform="uppercase"
            >
              การลงนาม
            </Typography>
            {hasSignature ? (
              <Alert severity="success" icon={<CheckCircleOutline fontSize="inherit" />}>
                ลงลายมือชื่อเรียบร้อยแล้ว
              </Alert>
            ) : (
              <Alert severity="warning">ยังไม่ได้ลงลายมือชื่อ</Alert>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2, bgcolor: 'grey.50' }}>
        <Button onClick={() => setOpenReviewDialog(false)} color="inherit">
          กลับไปแก้ไข
        </Button>
        <Button
          onClick={handleConfirmSubmit}
          variant="contained"
          color="primary"
          startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : <Send />}
          disabled={isSubmitting}
        >
          ยืนยันการส่ง
        </Button>
      </DialogActions>
    </Dialog>
  );

  if (loadingUser) {
    return (
      <Box p={4} textAlign="center">
        <CircularProgress />
      </Box>
    );
  }

  if (!userInfo) {
    return (
      <Alert severity="error">
        ไม่สามารถโหลดข้อมูลผู้ใช้ได้ กรุณาเข้าสู่ระบบใหม่
      </Alert>
    );
  }

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', p: { xs: 1, md: 3 } }}>
      <Box mb={4} textAlign="center">
        <Typography variant="h5" fontWeight={700} color="primary.main">
          แบบฟอร์มการรับเงินเพิ่ม พ.ต.ส.
        </Typography>
      </Box>

      {!isMobile ? (
        <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 5 }}>
          {STEPS.map((step) => (
            <Step key={step.label}>
              <StepLabel>{step.label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      ) : (
        <Box mb={3} display="flex" alignItems="center" justifyContent="center">
          <Chip label={currentStepLabel} color="primary" variant="outlined" sx={{ fontWeight: 600 }} />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper elevation={0} variant="outlined" sx={{ p: { xs: 2, md: 4 }, borderRadius: 2, minHeight: 400, borderColor: '#e0e0e0' }}>
        {renderStepContent(activeStep)}
      </Paper>

      <Stack direction="row" justifyContent="space-between" mt={4}>
        <Button
          variant="outlined"
          disabled={activeStep === 0 || isSubmitting}
          onClick={handleBack}
          startIcon={<NavigateBefore />}
          sx={{ borderRadius: 2, px: 3, borderWidth: 1 }}
        >
          ย้อนกลับ
        </Button>

        {activeStep === STEPS.length - 1 ? (
          <Stack direction="row" spacing={1}>
            {onSaveDraft && (
              <Button
                variant="outlined"
                color="info"
                onClick={handleSaveDraft}
                disabled={isSubmitting}
                sx={{ borderRadius: 2, px: 3, fontWeight: 600 }}
              >
                บันทึกร่าง
              </Button>
            )}
            <Button
              variant="contained"
              color="primary"
              onClick={handleOpenReview}
              disabled={isSubmitting}
              endIcon={<RateReview />}
              sx={{ borderRadius: 2, px: 4, fontWeight: 600, boxShadow: 'none' }}
            >
              ตรวจสอบและยืนยัน
            </Button>
          </Stack>
        ) : (
          <Button
            variant="contained"
            onClick={handleNext}
            endIcon={<NavigateNext />}
            sx={{ borderRadius: 2, px: 4, fontWeight: 600, boxShadow: 'none' }}
          >
            ถัดไป
          </Button>
        )}
      </Stack>

      {renderReviewDialog()}
    </Box>
  );
}
