import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";
import { skinFromWorkflow } from "@profiles/skins";
import { findWorkflow, type Workflow } from "@profiles";
import { tb } from "@profiles/kit/icons";
import { KITS } from "@profiles/kit";
import { installProfile } from "@profiles/engine/install";
import { writeTheme } from "@profiles/engine/theme";
import { ensureOriginal, restoreFiles, type ReaperOriginal } from "@profiles/engine/restore";
import { kitToolbarIcons } from "@profiles/kit/toolbarIcons";

/**
 * Dev harness: apply a profile (or Restore) to a THROWAWAY REAPER resource folder, exactly the
 * way Assist does with REAPER closed. Used from a reaper-run.sh prep.sh hook:
 *
 *   KA_PROFILE=fl KA_RES=<res> npx vitest run -c vitest.reaper.config.mts test/profilePrep.itest.ts
 *   KA_RESTORE=1  KA_RES=<res> npx vitest run -c vitest.reaper.config.mts test/profilePrep.itest.ts
 *
 * The restore record is kept in <res>/assist-record.json. Never point KA_RES at a real REAPER folder.
 */
const res = process.env.KA_RES;
const RECORD = (r: string) => join(r, "assist-record.json");

function safe(r: string): string {
  const real = resolve(r);
  if (real.startsWith(join(homedir(), "Library", "Application Support", "REAPER")) || real.startsWith(join(homedir(), ".config", "REAPER")) || !/\/res-[\w-]+$|ka-[\w-]+$/.test(real)) {
    throw new Error(`Refusing ${real}: only throwaway folders (…/res-XXXX or ka-…)`);
  }
  return real;
}

(res && process.env.KA_PROFILE ? it : it.skip)("installs a profile into a throwaway REAPER folder", async () => {
  const r = safe(res!);
  const base = findWorkflow(process.env.KA_PROFILE)!;
  expect(base).toBeTruthy();
  // KA_OVERLAY: a JSON file whose fields replace the profile's (for probing the install itself).
  const w = process.env.KA_OVERLAY ? { ...base, ...(JSON.parse(readFileSync(process.env.KA_OVERLAY, "utf8")) as Partial<Workflow>) } : base;
  const o = await ensureOriginal(mkdtempSync(join(tmpdir(), "ka-rec-")), r, false);
  writeFileSync(RECORD(r), JSON.stringify(o, null, 1));
  const theme = await writeTheme(r, skinFromWorkflow(w, true));
  const icons = kitToolbarIcons(w, KITS[w.id], { assist_probe: tb.grid! });
  const scriptsDir = resolve(process.env.KA_SCRIPTS ?? `src/profiles/${w.id}/scripts`);
  await installProfile(r, w, o, { theme, scriptsDir, icons, explorer: { startDir: homedir(), shortcuts: [], defaults: [] } });
});

(res && process.env.KA_RESTORE ? it : it.skip)("restores a throwaway REAPER folder", async () => {
  const r = safe(res!);
  const o = JSON.parse(readFileSync(RECORD(r), "utf8")) as ReaperOriginal;
  await restoreFiles(r, o);
});
