import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  guard: vi.fn(), select: vi.fn(), limit: vi.fn(),
}));
vi.mock("@/lib/auth/staff", () => ({ requireStaff: m.guard }));
vi.mock("@workspace/db", () => ({
  db: { select: m.select },
  projectsTable: { id: "id" }, modelRunsTable: { projectId: "project", createdAt: "time", id: "id" },
}));
import Page from "../../app/admin/projekt/[id]/page";

describe("staff project audit boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const query: Record<string, unknown> = { limit: m.limit };
    for (const method of ["from", "where", "orderBy"]) query[method] = () => query;
    m.select.mockReturnValue(query);
  });
  it("rejects nonstaff before reading any report or code", async () => {
    m.guard.mockRejectedValueOnce(new Error("STAFF_ONLY"));
    await expect(Page({ params: Promise.resolve({ id: "8c12e2b9-7cd3-48a9-b1dd-799e5e05bd9a" }) })).rejects.toThrow("STAFF_ONLY");
    expect(m.select).not.toHaveBeenCalled();
  });
  it("renders grouped stored rows, counts, lists and escaped collapsed code", async () => {
    m.guard.mockResolvedValueOnce({ locale: "en-US" });
    const report = {
      stufe: "merken", korrektur_genutzt: true, zahlen: { ids_gebaut: 3, ids_nicht_gebaut: 1, ids_fehlen: 0 },
      zeilen: [{ status: "warn", id: "WL-1", pruefung: "wall_check", text: "stored warning" }],
    };
    m.limit.mockResolvedValueOnce([{
      name: "Audit", model3dStatus: "ready", model3dReport: report,
      model3d: { kanten: [], fallrohre: [], schaeden: [], ergaenzt: [{ text: "added" }], konflikte: [], nicht_gebaut: [{ id: "X" }] },
    }]).mockResolvedValueOnce([{
      id: "run", projectId: "p", model: "stored-model", effort: "medium", report,
      stufe: "merken", korrekturGenutzt: true, aiCode: "<script>NOT_EXECUTED</script>",
      costUsd: 1, durationMs: 100, sandboxMs: 2, inputTokens: 3, outputTokens: 4,
    }]);
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "8c12e2b9-7cd3-48a9-b1dd-799e5e05bd9a" }) }));
    expect(html).toContain('data-check-status="merken"');
    for (const text of ["WL-1", "wall_check", "stored warning", "IDs built", "stored-model", "added", "nicht_gebaut"]) expect(html).toContain(text);
    expect(html).toContain("&lt;script&gt;NOT_EXECUTED&lt;/script&gt;");
    expect(html).toContain('<details data-testid="admin-ai-code">');
    expect(html).not.toContain('<details data-testid="admin-ai-code" open');
    expect(html).not.toContain('action=');
  });
});
