"use client";

// Rechtes Panel des 3D-Viewers im Stil „Technical-Clean": Summary-
// Streifen oben, blaues Auswahl-Panel mit Summe, Kategorie-Tabs
// (Dach / Wände / Öffnungen / Kanten) mit Segmentliste und Summen.
// Anzeige imperial (ft-in bzw. ft², Pitch x/12), Roh-mm im Tooltip
// (Eiserne Regel 1); Öffnungen tragen immer den Hinweis „Richtmaß,
// kein Bestellmaß" (Eiserne Regel 5).
import type { Dictionary } from "@/i18n";
import { useDictionary } from "@/i18n/LocaleProvider";
import {
  kategorieSummen,
  oeffnungsFlaecheMm2,
  wandflaechenJeFassade,
} from "@/lib/berechnung/flaechen";
import type { MeasureJson } from "@/lib/messung/schema";
import {
  formatBreiteHoeheFtIn,
  formatFtIn,
  formatGrad,
  formatMm2Roh,
  formatMmRoh,
  formatPitch,
  formatQuadratfuss,
} from "@/lib/viewer/anzeige";
import type { HausModell } from "@/lib/viewer/baukasten";
import type { MessLinie } from "@/lib/viewer/szene";

// Texte kommen aus dem Sprach-Kontext (useDictionary); reine Helfer
// bekommen das Viewer-Wörterbuch als Parameter.
type ViewerDict = Dictionary["viewer"];

export type KategorieTab = "roof" | "walls" | "openings" | "edges";

const KATEGORIE_TABS: readonly KategorieTab[] = [
  "roof",
  "walls",
  "openings",
  "edges",
];

type ElevationName = keyof ViewerDict["elevations"];
type KantenKlasse = keyof ViewerDict["kantenKlassen"];

// „unknown"/null wird UI-weit komplett weggelassen: kein Platzhalter-
// Text, keine Zeile. null bedeutet hier „nicht anzeigen".
function fassadeName(
  t: ViewerDict,
  elevation: string | null | undefined,
): string | null {
  if (elevation && elevation in t.elevations) {
    return t.elevations[elevation as ElevationName];
  }
  return null;
}

// Verbindet nur vorhandene Teile mit „ · " – leere Felder fallen weg,
// ohne hängende Trennzeichen.
function mitPunkt(...teile: (string | null | undefined)[]): string {
  return teile.filter((teil): teil is string => Boolean(teil)).join(" · ");
}

function kantenKlasseName(t: ViewerDict, klasse: string): string {
  if (klasse in t.kantenKlassen) {
    return t.kantenKlassen[klasse as KantenKlasse];
  }
  return t.kantenKlassen.unclassified;
}

interface BauteilPanelProps {
  mess: MeasureJson;
  modell: HausModell;
  auswahl: ReadonlySet<string>;
  tab: KategorieTab;
  onTabChange: (tab: KategorieTab) => void;
  onToggle: (id: string) => void;
  onZoom: (id: string) => void;
  messLinien: MessLinie[];
  onMessLinieLoeschen: (id: string) => void;
}

// Summary-Kachel oben im Panel: Wert groß in Mono, Label darunter.
function SummaryKachel({
  label,
  wert,
  wertTitel,
}: {
  label: string;
  wert: string;
  wertTitel?: string;
}) {
  return (
    <div className="rounded-eingabe border border-linie bg-hintergrund px-2.5 py-2">
      <p
        className="truncate font-mono text-sm font-semibold tabular-nums text-schrift"
        title={wertTitel}
      >
        {wert}
      </p>
      <p className="mt-0.5 truncate text-[11px] text-schrift-tertiaer">
        {label}
      </p>
    </div>
  );
}

interface ZeileProps {
  id: string;
  ausgewaehlt: boolean;
  onToggle: (id: string) => void;
  onZoom: (id: string) => void;
  neben?: string;
  wert: string;
  wertTitel?: string;
}

// Segmentzeile: ID-Pill links (blau, wenn ausgewählt), Nebeninfo als
// Unterzeile, Wert rechts in Mono.
function Zeile({
  id,
  ausgewaehlt,
  onToggle,
  onZoom,
  neben,
  wert,
  wertTitel,
}: ZeileProps) {
  const t = useDictionary().viewer;
  return (
    <button
      type="button"
      onClick={() => onToggle(id)}
      onDoubleClick={() => onZoom(id)}
      title={t.zoomHinweis}
      className={`flex w-full items-center justify-between gap-3 rounded-eingabe border px-3 py-2 text-left transition ${
        ausgewaehlt
          ? "border-akzent/50 bg-akzent/10"
          : "border-linie bg-flaeche hover:bg-hintergrund"
      }`}
    >
      <span className="min-w-0">
        <span
          className={`inline-flex rounded-md px-1.5 py-0.5 font-mono text-xs font-semibold ${
            ausgewaehlt
              ? "bg-akzent text-white"
              : "border border-linie bg-hintergrund text-schrift-sekundaer"
          }`}
        >
          {id}
        </span>
        {neben ? (
          <span className="mt-1 block truncate text-xs text-schrift-tertiaer">
            {neben}
          </span>
        ) : null}
      </span>
      <span
        className="shrink-0 font-mono text-sm tabular-nums text-schrift"
        title={wertTitel}
      >
        {wert}
      </span>
    </button>
  );
}

// Summenzeile einer Kategorie, z. B. „Dach gesamt   47,17 m²".
function SummenZeile({
  label,
  wert,
  wertTitel,
}: {
  label: string;
  wert: string;
  wertTitel?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 px-1">
      <span className="text-sm font-semibold text-schrift">{label}</span>
      <span
        className="font-mono text-sm font-semibold tabular-nums text-schrift"
        title={wertTitel}
      >
        {wert}
      </span>
    </div>
  );
}

// Auswahl-Panel: zeigt ALLE ausgewählten Bauteile (Reihenfolge = Klick-
// Reihenfolge des Sets) mit Einzelwert je Zeile sowie fetten Summen
// oben – Flächen (m²) und Kanten (m) getrennt, niemals gemischt.
// Summen werden aus den ungerundeten mm-Werten gebildet; gerundet wird
// nur für die Anzeige, Roh-Werte stehen im Tooltip (Eiserne Regel 1).
type AuswahlEintrag = {
  id: string;
  label: string;
  wert: string;
  wertTitel: string;
  art: "flaeche" | "laenge";
  rohWert: number; // mm² bei Flächen, mm bei Kanten
};

function AuswahlPanel({
  mess,
  modell,
  auswahl,
  onToggle,
}: {
  mess: MeasureJson;
  modell: HausModell;
  auswahl: ReadonlySet<string>;
  onToggle: (id: string) => void;
}) {
  const t = useDictionary().viewer;
  const eintraege: AuswahlEintrag[] = [];
  let hatOeffnung = false;

  for (const id of auswahl) {
    const oeffnung = mess.openings.find((o) => o.id === id);
    if (oeffnung) {
      hatOeffnung = true;
      const flaeche = oeffnungsFlaecheMm2(oeffnung);
      eintraege.push({
        id,
        label: mitPunkt(
          t.typen[oeffnung.type],
          fassadeName(t, oeffnung.elevation),
        ),
        wert: formatQuadratfuss(flaeche),
        wertTitel: `${formatMm2Roh(flaeche)} · ${formatMmRoh(oeffnung.width_mm.value)} × ${formatMmRoh(oeffnung.height_mm.value)} · ${t.hinweisRichtmass}`,
        art: "flaeche",
        rohWert: flaeche,
      });
      continue;
    }

    const face = mess.faces.find((f) => f.id === id);
    if (face) {
      const istWand = face.face_class === "wall";
      eintraege.push({
        id,
        label: mitPunkt(
          istWand ? t.kategorien.walls : t.kategorien.roof,
          fassadeName(t, face.elevation),
        ),
        wert: formatQuadratfuss(face.area_mm2.value),
        wertTitel: formatMm2Roh(face.area_mm2.value),
        art: "flaeche",
        rohWert: face.area_mm2.value,
      });
      continue;
    }

    const messKante = mess.edges.find((e) => e.id === id);
    if (messKante) {
      const kante = modell.kanten.find((k) => k.id === id);
      eintraege.push({
        id,
        label: mitPunkt(
          kantenKlasseName(t, kante ? kante.edgeClass : messKante.edge_class),
          fassadeName(t, messKante.belongs_to_elevation),
        ),
        wert: formatFtIn(messKante.length_mm.value),
        wertTitel: formatMmRoh(messKante.length_mm.value),
        art: "laenge",
        rohWert: messKante.length_mm.value,
      });
    }
  }

  if (eintraege.length === 0) return null;

  const flaechen = eintraege.filter((e) => e.art === "flaeche");
  const kanten = eintraege.filter((e) => e.art === "laenge");
  const summeFlaechenMm2 = flaechen.reduce((s, e) => s + e.rohWert, 0);
  const summeKantenMm = kanten.reduce((s, e) => s + e.rohWert, 0);

  return (
    <div className="rounded-karte border border-akzent/30 bg-akzent/5 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          {flaechen.length > 0 ? (
            <p
              className="text-sm font-bold tabular-nums text-schrift"
              title={formatMm2Roh(summeFlaechenMm2)}
            >
              {flaechen.length}{" "}
              {flaechen.length === 1
                ? t.auswahlFlaecheEinzahl
                : t.auswahlFlaecheMehrzahl}{" "}
              ·{" "}
              <span className="font-mono">
                {formatQuadratfuss(summeFlaechenMm2)}
              </span>
            </p>
          ) : null}
          {kanten.length > 0 ? (
            <p
              className="text-sm font-bold tabular-nums text-schrift"
              title={formatMmRoh(summeKantenMm)}
            >
              {kanten.length}{" "}
              {kanten.length === 1
                ? t.auswahlKanteEinzahl
                : t.auswahlKanteMehrzahl}{" "}
              ·{" "}
              <span className="font-mono">{formatFtIn(summeKantenMm)}</span>
            </p>
          ) : null}
        </div>
        <span className="shrink-0 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-akzent">
          {t.ausgewaehlt}
        </span>
      </div>

      <ul className="mt-2 space-y-1 border-t border-akzent/20 pt-2">
        {eintraege.map((eintrag) => (
          <li
            key={eintrag.id}
            className="flex items-baseline justify-between gap-2 text-sm"
          >
            <span className="min-w-0 truncate">
              <span className="font-mono font-semibold text-akzent">
                {eintrag.id}
              </span>
              {eintrag.label ? (
                <span className="ml-1.5 text-xs text-schrift-tertiaer">
                  {eintrag.label}
                </span>
              ) : null}
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              <span
                className="font-mono tabular-nums text-schrift-sekundaer"
                title={eintrag.wertTitel}
              >
                {eintrag.wert}
              </span>
              <button
                type="button"
                onClick={() => onToggle(eintrag.id)}
                aria-label={`${t.entfernen} ${eintrag.id}`}
                className="rounded px-1 leading-none text-schrift-tertiaer transition hover:text-fehler focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-akzent/50"
              >
                ×
              </button>
            </span>
          </li>
        ))}
      </ul>

      {hatOeffnung ? (
        <p className="mt-2 text-xs font-medium text-warnung">
          {t.hinweisRichtmass}
        </p>
      ) : null}
    </div>
  );
}

export function BauteilPanel({
  mess,
  modell,
  auswahl,
  tab,
  onTabChange,
  onToggle,
  onZoom,
  messLinien,
  onMessLinieLoeschen,
}: BauteilPanelProps) {
  const t = useDictionary().viewer;
  const daecher = mess.faces.filter((f) => f.face_class === "roof_face");
  const waende = mess.faces.filter((f) => f.face_class === "wall");
  const wandDaten = wandflaechenJeFassade(mess);
  const summen = kategorieSummen(mess);

  return (
    <div className="space-y-4 p-4">
      {/* Summary-Streifen */}
      <div className="grid grid-cols-3 gap-2">
        <SummaryKachel
          label={t.summary.dach}
          wert={formatQuadratfuss(summen.dachMm2)}
          wertTitel={formatMm2Roh(summen.dachMm2)}
        />
        <SummaryKachel
          label={t.summary.wand}
          wert={formatQuadratfuss(summen.waendeNettoMm2)}
          wertTitel={formatMm2Roh(summen.waendeNettoMm2)}
        />
        <SummaryKachel
          label={t.summary.oeffnungen}
          wert={`${summen.anzahlOeffnungen}`}
        />
      </div>

      {/* Auswahl */}
      {auswahl.size > 0 ? (
        <AuswahlPanel
          mess={mess}
          modell={modell}
          auswahl={auswahl}
          onToggle={onToggle}
        />
      ) : (
        <p className="px-1 text-xs text-schrift-tertiaer">{t.keineAuswahl}</p>
      )}

      {/* Kategorie-Tabs */}
      <div className="grid grid-cols-4 gap-1 rounded-eingabe border border-linie bg-hintergrund p-1">
        {KATEGORIE_TABS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onTabChange(k)}
            aria-pressed={tab === k}
            className={`rounded-lg px-1 py-1.5 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-akzent/50 ${
              tab === k
                ? "bg-flaeche font-semibold text-schrift shadow-karte"
                : "font-medium text-schrift-sekundaer hover:text-schrift"
            }`}
          >
            {t.kategorien[k]}
          </button>
        ))}
      </div>

      {/* Dach */}
      {tab === "roof" ? (
        <section className="space-y-2">
          <SummenZeile
            label={`${t.kategorien.roof} ${t.gesamt}`}
            wert={formatQuadratfuss(summen.dachMm2)}
            wertTitel={formatMm2Roh(summen.dachMm2)}
          />
          <div className="space-y-1.5">
            {daecher.map((f) => (
              <Zeile
                key={f.id}
                id={f.id}
                ausgewaehlt={auswahl.has(f.id)}
                onToggle={onToggle}
                onZoom={onZoom}
                neben={
                  f.pitch?.rise_over_12_snapped !== undefined
                    ? formatPitch(f.pitch.rise_over_12_snapped)
                    : undefined
                }
                wert={formatQuadratfuss(f.area_mm2.value)}
                wertTitel={
                  f.pitch?.degrees_original !== undefined
                    ? `${formatMm2Roh(f.area_mm2.value)} · ${formatGrad(f.pitch.degrees_original)}`
                    : formatMm2Roh(f.area_mm2.value)
                }
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* Wände */}
      {tab === "walls" ? (
        <section className="space-y-2">
          <div className="space-y-1">
            <SummenZeile
              label={t.summeBrutto}
              wert={formatQuadratfuss(summen.waendeBruttoMm2)}
              wertTitel={formatMm2Roh(summen.waendeBruttoMm2)}
            />
            <SummenZeile
              label={t.summeNetto}
              wert={formatQuadratfuss(summen.waendeNettoMm2)}
              wertTitel={formatMm2Roh(summen.waendeNettoMm2)}
            />
          </div>
          <div className="space-y-1.5">
            {waende.map((f) => {
              const netto = wandDaten.find((w) => w.fassade === f.elevation);
              return (
                <Zeile
                  key={f.id}
                  id={f.id}
                  ausgewaehlt={auswahl.has(f.id)}
                  onToggle={onToggle}
                  onZoom={onZoom}
                  neben={fassadeName(t, f.elevation) ?? undefined}
                  wert={
                    netto
                      ? `${formatQuadratfuss(f.area_mm2.value)} / ${formatQuadratfuss(netto.nettoMm2)}`
                      : formatQuadratfuss(f.area_mm2.value)
                  }
                  wertTitel={
                    netto
                      ? `${t.flaecheBrutto}: ${formatMm2Roh(f.area_mm2.value)} · ${t.flaecheNetto}: ${formatMm2Roh(netto.nettoMm2)}`
                      : formatMm2Roh(f.area_mm2.value)
                  }
                />
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Öffnungen */}
      {tab === "openings" ? (
        <section className="space-y-2">
          <SummenZeile
            label={`${t.summe} (${summen.anzahlOeffnungen} ${t.anzahlKurz})`}
            wert={formatQuadratfuss(summen.oeffnungenMm2)}
            wertTitel={formatMm2Roh(summen.oeffnungenMm2)}
          />
          <div className="space-y-1.5">
            {mess.openings.map((o) => (
              <Zeile
                key={o.id}
                id={o.id}
                ausgewaehlt={auswahl.has(o.id)}
                onToggle={onToggle}
                onZoom={onZoom}
                neben={mitPunkt(t.typen[o.type], fassadeName(t, o.elevation))}
                wert={formatBreiteHoeheFtIn(o.width_mm.value, o.height_mm.value)}
                wertTitel={`${formatMmRoh(o.width_mm.value)} × ${formatMmRoh(o.height_mm.value)} · ${t.hinweisRichtmass}`}
              />
            ))}
          </div>
          <p className="px-1 text-xs font-medium text-warnung">
            {t.hinweisRichtmass}
          </p>
        </section>
      ) : null}

      {/* Kanten */}
      {tab === "edges" ? (
        <section className="space-y-1.5">
          {mess.edges.map((e) => (
            <Zeile
              key={e.id}
              id={e.id}
              ausgewaehlt={auswahl.has(e.id)}
              onToggle={onToggle}
              onZoom={onZoom}
              neben={mitPunkt(
                kantenKlasseName(t, e.edge_class),
                fassadeName(t, e.belongs_to_elevation),
              )}
              wert={formatFtIn(e.length_mm.value)}
              wertTitel={formatMmRoh(e.length_mm.value)}
            />
          ))}
        </section>
      ) : null}

      {/* Messlinien */}
      {messLinien.length > 0 ? (
        <section className="rounded-karte border border-linie bg-hintergrund p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-schrift-tertiaer">
            {t.messLinien}
          </h3>
          <ul className="mt-2 space-y-1">
            {messLinien.map((linie) => (
              <li
                key={linie.id}
                className="flex items-center justify-between gap-2 rounded-eingabe border border-linie bg-flaeche px-2.5 py-1.5 text-sm"
              >
                <span
                  className="font-mono tabular-nums text-schrift"
                  title={formatMmRoh(linie.laengeMm)}
                >
                  {linie.id}: {formatFtIn(linie.laengeMm)}
                </span>
                <button
                  type="button"
                  onClick={() => onMessLinieLoeschen(linie.id)}
                  className="text-xs font-medium text-fehler hover:underline"
                >
                  {t.loeschen}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="px-1 text-xs text-schrift-tertiaer">{t.zoomHinweis}</p>
    </div>
  );
}
