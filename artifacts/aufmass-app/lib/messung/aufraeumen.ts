import { and, eq, isNull, lt, or } from "drizzle-orm";
import { db, measureRunsTable, projectsTable, usersTable } from "@workspace/db";
import { erstatteMessung } from "@/lib/credits/service";
import { MESS_MODELL } from "./modelle";

const TIMEOUT = "Measurement timed out after 60 minutes";

export async function raeumeHaengendeMessungenAuf(userId?: string): Promise<void> {
  const expired = () => or(
    and(eq(projectsTable.status, "processing"), lt(projectsTable.processingSince, new Date(Date.now() - 3_600_000))),
    and(eq(projectsTable.status, "model_ready"), isNull(projectsTable.measurement)),
  );
  const candidates = await db.select({ id: projectsTable.id, userId: projectsTable.userId }).from(projectsTable)
    .where(and(userId ? eq(projectsTable.userId, userId) : undefined, expired()));
  for (const candidate of candidates) {
    await db.transaction(async (tx) => {
      // All credit paths lock user -> project -> charge in that order.
      await tx.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, candidate.userId)).for("update");
      const [project] = await tx.select().from(projectsTable)
        .where(and(eq(projectsTable.id, candidate.id), expired())).for("update");
      if (!project) return; // Another finalizer/sweep already settled it.
      const errors = [project.status === "processing" ? TIMEOUT : "Measurement is missing"];
      await tx.update(projectsTable).set({ status: "failed", measurement: null,
        measurementErrors: errors, currentRunId: null, processingSince: null, currentCreditLedgerId: null })
        .where(eq(projectsTable.id, project.id));
      const [run] = await tx.insert(measureRunsTable).values({
        projectId: project.id, outcome: "failed", model: MESS_MODELL, quality: "premium",
        schemaVersion: "unknown", errors, warnings: [],
        durationMs: project.processingSince ? Date.now() - project.processingSince.getTime() : null,
      }).returning({ id: measureRunsTable.id });
      if (project.status === "processing" && project.currentCreditLedgerId) {
        await erstatteMessung(tx, project.currentCreditLedgerId, run!.id, "timeout");
      }
    });
  }
}
