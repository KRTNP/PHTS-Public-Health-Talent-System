export const makeBaseInput = (overrides: Record<string, any> = {}) => ({
  eligibilityRows: [
    {
      effective_date: '2024-01-01',
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
  ...overrides,
});

export const buildWeekdayOneDayLeaves = (
  leaveType: string,
  startDate: string,
  count: number,
  idStart: number,
) => {
  const rows: any[] = [];
  const cursor = new Date(startDate);
  let id = idStart;
  while (rows.length < count) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      const d = cursor.toISOString().slice(0, 10);
      rows.push({
        id,
        leave_type: leaveType,
        start_date: d,
        end_date: d,
        duration_days: 1,
      });
      id += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return rows;
};
