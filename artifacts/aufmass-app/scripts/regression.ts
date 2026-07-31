// Regressionstest der Messpipeline (Etappe 2c, docs/plan.md):
// misst ERGEBNISQUALITÄT gegen Ground-Truth-Werte aus
// test-fixtures/regression-cases.json – immer mit der ECHTEN
// Extraktion (nie der Stub, unabhängig von EXTRAKTOR_STUB).
//
// Aufruf (root):  pnpm regression [--list] [--case <id>] [--quality standard|premium]
// Direkt:         pnpm --filter @workspace/aufmass-app exec tsx scripts/regression.ts ...
//
// Jeder Lauf kostet echtes API-Geld – kein Scheduling, kein CI-Hook.
// Läufe sind intern: eigener Regressionsnutzer (taucht in keiner
// Kundenprojektliste auf, da Projektlisten strikt per userId filtern);
// im Admin-Messprotokoll erkennbar am Projektnamen "regression <case>".
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import bcrypt from "bcryptjs";
import { desc, eq } from "drizzle-orm";
import {
  db,
  measureRunsTable,
  projectFilesTable,
  projectsTable,
  usersTable,
  type ProjectClassification,
  type ProjectFile,
} from "@workspace/db";
import { getPrivateObjectDir, speichereObjekt } from "@/lib/storage/objectStorage";
import { renderePdfSeiten } from "@/lib/upload/verarbeitung";
import { mimeFuerName } from "@/lib/upload/regeln";
import { klassifiziereDateien } from "@/lib/klassifizierung/service";
import { fuehreMessLaufAus } from "@/lib/messung/pipeline";

const REGRESSION_EMAIL = "regression@snaptape.internal";

// ---------- Fälle laden ----------

interface ErwartungsObjekt {
  value?: number;
  tolerance_percent?: number;
  tolerance_abs?: number;
  one_of?: string[];
  estimate?: boolean;
  note?: string;
}
type Erwartung = ErwartungsObjekt | number | boolean;

interface Fall {
  id: string;
  route: "photo" | "plan" | "mixed";
  files: string[];
  user_reference: unknown;
  expect: Record<string, Erwartung> | null;
  $comment?: string;
}

interface FallDatei {
  fixture_dir: string;
  cases: Fall[];
  pass_rules: Record<string, string>;
}

// Repo-Wurzel finden (cwd ist artifacts/aufmass-app bei --filter exec).
function repoWurzel(): string {
  for (const kandidat of [process.cwd(), resolve(process.cwd(), "../..")]) {
    if (existsSync(join(kandidat, "test-fixtures/regression-cases.json"))) {
      return kandidat;
    }
  }
  throw new Error("test-fixtures/regression-cases.json nicht gefunden.");
}

const WURZEL = repoWurzel();

function ladeFaelle(): FallDatei {
  return JSON.parse(
    readFileSync(join(WURZEL, "test-fixtures/regression-cases.json"), "utf8"),
  ) as FallDatei;
}

// ---------- Metrik-Extraktion (Konventionen aus der Spez) ----------

type MessObjekt = { value?: unknown; source?: unknown } | null | undefined;

function messwert(x: unknown): number | null {
  const v = (x as MessObjekt)?.value;
  return typeof v === "number" ? v : null;
}

// Gepunkteter Pfad in das Measurement-JSON; Segmente wie
// per_elevation[front] wählen den Array-Eintrag mit elevation "front".
// Blatt ist ein Messobjekt -> dessen .value.
function aufloesenPfad(m: any, pfad: string): number | null {
  let akt: any = m;
  for (const seg of pfad.split(".")) {
    if (akt == null) return null;
    const idx = seg.match(/^(.+)\[(.+)\]$/);
    if (idx) {
      const arr = akt[idx[1]!];
      if (!Array.isArray(arr)) return null;
      akt = arr.find((e: any) => e?.elevation === idx[2]);
    } else {
      akt = akt[seg];
    }
  }
  return messwert(akt);
}

function dachFlaechen(m: any): any[] {
  return (Array.isArray(m?.faces) ? m.faces : []).filter(
    (f: any) => f?.face_class === "roof_face",
  );
}

function median(liste: number[]): number | null {
  if (!liste.length) return null;
  const s = [...liste].sort((a, b) => a - b);
  const mitte = Math.floor(s.length / 2);
  return s.length % 2 ? s[mitte]! : (s[mitte - 1]! + s[mitte]!) / 2;
}

// Ist-Wert einer Metrik nach den Schlüssel-Konventionen der Spez.
function istWert(m: any, schluessel: string): number | string | boolean | null {
  if (schluessel === "roof.type") {
    return typeof m?.building?.roof_type === "string" ? m.building.roof_type : null;
  }
  if (schluessel === "roof.median_pitch_deg") {
    const pitches = dachFlaechen(m)
      .map((f: any) => f?.pitch?.degrees_original)
      .filter((p: unknown): p is number => typeof p === "number" && p >= 10);
    return median(pitches);
  }
  if (schluessel === "sum.ridge_edges_mm") {
    const kanten = (Array.isArray(m?.edges) ? m.edges : []).filter(
      (e: any) => e?.edge_class === "ridge" && typeof e?.length_mm?.value === "number",
    );
    if (!kanten.length) return null;
    return kanten.reduce((s: number, e: any) => s + e.length_mm.value, 0);
  }
  if (schluessel === "counts.roof_faces_min") return dachFlaechen(m).length;
  if (schluessel === "counts.dormers_min") {
    return (Array.isArray(m?.attachments) ? m.attachments : []).filter(
      (a: any) => a?.type === "dormer",
    ).length;
  }
  if (schluessel === "quality.dimension_chains_min") {
    return Array.isArray(m?.quality?.dimension_chains)
      ? m.quality.dimension_chains.length
      : 0;
  }
  if (schluessel === "site.grade_falls_to_back") {
    const pe = m?.building?.heights?.per_elevation;
    return (Array.isArray(pe) ? pe : []).some(
      (e: any) =>
        e?.elevation === "back" &&
        typeof e?.grade_offset_mm?.value === "number" &&
        e.grade_offset_mm.value < -300,
    );
  }
  return aufloesenPfad(m, schluessel);
}

// ---------- Prüfung ----------

interface PruefZeile {
  metric: string;
  gt: string;
  actual: string;
  error: string;
  status: "pass" | "FAIL" | "info" | "estimate";
}

function pruefeErwartung(
  schluessel: string,
  erwartung: Erwartung,
  m: any,
  qualitaet: "standard" | "premium",
): PruefZeile {
  const faktor = qualitaet === "standard" ? 2 : 1;
  const ist = istWert(m, schluessel);

  // Nackte Zahl = Mindestanzahl (counts.*_min, dimension_chains_min).
  if (typeof erwartung === "number") {
    const ok = typeof ist === "number" && ist >= erwartung;
    return {
      metric: schluessel,
      gt: `>= ${erwartung}`,
      actual: String(ist ?? "—"),
      error: "",
      status: ok ? "pass" : "FAIL",
    };
  }
  // Boolescher Erwartungswert (site.grade_falls_to_back).
  if (typeof erwartung === "boolean") {
    const ok = ist === erwartung;
    return {
      metric: schluessel,
      gt: String(erwartung),
      actual: String(ist),
      error: "",
      status: ok ? "pass" : "FAIL",
    };
  }
  // one_of (roof.type).
  if (erwartung.one_of) {
    const ok = typeof ist === "string" && erwartung.one_of.includes(ist);
    return {
      metric: schluessel,
      gt: erwartung.one_of.join("|"),
      actual: String(ist ?? "—"),
      error: "",
      status: ok ? "pass" : erwartung.estimate ? "estimate" : "FAIL",
    };
  }
  // Zahl mit Toleranz.
  const gt = erwartung.value!;
  const toleranz =
    erwartung.tolerance_abs !== undefined
      ? erwartung.tolerance_abs * faktor
      : (Math.abs(gt) * (erwartung.tolerance_percent ?? 0) * faktor) / 100;
  if (typeof ist !== "number") {
    return {
      metric: schluessel,
      gt: String(gt),
      actual: "—",
      error: "missing",
      status: erwartung.estimate ? "estimate" : "FAIL",
    };
  }
  const abw = ist - gt;
  const ok = Math.abs(abw) <= toleranz;
  return {
    metric: schluessel,
    gt: `${gt} ±${Math.round(toleranz)}`,
    actual: String(Math.round(ist)),
    error: `${abw > 0 ? "+" : ""}${Math.round(abw)} (${((Math.abs(abw) / Math.abs(gt)) * 100).toFixed(1)}%)`,
    status: ok ? "pass" : erwartung.estimate ? "estimate" : "FAIL",
  };
}

// "always"-Regel: Ridge-Summe darf bei >1 Firstkante NIE reskaliert sein
// (Fix A3). Erkennbar an source "scaled" bzw. der Sum-Rescale-Warnung.
function pruefeImmerRegeln(m: any, warnungen: string[]): PruefZeile[] {
  const ridges = (Array.isArray(m?.edges) ? m.edges : []).filter(
    (e: any) => e?.edge_class === "ridge" && typeof e?.length_mm?.value === "number",
  );
  if (ridges.length <= 1) return [];
  const reskaliert =
    ridges.some((e: any) => e?.length_mm?.source === "scaled") ||
    warnungen.some((w) => w.includes("ridge length") && w.includes("rescaled"));
  return [
    {
      metric: "always.ridge_sum_not_rescaled",
      gt: "no rescale (A3)",
      actual: reskaliert ? "RESCALED" : "ok",
      error: "",
      status: reskaliert ? "FAIL" : "pass",
    },
  ];
}

// Fall-Kommentar verlangt: Höhen dürfen nie source "measured" tragen.
function pruefeHoehenNieGemessen(m: any): PruefZeile[] {
  const kandidaten: Array<[string, MessObjekt]> = [];
  const h = m?.building?.heights;
  if (h?.eave_height_mm) kandidaten.push(["heights.eave_height_mm", h.eave_height_mm]);
  if (h?.ridge_height_mm) kandidaten.push(["heights.ridge_height_mm", h.ridge_height_mm]);
  for (const e of Array.isArray(h?.per_elevation) ? h.per_elevation : []) {
    if (e?.eave_height_mm) kandidaten.push([`per_elevation[${e.elevation}].eave_height_mm`, e.eave_height_mm]);
    if (e?.ridge_height_mm) kandidaten.push([`per_elevation[${e.elevation}].ridge_height_mm`, e.ridge_height_mm]);
  }
  const gemessen = kandidaten.filter(
    ([, mo]) => typeof mo?.value === "number" && mo?.source === "measured",
  );
  return [
    {
      metric: "heights.never_measured",
      gt: "no height source 'measured'",
      actual: gemessen.length ? gemessen.map(([n]) => n).join(", ") : "ok",
      error: "",
      status: gemessen.length ? "FAIL" : "pass",
    },
  ];
}

// Smoke-Regeln (expect: null): Lauf komplett, schemavalide (model_ready),
// keine VALIDATION-Warnungen, faces/edges/openings nicht leer.
function pruefeSmoke(m: any, outcome: string, warnungen: string[]): PruefZeile[] {
  const zeilen: PruefZeile[] = [];
  zeilen.push({
    metric: "smoke.completed_valid",
    gt: "model_ready",
    actual: outcome,
    error: "",
    status: outcome === "model_ready" ? "pass" : "FAIL",
  });
  const validierungsWarnungen = warnungen.filter((w) => w.startsWith("VALIDATION"));
  zeilen.push({
    metric: "smoke.no_validation_warnings",
    gt: "0",
    actual: String(validierungsWarnungen.length),
    error: validierungsWarnungen[0] ?? "",
    status: validierungsWarnungen.length ? "FAIL" : "pass",
  });
  for (const feld of ["faces", "edges", "openings"] as const) {
    const arr = m?.[feld];
    const ok = Array.isArray(arr) && arr.length > 0;
    zeilen.push({
      metric: `smoke.${feld}_non_empty`,
      gt: "> 0",
      actual: String(Array.isArray(arr) ? arr.length : "—"),
      error: "",
      status: ok ? "pass" : "FAIL",
    });
  }
  return zeilen;
}

// ---------- Fixture-Registrierung wie ein echter Upload ----------

async function stelleRegressionsNutzerSicher(): Promise<string> {
  const [vorhanden] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, REGRESSION_EMAIL));
  if (vorhanden) return vorhanden.id;
  // Zufälliges, nirgends notiertes Passwort: das Konto ist nur Träger
  // interner Läufe, ein Login ist nie nötig.
  const passwordHash = await bcrypt.hash(crypto.randomUUID(), 12);
  const [nutzer] = await db
    .insert(usersTable)
    .values({ email: REGRESSION_EMAIL, passwordHash })
    .returning({ id: usersTable.id });
  return nutzer!.id;
}

// Registriert eine Fixture-Datei exakt wie der Upload-Fluss
// (lib/upload/actions.ts): Original speichern, project_files-Zeile,
// PDFs sofort seitenweise zu PNG rendern. (Browser-Vorschauen entfallen –
// sie werden von Klassifizierung/Pipeline nie gelesen.)
async function registriereFixture(
  projektId: string,
  relPfad: string,
  sortOrder: number,
): Promise<void> {
  const inhalt = readFileSync(join(WURZEL, "test-fixtures", relPfad));
  const originalName = relPfad.split("/").pop()!;
  const endung = originalName.slice(originalName.lastIndexOf(".") + 1).toLowerCase();
  const art = endung === "pdf" ? "pdf" : "photo";
  const objektBasis = crypto.randomUUID();
  const basisPfad = `${getPrivateObjectDir()}/projekte/${projektId}`;
  const objectPath = `${basisPfad}/original/${objektBasis}.${endung}`;
  await speichereObjekt(objectPath, inhalt, mimeFuerName(originalName));

  const [zeile] = await db
    .insert(projectFilesTable)
    .values({
      projectId: projektId,
      kind: art,
      originalName,
      mimeType: mimeFuerName(originalName),
      sizeBytes: inhalt.length,
      storagePath: objectPath,
      sortOrder,
    })
    .returning();

  if (art === "pdf") {
    const seiten = await renderePdfSeiten(inhalt);
    const seitenPfade: string[] = [];
    for (let i = 0; i < seiten.length; i++) {
      const seitenPfad = `${basisPfad}/seiten/${objektBasis}/seite-${i + 1}.png`;
      await speichereObjekt(seitenPfad, seiten[i]!, "image/png");
      seitenPfade.push(seitenPfad);
    }
    await db
      .update(projectFilesTable)
      .set({ pageCount: seiten.length, pageImagePaths: seitenPfade })
      .where(eq(projectFilesTable.id, zeile!.id));
  }
}

// ---------- Ein Fall, Ende zu Ende ----------

interface FallErgebnis {
  id: string;
  route: string;
  klassifizierteRoute: string | null;
  outcome: string;
  model: string | null;
  tokens: string;
  costUsd: number | null;
  dauerS: number;
  zeilen: PruefZeile[];
  fehler: string[];
  measurement: unknown;
  runMeta: unknown;
}

async function fuehreFallAus(
  fall: Fall,
  qualitaet: "standard" | "premium",
  nutzerId: string,
): Promise<FallErgebnis> {
  const start = Date.now();
  if (fall.user_reference !== null && fall.user_reference !== undefined) {
    // Bewusst explizit scheitern statt still zu ignorieren.
    throw new Error(`Fall ${fall.id}: user_reference wird noch nicht unterstützt.`);
  }

  const runId = crypto.randomUUID();
  const [projekt] = await db
    .insert(projectsTable)
    .values({
      userId: nutzerId,
      name: `regression ${fall.id}`,
      status: "processing",
      quality: qualitaet,
      currentRunId: runId,
    })
    .returning({ id: projectsTable.id });
  const pid = projekt!.id;

  for (let i = 0; i < fall.files.length; i++) {
    await registriereFixture(pid, fall.files[i]!, i);
  }

  // Echte Klassifizierung – identisch zu starteMessungAction.
  const dateien = await db
    .select()
    .from(projectFilesTable)
    .where(eq(projectFilesTable.projectId, pid))
    .orderBy(projectFilesTable.sortOrder, projectFilesTable.createdAt);
  const ergebnis = await klassifiziereDateien(dateien);

  const proDatei = new Map<string, (typeof ergebnis.einheiten)[number][]>();
  for (const e of ergebnis.einheiten) {
    const liste = proDatei.get(e.dateiId) ?? [];
    liste.push(e);
    proDatei.set(e.dateiId, liste);
  }
  for (const [dateiId, einheiten] of proDatei) {
    await db
      .update(projectFilesTable)
      .set({ classification: einheiten.map(({ dateiId: _weg, ...rest }) => rest) })
      .where(eq(projectFilesTable.id, dateiId));
  }
  const dateienMitKlassi: ProjectFile[] = dateien.map((d) => {
    const einheiten = proDatei.get(d.id);
    if (!einheiten) return d;
    return {
      ...d,
      classification: einheiten.map(({ dateiId: _weg, ...rest }) => rest),
    };
  });

  if (ergebnis.overall === "rejected") {
    return {
      id: fall.id,
      route: fall.route,
      klassifizierteRoute: ergebnis.projectType,
      outcome: "classification_rejected",
      model: null,
      tokens: "—",
      costUsd: null,
      dauerS: Math.round((Date.now() - start) / 1000),
      zeilen: [
        {
          metric: "classification",
          gt: "ok",
          actual: `rejected: ${ergebnis.rejectionReason ?? "?"}`,
          error: "",
          status: "FAIL",
        },
      ],
      fehler: [],
      measurement: null,
      runMeta: null,
    };
  }

  const klassifizierung: ProjectClassification = {
    projectType: ergebnis.projectType,
    depthBasis: ergebnis.depthBasis,
    expectedAccuracy: ergebnis.expectedAccuracy,
    referenceObjectsFound: ergebnis.referenceObjectsFound,
    planPagesUsable: ergebnis.planSeitenNutzbar,
    planPagesSelected: ergebnis.planSeitenGewaehlt,
    raw: ergebnis.raw,
    classifiedAt: new Date().toISOString(),
  };
  await db
    .update(projectsTable)
    .set({ classification: klassifizierung })
    .where(eq(projectsTable.id, pid));

  if (ergebnis.projectType !== fall.route) {
    console.warn(
      `  ! Klassifizierer wählte Route "${ergebnis.projectType}" statt erwartet "${fall.route}" – Lauf folgt der echten Klassifizierung.`,
    );
  }

  await fuehreMessLaufAus({
    projektId: pid,
    runId,
    quality: qualitaet,
    klassifizierung,
    dateien: dateienMitKlassi,
    referenz: null,
  });

  const [lauf] = await db
    .select()
    .from(measureRunsTable)
    .where(eq(measureRunsTable.projectId, pid))
    .orderBy(desc(measureRunsTable.createdAt))
    .limit(1);
  if (!lauf) throw new Error(`Fall ${fall.id}: kein measure_runs-Eintrag.`);

  const m: any = lauf.measureJson;
  const warnungen = (lauf.warnings ?? []).filter((w): w is string => typeof w === "string");
  const zeilen: PruefZeile[] = [];

  if (lauf.outcome !== "model_ready") {
    zeilen.push({
      metric: "run.outcome",
      gt: "model_ready",
      actual: lauf.outcome,
      error: (lauf.errors ?? []).join("; ").slice(0, 120),
      status: "FAIL",
    });
  } else if (fall.expect === null) {
    zeilen.push(...pruefeSmoke(m, lauf.outcome, warnungen));
    zeilen.push(...pruefeImmerRegeln(m, warnungen));
  } else {
    for (const [schluessel, erwartung] of Object.entries(fall.expect)) {
      zeilen.push(pruefeErwartung(schluessel, erwartung, m, qualitaet));
    }
    zeilen.push(...pruefeImmerRegeln(m, warnungen));
    if (/never\s+(be\s+|as\s+)?["']?measured/i.test(fall.$comment ?? "")) {
      zeilen.push(...pruefeHoehenNieGemessen(m));
    }
  }

  return {
    id: fall.id,
    route: fall.route,
    klassifizierteRoute: ergebnis.projectType,
    outcome: lauf.outcome,
    model: lauf.model,
    tokens: `${lauf.inputTokens ?? "?"}/${lauf.outputTokens ?? "?"}`,
    costUsd: lauf.costUsd,
    dauerS: Math.round((Date.now() - start) / 1000),
    zeilen,
    fehler: lauf.errors ?? [],
    measurement: lauf.measureJson,
    runMeta: {
      projectId: pid,
      runId,
      model: lauf.model,
      route: lauf.route,
      quality: qualitaet,
      outcome: lauf.outcome,
      inputTokens: lauf.inputTokens,
      outputTokens: lauf.outputTokens,
      costUsd: lauf.costUsd,
      durationMs: lauf.durationMs,
      retryUsed: lauf.retryUsed,
      repairUsed: lauf.repairUsed,
      warnings: warnungen,
      errors: lauf.errors,
    },
  };
}

// ---------- Ausgabe ----------

function druckeTabelle(e: FallErgebnis): void {
  console.log(
    `\n=== ${e.id} (route ${e.route}${e.klassifizierteRoute && e.klassifizierteRoute !== e.route ? ` → klassifiziert ${e.klassifizierteRoute}` : ""}) ===`,
  );
  console.log(
    `model=${e.model ?? "—"}  outcome=${e.outcome}  tokens=${e.tokens}  cost=$${e.costUsd?.toFixed(4) ?? "—"}  duration=${e.dauerS}s`,
  );
  const breiten = [46, 22, 26, 20, 8];
  const zeile = (a: string, b: string, c: string, d: string, s: string) =>
    console.log(
      `  ${a.padEnd(breiten[0]!)}${b.padEnd(breiten[1]!)}${c.padEnd(breiten[2]!)}${d.padEnd(breiten[3]!)}${s}`,
    );
  zeile("metric", "GT", "actual", "error", "status");
  for (const z of e.zeilen) zeile(z.metric, z.gt, z.actual, z.error, z.status);
}

function hatEchteFehler(e: FallErgebnis): boolean {
  return e.zeilen.some((z) => z.status === "FAIL");
}

// ---------- main ----------

async function main() {
  if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT) {
    throw new Error("Regressionstest ist nur für die Entwicklung gedacht.");
  }
  // Eisenregel: NIE der Stub, egal welche Dev-Flags gesetzt sind.
  if (process.env.EXTRAKTOR_STUB) {
    console.warn("EXTRAKTOR_STUB ist gesetzt – wird für Regressionsläufe ignoriert (echte Extraktion erzwungen).");
    delete process.env.EXTRAKTOR_STUB;
  }

  const argv = process.argv.slice(2);
  const nurFall = argv.includes("--case") ? argv[argv.indexOf("--case") + 1] : null;
  const qualitaet = (
    argv.includes("--quality") ? argv[argv.indexOf("--quality") + 1] : "premium"
  ) as "standard" | "premium";
  if (qualitaet !== "standard" && qualitaet !== "premium") {
    throw new Error(`Ungültige --quality: ${String(qualitaet)}`);
  }

  const datei = ladeFaelle();

  if (argv.includes("--list")) {
    console.log(`${datei.cases.length} Fälle:`);
    for (const f of datei.cases) {
      const art = f.expect === null ? "smoke" : `${Object.keys(f.expect).length} Metriken`;
      console.log(`  ${f.id.padEnd(20)} route=${f.route.padEnd(6)} files=${String(f.files.length).padEnd(3)} ${art}`);
    }
    return;
  }

  const faelle = nurFall ? datei.cases.filter((f) => f.id === nurFall) : datei.cases;
  if (!faelle.length) {
    throw new Error(`Unbekannter Fall: ${nurFall} (siehe --list).`);
  }

  const nutzerId = await stelleRegressionsNutzerSicher();
  const stempel = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const ergebnisDir = join(WURZEL, "test-results", stempel);
  mkdirSync(ergebnisDir, { recursive: true });

  const ergebnisse: FallErgebnis[] = [];
  for (const fall of faelle) {
    console.log(`\n>>> ${fall.id} (${qualitaet}) …`);
    let e: FallErgebnis;
    try {
      e = await fuehreFallAus(fall, qualitaet, nutzerId);
    } catch (fehler) {
      // "always"-Regel: kein Lauf darf mit unbehandeltem Fehler enden.
      e = {
        id: fall.id,
        route: fall.route,
        klassifizierteRoute: null,
        outcome: "error",
        model: null,
        tokens: "—",
        costUsd: null,
        dauerS: 0,
        zeilen: [
          {
            metric: "run.unhandled_error",
            gt: "none",
            actual: fehler instanceof Error ? fehler.message : String(fehler),
            error: "",
            status: "FAIL",
          },
        ],
        fehler: [fehler instanceof Error ? fehler.message : String(fehler)],
        measurement: null,
        runMeta: null,
      };
    }
    ergebnisse.push(e);
    druckeTabelle(e);
    writeFileSync(
      join(ergebnisDir, `${fall.id}.json`),
      JSON.stringify(
        {
          case: fall.id,
          quality: qualitaet,
          run: e.runMeta,
          assertions: e.zeilen,
          measurement: e.measurement,
        },
        null,
        2,
      ),
    );
  }

  // Zusammenfassung.
  console.log(`\n===== Zusammenfassung (${qualitaet}) =====`);
  let gesamtFehler = 0;
  for (const e of ergebnisse) {
    const fehler = e.zeilen.filter((z) => z.status === "FAIL").length;
    const bestanden = e.zeilen.filter((z) => z.status === "pass").length;
    gesamtFehler += fehler;
    console.log(
      `  ${e.id.padEnd(20)} ${fehler === 0 ? "PASS" : "FAIL"}  (${bestanden} pass, ${fehler} fail)  ${e.model ?? "—"}  $${e.costUsd?.toFixed(4) ?? "—"}  ${e.dauerS}s`,
    );
  }
  writeFileSync(
    join(ergebnisDir, "summary.json"),
    JSON.stringify(
      {
        quality: qualitaet,
        timestamp: stempel,
        cases: ergebnisse.map((e) => ({
          id: e.id,
          outcome: e.outcome,
          failed: e.zeilen.filter((z) => z.status === "FAIL").map((z) => z.metric),
          model: e.model,
          costUsd: e.costUsd,
          durationS: e.dauerS,
        })),
      },
      null,
      2,
    ),
  );
  console.log(`\nErgebnisse: ${ergebnisDir}`);
  process.exit(ergebnisse.some(hatEchteFehler) ? 1 : 0);
}

main().catch((f) => {
  console.error(f);
  process.exit(1);
});
