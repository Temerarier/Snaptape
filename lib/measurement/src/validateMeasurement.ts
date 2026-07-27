// Validates measurement JSON against the canonical SnapTape contract
// shared/schema/measurement-v1.5.json (JSON Schema draft 2020-12).
// The schema file at the workspace root is the single source of truth
// (docs/plan.md); it is loaded from disk on first use so no second copy
// of the contract exists anywhere in the repo.
// Node/server runtime only: the schema is read from the filesystem, so
// browser bundles must not import this module directly.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, parse } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import type { ErrorObject, ValidateFunction } from "ajv";

export interface ValidationResult {
  valid: boolean;
  errors: ErrorObject[];
}

const SCHEMA_REL_PATH = join("shared", "schema", "measurement-v1.5.json");

/** Walk upward from `startDir` until the workspace root is found. */
function findRepoRoot(startDir: string): string | null {
  let dir = startDir;
  const { root } = parse(dir);
  for (;;) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    if (dir === root) return null;
    dir = dirname(dir);
  }
}

function schemaPath(): string {
  const startDirs: string[] = [];
  try {
    startDirs.push(dirname(fileURLToPath(import.meta.url)));
  } catch {
    // import.meta.url can be rewritten by bundlers; fall through to cwd.
  }
  startDirs.push(process.cwd());
  for (const start of startDirs) {
    const repoRoot = findRepoRoot(start);
    if (repoRoot !== null) {
      const candidate = join(repoRoot, SCHEMA_REL_PATH);
      if (existsSync(candidate)) return candidate;
    }
  }
  throw new Error(
    `Measurement schema not found: expected ${SCHEMA_REL_PATH} under the workspace root`,
  );
}

let compiled: ValidateFunction | null = null;

function getValidator(): ValidateFunction {
  if (compiled === null) {
    const schema = JSON.parse(readFileSync(schemaPath(), "utf8")) as object;
    // strict: false — the schema is a fixed external contract and must be
    // consumed exactly as authored, not adjusted to Ajv's strict-mode taste.
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    compiled = ajv.compile(schema);
  }
  return compiled;
}

/**
 * Validate a measurement JSON document against measurement-v1.5.json.
 * Never throws on invalid input; returns all violations (including the
 * conditional if/then material rules for roof vs. wall faces).
 */
export function validateMeasurement(json: unknown): ValidationResult {
  const validate = getValidator();
  const valid = validate(json) === true;
  return { valid, errors: valid ? [] : [...(validate.errors ?? [])] };
}
