import { SignUp } from "@clerk/nextjs";
import { AuthShell } from "@/components/auth/AuthShell";
import { DEFAULT_LOCALE, getDictionary } from "@/i18n";
export default function SignUpPage() {
  const t = getDictionary(DEFAULT_LOCALE).auth;
  return <AuthShell headline={t.registerTitle} intro={t.registerSubtitle}>
    <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" fallbackRedirectUrl="/app" />
  </AuthShell>;
}
