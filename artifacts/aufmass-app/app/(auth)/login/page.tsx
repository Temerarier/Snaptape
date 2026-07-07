import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { de } from "@/i18n/de";
import { getCurrentUser } from "@/lib/auth/session";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/app");

  const t = de.auth;

  return (
    <AuthShell headline={t.loginTitle} intro={t.loginSubtitle}>
      <LoginForm />
      <p className="mt-6 text-sm text-schrift-sekundaer">
        {t.noAccountYet}{" "}
        <Link
          href="/registrieren"
          className="font-medium text-akzent hover:underline"
        >
          {t.switchToRegister}
        </Link>
      </p>
    </AuthShell>
  );
}
