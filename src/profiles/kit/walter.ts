import type { RGB } from "./raster";
import { DEFAULT_FONTS, type Kit, type KitDef, type KitFonts, type KitSizes, type MeterRange } from "./types";

/**
 * The kit's own layout script (rtconfig.txt, REAPER's "WALTER" language):
 * where every control sits on the track panel, the mixer strip, the master,
 * envelope lanes and the transport.
 *
 * This file holds the shared frame and building blocks; each DAW's placement of
 * controls is its KitDef.layout hooks (daws/<id>.ts).
 *
 * Positions are computed from the panel's live width and height (WALTER's `w`
 * and `h`), not stretched: clusters keep their size and stick to an edge,
 * sliders grow only up to a cap, and rows appear as the panel gets taller.
 * Everything sits on a 4px grid with 20px rows. Coordinates are written in base
 * units and multiplied out for each scale (100 / 150 / 200 %); element sizes come
 * from the kit's sizes so each control is exactly the size of its artwork.
 */

/** A coordinate: a constant, or c + k·(panel width | height). Constants are in base units. */
export type V = number | { v: "w" | "h"; k: number; c: number };
export const W = (c = 0, k = 1): V => ({ v: "w", k, c });
export const H = (c = 0, k = 1): V => ({ v: "h", k, c });

/** One scale's layout lines. */
export class Script {
  readonly lines: string[] = [];
  /** Names `set` so far, so shared styling written after a kit's hook can yield to it. */
  private readonly named = new Set<string>();
  constructor(
    readonly s: number,
    readonly fonts: KitFonts = DEFAULT_FONTS,
  ) {}
  n = (v: number) => Math.round(v * this.s);
  /** A rect [x y w h]; values may follow the panel's width/height. */
  p = (...vals: V[]): string => {
    let expr = `[${vals.map((v) => this.n(typeof v === "number" ? v : v.c)).join(" ")}]`;
    const groups = new Map<string, string[]>();
    vals.forEach((v, i) => {
      if (typeof v === "number") return;
      const key = `${v.v}:${v.k}`;
      const g = groups.get(key) ?? vals.map(() => "0");
      g[i] = v.v;
      groups.set(key, g);
    });
    for (const [key, g] of groups) {
      const k = Number(key.split(":")[1]);
      expr = `+ ${expr} ${k === 1 ? `[${g.join(" ")}]` : `* ${k} [${g.join(" ")}]`}`;
    }
    return expr;
  };
  /** A rect the size of an artwork. */
  at = (x: V, y: V, [w, h]: [number, number]) => this.p(x, y, w, h);
  /** A font: a slot (1–5) or the kit's slot for a role. */
  font = (f: number | keyof KitFonts) => {
    const slot = typeof f === "number" ? f : this.fonts[f];
    return `[${slot + (this.s === 1.5 ? 5 : this.s === 2 ? 10 : 0)}]`;
  };
  set = (name: string, expr: string) => {
    this.named.add(name);
    this.lines.push(`set ${name} ${expr}`);
  };
  /** Set unless already set (by the kit's hook): for shared styling written after a hook. */
  setDefault = (name: string, expr: string) => {
    if (!this.named.has(name)) this.set(name, expr);
  };
  raw = (line: string) => this.lines.push(line);
  /** Show an element only when the panel is at least `min` tall. */
  tall = (min: number, name: string, rect: string) => this.set(name, `h<${this.n(min)} [0] ${rect}`);
  /** Choose by panel width. */
  wide = (min: number, yes: string, no: string) => `w<${this.n(min)} ${no} ${yes}`;
  custom = (name: string, image = "") => this.raw(image ? `custom ${name} '' 0 '' '${image}'` : `custom ${name}`);
}

// ---------------------------------------------------------------- WALTER values

export const rgb = (c: RGB) => c.map((v) => Math.round(v)).join(" ");
/** Text colour. */
export const fg = (c: RGB, a = 255) => `[${rgb(c)} ${a} 0 0 0 0]`;
/** Fill colour of a custom element. */
export const fill = (c: RGB, a = 255) => `[0 0 0 0 ${rgb(c)} ${a}]`;
export const NONE = "[0 0 0 0 0 0 0 0]";
export const TRACK_FILL = "[0 0 0 0 trackcolor_r trackcolor_g trackcolor_b 255]";
/** kBright = the track colour's brightness (0–255); the frame sets it for track panels and mixer strips. */
export const BRIGHT = "set kBright / + + * trackcolor_r 299 * trackcolor_g 587 * trackcolor_b 114 1000";
/** Ink that reads on the track colour (needs kBright). */
export const ON_COLOR = "kBright{0}>150 [20 20 20] [248 248 248]";
export const CENTER = "[0 0 0 0 0.5]";

/** Row-1 offset kY: 3px on one-row (26px) tracks so the row is centred, 4px otherwise. */
export const ROW1 = (w: Script) => w.set("kY", `h<${w.n(36)} [0 ${w.n(3)}] [0 ${w.n(4)}]`);
/** A row-1 rect (offset by kY). */
export const r1 = (w: Script, x: V, wd: V, ht = 20, dy = 0) => `+ kY ${w.p(x, dy, wd, ht)}`;

/** Wide enough that the input selector moves up into row 2. */
export const WIDE_TCP = 560;

// ---------------------------------------------------------------- building blocks

/** A box with a 1-device-pixel border: an outer element in the border colour and an inner one inset by 1px. */
export function framedBox(w: Script, base: string, rect: string, minH: number, border: RGB, inner: string) {
  w.custom(`${base}B`);
  w.tall(minH, `${base}B`, rect);
  w.set(`${base}B.color`, fill(border));
  w.custom(base);
  w.tall(minH, base, `+ [1 1 -2 -2] ${rect}`);
  w.set(`${base}.color`, inner);
  w.raw(`front ${base}`);
}

export function meterLook(w: Script, el: string, k: Kit, opts: { scale: boolean; readout: boolean }) {
  const c = k.c;
  w.set(`${el}.vu.div`, "[2]");
  w.set(`${el}.readout.color`, opts.readout ? `[${rgb(c.dim)} 255 ${rgb(c.meter.clip)} 255]` : NONE);
  w.set(`${el}.rmsreadout.color`, opts.readout ? `[${rgb(c.dim)} 255]` : NONE);
  const unlit = opts.scale ? `[${rgb(c.dim)} 140 0 0 0 0]` : NONE;
  const lit = opts.scale ? "[0 0 0 150 0 0 0 0]" : NONE;
  w.set(`${el}.scale.color.unlit.top`, unlit);
  w.set(`${el}.scale.color.unlit.bottom`, unlit);
  w.set(`${el}.scale.color.lit.top`, lit);
  w.set(`${el}.scale.color.lit.bottom`, lit);
}

/**
 * The extended mixer (FX inserts, sends) opens a section under the top controls:
 * 60px at a 360px strip, growing by half of any extra height (24px minimum), so a short
 * mixer keeps its faders and a tall one gets room for inserts. REAPER only fills it
 * "when space permits", so it needs real height. kE shifts what is below
 * the section; kE2 also shortens the fader and meter by the same amount.
 */
export function extMixer(w: Script, ctx: string, top: number) {
  w.set("kE", `mcp_wantextmix>0 h<${w.n(288)} [0 ${w.n(24)}] + [0 ${-w.n(120)}] * 0.5 [0 h] [0]`);
  w.set("kE2", "- kE [0 0 0 kE{1}]");
  w.set(`${ctx}.extmixer.mode`, "[1]");
  w.raw(`front ${ctx}.extmixer`);
  w.set(`${ctx}.extmixer.position`, `mcp_wantextmix>0 + [${w.n(4)} ${w.n(top)} ${-w.n(8)} 0] [0 0 w kE{1}] [0]`);
}

/** Mixer text and fader modes; the frame writes these after the kit's mcp hook. */
export function mcpLabels(w: Script, ctx: "mcp" | "master.mcp", k: Kit) {
  w.setDefault(`${ctx}.volume.fadermode`, "[-1]");
  w.setDefault(`${ctx}.volume.label.color`, fg(k.c.text));
  w.setDefault(`${ctx}.volume.label.font`, w.font("value"));
  w.setDefault(`${ctx}.volume.label.margin`, CENTER);
  w.setDefault(`${ctx}.pan.fadermode`, "[1]");
  w.setDefault(`${ctx}.fxlist.font`, w.font("list"));
  w.setDefault(`${ctx}.fxlist.margin`, `[${w.n(3)} 0 ${w.n(3)} 0 0]`);
  w.setDefault(`${ctx}.sendlist.font`, w.font("list"));
  w.setDefault(`${ctx}.fxparm.font`, w.font("list"));
}

/** A transport display box (custom element drawn with k_display) at `rect`. */
export function transDisplay(w: Script, name: string, rect: string) {
  w.custom(`trans.custom.k${name}`, "k_display");
  w.set(`trans.custom.k${name}`, rect);
}

/** Envelope lane: [arm][on][label ...][value][fader ≤120][mod][learn][hide]. The default for KitLayout.envcp. */
export function envcp(k: Kit, w: Script, z: KitSizes) {
  const c = k.c;
  const b = z.envBtn, th = z.tcpThumb[1];
  w.set("envcp.arm", w.at(4, 4, b));
  w.set("envcp.bypass", w.at(26, 4, b));
  w.set("envcp.label", w.wide(358, w.p(50, 4, W(-298), 18), w.p(50, 4, 60, 18)));
  w.set("envcp.label.font", w.font("label"));
  w.set("envcp.label.color", `[${rgb(c.text)}]`);
  w.set("envcp.label.margin", `[${w.n(4)} 0 0 0 0]`);
  const val = w.wide(358, w.p(W(-244), 4, 46, 18), w.p(114, 4, 46, 18));
  w.custom("envcp.custom.kVal", "k_display");
  w.set("envcp.custom.kVal", val);
  w.set("envcp.value", val);
  w.set("envcp.value.font", w.font("value"));
  w.set("envcp.value.color", fg(c.dim));
  w.set("envcp.value.margin", CENTER);
  const fy = 4 + (18 - th) / 2;
  w.set("envcp.fader", w.wide(358, w.p(W(-194), fy, 120, th), w.p(164, fy, W(-238), th)));
  w.set("envcp.fader.fadermode", "[-1]");
  w.set("envcp.mod", w.at(W(-68), 4, b));
  w.set("envcp.learn", w.at(W(-46), 4, b));
  w.set("envcp.hide", w.at(W(-24), 4, b));
}

// ---------------------------------------------------------------- section frames

function tcp(def: KitDef, k: Kit, w: Script) {
  w.raw("clear tcp.*");
  w.set("tcp.size", `[${w.n(300)} ${w.n(52)} ${w.n(200)}]`);
  w.raw(BRIGHT);
  ROW1(w);
  def.layout.tcp(k, w);
  w.setDefault("tcp.recinput.color", fg(k.c.text));
  w.setDefault("tcp.recinput.font", w.font("list"));
  w.setDefault("tcp.recinput.margin", `[${w.n(6)} 0 ${w.n(6)} 0 0]`);
  w.setDefault("tcp.fxparm.visflags", "[0 -1 -1]");
  w.setDefault("tcp.fxparm.font", w.font("list"));
}

function masterTcp(def: KitDef, k: Kit, w: Script) {
  w.raw("clear master.tcp.*");
  w.set("master.tcp.size", `[${w.n(300)} ${w.n(52)} ${w.n(200)}]`);
  ROW1(w);
  def.layout.masterTcp(k, w);
}

function envcpFrame(def: KitDef, k: Kit, w: Script) {
  w.raw("clear envcp.*");
  w.set("envcp.size", `[${w.n(300)} ${w.n(26)} ${w.n(200)}]`);
  if (def.layout.envcp) def.layout.envcp(k, w);
  else envcp(k, w, def.sizes);
}

function mcp(def: KitDef, k: Kit, w: Script, range: MeterRange) {
  w.raw("clear mcp.*");
  w.raw(BRIGHT);
  w.set("mcp.size", `[${w.n(def.mcpWidth.track)} ${w.n(360)} 0 ${w.n(260)}]`);
  def.layout.mcp(k, w, { master: false, range });
  mcpLabels(w, "mcp", k);
}

function masterMcp(def: KitDef, k: Kit, w: Script, range: MeterRange) {
  w.raw("clear master.mcp.*");
  w.set("master.mcp.size", `[${w.n(def.mcpWidth.master)} ${w.n(360)} 0 ${w.n(260)}]`);
  def.layout.mcp(k, w, { master: true, range });
  mcpLabels(w, "master.mcp", k);
}

function trans(def: KitDef, k: Kit, w: Script) {
  const c = k.c;
  w.raw("clear trans.*");
  w.set("trans.size", `[${w.n(1000)} ${w.n(36)}]`);
  w.set("trans.size.minmax", `[${w.n(300)} ${w.n(36)} ${w.n(4000)} ${w.n(144)}]`);
  w.set("trans.size.dockedheight", `[${w.n(36)}]`);
  // Tap tempo is a text element on REAPER's tempo background ("♩ =" before the tempo).
  w.set("trans.bpm.tap.color", fg(c.dim));
  w.set("trans.bpm.tap.font", w.font("value"));
  w.set("trans.bpm.tap.margin", CENTER);
  def.layout.trans(k, w);
  w.setDefault("trans.bpm.edit.color", fg(c.displayText));
  w.setDefault("trans.bpm.edit.margin", CENTER);
  w.setDefault("trans.curtimesig.color", fg(c.displayText));
  w.setDefault("trans.curtimesig.font", w.font("sig"));
  w.setDefault("trans.status.color", fg(c.displayText));
  w.setDefault("trans.status.font", w.font("status"));
  w.setDefault("trans.status.margin", `[${w.n(10)} 0 ${w.n(10)} 0 0]`);
  w.setDefault("trans.sel.color", fg(c.text));
  w.setDefault("trans.sel.font", w.font("value"));
  w.setDefault("trans.sel.margin", `[${w.n(6)} 0 ${w.n(6)} 0 0]`);
  w.setDefault("trans.rate", "[0]");
  w.setDefault("trans.rate.fader", "[0]");
}

const SCALES: [number, string | null][] = [[1, null], [1.5, "150"], [2, "200"]];

export const DEFAULT_METER_RANGE: MeterRange = { max: 6, min: -62 };

/** rtconfig.txt for a kit: the shared header, then every section at 100 / 150 / 200 %. */
export function rtconfigFor(def: KitDef, k: Kit, range: MeterRange = DEFAULT_METER_RANGE): string {
  const head = [
    "; REAPER Assist theme layout (generated). Original design; no third-party artwork.",
    "version 7.0",
    "use_pngs 1",
    "use_overlays 1",
    "tinttcp 298",
    "peaksedges 0",
    "tcp_showborders 0",
    "mcp_showborders 0",
    "trans_showborders 0",
    "tcp_folderindent 12",
    "no_meter_reclbl 1",
    "tcp_heights 4 26 52 76",
    "tcp_master_minheight 26",
    "envcp_min_height 26",
    "mcp_min_height 260 80",
    "misc_dpi_translate 50 100",
    "misc_dpi_translate 134 150",
    "misc_dpi_translate 174 200",
    "tcp_vol_zeroline 00000000",
    "mcp_vol_zeroline 00000000",
    "",
  ];
  // A kit's own global lines replace the frame's (same keyword) or are added after them.
  for (const [key, value] of Object.entries(def.globals ?? {})) {
    if (!/^[a-z_]+$/.test(key) || /[\r\n]/.test(value)) throw new Error(`Bad rtconfig global ${key}`);
    const at = head.findIndex((l) => l.split(" ")[0] === key);
    if (at >= 0) head[at] = `${key} ${value}`;
    else head.splice(head.length - 1, 0, `${key} ${value}`);
  }
  const fonts = { ...DEFAULT_FONTS, ...def.fonts };
  const out = [...head];
  for (const [s, dir] of SCALES) {
    const w = new Script(s, fonts);
    for (const f of [tcp, masterTcp, envcpFrame, mcp, masterMcp, trans]) f(def, k, w, range);
    if (dir) out.push(`Layout "${dir}" "${dir}"`, ...w.lines.map((l) => `  ${l}`), "EndLayout", "");
    else out.push(...w.lines, "");
  }
  out.push("layout_dpi_translate '' 1.34 '150'", "layout_dpi_translate '' 1.74 '200'", "layout_dpi_translate '150' 1.74 '200'", "");
  return out.join("\r\n");
}
