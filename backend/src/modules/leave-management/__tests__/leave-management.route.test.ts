import { describe, expect, test } from "@jest/globals";
import router from "../api/leave-management.route.js";

describe("leave-management document upload route", () => {
  test("validates stored file content before persisting leave documents", () => {
    const layer = (router as any).stack.find(
      (entry: any) =>
        entry.route?.path === "/:leaveManagementId/documents" &&
        entry.route?.methods?.post,
    );

    expect(layer).toBeDefined();
    const middlewareNames = layer.route.stack.map((entry: any) => entry.name);
    expect(middlewareNames).toContain("enforceUploadedFilesAreSafe");
  });
});
