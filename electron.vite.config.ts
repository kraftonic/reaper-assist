import { resolve } from "node:path";
import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
import { alias } from "./aliases.mts";

export default defineConfig({
  main: {
    resolve: { alias },
    // index = the app; mcp = the stdio tool server the Claude Code / Codex CLIs launch.
    build: { rollupOptions: { input: { index: resolve("src/main/index.ts"), mcp: resolve("src/ai/mcpServer.ts") } } },
  },
  preload: {
    resolve: { alias },
  },
  renderer: {
    resolve: { alias },
    plugins: [react()],
  },
});
