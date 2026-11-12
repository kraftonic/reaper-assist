import type { SkinUi } from "../skins";
import { BLACK, exact, type Frame, scaled, WHITE } from "../kit/art";
import * as I from "../kit/icons";
import {
  arc, bitmap, Canvas, capsule, circle, darken, hex, hstack, intersect, lighten, mixc, outline, poly, polyline, rect, rpoly, rrect, solid, subtract, union, vgrad, vstack, withGuides,
  type RGB, type SDF,
} from "../kit/raster";
import type { Draw, Glyph, Kit, KitDef, KitSizes, MeterRange } from "../kit/types";
import { CENTER, extMixer, fg, fill, H, meterLook, rgb, type Script, TRACK_FILL, W } from "../kit/walter";

/**
 * Logic Pro 11 (dark appearance), drawn from scratch.
 *
 * Track headers: a number column filled with the track colour, the name on top, M|S and R|I as
 * two small segmented pills under it, a dark volume pill with a round thumb and a horseshoe pan
 * knob at the right. Channel strips: Input / Audio FX / Output / Automation slots, a horseshoe
 * pan knob, dB boxes, a silver fader cap beside a thin slot, the meter with its scale, M S and
 * the name plate in the track colour. Control bar: light grey, view buttons on plates at both
 * ends, the transport on a plate and the dark LCD (position, tempo, signature) in the centre.
 * No Apple artwork, glyphs or names: generic shapes and our own stroke lettering.
 */

/** Colours measured from Logic Pro 11's own screenshots (Apple's user guide), at 100 %. */
const X = {
  header: hex("#575757"),
  headerSel: hex("#737373"),
  headerLine: hex("#474747"),
  headerSelLine: hex("#5b5b5b"),
  /** The 2 px line between track headers. */
  divider: hex("#4d4d4d"),
  /** The software-instrument green Logic gives new tracks: our colour for tracks without one. */
  green: hex("#1aa331"),
  /** Stereo Out's name plate. */
  out: hex("#a41a88"),
  well: hex("#383838"),
  thumb: hex("#878787"),
  disc: hex("#868686"),
  pointer: hex("#262626"),
  panArc: hex("#38c84e"),
  segInk: hex("#f2f2f2"),
  mute: hex("#268692"),
  solo: hex("#b78d2b"),
  arm: hex("#c94840"),
  armInk: hex("#ff5047"),
  input: hex("#e07d1f"),
  slot: hex("#266eb7"),
  slotGrey: hex("#666666"),
  slotEdge: hex("#494949"),
  slotWell: hex("#505050"),
  read: hex("#67d078"),
  slotText: hex("#e2e2e2"),
  cap: hex("#b0b2b3"),
  slit: hex("#404040"),
  meterBg: hex("#393939"),
  /** The header meter: Logic's green, a little yellower at the top end, red when clipping. */
  meterLo: hex("#4bd965"),
  meterHi: hex("#8fd94a"),
  meterClip: hex("#ff3b30"),
  meterTop: hex("#e3c93c"),
  scale: hex("#a8a8a8"),
  stripLine: hex("#414141"),
  // Control bar.
  bar: hex("#a6a6a6"),
  barLine: hex("#8e8e8e"),
  plate: hex("#9c9c9c"),
  ink: hex("#4c4c4c"),
  rec: hex("#c83129"),
  playLit: hex("#20892f"),
  cycleLit: hex("#e7b739"),
  purple: hex("#7e31a6"),
  viewOn: hex("#1f63d6"),
  /** Tracks-area menu bar and a lit toolbar button's plate. */
  menuBar: hex("#474747"),
  toolOn: hex("#1d5289"),
  lcd: hex("#24262e"),
  lcdEdge: hex("#16171c"),
  lcdText: hex("#c7d9ea"),
  lcdCap: hex("#566679"),
  lcdLine: hex("#3a3e4a"),
};

function palette(ui: SkinUi): Kit {
  const u = (k: keyof SkinUi) => hex(ui[k]);
  return {
    id: "logic",
    look: "flat",
    radius: 3,
    c: {
      bg: u("bg"),
      panel: u("panel"),
      track: X.header,
      trackSel: X.headerSel,
      face: hex("#666666"),
      line: X.headerLine,
      deep: u("border"),
      text: u("text"),
      dim: u("textDim"),
      accent: u("accent"),
      accent2: u("accent2"),
      solo: X.solo,
      arm: X.arm,
      play: X.playLit,
      onInk: hex("#1e1e1e"),
      env: [X.read, hex("#e8c547"), hex("#ff5a4e"), hex("#c38bf2"), hex("#8fb4e8")],
      display: X.lcd,
      displayText: X.lcdText,
      knob: X.panArc,
      meter: { off: X.meterBg, low: hex("#2ccf45"), mid: hex("#dcd52c"), high: hex("#ec9124"), clip: hex("#ff3b30") },
    },
  };
}

const SIZES: KitSizes = {
  tcpMute: [17, 15], tcpBtn: [17, 15], tcpSmall: [16, 16], tcpFx: [22, 14], tcpKnob: 21, tcpThumb: [14, 16],
  mcpMute: [22, 14], mcpBtn: [22, 14], mcpArm: [14, 14], mcpMon: [14, 14], mcpSmall: [50, 14], mcpKnob: 32, mcpThumb: [16, 30], mcpFaderW: 16,
  envBtn: [18, 14], envKnob: 18, trans: [32, 26], tap: [36, 26], menu: [22, 14], toolbar: 30,
};
/** Logic's channel strips are 58 px wide. */
const MCP_W = { track: 58, master: 58 };
/** Font slot of the strips' dB readouts. */
const DB_FONT = 5;
/** Control bar height. */
const TH = 50;
/** Track-number column (Logic: 17 px in the track colour, then a darker edge and a dark line). */
const NUM = 17;
/** Compact rows: content starts after the number column. */
const L = NUM + 8;
/** Logic's 44 px header: the track icon, then the name (row 1) and M|S R|I (row 2) from x 103. */
const ICON = { x: 52, y: 11, w: 32, h: 22 };
const BX = 103;

// ---------------------------------------------------------------- track header

/** Hidden when supercollapsed (< 16), one centred row below 40 (Logic's compact rows), two rows from 40. */
const rows = (w: Script, one: string, two: string) => `h<${w.n(16)} [0] h<${w.n(40)} ${one} ${two}`;
/** A rect on the single, vertically centred row. */
const mid = (w: Script, x: number | ReturnType<typeof W>, wd: number | ReturnType<typeof W>, ht: number) => w.p(x, H(-ht / 2, 0.5), wd, ht);

/**
 * Logic's header at its default 44 px: number column | name (row 1) / M|S R|I (row 2) … volume
 * pill and pan knob at the right, level with the buttons. Compact rows: M|S R|I, then the name.
 */
function trackHeader(k: Kit, w: Script, X0: "tcp" | "master.tcp") {
  const master = X0 === "master.tcp";
  // Number column in the track colour; its darker edge and bottom line; the number in white.
  w.custom(`${X0}.custom.kNumEdge`, "k_numedge");
  w.set(`${X0}.custom.kNumEdge`, w.p(0, 0, NUM + 2, H()));
  w.custom(`${X0}.custom.kNum`);
  w.set(`${X0}.custom.kNum`, w.p(0, 0, NUM + 1, H()));
  w.set(`${X0}.custom.kNum.color`, master ? fill(X.out) : `?trackcolor_valid ${TRACK_FILL} ${fill(X.green)}`);
  w.raw(`front ${X0}.custom.kNumEdge`);
  if (!master) {
    // Wider than tall, so REAPER writes it across (a tall box turns the text).
    w.set("tcp.trackidx", `h<${w.n(16)} [0] ${w.p(0, H(-8, 0.5), NUM, 16)}`);
    w.set("tcp.trackidx.color", fg(WHITE));
    w.set("tcp.trackidx.font", w.font("label"));
    w.set("tcp.trackidx.margin", CENTER);
    w.raw("front tcp.trackidx");
    // The track icon: a keyboard in the track colour (a colour box under a header-grey stencil), on 44 px rows.
    const icon = rows(w, "[0]", w.p(ICON.x, ICON.y, ICON.w, ICON.h));
    w.custom("tcp.custom.kIconM", "k_icon");
    w.set("tcp.custom.kIconM", `?track_selected [0] ${icon}`);
    w.custom("tcp.custom.kIconS", "k_icon_sel");
    w.set("tcp.custom.kIconS", `!track_selected [0] ${icon}`);
    w.custom("tcp.custom.kIcon");
    w.set("tcp.custom.kIcon", icon);
    w.set("tcp.custom.kIcon.color", `?trackcolor_valid ${TRACK_FILL} ${fill(X.green)}`);
    w.raw("front tcp.custom.kIconM");
    w.raw("front tcp.custom.kIconS");
  }
  // M|S and R|I pills (master: M|S): under the name at x 103, or first on compact rows.
  const [bw, bh] = SIZES.tcpBtn;
  const btns: [string, number][] = master ? [["mute", 0], ["solo", bw + 1]] : [["mute", 0], ["solo", bw + 1], ["recarm", 2 * bw + 7], ["recmon", 3 * bw + 8]];
  for (const [b, dx] of btns) w.set(`${X0}.${b}`, rows(w, mid(w, L + dx, bw, bh), w.p(BX + dx, 23, bw, bh)));
  const span = master ? 2 * bw + 1 : 4 * bw + 8;
  const nameX = L + span + 10;
  const name2 = w.p(BX - 3, 1, W(-BX - 10), 18);
  if (!master) {
    // Track Stacks: a disclosure chevron left of the icon (compact rows: before the name).
    w.set("tcp.foldercomp", `folderstate==1 ${rows(w, mid(w, nameX, 14, 16), w.p(30, 14, 14, 16))} [0]`);
    w.set("tcp.label", `folderstate==1 ${rows(w, mid(w, nameX + 14, W(-nameX - 14 - 158), 18), name2)} ${rows(w, mid(w, nameX, W(-nameX - 158), 18), name2)}`);
  } else w.set("master.tcp.label", rows(w, mid(w, nameX, W(-nameX - 158), 18), name2));
  w.set(`${X0}.label.font`, w.font("label"));
  w.set(`${X0}.label.margin`, `[${w.n(2)} 0 0 0 0]`);
  w.set(`${X0}.label.color`, fg(hex("#f2f2f2")));
  // Volume pill and the pan knob, level with the buttons. The level meter sits inside the pill on
  // armed tracks (as Logic's recording tracks show it); REAPER paints a meter over the thumb, so
  // other tracks show the pill and thumb alone.
  const vx = W(-149), vw = 112, vh = SIZES.tcpThumb[1];
  const meter = rows(w, w.p(W(-144), H(-3, 0.5), 102, 7), w.p(W(-144), 27, 102, 7));
  w.set(`${X0}.meter`, master ? meter : `?recarm ${meter} [0]`);
  meterLook(w, `${X0}.meter`, k, { scale: false, readout: false });
  w.set(`${X0}.meter.vu.div`, "[1]");
  w.set(`${X0}.volume`, rows(w, mid(w, vx, vw, vh), w.p(vx, 22, vw, vh)));
  w.set(`${X0}.volume.fadermode`, "[-1]");
  w.raw(`front ${X0}.volume`);
  const kz = SIZES.tcpKnob;
  w.set(`${X0}.pan`, rows(w, mid(w, W(-31), kz, kz), w.p(W(-31), 18, kz, kz)));
  w.set(`${X0}.pan.fadermode`, "[1]");
}

function tcp(k: Kit, w: Script) {
  trackHeader(k, w, "tcp");
  // Plug-in parameters (REAPER) on very tall tracks.
  w.set("tcp.fxparm", `h<${w.n(100)} [0] ${w.p(L - 2, 46, W(-L - 8), H(-50))}`);
}

function masterTcp(k: Kit, w: Script) {
  trackHeader(k, w, "master.tcp");
}

// ---------------------------------------------------------------- channel strip

/** Meter scale marks (dB below 0, as Logic labels them), with the image each uses. */
const METER_MARKS: [number, string][] = [[0, "k_ms_0"], [-6, "k_ms_6"], [-12, "k_ms_12"], [-18, "k_ms_18"], [-24, "k_ms_24"], [-30, "k_ms_30"], [-40, "k_ms_40"], [-50, "k_ms_50"], [-60, "k_ms_60"]];
const MS_W = 12, MS_H = 9;

/**
 * Logic's channel strip, top to bottom: Input slot, Audio FX and send slots (extended mixer),
 * Output and Automation slots, the pan knob, two dB boxes, fader + meter scale + meter,
 * R I, M S, and the name plate in the track colour.
 */
function mcp(k: Kit, w: Script, { master, range }: { master: boolean; range: MeterRange }) {
  const z = SIZES, c = k.c;
  const X0 = master ? "master.mcp" : "mcp";
  const S = master ? MCP_W.master : MCP_W.track;
  const slotW = S - 8;
  if (!master) {
    w.set("mcp.recinput", w.p(4, 5, slotW, 14));
    w.set("mcp.recinput.color", fg(X.slotText));
    w.set("mcp.recinput.font", w.font("list"));
    w.set("mcp.recinput.margin", `[${w.n(3)} 0 ${w.n(3)} 0 0.5]`);
  }
  extMixer(w, X0, 22);
  w.set(`${X0}.io`, `+ kE ${w.at(4, 26, [slotW, 14])}`);
  w.set(`${X0}.env`, `+ kE ${w.at(4, 44, [slotW, 14])}`);
  if (!master) {
    // The track icon under the Automation slot, as Logic's strips show it (the header's stencil).
    const icon = `+ kE ${w.p((S - ICON.w) / 2, 62, ICON.w, ICON.h)}`;
    w.custom("mcp.custom.kIconM", "k_icon");
    w.set("mcp.custom.kIconM", `?track_selected [0] ${icon}`);
    w.custom("mcp.custom.kIconS", "k_icon_sel");
    w.set("mcp.custom.kIconS", `!track_selected [0] ${icon}`);
    w.custom("mcp.custom.kIcon");
    w.set("mcp.custom.kIcon", icon);
    w.set("mcp.custom.kIcon.color", `?trackcolor_valid ${TRACK_FILL} ${fill(X.green)}`);
    w.raw("front mcp.custom.kIconM");
    w.raw("front mcp.custom.kIconS");
  }
  const kz = z.mcpKnob;
  w.set(`${X0}.pan`, `+ kE ${w.p((S - kz) / 2, 88, kz, kz)}`);
  // dB boxes: volume (REAPER's "0.00dB" in a 9 px face so it fits), and an empty peak box beside it.
  w.custom(`${X0}.custom.kDb`, "k_dbbox");
  w.set(`${X0}.custom.kDb`, `+ kE ${w.p(3, 126, 34, 15)}`);
  w.custom(`${X0}.custom.kPk`, "k_dbbox");
  w.set(`${X0}.custom.kPk`, `+ kE ${w.p(39, 126, 16, 15)}`);
  w.set(`${X0}.volume.label`, `+ kE ${w.p(3, 126, 34, 15)}`);
  w.set(`${X0}.volume.label.color`, fg(X.slotText));
  w.set(`${X0}.volume.label.font`, w.font(DB_FONT));
  w.set(`${X0}.volume.label.margin`, `[${w.n(2)} 0 0 0 0]`);
  // Fader | meter scale | meter, over the same height.
  const top = 150, bot = 64;
  const [tw, th] = z.mcpThumb;
  w.set(`${X0}.volume`, `+ kE2 ${w.p(7, top - th / 2, tw, H(-(top + bot) + th))}`);
  w.set(`${X0}.meter`, `+ kE2 ${w.p(41, top, 9, H(-(top + bot)))}`);
  meterLook(w, `${X0}.meter`, k, { scale: false, readout: false });
  w.set(`${X0}.meter.vu.div`, "[1]");
  const span = range.max - range.min;
  METER_MARKS.forEach(([db, image], i) => {
    if (db > range.max || db < range.min) return;
    const f = (range.max - db) / span;
    const name = `${X0}.custom.kMs${i}`;
    w.custom(name, image);
    w.set(name, `+ * ${+(1 - f).toFixed(4)} kE ${w.p(28, H(top - f * (top + bot) - MS_H / 2, +f.toFixed(4)), MS_W, MS_H)}`);
  });
  // R I above M S (the master: M and the mixer menu).
  if (!master) {
    w.set("mcp.recarm", w.at(24, H(-58), z.mcpArm));
    w.set("mcp.recmon", w.at(39, H(-58), z.mcpMon));
    w.set("mcp.solo", w.at(31, H(-41), z.mcpBtn));
  } else w.set("master.mcp.menubutton", w.at(31, H(-41), z.menu));
  w.set(`${X0}.mute`, w.at(5, H(-41), z.mcpMute));
  // Name plate in the track colour.
  w.custom(`${X0}.custom.kName`);
  w.set(`${X0}.custom.kName`, w.p(0, H(-22), W(), 22));
  w.set(`${X0}.custom.kName.color`, master ? fill(X.out) : `?trackcolor_valid ${TRACK_FILL} ${fill(X.green)}`);
  w.set(`${X0}.label`, `${X0}.custom.kName`);
  w.set(`${X0}.label.margin`, `[${w.n(3)} 0 ${w.n(3)} 0 0.5]`);
  w.set(`${X0}.label.font`, w.font("value"));
  w.set(`${X0}.label.color`, fg(hex("#f4f4f4")));
  // REAPER's own track number is hidden (Logic's strips show none).
  if (!master) w.set("mcp.trackidx", "[0]");
  w.set(`${X0}.volume.label.color`, fg(c.text));
}

// ---------------------------------------------------------------- control bar

/** A control-bar plate with buttons on it: [x, buttons…]. */
type Btn = { name: string; action: number | string; tip: string; image: string };
const VIEW_L1: Btn[] = [
  { name: "kLib", action: 40271, tip: "Library", image: "k_v_library" },
  { name: "kInsp", action: "_RS_assist_logic_inspector", tip: "Inspector", image: "k_v_inspector" },
  { name: "kTbar", action: 41084, tip: "Toolbar", image: "k_v_toolbar" },
];
const VIEW_L2: Btn[] = [
  { name: "kMix", action: 40078, tip: "Mixer", image: "k_v_mixer" },
  { name: "kEdit", action: "_RS_assist_logic_editor", tip: "Editors", image: "k_v_editors" },
];
const VIEW_R: Btn[] = [
  { name: "kList", action: 40326, tip: "List Editors", image: "k_v_lists" },
  { name: "kBrow", action: 50124, tip: "Browsers", image: "k_v_browsers" },
];
const VB = 28; // view button width
/** Logic's LCD: 230 x 42, dividers after the position, the tempo and the signature. */
const LCD_W = 230, LCD_H = 42;
const LCD_DIV = [103, 160, 216];
/**
 * The position field (trans.status) covers only the position column, above the BAR / BEAT
 * captions: REAPER paints it last, over anything it overlaps. REAPER sizes the digits to the
 * element's text box, so negative margins grow the box (357 x 58 gives Logic's 18 px digits;
 * 337 x 55 gave 17 px) while the element itself stays inside the column.
 */
const STATUS = { x: 3, y: 3, w: 97, h: 29, margin: [6, -15, -266, -14] } as const;

/**
 * Logic's control bar: view-button plates at both ends; in the centre the transport plate
 * (stop, play, record, capture, cycle), the LCD (bar/beat position, tempo, signature) and
 * count-in / metronome. Rewind, forward and pause stay hidden as in Logic's default bar.
 */
function trans(k: Kit, w: Script) {
  w.set("trans.size", `[${w.n(1000)} ${w.n(TH)}]`);
  w.set("trans.size.minmax", `[${w.n(300)} ${w.n(TH)} ${w.n(4000)} ${w.n(144)}]`);
  w.set("trans.size.dockedheight", `[${w.n(TH)}]`);
  const py = 12, ph = 26;
  const front: string[] = [];
  const plate = (name: string, x: number | ReturnType<typeof W>, wd: number) => {
    w.custom(`trans.custom.${name}`, "k_plate");
    w.set(`trans.custom.${name}`, w.p(x, py, wd, ph));
  };
  const button = (b: Btn, rect: string) => {
    const act = typeof b.action === "number" ? String(b.action) : b.action;
    w.raw(`custom trans.custom.${b.name} '' ${act} '${b.tip}' '${b.image}'`);
    w.set(`trans.custom.${b.name}`, rect);
    front.push(`trans.custom.${b.name}`);
  };
  const buttons = (list: Btn[], x0: number | ((i: number) => ReturnType<typeof W>)) =>
    list.forEach((b, i) => button(b, w.p(typeof x0 === "number" ? x0 + i * VB : x0(i), py, VB, ph)));
  // View buttons, left and right.
  plate("kPlL1", 12, VIEW_L1.length * VB + 8);
  buttons(VIEW_L1, 16);
  const l2 = 12 + VIEW_L1.length * VB + 8 + 14;
  plate("kPlL2", l2, VIEW_L2.length * VB + 8);
  buttons(VIEW_L2, l2 + 4);
  const rw = VIEW_R.length * VB + 8;
  plate("kPlR", W(-12 - rw), rw);
  buttons(VIEW_R, (i) => W(-12 - rw + 4 + i * VB));
  // Transport plate, just left of the LCD: stop, play, record, capture, cycle.
  const cx = (dx: number) => W(dx, 0.5);
  const [bw, bh] = SIZES.trans;
  const lx = -LCD_W / 2;
  const tx = lx - 9 - (5 * bw + 8);
  plate("kPlT", cx(tx), 5 * bw + 8);
  const order: [string, number][] = [["trans.stop", 0], ["trans.play", 1], ["trans.rec", 2], ["trans.repeat", 4]];
  for (const [name, i] of order) w.set(name, w.p(cx(tx + 4 + i * bw), py, bw, bh));
  button({ name: "kCap", action: 40211, tip: "Capture as Recording", image: "k_capture" }, w.p(cx(tx + 4 + 3 * bw), py, bw, bh));
  // The LCD: one image with its dividers and captions; REAPER's fields on top.
  w.custom("trans.custom.kLcd", "k_lcd");
  const ly = (TH - LCD_H) / 2;
  w.set("trans.custom.kLcd", w.p(cx(lx), ly, LCD_W, LCD_H));
  // The position: REAPER repaints the bar under its element, then transport_status_bg (the
  // LCD's colour), then the digits, left-aligned on Logic's digit line.
  w.set("trans.status", w.p(cx(lx + STATUS.x), ly + STATUS.y, STATUS.w, STATUS.h));
  w.set("trans.status.margin", `[${STATUS.margin.map((v) => w.n(v)).join(" ")} 0]`);
  w.set("trans.status.color", fg(X.lcdText));
  const field = (el: string, x0: number, x1: number) => {
    w.set(el, w.p(cx(lx + x0 + 2), ly + 3, x1 - x0 - 4, 18));
    w.set(`${el}.font`, w.font("tempo"));
    w.set(`${el}.color`, fg(X.lcdText));
    w.set(`${el}.margin`, CENTER);
  };
  field("trans.bpm.edit", LCD_DIV[0]!, LCD_DIV[1]!);
  field("trans.curtimesig", LCD_DIV[1]!, LCD_DIV[2]!);
  // Count-in and metronome right of the LCD.
  const rx = -lx + 12;
  button({ name: "kCount", action: "_RS_assist_logic_count_in", tip: "Count-in", image: "k_countin" }, w.p(cx(rx), py, bw, bh));
  button({ name: "kClick", action: 40364, tip: "Metronome", image: "k_click" }, w.p(cx(rx + bw + 4), py, bw, bh));
  w.set("trans.sel", "[0]");
  // Plates are drawn over later customs unless the buttons come to the front.
  for (const el of front) w.raw(`front ${el}`);
}

// ---------------------------------------------------------------- lettering

const D = Math.PI / 180;
/** The scale's minimum stroke radius (icons.atScale), read back through textWidth. */
const minR = () => I.textWidth("II", 1, 0, 0) - 0.2;
const st = (r: number) => Math.max(r, minR());

type Pts = [number, number][];
/** Points along an ellipse arc in a unit box: degrees, 0 = up, clockwise. */
function arcPts(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number): Pts {
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / 12));
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = (a0 + ((a1 - a0) * i) / n) * D;
    return [cx + Math.sin(a) * rx, cy - Math.cos(a) * ry] as [number, number];
  });
}

/** Capitals icons.ts doesn't draw, in the same stroke style (unit box, polylines). */
const GLY: Record<string, { w: number; lines: Pts[] }> = {
  B: { w: 0.56, lines: [[[0, 1], [0, 0], [0.5, 0], ...arcPts(0.5, 0.24, 0.42, 0.24, 0, 180).slice(1), [0, 0.48]], [[0.5, 0.48], ...arcPts(0.52, 0.74, 0.48, 0.26, 0, 180).slice(1), [0, 1]]] },
  C: { w: 0.62, lines: [arcPts(0.52, 0.5, 0.52, 0.5, 48, -228)] },
  D: { w: 0.6, lines: [[[0, 0], [0.4, 0], ...arcPts(0.4, 0.5, 0.6, 0.5, 0, 180).slice(1), [0, 1], [0, 0]]] },
  E: { w: 0.5, lines: [[[1, 0], [0, 0], [0, 1], [1, 1]], [[0, 0.5], [0.84, 0.5]]] },
  G: { w: 0.64, lines: [[...arcPts(0.5, 0.5, 0.5, 0.5, 48, -222), [1, 0.58], [0.58, 0.58]]] },
  H: { w: 0.6, lines: [[[0, 0], [0, 1]], [[1, 0], [1, 1]], [[0, 0.5], [1, 0.5]]] },
  K: { w: 0.58, lines: [[[0, 0], [0, 1]], [[1, 0], [0, 0.64]], [[0.36, 0.4], [1, 1]]] },
  R: { w: 0.58, lines: [[[0, 1], [0, 0], [0.52, 0], ...arcPts(0.52, 0.26, 0.48, 0.26, 0, 180).slice(1), [0, 0.52]], [[0.48, 0.52], [1, 1]]] },
  V: { w: 0.62, lines: [[[0, 0], [0.5, 1], [1, 0]]] },
  W: { w: 0.9, lines: [[[0, 0], [0.24, 1], [0.5, 0.28], [0.76, 1], [1, 0]]] },
  Y: { w: 0.6, lines: [[[0, 0], [0.5, 0.52], [1, 0]], [[0.5, 0.52], [0.5, 1]]] },
};
const SPACE = 0.34;

function letterWidths(str: string, u: number, weight: number, spacing: number) {
  const r = st((u * weight) / 2);
  const ws = [...str].map((ch) => (ch === " " ? SPACE * u : GLY[ch] ? GLY[ch]!.w * u : I.textWidth(ch, u, weight, spacing)));
  const gap = u * spacing + r;
  return { r, ws, gap, total: ws.reduce((a, b) => a + b, 0) + gap * Math.max(0, ws.length - 1) };
}

/** A capital-letter word centred on (cx, cy), u = cap height. */
function word(str: string, cx: number, cy: number, u: number, weight = 0.17, spacing = 0.16): SDF {
  const { r, ws, gap, total } = letterWidths(str, u, weight, spacing);
  let x = cx - total / 2;
  const parts: SDF[] = [];
  [...str].forEach((ch, i) => {
    const wd = ws[i]!, g = GLY[ch];
    if (g) for (const l of g.lines) parts.push(polyline(l.map(([a, b]) => [x + r + a * (wd - 2 * r), cy - u / 2 + r + b * (u - 2 * r)] as [number, number]), r));
    else if (ch !== " ") parts.push(I.text(ch, x + wd / 2, cy, u, weight, spacing));
    x += wd + gap;
  });
  return parts.length ? union(...parts) : () => 1e9;
}

// ---------------------------------------------------------------- track header art

/**
 * One half of Logic's M|S or R|I pill: rounded on its outer side, square on the inner side with
 * a one-pixel gap. Unlit faces are a light veil over the header, so they lighten with the
 * selected track's header as Logic's do.
 */
function seg(w: number, h: number, side: "l" | "r", ch: string, lit: RGB | null, ink: RGB): Draw {
  return scaled((s) => hstack(([0, 1, 2] as Frame[]).map((f) => {
    // A 14 px body with a one-pixel shadow line under it (the image's last row).
    const cv = new Canvas(w, h, s), px = 1 / s, r = 3, bh = h - 1;
    const shape = (y: number, hh: number) => (side === "l" ? union(rrect(0, y, w, hh, r), rect(r, y, w - r, hh)) : union(rrect(0, y, w, hh, r), rect(0, y, w - r, hh)));
    const body = shape(0, bh);
    cv.fill(intersect(shape(1, bh), rect(0, bh, w, px)), solid(BLACK, 0.18));
    if (lit) cv.fill(body, solid(f === 1 ? lighten(lit, 0.08) : f === 2 ? darken(lit, 0.12) : lit));
    else cv.fill(body, solid(WHITE, f === 1 ? 0.16 : f === 2 ? 0.04 : 0.09));
    cv.fill(intersect(body, rect(0, 0, w, px)), solid(WHITE, lit ? 0.12 : 0.05));
    cv.fill(intersect(body, rect(0, bh - px, w, px)), solid(BLACK, 0.06));
    cv.fill(word(ch, w / 2, bh / 2 - 0.5 + (f === 2 ? 0.5 : 0), 8, 0.19), solid(ink));
    return bitmap(cv);
  })));
}

/** A free-standing rounded button (mixer M S, R I). */
function pill(w: number, h: number, ch: string, lit: RGB | null, ink: RGB, u = 7): Draw {
  return scaled((s) => hstack(([0, 1, 2] as Frame[]).map((f) => {
    const cv = new Canvas(w, h, s), px = 1 / s;
    const body = rrect(0, 0, w, h, 3);
    const face = lit ?? hex("#666666");
    cv.fill(body, solid(f === 1 ? lighten(face, 0.07) : f === 2 ? darken(face, 0.1) : face));
    if (!lit) cv.fill(rect(2, h - px, w - 4, px), solid(BLACK, 0.18));
    cv.fill(word(ch, w / 2, h / 2 + (f === 2 ? 0.5 : 0), u, 0.22), solid(ink));
    return bitmap(cv);
  })));
}

/** Logic's pan knob: a dark horseshoe ring, a grey disc with a dark pointer, a green arc from the centre to the value. */
function panKnob(size: number, ringW: number, discD: number, frames = 49): Draw {
  return scaled((s) => vstack(Array.from({ length: frames }, (_, i) => {
    const a = (-135 + 270 * (i / (frames - 1))) * D;
    const cv = new Canvas(size, size, s), c = size / 2;
    const rc = size / 2 - 0.5 - ringW / 2;
    cv.fill(arc(c, c, rc, -140 * D, 140 * D, ringW / 2), solid(X.well));
    const t = Math.max(ringW * 0.32, 0.6 / s);
    if (Math.abs(a) > 0.02) cv.fill(arc(c, c, rc, Math.min(0, a), Math.max(0, a), t), solid(X.panArc));
    cv.fill(arc(c, c, rc, a - 0.12, a + 0.12, t), solid(X.panArc));
    const dr = discD / 2;
    cv.fill(circle(c, c + 0.5, dr), solid(BLACK, 0.3));
    cv.fill(circle(c, c, dr), vgrad(c - dr, c + dr, [[0, lighten(X.disc, 0.06)], [1, darken(X.disc, 0.05)]]));
    const p0 = dr - Math.max(1.2, dr * 0.12), p1 = dr * 0.55;
    cv.fill(capsule(c + Math.sin(a) * p0, c - Math.cos(a) * p0, c + Math.sin(a) * p1, c - Math.cos(a) * p1, Math.max(0.6, 0.7 / s)), solid(X.pointer));
    return bitmap(cv);
  })));
}

/** The header's dark volume pill (stretches between its round ends). */
const volPill = (h: number): Draw => (s) => {
  const w = 40, cv = new Canvas(w, h, s);
  cv.fill(rrect(0, 0, w, h, h / 2), solid(X.well));
  const g = Math.round(9 * s);
  return withGuides(bitmap(cv), g, 0, g, 0);
};

/** The header's round, slightly translucent volume thumb. */
const volThumb = (w: number, h: number): Draw => (s) => {
  const cv = new Canvas(w, h, s), r = Math.min(w, h) / 2 - 0.6;
  cv.fill(circle(w / 2, h / 2, r), vgrad(h / 2 - r, h / 2 + r, [[0, lighten(X.thumb, 0.08)], [1, darken(X.thumb, 0.04)]], 0.94));
  return bitmap(cv);
};

/**
 * Over the number column (NUM + 1 px of track colour): its last column a third darker, then a
 * faint dark line on the header, and the 2 px track divider darkened in the column (stretchable).
 */
const numEdge: Draw = (s) => {
  const w = NUM + 2, h = 12, cv = new Canvas(w, h, s);
  cv.fill(rect(NUM, 0, 1, h - 2), solid(BLACK, 0.34));
  cv.fill(rect(NUM + 1, 0, 1, h - 2), solid(BLACK, 0.06));
  cv.fill(rect(0, h - 2, NUM + 1, 2), solid(BLACK, 0.33));
  cv.fill(rect(NUM, h - 2, 1, 2), solid(BLACK, 0.2));
  cv.fill(rect(NUM + 1, h - 2, 1, 2), solid(BLACK, 0.05));
  return withGuides(bitmap(cv), 1, 1, Math.round(2 * s), Math.round(2 * s));
};

/** Header background: flat grey with Logic's 2 px divider at the bottom (stretchable). */
const headerBg = (face: RGB): Draw => (s) => {
  const w = 24, h = 24, cv = new Canvas(w, h, s);
  cv.fill(rect(0, 0, w, h), solid(face));
  cv.fill(rect(0, h - 2, w, 2), solid(X.divider));
  return withGuides(bitmap(cv), 2, 2, 2, Math.round(3 * s));
};

/**
 * The track icon's stencil: the header grey everywhere but a keyboard's outline, so the track
 * colour (a box under it) shows through as the icon; keys, panel and its knobs are dark ink.
 */
const iconMask = (face: RGB): Draw => scaled((s) => {
  const { w, h } = ICON, cv = new Canvas(w, h, s);
  const panel = union(rrect(1, 3, w - 2, h - 3, 1.5), rrect(11, 0.5, 10, 4, 1));
  cv.fill(subtract(rect(0, 0, w, h), panel), solid(face));
  cv.fill(panel, solid(WHITE, 0.18));
  const ink = solid(BLACK, 0.55), thin = Math.max(0.6, 1 / s);
  // Panel: a small screen, knobs and a slider.
  cv.fill(rrect(4, 5.5, 5, 2.5, 0.5), ink);
  for (const x of [12.5, 15.5, 18.5]) cv.fill(circle(x, 6.75, 0.95), ink);
  cv.fill(rrect(22, 5.5, 6, 2.5, 0.5), ink);
  cv.fill(rect(2, 10, w - 4, thin), ink);
  // Keys: ten white keys with black keys between them.
  const kx = 2, kw = (w - 4) / 10;
  for (let i = 1; i < 10; i++) cv.fill(rect(kx + i * kw - thin / 2, 10, thin, h - 11.5), solid(BLACK, 0.2));
  for (const i of [1, 2, 4, 5, 6, 8, 9]) cv.fill(rect(kx + i * kw - 0.9, 10, 1.8, 5), solid(BLACK, 0.6));
  return bitmap(cv);
});

/** A chevron for Track Stacks (no button face). */
const disclosure = (dir: "right" | "down", ink: RGB): Draw => scaled((s) => hstack(([0, 1, 2] as Frame[]).map((f) => {
  const w = 14, h = 16, cv = new Canvas(w, h, s), c = w / 2, m = h / 2;
  const pts: Pts = dir === "right" ? [[c - 1.6, m - 3.6], [c + 2, m], [c - 1.6, m + 3.6]] : [[c - 3.6, m - 1.6], [c, m + 2], [c + 3.6, m - 1.6]];
  cv.fill(polyline(pts, st(0.75)), solid(f === 1 ? WHITE : ink));
  return bitmap(cv);
})));

// ---------------------------------------------------------------- channel strip art

/** A rounded slot (inserts, sends, input), stretchable; REAPER writes the name on it. */
const slot = (fillc: RGB, a = 1, edge = true): Draw => (s) => {
  const w = 24, h = 16, px = 1 / s, cv = new Canvas(w, h, s);
  cv.fill(rrect(0, 0.5, w, h - 1.5, 3), solid(fillc, a));
  if (edge && a >= 1) cv.fill(intersect(outline(rrect(0, 0.5, w, h - 0.5, 3), px), rect(0, h - 2, w, 2)), solid(BLACK, 0.25));
  const g = Math.ceil(4 * s);
  return withGuides(bitmap(cv), g, g, g, g);
};

/** A slot button with a word on it (Output, Automation mode), 3 frames. */
function slotWord(w: number, h: number, text: string, ink: RGB, face = X.slotGrey): Draw {
  return scaled((s) => hstack(([0, 1, 2] as Frame[]).map((f) => {
    const cv = new Canvas(w, h, s), px = 1 / s;
    const body = rrect(0, 0, w, h, 3);
    cv.fill(body, solid(f === 1 ? lighten(face, 0.07) : f === 2 ? darken(face, 0.1) : face));
    cv.fill(rect(2, h - px, w - 4, px), solid(BLACK, 0.2));
    cv.fill(word(text, w / 2, h / 2 + (f === 2 ? 0.5 : 0), 6, 0.2, 0.18), solid(ink));
    return bitmap(cv);
  })));
}

/** The mixer's thin fader slot (stretchable). */
const faderSlot = (w: number): Draw => (s) => {
  const h = 40, cv = new Canvas(w, h, s);
  const t = 2, x0 = Math.round((w / 2 - t / 2) * s) / s;
  cv.fill(rect(x0, 2, t, h - 4), solid(X.slit));
  const g = Math.round(6 * s), half = Math.floor((w * s) / 2) - 1;
  return withGuides(bitmap(cv), half, g, half, g);
};

/** Logic's silver fader cap: a light upper half with a darker band, a dark centre line, a light lower half. */
const faderCap = (w: number, h: number): Draw => (s) => {
  const cv = new Canvas(w, h, s), px = 1 / s;
  const shape = rrect(0, 0, w, h, 2);
  const m = h / 2;
  cv.fill(shape, vgrad(0, h, [
    [0, hex("#a9abac")], [0.08, hex("#b7babb")], [0.16, hex("#7d7e7e")], [0.3, hex("#8a8b8b")], [0.48, hex("#a0a1a1")],
    [0.52, hex("#a6a7a7")], [0.82, hex("#c3c7c9")], [0.88, hex("#8d8d8d")], [1, hex("#6c6c6c")],
  ]));
  cv.fill(rect(0, Math.round((m - 0.5) * s) / s, w, Math.max(px, 1)), solid(hex("#4e4e4e")));
  cv.fill(outline(shape, px), solid(BLACK, 0.45));
  return bitmap(cv);
};

/** A meter scale mark: the number right-aligned against a short tick (Logic's scale left of the meter). */
const meterMark = (label: string): Draw => scaled((s) => {
  const cv = new Canvas(MS_W, MS_H, s), px = 1 / s;
  const y = Math.round((MS_H / 2 - px / 2) * s) / s;
  cv.fill(rect(MS_W - 2, y, 2, px), solid(X.scale, 0.8));
  const u = 5.6, wd = I.textWidth(label, u, 0.15, 0.08);
  cv.fill(I.text(label, MS_W - 3 - wd / 2, MS_H / 2, u, 0.15, 0.08), solid(X.scale));
  return bitmap(cv);
});

/** A dark dB box (stretchable). */
const dbBox: Draw = (s) => {
  const w = 16, h = 15, cv = new Canvas(w, h, s);
  cv.fill(rrect(0, 0, w, h, 2), solid(X.meterBg));
  const g = Math.ceil(3 * s);
  return withGuides(bitmap(cv), g, g, g, g);
};

/** Strip background with Logic's one-pixel separator at the left (stretchable). */
const stripBg = (face: RGB): Draw => (s) => {
  const w = 24, h = 24, px = 1 / s, cv = new Canvas(w, h, s);
  cv.fill(rect(0, 0, w, h), solid(face));
  cv.fill(rect(0, 0, px, h), solid(X.stripLine));
  return withGuides(bitmap(cv), 2, 2, 2, 2);
};

// ---------------------------------------------------------------- control bar art

/** Light control-bar background with a one-pixel line at the bottom (stretchable). */
const barBg: Draw = (s) => {
  const w = 24, h = 24, px = 1 / s, cv = new Canvas(w, h, s);
  cv.fill(rect(0, 0, w, h), solid(X.bar));
  cv.fill(rect(0, h - px, w, px), solid(X.barLine));
  return withGuides(bitmap(cv), 2, 2, 2, 2);
};

/** A rounded plate that groups buttons (stretchable). */
const barPlate: Draw = (s) => {
  const w = 24, h = 26, cv = new Canvas(w, h, s);
  cv.fill(rrect(0, 0, w, h, 6), solid(X.plate));
  const g = Math.ceil(7 * s);
  return withGuides(bitmap(cv), g, g, g, g);
};

type G3 = (cx: number, cy: number, u: number) => SDF;
/**
 * A control-bar button on a plate: transparent at rest with a dark glyph, a soft darker square on
 * hover, and (pressed / on) either a coloured glyph or a filled colour with a white glyph.
 */
function barButton(w: number, h: number, g: G3, u: number, opts: { ink?: RGB; on?: RGB; onFill?: RGB; onInk?: RGB; all?: RGB } = {}): Draw {
  return scaled((s) => hstack(([0, 1, 2] as Frame[]).map((f) => {
    const cv = new Canvas(w, h, s);
    const box = rrect(1, 1, w - 2, h - 2, 5);
    let ink = opts.all ?? opts.ink ?? X.ink;
    if (f === 1) cv.fill(box, solid(BLACK, 0.07));
    if (f === 2) {
      if (opts.onFill) {
        cv.fill(box, solid(opts.onFill));
        ink = opts.onInk ?? WHITE;
      } else {
        cv.fill(box, solid(BLACK, 0.1));
        ink = opts.on ?? ink;
      }
    }
    cv.fill(g(w / 2, h / 2, u), solid(ink));
    return bitmap(cv);
  })));
}

/** A lit transport button (play on, cycle on, record on): a filled rounded square. */
function litButton(w: number, h: number, g: G3, u: number, face: RGB, ink: RGB): Draw {
  return scaled((s) => hstack(([0, 1, 2] as Frame[]).map((f) => {
    const cv = new Canvas(w, h, s);
    cv.fill(rrect(1, 1, w - 2, h - 2, 5), solid(f === 1 ? lighten(face, 0.06) : f === 2 ? darken(face, 0.1) : face));
    cv.fill(g(w / 2, h / 2, u), solid(ink));
    return bitmap(cv);
  })));
}

/** The LCD: a dark rounded panel with Logic's dividers and captions; REAPER's fields sit on top. */
function paintLcd(cv: Canvas) {
  const px = 1 / cv.s;
  const body = rrect(0, 0, LCD_W, LCD_H, 6);
  cv.fill(body, solid(X.lcd));
  cv.fill(outline(body, px), solid(X.lcdEdge, 0.6));
  for (const x of LCD_DIV) cv.fill(rect(x, 4, px, LCD_H - 8), solid(X.lcdLine));
  const cy = LCD_H - 6.5, u = 5.2;
  // Under the bar and beat digits of REAPER's "1.1.00" (Logic's 18 px light digits from x 9).
  cv.fill(word("BAR", 16, cy, u, 0.19, 0.2), solid(X.lcdCap));
  cv.fill(word("BEAT", 37, cy, u, 0.19, 0.2), solid(X.lcdCap));
  const tc = (LCD_DIV[0]! + LCD_DIV[1]!) / 2;
  cv.fill(word("TEMPO", tc, cy, u, 0.19, 0.2), solid(X.lcdCap));
  // Logic's tempo mode under the tempo.
  cv.fill(word("KEEP", tc, 24.5, 5.6, 0.24, 0.16), solid(hex("#c5ccd6")));
  const ch = (LCD_DIV[2]! + LCD_W) / 2;
  cv.fill(polyline([[ch - 2.6, LCD_H / 2 - 1.4], [ch, LCD_H / 2 + 1.2], [ch + 2.6, LCD_H / 2 - 1.4]], st(0.6)), solid(hex("#9aa7b6")));
}
const lcd: Draw = scaled((s) => {
  const cv = new Canvas(LCD_W, LCD_H, s);
  paintLcd(cv);
  return bitmap(cv);
});
/** The position element's background: the LCD body's colour (the element sits inside the LCD). */
const lcdStatus: Draw = (s) => {
  const cv = new Canvas(6, 6, s);
  cv.fill(rect(0, 0, 6, 6), solid(X.lcd));
  return bitmap(cv);
};

// Glyphs for the control bar (u ≈ glyph height).
const ring = (s: SDF, r: number): SDF => (x, y) => Math.abs(s(x, y)) - r;
const gStop: G3 = (cx, cy, u) => rrect(cx - u * 0.5, cy - u * 0.5, u, u, u * 0.08);
const gPlay: G3 = (cx, cy, u) => rpoly([[cx - u * 0.42, cy - u * 0.55], [cx + u * 0.55, cy], [cx - u * 0.42, cy + u * 0.55]], u * 0.06);
const gRec: G3 = (cx, cy, u) => circle(cx, cy, u * 0.5);
const gCapture: G3 = (cx, cy, u) => union(subtract(circle(cx, cy, u * 0.55), circle(cx, cy, u * 0.55 - st(u * 0.09) * 2)), circle(cx, cy, u * 0.27));
const gCycle: G3 = (cx, cy, u) => {
  // Two arrows chasing round a rounded loop.
  const t = st(u * 0.075), w = u * 1.0, h = u * 0.62, r = h / 2;
  const loop = ring(rrect(cx - w / 2, cy - h / 2, w, h, r), t);
  const cuts = union(rect(cx + u * 0.02, cy - h / 2 - t * 2, u * 0.22, t * 4), rect(cx - u * 0.24, cy + h / 2 - t * 2, u * 0.22, t * 4));
  const head = (x: number, y: number, dir: 1 | -1) => poly([[x, y - u * 0.17], [x + dir * u * 0.2, y], [x, y + u * 0.17]]);
  return union(subtract(loop, cuts), head(cx + u * 0.02, cy - h / 2, 1), head(cx - u * 0.02, cy + h / 2, -1));
};
const gCount: G3 = (cx, cy, u) => I.text("1234", cx, cy, u * 0.62, 0.17, 0.08);
const gMetro: G3 = (cx, cy, u) => {
  const t = st(u * 0.07);
  const body = poly([[cx - u * 0.4, cy + u * 0.5], [cx - u * 0.14, cy - u * 0.5], [cx + u * 0.14, cy - u * 0.5], [cx + u * 0.4, cy + u * 0.5]]);
  return union(ring(body, t), capsule(cx - u * 0.36, cy + u * 0.18, cx + u * 0.36, cy + u * 0.18, t), capsule(cx, cy + u * 0.18, cx + u * 0.34, cy - u * 0.4, t));
};

// View-button glyphs (original drawings of what each button opens).
const gLibrary: G3 = (cx, cy, u) => {
  const t = st(u * 0.07);
  const back = ring(rrect(cx - u * 0.55, cy - u * 0.5, u * 0.8, u * 0.72, u * 0.1), t);
  const front = rrect(cx - u * 0.25, cy - u * 0.2, u * 0.8, u * 0.72, u * 0.1);
  const note = union(circle(cx + u * 0.08, cy + u * 0.3, u * 0.1), capsule(cx + u * 0.17, cy + u * 0.3, cx + u * 0.17, cy - u * 0.06, t * 0.8), capsule(cx + u * 0.17, cy - u * 0.06, cx + u * 0.34, cy - u * 0.02, t * 0.8));
  return union(subtract(back, grow(front, t * 2)), subtract(front, note));
};
const gInspector: G3 = (cx, cy, u) => {
  const t = st(u * 0.07);
  const p1 = rrect(cx - u * 0.5, cy - u * 0.5, u, u * 0.42, u * 0.21), p2 = rrect(cx - u * 0.5, cy + u * 0.08, u, u * 0.42, u * 0.21);
  return union(subtract(p1, circle(cx + u * 0.29, cy - u * 0.29, u * 0.14)), ring(p2, t), circle(cx - u * 0.29, cy + u * 0.29, u * 0.13));
};
const gToolbar: G3 = (cx, cy, u) => {
  const t = st(u * 0.07);
  return union(ring(rrect(cx - u * 0.55, cy - u * 0.45, u * 1.1, u * 0.9, u * 0.08), t), capsule(cx - u * 0.55, cy - u * 0.2, cx + u * 0.55, cy - u * 0.2, t), capsule(cx, cy - u * 0.04, cx, cy + u * 0.3, t), polyline([[cx - u * 0.14, cy + u * 0.16], [cx, cy + u * 0.3], [cx + u * 0.14, cy + u * 0.16]], t));
};
const gMixer: G3 = (cx, cy, u) => {
  const t = st(u * 0.06);
  return union(...[-0.36, 0, 0.36].flatMap((d, i) => [capsule(cx + u * d, cy - u * 0.55, cx + u * d, cy + u * 0.55, t), rrect(cx + u * d - u * 0.12, cy + u * [0.16, -0.26, 0.06][i]! - u * 0.1, u * 0.24, u * 0.2, u * 0.05)]));
};
const gPencil: G3 = (cx, cy, u) => {
  const a = 45 * D, ca = Math.cos(a), sa = Math.sin(a);
  const P = (x: number, y: number): [number, number] => [cx + x * ca - y * sa, cy + x * sa + y * ca];
  return union(rpoly([P(-u * 0.1, -u * 0.62), P(u * 0.1, -u * 0.62), P(u * 0.1, u * 0.3), P(-u * 0.1, u * 0.3)], u * 0.02), poly([P(-u * 0.1, u * 0.36), P(u * 0.1, u * 0.36), P(0, u * 0.62)]));
};
const gLists: G3 = (cx, cy, u) => {
  const t = st(u * 0.065);
  return union(...[-0.36, 0, 0.36].flatMap((d) => [circle(cx - u * 0.48, cy + u * d, u * 0.08), capsule(cx - u * 0.26, cy + u * d, cx + u * 0.55, cy + u * d, t)]));
};
const gLoops: G3 = (cx, cy, u) => {
  // A loop of tape: a ring whose bottom runs off to the right.
  const t = st(u * 0.07), r = u * 0.36, ccy = cy - u * 0.08;
  return union(arc(cx - u * 0.12, ccy, r, -190 * D, 150 * D, t), capsule(cx - u * 0.12, ccy + r, cx + u * 0.6, ccy + r, t));
};
const grow = (a: SDF, by: number): SDF => (x, y) => a(x, y) - by;

// ---------------------------------------------------------------- items, toolbar, piano roll

type RGBA = [number, number, number, number];
/** Device-pixel RGBA images that keep their exact size at every scale (meter colour maps with clear cells). */
const exactA = (w: number, h: number, paint: (x: number, y: number) => RGBA): Draw => () => {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(paint(x, y), (y * w + x) * 4);
  return { width: w, height: h, data };
};

/**
 * Region frame over every item (9-slice, drawn inside the item): a near-black one-pixel outline
 * and corners rounded off into the lane colour, as Logic draws its regions.
 */
const regionFrame = (lane: RGB, band: number | null): Draw => (s) => {
  const w = 16, h = 30, px = 1 / s, cv = new Canvas(w, h, s), r = 3;
  const shape = rrect(0, 0, w, h, r);
  // Paint the lane colour outside the rounded corners.
  cv.fill(subtract(rect(0, 0, w, h), shape), solid(lane));
  if (band !== null) cv.fill(intersect(shape, rect(0, 0, w, band)), solid(hex("#ffffff"), 0.72));
  cv.fill(outline(shape, px), solid(BLACK, 0.62));
  const g = Math.ceil(4 * s), top = Math.ceil((band ?? 4) * s) + 1;
  return withGuides(bitmap(cv), g, top, g, g);
};

/** Toolbar button chrome under every icon: Logic's grey plate, lighter on hover, recessed when on. */
const toolChrome = (z: number): Draw => (s) => hstack([0, 1, 2].map((f) => {
  const cv = new Canvas(z, z, s);
  const plate = rrect(2, 4, z - 4, z - 8, 4);
  cv.fill(plate, solid(f === 0 ? hex("#575757") : f === 1 ? hex("#646464") : hex("#2f2f2f")));
  return bitmap(cv);
}));

/** Logic's velocity colours: violet and blue for soft notes, teal and green, olive, orange-brown, red at 127. */
const VEL: [number, RGB][] = [
  [0, hex("#7a52d8")], [0.18, hex("#3f78d6")], [0.32, hex("#35a7b0")], [0.42, hex("#3db36b")], [0.52, hex("#4fb441")],
  [0.64, hex("#8ab342")], [0.72, hex("#9fb341")], [0.82, hex("#b37f41")], [0.92, hex("#b65742")], [1, hex("#ff3030")],
];
function velColor(t: number): RGB {
  let i = 1;
  while (i < VEL.length - 1 && t > VEL[i]![0]) i++;
  const [t0, c0] = VEL[i - 1]!, [t1, c1] = VEL[i]!;
  return mixc(c0, c1, Math.min(1, Math.max(0, (t - t0) / (t1 - t0))));
}
/** REAPER's note colour map (see art.noteColormap), coloured by velocity like Logic's Piano Roll, with dark edges. */
const noteMap: Draw = exact(157, 130, (x, y) => {
  const sel = y >= 65;
  const base = x >= 12 && x < 140 ? velColor((x - 12) / 127) : x === 140 ? hex("#4fb441") : velColor(((x < 12 ? x : x - 141) % 12) / 11);
  if (y === 64) return hex("#0e0e0e");
  if (y === 129) return hex("#f4f4f4");
  return sel ? mixc(base, WHITE, 0.42) : base;
});

// ---------------------------------------------------------------- toolbar glyphs

const t = (u: number) => u * 0.065;

const GLYPHS: Record<string, Glyph> = {
  library: (cx, cy, u) => gLibrary(cx, cy, u * 0.8),
  inspector: (cx, cy, u) => gInspector(cx, cy, u * 0.78),
  mixer: (cx, cy, u) => gMixer(cx, cy, u * 0.8),
  editors: (cx, cy, u) => gPencil(cx, cy, u * 0.85),
  pointer: (cx, cy, u) => rpoly([[cx - u * 0.26, cy - u * 0.46], [cx + u * 0.3, cy + u * 0.1], [cx + u * 0.04, cy + u * 0.12], [cx + u * 0.18, cy + u * 0.42], [cx + u * 0.06, cy + u * 0.47], [cx - u * 0.08, cy + u * 0.18], [cx - u * 0.26, cy + u * 0.34]], u * 0.02),
  pencil: (cx, cy, u) => gPencil(cx, cy, u * 0.8),
  eraser: (cx, cy, u) => {
    const a = 40 * D, ca = Math.cos(a), sa = Math.sin(a);
    const P = (x: number, y: number): [number, number] => [cx + x * ca - y * sa, cy + x * sa + y * ca];
    return union(ring(rpoly([P(-u * 0.2, -u * 0.46), P(u * 0.2, -u * 0.46), P(u * 0.2, u * 0.46), P(-u * 0.2, u * 0.46)], u * 0.03), t(u)), rpoly([P(-u * 0.2, u * 0.04), P(u * 0.2, u * 0.04), P(u * 0.2, u * 0.46), P(-u * 0.2, u * 0.46)], u * 0.03));
  },
  scissors: (cx, cy, u) => union(
    ring(circle(cx - u * 0.24, cy + u * 0.28, u * 0.13), t(u)), ring(circle(cx + u * 0.24, cy + u * 0.28, u * 0.13), t(u)),
    capsule(cx - u * 0.14, cy + u * 0.18, cx + u * 0.2, cy - u * 0.46, t(u) * 1.1), capsule(cx + u * 0.14, cy + u * 0.18, cx - u * 0.2, cy - u * 0.46, t(u) * 1.1),
  ),
  mute: (cx, cy, u) => union(ring(rrect(cx - u * 0.44, cy - u * 0.36, u * 0.88, u * 0.72, u * 0.1), t(u)), I.text("M", cx, cy, u * 0.42, 0.2)),
  zoom: (cx, cy, u) => union(ring(circle(cx - u * 0.08, cy - u * 0.08, u * 0.3), t(u) * 1.1), capsule(cx + u * 0.14, cy + u * 0.14, cx + u * 0.42, cy + u * 0.42, t(u) * 1.6)),
  marquee: (cx, cy, u) => {
    const s = u * 0.42, l = u * 0.18, r = t(u);
    const corner = (sx: number, sy: number) => union(capsule(cx + sx * s, cy + sy * s, cx + sx * (s - l), cy + sy * s, r), capsule(cx + sx * s, cy + sy * s, cx + sx * s, cy + sy * (s - l), r));
    return union(corner(-1, -1), corner(1, -1), corner(-1, 1), corner(1, 1), capsule(cx, cy - u * 0.14, cx, cy + u * 0.14, r), capsule(cx - u * 0.14, cy, cx + u * 0.14, cy, r));
  },
  automation: (cx, cy, u) => I.envelope(cx, cy, u),
  catch: (cx, cy, u) => union(capsule(cx - u * 0.1, cy - u * 0.2, cx - u * 0.1, cy + u * 0.46, t(u)), poly([[cx - u * 0.32, cy - u * 0.46], [cx + u * 0.12, cy - u * 0.46], [cx - u * 0.1, cy - u * 0.18]]), polyline([[cx + u * 0.12, cy - u * 0.02], [cx + u * 0.36, cy + u * 0.16], [cx + u * 0.12, cy + u * 0.34]], t(u))),
  snap: (cx, cy, u) => I.tb.snap!(cx, cy, u),
  capture: (cx, cy, u) => gCapture(cx, cy, u * 0.8),
  countin: (cx, cy, u) => I.text("1234", cx, cy, u * 0.46, 0.17, 0.12),
  metronome: (cx, cy, u) => gMetro(cx, cy, u * 0.85),
  browsers: (cx, cy, u) => gLoops(cx, cy, u * 0.8),
  velocity: (cx, cy, u) => union(capsule(cx - u * 0.42, cy + u * 0.42, cx + u * 0.42, cy + u * 0.42, t(u)), ...[-0.24, 0.04, 0.3].map((d, i) => union(capsule(cx + u * d, cy + u * 0.42, cx + u * d, cy - u * [0.04, 0.32, 0.14][i]!, t(u)), circle(cx + u * d, cy - u * [0.04, 0.32, 0.14][i]!, u * 0.1)))),
  brush: (cx, cy, u) => union(capsule(cx + u * 0.42, cy - u * 0.42, cx - u * 0.02, cy + u * 0.02, t(u) * 1.3), rpoly([[cx - u * 0.06, cy - u * 0.02], [cx + u * 0.06, cy + u * 0.1], [cx - u * 0.12, cy + u * 0.46], [cx - u * 0.46, cy + u * 0.46]], u * 0.04)),
  quantize: (cx, cy, u) => I.tb.quant!(cx, cy, u),
  pianoroll: (cx, cy, u) => I.tb.midi_mode_piano_roll!(cx, cy, u),
  eventlist: (cx, cy, u) => I.tb.midi_mode_event_list!(cx, cy, u),
  score: (cx, cy, u) => I.tb.midi_mode_musical_notation!(cx, cy, u),
};

/** Toolbar icons by REAPER icon name ("assist_logic_<name>"). */
const toolbarGlyphs: Record<string, Glyph> = Object.fromEntries(Object.entries(GLYPHS).map(([n, g]) => [`assist_logic_${n}`, g]));

// ---------------------------------------------------------------- images

function images(k: Kit, out: Record<string, Draw>) {
  const z = SIZES, c = k.c;
  const ink = X.segInk, dimInk = hex("#a4a4a4");
  // Track header M|S R|I.
  const [bw, bh] = z.tcpBtn;
  out.track_mute_off = seg(bw, bh, "l", "M", null, ink);
  out.track_mute_on = seg(bw, bh, "l", "M", X.mute, WHITE);
  out.track_solo_off = seg(bw, bh, "r", "S", null, ink);
  out.track_solo_on = seg(bw, bh, "r", "S", X.solo, WHITE);
  out.track_recarm_off = seg(bw, bh, "l", "R", null, ink);
  out.track_recarm_on = seg(bw, bh, "l", "R", X.arm, WHITE);
  out.track_recarm_norec = seg(bw, bh, "l", "R", darken(X.arm, 0.35), WHITE);
  // Armed when selected (REAPER's automatic record arm): Logic's red R on the selected track.
  out.track_recarm_auto = seg(bw, bh, "l", "R", null, X.armInk);
  out.track_recarm_auto_on = seg(bw, bh, "l", "R", X.arm, WHITE);
  out.track_recarm_auto_norec = seg(bw, bh, "l", "R", darken(X.arm, 0.45), WHITE);
  // REAPER monitors every new track (when armed): that is Logic's plain I; off is dimmed, auto orange.
  out.track_monitor_on = seg(bw, bh, "r", "I", null, ink);
  out.track_monitor_off = seg(bw, bh, "r", "I", null, dimInk);
  out.track_monitor_auto = seg(bw, bh, "r", "I", null, X.input);
  out.track_fcomp_off = disclosure("down", hex("#d8d8d8"));
  out.track_fcomp_small = disclosure("right", hex("#d8d8d8"));
  out.track_fcomp_tiny = disclosure("right", hex("#d8d8d8"));
  out.k_numedge = numEdge;
  out.k_icon = iconMask(X.header);
  out.k_icon_sel = iconMask(X.headerSel);
  out.tcp_bg = headerBg(X.header);
  out.tcp_bgsel = headerBg(X.headerSel);
  for (const n of ["tcp_mainbg", "tcp_folderbg"]) out[n] = out.tcp_bg;
  for (const n of ["tcp_mainbgsel", "tcp_folderbgsel"]) out[n] = out.tcp_bgsel;
  // Header volume and pan.
  out.tcp_volbg = volPill(z.tcpThumb[1]);
  out.tcp_volthumb = volThumb(z.tcpThumb[0], z.tcpThumb[1]);
  out.tcp_pan_knob_stack = panKnob(z.tcpKnob, 3, 15);
  out.tcp_wid_knob_stack = out.tcp_pan_knob_stack;
  out.tcp_vol_knob_stack = out.tcp_pan_knob_stack;
  // The header meter lives inside the volume pill: unlit cells are see-through, so the pill
  // (and the thumb, drawn under the meter) shows; lit cells are Logic's green.
  const clear: RGBA = [0, 0, 0, 0];
  const lit = (c: RGB): RGBA => [c[0], c[1], c[2], 255];
  const cells = (lo: boolean): RGBA[] => {
    const g = lo ? X.meterLo : X.meterHi;
    return [clear, lit(g), clear, lit(g), clear, lit(g), clear, lit(X.meterClip)];
  };
  // Horizontal meters: column 0 is the low (left) end, column 1 the high end (as art.ts's map).
  out.meter_strip_h = exactA(2, 32, (x, y) => cells(x === 0)[y >> 2]!);
  out.meter_strip_h_rms = out.meter_strip_h;
  out.meter_bg_h = exactA(6, 6, () => clear);
  out.meter_clip_h = exactA(8, 4, () => clear);
  out.meter_bg_tcp = exactA(6, 6, () => clear);
  // Channel-strip meters: Logic's green rising to yellow, the same on armed tracks (REAPER tints those red).
  const well: RGBA = lit(X.meterBg);
  const vcells = (top: boolean): RGBA[] => {
    const g = lit(top ? X.meterTop : X.meterLo);
    return [well, g, well, g, well, g, well, lit(X.meterClip)];
  };
  out.meter_strip_v = exactA(32, 2, (x, y) => vcells(y === 0)[x >> 2]!);
  out.meter_strip_v_rms = out.meter_strip_v;
  // No REAPER state badges ("M", "!S") over meters: Logic shows mute and solo on the buttons only.
  for (const n of ["meter_mute", "meter_unsolo", "meter_solodim", "meter_foldermute", "meter_automute"]) out[n] = exactA(6, 6, () => clear);

  // Mixer buttons.
  const [mw, mh] = z.mcpMute;
  out.mcp_mute_off = pill(mw, mh, "M", null, ink);
  out.mcp_mute_on = pill(mw, mh, "M", X.mute, WHITE);
  out.mcp_solo_off = pill(mw, mh, "S", null, ink);
  out.mcp_solo_on = pill(mw, mh, "S", X.solo, WHITE);
  const [aw, ah] = z.mcpArm;
  out.mcp_recarm_off = pill(aw, ah, "R", null, ink, 6.5);
  out.mcp_recarm_on = pill(aw, ah, "R", X.arm, WHITE, 6.5);
  out.mcp_recarm_norec = pill(aw, ah, "R", darken(X.arm, 0.35), WHITE, 6.5);
  out.mcp_recarm_auto = pill(aw, ah, "R", null, X.armInk, 6.5);
  out.mcp_recarm_auto_on = pill(aw, ah, "R", X.arm, WHITE, 6.5);
  out.mcp_recarm_auto_norec = pill(aw, ah, "R", darken(X.arm, 0.45), WHITE, 6.5);
  out.mcp_monitor_on = pill(aw, ah, "I", null, ink, 6.5);
  out.mcp_monitor_off = pill(aw, ah, "I", null, dimInk, 6.5);
  out.mcp_monitor_auto = pill(aw, ah, "I", null, X.input, 6.5);
  // Pan, fader, meter scale.
  out.mcp_pan_knob_stack = panKnob(z.mcpKnob, 3, 24);
  out.mcp_wid_knob_stack = out.mcp_pan_knob_stack;
  out.mcp_vol_knob_stack = out.mcp_pan_knob_stack;
  out.mcp_volbg = faderSlot(z.mcpFaderW);
  out.mcp_volthumb = faderCap(z.mcpThumb[0], z.mcpThumb[1]);
  for (const [db, name] of METER_MARKS) out[name] = meterMark(String(-db));
  out.k_dbbox = dbBox;
  // Strip backgrounds and the insert well.
  out.mcp_bg = stripBg(X.header);
  out.mcp_bgsel = stripBg(X.headerSel);
  for (const n of ["mcp_mainbg", "mcp_folderbg"]) out[n] = out.mcp_bg;
  for (const n of ["mcp_mainbgsel", "mcp_folderbgsel"]) out[n] = out.mcp_bgsel;
  out.mcp_extmixbg = (s) => {
    const cv = new Canvas(6, 6, s);
    cv.fill(rect(0, 0, 6, 6), solid(X.slotWell));
    return bitmap(cv);
  };
  // Slots: blue plug-ins and sends, grey bypassed, faint empty ones; a grey Input slot.
  out.mcp_fxlist_norm = slot(X.slot);
  out.mcp_fxlist_byp = slot(hex("#5f6368"));
  out.mcp_fxlist_off = slot(hex("#6b3a3a"));
  // Empty insert slots are just the dark well, as in Logic.
  out.mcp_fxlist_empty = (s) => bitmap(new Canvas(6, 6, s));
  out.mcp_fxlist_bg = (s) => bitmap(new Canvas(6, 6, s));
  out.mcp_sendlist_norm = slot(X.slot);
  out.mcp_sendlist_mute = slot(hex("#5f6368"));
  out.mcp_sendlist_empty = slot(hex("#4a4a4a"), 1, false);
  out.mcp_sendlist_bg = (s) => bitmap(new Canvas(6, 6, s));
  out.mcp_recinput = slot(X.slotGrey);
  // Output and automation-mode slots.
  const [sw, sh] = z.mcpSmall;
  for (const sfx of ["", "_r", "_s", "_s_r"]) {
    out[`mcp_io${sfx}`] = slotWord(sw, sh, "ST OUT", X.slotText);
    out[`mcp_io${sfx}_dis`] = slotWord(sw, sh, "NO OUT", hex("#ff6a5e"));
  }
  out.master_mcp_io = slotWord(sw, sh, "OUTPUT", X.slotText);
  out.mcp_env = slotWord(sw, sh, "READ", X.read);
  out.mcp_env_read = slotWord(sw, sh, "READ", X.read);
  out.mcp_env_touch = slotWord(sw, sh, "TOUCH", c.env[1]);
  out.mcp_env_write = slotWord(sw, sh, "WRITE", c.env[2]);
  out.mcp_env_latch = slotWord(sw, sh, "LATCH", c.env[3]);
  out.mcp_env_preview = slotWord(sw, sh, "PREVIEW", c.env[4]);
  out.mixer_menu = scaled((s) => hstack(([0, 1, 2] as Frame[]).map((f) => {
    const [w, h] = z.menu, cv = new Canvas(w, h, s);
    cv.fill(rrect(0, 0, w, h, 3), solid(f === 1 ? hex("#707070") : f === 2 ? hex("#5a5a5a") : hex("#666666")));
    cv.fill(I.menu(w / 2, h / 2, 8), solid(ink));
    return bitmap(cv);
  })));

  // Control bar.
  const [tw, th] = z.trans;
  out.transport_bg = barBg;
  out.k_plate = barPlate;
  out.transport_stop = barButton(tw, th, gStop, 11);
  out.transport_play = barButton(tw, th, gPlay, 13);
  out.transport_play_on = litButton(tw, th, gPlay, 13, X.playLit, WHITE);
  out.transport_play_sync = barButton(tw, th, gPlay, 13, { ink: c.accent2 });
  out.transport_play_sync_on = litButton(tw, th, gPlay, 13, c.accent2, WHITE);
  out.transport_pause = barButton(tw, th, I.pause, 12);
  out.transport_pause_on = litButton(tw, th, I.pause, 12, X.ink, WHITE);
  for (const n of ["record", "record_item", "record_loop"]) {
    out[`transport_${n}`] = barButton(tw, th, gRec, 13, { ink: X.rec });
    out[`transport_${n}_on`] = litButton(tw, th, (x, y, u) => gRec(x, y, u), 11, X.rec, WHITE);
  }
  out.transport_repeat_off = barButton(tw, th, gCycle, 15);
  out.transport_repeat_on = litButton(tw, th, gCycle, 15, X.cycleLit, hex("#2a2410"));
  const rew = (x: number, y: number, u: number) => I.skip(x, y, u, -1, false);
  const fwd = (x: number, y: number, u: number) => I.skip(x, y, u, 1, false);
  out.transport_home = barButton(tw, th, rew, 13);
  out.transport_end = barButton(tw, th, fwd, 13);
  out.transport_previous = out.transport_home;
  out.transport_next = out.transport_end;
  out.k_capture = barButton(tw, th, gCapture, 14, { all: hex("#cc2a20") });
  out.k_countin = barButton(tw, th, gCount, 12, { onFill: X.purple });
  out.k_click = barButton(tw, th, gMetro, 15, { on: X.purple });
  out.k_lcd = lcd;
  for (const [g, name, u] of [[gLibrary, "k_v_library", 15], [gInspector, "k_v_inspector", 14], [gToolbar, "k_v_toolbar", 14], [gMixer, "k_v_mixer", 14], [gPencil, "k_v_editors", 15], [gLists, "k_v_lists", 14], [gLoops, "k_v_browsers", 15]] as const) {
    out[name] = barButton(VB, th, g, u, { on: X.viewOn });
  }
  out.transport_status_bg = lcdStatus;
  out.transport_status_bg_err = lcdStatus;
  for (const n of ["transport_edit_bg", "transport_bpm_bg"]) out[n] = (s) => bitmap(new Canvas(6, 6, s));
  out.transport_group_bg = (s) => bitmap(new Canvas(6, 6, s));

  // Regions: Logic's outline and rounded corners; a selected region's name bar turns pale.
  out.item_bg = regionFrame(hex("#2e2e2e"), null);
  out.item_bg_sel = regionFrame(hex("#343435"), 14);
  // No selection dot: the pale name bar is Logic's selection mark.
  out.item_seldot = exactA(6, 6, () => clear);
  // Toolbar plates under every icon; a toggled-on button gets Logic's blue plate (REAPER draws this
  // "highlight" between the plate and the icon, as a 12-frame animation: all frames alike here).
  out.toolbar_blank = toolChrome(z.toolbar);
  out.animation_toolbar_highlight = (s) => {
    const zz = z.toolbar, cv = new Canvas(zz, zz * 12, s);
    for (let i = 0; i < 12; i++) cv.fill(rrect(2, i * zz + 4, zz - 4, zz - 8, 4), solid(X.toolOn));
    return bitmap(cv);
  };
  // The toolbar area takes the grey of Logic's Tracks-area menu bar.
  out.toolbar_bg = (s) => {
    const cv = new Canvas(6, 6, s);
    cv.fill(rect(0, 0, 6, 6), solid(X.menuBar));
    return bitmap(cv);
  };
  // Piano Roll notes coloured by velocity.
  out.midi_note_colormap = noteMap;
}

const logic: KitDef = {
  id: "logic",
  palette,
  sizes: SIZES,
  mcpWidth: MCP_W,
  fonts: { label: 3, value: 2, list: 2, tempo: 4, sig: 4, status: 5 },
  faces: {
    slots: {
      1: { face: "Segoe UI", mac: "Helvetica Neue", px: 8, weight: 700 },
      2: { face: "Segoe UI", mac: "Helvetica Neue", px: 10 },
      3: { face: "Segoe UI", mac: "Helvetica Neue Medium", px: 12, weight: 500 },
      4: { face: "Segoe UI Semibold", mac: "Helvetica Neue Medium", px: 13, weight: 600 },
      // The mixer's dB readouts (REAPER draws the position in the transport face, not a slot).
      5: { face: "Segoe UI", mac: "Helvetica Neue", px: 9 },
    },
    // The LCD's position: Logic's big thin digits.
    transport: { face: "Segoe UI Light", mac: "Helvetica Neue Light", px: 26, weight: 300 },
    ruler: { face: "Segoe UI", mac: "Helvetica Neue", px: 11 },
    items: { face: "Segoe UI", mac: "Helvetica Neue Medium", px: 11, weight: 500 },
    volpan: { face: "Segoe UI", mac: "Helvetica Neue", px: 10 },
    title: { face: "Segoe UI", mac: "Helvetica Neue", px: 11 },
  },
  // No peak box at the end of the header meter (it sits inside the volume pill).
  globals: { tcp_heights: "4 28 44 44", tcp_folderindent: "0", mcp_min_height: "240 80", tcp_vupeakwidth: "0" },
  layout: { tcp, masterTcp, mcp, trans },
  images,
  toolbarGlyphs,
  // Lit toolbar buttons: a white glyph on Logic's blue plate (animation_toolbar_highlight).
  toolbarInk: { on: "#ffffff" },
};

export default logic;
