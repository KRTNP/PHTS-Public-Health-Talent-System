import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { usePayrollDetailViewModel } from "./usePayrollDetailViewModel"
import { payoutsFixture, periodDetailFixture } from "./test-fixtures"

describe("usePayrollDetailViewModel", () => {
  it("derives and filters rows with default sort and issue filter", () => {
    const onAvailableProfessionsChange = vi.fn()
    const { result } = renderHook(() =>
      usePayrollDetailViewModel({
        selectedProfession: "all",
        periodDetail: periodDetailFixture,
        payoutsData: payoutsFixture,
        rateHierarchyData: [],
        reviewedProfessionCodes: ["NURSE"],
        onSubmitForReview: async () => undefined,
        onAvailableProfessionsChange,
      }),
    )

    expect(result.current.sortedPersons.map((row) => row.id)).toEqual([11, 10])
    expect(result.current.availableGroups).toEqual(["1", "2"])
    expect(result.current.canSubmitReview).toBe(false)
    expect(result.current.sortedPersons[1]).toEqual(
      expect.objectContaining({
        leaveCountInPeriod: 2,
        educationLeaveCountInPeriod: 1,
      }),
    )

    act(() => {
      result.current.setIssueFilter("blocker")
    })
    expect(result.current.sortedPersons.map((row) => row.id)).toEqual([10])
  })

  it("calls onAvailableProfessionsChange with normalized profession cards", () => {
    const onAvailableProfessionsChange = vi.fn()
    renderHook(() =>
      usePayrollDetailViewModel({
        selectedProfession: "all",
        periodDetail: periodDetailFixture,
        payoutsData: payoutsFixture,
        rateHierarchyData: [],
        reviewedProfessionCodes: [],
        onAvailableProfessionsChange,
      }),
    )

    expect(onAvailableProfessionsChange).toHaveBeenCalledTimes(1)
    const firstCallArg = onAvailableProfessionsChange.mock.calls[0]?.[0]
    expect(firstCallArg).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "NURSE" }),
        expect.objectContaining({ code: "PHYSICIAN" }),
      ]),
    )
  })

  it("flags deduction issue when full-month payout is lower than base rate without leave days", () => {
    const { result } = renderHook(() =>
      usePayrollDetailViewModel({
        selectedProfession: "all",
        periodDetail: periodDetailFixture,
        payoutsData: [
          {
            payout_id: 99,
            citizen_id: "8571076019723",
            profession_code: "NURSE",
            first_name: "Achiraya",
            last_name: "Yahola",
            department: "Dept X",
            group_no: 2,
            item_no: "1",
            sub_item_no: "1",
            rate: 1500,
            total_payable: 1250,
            retroactive_amount: 0,
            deducted_days: 0,
            check_count: 0,
            blocker_count: 0,
            warning_count: 0,
          },
        ],
        rateHierarchyData: [],
        reviewedProfessionCodes: [],
        onAvailableProfessionsChange: vi.fn(),
      }),
    )

    expect(result.current.sortedPersons).toHaveLength(1)
    expect(result.current.sortedPersons[0].issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: "HAS_DEDUCTION" })]),
    )
  })
})
