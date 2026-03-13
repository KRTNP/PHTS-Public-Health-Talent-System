import { describe, expect, test } from "@jest/globals";
import { calculateBusinessDaysSchema } from "@/modules/sla/sla.schema.js";

describe("sla schema", () => {
  test("calculateBusinessDaysSchema rejects impossible calendar date", () => {
    expect(() =>
      calculateBusinessDaysSchema.parse({
        query: {
          start: "2026-02-31",
          end: "2026-03-01",
        },
      }),
    ).toThrow();
  });

  test("calculateBusinessDaysSchema accepts valid date range", () => {
    const parsed = calculateBusinessDaysSchema.parse({
      query: {
        start: "2026-03-01",
        end: "2026-03-10",
      },
    });

    expect(parsed.query.start).toBe("2026-03-01");
    expect(parsed.query.end).toBe("2026-03-10");
  });
});
