// Lädt und validiert das handgeschriebene Test-Haus-Fixture (Etappe 2).
// Wirft beim Import, falls das Fixture nicht dem Vertrag entspricht.
import testhausJson from "@/fixtures/testhaus.json";
import { measureJsonSchema, type MeasureJson } from "./schema";

export function ladeTesthaus(): MeasureJson {
  return measureJsonSchema.parse(testhausJson);
}
