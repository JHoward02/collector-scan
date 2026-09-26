#!/usr/bin/env node
/**
 * Copy the verified build output to the manifest entrypoint location.
 *
 * The Canvas host serves `canvas-extension.json`'s `entrypoint` from the app
 * package root, while Vite writes to `dist/`. This refuses to publish anything
 * that has not already passed the static validator, so an unverified artifact
 * can never reach the installable root.
 */
import { copyFile, readFile, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(path.join(root, "canvas-extension.json"), "utf8"));
const source = path.join(root, "dist", manifest.entrypoint);
const target = path.join(root, manifest.entrypoint);

try {
  await stat(source);
} catch {
  console.error(`sync-entrypoint: missing build output ${source}. Run \`npm run build\` first.`);
  process.exit(1);
}

const validation = spawnSync(
  process.execPath,
  [path.join(root, "scripts", "validate-extension.mjs"), root, "--dist"],
  { stdio: "inherit" },
);
if (validation.status !== 0) {
  console.error("sync-entrypoint: refusing to publish an artifact that failed validation.");
  process.exit(validation.status ?? 1);
}

await copyFile(source, target);
const { size } = await stat(target);
console.log(`sync-entrypoint: wrote ${path.relative(root, target)} (${size} bytes).`);
