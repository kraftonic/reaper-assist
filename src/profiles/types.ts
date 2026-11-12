/**
 * What a "Coming from…" profile is made of. Each DAW lives in its own file next to this one
 * (fl.ts, ableton.ts, …); src/profiles/index.ts gathers them into WORKFLOWS.
 *
 * A profile changes REAPER in these ways, all recorded first so "Restore REAPER" can undo them:
 *  - theme: its own kit (artwork + WALTER layout + colours), built from `reaper`/`panels`/`panel`;
 *  - shortcuts (reaper-kb.ini KEY lines), scripts (SCR lines + Scripts/ReaperAssist/*.lua)
 *    and custom actions (ACT lines);
 *  - mouse modifiers (reaper-mouse.ini);
 *  - preferences (reaper.ini keys, or only some bits of them);
 *  - window layout (reaper.ini dock keys);
 *  - toolbars (reaper-menu.ini sections + Data/toolbar_icons/assist_*.png).
 *
 * DAW names only say who a profile is for. No logos, artwork or exact skins are copied.
 */

export type WorkflowId = "fl" | "ableton" | "logic" | "protools" | "cubase" | "studioone";

/** ⌘ / Ctrl, ⇧, ⌥ / Alt, and the Mac Control key (Windows key on Windows). */
export type Mod = "cmd" | "shift" | "opt" | "ctrl";

/** Keymap sections a shortcut or script can live in. */
/** "alt1": REAPER's "Main (alt-1)" section (a second main keymap, switched by actions 24801-24803; id 1 — verify). */
export type KeySection = "main" | "midi" | "midilist" | "explorer" | "alt1";

/** A REAPER action: its number in the section, or a named command ("_RS_assist_x", "_assist_x"). */
export type ActionRef = number | `_${string}`;

export interface Shortcut {
  mods: Mod[];
  /**
   * "A".."Z", "0".."9", "F1".."F24", "Space", "Tab", "Return", "Escape", "Backspace", "Delete",
   * "Insert", "Home", "End", "PageUp", "PageDown", "Left", "Right", "Up", "Down",
   * "Num0".."Num9", "Num*", "Num+", "Num-", "Num.", "Num/", "NumEnter", "Num=",
   * punctuation: "=", "-", ",", ".", "/", ";", "'", "[", "]", "\\", "`",
   * and "Wheel" (vertical mouse wheel; mods: cmd, opt, shift).
   */
  key: string;
  action: ActionRef;
  /** Where the key works: the main window (default), the MIDI editor, its event list, or the Media Explorer. */
  section?: KeySection;
  /** What it does, in the other DAW's words. */
  does: string;
}

/** One mouse-modifier assignment (reaper-mouse.ini `[ctx] mm_N=value`). */
export interface MouseMod {
  /** Context id, e.g. "MM_CTX_MIDI_RMOUSE" (see reaper-mechanics §1.4). */
  ctx: string;
  mods: Mod[];
  /**
   * "<behaviour id> m" (a built-in behaviour of that context), "<action id> c" (an action;
   * click / double-click contexts only), "_<named command>" (script or custom action), or "0 m" (none).
   */
  value: string;
  does: string;
}

/** A preference in reaper.ini's [REAPER] section. */
export interface Pref {
  key: string;
  /** The value. With `bits`, only those bits change: `value` holds the wanted state of them. */
  value: number | string;
  /** Bit mask: only these bits are Assist's; the user's other bits are kept. */
  bits?: number;
  does: string;
}

/** A custom action (reaper-kb.ini ACT line): several actions run in order as one. */
export interface Macro {
  /** Without the leading "_": "assist_<daw>_<name>". */
  id: string;
  name: string;
  section?: KeySection;
  actions: ActionRef[];
}

/** A Lua script registered as an action (reaper-kb.ini SCR line). */
export interface ProfileScript {
  /** Without the leading "_": "RS_assist_<daw>_<name>" (one id per section). */
  id: string;
  /** File name in src/profiles/<id>/scripts/ (copied into Scripts/ReaperAssist/Profile/). */
  file: string;
  /** Shown in the action list as "Assist: <name>". */
  name: string;
  section?: KeySection;
}

/** A toolbar button. `action: "-"` is a separator. */
export interface ToolbarItem {
  action: ActionRef | "-";
  /** Label and tooltip. */
  label: string;
  /**
   * An icon Assist draws ("assist_<name>", see toolbarIcons), one of REAPER's own icon files
   * ("toolbar_play.png"), or "text" / "text_wide" (the label as a text button).
   * Omitted: the action's default icon (or a text button).
   */
  icon?: string;
  /** Light the button while the action's toggle state is on. */
  toggle?: boolean;
}

export type ToolbarSection = "Main toolbar" | "MIDI piano roll toolbar" | `Floating toolbar ${number}` | `Floating MIDI toolbar ${number}`;

export interface Toolbar {
  section: ToolbarSection;
  title?: string;
  items: ToolbarItem[];
}

export interface BrowserDock {
  side: "left" | "right";
  /** Docker width in pixels. */
  width: number;
  /** Tabs in this docker; the first is the selected one. */
  tabs: ("explorer" | "fxbrowser")[];
}

/** Where REAPER's windows go. */
export interface Layout {
  /** transport_dock_pos: above or below the arrange view, or the top / bottom of the main window. */
  transport: "top" | "bottom" | "above" | "below";
  /** Track headers left (REAPER's default) or right of the arrange view. */
  tcp: "left" | "right";
  /** Track header width in pixels. */
  tcpWidth?: number;
  /**
   * Browser dockers: the Media Explorer and/or FX browser as tabs on one side, or each on its own
   * side (an array of two). Omitted: left as the user has them.
   */
  browser?: BrowserDock | BrowserDock[];
  /** Mixer docked at the bottom, its own window, or closed until asked for. */
  mixer: "docked" | "window" | "hidden";
  /** New MIDI editors dock at the bottom, or open as windows. */
  midiEditor: "docked" | "window";
  /**
   * What colours the MIDI editor's notes ([midiedit] colorwhat): the track's colour (4) or the clip's (5).
   * Omitted: left as the user has it (REAPER's default colours them by velocity).
   */
  midiNoteColor?: "track" | "item";
  /** Bottom docker height in pixels. */
  dockHeight?: number;
}

/** Panel colours for the Assist window. */
export interface PanelColors {
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

export interface Workflow {
  id: WorkflowId;
  daw: string;
  blurb: string;
  /** REAPER theme colour keys → #rrggbb. Keys not listed keep REAPER's default. */
  reaper: Record<string, string>;
  /**
   * REAPER theme draw-mode keys (e.g. mute_overlay_mode) → raw integer, written as is.
   * Overlay modes: 0x20000 = on, bits 8–16 = opacity out of 256 (0x20000 | (0x40 << 8) = 25 %).
   */
  reaperModes?: Record<string, number>;
  /** Track/mixer, master and transport panel backgrounds. */
  panels: { track: string; master: string; transport: string };
  /** Matching colours for the Assist panel. */
  panel: PanelColors;
  shortcuts: Shortcut[];
  mouse?: MouseMod[];
  /**
   * Mouse-modifier slots the profile's scripts change while REAPER runs (tool switching).
   * Listed so the restore record keeps their original values too.
   */
  toolSlots?: { ctx: string; mods: Mod[] }[];
  prefs?: Pref[];
  /**
   * Main-section actions REAPER runs once each time it starts, e.g. the base tool script, so the
   * toolbar's tool buttons light up to match the mouse map (REAPER doesn't keep script toggle states).
   */
  startup?: ActionRef[];
  macros?: Macro[];
  scripts?: ProfileScript[];
  toolbars?: Toolbar[];
  layout?: Layout;
  glossary: [theirs: string, reaper: string][];
}
