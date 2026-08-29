import { describe, expect, test } from "vitest";
import nextConfig from "../../next.config";

describe("Next.js authentication entry-point caching", () => {
  test("marks the login page private and non-cacheable", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const loginRule = rules.find((rule) => rule.source === "/login");

    expect(loginRule?.headers).toEqual(
      expect.arrayContaining([
        {
          key: "Cache-Control",
          value: "private, no-store, max-age=0, must-revalidate",
        },
      ]),
    );
  });
});
