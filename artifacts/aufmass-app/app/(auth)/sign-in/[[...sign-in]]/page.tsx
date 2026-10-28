import { SignIn } from "@clerk/nextjs";
import { AuthShell } from "@/components/auth/AuthShell";
import { DEFAULT_LOCALE, getDictionary } from "@/i18n";
import { safeReturnTo } from "@/lib/auth/returnTo";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ redirect_url?: string }> }) {
  const t = getDictionary(DEFAULT_LOCALE).auth;
  const target = safeReturnTo((await searchParams).redirect_url);
  return <AuthShell headline={t.loginTitle} intro={t.loginSubtitle}>
    <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" fallbackRedirectUrl={target} />
  </AuthShell>;
}
