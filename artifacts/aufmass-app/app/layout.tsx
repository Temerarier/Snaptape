import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
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
  title: "Aufmaß-App",
  description: "Fotos/Pläne rein → Messwerte + 3D-Modell raus",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body
        className={`${plexSans.variable} ${plexMono.variable} min-h-screen bg-hintergrund font-sans text-schrift antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
