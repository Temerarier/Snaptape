// This process has no application credentials. AI code runs ONLY in isolated-vm.
const ivm = require("isolated-vm");
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", chunk => {
  input += chunk;
  if (Buffer.byteLength(input) > 12 * 1024 * 1024) process.exit(2);
});
process.stdin.on("end", async () => {
  let isolate;
  const start = Date.now();
  try {
    const { source, mess, code } = JSON.parse(input);
    isolate = new ivm.Isolate({ memoryLimit: 128 });
    const context = await isolate.createContext();
    await context.global.set("MESS_JSON", mess, { copy: true });
    await context.global.set("CODE", code, { copy: true });
    // No host callbacks/references: only copied strings cross into the isolate.
    const result = await context.eval(
      source + "\n;const C = SNAPTAPE_CORE(); const stringify = JSON.stringify.bind(JSON);"
      + "\nstringify(C.runBuild(JSON.parse(MESS_JSON), CODE));",
      { timeout: 8000, copy: true },
    );
    process.stdout.write(JSON.stringify({ result, sandboxMs: Date.now() - start }));
  } catch (error) {
    const message = String(error && error.message || error);
    const kind = /memory|disposed|allocation/i.test(message) ? "memory"
      : /timed out|timeout/i.test(message) ? "timeout" : "error";
    process.stdout.write(JSON.stringify({ kind, sandboxMs: Date.now() - start }));
  } finally {
    if (isolate && !isolate.isDisposed) isolate.dispose();
  }
});
