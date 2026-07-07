// Basis-Button des Design-Systems „Technical-Clean" (siehe replit.md).
// Varianten: primaer (Akzent + Akzent-Schatten), sekundaer (weiße
// Fläche mit Hairline), leise (nur Text/Hover), gefahr (Fehlerfarbe).
import type { ButtonHTMLAttributes } from "react";
import { cn } from "./hilfen";

type Variante = "primaer" | "sekundaer" | "leise" | "gefahr";
type Groesse = "normal" | "klein";

const basis =
  "inline-flex items-center justify-center gap-2 rounded-eingabe font-medium transition " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-akzent/50 focus-visible:ring-offset-2 " +
  "disabled:pointer-events-none disabled:opacity-50";

const varianten: Record<Variante, string> = {
  primaer: "bg-akzent text-white shadow-akzent hover:bg-akzent/90",
  sekundaer:
    "border border-linie bg-flaeche text-schrift hover:bg-hintergrund",
  leise: "text-schrift-sekundaer hover:bg-schrift/5 hover:text-schrift",
  gefahr: "bg-fehler text-white hover:bg-fehler/90",
};

const groessen: Record<Groesse, string> = {
  normal: "px-4 py-2 text-sm",
  klein: "px-3 py-1.5 text-xs",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  groesse?: Groesse;
}

export function Button({
  variante = "primaer",
  groesse = "normal",
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(basis, varianten[variante], groessen[groesse], className)}
      {...rest}
    />
  );
}
