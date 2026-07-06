import type { NextConfig } from "next";

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

export default nextConfig;
