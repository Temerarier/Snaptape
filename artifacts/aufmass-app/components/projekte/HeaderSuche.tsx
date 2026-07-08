"use client";

// Suchfeld in der Kopfzeile: filtert die Projektliste nach Name/Adresse
// (GET /app?q=…). Aktive Filter/Sortierung/Archiv-Ansicht bleiben beim
// Suchen über versteckte Felder erhalten.
import { useSearchParams } from "next/navigation";
import { useDictionary } from "@/i18n/LocaleProvider";

export function HeaderSuche() {
  const t = useDictionary().projects;
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const status = params.get("status");
  const sort = params.get("sort");
  const archiv = params.get("archiv");

  return (
    <form action="/app" className="mx-auto w-full max-w-md">
      {status ? <input type="hidden" name="status" value={status} /> : null}
      {sort ? <input type="hidden" name="sort" value={sort} /> : null}
      {archiv ? <input type="hidden" name="archiv" value={archiv} /> : null}
      <input
        key={q}
        type="search"
        name="q"
        defaultValue={q}
        placeholder={t.searchPlaceholder}
        aria-label={t.searchPlaceholder}
        className="w-full rounded-eingabe border border-linie bg-flaeche px-4 py-2 text-sm text-schrift transition placeholder:text-schrift-tertiaer focus:border-akzent focus:outline-none focus:ring-2 focus:ring-akzent/40"
      />
    </form>
  );
}
