"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Dictionary } from "@/i18n/en-US";
import { cn } from "@/components/ui/hilfen";
import {
  formatTallyCopy,
  formatTallyValue,
  groupTally,
  type TallyItem,
} from "@/lib/viewer-next/calc";

export function CalcBubble({
  items,
  dict,
  onRemove,
  onClear,
}: {
  items: readonly TallyItem[];
  dict: Dictionary["viewerNext"];
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const [copyState, setCopyState] = useState<"idle" | "success" | "error">(
    "idle",
  );
  const groups = useMemo(() => groupTally(items), [items]);
  const bubbleRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const bubble = bubbleRef.current;
    const stage = bubble?.parentElement;
    const shell = bubble?.closest<HTMLElement>(".viewer-next-shell");
    if (!bubble || !stage || !shell) return;
    const reserveSpace = () => {
      shell.style.setProperty("--viewer-calc-height", `${bubble.offsetHeight}px`);
      const pill = stage.querySelector<HTMLElement>(".viewer-next-measure-wide");
      const stageRect = stage.getBoundingClientRect();
      const pillRect = pill?.getBoundingClientRect();
      if (!pillRect || pillRect.width === 0) return;

      const gap = 12;
      const edge = 12;
      const pillLeft = pillRect.left - stageRect.left;
      const centredMax = Math.max(
        0,
        2 * (pillLeft - gap - stageRect.width / 2),
      );
      if (centredMax >= 240) {
        stage.style.setProperty("--viewer-calc-left", "50%");
        stage.style.setProperty("--viewer-calc-transform", "translateX(-50%)");
        stage.style.setProperty(
          "--viewer-calc-max-width",
          `${Math.min(680, centredMax)}px`,
        );
      } else {
        stage.style.setProperty("--viewer-calc-left", `${edge}px`);
        stage.style.setProperty("--viewer-calc-transform", "none");
        stage.style.setProperty(
          "--viewer-calc-max-width",
          `${Math.max(44, pillLeft - gap - edge)}px`,
        );
      }
    };
    const observer = new ResizeObserver(reserveSpace);
    observer.observe(bubble);
    observer.observe(stage);
    const pill = stage.querySelector<HTMLElement>(".viewer-next-measure-wide");
    if (pill) observer.observe(pill);
    reserveSpace();
    return () => {
      observer.disconnect();
      shell.style.removeProperty("--viewer-calc-height");
      stage.style.removeProperty("--viewer-calc-left");
      stage.style.removeProperty("--viewer-calc-transform");
      stage.style.removeProperty("--viewer-calc-max-width");
    };
  }, [items.length > 0]);
  if (items.length === 0) return null;

  const copy = async () => {
    const text = formatTallyCopy(groups, dict.labels.calcClasses);
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(text);
      setCopyState("success");
    } catch {
      // Do not report success when a browser or permission policy rejected it.
      setCopyState("error");
    }
  };

  return (
    <div
      ref={bubbleRef}
      className="viewer-next-calc-bubble pointer-events-auto z-30 flex flex-col gap-2 rounded-[14px] p-2.5"
      data-calc-bubble
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="whitespace-nowrap text-sm font-semibold">
          {dict.labels.tallySelected.replace("{count}", String(items.length))}
        </span>
        {groups.map((group) => (
          <span
            key={`${group.semanticClass}-${group.unit}`}
            className="whitespace-nowrap font-mono text-[17px] font-semibold tabular-nums"
          >
            {dict.labels.calcClasses[
              group.semanticClass as keyof typeof dict.labels.calcClasses
            ] ?? group.semanticClass}
            {" · "}
            {formatTallyValue(group.value, group.unit)} {group.unit}
          </span>
        ))}
        <span className="flex-1" />
        <button
          type="button"
          onClick={copy}
          className="viewer-next-calc-primary min-h-11 rounded-[10px] px-3.5 text-sm font-semibold"
        >
          {dict.labels.tallyCopy}
        </button>
        <button
          type="button"
          onClick={() => {
            onClear();
            setCopyState("idle");
          }}
          className="viewer-next-calc-secondary min-h-11 rounded-[10px] border-2 bg-transparent px-3.5 text-sm font-semibold"
        >
          {dict.labels.tallyClear}
        </button>
      </div>
      <div className="flex max-h-32 flex-wrap items-center gap-1.5 overflow-y-auto pr-1">
        {items.map((item) => (
          <span
            key={item.id}
            className="viewer-next-calc-chip inline-flex items-center gap-1 rounded-full py-0.5 pl-3 pr-0.5 font-mono text-xs"
          >
            {item.label} {formatTallyValue(item.value, item.unit)} {item.unit}
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              aria-label={`${item.label}: ${dict.labels.removeTally}`}
              className="flex h-11 w-11 items-center justify-center rounded-full"
            >
              <span className="viewer-next-calc-chip-control flex h-5 w-5 items-center justify-center rounded-full text-xs leading-none">
                ×
              </span>
            </button>
          </span>
        ))}
      </div>
      {copyState !== "idle" && (
        <div
          role="status"
          className={cn(
            "text-xs",
            copyState === "error"
              ? "viewer-next-calc-error"
              : "viewer-next-calc-success",
          )}
        >
          {copyState === "error"
            ? dict.labels.tallyCopyFailed
            : dict.labels.tallyCopied}
        </div>
      )}
    </div>
  );
}
