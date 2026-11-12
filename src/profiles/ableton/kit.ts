import type { SkinUi } from "../skins";
import { BLACK, fillImg, icon, marker, panel, SCALE_H, SCALE_MARKS, SCALE_W, scaleMark, scaled, thumb, hTrack, word, type Draw, type Frame, type Glyph as ArtGlyph } from "../kit/art";
import * as I from "../kit/icons";
import { Canvas, bitmap, capsule, circle, darken, hex, hstack, lighten, mixc, outline, poly, polyline, rect, solid, union, withGuides, type RGB, type SDF } from "../kit/raster";
import { DEFAULT_ENV, type Glyph, type Kit, type KitDef, type KitSizes, type MeterRange } from "../kit/types";
import { CENTER, envcp, extMixer, fg, fill, H, meterLook, ON_COLOR, rgb, type Script, TRACK_FILL, transDisplay, W } from "../kit/walter";

/**
 * Ableton Live 9's classic light look, Arrangement View, at Live's own sizes (100 % zoom):
 * 17 px rows, 13 px controls with a black hairline, flat #8d8d8d surfaces, 2 px dark dividers.
 *
 * Track header, left to right: the name field (the track colour, bold italic name, the round fold
 * button), then Live's mixer section: the yellow Track Activator with the track number, S and arm;
 * below them the volume box (orange up to the level) and the pan box; a thin two-channel meter on
 * the edge. Under the name: the device chooser (FX) as a Live chooser box. In/Out (⌘⌥I), Sends (⌘⌥S)
 * and the mixer part (⌘⌥M) show and hide like Live's (theme parameters k_io, k_sends, k_nomix,
 * flipped by the profile's script). Clips: a title bar in the clip colour over a grey body (item_bg).
 * The control bar: TAP, tempo, signature on the left; position and ▶ ■ ● and automation arm in the
 * middle; the loop switch and loop / selection fields on the right; Live's light-edged grey fields.
 * Original drawings only.
 */

// Live 9's stock colours (its default skin): surfaces, buttons, text fields, the yellow activator,
// the orange volume range, blue solo, red arm, cyan selection, slate loop / selected notes.
const SURFACE = hex("#8d8d8d"), BUTTON = hex("#999999"), FIELD = hex("#bfbfbf"), SELECTED = hex("#b5b2b1");
const DESKTOP = hex("#767676"), DIVIDER = hex("#505050"), EDGE = hex("#0e0e0e"), BAR_EDGE = hex("#bcbcbc");
const ORANGE = hex("#ec7a28"), SELECTION = hex("#7fffff");

/** Track colours for tracks that have none (Live gives every track one); lighter Live 9 hues, black text. */
const FALLBACK = ["#f8a845", "#e3e386", "#8bcf5b", "#5fd5f0", "#a6b9ec", "#f08ea5", "#62c9b3", "#d7c7f0"].map(hex);

function palette(ui: SkinUi): Kit {
  const u = (k: keyof SkinUi) => hex(ui[k]);
  return {
    id: "ableton",
    look: "flat",
    radius: 0,
    c: {
      bg: DESKTOP,
      panel: SURFACE,
      track: SURFACE,
      trackSel: SELECTED,
      face: BUTTON,
      line: DIVIDER,
      deep: hex("#323232"),
      text: u("text"),
      dim: hex("#5a5a5a"),
      accent: u("accent"),
      accent2: u("accent2"),
      solo: hex("#2883c9"),
      arm: hex("#ff3223"),
      play: hex("#3fd21a"),
      onInk: hex("#000000"),
      env: DEFAULT_ENV,
      display: BUTTON,
      displayText: u("text"),
      knob: hex("#f26000"),
      // Unselected notes are red, lighter at low velocity; selected notes dark slate.
      notes: { off: hex("#ff1200"), on: hex("#232834"), bg: hex("#b4b4b4") },
      meter: { off: hex("#181e23"), low: hex("#0af864"), mid: hex("#c6f864"), high: hex("#ffd00a"), clip: hex("#ff0a0a") },
    },
  };
}

/** Live's row pitch and control height at 100 %. */
const ROW = 17, BH = 13;
/** Top of row r's controls (row 0 is the name row). */
const ry = (r: number) => 2 + r * ROW;

const SIZES: KitSizes = {
  // Track header: activator 47×13, S and arm 21×13, the fold button 13×13, choosers 87×13.
  tcpMute: [47, BH], tcpBtn: [21, BH], tcpSmall: [13, BH], tcpFx: [87, BH], tcpKnob: BH, tcpThumb: [47, BH],
  // Mixer (Session strip): activator, solo and arm as one 40px column, a 28px pan knob, the volume as a
  // small triangle beside the meter. FX, routing, automation and monitoring share a row at the top.
  mcpMute: [24, 21], mcpBtn: [24, 13], mcpArm: [24, 13], mcpMon: [19, 18], mcpSmall: [19, 18], mcpKnob: 28, mcpThumb: [8, 10], mcpFaderW: 8,
  envBtn: [20, 18], envKnob: 18, trans: [17, 17], tap: [32, 17], menu: [19, 18], toolbar: 30,
};

/**
 * The theme parameters Live's ⌘⌥I / ⌘⌥S / ⌘⌥M flip, with their defaults. In/Out starts hidden, as in
 * Live: the 216 px header is the name field and the mixer part (the profile's ruler height gives the
 * main toolbar above the headers three rows, so it fits that width).
 */
const PARAMS: [string, string, number][] = [["k_io", "Track headers: show In/Out", 0], ["k_sends", "Track headers: show Sends", 0], ["k_nomix", "Track headers: hide the mixer part", 0]];

/** Header columns from the panel's right edge (Live 9 at 100 %): divider, activator / volume, S / pan, arm, meter. */
const DIV = -123, ACT = -118, SOLO = -66, ARM = -40, METER = -13;
/** The In/Out section's width (with its divider) and its choosers' width. */
const IOW = 75, IOC = 66;
/** The I/O choosers' left edge. */
const IOX = DIV - IOW + 4;
/** Narrowest header that fits In/Out as its own column (Live's name field + In/Out + mixer); narrower ones stack it under the name. */
const IO_COLUMN = 93 + 2 + IOW - 2 + 123;

/** A filled custom element (no image). */
function block(w: Script, name: string, rect: string, color: string) {
  w.custom(name);
  w.set(name, rect);
  w.set(`${name}.color`, color);
}

/** The track colour for the name field, or a Live hue by track number when the track has none. */
function nameColor(w: Script): string {
  // kTI = the track number folded into 1..8.
  w.set("kTI", "trackidx");
  for (let i = 0; i < 24; i++) w.set("kTI", `kTI{0}>${FALLBACK.length} - kTI [${FALLBACK.length}] kTI`);
  const chain = FALLBACK.map((c, i) => `kTI{0}==${i + 1} ${fill(c)}`).join(" ");
  return `?trackcolor_valid ${TRACK_FILL} ${chain} ${fill(FALLBACK[0]!)}`;
}

/**
 * Volume as Live's number box with the orange level fill. The fader element is twice the box wide;
 * its background is orange and its thumb (one box wide, field grey) slides from the box onto the pan
 * box, so the orange shows from the left edge up to the level. The pan box, a gap patch and a frame
 * (all in front) cover the part of the fader to the right of the box.
 */
function volPan(k: Kit, w: Script, X: "tcp" | "master.tcp", y: number, show: string) {
  const c = k.c, bw = 47, gap = SOLO - ACT - bw;
  const vol = w.p(W(ACT), y, 2 * bw, BH), box = w.p(W(ACT), y, bw, BH), pan = w.p(W(SOLO), y, bw, BH), gapR = w.p(W(ACT + bw), y, gap, BH);
  const on = (r: string) => `${show} ${r} [0]`;
  w.set(`${X}.volume`, on(vol));
  w.set(`${X}.volume.fadermode`, "[-1]");
  w.set(`${X}.volume.label`, on(box));
  w.set(`${X}.pan`, on(pan));
  w.set(`${X}.pan.fadermode`, "[-1]");
  w.set(`${X}.pan.label`, on(pan));
  for (const el of [`${X}.volume.label`, `${X}.pan.label`]) {
    w.set(`${el}.color`, fg(c.text));
    w.set(`${el}.font`, w.font("value"));
    w.set(`${el}.margin`, CENTER);
  }
  block(w, `${X}.custom.kGap`, on(gapR), X === "tcp" ? `?track_selected ${fill(c.trackSel)} ${fill(c.track)}` : fill(c.track));
  w.custom(`${X}.custom.kVolFrame`, "k_frame");
  w.set(`${X}.custom.kVolFrame`, on(box));
  w.raw(`front ${X}.pan ${X}.custom.kGap ${X}.custom.kVolFrame ${X}.volume.label ${X}.pan.label`);
}

/** Live's fold ring under REAPER's (see-through) envelope button: ▶ on a folded track, ▼ otherwise. */
function foldRing(w: Script, X: "tcp" | "master.tcp") {
  const folded = w.n(ry(0) + BH + 6);
  w.custom(`${X}.custom.kFoldR`, "k_fold_r");
  w.set(`${X}.custom.kFoldR`, `h<${folded} ${X}.env [0]`);
  w.custom(`${X}.custom.kFoldD`, "k_fold_d");
  w.set(`${X}.custom.kFoldD`, `h<${folded} [0] ${X}.env`);
  w.raw(`front ${X}.custom.kFoldR ${X}.custom.kFoldD ${X}.env`);
}

/**
 * Header columns: kIO = In/Out shown as Live's own column (a wide header; on a narrower one it stacks
 * under the name), kNW = how much narrower than the panel the name column is; and the 2 px dividers.
 */
function columns(w: Script, X: "tcp" | "master.tcp") {
  w.set("kIO", `k_io==1 w<${w.n(IO_COLUMN)} [0] [1] [0]`);
  w.set("kNW", `kIO{0}==1 [0 0 ${w.n(DIV - IOW)} 0] [0 0 ${w.n(DIV)} 0]`);
  block(w, `${X}.custom.kDiv`, w.p(W(DIV), 0, 2, H(-2)), fill(DIVIDER));
  block(w, `${X}.custom.kDivIO`, `kIO{0}==1 ${w.p(W(DIV - IOW), 0, 2, H(-2))} [0]`, fill(DIVIDER));
}

function tcp(k: Kit, w: Script) {
  const z = SIZES, c = k.c;
  if (w.s === 1) for (const [name, desc, def] of PARAMS) w.raw(`define_parameter "${name}" "${desc}" ${def} 0 1`);
  columns(w, "tcp");
  // Name field: the first row of the name column, in the track colour.
  block(w, "tcp.custom.kName", `+ ${w.p(0, 0, W(), ROW)} kNW`, nameColor(w));
  // Column dividers (2 px), full height.
  // Fold button at the left of the name: Live's ring, ▼ on an unfolded track, ▶ on a folded (one-row)
  // one. REAPER's envelope button lies on it, see-through, and opens the automation menu. A group
  // (folder) also gets REAPER's fold for its tracks in front of it.
  w.set("tcp.foldercomp", `folderstate==1 ${w.at(5, ry(0), z.tcpSmall)} [0]`);
  w.set("tcp.env", `folderstate==1 ${w.at(21, ry(0), z.tcpSmall)} ${w.at(5, ry(0), z.tcpSmall)}`);
  foldRing(w, "tcp");
  w.set("kLX", `folderstate==1 [${w.n(39)}] [${w.n(24)}]`);
  w.set("tcp.label", `- + + [kLX{0} 0 w ${w.n(ROW)}] kNW [0 0 ${w.n(-2)} 0] [0 0 kLX{0} 0]`);
  w.set("tcp.label.margin", `[0 0 ${w.n(4)} 0 0]`);
  w.set("tcp.label.font", w.font("label"));
  w.set("tcp.label.color", `?trackcolor_valid ${ON_COLOR} [${rgb(c.text)}]`);
  w.raw("front tcp.label");
  // Row 1 under the name: the device chooser (FX), Live's chooser box.
  w.set("tcp.fx", `h<${w.n(ry(1) + BH + 2)} [0] ${w.at(5, ry(1), z.tcpFx)}`);

  // Mixer section, row 0: the activator with the track number in it, S, arm. REAPER gives clicks on
  // the number to the number, so it is a narrow strip in the middle; the rest of the box is the switch.
  w.set("tcp.mute", w.at(W(ACT), ry(0), z.tcpMute));
  w.set("tcp.trackidx", w.p(W(ACT + 14), ry(0), 19, BH));
  w.set("tcp.trackidx.color", fg(c.text));
  w.set("tcp.trackidx.font", w.font(5));
  w.set("tcp.trackidx.margin", CENTER);
  w.raw("front tcp.trackidx");
  w.set("tcp.solo", w.at(W(SOLO), ry(0), z.tcpBtn));
  w.set("tcp.recarm", w.at(W(ARM), ry(0), z.tcpBtn));
  // The meter: two thin channels down the whole header.
  w.set("tcp.meter", w.p(W(METER), 2, 9, H(-4)));
  meterLook(w, "tcp.meter", k, { scale: false, readout: false });
  w.set("tcp.meter.vu.div", "[1]");
  // Row 1: volume (orange level fill) and pan boxes, unless the mixer part is hidden.
  volPan(k, w, "tcp", ry(1), `k_nomix==1 [0] h<${w.n(ry(1) + BH + 2)} [0]`);
  // Rows 2+: sends (⌘⌥S).
  w.set("tcp.sendlist", `k_sends==1 h>${w.n(ry(2) + BH + 2)} ${w.p(W(ACT), ry(2), 99, H(-ry(2) - 4))} [0]`);

  // In/Out section (⌘⌥I): input chooser, record mode, monitoring (In / Auto / Off), output; the folder
  // button. As its own column on a wide header; on a narrow one: input, monitoring and output under
  // the device chooser (record mode and the folder button stay in the track's menu).
  const fits = (r: number) => `h>${w.n(ry(r) + BH + 1)}`;
  const io = (col: string, narrow = "[0]") => `k_io==1 kIO{0}==1 ${col} ${narrow} [0]`;
  w.set("tcp.recinput", io(`${fits(0)} ${w.p(W(IOX), ry(0), IOC, BH)} [0]`, `${fits(2)} ${w.p(5, ry(2), z.tcpFx[0], BH)} [0]`));
  w.set("tcp.recmode", io(`${fits(1)} ${w.at(W(IOX), ry(1), [IOC, BH])} [0]`));
  w.set("tcp.recmon", io(`${fits(2)} ${w.at(W(IOX), ry(2), [IOC, BH])} [0]`, `${fits(3)} ${w.at(5, ry(3), [IOC, BH])} [0]`));
  w.set("tcp.io", io(`${fits(3)} ${w.at(W(IOX), ry(3), [IOC, BH])} [0]`, `${fits(4)} ${w.at(5, ry(4), [IOC, BH])} [0]`));
  w.set("tcp.folder", io(`${fits(4)} ${w.at(W(IOX), ry(4), z.tcpSmall)} [0]`));
  w.set("tcp.recinput.color", fg(c.text));
  w.set("tcp.recinput.font", w.font("list"));
  w.set("tcp.recinput.margin", `[${w.n(3)} 0 ${w.n(13)} 0 0]`);
}

function masterTcp(k: Kit, w: Script) {
  const z = SIZES, c = k.c;
  // Live's master has no colour in its name field: the name on the plain header.
  columns(w, "master.tcp");
  w.set("master.tcp.env", w.at(5, ry(0), z.tcpSmall));
  foldRing(w, "master.tcp");
  w.set("master.tcp.label", `+ ${w.p(24, 0, W(-26), ROW)} kNW`);
  w.set("master.tcp.label.margin", `[0 0 0 0 0]`);
  w.set("master.tcp.label.font", w.font("label"));
  w.set("master.tcp.label.color", `[${rgb(c.text)}]`);
  w.raw("front master.tcp.label");
  w.set("master.tcp.fx", `h<${w.n(ry(1) + BH + 2)} [0] ${w.at(5, ry(1), z.tcpFx)}`);
  // Output chooser: top of the In/Out column, or under the device chooser on a narrow header.
  w.set("master.tcp.io", `kIO{0}==1 ${w.at(W(IOX), ry(0), [IOC, BH])} h<${w.n(ry(2) + BH + 2)} [0] ${w.at(5, ry(2), [IOC, BH])}`);
  // Volume and pan boxes in the activator / S row, as on Live's master.
  volPan(k, w, "master.tcp", ry(0), "w<0 [0]");
  w.set("master.tcp.meter", w.p(W(METER), 2, 9, H(-4)));
  meterLook(w, "master.tcp.meter", k, { scale: false, readout: false });
  w.set("master.tcp.meter.vu.div", "[1]");
}

/** dB marks beside the mixer meter, with the image each uses. */
const MARKS: [number, string][] = [[6, "k_sc_p6"], [0, "k_sc_0"], [-6, "k_sc_6"], [-12, "k_sc_12"], [-18, "k_sc_18"], [-24, "k_sc_24"], [-30, "k_sc_tick"], [-36, "k_sc_36"], [-42, "k_sc_tick"], [-48, "k_sc_48"], [-54, "k_sc_tick"]];

/**
 * Live's session-view strip: the name on top, then FX / routing / automation / monitoring, the sends
 * and inserts (extended mixer), and the main section: a left column with the volume box and pan knob
 * at the top and the activator (with the track number), solo and arm at the bottom; on the right the
 * volume marker, the meter and a dB scale.
 *
 * REAPER's meter runs linearly in dB from `meter` max (top) to min (bottom), so the scale marks are
 * placed at (max − dB) / (max − min) of the meter's height.
 */
function mcp(k: Kit, w: Script, { master, range }: { master: boolean; range: MeterRange }) {
  const z = SIZES, c = k.c;
  const X = master ? "master.mcp" : "mcp";
  w.custom(`${X}.custom.kName`);
  w.set(`${X}.custom.kName`, w.p(0, 0, W(), 20));
  w.set(`${X}.custom.kName.color`, master ? fill(c.face) : nameColor(w));
  w.set(`${X}.label`, `${X}.custom.kName`);
  w.set(`${X}.label.margin`, `[${w.n(4)} 0 ${w.n(4)} 0 0]`);
  w.set(`${X}.label.font`, w.font("label"));
  w.set(`${X}.label.color`, master ? `[${rgb(c.text)}]` : `?trackcolor_valid ${ON_COLOR} [${rgb(c.text)}]`);
  const [sw] = z.mcpSmall;
  w.set(`${X}.fx`, w.at(4, 23, z.mcpSmall));
  w.set(`${X}.io`, w.at(4 + sw, 23, z.mcpSmall));
  w.set(`${X}.env`, w.at(4 + 2 * sw, 23, z.mcpSmall));
  if (master) w.set("master.mcp.menubutton", w.at(4 + 3 * sw, 23, z.menu));
  else w.set("mcp.recmon", w.at(4 + 3 * sw, 23, z.mcpMon));
  const T = 44;
  extMixer(w, X, T);
  // Left column, top: volume box and pan knob.
  w.custom(`${X}.custom.kDb`, "k_valuebox");
  w.set(`${X}.custom.kDb`, `+ kE ${w.p(3, T + 4, 42, 16)}`);
  w.set(`${X}.volume.label`, `+ kE ${w.p(3, T + 4, 42, 16)}`);
  w.set(`${X}.pan`, `+ kE ${w.p(10, T + 26, z.mcpKnob, z.mcpKnob)}`);
  // Left column, bottom: activator (number inside), solo, arm (master: mono).
  // Live's Session strip: a square activator, S and arm under it, centred in the left column.
  w.set(`${X}.mute`, w.at(12, H(-60), z.mcpMute));
  if (!master) {
    w.set("mcp.trackidx", w.p(12, H(-60), 24, 21));
    w.set("mcp.trackidx.color", fg(c.text));
    w.set("mcp.trackidx.font", w.font(5));
    w.set("mcp.trackidx.margin", CENTER);
    w.raw("front mcp.trackidx");
  }
  w.set(`${X}.solo`, w.at(12, H(-34), z.mcpBtn));
  if (master) w.set("master.mcp.mono", w.at(12, H(-17), z.mcpArm));
  else w.set("mcp.recarm", w.at(12, H(-17), z.mcpArm));
  // Right: volume marker | meter | scale, all over the same height.
  const top = T + 4, bot = 4;
  const [tw, th] = z.mcpThumb;
  w.set(`${X}.volume`, `+ kE2 ${w.p(47, top - th / 2, tw, H(-(top + bot) + th))}`);
  w.set(`${X}.meter`, `+ kE2 ${w.p(56, top, 12, H(-(top + bot)))}`);
  meterLook(w, `${X}.meter`, k, { scale: false, readout: false });
  const span = range.max - range.min;
  MARKS.forEach(([db, image], i) => {
    if (db > range.max || db < range.min) return;
    const f = (range.max - db) / span;
    const name = `${X}.custom.kSc${i}`;
    w.custom(name, image);
    w.set(name, `+ * ${+(1 - f).toFixed(4)} kE ${w.p(68, H(top - f * (top + bot) - SCALE_H / 2, +f.toFixed(4)), SCALE_W, SCALE_H)}`);
  });
}

/** Control bar height and its fields' top (Live 9: 17 px fields in a 28 px bar). */
const BAR = 28, FY = 5, FH = 17;
/**
 * The position field (85 px). REAPER shrinks the position text in a narrow element and paints the
 * element's own background, so the element starts STATUS_PAD further left; transport_status_bg draws
 * the field in its right part.
 */
const STATUS_W = 85, STATUS_PAD = 90, STATUS_TEXT = 300;

/**
 * Live's Control Bar: TAP | tempo | signature on the left; position, ▶ ■ ● and automation arm in the
 * middle (from 30 % of the width); the loop switch and the loop / selection fields from 57 %.
 */
function trans(_k: Kit, w: Script) {
  const z = SIZES;
  const [bw, bh] = z.trans;
  w.set("trans.size", `[${w.n(1000)} ${w.n(BAR)}]`);
  w.set("trans.size.minmax", `[${w.n(300)} ${w.n(BAR)} ${w.n(4000)} ${w.n(144)}]`);
  w.set("trans.size.dockedheight", `[${w.n(BAR)}]`);
  // TAP: REAPER's tap button in our art (transport_tap); its own label is hidden.
  w.set("trans.bpm.tap", w.at(9, FY, z.tap));
  w.set("trans.bpm.tap.color", fg(BLACK, 0));
  const tempo = w.p(44, FY, 54, FH);
  transDisplay(w, "Tempo", tempo);
  w.set("trans.bpm.edit", tempo);
  w.set("trans.bpm.edit.font", w.font("tempo"));
  // The signature draws its own field 3 px inside its rect.
  w.set("trans.curtimesig", `trans_flags&4 ${w.p(98, FY - 3, 48, FH + 6)} [0]`);
  // Middle: position, then play, stop, record; automation arm after a gap.
  const mid = (dx: number) => W(dx, 0.3);
  // Position: our field; REAPER's text gets the bar's full height (it shrinks its font in a short box).
  // REAPER sizes this text to its element's width, so the element runs left of our field and the
  // text sits right-aligned in the field.
  w.set("trans.status", `w<${w.n(560)} [0] ${w.p(mid(-STATUS_PAD), 0, STATUS_PAD + STATUS_W, BAR)}`);
  w.set("trans.status.font", w.font("status"));
  // REAPER sizes the position text to its text box, by width and by height: a negative right margin
  // makes the box STATUS_TEXT wide (the digits still start inside the field and end well before its
  // edge), and 4 px top and bottom give Live's 10 px digits.
  w.set("trans.status.margin", `[${w.n(STATUS_PAD + 6)} ${w.n(4)} ${-w.n(STATUS_TEXT - (STATUS_W - 6))} ${w.n(4)} 0]`);
  const order: [string, number][] = [["trans.play", 88], ["trans.stop", 107], ["trans.rec", 126], ["trans.automode", 152]];
  for (const [name, dx] of order) w.set(name, w.p(mid(dx), FY, bw, bh));
  // Right: the loop switch, then the loop / selection fields.
  const right = (dx: number) => W(dx, 0.57);
  w.set("trans.repeat", `w<${w.n(760)} [0] ${w.p(right(0), FY, 28, bh)}`);
  const sel = `w<${w.n(760)} [0] ${w.p(right(31), FY, 232, FH)}`;
  w.set("trans.sel", sel);
  w.set("trans.sel.margin", `[${w.n(4)} 0 ${w.n(4)} 0 0.5]`);
}

// ---------------------------------------------------------------- artwork

/** A few capitals the shared stroke font lacks (E, R, D, V, C), drawn the same way. */
type Letter = { w: number; draw: (x: number, y: number, w: number, h: number, r: number) => SDF };
const at = (x: number, y: number, w: number, h: number, r: number) => (pts: [number, number][]) =>
  pts.map(([a, b]) => [x + r + a * (w - 2 * r), y + r + b * (h - 2 * r)] as [number, number]);
const MORE: Record<string, Letter> = {
  E: { w: 0.5, draw: (x, y, w, h, r) => union(polyline(at(x, y, w, h, r)([[1, 0], [0, 0], [0, 1], [1, 1]]), r), polyline(at(x, y, w, h, r)([[0, 0.5], [0.85, 0.5]]), r)) },
  R: { w: 0.58, draw: (x, y, w, h, r) => union(polyline(at(x, y, w, h, r)([[0, 1], [0, 0], [0.7, 0], [1, 0.14], [1, 0.38], [0.7, 0.52], [0, 0.52]]), r), polyline(at(x, y, w, h, r)([[0.5, 0.52], [1, 1]]), r)) },
  D: { w: 0.62, draw: (x, y, w, h, r) => polyline(at(x, y, w, h, r)([[0, 0], [0.55, 0], [0.9, 0.16], [1, 0.5], [0.9, 0.84], [0.55, 1], [0, 1], [0, 0]]), r) },
  V: { w: 0.64, draw: (x, y, w, h, r) => polyline(at(x, y, w, h, r)([[0, 0], [0.5, 1], [1, 0]]), r) },
  C: { w: 0.6, draw: (x, y, w, h, r) => polyline(at(x, y, w, h, r)([[1, 0.12], [0.75, 0], [0.3, 0], [0.04, 0.2], [0, 0.5], [0.04, 0.8], [0.3, 1], [0.75, 1], [1, 0.88]]), r) },
};

const CAPS_WEIGHT = 0.15, CAPS_SPACING = 0.2;
const capsWidths = (str: string, u: number) => [...str].map((ch) => (MORE[ch] ? MORE[ch]!.w * u : ch === " " ? u * 0.4 : I.textWidth(ch, u, CAPS_WEIGHT, CAPS_SPACING)));
/** A capitals word's width at cap height u. */
function capsWidth(str: string, u: number): number {
  const r = Math.max((u * CAPS_WEIGHT) / 2, 0.5);
  return capsWidths(str, u).reduce((a, b) => a + b, 0) + (u * CAPS_SPACING + r) * (str.length - 1);
}

/** A capitals word (u = cap height), centred on (cx, cy). */
function caps(str: string, cx: number, cy: number, u: number): SDF {
  const weight = CAPS_WEIGHT, spacing = CAPS_SPACING;
  const r = Math.max((u * weight) / 2, 0.5);
  const gap = u * spacing + r;
  const widths = capsWidths(str, u);
  let x = cx - (widths.reduce((a, b) => a + b, 0) + gap * (str.length - 1)) / 2;
  const parts: SDF[] = [];
  [...str].forEach((ch, i) => {
    const wd = widths[i]!;
    if (MORE[ch]) parts.push(MORE[ch]!.draw(x, cy - u / 2, wd, u, r));
    else if (ch !== " ") parts.push(I.text(ch, x + wd / 2, cy, u, weight, spacing));
    x += wd + gap;
  });
  return parts.length ? union(...parts) : () => 1e9;
}

/** Live's hairline: one device pixel at 100 / 150 %, two at 200 %. */
const hair = (s: number) => Math.max(1, Math.floor(s)) / s;

/** Live's flat control: a fill and a 1px edge; hover a touch lighter, pressed a touch darker. */
function ctl(w: number, h: number, body: RGB, glyph: ArtGlyph, ink: RGB, edge: RGB = EDGE): Draw {
  return scaled((s) => hstack(([0, 1, 2] as Frame[]).map((f) => {
    const cv = new Canvas(w, h, s);
    const shape = rect(0, 0, w, h);
    cv.fill(shape, solid(f === 1 ? lighten(body, 0.1) : f === 2 ? darken(body, 0.08) : body));
    cv.fill(outline(shape, hair(s)), solid(edge));
    if (glyph) cv.fill(glyph(w / 2, h / 2 + (f === 2 ? 0.5 / s : 0)), solid(ink));
    return bitmap(cv);
  })));
}

/** A chooser: Live's light text field with a black ▼ at the right, optionally a word at the left. */
function chooser(w: number, h: number, label: string, ink: RGB, body: RGB = FIELD): Draw {
  const u = Math.round(h * 0.46);
  const g: ArtGlyph = (cx, cy) => {
    const ax = cx + w / 2 - 6, tri = poly([[ax - 3.5, cy - 2], [ax + 3.5, cy - 2], [ax, cy + 2.5]]);
    return label ? union(caps(label, cx - w / 2 + 4 + capsWidth(label, u) / 2, cy, u), tri) : tri;
  };
  return ctl(w, h, body, g, ink);
}

/** Live's fold button: a light disc with a black ring and a black triangle (down = open, right = folded). */
function foldBtn(k: Kit, d: number, dir: "down" | "right", ink: RGB = k.c.text): Draw {
  return scaled((s) => hstack(([0, 1, 2] as Frame[]).map((f) => {
    const cv = new Canvas(d, d, s);
    const cx = d / 2, cy = d / 2, r = d / 2 - 0.5 / s;
    cv.fill(circle(cx, cy, r), solid(f === 1 ? hex("#c8c8c8") : f === 2 ? hex("#9c9c9c") : hex("#b4b4b4")));
    cv.fill(outline(circle(cx, cy, r), hair(s)), solid(BLACK));
    const a = d * 0.24;
    const tri = dir === "down"
      ? poly([[cx - a, cy - a * 0.55], [cx + a, cy - a * 0.55], [cx, cy + a * 0.85]])
      : poly([[cx - a * 0.55, cy - a], [cx + a * 0.85, cy], [cx - a * 0.55, cy + a]]);
    cv.fill(tri, solid(ink));
    return bitmap(cv);
  })));
}

/** The fold ring as one frame (for a custom element). */
function foldRing1(d: number, dir: "down" | "right"): Draw {
  return scaled((s) => {
    const cv = new Canvas(d, d, s);
    const cx = d / 2, cy = d / 2, r = d / 2 - 0.5 / s;
    cv.fill(circle(cx, cy, r), solid(hex("#b4b4b4")));
    cv.fill(outline(circle(cx, cy, r), hair(s)), solid(BLACK));
    const a = d * 0.24;
    const tri = dir === "down"
      ? poly([[cx - a, cy - a * 0.55], [cx + a, cy - a * 0.55], [cx, cy + a * 0.85]])
      : poly([[cx - a * 0.55, cy - a], [cx + a * 0.85, cy], [cx - a * 0.55, cy + a]]);
    cv.fill(tri, solid(BLACK));
    return bitmap(cv);
  });
}

/** Monitoring as Live's three switches In | Auto | Off, the active one yellow. */
function monitor(k: Kit, w: number, h: number, lit: 0 | 1 | 2): Draw {
  // Three switches sharing their hairlines.
  const parts: [string, number, number][] = [["IN", 0, 19], ["AUTO", 18, 28], ["OFF", 45, w - 45]];
  return scaled((s) => hstack(([0, 1, 2] as Frame[]).map((f) => {
    const cv = new Canvas(w, h, s);
    parts.forEach(([label, x, pw], i) => {
      const shape = rect(x, 0, pw, h);
      const body = i === lit ? k.c.accent : BUTTON;
      cv.fill(shape, solid(f === 1 ? lighten(body, 0.1) : body));
      cv.fill(outline(shape, hair(s)), solid(EDGE));
      cv.fill(caps(label, x + pw / 2, h / 2, Math.round(h * 0.42)), solid(k.c.text));
    });
    return bitmap(cv);
  })));
}

/** A stretchable box: fill (alpha) and a 1px edge; `g` = guide size. */
function boxImg(body: RGB | null, edge: RGB | null, g = 2, w = 12, h = 12): Draw {
  return (s) => {
    const cv = new Canvas(w, h, s);
    if (body) cv.fill(rect(0, 0, w, h), solid(body));
    if (edge) cv.fill(outline(rect(0, 0, w, h), hair(s)), solid(edge));
    const p = Math.ceil(g * s);
    return withGuides(bitmap(cv), p, p, p, p);
  };
}

/** Live's control-bar field: grey with a light edge (stretchable). */
const barField = (): Draw => boxImg(BUTTON, BAR_EDGE);

/**
 * Clip background, drawn over REAPER's item colour and under the notes / peaks: the title strip
 * stays clear so the clip colour shows, with Live's black hairline round it; the body is covered
 * (Live 9 draws the contents straight on the track; selected: Live's cyan).
 */
const TITLE = 15;
function clipBg(body: RGB, alpha = 1): Draw {
  return (s) => {
    const w = 20, h = TITLE + 12;
    const cv = new Canvas(w, h, s);
    cv.fill(rect(0, TITLE, w, h - TITLE), solid(body, alpha));
    cv.fill(outline(rect(0, 0, w, TITLE), hair(s)), solid(BLACK));
    const g = Math.ceil(2 * s);
    return withGuides(bitmap(cv), g, Math.round(TITLE * s) + 1, g, g);
  };
}

/** Transport button on Live's control bar: grey, light edge; the glyph black (or coloured when lit). */
const tbtn = (g: (cx: number, cy: number, u: number) => SDF, ink: RGB, body: RGB = BUTTON, w = SIZES.trans[0], h = SIZES.trans[1]): Draw =>
  ctl(w, h, body, icon(g, h * 0.46), ink, BAR_EDGE);

/** Live's loop switch glyph: a bracket loop with an arrow. */
const loopGlyph = (cx: number, cy: number, u: number): SDF => union(
  polyline([[cx - u * 0.1, cy + u * 0.34], [cx - u * 0.55, cy + u * 0.34], [cx - u * 0.55, cy - u * 0.34], [cx + u * 0.55, cy - u * 0.34], [cx + u * 0.55, cy + u * 0.1]], Math.max(u * 0.07, 0.6)),
  poly([[cx - u * 0.1, cy + u * 0.14], [cx - u * 0.1, cy + u * 0.54], [cx - u * 0.34, cy + u * 0.34]]),
);
/** Automation arm: two linked dots. */
const autoGlyph = (cx: number, cy: number, u: number): SDF => union(circle(cx - u * 0.3, cy + u * 0.18, u * 0.2), circle(cx + u * 0.32, cy - u * 0.18, u * 0.16), capsule(cx - u * 0.3, cy + u * 0.18, cx + u * 0.32, cy - u * 0.18, Math.max(u * 0.06, 0.55)));

// ---------------------------------------------------------------- toolbar glyphs (u ≈ 16)

const st = (u: number) => Math.max(u * 0.065, 0.7);
const line = (ax: number, ay: number, bx: number, by: number, u: number) => capsule(ax, ay, bx, by, st(u));
const box = (x: number, y: number, w: number, h: number, u: number) => outline(rect(x, y, w, h), st(u) * 2);
const chev = (cx: number, cy: number, u: number, dx: number, dy: number) => polyline([[cx - dy * u - dx * u * 0.5, cy - dx * u - dy * u * 0.5], [cx, cy], [cx + dy * u - dx * u * 0.5, cy + dx * u - dy * u * 0.5]], st(u * 1.3));

const GLYPHS: Record<string, (cx: number, cy: number, u: number) => SDF> = {
  metro: I.tb.metro!,
  // Follow: a page with an arrow running into the playhead line.
  follow: (cx, cy, u) => union(line(cx - u * 0.46, cy, cx + u * 0.14, cy, u), poly([[cx + u * 0.02, cy - u * 0.2], [cx + u * 0.3, cy], [cx + u * 0.02, cy + u * 0.2]]), line(cx + u * 0.42, cy - u * 0.42, cx + u * 0.42, cy + u * 0.42, u)),
  // Draw mode: a pencil.
  draw: (cx, cy, u) => union(capsule(cx - u * 0.18, cy + u * 0.18, cx + u * 0.3, cy - u * 0.3, u * 0.12), poly([[cx - u * 0.44, cy + u * 0.44], [cx - u * 0.32, cy + u * 0.12], [cx - u * 0.12, cy + u * 0.32]])),
  // Computer MIDI keyboard: a small keyboard.
  keys: (cx, cy, u) => union(box(cx - u * 0.48, cy - u * 0.3, u * 0.96, u * 0.6, u), ...[-0.16, 0.16].map((d) => line(cx + u * d, cy - u * 0.3, cx + u * d, cy + u * 0.3, u)), ...[-0.32, 0, 0.32].map((d) => rect(cx + u * d - u * 0.06, cy - u * 0.3, u * 0.12, u * 0.3))),
  snap: I.tb.snap!,
  narrow: (cx, cy, u) => union(line(cx - u * 0.1, cy - u * 0.42, cx - u * 0.1, cy + u * 0.42, u), line(cx + u * 0.1, cy - u * 0.42, cx + u * 0.1, cy + u * 0.42, u), chev(cx - u * 0.26, cy, u * 0.2, 1, 0), chev(cx + u * 0.26, cy, u * 0.2, -1, 0)),
  widen: (cx, cy, u) => union(line(cx - u * 0.18, cy - u * 0.42, cx - u * 0.18, cy + u * 0.42, u), line(cx + u * 0.18, cy - u * 0.42, cx + u * 0.18, cy + u * 0.42, u), chev(cx - u * 0.36, cy, u * 0.2, -1, 0), chev(cx + u * 0.36, cy, u * 0.2, 1, 0)),
  triplet: (cx, cy, u) => union(I.text("3", cx, cy + u * 0.16, u * 0.56), polyline([[cx - u * 0.42, cy - u * 0.14], [cx - u * 0.42, cy - u * 0.36], [cx + u * 0.42, cy - u * 0.36], [cx + u * 0.42, cy - u * 0.14]], st(u))),
  loopsel: (cx, cy, u) => union(I.loop(cx, cy + u * 0.12, u * 0.62), rect(cx - u * 0.46, cy - u * 0.46, u * 0.92, u * 0.14)),
  punch: (cx, cy, u) => union(polyline([[cx - u * 0.18, cy - u * 0.4], [cx - u * 0.42, cy - u * 0.4], [cx - u * 0.42, cy + u * 0.4], [cx - u * 0.18, cy + u * 0.4]], st(u)), polyline([[cx + u * 0.18, cy - u * 0.4], [cx + u * 0.42, cy - u * 0.4], [cx + u * 0.42, cy + u * 0.4], [cx + u * 0.18, cy + u * 0.4]], st(u)), circle(cx, cy, u * 0.16)),
  // Capture MIDI: an arrow dropping into a tray.
  capture: (cx, cy, u) => union(polyline([[cx - u * 0.42, cy + u * 0.1], [cx - u * 0.42, cy + u * 0.42], [cx + u * 0.42, cy + u * 0.42], [cx + u * 0.42, cy + u * 0.1]], st(u)), line(cx, cy - u * 0.44, cx, cy + u * 0.06, u), poly([[cx - u * 0.2, cy - u * 0.04], [cx + u * 0.2, cy - u * 0.04], [cx, cy + u * 0.22]])),
  mixer: (cx, cy, u) => union(...[-0.3, 0, 0.3].flatMap((d, i) => [line(cx + u * d, cy - u * 0.42, cx + u * d, cy + u * 0.42, u), rect(cx + u * d - u * 0.11, cy + u * [0.1, -0.2, 0.22][i]! - u * 0.06, u * 0.22, u * 0.12)])),
  // Detail View: a window with its bottom part filled; Browser: its left part filled.
  detail: (cx, cy, u) => union(box(cx - u * 0.46, cy - u * 0.4, u * 0.92, u * 0.8, u), rect(cx - u * 0.46, cy + u * 0.08, u * 0.92, u * 0.32)),
  browser: (cx, cy, u) => union(box(cx - u * 0.46, cy - u * 0.4, u * 0.92, u * 0.8, u), rect(cx - u * 0.46, cy - u * 0.4, u * 0.3, u * 0.8)),
  fold: (cx, cy, u) => union(...[-0.06, 0.06].map((d) => line(cx - u * 0.42, cy + u * d, cx + u * 0.42, cy + u * d, u)), chev(cx, cy - u * 0.24, u * 0.18, 0, 1), chev(cx, cy + u * 0.24, u * 0.18, 0, -1)),
  unfold: (cx, cy, u) => union(...[-0.42, 0.42].map((d) => line(cx - u * 0.42, cy + u * d, cx + u * 0.42, cy + u * d, u)), chev(cx, cy - u * 0.12, u * 0.18, 0, -1), chev(cx, cy + u * 0.12, u * 0.18, 0, 1)),
  quantize: I.tb.quant!,
};

const toolbarGlyphs: Record<string, Glyph> = Object.fromEntries(Object.entries(GLYPHS).map(([n, g]) => [`assist_ableton_${n}`, g]));

const ableton: KitDef = {
  id: "ableton",
  palette,
  sizes: SIZES,
  mcpWidth: { track: 84, master: 84 },
  fonts: { label: 1, value: 2, list: 3, tempo: 4, sig: 4, status: 4 },
  // Live 9's UI font is a small, clean sans; Verdana / Tahoma are its closest match on both systems.
  // Track names (headers and mixer strips): bold italic, as in Live; clip names stay upright.
  faces: {
    slots: {
      1: { face: "Verdana", px: 11, weight: 700, italic: true },
      2: { face: "Tahoma", px: 10 },
      3: { face: "Tahoma", px: 10 },
      4: { face: "Verdana", px: 11, weight: 700 },
      5: { face: "Verdana", px: 10, weight: 700 },
    },
    ruler: { face: "Verdana", px: 10 },
    transport: { face: "Verdana", px: 11, weight: 700 },
    items: { face: "Verdana", px: 10, weight: 700 },
    volpan: { face: "Tahoma", px: 10 },
    title: { face: "Verdana", px: 10, weight: 700 },
  },
  // Live: a folded track is 17 px plus its divider; a group indents nothing.
  globals: { tcp_heights: "4 19 36 36", tcp_master_minheight: "19", tcp_folderindent: "0" },
  layout: {
    tcp,
    masterTcp,
    mcp,
    trans,
    // Envelope lanes keep a slim slider (the track header's volume slider is a value box).
    envcp: (k, w) => envcp(k, w, { ...SIZES, tcpThumb: [6, 12] }),
  },
  toolbarGlyphs,
  // Live's switches keep black glyphs; a lit one shows by its yellow plate (animation_toolbar_highlight).
  toolbarInk: { normal: "#000000", hover: "#000000", on: "#000000" },
  images(k, out) {
    const c = k.c, z = SIZES;
    const [mw, mh] = z.tcpMute, [bw, bh] = z.tcpBtn;
    // Track activator: yellow while the track plays, grey when it is off (the number is REAPER's text).
    out.track_mute_off = ctl(mw, mh, c.accent, null, c.text);
    out.track_mute_on = ctl(mw, mh, BUTTON, null, c.text);
    // Solo and arm: black ink, also when lit (blue solo, red arm), as in Live.
    const S: ArtGlyph = word("S", 7);
    const dot: ArtGlyph = (cx, cy) => circle(cx, cy, 3.4);
    out.track_solo_off = ctl(bw, bh, BUTTON, S, c.text);
    out.track_solo_on = ctl(bw, bh, c.solo, S, c.text);
    out.track_recarm_off = ctl(bw, bh, BUTTON, dot, c.text);
    out.track_recarm_on = ctl(bw, bh, c.arm, dot, c.text);
    out.track_recarm_norec = ctl(bw, bh, mixc(c.arm, BUTTON, 0.5), dot, c.text);
    const ring: ArtGlyph = (cx, cy) => outline(circle(cx, cy, 3.6), 1.2);
    out.track_recarm_auto = ctl(bw, bh, BUTTON, ring, c.arm);
    out.track_recarm_auto_on = ctl(bw, bh, c.arm, ring, c.text);
    out.track_recarm_auto_norec = ctl(bw, bh, mixc(c.arm, BUTTON, 0.5), ring, c.text);
    // The mixer strip keeps the same look at its own sizes.
    for (const [name, [w0, h0], body, g] of [
      ["mcp_mute_off", z.mcpMute, c.accent, null], ["mcp_mute_on", z.mcpMute, BUTTON, null],
      ["mcp_solo_off", z.mcpBtn, BUTTON, word("S", 8)], ["mcp_solo_on", z.mcpBtn, c.solo, word("S", 8)],
      ["mcp_recarm_off", z.mcpArm, BUTTON, dot], ["mcp_recarm_on", z.mcpArm, c.arm, dot], ["mcp_recarm_norec", z.mcpArm, mixc(c.arm, BUTTON, 0.5), dot],
    ] as [string, [number, number], RGB, ArtGlyph][]) out[name] = ctl(w0, h0, body, g, c.text);

    // Fold buttons: automation (env) and group (folder) fold, Live's ring with a triangle.
    const [sw] = z.tcpSmall;
    // REAPER's envelope button is see-through over our fold ring (k_fold_r / k_fold_d, chosen by height).
    const clear: Draw = (s) => hstack([0, 1, 2].map(() => bitmap(new Canvas(sw, BH, s))));
    out.track_env = clear;
    for (const m of ["read", "touch", "write", "latch", "preview"]) out[`track_env_${m}`] = clear;
    out.k_fold_r = foldRing1(sw, "right");
    out.k_fold_d = foldRing1(sw, "down");
    out.track_fcomp_off = foldBtn(k, sw, "down");
    out.track_fcomp_small = foldBtn(k, sw, "down");
    out.track_fcomp_tiny = foldBtn(k, sw, "right");
    // REAPER's mute / solo marks on meters: Live shows none.
    for (const n of ["meter_mute", "meter_unsolo", "meter_solodim", "meter_automute", "meter_foldermute"]) out[n] = fillImg(c.panel, 0);

    // Choosers: devices (FX), input, record mode, output; monitoring In | Auto | Off.
    const [fw, fh] = z.tcpFx;
    out.track_fx_empty = chooser(fw, fh, "NONE", c.text);
    out.track_fx_norm = chooser(fw, fh, "DEVICES", c.text);
    out.track_fx_dis = chooser(fw, fh, "DEVICES", mixc(c.text, FIELD, 0.55));
    out.master_tcp_fx_empty = out.track_fx_empty;
    out.master_tcp_fx_norm = out.track_fx_norm;
    out.master_tcp_fx_dis = out.track_fx_dis;
    // The input chooser: REAPER's input name in Live's chooser box, ▼ at the right (in the fixed edge).
    out.tcp_recinput = (s) => {
      const w0 = 24, h0 = BH;
      const cv = new Canvas(w0, h0, s);
      cv.fill(rect(0, 0, w0, h0), solid(FIELD));
      cv.fill(outline(rect(0, 0, w0, h0), hair(s)), solid(EDGE));
      const ax = w0 - 6, cy = h0 / 2;
      cv.fill(poly([[ax - 3.5, cy - 2], [ax + 3.5, cy - 2], [ax, cy + 2.5]]), solid(k.c.text));
      return withGuides(bitmap(cv), Math.ceil(2 * s), Math.ceil(2 * s), Math.ceil(12 * s), Math.ceil(2 * s));
    };
    out.track_recmode_in = chooser(IOC, BH, "INPUT", c.text);
    out.track_recmode_out = chooser(IOC, BH, "OUTPUT", c.text);
    out.track_recmode_off = chooser(IOC, BH, "NONE", c.text);
    out.track_monitor_on = monitor(k, IOC, BH, 0);
    out.track_monitor_auto = monitor(k, IOC, BH, 1);
    out.track_monitor_off = monitor(k, IOC, BH, 2);
    for (const sfx of ["", "_r", "_s", "_s_r"]) {
      out[`track_io${sfx}`] = chooser(IOC, BH, "MASTER", c.text);
      out[`track_io${sfx}_dis`] = chooser(IOC, BH, "NONE", c.text);
    }
    out.master_tcp_io = chooser(IOC, BH, "OUTPUT", c.text);
    out.track_folder_off = ctl(sw, BH, BUTTON, null, c.text);
    out.track_folder_on = ctl(sw, BH, c.accent, null, c.text);
    out.track_folder_last = ctl(sw, BH, BUTTON, (cx, cy) => polyline([[cx - 2, cy - 3], [cx - 2, cy + 2], [cx + 3, cy + 2]], 0.7), c.text);

    // Volume: an orange track under a field-grey thumb one box wide (see volPan); pan: a plain box.
    out.tcp_volbg = boxImg(ORANGE, null, 1);
    out.tcp_volthumb = (s) => {
      const [tw, th] = z.tcpThumb;
      const cv = new Canvas(tw, th, s);
      cv.fill(rect(0, 0, tw, th), solid(FIELD));
      return bitmap(cv);
    };
    out.tcp_panbg = boxImg(FIELD, EDGE);
    out.tcp_panthumb = (s) => {
      const cv = new Canvas(5, BH, s);
      cv.fill(poly([[4.5, BH / 2 - 3], [4.5, BH / 2 + 3], [1, BH / 2]]), solid(hex("#e8e8e8")));
      return bitmap(cv);
    };
    out.tcp_widthbg = out.tcp_panbg;
    out.tcp_widththumb = out.tcp_panthumb;
    out.k_frame = boxImg(null, EDGE);
    out.envcp_faderbg = hTrack(k, 12);
    out.envcp_fader = thumb(k, 6, 12, false);
    out.k_valuebox = boxImg(FIELD, EDGE);
    // The mixer volume is a small triangle beside the meter, with no visible track, and a dB scale.
    out.mcp_volbg = fillImg(c.panel, 0);
    out.mcp_volthumb = marker(k, SIZES.mcpThumb[0], SIZES.mcpThumb[1]);
    for (const [name, label] of SCALE_MARKS) out[name] = scaleMark(k, label);

    // Track panels: flat surface, Live's 2 px divider at the bottom; selected: the light highlight.
    const panelImg = (body: RGB): Draw => (s) => {
      const cv = new Canvas(24, 24, s);
      cv.fill(rect(0, 0, 24, 24), solid(body));
      cv.fill(rect(0, 22, 24, 2), solid(DIVIDER));
      return withGuides(bitmap(cv), 2, 2, 2, Math.ceil(2 * s));
    };
    out.tcp_bg = panelImg(c.track);
    out.tcp_bgsel = panelImg(c.trackSel);
    out.tcp_mainbg = out.tcp_bg;
    out.tcp_mainbgsel = out.tcp_bgsel;
    out.tcp_folderbg = out.tcp_bg;
    out.tcp_folderbgsel = out.tcp_bgsel;
    // A selected mixer strip takes the same light highlight as its header, as in Live's Session mixer.
    out.mcp_bgsel = panel(k, c.trackSel, "right", 0);
    out.mcp_mainbgsel = out.mcp_bgsel;
    out.mcp_folderbgsel = out.mcp_bgsel;

    // Clips: the clip colour in the title strip, the body in the lane grey (selected: cyan).
    out.item_bg = clipBg(SURFACE);
    out.item_bg_sel = clipBg(mixc(SELECTION, SURFACE, 0.5));
    // No selection dot on a selected clip: its cyan body is the mark, as in Live.
    out.item_seldot = (s) => bitmap(new Canvas(6, 6, s));

    // Control bar: #767676 with Live's grey, light-edged fields; play lights its triangle green,
    // record its dot red, the loop switch and automation arm fill yellow.
    out.transport_bg = (s) => {
      const cv = new Canvas(24, BAR, s);
      cv.fill(rect(0, 0, 24, BAR), solid(DESKTOP));
      cv.fill(rect(0, BAR - 1, 24, 1), solid(hex("#5c5c5c")));
      return withGuides(bitmap(cv), 2, 2, 2, 2);
    };
    out.k_display = barField();
    out.transport_status_bg = (s) => {
      // Drawn over the bar's own colour and bottom line, so the element's left part matches the bar.
      const cv = new Canvas(STATUS_PAD + STATUS_W, BAR, s);
      cv.fill(rect(0, 0, STATUS_PAD + STATUS_W, BAR), solid(DESKTOP));
      cv.fill(rect(0, BAR - 1, STATUS_PAD + STATUS_W, 1), solid(hex("#5c5c5c")));
      const f = rect(STATUS_PAD, FY, STATUS_W, FH);
      cv.fill(f, solid(BUTTON));
      cv.fill(outline(f, hair(s)), solid(BAR_EDGE));
      return bitmap(cv);
    };
    // REAPER's error state (e.g. no audio device) uses the same field.
    out.transport_status_bg_err = out.transport_status_bg;
    out.transport_edit_bg = barField();
    out.transport_bpm_bg = barField();
    out.transport_group_bg = fillImg(DESKTOP, 0);
    // REAPER 7 draws the tap button with the tempo-basis images (♩ = …); all of them are Live's TAP.
    out.transport_tap = ctl(z.tap[0], z.tap[1], BUTTON, (cx, cy) => caps("TAP", cx, cy, 7), c.text, BAR_EDGE);
    for (const b of ["quarter", "eighth", "half"]) for (const d of ["", "_dotted"]) out[`transport_basis_${b}${d}`] = out.transport_tap;
    out.transport_play = tbtn(I.play, c.text);
    out.transport_play_on = tbtn(I.play, c.play);
    out.transport_play_sync = tbtn(I.play, c.accent2);
    out.transport_play_sync_on = tbtn(I.play, c.play);
    out.transport_stop = tbtn(I.stop, c.text);
    out.transport_pause = tbtn(I.pause, c.text);
    out.transport_pause_on = tbtn(I.pause, c.text, c.accent);
    out.transport_record = tbtn(I.record, c.text);
    out.transport_record_on = tbtn(I.record, c.arm);
    out.transport_record_item = tbtn(I.record, c.text);
    out.transport_record_item_on = tbtn(I.record, c.arm);
    out.transport_record_loop = tbtn(I.record, c.text);
    out.transport_record_loop_on = tbtn(I.record, c.arm);
    out.transport_repeat_off = tbtn(loopGlyph, c.text, BUTTON, 28);
    out.transport_repeat_on = tbtn(loopGlyph, c.text, c.accent, 28);
    out.global_off = tbtn(autoGlyph, c.text);
    out.global_trim = tbtn(autoGlyph, c.text);
    out.global_read = tbtn(autoGlyph, c.text);
    out.global_preview = tbtn(autoGlyph, c.text);
    for (const m of ["touch", "write", "latch"]) out[`global_${m}`] = tbtn(autoGlyph, c.text, c.accent);
    out.global_bypass = tbtn(autoGlyph, c.dim);

    // Main toolbar: Live's control-bar switches. A grey box with a light edge under every icon
    // (lighter on hover, darker pressed); a lit switch is a yellow box. REAPER draws that highlight
    // between the box and the icon as a 12-frame animation (all frames alike here), not its teal glow.
    const TB = z.toolbar, plate = (y: number) => rect(3, y + 3, TB - 6, TB - 6);
    out.toolbar_blank = (s) => hstack(([0, 1, 2] as Frame[]).map((f) => {
      const cv = new Canvas(TB, TB, s);
      cv.fill(plate(0), solid(f === 1 ? lighten(BUTTON, 0.1) : f === 2 ? darken(BUTTON, 0.08) : BUTTON));
      cv.fill(outline(plate(0), hair(s)), solid(BAR_EDGE));
      return bitmap(cv);
    }));
    out.animation_toolbar_highlight = (s) => {
      const cv = new Canvas(TB, TB * 12, s);
      for (let i = 0; i < 12; i++) {
        cv.fill(plate(i * TB), solid(c.accent));
        cv.fill(outline(plate(i * TB), hair(s)), solid(BAR_EDGE));
      }
      return bitmap(cv);
    };
  },
};

export default ableton;
