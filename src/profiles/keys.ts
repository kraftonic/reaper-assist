import type { ActionRef, KeySection, Mod, Shortcut } from "./types";

/**
 * reaper-kb.ini shortcut encoding: `KEY <flags> <code> <action> <section>`.
 *
 * flags = 1 (code is a virtual key) + shift 4 + ⌘/Ctrl 8 + ⌥/Alt 16 + Control/Win 32.
 * Codes are Windows virtual-key codes, with 0x8000 added for "extended" keys (the arrow /
 * navigation block and the numpad Enter). Checked in REAPER 7.82 (probe: GetActionShortcutDesc)
 * and against SWELL's key translation (WDL swell-kb.mm, SWELL_MacKeyToWindowsKeyEx):
 *  - on macOS, punctuation keys are not virtual keys: REAPER stores the character itself
 *    (flag 1 off), and Shift is folded into the character ("⇧=" is "+", no shift flag);
 *  - on Windows they are the VK_OEM_* codes with flag 1;
 *  - on Linux REAPER's SWELL stores punctuation like macOS (the character, Shift folded in), and the
 *    flags mean Ctrl 8, Alt 16, Super 32 (WDL swell-generic-gdk.cpp, OnKeyEvent / swell_gdkConvertKey).
 *    It has no numpad = and only maps F1..F12, so those keys don't exist there;
 *  - the mouse wheel is flags 255 and code 248 + ⌘/Ctrl 1 + ⌥/Alt 2 + Shift 4.
 */

export type KeyOs = "mac" | "win" | "linux";
export const KEY_OSES: readonly KeyOs[] = ["mac", "win", "linux"];
export const hostKeyOs = (): KeyOs => {
  const p = typeof process !== "undefined" ? process.platform : "darwin";
  return p === "win32" ? "win" : p === "linux" ? "linux" : "mac";
};

const FLAG: Record<Mod, number> = { shift: 4, cmd: 8, opt: 16, ctrl: 32 };
const EXT = 0x8000;

const NAMED: Record<string, number> = {
  Space: 32, Tab: 9, Return: 13, Escape: 27, Backspace: 8,
  Delete: 46 | EXT, Insert: 45 | EXT, Home: 36 | EXT, End: 35 | EXT, PageUp: 33 | EXT, PageDown: 34 | EXT,
  Left: 37 | EXT, Up: 38 | EXT, Right: 39 | EXT, Down: 40 | EXT,
  "Num*": 106, "Num+": 107, "Num-": 109, "Num.": 110, "Num/": 111, NumEnter: 13 | EXT,
};
/** Windows VK_OEM codes for punctuation (US layout). */
const OEM: Record<string, number> = { "=": 187, "-": 189, ",": 188, ".": 190, "/": 191, ";": 186, "'": 222, "[": 219, "]": 221, "\\": 220, "`": 192 };
/** What Shift turns a punctuation key into (US layout), for macOS where REAPER stores the character. */
const SHIFTED: Record<string, string> = { "=": "+", "-": "_", ",": "<", ".": ">", "/": "?", ";": ":", "'": '"', "[": "{", "]": "}", "\\": "|", "`": "~" };

/** REAPER keymap section ids. */
export const SECTION_ID: Record<KeySection, number> = { main: 0, midi: 32060, midilist: 32061, explorer: 32063, alt1: 1 };

/** [flags, code] for a key, or null when the key doesn't exist on that platform (numpad = on Windows). */
export function keyEncoding(mods: Mod[], key: string, os: KeyOs): [number, number] | null {
  const modFlags = mods.reduce((n, m) => n | FLAG[m], 0);
  if (key === "Wheel") {
    if (mods.includes("ctrl")) return null;
    return [255, 248 | (mods.includes("cmd") ? 1 : 0) | (mods.includes("opt") ? 2 : 0) | (mods.includes("shift") ? 4 : 0)];
  }
  if (/^[A-Z0-9]$/.test(key)) return [1 | modFlags, key.charCodeAt(0)];
  const f = /^F(\d{1,2})$/.exec(key);
  if (f && Number(f[1]) >= 1 && Number(f[1]) <= 24) return os === "linux" && Number(f[1]) > 12 ? null : [1 | modFlags, 111 + Number(f[1])];
  const n = /^Num(\d)$/.exec(key);
  if (n) return [1 | modFlags, 96 + Number(n[1])];
  if (key === "Num=") return os === "mac" ? [1 | modFlags, 108] : null;
  if (key in NAMED) return [1 | modFlags, NAMED[key]!];
  if (key in OEM) {
    if (os === "win") return [1 | modFlags, OEM[key]!];
    const ch = mods.includes("shift") ? SHIFTED[key]! : key;
    return [modFlags & ~FLAG.shift, ch.charCodeAt(0)];
  }
  throw new Error(`Unknown key ${key}`);
}

const actionText = (a: ActionRef) => String(a);

/** The reaper-kb.ini / .ReaperKeyMap line for a shortcut, or null when the key doesn't exist on that platform. */
export function keymapLine(s: Shortcut, os: KeyOs = hostKeyOs()): string | null {
  const enc = keyEncoding(s.mods, s.key, os);
  return enc ? `KEY ${enc[0]} ${enc[1]} ${actionText(s.action)} ${SECTION_ID[s.section ?? "main"]}` : null;
}

/** "⌘⇧T" on macOS, "Ctrl+Shift+T" elsewhere (the Windows key is called Super on Linux). */
export function shortcutLabel(s: Shortcut, mac: boolean, linux = false): string {
  const order: Mod[] = mac ? ["ctrl", "opt", "shift", "cmd"] : ["ctrl", "cmd", "opt", "shift"];
  const macSym: Record<Mod, string> = { ctrl: "⌃", opt: "⌥", shift: "⇧", cmd: "⌘" };
  const winName: Record<Mod, string> = { ctrl: linux ? "Super" : "Win", cmd: "Ctrl", opt: "Alt", shift: "Shift" };
  const names: Record<string, string> = {
    Return: mac ? "Return" : "Enter", Escape: "Esc", Backspace: mac ? "Delete" : "Backspace", Delete: mac ? "⌦" : "Delete",
    PageUp: "Page Up", PageDown: "Page Down", Left: "←", Right: "→", Up: "↑", Down: "↓", NumEnter: "Numpad Enter", Wheel: "Mouse wheel",
  };
  const key = names[s.key] ?? (s.key.startsWith("Num") ? `Numpad ${s.key.slice(3)}` : s.key);
  const mods = order.filter((m) => s.mods.includes(m));
  return mac ? `${mods.map((m) => macSym[m]).join("")}${key}` : [...mods.map((m) => winName[m]), key].join("+");
}
