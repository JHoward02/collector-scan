#!/usr/bin/env node
/** Diagnostic: exercise provider endpoints from a real browser and report raw outcomes. */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const chromePath = process.env.CHROME_PATH || "/usr/bin/chromium";

const targets = JSON.parse(process.argv[2] ?? "[]");
const page = `<!doctype html><html><body><pre id="out"></pre><script type="module">
const targets = ${JSON.stringify(targets)};
const log = [];
for (const t of targets) {
  try {
    const res = await fetch(t.url, { headers: { Accept: "application/json" } });
    const text = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch {}
    log.push(t.name + " -> HTTP " + res.status + " type=" + (res.headers.get("content-type") || "?"));
    if (parsed) {
      const fn = new Function("p", "return (" + t.probe + ")(p);");
      try { log.push("   " + fn(parsed)); } catch (e) { log.push("   probe error: " + e.message); }
    } else {
      log.push("   body: " + text.slice(0, 160).replace(/\\s+/g, " "));
    }
  } catch (error) {
    log.push(t.name + " -> FETCH ERROR: " + String(error));
  }
}
document.getElementById("out").textContent = log.join("\\n");
<\/script></body></html>`;

const server = createServer((_q, r) => {
  r.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  r.end(page);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();

const chrome = spawn(chromePath, [
  "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
  "--no-first-run", "--no-default-browser-check",
  `--user-data-dir=${path.join(root, ".chrome-probe-profile")}`,
  "--virtual-time-budget=30000", "--dump-dom", `http://127.0.0.1:${port}/`,
], { stdio: ["ignore", "pipe", "pipe"] });

let stdout = "";
chrome.stdout.on("data", (c) => { stdout += c; });
await new Promise((resolve) => chrome.on("close", resolve));
server.close();
const m = stdout.match(/<pre id="out">([\s\S]*?)<\/pre>/);
console.log(m ? m[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&") : "no output");
