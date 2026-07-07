// Basis-Karte des Design-Systems „Technical-Clean" (siehe replit.md):
// weiße Fläche, Hairline-Rahmen, Karten-Schatten, 16px Radius und
// 16px Innenabstand (gross: 20px Radius und 20px Innenabstand).
import type { HTMLAttributes } from "react";
import { cn } from "./hilfen";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  gross?: boolean;
}

export function Card({ gross = false, className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        "border border-linie bg-flaeche shadow-karte",
        gross ? "rounded-karte-gross p-5" : "rounded-karte p-4",
        className,
      )}
      {...rest}
    />
  );
}

// Einheitlicher Karten-Titel (IBM Plex Sans, primäre Schriftfarbe).
export function CardTitel({
  className,
  ...rest
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("text-base font-semibold text-schrift", className)}
      {...rest}
    />
  );
}
