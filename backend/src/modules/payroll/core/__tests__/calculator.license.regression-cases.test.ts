import { calculateMonthlyWithData } from '@/modules/payroll/core/calculator/facade/calculator.js';
import { buildWeekdayOneDayLeaves, makeBaseInput } from './calculator.license.shared.js';

test('TC-05 license ครอบคลุมทั้งเดือน => ได้สิทธิครบและได้เงินเต็ม', async () => {
  const result = await calculateMonthlyWithData(2024, 9, makeBaseInput());
  expect(result.eligibleDays).toBe(30);
  expect(result.netPayment).toBe(6000);
});

test('TC-06 license หมดกลางเดือน => ได้สิทธิถึงวันหมดอายุ', async () => {
  const result = await calculateMonthlyWithData(
    2024,
    9,
    makeBaseInput({
      licenseRows: [
        {
          valid_from: '2024-01-01',
          valid_until: '2024-09-15',
          status: 'ACTIVE',
        },
      ],
    }),
  );
  expect(result.eligibleDays).toBe(15);
  expect(result.netPayment).toBe(3000);
});

test('TC-07 ใบเดิมหมด 6 ส.ค. และใบใหม่เริ่ม 7 ส.ค. ต่อเนื่อง => ต้องไม่ขาดสิทธิ', async () => {
  const result = await calculateMonthlyWithData(
    2025,
    8,
    makeBaseInput({
      licenseRows: [
        {
          valid_from: '2020-08-07',
          valid_until: '2025-08-06',
          status: 'EXPIRED',
        },
        {
          valid_from: '2025-08-07',
          valid_until: '2030-08-06',
          status: 'ACTIVE',
        },
      ],
    }),
  );

  expect(result.eligibleDays).toBe(31);
  expect(result.totalDeductionDays).toBe(0);
  expect(result.netPayment).toBe(6000);
});

test('TC-08 license เริ่มกลางเดือน => ได้สิทธิแค่ช่วงปลายเดือน', async () => {
  const result = await calculateMonthlyWithData(
    2024,
    9,
    makeBaseInput({
      licenseRows: [
        {
          valid_from: '2024-09-20',
          valid_until: '2025-12-31',
          status: 'ACTIVE',
        },
      ],
    }),
  );
  expect(result.eligibleDays).toBe(11);
  expect(result.netPayment).toBe(2200);
});

test('TC-09 ลากิจเกินลิมิตสะสม => หักเฉพาะส่วนที่เกิน', async () => {
  const previousPersonal40 = buildWeekdayOneDayLeaves('personal', '2024-10-01', 40, 1000);
  const currentPersonal10 = buildWeekdayOneDayLeaves('personal', '2024-12-02', 10, 2000);

  const result = await calculateMonthlyWithData(
    2024,
    12,
    makeBaseInput({
      leaveRows: [...previousPersonal40, ...currentPersonal10],
      quotaRow: { quota_personal: 45 },
    }),
  );

  expect(result.totalDeductionDays).toBe(5);
});

test('TC-10 ลาป่วยยังไม่เกินลิมิต => ไม่ถูกหัก', async () => {
  const previousSick50 = buildWeekdayOneDayLeaves('sick', '2024-10-01', 50, 3000);
  const currentSick5 = buildWeekdayOneDayLeaves('sick', '2024-12-02', 5, 4000);

  const result = await calculateMonthlyWithData(
    2024,
    12,
    makeBaseInput({
      leaveRows: [...previousSick50, ...currentSick5],
      quotaRow: { quota_sick: 60 },
    }),
  );

  expect(result.totalDeductionDays).toBe(0);
});

test('TC-12 ลาเรียนยาวเกิน 60 วัน => หักเฉพาะช่วงเกินในเดือนเป้าหมาย', async () => {
  const result = await calculateMonthlyWithData(
    2024,
    12,
    makeBaseInput({
      leaveRows: [
        {
          id: 5101,
          leave_type: 'education',
          start_date: '2024-10-01',
          end_date: '2024-12-09',
          duration_days: 70,
        },
      ],
      returnReportRows: [
        {
          leave_record_id: 5101,
          return_date: '2024-12-10',
        },
      ],
    }),
  );

  // ช่วงเกินคือวันลำดับ 61-70 -> ในเดือน ธ.ค. มี 9 วัน (1-9)
  expect(result.totalDeductionDays).toBe(9);
});

test('TC-14 ใบอนุญาตหมดกลางเดือน + ลาเกินลิมิต => eligible_days เหลือ 15', async () => {
  const previousPersonal45 = buildWeekdayOneDayLeaves('personal', '2024-07-01', 45, 6000);
  const currentPersonal5 = buildWeekdayOneDayLeaves('personal', '2024-09-02', 5, 7000);

  const result = await calculateMonthlyWithData(
    2024,
    9,
    makeBaseInput({
      leaveRows: [...previousPersonal45, ...currentPersonal5],
      quotaRow: { quota_personal: 45 },
      licenseRows: [
        {
          valid_from: '2024-01-01',
          valid_until: '2024-09-20',
          status: 'ACTIVE',
        },
      ],
    }),
  );

  expect(result.eligibleDays).toBe(15);
  expect(result.netPayment).toBe(3000);
});

test('TC-15 ลาข้ามเดือน => ในรอบก.พ.นับเฉพาะวันในก.พ.', async () => {
  const result = await calculateMonthlyWithData(
    2025,
    2,
    makeBaseInput({
      leaveRows: [
        {
          id: 8001,
          leave_type: 'sick',
          start_date: '2025-01-31',
          end_date: '2025-02-02',
          duration_days: 3,
          is_no_pay: 1,
        },
      ],
    }),
  );

  // ก.พ. 2025 มี 28 วัน และถูกหักเฉพาะ 1-2 ก.พ.
  expect(result.totalDeductionDays).toBe(2);
  expect(result.eligibleDays).toBe(26);
});

test('leap year february no-pay across month deducts all 29 days in Feb only', async () => {
  const result = await calculateMonthlyWithData(
    2024,
    2,
    makeBaseInput({
      leaveRows: [
        {
          id: 8101,
          leave_type: 'sick',
          start_date: '2024-01-31',
          end_date: '2024-02-29',
          duration_days: 30,
          is_no_pay: 1,
        },
      ],
    }),
  );

  expect(result.totalDeductionDays).toBe(29);
  expect(result.eligibleDays).toBe(0);
  expect(result.netPayment).toBe(0);
});

test('leave crossing fiscal boundary Sep to Oct deducts only October days', async () => {
  const result = await calculateMonthlyWithData(
    2024,
    10,
    makeBaseInput({
      leaveRows: [
        {
          id: 8201,
          leave_type: 'sick',
          start_date: '2024-09-30',
          end_date: '2024-10-02',
          duration_days: 3,
          is_no_pay: 1,
        },
      ],
    }),
  );

  // ในรอบ ต.ค. ต้องหักเฉพาะ 1-2 ต.ค.
  expect(result.totalDeductionDays).toBe(2);
  expect(result.eligibleDays).toBe(29);
});

test('exit on first day yields zero eligible days', async () => {
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
        effective_date: '2024-12-01',
        movement_type: 'RESIGN',
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

  expect(result.eligibleDays).toBe(0);
  expect(result.netPayment).toBe(0);
});

test('exit on last day keeps eligibility until day before exit', async () => {
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
        effective_date: '2024-12-31',
        movement_type: 'TRANSFER_OUT',
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

  expect(result.eligibleDays).toBe(30);
});

test('when multiple exits exist in month, first exit date is used', async () => {
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
        effective_date: '2024-12-18',
        movement_type: 'RETIRE',
      },
      {
        effective_date: '2024-12-10',
        movement_type: 'RESIGN',
      },
      {
        effective_date: '2024-12-25',
        movement_type: 'DEATH',
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

  // first exit = 2024-12-10 => eligible 1..9
  expect(result.eligibleDays).toBe(9);
});

test('same-day entry and exit still cut rights by exit status policy', async () => {
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
        effective_date: '2024-12-10',
        movement_type: 'ENTRY',
      },
      {
        effective_date: '2024-12-10',
        movement_type: 'RESIGN',
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

  expect(result.eligibleDays).toBe(9);
});

test('exit datetime with time still cuts by the movement local date', async () => {
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
        effective_date: '2024-12-10T00:30:00+07:00',
        movement_type: 'RETIRE',
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

  expect(result.eligibleDays).toBe(9);
});

test('missing start_work_date raises blocker check and does not fallback to first_entry_date', async () => {
  const personal20Days = buildWeekdayOneDayLeaves('personal', '2026-11-02', 20, 9000);

  const result = await calculateMonthlyWithData(2026, 11, {
    eligibilityRows: [
      {
        effective_date: '2026-01-01',
        expiry_date: null,
        rate: 6000,
        rate_id: 90,
      },
    ],
    movementRows: [],
    employeeRow: {
      position_name: 'เจ้าหน้าที่',
      start_work_date: null,
      first_entry_date: '2026-10-10',
    },
    licenseRows: [
      {
        valid_from: '2026-01-01',
        valid_until: '2026-12-31',
        status: 'ACTIVE',
      },
    ],
    leaveRows: personal20Days,
    quotaRow: { quota_personal: 45 },
    holidays: [],
    noSalaryPeriods: [],
    returnReportRows: [],
  });

  // ถ้า fallback ไป first_entry_date จะถูกมองเป็นปีแรกและโดนหัก 5 วัน
  // เคสนี้ต้องไม่ fallback จึงไม่ถูกหัก
  expect(result.totalDeductionDays).toBe(0);
  expect(result.checks?.some((c) => c.code === 'MISSING_START_WORK_DATE')).toBe(true);
  expect(
    result.checks?.some((c) => c.code === 'MISSING_START_WORK_DATE' && c.severity === 'BLOCKER'),
  ).toBe(true);
});

test('does not extend deduction for missing return report and raises warning instead', async () => {
  const result = await calculateMonthlyWithData(2026, 2, {
    eligibilityRows: [
      {
        effective_date: '2026-01-01',
        expiry_date: null,
        rate: 6000,
        rate_id: 90,
      },
    ],
    movementRows: [],
    employeeRow: {
      position_name: 'เจ้าหน้าที่',
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
        id: 9901,
        leave_type: 'education',
        start_date: '2026-02-01',
        end_date: '2026-02-10',
        duration_days: 10,
        require_return_report: 1,
        return_report_status: 'PENDING',
      },
    ],
    quotaRow: null,
    holidays: [],
    noSalaryPeriods: [],
    returnReportRows: [],
  });

  expect(result.totalDeductionDays).toBe(0);
  expect(result.checks?.some((c) => c.code === 'PENDING_RETURN_REPORT')).toBe(true);
  expect(
    result.checks?.some((c) => c.code === 'PENDING_RETURN_REPORT' && c.severity === 'WARNING'),
  ).toBe(true);
});
