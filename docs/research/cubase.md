# Cubase → REAPER research notes
These are the notes the Cubase profile was built from, checked against REAPER 7.82. They may be out of date — corrections welcome via PR.

Target: Cubase Pro 13/14, default dark appearance. Output: (a) an original kit (`KitId "cubase"`: our own vector art + WALTER layout), (b) window layout, (c) shortcuts, mouse modifiers, toolbar, preferences and small Lua scripts.

**Confidence labels.** **measured**: the colour was sampled pixel by pixel from screenshots in the Cubase Pro 14 manual on steinberg.help. **manual**: stated in the Cubase Pro 14 operation manual. **verify**: best available knowledge, not confirmed; check it before shipping. Every REAPER action id below was checked against REAPER 7.82's action list. Section 0 is the main window; section 32060 is the MIDI editor.

What matters most for "feels like Cubase":
1. **Numpad transport.** Enter plays, 0 stops, `*` records, `/` toggles cycle, 1/2 jump to the locators.
2. **Number-key tools 1–9.** Alt+X splits, J toggles snap, Q quantizes, P sets the locators to the selection.
3. **Locators are separate from the selection.** Turn REAPER's loop/time-selection link off. A time selection or razor edit is then Cubase's range, and the loop is the locator pair.
4. **A dark grey UI with a blue-slate event display.** Buttons are flat grey with white letters (M S R W e). Lit buttons are solid colour with dark glyphs: yellow Mute, red Solo, red Record, white for the active tool or Stop, violet Cycle.
5. **Window zones.** The mixer and MIDI editor are docked in a lower zone, the Media Explorer sits in a right zone, and the transport bar runs along the bottom.

---

## 1. Look

### 1.1 Kit palette (`KitColors` roles)

| Role (`KitColors`) | Hex | Where it comes from |
|---|---|---|
| `bg` | `#25282b` | Project window, track list and Inspector background (measured, in every screenshot) |
| `panel` | `#2b2f33` | MixConsole background (measured) |
| `track` (track header) | `#25282b` | Track list rows are the same grey as the panel (measured) |
| `trackSel` | `#383c41` | Selected track header. Cubase 13 makes this a subtle lift (forum complaints say it is hard to see) (**verify**) |
| `face` (button face, off) | `#5b5d60` | M/S/R/W/e/monitor buttons when off (measured, 23×17 icons) |
| `line` | `#394047` | Track divider lines in the event display (measured) |
| `deep` | `#1b1d20` | Name fields, drop-downs, ruler, time displays (measured) |
| `text` | `#f2f3f3` | Button letters and names (measured; `#f4f4f4` is also used) |
| `dim` | `#929395` | Secondary labels (measured) |
| `accent` | `#58b9fe` | The "active" blue for insert/EQ/send state buttons and the Inspector volume value bar (`#58bbff`) (measured) |
| `accent2` | `#725be5` | Cycle button when on (measured) |
| `solo` | `#d12f34` | Soloed (measured from the manual's soloed-speaker icon; **verify** on the track/MixConsole S button) |
| `arm` | `#cc3d3d` | Record enable on: track list `#cc3d3d`, Inspector `#d83636` (measured) |
| `play` | `#47c75d` | Start button when lit (**verify**: only the off state appears in the manual) |
| `onInk` | `#121212` | Glyph on any lit button (measured: Mute `#121212`, tool/Stop `#0b0b0b`) |
| `env` [read, touch, write, latch, preview] | `#47c75d`, `#e5ba3b`, `#d83636`, `#e58d36`, `#58b9fe` | R lit green and W lit red (**verify**) |
| `display` | `#1b1d20` | Locator and time display fields (measured) |
| `displayText` | `#f4c78d` | Warm digits in the time and locator displays (measured) |
| *new* `displayText2` | `#8ac7f4` | Cool digits in the same displays. The tempo/signature fields are black with `#d9e5f2` (measured) |
| `knob` | `#58bbff` | Value fill and arc (measured) |
| *new* `mute` | `#e5d639` | Mute when on: a yellow plate with a dark "M" (measured from the track-list screenshot, pixel trace) |
| *new* `monitor` | `#f2973c` | Monitor when on: orange (**verify**; the orange is measured from Freeze/Tempo-track icons) |
| *new* `toolOn` | `#f4f4f4` | Selected tool, Stop (while stopped) and Click on: a white plate with an almost-black glyph (measured) |
| `meter.off` | `#0a0b0c` | Meter background (measured) |
| `meter.low` → `mid` → `high` | `#19d7fe` → `#26ecc6` → `#31fd99` | Default "+3 dB Digital" colour stops, read bottom to top (measured from the Metering-Appearance preferences screenshot) |
| *new* `meter.top` | `#fec419` | Amber band at the top of the scale, about the upper 9 % (measured) |
| `meter.clip` | `#ff0000` | Clip indicator (measured) |
| `notes.off` / `on` | velocity gradient `#3d6fe0` → `#796aed` → `#e53636` | Cubase colours Key Editor notes by velocity by default, blue for soft through red for hard (forum, manual). The violet and red are measured; the low blue is **verify** |
| `notes.bg` | `#25282b` (white-key rows), `#212326` (black-key rows) | Measured from the Key Editor note display |

### 1.2 Project window and editor colours: REAPER theme keys

All of these are `[color theme]` keys that already exist in Default 7 (checked against REAPER's Default 7 theme).

| Cubase element | Hex | REAPER keys |
|---|---|---|
| Event display (lanes and empty area) | `#272f38` (measured) | `col_arrangebg`, `col_tr1_bg`, `col_tr2_bg` (no alternation in Cubase; tr2 may go 2 % darker) |
| Selected track's lane | `#2e3742` (**verify**) | `selcol_tr1_bg`, `selcol_tr2_bg` |
| Track divider lines | `#394047` (measured) | `col_tr1_divline`, `col_tr2_divline` |
| Bar lines / beats / subdivisions | `#626567` measured / `#3a424b` / `#313840` (**verify**) | `col_gridlines`, `col_gridlines2`, `col_gridlines3` |
| Ruler background and numbers | `#1b1d20` / `#a8abad` | `col_tl_bg`, `col_tl_fg`, `col_tl_fg2` (`#717375`), `marker_lane_bg`, `region_lane_bg`, `ts_lane_bg` |
| Locator range in the ruler | `#898b8e` while cycle is off (measured: a grey band between white flags) | `col_tl_bgsel` (loop range); while cycle is on Cubase shows violet (**verify**: REAPER can't change the colour by repeat state) |
| Range selection (razor edit, time selection) | `#58b9fe` fill at about 25 %, outline `#8ac7f4` (**verify**) | `areasel_fill`, `areasel_outline`, plus the time-selection key `col_tl_bgsel2` |
| Project cursor | `#ffffff`, 1 px (**verify**; Cubase lets you set colour and width in Preferences > Transport > Cursor) | `col_cursor`, `col_cursor2`, `playcursor_color` (Cubase has only one cursor, so both are white) |
| Default part/event colour | `#5d80ea`; inner top edge `#7a9bf9`; outer edge `#0e3296`; MIDI dashes `#2b53c4` (measured) | `col_mi_bg`, `col_mi_bg2`; selected: `col_tr1_itembgsel` = `#7a9bf9` |
| Waveform / content | a darker shade of the event colour (for example `#05b26f` on a `#33d697` event) (measured) | `col_tr1_peaks`, `col_tr2_peaks` = `#2b53c4` |
| Event names | `#f2f3f3` | `col_mi_label`, `col_mi_label_sel`; `col_mi_label_float` = `#a8abad` |
| Markers | `#e53679`, line in the event display `#9b3360` (measured) | `marker`; `region` = `#725be5` (cycle markers / arranger) |
| Key Editor | rows `#25282b`/`#212326`, area outside the part `#1b1d20`, ruler `#1b1d20` | `midi_trackbg1/2`, `midi_trackbg_outer1/2`, `midi_rulerbg`, `midi_editcurs` `#ffffff`, `midi_selpitch1/2` `#2e3238` |
| Panels | | `col_tracklistbg` `#25282b`, `col_mixerbg` `#2b2f33`, `col_trans_bg` `#25282b`, `docker_bg` `#25282b` |
| Meters (when no meter image is used) | | `col_vubot` `#19d7fe`, `col_vumid` `#26ecc6`, `col_vutop` `#31fd99`, `col_vuclip` `#ff0000`, `col_vuintcol` `#0a0b0c` |
| Insert-slot text | normal `#f2f3f3`, bypassed `#929395`, offline `#cc3d3d` | `mcp_fx_normal`, `mcp_fx_bypassed`, `mcp_fx_offlined` |

### 1.3 Control style (what the kit art must draw)

- **Shape.** Flat fills, corner radius about 2 px. No gradients, no gloss, no visible outline: buttons sit on the panel with 1–2 px gaps. The existing `look: "flat"` doesn't fit, because it adds a dark hairline and a top highlight.
- **Off buttons.** A `#5b5d60` plate with a `#f2f3f3` glyph. Letters, not icons: **M**, **S**, **R**, **W**, **e** (Edit Channel Settings), **L** (Listen). Monitor is a speaker glyph and Record a filled circle.
- **Lit buttons.** A solid plate in the state colour with a dark glyph (`#121212`). Mute is yellow, Solo red, Record red, Monitor orange, Read green, Write red. The insert/EQ/send state buttons are blue (`#58b9fe`) with a white glyph when active.
- **Name fields and drop-downs.** A dark inset `#1b1d20`, flat, with `#f2f3f3` text.
- **MixConsole fader.** A long, thin dark well (`#1f1f20`) with a flat grey cap (about `#929395`, light-grey grip line). The meter sits right of the fader with a dB scale (Ableton's `k_sc_*` scale-mark images can be reused). Under the fader are small dark boxes with the fader value and the meter peak. Cubase's per-channel-type fader colours (Preferences > User Interface > MixConsole Fader Colors) can be skipped.
- **Pan.** A horizontal value bar in a dark field, not a knob (manual: "Set panorama" sits at the top of the fader section).
- **Inspector-style sliders** fill from the left in blue. REAPER sliders can only draw a thumb on a track image, so use a slim thumb (see §2.6).
- **Meters.** Cyan at the bottom, then aqua, green, an amber top band and a red clip cell, on near-black. The meters are segment-free and smooth.
- **Transport time display.** A dark field with large digits in warm amber (`#f4c78d`) and cool blue (`#8ac7f4`). Tempo and signature sit on black fields with pale `#d9e5f2` digits.
- **Track colour.** Each track header has a solid colour block on its left (about 40 px in Cubase 14, with the white track number at the top left; measured). The Inspector header and MixConsole channel name plates also carry the colour.
- **Fonts.** A plain sans. Track names are about 11 px; button letters about 10 px and heavy; time display digits about 20 px. Cubase has a "Track Name Font Weight" preference (manual). REAPER themes pick fonts by WALTER font index: use 1 for small, 3 for medium and 5 for large, as the existing kits do. Exact sizes: **verify**.

---

## 2. Layout

### 2.1 Window zones → REAPER workspace

Per the manual, the Project window has a Left Zone (Inspector with Track and Editor tabs, plus Visibility), a Project Zone (toolbar, track list, event display, ruler), a Lower Zone (tabs: Chord Pads, Editor, Sampler Control, MixConsole, Drum Machine, MIDI Remote, Modulators), a Right Zone (VSTi, Media, Control Room and Meter racks), a Channel area, and an optional Transport Bar.

| Cubase | REAPER equivalent | How (keys `src/profiles/engine/workspace.ts` already writes) |
|---|---|---|
| Track list on the left of the event display | REAPER's default | Leave `mixerflag` bit 32 **unset** (`tcpRight: false`) |
| Lower Zone: MixConsole and editor tabs | Mixer docked in the bottom docker; MIDI editor docked as a second tab of the same docker | `mixwnd_vis=1`, `mixwnd_dock=1` (docker 0 is at the bottom), `[midiedit] dock=1` → `midiDocked: true`. Cubase can open editors in a window or in the lower zone (manual: Preferences > Editors). The default appears to be the lower zone (**verify**) |
| Right Zone: Media rack (MediaBay), VSTi rack | Media Explorer, with the FX Browser as a second tab, in a right docker | `side: "right"`, `width ≈ 320` (existing plan) |
| Transport Bar along the bottom of the Project window | Transport docked at the bottom of the main window | `transport: "bottom"` → `transport_dock_pos=2` (repo-verified values) |
| Project window toolbar along the top | REAPER main toolbar, docked at the top | Toolbar contents in §3.6 |
| Left Zone: Visibility tab | Track Manager (`40906`) docked at the left | New: a left docker (`dockermodeN=1`) with ident `trackmgr`. The `[REAPERdockpref]` ident name is **verify** |
| Left Zone: Inspector (Track tab) | **No REAPER equivalent.** Show it as an "Inspector" tab in the REAPER Assist side panel (selected track: name, input/output, volume, pan, inserts, sends, through the bridge), or as an optional dockable gfx/ReaImGui script | — |
| Channel zone / Channel Settings ("e") | The FX chain window (`40291`) docked at the left | It does **not** follow track selection (a REAPER limit; see §2.6) |

Suggested `WorkspacePlan` for Cubase: `{ side: "right", width: 320, transport: "bottom", tcpRight: false, midiDocked: true }`, plus the new optional left docker.

### 2.2 Track list (TCP): WALTER

Base sizes at 100 %, on the existing 4 px grid with 20 px rows. `tcp_heights 4 26 52 76` as now. Element names are from the WALTER docs.

```
| colour |[M][S]| name field (dark inset) ............ |[●][spk]|▌meter
| block  |[e][fx]|[RW]| volume ───●── (≤140) [-0.0] pan ─●─      |▌
|  #     | input ▾  (row 3, h ≥ 72)                     [recmode]|▌
```

| Element | Placement (x from left; `w-` = from the right edge) | Notes |
|---|---|---|
| `tcp.custom.kCol` (custom, fill `TRACK_FILL`) | `[0 0 20 h]` | Colour block. With no track colour, use `mixc(face, bg, .5)` |
| `tcp.trackidx` | on the block, row 1, centred | `ON_COLOR` (dark or light text by track brightness), as the FL kit does |
| `tcp.foldercomp` / `tcp.folder` | `folderstate==1` → x 22, row 1, 18×18; shift row 1 right by 20 | |
| `tcp.mute` | x 24, row 1, 22×18 | "M"; lit = `mute` yellow |
| `tcp.solo` | x 48, row 1, 22×18 | "S"; lit = `solo` red |
| `tcp.custom.kName` + `tcp.label` | x 74 to `w-84`, row 1 | Dark inset `#1b1d20`; label margin 6 px; `track_selected` brightens the text (Cubase lightens the header) |
| `tcp.recarm` | `w-80`, row 1, 22×18 | Lit = red plate with a dark circle |
| `tcp.recmon` | `w-56`, row 1, 22×18 | Speaker glyph; on = orange plate; auto = orange speaker on grey |
| `tcp.meter` | `w-10`, full height, 6 px wide | Vertical meter at the right edge (Cubase shows a level meter in the track header). No readout |
| `tcp.fx` ("e") | x 24, row 2 (h ≥ 48), 22×18 | Our "e" glyph; opens REAPER's FX chain, the nearest thing to Channel Settings |
| `tcp.fxbyp` | x 48, row 2, 22×18 | Inserts state: active = blue plate (`accent`), bypassed = dim, empty = face |
| `tcp.env` | x 72, row 2, 30×18 | One button showing **R W** side by side: read lights the R half green, write/latch/touch light the W half red, amber or violet. REAPER has a single automation-mode button, so this is the honest merge of Cubase's separate R and W |
| `tcp.volume` (+ `tcp.volume.label` box 44×18) | x 106, row 2, width `min(w-260, 140)`, thin thumb | Cubase hides volume in the track list by default; we show it only when the row exists |
| `tcp.pan` | `w-64`, row 2, 50×12, `fadermode [-1]` | Horizontal bar, not a knob |
| `tcp.io` | `w-34`, row 2 | Routing |
| `tcp.recinput` + `tcp.recmode` | row 3 (h ≥ 72), x 24 to `w-40` | Input selector, like Cubase's Inspector input |
| `tcp.fxparm` | below row 3 | As existing kits |
| Master (`master.tcp.*`) | Same frame: colour block grey, M/S, name, `master.tcp.mono` in the arm slot, meter at the right | |

### 2.3 MixConsole strip (MCP): WALTER

Cubase order, top to bottom (manual): **racks** first (Routing [input/output], Pre [low/high-cut, gain, phase], Inserts, Equalizer, Strip, Sends, Cue Sends, Direct Routing, Quick Controls, Device Panels), then the **fader section** (pan, mute/solo, listen, edit channel settings, fader, R/W automation, input levels). The name plate with the channel colour sits at the bottom; a colour bar also runs along the top (measured).

REAPER strip: 80 px wide (`mcp.size [80 360 0 260]`), master 96 px.

| y (top down) | REAPER element | Cubase equivalent |
|---|---|---|
| 0, h 6 | `mcp.custom.kColTop` (TRACK_FILL) | Colour bar at the top |
| 8, h 18 | `mcp.recinput` (input) | Routing rack: input |
| 28, h 18 | `mcp.phase` (Ø) · `mcp.io` | Pre rack: phase. **No input-gain knob**; REAPER trim lives in the FX/item |
| 48 to `kE` | `mcp.extmixer.*` with mode `[1]` (the existing `extMixer()`): FX list + send list (+ FX parameters) | Inserts and Sends racks. EQ/Strip: optionally embed ReaEQ/ReaComp UIs (`mcp_fxembed`) — **verify** which stock plug-ins embed |
| next, h 14 | `mcp.pan` (`fadermode [-1]`, horizontal) | Pan |
| next, 2×(36×18) | `mcp.mute`, `mcp.solo` | M / S |
| next, 2×(36×18) | `mcp.fx` ("e"), `mcp.env` (R W) | e / R W |
| next, 2×(36×18) | `mcp.recmon`, `mcp.recarm` | Monitor / Record |
| flexible | `mcp.volume` (well 8 px, cap 30×12) on the left; `mcp.meter` (14 px) on the right; dB scale marks | Fader + meter |
| `h-44`, h 16 | `mcp.volume.label` box · meter readout (`mcp.meter.readout.color`) | Value boxes |
| `h-24`, h 20 | `mcp.custom.kName` (dark `#1b1d20` with a 3 px TRACK_FILL underline) + `mcp.label`; `mcp.trackidx` left in the plate | Channel name + colour |
| Master | Same; `master.mcp.mono`, `master.mcp.menubutton` in place of monitor/arm | |

### 2.4 Transport bar (docked at the bottom, 36 px)

Cubase sections, left to right (manual): Constrain Delay Comp · Record modes · Performance meter · **Locators (L/R)** · Locator range · Punch in/out · **Transport controls** (prev marker, next marker, rewind, forward, **Cycle**, Stop, Start, Record) · Retrospective record · **Time displays** · Markers · Pre/post-roll · **Tempo & Time signature** · Sync · **Click** · Activity meters.

| Order | REAPER element | Notes |
|---|---|---|
| 1 | `trans.automode` | Global automation mode (Cubase keeps it on the toolbar) |
| 2 | `trans.sel` on a `k_display` field, 220 px | REAPER's selection readout shows start/end/length. It acts as the **locator pair**, because §3.5 unlinks the loop from the time selection. **Verify** whether `trans.sel` shows the loop or the time selection once they are unlinked; if it shows the time selection, label it "Range" |
| 3 | `trans.rew` `trans.fwd` `trans.repeat` `trans.stop` `trans.play` `trans.rec` (each 30×24, centred) | `repeat` lit = `accent2` violet; `stop` lit (`transport_stop` has no "on" image) — **verify**; `play` lit green; `rec` lit red |
| 4 | `trans.status` on `k_display`, 180 px, font 5 | Primary time display (two-tone digits are not possible: one colour, `displayText`) |
| 5 | `trans.bpm.tap` · `trans.bpm.edit` · `trans.curtimesig` on black fields | Tempo & signature |
| 6 | `trans.custom.kClick` (custom button, command `40364`, image `k_click`) | Click. **Verify** that transport custom buttons accept a command id and show toggle state; if not, keep Click on the toolbar |
| optional | `trans.custom.kPrevM` (`40172`), `trans.custom.kNextM` (`40173`), `trans.custom.kLoc` (Locators-to-selection script) | Same caveat |

### 2.5 Project toolbar (REAPER main toolbar, top)

See §3.6 for ids. Cubase order: Undo/Redo · MediaBay, Pool, MixConsole · state buttons (all mute off, all solo off, read all, write all) · automation mode · auto-scroll · locators · transport · time display · markers · **tools** · colour · snap, snap type, grid type · quantize · zone toggles.

### 2.6 What REAPER can't do (say so in the UI)

- **No Inspector, and no Channel zone that follows the selected track.** The FX chain window is per track. Workaround: an Assist "Inspector" tab.
- **No built-in channel EQ or Strip, Listen (AFL/PFL), Cue Sends, Quick Controls or Control Room.**
- **R and W are one button** (the automation mode). Lanes, Lock and Freeze have no TCP elements. Custom WALTER buttons with a command id might work for them (**verify** that a TCP custom button acts on its own track).
- **Sliders can't fill with a value colour** (Cubase's blue bars). REAPER draws a thumb on a stretched track image.
- **Transport fields that don't exist in REAPER:** punch-in/out positions, pre/post-roll amounts, record-mode selectors, a secondary time display, two-tone digits.
- **Meter gradient with more than two stops.** The kit's `meter_strip_*` images blend between 2 rows. **Verify** whether REAPER reads a taller strip as a multi-stop gradient. If not, either use 2 stops (`#19d7fe` → `#31fd99`) and drop the amber band, or drop the meter images and use `col_vubot/mid/top` (3 stops).
- **No snap-type, grid-type or quantize-preset drop-downs on the toolbar.** Use buttons that open the snap/grid dialog. Cubase's "Shuffle" snap ≈ REAPER ripple-per-track; "Grid Relative" ≈ `41054` relative grid snap.
- **Toolbox on right-click** (a Cubase default): only partial; see §3.4.
- **One cursor in Cubase, two in REAPER** (edit cursor and play cursor). Colour both white.
- **Cycle-on colour in the ruler:** REAPER can't recolour the loop band by repeat state.

---

## 3. Function

### 3.1 Key commands: main window (section 0)

Cubase defaults are from the Cubase Pro 14 manual's Key Commands category pages (Transport, Edit, Tool, Zoom, Devices, Window Zones, Project, File, Media, Audio, Navigate, Nudge, Automation, Add Track, Marker, Quantize, Set Insert Length). Mods follow `src/profiles/index.ts`: `cmd` = Ctrl on Windows / ⌘ on Mac, `opt` = Alt / ⌥. "S:" means one of our scripts (§3.7). Each key+mods appears only once (checked by script).

| # | Key (Win / Mac) | `mods`, `key` | Cubase command | REAPER action |
|---|---|---|---|---|
| 1 | Space | `[]`,`Space` | Start/Stop | `40044` Transport: Play/stop. With "return to start" **off**: `40328` (move edit cursor on stop) |
| 2 | Num Enter | `[]`,`NumEnter` | Start | `1007` Transport: Play |
| 3 | Num 0 | `[]`,`Num0` | Stop (again = back to start) | `1016` Transport: Stop, or S:`stop` (Cubase double-stop) |
| 4 | Num * | `[]`,`Num*` | Record | `1013` Transport: Record |
| 5 | Num / | `[]`,`Num/` | Cycle | `1068` Transport: Toggle repeat |
| 6 | Num . | `[]`,`Num.` | Go to Project Start | `40042` Go to start of project |
| 7 | Num 1 / Num 2 | `[]`,`Num1` / `Num2` | Go to Left / Right Locator | `40632` Go to start of loop / `40633` Go to end of loop |
| 8 | Num 3 … Num 9 | `[]`,`Num3…9` | To Marker 3–9 | `40163`…`40169` Markers: Go to marker 03–09 |
| 9 | Num + / Num − | `[]`,`Num+` / `Num-` | Forward / Rewind | `40085` Fast forward a little bit / `40084` Rewind a little bit |
| 10 | Ctrl/⌘ Num 1 / Num 2 | `[cmd]`,`Num1` / `Num2` | Set Left/Right Locator to Cursor | `40222` / `40223` Loop points: Set start/end point (**verify**: uses the edit cursor) |
| 11 | P | `[]`,`P` | Locators to Selection | S:`locators_to_selection` (fallback `41039` Loop points: Set loop points to items) |
| 12 | Alt/⌥ P | `[opt]`,`P` | Loop Selection | S:`loop_selection` |
| 13 | Alt/⌥ Space | `[opt]`,`Space` | Play Selection | S:`play_selection` (wraps `43355` Transport: Play (stop at end of selected items…)) |
| 14 | C | `[]`,`C` | Activate Metronome | `40364` Options: Toggle metronome |
| 15 | I / O | `[]`,`I` / `O` | Punch In / Punch Out | S:`punch` (toggles `40076` time-selection auto-punch ↔ `40252` normal) |
| 16 | Shift Space | `[shift]`,`Space` | Tap Tempo | `1134` Transport: Tap tempo |
| 17 | N / B | `[]`,`N` / `B` | Locate Next / Previous Event | `40319` / `40318` Item navigation: Move cursor right/left to edge of item |
| 18 | Shift N / Shift B | `[shift]`,`N` / `B` | Locate Next / Previous Marker | `40173` / `40172` Markers: Go to next/previous marker |
| 19 | Insert | `[]`,`Insert` | Add Position Marker | `40157` Markers: Insert marker at current position (Mac keyboards often lack Insert) |
| 20 | Alt/⌥ X | `[opt]`,`X` | Split At Cursor | `40757` Item: Split items at edit cursor (no change selection). **Verify** what happens with nothing selected; Cubase then splits every event under the cursor |
| 21 | Shift X | `[shift]`,`X` | Split Range | `40061` Item: Split items at time selection or razor edit |
| 22 | X | `[]`,`X` | Crossfade | `41059` Item: Crossfade any overlapping items |
| 23 | Ctrl/⌘ D | `[cmd]`,`D` | Duplicate | `41295` Item: Duplicate items |
| 24 | Ctrl/⌘ K | `[cmd]`,`K` | Repeat… | S:`repeat` |
| 25 | M / S / R | `[]`,`M` / `S` / `R` | Mute / Solo / Record Enable (selected tracks) | `6` / `7` / `9` Track: Toggle mute/solo/record arm for selected tracks |
| 26 | W | `[]`,`W` | Write (automation) | S:`automation` write-toggle (sets `40403` ↔ `40401`) |
| 27 | Shift M / Shift U / Alt/⌥ M | `[shift]`,`M` / `[shift]`,`U` / `[opt]`,`M` | Mute Events / Unmute Events / Mute-Unmute Objects | `40719` / `40720` / `40175` Item properties: Mute / Unmute / Toggle mute |
| 28 | J | `[]`,`J` | Snap On/Off | `1157` Options: Toggle snapping |
| 29 | Q | `[]`,`Q` | Quantize | S:`quantize` (fallback `40316` Item: Quantize item positions to grid…) |
| 30 | Ctrl/⌘ E · Return | `[cmd]`,`E` · `[]`,`Return` | Open (editor) · Open/Close Editor | `40153` Item: Open in built-in MIDI editor (closing is in §3.2) |
| 31 | Ctrl/⌘ Shift X | `[cmd,shift]`,`X` | Cut Time | S:`cut_time` |
| 32 | Shift Backspace | `[shift]`,`Backspace` | Delete Time | `40201` Time selection: Remove contents of time selection (moving later items) |
| 33 | Ctrl/⌘ Shift E | `[cmd,shift]`,`E` | Insert Silence | `40200` Time selection: Insert empty space at time selection |
| 34 | Ctrl/⌘ G / Ctrl/⌘ U | `[cmd]`,`G` / `U` | Group / Ungroup | `40032` / `40033` Item grouping: Group / Remove items from group |
| 35 | Ctrl/⌘ Shift L / U | `[cmd,shift]`,`L` / `U` | Lock / Unlock | `40688` / `40689` Item properties: Lock / Unlock |
| 36 | Ctrl/⌘ L | `[cmd]`,`L` | Move Event Start to Cursor | `41205` Item edit: Move position of item to edit cursor |
| 37 | Ctrl/⌘ Shift A | `[cmd,shift]`,`A` | Select None | `40769` Unselect all tracks/items/envelope points |
| 38 | E / D | `[]`,`E` / `D` | Left / Right Selection Side to Cursor | `40625` / `40626` Time selection: Set start / end point |
| 39 | F | `[]`,`F` | Auto-Scroll On/Off | `40036` View: Toggle auto-view-scroll during playback |
| 40 | Alt/⌥ C | `[opt]`,`C` | Stationary Cursor | `41817` View: Continuous scrolling during playback |
| 41 | H / G | `[]`,`H` / `G` | Zoom In / Zoom Out | `1012` / `1011` View: Zoom in/out horizontal |
| 42 | Shift H / Shift G | `[shift]`,`H` / `G` | Zoom In / Out Vertically | `40111` / `40112` View: Zoom in/out vertical |
| 43 | Shift F | `[shift]`,`F` | Zoom Full | `40295` View: Zoom out project |
| 44 | Alt/⌥ S | `[opt]`,`S` | Zoom to Selection | `40031` View: Zoom time selection |
| 45 | Z | `[]`,`Z` | Zoom Tracks Exclusive | `40723` View: Expand selected track height, minimize others |
| 46 | F3 | `[]`,`F3` | MixConsole | `40078` View: Toggle mixer visible |
| 47 | Alt/⌥ F3 | `[opt]`,`F3` | MixConsole in Project Window | `40083` Mixer: Toggle docking in docker |
| 48 | F5 | `[]`,`F5` | Open MediaBay | `50124` Media explorer: Show/hide |
| 49 | T | `[]`,`T` | Add Track | `40001` Track: Insert new track |
| 50 | 1 … 9 | `[]`,`1…9` | Tools: Object Sel., Range, Split, Glue, Erase, Zoom, Mute, Draw, Play | S:`tool_1` … S:`tool_9` (§3.4) |

**Extended set** (also Cubase defaults; ship them too, since none collide):

| Key | `mods`,`key` | Cubase | REAPER |
|---|---|---|---|
| Ctrl/⌘ Num − / + | `[cmd]`,`Num-`/`Num+` | Nudge Cursor Left/Right | `40646` / `40647` View: Move cursor left/right to grid division |
| Shift 1 … Shift 9 | `[shift]`,`1…9` | To Marker 1–9 | `40161`…`40169` |
| L | `[]`,`L` | Locate Selection Start | `41173` Item navigation: Move cursor to start of items (partial: items only) |
| Ctrl/⌘ Alt/⌥ I | `[cmd,opt]`,`I` | Invert Selection | `41115` Item: Invert selection |
| Alt/⌥ F2 | `[opt]`,`F2` | Rename First Selected Track | `40696` Track: Rename last touched track |
| K | `[]`,`K` | Group Editing On/Off | `1156` Options: Toggle item grouping and track media/razor edit grouping |
| Alt/⌥ R / Alt/⌥ W | `[opt]`,`R` / `W` | Read / Write automation for all tracks | S:`automation` (global override `40879` / `40882` ↔ `40876`) |
| Ctrl/⌘ Z / Ctrl/⌘ Shift Z | `[cmd]`,`Z` / `[cmd,shift]`,`Z` | Undo / Redo | `40029` / `40030` |
| Shift E | `[shift]`,`E` | Zoom to Event | `41622` View: Toggle zoom to selected items |
| Ctrl/⌘ ↓ / ↑ | `[cmd]`,`Down` / `Up` | Zoom In / Out Tracks | `41325` / `41326` View: Increase / Decrease selected track heights |
| F4 | `[]`,`F4` | Audio Connections | `40251` View: Show routing matrix window (partial) |
| F6 | `[]`,`F6` | Automation Panel | `40292` Track: View envelopes for current/last touched track |
| F8 | `[]`,`F8` | Video Player | `50125` Video: Show/hide video window |
| F11 | `[]`,`F11` | VST Instruments | `40701` Insert virtual instrument on new track… |
| F12 | `[]`,`F12` | Audio Performance Monitor | `40240` View: Show performance meter window |
| Alt/⌥ K | `[opt]`,`K` | On-Screen Keyboard | `40377` View: Show virtual MIDI keyboard |
| Ctrl/⌘ M | `[cmd]`,`M` | Open Markers | `40326` View: Show region/marker manager window (on macOS ⌘M may minimise: **verify**) |
| Ctrl/⌘ P | `[cmd]`,`P` | Open Pool | `41157` View: Show project bay window |
| Ctrl/⌘ T | `[cmd]`,`T` | Open Tempo Track | `41046` Toggle show master tempo envelope |
| Shift Delete | `[shift]`,`Delete` | Remove Selected Tracks | `40005` Track: Remove tracks |
| Shift S | `[shift]`,`S` | Project Setup | `40021` File: Project settings… |
| Alt/⌥ I · Ctrl/⌘ Alt/⌥ L | `[opt]`,`I` · `[cmd,opt]`,`L` | Show/Hide Left Zone | S:`zone` left |
| Ctrl/⌘ Alt/⌥ E | `[cmd,opt]`,`E` | Show/Hide Lower Zone | S:`zone` lower |
| Ctrl/⌘ Alt/⌥ R | `[cmd,opt]`,`R` | Show/Hide Right Zone | `50124` (the Media Explorer is the right zone) |
| Ctrl/⌘ Alt/⌥ T | `[cmd,opt]`,`T` | Show/Hide Transport Zone | `40259` View: Toggle transport visible |
| Ctrl/⌘ Alt/⌥ S | `[cmd,opt]`,`S` | Save New Version | `41895` File: Save new version of project |
| F9 / F10 | `[]`,`F9` / `F10` | Previous / Next Tool | S:`tool_prev` / S:`tool_next` |

**No REAPER equivalent:**
- Combine Selection Tools (Alt/⌥ Shift 1), Drumstick tool (0), Move Events to Front (U).
- Adjust Fades to Range (A): partial with `40509`/`40510`.
- Auto-Grid (Shift Q), Show/Hide Controller Lanes (Alt/⌥ L), Info Line (Ctrl/⌘ I; nearest is `40009` item properties), Overview (Alt/⌥ O).
- Stop leaving the cursor, then a second Stop returning to start (needs S:`stop`).

**`keyCode()` additions needed in `src/profiles/index.ts`** (Windows virtual-key codes, as REAPER stores them):
- `Num0`–`Num9` = 96–105, `Num+` = 107, `Num-` = 109, `Num.` = 110 (Cubase also accepts Num , and Num ;)
- `Insert` = 45, `Delete` = 46, `Backspace` = 8, `Left/Up/Right/Down` = 37/38/39/40, `.` = 190, `,` = 188
- **`NumEnter` must be verified**: it is not plain 13. Bind it once in REAPER's shortcut dialog and read the code from `reaper-kb.ini` (believed to be `32781` = 0x8000|13)
- Mac laptops have no numpad: keep Space and the letter keys as the primary transport there

### 3.2 Key commands: MIDI editor (section 32060)

In Cubase, Up/Down move selected notes a semitone in the Key Editor and Shift+Up/Down an octave (manual, Navigate category). Alt+1…8 set the insert length (Set Insert Length category).

| Key | `mods`,`key` | Cubase | REAPER (section 32060) |
|---|---|---|---|
| Q | `[]`,`Q` | Quantize | `40469` Quantize notes position to grid |
| ↑ / ↓ | `[]`,`Up`/`Down` | Transpose ±1 semitone | `40177` / `40178` Edit: Move notes up/down one semitone |
| Shift ↑ / ↓ | `[shift]`,`Up`/`Down` | ±1 octave | `40179` / `40180` |
| Ctrl/⌘ ← / → | `[cmd]`,`Left`/`Right` | Nudge Left/Right | `40183` / `40184` Edit: Move notes left/right one grid unit |
| Alt/⌥ → | `[opt]`,`Right` | Nudge End Right | `40446` Edit: Lengthen notes one grid unit |
| Alt/⌥ Shift ← | `[opt,shift]`,`Left` | Nudge End Left | `40447` Edit: Shorten notes one grid unit |
| Alt/⌥ 1 … 8 | `[opt]`,`1…8` | Insert length 1/1 … 1/128 | `41081` (1), `41079` (1/2), `41076` (1/4), `41073` (1/8), `41070` (1/16), `41067` (1/32), `41064` (1/64), `41062` (1/128) Set length for next inserted note |
| Alt/⌥ . / Alt/⌥ , | `[opt]`,`.` / `,` | Toggle Dotted / Triplet | `41712` / `41713` Set length for next inserted note: dotted / triplet preserving division length |
| J | `[]`,`J` | Snap On/Off | `1014` View: Toggle snap to grid |
| Ctrl/⌘ D | `[cmd]`,`D` | Duplicate | `40882` Edit: Duplicate events |
| Alt/⌥ X | `[opt]`,`X` | Split at cursor | `40046` Edit: Split notes (**verify**: splits at the edit cursor) |
| Shift M / Shift U / Alt/⌥ M | `[shift]`,`M` / `[shift]`,`U` / `[opt]`,`M` | Mute / Unmute / Toggle | `40057` / `40058` / `40055` |
| Ctrl/⌘ Shift A | `[cmd,shift]`,`A` | Select None | `40214` Edit: Unselect all |
| Return | `[]`,`Return` | Open/Close Editor | `2` File: Close window |
| Space · Num Enter · Num 0 · Num / | `[]` | Start/Stop · Start · Stop · Cycle | `40016` · `1140` · `1142` · `1139` |
| Num * · F3 | `[]`,`Num*` · `F3` | Record · MixConsole | `40401` Misc: Pass through key to main window |
| 1 / 3 / 5 / 7 / 8 | `[]` | Select / Split / Erase / Mute / Draw tools | S:`midi_tool_N` (registered in section 32060) |

No REAPER equivalent: Show/Hide Controller Lanes (Alt/⌥ L), Legato, Drumstick tool.

### 3.3 Mouse conventions (Cubase defaults)

From the manual and forums:
- Object-tool drag moves; **Alt-drag copies**; Ctrl-drag constrains the direction; Alt+Shift-drag makes a shared copy (reports conflict).
- **Alt-click with the Object tool splits** (forum).
- Right-click in the event display opens the **toolbox** ("Show Toolbox on Right-Click"; a modifier+right-click gives the context menu) (manual).
- A drag on empty space with the Object tool rubber-band selects.
- Clicking empty space moves the cursor ("Locate when Clicked in Empty Space") (manual).
- Clicking the locator range in the upper ruler toggles cycle (manual).
- Event handles: fade-in/out handles at the top corners and a volume handle at the top middle. REAPER has the same handles natively.

### 3.4 Tools 1–9 via mouse-modifier swapping

**Mechanism.** One Lua script per tool (or one script that reads its number from its filename). It calls `reaper.SetMouseModifier(context, flag, action)`; per the REAPER API docs this accepts unlocalized names such as `"Media item left drag"` and behaviour text such as `"Move item"`, or a command id with `" c"`.

What each tool script does:
- On first run, snapshot every context it touches with `GetMouseModifier` for flags 0–15, saved to `ExtState`/file, so **Restore REAPER** can write them back.
- Set the active tool's command toggle on and the others off (`SetToggleCommandState` + `RefreshToolbar2`). Toolbar tool buttons then light like Cubase's white "active tool" plate.
- Show a 1-second tooltip with the tool name. Cubase has "Show Notification when Switching Tool Mode with Key Command" (manual).

**Alternative to verify.** REAPER 7's arrange-view **override mouse-modifier sets A–D** (actions `42615`–`42634`, e.g. `42616` "Toggle arrange view override mouse modifiers A") can hold 4 tools without scripts. Their preference storage is unknown: **verify**.

Context names below are the Mouse Modifiers preferences labels, all **verify**: `Media item left drag` (MM_CTX_ITEM), `Media item left click` (MM_CTX_ITEM_CLK), `Track left drag` and `Track left click` (empty lane), `Envelope segment left drag`, `MIDI piano roll left drag/click`, `MIDI note left drag/click`. Flags: 0 none, 1 shift, 2 ctrl/⌘, 4 alt/⌥.

| Tool | Cubase behaviour | REAPER mapping (behaviour names: **verify**) |
|---|---|---|
| 1 Object Selection | Select, move, resize; Alt-drag copies; Alt-click splits | **Base preset**: item drag = "Move item"; ⌥ drag = "Copy item"; ⌘ drag = constrained move ("…vertically/horizontally only" entries if present); item click ⌥ = `40746 c` (split under mouse); empty-lane drag = "Marquee select items" |
| 2 Range Selection | Draws a range across tracks | Empty-lane drag and item drag = "Add to razor edit area" (razor edits, 6.24+); ⇧ = extend |
| 3 Split | Click splits at the mouse (snapped); Alt-click splits repeatedly | Item click = `40746 c` Split item under mouse cursor (ignore grouping, no change selection) (snaps when snap is on: **verify**); ⌥ click: optional script |
| 4 Glue | Click joins the event with the next one | Item click = S:`glue_under_mouse` |
| 5 Erase | Click deletes the event | Item click = custom action `40528`+`40006` (select item under mouse → remove items) |
| 6 Zoom | Drag a box to zoom; click zooms in; Alt-click zooms out | Empty-lane drag and item drag = "Marquee zoom" (the theme has `marqueezoom_*` colours); click = custom action `40513`+`1012`; ⌥ click = `1011` |
| 7 Mute | Click toggles the event's mute | Item click = custom action `40528`+`40175` |
| 8 Draw | Draws parts/events; draws automation | Empty-lane drag = "Draw empty MIDI item"; envelope segment drag = freehand draw (**verify** names) |
| 9 Play | Click plays from that point | Item click and empty-lane click = S:`play_tool` (`40514` move edit cursor to mouse, no snap → `1007`; click again stops) |

MIDI editor tools (S:`midi_tool_N`, section 32060):
- **1** sets piano-roll drag to marquee select.
- **8** sets "insert note, drag to extend" (REAPER's default draw behaviour).
- **5** sets note click to delete note.
- **3** sets note click to split at mouse (`40052` Edit: Split notes at mouse cursor).
- **7** sets note click to `40055` (toggle mute).

**Toolbox on right-click.** Add the nine tool actions at the top of REAPER's arrange/item right-click menus (reaper-menu.ini context-menu sections; names **verify**). Or open toolbar 2 at the mouse with `41112` "Toolbar: Open toolbar 2 at mouse cursor", put on toolbar 2 and bound to a free key.

**Custom actions** (macros) are `ACT` lines in `reaper-kb.ini` (format **verify**). Register scripts through the bridge with `reaper.AddRemoveReaScript(true, section, path, true)` and keep the returned command ids.

### 3.5 Preferences

The only reaper.ini keys known for sure are the ones the repo already writes (dockers, transport, mixer, `[midiedit] dock`, `vumaxvol/vuminvol`). Everything else is safer set **live through the bridge**, by checking `GetToggleCommandState(id)` and running the action when needed.

| Setting | Cubase | REAPER | Action / key (confidence) |
|---|---|---|---|
| Locators separate from the selection | Locators move only with P or the ruler | Turn off "loop points linked to time selection" | `40750` Options: Unset loop points linked to time selection (state `40621`). High confidence that this is right for Cubase |
| Return to start on Stop | Option in the Transport menu (since 14) and in Preferences > Transport. Factory default **verify** | REAPER returns to the edit cursor by default | Profile toggle: on → Space `40044`, Num0 `1016`; off → Space `40328`, Num0 S:`stop` |
| Cycle toggle | Num /; click the upper ruler on the locator range | Repeat | `1068`. Ruler-click toggle: needs a "Ruler left click" mouse modifier (**verify** it exists) |
| Snap | On, type "Grid"; grid type adapts to zoom | Snap on, grid lines on, grid spacing minimum about 15 px in the snap/grid dialog | `1157` (on), `40145` grid lines, `40071` dialog. "Grid Relative" ≈ `41054` |
| Auto-scroll | On (**verify**); Stationary Cursor off | auto-view-scroll on | `40036` on, `41817` off, `40262` auto-scroll while recording on |
| Metronome / click | Off by default; count-in separate | Metronome off; count-in lives in the metronome settings | `40364` (off), `40363` settings dialog (count-in **verify**) |
| Audio record, linear | "Keep History" (other modes: Cycle History + Replace, Replace) (manual) | New recording adds lanes | `43152` Options: New recording adds lanes (new lanes play exclusively) |
| Audio cycle record | Takes stacked on lanes, last take plays | Same | `43152` (above) and `40114` Loop recording always adds takes (on) |
| MIDI record, linear | New Parts / Merge / Replace (manual); default **verify** | Per-track record mode: input (= New Parts), MIDI overdub (= Merge), MIDI replace | `40496`, `40503`, `40504` (selected tracks) |
| MIDI cycle record | Mix / Overwrite / Keep Last / **Stacked** / Mix-Stacked (manual) | Overdub + loop | Mix ≈ `40503`. Stacked ≈ `43152` + loop recording |
| Record enable follows selection | "Enable Record on Selected Audio/MIDI Track" (manual; default on: **verify**) | Automatic record-arm when selected, per track | `40737` on selected tracks; the bridge applies it to new tracks |
| Monitoring | Monitor button, manual | Audio: auto/tape; MIDI/instrument: on | `40494` audio, `40493` MIDI |
| Overlapping events | The front event covers the back one | Trim behind (closest; it actually trims) | `41120` Enable trim content behind media items |
| Auto-crossfade | Off; X crossfades on request (**verify**) | Off | `41119` Disable auto-crossfades |
| Editor opens in the lower zone | Preference "Double-click opens Editor in a Window/in Lower Zone" (manual) | MIDI editor docked | `[midiedit] dock=1` (repo) |
| Meter scale | "+3 dB Digital" scale for channel meters (manual) | `vumaxvol` +6 … `vuminvol` −60 | reaper.ini (repo-known keys). Exact Cubase range **verify** |
| New tracks | Track's default colour per track type | Leave REAPER's default | — |

### 3.6 Toolbar (REAPER main toolbar, in Cubase order)

| Button | Action |
|---|---|
| Undo · Redo | `40029` · `40030` |
| MediaBay · Pool · MixConsole | `50124` · `41157` · `40078` |
| Deactivate all mutes · all solos | `40339` Track: Unmute all tracks · `40340` Track: Unsolo all tracks |
| Read all · Write all · Suspend | `40879` · `40882` · `40876` (global automation override) |
| Auto-scroll · Stationary cursor | `40036` · `41817` |
| Locators to selection | S:`locators_to_selection` |
| Prev marker · Next marker · Rewind · Forward · Cycle · Stop · Start · Record | `40172` · `40173` · `40084` · `40085` · `1068` · `1016` · `1007` · `1013` |
| Tools 1–9 | S:`tool_1`…`tool_9` (toggle state, white plate when active) |
| Colour | `40709` Set track or item color (depending on focus)… |
| Snap · Grid settings | `1157` · `40071` |
| Quantize | S:`quantize` |
| Metronome | `40364` |
| Left zone · Lower zone · Right zone | S:`zone` left · S:`zone` lower · `50124` |

Kit art: draw our own toolbar glyphs for the nine tools (arrow, bracketed range, blade, tube/bond, eraser block, magnifier, crossed speaker, pencil, play-speaker). They are original simple shapes, not Steinberg's icons. Toolbar icons for scripts are set per button in reaper-menu.ini. Whether a theme folder can supply `toolbar_icons` is **verify**.

### 3.7 Lua scripts (small; `assist_cubase_*.lua`)

Every script wraps its work in `Undo_BeginBlock`/`Undo_EndBlock` and `PreventUIRefresh`.

1. **`tool_N` / `tool_prev` / `tool_next`.** See §3.4. Keeps the current tool in `ExtState("assist_cubase","tool")`.
2. **`locators_to_selection`.**
   - Loop = the span of all razor-edit areas (`GetSetMediaTrackInfo_String(tr,"P_RAZOREDITS")`).
   - Else the time selection (`GetSet_LoopTimeRange2(0,false,false,…)`), if it isn't empty.
   - Else from the earliest selected item start to the latest selected item end.
   - Else do nothing.
   - Then set the loop with `GetSet_LoopTimeRange2(0,true,true,s,e,false)`.
3. **`loop_selection`.** Run (2). If `GetToggleCommandState(1068)==0`, run `1068`. Then `SetEditCurPos(loopStart)` and `1007`.
4. **`play_selection`.**
   - If items are selected: move the cursor to the earliest item start and run `43355`.
   - Else, with a time selection: move to its start, play, and `defer` until `GetPlayPosition() ≥ end`, then `1016`.
5. **`stop`** (Cubase double-stop).
   - If playing or recording: `p=GetPlayPosition()`, store `start=GetCursorPosition()`, run `1016`, then `SetEditCurPos(p,true,false)`.
   - If stopped: `SetEditCurPos(start)`.
6. **`repeat`.** `GetUserInputs("Repeat", 2, "Count,Shared copies (y/n)", "1,n")`, then run `41295` count times. For shared copies of MIDI, pooled duplicates need the "pooled MIDI" duplicate option: **verify**.
7. **`quantize`.**
   - For each selected item, if the take is MIDI: move every note start (keeping its length) to `SnapToGrid(0, MIDI_GetProjTimeFromPPQPos(take, ppq))`, then `MIDI_Sort`. Selected notes only, if any notes are selected.
   - If the take is audio: move the item position to `SnapToGrid`.
   - Nothing selected: show a tooltip.
8. **`cut_time`.** Needs a time selection; if there is none, take one from the razor edits. Run `41383` (smart copy within time selection), then `40201` (remove contents, moving later items).
9. **`punch`.**
   - **I**: toggle between `40076` and `40252`.
   - **O**: if punch is on, the out point is the time selection end. Show a tooltip that REAPER punches over the time selection.
10. **`automation`.**
    - Track W: if every selected track is in write mode, run `40401` (read); else run `40403`.
    - Alt+R / Alt+W: toggle the global override `40879`/`40882` against `40876`.
11. **`zone`.**
    - left: toggle the Track Manager (`40906`) in the left docker, and ask Assist to toggle its Inspector tab.
    - lower: toggle `40078`. If the MIDI editor is open, close it with the MIDI-editor `2` (via `MIDIEditor_LastFocused_OnCommand`).
12. **`glue_under_mouse`.** `40528` selects the item under the mouse. Add the next item on the same track whose start ≤ the clicked item's end plus 1 grid step. Then `40362` (glue items, ignoring time selection).
13. **`play_tool`.** If playing: `1016`. Else: `40514`, then `1007`.
14. **`midi_tool_N`.** `SetMouseModifier` for the MIDI contexts in §3.4, with the same snapshot and restore.
15. **Restore REAPER.** Write back the mouse-modifier snapshot. Unregister the scripts. Remove the `ACT` lines. Re-link the loop to the time selection if it was linked before.

---

## 4. New kit features Cubase needs (`kits.ts`, `art.ts`, `walter.ts`)

1. **`KitId` gains `"cubase"`**, plus `SIZES.cubase`. Suggested sizes:
   - TCP buttons 22×18, `tcpSmall` 22×18, `tcpFx` 22×18, `tcpThumb` 8×12
   - `mcpMute` 36×18, `mcpBtn` 36×18, `mcpArm` 36×18, `mcpSmall` 22×18
   - `mcpThumb` 30×12, `mcpFaderW` 8
   - `trans` 30×24, `toolbar` 30
   - MCP width 80, master 96
2. **A new `look: "matte"`.** A flat fill, radius 2, no outline, no top highlight. Hover lightens the face by 7 %; pressed darkens it by 10 %. Lit = a solid state colour with an `onInk` glyph.
3. **New colour roles:** `mute`, `monitor`, `toolOn`, `displayText2`, `meter.top`. Also an optional `field` (= `deep`) for name and display insets.
4. **Letter glyph buttons.** A `glyphs: "letters" | "icons"` switch: M, S, e, R/W, plus our own speaker, circle and phase glyphs. The Ableton kit already draws "S" with `I.text`, so the mute/env paths need the same option.
5. **Split R|W art for `track_env_*` / `mcp_env_*`.** Draw "R W" in one 30×18 image; light the R half for read and the W half for write/touch/latch (coloured by mode).
6. **Inserts-state art** for `track_fxon_*`/`fxoff`/`fxempty`: a blue lit plate when FX are active.
7. **Meter gradient with more than two stops.** First verify whether REAPER reads a taller `meter_strip_v` (more rows) as a gradient. If not, draw a 2-stop strip plus the amber band in `meter_clip_*`, or drop the strip images and rely on `col_vubot/mid/top`.
8. **Velocity-hue note colormap.** `notes.velocity: RGB[]` stops: soft blue → violet → red across columns 12–139, instead of fading towards `bg`. Selected notes are drawn lighter (+25 %) with a white edge (**verify** Cubase's selected-note look).
9. **TCP colour block** (custom element + `trackidx` on it) and **MCP top bar / colour underline** on the name plate. Cubase shows the colour in both places.
10. **Two-tone event rendering is REAPER's own.** Items are drawn by REAPER, so the light top edge and dark outline can't come from the kit. The kit only sets `col_mi_bg` etc. (theme keys in §1.2).
11. **Transport custom buttons** (Click, prev/next marker, Locators-to-selection): images `k_click`, `k_prevm`, `k_nextm`, `k_loc`, if WALTER custom buttons work in the transport (verify).
12. **`kitFor("cubase")`** maps `SkinUi` to these fixed values, as `kitFor("ableton")` does. The `skins.ts` `kit` union and `skinFromWorkflow()` need `"cubase"`.

Update the `src/profiles/index.ts` Cubase profile:
- `reaper` colours: per §1.2.
- `panels`: `{ track: "#25282b", master: "#2b2f33", transport: "#25282b" }`.
- `panel`: `{ bg:"#25282b", panel:"#2b2f33", panelAlt:"#34383c", border:"#1b1d20", text:"#f2f3f3", textDim:"#929395", accent:"#58b9fe", accentText:"#0b0b0b", accent2:"#725be5" }`.
- `blurb`: "Grey panels, slate event display, yellow M / red S; numpad transport, tools on 1–9, Alt+X split, P locators, F3 MixConsole."
- **Fix in the current profile:** `Q` → `40316` only moves item positions. Cubase Q quantizes MIDI notes, so use S:`quantize`.

---

## 5. Glossary additions (Cubase → REAPER)

| Cubase | REAPER |
|---|---|
| Part / Event / Clip | item (MIDI part = MIDI item; audio event = audio item) |
| Key Editor / Drum Editor | the MIDI editor (piano roll / named-notes drum view) |
| Locators (left/right), locator range | loop start/end. With our setting the loop is separate from the time selection |
| Range Selection tool | razor edit (or a time selection) |
| Object Selection tool | normal mouse editing |
| Project cursor | edit cursor (REAPER also shows a play cursor while playing) |
| Inspector | Assist's Inspector tab; REAPER itself has none |
| Visibility tab | Track Manager |
| Lower Zone / Right Zone | the bottom docker / the right docker |
| Channel Settings ("e") | the track's FX chain (+ routing button) |
| MixConsole channel racks: Inserts / Sends | FX inserts / sends in the mixer's extended area |
| Pre rack: phase / gain | the Ø button / item or track trim (no input-gain knob) |
| Audio Connections | routing matrix plus Preferences › Audio › Device |
| MediaBay / Pool | Media Explorer / Project Bay |
| Track Versions / Lanes / Comp tool | takes and fixed item lanes with comp areas |
| Tempo Track / Signature Track | the master tempo envelope / time-signature markers |
| Arranger Track | regions (and the region playlist) |
| Marker track / Cycle markers | markers / regions |
| Snap types: Grid, Grid Relative, Events, Shuffle | snap to grid, relative grid snap, snap to item edges, ripple editing per track |
| Quantize presets | the grid division plus the Quantize dialog |
| Hitpoints / AudioWarp | transients / stretch markers |
| Freeze / Render in Place | Freeze / Apply track FX or render stem |
| Export → Audio Mixdown | File → Render |
| Direct Offline Processing | take FX / apply FX to items |
| Instrument track / Sampler track | a track with a VSTi / with ReaSamplOmatic5000 |
| MIDI Insert / Logical Editor | JSFX MIDI effects / actions and scripts (no direct twin) |
| Group channel / FX channel / VCA | bus track (or folder) / bus with sends / VCA group |
| Quick Controls / Remote | FX parameters in the TCP, MIDI learn / control surfaces |
| Control Room, Listen | no direct twin (monitoring FX, hardware outputs) |

---

## 6. Do not copy

- No Steinberg/Cubase logos or wordmarks, and no product names in artwork or theme file names. The profile may *say* "Coming from Cubase".
- No icon art traced or copied pixel for pixel. All glyphs (letters, speaker, circle, tools) are drawn from simple shapes in `icons.ts`. Colours were sampled only for palette values; no images were saved.
- No bundled content: no Cubase presets, track/MediaBay content, key-command XML or colour-preset files.
- Don't replicate the overall trade dress beyond the palette and general layout conventions (zones, button letters, numpad transport). These are common DAW conventions.

---

## 7. Sources

- Cubase Pro 14 manual, Key Commands categories (all checked), e.g. Transport: <https://www.steinberg.help/r/cubase-pro/14.0/en/cubase_nuendo/topics/key_commands/key_commands_transport_category_c.html>. Also Edit, Tool, Zoom, Devices, Editors, Window Zones, File, Navigate, Nudge, Project, Media, Audio, Automation, Add Track, Marker, Quantize and Set Insert Length (`key_commands_*_category_c.html` under the same path)
- Manual topics, reached through the site's topic content API, `https://www.steinberg.help/api/khub/maps/9_A2jNxlDJdZgViRgyezjA/topics/<id>/content`:
  - Track Controls (e9MHxpL_JtTuVbSFDrisbQ)
  - Audio-track Inspector basics (bjhr7jgzcpgMFdUcOCkSqQ)
  - Transport Bar Sections (8nCkXhjj0Q9BTjOXMCEL5w)
  - Project Window Toolbar (33c5DiLb5e9IeHrIkVkhaQ)
  - Using Solo and Mute (GKkGYKJvIMsDiKvzhrnbow)
  - Soloed/Muted speaker channels (DmjTvTOWr0hbsNXIHHn1Ug)
  - Setting up Meter Colors (JEyCI8kHT73RLPh5rrlEPg)
  - Key Editor (KvFIaKW6t4zgjz2Kvv~qig)
  - Key Editor Note Display (jCoIsvlnSe1sodcVFw3cyQ)
  - Preferences: Transport (0idTX8Dj8Z2WsUwASx8bew), Editors (jUEEm8vwyxeOJLZXV3gWKg), Editing–Project & MixConsole (xiAqZ4xPtq3_MlYs4sXbow), Editing–Tools (0qN8cK3rJnXJx2cRk6pNWQ), User Interface (An8~JoFqNXC4Qp5~h9QlZQ), Track & MixConsole Channel Colors (nU_6uerZ2y9ULkzqMSzWig)
- Manual pages: Project Window overview <https://www.steinberg.help/r/cubase-pro/14.0/en/cubase_nuendo/topics/project_window/project_window_overview_r.html>; Channel Sections <https://www.steinberg.help/r/cubase-pro/14.0/en/cubase_nuendo/topics/mixconsole/mixconsole_working_with_channel_racks_c.html>; Fader Section <https://www.steinberg.help/r/cubase-pro/14.0/en/cubase_nuendo/topics/mixconsole/mixconsole_fader_section_c.html>; Audio and MIDI Record Modes <https://www.steinberg.help/r/cubase-pro/14.0/en/cubase_nuendo/topics/recording/recording_audio_record_modes_r.html>, <https://www.steinberg.help/r/cubase-pro/14.0/en/cubase_nuendo/topics/recording/recording_midi_record_modes_r.html>; Left and Right Locators <https://www.steinberg.help/r/cubase-pro/14.0/en/cubase_nuendo/topics/playback/playback_left_and_right_locator_c.html>
- Screenshots sampled (event display, track list, MixConsole, fader section, project window), steinberg.help resources: `EY0IQS0U0xa2z6FAYkA9YA`, `QyaoncCyf6B0GNYUiR8V3g`, `81zfCPeUvUbhctDJ6ttuDA`, `8XPmDlTtd1yslK5DxY2_1g`, `c62moPzcV9tEBGEPhvpK_g`
- Forums:
  - Tool modifiers (Alt-click split, Alt drag copy, Ctrl constrain): <https://forums.steinberg.net/t/issue-with-tool-modifier-split-event-using-select-tool-alt/734463>, <https://forums.steinberg.net/t/how-to-make-real-copies-with-constraint-direction-on/60760>
  - Velocity note colours, blue → red: <https://forums.steinberg.net/t/expanded-color-palette-for-velocity-display-in-key-editor/1033951>
  - Return to start on stop: <https://forums.steinberg.net/t/preference-transport-return-to-start-position-on-stop/976244>
- REAPER:
  - ReaScript API (`SetMouseModifier`, `GetMouseModifier`): <https://www.reaper.fm/sdk/reascript/reascripthelp.html>
  - WALTER reference: the WALTER docs (REAPER theme documentation)
  - REAPER 7 mouse-modifier overrides: <https://reaper.blog/2023/11/activating-razor-edit-tool/>, <https://www.reaper.fm/userguide/WhatsNewReaper7Summary_r2.pdf>
  - Default 7 colour keys: REAPER's Default 7 theme

## 8. Verify list (before shipping)

1. The Num Enter key code in reaper-kb.ini.
2. Whether `40757` and `40046` split everything under the cursor when nothing is selected.
3. Mouse-modifier context and behaviour names (§3.4), and how the override-set storage works.
4. Whether TCP/transport custom WALTER buttons accept a command id, act on their own track, and show toggle state.
5. Whether a meter strip with more than two stops works.
6. Whether `trans.sel` shows the loop or the time selection when unlinked.
7. Cubase factory defaults: return-to-start on stop, auto-scroll, record-on-selected-track, editor in the lower zone.
8. Lit colours not measured: Solo button, Monitor, Read/Write, Start.
9. Selected-track and selected-note colours, and the cursor colour.
10. ⌘M on macOS.
