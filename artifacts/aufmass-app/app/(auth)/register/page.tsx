import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { DEFAULT_LOCALE, getDictionary } from "@/i18n";
import { getCurrentUser } from "@/lib/auth/session";

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect("/app");

  // Vor dem Login gilt die Standardsprache (en-US).
  const t = getDictionary(DEFAULT_LOCALE).auth;

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
