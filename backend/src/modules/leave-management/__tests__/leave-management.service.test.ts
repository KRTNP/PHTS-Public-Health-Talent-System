import { describe, expect, test, jest } from "@jest/globals";

const insertLeaveManagementMock = jest.fn().mockResolvedValue(99);
const upsertExtensionMock = jest.fn().mockResolvedValue(undefined);
const replaceLeaveReturnReportEventsMock = jest.fn().mockResolvedValue(undefined);
const findExtensionReturnMetaMock = jest.fn().mockResolvedValue({ require_return_report: 1 });
const upsertLegacyReturnReportCompatMock = jest.fn().mockResolvedValue(undefined);
const listLeaveReturnReportEventsByLeaveIdsMock = jest.fn().mockResolvedValue([]);
const findLeaveManagementQuotaContextMock = jest.fn();
const listLeaveManagementRowsForQuotaMock = jest.fn();
const findQuotaRowMock = jest.fn();
const findLatestQuotaRowBeforeFiscalYearMock = jest.fn();
const findHolidaysForFiscalYearMock = jest.fn();
const findEmployeeServiceDatesMock = jest.fn();
const calculateLeaveQuotaStatusMock = jest.fn();

jest.mock("../repositories/leave-management.repository", () => ({
  LeaveManagementRepository: jest.fn().mockImplementation(() => ({
    insertLeaveManagement: insertLeaveManagementMock,
    upsertExtension: upsertExtensionMock,
    replaceLeaveReturnReportEvents: replaceLeaveReturnReportEventsMock,
    findExtensionReturnMeta: findExtensionReturnMetaMock,
    upsertLegacyReturnReportCompat: upsertLegacyReturnReportCompatMock,
    listLeaveReturnReportEventsByLeaveIds: listLeaveReturnReportEventsByLeaveIdsMock,
    findLeaveManagementQuotaContext: findLeaveManagementQuotaContextMock,
    listLeaveManagementRowsForQuota: listLeaveManagementRowsForQuotaMock,
    findQuotaRow: findQuotaRowMock,
    findLatestQuotaRowBeforeFiscalYear: findLatestQuotaRowBeforeFiscalYearMock,
    findHolidaysForFiscalYear: findHolidaysForFiscalYearMock,
    findEmployeeServiceDates: findEmployeeServiceDatesMock,
  })),
}));

jest.mock("../services/leave-domain.service", () => ({
  calculateLeaveQuotaStatus: calculateLeaveQuotaStatusMock,
}));

import {
  createLeaveManagement,
  calculateFiscalYear,
  getLeaveManagementQuotaStatus,
  upsertLeaveManagementExtension,
  replaceLeaveReturnReportEvents,
} from "../services/leave-management.service";

describe("leave-management service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("getLeaveManagementQuotaStatus returns all quotas with current leave highlighted", async () => {
    findLeaveManagementQuotaContextMock.mockResolvedValue({
      id: 10,
      citizen_id: "123",
      leave_type: "education",
      fiscal_year: 2569,
      duration_days: 30,
    });
    listLeaveManagementRowsForQuotaMock.mockResolvedValue([
      { id: 10, start_date: "2026-03-29", end_date: "2026-08-06", document_start_date: null, document_end_date: null },
    ]);
    findQuotaRowMock.mockResolvedValue({});
    findLatestQuotaRowBeforeFiscalYearMock.mockResolvedValue(null);
    findHolidaysForFiscalYearMock.mockResolvedValue([]);
    findEmployeeServiceDatesMock.mockResolvedValue(null);
    calculateLeaveQuotaStatusMock
      .mockReturnValueOnce({
        perType: {
          education: {
            limit: 60,
            used: 45,
            remaining: 15,
            overQuota: false,
            exceedDate: null,
          },
          vacation: {
            limit: 10,
            used: 2,
            remaining: 8,
            overQuota: false,
            exceedDate: null,
          },
        },
        perLeave: {},
      })
      .mockReturnValueOnce({
        perType: {
          education: {
            limit: 60,
            used: 0,
            remaining: 60,
            overQuota: false,
            exceedDate: null,
          },
          vacation: {
            limit: 10,
            used: 2,
            remaining: 8,
            overQuota: false,
            exceedDate: null,
          },
        },
        perLeave: {},
      });

    const result = await getLeaveManagementQuotaStatus(10);

    expect(calculateLeaveQuotaStatusMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual(
      expect.objectContaining({
        leave_id: 10,
        fiscal_year: 2569,
        as_of_date: expect.any(String),
        current_leave: expect.objectContaining({
          leave_type: "education",
          type_name: "ลาไปศึกษา ฝึกอบรม ดูงาน หรือปฏิบัติการวิจัย",
          duration: 30,
          leave_status: "upcoming",
          remaining_as_of_today: 60,
          remaining_after_leave: 15,
        }),
        quotas: expect.arrayContaining([
          expect.objectContaining({
            leave_type: "education",
            type_name: "ลาไปศึกษา ฝึกอบรม ดูงาน หรือปฏิบัติการวิจัย",
            limit: 60,
            used_as_of_today: 0,
            remaining_as_of_today: 60,
            used_after_leave: 45,
            remaining_after_leave: 15,
          }),
          expect.objectContaining({
            leave_type: "vacation",
            type_name: "ลาพักผ่อนประจำปี",
            limit: 10,
            used_as_of_today: 2,
            remaining_as_of_today: 8,
            used_after_leave: 2,
            remaining_after_leave: 8,
          }),
        ]),
      }),
    );
  });

  test("getLeaveManagementQuotaStatus returns latest known quota as reference when fiscal year quota is missing", async () => {
    findLeaveManagementQuotaContextMock.mockResolvedValue({
      id: 11,
      citizen_id: "123",
      leave_type: "vacation",
      fiscal_year: 2569,
      duration_days: 1,
    });
    listLeaveManagementRowsForQuotaMock.mockResolvedValue([
      { id: 11, start_date: "2025-12-11", end_date: "2025-12-11", document_start_date: null, document_end_date: null },
    ]);
    findQuotaRowMock.mockResolvedValue(null);
    findLatestQuotaRowBeforeFiscalYearMock.mockResolvedValue({
      fiscal_year: 2568,
      quota_vacation: 15,
    });
    findHolidaysForFiscalYearMock.mockResolvedValue([]);
    findEmployeeServiceDatesMock.mockResolvedValue(null);
    calculateLeaveQuotaStatusMock
      .mockReturnValueOnce({
        perType: {
          vacation: {
            limit: null,
            used: 1,
            remaining: null,
            overQuota: false,
            exceedDate: null,
          },
        },
        perLeave: {},
      })
      .mockReturnValueOnce({
        perType: {
          vacation: {
            limit: null,
            used: 0,
            remaining: null,
            overQuota: false,
            exceedDate: null,
          },
        },
        perLeave: {},
      });

    const result = await getLeaveManagementQuotaStatus(11);

    expect(result.current_leave).toEqual(
      expect.objectContaining({
        leave_type: "vacation",
        limit: null,
        has_quota_data: false,
        reference_fiscal_year: 2568,
        reference_limit: 15,
      }),
    );
    expect(result.quotas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          leave_type: "vacation",
          has_quota_data: false,
          reference_fiscal_year: 2568,
          reference_limit: 15,
        }),
      ]),
    );
  });

  test("createLeaveManagement keeps leave_type ordain as provided", async () => {
    await createLeaveManagement({
      citizen_id: "123",
      leave_type: "ordain",
      start_date: "2024-10-01",
      end_date: "2024-10-03",
    });

    expect(insertLeaveManagementMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ leave_type: "ordain" }),
    );
  });

  test("calculateFiscalYear uses Thai fiscal year based on start_date", () => {
    expect(calculateFiscalYear("2024-09-30")).toBe(2567);
    expect(calculateFiscalYear("2024-10-01")).toBe(2568);
  });

  test("createLeaveManagement calculates duration and fiscal year", async () => {
    const id = await createLeaveManagement({
      citizen_id: "123",
      leave_type: "personal",
      start_date: "2024-10-01",
      end_date: "2024-10-03",
    });
    expect(id).toBe(99);
  });

  test("upsertLeaveManagementExtension keeps pending status when return events resume study", async () => {
    await upsertLeaveManagementExtension(
      {
        leave_management_id: 10,
        require_return_report: true,
        return_report_events: [
          { report_date: "2026-03-07", resume_date: "2026-03-17", resume_study_program: "A" },
          { report_date: "2026-01-31", resume_date: "2026-02-15", resume_study_program: "B" },
        ],
      },
      7,
    );

    expect(upsertExtensionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        leave_management_id: 10,
        return_report_status: "PENDING",
        return_date: undefined,
      }),
    );
    expect(replaceLeaveReturnReportEventsMock).toHaveBeenCalledWith(
      10,
      [
        { report_date: "2026-03-07", resume_date: "2026-03-17", resume_study_program: "A" },
        { report_date: "2026-01-31", resume_date: "2026-02-15", resume_study_program: "B" },
      ],
      7,
    );
  });

  test("upsertLeaveManagementExtension accepts leave_record_id alias", async () => {
    await upsertLeaveManagementExtension(
      {
        leave_record_id: 55,
        require_return_report: true,
      } as any,
      5,
    );

    expect(upsertExtensionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        leave_management_id: 55,
      }),
    );
  });

  test("replaceLeaveReturnReportEvents syncs compat fields from events", async () => {
    await replaceLeaveReturnReportEvents(
      10,
      {
        events: [
          { report_date: "2026-01-31", resume_date: "2026-02-15", resume_study_program: "B" },
          { report_date: "2026-03-07", resume_date: "2026-03-17", resume_study_program: "A" },
        ],
      },
      9,
    );

    expect(replaceLeaveReturnReportEventsMock).toHaveBeenCalledWith(
      10,
      [
        { report_date: "2026-01-31", resume_date: "2026-02-15", resume_study_program: "B" },
        { report_date: "2026-03-07", resume_date: "2026-03-17", resume_study_program: "A" },
      ],
      9,
    );
    expect(upsertLegacyReturnReportCompatMock).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        require_return_report: 1,
        return_report_status: "PENDING",
        return_date: null,
      }),
    );
  });

  test("replaceLeaveReturnReportEvents accepts report_date-only final return report", async () => {
    await replaceLeaveReturnReportEvents(
      10,
      {
        events: [{ report_date: "2026-04-22" }],
      },
      9,
    );

    expect(replaceLeaveReturnReportEventsMock).toHaveBeenCalledWith(
      10,
      [
        {
          report_date: "2026-04-22",
          resume_date: null,
          resume_study_program: null,
        },
      ],
      9,
    );
    expect(upsertLegacyReturnReportCompatMock).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        require_return_report: 1,
        return_report_status: "DONE",
        return_date: "2026-04-22",
      }),
    );
  });

  test("upsertLeaveManagementExtension keeps pending status when latest event resumes study", async () => {
    await upsertLeaveManagementExtension(
      {
        leave_management_id: 10,
        require_return_report: true,
        return_report_events: [
          { report_date: "2026-01-31" },
          { report_date: "2026-03-02", resume_date: "2026-03-03", resume_study_program: "A" },
        ],
      },
      7,
    );

    expect(upsertExtensionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        leave_management_id: 10,
        return_report_status: "PENDING",
        return_date: undefined,
      }),
    );
  });

  test("replaceLeaveReturnReportEvents marks DONE only when latest event is final return", async () => {
    await replaceLeaveReturnReportEvents(
      10,
      {
        events: [
          { report_date: "2026-01-31", resume_date: "2026-02-15", resume_study_program: "B" },
          { report_date: "2026-04-22" },
        ],
      },
      9,
    );

    expect(upsertLegacyReturnReportCompatMock).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        require_return_report: 1,
        return_report_status: "DONE",
        return_date: "2026-04-22",
      }),
    );
  });
});
