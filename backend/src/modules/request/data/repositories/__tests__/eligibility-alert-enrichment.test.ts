import {
  buildActiveEligibilityCountJoinSql,
  buildUpcomingPersonnelChangeJoinSql,
} from "@/modules/request/data/repositories/eligibility-alert-enrichment.js";

describe("eligibility alert enrichment sql", () => {
  it("joins active eligibility counts per citizen", () => {
    const sql = buildActiveEligibilityCountJoinSql();

    expect(sql).toContain("active_eligibility_count");
    expect(sql).toContain("FROM req_eligibility");
    expect(sql).toContain("WHERE is_active = 1");
  });

  it("joins the nearest upcoming personnel change", () => {
    const sql = buildUpcomingPersonnelChangeJoinSql(90);

    expect(sql).toContain("upcoming_change_type");
    expect(sql).toContain("upcoming_change_effective_date");
    expect(sql).toContain("FROM emp_retirements");
    expect(sql).toContain("FROM emp_movements");
    expect(sql).toContain("INTERVAL 90 DAY");
    expect(sql).toContain("COLLATE utf8mb4_unicode_ci");
    expect(sql).toContain("CAST(citizen_id AS CHAR CHARACTER SET utf8mb4)");
  });
});
