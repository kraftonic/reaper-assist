import type { SkinUi } from "@profiles/skins";
import { fillImg, marker, SCALE_H, SCALE_MARKS, SCALE_W, scaleMark } from "@profiles/kit/art";
import { darken, hex, lighten } from "@profiles/kit/raster";
import { DEFAULT_ENV, type Kit, type KitDef, type KitSizes, type MeterRange } from "@profiles/kit/types";
import { CENTER, extMixer, fg, fill, framedBox, H, meterLook, ON_COLOR, r1, rgb, type Script, TRACK_FILL, transDisplay, W, WIDE_TCP } from "@profiles/kit/walter";

/**
 * Ableton Live: flat, square, matte controls with dark hairlines on mid-grey. Tracks
 * carry a name box in the track colour and a track switch, solo and arm; the mixer
 * strip is Live's session view (a volume marker running beside the meter, with a dB
 * scale). The transport centres its buttons between tempo and selection.
 */

function palette(ui: SkinUi): Kit {
  const u = (k: keyof SkinUi) => hex(ui[k]);
  // Live's classic light look (values from the stock "Live 9" skin): mid-grey surfaces,
  // square buttons with a dark hairline, black ink, a yellow track switch, blue solo,
  // red arm, light value boxes, knobs as open dark rings with an orange value arc, and
  // green-to-lime meters on near-black.
  return {
    id: "ableton",
    look: "flat",
    radius: 0,
    c: {
      bg: u("bg"),
      panel: u("bg"),
      track: u("bg"),
      trackSel: hex("#b5b2b1"),
      face: u("panel"),
      line: u("border"),
      deep: hex("#323232"),
      text: u("text"),
      dim: u("textDim"),
      accent: u("accent"),
      accent2: u("accent2"),
      solo: hex("#2883c9"),
      arm: hex("#ff3223"),
      play: hex("#50fe1e"),
      onInk: hex("#111111"),
      env: DEFAULT_ENV,
      display: hex("#bfbfbf"),
      displayText: u("text"),
      knob: hex("#f26000"),
      notes: { off: hex("#232834"), on: hex("#ff1200"), bg: hex("#b4b4b4") },
      meter: { off: hex("#181e23"), low: hex("#0af864"), mid: hex("#5ff864"), high: hex("#c6f864"), clip: hex("#ff0a0a") },
    },
  };
}

const SIZES: KitSizes = {
  tcpMute: [24, 20], tcpBtn: [24, 20], tcpSmall: [22, 20], tcpFx: [26, 20], tcpKnob: 20, tcpThumb: [6, 16],
  // Mixer: a 28×22 track switch over 28×16 solo and arm, a 28px pan knob, and the volume
  // as a small triangle that runs beside the meter. Monitoring sits in the top row with
  // FX, routing and automation, at their size.
  mcpMute: [28, 22], mcpBtn: [28, 16], mcpArm: [28, 16], mcpMon: [19, 18], mcpSmall: [19, 18], mcpKnob: 28, mcpThumb: [8, 10], mcpFaderW: 8,
  envBtn: [20, 18], envKnob: 18, trans: [30, 24], tap: [38, 24], menu: [19, 18], toolbar: 30,
};

function tcp(k: Kit, w: Script) {
  const z = SIZES, c = k.c;
  // Row 1: name box in the track colour | number | track switch, solo, arm | meter down the right edge.
  // (REAPER gives clicks on the number to the number, so it can't sit on the switch as in Live.)
  w.tall(16, "tcp.foldercomp", `folderstate==1 ${r1(w, 4, 22)} [0]`);
  framedBox(w, "tcp.custom.kName", `folderstate==1 ${r1(w, 28, W(-148))} ${r1(w, 4, W(-124))}`, 16, darken(c.deep, 0.15), `?trackcolor_valid ${TRACK_FILL} ?track_selected ${fill(lighten(c.face, 0.14))} ${fill(c.face)}`);
  w.set("tcp.label", "tcp.custom.kName");
  w.set("tcp.label.margin", `[${w.n(6)} 0 ${w.n(4)} 0 0]`);
  w.set("tcp.label.font", w.font("label"));
  w.set("tcp.label.color", `?trackcolor_valid ${ON_COLOR} [${rgb(c.text)}]`);
  w.raw("front tcp.label");
  w.tall(16, "tcp.trackidx", r1(w, W(-118), 24));
  w.set("tcp.trackidx.color", fg(c.text));
  w.set("tcp.trackidx.font", w.font("value"));
  w.set("tcp.trackidx.margin", `[0 0 ${w.n(3)} 0 1]`);
  w.tall(16, "tcp.mute", `+ kY ${w.at(W(-92), 0, z.tcpMute)}`);
  w.tall(16, "tcp.solo", `+ kY ${w.at(W(-66), 0, z.tcpBtn)}`);
  w.tall(16, "tcp.recarm", `+ kY ${w.at(W(-40), 0, z.tcpBtn)}`);
  w.tall(16, "tcp.meter", `+ kY ${w.p(W(-12), 0, 8, H(-8))}`);
  meterLook(w, "tcp.meter", k, { scale: false, readout: false });

  // Row 2: folder, FX, monitor, routing, automation | volume slider (capped) | dB box | pan.
  w.tall(48, "tcp.folder", w.at(4, 28, z.tcpSmall));
  w.tall(48, "tcp.fx", w.at(28, 28, z.tcpFx));
  w.tall(48, "tcp.recmon", w.at(56, 28, z.tcpSmall));
  w.tall(48, "tcp.io", w.at(80, 28, z.tcpSmall));
  w.tall(48, "tcp.env", w.at(104, 28, z.tcpSmall));
  const th = z.tcpThumb[1];
  const sy = 28 + (20 - th) / 2;
  w.tall(48, "tcp.volume", w.wide(390, w.p(W(-258), sy, 160, th), w.p(132, sy, W(-230), th)));
  w.set("tcp.volume.fadermode", "[-1]");
  w.custom("tcp.custom.kDb", "k_display");
  w.tall(48, "tcp.custom.kDb", w.p(W(-92), 28, 50, 20));
  w.tall(48, "tcp.volume.label", w.p(W(-92), 28, 50, 20));
  w.set("tcp.volume.label.color", fg(c.text));
  w.set("tcp.volume.label.font", w.font("value"));
  w.set("tcp.volume.label.margin", CENTER);
  w.tall(48, "tcp.pan", w.p(W(-38), 28, 20, 20));
  w.set("tcp.pan.fadermode", "[1]");

  // Input: row 2 when the panel is wide, else row 3.
  const inWide = w.p(132, 28, W(-424), 20);
  const inRow3 = w.p(28, 52, W(-124), 20);
  w.set("tcp.recinput", `h<${w.n(48)} [0] ${w.wide(WIDE_TCP, inWide, `h<${w.n(72)} [0] ${inRow3}`)}`);
  w.set("tcp.recmode", `h<${w.n(48)} [0] ${w.wide(WIDE_TCP, w.at(W(-286), 28, z.tcpSmall), `h<${w.n(72)} [0] ${w.at(W(-92), 52, z.tcpSmall)}`)}`);
  w.set("tcp.fxparm", `h<${w.n(100)} [0] ${w.wide(WIDE_TCP, w.p(28, 52, W(-44), H(-56)), w.p(28, 76, W(-44), H(-80)))}`);
}

function masterTcp(k: Kit, w: Script) {
  const z = SIZES, c = k.c;
  framedBox(w, "master.tcp.custom.kName", r1(w, 4, W(-100)), 16, darken(c.deep, 0.15), fill(c.face));
  w.set("master.tcp.label", "master.tcp.custom.kName");
  w.set("master.tcp.label.margin", `[${w.n(6)} 0 0 0 0]`);
  w.set("master.tcp.label.font", w.font("label"));
  w.set("master.tcp.label.color", `[${rgb(c.text)}]`);
  w.raw("front master.tcp.label");
  w.tall(16, "master.tcp.mute", `+ kY ${w.at(W(-92), 0, z.tcpMute)}`);
  w.tall(16, "master.tcp.solo", `+ kY ${w.at(W(-66), 0, z.tcpBtn)}`);
  w.tall(16, "master.tcp.mono", `+ kY ${w.at(W(-40), 0, z.tcpBtn)}`);
  w.tall(16, "master.tcp.meter", `+ kY ${w.p(W(-12), 0, 8, H(-8))}`);
  meterLook(w, "master.tcp.meter", k, { scale: false, readout: false });
  w.tall(48, "master.tcp.fx", w.at(4, 28, z.tcpFx));
  w.tall(48, "master.tcp.io", w.at(32, 28, z.tcpSmall));
  w.tall(48, "master.tcp.env", w.at(56, 28, z.tcpSmall));
  const th = z.tcpThumb[1], sy = 28 + (20 - th) / 2;
  w.tall(48, "master.tcp.volume", w.wide(342, w.p(W(-258), sy, 160, th), w.p(84, sy, W(-182), th)));
  w.set("master.tcp.volume.fadermode", "[-1]");
  w.custom("master.tcp.custom.kDb", "k_display");
  w.tall(48, "master.tcp.custom.kDb", w.p(W(-92), 28, 50, 20));
  w.tall(48, "master.tcp.volume.label", w.p(W(-92), 28, 50, 20));
  w.set("master.tcp.volume.label.color", fg(c.text));
  w.set("master.tcp.volume.label.font", w.font("value"));
  w.set("master.tcp.volume.label.margin", CENTER);
  w.tall(48, "master.tcp.pan", w.p(W(-38), 28, 20, 20));
  w.set("master.tcp.pan.fadermode", "[1]");
}

/** dB marks beside the mixer meter, with the image each uses. */
const MARKS: [number, string][] = [[6, "k_sc_p6"], [0, "k_sc_0"], [-6, "k_sc_6"], [-12, "k_sc_12"], [-18, "k_sc_18"], [-24, "k_sc_24"], [-30, "k_sc_tick"], [-36, "k_sc_36"], [-42, "k_sc_tick"], [-48, "k_sc_48"], [-54, "k_sc_tick"]];

/**
 * Live's session-view strip: the name on top, then FX / routing / automation / monitoring,
 * the sends and inserts (extended mixer), and the main section: a left column with the
 * volume box and pan knob at the top and number, track switch, solo and arm at the bottom;
 * on the right the volume marker, the meter and a dB scale.
 *
 * REAPER's meter runs linearly in dB from `meter` max (top) to min (bottom), so the scale marks are
 * placed at (max − dB) / (max − min) of the meter's height.
 */
function mcp(k: Kit, w: Script, { master, range }: { master: boolean; range: MeterRange }) {
  const z = SIZES, c = k.c;
  const X = master ? "master.mcp" : "mcp";
  // Name header in the track colour.
  w.custom(`${X}.custom.kName`);
  w.set(`${X}.custom.kName`, w.p(0, 0, W(), 20));
  w.set(`${X}.custom.kName.color`, master ? fill(c.face) : `?trackcolor_valid ${TRACK_FILL} ?track_selected ${fill(lighten(c.face, 0.14))} ${fill(c.face)}`);
  w.set(`${X}.label`, `${X}.custom.kName`);
  w.set(`${X}.label.margin`, `[${w.n(4)} 0 ${w.n(4)} 0 0.5]`);
  w.set(`${X}.label.font`, w.font("label"));
  w.set(`${X}.label.color`, master ? `[${rgb(c.text)}]` : `?trackcolor_valid ${ON_COLOR} [${rgb(c.text)}]`);
  // FX | routing | automation | monitoring (master: menu), as one segmented row.
  const [sw] = z.mcpSmall;
  w.set(`${X}.fx`, w.at(4, 23, z.mcpSmall));
  w.set(`${X}.io`, w.at(4 + sw, 23, z.mcpSmall));
  w.set(`${X}.env`, w.at(4 + 2 * sw, 23, z.mcpSmall));
  if (master) w.set("master.mcp.menubutton", w.at(4 + 3 * sw, 23, z.menu));
  else w.set("mcp.recmon", w.at(4 + 3 * sw, 23, z.mcpMon));
  const T = 44;
  extMixer(w, X, T);
  // Left column, top: volume box and pan knob.
  w.custom(`${X}.custom.kDb`, "k_display");
  w.set(`${X}.custom.kDb`, `+ kE ${w.p(3, T + 4, 42, 16)}`);
  w.set(`${X}.volume.label`, `+ kE ${w.p(3, T + 4, 42, 16)}`);
  w.set(`${X}.pan`, `+ kE ${w.p(10, T + 26, z.mcpKnob, z.mcpKnob)}`);
  // Left column, bottom: number, track switch, solo, arm (master: mono).
  if (!master) {
    w.set("mcp.trackidx", w.p(10, H(-78), 28, 14));
    w.set("mcp.trackidx.color", fg(c.text));
    w.set("mcp.trackidx.font", w.font("value"));
    w.set("mcp.trackidx.margin", CENTER);
  }
  w.set(`${X}.mute`, w.at(10, H(-62), z.mcpMute));
  w.set(`${X}.solo`, w.at(10, H(-38), z.mcpBtn));
  if (master) w.set("master.mcp.mono", w.at(10, H(-20), z.mcpArm));
  else w.set("mcp.recarm", w.at(10, H(-20), z.mcpArm));
  // Right: volume marker | meter | scale, all over the same height.
  const top = T + 4, bot = 4;
  const [tw, th] = z.mcpThumb;
  // The marker's centre travels exactly the meter's height.
  w.set(`${X}.volume`, `+ kE2 ${w.p(47, top - th / 2, tw, H(-(top + bot) + th))}`);
  w.set(`${X}.meter`, `+ kE2 ${w.p(56, top, 12, H(-(top + bot)))}`);
  meterLook(w, `${X}.meter`, k, { scale: false, readout: false });
  const span = range.max - range.min;
  MARKS.forEach(([db, image], i) => {
    if (db > range.max || db < range.min) return;
    const f = (range.max - db) / span;
    const name = `${X}.custom.kSc${i}`;
    w.custom(name, image);
    // y = top + kE + f·(h − top − bot − kE) − half the mark's height
    w.set(name, `+ * ${+(1 - f).toFixed(4)} kE ${w.p(68, H(top - f * (top + bot) - SCALE_H / 2, +f.toFixed(4)), SCALE_W, SCALE_H)}`);
  });
}

function trans(_k: Kit, w: Script) {
  const z = SIZES;
  const [bw, bh] = z.trans;
  const y = (36 - bh) / 2;
  w.set("trans.bpm.tap", w.at(8, y, z.tap));
  // TAP | tempo | signature, the position display, then the buttons centred, selection on the right.
  const tempo = w.p(50, y, 64, bh);
  transDisplay(w, "Tempo", tempo);
  w.set("trans.bpm.edit", tempo);
  w.set("trans.bpm.edit.font", w.font("tempo"));
  const sig = w.p(118, y, 44, bh);
  transDisplay(w, "Sig", `trans_flags&4 ${sig} [0]`);
  w.set("trans.curtimesig", `trans_flags&4 ${sig} [0]`);
  const c0 = (dx: number) => W(dx, 0.5);
  const status = `w<${w.n(700)} [0] ${w.wide(1046, w.p(c0(-353), y, 220, bh), w.p(170, y, W(-303, 0.5), bh))}`;
  transDisplay(w, "Status", status);
  w.set("trans.status", status);
  const order: [string, number][] = [["trans.rew", -125], ["trans.fwd", -93], ["trans.play", -55], ["trans.stop", -23], ["trans.pause", 9], ["trans.rec", 41], ["trans.repeat", 79], ["trans.automode", 117]];
  for (const [name, dx] of order) w.set(name, w.p(c0(dx), y, bw, bh));
  w.set("trans.sel", `w<${w.n(840)} [0] ${w.p(W(-262), y, 254, bh)}`);
}

const ableton: KitDef = {
  id: "ableton",
  palette,
  sizes: SIZES,
  mcpWidth: { track: 84, master: 84 },
  layout: { tcp, masterTcp, mcp, trans },
  images(k, out) {
    // The mixer volume is a small triangle beside the meter, with no visible track, and a dB scale.
    out.mcp_volbg = fillImg(k.c.panel, 0);
    out.mcp_volthumb = marker(k, SIZES.mcpThumb[0], SIZES.mcpThumb[1]);
    for (const [name, label] of SCALE_MARKS) out[name] = scaleMark(k, label);
  },
};

export default ableton;
