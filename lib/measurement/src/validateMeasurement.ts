// Validates measurement JSON against its matching canonical SnapTape contract
// (JSON Schema draft 2020-12). Schema files at the workspace root are loaded
// on first use so no second copy of either contract exists in the repo.
// Node/server runtime only: the schema is read from the filesystem, so
// browser bundles must not import this module directly.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, parse } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import type { ErrorObject, ValidateFunction } from "ajv";
import {
  isSupportedSchemaVersion,
  type SupportedSchemaVersion,
} from "./schemaVersions";

export interface ValidationResult {
  valid: boolean;
  errors: ErrorObject[];
}

const SCHEMA_REL_PATHS: Record<SupportedSchemaVersion, string> = {
  "1.6": join("shared", "schema", "measurement-v1.6.json"),
  "1.7": join("shared", "schema", "measurement-v1.7.json"),
};

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

function schemaPath(version: SupportedSchemaVersion): string {
  const schemaRelPath = SCHEMA_REL_PATHS[version];
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
      const candidate = join(repoRoot, schemaRelPath);
      if (existsSync(candidate)) return candidate;
    }
  }
  throw new Error(
    `Measurement schema not found: expected ${schemaRelPath} under the workspace root`,
  );
}

const compiled = new Map<SupportedSchemaVersion, ValidateFunction>();

function getValidator(version: SupportedSchemaVersion): ValidateFunction {
  let validate = compiled.get(version);
  if (!validate) {
    const schema = JSON.parse(readFileSync(schemaPath(version), "utf8")) as object;
    // strict: false — the schema is a fixed external contract and must be
    // consumed exactly as authored, not adjusted to Ajv's strict-mode taste.
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    validate = ajv.compile(schema);
    compiled.set(version, validate);
  }
  return validate;
}

/**
 * Validate a measurement JSON document against its declared supported schema.
 * Never throws on invalid input; returns all violations (including the
 * conditional if/then material rules for roof vs. wall faces).
 */
export function validateMeasurement(json: unknown): ValidationResult {
  const version =
    json && typeof json === "object" && !Array.isArray(json)
      ? (json as { meta?: { schema_version?: unknown } }).meta?.schema_version
      : undefined;
  const validate = getValidator(
    isSupportedSchemaVersion(version) ? version : "1.7",
  );
  const valid = validate(json) === true;
  return { valid, errors: valid ? [] : [...(validate.errors ?? [])] };
}
