import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { de } from "@/i18n/de";
import { getCurrentUser } from "@/lib/auth/session";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/app");

  const t = de.auth;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium text-neutral-500">
        {de.common.appName}
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        {t.loginTitle}
      </h1>
      <p className="mt-1 text-neutral-500">{t.loginSubtitle}</p>
      <div className="mt-8">
        <LoginForm />
      </div>
      <p className="mt-6 text-sm text-neutral-500">
        {t.noAccountYet}{" "}
        <Link
          href="/registrieren"
          className="font-medium text-neutral-900 underline underline-offset-4"
        >
          {t.switchToRegister}
        </Link>
      </p>
    </main>
  );
}
