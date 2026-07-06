import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "artifacts/aufmass-app"),
    },
  },
  test: {
    include: ["artifacts/**/*.test.ts", "lib/**/src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/.next/**", "**/dist/**"],
  },
});
