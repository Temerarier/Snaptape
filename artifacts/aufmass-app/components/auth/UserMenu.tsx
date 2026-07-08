"use client";

// Nutzer-Menü in der Kopfzeile: Initialen-Avatar + Name, aufklappbares
// Menü mit Link zum Testhaus-Viewer, Sprachumschalter (en-US/de-DE,
// gespeichert am Nutzer) und Abmelden.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LOCALES, type Locale } from "@/i18n";
import { useDictionary, useLocale } from "@/i18n/LocaleProvider";
import { logoutAction, setLocaleAction } from "@/lib/auth/actions";

function initialen(email: string): string {
  const lokal = email.split("@")[0] ?? "";
  return lokal.slice(0, 2).toUpperCase() || "?";
}

export function UserMenu({ email }: { email: string }) {
  const [offen, setOffen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const anzeigeName = email.split("@")[0] ?? email;
  const dict = useDictionary();
  const locale = useLocale();

  const spracheLabel: Record<Locale, string> = {
    "en-US": dict.common.spracheEnglisch,
    "de-DE": dict.common.spracheDeutsch,
  };

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
        aria-label={dict.common.benutzerMenue}
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
            {dict.viewer.navLink}
          </Link>
          {/* Sprachumschalter: speichert die Wahl per Server-Action am
              Nutzer (users.locale); revalidatePath rendert alles neu. */}
          <div className="mt-1 border-t border-linie pt-1.5">
            <p className="px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wide text-schrift-tertiaer">
              {dict.common.sprache}
            </p>
            <form action={setLocaleAction} className="flex gap-1 px-2.5 pb-1">
              {LOCALES.map((wert) => (
                <button
                  key={wert}
                  type="submit"
                  name="locale"
                  value={wert}
                  role="menuitemradio"
                  aria-checked={locale === wert}
                  disabled={locale === wert}
                  className={`flex-1 rounded-lg border px-2 py-1 text-xs font-medium transition ${
                    locale === wert
                      ? "border-akzent/50 bg-akzent/10 text-akzent"
                      : "border-linie bg-flaeche text-schrift-sekundaer hover:bg-hintergrund hover:text-schrift"
                  }`}
                >
                  {spracheLabel[wert]}
                </button>
              ))}
            </form>
          </div>
          <div className="mt-1 border-t border-linie pt-1">
            <form action={logoutAction}>
              <button
                type="submit"
                role="menuitem"
                className="block w-full rounded-lg px-2.5 py-1.5 text-left text-sm text-schrift transition hover:bg-hintergrund"
              >
                {dict.common.logout}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
