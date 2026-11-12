import type { SkinUi } from "../skins";
import type { WorkflowId } from "../index";
import { hex, type Bitmap, type RGB, type SDF } from "./raster";
import type { Script } from "./walter";

/**
 * A "kit" is a complete, original REAPER theme design: its own artwork (art.ts)
 * and its own track / mixer / transport layout (walter.ts), one per "Coming from…"
 * profile. Everything DAW-specific lives in that DAW's module (daws/<id>.ts) as a
 * KitDef; registry.ts lists them, and the shared code looks kits up there.
 *
 * Kits evoke how another DAW is laid out and how its controls behave so its
 * users feel at home. They use no logos, artwork or trade dress from those
 * products: everything is drawn from simple shapes in our own palette.
 */

export type KitId = WorkflowId;

export interface KitColors {
  bg: RGB;
  panel: RGB;
  /** Track panel background. */
  track: RGB;
  trackSel: RGB;
  /** Raised button face. */
  face: RGB;
  line: RGB;
  deep: RGB;
  text: RGB;
  dim: RGB;
  accent: RGB;
  accent2: RGB;
  solo: RGB;
  arm: RGB;
  play: RGB;
  /** Ink on a lit button. */
  onInk: RGB;
  /** Envelope modes: read, touch, write, latch, preview. */
  env: [RGB, RGB, RGB, RGB, RGB];
  display: RGB;
  /** Text on displays: transport tempo, signature and position. */
  displayText: RGB;
  /** Knob value arc (defaults to the accent). */
  knob?: RGB;
  /** MIDI editor notes (a note colour map): unselected, selected, and the row colour soft notes fade toward. */
  notes?: { off: RGB; on: RGB; bg: RGB };
  /** Meter: unlit background, then lit colours low → high, and clip. */
  meter: { off: RGB; low: RGB; mid: RGB; high: RGB; clip: RGB };
}

/** A kit's palette and look, as the shared drawing and layout code reads it. */
export interface Kit {
  id: KitId;
  /** "flat": square-ish, matte, hairline borders. "gloss": rounded, lit from above, soft shadows. */
  look: "flat" | "gloss";
  /** Button corner radius (base units). */
  radius: number;
  c: KitColors;
}

/** Envelope mode colours most kits share: read, touch, write, latch, preview. */
export const DEFAULT_ENV: [RGB, RGB, RGB, RGB, RGB] = [hex("#5fcf6a"), hex("#f2c94c"), hex("#f0524f"), hex("#b48cf2"), hex("#58a6ff")];

/**
 * Element sizes (base units at 100%). The layout script places elements at
 * exactly these sizes and the artwork is drawn at exactly these sizes, so
 * nothing is ever stretched or squashed. Keep them even so they land on whole
 * pixels at 150% too.
 */
export interface KitSizes {
  tcpMute: [number, number];
  tcpBtn: [number, number]; // solo, record arm
  tcpSmall: [number, number]; // monitor, io, env, folder, record mode
  tcpFx: [number, number];
  tcpKnob: number;
  tcpThumb: [number, number];
  mcpMute: [number, number];
  mcpBtn: [number, number]; // solo
  mcpArm: [number, number]; // record arm
  mcpMon: [number, number]; // monitor
  mcpSmall: [number, number]; // fx, io, env, menu
  mcpKnob: number;
  mcpThumb: [number, number];
  mcpFaderW: number;
  envBtn: [number, number];
  envKnob: number;
  trans: [number, number];
  /** Tap-tempo field (REAPER draws its own "♩ =" label). */
  tap: [number, number];
  /** Master mixer menu button. */
  menu: [number, number];
  toolbar: number;
}

/**
 * WALTER font slots by role. Slots 1–5 are REAPER Default 7's fonts at 100 %
 * (Inter 7, 8, 8, 9, 10); Script.font picks the 150 / 200 % twin.
 */
export interface KitFonts {
  /** Track, mixer and envelope names. */
  label: number;
  /** Track numbers, volume / envelope values, tap tempo, time selection. */
  value: number;
  /** Record input, FX and send lists, FX parameters. */
  list: number;
  /** Transport tempo. */
  tempo: number;
  /** Transport time signature. */
  sig: number;
  /** Transport position / status. */
  status: number;
}

export const DEFAULT_FONTS: KitFonts = { label: 1, value: 1, list: 1, tempo: 3, sig: 3, status: 5 };

/** REAPER's meter range in dB (Preferences > Appearance > Meters; reaper.ini vumaxvol / vuminvol). */
export interface MeterRange {
  max: number;
  min: number;
}

/** A theme font: face name, pixel height at 100 %, weight (400 regular, 500 medium, 600 semibold, 700 bold). */
export interface FontFace {
  face: string;
  /** macOS face, when it should differ from `face` (used on macOS only). */
  mac?: string;
  px: number;
  weight?: number;
  /** The font record's italic flag (style face names like "Verdana Bold Italic" fall back to a plain face on macOS). */
  italic?: boolean;
}

/** Theme fonts. `slots` are WALTER's font slots 1–5 at 100 % (their 150 / 200 % twins are scaled to match). */
export interface KitFaces {
  slots?: Partial<Record<1 | 2 | 3 | 4 | 5, FontFace>>;
  /** Timeline ruler (tl_font). */
  ruler?: FontFace;
  /** Transport position / status text (trans_font). */
  transport?: FontFace;
  /** Clip / item names (mi_font). */
  items?: FontFace;
  /** Volume / pan labels (lb_font). */
  volpan?: FontFace;
  /** Track titles where REAPER draws them itself (lb_font2). */
  title?: FontFace;
}

/** Draws one image at a scale (1, 1.5, 2). */
export type Draw = (s: number) => Bitmap;

/**
 * Layout hooks. Each writes its part of rtconfig.txt into `w` (one Script per scale).
 * The shared code (walter.ts) writes each section's frame around the hook:
 *  - before: `clear <section>.*` and the section's size (re-`set` it in the hook to change it;
 *    the last `set` wins); `kBright` (for ON_COLOR) on track panels and mixer strips; the
 *    row-1 offset `kY` on track panels; tap-tempo styling on the transport.
 *  - after: shared text styling (fonts, colours, margins) via Script.setDefault, which skips
 *    anything the hook already set, so a hook can override it.
 */
export interface KitLayout {
  /** Track panel. */
  tcp(k: Kit, w: Script): void;
  /** Master track panel. */
  masterTcp(k: Kit, w: Script): void;
  /** A mixer strip: called once for tracks and once for the master. `range` is the user's meter range. */
  mcp(k: Kit, w: Script, strip: { master: boolean; range: MeterRange }): void;
  /** Envelope lane. Default: walter.ts envcp. */
  envcp?(k: Kit, w: Script): void;
  /** Transport bar. */
  trans(k: Kit, w: Script): void;
}

/** Everything DAW-specific about a kit. One per module in daws/. */
export interface KitDef {
  id: KitId;
  /** The palette and look, from the profile's panel colours (Workflow.panel). */
  palette(ui: SkinUi): Kit;
  sizes: KitSizes;
  /** Mixer strip widths (base units). */
  mcpWidth: { track: number; master: number };
  /** Font slots by role; roles left out use DEFAULT_FONTS. */
  fonts?: Partial<KitFonts>;
  /**
   * Font faces and sizes the theme gives REAPER (its .ReaperTheme [REAPER] fonts). Slots left out
   * keep Default 7's (Inter). The face must exist on the user's machine (else the OS picks one);
   * prefer faces both macOS and Windows have (Arial, Arial Narrow, Verdana, Tahoma, Trebuchet MS,
   * Courier New, Georgia, Impact) or give a `mac` face for macOS.
   */
  faces?: KitFaces;
  /**
   * rtconfig.txt global lines to replace or add, by keyword, e.g. { tcp_heights: "4 22 44 66" }
   * (super-collapsed, collapsed, normal minimum, record-armed minimum), tcp_folderindent,
   * mcp_min_height, tcp_master_minheight, envcp_min_height.
   */
  globals?: Record<string, string>;
  layout: KitLayout;
  /**
   * Adds or replaces drawings on top of the shared set (art.ts), keyed by REAPER image name.
   * Shared aliases (e.g. mcp_master_volbg → mcp_volbg) follow a replaced source unless the
   * hook replaces the alias too.
   */
  images?(k: Kit, out: Record<string, Draw>): void;
  /**
   * Drawings for the profile's toolbar icons ("assist_<daw>_<name>" → glyph), used by the
   * profile's toolbars (Workflow.toolbars[].items[].icon). See toolbarIcons.ts.
   */
  toolbarGlyphs?: Record<string, Glyph>;
  /**
   * Toolbar icon colours, one per frame: normal | mouse-over | lit (toggled on). Defaults: the profile
   * panel's dim text | text | accent. `icons` overrides them per icon name (e.g. edit-mode cells that
   * light green while the tools light blue). The theme images toolbar_blank and
   * animation_toolbar_highlight (REAPER's glow behind lit buttons) are drawn under the icon.
   */
  toolbarInk?: InkColors & { icons?: Record<string, InkColors> };
  /**
   * Toolbar icons the kit draws in full colour (icon name → art), in place of a one-colour glyph:
   * e.g. a word cell whose lit frame is a bright plate with dark text. Takes precedence over toolbarGlyphs.
   */
  toolbarArt?: Record<string, ToolbarArt>;
}

/**
 * A full-colour toolbar icon: one frame per state. REAPER sizes the button to the frame, so a wider
 * frame makes a wider button (60 × 30 checked in REAPER 7.82: the button grows and stays in line).
 */
export interface ToolbarArt {
  /** Frame width at 100 % (default 30, square); the height is always 30. */
  w?: number;
  /** One frame at scale s, (w × 30) · s pixels: 0 normal, 1 mouse-over, 2 lit (toggled on). */
  draw: (state: 0 | 1 | 2, s: number) => Bitmap;
}

/** Optional ink per toolbar icon frame. */
export interface InkColors {
  normal?: string;
  hover?: string;
  on?: string;
}

/** A glyph centred on (cx, cy), about u wide (u = 16 at 100 %, inside a 30 px toolbar frame). */
export type Glyph = (cx: number, cy: number, u: number) => SDF;
