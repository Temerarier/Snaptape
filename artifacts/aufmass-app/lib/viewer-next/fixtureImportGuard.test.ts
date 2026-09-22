import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(__dirname, "../..");
const protectedRoots = [
  resolve(appRoot, "app/app"),
  resolve(appRoot, "app/admin"),
  resolve(appRoot, "components/projekte"),
  resolve(appRoot, "components/viewer-next"),
  resolve(appRoot, "lib/projekte"),
  resolve(appRoot, "lib/viewer-next"),
];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.[cm]?[jt]sx?$/.test(entry) && !/\.test\.[cm]?[jt]sx?$/.test(entry)
      ? [path]
      : [];
  });
}

describe("production project fixture boundary", () => {
  it("does not import test-house fixtures in customer, staff, or shared viewer code", () => {
    const violations = protectedRoots.flatMap((root) =>
      sourceFiles(root)
        .filter((path) =>
          /(?:garage-house\.json|testhaus(?:\.json|["']))/.test(
            readFileSync(path, "utf8"),
          ),
        )
        .map((path) => relative(appRoot, path)),
    );

    expect(violations).toEqual([]);
  });
});