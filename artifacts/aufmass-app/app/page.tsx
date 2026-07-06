import { pool } from "@workspace/db";
import { de } from "@/i18n/de";

export const dynamic = "force-dynamic";

async function checkDatabase(): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await pool.query("SELECT 1 AS ok");
    return { ok: result.rows[0]?.ok === 1 };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: process.env.NODE_ENV === "production" ? undefined : detail,
    };
  }
}

function StatusRow({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <li className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3">
      <span
        className={`mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${ok ? "bg-green-500" : "bg-red-500"}`}
        aria-hidden
      />
      <div>
        <p className="font-medium">{label}</p>
        {detail ? <p className="mt-0.5 text-sm text-neutral-500">{detail}</p> : null}
      </div>
    </li>
  );
}

export default async function HealthcheckPage() {
  const t = de.healthcheck;
  const db = await checkDatabase();
  const storageConfigured = Boolean(
    process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID &&
      process.env.PRIVATE_OBJECT_DIR,
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
      <p className="mt-1 text-neutral-500">{t.subtitle}</p>
      <ul className="mt-8 space-y-3">
        <StatusRow ok label={t.appRunning} />
        <StatusRow
          ok={db.ok}
          label={db.ok ? t.dbConnected : t.dbError}
          detail={db.error}
        />
        <StatusRow
          ok={storageConfigured}
          label={storageConfigured ? t.storageConfigured : t.storageMissing}
        />
      </ul>
    </main>
  );
}
