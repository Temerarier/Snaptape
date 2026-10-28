import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  standardExtraktor: vi.fn(),
  validateMeasurement: vi.fn(),
  updateReturning: vi.fn(),
  insertValues: vi.fn(),
  erstatte: vi.fn(),
  step2: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...conditions: unknown[]) => conditions),
  eq: vi.fn((column: unknown, value: unknown) => ({ column, value })),
}));

vi.mock("@workspace/db", () => ({
  db: {
    transaction: async (fn: (tx: unknown) => unknown) => fn({
      select: () => ({ from: () => ({ where: () => Object.assign(Promise.resolve([{ userId: "owner" }]), { for: () => Promise.resolve([]) }) }) }),
      update: () => ({ set: () => ({ where: () => ({ returning: mocks.updateReturning }) }) }),
      insert: () => ({ values: (value: unknown) => {
        mocks.insertValues(value);
        return { returning: async () => [{ id: "run" }] };
      } }),
    }),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: mocks.updateReturning,
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: mocks.insertValues,
    })),
  },
  measureRunsTable: {},
  usersTable: {},
  projectsTable: {
    id: "id",
    currentRunId: "currentRunId",
    status: "status",
  },
}));
vi.mock("@/lib/credits/service", () => ({ erstatteMessung: mocks.erstatte }));
vi.mock("@/lib/modell3d/schritt2", () => ({
  fuehreModellLaufAus: mocks.step2,
  pendingReport: (id: string) => ({ measure_run_id: id }),
  modellGuard: () => "model3d-guard",
  stoppReport: (error: string) => ({ stufe: "stopp", zeilen: [{ text: error }], zahlen: {} }),
}));

vi.mock("@workspace/measurement", () => ({
  validateMeasurement: mocks.validateMeasurement,
}));

vi.mock("./extraktor", () => ({
  standardExtraktor: mocks.standardExtraktor,
}));

import {
  fuehreMessLaufAus,
  schemaVersionFuerProtokoll,
} from "./pipeline";
import { ExtraktionsFehler } from "./echterExtraktor";
import type { ModelDiagnostics } from "@workspace/db";

const laufArgs = {
  projektId: "00000000-0000-0000-0000-000000000001",
  runId: "00000000-0000-0000-0000-000000000002",
  quality: "standard" as const,
  klassifizierung: {} as never,
  dateien: [],
  referenz: null,
};

beforeEach(() => {
  mocks.standardExtraktor.mockReset();
  mocks.validateMeasurement.mockReset();
  mocks.updateReturning
    .mockReset()
    .mockResolvedValue([{ id: laufArgs.projektId }]);
  mocks.insertValues.mockReset().mockResolvedValue(undefined);
  mocks.erstatte.mockReset().mockResolvedValue(undefined);
  mocks.step2.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("schemaVersionFuerProtokoll", () => {
  it("protokolliert die vom Measurement gelieferte Schema-Version", () => {
    expect(
      schemaVersionFuerProtokoll({
        meta: { schema_version: "1.6" },
      }),
    ).toBe("1.6");
  });

  it("bewahrt die deklarierte Version auch bei anderweitig invalidem JSON", () => {
    expect(
      schemaVersionFuerProtokoll({
        meta: { schema_version: "future-version" },
        faces: null,
      }),
    ).toBe("future-version");
  });

  it.each([
    null,
    {},
    { meta: null },
    { meta: {} },
    { meta: { schema_version: "" } },
    { meta: { schema_version: 1.6 } },
  ])("kennzeichnet fehlende Versionen ehrlich als unbekannt: %j", (roh) => {
    expect(schemaVersionFuerProtokoll(roh)).toBe("unknown");
  });
});

describe("Messlauf-Protokoll", () => {
  it("starts step 2 only for an applied successful measurement", async () => {
    mocks.standardExtraktor.mockResolvedValue({ roh: { meta: { schema_version: "1.8" } } });
    mocks.validateMeasurement.mockReturnValue({ valid: true });
    await fuehreMessLaufAus({ ...laufArgs, creditLedgerId: "debit" });
    expect(mocks.step2).toHaveBeenCalledWith({ projektId: laufArgs.projektId, measureRunId: "run", dateien: [] });
    expect(mocks.erstatte).not.toHaveBeenCalled();
  });
  it("does not start step 2 for a superseded measurement", async () => {
    mocks.standardExtraktor.mockResolvedValue({ roh: {} });
    mocks.validateMeasurement.mockReturnValue({ valid: true });
    mocks.updateReturning.mockResolvedValue([]);
    await fuehreMessLaufAus(laufArgs);
    expect(mocks.step2).not.toHaveBeenCalled();
  });
  it("does not refund or reject a successful measurement when step 2 throws", async () => {
    mocks.standardExtraktor.mockResolvedValue({ roh: { meta: { schema_version: "1.8" } } });
    mocks.validateMeasurement.mockReturnValue({ valid: true });
    mocks.step2.mockRejectedValue(new Error("3D failed"));
    await expect(fuehreMessLaufAus({ ...laufArgs, creditLedgerId: "debit" })).resolves.toBeUndefined();
    expect(mocks.insertValues).toHaveBeenCalledWith(expect.objectContaining({ outcome: "model_ready" }));
    expect(mocks.erstatte).not.toHaveBeenCalled();
  });
  it.each([true, false])("persists diagnostic metadata on failure (usage complete: %s) and still refunds", async (complete) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const modelDiagnostics: ModelDiagnostics = {
      effort: "medium", usageComplete: complete,
      responses: [{
        phase: "extract", responseId: "msg_failed", model: "claude-opus-5-5",
        stopReason: "max_tokens", contentTypes: ["thinking"], inputTokens: 100,
        outputTokens: 64000, cacheReadInputTokens: null, cacheCreationInputTokens: null,
      }],
    };
    mocks.standardExtraktor.mockRejectedValue(new ExtraktionsFehler("No usable text", {
      model: "claude-opus-5-5", route: "photo", inputTokens: complete ? 100 : null,
      outputTokens: complete ? 64000 : null, costUsd: complete ? 1.2804 : null,
      retryUsed: false, repairUsed: false, modelDiagnostics,
    }));
    await fuehreMessLaufAus({ ...laufArgs, creditLedgerId: "charge" });
    expect(mocks.insertValues).toHaveBeenCalledWith(expect.objectContaining({
      outcome: "failed", modelDiagnostics, inputTokens: complete ? 100 : null,
      outputTokens: complete ? 64000 : null, costUsd: complete ? 1.2804 : null,
    }));
    expect(mocks.erstatte).toHaveBeenCalledTimes(1);
  });
  it("also persists response diagnostics for a successful measurement", async () => {
    const modelDiagnostics = { effort: "medium", usageComplete: true, responses: [] };
    mocks.standardExtraktor.mockResolvedValue({ roh: { meta: { schema_version: "1.8" } }, modelDiagnostics });
    mocks.validateMeasurement.mockReturnValue({ valid: true });
    await fuehreMessLaufAus(laufArgs);
    expect(mocks.insertValues).toHaveBeenCalledWith(expect.objectContaining({ outcome: "model_ready", modelDiagnostics }));
  });
  it("refunds only the still-current failed run", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.standardExtraktor.mockRejectedValue(new Error("forced failure"));
    await fuehreMessLaufAus({ ...laufArgs, creditLedgerId: "charge" });
    expect(mocks.erstatte).toHaveBeenCalledWith(expect.anything(), "charge", "run", "measurement failed");
  });
  it("does not refund a superseded failed run", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.standardExtraktor.mockRejectedValue(new Error("forced failure"));
    mocks.updateReturning.mockResolvedValue([]);
    await fuehreMessLaufAus({ ...laufArgs, creditLedgerId: "charge" });
    expect(mocks.erstatte).not.toHaveBeenCalled();
  });
  it("never refunds a successful run", async () => {
    mocks.standardExtraktor.mockResolvedValue({ roh: { meta: { schema_version: "1.7" } } });
    mocks.validateMeasurement.mockReturnValue({ valid: true });
    await fuehreMessLaufAus({ ...laufArgs, creditLedgerId: "charge" });
    expect(mocks.erstatte).not.toHaveBeenCalled();
  });
  it("does not write model_ready with null even if validator accepts it", async () => {
    mocks.standardExtraktor.mockResolvedValue({ roh: null });
    mocks.validateMeasurement.mockReturnValue({ valid: true });
    await fuehreMessLaufAus(laufArgs);
    expect(mocks.insertValues).toHaveBeenCalledWith(expect.objectContaining({ outcome: "failed", errors: ["Measurement returned null"] }));
  });
  it("speichert meta.schema_version des validierten Measurements", async () => {
    mocks.standardExtraktor.mockResolvedValue({
      roh: {
        meta: { schema_version: "1.6" },
        quality: { warnings: [] },
      },
    });
    mocks.validateMeasurement.mockReturnValue({ valid: true });

    await fuehreMessLaufAus(laufArgs);

    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaVersion: "1.6",
        outcome: "model_ready",
      }),
    );
  });

  it("retains massing in the stored measurement and schema 1.8 run record", async () => {
    const roh = {
      meta: { schema_version: "1.8" },
      massing: { bodies: [{ id: "B-1" }] },
      quality: { warnings: [] },
    };
    mocks.standardExtraktor.mockResolvedValue({ roh });
    mocks.validateMeasurement.mockReturnValue({ valid: true });

    await fuehreMessLaufAus(laufArgs);

    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaVersion: "1.8",
        outcome: "model_ready",
        measureJson: expect.objectContaining({ massing: roh.massing }),
      }),
    );
  });

  it("protokolliert nach einem Extraktionsfehler keine erfundene Version", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.standardExtraktor.mockRejectedValue(new Error("extraction failed"));

    await fuehreMessLaufAus(laufArgs);

    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaVersion: "unknown",
        outcome: "failed",
      }),
    );
  });
});