// C1: "Copy JSON" neben dem JSON-Link im Messprotokoll – kopiert das
// gespeicherte Measurement-JSON in die Zwischenablage und zeigt kurz
// eine Bestätigung. Kleine Client-Insel, weil die Admin-Seite selbst
// eine Server-Komponente ist; Labels kommen per Props aus dem Dictionary.
"use client";

import { useEffect, useRef, useState } from "react";

export function CopyJsonButton({
  json,
  label,
  copiedLabel,
}: {
  json: unknown;
  label: string;
  copiedLabel: string;
}) {
  const [kopiert, setKopiert] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function kopieren() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(json, null, 2));
      setKopiert(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setKopiert(false), 2000);
    } catch {
      // Zwischenablage nicht verfügbar (z. B. unsicherer Kontext) –
      // bewusst kein stiller Fallback, der Button bleibt einfach ohne Wirkung.
    }
  }

  return (
    <button
      type="button"
      onClick={kopieren}
      className="cursor-pointer font-medium text-schrift underline underline-offset-2 hover:text-schrift-sekundaer"
    >
      {kopiert ? copiedLabel : label}
    </button>
  );
}
