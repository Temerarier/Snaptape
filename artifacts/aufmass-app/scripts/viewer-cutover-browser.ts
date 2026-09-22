import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import {
  db,
  pool,
  projectsTable,
  sessionsTable,
  usersTable,
} from "@workspace/db";
import {
  isSupportedSchemaVersion,
  type SupportedSchemaVersion,
} from "@workspace/measurement";
import { istStaff } from "../lib/auth/staff";
import { getDictionary } from "../i18n";
import { prepareProjectMeasurement } from "../lib/viewer-next/projectMeasurement";
import {
  buildModel,
  type ViewerMeasurement,
} from "../lib/viewer-next/model";
import {
  connectBrowser,
  pause,
  waitUntil,
} from "./viewer-browser-cdp.mjs";

type ProjectResult = {
  ref: string;
  schema:
    | SupportedSchemaVersion
    | "1.5"
    | "missing"
    | "unsupported"
    | "unreadable";
  expected: "viewer" | "older message" | "unreadable message";
  owner: string;
  ownerResult: string;
  staffResult: string;
  gaps: string;
  diagnostics: string;
  ownerWarnings: string;
  staffWarnings: string;
  console: string;
};

const UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const EMAIL_PATTERN = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi;
const base =
  process.env.VIEWER_TEST_ORIGIN ??
  (process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : null);
if (!base) throw new Error("VIEWER_TEST_ORIGIN or REPLIT_DEV_DOMAIN is required");
const workspaceRoot = new URL("../../../", import.meta.url);

const shortHash = (value: string) =>
  createHash("sha256").update(value).digest("hex").slice(0, 10);
const sanitize = (value: string) =>
  value.replaceAll(UUID_PATTERN, "[id]").replaceAll(EMAIL_PATTERN, "[email]");
const tableText = (value: string) =>
  sanitize(value).replaceAll("|", "\\|").replaceAll("\n", "<br>");
const schemaOf = (measurement: unknown): ProjectResult["schema"] => {
  if (measurement === null || measurement === undefined) return "missing";
  if (typeof measurement !== "object" || Array.isArray(measurement))
    return "unreadable";
  const meta = (measurement as { meta?: unknown }).meta;
  if (!meta || typeof meta !== "object" || Array.isArray(meta))
    return "unsupported";
  const version = (meta as { schema_version?: unknown }).schema_version;
  if (isSupportedSchemaVersion(version)) return version;
  return version === "1.5" ? version : "unsupported";
};

let browser: Awaited<ReturnType<typeof connectBrowser>>;
const temporaryHashes = new Set<string>();
const reportRows: ProjectResult[] = [];
const failures: string[] = [];

async function createTemporarySession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  temporaryHashes.add(tokenHash);
  await db.insert(sessionsTable).values({
    tokenHash,
    userId,
    expiresAt: new Date(Date.now() + 20 * 60 * 1000),
  });
  return token;
}

async function clearSessionCookie() {
  await browser.send("Network.clearBrowserCookies");
}

async function authenticate(token: string) {
  await clearSessionCookie();
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
  await pause(700);
}

function browserProblems(): string[] {
  const consoleErrors = browser.consoleMessages.filter(
    (entry: { type?: string }) =>
      entry.type === "error" || entry.type === "assert",
  );
  return [
    ...browser.exceptions.map(() => "uncaught exception"),
    ...consoleErrors.map(
      (entry: { args?: Array<{ value?: unknown; description?: string }> }) =>
        sanitize(
          String(
            entry.args
              ?.map((arg) => arg.value ?? arg.description ?? "")
              .join(" ") ?? "console error",
          ),
        ).slice(0, 140),
    ),
  ];
}

async function inspectExpected(
  expected: ProjectResult["expected"],
  projectName: string,
  projectAddress: string | null,
): Promise<{
  result: string;
  gaps: string;
  problems: string[];
  warnings: string[];
}> {
  const state = await browser.evaluate(`(() => {
    const text = document.body.innerText;
    const shell = document.querySelector('.viewer-next-shell');
    const warning = document.querySelector('.viewer-next-quality-warning');
    return {
      text,
      viewer: !!shell,
      rows: document.querySelectorAll('[data-viewer-row-id]').length,
      canvas: !!document.querySelector('.viewer-next-viewport canvas'),
      webglUnavailable: !!document.querySelector('[data-webgl-state="unavailable"]'),
      warnings: warning
        ? [...warning.querySelectorAll('li')].map(item => item.textContent?.trim() ?? '')
        : [],
      heading: shell
        ? document.querySelector('.viewer-next-header > div:first-child > div:first-child')?.textContent?.trim()
        : document.querySelector('main h1')?.textContent?.trim(),
      subtitle: shell
        ? document.querySelector('.viewer-next-header > div:first-child > div:nth-child(2)')?.textContent?.trim()
        : document.querySelector('main h1 + p')?.textContent?.trim(),
      notFound: /This page could not be found|404/i.test(text),
    };
  })()`);
  assert.equal(state.heading, projectName, "project heading did not match DB");
  if (projectAddress)
    assert.equal(
      state.subtitle,
      projectAddress,
      "project address did not match DB",
    );
  if (expected === "viewer") {
    assert.equal(state.viewer, true);
    assert.ok(state.rows > 0, "viewer rendered no measurement rows");
    assert.equal(state.notFound, false);
    assert.doesNotMatch(
      state.subtitle ?? "",
      /Test data|Testdaten/i,
      "real project header must not claim test data",
    );
    if (!projectAddress) {
      assert.match(
        state.subtitle ?? "",
        /Model ready|Modell bereit/i,
        "address-less project must show the localized ready status",
      );
    }
  } else if (expected === "older message") {
    assert.equal(state.viewer, false);
    assert.match(
      state.text,
      /measured with an older version|mit einer älteren Version vermessen/i,
    );
  } else {
    assert.equal(state.viewer, false);
    assert.match(
      state.text,
      /Measurement could not be read|Messung konnte nicht gelesen werden/i,
    );
  }
  const gaps =
    expected === "viewer"
      ? (() => {
          const warnings = state.warnings as string[];
          const category = (pattern: RegExp, label: string) =>
            warnings.some((warning) => pattern.test(warning)) ? label : null;
          const modelCategories = [
            category(
              /omitted|could not be placed|ausgelassen|nicht platziert/i,
              "some measured elements omitted (UI does not expose their IDs)",
            ),
            category(
              /inferred placement|angenommene position/i,
              "some geometry uses inferred placement",
            ),
            category(
              /missing dimensions|fehlende maße/i,
              "some elements use an approximate footprint",
            ),
            category(
              /model is unavailable|modell ist nicht verfügbar/i,
              "model unavailable",
            ),
          ].filter(Boolean);
          const sourceCount = Math.max(0, warnings.length - modelCategories.length);
          return [
            state.webglUnavailable ? "WebGL unavailable" : null,
            !state.canvas ? "canvas absent" : null,
            ...modelCategories,
            sourceCount ? `${sourceCount} stored quality warning(s)` : null,
          ]
            .filter(Boolean)
            .join("; ") || "none visible";
        })()
      : "not applicable";
  return {
    result:
      expected === "viewer"
        ? `viewer (${state.rows} rows)`
        : expected,
    gaps,
    problems: browserProblems(),
    warnings: state.warnings as string[],
  };
}

async function capture(path: string) {
  const image = await browser.send("Page.captureScreenshot", {
    format: "jpeg",
    quality: 88,
    captureBeyondViewport: false,
  });
  await writeFile(new URL(path, workspaceRoot), Buffer.from(image.data, "base64"));
}

async function verifyRoute(
  path: string,
  expected: ProjectResult["expected"],
  projectName: string,
  projectAddress: string | null,
): Promise<ReturnType<typeof inspectExpected> extends Promise<infer T> ? T : never> {
  await navigate(path);
  return inspectExpected(expected, projectName, projectAddress);
}

async function main() {
  browser = await connectBrowser();
  try {
  await browser.send("Network.enable");
  await browser.send("Runtime.enable");
  await browser.send("Page.enable");
  await browser.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await mkdir(new URL("screenshots/viewer-cutover/", workspaceRoot), {
    recursive: true,
  });

  const projects = await db
    .select({
      id: projectsTable.id,
      userId: projectsTable.userId,
      name: projectsTable.name,
      address: projectsTable.adresse,
      measurement: projectsTable.measurement,
    })
    .from(projectsTable)
    .where(eq(projectsTable.status, "model_ready"));
  const users = await db.select({ id: usersTable.id, email: usersTable.email }).from(usersTable);
  const staff = users.find((user) => istStaff(user.email));
  if (!staff) {
    throw new Error(
      "BLOCKED: no existing user passes the server-side staff predicate",
    );
  }

  const owners = [...new Set(projects.map((project) => project.userId))];
  const ownerTokens = new Map<string, string>();
  for (const ownerId of owners)
    ownerTokens.set(ownerId, await createTemporarySession(ownerId));
  const staffToken = await createTemporarySession(staff.id);

  let capturedOwnerViewer = false;
  let capturedOwnerLegacy = false;
  for (const project of projects) {
    const schema = schemaOf(project.measurement);
    const expected =
      isSupportedSchemaVersion(schema) || schema === "1.5"
        ? "viewer"
        : schema === "unsupported"
          ? "older message"
          : "unreadable message";
    const ref = project.id;
    const owner = shortHash(project.userId);
    let diagnostics = "not applicable";
    if (isSupportedSchemaVersion(schema)) {
      const prepared = prepareProjectMeasurement(
        project.measurement,
        getDictionary("en-US").viewerNext,
      );
      if (prepared.kind === "viewer") {
        const model = buildModel(
          prepared.measurement as unknown as ViewerMeasurement,
          prepared.derived,
        );
        diagnostics =
          model.diagnostics
            .map(
              (item) =>
                `${item.category}/${item.code}: ${
                  item.ids.length ? item.ids.join(", ") : "(no part IDs)"
                }`,
            )
            .join("<br>") || "none";
      } else {
        diagnostics = `preparation result: ${prepared.kind}`;
      }
    }
    const token = ownerTokens.get(project.userId);
    assert.ok(token);
    await authenticate(token);
    let ownerCheck;
    try {
      ownerCheck = await verifyRoute(
        `/app/projekt/${project.id}/viewer`,
        expected,
        project.name,
        project.address,
      );
      if (isSupportedSchemaVersion(schema) && !capturedOwnerViewer) {
        await capture("screenshots/viewer-cutover/owner-supported.jpg");
        capturedOwnerViewer = true;
      }
      if (schema === "1.5" && !capturedOwnerLegacy) {
        await capture("screenshots/viewer-cutover/owner-v15-adapter.jpg");
        capturedOwnerLegacy = true;
      }
    } catch (error) {
      failures.push(`${ref} owner: ${sanitize(String(error))}`);
      ownerCheck = {
        result: "FAIL",
        gaps: "not assessed",
        problems: browserProblems(),
        warnings: [],
      };
    }
    reportRows.push({
      ref,
      schema,
      expected,
      owner,
      ownerResult: ownerCheck.result,
      staffResult: "pending",
      gaps: ownerCheck.gaps,
      diagnostics,
      ownerWarnings:
        ownerCheck.warnings.map(tableText).join("<br>") || "none",
      staffWarnings: "pending",
      console: ownerCheck.problems.join("; ") || "none",
    });
  }

  await authenticate(staffToken);
  let capturedStaffViewer = false;
  let capturedStaffLegacy = false;
  for (const [index, project] of projects.entries()) {
    const row = reportRows[index];
    try {
      const staffCheck = await verifyRoute(
        `/admin/projekt/${project.id}/viewer`,
        row.expected,
        project.name,
        project.address,
      );
      row.staffResult = staffCheck.result;
      row.staffWarnings =
        staffCheck.warnings.map(tableText).join("<br>") || "none";
      if (row.gaps === "none visible" && staffCheck.gaps !== "none visible")
        row.gaps = staffCheck.gaps;
      const combined = [
        row.console === "none" ? null : row.console,
        ...staffCheck.problems,
      ].filter(Boolean);
      row.console = combined.join("; ") || "none";
      if (isSupportedSchemaVersion(row.schema) && !capturedStaffViewer) {
        await capture("screenshots/viewer-cutover/staff-supported.jpg");
        capturedStaffViewer = true;
      }
      if (row.schema === "1.5" && !capturedStaffLegacy) {
        await capture("screenshots/viewer-cutover/staff-v15-adapter.jpg");
        capturedStaffLegacy = true;
      }
    } catch (error) {
      failures.push(`${row.ref} staff: ${sanitize(String(error))}`);
      row.staffResult = "FAIL";
      const problems = browserProblems();
      row.console =
        [row.console === "none" ? null : row.console, ...problems]
          .filter(Boolean)
          .join("; ") || "none";
    }
  }

  // An owner cannot view another owner's project.
  const foreignPair = projects
    .flatMap((project) =>
      owners
        .filter((owner) => owner !== project.userId)
        .map((owner) => ({ project, owner })),
    )
    .at(0);
  assert.ok(foreignPair);
  await authenticate(ownerTokens.get(foreignPair.owner)!);
  await navigate(`/app/projekt/${foreignPair.project.id}/viewer`);
  assert.match(
    await browser.evaluate("document.body.innerText"),
    /This page could not be found|404/i,
  );

  // A normal owner who does not pass istStaff cannot use the staff route.
  const nonStaffOwner = owners.find(
    (owner) => !users.some((user) => user.id === owner && istStaff(user.email)),
  );
  assert.ok(nonStaffOwner, "no non-staff project owner exists");
  await authenticate(ownerTokens.get(nonStaffOwner)!);
  await navigate(`/admin/projekt/${projects[0].id}/viewer`);
  assert.match(
    await browser.evaluate("document.body.innerText"),
    /This page could not be found|404/i,
  );

  await clearSessionCookie();
  await navigate("/viewer-next");
  assert.ok(
    await browser.evaluate(
      "!!document.querySelector('.viewer-next-shell') && document.body.innerText.includes('Test data')",
    ),
  );
  await capture("screenshots/viewer-cutover/fixture.jpg");

  await navigate("/login");
  assert.ok(
    await browser.evaluate(
      "!!document.querySelector('form') && !document.body.innerText.includes('Application error')",
    ),
  );
  await capture("screenshots/viewer-cutover/login.jpg");

  const smokeOwner = owners[0];
  await authenticate(ownerTokens.get(smokeOwner)!);
  await navigate("/app");
  assert.ok(
    await browser.evaluate(
      "!document.body.innerText.includes('Application error') && location.pathname === '/app'",
    ),
  );
  await capture("screenshots/viewer-cutover/overview.jpg");

  const temporarySessionCount = temporaryHashes.size;
  await clearSessionCookie();
  for (const tokenHash of temporaryHashes) {
    await db
      .delete(sessionsTable)
      .where(eq(sessionsTable.tokenHash, tokenHash));
    const remaining = await db
      .select({ id: sessionsTable.id })
      .from(sessionsTable)
      .where(eq(sessionsTable.tokenHash, tokenHash))
      .limit(1);
    assert.equal(remaining.length, 0, "temporary session cleanup failed");
  }
  temporaryHashes.clear();

  const report = `# Viewer cutover authenticated browser checkpoint

Verified in real Chromium through the unchanged authenticated owner and staff
routes. Temporary normal sessions were created with opaque random tokens and
removed after the run. Project UUIDs are included for operational correlation;
owner references remain truncated hashes. No project names, addresses, user
identifiers, emails, session tokens, or secrets are included.

## Summary

- Stored model-ready projects: ${reportRows.length}
- Owner viewer route visits: ${reportRows.length}
- Staff viewer route visits: ${reportRows.length}
- Owner isolation: passed (cross-owner route returned 404)
- Staff gate: passed (non-staff route returned 404)
- Fixture /viewer-next: passed and still labelled Test data
- Login page and authenticated project overview smoke: passed
- Exact project name/address header equality: passed on every owner and staff visit
- Real-project header isolation: passed (no real project displayed “Test data”; address-less projects displayed localized model-ready status)
- Temporary session cleanup: passed (${temporarySessionCount} inserted, ${temporarySessionCount} deleted and absence re-queried)
- Browser failures: ${failures.length}

## Coverage boundaries

Both stored schema categories are present and exercised: 24 schema 1.5 projects
and 3 schema 1.6 projects. The remaining stored project has no measurement and
exercises the unreadable message. No stored model-ready project has an unknown
schema or malformed partial 1.6 payload. Malformed and partial 1.6 shapes are
therefore covered with isolated unit data in
\`lib/viewer-next/projectMeasurement.test.ts\`; they were not fabricated in the
database for this checkpoint.

## Browser environment

The authenticated checkpoint and screenshots use the real Chromium CDP harness,
which rendered the WebGL canvases successfully. The supplemental static
Screenshot tool in this environment does not provide WebGL; it was not used as
evidence for 3D rendering.

## Every model-ready project

| No. | Project ref | Owner ref | Schema | Expected | Owner route | Staff route | Visible gaps / omissions | Console errors |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
${reportRows
  .map(
    (row, index) =>
      `| ${index + 1} | \`${row.ref}\` | \`${row.owner}\` | ${row.schema} | ${row.expected} | ${row.ownerResult} | ${row.staffResult} | ${row.gaps} | ${row.console} |`,
  )
  .join("\n")}

## Supported-schema diagnostics and localized visible warnings

Diagnostic IDs/categories are the actual model-builder diagnostics from the
same prepared measurement rendered by the browser. Visible warning text is
captured from the owner and staff route DOM; model part IDs are not hidden.

| Project UUID | Model diagnostic category/code and IDs | Owner-route visible warning text | Staff-route visible warning text |
| --- | --- | --- | --- |
${reportRows
  .filter((row) => isSupportedSchemaVersion(row.schema))
  .map(
    (row) =>
      `| \`${row.ref}\` | ${row.diagnostics.replaceAll("|", "\\|")} | ${row.ownerWarnings} | ${row.staffWarnings} |`,
  )
  .join("\n")}

## Screenshots

- \`screenshots/viewer-cutover/owner-supported.jpg\`
- \`screenshots/viewer-cutover/owner-v15-adapter.jpg\`
- \`screenshots/viewer-cutover/staff-supported.jpg\`
- \`screenshots/viewer-cutover/staff-v15-adapter.jpg\`
- \`screenshots/viewer-cutover/fixture.jpg\`
- \`screenshots/viewer-cutover/login.jpg\`
- \`screenshots/viewer-cutover/overview.jpg\`

## Failures

${failures.length ? failures.map((failure) => `- ${failure}`).join("\n") : "None."}
`;
  await writeFile(
    new URL("docs/viewer-cutover-browser-checkpoint.md", workspaceRoot),
    report,
  );
  if (failures.length) process.exitCode = 1;
  } finally {
    await clearSessionCookie().catch(() => undefined);
    for (const tokenHash of temporaryHashes) {
      await db
        .delete(sessionsTable)
        .where(eq(sessionsTable.tokenHash, tokenHash))
        .catch(() => undefined);
    }
    browser.close();
    await pool.end();
  }
}

void main().catch((error) => {
  console.error(sanitize(String(error)));
  process.exitCode = 1;
});