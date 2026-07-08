import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { DEFAULT_LOCALE, getDictionary } from "@/i18n";
import { getCurrentUser } from "@/lib/auth/session";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/app");

  // Vor dem Login gilt die Standardsprache (en-US).
  const t = getDictionary(DEFAULT_LOCALE).auth;

  return (
    <AuthShell headline={t.loginTitle} intro={t.loginSubtitle}>
      <LoginForm />
      <p className="mt-6 text-sm text-schrift-sekundaer">
        {t.noAccountYet}{" "}
        <Link
          href="/register"
          className="font-medium text-akzent hover:underline"
        >
          {t.switchToRegister}
        </Link>
      </p>
    </AuthShell>
  );
}
