import { describe, expect, jest, test } from "@jest/globals";
import { AuthenticationError } from "@/shared/utils/errors.js";

jest.mock("@/modules/signature/services/signature.service.js", () => ({
  getSignatureBase64: jest.fn(),
  hasSignature: jest.fn(),
}));

jest.mock("@/modules/sync/services/sync.service.js", () => ({
  SyncService: {
    performUserSync: jest.fn().mockResolvedValue(undefined),
  },
}));

import { getMySignature } from "@/modules/signature/signature.controller.js";

describe("signature controller", () => {
  test("getMySignature forwards AuthenticationError when user missing", async () => {
    const req: any = { user: undefined };
    const res: any = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    const next = jest.fn();

    await getMySignature(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
  });
});
