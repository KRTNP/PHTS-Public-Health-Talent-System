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
      if (typeof window !== 'undefined') {
        localStorage.setItem('phts_token', token);
        localStorage.setItem('phts_user', JSON.stringify(user));
      }

      return response.data;
    } catch (error: any) {
      // Normalize error response
      if (error.response?.data) {
        throw error.response.data;
      }
      throw {
        success: false,
        message: 'เชื่อมต่อระบบไม่ได้ (Connection failed)',
        error: error.message,
      };
    }
  }

  /**
   * Logout user - clear all auth data
   */
  static logout(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('phts_token');
      localStorage.removeItem('phts_user');
      window.location.href = '/login';
    }
  }

  /**
   * Get current user from localStorage
   */
  static getCurrentUser(): UserProfile | null {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('phts_user');
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
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('phts_token');
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
    if (typeof window !== 'undefined') {
      const route = this.getDashboardRoute(user);
      window.location.href = route;
    }
  }
}
