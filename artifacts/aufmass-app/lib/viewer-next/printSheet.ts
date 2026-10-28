import type { Dictionary } from "@/i18n";
import { MEASUREMENT_DISCLAIMER } from "@/lib/config/haftung";
import { prepareProjectMeasurement } from "./projectMeasurement";
import type { CardRow, ViewerCard } from "./viewerCards";
import { referenceText } from "./qualityText";
import { publicPages } from "@/i18n/public";

export const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** The exact existing card values, not another measurement calculation. */
export function panelValueStrings(cards: readonly ViewerCard[]): string[] {
  const rowValues = (rows: readonly CardRow[]): string[] => rows.flatMap(row => [
    ...[row.value, row.value2, row.unit].filter((v): v is string => v !== undefined),
    ...rowValues(row.subRows ?? []),
    ...(row.calcLines ?? []).map(line => line.value),
  ]);
  return cards.flatMap(card => [card.hero, card.heroUnit, ...(card.hero2 ? [card.hero2] : []), ...rowValues(card.rows)]);
}

export function renderPrintSheet(input: {
  measurement: unknown; name: string; address: string | null; date: string; fileCount: number;
  locale: "en-US" | "de-DE"; dict: Dictionary["viewerNext"]; nonce: string; preview: boolean;
}) {
  const { dict: d } = input;
  const prepared = prepareProjectMeasurement(input.measurement, d);
  if (prepared.kind !== "viewer") return null;
  const e = escapeHtml;
  const confidence = new Map<string, boolean>();
  const raw = input.measurement as Record<string, unknown>;
  for (const key of ["faces", "edges", "openings", "attachments", "downspouts", "condition_areas"]) {
    if (Array.isArray(raw[key])) for (const record of raw[key]) {
      if (!record || typeof record !== "object") continue;
      confidence.set(record.id, record.confidence === "low" || Object.values(record).some(
        value => value && typeof value === "object" && (value as { confidence?: unknown }).confidence === "low"));
    }
  }
  function rows(items: readonly CardRow[], depth = 0): string {
    return items.map(row => `<tr data-row-id="${e(row.id)}"><th style="padding-left:${8 + depth * 12}px">
      ${e(row.label)}${row.badge ? `<small>${e(row.badge)}</small>` : ""}${row.sub ? `<small>${e(row.sub)}</small>` : ""}
      ${confidence.get(row.id) && row.unit !== d.labels.verifyOnSite ? `<small>${e(d.labels.verifyOnSite)}</small>` : ""}
      </th><td data-panel-value>${e(row.value ?? "—")}${row.value2 ? `<br><span data-panel-value>${e(row.value2)}</span>` : ""}</td>
      <td data-panel-value>${e(row.unit ?? "")}</td></tr>
      ${(row.calcLines ?? []).map(line => `<tr class="breakdown"><th>${e(line.label)}</th><td data-panel-value>${e(line.value)}</td><td></td></tr>`).join("")}
      ${rows(row.subRows ?? [], depth + 1)}`).join("");
  }
  const sections = prepared.cards.map(card => `<section class="measurement-section" data-card-id="${e(card.id)}">
    <h2>${e(card.title)}</h2>
    ${card.badge ? `<p>${e(card.badge)}</p>` : ""}${card.sourceBadge ? `<p>${e(card.sourceBadge)}</p>` : ""}
    <p class="hero"><span data-panel-value>${e(card.hero)}</span> <span data-panel-value>${e(card.heroUnit)}</span>
      ${card.hero2 ? ` · <span data-panel-value>${e(card.hero2)}</span>` : ""}</p>
    ${card.sub ? `<p>${e(card.sub)}</p>` : ""}
    <table><thead><tr><th>${e(d.printLabel)}</th><th>${e(d.printValue)}</th><th>${e(d.printUnit)}</th></tr></thead>
    <tbody>${rows(card.rows)}</tbody></table></section>`).join("");
  const warnings = prepared.measurement.quality?.warnings ?? [];
  const references = prepared.measurement.references ?? [];
  return `<!doctype html><html lang="${input.locale === "de-DE" ? "de" : "en"}"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(d.printTitle)} — ${e(input.name)}</title>
  <style>
  *{box-sizing:border-box}body{margin:0;background:#fff;color:#16233a;font:15px/1.5 "IBM Plex Sans",sans-serif}
  main{max-width:960px;margin:auto;padding:32px 24px;min-width:0}h1{font-size:28px;line-height:1.2}h2{font-size:20px}p,h1,h2,th,td{overflow-wrap:anywhere}
  .wordmark{font-size:20px;font-weight:700}.project{font-size:19px;font-weight:600}dl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
  dt{font-size:12px}dd{margin:0}.measurement-section{margin:28px 0;border-top:1px solid #d9e0e7;padding-top:16px}
  .hero{font-size:22px;font-variant-numeric:tabular-nums}table{width:100%;border-collapse:collapse;table-layout:fixed}
  th,td{text-align:left;vertical-align:top;padding:8px;border-bottom:1px solid #d9e0e7}thead th{font-size:12px}th{width:54%;font-weight:500}td{width:23%;font-variant-numeric:tabular-nums}
  small{display:block;font-size:11px;font-weight:400}.breakdown th{padding-left:20px;font-weight:400}button{font:inherit;padding:10px 14px;background:white;border:1px solid #d9e0e7;border-radius:8px;cursor:pointer}
  footer{margin-top:32px;font-size:12px}footer nav{display:flex;flex-wrap:wrap;gap:16px}a{color:inherit}.page-number{display:none}
  @media(max-width:480px){main{padding:20px 12px}dl{grid-template-columns:1fr}th,td{padding:6px}h1{font-size:24px}}
  @media print{@page{size:auto;margin:16mm;@bottom-center{content:${JSON.stringify(d.printPage + " ")} counter(page)}}body{color:#000;background:#fff;font-size:10pt}main{max-width:none;padding:0}.print-controls,footer nav{display:none!important}
    .measurement-section{break-before:page}.measurement-section:first-of-type{break-before:auto}h2{break-after:avoid}tr{break-inside:avoid}thead{display:table-header-group}}
  </style></head><body><main><header><div class="wordmark">SnapTape</div><h1>${e(d.printTitle)}</h1><p class="project">${e(input.name)}</p>
  <dl><div><dt>${e(d.printAddress)}</dt><dd>${e(input.address ?? "—")}</dd></div><div><dt>${e(d.printDate)}</dt><dd>${e(input.date)}</dd></div>
  <div><dt>${e(d.printFiles)}</dt><dd>${input.fileCount}</dd></div></dl>
  <div class="print-controls"><button id="print-sheet">${e(d.printAction)}</button></div></header>
  ${sections}<section class="quality"><h2>${e(d.warnings)}</h2>${warnings.length ? `<ul>${warnings.map(w => `<li>${e(w)}</li>`).join("")}</ul>` : ""}
  <h2>${e(d.references)}</h2>${references.map(r => `<p>${e(referenceText(r, d))}</p>`).join("")}
  <p data-disclaimer>${e(MEASUREMENT_DISCLAIMER)}</p></section>
  <footer><p>${e(publicPages.footer.tagline)}</p><nav><a href="/legal/notice">${e(publicPages.footer.notice)}</a><a href="/legal/privacy">${e(publicPages.footer.privacy)}</a><a href="/legal/terms">${e(publicPages.footer.terms)}</a></nav>
  <p>${e(publicPages.footer.copyright)}</p><p class="page-number">${e(d.printPage)} </p></footer></main>
  <script nonce="${e(input.nonce)}">document.getElementById('print-sheet').addEventListener('click',()=>window.print());${input.preview ? "" : "window.addEventListener('load',()=>window.print(),{once:true});"}</script>
  </body></html>`;
}
