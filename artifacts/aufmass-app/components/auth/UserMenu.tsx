"use client";

// Nutzer-Menü in der Kopfzeile: Initialen-Avatar + Name, aufklappbares
// Menü mit Link zum Testhaus-Viewer und Abmelden.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { de } from "@/i18n/de";
import { logoutAction } from "@/lib/auth/actions";

function initialen(email: string): string {
  const lokal = email.split("@")[0] ?? "";
  return lokal.slice(0, 2).toUpperCase() || "?";
}

export function UserMenu({ email }: { email: string }) {
  const [offen, setOffen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const anzeigeName = email.split("@")[0] ?? email;

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
        aria-label={de.common.benutzerMenue}
        aria-expanded={offen}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full p-1 pr-2 transition hover:bg-hintergrund focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-akzent/50"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-linie bg-hintergrund font-mono text-xs font-medium text-schrift-sekundaer">
          {initialen(email)}
        </span>
        <span className="hidden max-w-32 truncate text-sm font-medium text-schrift sm:block">
          {anzeigeName}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 12 12"
          className="h-3 w-3 text-schrift-tertiaer"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <path d="M2.5 4.5 6 8l3.5-3.5" />
        </svg>
      </button>
      {offen ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-56 rounded-eingabe border border-linie bg-flaeche p-1.5 shadow-karte"
        >
          <p className="truncate px-2.5 py-1.5 text-xs text-schrift-tertiaer">
            {email}
          </p>
          <Link
            href="/app/viewer"
            role="menuitem"
            onClick={() => setOffen(false)}
            className="block rounded-lg px-2.5 py-1.5 text-sm text-schrift transition hover:bg-hintergrund"
          >
            {de.viewer.navLink}
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              role="menuitem"
              className="block w-full rounded-lg px-2.5 py-1.5 text-left text-sm text-schrift transition hover:bg-hintergrund"
            >
              {de.common.logout}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
