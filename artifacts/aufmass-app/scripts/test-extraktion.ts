// Entwicklungs-Testtreiber für die echte Extraktion: legt Wegwerf-
// Projekte für die Routen photo/plan/mixed an (unter dem Testnutzer)
// und lässt die Pipeline mit echten Modellaufrufen laufen.
// Aufruf: pnpm --filter @workspace/aufmass-app exec tsx scripts/test-extraktion.ts [route] [quality]
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import {
  db,
  measureRunsTable,
  projectsTable,
  usersTable,
  type ProjectClassification,
  type ProjectFile,
} from "@workspace/db";
import { getPrivateObjectDir, speichereObjekt } from "@/lib/storage/objectStorage";
import { fuehreMessLaufAus } from "@/lib/messung/pipeline";

const FOTO_PFADE = [
  "/replit-objstore-683e0ee7-77c3-4f20-9228-aeb9f3bc1232/.private/projekte/2271dc5c-ab3a-4467-befb-62a5618a32d9/original/497f0a42-5188-4df1-a84e-5aa055d275f9.jpeg",
  "/replit-objstore-683e0ee7-77c3-4f20-9228-aeb9f3bc1232/.private/projekte/2271dc5c-ab3a-4467-befb-62a5618a32d9/original/868b742a-e1f6-446d-92fe-cf70a6f08756.jpeg",
];

function fotoDatei(projektId: string, i: number): ProjectFile {
  return {
    id: `00000000-0000-0000-0000-00000000000${i}`,
    projectId: projektId,
    kind: "photo",
    originalName: `IMG_196${i === 0 ? 3 : 6}.jpeg`,
    mimeType: "image/jpeg",
    storagePath: FOTO_PFADE[i]!,
    pageCount: null,
    pageImagePaths: null,
    sortOrder: i,
    classification: [
      {
        page: 1,
        class: "photo_exterior",
        usable: true,
        elevation: "front",
        occludedPercent: i === 0 ? 15 : 20,
        hasDimensions: false,
        selectedForMeasurement: true,
      },
    ],
  } as unknown as ProjectFile;
}

function planDatei(projektId: string, planPngPfad: string): ProjectFile {
  return {
    id: "00000000-0000-0000-0000-000000000009",
    projectId: projektId,
    kind: "pdf",
    originalName: "front-elevation.pdf",
    mimeType: "application/pdf",
    storagePath: planPngPfad.replace(".png", ".pdf"),
    pageCount: 1,
    pageImagePaths: [planPngPfad],
    sortOrder: 5,
    classification: [
      {
        page: 1,
        class: "elevation",
        usable: true,
        elevation: "front",
        occludedPercent: null,
        hasDimensions: true,
        selectedForMeasurement: true,
      },
    ],
  } as unknown as ProjectFile;
}

function klassifizierung(typ: string): ProjectClassification {
  return {
    projectType: typ,
    depthBasis: typ === "photo" ? "oblique_only" : "plan_dimensions",
    expectedAccuracy: typ === "photo" ? "medium" : "high",
    referenceObjectsFound: ["entry door", "windows"],
    planPagesUsable: typ === "photo" ? 0 : 1,
    planPagesSelected: typ === "photo" ? 0 : 1,
    raw: { test: true },
    classifiedAt: new Date().toISOString(),
  };
}

async function main() {
  const nurRoute = process.argv[2] ?? null;
  const nurQualitaet = process.argv[3] ?? null;

  const [tester] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, "test@snaptape.de"));
  if (!tester) throw new Error("Testnutzer fehlt (seed-testdaten.ts laufen lassen).");

  // Plan-PNG hochladen (einmalig, fester Pfad).
  const planPng = `${getPrivateObjectDir()}/test-extraktion/plan-page-1.png`;
  await speichereObjekt(planPng, readFileSync("/tmp/plan-page-1.png"), "image/png");

  const kombis: Array<{ route: string; quality: "standard" | "premium" }> = [];
  for (const route of ["photo", "plan", "mixed"]) {
    for (const quality of ["standard", "premium"] as const) {
      if (nurRoute && route !== nurRoute) continue;
      if (nurQualitaet && quality !== nurQualitaet) continue;
      kombis.push({ route, quality });
    }
  }

  for (const { route, quality } of kombis) {
    const runId = crypto.randomUUID();
    const [projekt] = await db
      .insert(projectsTable)
      .values({
        userId: tester.id,
        name: `extraktion-test ${route}/${quality}`,
        status: "processing",
        quality,
        currentRunId: runId,
        classification: klassifizierung(route),
        referenceObject: route === "photo" ? "entry door height" : null,
        referenceValue: route === "photo" ? 2.03 : null,
        referenceUnit: route === "photo" ? "m" : null,
      })
      .returning();
    const pid = projekt!.id;
    const dateien: ProjectFile[] =
      route === "photo"
        ? [fotoDatei(pid, 0), fotoDatei(pid, 1)]
        : route === "plan"
          ? [planDatei(pid, planPng)]
          : [fotoDatei(pid, 0), fotoDatei(pid, 1), planDatei(pid, planPng)];

    console.log(`\n=== ${route} / ${quality} (Projekt ${pid}) ===`);
    const start = Date.now();
    await fuehreMessLaufAus({
      projektId: pid,
      runId,
      quality,
      klassifizierung: klassifizierung(route),
      dateien,
    });
    const [lauf] = await db
      .select()
      .from(measureRunsTable)
      .where(eq(measureRunsTable.projectId, pid));
    const [nachher] = await db
      .select({ status: projectsTable.status, fehler: projectsTable.measurementErrors })
      .from(projectsTable)
      .where(eq(projectsTable.id, pid));
    console.log({
      dauerS: Math.round((Date.now() - start) / 1000),
      projektStatus: nachher?.status,
      outcome: lauf?.outcome,
      model: lauf?.model,
      route: lauf?.route,
      tokens: `${lauf?.inputTokens}/${lauf?.outputTokens}`,
      costUsd: lauf?.costUsd,
      retry: lauf?.retryUsed,
      repair: lauf?.repairUsed,
      roofAreaMm2: lauf?.roofAreaMm2,
      netWallAreaMm2: lauf?.netWallAreaMm2,
      openings: lauf?.openingCount,
      warnungen: lauf?.warnings?.length,
      fehler: lauf?.errors,
    });
  }
  process.exit(0);
}

main().catch((f) => {
  console.error(f);
  process.exit(1);
});
