import type { SkinUi } from "../skins";
import { exact, fillImg, scaled, type Draw, type Frame } from "../kit/art";
import * as I from "../kit/icons";
import {
  arc, bitmap, Canvas, capsule, circle, darken, hex, hstack, intersect, lighten, mixc, outline, poly, polyline, rect, rrect, solid, union, vgrad,
  vstack, withGuides, type Paint, type RGB, type SDF,
} from "../kit/raster";
import type { Glyph, Kit, KitDef, KitSizes, ToolbarArt } from "../kit/types";
import { CENTER, fg, fill, H, meterLook, NONE, rgb, type Script, TRACK_FILL, W } from "../kit/walter";

/**
 * Pro Tools (2024–2025, dark): the Edit window's track headers and the Mix window's strips.
 *
 * Track header (medium height 59): a colour column, the name field (dark; light with dark text when
 * the track is selected) with its playlist arrow, the R / I / S / M buttons (two-tone faces, lit
 * red / green / yellow / orange), a row with the view and automation popups, the olive header meter,
 * the INSERTS A–E column and the I/O column (input and output popups, green-on-black volume and pan).
 * Mix strip (80 wide): INSERTS A–E, I / O, AUTO, pan knob + readout, I + record, S + M, fader beside
 * a scaled meter, volume readout and the name plate. Transport: a black counter with big green
 * digits, the selection, tempo and the transport buttons. Toolbar: dark plates, blue when lit.
 *
 * Everything is drawn here from simple shapes and our own stroke letters: no Avid artwork.
 */

/** Pro Tools colours (measured from Avid's 2024–2025 manuals at 100 %). */
const PT = {
  bar: hex("#252525"),
  hdr: hex("#2d2d2d"),
  name: hex("#1f1f1f"),
  nameText: hex("#bdbdbd"),
  nameSel: hex("#d4d4d4"),
  nameSelText: hex("#0c0c0c"),
  noColor: hex("#46505c"),
  btn: [hex("#6d6d6d"), hex("#515151")] as Face,
  rec: [hex("#7a6a69"), hex("#4b3733")] as Face,
  glyph: hex("#f2f2f2"),
  recDot: hex("#ded7d7"),
  chip: [hex("#5f5f5f"), hex("#4d4d4d")] as Face,
  chipText: hex("#c9c9c9"),
  chipDim: [hex("#444444"), hex("#3c3c3c")] as Face,
  slot: hex("#272727"),
  slotDot: hex("#6a6a6a"),
  slotOn: hex("#5e5e5e"),
  green: hex("#38d177"),
  readout: hex("#aadc48"),
  /** The Edit window's I/O column readouts are a softer green. */
  ioText: hex("#6acd80"),
  well: hex("#000000"),
  /** Mix strip: the strip, its dark sections (inserts, I/O, AUTO), the light fader panel, the gap between strips. */
  strip: hex("#3b3b3b"),
  section: hex("#303030"),
  panel: hex("#6e6e6e"),
  stripGap: hex("#2e2e2e"),
  band: hex("#303030"),
  bandText: hex("#e7e7e7"),
  light: [hex("#b9b9b9"), hex("#a3a3a3")] as Face,
  lightText: hex("#121212"),
  mixBtn: [hex("#8c8c8c"), hex("#777777")] as Face,
  mixRec: [hex("#7d6f6d"), hex("#5a4542")] as Face,
  tool: hex("#323232"),
  toolOn: hex("#1e6e99"),
  solo: hex("#e8c838"),
  mute: hex("#f0901e"),
  arm: hex("#e0382b"),
  /** Lit TrackInput button: Pro Tools' lime green. */
  inputLit: [hex("#85cf5f"), hex("#67b242")] as Face,
  rim: hex("#141414"),
  /** Unlit meter: olive at the top, greener toward the bottom (Mix window, measured). */
  meterOff: [hex("#464312"), hex("#384411")] as Face,
  /** Automation modes: off / trim-read, read, touch, write, latch, preview. */
  auto: { off: hex("#8a8a8a"), read: hex("#55c05c"), touch: hex("#e2a72c"), write: hex("#e6483c"), latch: hex("#b07ee6"), preview: hex("#5aa6e6") },
  /** The same on the Mix window's light popups. */
  autoDark: { off: hex("#3a3a3a"), read: hex("#2e6b18"), touch: hex("#8a5a00"), write: hex("#a01c12"), latch: hex("#5a2a96"), preview: hex("#1c5a96") },
};
type Face = [RGB, RGB];

function palette(_ui: SkinUi): Kit {
  return {
    id: "protools",
    look: "flat",
    radius: 2,
    c: {
      bg: hex("#232323"),
      panel: PT.bar,
      track: PT.hdr,
      trackSel: PT.hdr,
      face: PT.btn[0],
      line: hex("#393939"),
      deep: PT.rim,
      text: hex("#e6e6e6"),
      dim: hex("#a6a6a6"),
      accent: PT.toolOn,
      accent2: PT.green,
      solo: PT.solo,
      arm: PT.arm,
      play: PT.green,
      onInk: hex("#111111"),
      env: [PT.auto.read, PT.auto.touch, PT.auto.write, PT.auto.latch, PT.auto.preview],
      display: PT.well,
      displayText: PT.green,
      knob: PT.readout,
      notes: { off: hex("#6756f6"), on: hex("#b3aaff"), bg: hex("#787878") },
      meter: { off: hex("#3a3708"), low: hex("#2bcf3c"), mid: hex("#d2d42a"), high: hex("#f2a52a"), clip: hex("#e8231b") },
    },
  };
}

const SIZES: KitSizes = {
  tcpMute: [15, 16], tcpBtn: [15, 16], tcpSmall: [14, 14], tcpFx: [24, 16], tcpKnob: 18, tcpThumb: [8, 14],
  mcpMute: [24, 16], mcpBtn: [24, 16], mcpArm: [24, 16], mcpMon: [24, 16], mcpSmall: [74, 15], mcpKnob: 30, mcpThumb: [18, 40], mcpFaderW: 20,
  envBtn: [20, 18], envKnob: 18, trans: [30, 24], tap: [36, 22], menu: [20, 16], toolbar: 30,
};
/** Track header (medium, 59 px): R I S M x positions, the automation chip, the I/O column. */
const BTN_X = [22, 48, 73, 98];
const TCP_ENV: [number, number] = [25, 15];
const IO_W = 100;
const TCP_IO: [number, number] = [IO_W, 15];
const MCP_W = { track: 80, master: 80 };
/** Rows of the INSERTS A–E lists. */
const SLOT_H = 18;
/** Mix strip rows (y at 100 %): the dark sections, then the light panel with pan, buttons, fader and name. */
const MIX = { ins: 1, insH: 112, io: 116, ioH: 50, auto: 169, autoH: 32, panel: 204 };

// ---------------------------------------------------------------- lettering

type Strokes = { w: number; lines: [number, number][][]; dot?: [number, number] };
/**
 * A small stroke alphabet for the words baked into popups ("read", "Out 1-2", "auto touch"):
 * polylines in a unit box (x right, y down; 0 = cap height, 1 = baseline, x-height at 0.3).
 */
const LOW: Record<string, Strokes> = {
  a: { w: 0.56, lines: [[[0.08, 0.4], [0.32, 0.3], [0.7, 0.3], [0.95, 0.42], [0.95, 1]], [[0.95, 0.6], [0.3, 0.6], [0.04, 0.72], [0.04, 0.9], [0.26, 1], [0.66, 1], [0.95, 0.86]]] },
  c: { w: 0.52, lines: [[[0.98, 0.4], [0.72, 0.3], [0.3, 0.3], [0.03, 0.48], [0.03, 0.82], [0.3, 1], [0.72, 1], [0.98, 0.9]]] },
  d: { w: 0.58, lines: [[[0.97, 0], [0.97, 1]], [[0.97, 0.42], [0.7, 0.3], [0.3, 0.3], [0.03, 0.48], [0.03, 0.82], [0.3, 1], [0.7, 1], [0.97, 0.88]]] },
  e: { w: 0.56, lines: [[[0.03, 0.64], [0.97, 0.64], [0.97, 0.48], [0.72, 0.3], [0.3, 0.3], [0.03, 0.48], [0.03, 0.82], [0.3, 1], [0.74, 1], [0.97, 0.9]]] },
  f: { w: 0.36, lines: [[[0.98, 0.04], [0.72, 0], [0.42, 0.1], [0.42, 1]], [[0, 0.32], [0.94, 0.32]]] },
  g: { w: 0.58, lines: [[[0.97, 0.3], [0.97, 1.08], [0.7, 1.26], [0.28, 1.26], [0.06, 1.16]], [[0.97, 0.44], [0.7, 0.3], [0.3, 0.3], [0.03, 0.48], [0.03, 0.8], [0.3, 0.98], [0.7, 0.98], [0.97, 0.84]]] },
  h: { w: 0.56, lines: [[[0.03, 0], [0.03, 1]], [[0.03, 0.46], [0.3, 0.3], [0.7, 0.3], [0.97, 0.46], [0.97, 1]]] },
  i: { w: 0.14, lines: [[[0.5, 0.32], [0.5, 1]]], dot: [0.5, 0.08] },
  l: { w: 0.14, lines: [[[0.5, 0], [0.5, 1]]] },
  m: { w: 0.86, lines: [[[0.02, 0.3], [0.02, 1]], [[0.02, 0.44], [0.2, 0.3], [0.38, 0.3], [0.5, 0.44], [0.5, 1]], [[0.5, 0.44], [0.62, 0.3], [0.8, 0.3], [0.98, 0.44], [0.98, 1]]] },
  n: { w: 0.56, lines: [[[0.03, 0.3], [0.03, 1]], [[0.03, 0.46], [0.3, 0.3], [0.7, 0.3], [0.97, 0.46], [0.97, 1]]] },
  o: { w: 0.58, lines: [[[0.5, 0.3], [0.86, 0.37], [0.98, 0.65], [0.86, 0.93], [0.5, 1], [0.14, 0.93], [0.02, 0.65], [0.14, 0.37], [0.5, 0.3]]] },
  p: { w: 0.58, lines: [[[0.03, 0.3], [0.03, 1.26]], [[0.03, 0.44], [0.3, 0.3], [0.7, 0.3], [0.97, 0.48], [0.97, 0.82], [0.7, 1], [0.3, 1], [0.03, 0.86]]] },
  r: { w: 0.36, lines: [[[0.04, 0.3], [0.04, 1]], [[0.04, 0.52], [0.34, 0.34], [0.72, 0.3], [0.98, 0.34]]] },
  s: { w: 0.5, lines: [[[0.96, 0.38], [0.7, 0.3], [0.28, 0.3], [0.04, 0.42], [0.1, 0.58], [0.5, 0.64], [0.9, 0.72], [0.96, 0.88], [0.72, 1], [0.28, 1], [0.02, 0.92]]] },
  t: { w: 0.36, lines: [[[0.42, 0.08], [0.42, 0.86], [0.6, 1], [0.98, 1]], [[0, 0.32], [0.94, 0.32]]] },
  u: { w: 0.56, lines: [[[0.03, 0.3], [0.03, 0.84], [0.3, 1], [0.7, 1], [0.97, 0.84]], [[0.97, 0.3], [0.97, 1]]] },
  v: { w: 0.54, lines: [[[0, 0.3], [0.5, 1], [1, 0.3]]] },
  w: { w: 0.8, lines: [[[0, 0.3], [0.25, 1], [0.5, 0.42], [0.75, 1], [1, 0.3]]] },
  y: { w: 0.54, lines: [[[0, 0.3], [0.5, 1]], [[1, 0.3], [0.38, 1.26], [0.1, 1.26]]] },
  "-": { w: 0.34, lines: [[[0.06, 0.66], [0.94, 0.66]]] },
  O: { w: 0.72, lines: [[[0.5, 0], [0.86, 0.1], [0.99, 0.5], [0.86, 0.9], [0.5, 1], [0.14, 0.9], [0.01, 0.5], [0.14, 0.1], [0.5, 0]]] },
  R: { w: 0.6, lines: [[[0.04, 1], [0.04, 0], [0.68, 0], [0.95, 0.12], [0.95, 0.38], [0.68, 0.5], [0.04, 0.5]], [[0.52, 0.5], [0.98, 1]]] },
  E: { w: 0.52, lines: [[[0.98, 0], [0.04, 0], [0.04, 1], [0.98, 1]], [[0.04, 0.5], [0.84, 0.5]]] },
  D: { w: 0.62, lines: [[[0.04, 0], [0.04, 1], [0.55, 1], [0.92, 0.8], [0.99, 0.5], [0.92, 0.2], [0.55, 0], [0.04, 0]]] },
  C: { w: 0.62, lines: [[[0.98, 0.16], [0.74, 0], [0.36, 0], [0.06, 0.2], [0.01, 0.5], [0.06, 0.8], [0.36, 1], [0.74, 1], [0.98, 0.84]]] },
  H: { w: 0.62, lines: [[[0.04, 0], [0.04, 1]], [[0.96, 0], [0.96, 1]], [[0.04, 0.5], [0.96, 0.5]]] },
  W: { w: 0.94, lines: [[[0, 0], [0.22, 1], [0.5, 0.28], [0.78, 1], [1, 0]]] },
  V: { w: 0.66, lines: [[[0, 0], [0.5, 1], [1, 0]]] },
  K: { w: 0.6, lines: [[[0.04, 0], [0.04, 1]], [[0.98, 0], [0.04, 0.6]], [[0.36, 0.38], [0.98, 1]]] },
  B: { w: 0.6, lines: [[[0.04, 0.5], [0.66, 0.5], [0.92, 0.38], [0.92, 0.12], [0.66, 0], [0.04, 0], [0.04, 1], [0.7, 1], [0.97, 0.86], [0.97, 0.64], [0.7, 0.5]]] },
  G: { w: 0.66, lines: [[[0.98, 0.16], [0.74, 0], [0.36, 0], [0.06, 0.2], [0.01, 0.5], [0.06, 0.8], [0.36, 1], [0.74, 1], [0.98, 0.84], [0.98, 0.56], [0.6, 0.56]]] },
  Y: { w: 0.62, lines: [[[0, 0], [0.5, 0.52], [1, 0]], [[0.5, 0.52], [0.5, 1]]] },
  Z: { w: 0.56, lines: [[[0, 0], [1, 0], [0, 1], [1, 1]]] },
  // Serif capital I (Greek capital iota as a private key) for the input-monitor button.
  "Ι": { w: 0.46, lines: [[[0.04, 0.02], [0.96, 0.02]], [[0.5, 0.02], [0.5, 0.98]], [[0.04, 0.98], [0.96, 0.98]]] },
};

/** `words` slanted like an italic (shear about the centre line). */
function italic(sd: SDF, cy: number, k = 0.2): SDF {
  return (x, y) => sd(x + k * (y - cy), y);
}

/** A word, centred on (cx, cy) or left-aligned at x0 when `left` is given; u = cap height, wt = stroke weight (of u). */
function words(str: string, cx: number, cy: number, u: number, wt = 0.17, left?: number): SDF {
  const r = Math.max((u * wt) / 2, 0.68);
  const gap = u * 0.17 + r;
  const width = (ch: string) => (LOW[ch] ? LOW[ch]!.w * u : ch === " " ? u * 0.32 : I.textWidth(ch, u, wt, 0));
  const ws = [...str].map(width);
  const total = ws.reduce((a, b) => a + b, 0) + gap * (str.length - 1);
  let x = left ?? cx - total / 2;
  const parts: SDF[] = [];
  [...str].forEach((ch, i) => {
    const wd = ws[i]!;
    const L = LOW[ch];
    if (L) {
      const bx = x + r, by = cy - u / 2 + r, bw = Math.max(wd - 2 * r, 0.01), bh = u - 2 * r;
      for (const l of L.lines) parts.push(polyline(l.map(([a, b]) => [bx + a * bw, by + b * bh] as [number, number]), r));
      if (L.dot) parts.push(circle(bx + L.dot[0] * bw, by + L.dot[1] * bh, r * 1.15));
    } else if (ch !== " ") parts.push(I.text(ch, x + wd / 2, cy, u, wt, 0));
    x += wd + gap;
  });
  return parts.length ? union(...parts) : () => 1e9;
}
const chevron = (cx: number, cy: number, s: number): SDF => poly([[cx - s, cy - s * 0.5], [cx + s, cy - s * 0.5], [cx, cy + s * 0.6]]);

// ---------------------------------------------------------------- drawing

type G = ((cx: number, cy: number) => SDF) | null;
/** Two-tone paint: the top half one colour, the bottom half another (Pro Tools' button faces). */
const twoTone = (top: RGB, bot: RGB, split: number): Paint => (_x, y) => ({ c: y < split ? top : bot, a: 1 });
const shadeFace = ([t, b]: Face, f: Frame): Face => (f === 1 ? [lighten(t, 0.1), lighten(b, 0.1)] : f === 2 ? [darken(t, 0.14), darken(b, 0.14)] : [t, b]);

/** A Pro Tools button: two-tone face, a lighter top line, a dark rim and a 1px shadow below; 3 frames. */
function ptBtn(w: number, h: number, face: Face, glyph: G, ink: RGB): Draw {
  return scaled((s) => hstack(([0, 1, 2] as Frame[]).map((f) => {
    const cv = new Canvas(w, h, s);
    const px = 1 / s;
    const bh = h - px;
    const [t, b] = shadeFace(face, f);
    const shape = rrect(0, 0, w, bh, 2);
    cv.fill(rrect(0, px, w, bh, 2), solid(hex("#000000"), 0.35));
    cv.fill(shape, twoTone(t, b, Math.round((bh / 2) * s) / s));
    if (f !== 2) cv.fill(intersect(outline(rrect(px, px, w - 2 * px, bh - 2 * px, 1.5), px), rect(0, 0, w, 2 * px)), solid(lighten(t, 0.14)));
    cv.fill(outline(shape, px), solid(PT.rim, 0.9));
    if (glyph) cv.fill(glyph(w / 2, bh / 2 + (f === 2 ? 0.5 : 0)), solid(ink));
    return bitmap(cv);
  })));
}

/** A lit Pro Tools button face from one colour. */
const litFace = (c: RGB): Face => [lighten(c, 0.12), darken(c, 0.06)];

/**
 * A popup / chip: rounded face, an optional word (left or centred), an optional ▾ at the right.
 * `face` two-tone; 3 frames.
 */
function chip(w: number, h: number, face: Face, label: string, ink: RGB, opts: { arrow?: RGB; align?: "left" | "center"; u?: number; italic?: boolean; wt?: number } = {}): Draw {
  return scaled((s) => hstack(([0, 1, 2] as Frame[]).map((f) => {
    const cv = new Canvas(w, h, s);
    const px = 1 / s;
    const [t, b] = shadeFace(face, f);
    const shape = rrect(0, 0, w, h, 2);
    cv.fill(shape, vgrad(0, h, [[0, t], [1, b]]));
    if (f !== 2) cv.fill(intersect(outline(rrect(px, px, w - 2 * px, h - 2 * px, 1.5), px), rect(0, 0, w, 2 * px)), solid(lighten(t, 0.1)));
    cv.fill(outline(shape, px), solid(PT.rim, 0.85));
    const u = opts.u ?? Math.round(h * 0.5);
    const arrowW = opts.arrow ? 9 : 0;
    if (label) {
      const cy = h / 2 + u * 0.12 + (f === 2 ? 0.5 : 0);
      const wt = opts.wt ?? 0.17;
      const g = opts.align === "left" ? words(label, 0, cy, u, wt, 5) : words(label, (w - arrowW) / 2, cy, u, wt);
      cv.fill(opts.italic ? italic(g, cy) : g, solid(ink));
    }
    if (opts.arrow) cv.fill(chevron(w - 6, h / 2, 2.6), solid(opts.arrow));
    return bitmap(cv);
  })));
}

/** A stretchable slot (insert / popup background) with its left and right ends kept. 3 vertical slices when `slices`. */
function slotImg(w: number, h: number, paintSlot: (cv: Canvas, f: Frame, h: number) => void, guides: [number, number, number, number], slices = false): Draw {
  return scaled((s) => {
    const frames = (slices ? [0, 1, 2] : [0]) as Frame[];
    const b = vstack(frames.map((f) => {
      const cv = new Canvas(w, h, s);
      paintSlot(cv, f, h);
      return bitmap(cv);
    }));
    const [l, t, r, bt] = guides.map((g) => Math.round(g * s)) as [number, number, number, number];
    return withGuides(b, l, t, r, bt);
  });
}

/** An insert slot: 24 wide, SLOT_H tall per slice (2px gap below), stretchable. */
function insertSlot(state: "norm" | "empty" | "byp" | "off", mix: boolean): Draw {
  const h = SLOT_H;
  return slotImg(24, h, (cv, f, _h) => {
    const px = 1 / cv.s;
    const body = h - 2;
    const cell = 11;
    if (state === "empty") {
      cv.fill(rrect(0, 0, 24, body, 2), solid(mix ? hex("#4b4b4b") : PT.slot));
      if (f === 1) cv.fill(rrect(0, 0, 24, body, 2), solid(hex("#ffffff"), 0.06));
      cv.fill(circle(cell / 2 + 0.5, body / 2, 1.6), solid(mix ? hex("#2b2b2b") : PT.slotDot));
      return;
    }
    const face = state === "byp" ? hex("#3f4a63") : state === "off" ? hex("#5a3434") : mix ? hex("#6a6a6a") : PT.slotOn;
    cv.fill(rrect(0, 0, 24, body, 2), vgrad(0, body, [[0, lighten(face, f === 1 ? 0.16 : 0.08)], [1, darken(face, f === 2 ? 0.2 : 0.06)]]));
    cv.fill(rect(cell, 0, px, body), solid(PT.rim, 0.7));
    cv.fill(rrect(0, 0, cell, body, 2), solid(darken(face, 0.12)));
    cv.fill(circle(cell / 2 + 0.5, body / 2, 1.8), solid(state === "byp" ? hex("#8fa8e0") : hex("#dcdcdc")));
    cv.fill(outline(rrect(0, 0, 24, body, 2), px), solid(PT.rim, 0.8));
  }, [12, 4, 4, 5], true);
}

/** A dark popup background (stretchable) with a ▾ cell kept on the right: the Edit window's I/O selectors. */
function popupBg(face: Face, arrow: RGB): Draw {
  return slotImg(30, 16, (cv) => {
    const px = 1 / cv.s;
    const shape = rrect(0, 0, 30, 16, 2);
    cv.fill(shape, vgrad(0, 16, [[0, face[0]], [1, face[1]]]));
    cv.fill(intersect(outline(rrect(px, px, 30 - 2 * px, 16 - 2 * px, 1.5), px), rect(0, 0, 30, 2 * px)), solid(lighten(face[0], 0.1)));
    cv.fill(outline(shape, px), solid(PT.rim, 0.85));
    cv.fill(chevron(24, 8, 2.6), solid(arrow));
  }, [4, 4, 12, 4]);
}

/** A flat stretchable box: fill and a 1px rim. */
function boxImg(fillc: RGB, rim: RGB, r = 2): Draw {
  return slotImg(12, 12, (cv) => {
    const px = 1 / cv.s;
    cv.fill(rrect(0, 0, 12, 12, r), solid(fillc));
    cv.fill(outline(rrect(0, 0, 12, 12, r), px), solid(rim));
  }, [4, 4, 4, 4]);
}

/** Track header background: top lines, flat body, a black divider at the bottom (stretchable). */
function headerBg(body: RGB): Draw {
  return (s) => {
    const w = 20, h = 20, px = 1 / s;
    const cv = new Canvas(w, h, s);
    cv.fill(rect(0, 0, w, h), solid(body));
    cv.fill(rect(0, 0, w, px), solid(hex("#141414")));
    cv.fill(rect(0, px, w, px), solid(hex("#272727")));
    cv.fill(rect(0, h - px, w, px), solid(hex("#000000")));
    return withGuides(bitmap(cv), 2, 2, 2, 1);
  };
}

/**
 * Mix strip background (80 wide): dark rounded sections for INSERTS, I/O and AUTO on the strip grey, then the
 * light fader panel down to the name, a dark gap on the right. The top (sections) is kept; the panel stretches.
 */
function stripBg(): Draw {
  return (s) => {
    const w = MCP_W.track, top = MIX.panel + 8, mid = 4, foot = 6, h = top + mid + foot;
    const cv = new Canvas(w, h, s);
    const px = 1 / s;
    const x0 = 2, pw = w - 5;
    cv.fill(rect(0, 0, w, h), solid(PT.strip));
    const sect = (y: number, sh: number) => {
      cv.fill(rrect(x0, y, pw, sh, 3), solid(PT.section));
      cv.fill(outline(rrect(x0, y, pw, sh, 3), px), solid(hex("#2a2a2a")));
    };
    sect(MIX.ins, MIX.insH);
    sect(MIX.io, MIX.ioH);
    sect(MIX.auto, MIX.autoH);
    // The light panel: rounded top here, rounded bottom in the kept foot.
    cv.fill(rrect(x0, MIX.panel, pw, h - MIX.panel - 2, 4), solid(PT.panel));
    cv.fill(intersect(outline(rrect(x0, MIX.panel, pw, h - MIX.panel - 2, 4), px), rect(0, MIX.panel, w, 3)), solid(hex("#888888")));
    cv.fill(rect(w - 2, 0, 2, h), solid(PT.stripGap));
    const b = bitmap(cv);
    return withGuides(b, Math.round(8 * s), Math.round(top * s), Math.round(8 * s), Math.round(foot * s));
  };
}

/** The Mix fader cap: light grey, notched on both sides above the middle, darker top half, a dark band low down. */
function faderCap(w: number, h: number): Draw {
  return (s) => {
    const cv = new Canvas(w, h, s);
    const px = 1 / s;
    const ny = Math.round(h * 0.46);
    const shape: SDF = (x, y) => Math.max(rrect(0.5, 0.5, w - 1, h - 1, 3)(x, y), -circle(0.5, ny, 2.2)(x, y), -circle(w - 0.5, ny, 2.2)(x, y));
    cv.fill(rrect(1, 2, w - 1, h - 1.5, 3), solid(hex("#000000"), 0.4));
    cv.fill(shape, vgrad(0, h, [[0, hex("#9c9c9c")], [0.06, hex("#c9c9c9")], [0.1, hex("#8a8a8a")], [0.44, hex("#6f7070")], [0.5, hex("#c4c5c5")], [0.78, hex("#b9baba")], [0.82, hex("#7b7b7b")], [0.88, hex("#9a9a9a")], [1, hex("#bdbdbd")]]));
    cv.fill(outline(shape, px), solid(hex("#2c2c2c")));
    cv.fill(rect(3, ny - px / 2, w - 6, px), solid(hex("#3a3a3a"), 0.8));
    return bitmap(cv);
  };
}

/** Mix fader slot: a thin black groove with a grey edge (stretchable vertically). */
function faderSlot(w: number): Draw {
  return (s) => {
    const h = 40;
    const cv = new Canvas(w, h, s);
    const x = Math.round((w / 2 - 1.5) * s) / s;
    cv.fill(rect(x - 1 / s, 2, 3 + 2 / s, h - 4), solid(hex("#4e4e4e")));
    cv.fill(rect(x, 2, 3, h - 4), solid(hex("#050505")));
    const b = bitmap(cv);
    const g = Math.round(6 * s);
    const half = Math.floor(b.width / 2) - 1;
    return withGuides(b, half, g, half, g);
  };
}

/** Pro Tools pan knob stack: dark body inside a light ring, a white pointer, a green dot outside the ring at the value. */
function panKnob(size: number, frames = 49): Draw {
  const A = Math.PI / 180;
  return scaled((s) => vstack(Array.from({ length: frames }, (_, i) => {
    const a = (-135 + 270 * (i / (frames - 1))) * A;
    const cv = new Canvas(size, size, s);
    const c = size / 2;
    const ringR = size / 2 - 3.2;
    const dotR = size / 2 - 1.5;
    cv.fill(circle(c + Math.sin(a) * dotR, c - Math.cos(a) * dotR, 1.5), solid(hex("#8ee05a")));
    cv.fill(circle(c, c + 0.8, ringR + 0.4), solid(hex("#000000"), 0.45));
    cv.fill(circle(c, c, ringR), vgrad(c - ringR, c + ringR, [[0, hex("#a8a8a8")], [1, hex("#5c5c5c")]]));
    const br = ringR - 1.8;
    cv.fill(circle(c, c, br), vgrad(c - br, c + br, [[0, hex("#3a3a3a")], [1, hex("#242424")]]));
    const p = br - 0.6;
    cv.fill(capsule(c + Math.sin(a) * p * 0.12, c - Math.cos(a) * p * 0.12, c + Math.sin(a) * p, c - Math.cos(a) * p, Math.max(0.95, 0.7 / s)), solid(hex("#f4f4f4")));
    return bitmap(cv);
  })));
}

/** A transparent picture (fader art behind a readout, so the readout is the fader). */
const clear = fillImg([0, 0, 0], 0);
/** A transparent strip of `n` frames (toolbar animations). */
const clearStrip = (w: number, h: number): Draw => (s) => bitmap(new Canvas(w, h, s));

// ---------------------------------------------------------------- toolbar glyphs (u = 16 at 100 %)

const t = (u: number) => Math.max(u * 0.07, 0.7);
const ring = (sd: SDF, r: number): SDF => (x, y) => Math.abs(sd(x, y)) - r;

const magnifier = (cx: number, cy: number, u: number, sign: -1 | 0 | 1): SDF => {
  const parts = [ring(circle(cx - u * 0.08, cy - u * 0.08, u * 0.27), t(u)), capsule(cx + u * 0.13, cy + u * 0.13, cx + u * 0.4, cy + u * 0.4, t(u) * 1.7)];
  if (sign) parts.push(capsule(cx - u * 0.21, cy - u * 0.08, cx + u * 0.05, cy - u * 0.08, t(u)));
  if (sign > 0) parts.push(capsule(cx - u * 0.08, cy - u * 0.21, cx - u * 0.08, cy + u * 0.05, t(u)));
  return union(...parts);
};
const ibeam = (cx: number, cy: number, u: number): SDF => union(
  capsule(cx, cy - u * 0.36, cx, cy + u * 0.36, t(u)),
  polyline([[cx - u * 0.16, cy - u * 0.44], [cx, cy - u * 0.34], [cx + u * 0.16, cy - u * 0.44]], t(u)),
  polyline([[cx - u * 0.16, cy + u * 0.44], [cx, cy + u * 0.34], [cx + u * 0.16, cy + u * 0.44]], t(u)),
);
const hand = (cx: number, cy: number, u: number): SDF => union(
  rrect(cx - u * 0.26, cy - u * 0.02, u * 0.52, u * 0.42, u * 0.14),
  ...[-0.2, -0.07, 0.07, 0.2].map((d, i) => capsule(cx + u * d, cy + u * 0.06, cx + u * d, cy - u * (i === 0 || i === 3 ? 0.24 : 0.36), u * 0.06)),
  capsule(cx - u * 0.26, cy + u * 0.16, cx - u * 0.42, cy - u * 0.02, u * 0.06),
);
const trim = (cx: number, cy: number, u: number): SDF => union(
  polyline([[cx + u * 0.02, cy - u * 0.4], [cx - u * 0.14, cy - u * 0.4], [cx - u * 0.14, cy + u * 0.4], [cx + u * 0.02, cy + u * 0.4]], t(u)),
  capsule(cx - u * 0.02, cy, cx + u * 0.4, cy, t(u)),
  polyline([[cx + u * 0.26, cy - u * 0.14], [cx + u * 0.42, cy], [cx + u * 0.26, cy + u * 0.14]], t(u)),
);
const pencil = (cx: number, cy: number, u: number): SDF => {
  const a = Math.PI / 4, c = Math.cos(a), s = Math.sin(a);
  const pt = (x: number, y: number): [number, number] => [cx + x * c - y * s, cy + x * s + y * c];
  const body = poly([pt(-u * 0.42, -u * 0.09), pt(u * 0.2, -u * 0.09), pt(u * 0.2, u * 0.09), pt(-u * 0.42, u * 0.09)]);
  const tip = poly([pt(u * 0.26, -u * 0.09), pt(u * 0.46, 0), pt(u * 0.26, u * 0.09)]);
  return union(body, tip);
};
const speaker = (cx: number, cy: number, u: number): SDF => union(
  poly([[cx - u * 0.42, cy - u * 0.12], [cx - u * 0.26, cy - u * 0.12], [cx - u * 0.06, cy - u * 0.3], [cx - u * 0.06, cy + u * 0.3], [cx - u * 0.26, cy + u * 0.12], [cx - u * 0.42, cy + u * 0.12]]),
  arc(cx - u * 0.06, cy, u * 0.2, -55 * (Math.PI / 180), 55 * (Math.PI / 180), t(u)),
  arc(cx - u * 0.06, cy, u * 0.36, -55 * (Math.PI / 180), 55 * (Math.PI / 180), t(u)),
);
const glyphs: Record<string, Glyph> = {
  assist_protools_zoomer: (cx, cy, u) => magnifier(cx, cy, u, 0),
  assist_protools_zoomin: (cx, cy, u) => magnifier(cx, cy, u, 1),
  assist_protools_zoomout: (cx, cy, u) => magnifier(cx, cy, u, -1),
  assist_protools_trimmer: trim,
  assist_protools_selector: ibeam,
  assist_protools_grabber: hand,
  assist_protools_scrubber: speaker,
  assist_protools_pencil: pencil,
  // The Smart Tool: selector over grabber, with trim brackets either side.
  assist_protools_smart: (cx, cy, u) => union(
    ibeam(cx, cy - u * 0.2, u * 0.5),
    hand(cx, cy + u * 0.22, u * 0.5),
    polyline([[cx - u * 0.3, cy - u * 0.42], [cx - u * 0.44, cy - u * 0.42], [cx - u * 0.44, cy + u * 0.42], [cx - u * 0.3, cy + u * 0.42]], t(u)),
    polyline([[cx + u * 0.3, cy - u * 0.42], [cx + u * 0.44, cy - u * 0.42], [cx + u * 0.44, cy + u * 0.42], [cx + u * 0.3, cy + u * 0.42]], t(u)),
  ),
  assist_protools_focus: (cx, cy, u) => union(ring(rrect(cx - u * 0.46, cy - u * 0.32, u * 0.92, u * 0.64, u * 0.08), t(u)), words("AZ", cx, cy, u * 0.34, 0.2)),
  assist_protools_ifp: (cx, cy, u) => union(
    capsule(cx - u * 0.42, cy, cx + u * 0.12, cy, t(u)),
    polyline([[cx - u * 0.02, cy - u * 0.16], [cx + u * 0.14, cy], [cx - u * 0.02, cy + u * 0.16]], t(u)),
    capsule(cx + u * 0.34, cy - u * 0.4, cx + u * 0.34, cy + u * 0.4, t(u) * 1.2),
  ),
  assist_protools_ttt: (cx, cy, u) => union(
    polyline([[cx - u * 0.46, cy + u * 0.1], [cx - u * 0.2, cy + u * 0.1], [cx - u * 0.12, cy - u * 0.4], [cx - u * 0.04, cy + u * 0.36], [cx + u * 0.04, cy - u * 0.1], [cx + u * 0.12, cy + u * 0.1], [cx + u * 0.46, cy + u * 0.1]], t(u)),
    capsule(cx - u * 0.12, cy - u * 0.46, cx - u * 0.12, cy + u * 0.46, t(u) * 0.7),
  ),
  assist_protools_snap: (cx, cy, u) => union(I.tb.grid!(cx, cy, u * 0.95)),
  assist_protools_click: (cx, cy, u) => I.tb.metro!(cx, cy, u),
  assist_protools_countoff: (cx, cy, u) => union(ring(circle(cx, cy, u * 0.42), t(u)), I.text("2", cx, cy, u * 0.46, 0.2)),
  assist_protools_preroll: (cx, cy, u) => union(
    capsule(cx - u * 0.44, cy - u * 0.4, cx - u * 0.44, cy + u * 0.4, t(u)),
    capsule(cx - u * 0.36, cy, cx + u * 0.3, cy, t(u)),
    polyline([[cx + u * 0.14, cy - u * 0.16], [cx + u * 0.3, cy], [cx + u * 0.14, cy + u * 0.16]], t(u)),
    rrect(cx + u * 0.38, cy - u * 0.4, u * 0.1, u * 0.8, u * 0.03),
  ),
  assist_protools_loop: (cx, cy, u) => I.loop(cx, cy, u),
  assist_protools_punch: (cx, cy, u) => union(
    circle(cx, cy, u * 0.18),
    polyline([[cx - u * 0.26, cy - u * 0.36], [cx - u * 0.42, cy - u * 0.36], [cx - u * 0.42, cy + u * 0.36], [cx - u * 0.26, cy + u * 0.36]], t(u)),
    polyline([[cx + u * 0.26, cy - u * 0.36], [cx + u * 0.42, cy - u * 0.36], [cx + u * 0.42, cy + u * 0.36], [cx + u * 0.26, cy + u * 0.36]], t(u)),
  ),
  assist_protools_looprec: (cx, cy, u) => union(I.loop(cx, cy - u * 0.12, u * 0.85), circle(cx, cy + u * 0.32, u * 0.13)),
  assist_protools_mix: (cx, cy, u) => union(...[-0.3, 0, 0.3].flatMap((d, i) => [
    capsule(cx + u * d, cy - u * 0.42, cx + u * d, cy + u * 0.42, t(u) * 0.6),
    rrect(cx + u * d - u * 0.1, cy + u * [0.08, -0.22, 0.2][i]! - u * 0.07, u * 0.2, u * 0.14, u * 0.03),
  ])),
  assist_protools_memloc: (cx, cy, u) => union(
    capsule(cx - u * 0.26, cy - u * 0.44, cx - u * 0.26, cy + u * 0.44, t(u)),
    poly([[cx - u * 0.22, cy - u * 0.42], [cx + u * 0.38, cy - u * 0.42], [cx + u * 0.24, cy - u * 0.2], [cx + u * 0.38, cy + 0.02 * u], [cx - u * 0.22, cy + 0.02 * u]]),
  ),
  assist_protools_counter: (cx, cy, u) => union(ring(rrect(cx - u * 0.48, cy - u * 0.3, u * 0.96, u * 0.6, u * 0.06), t(u)), I.text("88", cx, cy, u * 0.34, 0.2)),
};

// ---------------------------------------------------------------- layout

/** `small` below `min` px of panel height, else `big`. */
const byH = (w: Script, min: number, small: string, big: string) => `h<${w.n(min)} ${small} ${big}`;
/** A text colour with a background fill: [fg][bg]. */
const fgbg = (c: RGB, b: RGB) => `[${rgb(c)} 255 ${rgb(b)} 255]`;

/** A static text label on a filled band (custom element). */
function band(w: Script, name: string, text: string, rect: string, ink: RGB, bg: RGB, font: string) {
  w.raw(`custom ${name} '${text}'`);
  w.set(name, rect);
  w.set(`${name}.color`, fgbg(ink, bg));
  w.set(`${name}.font`, font);
  w.set(`${name}.margin`, CENTER);
}

/** Green-on-black readout: the label with a black background on top of the (transparent) fader. */
function readout(w: Script, el: string, rect: string, ink = PT.readout) {
  w.set(el, rect);
  w.set(`${el}.fadermode`, "[-1]");
  w.set(`${el}.label`, rect);
  w.set(`${el}.label.color`, fgbg(ink, PT.well));
  w.set(`${el}.label.font`, w.font("value"));
  w.set(`${el}.label.margin`, CENTER);
  w.raw(`front ${el}.label`);
}

function tcp(k: Kit, w: Script) {
  const z = SIZES;
  // Colour column.
  w.custom("tcp.custom.kStrip");
  w.set("tcp.custom.kStrip", w.p(0, 0, 14, H(-1)));
  w.set("tcp.custom.kStrip.color", `?trackcolor_valid ${TRACK_FILL} ${fill(PT.noColor)}`);
  // Its decorations: the round options arrow at the top, the playlist-lanes square at the bottom (drawn, not buttons).
  w.custom("tcp.custom.kOpt", "k_opt");
  w.set("tcp.custom.kOpt", w.p(0, 2, 14, 12));
  w.raw("front tcp.custom.kOpt");
  w.custom("tcp.custom.kLanes", "k_lanes");
  w.set("tcp.custom.kLanes", `folderstate>0 [0] ${byH(w, 46, "[0]", w.p(0, H(-14), 14, 11))}`);
  w.raw("front tcp.custom.kLanes");
  // Name field (light when selected) and the playlist arrow cell.
  const name = byH(w, 30, w.p(15, 5, 97, 15), w.p(15, 2, 97, 14));
  w.custom("tcp.custom.kName");
  w.set("tcp.custom.kName", name);
  w.set("tcp.custom.kName.color", `?track_selected ${fill(PT.nameSel)} ${fill(PT.name)}`);
  w.custom("tcp.custom.kDrop", "k_drop");
  w.set("tcp.custom.kDrop", byH(w, 30, w.p(112, 5, 10, 15), w.p(112, 2, 10, 14)));
  w.set("tcp.label", name);
  w.set("tcp.label.margin", `[${w.n(3)} 0 ${w.n(3)} 0 0.5]`);
  w.set("tcp.label.font", w.font("label"));
  w.set("tcp.label.color", `?track_selected [${rgb(PT.nameSelText)}] [${rgb(PT.nameText)}]`);
  w.raw("front tcp.label");
  // R I S M.
  (["tcp.recarm", "tcp.recmon", "tcp.solo", "tcp.mute"] as const).forEach((el, i) => w.set(el, byH(w, 30, "[0]", w.at(BTN_X[i]!, 19, z.tcpBtn))));
  // Row 3: timebase, freeze, the view chip, the automation mode, the input glyph.
  const row3 = (name: string, img: string, x: number, ww: number) => {
    w.custom(name, img);
    w.set(name, byH(w, 46, "[0]", w.at(x, 39, [ww, 15])));
  };
  row3("tcp.custom.kTb", "k_chip_tb", 19, 11);
  row3("tcp.custom.kEl", "k_chip_el", 32, 11);
  row3("tcp.custom.kView", "k_chip_wave", 45, 30);
  w.set("tcp.env", byH(w, 46, "[0]", w.at(77, 39, TCP_ENV)));
  row3("tcp.custom.kIn", "k_glyph_in", 104, 13);
  // Folder button (folder tracks only), bottom of the colour column.
  w.set("tcp.folder", `folderstate>0 ${w.at(1, H(-16), z.tcpSmall)} [0]`);
  // Header meter.
  w.set("tcp.meter", w.p(125, 2, 9, H(-4)));
  meterLook(w, "tcp.meter", k, { scale: false, readout: false });
  // INSERTS A–E (REAPER's FX insert list in the track panel), or REAPER's FX button when that's off.
  const insX = 142;
  const ins = w.p(insX, 2, W(-(insX + IO_W + 8)), H(-4));
  w.set("tcp.fxlist", w.wide(300, ins, "[0]"));
  w.set("tcp.fxlist.font", `[${w.font("list").slice(1, -1)} ${w.n(SLOT_H)}]`);
  w.set("tcp.fxlist.margin", `[${w.n(13)} 0 ${w.n(4)} 0 0.5]`);
  w.set("tcp.fx", `tcp_fxlist_enabled>0 [0] ${w.wide(300, w.at(insX, 2, z.tcpFx), "[0]")}`);
  // I/O column: input, output, then a black box with volume and pan (side by side; stacked with labels when tall).
  const io = (y: number, ww: number, hh: number, dx = 0) => w.wide(240, w.p(W(-(IO_W + 4) + dx), y, ww, hh), "[0]");
  w.set("tcp.recinput", byH(w, 30, "[0]", io(2, IO_W, 15)));
  w.set("tcp.recinput.color", fg(PT.chipText));
  w.set("tcp.recinput.font", w.font("list"));
  w.set("tcp.recinput.margin", `[${w.n(6)} 0 ${w.n(14)} 0 0]`);
  w.set("tcp.io", byH(w, 30, "[0]", io(20, TCP_IO[0], TCP_IO[1])));
  const half = (IO_W - 4) / 2;
  w.custom("tcp.custom.kIoBox");
  w.set("tcp.custom.kIoBox", byH(w, 46, "[0]", byH(w, 76, io(38, IO_W, 18), io(38, IO_W, 36))));
  w.set("tcp.custom.kIoBox.color", fill(PT.well));
  const ioLabel = (name: string, text: string, y: number) => {
    w.raw(`custom ${name} '${text}'`);
    w.set(name, byH(w, 76, "[0]", io(y, 26, 16, 4)));
    w.set(`${name}.color`, `[${rgb(PT.ioText)} 255 0 0 0 0]`);
    w.set(`${name}.font`, w.font("value"));
    w.set(`${name}.margin`, "[0 0 0 0 0]");
    w.raw(`front ${name}`);
  };
  ioLabel("tcp.custom.kVolL", "vol", 39);
  ioLabel("tcp.custom.kPanL", "pan", 56);
  readout(w, "tcp.volume", byH(w, 30, io(5, half, 16), byH(w, 46, "[0]", byH(w, 76, io(39, half, 16, 1), io(39, IO_W - 34, 16, 30)))), PT.ioText);
  readout(w, "tcp.pan", byH(w, 30, io(5, half, 16, half + 3), byH(w, 46, "[0]", byH(w, 76, io(39, half, 16, half + 3), io(56, IO_W - 34, 16, 30)))), PT.ioText);
  for (const el of ["tcp.volume", "tcp.pan"]) w.set(`${el}.label.margin`, byH(w, 76, CENTER, `[0 0 ${w.n(4)} 0 1]`));
  for (const el of ["tcp.recmode", "tcp.phase", "tcp.trackidx", "tcp.foldercomp", "tcp.fxparm", "tcp.width", "tcp.fxin", "tcp.sendlist"]) w.set(el, "[0]");
}

function masterTcp(k: Kit, w: Script) {
  const z = SIZES;
  w.custom("master.tcp.custom.kStrip");
  w.set("master.tcp.custom.kStrip", w.p(0, 0, 14, H(-1)));
  w.set("master.tcp.custom.kStrip.color", fill(PT.noColor));
  const name = byH(w, 30, w.p(15, 5, 107, 15), w.p(15, 2, 107, 14));
  w.custom("master.tcp.custom.kName");
  w.set("master.tcp.custom.kName", name);
  w.set("master.tcp.custom.kName.color", fill(PT.name));
  w.set("master.tcp.label", name);
  w.set("master.tcp.label.margin", `[${w.n(3)} 0 ${w.n(3)} 0 0.5]`);
  w.set("master.tcp.label.font", w.font("label"));
  w.set("master.tcp.label.color", `[${rgb(PT.nameText)}]`);
  w.raw("front master.tcp.label");
  w.set("master.tcp.mute", byH(w, 30, "[0]", w.at(BTN_X[3]!, 19, z.tcpBtn)));
  w.set("master.tcp.solo", "[0]");
  w.set("master.tcp.env", byH(w, 46, "[0]", w.at(77, 39, TCP_ENV)));
  w.set("master.tcp.meter", w.p(125, 2, 9, H(-4)));
  meterLook(w, "master.tcp.meter", k, { scale: false, readout: false });
  w.set("master.tcp.fxlist", w.wide(300, w.p(142, 2, W(-(142 + IO_W + 8)), H(-4)), "[0]"));
  w.set("master.tcp.fxlist.font", `[${w.font("list").slice(1, -1)} ${w.n(SLOT_H)}]`);
  w.set("master.tcp.fxlist.margin", `[${w.n(13)} 0 ${w.n(4)} 0 0.5]`);
  const io = (y: number, ww: number, hh: number, dx = 0) => w.wide(240, w.p(W(-(IO_W + 4) + dx), y, ww, hh), "[0]");
  w.set("master.tcp.io", byH(w, 30, "[0]", io(2, TCP_IO[0], TCP_IO[1])));
  const half = (IO_W - 4) / 2;
  w.custom("master.tcp.custom.kIoBox");
  w.set("master.tcp.custom.kIoBox", byH(w, 30, "[0]", io(19, IO_W, 18)));
  w.set("master.tcp.custom.kIoBox.color", fill(PT.well));
  readout(w, "master.tcp.volume", byH(w, 30, io(5, half, 16), io(20, half, 16, 1)), PT.ioText);
  readout(w, "master.tcp.pan", byH(w, 30, io(5, half, 16, half + 3), io(20, half, 16, half + 3)), PT.ioText);
  for (const el of ["master.tcp.fx", "master.tcp.width", "master.tcp.sendlist", "master.tcp.fxparm"]) w.set(el, "[0]");
}

function mcp(k: Kit, w: Script, { master }: { master: boolean }) {
  const z = SIZES;
  const X = master ? "master.mcp" : "mcp";
  const bandFont = `[${w.font("label").slice(1, -1)}]`;
  const small = w.font("list");
  // The section titles sit on the dark rounded sections drawn into the strip background.
  const title = (name: string, text: string, y: number) => band(w, name, text, w.p(4, y, 71, 12), PT.bandText, PT.section, small);
  // INSERTS A–E: REAPER's extended mixer (inserts; sends below them when shown).
  title(`${X}.custom.kIns`, "INSERTS A-E", MIX.ins + 2);
  w.set(`${X}.extmixer.mode`, "[1]");
  w.set(`${X}.extmixer.position`, w.p(4, MIX.ins + 15, 71, 5 * SLOT_H + 6));
  w.raw(`front ${X}.extmixer`);
  w.set(`${X}.fxlist.font`, `[${small.slice(1, -1)} ${w.n(SLOT_H)}]`);
  w.set(`${X}.fxlist.margin`, `[${w.n(13)} 0 ${w.n(3)} 0 0.5]`);
  w.set(`${X}.sendlist.font`, `[${small.slice(1, -1)} ${w.n(SLOT_H)}]`);
  // I / O: input (tracks) and output.
  title(`${X}.custom.kLio`, "I / O", MIX.io + 2);
  if (!master) {
    w.set("mcp.recinput", w.p(4, MIX.io + 16, 71, 15));
    w.set("mcp.recinput.color", fg(PT.lightText));
    w.set("mcp.recinput.font", small);
    w.set("mcp.recinput.margin", `[${w.n(5)} 0 ${w.n(13)} 0 0.5]`);
  }
  w.set(`${X}.io`, w.at(4, master ? MIX.io + 16 : MIX.io + 33, [71, 15]));
  // AUTO: the automation mode popup.
  title(`${X}.custom.kLauto`, "AUTO", MIX.auto + 2);
  w.set(`${X}.env`, w.at(4, MIX.auto + 15, [71, 15]));
  // On the light panel: pan knob(s) and the green readout.
  const kn = z.mcpKnob;
  const P = MIX.panel;
  if (master) {
    w.set("master.mcp.pan", "[0]");
    w.set("master.mcp.width", "[0]");
  } else {
    w.set("mcp.pan", `trackpanmode>=5 ${w.at(8, P + 6, [kn, kn])} ${w.at(25, P + 6, [kn, kn])}`);
    w.set("mcp.pan.fadermode", "[1]");
    w.set("mcp.width", `trackpanmode>=5 ${w.at(42, P + 6, [kn, kn])} [0]`);
    w.set("mcp.width.fadermode", "[1]");
    w.custom("mcp.custom.kPanBox");
    w.set("mcp.custom.kPanBox", w.p(7, P + 39, 65, 15));
    w.set("mcp.custom.kPanBox.color", fill(PT.well));
    const box = (el: string, r: string) => {
      w.set(`${el}.label`, r);
      w.set(`${el}.label.color`, fgbg(PT.readout, PT.well));
      w.set(`${el}.label.font`, w.font("value"));
      w.set(`${el}.label.margin`, CENTER);
      w.raw(`front ${el}.label`);
    };
    box("mcp.pan", `trackpanmode>=5 ${w.p(8, P + 40, 31, 13)} ${w.p(8, P + 40, 63, 13)}`);
    box("mcp.width", `trackpanmode>=5 ${w.p(40, P + 40, 31, 13)} [0]`);
  }
  // I + record, then S + M (master: M only).
  const bx = [12, 44];
  if (!master) {
    w.set("mcp.recmon", w.at(bx[0]!, P + 59, z.mcpMon));
    w.set("mcp.recarm", w.at(bx[1]!, P + 59, z.mcpArm));
    w.set("mcp.solo", w.at(bx[0]!, P + 79, z.mcpBtn));
  } else w.set("master.mcp.solo", "[0]");
  w.set(`${X}.mute`, w.at(bx[1]!, master ? P + 8 : P + 79, z.mcpMute));
  // Fader (left) and meter in a black frame with its scale (right), down to above the readout.
  const top = master ? P + 32 : P + 104, foot = 62;
  w.set(`${X}.volume`, w.p(16, top, z.mcpFaderW, H(-(top + foot))));
  w.set(`${X}.volume.fadermode`, "[-1]");
  w.custom(`${X}.custom.kMeterBox`);
  w.set(`${X}.custom.kMeterBox`, w.p(52, top - 1, 18, H(-(top + foot - 2))));
  w.set(`${X}.custom.kMeterBox.color`, fill(PT.well));
  w.set(`${X}.meter`, w.p(53, top, 16, H(-(top + foot))));
  meterLook(w, `${X}.meter`, k, { scale: true, readout: false });
  w.set(`${X}.meter.vu.div`, "[2]");
  const scaleInk = `[216 216 216 200 0 0 0 0]`;
  w.set(`${X}.meter.scale.color.unlit.top`, scaleInk);
  w.set(`${X}.meter.scale.color.unlit.bottom`, scaleInk);
  // Volume readout (black, green), then the name plate.
  const vol = w.p(7, H(-(foot - 8)), 65, 15);
  w.set(`${X}.volume.label`, vol);
  w.set(`${X}.volume.label.color`, fgbg(PT.readout, PT.well));
  w.set(`${X}.volume.label.font`, w.font("value"));
  w.set(`${X}.volume.label.margin`, CENTER);
  w.raw(`front ${X}.volume.label`);
  // Track colour bar over the name, then the name plate (grey; white with blue ink when selected).
  w.custom(`${X}.custom.kCol`);
  w.set(`${X}.custom.kCol`, w.p(5, H(-30), 69, 3));
  w.set(`${X}.custom.kCol.color`, master ? NONE : `?trackcolor_valid ${TRACK_FILL} ${NONE}`);
  const name = w.p(5, H(-25), 69, 17);
  w.custom(`${X}.custom.kNameB`);
  w.set(`${X}.custom.kNameB`, name);
  w.set(`${X}.custom.kNameB.color`, master ? fill(hex("#5a5a5a")) : `?track_selected ${fill(hex("#2469f6"))} ${fill(hex("#5a5a5a"))}`);
  w.custom(`${X}.custom.kName`);
  w.set(`${X}.custom.kName`, `+ [1 1 -2 -2] ${name}`);
  w.set(`${X}.custom.kName.color`, master ? fill(hex("#9a9a9a")) : `?track_selected ${fill(hex("#ffffff"))} ${fill(hex("#9a9a9a"))}`);
  w.raw(`front ${X}.custom.kName`);
  w.set(`${X}.label`, name);
  w.set(`${X}.label.margin`, `[${w.n(2)} 0 ${w.n(2)} 0 0.5]`);
  w.set(`${X}.label.font`, bandFont);
  w.set(`${X}.label.color`, master ? `[${rgb(PT.lightText)}]` : `?track_selected [36 105 246] [${rgb(PT.lightText)}]`);
  w.raw(`front ${X}.label`);
  for (const el of ["fx", "phase", "trackidx", "fxin", "folder"]) w.set(`${X}.${el}`, "[0]");
  if (master) {
    w.set("master.mcp.mono", "[0]");
    w.set("master.mcp.menubutton", "[0]");
  }
}

function trans(_k: Kit, w: Script) {
  const z = SIZES;
  const HT = 64;
  w.set("trans.size", `[${w.n(1000)} ${w.n(HT)}]`);
  w.set("trans.size.minmax", `[${w.n(300)} ${w.n(HT)} ${w.n(4000)} ${w.n(144)}]`);
  w.set("trans.size.dockedheight", `[${w.n(HT)}]`);
  // One black counter panel, as in Pro Tools: the main counter (big green digits, right-aligned), then
  // the selection start / end / length, then tempo and meter, with thin dividers.
  w.custom("trans.custom.kPanel", "k_display");
  w.set("trans.custom.kPanel", w.wide(720, w.p(8, 4, 448, HT - 8), w.p(8, 4, 196, HT - 8)));
  // The main counter. REAPER sizes the digits to the text box (a .font does nothing here) and paints
  // the field last, over anything it overlaps: the element stays inside the well, while negative
  // margins widen the text box to 337 x 58 for Pro Tools' ~17 px digits (170 x 54 gave 9 px).
  const status = w.p(10, 5, 188, HT - 10);
  w.set("trans.status", status);
  w.set("trans.status.color", fg(PT.green));
  w.set("trans.status.margin", `[${[56, -2, -205, -2].map((v) => w.n(v)).join(" ")} 0]`);
  const divider = (name: string, x: number) => {
    w.custom(name);
    w.set(name, w.wide(720, w.p(x, 8, 1, HT - 16), "[0]"));
    w.set(`${name}.color`, fill(hex("#2c2c2c")));
  };
  divider("trans.custom.kDiv1", 202);
  divider("trans.custom.kDiv2", 378);
  // Selection start / end / length (REAPER's selection display: its own "Selection:" line, then the values).
  const sel = w.wide(720, w.p(206, 5, 168, HT - 10), "[0]");
  w.set("trans.sel", sel);
  w.set("trans.sel.color", fg(PT.green));
  w.set("trans.sel.font", w.font("tempo"));
  w.set("trans.sel.margin", `[${w.n(4)} 0 ${w.n(4)} 0 1]`);
  // Tempo and meter, stacked.
  const tempo = w.wide(720, w.p(382, 8, 70, 22), "[0]");
  w.set("trans.bpm.edit", tempo);
  w.set("trans.bpm.edit.font", w.font("tempo"));
  w.set("trans.bpm.edit.color", fg(PT.green));
  w.set("trans.bpm.edit.margin", `[0 0 ${w.n(6)} 0 1]`);
  const sig = w.wide(720, w.p(382, 34, 70, 22), "[0]");
  w.set("trans.curtimesig", sig);
  w.set("trans.curtimesig.font", w.font("tempo"));
  w.set("trans.curtimesig.color", fg(PT.green));
  // RTZ, REW, FF, END | stop, play, record | loop: on the right.
  const [bw, bh] = z.trans;
  const by = (HT - bh) / 2;
  const x0 = -8 - 8 * (bw + 3) - 12;
  const bx = (i: number) => W(x0 + i * (bw + 3) + (i >= 4 ? 6 : 0) + (i >= 7 ? 6 : 0));
  w.set("trans.rew", w.at(bx(0), by, z.trans));
  w.raw("custom trans.custom.kRew '' 40084 'Rewind' 'k_rew'");
  w.set("trans.custom.kRew", w.at(bx(1), by, z.trans));
  w.raw("custom trans.custom.kFf '' 40085 'Fast forward' 'k_ff'");
  w.set("trans.custom.kFf", w.at(bx(2), by, z.trans));
  w.set("trans.fwd", w.at(bx(3), by, z.trans));
  w.set("trans.stop", w.at(bx(4), by, z.trans));
  w.set("trans.play", w.at(bx(5), by, z.trans));
  w.set("trans.rec", w.at(bx(6), by, z.trans));
  w.set("trans.repeat", w.at(bx(7), by, z.trans));
  for (const el of ["trans.pause", "trans.automode", "trans.bpm.tap", "trans.rate", "trans.rate.fader"]) w.set(el, "[0]");
}

// ---------------------------------------------------------------- images

function images(k: Kit, out: Record<string, Draw>) {
  const c = k.c, z = SIZES;
  const L = (ch: string, u: number): G => (cx, cy) => words(ch, cx, cy, u, 0.22);
  const dot = (r: number): G => (cx, cy) => circle(cx, cy, r);
  const ring2 = (r: number): G => (cx, cy) => outline(circle(cx, cy, r), 1.3);

  // R / I / S / M: track header ("track_") and Mix ("mcp_") sizes and faces.
  for (const [p, [w, h], face, recFace] of [["track", z.tcpBtn, PT.btn, PT.rec], ["mcp", z.mcpBtn, PT.mixBtn, PT.mixRec]] as const) {
    const u = Math.round(h * 0.56);
    const r = h * 0.22;
    out[`${p}_recarm_off`] = ptBtn(w, h, recFace, dot(r), PT.recDot);
    out[`${p}_recarm_on`] = ptBtn(w, h, litFace(PT.arm), dot(r), hex("#fff1ee"));
    out[`${p}_recarm_norec`] = ptBtn(w, h, litFace(darken(PT.arm, 0.35)), dot(r), PT.recDot);
    out[`${p}_recarm_auto`] = ptBtn(w, h, recFace, ring2(r), PT.recDot);
    out[`${p}_recarm_auto_on`] = ptBtn(w, h, litFace(PT.arm), ring2(r), hex("#fff1ee"));
    out[`${p}_recarm_auto_norec`] = ptBtn(w, h, litFace(darken(PT.arm, 0.35)), ring2(r), PT.recDot);
    // TrackInput: auto (Pro Tools' Auto Input) and off are unlit; on (Input Only) is green.
    out[`${p}_monitor_off`] = ptBtn(w, h, face, L("Ι", u), mixc(PT.glyph, face[1], 0.45));
    out[`${p}_monitor_auto`] = ptBtn(w, h, face, L("Ι", u), PT.glyph);
    out[`${p}_monitor_on`] = ptBtn(w, h, PT.inputLit, L("Ι", u), hex("#ffffff"));
    out[`${p}_solo_off`] = ptBtn(w, h, face, L("S", u), PT.glyph);
    out[`${p}_solo_on`] = ptBtn(w, h, litFace(PT.solo), L("S", u), c.onInk);
    // REAPER's "mute_off" is the unmuted state.
    out[`${p}_mute_off`] = ptBtn(w, h, face, L("M", u), PT.glyph);
    out[`${p}_mute_on`] = ptBtn(w, h, litFace(PT.mute), L("M", u), c.onInk);
  }

  // Automation mode popups: the mode's word in its colour (dark chips in the header, light popups in the Mix window).
  const modes: [string, keyof typeof PT.auto, string][] = [["", "off", "read"], ["_read", "read", "read"], ["_touch", "touch", "touch"], ["_write", "write", "write"], ["_latch", "latch", "latch"], ["_preview", "preview", "prev"]];
  for (const [sfx, m, label] of modes) {
    out[`track_env${sfx}`] = chip(TCP_ENV[0], TCP_ENV[1], PT.chipDim, label, m === "off" ? hex("#7a7a7a") : PT.auto[m], { u: 6, italic: true });
    out[`mcp_env${sfx}`] = chip(z.mcpSmall[0], z.mcpSmall[1], PT.light, `auto ${label}`, m === "off" ? PT.autoDark.read : PT.autoDark[m], { arrow: hex("#5a5a5a"), u: 8, wt: 0.22 });
  }
  // Output selectors.
  for (const sfx of ["", "_r", "_s", "_s_r"]) {
    out[`track_io${sfx}`] = chip(TCP_IO[0], TCP_IO[1], PT.chip, "Out 1-2", PT.chipText, { arrow: hex("#bdbdbd"), align: "left", u: 8 });
    out[`track_io${sfx}_dis`] = chip(TCP_IO[0], TCP_IO[1], PT.chip, "no output", mixc(PT.chipText, PT.chip[1], 0.4), { arrow: hex("#bdbdbd"), align: "left", u: 8 });
    out[`mcp_io${sfx}`] = chip(z.mcpSmall[0], z.mcpSmall[1], PT.light, "Out 1-2", PT.lightText, { arrow: hex("#5a5a5a"), u: 8, wt: 0.22 });
    out[`mcp_io${sfx}_dis`] = chip(z.mcpSmall[0], z.mcpSmall[1], PT.light, "no output", hex("#555555"), { arrow: hex("#5a5a5a"), u: 8, wt: 0.22 });
  }
  out.master_tcp_io = chip(TCP_IO[0], TCP_IO[1], PT.chip, "Out 1-2", PT.chipText, { arrow: hex("#bdbdbd"), align: "left", u: 8 });
  out.master_mcp_io = chip(z.mcpSmall[0], z.mcpSmall[1], PT.light, "Out 1-2", PT.lightText, { arrow: hex("#5a5a5a"), u: 8, wt: 0.22 });
  // Input selectors: popup backgrounds under REAPER's input text.
  out.tcp_recinput = popupBg(PT.chip, hex("#bdbdbd"));
  out.mcp_recinput = popupBg(PT.light, hex("#5a5a5a"));
  // FX button (only when REAPER's insert list is off).
  const fxw: G = (cx, cy) => words("FX", cx, cy, 7, 0.2);
  out.track_fx_norm = ptBtn(z.tcpFx[0], z.tcpFx[1], PT.btn, fxw, PT.glyph);
  out.track_fx_empty = ptBtn(z.tcpFx[0], z.tcpFx[1], PT.btn, fxw, mixc(PT.glyph, PT.btn[1], 0.45));
  out.track_fx_dis = ptBtn(z.tcpFx[0], z.tcpFx[1], litFace(darken(PT.arm, 0.2)), fxw, PT.glyph);
  // Folder button: a small chip with a folder outline.
  const folderG: G = (cx, cy) => outline(union(rrect(cx - 4.5, cy - 2.5, 9, 6.5, 1), rrect(cx - 4.5, cy - 4, 4, 2.5, 0.8)), 1.1);
  for (const n of ["track_folder_on", "track_folder_off", "track_folder_last"]) out[n] = chip(z.tcpSmall[0], z.tcpSmall[1], PT.chip, "", PT.chipText);
  out.track_folder_on = scaledOverlay(out.track_folder_on!, z.tcpSmall, folderG, PT.chipText);
  out.track_folder_off = scaledOverlay(out.track_folder_off!, z.tcpSmall, folderG, mixc(PT.chipText, PT.chip[1], 0.5));
  out.track_folder_last = out.track_folder_off;

  // Colour-column decorations: light marks over the track colour (white, part transparent).
  out.k_opt = scaled((s) => {
    const cv = new Canvas(14, 12, s);
    cv.fill(circle(7, 6, 4.9), solid(hex("#ffffff"), 0.55));
    cv.fill(chevron(7, 5.6, 2.3), solid(hex("#000000"), 0.8));
    return bitmap(cv);
  });
  out.k_lanes = scaled((s) => {
    const cv = new Canvas(14, 11, s);
    cv.fill(rrect(2.5, 1, 9, 9, 1), solid(hex("#ffffff"), 0.5));
    cv.fill(union(capsule(3.4, 3.2, 10.2, 8.6, 0.55), capsule(5.6, 2, 10.6, 6, 0.55)), solid(hex("#000000"), 0.6));
    return bitmap(cv);
  });

  // Header decorations: the name field's playlist arrow and the row-3 chips.
  out.k_drop = (s) => {
    const cv = new Canvas(10, 14, s);
    cv.fill(rect(0, 0, 10, 14), solid(PT.name));
    cv.fill(rect(0, 0, 1 / s, 14), solid(hex("#2c2c2c")));
    cv.fill(chevron(5.5, 6, 2.8), solid(hex("#b4b4b4")));
    return bitmap(cv);
  };
  const deco = (w: number, h: number, g: (cx: number, cy: number) => SDF, ink: RGB): Draw => scaled((s) => {
    const cv = new Canvas(w, h, s);
    const px = 1 / s;
    cv.fill(rrect(0, 0, w, h, 2), vgrad(0, h, [[0, PT.chip[0]], [1, PT.chip[1]]]));
    cv.fill(outline(rrect(0, 0, w, h, 2), px), solid(PT.rim, 0.85));
    cv.fill(g(w / 2, h / 2), solid(ink));
    return bitmap(cv);
  });
  // Timebase (a blue pie with a quarter cut out), freeze (a six-spoke star), the view ("wave").
  out.k_chip_tb = deco(11, 15, (cx, cy) => {
    const qx = cx + 0.8, qy = cy - 0.8;
    return union(intersect(circle(cx - 0.3, cy + 0.3, 3.5), (x, y) => Math.min(x - (cx - 0.3), (cy + 0.3) - y)), intersect(circle(qx, qy, 3.5), (x, y) => Math.max(qx - x, y - qy)));
  }, hex("#3ebbff"));
  out.k_chip_el = deco(11, 15, (cx, cy) => union(...[0, 60, 120].map((a) => capsule(cx - Math.cos((a * Math.PI) / 180) * 3.4, cy - Math.sin((a * Math.PI) / 180) * 3.4, cx + Math.cos((a * Math.PI) / 180) * 3.4, cy + Math.sin((a * Math.PI) / 180) * 3.4, 0.75))), hex("#d0d0d0"));
  out.k_chip_wave = deco(30, 15, (cx, cy) => words("wave", cx, cy + 1, 7.5, 0.18), PT.chipText);
  // The input glyph at the end of row 3 (no chip behind it).
  out.k_glyph_in = scaled((s) => {
    const cv = new Canvas(13, 15, s);
    const cx = 6.5, cy = 7.5;
    cv.fill(union(capsule(cx, cy - 4.5, cx, cy + 2.5, 0.7), poly([[cx - 3.6, cy + 4.6], [cx + 3.6, cy + 4.6], [cx + 1.6, cy + 2.4], [cx - 1.6, cy + 2.4]])), solid(hex("#c8c8c8")));
    return bitmap(cv);
  });

  // INSERTS A–E slots (track header and Mix), and their list backgrounds.
  for (const st of ["norm", "empty", "byp", "off"] as const) {
    out[`tcp_fxlist_${st}`] = insertSlot(st, false);
    out[`mcp_fxlist_${st}`] = insertSlot(st, true);
  }
  out.tcp_fxlist_bg = clear;
  out.mcp_fxlist_bg = clear;
  out.mcp_extmixbg = fillImg(PT.section, 1);

  // Readouts and the counter well.
  out.k_display = boxImg(PT.well, hex("#3c3c3c"), 2);
  // The counter panel is drawn once (k_display); REAPER's own boxes inside it stay transparent, except
  // the position field: REAPER repaints the bar under it, so its background is the well's black.
  out.transport_status_bg = fillImg(PT.well, 1);
  out.transport_edit_bg = clear;
  out.transport_bpm_bg = clear;

  // Track header volume / pan: the readouts are the faders, so the fader art is transparent.
  for (const n of ["tcp_volbg", "tcp_volthumb", "tcp_panbg", "tcp_panthumb", "tcp_widthbg", "tcp_widththumb"]) out[n] = clear;
  // Mix: light grey fader cap in a black groove; Pro Tools pan knobs.
  out.mcp_volbg = faderSlot(z.mcpFaderW);
  out.mcp_volthumb = faderCap(z.mcpThumb[0], z.mcpThumb[1]);
  out.mcp_master_volbg = out.mcp_volbg;
  out.mcp_master_volthumb = out.mcp_volthumb;
  out.mcp_pan_knob_stack = panKnob(z.mcpKnob);
  out.mcp_wid_knob_stack = panKnob(z.mcpKnob);

  // Backgrounds.
  out.tcp_bg = headerBg(PT.hdr);
  out.tcp_bgsel = headerBg(PT.hdr);
  out.tcp_mainbg = out.tcp_bg;
  out.tcp_mainbgsel = out.tcp_bgsel;
  out.tcp_folderbg = out.tcp_bg;
  out.tcp_folderbgsel = out.tcp_bgsel;
  out.mcp_bg = stripBg();
  out.mcp_bgsel = out.mcp_bg;
  out.mcp_mainbg = out.mcp_bg;
  out.mcp_mainbgsel = out.mcp_bgsel;
  out.mcp_folderbg = out.mcp_bg;
  out.mcp_folderbgsel = out.mcp_bgsel;
  out.transport_bg = (s) => {
    const cv = new Canvas(20, 20, s);
    cv.fill(rect(0, 0, 20, 20), solid(PT.bar));
    cv.fill(rect(0, 20 - 1 / s, 20, 1 / s), solid(hex("#0e0e0e")));
    return withGuides(bitmap(cv), 2, 2, 2, 2);
  };

  // Transport buttons: dark square faces, light glyphs; play lights green, record red, loop blue.
  const [tw, th] = z.trans;
  const tu = th * 0.4;
  const tbtn = (name: string, g: (cx: number, cy: number, u: number) => SDF, ink: RGB, face: Face = [hex("#3a3a3a"), hex("#2e2e2e")]) => {
    out[name] = ptBtn(tw, th, face, (cx, cy) => g(cx, cy, tu), ink);
  };
  const light = hex("#d8d8d8");
  tbtn("transport_play", I.play, light);
  tbtn("transport_play_on", I.play, PT.green, [hex("#24452f"), hex("#1b3424")]);
  tbtn("transport_play_sync", I.play, c.accent2);
  tbtn("transport_play_sync_on", I.play, PT.green, [hex("#24452f"), hex("#1b3424")]);
  tbtn("transport_stop", I.stop, light);
  tbtn("transport_pause", I.pause, light);
  tbtn("transport_pause_on", I.pause, hex("#ffffff"), litFace(PT.toolOn));
  tbtn("transport_record", I.record, hex("#d0453b"));
  tbtn("transport_record_on", I.record, hex("#ffe4e0"), litFace(PT.arm));
  tbtn("transport_record_item", I.record, hex("#d0453b"));
  tbtn("transport_record_item_on", I.record, hex("#ffe4e0"), litFace(PT.arm));
  tbtn("transport_record_loop", I.record, hex("#d0453b"));
  tbtn("transport_record_loop_on", I.record, hex("#ffe4e0"), litFace(PT.arm));
  tbtn("transport_repeat_off", I.loop, light);
  tbtn("transport_repeat_on", I.loop, hex("#ffffff"), litFace(PT.toolOn));
  tbtn("transport_home", (x, y, u) => I.skip(x, y, u, -1), light);
  tbtn("transport_end", (x, y, u) => I.skip(x, y, u, 1), light);
  tbtn("k_rew", (x, y, u) => I.skip(x, y, u, -1, false), light);
  tbtn("k_ff", (x, y, u) => I.skip(x, y, u, 1, false), light);

  // Toolbar chrome: dark plates; lit (toggled on) plates are Pro Tools blue. No REAPER highlight animation.
  out.toolbar_blank = (s) => hstack(([0, 1, 2] as Frame[]).map((f) => {
    const zz = z.toolbar;
    const cv = new Canvas(zz, zz, s);
    const px = 1 / s;
    const plate = rrect(px, 3, zz - 2 * px, zz - 6, 2);
    const face = f === 2 ? PT.toolOn : f === 1 ? hex("#3c3c3c") : PT.tool;
    cv.fill(plate, vgrad(3, zz - 3, [[0, lighten(face, 0.06)], [1, darken(face, 0.06)]]));
    cv.fill(outline(plate, px), solid(hex("#161616")));
    return bitmap(cv);
  }));
  out.composite_toolbar_overlay = clearStrip(z.toolbar * 3, z.toolbar);
  out.animation_toolbar_highlight = clearStrip(z.toolbar, z.toolbar * 12);
  out.toolbar_bg = fillImg(PT.bar, 1);

  // Meters: olive when unlit, a dark red clip cell; no REAPER mute / solo boxes over them (Pro Tools has none).
  out.meter_clip_v = exact(4, 8, (_x, y) => (y < 4 ? hex("#2c0502") : c.meter.clip));
  // Colour maps (8 slots of 4px: unlit / lit pairs; row 0 = top of the meter, row 1 = bottom). Pro Tools' meters look the
  // same when the track is record-armed, so the armed pair repeats the normal one; unlit is olive, darker toward the bottom.
  const mTop = [PT.meterOff[0], c.meter.high, PT.meterOff[0], c.meter.high, PT.meterOff[0], c.meter.high, PT.meterOff[0], c.meter.clip];
  const mBot = [PT.meterOff[1], c.meter.low, PT.meterOff[1], c.meter.low, PT.meterOff[1], c.meter.low, PT.meterOff[1], c.meter.clip];
  out.meter_strip_v = exact(32, 2, (x, y) => (y === 0 ? mTop : mBot)[x >> 2]!);
  out.meter_strip_h = exact(2, 32, (x, y) => (x === 1 ? mTop : mBot)[y >> 2]!);
  for (const n of ["meter_mute", "meter_unsolo", "meter_solodim", "meter_automute", "meter_foldermute"]) out[n] = clear;
}

/** Draw a glyph over an existing 3-frame image of size [w, h]. */
function scaledOverlay(base: Draw, [w, h]: [number, number], g: (cx: number, cy: number) => SDF, ink: RGB): Draw {
  return scaled((s) => {
    const b = base(s);
    const fw = Math.round(w * s);
    const cv = new Canvas(w, h, s);
    cv.fill(g(w / 2, h / 2), solid(ink));
    const over = bitmap(cv);
    const data = new Uint8Array(b.data);
    for (let f = 0; f < 3; f++) {
      for (let y = 0; y < over.height; y++) for (let x = 0; x < over.width; x++) {
        const si = (y * over.width + x) * 4, a = over.data[si + 3]! / 255;
        if (a <= 0) continue;
        const di = (y * b.width + f * fw + x) * 4;
        for (let ch = 0; ch < 3; ch++) data[di + ch] = Math.round(over.data[si + ch]! * a + data[di + ch]! * (1 - a));
        data[di + 3] = Math.max(data[di + 3]!, over.data[si + 3]!);
      }
    }
    return { width: b.width, height: b.height, data };
  });
}

/**
 * The edit-mode cells (SHUFFLE / SPOT / SLIP / GRID), 60 × 30: dark green plates with green words, and the
 * lit mode a bright green plate with dark text, as in Pro Tools' mode block (colours measured from it).
 */
function modeCells(): Record<string, ToolbarArt> {
  const dark = hex("#042712"), hover = hex("#08341a"), bright = hex("#38d177");
  const cell = (word: string): ToolbarArt => ({
    w: 60,
    draw: (st, s) => {
      const cv = new Canvas(60, 30, s);
      cv.fill(rrect(0, 3, 60, 24, 2), solid(hex("#000000")));
      cv.fill(rrect(1, 4, 58, 22, 1.5), solid(st === 2 ? bright : st === 1 ? hover : dark));
      cv.fill(words(word, 30, 15, 7.5, 0.2), solid(st === 2 ? dark : bright));
      return bitmap(cv);
    },
  });
  return Object.fromEntries(["shuffle", "spot", "slip", "grid"].map((m) => [`assist_protools_mode_${m}`, cell(m.toUpperCase())]));
}

const protools: KitDef = {
  id: "protools",
  palette,
  sizes: SIZES,
  mcpWidth: MCP_W,
  fonts: { label: 1, value: 3, list: 2, tempo: 4, sig: 4 },
  faces: {
    slots: {
      1: { face: "Arial", mac: "Helvetica Neue", px: 12, weight: 700 },
      2: { face: "Arial", mac: "Helvetica Neue", px: 10, weight: 700 },
      3: { face: "Arial", mac: "Helvetica Neue", px: 11, weight: 700 },
      4: { face: "Arial", mac: "Helvetica Neue", px: 12, weight: 700 },
    },
    ruler: { face: "Arial", mac: "Helvetica Neue", px: 10, weight: 400 },
    // The main counter's face (REAPER sizes its digits to the field; see trans()).
    transport: { face: "Arial", mac: "Helvetica Neue", px: 24, weight: 400 },
    items: { face: "Arial", mac: "Helvetica Neue", px: 11, weight: 700 },
    volpan: { face: "Arial", mac: "Helvetica Neue", px: 10, weight: 700 },
    title: { face: "Arial", mac: "Helvetica Neue", px: 12, weight: 700 },
  },
  // Volume readouts without "dB" (Pro Tools shows "0.0", "-3.2"), at most 5 characters.
  globals: {
    tcp_heights: "4 26 59 59", tcp_master_minheight: "40", tcp_folderindent: "0",
    tcp_voltext_flags: "1 5", tcp_master_voltext_flags: "1 5", mcp_voltext_flags: "1 5", mcp_master_voltext_flags: "1 5",
  },
  layout: { tcp, masterTcp, mcp, trans },
  images,
  toolbarGlyphs: glyphs,
  // Tool glyphs: light grey on the dark plates, near-white on the lit (blue) plate, as in Pro Tools.
  toolbarInk: { normal: "#bebebe", hover: "#e6e6e6", on: "#f2f2f2" },
  toolbarArt: modeCells(),
};

export default protools;
