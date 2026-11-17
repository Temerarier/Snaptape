import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  staff: vi.fn(), status: vi.fn(), users: vi.fn(),
}));
vi.mock("@/lib/auth/staff", () => ({ requireStaff: mocks.staff }));
vi.mock("@/lib/credits/trial", () => ({ trialStatus: mocks.status }));
vi.mock("@/lib/credits/admin", () => ({ ladeNutzerUebersicht: mocks.users }));
vi.mock("@/lib/admin/model3d", () => ({ formatAuditCost: vi.fn() }));
vi.mock("@/components/credits/StaffCreditsForm", () => ({ StaffCreditsForm: () => null }));
import AdminUsersPage from "./page";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.staff.mockResolvedValue({ locale: "en-US" });
  mocks.status.mockResolvedValue({ granted: 7, limit: 20 });
  mocks.users.mockResolvedValue([]);
});
describe("staff-only trial counter", () => {
  it("renders the counter and uses the configured denominator", async () => {
    expect(renderToStaticMarkup(await AdminUsersPage())).toContain("Free trial credits granted today: 7 / 20");
    mocks.status.mockResolvedValue({ granted: 7, limit: 12 });
    expect(renderToStaticMarkup(await AdminUsersPage())).toContain("Free trial credits granted today: 7 / 12");
  });
  it("does not even query the global count when staff authorization fails", async () => {
    mocks.staff.mockRejectedValue(new Error("forbidden"));
    await expect(AdminUsersPage()).rejects.toThrow("forbidden");
    expect(mocks.status).not.toHaveBeenCalled();
    expect(mocks.users).not.toHaveBeenCalled();
  });
});
