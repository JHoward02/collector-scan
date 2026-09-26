#!/usr/bin/env node
/**
 * Visual preview harness. Serves the built bundle with a host double and
 * stubbed provider payloads so the three main views can be inspected at a
 * phone-sized viewport. Not part of `npm run check`.
 *
 * Usage: node tests/smoke/preview.mjs [port]
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const bundleSource = await readFile(path.join(root, "dist", "extension.js"), "utf8");
const port = Number(process.argv[2] ?? 13000);

const OL_DOCS = [
  { key: "/works/OL1W", title: "Watchmen", author_name: ["Alan Moore", "Dave Gibbons"], first_publish_year: 1986, publisher: ["DC Comics"], cover_i: 7774899, isbn: ["9780930289232"], number_of_pages_median: 416, subject: ["Graphic novels"], edition_count: 42 },
  { key: "/works/OL2W", title: "Absolute Watchmen", author_name: ["Alan Moore"], first_publish_year: 2005, publisher: ["DC Comics"], cover_i: 14613329, edition_count: 8 },
  { key: "/works/OL3W", title: "Watchmen Noir", author_name: ["Alan Moore"], first_publish_year: 2016, publisher: ["DC Comics"], cover_i: 9150700, edition_count: 3 },
  { key: "/works/OL4W", title: "Before Watchmen", author_name: ["Various"], first_publish_year: 2013, publisher: ["DC Comics"], edition_count: 5 },
];

// Mirrors the real API: `pilicense=any` is what makes the non-free cover art
// show up, so these rows carry thumbnails exactly as the live endpoint returns.
const WIKI_PAGES = [
  { pageid: 1, title: "Watchmen", extract: "Watchmen is a twelve-issue comic book limited series created by the British creative team of writer Alan Moore, artist Dave Gibbons, and colourist John Higgins.", thumbnail: { source: "https://upload.wikimedia.org/wikipedia/en/a/a2/Watchmen%2C_issue_1.jpg" }, fullurl: "https://en.wikipedia.org/wiki/Watchmen" },
  { pageid: 2, title: "List of Watchmen characters", extract: "This is a list of characters from the Watchmen comic book series.", thumbnail: { source: "https://upload.wikimedia.org/wikipedia/en/c/c1/Watchmencharacters.jpg" }, fullurl: "https://en.wikipedia.org/wiki/List_of_Watchmen_characters" },
  { pageid: 3, title: "Watchmen (2009 film)", extract: "Watchmen is a 2009 American superhero film directed by Zack Snyder.", thumbnail: { source: "https://upload.wikimedia.org/wikipedia/en/b/bc/Watchmen_film_poster.jpg" }, fullurl: "https://en.wikipedia.org/wiki/Watchmen_(film)" },
];

const page = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>collector-scan preview</title>
<style>html,body{margin:0;background:#0b0d12}</style></head>
<body>
<div id="host"></div>
<pre id="nav" style="position:fixed;bottom:0;left:0;right:0;margin:0;padding:6px 10px;background:#000;color:#0f0;font:11px monospace;z-index:9"></pre>
<script type="module">
const source = ${JSON.stringify(bundleSource)};
const OL = ${JSON.stringify(OL_DOCS)};
const WIKI = ${JSON.stringify(WIKI_PAGES)};

// Deterministic provider responses so screenshots are stable. Append ?live to
// the URL to skip the stub and hit the real public APIs instead.
if (!new URLSearchParams(location.search).has("live")) {
  window.fetch = async (input) => {
    const url = String(input);
    const body = url.includes("openlibrary.org") ? { docs: OL } : { query: { pages: WIKI } };
    return { ok: true, status: 200, json: async () => body };
  };
}

const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
const mod = await import(/* @vite-ignore */ url);
URL.revokeObjectURL(url);

const mounts = [];
const host = {
  apiVersion: "1",
  extension: { name: "collector-scan", version: "0.1.0", resolvedRef: "preview" },
  backend: { id: "preview", kind: "local", orgId: null },
  registerPage(id, mount) { mounts.push(mount); return () => {}; },
  navigate(to) { window.__go(to); },
  agentServer: { async request() { return {}; } },
};
mod.activate(host);

const container = document.getElementById("host");
const BASE = "/extensions/collector-scan/collection";
let disposer = null;
// The Canvas host hands the page a path relative to its own root, so strip the
// absolute prefix the extension passes back to navigate().
const relative = (to) => String(to ?? "").replace(BASE, "").replace(/^\\/+/, "");
window.__go = async (to) => {
  if (disposer) disposer();
  document.getElementById("nav").textContent = "route: " + (to || BASE);
  disposer = await mounts[0]({ container, path: relative(to), navigate: (t) => window.__go(t) });
};
await window.__go(BASE);

window.__search = async (q) => {
  const input = container.querySelector("#cs-search-input");
  input.value = q;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  container.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 400));
};
</script></body></html>`;

createServer((_q, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(page);
}).listen(port, "0.0.0.0", () => {
  console.log(`preview: http://127.0.0.1:${port}/`);
});
