import type { SkinUi } from "../skins";
import { fillImg, scaled, type Draw, type Frame } from "../kit/art";
import * as I from "../kit/icons";
import {
  arc, bitmap, Canvas, capsule, circle, darken, hex, hstack, intersect, lighten, mixc, outline, poly, polyline, rect, rpoly, rrect, solid, subtract, union, vgrad, vstack, withGuides,
  type RGB, type SDF,
} from "../kit/raster";
import type { Glyph, Kit, KitDef, KitSizes, MeterRange } from "../kit/types";
import { CENTER, extMixer, fg, fill, H, meterLook, ON_COLOR, type Script, TRACK_FILL, type V, W } from "../kit/walter";

/**
 * Studio One 6/7 (default dark appearance, "Colorize Track Controls" off), measured from the
 * PreSonus / Fender manual screenshots at 100 %.
 *
 * Track header (255 px; "Normal" = 60 px): a 10 px colour strip with the show-automation square at
 * its foot | track number | one rounded M · S · ● · ◐ button group | name; a thin volume bar under
 * the group, the input selector on armed tracks; a slim two-bar meter down the right edge. Lit: mute
 * dark red, solo yellow, record salmon red, monitor light blue (while armed).
 * Events: the track colour with a darker name tab at the top-left; selected ones edged in cyan along the top and
 * bottom. Toolbar: tools on a dark strip.
 * Console channel (86 px): a track-colour line, the Inserts header over the inserts and sends, a second
 * track-colour line, input and output boxes, the dark
 * V panner with its readout, the M S / ● ◐ block, the dB readout, scale | meter | fader, number,
 * automation and the name on the track colour.
 * Transport (46 px): a grey bar with a near-black centre panel (time display, locate buttons,
 * stop / play / record / loop, loop range, metronome, timing, tempo) and Edit / Mix / Browse.
 *
 * Everything is drawn here from simple shapes; nothing is traced from Studio One.
 */

const C = {
  def: "#0475e2", // a track without a colour (Studio One's default track colour)
  panel: "#3b3e43",
  panelSel: "#646a71",
  line: "#1c1e20",
  stripLine: "#25282c",
  border: "#292b2e",
  cell: "#44484d",
  cellHi: "#4f5357",
  cellSep: "#34373b",
  ink: "#e4e7e8",
  num: "#dfe0e1",
  mute: "#a82928",
  solo: "#dbb14e",
  rec: "#dd625e",
  mon: "#7bb5ca",
  barEdge: "#17191b",
  bar: "#34373c",
  barFill: "#c9cbce",
  field: "#555a60",
  fieldEdge: "#3a3e42",
  console: "#3b3e43",
  consoleSel: "#5e656c",
  consoleEdge: "#121416",
  box: "#3c3f43",
  boxEdge: "#27292c",
  trans: "#373a3e",
  transLine: "#0b0c0d",
  transPanel: "#141414",
  transInk: "#c0c0c0",
  time: "#e6e6e6",
  caption: "#8d9094",
  stop: "#2eb3d8",
  toolStrip: "#222323",
  blue: "#347fd4",
  slot: "#4b4f54",
  slotByp: "#404348",
  slotText: "#c2c6ca",
  slotArrow: "#8a8e93",
  selLine: "#00e5ff",
} as const;
const X = Object.fromEntries(Object.entries(C).map(([k, v]) => [k, hex(v)])) as Record<keyof typeof C, RGB>;

function palette(ui: SkinUi): Kit {
  const u = (key: keyof SkinUi) => hex(ui[key]);
  return {
    id: "studioone",
    look: "flat",
    radius: 3,
    c: {
      bg: u("bg"),
      panel: u("panel"),
      track: X.panel,
      trackSel: X.panelSel,
      face: X.cell,
      line: u("border"),
      deep: X.barEdge,
      text: u("text"),
      dim: u("textDim"),
      accent: X.blue,
      // REAPER paints its MIDI-activity box at the top of each track meter in a mix of this and the text
      // colour; Studio One has none, so this keeps it a dim blue that barely shows on the meter.
      accent2: hex("#042649"),
      solo: X.solo,
      arm: X.rec,
      play: hex("#62c46a"),
      onInk: hex("#ffffff"),
      // Automation modes: read, touch, write, latch, preview.
      env: [hex("#8fc77f"), hex("#e3c15a"), hex("#dd625e"), hex("#e39a52"), hex("#7bb5ca")],
      display: X.transPanel,
      displayText: X.time,
      knob: X.blue,
      notes: { off: hex("#0475e2"), on: hex("#8cc4ff"), bg: hex("#2b2d31") },
      meter: { off: hex("#44494f"), low: hex("#3f9fe0"), mid: hex("#5ab6ec"), high: hex("#95d3f6"), clip: hex("#e0524a") },
    },
  };
}

// Header cells are 24 × 22 (Studio One's group is 95 × 22); console cells 34 × 20.
const SIZES: KitSizes = {
  tcpMute: [24, 22], tcpBtn: [24, 22], tcpSmall: [24, 22], tcpFx: [24, 22], tcpKnob: 18, tcpThumb: [8, 6],
  mcpMute: [34, 20], mcpBtn: [34, 20], mcpArm: [34, 20], mcpMon: [34, 20], mcpSmall: [78, 16], mcpKnob: 22, mcpThumb: [18, 34], mcpFaderW: 22,
  envBtn: [20, 18], envKnob: 18, trans: [32, 30], tap: [36, 26], menu: [34, 20], toolbar: 30,
};
const TCP_W = 255;
const STRIP = 10; // colour strip width
const GX = 35; // button group left edge
const [CW, CH] = SIZES.tcpMute;
const NAME_X = GX + 4 * CW + 4;
const VOL: [number, number, number, number] = [GX, 30, 131, 6]; // volume bar
const PANY = 41; // pan bar
const MW = 86, MMW = 96; // console channel, Main channel

// ---------------------------------------------------------------- drawing helpers

type G = (cx: number, cy: number) => SDF;
const px1 = (s: number) => 1 / s;
const snap = (v: number, s: number) => Math.round(v * s) / s;
const CLEAR = fillImg([0, 0, 0], 0);

/** Three frames of the same drawing: normal, hover, pressed. */
const frames = (w: number, h: number, paint: (cv: Canvas, f: Frame, s: number) => void): Draw =>
  scaled((s) => hstack(([0, 1, 2] as Frame[]).map((f) => {
    const cv = new Canvas(w, h, s);
    paint(cv, f, s);
    return bitmap(cv);
  })));

const hover = (c: RGB, f: Frame) => (f === 1 ? lighten(c, 0.08) : f === 2 ? darken(c, 0.12) : c);

type Pos = "first" | "mid" | "last" | "only";

/**
 * One cell of Studio One's rounded button group. Cells sit edge to edge; the first and last round
 * the group's ends; between cells a dark line with a light line after it.
 */
function cell(w: number, h: number, pos: Pos, glyph: G | null, ink: RGB, lit: RGB | null, r = 3, hollow = false): Draw {
  return frames(w, h, (cv, f, s) => {
    const p = px1(s);
    const L = pos === "first" || pos === "only", R = pos === "last" || pos === "only";
    const ext = r + 2;
    const x0 = L ? 0 : -ext, x1 = R ? w : w + ext;
    const shape = rrect(x0, 0, x1 - x0, h, r);
    const inner = rrect(x0 + p, p, x1 - x0 - 2 * p, h - 2 * p, Math.max(r - p, 0));
    // A hollow cell lets a fill behind it show (the monitor button, lit while the track is armed).
    if (!hollow) cv.fill(inner, solid(hover(lit ?? X.cell, f)));
    cv.fill(outline(shape, p), solid(X.border));
    // A light line along the cell's left inside edge; a dark one where it meets the cell before.
    if (L) cv.fill(intersect(inner, rect(p, p, p, h - 2 * p)), solid(lit ? lighten(lit, 0.18) : X.cellHi));
    else {
      cv.fill(rect(0, p, p, h - 2 * p), solid(lit ? darken(lit, 0.25) : X.cellSep));
      cv.fill(rect(p, p, p, h - 2 * p), solid(lit ? lighten(lit, 0.18) : X.cellHi));
    }
    if (glyph) cv.fill(glyph(w / 2 + p, h / 2 + (f === 2 ? 0.5 : 0)), solid(f === 1 && !lit ? lighten(ink, 0.3) : ink));
  });
}

const letter = (s: string, u: number, weight = 0.12): G => (cx, cy) => I.text(s, cx, cy, u, weight, 0.2);
const recDot = (d: number): G => (cx, cy) => circle(cx, cy, d / 2);
/** The monitor glyph: the left half filled, the right half an open arc, a hairline apart. */
const monGlyph = (d: number): G => (cx, cy) => {
  const r = d / 2, t = Math.max(d * 0.13, 0.9), gap = 0.7;
  const left = intersect(circle(cx, cy, r), rect(cx - r - 1, cy - r - 1, r + 1 - gap / 2, 2 * r + 2));
  const right = intersect(outline(circle(cx, cy, r), t), rect(cx + gap / 2, cy - r - 1, r + 1, 2 * r + 2));
  return union(left, right);
};
/** Studio One's button letters: thin strokes, caps about 10 px. */
const btnM = (h: number): G => (cx, cy) => {
  const w = h * 0.84, l = cx - w / 2, rr = cx + w / 2, t = cy - h / 2, b = cy + h / 2;
  return polyline([[l, b], [l, t], [cx, t + h * 0.64], [rr, t], [rr, b]], Math.max(h * 0.058, 0.5));
};
const btnS = (h: number): G => (cx, cy) => sCurve(cx - h * 0.36, cy - h / 2, cx + h * 0.36, cy + h / 2, Math.max(h * 0.064, 0.5));

/** A flat panel with a 1 px line along some edges (stretchable). */
function flatPanel(fillc: RGB, lines: Partial<Record<"top" | "bottom" | "left" | "right", RGB>>): Draw {
  return (s) => {
    const w = 12, h = 12, p = px1(s);
    const cv = new Canvas(w, h, s);
    cv.fill(rect(0, 0, w, h), solid(fillc));
    if (lines.top) cv.fill(rect(0, 0, w, p), solid(lines.top));
    if (lines.bottom) cv.fill(rect(0, h - p, w, p), solid(lines.bottom));
    if (lines.left) cv.fill(rect(0, 0, p, h), solid(lines.left));
    if (lines.right) cv.fill(rect(w - p, 0, p, h), solid(lines.right));
    return withGuides(bitmap(cv), 2, 2, 2, 2);
  };
}

/** The thin level bar: dark, a 1 px darker edge (stretchable). */
function barGroove(h: number, centreMark: boolean): Draw {
  return (s) => {
    const w = 40, p = px1(s);
    const cv = new Canvas(w, h, s);
    cv.fill(rrect(0, 0, w, h, 1.5), solid(X.barEdge));
    cv.fill(rrect(p, p, w - 2 * p, h - 2 * p, 1), solid(X.bar));
    if (centreMark) cv.fill(rect(snap(w / 2 - p / 2, s), p, p, h - 2 * p), solid(mixc(X.bar, X.barFill, 0.5)));
    const g = Math.ceil(4 * s);
    return withGuides(bitmap(cv), g, 0, g, 0);
  };
}

/** The bar's handle: a short light block. */
function barThumb(w: number, h: number): Draw {
  return (s) => {
    const cv = new Canvas(w, h, s);
    cv.fill(rrect(0, 0, w, h, 1), solid(X.barEdge));
    cv.fill(rect(px1(s), px1(s), w - 2 * px1(s), h - 2 * px1(s)), solid(X.barFill));
    return bitmap(cv);
  };
}

/** A drop-down field (stretchable): rounded, flat, a small ▾ at the right. */
function dropField(fillc: RGB, edge: RGB, arrow: RGB | null, h = 16): Draw {
  return (s) => {
    const w = 40, p = px1(s);
    const cv = new Canvas(w, h, s);
    cv.fill(rrect(0, 0, w, h, 2), solid(edge));
    cv.fill(rrect(p, p, w - 2 * p, h - 2 * p, 2 - p), solid(fillc));
    if (arrow) cv.fill(poly([[w - 12, h / 2 - 1.5], [w - 6, h / 2 - 1.5], [w - 9, h / 2 + 2]]), solid(arrow));
    const gl = Math.ceil(4 * s), gr = Math.ceil((arrow ? 15 : 4) * s), gv = Math.ceil(4 * s);
    return withGuides(bitmap(cv), gl, gv, gr, gv);
  };
}

/** A transparent overlay for the colour strip: darkens what is under it, with a light glyph. */
function stripButton(w: number, h: number, glyph: G | null, ink: RGB, shadeA = 0.3): Draw {
  return frames(w, h, (cv, f) => {
    cv.fill(rect(0, 0, w, h), solid([0, 0, 0], f === 1 ? shadeA + 0.1 : f === 2 ? shadeA + 0.2 : shadeA));
    if (glyph) cv.fill(glyph(w / 2, h / 2), solid(ink));
  });
}
const autoWave = (u: number): G => (cx, cy) => {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 16; i++) pts.push([cx - u / 2 + (i / 16) * u, cy - Math.sin((i / 16) * Math.PI * 2) * u * 0.3]);
  return polyline(pts, Math.max(u * 0.07, 0.6));
};

/** A transport glyph with no plate (drawn straight on the dark panel). */
const tglyph = (w: number, h: number, g: G, ink: RGB): Draw =>
  frames(w, h, (cv, f) => cv.fill(g(w / 2, h / 2 + (f === 2 ? 0.5 : 0)), solid(f === 1 ? lighten(ink, 0.25) : f === 2 ? darken(ink, 0.15) : ink)));

/** The transport's dark centre panel: square top, cut bottom corners (stretchable). */
function transPanel(h: number): Draw {
  return (s) => {
    const w = 40, cut = 5;
    const cv = new Canvas(w, h, s);
    cv.fill(poly([[0, 0], [w, 0], [w, h - cut], [w - cut, h], [cut, h], [0, h - cut]]), solid(X.transPanel));
    const g = Math.ceil((cut + 2) * s);
    return withGuides(bitmap(cv), g, g, g, g);
  };
}

/** Edit / Mix / Browse: a full-height area with the word and a dark line on its left. */
function tabArea(h: number, text: string): Draw {
  return frames(56, h, (cv, f, s) => {
    if (f) cv.fill(rect(0, 0, 56, h), solid(f === 1 ? lighten(X.trans, 0.06) : X.blue));
    cv.fill(rect(0, 1, px1(s), h - 1), solid(hex("#292c2f")));
    cv.fill(word(text, 28, h / 2 + 1, 8.8), solid(hex("#e3e5e7")));
  });
}

/** A console scale mark: the number right-aligned against a short tick. */
const MARK_W = 15, MARK_H = 9;
function mark(label: string): Draw {
  return scaled((s) => {
    const cv = new Canvas(MARK_W, MARK_H, s);
    const y = snap(MARK_H / 2 - px1(s) / 2, s);
    cv.fill(rect(MARK_W - 2, y, 2, px1(s)), solid(hex("#80858b")));
    if (label) {
      const u = 5.5, wd = I.textWidth(label, u, 0.15, 0.06);
      cv.fill(I.text(label, MARK_W - 3 - wd / 2, MARK_H / 2, u, 0.15, 0.06), solid(hex("#d6d9db")));
    }
    return bitmap(cv);
  });
}
const MARKS: [number, string, string][] = [[6, "k_s1_m6", "6"], [0, "k_s1_m0", "0"], [-6, "k_s1_mn6", "6"], [-12, "k_s1_mn12", "12"], [-24, "k_s1_mn24", "24"], [-36, "k_s1_mn36", "36"], [-48, "k_s1_mn48", "48"]];

/**
 * An insert / send row (REAPER's list images hold three states stacked: normal | hover | pressed, each a row
 * tall; stretchable): a raised bar with the power glyph on the left and a ▾ on the right, the name between them.
 * An empty row is clear (a faint bar on hover).
 */
const SLOT_H = 18;
function fxSlot(face: RGB | null, power: RGB | null): Draw {
  return scaled((s) => {
    const w = 32, h = SLOT_H, cy = (h - 2) / 2;
    const b = vstack(([0, 1, 2] as Frame[]).map((f) => {
      const cv = new Canvas(w, h, s);
      const body = rrect(0, 0, w, h - 2, 2);
      if (face) {
        cv.fill(body, solid(hover(face, f)));
        if (power) cv.fill(I.power(8, cy, 9), solid(power));
        cv.fill(poly([[w - 9.5, cy - 1.5], [w - 3.5, cy - 1.5], [w - 6.5, cy + 2]]), solid(X.slotArrow));
      } else if (f) cv.fill(body, solid(hex("#ffffff"), f === 1 ? 0.05 : 0.09));
      return bitmap(cv);
    }));
    return withGuides(b, Math.round(15 * s), Math.round(4 * s), Math.round(13 * s), Math.round(5 * s));
  });
}

/** The Inserts header at the top of a channel: power glyph, the word, ▾ and + on the right (exact width). */
function insertsHeader(w: number): Draw {
  return (s) => {
    const h = 16, cy = h / 2;
    const cv = new Canvas(w, h, s);
    cv.fill(I.power(7, cy, 9), solid(X.slotArrow));
    cv.fill(word("Inserts", 16 + wordWidth("Inserts", 7.4) / 2, cy, 7.4), solid(X.slotText));
    cv.fill(poly([[w - 22, cy - 1.5], [w - 15, cy - 1.5], [w - 18.5, cy + 2.5]]), solid(X.slotArrow));
    cv.fill(union(rect(w - 10.5, cy - 0.65, 8, 1.3), rect(w - 7.15, cy - 4, 1.3, 8)), solid(X.slotArrow));
    return bitmap(cv);
  };
}

/** Console fader cap: light, square-cornered, a dark centre line. */
function faderCap(w: number, h: number, body: RGB): Draw {
  return (s) => {
    const cv = new Canvas(w, h, s);
    const p = px1(s);
    cv.fill(rrect(0, 0, w, h, 1.5), solid(darken(body, 0.45)));
    cv.fill(rrect(p, p, w - 2 * p, h - 2 * p, 1), vgrad(0, h, [[0, lighten(body, 0.2)], [0.25, body], [0.75, body], [1, darken(body, 0.18)]]));
    cv.fill(rect(p, snap(h / 2 - p / 2, s), w - 2 * p, p), solid(darken(body, 0.6)));
    return bitmap(cv);
  };
}

/** The console fader groove: dark, a black centre line (stretchable). */
function faderSlot(w: number): Draw {
  return (s) => {
    const h = 40, p = px1(s);
    const cv = new Canvas(w, h, s);
    cv.fill(rect(2, 0, w - 4, h), solid(hex("#2d3034")));
    cv.fill(rect(3, 0, w - 6, h), solid(hex("#323437")));
    cv.fill(rect(snap(w / 2 - 1, s), 0, 2, h), solid(hex("#111214")));
    cv.fill(rect(1, 0, p, h), solid(hex("#4e545a")));
    cv.fill(rect(w - 1 - p, 0, p, h), solid(hex("#4e545a")));
    const b = bitmap(cv);
    const half = Math.floor(b.width / 2) - 1, g = Math.round(4 * s);
    return withGuides(b, half, g, half, g);
  };
}

/** The console panner: a black box with a dark V (stretchable). */
function panBox(h: number): Draw {
  return (s) => {
    const w = 40;
    const cv = new Canvas(w, h, s);
    cv.fill(rect(0, 0, w, h), solid(hex("#0c0c0c")));
    cv.fill(poly([[1, 1], [w - 1, 1], [w / 2 + 1, h - 1], [w / 2 - 1, h - 1]]), solid(hex("#202326")));
    const g = Math.ceil(6 * s);
    return withGuides(bitmap(cv), g, 0, g, 0);
  };
}

// ---------------------------------------------------------------- a small sans stroke font
// REAPER draws no text for custom elements, so the transport captions, the Edit / Mix / Browse
// tabs and the console's boxes carry their words as drawings. Mixed case, thin strokes, sized by
// cap height (C); x-height 0.72 C.

type Letter = { w: number; d: (x: number, yb: number, w: number, C: number, r: number) => SDF };
const ring = (s: SDF, r: number): SDF => (x, y) => Math.abs(s(x, y)) - r;
const seg = (ax: number, ay: number, bx: number, by: number, r: number) => capsule(ax, ay, bx, by, r);
/** A round bowl (stadium ring) between x0..x1, y0..y1 (centre lines). */
const bowl = (x0: number, y0: number, x1: number, y1: number, r: number) => ring(rrect(x0, y0, x1 - x0, y1 - y0, Math.min(x1 - x0, y1 - y0) / 2), r);
/** An arch: the top half of a bowl, with its sides running down to y1. */
const arch = (x0: number, y0: number, x1: number, y1: number, r: number) => {
  const rad = (x1 - x0) / 2;
  return union(intersect(ring(rrect(x0, y0, x1 - x0, rad * 2.2, rad), r), rect(x0 - r - 1, y0 - r - 1, x1 - x0 + 2 * r + 2, rad + r + 1)), seg(x1, y0 + rad, x1, y1, r));
};
/** An S-curve between x0..x1, y0..y1 (centre lines). */
const sCurve = (x0: number, y0: number, x1: number, y1: number, r: number) => {
  const cx = (x0 + x1) / 2, rx = (x1 - x0) / 2, ry = (y1 - y0) / 4, D = Math.PI / 180;
  const pts: [number, number][] = [];
  for (let a = 55; a >= -180; a -= 10) pts.push([cx + Math.sin(a * D) * rx, y0 + ry - Math.cos(a * D) * ry]);
  for (let a = 0; a <= 235; a += 10) pts.push([cx + Math.sin(a * D) * rx, y1 - ry - Math.cos(a * D) * ry]);
  return polyline(pts, r);
};
const FONT: Record<string, Letter> = (() => {
  const L: Record<string, Letter> = {};
  const XH = 0.72, DE = 0.22;
  // Helpers in glyph space: l / r edges (centre lines), b baseline, x x-height, c cap, g descender.
  const g = (w: number, f: (e: { l: number; rr: number; m: number; b: number; xh: number; c: number; dn: number; r: number; w: number }) => SDF): Letter => ({
    w,
    d: (x, yb, wd, C, r) => f({ l: x + r, rr: x + wd - r, m: x + wd / 2, b: yb - r, xh: yb - XH * C + r, c: yb - C + r, dn: yb + DE * C - r, r, w: wd }),
  });
  L.o = g(0.58, (e) => bowl(e.l, e.xh, e.rr, e.b, e.r));
  L.c = g(0.52, (e) => subtract(bowl(e.l, e.xh, e.rr, e.b, e.r), rect(e.m, e.xh + (e.b - e.xh) * 0.3, e.w, (e.b - e.xh) * 0.4)));
  L.e = g(0.56, (e) => {
    const my = (e.xh + e.b) / 2;
    return union(subtract(bowl(e.l, e.xh, e.rr, e.b, e.r), rect(e.m, my + e.r * 0.6, e.w, (e.b - my) * 0.55)), seg(e.l, my, e.rr, my, e.r));
  });
  // Two-storey (a hook over a low bowl), so small captions don't read it as a q.
  L.a = g(0.54, (e) => {
    const hh = e.b - e.xh, ww = e.rr - e.l;
    return union(
      seg(e.rr, e.xh + hh * 0.3, e.rr, e.b + e.r, e.r),
      polyline([[e.l + ww * 0.1, e.xh + hh * 0.14], [e.l + ww * 0.42, e.xh], [e.rr - ww * 0.14, e.xh + hh * 0.06], [e.rr, e.xh + hh * 0.32]], e.r),
      bowl(e.l, e.xh + hh * 0.46, e.rr, e.b, e.r),
    );
  });
  L.d = g(0.58, (e) => union(bowl(e.l, e.xh, e.rr, e.b, e.r), seg(e.rr, e.c, e.rr, e.b + e.r, e.r)));
  L.b = g(0.58, (e) => union(bowl(e.l, e.xh, e.rr, e.b, e.r), seg(e.l, e.c, e.l, e.b + e.r, e.r)));
  L.p = g(0.58, (e) => union(bowl(e.l, e.xh, e.rr, e.b, e.r), seg(e.l, e.xh, e.l, e.dn, e.r)));
  L.g = g(0.58, (e) => {
    const hk = e.dn - e.b;
    return union(bowl(e.l, e.xh, e.rr, e.b, e.r), seg(e.rr, e.xh, e.rr, e.b + hk * 0.3, e.r), intersect(ring(rrect(e.l, e.b - hk * 0.7, e.rr - e.l, hk * 1.7, hk * 0.85), e.r), rect(e.l - 2, e.b + hk * 0.3, e.w + 4, hk * 2)));
  });
  L.n = g(0.56, (e) => union(seg(e.l, e.xh, e.l, e.b + e.r, e.r), arch(e.l, e.xh, e.rr, e.b + e.r, e.r)));
  L.h = g(0.56, (e) => union(seg(e.l, e.c, e.l, e.b + e.r, e.r), arch(e.l, e.xh, e.rr, e.b + e.r, e.r)));
  L.m = g(0.86, (e) => union(seg(e.l, e.xh, e.l, e.b + e.r, e.r), arch(e.l, e.xh, e.m, e.b + e.r, e.r), arch(e.m, e.xh, e.rr, e.b + e.r, e.r)));
  L.u = g(0.56, (e) => {
    const rad = (e.rr - e.l) / 2;
    return union(seg(e.rr, e.xh, e.rr, e.b + e.r, e.r), intersect(ring(rrect(e.l, e.b - rad * 2.2, e.rr - e.l, rad * 2.2, rad), e.r), rect(e.l - 2, e.b - rad, e.w + 4, rad + 2)), seg(e.l, e.xh, e.l, e.b - rad, e.r));
  });
  L.r = g(0.36, (e) => union(seg(e.l, e.xh, e.l, e.b + e.r, e.r), polyline([[e.l, e.xh + (e.b - e.xh) * 0.38], [e.l + (e.rr - e.l) * 0.3, e.xh + 0.2], [e.rr + e.r * 0.5, e.xh]], e.r)));
  L.s = g(0.5, (e) => sCurve(e.l, e.xh, e.rr, e.b, e.r));
  L.t = g(0.34, (e) => {
    const sx = e.l + (e.rr - e.l) * 0.3;
    return union(polyline([[sx, e.c + (e.xh - e.c) * 0.25], [sx, e.b - 0.8], [sx + 0.8, e.b], [e.rr + e.r * 0.5, e.b]], e.r), seg(e.l - e.r * 0.5, e.xh, e.rr + e.r * 0.5, e.xh, e.r));
  });
  L.i = g(0.2, (e) => union(seg(e.m, e.xh, e.m, e.b + e.r, e.r), circle(e.m, e.c + e.r * 0.4, e.r * 1.25)));
  L.l = g(0.2, (e) => seg(e.m, e.c, e.m, e.b + e.r, e.r));
  L.f = g(0.36, (e) => {
    const sx = e.l + (e.rr - e.l) * 0.32;
    return union(polyline([[sx, e.b + e.r], [sx, e.c + 1], [sx + 1, e.c], [e.rr + e.r * 0.5, e.c]], e.r), seg(e.l - e.r * 0.5, e.xh, e.rr - (e.rr - e.l) * 0.1, e.xh, e.r));
  });
  L.k = g(0.5, (e) => union(seg(e.l, e.c, e.l, e.b + e.r, e.r), seg(e.rr, e.xh, e.l, e.b - (e.b - e.xh) * 0.42, e.r), seg(e.l + (e.rr - e.l) * 0.32, e.b - (e.b - e.xh) * 0.55, e.rr, e.b + e.r * 0.5, e.r)));
  L.w = g(0.78, (e) => polyline([[e.l, e.xh], [e.l + (e.rr - e.l) * 0.25, e.b], [e.m, e.xh + 0.5], [e.l + (e.rr - e.l) * 0.75, e.b], [e.rr, e.xh]], e.r));
  L.v = g(0.5, (e) => polyline([[e.l, e.xh], [e.m, e.b], [e.rr, e.xh]], e.r));
  L.x = g(0.5, (e) => union(seg(e.l, e.xh, e.rr, e.b + e.r * 0.5, e.r), seg(e.rr, e.xh, e.l, e.b + e.r * 0.5, e.r)));
  L.y = g(0.5, (e) => union(seg(e.l, e.xh, e.m, e.b, e.r), seg(e.rr, e.xh, e.l + (e.rr - e.l) * 0.25, e.dn, e.r)));
  L.B = g(0.6, (e) => {
    const my = (e.c + e.b) / 2;
    return union(seg(e.l, e.c, e.l, e.b, e.r), intersect(ring(rrect(e.l - e.w, e.c, e.rr - e.r - (e.l - e.w), my - e.c, (my - e.c) / 2), e.r), rect(e.l, e.c - 2, e.w + 2, my - e.c + 4)), intersect(ring(rrect(e.l - e.w, my, e.rr - (e.l - e.w), e.b - my, (e.b - my) / 2), e.r), rect(e.l, my - 2, e.w + 2, e.b - my + 4)));
  });
  L.E = g(0.52, (e) => union(polyline([[e.rr, e.c], [e.l, e.c], [e.l, e.b], [e.rr, e.b]], e.r), seg(e.l, (e.c + e.b) / 2, e.rr - (e.rr - e.l) * 0.12, (e.c + e.b) / 2, e.r)));
  L.R = g(0.6, (e) => {
    const my = (e.c + e.b) / 2 + 0.3;
    return union(seg(e.l, e.c, e.l, e.b + e.r, e.r), intersect(ring(rrect(e.l - e.w, e.c, e.rr - (e.l - e.w), my - e.c, (my - e.c) / 2), e.r), rect(e.l, e.c - 2, e.w + 2, my - e.c + 4)), seg(e.l + (e.rr - e.l) * 0.5, my, e.rr, e.b + e.r * 0.5, e.r));
  });
  L.M = g(0.8, (e) => polyline([[e.l, e.b + e.r], [e.l, e.c], [e.m, e.b - (e.b - e.c) * 0.3], [e.rr, e.c], [e.rr, e.b + e.r]], e.r));
  L.T = g(0.58, (e) => union(seg(e.l - e.r * 0.5, e.c, e.rr + e.r * 0.5, e.c, e.r), seg(e.m, e.c, e.m, e.b + e.r, e.r)));
  L.A = g(0.66, (e) => union(polyline([[e.l, e.b + e.r], [e.m, e.c], [e.rr, e.b + e.r]], e.r), seg(e.l + (e.rr - e.l) * 0.22, e.b - (e.b - e.c) * 0.32, e.rr - (e.rr - e.l) * 0.22, e.b - (e.b - e.c) * 0.32, e.r)));
  L.O = g(0.74, (e) => bowl(e.l, e.c, e.rr, e.b, e.r));
  L.C = g(0.66, (e) => subtract(bowl(e.l, e.c, e.rr, e.b, e.r), rect(e.m + (e.rr - e.l) * 0.1, e.c + (e.b - e.c) * 0.32, e.w, (e.b - e.c) * 0.36)));
  L.S = g(0.58, (e) => sCurve(e.l, e.c, e.rr, e.b, e.r));
  L.W = g(0.92, (e) => polyline([[e.l, e.c], [e.l + (e.rr - e.l) * 0.24, e.b], [e.m, e.c + 0.5], [e.l + (e.rr - e.l) * 0.76, e.b], [e.rr, e.c]], e.r));
  L.L = g(0.48, (e) => polyline([[e.l, e.c], [e.l, e.b], [e.rr, e.b]], e.r));
  L.P = g(0.58, (e) => {
    const my = (e.c + e.b) / 2 + 0.5;
    return union(seg(e.l, e.c, e.l, e.b + e.r, e.r), intersect(ring(rrect(e.l - e.w, e.c, e.rr - (e.l - e.w), my - e.c, (my - e.c) / 2), e.r), rect(e.l, e.c - 2, e.w + 2, my - e.c + 4)));
  });
  L.I = g(0.2, (e) => seg(e.m, e.c, e.m, e.b + e.r, e.r));
  L[":"] = g(0.2, (e) => union(circle(e.m, e.xh + e.r * 0.5, e.r * 1.2), circle(e.m, e.b - e.r * 0.2, e.r * 1.2)));
  L[" "] = { w: 0.28, d: () => () => 1e9 };
  return L;
})();
const SPACING = 0.12;
const fontR = (C: number) => Math.max(C * 0.07, 0.5);
/** Width of a word at cap height C. */
const wordWidth = (str: string, C: number) => [...str].reduce((a, ch) => a + (FONT[ch]?.w ?? 0.5) * C, 0) + SPACING * C * (str.length - 1);
/** A word centred on (cx, cy) (cy = the middle of the cap height), cap height C. */
function word(str: string, cx: number, cy: number, C: number): SDF {
  const r = fontR(C), yb = cy + C / 2;
  let x = cx - wordWidth(str, C) / 2;
  const parts: SDF[] = [];
  for (const ch of str) {
    const L = FONT[ch];
    if (L) parts.push(L.d(x, yb, L.w * C, C, r));
    x += (L?.w ?? 0.5) * C + SPACING * C;
  }
  return union(...parts);
}

/** A flat box with a word (exact size). */
function boxWord(w: number, h: number, text: string, ink: RGB, fillc: RGB = X.box): Draw {
  return frames(w, h, (cv, f, s) => {
    const p = px1(s);
    cv.fill(rrect(0, 0, w, h, 2), solid(X.boxEdge));
    cv.fill(rrect(p, p, w - 2 * p, h - 2 * p, 2 - p), solid(hover(fillc, f)));
    if (text) cv.fill(word(text, w / 2, h / 2, 7), solid(ink));
  });
}

/** A word on its own (a caption): one frame, transparent around the text. */
function captionImg(w: number, h: number, text: string, ink: RGB, C: number): Draw {
  return (s) => {
    const cv = new Canvas(w, h, s);
    cv.fill(word(text, w / 2, h / 2, C), solid(ink));
    return bitmap(cv);
  };
}

/** A piano key (stretchable): a flat face with a 1 px darker edge along the bottom. */
function keyImg(face: RGB, edge: RGB): Draw {
  return (s) => {
    const w = 12, h = 12, p = px1(s);
    const cv = new Canvas(w, h, s);
    cv.fill(rect(0, 0, w, h), solid(face));
    cv.fill(rect(0, h - p, w, p), solid(edge));
    return withGuides(bitmap(cv), 2, 2, 2, 2);
  };
}

// ---------------------------------------------------------------- glyphs (our own shapes)

const st = (u: number) => Math.max(u * 0.07, 0.75);
const rot = (cx: number, cy: number, a: number) => ([x, y]: [number, number]): [number, number] => [cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)];

const GLYPH: Record<string, (cx: number, cy: number, u: number) => SDF> = {
  arrow: (cx, cy, u) => rpoly([[cx - u * 0.24, cy - u * 0.48], [cx - u * 0.24, cy + u * 0.3], [cx - u * 0.06, cy + u * 0.13], [cx + u * 0.08, cy + u * 0.46], [cx + u * 0.21, cy + u * 0.4], [cx + u * 0.07, cy + u * 0.08], [cx + u * 0.31, cy + u * 0.08]], u * 0.03),
  range: (cx, cy, u) => {
    const t = st(u) * 0.9, d = u * 0.1;
    const dash: SDF[] = [];
    for (let i = -4; i <= 3; i++) {
      dash.push(rect(cx - u * 0.42 + (i + 4) * d, cy - u * 0.36, d * 0.6, t * 1.4), rect(cx - u * 0.42 + (i + 4) * d, cy + u * 0.36 - t * 1.4, d * 0.6, t * 1.4));
      dash.push(rect(cx - u * 0.42, cy - u * 0.36 + (i + 4) * d * 0.9, t * 1.4, d * 0.5), rect(cx + u * 0.38 - t * 1.4, cy - u * 0.36 + (i + 4) * d * 0.9, t * 1.4, d * 0.5));
    }
    return union(intersect(union(...dash), rect(cx - u * 0.42, cy - u * 0.36, u * 0.8, u * 0.72)), rrect(cx - u * 0.06, cy - u * 0.04, u * 0.34, u * 0.32, u * 0.04));
  },
  split: (cx, cy, u) => {
    const r = rot(cx, cy, -Math.PI / 4);
    return union(
      rpoly([[-u * 0.5, -u * 0.02], [u * 0.12, -u * 0.12], [u * 0.12, u * 0.1], [-u * 0.5, u * 0.08]].map((p) => r(p as [number, number])), u * 0.02),
      rpoly([[u * 0.18, -u * 0.12], [u * 0.52, -u * 0.12], [u * 0.52, u * 0.1], [u * 0.18, u * 0.1]].map((p) => r(p as [number, number])), u * 0.04),
    );
  },
  eraser: (cx, cy, u) => {
    const r = rot(cx, cy, -Math.PI / 4);
    const body = rpoly([[-u * 0.48, -u * 0.2], [u * 0.48, -u * 0.2], [u * 0.48, u * 0.2], [-u * 0.48, u * 0.2]].map((p) => r(p as [number, number])), u * 0.06);
    const band = rpoly([[-u * 0.1, -u * 0.2], [-u * 0.02, -u * 0.2], [-u * 0.02, u * 0.2], [-u * 0.1, u * 0.2]].map((p) => r(p as [number, number])), 0);
    return subtract(body, band);
  },
  paint: (cx, cy, u) => {
    const r = rot(cx, cy, -Math.PI / 4);
    return union(
      rpoly([[-u * 0.22, -u * 0.11], [u * 0.5, -u * 0.11], [u * 0.5, u * 0.11], [-u * 0.22, u * 0.11]].map((p) => r(p as [number, number])), u * 0.03),
      poly([[-u * 0.28, -u * 0.11], [-u * 0.28, u * 0.11], [-u * 0.52, 0]].map((p) => r(p as [number, number]))),
    );
  },
  mute: (cx, cy, u) => {
    const t = st(u);
    return union(I.speaker(cx - u * 0.04, cy, u * 0.9, 0), capsule(cx - u * 0.42, cy + u * 0.42, cx + u * 0.4, cy - u * 0.42, t));
  },
  bend: (cx, cy, u) => {
    const t = st(u);
    return union(
      capsule(cx, cy - u * 0.5, cx, cy + u * 0.5, t),
      poly([[cx - u * 0.1, cy - u * 0.12], [cx - u * 0.42, cy], [cx - u * 0.1, cy + u * 0.12]]),
      poly([[cx + u * 0.1, cy - u * 0.12], [cx + u * 0.42, cy], [cx + u * 0.1, cy + u * 0.12]]),
      capsule(cx - u * 0.18, cy - u * 0.42, cx + u * 0.18, cy - u * 0.42, t),
    );
  },
  listen: (cx, cy, u) => I.speaker(cx, cy, u * 0.95, 2),
  auto: (cx, cy, u) => {
    const t = st(u) * 1.1;
    return union(polyline([[cx - u * 0.48, cy + u * 0.34], [cx - u * 0.2, cy - u * 0.3], [cx + u * 0.08, cy + u * 0.3], [cx + u * 0.46, cy - u * 0.36]], t), circle(cx - u * 0.2, cy - u * 0.3, u * 0.08), circle(cx + u * 0.08, cy + u * 0.3, u * 0.08));
  },
  snap: (cx, cy, u) => {
    const t = st(u) * 1.2;
    return union(capsule(cx - u * 0.42, cy - u * 0.42, cx - u * 0.42, cy + u * 0.42, t), rect(cx - u * 0.3, cy - u * 0.12, u * 0.62, u * 0.24), capsule(cx + u * 0.38, cy - u * 0.12, cx + u * 0.38, cy + u * 0.12, t));
  },
  grid: (cx, cy, u) => I.tb.grid!(cx, cy, u),
  quantize: (cx, cy, u) => I.text("Q", cx, cy, u * 0.82, 0.16),
  ripple: (cx, cy, u) => I.tb.ripple_one!(cx, cy, u),
  click: (cx, cy, u) => {
    const t = st(u);
    return union(
      subtract(poly([[cx - u * 0.36, cy + u * 0.46], [cx + u * 0.36, cy + u * 0.46], [cx + u * 0.12, cy - u * 0.46], [cx - u * 0.12, cy - u * 0.46]]), poly([[cx - u * 0.2, cy + u * 0.3], [cx + u * 0.2, cy + u * 0.3], [cx + u * 0.04, cy - u * 0.32], [cx - u * 0.04, cy - u * 0.32]])),
      capsule(cx, cy + u * 0.22, cx + u * 0.34, cy - u * 0.3, t),
    );
  },
  follow: (cx, cy, u) => {
    const t = st(u) * 1.1;
    return union(arc(cx, cy + u * 0.3, u * 0.5, -Math.PI * 0.45, Math.PI * 0.45, t), rect(cx - u * 0.1, cy - u * 0.5, u * 0.2, u * 0.34), rrect(cx - u * 0.34, cy + u * 0.18, u * 0.68, u * 0.3, u * 0.05));
  },
  // Transport.
  prev: (cx, cy, u) => poly([[cx + u * 0.3, cy - u * 0.42], [cx + u * 0.3, cy + u * 0.42], [cx - u * 0.36, cy]]),
  next: (cx, cy, u) => poly([[cx - u * 0.3, cy - u * 0.42], [cx - u * 0.3, cy + u * 0.42], [cx + u * 0.36, cy]]),
  rew: (cx, cy, u) => union(poly([[cx, cy - u * 0.4], [cx, cy + u * 0.4], [cx - u * 0.5, cy]]), poly([[cx + u * 0.5, cy - u * 0.4], [cx + u * 0.5, cy + u * 0.4], [cx, cy]])),
  ffw: (cx, cy, u) => union(poly([[cx, cy - u * 0.4], [cx, cy + u * 0.4], [cx + u * 0.5, cy]]), poly([[cx - u * 0.5, cy - u * 0.4], [cx - u * 0.5, cy + u * 0.4], [cx, cy]])),
  zero: (cx, cy, u) => union(rect(cx - u * 0.42, cy - u * 0.42, u * 0.14, u * 0.84), poly([[cx + u * 0.34, cy - u * 0.42], [cx + u * 0.34, cy + u * 0.42], [cx - u * 0.24, cy]])),
  end: (cx, cy, u) => union(rect(cx + u * 0.28, cy - u * 0.42, u * 0.14, u * 0.84), poly([[cx - u * 0.34, cy - u * 0.42], [cx - u * 0.34, cy + u * 0.42], [cx + u * 0.24, cy]])),
  stop: (cx, cy, u) => rect(cx - u * 0.5, cy - u * 0.5, u, u),
  play: (cx, cy, u) => poly([[cx - u * 0.4, cy - u * 0.5], [cx + u * 0.5, cy], [cx - u * 0.4, cy + u * 0.5]]),
  record: (cx, cy, u) => circle(cx, cy, u * 0.5),
  pause: (cx, cy, u) => union(rect(cx - u * 0.4, cy - u * 0.45, u * 0.28, u * 0.9), rect(cx + u * 0.12, cy - u * 0.45, u * 0.28, u * 0.9)),
  loop: (cx, cy, u) => {
    const t = Math.max(u * 0.08, 0.8);
    const ring = subtract(rrect(cx - u * 0.75, cy - u * 0.42, u * 1.5, u * 0.84, u * 0.42), rrect(cx - u * 0.75 + t * 2, cy - u * 0.42 + t * 2, u * 1.5 - t * 4, u * 0.84 - t * 4, u * 0.42 - t * 2));
    return union(subtract(ring, rect(cx - u * 0.12, cy + u * 0.18, u * 0.3, u * 0.3)), poly([[cx - u * 0.2, cy + u * 0.42 - t], [cx + u * 0.08, cy + u * 0.22], [cx + u * 0.08, cy + u * 0.62]]));
  },
};

/** Toolbar icons ("assist_studioone_<name>"), used by the profile's toolbars. */
const toolbarGlyphs: Record<string, Glyph> = Object.fromEntries(
  ["arrow", "range", "split", "eraser", "paint", "mute", "bend", "listen", "auto", "snap", "grid", "quantize", "follow", "ripple", "click"].map((n) => [`assist_studioone_${n}`, GLYPH[n]!]),
);

// ---------------------------------------------------------------- track header

/** A row-1 rect (offset by kY). */
const r1 = (w: Script, x: V, wd: V, ht = CH) => `+ kY ${w.p(x, 0, wd, ht)}`;

function tcp(k: Kit, w: Script) {
  w.set("tcp.size", `[${w.n(TCP_W)} ${w.n(60)} ${w.n(200)}]`);
  // Row 1: 3 px down; centred on collapsed tracks.
  w.set("kY", `h<${w.n(30)} [0 ${w.n(2)}] [0 ${w.n(3)}]`);
  // Colour strip and its edge line.
  w.custom("tcp.custom.kStrip");
  w.set("tcp.custom.kStrip", w.p(0, 0, STRIP, H(-1)));
  w.set("tcp.custom.kStrip.color", `?trackcolor_valid ${TRACK_FILL} ${fill(X.def)}`);
  w.custom("tcp.custom.kStripLine");
  w.set("tcp.custom.kStripLine", w.p(STRIP, 0, 1, H(-1)));
  w.set("tcp.custom.kStripLine.color", fill(X.stripLine));
  // The square at the strip's foot: show automation, or fold a folder.
  w.set("tcp.env", `h<${w.n(36)} [0] folderstate==1 [0] ${w.p(0, H(-13), STRIP, 12)}`);
  w.set("tcp.foldercomp", `h<${w.n(36)} [0] folderstate==1 ${w.p(0, H(-13), STRIP, 12)} [0]`);
  // Number.
  w.set("tcp.trackidx", `h<${w.n(16)} [0] ${r1(w, 12, 22)}`);
  w.set("tcp.trackidx.color", fg(X.num));
  w.set("tcp.trackidx.font", w.font(3));
  w.set("tcp.trackidx.margin", CENTER);
  // M S ● ◐ as one group; behind ◐ a fill that lights while the track is armed (see the images).
  w.custom("tcp.custom.kMon");
  w.tall(16, "tcp.custom.kMon", `+ [${w.n(1)} ${w.n(1)} ${-w.n(2)} ${-w.n(2)}] ${r1(w, GX + 3 * CW, CW)}`);
  w.set("tcp.custom.kMon.color", `?recarm ${fill(X.mon)} ${fill(X.cell)}`);
  (["tcp.mute", "tcp.solo", "tcp.recarm", "tcp.recmon"] as const).forEach((name, i) => w.tall(16, name, r1(w, GX + i * CW, CW)));
  w.raw("front tcp.recmon");
  // Name.
  w.set("tcp.label", `h<${w.n(16)} [0] ${r1(w, NAME_X, W(-NAME_X - 14))}`);
  w.set("tcp.label.font", w.font("label"));
  w.set("tcp.label.color", fg(X.num));
  w.set("tcp.label.margin", "[0 0 0 0 0]");
  // Meter column down the right edge, with a dark line on its left.
  w.custom("tcp.custom.kMeterLine");
  w.set("tcp.custom.kMeterLine", w.p(W(-10), 0, 1, H(-1)));
  w.set("tcp.custom.kMeterLine.color", fill(X.stripLine));
  w.set("tcp.meter", w.p(W(-9), 0, 9, H(-1)));
  meterLook(w, "tcp.meter", k, { scale: false, readout: false });
  w.set("tcp.meter.vu.div", `[${w.n(1)}]`);
  // Volume bar from 38 px (Studio One shows no pan bar in the header; it joins here at large heights,
  // an extra). An armed track shows its input selector under the volume bar from 58 px.
  w.tall(38, "tcp.volume", w.p(...VOL));
  w.set("tcp.volume.fadermode", "[-1]");
  const pan = w.p(VOL[0], PANY, VOL[2], VOL[3]);
  w.set("tcp.pan", `h<${w.n(76)} [0] ${pan}`);
  w.set("tcp.pan.fadermode", "[-1]");
  w.set("tcp.recinput", `?recarm h<${w.n(58)} [0] h<${w.n(76)} ${w.p(GX, 39, VOL[2], 16)} ${w.p(GX, 52, VOL[2], 16)} [0]`);
  w.set("tcp.recinput.font", w.font("list"));
  w.set("tcp.recinput.color", fg(X.num));
  w.set("tcp.recinput.margin", `[${w.n(5)} 0 ${w.n(16)} 0 0]`);
  w.set("tcp.fxparm", "[0]");
}

function masterTcp(k: Kit, w: Script) {
  w.set("master.tcp.size", `[${w.n(TCP_W)} ${w.n(60)} ${w.n(200)}]`);
  w.set("kY", `h<${w.n(30)} [0 ${w.n(2)}] [0 ${w.n(3)}]`);
  w.custom("master.tcp.custom.kStrip");
  w.set("master.tcp.custom.kStrip", w.p(0, 0, STRIP, H(-1)));
  w.set("master.tcp.custom.kStrip.color", fill(hex("#6c7178")));
  w.tall(16, "master.tcp.mute", r1(w, GX, CW));
  w.tall(16, "master.tcp.solo", r1(w, GX + CW, CW));
  w.tall(16, "master.tcp.mono", r1(w, GX + 2 * CW, CW));
  w.set("master.tcp.label", `h<${w.n(16)} [0] ${r1(w, GX + 3 * CW + 4, W(-(GX + 3 * CW + 4) - 14))}`);
  w.set("master.tcp.label.font", w.font("label"));
  w.set("master.tcp.label.color", fg(X.num));
  w.set("master.tcp.label.margin", "[0 0 0 0 0]");
  w.set("master.tcp.meter", w.p(W(-9), 0, 9, H(-1)));
  meterLook(w, "master.tcp.meter", k, { scale: false, readout: false });
  w.set("master.tcp.meter.vu.div", `[${w.n(1)}]`);
  w.tall(38, "master.tcp.volume", w.p(...VOL));
  w.set("master.tcp.volume.fadermode", "[-1]");
  w.tall(52, "master.tcp.pan", w.p(VOL[0], PANY, VOL[2], VOL[3]));
  w.set("master.tcp.pan.fadermode", "[-1]");
}

// ---------------------------------------------------------------- console

/**
 * A console channel. REAPER's meter runs linearly in dB from the meter range's max (top) to min
 * (bottom), so the scale marks sit at (max − dB) / (max − min) of the meter's height.
 */
function mcp(k: Kit, w: Script, { master, range }: { master: boolean; range: MeterRange }) {
  const X0 = master ? "master.mcp" : "mcp";
  const wd = master ? MMW : MW;
  w.set(`${X0}.size`, `[${w.n(wd)} ${w.n(360)} 0 ${w.n(260)}]`);
  extMixer(w, X0, 0);
  // The inserts area (kE{1} tall): 22 px more than the shared split, for the Inserts header over REAPER's lists, which
  // it leaves out when their area is short. kE2 is re-derived from it.
  w.set("kE", `mcp_wantextmix>0 h<${w.n(288)} [0 ${w.n(24)}] + [0 ${-w.n(98)}] * 0.5 [0 h] [0]`);
  w.set("kE2", "- kE [0 0 0 kE{1}]");
  const e = (x: V, y: number, ww: V, hh: number) => `+ kE ${w.p(x, y, ww, hh)}`;
  const colour = master ? fill(hex("#26282b")) : `?trackcolor_valid ${TRACK_FILL} ${fill(X.def)}`;
  // Inserts (sends under them): a track-colour line along the channel's top, the Inserts header, then REAPER's
  // lists in SLOT_H rows (the power glyph and ▾ are in the slot images, the name between them).
  // (A short console keeps only the line and the header in its 24 px band.)
  const ext = (rect: string) => `mcp_wantextmix>0 ${rect} [0]`;
  w.custom(`${X0}.custom.kTop0`);
  w.set(`${X0}.custom.kTop0`, ext(w.p(0, 0, W(), 3)));
  w.set(`${X0}.custom.kTop0.color`, colour);
  w.custom(`${X0}.custom.kIns`, master ? "k_s1_ins_main" : "k_s1_ins");
  w.set(`${X0}.custom.kIns`, ext(w.p(4, 4, wd - 8, 16)));
  w.set(`${X0}.extmixer.position`, ext(`h<${w.n(288)} [0] + [${w.n(4)} ${w.n(21)} ${-w.n(8)} ${-w.n(22)}] [0 0 w kE{1}]`));
  for (const list of ["fxlist", "sendlist"]) {
    w.set(`${X0}.${list}.font`, `[${w.font("list").slice(1, -1)} ${w.n(SLOT_H)}]`);
    w.set(`${X0}.${list}.margin`, `[${w.n(16)} 0 ${w.n(13)} 0 0.5]`);
  }
  // A line in the track colour where the controls start.
  w.custom(`${X0}.custom.kTop`);
  w.set(`${X0}.custom.kTop`, e(0, 0, W(), 3));
  w.set(`${X0}.custom.kTop.color`, colour);
  // Input and output boxes.
  if (!master) {
    w.set("mcp.recinput", e(4, 7, W(-8), 16));
    w.set("mcp.recinput.font", w.font(1));
    w.set("mcp.recinput.color", fg(X.ink));
    w.set("mcp.recinput.margin", `[${w.n(3)} 0 ${w.n(3)} 0 0.5]`);
  }
  w.set(`${X0}.io`, e(4, 25, wd - 8, 16));
  // Panner and its readout.
  w.set(`${X0}.pan`, e(4, 44, W(-8), 14));
  w.set(`${X0}.pan.fadermode`, "[-1]");
  w.set(`${X0}.pan.label`, e(4, 59, W(-8), 12));
  w.set(`${X0}.pan.label.font`, w.font(1));
  w.set(`${X0}.pan.label.color`, fg(hex("#f1f2f2")));
  w.set(`${X0}.pan.label.margin`, CENTER);
  // M S / ● ◐ (Main: M S / mono).
  const [bw, bh] = SIZES.mcpMute;
  const bx = Math.round((wd - 2 * bw) / 2);
  w.set(`${X0}.mute`, e(bx, 74, bw, bh));
  w.set(`${X0}.solo`, e(bx + bw, 74, bw, bh));
  if (master) {
    w.set("master.mcp.mono", e(bx, 74 + bh, bw, bh));
    w.set("master.mcp.menubutton", e(bx + bw, 74 + bh, bw, bh));
  } else {
    w.custom("mcp.custom.kMon");
    w.set("mcp.custom.kMon", `+ [${w.n(1)} ${w.n(1)} ${-w.n(2)} ${-w.n(2)}] ${e(bx + bw, 74 + bh, bw, bh)}`);
    w.set("mcp.custom.kMon.color", `?recarm ${fill(X.mon)} ${fill(X.cell)}`);
    w.set("mcp.recarm", e(bx, 74 + bh, bw, bh));
    w.set("mcp.recmon", e(bx + bw, 74 + bh, bw, bh));
    w.raw("front mcp.recmon");
  }
  // dB readout, clear of the fader's rect (its groove would cover the text).
  w.set(`${X0}.volume.label`, e(4, 119, W(-8), 13));
  w.set(`${X0}.volume.label.font`, w.font(2));
  w.set(`${X0}.volume.label.color`, fg(X.ink));
  w.set(`${X0}.volume.label.margin`, CENTER);
  // Scale | meter | fader over the same height (Main: fader | meter | scale). The fader's rect reaches half a cap
  // above the meter's top, so the meter starts that far under the readout.
  const top = 150, bot = 60;
  const th = SIZES.mcpThumb[1];
  const mx = master ? 56 : 17, mw = 15, fx = master ? 28 : 33;
  w.set(`${X0}.meter`, `+ kE2 ${w.p(mx, top, mw, H(-(top + bot)))}`);
  meterLook(w, `${X0}.meter`, k, { scale: false, readout: false });
  w.set(`${X0}.meter.vu.div`, `[${w.n(1)}]`);
  w.set(`${X0}.volume`, `+ kE2 ${w.p(fx, top - th / 2, SIZES.mcpFaderW, H(-(top + bot) + th))}`);
  const span = range.max - range.min;
  MARKS.forEach(([db, image], i) => {
    if (db > range.max || db < range.min) return;
    const f = (range.max - db) / span;
    const name = `${X0}.custom.kSc${i}`;
    w.custom(name, image);
    const sx = master ? mx + mw + 1 : mx - MARK_W - 1;
    w.set(name, `+ * ${+(1 - f).toFixed(4)} kE ${w.p(sx, H(top - f * (top + bot) - MARK_H / 2, +f.toFixed(4)), MARK_W, MARK_H)}`);
  });
  // Number, automation, name.
  if (!master) {
    w.set("mcp.trackidx", w.p(6, H(-55), 22, 14));
    w.set("mcp.trackidx.color", fg(X.ink));
    w.set("mcp.trackidx.font", w.font(3));
    w.set("mcp.trackidx.margin", CENTER);
  }
  w.set(`${X0}.env`, w.p(Math.round((wd - 70) / 2), H(-37), 70, 16));
  w.custom(`${X0}.custom.kName`);
  w.set(`${X0}.custom.kName`, w.p(0, H(-16), W(), 15));
  w.set(`${X0}.custom.kName.color`, colour);
  w.set(`${X0}.label`, `${X0}.custom.kName`);
  w.set(`${X0}.label.margin`, `[${w.n(3)} 0 ${w.n(3)} 0 0.5]`);
  w.set(`${X0}.label.font`, w.font(2));
  w.set(`${X0}.label.color`, master ? fg(X.ink) : `?trackcolor_valid ${ON_COLOR} ${fg(X.ink)}`);
  w.raw(`front ${X0}.label`);
}

// ---------------------------------------------------------------- transport

const TH = 46, PANEL_H = 42, PANEL_W = 916, TABS = 168;
/** Transport captions: image name, word, offset in the panel, width. */
// REAPER draws the time left-aligned, so "Bars" sits under where a typical position ("12.3.45") ends up.
const CAPTIONS: [string, string, number, number][] = [["k_s1_cap_bars", "Bars", 8, 82], ["k_s1_cap_click", "Metronome", 744, 70], ["k_s1_cap_sig", "Timing", 810, 56], ["k_s1_cap_tempo", "Tempo", 860, 56]];
const TABS_ROW: [string, string, number, number][] = [["kEdit", "Edit", 40153, -168], ["kMix", "Mix", 40078, -112], ["kBrowse", "Browse", 50124, -56]];

function trans(_k: Kit, w: Script) {
  w.set("trans.size", `[${w.n(1200)} ${w.n(TH)}]`);
  w.set("trans.size.minmax", `[${w.n(400)} ${w.n(TH)} ${w.n(4000)} ${w.n(TH)}]`);
  w.set("trans.size.dockedheight", `[${w.n(TH)}]`);
  // The centre panel, centred in the room left of Edit / Mix / Browse.
  const R = (dx: number, y: number, ww: number, hh: number) => w.p(W(dx - TABS / 2 - PANEL_W / 2, 0.5), y, ww, hh);
  w.custom("trans.custom.kPanel", "k_s1_tpanel");
  w.set("trans.custom.kPanel", R(0, 0, PANEL_W, PANEL_H));
  const custom = (name: string, cmd: number, tip: string, image: string, rect: string) => {
    w.raw(`custom trans.custom.${name} '' ${cmd} '${tip}' '${image}'`);
    w.set(`trans.custom.${name}`, rect);
    w.raw(`front trans.custom.${name}`);
  };
  // Time display (on transport_status_bg, the panel's colour) with its unit underneath. The read-outs take a text
  // colour only: a background colour in .color paints their boxes black.
  w.set("trans.status", R(14, 3, 230, 24));
  w.set("trans.status.font", w.font("status"));
  w.set("trans.status.color", fg(X.time));
  w.set("trans.status.margin", `[${w.n(4)} 0 ${w.n(4)} 0 0.5]`);
  // Caption elements are named kCap…: WALTER names are case-blind, so "kclick" would be the metronome's "kClick".
  for (const [image, , dx, ww] of CAPTIONS) {
    const rect = R(dx, 27, ww, 12);
    custom(`kCap${image.slice(9)}`, 0, "", image, image === "k_s1_cap_sig" ? `trans_flags&4 ${rect} [0]` : rect);
  }
  // Locate: previous marker, rewind, forward, next marker, return to zero.
  custom("kPrev", 40172, "Previous marker", "k_s1_prev", R(254, 11, 22, 20));
  custom("kRew", 40084, "Rewind", "k_s1_rew", R(278, 11, 22, 20));
  custom("kFfw", 40085, "Forward", "k_s1_ffw", R(302, 11, 22, 20));
  custom("kNext", 40173, "Next marker", "k_s1_next", R(326, 11, 22, 20));
  w.set("trans.rew", R(350, 11, 22, 20));
  w.set("trans.fwd", "[0]");
  // Stop, play, record, loop.
  w.set("trans.stop", R(382, 6, 32, 30));
  w.set("trans.play", R(416, 6, 32, 30));
  w.set("trans.rec", R(450, 6, 32, 30));
  w.set("trans.repeat", R(486, 6, 40, 30));
  w.set("trans.pause", "[0]");
  // Loop range (REAPER's selection readout).
  w.set("trans.sel", R(536, 8, 200, 26));
  w.set("trans.sel.font", w.font(2));
  w.set("trans.sel.color", fg(X.time));
  w.set("trans.sel.margin", `[${w.n(4)} 0 ${w.n(4)} 0 0]`);
  // Metronome, time signature, tempo, each with its caption.
  custom("kClick", 40364, "Metronome", "k_s1_click", R(764, 4, 30, 22));
  const sig = R(814, 4, 56, 23);
  w.set("trans.curtimesig", `trans_flags&4 ${sig} [0]`);
  w.set("trans.curtimesig.font", w.font("sig"));
  w.set("trans.curtimesig.color", fg(X.time));
  w.set("trans.curtimesig.margin", `[0 0 0 0 0.5]`);
  w.set("trans.bpm.edit", R(864, 4, 48, 23));
  w.set("trans.bpm.edit.font", w.font("tempo"));
  w.set("trans.bpm.edit.color", fg(X.time));
  w.set("trans.bpm.edit.margin", `[0 0 0 0 0.5]`);
  w.set("trans.bpm.tap", "[0]");
  w.set("trans.automode", "[0]");
  // Edit / Mix / Browse.
  for (const [name, text, cmd, x] of TABS_ROW) custom(name, cmd, text, `k_s1_tab_${text.toLowerCase()}`, w.p(W(x), 0, 56, TH));
}

// ---------------------------------------------------------------- images

/**
 * Over every event (a 9-slice REAPER stretches across the item, under its name): Studio One's name tab, a darker
 * band with a slanted end at the top-left (fixed width; REAPER can't size it to the name), and a hairline at the
 * event's left edge where two events meet. A selected event keeps its colour and gets cyan lines along its top and
 * bottom with a light corner in the tab (REAPER stops lightening selected items once item_bg_sel exists).
 */
const TAB_W = 56, TAB_H = 13;
function eventFrame(sel: boolean): Draw {
  return (s) => {
    const rw = 4, bh = 4, w = TAB_W + 8 + rw, h = TAB_H + 1 + 8 + bh;
    const cv = new Canvas(w, h, s), p = px1(s), BLACK: RGB = [0, 0, 0];
    cv.fill(poly([[0, 0], [TAB_W - 3, 0], [TAB_W - 9, TAB_H], [0, TAB_H]]), solid(BLACK, 0.32));
    cv.fill(rect(0, 0, p, h), solid(BLACK, 0.22));
    if (sel) {
      cv.fill(poly([[0, 0], [6, 0], [0, 6]]), solid(hex("#b2f9fe")));
      cv.fill(rect(0, 0, w, p), solid(X.selLine));
      cv.fill(rect(0, h - p, w, p), solid(X.selLine));
    }
    return withGuides(bitmap(cv), Math.round(TAB_W * s), Math.round((TAB_H + 1) * s), Math.round(rw * s), Math.round(bh * s));
  };
}

function images(k: Kit, out: Record<string, Draw>) {
  const c = k.c;
  const ink = X.ink, white = hex("#f6f6f6");

  // Track header: the button group.
  const M = btnM(9), S = btnS(9);
  out.track_mute_off = cell(CW, CH, "first", M, ink, null);
  out.track_mute_on = cell(CW, CH, "first", M, white, X.mute);
  out.track_solo_off = cell(CW, CH, "mid", S, ink, null);
  out.track_solo_on = cell(CW, CH, "mid", S, hex("#2a2418"), X.solo);
  const dot = recDot(9);
  out.track_recarm_off = cell(CW, CH, "mid", dot, ink, null);
  out.track_recarm_on = cell(CW, CH, "mid", dot, white, X.rec);
  out.track_recarm_norec = cell(CW, CH, "mid", dot, white, darken(X.rec, 0.35));
  const ring: G = (cx, cy) => outline(circle(cx, cy, 4.4), 1.3);
  out.track_recarm_auto = cell(CW, CH, "mid", ring, X.rec, null);
  out.track_recarm_auto_on = cell(CW, CH, "mid", ring, white, X.rec);
  out.track_recarm_auto_norec = cell(CW, CH, "mid", ring, white, darken(X.rec, 0.35));
  // Monitoring: REAPER's default ("on") monitors while armed, as Studio One's auto-monitoring does, so
  // "on" is a hollow cell over a fill that turns blue when the track is armed; "off" is a dim glyph.
  const mon = monGlyph(9);
  out.track_monitor_off = cell(CW, CH, "last", mon, hex("#8d9195"), null);
  out.track_monitor_on = cell(CW, CH, "last", mon, ink, null, 3, true);
  out.track_monitor_auto = cell(CW, CH, "last", mon, ink, null, 3, true);
  // Main track (if shown): M S mono.
  out.track_mono = cell(CW, CH, "last", (cx, cy) => circle(cx, cy, 3.4), white, X.mon);
  out.track_stereo = cell(CW, CH, "last", (cx, cy) => union(outline(circle(cx - 2.4, cy, 3.4), 1.1), circle(cx + 2.4, cy, 3.4)), ink, null);

  // The colour strip's foot: automation (∿) and folder (▲ / ▼).
  const wave = autoWave(6);
  out.track_env = stripButton(STRIP, 12, wave, hex("#e8ecef"));
  (["read", "touch", "write", "latch", "preview"] as const).forEach((m, i) => (out[`track_env_${m}`] = stripButton(STRIP, 12, wave, c.env[i]!, 0.5)));
  const up: G = (cx, cy) => poly([[cx - 3, cy + 1.5], [cx + 3, cy + 1.5], [cx, cy - 2]]);
  const down: G = (cx, cy) => poly([[cx - 3, cy - 1.5], [cx + 3, cy - 1.5], [cx, cy + 2]]);
  out.track_fcomp_off = stripButton(STRIP, 12, down, hex("#f0f2f4"));
  out.track_fcomp_small = stripButton(STRIP, 12, up, hex("#f0f2f4"));
  out.track_fcomp_tiny = stripButton(STRIP, 12, up, hex("#f0f2f4"), 0.45);

  // Header panels: flat, a dark line under each track.
  out.tcp_bg = flatPanel(X.panel, { bottom: X.line });
  out.tcp_bgsel = flatPanel(X.panelSel, { bottom: X.line });
  out.envcp_bg = flatPanel(darken(X.panel, 0.1), { bottom: X.line });
  out.envcp_bgsel = flatPanel(darken(X.panelSel, 0.15), { bottom: X.line });

  // Volume / pan bars.
  out.tcp_volbg = barGroove(VOL[3], false);
  out.tcp_volthumb = barThumb(SIZES.tcpThumb[0], SIZES.tcpThumb[1]);
  out.tcp_panbg = barGroove(VOL[3], true);
  out.tcp_panthumb = barThumb(SIZES.tcpThumb[0], SIZES.tcpThumb[1]);
  out.tcp_recinput = dropField(X.field, X.fieldEdge, hex("#c4c7ca"));

  // Console: panels, buttons, I/O and automation boxes.
  out.mcp_bg = flatPanel(X.console, { left: X.consoleEdge });
  out.mcp_bgsel = flatPanel(X.consoleSel, { left: X.consoleEdge });
  const [mw, mh] = SIZES.mcpMute;
  const mM = btnM(8.6), mS = btnS(8.6);
  out.mcp_mute_off = cell(mw, mh, "first", mM, ink, null);
  out.mcp_mute_on = cell(mw, mh, "first", mM, white, X.mute);
  out.mcp_solo_off = cell(mw, mh, "last", mS, ink, null);
  out.mcp_solo_on = cell(mw, mh, "last", mS, hex("#2a2418"), X.solo);
  const mdot = recDot(8);
  out.mcp_recarm_off = cell(mw, mh, "first", mdot, ink, null);
  out.mcp_recarm_on = cell(mw, mh, "first", mdot, white, X.rec);
  out.mcp_recarm_norec = cell(mw, mh, "first", mdot, white, darken(X.rec, 0.35));
  const mring: G = (cx, cy) => outline(circle(cx, cy, 4.2), 1.2);
  out.mcp_recarm_auto = cell(mw, mh, "first", mring, X.rec, null);
  out.mcp_recarm_auto_on = cell(mw, mh, "first", mring, white, X.rec);
  out.mcp_recarm_auto_norec = cell(mw, mh, "first", mring, white, darken(X.rec, 0.35));
  const mmon = monGlyph(8.5);
  out.mcp_monitor_off = cell(mw, mh, "last", mmon, hex("#8d9195"), null);
  out.mcp_monitor_on = cell(mw, mh, "last", mmon, ink, null, 3, true);
  out.mcp_monitor_auto = cell(mw, mh, "last", mmon, ink, null, 3, true);
  out.mcp_mono = cell(mw, mh, "first", (cx, cy) => circle(cx, cy, 3.2), white, X.mon);
  out.mcp_stereo = cell(mw, mh, "first", (cx, cy) => union(outline(circle(cx - 2.4, cy, 3.4), 1.1), circle(cx + 2.4, cy, 3.4)), ink, null);
  out.mixer_menu = cell(mw, mh, "last", (cx, cy) => I.menu(cx, cy, 8), ink, null);
  for (const sfx of ["", "_r", "_s", "_s_r"]) {
    out[`mcp_io${sfx}`] = boxWord(MW - 8, 16, "Main", ink);
    out[`mcp_io${sfx}_dis`] = boxWord(MW - 8, 16, "", ink);
  }
  out.master_mcp_io = boxWord(MMW - 8, 16, "", ink);
  out.mcp_recinput = dropField(X.box, X.boxEdge, null);
  out.mcp_env = boxWord(70, 16, "Auto: Off", hex("#8f9397"), hex("#2f3134"));
  (["Read", "Touch", "Write", "Latch", "Preview"] as const).forEach((m, i) => (out[`mcp_env_${m.toLowerCase()}`] = boxWord(70, 16, m, hex("#1b1d20"), c.env[i]!)));
  out.mcp_panbg = panBox(14);
  out.mcp_panthumb = (s) => {
    const cv = new Canvas(3, 14, s);
    cv.fill(rect(0.5, 0, 2, 14), solid(hex("#35bee8")));
    return bitmap(cv);
  };
  out.mcp_volbg = faderSlot(SIZES.mcpFaderW);
  out.mcp_volthumb = faderCap(SIZES.mcpThumb[0], SIZES.mcpThumb[1], hex("#f4f5f6"));
  out.mcp_master_volbg = out.mcp_volbg;
  out.mcp_master_volthumb = faderCap(SIZES.mcpThumb[0], SIZES.mcpThumb[1], hex("#5aa6dc"));
  for (const [, image, label] of MARKS) out[image] ??= mark(label);
  // Inserts and sends: on the channel's own colour (selected channels too), no empty slots drawn; the header.
  // The inserts area takes the channel's colour (and the selected one's), opaque.
  out.mcp_extmixbg = out.mcp_mainextmixbg = fillImg(X.console, 1);
  out.mcp_extmixbgsel = out.mcp_mainextmixbgsel = fillImg(X.consoleSel, 1);
  for (const n of ["mcp_fxlist_bg", "mcp_sendlist_bg"]) out[n] = CLEAR;
  out.mcp_fxlist_empty = fxSlot(null, null);
  out.mcp_fxlist_norm = fxSlot(X.slot, X.blue);
  out.mcp_fxlist_byp = fxSlot(X.slotByp, X.slotArrow);
  out.mcp_fxlist_off = fxSlot(mixc(X.slotByp, X.mute, 0.3), X.mute);
  out.mcp_sendlist_empty = fxSlot(null, null);
  out.mcp_sendlist_norm = fxSlot(X.slot, X.blue);
  out.mcp_sendlist_mute = fxSlot(X.slotByp, X.slotArrow);
  out.mcp_sendlist_midihw = fxSlot(X.slot, X.slotArrow);
  out.k_s1_ins = insertsHeader(MW - 8);
  out.k_s1_ins_main = insertsHeader(MMW - 8);
  // Studio One's meters show no mute / solo badges.
  for (const n of ["meter_mute", "meter_unsolo", "meter_solodim", "meter_automute", "meter_foldermute"]) out[n] = CLEAR;

  // Transport.
  out.transport_bg = flatPanel(X.trans, { top: X.transLine });
  out.k_s1_tpanel = transPanel(PANEL_H);
  for (const [, text] of TABS_ROW) out[`k_s1_tab_${text.toLowerCase()}`] = tabArea(TH, text);
  for (const [image, text, , ww] of CAPTIONS) out[image] = captionImg(ww, 12, text, X.caption, 6.5);
  const tg = (name: string, ww: number, hh: number, g: (cx: number, cy: number, u: number) => SDF, u: number, col: RGB) => (out[name] = tglyph(ww, hh, (cx, cy) => g(cx, cy, u), col));
  const T = X.transInk;
  tg("k_s1_prev", 22, 20, GLYPH.prev!, 9, T);
  tg("k_s1_rew", 22, 20, GLYPH.rew!, 12, T);
  tg("k_s1_ffw", 22, 20, GLYPH.ffw!, 12, T);
  tg("k_s1_next", 22, 20, GLYPH.next!, 9, T);
  for (const n of ["transport_home", "transport_previous"]) tg(n, 22, 20, GLYPH.zero!, 11, T);
  for (const n of ["transport_end", "transport_next"]) tg(n, 22, 20, GLYPH.end!, 11, T);
  tg("transport_stop", 32, 30, GLYPH.stop!, 17, X.stop);
  tg("transport_play", 32, 30, GLYPH.play!, 19, T);
  tg("transport_play_on", 32, 30, GLYPH.play!, 19, c.play);
  tg("transport_play_sync", 32, 30, GLYPH.play!, 19, X.blue);
  tg("transport_play_sync_on", 32, 30, GLYPH.play!, 19, X.blue);
  tg("transport_pause", 32, 30, GLYPH.pause!, 16, T);
  tg("transport_pause_on", 32, 30, GLYPH.pause!, 16, X.stop);
  for (const n of ["transport_record", "transport_record_item", "transport_record_loop"]) tg(n, 32, 30, GLYPH.record!, 19, T);
  for (const n of ["transport_record_on", "transport_record_item_on", "transport_record_loop_on"]) tg(n, 32, 30, GLYPH.record!, 19, hex("#e8463c"));
  tg("transport_repeat_off", 40, 30, GLYPH.loop!, 22, T);
  tg("transport_repeat_on", 40, 30, GLYPH.loop!, 22, X.stop);
  tg("k_s1_click", 30, 22, GLYPH.click!, 14, T);
  // REAPER repaints a read-out's box from these (a transparent one shows the bar or black through it), so
  // they take the colour of the dark centre panel the read-outs sit on.
  out.transport_status_bg = fillImg(X.transPanel, 1);
  out.transport_status_bg_err = fillImg(X.transPanel, 1);
  out.transport_edit_bg = fillImg(X.transPanel, 1);
  out.transport_bpm_bg = fillImg(X.transPanel, 1);
  out.transport_group_bg = fillImg(X.transPanel, 1);
  out.k_display = fillImg(X.transPanel, 1);

  // Toolbar: Studio One sets its tools on a dark strip. REAPER draws this plate under every toolbar button
  // (normal | hover | pressed); neighbouring plates run together into one strip per toolbar row.
  out.toolbar_bg = fillImg(X.trans, 1);
  out.toolbar_blank = frames(30, 30, (cv, f, s) => {
    const p = px1(s);
    cv.fill(rect(0, p, 30, 30 - 2 * p), solid(f === 2 ? X.blue : f === 1 ? hex("#2c2e31") : X.toolStrip));
  });
  // A toggled button (the lit tool, Snap…) gets Studio One's blue cell under its white glyph (REAPER animates this
  // image in 12 frames of 30 × 30; all alike here).
  out.animation_toolbar_highlight = (s) => {
    const cv = new Canvas(30, 360, s), p = px1(s);
    for (let i = 0; i < 12; i++) cv.fill(rect(0, i * 30 + p, 30, 30 - 2 * p), solid(X.blue));
    return bitmap(cv);
  };

  // Envelope lanes keep the shared layout; buttons in the group's flat style.
  const [ew, eh] = SIZES.envBtn;
  out.envcp_arm_off = cell(ew, eh, "only", recDot(7), ink, null);
  out.envcp_arm_on = cell(ew, eh, "only", recDot(7), X.rec, null);
  out.envcp_bypass_on = cell(ew, eh, "only", (cx, cy) => I.power(cx, cy, 9), mixc(ink, X.cell, 0.5), null);
  out.envcp_bypass_off = cell(ew, eh, "only", (cx, cy) => I.power(cx, cy, 9), hex("#5aa6dc"), null);
  out.envcp_hide = cell(ew, eh, "only", (cx, cy) => I.cross(cx, cy, 8), ink, null);
  out.envcp_learn = cell(ew, eh, "only", letter("L", 8), ink, null);
  out.envcp_learn_on = cell(ew, eh, "only", letter("L", 8), white, X.blue);
  out.envcp_parammod = cell(ew, eh, "only", (cx, cy) => I.wave(cx, cy, 9), ink, null);
  out.envcp_parammod_on = cell(ew, eh, "only", (cx, cy) => I.wave(cx, cy, 9), white, X.blue);
  out.envcp_faderbg = barGroove(VOL[3], false);
  out.envcp_fader = barThumb(SIZES.tcpThumb[0], SIZES.tcpThumb[1]);

  // Note editor keyboard: flat keys.
  // Events: the name tab; selected ones edged in cyan. No selection dot (it also pushes the name right).
  out.item_bg = eventFrame(false);
  out.item_bg_sel = eventFrame(true);
  out.item_seldot = CLEAR;

  out.piano_white_key = keyImg(hex("#f0f2f3"), hex("#9a9da1"));
  out.piano_white_key_sel = keyImg(hex("#a9cdf2"), hex("#6a8db0"));
  out.piano_black_key = keyImg(hex("#1c1e20"), hex("#000000"));
  out.piano_black_key_sel = keyImg(hex("#2f5f94"), hex("#000000"));
}

const studioone: KitDef = {
  id: "studioone",
  palette,
  sizes: SIZES,
  mcpWidth: { track: MW, master: MMW },
  fonts: { label: 2, value: 2, list: 2, tempo: 4, sig: 4, status: 5 },
  faces: {
    slots: {
      1: { face: "Arial", px: 10 },
      2: { face: "Arial", px: 11 },
      // Track numbers: small and bold.
      3: { face: "Arial", px: 11, weight: 700 },
      4: { face: "Arial", px: 13 },
      // The big time display.
      5: { face: "Arial", px: 19, weight: 700 },
    },
    ruler: { face: "Arial", px: 11 },
    transport: { face: "Arial", px: 19, weight: 700 },
    items: { face: "Arial", px: 11 },
    volpan: { face: "Arial", px: 10 },
    title: { face: "Arial", px: 12 },
  },
  globals: {
    tcp_heights: "4 26 39 39",
    tcp_folderindent: "10",
    tcp_master_minheight: "26",
    tinttcp: "296",
  },
  layout: { tcp, masterTcp, mcp, trans },
  images,
  toolbarGlyphs,
  // Studio One's tool glyphs: light grey, white on hover and on the lit (blue) cell.
  toolbarInk: { normal: "#cbcbcb", hover: "#f2f2f2", on: "#ffffff" },
};

export default studioone;
