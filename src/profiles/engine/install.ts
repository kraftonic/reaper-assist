import { copyFile, mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { SCRIPT_DIR, mouseSlot, type Workflow } from "../index";
import { applyPrefs, layoutIni, setMenuSections, setMouseValues, startupLua, toolbarLines, withStartupBlock, type ExplorerSetup } from "./files";
import { installShortcuts } from "./theme";
import { removeAssistFiles, restoreIni, restoreMouseAndMenus, type ReaperOriginal } from "./restore";
import { parse, section, serialize, set } from "./workspace";

/**
 * Apply a "Coming from…" profile to REAPER's files. REAPER must be closed (it rewrites
 * reaper.ini and reaper-mouse.ini when it quits).
 *
 * Every apply first puts back what Assist recorded before its first change (src/profiles/engine/restore.ts),
 * then applies the profile on top, so switching profiles never leaves the previous one behind.
 * `o` must already hold the originals of everything the profile touches (ensureOriginal).
 */
export interface ProfileInstall {
  /** The profile's theme file (ColorThemes/…), or null to keep the user's theme. */
  theme: string | null;
  /** Folder with this profile's scripts (src/profiles/<id>/scripts). */
  scriptsDir: string;
  /** Toolbar icons by path under Data/toolbar_icons ("assist_x.png", "150/assist_x.png", …). */
  icons: Map<string, Uint8Array>;
  /** Media Explorer start folder and shortcuts, when the profile docks it. */
  explorer?: ExplorerSetup;
  now?: Date;
}

const readOr = (p: string) => readFile(p, "latin1").catch(() => null);
const stamp = (d: Date) => d.toISOString().slice(0, 19).replace(/[:T]/g, "-");

async function writeAtomic(path: string, text: string | Uint8Array): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path + ".tmp", text, typeof text === "string" ? "latin1" : undefined);
  await rename(path + ".tmp", path);
}

/** reaper.ini with the user's own values back, then the profile's preferences, layout and theme. */
export function profileIni(text: string, w: Workflow, o: ReaperOriginal, theme: string | null, explorer?: ExplorerSetup): string {
  let next = restoreIni(text, o, { keepTheme: theme !== null });
  next = applyPrefs(next, w.prefs ?? []);
  if (w.layout) next = layoutIni(next, w.layout, explorer);
  if (theme) {
    const doc = parse(next);
    set(section(doc, "REAPER"), "lastthemefn5", theme);
    next = serialize(doc);
  }
  return next;
}

/** reaper-mouse.ini with the profile's mouse modifiers (the file has had the originals put back already). */
export function profileMouse(text: string | null, w: Workflow): string | null {
  if (!w.mouse?.length) return text;
  return setMouseValues(text, Object.fromEntries(w.mouse.map((m) => [mouseSlot(m.ctx, m.mods), m.value])));
}

/** reaper-menu.ini with the profile's toolbars. */
export function profileMenus(text: string | null, w: Workflow): string | null {
  if (!w.toolbars?.length) return text;
  return setMenuSections(text, Object.fromEntries(w.toolbars.map((t) => [t.section, toolbarLines(t)])));
}

export async function installProfile(resource: string, w: Workflow, o: ReaperOriginal, opts: ProfileInstall): Promise<{ backups: string[] }> {
  const now = opts.now ?? new Date();
  const backups: string[] = [];
  const backup = async (path: string) => {
    const to = `${path}.before-assist-${stamp(now)}`;
    await copyFile(path, to).then(() => backups.push(to), () => undefined);
  };

  // reaper.ini: originals back, then the profile.
  const iniPath = join(resource, "reaper.ini");
  const ini = await readOr(iniPath);
  if (ini !== null) {
    const next = profileIni(ini, w, o, opts.theme, opts.explorer);
    if (next !== ini) {
      await backup(iniPath);
      await writeAtomic(iniPath, next);
    }
  }

  // Shortcuts, scripts and custom actions (reaper-kb.ini).
  const kb = await installShortcuts(resource, w, now, o.kb);
  if (kb.backup) backups.push(kb.backup);

  // Mouse modifiers and toolbars: originals back, then the profile's.
  await restoreMouseAndMenus(resource, o);
  for (const [file, apply] of [["reaper-mouse.ini", profileMouse], ["reaper-menu.ini", profileMenus]] as const) {
    const path = join(resource, file);
    const text = await readOr(path);
    const next = apply(text, w);
    if (next !== null && next !== text) {
      if (text !== null) await backup(path);
      await writeAtomic(path, next);
    }
  }

  // Scripts and toolbar icons: ours only, replaced as a whole.
  await removeAssistFiles(resource);
  if (w.scripts?.length) {
    const dest = join(resource, "Scripts", ...SCRIPT_DIR.split("/"));
    await mkdir(dest, { recursive: true });
    // The whole folder is copied: scripts may load helpers that aren't actions themselves (e.g. protools_lib.lua).
    for (const n of await readdir(opts.scriptsDir)) if (n.endsWith(".lua")) await copyFile(join(opts.scriptsDir, n), join(dest, n));
  }
  // Start-up actions: Scripts/__startup.lua runs Profile/startup.lua (REAPER's only start-up hook).
  const startupPath = join(resource, "Scripts", "__startup.lua");
  const startup = await readOr(startupPath);
  if (w.startup?.length) {
    await writeAtomic(join(resource, "Scripts", ...SCRIPT_DIR.split("/"), "startup.lua"), startupLua(w.daw, w.startup));
    const next = withStartupBlock(startup);
    if (next !== startup) await writeAtomic(startupPath, next);
  }
  for (const [rel, data] of opts.icons) {
    if (!/^((150|200)\/)?assist_[\w-]+\.png$/.test(rel)) throw new Error(`Bad toolbar icon name ${rel}`);
    await writeAtomic(join(resource, "Data", "toolbar_icons", ...rel.split("/")), data);
  }
  return { backups };
}
