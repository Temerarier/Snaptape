"use client";

// Registrieren-Formular im Design-System „Technical-Clean": Input/Button
// aus components/ui, Fehler kommen als Texte aus der Server-Action
// (noValidate unterdrückt die Browser-Meldungen).
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useDictionary } from "@/i18n/LocaleProvider";
import { registerAction, type AuthState } from "@/lib/auth/actions";

const initialState: AuthState = {};

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(
    registerAction,
    initialState,
  );
  const t = useDictionary().auth;

  return (
    <form action={formAction} noValidate className="space-y-4">
      <Input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        label={t.emailLabel}
        placeholder={t.emailPlaceholder}
      />
      <Input
        id="password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        label={t.passwordLabel}
        hinweis={t.passwordHint}
      />
      {state.error ? (
        <p
          role="alert"
          className="rounded-eingabe border border-fehler/25 bg-fehler-flaeche px-3 py-2 text-sm font-medium text-fehler"
        >
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full py-2.5">
        {pending ? t.registerPending : t.registerButton}
      </Button>
    </form>
  );
}
