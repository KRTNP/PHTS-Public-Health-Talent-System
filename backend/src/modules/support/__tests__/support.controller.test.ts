import { describe, expect, jest, test } from "@jest/globals";

import * as supportController from "../support.controller";
import { SupportService } from "../services/support.service";

jest.mock("../services/support.service", () => ({
  SupportService: {
    getTicket: jest.fn(),
    createMessage: jest.fn(),
  },
}));

describe("supportController.createMessage", () => {
  test("rejects replies with neither message text nor attachments", async () => {
    const req: any = {
      params: { ticketId: "11" },
      body: {},
      files: {},
      user: { userId: 7, role: "USER" },
    };
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    (SupportService.getTicket as jest.Mock).mockResolvedValue({
      ticket_id: 11,
      user_id: 7,
      status: "OPEN",
    });

    await supportController.createMessage(req, res, next);

    expect(SupportService.createMessage).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "ValidationError",
        message: "Please add a message or attachment",
      }),
    );
  });
});
