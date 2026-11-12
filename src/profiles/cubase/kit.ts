import type { SkinUi } from "../skins";
import { exact, scaled, type Frame } from "../kit/art";
import * as I from "../kit/icons";
import { bitmap, Canvas, capsule, circle, darken, hex, hstack, intersect, lighten, mixc, outline, poly, polyline, rect, rpoly, rrect, solid, subtract, union, withGuides, type Bitmap, type RGB, type SDF } from "../kit/raster";
import type { Draw, Kit, KitDef, KitSizes, MeterRange } from "../kit/types";
import { CENTER, fg, fill, H, meterLook, type Script, TRACK_FILL, W } from "../kit/walter";

/**
 * Cubase (Pro 13/14, default dark), measured from the manual's and users' 1:1 screenshots
 * (notes in docs/research/cubase.md):
 *  - Track list: two-row tracks 46 px apart (45 px + a black line), a 40 px colour block with a
 *    type mark and the number, the joined M|S pair and the bold name on row 1, then an empty
 *    square and the [record|monitor] [e|bypass] [R|W] pairs on row 2, an 11 px black meter at
 *    the right edge. Unlit buttons are grey plates with near-white glyphs; lit: yellow M, blue S,
 *    red record, orange monitor, green R, red W, light-blue bypass. Selected rows turn mid grey.
 *  - MixConsole channel (86 px): colour header, the [M S / bypass e] grid, the pan field, the
 *    fader and meter panels, two value boxes, the [R W / record monitor] grid, the channel number
 *    and the name plate in the channel colour.
 *  - Transport bar (bottom, 40 px): the locator fields, one framed group of Cycle / Stop / Start /
 *    Record (Stop lit), the time display, tempo and signature fields, the click.
 * Everything is drawn from simple shapes; no third-party artwork.
 */

const X = {
  list: hex("#25282b"),
  sel: hex("#5b5c60"),
  sep: hex("#000000"),
  noColour: hex("#727375"),
  plate: hex("#525355"),
  edge: hex("#38393b"),
  glyph: hex("#ececec"),
  mute: hex("#e5d639"),
  solo: hex("#4b9dd8"),
  rec: hex("#cc3d3d"),
  monitor: hex("#f2973c"),
  read: hex("#32af32"),
  write: hex("#d83636"),
  bypass: hex("#58b9fe"),
  ink: hex("#121212"),
  // MixConsole
  strip: hex("#2b2f33"),
  stripSel: hex("#33383d"),
  gap: hex("#080809"),
  cell: hex("#34383c"),
  cellLine: hex("#1a1c1f"),
  well: hex("#1f1f20"),
  wellEdge: hex("#181919"),
  valueBox: hex("#292d31"),
  valueBox2: hex("#3f4346"),
  capBlue: hex("#a9dcf6"),
  scale: hex("#a0a2a4"),
  // Transport and toolbar
  bar: hex("#24282b"),
  tPlate: hex("#646569"),
  tFrame: hex("#bbbcc0"),
  tGlyph: hex("#e2e3e7"),
  tLit: hex("#a5a8ad"),
  tLitInk: hex("#1f2227"),
  cycle: hex("#725be5"),
  play: hex("#45b85a"),
  display: hex("#1a1b1f"),
  displayEdge: hex("#4f5356"),
  capGrey: hex("#434649"),
  capLight: hex("#d1d2d4"),
  digits: hex("#f3f4f6"),
  group: hex("#3c3f42"),
  groupEdge: hex("#4a4d50"),
  toolLit: hex("#e2e3e5"),
};

function palette(ui: SkinUi): Kit {
  const u = (k: keyof SkinUi) => hex(ui[k]);
  return {
    id: "cubase",
    look: "flat",
    radius: 2,
    c: {
      bg: X.list,
      panel: X.strip,
      track: X.list,
      trackSel: X.sel,
      face: X.plate,
      line: hex("#3f4144"),
      deep: X.display,
      text: hex("#f2f3f3"),
      dim: hex("#929395"),
      accent: u("accent"),
      accent2: X.cycle,
      solo: X.solo,
      arm: X.rec,
      play: X.play,
      onInk: X.ink,
      // read, touch, write, latch, preview
      env: [X.read, hex("#e5ba3b"), X.write, hex("#e58d36"), X.bypass],
      display: X.display,
      displayText: X.digits,
      knob: X.bypass,
      meter: { off: hex("#000000"), low: hex("#19d7fe"), mid: hex("#26ecc6"), high: hex("#31fd99"), clip: hex("#ff2a1a") },
    },
  };
}

/** Track-list buttons are 19 px tall (17 + 1 px edges), in pairs 48–50 px wide; mixer cells are 38 x 17. */
const SIZES: KitSizes = {
  tcpMute: [25, 19], tcpBtn: [25, 19], tcpSmall: [24, 19], tcpFx: [24, 19], tcpKnob: 18, tcpThumb: [10, 10],
  mcpMute: [38, 17], mcpBtn: [38, 17], mcpArm: [38, 17], mcpMon: [38, 17], mcpSmall: [38, 17], mcpKnob: 24, mcpThumb: [14, 30], mcpFaderW: 14,
  envBtn: [24, 19], envKnob: 18, trans: [49, 32], tap: [38, 25], menu: [38, 17], toolbar: 30,
};
/** The R|W pair in the track list (one REAPER button; the half for the automation mode lights). */
const ENV_TCP: [number, number] = [48, 19];
/** The R|W cells in the mixer (two 38 px cells and the 1 px line between them). */
const ENV_MCP: [number, number] = [77, 17];
const SQUARE: [number, number] = [20, 20];
const TICON: [number, number] = [14, 12];

// ---------------------------------------------------------------- glyphs

/** Stroke letters the shared font lacks (R, W, e, L), in a box `u` tall centred on (cx, cy). */
function letter(ch: "R" | "W" | "e" | "L", cx: number, cy: number, u: number, weight = 0.2): SDF {
  const r = Math.max((u * weight) / 2, 0.7);
  const h = u - 2 * r, y0 = cy - h / 2;
  const P = (w: number, pts: [number, number][]) => pts.map(([a, b]) => [cx - (w * h) / 2 + a * w * h, y0 + b * h] as [number, number]);
  if (ch === "R") {
    const w = 0.66;
    const bowl: [number, number][] = [[0, 1], [0, 0], [0.6, 0]];
    for (let a = -90; a <= 90; a += 15) bowl.push([0.6 + 0.4 * Math.cos((a * Math.PI) / 180), 0.27 + 0.27 * Math.sin((a * Math.PI) / 180)]);
    bowl.push([0, 0.54]);
    return union(polyline(P(w, bowl), r), polyline(P(w, [[0.52, 0.54], [1, 1]]), r));
  }
  if (ch === "W") return polyline(P(1.05, [[0, 0], [0.24, 1], [0.5, 0.28], [0.76, 1], [1, 0]]), r);
  if (ch === "L") return polyline(P(0.5, [[0, 0], [0, 1], [1, 1]]), r);
  // Cubase's "e": a slanted lower-case e: the bar across the middle, the bowl round from its right
  // end over the top and the left, open at the lower right.
  const rx = h * 0.5, ry = h * 0.46, ey = cy + h * 0.04, slant = 0.2;
  const at = (x: number, y: number): [number, number] => [x + (ey - y) * slant, y];
  const pts: [number, number][] = [];
  for (let t = 0; t <= 315; t += 15) pts.push(at(cx + rx * Math.cos((t * Math.PI) / 180), ey - ry * Math.sin((t * Math.PI) / 180)));
  const [ax, ay] = at(cx - rx, ey), [bx, by] = at(cx + rx, ey);
  return union(polyline(pts, r), capsule(ax, ay, bx, by, r));
}

type G = (cx: number, cy: number) => SDF;
const txt = (s: string, u: number, wt = 0.24): G => (cx, cy) => I.text(s, cx, cy, u, wt, 0.12);
const own = (ch: "R" | "W" | "e" | "L", u: number): G => (cx, cy) => letter(ch, cx, cy, u);
const dot: G = (cx, cy) => circle(cx, cy, 3.7);
const ringDot: G = (cx, cy) => union(subtract(circle(cx, cy, 4.4), circle(cx, cy, 3.1)), circle(cx, cy, 1.6));
/** Cubase's monitor speaker: a solid speaker and one wave. */
const spk: G = (cx, cy) => I.speaker(cx + 0.8, cy, 10, 1);
/** "Bypass inserts": a small box on a line. */
const insGlyph: G = (cx, cy) => union(outline(rect(cx - 3, cy - 3.5, 6, 7), 1.4), rect(cx - 7.5, cy - 0.7, 4.5, 1.4), rect(cx + 3, cy - 0.7, 4.5, 1.4));
/** An audio-track mark (a short waveform) for the colour block. */
const waveIcon: G = (cx, cy) => union(...[2, 5, 9, 5, 12, 7, 3, 8, 4, 2].map((hgt, i) => rect(cx - 6.6 + i * 1.4, cy - hgt / 2, 0.9, hgt)), rect(cx - 7, cy - 0.45, 14, 0.9));
/** A ring of thickness t inside a shape. */
const ring = (shape: SDF, t: number): SDF => (x, y) => Math.abs(shape(x, y) + t / 2) - t / 2;

// ---------------------------------------------------------------- button art

type Side = "both" | "left" | "right" | "mid";

/** The outline of one part of a joined group: halves meet without a seam, only outer corners are round. */
function partShape(side: Side, w: number, h: number, r: number): SDF {
  const ext = r + 3;
  if (side === "left") return rrect(0, 0, w + ext, h, r);
  if (side === "right") return rrect(-ext, 0, w + ext, h, r);
  if (side === "mid") return rect(-ext, 0, w + 2 * ext, h);
  return rrect(0, 0, w, h, r);
}
/** `shape` cut to the image's own columns. */
const clip = (shape: SDF, w: number, h: number): SDF => intersect(shape, rect(0, 0, w, h));

/**
 * A track-list button: a grey plate (or the lit colour) inside a 1 px darker edge, one half of a
 * joined pair. Three frames: normal, hover, pressed.
 */
function listBtn(w: number, h: number, side: Side, glyph: G | null, o: { lit?: RGB; ink?: RGB } = {}): Draw {
  return scaled((s) => hstack(([0, 1, 2] as Frame[]).map((f) => {
    const cv = new Canvas(w, h, s);
    const px = 1 / s;
    const shape = partShape(side, w, h, 2);
    const base = o.lit ?? X.plate;
    cv.fill(clip(shape, w, h), solid(o.lit ? darken(o.lit, 0.7) : X.edge));
    const inner = clip(rrectInset(side, w, h, 2, px), w, h);
    cv.fill(inner, solid(f === 1 ? lighten(base, 0.1) : f === 2 ? darken(base, 0.14) : base));
    const cx = side === "left" ? (w + 1) / 2 : side === "right" ? (w - 1) / 2 : w / 2;
    if (glyph) cv.fill(glyph(cx, h / 2 + (f === 2 ? 0.5 : 0)), solid(o.ink ?? X.glyph));
    return bitmap(cv);
  })));
}

/** The part shape inset by one device pixel on its outer sides only. */
function rrectInset(side: Side, w: number, h: number, r: number, px: number): SDF {
  const ext = r + 3;
  if (side === "left") return rrect(px, px, w + ext, h - 2 * px, r - px);
  if (side === "right") return rrect(-ext, px, w + ext - px, h - 2 * px, r - px);
  if (side === "mid") return rect(-ext, px, w + 2 * ext, h - 2 * px);
  return rrect(px, px, w - 2 * px, h - 2 * px, r - px);
}

/** The R|W pair in one image; the half for the automation mode lights (touch and latch light both). */
function rwPair(w: number, h: number, read: RGB | null, write: RGB | null, mixer: boolean): Draw {
  return scaled((s) => hstack(([0, 1, 2] as Frame[]).map((f) => {
    const cv = new Canvas(w, h, s);
    const px = 1 / s;
    const sh = (c: RGB) => (f === 1 ? lighten(c, 0.1) : f === 2 ? darken(c, 0.14) : c);
    let half: number;
    if (mixer) {
      half = (w - 1) / 2;
      cv.fill(rect(0, 0, w, h), solid(X.cellLine));
      cv.fill(rect(0, 0, half, h), solid(sh(read ?? X.cell)));
      cv.fill(rect(half + 1, 0, half, h), solid(sh(write ?? X.cell)));
    } else {
      half = w / 2;
      const shape = rrect(0, 0, w, h, 2);
      cv.fill(shape, solid(X.edge));
      const inner = rrect(px, px, w - 2 * px, h - 2 * px, 2 - px);
      cv.fill(inner, solid(sh(X.plate)));
      if (read) {
        cv.fill(intersect(shape, rect(0, 0, half, h)), solid(darken(read, 0.7)));
        cv.fill(intersect(inner, rect(0, 0, half, h)), solid(sh(read)));
      }
      if (write) {
        cv.fill(intersect(shape, rect(half, 0, half, h)), solid(darken(write, 0.7)));
        cv.fill(intersect(inner, rect(half, 0, half, h)), solid(sh(write)));
      }
    }
    const u = mixer ? 9.5 : 10.5;
    const dy = f === 2 ? 0.5 : 0;
    cv.fill(letter("R", half / 2 + 0.5, h / 2 + dy, u), solid(read ? X.ink : X.glyph));
    cv.fill(letter("W", w - half / 2 - 0.5, h / 2 + dy, u), solid(write ? X.ink : X.glyph));
    return bitmap(cv);
  })));
}

/** A MixConsole grid cell: a flat plate (the grid lines come from the dark backing behind it). */
function cellBtn(w: number, h: number, glyph: G | null, o: { lit?: RGB; ink?: RGB } = {}): Draw {
  return scaled((s) => hstack(([0, 1, 2] as Frame[]).map((f) => {
    const cv = new Canvas(w, h, s);
    const base = o.lit ?? X.cell;
    cv.fill(rect(0, 0, w, h), solid(f === 1 ? lighten(base, 0.08) : f === 2 ? darken(base, 0.15) : base));
    if (glyph) cv.fill(glyph(w / 2, h / 2 + (f === 2 ? 0.5 : 0)), solid(o.ink ?? hex("#e5e5e5")));
    return bitmap(cv);
  })));
}

/**
 * A transport button, one part of the framed group: a 2 px light frame along the group's outside
 * (top, bottom, and the left or right end), the plate inside, the glyph centred on the plate.
 */
function tBtn(w: number, h: number, side: Side, glyph: G, lit?: RGB, ink?: RGB): Draw {
  return scaled((s) => hstack(([0, 1, 2] as Frame[]).map((f) => {
    const cv = new Canvas(w, h, s);
    const b = 2;
    const outer = clip(partShape(side, w, h, 4), w, h);
    const l = side === "left" || side === "both" ? b : 0, r = side === "right" || side === "both" ? b : 0;
    const ext = 8;
    const inner = clip(side === "left" ? rrect(b, b, w + ext, h - 2 * b, 2.5) : side === "right" ? rrect(-ext, b, w + ext - b, h - 2 * b, 2.5) : side === "mid" ? rect(-ext, b, w + 2 * ext, h - 2 * b) : rrect(b, b, w - 2 * b, h - 2 * b, 2.5), w, h);
    cv.fill(outer, solid(X.tFrame));
    const base = lit ?? X.tPlate;
    cv.fill(inner, solid(f === 1 ? lighten(base, 0.08) : f === 2 ? darken(base, 0.12) : base));
    const cx = l + (w - l - r) / 2;
    cv.fill(glyph(cx, h / 2 + (f === 2 ? 0.5 : 0)), solid(ink ?? (lit ? X.tLitInk : X.tGlyph)));
    return bitmap(cv);
  })));
}

/** A stand-alone transport / toolbar style button (the click): a plate with the glyph. */
function plateBtn(w: number, h: number, glyph: G, plate: RGB, ink: RGB): Draw {
  return scaled((s) => hstack(([0, 1, 2] as Frame[]).map((f) => {
    const cv = new Canvas(w, h, s);
    cv.fill(rrect(0, 0, w, h, 3), solid(f === 1 ? lighten(plate, 0.08) : f === 2 ? darken(plate, 0.12) : plate));
    cv.fill(glyph(w / 2, h / 2 + (f === 2 ? 0.5 : 0)), solid(ink));
    return bitmap(cv);
  })));
}

/** A stretchable panel: a fill with a 1 px line along the bottom (or right). */
function rowPanel(fillc: RGB, line: RGB, side: "bottom" | "right" | "top" = "bottom"): Draw {
  return (s) => {
    const w = 24, h = 24, px = 1 / s;
    const cv = new Canvas(w, h, s);
    cv.fill(rect(0, 0, w, h), solid(fillc));
    cv.fill(side === "bottom" ? rect(0, h - px, w, px) : side === "top" ? rect(0, 0, w, px) : rect(w - px, 0, px, h), solid(line));
    return withGuides(bitmap(cv), 2, 2, 2, 2);
  };
}

/** A stretchable rounded box (fields, wells, value boxes), optionally with an unstretched cap at the left. */
function box(fillc: RGB, edge: RGB | null, r: number, cap?: { w: number; c: RGB; glyph?: G; ink?: RGB }): Draw {
  return scaled((s) => {
    const capW = cap?.w ?? 0;
    const w = capW + 24, h = 25, px = 1 / s;
    const cv = new Canvas(w, h, s);
    const shape = rrect(0, 0, w, h, r);
    cv.fill(shape, solid(edge ?? fillc));
    const inner = edge ? rrect(px, px, w - 2 * px, h - 2 * px, Math.max(r - px, 0)) : shape;
    cv.fill(inner, solid(fillc));
    if (cap) {
      cv.fill(intersect(inner, rect(0, 0, capW, h)), solid(cap.c));
      if (edge) cv.fill(rect(capW, px, px, h - 2 * px), solid(edge));
      if (cap.glyph) cv.fill(cap.glyph(capW / 2, h / 2), solid(cap.ink ?? X.digits));
    }
    const g = Math.ceil((r + 1) * s);
    return withGuides(bitmap(cv), Math.ceil(capW * s) + g, g, g, g);
  });
}

/** A fixed-size image from a drawing function. */
function pic(w: number, h: number, paint: (cv: Canvas, s: number) => void): Draw {
  return scaled((s) => {
    const cv = new Canvas(w, h, s);
    paint(cv, s);
    return bitmap(cv);
  });
}

/** A stretchable solid colour (transparent allowed). */
const flat = (c: RGB, a = 1): Draw => (s) => {
  const cv = new Canvas(6, 6, s);
  if (a > 0) cv.fill(rect(0, 0, 6, 6), solid(c, a));
  return bitmap(cv);
};

/** Cubase's fader cap: ribbed, coloured by channel type (one image here: the audio channel's light blue), a dark centre line. */
function faderCap(w: number, h: number): Draw {
  return scaled((s) => {
    const cv = new Canvas(w, h, s);
    const px = 1 / s;
    cv.fill(rrect(0, 0, w, h, 1.5), solid(hex("#0d2a3a")));
    cv.fill(rrect(px, px, w - 2 * px, h - 2 * px, 1), solid(X.capBlue));
    for (let y = 3; y < h - 3; y += 2) cv.fill(rect(px, y, w - 2 * px, px), solid(hex("#ffffff"), 0.5));
    cv.fill(rect(px, px, w - 2 * px, 2), solid(hex("#4dcaff")));
    cv.fill(rect(px, h - 3, w - 2 * px, 2), solid(hex("#1ab1fe")));
    cv.fill(rect(px, Math.round((h / 2 - 0.5) * s) / s, w - 2 * px, Math.max(px, 1)), solid(hex("#3d4a52")));
    return bitmap(cv);
  });
}

/** The fader slot: a thin black line, stretchable vertically. */
function faderSlot(w: number): Draw {
  return (s) => {
    const h = 40;
    const cv = new Canvas(w, h, s);
    const x = Math.round((w / 2 - 1) * s) / s;
    cv.fill(rect(x, 2, 2, h - 4), solid(hex("#060606")));
    const b = bitmap(cv);
    const g = Math.round(4 * s);
    const half = Math.floor(b.width / 2) - 1;
    return withGuides(b, half, g, half, g);
  };
}

/**
 * Note colours in REAPER's colormap layout: velocity (blue soft → red hard, measured from the Key
 * Editor), pitch (Cubase's pitch colours), channels; black edges, selected notes lighter with white edges.
 */
function noteMap(): Draw {
  const lo = hex("#2a7ae0"), hi = hex("#e02626");
  const vel = (v: number): RGB => mixc(lo, hi, v / 127);
  const pitch = ["#e53636", "#e57a36", "#e5ba3b", "#30cccc", "#bae53b", "#e8e84c", "#3bb0e5", "#e58d36", "#7a5be5", "#e536b9", "#bae53b", "#36e58d"].map(hex);
  const chan = (i: number): RGB => pitch[(i * 5) % 12]!;
  const col = (x: number): RGB => (x < 12 ? pitch[x]! : x < 140 ? vel(x - 12) : x === 140 ? hex("#c23344") : chan(x - 141));
  return exact(157, 130, (x, y) => {
    const c = col(x);
    if (y === 64) return hex("#000000");
    if (y === 129) return hex("#ffffff");
    return y >= 65 ? lighten(c, 0.35) : c;
  });
}

// ---------------------------------------------------------------- toolbar glyphs (u ≈ 16)

const T = (u: number) => u * 0.085;
const GLYPHS: Record<string, (cx: number, cy: number, u: number) => SDF> = {
  undo: I.tb.undo!,
  redo: I.tb.redo!,
  mediabay: (cx, cy, u) => union(I.folder(cx - u * 0.06, cy + u * 0.04, u * 0.8), circle(cx + u * 0.34, cy + u * 0.3, u * 0.14)),
  mixconsole: (cx, cy, u) => union(...[-0.3, 0, 0.3].flatMap((d, i) => [capsule(cx + u * d, cy - u * 0.42, cx + u * d, cy + u * 0.42, T(u) * 0.8), rrect(cx + u * d - u * 0.12, cy + u * [0.1, -0.22, 0.24][i]! - u * 0.08, u * 0.24, u * 0.16, u * 0.03)])),
  mute_all: (cx, cy, u) => I.text("M", cx, cy, u * 0.68, 0.26),
  solo_all: (cx, cy, u) => I.text("S", cx, cy, u * 0.68, 0.26),
  read_all: (cx, cy, u) => letter("R", cx, cy, u * 0.68, 0.26),
  write_all: (cx, cy, u) => letter("W", cx, cy, u * 0.68, 0.24),
  autoscroll: (cx, cy, u) => union(I.play(cx + u * 0.1, cy, u * 0.5), capsule(cx - u * 0.36, cy - u * 0.4, cx - u * 0.36, cy + u * 0.4, T(u)), capsule(cx + u * 0.42, cy - u * 0.4, cx + u * 0.42, cy + u * 0.4, T(u))),
  locators: (cx, cy, u) => union(polyline([[cx - u * 0.2, cy - u * 0.4], [cx - u * 0.42, cy - u * 0.4], [cx - u * 0.42, cy + u * 0.4], [cx - u * 0.2, cy + u * 0.4]], T(u)), polyline([[cx + u * 0.2, cy - u * 0.4], [cx + u * 0.42, cy - u * 0.4], [cx + u * 0.42, cy + u * 0.4], [cx + u * 0.2, cy + u * 0.4]], T(u)), rect(cx - u * 0.24, cy - u * 0.1, u * 0.48, u * 0.2)),
  // The nine tools: arrow, range, blade, glue tube, eraser, magnifier, mute cross, pencil, play speaker.
  tool_1: (cx, cy, u) => rpoly([[cx - u * 0.26, cy - u * 0.48], [cx + u * 0.3, cy + u * 0.08], [cx + u * 0.04, cy + u * 0.1], [cx + u * 0.22, cy + u * 0.44], [cx + u * 0.08, cy + u * 0.5], [cx - u * 0.08, cy + u * 0.16], [cx - u * 0.26, cy + u * 0.32]], u * 0.02),
  tool_2: (cx, cy, u) => union(capsule(cx - u * 0.18, cy - u * 0.44, cx - u * 0.18, cy + u * 0.44, T(u)), capsule(cx - u * 0.34, cy - u * 0.44, cx - u * 0.02, cy - u * 0.44, T(u)), capsule(cx - u * 0.34, cy + u * 0.44, cx - u * 0.02, cy + u * 0.44, T(u)), rect(cx + u * 0.04, cy - u * 0.2, u * 0.4, u * 0.4)),
  tool_3: (cx, cy, u) => union(subtract(circle(cx - u * 0.24, cy + u * 0.3, u * 0.17), circle(cx - u * 0.24, cy + u * 0.3, u * 0.08)), subtract(circle(cx + u * 0.24, cy + u * 0.3, u * 0.17), circle(cx + u * 0.24, cy + u * 0.3, u * 0.08)), capsule(cx - u * 0.14, cy + u * 0.18, cx + u * 0.22, cy - u * 0.46, T(u) * 1.1), capsule(cx + u * 0.14, cy + u * 0.18, cx - u * 0.22, cy - u * 0.46, T(u) * 1.1)),
  tool_4: (cx, cy, u) => union(rpoly([[cx - u * 0.42, cy + u * 0.1], [cx + u * 0.14, cy - u * 0.32], [cx + u * 0.32, cy - u * 0.1], [cx - u * 0.24, cy + u * 0.32]], u * 0.04), capsule(cx + u * 0.24, cy - u * 0.22, cx + u * 0.4, cy - u * 0.38, T(u) * 1.3), circle(cx - u * 0.36, cy + u * 0.4, u * 0.08)),
  tool_5: (cx, cy, u) => union(rpoly([[cx - u * 0.44, cy + u * 0.12], [cx + u * 0.04, cy - u * 0.38], [cx + u * 0.44, cy + u * 0.02], [cx - u * 0.04, cy + u * 0.5]], u * 0.04), capsule(cx - u * 0.1, cy + u * 0.46, cx + u * 0.46, cy + u * 0.46, T(u))),
  tool_6: (cx, cy, u) => union(subtract(circle(cx - u * 0.1, cy - u * 0.1, u * 0.32), circle(cx - u * 0.1, cy - u * 0.1, u * 0.2)), capsule(cx + u * 0.14, cy + u * 0.14, cx + u * 0.42, cy + u * 0.42, T(u) * 1.5)),
  tool_7: (cx, cy, u) => union(capsule(cx - u * 0.36, cy - u * 0.36, cx + u * 0.36, cy + u * 0.36, T(u) * 1.3), capsule(cx + u * 0.36, cy - u * 0.36, cx - u * 0.36, cy + u * 0.36, T(u) * 1.3)),
  tool_8: (cx, cy, u) => union(rpoly([[cx - u * 0.3, cy + u * 0.14], [cx + u * 0.18, cy - u * 0.34], [cx + u * 0.34, cy - u * 0.18], [cx - u * 0.14, cy + u * 0.3]], u * 0.02), poly([[cx - u * 0.34, cy + u * 0.2], [cx - u * 0.2, cy + u * 0.34], [cx - u * 0.44, cy + u * 0.44]])),
  tool_9: (cx, cy, u) => union(I.speaker(cx - u * 0.12, cy, u * 0.8, 0), I.play(cx + u * 0.32, cy, u * 0.42)),
  snap: I.tb.snap!,
  grid: I.tb.grid!,
  quantize: (cx, cy, u) => I.text("Q", cx, cy, u * 0.68, 0.24),
  click: I.tb.metro!,
};
// Cubase's toolbar letters (M S R W, Q) are as tall as its icons (about 11 px at 1x); REAPER's 16 px
// icon unit leaves ours at 8 px, so they are drawn larger.
const LETTERS = new Set(["mute_all", "solo_all", "read_all", "write_all", "quantize"]);
const toolbarGlyphs = Object.fromEntries(
  Object.entries(GLYPHS).map(([n, g]) => [`assist_cubase_${n}`, LETTERS.has(n) ? (cx: number, cy: number, u: number) => g(cx, cy, u * 1.35) : g]),
);

// ---------------------------------------------------------------- layout

/** The track colour, or Cubase's grey for tracks without one. */
const colOr = `?trackcolor_valid ${TRACK_FILL} ${fill(X.noColour)}`;
/** Dark ink on light colours (and on the grey), light ink on dark colours. */
const inkOn = (dark: RGB, light: RGB) => `?trackcolor_valid kBright{0}>110 ${fg(dark)} ${fg(light)} ${fg(dark)}`;

/** Row 2 x positions (Cubase: pairs 48 px wide, 2–3 px apart, from x 104). */
const R2 = { rec: 104, mon: 128, fx: 154, byp: 178, env: 204, input: 256 };
const Y2 = 24;

function tcp(k: Kit, w: Script) {
  const z = SIZES;
  // Colour block: track colour or grey, a type mark top left, the number at the right.
  w.custom("tcp.custom.kCol");
  w.set("tcp.custom.kCol", w.p(3, 0, 40, H(-1)));
  w.set("tcp.custom.kCol.color", colOr);
  w.custom("tcp.custom.kIcon", "k_ticon");
  w.tall(20, "tcp.custom.kIcon", w.at(7, 5, TICON));
  // Customs declared earlier are drawn over later ones: bring the mark in front of the colour block.
  w.raw("front tcp.custom.kIcon");
  w.tall(16, "tcp.trackidx", w.p(3, 3, 37, 19));
  w.set("tcp.trackidx.color", inkOn(hex("#2a2a2a"), hex("#ececec")));
  w.set("tcp.trackidx.font", w.font("value"));
  w.set("tcp.trackidx.margin", "[0 0 0 0 1]");
  // Row 1: M|S, then the name.
  w.tall(16, "tcp.mute", w.at(48, 3, z.tcpMute));
  w.tall(16, "tcp.solo", w.at(73, 3, z.tcpBtn));
  w.tall(16, "tcp.label", w.p(108, 3, W(-128), 19));
  w.set("tcp.label.font", w.font("label"));
  w.set("tcp.label.margin", "[0 0 0 0 0]");
  w.set("tcp.label.color", fg(hex("#f4f4f4")));
  // Row 2: the empty square (REAPER's folder button), then [record|monitor] [e|bypass] [R|W]; the input when armed.
  w.tall(44, "tcp.folder", w.at(49, Y2 + 1, SQUARE));
  w.tall(44, "tcp.foldercomp", `folderstate==1 ${w.at(16, Y2 + 1, SQUARE)} [0]`);
  w.tall(42, "tcp.recarm", w.at(R2.rec, Y2, z.tcpSmall));
  w.tall(42, "tcp.recmon", w.at(R2.mon, Y2, z.tcpSmall));
  w.tall(42, "tcp.fx", w.at(R2.fx, Y2, z.tcpFx));
  w.tall(42, "tcp.fxbyp", w.at(R2.byp, Y2, z.tcpSmall));
  w.tall(42, "tcp.env", w.at(R2.env, Y2, ENV_TCP));
  // The input field (Cubase shows one on MIDI tracks only): armed tracks on a wide track list; the
  // record button's right-click menu picks the input otherwise.
  w.tall(42, "tcp.recinput", `?recarm w<${w.n(420)} [0] ${w.p(R2.input, Y2, W(-R2.input - 20), 19)} [0]`);
  w.set("tcp.recinput.color", `[242 243 243 255 26 27 31 255]`);
  w.set("tcp.recinput.margin", `[${w.n(5)} 0 ${w.n(4)} 0 0]`);
  // Meter: an 11 px black strip at the right edge, the full height of the track.
  w.tall(10, "tcp.meter", w.p(W(-14), 0, 11, H(-1)));
  meterLook(w, "tcp.meter", k, { scale: false, readout: false });
  w.set("tcp.meter.vu.div", "[1]");
  // Taller tracks: a third row with volume and pan (REAPER's; Cubase keeps them in the Inspector).
  const y3 = 48;
  w.tall(68, "tcp.volume", w.p(R2.rec, y3 + 5, W(-R2.rec - 124), 10));
  w.set("tcp.volume.fadermode", "[-1]");
  w.custom("tcp.custom.kDb", "k_field");
  w.tall(68, "tcp.custom.kDb", w.p(W(-114), y3, 52, 19));
  w.tall(68, "tcp.volume.label", w.p(W(-114), y3, 52, 19));
  w.set("tcp.volume.label.color", fg(hex("#f2f3f3")));
  w.set("tcp.volume.label.font", w.font("value"));
  w.set("tcp.volume.label.margin", CENTER);
  w.tall(68, "tcp.pan", w.p(W(-58), y3 + 5, 38, 10));
  w.set("tcp.pan.fadermode", "[-1]");
  w.set("tcp.fxparm", `h<${w.n(100)} [0] ${w.p(R2.rec, 72, W(-R2.rec - 20), H(-76))}`);
}

function masterTcp(k: Kit, w: Script) {
  const z = SIZES;
  w.custom("master.tcp.custom.kCol");
  w.set("master.tcp.custom.kCol", w.p(3, 0, 40, H(-1)));
  w.set("master.tcp.custom.kCol.color", fill(X.noColour));
  w.tall(16, "master.tcp.mute", w.at(48, 3, z.tcpMute));
  w.tall(16, "master.tcp.solo", w.at(73, 3, z.tcpBtn));
  w.tall(16, "master.tcp.label", w.p(108, 3, W(-128), 19));
  w.set("master.tcp.label.font", w.font("label"));
  w.set("master.tcp.label.margin", "[0 0 0 0 0]");
  w.set("master.tcp.label.color", fg(hex("#f4f4f4")));
  w.tall(42, "master.tcp.fx", w.at(R2.fx, Y2, z.tcpFx));
  w.tall(42, "master.tcp.fxbyp", w.at(R2.byp, Y2, z.tcpSmall));
  w.tall(42, "master.tcp.env", w.at(R2.env, Y2, ENV_TCP));
  w.tall(10, "master.tcp.meter", w.p(W(-14), 0, 11, H(-1)));
  meterLook(w, "master.tcp.meter", k, { scale: false, readout: false });
  w.set("master.tcp.meter.vu.div", "[1]");
  const y3 = 48;
  w.tall(68, "master.tcp.volume", w.p(R2.rec, y3 + 5, W(-R2.rec - 124), 10));
  w.set("master.tcp.volume.fadermode", "[-1]");
  w.custom("master.tcp.custom.kDb", "k_field");
  w.tall(68, "master.tcp.custom.kDb", w.p(W(-114), y3, 52, 19));
  w.tall(68, "master.tcp.volume.label", w.p(W(-114), y3, 52, 19));
  w.set("master.tcp.volume.label.color", fg(hex("#f2f3f3")));
  w.set("master.tcp.volume.label.font", w.font("value"));
  w.set("master.tcp.volume.label.margin", CENTER);
  w.tall(68, "master.tcp.pan", w.p(W(-58), y3 + 5, 38, 10));
  w.set("master.tcp.pan.fadermode", "[-1]");
}

/** dB marks in the meter panel, with the image each uses. */
const MARKS: [number, string][] = [[0, "k_sc_0"], [-6, "k_sc_6"], [-12, "k_sc_12"], [-18, "k_sc_18"], [-24, "k_sc_24"], [-40, "k_sc_40"]];
const MARK: [number, number] = [24, 9];
/**
 * The fader scale: image, label, and REAPER's fader position for that level (DB2SLIDER / 1000,
 * measured in REAPER 7.82: +6 852, 0 716, -5 612, -10 519, -15 435, -20 363, -30 250, -40 171).
 */
const FADER_MARKS: [string, string, number][] = [
  ["k_fs_6", "6", 0.8523], ["k_fs_0", "0", 0.716], ["k_fs_5", "5", 0.6125], ["k_fs_10", "10", 0.5185], ["k_fs_15", "15", 0.4354],
  ["k_fs_t", "", 0.3633], ["k_fs_t", "", 0.2501], ["k_fs_t", "", 0.171], ["k_fs_inf", "oo", 0],
];
const FMARK: [number, number] = [20, 9];

/** Fixed parts of the mixer channel: the top (header, grid, pan) and the bottom (value boxes to name plate). */
const MCP_TOP = 83, MCP_BOTTOM = 122;

/**
 * A MixConsole channel (86 px), top down: colour header, inserts / sends (REAPER's extended mixer,
 * on tall strips), the [M S / bypass e] grid, pan, the fader and meter panels, the value boxes,
 * the [R W / record monitor] grid, the channel number and the name plate in the channel colour.
 */
function mcp(k: Kit, w: Script, { master, range }: { master: boolean; range: MeterRange }) {
  const z = SIZES;
  const P = master ? "master.mcp" : "mcp";
  w.custom(`${P}.custom.kTop`);
  w.set(`${P}.custom.kTop`, w.p(1, 1, W(-3), 17));
  w.set(`${P}.custom.kTop.color`, master ? fill(hex("#aeb0b2")) : colOr);
  // Inserts and sends: only on tall strips (the height above 420 px); short strips keep the fader long.
  w.set("kE", `mcp_wantextmix>0 h<${w.n(420)} [0] + [0 ${-w.n(320)}] [0 h] [0]`);
  w.set("kE2", "- kE [0 0 0 kE{1}]");
  w.set(`${P}.extmixer.mode`, "[1]");
  w.raw(`front ${P}.extmixer`);
  w.set(`${P}.extmixer.position`, `mcp_wantextmix>0 h<${w.n(420)} [0] + [${w.n(3)} ${w.n(21)} ${-w.n(6)} 0] [0 0 w kE{1}] [0]`);
  // The [M S / bypass e] grid on its dark backing.
  const y0 = 22;
  w.custom(`${P}.custom.kGrid`);
  w.set(`${P}.custom.kGrid`, `+ kE ${w.p(3, y0 - 1, 79, 37)}`);
  w.set(`${P}.custom.kGrid.color`, fill(X.cellLine));
  w.set(`${P}.mute`, `+ kE ${w.at(4, y0, z.mcpMute)}`);
  w.set(`${P}.solo`, `+ kE ${w.at(43, y0, z.mcpBtn)}`);
  w.set(`${P}.fxbyp`, `+ kE ${w.at(4, y0 + 18, z.mcpSmall)}`);
  w.set(`${P}.fx`, `+ kE ${w.at(43, y0 + 18, z.mcpSmall)}`);
  // Pan: a dark field with a white marker.
  const yp = y0 + 39;
  w.custom(`${P}.custom.kPan`, "k_well");
  w.set(`${P}.custom.kPan`, `+ kE ${w.p(4, yp, 78, 17)}`);
  w.set(`${P}.pan`, `+ kE ${w.p(6, yp + 1, 74, 15)}`);
  w.set(`${P}.pan.fadermode`, "[-1]");
  // Fader panel (left) and meter panel (right) fill the height between the pan field and the value boxes.
  const yf = MCP_TOP, span = H(-(yf + MCP_BOTTOM));
  w.custom(`${P}.custom.kFP`, "k_well");
  w.set(`${P}.custom.kFP`, `+ kE2 ${w.p(3, yf, 37, span)}`);
  w.custom(`${P}.custom.kMP`, "k_well");
  w.set(`${P}.custom.kMP`, `+ kE2 ${w.p(44, yf, 38, span)}`);
  const [tw, th] = z.mcpThumb;
  const fy = yf + 3, fsub = yf + MCP_BOTTOM + 6;
  w.set(`${P}.volume`, `+ kE2 ${w.p(5, fy, tw, H(-fsub))}`);
  // The fader scale, right of the fader: each mark where the cap's centre sits at that level
  // (y = fy + th/2 + (1 - p)(h - fsub - th); kE moves it by p).
  const marks: string[] = [];
  FADER_MARKS.forEach(([image, , p], i) => {
    const name = `${P}.custom.kFs${i}`;
    w.custom(name, image);
    w.set(name, `+ * ${p} kE ${w.p(20, H(fy + th / 2 - (1 - p) * (fsub + th) - FMARK[1] / 2, +(1 - p).toFixed(4)), FMARK[0], FMARK[1])}`);
    marks.push(name);
  });
  const mt = yf + 6, mb = MCP_BOTTOM + 6;
  w.set(`${P}.meter`, `+ kE2 ${w.p(47, mt, 9, H(-(mt + mb)))}`);
  meterLook(w, `${P}.meter`, k, { scale: false, readout: false });
  w.set(`${P}.meter.vu.div`, "[1]");
  const spanDb = range.max - range.min;
  MARKS.forEach(([db, image], i) => {
    if (db > range.max || db < range.min) return;
    const f = (range.max - db) / spanDb;
    const name = `${P}.custom.kSc${i}`;
    w.custom(name, image);
    // y = mt + f * (h - mt - mb): a constant part and a share of the strip height; kE moves it by (1 - f).
    w.set(name, `+ * ${+(1 - f).toFixed(4)} kE ${w.p(57, H(mt - f * (mt + mb) - MARK[1] / 2, +f.toFixed(4)), MARK[0], MARK[1])}`);
    marks.push(name);
  });
  // Customs declared earlier are drawn over later ones: the marks come in front of the panels.
  if (marks.length) w.raw(`front ${marks.join(" ")}`);
  // Value boxes: volume (dark) and pan (lighter), where Cubase shows the level and the peak.
  const yv = H(-116);
  w.custom(`${P}.custom.kVol`, "k_vbox");
  w.set(`${P}.custom.kVol`, w.p(3, yv, 38, 18));
  w.set(`${P}.volume.label`, w.p(3, yv, 38, 18));
  w.set(`${P}.volume.label.color`, fg(hex("#e2e3e4")));
  w.set(`${P}.volume.label.font`, w.font("value"));
  w.set(`${P}.volume.label.margin`, CENTER);
  w.custom(`${P}.custom.kPk`, "k_vbox2");
  w.set(`${P}.custom.kPk`, w.p(43, yv, 39, 18));
  w.set(`${P}.pan.label`, w.p(43, yv, 39, 18));
  w.set(`${P}.pan.label.color`, fg(hex("#e2e3e4")));
  w.set(`${P}.pan.label.font`, w.font("value"));
  w.set(`${P}.pan.label.margin`, CENTER);
  // [R W / record monitor] grid.
  w.custom(`${P}.custom.kGrid2`);
  w.set(`${P}.custom.kGrid2`, w.p(3, H(-93), 79, 37));
  w.set(`${P}.custom.kGrid2.color`, fill(X.cellLine));
  w.set(`${P}.env`, w.at(4, H(-92), ENV_MCP));
  if (master) {
    w.set("master.mcp.mono", w.at(4, H(-74), z.mcpArm));
    w.set("master.mcp.menubutton", w.at(43, H(-74), z.menu));
  } else {
    w.set("mcp.recarm", w.at(4, H(-74), z.mcpArm));
    w.set("mcp.recmon", w.at(43, H(-74), z.mcpMon));
  }
  // The channel number (right) with a type mark (left), then the name plate in the channel colour.
  w.custom(`${P}.custom.kIcon`, "k_ticon");
  w.set(`${P}.custom.kIcon`, w.at(6, H(-51), TICON));
  if (!master) {
    w.set("mcp.trackidx", w.p(40, H(-55), 41, 20));
    w.set("mcp.trackidx.color", fg(hex("#d9dadb")));
    w.set("mcp.trackidx.font", w.font("tempo"));
    w.set("mcp.trackidx.margin", "[0 0 0 0 1]");
  }
  w.custom(`${P}.custom.kName`);
  w.set(`${P}.custom.kName`, w.p(0, H(-33), W(-1), 33));
  w.set(`${P}.custom.kName.color`, master ? fill(hex("#aeb0b2")) : colOr);
  w.set(`${P}.label`, w.p(4, H(-33), W(-8), 33));
  w.set(`${P}.label.margin`, "[0 0 0 0 0]");
  w.set(`${P}.label.font`, w.font("tempo"));
  w.set(`${P}.label.color`, master ? fg(hex("#121212")) : inkOn(hex("#121212"), hex("#f4f4f4")));
  w.raw(`front ${P}.label`);
}

/**
 * The Transport bar, as Cubase's: centred, the locator fields, one framed group (Cycle, Stop,
 * Start, Record), the time display, tempo and signature fields, then the click.
 */
function trans(k: Kit, w: Script) {
  void k;
  w.set("trans.size", `[${w.n(1000)} ${w.n(40)}]`);
  w.set("trans.size.minmax", `[${w.n(300)} ${w.n(40)} ${w.n(4000)} ${w.n(144)}]`);
  w.set("trans.size.dockedheight", `[${w.n(40)}]`);
  const at = (dx: number) => W(dx, 0.5);
  const y = 4, dy = 8, dh = 25;
  // The framed group, centred.
  w.set("trans.repeat", w.p(at(-100), y, 51, 32));
  w.set("trans.stop", w.p(at(-49), y, 49, 32));
  w.set("trans.play", w.p(at(0), y, 49, 32));
  w.set("trans.rec", w.p(at(49), y, 51, 32));
  // Left of it: the locators (REAPER's time selection fields), where Cubase has L and R.
  w.set("trans.sel", `w<${w.n(900)} [0] ${w.p(at(-346), dy, 240, dh)}`);
  w.set("trans.sel.color", fg(X.digits));
  w.set("trans.sel.font", w.font("tempo"));
  w.set("trans.sel.margin", `[${w.n(4)} 0 ${w.n(4)} 0 1]`);
  // Right of it: the time display (a note cap, then the position).
  const custom = (name: string, image: string, rect: string, cmd = 0, tip = "") => {
    w.raw(`custom trans.custom.${name} '' ${cmd} '${tip}' '${image}'`);
    w.set(`trans.custom.${name}`, rect);
  };
  custom("kTime", "k_time", w.p(at(152), dy, 264, dh));
  // REAPER fills the status rect with its background colour and sizes the (left-aligned) position to
  // the rect's width: keep it inside the display's border, filled with the display colour, wide enough
  // for Cubase's digit size (Cubase's display is about as wide).
  w.set("trans.status", w.p(at(177), dy + 1, 238, dh - 2));
  w.set("trans.status.margin", `[${w.n(4)} 0 ${w.n(4)} 0]`);
  w.set("trans.status.color", `[${X.digits.map(Math.round).join(" ")} 255 ${X.display.map(Math.round).join(" ")} 255]`);
  // Tempo (a light cap, then the value), then the click. (Cubase's bar shows no signature here.)
  custom("kTempo", "k_tempo", w.p(at(424), dy, 132, dh));
  w.set("trans.bpm.edit", w.p(at(448), dy, 108, dh));
  w.set("trans.bpm.edit.font", w.font("tempo"));
  w.set("trans.bpm.edit.color", fg(X.digits));
  w.set("trans.bpm.edit.margin", `[0 0 ${w.n(10)} 0 1]`);
  w.set("trans.curtimesig", "[0]");
  custom("kClick", "k_click", w.p(at(564), dy, 30, dh), 40364, "Metronome click");
  w.set("trans.pause", "[0]");
  w.set("trans.automode", "[0]");
}

// ---------------------------------------------------------------- images

function images(k: Kit, out: Record<string, Draw>) {
  const z = SIZES;
  const c = k.c;
  const [mw, mh] = z.tcpMute;
  const [sw, sh] = z.tcpSmall;
  const M = txt("M", 10), S = txt("S", 10);

  // Track list: M|S, [record|monitor], [e|bypass], R|W, the empty square.
  out.track_mute_off = listBtn(mw, mh, "left", M);
  out.track_mute_on = listBtn(mw, mh, "left", M, { lit: X.mute, ink: X.ink });
  out.track_solo_off = listBtn(mw, mh, "right", S);
  out.track_solo_on = listBtn(mw, mh, "right", S, { lit: X.solo, ink: X.glyph });
  out.track_recarm_off = listBtn(sw, sh, "left", dot);
  out.track_recarm_on = listBtn(sw, sh, "left", dot, { lit: X.rec, ink: hex("#000000") });
  out.track_recarm_norec = listBtn(sw, sh, "left", dot, { lit: darken(X.rec, 0.35), ink: hex("#000000") });
  out.track_recarm_auto = listBtn(sw, sh, "left", ringDot, { ink: mixc(X.rec, X.glyph, 0.4) });
  out.track_recarm_auto_on = listBtn(sw, sh, "left", ringDot, { lit: X.rec, ink: hex("#000000") });
  out.track_recarm_auto_norec = listBtn(sw, sh, "left", ringDot, { lit: darken(X.rec, 0.35), ink: hex("#000000") });
  // Monitoring: REAPER's "on" is its default, so "on" is the plain plate; "auto" is Cubase's lit orange.
  out.track_monitor_off = listBtn(sw, sh, "right", spk, { ink: mixc(X.glyph, X.plate, 0.55) });
  out.track_monitor_on = listBtn(sw, sh, "right", spk);
  out.track_monitor_auto = listBtn(sw, sh, "right", spk, { lit: X.monitor, ink: X.ink });
  const e = own("e", 11);
  out.track_fx_norm = listBtn(sw, sh, "left", e);
  out.track_fx_empty = listBtn(sw, sh, "left", e);
  out.track_fx_dis = listBtn(sw, sh, "left", e, { ink: mixc(X.glyph, X.plate, 0.55) });
  for (const o of ["h", "v"] as const) {
    out[`track_fxon_${o}`] = listBtn(sw, sh, "right", insGlyph);
    out[`track_fxoff_${o}`] = listBtn(sw, sh, "right", insGlyph, { lit: X.bypass, ink: hex("#ffffff") });
    out[`track_fxempty_${o}`] = listBtn(sw, sh, "right", insGlyph, { ink: mixc(X.glyph, X.plate, 0.5) });
  }
  const [ew, eh] = ENV_TCP;
  out.track_env = rwPair(ew, eh, null, null, false);
  out.track_env_read = rwPair(ew, eh, X.read, null, false);
  out.track_env_touch = rwPair(ew, eh, X.read, X.write, false);
  out.track_env_latch = rwPair(ew, eh, X.read, X.write, false);
  out.track_env_write = rwPair(ew, eh, null, X.write, false);
  out.track_env_preview = rwPair(ew, eh, X.bypass, null, false);
  // The empty square under M|S (REAPER's folder button): empty on normal tracks, a folder mark on folder tracks.
  const square = (g: G | null, ink: RGB = X.glyph) => scaled((s) => hstack(([0, 1, 2] as Frame[]).map((f) => {
    const cv = new Canvas(SQUARE[0], SQUARE[1], s);
    const shape = rrect(0, 0, SQUARE[0], SQUARE[1], 3);
    cv.fill(outline(shape, 2), solid(hex("#000000"), f === 1 ? 0.32 : 0.18));
    if (f === 1) cv.fill(rrect(2, 2, SQUARE[0] - 4, SQUARE[1] - 4, 1), solid(hex("#ffffff"), 0.05));
    if (g) cv.fill(g(SQUARE[0] / 2, SQUARE[1] / 2), solid(ink));
    return bitmap(cv);
  })));
  out.track_folder_off = square(null);
  out.track_folder_on = square((cx, cy) => I.folder(cx, cy, 10));
  out.track_folder_last = square((cx, cy) => I.chevron(cx, cy, 8, -1), mixc(X.glyph, X.list, 0.3));
  out.track_fcomp_off = square((cx, cy) => I.chevron(cx, cy, 8, 1));
  out.track_fcomp_small = square((cx, cy) => I.chevron(cx, cy, 8, -1));
  out.track_fcomp_tiny = square((cx, cy) => I.chevron(cx, cy, 8, -1), X.bypass);
  out.mcp_folder_on = out.track_folder_on;
  out.mcp_folder_last = out.track_folder_last;
  out.mcp_fcomp_off = out.track_fcomp_off;
  out.mcp_fcomp_tiny = out.track_fcomp_tiny;

  // Mixer cells.
  const [cw, ch] = z.mcpMute;
  const Mm = txt("M", 9), Sm = txt("S", 9);
  out.mcp_mute_off = cellBtn(cw, ch, Mm);
  out.mcp_mute_on = cellBtn(cw, ch, Mm, { lit: X.mute, ink: X.ink });
  out.mcp_solo_off = cellBtn(cw, ch, Sm);
  out.mcp_solo_on = cellBtn(cw, ch, Sm, { lit: X.solo, ink: X.glyph });
  out.mcp_recarm_off = cellBtn(cw, ch, dot);
  out.mcp_recarm_on = cellBtn(cw, ch, dot, { lit: X.rec, ink: hex("#000000") });
  out.mcp_recarm_norec = cellBtn(cw, ch, dot, { lit: darken(X.rec, 0.35), ink: hex("#000000") });
  out.mcp_recarm_auto = cellBtn(cw, ch, ringDot, { ink: mixc(X.rec, X.glyph, 0.4) });
  out.mcp_recarm_auto_on = cellBtn(cw, ch, ringDot, { lit: X.rec, ink: hex("#000000") });
  out.mcp_recarm_auto_norec = cellBtn(cw, ch, ringDot, { lit: darken(X.rec, 0.35), ink: hex("#000000") });
  out.mcp_monitor_off = cellBtn(cw, ch, spk, { ink: hex("#7d8083") });
  out.mcp_monitor_on = cellBtn(cw, ch, spk);
  out.mcp_monitor_auto = cellBtn(cw, ch, spk, { lit: X.monitor, ink: X.ink });
  out.mcp_fx_norm = cellBtn(cw, ch, own("e", 10));
  out.mcp_fx_empty = cellBtn(cw, ch, own("e", 10));
  out.mcp_fx_dis = cellBtn(cw, ch, own("e", 10), { ink: hex("#7d8083") });
  out.mcp_fxbyp_off = cellBtn(cw, ch, insGlyph);
  out.mcp_fxbyp_on = cellBtn(cw, ch, insGlyph, { lit: X.bypass, ink: hex("#ffffff") });
  const [rw, rh] = ENV_MCP;
  out.mcp_env = rwPair(rw, rh, null, null, true);
  out.mcp_env_read = rwPair(rw, rh, X.read, null, true);
  out.mcp_env_touch = rwPair(rw, rh, X.read, X.write, true);
  out.mcp_env_latch = rwPair(rw, rh, X.read, X.write, true);
  out.mcp_env_write = rwPair(rw, rh, null, X.write, true);
  out.mcp_env_preview = rwPair(rw, rh, X.bypass, null, true);
  out.mcp_mono = cellBtn(cw, ch, (cx, cy) => circle(cx, cy, 3.5), { lit: X.bypass, ink: hex("#ffffff") });
  out.mcp_stereo = cellBtn(cw, ch, (cx, cy) => I.stereo(cx, cy, 10));
  out.mixer_menu = cellBtn(z.menu[0], z.menu[1], (cx, cy) => I.menu(cx, cy, 9));
  out.master_mcp_io = cellBtn(cw, ch, (cx, cy) => I.arrowOut(cx, cy, 10));

  // Faders, pan, scale marks.
  out.mcp_volbg = faderSlot(z.mcpThumb[0]);
  out.mcp_volthumb = faderCap(z.mcpThumb[0], z.mcpThumb[1]);
  out.mcp_master_volbg = out.mcp_volbg;
  out.mcp_master_volthumb = out.mcp_volthumb;
  out.mcp_panbg = flat(X.well, 0);
  out.mcp_panthumb = pic(3, 15, (cv) => cv.fill(rect(0.5, 1, 2, 9), solid(hex("#f4f4f4"))));
  out.tcp_volbg = (s) => {
    const cv = new Canvas(24, 10, s);
    cv.fill(rrect(0, 4, 24, 2, 1), solid(hex("#111214")));
    return withGuides(bitmap(cv), Math.round(3 * s), 0, Math.round(3 * s), 0);
  };
  out.tcp_volthumb = pic(10, 10, (cv) => cv.fill(circle(5, 5, 4.5), solid(hex("#f2f3f3"))));
  out.tcp_panbg = out.tcp_volbg;
  out.tcp_panthumb = out.tcp_volthumb;
  // Cubase's meter scale: "— 12 —", a short tick each side of the number.
  const markImg = (label: string) => pic(MARK[0], MARK[1], (cv, s) => {
    const px = 1 / s, y = Math.round((MARK[1] / 2 - px / 2) * s) / s;
    cv.fill(rect(1, y, 4, px), solid(X.scale, 0.75));
    cv.fill(rect(MARK[0] - 5, y, 4, px), solid(X.scale, 0.75));
    cv.fill(I.text(label, MARK[0] / 2, MARK[1] / 2, 6, 0.16, 0.1), solid(X.scale));
  });
  for (const [db, image] of MARKS) out[image] = markImg(String(Math.abs(db)));
  // The fader scale: a tick from the fader, the number right-aligned; 0 dB longer and brighter, "oo" at the bottom.
  const [fw, fh] = FMARK;
  const fmark = (label: string) => pic(fw, fh, (cv, s) => {
    const px = 1 / s, y = Math.round((fh / 2 - px / 2) * s) / s;
    const zero = label === "0";
    cv.fill(rect(0, y, label ? (zero ? 9 : 6) : 10, px), solid(zero ? hex("#d4d5d7") : X.scale, zero ? 1 : 0.75));
    if (label === "oo") {
      const ring1 = (cx: number) => ring(circle(cx, fh / 2, 1.9), 0.9);
      cv.fill(union(ring1(fw - 6.2), ring1(fw - 2.6)), solid(X.scale));
    } else if (label) cv.fill(I.text(label, fw - 1 - label.length * 2.1, fh / 2, 6, 0.16, 0.1), solid(zero ? hex("#d4d5d7") : X.scale));
  });
  for (const [image, label] of FADER_MARKS) out[image] ??= fmark(label);

  // Panels: the track list rows (a black line under each), the mixer channel, envelope lanes.
  out.tcp_bg = rowPanel(X.list, X.sep);
  out.tcp_bgsel = rowPanel(X.sel, X.sep);
  // REAPER picks these for normal and folder tracks when the theme has them.
  out.tcp_mainbg = out.tcp_bg;
  out.tcp_mainbgsel = out.tcp_bgsel;
  out.tcp_folderbg = out.tcp_bg;
  out.tcp_folderbgsel = out.tcp_bgsel;
  out.envcp_bg = rowPanel(hex("#2b2e32"), X.sep);
  out.envcp_bgsel = rowPanel(hex("#3a3d41"), X.sep);
  out.mcp_bg = rowPanel(X.strip, X.gap, "right");
  out.mcp_bgsel = rowPanel(X.stripSel, X.gap, "right");
  out.mcp_mainbg = out.mcp_bg;
  out.mcp_mainbgsel = out.mcp_bgsel;
  out.mcp_extmixbg = flat(hex("#181a1d"));
  // No state badges in the meters ("M", "IS"...); the mixer meter sits on its panel (no black bar when idle).
  for (const n of ["meter_mute", "meter_unsolo", "meter_solodim", "meter_automute", "meter_foldermute"]) out[n] = (s) => bitmap(new Canvas(16, 16, s));
  out.meter_bg_mcp = exact(6, 6, () => X.well);
  out.meter_bg_mcp_master = out.meter_bg_mcp;
  out.k_ticon = pic(TICON[0], TICON[1], (cv) => cv.fill(waveIcon(TICON[0] / 2, TICON[1] / 2), solid(hex("#f4f4f4"), 0.95)));
  out.k_well = box(X.well, X.wellEdge, 3);
  out.k_vbox = box(X.valueBox, hex("#17191c"), 2);
  out.k_vbox2 = box(X.valueBox2, null, 2);
  out.k_field = box(X.display, X.displayEdge, 2);
  out.tcp_recinput = box(X.display, hex("#5b5d60"), 2);
  out.mcp_recinput = out.tcp_recinput;

  // Transport: the bar, displays with their caps, the framed button group, the click.
  out.transport_bg = rowPanel(X.bar, hex("#0b0b0d"), "top");
  const note: G = (cx, cy) => union(circle(cx - 1.6, cy + 4, 2.7), rect(cx + 0.3, cy - 6.5, 1.5, 10.5));
  const tempoG: G = (cx, cy) => union(note(cx - 2, cy), capsule(cx + 3, cy - 4, cx + 6.5, cy - 4, 0.7), poly([[cx + 4.75, cy - 7], [cx + 7, cy - 5], [cx + 2.5, cy - 5]]), poly([[cx + 4.75, cy + 1], [cx + 7, cy - 1], [cx + 2.5, cy - 1]]));
  out.k_time = box(X.display, X.displayEdge, 2, { w: 24, c: X.display, glyph: note });
  out.k_tempo = box(X.display, X.displayEdge, 2, { w: 24, c: X.capLight, glyph: tempoG, ink: hex("#1a1b1f") });
  out.transport_status_bg = flat(X.display, 0);
  out.transport_status_bg_err = flat(X.rec, 0.25);
  out.transport_edit_bg = box(X.display, X.displayEdge, 2);
  out.transport_bpm_bg = flat(X.display, 0);
  out.transport_group_bg = flat(X.bar, 0);
  const cycleG: G = (cx, cy) => {
    const t = 1.7;
    const path: [number, number][] = [[cx - 3.5, cy - 4.5], [cx + 2, cy - 4.5]];
    for (let a = -90; a <= 90; a += 15) path.push([cx + 2 + 4.5 * Math.cos((a * Math.PI) / 180), cy + 4.5 * Math.sin((a * Math.PI) / 180)]);
    path.push([cx - 5, cy + 4.5]);
    return union(polyline(path, t / 2), poly([[cx - 8, cy - 4.5], [cx - 3.5, cy - 8.2], [cx - 3.5, cy - 0.8]]));
  };
  const stopG: G = (cx, cy) => ring(rect(cx - 5.5, cy - 5.5, 11, 11), 2);
  const playG: G = (cx, cy) => ring(rpoly([[cx - 5, cy - 7], [cx + 7, cy], [cx - 5, cy + 7]], 0.5), 1.7);
  const recG: G = (cx, cy) => ring(circle(cx, cy, 6.5), 1.7);
  const th = z.trans[1];
  out.transport_repeat_off = tBtn(51, th, "left", cycleG);
  out.transport_repeat_on = tBtn(51, th, "left", cycleG, X.cycle, hex("#0b0b0b"));
  // Stop shows lit (Cubase lights it while stopped); REAPER has no separate "stopped" image.
  out.transport_stop = tBtn(49, th, "mid", stopG, X.tLit, X.tLitInk);
  out.transport_play = tBtn(49, th, "mid", playG);
  out.transport_play_on = tBtn(49, th, "mid", playG, X.play, hex("#0b0b0b"));
  out.transport_play_sync = tBtn(49, th, "mid", playG, undefined, X.cycle);
  out.transport_play_sync_on = tBtn(49, th, "mid", playG, X.cycle, hex("#0b0b0b"));
  out.transport_pause = tBtn(49, th, "mid", (cx, cy) => I.pause(cx, cy, 13));
  out.transport_pause_on = tBtn(49, th, "mid", (cx, cy) => I.pause(cx, cy, 13), X.tLit, X.tLitInk);
  out.transport_record = tBtn(51, th, "right", recG);
  out.transport_record_on = tBtn(51, th, "right", (cx, cy) => circle(cx, cy, 6.5), X.rec, hex("#0b0b0b"));
  out.transport_record_item = out.transport_record;
  out.transport_record_item_on = out.transport_record_on;
  out.transport_record_loop = out.transport_record;
  out.transport_record_loop_on = out.transport_record_on;
  out.transport_home = tBtn(40, th, "both", (cx, cy) => I.skip(cx, cy, 12, -1));
  out.transport_end = tBtn(40, th, "both", (cx, cy) => I.skip(cx, cy, 12, 1));
  out.transport_previous = tBtn(40, th, "both", (cx, cy) => I.skip(cx, cy, 12, -1, false));
  out.transport_next = tBtn(40, th, "both", (cx, cy) => I.skip(cx, cy, 12, 1, false));
  out.k_click = plateBtn(30, 25, (cx, cy) => I.tb.metro!(cx, cy, 16), X.group, X.tGlyph);
  // Automation mode (REAPER's global override; not on Cubase's transport, kept for the global_* images).
  const genv: G = (cx, cy) => union(letter("R", cx - 6, cy, 9.5), letter("W", cx + 6, cy, 9.5));
  out.global_off = plateBtn(38, 25, genv, X.group, hex("#929395"));
  out.global_trim = plateBtn(38, 25, genv, X.group, X.tGlyph);
  (["read", "touch", "write", "latch", "preview"] as const).forEach((m, i) => (out[`global_${m}`] = plateBtn(38, 25, genv, c.env[i]!, X.ink)));
  out.global_bypass = plateBtn(38, 25, genv, X.group, X.rec);

  // Toolbar chrome (drawn under each toolbar icon): Cubase's grey group plate, lighter on hover, a light plate when on.
  out.toolbar_blank = scaled((s) => hstack(([0, 1, 2] as Frame[]).map((f) => {
    const cv = new Canvas(30, 30, s);
    const px = 1 / s;
    if (f === 2) cv.fill(rrect(1, 3, 28, 24, 3), solid(X.toolLit));
    else {
      cv.fill(rect(0, 3, 30, 24), solid(X.groupEdge));
      cv.fill(rect(0, 3 + px, 30, 24 - 2 * px), solid(f === 1 ? hex("#4d5053") : X.group));
    }
    return bitmap(cv);
  })));
  // A toggled-on button: REAPER draws this 12-frame "highlight" between the plate and the glyph
  // (a teal glow by default); here every frame is Cubase's light plate.
  out.animation_toolbar_highlight = (s) => {
    const cv = new Canvas(30, 30 * 12, s);
    for (let i = 0; i < 12; i++) cv.fill(rrect(1, i * 30 + 3, 28, 24, 3), solid(X.toolLit));
    return bitmap(cv);
  };

  // Events: Cubase's border, a dark outer ring and a light inner ring, both inside the event.
  out.item_bg = itemFrame(0.38, 0.5);
  // Selected events turn navy (REAPER draws the notes / peaks over this, as Cubase shows the contents).
  out.item_bg_sel = itemFrame(0.5, 0.8, [hex("#121327"), 1]);
  // No selection dot in the corner.
  out.item_seldot = (s) => bitmap(new Canvas(4, 4, s));

  out.midi_note_colormap = noteMap();
}

/**
 * REAPER's item overlay, laid out as Default 7's (17 x 31 at 100 % plus guides): pink guides mark the
 * unstretched edges, yellow ones the row above, the column right of and the two rows below the item,
 * which stay transparent here. Inside: a dark ring at the edge and a light ring within it.
 */
function itemFrame(dark: number, light: number, body?: [RGB, number]): Draw {
  return (s) => {
    const n = Math.max(1, Math.round(s));
    const cw = 17 * n, ch = 31 * n;
    const Wt = cw + 2, Ht = ch + 2;
    const data = new Uint8Array(Wt * Ht * 4);
    const put = (x: number, y: number, c: number[]) => data.set(c, (y * Wt + x) * 4);
    const PINK = [255, 0, 255, 255], YEL = [255, 255, 0, 255];
    const D = [0, 0, 0, Math.round(dark * 255)], L = [255, 255, 255, Math.round(light * 255)];
    const B = body ? [...body[0].map((v) => Math.round(v)), Math.round(body[1] * 255)] : null;
    // The item's own area in image pixels: x 1..cw-n, y n+1..ch-2n.
    const x0 = 1, x1 = cw - n, y0 = n + 1, y1 = ch - 2 * n;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const d = Math.min(x - x0, x1 - x, y - y0, y1 - y);
      if (d < n) put(x, y, D);
      else if (d < 2 * n) put(x, y, L);
      else if (B) put(x, y, B);
    }
    put(0, 0, YEL);
    for (let k = 1; k <= n; k++) put(0, k, YEL);
    for (let k = n + 1; k <= 5 * n; k++) put(0, k, PINK);
    for (let k = 1; k <= 4 * n; k++) put(k, 0, PINK);
    for (let k = ch - 4 * n + 1; k <= ch - 2 * n; k++) put(Wt - 1, k, PINK);
    for (let k = ch - 2 * n + 1; k <= ch; k++) put(Wt - 1, k, YEL);
    for (let k = cw - 2 * n + 1; k <= cw - n; k++) put(k, Ht - 1, PINK);
    for (let k = cw - n + 1; k <= cw; k++) put(k, Ht - 1, YEL);
    put(Wt - 1, Ht - 1, YEL);
    const b: Bitmap = { width: Wt, height: Ht, data };
    return b;
  };
}

const cubase: KitDef = {
  id: "cubase",
  palette,
  sizes: SIZES,
  mcpWidth: { track: 86, master: 86 },
  fonts: { label: 2, value: 1, list: 3, tempo: 4, sig: 4, status: 5 },
  faces: {
    slots: {
      1: { face: "Segoe UI", mac: "Helvetica Neue", px: 11 },
      2: { face: "Segoe UI", mac: "Helvetica Neue", px: 13, weight: 700 },
      3: { face: "Segoe UI", mac: "Helvetica Neue", px: 12, weight: 700 },
      4: { face: "Segoe UI", mac: "Helvetica Neue", px: 14 },
      5: { face: "Segoe UI", mac: "Helvetica Neue", px: 16 },
    },
    ruler: { face: "Segoe UI", mac: "Helvetica Neue", px: 12, weight: 700 },
    transport: { face: "Segoe UI", mac: "Helvetica Neue", px: 18 },
    // Event names a step smaller than the track names, as Cubase's are.
    items: { face: "Segoe UI", mac: "Helvetica Neue", px: 11, weight: 700 },
    volpan: { face: "Segoe UI", mac: "Helvetica Neue", px: 11 },
    title: { face: "Segoe UI", mac: "Helvetica Neue", px: 13, weight: 700 },
  },
  globals: {
    // Super-collapsed, one row, Cubase's two rows (46 px), armed (no growth when armed).
    tcp_heights: "4 23 46 46",
    tcp_master_minheight: "46",
    envcp_min_height: "23",
    // No track-colour tint on the track list rows (Cubase shows the colour in the block only).
    tinttcp: "296",
  },
  layout: { tcp, masterTcp, mcp, trans },
  images,
  toolbarGlyphs,
  // Cubase's toolbar: near-white glyphs; a lit button is a light plate with a black glyph.
  toolbarInk: { normal: "#e6e7e8", hover: "#ffffff", on: "#121212" },
};

export default cubase;
