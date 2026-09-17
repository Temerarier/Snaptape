// Dependency-free browser regression helper. Start Chromium with
// --remote-debugging-port=9223, then run the conformance script.
export async function connectBrowser() {
  const targets = await (await fetch("http://localhost:9223/json/list")).json();
  const target = targets.find(target => target.type === "page");
  if (!target) throw new Error("No Chromium page found on debugging port 9223");
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let sequence = 0;
  const pending = new Map();
  const exceptions = [];
  socket.addEventListener("message", event => {
    const data = JSON.parse(event.data);
    if (data.method === "Runtime.exceptionThrown") exceptions.push(data.params);
    if (!data.id) return;
    const callback = pending.get(data.id);
    if (!callback) return;
    pending.delete(data.id);
    clearTimeout(callback.timer);
    if (data.error) callback.reject(new Error(JSON.stringify(data.error)));
    else callback.resolve(data.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP timeout: ${method}`));
    }, 30000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
  await send("Runtime.enable");
  await send("Page.enable");
  const evaluate = async expression => {
    const response = await send("Runtime.evaluate", {
      expression, awaitPromise: true, returnByValue: true,
    });
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
    return response.result.value;
  };
  return { send, evaluate, exceptions, close: () => socket.close() };
}

export const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function waitUntil(browser, expression, timeout = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await browser.evaluate(expression)) return;
    await pause(200);
  }
  throw new Error(`Browser condition timed out: ${expression}`);
}