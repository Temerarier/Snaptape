// Zod-Abbildung des Vertrags schema/mess-schema.json (Measurement-JSON
// v1.2, englisch, US-Markt). Eiserne Regel 2: Das JSON-Schema ist der
// Vertrag zwischen Messung, Datenbank, Viewer und Report – diese Datei
// bildet ihn 1:1 ab und wird nur auf ausdrückliche Anweisung geändert.
//
// Migration v1.0 → v1.2 (IDs): Dach D-→RF-, Wand W-→WL-, Untersicht
// U-→SF-, Blende B-→FC-, Kante K-→E-, Fenster F-→W-, Tür T-→D-,
// Garagentor G-→G-, Anbau A-→AT-; neu: SK- (Skylight). ACHTUNG: das
// neue "D-" ist eine Tür (alt: Dachfläche), das neue "W-" ein Fenster
// (alt: Wand). Alte und neue IDs niemals mischen.
import { z } from "zod/v4";

// Elevations funktional benannt: front = zur Straße gerichtete Seite,
// left/right von der Straße aus gesehen. Himmelsrichtungen werden nie
// geraten – sie kommen später deterministisch aus der Adresse.
export const ELEVATIONS = ["front", "back", "left", "right"] as const;

export const elevationSchema = z.enum(ELEVATIONS);

const elevationOderRoofSchema = z.enum([
  "front",
  "back",
  "left",
  "right",
  "roof",
  "unknown",
]);

export const measurementSchema = z.object({
  value: z.number(),
  confidence: z.enum(["high", "medium", "low"]),
  source: z.enum(["measured", "scaled", "estimated"]),
  reference_used: z.string().nullable().optional(),
  low_reason: z.string().nullable().optional(),
});

const measurementOderNull = measurementSchema.nullable();

export const photoSchema = z.object({
  index: z.number().int(),
  shows_elevation: z
    .enum(["front", "back", "left", "right", "roof", "multiple", "unknown"])
    .optional(),
  view_angle: z.enum(["frontal", "slightly_angled", "steeply_angled"]),
  perspective_corrected: z.boolean().optional(),
});

export const metaSchema = z.object({
  country: z.enum(["US", "DE", "AT", "CH"]),
  unit: z.literal("mm"),
  schema_version: z.literal("1.2").optional(),
  photos: z.array(photoSchema).optional(),
  notes: z.array(z.string()).optional(),
});

export const footprintSchema = z.object({
  points: z.array(z.tuple([z.number(), z.number()])).optional(),
  width_mm: measurementOderNull.optional(),
  depth_mm: measurementOderNull.optional(),
  perimeter_mm: measurementOderNull.optional(),
  area_mm2: measurementOderNull.optional(),
});

export const buildingSchema = z.object({
  building_type: z
    .enum([
      "detached",
      "duplex",
      "townhouse_middle",
      "townhouse_end",
      "unknown",
    ])
    .optional(),
  stories: z.number().int().nullable().optional(),
  roof_type: z.enum([
    "gable",
    "hip",
    "flat",
    "shed",
    "mansard",
    "gambrel",
    "jerkinhead",
    "other",
    "unknown",
  ]),
  footprint: footprintSchema.nullable().optional(),
  heights: z
    .object({
      eave_height_mm: measurementOderNull.optional(),
      ridge_height_mm: measurementOderNull.optional(),
      parapet_height_mm: measurementOderNull.optional(),
    })
    .optional(),
  shared_walls: z.array(elevationSchema).optional(),
});

export const referenceSchema = z.object({
  photo_index: z.number().int(),
  scale_type: z.enum(["user_provided", "own_reference", "transferred", "none"]),
  object: z.string().nullable().optional(),
  bounding_box: z.array(z.number()).nullable().optional(),
  assumed_size_mm: z.number().nullable().optional(),
  reliability: z.enum(["high", "medium", "low"]).nullable().optional(),
  plane: z
    .enum(["facade_plane", "in_front", "behind", "unknown"])
    .nullable()
    .optional(),
  transferred_via: z.string().nullable().optional(),
  user_confirmed: z.boolean().optional().default(false),
});

// Dreistufiger Pitch (Hover-Stil): exakter Gradwert, gerundeter
// Gradwert und auf einen gängigen US-Pitch (rise über 12 run)
// eingerasteter Wert für die Anzeige.
export const pitchSchema = z.object({
  degrees_original: z.number().optional(),
  degrees_rounded: z.number().optional(),
  rise_over_12_snapped: z.number().optional(),
});

export const faceSchema = z.object({
  id: z.string().regex(/^(RF|WL|SF|FC)-[0-9]+$/),
  face_class: z.enum(["roof_face", "wall", "soffit", "fascia"]),
  elevation: elevationOderRoofSchema.optional(),
  material: z
    .enum([
      "stucco",
      "brick",
      "siding",
      "wood",
      "concrete",
      "eifs",
      "other",
      "unknown",
    ])
    .nullable()
    .optional(),
  area_mm2: measurementSchema,
  net_area_mm2: measurementOderNull.optional(),
  soffit_depth_mm: measurementOderNull.optional(),
  pitch: pitchSchema.nullable().optional(),
  orientation_deg: z.number().nullable().optional(),
});

export const edgeSchema = z.object({
  id: z.string().regex(/^E-[0-9]+$/),
  edge_class: z.enum([
    "ridge",
    "hip",
    "valley",
    "eave",
    "rake",
    "flashing",
    "step_flashing",
    "outside_corner",
    "inside_corner",
    "base",
    "head",
    "sill",
    "jamb",
    "unclassified",
  ]),
  length_mm: measurementSchema,
  belongs_to_elevation: elevationOderRoofSchema.nullable().optional(),
});

export const openingSchema = z.object({
  id: z.string().regex(/^(W|D|G|SK)-[0-9]+$/),
  type: z.enum([
    "window",
    "door",
    "patio_door",
    "garage_door",
    "skylight",
    "other",
  ]),
  elevation: elevationOderRoofSchema,
  width_mm: measurementSchema,
  height_mm: measurementSchema,
  sill_height_mm: measurementOderNull.optional(),
  group_id: z.string().nullable().optional(),
  position_mm: z
    .object({
      x: z.number().optional(),
      y: z.number().optional(),
    })
    .nullable()
    .optional(),
  area_mm2: measurementOderNull.optional(),
  perimeter_mm: measurementOderNull.optional(),
  note: z.string().optional().default("Reference only, not for ordering"),
});

export const attachmentSchema = z.object({
  id: z.string().regex(/^AT-[0-9]+$/),
  type: z.enum([
    "dormer",
    "bay",
    "balcony",
    "awning",
    "addition",
    "chimney",
    "other",
  ]),
  elevation: elevationOderRoofSchema.optional(),
  width_mm: measurementOderNull.optional(),
  height_mm: measurementOderNull.optional(),
  depth_mm: measurementOderNull.optional(),
});

export const qualitySchema = z.object({
  references_used: z.number().int().optional(),
  spread_percent: z.number().optional(),
  warnings: z.array(z.string()).optional(),
});

export const measureJsonSchema = z.object({
  meta: metaSchema,
  building: buildingSchema,
  references: z.array(referenceSchema),
  faces: z.array(faceSchema),
  edges: z.array(edgeSchema),
  openings: z.array(openingSchema),
  attachments: z.array(attachmentSchema).optional(),
  quality: qualitySchema.nullable().optional(),
});

export type Measurement = z.infer<typeof measurementSchema>;
export type Elevation = z.infer<typeof elevationSchema>;
export type Face = z.infer<typeof faceSchema>;
export type Edge = z.infer<typeof edgeSchema>;
export type Opening = z.infer<typeof openingSchema>;
export type Attachment = z.infer<typeof attachmentSchema>;
export type MeasureJson = z.infer<typeof measureJsonSchema>;
