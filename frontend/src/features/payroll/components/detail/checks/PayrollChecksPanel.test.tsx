import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PayoutDetail } from '@/features/payroll/api';
import type { PayrollRow } from '../model/detail.types';
import { PayrollChecksPanel } from './PayrollChecksPanel';

vi.mock('next/navigation', () => ({
  usePathname: () => '/pts-officer/payroll',
}));

vi.mock('./ChecksIssuesSection', () => ({
  ChecksIssuesSection: () => <div data-testid="checks-issues-section" />,
}));

vi.mock('./ChecksCalculationSection', () => ({
  ChecksCalculationSection: () => <div data-testid="checks-calculation-section" />,
}));

function buildPayoutDetail(): PayoutDetail {
  return {
    payout: {
      payout_id: 1,
      period_id: 99,
      period_month: 2,
      period_year: 2569,
      citizen_id: '8571076019723',
      pts_rate_snapshot: 1500,
      eligible_days: 28,
      deducted_days: 0,
      calculated_amount: 1250,
      retroactive_amount: 0,
      total_payable: 1250,
      updated_by: 0,
    },
    items: [],
    checks: [],
    rateBreakdown: [
      {
        start_date: '2026-02-01',
        end_date: '2026-02-14',
        days: 14,
        rate: 1000,
        amount: 500,
      },
      {
        start_date: '2026-02-15',
        end_date: '2026-02-28',
        days: 14,
        rate: 1500,
        amount: 750,
      },
    ],
  };
}

function buildFallbackRow(): PayrollRow {
  return {
    id: 1,
    citizenId: '8571076019723',
    eligibilityId: null,
    requestId: null,
    title: 'นางสาว',
    name: 'อชิรญา ยาโหละ',
    position: 'พยาบาล',
    department: 'ER',
    professionCode: 'NURSE',
    rateGroup: '2',
    groupNo: '2',
    itemNo: '1',
    subItemNo: '1',
    baseRate: 1500,
    retroactiveAmount: 0,
    workDays: 28,
    leaveDays: 0,
    totalAmount: 1250,
    deductionAmount: 250,
    issues: [],
    checkCount: 0,
    blockerCount: 0,
    warningCount: 0,
    leaveCountInPeriod: 0,
    educationLeaveCountInPeriod: 0,
  };
}

describe('PayrollChecksPanel deduction summary', () => {
  it('hides deduction alert for full-month rate split and avoids misleading day deduction text', () => {
    render(<PayrollChecksPanel payoutDetail={buildPayoutDetail()} fallbackRow={buildFallbackRow()} />);

    expect(screen.queryByText(/งวดนี้ถูกหัก/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\(0 วัน\)/)).not.toBeInTheDocument();
  });

  it('does not show day-based deduction wording for full-month rate split', () => {
    render(<PayrollChecksPanel payoutDetail={buildPayoutDetail()} fallbackRow={buildFallbackRow()} />);

    expect(screen.queryByText(/ถูกหักสิทธิ .* วัน/)).not.toBeInTheDocument();
  });
});
