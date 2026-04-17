import { describe, expect, test } from "@jest/globals";
import {
  maskIdentifierForLogs,
  sanitizeUrlForLogs,
} from "@/shared/utils/log-sanitizer.js";

describe("log sanitizer", () => {
  test("redacts credential query values", () => {
    const sanitized = sanitizeUrlForLogs(
      "/login?citizenId=1539900027713&password=secret-123&token=abc",
    );
    expect(sanitized).toBe(
      "/login?citizenId=*********7713&password=%5BREDACTED%5D&token=%5BREDACTED%5D",
    );
  });

  test("keeps safe query values unchanged", () => {
    const sanitized = sanitizeUrlForLogs("/api/reports?month=4&year=2026");
    expect(sanitized).toBe("/api/reports?month=4&year=2026");
  });

  test("masks identifiers for logs", () => {
    expect(maskIdentifierForLogs("1539900027713")).toBe("*********7713");
  });
});
