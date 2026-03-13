import { expect, test } from '@jest/globals';
import { calculateLeaveQuotaStatus } from '../services/leave-domain.service';
import { baseQuota, baseRules } from './leave-domain.service.shared.js';
test("education with same course key accumulates across interruptions while different course stays separate", () => {
  const result = calculateLeaveQuotaStatus({
    leaveRows: [
      {
        id: 30,
        citizen_id: "123",
        leave_type: "education",
        start_date: "2026-01-01",
        end_date: "2026-01-30",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
        study_program: "A",
      },
      {
        id: 31,
        citizen_id: "123",
        leave_type: "education",
        start_date: "2026-02-01",
        end_date: "2026-02-15",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
        study_program: "B",
      },
      {
        id: 32,
        citizen_id: "123",
        leave_type: "education",
        start_date: "2026-02-16",
        end_date: "2026-03-31",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
        study_program: "A",
      },
    ],
    holidays: [],
    quota: baseQuota,
    rules: baseRules,
    serviceStartDate: null,
  });

  expect(result.perLeave[30].duration).toBe(30);
  expect(result.perLeave[31].duration).toBe(15);
  expect(result.perLeave[32].duration).toBe(44);

  expect(result.perLeave[30].overQuota).toBe(false);
  expect(result.perLeave[31].overQuota).toBe(false);
  expect(result.perLeave[32].overQuota).toBe(true);
  expect(result.perLeave[32].exceedDate).toBe("2026-03-18");
});

test("education A/B/A/C/A counts only A cumulatively and exceeds quota by 8 days", () => {
  const result = calculateLeaveQuotaStatus({
    leaveRows: [
      {
        id: 101,
        citizen_id: "123",
        leave_type: "education",
        start_date: "2026-01-01",
        end_date: "2026-01-30", // A รอบ 1 = 30 วัน
        study_program: "A",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
      },
      {
        id: 102,
        citizen_id: "123",
        leave_type: "education",
        start_date: "2026-02-01",
        end_date: "2026-02-15", // B = 15 วัน (ไม่นับรวม A)
        study_program: "B",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
      },
      {
        id: 103,
        citizen_id: "123",
        leave_type: "education",
        start_date: "2026-03-01",
        end_date: "2026-03-20", // A รอบ 2 = 20 วัน
        study_program: "A",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
      },
      {
        id: 104,
        citizen_id: "123",
        leave_type: "education",
        start_date: "2026-04-01",
        end_date: "2026-04-10", // C = 10 วัน (ไม่นับรวม A)
        study_program: "C",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
      },
      {
        id: 105,
        citizen_id: "123",
        leave_type: "education",
        start_date: "2026-05-01",
        end_date: "2026-05-18", // A รอบ 3 = 18 วัน
        study_program: "A",
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

  // A รวม 30 + 20 + 18 = 68 > 60 (เกิน 8)
  expect(result.perLeave[101].duration).toBe(30);
  expect(result.perLeave[103].duration).toBe(20);
  expect(result.perLeave[105].duration).toBe(18);
  expect(result.perLeave[105].overQuota).toBe(true);
  expect(result.perLeave[105].exceedDate).toBe("2026-05-11");

  // B/C ไม่เอาไปรวมกับ A series
  expect(result.perLeave[102].overQuota).toBe(false);
  expect(result.perLeave[104].overQuota).toBe(false);
});

test("ordain with same remark accumulates across interruptions and can exceed quota", () => {
  const result = calculateLeaveQuotaStatus({
    leaveRows: [
      {
        id: 40,
        citizen_id: "123",
        leave_type: "ordain",
        start_date: "2026-01-01",
        end_date: "2026-01-30",
        remark: "ORDAIN-2026",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
      },
      {
        id: 41,
        citizen_id: "123",
        leave_type: "ordain",
        start_date: "2026-03-01",
        end_date: "2026-04-09",
        remark: "ORDAIN-2026",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
      },
    ],
    holidays: [],
    quota: baseQuota,
    rules: baseRules,
    serviceStartDate: new Date("2020-01-01"),
  });

  expect(result.perLeave[40].duration).toBe(30);
  expect(result.perLeave[41].duration).toBe(40);
  expect(result.perLeave[41].overQuota).toBe(true);
  expect(result.perLeave[41].exceedDate).toBe("2026-03-31");
});

test("military with same remark accumulates across interruptions and can exceed quota", () => {
  const result = calculateLeaveQuotaStatus({
    leaveRows: [
      {
        id: 50,
        citizen_id: "123",
        leave_type: "military",
        start_date: "2026-05-01",
        end_date: "2026-05-30",
        remark: "MILITARY-CALL-1",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
      },
      {
        id: 51,
        citizen_id: "123",
        leave_type: "military",
        start_date: "2026-07-01",
        end_date: "2026-08-09",
        remark: "MILITARY-CALL-1",
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

  expect(result.perLeave[50].duration).toBe(30);
  expect(result.perLeave[51].duration).toBe(40);
  expect(result.perLeave[51].overQuota).toBe(true);
  expect(result.perLeave[51].exceedDate).toBe("2026-07-31");
});

test("single education leave with return-report events pauses quota counting between report and resume", () => {
  const result = calculateLeaveQuotaStatus({
    leaveRows: [
      {
        id: 900,
        citizen_id: "123",
        leave_type: "education",
        start_date: "2026-01-01",
        end_date: "2026-04-03",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
        study_institution: "A",
        study_program: "A",
        study_major: "A",
        return_report_events: [
          { report_date: "2026-01-31", resume_date: "2026-02-15" }, // pause 15 days
          { report_date: "2026-03-07", resume_date: "2026-03-17" }, // pause 10 days
        ],
      },
    ],
    holidays: [],
    quota: baseQuota,
    rules: baseRules,
    serviceStartDate: null,
  });

  // effective A duration = 30 + 20 + 18 = 68
  expect(result.perLeave[900].duration).toBe(68);
  expect(result.perLeave[900].overQuota).toBe(true);
  expect(result.perLeave[900].exceedDate).toBe("2026-03-27");
});

test("single education leave can switch A/B/C via resume event metadata and only A series exceeds quota", () => {
  const result = calculateLeaveQuotaStatus({
    leaveRows: [
      {
        id: 901,
        citizen_id: "123",
        leave_type: "education",
        start_date: "2026-01-01",
        end_date: "2026-04-21",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
        study_institution: "HOSPITAL",
        study_program: "A",
        study_major: "A",
        return_report_events: [
          {
            report_date: "2026-01-31",
            resume_date: "2026-02-15",
            resume_study_institution: "HOSPITAL",
            resume_study_program: "B",
            resume_study_major: "B",
          },
          {
            report_date: "2026-03-02",
            resume_date: "2026-03-03",
            resume_study_institution: "HOSPITAL",
            resume_study_program: "A",
            resume_study_major: "A",
          },
          {
            report_date: "2026-03-23",
            resume_date: "2026-03-24",
            resume_study_institution: "HOSPITAL",
            resume_study_program: "C",
            resume_study_major: "C",
          },
          {
            report_date: "2026-04-03",
            resume_date: "2026-04-04",
            resume_study_institution: "HOSPITAL",
            resume_study_program: "A",
            resume_study_major: "A",
          },
        ],
      },
    ],
    holidays: [],
    quota: baseQuota,
    rules: baseRules,
    serviceStartDate: null,
  });

  // A = 30 + 20 + 18 = 68 -> exceed 60 at 2026-04-14
  expect(result.perLeave[901].overQuota).toBe(true);
  expect(result.perLeave[901].exceedDate).toBe("2026-04-14");
  expect(result.perType.education.used).toBe(93); // A+B+A+C+A
});
