import { describe, expect, test, jest } from "@jest/globals";
import { errorHandler } from "@middlewares/errorHandler.js";

describe("error handler", () => {
  test("maps malformed JSON parser errors to a structured 400 response", () => {
    const error = Object.assign(new SyntaxError("Unexpected token"), {
      status: 400,
      type: "entity.parse.failed",
      body: "{bad",
    });
    const req: any = {
      method: "POST",
      originalUrl: "/api/auth/login",
      requestId: "test-request",
    };
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    errorHandler(error, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "รูปแบบ JSON ไม่ถูกต้อง",
      },
    });
  });
});
