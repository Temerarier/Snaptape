"use client";

// Sortier-Dropdown der Projektliste („Sortierung: Neueste zuerst").
// Wechsel navigiert sofort und erhält Suche/Filter/Archiv-Ansicht.
import { useRouter } from "next/navigation";
import { useId } from "react";
import type { ProjectStatus } from "@workspace/db";
import { de } from "@/i18n/de";

export function SortSelect({
  q,
  status,
  sort,
  archiv,
}: {
  q: string;
  status: ProjectStatus | null;
  sort: "neueste" | "aelteste";
  archiv: boolean;
}) {
  const router = useRouter();
  const selectId = useId();
  const t = de.projects;

  function beiWechsel(neuerSort: string) {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (status) p.set("status", status);
    if (neuerSort !== "neueste") p.set("sort", neuerSort);
    if (archiv) p.set("archiv", "1");
    const s = p.toString();
    router.push(s ? `/app?${s}` : "/app");
  }

  return (
    <label
      htmlFor={selectId}
      className="inline-flex items-center gap-1.5 rounded-full border border-linie bg-flaeche px-3.5 py-1.5 text-sm"
    >
      <span className="text-schrift-tertiaer">{t.sortLabel}</span>
      <select
        id={selectId}
        value={sort}
        onChange={(e) => beiWechsel(e.target.value)}
        className="cursor-pointer bg-transparent font-medium text-schrift focus:outline-none"
      >
        <option value="neueste">{t.sortNeueste}</option>
        <option value="aelteste">{t.sortAelteste}</option>
      </select>
    </label>
  );
}
