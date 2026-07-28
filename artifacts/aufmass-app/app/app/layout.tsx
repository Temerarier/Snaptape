import Link from "next/link";
import { Suspense } from "react";
import { getDictionary, toLocale } from "@/i18n";
import { requireUser } from "@/lib/auth/session";
import { istStaff } from "@/lib/auth/staff";
import { HeaderSuche } from "@/components/projekte/HeaderSuche";
import { NewProjectButton } from "@/components/projekte/NewProjectButton";
import { UserMenu } from "@/components/auth/UserMenu";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
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
          <div className="min-w-0 flex-1">
            <Suspense fallback={null}>
              <HeaderSuche />
            </Suspense>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {istStaff(user.email) ? (
              <Link
                href="/admin/measurements"
                className="text-sm font-medium text-schrift-sekundaer hover:text-schrift"
              >
                {dict.admin.navLink}
              </Link>
            ) : null}
            <NewProjectButton />
            <UserMenu email={user.email} />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
