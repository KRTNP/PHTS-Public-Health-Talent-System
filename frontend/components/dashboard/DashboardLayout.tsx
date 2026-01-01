/**
 * PHTS System - Dashboard Layout
 *
 * Reusable layout component for all dashboard pages
 * Features: App bar with user info, logout, responsive design
 */

'use client';

import React, { useEffect, useState } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  Chip,
  Container,
  Stack,
} from '@mui/material';
import { AccountCircle, Logout, LocalHospital } from '@mui/icons-material';
import { AuthService } from '@/lib/api/authApi';
import { UserProfile, ROLE_NAMES } from '@/types/auth';
import { useRouter } from 'next/navigation';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
}

export default function DashboardLayout({
  children,
  title,
}: DashboardLayoutProps) {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  useEffect(() => {
    // Check authentication
    if (!AuthService.isAuthenticated()) {
      router.replace('/login');
      return;
    }

    const currentUser = AuthService.getCurrentUser();
    if (!currentUser) {
      router.replace('/login');
      return;
    }

    setUser(currentUser);
  }, [router]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleMenuClose();
    AuthService.logout();
  };

  if (!user) {
    return null; // Loading or redirecting
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* App Bar */}
      <AppBar
        position="static"
        elevation={2}
        sx={{
          background: 'linear-gradient(135deg, #1976D2 0%, #0D47A1 100%)',
        }}
      >
        <Toolbar>
          {/* Logo & Title */}
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexGrow: 1 }}>
            <LocalHospital sx={{ fontSize: 32 }} />
            <Box>
              <Typography variant="h6" component="div" fontWeight={600}>
                PHTS System
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                {title}
              </Typography>
            </Box>
          </Stack>

          {/* Role Badge */}
          <Chip
            label={ROLE_NAMES[user.role]}
            size="small"
            sx={{
              mr: 2,
              backgroundColor: 'rgba(255,255,255,0.18)',
              color: 'white',
              fontWeight: 500,
            }}
          />

          {/* User Menu */}
          <IconButton
            size="large"
            edge="end"
            aria-label="account menu"
            aria-controls="user-menu"
            aria-haspopup="true"
            onClick={handleMenuOpen}
            color="inherit"
          >
            <Avatar
              sx={{
                width: 36,
                height: 36,
                backgroundColor: 'rgba(255,255,255,0.22)',
              }}
            >
              <AccountCircle />
            </Avatar>
          </IconButton>

          <Menu
            id="user-menu"
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <MenuItem disabled>
              <Typography variant="body2" color="text.secondary">
                ID: {user.citizen_id}
              </Typography>
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <Logout fontSize="small" sx={{ mr: 1 }} />
              ออกจากระบบ (Logout)
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          backgroundColor: 'background.default',
          py: 4,
        }}
      >
        <Container maxWidth="xl">{children}</Container>
      </Box>

      {/* Footer */}
      <Box
        component="footer"
        sx={{
          py: 2,
          px: 3,
          backgroundColor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="caption" color="text.secondary" textAlign="center" display="block">
          PHTS - Public Health Talent System &copy; 2025
        </Typography>
      </Box>
    </Box>
  );
}
