import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PgDialect } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/node-postgres";
import type { SQL } from "drizzle-orm";
import { projectsTable } from "@workspace/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProjectDetailPage from "@/app/app/projekt/[id]/page";
import UploadPage from "@/app/app/projekt/[id]/upload/page";
import ProjectListPage from "@/app/app/page";
import { ProjectCard } from "@/components/projekte/ProjectCard";
import { enUS } from "@/i18n/en-US";

const mock = vi.hoisted(() => ({ select: vi.fn(), fields: [] as Record<string, unknown>[],
  conditions: [] as unknown[], project: {} as Record<string, unknown> }));
vi.mock("@workspace/db", async original => ({
  ...await original<typeof import("@workspace/db")>(),
  db: { select: mock.select },
}));
vi.mock("@/lib/auth/session", () => ({ requireUser: async () => ({ id: "owner-id", locale: "en-US" }) }));
vi.mock("@/lib/messung/aufraeumen", () => ({ raeumeHaengendeMessungenAuf: async () => undefined }));
vi.mock("@/lib/credits/service", () => ({ holeGuthaben: async () => 10 }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  redirect: (url: string) => { throw new Error(`REDIRECT ${url}`); },
  notFound: () => { throw new Error("NOT_FOUND"); },
}));
vi.mock("@/components/upload/UploadBereich", () => ({ UploadBereich: () => <div data-test-upload>Start measurement · 1 credit</div> }));
vi.mock("@/components/projekte/ProjektTitelInput", () => ({ ProjektTitelInput: () => <h1>Fixture</h1> }));
vi.mock("@/components/projekte/NewProjectDialog", () => ({ NewProjectDialog: () => null }));
vi.mock("@/components/projekte/SortSelect", () => ({ SortSelect: () => <select aria-label="Sort" /> }));
vi.mock("@/components/credits/CreditsPill", () => ({ CreditsPill: () => null }));
vi.mock("@/components/projekte/ProjectCardMenu", () => ({ ProjectCardMenu: () => null }));
vi.mock("@/components/projekte/AutoRefresh", () => ({ AutoRefresh: () => <span data-auto-refresh /> }));
const id = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.clearAllMocks(); mock.fields.length = 0; mock.conditions.length = 0;
  mock.project = { id, name: "House", adresse: null, status: "draft", archivedAt: null,
    createdAt: new Date("2026-10-30T12:00:00Z"), referenceValue: null,
    measurementErrors: ["Stored measurement error"], previewUrl: "/dateien/first-photo?v=vorschau" };
  mock.select.mockImplementation((fields: Record<string, unknown> = {}) => {
    mock.fields.push(fields);
    return { from: () => ({ where: (condition: unknown) => {
      mock.conditions.push(condition);
      return { limit: async () => [mock.project],
        orderBy: async () => "previewUrl" in fields ? [mock.project] : [] };
    } }) };
  });
});
describe("project navigation and upload states", () => {
  it.each(["model_ready", "processing", "failed", "draft", "files_uploaded", "classified", "reviewing", "ready"])(
    "redirects %s to its destination without a detail screen", async status => {
      mock.project.status = status;
      await expect(ProjectDetailPage({ params: Promise.resolve({ id }) })).rejects.toThrow(
        `REDIRECT /app/projekt/${id}/${status === "model_ready" ? "viewer" : "upload"}`);
      const query = new PgDialect().sqlToQuery(mock.conditions[0] as Parameters<PgDialect["sqlToQuery"]>[0]);
      expect(query.params).toContain("owner-id");
    },
  );
  it("shows measuring and refresh, but no upload/start controls while processing", async () => {
    mock.project.status = "processing";
    const html = renderToStaticMarkup(await UploadPage({ params: Promise.resolve({ id }) }));
    expect(html).toContain(enUS.projectDetail.messungLaeuft);
    expect(html).toContain("data-auto-refresh");
    expect(html).not.toContain("data-test-upload");
  });
  it("shows stored errors, retry pricing and upload controls after a failure", async () => {
    mock.project.status = "failed";
    const html = renderToStaticMarkup(await UploadPage({ params: Promise.resolve({ id }) }));
    expect(html).toContain("Stored measurement error");
    expect(html).toContain("A new attempt costs 1 credit");
    expect(html).toContain("data-test-upload");
  });
});
describe("overview cards", () => {
  it("removes status filters, preserves sort/archive/badge and requests earliest protected previews", async () => {
    const html = renderToStaticMarkup(await ProjectListPage({
      searchParams: Promise.resolve({ status: "failed" }),
    }));
    expect(html).not.toContain("aria-current");
    expect(html).not.toContain("status=");
    expect(html).toContain('aria-label="Sort"');
    expect(html).toContain("Show archive");
    expect(html).toContain("Draft");
    expect(html).toContain("/dateien/first-photo?v=vorschau");
    const query = new PgDialect().sqlToQuery(mock.fields[0].previewUrl as Parameters<PgDialect["sqlToQuery"]>[0]);
    expect(query.sql).toContain("order by f.created_at asc, f.id asc limit 1");
    expect(query.sql).toContain("?v=seite&nr=1");
    expect(query.sql).toContain("?v=vorschau");
    // A single-table SELECT strips Column table qualifiers. Inspect the full
    // SELECT, not only the isolated SQL expression, or a correlated "id"
    // can accidentally bind to the inner file's id.
    const compiled = drizzle.mock().select({
      previewUrl: mock.fields[0].previewUrl as SQL<string | null>,
    }).from(projectsTable).toSQL();
    expect(compiled.sql).toContain('f.project_id = "projects"."id"');
  });
  it("uses a lazy cover preview and routes the card through the protected redirect", () => {
    const html = renderToStaticMarkup(<ProjectCard project={mock.project as never} locale="en-US" t={enUS.projects} />);
    expect(html).toContain('loading="lazy"');
    expect(html).toContain("object-cover");
    expect(html).toContain(`/app/projekt/${id}`);
    expect(html).not.toContain("No photos yet");
  });
  it("shows a plain placeholder for a project without files", () => {
    mock.project.previewUrl = null;
    const html = renderToStaticMarkup(<ProjectCard project={mock.project as never} locale="en-US" t={enUS.projects} />);
    expect(html).toContain("No photos yet");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("schraffur");
  });
});
