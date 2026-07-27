"use server";

import { randomUUID } from "node:crypto";
import { and, count, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  db,
  projectFilesTable,
  projectsTable,
  type ProjectFile,
  type ProjectStatus,
} from "@workspace/db";
import { getDictionary, toLocale, type Dictionary } from "@/i18n";
import { requireUser } from "@/lib/auth/session";
import {
  erzeugeUploadUrl,
  getPrivateObjectDir,
  ladeObjekt,
  loescheObjekt,
  objektMetadaten,
  speichereObjekt,
} from "@/lib/storage/objectStorage";
import {
  MAX_DATEI_BYTES,
  MAX_DATEIEN_PRO_PROJEKT,
  dateiArt,
  mimeFuerName,
  pruefeNeueDateien,
  type Ablehnung,
  type NeueDatei,
} from "@/lib/upload/regeln";
import { erzeugeFotoVorschau, renderePdfSeiten } from "@/lib/upload/verarbeitung";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_NAME_LAENGE = 300;
const MAX_REFERENZ_TEXT_LAENGE = 200;

// Client-sichere Sicht auf eine Projektdatei (keine Storage-Pfade nach außen).
export interface DateiInfo {
  id: string;
  kind: "photo" | "pdf";
  originalName: string;
  sizeBytes: number;
  pageCount: number | null;
  hatVorschau: boolean;
}

export interface UploadZiel {
  name: string;
  objectPath: string;
  uploadUrl: string;
}

export type ReferenzEinheit = "mm" | "cm" | "m" | "inch" | "feet";
const REFERENZ_EINHEITEN: readonly ReferenzEinheit[] = [
  "mm",
  "cm",
  "m",
  "inch",
  "feet",
];

function zuDateiInfo(zeile: ProjectFile): DateiInfo {
  return {
    id: zeile.id,
    kind: zeile.kind,
    originalName: zeile.originalName,
    sizeBytes: zeile.sizeBytes,
    pageCount: zeile.pageCount,
    hatVorschau: zeile.previewPath !== null,
  };
}

// Eiserne Regel 7: Jede Abfrage ist auf den angemeldeten Nutzer gescoped.
async function ladeEigenesProjekt(projektId: string, userId: string) {
  if (!UUID_PATTERN.test(projektId)) return null;
  const zeilen = await db
    .select()
    .from(projectsTable)
    .where(
      and(eq(projectsTable.id, projektId), eq(projectsTable.userId, userId)),
    )
    .limit(1);
  return zeilen[0] ?? null;
}

async function zaehleDateien(projektId: string): Promise<number> {
  const [zeile] = await db
    .select({ anzahl: count() })
    .from(projectFilesTable)
    .where(eq(projectFilesTable.projectId, projektId));
  return zeile?.anzahl ?? 0;
}

function originalPrefix(projektId: string): string {
  return `${getPrivateObjectDir()}/projekte/${projektId}/original/`;
}

function revalidiereProjekt(projektId: string): void {
  revalidatePath("/app");
  revalidatePath(`/app/projekt/${projektId}`);
  revalidatePath(`/app/projekt/${projektId}/upload`);
}

async function uploadWoerterbuch(): Promise<{
  user: Awaited<ReturnType<typeof requireUser>>;
  t: Dictionary["upload"];
}> {
  const user = await requireUser();
  return { user, t: getDictionary(toLocale(user.locale)).upload };
}

// Schritt 1 des Uploads: signierte PUT-URLs für gültige Dateien ausstellen.
// Der Browser lädt damit direkt in den Object Storage (25-MB-Dateien
// laufen nie durch Server-Action-Bodies).
export async function holeUploadZieleAction(
  projektId: string,
  dateien: NeueDatei[],
): Promise<
  | { ziele: UploadZiel[]; abgelehnt: Ablehnung[] }
  | { error: string }
> {
  const { user, t } = await uploadWoerterbuch();
  const projekt = await ladeEigenesProjekt(projektId, user.id);
  if (!projekt) return { error: t.fehler.generisch };

  const eingaben = dateien
    .slice(0, 50)
    .map((d) => ({
      name: String(d.name ?? "").slice(0, MAX_NAME_LAENGE),
      sizeBytes: Number(d.sizeBytes ?? 0),
    }))
    .filter((d) => d.name.length > 0 && Number.isFinite(d.sizeBytes));

  const vorhandene = await zaehleDateien(projektId);
  const { akzeptiert, abgelehnt } = pruefeNeueDateien(vorhandene, eingaben);

  const ziele: UploadZiel[] = [];
  for (const datei of akzeptiert) {
    const endung = datei.art === "pdf" ? ".pdf" : datei.name.slice(datei.name.lastIndexOf(".")).toLowerCase();
    const objectPath = `${originalPrefix(projektId)}${randomUUID()}${endung}`;
    ziele.push({
      name: datei.name,
      objectPath,
      uploadUrl: await erzeugeUploadUrl(objectPath),
    });
  }

  return { ziele, abgelehnt };
}

// Schritt 2: Nach erfolgreichem PUT registriert der Client die Datei.
// Der Server prüft alles erneut anhand der Storage-Wahrheit (Größe,
// Anzahl, Pfad-Präfix) und verarbeitet direkt: PDF → Seitenbilder,
// Foto → Browservorschau.
export async function registriereDateiAction(
  projektId: string,
  meta: { objectPath: string; originalName: string },
): Promise<{ datei: DateiInfo } | { error: string }> {
  const { user, t } = await uploadWoerterbuch();
  const projekt = await ladeEigenesProjekt(projektId, user.id);
  if (!projekt) return { error: t.fehler.generisch };

  const objectPath = String(meta.objectPath ?? "");
  const originalName = String(meta.originalName ?? "")
    .trim()
    .slice(0, MAX_NAME_LAENGE);

  // Nur Pfade akzeptieren, die diese App für genau dieses Projekt
  // ausgestellt hat – sonst könnte ein Client fremde Objekte registrieren.
  const prefix = originalPrefix(projektId);
  if (!objectPath.startsWith(prefix) || objectPath.includes("..")) {
    return { error: t.fehler.generisch };
  }

  const art = dateiArt(originalName);
  if (art === null) return { error: t.fehler.typ };

  const meta_ = await objektMetadaten(objectPath);
  if (!meta_.exists) return { error: t.fehler.upload };
  if (meta_.sizeBytes > MAX_DATEI_BYTES) {
    // Signierte PUT-URLs erzwingen keine Größe – hier gilt die
    // Storage-Wahrheit, das zu große Objekt wird entfernt.
    await loescheObjekt(objectPath);
    return { error: t.fehler.zuGross };
  }

  // Dateiname des Objekts (UUID) als stabiler Schlüssel für Nebenpfade.
  const objektName = objectPath.slice(prefix.length);
  const objektBasis = objektName.replace(/\.[a-z0-9]+$/i, "");
  const basisPfad = `${getPrivateObjectDir()}/projekte/${projektId}`;

  // Anzahl-Limit atomar durchsetzen: Projektzeile sperren, zählen,
  // einfügen – parallele Registrierungen serialisieren sich an der
  // Sperre, das 10er-Limit kann nicht überholt werden. storage_path
  // ist zusätzlich UNIQUE gegen doppelte Registrierung.
  let einfuegung: { voll: true } | { voll: false; zeile: ProjectFile };
  try {
    einfuegung = await db.transaction(async (tx) => {
      await tx
        .select({ id: projectsTable.id })
        .from(projectsTable)
        .where(eq(projectsTable.id, projektId))
        .for("update");
      const [anzahlZeile] = await tx
        .select({ anzahl: count() })
        .from(projectFilesTable)
        .where(eq(projectFilesTable.projectId, projektId));
      const vorhandene = anzahlZeile?.anzahl ?? 0;
      if (vorhandene >= MAX_DATEIEN_PRO_PROJEKT) {
        return { voll: true } as const;
      }
      const [zeile] = await tx
        .insert(projectFilesTable)
        .values({
          projectId: projektId,
          kind: art,
          originalName,
          mimeType: mimeFuerName(originalName),
          sizeBytes: meta_.sizeBytes,
          storagePath: objectPath,
          sortOrder: vorhandene,
        })
        .returning();
      return { voll: false, zeile } as const;
    });
  } catch (fehler) {
    const code =
      (fehler as { code?: string }).code ??
      ((fehler as { cause?: { code?: string } }).cause?.code ?? "");
    if (code === "23505") {
      // Bereits registriert (UNIQUE storage_path). Objekt NICHT
      // löschen – es gehört zur bestehenden Zeile.
      return { error: t.fehler.generisch };
    }
    throw fehler;
  }
  if (einfuegung.voll) {
    await loescheObjekt(objectPath);
    return { error: t.fehler.zuViele };
  }
  const zeile = einfuegung.zeile;

  try {
    if (art === "pdf") {
      // PDF sofort rendern: ein PNG pro Seite (~3000 px lange Kante),
      // gespeichert neben dem Original.
      const original = await ladeObjekt(objectPath);
      const seiten = await renderePdfSeiten(original);
      const seitenPfade: string[] = [];
      for (let i = 0; i < seiten.length; i++) {
        const seitenPfad = `${basisPfad}/seiten/${objektBasis}/seite-${i + 1}.png`;
        await speichereObjekt(seitenPfad, seiten[i], "image/png");
        seitenPfade.push(seitenPfad);
      }
      const [aktualisiert] = await db
        .update(projectFilesTable)
        .set({ pageCount: seiten.length, pageImagePaths: seitenPfade })
        .where(eq(projectFilesTable.id, zeile.id))
        .returning();
      revalidiereProjekt(projektId);
      return { datei: zuDateiInfo(aktualisiert) };
    }

    // Foto: JPEG-Vorschau für den Browser (HEIC kann sonst nicht angezeigt
    // werden). Schlägt die Konvertierung fehl, bleibt previewPath null und
    // die UI zeigt einen Platzhalter – das Original ist unberührt.
    const original = await ladeObjekt(objectPath);
    const endung = objektName.slice(objektName.lastIndexOf(".") + 1);
    const vorschau = await erzeugeFotoVorschau(original, endung);
    if (vorschau) {
      const vorschauPfad = `${basisPfad}/vorschau/${objektBasis}.jpg`;
      await speichereObjekt(vorschauPfad, vorschau, "image/jpeg");
      const [aktualisiert] = await db
        .update(projectFilesTable)
        .set({ previewPath: vorschauPfad })
        .where(eq(projectFilesTable.id, zeile.id))
        .returning();
      revalidiereProjekt(projektId);
      return { datei: zuDateiInfo(aktualisiert) };
    }
    revalidiereProjekt(projektId);
    return { datei: zuDateiInfo(zeile) };
  } catch {
    // Explizit scheitern statt still ohne Seitenbilder weiterzumachen:
    // Datensatz und Objekt wieder entfernen, klare Fehlermeldung zurück.
    await db.delete(projectFilesTable).where(eq(projectFilesTable.id, zeile.id));
    await loescheObjekt(objectPath);
    return { error: t.fehler.verarbeitung };
  }
}

export async function entferneDateiAction(
  projektId: string,
  dateiId: string,
): Promise<{ ok: true; status: ProjectStatus } | { error: string }> {
  const { user, t } = await uploadWoerterbuch();
  const projekt = await ladeEigenesProjekt(projektId, user.id);
  if (!projekt || !UUID_PATTERN.test(dateiId)) {
    return { error: t.fehler.generisch };
  }

  const zeilen = await db
    .select()
    .from(projectFilesTable)
    .where(
      and(
        eq(projectFilesTable.id, dateiId),
        eq(projectFilesTable.projectId, projektId),
      ),
    )
    .limit(1);
  const datei = zeilen[0];
  if (!datei) return { error: t.fehler.generisch };

  // Erst die DB-Zeile, dann die Objekte (Best-Effort – verwaiste Objekte
  // sind unkritisch, verwaiste DB-Zeilen wären es nicht).
  await db.delete(projectFilesTable).where(eq(projectFilesTable.id, datei.id));
  const pfade = [
    datei.storagePath,
    ...(datei.previewPath ? [datei.previewPath] : []),
    ...(datei.pageImagePaths ?? []),
  ];
  await Promise.allSettled(pfade.map((pfad) => loescheObjekt(pfad)));

  // Ohne Dateien fällt ein hochgeladenes Projekt zurück auf Entwurf.
  let status: ProjectStatus = projekt.status;
  const verbleibend = await zaehleDateien(projektId);
  if (verbleibend === 0 && projekt.status === "files_uploaded") {
    await db
      .update(projectsTable)
      .set({ status: "draft" })
      .where(eq(projectsTable.id, projektId));
    status = "draft";
  }

  revalidiereProjekt(projektId);
  return { ok: true, status };
}

// „Messung starten": speichert Qualität + optionales Referenzmaß und
// setzt den Status auf files_uploaded. Die Pipeline (Etappe 2) hängt
// später genau hier ein – bis dahin bleibt der Status stehen.
export async function starteMessungAction(
  projektId: string,
  eingabe: {
    quality: string;
    referenceObject: string;
    referenceValue: string;
    referenceUnit: string;
  },
): Promise<{ ok: true } | { error: string }> {
  const { user, t } = await uploadWoerterbuch();
  const projekt = await ladeEigenesProjekt(projektId, user.id);
  if (!projekt) return { error: t.fehler.generisch };

  // Statusmaschine: Start nur aus draft/files_uploaded/failed. Die
  // Alt-Stati reviewing/ready (Demo-Seed) bleiben unangetastet – sonst
  // würde der bestehende Viewer-Fluss zurückgesetzt. processing/
  // model_ready übernimmt die Pipeline in Etappe 2.
  const START_ERLAUBT: readonly ProjectStatus[] = [
    "draft",
    "files_uploaded",
    "failed",
  ];
  if (!START_ERLAUBT.includes(projekt.status)) {
    return { error: t.fehler.statusUngueltig };
  }

  // Keine stille Korrektur unbekannter Werte (explizit scheitern).
  if (eingabe.quality !== "standard" && eingabe.quality !== "premium") {
    return { error: t.fehler.generisch };
  }
  const quality = eingabe.quality;

  const referenzText = String(eingabe.referenceObject ?? "")
    .trim()
    .slice(0, MAX_REFERENZ_TEXT_LAENGE);
  const wertRoh = String(eingabe.referenceValue ?? "").trim();
  const einheitRoh = String(eingabe.referenceUnit ?? "").trim();

  const alleLeer = referenzText === "" && wertRoh === "" && einheitRoh === "";
  let referenceObject: string | null = null;
  let referenceValue: number | null = null;
  let referenceUnit: ReferenzEinheit | null = null;

  if (!alleLeer) {
    // Referenzmaß nur komplett oder gar nicht (Freitext + Wert + Einheit),
    // damit die Pipeline später einen vollständigen references[]-Eintrag
    // mit scale_type "user_provided" erzeugen kann.
    const wert = Number(wertRoh.replace(",", "."));
    const einheitGueltig = (REFERENZ_EINHEITEN as readonly string[]).includes(
      einheitRoh,
    );
    if (
      referenzText === "" ||
      !Number.isFinite(wert) ||
      wert <= 0 ||
      !einheitGueltig
    ) {
      return { error: t.fehler.referenzUnvollstaendig };
    }
    referenceObject = referenzText;
    referenceValue = wert;
    referenceUnit = einheitRoh as ReferenzEinheit;
  }

  const anzahl = await zaehleDateien(projektId);
  if (anzahl === 0) return { error: t.fehler.keineDateien };

  // Status-Guard auch im WHERE: falls sich der Status zwischen Prüfung
  // und Update ändert, schlägt das Update sichtbar fehl statt still
  // einen unerlaubten Übergang zu schreiben.
  const aktualisiert = await db
    .update(projectsTable)
    .set({
      quality,
      referenceObject,
      referenceValue,
      referenceUnit,
      status: "files_uploaded",
    })
    .where(
      and(
        eq(projectsTable.id, projektId),
        inArray(projectsTable.status, [...START_ERLAUBT]),
      ),
    )
    .returning({ id: projectsTable.id });
  if (aktualisiert.length === 0) {
    return { error: t.fehler.statusUngueltig };
  }

  revalidiereProjekt(projektId);
  return { ok: true };
}
