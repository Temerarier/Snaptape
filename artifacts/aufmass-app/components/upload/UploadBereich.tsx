"use client";

// Upload-Bereich (Etappe 1): Dropzone + Kachel-Galerie + Messqualität +
// optionales Referenzmaß + „Messung starten". Ablauf pro Datei:
// 1) Server-Action stellt signierte PUT-URL aus, 2) Browser lädt direkt
// in den Object Storage (XHR mit Fortschritt – große Dateien laufen nie
// durch Server-Action-Bodies), 3) Server-Action registriert die Datei
// und verarbeitet sie (PDF → Seitenbilder, Foto → Vorschau).
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { Dictionary } from "@/i18n";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/hilfen";
import {
  entferneDateiAction,
  holeUploadZieleAction,
  registriereDateiAction,
  starteMessungAction,
  type DateiInfo,
} from "@/lib/upload/actions";
import { pruefeNeueDateien, type AblehnungsGrund } from "@/lib/upload/regeln";

type UploadTexte = Dictionary["upload"];

interface LaufenderUpload {
  schluessel: string;
  name: string;
  fortschritt: number; // 0–100
  phase: "upload" | "verarbeitung";
}

export interface UploadBereichProps {
  projektId: string;
  initialeDateien: DateiInfo[];
  initialeQualitaet: "standard" | "premium";
  initialesReferenzObjekt: string;
  initialerReferenzWert: string;
  initialeReferenzEinheit: string;
  t: UploadTexte;
}

const EINHEITEN = ["mm", "cm", "m", "inch", "feet"] as const;

// Browser-Upload per XHR (fetch liefert keinen Upload-Fortschritt).
function putDatei(
  url: string,
  datei: File,
  aufFortschritt: (prozent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (ereignis) => {
      if (ereignis.lengthComputable) {
        aufFortschritt(Math.round((ereignis.loaded / ereignis.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload-Status ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Netzwerkfehler beim Upload"));
    xhr.setRequestHeader(
      "Content-Type",
      datei.type || "application/octet-stream",
    );
    xhr.send(datei);
  });
}

function dateiEndungLabel(name: string): string {
  const punkt = name.lastIndexOf(".");
  return punkt >= 0 ? name.slice(punkt + 1).toUpperCase() : "?";
}

export function UploadBereich({
  projektId,
  initialeDateien,
  initialeQualitaet,
  initialesReferenzObjekt,
  initialerReferenzWert,
  initialeReferenzEinheit,
  t,
}: UploadBereichProps) {
  const router = useRouter();
  const eingabeRef = useRef<HTMLInputElement>(null);

  const [dateien, setDateien] = useState<DateiInfo[]>(initialeDateien);
  const [laufende, setLaufende] = useState<LaufenderUpload[]>([]);
  const [uploadFehler, setUploadFehler] = useState<string[]>([]);
  const [dragAktiv, setDragAktiv] = useState(false);

  const [qualitaet, setQualitaet] = useState<"standard" | "premium">(
    initialeQualitaet,
  );
  const [referenzObjekt, setReferenzObjekt] = useState(
    initialesReferenzObjekt,
  );
  const [referenzWert, setReferenzWert] = useState(initialerReferenzWert);
  const [referenzEinheit, setReferenzEinheit] = useState(
    initialeReferenzEinheit,
  );
  const [startFehler, setStartFehler] = useState<string | null>(null);
  const [startLaeuft, setStartLaeuft] = useState(false);

  const grundText = (grund: AblehnungsGrund): string =>
    grund === "typ"
      ? t.fehler.typ
      : grund === "zu_gross"
        ? t.fehler.zuGross
        : t.fehler.zuViele;

  function aktualisiereLaufenden(
    schluessel: string,
    aenderung: Partial<LaufenderUpload>,
  ) {
    setLaufende((liste) =>
      liste.map((u) =>
        u.schluessel === schluessel ? { ...u, ...aenderung } : u,
      ),
    );
  }

  async function verarbeiteAuswahl(auswahl: FileList | File[]) {
    const neue = Array.from(auswahl);
    if (neue.length === 0) return;
    const fehler: string[] = [];
    setStartFehler(null);

    // Sofort-Feedback mit denselben Regeln wie auf dem Server.
    const vorhandene = dateien.length + laufende.length;
    const { akzeptiert, abgelehnt } = pruefeNeueDateien(
      vorhandene,
      neue.map((d) => ({ name: d.name, sizeBytes: d.size })),
    );
    for (const a of abgelehnt) fehler.push(`${a.name} – ${grundText(a.grund)}`);
    setUploadFehler([...fehler]);
    if (akzeptiert.length === 0) return;

    // Datei-Objekte den akzeptierten Namen zuordnen (doppelte Namen:
    // der Reihe nach aus der Warteschlange nehmen).
    const warteschlangen = new Map<string, File[]>();
    for (const datei of neue) {
      const liste = warteschlangen.get(datei.name) ?? [];
      liste.push(datei);
      warteschlangen.set(datei.name, liste);
    }

    const antwort = await holeUploadZieleAction(
      projektId,
      akzeptiert.map((d) => ({ name: d.name, sizeBytes: d.sizeBytes })),
    );
    if ("error" in antwort) {
      setUploadFehler([...fehler, antwort.error]);
      return;
    }
    for (const a of antwort.abgelehnt) {
      fehler.push(`${a.name} – ${grundText(a.grund)}`);
    }
    setUploadFehler([...fehler]);

    // Nacheinander hochladen – klare Fortschrittsanzeige pro Datei.
    for (const ziel of antwort.ziele) {
      const datei = warteschlangen.get(ziel.name)?.shift();
      if (!datei) continue;
      const schluessel = ziel.objectPath;
      setLaufende((liste) => [
        ...liste,
        { schluessel, name: ziel.name, fortschritt: 0, phase: "upload" },
      ]);
      try {
        await putDatei(ziel.uploadUrl, datei, (prozent) =>
          aktualisiereLaufenden(schluessel, { fortschritt: prozent }),
        );
        aktualisiereLaufenden(schluessel, { phase: "verarbeitung" });
        const ergebnis = await registriereDateiAction(projektId, {
          objectPath: ziel.objectPath,
          originalName: datei.name,
        });
        if ("error" in ergebnis) {
          fehler.push(`${ziel.name} – ${ergebnis.error}`);
          setUploadFehler([...fehler]);
        } else {
          setDateien((liste) => [...liste, ergebnis.datei]);
        }
      } catch {
        fehler.push(`${ziel.name} – ${t.fehler.upload}`);
        setUploadFehler([...fehler]);
      } finally {
        setLaufende((liste) =>
          liste.filter((u) => u.schluessel !== schluessel),
        );
      }
    }
  }

  async function entfernen(datei: DateiInfo) {
    setUploadFehler([]);
    setStartFehler(null);
    const ergebnis = await entferneDateiAction(projektId, datei.id);
    if ("error" in ergebnis) {
      setUploadFehler([`${datei.originalName} – ${ergebnis.error}`]);
      return;
    }
    setDateien((liste) => liste.filter((d) => d.id !== datei.id));
  }

  async function starten() {
    setStartFehler(null);
    if (dateien.length === 0) {
      setStartFehler(t.fehler.keineDateien);
      return;
    }
    const alleLeer =
      referenzObjekt.trim() === "" &&
      referenzWert.trim() === "" &&
      referenzEinheit === "";
    const alleGefuellt =
      referenzObjekt.trim() !== "" &&
      referenzWert.trim() !== "" &&
      referenzEinheit !== "";
    if (!alleLeer && !alleGefuellt) {
      setStartFehler(t.fehler.referenzUnvollstaendig);
      return;
    }
    setStartLaeuft(true);
    const ergebnis = await starteMessungAction(projektId, {
      quality: qualitaet,
      referenceObject: referenzObjekt,
      referenceValue: referenzWert,
      referenceUnit: referenzEinheit,
    });
    if ("error" in ergebnis) {
      setStartFehler(ergebnis.error);
      setStartLaeuft(false);
      return;
    }
    router.push(`/app/projekt/${projektId}`);
    router.refresh();
  }

  const uploadsAktiv = laufende.length > 0;

  return (
    <div className="flex flex-col gap-7">
      {/* Dropzone */}
      <div>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragAktiv(true);
          }}
          onDragLeave={() => setDragAktiv(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragAktiv(false);
            void verarbeiteAuswahl(e.dataTransfer.files);
          }}
          className={cn(
            "flex flex-col items-center gap-3 rounded-[18px] border-2 border-dashed px-6 py-10 text-center transition-colors",
            dragAktiv
              ? "border-akzent bg-akzent/5"
              : "border-[#C9D4E2] bg-flaeche",
          )}
        >
          <p className="text-[15px] font-medium text-schrift-sekundaer">
            {t.dropTitel}
          </p>
          <p className="text-[13px] text-schrift-tertiaer">{t.dropOder}</p>
          <Button
            variante="sekundaer"
            onClick={() => eingabeRef.current?.click()}
          >
            {t.dropButton}
          </Button>
          <p className="font-mono text-xs text-schrift-tertiaer">
            {t.dropHinweis}
          </p>
          <input
            ref={eingabeRef}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.heic,.pdf"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void verarbeiteAuswahl(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {uploadFehler.length > 0 ? (
          <ul role="alert" className="mt-3 flex flex-col gap-1">
            {uploadFehler.map((meldung, i) => (
              <li key={i} className="text-sm text-fehler">
                {meldung}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* Kacheln */}
      {dateien.length > 0 || laufende.length > 0 ? (
        <div className="flex flex-wrap gap-3.5">
          {dateien.map((datei) => (
            <div key={datei.id} className="relative h-[108px] w-[108px]">
              <div className="h-full w-full overflow-hidden rounded-[14px] border border-linie bg-flaeche">
                {datei.kind === "photo" && datei.hatVorschau ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/dateien/${datei.id}?v=vorschau`}
                    alt={datei.originalName}
                    title={datei.originalName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div
                    title={datei.originalName}
                    className="schraffur flex h-full w-full flex-col items-center justify-center gap-1 px-1.5"
                  >
                    <span className="rounded-md border border-linie bg-flaeche/90 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-schrift-sekundaer">
                      {datei.kind === "pdf"
                        ? t.pdfBadge
                        : dateiEndungLabel(datei.originalName)}
                    </span>
                    {datei.kind === "pdf" && datei.pageCount ? (
                      <span className="font-mono text-[10px] text-schrift-tertiaer">
                        {datei.pageCount}{" "}
                        {datei.pageCount === 1
                          ? t.seiteEinzahl
                          : t.seitenMehrzahl}
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => void entfernen(datei)}
                aria-label={`${t.dateiEntfernen}: ${datei.originalName}`}
                className="absolute -right-[7px] -top-[7px] flex h-[22px] w-[22px] items-center justify-center rounded-full border border-linie bg-flaeche text-[11px] leading-none text-schrift-sekundaer shadow-karte transition hover:border-fehler hover:text-fehler"
              >
                ✕
              </button>
            </div>
          ))}

          {laufende.map((upload) => (
            <div
              key={upload.schluessel}
              className="h-[108px] w-[108px] overflow-hidden rounded-[14px] border border-linie bg-flaeche"
            >
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-2">
                <span className="w-full truncate text-center font-mono text-[10px] text-schrift-tertiaer">
                  {upload.name}
                </span>
                <div className="h-1 w-4/5 overflow-hidden rounded-full bg-linie">
                  <div
                    className={cn(
                      "h-full rounded-full bg-akzent transition-all",
                      upload.phase === "verarbeitung" && "animate-pulse",
                    )}
                    style={{
                      width:
                        upload.phase === "upload"
                          ? `${upload.fortschritt}%`
                          : "100%",
                    }}
                  />
                </div>
                <span className="font-mono text-[10px] text-schrift-tertiaer">
                  {upload.phase === "upload"
                    ? `${t.wirdHochgeladen} ${upload.fortschritt}%`
                    : `${t.wirdVerarbeitet}…`}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Messqualität */}
      <section>
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-schrift-sekundaer">
          {t.qualitaetLabel}
        </p>
        <div className="mt-2.5 grid grid-cols-1 overflow-hidden rounded-[14px] border border-linie bg-flaeche sm:grid-cols-2">
          {(
            [
              ["standard", t.qualitaetStandard, t.qualitaetStandardHinweis],
              ["premium", t.qualitaetPremium, t.qualitaetPremiumHinweis],
            ] as const
          ).map(([wert, titel, hinweis], index) => (
            <button
              key={wert}
              type="button"
              onClick={() => setQualitaet(wert)}
              aria-pressed={qualitaet === wert}
              className={cn(
                "flex flex-col items-start gap-1 px-[18px] py-3.5 text-left transition",
                index === 1 && "border-t border-linie sm:border-l sm:border-t-0",
                qualitaet === wert
                  ? "bg-akzent/5 ring-[1.5px] ring-inset ring-akzent"
                  : "hover:bg-hintergrund",
              )}
            >
              <span
                className={cn(
                  "text-sm font-semibold",
                  qualitaet === wert ? "text-akzent" : "text-schrift",
                )}
              >
                {titel}
              </span>
              <span className="text-xs text-schrift-sekundaer">{hinweis}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Referenzmaß (optional) */}
      <section>
        <p className="text-sm font-semibold text-schrift">
          {t.referenzTitel}{" "}
          <span className="font-normal text-schrift-sekundaer">
            {t.referenzOptional}
          </span>
        </p>
        <div className="mt-2.5 flex flex-col gap-3">
          <label className="flex max-w-[340px] flex-col gap-1.5">
            <span className="text-xs font-medium text-schrift-sekundaer">
              {t.referenzObjektLabel}
            </span>
            <input
              type="text"
              value={referenzObjekt}
              onChange={(e) => setReferenzObjekt(e.target.value)}
              placeholder={t.referenzObjektPlaceholder}
              maxLength={200}
              className="w-full rounded-eingabe border border-linie bg-flaeche px-4 py-[11px] font-mono text-sm text-schrift placeholder:text-schrift-tertiaer focus:border-akzent focus:outline-none focus:ring-2 focus:ring-akzent/20"
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <label className="flex w-[140px] flex-col gap-1.5">
              <span className="text-xs font-medium text-schrift-sekundaer">
                {t.referenzWertLabel}
              </span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={referenzWert}
                onChange={(e) => setReferenzWert(e.target.value)}
                placeholder={t.referenzWertPlaceholder}
                className="w-full rounded-eingabe border border-linie bg-flaeche px-4 py-[11px] font-mono text-sm text-schrift placeholder:text-schrift-tertiaer focus:border-akzent focus:outline-none focus:ring-2 focus:ring-akzent/20"
              />
            </label>
            <label className="flex w-[140px] flex-col gap-1.5">
              <span className="text-xs font-medium text-schrift-sekundaer">
                {t.referenzEinheitLabel}
              </span>
              <select
                value={referenzEinheit}
                onChange={(e) => setReferenzEinheit(e.target.value)}
                className="w-full rounded-eingabe border border-linie bg-flaeche px-3 py-[11px] font-mono text-sm text-schrift focus:border-akzent focus:outline-none focus:ring-2 focus:ring-akzent/20"
              >
                <option value="">{t.referenzEinheitLeer}</option>
                {EINHEITEN.map((einheit) => (
                  <option key={einheit} value={einheit}>
                    {t.einheiten[einheit]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </section>

      {/* Start */}
      <div className="flex flex-col gap-2">
        {startFehler ? (
          <p role="alert" className="text-sm text-fehler">
            {startFehler}
          </p>
        ) : null}
        <div>
          <Button
            variante="primaer"
            disabled={startLaeuft || uploadsAktiv}
            onClick={() => void starten()}
            className="px-7 py-3.5 text-[15px]"
          >
            {startLaeuft ? t.startLaeuft : t.startButton}
          </Button>
        </div>
      </div>
    </div>
  );
}
