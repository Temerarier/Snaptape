import { describe, expect, it, vi } from "vitest";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
vi.mock("@clerk/nextjs/server", () => ({ clerkMiddleware: vi.fn(() => vi.fn()) }));
import { config } from "../../middleware";

describe("staff fixture route middleware", () => {
  it.each(["/viewer-next", "/viewer-next?house=leipzig-villa", "/viewer-next/debug.svg"])(
    "includes Clerk on %s, even when the route resembles a static image", url => {
      expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(true);
    });
  it("does not run Clerk for normal static images", () => {
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: "/icon.svg" })).toBe(false);
  });
});
