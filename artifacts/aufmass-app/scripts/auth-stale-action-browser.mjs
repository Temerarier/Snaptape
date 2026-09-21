import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import {
  connectBrowser,
  pause,
  waitUntil,
} from "./viewer-browser-cdp.mjs";

const base = process.env.AUTH_TEST_ORIGIN ?? "http://127.0.0.1:80";
const browser = await connectBrowser();

async function navigate(path) {
  await browser.send("Page.navigate", { url: `${base}${path}` });
  await waitUntil(
    browser,
    "document.readyState === 'complete' && !!document.querySelector('form button[type=submit]')",
  );
}

async function submitEmptyAndReadAlert() {
  const exceptionStart = browser.exceptions.length;
  const errorStart = browser.consoleMessages.length;
  await browser.evaluate(
    "document.querySelector('form button[type=submit]').click(); true",
  );
  await waitUntil(browser, "!!document.querySelector('[role=alert]')");
  await pause(100);
  assert.equal(
    browser.exceptions.length,
    exceptionStart,
    "submission caused an uncaught browser exception",
  );
  const newConsole = browser.consoleMessages.slice(errorStart).filter(
    (entry) =>
      entry.type === "error" &&
      !JSON.stringify(entry).includes("THREE.WebGLRenderer"),
  );
  assert.deepEqual(newConsole, [], "submission logged a browser error");
  return browser.evaluate(
    "document.querySelector('[role=alert]').textContent.trim()",
  );
}

async function interceptNextActionAsObsolete() {
  await browser.evaluate(`(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const headers = new Headers(init?.headers);
      if (headers.has("next-action")) {
        return Promise.resolve(new Response("", {
          status: 404,
          headers: {
            "content-type": "text/plain",
            "x-nextjs-action-not-found": "1"
          }
        }));
      }
      return originalFetch(input, init);
    };
    return true;
  })()`);
}

async function verifyForm(path, expectedValidation) {
  await navigate(path);
  assert.match(await submitEmptyAndReadAlert(), expectedValidation);

  await navigate(path);
  await interceptNextActionAsObsolete();
  const staleText = await submitEmptyAndReadAlert();
  assert.equal(
    staleText,
    "This page is out of date. Reload it, then submit the form again.",
  );
  const recoveryState = await browser.evaluate(`(() => {
    const submit = document.querySelector('form button[type=submit]');
    const reload = [...document.querySelectorAll('form button[type=button]')]
      .find(button => button.textContent.trim() === "Reload page");
    return {
      submitDisabled: submit?.disabled === true,
      reloadVisible: !!reload,
      reloadText: reload?.textContent.trim() ?? null
    };
  })()`);
  assert.deepEqual(recoveryState, {
    submitDisabled: true,
    reloadVisible: true,
    reloadText: "Reload page",
  });
  await browser.evaluate(
    "document.querySelector('[role=alert]').scrollIntoView({ block: 'center' }); true",
  );
  await pause(50);
  await mkdir("screenshots/auth-stale-action", { recursive: true });
  const image = await browser.send("Page.captureScreenshot", {
    format: "jpeg",
    quality: 88,
    captureBeyondViewport: false,
  });
  await writeFile(
    `screenshots/auth-stale-action/${path.slice(1)}-recovery.jpg`,
    Buffer.from(image.data, "base64"),
  );

  // A real navigation clears the injected fetch shim and obtains current
  // action IDs, which is exactly what the visible recovery button requests.
  await navigate(path);
  assert.match(await submitEmptyAndReadAlert(), expectedValidation);
}

try {
  await verifyForm("/login", /invalid email or password|invalid credentials/i);
  await verifyForm("/register", /valid email|password/i);
  console.log("Auth stale-action browser recovery passed");
} finally {
  browser.close();
}