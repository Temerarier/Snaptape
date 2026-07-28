"use client";

// Ablehnungs-Modal des Klassifizierungs-Schritts: erscheint NUR, wenn
// die Messung mit den nutzbaren Dateien unmöglich ist. Listet
// ausschließlich die Problemdateien (Thumbnail + Klartext-Grund aus
// der Klassifizierer-Ausgabe) und bietet genau eine Aktion:
// „Entfernen & neu hochladen".
import type { Dictionary } from "@/i18n";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { AblehnungsPayload } from "@/lib/upload/actions";

type UploadTexte = Dictionary["upload"];

export interface AblehnungsModalProps {
  ablehnung: AblehnungsPayload | null;
  entfernenLaeuft: boolean;
  onEntfernen: () => void;
  onSchliessen: () => void;
  t: UploadTexte;
}

function thumbnailUrl(datei: AblehnungsPayload["dateien"][number]): string {
  return datei.kind === "pdf"
    ? `/dateien/${datei.id}?v=seite&nr=1`
    : `/dateien/${datei.id}?v=vorschau`;
}

export function AblehnungsModal({
  ablehnung,
  entfernenLaeuft,
  onEntfernen,
  onSchliessen,
  t,
}: AblehnungsModalProps) {
  if (!ablehnung) return null;
  const a = t.ablehnung;
  return (
    <Modal
      offen
      onSchliessen={onSchliessen}
      titel={a.titel}
      fussbereich={
        <Button
          variante="primaer"
          disabled={entfernenLaeuft}
          onClick={onEntfernen}
        >
          {entfernenLaeuft ? a.buttonLaeuft : a.button}
        </Button>
      }
    >
      {ablehnung.grundSatz ? (
        <p className="text-sm text-schrift-sekundaer">{ablehnung.grundSatz}</p>
      ) : null}
      <ul className="mt-4 space-y-3">
        {ablehnung.dateien.map((datei) => (
          <li key={datei.id} className="flex items-center gap-3">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-eingabe border border-linie bg-hintergrund">
              {datei.hatVorschau ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbnailUrl(datei)}
                  alt={datei.originalName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-mono text-[10px] text-schrift-tertiaer">
                  {datei.kind.toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-schrift">
                {datei.originalName}
              </p>
              <p className="text-sm text-fehler">{a.gruende[datei.grund]}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-schrift-sekundaer">
        {ablehnung.alleUnbrauchbar ? a.untertitelAlle : a.untertitel}
      </p>
    </Modal>
  );
}
