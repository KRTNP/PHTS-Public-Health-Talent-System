import {
  buildEligibilityCsv,
} from "@/modules/request/api/helpers/eligibility-csv.helper.js";

describe("buildEligibilityCsv", () => {
  test("neutralizes Excel formulas in exported cells", () => {
    const csv = buildEligibilityCsv([
      {
        eligibility_id: 1,
        request_no: "REQ-1",
        title: "",
        first_name: "=1+1",
        last_name: "Danger",
        profession_code: "PHARMACIST",
        position_name: "@cmd",
        department: "-finance",
        sub_department: "+ops",
        group_no: 1,
        item_no: null,
        sub_item_no: null,
        rate_amount: "1500.00",
        effective_date: "2026-04-12",
        expiry_date: null,
      },
    ]);

    expect(csv).toContain("'=1+1 Danger");
    expect(csv).toContain(",'@cmd,");
    expect(csv).toContain(",'-finance,");
    expect(csv).toContain(",'+ops,");
  });
});
