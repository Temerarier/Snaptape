import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { enUS } from "@/i18n/en-US";
import { LegalMarkdown } from "@/components/public/LegalMarkdown";
import { PublicHeader } from "@/components/public/PublicHeader";

const PAGES = ["notice", "privacy", "terms"] as const;
type LegalPage = (typeof PAGES)[number];

function isLegalPage(v: string): v is LegalPage {
  return (PAGES as readonly string[]).includes(v);
}

export const dynamicParams = false;
export function generateStaticParams() {
  return PAGES.map((page) => ({ page }));
}

// docs/legal lives at the workspace root; try both cwd layouts.
async function loadMarkdown(page: LegalPage): Promise<string> {
  const candidates = [
    path.join(process.cwd(), "docs", "legal", `${page}.md`),
    path.join(process.cwd(), "..", "..", "docs", "legal", `${page}.md`),
  ];
  for (const file of candidates) {
    try {
      return await readFile(file, "utf8");
    } catch {
      // try next
    }
  }
  throw new Error(`Legal text not found: ${page}.md`);
}

export async function generateMetadata({ params }: { params: Promise<{ page: string }> }): Promise<Metadata> {
  const { page } = await params;
  if (!isLegalPage(page)) return {};
  return { title: `${enUS.publicPages.legal.titles[page]} · SnapTape` };
}

export default async function LegalRoute({ params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  if (!isLegalPage(page)) notFound();
  const source = await loadMarkdown(page);
  return (
    <>
      <PublicHeader withSections={false} />
      <main className="mx-auto w-full max-w-[70ch] px-5 py-12 md:py-16">
        <article className="break-words">
          <LegalMarkdown source={source} />
        </article>
      </main>
    </>
  );
}
