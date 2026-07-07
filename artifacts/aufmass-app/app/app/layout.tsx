import Link from "next/link";
import { Suspense } from "react";
import { de } from "@/i18n/de";
import { requireUser } from "@/lib/auth/session";
import { HeaderSuche } from "@/components/projekte/HeaderSuche";
import { NewProjectDialog } from "@/components/projekte/NewProjectDialog";
import { UserMenu } from "@/components/auth/UserMenu";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="min-h-screen bg-hintergrund">
      <header className="border-b border-linie bg-flaeche">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-3">
          <Link href="/app" className="flex shrink-0 items-center gap-2.5">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-linie bg-hintergrund font-mono text-sm font-medium text-schrift-tertiaer"
            >
              {de.common.appName.charAt(0)}
            </span>
            <span className="text-lg font-bold tracking-tight text-schrift">
              {de.common.appName}
            </span>
          </Link>
          <div className="min-w-0 flex-1">
            <Suspense fallback={null}>
              <HeaderSuche />
            </Suspense>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <NewProjectDialog />
            <UserMenu email={user.email} />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
