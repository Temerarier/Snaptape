import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { de } from "@/i18n/de";
import { getCurrentUser } from "@/lib/auth/session";

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect("/app");

  const t = de.auth;

  return (
    <AuthShell headline={t.registerTitle} intro={t.registerSubtitle}>
      <RegisterForm />
      <p className="mt-6 text-sm text-schrift-sekundaer">
        {t.alreadyHaveAccount}{" "}
        <Link href="/login" className="font-medium text-akzent hover:underline">
          {t.switchToLogin}
        </Link>
      </p>
    </AuthShell>
  );
}
