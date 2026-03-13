import { NotFoundError } from "@/shared/utils/errors.js";

describe("NotFoundError", () => {
  test("does not duplicate thai not-found prefix when resource already contains it", () => {
    const error = new NotFoundError("ไม่พบไฟล์แนบ");

    expect(error.message).toBe("ไม่พบไฟล์แนบ");
    expect(error.toJSON()).toEqual({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "ไม่พบไฟล์แนบ",
        details: {
          resource: "ไฟล์แนบ",
          identifier: undefined,
        },
      },
    });
  });
});
