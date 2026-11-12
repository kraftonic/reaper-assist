import type { Workflow } from "../index";
import { atScale } from "./icons";
import { Canvas, bitmap, hstack, png, solid } from "./raster";
import type { Glyph, InkColors, KitDef, ToolbarArt } from "./types";

export type { Glyph };

/**
 * Toolbar icons for a profile's toolbars, drawn from vector glyphs (no copied artwork).
 *
 * REAPER reads custom icons from Data/toolbar_icons/ (+ 150/ and 200/ for HiDPI): a PNG strip of
 * three square frames, normal | mouse-over | pressed or toggled on, 30 / 45 / 60 px high
 * (checked against REAPER 7.82's own icons). The theme's button chrome is drawn underneath,
 * so the background stays transparent.
 */


export interface IconColors {
  normal: string;
  hover: string;
  on: string;
}

/** Every Assist toolbar icon for a profile, drawn the way its kit says (glyphs, ink, full-colour art). */
export function kitToolbarIcons(w: Workflow, kit: KitDef, extraGlyphs: Record<string, Glyph> = {}): Map<string, Uint8Array> {
  return toolbarIconFiles(w, { ...extraGlyphs, ...kit.toolbarGlyphs }, toolbarInk(w, kit.toolbarInk), kit.toolbarInk?.icons, kit.toolbarArt);
}

/** A profile's toolbar ink: its kit's colours, else the panel's dim text | text | accent. */
export function toolbarInk(w: Workflow, ink: InkColors = {}): IconColors {
  return { normal: ink.normal ?? w.panel.textDim, hover: ink.hover ?? w.panel.text, on: ink.on ?? w.panel.accent };
}

const FRAME = 30;
const SCALES: [string, number][] = [["", 1], ["150/", 1.5], ["200/", 2]];

/** One icon at one scale: three frames side by side. */
export function iconStrip(glyph: Glyph, c: IconColors, s: number): Uint8Array {
  const frames = [c.normal, c.hover, c.on].map((col) =>
    atScale(s, () => bitmap(new Canvas(FRAME, FRAME, s).fill(glyph(FRAME / 2, FRAME / 2, 16), solid(col)))),
  );
  return png(hstack(frames));
}

/**
 * Files for every Assist icon ("assist_*") the profile's toolbars use, keyed by their path
 * under Data/toolbar_icons. `glyphs` maps icon name → drawing; `perIcon` overrides `c` for single icons.
 */
export function toolbarIconFiles(w: Workflow, glyphs: Record<string, Glyph>, c: IconColors, perIcon: Record<string, InkColors> = {}, art: Record<string, ToolbarArt> = {}): Map<string, Uint8Array> {
  const out = new Map<string, Uint8Array>();
  const names = new Set((w.toolbars ?? []).flatMap((t) => t.items.map((i) => i.icon)).filter((n): n is string => !!n && /^assist_[\w-]+$/.test(n)));
  for (const name of names) {
    const a = art[name];
    if (a) {
      for (const [dir, s] of SCALES) out.set(`${dir}${name}.png`, png(hstack(([0, 1, 2] as const).map((st) => atScale(s, () => a.draw(st, s))))));
      continue;
    }
    const g = glyphs[name];
    if (!g) throw new Error(`No drawing for toolbar icon ${name} (${w.id})`);
    const p = perIcon[name] ?? {};
    const ci = { normal: p.normal ?? c.normal, hover: p.hover ?? c.hover, on: p.on ?? c.on };
    for (const [dir, s] of SCALES) out.set(`${dir}${name}.png`, iconStrip(g, ci, s));
  }
  return out;
}
