"use client";

// 3D-Viewer (Etappe 2) im Stil „Technical-Clean": Kopfzeile mit
// Zurück-Link und Status-Badge, helle 3D-Bühne links mit schwebender
// Werkzeugleiste, helles Seitenpanel rechts. React besitzt den Zustand
// (Auswahl, Tab, Maße, Messmodus, Messlinien) und synchronisiert ihn
// per Effekten in die imperative three.js-Szene (lib/viewer/szene.ts).
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDictionary } from "@/i18n/LocaleProvider";
import type { MeasureJson } from "@/lib/messung/schema";
import { formatFtIn } from "@/lib/viewer/anzeige";
import { baueHausModell } from "@/lib/viewer/baukasten";
import {
  erstelleSzene,
  type MessLinie,
  type SzenenHandle,
} from "@/lib/viewer/szene";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { BauteilPanel, type KategorieTab } from "./BauteilPanel";

// Höhe der App-Kopfzeile (app/app/layout.tsx): h-9 Logo + 2×py-3 + Border.
const APP_KOPF_HOEHE = "h-[calc(100dvh-61px)]";

export interface ModellViewerProps {
  mess: MeasureJson;
  projektName?: string;
  projektAdresse?: string | null;
}

export function ModellViewer({
  mess,
  projektName,
  projektAdresse,
}: ModellViewerProps) {
  const t = useDictionary().viewer;
  const modell = useMemo(() => baueHausModell(mess), [mess]);
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<SzenenHandle | null>(null);
  const messZaehler = useRef(0);

  const [auswahl, setAuswahl] = useState<ReadonlySet<string>>(new Set());
  const [tab, setTab] = useState<KategorieTab>("roof");
  const [masseSichtbar, setMasseSichtbar] = useState(false);
  const [messModus, setMessModus] = useState(false);
  const [messLinien, setMessLinien] = useState<MessLinie[]>([]);
  const [szenenFehler, setSzenenFehler] = useState(false);
  const [laedt, setLaedt] = useState(true);

  // Bauteil-IDs je Kategorie – für „Alle auswählen" der Werkzeugleiste
  // (wirkt auf den aktiven Tab).
  const tabIds = useMemo<Record<KategorieTab, string[]>>(
    () => ({
      roof: mess.faces
        .filter((f) => f.face_class === "roof_face")
        .map((f) => f.id),
      walls: mess.faces
        .filter((f) => f.face_class === "wall")
        .map((f) => f.id),
      openings: mess.openings.map((o) => o.id),
      edges: mess.edges.map((e) => e.id),
    }),
    [mess],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // Szene erst im nächsten Frame aufbauen, damit der Ladescreen
    // gezeichnet wird, bevor der (synchrone) Aufbau den Thread blockiert.
    let handle: SzenenHandle | null = null;
    const rafId = requestAnimationFrame(() => {
      try {
        handle = erstelleSzene({
          container,
          modell,
          formatLaenge: formatFtIn,
          onBauteilKlick: (id) => {
            setAuswahl((alt) => {
              if (!id) return new Set<string>();
              const neu = new Set(alt);
              if (neu.has(id)) {
                neu.delete(id);
              } else {
                neu.add(id);
              }
              return neu;
            });
          },
          onMessLinie: (a, b, laengeMm) => {
            messZaehler.current += 1;
            setMessLinien((alt) => [
              ...alt,
              { id: `M-${messZaehler.current}`, a, b, laengeMm },
            ]);
          },
        });
      } catch (fehler) {
        // Kein WebGL verfügbar (z. B. Headless-Browser): Seite nicht
        // crashen lassen, sondern klaren Hinweis zeigen (Panel bleibt).
        console.error("3D-Viewer: Szene konnte nicht erstellt werden.", fehler);
        setSzenenFehler(true);
        setLaedt(false);
        return;
      }
      setSzenenFehler(false);
      setLaedt(false);
      handleRef.current = handle;
    });
    return () => {
      cancelAnimationFrame(rafId);
      handleRef.current = null;
      handle?.dispose();
      handle = null;
    };
  }, [modell]);

  useEffect(() => {
    handleRef.current?.setAuswahl(auswahl);
  }, [auswahl]);
  useEffect(() => {
    handleRef.current?.setMasseSichtbar(masseSichtbar);
  }, [masseSichtbar]);
  useEffect(() => {
    handleRef.current?.setMessModus(messModus);
  }, [messModus]);
  useEffect(() => {
    handleRef.current?.setMessLinien(messLinien);
  }, [messLinien]);

  function toggleBauteil(id: string) {
    setAuswahl((alt) => {
      const neu = new Set(alt);
      if (neu.has(id)) {
        neu.delete(id);
      } else {
        neu.add(id);
      }
      return neu;
    });
  }

  // Alle IDs einer Kategorie auswählen; sind bereits alle gewählt,
  // wird die Kategorie abgewählt.
  function toggleKategorie(ids: string[]) {
    setAuswahl((alt) => {
      const alleGewaehlt = ids.every((id) => alt.has(id));
      const neu = new Set(alt);
      for (const id of ids) {
        if (alleGewaehlt) {
          neu.delete(id);
        } else {
          neu.add(id);
        }
      }
      return neu;
    });
  }

  const aktiveIds = tabIds[tab];
  const alleGewaehlt =
    aktiveIds.length > 0 && aktiveIds.every((id) => auswahl.has(id));

  return (
    <div className={`flex ${APP_KOPF_HOEHE} min-h-0 flex-col bg-hintergrund`}>
      {/* Viewer-Kopfzeile */}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-linie bg-flaeche px-4 py-2.5">
        <Link
          href="/app"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-eingabe border border-linie bg-flaeche px-3 py-1.5 text-sm font-medium text-schrift transition hover:bg-hintergrund"
        >
          <span aria-hidden="true">←</span> {t.zurueckProjekte}
        </Link>
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h1 className="truncate text-lg font-bold tracking-tight text-schrift">
            {projektName ?? t.title}
          </h1>
          {projektAdresse ? (
            <p className="truncate text-sm text-schrift-sekundaer">
              {projektAdresse}
            </p>
          ) : null}
        </div>
        <Badge variante="ok" className="shrink-0 font-mono">
          {t.statusBadge}
        </Badge>
      </header>

      <div className="flex min-h-0 flex-1 gap-4 p-4">
        {/* 3D-Bühne */}
        <div className="relative min-w-0 flex-1 overflow-hidden rounded-karte border border-linie bg-flaeche shadow-karte">
          <div ref={containerRef} className="absolute inset-0" />

          {/* Hinweis-Chip oben links */}
          {!laedt && !szenenFehler ? (
            messModus ? (
              <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-full border border-fehler/30 bg-fehler-flaeche px-3 py-1.5 text-xs font-medium text-fehler">
                {t.messHinweis}
              </div>
            ) : (
              <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-full border border-linie bg-flaeche/90 px-3 py-1.5 font-mono text-xs text-schrift-tertiaer">
                {t.steuerungHinweis}
              </div>
            )
          ) : null}

          {/* Schwebende Werkzeugleiste: Auswahl-Aktionen immer verfügbar;
              Maße/Messlinie nur, wenn die 3D-Szene läuft. */}
          <div className="absolute bottom-4 left-1/2 z-10 flex max-w-[calc(100%-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-1 rounded-full border border-linie bg-flaeche px-2 py-1.5 shadow-karte">
            <Button
              variante="leise"
              groesse="klein"
              onClick={() => toggleKategorie(aktiveIds)}
            >
              {alleGewaehlt ? t.alleAbwaehlen : t.alleAuswaehlen}
            </Button>
            <Button
              variante="leise"
              groesse="klein"
              disabled={auswahl.size === 0}
              onClick={() => setAuswahl(new Set())}
            >
              {t.leerenKurz}
            </Button>
            {!szenenFehler ? (
              <>
                <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-linie" />
                <label className="flex cursor-pointer items-center gap-2 rounded-full px-2 py-1 text-xs font-medium text-schrift-sekundaer">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={masseSichtbar}
                    onChange={(e) => setMasseSichtbar(e.target.checked)}
                  />
                  <span
                    aria-hidden="true"
                    className="relative h-4.5 w-8 shrink-0 rounded-full bg-linie transition peer-checked:bg-akzent peer-focus-visible:ring-2 peer-focus-visible:ring-akzent/50 peer-focus-visible:ring-offset-2 after:absolute after:left-0.5 after:top-0.5 after:h-3.5 after:w-3.5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-3.5"
                  />
                  {t.masseAnzeigen}
                </label>
                <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-linie" />
                <Button
                  variante="leise"
                  groesse="klein"
                  aria-pressed={messModus}
                  onClick={() => setMessModus(!messModus)}
                  className={
                    messModus
                      ? "bg-fehler-flaeche text-fehler hover:bg-fehler-flaeche hover:text-fehler"
                      : ""
                  }
                >
                  <span aria-hidden="true">∠</span> {t.messWerkzeug}
                </Button>
              </>
            ) : null}
          </div>

          {/* Kein WebGL (ohne z-Index, damit die Werkzeugleiste darüber
              bedienbar bleibt) */}
          {szenenFehler ? (
            <div className="absolute inset-0 flex items-center justify-center bg-hintergrund p-6">
              <p className="max-w-md rounded-karte border border-warnung/30 bg-warnung-flaeche px-4 py-3 text-sm text-warnung">
                {t.webglFehler}
              </p>
            </div>
          ) : null}

          {/* Ladescreen */}
          {laedt ? (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-flaeche">
              <div className="h-1 w-48 overflow-hidden rounded-full bg-linie">
                <div className="ladebalken h-full w-2/5 rounded-full bg-akzent" />
              </div>
              <p className="mt-4 text-sm text-schrift-sekundaer">{t.laden}</p>
            </div>
          ) : null}
        </div>

        {/* Seitenpanel */}
        <aside className="w-[380px] shrink-0 overflow-y-auto rounded-karte border border-linie bg-flaeche shadow-karte">
          <BauteilPanel
            mess={mess}
            modell={modell}
            auswahl={auswahl}
            tab={tab}
            onTabChange={setTab}
            onToggle={toggleBauteil}
            onZoom={(id) => handleRef.current?.zoomAufBauteil(id)}
            messLinien={messLinien}
            onMessLinieLoeschen={(id) =>
              setMessLinien((alt) => alt.filter((l) => l.id !== id))
            }
          />
        </aside>
      </div>
    </div>
  );
}
