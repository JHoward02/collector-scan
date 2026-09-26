#!/usr/bin/env node
/**
 * Live integration check: loads the built bundle in Chromium and drives a real
 * search against the public provider APIs, with no network stubbing.
 *
 * This is a manual/diagnostic check (it needs outbound network), so it is not
 * part of `npm run check`. Usage: node tests/smoke/live-check.mjs "query"
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const bundleSource = await readFile(path.join(root, "dist", "extension.js"), "utf8");
const query = process.argv[2] ?? "1952 Topps Mickey Mantle";
const chromePath = process.env.CHROME_PATH || "/usr/bin/chromium";

const page = `<!doctype html>
<html><head><meta charset="utf-8"><title>live check</title></head>
<body><main id="host"></main><pre id="out"></pre><script type="module">
const source = ${JSON.stringify(bundleSource)};
const query = ${JSON.stringify(query)};
const log = [];
try {
  const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  const mod = await import(/* @vite-ignore */ url);
  URL.revokeObjectURL(url);

  const mounts = [];
  const host = {
    apiVersion: "1",
    extension: { name: "collector-scan", version: "0.1.0", resolvedRef: "live" },
    backend: { id: "live-backend", kind: "local", orgId: null },
    registerPage(id, mount) { mounts.push(mount); return () => {}; },
    navigate() {},
    agentServer: { async request() { return {}; } },
  };
  mod.activate(host);

  const container = document.createElement("div");
  document.getElementById("host").append(container);
  await mounts[0]({ container, path: "", navigate() {} });

  const input = container.querySelector("#cs-search-input");
  input.value = query;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  container.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

  // Wait for the loading state to clear, with a generous ceiling for live APIs.
  const started = Date.now();
  while (container.textContent.includes("Looking up matches") && Date.now() - started < 25000) {
    await new Promise((r) => setTimeout(r, 250));
  }

  const cards = [...container.querySelectorAll(".cs-card--tappable")];
  log.push("query: " + query);
  log.push("state: " + (container.querySelector(".cs-state--error") ? "ERROR" : "OK"));
  log.push("matches: " + cards.length);
  log.push("with image: " + cards.filter((c) => c.querySelector("img")).length);
  log.push("providers: " + [...new Set([...container.querySelectorAll(".cs-tag")].map((t) => t.textContent))]
    .filter((t) => t === "Open Library" || t === "Wikipedia").join(", "));
  log.push("hint: " + (container.querySelector(".cs-hint")?.textContent ?? ""));
  log.push("--- top 5 ---");
  for (const card of cards.slice(0, 5)) {
    const title = card.querySelector(".cs-card__title")?.textContent ?? "";
    const meta = card.querySelector(".cs-card__meta")?.textContent ?? "";
    const score = card.querySelector(".cs-tag--score")?.textContent ?? "";
    const img = card.querySelector("img")?.getAttribute("src") ?? "(no image)";
    log.push([score, title, "|", meta, "|", img.slice(0, 90)].join(" "));
  }
} catch (error) {
  log.push("FAILED: " + String((error && error.stack) || error));
}
document.getElementById("out").textContent = log.join("\\n");
<\/script></body></html>`;

const server = createServer((_request, response) => {
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(page);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();

const chrome = spawn(
  chromePath,
  [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    "--no-first-run", "--no-default-browser-check",
    `--user-data-dir=${path.join(root, ".chrome-live-profile")}`,
    "--virtual-time-budget=40000", "--dump-dom", `http://127.0.0.1:${port}/`,
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);

let stdout = "";
chrome.stdout.on("data", (chunk) => { stdout += chunk; });
const code = await new Promise((resolve) => chrome.on("close", resolve));
server.close();

const match = stdout.match(/<pre id="out">([\s\S]*?)<\/pre>/);
console.log(match ? decodeHtml(match[1]) : `no output (chrome exit=${code})`);
process.exit(match ? 0 : 1);

function decodeHtml(value) {
  return value
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
}
