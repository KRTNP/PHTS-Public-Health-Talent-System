/**
 * Navigation helpers for role-aware dashboard routing.
 */
import { useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AuthService } from '@/lib/api/authApi';

/**
 * Map user role to dashboard home path.
 */
export function getDashboardHome(role?: string): string {
  switch (role) {
    case 'ADMIN':
      return '/dashboard/admin';
    case 'HEAD_WARD':
      return '/dashboard/head-ward';
    case 'HEAD_DEPT':
      return '/dashboard/approver';
    case 'PTS_OFFICER':
      return '/dashboard/officer';
    case 'HEAD_HR':
      return '/dashboard/hr-head';
    case 'HEAD_FINANCE':
      return '/dashboard/finance-head';
    case 'FINANCE_OFFICER':
      return '/dashboard/finance';
    case 'DIRECTOR':
      return '/dashboard/director';
    default:
      return '/dashboard/user';
  }
}

/**
 * Navigate back if history exists, otherwise go to role home.
 */
export function navigateBackOrHome(
  router: ReturnType<typeof useRouter>,
  role?: string
) {
  const fallback = getDashboardHome(role);
  if (globalThis.window !== undefined && globalThis.window.history.length > 1) {
    router.back();
  } else {
    router.push(fallback);
  }
}

/**
 * Hook that returns a goBack handler and fallbackPath based on current user role.
 */
export function useRoleAwareBack() {
  const router = useRouter();
  const currentUser = AuthService.getCurrentUser();
  const fallbackPath = useMemo(
    () => getDashboardHome(currentUser?.role),
    [currentUser?.role]
  );

  const goBack = useCallback(() => {
    if (globalThis.window !== undefined && globalThis.window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackPath);
    }
  }, [router, fallbackPath]);

  return { goBack, fallbackPath };
}
