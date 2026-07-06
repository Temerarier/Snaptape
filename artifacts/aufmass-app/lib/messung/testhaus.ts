// Lädt und validiert das handgeschriebene Test-Haus-Fixture (Etappe 2).
// Wirft beim Import, falls das Fixture nicht dem Vertrag entspricht.
import testhausJson from "@/fixtures/testhaus.json";
import { messJsonSchema, type MessJson } from "./schema";

export function ladeTesthaus(): MessJson {
  return messJsonSchema.parse(testhausJson);
}
