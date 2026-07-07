// Basis-Eingabefeld des Design-Systems „Technical-Clean" (siehe
// replit.md): 12px Radius, Hairline-Rahmen, Akzent-Fokusring; optional
// Label, Hinweis- und Fehlertext (Texte kommen aus der Sprachdatei des
// Aufrufers, Eiserne Regel 8).
import { useId, type InputHTMLAttributes } from "react";
import { cn } from "./hilfen";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hinweis?: string;
  fehler?: string;
}

export function Input({
  label,
  hinweis,
  fehler,
  className,
  id,
  ...rest
}: InputProps) {
  const autoId = useId();
  const feldId = id ?? autoId;
  const beschreibungId = `${feldId}-beschreibung`;
  const hatBeschreibung = Boolean(fehler || hinweis);

  return (
    <div className="space-y-1.5">
      {label ? (
        <label
          htmlFor={feldId}
          className="block text-sm font-medium text-schrift"
        >
          {label}
        </label>
      ) : null}
      <input
        id={feldId}
        aria-invalid={fehler ? true : undefined}
        aria-describedby={hatBeschreibung ? beschreibungId : undefined}
        className={cn(
          "w-full rounded-eingabe border bg-flaeche px-3 py-2 text-sm text-schrift transition",
          "placeholder:text-schrift-tertiaer",
          "focus:outline-none focus:ring-2",
          fehler
            ? "border-fehler focus:border-fehler focus:ring-fehler/30"
            : "border-linie focus:border-akzent focus:ring-akzent/40",
          "disabled:cursor-not-allowed disabled:bg-hintergrund disabled:opacity-70",
          className,
        )}
        {...rest}
      />
      {fehler ? (
        <p id={beschreibungId} className="text-xs font-medium text-fehler">
          {fehler}
        </p>
      ) : hinweis ? (
        <p id={beschreibungId} className="text-xs text-schrift-tertiaer">
          {hinweis}
        </p>
      ) : null}
    </div>
  );
}
