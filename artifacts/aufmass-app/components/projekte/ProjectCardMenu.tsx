"use client";

// Kleines Karten-Menü (⋯): Projektdetails öffnen sowie Archivieren/
// Wiederherstellen – liegt über dem Karten-Link (z-10).
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { de } from "@/i18n/de";
import {
  archiveProjectAction,
  restoreProjectAction,
} from "@/lib/projekte/actions";

export function ProjectCardMenu({
  projektId,
  archiviert,
}: {
  projektId: string;
  archiviert: boolean;
}) {
  const [offen, setOffen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const t = de.projects;

  useEffect(() => {
    if (!offen) return;
    function beiKlick(ereignis: MouseEvent) {
      if (!wrapperRef.current?.contains(ereignis.target as Node)) {
        setOffen(false);
      }
    }
    function beiTaste(ereignis: KeyboardEvent) {
      if (ereignis.key === "Escape") setOffen(false);
    }
    document.addEventListener("mousedown", beiKlick);
    document.addEventListener("keydown", beiTaste);
    return () => {
      document.removeEventListener("mousedown", beiKlick);
      document.removeEventListener("keydown", beiTaste);
    };
  }, [offen]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOffen((v) => !v)}
        aria-label={t.kartenMenue}
        aria-expanded={offen}
        aria-haspopup="menu"
        className="flex h-7 w-7 items-center justify-center rounded-full text-schrift-tertiaer transition hover:bg-hintergrund hover:text-schrift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-akzent/50"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4"
        >
          <circle cx="4" cy="10" r="1.6" />
          <circle cx="10" cy="10" r="1.6" />
          <circle cx="16" cy="10" r="1.6" />
        </svg>
      </button>
      {offen ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 w-48 rounded-eingabe border border-linie bg-flaeche p-1.5 shadow-karte"
        >
          <Link
            href={`/app/projekt/${projektId}`}
            role="menuitem"
            onClick={() => setOffen(false)}
            className="block rounded-lg px-2.5 py-1.5 text-sm text-schrift transition hover:bg-hintergrund"
          >
            {t.detailsOeffnen}
          </Link>
          <form action={archiviert ? restoreProjectAction : archiveProjectAction}>
            <input type="hidden" name="id" value={projektId} />
            <button
              type="submit"
              role="menuitem"
              className="block w-full rounded-lg px-2.5 py-1.5 text-left text-sm text-schrift transition hover:bg-hintergrund"
            >
              {archiviert ? t.restore : t.archive}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
