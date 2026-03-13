import {
  resolveClosestImportedCandidate,
  type PayrollImportMatchCandidate,
} from "@/modules/payroll/services/import/payroll-import-match.js";

const makeCandidate = (
  citizenId: string,
  firstName: string,
  lastName: string,
): PayrollImportMatchCandidate => ({
  citizen_id: citizenId,
  user_id: null,
  first_name: firstName,
  last_name: lastName,
  position_name: "พยาบาลวิชาชีพ",
  department: null,
});

describe("payroll import matching", () => {
  it("matches obvious spelling variants safely", () => {
    expect(
      resolveClosestImportedCandidate(
        { firstName: "กรรณภัทร", lastName: "สุขขีวิโน" },
        [makeCandidate("1", "กรรณภัทร", "สุขชีวิโน")],
      )?.citizen_id,
    ).toBe("1");

    expect(
      resolveClosestImportedCandidate(
        { firstName: "สุกัญญา", lastName: "รังสรรค์" },
        [makeCandidate("2", "สุกัญญา", "รังสรร")],
      )?.citizen_id,
    ).toBe("2");

    expect(
      resolveClosestImportedCandidate(
        { firstName: "ปภาวี", lastName: "วงศ์สวัสดิ์" },
        [makeCandidate("3", "ปภาวี", "วงค์สวัสดิ์")],
      )?.citizen_id,
    ).toBe("3");

    expect(
      resolveClosestImportedCandidate(
        { firstName: "สุรีรัตน์", lastName: "โกฏแสง" },
        [makeCandidate("4", "สุรีรัตน์", "โกฎแสง")],
      )?.citizen_id,
    ).toBe("4");

    expect(
      resolveClosestImportedCandidate(
        { firstName: "ทัศภรณ์", lastName: "สันติ" },
        [makeCandidate("5", "ทัศนภรณ์", "สันติ")],
      )?.citizen_id,
    ).toBe("5");
  });

  it("does not guess when no close match is strong enough", () => {
    expect(
      resolveClosestImportedCandidate(
        { firstName: "ณัฏฐพร", lastName: "มีบุญอนันต์" },
        [
          makeCandidate("1", "ณัฏฐพร", "โพธิ์ด้วง"),
          makeCandidate("2", "สุภาพร", "แก้วอนันต์"),
        ],
      ),
    ).toBeNull();
  });

  it("does not guess when two candidates are too close", () => {
    expect(
      resolveClosestImportedCandidate(
        { firstName: "ขนิษฐา", lastName: "ทองแห้ว" },
        [
          makeCandidate("1", "ขนิษฐา", "ศรีทอง"),
          makeCandidate("2", "นภัสรัญ", "ทองแห้ว"),
        ],
      ),
    ).toBeNull();
  });
});
