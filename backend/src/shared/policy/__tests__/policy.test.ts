import { PeriodStatus } from '@/modules/payroll/entities/payroll.entity.js';
import { UserRole } from '@/types/auth.js';
import { resolveNextStatus, canTransition } from '@shared/policy/payroll.policy.js';
import {
  STEP_ROLE_MAP,
  ROLE_STEP_MAP,
  TOTAL_APPROVAL_STEPS,
  getRoleForStep,
  getStepForRole,
  canApproveAtStep,
  canBatchApprove,
  canReassign,
  canAdjustLeave,
  canViewScopes,
} from '@shared/policy/request.policy.js';
import { APPROVER_ROLES, isApproverRole, isAdminRole } from '@shared/policy/roles.js';

describe('shared policy', () => {
  describe('roles policy', () => {
    test('approver roles contain expected roles', () => {
      expect(APPROVER_ROLES).toContain(UserRole.HEAD_SCOPE);
      expect(APPROVER_ROLES).toContain(UserRole.PTS_OFFICER);
      expect(APPROVER_ROLES).toContain(UserRole.HEAD_HR);
      expect(APPROVER_ROLES).toContain(UserRole.HEAD_FINANCE);
      expect(APPROVER_ROLES).toContain(UserRole.DIRECTOR);
    });

    test('isApproverRole matches list', () => {
      expect(isApproverRole(UserRole.PTS_OFFICER)).toBe(true);
      expect(isApproverRole(UserRole.ADMIN)).toBe(false);
    });

    test('isAdminRole only true for admin', () => {
      expect(isAdminRole(UserRole.ADMIN)).toBe(true);
      expect(isAdminRole(UserRole.PTS_OFFICER)).toBe(false);
    });
  });

  describe('request policy', () => {
    test('role-step maps are consistent for approval roles', () => {
      expect(TOTAL_APPROVAL_STEPS).toBe(6);
      Object.entries(STEP_ROLE_MAP).forEach(([step, role]) => {
        const stepNo = Number(step);
        expect(ROLE_STEP_MAP[role]).toBe(stepNo);
      });
    });

    test('getRoleForStep returns expected role', () => {
      expect(getRoleForStep(1)).toBe(UserRole.WARD_SCOPE);
      expect(getRoleForStep(3)).toBe(UserRole.PTS_OFFICER);
      expect(getRoleForStep(6)).toBe(UserRole.DIRECTOR);
    });

    test('getStepForRole returns undefined for non-approval roles', () => {
      expect(getStepForRole(UserRole.ADMIN)).toBeUndefined();
      expect(getStepForRole(UserRole.USER)).toBeUndefined();
      expect(getStepForRole(UserRole.FINANCE_OFFICER)).toBeUndefined();
    });

    test('canApproveAtStep only true for matching role + step', () => {
      expect(canApproveAtStep(UserRole.DEPT_SCOPE, 2)).toBe(true);
      expect(canApproveAtStep(UserRole.DEPT_SCOPE, 3)).toBe(false);
    });

    test('batch approve only allowed for director', () => {
      expect(canBatchApprove(UserRole.DIRECTOR)).toBe(true);
      expect(canBatchApprove(UserRole.PTS_OFFICER)).toBe(false);
    });

    test('reassign/adjust leave only allowed for PTS_OFFICER', () => {
      expect(canReassign(UserRole.PTS_OFFICER)).toBe(true);
      expect(canReassign(UserRole.HEAD_HR)).toBe(false);
      expect(canAdjustLeave(UserRole.PTS_OFFICER)).toBe(true);
      expect(canAdjustLeave(UserRole.HEAD_HR)).toBe(false);
    });

    test('scope visibility only for head-scope', () => {
      expect(canViewScopes(UserRole.HEAD_SCOPE)).toBe(true);
      expect(canViewScopes(UserRole.PTS_OFFICER)).toBe(false);
    });
  });

  describe('payroll policy', () => {
    test('resolveNextStatus returns next status for valid transitions', () => {
      expect(resolveNextStatus('SUBMIT', PeriodStatus.OPEN)).toBe(PeriodStatus.WAITING_HR);

      expect(resolveNextStatus('APPROVE_HR', PeriodStatus.WAITING_HR)).toBe(
        PeriodStatus.WAITING_HEAD_FINANCE,
      );

      expect(
        resolveNextStatus('APPROVE_HEAD_FINANCE', PeriodStatus.WAITING_HEAD_FINANCE),
      ).toBe(PeriodStatus.WAITING_DIRECTOR);

      expect(resolveNextStatus('APPROVE_DIRECTOR', PeriodStatus.WAITING_DIRECTOR)).toBe(
        PeriodStatus.CLOSED,
      );
    });

    test('resolveNextStatus handles reject transitions', () => {
      expect(resolveNextStatus('REJECT', PeriodStatus.WAITING_HR)).toBe(PeriodStatus.OPEN);
      expect(resolveNextStatus('REJECT', PeriodStatus.WAITING_HEAD_FINANCE)).toBe(PeriodStatus.OPEN);
      expect(resolveNextStatus('REJECT', PeriodStatus.WAITING_DIRECTOR)).toBe(PeriodStatus.OPEN);
    });

    test('resolveNextStatus throws on invalid transitions', () => {
      expect(() => resolveNextStatus('SUBMIT', PeriodStatus.CLOSED)).toThrow('Invalid action');
    });

    test('canTransition checks role + status', () => {
      expect(canTransition(UserRole.PTS_OFFICER, 'SUBMIT', PeriodStatus.OPEN)).toBe(true);
      expect(canTransition(UserRole.HEAD_HR, 'SUBMIT', PeriodStatus.OPEN)).toBe(false);

      expect(
        canTransition(
          UserRole.HEAD_FINANCE,
          'APPROVE_HEAD_FINANCE',
          PeriodStatus.WAITING_HEAD_FINANCE,
        ),
      ).toBe(true);
      expect(
        canTransition(UserRole.HEAD_FINANCE, 'APPROVE_HEAD_FINANCE', PeriodStatus.OPEN),
      ).toBe(false);
    });
  });
});
