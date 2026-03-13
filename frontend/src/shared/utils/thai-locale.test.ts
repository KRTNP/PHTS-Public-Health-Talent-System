import { describe, expect, test } from "vitest";
import { formatBuddhistDateForFilename, formatThaiDate } from "@/shared/utils/thai-locale";

describe("thai-locale date utils", () => {
  test("formatBuddhistDateForFilename should keep Bangkok calendar date", () => {
    expect(formatBuddhistDateForFilename("2025-01-01T00:30:00+07:00")).toBe("2568-01-01");
  });

  test("formatThaiDate should still render valid Thai date", () => {
    expect(formatThaiDate("2025-01-01")).toContain("2568");
  });
});
