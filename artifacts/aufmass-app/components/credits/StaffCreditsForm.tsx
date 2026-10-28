"use client";
import { useActionState } from "react";
import type { Dictionary } from "@/i18n";
import { bucheStaffCreditsAction } from "@/lib/credits/actions";

const EINGABE =
  "rounded-eingabe border border-linie bg-flaeche px-3 py-2 font-mono text-sm text-schrift focus:border-akzent focus:outline-none focus:ring-2 focus:ring-akzent/20";

export function StaffCreditsForm({
  userId,
  t,
}: {
  userId: string;
  t: Dictionary["admin"]["users"]["form"];
}) {
  const [state, action, pending] = useActionState(bucheStaffCreditsAction, {});
  return (
    <form action={action} noValidate className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="userId" value={userId} />
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-schrift-sekundaer">{t.delta}</span>
        <input
          name="delta"
          type="number"
          min={-100}
          max={100}
          step={1}
          required
          pattern="-?[1-9][0-9]*"
          className={`${EINGABE} w-28`}
        />
      </label>
      <label className="flex min-w-[220px] flex-1 flex-col gap-1">
        <span className="text-xs font-medium text-schrift-sekundaer">{t.notiz}</span>
        <input name="note" type="text" required minLength={1} maxLength={500} className={EINGABE} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-eingabe bg-akzent px-4 py-2 text-sm font-semibold text-white shadow-akzent transition hover:opacity-90"
      >
        {t.buchen}
      </button>
      {state.error ? <p role="alert" className="w-full text-sm text-fehler">{state.error}</p> : null}
      {state.ok ? <p role="status" className="w-full text-sm text-ok">{t.saved}</p> : null}
    </form>
  );
}
