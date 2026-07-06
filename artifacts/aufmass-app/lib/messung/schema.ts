// Zod-Abbildung des Vertrags schema/mess-schema.json (Mess-JSON v1.0).
// Eiserne Regel 2: Das JSON-Schema ist der Vertrag zwischen Messung,
// Datenbank, Viewer und Report – diese Datei bildet ihn 1:1 ab und
// wird nur auf ausdrückliche Anweisung geändert.
import { z } from "zod/v4";

export const FASSADEN = [
  "strassenseite",
  "gartenseite",
  "links",
  "rechts",
] as const;

export const fassadeSchema = z.enum(FASSADEN);

export const messwertSchema = z.object({
  wert: z.number(),
  confidence: z.enum(["high", "medium", "low"]),
  source: z.enum(["measured", "scaled", "estimated"]),
  reference_used: z.string().nullable().optional(),
  grund_bei_low: z.string().nullable().optional(),
});

const messwertOderNull = messwertSchema.nullable();

export const fotoSchema = z.object({
  nr: z.number().int(),
  zeigt_fassade: z
    .enum([
      "strassenseite",
      "gartenseite",
      "links",
      "rechts",
      "dach",
      "mehrere",
      "unbekannt",
    ])
    .optional(),
  blickwinkel: z.enum(["frontal", "leicht_schraeg", "stark_schraeg"]),
  perspektive_korrigiert: z.boolean().optional(),
});

export const metaSchema = z.object({
  land: z.enum(["DE", "AT", "CH", "US"]),
  einheit: z.literal("mm"),
  schema_version: z.literal("1.0").optional(),
  fotos: z.array(fotoSchema).optional(),
  hinweise: z.array(z.string()).optional(),
});

export const footprintSchema = z.object({
  punkte: z.array(z.tuple([z.number(), z.number()])).optional(),
  breite_mm: messwertOderNull.optional(),
  tiefe_mm: messwertOderNull.optional(),
  umfang_mm: messwertOderNull.optional(),
  flaeche_mm2: messwertOderNull.optional(),
});

export const gebaeudeSchema = z.object({
  gebaeudetyp: z
    .enum([
      "freistehend",
      "doppelhaus",
      "reihenhaus_mitte",
      "reihenhaus_ende",
      "unbekannt",
    ])
    .optional(),
  geschosse: z.number().int().nullable().optional(),
  dachform: z.enum([
    "satteldach",
    "walmdach",
    "flachdach",
    "pultdach",
    "mansarddach",
    "kruppelwalm",
    "sonstige",
    "unbekannt",
  ]),
  footprint: footprintSchema.nullable().optional(),
  hoehen: z
    .object({
      traufhoehe_mm: messwertOderNull.optional(),
      firsthoehe_mm: messwertOderNull.optional(),
      attikahoehe_mm: messwertOderNull.optional(),
    })
    .optional(),
  geteilte_waende: z.array(fassadeSchema).optional(),
});

export const referenzSchema = z.object({
  foto_nr: z.number().int(),
  skala_art: z.enum(["eigenes_referenzobjekt", "uebertragen", "keine"]),
  objekt: z.string().nullable().optional(),
  bounding_box: z.array(z.number()).nullable().optional(),
  angenommenes_mass_mm: z.number().nullable().optional(),
  zuverlaessigkeit: z.enum(["hoch", "mittel", "niedrig"]).nullable().optional(),
  ebene: z
    .enum(["fassadenebene", "davor", "dahinter", "unbekannt"])
    .nullable()
    .optional(),
  uebertragen_via: z.string().nullable().optional(),
  vom_nutzer_bestaetigt: z.boolean().optional().default(false),
});

export const faceSchema = z.object({
  id: z.string().regex(/^(D|W|U|B)-[0-9]+$/),
  face_class: z.enum(["dachflaeche", "wand", "untersicht", "blende"]),
  fassade: z
    .enum([
      "strassenseite",
      "gartenseite",
      "links",
      "rechts",
      "dach",
      "unbekannt",
    ])
    .optional(),
  material: z
    .enum([
      "putz",
      "klinker",
      "wdvs",
      "holz",
      "sichtbeton",
      "sonstige",
      "unbekannt",
    ])
    .nullable()
    .optional(),
  flaeche_mm2: messwertSchema,
  flaeche_netto_mm2: messwertOderNull.optional(),
  neigung: z
    .object({
      original_grad: z.number().optional(),
      gerundet_grad: z.number().optional(),
    })
    .nullable()
    .optional(),
  ausrichtung_grad: z.number().nullable().optional(),
});

export const edgeSchema = z.object({
  id: z.string().regex(/^K-[0-9]+$/),
  edge_class: z.enum([
    "first",
    "grat",
    "kehle",
    "traufe",
    "ortgang",
    "aussenecke",
    "innenecke",
    "sockel",
    "sturz",
    "fensterbank",
    "leibung",
    "unklassifiziert",
  ]),
  laenge_mm: messwertSchema,
  gehoert_zu_fassade: z
    .enum([
      "strassenseite",
      "gartenseite",
      "links",
      "rechts",
      "dach",
      "unbekannt",
    ])
    .nullable()
    .optional(),
});

export const openingSchema = z.object({
  id: z.string().regex(/^(F|T|G)-[0-9]+$/),
  typ: z.enum(["fenster", "tuer", "garagentor", "sonstige"]),
  fassade: z.enum([
    "strassenseite",
    "gartenseite",
    "links",
    "rechts",
    "unbekannt",
  ]),
  breite_mm: messwertSchema,
  hoehe_mm: messwertSchema,
  bruestung_mm: messwertOderNull.optional(),
  position_mm: z
    .object({
      x: z.number().optional(),
      y: z.number().optional(),
    })
    .nullable()
    .optional(),
  flaeche_mm2: messwertOderNull.optional(),
  umfang_mm: messwertOderNull.optional(),
  hinweis: z.string().optional().default("Richtmaß, kein Bestellmaß"),
});

export const anbauSchema = z.object({
  id: z.string().regex(/^A-[0-9]+$/),
  typ: z.enum(["gaube", "erker", "balkon", "vordach", "anbau", "sonstige"]),
  fassade: z
    .enum([
      "strassenseite",
      "gartenseite",
      "links",
      "rechts",
      "dach",
      "unbekannt",
    ])
    .optional(),
  breite_mm: messwertOderNull.optional(),
  hoehe_mm: messwertOderNull.optional(),
  tiefe_mm: messwertOderNull.optional(),
});

export const qualitaetSchema = z.object({
  anzahl_referenzen_genutzt: z.number().int().optional(),
  streuung_prozent: z.number().optional(),
  warnungen: z.array(z.string()).optional(),
});

export const messJsonSchema = z.object({
  meta: metaSchema,
  gebaeude: gebaeudeSchema,
  referenzen: z.array(referenzSchema),
  faces: z.array(faceSchema),
  edges: z.array(edgeSchema),
  openings: z.array(openingSchema),
  anbauten: z.array(anbauSchema).optional(),
  qualitaet: qualitaetSchema.nullable().optional(),
});

export type Messwert = z.infer<typeof messwertSchema>;
export type Fassade = z.infer<typeof fassadeSchema>;
export type Face = z.infer<typeof faceSchema>;
export type Edge = z.infer<typeof edgeSchema>;
export type Opening = z.infer<typeof openingSchema>;
export type Anbau = z.infer<typeof anbauSchema>;
export type MessJson = z.infer<typeof messJsonSchema>;
