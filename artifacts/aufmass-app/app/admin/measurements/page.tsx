// Staff-Ansicht des Messprotokolls: ALLE Läufe über ALLE Konten,
// neueste zuerst – bewusste Ausnahme von der userId-Scoping-Regel,
// ausschließlich hinter dem serverseitigen Staff-Gate.
// Eine Zeile pro Lauf, horizontal scrollbar; Warnungen/Fehler als
// aufklappbare Zähler-Badges (<details>), damit Zeilen nie hoch werden.
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, measureRunsTable, projectsTable, usersTable } from "@workspace/db";
import { getDictionary, toLocale } from "@/i18n";
import { requireStaff } from "@/lib/auth/staff";

export const dynamic = "force-dynamic";

const MM2_PRO_SQFT = 92_903.04;

function formatDauer(ms: number | null): string {
  if (ms === null || ms === undefined) return "—";
  return `${(ms / 1000).toFixed(1)} s`;
}

function formatFlaecheSqFt(mm2: number | null): string {
  if (mm2 === null || mm2 === undefined) return "—";
  return `${Math.round(mm2 / MM2_PRO_SQFT).toLocaleString("en-US")} ft²`;
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
      model: measureRunsTable.model,
      route: measureRunsTable.route,
      inputTokens: measureRunsTable.inputTokens,
      outputTokens: measureRunsTable.outputTokens,
      costUsd: measureRunsTable.costUsd,
      retryUsed: measureRunsTable.retryUsed,
      repairUsed: measureRunsTable.repairUsed,
      roofAreaMm2: measureRunsTable.roofAreaMm2,
      netWallAreaMm2: measureRunsTable.netWallAreaMm2,
      openingCount: measureRunsTable.openingCount,
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

  // Aufklappbarer Zähler-Badge: zeigt "<n> …" kompakt; Klick öffnet die
  // vollen Texte als überlagerte Liste (Zeile wächst dadurch nicht).
  function ListenBadge({
    eintraege,
    eins,
    viele,
    farbe,
  }: {
    eintraege: string[] | null;
    eins: string;
    viele: string;
    farbe: "amber" | "red";
  }) {
    if (!eintraege || eintraege.length === 0) {
      return <span className="text-schrift-tertiaer">—</span>;
    }
    const label =
      eintraege.length === 1 ? eins : `${eintraege.length} ${viele}`;
    const badgeKlasse =
      farbe === "amber"
        ? "bg-amber-100 text-amber-800"
        : "bg-red-100 text-red-800";
    return (
      <details className="relative">
        <summary
          className={`inline-block cursor-pointer select-none whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${badgeKlasse}`}
        >
          {label}
        </summary>
        <div className="absolute left-0 z-10 mt-1 w-80 rounded-lg border border-linie bg-flaeche p-3 shadow-lg">
          <ul className="list-disc space-y-1 pl-4 text-xs text-schrift-sekundaer">
            {eintraege.map((eintrag, i) => (
              <li key={i}>{eintrag}</li>
            ))}
          </ul>
        </div>
      </details>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
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
          <table className="w-max min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-linie text-xs uppercase tracking-wide text-schrift-tertiaer">
                <th className="px-4 py-3 font-medium">{t.spalten.zeitpunkt}</th>
                <th className="px-4 py-3 font-medium">{t.spalten.projekt}</th>
                <th className="px-4 py-3 font-medium">{t.spalten.kunde}</th>
                <th className="px-4 py-3 font-medium">{t.spalten.qualitaet}</th>
                <th className="px-4 py-3 font-medium">{t.spalten.route}</th>
                <th className="px-4 py-3 font-medium">{t.spalten.modell}</th>
                <th className="px-4 py-3 font-medium">{t.spalten.tokens}</th>
                <th className="px-4 py-3 font-medium">{t.spalten.kosten}</th>
                <th className="px-4 py-3 font-medium">
                  {t.spalten.retryRepair}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t.spalten.dachflaeche}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t.spalten.wandflaeche}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t.spalten.oeffnungen}
                </th>
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
                  className="border-b border-linie/60 last:border-b-0"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-schrift-sekundaer">
                    {datumFormat.format(run.createdAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-schrift">
                    {run.projektName}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-schrift-sekundaer">
                    {run.kundeEmail}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-schrift-sekundaer">
                    {run.quality ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-schrift-sekundaer">
                    {run.route ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-schrift-sekundaer">
                    {run.model ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-schrift-sekundaer">
                    {run.inputTokens !== null || run.outputTokens !== null
                      ? `${(run.inputTokens ?? 0).toLocaleString("en-US")} / ${(run.outputTokens ?? 0).toLocaleString("en-US")}`
                      : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-schrift-sekundaer">
                    {run.costUsd !== null && run.costUsd !== undefined
                      ? `$${run.costUsd.toFixed(3)}`
                      : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-schrift-sekundaer">
                    {run.retryUsed === null && run.repairUsed === null ? (
                      "—"
                    ) : (
                      <span className="flex gap-1">
                        {run.retryUsed ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                            {t.retryKuerzel}
                          </span>
                        ) : null}
                        {run.repairUsed ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                            {t.repairKuerzel}
                          </span>
                        ) : null}
                        {!run.retryUsed && !run.repairUsed ? "—" : null}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-schrift-sekundaer">
                    {run.roofAreaMm2 !== null && run.roofAreaMm2 !== undefined
                      ? `${formatFlaecheSqFt(run.roofAreaMm2)} (${(run.roofAreaMm2 / MM2_PRO_SQFT / 100).toFixed(1)} ${t.squaresKuerzel})`
                      : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-schrift-sekundaer">
                    {formatFlaecheSqFt(run.netWallAreaMm2)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-schrift-sekundaer">
                    {run.openingCount ?? "—"}
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
                  <td className="whitespace-nowrap px-4 py-3 text-xs">
                    <ListenBadge
                      eintraege={run.warnings}
                      eins={t.warnungBadgeEine}
                      viele={t.warnungBadgeViele}
                      farbe="amber"
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs">
                    <ListenBadge
                      eintraege={run.errors}
                      eins={t.fehlerBadgeEiner}
                      viele={t.fehlerBadgeViele}
                      farbe="red"
                    />
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
