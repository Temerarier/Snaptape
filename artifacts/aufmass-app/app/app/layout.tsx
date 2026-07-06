import Link from "next/link";
import { de } from "@/i18n/de";
import { logoutAction } from "@/lib/auth/actions";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/app" className="font-semibold tracking-tight">
            {de.common.appName}
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
            >
              {de.common.logout}
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
