import { copyFile, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * The "workspace" part of a Coming-from profile: a browser docked beside the
 * arrange view (REAPER's Media Explorer for samples, with the FX Browser as a
 * second tab, so both drag straight onto tracks) and the mixer docked at the
 * bottom, the way FL Studio's and Ableton Live's browsers sit.
 *
 * REAPER keeps window layout in reaper.ini and rewrites it when it quits, so this
 * is only written while REAPER is closed. While REAPER runs, the bridge's
 * setupWorkspace does the same thing live (see assist_bridge.lua). Only the keys below are touched (verified
 * against REAPER 7.8 in throwaway instances):
 *
 *   [reaper]            dockermodeN (0 bottom, 1 left, 2 top, 3 right), dockheight_l/_r
 *                       (docker width), dockerselN (selected tab), fxadd_vis / fxadd_dock
 *                       (FX Browser open and docked), mixwnd_vis / mixwnd_dock
 *   [REAPERdockpref]    ident=<order> <docker> for "explorer" and "fxbrowser"
 *   [reaper_sexplorer]  docked, visible, lastdir, NbShortcuts, Shortcut<i>, ShortcutT<i>
 *
 * Optional, per profile: transport_dock=1 + transport_dock_pos (0 below the arrange, REAPER's
 * default; 1 above the ruler; 2 bottom of the main window; 3 top of the main window), mixerflag
 * bit 32 (track panel on the right of the arrange view), [midiedit] dock=1 (MIDI editor docks
 * in the bottom docker).
 *
 * src/profiles/engine/restore.ts records the original values of all of these first, so they can be put back.
 */

export interface WorkspacePlan {
  side: "left" | "right";
  /** Docker width in pixels (points on macOS). */
  width: number;
  /** Folder the Media Explorer opens in. */
  startDir: string;
  /** Shortcut folders to add to the Media Explorer's list (existing ones are kept). */
  shortcuts: { path: string; title: string }[];
  /** Transport docked along the top (FL, Live, Logic, Pro Tools) or the bottom (Cubase, Studio One) of the main window. */
  transport?: "top" | "bottom";
  /** Track panel on the right of the arrange view, like Live's track headers. */
  tcpRight?: boolean;
  /** MIDI editor docks at the bottom with the mixer, like Live's clip view. */
  midiDocked?: boolean;
}

/** transport_dock_pos values (checked against REAPER 7.82). */
export const TRANSPORT_POS = { below: 0, above: 1, bottom: 2, top: 3 } as const;
export type TransportWhere = keyof typeof TRANSPORT_POS;

type Line = { raw: string; key?: string };
type Section = { header: string; name: string; lines: Line[] };
export type IniDoc = ReturnType<typeof parse>;

export function parse(text: string): { pre: Line[]; sections: Section[]; eol: string } {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const out = { pre: [] as Line[], sections: [] as Section[], eol };
  let cur: Line[] = out.pre;
  for (const raw of text.split(/\r?\n/)) {
    const h = /^\[(.+)\]\s*$/.exec(raw);
    if (h) {
      const s: Section = { header: raw, name: h[1]!.toLowerCase(), lines: [] };
      out.sections.push(s);
      cur = s.lines;
      continue;
    }
    const k = /^([^=;\[]+)=/.exec(raw);
    cur.push(k ? { raw, key: k[1]! } : { raw });
  }
  return out;
}

export function section(doc: IniDoc, name: string): Section {
  let s = doc.sections.find((x) => x.name === name.toLowerCase());
  if (!s) {
    s = { header: `[${name}]`, name: name.toLowerCase(), lines: [] };
    doc.sections.push(s);
  }
  return s;
}

export const get = (s: Section, key: string) => s.lines.find((l) => l.key === key)?.raw.slice(key.length + 1);

export function unset(s: Section, key: string) {
  s.lines = s.lines.filter((l) => l.key !== key);
}

export function set(s: Section, key: string, value: string) {
  const line = { raw: `${key}=${value}`, key };
  const i = s.lines.findIndex((l) => l.key === key);
  if (i >= 0) s.lines[i] = line;
  else {
    // Before any trailing blank lines, so the section stays together.
    let at = s.lines.length;
    while (at > 0 && !s.lines[at - 1]!.raw.trim()) at--;
    s.lines.splice(at, 0, line);
  }
}

export function serialize(doc: IniDoc): string {
  const parts: string[] = doc.pre.map((l) => l.raw);
  for (const s of doc.sections) {
    if (parts.length && parts[parts.length - 1] !== "" && s !== doc.sections[0]) parts.push("");
    parts.push(s.header, ...s.lines.map((l) => l.raw));
  }
  return parts.join(doc.eol).replace(/(\r?\n){3,}/g, doc.eol + doc.eol);
}

/**
 * REAPER's own Media Explorer shortcuts when it has never saved a list (seen on macOS).
 * Elsewhere they're unknown, so a list that was never saved is left alone there.
 */
export const DEFAULT_SHORTCUTS = (home = homedir(), os: NodeJS.Platform = process.platform) =>
  os !== "darwin"
    ? []
    : [
        { path: "/", title: "/" },
        { path: "/Volumes", title: "Volumes" },
        { path: home, title: "Home" },
        { path: join(home, "Desktop"), title: "Desktop" },
        { path: join(home, "Documents"), title: "Documents" },
      ];

/** Merge the workspace into reaper.ini text. Everything else is kept as it was. */
export function workspaceIni(text: string, plan: WorkspacePlan, home = homedir(), defaults = DEFAULT_SHORTCUTS(home)): string {
  const doc = parse(text);
  const main = section(doc, "reaper");
  const pref = section(doc, "REAPERdockpref");
  const mx = section(doc, "reaper_sexplorer");
  const OURS = new Set(["explorer", "fxbrowser"]);

  // A docker no other window uses (docker 0 holds the mixer by default).
  const used = new Set<number>([0]);
  for (const l of pref.lines) {
    if (!l.key || OURS.has(l.key)) continue;
    const n = Number(l.raw.split("=")[1]?.trim().split(/\s+/)[1]);
    if (Number.isInteger(n)) used.add(n);
  }
  const mine = pref.lines.find((l) => l.key === "explorer");
  const current = Number(mine?.raw.split("=")[1]?.trim().split(/\s+/)[1]);
  const dock = Number.isInteger(current) && !used.has(current) ? current : [...Array(16).keys()].find((n) => !used.has(n))!;

  set(main, `dockermode${dock}`, plan.side === "left" ? "1" : "3");
  set(main, plan.side === "left" ? "dockheight_l" : "dockheight_r", String(Math.round(plan.width)));
  set(main, `dockersel${dock}`, "explorer");
  set(main, "fxadd_vis", "1");
  set(main, "fxadd_dock", "1");
  set(main, "mixwnd_vis", "1");
  set(main, "mixwnd_dock", "1");
  set(pref, "explorer", `0.1 ${dock}`);
  set(pref, "fxbrowser", `0.2 ${dock}`);

  if (plan.transport) {
    set(main, "transport_vis", "1");
    set(main, "transport_dock", "1");
    set(main, "transport_dock_pos", String(TRANSPORT_POS[plan.transport]));
  }
  if (plan.tcpRight) set(main, "mixerflag", String((Number(get(main, "mixerflag")) || 0) | 32));
  if (plan.midiDocked) set(section(doc, "midiedit"), "dock", "1");

  set(mx, "docked", "1");
  set(mx, "visible", "1");
  set(mx, "lastdir", plan.startDir);
  // Shortcuts: keep the user's list (or REAPER's defaults), ours go first if the list is new.
  const n = Number(get(mx, "NbShortcuts"));
  const existing: { path: string; title: string }[] = Number.isInteger(n) && n > 0
    ? Array.from({ length: n }, (_, i) => ({ path: get(mx, `Shortcut${i}`) ?? "", title: get(mx, `ShortcutT${i}`) ?? "" })).filter((s) => s.path)
    : [];
  if (!existing.length && !defaults.length) return serialize(doc);
  const norm = (p: string) => p.replace(/[/\\]+$/, "") || "/";
  const have = new Set(existing.map((s) => norm(s.path)));
  const add = plan.shortcuts.filter((s) => !have.has(norm(s.path)));
  const list = existing.length ? [...existing, ...add] : [...add, ...defaults.filter((d) => !add.some((a) => norm(a.path) === norm(d.path)))];
  mx.lines = mx.lines.filter((l) => !l.key || !/^(NbShortcuts|Shortcut\d+|ShortcutT\d+)$/.test(l.key));
  set(mx, "NbShortcuts", String(list.length));
  list.forEach((s, i) => {
    set(mx, `Shortcut${i}`, s.path);
    set(mx, `ShortcutT${i}`, s.title);
  });
  return serialize(doc);
}

/** Sample folders worth a shortcut, in order: Splice, Music, Downloads (only those that exist). */
export function sampleFolders(home = homedir()): { path: string; title: string }[] {
  const out: { path: string; title: string }[] = [];
  for (const [p, t] of [[join(home, "Splice", "sounds"), "Splice"], [join(home, "Music"), "Music"], [join(home, "Downloads"), "Downloads"]] as const) {
    if (existsSync(p)) out.push({ path: p, title: t });
  }
  return out;
}

/**
 * Write the workspace into reaper.ini (REAPER must be closed). Returns the backup path.
 * `reset` first puts back the user's own layout (so a previous profile's layout doesn't linger).
 */
export async function installWorkspace(resource: string, plan: WorkspacePlan, now = new Date(), reset: (text: string) => string = (t) => t): Promise<{ backup: string }> {
  const ini = join(resource, "reaper.ini");
  const text = await readFile(ini, "latin1");
  const backup = `${ini}.before-assist-layout-${now.toISOString().slice(0, 19).replace(/[:T]/g, "-")}`;
  await copyFile(ini, backup);
  await writeFile(ini + ".tmp", workspaceIni(reset(text), plan), "latin1");
  await rename(ini + ".tmp", ini);
  return { backup };
}
