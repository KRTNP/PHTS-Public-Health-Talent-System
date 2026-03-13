import { describe, expect, test } from "@jest/globals";

import { supportTicketMessageSchema } from "../support.schema";

describe("support schema", () => {
  test("supportTicketMessageSchema accepts multipart replies without message text", () => {
    const parsed = supportTicketMessageSchema.parse({
      params: { ticketId: "11" },
      body: {},
    });

    expect(parsed.params.ticketId).toBe("11");
    expect(parsed.body.message).toBeUndefined();
  });

  test("supportTicketMessageSchema trims provided message text", () => {
    const parsed = supportTicketMessageSchema.parse({
      params: { ticketId: "11" },
      body: { message: " hello " },
    });

    expect(parsed.body.message).toBe("hello");
  });
});
