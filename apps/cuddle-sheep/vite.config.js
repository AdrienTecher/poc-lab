import { defineConfig } from "vite";

// base: "./" is only the local-dev fallback (pnpm dev / a lone `vite build`).
// The build orchestrator (scripts/build.mjs) injects the real, absolute Pages
// path via `--base /poc-lab/<slug>/`, which overrides this.
export default defineConfig({
  base: "./",
  build: { outDir: "dist", emptyOutDir: true },
});
