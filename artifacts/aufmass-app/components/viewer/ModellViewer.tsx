"use client";

// 3D-Viewer (Etappe 2): React besitzt den Zustand (Auswahl, Maße,
// Messmodus, Messlinien) und synchronisiert ihn per Effekten in die
// imperative three.js-Szene (lib/viewer/szene.ts).
import { useEffect, useMemo, useRef, useState } from "react";
import { de } from "@/i18n/de";
import type { MessJson } from "@/lib/messung/schema";
import { formatMeter } from "@/lib/viewer/anzeige";
import { baueHausModell } from "@/lib/viewer/baukasten";
import {
  erstelleSzene,
  type MessLinie,
  type SzenenHandle,
} from "@/lib/viewer/szene";
import { BauteilPanel } from "./BauteilPanel";

export function ModellViewer({ mess }: { mess: MessJson }) {
  const modell = useMemo(() => baueHausModell(mess), [mess]);
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<SzenenHandle | null>(null);
  const messZaehler = useRef(0);

  const [auswahl, setAuswahl] = useState<ReadonlySet<string>>(new Set());
  const [masseSichtbar, setMasseSichtbar] = useState(false);
  const [messModus, setMessModus] = useState(false);
  const [messLinien, setMessLinien] = useState<MessLinie[]>([]);
  const [szenenFehler, setSzenenFehler] = useState(false);
  const [laedt, setLaedt] = useState(true);

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
          formatLaenge: formatMeter,
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

  return (
    <div className="flex h-[calc(100vh-57px)]">
      <aside className="w-96 shrink-0 overflow-y-auto border-r border-white/10 bg-[#1E1E20]">
        <BauteilPanel
          mess={mess}
          modell={modell}
          auswahl={auswahl}
          onToggle={toggleBauteil}
          onKategorieToggle={toggleKategorie}
          onAuswahlLeeren={() => setAuswahl(new Set())}
          onZoom={(id) => handleRef.current?.zoomAufBauteil(id)}
          masseSichtbar={masseSichtbar}
          onMasseChange={setMasseSichtbar}
          messModus={messModus}
          onMessModusChange={setMessModus}
          messLinien={messLinien}
          onMessLinieLoeschen={(id) =>
            setMessLinien((alt) => alt.filter((l) => l.id !== id))
          }
        />
      </aside>
      <div ref={containerRef} className="relative min-w-0 flex-1 overflow-hidden">
        {messModus && !szenenFehler ? (
          <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-lg border border-red-200 bg-white/95 px-3 py-1.5 text-xs font-medium text-red-700 shadow-sm">
            {de.viewer.messHinweis}
          </div>
        ) : null}
        {szenenFehler ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-100 p-6">
            <p className="max-w-md rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {de.viewer.webglFehler}
            </p>
          </div>
        ) : null}
        {laedt ? (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#141416]">
            <div className="h-1 w-48 overflow-hidden rounded-full bg-white/10">
              <div className="ladebalken h-full w-2/5 rounded-full bg-white/70" />
            </div>
            <p className="mt-4 text-sm text-neutral-400">{de.viewer.laden}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
