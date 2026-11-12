import { existsSync } from "node:fs";
import { copyFile, readFile, readdir, rename, rm, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { SCRIPT_DIR, allProfileKeymapLines, isAssistKbLine, profileTouches } from "../index";
import { DEFAULT_SHORTCUTS, get, parse, serialize, set, unset, type IniDoc, type TransportWhere } from "./workspace";
import { bitsBase, menuSections, mouseValues, setMenuSections, setMouseValues, withoutStartupBlock } from "./files";

/**
 * "Restore REAPER": put back everything Assist changed.
 *
 * Before Assist first changes REAPER, it records the original value of every
 * setting it may touch: the theme, the window-layout keys in reaper.ini, and
 * reaper-kb.ini. Restore writes those values back and takes Assist's shortcut
 * lines out again. Everything else the user changed since stays as it is.
 *
 * Users who applied a profile with an older Assist have no record. They get
 * REAPER's defaults for those settings instead, plus their oldest shortcut backup.
 */

export interface ReaperOriginal {
  version: 1;
  /** The REAPER resource folder this was recorded for. */
  resource: string;
  takenAt: string;
  /** "section\tkey" → original value, or null when REAPER didn't have the key (it then uses its default). */
  ini: Record<string, string | null>;
  /** reaper-kb.ini as it was (null: there was no file). */
  kb: string | null;
  /** Media Explorer shortcut folders Assist added. */
  folders: string[];
  /** Mouse-modifier slots ("MM_CTX_X\tN") → value in reaper-mouse.ini, or null (REAPER's default). */
  mouse?: Record<string, string | null>;
  /** reaper-menu.ini sections (toolbars) → their lines, or null (REAPER's default toolbar). */
  menus?: Record<string, string[] | null>;
  /** Built from REAPER's defaults, because Assist had changed REAPER before it kept this record. */
  fallback: boolean;
  /** Set once everything was put back: the next change records REAPER afresh. */
  restoredAt?: string;
}

const RECORD = "reaper-original.json";

/**
 * Every reaper.ini key Assist may change (src/profiles/engine/workspace.ts, the bridge's setupWorkspace,
 * setThemeForNextStart), plus the sizes REAPER itself changes while a side docker is showing:
 * the bottom docker's height (dockheight) and the track panel's width (leftpanewid).
 */
const KEYS: [string, string][] = [
  ...["lastthemefn5", "mixerflag", "transport_vis", "transport_dock", "transport_dock_pos", "fxadd_vis", "fxadd_dock", "mixwnd_vis", "mixwnd_dock", "mixwnd_x", "mixwnd_y", "mixwnd_w", "mixwnd_h", "dockheight", "dockheight_l", "dockheight_r", "dockheight_t", "leftpanewid"].map((k) => ["reaper", k] as [string, string]),
  ...Array.from({ length: 16 }, (_, i) => [["reaper", `dockermode${i}`], ["reaper", `dockersel${i}`]] as [string, string][]).flat(),
  ["REAPERdockpref", "explorer"],
  ["REAPERdockpref", "fxbrowser"],
  ["reaper_sexplorer", "docked"],
  ["reaper_sexplorer", "visible"],
  ["reaper_sexplorer", "lastdir"],
  ["midiedit", "dock"],
  ["midiedit", "colorwhat"],
];
const LIST_KEY = /^(NbShortcuts|Shortcut\d+|ShortcutT\d+)$/;
const id = (s: string, k: string) => `${s}\t${k}`;
const find = (doc: IniDoc, name: string) => doc.sections.find((x) => x.name === name.toLowerCase());

function readList(sec: ReturnType<typeof find>): { path: string; title: string }[] {
  if (!sec) return [];
  const n = Number(get(sec, "NbShortcuts"));
  if (!Number.isInteger(n) || n <= 0) return [];
  return Array.from({ length: Math.min(n, 500) }, (_, i) => ({ path: get(sec, `Shortcut${i}`) ?? "", title: get(sec, `ShortcutT${i}`) ?? "" })).filter((f) => f.path);
}

/** Every reaper.ini key the record keeps: the layout keys plus the profiles' preferences. */
const allKeys = (): [string, string][] => [...KEYS, ...profileTouches().ini.map((k) => ["reaper", k] as [string, string])];

/** Record REAPER's settings as they are now. */
export function captureOriginal(iniText: string, kbText: string | null, resource: string, now = new Date(), mouseText: string | null = null, menuText: string | null = null): ReaperOriginal {
  const doc = parse(iniText);
  const ini: Record<string, string | null> = {};
  for (const [s, k] of allKeys()) {
    const sec = find(doc, s);
    ini[id(s, k)] = (sec && get(sec, k)) ?? null;
  }
  const t = profileTouches();
  const mx = find(doc, "reaper_sexplorer");
  ini[id("reaper_sexplorer", "NbShortcuts")] = (mx && get(mx, "NbShortcuts")) ?? null;
  readList(mx).forEach((f, i) => {
    ini[id("reaper_sexplorer", `Shortcut${i}`)] = f.path;
    ini[id("reaper_sexplorer", `ShortcutT${i}`)] = f.title;
  });
  return { version: 1, resource, takenAt: now.toISOString(), ini, kb: kbText, folders: [], fallback: false, mouse: mouseValues(mouseText, t.mouse), menus: menuSections(menuText, t.menus) };
}

/**
 * Add what a newer Assist touches to an existing record: keys, mouse slots and toolbars the
 * record doesn't have yet. Older versions never changed them, so their current values are the
 * originals. True when something was added.
 */
export function extendOriginal(o: ReaperOriginal, iniText: string, mouseText: string | null, menuText: string | null): boolean {
  const fresh = captureOriginal(iniText, null, o.resource, new Date(), mouseText, menuText);
  let added = false;
  for (const [k, v] of Object.entries(fresh.ini)) {
    if (k in o.ini || /^reaper_sexplorer\t(NbShortcuts|ShortcutT?\d+)$/.test(k)) continue;
    o.ini[k] = v;
    added = true;
  }
  for (const part of ["mouse", "menus"] as const) {
    const have = (o[part] ??= {}) as Record<string, unknown>;
    for (const [k, v] of Object.entries(fresh[part] ?? {})) {
      if (k in have) continue;
      have[k] = v;
      added = true;
    }
  }
  return added;
}

/**
 * No record, but Assist changed REAPER before: REAPER's own defaults (what a fresh install has,
 * checked in REAPER 7.82) for everything Assist's profiles touched: theme, transport, track-panel
 * side and width, the browser's dockers and sizes, the Media Explorer's docking and the folders
 * Assist added (`assistFolders`), and MIDI editor docking. The mixer stays as it is.
 */
export function fallbackOriginal(iniText: string, kbText: string | null, kbBackup: string | null, defaultTheme: string | null, resource: string, now = new Date(), assistFolders: string[] = []): ReaperOriginal {
  const o = captureOriginal(iniText, kbText, resource, now);
  // The dockers the browser sits in go back to unused.
  const pref = find(parse(iniText), "REAPERdockpref");
  for (const k of ["explorer", "fxbrowser"]) {
    const n = Number(pref && get(pref, k)?.trim().split(/\s+/)[1]);
    if (Number.isInteger(n) && n > 0 && n < 16) Object.assign(o.ini, { [id("reaper", `dockermode${n}`)]: null, [id("reaper", `dockersel${n}`)]: null });
  }
  for (const k of Object.keys(o.ini)) if (/^reaper_sexplorer\tShortcutT?\d+$/.test(k)) delete o.ini[k];
  Object.assign(o.ini, {
    [id("reaper", "lastthemefn5")]: defaultTheme,
    [id("reaper", "mixerflag")]: null,
    [id("reaper", "transport_vis")]: null,
    [id("reaper", "transport_dock")]: null,
    [id("reaper", "transport_dock_pos")]: null,
    [id("reaper", "fxadd_vis")]: "0",
    [id("reaper", "dockheight")]: null,
    [id("reaper", "dockheight_l")]: null,
    [id("reaper", "dockheight_r")]: null,
    [id("reaper", "leftpanewid")]: null,
    [id("REAPERdockpref", "explorer")]: null,
    [id("REAPERdockpref", "fxbrowser")]: null,
    [id("reaper_sexplorer", "docked")]: null,
    [id("reaper_sexplorer", "visible")]: "0",
    [id("reaper_sexplorer", "NbShortcuts")]: null,
    [id("midiedit", "dock")]: null,
  });
  o.folders = assistFolders;
  o.kb = kbBackup ?? (kbText === null ? null : restoreKb(kbText, null) ?? "");
  o.fallback = true;
  return o;
}

/**
 * "Back to REAPER's defaults": a record that puts everything Assist may touch back to what a fresh REAPER
 * uses (no key in reaper.ini, REAPER's default mouse behaviour and toolbars, the Default 7 theme), instead of
 * how it was before Assist. The user's own shortcuts (o.kb) still come back.
 */
export function defaultsOriginal(o: ReaperOriginal, defaultTheme: string | null): ReaperOriginal {
  const ini: Record<string, string | null> = {};
  for (const k of [...Object.keys(o.ini), ...allKeys().map(([s, key]) => id(s, key))]) if (!/^reaper_sexplorer\tShortcutT?\d+$/.test(k)) ini[k] = null;
  Object.assign(ini, {
    [id("reaper", "lastthemefn5")]: defaultTheme,
    [id("reaper", "fxadd_vis")]: "0",
    [id("reaper_sexplorer", "visible")]: "0",
  });
  const nulls = (r?: Record<string, unknown>) => r && Object.fromEntries(Object.keys(r).map((k) => [k, null]));
  return { ...o, ini, mouse: nulls(o.mouse) as ReaperOriginal["mouse"], menus: nulls(o.menus) as ReaperOriginal["menus"] };
}

/** Put the recorded reaper.ini values back. Everything else in the file is kept. */
export function restoreIni(text: string, o: ReaperOriginal, opts: { keepTheme?: boolean; home?: string } = {}): string {
  const doc = parse(text);
  // dockermodeN / dockerselN: only the docker(s) Assist's browser sits in; other dockers are the user's.
  const pref = find(doc, "REAPERdockpref");
  const dockOf = (k: string) => Number(pref && get(pref, k)?.trim().split(/\s+/)[1]);
  const ours = new Set([dockOf("explorer"), dockOf("fxbrowser")].filter((n) => Number.isInteger(n) && n > 0));
  const sectionFor = (name: string) => {
    let s = find(doc, name);
    if (!s) {
      s = { header: `[${name}]`, name: name.toLowerCase(), lines: [] };
      doc.sections.push(s);
    }
    return s;
  };
  const bits = profileTouches().bits;
  for (const [key, value] of Object.entries(o.ini)) {
    const [s, k] = key.split("\t") as [string, string];
    if (s === "reaper_sexplorer" && LIST_KEY.test(k)) continue;
    if (opts.keepTheme && k === "lastthemefn5") continue;
    const m = /^docker(?:mode|sel)(\d+)$/.exec(k);
    if (m && !ours.has(Number(m[1]))) continue;
    const mask = s === "reaper" ? bits[k] : undefined;
    if (mask !== undefined) {
      // Only some bits are Assist's (e.g. mixerflag 32: track panel on the right); the user's others stay.
      const sec = find(doc, s);
      const cur = bitsBase(sec ? get(sec, k) : undefined, k);
      const v = (cur & ~mask) | (bitsBase(value ?? undefined, k) & mask);
      // A key REAPER didn't have goes away again once it's back to REAPER's default.
      if (value === null && v === bitsBase(undefined, k)) {
        if (sec && get(sec, k) !== undefined) unset(sec, k);
        continue;
      }
      if (v !== cur) set(sectionFor(s), k, String(v));
      continue;
    }
    if (value === null) {
      const sec = find(doc, s);
      if (sec) unset(sec, k);
    } else set(sectionFor(s), k, value);
  }

  // Media Explorer shortcuts: take out the folders Assist added; keep the user's own.
  const mx = find(doc, "reaper_sexplorer");
  if (mx && o.folders.length) {
    const norm = (p: string) => p.replace(/[/\\]+$/, "") || "/";
    const origList = Object.entries(o.ini).filter(([k]) => /^reaper_sexplorer\tShortcut\d+$/.test(k)).map(([, v]) => norm(v ?? ""));
    const original = new Set(origList);
    const added = new Set(o.folders.map(norm));
    const now = readList(mx);
    let keep = now.filter((f) => original.has(norm(f.path)) || !added.has(norm(f.path)));
    if (keep.length !== now.length) {
      // A list REAPER never saved means REAPER shows its defaults: go back to that if only those are left.
      const defaults = new Set(DEFAULT_SHORTCUTS(opts.home).map((d) => norm(d.path)));
      if (o.ini[id("reaper_sexplorer", "NbShortcuts")] === null && keep.every((f) => defaults.has(norm(f.path)))) keep = [];
      mx.lines = mx.lines.filter((l) => !l.key || !LIST_KEY.test(l.key));
      if (keep.length) {
        set(mx, "NbShortcuts", String(keep.length));
        keep.forEach((f, i) => {
          set(mx, `Shortcut${i}`, f.path);
          set(mx, `ShortcutT${i}`, f.title);
        });
      }
    }
  }
  // Sections Assist added that are now empty go too.
  const touched = new Set(Object.keys(o.ini).map((k) => k.split("\t")[0]!.toLowerCase()));
  doc.sections = doc.sections.filter((x) => x.name === "reaper" || !touched.has(x.name) || x.lines.some((l) => l.key));
  return serialize(doc);
}

const slot = (l: string) => {
  const m = /^KEY (\d+) (\d+) \S+ (\d+)/.exec(l.trim());
  return m ? `${m[1]} ${m[2]} ${m[3]}` : null;
};

/**
 * reaper-kb.ini without Assist's shortcut lines, with the user's original line put back
 * wherever one of ours had replaced it. Lines the user changed since are kept.
 * Returns null when there was no file before and nothing is left.
 */
export function restoreKb(current: string | null, originalKb: string | null, ours: string[] = allProfileKeymapLines(), hadFile = originalKb !== null): string | null {
  const mine = new Set(ours.map((l) => l.trim()));
  const lines = (current ?? "").split(/\r?\n/).filter((l) => l.trim());
  const kept = lines.filter((l) => !mine.has(l.trim()) && !isAssistKbLine(l));
  const freed = new Set(lines.filter((l) => mine.has(l.trim())).map(slot));
  const taken = new Set(kept.map(slot));
  const back = (originalKb ?? "").split(/\r?\n/).filter((l) => {
    const s = slot(l);
    return s !== null && freed.has(s) && !taken.has(s);
  });
  const out = [...kept, ...back];
  if (!out.length && !hadFile) return null;
  return out.join("\r\n") + (out.length ? "\r\n" : "");
}

/** The states REAPER's windows had, for the live restore (bridge restoreLayout). */
export function layoutTargets(o: ReaperOriginal): { transport?: TransportWhere | "hidden"; tcpRight: boolean; explorerOpen: boolean; fxBrowserOpen: boolean; mixerVisible: boolean; mixerDocked: boolean; midiDocked: boolean } {
  const v = (s: string, k: string) => o.ini[id(s, k)] ?? null;
  const where = (["below", "above", "bottom", "top"] as const)[Number(v("reaper", "transport_dock_pos") ?? 0)] ?? "below";
  return {
    // Transport in a docker or floating (transport_dock=0): left where it is.
    transport: v("reaper", "transport_vis") === "0" ? "hidden" : v("reaper", "transport_dock") === "0" ? undefined : where,
    tcpRight: ((Number(v("reaper", "mixerflag")) || 0) & 32) !== 0,
    explorerOpen: v("reaper_sexplorer", "visible") === "1",
    fxBrowserOpen: v("reaper", "fxadd_vis") === "1",
    mixerVisible: v("reaper", "mixwnd_vis") !== "0",
    mixerDocked: v("reaper", "mixwnd_dock") !== "0",
    midiDocked: v("midiedit", "dock") === "1",
  };
}

/** The theme REAPER had (null: REAPER's default theme). */
export function originalTheme(o: ReaperOriginal): string | null {
  return o.ini[id("reaper", "lastthemefn5")] ?? null;
}

/* ------------------------------------------------------------------ files */

export async function loadOriginal(dir: string, resource: string): Promise<ReaperOriginal | null> {
  try {
    const o = JSON.parse(await readFile(join(dir, RECORD), "utf8")) as ReaperOriginal;
    return o.version === 1 && o.resource === resource ? o : null;
  } catch {
    return null;
  }
}

async function save(dir: string, o: ReaperOriginal): Promise<void> {
  await writeFile(join(dir, RECORD + ".tmp"), JSON.stringify(o, null, 1));
  await rename(join(dir, RECORD + ".tmp"), join(dir, RECORD));
}

/** Everything was put back: REAPER is as it was, so the next change records it afresh. */
export async function markRestored(dir: string, o: ReaperOriginal, now = new Date()): Promise<void> {
  await save(dir, { ...o, restoredAt: now.toISOString() });
}

const readOr = (p: string) => readFile(p, "latin1").catch(() => null);

/** The oldest reaper-kb.ini backup Assist made (the one from before its first change). */
async function oldestKbBackup(resource: string): Promise<string | null> {
  const names = (await readdir(resource).catch(() => [] as string[])).filter((n) => /^reaper-kb\.ini\.before-(assist|kraftonic)-\d{4}-/.test(n)).sort();
  return names.length ? readOr(join(resource, names[0]!)) : null;
}

/**
 * The record of REAPER as it was before Assist's first change, made now if there isn't one.
 * `changedBefore`: Assist's own settings say a profile was applied already.
 */
export async function ensureOriginal(dir: string, resource: string, changedBefore: boolean, assistFolders: string[] = []): Promise<ReaperOriginal> {
  const have = await loadOriginal(dir, resource);
  const ini = (await readOr(join(resource, "reaper.ini"))) ?? "";
  const mouse = await readOr(join(resource, "reaper-mouse.ini"));
  const menu = await readOr(join(resource, "reaper-menu.ini"));
  if (have && !have.restoredAt) {
    if (extendOriginal(have, ini, mouse, menu)) await save(dir, have);
    return have;
  }
  const kb = await readOr(join(resource, "reaper-kb.ini"));
  const kbBackup = await oldestKbBackup(resource);
  const profileLines = new Set(allProfileKeymapLines());
  // After a Restore, REAPER is known to be as it was: record it as it is now.
  const touched = !have && (changedBefore || kbBackup !== null || /^lastthemefn5=.*(Assist|Kraftonic) - /m.test(ini) || (kb ?? "").split(/\r?\n/).some((l) => profileLines.has(l.trim())));
  const theme = join(resource, "ColorThemes", "Default_7.0.ReaperThemeZip");
  const o = touched ? fallbackOriginal(ini, kb, kbBackup, existsSync(theme) ? theme : null, resource, new Date(), assistFolders) : captureOriginal(ini, kb, resource);
  const t = profileTouches();
  o.mouse = mouseValues(mouse, t.mouse);
  o.menus = menuSections(menu, t.menus);
  await save(dir, o);
  return o;
}

/** Remember Media Explorer folders Assist added, so Restore can take them out again. */
export async function noteFolders(dir: string, o: ReaperOriginal, paths: string[]): Promise<void> {
  const next = [...new Set([...o.folders, ...paths])];
  if (next.length === o.folders.length) return;
  o.folders = next;
  await save(dir, o);
}

async function writeAtomic(path: string, text: string): Promise<void> {
  await writeFile(path + ".tmp", text, "latin1");
  await rename(path + ".tmp", path);
}

/** Write the original reaper.ini values and shortcuts back. REAPER must be closed. */
export async function restoreFiles(resource: string, o: ReaperOriginal): Promise<void> {
  const iniPath = join(resource, "reaper.ini");
  const ini = await readOr(iniPath);
  if (ini !== null) {
    const next = restoreIni(ini, o);
    if (next !== ini) {
      await copyFile(iniPath, `${iniPath}.before-assist-restore`);
      await writeAtomic(iniPath, next);
    }
  }
  await restoreShortcutFile(resource, o);
  await restoreMouseAndMenus(resource, o);
  await removeAssistFiles(resource);
  await removeAssistThemes(resource, originalTheme(o));
}

/**
 * The themes Assist wrote (ColorThemes/Assist - ….ReaperThemeZip, "Kraftonic - …" before the rename), so REAPER's theme list is as it was.
 * Restore only (installing a profile writes its theme first); `keep` is the theme REAPER goes back to.
 */
export async function removeAssistThemes(resource: string, keep: string | null): Promise<void> {
  const dir = join(resource, "ColorThemes");
  for (const n of await readdir(dir).catch(() => [] as string[])) {
    if (!/^(Assist|Kraftonic) - .+\.ReaperThemeZip$/.test(n)) continue;
    if (keep && resolve(keep) === resolve(dir, n)) continue;
    await unlink(join(dir, n)).catch(() => undefined);
  }
}

/** reaper-mouse.ini and reaper-menu.ini: the recorded mouse slots and toolbars go back. REAPER must be closed. */
export async function restoreMouseAndMenus(resource: string, o: ReaperOriginal): Promise<void> {
  const mousePath = join(resource, "reaper-mouse.ini");
  const mouse = await readOr(mousePath);
  if (mouse !== null && o.mouse && Object.keys(o.mouse).length) {
    const next = setMouseValues(mouse, o.mouse);
    if (next !== mouse) await writeAtomic(mousePath, next);
  }
  const menuPath = join(resource, "reaper-menu.ini");
  const menu = await readOr(menuPath);
  if (menu !== null && o.menus && Object.keys(o.menus).length) {
    const next = setMenuSections(menu, o.menus);
    if (next !== menu) await writeAtomic(menuPath, next);
  }
}

/** Assist's own files in REAPER's folder: the profile scripts and the toolbar icons (assist_*.png; kraftonic_*.png before the rename). */
export async function removeAssistFiles(resource: string): Promise<void> {
  await rm(join(resource, "Scripts", ...SCRIPT_DIR.split("/")), { recursive: true, force: true });
  await rm(join(resource, "Scripts", "KraftonicAssist", "Profile"), { recursive: true, force: true });
  // The start-up block that ran the profile's start-up script (the bridge's own block stays).
  const startupPath = join(resource, "Scripts", "__startup.lua");
  const startup = await readOr(startupPath);
  if (startup !== null) {
    const next = withoutStartupBlock(startup);
    if (next !== startup) {
      if (next.trim()) await writeAtomic(startupPath, next);
      else await unlink(startupPath).catch(() => undefined);
    }
  }
  for (const sub of ["", "150", "200"]) {
    const dir = join(resource, "Data", "toolbar_icons", sub);
    for (const n of await readdir(dir).catch(() => [] as string[])) if (/^(assist|kraftonic)_[\w-]+\.png$/.test(n)) await unlink(join(dir, n)).catch(() => undefined);
  }
}

/** reaper-kb.ini only (safe while REAPER runs: it keeps the file on quit unless shortcuts were edited in that session). */
export async function restoreShortcutFile(resource: string, o: ReaperOriginal): Promise<void> {
  const kbPath = join(resource, "reaper-kb.ini");
  const kb = await readOr(kbPath);
  const next = restoreKb(kb, o.kb);
  if (next === kb) return;
  if (next === null) await unlink(kbPath).catch(() => undefined);
  else await writeAtomic(kbPath, next);
}
