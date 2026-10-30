import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

const appRequire = createRequire(
  path.resolve("artifacts/aufmass-app/package.json"),
);

describe("patched transitive dependencies", () => {
  it.each(["gaxios", "teeny-request"])(
    "%s can still load CommonJS uuid and rejects out-of-bounds UUID writes",
    (consumer) => {
      const storageRequire = createRequire(
        appRequire.resolve("@google-cloud/storage"),
      );
      const consumerRequire = createRequire(storageRequire.resolve(consumer));
      const uuid = consumerRequire("uuid");

      expect(() => storageRequire(consumer)).not.toThrow();
      expect(uuid.validate(uuid.v4())).toBe(true);
      expect(uuid.v5("test", uuid.v5.DNS)).toBe(
        "4be0643f-1d98-573b-97cd-ca98a65347dd",
      );
      for (const version of ["v3", "v5"]) {
        expect(() =>
          uuid[version]("test", uuid.v5.DNS, new Uint8Array(8), 4),
        ).toThrow(RangeError);
      }
    },
  );

  it("Next.js can parse and stringify CSS with the patched PostCSS", () => {
    const nextRequire = createRequire(appRequire.resolve("next"));
    const postcss = nextRequire("postcss");
    const css = ".example { color: red; }";
    expect(postcss().process(css, { from: undefined }).css).toBe(css);
  });

  it("the patched esbuild binary transforms TypeScript", () => {
    const apiRequire = createRequire(
      path.resolve("artifacts/api-server/package.json"),
    );
    const esbuild = apiRequire("esbuild");
    const result = esbuild.transformSync("const value: number = 42;", {
      loader: "ts",
    });
    expect(result.code).toContain("const value = 42");
  });
});
