'use client';

import { HeadScopeSidebar } from './head-scope-sidebar';
import { FRONTEND_HEAD_SCOPE_LABEL } from '@/shared/utils/role-label';

export function HeadScopeUnifiedSidebar() {
  return (
    <HeadScopeSidebar
      role="head-scope"
      roleLabel={FRONTEND_HEAD_SCOPE_LABEL}
      roleBgColor="bg-indigo-600"
      defaultTitle={FRONTEND_HEAD_SCOPE_LABEL}
    />
  );
}
