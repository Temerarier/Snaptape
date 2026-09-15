"use client";

import { useState, useEffect } from "react";
import type { ViewerCard, CardRow, TradeFilter, MinimalMeasurement } from "@/lib/viewer-next/viewerCards";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/hilfen";
import type { Dictionary } from "@/i18n/en-US";

export function filterCards(cards: ViewerCard[], filter: TradeFilter): ViewerCard[] {
  if (filter === "all") return cards;
  const allowed = {
    roofing: ["roof_area", "roof_edges", "penetrations", "gutters", "height"],
    siding: ["walls", "openings", "trim", "height"],
    painting: ["walls", "openings", "trim", "condition_areas"],
  }[filter];
  return cards.filter((c) => allowed.includes(c.id));
}

export function ViewerNextClient({ measurement, cards, dict }: { measurement: MinimalMeasurement; cards: ViewerCard[]; dict: Dictionary["viewerNext"] }) {
  const [filter, setFilter] = useState<TradeFilter>("all");
  const [openCards, setOpenCards] = useState<Set<string>>(new Set());
  const [openRows, setOpenRows] = useState<Set<string>>(new Set());
  const [statusOpen, setStatusOpen] = useState(false);
  const [sheetDetent, setSheetDetent] = useState<"peek" | "half" | "full">("half");

  const visibleCards = filterCards(cards, filter);

  const toggleCard = (id: string) => {
    setOpenCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const cycleSheet = () => {
    setSheetDetent((prev) => (prev === "peek" ? "half" : prev === "half" ? "full" : "peek"));
  };

  // Initially open all cards for testing layout, or leave closed?
  // Let's initially open them all
  useEffect(() => {
    setOpenCards(new Set(cards.map((c) => c.id)));
  }, []);

  const warnings = measurement.quality?.warnings ?? [];
  const references = measurement.references ?? [];
  const projectName = dict.demoProject;

  return (
    <div className="viewer-next-shell flex h-[100dvh] w-full flex-col overflow-hidden bg-hintergrund font-sans text-schrift">
      {/* Viewport Placeholder */}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#FAFBFC]">
        {/* Header Toolbar (Desktop/Tablet Landscape) */}
        <div className="hidden min-h-[56px] flex-none flex-wrap items-center gap-2 border-b border-linie bg-flaeche px-4 py-2 md:flex">
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <div className="truncate text-sm font-semibold">{projectName}</div>
            <div className="font-mono text-xs text-schrift-sekundaer">{dict.labels.modelReady}</div>
          </div>
          <Button variante="sekundaer" groesse="klein">+ {dict.labels.addPhoto}</Button>
          <Button variante="sekundaer" groesse="klein" className="text-akzent">{dict.labels.resetView}</Button>
          <label className="flex cursor-pointer select-none items-center gap-2 whitespace-nowrap">
            <span className="text-xs font-medium text-schrift-sekundaer">{dict.labels.showConditions}</span>
            <input type="checkbox" className="hidden" readOnly />
            <div className="h-5 w-9 rounded-full bg-linie p-0.5 transition-colors">
              <div className="h-4 w-4 rounded-full bg-white shadow transition-transform" />
            </div>
          </label>
        </div>

        {/* 3D Placeholder Area */}
        <div className="flex-1 bg-[#FAFBFC] relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-3xl font-bold text-slate-300">{dict.labels.viewportPlaceholder}</div>
               <div className="text-sm text-slate-400">{dict.labels.placeholder}</div>
            </div>
          </div>

          {/* Phone: Floating round controls */}
          <div className="absolute right-4 top-4 z-10 flex flex-col items-end gap-2 md:hidden">
             <button aria-label={dict.labels.measureLine} className="flex h-[44px] w-[44px] items-center justify-center rounded-full bg-flaeche shadow-karte">M</button>
             <button aria-label={dict.labels.resetView} className="flex h-[44px] w-[44px] items-center justify-center rounded-full bg-flaeche shadow-karte">R</button>
             <button aria-label={dict.labels.showConditions} className="flex h-[44px] w-[44px] items-center justify-center rounded-full bg-flaeche shadow-karte">C</button>
          </div>

          {/* Tablet Portrait: Measure pill top-right */}
          <div className="viewer-next-measure-portrait absolute right-4 top-4 z-10 hidden items-center gap-1 rounded-full border border-linie bg-flaeche p-1 shadow-karte">
            <button className="rounded-full px-3 py-1.5 text-xs font-semibold text-schrift-sekundaer transition-colors hover:bg-slate-100">{dict.labels.measureLine}</button>
          </div>

          {/* Desktop/Tablet Landscape: Measure pill bottom-center */}
          <div className="viewer-next-measure-wide absolute bottom-4 left-1/2 z-10 hidden -translate-x-1/2 items-center gap-1 rounded-full border border-linie bg-flaeche p-1 shadow-karte">
            <button className="rounded-full px-3 py-1.5 text-xs font-semibold text-schrift-sekundaer transition-colors hover:bg-slate-100">{dict.labels.measureLine}</button>
          </div>

          <div className="viewer-next-gesture pointer-events-none absolute left-4 top-4 z-10 rounded-lg border-2 border-linie bg-white/95 px-2.5 py-1.5 font-mono text-xs font-medium text-schrift">
            {dict.labels.dragOrbit}
          </div>
        </div>
      </div>

      {/* Measurement Panel */}
      <div
        className={cn(
          "viewer-next-panel absolute inset-x-0 bottom-0 z-20 flex h-[100dvh] flex-col bg-hintergrund shadow-[0_-8px_30px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-in-out",
          "translate-y-[48%]",
          sheetDetent === "peek" && "max-md:translate-y-[calc(100%-128px)]",
          sheetDetent === "half" && "max-md:translate-y-[48%]",
          sheetDetent === "full" && "max-md:translate-y-[12%]"
        )}
      >
        {/* Mobile Drag Handle */}
        <button
          type="button"
          aria-label={dict.labels.changePanelHeight}
          onClick={cycleSheet}
          className="flex h-11 cursor-grab items-center justify-center md:hidden"
        >
          <div className="h-1.5 w-12 rounded-full bg-slate-300" />
        </button>

        {/* Panel Header */}
        <div className="flex flex-none flex-col gap-2.5 border-b border-linie px-4 py-3.5 pb-2.5">
          <div className="flex items-center gap-2">
             <div className="text-base font-bold">{dict.measurements}</div>
          </div>
          <button
            type="button"
            aria-expanded={statusOpen}
            aria-controls="viewer-quality-status"
            onClick={() => setStatusOpen(open => !open)}
            className="flex min-h-11 items-center justify-between rounded-lg text-left text-xs text-schrift-sekundaer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-akzent"
          >
            <span>{references.length} {dict.references.toLowerCase()} · {warnings.length} {dict.warnings.toLowerCase()}</span>
            <span className={cn("transition-transform", statusOpen && "rotate-180")}>▾</span>
          </button>
          {statusOpen && (
            <div id="viewer-quality-status" className="max-h-36 overflow-y-auto rounded-lg border border-linie bg-flaeche p-3 text-xs text-schrift-sekundaer">
              <div>{warnings.length > 0 ? dict.labels.warningsRequireReview : dict.labels.noWarnings}</div>
              <div>{references.length > 0 ? dict.labels.referencesUsed : dict.labels.noReferences}</div>
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {(["all", "roofing", "siding", "painting"] as TradeFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "min-h-11 rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition-colors",
                  filter === f ? "bg-schrift text-white" : "bg-flaeche border border-linie text-schrift-sekundaer hover:bg-slate-50"
                )}
              >
                {dict.filters[f]}
              </button>
            ))}
          </div>
        </div>

        {/* Panel Body */}
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-3.5 py-3.5 pb-10">
          {visibleCards.map((card) => {
            const isExpanded = openCards.has(card.id);
            return (
              <div key={card.id} className={cn("flex-none overflow-hidden rounded-[14px] border border-l-[3px] border-linie bg-flaeche shadow-sm", card.accentClass)}>
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  aria-controls={`card-${card.id}`}
                  onClick={() => toggleCard(card.id)}
                  className="flex w-full cursor-pointer select-none items-center gap-3 px-3.5 py-3 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-akzent focus-visible:ring-inset"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="text-xs font-semibold tracking-wider text-schrift-sekundaer">{card.title}</div>
                      {card.badge && <Badge variante="akzent" className="text-xs">{card.badge}</Badge>}
                    </div>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-mono text-[25px] font-semibold text-schrift">{card.hero}</span>
                      <span className="font-mono text-[13px] text-schrift-sekundaer">{card.heroUnit}</span>
                      {card.hero2 && <span className="font-mono text-[15px] font-medium text-schrift-sekundaer">· {card.hero2}</span>}
                    </div>
                    {card.sub && <div className="text-xs text-schrift-sekundaer">{card.sub}</div>}
                  </div>
                  <span className={cn("text-schrift-sekundaer transition-transform", isExpanded && "rotate-180")}>▾</span>
                </button>

                {isExpanded && card.rows.length > 0 && (
                  <div id={`card-${card.id}`} className="border-t border-linie pb-1.5 pt-1">
                    {card.rows.map((row) => (
                      <RowItem key={row.id} row={row} isOpen={openRows.has(row.id)} toggleRow={toggleRow} openRows={openRows} dict={dict} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Quality Block */}
          <div className="mt-4 flex flex-col gap-4 text-xs text-schrift-sekundaer">
            {warnings.length > 0 && (
              <div className="flex flex-col gap-2 rounded-lg bg-orange-50 p-3 text-orange-900">
                <div className="font-semibold">{dict.warnings}</div>
                <ul className="list-inside list-disc pl-2">
                  {warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}
            
            <div className="flex flex-col gap-1">
              <div className="font-semibold text-schrift">{dict.references}</div>
              {references.map((r, i) => (
                <div key={i}>
                  {r.photo_index ? `${dict.photo} ${r.photo_index}: ` : ""}
                  {r.scale_type === "own_reference" ? `${dict.referenceObject} (${r.object})` : 
                   r.scale_type === "transferred" ? `${dict.transferredVia} ${r.transferred_via}` : dict.noScale}
                </div>
              ))}
            </div>

            <div className="text-xs leading-relaxed text-schrift-tertiaer">
              {dict.disclaimer}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RowItem({ row, isOpen, toggleRow, openRows, dict }: {
  row: CardRow;
  isOpen: boolean;
  toggleRow: (id: string, e: React.MouseEvent) => void;
  openRows: Set<string>;
  dict: Dictionary["viewerNext"];
}) {
  const isExpandable = row.hasSub || row.hasCalc || (row.subRows && row.subRows.length > 0) || (row.calcLines && row.calcLines.length > 0);

  const rowContents = (
    <>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[15px] font-medium leading-tight text-schrift">{row.label}</span>
          {row.badge && <Badge className="whitespace-nowrap text-xs">{row.badge}</Badge>}
        </div>
        {row.sub && <span className="text-xs font-medium text-slate-500">{row.sub}</span>}
      </div>
      {row.value2 && <span className="w-12 flex-none whitespace-nowrap text-right font-mono text-[15px] font-medium text-slate-500">{row.value2}</span>}
      {row.cta ? (
        <span className="flex min-h-11 items-center rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-akzent whitespace-nowrap">
          {row.cta}
        </span>
      ) : (
        <span className="flex w-[92px] flex-none items-baseline justify-end whitespace-nowrap text-right">
          <span className="font-mono text-[17px] font-semibold text-schrift">{row.value ?? "—"}</span>
          {row.unit && <span className="ml-1 font-mono text-xs font-medium text-slate-500">{row.unit}</span>}
        </span>
      )}
      {isExpandable && (
        <span className={cn("w-[18px] text-center text-schrift-sekundaer transition-transform", isOpen && "rotate-180")}>▾</span>
      )}
    </>
  );

  return (
    <div className="flex flex-col">
      <div className="group flex min-h-11 items-center hover:bg-slate-50">
        {isExpandable ? (
          <button
            type="button"
            aria-expanded={isOpen}
            aria-controls={`row-${row.id}`}
            onClick={(event) => toggleRow(row.id, event)}
            className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2 px-3.5 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-akzent focus-visible:ring-inset"
          >
            {rowContents}
          </button>
        ) : (
          <div className="flex min-h-11 min-w-0 flex-1 items-center gap-2 px-3.5 py-1.5">
            {rowContents}
          </div>
        )}

        {/* Actions Placeholder */}
        <div className="flex opacity-100 items-center justify-center">
          <button disabled aria-label={dict.labels.copy} className="flex h-11 w-11 items-center justify-center rounded text-[14px] text-schrift-sekundaer" title={dict.labels.copy}>⧉</button>
          {!row.cta && <button disabled aria-label={dict.labels.tally} className="flex h-11 w-11 items-center justify-center rounded text-[14px] text-schrift-sekundaer" title={dict.labels.tally}>Σ</button>}
        </div>
      </div>

      {isOpen && row.calcLines && row.calcLines.length > 0 && (
        <div id={`row-${row.id}`} className="mb-2 ml-7 mr-3.5 mt-0.5 flex flex-col gap-0.5 rounded-[10px] border border-linie bg-slate-50 p-2">
          {row.calcLines.map((line, i) => (
            <div key={i} className="flex min-h-[34px] items-center gap-3">
              <span className="flex-1 text-[13px] text-schrift-sekundaer">{line.label}</span>
              <span className="w-[62px] flex-none text-right font-mono text-[17px] font-semibold text-schrift">{line.value}</span>
            </div>
          ))}
        </div>
      )}

      {isOpen && row.subRows && row.subRows.length > 0 && (
        <div id={`row-${row.id}`} className="border-y border-linie bg-slate-50 py-1">
          {row.subRows.map((sr) => (
            <RowItem key={sr.id} row={sr} isOpen={openRows.has(sr.id)} toggleRow={toggleRow} openRows={openRows} dict={dict} />
          ))}
        </div>
      )}
    </div>
  );
}
