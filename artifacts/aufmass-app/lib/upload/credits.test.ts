import { expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ classifier: vi.fn(), balance: vi.fn(), select: vi.fn() }));
vi.mock("@workspace/db", () => ({ db: { select: m.select }, projectsTable: {}, projectFilesTable: {} }));
vi.mock("@/lib/auth/session", () => ({ requireUser: async () => ({ id: "user", locale: "en-US" }) }));
vi.mock("@/lib/credits/service", () => ({ holeGuthaben: m.balance, verbucheMessung: vi.fn(), KeineCreditsFehler: class extends Error {} }));
vi.mock("@/lib/klassifizierung/service", () => ({ klassifiziereDateien: m.classifier }));
vi.mock("@/lib/messung/pipeline", () => ({ fuehreMessLaufAus: vi.fn() }));
vi.mock("@/lib/storage/objectStorage", () => ({}));
vi.mock("@/lib/upload/verarbeitung", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
import { starteMessungAction } from "./actions";
it("returns keineCredits before any DB project access or paid classification", async () => {
  m.balance.mockResolvedValue(0);
  const result = await starteMessungAction("project", { referenceObject: "", referenceValue: "", referenceUnit: "" });
  expect(result).toHaveProperty("error");
  expect(m.classifier).not.toHaveBeenCalled();
  expect(m.select).not.toHaveBeenCalled();
});
