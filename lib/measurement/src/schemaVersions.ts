export const SUPPORTED_SCHEMA_VERSIONS = ["1.6", "1.7"] as const;

export type SupportedSchemaVersion =
  (typeof SUPPORTED_SCHEMA_VERSIONS)[number];

export function isSupportedSchemaVersion(
  value: unknown,
): value is SupportedSchemaVersion {
  return (
    typeof value === "string" &&
    SUPPORTED_SCHEMA_VERSIONS.some((version) => version === value)
  );
}