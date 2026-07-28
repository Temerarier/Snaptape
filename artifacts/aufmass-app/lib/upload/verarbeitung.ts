// Serverseitige Datei-Verarbeitung direkt nach dem Upload (Etappe 1):
// – PDFs: ein PNG pro Seite, ~3000 px lange Kante (pdftoppm/Poppler).
//   Alle späteren KI-Aufrufe nutzen NUR diese Seitenbilder, nie das PDF.
// – Fotos: kleine JPEG-Browservorschau (vipsthumbnail/libvips, kann HEIC).
//   Originale bleiben unverändert (Downscaling für KI kommt später).
// Poppler und libvips sind als System-Abhängigkeiten deklariert, damit
// beides auch im Deployment vorhanden ist.
import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// Lange Kante der gerenderten PDF-Seiten (laut Vorgabe ~3000 px).
const SEITEN_LANGE_KANTE_PX = 3000;
// Browservorschau: klein genug für die Kachel-Ansicht, JPEG-Qualität 82.
const VORSCHAU_KANTE_PX = 800;

async function inTempVerzeichnis<T>(
  arbeit: (verzeichnis: string) => Promise<T>,
): Promise<T> {
  const verzeichnis = await mkdtemp(join(tmpdir(), "aufmass-upload-"));
  try {
    return await arbeit(verzeichnis);
  } finally {
    await rm(verzeichnis, { recursive: true, force: true });
  }
}

// Rendert jede PDF-Seite als PNG-Buffer in Seitenreihenfolge.
// Wirft bei kaputten PDFs – der Aufrufer räumt dann auf und meldet den
// Fehler explizit (kein stilles Weiterlaufen ohne Seitenbilder).
export async function renderePdfSeiten(pdf: Buffer): Promise<Buffer[]> {
  return inTempVerzeichnis(async (verzeichnis) => {
    const pdfPfad = join(verzeichnis, "eingabe.pdf");
    await writeFile(pdfPfad, pdf);

    await execFileAsync(
      "pdftoppm",
      ["-png", "-scale-to", String(SEITEN_LANGE_KANTE_PX), pdfPfad, "seite"],
      { cwd: verzeichnis, timeout: 180_000 },
    );

    // pdftoppm nummeriert ggf. mit führenden Nullen (seite-01.png) –
    // deshalb numerisch statt alphabetisch sortieren.
    const namen = (await readdir(verzeichnis))
      .filter((name) => /^seite-\d+\.png$/.test(name))
      .sort((a, b) => {
        const na = Number(a.replace(/\D/g, ""));
        const nb = Number(b.replace(/\D/g, ""));
        return na - nb;
      });

    if (namen.length === 0) {
      throw new Error("pdftoppm hat keine Seiten erzeugt.");
    }

    return Promise.all(
      namen.map((name) => readFile(join(verzeichnis, name))),
    );
  });
}

// Verkleinert ein Bild (Foto-Original oder gerenderte PDF-Seite) für
// KI-Aufrufe: JPEG, lange Kante ~1400 px. Wirft bei Fehlern – der
// Klassifizierer darf nie stillschweigend ohne Bild weiterlaufen.
const KI_KANTE_PX = 1400;

export async function verkleinereFuerKI(
  bild: Buffer,
  dateiEndung: string,
): Promise<Buffer> {
  const endung = dateiEndung.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
  return inTempVerzeichnis(async (verzeichnis) => {
    const eingabe = `eingabe.${endung}`;
    await writeFile(join(verzeichnis, eingabe), bild);
    await execFileAsync(
      "vipsthumbnail",
      [
        eingabe,
        "--size",
        `${KI_KANTE_PX}x${KI_KANTE_PX}`,
        "-o",
        "ki.jpg[Q=80]",
      ],
      { cwd: verzeichnis, timeout: 60_000 },
    );
    return readFile(join(verzeichnis, "ki.jpg"));
  });
}

// Erzeugt eine JPEG-Vorschau für ein Foto. Liefert null, wenn die
// Konvertierung nicht möglich ist (z. B. exotisches HEIC-Profil) – die
// UI zeigt dann einen Platzhalter; das Original bleibt unangetastet.
export async function erzeugeFotoVorschau(
  foto: Buffer,
  dateiEndung: string,
): Promise<Buffer | null> {
  const endung = dateiEndung.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
  try {
    return await inTempVerzeichnis(async (verzeichnis) => {
      const eingabe = `eingabe.${endung}`;
      await writeFile(join(verzeichnis, eingabe), foto);
      await execFileAsync(
        "vipsthumbnail",
        [
          eingabe,
          "--size",
          `${VORSCHAU_KANTE_PX}x${VORSCHAU_KANTE_PX}`,
          "-o",
          "vorschau.jpg[Q=82]",
        ],
        { cwd: verzeichnis, timeout: 60_000 },
      );
      return readFile(join(verzeichnis, "vorschau.jpg"));
    });
  } catch {
    return null;
  }
}
