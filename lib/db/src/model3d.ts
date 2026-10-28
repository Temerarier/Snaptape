export interface Model3dData {
  flaechen: Record<string, unknown>[];
  oeffnungen: Record<string, unknown>[];
  anbauten: Record<string, unknown>[];
  deko: Record<string, unknown>[];
  kanten: Record<string, unknown>[];
  fallrohre: Record<string, unknown>[];
  schaeden: Record<string, unknown>[];
  ergaenzt: Record<string, unknown>[];
  konflikte: Record<string, unknown>[];
  nicht_gebaut: Record<string, unknown>[];
  fehler: string[];
  hinweise: string[];
  format?: string;
  version?: string;
  einheit?: string;
  laufzeit_ms?: number;
}
export interface Model3dCheck {
  stufe: "ok" | "merken" | "stopp";
  zahlen: Record<string, number | string>;
  zeilen: { id: string; pruefung: string; status: "fail" | "warn" | "info"; text: string }[];
}
export interface Model3dReport extends Model3dCheck {
  korrektur_genutzt: boolean;
  modell: string;
  effort: string;
  measure_run_id: string;
  error?: string;
  usageComplete?: boolean;
  duration_ms?: number;
  antwort?: unknown;
}
