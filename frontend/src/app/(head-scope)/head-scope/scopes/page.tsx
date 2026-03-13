'use client';

import { HeadScopeScopeMembersPage } from '@/features/head-approval/screens/head-scope-scope-members-page';
import { HEAD_SCOPE_ROLE_TITLE } from '@/features/head-approval/head-scope-route';

export const dynamic = 'force-dynamic';

export default function HeadScopeScopesRoute() {
  return <HeadScopeScopeMembersPage roleTitle={HEAD_SCOPE_ROLE_TITLE} />;
}
