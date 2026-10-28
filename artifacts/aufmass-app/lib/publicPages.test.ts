import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { getCurrentUser } from "@/lib/auth/session";
import Page from "@/app/page";
import { LegalMarkdown } from "@/components/public/LegalMarkdown";
import { SiteFooter } from "@/components/public/SiteFooter";
import { MEASUREMENT_DISCLAIMER } from "./config/haftung";
import { enUS } from "@/i18n/en-US";
import { deDE } from "@/i18n/de-DE";

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn(async () => null) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));

describe("public trial pages", () => {
  it("server-renders the anonymous landing with the exact headline and disclaimer", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const html = renderToStaticMarkup(await Page());
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toContain("Full exterior measurements from your customer");
    expect(html).toContain(MEASUREMENT_DISCLAIMER);
    expect(html).toContain('href="/login"');
    expect(html).toContain('id="pricing"');
    expect(html).toContain('id="faq"');
    expect(html.match(/<details\b/g)).toHaveLength(7);
    expect(html).not.toMatch(/<canvas|<img|<script|typical accuracy|laser|newsletter/i);
  });
  it("redirects signed-in users to the existing app", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "existing-user" } as NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>);
    await expect(Page()).rejects.toThrow("REDIRECT:/app");
  });
  it("shares the same English public copy in both dictionaries", () => {
    expect(deDE.publicPages).toBe(enUS.publicPages);
  });
  it("renders all legal documents with their headings and untouched placeholders", () => {
    for (const name of ["notice", "privacy", "terms"]) {
      const source = readFileSync(`docs/legal/${name}.md`, "utf8");
      const html = renderToStaticMarkup(React.createElement(LegalMarkdown, { source }));
      expect(html.match(/<h1\b/g)).toHaveLength(1);
      expect(source).toMatch(/\[[^\]]+\]/);
      expect(html).toContain(source.match(/\[[^\]]+\]/)![0]);
      expect(html).not.toContain("<script");
    }
  });
  it("puts all three legal links in the shared footer", () => {
    const html = renderToStaticMarkup(React.createElement(SiteFooter));
    for (const name of ["notice", "privacy", "terms"]) expect(html).toContain(`href="/legal/${name}"`);
    expect(html).toContain("Cantum UG");
  });
});
