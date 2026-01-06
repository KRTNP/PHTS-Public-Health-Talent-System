'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Container,
  InputAdornment,
  IconButton,
  Alert,
  CircularProgress,
  Stack,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {
  Visibility,
  VisibilityOff,
  Person,
  Lock,
  Login as LoginIcon,
} from '@mui/icons-material';
import { AuthService } from '@/lib/api/authApi';
import { UserRole } from '@/types/auth';
import Image from 'next/image';

export default function LoginPage() {
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await AuthService.login({ citizen_id: username, password });
      const userRole: UserRole = response.user.role;

      let targetPath = '/dashboard/user';
      switch (userRole) {
        case UserRole.ADMIN:
          targetPath = '/dashboard/admin';
          break;
        case UserRole.HEAD_DEPT:
          targetPath = '/dashboard/approver';
          break;
        case UserRole.PTS_OFFICER:
          targetPath = '/dashboard/officer';
          break;
        case UserRole.HEAD_HR:
          targetPath = '/dashboard/hr-head';
          break;
        case UserRole.HEAD_FINANCE:
          targetPath = '/dashboard/finance-head';
          break;
        case UserRole.DIRECTOR:
          targetPath = '/dashboard/director';
          break;
        case UserRole.USER:
        default:
          targetPath = '/dashboard/user';
          break;
      }

      router.replace(targetPath);
    } catch (err: any) {
      console.error('Login failed:', err);
      if (err.response?.status === 401) {
        setError('ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง');
      } else if (err.response?.status === 403) {
        setError('บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
      } else {
        setError('เกิดข้อผิดพลาดในการเชื่อมต่อระบบ กรุณาลองใหม่อีกครั้ง');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      component="main"
      sx={{
        height: '100vh',
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '7fr 5fr' },
      }}
    >
      <Box
        sx={{
          display: { xs: 'none', md: 'block' },
          backgroundImage:
            'url(https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=2000&auto=format&fit=crop)',
          backgroundRepeat: 'no-repeat',
          backgroundColor: (t) => (t.palette.mode === 'light' ? t.palette.grey[50] : t.palette.grey[900]),
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(25, 118, 210, 0.85)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            color: 'white',
            p: 4,
            textAlign: 'center',
          }}
        >
          <Box
            sx={{
              width: 120,
              height: 120,
              mb: 2,
              borderRadius: '16px',
              overflow: 'hidden',
              backgroundColor: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'none',
            }}
          >
            <Image
              src="/logo-uttaradit-hospital.png"
              alt="Uttaradit Hospital"
              width={120}
              height={120}
              priority
              style={{ objectFit: 'contain' }}
            />
          </Box>
          <Typography variant="h3" component="h1" fontWeight="700" gutterBottom>
            PHTS System
          </Typography>
          <Typography variant="h5" sx={{ opacity: 0.9, fontWeight: 300 }}>
            ระบบสารสนเทศเพื่อการบริหารจัดการ
          </Typography>
          <Typography variant="h6" sx={{ opacity: 0.9, fontWeight: 300, mt: 1 }}>
            ค่าตอบแทนกำลังคนด้านสาธารณสุข
          </Typography>
        </Box>
      </Box>

      <Paper elevation={6} square>
        <Box
          sx={{
            my: 8,
            mx: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            height: '100%',
            justifyContent: 'center',
          }}
        >
          {isMobile && (
            <>
              <Box
              sx={{
                width: 96,
                height: 96,
                mb: 1,
                borderRadius: '14px',
                overflow: 'hidden',
                backgroundColor: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'none',
              }}
            >
                <Image
                  src="/logo-uttaradit-hospital.png"
                  alt="Uttaradit Hospital"
                  width={96}
                  height={96}
                  priority
                  style={{ objectFit: 'contain' }}
                />
              </Box>
              <Typography component="h1" variant="h5" fontWeight="700" color="primary" gutterBottom>
                PHTS Login
              </Typography>
            </>
          )}

          {!isMobile && (
            <>
              <Typography component="h1" variant="h5" fontWeight="600" sx={{ mb: 1 }}>
                เข้าสู่ระบบ
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
                กรุณากรอกเลขบัตรประชาชนและรหัสผ่าน
              </Typography>
            </>
          )}

          <Box component="form" onSubmit={handleLogin} sx={{ mt: 1, width: '100%', maxWidth: 400 }}>
            {error && (
              <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                {error}
              </Alert>
            )}

            <TextField
              margin="normal"
              required
              fullWidth
              id="username"
              label="เลขบัตรประชาชน / Username"
              name="username"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Person color="action" />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
            />

            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="รหัสผ่าน"
              type={showPassword ? 'text' : 'password'}
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <LoginIcon />}
              sx={{
                mt: 4,
                mb: 2,
                py: 1.5,
                fontSize: '1.1rem',
                fontWeight: 600,
                borderRadius: 2,
                textTransform: 'none',
                boxShadow: theme.shadows[4],
              }}
            >
              {loading ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
            </Button>

            <Stack direction="row" justifyContent="center" mt={2}>
              <Typography variant="body2" color="text.secondary">
                ติดปัญหาการใช้งาน?{' '}
                <Box component="span" sx={{ color: 'primary.main', cursor: 'pointer', fontWeight: 600 }}>
                  ติดต่อฝ่าย IT
                </Box>
              </Typography>
            </Stack>

            <Typography variant="caption" display="block" align="center" color="text.disabled" sx={{ mt: 8 }}>
              PHTS System v2.0 © 2025 Uttaradit Hospital
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
