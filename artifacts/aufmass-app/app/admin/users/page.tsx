// Admin: Nutzerübersicht mit Guthaben, Messungen, Kosten und Buchungen.
// Read-only page load; credit bookings require the existing explicit form action.
import { getDictionary, toLocale } from "@/i18n";
import { requireStaff } from "@/lib/auth/staff";
import { ladeNutzerUebersicht } from "@/lib/credits/admin";
import { formatAuditCost } from "@/lib/admin/model3d";
import { StaffCreditsForm } from "@/components/credits/StaffCreditsForm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const staff = await requireStaff();
  const nutzer = await ladeNutzerUebersicht();
  const locale = toLocale(staff.locale);
  const t = getDictionary(locale).admin.users;
  const a = getDictionary(locale).admin.model3d;
  const fmt = (d: Date | null) =>
    d
      ? new Intl.DateTimeFormat(locale, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(d)
      : t.nie;
  const th = "px-3 py-2 text-left font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-schrift-sekundaer";
  const td = "px-3 py-2.5 align-top";

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-3xl font-bold tracking-tight text-schrift">{t.title}</h1>
      <p className="mt-1 text-sm text-schrift-sekundaer">{t.subtitle}</p>

      {nutzer.length === 0 ? (
        <div className="mt-8 rounded-karte border border-dashed border-linie bg-flaeche px-6 py-12 text-center text-schrift-sekundaer">
          {t.leer}
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-karte border border-linie bg-flaeche shadow-karte">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-linie bg-hintergrund">
              <tr>
                <th className={th}>{t.spalten.nutzer}</th>
                <th className={th}>{t.spalten.erstellt}</th>
                <th className={th}>{t.spalten.letzterLogin}</th>
                <th className={th}>{t.spalten.guthaben}</th>
                <th className={th}>{t.spalten.fertig}</th>
                <th className={th}>{t.spalten.fehlgeschlagen}</th>
                <th className={th}>{t.spalten.kosten}</th>
                <th className={th}>{a.total}</th>
                <th className={th}>{t.spalten.letzteMessung}</th>
              </tr>
            </thead>
            {nutzer.map((n) => (
              <tbody key={n.id} className="border-b border-linie last:border-b-0">
                <tr>
                  <td className={`${td} font-medium text-schrift`}>
                    {n.label}
                    <div className="font-mono text-[11px] text-schrift-tertiaer">{n.id}</div>
                  </td>
                  <td className={`${td} font-mono text-schrift-sekundaer`}>{fmt(n.createdAt)}</td>
                  <td className={`${td} font-mono text-schrift-sekundaer`}>{fmt(n.lastLoginAt)}</td>
                  <td className={`${td} font-mono font-semibold ${n.balance > 0 ? "text-schrift" : "text-warnung"}`}>{n.balance}</td>
                  <td className={`${td} font-mono text-ok`}>{n.readyCount}</td>
                  <td className={`${td} font-mono ${n.failedCount > 0 ? "text-fehler" : "text-schrift-tertiaer"}`}>{n.failedCount}</td>
                  <td className={`${td} font-mono text-schrift`}>${n.costUsd.toFixed(2)}</td>
                  <td className={`${td} font-mono text-schrift`}>
                    {formatAuditCost({ known: n.costTotalUsd, unknown: n.unknownCosts }, a.partial)}
                  </td>
                  <td className={`${td} font-mono text-schrift-sekundaer`}>{fmt(n.lastMeasurementAt)}</td>
                </tr>
                <tr>
                  <td colSpan={9} className="px-3 pb-4">
                    <details className="rounded-eingabe border border-linie bg-hintergrund">
                      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-schrift-sekundaer">
                        {t.ledgerAnzeigen} <span className="font-mono">({n.ledger.length})</span>
                      </summary>
                      <div className="flex flex-col gap-4 px-3 pb-3">
                        {n.ledger.length === 0 ? (
                          <p className="text-xs text-schrift-tertiaer">{t.ledgerLeer}</p>
                        ) : (
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-left text-schrift-tertiaer">
                                <th className="py-1 pr-3 font-medium">{t.ledger.zeitpunkt}</th>
                                <th className="py-1 pr-3 font-medium">{t.ledger.delta}</th>
                                <th className="py-1 pr-3 font-medium">{t.ledger.grund}</th>
                                <th className="py-1 pr-3 font-medium">{t.ledger.notiz}</th>
                                <th className="py-1 pr-3 font-medium">{t.ledger.projekt}</th>
                                <th className="py-1 font-medium">{t.ledger.staff}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {n.ledger.map((l) => (
                                <tr key={l.id} className="border-t border-linie">
                                  <td className="py-1 pr-3 font-mono text-schrift-sekundaer">{fmt(l.createdAt)}</td>
                                  <td className={`py-1 pr-3 font-mono font-semibold ${l.delta > 0 ? "text-ok" : "text-fehler"}`}>
                                    {l.delta > 0 ? `+${l.delta}` : l.delta}
                                  </td>
                                  <td className="py-1 pr-3 font-mono text-schrift">{l.reason}</td>
                                  <td className="py-1 pr-3 text-schrift-sekundaer">{l.note ?? ""}</td>
                                   <td className="py-1 pr-3 font-mono text-schrift-tertiaer">{l.projectId ? <Link className="text-akzent underline" href={`/admin/projekt/${l.projectId}/viewer`}>{l.projectId}</Link> : ""}</td>
                                  <td className="py-1 text-schrift-sekundaer">{l.staffLabel ?? ""}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                        <div>
                          <p className="mb-2 text-xs font-semibold text-schrift">{t.form.titel}</p>
                          <StaffCreditsForm userId={n.id} t={t.form} />
                        </div>
                      </div>
                    </details>
                  </td>
                </tr>
              </tbody>
            ))}
          </table>
        </div>
      )}
    </main>
  );
}
