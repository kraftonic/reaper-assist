import { PNG } from "pngjs";

/**
 * A tiny vector rasteriser for theme artwork.
 *
 * Shapes are signed distance functions (negative inside) in BASE units; a Canvas
 * draws them at its scale (1, 1.5 or 2) so every image is drawn fresh at each
 * size instead of being resized. Coverage comes from the distance at each pixel
 * centre, which gives clean anti-aliased edges with no supersampling.
 */

export type RGB = [number, number, number];
export type SDF = (x: number, y: number) => number;
/** A paint: a colour, or a function of position (base units) returning colour + alpha. */
export type Paint = { c: RGB; a: number } | ((x: number, y: number) => { c: RGB; a: number });

export const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const rgbHex = (c: RGB) => `#${c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
export const mixc = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const lighten = (c: RGB, t: number) => mixc(c, [255, 255, 255], t);
export const darken = (c: RGB, t: number) => mixc(c, [0, 0, 0], t);
export const luma = (c: RGB) => (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);

export const solid = (c: RGB | string, a = 1): Paint => ({ c: typeof c === "string" ? hex(c) : c, a });

/** Vertical gradient between y0 and y1 (base units) through colour stops [t, colour]. */
export function vgrad(y0: number, y1: number, stops: [number, RGB | string][], a = 1): Paint {
  const s = stops.map(([t, c]) => [t, typeof c === "string" ? hex(c) : c] as [number, RGB]);
  return (_x, y) => {
    const t = clamp((y - y0) / (y1 - y0 || 1));
    let i = 1;
    while (i < s.length - 1 && t > s[i]![0]) i++;
    const [t0, c0] = s[i - 1]!, [t1, c1] = s[i]!;
    return { c: mixc(c0, c1, clamp((t - t0) / (t1 - t0 || 1))), a };
  };
}

/** Radial gradient around (cx, cy). */
export function rgrad(cx: number, cy: number, r: number, inner: RGB | string, outer: RGB | string, a = 1): Paint {
  const i = typeof inner === "string" ? hex(inner) : inner, o = typeof outer === "string" ? hex(outer) : outer;
  return (x, y) => ({ c: mixc(i, o, clamp(Math.hypot(x - cx, y - cy) / r)), a });
}

// ---------- shapes ----------

export function rrect(x: number, y: number, w: number, h: number, r: number): SDF {
  const cx = x + w / 2, cy = y + h / 2, hw = w / 2, hh = h / 2;
  const rr = Math.min(r, hw, hh);
  return (px, py) => {
    const qx = Math.abs(px - cx) - (hw - rr), qy = Math.abs(py - cy) - (hh - rr);
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rr;
  };
}

export const rect = (x: number, y: number, w: number, h: number): SDF => rrect(x, y, w, h, 0);

export function circle(cx: number, cy: number, r: number): SDF {
  return (x, y) => Math.hypot(x - cx, y - cy) - r;
}

/** A line segment with round caps, thickness 2r. */
export function capsule(ax: number, ay: number, bx: number, by: number, r: number): SDF {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-9;
  return (x, y) => {
    const t = clamp(((x - ax) * dx + (y - ay) * dy) / l2);
    return Math.hypot(x - ax - dx * t, y - ay - dy * t) - r;
  };
}

/** A polyline drawn with round joins (thickness 2r). */
export function polyline(pts: [number, number][], r: number): SDF {
  const segs = pts.slice(1).map((p, i) => capsule(pts[i]![0], pts[i]![1], p[0], p[1], r));
  return union(...segs);
}

/** Filled polygon (any simple polygon). */
export function poly(pts: [number, number][]): SDF {
  return (x, y) => {
    let d = Infinity, s = 1;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i]!, [xj, yj] = pts[j]!;
      const ex = xj - xi, ey = yj - yi, wx = x - xi, wy = y - yi;
      const t = clamp((wx * ex + wy * ey) / (ex * ex + ey * ey || 1e-9));
      d = Math.min(d, Math.hypot(wx - ex * t, wy - ey * t));
      const c1 = y >= yi, c2 = y < yj, c3 = ex * wy > ey * wx;
      if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
    }
    return s * d;
  };
}

/** Rounded polygon: the polygon shrunk by r then grown back (soft corners). */
export function rpoly(pts: [number, number][], r: number): SDF {
  const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  const shrunk = pts.map(([x, y]) => {
    const dx = x - cx, dy = y - cy, l = Math.hypot(dx, dy) || 1;
    return [x - (dx / l) * r * 1.6, y - (dy / l) * r * 1.6] as [number, number];
  });
  const p = poly(shrunk);
  return (x, y) => p(x, y) - r;
}

/** An arc of a ring from angle a0 to a1 (radians, 0 = up, clockwise), stroke radius t, round caps. */
export function arc(cx: number, cy: number, r: number, a0: number, a1: number, t: number): SDF {
  const p = (a: number): [number, number] => [cx + Math.sin(a) * r, cy - Math.cos(a) * r];
  const [ax, ay] = p(a0), [bx, by] = p(a1);
  const lo = Math.min(a0, a1), hi = Math.max(a0, a1);
  return (x, y) => {
    let a = Math.atan2(x - cx, -(y - cy));
    while (a < lo) a += 2 * Math.PI;
    while (a >= lo + 2 * Math.PI) a -= 2 * Math.PI;
    if (a >= lo && a <= hi) return Math.abs(Math.hypot(x - cx, y - cy) - r) - t;
    return Math.min(Math.hypot(x - ax, y - ay), Math.hypot(x - bx, y - by)) - t;
  };
}

export const union = (...s: SDF[]): SDF => (x, y) => {
  let d = Infinity;
  for (const f of s) d = Math.min(d, f(x, y));
  return d;
};
export const subtract = (a: SDF, b: SDF): SDF => (x, y) => Math.max(a(x, y), -b(x, y));
export const intersect = (a: SDF, b: SDF): SDF => (x, y) => Math.max(a(x, y), b(x, y));
export const outline = (a: SDF, width: number): SDF => (x, y) => Math.abs(a(x, y) + width / 2) - width / 2; // inside stroke
export const grow = (a: SDF, by: number): SDF => (x, y) => a(x, y) - by;
export const shift = (a: SDF, dx: number, dy: number): SDF => (x, y) => a(x - dx, y - dy);

// ---------- canvas ----------

export class Canvas {
  readonly pw: number;
  readonly ph: number;
  /** Premultiplied RGBA, 0..1. */
  readonly px: Float32Array;

  constructor(readonly w: number, readonly h: number, readonly s: number) {
    this.pw = Math.max(1, Math.round(w * s));
    this.ph = Math.max(1, Math.round(h * s));
    this.px = new Float32Array(this.pw * this.ph * 4);
  }

  /** Fill a shape. `soft` widens the edge (base units) for glows and shadows. */
  fill(shape: SDF, paint: Paint, soft = 0): this {
    const s = this.s;
    const edge = Math.max(1 / s, soft); // at least one device pixel of anti-aliasing
    for (let j = 0; j < this.ph; j++) {
      const y = (j + 0.5) / s;
      for (let i = 0; i < this.pw; i++) {
        const x = (i + 0.5) / s;
        const d = shape(x, y);
        if (d >= edge / 2 + (soft ? soft : 0)) continue;
        const cov = soft ? smooth(clamp(0.5 - d / (2 * soft))) : clamp(0.5 - d / edge);
        if (cov <= 0) continue;
        const p = typeof paint === "function" ? paint(x, y) : paint;
        this.blend(i, j, p.c, p.a * cov);
      }
    }
    return this;
  }

  /** Soft drop shadow (or glow with dx = dy = 0). */
  shadow(shape: SDF, c: RGB | string, a: number, blur: number, dx = 0, dy = 0): this {
    return this.fill(shift(shape, dx, dy), solid(c, a), blur);
  }

  private blend(i: number, j: number, c: RGB, a: number): void {
    if (a <= 0) return;
    const k = (j * this.pw + i) * 4, p = this.px;
    const ia = 1 - a;
    p[k] = (c[0] / 255) * a + p[k]! * ia;
    p[k + 1] = (c[1] / 255) * a + p[k + 1]! * ia;
    p[k + 2] = (c[2] / 255) * a + p[k + 2]! * ia;
    p[k + 3] = a + p[k + 3]! * ia;
  }

  /** Straight (non-premultiplied) 8-bit RGBA. */
  rgba(): Uint8Array {
    const out = new Uint8Array(this.pw * this.ph * 4);
    for (let k = 0; k < out.length; k += 4) {
      const a = this.px[k + 3]!;
      if (a <= 0.002) continue;
      out[k] = Math.round(clamp(this.px[k]! / a) * 255);
      out[k + 1] = Math.round(clamp(this.px[k + 1]! / a) * 255);
      out[k + 2] = Math.round(clamp(this.px[k + 2]! / a) * 255);
      out[k + 3] = Math.round(clamp(a) * 255);
    }
    return out;
  }
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** An RGBA bitmap in device pixels. */
export interface Bitmap {
  width: number;
  height: number;
  data: Uint8Array;
}

export const bitmap = (c: Canvas): Bitmap => ({ width: c.pw, height: c.ph, data: c.rgba() });

/** Frames side by side (sliced buttons: normal, hover, pressed). */
export function hstack(frames: Bitmap[]): Bitmap {
  return stack(frames, true);
}

/** Frames top to bottom (knob stacks, vertical slices). */
export function vstack(frames: Bitmap[]): Bitmap {
  return stack(frames, false);
}

function stack(frames: Bitmap[], horiz: boolean): Bitmap {
  const W = horiz ? frames.reduce((a, f) => a + f.width, 0) : Math.max(...frames.map((f) => f.width));
  const H = horiz ? Math.max(...frames.map((f) => f.height)) : frames.reduce((a, f) => a + f.height, 0);
  const data = new Uint8Array(W * H * 4);
  let off = 0;
  for (const f of frames) {
    for (let y = 0; y < f.height; y++) {
      const dy = horiz ? y : y + off, dx = horiz ? off : 0;
      data.set(f.data.subarray(y * f.width * 4, (y + 1) * f.width * 4), (dy * W + dx) * 4);
    }
    off += horiz ? f.width : f.height;
  }
  return { width: W, height: H, data };
}

const PINK = [255, 0, 255, 255];

/**
 * Add REAPER's 1-pixel guide border for stretchable images: pink lines along the
 * top/left mark the unstretched left/top edges, along the bottom/right the
 * unstretched right/bottom edges (device pixels).
 */
export function withGuides(b: Bitmap, l: number, t: number, r: number, bt: number): Bitmap {
  const W = b.width + 2, H = b.height + 2;
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < b.height; y++) data.set(b.data.subarray(y * b.width * 4, (y + 1) * b.width * 4), ((y + 1) * W + 1) * 4);
  const put = (x: number, y: number) => data.set(PINK, (y * W + x) * 4);
  put(0, 0);
  put(W - 1, H - 1);
  for (let x = 1; x <= l; x++) put(x, 0);
  for (let y = 1; y <= t; y++) put(0, y);
  for (let x = W - 2; x >= W - 1 - r; x--) put(x, H - 1);
  for (let y = H - 2; y >= H - 1 - bt; y--) put(W - 1, y);
  return { width: W, height: H, data };
}

export function png(b: Bitmap): Uint8Array {
  const p = new PNG({ width: b.width, height: b.height });
  p.data = Buffer.from(b.data);
  return PNG.sync.write(p, { colorType: 6 });
}
