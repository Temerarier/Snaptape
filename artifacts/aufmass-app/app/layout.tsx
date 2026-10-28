import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { getDictionary, htmlLang, toLocale } from "@/i18n";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import { getCurrentUser } from "@/lib/auth/session";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { enUS, deDE } from "@clerk/localizations";

// Design-System „Technical-Clean": IBM Plex Sans für UI/Überschriften,
// IBM Plex Mono für Zahlen, IDs und Messwerte (siehe replit.md).
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "Snaptape",
  description: "Photos and plans in → measurements and a 3D model out",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Sprache des angemeldeten Nutzers (users.locale); vor dem Login
  // gilt der Default US-Englisch (replit.md Regel 8).
  const user = await getCurrentUser();
  const locale = toLocale(user?.locale);
  const dict = getDictionary(locale);

  return (
    <html lang={htmlLang(locale)}>
      <body
        className={`${plexSans.variable} ${plexMono.variable} min-h-screen bg-hintergrund font-sans text-schrift antialiased`}
      >
        <ClerkProvider publishableKey={process.env.CLERK_PUBLISHABLE_KEY}
          proxyUrl={process.env.CLERK_PROXY_URL}
          signInUrl="/sign-in" signUpUrl="/sign-up"
          signInFallbackRedirectUrl="/app" signUpFallbackRedirectUrl="/app"
          localization={locale === "de-DE" ? deDE : enUS}
          appearance={{
            variables: { colorPrimary: "#2563EB", colorForeground: "#16233A", fontFamily: "var(--font-plex-sans)", borderRadius: "12px" },
            options: { logoImageUrl: "/logo.svg" },
            elements: { cardBox: "w-[360px] max-w-full bg-flaeche shadow-none", card: "border border-linie rounded-karte" },
          }}>
        <LocaleProvider locale={locale} dict={dict}>
          {children}
        </LocaleProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
