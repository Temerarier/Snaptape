"use client";

// Login-Formular im Design-System „Technical-Clean": Input/Button aus
// components/ui, Fehler kommen als deutsche Texte aus der Server-Action
// (noValidate unterdrückt die englischen Browser-Meldungen).
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { loginAction, type AuthState } from "@/lib/auth/actions";
import { de } from "@/i18n/de";

const initialState: AuthState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(
    loginAction,
    initialState,
  );
  const t = de.auth;

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
        autoComplete="current-password"
        required
        label={t.passwordLabel}
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
        {pending ? t.loginPending : t.loginButton}
      </Button>
    </form>
  );
}
