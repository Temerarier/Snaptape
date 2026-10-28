import { cn } from "@/components/ui/hilfen";

export function CreditsPill({ label, guthaben }: { label: string; guthaben: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs font-semibold",
        guthaben > 0
          ? "border-linie bg-flaeche text-schrift"
          : "border-transparent bg-warnung-flaeche text-warnung",
      )}
    >
      {label} {guthaben}
    </span>
  );
}
