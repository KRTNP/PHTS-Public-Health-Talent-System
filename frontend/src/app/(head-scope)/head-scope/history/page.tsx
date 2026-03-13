'use client';

import { HeadScopeHistoryPage } from '@/features/head-approval/screens/head-scope-history-page';
import {
  getHeadScopeRoleKey,
  HEAD_SCOPE_BASE_PATH,
  HEAD_SCOPE_ROLE_TITLE,
} from '@/features/head-approval/head-scope-route';

export const dynamic = 'force-dynamic';

export default function HeadScopeHistoryRoute() {
  return (
    <HeadScopeHistoryPage
      basePath={HEAD_SCOPE_BASE_PATH}
      roleTitle={HEAD_SCOPE_ROLE_TITLE}
      roleKey={getHeadScopeRoleKey()}
    />
  );
}
