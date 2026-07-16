import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" is only the local-dev fallback (pnpm dev / a lone `vite build`).
// The build orchestrator (scripts/build.mjs) injects the real, absolute Pages
// path via `--base /poc-lab/<slug>/`, which overrides this.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: { outDir: "dist", emptyOutDir: true },
});
