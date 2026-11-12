# Logic Pro → REAPER research notes
These are the notes the Logic Pro profile was built from, checked against REAPER 7.82. They may be out of date — corrections welcome via PR.

This spec is for the REAPER Assist "Coming from Logic Pro" profile. It covers three outputs:

- (a) an original REAPER kit: our own vector artwork and our own WALTER layout;
- (b) the window layout;
- (c) shortcuts, mouse modifiers, toolbar buttons, preferences and small Lua scripts.

**Reference product.** The target is Logic Pro for Mac in its default dark appearance. Apple's online guide is now at version 12.3. The look of 12 matches 11 as far as the guide figures and apple.com screenshots show (verify on a real Logic 11/12 install). Where 12 changed a default, the spec says so.

**How to read it.**
- "verify" means the value is not confirmed, so someone must check it in REAPER or Logic before shipping.
- All REAPER action ids were checked against REAPER 7.82's action list (section 0 = main, 32060 = MIDI editor).
- "script" means a small Lua ReaScript described in section 3.10.

**Colour sources.** Colours were sampled in memory from Apple guide figures and apple.com screenshots; no images were saved. They are approximations of what a user sees. They are not Apple assets, and the artwork must still be drawn by us.

---

## 0. What matters most (priority order)

1. **Space must leave the playhead where it stopped.** Bind Space to 40328, "Play/stop (move edit cursor on stop)". REAPER's default jumps back, and that is the first thing a Logic user notices.
2. **Single-letter keys.** M and S are track mute and solo (6, 7); the current profile maps M to item mute, which is a bug. R records, C toggles cycle, K the metronome. X opens the Mixer, P the Piano Roll, Y the Library, F the Browsers. Cmd-T splits, Cmd-J joins, Cmd-R repeats, Q quantizes, Z zooms to the selection, Return goes to the start.
3. **Pointer tool feel.** Clicking a region selects it without moving the playhead. Option-drag copies, Shift-click toggles the selection, and dragging on an empty area rubber-band-selects. T opens a tool menu (script) with Pencil, Eraser, Scissors, Glue, Mute, Marquee (razor) and Zoom.
4. **Dark charcoal tracks area, mid-grey track headers.** Lanes are #2a2a2a–#2e2e2e, headers #545454, the selected header #727272. Regions are filled with the track colour (blue audio, green instrument), with waveforms and notes in a light tint. The cycle strip is yellow and the playhead white.
5. **Light grey control bar on top** (#a2a2a2) with the dark LCD in the middle (#24262e, pale blue-white digits). The Library is on the left, the Browsers on the right, and the Mixer and Piano Roll share the bottom pane as tabs.
6. **Mixer strips.** Mid grey (#545454), with blue filled plug-in and send slots (#246cb4) and dark empty ones. A large light fader cap sits on a thin dark slot with the meter beside it, the pan knob is a grey disc, and the name plate at the bottom is filled with the track colour.

---

## 1. Look

### 1.1 KitColors for a new kit `logic` (base 100%, dark appearance)

| Role (`KitColors`) | Hex | Logic surface it comes from | Confidence |
|---|---|---|---|
| bg | `#2a2a2a` | Tracks area / window background below the tracks | medium |
| panel | `#424242` | Local menu bar of the Tracks area, mixer header, Piano Roll header/ruler | medium |
| track | `#545454` | Track header and mixer strip background | high (several figures) |
| trackSel | `#727272` | Selected track header / selected strip | high |
| face | `#666666` | Track-header M/S/R/I buttons, Output and Setting buttons in the mixer | medium |
| line | `#3c3c3c` | Hairlines between headers, the TCP volume slider track | medium |
| deep | `#363636` | Fader slot, unlit meter, dB readout fields, pan knob ring | high |
| text | `#e6e6e6` | Track names, button letters (pure white `#ffffff` on lit buttons) | medium |
| dim | `#a2a2a2` | Secondary labels | medium |
| accent | `#246cb4` | Filled plug-in and send slots (Logic's blue) | high |
| accent2 | `#c09c2a` | Cycle strip yellow (ruler), lit Cycle button | high |
| solo | `#b48a2a` | Solo lit (yellow) | high |
| arm | `#d8302a` | Record-enable lit (red; ring `#ba1818`) | high |
| play | `#3cc35a` | Play button lit (green) | **verify** (not sampled) |
| onInk | `#1e1e1e` | Ink on lit yellow buttons (Solo, Cycle). Mute-lit (blue) and arm-lit (red) need white ink, see 1.6 #6 | medium |
| env[0] read | `#288b3b` | Automation "Read" fill (text `#66fc7e`) | medium |
| env[1] touch | `#b48a2a` | "Touch" | medium |
| env[2] write | `#d8302a` | "Write" | **verify** |
| env[3] latch | `#ba6612` | "Latch" (orange) | medium |
| env[4] preview | `#6b6b6b` | Logic has no preview mode: neutral | n/a |
| display | `#24262e` | LCD background (also `#24242a`) | high |
| displayText | `#c7daea` | LCD digits (pale blue-white) | high |
| knob | `#e6e6e6` | Pan knob pointer line (Logic knobs have no coloured value arc by default; one figure showed a green `#4ed266` arc, **verify**) | low |
| notes.off | `#72ae3c` | Piano Roll note in the default green region colour | medium |
| notes.on | `#c8e6a0` | Selected note (lighter tint). **verify** how Logic marks selection | low |
| notes.bg | `#2a2a2a` | White-key row (black-key rows `#1e1e1e`) | medium |
| meter.off | `#363636` | Unlit meter | high |
| meter.low | `#2fc24a` | Safe level (green) | **verify** hue |
| meter.mid | `#d6d22a` | Near 0 dB (yellow) | **verify** |
| meter.high | `#e8901f` | Hot (orange/amber) | **verify** |
| meter.clip | `#e8392c` | Clip (red) | medium |

**New colour roles Logic needs** (see 1.6):
- `transBg #a2a2a2`, `transFace #9c9c9c`, `transInk #484848`, `transRec #cc1206` (record glyph), `transLit #a27e24` (active Cycle/Solo in the control bar);
- `displayLabel #546678` (small LCD captions), `displayEdit #30487e` (LCD field being edited);
- `mute #3c8de0` (mute lit, blue; exact hue **verify**), `monitor #d8822a` (input monitoring lit, orange, **verify**);
- `slotEmpty #4e4e4e` (`#666666` on the selected strip), `slotInstrument #248a36` (green), `slotInput #606060`;
- `faderCap #c0c6c6` (range `#a8aeae`–`#d2d8d8`, grip lines `#7e8484`, **verify** line colour).

### 1.2 Tracks area (feeds `Workflow.reaper` → `reaperColors`)

| Key | Hex | Notes |
|---|---|---|
| bg | `#2a2a2a` | arrange background, track-list background, mixer background, docker background |
| lane1 / lane2 | `#2e2e2e` / `#2c2c2c` | Logic does not stripe lanes. Keep the two nearly equal. A thin darker separator line is part of the lane look (**verify** that REAPER draws one: track divider colour key) |
| sel | `#363636` | selected track's lane, slightly lighter (**verify**) |
| ruler | `#303030` | ruler / global-track backgrounds |
| rulerText | `#d2d2d2` | bar numbers. Ruler tick marks are `#5a5a5a` |
| grid | `#3a3a3a` | bar and beat lines (**verify**: Logic's beat lines are very faint) |
| item | `#366ca8` | default audio region colour (track colour of a new audio track). Items take the track colour through the kit's `tinttcp` |
| peaks | `#cce4fc` | waveform = light tint of the region colour (green regions use `#f0fce4`) |
| cursor | `#fcfcfc` | Logic has one playhead. Draw REAPER's edit cursor the same white so stopped and playing look alike |
| play | `#fcfcfc` | playhead line; the head/handle is `#a8a8a8` |
| note | `#72ae3c` | MIDI note colour in the arrange and the Piano Roll default |
| region | `#7a7a7a` | REAPER regions play the role of Logic Arrangement markers, which have per-section colours. Neutral default (**verify**) |
| marker | `#b0b0b0` | Logic's marker track. Neutral (**verify** Logic's default marker colour) |
| text | `#e6e6e6` | |

Extra theme keys that `reaperColors` doesn't map yet:
- **Cycle strip yellow `#c09c2a`** for the loop range in the ruler. The key names are **verify**: they are likely `col_tl_bgsel` / `col_tl_bgsel2`, plus the time-selection draw mode, in the default `.ReaperTheme`.
- **Selected region.** In Logic the selected region's header strip turns into the light tint (`#c6e4fc` blue / `#defcc0` green) with dark name text. REAPER can only lighten the whole item (`col_tr1_itembgsel`) and recolour the label (`col_mi_label_sel` → `#1e1e1e`). There is no separate header band (**verify** whether an item-label background key exists).
- **Muted regions** are drawn grey in Logic, which matches REAPER's muted-item draw. **Looped repeats** are drawn shaded in Logic, and REAPER draws loop-boundary marks.

**Default track colours by type** (set by script on insert, see 3.10 S6):
- audio `#376fab`
- software instrument `#1aa331`
- aux/bus `#a31a87`
- drum `#a2a218`

The bright palette row, to offer in a colour picker: `#c93b10 #ca7d10 #c9a410 #c9ca10 #a4ca11 #7fca11 #5bc911 #10ca2f #10a5ca #2596ce #3581d4 #3e67d6 #4644d8 #5e40d6 #7739d3 #902ed1 #a511ca #c910a5`. Region text and waveform use a light tint of the region colour; mix about 80% toward white.

**Piano Roll colours.**
- Rows: white-key `#2a2a2a`, black-key `#1e1e1e` (`midi_trackbg1/2`).
- Keyboard: white keys `#d8d8d8`, black keys `#181818`.
- Header and ruler `#424242`.
- Notes take the region colour (32060 action 40769, "Color notes/CC by media item custom color"), with velocity shown as a line inside the note (**verify** a REAPER equivalent; REAPER shades notes by velocity instead).

### 1.3 Electron side-panel palette (`Workflow.panel`)

| bg | panel | panelAlt | border | text | textDim | accent | accentText | accent2 |
|---|---|---|---|---|---|---|---|---|
| `#2a2a2a` | `#424242` | `#545454` | `#363636` | `#e6e6e6` | `#a2a2a2` | `#246cb4` | `#ffffff` | `#c09c2a` |

### 1.4 Control style

- **Shape.** `look: "flat"`, `radius: 3`. Surfaces are flat with a very soft top-to-bottom shade (top about 4% lighter). There are no glossy highlights and no drop shadows; a 1px darker outline (`deep`) sits under buttons.
- **M / S / R / I buttons in the track header.** Rounded rectangles about 18×16 (base units), face `#666666` (`#7e7e7e` on a selected track), with a bold white capital letter. Lit: M blue fill, white letter; S yellow `#b48a2a`, dark letter; R red `#d8302a` with a darker ring `#ba1818`, white letter (Logic blinks R when armed; REAPER's arm image can't blink, so use a steady fill); I orange, white letter.
- **Mixer buttons.** M S sit side by side under the fader, and R I side by side above them, about 26×18 each, in the same style.
- **TCP volume.** A horizontal slider on a thin `#3c3c3c` track, with a small light thumb (`#a8a8a8`/`#adadad`, about 10×14, radius 2).
- **Mixer fader.** A thin dark slot (`#363636`, about 4 px) and a large light-grey cap, taller than it is wide (start at 24×40 and **verify** the proportions), with a slight vertical gradient and a horizontal centre grip line. The level meter sits to the right of the fader, with a dB scale between them.
- **Pan knob.** A solid disc (`#848484` in the mixer, `#a2a2a2` in the TCP) with a dark ring `#363636` and a light pointer line. No value arc by default (**verify**). Mixer knob about 30 base units, TCP knob 18.
- **Slots** (plug-in, send, input, output). Full-width rounded bars, 18 high, 2 px apart. Filled slots are blue `#246cb4` with white text, the instrument slot green `#248a36`, empty slots `#4e4e4e`. Input, Output and Group are neutral `#606060`/`#666666` with white text. Send slots have a tiny level knob at the right end, which REAPER draws itself.
- **LCD.** A dark rounded rectangle (`#24262e`, radius 4) in the centre of the control bar. Large digits `#c7daea` show bar/beat, tempo and time signature, with tiny caps captions (`#546678`) under them: BAR, BEAT, TEMPO, KEY, TIME.
- **Fonts.** Use the OS UI font (REAPER theme fonts `lb_font`, `lb_font2`, `user_font*`, `trans_font`, per reaper-mechanics.md). Never bundle Apple's SF fonts. Sizes in base units: track name 12, button letters 10 bold, slot text 10, LCD digits 20–22, LCD captions 8, ruler numbers 10.

**Starting `SIZES.logic`** (even numbers, base units; **verify** all against screenshots at 1x):
```
tcpMute [18,16]  tcpBtn [18,16]  tcpSmall [18,16]  tcpFx [22,16]  tcpKnob 18  tcpThumb [10,14]
mcpMute [26,18]  mcpBtn [26,18]  mcpArm [26,18]   mcpSmall [22,18] mcpKnob 30 mcpThumb [24,40] mcpFaderW 4
envBtn [20,16]   envKnob 18      trans [32,24]    tap [40,24]     menu [20,18] toolbar 30
MCP strip width ≈ 72 (verify)
```

### 1.5 Do not copy

- Apple logos, the Logic Pro icon, and the words "Logic", "Apple" or "Alchemy" anywhere in the artwork or the theme name.
- SF Symbols, or any Apple glyph, as source art: track icons (instrument pictures), control-bar view icons (Library, Inspector, Smart Controls, Mixer, Editors, Loops, Browsers), T-menu tool icons, and the metronome, count-in and tuner glyphs. Draw all of these ourselves from basic shapes, in our own style.
- Logic screenshots or figure crops, including as references inside the shipped kit.
- Bundled Logic content: Apple Loops, patches, Drummer kits, Alchemy presets, impulse responses, or the "Session Players" names.
- Logic's exact control-bar arrangement as one image.
- Logic's localized UI strings, beyond the generic names that every DAW uses.

Generic DAW concepts (cycle, LCD, M/S/R/I, the colours) are fine. In line with the Nord Stage policy: evoke the feel, not the trade dress.

### 1.6 New kit features Logic needs (only FL and Ableton exist today)

1. **New kit id.** Add `KitId "logic"`, `SIZES.logic`, a `kitFor` branch, and `walter.ts` branches (`tcpLogic`, `mcpLogic`, a Logic transport). The current code is `k.id === "ableton" ? … : FL`, so every place needs a third case.
2. **Light control bar in a dark theme.** Add transport palette fields (`transBg`, `transFace`, `transInk`, `transRec`, `transLit`). The transport art in `art.ts` uses `c.face`/`c.text` today, and `transport_bg` uses `c.panel`. REAPER's theme keys `col_trans_bg`/`col_trans_fg` already exist separately from `col_main_bg2`, so the transport row can be light while the rest stays dark (**verify** that the docked transport uses `col_trans_bg`).
3. **LCD with captions.**
   - A `k_display` panel behind `trans.status`, `trans.bpm.edit` and `trans.curtimesig`.
   - Static captions as WALTER `custom` text elements (`trans.custom.kCapBar` etc., text-only custom elements are documented), coloured `displayLabel`.
   - **verify** that `custom` works inside `trans` layouts; the doc's example is `tcp.custom.*`.
4. **Mixer slot art.** Add `mcp_fxlist_norm/empty/byp/off`, `mcp_sendlist_norm/mute/empty`, `mcp_fxlist_bg`, `mcp_sendlist_bg`, and the `tcp_fxlist_*` equivalents. `art.ts` draws none of these today.
   - Filled slots are blue rounded bars; empty slots are dark rounded bars.
   - Bypassed slots are grey with dim text (**verify** Logic's bypass look). Offline slots are darker still.
5. **Disc knob style.** Add `knobStyle: "disc"`: a solid disc, a dark ring, and a pointer line, with no arc. Today `flat` draws an open ring with an arc and `gloss` draws a shaded disc.
6. **Per-button lit ink.** `onInk` is a single value today. Logic needs white ink on blue (mute), red (arm) and orange (monitor), and dark ink on yellow (solo, cycle). Either add `ink` per state, or pick the ink by brightness the way `ON_COLOR` does in WALTER.
7. **Large light fader cap with grip line, and a thin dark slot** (`mcp_volthumb`, `mcp_vol` art). Also a small light thumb for the horizontal TCP slider.
8. **Track-colour name plate at the bottom of each mixer strip**, and **a 3 px colour bar at the left edge of the TCP**. Both are a `custom` element filled with `TRACK_FILL`, the same pattern as the FL kit's `tcp.custom.kIdx`.
9. **Automation-mode button as a coloured pill** per mode (env colours above), showing the mode text where REAPER allows. **verify** whether `mcp.env` can show the mode name or only images.
10. **Optional original track icons** (about 12 instrument categories in a single-colour line style) for REAPER's icon column (`tcp_iconsize`/`mcp_iconsize`), set per track with `P_ICON`. These must be our drawings, not SF Symbols.
11. **Theme keys for the cycle-strip colour and the selected-item label** (1.2).
12. **Meter scale marks** between fader and meter: `mcp.meter.scale.color.*` (exists) plus a peak readout field, `mcp.meter.readout.color`, styled as a dark `#363636` box.

---

## 2. Layout

### 2.1 Main window plan

```
+-------------------------------------------------------------------------------+
| main toolbar (top): Library  Inspector  Mixer  Editors | tools ... | Loops  Browsers |
| transport (docked top, light): [stop][play][rec] [cycle] [  LCD  ] [cnt][click]     |
+--------------+-------------------------------------------------+--------------+
| left docker  | TCP (left) | ruler + global lanes                | right docker |
| FX browser   |            | Tracks area (arrange)               | Media        |
| = Library    |            |                                     | Explorer     |
| (+Inspector  |            |                                     | = Browsers / |
|  script tab) |            |                                     | Loop Browser |
+--------------+-------------------------------------------------+--------------+
| bottom docker (docker 0): [Mixer] [MIDI editor]  (tabs)  = Logic's lower pane  |
+-------------------------------------------------------------------------------+
```

**reaper.ini settings** (window keys are written while REAPER is closed; existing mechanism in `src/profiles/engine/workspace.ts`):

| Purpose | Key(s) | Value | Confidence |
|---|---|---|---|
| Transport docked at the top of the main window | `transport_vis` / `transport_dock` / `transport_dock_pos` | `1` / `1` / `3` | high (verified in REAPER) |
| Mixer in the bottom docker | `mixwnd_vis`, `mixwnd_dock`, `dockermode0` | `1`, `1`, `0` | high |
| MIDI editor docks (bottom, with the mixer) | `[midiedit] dock` | `1` | high |
| FX browser (Library) in a LEFT docker | `fxadd_vis=1`, `fxadd_dock=1`, `[REAPERdockpref] fxbrowser=0.1 <L>`, `dockermode<L>=1`, `dockersel<L>=fxbrowser`, `dockheight_l=260` | | high for the keys, but **needs a code change** (below) |
| Media Explorer (Browsers) in a RIGHT docker | `[REAPERdockpref] explorer=0.1 <R>`, `dockermode<R>=3`, `dockersel<R>=explorer`, `dockheight_r=320`, `[reaper_sexplorer] docked=1 visible=1` | | high for the keys |
| TCP on the left (Logic) | `mixerflag` bit 32 **clear** | | high |
| Main toolbar at the top | action 41297 (toggle; check the state first) | | ini key **verify** |
| Bottom docker height | `dockheight` | about 300 | medium |

**Code change needed.** `workspaceIni` puts the explorer and the FX browser in the same docker (`explorer 0.1 N`, `fxbrowser 0.2 N`). Logic needs them on opposite sides. Proposed plan field: `browsers?: { fx: "left" | "right" | "off"; explorer: "left" | "right" | "off" }`. Allocate two free dockers, and restore both in `src/profiles/engine/restore.ts`.

**Live session** (bridge) equivalents:
- 41599 "Docker: Show in left of main window" and 41601 "…right…" (act on the focused docker);
- 41606 transport to top;
- 40083 mixer docking toggle;
- 40279 show docker.

Recall later via a screenset: 40483 "Save window set #10" / 40463 "Load window set #10", per reaper-mechanics.md.

### 2.2 Track header (TCP)

Logic, normal height, left to right: colour bar, track icon, M, S, R, I, track name, volume slider, pan knob. When the track is taller, the name moves to its own top row and the buttons and controls sit below it.

**verify** the exact order (name before or after the buttons) on a current Logic screenshot. The order above was sampled from the guide figure in lgcpe53c68af.

| Logic element | REAPER (WALTER) | Placement, normal height (base units, W = panel width) | Notes |
|---|---|---|---|
| Colour bar | `tcp.custom.kBar`, `.color` = `TRACK_FILL` (else `#6e6e6e`) | `[0 0 3 h]` | pattern exists (FL `kIdx`) |
| Track icon | REAPER icon column: `tcp_iconsize` | 26 | only shows when the track has `P_ICON` set. REAPER can't tint the icon with the track colour; Logic draws the glyph in the track colour on a dark square (`#2a3642`) |
| Disclosure triangle (Track Stack) | `tcp.foldercomp` / `tcp.folder` | left of the icon, folder tracks only | Track Stack = folder track |
| M S R I | `tcp.mute`, `tcp.solo`, `tcp.recarm`, `tcp.recmon` | x = 32, 52, 72, 92; y centred; 18×16 | R and I show on audio and instrument tracks; hide `recarm`/`recmon` on folder (stack) tracks: `folderstate==1` |
| Name | `tcp.label` (no boxed field: plain text on the header) | x 114 → W−118 | Logic's name has no text-field frame. Use `.color` `#e6e6e6`, or white on a selected track |
| Volume slider | `tcp.volume` (horizontal) | W−112, width 72 | `tcp.volume.label` hidden (Logic shows no dB in the header) |
| Pan knob | `tcp.pan` | W−32, 18×18 | `tcp.pan.label` hidden |
| (hidden) | `tcp.fx`, `tcp.io`, `tcp.env`, `tcp.phase`, `tcp.recmode`, `tcp.recinput`, `tcp.trackidx`, `tcp.meter` | off | Logic's header has none of these by default. Track numbers are optional in Logic, so `trackidx` could be offered as a layout option |

- **Tall layout** (`h >= 72`): row 1 holds the name, from the icon to W−8. Row 2 holds M S R I, then the volume and pan at the right.
- **Small layout** (`h < 40`): the name and M S only.
- **Selected track:** background `#727272` and button faces `#7e7e7e`. Use the kit's `trackSel` art or a `track_selected` branch.
- **REAPER can't:**
  - per-header "Configure Track Header" checkboxes. This could become a WALTER `define_parameter` option set in the Theme Adjuster;
  - the icon-glyph tint;
  - Logic's "track On/Off" power button (frees the CPU). There is no TCP element for it; the nearest actions are 40535 "Track: Set all FX offline for selected tracks" and 8 "Track: Toggle FX bypass for selected tracks";
  - the Freeze snowflake button. Freeze is an action (41223); there is no TCP element.

### 2.3 Mixer channel strip (MCP), top to bottom

| # | Logic | REAPER element / setting | Status |
|---|---|---|---|
| 1 | Setting button (channel-strip preset) | none. The FX chain load menu is under `mcp.fx` | **can't** (closest: `mcp.fx` button) |
| 2 | Gain-reduction meter | none | **can't** (**verify** whether REAPER 7 meters can show plug-in GR) |
| 3 | EQ thumbnail | none | **can't** |
| 4 | MIDI FX slot (instrument tracks) | none. MIDI FX are ordinary FX in the chain | **can't** |
| 5 | Input slot (instrument plug-in, or audio input) | `mcp.recinput` (shows the input name; click = input menu). The instrument appears as the first FX in the FX list | partial |
| 6 | Audio FX slots | extended mixer FX list: `mcp.extmixer.mode [1]` + `mcp.extmixer.position`; action 40549 "Mixer: Toggle show FX inserts" ON; `mcp_fxlist_*` art (blue) | yes. REAPER can't colour the instrument slot green |
| 7 | Sends | extended mixer send list, 40557 "Mixer: Toggle show sends" ON; `mcp_sendlist_*` art | yes |
| 8 | Output ("Stereo Out") | `mcp.io` (routing button, an image, not a text slot) | partial |
| 9 | Group slot | none | **can't** |
| 10 | Automation mode ("Read") | `mcp.env` | yes (coloured per mode) |
| 11 | Pan knob | `mcp.pan` (disc knob), `mcp.pan.label` hidden | yes |
| 12 | dB readouts: volume / peak | `mcp.volume.label` (volume) and the meter peak readout (`mcp.meter.readout.color`) | yes |
| 13 | Fader + meter | `mcp.volume` (vertical; thin slot, large cap) with `mcp.meter` to its right; scale via `mcp.meter.scale.color.*` | yes |
| 14 | R / I | `mcp.recarm`, `mcp.recmon` side by side | yes |
| 15 | M / S | `mcp.mute`, `mcp.solo` side by side | yes |
| 16 | Track icon | `mcp_iconsize` row (**verify** where REAPER puts it: top or bottom) | partial |
| 17 | Name (filled with the track colour) | `mcp.custom.kName` filled `TRACK_FILL`; `mcp.label` set to it | yes |

Other mixer settings:
- **Master.** Logic puts "Stereo Out" and "Master" at the right end of the mixer. REAPER: 40389 "Mixer: Toggle show master track on right side" ON.
- **Icons.** 40903 "Mixer: Toggle show track icons in mixer" ON only if the kit ships icons.
- **Smart Controls.** The nearest is 40910 "Mixer: Toggle show FX parameters". Leave it off by default; it is a mixer-wide display toggle, not Logic's per-patch panel.

### 2.4 Inspector (I)

Logic's Inspector shows:
- the Region inspector (loop, quantize, transpose, gain);
- the Track inspector;
- two channel strips: the selected track and its output.

**REAPER has no inspector.** The plan is a docked script (3.10 S9) in the left docker, as a tab next to the FX browser. There are two ways to build it:

- **Option A (preferred).** A `gfx` script with no extension dependency. It shows the selected item's mute, loop source, pitch, gain and fade in/out, plus a Q button. It also shows the selected track's volume, pan, input, monitoring, record arm, and FX list (click an FX to open it).
- **Option B.** ReaImGui (an extension, installed from ReaPack). Richer, but adds a dependency.

Fallback with no script: I → 40291 "Track: View FX chain for current/last touched track". **can't:** two live channel strips with meters in a docker, except through REAPER's own mixer.

### 2.5 Control bar

Logic's control bar is one light strip:
- **Left:** Library, Inspector, Toolbar, Smart Controls, Mixer, Editors.
- **Centre:** transport (Logic 12 removed Rewind/Forward by default), Record, Capture, Cycle, LCD, Tuner, Solo, Count-in, Metronome, and optional master volume/meter.
- **Right:** Note Pads, Loop Browser, Browsers.

REAPER needs two rows:

1. **Main toolbar (top).** View buttons and tool buttons, from 3.9. It uses `col_toolbar_*` colours. Keep it dark (`#424242`), like Logic's Tracks-area menu bar.
2. **Transport (docked top), light.** The WALTER `trans` layout centres the group:
   - `trans.stop`, `trans.play`, `trans.rec`;
   - `trans.repeat` as the Cycle button, lit `transLit`;
   - the LCD group `trans.status` + `trans.bpm.edit` + `trans.curtimesig` on a `k_display` panel;
   - `trans.custom.kCountIn` and `trans.custom.kClick` as buttons. A `custom` element with `command_id` + `button_image` becomes a button in REAPER 7. **verify** this works in `trans` and accepts script command ids (`_RS…`).
   - Hide `trans.pause`, `trans.rate*`, `trans.sel`, `trans.automode`, `trans.bpm.tap`.
   - `trans.rew`/`trans.fwd` are optional: Logic 11 shows them, Logic 12 hides them.

**LCD content** (set at install):
- 40411 "Transport: Time unit: Measures.Beats";
- 42366 "Transport: Secondary time unit: None" (Logic's default LCD is "Beats & Project": no clock time);
- 40680 "Transport: Show time signature" ON;
- 40532 "Transport: Show play state as text" OFF.

**Ruler:**
- 40367 "View: Time unit for ruler: Measures.Beats";
- 42360 "View: Secondary time unit for ruler: None".

**REAPER can't:**
- a master volume slider or output meter in the transport. There is no trans element; the master strip at the right of the mixer is the substitute;
- a key-signature field;
- Logic's Tuner and Note Pads;
- Logic's control-bar "Solo" (region solo mode). The nearest is 41561 "Item properties: Toggle solo exclusive";
- per-field LCD editing with drag-to-change on bar/beat. REAPER's status field is one text element.

### 2.6 Library and Browsers

| Logic | REAPER | Notes |
|---|---|---|
| Library (Y), left: patches by category | FX browser docked left (40271 "View: Show FX browser window") | Its "FX Chains" folder plays the role of patches. Ship our own original `.RfxChain` "patches" only, never Logic's |
| Browsers (F), right: Project / Media / All Files | Media Explorer docked right (50124 "Media explorer: Show/hide media explorer") | Shortcuts: Kitroom, Music, Downloads (existing `sampleFolders`) |
| Loop Browser (O), right | Same Media Explorer (start folder Kitroom) | No Apple Loops. REAPER's explorer can preview in tempo; **verify** the "sync to project tempo" option name |
| Plug-in menu in a slot | Click an empty FX slot → FX browser / FX menu | REAPER default |

### 2.7 Editors (bottom pane)

| Logic | REAPER |
|---|---|
| Piano Roll (P), docked at the bottom, sharing the pane with the Mixer | MIDI editor, `[midiedit] dock=1`, shares docker 0 with the mixer as a tab. The editor follows the arrange selection (`midieditor` bit 128 is inverted; **verify**) |
| Editor (E) toggles the right editor for the selected region | script S5 (MIDI → 40153; audio → 40009 "Item properties: Show media item/take properties") |
| Audio Track / Audio File Editor | **can't** (REAPER has no destructive audio editor; item properties and stretch markers partly cover it) |
| Step Sequencer, Drummer Editor | **can't** |
| Score (N) | MIDI editor notation mode (32060 40954 "Mode: Notation") |
| Event List (D) | MIDI editor event-list mode (32060 40056 "Mode: Event List") |

**Global tracks (G).** The REAPER ruler lanes (markers, regions, tempo/time signature): 42323 "Ruler: Show/collapse all ruler lanes". The Logic **Arrangement track** maps to REAPER **regions**.

**Automation view (A).** 41151 "Envelope: Toggle show all envelopes for tracks".

---

## 3. Function

### 3.1 Key commands, main section (0)

Logic default US key set, from Apple's key-command pages.

- **Modifiers.** Cmd/Opt/Ctrl/Shift are the Mac keys. REAPER flags: shift 4, cmd 8, opt 16, ctrl 32.
- **No key+modifier pair repeats** in this table.

| Key | Logic command | REAPER id | REAPER action | Match |
|---|---|---|---|---|
| Space | Play or Stop | 40328 | Transport: Play/stop (move edit cursor on stop) | yes. The playhead stays where it stopped |
| Return | Go to Beginning | 40042 | Transport: Go to start of project | yes |
| R | Record | 1013 | Transport: Record | yes |
| Cmd-. | Discard Recording and Return to Last Play Position | 40668 | Transport: Stop (DELETE all recorded media) | yes |
| C | Cycle Mode | 1068 | Transport: Toggle repeat | yes |
| K | Metronome Click | 40364 | Options: Toggle metronome | yes |
| Shift-K | Count-in | script S3 | (no action; sets `projmetroen` bit) | needs script |
| , | Rewind (one bar) | 41043 | Move edit cursor back one measure | yes |
| . | Forward (one bar) | 41042 | Move edit cursor forward one measure | yes |
| Opt-' | Create Marker | 40157 | Markers: Insert marker at current position | yes |
| Cmd-U | Set Locators by Regions and enable Cycle | script S2 | (uses 41039 or 42474, then repeat on) | needs script |
| X | Show/Hide Mixer | 40078 | View: Toggle mixer visible | yes |
| P | Show/Hide Piano Roll | 40153 | Item: Open in built-in MIDI editor | partial (opens; P inside the editor closes, 3.3) |
| E | Show/Hide Editor | script S5 | (40153 / 40009) | needs script |
| Y | Show/Hide Library | 40271 | View: Show FX browser window | partial (**verify** that it toggles) |
| F | Show/Hide Browsers | 50124 | Media explorer: Show/hide media explorer | yes |
| I | Show/Hide Inspector | script S9 (fallback 40291) | Track: View FX chain for current/last touched track | needs script |
| A | Show/Hide Automation | 41151 | Envelope: Toggle show all envelopes for tracks | yes |
| Cmd-T | Split Regions at Playhead | 40012 | Item: Split items at edit or play cursor (select right) | yes |
| Cmd-J | Join Regions | 40362 | Item: Glue items, ignoring time selection | yes (REAPER renders a new file; Logic merges MIDI without rendering. MIDI items glue losslessly) |
| Cmd-R | Repeat Regions | 41295 | Item: Duplicate items | yes |
| L | Loop Regions | 40636 | Item properties: Loop item source | partial (Logic's loop extends to the next region; REAPER only allows edge-drag looping) |
| Q | Quantize | script S7 (fallback 40316) | Item: Quantize item positions to grid... | needs script for MIDI notes |
| M | Toggle Channel Strip Mute | 6 | Track: Toggle mute for selected tracks | yes |
| S | Toggle Channel Strip Solo | 7 | Track: Toggle solo for selected tracks | yes |
| Ctrl-M | Mute Regions/Events | 40175 | Item properties: Toggle mute | yes |
| Ctrl-R | Toggle Track Record Enable | 9 | Track: Toggle record arm for selected tracks | yes |
| Ctrl-I | Toggle Track Input Monitoring | script S8 (fallback 40495) | Track: Cycle track record monitor | needs script for an exact on/off |
| Opt-Cmd-N | New Tracks | 40001 | Track: Insert new track | partial (Logic opens a dialog) |
| Opt-Cmd-S | New Software Instrument Track | 40701 | Insert virtual instrument on new track... | yes (+ colour via S6) |
| Cmd-D | New Track with Duplicate Settings | script S4 | (40062 then remove items) | needs script |
| Shift-Cmd-D | Create Track Stack | 42785 | Track: Move tracks to new folder | yes |
| Up | Select Previous Track | 40286 | Track: Go to previous track | yes |
| Down | Select Next Track | 40285 | Track: Go to next track | yes |
| Left | Select Previous Region | 40416 | Item navigation: Select and move to previous item | yes |
| Right | Select Next Region | 40417 | Item navigation: Select and move to next item | yes |
| Opt-Up | Transpose +1 semitone | 40204 | Item properties: Pitch item up one semitone | partial (audio only. REAPER take pitch does not transpose MIDI) |
| Opt-Down | Transpose −1 semitone | 40205 | Item properties: Pitch item down one semitone | partial |
| Cmd-G | Snap toggle | 1157 | Options: Toggle snapping | yes |
| Z | Toggle Zoom to fit Selection or All Contents | 41622 | View: Toggle zoom to selected items | yes |
| Cmd-Left | Zoom Horizontal Out | 1011 | View: Zoom out horizontal | yes |
| Cmd-Right | Zoom Horizontal In | 1012 | View: Zoom in horizontal | yes |
| Cmd-B | Bounce Project or Section | 40015 | File: Render project to disk... | yes |
| T | Show Tool Menu | script S1 | (mouse-modifier swaps, 3.5) | needs script |

**Second tier** (bind these if there's room; none clash with the table above):
- Shift-R "Capture as Recording" → 40211 "MIDI: Insert recent retroactively recorded MIDI for armed and selected tracks". MIDI only; Logic 12's Flashback Capture of audio has no equivalent.
- Opt-Cmd-T "Split at Locators" → custom action `ACT` 40623 + 40061 ("Move time selection to loop points", "Split items at time selection or razor edit").
- Ctrl-B "Bounce Regions in Place" → 40209 "Item: Apply track/take FX to items" (partial).
- Ctrl-Cmd-B "Bounce Tracks in Place" → 40788 "Track: Render tracks to stereo stem tracks (and mute originals)".
- G → 42323.
- O "Loop Browser" → 50124 (same window as F).
- Opt-K "Key Commands" → 40605 "Show action list".
- Cmd-K "Musical Typing" → 40377 "View: Show virtual MIDI keyboard".
- Shift-D "Deselect All" → 40289.
- Opt-Z / Opt-Shift-Z "Navigation Back/Forward" → 40848 / 40762.
- Opt-, / Opt-. "previous/next marker" → 40172 / 40173.
- Cmd-Up / Cmd-Down "Zoom Vertical Out/In" → 40112 / 40111.

Undo and Save stay on REAPER's defaults: Cmd-Z 40029, Shift-Cmd-Z 40030, Cmd-S 40026.

### 3.2 Key commands, MIDI editor (section 32060)

**How keys reach the main window.** Keys that Logic uses globally (Space, Return, R, C, K, X) are bound to 40401 "Misc: Pass through key to main window", so the main bindings above apply inside the docked editor. **verify** that REAPER passes unbound keys anyway; if it does, these lines are harmless.

| Key | Logic Piano Roll command | 32060 id | REAPER action |
|---|---|---|---|
| Q | Quantize selected notes | 40469 | Quantize notes position to grid |
| Opt-Cmd-Q | Undo Quantization | 40402 | Unquantize |
| Opt-Up | Transpose +1 semitone | 40177 | Edit: Move notes up one semitone |
| Opt-Down | Transpose −1 semitone | 40178 | Edit: Move notes down one semitone |
| Opt-Shift-Up | Transpose +1 octave | 40179 | Edit: Move notes up one octave |
| Opt-Shift-Down | Transpose −1 octave | 40180 | Edit: Move notes down one octave |
| Opt-Left | Nudge left | 40183 | Edit: Move notes left one grid unit (Logic nudges by its nudge value, by default a tick, **verify**) |
| Opt-Right | Nudge right | 40184 | Edit: Move notes right one grid unit |
| Left | Select previous event | 40414 | Navigate: Select previous note |
| Right | Select next event | 40413 | Navigate: Select next note |
| Ctrl-M | Mute notes | 40055 | Edit: Mute events (toggle) |
| Cmd-G | Snap toggle | 1014 | View: Toggle snap to grid |
| Z | Zoom to fit selection / all | 40725 | View: Zoom to selected notes/CC (**verify** behaviour with nothing selected; else 40466 "View: Zoom to content") |
| Shift-D | Deselect All | 40214 | Edit: Unselect all |
| P | Hide Piano Roll | 2 | File: Close window (**verify** on a docked editor) |
| T | Tool Menu | script S1 (registered in 32060 too) | |
| Space, Return, R, C, K, X | (global keys) | 40401 | Misc: Pass through key to main window |

**Set once at install** (then 43451 "Save default configuration", REAPER 7.39+):
- 40769 "Color notes/CC by media item custom color" (Logic colours notes by region);
- 1014 snap ON.

### 3.3 Keycode support to add to `src/profiles/index.ts`

`keyCode()` today handles A–Z, 0–9, Space, Tab, Return, F-keys, Num*, Num/, "=" and "'". Logic needs:
- `,` 188 and `.` 190 (also used for Cmd-.);
- the arrows: Left 37, Up 38, Right 39, Down 40;
- optional extras: `` ` `` 192, `;` 186, `[` 219, `]` 221, Delete 46, Backspace 8.

**verify** how `reaper-kb.ini` encodes the arrows (REAPER may set an extended-key bit in the flags). Export a keymap from REAPER with one arrow binding and copy its encoding. Section 3.7 also needs mouse-wheel `KEY 255` lines.

### 3.4 Mouse modifier flags (from reaper-mechanics.md)

`mm_N`: 0 none, 1 Shift, 2 Cmd, 4 Opt, 8 Control (Mac), and sums of these. Set them live with `SetMouseModifier(context, flag, "<id> m")`, or by behaviour name (REAPER 7+). Read each value back with `GetMouseModifier` to confirm it.

### 3.5 Tool menu (T)

Logic: T opens a menu at the mouse. The left-click tool defaults to Pointer and the Cmd-click tool to Marquee in the Tracks area (Pencil in the Piano Roll, **verify**). The script `logic_tool_menu.lua` (S1) shows `gfx.showmenu` at the mouse with the items below. Choosing an item changes the left-click tool until Pointer is chosen again.

Implementation for arrange-wide selection tools: the arrange overrides (factory A = marquee items, B = razor, C = comp, D = time selection). Everything else swaps contexts with `SetMouseModifier`, saving the previous values in ExtState (the pattern in reaper-mechanics.md §1.5B).

| Logic tool (key in menu) | Arrange (section 0) | Piano Roll (MIDI contexts) | Status |
|---|---|---|---|
| Pointer (T) | 42621 "Clear arrange view override mouse modifiers", plus restore the swapped contexts | restore | yes |
| Pencil (P) | `MM_CTX_TRACK` 0 → `5 m` "Draw an empty MIDI item" | `MIDI_PIANOROLL_CLK` 0 → `4 m` Insert note; `MIDI_PIANOROLL` 0 → `1 m` Insert note, drag to extend | yes, **verify** |
| Eraser (E) | `MM_CTX_ITEM_CLK` 0 → custom action `ACT` (40528 "Select item under mouse cursor" + 40006 "Item: Remove items") | `MIDI_NOTE_CLK` 0 → `6 m` Erase; `MIDI_NOTE` 0 → `3 m`; `MIDI_PIANOROLL` 0 → `3 m` | yes, **verify** |
| Scissors (I) | `MM_CTX_ITEM_CLK` 0 → `42575 c` "Split item under mouse cursor (no change selection)" + no-move flag 1024 (7.46+) | none | yes |
| Glue (J) | `MM_CTX_ITEM_CLK` 0 → `40362 c` (glues the selection after the click) | none | partial, **verify** |
| Mute (M) | `MM_CTX_ITEM_CLK` 0 → `40175 c` "Item properties: Toggle mute" | `MIDI_NOTE_CLK` 0 → `7 m` toggle note mute | yes, **verify** |
| Solo (S) | `MM_CTX_ITEM_CLK` 0 → `41561 c` "Item properties: Toggle solo exclusive" | none | partial (Logic solos only while the mouse is held) |
| Zoom (Y) | `MM_CTX_ITEM` 0 → `48 m` marquee zoom; `MM_CTX_TRACK` 0 → `22 m` marquee zoom | none | yes |
| Marquee (R) | 42617 "Set arrange view override mouse modifiers B" (= razor edit, if the user kept REAPER's factory B; **verify** on install) | `MIDI_PIANOROLL` 0 → `10 m` marquee notes+time | yes |
| Velocity (V) | none | `MIDI_NOTE` 0 → `9 m` Edit note velocity | yes |
| Brush (B) | none | `MIDI_PIANOROLL` 0 → `22 m` Paint notes | partial |
| Gain (G) | `MM_CTX_ITEM` 0 → `20 m` adjust item volume | none | yes, **verify** id |
| Fade (A) | not needed: REAPER items always show fade handles in the top corners (= Logic's "Fade Tool click zones") | none | yes (built in) |
| Flex (X) | `MM_CTX_ITEM_CLK` 0 → `15 m` add stretch marker | none | partial (no Flex Pitch) |
| Text (Shift-T), Finger (F), Quantize (Q), Automation Select/Curve (U/W) | none | none | **no equivalent** (rename the item in item properties; envelopes edit by default) |

**Toolbar feedback.** The script sets its toggle state with `SetToggleCommandState`, which lights a "Tool" toolbar button, and stores the active tool in ExtState `assist_tool/active`. **verify** whether REAPER keeps an override across a restart; the script should re-apply the saved tool or clear it on startup.

### 3.6 Mouse conventions (Pointer tool) → REAPER mouse modifiers

All rows are **verify**. Contexts and ids are from reaper-mechanics.md §1.4. Set them by behaviour name where the id is uncertain.

| Logic gesture | Behaviour | REAPER context, flag → value |
|---|---|---|
| Click a region | select it; the playhead does not move | `MM_CTX_ITEM_CLK` 0 → `3 m` Select item |
| Shift-click a region | toggle in the selection | `MM_CTX_ITEM_CLK` 1 → `4 m` Toggle item selection |
| Drag a region | move | `MM_CTX_ITEM` 0 → `1 m` Move item (REAPER default) |
| Option-drag a region | copy | `MM_CTX_ITEM` 4 → `2 m` Copy item |
| Control-drag a region | finer snap | `MM_CTX_ITEM` 8 → `4 m` Move item ignoring snap (closest) |
| Cmd-drag (Cmd-click tool = Marquee) | range select across tracks | `MM_CTX_ITEM` 2 and `MM_CTX_TRACK` 2 → a razor behaviour if REAPER lists one in these contexts (set by name "razor", **verify**). Otherwise `19 m` / `7 m` "Select time" |
| Drag on an empty area | rubber-band select regions | `MM_CTX_TRACK` 0 → `9 m` Marquee select items |
| Click on an empty area | deselect; the playhead stays | `MM_CTX_TRACK_CLK` 0 → `3 m` Deselect all items |
| Control-Option drag | zoom to the area | `MM_CTX_TRACK` 12 → `22 m`; `MM_CTX_ITEM` 12 → `48 m` (marquee zoom) |
| Drag the lower-left/right corner of a region | resize | `MM_CTX_ITEMEDGE` 0 → `1 m` Move edge (default; REAPER's edge is the full height) |
| Drag the upper-right corner of a region | loop | no equivalent (REAPER loops by edge-dragging an item with loop source on; see L) |
| Double-click a region | open its editor | `MM_CTX_ITEM_DBLCLK` 0 → `6 m` (MIDI → editor, audio → properties; REAPER default) |
| Click in the ruler | move the playhead | REAPER default (moves the edit cursor) |
| Drag in the ruler's upper (cycle) strip | set the cycle range | Ruler left-drag "edit loop points" (set by name, **verify**) with loop unlinked from the time selection (3.8) |
| Right-click | shortcut menu | REAPER default (context menu) |
| **Piano Roll:** drag empty | rubber-band select | `MM_CTX_MIDI_PIANOROLL` 0 → `7 m` Marquee select notes |
| Click empty | deselect | `MM_CTX_MIDI_PIANOROLL_CLK` 0 → `3 m` Deselect all notes |
| Cmd-click empty (Cmd tool = Pencil, **verify**) | draw a note | `MM_CTX_MIDI_PIANOROLL_CLK` 2 → `4 m` Insert note; `MM_CTX_MIDI_PIANOROLL` 2 → `1 m` Insert note, drag to extend |
| Option-drag a note | copy | `MM_CTX_MIDI_NOTE` 4 → `7 m` Copy note |
| Shift-click a note | toggle selection | `MM_CTX_MIDI_NOTE_CLK` 1 → `4 m` |
| Click a note | select, playhead stays | `MM_CTX_MIDI_NOTE_CLK` 0 → "Select note" by name (ids 1 and 2 may be swapped, see reaper-mechanics.md) |

### 3.7 Mouse wheel and trackpad

| Logic | REAPER `reaper-kb.ini` line (`KEY 255 <code> <cmd> 0`) | Confidence |
|---|---|---|
| Wheel = scroll vertically | `KEY 255 248 989 0` (989 "View: Scroll vertically (MIDI CC relative/mousewheel)") | medium |
| Shift-wheel = scroll horizontally | `KEY 255 252 988 0` | medium |
| Option-wheel = zoom (Logic 9 manual: Option = vertical zoom) | `KEY 255 250 1000 0` (1000 "View: Zoom vertically") | low: **verify** current Logic |
| Option-Cmd-wheel = horizontal zoom (Logic 9 manual) | `KEY 255 251 990 0` (990 "View: Zoom horizontally") | low: **verify** |

- **Wheel codes.** REAPER's own Mac keymap binds plain wheel to zoom (`KEY 255 248 990 0`); this profile replaces that. Codes 249–254 are per reaper-mechanics.md.
- **Trackpad.** Two-finger scrolling should then scroll. Pinch-to-zoom: **verify** that REAPER supports it on macOS.
- **Option-drag to zoom on an empty area** is covered by Control-Option drag in 3.6.

### 3.8 Preferences

| Setting | Logic default | REAPER target | How (action first, ini key second) | Confidence |
|---|---|---|---|---|
| Stop | playhead stays where stopped | stay | Space → 40328 (no pref exists) | high |
| Second Stop click → beginning (or left locator if cycling) | yes | Return → 40042 (WALTER's `trans.stop` can't run a script) | | partial |
| Play with Cycle on | starts from the left locator | REAPER plays from the cursor and loops once it reaches the loop end | optional script S10 on Space | **verify** Logic's inside-cycle case |
| Cycle independent of the marquee/selection | yes | loop not linked to the time selection | 40750 "Options: Unset loop points linked to time selection" | high (action) |
| Edit cursor after recording | stays at the stop point | 40300 "Move edit cursor to end of recording" ON | `itemclickmovecurs` &16 | high / medium |
| Catch (follow playhead) | on | auto-scroll ON, page-wise | 40036 ON (`viewadvance` &1); 40262 ON (&2); 41817 continuous OFF (&16 clear) | high / medium |
| Snap | on, mode "Smart" | snapping ON, grid 1/16 | 1157 if `GetToggleCommandState(1157)==0`; `projgriddiv=0.25` (project default, persist 2). REAPER has no "Smart" snap that adapts to zoom: **verify** an adaptive-grid option in 40071 | medium |
| Grid lines | visible | ON | 40145 if off (`projshowgrid` &1) | high |
| Drag mode | No Overlap | trim content behind, no auto-crossfade | 41120 "Enable trim content behind media items when editing", 41119 "Disable auto-crossfades" (`autoxfade` &2 set, &1 clear) | medium |
| Click a region → playhead | doesn't move | as above | mouse modifier `MM_CTX_ITEM_CLK` (3.6) | medium |
| Click on the arrange selects the track | yes | yes | `trackselonmouse` &1 | medium |
| Metronome | "Click while recording" on; click while playing off (**verify**) | metronome on during recording only | 41745 Enable; `projmetroen` (&1 on, &2 playback, &4 record per reaper-mechanics.md; **verify** the bit sense) | low |
| Count-in | separate button; 1 bar; off by default (**verify**) | count-in before record OFF, 1 bar | `projmetroen` &16 clear; `projmetrocountin=1`. No action exists; script S3 toggles it | medium (keys) / **verify** |
| Cycle recording | Take folder (cycle on or off) | new recordings go to fixed lanes that play exclusively (closest to take folders + Quick Swipe Comping) | 43152 "Options: New recording adds lanes (new lanes play exclusively)". Alternative: 41330 takes + 40114 "Loop recording always adds takes" + 40435 show all takes | medium (**verify** the UX with a Logic user) |
| New track input monitoring | Auto Input Monitoring | record monitor auto | S6 sets `I_RECMON=2` on insert (40494 "Set track record monitor to auto/tape" on selection). `deftrackrecflags`: bits **verify** | medium |
| New track colour by type | audio blue, instrument green | same | script S6 | n/a |
| Zoom centre | playhead / selection | edit or play cursor | `zoommode=0` (REAPER default) | medium |
| Wheel | scroll; Option = zoom | 3.7 | keymap | medium |
| Mixer view | inserts, sends, master on the right | 40549, 40557, 40389 ON | toggle actions (check the state) | high |
| MIDI editor | docked; notes by region colour | `[midiedit] dock=1`; 32060 40769 + 43451 | | high / medium |
| Ruler / LCD units | bars and beats | 40367, 42360; 40411, 42366 | | high |

**Rule for these settings:** change project-scope settings (`proj*`, `loop`) only as defaults for new projects, never in the user's open project. Prefer toggle actions, after checking `GetToggleCommandState`. This follows reaper-mechanics.md §5.

### 3.9 Control bar → toolbar and transport buttons

| Logic control | Where in REAPER | Action |
|---|---|---|
| Library | main toolbar | 40271 |
| Inspector | main toolbar | script S9 (fallback 40291) |
| Smart Controls | main toolbar (optional) | 40291 (plug-in window of the current track) |
| Mixer | main toolbar | 40078 |
| Editors | main toolbar | script S5 |
| Tool (left-click tool) | main toolbar, lit when not Pointer | script S1 |
| Marquee/Razor quick toggle | main toolbar | 42618 "Toggle arrange view override mouse modifiers B" |
| Stop / Play / Record | transport | `trans.stop` / `trans.play` / `trans.rec` |
| Rewind / Forward (Logic 11 only) | transport (optional) | `trans.rew` / `trans.fwd` |
| Capture Recording | main toolbar | 40211 (MIDI only) |
| Cycle | transport | `trans.repeat` (= 1068) |
| LCD | transport | `trans.status`, `trans.bpm.edit`, `trans.curtimesig` |
| Tuner | none | **no equivalent** (could insert ReaTune on the selected track via script; out of scope) |
| Solo (region solo mode) | none | **no equivalent** (41561 is the nearest) |
| Count-in | transport custom button or toolbar | script S3 |
| Metronome | transport custom button or toolbar | 40364 |
| Master volume | none | **can't** in the transport |
| Note Pads | none | **no equivalent** (40377 virtual keyboard is the nearest) |
| Loop Browser / Browsers | main toolbar, right end | 50124 |

**Toolbar buttons and transport placement.** Toolbar buttons go into `reaper-menu.ini`, under `[Main toolbar]`. Write that file while REAPER is closed (reaper-mechanics.md §2.1, §2.5). Icons are our own `toolbar_*` art: draw new glyphs for library, inspector, editors, browsers, tool, count-in and click.

REAPER's toolbar can't be split into left, centre and right groups. Use separators, put the view buttons first and the browser buttons last.

### 3.10 Lua scripts

Install all scripts under `Scripts/ReaperAssist/`. Register them with `SCR` lines in `reaper-kb.ini`, or live with `AddRemoveReaScript`; S1 is registered in both sections 0 and 32060. Wrap every edit in `Undo_BeginBlock`/`Undo_EndBlock` with a Logic-style name.

- **S1 `logic_tool_menu.lua`** (T).
  - Hidden `gfx.init` at the mouse position, then `gfx.showmenu("Pointer|Pencil|Eraser|Scissors|Glue|Solo|Mute|Zoom|Marquee|>Piano Roll|Velocity|Brush|<|Flex")`, with the active tool prefixed by `!` (check mark).
  - For the chosen tool: restore every context saved under ExtState `assist_tool/prev|<ctx>|<flag>`, then save and apply the new tool's map from 3.5 and set ExtState `assist_tool/active`. For Pointer, also run 42621. When run from 32060, apply only the MIDI contexts.
  - Light the toolbar button with `SetToggleCommandState(sec, cmd, tool ~= "Pointer")` + `RefreshToolbar2`.
  - Logic's in-menu letter keys (T, P, E, I…): **verify** whether `gfx.showmenu` accelerators (`&`) work on macOS. If not, the mouse is the only way to pick (a modal key mode is out of scope).
- **S2 `logic_locators_by_selection.lua`** (Cmd-U). If there is a razor area, run 42474 "Razor edit: Set loop points to razor edit area". Otherwise, if items are selected, call `GetSet_LoopTimeRange(true, true, minStart, maxEnd, false)` over the selected items, leaving the time selection alone. Then `GetSetRepeat(1)`. With nothing selected, do nothing.
- **S3 `logic_count_in.lua`** (Shift-K, toolbar). Toggle `projmetroen` bit 16 (count-in before record) with `get_config_var_string`/`set_config_var_string` (REAPER 7.74+); if `projmetrocountin` is 0, set it to 1. Set the toggle state for the button. Use `persist=2` only when the user chose "make default". Before 7.74, open 40363 instead. **verify** the bit numbers live.
- **S4 `logic_new_track_same_settings.lua`** (Cmd-D). Run 40062 "Duplicate tracks" on the selection, then delete every media item on the new tracks (loop `CountTrackMediaItems` backwards, `DeleteTrackMediaItem`). FX, sends, colour, volume and pan stay. Naming: **verify** what Logic does; REAPER's duplicate keeps the source name.
- **S5 `logic_editor_toggle.lua`** (E, Editors button). If a MIDI editor is active (`MIDIEditor_GetActive()`), close it with `MIDIEditor_OnCommand(ed, 2)`. Else, if the first selected item's active take is MIDI (`TakeIsMIDI`), run 40153; if it is audio, run 40009. With nothing selected, toggle the mixer (40078).
- **S6 `logic_new_track.lua`** (variants: audio, instrument, aux). Insert with 40001 (40701 for an instrument), then set `I_CUSTOMCOLOR = ColorToNative(r,g,b)|0x1000000` from the type colours in 1.2. Audio: `I_RECMON=2` (auto), `I_RECINPUT` = first mono input. Instrument: `I_RECINPUT=6112` (4096 MIDI flag + all devices 63<<5, all channels), `I_RECMON=1`, `I_RECMODE` MIDI overdub (**verify** values). Bind Opt-Cmd-A to the audio variant; Opt-Cmd-S can move from 40701 to the instrument variant.
- **S7 `logic_quantize.lua`** (Q, main section). For each selected MIDI take, quantize the selected notes (all notes if none are selected) to the project grid: `MIDI_GetNote` → `MIDI_GetProjTimeFromPPQPos` → `SnapToGrid(0, t)` (**verify** it ignores the snap-enabled state, else compute from `GetSetProjectGrid`) → back to PPQ, moving the note end by the same delta. `MIDI_SetNote(..., noSort=true)`, then `MIDI_Sort`. Audio items: run 40316. Logic uses each region's own Quantize value; REAPER has none per item, so the grid stands in.
- **S8 `logic_input_monitor.lua`** (Ctrl-I). If any selected track has `I_RECMON==0`, set all of them to 1; otherwise set all to 0. An exact on/off, unlike 40495, which cycles through three states.
- **S9 `logic_inspector.lua`** (I). A docked `gfx` window (`gfx.dock` into the left docker, remembered in ExtState), on a deferred loop at about 15 fps that redraws only when the selection or a value changes. Region section (first selected item): name, mute, loop (`B_LOOPSRC`), transpose (`D_PITCH`, audio only), gain (`D_VOL`), fade lengths, a "Q" button that runs S7. Track section (selected track): name, volume, pan, input (`I_RECINPUT`), monitoring, arm, FX list (click = `TrackFX_Show`), sends. Drawn in the kit palette; a real channel strip can't be embedded.
- **S10 `logic_play_stop.lua`** (optional, replaces 40328 on Space). If playing or recording, run `Main_OnCommand(40328, 0)`. Else, if `GetSetRepeat(-1)==1` and the edit cursor is outside the loop range, `SetEditCurPos(loopStart, true, false)`, then `OnPlayButton()`. Otherwise just `OnPlayButton()`.

---

## 4. Corrections to the current Logic profile (`src/profiles/index.ts`)

- **M → 40175 is wrong.** In Logic, M is "Toggle Channel Strip Mute", so use 6. Item mute is Ctrl-M → 40175.
- **Space is unbound.** Add 40328. This is the most important fix.
- **Colours.** Change `item #3c9a62` (green) to `#366ca8` (the audio default; instruments are green via S6). Change `peaks #0f2a1a` to the light tint `#cce4fc`: Logic waveforms are light on a coloured body, not dark.
- **More colours.** `bg` `#1f2022` → `#2a2a2a`; lanes → `#2e2e2e`/`#2c2c2c`; `sel` → `#363636`; `ruler` → `#303030`; `rulerText` → `#d2d2d2`; `region` `#f2c94c` → neutral (the cycle yellow belongs to the loop-range key instead); `cursor`/`play` → `#fcfcfc`; `note` → `#72ae3c`.
- **Kept as-is:** R, Cmd-T, Cmd-R, X, P, C, K, Cmd-J, S, Opt-Cmd-N, Return, F, Cmd-B and Opt-' are correct.
- **Q → 40316** quantizes item *positions*, not MIDI notes. Keep it as the fallback and add S7.

## 5. Glossary additions (Logic → REAPER)

| Logic | REAPER |
|---|---|
| Tracks area | Arrange view |
| Track header | Track control panel (TCP) |
| Channel strip | Mixer control panel (MCP) / mixer strip |
| Control bar | Transport + main toolbar |
| LCD | Transport time display (status) |
| Playhead | Edit cursor (stopped) / play cursor (playing) |
| Locators / Cycle area | Loop points / repeat |
| Marquee selection / Marquee tool | Razor edit area (or time selection) |
| Region | Media item (a take inside it) |
| Arrangement marker | Region |
| Take folder / Quick Swipe Comping | Fixed item lanes / comping (REAPER 7) |
| Track Stack (summing) | Folder track |
| Folder stack (no summing) | Folder track (REAPER folders always sum) |
| Aux / Bus | A track receiving sends |
| Output (Stereo Out) | Master / parent send |
| Plug-in slot (Audio FX) | FX insert (FX chain) |
| Patch / channel-strip setting | FX chain (`.RfxChain`) |
| Library | FX browser |
| Browsers / Loop Browser | Media Explorer |
| Smart Controls | FX parameters (mixer) / plug-in window |
| Region inspector | Item properties |
| Input monitoring (I) | Record monitoring |
| Count-in | Count-in (metronome settings) |
| Catch | Auto-scroll during playback |
| Capture as Recording | Retroactive MIDI record |
| Bounce (project) | Render |
| Bounce in Place (region) | Apply FX to items / glue |
| Bounce in Place (track) | Render to stem track / freeze |
| Flex Time | Stretch markers / item playrate |
| Flex Pitch | none (third-party pitch editor) |
| Global tracks | Ruler lanes (markers, regions, tempo) |
| Key Commands window | Actions list |
| Musical Typing | Virtual MIDI keyboard |
| Event List | MIDI editor event-list mode |
| Score | MIDI editor notation mode |
| Groups (mixer) | Track grouping (40772 parameters, 40768 matrix) |
| Drummer / Session Players / Live Loops / Step Sequencer / Chord Track / Stem Splitter / Mastering Assistant | none |

## 6. Open questions to verify first

1. The order of the Logic track header (name versus buttons), and the default visibility of the volume slider and pan knob in Logic 11/12.
2. Whether WALTER `custom` buttons (with `command_id`) work in `trans` layouts and accept `_RS…` script ids. This decides whether the view buttons can live in one control-bar strip.
3. Whether `col_trans_bg` alone paints the docked transport light without lightening other surfaces.
4. Arrow-key and mouse-wheel encodings in `reaper-kb.ini`.
5. The bit meanings of `projmetroen` and live `set_config_var_string` for count-in.
6. Logic's mouse-wheel zoom modifiers today, and the Piano Roll's default Cmd-click tool.
7. Whether 41297 / 40271 toggle (rather than only show), and which `reaper.ini` keys record toolbar visibility.
8. The exact hues for Logic's meters, mute-lit blue, input-monitor orange and play-lit green. These were not sampled.

## 7. Sources

**Apple Logic Pro User Guide** (version 12.3), at `https://support.apple.com/guide/logicpro/<id>/mac`:
- Key commands: lgcp02bf31b6 (global), lgcpb99be9c5 (main window/tracks), lgcpe8314fe2, lgcp665bbccc, lgcp2dc3f212 (mixer), lgcpfa34642b (Piano Roll), lgcp0182c4e5 (tool menu), lgcp267f63a1, lgcp2a46feca.
- Interface: lgcpe9cc403a, lgcpe9cc3f60, lgcpe9cc3b1d, lgcpe9cc43f6, lgcpc788b136, lgcpe53c68af (track header), lgcpbc219210 (channel strip).
- Control bar, transport and LCD: lgcp5bdd6d9d, lgcp127f51bc, lgcp0b07c0c9, lgcpc2e497bd, lgcp2814a670.
- Settings: lgcp35dc6d37 (editing), lgcpf5b44689 (cycle), lgcp237ca5ad (catch), lgcp411dd5c8 (recording/take folders), lgcp9793a910, lgcp8e0207b2, lgcp50b91186.
- Tools: lgcp9b92f74c, lgcp5b365bf4, lgcp8b7459e4.
- Other: lgcp0534986f (metronome), lgcpf7c0f66a (snap), lgcpf7c0b924, lgcp5cbf2096 (zoom), lgcp59e41e86 (cycle), lgcp58240315 (solo), lgcp08bafdee (mute), lgcp2217b80d, lgcpa8fee137, lgcp4a62a494 (what's new in 12).

**Other sources:**
- Meters (older Apple guide): https://help.apple.com/logicpro/mac/10.1/en.lproj/lgcp8e96d97b.html
- Product screenshots (colours sampled in memory, not saved): https://www.apple.com/logic-pro/
- Mouse-wheel zoom modifiers (Logic 9 manual): https://help.apple.com/logicpro/mac/9.1.6/en/logicpro/usermanual/chapter_8_section_1.html
- Cmd-click tool = Marquee by default: https://logicstudiotraining.com/10-tips-for-faster-and-easier-arranging-with-logic-pro/
- REAPER WALTER and theme images: https://www.reaper.fm/sdk/walter/walter.php, https://www.reaper.fm/sdk/walter/images.php.
- Action ids: REAPER 7.82's action list. Config mechanics (mouse-modifier contexts and ids, `reaper.ini` bitfields, wheel codes, `set_config_var_string`): reaper-mechanics.md.
- Repo files consulted: `src/profiles/index.ts`, `src/profiles/kit/{registry,walter,art,index}.ts`, `src/shared/skins.ts`, `src/profiles/engine/workspace.ts`.
