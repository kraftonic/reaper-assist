import type { SkinUi } from "../skins";
import { exact, scaled, type Draw, type Frame } from "../kit/art";
import * as I from "../kit/icons";
import { arc, bitmap, type Bitmap, Canvas, capsule, circle, darken, hex, hstack, intersect, lighten, mixc, outline, poly, polyline, rect, rgrad, rrect, solid, subtract, union, vgrad, vstack, withGuides, type RGB, type SDF } from "../kit/raster";
import { DEFAULT_ENV, type Glyph, type Kit, type KitDef, type KitSizes } from "../kit/types";
import { CENTER, fg, fill, H, meterLook, NONE, ON_COLOR, rgb, type Script, TRACK_FILL, type V, W } from "../kit/walter";

/**
 * FL Studio (current "Default" theme; colours measured from Image-Line's manual screenshots).
 *
 * Playlist track headers are one compact row, in the order the FL-style REAPER themes made
 * familiar: fold / menu arrow, record dot, the name, a small volume knob, "FX"
 * with its green LED, a larger pan knob, round solo and mute LEDs, a thin meter in a dark box
 * (outlined lime when the track is selected, like the channel rack's select box) and the
 * track-number strip in the track colour on the right edge. Mixer inserts: number band in the
 * track colour, vertical name, meter, green LED, pan knob, grey fader cap, FX, solo, phase, arm,
 * routing arrow. The top bar: one dark pill with PAT/SONG, play and stop, a round record
 * button, the light tempo LCD with "BPM", the time signature and the big teal time display.
 * Every drawing is original vector artwork.
 */

type Pair = [number, number];

const C = {
  bg: "#3f4b55", panel: "#3e4e55", panelSel: "#3e5164",
  plate: "#5b656b", plateSel: "#6a757c", line: "#293238", deep: "#1c2327",
  face: "#4f595f", text: "#e7eef2", name: "#d3dbdf", dim: "#a7b0b4",
  orange: "#ffaa54", lime: "#c3ff5a", led: "#8def11", fxLime: "#a5e04a", arm: "#ff6b4a",
  toolbar: "#6b757b", lcd: "#647879", lcdLight: "#e3f4fb", lcdInk: "#27323a", bpmInk: "#53636c",
  num: "#6f7d86", numSel: "#6d74c4", mixHead: "#728187",
  meterOff: "#1f282d", groove: "#1d262a", pill: "#3a4247", pillLine: "#262d31",
};

function palette(ui: SkinUi): Kit {
  return {
    id: "fl",
    look: "gloss",
    radius: 3,
    c: {
      bg: hex(C.bg),
      panel: hex(C.panel),
      track: hex(C.plate),
      trackSel: hex(C.plateSel),
      face: hex(C.face),
      line: hex(C.line),
      deep: hex(C.deep),
      text: hex(ui.text),
      dim: hex(C.dim),
      accent: hex(ui.accent),
      accent2: hex(C.lime),
      solo: hex(C.orange),
      arm: hex(C.arm),
      play: hex("#ffc15b"),
      onInk: hex("#3a2400"),
      env: DEFAULT_ENV,
      display: hex(C.lcd),
      displayText: hex("#ffffff"),
      knob: hex(C.orange),
      notes: { off: hex("#c6fbd0"), on: hex("#ff8a8a"), bg: hex("#42545f") },
      meter: { off: hex(C.meterOff), low: hex("#aafd43"), mid: hex("#ffe25e"), high: hex("#ff8d3e"), clip: hex("#ff4b4b") },
    },
  };
}

/* ------------------------------------------------------------------ sizes (base units, 100 %) */

/** One-row track height (the collapsed tracks), FL's default track height and the default header width. */
const ROW = 26;
const TRACK_H = 56;
/**
 * REAPER's extras (automation, polarity, folder; input and monitoring when armed) only on tracks at least this
 * tall: FL's headers show nothing below the name at its default height.
 */
const ROW2 = 80;
const TCP_W = 340;
const Z = {
  arrow: [12, 14] as Pair, dot: [12, 14] as Pair, led: [14, 14] as Pair, fx: [18, 14] as Pair, fxLed: [10, 14] as Pair,
  vol: 20, pan: 24, small: [16, 14] as Pair, cap: [22, 28] as Pair, fader: 22,
  pill: [[34, 30], [32, 30], [32, 30]] as Pair[], rec: [30, 30] as Pair, tempo: [78, 26] as Pair, sig: [40, 26] as Pair,
};
/** The time display panel. */
const STATUS: Pair = [150, 34];

const SIZES: KitSizes = {
  tcpMute: Z.led, tcpBtn: Z.led, tcpSmall: Z.small, tcpFx: Z.fx, tcpKnob: Z.vol, tcpThumb: [10, 14],
  mcpMute: Z.led, mcpBtn: Z.led, mcpArm: Z.led, mcpMon: Z.small, mcpSmall: Z.small, mcpKnob: Z.pan, mcpThumb: Z.cap, mcpFaderW: Z.fader,
  envBtn: [18, 16], envKnob: 16, trans: [32, 30], tap: [36, 26], menu: Z.small, toolbar: 30,
};

const MCP_W = { track: 40, master: 66 };
/** Mixer strips at least this tall show REAPER's extended mixer (inserts, sends) above the number band. */
const MCP_EXT = 600;

/* ------------------------------------------------------------------ layout */

/** Track panel: one row (centred on one-row tracks, at the top of taller ones) and REAPER's extras in row 2. */
function tcp(k: Kit, w: Script) {
  const n = w.n;
  w.set("tcp.size", `[${n(TCP_W)} ${n(ROW)} ${n(180)}]`);
  // kY: the row's offset, centring it on tracks under 52 px.
  w.set("kY", `h<${n(52)} * 0.5 + [0 h] [0 ${-n(ROW)}] [0 0]`);
  const r = (x: V, y: number, wd: V, ht: number) => `+ kY ${w.p(x, y, wd, ht)}`;
  const at = (x: V, y: number, [wd, ht]: Pair) => r(x, y, wd, ht);
  // Left: the fold arrow on folders, else the menu arrow (routing); the record dot.
  w.set("tcp.foldercomp", `folderstate==1 ${at(3, 6, Z.arrow)} [0]`);
  w.set("tcp.io", `folderstate==1 [0] ${at(3, 6, Z.arrow)}`);
  w.set("tcp.recarm", at(16, 6, Z.dot));
  // The name straight on the plate (FL's playlist headers); the volume knob gives its room to the name on narrow panels.
  const nameRect = `w<${n(300)} ${r(30, 3, W(-166), 20)} ${r(30, 3, W(-191), 20)}`;
  w.set("tcp.label", nameRect);
  w.set("tcp.label.margin", `[${n(3)} 0 ${n(4)} 0 0]`);
  w.set("tcp.label.font", w.font("label"));
  w.set("tcp.label.color", `?track_selected ${fg(hex("#ffffff"))} ${fg(hex(C.name))}`);
  // Right cluster: volume, FX + LED, pan, solo, mute, the meter box and the number strip.
  w.set("tcp.volume", `w<${n(300)} [0] ${r(W(-157), 3, Z.vol, Z.vol)}`);
  w.set("tcp.volume.fadermode", "[1]");
  w.set("tcp.fx", at(W(-132), 6, Z.fx));
  w.set("tcp.fxbyp", at(W(-114), 6, Z.fxLed));
  w.set("tcp.pan", r(W(-100), 1, Z.pan, Z.pan));
  w.set("tcp.pan.fadermode", "[1]");
  w.set("tcp.solo", at(W(-71), 6, Z.led));
  w.set("tcp.mute", at(W(-55), 6, Z.led));
  const box = w.p(W(-37), 3, 12, H(-6));
  w.custom("tcp.custom.kMB", "k_mbox");
  w.set("tcp.custom.kMB", box);
  w.custom("tcp.custom.kMS", "k_mboxsel");
  w.set("tcp.custom.kMS", `?track_selected ${box} [0]`);
  w.set("tcp.meter", w.p(W(-35), 5, 8, H(-10)));
  meterLook(w, "tcp.meter", k, { scale: false, readout: false });
  w.set("tcp.meter.vu.div", `[${n(1)}]`);
  w.custom("tcp.custom.kNum");
  const strip = w.p(W(-22), 0, 22, H(-1));
  w.set("tcp.custom.kNum", strip);
  w.set("tcp.custom.kNum.color", `?trackcolor_valid ${TRACK_FILL} ?track_selected ${fill(hex(C.numSel))} ${fill(hex(C.num))}`);
  // The number stays upright in the row (REAPER turns text in tall, narrow boxes on its side).
  w.set("tcp.trackidx", r(W(-22), 0, 22, ROW));
  w.set("tcp.trackidx.color", `?trackcolor_valid ${ON_COLOR} ?track_selected [255 255 255] [232 238 241]`);
  w.set("tcp.trackidx.font", w.font("value"));
  w.set("tcp.trackidx.margin", CENTER);
  // Row 2 (tracks 52 px and taller): automation, polarity, folder; input and monitoring when armed.
  const y2 = ROW + 6;
  const row2 = (x: V, s: Pair) => `h<${n(ROW2)} [0] ${w.p(x, y2, s[0], s[1])}`;
  w.set("tcp.env", row2(30, Z.small));
  w.set("tcp.phase", row2(48, Z.small));
  w.set("tcp.folder", row2(66, Z.small));
  w.set("tcp.recmon", `h<${n(ROW2)} [0] !recarm [0] ${w.p(88, y2, ...Z.small)}`);
  w.set("tcp.recinput", `h<${n(ROW2)} [0] !recarm [0] ${w.p(108, ROW + 4, W(-269), 18)}`);
  for (const el of ["tcp.recmode", "tcp.width", "tcp.fxin", "tcp.fxparm", "tcp.sendlist", "tcp.fxlist", "tcp.fxembed"]) w.set(el, "[0]");
  w.raw("front tcp.custom.kMS tcp.meter tcp.label tcp.trackidx");
}

function masterTcp(k: Kit, w: Script) {
  const n = w.n;
  w.set("master.tcp.size", `[${n(TCP_W)} ${n(ROW)} ${n(180)}]`);
  w.set("kY", `h<${n(52)} * 0.5 + [0 h] [0 ${-n(ROW)}] [0 0]`);
  const r = (x: V, y: number, wd: V, ht: number) => `+ kY ${w.p(x, y, wd, ht)}`;
  const at = (x: V, y: number, [wd, ht]: Pair) => r(x, y, wd, ht);
  w.set("master.tcp.io", at(3, 6, Z.arrow));
  const nameRect = r(30, 3, W(-191), 20);
  w.set("master.tcp.label", nameRect);
  w.set("master.tcp.label.margin", `[${n(3)} 0 ${n(4)} 0 0]`);
  w.set("master.tcp.label.font", w.font("label"));
  w.set("master.tcp.label.color", fg(hex(C.name)));
  w.set("master.tcp.volume", r(W(-157), 3, Z.vol, Z.vol));
  w.set("master.tcp.volume.fadermode", "[1]");
  w.set("master.tcp.fx", at(W(-132), 6, Z.fx));
  w.set("master.tcp.fxbyp", at(W(-114), 6, Z.fxLed));
  w.set("master.tcp.pan", r(W(-100), 1, Z.pan, Z.pan));
  w.set("master.tcp.pan.fadermode", "[1]");
  w.set("master.tcp.solo", at(W(-71), 6, Z.led));
  w.set("master.tcp.mute", at(W(-55), 6, Z.led));
  const box = w.p(W(-37), 3, 12, H(-6));
  w.custom("master.tcp.custom.kMB", "k_mbox");
  w.set("master.tcp.custom.kMB", box);
  w.set("master.tcp.meter", w.p(W(-35), 5, 8, H(-10)));
  meterLook(w, "master.tcp.meter", k, { scale: false, readout: false });
  w.set("master.tcp.meter.vu.div", `[${n(1)}]`);
  w.raw("custom master.tcp.custom.kNum 'M'");
  w.set("master.tcp.custom.kNum", w.p(W(-22), 0, 22, H(-1)));
  w.set("master.tcp.custom.kNum.color", `[${rgb(hex("#f0f4f6"))} 255 ${rgb(hex(C.mixHead))} 255]`);
  w.set("master.tcp.custom.kNum.font", w.font("value"));
  w.set("master.tcp.custom.kNum.margin", CENTER);
  w.set("master.tcp.env", `h<${n(ROW2)} [0] ${w.p(30, ROW + 6, ...Z.small)}`);
  for (const el of ["master.tcp.width", "master.tcp.mono", "master.tcp.fxparm", "master.tcp.fxlist", "master.tcp.sendlist"]) w.set(el, "[0]");
  w.raw("front master.tcp.meter master.tcp.label");
}

/**
 * A mixer insert, FL order: number band, vertical name beside the meter box, LED (mute), pan
 * knob, the fader, then polarity + solo, FX + LED, arm (+ monitoring when armed) and the routing
 * arrow at the bottom. Short (docked) strips keep a long fader; tall ones show REAPER's extended
 * mixer (inserts, sends) above the number band. kT shifts everything under that section, kM is
 * the name / meter height.
 */
function mcp(k: Kit, w: Script, { master }: { master: boolean }) {
  const n = w.n;
  const X = master ? "master.mcp" : "mcp";
  const S = master ? MCP_W.master : MCP_W.track;
  const cx = S / 2;
  w.set(`${X}.size`, `[${n(S)} ${n(400)} 0 ${n(260)}]`);
  w.set("kT", `mcp_wantextmix>0 h<${n(MCP_EXT)} [0 0] * 0.3 [0 h] [0 0]`);
  w.set("kT2", "- kT [0 0 0 kT{1}]");
  w.set(`${X}.extmixer.mode`, "[1]");
  w.set(`${X}.extmixer.position`, `mcp_wantextmix>0 h<${n(MCP_EXT)} [0] + [${n(2)} ${n(2)} ${-n(4)} ${-n(4)}] [0 0 w kT{1}] [0]`);
  w.set("kM", `h<${n(500)} [0 ${n(92)}] [0 ${n(122)}]`);
  const top = (x: V, y: number, wd: V, ht: number) => `+ kT ${w.p(x, y, wd, ht)}`;
  // Number band in the track colour (FL's grey, violet when selected; "M" on the master).
  if (master) {
    w.raw("custom master.mcp.custom.kNum 'M'");
    w.set("master.mcp.custom.kNum.color", `[${rgb(hex("#f0f4f6"))} 255 ${rgb(hex(C.mixHead))} 255]`);
    w.set("master.mcp.custom.kNum.font", w.font("value"));
    w.set("master.mcp.custom.kNum.margin", CENTER);
  } else w.custom("mcp.custom.kNum");
  w.set(`${X}.custom.kNum`, top(0, 0, W(), 18));
  if (!master) {
    w.set("mcp.custom.kNum.color", `?trackcolor_valid ${TRACK_FILL} ?track_selected ${fill(hex(C.numSel))} ${fill(hex(C.mixHead))}`);
    w.set("mcp.trackidx", top(0, 0, W(), 18));
    w.set("mcp.trackidx.color", `?trackcolor_valid ${ON_COLOR} [240 244 246]`);
    w.set("mcp.trackidx.font", w.font("value"));
    w.set("mcp.trackidx.margin", CENTER);
  }
  // Name (vertical, reading upwards) on the left, the meter in its dark box on the right.
  const nw = master ? 18 : Math.floor(S / 2);
  const tall = (x: number, y: number, wd: number, dh: number) => `+ kT + ${w.p(x, y, wd, dh)} [0 0 0 kM{1}]`;
  w.set(`${X}.label`, tall(2, 22, nw - 2, 0));
  w.set(`${X}.label.margin`, "[0 0 0 0 1]");
  w.set(`${X}.label.font`, w.font("label"));
  w.set(`${X}.label.color`, `?track_selected ${fg(hex("#ffffff"))} ${fg(hex(C.name))}`);
  w.custom(`${X}.custom.kMB`, "k_mboxm");
  w.set(`${X}.custom.kMB`, tall(nw, 22, S - nw - 3, 0));
  w.set(`${X}.meter`, tall(nw + 2, 24, S - nw - 7, -4));
  meterLook(w, `${X}.meter`, k, { scale: false, readout: false });
  w.set(`${X}.meter.vu.div`, `[${n(2)}]`);
  // LED (mute), pan knob, then the fader down to the bottom rows.
  const row = (x: number, y: number, [wd, ht]: Pair) => `+ kT + kM ${w.p(x, y, wd, ht)}`;
  w.set(`${X}.mute`, row(cx - 7, 28, Z.led));
  w.set(`${X}.pan`, row(cx - Z.pan / 2, 46, [Z.pan, Z.pan]));
  w.set(`${X}.pan.fadermode`, "[1]");
  w.set(`${X}.volume`, `- + + + kT2 kM ${w.p(cx - Z.fader / 2, 76, Z.fader, -152)} [0 0 0 h] [0 0 0 kM{1}]`);
  w.set(`${X}.volume.label`, "[0]");
  w.set(`${X}.volume.label.color`, NONE);
  // Bottom rows: polarity + solo, FX + LED, arm (+ monitoring when armed), routing.
  if (master) {
    w.set("master.mcp.mono", w.p(cx - 7, H(-72), ...Z.led));
  } else {
    w.set("mcp.phase", w.p(cx - 16, H(-72), ...Z.small));
    w.set("mcp.solo", w.p(cx + 2, H(-72), ...Z.led));
  }
  w.set(`${X}.fx`, w.p(cx - 15, H(-56), ...Z.fx));
  w.set(`${X}.fxbyp`, w.p(cx + 5, H(-56), ...Z.fxLed));
  if (master) {
    w.set("master.mcp.io", w.p(cx - 17, H(-22), ...Z.small));
    w.set("master.mcp.menubutton", w.p(cx + 1, H(-22), ...Z.small));
  } else {
    w.set("mcp.recarm", `?recarm ${w.p(cx - 16, H(-40), ...Z.led)} ${w.p(cx - 7, H(-40), ...Z.led)}`);
    w.set("mcp.recmon", `!recarm [0] ${w.p(cx + 1, H(-40), ...Z.small)}`);
    w.set("mcp.io", w.p(cx - 8, H(-22), ...Z.small));
  }
  for (const el of ["width", "env", "fxin", "folder", "recinput", "fxlist", "sendlist", "fxparm", ...(master ? ["solo", "phase"] : [])]) w.set(`${X}.${el}`, "[0]");
  w.raw(`front ${X}.meter ${X}.label${master ? "" : " mcp.trackidx"}`);
}

/** The top bar: [PAT/SONG | play | stop] (one pill), record, tempo LCD + "BPM", signature, time display … automation, selection. */
function trans(k: Kit, w: Script) {
  const n = w.n;
  w.set("trans.size", `[${n(1000)} ${n(40)}]`);
  w.set("trans.size.minmax", `[${n(400)} ${n(40)} ${n(4000)} ${n(144)}]`);
  w.set("trans.size.dockedheight", `[${n(40)}]`);
  const [pa, pb, pc] = Z.pill as [Pair, Pair, Pair];
  w.set("trans.repeat", w.p(8, 5, ...pa));
  w.set("trans.play", w.p(8 + pa[0], 5, ...pb));
  w.set("trans.stop", w.p(8 + pa[0] + pb[0], 5, ...pc));
  const recX = 8 + pa[0] + pb[0] + pc[0] + 5;
  w.set("trans.rec", w.p(recX, 5, ...Z.rec));
  // Tempo: the light LCD with "BPM" at its right; the number right-aligned before it.
  const tx = recX + Z.rec[0] + 7;
  w.raw("custom trans.custom.kTempo 'BPM' 0 '' 'k_tempo'");
  w.set("trans.custom.kTempo", w.p(tx, 7, ...Z.tempo));
  w.set("trans.custom.kTempo.font", w.font("value"));
  w.set("trans.custom.kTempo.color", fg(hex(C.bpmInk)));
  w.set("trans.custom.kTempo.margin", `[0 ${n(2)} ${n(7)} 0 1]`);
  w.set("trans.bpm.edit", w.p(tx + 2, 8, Z.tempo[0] - 32, Z.tempo[1] - 2));
  w.set("trans.bpm.edit.font", w.font("tempo"));
  w.set("trans.bpm.edit.color", fg(hex(C.lcdInk)));
  w.set("trans.bpm.edit.margin", `[0 0 ${n(2)} 0 1]`);
  // Time signature (when REAPER is set to show it): light figures in a dark field.
  const sx = tx + Z.tempo[0] + 6;
  w.set("trans.curtimesig", `trans_flags&4 ${w.p(sx, 7, ...Z.sig)} [0]`);
  w.set("trans.curtimesig.font", w.font("sig"));
  w.set("trans.curtimesig.color", fg(hex(C.text)));
  w.set("trans.curtimesig.margin", CENTER);
  // The big time display: light digits on FL's grey-teal panel. REAPER sizes the position text by the
  // status element's width (and draws it bold), so the element runs on past the panel, which its own
  // background image (transport_status_bg) draws at the left; the rest is the bar's colour.
  const dx = sx + Z.sig[0] + 8;
  w.set("trans.status", `w<${n(1300)} ${w.p(dx, 3, STATUS[0] + 150, STATUS[1])} ${w.p(dx, 3, STATUS[0] + 450, STATUS[1])}`);
  // REAPER fits the position text to the text box's height: negative top/bottom margins give FL's tall digits.
  w.set("trans.status.margin", `[${n(12)} ${-n(8)} 0 ${-n(10)}]`);
  w.set("trans.status.color", fg(hex("#f2f7f8")));
  // REAPER extras at the right of a wide bar: automation override, selection.
  w.set("trans.automode", `w<${n(900)} [0] ${w.p(W(-300), 5, ...SIZES.trans)}`);
  w.set("trans.sel", `w<${n(900)} [0] ${w.p(W(-262), 8, 254, 24)}`);
  for (const el of ["trans.pause", "trans.rew", "trans.fwd", "trans.bpm.tap", "trans.rate", "trans.rate.fader"]) w.set(el, "[0]");
  void k;
}

/* ------------------------------------------------------------------ artwork helpers */

const F3 = [0, 1, 2] as Frame[];
/** Three frames (normal, hover, pressed) of a w×h drawing. */
const frames = (w: number, h: number, paint: (cv: Canvas, f: Frame, s: number) => void): Draw =>
  scaled((s) => hstack(F3.map((f) => {
    const cv = new Canvas(w, h, s);
    paint(cv, f, s);
    return bitmap(cv);
  })));
/** A stretchable image (pink guides g device px on every side). */
const stretch = (w: number, h: number, g: number, paint: (cv: Canvas, s: number) => void): Draw => (s) => {
  const cv = new Canvas(w, h, s);
  paint(cv, s);
  const gp = Math.ceil(g * s);
  return withGuides(bitmap(cv), gp, gp, gp, gp);
};
const hov = (c: RGB, f: Frame) => (f === 1 ? lighten(c, 0.18) : f === 2 ? darken(c, 0.12) : c);

/** FL's round LED: a dark rim, a lit core with a glow, or a dim one. */
function ledDraw([w, h]: Pair, core: RGB, lit: boolean, r = 4.2): Draw {
  return frames(w, h, (cv, f) => {
    const cx = w / 2, cy = h / 2;
    if (lit) cv.shadow(circle(cx, cy, r), core, f === 1 ? 0.6 : 0.42, 2.4);
    cv.fill(circle(cx, cy, r + 1.3), vgrad(cy - r, cy + r, [[0, "#151b1e"], [1, "#3a4449"]]));
    if (lit) {
      const c = f === 2 ? darken(core, 0.12) : core;
      cv.fill(circle(cx, cy, r), rgrad(cx - r * 0.3, cy - r * 0.35, r * 1.6, lighten(c, 0.62), darken(c, 0.12)));
      cv.fill(circle(cx - r * 0.28, cy - r * 0.32, r * 0.34), solid([255, 255, 255], 0.55));
    } else {
      const c = f === 1 ? hex("#536068") : hex("#3c464c");
      cv.fill(circle(cx, cy, r), rgrad(cx - r * 0.3, cy - r * 0.35, r * 1.6, lighten(c, 0.12), darken(c, 0.25)));
      cv.fill(circle(cx - r * 0.28, cy - r * 0.32, r * 0.3), solid([255, 255, 255], 0.1));
    }
  });
}

/** An unlit ring LED (FL's solo-style ring): grey rim around a dark centre. */
function ringDraw([w, h]: Pair, r = 4.2): Draw {
  return frames(w, h, (cv, f, s) => {
    const cx = w / 2, cy = h / 2;
    cv.fill(circle(cx, cy, r + 1.3), solid("#1e2528"));
    cv.fill(outline(circle(cx, cy, r + 0.3), Math.max(1.2, 1.5 / s)), solid(f === 1 ? "#9aa5ab" : "#727d83"));
    cv.fill(circle(cx, cy, r - 1.1), solid(f === 2 ? "#20272a" : "#2b3338"));
  });
}

/** A small dot (record arm off), a lit dot (armed) or a ring (auto-arm). */
function dotDraw([w, h]: Pair, col: RGB, kind: "dot" | "lit" | "ring", r = 2.7): Draw {
  return frames(w, h, (cv, f, s) => {
    const cx = w / 2, cy = h / 2;
    const c = hov(col, f);
    if (kind === "ring") cv.fill(outline(circle(cx, cy, r + 1.2), Math.max(1.4, 1.6 / s)), solid(c));
    else if (kind === "lit") {
      cv.shadow(circle(cx, cy, r + 0.8), col, 0.5, 2);
      cv.fill(circle(cx, cy, r + 0.8), rgrad(cx - 1, cy - 1, r * 2, lighten(c, 0.45), c));
    } else cv.fill(circle(cx, cy, r), solid(c));
  });
}

/** A glyph-only button (no face): FL draws "FX", arrows and small icons straight on the panel. */
function glyphBtn([w, h]: Pair, g: (cx: number, cy: number) => SDF, ink: RGB): Draw {
  return frames(w, h, (cv, f) => {
    cv.fill(g(w / 2, h / 2 + (f === 2 ? 0.5 : 0)), solid(hov(ink, f)));
  });
}

const fxGlyph = (cx: number, cy: number) => I.text("FX", cx, cy, 8, 0.24, 0.12);
const tri = (cx: number, cy: number, dir: "r" | "d" | "u", s = 1): SDF => {
  if (dir === "r") return poly([[cx - 2 * s, cy - 3.5 * s], [cx + 2.5 * s, cy], [cx - 2 * s, cy + 3.5 * s]]);
  if (dir === "d") return poly([[cx - 3.5 * s, cy - 2 * s], [cx + 3.5 * s, cy - 2 * s], [cx, cy + 2.5 * s]]);
  return poly([[cx - 4 * s, cy + 2.2 * s], [cx + 4 * s, cy + 2.2 * s], [cx, cy - 2.6 * s]]);
};

/** FL's dark knob: a disc with a white pointer; `ring` adds the dark outer ring with the value arc (pan). */
function flKnob(size: number, ring: boolean, bipolar: boolean, arcCol: RGB, frameCount = 49): Draw {
  const A = Math.PI / 180;
  return scaled((s) => {
    const out: Bitmap[] = [];
    for (let i = 0; i < frameCount; i++) {
      const a = (-135 + 270 * (i / (frameCount - 1))) * A;
      const cv = new Canvas(size, size, s);
      const c = size / 2;
      const R = c - 0.5;
      let br = R - 1.2;
      if (ring) {
        // Outer ring: a dark groove; the value lights an arc on it from the centre (pan) or the start.
        const t = 1.6;
        cv.fill(circle(c, c, R), vgrad(0, size, [[0, "#20272b"], [1, "#2c353a"]]));
        cv.fill(outline(circle(c, c, R), 1 / s), solid("#161c1f"));
        const from = bipolar ? 0 : -135 * A;
        if (Math.abs(a - from) > 0.03) cv.fill(arc(c, c, R - t - 0.2, Math.min(from, a), Math.max(from, a), t * 0.62), solid(arcCol));
        br = R - t * 2.3;
      }
      cv.fill(circle(c, c + 0.7, br), solid([0, 0, 0], 0.45));
      cv.fill(circle(c, c, br), vgrad(c - br, c + br, [[0, "#5a6369"], [0.5, "#3c444a"], [1, "#272d31"]]));
      cv.fill(outline(circle(c, c, br), 1 / s), solid("#1a2023"));
      cv.fill(intersect(outline(circle(c, c, br - 1 / s), 1 / s), rect(0, 0, size, c - br * 0.2)), solid([255, 255, 255], 0.12));
      const p0 = br * 0.18, p1 = br * 0.86;
      cv.fill(capsule(c + Math.sin(a) * p0, c - Math.cos(a) * p0, c + Math.sin(a) * p1, c - Math.cos(a) * p1, Math.max(size * 0.045, 0.75 / s)), solid("#f4f7f9"));
      out.push(bitmap(cv));
    }
    return vstack(out);
  });
}

/** The track header plate (stretchable): FL's slate plate, a light top edge and a dark separator below. */
function plate(c: RGB): Draw {
  return stretch(24, 24, 3, (cv, s) => {
    const px = 1 / s;
    cv.fill(rect(0, 0, 24, 24), vgrad(0, 24, [[0, lighten(c, 0.03)], [1, darken(c, 0.05)]]));
    cv.fill(rect(0, 0, 24, px), solid(lighten(c, 0.14)));
    cv.fill(rect(0, 24 - px, 24, px), solid(C.line));
  });
}

/** A mixer strip (stretchable): flat insert colour, a soft light edge left and a dark divider right. */
function stripBg(c: RGB): Draw {
  return stretch(24, 24, 2, (cv, s) => {
    const px = 1 / s;
    cv.fill(rect(0, 0, 24, 24), solid(c));
    cv.fill(rect(0, 0, px, 24), solid([255, 255, 255], 0.05));
    cv.fill(rect(24 - px, 0, px, 24), solid("#2a363c"));
  });
}

/** A recessed field (stretchable, translucent so a track-tinted plate shows through). */
function field(a: number, r: number, edge = true): Draw {
  return stretch(16, 16, r + 1, (cv, s) => {
    const px = 1 / s;
    cv.fill(rrect(0, 0, 16, 16, r), solid([0, 0, 0], a));
    cv.fill(intersect(outline(rrect(0, 0, 16, 16, r), px), rect(0, 0, 16, 2)), solid([0, 0, 0], 0.25));
    if (edge) cv.fill(intersect(outline(rrect(0, 0, 16, 16, r), px), rect(0, 14, 16, 2)), solid([255, 255, 255], 0.09));
  });
}

/** The lime selection outline around the meter box (stretchable, hollow). */
const selBox: Draw = stretch(16, 16, 4, (cv, s) => {
  cv.fill(outline(rrect(0, 0, 16, 16, 3), Math.max(1.5, 2 / s)), solid(C.lime));
});

/** FL's fader cap: a light grey block with a bevel, grip lines and a dark centre line. */
function cap([w, h]: Pair): Draw {
  return (s) => {
    const cv = new Canvas(w, h, s);
    const px = 1 / s;
    const shape = rrect(1, 0, w - 2, h - px, 2.5);
    cv.fill(rrect(1, px * 2, w - 2, h - px, 2.5), solid([0, 0, 0], 0.5));
    cv.fill(shape, vgrad(0, h, [[0, "#f3f6f8"], [0.42, "#cfd5da"], [0.5, "#9ca3aa"], [0.58, "#c2c8ce"], [1, "#8d949b"]]));
    for (const dy of [-8, -5, 5, 8]) cv.fill(rect(4, Math.round((h / 2 + dy) * s) / s, w - 8, px), solid([0, 0, 0], 0.16));
    cv.fill(rect(3, Math.round((h / 2 - 0.5) * s) / s, w - 6, Math.max(px, 1)), solid("#3a4248"));
    cv.fill(outline(shape, px), solid("#232b30", 0.9));
    return bitmap(cv);
  };
}

/** The fader groove: a thin dark slot (stretchable). */
function groove(w: number): Draw {
  return (s) => {
    const h = 40;
    const cv = new Canvas(w, h, s);
    const t = 3, x = Math.round((w / 2 - t / 2) * s) / s;
    cv.fill(rrect(x, 4, t, h - 8, 1.5), solid(C.groove));
    cv.fill(rect(x + t, 5, 1 / s, h - 10), solid([255, 255, 255], 0.07));
    const b = bitmap(cv);
    const half = Math.floor(b.width / 2) - 1;
    return withGuides(b, half, Math.round(6 * s), half, Math.round(6 * s));
  };
}

/** A stroke "G" (the shared letter set has none): a ring open at the upper right, with a bar. */
function letterG(x: number, cy: number, u: number, r: number): SDF {
  const R = u / 2 - r, cx = x + u / 2, D = Math.PI / 180;
  return union(arc(cx, cy, R, 135 * D, 400 * D, r), capsule(cx + R * 0.1, cy + R * 0.1, cx + R, cy + R * 0.1, r), capsule(cx + R, cy + R * 0.1, cx + R * 0.9, cy + R * 0.55, r));
}

/** A word in the stroke font, allowing a trailing "G". */
function word(str: string, cx: number, cy: number, u: number, weight = 0.15): SDF {
  if (!str.endsWith("G")) return I.text(str, cx, cy, u, weight);
  const head = str.slice(0, -1), r = Math.max((u * weight) / 2, 0.45), gw = u, gap = u * 0.2 + r;
  const hw = I.textWidth(head, u, weight);
  const x0 = cx - (hw + gap + gw) / 2;
  return union(I.text(head, x0 + hw / 2, cy, u, weight), letterG(x0 + hw + gap, cy, u, r));
}

/** One segment of the transport pill: dark, rounded on the outer ends, a divider on its left. */
function pillSeg([w, h]: Pair, part: "left" | "mid" | "right", paint: (cv: Canvas, f: Frame, s: number) => void): Draw {
  return frames(w, h, (cv, f, s) => {
    const px = 1 / s, R = 9;
    const ext = part === "left" ? rrect(0, 0, w + R, h, R) : part === "right" ? rrect(-R, 0, w + R, h, R) : rect(-1, 0, w + 2, h);
    const base = f === 1 ? hex("#434c52") : f === 2 ? hex("#30373b") : hex(C.pill);
    cv.fill(intersect(ext, rect(0, 0, w, h)), vgrad(0, h, [[0, lighten(base, 0.06)], [1, darken(base, 0.08)]]));
    cv.fill(intersect(outline(ext, px), rect(0, 0, w, h)), solid(C.pillLine));
    if (part !== "left") cv.fill(rect(0, 0, px, h), solid(C.pillLine));
    paint(cv, f, s);
  });
}

/** PAT / SONG: the lit word shows the mode (PAT = repeat on, orange; SONG = lime). */
function patSong(pat: boolean): Draw {
  const [w, h] = Z.pill[0]!;
  return pillSeg([w, h], "left", (cv) => {
    const lit = (y: number, c0: string, c1: string) => cv.fill(rrect(3, y, w - 5, 12.5, 3), vgrad(y, y + 12.5, [[0, c0], [1, c1]]));
    if (pat) lit(2.5, "#ffe7a3", "#ffb347");
    else lit(15, "#e6ffb0", "#a9e84a");
    cv.fill(word("PAT", w / 2 + 1, 8.9, 6.2, 0.2), solid(pat ? "#4a2a00" : "#8a979e"));
    cv.fill(word("SONG", w / 2 + 1, 21.3, 5.6, 0.2), solid(!pat ? "#2a3a00" : "#8a979e"));
  });
}

/** The round record button: a dark disc and a red dot (lit: brighter, with a glow). */
function recBtn(dot: RGB, lit: boolean): Draw {
  const [w, h] = Z.rec;
  return frames(w, h, (cv, f, s) => {
    const cx = w / 2, cy = h / 2, R = h / 2 - 0.5;
    const base = f === 1 ? hex("#434c52") : f === 2 ? hex("#30373b") : hex(C.pill);
    cv.fill(circle(cx, cy, R), vgrad(0, h, [[0, lighten(base, 0.06)], [1, darken(base, 0.08)]]));
    cv.fill(outline(circle(cx, cy, R), 1 / s), solid(C.pillLine));
    if (lit) cv.shadow(circle(cx, cy, 6), dot, 0.6, 3);
    cv.fill(circle(cx, cy, lit ? 6 : 5.4), rgrad(cx - 1.5, cy - 1.5, 8, lighten(dot, lit ? 0.45 : 0.18), dot));
  });
}

/** Paints an LCD field (a light or teal panel with a soft inner shadow) at (x, y). */
function lcdPaint(cv: Canvas, fillc: RGB, x: number, y: number, w: number, h: number, r: number) {
  const px = 1 / cv.s;
  const shape = rrect(x, y, w, h, r);
  cv.fill(shape, vgrad(y, y + h, [[0, darken(fillc, 0.05)], [0.3, fillc], [1, lighten(fillc, 0.04)]]));
  cv.fill(intersect(outline(rrect(x + px, y + px, w - 2 * px, h - 2 * px, r), px), rect(x, y, w, h * 0.4)), solid([0, 0, 0], 0.18));
  cv.fill(outline(shape, px), solid(darken(fillc, 0.42)));
}

/** An LCD (stretchable or exact). */
function lcd(fillc: RGB, w: number, h: number, r: number, stretchable: boolean): Draw {
  return (s) => {
    const cv = new Canvas(w, h, s);
    lcdPaint(cv, fillc, 0, 0, w, h, r);
    const b = bitmap(cv);
    if (!stretchable) return b;
    const g = Math.ceil((r + 2) * s);
    return withGuides(b, g, g, g, g);
  };
}

/** MIDI note colours in REAPER's colormap layout: FL's mint notes (red when selected), soft notes a little dimmer. */
function noteMap(k: Kit): Draw {
  const nc = k.c.notes!;
  const hue = (i: number, count: number, l: number): RGB => {
    const hh = (i / count) * 6, c = 0.62 * (1 - Math.abs(2 * l - 1)), x = c * (1 - Math.abs((hh % 2) - 1)), m = l - c / 2;
    const [r, g, b] = hh < 1 ? [c, x, 0] : hh < 2 ? [x, c, 0] : hh < 3 ? [0, c, x] : hh < 4 ? [0, x, c] : hh < 5 ? [x, 0, c] : [c, 0, x];
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
  };
  const column = (x: number, sel: boolean): RGB => {
    if (x < 12) return hue(x, 12, sel ? 0.62 : 0.72);
    if (x < 140) return mixc(nc.bg, sel ? nc.on : nc.off, 0.6 + 0.4 * ((x - 12) / 127));
    if (x === 140) return sel ? nc.on : nc.off;
    return hue(x - 141, 16, sel ? 0.62 : 0.72);
  };
  return exact(157, 130, (x, y) => {
    const fillc = column(x, y >= 65);
    return y === 64 || y === 129 ? darken(fillc, 0.45) : fillc;
  });
}

/** A fully transparent image (hides REAPER's meter badges). */
const clear = (w: number, h: number): Draw => (s) => bitmap(new Canvas(w, h, s));

/* ------------------------------------------------------------------ toolbar glyphs (u = 16) */

const T = (u: number) => Math.max(u * 0.085, 0.9);
const G: Record<string, (cx: number, cy: number, u: number) => SDF> = {
  // Pencil.
  draw: (cx, cy, u) => union(
    subtract(poly([[cx - u * 0.42, cy + u * 0.42], [cx - u * 0.34, cy + u * 0.14], [cx + u * 0.22, cy - u * 0.42], [cx + u * 0.42, cy - u * 0.22], [cx - u * 0.14, cy + u * 0.34]]), capsule(cx - u * 0.3, cy + u * 0.06, cx - u * 0.06, cy + u * 0.3, T(u) * 0.8)),
    capsule(cx - u * 0.42, cy + u * 0.42, cx - u * 0.32, cy + u * 0.32, T(u))),
  // Paint roller.
  paint: (cx, cy, u) => union(rrect(cx - u * 0.42, cy - u * 0.44, u * 0.66, u * 0.26, u * 0.06), polyline([[cx + u * 0.24, cy - u * 0.31], [cx + u * 0.4, cy - u * 0.31], [cx + u * 0.4, cy - u * 0.04], [cx - u * 0.04, cy - u * 0.04], [cx - u * 0.04, cy + u * 0.12]], T(u)), rrect(cx - u * 0.11, cy + u * 0.1, u * 0.14, u * 0.36, u * 0.04)),
  // Eraser.
  delete: (cx, cy, u) => union(
    poly([[cx - u * 0.46, cy + u * 0.12], [cx - u * 0.02, cy - u * 0.32], [cx + u * 0.3, cy], [cx - u * 0.14, cy + u * 0.44]]),
    outline(poly([[cx - u * 0.02, cy - u * 0.32], [cx + u * 0.22, cy - u * 0.56], [cx + u * 0.54, cy - u * 0.24], [cx + u * 0.3, cy]]), T(u)),
    capsule(cx - u * 0.1, cy + u * 0.44, cx + u * 0.46, cy + u * 0.44, T(u) * 0.8)),
  // Speaker with a cross.
  mute: (cx, cy, u) => union(I.speaker(cx - u * 0.14, cy, u * 0.8, 0), capsule(cx + u * 0.14, cy - u * 0.16, cx + u * 0.46, cy + u * 0.16, T(u)), capsule(cx + u * 0.46, cy - u * 0.16, cx + u * 0.14, cy + u * 0.16, T(u))),
  // Knife.
  slice: (cx, cy, u) => union(poly([[cx - u * 0.44, cy + u * 0.44], [cx + u * 0.06, cy - u * 0.06], [cx + u * 0.2, cy + u * 0.08]]), rrect(cx + u * 0.04, cy - u * 0.46, u * 0.18, u * 0.42, u * 0.06)),
  // Dashed selection rectangle with an arrow.
  select: (cx, cy, u) => {
    const x0 = cx - u * 0.44, y0 = cy - u * 0.36, x1 = cx + u * 0.3, y1 = cy + u * 0.22, t = T(u);
    const dash: SDF[] = [];
    for (let x = x0; x < x1; x += u * 0.18) dash.push(capsule(x, y0, Math.min(x + u * 0.08, x1), y0, t), capsule(x, y1, Math.min(x + u * 0.08, x1), y1, t));
    for (let y = y0; y < y1; y += u * 0.18) dash.push(capsule(x0, y, x0, Math.min(y + u * 0.08, y1), t), capsule(x1, y, x1, Math.min(y + u * 0.08, y1), t));
    return union(...dash, poly([[cx + u * 0.06, cy - u * 0.04], [cx + u * 0.46, cy + u * 0.24], [cx + u * 0.26, cy + u * 0.28], [cx + u * 0.18, cy + u * 0.46]]));
  },
  snap: (cx, cy, u) => I.tb.snap!(cx, cy, u),
  metro: (cx, cy, u) => I.tb.metro!(cx, cy, u),
  countin: (cx, cy, u) => I.text("321", cx, cy, u * 0.6),
  patsong: (cx, cy, u) => union(I.text("PAT", cx, cy - u * 0.24, u * 0.36), word("SONG", cx, cy + u * 0.26, u * 0.36)),
  // Three clips on lanes.
  playlist: (cx, cy, u) => union(rrect(cx - u * 0.46, cy - u * 0.4, u * 0.4, u * 0.2, u * 0.04), rrect(cx - u * 0.02, cy - u * 0.1, u * 0.48, u * 0.2, u * 0.04), rrect(cx - u * 0.3, cy + u * 0.2, u * 0.36, u * 0.2, u * 0.04)),
  // Step pads.
  rack: (cx, cy, u) => union(...[0, 1, 2, 3].flatMap((i) => [0, 1, 2].map((j) => ((i + j) % 3 === 0 ? rrect(cx - u * 0.46 + i * u * 0.24, cy - u * 0.36 + j * u * 0.26, u * 0.18, u * 0.2, u * 0.03) : outline(rrect(cx - u * 0.46 + i * u * 0.24, cy - u * 0.36 + j * u * 0.26, u * 0.18, u * 0.2, u * 0.03), T(u) * 0.8))))),
  // Piano keys.
  piano: (cx, cy, u) => union(outline(rect(cx - u * 0.46, cy - u * 0.4, u * 0.92, u * 0.8), T(u)), ...[-0.23, 0, 0.23].map((d) => capsule(cx + u * d, cy - u * 0.4, cx + u * d, cy + u * 0.4, T(u) * 0.7)), ...[-0.34, -0.12, 0.34].map((d) => rect(cx + u * d - u * 0.05, cy - u * 0.4, u * 0.1, u * 0.44))),
  // Mixer faders.
  mixer: (cx, cy, u) => union(...[-0.3, 0, 0.3].map((d, i) => union(capsule(cx + u * d, cy - u * 0.42, cx + u * d, cy + u * 0.42, T(u) * 0.7), rrect(cx + u * d - u * 0.1, cy + u * [0.1, -0.24, 0.18][i]! - u * 0.07, u * 0.2, u * 0.14, u * 0.03)))),
  // Folder tree.
  browser: (cx, cy, u) => union(I.folder(cx - u * 0.14, cy - u * 0.2, u * 0.5), polyline([[cx - u * 0.36, cy + u * 0.04], [cx - u * 0.36, cy + u * 0.32], [cx - u * 0.06, cy + u * 0.32]], T(u)), rrect(cx + u * 0.02, cy + u * 0.22, u * 0.42, u * 0.2, u * 0.04)),
  // Plug.
  plugin: (cx, cy, u) => union(rrect(cx - u * 0.26, cy - u * 0.12, u * 0.52, u * 0.34, u * 0.08), capsule(cx - u * 0.12, cy - u * 0.44, cx - u * 0.12, cy - u * 0.12, T(u)), capsule(cx + u * 0.12, cy - u * 0.44, cx + u * 0.12, cy - u * 0.12, T(u)), capsule(cx, cy + u * 0.22, cx, cy + u * 0.46, T(u) * 1.2)),
  // Chain links.
  linked: (cx, cy, u) => union(outline(rrect(cx - u * 0.48, cy - u * 0.14, u * 0.52, u * 0.28, u * 0.14), T(u)), outline(rrect(cx - u * 0.04, cy - u * 0.14, u * 0.52, u * 0.28, u * 0.14), T(u))),
  quant: (cx, cy, u) => I.tb.quant!(cx, cy, u),
  legato: (cx, cy, u) => union(...[0, 1, 2].map((i) => rect(cx - u * 0.46 + i * u * 0.31, cy + u * (0.2 - i * 0.2) - u * 0.07, u * 0.31, u * 0.14))),
  chop: (cx, cy, u) => union(...[0, 1, 2, 3].map((i) => rect(cx - u * 0.46 + i * u * 0.24, cy - u * 0.07, u * 0.2, u * 0.14)), capsule(cx - u * 0.46, cy - u * 0.32, cx + u * 0.46, cy - u * 0.32, T(u) * 0.7)),
  step: (cx, cy, u) => I.tb.midi_step!(cx, cy, u),
};

/** FL's toolbar icons are large and bold: the glyphs fill more of REAPER's 30-px button. */
const toolbarGlyphs: Record<string, Glyph> = Object.fromEntries(Object.entries(G).map(([name, g]) => [`assist_fl_${name}`, (cx: number, cy: number, u: number) => g(cx, cy, name === "patsong" ? u : u * 1.2)]));

/* ------------------------------------------------------------------ kit */

const fl: KitDef = {
  id: "fl",
  palette,
  sizes: SIZES,
  mcpWidth: MCP_W,
  fonts: { label: 1, value: 2, list: 3, tempo: 4, sig: 1, status: 5 },
  faces: {
    // FL's UI type is a narrow sans: Avenir Next Condensed on macOS, Bahnschrift (condensed) on Windows.
    slots: {
      1: { face: "Bahnschrift SemiCondensed", mac: "Avenir Next Condensed Medium", px: 13 },
      2: { face: "Bahnschrift SemiCondensed", mac: "Avenir Next Condensed Demi Bold", px: 11, weight: 600 },
      3: { face: "Bahnschrift SemiCondensed", mac: "Avenir Next Condensed", px: 12 },
      4: { face: "Bahnschrift SemiCondensed", mac: "Avenir Next Condensed Medium", px: 18 },
      // The big time display: thin condensed digits.
      5: { face: "Bahnschrift Light SemiCondensed", mac: "AvenirNextCondensed-UltraLight", px: 30 },
    },
    // (PostScript name: a LOGFONT face name holds 31 characters.)
    // REAPER draws the position bold (SWELL looks up "<face> Bold"): "… Demi" gives Demi Bold, the lightest.
    transport: { face: "Bahnschrift SemiCondensed", mac: "Avenir Next Condensed Demi", px: 32 },
    ruler: { face: "Bahnschrift SemiCondensed", mac: "Avenir Next Condensed Medium", px: 12 },
    items: { face: "Bahnschrift SemiCondensed", mac: "Avenir Next Condensed Medium", px: 13 },
    volpan: { face: "Bahnschrift SemiCondensed", mac: "Avenir Next Condensed", px: 11 },
    title: { face: "Bahnschrift SemiCondensed", mac: "Avenir Next Condensed Medium", px: 13 },
  },
  // New tracks (pref defvzoom 2 = the 3rd / 4th values) are FL's 56 px, armed or not; zoomed out they collapse to the one row.
  globals: { tcp_heights: `4 ${ROW} ${TRACK_H} ${TRACK_H}`, tcp_master_minheight: `${ROW}`, mcp_min_height: "260 80", tcp_folderindent: "8" },
  layout: { tcp, masterTcp, mcp, trans },
  images(k, out) {
    const lime = hex(C.led), fxLime = hex(C.fxLime), arm = hex(C.arm), grey = hex("#b1babf");
    // LEDs: mute lit = the track plays (FL's green); solo is a grey ring, orange when soloed.
    for (const p of ["track", "mcp"]) {
      out[`${p}_mute_off`] = ledDraw(Z.led, lime, true);
      out[`${p}_mute_on`] = ledDraw(Z.led, lime, false);
      out[`${p}_solo_off`] = ringDraw(Z.led);
      out[`${p}_solo_on`] = ledDraw(Z.led, hex(C.orange), true);
      out[`${p}_solodefeat_on`] = ledDraw(Z.led, hex("#ffd36b"), true);
      // FX: the word, lime when the track has effects; its LED = FX on / bypassed.
      out[`${p}_fx_norm`] = glyphBtn(Z.fx, fxGlyph, fxLime);
      out[`${p}_fx_empty`] = glyphBtn(Z.fx, fxGlyph, hex("#8c979d"));
      out[`${p}_fx_dis`] = glyphBtn(Z.fx, fxGlyph, hex("#ff7a5c"));
    }
    for (const o of ["h", "v"]) {
      out[`track_fxon_${o}`] = ledDraw(Z.fxLed, lime, true, 3.3);
      out[`track_fxoff_${o}`] = ledDraw(Z.fxLed, lime, false, 3.3);
      out[`track_fxempty_${o}`] = ringDraw(Z.fxLed, 3.1);
    }
    // Record arm: the track header's dot (red when armed); the mixer's dot and orange ring (FL's mixer).
    out.track_recarm_off = dotDraw(Z.dot, grey, "dot");
    out.track_recarm_on = dotDraw(Z.dot, arm, "lit");
    out.track_recarm_norec = dotDraw(Z.dot, darken(arm, 0.3), "lit");
    out.track_recarm_auto = dotDraw(Z.dot, arm, "ring");
    out.track_recarm_auto_on = dotDraw(Z.dot, arm, "lit");
    out.track_recarm_auto_norec = dotDraw(Z.dot, darken(arm, 0.3), "ring");
    out.mcp_recarm_off = dotDraw(Z.led, hex("#cbd3d8"), "dot", 2.4);
    out.mcp_recarm_on = dotDraw(Z.led, arm, "ring", 3.1);
    out.mcp_recarm_norec = dotDraw(Z.led, darken(arm, 0.3), "ring", 3.1);
    out.mcp_recarm_auto = dotDraw(Z.led, mixc(arm, grey, 0.4), "ring", 3.1);
    out.mcp_recarm_auto_on = dotDraw(Z.led, arm, "ring", 3.1);
    out.mcp_recarm_auto_norec = dotDraw(Z.led, darken(arm, 0.3), "ring", 3.1);
    // Arrows: the header's menu arrow (routing) and fold arrows; the mixer's routing arrow.
    const io = (ink: RGB) => glyphBtn(Z.arrow, (x, y) => tri(x, y, "r"), ink);
    for (const sfx of ["", "_r", "_s", "_s_r"]) {
      out[`track_io${sfx}`] = io(sfx ? hex("#e7eef2") : grey);
      out[`track_io${sfx}_dis`] = io(hex("#ff7a5c"));
      out[`mcp_io${sfx}`] = glyphBtn(Z.small, (x, y) => tri(x, y, "u"), sfx ? hex("#e7eef2") : hex("#cbd3d8"));
      out[`mcp_io${sfx}_dis`] = glyphBtn(Z.small, (x, y) => tri(x, y, "u"), hex("#ff7a5c"));
    }
    out.master_tcp_io = io(grey);
    out.master_mcp_io = glyphBtn(Z.small, (x, y) => tri(x, y, "u"), hex("#cbd3d8"));
    out.track_fcomp_off = glyphBtn(Z.arrow, (x, y) => tri(x, y, "d"), hex("#e7eef2"));
    out.track_fcomp_small = glyphBtn(Z.arrow, (x, y) => tri(x, y, "r"), hex(C.lime));
    out.track_fcomp_tiny = glyphBtn(Z.arrow, (x, y) => tri(x, y, "r"), hex(C.orange));
    // Row-2 extras on tall tracks (and the mixer's monitor): plain glyphs, no button faces.
    const envG = (x: number, y: number) => I.envelope(x, y, 9);
    out.track_env = glyphBtn(Z.small, envG, hex("#b1babf"));
    (["read", "touch", "write", "latch", "preview"] as const).forEach((m, i) => (out[`track_env_${m}`] = glyphBtn(Z.small, envG, k.c.env[i]!)));
    const folderG = (open: boolean) => (x: number, y: number) => I.folder(x, y, 8, open);
    out.track_folder_off = glyphBtn(Z.small, folderG(false), hex("#b1babf"));
    out.track_folder_on = glyphBtn(Z.small, folderG(true), hex(C.lime));
    out.track_folder_last = glyphBtn(Z.small, (x, y) => I.chevron(x, y, 7, -1), hex(C.orange));
    const phonesG = (x: number, y: number) => I.headphones(x, y, 9);
    for (const p of ["track", "mcp"]) {
      out[`${p}_monitor_off`] = glyphBtn(Z.small, phonesG, hex("#b1babf"));
      out[`${p}_monitor_on`] = glyphBtn(Z.small, phonesG, hex(C.orange));
      out[`${p}_monitor_auto`] = glyphBtn(Z.small, phonesG, hex(C.lime));
    }
    // The master's mono switch and the mixer menu: plain glyphs too.
    const rings = (x: number, y: number) => union(outline(circle(x - 2.2, y, 3.4), 1.1), outline(circle(x + 2.2, y, 3.4), 1.1));
    for (const p of ["track", "mcp"]) {
      out[`${p}_stereo`] = glyphBtn(Z.led, rings, hex("#b1babf"));
      out[`${p}_mono`] = glyphBtn(Z.led, (x, y) => outline(circle(x, y, 3.6), 1.3), hex(C.orange));
    }
    out.mixer_menu = glyphBtn(Z.small, (x, y) => I.menu(x, y, 8), hex("#cbd3d8"));
    // Polarity: FL's up/down arrows, orange when inverted.
    const phase = (x: number, y: number) => union(tri(x, y - 2.6, "u", 0.62), tri(x, y + 2.8, "d", 0.62));
    for (const p of ["track", "mcp"]) {
      out[`${p}_phase_norm`] = glyphBtn(Z.small, phase, hex("#cbd3d8"));
      out[`${p}_phase_inv`] = glyphBtn(Z.small, phase, hex(C.orange));
    }
    // Panels: header plates (tinted by the track colour), mixer strips, the top bar.
    out.tcp_bg = plate(hex(C.plate));
    out.tcp_bgsel = plate(hex(C.plateSel));
    out.tcp_mainbg = out.tcp_bg;
    out.tcp_mainbgsel = out.tcp_bgsel;
    out.tcp_folderbg = out.tcp_bg;
    out.tcp_folderbgsel = out.tcp_bgsel;
    out.mcp_bg = stripBg(hex(C.panel));
    out.mcp_bgsel = stripBg(hex(C.panelSel));
    out.mcp_mainbg = out.mcp_bg;
    out.mcp_mainbgsel = out.mcp_bgsel;
    out.mcp_folderbg = out.mcp_bg;
    out.mcp_folderbgsel = out.mcp_bgsel;
    out.transport_bg = stretch(24, 24, 2, (cv, s) => {
      cv.fill(rect(0, 0, 24, 24), solid(C.toolbar));
      cv.fill(rect(0, 24 - 1 / s, 24, 1 / s), solid("#4a5358"));
    });
    // Header pieces: the meter box and its selection outline.
    out.k_mbox = field(0.5, 2.5, false);
    out.k_mboxsel = selBox;
    out.k_mboxm = field(0.42, 2.5, false);
    // Knobs: the header's small volume knob, the ringed pan knobs; the mixer fader.
    out.tcp_vol_knob_stack = flKnob(Z.vol, false, false, hex(C.orange));
    out.tcp_pan_knob_stack = flKnob(Z.pan, true, true, hex(C.orange));
    out.tcp_wid_knob_stack = flKnob(Z.pan, true, true, hex("#a68cff"));
    out.mcp_pan_knob_stack = flKnob(Z.pan, true, true, hex(C.orange));
    out.mcp_wid_knob_stack = flKnob(Z.pan, true, true, hex("#a68cff"));
    out.mcp_vol_knob_stack = flKnob(Z.pan, true, false, hex(C.orange));
    out.mcp_volthumb = cap(Z.cap);
    out.mcp_volbg = groove(Z.fader);
    // REAPER's meter badges ("M", "!S" …) have no place in FL's meters.
    for (const b of ["meter_mute", "meter_unsolo", "meter_solodim", "meter_foldermute"]) out[b] = clear(16, 16);
    out.meter_automute = clear(20, 20);
    // Transport: [PAT/SONG | play | stop] pill, round record, LCDs.
    const [, pb, pc] = Z.pill as [Pair, Pair, Pair];
    const light = hex("#dfe6ea");
    out.transport_repeat_on = patSong(true);
    out.transport_repeat_off = patSong(false);
    const playG = (cv: Canvas, ink: RGB, f: Frame) => cv.fill(I.play(pb[0] / 2 + 1, pb[1] / 2 + (f === 2 ? 0.5 : 0), 10), solid(hov(ink, f)));
    const pauseG = (cv: Canvas, ink: RGB, f: Frame) => cv.fill(I.pause(pb[0] / 2, pb[1] / 2 + (f === 2 ? 0.5 : 0), 10), solid(hov(ink, f)));
    out.transport_play = pillSeg(pb, "mid", (cv, f) => playG(cv, light, f));
    out.transport_play_on = pillSeg(pb, "mid", (cv, f) => pauseG(cv, hex("#ffb24e"), f));
    out.transport_play_sync = pillSeg(pb, "mid", (cv, f) => playG(cv, hex(C.lime), f));
    out.transport_play_sync_on = pillSeg(pb, "mid", (cv, f) => pauseG(cv, hex(C.lime), f));
    out.transport_pause = pillSeg(pb, "mid", (cv, f) => pauseG(cv, light, f));
    out.transport_pause_on = pillSeg(pb, "mid", (cv, f) => pauseG(cv, hex("#ffb24e"), f));
    out.transport_stop = pillSeg(pc, "right", (cv, f) => cv.fill(I.stop(pc[0] / 2 - 1, pc[1] / 2 + (f === 2 ? 0.5 : 0), 9), solid(hov(light, f))));
    const red = hex("#ff5f57");
    out.transport_record = recBtn(red, false);
    out.transport_record_on = recBtn(hex("#ff7a6e"), true);
    out.transport_record_item = recBtn(mixc(red, hex(C.orange), 0.5), false);
    out.transport_record_item_on = recBtn(mixc(red, hex(C.orange), 0.5), true);
    out.transport_record_loop = recBtn(mixc(red, hex(C.lime), 0.3), false);
    out.transport_record_loop_on = recBtn(mixc(red, hex(C.lime), 0.3), true);
    out.k_tempo = lcd(hex(C.lcdLight), ...Z.tempo, 3, false);
    out.k_lcd_light = lcd(hex(C.lcdLight), 24, 20, 3, true);
    // The tempo field sits inside k_tempo: a flat fill, so the two read as one LCD.
    out.transport_bpm_bg = stretch(8, 8, 2, (cv) => cv.fill(rect(0, 0, 8, 8), solid(C.lcdLight)));
    out.k_display = lcd(hex(C.lcd), 24, 20, 3, true);
    // The status element's background: the teal panel at its left (fixed), then the bar's colour.
    out.transport_status_bg = (s) => {
      const [pw, ph] = STATUS;
      const cv = new Canvas(pw + 8, ph, s);
      cv.fill(rect(0, 0, pw + 8, ph), solid(C.toolbar));
      lcdPaint(cv, hex(C.lcd), 0, 0, pw, ph, 3);
      return withGuides(bitmap(cv), Math.round((pw + 4) * s), 0, Math.round(2 * s), 0);
    };
    // Time signature and selection fields: dark recessed fields.
    out.transport_edit_bg = stretch(24, 20, 4, (cv, s) => {
      const px = 1 / s, sh = rrect(0, 0, 24, 20, 3);
      cv.fill(sh, solid(C.pill));
      cv.fill(intersect(outline(rrect(px, px, 24 - 2 * px, 20 - 2 * px, 3), px), rect(0, 0, 24, 6)), solid([0, 0, 0], 0.25));
      cv.fill(outline(sh, px), solid(C.pillLine));
    });
    // Meters: no clip box until the signal clips (FL's meters are plain bars).
    const mc = k.c.meter;
    out.meter_clip_v = exact(4, 8, (_x, y) => (y < 4 ? mc.off : mc.clip));
    out.meter_clip_h = exact(8, 4, (x) => (x < 4 ? mc.off : mc.clip));
    // Clips: FL's title strip (the clip colour, holding the name) over a darker slate body, thin dark
    // edges; selected clips take FL's red selection tint. 9-slice overlays: the strip keeps its height.
    const BAND = 15;
    const clip = (sel: boolean): Draw => (s) => {
      const wd = 16, ht = BAND + 9;
      const cv = new Canvas(wd, ht, s);
      const px = 1 / s;
      cv.fill(rect(0, BAND, wd, ht - BAND), solid("#14222b", 0.42));
      if (sel) cv.fill(rect(0, 0, wd, ht), solid("#ff4a4a", 0.3));
      cv.fill(rect(0, px, wd, px), solid([255, 255, 255], 0.08));
      cv.fill(rect(0, BAND, wd, px), solid([0, 0, 0], 0.3));
      const edge = subtract(rect(0, 0, wd, ht), rect(px, px, wd - 2 * px, ht - 2 * px));
      cv.fill(edge, sel ? solid("#ffb4b4", 0.95) : solid([0, 0, 0], 0.5));
      const g = Math.ceil(2 * s);
      return withGuides(bitmap(cv), g, Math.round((BAND + 1) * s), g, g);
    };
    // Toggled toolbar buttons keep just their lit (orange) glyph, as FL's tools do: no glow behind them.
    out.animation_toolbar_highlight = (s) => bitmap(new Canvas(30, 360, s));
    // No selection dot on clips (REAPER's "selection indicator" draws this image): FL shows selection by the red tint.
    out.item_seldot = clear(8, 8);
    out.item_bg = clip(false);
    out.item_bg_sel = clip(true);
    out.midi_note_colormap = noteMap(k);
  },
  toolbarGlyphs,
  // FL's toolbar icons are near-white; the active tool lights cyan (playlist / piano-roll tools), other
  // toggles (snap, metronome, windows, pattern/song) light orange like FL's main toolbar.
  toolbarInk: {
    normal: "#dde5ea",
    hover: "#ffffff",
    on: C.orange,
    icons: Object.fromEntries(["draw", "paint", "delete", "mute", "slice", "select"].map((t) => [`assist_fl_${t}`, { on: "#90ecff" }])),
  },
};

export default fl;
