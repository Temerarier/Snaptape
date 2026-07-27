"use client";

// Inline-editierbarer Projekttitel auf der Upload-Seite.
// Klick aktiviert ein Input-Feld; Blur/Enter speichert, Escape verwirft.
// Leere Eingabe wird nicht gespeichert (Wert bleibt).
import { useRef, useState, useTransition } from "react";
import { renameProjectAction } from "@/lib/projekte/actions";

interface ProjektTitelInputProps {
  projektId: string;
  initialName: string;
  /** Platzhaltertext im aktiven Eingabefeld. */
  placeholder: string;
}

export function ProjektTitelInput({
  projektId,
  initialName,
  placeholder,
}: ProjektTitelInputProps) {
  const [name, setName] = useState(initialName);
  const [editiert, setEditiert] = useState(false);
  const [entwurf, setEntwurf] = useState(initialName);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function aktivieren() {
    setEntwurf(name);
    setEditiert(true);
    // Focus im nächsten Tick, damit der Input bereits im DOM ist.
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function speichern() {
    const neu = entwurf.trim();
    if (neu.length > 0 && neu !== name) {
      setName(neu);
      startTransition(() => { void renameProjectAction(projektId, neu); });
    }
    setEditiert(false);
  }

  function verwerfen() {
    setEntwurf(name);
    setEditiert(false);
  }

  if (editiert) {
    return (
      <input
        ref={inputRef}
        autoFocus
        value={entwurf}
        maxLength={200}
        placeholder={placeholder}
        onChange={(e) => setEntwurf(e.target.value)}
        onBlur={speichern}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            speichern();
          } else if (e.key === "Escape") {
            verwerfen();
          }
        }}
        className="mt-4 w-full bg-transparent text-[28px] font-bold tracking-[-0.02em] text-schrift outline-none ring-0
                   border-b-2 border-akzent focus:border-akzent"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={aktivieren}
      title={placeholder}
      className="mt-4 block w-full cursor-text text-left text-[28px] font-bold
                 tracking-[-0.02em] text-schrift hover:opacity-70 transition-opacity"
    >
      {name}
    </button>
  );
}
