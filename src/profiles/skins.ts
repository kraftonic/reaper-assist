import type { Workflow, WorkflowId } from "./index";

/** Everything needed to make a REAPER colour theme. */
export interface ReaperSkin {
  /** Shown in REAPER's theme list as "Assist - <name>". */
  name: string;
  /** REAPER [color theme] keys → #rrggbb. */
  reaper: Record<string, string>;
  /** REAPER [color theme] draw-mode keys → raw integer. */
  reaperModes?: Record<string, number>;
  /** Track/mixer, master and transport panel backgrounds. */
  panels: { track: string; master: string; transport: string };
  /** Palette the artwork (buttons, knobs, faders, icons) is recoloured to. */
  ui: SkinUi;
  /** Shape style for buttons, knobs and faders. Absent = keep REAPER's own shapes (colours only). */
  art?: ArtStyle;
  /** A full original design (own artwork + own layout, src/profiles/kit) instead of a restyled Default 7. */
  kit?: WorkflowId;
  /** Only colour keys change: REAPER's own artwork, panels and layout are kept exactly. */
  colorsOnly?: boolean;
}

/**
 * How buttons, knobs and fader caps are drawn.
 *  - corner: 0 = square, 0.5 = pill/circle (fraction of the shorter side)
 *  - surface: flat fill, glossy gradient, or dark glass with a glowing rim
 *  - light: light skin (adds a defining edge)
 */
export interface ArtStyle {
  corner: number;
  surface: "flat" | "gradient" | "glass";
  light: boolean;
}

/** Per-DAW shapes for the "Coming from…" skins. */
export const WORKFLOW_ART: Record<string, ArtStyle> = {
  fl: { corner: 0.22, surface: "gradient", light: false },
  ableton: { corner: 0.03, surface: "flat", light: false },
  logic: { corner: 0.2, surface: "gradient", light: false },
  protools: { corner: 0.12, surface: "gradient", light: false },
  cubase: { corner: 0.16, surface: "flat", light: false },
  studioone: { corner: 0.3, surface: "flat", light: false },
};

export interface SkinUi {
  bg: string;
  panel: string;
  panelAlt: string;
  border: string;
  text: string;
  textDim: string;
  accent: string;
  accentText: string;
  accent2: string;
}

/**
 * Colour keys REAPER uses for its windows and lists: the FX (plug-in) browser,
 * action list, media explorer, preferences, routing, dockers, toolbars.
 */
export function uiColors(u: SkinUi): Record<string, string> {
  // Edit fields: recessed (darker) on dark skins, lighter than the panel on light skins so dark text stays readable.
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(u.bg.slice(i, i + 2), 16));
  const light = (0.299 * r! + 0.587 * g! + 0.114 * b!) / 255 > 0.5;
  const edit = light ? mix(u.bg, "#ffffff", 0.45) : mix(u.bg, "#000000", 0.25);
  return {
    col_main_bg: u.panel, col_main_text: u.text, col_main_textshadow: u.border, col_main_3dhl: u.panelAlt, col_main_3dsh: u.border,
    col_main_resize2: u.border, col_main_editbk: edit, col_main_textbg: edit, col_buttonbg: u.panelAlt,
    col_transport_editbk: edit, col_toolbar_text: u.textDim, col_toolbar_text_on: u.accent, col_toolbar_frame: u.border,
    io_text: u.text, io_3dhl: u.panelAlt, io_3dsh: u.border,
    genlist_bg: u.bg, genlist_fg: u.text, genlist_grid: u.border, genlist_selbg: u.accent, genlist_selfg: u.accentText,
    genlist_seliabg: u.panelAlt, genlist_seliafg: u.text, genlist_hilite: u.accent2, genlist_hilite_sel: u.accentText,
    col_tcp_text: u.text, col_tcp_textsel: u.text, col_trans_bg: u.bg, col_trans_fg: u.text,
    col_mi_label: u.text, col_mi_label_sel: u.accentText, col_mi_label_float: u.text, col_mi_label_float_sel: u.accentText,
    docker_shadow: u.border, docker_selface: u.panelAlt, docker_unselface: u.panel, docker_text: u.textDim, docker_text_sel: u.text,
    midieditorlist_bg: u.bg, midieditorlist_fg: u.text, midieditorlist_grid: u.border, midieditorlist_selbg: u.accent, midieditorlist_selfg: u.accentText,
    midieditorlist_seliabg: u.panelAlt, midieditorlist_seliafg: u.text, midieditorlist_bg2: u.panel, midieditorlist_fg2: u.textDim,
    midieditorlist_selbg2: u.accent, midieditorlist_selfg2: u.accentText, col_explorer_sel: u.accent, col_explorer_seledge: u.accent2,
    wiring_grid: u.border, wiring_border: u.border, wiring_tbg: u.panel, wiring_ticon: u.text,
  };
}

export function mix(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const x = p(a.slice(0, 7)), y = p(b.slice(0, 7));
  return `#${x.map((v, i) => Math.round(v + (y[i]! - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

/** The common REAPER theme keys, from a small palette. */
export function reaperColors(p: { bg: string; lane1: string; lane2: string; sel: string; ruler: string; rulerText: string; grid: string; item: string; peaks: string; cursor: string; play: string; note: string; region: string; marker: string; text: string }): Record<string, string> {
  return {
    col_main_bg2: p.bg, col_tracklistbg: p.bg, col_mixerbg: p.bg, docker_bg: p.bg, windowtab_bg: p.bg,
    col_main_text2: p.text, col_tl_fg: p.rulerText, col_tl_fg2: p.rulerText,
    col_arrangebg: p.lane2, col_tr1_bg: p.lane1, col_tr2_bg: p.lane2, selcol_tr1_bg: p.sel, selcol_tr2_bg: p.sel,
    col_tl_bg: p.ruler, col_gridlines: p.grid, col_gridlines2: p.grid, col_gridlines3: p.grid,
    // REAPER 7's region / marker / tempo lanes above the ruler (marker_lane_bg is their divider line).
    region_lane_bg: p.ruler, ts_lane_bg: p.ruler, marker_lane_bg: mix(p.ruler, p.rulerText, 0.25),
    region_lane_text: p.rulerText, marker_lane_text: p.rulerText, ts_lane_text: p.rulerText, ruler_header_text: p.rulerText,
    col_mi_bg: p.item, col_mi_bg2: p.item, col_tr1_itembgsel: mix(p.item, "#ffffff", 0.35), col_tr2_itembgsel: mix(p.item, "#ffffff", 0.35), col_tr1_peaks: p.peaks, col_tr2_peaks: p.peaks,
    col_cursor: p.cursor, col_cursor2: p.cursor, playcursor_color: p.play,
    midi_notebg: p.note, midi_trackbg1: p.lane1, midi_trackbg2: p.lane2, midi_rulerbg: p.ruler,
    region: p.region, marker: p.marker,
  };
}

/** Theme keys for the arrange view, rulers, items and MIDI editor; REAPER's panels, windows and lists aren't among them. */
const ARRANGE_KEY = /^(col_arrangebg|col_tr[12]_|selcol_tr[12]_|col_gridlines|col_tl_|region|marker|ts_lane|ruler_header|col_mi_|col_cursor|playcursor|midi_)/;

/**
 * A "Coming from…" profile's REAPER theme: the arrange view, items, rulers and MIDI editor take the
 * DAW's colours; everything else stays REAPER's Default 7. `full` gives the complete restyle (the
 * profile's kit: its own artwork and layout), which profiles no longer apply.
 */
export function skinFromWorkflow(w: Workflow, full = false): ReaperSkin {
  const arrange = <T>(o: Record<string, T> = {}) => Object.fromEntries(Object.entries(o).filter(([k]) => ARRANGE_KEY.test(k)));
  if (!full) return { name: `${w.daw} colours`, reaper: arrange(w.reaper), reaperModes: arrange(w.reaperModes), panels: w.panels, ui: w.panel, colorsOnly: true };
  return { name: `${w.daw} feel`, reaper: { ...uiColors(w.panel), ...w.reaper }, reaperModes: w.reaperModes, panels: w.panels, ui: w.panel, art: WORKFLOW_ART[w.id], kit: w.id };
}
