// Zentrale Sprachdatei (Start: Deutsch; Englisch vorbereitet, siehe replit.md).
// Alle UI-Texte gehören hierher – niemals hart im Component-Code.
export const de = {
  common: {
    appName: "Aufmaß-App",
    logout: "Abmelden",
    cancel: "Abbrechen",
    back: "Zurück zur Übersicht",
  },
  healthcheck: {
    title: "Aufmaß-App",
    subtitle: "System-Status",
    appRunning: "Anwendung läuft",
    dbConnected: "Datenbank verbunden",
    dbError: "Datenbankverbindung fehlgeschlagen",
    storageConfigured: "Object Storage konfiguriert",
    storageMissing: "Object Storage nicht konfiguriert",
  },
  auth: {
    loginTitle: "Anmelden",
    loginSubtitle: "Willkommen zurück bei der Aufmaß-App.",
    registerTitle: "Konto erstellen",
    registerSubtitle: "Registrieren Sie sich, um Projekte anzulegen.",
    emailLabel: "E-Mail",
    emailPlaceholder: "name@firma.de",
    passwordLabel: "Passwort",
    passwordHint: "Mindestens 8 Zeichen",
    loginButton: "Anmelden",
    registerButton: "Registrieren",
    loginPending: "Wird angemeldet …",
    registerPending: "Wird registriert …",
    noAccountYet: "Noch kein Konto?",
    switchToRegister: "Jetzt registrieren",
    alreadyHaveAccount: "Bereits ein Konto?",
    switchToLogin: "Zur Anmeldung",
    errorInvalidCredentials: "E-Mail oder Passwort ungültig.",
    errorEmailInvalid: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
    errorPasswordTooShort: "Das Passwort muss mindestens 8 Zeichen lang sein.",
    errorEmailTaken: "Für diese E-Mail existiert bereits ein Konto.",
    errorGeneric: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
  },
  projects: {
    title: "Meine Projekte",
    newProject: "Neues Projekt",
    searchPlaceholder: "Nach Name oder Adresse suchen …",
    searchButton: "Suchen",
    showArchive: "Archiv anzeigen",
    showActive: "Aktive Projekte anzeigen",
    archive: "Archivieren",
    restore: "Wiederherstellen",
    archivedBadge: "Archiviert",
    createdAtPrefix: "Angelegt am",
    emptyTitle: "Noch keine Projekte",
    emptyText:
      "Legen Sie Ihr erstes Projekt an – laden Sie später Fotos und Pläne hoch und erhalten Sie Messwerte und ein 3D-Modell.",
    emptyCta: "Erstes Projekt anlegen",
    emptyArchiveTitle: "Archiv ist leer",
    emptyArchiveText: "Hier erscheinen Projekte, die Sie archiviert haben.",
    noSearchResultsTitle: "Keine Treffer",
    noSearchResultsText:
      "Für Ihre Suche wurde kein Projekt gefunden. Passen Sie den Suchbegriff an.",
    nameLabel: "Projektname",
    namePlaceholder: "z. B. Einfamilienhaus Musterstraße",
    adresseLabel: "Adresse (optional)",
    adressePlaceholder: "Straße, Hausnummer, Ort",
    createButton: "Projekt anlegen",
    createPending: "Wird angelegt …",
    errorNameRequired: "Bitte geben Sie einen Projektnamen ein.",
    errorGeneric: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
    status: {
      entwurf: "Entwurf",
      in_pruefung: "In Prüfung",
      fertig: "Fertig",
      fehler: "Fehler",
    },
  },
  projectDetail: {
    notFoundTitle: "Projekt nicht gefunden",
    notFoundText:
      "Dieses Projekt existiert nicht oder gehört nicht zu Ihrem Konto.",
    placeholderHint: "Verfügbar in einer späteren Etappe",
    cards: {
      fotos: {
        title: "Fotos",
        text: "Hier laden Sie später Fotos und Pläne hoch.",
      },
      modell: {
        title: "3D-Modell",
        text: "Hier erscheint später das interaktive 3D-Modell.",
      },
      messwerte: {
        title: "Messwerte",
        text: "Hier erscheinen später alle Messwerte in Millimetern.",
      },
      report: {
        title: "Report",
        text: "Hier erstellen Sie später den Aufmaß-Report als PDF.",
      },
    },
  },
} as const;

export type Dictionary = typeof de;
