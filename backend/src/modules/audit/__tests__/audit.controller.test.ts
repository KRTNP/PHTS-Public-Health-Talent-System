import { describe, expect, jest, test } from "@jest/globals";
import { ValidationError } from "@/shared/utils/errors.js";

jest.mock("@/modules/audit/services/audit.service.js", () => ({
  getEntityAuditTrail: jest.fn(),
  searchAuditEvents: jest.fn(),
  getAuditSummary: jest.fn(),
  getAuditEventsForExport: jest.fn(),
  emitAuditEventWithRequest: jest.fn(),
  AuditEventType: { DATA_EXPORT: "DATA_EXPORT" },
}));

import { getEntityAuditTrail } from "@/modules/audit/audit.controller.js";

describe("audit controller", () => {
  test("getEntityAuditTrail forwards ValidationError when params missing", async () => {
    const req: any = { params: { entityType: "", entityId: "" } };
    const res: any = { json: jest.fn() };
    const next = jest.fn();

    await getEntityAuditTrail(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
  });
});
