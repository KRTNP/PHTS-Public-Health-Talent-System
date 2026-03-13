import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Step4RateMapping } from "./step-4-rate-mapping";
import type { RequestFormData } from "@/types/request.types";

vi.mock("@/features/master-data/hooks", () => ({
  useRateHierarchy: () => ({
    data: [
      {
        id: "PHARMACIST",
        name: "เภสัชกร",
        groups: [
          {
            id: "group1",
            name: "กลุ่มที่ 1",
            rate: 1500,
            criteria: [
              {
                id: "1.1",
                label: "ปฏิบัติหน้าที่หลักของตำแหน่งตามมาตรฐานกำหนดตำแหน่ง",
              },
            ],
          },
          {
            id: "group2",
            name: "กลุ่มที่ 2",
            rate: 3000,
            criteria: [
              {
                id: "2.1",
                label: "งานเตรียมหรือผลิตยาเคมีบำบัด",
              },
            ],
          },
        ],
      },
    ],
    isLoading: false,
  }),
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
  effectiveDate: "2026-03-12",
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
    professionCode: "PHARMACIST",
  },
  professionCode: "PHARMACIST",
};

describe("Step4RateMapping OCR mapping", () => {
  it("maps assignment-order OCR text to matching higher pharmacist group", async () => {
    const updateData = vi.fn();

    render(
      <Step4RateMapping
        data={baseData}
        updateData={updateData}
        ocrPrecheck={{
          request_id: 37,
          status: "completed",
          results: [
            {
              name: "page-5-6.pdf",
              ok: true,
              document_kind: "assignment_order",
              fields: {
                duties:
                  "งานเตรียมหรือผลิตยาเคมีบำบัด และการบริบาลเภสัชกรรมผู้ป่วย",
              },
            },
          ],
        }}
      />,
    );

    await waitFor(() => {
      expect(updateData).toHaveBeenCalledWith(
        "rateMapping",
        expect.objectContaining({
          groupId: "group2",
          itemId: "2.1",
          amount: 3000,
        }),
      );
    });
  });

  it("uses explicit OCR group/item when provided", async () => {
    const updateData = vi.fn();

    render(
      <Step4RateMapping
        data={baseData}
        updateData={updateData}
        ocrPrecheck={{
          request_id: 37,
          status: "completed",
          results: [
            {
              name: "page-5-6.pdf",
              ok: true,
              document_kind: "assignment_order",
              fields: {
                group_no: 1,
                item_no: "1.1",
              },
            },
          ],
        }}
      />,
    );

    await waitFor(() => {
      expect(updateData).toHaveBeenCalledWith(
        "rateMapping",
        expect.objectContaining({
          groupId: "group1",
          itemId: "1.1",
          amount: 1500,
        }),
      );
    });
  });

  it("auto-selects criteria when OCR arrives after group is already selected", async () => {
    const updateData = vi.fn();
    const { rerender } = render(
      <Step4RateMapping
        data={{
          ...baseData,
          rateMapping: {
            ...baseData.rateMapping,
            groupId: "group2",
            amount: 3000,
          },
        }}
        updateData={updateData}
        ocrPrecheck={{
          request_id: 37,
          status: "processing",
          results: [],
        }}
      />,
    );

    rerender(
      <Step4RateMapping
        data={{
          ...baseData,
          rateMapping: {
            ...baseData.rateMapping,
            groupId: "group2",
            amount: 3000,
          },
        }}
        updateData={updateData}
        ocrPrecheck={{
          request_id: 37,
          status: "completed",
          results: [
            {
              name: "page-5-6.pdf",
              ok: true,
              document_kind: "assignment_order",
              fields: {
                duties:
                  "งานเตรียมหรือผลิตยาเคมีบำบัด และการบริบาลเภสัชกรรมผู้ป่วย",
              },
            },
          ],
        }}
      />,
    );

    await waitFor(() => {
      expect(updateData).toHaveBeenCalledWith(
        "rateMapping",
        expect.objectContaining({
          groupId: "group2",
          itemId: "2.1",
          amount: 3000,
        }),
      );
    });
  });
});
