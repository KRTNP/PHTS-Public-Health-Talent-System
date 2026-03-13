import { FRONTEND_HEAD_SCOPE_BASE_PATH, FRONTEND_HEAD_SCOPE_LABEL } from '@/shared/utils/role-label';

export const HEAD_SCOPE_BASE_PATH = FRONTEND_HEAD_SCOPE_BASE_PATH;
export const HEAD_SCOPE_ROLE_TITLE = FRONTEND_HEAD_SCOPE_LABEL;

export const getHeadScopeRoleKey = (): 'HEAD_SCOPE' => {
  return 'HEAD_SCOPE';
};
