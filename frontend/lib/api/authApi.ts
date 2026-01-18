/**
 * PHTS System - Authentication API (Frontend)
 *
 * Handles login, logout, and token management via HTTP endpoints.
 */

import { apiClient } from '@/lib/axios';
import {
  LoginCredentials,
  LoginResponse,
  UserProfile,
  ROLE_ROUTES,
} from '@/types/auth';

export class AuthService {
  /**
   * Login user with citizen ID and password
   */
  static async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      const response = await apiClient.post<LoginResponse>('/api/auth/login', credentials);
      const { token, user } = response.data;

      // Store token and user info in localStorage
      if (globalThis.window !== undefined) {
        globalThis.localStorage.setItem('phts_token', token);
        globalThis.localStorage.setItem('phts_user', JSON.stringify(user));
      }

      return response.data;
    } catch (error: any) {
      // Normalize error response
      if (error.response?.data) {
        const apiError = new Error(error.response.data?.message || 'เข้าสู่ระบบไม่สำเร็จ');
        (apiError as any).response = error.response;
        (apiError as any).data = error.response.data;
        throw apiError;
      }
      const connectionError = new Error('เชื่อมต่อระบบไม่ได้ (Connection failed)');
      (connectionError as any).data = {
        success: false,
        message: 'เชื่อมต่อระบบไม่ได้ (Connection failed)',
        error: error.message,
      };
      throw connectionError;
    }
  }

  /**
   * Logout user - clear all auth data
   */
  static logout(): void {
    if (globalThis.window !== undefined) {
      globalThis.localStorage.removeItem('phts_token');
      globalThis.localStorage.removeItem('phts_user');
      globalThis.window.location.href = '/login';
    }
  }

  /**
   * Get current user from localStorage
   */
  static getCurrentUser(): UserProfile | null {
    if (globalThis.window !== undefined) {
      const userStr = globalThis.localStorage.getItem('phts_user');
      if (userStr) {
        try {
          return JSON.parse(userStr) as UserProfile;
        } catch {
          return null;
        }
      }
    }
    return null;
  }

  /**
   * Check if user is authenticated
   */
  static isAuthenticated(): boolean {
    if (globalThis.window !== undefined) {
      const token = globalThis.localStorage.getItem('phts_token');
      return !!token;
    }
    return false;
  }

  /**
   * Get dashboard route for user role
   */
  static getDashboardRoute(user: UserProfile): string {
    return ROLE_ROUTES[user.role] || '/dashboard/user';
  }

  /**
   * Redirect to appropriate dashboard based on role
   */
  static redirectToDashboard(user: UserProfile): void {
    if (globalThis.window !== undefined) {
      const route = this.getDashboardRoute(user);
      globalThis.window.location.href = route;
    }
  }
}
