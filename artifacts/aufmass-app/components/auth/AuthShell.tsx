// Gemeinsamer Rahmen der Auth-Seiten (Login/Registrieren) im Stil des
// Mockups: eine große Karte mit Formular-Spalte links (Logo, Headline,
// Intro, Formular) und der 3D-Haus-Bühne rechts. Die Bühne ist rein
// dekorativ und wird auf kleinen Bildschirmen ausgeblendet.
// Server-Komponente: lädt das Testhaus-Fixture und reicht es an die
// Client-Bühne weiter.
import type { ReactNode } from "react";
import { de } from "@/i18n/de";
import { ladeTesthaus } from "@/lib/messung/testhaus";
import { HausBuehne } from "./HausBuehne";

export interface AuthShellProps {
  headline: string;
  intro: string;
  children: ReactNode;
}

export function AuthShell({ headline, intro, children }: AuthShellProps) {
  const mess = ladeTesthaus();

  return (
    <main className="flex min-h-screen items-center justify-center p-4 sm:p-6">
      <div className="flex min-h-[min(44rem,calc(100vh-3rem))] w-full max-w-6xl overflow-hidden rounded-karte-gross border border-linie bg-flaeche shadow-karte">
        <div className="flex w-full flex-col p-8 sm:p-10 lg:w-[26rem] lg:shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-linie bg-hintergrund font-mono text-sm font-medium text-schrift-tertiaer">
              {de.common.appName.charAt(0)}
            </span>
            <span className="text-sm font-semibold text-schrift">
              {de.common.appName}
            </span>
          </div>
          <div className="flex flex-1 flex-col justify-center py-10">
            <h1 className="text-3xl font-semibold leading-tight tracking-tight text-schrift">
              {headline}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-schrift-sekundaer">
              {intro}
            </p>
            <div className="mt-8">{children}</div>
          </div>
        </div>
        <div className="relative hidden flex-1 border-l border-linie lg:block">
          <HausBuehne mess={mess} />
          <p className="pointer-events-none absolute inset-x-0 bottom-5 text-center font-mono text-xs text-schrift-tertiaer">
            {de.auth.heroCaption}
          </p>
        </div>
      </div>
    </main>
  );
}
