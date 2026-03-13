import { expect, test } from '@jest/globals';
import { calculateLeaveQuotaStatus } from '../services/leave-domain.service';
import { baseQuota, baseRules } from './leave-domain.service.shared.js';
test("business days exclude weekend and holiday", () => {
  const result = calculateLeaveQuotaStatus({
    leaveRows: [
      {
        id: 1,
        citizen_id: "123",
        leave_type: "sick",
        start_date: "2026-02-02",
        end_date: "2026-02-04",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
      },
    ],
    holidays: ["2026-02-03"],
    quota: baseQuota,
    rules: baseRules,
    serviceStartDate: null,
  });

  expect(result.perType.sick.used).toBe(2);
});

test("calendar days count all days", () => {
  const result = calculateLeaveQuotaStatus({
    leaveRows: [
      {
        id: 2,
        citizen_id: "123",
        leave_type: "maternity",
        start_date: "2026-02-02",
        end_date: "2026-02-04",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
      },
    ],
    holidays: ["2026-02-03"],
    quota: baseQuota,
    rules: baseRules,
    serviceStartDate: null,
  });

  expect(result.perType.maternity.used).toBe(3);
});

test("document dates override leave record dates", () => {
  const result = calculateLeaveQuotaStatus({
    leaveRows: [
      {
        id: 3,
        citizen_id: "123",
        leave_type: "education",
        start_date: "2026-02-01",
        end_date: "2026-02-10",
        document_start_date: "2026-02-03",
        document_end_date: "2026-02-04",
        is_no_pay: 0,
        pay_exception: 0,
      },
    ],
    holidays: [],
    quota: baseQuota,
    rules: baseRules,
    serviceStartDate: null,
  });

  expect(result.perType.education.used).toBe(2);
});

test("vacation uses quota from leave_quotas", () => {
  const result = calculateLeaveQuotaStatus({
    leaveRows: [
      {
        id: 4,
        citizen_id: "123",
        leave_type: "vacation",
        start_date: "2026-02-02",
        end_date: "2026-02-09",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
      },
    ],
    holidays: [],
    quota: { quota_vacation: 5, quota_personal: 45, quota_sick: 60 },
    rules: baseRules,
    serviceStartDate: null,
  });

  expect(result.perType.vacation.limit).toBe(5);
  expect(result.perType.vacation.overQuota).toBe(true);
});

test("first-year personal leave limit is 15", () => {
  const result = calculateLeaveQuotaStatus({
    leaveRows: [
      {
        id: 5,
        citizen_id: "123",
        leave_type: "personal",
        start_date: "2026-11-02",
        end_date: "2026-11-23",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
      },
    ],
    holidays: [],
    quota: baseQuota,
    rules: baseRules,
    serviceStartDate: new Date("2026-10-10"),
  });

  expect(result.perType.personal.limit).toBe(15);
  expect(result.perType.personal.overQuota).toBe(true);
});

test("ordain leave has no paid quota if service < 1 year", () => {
  const result = calculateLeaveQuotaStatus({
    leaveRows: [
      {
        id: 6,
        citizen_id: "123",
        leave_type: "ordain",
        start_date: "2026-06-01",
        end_date: "2026-06-05",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
      },
    ],
    holidays: [],
    quota: baseQuota,
    rules: baseRules,
    serviceStartDate: new Date("2026-01-01"),
  });

  expect(result.perType.ordain.limit).toBe(0);
  expect(result.perType.ordain.overQuota).toBe(true);
});

test("ignores leaves after range end when calculating usage", () => {
  const result = calculateLeaveQuotaStatus({
    leaveRows: [
      {
        id: 1,
        citizen_id: "123",
        leave_type: "personal",
        start_date: "2025-08-04",
        end_date: "2025-08-05",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
      },
      {
        id: 2,
        citizen_id: "123",
        leave_type: "personal",
        start_date: "2025-09-01",
        end_date: "2025-09-02",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
      },
    ],
    holidays: [],
    quota: baseQuota,
    rules: baseRules,
    serviceStartDate: null,
    rangeStart: new Date("2025-01-01"),
    rangeEnd: new Date("2025-08-31"),
  });

  expect(result.perType.personal.used).toBe(2);
  expect(Object.keys(result.perLeave)).toEqual(["1"]);
});

test("clamps leave across fiscal year boundary to range start", () => {
  const result = calculateLeaveQuotaStatus({
    leaveRows: [
      {
        id: 10,
        citizen_id: "123",
        leave_type: "vacation",
        start_date: "2024-09-30",
        end_date: "2024-10-01",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
      },
    ],
    holidays: [],
    quota: baseQuota,
    rules: baseRules,
    serviceStartDate: null,
    rangeStart: new Date("2024-10-01"),
    rangeEnd: new Date("2024-10-31"),
  });

  expect(result.perLeave[10].duration).toBe(1);
});

test("wife_help is per_event: two separate events under 15 days should not become over quota", () => {
  const result = calculateLeaveQuotaStatus({
    leaveRows: [
      {
        id: 20,
        citizen_id: "123",
        leave_type: "wife_help",
        start_date: "2026-01-05",
        end_date: "2026-01-16",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
      },
      {
        id: 21,
        citizen_id: "123",
        leave_type: "wife_help",
        start_date: "2026-03-02",
        end_date: "2026-03-13",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
      },
    ],
    holidays: [],
    quota: baseQuota,
    rules: baseRules,
    serviceStartDate: null,
  });

  expect(result.perLeave[20].duration).toBe(10);
  expect(result.perLeave[21].duration).toBe(10);
  expect(result.perLeave[20].overQuota).toBe(false);
  expect(result.perLeave[21].overQuota).toBe(false);
  expect(result.perType.wife_help.overQuota).toBe(false);
});

