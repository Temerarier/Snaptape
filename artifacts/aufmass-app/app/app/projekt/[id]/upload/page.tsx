// Upload-Seite eines Projekts (Etappe 1): Fotos & Plan-PDFs hochladen,
// Messqualität wählen, optional ein Referenzmaß angeben und die Messung
// starten. Layout nach docs/upload-reference.html (760-px-Spalte).
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db, projectFilesTable, projectsTable } from "@workspace/db";
import { getDictionary, toLocale } from "@/i18n";
import { requireUser } from "@/lib/auth/session";
import { UploadBereich } from "@/components/upload/UploadBereich";
import type { DateiInfo } from "@/lib/upload/actions";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function UploadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();

  const zeilen = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, id), eq(projectsTable.userId, user.id)))
    .limit(1);
  const projekt = zeilen[0];
  if (!projekt) notFound();

  const dateiZeilen = await db
    .select()
    .from(projectFilesTable)
    .where(eq(projectFilesTable.projectId, id))
    .orderBy(
      asc(projectFilesTable.sortOrder),
      asc(projectFilesTable.createdAt),
    );
  const dateien: DateiInfo[] = dateiZeilen.map((zeile) => ({
    id: zeile.id,
    kind: zeile.kind,
    originalName: zeile.originalName,
    sizeBytes: zeile.sizeBytes,
    pageCount: zeile.pageCount,
    hatVorschau: zeile.previewPath !== null,
  }));

  const dict = getDictionary(toLocale(user.locale));
  const t = dict.upload;

  return (
    <main className="mx-auto w-full max-w-[760px] px-6 py-10 sm:px-8">
      <Link
        href={`/app/projekt/${projekt.id}`}
        className="text-sm font-medium text-schrift-tertiaer underline-offset-4 transition hover:text-schrift hover:underline"
      >
        ← {t.zurueckZumProjekt}
      </Link>
      <h1 className="mt-4 text-[28px] font-bold tracking-[-0.02em] text-schrift">
        {t.title}
      </h1>
      <p className="mt-1.5 text-[15px] text-schrift-sekundaer">{t.subtitle}</p>

      <div className="mt-7">
        <UploadBereich
          projektId={projekt.id}
          initialeDateien={dateien}
          initialeQualitaet={projekt.quality}
          initialesReferenzObjekt={projekt.referenceObject ?? ""}
          initialerReferenzWert={
            projekt.referenceValue !== null ? String(projekt.referenceValue) : ""
          }
          initialeReferenzEinheit={projekt.referenceUnit ?? ""}
          t={t}
        />
      </div>
    </main>
  );
}
