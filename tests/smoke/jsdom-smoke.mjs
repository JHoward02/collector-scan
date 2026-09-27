#!/usr/bin/env node
// Exercise the built, self-contained Canvas entrypoint when Chromium is absent.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><main id=host></main>", { url: "https://shelfie.example/" });
for (const key of ["window", "document", "MutationObserver", "Node", "Element", "HTMLElement", "HTMLInputElement", "HTMLSelectElement", "localStorage"]) {
  Object.defineProperty(globalThis, key, { configurable: true, value: key === "window" ? dom.window : dom.window[key] });
}
const source = await readFile(resolve(import.meta.dirname, "../../dist/extension.js"), "utf8");
const mod = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const assert = (ok, message) => { if (!ok) throw new Error(`FAIL ${message}`); console.log(`PASS ${message}`); };
assert(typeof mod.activate === "function", "entrypoint exports activate");
let mount, registered = 0;
const dispose = mod.activate({
  apiVersion: "1", extension: { name: "collector-scan", version: "0.3.2", resolvedRef: null },
  backend: { id: "smoke", kind: "local", orgId: null },
  registerPage(id, callback) { assert(id === "collection", "registers collection page"); mount = callback; registered++; return () => { registered--; }; },
  navigate() {}, agentServer: { async request() { return {}; } },
});
const container = document.createElement("div");
document.getElementById("host").append(container);
let unmount;
try { unmount = await mount({ container, path: "", navigate() {} }); }
catch (error) { throw new Error(`Built bundle mount failed: ${error.message}`); }
assert(!!container.querySelector(".cs-app #cs-search-input"), "built bundle renders search UI");
assert(!!document.querySelector('style[data-cs="collector-scan-styles"]'), "injects scoped styles");
unmount();
assert(container.childElementCount === 0, "unmount clears DOM");
dispose();
assert(registered === 0, "deactivate unregisters page");
assert(!document.querySelector('style[data-cs="collector-scan-styles"]'), "deactivate removes styles");
console.log("Built artifact smoke passed in jsdom; Chromium unavailable.");
