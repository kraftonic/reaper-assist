import { arc, capsule, circle, intersect, poly, polyline, rect, rrect, rpoly, subtract, union, type SDF } from "./raster";

/**
 * Glyphs and icons as shapes, centred on (cx, cy) with size u (base units).
 * Letters are a small geometric stroke font; icons are built from primitives.
 *
 * Strokes never get thinner than ~1.4 device pixels (see atScale), so icons stay
 * crisp at 100% instead of turning into grey smudges.
 */

const D = Math.PI / 180;
let minStroke = 0;

/** Run a drawing at a scale: sets the minimum stroke radius for that scale. */
export function atScale<T>(s: number, f: () => T): T {
  const prev = minStroke;
  minStroke = 0.7 / s; // radius → 1.4 device px wide
  try {
    return f();
  } finally {
    minStroke = prev;
  }
}

/** Stroke radius with the scale's minimum applied. */
const st = (r: number) => Math.max(r, minStroke);

/** Width of `text(str, …, u, weight, spacing)`. */
export function textWidth(str: string, u: number, weight = 0.15, spacing = 0.2): number {
  const r = st((u * weight) / 2);
  const gap = u * spacing + r;
  return [...str].reduce((a, ch) => a + (LETTERS[ch]?.w ?? 0.6) * u, 0) + gap * (str.length - 1);
}

/** A stroke letter (or short word) centred on (cx, cy). */
export function text(str: string, cx: number, cy: number, u: number, weight = 0.15, spacing = 0.2): SDF {
  const r = st((u * weight) / 2);
  const widths = [...str].map((ch) => (LETTERS[ch]?.w ?? 0.6) * u);
  const gap = u * spacing + r;
  const total = textWidth(str, u, weight, spacing);
  let x = cx - total / 2;
  const parts: SDF[] = [];
  [...str].forEach((ch, i) => {
    const L = LETTERS[ch];
    if (L) parts.push(L.draw(x, cy - u / 2, widths[i]!, u, r));
    x += widths[i]! + gap;
  });
  return union(...parts);
}

type Letter = { w: number; draw: (x: number, y: number, w: number, h: number, r: number) => SDF };
const P = (x: number, y: number, w: number, h: number) => (pts: [number, number][]) => pts.map(([a, b]) => [x + a * w, y + b * h] as [number, number]);
const ring = (s: SDF, r: number): SDF => (x, y) => Math.abs(s(x, y)) - r;

/** A digit drawn as one or more polylines in a unit box (x right, y down). */
const digit = (w: number, ...lines: [number, number][][]): Letter => ({
  w,
  draw: (x, y, dw, h, r) => union(...lines.map((l) => polyline(P(x + r, y + r, dw - 2 * r, h - 2 * r)(l), r))),
});
const bowl = (x0: number, y0: number, x1: number, y1: number) => (x: number, y: number, w: number, h: number, r: number) => {
  const bx = x + r + x0 * (w - 2 * r), by = y + r + y0 * (h - 2 * r), bw = (x1 - x0) * (w - 2 * r), bh = (y1 - y0) * (h - 2 * r);
  return ring(rrect(bx, by, bw, bh, Math.min(bw, bh) / 2), r);
};

const DIGITS: Record<string, Letter> = {
  "0": { w: 0.56, draw: (x, y, w, h, r) => ring(rrect(x + r, y + r, w - 2 * r, h - 2 * r, (w - 2 * r) / 2), r) },
  "1": digit(0.34, [[0, 0.22], [1, 0], [1, 1]]),
  "2": digit(0.56, [[0, 0.24], [0.2, 0.03], [0.5, 0], [0.82, 0.05], [1, 0.26], [0.9, 0.48], [0, 1], [1, 1]]),
  "3": digit(0.54, [[0, 0.1], [0.3, 0], [0.72, 0], [0.98, 0.18], [0.92, 0.4], [0.6, 0.5], [0.36, 0.5]], [[0.6, 0.5], [0.95, 0.6], [1, 0.82], [0.74, 1], [0.3, 1], [0, 0.9]]),
  "4": digit(0.6, [[0.78, 1], [0.78, 0], [0, 0.7], [1, 0.7]]),
  "5": digit(0.54, [[0.95, 0], [0.12, 0], [0.04, 0.46], [0.5, 0.4], [0.92, 0.52], [1, 0.76], [0.8, 0.97], [0.36, 1], [0, 0.9]]),
  "6": {
    w: 0.56,
    draw: (x, y, w, h, r) => union(bowl(0, 0.42, 1, 1)(x, y, w, h, r), polyline(P(x + r, y + r, w - 2 * r, h - 2 * r)([[0.9, 0.06], [0.58, 0], [0.24, 0.1], [0.04, 0.42], [0, 0.72]]), r)),
  },
  "7": digit(0.54, [[0, 0], [1, 0], [0.34, 1]]),
  "8": { w: 0.56, draw: (x, y, w, h, r) => union(bowl(0.08, 0, 0.92, 0.48)(x, y, w, h, r), bowl(0, 0.44, 1, 1)(x, y, w, h, r)) },
  "9": {
    w: 0.56,
    draw: (x, y, w, h, r) => union(bowl(0, 0, 1, 0.58)(x, y, w, h, r), polyline(P(x + r, y + r, w - 2 * r, h - 2 * r)([[1, 0.28], [0.96, 0.58], [0.76, 0.9], [0.42, 1], [0.1, 0.94]]), r)),
  },
};

const LETTERS: Record<string, Letter> = {
  ...DIGITS,
  S: {
    w: 0.64,
    draw: (x, y, w, h, r) => {
      const cx = x + w / 2, rx = w / 2 - r, ry = h / 4 - r / 2;
      const pts: [number, number][] = [];
      for (let a = 60; a >= -180; a -= 10) pts.push([cx + Math.sin(a * D) * rx, y + r + ry - Math.cos(a * D) * ry]);
      for (let a = 0; a <= 240; a += 10) pts.push([cx + Math.sin(a * D) * rx, y + h - r - ry - Math.cos(a * D) * ry]);
      return polyline(pts, r);
    },
  },
  M: { w: 0.8, draw: (x, y, w, h, r) => polyline(P(x + r, y + r, w - 2 * r, h - 2 * r)([[0, 1], [0, 0], [0.5, 0.65], [1, 0], [1, 1]]), r) },
  F: { w: 0.52, draw: (x, y, w, h, r) => union(polyline(P(x + r, y + r, w - 2 * r, h - 2 * r)([[1, 0], [0, 0], [0, 1]]), r), capsule(x + r, y + h * 0.5, x + w * 0.85, y + h * 0.5, r)) },
  X: { w: 0.62, draw: (x, y, w, h, r) => union(capsule(x + r, y + r, x + w - r, y + h - r, r), capsule(x + w - r, y + r, x + r, y + h - r, r)) },
  I: { w: 0.1, draw: (x, y, w, h, r) => capsule(x + w / 2, y + r, x + w / 2, y + h - r, r) },
  O: { w: 0.78, draw: (x, y, w, h, r) => ring(rrect(x + r, y + r, w - 2 * r, h - 2 * r, (w - 2 * r) / 2), r) },
  Q: { w: 0.78, draw: (x, y, w, h, r) => union(ring(rrect(x + r, y + r, w - 2 * r, h - 2 * r, (w - 2 * r) / 2), r), capsule(x + w * 0.6, y + h * 0.65, x + w - r, y + h - r, r)) },
  A: { w: 0.7, draw: (x, y, w, h, r) => union(polyline(P(x + r, y + r, w - 2 * r, h - 2 * r)([[0, 1], [0.5, 0], [1, 1]]), r), capsule(x + w * 0.24, y + h * 0.68, x + w * 0.76, y + h * 0.68, r)) },
  L: { w: 0.5, draw: (x, y, w, h, r) => polyline(P(x + r, y + r, w - 2 * r, h - 2 * r)([[0, 0], [0, 1], [1, 1]]), r) },
  N: { w: 0.68, draw: (x, y, w, h, r) => polyline(P(x + r, y + r, w - 2 * r, h - 2 * r)([[0, 1], [0, 0], [1, 1], [1, 0]]), r) },
  "/": { w: 0.36, draw: (x, y, w, h, r) => capsule(x + w - r, y + r, x + r, y + h - r, r) },
  T: { w: 0.6, draw: (x, y, w, h, r) => union(capsule(x + r, y + r, x + w - r, y + r, r), capsule(x + w / 2, y + r, x + w / 2, y + h - r, r)) },
  P: {
    w: 0.58,
    draw: (x, y, w, h, r) => {
      const bh = h * 0.56, rr = (bh - 2 * r) / 2;
      const pts: [number, number][] = [[x + r, y + h - r], [x + r, y + r], [x + w - r - rr, y + r]];
      for (let a = 0; a <= 180; a += 15) pts.push([x + w - r - rr + Math.sin(a * D) * rr, y + r + rr - Math.cos(a * D) * rr]);
      pts.push([x + r, y + bh - r]);
      return polyline(pts, r);
    },
  },
  U: {
    w: 0.66,
    draw: (x, y, w, h, r) => {
      const rr = (w - 2 * r) / 2, cx = x + w / 2, by = y + h - r - rr;
      const pts: [number, number][] = [[x + r, y + r], [x + r, by]];
      for (let a = -90; a <= 90; a += 15) pts.push([cx - Math.cos((a + 90) * D) * rr, by + Math.sin((a + 90) * D) * rr]);
      pts.push([x + w - r, y + r]);
      return polyline(pts, r);
    },
  },
};

// ---------- transport and track icons (u = icon height) ----------

export const play = (cx: number, cy: number, u: number): SDF => rpoly([[cx - u * 0.38, cy - u / 2], [cx + u * 0.5, cy], [cx - u * 0.38, cy + u / 2]], u * 0.06);
export const stop = (cx: number, cy: number, u: number): SDF => rrect(cx - u * 0.42, cy - u * 0.42, u * 0.84, u * 0.84, u * 0.08);
export const record = (cx: number, cy: number, u: number): SDF => circle(cx, cy, u * 0.46);
export const pause = (cx: number, cy: number, u: number): SDF => union(rrect(cx - u * 0.38, cy - u * 0.44, u * 0.27, u * 0.88, u * 0.05), rrect(cx + u * 0.11, cy - u * 0.44, u * 0.27, u * 0.88, u * 0.05));

/** |◀◀ and ▶▶| style skip icons. dir = -1 for back, 1 for forward. */
export function skip(cx: number, cy: number, u: number, dir: -1 | 1, bar = true): SDF {
  const o = bar ? -u * 0.08 * dir : 0;
  const tri = (ox: number) => rpoly(dir > 0
    ? [[ox - u * 0.24, cy - u * 0.4], [ox + u * 0.2, cy], [ox - u * 0.24, cy + u * 0.4]]
    : [[ox + u * 0.24, cy - u * 0.4], [ox - u * 0.2, cy], [ox + u * 0.24, cy + u * 0.4]], u * 0.04);
  const parts = [tri(cx - u * 0.2 * dir + o), tri(cx + u * 0.2 * dir + o)];
  if (bar) parts.push(rrect(cx + u * 0.38 * dir - u * 0.06, cy - u * 0.4, u * 0.12, u * 0.8, u * 0.02));
  return union(...parts);
}

/** Loop: a rounded rectangle path with an arrow head. */
export function loop(cx: number, cy: number, u: number): SDF {
  const w = u * 1.25, h = u * 0.74, t = st(u * 0.08);
  const box = rrect(cx - w / 2, cy - h / 2, w, h, h / 2);
  const gap = rect(cx - u * 0.02, cy - h / 2 - t * 3, u * 0.32, t * 6);
  const head = poly([[cx - u * 0.1, cy - h / 2 - u * 0.22], [cx + u * 0.16, cy - h / 2], [cx - u * 0.1, cy - h / 2 + u * 0.22]]);
  return union(subtract(ring(box, t), gap), head);
}

/** A loudspeaker, optionally with sound waves. */
export function speaker(cx: number, cy: number, u: number, waves = 2): SDF {
  const x0 = cx - u * 0.5 + (2 - waves) * u * 0.12;
  const body = rpoly([[x0, cy - u * 0.17], [x0 + u * 0.2, cy - u * 0.17], [x0 + u * 0.47, cy - u * 0.44], [x0 + u * 0.47, cy + u * 0.44], [x0 + u * 0.2, cy + u * 0.17], [x0, cy + u * 0.17]], u * 0.03);
  const parts = [body];
  for (let i = 0; i < waves; i++) parts.push(arc(x0 + u * 0.47, cy, u * (0.24 + i * 0.22), 45 * D, 135 * D, st(u * 0.07)));
  return union(...parts);
}

/** Headphones (input monitoring). */
export function headphones(cx: number, cy: number, u: number): SDF {
  // A band over two solid ear cups; the cups carry the shape at small sizes.
  const t = st(u * 0.09);
  return union(
    arc(cx, cy + u * 0.04, u * 0.4, -90 * D, 90 * D, t),
    rrect(cx - u * 0.5, cy - u * 0.02, u * 0.3, u * 0.52, u * 0.09),
    rrect(cx + u * 0.2, cy - u * 0.02, u * 0.3, u * 0.52, u * 0.09),
  );
}

/** Power symbol (FX on/off). */
export function power(cx: number, cy: number, u: number): SDF {
  const t = st(u * 0.08);
  return union(arc(cx, cy + u * 0.05, u * 0.4, 38 * D, 322 * D, t), capsule(cx, cy - u * 0.48, cx, cy - u * 0.06, t));
}

/** Automation envelope: a ramp with a node. */
export function envelope(cx: number, cy: number, u: number): SDF {
  const w = u * 1.15, t = st(u * 0.08);
  return union(
    polyline([[cx - w / 2, cy + u * 0.3], [cx - w * 0.12, cy + u * 0.3], [cx + w * 0.16, cy - u * 0.3], [cx + w / 2, cy - u * 0.3]], t),
    circle(cx - w * 0.12, cy + u * 0.3, t * 2.2),
    circle(cx + w * 0.16, cy - u * 0.3, t * 2.2),
  );
}

/** Ø polarity symbol. */
export function phase(cx: number, cy: number, u: number): SDF {
  const t = st(u * 0.075);
  return union(ring(circle(cx, cy, u * 0.32), t), capsule(cx - u * 0.36, cy + u * 0.46, cx + u * 0.36, cy - u * 0.46, t));
}

/** Folder icon. */
export function folder(cx: number, cy: number, u: number, open = false): SDF {
  const w = u * 1.15;
  const back = rrect(cx - w / 2, cy - u * 0.3, w, u * 0.72, u * 0.08);
  const tab = rrect(cx - w / 2, cy - u * 0.44, w * 0.42, u * 0.26, u * 0.06);
  const shape = union(back, tab);
  if (!open) return shape;
  const t = st(u * 0.08);
  return union(subtract(shape, rrect(cx - w / 2 + t * 2, cy - u * 0.3 + t * 2, w - t * 4, u * 0.72 - t * 4, 0)), rpoly([[cx - w / 2 + u * 0.16, cy - u * 0.04], [cx + w / 2 + u * 0.06, cy - u * 0.04], [cx + w / 2 - u * 0.1, cy + u * 0.42], [cx - w / 2, cy + u * 0.42]], u * 0.03));
}

/** Small chevron. dir: 1 down, -1 up. */
export function chevron(cx: number, cy: number, u: number, dir: 1 | -1 = 1): SDF {
  return polyline([[cx - u * 0.4, cy - u * 0.2 * dir], [cx, cy + u * 0.2 * dir], [cx + u * 0.4, cy - u * 0.2 * dir]], st(u * 0.09));
}

export function arrowIn(cx: number, cy: number, u: number): SDF {
  const t = st(u * 0.08);
  return union(capsule(cx - u * 0.45, cy, cx + u * 0.15, cy, t), polyline([[cx - u * 0.05, cy - u * 0.22], [cx + u * 0.18, cy], [cx - u * 0.05, cy + u * 0.22]], t), capsule(cx + u * 0.42, cy - u * 0.38, cx + u * 0.42, cy + u * 0.38, t));
}
export function arrowOut(cx: number, cy: number, u: number): SDF {
  const t = st(u * 0.08);
  return union(capsule(cx - u * 0.42, cy - u * 0.38, cx - u * 0.42, cy + u * 0.38, t), capsule(cx - u * 0.2, cy, cx + u * 0.4, cy, t), polyline([[cx + u * 0.2, cy - u * 0.22], [cx + u * 0.43, cy], [cx + u * 0.2, cy + u * 0.22]], t));
}

export function menu(cx: number, cy: number, u: number): SDF {
  const t = st(u * 0.08);
  return union(...[-0.3, 0, 0.3].map((d) => capsule(cx - u * 0.38, cy + u * d, cx + u * 0.38, cy + u * d, t)));
}

export function cross(cx: number, cy: number, u: number): SDF {
  const t = st(u * 0.08);
  return union(capsule(cx - u * 0.32, cy - u * 0.32, cx + u * 0.32, cy + u * 0.32, t), capsule(cx + u * 0.32, cy - u * 0.32, cx - u * 0.32, cy + u * 0.32, t));
}

export function wave(cx: number, cy: number, u: number): SDF {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 24; i++) pts.push([cx - u * 0.55 + (i / 24) * u * 1.1, cy - Math.sin((i / 24) * Math.PI * 2) * u * 0.3]);
  return polyline(pts, st(u * 0.075));
}

export const dot = (cx: number, cy: number, u: number): SDF => circle(cx, cy, u * 0.22);

/** Stereo: two overlapping rings; mono: one filled circle. */
export function stereo(cx: number, cy: number, u: number): SDF {
  const t = st(u * 0.07);
  return union(ring(circle(cx - u * 0.18, cy, u * 0.3), t), ring(circle(cx + u * 0.18, cy, u * 0.3), t));
}

// ---------- toolbar icons (u ≈ 16 at 100%) ----------

const T = (u: number) => st(u * 0.065);

export const tb: Record<string, (cx: number, cy: number, u: number) => SDF> = {
  new: (cx, cy, u) => {
    const t = T(u), w = u * 0.66, h = u * 0.86, x = cx - w / 2, y = cy - h / 2, f = u * 0.24;
    return union(polyline([[x + w - f, y], [x, y], [x, y + h], [x + w, y + h], [x + w, y + f], [x + w - f, y], [x + w - f, y + f], [x + w, y + f]], t), capsule(cx, cy + u * 0.02, cx, cy + u * 0.26, t), capsule(cx - u * 0.12, cy + u * 0.14, cx + u * 0.12, cy + u * 0.14, t));
  },
  save: (cx, cy, u) => {
    const t = T(u), s = u * 0.8, x = cx - s / 2, y = cy - s / 2;
    return union(ring(rrect(x, y, s, s, u * 0.08), t), rect(x + s * 0.24, y, s * 0.46, s * 0.3), ring(rrect(x + s * 0.2, y + s * 0.56, s * 0.6, s * 0.44, 0), t));
  },
  load: (cx, cy, u) => folder(cx, cy, u * 0.85, true),
  projprop: (cx, cy, u) => {
    const t = T(u);
    return union(capsule(cx - u * 0.4, cy - u * 0.2, cx + u * 0.4, cy - u * 0.2, t), capsule(cx - u * 0.4, cy + u * 0.2, cx + u * 0.4, cy + u * 0.2, t), circle(cx + u * 0.14, cy - u * 0.2, u * 0.12), circle(cx - u * 0.16, cy + u * 0.2, u * 0.12));
  },
  undo: (cx, cy, u) => curveArrow(cx, cy, u, -1),
  redo: (cx, cy, u) => curveArrow(cx, cy, u, 1),
  revert: (cx, cy, u) => {
    const t = T(u);
    return union(arc(cx, cy, u * 0.36, -150 * D, 150 * D, t), poly([[cx - u * 0.42, cy - u * 0.42], [cx - u * 0.02, cy - u * 0.34], [cx - u * 0.3, cy - u * 0.08]]));
  },
  metro: (cx, cy, u) => {
    const t = T(u);
    return union(ring(rpoly([[cx - u * 0.12, cy - u * 0.42], [cx + u * 0.12, cy - u * 0.42], [cx + u * 0.34, cy + u * 0.42], [cx - u * 0.34, cy + u * 0.42]], u * 0.04), t), capsule(cx, cy + u * 0.2, cx + u * 0.32, cy - u * 0.36, t), capsule(cx - u * 0.24, cy + u * 0.18, cx + u * 0.24, cy + u * 0.18, t));
  },
  grid: (cx, cy, u) => {
    const t = T(u), s = u * 0.42;
    return union(...[-s, 0, s].flatMap((d) => [capsule(cx + d, cy - s * 1.15, cx + d, cy + s * 1.15, t), capsule(cx - s * 1.15, cy + d, cx + s * 1.15, cy + d, t)]));
  },
  snap: (cx, cy, u) => magnet(cx, cy, u),
  relsnap: (cx, cy, u) => union(magnet(cx - u * 0.12, cy, u * 0.8), circle(cx + u * 0.38, cy + u * 0.32, u * 0.1)),
  ripple_off: (cx, cy, u) => union(ring(rect(cx - u * 0.46, cy - u * 0.2, u * 0.36, u * 0.4), T(u)), ring(rect(cx + u * 0.06, cy - u * 0.2, u * 0.4, u * 0.4), T(u))),
  ripple_one: (cx, cy, u) => union(rect(cx - u * 0.46, cy - u * 0.2, u * 0.3, u * 0.4), ripArrow(cx + u * 0.12, cy, u)),
  ripple_all: (cx, cy, u) => union(rect(cx - u * 0.46, cy - u * 0.42, u * 0.3, u * 0.32), rect(cx - u * 0.46, cy + u * 0.1, u * 0.3, u * 0.32), ripArrow(cx + u * 0.12, cy - u * 0.26, u * 0.8), ripArrow(cx + u * 0.12, cy + u * 0.26, u * 0.8)),
  lock: (cx, cy, u) => padlock(cx, cy, u, true),
  lock_off: (cx, cy, u) => padlock(cx, cy, u, false),
  xfade: (cx, cy, u) => {
    const t = T(u);
    return union(polyline([[cx - u * 0.48, cy - u * 0.3], [cx - u * 0.2, cy - u * 0.3], [cx + u * 0.2, cy + u * 0.3], [cx + u * 0.48, cy + u * 0.3]], t), polyline([[cx - u * 0.48, cy + u * 0.3], [cx - u * 0.2, cy + u * 0.3], [cx + u * 0.2, cy - u * 0.3], [cx + u * 0.48, cy - u * 0.3]], t));
  },
  envitem: (cx, cy, u) => union(ring(rect(cx - u * 0.46, cy - u * 0.36, u * 0.92, u * 0.72), T(u)), polyline([[cx - u * 0.3, cy + u * 0.16], [cx - u * 0.04, cy - u * 0.16], [cx + u * 0.3, cy + u * 0.06]], T(u))),
  group: (cx, cy, u) => {
    const t = T(u);
    return union(ring(rrect(cx - u * 0.48, cy - u * 0.16, u * 0.5, u * 0.32, u * 0.16), t), ring(rrect(cx - u * 0.02, cy - u * 0.16, u * 0.5, u * 0.32, u * 0.16), t));
  },
  filter: (cx, cy, u) => rpoly([[cx - u * 0.44, cy - u * 0.38], [cx + u * 0.44, cy - u * 0.38], [cx + u * 0.1, cy + u * 0.04], [cx + u * 0.1, cy + u * 0.42], [cx - u * 0.1, cy + u * 0.32], [cx - u * 0.1, cy + u * 0.04]], u * 0.03),
  dock: (cx, cy, u) => union(ring(rrect(cx - u * 0.46, cy - u * 0.38, u * 0.92, u * 0.76, u * 0.06), T(u)), rect(cx - u * 0.46, cy + u * 0.08, u * 0.92, u * 0.3)),
  quant: (cx, cy, u) => text("Q", cx, cy, u * 0.72),
  replacemode: (cx, cy, u) => union(ring(rect(cx - u * 0.46, cy - u * 0.36, u * 0.56, u * 0.46), T(u)), rect(cx - u * 0.1, cy - u * 0.1, u * 0.56, u * 0.46)),
  midi_itemsel: (cx, cy, u) => union(ring(rrect(cx - u * 0.46, cy - u * 0.3, u * 0.92, u * 0.6, u * 0.06), T(u)), rect(cx - u * 0.3, cy - u * 0.04, u * 0.3, u * 0.1), rect(cx + u * 0.04, cy - u * 0.18, u * 0.24, u * 0.1)),
  midi_tracksel: (cx, cy, u) => union(...[-0.32, 0, 0.32].map((d, i) => (i === 1 ? rect(cx - u * 0.46, cy + u * d - u * 0.08, u * 0.92, u * 0.16) : capsule(cx - u * 0.46, cy + u * d, cx + u * 0.46, cy + u * d, T(u))))),
  midi_mode_piano_roll: (cx, cy, u) => union(ring(rect(cx - u * 0.42, cy - u * 0.42, u * 0.84, u * 0.84), T(u)), ...[-0.21, 0.07, 0.35].map((d) => rect(cx - u * 0.42, cy - u * 0.42 + u * (d + 0.42) - u * 0.06, u * 0.46, u * 0.14))),
  midi_mode_named_notes: (cx, cy, u) => union(...[-0.3, 0, 0.3].map((d) => union(rect(cx - u * 0.46, cy + u * d - u * 0.07, u * 0.22, u * 0.14), capsule(cx - u * 0.12, cy + u * d, cx + u * 0.46, cy + u * d, T(u))))),
  midi_mode_event_list: (cx, cy, u) => union(...[-0.32, -0.1, 0.12, 0.34].map((d) => capsule(cx - u * 0.42, cy + u * d, cx + u * 0.42, cy + u * d, T(u)))),
  midi_mode_musical_notation: (cx, cy, u) => union(rpoly([[cx - u * 0.36, cy + u * 0.2], [cx - u * 0.06, cy + u * 0.08], [cx + u * 0.02, cy + u * 0.3], [cx - u * 0.28, cy + u * 0.42]], u * 0.06), capsule(cx - u * 0.02, cy + u * 0.2, cx - u * 0.02, cy - u * 0.44, T(u)), polyline([[cx - u * 0.02, cy - u * 0.44], [cx + u * 0.3, cy - u * 0.2], [cx + u * 0.3, cy - u * 0.04]], T(u))),
  midi_step: (cx, cy, u) => union(rect(cx - u * 0.42, cy + u * 0.1, u * 0.22, u * 0.3), rect(cx - u * 0.11, cy - u * 0.1, u * 0.22, u * 0.5), rect(cx + u * 0.2, cy - u * 0.32, u * 0.22, u * 0.72)),
  blank: () => () => 1e9,
};

function curveArrow(cx: number, cy: number, u: number, dir: -1 | 1): SDF {
  const t = T(u);
  const body = intersect(arc(cx, cy + u * 0.14, u * 0.34, -90 * D, 90 * D, t), dir < 0 ? rect(cx - u, cy - u, u * 2, u * 2) : rect(cx - u, cy - u, u * 2, u * 2));
  const tip = dir < 0
    ? poly([[cx - u * 0.56, cy + u * 0.14], [cx - u * 0.12, cy - u * 0.06], [cx - u * 0.24, cy + u * 0.4]])
    : poly([[cx + u * 0.56, cy + u * 0.14], [cx + u * 0.12, cy - u * 0.06], [cx + u * 0.24, cy + u * 0.4]]);
  const stem = dir < 0 ? arc(cx, cy + u * 0.14, u * 0.34, -60 * D, 90 * D, t) : arc(cx, cy + u * 0.14, u * 0.34, -90 * D, 60 * D, t);
  return union(intersect(body, stem), tip);
}

function magnet(cx: number, cy: number, u: number): SDF {
  const t = st(u * 0.13);
  const u2 = union(arc(cx, cy - u * 0.02, u * 0.3, 90 * D, 270 * D, t), capsule(cx - u * 0.3, cy - u * 0.02, cx - u * 0.3, cy - u * 0.36, t), capsule(cx + u * 0.3, cy - u * 0.02, cx + u * 0.3, cy - u * 0.36, t));
  return union(u2, rect(cx - u * 0.3 - t, cy - u * 0.46, t * 2, u * 0.14), rect(cx + u * 0.3 - t, cy - u * 0.46, t * 2, u * 0.14));
}

function ripArrow(cx: number, cy: number, u: number): SDF {
  const t = T(u);
  return union(capsule(cx - u * 0.12, cy, cx + u * 0.3, cy, t), polyline([[cx + u * 0.14, cy - u * 0.16], [cx + u * 0.32, cy], [cx + u * 0.14, cy + u * 0.16]], t));
}

function padlock(cx: number, cy: number, u: number, closed: boolean): SDF {
  const t = T(u) * 1.2;
  const shackle = closed ? arc(cx, cy - u * 0.12, u * 0.22, -90 * D, 90 * D, t) : arc(cx + u * 0.22, cy - u * 0.2, u * 0.22, -90 * D, 80 * D, t);
  const legs = closed ? union(capsule(cx - u * 0.22, cy - u * 0.12, cx - u * 0.22, cy + u * 0.02, t), capsule(cx + u * 0.22, cy - u * 0.12, cx + u * 0.22, cy + u * 0.02, t)) : capsule(cx, cy - u * 0.2, cx, cy, t);
  return union(shackle, legs, rrect(cx - u * 0.34, cy, u * 0.68, u * 0.46, u * 0.06));
}
