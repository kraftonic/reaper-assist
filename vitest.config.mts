import { defineConfig } from "vitest/config";
import { alias } from "./aliases.mts";

export default defineConfig({
  resolve: { alias },
  // Unit tests: test/<area>/, plus each DAW profile's own tests in src/profiles/<id>/.
  test: { include: ["test/**/*.test.ts", "src/**/*.test.ts"], environment: "node" },
});
