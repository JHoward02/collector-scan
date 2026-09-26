import { defineConfig } from "vite";

export default defineConfig({
  base: "/collector-scan/",
  build: {
    outDir: "dist-web",
    emptyOutDir: true,
    target: "es2022",
  },
});
