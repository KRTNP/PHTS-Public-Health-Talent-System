import { describe, expect, it } from 'vitest';
import {
  directorRequestApprovalDetailConfig,
  headFinanceRequestApprovalDetailConfig,
  headHrRequestApprovalDetailConfig,
} from './requestApprovalDetail.config';
import type { RequestApprovalDetailComputed } from './requestApprovalDetail.types';

function createComputed(params?: {
  isHistoryView?: boolean;
  status?: string;
  currentStep?: number;
}): RequestApprovalDetailComputed {
  return {
    request: params?.status
      ? ({
          status: params.status,
          current_step: params.currentStep ?? 0,
        } as RequestApprovalDetailComputed['request'])
      : undefined,
    isHistoryView: params?.isHistoryView ?? false,
    displayId: 'REQ-001',
    requesterName: 'Tester',
    requestDepartmentValue: 'Dept',
    requestSubDepartmentValue: 'Unit',
  };
}

describe('request approval detail role config', () => {
  it('keeps fixed back path and redirect path per role', () => {
    expect(directorRequestApprovalDetailConfig.backHref(false)).toBe('/director/requests');
    expect(directorRequestApprovalDetailConfig.backHref(true)).toBe('/director/history');
    expect(directorRequestApprovalDetailConfig.redirectAfterAction).toBe('/director/requests');

    expect(headFinanceRequestApprovalDetailConfig.backHref(false)).toBe('/head-finance/requests');
    expect(headFinanceRequestApprovalDetailConfig.backHref(true)).toBe('/head-finance/history');
    expect(headFinanceRequestApprovalDetailConfig.redirectAfterAction).toBe('/head-finance/requests');

    expect(headHrRequestApprovalDetailConfig.backHref(false)).toBe('/head-hr/requests');
    expect(headHrRequestApprovalDetailConfig.backHref(true)).toBe('/head-hr/history');
    expect(headHrRequestApprovalDetailConfig.redirectAfterAction).toBe('/head-hr/requests');
  });

  it('only allows action for matching fixed step when pending and not history', () => {
    const directorPending6 = createComputed({ status: 'PENDING', currentStep: 6 });
    const directorPending5 = createComputed({ status: 'PENDING', currentStep: 5 });
    const directorHistory = createComputed({ isHistoryView: true, status: 'PENDING', currentStep: 6 });
    expect(directorRequestApprovalDetailConfig.canAct(directorPending6)).toBe(true);
    expect(directorRequestApprovalDetailConfig.canAct(directorPending5)).toBe(false);
    expect(directorRequestApprovalDetailConfig.canAct(directorHistory)).toBe(false);

    const financePending5 = createComputed({ status: 'PENDING', currentStep: 5 });
    const financePending4 = createComputed({ status: 'PENDING', currentStep: 4 });
    expect(headFinanceRequestApprovalDetailConfig.canAct(financePending5)).toBe(true);
    expect(headFinanceRequestApprovalDetailConfig.canAct(financePending4)).toBe(false);

    const hrPending4 = createComputed({ status: 'PENDING', currentStep: 4 });
    const hrPending3 = createComputed({ status: 'PENDING', currentStep: 3 });
    expect(headHrRequestApprovalDetailConfig.canAct(hrPending4)).toBe(true);
    expect(headHrRequestApprovalDetailConfig.canAct(hrPending3)).toBe(false);
  });
});
