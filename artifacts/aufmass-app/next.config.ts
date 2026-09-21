import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const replitDomains = (process.env.REPLIT_DOMAINS ?? "")
  .split(",")
  .map((domain) => domain.trim())
  .filter((domain) => domain.length > 0);

const nextConfig: NextConfig = {
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
