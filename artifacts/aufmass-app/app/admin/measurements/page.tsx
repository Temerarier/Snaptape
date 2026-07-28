// Staff-Ansicht des Messprotokolls: ALLE Läufe über ALLE Konten,
// neueste zuerst – bewusste Ausnahme von der userId-Scoping-Regel,
// ausschließlich hinter dem serverseitigen Staff-Gate.
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, measureRunsTable, projectsTable, usersTable } from "@workspace/db";
import { getDictionary, toLocale } from "@/i18n";
import { requireStaff } from "@/lib/auth/staff";

export const dynamic = "force-dynamic";

function formatDauer(ms: number | null): string {
  if (ms === null || ms === undefined) return "—";
  return `${(ms / 1000).toFixed(1)} s`;
}

export default async function AdminMessungenSeite() {
  const user = await requireStaff();
  const dict = getDictionary(toLocale(user.locale));
  const t = dict.admin.measurements;

  const runs = await db
    .select({
      id: measureRunsTable.id,
      createdAt: measureRunsTable.createdAt,
      quality: measureRunsTable.quality,
      durationMs: measureRunsTable.durationMs,
      outcome: measureRunsTable.outcome,
      warnings: measureRunsTable.warnings,
      errors: measureRunsTable.errors,
      projektId: projectsTable.id,
      projektName: projectsTable.name,
      projektStatus: projectsTable.status,
      hatMeasurement: projectsTable.measurement,
      kundeEmail: usersTable.email,
    })
    .from(measureRunsTable)
    .innerJoin(projectsTable, eq(measureRunsTable.projectId, projectsTable.id))
    .innerJoin(usersTable, eq(projectsTable.userId, usersTable.id))
    .orderBy(desc(measureRunsTable.createdAt));

  const datumFormat = new Intl.DateTimeFormat(toLocale(user.locale), {
    dateStyle: "medium",
    timeStyle: "medium",
  });

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-2xl font-bold tracking-tight text-schrift">
        {t.title}
      </h1>
      <p className="mt-1 text-sm text-schrift-sekundaer">{t.subtitle}</p>

      {runs.length === 0 ? (
        <p className="mt-8 rounded-lg border border-linie bg-flaeche p-6 text-sm text-schrift-sekundaer">
          {t.leer}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-linie bg-flaeche">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-linie text-xs uppercase tracking-wide text-schrift-tertiaer">
                <th className="px-4 py-3 font-medium">{t.spalten.zeitpunkt}</th>
                <th className="px-4 py-3 font-medium">{t.spalten.projekt}</th>
                <th className="px-4 py-3 font-medium">{t.spalten.kunde}</th>
                <th className="px-4 py-3 font-medium">{t.spalten.qualitaet}</th>
                <th className="px-4 py-3 font-medium">{t.spalten.dauer}</th>
                <th className="px-4 py-3 font-medium">{t.spalten.ausgang}</th>
                <th className="px-4 py-3 font-medium">{t.spalten.warnungen}</th>
                <th className="px-4 py-3 font-medium">{t.spalten.fehler}</th>
                <th className="px-4 py-3 font-medium">{t.spalten.links}</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr
                  key={run.id}
                  className="border-b border-linie/60 align-top last:border-b-0"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-schrift-sekundaer">
                    {datumFormat.format(run.createdAt)}
                  </td>
                  <td className="px-4 py-3 font-medium text-schrift">
                    {run.projektName}
                  </td>
                  <td className="px-4 py-3 text-schrift-sekundaer">
                    {run.kundeEmail}
                  </td>
                  <td className="px-4 py-3 text-schrift-sekundaer">
                    {run.quality ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-schrift-sekundaer">
                    {formatDauer(run.durationMs)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {run.outcome === "model_ready" ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                        {t.ausgangModelReady}
                      </span>
                    ) : run.outcome === "failed" ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                        {t.ausgangFailed}
                      </span>
                    ) : (
                      <span className="text-schrift-tertiaer">—</span>
                    )}
                  </td>
                  <td className="max-w-64 px-4 py-3 text-xs text-schrift-sekundaer">
                    {run.warnings && run.warnings.length > 0 ? (
                      <ul className="list-disc space-y-0.5 pl-4">
                        {run.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="max-w-64 px-4 py-3 text-xs text-schrift-sekundaer">
                    {run.errors && run.errors.length > 0 ? (
                      <ul className="list-disc space-y-0.5 pl-4">
                        {run.errors.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {run.hatMeasurement !== null &&
                    run.hatMeasurement !== undefined &&
                    run.projektStatus === "model_ready" ? (
                      <span className="flex gap-3">
                        <Link
                          href={`/admin/projekt/${run.projektId}/json`}
                          className="font-medium text-schrift underline underline-offset-2 hover:text-schrift-sekundaer"
                        >
                          {t.jsonLink}
                        </Link>
                        <Link
                          href={`/admin/projekt/${run.projektId}/viewer`}
                          className="font-medium text-schrift underline underline-offset-2 hover:text-schrift-sekundaer"
                        >
                          {t.viewerLink}
                        </Link>
                      </span>
                    ) : (
                      <span className="text-xs text-schrift-tertiaer">
                        {t.keinErgebnis}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
