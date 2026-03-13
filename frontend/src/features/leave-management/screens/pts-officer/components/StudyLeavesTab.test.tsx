import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { StudyLeavesTab } from "./StudyLeavesTab"
import type { LeaveRecord } from "@/features/leave-management/core/types"
import { Tabs } from "@/components/ui/tabs"
import type { ReactNode } from "react"

const baseRecord: LeaveRecord = {
  id: 1,
  source: "hrms",
  personId: "123",
  personName: "นายแพทย์ ตัวอย่าง",
  personPosition: "แพทย์",
  personDepartment: "อายุรกรรม",
  type: "education",
  typeName: "ลาศึกษาต่อ/อบรม",
  userStartDate: "2026-01-01",
  userEndDate: "2026-01-10",
  days: 10,
  requireReport: true,
  reportStatus: "pending",
  createdAt: "2026-01-01",
}

describe("StudyLeavesTab", () => {
  const renderWithTabs = (node: ReactNode) => {
    return render(<Tabs value="study">{node}</Tabs>)
  }

  it("shows loading state", () => {
    const { container } = renderWithTabs(
      <StudyLeavesTab
        records={[]}
        formatDateDisplay={(d) => d}
        onViewDetail={vi.fn()}
        onEdit={vi.fn()}
        isLoading
        isError={false}
        onRetry={vi.fn()}
      />,
    )

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0)
  })

  it("shows error state", () => {
    renderWithTabs(
      <StudyLeavesTab
        records={[]}
        formatDateDisplay={(d) => d}
        onViewDetail={vi.fn()}
        onEdit={vi.fn()}
        isLoading={false}
        isError
        onRetry={vi.fn()}
      />,
    )

    expect(screen.getByText("ไม่สามารถโหลดข้อมูลได้")).toBeInTheDocument()
  })

  it("shows empty state", () => {
    renderWithTabs(
      <StudyLeavesTab
        records={[]}
        formatDateDisplay={(d) => d}
        onViewDetail={vi.fn()}
        onEdit={vi.fn()}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
      />,
    )

    expect(screen.getByText("ไม่พบรายการลาศึกษาต่อหรืออบรม")).toBeInTheDocument()
  })

  it("renders records when available", () => {
    renderWithTabs(
      <StudyLeavesTab
        records={[baseRecord]}
        formatDateDisplay={(d) => d}
        onViewDetail={vi.fn()}
        onEdit={vi.fn()}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
      />,
    )

    expect(screen.getByText("นายแพทย์ ตัวอย่าง")).toBeInTheDocument()
  })
})
