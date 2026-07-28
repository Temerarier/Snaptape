// Admin-Bereich (nur Staff, dauerhaftes internes Werkzeug): das Layout
// erzwingt den serverseitigen Staff-Check für JEDE /admin-Route –
// Nicht-Staff bekommt 404 aus requireStaff(), bevor irgendetwas rendert.
// Seiten unterhalb prüfen zusätzlich selbst (Defense in depth).
import Link from "next/link";
import { getDictionary, toLocale } from "@/i18n";
import { requireStaff } from "@/lib/auth/staff";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireStaff();
  const dict = getDictionary(toLocale(user.locale));

  return (
    <div className="min-h-screen bg-hintergrund">
      <header className="border-b border-linie bg-flaeche">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-3">
          <Link href="/app" className="flex shrink-0 items-center gap-2.5">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-linie bg-hintergrund font-mono text-sm font-medium text-schrift-tertiaer"
            >
              {dict.common.appName.charAt(0)}
            </span>
            <span className="text-lg font-bold tracking-tight text-schrift">
              {dict.common.appName}
            </span>
          </Link>
          <span className="rounded-full border border-linie bg-hintergrund px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-schrift-tertiaer">
            {dict.admin.navLink}
          </span>
          <div className="flex-1" />
          <Link
            href="/app"
            className="text-sm text-schrift-sekundaer hover:text-schrift"
          >
            {dict.admin.zurueckZurApp}
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
