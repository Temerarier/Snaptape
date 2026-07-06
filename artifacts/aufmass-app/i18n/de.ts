// Zentrale Sprachdatei (Start: Deutsch; Englisch vorbereitet, siehe replit.md).
// Alle UI-Texte gehören hierher – niemals hart im Component-Code.
export const de = {
  healthcheck: {
    title: "Aufmaß-App",
    subtitle: "System-Status",
    appRunning: "Anwendung läuft",
    dbConnected: "Datenbank verbunden",
    dbError: "Datenbankverbindung fehlgeschlagen",
    storageConfigured: "Object Storage konfiguriert",
    storageMissing: "Object Storage nicht konfiguriert",
  },
} as const;

export type Dictionary = typeof de;
