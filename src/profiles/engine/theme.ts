import { reaperInstallDirs, stockThemeIn } from "@daw/reaper/locate";
import { constants } from "node:fs";
import { copyFile, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { platform } from "node:os";
import { unzipSync, zipSync, type Zippable } from "fflate";
import { profileKbLines, type Workflow } from "../index";
import { mix, type ReaperSkin } from "../skins";
import { artMap, skinPng } from "../kit/skinArt";
import { DEFAULT_METER_RANGE, KITS, kitFiles, kitImageNames, kitIniColors, type MeterRange } from "../kit";
import type { FontFace, KitFaces } from "../kit/types";
import { restoreKb } from "./restore";

/**
 * Applies a "Coming from…" profile to REAPER.
 *
 * Theme: REAPER's own Default 7 theme (read from the user's REAPER install, never
 * shipped by us) with the profile's colours, saved as a new theme file in
 * <resource>/ColorThemes. The user's existing themes are untouched.
 *
 * Shortcuts: REAPER keeps them in reaper-kb.ini and reads it at startup. We merge
 * our keys into it after taking a dated backup, taking out any other profile's
 * keys first. REAPER leaves the file alone when it quits unless shortcuts were
 * edited in that session, so with REAPER open the app also merges them again once
 * REAPER has quit, and saves a .ReaperKeyMap the user can import to use them at once.
 *
 * Everything here can be undone with "Restore REAPER" (src/profiles/engine/restore.ts).
 */

const BASE_THEME_FILE = "Default_7.0_unpacked.ReaperTheme";
const RTCONFIG = "Default_7.0_unpacked/rtconfig.txt";
const mixHex = (a: string, b: string, t: number) => mix(a, b, t);

export function themeFileName(s: ReaperSkin): string {
  return `Assist - ${s.name}.ReaperThemeZip`;
}

export function keymapFileName(w: Workflow): string {
  return `Assist - ${w.daw} shortcuts.ReaperKeyMap`;
}

/** Where REAPER's stock Default 7 theme lives on this machine. */
export async function findDefaultTheme(resource: string): Promise<string | null> {
  // The resource folder first (a portable install, or macOS after REAPER copied it there), then the program.
  const candidates = [join(resource, "ColorThemes", "Default_7.0.ReaperThemeZip"), ...reaperInstallDirs().map(stockThemeIn)];
  for (const c of candidates) {
    try {
      await stat(c);
      return c;
    } catch {
      /* next */
    }
  }
  return null;
}

/** REAPER stores colours as integers with red in the low byte. */
export function reaperColorInt(hex: string): number {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return r | (g << 8) | (b << 16);
}

/**
 * Default 7 dims muted and un-soloed tracks (and inactive takes) with dark grey at 50–65 %.
 * (Checked in REAPER 7.82: with one track soloed, every other lane turned charcoal.)
 * On a light arrange that turns every lane charcoal whenever anything is soloed, so light
 * skins wash them toward the arrange background instead: colours plus raw draw modes
 * (0x20000 = on, bits 8–16 = opacity out of 256).
 */
export function lightOverlays(w: ReaperSkin): { colors: Record<string, string>; modes: Record<string, number> } {
  const lane = w.reaper.col_tr1_bg, bg = w.reaper.col_arrangebg ?? lane;
  const luma = (h: string) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); return (0.299 * r! + 0.587 * g! + 0.114 * b!) / 255; };
  if (!lane || !bg || luma(lane) < 0.5) return { colors: {}, modes: {} };
  const half = 0x20000 | (0x80 << 8);
  return {
    // Also: the MIDI editor's bar lines are white at 12 % in Default 7, invisible on light rows; make them dark.
    colors: { mute_overlay_col: bg, inactive_take_overlay_col: bg, midi_grid2: "#000000" },
    modes: { mute_overlay_mode: half, inactive_take_overlay_mode: half, midi_griddm2: 0x20000 | (0x48 << 8) },
  };
}

/** Rewrite the [color theme] values in a .ReaperTheme file; everything else is kept byte for byte. `modes` are written as raw integers. */
export function recolorThemeIni(ini: string, colors: Record<string, string>, modes: Record<string, number> = {}): string {
  const left = new Set([...Object.keys(colors), ...Object.keys(modes)]);
  const lines = ini.split(/\r?\n/);
  let section = "";
  const out = lines.map((line) => {
    const s = /^\[(.+)\]\s*$/.exec(line);
    if (s) section = s[1]!;
    const m = /^(\w+)=/.exec(line);
    if (section === "color theme" && m && modes[m[1]!] !== undefined) {
      left.delete(m[1]!);
      return `${m[1]}=${modes[m[1]!]! | 0}`;
    }
    if (section === "color theme" && m && colors[m[1]!]) {
      left.delete(m[1]!);
      // Keep REAPER's flag bits (top byte) and only swap the colour.
      const orig = Number(line.slice(m[0].length));
      const flags = Number.isFinite(orig) ? (orig >>> 24) << 24 : 0;
      return `${m[1]}=${(flags | reaperColorInt(colors[m[1]!]!)) | 0}`;
    }
    return line;
  });
  if (left.size) {
    // Keys the base theme doesn't list go at the end of [color theme].
    const at = out.findIndex((l, i) => i > 0 && /^\[/.test(l));
    const extra = [...left].map((k) => `${k}=${modes[k] !== undefined ? modes[k]! | 0 : reaperColorInt(colors[k]!)}`);
    out.splice(at < 0 ? out.length : at, 0, ...extra);
  }
  return out.join("\r\n");
}

/**
 * Default 7 draws track/mixer/transport panels from theme-adjuster parameters, not
 * [color theme] keys. Change their defaults (R, G, B) so the panels match too.
 */
export function recolorRtconfig(text: string, panels: ReaperSkin["panels"], ui?: ReaperSkin["ui"]): string {
  const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const targets: [string, string][] = [
    ["tcpBgCol", panels.track], ["mcpBgCol", panels.track], ["envcpBgCol", panels.master],
    ["masterTcpBgCol", panels.master], ["masterMcpBgCol", panels.master], ["transBgCol", panels.transport], ["transStatusCol", panels.transport],
  ];
  let out = text;
  for (const [name, hex] of targets) {
    const [r, g, b] = rgb(hex);
    for (const [ch, v] of [["R", r], ["G", g], ["B", b]] as const) {
      out = out.replace(new RegExp(`^(define_parameter\\s+${name}${ch}\\s+'[^']*'\\s+)\\d+`, "m"), (_m, head: string) => `${head}${v}`);
    }
  }
  if (!ui) return out;
  // Hard-coded greys in the layout script. Section boxes (name box, meter box, sidebars) are
  // 7/8-number arrays [x y w h r g b a]; text colours are 3-number arrays. Each light/dark text
  // choice resolves to the skin's text colour, which always contrasts with the skin's boxes.
  const box = rgb(mixHex(panels.track, ui.bg, 0.6));
  const infill = rgb(ui.bg);
  const fg = rgb(ui.text);
  const dim = rgb(ui.textDim);
  // Selected tracks get an inverted (text-coloured) name box, so their label takes the background colour.
  const back = rgb(ui.bg);
  out = out
    .split("\n")
    .map((line) =>
      line.includes("selInvertLabels")
        ? line.replace(/\[38 38 38\]/g, `[${back.join(" ")}]`).replace(/\[0 0 0 0 255 255 255 (\d+)\]/g, (_m, a: string) => `[0 0 0 0 ${fg.join(" ")} ${a}]`)
        : line,
    )
    .join("\n");
  out = out.replace(/\[(0 0 0 [01]) 38 38 38(?=[ \]])/g, (_m, pos: string) => `[${pos} ${box.join(" ")}`);
  out = out.replace(/\[0 0 0 0 51 51 51(?=[ \]])/g, `[0 0 0 0 ${infill.join(" ")}`);
  out = out.replace(/\[(38|180|200|220) \1 \1\]/g, `[${fg.join(" ")}]`);
  out = out.replace(/\[(150|160) \1 \1\]/g, `[${dim.join(" ")}]`);
  return out;
}

/** The meter range set in REAPER's preferences (reaper.ini vumaxvol / vuminvol, whole dB), or REAPER's default. */
export function meterRangeFromIni(ini: string): MeterRange {
  const get = (k: string) => {
    const m = new RegExp(`^${k}=(-?\\d+)[ \\t]*$`, "mi").exec(ini);
    return m ? Number(m[1]) : undefined;
  };
  const max = get("vumaxvol") ?? DEFAULT_METER_RANGE.max, min = get("vuminvol") ?? DEFAULT_METER_RANGE.min;
  return max - min >= 12 && max <= 24 && min >= -150 ? { max, min } : DEFAULT_METER_RANGE;
}

/**
 * A theme font as REAPER stores it in a .ReaperTheme [REAPER] section: a Win32 LOGFONT (60 bytes:
 * height, width, escapement, orientation, weight, 8 flag bytes, 32-byte face name) written as hex
 * plus a checksum byte (the bytes' sum mod 256), like WritePrivateProfileStruct.
 */
export function logfontHex(f: { face: string; px: number; weight?: number; italic?: boolean }): string {
  const b = new Uint8Array(60);
  const dv = new DataView(b.buffer);
  dv.setInt32(0, -Math.max(1, Math.round(f.px)), true);
  dv.setInt32(16, f.weight ?? 400, true);
  b.set([f.italic ? 1 : 0, 0, 0, 0, 3, 2, 1, 2], 20); // italic, underline, strikeout, charset, precision, clip, quality, pitch (as Default 7)
  b.set(Buffer.from(f.face, "latin1").subarray(0, 31), 28);
  const sum = b.reduce((a, x) => (a + x) & 255, 0);
  return [...b, sum].map((x) => x.toString(16).toUpperCase().padStart(2, "0")).join("");
}

/** The [REAPER] font lines a kit's faces set (WALTER slot N is user_font<N-1>; +5 / +10 are its 150 / 200 % twins). */
export function themeFontLines(faces: KitFaces | undefined, mac = platform() === "darwin"): Record<string, string> {
  const out: Record<string, string> = {};
  if (!faces) return out;
  const hex = (f: FontFace, scale = 1) => logfontHex({ face: mac && f.mac ? f.mac : f.face, px: f.px * scale, weight: f.weight, italic: f.italic });
  for (const [slot, f] of Object.entries(faces.slots ?? {})) {
    const n = Number(slot);
    if (!f || !(n >= 1 && n <= 5)) continue;
    out[`user_font${n - 1}`] = hex(f);
    out[`user_font${n + 4}`] = hex(f, 1.5);
    out[`user_font${n + 9}`] = hex(f, 2);
  }
  const named: [keyof KitFaces, string][] = [["ruler", "tl_font"], ["transport", "trans_font"], ["items", "mi_font"], ["volpan", "lb_font"], ["title", "lb_font2"]];
  for (const [k, key] of named) {
    const f = faces[k] as FontFace | undefined;
    if (f) out[key] = hex(f);
  }
  return out;
}

/** Replace (or add) keys in a .ReaperTheme's [REAPER] section. */
export function setThemeReaperKeys(ini: string, values: Record<string, string>): string {
  const left = new Set(Object.keys(values));
  if (!left.size) return ini;
  const lines = ini.split(/\r?\n/);
  let section = "", end = -1;
  const out = lines.map((line, i) => {
    const s = /^\[(.+)\]\s*$/.exec(line);
    if (s) section = s[1]!;
    if (section === "REAPER" && line.trim()) end = i;
    const m = /^(\w+)=/.exec(line);
    if (section === "REAPER" && m && values[m[1]!] !== undefined) {
      left.delete(m[1]!);
      return `${m[1]}=${values[m[1]!]}`;
    }
    return line;
  });
  if (left.size) {
    const extra = [...left].map((k) => `${k}=${values[k]}`);
    if (end < 0) out.push("[REAPER]", ...extra);
    else out.splice(end + 1, 0, ...extra);
  }
  return out.join("\r\n");
}

/** Build the profile's theme zip from REAPER's default theme zip. */
export function buildThemeZip(baseZip: Uint8Array, w: ReaperSkin, meters: MeterRange = DEFAULT_METER_RANGE): Uint8Array {
  const files = unzipSync(baseZip);
  const base = files[BASE_THEME_FILE];
  if (!base) throw new Error("REAPER's default theme has an unexpected layout, so no theme was made.");
  const light = lightOverlays(w);
  let ini = recolorThemeIni(Buffer.from(base).toString("latin1"), { ...light.colors, ...w.reaper, ...kitIniColors(w) }, { ...light.modes, ...w.reaperModes });
  if (w.kit && !w.colorsOnly) ini = setThemeReaperKeys(ini, themeFontLines(KITS[w.kit].faces));
  const out: Zippable = {};
  if (w.colorsOnly) {
    // REAPER's images, layout and panel settings exactly as they are; only the colour keys differ.
    for (const [name, data] of Object.entries(files)) if (name !== BASE_THEME_FILE) out[name] = [data, { level: 0 }];
    out[themeFileName(w).replace(/Zip$/, "")] = [Buffer.from(ini, "latin1"), { level: 6 }];
    return zipSync(out);
  }
  const map = artMap(w.ui);
  // A kit brings its own layout and artwork; REAPER's images fill in the rest (toolbar icons, items, MIDI…).
  const kit = kitFiles(w, meters);
  const drawn = kit ? kitImageNames(kit) : null;
  const lightKit = Object.keys(light.modes).length > 0;
  const dir = RTCONFIG.replace(/rtconfig\.txt$/, "");
  for (const [name, data] of Object.entries(files)) {
    if (name === BASE_THEME_FILE) continue;
    if (kit && name.startsWith(dir)) {
      const rel = name.slice(dir.length);
      if (kit.has(rel)) continue; // replaced below
      const m = /^(?:(?:150|200)\/)?(.+)_ol\.png$/.exec(rel);
      if (m && drawn!.has(m[1]!)) continue; // REAPER's overlay for a control we redrew
    }
    if (name === RTCONFIG) out[name] = [Buffer.from(recolorRtconfig(Buffer.from(data).toString("latin1"), w.panels, w.ui), "latin1"), { level: 6 }];
    else if (name.toLowerCase().endsWith(".png")) {
      // Buttons, knobs, faders, meters, icons: recoloured to the skin, and reshaped when it has a style.
      let png: Uint8Array = data;
      // On a light kit, REAPER's own insert / send / FX-parameter slots (light, with dark text) already fit.
      const keep = kit && lightKit && /(?:^|\/)(?:mcp|tcp)_(?:fxlist|sendlist|fxparm)_[^/]*\.png$/.test(name);
      try {
        if (!keep) png = skinPng(name, data, map, w.art, w.ui);
      } catch {
        /* an image we can't read stays as REAPER drew it */
      }
      out[name] = [png, { level: 0 }];
    } else out[name] = [data, { level: 0 }];
  }
  if (kit) for (const [rel, bytes] of kit) out[dir + rel] = [bytes, { level: rel.endsWith(".txt") ? 6 : 0 }];
  out[themeFileName(w).replace(/Zip$/, "")] = [Buffer.from(ini, "latin1"), { level: 6 }];
  return zipSync(out);
}

export async function writeTheme(resource: string, w: ReaperSkin): Promise<string> {
  const base = await findDefaultTheme(resource);
  if (!base) throw new Error("REAPER's Default 7 theme wasn't found. Is REAPER 7 installed?");
  const ini = await readFile(join(resource, "reaper.ini"), "latin1").catch(() => "");
  const zip = buildThemeZip(new Uint8Array(await readFile(base)), w, meterRangeFromIni(ini));
  const dir = join(resource, "ColorThemes");
  await mkdir(dir, { recursive: true });
  const target = join(dir, themeFileName(w));
  await writeFile(target + ".tmp", zip);
  await rename(target + ".tmp", target);
  return target;
}

export function keymapText(w: Workflow): string {
  return profileKbLines(w).join("\r\n") + "\r\n";
}

export async function writeKeymap(resource: string, w: Workflow): Promise<string> {
  const dir = join(resource, "KeyMaps");
  await mkdir(dir, { recursive: true });
  const target = join(dir, keymapFileName(w));
  await writeFile(target, keymapText(w));
  return target;
}

/** The id a SCR / ACT line registers ("section id"), or null. */
const regId = (l: string) => {
  const m = /^(?:SCR \d+ (\d+) (\S+)|ACT \d+ (\d+) "([^"]+)")/.exec(l.trim());
  return m ? `${m[1] ?? m[3]} ${m[2] ?? m[4]}` : null;
};

/**
 * Merge lines into reaper-kb.ini text: a KEY line replaces the one with the same modifiers + key +
 * section, a SCR / ACT line the one registering the same id; everything else is kept.
 */
export function mergeKb(existing: string, lines: string[]): string {
  const slot = (l: string) => {
    const m = /^KEY (\d+) (\d+) \S+ (\d+)/.exec(l.trim());
    return m ? `${m[1]} ${m[2]} ${m[3]}` : null;
  };
  const ours = new Set<string | null>(lines.map(slot));
  const ids = new Set<string | null>(lines.map(regId));
  ours.delete(null);
  ids.delete(null);
  const kept = existing.split(/\r?\n/).filter((l) => l.trim() && !ours.has(slot(l)) && !ids.has(regId(l)));
  return [...kept, ...lines].join("\r\n") + "\r\n";
}

/**
 * Merge the profile's shortcuts into reaper-kb.ini, after taking out any other profile's
 * (putting back the user's own keys from `originalKb` where ours had replaced them).
 * Returns the backup path.
 */
export async function installShortcuts(resource: string, w: Workflow, now = new Date(), originalKb: string | null = null): Promise<{ backup: string | null }> {
  const kb = join(resource, "reaper-kb.ini");
  let existing = "";
  let backup: string | null = null;
  try {
    existing = await readFile(kb, "latin1");
    backup = join(resource, `reaper-kb.ini.before-assist-${now.toISOString().slice(0, 19).replace(/[:T]/g, "-")}`);
    await copyFile(kb, backup);
  } catch {
    /* no custom shortcuts yet */
  }
  const merged = mergeKb(restoreKb(existing, originalKb, undefined, true) ?? "", profileKbLines(w));
  await writeFile(kb + ".tmp", merged, "latin1");
  await rename(kb + ".tmp", kb);
  return { backup };
}

/** Point REAPER at the theme for its next start (REAPER closed only). */
export async function setThemeForNextStart(resource: string, themePath: string): Promise<void> {
  const ini = join(resource, "reaper.ini");
  const text = await readFile(ini, "latin1");
  const line = `lastthemefn5=${themePath}`;
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  let next: string;
  if (/^lastthemefn5=.*$/m.test(text)) next = text.replace(/^lastthemefn5=.*$/m, () => line);
  else if (/^\[reaper\][ \t]*$/im.test(text)) next = text.replace(/^\[reaper\][ \t]*$/im, (h) => `${h}${eol}${line}`);
  else throw new Error("Couldn't find REAPER's settings section.");
  // The first backup is kept (it holds the theme from before Assist; Restore uses restore.ts's record).
  await copyFile(ini, `${ini}.before-assist-theme`, constants.COPYFILE_EXCL).catch(() => undefined);
  await writeFile(ini + ".tmp", next, "latin1");
  await rename(ini + ".tmp", ini);
}
