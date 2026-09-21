"use client";

import { Component, useEffect, useMemo, useRef, useState } from "react";
import type {
  CSSProperties,
  ErrorInfo,
  MouseEvent as ReactMouseEvent,
  ReactNode,
} from "react";
import type {
  ViewerCard,
  CardRow,
  TradeFilter,
  MinimalMeasurement,
} from "@/lib/viewer-next/viewerCards";
import { toggleTallyItem, type TallyItem } from "@/lib/viewer-next/calc";
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
import type { DerivedMeasurement } from "@workspace/measurement";
import {
  createMeasureLine,
  findSelectableElement,
  type MeasureLine,
  type SnapResult,
} from "@/lib/viewer-next/interaction";
import { ViewerViewport, type ViewerViewportHandle } from "./ViewerViewport";
import { presentViewerWarnings } from "./warningPresentation";
import { CalcBubble } from "./CalcBubble";
import { viewerTokenStyles } from "@/lib/viewer-next/tokens";

export const DEFAULT_SHOW_DIMENSIONS = true;

function emptyViewerModel(
  note: string,
  diagnostics: readonly ModelDiagnostic[] = [],
): ViewerModel {
  const origin = { x: 0, y: 0, z: 0 };
  const bounds = {
    min: origin,
    max: origin,
    widthMm: 0,
    depthMm: 0,
    heightMm: 0,
  };
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
      length: null,
      depth: null,
      eaveHeight: null,
    },
    diagnostics,
    notes: [note],
  };
}

function safeBuildModel(
  measurement: MinimalMeasurement,
  derived: DerivedMeasurement,
): ViewerModel {
  try {
    return buildModel(measurement as unknown as ViewerMeasurement, derived);
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

class ViewportErrorBoundary extends Component<
  ViewportBoundaryProps,
  ViewportBoundaryState
> {
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
        <div
          className="viewer-next-viewport relative flex min-h-0 min-w-0 flex-1 items-center justify-center px-8 text-center text-sm text-schrift-sekundaer"
          data-webgl-state="unavailable"
        >
          {this.props.message}
        </div>
      );
    }
    return this.props.children;
  }
}

export function filterCards(
  cards: ViewerCard[],
  filter: TradeFilter,
): ViewerCard[] {
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
        const nested = row.subRows
          ? visit(row.subRows, [...parents, row.id])
          : null;
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
  const isVisible = filterCards(cards, filter).some(
    (card) => card.id === path.cardId,
  );
  return { ...path, filter: isVisible ? filter : "all" };
}

export function ViewerNextClient({
  measurement,
  derived,
  cards,
  dict,
  webglMessage,
  projectName,
  projectAddress,
}: {
  measurement: MinimalMeasurement;
  derived: DerivedMeasurement;
  cards: ViewerCard[];
  dict: Dictionary["viewerNext"];
  webglMessage?: string;
  projectName?: string;
  projectAddress?: string | null;
}) {
  const [filter, setFilter] = useState<TradeFilter>("all");
  const [openCards, setOpenCards] = useState<Set<string>>(new Set());
  const [openRows, setOpenRows] = useState<Set<string>>(new Set());
  const [layoutMode, setLayoutMode] = useState<"split" | "model">("split");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showConditions, setShowConditions] = useState(false);
  const [showDimensions, setShowDimensions] = useState(DEFAULT_SHOW_DIMENSIONS);
  const [measureArmed, setMeasureArmed] = useState(false);
  const [measureStart, setMeasureStart] = useState<Point3 | null>(null);
  const [measureLines, setMeasureLines] = useState<MeasureLine[]>([]);
  const [snapPreview, setSnapPreview] = useState<SnapResult | null>(null);
  const [gestureHintVisible, setGestureHintVisible] = useState(true);
  const [tallyItems, setTallyItems] = useState<TallyItem[]>([]);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const viewportRef = useRef<ViewerViewportHandle>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const visibleCards = filterCards(cards, filter);
  const model = useMemo(() => safeBuildModel(measurement, derived), [measurement, derived]);

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

  useEffect(() => {
    setOpenCards(new Set(cards.map((c) => c.id)));
  }, [cards]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setGestureHintVisible(false), 4500);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!copyNotice) return;
    const timeout = window.setTimeout(() => setCopyNotice(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [copyNotice]);

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
      else if (item.bottom > bounds.bottom)
        scroller.scrollTop += item.bottom - bounds.bottom;
    });
    return () => cancelAnimationFrame(frame);
  }, [cards, filter, selectedId]);

  const selectElement = (id: string | null, focus = false) => {
    setSelectedId(id);
    if (model.conditions.some(condition => condition.id === id)) setShowConditions(true);
    if (!id || !focus) return;
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
    setMeasureLines((previous) => [
      ...previous,
      createMeasureLine(measureStart, point),
    ]);
    setMeasureStart(null);
    setSnapPreview(null);
  };

  const clearMeasureLines = () => {
    setMeasureLines([]);
    setMeasureStart(null);
    setSnapPreview(null);
  };

  const handleRowSelect = (row: CardRow) => {
    if (row.cta) {
      setCopyNotice(projectName === undefined ? dict.labels.photoCaptureUnavailable : dict.labels.projectPhotoCaptureUnavailable);
      return;
    }
    if (!findSelectableElement(model, row.id)) return;
    selectElement(row.id, true);
  };

  const toggleTally = (row: CardRow) => {
    if (!row.tally) return;
    const tally = row.tally;
    setTallyItems((previous) =>
      toggleTallyItem(previous, {
        id: row.id,
        label: row.label,
        value: tally.value,
        unit: tally.unit,
        semanticClass: tally.semanticClass,
      }),
    );
  };

  const copyRow = async (row: CardRow) => {
    if (!row.value || row.value === "—") return;
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(
        `${row.label}: ${row.value}${row.unit ? ` ${row.unit}` : ""}`,
      );
      setCopyNotice(dict.labels.copySuccess.replace("{label}", row.label));
    } catch {
      setCopyNotice(dict.labels.copyFailed);
    }
  };

  const warnings = presentViewerWarnings(
    measurement.quality?.warnings ?? [],
    model.diagnostics,
    model.notes,
    dict.labels,
  );
  const modelState = model.diagnostics.some(
    (diagnostic) => diagnostic.category === "model_failure",
  )
    ? "notready"
    : "ready";
  const viewportMessage =
    modelState === "notready"
      ? dict.labels.modelFailure
      : (webglMessage ??
        "The 3D view could not be started. Measurements remain available in the panel.");
  const references = measurement.references ?? [];
  const headerProjectName = projectName ?? dict.demoProject;
  const headerSubtitle = projectName === undefined
    ? dict.labels.modelReady
    : projectAddress?.trim() || dict.labels.projectModelReady;
  const clearButton =
    measureLines.length > 0 ? (
      <button
        type="button"
        data-control="measure-clear"
        aria-label={dict.labels.clear}
        onClick={clearMeasureLines}
        className="viewer-next-clear flex min-h-11 items-center rounded-full px-3 text-xs font-semibold"
      >
        {dict.labels.clear}
      </button>
    ) : null;

  return (
    <div
      className="viewer-next-shell h-[100dvh] w-full overflow-hidden bg-hintergrund font-sans text-schrift"
      data-layout-mode={layoutMode}
      style={viewerTokenStyles as CSSProperties}
    >
      <div className="viewer-next-model-section relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="viewer-next-header flex min-h-[56px] flex-none items-center gap-2 border-b border-linie bg-flaeche px-4 py-2">
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <div className="truncate text-sm font-semibold">{headerProjectName}</div>
            <div className="font-mono text-xs text-schrift-sekundaer">
              {headerSubtitle}
            </div>
          </div>
          <Button className="viewer-next-add-photo whitespace-nowrap" variante="sekundaer" groesse="klein" onClick={() => setCopyNotice(projectName === undefined ? dict.labels.photoCaptureUnavailable : dict.labels.projectPhotoCaptureUnavailable)}>
            {"+ "}
            {dict.labels.addPhoto}
          </Button>
          <Button
            variante="sekundaer"
            groesse="klein"
            data-control="reset"
            className="viewer-next-header-control min-h-11 text-akzent"
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
            onClick={() => setShowConditions((value) => !value)}
            className="viewer-next-header-control viewer-next-hover flex min-h-11 cursor-pointer select-none items-center gap-2 whitespace-nowrap rounded-lg px-2 text-left"
          >
            <span className="text-xs font-medium text-schrift-sekundaer">
              {dict.labels.showConditions}
            </span>
            <span
              className={cn(
                "flex h-5 w-9 rounded-full p-0.5 transition-colors",
                showConditions ? "bg-akzent" : "bg-linie",
              )}
            >
              <span
                className={cn(
                  "viewer-next-toggle-knob h-4 w-4 rounded-full shadow transition-transform",
                  showConditions && "translate-x-4",
                )}
              />
            </span>
          </button>
          <button
            type="button"
            data-control="dimensions"
            aria-pressed={showDimensions}
            onClick={() => setShowDimensions((value) => !value)}
            className="viewer-next-header-control viewer-next-hover flex min-h-11 cursor-pointer select-none items-center gap-2 whitespace-nowrap rounded-lg px-2 text-left"
          >
            <span className="text-xs font-medium text-schrift-sekundaer">
              {dict.labels.showDimensions}
            </span>
            <span
              className={cn(
                "flex h-5 w-9 rounded-full p-0.5 transition-colors",
                showDimensions ? "bg-akzent" : "bg-linie",
              )}
            >
              <span
                className={cn(
                  "viewer-next-toggle-knob h-4 w-4 rounded-full shadow transition-transform",
                  showDimensions && "translate-x-4",
                )}
              />
            </span>
          </button>
        </div>

        <div
          className="viewer-next-stage relative flex min-h-0 flex-1"
          onPointerUp={() => setGestureHintVisible(false)}
          onWheel={() => setGestureHintVisible(false)}
        >
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
              showDimensions={showDimensions}
              webglMessage={viewportMessage}
              layoutMode={layoutMode}
              modelState={modelState}
            />
          </ViewportErrorBoundary>

          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center">
            {snapPreview && (
              <span className="viewer-next-snap-label mt-3 rounded-full border border-akzent px-3 py-1 font-mono text-xs font-semibold text-akzent shadow-karte">
                {snapPreview.targetKind === "corner"
                  ? "corner snap"
                  : "edge snap"}
              </span>
            )}
          </div>

          <CalcBubble
            items={tallyItems}
            dict={dict}
            onRemove={(id) =>
              setTallyItems((previous) =>
                previous.filter((item) => item.id !== id),
              )
            }
            onClear={() => setTallyItems([])}
          />
           {(copyNotice || (showConditions && !(measurement.condition_areas?.length))) && (
            <div
              role="status"
              className="viewer-next-toast pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full px-4 py-2 text-xs font-semibold shadow-karte"
            >
               {copyNotice ?? dict.labels.noConditions}
            </div>
          )}

          <div className="viewer-next-mobile-controls absolute right-3 top-3 z-10 flex flex-col gap-2">
            <button
              type="button"
              data-control="measure"
              aria-pressed={measureArmed}
              aria-label={dict.labels.measureLine}
              title={dict.labels.measureLine}
              onClick={() => setMeasureArmed((value) => !value)}
              className={cn(
                "viewer-next-round-control",
                measureArmed && "is-active",
              )}
            >
              <RulerIcon />
            </button>
            <button
              type="button"
              data-control="conditions-mobile"
              aria-label={dict.labels.showConditions}
              title={dict.labels.showConditions}
              aria-pressed={showConditions}
              onClick={() => setShowConditions((value) => !value)}
              className={cn("viewer-next-round-control", showConditions && "is-active")}
            >
              <ConditionsIcon />
            </button>
            <button
              type="button"
              data-control="reset-mobile"
              aria-label={dict.labels.resetView}
              title={dict.labels.resetView}
              onClick={() => {
                viewportRef.current?.resetView();
                selectElement(null);
              }}
              className="viewer-next-round-control"
            >
              <ResetIcon />
            </button>
            <button
              type="button"
              data-control="dimensions-mobile"
              aria-label={dict.labels.showDimensions}
              title={dict.labels.showDimensions}
              aria-pressed={showDimensions}
              onClick={() => setShowDimensions((value) => !value)}
              className={cn("viewer-next-round-control", showDimensions && "is-active")}
            >
              <DimensionsIcon />
            </button>
            {measureLines.length > 0 && (
              <button
                type="button"
                data-control="measure-clear-mobile"
                aria-label={dict.labels.clear}
                title={dict.labels.clear}
                onClick={clearMeasureLines}
                className="viewer-next-round-control viewer-next-clear"
              >
                ×
              </button>
            )}
          </div>

          <div className="viewer-next-measure-wide absolute right-4 top-4 z-10 hidden items-center gap-1 rounded-full border border-linie bg-flaeche p-1 shadow-karte">
            <button
              type="button"
              data-control="measure"
              aria-pressed={measureArmed}
              onClick={() => setMeasureArmed((value) => !value)}
              className={cn(
                "viewer-next-hover min-h-11 rounded-full px-3 text-xs font-semibold text-schrift-sekundaer transition-colors",
                measureArmed && "is-active",
              )}
            >
              {dict.labels.measureLine}
            </button>
            {clearButton}
          </div>

          {gestureHintVisible && (
            <div className="viewer-next-gesture pointer-events-none absolute left-3 top-3 z-10 rounded-lg border-2 border-linie px-2.5 py-1.5 font-mono text-xs font-medium text-schrift">
              {dict.labels.dragOrbit}
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        data-testid="button-toggle-viewer-layout"
        className="viewer-next-layout-toggle z-30 min-h-11 w-full border-y border-linie text-xs font-semibold"
        aria-expanded={layoutMode === "split"}
        onClick={() => setLayoutMode((mode) => mode === "split" ? "model" : "split")}
      >
        {layoutMode === "split"
          ? dict.labels.showFullModel
          : dict.labels.showMeasurements}
      </button>

      <div
        className="viewer-next-panel z-20 flex min-h-0 flex-col bg-hintergrund border-t border-linie"
      >
        <div className="viewer-next-panel-heading flex flex-none flex-col gap-2.5 border-b border-linie px-4 py-3.5 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="text-base font-bold">{dict.measurements}</div>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {(["all", "roofing", "siding", "painting"] as TradeFilter[]).map(
              (f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "min-h-11 rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition-colors",
                    filter === f
                      ? "viewer-next-filter-active"
                      : "viewer-next-hover border border-linie bg-flaeche text-schrift-sekundaer",
                  )}
                >
                  {dict.filters[f]}
                </button>
              ),
            )}
          </div>
        </div>

        <div
          data-viewer-panel-scroll
          className="flex flex-1 flex-col gap-3 overflow-y-auto px-3.5 py-3.5 pb-10"
        >
          {visibleCards.map((card) => {
            const isExpanded = openCards.has(card.id);
            return (
              <div
                key={card.id}
                className={cn(
                  "flex-none overflow-hidden rounded-[14px] border border-l-[3px] border-linie bg-flaeche shadow-sm",
                  card.accentClass,
                )}
              >
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  aria-controls={`card-${card.id}`}
                  onClick={() => toggleCard(card.id)}
                  className="viewer-next-hover flex w-full cursor-pointer select-none items-center gap-3 px-3.5 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-akzent focus-visible:ring-inset"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-xs font-semibold tracking-wider text-schrift-sekundaer">
                        {card.title}
                      </div>
                      {card.badge && (
                        <Badge variante="akzent" className="text-xs">
                          {card.badge}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-mono text-[26px] font-semibold text-schrift">
                        {card.hero}
                      </span>
                      <span className="font-mono text-[17px] font-semibold text-schrift-sekundaer">
                        {card.heroUnit}
                      </span>
                      {card.hero2 && (
                        <span className="font-mono text-[17px] font-semibold text-schrift-sekundaer">
                          · {card.hero2}
                        </span>
                      )}
                    </div>
                    {card.sub && (
                      <div className="text-xs text-schrift-sekundaer">
                        {card.sub}
                      </div>
                    )}
                    {card.sourceBadge && (
                      <span className="viewer-next-muted-surface w-fit rounded-full px-2 py-0.5 text-xs font-medium text-schrift-sekundaer">
                        {card.sourceBadge}
                      </span>
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-schrift-sekundaer transition-transform",
                      isExpanded && "rotate-180",
                    )}
                  >
                    ▾
                  </span>
                </button>

                {isExpanded && card.rows.length > 0 && (
                  <div
                    id={`card-${card.id}`}
                    className="border-t border-linie pb-1.5 pt-1"
                  >
                    {card.rows.map((row) => (
                      <RowItem
                        key={row.id}
                        row={row}
                        isOpen={openRows.has(row.id)}
                        toggleRow={toggleRow}
                        openRows={openRows}
                        selectedId={selectedId}
                        onSelect={handleRowSelect}
                        onCopy={copyRow}
                        onTally={toggleTally}
                        tallyItems={tallyItems}
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
              <div className="viewer-next-quality-warning flex flex-col gap-2 rounded-lg p-3">
                <div className="font-semibold">{dict.warnings}</div>
                <ul className="list-inside list-disc pl-2">
                  {warnings.map((w: string, i: number) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <div className="font-semibold text-schrift">
                {dict.references}
              </div>
              {references.map((r, i) => (
                <div key={i}>
                  {r.photo_index ? `${dict.photo} ${r.photo_index}: ` : ""}
                  {r.scale_type === "own_reference"
                    ? `${dict.referenceObject} (${r.object})`
                    : r.scale_type === "transferred"
                      ? `${dict.transferredVia} ${r.transferred_via}`
                      : dict.noScale}
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

// All four control glyphs: proposed — not derived from reference.
// A 22px SVG with a 2px rounded stroke stays readable in the existing 44px circle.
function RulerIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="7" width="18" height="10" rx="1.5" />
      <path d="M7 7v4m5-4v6m5-6v4" />
    </svg>
  );
}

function ConditionsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 2.5 20h19L12 3Z" />
      <path d="M12 9v4" />
      <circle cx="12" cy="16.5" r=".75" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4v6h6M3.5 10a8 8 0 1 1 1 7" />
    </svg>
  );
}

function DimensionsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7v10M20 7v10M4 12h16" />
      <path d="m8 9-4 3 4 3m8-6 4 3-4 3" />
    </svg>
  );
}

function RowItem({
  row,
  isOpen,
  toggleRow,
  openRows,
  selectedId,
  onSelect,
  onCopy,
  onTally,
  tallyItems,
  registerRow,
  dict,
}: {
  row: CardRow;
  isOpen: boolean;
  toggleRow: (id: string) => void;
  openRows: Set<string>;
  selectedId: string | null;
  onSelect: (row: CardRow) => void;
  onCopy: (row: CardRow) => void;
  onTally: (row: CardRow) => void;
  tallyItems: readonly TallyItem[];
  registerRow: (id: string, node: HTMLDivElement | null) => void;
  dict: Dictionary["viewerNext"];
}) {
  const isExpandable =
    row.hasSub ||
    row.hasCalc ||
    (row.subRows && row.subRows.length > 0) ||
    (row.calcLines && row.calcLines.length > 0);
  const rowContents = (
    <>
      <div className="viewer-next-row-label flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[15px] font-medium leading-tight text-schrift">
            {row.label}
          </span>
          {row.badge && (
            <Badge className="whitespace-nowrap text-xs">{row.badge}</Badge>
          )}
        </div>
        {row.sub && (
          <span className="text-xs font-medium text-schrift-tertiaer">{row.sub}</span>
        )}
      </div>
      {row.value2 && (
        <span className="w-12 flex-none whitespace-nowrap text-right font-mono text-[17px] font-semibold text-schrift-tertiaer">
          {row.value2}
        </span>
      )}
      {row.cta && (
        <span className="viewer-next-accent-surface flex min-h-11 items-center whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold text-akzent">
          {row.cta}
        </span>
      )}
        <span className="viewer-next-row-value flex flex-none items-baseline justify-end text-right">
          <span className="font-mono text-[17px] font-semibold text-schrift">
            {row.value ?? "—"}
          </span>
          {row.unit && (
            <span className="ml-1 font-mono text-[17px] font-semibold text-schrift-tertiaer">
              {row.unit}
            </span>
          )}
        </span>
      {isExpandable && (
        <span
          className={cn(
            "w-[18px] text-center text-schrift-sekundaer transition-transform",
            isOpen && "rotate-180",
          )}
        >
          ▾
        </span>
      )}
    </>
  );

  const rowIsSelected = selectedId === row.id;
  const isCopyable = !row.cta && row.value !== undefined && row.value !== "—";
  const isTallyable = !row.cta && row.tally !== undefined;
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
        className={cn(
          "group flex min-h-11 flex-wrap items-center justify-between",
          rowIsSelected && "viewer-next-selected-row ring-1 ring-inset ring-akzent/30",
        )}
      >
        {isExpandable ? (
          <button
            type="button"
            aria-expanded={isOpen}
            aria-controls={`row-${row.id}`}
            onClick={handleClick}
            className="flex min-h-11 min-w-0 flex-1 cursor-pointer flex-wrap items-center gap-2 px-3.5 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-akzent focus-visible:ring-inset"
          >
            {rowContents}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleClick}
            className="flex min-h-11 min-w-0 flex-1 flex-wrap items-center gap-2 px-3.5 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-akzent focus-visible:ring-inset"
          >
            {rowContents}
          </button>
        )}
        <div className="flex items-center justify-center">
          <button
            type="button"
            disabled={!isCopyable}
            aria-label={dict.labels.copy}
            onClick={(event) => {
              event.stopPropagation();
              void onCopy(row);
            }}
            className="viewer-next-icon-button flex h-11 w-11 items-center justify-center rounded text-[14px] text-schrift-sekundaer disabled:cursor-not-allowed disabled:opacity-40"
            title={dict.labels.copy}
          >
            ⧉
          </button>
          {!row.cta && (
            <button
              type="button"
              disabled={!isTallyable}
              aria-pressed={tallyItems.some(item => item.id === row.id)}
              aria-label={dict.labels.tally}
              onClick={(event) => {
                event.stopPropagation();
                onTally(row);
              }}
              className="viewer-next-icon-button flex h-11 w-11 items-center justify-center rounded text-[14px] text-schrift-sekundaer disabled:cursor-not-allowed disabled:opacity-40"
              title={dict.labels.tally}
            >
              Σ
            </button>
          )}
        </div>
      </div>

      {isOpen && row.calcLines && row.calcLines.length > 0 && (
        <div
          id={`row-${row.id}`}
          className="viewer-next-muted-surface mb-2 ml-7 mr-3.5 mt-0.5 flex flex-col gap-0.5 rounded-[10px] border border-linie p-2"
        >
          {row.calcLines.map((line, i) => (
            <div key={i} className="flex min-h-[34px] items-center gap-3">
              <span className="flex-1 text-[13px] text-schrift-sekundaer">
                {line.label}
              </span>
              <span className="w-[62px] flex-none text-right font-mono text-[17px] font-semibold text-schrift">
                {line.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {isOpen && row.subRows && row.subRows.length > 0 && (
        <div
          id={`row-${row.id}`}
          className="viewer-next-muted-surface border-y border-linie py-1"
        >
          {row.subRows.map((sr) => (
            <RowItem
              key={sr.id}
              row={sr}
              isOpen={openRows.has(sr.id)}
              toggleRow={toggleRow}
              openRows={openRows}
              selectedId={selectedId}
              onSelect={onSelect}
              onCopy={onCopy}
              onTally={onTally}
              tallyItems={tallyItems}
              registerRow={registerRow}
              dict={dict}
            />
          ))}
        </div>
      )}
    </div>
  );
}
