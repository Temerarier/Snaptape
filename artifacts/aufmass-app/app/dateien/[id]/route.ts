// Ausliefern hochgeladener Projektdateien (nur an den Eigentümer):
//   /dateien/<id>              → Original
//   /dateien/<id>?v=vorschau   → Foto-Browservorschau (JPEG)
//   /dateien/<id>?v=seite&nr=2 → gerenderte PDF-Seite (PNG)
// Route-Handler statt Server Action, damit <img src=…> direkt streamen
// kann; Auth über die Session, Ownership über den Projekt-Join.
// WICHTIG: Nicht unter /api/… – dieser Präfix gehört auf dem geteilten
// Proxy dem separaten API-Server-Artefakt und erreicht diese App nie.
import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db, projectFilesTable, projectsTable } from "@workspace/db";
import { getCurrentUser } from "@/lib/auth/session";
import { streameObjekt } from "@/lib/storage/objectStorage";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401 });

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return new Response(null, { status: 404 });

  const zeilen = await db
    .select({ datei: projectFilesTable })
    .from(projectFilesTable)
    .innerJoin(
      projectsTable,
      eq(projectFilesTable.projectId, projectsTable.id),
    )
    .where(
      and(eq(projectFilesTable.id, id), eq(projectsTable.userId, user.id)),
    )
    .limit(1);
  const datei = zeilen[0]?.datei;
  if (!datei) return new Response(null, { status: 404 });

  const variante = request.nextUrl.searchParams.get("v") ?? "original";

  if (variante === "vorschau") {
    if (!datei.previewPath) return new Response(null, { status: 404 });
    return streameObjekt(datei.previewPath, "image/jpeg");
  }

  if (variante === "seite") {
    const nr = Number(request.nextUrl.searchParams.get("nr") ?? "1");
    const seiten = datei.pageImagePaths ?? [];
    if (!Number.isInteger(nr) || nr < 1 || nr > seiten.length) {
      return new Response(null, { status: 404 });
    }
    return streameObjekt(seiten[nr - 1], "image/png");
  }

  return streameObjekt(datei.storagePath, datei.mimeType);
}
