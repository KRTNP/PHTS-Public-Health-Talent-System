import { describe, expect, jest, test } from "@jest/globals";
import { NotFoundError, ValidationError } from "@/shared/utils/errors.js";

jest.mock("@/modules/access-review/services/access-review.service.js", () => ({
  getReviewCycle: jest.fn(),
  updateReviewItem: jest.fn(),
  ReviewResult: {
    KEEP: "KEEP",
    REVOKE: "REVOKE",
  },
}));

import * as accessReviewService from "@/modules/access-review/services/access-review.service.js";
import { getCycle, updateItem } from "@/modules/access-review/access-review.controller.js";

describe("access-review controller", () => {
  test("getCycle forwards NotFoundError when cycle does not exist", async () => {
    const req: any = { params: { id: "5" } };
    const res: any = { json: jest.fn() };
    const next = jest.fn();

    (accessReviewService.getReviewCycle as jest.Mock).mockResolvedValue(null);

    await getCycle(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
  });

  test("updateItem forwards ValidationError for invalid review result", async () => {
    const req: any = {
      params: { id: "2" },
      body: { result: "INVALID" },
      user: { userId: 99 },
    };
    const res: any = { json: jest.fn() };
    const next = jest.fn();

    await updateItem(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    expect(accessReviewService.updateReviewItem).not.toHaveBeenCalled();
  });
});
