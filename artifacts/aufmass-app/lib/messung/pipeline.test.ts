import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  standardExtraktor: vi.fn(),
  validateMeasurement: vi.fn(),
  updateReturning: vi.fn(),
  insertValues: vi.fn(),
  erstatte: vi.fn(),
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