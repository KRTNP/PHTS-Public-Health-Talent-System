import { calculateMonthlyWithData } from '@/modules/payroll/core/calculator/facade/calculator.js';

test('no license record yields zero payment even with eligibility', async () => {
  const result = await calculateMonthlyWithData(2024, 10, {
    eligibilityRows: [
      {
        effective_date: '2024-09-01',
        expiry_date: null,
        rate: 5000,
        rate_id: 84,
      },
    ],
    movementRows: [
      {
        effective_date: '2022-01-01',
        movement_type: 'ENTRY',
      },
    ],
    employeeRow: {
      position_name: 'เจ้าหน้าที่',
      start_work_date: '2020-01-01',
    },
    licenseRows: [],
    leaveRows: [],
    quotaRow: null,
    holidays: [],
    noSalaryPeriods: [],
    returnReportRows: [],
  });

  expect(result.netPayment).toBe(0);
  expect(result.eligibleDays).toBe(0);
});

test('study movement uses precomputed quota path without fallback and deducts over-quota days', async () => {
  const result = await calculateMonthlyWithData(2024, 12, {
    eligibilityRows: [
      {
        effective_date: '2024-10-01',
        expiry_date: null,
        rate: 5000,
        rate_id: 84,
      },
    ],
    movementRows: [
      {
        effective_date: '2020-01-01',
        movement_type: 'ENTRY',
      },
      {
        effective_date: '2024-10-01',
        movement_type: 'STUDY',
      },
    ],
    employeeRow: {
      position_name: 'เจ้าหน้าที่',
      start_work_date: '2020-01-01',
    },
    licenseRows: [
      {
        valid_from: '2024-01-01',
        valid_until: '2025-12-31',
        status: 'ACTIVE',
      },
    ],
    leaveRows: [],
    quotaRow: null,
    holidays: [],
    noSalaryPeriods: [],
    returnReportRows: [],
  });

  expect(result.totalDeductionDays).toBe(30);
  expect(result.netPayment).toBe(161.29);
});

test('return report shortens study leave deduction window for synthetic study leave id', async () => {
  const baseInput = {
    eligibilityRows: [
      {
        effective_date: '2024-10-01',
        expiry_date: null,
        rate: 5000,
        rate_id: 84,
      },
    ],
    movementRows: [
      {
        effective_date: '2020-01-01',
        movement_type: 'ENTRY',
      },
      {
        effective_date: '2024-10-01',
        movement_type: 'STUDY',
      },
    ],
    employeeRow: {
      position_name: 'เจ้าหน้าที่',
      start_work_date: '2020-01-01',
    },
    licenseRows: [
      {
        valid_from: '2024-01-01',
        valid_until: '2025-12-31',
        status: 'ACTIVE',
      },
    ],
    leaveRows: [],
    quotaRow: null,
    holidays: [],
    noSalaryPeriods: [],
  };

  const withoutReturn = await calculateMonthlyWithData(2024, 12, {
    ...baseInput,
    returnReportRows: [],
  });
  const withReturn = await calculateMonthlyWithData(2024, 12, {
    ...baseInput,
    returnReportRows: [
      {
        leave_record_id: -1,
        return_date: '2024-12-20',
      },
    ],
  });

  expect(withoutReturn.totalDeductionDays).toBe(30);
  expect(withReturn.totalDeductionDays).toBeLessThan(withoutReturn.totalDeductionDays);
});

test('multiple return reports use earliest resume boundary for synthetic study leave', async () => {
  const baseInput = {
    eligibilityRows: [
      {
        effective_date: '2024-10-01',
        expiry_date: null,
        rate: 5000,
        rate_id: 84,
      },
    ],
    movementRows: [
      { effective_date: '2020-01-01', movement_type: 'ENTRY' },
      { effective_date: '2024-10-01', movement_type: 'STUDY' },
    ],
    employeeRow: {
      position_name: 'เจ้าหน้าที่',
      start_work_date: '2020-01-01',
    },
    licenseRows: [
      {
        valid_from: '2024-01-01',
        valid_until: '2025-12-31',
        status: 'ACTIVE',
      },
    ],
    leaveRows: [],
    quotaRow: null,
    holidays: [],
    noSalaryPeriods: [],
  };

  const withSingleLateReturn = await calculateMonthlyWithData(2024, 12, {
    ...baseInput,
    returnReportRows: [{ leave_record_id: -1, return_date: '2024-12-20' }],
  });

  const withMultipleReturns = await calculateMonthlyWithData(2024, 12, {
    ...baseInput,
    returnReportRows: [
      { leave_record_id: -1, return_date: '2024-12-20' },
      { leave_record_id: -1, return_date: '2024-12-10' },
      { leave_record_id: -1, return_date: '2024-12-25' },
    ],
  });

  expect(withMultipleReturns.totalDeductionDays).toBeLessThan(
    withSingleLateReturn.totalDeductionDays,
  );
});

test('education leave 902 pauses for B leave 903 and then resumes A on the same leave record', async () => {
  const result = await calculateMonthlyWithData(2026, 4, {
    eligibilityRows: [
      {
        effective_date: '2026-01-01',
        expiry_date: null,
        rate: 6200,
        rate_id: 90,
      },
    ],
    movementRows: [{ effective_date: '2020-01-01', movement_type: 'ENTRY' }],
    employeeRow: {
      position_name: 'นายแพทย์',
      start_work_date: '2020-01-01',
    },
    licenseRows: [
      {
        valid_from: '2026-01-01',
        valid_until: '2026-12-31',
        status: 'ACTIVE',
      },
    ],
    leaveRows: [
      {
        id: 902,
        leave_type: 'education',
        start_date: '2026-01-01',
        end_date: '2026-04-21',
        duration_days: 111,
        study_institution: 'HOSPITAL',
        study_program: 'A',
        study_major: 'A',
        return_report_events: [
          {
            report_date: '2026-01-31',
            resume_date: '2026-03-03',
          },
        ],
      },
      {
        id: 903,
        leave_type: 'education',
        start_date: '2026-02-15',
        end_date: '2026-03-01',
        duration_days: 15,
        study_institution: 'HOSPITAL',
        study_program: 'B',
        study_major: 'B',
        return_report_events: [
          {
            report_date: '2026-03-02',
          },
        ],
      },
    ],
    quotaRow: null,
    holidays: [],
    noSalaryPeriods: [],
    returnReportRows: [],
  });

  // A-series นับจากใบ 902 เฉพาะช่วง 1 ม.ค.-30 ม.ค. และ 3 มี.ค.-21 เม.ย.
  // ส่วน B ในใบ 903 ไม่นับรวมกับ A
  // ดังนั้นวันที่ 1 เม.ย. เป็นวันสิทธิวันสุดท้ายของ A และเริ่มเกินสิทธิวันที่ 2 เม.ย.
  // เม.ย. 2026 จึงถูกหักเฉพาะ 2-21 เม.ย. รวม 20 วัน
  expect(result.totalDeductionDays).toBe(20);
  expect(result.eligibleDays).toBe(10);
});

test('education leave 902 still needs final return report after ending on 2026-04-21', async () => {
  const result = await calculateMonthlyWithData(2026, 4, {
    eligibilityRows: [
      {
        effective_date: '2026-01-01',
        expiry_date: null,
        rate: 6200,
        rate_id: 90,
      },
    ],
    movementRows: [{ effective_date: '2020-01-01', movement_type: 'ENTRY' }],
    employeeRow: {
      position_name: 'นายแพทย์',
      start_work_date: '2020-01-01',
    },
    licenseRows: [
      {
        valid_from: '2026-01-01',
        valid_until: '2026-12-31',
        status: 'ACTIVE',
      },
    ],
    leaveRows: [
      {
        id: 902,
        leave_type: 'education',
        start_date: '2026-01-01',
        end_date: '2026-04-21',
        duration_days: 111,
        study_institution: 'HOSPITAL',
        study_program: 'A',
        study_major: 'A',
        require_return_report: 1,
        return_report_status: 'PENDING',
        return_report_events: [
          {
            report_date: '2026-01-31',
            resume_date: '2026-03-03',
            resume_study_institution: 'HOSPITAL',
            resume_study_program: 'A',
            resume_study_major: 'A',
          },
        ],
      },
      {
        id: 903,
        leave_type: 'education',
        start_date: '2026-02-15',
        end_date: '2026-03-01',
        duration_days: 15,
        study_institution: 'HOSPITAL',
        study_program: 'B',
        study_major: 'B',
        require_return_report: 1,
        return_report_status: 'DONE',
        return_report_events: [
          {
            report_date: '2026-03-02',
          },
        ],
      },
    ],
    quotaRow: null,
    holidays: [],
    noSalaryPeriods: [],
    returnReportRows: [],
  });

  expect(result.checks?.some((c) => c.code === 'PENDING_RETURN_REPORT')).toBe(true);
  expect(
    result.checks?.some(
      (c) =>
        c.code === 'PENDING_RETURN_REPORT' &&
        c.evidence.some(
          (ev) =>
            ev.type === 'leave' &&
            ev.leave_record_id === 902 &&
            ev.return_report_status === 'PENDING',
        ),
    ),
  ).toBe(true);
});

test('education leave 902 does not stay pending after final return report following 2026-04-21', async () => {
  const result = await calculateMonthlyWithData(2026, 4, {
    eligibilityRows: [
      {
        effective_date: '2026-01-01',
        expiry_date: null,
        rate: 6200,
        rate_id: 90,
      },
    ],
    movementRows: [{ effective_date: '2020-01-01', movement_type: 'ENTRY' }],
    employeeRow: {
      position_name: 'นายแพทย์',
      start_work_date: '2020-01-01',
    },
    licenseRows: [
      {
        valid_from: '2026-01-01',
        valid_until: '2026-12-31',
        status: 'ACTIVE',
      },
    ],
    leaveRows: [
      {
        id: 902,
        leave_type: 'education',
        start_date: '2026-01-01',
        end_date: '2026-04-21',
        duration_days: 111,
        study_institution: 'HOSPITAL',
        study_program: 'A',
        study_major: 'A',
        require_return_report: 1,
        return_report_status: 'DONE',
        return_report_events: [
          {
            report_date: '2026-01-31',
            resume_date: '2026-03-03',
            resume_study_institution: 'HOSPITAL',
            resume_study_program: 'A',
            resume_study_major: 'A',
          },
          {
            report_date: '2026-04-22',
          },
        ],
      },
      {
        id: 903,
        leave_type: 'education',
        start_date: '2026-02-15',
        end_date: '2026-03-01',
        duration_days: 15,
        study_institution: 'HOSPITAL',
        study_program: 'B',
        study_major: 'B',
        require_return_report: 1,
        return_report_status: 'DONE',
        return_report_events: [
          {
            report_date: '2026-03-02',
          },
        ],
      },
    ],
    quotaRow: null,
    holidays: [],
    noSalaryPeriods: [],
    returnReportRows: [],
  });

  expect(result.checks?.some((c) => c.code === 'PENDING_RETURN_REPORT')).toBe(false);
});

test('exit status cuts payroll eligibility even if there is re-entry in the same month', async () => {
  const result = await calculateMonthlyWithData(2024, 12, {
    eligibilityRows: [
      {
        effective_date: '2024-01-01',
        expiry_date: null,
        rate: 6200,
        rate_id: 90,
      },
    ],
    movementRows: [
      {
        effective_date: '2020-01-01',
        movement_type: 'ENTRY',
      },
      {
        effective_date: '2024-12-10',
        movement_type: 'RESIGN',
      },
      {
        effective_date: '2024-12-20',
        movement_type: 'REINSTATE',
      },
    ],
    employeeRow: {
      position_name: 'เจ้าหน้าที่',
      start_work_date: '2020-01-01',
    },
    licenseRows: [
      {
        valid_from: '2024-01-01',
        valid_until: '2025-12-31',
        status: 'ACTIVE',
      },
    ],
    leaveRows: [],
    quotaRow: null,
    holidays: [],
    noSalaryPeriods: [],
    returnReportRows: [],
  });

  // ธ.ค. 2024 ตัดสิทธิหลัง RESIGN วันที่ 10 จึงเหลือวันมีสิทธิแค่วันที่ 1-9
  expect(result.eligibleDays).toBe(9);
});

test('historical exit before this month does not cut current payroll rights by itself', async () => {
  const result = await calculateMonthlyWithData(2024, 12, {
    eligibilityRows: [
      {
        effective_date: '2024-01-01',
        expiry_date: null,
        rate: 6200,
        rate_id: 90,
      },
    ],
    movementRows: [
      {
        effective_date: '2020-01-01',
        movement_type: 'ENTRY',
      },
      {
        effective_date: '2023-08-01',
        movement_type: 'RESIGN',
      },
      {
        effective_date: '2024-01-15',
        movement_type: 'REINSTATE',
      },
    ],
    employeeRow: {
      position_name: 'เจ้าหน้าที่',
      start_work_date: '2020-01-01',
    },
    licenseRows: [
      {
        valid_from: '2024-01-01',
        valid_until: '2025-12-31',
        status: 'ACTIVE',
      },
    ],
    leaveRows: [],
    quotaRow: null,
    holidays: [],
    noSalaryPeriods: [],
    returnReportRows: [],
  });

  expect(result.eligibleDays).toBe(31);
});

