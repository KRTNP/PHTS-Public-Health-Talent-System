import { UserRole } from "@/types/auth.js";

export const STEP_ROLE_MAP: Record<number, UserRole> = {
  1: UserRole.WARD_SCOPE,
  2: UserRole.DEPT_SCOPE,
  3: UserRole.PTS_OFFICER,
  4: UserRole.HEAD_HR,
  5: UserRole.HEAD_FINANCE,
  6: UserRole.DIRECTOR,
};

export const ROLE_STEP_MAP: Record<UserRole, number> = {
  [UserRole.HEAD_SCOPE]: 0,
  [UserRole.WARD_SCOPE]: 1,
  [UserRole.DEPT_SCOPE]: 2,
  [UserRole.PTS_OFFICER]: 3,
  [UserRole.HEAD_HR]: 4,
  [UserRole.HEAD_FINANCE]: 5,
  [UserRole.DIRECTOR]: 6,
  [UserRole.ADMIN]: 0,
  [UserRole.USER]: 0,
  [UserRole.FINANCE_OFFICER]: 0,
};
