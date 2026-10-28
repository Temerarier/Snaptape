import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { DEFAULT_LOCALE, getDictionary } from "@/i18n";
import { getCurrentUser } from "@/lib/auth/session";
import { safeReturnTo } from "@/lib/auth/returnTo";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const target = safeReturnTo((await searchParams).returnTo);
  if (await getCurrentUser()) redirect(target);
  const t = getDictionary(DEFAULT_LOCALE).auth;
  return <AuthShell headline={t.loginTitle} intro={t.loginSubtitle}>
    <Link href={`/sign-in?redirect_url=${encodeURIComponent(target)}`}
      className="flex w-full justify-center rounded-eingabe bg-akzent px-4 py-3 font-medium text-white shadow-akzent">
      {t.signInOrCreate}
    </Link>
  </AuthShell>;
}
