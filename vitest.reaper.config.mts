import { defineConfig } from "vitest/config";
import { alias } from "./aliases.mts";

// Integration tests against a real, isolated REAPER (see docs/testing.md).
export default defineConfig({
  resolve: { alias },
  test: { include: ["test/**/*.itest.ts", "src/**/*.itest.ts"], environment: "node", testTimeout: 30000 },
});
