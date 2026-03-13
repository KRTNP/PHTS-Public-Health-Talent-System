import { buildEligibilityAlertWhere } from "@/modules/request/data/repositories/eligibility-alert-filter.js";

describe("buildEligibilityAlertWhere", () => {
  it("builds the critical alert filter without expiring warning logic", () => {
    const result = buildEligibilityAlertWhere("error", 90);

    expect(result.clause).toContain("lic.citizen_id IS NULL");
    expect(result.clause).toContain("UPPER(lic.latest_license_status) <> 'ACTIVE'");
    expect(result.clause).toContain("lic.latest_license_valid_until < DATE(NOW())");
    expect(result.clause).toContain("COALESCE(elig_dup.active_eligibility_count, 0) > 1");
    expect(result.params).toEqual([]);
  });

  it("builds the any-alert filter with expiring days parameter", () => {
    const result = buildEligibilityAlertWhere("any", 90);

    expect(result.clause).toContain("DATE_ADD(DATE(NOW()), INTERVAL ? DAY)");
    expect(result.clause).toContain("upcoming_change.upcoming_change_type IS NOT NULL");
    expect(result.params).toEqual([90]);
  });

  it("returns no clause when no alert filter is requested", () => {
    expect(buildEligibilityAlertWhere(null, 90)).toEqual({ clause: "", params: [] });
  });
});
