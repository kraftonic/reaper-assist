import type { ArtStyle } from "../skins";

/**
 * Redraws the SHAPES of REAPER Default 7 artwork in a skin's style, after the
 * colours have been mapped (skinArt.ts):
 *
 *  - Buttons (mute, solo, FX, I/O, toolbar, transport…): each state frame's body
 *    is replaced by a new body (square, rounded or pill; flat, glossy or glowing
 *    outline) and the original glyph ("M", "S", "FX", ▶, ●) is cut out and laid
 *    back on top.
 *  - Knobs (*_knob_stack): every rotation frame is drawn from scratch.
 *  - Fader and pan thumbs: each thumb is redrawn as the skin's fader cap.
 *
 * Image sizes, frame layout and REAPER's guide pixels (pure magenta / yellow)
 * never change, so REAPER lays everything out exactly as before.
 */

type RGB = [number, number, number];

export interface Img {
  width: number;
  height: number;
  data: Uint8Array;
}

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [0, 0, 0];
const lum = (c: RGB) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
const dist = (a: RGB, b: RGB) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const hexRgb = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function isGuide(d: Uint8Array, i: number): boolean {
  if (d[i + 3] === 0) return false;
  return d[i] === 255 && d[i + 2] === 255 && d[i + 1] === 0 ? true : d[i] === 255 && d[i + 1] === 255 && d[i + 2] === 0;
}

function px(img: Img, x: number, y: number): [number, number, number, number] {
  const i = (y * img.width + x) * 4;
  const d = img.data;
  return [d[i]!, d[i + 1]!, d[i + 2]!, d[i + 3]!];
}

/** Source-over composite of a colour at coverage `a` (0..1). Guide pixels are never written. */
function blend(img: Img, x: number, y: number, c: RGB, a: number): void {
  if (a <= 0 || x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const i = (y * img.width + x) * 4;
  const d = img.data;
  if (isGuide(d, i)) return;
  a = clamp(a);
  const da = d[i + 3]! / 255;
  const oa = a + da * (1 - a);
  if (oa <= 0) return;
  for (let k = 0; k < 3; k++) d[i + k] = Math.round((c[k]! * a + d[i + k]! * da * (1 - a)) / oa);
  d[i + 3] = Math.round(oa * 255);
}

function clearRect(img: Img, x0: number, y0: number, x1: number, y1: number): void {
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const i = (y * img.width + x) * 4;
      if (!isGuide(img.data, i)) img.data[i + 3] = 0;
    }
}

/** Signed distance from a point to a rounded rectangle (negative inside). */
function sdRoundRect(px_: number, py: number, cx: number, cy: number, hw: number, hh: number, r: number): number {
  const qx = Math.abs(px_ - cx) - (hw - r);
  const qy = Math.abs(py - cy) - (hh - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

interface Box { x0: number; y0: number; x1: number; y1: number } // x1/y1 exclusive

/** Paint one shape body into a box in the given style. `fill` is the body colour, `ink` the state colour for glass. */
function paintBody(img: Img, b: Box, style: ArtStyle, fill: RGB, scale: number, round = style.corner, opacity = 1): void {
  const w = b.x1 - b.x0, h = b.y1 - b.y0;
  const glass = style.surface === "glass";
  const inset = glass ? 1.5 * scale : 0;
  const cx = b.x0 + w / 2, cy = b.y0 + h / 2;
  const hw = w / 2 - inset, hh = h / 2 - inset;
  const r = clamp(round, 0, 0.5) * Math.min(hw, hh) * 2;
  const line = Math.max(1, scale);
  const edge = style.light ? lerp(fill, BLACK, 0.3) : lerp(fill, BLACK, 0.5);
  const bright = lum(fill) > 0.6;
  const glow: RGB = lerp(fill, WHITE, 0.15);
  for (let y = b.y0; y < b.y1; y++)
    for (let x = b.x0; x < b.x1; x++) {
      const d = sdRoundRect(x + 0.5, y + 0.5, cx, cy, hw, hh, r);
      const cover = clamp(0.5 - d);
      const t = (y + 0.5 - (cy - hh)) / (2 * hh); // 0 top → 1 bottom
      if (glass) {
        // Dark glass body, bright rim in the state colour, soft glow outside.
        if (d > 0) blend(img, x, y, glow, 0.45 * Math.exp(-d / (1.2 * scale)));
        if (cover > 0) {
          blend(img, x, y, lerp(fill, BLACK, 0.72 - 0.12 * (1 - t)), cover * 0.95 * opacity);
          const rim = clamp(line + 0.5 - Math.abs(d + line / 2));
          blend(img, x, y, glow, rim);
        }
        continue;
      }
      if (cover <= 0) continue;
      let c: RGB = fill;
      if (style.surface === "gradient") {
        // Glossy: lighter top, darker bottom, a sheen over the top half.
        c = t < 0.5 ? lerp(lerp(fill, WHITE, 0.28), fill, t * 2) : lerp(fill, lerp(fill, BLACK, 0.25), (t - 0.5) * 2);
        if (t < 0.46) c = lerp(c, WHITE, 0.1);
      }
      blend(img, x, y, c, cover * opacity);
      // Edge line: dark for glossy and light skins; flat dark skins stay edgeless.
      if (style.surface === "gradient" || style.light) {
        const e = clamp(line + 0.5 - Math.abs(d + line / 2)) * cover;
        blend(img, x, y, edge, e * (bright ? 0.6 : 0.85));
      }
      if (style.surface === "gradient") {
        // Inner top highlight.
        const hl = clamp(line + 0.5 - Math.abs(d + line * 1.5)) * (t < 0.3 ? 1 : 0);
        blend(img, x, y, WHITE, hl * 0.35);
      }
    }
}

// ───────────────────────────── buttons ─────────────────────────────

const SOLID = 120;

function median(v: number[]): number {
  const s = [...v].sort((x, y) => x - y);
  return s.length ? s[s.length >> 1]! : 0;
}

/**
 * Restyle one button frame. Default 7 bodies are bevelled (a vertical gradient), so the body
 * colour is estimated per row (median of the row's opaque pixels; glyphs are a minority of a row).
 * Returns false (frame left as is) when the frame has no solid body, e.g. a bare toolbar icon.
 */
type FramePlan = "no-body" | "unsure" | (() => void);

function restyleFrame(img: Img, src: Img, f: Box, style: ArtStyle, scale: number): FramePlan {
  const fw = f.x1 - f.x0, fh = f.y1 - f.y0;
  // Solid area and its bounding box.
  let bx0 = f.x1, by0 = f.y1, bx1 = f.x0, by1 = f.y0, solidN = 0;
  for (let y = f.y0; y < f.y1; y++)
    for (let x = f.x0; x < f.x1; x++) {
      const i = (y * src.width + x) * 4;
      if (src.data[i + 3]! < SOLID || isGuide(src.data, i)) continue;
      solidN++;
      bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x + 1); by1 = Math.max(by1, y + 1);
    }
  const W = bx1 - bx0, H = by1 - by0;
  if (solidN < 0.35 * fw * fh || W < 0.6 * fw || H < 0.6 * fh) return "no-body";

  // Body colour per row, premultiplied (Default 7's track buttons are translucent).
  // Shapes are analysed on REAPER's original pixels (always good contrast); colours come from the recoloured ones.
  const pmOf = (im: Img) => (x: number, y: number): [number, number, number, number] => {
    const [r, g, b, a] = px(im, x, y);
    return [(r * a) / 255, (g * a) / 255, (b * a) / 255, a];
  };
  const rows = (im: Img) => {
    const pmx = pmOf(im);
    const c: RGB[] = [], al: number[] = [];
    for (let y = by0; y < by1; y++) {
      const r: number[] = [], g: number[] = [], b: number[] = [], a: number[] = [];
      for (let x = bx0; x < bx1; x++) {
        const p = pmx(x, y);
        if (p[3] >= SOLID) r.push(p[0]), g.push(p[1]), b.push(p[2]), a.push(p[3]);
      }
      c.push([median(r), median(g), median(b)]);
      al.push(median(a));
    }
    return { c, al };
  };
  const pm = pmOf(src);
  const { c: rowC } = rows(src);
  // The body's own colour and opacity (recoloured): middle half of the rows.
  const out = rows(img);
  const lo = Math.floor(H * 0.25), hi = Math.ceil(H * 0.75);
  const mid = out.c.slice(lo, hi);
  const alpha = Math.max(1, median(out.al.slice(lo, hi)));
  const fill: RGB = [0, 1, 2].map((k) => Math.min(255, (median(mid.map((c) => c[k]!)) * 255) / alpha)) as RGB;

  // Candidates differ from their row's body colour. Anything connected to the box edge through
  // candidates (rims, rings, corner tiles, shadows) is not glyph.
  const dd = new Float32Array(W * H);
  const cand = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const [r, g, b, a] = pm(bx0 + x, by0 + y);
      const d = a < SOLID ? 999 : dist([r, g, b], rowC[y]!);
      dd[y * W + x] = a === 0 ? 0 : d;
      cand[y * W + x] = d > 38 ? 1 : 0;
    }
  const reach = new Uint8Array(W * H);
  const q: number[] = [];
  const seed = (x: number, y: number) => { const k = y * W + x; if (cand[k] && !reach[k]) (reach[k] = 1), q.push(x, y); };
  for (let x = 0; x < W; x++) seed(x, 0), seed(x, H - 1);
  for (let y = 0; y < H; y++) seed(0, y), seed(W - 1, y);
  while (q.length) {
    const y = q.pop()!, x = q.pop()!;
    // 4-connected, so thin 1px letters at 100% don't leak into the rim.
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H) seed(nx, ny);
    }
  }
  // Glyph pixels: candidates not reached; plus their anti-aliased neighbours.
  const glyph = new Uint8Array(W * H);
  let gN = 0, gMax = 0;
  const gSum: [number, number, number] = [0, 0, 0];
  let strong = 0;
  // Enclosed components, kept only when centred in the body (drops gloss arcs and edge stripes).
  const comp = new Int32Array(W * H).fill(-1);
  for (let k0 = 0; k0 < W * H; k0++) {
    if (!cand[k0] || reach[k0] || dd[k0]! >= 999 || comp[k0] !== -1) continue;
    const members: number[] = [];
    const st = [k0];
    comp[k0] = k0;
    while (st.length) {
      const k = st.pop()!;
      members.push(k);
      const x = k % W, y = (k / W) | 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy, nk = ny * W + nx;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || comp[nk] !== -1 || !cand[nk] || reach[nk] || dd[nk]! >= 999) continue;
          comp[nk] = k0;
          st.push(nk);
        }
    }
    let sx = 0, sy = 0;
    for (const k of members) (sx += k % W), (sy += (k / W) | 0);
    sx /= members.length; sy /= members.length;
    if (sy < 0.22 * H || sy > 0.78 * H || sx < 0.05 * W || sx > 0.95 * W) continue;
    for (const k of members) {
      glyph[k] = 1;
      gN++;
      gMax = Math.max(gMax, dd[k]!);
    }
  }
  if (gN > 0.6 * W * H) return "unsure";
  // Everything that stands out in the middle of the button should have been found as glyph;
  // if not (e.g. a label touching edge stripes), leave the strip as REAPER drew it.
  let central = 0, found = 0;
  for (let y = Math.floor(H * 0.3); y < Math.ceil(H * 0.7); y++)
    for (let x = Math.floor(W * 0.15); x < Math.ceil(W * 0.85); x++) {
      const k = y * W + x;
      if (!cand[k] || dd[k]! >= 999) continue;
      central++;
      if (glyph[k]) found++;
    }
  if (central > 0 && found < 0.7 * central) return "unsure";
  if (gN === 0) return "no-body";
  // Typical glyph contrast (a high percentile, not the max: one odd pixel would fade every letter).
  const gd: number[] = [];
  for (let k = 0; k < W * H; k++) if (glyph[k]) gd.push(dd[k]!);
  gd.sort((a, b) => a - b);
  gMax = gd[Math.floor(gd.length * 0.6)]!;
  const cov = new Float32Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const k = y * W + x;
      let near = glyph[k] === 1;
      if (!near) for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1 && !near; dx++) { const nx = x + dx, ny = y + dy; near = nx >= 0 && ny >= 0 && nx < W && ny < H && glyph[ny * W + nx] === 1 && !reach[k]; }
      if (!near) continue;
      cov[k] = glyph[k] ? clamp((dd[k]! - 10) / (gMax * 0.75 - 10), 0.55, 1) : clamp((dd[k]! - 10) / (gMax * 0.75 - 10));
      if (cov[k]! > 0.85) { const [r, g, b] = px(img, bx0 + x, by0 + y); gSum[0] += r; gSum[1] += g; gSum[2] += b; strong++; }
    }
  let ink: RGB = strong ? [gSum[0] / strong, gSum[1] / strong, gSum[2] / strong] : WHITE;
  // Recolouring can squash contrast (light skins); keep the glyph readable.
  if (dist(ink, fill) < 80) ink = lum(fill) > 0.5 ? lerp(fill, BLACK, 0.7) : lerp(fill, WHITE, 0.75);
  // Keep the glyph's own (recoloured) pixels when they read well; otherwise one flat ink.
  const own = dist(ink, fill) >= 80 && style.surface !== "glass";
  if (style.surface === "glass") ink = lum(fill) < 0.3 && lum(ink) > 0.5 ? ink : lerp(fill, WHITE, 0.4);
  const colours: (RGB | null)[] = new Array(W * H).fill(null);
  if (own)
    for (let k = 0; k < W * H; k++)
      if (glyph[k]) {
        // Core pixels only; anti-aliased edges carry the old body colour, so they use the ink.
        const [r, g, b, a] = px(img, bx0 + (k % W), by0 + ((k / W) | 0));
        colours[k] = a ? [r, g, b] : ink;
      }

  return () => {
  // Redraw: clear the frame, paint the new body over the solid box, lay the glyph back on top.
  clearRect(img, f.x0, f.y0, f.x1, f.y1);
  const m = Math.round(Math.max(1, scale)); // a little air between neighbouring buttons
  paintBody(img, { x0: bx0 + (bx0 === f.x0 ? m : 0), y0: by0 + (by0 === f.y0 ? m : 0), x1: bx1 - (bx1 === f.x1 ? m : 0), y1: by1 - (by1 === f.y1 ? m : 0) }, style, fill, scale, style.corner, alpha / 255);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = cov[y * W + x]!;
      if (c > 0) blend(img, bx0 + x, by0 + y, colours[y * W + x] ?? ink, c);
    }
  };
}

/** Does the image carry REAPER's 1px guide border (the *_ol overlay format)? */
function hasGuideBorder(img: Img): boolean {
  const { width: w, height: h, data } = img;
  for (let x = 0; x < w; x++) if (isGuide(data, x * 4) || isGuide(data, ((h - 1) * w + x) * 4)) return true;
  for (let y = 0; y < h; y++) if (isGuide(data, y * w * 4) || isGuide(data, (y * w + w - 1) * 4)) return true;
  return false;
}

/** Button strips: N state frames side by side (3 in Default 7: normal, hover, pressed). */
export function restyleButtons(img: Img, src: Img, style: ArtStyle, scale: number): boolean {
  const e = hasGuideBorder(img) ? 1 : 0;
  const x0 = e, y0 = e, w = img.width - 2 * e, h = img.height - 2 * e;
  const ratio = (n: number) => w / n / h;
  const frames = w % 3 === 0 && ratio(3) >= 0.6 && ratio(3) <= 2.6 ? 3 : ratio(1) >= 0.6 && ratio(1) <= 2.6 ? 1 : 0;
  if (!frames || h < 8 * scale) return false;
  const fw = w / frames;
  // Plan every frame first: states must match, so one unsure frame keeps the whole strip as it was.
  const plans: FramePlan[] = [];
  for (let i = 0; i < frames; i++) plans.push(restyleFrame(img, src, { x0: x0 + i * fw, y0, x1: x0 + (i + 1) * fw, y1: y0 + h }, style, scale));
  if (plans.includes("unsure")) return false;
  let any = false;
  for (const p of plans) if (typeof p === "function") (p(), (any = true));
  return any;
}

// ───────────────────────────── knobs ─────────────────────────────

export interface KnobColors {
  body: RGB;
  rim: RGB;
  pointer: RGB;
  arc: RGB;
  track: RGB;
}

/** Draw a whole knob rotation stack (square frames stacked vertically, -135° … +135°). */
export function drawKnobStack(img: Img, style: ArtStyle, k: KnobColors, scale: number, bipolar: boolean): boolean {
  const s = img.width;
  const n = Math.floor(img.height / s);
  if (n < 2) return false;
  clearRect(img, 0, 0, img.width, img.height);
  for (let i = 0; i < n; i++) drawKnob(img, 0, i * s, s, style, k, scale, -135 + (270 * i) / (n - 1), bipolar);
  return true;
}

function drawKnob(img: Img, ox: number, oy: number, s: number, style: ArtStyle, k: KnobColors, scale: number, deg: number, bipolar: boolean): void {
  const c = s / 2;
  const R = s / 2 - 0.5 * scale;
  const ang = (deg * Math.PI) / 180;
  const start = bipolar ? 0 : -135;
  const lo = Math.min(start, deg), hi = Math.max(start, deg);
  const ringW = Math.max(1.6 * scale, s * 0.1);
  const flatArc = style.surface === "flat" && style.corner < 0.15; // square skins: arc knob
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const dx = x + 0.5 - c, dy = y + 0.5 - c;
      const r = Math.hypot(dx, dy);
      const a = (Math.atan2(dx, -dy) * 180) / Math.PI; // 0 = up, clockwise
      const X = ox + x, Y = oy + y;
      const inRange = a >= -135 && a <= 135;
      const onArc = a >= lo && a <= hi;
      if (flatArc || style.surface === "glass") {
        // Arc knob: a ring track with the value arc, and a small centre cap.
        const ringR = R - ringW / 2;
        const ringCov = clamp(ringW / 2 + 0.5 - Math.abs(r - ringR));
        if (inRange) blend(img, X, Y, k.track, ringCov);
        if (onArc) {
          blend(img, X, Y, k.arc, ringCov);
          if (style.surface === "glass") blend(img, X, Y, k.arc, 0.35 * Math.exp(-Math.abs(r - ringR) / (1.5 * scale)));
        }
        blend(img, X, Y, k.body, clamp(R * 0.55 + 0.5 - r));
      } else {
        // Round knob body with a rim.
        const cover = clamp(R + 0.5 - r);
        if (cover <= 0) continue;
        let col = k.body;
        if (style.surface === "gradient") col = lerp(lerp(k.body, WHITE, 0.3), lerp(k.body, BLACK, 0.3), clamp((dy / R + 1) / 2));
        blend(img, X, Y, col, cover);
        blend(img, X, Y, k.rim, clamp(scale + 0.5 - Math.abs(r - (R - scale / 2))) * cover);
        if (style.surface === "gradient") blend(img, X, Y, WHITE, clamp(1 - Math.hypot(dx + R * 0.3, dy + R * 0.35) / (R * 0.55)) * 0.35);
      }
      // Pointer line from near the centre towards the edge.
      const ux = Math.sin(ang), uy = -Math.cos(ang);
      const along = dx * ux + dy * uy;
      const across = Math.abs(dx * uy - dy * ux);
      const p0 = flatArc || style.surface === "glass" ? 0 : R * 0.25;
      const p1 = flatArc || style.surface === "glass" ? R * 0.55 : R * 0.85;
      if (along >= p0 && along <= p1) blend(img, X, Y, k.pointer, clamp(Math.max(0.8, scale * 0.9) + 0.5 - across));
    }
}

// ───────────────────────────── fader / pan thumbs ─────────────────────────────

/** Opaque blobs separated by fully transparent rows (vertical images) or columns. */
function blobs(img: Img, area: Box): Box[] {
  const solid = (x: number, y: number) => { const i = (y * img.width + x) * 4; return img.data[i + 3]! > 160 && !isGuide(img.data, i); };
  const vertical = area.y1 - area.y0 > area.x1 - area.x0;
  const out: Box[] = [];
  let cur: Box | null = null;
  const len = vertical ? area.y1 - area.y0 : area.x1 - area.x0;
  for (let i = 0; i < len; i++) {
    let lo = Infinity, hi = -Infinity;
    if (vertical) { for (let x = area.x0; x < area.x1; x++) if (solid(x, area.y0 + i)) (lo = Math.min(lo, x)), (hi = Math.max(hi, x)); }
    else for (let y = area.y0; y < area.y1; y++) if (solid(area.x0 + i, y)) (lo = Math.min(lo, y)), (hi = Math.max(hi, y));
    if (lo === Infinity) { if (cur) out.push(cur), (cur = null); continue; }
    const p = (vertical ? area.y0 : area.x0) + i;
    if (!cur) cur = vertical ? { x0: lo, x1: hi + 1, y0: p, y1: p + 1 } : { x0: p, x1: p + 1, y0: lo, y1: hi + 1 };
    else if (vertical) (cur.x0 = Math.min(cur.x0, lo)), (cur.x1 = Math.max(cur.x1, hi + 1)), (cur.y1 = p + 1);
    else (cur.y0 = Math.min(cur.y0, lo)), (cur.y1 = Math.max(cur.y1, hi + 1)), (cur.x1 = p + 1);
  }
  if (cur) out.push(cur);
  return out.filter((b) => (b.x1 - b.x0) * (b.y1 - b.y0) >= 16);
}

/** Fader caps and pan thumbs: each opaque blob becomes the skin's cap with a centre line. */
export function restyleThumb(img: Img, style: ArtStyle, cap: RGB, line: RGB, scale: number, verticalFader: boolean): boolean {
  const area: Box = { x0: 0, y0: 0, x1: img.width, y1: img.height };
  let bs = blobs(img, area);
  if (!bs.length) return false;
  // A vertical fader cap is drawn in pieces (top, groove, bottom): it becomes one cap.
  if (verticalFader) bs = [bs.reduce((a, b) => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) }))];
  clearRect(img, 0, 0, img.width, img.height); // guide pixels survive
  for (const b of bs) {
    // Square skins get a slim cap; others fill the blob.
    let box = b;
    if (style.surface === "flat" && style.corner < 0.15) {
      if (verticalFader) { const h = Math.max(4 * scale, (b.y1 - b.y0) * 0.45), m = (b.y0 + b.y1) / 2; box = { ...b, y0: Math.round(m - h / 2), y1: Math.round(m + h / 2) }; }
      else { const w = Math.max(4 * scale, (b.x1 - b.x0) * 0.4), m = (b.x0 + b.x1) / 2; box = { ...b, x0: Math.round(m - w / 2), x1: Math.round(m + w / 2) }; }
    }
    paintBody(img, box, style, cap, scale, style.corner);
    const lw = Math.max(1, Math.round(scale));
    if (verticalFader) {
      const m = Math.floor((box.y0 + box.y1) / 2 - lw / 2);
      for (let y = m; y < m + lw; y++) for (let x = box.x0 + 2 * lw; x < box.x1 - 2 * lw; x++) blend(img, x, y, line, 0.9);
    } else {
      const m = Math.floor((box.x0 + box.x1) / 2 - lw / 2);
      for (let x = m; x < m + lw; x++) for (let y = box.y0 + 2 * lw; y < box.y1 - 2 * lw; y++) blend(img, x, y, line, 0.9);
    }
  }
  return true;
}
