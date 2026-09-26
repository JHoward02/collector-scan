import { resolve } from "node:path";
import { defineConfig } from "vite";

// Library build: exactly one self-contained browser ESM entrypoint at dist/extension.js.
export default defineConfig({
  build: {
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
    emptyOutDir: true,
    lib: {
      entry: resolve(import.meta.dirname, "src/extension.ts"),
      formats: ["es"],
      fileName: () => "extension.js",
    },
    outDir: "dist",
    rollupOptions: { output: { inlineDynamicImports: true } },
    sourcemap: false,
    target: "es2022",
  },
});
