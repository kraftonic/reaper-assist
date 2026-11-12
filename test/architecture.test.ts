import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * The panel (src/renderer) runs in a sandboxed browser window: it can't load Node or Electron
 * modules. So the modules it shares with the main process must stay free of them. These checks
 * keep that boundary (described in CONTRIBUTING.md) from slipping.
 */

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) && !/\.test\.ts$/.test(n) ? [p] : [];
  });
const imports = (file: string) => [...readFileSync(file, "utf8").matchAll(/(?:from|import)\s+["']([^"']+)["']/g)].map((m) => m[1]!);

/** Modules the panel may import from outside src/renderer. */
const RENDERER_SAFE = [
  /^@shared\/(types|images)$/,
  /^@profiles$/,
  /^@profiles\/(types|keys|skins)$/,
  /^@profiles\/\w+\/profile$/,
  /^@studio\/(genres|catalog)$/,
];

const SAFE_FILES = [
  "src/shared/types.ts",
  "src/shared/images.ts",
  "src/profiles/index.ts",
  "src/profiles/types.ts",
  "src/profiles/keys.ts",
  "src/profiles/skins.ts",
  "src/studio/genres.ts",
  "src/studio/catalog.ts",
  ...readdirSync("src/profiles")
    .filter((d) => statSync(join("src/profiles", d)).isDirectory() && !["kit", "engine"].includes(d))
    .map((d) => `src/profiles/${d}/profile.ts`),
];

describe("process boundaries", () => {
  it("the panel only imports renderer-safe modules from other areas", () => {
    const bad: string[] = [];
    for (const f of walk("src/renderer")) {
      for (const spec of imports(f)) {
        if (spec.startsWith(".") || !spec.startsWith("@") || spec.startsWith("@vitejs")) continue;
        if (!RENDERER_SAFE.some((r) => r.test(spec))) bad.push(`${f} imports ${spec}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("renderer-safe modules don't pull in Node, Electron, the theme kit or the installer", () => {
    const bad: string[] = [];
    for (const f of SAFE_FILES) {
      for (const spec of imports(f)) {
        if (/^(node:|electron$)|(^|\/)(kit|engine)(\/|$)|\/kit$/.test(spec)) bad.push(`${f} imports ${spec}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
