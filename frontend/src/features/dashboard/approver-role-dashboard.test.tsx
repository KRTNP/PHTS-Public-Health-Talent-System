import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ApproverRoleDashboardPage } from '@/features/dashboard/approver-role-dashboard';
import {
  headFinanceDashboardConfig,
  headHrDashboardConfig,
} from '@/features/dashboard/approver-role-dashboard.config';

vi.mock('@/features/dashboard/hooks', () => ({
  useApproverDashboard: vi.fn(() => ({
    isLoading: false,
    data: {
      stats: {
        pending_requests: 3,
        pending_payrolls: 2,
        approved_month: 9,
        sla_overdue: 1,
      },
      pending_requests: [
        {
          id: 'REQ-1',
          name: 'นายทดสอบ ระบบ',
          position: 'นักวิชาการ',
          department: 'ทรัพยากรบุคคล',
          amount: 1500,
          date: '2026-04-01',
          sla_status: 'warning',
        },
      ],
      pending_payrolls: [
        {
          id: 'PAY-1',
          month: 'เมษายน 2026',
          totalAmount: 50000,
          totalPersons: 7,
          submittedAt: '2026-04-01',
        },
      ],
    },
  })),
}));

describe('ApproverRoleDashboardPage', () => {
  it('renders HR config-driven links with head-hr prefix', () => {
    render(<ApproverRoleDashboardPage config={headHrDashboardConfig} />);

    expect(screen.getByText(headHrDashboardConfig.subtitle)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'อนุมัติคำขอ' })).toHaveAttribute('href', '/head-hr/requests');
    expect(screen.getByRole('link', { name: 'อนุมัติรอบจ่าย' })).toHaveAttribute('href', '/head-hr/payroll');
    expect(screen.getByRole('link', { name: 'รายงานกำหนดเวลา' })).toHaveAttribute('href', '/head-hr/sla-report');
  });

  it('renders finance config-driven links with head-finance prefix', () => {
    render(<ApproverRoleDashboardPage config={headFinanceDashboardConfig} />);

    expect(screen.getByText(headFinanceDashboardConfig.subtitle)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'อนุมัติคำขอ' })).toHaveAttribute(
      'href',
      '/head-finance/requests',
    );
    expect(screen.getByRole('link', { name: 'อนุมัติรอบจ่าย' })).toHaveAttribute(
      'href',
      '/head-finance/payroll',
    );
    expect(screen.getByRole('link', { name: 'รายงานอื่นๆ' })).toHaveAttribute('href', '/head-finance/reports');
  });
});
