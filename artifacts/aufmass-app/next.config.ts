import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const replitDomains = (process.env.REPLIT_DOMAINS ?? "")
  .split(",")
  .map((domain) => domain.trim())
  .filter((domain) => domain.length > 0);

const nextConfig: NextConfig = {
  serverExternalPackages: ["isolated-vm"],
  outputFileTracingIncludes: {
    "/legal/[page]": ["../../docs/legal/*.md"],
    "/**": ["./lib/modell3d/core.js", "./lib/modell3d/sandbox-worker.cjs", "../../docs/pipeline/buildhouse*-prompt.md"],
    "/viewer-next": ["../../test-fixtures/variante-a/*/messung.json", "../../test-fixtures/variante-a/*/buildhouse.js", "../../fixtures/garage-house.json"],
  },
  transpilePackages: ["@workspace/db"],
  allowedDevOrigins: [
    ...replitDomains,
    "*.replit.dev",
    "*.replit.app",
    "127.0.0.1",
    "localhost",
  ],
};

export default (phase: string): NextConfig => ({
  ...nextConfig,
  // A production build must never replace the running dev server's manifests.
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
});
