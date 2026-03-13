export type Role =
  | 'USER'
  | 'HEAD_SCOPE'
  | 'PTS_OFFICER'
  | 'HEAD_HR'
  | 'HEAD_FINANCE'
  | 'FINANCE_OFFICER'
  | 'DIRECTOR'
  | 'ADMIN';

export type HeadScopeCategory = 'WARD_SCOPE' | 'DEPT_SCOPE';

export interface User {
  id: string;
  username: string;
  role: Role;
  head_scope_roles?: HeadScopeCategory[];
  firstName?: string;
  lastName?: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  subDepartment?: string;
  department?: string;
  email?: string | null;
  phone?: string | null;
  license_no?: string | null;
  license_name?: string | null;
  license_valid_from?: string | Date | null;
  license_valid_until?: string | Date | null;
  license_status?: 'ACTIVE' | 'EXPIRED' | 'INACTIVE' | 'UNKNOWN' | null;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}
