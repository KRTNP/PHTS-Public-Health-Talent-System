import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Step3Attachments } from "./step-3-attachments";
import type { RequestFormData } from "@/types/request.types";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

const baseData: RequestFormData = {
  requestType: "NEW",
  title: "",
  firstName: "",
  lastName: "",
  citizenId: "",
  employeeType: "CIVIL_SERVANT",
  positionName: "",
  positionNumber: "",
  department: "",
  subDepartment: "",
  employmentRegion: "REGIONAL",
  effectiveDate: "",
  missionGroup: "",
  workAttributes: {
    operation: true,
    planning: true,
    coordination: true,
    service: true,
  },
  files: [],
  rateMapping: {
    groupId: "",
    itemId: "",
    amount: 0,
  },
  attachments: [
    {
      attachment_id: 1,
      file_name: "page-5-6.pdf",
      file_path: "uploads/test/page-5-6.pdf",
      file_type: "OTHER",
      file_size: 1024,
    },
  ],
};

describe("Step3Attachments", () => {
  it("shows existing server attachments inside the selected files section", () => {
    render(
      <Step3Attachments
        data={baseData}
        onUpload={() => undefined}
        onRemove={() => undefined}
        showExistingAttachments
        ocrPrecheck={{
          request_id: 1,
          status: "completed",
          results: [
            {
              name: "page-5-6.pdf",
              ok: true,
              markdown: "บันทึกข้อความ",
              document_kind: "memo",
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("ไฟล์แนบ (1)")).toBeInTheDocument();
    expect(screen.queryByText("ไฟล์เดิมในระบบ (1)")).not.toBeInTheDocument();
    expect(screen.getByText("page-5-6.pdf")).toBeInTheDocument();
    expect(screen.getByText("หนังสือนำส่ง")).toBeInTheDocument();
  });
});
