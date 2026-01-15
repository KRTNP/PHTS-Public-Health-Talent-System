/**
 * PHTS System - Authentication Types (Frontend)
 * Mirrors backend types for type safety across the stack.
 */

export enum UserRole {
  USER = 'USER',
  HEAD_WARD = 'HEAD_WARD',
  HEAD_DEPT = 'HEAD_DEPT',
  PTS_OFFICER = 'PTS_OFFICER',
  HEAD_HR = 'HEAD_HR',
  HEAD_FINANCE = 'HEAD_FINANCE',
  FINANCE_OFFICER = 'FINANCE_OFFICER',
  DIRECTOR = 'DIRECTOR',
  ADMIN = 'ADMIN',
}

export interface LoginCredentials {
  citizen_id: string;
  password: string;
}

export interface UserProfile {
  id: number;
  citizen_id: string;
  role: UserRole;
  is_active: boolean;
  last_login_at: Date | null;
  email?: string | null;
  first_name?: string;
  last_name?: string;
  position?: string;
  position_number?: string;
  department?: string;
  employee_type?: string;
  mission_group?: string;
  start_current_position?: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  user: UserProfile;
}

export interface ApiError {
  success: false;
  message: string;
  error?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  token?: string;
}

// Role display names
export const ROLE_NAMES: Record<UserRole, string> = {
  [UserRole.USER]: 'บุคลากรทั่วไป (General Staff)',
  [UserRole.HEAD_WARD]: 'หัวหน้าตึก (Head of Ward)',
  [UserRole.HEAD_DEPT]: 'หัวหน้ากลุ่มงาน (Head of Department)',
  [UserRole.PTS_OFFICER]: 'เจ้าหน้าที่ พ.ต.ส. (PTS Officer)',
  [UserRole.HEAD_HR]: 'หัวหน้าฝ่ายทรัพยากรบุคคล (Head of HR)',
  [UserRole.HEAD_FINANCE]: 'หัวหน้าฝ่ายการเงิน (Head of Finance)',
  [UserRole.FINANCE_OFFICER]: 'เจ้าหน้าที่การเงิน (Finance Officer)',
  [UserRole.DIRECTOR]: 'ผู้อำนวยการโรงพยาบาล (Hospital Director)',
  [UserRole.ADMIN]: 'ผู้ดูแลระบบ (System Administrator)',
};

// Role-based dashboard routes
export const ROLE_ROUTES: Record<UserRole, string> = {
  [UserRole.USER]: '/dashboard/user',
  [UserRole.HEAD_WARD]: '/dashboard/head-ward',
  [UserRole.HEAD_DEPT]: '/dashboard/approver',
  [UserRole.PTS_OFFICER]: '/dashboard/officer',
  [UserRole.HEAD_HR]: '/dashboard/hr-head',
  [UserRole.HEAD_FINANCE]: '/dashboard/finance-head',
  [UserRole.FINANCE_OFFICER]: '/dashboard/finance',
  [UserRole.DIRECTOR]: '/dashboard/director',
  [UserRole.ADMIN]: '/dashboard/admin',
};
