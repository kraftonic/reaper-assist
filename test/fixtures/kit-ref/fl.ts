import type { SkinUi } from "@profiles/skins";
import { led } from "@profiles/kit/art";
import { darken, hex, lighten, mixc } from "@profiles/kit/raster";
import { DEFAULT_ENV, type Kit, type KitDef, type KitSizes } from "@profiles/kit/types";
import { CENTER, extMixer, fill, H, meterLook, ON_COLOR, r1, rgb, type Script, TRACK_FILL, transDisplay, W, WIDE_TCP } from "@profiles/kit/walter";

/**
 * FL Studio: glossy, rounded controls lit from above on a dark slate panel. Tracks
 * carry a number block in the track colour, a "track on" LED, pan and volume knobs
 * and a name plate; mixer inserts stack solo, pan / width, a fader beside a wide
 * meter, and the name at the bottom. Transport buttons come first, then LCD-style
 * tempo and song position.
 */

function palette(ui: SkinUi): Kit {
  const u = (k: keyof SkinUi) => hex(ui[k]);
  return {
    id: "fl",
    look: "gloss",
    radius: 4,
    c: {
      bg: u("bg"),
      panel: u("panel"),
      track: u("panelAlt"),
      trackSel: lighten(u("panelAlt"), 0.1),
      face: lighten(u("panelAlt"), 0.12),
      line: lighten(u("panelAlt"), 0.08),
      deep: u("border"),
      text: u("text"),
      dim: u("textDim"),
      accent: u("accent"),
      accent2: u("accent2"),
      solo: u("accent2"),
      arm: hex("#ff4d3d"),
      play: u("accent2"),
      onInk: hex("#1a1206"),
      env: DEFAULT_ENV,
      display: darken(u("bg"), 0.45),
      displayText: lighten(u("accent2"), 0.25),
      meter: { off: darken(u("bg"), 0.45), low: u("accent2"), mid: hex("#d8e25a"), high: u("accent"), clip: hex("#ff4d3d") },
    },
  };
}

const SIZES: KitSizes = {
  tcpMute: [16, 16], tcpBtn: [24, 20], tcpSmall: [22, 20], tcpFx: [28, 20], tcpKnob: 20, tcpThumb: [12, 16],
  mcpMute: [16, 16], mcpBtn: [36, 18], mcpArm: [28, 18], mcpMon: [28, 18], mcpSmall: [20, 18], mcpKnob: 26, mcpThumb: [30, 14], mcpFaderW: 24,
  envBtn: [20, 18], envKnob: 18, trans: [32, 26], tap: [36, 26], menu: [20, 18], toolbar: 30,
};

function tcp(k: Kit, w: Script) {
  const z = SIZES, c = k.c;
  // A number block in the track colour down the left edge.
  w.custom("tcp.custom.kIdx");
  w.set("tcp.custom.kIdx", w.p(0, 0, 22, H()));
  w.set("tcp.custom.kIdx.color", `?trackcolor_valid ${TRACK_FILL} ${fill(mixc(c.track, c.dim, 0.22))}`);
  w.tall(16, "tcp.trackidx", r1(w, 0, 22));
  w.set("tcp.trackidx.color", `?trackcolor_valid ${ON_COLOR} [${rgb(c.text)}]`);
  w.set("tcp.trackidx.font", w.font("value"));
  w.set("tcp.trackidx.margin", CENTER);
  // Row 1: on LED | pan | volume | name plate | solo, arm, FX.
  w.tall(16, "tcp.mute", r1(w, 26, 16, 16, 2));
  w.tall(16, "tcp.pan", r1(w, 46, z.tcpKnob, z.tcpKnob));
  w.set("tcp.pan.fadermode", "[1]");
  w.tall(16, "tcp.volume", r1(w, 68, z.tcpKnob, z.tcpKnob));
  w.set("tcp.volume.fadermode", "[1]");
  w.custom("tcp.custom.kPlate", "k_nameplate");
  w.tall(16, "tcp.custom.kPlate", r1(w, 92, W(-182)));
  w.set("tcp.label", "tcp.custom.kPlate");
  w.set("tcp.label.margin", `[${w.n(7)} 0 ${w.n(4)} 0 0]`);
  w.set("tcp.label.font", w.font("label"));
  w.set("tcp.label.color", `?track_selected [${rgb(lighten(c.text, 0.4))}] [${rgb(c.text)}]`);
  w.tall(16, "tcp.solo", `+ kY ${w.at(W(-86), 0, z.tcpBtn)}`);
  w.tall(16, "tcp.recarm", `+ kY ${w.at(W(-60), 0, z.tcpBtn)}`);
  w.tall(16, "tcp.fx", `+ kY ${w.at(W(-32), 0, z.tcpFx)}`);
  // Row 2: folder collapse (in the colour block) | monitor, routing, automation, folder | input when wide | meter.
  w.tall(48, "tcp.foldercomp", `folderstate==1 ${w.at(0, 28, z.tcpSmall)} [0]`);
  w.tall(48, "tcp.recmon", w.at(26, 28, z.tcpSmall));
  w.tall(48, "tcp.io", w.at(50, 28, z.tcpSmall));
  w.tall(48, "tcp.env", w.at(74, 28, z.tcpSmall));
  w.tall(48, "tcp.folder", w.at(98, 28, z.tcpSmall));
  const inWide = w.p(126, 28, 200, 20);
  const inRow3 = w.p(26, 52, W(-56), 20);
  w.set("tcp.recinput", `h<${w.n(48)} [0] ${w.wide(WIDE_TCP, inWide, `h<${w.n(72)} [0] ${inRow3}`)}`);
  w.set("tcp.recmode", `h<${w.n(48)} [0] ${w.wide(WIDE_TCP, w.at(328, 28, z.tcpSmall), `h<${w.n(72)} [0] ${w.at(W(-26), 52, z.tcpSmall)}`)}`);
  w.tall(48, "tcp.meter", w.wide(WIDE_TCP, w.p(356, 32, W(-360), 12), w.p(126, 32, W(-130), 12)));
  meterLook(w, "tcp.meter", k, { scale: false, readout: true });
  w.set("tcp.fxparm", `h<${w.n(100)} [0] ${w.wide(WIDE_TCP, w.p(26, 52, W(-30), H(-56)), w.p(26, 76, W(-30), H(-80)))}`);
}

function masterTcp(k: Kit, w: Script) {
  const z = SIZES, c = k.c;
  w.custom("master.tcp.custom.kIdx");
  w.set("master.tcp.custom.kIdx", w.p(0, 0, 22, H()));
  w.set("master.tcp.custom.kIdx.color", fill(mixc(c.track, c.dim, 0.22)));
  w.tall(16, "master.tcp.mute", r1(w, 26, 16, 16, 2));
  w.tall(16, "master.tcp.pan", r1(w, 46, z.tcpKnob, z.tcpKnob));
  w.set("master.tcp.pan.fadermode", "[1]");
  w.tall(16, "master.tcp.volume", r1(w, 68, z.tcpKnob, z.tcpKnob));
  w.set("master.tcp.volume.fadermode", "[1]");
  w.custom("master.tcp.custom.kPlate", "k_nameplate");
  w.tall(16, "master.tcp.custom.kPlate", r1(w, 92, W(-182)));
  w.set("master.tcp.label", "master.tcp.custom.kPlate");
  w.set("master.tcp.label.margin", `[${w.n(7)} 0 0 0 0]`);
  w.set("master.tcp.label.font", w.font("label"));
  w.set("master.tcp.label.color", `[${rgb(c.text)}]`);
  w.tall(16, "master.tcp.solo", `+ kY ${w.at(W(-86), 0, z.tcpBtn)}`);
  w.tall(16, "master.tcp.mono", `+ kY ${w.at(W(-60), 0, z.tcpBtn)}`);
  w.tall(16, "master.tcp.fx", `+ kY ${w.at(W(-32), 0, z.tcpFx)}`);
  w.tall(48, "master.tcp.io", w.at(26, 28, z.tcpSmall));
  w.tall(48, "master.tcp.env", w.at(50, 28, z.tcpSmall));
  w.tall(48, "master.tcp.meter", w.p(78, 32, W(-82), 12));
  meterLook(w, "master.tcp.meter", k, { scale: false, readout: true });
}

function mcp(k: Kit, w: Script, { master }: { master: boolean }) {
  const z = SIZES, c = k.c;
  const X = master ? "master.mcp" : "mcp";
  const S = master ? MCP_W.master : MCP_W.track;
  // Insert number bar in the track colour.
  w.custom(`${X}.custom.kIdx`);
  w.set(`${X}.custom.kIdx`, w.p(0, 0, W(), 16));
  w.set(`${X}.custom.kIdx.color`, master ? fill(mixc(c.track, c.dim, 0.22)) : `?trackcolor_valid ${TRACK_FILL} ${fill(mixc(c.track, c.dim, 0.22))}`);
  if (!master) {
    w.set("mcp.trackidx", "mcp.custom.kIdx");
    w.set("mcp.trackidx.color", `?trackcolor_valid ${ON_COLOR} [${rgb(c.text)}]`);
    w.set("mcp.trackidx.font", w.font("value"));
    w.set("mcp.trackidx.margin", CENTER);
  }
  // On LED | solo (| mono).
  w.set(`${X}.mute`, w.at(5, 21, z.mcpMute));
  w.set(`${X}.solo`, w.at(master ? 26 : 28, 20, z.mcpBtn));
  if (master) w.set("master.mcp.mono", w.at(64, 20, z.mcpBtn));
  // Pan and stereo width knobs.
  const kn = z.mcpKnob;
  if (master) {
    w.set("master.mcp.pan", w.p(24, 42, kn, kn));
    w.set("master.mcp.width", w.p(54, 42, kn, kn));
    w.set("master.mcp.width.fadermode", "[1]");
  } else {
    w.set("mcp.pan", `trackpanmode>=5 ${w.p(7, 42, kn, kn)} ${w.p((S - kn) / 2, 42, kn, kn)}`);
    w.set("mcp.width", `trackpanmode>=5 ${w.p(35, 42, kn, kn)} [0]`);
    w.set("mcp.width.fadermode", "[1]");
  }
  // FX | routing | automation (| menu), segmented.
  const [sw] = z.mcpSmall;
  const x0 = master ? 12 : 4;
  w.set(`${X}.fx`, w.at(x0, 72, z.mcpSmall));
  w.set(`${X}.io`, w.at(x0 + sw, 72, z.mcpSmall));
  w.set(`${X}.env`, w.at(x0 + 2 * sw, 72, z.mcpSmall));
  if (master) w.set("master.mcp.menubutton", w.at(x0 + 3 * sw, 72, z.menu));
  extMixer(w, X, 94);
  // Fader + meter, then arm | monitor, then the name plate.
  const fw = Math.max(z.mcpFaderW, z.mcpThumb[0]);
  const bottom = master ? 26 : 48;
  w.set(`${X}.volume`, `+ kE2 ${w.p(2, 94, fw, H(-94 - bottom))}`);
  w.set(`${X}.meter`, `+ kE2 ${w.p(fw + 6, 94, S - fw - 10, H(-94 - bottom))}`);
  meterLook(w, `${X}.meter`, k, { scale: true, readout: true });
  if (!master) {
    w.set("mcp.recarm", w.at(4, H(-44), z.mcpArm));
    w.set("mcp.recmon", w.at(36, H(-44), z.mcpMon));
  }
  w.custom(`${X}.custom.kPlate`, "k_nameplate_mcp");
  w.set(`${X}.custom.kPlate`, w.p(2, H(-22), W(-4), 20));
  w.set(`${X}.label`, `${X}.custom.kPlate`);
  w.set(`${X}.label.margin`, `[${w.n(3)} 0 ${w.n(3)} 0 0.5]`);
  w.set(`${X}.label.font`, w.font("label"));
  w.set(`${X}.label.color`, `?track_selected [${rgb(lighten(c.text, 0.4))}] [${rgb(c.text)}]`);
}

function trans(_k: Kit, w: Script) {
  const z = SIZES;
  const [bw, bh] = z.trans;
  const y = (36 - bh) / 2;
  // Buttons first, then LCD-style tempo, signature and song position; selection on the right.
  const order: [string, number][] = [["trans.play", 8], ["trans.pause", 42], ["trans.stop", 76], ["trans.rec", 110], ["trans.repeat", 150], ["trans.rew", 190], ["trans.fwd", 224]];
  for (const [name, x] of order) w.set(name, w.p(x, y, bw, bh));
  w.set("trans.bpm.tap", w.at(266, y, z.tap));
  const lcdTempo = w.p(306, y, 72, bh);
  transDisplay(w, "Tempo", lcdTempo);
  w.set("trans.bpm.edit", lcdTempo);
  w.set("trans.bpm.edit.font", w.font("tempo"));
  const sig = w.p(382, y, 44, bh);
  transDisplay(w, "Sig", `trans_flags&4 ${sig} [0]`);
  w.set("trans.curtimesig", `trans_flags&4 ${sig} [0]`);
  const status = `w<${w.n(824)} [0] ${w.wide(1044, w.p(434, y, 300, bh), w.p(434, y, W(-744), bh))}`;
  transDisplay(w, "Status", status);
  w.set("trans.status", status);
  w.set("trans.automode", `w<${w.n(980)} [0] ${w.p(W(-300), y, bw, bh)}`);
  w.set("trans.sel", `w<${w.n(980)} [0] ${w.p(W(-262), y, 254, bh)}`);
}

const MCP_W = { track: 68, master: 104 };

const fl: KitDef = {
  id: "fl",
  palette,
  sizes: SIZES,
  mcpWidth: MCP_W,
  // The LCD tempo in the largest font.
  fonts: { tempo: 5 },
  layout: { tcp, masterTcp, mcp, trans },
  images(k, out) {
    // Mute is a round "track on" LED: lit = the track plays.
    for (const [prefix, [w, h]] of [["track", SIZES.tcpMute], ["mcp", SIZES.mcpMute]] as const) {
      out[`${prefix}_mute_off`] = led(k, w, h, true);
      out[`${prefix}_mute_on`] = led(k, w, h, false);
    }
  },
};

export default fl;
