import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { eq } from "drizzle-orm";
import {
  db,
  pool,
  projectsTable,
  sessionsTable,
  usersTable,
} from "@workspace/db";
import { istStaff } from "../lib/auth/staff";
import {
  connectBrowser,
  pause,
  waitUntil,
} from "./viewer-browser-cdp.mjs";

type Snapshot = {
  kind: string;
  cards: Record<string, string>;
  rows: Record<string, string>;
};

const base =
  process.env.VIEWER_TEST_ORIGIN ??
  (process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : null);
if (!base) throw new Error("VIEWER_TEST_ORIGIN or REPLIT_DEV_DOMAIN is required");

let browser: Awaited<ReturnType<typeof connectBrowser>>;
const workspaceRequire = createRequire(import.meta.url);
const vitestRequire = createRequire(
  workspaceRequire.resolve("vitest/package.json"),
);
const temporaryHashes = new Set<string>();
const bundleDir = "/tmp/viewer-partial-quantities";
const checkedCardIds = [
  "roof_area",
  "roof_edges",
  "gutters",
  "walls",
  "openings",
  "trim",
  "condition_areas",
] as const;

async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  temporaryHashes.add(tokenHash);
  await db.insert(sessionsTable).values({
    tokenHash,
    userId,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });
  return token;
}

async function authenticate(token: string) {
  await browser.send("Network.clearBrowserCookies");
  await browser.send("Network.setCookie", {
    name: "aufmass_session",
    value: token,
    url: base,
    secure: true,
    httpOnly: true,
    sameSite: "Lax",
  });
}

async function navigate(path: string) {
  browser.exceptions.length = 0;
  browser.consoleMessages.length = 0;
  await browser.send("Page.navigate", { url: `${base}${path}` });
  await waitUntil(
    browser,
    "document.readyState === 'complete' && !!document.body?.innerText",
  );
  await pause(500);
}

function assertNoBrowserErrors(label: string) {
  const consoleErrors = browser.consoleMessages.filter(
    (message: { type?: string }) =>
      message.type === "error" || message.type === "assert",
  );
  assert.equal(browser.exceptions.length, 0, `${label}: uncaught browser error`);
  assert.equal(consoleErrors.length, 0, `${label}: browser console error`);
}

async function visibleValues(): Promise<{
  cards: Record<string, string>;
  downspouts: string | null;
}> {
  return browser.evaluate(`(() => ({
    cards: Object.fromEntries(${JSON.stringify(checkedCardIds)}.map(id => {
      const button = document.querySelector('[aria-controls="card-' + id + '"]');
      return [id, button?.querySelector('.font-mono')?.textContent?.trim() ?? null];
    })),
    downspouts: document.querySelector(
      '[data-viewer-row-id="ds"] .viewer-next-row-value span'
    )?.textContent?.trim() ?? null,
  }))()`);
}

async function main() {
  const projects = await db
    .select({
      id: projectsTable.id,
      ownerId: projectsTable.userId,
      status: projectsTable.status,
    })
    .from(projectsTable);
  const readyProjects = projects.filter(
    (project) => project.status === "model_ready",
  );
  const users = await db
    .select({ id: usersTable.id, email: usersTable.email })
    .from(usersTable);
  const ownerProject = readyProjects.find((project) =>
    users.some((user) => user.id === project.ownerId),
  );
  const staff = users.find((user) => istStaff(user.email));
  assert.ok(ownerProject, "No model-ready owner project is available");
  assert.ok(staff, "No authorized staff identity is available");

  const ownerToken = await createSession(ownerProject.ownerId);
  await authenticate(ownerToken);
  await navigate(`/app/projekt/${ownerProject.id}/viewer`);
  assert.ok(
    await browser.evaluate(
      "!!document.querySelector('.viewer-next-shell') || !!document.querySelector('[data-project-viewer-state]')",
    ),
    "Owner route did not render a guarded project result",
  );
  assertNoBrowserErrors("owner route");

  const staffToken = await createSession(staff.id);
  await authenticate(staffToken);
  await navigate(`/admin/projekt/${ownerProject.id}/viewer`);
  assert.ok(
    await browser.evaluate(
      "!!document.querySelector('.viewer-next-shell') || !!document.querySelector('[data-project-viewer-state]')",
    ),
    "Staff route did not render a guarded project result",
  );
  assertNoBrowserErrors("staff route");

  await rm(bundleDir, { recursive: true, force: true });
  // Vite is available through the workspace test runner's dependency graph.
  // Resolving it from Vitest avoids adding a production dependency solely for
  // this isolated browser harness.
  const { build } = await import(vitestRequire.resolve("vite"));
  const buildResult = await build({
    configFile: false,
    root: process.cwd(),
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
    },
    esbuild: {
      jsx: "automatic",
    },
    resolve: {
      alias: {
        "@": new URL("../", import.meta.url).pathname,
        // The package root also exports its Node-only JSON-schema validator.
        // This browser bundle only consumes the pure computeDerived export.
        "@workspace/measurement": new URL(
          "./viewer-partial-measurement-browser.ts",
          import.meta.url,
        ).pathname,
      },
    },
    build: {
      outDir: bundleDir,
      emptyOutDir: true,
      minify: false,
      sourcemap: false,
      lib: {
        entry: new URL(
          "./viewer-partial-quantities-entry.tsx",
          import.meta.url,
        ).pathname,
        formats: ["iife"],
        name: "ViewerPartialQuantities",
        fileName: () => "viewer-partial-quantities.js",
      },
    },
  });
  assert.ok(!Array.isArray(buildResult) || buildResult.length > 0);
  const bundle = await (
    await import("node:fs/promises")
  ).readFile(`${bundleDir}/viewer-partial-quantities.js`, "utf8");
  await browser.evaluate(`(() => { ${bundle}\n })()`);
  assert.equal(
    await browser.evaluate("typeof window.mountPartialViewer"),
    "function",
    "Isolated viewer mount was not installed",
  );

  for (const scenario of ["omitted", "null", "malformed"] as const) {
    browser.exceptions.length = 0;
    browser.consoleMessages.length = 0;
    const snapshot = (await browser.evaluate(
      `window.mountPartialViewer(${JSON.stringify(scenario)})`,
    )) as Snapshot;
    assert.equal(snapshot.kind, "viewer", `${scenario}: not viewer-ready`);
    for (const cardId of checkedCardIds) {
      assert.equal(
        snapshot.cards[cardId],
        "—",
        `${scenario}: ${cardId} fabricated a known quantity`,
      );
    }
    assert.equal(
      snapshot.rows.ds,
      "—",
      `${scenario}: downspouts fabricated a known quantity`,
    );
    await waitUntil(
      browser,
      `document.body.innerText.includes(${JSON.stringify(
        `Isolated partial data: ${scenario}`,
      )}) && !!document.querySelector('.viewer-next-shell') && !!document.querySelector('[data-viewer-row-id="ds"]')`,
    );
    const visible = await visibleValues();
    for (const cardId of checkedCardIds) {
      assert.equal(
        visible.cards[cardId],
        snapshot.cards[cardId],
        `${scenario}: ${cardId} DOM did not match prepared card`,
      );
    }
    assert.equal(
      visible.downspouts,
      snapshot.rows.ds,
      `${scenario}: downspout DOM did not match prepared row`,
    );
    assertNoBrowserErrors(`${scenario} isolated viewer`);
  }

  browser.exceptions.length = 0;
  browser.consoleMessages.length = 0;
  const empty = (await browser.evaluate(
    "window.mountPartialViewer('empty')",
  )) as Snapshot;
  assert.equal(empty.kind, "viewer");
  for (const cardId of checkedCardIds) {
    assert.notEqual(
      empty.cards[cardId],
      "—",
      `empty: ${cardId} should be an exact zero`,
    );
  }
  assert.notEqual(empty.rows.ds, "—", "empty: downspouts should be exact zero");
  await waitUntil(
    browser,
    "document.body.innerText.includes('Isolated partial data: empty') && !!document.querySelector('.viewer-next-shell') && !!document.querySelector('[data-viewer-row-id=\"ds\"]')",
  );
  const visibleEmpty = await visibleValues();
  for (const cardId of checkedCardIds) {
    assert.equal(
      visibleEmpty.cards[cardId],
      empty.cards[cardId],
      `empty: ${cardId} DOM did not match prepared card`,
    );
  }
  assert.equal(visibleEmpty.downspouts, empty.rows.ds);
  assertNoBrowserErrors("empty isolated viewer");

  return {
    authenticatedOwnerRoute: "passed",
    authenticatedStaffRoute: "passed",
    isolatedScenarios: ["omitted", "null", "malformed", "empty"],
    result: "passed",
    consoleErrors: 0,
  };
}

async function run() {
  browser = await connectBrowser();
  let result: Awaited<ReturnType<typeof main>> | undefined;
  try {
    result = await main();
  } finally {
    await browser.send("Network.clearBrowserCookies").catch(() => undefined);
    for (const tokenHash of temporaryHashes) {
      await db
        .delete(sessionsTable)
        .where(eq(sessionsTable.tokenHash, tokenHash))
        .catch(() => undefined);
    }
    for (const tokenHash of temporaryHashes) {
      const remaining = await db
        .select({ tokenHash: sessionsTable.tokenHash })
        .from(sessionsTable)
        .where(eq(sessionsTable.tokenHash, tokenHash));
      assert.equal(remaining.length, 0, "Temporary session cleanup failed");
    }
    await rm(bundleDir, { recursive: true, force: true });
    browser.close();
    await pool.end();
  }
  console.log(
    JSON.stringify({
      ...result,
      temporarySessions: temporaryHashes.size,
      temporarySessionCleanup: "passed",
    }),
  );
}

void run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});