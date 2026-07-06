import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { de } from "@/i18n/de";
import { getCurrentUser } from "@/lib/auth/session";

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect("/app");

  const t = de.auth;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium text-neutral-500">
        {de.common.appName}
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        {t.registerTitle}
      </h1>
      <p className="mt-1 text-neutral-500">{t.registerSubtitle}</p>
      <div className="mt-8">
        <RegisterForm />
      </div>
      <p className="mt-6 text-sm text-neutral-500">
        {t.alreadyHaveAccount}{" "}
        <Link
          href="/login"
          className="font-medium text-neutral-900 underline underline-offset-4"
        >
          {t.switchToLogin}
        </Link>
      </p>
    </main>
  );
}
