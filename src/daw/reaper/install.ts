import { copyFile, mkdir, readFile, rm, rmdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { defaultReaperResourcePath } from "./reaper";

const BEGIN = "-- >>> REAPER Assist bridge (added by REAPER Assist; remove this block to stop autostart)";
const END = "-- <<< REAPER Assist bridge";

/**
 * __startup.lua with exactly one bridge block at the end. Every earlier bridge block goes, whatever its
 * header said (older builds and `npm run reaper:install` wrote different ones), so the bridge is never
 * started twice; the user's own lines and other blocks stay. Blocks from before the rename ("Kraftonic
 * Assist bridge") go too.
 */
export function withBridgeBlock(existing: string): string {
  const rest = existing.replace(/^-- >>> (?:REAPER|Kraftonic) Assist bridge\b[^\n]*\n[\s\S]*?^-- <<< (?:REAPER|Kraftonic) Assist bridge[^\n]*\n?/gm, "");
  const block = `${BEGIN}\ndofile(reaper.GetResourcePath() .. "/Scripts/ReaperAssist/assist_bridge.lua")\n${END}\n`;
  const head = rest.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trimEnd();
  return `${head ? head + "\n\n" : ""}${block}`;
}

export function installedScriptPath(resource = defaultReaperResourcePath()): string {
  return join(resource, "Scripts", "ReaperAssist", "assist_bridge.lua");
}

export async function installedAt(): Promise<string | null> {
  try {
    await stat(installedScriptPath());
    return installedScriptPath();
  } catch {
    return null;
  }
}

/**
 * Copy the bridge script into REAPER's Scripts folder. Only files inside
 * <resource>/Scripts are touched; REAPER's own configuration is never edited.
 * Nothing is launched: the musician loads the script in REAPER themselves.
 */
export async function installBridge(sourceLua: string, opts: { autostart: boolean }): Promise<{ ok: boolean; message: string; scriptPath?: string }> {
  const resource = defaultReaperResourcePath();
  try {
    await stat(resource);
  } catch {
    return { ok: false, message: `REAPER's resource folder wasn't found at ${resource}. Start REAPER once, then try again.` };
  }
  const target = installedScriptPath(resource);
  await mkdir(join(resource, "Scripts", "ReaperAssist"), { recursive: true });
  await copyFile(sourceLua, target);
  await removeLegacyBridge(resource);

  if (opts.autostart) {
    const startup = join(resource, "Scripts", "__startup.lua");
    let existing = "";
    try {
      existing = await readFile(startup, "utf8");
    } catch {
      /* no startup file yet */
    }
    await writeFile(startup, withBridgeBlock(existing));
  }
  return {
    ok: true,
    scriptPath: target,
    message: opts.autostart
      ? "Installed. It starts with REAPER from now on. To start it now: Actions → Show action list → Load ReaScript… → choose the script → Run."
      : "Installed. In REAPER: Actions → Show action list → New action → Load ReaScript…, pick the script, then Run.",
  };
}

/**
 * The bridge as builds before the rename installed it (Scripts/KraftonicAssist/kraftonic_bridge.lua and its
 * request folder). Its __startup.lua block is replaced by withBridgeBlock; the folders go only once empty.
 */
export async function removeLegacyBridge(resource: string): Promise<void> {
  await rm(join(resource, "Scripts", "KraftonicAssist", "kraftonic_bridge.lua"), { force: true });
  await rmdir(join(resource, "Scripts", "KraftonicAssist")).catch(() => undefined);
  await rm(join(resource, "KraftonicAssist", "bridge"), { recursive: true, force: true });
  await rmdir(join(resource, "KraftonicAssist")).catch(() => undefined);
}
