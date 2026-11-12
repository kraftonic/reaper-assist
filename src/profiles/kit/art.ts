import * as I from "./icons";
import {
  arc, bitmap, Canvas, capsule, circle, darken, hstack, intersect, lighten, luma, mixc, outline, poly, rect, rgrad, rrect, solid, vgrad, vstack, withGuides,
  type RGB, type SDF,
} from "./raster";
import type { Draw, Kit, KitDef } from "./types";

/**
 * Every image a kit draws, by REAPER image name. Each entry draws the image at
 * a given scale (1, 1.5, 2). Buttons are 3 frames side by side: normal, hover,
 * pressed.
 *
 * This file holds the drawing primitives and the shared image set; a DAW's
 * KitDef.images hook (daws/<id>.ts) adds or replaces drawings on top.
 *
 * Crispness rules: shapes sit on whole pixels at every scale (sizes are even),
 * borders and highlights are exactly one device pixel, and icon strokes are never
 * thinner than ~1.4 device pixels (icons.atScale).
 */

export type { Draw } from "./types";
export type Frame = 0 | 1 | 2;
export type Glyph = ((cx: number, cy: number) => SDF) | null;

export const WHITE: RGB = [255, 255, 255];
export const BLACK: RGB = [0, 0, 0];
/** A button frame's fill: normal, hover (lighter), pressed (darker). */
export const shade = (c: RGB, f: Frame) => (f === 1 ? lighten(c, 0.07) : f === 2 ? darken(c, 0.1) : c);
/** Ink that reads on a lit fill. */
export const inkOn = (fill: RGB, k: Kit): RGB => (luma(fill) > 0.5 ? k.c.onInk : WHITE);
/** Wrap a drawing so icon strokes use this scale's minimum width. */
export const scaled = (d: Draw): Draw => (s) => I.atScale(s, () => d(s));

/** A button body in the kit's look. Returns the body shape. */
export function body(cv: Canvas, k: Kit, w: number, h: number, fill: RGB, f: Frame, lit: boolean): SDF {
  const px = 1 / cv.s;
  const r = Math.min(k.radius, h / 2);
  if (k.look === "flat") {
    const shape = rrect(0, 0, w, h, r);
    cv.fill(shape, solid(shade(fill, f)));
    cv.fill(outline(shape, px), solid(lit ? darken(fill, 0.3) : darken(k.c.deep, 0.1), lit ? 0.7 : 0.75));
    if (!lit && f !== 2) cv.fill(intersect(outline(rrect(px, px, w - 2 * px, h - 2 * px, r), px), rect(0, 0, w, h * 0.3)), solid(WHITE, 0.05));
    return shape;
  }
  // Gloss: a 1px drop line below, lit-from-above gradient, top highlight, dark rim.
  const shape = rrect(0, 0, w, h - px, r);
  cv.fill(rrect(0, px, w, h - px, r), solid(BLACK, 0.45));
  const base = shade(fill, f);
  const top = f === 2 ? darken(base, 0.04) : lighten(base, lit ? 0.32 : 0.15);
  const bot = f === 2 ? lighten(base, 0.04) : darken(base, lit ? 0.1 : 0.14);
  cv.fill(shape, vgrad(0, h, [[0, top], [0.5, base], [1, bot]]));
  if (f !== 2) cv.fill(intersect(outline(rrect(px, px, w - 2 * px, h - 3 * px, r - px), px), rect(0, 0, w, h * 0.5)), solid(WHITE, lit ? 0.4 : 0.16));
  cv.fill(outline(shape, px), solid(lit ? darken(fill, 0.45) : k.c.deep, 0.95));
  return shape;
}

/** A 3-frame button: body + glyph. */
export function button(k: Kit, w: number, h: number, fill: RGB, glyph: Glyph, ink: RGB, lit = false): Draw {
  return scaled((s) => hstack(([0, 1, 2] as Frame[]).map((f) => {
    const cv = new Canvas(w, h, s);
    body(cv, k, w, h, fill, f, lit);
    if (glyph) {
      const cy = h / 2 - (k.look === "gloss" ? 0.5 / s : 0) + (f === 2 ? 0.5 : 0);
      cv.fill(glyph(w / 2, cy), solid(f === 1 && !lit ? lighten(ink, 0.3) : ink));
    }
    return bitmap(cv);
  })));
}

/** An unlit button (ink on the face colour). */
export const off = (k: Kit, w: number, h: number, g: Glyph, ink = k.c.dim) => button(k, w, h, k.c.face, g, ink);
/** A lit button (fill colour, contrasting ink). */
export const on = (k: Kit, w: number, h: number, fill: RGB, g: Glyph) => button(k, w, h, fill, g, inkOn(fill, k), true);

/** A round LED ("track on" light): lit = track plays, dark = muted. */
export function led(k: Kit, w: number, h: number, lit: boolean): Draw {
  return (s) => hstack(([0, 1, 2] as Frame[]).map((f) => {
    const cv = new Canvas(w, h, s);
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.32;
    const c = k.c.accent2;
    if (lit) cv.shadow(circle(cx, cy, r), c, f === 1 ? 0.75 : 0.55, 2.2);
    cv.fill(circle(cx, cy, r + 1.2), vgrad(cy - r, cy + r, [[0, darken(k.c.deep, 0.3)], [1, lighten(k.c.deep, 0.15)]]));
    const core = lit ? (f === 2 ? darken(c, 0.15) : c) : mixc(k.c.deep, c, f === 1 ? 0.32 : 0.2);
    cv.fill(circle(cx, cy, r), rgrad(cx - r * 0.3, cy - r * 0.35, r * 1.5, lit ? lighten(core, 0.6) : lighten(core, 0.15), core));
    cv.fill(circle(cx - r * 0.28, cy - r * 0.34, r * 0.32), solid(WHITE, lit ? 0.6 : 0.14));
    return bitmap(cv);
  }));
}

/** Knob stack: frames top to bottom, value sweeping −135° … +135°. */
export function knob(k: Kit, size: number, bipolar: boolean, frames = 49): Draw {
  const A = Math.PI / 180;
  return scaled((s) => vstack(Array.from({ length: frames }, (_, i) => {
    const a = (-135 + 270 * (i / (frames - 1))) * A;
    const cv = new Canvas(size, size, s);
    const c = size / 2, R = size / 2 - 0.6;
    const from = bipolar ? 0 : -135 * A;
    const t = Math.max(size * 0.07, 0.75 / s);
    const ra = R - t;
    if (k.look === "flat") {
      // An open dark ring, the value as a coloured arc on it, and a pointer from the centre.
      // Bipolar knobs leave room above the ring for a centre marker: an outlined triangle at
      // the centre, filled with the value colour when off-centre.
      const ring = mixc(k.c.text, k.c.face, 0.12);
      const val = k.c.knob ?? k.c.accent;
      const tri = bipolar ? Math.max(3, size * 0.15) : 0;
      const cy = c + tri / 2, rr = ra - tri / 2;
      cv.fill(arc(c, cy, rr, -135 * A, 135 * A, t), solid(ring));
      if (Math.abs(a - from) > 0.02) cv.fill(arc(c, cy, rr, Math.min(from, a), Math.max(from, a), t * 1.25), solid(val));
      if (bipolar) {
        const mark = poly([[c - tri * 0.8, 0.3], [c + tri * 0.8, 0.3], [c, tri + 0.3]]);
        if (Math.abs(a) > 0.02) cv.fill(mark, solid(val));
        else cv.fill(outline(mark, Math.max(1 / s, 0.75)), solid(mixc(ring, k.c.face, 0.35)));
      }
      const n1 = rr - t * 0.5;
      cv.fill(capsule(c, cy, c + Math.sin(a) * n1, cy - Math.cos(a) * n1, Math.max(t * 0.6, 0.7 / s)), solid(ring));
      return bitmap(cv);
    }
    cv.fill(arc(c, c, ra, -135 * A, 135 * A, t), solid(darken(k.c.deep, 0.2)));
    if (Math.abs(a - from) > 0.02) cv.fill(arc(c, c, ra, Math.min(from, a), Math.max(from, a), t), solid(k.c.accent));
    const br = ra - t * 2.6;
    cv.fill(circle(c, c + 0.6, br), solid(BLACK, 0.5));
    cv.fill(circle(c, c, br), vgrad(c - br, c + br, [[0, lighten(k.c.face, 0.32)], [0.5, k.c.face], [1, darken(k.c.face, 0.32)]]));
    cv.fill(outline(circle(c, c, br), 1 / s), solid(k.c.deep));
    cv.fill(circle(c, c, br * 0.7), vgrad(c - br, c + br, [[0, darken(k.c.face, 0.08)], [1, lighten(k.c.face, 0.1)]]));
    cv.fill(capsule(c + Math.sin(a) * br * 0.25, c - Math.cos(a) * br * 0.25, c + Math.sin(a) * br * 0.85, c - Math.cos(a) * br * 0.85, Math.max(size * 0.05, 0.7 / s)), solid(WHITE));
    return bitmap(cv);
  })));
}

/** Horizontal fader track (stretchable). */
export function hTrack(k: Kit, h: number): Draw {
  return (s) => {
    const w = 40, px = 1 / s;
    const cv = new Canvas(w, h, s);
    const t = k.look === "flat" ? 2 : 4;
    const y = Math.round((h / 2 - t / 2) * s) / s;
    const groove = rrect(2, y, w - 4, t, k.look === "flat" ? 0 : t / 2);
    cv.fill(groove, solid(k.look === "flat" ? darken(k.c.track, 0.45) : darken(k.c.deep, 0.2)));
    if (k.look === "gloss") cv.fill(rect(2 + t / 2, y + t, w - 4 - t, px), solid(WHITE, 0.1));
    const g = Math.round(6 * s);
    return withGuides(bitmap(cv), g, 0, g, 0);
  };
}

/** Vertical fader track (stretchable). */
export function vTrack(k: Kit, w: number): Draw {
  return (s) => {
    const h = 40, px = 1 / s;
    const cv = new Canvas(w, h, s);
    const t = k.look === "flat" ? 2 : 6;
    const x = Math.round((w / 2 - t / 2) * s) / s;
    const groove = rrect(x, 4, t, h - 8, k.look === "flat" ? 0 : t / 2);
    cv.fill(groove, solid(k.look === "flat" ? darken(k.c.panel, 0.5) : darken(k.c.deep, 0.25)));
    if (k.look === "gloss") cv.fill(rect(x + t, 4 + t / 2, px, h - 8 - t), solid(WHITE, 0.1));
    const b = bitmap(cv);
    const g = Math.round(8 * s);
    const half = Math.floor(b.width / 2) - 1;
    return withGuides(b, half, g, half, g);
  };
}

/** Fader cap. vertical = mixer fader (wide and short). */
export function thumb(k: Kit, w: number, h: number, vertical: boolean): Draw {
  return (s) => {
    const cv = new Canvas(w, h, s);
    const px = 1 / s;
    if (k.look === "flat") {
      const shape = rect(0, 0, w, h);
      cv.fill(shape, solid(lighten(k.c.dim, 0.35)));
      cv.fill(outline(shape, px), solid(k.c.deep, 0.9));
      cv.fill(vertical ? rect(3, h / 2 - px / 2, w - 6, px) : rect(w / 2 - px / 2, 3, px, h - 6), solid(k.c.deep));
      return bitmap(cv);
    }
    const shape = rrect(0, 0, w, h - px, 2);
    cv.fill(rrect(0, px, w, h - px, 2), solid(BLACK, 0.5));
    cv.fill(shape, vertical
      ? vgrad(0, h, [[0, lighten(k.c.text, 0.15)], [0.46, mixc(k.c.text, k.c.face, 0.4)], [0.54, darken(k.c.face, 0.05)], [1, mixc(k.c.text, k.c.face, 0.55)]])
      : vgrad(0, h, [[0, lighten(k.c.text, 0.1)], [1, mixc(k.c.text, k.c.face, 0.65)]]));
    cv.fill(outline(shape, px), solid(k.c.deep));
    if (vertical) {
      for (const dy of [-3, 3]) cv.fill(rect(4, Math.round((h / 2 + dy) * s) / s, w - 8, px), solid(k.c.deep, 0.4));
      cv.fill(rect(3, Math.round((h / 2 - 1) * s) / s, w - 6, Math.max(px, 1.4)), solid(k.c.accent));
    } else cv.fill(rect(Math.round((w / 2 - 0.7) * s) / s, 3, Math.max(px, 1.4), h - 6), solid(k.c.accent));
    return bitmap(cv);
  };
}

/** A volume marker: a light triangle with a dark edge, pointing right at the meter. */
export function marker(k: Kit, w: number, h: number): Draw {
  return scaled((s) => {
    const cv = new Canvas(w, h, s);
    const px = 1 / s;
    const tri = poly([[0.5, 0.5], [w - 0.5, h / 2], [0.5, h - 0.5]]);
    cv.fill(tri, solid(lighten(k.c.face, 0.45)));
    cv.fill(outline(tri, Math.max(px, 0.9)), solid(k.c.deep));
    return bitmap(cv);
  });
}

/** dB scale beside the mixer meter: one image per mark ("" = a short tick with no number). */
export const SCALE_W = 16, SCALE_H = 9;
export const SCALE_MARKS: [string, string][] = [["k_sc_p6", "6"], ["k_sc_0", "0"], ["k_sc_6", "6"], ["k_sc_12", "12"], ["k_sc_18", "18"], ["k_sc_24", "24"], ["k_sc_36", "36"], ["k_sc_48", "48"], ["k_sc_tick", ""]];

export function scaleMark(k: Kit, label: string): Draw {
  return scaled((s) => {
    const cv = new Canvas(SCALE_W, SCALE_H, s);
    const px = 1 / s;
    const y = Math.round((SCALE_H / 2 - px / 2) * s) / s;
    cv.fill(rect(0, y, label ? 3 : 2, px), solid(mixc(k.c.text, k.c.panel, 0.3)));
    if (label) {
      const u = 6, wd = I.textWidth(label, u, 0.15, 0.06);
      cv.fill(I.text(label, SCALE_W - 0.5 - wd / 2, SCALE_H / 2, u, 0.15, 0.06), solid(k.c.text, 0.9));
    }
    return bitmap(cv);
  });
}

/** Panel background with a 1px top highlight and a divider (stretchable). */
export function panel(k: Kit, fill: RGB, divider: "bottom" | "right", lift = 0.04): Draw {
  return (s) => {
    const w = 24, h = 24, px = 1 / s;
    const cv = new Canvas(w, h, s);
    cv.fill(rect(0, 0, w, h), k.look === "gloss" ? vgrad(0, h, [[0, lighten(fill, lift)], [1, darken(fill, 0.04)]]) : solid(fill));
    if (divider === "bottom") {
      cv.fill(rect(0, 0, w, px), solid(WHITE, k.look === "gloss" ? 0.07 : 0.045));
      cv.fill(rect(0, h - px, w, px), solid(darken(k.c.deep, 0.2)));
    } else {
      cv.fill(rect(0, 0, px, h), solid(WHITE, 0.035));
      cv.fill(rect(w - px, 0, px, h), solid(darken(k.c.deep, 0.2)));
    }
    return withGuides(bitmap(cv), 2, 2, 2, 2);
  };
}

/** A display / text-field background (stretchable). */
export function display(k: Kit, fill: RGB, r: number): Draw {
  return (s) => {
    const w = 24, h = 20, px = 1 / s;
    const cv = new Canvas(w, h, s);
    const shape = rrect(0, 0, w, h, r);
    cv.fill(shape, solid(fill));
    if (k.look === "gloss") cv.fill(intersect(outline(rrect(px, px, w - 2 * px, h - 2 * px, r), px), rect(0, 0, w, h / 2)), solid(BLACK, 0.4));
    cv.fill(outline(shape, px), solid(k.look === "gloss" ? lighten(k.c.deep, 0.06) : darken(k.c.deep, 0.15)));
    if (k.look === "gloss") cv.fill(intersect(outline(shape, px), rect(0, h / 2, w, h)), solid(WHITE, 0.07));
    const g = Math.ceil((r + 2) * s);
    return withGuides(bitmap(cv), g, g, g, g);
  };
}

/** A transparent frame laid over a colour-filled box (track name boxes). */
export function boxFrame(k: Kit): Draw {
  return (s) => {
    const w = 12, h = 12, px = 1 / s;
    const cv = new Canvas(w, h, s);
    cv.fill(outline(rect(0, 0, w, h), px), solid(darken(k.c.deep, 0.1), 0.7));
    cv.fill(rect(px, px, w - 2 * px, px), solid(WHITE, 0.12));
    return withGuides(bitmap(cv), 2, 2, 2, 2);
  };
}

/** Rounded name plate (stretchable). */
export function namePlate(k: Kit, h: number, fill: RGB): Draw {
  return (s) => {
    const w = 30, px = 1 / s;
    const cv = new Canvas(w, h, s);
    const r = k.look === "gloss" ? 4 : 0;
    const shape = rrect(0, 0, w, h - (k.look === "gloss" ? px : 0), r);
    if (k.look === "gloss") cv.fill(rrect(0, px, w, h - px, r), solid(BLACK, 0.4));
    cv.fill(shape, k.look === "gloss" ? vgrad(0, h, [[0, lighten(fill, 0.1)], [1, darken(fill, 0.08)]]) : solid(fill));
    if (k.look === "gloss") cv.fill(intersect(outline(rrect(px, px, w - 2 * px, h - 3 * px, r), px), rect(0, 0, w, h * 0.45)), solid(WHITE, 0.12));
    cv.fill(outline(shape, px), solid(k.c.deep));
    const g = Math.ceil((r + 2) * s);
    return withGuides(bitmap(cv), g, g, g, g);
  };
}

/** A solid stretchable fill (transparent allowed). */
export const fillImg = (c: RGB, a: number): Draw => (s) => {
  const cv = new Canvas(6, 6, s);
  if (a > 0) cv.fill(rect(0, 0, 6, 6), solid(c, a));
  return bitmap(cv);
};

/** Device-pixel images that must keep their exact size at every scale (meter colour maps). */
export const exact = (w: number, h: number, paint: (x: number, y: number) => RGB): Draw => () => {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set([...paint(x, y), 255], (y * w + x) * 4);
  return { width: w, height: h, data };
};

/**
 * Meter colour maps, as REAPER reads them (checked in REAPER 7.8): 8 slots of 4px, each an
 * (unlit, lit) pair. Pair 1 is normal playback and pair 3 record-armed; pairs 2 and 4 weren't
 * seen in testing, so they get the normal and clip colours. Row 0 is the colour at the
 * top of the meter and row 1 at the bottom; REAPER blends between them along the meter.
 * (The thin MIDI activity bar takes col_vumidi from the colour theme instead.)
 */
export function meterRows(k: Kit, rms: boolean): [RGB[], RGB[]] {
  const m = k.c.meter;
  const lit = (c: RGB) => (rms ? mixc(c, m.off, 0.35) : c);
  const armOff = mixc(m.off, k.c.arm, 0.12);
  const top = [m.off, lit(m.high), m.off, lit(m.high), armOff, lit(mixc(k.c.arm, m.high, 0.5)), m.off, lit(m.clip)];
  const bottom = [m.off, lit(m.low), m.off, lit(m.low), armOff, lit(mixc(k.c.arm, m.off, 0.15)), m.off, lit(m.clip)];
  return [top, bottom];
}

/**
 * The MIDI editor's note colours, laid out as REAPER's own map (read from Default 7's
 * midi_note_colormap.png): 157 columns = 12 pitch classes, velocities 0–127, one default,
 * then 16 channels; rows 0–63 unselected fill, 64 its edge, 65–128 selected fill, 129 its edge.
 * Velocity shades each note from mostly-background (soft) to full colour (hard), as Live does.
 */
export function noteColormap(n: NonNullable<Kit["c"]["notes"]>): Draw {
  const hue = (i: number, count: number, l: number): RGB => {
    const h = (i / count) * 6, c = 0.62 * (1 - Math.abs(2 * l - 1)), x = c * (1 - Math.abs((h % 2) - 1)), m = l - c / 2;
    const [r, g, b] = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
  };
  const column = (x: number, sel: boolean): RGB => {
    if (x < 12) return hue(x, 12, sel ? 0.62 : 0.36);
    if (x < 140) return mixc(n.bg, sel ? n.on : n.off, 0.2 + 0.8 * ((x - 12) / 127));
    if (x === 140) return sel ? n.on : n.off;
    return hue(x - 141, 16, sel ? 0.62 : 0.36);
  };
  return exact(157, 130, (x, y) => {
    const sel = y >= 65;
    const fillc = column(x, sel);
    return y === 64 || y === 129 ? darken(fillc, 0.55) : fillc;
  });
}

/** Toolbar button: transparent at rest, a soft plate on hover, lit when toggled on. */
export function tool(k: Kit, z: number, glyph: (cx: number, cy: number, u: number) => SDF, lit: boolean): Draw {
  return scaled((s) => hstack(([0, 1, 2] as Frame[]).map((f) => {
    const cv = new Canvas(z, z, s);
    const px = 1 / s;
    const plate = rrect(3, 3, z - 6, z - 6, k.look === "gloss" ? 4 : 2);
    let ink = f === 1 ? k.c.text : k.c.dim;
    if (lit) {
      if (k.look === "flat") {
        cv.fill(plate, solid(shade(k.c.accent, f)));
        ink = k.c.onInk;
      } else {
        cv.fill(plate, solid(darken(k.c.deep, 0.3), 0.9));
        cv.fill(outline(plate, px), solid(darken(k.c.accent, 0.35)));
        cv.shadow(glyph(z / 2, z / 2, 16), k.c.accent, 0.45, 2);
        ink = lighten(k.c.accent, f === 1 ? 0.2 : 0);
      }
    } else if (f > 0) {
      cv.fill(plate, solid(f === 1 ? k.c.face : darken(k.c.face, 0.2), 0.7));
    }
    cv.fill(glyph(z / 2, z / 2 + (f === 2 ? 0.5 : 0), 16), solid(ink));
    return bitmap(cv);
  })));
}

export const word = (l: string, u: number): Glyph => (cx, cy) => I.text(l, cx, cy, u);
export const icon = (f: (cx: number, cy: number, u: number) => SDF, u: number): Glyph => (cx, cy) => f(cx, cy, u);

/**
 * All images for a kit, keys are REAPER image names (no extension): the shared set,
 * then the kit's own images hook on top.
 */
export function drawImages(def: KitDef, k: Kit): Record<string, Draw> {
  const z = def.sizes;
  const c = k.c;
  const out: Record<string, Draw> = {};
  // The same drawing under a second name. Re-linked after the kit's hook, so replacing the source carries over.
  const aliases: [name: string, src: string, was: Draw][] = [];
  const alias = (name: string, src: string) => aliases.push([name, src, (out[name] = out[src]!)]);

  // Track ("track_") and mixer ("mcp_") buttons.
  const set = (prefix: "track" | "mcp", mute: [number, number], btn: [number, number], arm: [number, number], mon: [number, number], small: [number, number], fx: [number, number]) => {
    const [mw, mh] = mute, [bw, bh] = btn, [aw, ah] = arm, [sw, sh] = small, [fw, fh] = fx;
    const L = Math.round(bh * 0.5); // letter height
    out[`${prefix}_mute_off`] = on(k, mw, mh, c.accent, icon(I.speaker, mh * 0.56));
    out[`${prefix}_mute_on`] = off(k, mw, mh, icon((x, y, u) => I.speaker(x, y, u, 0), mh * 0.56));
    out[`${prefix}_solo_off`] = off(k, bw, bh, word("S", L));
    out[`${prefix}_solo_on`] = on(k, bw, bh, c.solo, word("S", L));
    const rec = icon(I.record, ah * 0.46);
    const recRing: Glyph = (cx, cy) => outline(I.record(cx, cy, ah * 0.5), Math.max(ah * 0.08, 1.2));
    out[`${prefix}_recarm_off`] = off(k, aw, ah, rec);
    out[`${prefix}_recarm_on`] = on(k, aw, ah, c.arm, rec);
    out[`${prefix}_recarm_norec`] = on(k, aw, ah, darken(c.arm, 0.35), rec);
    out[`${prefix}_recarm_auto`] = off(k, aw, ah, recRing, c.arm);
    out[`${prefix}_recarm_auto_on`] = on(k, aw, ah, mixc(c.arm, c.face, 0.25), recRing);
    out[`${prefix}_recarm_auto_norec`] = on(k, aw, ah, darken(c.arm, 0.45), recRing);
    const phones = icon(I.headphones, mon[1] * 0.62);
    out[`${prefix}_monitor_off`] = off(k, mon[0], mon[1], phones);
    // Monitoring is on by default in REAPER, so "on" is coloured ink rather than a lit fill.
    out[`${prefix}_monitor_on`] = off(k, mon[0], mon[1], phones, c.accent);
    out[`${prefix}_monitor_auto`] = off(k, mon[0], mon[1], phones, mixc(c.accent, c.text, 0.55));
    const fxw = word("FX", Math.round(fh * 0.46));
    out[`${prefix}_fx_norm`] = off(k, fw, fh, fxw, c.text);
    out[`${prefix}_fx_empty`] = off(k, fw, fh, fxw, mixc(c.dim, c.face, 0.3));
    out[`${prefix}_fx_dis`] = on(k, fw, fh, darken(c.arm, 0.15), fxw);
    const io = word("IO", Math.round(sh * 0.44));
    for (const sfx of ["", "_r", "_s", "_s_r"]) {
      out[`${prefix}_io${sfx}`] = off(k, sw, sh, io, sfx ? c.text : c.dim);
      out[`${prefix}_io${sfx}_dis`] = off(k, sw, sh, io, c.arm);
    }
    const env = icon(I.envelope, sh * 0.52);
    const envName = prefix === "track" ? "track_env" : "mcp_env";
    out[envName] = off(k, sw, sh, env);
    (["read", "touch", "write", "latch", "preview"] as const).forEach((m, i) => (out[`${envName}_${m}`] = on(k, sw, sh, c.env[i]!, env)));
    out[`${prefix}_phase_norm`] = off(k, sw, sh, icon(I.phase, sh * 0.56));
    out[`${prefix}_phase_inv`] = on(k, sw, sh, c.accent, icon(I.phase, sh * 0.56));
    out[`${prefix}_recmode_in`] = off(k, sw, sh, icon(I.arrowIn, sh * 0.52), c.text);
    out[`${prefix}_recmode_out`] = on(k, sw, sh, c.accent, icon(I.arrowOut, sh * 0.52));
    out[`${prefix}_recmode_off`] = off(k, sw, sh, icon(I.dot, sh * 0.52));
    out[`${prefix}_stereo`] = off(k, bw, bh, icon(I.stereo, bh * 0.5));
    out[`${prefix}_mono`] = on(k, bw, bh, c.accent, (cx, cy) => circle(cx, cy, bh * 0.2));
  };
  set("track", z.tcpMute, z.tcpBtn, z.tcpBtn, z.tcpSmall, z.tcpSmall, z.tcpFx);
  set("mcp", z.mcpMute, z.mcpBtn, z.mcpArm, z.mcpMon, z.mcpSmall, z.mcpSmall);

  const [sw, sh] = z.tcpSmall;
  out.track_folder_off = off(k, sw, sh, icon(I.folder, sh * 0.5));
  out.track_folder_on = on(k, sw, sh, c.accent, icon((x, y, u) => I.folder(x, y, u, true), sh * 0.5));
  out.track_folder_last = off(k, sw, sh, icon((x, y, u) => I.chevron(x, y, u, -1), sh * 0.5), c.accent);
  out.track_fcomp_off = off(k, sw, sh, icon((x, y, u) => I.chevron(x, y, u, 1), sh * 0.45));
  out.track_fcomp_small = off(k, sw, sh, icon((x, y, u) => I.chevron(x, y, u, -1), sh * 0.45), c.text);
  out.track_fcomp_tiny = on(k, sw, sh, c.accent, icon((x, y, u) => I.chevron(x, y, u, -1), sh * 0.45));
  alias("mcp_folder_on", "track_folder_on");
  alias("mcp_folder_last", "track_folder_last");
  alias("mcp_fcomp_off", "track_fcomp_off");
  alias("mcp_fcomp_tiny", "track_fcomp_tiny");
  for (const o of ["h", "v"] as const) {
    out[`track_fxon_${o}`] = on(k, 14, sh, c.accent2, icon(I.power, sh * 0.5));
    out[`track_fxoff_${o}`] = off(k, 14, sh, icon(I.power, sh * 0.5), c.arm);
    out[`track_fxempty_${o}`] = off(k, 14, sh, icon(I.power, sh * 0.5), mixc(c.dim, c.face, 0.4));
  }
  out.master_tcp_io = off(k, sw, sh, word("IO", Math.round(sh * 0.44)), c.text);
  out.master_mcp_io = off(k, z.mcpSmall[0], z.mcpSmall[1], word("IO", Math.round(z.mcpSmall[1] * 0.44)), c.text);
  out.mixer_menu = off(k, z.menu[0], z.menu[1], icon(I.menu, z.menu[1] * 0.5), c.text);

  // Knobs and faders. REAPER draws a "knob background" under knobs when one exists; ours are complete, so blank those.
  out.tcp_vol_knob_stack = knob(k, z.tcpKnob, false);
  out.tcp_pan_knob_stack = knob(k, z.tcpKnob, true);
  out.tcp_wid_knob_stack = knob(k, z.tcpKnob, true);
  out.mcp_vol_knob_stack = knob(k, z.mcpKnob, false);
  out.mcp_pan_knob_stack = knob(k, z.mcpKnob, true);
  out.mcp_wid_knob_stack = knob(k, z.mcpKnob, true);
  out.envcp_knob_stack = knob(k, z.envKnob, false);
  out.knob_stack = knob(k, 20, false);
  const none = fillImg(c.panel, 0);
  for (const ctx of ["tcp", "mcp"]) for (const p of ["pan", "vol", "width"]) for (const sz of ["small", "large"]) out[`${ctx}_${p}_knob_${sz}`] = none;
  for (const n of ["gen_knob_bg_small", "gen_knob_bg_large", "envcp_knob_small", "envcp_knob_large", "transport_knob_bg_small", "transport_knob_bg_large"]) out[n] = none;
  out.tcp_volbg = hTrack(k, z.tcpThumb[1]);
  alias("tcp_panbg", "tcp_volbg");
  alias("tcp_widthbg", "tcp_volbg");
  out.tcp_volthumb = thumb(k, z.tcpThumb[0], z.tcpThumb[1], false);
  alias("tcp_panthumb", "tcp_volthumb");
  alias("tcp_widththumb", "tcp_volthumb");
  alias("envcp_faderbg", "tcp_volbg");
  alias("envcp_fader", "tcp_volthumb");
  out.mcp_volbg = vTrack(k, z.mcpFaderW);
  out.mcp_volthumb = thumb(k, z.mcpThumb[0], z.mcpThumb[1], true);
  alias("mcp_master_volbg", "mcp_volbg");
  alias("mcp_master_volthumb", "mcp_volthumb");

  // Meters.
  const pk = meterRows(k, false), rms = meterRows(k, true);
  out.meter_strip_v = exact(32, 2, (x, y) => pk[y]![x >> 2]!);
  // Horizontal meters run the other way: column 0 is the low (left) end.
  out.meter_strip_h = exact(2, 32, (x, y) => pk[1 - x]![y >> 2]!);
  out.meter_strip_v_rms = exact(32, 2, (x, y) => rms[y]![x >> 2]!);
  out.meter_strip_h_rms = exact(2, 32, (x, y) => rms[1 - x]![y >> 2]!);
  out.meter_bg_v = exact(6, 6, () => c.meter.off);
  out.meter_bg_h = exact(6, 6, () => c.meter.off);
  out.meter_clip_v = exact(4, 8, (_x, y) => (y < 4 ? mixc(c.meter.off, c.meter.clip, 0.12) : c.meter.clip));
  out.meter_clip_h = exact(8, 4, (x) => (x < 4 ? mixc(c.meter.off, c.meter.clip, 0.12) : c.meter.clip));

  // Envelope lane buttons.
  const [ew, eh] = z.envBtn;
  out.envcp_arm_off = off(k, ew, eh, icon(I.record, eh * 0.42));
  // New envelopes are armed and active, so those states are ink colours, not fills.
  out.envcp_arm_on = off(k, ew, eh, icon(I.record, eh * 0.42), c.arm);
  out.envcp_bypass_on = off(k, ew, eh, icon(I.power, eh * 0.52), mixc(c.dim, c.face, 0.45)); // envelope switched off
  out.envcp_bypass_off = off(k, ew, eh, icon(I.power, eh * 0.52), c.accent2);
  out.envcp_hide = off(k, ew, eh, icon(I.cross, eh * 0.5));
  out.envcp_learn = off(k, ew, eh, word("L", Math.round(eh * 0.48)));
  out.envcp_learn_on = on(k, ew, eh, c.accent, word("L", Math.round(eh * 0.48)));
  out.envcp_parammod = off(k, ew, eh, icon(I.wave, eh * 0.52));
  out.envcp_parammod_on = on(k, ew, eh, c.accent, icon(I.wave, eh * 0.52));

  // Transport.
  const [tw, th] = z.trans;
  const tu = th * 0.44;
  const tb = (name: string, g: (cx: number, cy: number, u: number) => SDF, lit?: RGB, ink?: RGB) => {
    out[name] = lit ? on(k, tw, th, lit, icon(g, tu)) : off(k, tw, th, icon(g, tu), ink ?? c.text);
  };
  tb("transport_play", I.play);
  tb("transport_play_on", I.play, c.play);
  tb("transport_play_sync", I.play, undefined, c.accent2);
  tb("transport_play_sync_on", I.play, c.accent2);
  tb("transport_stop", I.stop);
  tb("transport_pause", I.pause);
  tb("transport_pause_on", I.pause, c.accent);
  tb("transport_record", I.record, undefined, c.arm);
  tb("transport_record_on", I.record, c.arm);
  tb("transport_record_item", I.record, undefined, mixc(c.arm, c.accent, 0.5));
  tb("transport_record_item_on", I.record, mixc(c.arm, c.accent, 0.5));
  tb("transport_record_loop", I.record, undefined, mixc(c.arm, c.accent2, 0.3));
  tb("transport_record_loop_on", I.record, mixc(c.arm, c.accent2, 0.3));
  tb("transport_repeat_off", I.loop);
  tb("transport_repeat_on", I.loop, c.accent);
  tb("transport_home", (x, y, u) => I.skip(x, y, u, -1));
  tb("transport_end", (x, y, u) => I.skip(x, y, u, 1));
  tb("transport_previous", (x, y, u) => I.skip(x, y, u, -1, false));
  tb("transport_next", (x, y, u) => I.skip(x, y, u, 1, false));

  // The global automation override: an envelope chip in the mode's colour.
  const genv = icon(I.envelope, th * 0.5);
  out.global_off = off(k, tw, th, genv);
  out.global_trim = off(k, tw, th, genv, c.text);
  (["read", "touch", "write", "latch", "preview"] as const).forEach((m, i) => (out[`global_${m}`] = on(k, tw, th, c.env[i]!, genv)));
  out.global_bypass = off(k, tw, th, genv, c.arm);

  // Main toolbar.
  const T = I.tb;
  const pair = (name: string, g: (cx: number, cy: number, u: number) => SDF, gOn = g) => {
    out[`toolbar_${name}_off`] = tool(k, z.toolbar, g, false);
    out[`toolbar_${name}_on`] = tool(k, z.toolbar, gOn, true);
  };
  for (const n of ["new", "save", "load", "projprop", "undo", "redo", "revert", "replacemode", "midi_step", "midi_mode_piano_roll", "midi_mode_named_notes", "midi_mode_event_list", "midi_mode_musical_notation", "blank"]) out[`toolbar_${n}`] = tool(k, z.toolbar, T[n]!, false);
  pair("metro", T.metro!);
  pair("grid", T.grid!);
  pair("snap", T.snap!);
  pair("relsnap", T.relsnap!);
  pair("xfade", T.xfade!);
  pair("envitem", T.envitem!);
  pair("group", T.group!);
  pair("filter", T.filter!);
  pair("dock", T.dock!);
  pair("quant", T.quant!);
  pair("midi_itemsel", T.midi_itemsel!);
  pair("midi_tracksel", T.midi_tracksel!);
  out.toolbar_lock_off = tool(k, z.toolbar, T.lock_off!, false);
  out.toolbar_lock_on = tool(k, z.toolbar, T.lock!, true);
  out.toolbar_ripple_off = tool(k, z.toolbar, T.ripple_off!, false);
  out.toolbar_ripple_one = tool(k, z.toolbar, T.ripple_one!, true);
  out.toolbar_ripple_all = tool(k, z.toolbar, T.ripple_all!, true);

  // Panels, fields, name boxes.
  out.tcp_bg = panel(k, c.track, "bottom");
  out.tcp_bgsel = panel(k, c.trackSel, "bottom", 0.08);
  alias("tcp_mainbg", "tcp_bg");
  alias("tcp_mainbgsel", "tcp_bgsel");
  alias("tcp_folderbg", "tcp_bg");
  alias("tcp_folderbgsel", "tcp_bgsel");
  out.envcp_bg = panel(k, mixc(c.track, c.bg, 0.45), "bottom");
  out.envcp_bgsel = panel(k, mixc(c.trackSel, c.bg, 0.3), "bottom");
  out.mcp_bg = panel(k, c.panel, "right");
  out.mcp_bgsel = panel(k, lighten(c.panel, 0.07), "right", 0.06);
  alias("mcp_mainbg", "mcp_bg");
  alias("mcp_mainbgsel", "mcp_bgsel");
  alias("mcp_folderbg", "mcp_bg");
  alias("mcp_folderbgsel", "mcp_bgsel");
  if (k.c.notes) out.midi_note_colormap = noteColormap(k.c.notes);
  out.mcp_extmixbg = fillImg(darken(c.panel, k.look === "flat" && luma(c.panel) > 0.5 ? 0.05 : 0.2), 1);
  const dr = k.look === "gloss" ? 3 : 0;
  out.transport_bg = panel(k, c.panel, "bottom", 0.06);
  out.transport_status_bg = display(k, c.display, dr);
  out.transport_status_bg_err = display(k, mixc(c.display, c.arm, 0.35), dr);
  out.transport_edit_bg = display(k, c.display, dr);
  out.transport_bpm_bg = display(k, c.display, dr);
  out.transport_group_bg = k.look === "gloss" ? display(k, darken(c.panel, 0.3), 5) : none;
  out.tcp_recinput = display(k, darken(c.track, 0.32), dr);
  out.mcp_recinput = display(k, darken(c.panel, 0.32), dr);
  out.k_box = boxFrame(k);
  out.k_display = display(k, c.display, dr);
  out.k_nameplate = namePlate(k, 20, lighten(c.track, 0.07));
  out.k_nameplate_mcp = namePlate(k, 20, darken(c.panel, 0.15));

  // REAPER's clip-properties badge (a blue "i" on clips whose take has non-default properties; not an
  // itemicons bit): none of the DAWs has one, so it's clear unless a kit draws its own.
  for (const n of ["item_props", "item_props_on"]) out[n] = (s) => bitmap(new Canvas(42, 14, s));
  for (const n of ["item_props_hidpi", "item_props_on_hidpi"]) out[n] = (s) => bitmap(new Canvas(84, 28, s));
  // The dot REAPER puts on selected clips: none of the DAWs has one either.
  out.item_seldot = (s) => bitmap(new Canvas(6, 6, s));

  def.images?.(k, out);
  for (const [name, src, was] of aliases) if (out[name] === was) out[name] = out[src]!;
  return out;
}
