import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import {
  billingTopupRevisionsTable,
  db,
  pool,
  sessionsTable,
  usersTable,
} from "@workspace/db";
import { istStaff } from "../lib/auth/staff";
import {
  connectBrowser,
  pause,
  waitUntil,
} from "./viewer-browser-cdp.mjs";

const base = process.env.BILLING_TEST_ORIGIN ?? "http://127.0.0.1:22421";
const workspaceRoot = new URL("../../../", import.meta.url);
const temporarySessionHashes = new Set<string>();
const temporaryScope = `billing-browser-${randomUUID()}`;
let temporaryTopupId: string | undefined;
let browser: Awaited<ReturnType<typeof connectBrowser>>;

async function createTemporarySession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await db.insert(sessionsTable).values({
    tokenHash,
    userId,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  });
  temporarySessionHashes.add(tokenHash);
  return token;
}

async function authenticate(token?: string) {
  await browser.send("Network.clearBrowserCookies");
  if (!token) return;
  await browser.send("Network.setCookie", {
    name: "aufmass_session",
    value: token,
    url: base,
    secure: base.startsWith("https:"),
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

async function setFormValues(
  formIndex: number,
  values: Record<string, string>,
) {
  await browser.evaluate(`(() => {
    const form = document.querySelectorAll("form")[${formIndex}];
    if (!form) throw new Error("Expected billing form was not found");
    const values = ${JSON.stringify(values)};
    for (const [name, value] of Object.entries(values)) {
      const input = form.elements.namedItem(name);
      if (!(input instanceof HTMLInputElement)) {
        throw new Error("Expected billing input was not found");
      }
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      ).set;
      setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return true;
  })()`);
}

async function submitForm(formIndex: number) {
  await browser.evaluate(
    `document.querySelectorAll("form")[${formIndex}].requestSubmit(); true`,
  );
}

async function main() {
  browser = await connectBrowser();
  await browser.send("Network.enable");
  await browser.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1100,
    deviceScaleFactor: 1,
    mobile: false,
  });

  const users = await db
    .select({ id: usersTable.id, email: usersTable.email })
    .from(usersTable);
  const staff = users.find((user) => istStaff(user.email));
  const nonStaff = users.find((user) => !istStaff(user.email));
  assert.ok(staff, "No existing staff account satisfies the staff predicate");
  assert.ok(nonStaff, "No existing non-staff account is available");
  const staffToken = await createTemporarySession(staff.id);
  const nonStaffToken = await createTemporarySession(nonStaff.id);

  // Logged-out users follow the ordinary authentication redirect. A normal
  // account receives the intentional staff-route 404.
  await authenticate();
  await navigate("/admin/billing");
  assert.equal(
    await browser.evaluate("location.pathname"),
    "/login",
    "logged-out billing route did not redirect to login",
  );

  await authenticate(nonStaffToken);
  await navigate("/admin/billing");
  assert.match(
    await browser.evaluate("document.body.innerText"),
    /This page could not be found|404|Diese Seite konnte nicht gefunden werden/i,
    "non-staff billing route did not return the intentional 404",
  );

  await authenticate(staffToken);
  await navigate("/admin/billing");
  assert.equal(await browser.evaluate("location.pathname"), "/admin/billing");
  assert.ok(
    await browser.evaluate(
      "document.querySelectorAll('table').length >= 2 && document.querySelectorAll('form').length === 2",
    ),
    "staff billing dashboard did not render its tables and top-up forms",
  );

  await mkdir(new URL("screenshots/", workspaceRoot), { recursive: true });
  const image = await browser.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  await writeFile(
    new URL("screenshots/billing-staff.png", workspaceRoot),
    Buffer.from(image.data, "base64"),
  );

  // Exercise date and provider filters without invoking either provider.
  const today = new Date().toISOString().slice(0, 10);
  await browser.evaluate(`(() => {
    const set = (input, value) => {
      const prototype = input instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, "value").set.call(input, value);
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const dates = document.querySelectorAll('input[type="date"]');
    set(dates[0], ${JSON.stringify(today)});
    set(dates[1], ${JSON.stringify(today)});
    set(document.querySelector("select"), "moonshot");
    const button = [...document.querySelectorAll("button")]
      .find((item) => item.textContent.trim() === "Filter");
    button.click();
    return true;
  })()`);
  await waitUntil(
    browser,
    `location.search.includes("from=${today}") && location.search.includes("to=${today}") && location.search.includes("provider=moonshot")`,
  );
  await waitUntil(browser, "!document.body.innerText.includes('Loading...')");
  const filteredProviders = await browser.evaluate(`[
    ...document.querySelectorAll("table:first-of-type tbody tr")
  ].map(row => row.children[1]?.textContent.trim()).filter(Boolean)`);
  assert.ok(
    filteredProviders.every((provider: string) => provider === "moonshot"),
    "provider filter left a non-Moonshot billing row visible",
  );

  // Create one isolated positive top-up, correct it to zero, and verify that
  // both immutable audit revisions survive a real browser refresh.
  const effectiveAt = `${today}T12:00`;
  const createdNote = `browser create ${temporaryScope}`;
  const correctedNote = `browser zero correction ${temporaryScope}`;
  await setFormValues(0, {
    accountScope: temporaryScope,
    amountUsd: "1.23",
    effectiveAt,
    note: createdNote,
  });
  await submitForm(0);
  await waitUntil(
    browser,
    `document.body.innerText.includes(${JSON.stringify(createdNote)})`,
  );
  temporaryTopupId = await browser.evaluate(`(() => {
    const row = [...document.querySelectorAll("table:last-of-type tbody tr")]
      .find(item => item.innerText.includes(${JSON.stringify(createdNote)}));
    return row?.querySelector("td")?.title;
  })()`);
  assert.match(
    temporaryTopupId ?? "",
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    "created top-up audit row did not expose its identifier",
  );

  await setFormValues(1, {
    topupId: temporaryTopupId!,
    amountUsd: "0",
    effectiveAt,
    note: correctedNote,
  });
  await submitForm(1);
  await waitUntil(
    browser,
    `document.body.innerText.includes(${JSON.stringify(correctedNote)})`,
  );
  await navigate(
    `/admin/billing?from=${today}&to=${today}&provider=moonshot`,
  );
  const auditState = await browser.evaluate(`(() => {
    const rows = [...document.querySelectorAll("table:last-of-type tbody tr")]
      .filter(row => row.innerText.includes(${JSON.stringify(temporaryScope)}));
    return {
      count: rows.length,
      revisions: rows.map(row => row.children[0]?.innerText),
      amounts: rows.map(row => row.children[2]?.innerText),
    };
  })()`);
  assert.equal(auditState.count, 2, "refresh did not retain both audit revisions");
  assert.ok(
    auditState.revisions.some((value: string) => /v1/.test(value)) &&
      auditState.revisions.some((value: string) => /v2/.test(value)),
    "audit table did not show revisions one and two",
  );
  assert.ok(
    auditState.amounts.some((value: string) => value.includes("$0.00")),
    "zero-value correction was not visible after refresh",
  );

  const externalRequests = await browser.evaluate(
    `performance.getEntriesByType("resource")
      .map(entry => entry.name)
      .filter(name => new URL(name).origin !== location.origin)`,
  );
  assert.deepEqual(
    externalRequests,
    [],
    "billing verification made an external browser request",
  );
  assert.equal(
    browser.exceptions.length,
    0,
    "billing dashboard raised an uncaught browser exception",
  );
  assert.equal(
    browser.consoleMessages.filter(
      (entry: { type?: string }) =>
        entry.type === "error" || entry.type === "assert",
    ).length,
    0,
    "billing dashboard logged a browser error",
  );
}

async function cleanup() {
  await db
    .delete(billingTopupRevisionsTable)
    .where(eq(billingTopupRevisionsTable.accountScope, temporaryScope));
  const remainingTopups = await db
    .select({ id: billingTopupRevisionsTable.id })
    .from(billingTopupRevisionsTable)
    .where(eq(billingTopupRevisionsTable.accountScope, temporaryScope))
    .limit(1);
  assert.equal(remainingTopups.length, 0, "temporary top-up cleanup failed");
  for (const tokenHash of temporarySessionHashes) {
    await db
      .delete(sessionsTable)
      .where(eq(sessionsTable.tokenHash, tokenHash));
    const remainingSessions = await db
      .select({ id: sessionsTable.id })
      .from(sessionsTable)
      .where(eq(sessionsTable.tokenHash, tokenHash))
      .limit(1);
    assert.equal(
      remainingSessions.length,
      0,
      "temporary session cleanup failed",
    );
  }
  await browser?.send("Network.clearBrowserCookies").catch(() => undefined);
  browser?.close();
  await pool.end();
}

void main()
  .then(() => console.log("Billing browser verification passed"))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Billing browser verification failed");
    process.exitCode = 1;
  })
  .finally(cleanup);