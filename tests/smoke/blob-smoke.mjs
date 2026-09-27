#!/usr/bin/env node
/**
 * Real-browser acceptance test for the built artifact.
 *
 * Canvas loads the app by fetching the entrypoint text, wrapping it in a Blob
 * URL, and importing it as ESM. This reproduces that path in Chromium against
 * the actual `dist/extension.js`, with public provider traffic stubbed so the
 * test is deterministic and offline-safe.
 *
 * Requires a Chrome/Chromium binary; set CHROME_PATH to override.
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const bundlePath = path.join(root, "dist", "extension.js");
// CI's preinstalled Chrome can keep the dump-dom process alive indefinitely.
// Run the deterministic built-artifact check there; set CHROME_PATH explicitly
// to opt into the separate real-browser acceptance check.
const chromePath = process.env.CHROME_PATH || (!process.env.CI && ["/usr/bin/chromium", "/usr/bin/google-chrome", "/usr/bin/chromium-browser"].find(p => spawnSync("test", ["-x", p]).status === 0));
if (!chromePath) {
  console.log("Chromium unavailable; running built-artifact jsdom smoke instead.");
  const fallback = spawnSync(process.execPath, [path.join(root, "tests/smoke/jsdom-smoke.mjs")], { stdio: "inherit" });
  process.exit(fallback.status ?? 1);
}

try {
  await stat(bundlePath);
} catch {
  console.error(`blob-smoke: missing ${bundlePath}. Run \`npm run build\` first.`);
  process.exit(1);
}
const bundleSource = await readFile(bundlePath, "utf8");

const page = `<!doctype html>
<html><head><meta charset="utf-8"><title>blob smoke</title></head>
<body><main id="host"></main><pre id="smoke"></pre><script type="module">
const source = ${JSON.stringify(bundleSource)};
const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok, detail });
const report = () => { document.getElementById("smoke").textContent = JSON.stringify(results); };

function hostDouble() {
  const registered = [];
  const mounted = [];
  return {
    registered,
    mounted,
    host: {
      apiVersion: "1",
      extension: { name: "collector-scan", version: "0.1.0", resolvedRef: "smoke" },
      backend: { id: "smoke-backend", kind: "local", orgId: null },
      registerPage(id, mount) { registered.push(id); mounted.push(mount); return () => registered.splice(registered.indexOf(id), 1); },
      navigate() {},
      agentServer: { async request() { return {}; } },
    },
  };
}

try {
  const blobUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  const module = await import(/* @vite-ignore */ blobUrl);
  URL.revokeObjectURL(blobUrl);

  record("entrypoint exports activate", typeof module.activate === "function");

  const double = hostDouble();
  const dispose = module.activate(double.host);
  record("registers declared page once", double.registered.length === 1 && double.registered[0] === "collection",
    "got " + JSON.stringify(double.registered));

  const styleNodes = document.querySelectorAll('style[data-cs="collector-scan-styles"]');
  record("injects scoped stylesheet", styleNodes.length === 1);

  const container = document.createElement("div");
  document.getElementById("host").append(container);
  const unmount = await double.mounted[0]({ container, path: "", navigate() {} });
  record("mount renders UI", Boolean(container.querySelector(".cs-app")));
  record("renders search input", Boolean(container.querySelector("#cs-search-input")));
  record("no nested main landmark", container.querySelectorAll("main").length === 0);

  unmount();
  record("unmount clears DOM", container.childElementCount === 0);

  dispose();
  record("deactivate unregisters", double.registered.length === 0);
  record("deactivate removes styles", document.querySelectorAll('style[data-cs="collector-scan-styles"]').length === 0);

  record("no bare module specifiers embedded",
    !/(^|[;}\\n])\\s*import\\s*[^"'()]*from\\s*["'][^.]/.test(source));
} catch (error) {
  results.push({ name: "load", ok: false, detail: String((error && error.stack) || error) });
}
report();
<\/script></body></html>`;

const server = createServer((request, response) => {
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(page);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();

const userDataDir = path.join(root, ".chrome-smoke-profile");
const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${userDataDir}`,
    "--virtual-time-budget=8000",
    "--dump-dom",
    `http://127.0.0.1:${port}/`,
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);

let stdout = "";
let stderr = "";
chrome.stdout.on("data", (chunk) => { stdout += chunk; });
chrome.stderr.on("data", (chunk) => { stderr += chunk; });

const exitCode = await new Promise((resolve) => chrome.on("close", resolve));
server.close();

const match = stdout.match(/<pre[^>]*id="smoke"[^>]*>([\s\S]*?)<\/pre>/);
let results = null;
if (match) {
  try { results = JSON.parse(match[1]); } catch { /* fall through to diagnostics */ }
}
if (!results) {
  const inline = stdout.match(/__smokeResults\s*=\s*(\[[\s\S]*?\]);/);
  if (inline) { try { results = JSON.parse(inline[1]); } catch { /* ignore */ } }
}

if (!results) {
  console.error("blob-smoke: could not read results from the browser.");
  console.error(`chrome exit=${exitCode}`);
  console.error(stdout.slice(0, 2000));
  console.error(stderr.slice(0, 2000));
  process.exit(1);
}

let failed = 0;
for (const result of results) {
  if (!result.ok) failed += 1;
  console.log(`${result.ok ? "PASS" : "FAIL"}  ${result.name}${result.detail ? ` — ${result.detail}` : ""}`);
}
console.log(`\nblob-smoke: ${results.length - failed}/${results.length} checks passed in Chromium.`);
process.exit(failed === 0 ? 0 : 1);
