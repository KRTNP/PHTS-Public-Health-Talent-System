import {
  buildEligibilityLicenseStatusWhere,
  buildLatestLicenseJoinSql,
} from "@/modules/request/data/repositories/eligibility-license.js";

describe("eligibility license query helpers", () => {
  test("buildLatestLicenseJoinSql selects latest license fields", () => {
    const sql = buildLatestLicenseJoinSql();

    expect(sql).toContain("latest_license_status");
    expect(sql).toContain("latest_license_valid_until");
    expect(sql).toContain("ROW_NUMBER()");
    expect(sql).toContain("lic ON lic.citizen_id = e.citizen_id");
  });

  test("expired filter treats missing or invalid latest license as expired", () => {
    const result = buildEligibilityLicenseStatusWhere("expired", 90);

    expect(result.params).toEqual([]);
    expect(result.clause).toContain("lic.citizen_id IS NULL");
    expect(result.clause).toContain("UPPER(lic.latest_license_status) <> 'ACTIVE'");
    expect(result.clause).toContain("lic.latest_license_valid_until < DATE(NOW())");
  });

  test("active filter requires real active latest license beyond expiring window", () => {
    const result = buildEligibilityLicenseStatusWhere("active", 90);

    expect(result.params).toEqual([90]);
    expect(result.clause).toContain("lic.citizen_id IS NOT NULL");
    expect(result.clause).toContain("UPPER(lic.latest_license_status) = 'ACTIVE'");
    expect(result.clause).toContain("lic.latest_license_valid_until > DATE_ADD(DATE(NOW()), INTERVAL ? DAY)");
  });
});
