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
    if (!bubble || !stage) return;
    const reserveSpace = () => {
      stage.style.setProperty("--viewer-calc-bottom", `${bubble.offsetTop + bubble.offsetHeight + 8}px`);
    };
    const observer = new ResizeObserver(reserveSpace);
    observer.observe(bubble);
    observer.observe(stage);
    reserveSpace();
    return () => {
      observer.disconnect();
      stage.style.removeProperty("--viewer-calc-bottom");
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
      className="viewer-next-calc-bubble pointer-events-auto absolute left-1/2 top-[72px] md:top-3 z-30 flex max-w-[min(72%,680px)] -translate-x-1/2 flex-col gap-2 rounded-[14px] bg-[#16233A] p-2.5 text-white shadow-[0_8px_28px_rgba(20,30,50,0.35)]"
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
          className="min-h-11 rounded-[10px] bg-white px-3.5 text-sm font-semibold text-[#16233A]"
        >
          {dict.labels.tallyCopy}
        </button>
        <button
          type="button"
          onClick={() => {
            onClear();
            setCopyState("idle");
          }}
          className="min-h-11 rounded-[10px] border-2 border-[#7C8CA8] bg-transparent px-3.5 text-sm font-semibold text-white"
        >
          {dict.labels.tallyClear}
        </button>
      </div>
      <div className="flex max-h-32 flex-wrap items-center gap-1.5 overflow-y-auto pr-1">
        {items.map((item) => (
          <span
            key={item.id}
            className="inline-flex items-center gap-1 rounded-full bg-[#22324D] py-0.5 pl-3 pr-0.5 font-mono text-xs"
          >
            {item.label} {formatTallyValue(item.value, item.unit)} {item.unit}
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              aria-label={`${item.label}: ${dict.labels.removeTally}`}
              className="flex h-11 w-11 items-center justify-center rounded-full text-white"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#45577A] text-xs leading-none">
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
            copyState === "error" ? "text-red-200" : "text-emerald-200",
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
