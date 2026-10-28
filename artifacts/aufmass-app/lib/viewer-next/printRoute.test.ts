import { readFileSync } from "node:fs";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/app/projekt/[id]/print/route";

const mocks = vi.hoisted(() => ({
  select: vi.fn(), requireUser: vi.fn(), staff: vi.fn(), conditions: [] as unknown[],
}));
vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/auth/staff", () => ({ istStaff: mocks.staff }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("@workspace/db", () => ({
  db: { select: mocks.select },
  projectsTable: { id: "project_id", name: "name", adresse: "adresse", createdAt: "created_at",
    status: "status", measurement: "measurement", userId: "owner_id" },
  projectFilesTable: { projectId: "project_id" },
}));
const id = "11111111-1111-4111-8111-111111111111";
const fixture = JSON.parse(readFileSync("fixtures/garage-house.json", "utf8"));
const project = { id, name: "Fixture", address: null, date: new Date("2026-10-28T12:00:00Z"),
  status: "model_ready", measurement: fixture };
function setupRows(rows: unknown[] = [project]) {
  mocks.select.mockImplementation((fields: Record<string, unknown>) => ({ from: () => ({
    where: (condition: unknown) => {
      mocks.conditions.push(condition);
      return "count" in fields ? Promise.resolve([{ count: 3 }]) : { limit: async () => rows };
    },
  }) }));
}
const invoke = (projectId = id, query = "?preview=1") => GET(
  new Request(`https://example.invalid/app/projekt/${projectId}/print${query}`),
  { params: Promise.resolve({ id: projectId }) },
);
beforeEach(() => {
  vi.clearAllMocks(); mocks.conditions.length = 0;
  mocks.requireUser.mockResolvedValue({ id: "owner-test-id", email: "owner@example.invalid", locale: "en-US" });
  mocks.staff.mockReturnValue(false); setupRows();
});
describe("private print response", () => {
  it("requires sign-in before reading any project data", async () => {
    mocks.requireUser.mockRejectedValue(new Error("SIGN_IN"));
    await expect(invoke()).rejects.toThrow("SIGN_IN");
    expect(mocks.select).not.toHaveBeenCalled();
  });
  it("constrains a customer's query to their own projects and returns only the sheet", async () => {
    const response = await invoke();
    const sql = new PgDialect().sqlToQuery(mocks.conditions[0] as Parameters<PgDialect["sqlToQuery"]>[0]);
    expect(sql.params).toContain("owner-test-id");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'none'");
    const html = await response.text();
    expect(html).toContain("Measurement sheet");
    expect(html).not.toMatch(/credit|opus|claude|\$|__next_f/i);
    expect(Object.keys(mocks.select.mock.calls[0][0])).toEqual(["id", "name", "address", "date", "status", "measurement"]);
  });
  it("allows staff inspection without requiring project ownership", async () => {
    mocks.staff.mockReturnValue(true);
    expect((await invoke()).status).toBe(200);
    const sql = new PgDialect().sqlToQuery(mocks.conditions[0] as Parameters<PgDialect["sqlToQuery"]>[0]);
    expect(sql.params).not.toContain("owner-test-id");
    expect(sql.params).toContain(id);
  });
  it("rejects malformed IDs before selecting", async () => {
    await expect(invoke("bad")).rejects.toThrow("NOT_FOUND");
    expect(mocks.select).not.toHaveBeenCalled();
  });
  it("does not disclose nonexistent or inaccessible projects", async () => {
    setupRows([]);
    await expect(invoke()).rejects.toThrow("NOT_FOUND");
    expect(mocks.select).toHaveBeenCalledTimes(1);
  });
  it("does not print an unfinished project's old data", async () => {
    setupRows([{ ...project, status: "processing" }]);
    await expect(invoke()).rejects.toThrow("NOT_FOUND");
    expect(mocks.select).toHaveBeenCalledTimes(1);
  });
});
