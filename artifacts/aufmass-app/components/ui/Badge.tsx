// Basis-Badge (Pill) des Design-Systems „Technical-Clean" (siehe
// replit.md). Statusfarben: Text auf zugehöriger heller Fläche.
import type { HTMLAttributes } from "react";
import { cn } from "./hilfen";

type Variante = "neutral" | "akzent" | "ok" | "warnung" | "fehler";

const varianten: Record<Variante, string> = {
  neutral: "border border-linie bg-hintergrund text-schrift-sekundaer",
  akzent: "bg-akzent/10 text-akzent",
  ok: "bg-ok-flaeche text-ok",
  warnung: "bg-warnung-flaeche text-warnung",
  fehler: "bg-fehler-flaeche text-fehler",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variante?: Variante;
}

export function Badge({
  variante = "neutral",
  className,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        varianten[variante],
        className,
      )}
      {...rest}
    />
  );
}
