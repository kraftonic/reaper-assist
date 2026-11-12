import type { ActionRef, KeySection, Mod, MouseMod, ProfileScript, Shortcut, Workflow } from "../types";
import { mix, reaperColors } from "../skins";

/**
 * Coming from Studio One (6/7, default dark appearance; Fender Studio Pro 8 keeps the same keys).
 * Spec: docs/research/studioone.md. Keys follow PreSonus' "Studio One 5 Key Shortcuts"
 * sheet ([Ctrl] = ⌘, [Alt] = ⌥); every action id is checked against REAPER 7.82's action list.
 *
 * Tools 1–8 (Arrow, Range, Split, Eraser, Paint, Mute, Bend, Listen) are scripts that swap a few
 * mouse-modifier slots (studioone_tools.lua). The profile's own mouse map below is the Arrow tool;
 * keep studioone_tools.lua's BASE tables in step with it (test/profiles/studioone.test.ts checks).
 */

const S = (name: string) => `_RS_assist_studioone_${name}` as const;
const k = (mods: Mod[], key: string, action: ActionRef, does: string, section?: KeySection): Shortcut => (section ? { mods, key, action, does, section } : { mods, key, action, does });

/** Arrange tools 1–8 and the note editor's 1–7 (the editor has no Bend tool). */
export const STUDIOONE_TOOLS = ["arrow", "range", "split", "eraser", "paint", "mute", "bend", "listen"] as const;
const TOOL_LABEL: Record<(typeof STUDIOONE_TOOLS)[number], string> = {
  arrow: "Arrow tool", range: "Range tool", split: "Split tool", eraser: "Eraser tool", paint: "Paint tool", mute: "Mute tool", bend: "Bend tool", listen: "Listen tool",
};
const MIDI_TOOLS = STUDIOONE_TOOLS.filter((t) => t !== "bend");

const scripts: ProfileScript[] = [
  ...STUDIOONE_TOOLS.map((t): ProfileScript => ({ id: `RS_assist_studioone_tool_${t}`, file: `studioone_tool_${t}.lua`, name: `Studio One ${TOOL_LABEL[t]}` })),
  ...MIDI_TOOLS.map((t): ProfileScript => ({ id: `RS_assist_studioone_tool_${t}_midi`, file: `studioone_tool_${t}.lua`, name: `Studio One ${TOOL_LABEL[t]} (note editor)`, section: "midi" })),
  { id: "RS_assist_studioone_listen", file: "studioone_listen.lua", name: "Studio One Listen (solo and play from the click)" },
  { id: "RS_assist_studioone_stop", file: "studioone_stop.lua", name: "Studio One Stop (stop in place; again: return to zero)" },
  { id: "RS_assist_studioone_autopunch", file: "studioone_autopunch.lua", name: "Studio One Autopunch on/off" },
  { id: "RS_assist_studioone_loop_selection", file: "studioone_loop_selection.lua", name: "Studio One Loop selection (snapped)" },
  { id: "RS_assist_studioone_monitor", file: "studioone_monitor.lua", name: "Studio One Monitor on/off" },
  { id: "RS_assist_studioone_quantize", file: "studioone_quantize.lua", name: "Studio One Quantize" },
  { id: "RS_assist_studioone_quantize50", file: "studioone_quantize50.lua", name: "Studio One Quantize 50%" },
];

/**
 * The Arrow tool's mouse map (ids read back from REAPER 7.82 with SetMouseModifier by name).
 * Studio One: Alt-drag copies, Ctrl-drag on a part makes a ghost (shared) copy, Ctrl+Alt slips the
 * contents, Shift drags without snap, Alt on an edge stretches; clicking never moves the cursor,
 * dragging in empty space draws a selection rectangle, and Ctrl in empty space is the Range tool.
 */
const mouse: MouseMod[] = [
  { ctx: "MM_CTX_ITEM", mods: ["opt"], value: "2 m", does: "⌥-drag an event: copy" },
  { ctx: "MM_CTX_ITEM", mods: ["cmd"], value: "39 m", does: "⌘-drag a part: shared (ghost) copy" },
  { ctx: "MM_CTX_ITEM", mods: ["cmd", "opt"], value: "58 m", does: "⌘⌥-drag: slip the contents" },
  { ctx: "MM_CTX_ITEM", mods: ["shift"], value: "4 m", does: "⇧-drag: move without snap" },
  { ctx: "MM_CTX_ITEMEDGE", mods: ["opt"], value: "2 m", does: "⌥-drag an edge: stretch" },
  { ctx: "MM_CTX_ITEM_CLK", mods: [], value: "3 m", does: "Click an event: select it (the cursor stays)" },
  { ctx: "MM_CTX_TRACK", mods: [], value: "9 m", does: "Drag in empty space: selection rectangle" },
  { ctx: "MM_CTX_TRACK", mods: ["cmd"], value: "25 m", does: "⌘-drag in empty space: Range" },
  { ctx: "MM_CTX_TRACK_CLK", mods: [], value: "3 m", does: "Click in empty space: deselect (the cursor stays)" },
  { ctx: "MM_CTX_MIDI_NOTE_CLK", mods: [], value: "1 m", does: "Click a note: select it" },
  { ctx: "MM_CTX_MIDI_PIANOROLL", mods: [], value: "7 m", does: "Drag in the note editor: selection rectangle (double-click adds a note)" },
  { ctx: "MM_CTX_MIDI_PIANOROLL_CLK", mods: [], value: "3 m", does: "Click empty note space: deselect" },
];

const MIDI_PASS: [Mod[], string][] = [[[], "Space"], [[], "Return"], [[], "F3"], [[], "F5"], [[], "Num0"], [[], "Num*"], [[], "Num/"], [[], "Num."], [[], "C"]];

const shortcuts: Shortcut[] = [
  // Transport (the numpad, as in Studio One).
  k([], "Space", 40328, "Start / stop (stops where you are)"),
  k([], "Return", 1007, "Start"),
  k([], "NumEnter", 1007, "Start"),
  k([], "Num0", S("stop"), "Stop (again: return to zero)"),
  k([], "Num*", 1013, "Record"),
  k([], "Num/", 1068, "Loop on/off"),
  k([], "Num.", 40042, "Return to zero"),
  k([], "Num+", 40085, "Forward"),
  k([], "Num-", 40084, "Rewind"),
  k([], "Num1", 40632, "Go to loop start"),
  k([], "Num2", 40633, "Go to loop end"),
  ...[3, 4, 5, 6, 7, 8, 9].map((n, i) => k([], `Num${n}`, 40161 + i, `Recall marker ${i + 1}`)),
  k([], "C", 40364, "Click (metronome) on/off"),
  k([], "I", S("autopunch"), "Autopunch on/off"),
  k([], "O", 41819, "Preroll on/off"),
  k([], "P", S("loop_selection"), "Loop selection (snapped)"),
  k([], "L", 41173, "Locate selection"),
  k(["shift"], "N", 40173, "Go to next marker"),
  k(["shift"], "B", 40172, "Go to previous marker"),
  k([], "Insert", 40157, "Insert marker"),
  k(["shift"], "Insert", 40171, "Insert named marker"),
  k(["cmd", "shift"], "R", 1013, "Record (laptop extra, not a Studio One default)"),
  k([], "/", 1068, "Loop on/off (laptop extra)"),
  // Tools.
  ...STUDIOONE_TOOLS.map((t, i) => k([], String(i + 1), S(`tool_${t}`), TOOL_LABEL[t])),
  // Editing.
  k(["opt"], "X", 40757, "Split at cursor"),
  k(["cmd", "opt"], "X", 40061, "Split range"),
  k(["cmd", "shift"], "X", "_assist_studioone_split_loop", "Split loop"),
  k([], "D", 41295, "Duplicate"),
  k(["shift"], "D", "_assist_studioone_dup_shared", "Duplicate shared"),
  k([], "G", 40362, "Merge events"),
  k(["cmd"], "B", 41588, "Bounce selection"),
  k(["cmd", "opt"], "B", 40788, "Bounce to new track"),
  k([], "Q", S("quantize"), "Quantize"),
  k(["opt"], "Q", S("quantize50"), "Quantize 50%"),
  k(["shift"], "M", 40175, "Mute event"),
  k([], "N", 1157, "Snap on/off"),
  k([], "F", 40036, "Autoscroll on/off"),
  k([], "X", 41059, "Create crossfades"),
  k(["cmd"], "R", 41051, "Reverse audio"),
  k(["opt"], "N", 40108, "Normalize audio"),
  k(["opt"], "F", 40638, "Event FX"),
  k(["cmd"], "P", 40214, "Insert instrument part"),
  k(["cmd"], "D", 40289, "Deselect all"),
  k(["cmd"], "I", 41115, "Invert selection"),
  k(["cmd"], "L", 41205, "Move to cursor"),
  k(["opt"], "R", 40290, "Create range from events"),
  k(["cmd", "opt"], "R", 1162, "Ripple edit on/off"),
  k(["cmd", "opt"], "D", 40201, "Delete time"),
  k(["cmd", "opt"], "I", 40200, "Insert silence"),
  k(["cmd"], "Y", 40030, "Redo"),
  k(["opt"], "Left", 40120, "Nudge back"),
  k(["opt"], "Right", 40119, "Nudge"),
  k(["cmd", "opt"], "Left", 40793, "Nudge bar back"),
  k(["cmd", "opt"], "Right", 40794, "Nudge bar"),
  k(["cmd"], "T", 40069, "Go to time"),
  // Tracks.
  k([], "T", 41067, "Add tracks"),
  k(["shift"], "T", 40005, "Remove track"),
  k([], "M", 6, "Mute track"),
  k([], "S", 7, "Solo track"),
  k([], "R", 9, "Record-arm track"),
  k([], "U", S("monitor"), "Monitor on/off"),
  k([], "A", 41151, "Show automation"),
  // Zoom and scrolling (Studio One: wheel scrolls, ⌘ zooms; E/W in, out).
  k([], "E", 1012, "Zoom in"),
  k([], "W", 1011, "Zoom out"),
  k(["shift"], "E", 40111, "Zoom in vertically"),
  k(["shift"], "W", 40112, "Zoom out vertically"),
  k(["opt"], "Z", 40295, "Zoom full"),
  k([], "Z", 41622, "Toggle zoom"),
  k(["shift"], "S", 40031, "Zoom to selection"),
  k(["shift"], "L", "_assist_studioone_zoom_loop", "Zoom to loop"),
  k(["opt"], "W", 40848, "Undo zoom"),
  k(["opt"], "E", 40762, "Redo zoom"),
  k([], "Wheel", 989, "Mouse wheel scrolls vertically"),
  k(["shift"], "Wheel", 988, "⇧ + wheel scrolls horizontally"),
  k(["cmd"], "Wheel", 1000, "⌘ + wheel zooms vertically"),
  k(["cmd", "shift"], "Wheel", 990, "⌘⇧ + wheel zooms horizontally"),
  // Views.
  k([], "F2", 40153, "Editor"),
  k([], "F3", 40078, "Console"),
  k([], "F5", 50124, "Browser (files and loops)"),
  k([], "F6", 40271, "Browser: instruments"),
  k([], "F7", 40271, "Browser: effects"),
  k([], "F10", 41157, "Browser: pool"),
  k([], "F11", 40291, "Channel editor (FX chain)"),
  k([], "F12", 41079, "Toggle floating windows"),
  k(["cmd"], "E", 40015, "Export mixdown"),
  // Note editor.
  ...MIDI_TOOLS.map((t, i) => k([], String(i + 1), S(`tool_${t}_midi`), `${TOOL_LABEL[t]} (note editor)`, "midi")),
  k([], "Q", 40469, "Quantize notes", "midi"),
  k(["shift"], "Q", 40402, "Restore timing", "midi"),
  k(["opt"], "Up", 40177, "Transpose up", "midi"),
  k(["opt"], "Down", 40178, "Transpose down", "midi"),
  k(["opt"], "Left", 40183, "Nudge back", "midi"),
  k(["opt"], "Right", 40184, "Nudge", "midi"),
  k([], "D", 40882, "Duplicate", "midi"),
  k(["cmd"], "D", 40214, "Deselect all", "midi"),
  k([], "N", 1014, "Snap on/off", "midi"),
  k(["shift"], "M", 40055, "Mute notes", "midi"),
  k(["opt"], "X", 40046, "Split notes at cursor", "midi"),
  k([], "E", 1012, "Zoom in", "midi"),
  k([], "W", 1011, "Zoom out", "midi"),
  k(["shift"], "E", 40111, "Zoom in vertically", "midi"),
  k(["shift"], "W", 40112, "Zoom out vertically", "midi"),
  k([], "F2", 2, "Close the editor (F2 toggles)", "midi"),
  k([], "Wheel", 40432, "Mouse wheel scrolls vertically", "midi"),
  k(["shift"], "Wheel", 40433, "⇧ + wheel scrolls horizontally", "midi"),
  k(["cmd"], "Wheel", 40430, "⌘ + wheel zooms vertically", "midi"),
  k(["cmd", "shift"], "Wheel", 40431, "⌘⇧ + wheel zooms horizontally", "midi"),
  ...MIDI_PASS.map(([mods, key]) => k(mods, key, 40401, `${key}: same as in the arrange view`, "midi")),
];

const icon = (name: string) => `assist_studioone_${name}`;

// Studio One's dark appearance (measured from its manual's screenshots): charcoal lanes under a grey
// track column, events in the track colour (Studio One blue on a track without one), light ruler text.
const LANE = "#222325";
const EVENT = "#0475e2";

export const studioone: Workflow = {
  id: "studioone",
  daw: "Studio One",
  blurb: "Studio One's dark look; tools on 1–8, Space stops in place, F2 editor, F3 console, F5 browser.",
  reaper: {
    ...reaperColors({ bg: "#373a3e", lane1: LANE, lane2: LANE, sel: "#2c2d2f", ruler: "#2b2d30", rulerText: "#c8c8c8", grid: "#303133", item: EVENT, peaks: "#0b2a4a", cursor: "#d9dcdf", play: "#ffffff", note: EVENT, region: "#5a7fa8", marker: "#cfd3d8", text: "#e0e2e4" }),
    col_arrangebg: "#212325",
    col_mixerbg: "#26282b", docker_bg: "#2b2d30", windowtab_bg: "#2b2d30",
    col_tr1_divline: "#2c2d2f", col_tr2_divline: "#2c2d2f",
    // Grid: bars, beats, between beats (each blended over the lane by REAPER's draw mode).
    col_gridlines2: "#3e4246", col_gridlines3: "#464a4c", col_gridlines: "#303133",
    col_tl_fg2: "#8c9095", col_tl_bgsel2: "#2f4c6e",
    // REAPER's region / marker lanes over the ruler sit beside the toolbar: they take the toolbar band's grey (and
    // hide their dividers), so the tools read as Studio One's band across the top with the bar ruler under it.
    region_lane_bg: "#373a3e", ts_lane_bg: "#373a3e", marker_lane_bg: "#373a3e",
    col_tr1_itembgsel: mix(EVENT, "#ffffff", 0.22), col_tr2_itembgsel: mix(EVENT, "#ffffff", 0.22),
    col_tr1_ps2: "#0b2a4a", col_tr2_ps2: "#0b2a4a", selitem_dot: "#00e5ff",
    col_mi_label: "#ffffff", col_mi_label_sel: "#ffffff", col_mi_label_float: "#e6e6e6", col_mi_label_float_sel: "#ffffff",
    col_seltrack: "#646a71", col_seltrack2: "#646a71",
    // Note editor: dark rows (naturals lighter), white and black keys, grid lines bars > beats > 16ths.
    midi_trackbg1: "#2b2d31", midi_trackbg2: "#232527", midi_trackbg_outer1: "#1f2023", midi_trackbg_outer2: "#1b1c1e",
    midi_inline_trackbg1: "#2b2d31", midi_inline_trackbg2: "#232527",
    midi_selpitch1: "#303337", midi_selpitch2: "#292b2e", midi_gridh: "#27292c", midi_gridhc: "#232527",
    midi_grid2: "#ffffff", midi_grid3: "#76797e", midi_grid1: "#818385",
    midi_rulerfg: "#c8c8c8", midi_editcurs: "#ffffff", midi_notefg: "#e8f2ff",
    midi_pkey1: "#f0f2f3", midi_pkey2: "#1c1e20", midi_pkey3: "#347fd4",
    // The editor's left column and its read-out boxes share one colour, so the empty boxes don't show.
    midi_leftbg: "#2b2d31", col_main_editbk: "#2b2d31",
    midi_ccbut: "#3c3f43", midi_ccbut_text: "#e0e2e4", midi_ccbut_arrow: "#e0e2e4",
    // Notes above / below the visible keys (marks at the edge), and the part's end marker.
    midi_ofsn: "#1d4f86", midi_ofsnsel: "#8cc4ff", midi_endpt: "#c8c8c8",
    genlist_selbg: "#347fd4", col_explorer_sel: "#347fd4", col_explorer_seledge: mix("#347fd4", "#ffffff", 0.3),
    // The read-out boxes on the editor's left take their edges from the main 3D colours: match them to the column.
    col_main_3dhl: "#2b2d31", col_main_3dsh: "#2b2d31",
    // A toggled toolbar button (lit tool, Snap): a navy plate under the blue glyph.
    toolbararmed_color: "#1f4a7a",
    // Console inserts and sends: light grey names (bypassed / muted dimmer, offline red), blue send levels.
    mcp_fx_normal: "#c2c6ca", mcp_fx_bypassed: "#7d8288", mcp_fx_offlined: "#d27a78",
    mcp_sends_normal: "#c2c6ca", mcp_sends_muted: "#7d8288", mcp_send_midihw: "#a9adb2", mcp_sends_levels: "#347fd4",
  },
  // Draw modes (0x20000 = custom opacity, bits 8–16 its amount):
  // - REAPER shades muted (and, while something is soloed, unsoloed) tracks; Studio One doesn't, so the shade is at 0.
  //   (Any shade also darkens the fixed left column of the event frame, the name tab's, but not the rest of the event.)
  // - The light corner marks REAPER draws on events (the edges of the fade controls) are hidden; Studio One has none.
  reaperModes: { mute_overlay_mode: 0x20000, col_mi_fade2_drawmode: 0x20000 },
  panels: { track: "#3b3e43", master: "#26282b", transport: "#373a3e" },
  panel: { bg: "#2b2d30", panel: "#373a3e", panelAlt: "#44484d", border: "#17191b", text: "#e0e2e4", textDim: "#a9adb2", accent: "#347fd4", accentText: "#ffffff", accent2: "#dbb14e" },
  shortcuts,
  mouse,
  toolSlots: [
    ...["MM_CTX_ITEM", "MM_CTX_ITEM_CLK", "MM_CTX_TRACK", "MM_CTX_TRACK_CLK", "MM_CTX_ENVLANE", "MM_CTX_ENVSEG"].map((ctx) => ({ ctx, mods: [] as Mod[] })),
    ...["MM_CTX_MIDI_NOTE", "MM_CTX_MIDI_NOTE_CLK", "MM_CTX_MIDI_PIANOROLL", "MM_CTX_MIDI_PIANOROLL_CLK"].map((ctx) => ({ ctx, mods: [] as Mod[] })),
  ],
  prefs: [
    { key: "locklooptotime", value: 0, does: "The loop range is its own thing, not the time selection (as in Studio One)" },
    { key: "mixrowflags", value: 52, bits: 52, does: "Console: Main channel on the right, inserts and sends shown" },
    { key: "projgriddiv", value: 0.25, does: "New songs: 1/16 grid (Studio One's default quantize)" },
    { key: "itemicons", value: 0, bits: 16511, does: "Events show no lock / mute / FX / notes badges or volume knob (Studio One's events have none)" },
    { key: "transflags", value: 2, bits: 2, does: "The transport shows the time without REAPER's play-state text" },
    { key: "defvzoom", value: 5, does: "New songs: 60 px tracks (Studio One's Normal track height)" },
    { key: "labelitems2", value: 1, bits: 9, does: "Event names inside the event (on its name tab), not above it" },
    { key: "projtimemode", value: 6, does: "New songs: the ruler counts bars (beats as you zoom in), like Studio One's" },
    { key: "projtimemode2", value: 2, does: "The transport's main display shows bars and beats" },
    { key: "gridinbg", value: 2, does: "Grid lines run under the events, not across them (Studio One's events are opaque)" },
    { key: "griddot", value: 0, does: "Solid grid lines, as in Studio One" },
    { key: "trackitemgap", value: 1, does: "Events fill their track down to a hairline, as Studio One's do" },
  ],
  macros: [
    { id: "assist_studioone_dup_shared", name: "Studio One Duplicate shared", actions: [41071, 41295, 41071] },
    { id: "assist_studioone_split_loop", name: "Studio One Split loop", actions: [40623, 40061] },
    { id: "assist_studioone_zoom_loop", name: "Studio One Zoom to loop", actions: [40623, 40031] },
    { id: "assist_studioone_erase", name: "Studio One Eraser click", actions: [40289, 40528, 40006] },
    { id: "assist_studioone_mute_click", name: "Studio One Mute tool click", actions: [40289, 40528, 40175] },
  ],
  // Start with the Arrow tool lit (REAPER forgets script toggle states between sessions).
  startup: ["_RS_assist_studioone_tool_arrow"],
  scripts,
  toolbars: [
    {
      section: "Main toolbar",
      title: "Studio One tools",
      items: [
        ...STUDIOONE_TOOLS.map((t, i) => ({ action: S(`tool_${t}`), label: `${TOOL_LABEL[t]} (${i + 1})`, icon: icon(t), toggle: true })),
        { action: "-", label: "" },
        { action: 1157, label: "Snap (N)", icon: icon("snap"), toggle: true },
        { action: 40071, label: "Snap and quantize settings", icon: icon("grid") },
        { action: S("quantize"), label: "Quantize (Q)", icon: icon("quantize") },
        { action: 40036, label: "Autoscroll (F)", icon: icon("follow"), toggle: true },
        { action: 41151, label: "Show automation (A)", icon: icon("auto"), toggle: true },
        { action: 1162, label: "Ripple edit", icon: icon("ripple"), toggle: true },
        { action: 40364, label: "Click (C)", icon: icon("click"), toggle: true },
      ],
    },
    {
      section: "MIDI piano roll toolbar",
      title: "Studio One note editor",
      items: [
        ...MIDI_TOOLS.map((t, i) => ({ action: S(`tool_${t}_midi`), label: `${TOOL_LABEL[t]} (${i + 1})`, icon: icon(t), toggle: true })),
        { action: "-", label: "" },
        { action: 1014, label: "Snap (N)", icon: icon("snap"), toggle: true },
        { action: 40469, label: "Quantize (Q)", icon: icon("quantize") },
      ],
    },
  ],
  layout: {
    transport: "bottom",
    tcp: "left",
    tcpWidth: 255,
    browser: { side: "right", width: 300, tabs: ["fxbrowser", "explorer"] },
    mixer: "hidden",
    midiEditor: "docked",
    // Studio One colours notes by their part, and parts take the track's colour.
    midiNoteColor: "track",
    dockHeight: 380,
  },
  glossary: [
    ["Event / Instrument Part", "an item / a MIDI item"],
    ["Console (F3)", "the mixer, docked at the bottom"],
    ["Editor (F2)", "the MIDI editor, docked at the bottom"],
    ["Browser (F5)", "the FX browser and Media Explorer, docked on the right"],
    ["Range tool", "razor editing (or a time selection)"],
    ["Loop range", "the loop points (kept apart from the time selection)"],
    ["Duplicate Shared", "a pooled (ghost) MIDI copy"],
    ["Merge / Bounce Selection", "Glue"],
    ["Bend markers", "stretch markers"],
    ["Channel Editor (F11)", "the track's FX chain window"],
    ["Main", "the master track"],
    ["Inspector (F4)", "no twin in REAPER: track routing and the FX chain hold its settings"],
  ],
};
