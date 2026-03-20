import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChecksIssuesSection } from './ChecksIssuesSection';

describe('ChecksIssuesSection', () => {
  it('shows synthetic rate-change issue from rateBreakdown when checks are empty', () => {
    render(
      <ChecksIssuesSection
        checks={[]}
        rateBreakdown={[
          {
            start_date: '2026-02-01',
            end_date: '2026-02-14',
            days: 14,
            rate: 1000,
            amount: 500,
            group_no: 1,
            item_no: 1,
            sub_item_no: 1,
          },
          {
            start_date: '2026-02-15',
            end_date: '2026-02-28',
            days: 14,
            rate: 1500,
            amount: 750,
            group_no: 2,
            item_no: 1,
            sub_item_no: 1,
          },
        ]}
        fallbackIssues={[]}
      />,
    );

    expect(screen.getByText('มีการเปลี่ยนกลุ่มหรืออัตรากลางเดือน')).toBeInTheDocument();
    expect(screen.getByText(/หลักฐานอ้างอิง \(2 รายการ\)/)).toBeInTheDocument();
  });
});
