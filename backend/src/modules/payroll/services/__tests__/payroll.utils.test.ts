import {
  isPeriodLocked,
  normalizeProfessionCodeForReview,
} from "@/modules/payroll/services/shared/payroll.utils.js";

describe("payroll.utils", () => {
  describe("normalizeProfessionCodeForReview", () => {
    it("maps DOCTOR to PHYSICIAN", () => {
      expect(normalizeProfessionCodeForReview("doctor")).toBe("PHYSICIAN");
    });

    it("returns uppercase raw code when map does not exist", () => {
      expect(normalizeProfessionCodeForReview("lab_tech")).toBe("LAB_TECH");
    });

    it("returns empty string when input is blank", () => {
      expect(normalizeProfessionCodeForReview("   ")).toBe("");
    });
  });

  describe("isPeriodLocked", () => {
    it("uses is_locked only", () => {
      expect(isPeriodLocked({ is_locked: 1 })).toBe(true);
      expect(isPeriodLocked({ is_locked: 0 })).toBe(false);
    });

    it("returns false when is_locked is not present", () => {
      expect(isPeriodLocked({})).toBe(false);
    });
  });
});
