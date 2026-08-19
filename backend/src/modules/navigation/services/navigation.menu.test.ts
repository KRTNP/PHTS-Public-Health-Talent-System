import { UserRole } from "@/types/auth.js";
import { buildMenu } from "@/modules/navigation/services/navigation.menu.js";

describe("PTS officer navigation", () => {
  it("includes the downloadable reports link in the secondary menu", () => {
    const navigation = buildMenu(UserRole.PTS_OFFICER);

    expect(navigation.secondaryMenu).toContainEqual({
      label: "ดาวน์โหลดรายงาน",
      href: "/pts-officer/reports",
      iconKey: "FileBarChart",
    });
  });
});
