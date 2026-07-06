import { Storage } from "@google-cloud/storage";

// Replit Object Storage: Zugriff über den lokalen Sidecar (keine eigenen Keys nötig).
const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export function getPrivateObjectDir(): string {
  const dir = process.env.PRIVATE_OBJECT_DIR || "";
  if (!dir) {
    throw new Error("PRIVATE_OBJECT_DIR ist nicht gesetzt.");
  }
  return dir;
}

export function getPublicObjectSearchPaths(): Array<string> {
  const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
  const paths = Array.from(
    new Set(
      pathsStr
        .split(",")
        .map((path) => path.trim())
        .filter((path) => path.length > 0),
    ),
  );
  if (paths.length === 0) {
    throw new Error("PUBLIC_OBJECT_SEARCH_PATHS ist nicht gesetzt.");
  }
  return paths;
}
