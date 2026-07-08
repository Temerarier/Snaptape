"use client";

// Basis-Modal des Design-Systems „Technical-Clean" (siehe replit.md):
// abgedunkelter Hintergrund, Karte mit 20px Radius, Titelzeile mit
// Schließen-Knopf. Schließt per Escape, Klick auf den Hintergrund
// oder den Schließen-Knopf.
import { useEffect, type ReactNode } from "react";
import { useDictionary } from "@/i18n/LocaleProvider";
import { cn } from "./hilfen";

export interface ModalProps {
  offen: boolean;
  onSchliessen: () => void;
  titel?: string;
  children: ReactNode;
  fussbereich?: ReactNode;
  className?: string;
}

export function Modal({
  offen,
  onSchliessen,
  titel,
  children,
  fussbereich,
  className,
}: ModalProps) {
  const dict = useDictionary();
  useEffect(() => {
    if (!offen) {
      return;
    }
    function beiTaste(ereignis: KeyboardEvent) {
      if (ereignis.key === "Escape") {
        onSchliessen();
      }
    }
    document.addEventListener("keydown", beiTaste);
    const vorher = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", beiTaste);
      document.body.style.overflow = vorher;
    };
  }, [offen, onSchliessen]);

  if (!offen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-schrift/40 p-4"
      onMouseDown={(ereignis) => {
        if (ereignis.target === ereignis.currentTarget) {
          onSchliessen();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titel}
        className={cn(
          "w-full max-w-lg rounded-karte-gross border border-linie bg-flaeche p-5 shadow-karte",
          className,
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          {titel ? (
            <h2 className="text-base font-semibold text-schrift">{titel}</h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onSchliessen}
            aria-label={dict.common.schliessen}
            className="rounded-full p-1 text-schrift-tertiaer transition hover:bg-schrift/5 hover:text-schrift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-akzent/50"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              className="h-5 w-5"
            >
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>
        <div className="text-sm text-schrift-sekundaer">{children}</div>
        {fussbereich ? (
          <div className="mt-5 flex justify-end gap-2">{fussbereich}</div>
        ) : null}
      </div>
    </div>
  );
}
