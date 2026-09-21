import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { inArray, eq } from "drizzle-orm";
import {
  db,
  pool,
  projectsTable,
  sessionsTable,
  usersTable,
} from "@workspace/db";
import { getDictionary, toLocale } from "../i18n";
import {
  connectBrowser,
  pause,
  waitUntil,
} from "./viewer-browser-cdp.mjs";

const base =
  process.env.VIEWER_TEST_ORIGIN ??
  (process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : null);
if (!base) throw new Error("VIEWER_TEST_ORIGIN or REPLIT_DEV_DOMAIN is required");

async function main() {
  const browser = await connectBrowser();
  let tokenHash: string | null = null;
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
    const navigate = async (path: string) => {
      browser.exceptions.length = 0;
      browser.consoleMessages.length = 0;
      await browser.send("Page.navigate", { url: `${base}${path}` });
      await waitUntil(
        browser,
        "document.readyState === 'complete' && !!document.body?.innerText",
      );
      await pause(800);
      assert.equal(browser.exceptions.length, 0);
      assert.equal(
        browser.consoleMessages.filter(
          (entry: { type?: string }) =>
            entry.type === "error" || entry.type === "assert",
        ).length,
        0,
      );
    };

    await browser.send("Network.clearBrowserCookies");
    await navigate("/login");
    assert.ok(await browser.evaluate("!!document.querySelector('form')"));
    assert.ok(
      await browser.evaluate(
        "!![...document.querySelectorAll('canvas')].find(canvas => canvas.getBoundingClientRect().width > 0 && canvas.getBoundingClientRect().height > 0)",
      ),
      "login house canvas was not rendered",
    );

    const [project] = await db
      .select({
        id: projectsTable.id,
        userId: projectsTable.userId,
      })
      .from(projectsTable)
      .where(
        inArray(projectsTable.status, [
          "classified",
          "processing",
          "reviewing",
          "ready",
        ]),
      )
      .limit(1);
    assert.ok(project, "no project can exercise the legacy summary-tile page");
    const [owner] = await db
      .select({ locale: usersTable.locale })
      .from(usersTable)
      .where(eq(usersTable.id, project.userId))
      .limit(1);
    assert.ok(owner);

    const token = randomBytes(32).toString("hex");
    tokenHash = createHash("sha256").update(token).digest("hex");
    await db.insert(sessionsTable).values({
      tokenHash,
      userId: project.userId,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    await browser.send("Network.setCookie", {
      name: "aufmass_session",
      value: token,
      url: base,
      secure: true,
      httpOnly: true,
      sameSite: "Lax",
    });

    await navigate(`/app/projekt/${project.id}`);
    const summaryTitle = getDictionary(toLocale(owner.locale)).projectDetail.cards
      .messwerte.title;
    assert.ok(
      await browser.evaluate(
        `document.body.innerText.includes(${JSON.stringify(summaryTitle)})`,
      ),
      "authorized measurement summary tile was not visible",
    );
    assert.ok(
      await browser.evaluate(
        "!!document.querySelector('a[href=\"/viewer-next\"]')",
      ),
      "project summary demo navigation did not target /viewer-next",
    );

    await navigate("/app");
    await browser.evaluate(
      "document.querySelector('button[aria-haspopup=\"menu\"]')?.click()",
    );
    await pause(100);
    assert.ok(
      await browser.evaluate(
        "!!document.querySelector('a[href=\"/viewer-next\"]')",
      ),
      "authorized user-menu demo navigation did not target /viewer-next",
    );

    await navigate("/app/viewer");
    assert.match(
      await browser.evaluate("document.body.innerText"),
      /This page could not be found|404/i,
    );
  } finally {
    await browser.send("Network.clearBrowserCookies").catch(() => undefined);
    if (tokenHash) {
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
    browser.close();
    await pool.end();
  }
}

void main().catch((error) => {
  console.error(String(error));
  process.exitCode = 1;
});