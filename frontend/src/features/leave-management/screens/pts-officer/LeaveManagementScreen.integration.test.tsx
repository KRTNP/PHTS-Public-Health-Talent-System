import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { LeaveManagementScreen } from "./LeaveManagementScreen"
import type { LeaveRecordApiRow, LeaveReturnReportEvent } from "@/features/leave-management/core/api"

const state = vi.hoisted(() => {
  const initialRow: LeaveRecordApiRow = {
    id: 1,
    citizen_id: "1234567890123",
    leave_type: "education",
    start_date: "2026-01-01",
    end_date: "2026-03-31",
    first_name: "สมชาย",
    last_name: "ตัวอย่าง",
    position_name: "นายแพทย์",
    department: "อายุรกรรม",
    require_return_report: 1,
    return_date: null,
    document_start_date: "2026-01-01",
    document_end_date: "2026-03-31",
    note: null,
  }

  return {
    leaveRows: [initialRow] as LeaveRecordApiRow[],
    returnEvents: [] as LeaveReturnReportEvent[],
    upsertCalls: [] as Array<Record<string, unknown>>,
  }
})

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("tab=pending-report"),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/pts-officer/leave-management",
}))

vi.mock("@/features/leave-management/core/hooks", () => {
  return {
    useLeaveRecords: () => ({
      data: { items: state.leaveRows, total: state.leaveRows.length },
      refetch: vi.fn(async () => undefined),
      isLoading: false,
      isError: false,
    }),
    useLeavePersonnel: () => ({ data: [] }),
    useLeaveRecordStats: () => ({ data: undefined }),
    useLeaveRecordDocuments: () => ({ data: [], refetch: vi.fn(async () => undefined) }),
    useLeaveReturnReportEvents: () => ({ data: state.returnEvents }),
    useLeaveQuotaStatus: () => ({ data: null }),
    useReplaceLeaveReturnReportEvents: () => ({
      mutateAsync: vi.fn(async ({ events }: { events: LeaveReturnReportEvent[] }) => {
        state.returnEvents = events
      }),
    }),
    useUpsertLeaveRecordExtension: () => ({
      mutateAsync: vi.fn(async (payload: { return_date?: string; return_report_status?: string }) => {
        state.upsertCalls.push(payload as Record<string, unknown>)
        state.leaveRows = state.leaveRows.map((row) =>
          row.id === 1
            ? {
                ...row,
                return_date: payload.return_date ?? null,
                return_report_status: payload.return_report_status ?? null,
              }
            : row,
        )
      }),
    }),
    useCreateLeaveRecord: () => ({ mutateAsync: vi.fn(async () => ({ id: 1 })) }),
    useDeleteLeaveRecordExtension: () => ({ mutateAsync: vi.fn(async () => undefined) }),
    useAddLeaveRecordDocuments: () => ({ mutateAsync: vi.fn(async () => undefined) }),
    useDeleteLeaveRecordDocument: () => ({ mutateAsync: vi.fn(async () => undefined) }),
  }
})

vi.mock("./hooks/useLeaveManagementDialogs", () => {
  return {
    useLeaveManagementDialogs: () => ({
      showAddDialog: false,
      showEditDialog: false,
      showDetailDialog: false,
      showReportDialog: false,
      showDeleteAlert: false,
      showSuccessDialog: false,
      successMessage: "",
      selectedLeave: {
        id: 1,
        source: "hrms",
        personId: "1234567890123",
        personName: "สมชาย ตัวอย่าง",
        personPosition: "นายแพทย์",
        personDepartment: "อายุรกรรม",
        type: "education",
        typeName: "ลาศึกษาต่อ/อบรม",
        userStartDate: "2026-01-01",
        userEndDate: "2026-03-31",
        days: 90,
        requireReport: true,
        reportStatus: state.leaveRows[0]?.return_date ? "reported" : "pending",
        createdAt: "2026-01-01",
      },
      editingReturnEventId: null,
      previewOpen: false,
      previewUrl: "",
      previewName: "",
      setShowAddDialog: vi.fn(),
      setShowEditDialog: vi.fn(),
      setShowDetailDialog: vi.fn(),
      setShowReportDialog: vi.fn(),
      setShowDeleteAlert: vi.fn(),
      setShowSuccessDialog: vi.fn(),
      setEditingReturnEventId: vi.fn(),
      setPreviewOpen: vi.fn(),
      openAddDialog: vi.fn(),
      closeAddDialog: vi.fn(),
      openEditDialog: vi.fn(),
      closeEditDialog: vi.fn(),
      openDetailDialog: vi.fn(),
      closeDetailDialog: vi.fn(),
      openDeleteAlert: vi.fn(),
      closeDeleteAlert: vi.fn(),
      openReportDialog: vi.fn(),
      closeReportDialog: vi.fn(),
      openEditReturnEventDialog: vi.fn(),
      openEditFromDetailDialog: vi.fn(),
      openPreview: vi.fn(),
      clearSelection: vi.fn(),
      showSuccess: vi.fn(),
      closeSuccessDialog: vi.fn(),
    }),
  }
})

vi.mock("./components/AllLeavesTab", () => ({
  AllLeavesTab: () => <div data-testid="all-tab" />,
}))

vi.mock("./components/StudyLeavesTab", () => ({
  StudyLeavesTab: () => <div data-testid="study-tab" />,
}))

vi.mock("./components/PendingReportTab", () => ({
  PendingReportTab: ({ records }: { records: unknown[] }) => (
    <div data-testid="pending-count">pending:{records.length}</div>
  ),
}))

vi.mock("./components/LeaveManagementDialogs", () => ({
  LeaveManagementDialogs: ({
    onRecordReport,
    onDeleteReturnEvent,
  }: {
    onRecordReport: (payload: {
      reportDate: string
      note: string
      resumeDate?: string
      resumeStudyProgram?: string
    }) => Promise<void>
    onDeleteReturnEvent: (eventId?: number) => void
  }) => (
    <div>
      <button
        type="button"
        data-testid="record-report"
        onClick={() => {
          void onRecordReport({ reportDate: "2026-02-01", note: "mock" })
        }}
      >
        record-report
      </button>
      <button
        type="button"
        data-testid="delete-report-event"
        onClick={() => onDeleteReturnEvent(1)}
      >
        delete-report-event
      </button>
    </div>
  ),
}))

describe("LeaveManagementScreen integration", () => {
  beforeEach(() => {
    state.leaveRows = [
      {
        id: 1,
        citizen_id: "1234567890123",
        leave_type: "education",
        start_date: "2026-01-01",
        end_date: "2026-03-31",
        first_name: "สมชาย",
        last_name: "ตัวอย่าง",
        position_name: "นายแพทย์",
        department: "อายุรกรรม",
        require_return_report: 1,
        return_date: null,
        return_report_status: "PENDING",
      },
    ]
    state.returnEvents = []
    state.upsertCalls = []
    vi.clearAllMocks()
  })

  it("records return report then pending list becomes empty", async () => {
    const view = render(<LeaveManagementScreen />)
    expect(screen.getByTestId("pending-count").textContent).toBe("pending:1")

    fireEvent.click(screen.getByTestId("record-report"))

    await waitFor(() => {
      expect(state.upsertCalls.length).toBeGreaterThan(0)
    })

    view.rerender(<LeaveManagementScreen />)

    expect(screen.getByTestId("pending-count").textContent).toBe("pending:0")
    expect(state.upsertCalls.at(-1)?.return_report_status).toBe("DONE")
    expect(state.upsertCalls.at(-1)?.return_date).toBe("2026-02-01")
  })

  it("deletes last return report event then record returns to pending list", async () => {
    state.returnEvents = [{ event_id: 1, report_date: "2026-02-01" }]
    state.leaveRows = state.leaveRows.map((row) => ({
      ...row,
      return_date: "2026-02-01",
      return_report_status: "DONE",
    }))

    const view = render(<LeaveManagementScreen />)
    expect(screen.getByTestId("pending-count").textContent).toBe("pending:0")

    fireEvent.click(screen.getByTestId("delete-report-event"))

    await waitFor(() => {
      expect(state.upsertCalls.length).toBeGreaterThan(0)
    })

    view.rerender(<LeaveManagementScreen />)

    expect(screen.getByTestId("pending-count").textContent).toBe("pending:1")
    expect(state.upsertCalls.at(-1)?.return_report_status).toBe("PENDING")
    expect(state.upsertCalls.at(-1)?.return_date).toBeUndefined()
  })
})
