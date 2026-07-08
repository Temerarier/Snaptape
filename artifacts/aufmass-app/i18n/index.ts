// Sprachverwaltung: unterstützte Locales, Default (US-Englisch) und
// Zugriff auf die Wörterbücher. Die Auswahl ist am Nutzer gespeichert
// (users.locale) und überlebt Reload und Login (replit.md Regel 8).
import { deDE } from "./de-DE";
import { enUS, type Dictionary } from "./en-US";

export type { Dictionary };

export const LOCALES = ["en-US", "de-DE"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en-US";

export function isLocale(wert: string): wert is Locale {
  return (LOCALES as readonly string[]).includes(wert);
}

// Wandelt einen gespeicherten Wert (z. B. aus der DB) sicher in ein
// unterstütztes Locale um – unbekannte Werte fallen auf den Default.
export function toLocale(wert: string | null | undefined): Locale {
  return wert && isLocale(wert) ? wert : DEFAULT_LOCALE;
}

const DICTIONARIES: Record<Locale, Dictionary> = {
  "en-US": enUS,
  "de-DE": deDE,
};

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

// Sprach-Attribut fürs <html>-Element.
export function htmlLang(locale: Locale): "en" | "de" {
  return locale === "de-DE" ? "de" : "en";
}
