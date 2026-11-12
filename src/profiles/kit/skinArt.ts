import { PNG } from "pngjs";
import type { ArtStyle, SkinUi } from "../skins";
import { drawKnobStack, hexRgb, restyleButtons, restyleThumb } from "./skinStyle";

/**
 * Recolours REAPER Default 7 theme artwork (buttons, knobs, faders, meters,
 * toolbar and transport icons, panel backgrounds) to a skin's palette.
 *
 *  - Greys are gradient-mapped: Default 7's dark-to-light grey ladder becomes
 *    the skin's border → background → panel → text ladder. Light skins invert
 *    naturally (dark glyphs on light buttons).
 *  - Default 7's teal "on" colour (FX on, selected, armed-for-automation) becomes
 *    the skin's accent.
 *  - Other colours (red record-arm, yellow solo, blue, orange) are kept so
 *    states stay recognisable.
 *  - REAPER's layout guide pixels (pure magenta and pure yellow) are never touched.
 */

type RGB = [number, number, number];

const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const lerp = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mixHex = (a: string, b: string, t: number) => lerp(hex(a), hex(b), t);

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): RGB {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    t = (t + 1) % 1;
    return 255 * (t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p);
  };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
}

export interface ArtMap {
  /** Greyscale lightness (0..1) → colour. */
  stops: [number, RGB][];
  accentHue: number;
  accentSat: number;
  /** Lightness shift for accent-coloured pixels (light skins need darker accents). */
  accentL: number;
}

/** Default 7's grey ladder (by lightness) mapped onto the skin's palette. */
export function artMap(u: SkinUi): ArtMap {
  const black: RGB = [0, 0, 0];
  const white: RGB = [255, 255, 255];
  const [ah, as, al] = rgbToHsl(...hex(u.accent));
  return {
    stops: [
      [0.0, lerp(hex(u.border), black, 0.5)],
      [0.12, hex(u.border)],
      [0.2, hex(u.bg)],
      [0.26, hex(u.panel)],
      [0.34, hex(u.panelAlt)],
      [0.5, mixHex(u.panelAlt, u.textDim, 0.5)],
      [0.62, hex(u.textDim)],
      [0.85, hex(u.text)],
      [1.0, lerp(hex(u.text), rgbToHsl(...hex(u.text))[2] > 0.5 ? white : black, 0.5)],
    ],
    accentHue: ah,
    accentSat: Math.max(as, 0.35),
    accentL: al - 0.5,
  };
}

function grey(map: ArtMap, l: number): RGB {
  const s = map.stops;
  if (l <= s[0]![0]) return s[0]![1];
  for (let i = 1; i < s.length; i++) {
    const [l1, c1] = s[i]!;
    const [l0, c0] = s[i - 1]!;
    if (l <= l1) return lerp(c0, c1, (l - l0) / (l1 - l0));
  }
  return s[s.length - 1]![1];
}

/** Recolour RGBA pixels in place. */
export function recolorPixels(data: Uint8Array, map: ArtMap): void {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!, a = data[i + 3]!;
    if (a === 0) continue;
    if (r === 255 && b === 255 && g === 0) continue; // layout guides
    if (r === 255 && g === 255 && b === 0) continue;
    const [h, s, l] = rgbToHsl(r, g, b);
    let out: RGB;
    if (s < 0.2 || l < 0.06 || l > 0.97) {
      // Grey (or nearly): keep a hint of its original tint by blending 10% of the source back in.
      out = lerp(grey(map, l), [r, g, b], 0.1 * s);
    } else if (h >= 140 && h <= 200) {
      // Default 7's teal "on" colour → the skin's accent.
      out = hslToRgb(map.accentHue, Math.min(1, s * (map.accentSat / 0.5)), Math.min(0.95, Math.max(0.05, l + map.accentL * 0.6)));
    } else {
      continue; // red / yellow / orange / blue states stay as they are
    }
    data[i] = Math.round(out[0]);
    data[i + 1] = Math.round(out[1]);
    data[i + 2] = Math.round(out[2]);
  }
}

/** Recolour one PNG file's bytes; returns new PNG bytes. */
export function recolorPng(bytes: Uint8Array, map: ArtMap): Uint8Array {
  return skinPng("", bytes, map);
}

/** What kind of artwork a theme file is, from its name (Default 7 naming). */
export function artKind(path: string): "knob" | "thumb" | "button" | null {
  const n = path.split("/").pop()!.toLowerCase().replace(/\.png$/, "");
  if (/_knob_stack\d*$/.test(n)) return "knob";
  if (/(vol|pan|width)thumb/.test(n)) return "thumb";
  if (!/^(gen|track|mcp|tcp|toolbar|transport|envcp|global|midi|monitor)_/.test(n)) return null;
  if (/(bg|thumb|knob|meter|divider|fxlist|sendlist|fxparm|infoblock|labelblock|selectiondot|idx|folder|fcomp|recinput|pinned)/.test(n)) return null;
  return "button";
}

/** Recolour a PNG and, with a style, redraw its shapes. `path` is the file's path in the theme zip. */
export function skinPng(path: string, bytes: Uint8Array, map: ArtMap, style?: ArtStyle, ui?: SkinUi): Uint8Array {
  const png = PNG.sync.read(Buffer.from(bytes));
  const original = new Uint8Array(png.data);
  recolorPixels(png.data, map);
  const kind = style && ui ? artKind(path) : null;
  if (kind && style && ui) {
    const scale = /(^|\/)200\//.test(path) ? 2 : /(^|\/)150\//.test(path) ? 1.5 : 1;
    const img = { width: png.width, height: png.height, data: png.data };
    const name = path.split("/").pop()!.toLowerCase();
    if (kind === "button") restyleButtons(img, { ...img, data: original }, style, scale);
    else if (kind === "knob") {
      const body = hexRgb(style.surface === "gradient" ? ui.textDim : ui.panelAlt);
      drawKnobStack(img, style, {
        body: style.surface === "glass" ? hexRgb(ui.bg) : body,
        rim: hexRgb(ui.border),
        pointer: hexRgb(style.surface === "gradient" ? ui.accent : ui.text),
        arc: hexRgb(ui.accent),
        track: hexRgb(style.light ? ui.border : ui.bg),
      }, scale, /pan|wid/.test(name));
    } else {
      const cap = hexRgb(style.surface === "glass" ? ui.accent : style.surface === "gradient" ? ui.textDim : ui.text);
      restyleThumb(img, style, cap, hexRgb(style.surface === "gradient" ? ui.border : ui.accent), scale, name.startsWith("mcp_volthumb"));
    }
  }
  return PNG.sync.write(png, { colorType: 6 });
}
