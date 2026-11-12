import type { Mod, MouseMod, ProfileScript, Shortcut, ToolbarItem, Workflow } from "../types";
import { reaperColors } from "../skins";

/**
 * "Coming from Cubase" (Cubase Pro 13/14, Project window, default dark look).
 * Spec: docs/research/cubase.md. Colours were sampled from the Cubase manual's
 * screenshots; every action id is checked against REAPER 7.82's action list.
 *
 * Feel: numpad transport (Enter plays, 0 stops, * records, / cycles, 1 / 2 go to the locators),
 * the locators kept apart from the selection, tools on 1–9 (scripts that swap mouse modifiers),
 * Alt+X split, P locators to selection, Q quantize, F3 MixConsole, F5 MediaBay.
 */

const S = (id: string, file: string, name: string, section?: "midi"): ProfileScript => ({ id: `RS_assist_cubase_${id}`, file, name, ...(section ? { section } : {}) });
const R = (id: string) => `_RS_assist_cubase_${id}` as const;
const k = (mods: Mod[], key: string, action: Shortcut["action"], does: string, section?: "midi"): Shortcut => ({ mods, key, action, does, ...(section ? { section } : {}) });

const TOOLS = ["Object Selection", "Range Selection", "Split", "Glue", "Erase", "Zoom", "Mute", "Draw", "Play"];

const scripts: ProfileScript[] = [
  ...TOOLS.map((t, i) => S(`tool_${i + 1}`, "cubase_tool.lua", `Cubase tool ${i + 1}: ${t}`)),
  S("tool_prev", "cubase_tool.lua", "Cubase previous tool"),
  S("tool_next", "cubase_tool.lua", "Cubase next tool"),
  ...TOOLS.map((t, i) => S(`midi_tool_${i + 1}`, "cubase_tool.lua", `Cubase tool ${i + 1}: ${t}`, "midi")),
  S("start_stop", "cubase_transport.lua", "Cubase Start/Stop"),
  S("stop", "cubase_transport.lua", "Cubase Stop (again: back to start position)"),
  S("locators_to_selection", "cubase_locators.lua", "Locators to Selection"),
  S("loop_selection", "cubase_locators.lua", "Loop Selection"),
  S("play_selection", "cubase_play_selection.lua", "Play Selection Range"),
  S("quantize", "cubase_quantize.lua", "Quantize"),
  S("repeat", "cubase_repeat.lua", "Repeat Events"),
  S("cut_time", "cubase_cut_time.lua", "Cut Time"),
  S("punch", "cubase_punch.lua", "Punch In/Out on the locators"),
  S("write", "cubase_automation.lua", "Automation Write on selected tracks"),
  S("read_all", "cubase_automation.lua", "Automation Read for all tracks"),
  S("write_all", "cubase_automation.lua", "Automation Write for all tracks"),
  S("glue_click", "cubase_glue_click.lua", "Glue tool click"),
  S("erase_click", "cubase_erase_click.lua", "Erase tool click"),
  S("mute_click", "cubase_mute_click.lua", "Mute tool click"),
  S("play_click", "cubase_play_click.lua", "Play tool click"),
  S("zoom_in_click", "cubase_zoom_in_click.lua", "Zoom tool click"),
  S("zoom_out_click", "cubase_zoom_out_click.lua", "Zoom tool Alt-click"),
];

/** Keys the MIDI editor hands to the main window, so transport and windows work from the Key Editor too. */
const PASS: [Mod[], string, string][] = [
  [[], "Space", "Start/Stop"], [[], "NumEnter", "Start"], [[], "Num0", "Stop"], [[], "Num*", "Record"], [[], "Num/", "Cycle"],
  [[], "Num1", "To left locator"], [[], "Num2", "To right locator"], [[], "Num.", "To project start"], [[], "F3", "MixConsole"],
  [[], "C", "Metronome"], [[], "P", "Locators to selection"],
];

const shortcuts: Shortcut[] = [
  // Transport (numpad).
  k([], "Space", R("start_stop"), "Start / Stop (the cursor stays where you stopped)"),
  k([], "NumEnter", 1007, "Start"),
  k([], "Num0", R("stop"), "Stop (again: back to where playback started)"),
  k([], "Num*", 1013, "Record"),
  k([], "Num/", 1068, "Cycle on/off"),
  k([], "Num.", 40042, "Go to project start"),
  k([], "Num1", 40632, "Go to left locator"),
  k([], "Num2", 40633, "Go to right locator"),
  ...[3, 4, 5, 6, 7, 8, 9].map((n) => k([], `Num${n}`, 40160 + n, `To marker ${n}`)),
  k([], "Num+", 40085, "Forward"),
  k([], "Num-", 40084, "Rewind"),
  k(["cmd"], "Num1", 40222, "Set left locator (at the cursor)"),
  k(["cmd"], "Num2", 40223, "Set right locator (at the cursor)"),
  k(["cmd"], "Num-", 40646, "Nudge cursor left"),
  k(["cmd"], "Num+", 40647, "Nudge cursor right"),
  k([], "P", R("locators_to_selection"), "Locators to selection"),
  k(["opt"], "P", R("loop_selection"), "Loop selection"),
  k(["opt"], "Space", R("play_selection"), "Play selection range"),
  k([], "C", 40364, "Metronome (click) on/off"),
  k([], "I", R("punch"), "Punch in (REAPER punches over the locator range)"),
  k([], "O", R("punch"), "Punch out (same switch as punch in)"),
  k(["shift"], "Space", 1134, "Tap tempo"),
  k([], "N", 40319, "Locate next event"),
  k([], "B", 40318, "Locate previous event"),
  k(["shift"], "N", 40173, "Locate next marker"),
  k(["shift"], "B", 40172, "Locate previous marker"),
  k([], "Insert", 40157, "Insert marker"),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => k(["shift"], String(n), 40160 + n, `To marker ${n}`)),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => k(["cmd"], String(n), 40656 + n, `Set marker ${n}`)),
  // Editing.
  k(["opt"], "X", 40757, "Split at cursor"),
  k(["shift"], "X", 40061, "Split range"),
  k([], "X", 41059, "Crossfade"),
  k(["cmd"], "D", 41295, "Duplicate"),
  k(["cmd"], "K", R("repeat"), "Repeat…"),
  k([], "Q", R("quantize"), "Quantize (notes in MIDI parts, audio events to the grid)"),
  k(["cmd", "shift"], "X", R("cut_time"), "Cut time"),
  k(["shift"], "Backspace", 40201, "Delete time"),
  k(["cmd", "shift"], "E", 40200, "Insert silence"),
  k(["cmd"], "G", 40032, "Group"),
  k(["cmd"], "U", 40033, "Ungroup"),
  k(["cmd", "shift"], "L", 40688, "Lock"),
  k(["cmd", "shift"], "U", 40689, "Unlock"),
  k(["cmd"], "L", 41205, "Move event start to cursor"),
  k(["cmd", "shift"], "A", 40769, "Select none"),
  k([], "E", 40625, "Left selection side to cursor"),
  k([], "D", 40626, "Right selection side to cursor"),
  k(["shift"], "M", 40719, "Mute events"),
  k(["shift"], "U", 40720, "Unmute events"),
  k(["opt"], "M", 40175, "Mute / unmute events"),
  k([], "J", 1157, "Snap on/off"),
  k(["cmd"], "E", 40153, "Open editor"),
  k([], "Return", 40153, "Open editor"),
  k([], "Left", 40416, "Select previous event"),
  k([], "Right", 40417, "Select next event"),
  k([], "Up", 40286, "Select previous track"),
  k([], "Down", 40285, "Select next track"),
  // Track.
  k([], "M", 6, "Mute selected tracks"),
  k([], "S", 7, "Solo selected tracks"),
  k([], "R", 9, "Record enable selected tracks"),
  k([], "W", R("write"), "Automation write on selected tracks"),
  k(["opt"], "R", R("read_all"), "Read automation for all tracks"),
  k(["opt"], "W", R("write_all"), "Write automation for all tracks"),
  k([], "T", 40001, "Add track"),
  k(["shift"], "Delete", 40005, "Remove selected tracks"),
  // Zoom and view.
  k([], "H", 1012, "Zoom in"),
  k([], "G", 1011, "Zoom out"),
  k(["shift"], "H", 40111, "Zoom in vertically"),
  k(["shift"], "G", 40112, "Zoom out vertically"),
  k(["shift"], "F", 40295, "Zoom full"),
  k(["opt"], "S", 40031, "Zoom to selection"),
  k(["shift"], "E", 41622, "Zoom to event"),
  k([], "Z", 40723, "Zoom tracks exclusive"),
  k(["cmd"], "Down", 41325, "Zoom in tracks"),
  k(["cmd"], "Up", 41326, "Zoom out tracks"),
  k([], "F", 40036, "Auto-scroll on/off"),
  k(["opt"], "C", 41817, "Stationary cursor"),
  k([], "L", 41173, "Locate selection start"),
  k([], "Wheel", 989, "Scroll vertically"),
  k(["shift"], "Wheel", 988, "Scroll horizontally"),
  k(["cmd"], "Wheel", 990, "Zoom horizontally"),
  // Windows and zones.
  k([], "F2", 40259, "Show/hide transport bar"),
  k([], "F3", 40078, "MixConsole"),
  k(["opt"], "F3", 40083, "MixConsole in the lower zone (dock / undock)"),
  k([], "F4", 40251, "Audio connections (routing matrix)"),
  k([], "F5", 50124, "MediaBay (Media Explorer)"),
  k([], "F8", 50125, "Video player"),
  k([], "F11", 40701, "VST Instruments (new instrument track)"),
  k([], "F12", 40240, "Audio performance"),
  k(["opt"], "K", 40377, "On-screen keyboard"),
  k(["cmd"], "P", 41157, "Pool (Project Bay)"),
  k(["cmd"], "T", 41046, "Tempo track"),
  k(["shift"], "S", 40021, "Project setup"),
  k(["cmd", "opt"], "L", 40906, "Left zone (REAPER: track manager)"),
  k(["cmd", "opt"], "E", 40078, "Lower zone (MixConsole)"),
  k(["cmd", "opt"], "R", 50124, "Right zone (Media Explorer)"),
  k(["cmd", "opt"], "T", 40259, "Transport zone"),
  k(["cmd", "opt"], "S", 41895, "Save new version"),
  // Tools 1–9.
  ...TOOLS.map((t, i) => k([], String(i + 1), R(`tool_${i + 1}`), `${t} tool`)),
  k([], "F9", R("tool_prev"), "Select previous tool"),
  k([], "F10", R("tool_next"), "Select next tool"),

  // Key Editor (REAPER's MIDI editor).
  k([], "Q", 40469, "Quantize", "midi"),
  k([], "Up", 40177, "Transpose up", "midi"),
  k([], "Down", 40178, "Transpose down", "midi"),
  k(["shift"], "Up", 40179, "Transpose up an octave", "midi"),
  k(["shift"], "Down", 40180, "Transpose down an octave", "midi"),
  k(["cmd"], "Left", 40183, "Nudge left", "midi"),
  k(["cmd"], "Right", 40184, "Nudge right", "midi"),
  k(["opt"], "Right", 40446, "Nudge end right", "midi"),
  k(["opt"], "Left", 40447, "Nudge end left", "midi"),
  ...[41081, 41079, 41076, 41073, 41070, 41067, 41064, 41062].map((id, i) => k(["opt"], String(i + 1), id, `Insert length 1/${2 ** i}`, "midi")),
  k([], "J", 1014, "Snap on/off", "midi"),
  k(["cmd"], "D", 40882, "Duplicate", "midi"),
  k(["opt"], "X", 40046, "Split notes at the cursor", "midi"),
  k(["shift"], "M", 40057, "Mute notes", "midi"),
  k(["shift"], "U", 40058, "Unmute notes", "midi"),
  k(["opt"], "M", 40055, "Mute / unmute notes", "midi"),
  k(["cmd", "shift"], "A", 40214, "Select none", "midi"),
  k([], "H", 1012, "Zoom in", "midi"),
  k([], "G", 1011, "Zoom out", "midi"),
  k([], "Return", 2, "Close the editor", "midi"),
  ...PASS.map(([mods, key, does]) => k(mods, key, 40401, `${does} (from the Key Editor)`, "midi")),
  ...TOOLS.map((t, i) => k([], String(i + 1), R(`midi_tool_${i + 1}`), `${t} tool`, "midi")),
];

/** The Object Selection tool: the base map every tool script returns to. */
const mouse: MouseMod[] = [
  { ctx: "MM_CTX_ITEM", mods: [], value: "13 m", does: "Drag an event: move" },
  { ctx: "MM_CTX_ITEM", mods: ["opt"], value: "2 m", does: "Alt-drag: copy" },
  { ctx: "MM_CTX_ITEM", mods: ["cmd"], value: "32 m", does: "Ctrl/Cmd-drag: move to another track only (constrain)" },
  { ctx: "MM_CTX_ITEM", mods: ["shift", "opt"], value: "39 m", does: "Alt+Shift-drag: shared copy (pooled MIDI)" },
  { ctx: "MM_CTX_ITEM_CLK", mods: [], value: "3 m", does: "Click an event: select it (the cursor stays)" },
  { ctx: "MM_CTX_ITEM_CLK", mods: ["shift"], value: "4 m", does: "Shift-click: add to / remove from the selection" },
  { ctx: "MM_CTX_ITEM_CLK", mods: ["opt"], value: "31 m", does: "Alt-click: split" },
  { ctx: "MM_CTX_TRACK", mods: [], value: "9 m", does: "Drag empty space: rubber-band select" },
  { ctx: "MM_CTX_TRACK_CLK", mods: [], value: "1 m", does: "Click empty space: deselect and locate" },
  { ctx: "MM_CTX_TRACK_CLK", mods: ["opt"], value: "3 m", does: "Alt-click empty space: deselect" },
  { ctx: "MM_CTX_MIDI_NOTE", mods: [], value: "1 m", does: "Drag a note: move" },
  { ctx: "MM_CTX_MIDI_NOTE_CLK", mods: [], value: "1 m", does: "Click a note: select" },
  { ctx: "MM_CTX_MIDI_PIANOROLL", mods: [], value: "7 m", does: "Drag empty Key Editor space: rubber-band select" },
  { ctx: "MM_CTX_MIDI_PIANOROLL_CLK", mods: [], value: "1 m", does: "Click empty Key Editor space: deselect and locate" },
];

const tb = (action: ToolbarItem["action"], label: string, icon?: string, toggle = false): ToolbarItem => ({ action, label, ...(icon ? { icon: `assist_cubase_${icon}` } : {}), ...(toggle ? { toggle } : {}) });
const SEP: ToolbarItem = { action: "-", label: "" };

export const cubase: Workflow = {
  id: "cubase",
  daw: "Cubase",
  blurb: "Grey parts on dark lanes, yellow M / blue S, the transport at the bottom; numpad transport, tools on 1–9, Alt+X split, P locators, F3 MixConsole.",
  reaper: {
    ...reaperColors({ bg: "#25282b", lane1: "#25282b", lane2: "#25282b", sel: "#282b2f", ruler: "#1c1d21", rulerText: "#f3f4f6", grid: "#5e6366", item: "#929395", peaks: "#3e4042", cursor: "#f2f3f3", play: "#ffffff", note: "#929395", region: "#725be5", marker: "#e53679", text: "#f2f3f3" }),
    col_main_bg: "#24282b", col_mixerbg: "#24282b",
    // Flat panels: no sunken 3D frames (they boxed the MIDI editor's empty mouse-position readouts).
    col_main_3dhl: "#25282b", col_main_3dsh: "#25282b",
    // Bar lines, beats, subdivisions: REAPER draws them at 75 / 33 / 35 % over the lanes, which lands on
    // Cubase's #505457 bars and faint beats.
    col_gridlines2: "#5e6366", col_gridlines3: "#5a5f62", col_gridlines: "#45494c",
    col_tr1_divline: "#35383b", col_tr2_divline: "#35383b",
    // Ruler: dark, white bar numbers; the cycle (loop) range violet, a time selection light.
    col_tl_fg2: "#a8abad", col_tl_bgsel: "#cfd2d6", col_tl_bgsel2: "#725be5",
    areasel_fill: "#58b9fe", areasel_outline: "#8ac7f4",
    // Events: grey with dark contents and a black name; selected ones navy with grey contents and a white name.
    col_mi_label: "#0b0b0b", col_mi_label_sel: "#ffffff", col_mi_label_float: "#0b0b0b", col_mi_label_float_sel: "#ffffff",
    col_tr1_itembgsel: "#121327", col_tr2_itembgsel: "#121327", col_tr1_ps2: "#929395", col_tr2_ps2: "#929395",
    col_peaksedge: "#3e4042", col_peaksedge2: "#3e4042", col_peaksedgesel: "#929395", col_peaksedgesel2: "#929395",
    // Key Editor: rows for white / black keys, a light C line, a light keyboard with black keys, dark surrounds.
    midi_trackbg1: "#25282b", midi_trackbg2: "#212326", midi_trackbg_outer1: "#1d1f22", midi_trackbg_outer2: "#1a1c1e",
    midi_gridhc: "#505355", midi_gridh: "#17191b",
    midi_pkey1: "#b2b3b4", midi_pkey2: "#161719", midi_pkey3: "#161719", midi_leftbg: "#25282b",
    midi_ccbut: "#45484a", midi_ccbut_text: "#f2f3f3", midi_ccbut_arrow: "#f2f3f3",
    // Mouse-position readouts left of the ruler and the CC lane (edit-field colour) sink into the panel;
    // off-screen notes are marked in a quiet grey (REAPER's teal otherwise).
    col_main_editbk: "#25282b", midi_ofsn: "#45484b", midi_ofsnsel: "#8a8c8f",
    midi_rulerbg: "#1b1d20", midi_rulerfg: "#f3f3f3", midi_editcurs: "#ffffff", midi_selpitch1: "#33373b", midi_selpitch2: "#2e3135",
    // Lists (FX browser, Media Explorer): a white row with black text for the selection.
    genlist_bg: "#25282b", genlist_selbg: "#e9e9e9", genlist_selfg: "#0b0b0b", genlist_seliabg: "#3a3d41", genlist_seliafg: "#f2f3f3",
    midieditorlist_selbg: "#e9e9e9", midieditorlist_selfg: "#0b0b0b",
    docker_bg: "#24282b", windowtab_bg: "#24282b", docker_selface: "#3a3d41", docker_unselface: "#24282b",
    // Muted and un-soloed lanes keep the lane colour (their events only a touch fainter, mode below);
    // no dot on the selected event.
    mute_overlay_col: "#25282b", selitem_dot: "#121327",
  },
  // Cubase doesn't shade muted or un-soloed tracks' events: a faint 12 % wash instead of REAPER's 65 %.
  reaperModes: { mute_overlay_mode: 0x20000 | (0x20 << 8) },
  panels: { track: "#25282b", master: "#2b2f33", transport: "#24282b" },
  panel: { bg: "#25282b", panel: "#2b2f33", panelAlt: "#3a3d41", border: "#1b1d20", text: "#f2f3f3", textDim: "#c9cacb", accent: "#2a6fb0", accentText: "#ffffff", accent2: "#725be5" },
  shortcuts,
  mouse,
  toolSlots: [
    { ctx: "MM_CTX_ITEM", mods: [] }, { ctx: "MM_CTX_ITEM_CLK", mods: [] }, { ctx: "MM_CTX_ITEM_CLK", mods: ["opt"] },
    { ctx: "MM_CTX_TRACK", mods: [] }, { ctx: "MM_CTX_TRACK_CLK", mods: [] }, { ctx: "MM_CTX_TRACK_CLK", mods: ["opt"] },
    { ctx: "MM_CTX_MIDI_NOTE", mods: [] }, { ctx: "MM_CTX_MIDI_NOTE_CLK", mods: [] },
    { ctx: "MM_CTX_MIDI_PIANOROLL", mods: [] }, { ctx: "MM_CTX_MIDI_PIANOROLL_CLK", mods: [] },
  ],
  prefs: [
    { key: "locklooptotime", value: 0, does: "Locators (loop points) stay put when you select a range" },
    { key: "viewadvance", value: 3, bits: 1 | 2 | 16, does: "Auto-scroll on (playing and recording), stationary cursor off" },
    { key: "autoxfade", value: 2, bits: 1 | 2, does: "No automatic crossfades; an event in front hides what is behind it" },
    { key: "itemicons", value: 0, bits: 16511, does: "Events show only their name (no lock / mute / FX buttons or volume knob on them)" },
    { key: "defvzoom", value: 2, does: "New tracks start at Cubase's default height (two rows of controls)" },
    { key: "projtimemode", value: 6, does: "The ruler counts bars (Measures.Beats, minimal: \"1  2  3\"), no second time row" },
    { key: "projtimemode2", value: 2, does: "The time display shows bars and beats" },
    { key: "trackitemgap", value: 0, does: "Events fill the track's height, as Cubase's do" },
    { key: "labelitems2", value: 0, bits: 8, does: "Event names sit inside the event at its top edge (not above it)" },
    { key: "transflags", value: 2, bits: 2, does: "The time display shows only the position (no [Stopped] / [Playing] text)" },
    { key: "mixrowflags", value: 4, bits: 4, does: "The MixConsole shows the main output (master) at the right end" },
    { key: "toppane", value: 60, does: "A slimmer ruler, nearer Cubase's single strip (the toolbar beside it keeps its two rows)" },
  ],
  // Start with the Object Selection tool lit (REAPER forgets script toggle states between sessions).
  startup: ["_RS_assist_cubase_tool_1"],
  scripts,
  toolbars: [
    {
      section: "Main toolbar",
      items: [
        // Two rows above the track list (REAPER gives the toolbar there two 30 px rows at the default
        // ruler height): the project buttons, then the nine tools with snap, grid and quantize.
        // REAPER splits a toolbar over its rows to balance their widths, so both rows are kept at
        // 375 px (10 buttons + 5 gaps): the break then falls just before the tools, with no gap
        // carried over to indent row 2, and both rows fit the 380 px track list.
        tb(40029, "Undo", "undo"), tb(40030, "Redo", "redo"), SEP,
        tb(50124, "MediaBay", "mediabay", true), tb(40078, "MixConsole", "mixconsole", true), SEP,
        tb(40339, "Deactivate all mute states", "mute_all"), tb(40340, "Deactivate all solo states", "solo_all"), SEP,
        tb(R("read_all"), "Read all automation", "read_all", true), tb(R("write_all"), "Write all automation", "write_all", true), SEP,
        tb(40036, "Auto-scroll", "autoscroll", true), SEP,
        tb(40364, "Metronome (click)", "click", true),
        ...TOOLS.map((t, i) => tb(R(`tool_${i + 1}`), `${t} tool (${i + 1})`, `tool_${i + 1}`, true)), SEP,
        tb(1157, "Snap on/off", "snap", true), tb(40071, "Snap and grid settings", "grid"), tb(R("quantize"), "Quantize", "quantize"),
      ],
    },
    {
      section: "MIDI piano roll toolbar",
      items: [
        ...[1, 8, 5, 3, 7].map((n) => tb(R(`midi_tool_${n}`), `${TOOLS[n - 1]} tool (${n})`, `tool_${n}`, true)), SEP,
        tb(1014, "Snap on/off", "snap", true), tb(40469, "Quantize", "quantize"),
      ],
    },
  ],
  layout: {
    transport: "bottom",
    tcp: "left",
    tcpWidth: 380,
    browser: { side: "right", width: 300, tabs: ["fxbrowser", "explorer"] },
    mixer: "docked",
    midiEditor: "docked",
    dockHeight: 380,
  },
  glossary: [
    ["Event / Part", "an item (a MIDI part is a MIDI item)"],
    ["Project window", "the arrange view"],
    ["Left / right locators, Cycle", "the loop points and Repeat (kept apart from the time selection)"],
    ["Range Selection tool", "a razor edit area or the time selection"],
    ["Key Editor", "the MIDI editor (docked in the lower zone)"],
    ["MixConsole", "the mixer (docked in the lower zone, F3)"],
    ["Inserts / Channel Settings (e)", "the track's FX chain"],
    ["Inspector", "no twin: the track panel, FX chain and routing buttons"],
    ["MediaBay / Pool", "the Media Explorer / the Project Bay"],
    ["Tempo track / Arranger track", "the master tempo envelope / regions"],
    ["Audio Mixdown", "File → Render"],
    ["Freeze / Render in Place", "Track → Freeze / Apply track FX"],
  ],
};
