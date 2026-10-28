import { describe, expect, it } from "vitest";
import type { Model3dReport } from "@workspace/db";
import { addCost, formatAuditCost, groupedChecks, isModel3dIssue, model3dState, summarizeModelRuns } from "./model3d";

const report = (stufe: Model3dReport["stufe"]): Model3dReport => ({
  stufe, zahlen: {}, zeilen: [], korrektur_genutzt: false, modell: "stored-model",
  effort: "medium", measure_run_id: "measurement",
});
describe("read-only model audit summaries", () => {
  it("sums correction attempts once and keeps the latest model separately", () => {
    const summary = summarizeModelRuns([
      { id: "correction", projectId: "p", model: "second", stufe: "merken", korrekturGenutzt: true, costUsd: .8 },
      { id: "first", projectId: "p", model: "first", stufe: "stopp", korrekturGenutzt: false, costUsd: .5 },
      { id: "other", projectId: "q", model: "other", stufe: "ok", korrekturGenutzt: false, costUsd: 4 },
    ]);
    expect(summary.get("p")?.cost).toEqual({ known: 1.3, unknown: 0 });
    expect(summary.get("p")?.latest.id).toBe("correction");
    expect(summary.get("q")?.cost.known).toBe(4);
  });
  it("does not silently turn incomplete costs into a complete zero bill", () => {
    const costs = [2, null, Number.NaN, 0].reduce(addCost, { known: 0, unknown: 0 });
    expect(costs).toEqual({ known: 2, unknown: 2 });
    expect(formatAuditCost(costs, "partial")).toBe("≥ $2.000 (partial)");
    expect(formatAuditCost({ known: 3.22262, unknown: 0 }, "partial")).toBe("$3.223");
  });
  it("pending supersedes stale warnings", () => {
    expect(model3dState("pending", report("merken"))).toBe("pending");
    expect(isModel3dIssue(model3dState("pending", report("merken")))).toBe(false);
  });
  it.each(["ok", "merken", "stopp"] as const)("retains stored check level %s", level => {
    expect(model3dState("ready", report(level))).toBe(level);
    expect(isModel3dIssue(level)).toBe(level !== "ok");
  });
  it("covers unavailable and historical projects without runs", () => {
    expect(model3dState("unavailable", null)).toBe("stopp");
    expect(model3dState(null, null)).toBe("—");
    expect(summarizeModelRuns([]).size).toBe(0);
  });
  it("groups fail/warn/info while preserving IDs and check text", () => {
    const r = report("stopp");
    r.zeilen = [
      { id: "WL-1", status: "warn", pruefung: "size", text: "warning" },
      { id: "RF-1", status: "fail", pruefung: "plane", text: "failure" },
      { id: "DS-1", status: "info", pruefung: "built", text: "information" },
    ];
    expect(groupedChecks(r).map(group => [group.status, group.rows[0]?.id]))
      .toEqual([["stopp", "RF-1"], ["merken", "WL-1"], ["info", "DS-1"]]);
    expect(groupedChecks(null).every(group => group.rows.length === 0)).toBe(true);
  });
});
