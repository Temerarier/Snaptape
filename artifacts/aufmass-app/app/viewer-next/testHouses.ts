import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Model3dData } from "@workspace/db";
import { measurementToMess, pruefen } from "@/lib/modell3d/coreHost";
import { fuehreSandboxAus } from "@/lib/modell3d/sandbox";

export const TEST_HOUSES = [
  { id: "garage-house", label: "Garage house" },
  { id: "farmhouse-140040rk", label: "Farmhouse 140040RK" },
  { id: "farmhouse-test5-beispiel", label: "Farmhouse Test 5" },
  { id: "leipzig-villa", label: "Leipzig Villa" },
  { id: "triplex-40014db", label: "Triplex 40014DB" },
  { id: "tudor-93233el", label: "Tudor 93233EL" },
] as const;
export type TestHouse = typeof TEST_HOUSES[number]["id"];
const cache = new Map<TestHouse, Promise<{ measurement: unknown; model3d: Model3dData | null }>>();

/** Server-only allowlisted fixtures; never calls the provider or writes to the DB. */
export function loadTestHouse(house: TestHouse) {
  const existing = cache.get(house);
  if (existing) return existing;
  const pending = (async () => {
    if (!TEST_HOUSES.some(item => item.id === house)) throw new Error("Unknown test house");
    const root = [process.cwd(), join(process.cwd(), "../..")]
      .find(path => existsSync(join(path, "fixtures/garage-house.json")));
    if (!root) throw new Error("Test fixtures not found");
    if (house === "garage-house") return {
      measurement: JSON.parse(await readFile(join(root, "fixtures/garage-house.json"), "utf8")), model3d: null,
    };
    const dir = join(root, "test-fixtures/variante-a", house);
    const measurement = JSON.parse(await readFile(join(dir, "messung.json"), "utf8"));
    const code = await readFile(join(dir, "buildhouse.js"), "utf8");
    const mess = measurementToMess(measurement);
    const { result } = await fuehreSandboxAus(mess, code);
    const check = pruefen(mess, result);
    if (check.stufe === "stopp") throw new Error(`Test fixture failed isolated check: ${house}`);
    return { measurement, model3d: result };
  })();
  cache.set(house, pending);
  pending.catch(() => cache.delete(house));
  return pending;
}
