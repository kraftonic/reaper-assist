import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

/**
 * Import aliases, one per area of the app (see CONTRIBUTING.md). Code inside an area imports its
 * neighbours with relative paths; code in another area uses the alias. tsconfig.json mirrors these.
 */
export const alias = {
  "@ai": resolve(root, "src/ai"),
  "@daw": resolve(root, "src/daw"),
  "@profiles": resolve(root, "src/profiles"),
  "@shared": resolve(root, "src/shared"),
  "@studio": resolve(root, "src/studio"),
};
