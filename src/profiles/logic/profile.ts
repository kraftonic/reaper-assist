import type { Mod, MouseMod, Shortcut, ToolbarItem, Workflow } from "../types";
import { reaperColors } from "../skins";

/**
 * Logic Pro (dark appearance): charcoal tracks area, mid-grey track headers, regions in the
 * track colour, a light control bar with a dark LCD, the Library on the left, the Browsers on
 * the right and the Mixer / Piano Roll in the lower pane.
 *
 * Function follows Logic's default key set: Space stops where it is, M/S mute and solo the
 * track, T opens the tool menu, ⌘T splits at the playhead, ⌘J joins, Return goes to the start.
 * Clicking a region selects it without moving the playhead; the playhead moves from the ruler.
 *
 * Action ids are checked against REAPER 7.82's action list; mouse behaviour ids and the
 * preference keys/bits were read back from REAPER 7.82 itself (probes in a throwaway REAPER).
 */

const RS = (name: string) => `_RS_assist_logic_${name}` as const;

/** Arrange-view tools (T menu / toolbar), each its own command so the toolbar can light the active one. */
const TOOLS = ["pointer", "pencil", "eraser", "scissors", "mute", "zoom", "marquee"] as const;
/** Piano Roll tools: registered in the MIDI editor section under their own ids. */
const MIDI_TOOLS = ["pointer", "pencil", "eraser", "mute", "velocity", "brush"] as const;
const TOOL_LABEL: Record<string, string> = {
  pointer: "Pointer Tool", pencil: "Pencil Tool", eraser: "Eraser Tool", scissors: "Scissors Tool", mute: "Mute Tool",
  zoom: "Zoom Tool", marquee: "Marquee Tool", velocity: "Velocity Tool", brush: "Brush Tool",
};

const key = (mods: Mod[], k: string, action: Shortcut["action"], does: string, section?: Shortcut["section"]): Shortcut => ({ mods, key: k, action, does, ...(section ? { section } : {}) });
const mm = (ctx: string, mods: Mod[], value: string, does: string): MouseMod => ({ ctx, mods, value, does });
const tool = (name: string, midi = false): ToolbarItem => ({ action: RS(`tool_${name}${midi ? "_midi" : ""}`), label: TOOL_LABEL[name]!, icon: `assist_logic_${name}`, toggle: true });

export const logic: Workflow = {
  id: "logic",
  daw: "Logic Pro",
  blurb: "Charcoal tracks, light control bar with LCD; Space stops in place, T tools, X mixer, P piano roll.",
  reaper: {
    ...reaperColors({ bg: "#2b2b2b", lane1: "#2e2e2e", lane2: "#2e2e2e", sel: "#343435", ruler: "#2d2d2d", rulerText: "#d7d7d7", grid: "#3c3c3c", item: "#1aa331", peaks: "#c8f5d0", cursor: "#e6e6e6", play: "#f0f0f0", note: "#4fb441", region: "#7a7a7a", marker: "#b0b0b0", text: "#e6e6e6" }),
    // Tracks area: one-pixel dark lines between lanes.
    col_tr1_divline: "#262626", col_tr2_divline: "#262626",
    // Muted tracks' regions fade into the lane (REAPER's overlay; Logic dims muted regions).
    mute_overlay_col: "#2e2e2e",
    // Ruler: REAPER's region / marker / tempo lanes take the grey of Logic's menu bar (the toolbar
    // beside them too), the time ruler Logic's lighter bar-number band.
    col_tl_bg: "#545454", col_tl_fg: "#dddddd", col_tl_fg2: "#bdbdbd",
    region_lane_bg: "#474747", ts_lane_bg: "#474747", marker_lane_bg: "#474747",
    // The cycle area: Logic's yellow strip in the ruler (REAPER's loop range in the timeline).
    col_tl_bgsel2: "#c09c2e",
    // Region names: white on the region colour; a selected region's pale name bar takes dark text.
    col_mi_label: "#ffffff", col_mi_label_float: "#ffffff", col_mi_label_sel: "#1e1e1e", col_mi_label_float_sel: "#1e1e1e",
    col_tr1_itembgsel: "#1aa331", col_tr2_itembgsel: "#1aa331",
    // Marquee (razor) selection: light, as in Logic.
    areasel_fill: "#d8d8d8", areasel_outline: "#f0f0f0", marquee_outline: "#e6e6e6",
    // Channel strip slots: white names on the blue plug-in and send slots.
    mcp_fx_normal: "#ffffff", mcp_fx_bypassed: "#b9b9b9", mcp_fx_offlined: "#ffb4ac", mcp_sends_normal: "#ffffff", mcp_sends_muted: "#b9b9b9",
    mcp_send_midihw: "#ffffff", mcp_sends_levels: "#4a8ad4", mcp_fxparm_normal: "#e6e6e6", mcp_fxparm_bypassed: "#a0a0a0", mcp_fxparm_offlined: "#ffb4ac",
    // Lists (Library, Loop Browser, Piano Roll lists): Logic's blue selection.
    genlist_selbg: "#276eb8", midieditorlist_selbg: "#276eb8", midieditorlist_selbg2: "#276eb8", col_explorer_sel: "#276eb8",
    toolbararmed_color: "#276eb8",
    // Edit fields (the Piano Roll's readout boxes beside its ruler and lanes): Logic's dark display grey.
    col_main_editbk: "#3c3c3c",
    // Piano Roll: charcoal rows (darker for black keys; darker still outside the region), a light
    // grey keyboard with grey lines between the white keys, grey header.
    midi_trackbg1: "#262626", midi_trackbg2: "#1d1d1d", midi_trackbg_outer1: "#1b1b1b", midi_trackbg_outer2: "#161616",
    midi_selpitch1: "#303030", midi_selpitch2: "#272727", midi_rulerbg: "#545454", midi_rulerfg: "#d7d7d7", midi_leftbg: "#3a3a3a",
    midi_editcurs: "#f0f0f0", midi_pkey1: "#d9d9db", midi_pkey2: "#232323", midi_pkey3: "#676767",
    midi_grid1: "#303030", midi_grid2: "#3d3d3d", midi_grid3: "#353535", midi_endpt: "#727272", midi_notebg: "#4fb441",
    // The CC lane menu ("Velocity") on the dark lane header: a grey pop-up with light text, as Logic's are.
    midi_ccbut: "#5c5c5c", midi_ccbut_text: "#e6e6e6", midi_ccbut_arrow: "#c4c4c4",
  },
  panels: { track: "#575757", master: "#575757", transport: "#a6a6a6" },
  panel: { bg: "#2b2b2b", panel: "#474747", panelAlt: "#575757", border: "#262626", text: "#e6e6e6", textDim: "#c4c4c4", accent: "#3d8af0", accentText: "#ffffff", accent2: "#c09c2e" },

  shortcuts: [
    // Transport
    key([], "Space", 40328, "Play / Stop (the playhead stays where it stopped)"),
    key([], "Return", 40042, "Go to Beginning"),
    key([], "R", 1013, "Record"),
    key(["cmd"], ".", 40668, "Discard Recording and Return to Last Play Position"),
    key([], "C", 1068, "Cycle Mode"),
    key([], "K", 40364, "Metronome Click"),
    key(["shift"], "K", RS("count_in"), "Count-in"),
    key([], ",", 41043, "Rewind one bar"),
    key([], ".", 41042, "Forward one bar"),
    key(["opt"], ",", 40172, "Go to Previous Marker"),
    key(["opt"], ".", 40173, "Go to Next Marker"),
    key(["opt"], "'", 40157, "Create Marker"),
    key(["cmd"], "U", RS("locators"), "Set Locators by Regions and enable Cycle"),
    key(["shift"], "R", 40211, "Capture as Recording (MIDI)"),
    // Windows
    key([], "X", 40078, "Show/Hide Mixer"),
    key([], "P", 40153, "Show Piano Roll"),
    key([], "E", RS("editor"), "Show/Hide Editor"),
    key([], "Y", 40271, "Show/Hide Library (FX browser)"),
    key([], "F", 50124, "Show/Hide Browsers (Media Explorer)"),
    key([], "O", 50124, "Show/Hide Loop Browser (Media Explorer)"),
    key([], "I", RS("inspector"), "Inspector (region or channel strip)"),
    key([], "A", 41151, "Show/Hide Automation"),
    key([], "G", 42323, "Show/Hide Global Tracks (ruler lanes)"),
    key(["opt"], "K", 40605, "Key Commands (action list)"),
    key(["cmd"], "K", 40377, "Musical Typing (virtual keyboard)"),
    key([], "T", RS("tool_menu"), "Show Tool Menu"),
    // Editing
    key(["cmd"], "T", 40012, "Split Regions at Playhead"),
    key(["cmd", "opt"], "T", "_assist_logic_split_locators", "Split Regions at Locators"),
    key(["cmd"], "J", 40362, "Join Regions"),
    key(["cmd"], "R", 41295, "Repeat Regions"),
    key([], "L", 40636, "Loop Regions"),
    key([], "Q", RS("quantize"), "Quantize"),
    key(["ctrl"], "M", 40175, "Mute Regions"),
    key(["shift"], "D", 40289, "Deselect All"),
    key(["opt"], "Up", 40204, "Transpose +1 semitone"),
    key(["opt"], "Down", 40205, "Transpose −1 semitone"),
    key(["ctrl"], "B", 40209, "Bounce Regions in Place"),
    key(["ctrl", "cmd"], "B", 40788, "Bounce Tracks in Place"),
    key(["cmd"], "B", 40015, "Bounce Project"),
    key(["cmd"], "G", 1157, "Snap on/off"),
    // Tracks
    key([], "M", 6, "Mute track"),
    key([], "S", 7, "Solo track"),
    key(["ctrl"], "R", 9, "Track Record Enable"),
    key(["ctrl"], "I", RS("input_monitor"), "Track Input Monitoring"),
    key(["cmd", "opt"], "N", 40001, "New Track"),
    key(["cmd", "opt"], "A", RS("new_audio"), "New Audio Track"),
    key(["cmd", "opt"], "S", RS("new_instrument"), "New Software Instrument Track"),
    key(["cmd"], "D", RS("new_same"), "New Track with Duplicate Settings"),
    key(["cmd", "shift"], "D", 42785, "Create Track Stack"),
    key([], "Up", 40286, "Select Previous Track"),
    key([], "Down", 40285, "Select Next Track"),
    key([], "Left", 40416, "Select Previous Region"),
    key([], "Right", 40417, "Select Next Region"),
    // Zoom and navigation
    key([], "Z", 41622, "Zoom to fit Selection / all"),
    key(["cmd"], "Left", 1011, "Zoom Horizontal Out"),
    key(["cmd"], "Right", 1012, "Zoom Horizontal In"),
    key(["cmd"], "Up", 40112, "Zoom Vertical Out"),
    key(["cmd"], "Down", 40111, "Zoom Vertical In"),
    key(["opt"], "Z", 40848, "Navigation: Back"),
    key(["opt", "shift"], "Z", 40762, "Navigation: Forward"),
    key([], "Wheel", 989, "Scroll vertically"),
    key(["shift"], "Wheel", 988, "Scroll horizontally"),
    key(["opt"], "Wheel", 990, "Zoom horizontally"),
    key(["opt", "cmd"], "Wheel", 1000, "Zoom vertically"),

    // Piano Roll (MIDI editor)
    key([], "Q", 40469, "Quantize selected notes", "midi"),
    key(["cmd", "opt"], "Q", 40402, "Undo Quantization", "midi"),
    key(["opt"], "Up", 40177, "Transpose +1 semitone", "midi"),
    key(["opt"], "Down", 40178, "Transpose −1 semitone", "midi"),
    key(["opt", "shift"], "Up", 40179, "Transpose +1 octave", "midi"),
    key(["opt", "shift"], "Down", 40180, "Transpose −1 octave", "midi"),
    key(["opt"], "Left", 40183, "Nudge left", "midi"),
    key(["opt"], "Right", 40184, "Nudge right", "midi"),
    key([], "Left", 40414, "Select previous note", "midi"),
    key([], "Right", 40413, "Select next note", "midi"),
    key(["ctrl"], "M", 40055, "Mute notes", "midi"),
    key(["cmd"], "G", 1014, "Snap on/off", "midi"),
    key([], "Z", 40725, "Zoom to fit selection", "midi"),
    key(["shift"], "D", 40214, "Deselect All", "midi"),
    key([], "P", 2, "Hide Piano Roll", "midi"),
    key([], "T", RS("tool_menu_midi"), "Show Tool Menu", "midi"),
    key([], "Wheel", 40432, "Scroll vertically", "midi"),
    key(["shift"], "Wheel", 40433, "Scroll horizontally", "midi"),
    key(["opt"], "Wheel", 40431, "Zoom horizontally", "midi"),
    key(["opt", "cmd"], "Wheel", 40430, "Zoom vertically", "midi"),
    // Global keys reach the main window from the docked Piano Roll too.
    ...(["Space", "Return", "R", "C", "K", "X"] as const).map((k) => key([], k, 40401, "Global key (passed to the main window)", "midi")),
  ],

  // The Pointer tool, as Logic's mouse works by default.
  mouse: [
    mm("MM_CTX_ITEM_CLK", [], "3 m", "Click a region: select it (the playhead stays)"),
    mm("MM_CTX_ITEM_CLK", ["shift"], "4 m", "Shift-click a region: add to / remove from the selection"),
    mm("MM_CTX_ITEM", [], "13 m", "Drag a region: move it"),
    mm("MM_CTX_ITEM", ["opt"], "2 m", "Option-drag a region: copy it"),
    mm("MM_CTX_ITEM", ["ctrl"], "4 m", "Control-drag a region: move without snapping"),
    mm("MM_CTX_ITEM", ["cmd"], "62 m", "Command-drag: Marquee (range) selection"),
    mm("MM_CTX_ITEM", ["ctrl", "opt"], "48 m", "Control-Option-drag: zoom to the area"),
    mm("MM_CTX_TRACK", [], "9 m", "Drag on an empty area: rubber-band select regions"),
    mm("MM_CTX_TRACK", ["cmd"], "25 m", "Command-drag: Marquee (range) selection"),
    mm("MM_CTX_TRACK", ["ctrl", "opt"], "22 m", "Control-Option-drag: zoom to the area"),
    mm("MM_CTX_TRACK_CLK", [], "3 m", "Click an empty area: deselect (the playhead stays)"),
    mm("MM_CTX_MIDI_NOTE_CLK", [], "1 m", "Click a note: select it (the playhead stays)"),
    mm("MM_CTX_MIDI_NOTE_CLK", ["shift"], "4 m", "Shift-click a note: toggle its selection"),
    mm("MM_CTX_MIDI_NOTE", [], "1 m", "Drag a note: move it"),
    mm("MM_CTX_MIDI_NOTE", ["opt"], "7 m", "Option-drag a note: copy it"),
    mm("MM_CTX_MIDI_PIANOROLL_CLK", [], "3 m", "Click empty Piano Roll: deselect"),
    mm("MM_CTX_MIDI_PIANOROLL_CLK", ["cmd"], "4 m", "Command-click: Pencil (insert a note)"),
    mm("MM_CTX_MIDI_PIANOROLL", [], "7 m", "Drag on empty Piano Roll: rubber-band select notes"),
    mm("MM_CTX_MIDI_PIANOROLL", ["cmd"], "1 m", "Command-drag: Pencil (draw a note)"),
  ],
  // Slots the tool scripts (T menu, toolbar tools) set.
  toolSlots: [
    { ctx: "MM_CTX_ITEM_CLK", mods: [] }, { ctx: "MM_CTX_ITEM", mods: [] }, { ctx: "MM_CTX_TRACK", mods: [] },
    { ctx: "MM_CTX_MIDI_NOTE_CLK", mods: [] }, { ctx: "MM_CTX_MIDI_NOTE", mods: [] },
    { ctx: "MM_CTX_MIDI_PIANOROLL_CLK", mods: [] }, { ctx: "MM_CTX_MIDI_PIANOROLL", mods: [] },
  ],

  prefs: [
    { key: "locklooptotime", value: 0, does: "Cycle area independent of the marquee (loop points not linked to the time selection)" },
    { key: "itemclickmovecurs", value: 16, bits: 16, does: "Playhead stays at the end of a recording" },
    { key: "viewadvance", value: 3, bits: 1 | 2 | 16, does: "Catch: follow the playhead page by page while playing and recording" },
    { key: "autoxfade", value: 2 | 8 | 256, bits: 1 | 2 | 4 | 8 | 256 | 4096, does: "Drag mode No Overlap; cycle recording stacks takes in lanes for swipe comping (like take folders)" },
    { key: "zoommode", value: 3, does: "Zoom centres on the pointer" },
    { key: "trackselonmouse", value: 1, bits: 1, does: "Clicking in the Tracks area selects the track" },
    { key: "projshowgrid", value: 1, bits: 1 | 256, does: "New projects: Snap on, grid lines shown" },
    { key: "projtimemode", value: 6, does: "New projects: ruler in bar numbers (beats as you zoom in), like Logic's" },
    { key: "transflags", value: 2, bits: 2 | 4, does: "LCD shows the time signature and no play-state text" },
    { key: "itemicons", value: 0, bits: 16511, does: "Regions without REAPER's item buttons and volume knob (Logic shows the name only)" },
    { key: "labelitems2", value: 0, bits: 8, does: "Region names inside the region, on its colour" },
    { key: "defvzoom", value: 2, does: "New projects: tracks at Logic's default height" },
    { key: "trackitemgap", value: 0, does: "Regions fill their track lane, as in Logic" },
    { key: "gridinbg", value: 2, does: "Grid lines behind regions, not across them" },
    { key: "griddot", value: 0, does: "Solid grid lines, as in Logic" },
    { key: "mixrowflags", value: 4, bits: 4, does: "Mixer: the master strip (Logic's Stereo Out) on the right" },
    { key: "toppane", value: 60, does: "A shorter ruler, as Logic's Tracks area has (the toolbar beside it keeps two rows)" },
  ],

  macros: [
    { id: "assist_logic_erase_item", name: "Logic: Erase region under the mouse", actions: [40528, 40006] },
    { id: "assist_logic_split_locators", name: "Logic: Split regions at locators", actions: [40623, 40061] },
  ],

  // Start with the Pointer tool lit (REAPER forgets script toggle states between sessions).
  startup: ["_RS_assist_logic_tool_pointer"],
  scripts: [
    { id: "RS_assist_logic_tool_menu", file: "logic_tool_menu.lua", name: "Logic: Tool menu" },
    { id: "RS_assist_logic_tool_menu_midi", file: "logic_tool_menu.lua", name: "Logic: Tool menu (Piano Roll)", section: "midi" },
    ...TOOLS.map((t) => ({ id: `RS_assist_logic_tool_${t}`, file: `logic_tool_${t}.lua`, name: `Logic: ${TOOL_LABEL[t]}` })),
    ...MIDI_TOOLS.map((t) => ({ id: `RS_assist_logic_tool_${t}_midi`, file: `logic_tool_${t}.lua`, name: `Logic: ${TOOL_LABEL[t]} (Piano Roll)`, section: "midi" as const })),
    { id: "RS_assist_logic_count_in", file: "logic_count_in.lua", name: "Logic: Count-in on/off" },
    { id: "RS_assist_logic_locators", file: "logic_locators.lua", name: "Logic: Set locators by regions and enable cycle" },
    { id: "RS_assist_logic_editor", file: "logic_editor.lua", name: "Logic: Show/hide editor" },
    { id: "RS_assist_logic_inspector", file: "logic_inspector.lua", name: "Logic: Inspector" },
    { id: "RS_assist_logic_quantize", file: "logic_quantize.lua", name: "Logic: Quantize" },
    { id: "RS_assist_logic_input_monitor", file: "logic_input_monitor.lua", name: "Logic: Input monitoring on/off" },
    { id: "RS_assist_logic_new_audio", file: "logic_new_track.lua", name: "Logic: New audio track" },
    { id: "RS_assist_logic_new_instrument", file: "logic_new_track.lua", name: "Logic: New software instrument track" },
    { id: "RS_assist_logic_new_same", file: "logic_new_same.lua", name: "Logic: New track with duplicate settings" },
  ],

  toolbars: [
    {
      // Logic's control-bar view buttons, then the Tracks-area tool and option buttons.
      section: "Main toolbar",
      items: [
        { action: 40271, label: "Library", icon: "assist_logic_library", toggle: true },
        { action: RS("inspector"), label: "Inspector", icon: "assist_logic_inspector" },
        { action: 40078, label: "Mixer", icon: "assist_logic_mixer", toggle: true },
        { action: RS("editor"), label: "Editors", icon: "assist_logic_editors" },
        { action: "-", label: "" },
        ...TOOLS.map((t) => tool(t)),
        { action: "-", label: "" },
        { action: 41151, label: "Automation", icon: "assist_logic_automation", toggle: true },
        { action: 40036, label: "Catch Playhead", icon: "assist_logic_catch", toggle: true },
        { action: 1157, label: "Snap", icon: "assist_logic_snap", toggle: true },
        { action: "-", label: "" },
        { action: 40211, label: "Capture Recording", icon: "assist_logic_capture" },
        { action: RS("count_in"), label: "Count-in", icon: "assist_logic_countin", toggle: true },
        { action: 40364, label: "Metronome", icon: "assist_logic_metronome", toggle: true },
        { action: "-", label: "" },
        { action: 50124, label: "Browsers", icon: "assist_logic_browsers", toggle: true },
      ],
    },
    {
      section: "MIDI piano roll toolbar",
      items: [
        ...MIDI_TOOLS.map((t) => tool(t, true)),
        { action: "-", label: "" },
        { action: 1014, label: "Snap", icon: "assist_logic_snap", toggle: true },
        { action: 40469, label: "Quantize", icon: "assist_logic_quantize" },
        { action: "-", label: "" },
        { action: 40042, label: "Piano Roll", icon: "assist_logic_pianoroll", toggle: true },
        { action: 40056, label: "Event List", icon: "assist_logic_eventlist", toggle: true },
        { action: 40954, label: "Score", icon: "assist_logic_score", toggle: true },
      ],
    },
  ],

  layout: {
    transport: "top",
    tcp: "left",
    tcpWidth: 407,
    browser: [
      { side: "left", width: 280, tabs: ["fxbrowser"] },
      { side: "right", width: 320, tabs: ["explorer"] },
    ],
    mixer: "docked",
    midiEditor: "docked",
    dockHeight: 520,
  },

  glossary: [
    ["Region", "an item (a take inside it)"],
    ["Tracks area", "the arrange view"],
    ["Channel strip / plug-in slots", "the mixer strip and the track's FX chain"],
    ["Cycle area / locators", "the loop range (repeat on), dragged in the ruler"],
    ["Marquee selection", "a razor edit area (⌘-drag)"],
    ["Track Stack", "a folder track"],
    ["Library", "the FX browser (FX chains play the role of patches)"],
    ["Browsers / Loop Browser", "the Media Explorer"],
    ["Take folder / Quick Swipe Comping", "fixed item lanes and comp areas"],
    ["Bounce", "Render (File → Render)"],
    ["Flex Time", "stretch markers"],
    ["Key Commands", "the action list"],
  ],
};
