"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  adminRunDailyBilling,
  adminRecordTopup,
  adminCorrectTopup,
} from "@/lib/billing/actions";
import type { BillingDashboardFilter, BillingDashboardRow } from "@/lib/billing/types";
import type { Dictionary } from "@/i18n/en-US";

function AlertBanner({
  title,
  message,
  type = "info",
  action,
}: {
  title?: string;
  message: string;
  type?: "error" | "warning" | "info";
  action?: React.ReactNode;
}) {
  const bg =
    type === "error"
      ? "bg-fehler-flaeche text-fehler"
      : type === "warning"
        ? "bg-warnung-flaeche text-warnung"
        : "bg-hintergrund text-schrift-sekundaer";
  const border =
    type === "error"
      ? "border-red-200"
      : type === "warning"
        ? "border-amber-200"
        : "border-linie";

  return (
    <div className={`mb-4 flex items-center justify-between rounded-karte border p-4 text-sm ${bg} ${border}`}>
      <div>
        {title && <span className="font-semibold block mb-0.5">{title}</span>}
        {message}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export function BillingDashboardClient({
  dict,
  initialRows,
  initialFilter,
  topupRevisions,
}: {
  dict: Dictionary;
  initialRows: BillingDashboardRow[];
  initialFilter: BillingDashboardFilter;
  topupRevisions: any[];
}) {
  const t = dict.admin.billing;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [from, setFrom] = useState(initialFilter.from);
  const [to, setTo] = useState(initialFilter.to);
  const [provider, setProvider] = useState(initialFilter.provider || "all");
  const [model, setModel] = useState(initialFilter.model || "all");

  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);

  const hasKeyRejected = initialRows.some((r) => r.status === "not_reconciled_key_rejected");
  const hasProvisional = initialRows.some((r) => r.status === "provisional");

  function applyFilters() {
    const params = new URLSearchParams(searchParams);
    params.set("from", from);
    params.set("to", to);
    if (provider !== "all") params.set("provider", provider);
    else params.delete("provider");
    if (model !== "all") params.set("model", model);
    else params.delete("model");

    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  }

  async function handleRun(retryAuth: boolean) {
    setIsRunning(true);
    setRunResult(null);
    try {
      const res = await adminRunDailyBilling(retryAuth);
      if (!res.locked) {
        setRunResult("Job already running.");
      } else {
        setRunResult(
          `Done. Anthropic: ${res.anthropic.status} (${res.anthropic.rows} rows). Moonshot: ${res.moonshot.status} (${res.moonshot.inserted ? "inserted" : "skipped"}).`
        );
        startTransition(() => {
          router.refresh();
        });
      }
    } catch (err) {
      setRunResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-schrift">{t.title}</h1>
          <p className="mt-1 text-sm text-schrift-sekundaer">{t.subtitle}</p>
        </div>
        <div className="flex gap-3">
          {hasKeyRejected && (
            <button
              onClick={() => handleRun(true)}
              disabled={isRunning}
              className="rounded-eingabe bg-warnung-flaeche px-4 py-2 text-sm font-medium text-warnung border border-amber-200 hover:bg-amber-100 disabled:opacity-50"
            >
              {isRunning ? t.actions.runManualRunning : t.actions.runManualRetryAuth}
            </button>
          )}
          <button
            onClick={() => handleRun(false)}
            disabled={isRunning}
            className="rounded-eingabe border border-linie bg-flaeche px-4 py-2 text-sm font-medium text-schrift hover:bg-hintergrund disabled:opacity-50"
          >
            {isRunning ? t.actions.runManualRunning : t.actions.runManual}
          </button>
        </div>
      </div>

      {runResult && (
        <AlertBanner message={runResult} type={runResult.startsWith("Error") ? "error" : "info"} />
      )}

      {hasKeyRejected && (
        <AlertBanner message={t.banners.keyRejected} type="error" />
      )}
      {hasProvisional && (
        <AlertBanner message={t.banners.provisional} type="info" />
      )}
      <AlertBanner message={t.banners.scheduleNotActivated} type="warning" />

      {/* Filters */}
      <div className="mb-6 rounded-karte border border-linie bg-flaeche p-4 shadow-sm flex flex-wrap gap-4 items-end">
        <div>
          <label className="mb-1 block text-xs font-medium text-schrift-sekundaer">{t.filters.from}</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-eingabe border border-linie bg-hintergrund px-3 py-1.5 text-sm focus:border-akzent focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-schrift-sekundaer">{t.filters.to}</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-eingabe border border-linie bg-hintergrund px-3 py-1.5 text-sm focus:border-akzent focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-schrift-sekundaer">{t.filters.provider}</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="rounded-eingabe border border-linie bg-hintergrund px-3 py-1.5 text-sm focus:border-akzent focus:outline-none"
          >
            <option value="all">{t.filters.all}</option>
            <option value="anthropic">Anthropic</option>
            <option value="moonshot">Moonshot</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-schrift-sekundaer">{t.filters.model}</label>
          <input
            type="text"
            value={model === "all" ? "" : model}
            onChange={(e) => setModel(e.target.value || "all")}
            placeholder={t.filters.all}
            className="rounded-eingabe border border-linie bg-hintergrund px-3 py-1.5 text-sm focus:border-akzent focus:outline-none"
          />
        </div>
        <button
          onClick={applyFilters}
          disabled={isPending}
          className="rounded-eingabe bg-akzent px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? "..." : "Filter"}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-linie bg-flaeche shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-linie text-xs uppercase tracking-wide text-schrift-tertiaer">
              <th className="px-4 py-3 font-medium">{t.table.utcDay}</th>
              <th className="px-4 py-3 font-medium">{t.table.provider}</th>
              <th className="px-4 py-3 font-medium">{t.table.model}</th>
              <th className="px-4 py-3 font-medium text-right">{t.table.estimates}</th>
              <th className="px-4 py-3 font-medium text-right">{t.table.actual}</th>
              <th className="px-4 py-3 font-medium text-right">{t.table.diff}</th>
              <th className="px-4 py-3 font-medium">{t.table.status}</th>
              <th className="px-4 py-3 font-medium">{t.table.detail}</th>
            </tr>
          </thead>
          <tbody>
            {initialRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-schrift-sekundaer">
                  No data found.
                </td>
              </tr>
            ) : (
              initialRows.map((row, i) => {
                const diffVal = row.differencePercent !== null ? row.differencePercent.toFixed(1) + "%" : "—";
                
                let statusClass = "text-schrift-sekundaer bg-hintergrund";
                if (row.status === "reconciled") statusClass = "text-ok bg-ok-flaeche";
                else if (row.status === "not_reconciled_key_rejected" || row.status === "missing") statusClass = "text-fehler bg-fehler-flaeche";
                else if (row.status === "provisional" || row.status === "partial") statusClass = "text-warnung bg-warnung-flaeche";

                return (
                  <tr key={i} className="border-b border-linie/60 last:border-0 hover:bg-hintergrund/50">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-schrift">
                      {row.provider === "moonshot" && row.periodStartAt ? (
                        <div className="text-xs font-normal">
                          <span className="font-medium text-schrift">{new Date(row.periodStartAt).toISOString().replace("T", " ").substring(0, 19)}</span><br/>
                          <span className="text-schrift-sekundaer">to {row.periodEndAt ? new Date(row.periodEndAt).toISOString().replace("T", " ").substring(0, 19) : row.utcDay}</span>
                        </div>
                      ) : (
                        row.utcDay
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-schrift-sekundaer">{row.provider}</td>
                    <td className="px-4 py-3 text-schrift-sekundaer truncate max-w-[200px]" title={row.model || row.accountScope}>
                      {row.model ? row.model : <span className="text-xs uppercase tracking-wide text-schrift-tertiaer">{row.accountScope}</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-schrift-sekundaer">
                      {row.estimatedCostUsd !== null ? `$${row.estimatedCostUsd.toFixed(4)}` : "—"}
                      {row.estimatedRunCount !== undefined && (row.estimatedRunCount > 0 || row.missingCostRunCount > 0) && (
                        <div className="text-[10px] text-schrift-tertiaer">
                          {row.estimatedRunCount} runs
                          {row.missingCostRunCount > 0 ? `, ${row.missingCostRunCount} missing` : ""}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-schrift">
                      {row.actualCostUsd !== null ? `$${row.actualCostUsd.toFixed(4)}` : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <span className={row.flagged ? "font-bold text-fehler" : "text-schrift-sekundaer"}>
                        {diffVal} {row.flagged && <span className="ml-1 text-[10px] uppercase bg-fehler-flaeche px-1 rounded">{t.flags.flagged}</span>}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusClass}`}>
                        {t.status[row.status as keyof typeof t.status] || row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-schrift-tertiaer max-w-[250px] truncate" title={row.detail || ""}>
                      {row.detail || "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      
      {/* Topup Forms */}
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <TopupForm dict={dict} onDone={() => startTransition(() => router.refresh())} />
        <CorrectTopupForm dict={dict} onDone={() => startTransition(() => router.refresh())} />
      </div>

      <div className="mt-8 rounded-lg border border-linie bg-flaeche shadow-sm">
        <div className="p-4 border-b border-linie">
          <h3 className="font-semibold text-schrift">Top-up Revisions</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-linie text-xs uppercase tracking-wide text-schrift-tertiaer">
                <th className="px-4 py-3 font-medium">{t.topupForm.topupIdRevision}</th>
                <th className="px-4 py-3 font-medium">Provider / Scope</th>
                <th className="px-4 py-3 font-medium text-right">Amount ($)</th>
                <th className="px-4 py-3 font-medium">Effective (UTC)</th>
                <th className="px-4 py-3 font-medium">Note</th>
                <th className="px-4 py-3 font-medium">Staff Actor</th>
              </tr>
            </thead>
            <tbody>
              {topupRevisions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-schrift-sekundaer">No topups recorded.</td>
                </tr>
              ) : (
                topupRevisions.map((rev) => (
                  <tr key={rev.id} className="border-b border-linie/60 last:border-0 hover:bg-hintergrund/50">
                    <td className="px-4 py-3 text-schrift truncate max-w-[200px]" title={rev.topupId}>
                      <span className="font-mono text-xs">{rev.topupId.split("-")[0]}</span> <span className="text-schrift-sekundaer">v{rev.revision}</span>
                    </td>
                    <td className="px-4 py-3 text-schrift-sekundaer">
                      {rev.provider} / <span className="text-xs">{rev.accountScope}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-schrift">
                      {rev.amountUsd !== null && rev.amountUsd !== undefined ? `$${rev.amountUsd.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-schrift-sekundaer whitespace-nowrap">
                      {new Date(rev.effectiveAt).toISOString().replace("T", " ").substring(0, 19)}
                    </td>
                    <td className="px-4 py-3 text-schrift truncate max-w-[250px]" title={rev.note}>
                      {rev.note}
                    </td>
                    <td className="px-4 py-3 text-schrift-sekundaer text-xs truncate max-w-[150px]" title={rev.staffActor}>
                      {rev.staffActor || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TopupForm({ dict, onDone }: { dict: Dictionary; onDone: () => void }) {
  const t = dict.admin.billing;
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    setErr(null);
    try {
      await adminRecordTopup({
        amountUsd: Number(fd.get("amountUsd")),
        effectiveAt: fd.get("effectiveAt") as string,
        note: fd.get("note") as string,
        accountScope: fd.get("accountScope") as string,
      });
      (e.target as HTMLFormElement).reset();
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-karte border border-linie bg-flaeche p-5 shadow-sm">
      <h3 className="mb-4 text-base font-semibold text-schrift">{t.actions.recordTopup} (Moonshot)</h3>
      {err && <div className="mb-3 text-xs text-fehler bg-fehler-flaeche p-2 rounded">{err}</div>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-schrift-sekundaer mb-1">{t.topupForm.accountScope}</label>
          <input required name="accountScope" defaultValue="moonshot-account" className="w-full rounded-eingabe border border-linie px-3 py-1.5 text-sm focus:border-akzent focus:outline-none" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-schrift-sekundaer mb-1">{t.topupForm.amountUsd}</label>
            <input required type="number" step="0.01" name="amountUsd" min="0" className="w-full rounded-eingabe border border-linie px-3 py-1.5 text-sm focus:border-akzent focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-schrift-sekundaer mb-1">{t.topupForm.effectiveAt}</label>
            <input required type="datetime-local" name="effectiveAt" className="w-full rounded-eingabe border border-linie px-3 py-1.5 text-sm focus:border-akzent focus:outline-none" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-schrift-sekundaer mb-1">{t.topupForm.note}</label>
          <input required name="note" className="w-full rounded-eingabe border border-linie px-3 py-1.5 text-sm focus:border-akzent focus:outline-none" />
        </div>
        <button disabled={loading} type="submit" className="mt-2 w-full rounded-eingabe bg-akzent px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {loading ? "..." : t.actions.save}
        </button>
      </form>
    </div>
  );
}

function CorrectTopupForm({ dict, onDone }: { dict: Dictionary; onDone: () => void }) {
  const t = dict.admin.billing;
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    setErr(null);
    try {
      await adminCorrectTopup({
        topupId: fd.get("topupId") as string,
        amountUsd: Number(fd.get("amountUsd")),
        effectiveAt: fd.get("effectiveAt") as string,
        note: fd.get("note") as string,
      });
      (e.target as HTMLFormElement).reset();
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-karte border border-linie bg-flaeche p-5 shadow-sm">
      <h3 className="mb-4 text-base font-semibold text-schrift">{t.actions.correctTopup}</h3>
      {err && <div className="mb-3 text-xs text-fehler bg-fehler-flaeche p-2 rounded">{err}</div>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-schrift-sekundaer mb-1">{t.topupForm.topupId}</label>
          <input required name="topupId" className="w-full rounded-eingabe border border-linie px-3 py-1.5 text-sm focus:border-akzent focus:outline-none" placeholder="uuid..." />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-schrift-sekundaer mb-1">{t.topupForm.amountUsd}</label>
            <input required type="number" step="0.01" name="amountUsd" min="0" className="w-full rounded-eingabe border border-linie px-3 py-1.5 text-sm focus:border-akzent focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-schrift-sekundaer mb-1">{t.topupForm.effectiveAt}</label>
            <input required type="datetime-local" name="effectiveAt" className="w-full rounded-eingabe border border-linie px-3 py-1.5 text-sm focus:border-akzent focus:outline-none" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-schrift-sekundaer mb-1">{t.topupForm.note}</label>
          <input required name="note" className="w-full rounded-eingabe border border-linie px-3 py-1.5 text-sm focus:border-akzent focus:outline-none" placeholder="Reason for correction" />
        </div>
        <button disabled={loading} type="submit" className="mt-2 w-full rounded-eingabe border border-linie bg-hintergrund px-4 py-2 text-sm font-medium text-schrift hover:bg-linie disabled:opacity-50">
          {loading ? "..." : t.actions.save}
        </button>
      </form>
    </div>
  );
}
