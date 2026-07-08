import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { getDictionary, htmlLang, toLocale } from "@/i18n";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import { getCurrentUser } from "@/lib/auth/session";
import "./globals.css";

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
        <LocaleProvider locale={locale} dict={dict}>
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
