"use client";

// Linkes Panel des 3D-Viewers: Werkzeuge, Auswahl-Detail und die
// Bauteil-Kategorien Dach / Wände / Öffnungen / Kanten mit Summen.
// Anzeige gerundet (cm bzw. m²), Roh-mm im Tooltip (Eiserne Regel 1);
// Öffnungen tragen immer den Hinweis „Richtmaß, kein Bestellmaß“
// (Eiserne Regel 5).
import { de } from "@/i18n/de";
import {
  kategorieSummen,
  oeffnungsFlaecheMm2,
  wandflaechenJeFassade,
} from "@/lib/berechnung/flaechen";
import type { MessJson } from "@/lib/messung/schema";
import {
  formatBreiteHoeheCm,
  formatMeter,
  formatMm2Roh,
  formatMmRoh,
  formatQuadratmeter,
} from "@/lib/viewer/anzeige";
import type { HausModell } from "@/lib/viewer/baukasten";
import type { MessLinie } from "@/lib/viewer/szene";

const t = de.viewer;

type FassadenName = keyof typeof t.fassaden;
type KantenKlasse = keyof typeof t.kantenKlassen;

// „unbekannt"/null wird UI-weit komplett weggelassen: kein Platzhalter-
// Text, keine Zeile. null bedeutet hier „nicht anzeigen".
function fassadeName(fassade: string | null | undefined): string | null {
  if (fassade && fassade in t.fassaden) {
    return t.fassaden[fassade as FassadenName];
  }
  return null;
}

// Verbindet nur vorhandene Teile mit „ · " – leere Felder fallen weg,
// ohne hängende Trennzeichen.
function mitPunkt(...teile: (string | null | undefined)[]): string {
  return teile.filter((teil): teil is string => Boolean(teil)).join(" · ");
}

function kantenKlasseName(klasse: string): string {
  if (klasse in t.kantenKlassen) {
    return t.kantenKlassen[klasse as KantenKlasse];
  }
  return t.kantenKlassen.unklassifiziert;
}

interface BauteilPanelProps {
  mess: MessJson;
  modell: HausModell;
  auswahl: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onKategorieToggle: (ids: string[]) => void;
  onAuswahlLeeren: () => void;
  onZoom: (id: string) => void;
  masseSichtbar: boolean;
  onMasseChange: (sichtbar: boolean) => void;
  messModus: boolean;
  onMessModusChange: (aktiv: boolean) => void;
  messLinien: MessLinie[];
  onMessLinieLoeschen: (id: string) => void;
}

interface ZeileProps {
  id: string;
  ausgewaehlt: boolean;
  onToggle: (id: string) => void;
  onZoom: (id: string) => void;
  haupt: string;
  neben?: string;
  wert: string;
  wertTitel?: string;
}

function Zeile({
  id,
  ausgewaehlt,
  onToggle,
  onZoom,
  haupt,
  neben,
  wert,
  wertTitel,
}: ZeileProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(id)}
      onDoubleClick={() => onZoom(id)}
      title={de.viewer.zoomHinweis}
      className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-sm transition ${
        ausgewaehlt
          ? "border-sky-400/60 bg-sky-400/15"
          : "border-transparent hover:bg-white/10"
      }`}
    >
      <span className="min-w-0">
        <span className="font-medium text-white">{haupt}</span>
        {neben ? (
          <span className="ml-1.5 text-xs text-neutral-400">{neben}</span>
        ) : null}
      </span>
      <span
        className="shrink-0 tabular-nums text-neutral-300"
        title={wertTitel}
      >
        {wert}
      </span>
    </button>
  );
}

interface KategorieKopfProps {
  titel: string;
  ids: string[];
  auswahl: ReadonlySet<string>;
  onKategorieToggle: (ids: string[]) => void;
}

function KategorieKopf({
  titel,
  ids,
  auswahl,
  onKategorieToggle,
}: KategorieKopfProps) {
  const alleGewaehlt = ids.length > 0 && ids.every((id) => auswahl.has(id));
  return (
    <div className="mb-1.5 flex items-center justify-between">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
        {titel}
      </h3>
      <button
        type="button"
        onClick={() => onKategorieToggle(ids)}
        className="text-xs font-medium text-sky-300 hover:underline"
      >
        {alleGewaehlt ? t.alleAbwaehlen : t.alleAuswaehlen}
      </button>
    </div>
  );
}

function SummenZeile({ label, wert, wertTitel }: { label: string; wert: string; wertTitel?: string }) {
  return (
    <div className="flex items-center justify-between border-t border-white/10 px-2.5 pt-1.5 text-sm">
      <span className="font-medium text-neutral-300">{label}</span>
      <span className="font-semibold tabular-nums text-white" title={wertTitel}>
        {wert}
      </span>
    </div>
  );
}

// Auswahl-Liste: zeigt ALLE ausgewählten Bauteile (Reihenfolge = Klick-
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

function AuswahlDetail({
  mess,
  modell,
  auswahl,
}: {
  mess: MessJson;
  modell: HausModell;
  auswahl: ReadonlySet<string>;
}) {
  if (auswahl.size === 0) {
    return <p className="text-xs text-neutral-400">{t.keineAuswahl}</p>;
  }

  const eintraege: AuswahlEintrag[] = [];
  let hatOeffnung = false;

  for (const id of auswahl) {
    const oeffnung = mess.openings.find((o) => o.id === id);
    if (oeffnung) {
      hatOeffnung = true;
      const flaeche = oeffnungsFlaecheMm2(oeffnung);
      eintraege.push({
        id,
        label: mitPunkt(t.typen[oeffnung.typ], fassadeName(oeffnung.fassade)),
        wert: formatQuadratmeter(flaeche),
        wertTitel: `${formatMm2Roh(flaeche)} · ${formatBreiteHoeheCm(oeffnung.breite_mm.wert, oeffnung.hoehe_mm.wert)} · ${oeffnung.hinweis}`,
        art: "flaeche",
        rohWert: flaeche,
      });
      continue;
    }

    const face = mess.faces.find((f) => f.id === id);
    if (face) {
      const istWand = face.face_class === "wand";
      eintraege.push({
        id,
        label: mitPunkt(
          istWand ? t.kategorien.waende : t.kategorien.dach,
          fassadeName(face.fassade),
        ),
        wert: formatQuadratmeter(face.flaeche_mm2.wert),
        wertTitel: formatMm2Roh(face.flaeche_mm2.wert),
        art: "flaeche",
        rohWert: face.flaeche_mm2.wert,
      });
      continue;
    }

    const messKante = mess.edges.find((e) => e.id === id);
    if (messKante) {
      const kante = modell.kanten.find((k) => k.id === id);
      eintraege.push({
        id,
        label: mitPunkt(
          kantenKlasseName(kante ? kante.edgeClass : messKante.edge_class),
          fassadeName(messKante.gehoert_zu_fassade),
        ),
        wert: formatMeter(messKante.laenge_mm.wert),
        wertTitel: formatMmRoh(messKante.laenge_mm.wert),
        art: "laenge",
        rohWert: messKante.laenge_mm.wert,
      });
    }
  }

  if (eintraege.length === 0) {
    return <p className="text-xs text-neutral-400">{t.keineAuswahl}</p>;
  }

  const flaechen = eintraege.filter((e) => e.art === "flaeche");
  const kanten = eintraege.filter((e) => e.art === "laenge");
  const summeFlaechenMm2 = flaechen.reduce((s, e) => s + e.rohWert, 0);
  const summeKantenMm = kanten.reduce((s, e) => s + e.rohWert, 0);

  return (
    <div className="space-y-2 text-sm">
      <div className="space-y-0.5">
        {flaechen.length > 0 ? (
          <p
            className="font-bold tabular-nums text-white"
            title={formatMm2Roh(summeFlaechenMm2)}
          >
            {flaechen.length}{" "}
            {flaechen.length === 1
              ? t.auswahlFlaecheEinzahl
              : t.auswahlFlaecheMehrzahl}{" "}
            · {formatQuadratmeter(summeFlaechenMm2)}
          </p>
        ) : null}
        {kanten.length > 0 ? (
          <p
            className="font-bold tabular-nums text-white"
            title={formatMmRoh(summeKantenMm)}
          >
            {kanten.length}{" "}
            {kanten.length === 1
              ? t.auswahlKanteEinzahl
              : t.auswahlKanteMehrzahl}{" "}
            · {formatMeter(summeKantenMm)}
          </p>
        ) : null}
      </div>

      <ul className="space-y-1 border-t border-white/10 pt-2">
        {eintraege.map((eintrag) => (
          <li
            key={eintrag.id}
            className="flex items-baseline justify-between gap-2"
          >
            <span className="min-w-0 truncate">
              <span className="font-medium text-white">{eintrag.id}</span>
              {eintrag.label ? (
                <span className="ml-1.5 text-xs text-neutral-400">
                  {eintrag.label}
                </span>
              ) : null}
            </span>
            <span
              className="shrink-0 tabular-nums text-neutral-300"
              title={eintrag.wertTitel}
            >
              {eintrag.wert}
            </span>
          </li>
        ))}
      </ul>

      {hatOeffnung ? (
        <p className="text-xs font-medium text-amber-400">
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
  onToggle,
  onKategorieToggle,
  onAuswahlLeeren,
  onZoom,
  masseSichtbar,
  onMasseChange,
  messModus,
  onMessModusChange,
  messLinien,
  onMessLinieLoeschen,
}: BauteilPanelProps) {
  const daecher = mess.faces.filter((f) => f.face_class === "dachflaeche");
  const waende = mess.faces.filter((f) => f.face_class === "wand");
  const wandDaten = wandflaechenJeFassade(mess);
  const summen = kategorieSummen(mess);

  const dachIds = daecher.map((f) => f.id);
  const wandIds = waende.map((f) => f.id);
  const oeffnungIds = mess.openings.map((o) => o.id);
  const kantenIds = mess.edges.map((e) => e.id);

  return (
    <div className="space-y-5 p-4">
      <div>
        <h2 className="text-base font-semibold text-white">{t.title}</h2>
        <p className="text-xs text-neutral-400">{t.subtitle}</p>
      </div>

      {/* Werkzeuge */}
      <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-200">
          <input
            type="checkbox"
            checked={masseSichtbar}
            onChange={(e) => onMasseChange(e.target.checked)}
            className="h-4 w-4 accent-sky-400"
          />
          {t.masseAnzeigen}
        </label>
        <button
          type="button"
          onClick={() => onMessModusChange(!messModus)}
          className={`w-full rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
            messModus
              ? "border-red-400/60 bg-red-500/15 text-red-300"
              : "border-white/15 bg-white/5 text-neutral-200 hover:bg-white/10"
          }`}
        >
          {t.messWerkzeug}
        </button>
        {messLinien.length > 0 ? (
          <ul className="space-y-1">
            {messLinien.map((linie) => (
              <li
                key={linie.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-white/10 px-2.5 py-1 text-sm"
              >
                <span
                  className="tabular-nums text-neutral-200"
                  title={formatMmRoh(linie.laengeMm)}
                >
                  {linie.id}: {formatMeter(linie.laengeMm)}
                </span>
                <button
                  type="button"
                  onClick={() => onMessLinieLoeschen(linie.id)}
                  className="text-xs font-medium text-red-400 hover:underline"
                >
                  {t.loeschen}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-neutral-400">{t.keineMessLinien}</p>
        )}
      </div>

      {/* Auswahl */}
      <div className="rounded-xl border border-white/10 p-3">
        <div className="mb-1.5 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            {t.auswahlTitel}
          </h3>
          {auswahl.size > 0 ? (
            <button
              type="button"
              onClick={onAuswahlLeeren}
              className="text-xs font-medium text-sky-300 hover:underline"
            >
              {t.auswahlLeeren}
            </button>
          ) : null}
        </div>
        <AuswahlDetail mess={mess} modell={modell} auswahl={auswahl} />
      </div>

      {/* Dach */}
      <section>
        <KategorieKopf
          titel={t.kategorien.dach}
          ids={dachIds}
          auswahl={auswahl}
          onKategorieToggle={onKategorieToggle}
        />
        <div className="space-y-0.5">
          {daecher.map((f) => (
            <Zeile
              key={f.id}
              id={f.id}
              ausgewaehlt={auswahl.has(f.id)}
              onToggle={onToggle}
              onZoom={onZoom}
              haupt={f.id}
              neben={
                f.neigung?.gerundet_grad !== undefined
                  ? `${f.neigung.gerundet_grad}°`
                  : undefined
              }
              wert={formatQuadratmeter(f.flaeche_mm2.wert)}
              wertTitel={formatMm2Roh(f.flaeche_mm2.wert)}
            />
          ))}
        </div>
        <SummenZeile
          label={t.summe}
          wert={formatQuadratmeter(summen.dachMm2)}
          wertTitel={formatMm2Roh(summen.dachMm2)}
        />
      </section>

      {/* Wände */}
      <section>
        <KategorieKopf
          titel={t.kategorien.waende}
          ids={wandIds}
          auswahl={auswahl}
          onKategorieToggle={onKategorieToggle}
        />
        <div className="space-y-0.5">
          {waende.map((f) => {
            const netto = wandDaten.find((w) => w.fassade === f.fassade);
            return (
              <Zeile
                key={f.id}
                id={f.id}
                ausgewaehlt={auswahl.has(f.id)}
                onToggle={onToggle}
                onZoom={onZoom}
                haupt={f.id}
                neben={fassadeName(f.fassade) ?? undefined}
                wert={
                  netto
                    ? `${formatQuadratmeter(f.flaeche_mm2.wert)} / ${formatQuadratmeter(netto.nettoMm2)}`
                    : formatQuadratmeter(f.flaeche_mm2.wert)
                }
                wertTitel={
                  netto
                    ? `${t.flaecheBrutto}: ${formatMm2Roh(f.flaeche_mm2.wert)} · ${t.flaecheNetto}: ${formatMm2Roh(netto.nettoMm2)}`
                    : formatMm2Roh(f.flaeche_mm2.wert)
                }
              />
            );
          })}
        </div>
        <SummenZeile
          label={t.summeBrutto}
          wert={formatQuadratmeter(summen.waendeBruttoMm2)}
          wertTitel={formatMm2Roh(summen.waendeBruttoMm2)}
        />
        <SummenZeile
          label={t.summeNetto}
          wert={formatQuadratmeter(summen.waendeNettoMm2)}
          wertTitel={formatMm2Roh(summen.waendeNettoMm2)}
        />
      </section>

      {/* Öffnungen */}
      <section>
        <KategorieKopf
          titel={t.kategorien.oeffnungen}
          ids={oeffnungIds}
          auswahl={auswahl}
          onKategorieToggle={onKategorieToggle}
        />
        <div className="space-y-0.5">
          {mess.openings.map((o) => (
            <Zeile
              key={o.id}
              id={o.id}
              ausgewaehlt={auswahl.has(o.id)}
              onToggle={onToggle}
              onZoom={onZoom}
              haupt={o.id}
              neben={mitPunkt(t.typen[o.typ], fassadeName(o.fassade))}
              wert={formatBreiteHoeheCm(o.breite_mm.wert, o.hoehe_mm.wert)}
              wertTitel={`${formatMmRoh(o.breite_mm.wert)} × ${formatMmRoh(o.hoehe_mm.wert)} · ${o.hinweis}`}
            />
          ))}
        </div>
        <SummenZeile
          label={`${t.summe} (${summen.anzahlOeffnungen} ${t.anzahlKurz})`}
          wert={formatQuadratmeter(summen.oeffnungenMm2)}
          wertTitel={formatMm2Roh(summen.oeffnungenMm2)}
        />
        <p className="mt-1.5 px-2.5 text-xs font-medium text-amber-400">
          {t.hinweisRichtmass}
        </p>
      </section>

      {/* Kanten */}
      <section>
        <KategorieKopf
          titel={t.kategorien.kanten}
          ids={kantenIds}
          auswahl={auswahl}
          onKategorieToggle={onKategorieToggle}
        />
        <div className="space-y-0.5">
          {mess.edges.map((e) => (
            <Zeile
              key={e.id}
              id={e.id}
              ausgewaehlt={auswahl.has(e.id)}
              onToggle={onToggle}
              onZoom={onZoom}
              haupt={e.id}
              neben={mitPunkt(
                kantenKlasseName(e.edge_class),
                fassadeName(e.gehoert_zu_fassade),
              )}
              wert={formatMeter(e.laenge_mm.wert)}
              wertTitel={formatMmRoh(e.laenge_mm.wert)}
            />
          ))}
        </div>
      </section>

      <p className="text-xs text-neutral-400">{t.zoomHinweis}</p>
    </div>
  );
}
