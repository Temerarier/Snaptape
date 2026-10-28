// Internal read-only audit page. Never imported by customer routes.
import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { db, modelRunsTable, projectsTable } from "@workspace/db";
import { getDictionary, toLocale } from "@/i18n";
import { requireStaff } from "@/lib/auth/staff";
import { groupedChecks, model3dState } from "@/lib/admin/model3d";

export const dynamic = "force-dynamic";

export default async function AdminProjectPage({ params }: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const dict = getDictionary(toLocale(user.locale));
  const t = dict.admin.model3d;
  const [project] = await db.select({
    name: projectsTable.name, model3d: projectsTable.model3d,
    hasMeasurement: sql<boolean>`${projectsTable.measurement} is not null`,
    model3dStatus: projectsTable.model3dStatus, model3dReport: projectsTable.model3dReport,
  }).from(projectsTable).where(eq(projectsTable.id, id)).limit(1);
  if (!project) notFound();
  const [latest] = await db.select({
    id: modelRunsTable.id, projectId: modelRunsTable.projectId,
    model: modelRunsTable.model, effort: modelRunsTable.effort,
    stufe: modelRunsTable.stufe, korrekturGenutzt: modelRunsTable.korrekturGenutzt,
    costUsd: modelRunsTable.costUsd, durationMs: modelRunsTable.durationMs,
    sandboxMs: modelRunsTable.sandboxMs, inputTokens: modelRunsTable.inputTokens,
    outputTokens: modelRunsTable.outputTokens, report: modelRunsTable.report,
    aiCode: modelRunsTable.aiCode,
  }).from(modelRunsTable).where(eq(modelRunsTable.projectId, id))
    .orderBy(desc(modelRunsTable.createdAt), desc(modelRunsTable.id)).limit(1);
  const report = project.model3dReport ?? (project.model3dStatus === "pending" ? null : latest?.report ?? null);
  const model = project.model3d;
  const countRows = [
    [t.built, report?.zahlen.ids_gebaut],
    [t.notBuilt, report?.zahlen.ids_nicht_gebaut],
    [t.missing, report?.zahlen.ids_fehlen],
    [t.edges, report?.zahlen.kanten ?? model?.kanten.length],
    [t.downspouts, report?.zahlen.fallrohre ?? model?.fallrohre.length],
    [t.conditions, report?.zahlen.schaeden ?? model?.schaeden.length],
  ];
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-8" data-testid="admin-model3d-check">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-2xl font-bold text-schrift">{project.name}</h1>
        <nav className="flex gap-4 text-sm underline">
          <Link href="/admin/measurements">{dict.admin.json.zurueck}</Link>
          {project.hasMeasurement && <>
            <Link href={`/admin/projekt/${id}/viewer`}>{dict.admin.measurements.viewerLink}</Link>
            <Link href={`/admin/projekt/${id}/json`}>{dict.admin.measurements.jsonLink}</Link>
          </>}
        </nav>
      </div>
      <section className="space-y-4 rounded-karte border border-linie bg-flaeche p-5">
        <h2 className="text-xl font-semibold">{t.check}</h2>
        <p>{t.status}: <strong>{model3dState(project.model3dStatus, report, latest)}</strong>
          {" · "}{t.correction}: {project.model3dStatus === "pending" ? "—" :
            (report?.korrektur_genutzt ?? latest?.korrekturGenutzt) == null ? "—" :
              (report?.korrektur_genutzt ?? latest?.korrekturGenutzt) ? t.yes : t.no}</p>
        {report?.error && <p className="whitespace-pre-wrap break-words text-fehler">{report.error}</p>}
        {!report && <p className="text-schrift-sekundaer">{t.empty}</p>}
        <dl className="grid gap-3 sm:grid-cols-3">
          {countRows.map(([label, value]) => <div key={label}>
            <dt className="text-sm text-schrift-sekundaer">{label}</dt>
            <dd className="font-mono">{value ?? "—"}</dd>
          </div>)}
        </dl>
        {groupedChecks(report).map(group => <section key={group.status} data-check-status={group.status}>
          <h3 className="mb-2 font-semibold">{group.status} ({group.rows.length})</h3>
          {!group.rows.length ? <p className="text-sm text-schrift-tertiaer">{t.none}</p> :
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead><tr>{[t.id, t.test, t.text].map(label =>
                  <th className="p-2" key={label}>{label}</th>)}</tr></thead>
                <tbody>{group.rows.map((row, index) => <tr key={index} className="border-t border-linie">
                  <td className="p-2 font-mono">{row.id}</td><td className="p-2">{row.pruefung}</td>
                  <td className="p-2 whitespace-pre-wrap break-words">{row.text}</td>
                </tr>)}</tbody>
              </table>
            </div>}
        </section>)}
      </section>
      {([
        [t.additions, model?.ergaenzt], [t.conflicts, model?.konflikte], [t.omitted, model?.nicht_gebaut],
      ] as const).map(([label, rows]) => <section key={label} className="rounded-karte border border-linie bg-flaeche p-5">
        <h2 className="font-semibold">{label} ({rows?.length ?? 0})</h2>
        {rows?.length ? <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words font-mono text-xs">
          {JSON.stringify(rows, null, 2)}
        </pre> : <p className="mt-2 text-sm text-schrift-tertiaer">{t.none}</p>}
      </section>)}
      {latest && <section className="space-y-3 rounded-karte border border-linie bg-flaeche p-5">
        <h2 className="font-semibold">{t.lastAttempt}</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          {([
            [t.model, latest.model], [t.effort, latest.effort],
            [t.tokens, `${latest.inputTokens ?? "—"} / ${latest.outputTokens ?? "—"}`],
            [t.cost, latest.costUsd == null ? "—" : `$${latest.costUsd.toFixed(6)}`],
            [t.duration, `${latest.durationMs} ms`], [t.sandbox, `${latest.sandboxMs} ms`],
          ] as const).map(([label, value]) => <div key={label}>
            <dt className="text-schrift-sekundaer">{label}</dt><dd className="break-words font-mono">{value}</dd>
          </div>)}
        </dl>
        <details data-testid="admin-ai-code">
          <summary className="cursor-pointer text-sm font-semibold">{t.code}</summary>
          <pre className="mt-3 max-h-[40rem] overflow-auto whitespace-pre-wrap break-words rounded-eingabe border border-linie bg-hintergrund p-4 font-mono text-xs">
            {latest.aiCode ?? "—"}
          </pre>
        </details>
      </section>}
    </main>
  );
}
