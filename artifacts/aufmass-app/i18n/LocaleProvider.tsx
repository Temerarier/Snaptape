"use client";

// Client-Kontext für Sprache und Wörterbuch: wird im Root-Layout mit
// dem Nutzer-Locale (bzw. Default vor dem Login) befüllt. Client-
// Komponenten lesen Texte über useDictionary()/useLocale() – niemals
// direkt aus den Sprachdateien importieren.
import { createContext, useContext, type ReactNode } from "react";
import type { Dictionary, Locale } from "./index";

interface LocaleContextWert {
  locale: Locale;
  dict: Dictionary;
}

const LocaleContext = createContext<LocaleContextWert | null>(null);

export function LocaleProvider({
  locale,
  dict,
  children,
}: LocaleContextWert & { children: ReactNode }) {
  return (
    <LocaleContext.Provider value={{ locale, dict }}>
      {children}
    </LocaleContext.Provider>
  );
}

function useLocaleContext(): LocaleContextWert {
  const wert = useContext(LocaleContext);
  if (!wert) {
    throw new Error(
      "LocaleProvider fehlt: useDictionary()/useLocale() nur unterhalb des Root-Layouts verwenden.",
    );
  }
  return wert;
}

export function useLocale(): Locale {
  return useLocaleContext().locale;
}

export function useDictionary(): Dictionary {
  return useLocaleContext().dict;
}
