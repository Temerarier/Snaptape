// NUR ENTWICKLUNG: stößt einen Extraktions-Testlauf an (Route/Qualität
// per Query), ohne den Upload-Flow zu durchlaufen. Läuft im Prozess des
// Dev-Servers weiter, Ergebnis landet in measure_runs (per DB prüfen).
// In Produktion hart deaktiviert. Bewusst NICHT unter /api/* (Proxy).
import { readFileSync } from "node:fs";
import { NextResponse, type NextRequest } from "next/server";
import {
  db,
  projectsTable,
  usersTable,
  type ProjectClassification,
  type ProjectFile,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { fuehreMessLaufAus } from "@/lib/messung/pipeline";
import {
  getPrivateObjectDir,
  speichereObjekt,
} from "@/lib/storage/objectStorage";

export const dynamic = "force-dynamic";

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

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT) {
    return NextResponse.json({ error: "not available" }, { status: 404 });
  }
  const route = request.nextUrl.searchParams.get("route") ?? "photo";
  const quality = (request.nextUrl.searchParams.get("quality") ?? "standard") as
    | "standard"
    | "premium";
  if (!["photo", "plan", "mixed"].includes(route)) {
    return NextResponse.json({ error: "bad route" }, { status: 400 });
  }

  const [tester] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, "test@snaptape.de"));
  if (!tester) {
    return NextResponse.json({ error: "Testnutzer fehlt" }, { status: 500 });
  }

  const planPng = `${getPrivateObjectDir()}/test-extraktion/plan-page-1.png`;
  if (route !== "photo") {
    await speichereObjekt(
      planPng,
      readFileSync("/tmp/plan-page-1.png"),
      "image/png",
    );
  }

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

  // Fire-and-forget: Lauf läuft im Dev-Server-Prozess weiter; das
  // Ergebnis steht danach in measure_runs / projects.
  void fuehreMessLaufAus({
    projektId: pid,
    runId,
    quality,
    klassifizierung: klassifizierung(route),
    dateien,
  }).catch((f) => console.error("extraktion-test:", f));

  return NextResponse.json({ started: true, projektId: pid, route, quality });
}
