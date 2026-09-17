"use client";

import { Component, useEffect, useMemo, useRef, useState } from "react";
import type { ErrorInfo, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import type { ViewerCard, CardRow, TradeFilter, MinimalMeasurement } from "@/lib/viewer-next/viewerCards";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/hilfen";
import type { Dictionary } from "@/i18n/en-US";
import {
  buildModel,
  type ModelDiagnostic,
  type Point3,
  type ViewerMeasurement,
  type ViewerModel,
} from "@/lib/viewer-next/model";
import {
  createMeasureLine,
  findSelectableElement,
  type MeasureLine,
  type SnapResult,
} from "@/lib/viewer-next/interaction";
import { ViewerViewport, type ViewerViewportHandle } from "./ViewerViewport";
import { presentViewerWarnings } from "./warningPresentation";

function emptyViewerModel(note: string, diagnostics: readonly ModelDiagnostic[] = []): ViewerModel {
  const origin = { x: 0, y: 0, z: 0 };
  const bounds = {
    min: origin,
    max: origin,
    widthMm: 0,
    depthMm: 0,
    heightMm: 0,
  };
  const dimension = (kind: "width" | "ridge" | "eave_height") => ({
    kind,
    valueMm: 0,
    label: `0' 0"`,
    segments: [{ start: origin, end: origin }],
  });
  return {
    walls: [],
    roofFaces: [],
    roofs: [],
    edges: [],
    openings: [],
    attachments: [],
    conditions: [],
    massing: [],
    bounds: {
      main: bounds,
      overall: bounds,
      widthMm: 0,
      depthMm: 0,
      heightMm: 0,
      overallWidthMm: 0,
      overallDepthMm: 0,
    },
    permanentDimensions: {
      width: dimension("width"),
      ridge: dimension("ridge"),
      eaveHeight: dimension("eave_height"),
      ridgeAggregate: dimension("ridge"),
    },
    diagnostics,
    notes: [note],
  };
}

function safeBuildModel(measurement: MinimalMeasurement): ViewerModel {
  try {
    return buildModel(measurement as unknown as ViewerMeasurement);
  } catch {
    return emptyViewerModel(
      "The viewport model could not be built; measurements remain available.",
      [{ code: "model_build_failed", category: "model_failure", ids: [] }],
    );
  }
}

interface ViewportBoundaryProps {
  readonly children: ReactNode;
  readonly message: string;
}

interface ViewportBoundaryState {
  readonly failed: boolean;
}

class ViewportErrorBoundary extends Component<ViewportBoundaryProps, ViewportBoundaryState> {
  state: ViewportBoundaryState = { failed: false };

  static getDerivedStateFromError(): ViewportBoundaryState {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // The panel is intentionally outside this boundary. A painter failure is
    // a viewport status, never a route-level failure.
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="viewer-next-viewport relative flex min-h-0 min-w-0 flex-1 items-center justify-center px-8 text-center text-sm text-schrift-sekundaer" data-webgl-state="unavailable">
          {this.props.message}
        </div>
      );
    }
    return this.props.children;
  }
}

export function filterCards(cards: ViewerCard[], filter: TradeFilter): ViewerCard[] {
  if (filter === "all") return cards;
  const allowed = {
    roofing: ["roof_area", "roof_edges", "penetrations", "gutters", "height"],
    siding: ["walls", "openings", "trim", "height"],
    painting: ["walls", "openings", "trim", "condition_areas"],
  }[filter];
  return cards.filter((c) => allowed.includes(c.id));
}

function rowPath(
  cards: ViewerCard[],
  id: string,
): { cardId: string; rowIds: string[] } | null {
  for (const card of cards) {
    const visit = (rows: CardRow[], parents: string[]): string[] | null => {
      for (const row of rows) {
        if (row.id === id) return [...parents, row.id];
        const nested = row.subRows ? visit(row.subRows, [...parents, row.id]) : null;
        if (nested) return nested;
      }
      return null;
    };
    const rowIds = visit(card.rows, []);
    if (rowIds) return { cardId: card.id, rowIds };
  }
  return null;
}

export function revealSelection(
  cards: ViewerCard[],
  selectedId: string,
  filter: TradeFilter,
): { cardId: string; rowIds: string[]; filter: TradeFilter } | null {
  const path = rowPath(cards, selectedId);
  if (!path) return null;
  const isVisible = filterCards(cards, filter).some(card => card.id === path.cardId);
  return { ...path, filter: isVisible ? filter : "all" };
}

export function ViewerNextClient({
  measurement,
  cards,
  dict,
  webglMessage,
}: {
  measurement: MinimalMeasurement;
  cards: ViewerCard[];
  dict: Dictionary["viewerNext"];
  webglMessage?: string;
}) {
  const [filter, setFilter] = useState<TradeFilter>("all");
  const [openCards, setOpenCards] = useState<Set<string>>(new Set());
  const [openRows, setOpenRows] = useState<Set<string>>(new Set());
  const [statusOpen, setStatusOpen] = useState(false);
  const [sheetDetent, setSheetDetent] = useState<"peek" | "half" | "full">("half");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showConditions, setShowConditions] = useState(false);
  const [measureArmed, setMeasureArmed] = useState(false);
  const [measureStart, setMeasureStart] = useState<Point3 | null>(null);
  const [measureLines, setMeasureLines] = useState<MeasureLine[]>([]);
  const [snapPreview, setSnapPreview] = useState<SnapResult | null>(null);
  const viewportRef = useRef<ViewerViewportHandle>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const visibleCards = filterCards(cards, filter);
  const model = useMemo(
    () => safeBuildModel(measurement),
    [measurement],
  );

  const toggleCard = (id: string) => {
    setOpenCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleRow = (id: string) => {
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

  useEffect(() => {
    setOpenCards(new Set(cards.map((c) => c.id)));
  }, [cards]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (measureArmed || measureStart) {
        setMeasureArmed(false);
        setMeasureStart(null);
        setSnapPreview(null);
      }
      if (measureLines.length > 0) setMeasureLines([]);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [measureArmed, measureStart, measureLines.length]);

  useEffect(() => {
    if (!selectedId) return;
    const reveal = revealSelection(cards, selectedId, filter);
    if (!reveal) return;
    if (reveal.filter !== filter) {
      setFilter(reveal.filter);
      return;
    }
    const path = reveal;
    setOpenCards((prev) => new Set(prev).add(path.cardId));
    setOpenRows((prev) => {
      const next = new Set(prev);
      path.rowIds.slice(0, -1).forEach((id) => next.add(id));
      return next;
    });
    const frame = requestAnimationFrame(() => {
      const row = rowRefs.current.get(selectedId);
      const scroller = row?.closest<HTMLElement>("[data-viewer-panel-scroll]");
      if (!row || !scroller) return;
      const item = row.getBoundingClientRect();
      const bounds = scroller.getBoundingClientRect();
      // Scroll only the panel body; scrollIntoView also moves the document
      // to the offscreen portion of the translated phone sheet.
      if (item.top < bounds.top) scroller.scrollTop += item.top - bounds.top;
      else if (item.bottom > bounds.bottom) scroller.scrollTop += item.bottom - bounds.bottom;
    });
    return () => cancelAnimationFrame(frame);
  }, [cards, filter, selectedId]);

  const selectElement = (id: string | null, focus = false) => {
    setSelectedId(id);
    if (!id || !focus) return;
    // The sheet overlays the canvas on touch layouts. A selected row is an
    // explicit request to inspect the model, so reveal the peek detent before
    // focusing; ordinary manual detent cycling remains unchanged.
    if (window.matchMedia("(max-width: 767px)").matches) {
      setSheetDetent("peek");
    }
    viewportRef.current?.focusElement(id);
  };

  const registerRow = (id: string, node: HTMLDivElement | null) => {
    if (node) rowRefs.current.set(id, node);
    else rowRefs.current.delete(id);
  };

  const handleMeasurePoint = (point: Point3) => {
    if (!measureStart) {
      setMeasureStart(point);
      return;
    }
    setMeasureLines((previous) => [...previous, createMeasureLine(measureStart, point)]);
    setMeasureStart(null);
    setSnapPreview(null);
  };

  const clearMeasureLines = () => {
    setMeasureLines([]);
    setMeasureStart(null);
    setSnapPreview(null);
  };

  const handleRowSelect = (row: CardRow) => {
    if (!findSelectableElement(model, row.id)) return;
    selectElement(row.id, true);
  };

  const warnings = presentViewerWarnings(
    measurement.quality?.warnings ?? [],
    model.diagnostics,
    model.notes,
    dict.labels,
  );
  const modelState = model.diagnostics.some(diagnostic => diagnostic.category === "model_failure")
    ? "notready"
    : "ready";
  const viewportMessage = modelState === "notready"
    ? dict.labels.modelFailure
    : (webglMessage ?? "The 3D view could not be started. Measurements remain available in the panel.");
  const references = measurement.references ?? [];
  const projectName = dict.demoProject;
  const clearButton = measureLines.length > 0 ? (
    <button
      type="button"
      data-control="measure-clear"
      aria-label={dict.labels.clear}
      onClick={clearMeasureLines}
      className="flex min-h-11 items-center rounded-full px-3 text-xs font-semibold text-fehler hover:bg-red-50"
    >
      {dict.labels.clear}
    </button>
  ) : null;

  return (
    <div className="viewer-next-shell flex h-[100dvh] w-full flex-col overflow-hidden bg-hintergrund font-sans text-schrift">
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#FAFBFC]">
        <div className="hidden min-h-[56px] flex-none flex-wrap items-center gap-2 border-b border-linie bg-flaeche px-4 py-2 md:flex">
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <div className="truncate text-sm font-semibold">{projectName}</div>
            <div className="font-mono text-xs text-schrift-sekundaer">{dict.labels.modelReady}</div>
          </div>
          <Button variante="sekundaer" groesse="klein">{"+ "}{dict.labels.addPhoto}</Button>
          <Button
            variante="sekundaer"
            groesse="klein"
            data-control="reset"
            className="min-h-11 text-akzent"
            onClick={() => {
              viewportRef.current?.resetView();
              selectElement(null);
            }}
          >
            {dict.labels.resetView}
          </Button>
          <button
            type="button"
            data-control="conditions"
            aria-pressed={showConditions}
            onClick={() => setShowConditions(value => !value)}
            className="flex min-h-11 cursor-pointer select-none items-center gap-2 whitespace-nowrap rounded-lg px-2 text-left hover:bg-slate-50"
          >
            <span className="text-xs font-medium text-schrift-sekundaer">{dict.labels.showConditions}</span>
            <span className={cn("flex h-5 w-9 rounded-full p-0.5 transition-colors", showConditions ? "bg-akzent" : "bg-linie")}>
              <span className={cn("h-4 w-4 rounded-full bg-white shadow transition-transform", showConditions && "translate-x-4")} />
            </span>
          </button>
        </div>

        <div className="relative flex min-h-0 flex-1">
          <ViewportErrorBoundary message={viewportMessage}>
            <ViewerViewport
              ref={viewportRef}
              model={model}
              selectedId={selectedId}
              onSelect={(id) => selectElement(id, false)}
              measureArmed={measureArmed}
              measureLines={measureLines}
              onMeasurePoint={handleMeasurePoint}
              onSnapPreview={setSnapPreview}
              showConditions={showConditions}
              webglMessage={viewportMessage}
              sheetDetent={sheetDetent}
              modelState={modelState}
            />
          </ViewportErrorBoundary>

          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center">
            {snapPreview && (
              <span className="mt-3 rounded-full border border-akzent bg-white px-3 py-1 font-mono text-xs font-semibold text-akzent shadow-karte">
                {snapPreview.targetKind === "corner" ? "corner snap" : "edge snap"}
              </span>
            )}
          </div>

          <div className="absolute right-4 top-4 z-10 flex flex-col items-end gap-2 md:hidden">
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-control="measure"
                aria-pressed={measureArmed}
                aria-label={dict.labels.measureLine}
                onClick={() => setMeasureArmed(value => !value)}
                className={cn("flex h-11 w-11 items-center justify-center rounded-full bg-flaeche text-sm font-bold shadow-karte", measureArmed && "bg-akzent text-white")}
              >
                M
              </button>
              {clearButton}
            </div>
            <button
              type="button"
              data-control="reset"
              aria-label={dict.labels.resetView}
              onClick={() => {
                viewportRef.current?.resetView();
                selectElement(null);
              }}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-flaeche text-sm font-bold shadow-karte"
            >
              ↺
            </button>
            <button
              type="button"
              data-control="conditions"
              aria-pressed={showConditions}
              aria-label={dict.labels.showConditions}
              onClick={() => setShowConditions(value => !value)}
              className={cn("flex h-11 w-11 items-center justify-center rounded-full bg-flaeche text-sm font-bold shadow-karte", showConditions && "bg-akzent text-white")}
            >
              C
            </button>
          </div>

          <div className="viewer-next-measure-portrait absolute right-4 top-4 z-10 hidden items-center gap-1 rounded-full border border-linie bg-flaeche p-1 shadow-karte">
            <button
              type="button"
              data-control="measure"
              aria-pressed={measureArmed}
              onClick={() => setMeasureArmed(value => !value)}
              className={cn("min-h-11 rounded-full px-3 text-xs font-semibold text-schrift-sekundaer transition-colors hover:bg-slate-100", measureArmed && "bg-akzent text-white")}
            >
              {dict.labels.measureLine}
            </button>
            {clearButton}
          </div>

          <div className="viewer-next-measure-wide absolute bottom-4 left-1/2 z-10 hidden -translate-x-1/2 items-center gap-1 rounded-full border border-linie bg-flaeche p-1 shadow-karte">
            <button
              type="button"
              data-control="measure"
              aria-pressed={measureArmed}
              onClick={() => setMeasureArmed(value => !value)}
              className={cn("min-h-11 rounded-full px-3 text-xs font-semibold text-schrift-sekundaer transition-colors hover:bg-slate-100", measureArmed && "bg-akzent text-white")}
            >
              {dict.labels.measureLine}
            </button>
            {clearButton}
          </div>

          <div className="viewer-next-gesture pointer-events-none absolute left-4 top-4 z-10 rounded-lg border-2 border-linie bg-white/95 px-2.5 py-1.5 font-mono text-xs font-medium text-schrift">
            {dict.labels.dragOrbit}
          </div>
        </div>
      </div>

      <div
        className={cn(
          "viewer-next-panel absolute inset-x-0 bottom-0 z-20 flex h-[100dvh] flex-col bg-hintergrund shadow-[0_-8px_30px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-in-out",
          "translate-y-[48%]",
          sheetDetent === "peek" && "max-md:translate-y-[calc(100%-128px)]",
          sheetDetent === "half" && "max-md:translate-y-[48%]",
          sheetDetent === "full" && "max-md:translate-y-[12%]",
        )}
      >
        <button
          type="button"
          aria-label={dict.labels.changePanelHeight}
          onClick={cycleSheet}
          className="flex h-11 cursor-grab items-center justify-center md:hidden"
        >
          <div className="h-1.5 w-12 rounded-full bg-slate-300" />
        </button>

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
                  filter === f ? "bg-schrift text-white" : "border border-linie bg-flaeche text-schrift-sekundaer hover:bg-slate-50",
                )}
              >
                {dict.filters[f]}
              </button>
            ))}
          </div>
        </div>

        <div data-viewer-panel-scroll className="flex flex-1 flex-col gap-3 overflow-y-auto px-3.5 py-3.5 pb-10">
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
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-xs font-semibold tracking-wider text-schrift-sekundaer">{card.title}</div>
                      {card.badge && <Badge variante="akzent" className="text-xs">{card.badge}</Badge>}
                    </div>
                    <div className="flex flex-wrap items-baseline gap-2">
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
                      <RowItem
                        key={row.id}
                        row={row}
                        isOpen={openRows.has(row.id)}
                        toggleRow={toggleRow}
                        openRows={openRows}
                        selectedId={selectedId}
                        onSelect={handleRowSelect}
                        registerRow={registerRow}
                        dict={dict}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

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

function RowItem({
  row,
  isOpen,
  toggleRow,
  openRows,
  selectedId,
  onSelect,
  registerRow,
  dict,
}: {
  row: CardRow;
  isOpen: boolean;
  toggleRow: (id: string) => void;
  openRows: Set<string>;
  selectedId: string | null;
  onSelect: (row: CardRow) => void;
  registerRow: (id: string, node: HTMLDivElement | null) => void;
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
        <span className="flex min-h-11 items-center whitespace-nowrap rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-akzent">
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

  const rowIsSelected = selectedId === row.id;
  const handleClick = (event: ReactMouseEvent) => {
    event.stopPropagation();
    onSelect(row);
    if (isExpandable) toggleRow(row.id);
  };

  return (
    <div className="flex flex-col">
      <div
        ref={(node) => registerRow(row.id, node)}
        data-viewer-row-id={row.id}
        className={cn("group flex min-h-11 items-center", rowIsSelected && "bg-blue-50 ring-1 ring-inset ring-akzent/30")}
      >
        {isExpandable ? (
          <button
            type="button"
            aria-expanded={isOpen}
            aria-controls={`row-${row.id}`}
            onClick={handleClick}
            className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2 px-3.5 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-akzent focus-visible:ring-inset"
          >
            {rowContents}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleClick}
            className="flex min-h-11 min-w-0 flex-1 items-center gap-2 px-3.5 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-akzent focus-visible:ring-inset"
          >
            {rowContents}
          </button>
        )}
        <div className="flex items-center justify-center">
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
            <RowItem
              key={sr.id}
              row={sr}
              isOpen={openRows.has(sr.id)}
              toggleRow={toggleRow}
              openRows={openRows}
              selectedId={selectedId}
              onSelect={onSelect}
              registerRow={registerRow}
              dict={dict}
            />
          ))}
        </div>
      )}
    </div>
  );
}