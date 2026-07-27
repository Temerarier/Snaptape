import { Readable } from "node:stream";
import { Storage, type File } from "@google-cloud/storage";

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

// Zerlegt einen vollen Objektpfad "/<bucket>/<objekt…>" in Bucket + Objektname.
export function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const teile = path.split("/");
  if (teile.length < 3) {
    throw new Error(`Ungültiger Objektpfad: ${path}`);
  }
  return {
    bucketName: teile[1],
    objectName: teile.slice(2).join("/"),
  };
}

export function dateiFuerPfad(objectPath: string): File {
  const { bucketName, objectName } = parseObjectPath(objectPath);
  return objectStorageClient.bucket(bucketName).file(objectName);
}

// Signierte URL über den Sidecar (funktioniert in Dev und Deployment).
async function signObjectUrl({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const antwort = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bucket_name: bucketName,
        object_name: objectName,
        method,
        expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!antwort.ok) {
    throw new Error(
      `Signieren der Objekt-URL fehlgeschlagen (Status ${antwort.status}).`,
    );
  }
  const { signed_url: signedUrl } = (await antwort.json()) as {
    signed_url: string;
  };
  return signedUrl;
}

// Direkter Browser-Upload: 25-MB-Dateien dürfen NICHT durch Server-Action-
// Bodies laufen – der Client lädt per PUT direkt in den Object Storage.
export async function erzeugeUploadUrl(objectPath: string): Promise<string> {
  const { bucketName, objectName } = parseObjectPath(objectPath);
  return signObjectUrl({ bucketName, objectName, method: "PUT", ttlSec: 900 });
}

export async function objektMetadaten(
  objectPath: string,
): Promise<{ exists: boolean; sizeBytes: number }> {
  const datei = dateiFuerPfad(objectPath);
  const [exists] = await datei.exists();
  if (!exists) return { exists: false, sizeBytes: 0 };
  const [meta] = await datei.getMetadata();
  return { exists: true, sizeBytes: Number(meta.size ?? 0) };
}

export async function ladeObjekt(objectPath: string): Promise<Buffer> {
  const [daten] = await dateiFuerPfad(objectPath).download();
  return daten;
}

export async function speichereObjekt(
  objectPath: string,
  daten: Buffer,
  contentType: string,
): Promise<void> {
  await dateiFuerPfad(objectPath).save(daten, {
    contentType,
    resumable: false,
  });
}

export async function loescheObjekt(objectPath: string): Promise<void> {
  await dateiFuerPfad(objectPath).delete({ ignoreNotFound: true });
}

// Streamt ein Objekt als HTTP-Response (für die Datei-Route).
export async function streameObjekt(
  objectPath: string,
  contentType: string,
): Promise<Response> {
  const datei = dateiFuerPfad(objectPath);
  const nodeStream = datei.createReadStream();
  const webStream = Readable.toWeb(nodeStream) as ReadableStream;
  return new Response(webStream, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
