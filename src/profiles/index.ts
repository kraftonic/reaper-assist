/**
 * "Coming from…" profiles: make REAPER look, feel and work like the DAW someone is used to.
 * Each profile is in profiles/<id>/profile.ts; what a profile can hold is in profiles/types.ts.
 * Everything a profile changes can be undone with "Restore REAPER" (src/profiles/engine/restore.ts).
 *
 * DAW names are used only to say who a profile is for. No logos, artwork or exact skins are copied.
 * Action ids are checked against REAPER 7.82's action list.
 */
import { ableton } from "./ableton/profile";
import { cubase } from "./cubase/profile";
import { fl } from "./fl/profile";
import { logic } from "./logic/profile";
import { protools } from "./protools/profile";
import { studioone } from "./studioone/profile";
import type { KeySection, Macro, Mod, ProfileScript, Workflow } from "./types";
import { KEY_OSES, SECTION_ID, keymapLine, type KeyOs } from "./keys";

export type * from "./types";
export { keymapLine, keyEncoding, shortcutLabel, SECTION_ID, KEY_OSES, hostKeyOs, type KeyOs } from "./keys";

export const WORKFLOWS: Workflow[] = [fl, ableton, logic, protools, cubase, studioone];

export function findWorkflow(id: string | null | undefined): Workflow | null {
  return WORKFLOWS.find((w) => w.id === id) ?? null;
}

/* ------------------------------------------------------- reaper-kb.ini lines */

const sectionId = (s: KeySection | undefined) => SECTION_ID[s ?? "main"];
const quote = (s: string) => `"${s.replace(/"/g, "'")}"`;

/** Folder under REAPER's Scripts/ that holds the profiles' scripts (Restore empties it; the bridge sits one level up). */
export const SCRIPT_DIR = "ReaperAssist/Profile";

export function scriptLine(s: ProfileScript): string {
  return `SCR 4 ${sectionId(s.section)} ${s.id} ${quote(`Custom: Assist: ${s.name}`)} ${quote(`${SCRIPT_DIR}/${s.file}`)}`;
}

export function macroLine(m: Macro): string {
  return `ACT 0 ${sectionId(m.section)} ${quote(m.id)} ${quote(`Custom: Assist: ${m.name}`)} ${m.actions.join(" ")}`;
}

/** Everything a profile puts in reaper-kb.ini: its scripts and custom actions first, then its keys. */
export function profileKbLines(w: Workflow, os?: KeyOs): string[] {
  return [
    ...(w.scripts ?? []).map(scriptLine),
    ...(w.macros ?? []).map(macroLine),
    ...w.shortcuts.map((s) => keymapLine(s, os)).filter((l): l is string => l !== null),
  ];
}

/** The keys older Assist versions wrote (so Restore can still take them out). */
const LEGACY_LINES = ["KEY 1 82 1013 0","KEY 9 82 40015 0","KEY 1 120 40078 0","KEY 1 118 40153 0","KEY 1 119 50124 0","KEY 9 66 41295 0","KEY 1 67 40746 0","KEY 17 84 40157 0","KEY 13 83 40022 0","KEY 1 120 1013 0","KEY 1 9 40078 0","KEY 1 9 40401 32060","KEY 9 69 40757 0","KEY 9 74 40362 0","KEY 9 68 41295 0","KEY 9 84 40001 0","KEY 13 84 40701 0","KEY 9 82 40696 0","KEY 9 76 41039 0","KEY 9 85 40316 0","KEY 9 48 40175 0","KEY 25 66 50124 0","KEY 13 82 40015 0","KEY 9 84 40012 0","KEY 9 82 41295 0","KEY 1 88 40078 0","KEY 1 80 40153 0","KEY 1 67 1068 0","KEY 1 75 40364 0","KEY 1 81 40316 0","KEY 1 77 40175 0","KEY 1 83 7 0","KEY 25 78 40001 0","KEY 1 13 40042 0","KEY 1 70 50124 0","KEY 9 66 40015 0","KEY 17 222 40157 0","KEY 9 32 1013 0","KEY 1 123 1013 0","KEY 9 187 40078 0","KEY 13 78 40001 0","KEY 29 51 40362 0","KEY 9 77 40175 0","KEY 13 76 1068 0","KEY 25 66 40015 0","KEY 1 106 1013 0","KEY 17 88 40757 0","KEY 1 114 40078 0","KEY 1 111 1068 0","KEY 1 67 40364 0","KEY 1 116 50124 0","KEY 1 84 40001 0","KEY 9 66 40362 0","KEY 5 77 40175 0","KEY 9 69 40015 0"];

/** Every KEY line any profile writes, on either platform, plus the ones older versions wrote. */
export function allProfileKeymapLines(): string[] {
  const now = WORKFLOWS.flatMap((w) => KEY_OSES.flatMap((os) => w.shortcuts.map((s) => keymapLine(s, os))));
  const lines = now.filter((l): l is string => l !== null);
  // The same lines as builds before the rename wrote them (assist_ was kraftonic_).
  const renamed = lines.filter((l) => l.includes("assist_")).map((l) => l.replaceAll("assist_", "kraftonic_"));
  return [...new Set([...LEGACY_LINES, ...lines, ...renamed])];
}

/**
 * A reaper-kb.ini line for one of Assist's scripts or custom actions: its registration, or a key bound to it.
 * Builds before the rename used the prefix kraftonic_ instead of assist_.
 */
export const isAssistKbLine = (l: string) => /^(SCR \d+ \d+ RS_(assist|kraftonic)_|ACT \d+ \d+ "(assist|kraftonic)_|KEY \d+ \d+ _(RS_)?(assist|kraftonic)_)/.test(l.trim());

/* ------------------------------------------------------ what profiles touch */

const MOUSE_BIT: Record<Mod, number> = { shift: 1, cmd: 2, opt: 4, ctrl: 8 };
/** "MM_CTX_X\tN": a mouse-modifier slot (context + modifier flag: shift 1, ⌘/Ctrl 2, ⌥/Alt 4, Control/Win 8). */
export const mouseSlot = (ctx: string, mods: Mod[]) => `${ctx}\t${mods.reduce((n, m) => n | MOUSE_BIT[m], 0)}`;

/**
 * Everything any profile may change, so the restore record can hold the original of each
 * before the first change, and Restore knows what to put back:
 *  - ini: reaper.ini [REAPER] keys of preferences;
 *  - bits: keys of which profiles only change some bits (restore puts back only those bits);
 *  - mouse: mouse-modifier slots (set by profiles, or by their tool scripts at runtime);
 *  - menus: reaper-menu.ini sections (toolbars).
 */
export function profileTouches(list: Workflow[] = WORKFLOWS): { ini: string[]; bits: Record<string, number>; mouse: string[]; menus: string[] } {
  const ini = new Set<string>(), whole = new Set<string>(), mouse = new Set<string>(), menus = new Set<string>();
  const bits: Record<string, number> = { mixerflag: 32 };
  for (const w of list) {
    for (const p of w.prefs ?? []) {
      ini.add(p.key);
      if (p.bits === undefined) whole.add(p.key);
      else bits[p.key] = (bits[p.key] ?? 0) | p.bits;
    }
    for (const m of [...(w.mouse ?? []), ...(w.toolSlots ?? [])]) mouse.add(mouseSlot(m.ctx, m.mods));
    for (const t of w.toolbars ?? []) menus.add(t.section);
  }
  for (const k of whole) delete bits[k];
  return { ini: [...ini], bits, mouse: [...mouse], menus: [...menus] };
}
