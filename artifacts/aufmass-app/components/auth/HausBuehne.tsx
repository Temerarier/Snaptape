"use client";

// 3D-Hero der Auth-Seiten: baut das Testhaus-Modell und zeigt es auf
// der langsam rotierenden Showcase-Bühne (lib/viewer/buehne.ts).
// Ohne WebGL (z. B. Headless-Browser) bleibt still die schraffierte
// Platzhalter-Fläche stehen – bewusst kein Fehlerkasten.
import { useEffect, useMemo, useRef, useState } from "react";
import type { MessJson } from "@/lib/messung/schema";
import { baueHausModell } from "@/lib/viewer/baukasten";
import { erstelleBuehne, type BuehnenHandle } from "@/lib/viewer/buehne";

export function HausBuehne({ mess }: { mess: MessJson }) {
  const modell = useMemo(() => baueHausModell(mess), [mess]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [bereit, setBereit] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let handle: BuehnenHandle | null = null;
    // Einen Frame warten, damit der Container sein Layout-Maß hat.
    const rafId = requestAnimationFrame(() => {
      try {
        handle = erstelleBuehne({ container, modell });
        setBereit(true);
      } catch {
        // Kein WebGL: Platzhalter bleibt sichtbar, keine Meldung.
      }
    });
    return () => {
      cancelAnimationFrame(rafId);
      handle?.dispose();
      handle = null;
    };
  }, [modell]);

  return (
    <div className="relative h-full w-full">
      <div className="schraffur absolute inset-0" aria-hidden="true" />
      <div
        ref={containerRef}
        aria-hidden="true"
        className={`absolute inset-0 bg-flaeche transition-opacity duration-700 ${
          bereit ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
