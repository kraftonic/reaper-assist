import type { Layout, Pref, Toolbar } from "../index";
import { TRANSPORT_POS, get, parse, section, serialize, set, unset, type IniDoc } from "./workspace";

/**
 * Text edits for the files a "Coming from…" profile changes (pure: text in, text out).
 * REAPER rewrites these files when it quits, so they are only written while it's closed.
 *
 *  - reaper-mouse.ini   [MM_CTX_*] mm_N=<value>     (sparse: a missing key = REAPER's default)
 *  - reaper-menu.ini    [Main toolbar] item_N / icon_N / tbf_N / title (a missing section = REAPER's default)
 *  - reaper.ini         [REAPER] preferences and window layout
 *
 * Formats: docs/research/reaper-mechanics.md §1, §2, §3.2, §5; checked in REAPER 7.82.
 */

const find = (doc: IniDoc, name: string) => doc.sections.find((x) => x.name === name.toLowerCase());
const NL = process.platform === "win32" ? "\r\n" : "\n";

/** reaper-mouse.ini / reaper-menu.ini text for a file that doesn't exist yet. */
const emptyDoc = (): IniDoc => ({ pre: [], sections: [], eol: NL });
const docOf = (text: string | null) => (text === null || !text.trim() ? emptyDoc() : parse(text));

/** UTF-8 text in a file Assist reads and writes byte-for-byte (latin1). */
const bytes = (s: string) => Buffer.from(s, "utf8").toString("latin1");

/* ------------------------------------------------------------ mouse */

/**
 * What REAPER 7.82 writes at the top of a new reaper-mouse.ini. It marks the pre-4.0 click
 * preferences as imported; a file without it may get them imported over ours.
 */
const HASIMPORTED = ["ARRANGE_MMOUSE", "ARRANGE_MMOUSE_CLK", "ARRANGE_RMOUSE", "CURSORHANDLE", "ENVLANE", "ENVPT", "ENVSEG", "ENVSEG_DBLCLK", "ITEM", "ITEM_CLK", "ITEM_DBLCLK", "ITEMEDGE", "MIDI_CCLANE", "MIDI_NOTE", "MIDI_NOTE_CLK", "MIDI_NOTE_DBLCLK", "MIDI_PIANOROLL_CLK", "MIDI_PIANOROLL_DBLCLK", "MIDI_RMOUSE", "MIDI_RULER", "RULER", "TRACK"].map((c) => `MM_CTX_${c}=1`);

/** The values of mouse slots ("MM_CTX_X\tN"), null where REAPER uses its default. */
export function mouseValues(text: string | null, slots: Iterable<string>): Record<string, string | null> {
  const doc = docOf(text);
  const out: Record<string, string | null> = {};
  for (const slot of slots) {
    const [ctx, n] = slot.split("\t") as [string, string];
    const sec = find(doc, ctx);
    out[slot] = (sec && get(sec, `mm_${n}`)) ?? null;
  }
  return out;
}

/** Set mouse slots (null: back to REAPER's default). Everything else in the file is kept. */
export function setMouseValues(text: string | null, values: Record<string, string | null>): string {
  const doc = docOf(text);
  if (!find(doc, "hasimported") && (text === null || !text.trim())) {
    doc.sections.push({ header: "[hasimported]", name: "hasimported", lines: HASIMPORTED.map((raw) => ({ raw, key: raw.split("=")[0]! })) });
  }
  const touched = new Set<string>();
  for (const [slot, v] of Object.entries(values)) {
    const [ctx, n] = slot.split("\t") as [string, string];
    touched.add(ctx.toLowerCase());
    if (v === null) {
      const sec = find(doc, ctx);
      if (sec) unset(sec, `mm_${n}`);
    } else set(section(doc, ctx), `mm_${n}`, v);
  }
  // A context with nothing left in it is REAPER's default: drop the empty section.
  doc.sections = doc.sections.filter((s) => !touched.has(s.name) || s.lines.some((l) => l.key));
  return serialize(doc);
}

/* ------------------------------------------------------------ menus */

/** The lines of each named section (null: not in the file, so REAPER uses its default). */
export function menuSections(text: string | null, names: Iterable<string>): Record<string, string[] | null> {
  const doc = docOf(text);
  const out: Record<string, string[] | null> = {};
  for (const n of names) {
    const sec = find(doc, n);
    out[n] = sec ? sec.lines.map((l) => l.raw).filter((r) => r.trim()) : null;
  }
  return out;
}

/** Replace whole sections (null: remove it). Other sections are kept as they are. */
export function setMenuSections(text: string | null, sections: Record<string, string[] | null>): string {
  const doc = docOf(text);
  for (const [name, lines] of Object.entries(sections)) {
    if (lines === null) {
      doc.sections = doc.sections.filter((s) => s.name !== name.toLowerCase());
      continue;
    }
    const sec = section(doc, name);
    sec.lines = lines.map((raw) => {
      const k = /^([^=;[]+)=/.exec(raw);
      return k ? { raw, key: k[1]! } : { raw };
    });
  }
  return serialize(doc);
}

/** A toolbar as reaper-menu.ini lines. Items are numbered from 0 with no gaps (REAPER stops at a gap). */
export function toolbarLines(t: Toolbar): string[] {
  const out: string[] = [];
  t.items.forEach((it, i) => {
    out.push(it.action === "-" ? `item_${i}=-1` : `item_${i}=${it.action} ${bytes(it.label)}`);
    if (it.icon) out.push(`icon_${i}=${/\.png$|^text/.test(it.icon) ? it.icon : `${it.icon}.png`}`);
    if (it.toggle) out.push(`tbf_${i}=1`);
  });
  if (t.title) out.push(`title=${bytes(t.title)}`);
  return out;
}

/* ------------------------------------------------------------ preferences */

/**
 * REAPER's built-in values for bit-field preferences profiles change only some bits of, used when
 * reaper.ini doesn't have the key yet (REAPER then uses these). Read from REAPER 7.82 (macOS) with
 * get_config_var_string on a resource folder whose reaper.ini lacks the keys.
 */
export const REAPER_DEFAULTS: Record<string, number> = {
  autoxfade: 129,
  deftrackrecflags: 256,
  itemclickmovecurs: 3,
  itemicons: 16765,
  labelitems2: 15,
  midieditor: 198273,
  mixerflag: 0,
  mixrowflags: 48,
  projmetroen: 6,
  projshowgrid: 3327,
  rulerlayout: 0,
  splitautoxfade: 0,
  tcpalign: 1,
  trackselonmouse: 1,
  transflags: 0,
  trimmidionsplit: 1,
  viewadvance: 3,
};

/** A bit-field preference's current value: reaper.ini's, else REAPER's default. */
export const bitsBase = (raw: string | undefined, key: string) => Number(raw ?? REAPER_DEFAULTS[key] ?? 0) || 0;

/** Set preferences in reaper.ini's [REAPER] section (only the given bits, for bit-masked ones). */
export function applyPrefs(text: string, prefs: Pref[]): string {
  if (!prefs.length) return text;
  const doc = parse(text);
  const main = section(doc, "REAPER");
  for (const p of prefs) {
    if (p.bits === undefined) set(main, p.key, String(p.value));
    else {
      const cur = bitsBase(get(main, p.key), p.key);
      set(main, p.key, String((cur & ~p.bits) | (Number(p.value) & p.bits)));
    }
  }
  return serialize(doc);
}

/* ------------------------------------------------------------ start-up */

const START_BEGIN = "-- >>> REAPER Assist profile (added by REAPER Assist; Restore REAPER removes it)";
const START_END = "-- <<< REAPER Assist profile";
/** The same block as builds before the rename wrote it. */
const LEGACY_START = ["-- >>> Kraftonic Assist profile", "-- <<< Kraftonic Assist profile"] as const;
/** Scripts/__startup.lua without Assist's profile block (current or legacy). */
export function withoutStartupBlock(text: string): string {
  let out = text;
  for (const [begin, end] of [[START_BEGIN, START_END], LEGACY_START] as const) {
    const a = out.indexOf(begin);
    if (a < 0) continue;
    const b = out.indexOf(end, a);
    out = (out.slice(0, a) + out.slice(b < 0 ? out.length : b + end.length)).replace(/\n{3,}/g, "\n\n").trim() + "\n";
  }
  return out;
}
/** Scripts/__startup.lua with Assist's profile block (it runs ReaperAssist/Profile/startup.lua when that exists). */
export function withStartupBlock(text: string | null): string {
  const head = withoutStartupBlock(text ?? "").trim();
  const block = `${START_BEGIN}\nlocal assist_profile = reaper.GetResourcePath() .. "/Scripts/ReaperAssist/Profile/startup.lua"\nif reaper.file_exists(assist_profile) then dofile(assist_profile) end\n${START_END}\n`;
  return `${head ? head + "\n\n" : ""}${block}`;
}
/** The profile's start-up script: runs each main-section action once. */
export function startupLua(daw: string, actions: (number | string)[]): string {
  const list = actions.map((a) => (typeof a === "number" ? String(a) : JSON.stringify(a))).join(", ");
  return `-- REAPER Assist: what the ${daw} profile runs when REAPER starts (Restore REAPER removes it).\nfor _, a in ipairs({ ${list} }) do\n  local id = type(a) == "number" and a or reaper.NamedCommandLookup(a)\n  if id and id ~= 0 then reaper.Main_OnCommand(id, 0) end\nend\n`;
}

/* ------------------------------------------------------------ layout */

export interface ExplorerSetup {
  /** Folder the Media Explorer opens in. */
  startDir: string;
  /** Folders added to the Media Explorer's shortcut list (the user's own are kept). */
  shortcuts: { path: string; title: string }[];
  /** REAPER's own list when it never saved one (see DEFAULT_SHORTCUTS). */
  defaults: { path: string; title: string }[];
}

const BROWSER_TABS = new Set(["explorer", "fxbrowser"]);

/**
 * Put REAPER's windows where the profile wants them. Keys left out of `layout` stay as they are.
 * The browser dockers take docker slots no other window uses (docker 0 is the mixer's).
 */
export function layoutIni(text: string, layout: Partial<Layout>, explorer?: ExplorerSetup): string {
  const doc = parse(text);
  const main = section(doc, "REAPER");

  if (layout.transport) {
    set(main, "transport_vis", "1");
    set(main, "transport_dock", "1");
    set(main, "transport_dock_pos", String(TRANSPORT_POS[layout.transport]));
  }
  if (layout.tcp) {
    const cur = Number(get(main, "mixerflag")) || 0;
    const next = layout.tcp === "right" ? cur | 32 : cur & ~32;
    if (next !== cur || layout.tcp === "right") set(main, "mixerflag", String(next));
  }
  if (layout.tcpWidth) set(main, "leftpanewid", String(Math.round(layout.tcpWidth)));
  if (layout.dockHeight) set(main, "dockheight", String(Math.round(layout.dockHeight)));
  if (layout.mixer) {
    set(main, "mixwnd_vis", layout.mixer === "hidden" ? "0" : "1");
    set(main, "mixwnd_dock", layout.mixer === "window" ? "0" : "1");
  }
  if (layout.mixer === "window") {
    // A floating mixer keeps the size REAPER last gave it; the first time (or when it's tiny) it gets
    // the main window's width and a bit under half its height, at the main window's corner.
    const num = (k: string) => Number(get(main, k)) || 0;
    if (num("mixwnd_w") < 600 || num("mixwnd_h") < 300) {
      const w = num("wnd_w") || 1400, h = num("wnd_h") || 900;
      set(main, "mixwnd_x", String(num("wnd_x")));
      set(main, "mixwnd_y", String(num("wnd_y")));
      set(main, "mixwnd_w", String(Math.max(900, Math.round(w))));
      set(main, "mixwnd_h", String(Math.max(380, Math.round(h * 0.45))));
    }
  }
  if (layout.midiEditor) set(section(doc, "midiedit"), "dock", layout.midiEditor === "docked" ? "1" : "0");
  // Note colours: measured in REAPER 7.82 (actions 40768 / 40769 write colorwhat 4 / 5).
  if (layout.midiNoteColor) set(section(doc, "midiedit"), "colorwhat", layout.midiNoteColor === "track" ? "4" : "5");

  const docks = layout.browser ? (Array.isArray(layout.browser) ? layout.browser : [layout.browser]).filter((b) => b.tabs.length) : [];
  if (docks.length) {
    const pref = section(doc, "REAPERdockpref");
    const dockOf = (ident: string) => Number(get(pref, ident)?.trim().split(/\s+/)[1]);
    const used = new Set<number>([0]);
    for (const l of pref.lines) if (l.key && !BROWSER_TABS.has(l.key)) used.add(dockOf(l.key));
    for (const b of docks) {
      const current = dockOf(b.tabs[0]!);
      const dock = Number.isInteger(current) && current > 0 && current < 16 && !used.has(current) ? current : [...Array(16).keys()].find((n) => !used.has(n))!;
      used.add(dock);
      set(main, `dockermode${dock}`, b.side === "left" ? "1" : "3");
      set(main, b.side === "left" ? "dockheight_l" : "dockheight_r", String(Math.round(b.width)));
      set(main, `dockersel${dock}`, b.tabs[0]!);
      b.tabs.forEach((t, i) => set(pref, t, `${(0.1 * (i + 1)).toFixed(8)} ${dock}`));
      if (b.tabs.includes("fxbrowser")) {
        set(main, "fxadd_vis", "1");
        set(main, "fxadd_dock", "1");
      }
      if (b.tabs.includes("explorer")) {
        const mx = section(doc, "reaper_sexplorer");
        set(mx, "docked", "1");
        set(mx, "visible", "1");
        if (explorer) {
          set(mx, "lastdir", explorer.startDir);
          mergeExplorerShortcuts(mx, explorer.shortcuts, explorer.defaults);
        }
      }
    }
  }
  return serialize(doc);
}

type Section = IniDoc["sections"][number];
const LIST_KEY = /^(NbShortcuts|Shortcut\d+|ShortcutT\d+)$/;

/** Add folders to the Media Explorer's shortcut list: the user's list (or REAPER's defaults) is kept, ours go first in a new list. */
export function mergeExplorerShortcuts(mx: Section, add: { path: string; title: string }[], defaults: { path: string; title: string }[]): void {
  const n = Number(get(mx, "NbShortcuts"));
  const existing = Number.isInteger(n) && n > 0
    ? Array.from({ length: n }, (_, i) => ({ path: get(mx, `Shortcut${i}`) ?? "", title: get(mx, `ShortcutT${i}`) ?? "" })).filter((s) => s.path)
    : [];
  if (!existing.length && !defaults.length) return;
  const norm = (p: string) => p.replace(/[/\\]+$/, "") || "/";
  const have = new Set(existing.map((s) => norm(s.path)));
  const extra = add.filter((s) => !have.has(norm(s.path)));
  const list = existing.length ? [...existing, ...extra] : [...extra, ...defaults.filter((d) => !extra.some((a) => norm(a.path) === norm(d.path)))];
  mx.lines = mx.lines.filter((l) => !l.key || !LIST_KEY.test(l.key));
  set(mx, "NbShortcuts", String(list.length));
  list.forEach((s, i) => {
    set(mx, `Shortcut${i}`, s.path);
    set(mx, `ShortcutT${i}`, s.title);
  });
}
