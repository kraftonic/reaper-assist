# Studio One → REAPER research notes
These are the notes the Studio One profile was built from, checked against REAPER 7.82. They may be out of date — corrections welcome via PR.

Target: make REAPER 7.82 look, feel and work like **Studio One 6/7 in its default dark appearance**.
Deliverables: (a) a new theme kit `studioone` (our own vector artwork plus our own WALTER layout), (b) window layout, (c) shortcuts, mouse modifiers, toolbar, preferences and small Lua scripts.

**Naming.** Fender bought PreSonus and renamed Studio One to **Fender Studio Pro** (v8). `s1manual.presonus.com` now redirects to `fenderstudiopromanual.fender.com`, and that manual says "Session" where Studio One said "Song". Users still say "Studio One", so the profile keeps `daw: "Studio One"`.

**Confidence tags** used below:
- **[S]**: from an official source (the PreSonus key sheet or the Fender manual).
- **[T]**: from a reputable tutorial or a secondary source.
- **[E]**: an estimate from memory of the UI. Check these with an eyedropper or in the app.
- **verify**: must be checked before shipping.

Every REAPER action id in this spec was checked against REAPER 7.82's action list. Section 0 is the main window; section 32060 is the MIDI editor.

---

## 0. What matters most (priority order)

1. **Keys.** The default key set is the biggest "feels like home" factor. Studio One's keys are very regular: number keys pick tools, F2–F5 open views, single letters do things (D, G, Q, N, T, M, S, R, U, C, F, A, E/W/Z), and the numpad runs the transport. Section 3.2 maps nearly all of them.
2. **Tools 1–8.** Arrow, Range, Split, Eraser, Paint, Mute, Bend, Listen. REAPER has no tools, but REAPER 7 has `SetMouseModifier()` plus four "arrange view override" mouse slots (A–D). Eight small scripts can rewrite the mouse contexts so that each tool feels real (section 3.3).
3. **Window layout.**
   - Transport docked at the **bottom**.
   - Browser docked on the **right**.
   - Console (mixer) and Editor docked at the **bottom**.
   - Track headers on the left.
   - No "Inspector" in REAPER. Render it in the Assist side panel (section 2.1).
4. **Look.**
   - Near-neutral charcoal greys with a slight cool tint.
   - Flat, slightly rounded buttons with letter glyphs ("M", "S").
   - Blue for selection, active tool, loop and monitor; yellow for solo; red for record (and mute, per the current manual).
   - Horizontal pan sliders.
   - Colour shown as a strip or label, not a full-panel tint ("Colorize Track Controls" is off by default [S]).
5. **Transport behaviour.** In Studio One, Space stops *where you are* (it acts like pause) [T: Sound On Sound]. That maps to REAPER **40328** "Transport: Play/stop (move edit cursor on stop)". This one change removes a constant source of friction.

---

## 1. Look

### 1.1 Kit palette (`KitColors` roles)

Studio One exposes only Background/Arrangement colour-balance sliders and gives no hex values [S: General Options]. All hexes below are therefore **[E]**: calibrated to the existing `studioone` workflow colours and to memory of the default S1 6/7 screens.

**Verify step:** open S1/Studio Pro, choose Options → General → Appearance → **Reset** [S], screenshot, eyedrop, then adjust. These are our own values: they evoke the feel and copy no skin.

| Role | Hex | Studio One element it stands for | Conf. |
|---|---|---|---|
| bg | `#1e2124` | window chrome, toolbar strip, empty track-list area | E |
| panel | `#2a2d31` | console strip body, browser and inspector panels | E |
| track (header) | `#34383d` | track control panel, unselected | E |
| trackSel | `#464b52` | selected track header (lighter neutral, white name) | E |
| face (button) | `#3d4248` | unlit button face | E |
| line | `#17191b` | 1px separators between tracks and strips | E |
| deep | `#121416` | wells: meter background, value fields | E |
| text | `#d6d9dd` | primary text | E |
| dim | `#8d949c` | secondary text, unlit glyphs | E |
| accent | `#3a8ee6` | blue: selection, active tool, loop on, snap on | E (blue is S1's UI accent) |
| accent2 | `#f0c64a` | yellow (solo and highlights) | E |
| solo | `#f0c64a` | lit Solo: yellow | T (pcaudiolabs: global solo lights yellow) |
| **mute** (new field) | `#e0524a` | lit Mute | **verify**. Fender manual: in Dim-Solo "mute buttons … turn purple instead of red" [S], so red today. Older S1 builds may differ. |
| **monitor** (new field) | `#3a8ee6` | lit Monitor: blue fill | S (manual mirror: "This button should turn blue") |
| arm | `#e8382f` | record-arm circle, lit | E |
| play | `#4cc35e` | transport Play lit (green) | E, verify |
| onInk | `#ffffff` | ink on lit blue/red; `inkOn()` already switches to dark ink on yellow | — |
| env | keep `ENV` | automation-mode colours | — |
| display | `#141618` | time/tempo display background (dark, not LCD-coloured) | E |
| displayText | `#e9ecef` | time display digits (white); secondary line uses `dim` | E |
| knob | n/a | S1 uses sliders; knobs are only for sends (use `accent`) | — |
| meter.off | `#121416` | unlit meter | E |
| meter.low | `#3fbf5a` | green | E, verify |
| meter.mid | `#c8d43a` | yellow-green | E, verify |
| meter.high | `#f2a33a` | orange near 0 dB | E, verify |
| meter.clip | `#f0453a` | clip | E |
| notes.off | `#5b9be0` | notes take the Part (event) colour by default [S] | S (mode), E (hex) |
| notes.on | `#f2f4f6` | "Selected notes appear white" [S] | S |
| notes.bg | `#2b2f33` | piano-roll row colour that soft velocities fade toward | E |
| trim (optional) | `#f0c64a` | fader cap turns **yellow** in Trim mode [S] | S (REAPER has no trim state; skip) |

Note colour modes per the manual [S]: Part (default), Pitch, Velocity (purple low → red high), Scale (blue in, red out).

Assist panel colours (`Workflow.panel`):
- bg `#1e2124`, panel `#2a2d31`, panelAlt `#34383d`, border `#141618`
- text `#e6e9ec`, textDim `#9aa2ab`
- accent `#3a8ee6`, accentText `#ffffff`, accent2 `#f0c64a`

`panels`: track `#34383d`, master `#2a2d31`, transport `#1e2124`.

### 1.2 Arrange and editor colours → REAPER theme keys

Key names come from Default 7's `.ReaperTheme` and REAPER 7.82's built-in API/theme key descriptions. Values are **[E]**.

| REAPER key | Hex | Meaning (REAPER) → S1 look |
|---|---|---|
| `col_arrangebg` | `#25282c` | empty area below the tracks (S1: darker than lanes) |
| `col_tr1_bg`, `col_tr2_bg` | `#2b2f33`, `#2a2e32` | lanes. S1 has no zebra striping, so keep these almost equal |
| `selcol_tr1_bg`, `selcol_tr2_bg` | `#33383e` | selected track's lane, slightly lifted |
| `col_tr1_divline`, `col_tr2_divline` | `#1a1c1f` | track separators |
| `col_tl_bg` / `col_tl_fg` / `col_tl_fg2` | `#1a1c1f` / `#9aa2ab` / `#6c737b` | ruler, ruler text, minor ticks |
| `col_tl_bgsel2` | `#2c5d96` | "Timeline background (in loop points)": S1's blue loop bar in the ruler |
| `col_tl_bgsel` + `timesel_drawmode` | `#ffffff`, low alpha | Range/time selection as a light translucent overlay |
| `col_gridlines2` (bar) / `col_gridlines3` (beat) / `col_gridlines` | `#454a51` / `#33373d` / `#2e3237` | bars brighter than beats |
| `col_mi_bg`, `col_mi_bg2` | `#4d8fd6` | default event colour (blue). Tracks override with their own colour |
| `col_tr1_itembgsel`, `col_tr2_itembgsel` | `#79aee6` | selected event, lighter. **verify** S1's selected-event rendering |
| `col_tr1_peaks`, `col_tr2_peaks` | `#16314f` | waveform drawn darker than the event body (S1 style) |
| `col_tr1_ps2`, `col_tr2_ps2` | `#0f2238` | selected-event waveform |
| `col_mi_label`, `col_mi_label_sel` | `#f0f3f6`, `#ffffff` | event name, top-left inside the event |
| `col_cursor`, `col_cursor2` | `#d7dbe0` | edit cursor. S1 has one "timeline cursor"; keep the edit cursor quiet |
| `playcursor_color` | `#ffffff` | play cursor |
| `marker` / `region` | `#cfd3d8` / `#4d8fd6` | marker flags (light grey) / arranger-like sections |
| `region_lane_bg`, `marker_lane_bg`, `ts_lane_bg` | `#1a1c1f` | ruler lanes |
| `col_seltrack` | `#464b52` | selected TCP background (kit art draws this too) |
| `col_tcp_text`, `col_tcp_textsel` | `#d6d9dd`, `#ffffff` | track names |
| `midi_trackbg1`, `midi_trackbg2` | `#2b2f33`, `#25282c` | piano roll: white-key rows / black-key rows |
| `midi_trackbg_outer1`, `midi_trackbg_outer2` | `#1f2225`, `#1d2023` | outside the part |
| `midi_selpitch1`, `midi_selpitch2` | `#33404f` | row of the selected pitch |
| `midi_rulerbg`, `midi_rulerfg`, `midi_editcurs` | `#1a1c1f`, `#9aa2ab`, `#ffffff` | — |
| `midi_notebg` | `#5b9be0` | — |
| `genlist_selbg`, `col_explorer_sel` | `#3a8ee6` | lists and browser selection in blue |

The meter keys `col_vubot`, `col_vumid`, `col_vutop`, `col_vuclip`, `col_vuintcol` come from `kitIniColors` (already done by the kit system).

### 1.3 Control style (for `art.ts`)

**Buttons**
- Flat, rounded corners of about 3 base units. No gradient, no top highlight.
- Unlit: `face` with `dim` glyph. Hover: lighten by 6%. Pressed: darken.
- Lit: solid fill in the state colour (mute red, solo yellow, monitor blue, arm red) with `onInk` glyph.
- Glyphs:
  - Mute: the letter **"M"**. Solo: **"S"**.
  - Record: a filled **circle**. Monitor: a **speaker** glyph.

  Our own drawing, built from simple shapes.

**Track header**
- 4-unit colour strip at the left edge in the track colour. The panel itself stays neutral.
- Name in a flat field, no plate.
- Selected track: lighter panel and white name.

**Console fader**
- Thin dark groove, 3–4 px.
- Small flat cap, about 28×12: light-grey top face, darker body, 1px centre line. No glossy cap.
- dB value as text in a small dark box.

**Pan**
- A **horizontal slider** on both the strip and the header, with a centre tick and the value text ("C", "L23").
- S1 fills the bar from the centre outward. REAPER draws a fader as background plus thumb, so **a centre fill isn't possible**. Use a narrow thumb with a centre tick.

**Meters**
- Thin segment-free bars on `deep`; green → yellow → orange → red; peak-hold line.
- Separate channel bars with a 1px gap.

**Transport display**
- Time display: large white digits (main row about 20–22 px), with a smaller grey secondary unit.
- Tempo and signature: medium (about 14 px).

**Fonts**
- S1 uses a clean sans. Use the kit's existing `w.font()` indices.
- Sizes: track name ≈ 12 px; buttons and labels 10–11 px; strip names 11 px.

### 1.4 New kit features Studio One needs

These are changes to `kits.ts`, `art.ts` and `walter.ts`:

1. **`KitId`.** Add `"studioone"`, a `SIZES.studioone` entry and an `MCP_W.studioone` entry. Proposed sizes, all even:

   ```
   studioone: { tcpMute:[20,18], tcpBtn:[20,18], tcpSmall:[20,18], tcpFx:[24,18], tcpKnob:18, tcpThumb:[8,14],
     mcpMute:[30,18], mcpBtn:[30,18], mcpArm:[30,18], mcpSmall:[20,18], mcpKnob:22, mcpThumb:[28,12], mcpFaderW:4,
     envBtn:[20,18], envKnob:18, trans:[30,26], tap:[36,26], menu:[20,18], toolbar:28,
     tcpPan:[48,14] /*new*/, mcpPanThumb:[6,12] /*new*/ }
   MCP_W.studioone = { track: 72, master: 84 }
   ```

2. **`look`.** Add a third look, `"soft"`: flat fill, radius 3, **no outline hairline and no top highlight**, and 1px darker bottom edge only on unlit buttons. (Alternatively add `border: "none" | "hairline"` to the flat look.)
3. **Colours.** Add `KitColors.mute?` and `KitColors.monitor?`.
   - Today Ableton lights mute with `accent` and FL uses an LED.
   - Studio One needs its own mute fill, and monitor drawn as a **lit fill**, not coloured ink (S1's monitor lights solid blue). Add a flag such as `monitorLit: true`.
4. **Glyph choice.** Add `glyphs.mute: "M" | "speaker" | "led"`. Studio One uses the letter "M".
5. **Horizontal MCP pan.**
   - New images `mcp_panbg` and `mcp_panthumb` (they exist in REAPER's image list).
   - Set `mcp.pan.fadermode [-1]` and lay `mcp.pan.label` over the slider.
   - Same for `tcp.pan` (`tcp_panbg` / `tcp_panthumb` already drawn), with `fadermode [-1]`.
6. **Insert and send rows.** Draw the `mcp_fxlist_*` images (`_bg`, `_norm`, `_byp`, `_off`, `_empty`) and the `mcp_sendlist_*` images (`_bg`, `_norm`, `_mute`, `_empty`, `_knob`, `_meter`) as dark slots, so the extended mixer reads like S1's device racks. Also do the `mcp_master_*` variants.
7. **Transport custom buttons.** Use WALTER `custom trans.custom.x '' <command_id> '<desc>' <image>` (REAPER 7.0+; documented in the WALTER docs) for Metronome, Pre-roll and Edit/Mix/Browse.
   - **verify** whether a custom button reflects the action's toggle state. If it doesn't, keep these on the toolbar instead.
8. **Toolbar icons for the eight tools.**
   - Glyphs: arrow, range bracket, split blade, eraser, pencil, crossed speaker, bend marker, ear.
   - These must be **our own** drawings. Do not trace S1's icons.
   - Script toolbar buttons take icons from `<resource>/Data/toolbar_icons/`, not the theme. **verify** whether the theme can supply them; if not, write the PNGs there.

---

## 2. Layout

### 2.1 Window layout: Studio One → REAPER

| S1 element | S1 behaviour | REAPER equivalent and how to set it | Gaps |
|---|---|---|---|
| Toolbar | top of the window [S] | REAPER main toolbar (top, default). Contents in 2.5 | No snap/quantize dropdowns in a REAPER toolbar. A button opens Snap/Grid settings (40071) |
| Track controls | left of the arrange [S] | default TCP on the left (do **not** set `mixerflag` bit 32) | — |
| Inspector (F4) | left of the track controls [S] | **None in REAPER.** Recommended: render an Inspector for the selected track inside the **Assist side panel** via the bridge (name, colour, I/O, inserts, sends, volume/pan, delay, timebase). Optional ReaImGui script (needs the ReaImGui extension) | Can't dock a real per-track inspector inside REAPER's arrange |
| Browser (F5) | right of the window [S] | `WorkspacePlan.side: "right"`: Media Explorer with the FX Browser as a second tab (existing `workspaceIni`). F6/F7 open the FX browser (S1 "Instruments"/"Effects" tabs) | No unified browser. Loops/Files = Media Explorer; Pool ≈ Project Bay (41157) |
| Console (F3) | docked at the bottom; detachable (Ctrl+F3) [S] | `mixwnd_vis=1`, `mixwnd_dock=1` (mixer in docker 0 at the bottom). F3 → 40078 | REAPER's mixer and MIDI editor share the bottom docker as **tabs**; S1 swaps them in one pane (similar) |
| Main channel locked far right [S] | — | action **40389** "Mixer: Toggle show master track on right side" (ensure ON via bridge) | — |
| Editor (F2) | docked at the bottom [E] | `[midiedit] dock=1` (`WorkspacePlan.midiDocked: true`). F2 → 40153 opens the selected part; F2 inside the editor → 2 (close), so F2 toggles | Audio "Edit" view: REAPER has no docked audio editor. The arrange is used |
| Transport | **bottom** of the window [S] | `transport_vis=1`, `transport_dock=1`, `transport_dock_pos=2` (bottom of the main window) = `WorkspacePlan.transport: "bottom"` | — |
| Edit / Mix / Browse buttons | bottom right (S1 5) [T: Macworld] | custom transport buttons → 40153 / 40078 / 50124 (see 2.4) | verify the S1 7 position |
| Performance meter | transport, left [E] | REAPER performance meter is a window (40240), dockable in the bottom docker | Not inside the transport |
| Track List (left of the Inspector) | — | Track Manager (40906) is a window, not a docked list | Weak match |

Workspace plan for this profile:

```ts
{ side: "right", width: 300, transport: "bottom", midiDocked: true, tcpRight: false }
```

### 2.2 Track header: WALTER (`tcpStudioOne`)

Units are base units. `ROW1` gives kY. Studio One shows controls left of the name [E, verify against a screenshot].

| Row | Element | Rect / rule |
|---|---|---|
| all | `tcp.custom.kStrip` (colour strip) | `[0 0 4 h]`. Fill = `TRACK_FILL` if `trackcolor_valid`, else `mixc(track, dim, .25)` |
| 1 | `tcp.foldercomp` | when `folderstate==1`: `[6 kY 14 20]`. Shift the row by 16 for folders (as Ableton does) |
| 1 | `tcp.mute` "M" | `[8 kY 20 18]` |
| 1 | `tcp.solo` "S" | `[30 kY 20 18]` |
| 1 | `tcp.recarm` ● | `[52 kY 20 18]`. Hide when `w<160` |
| 1 | `tcp.recmon` (speaker) | `[74 kY 20 18]`. Hide when `w<180` |
| 1 | name field `tcp.custom.kName` + `tcp.label` | `[98 kY w-134 18]`. Flat `deep`-ish field (`darken(track,.25)`), no frame. Label colour `?track_selected [255 255 255] text`. Margin 6 |
| 1 | `tcp.fx` | `[w-32 kY 24 18]` (REAPER needs it; S1 keeps FX in the Inspector) |
| all | `tcp.meter` | `[w-6 4 4 h-8]`: a thin vertical meter on the right edge. **verify** S1's header meter position |
| 2 (h≥48) | `tcp.env` | `[8 28 20 18]` (S1 "A" = show automation) |
| 2 | `tcp.io` | `[30 28 20 18]` |
| 2 | `tcp.volume` (horizontal) | `[56 30 min(w-180,200) 14]`, `fadermode [-1]` |
| 2 | `tcp.volume.label` on `k_display` | `[w-120 28 46 18]`, centred |
| 2 | `tcp.pan` (horizontal) | `[w-70 30 48 14]`, `fadermode [-1]`. `tcp.pan.label` hidden (too small); readout appears on drag |
| 3 (h≥72) | `tcp.recinput` | `[30 52 w-64 18]` |
| 3 | `tcp.recmode` | `[w-32 52 20 18]` |
| ≥100 | `tcp.fxparm` | `[8 76 w-16 h-80]` |

Header lines: `tcp.size [300 52 200]`; `tcp_heights 4 26 52 76` (as now).
Remove `tcp.trackidx`: S1's "Show Channel Numbers in Tracks" is off by default [S].
Master TCP: same row 1 with `master.tcp.mono` in place of record arm; no record or monitor.

### 2.3 Console channel: WALTER (`mcpStudioOne`, strip 72)

An earlier plan put M/S/R/monitor under the fader, but the S1 4 release moved Mute, Solo, Arm and Monitor **to the top of each channel**, above the fader [T: Computer Music 2018]. Current Fender manual: "Panner: Horizontal" sits below the I/O display; "Automation mode … at the bottom"; "Name: at the bottom"; colour shows on the channel label by default [S].

Layout, top → bottom (kE = extended-mixer height, from the existing `extMixer()` with `top = 0`):

| Y (base units) | Element | Rect |
|---|---|---|
| 0 … kE | `mcp.extmixer` (**inserts, then sends**) | `extmixer.position [4 0 w-8 kE]`. Make sure action **40267** "Mixer: Group sends with (before/after) FX inserts" puts sends **after** inserts (verify state). `mcp_wantextmix` &1 inserts, &2 sends; turn them on with 40549 / 40557 |
| kE+2 | `mcp.recinput` (S1 "Input") | `[4 kE+2 w-8 16]`, small font |
| kE+20 | `mcp.io` (S1 "Output") · `mcp.fx` | `[4 kE+20 30 16]` · `[38 kE+20 30 16]`. REAPER can't print the output name |
| kE+40 | `mcp.mute` M · `mcp.solo` S | `[4 kE+40 30 18]` · `[38 kE+40 30 18]` |
| kE+60 | `mcp.recarm` ● · `mcp.recmon` (speaker) | `[4 kE+60 30 18]` · `[38 kE+60 30 18]`. S1 buses show Mono/Stereo here instead [T] |
| kE+82 | `mcp.pan` (horizontal) + `mcp.pan.label` (front) | `[4 kE+82 w-8 14]`, `fadermode [-1]`. Label `[4 kE+82 w-8 14]` centred, small |
| kE+100 | `mcp.volume.label` on `k_display` | `[4 kE+100 w-8 16]` |
| kE+120 … h-46 | `mcp.volume` (fader, left) | `[4 kE+120 30 h-kE-166]` (thumb 28×12, groove 4 px) |
| same | `mcp.meter` (right) | `[38 kE+124 w-42 h-kE-174]`, scale on, readout off |
| h-44 | `mcp.env` (S1 automation mode, bottom) | `[4 h-44 w-8 18]` |
| h-22 | name: `mcp.custom.kName` + `mcp.label` | `[0 h-22 w 22]`. Fill = `TRACK_FILL` (S1 colours the label), label `ON_COLOR`, centred |

Header lines: `mcp.size [72 360 0 260]`, `mcp_min_height 260 80`.

**Master ("Main" in S1):**
- Width 84.
- `master.mcp.mono` in the record-arm slot; `master.mcp.menubutton` in the monitor slot.
- Stereo meter is wider (`[38 … w-42]`).
- S1's Main also carries metronome controls [S]. REAPER can't.

**Narrow mode** (S1 "Narrow": fader overlaps the meter, M/S above the meter [S]): optional second WALTER `Layout "Narrow"` at width 40. Gate it behind a theme parameter (`define_parameter`).

### 2.4 Transport: WALTER (`transStudioOne`, docked bottom, height 40)

Studio One's left-to-right order **[E, verify against an S1 7 screenshot]**:
- performance / MIDI monitor
- time display (primary and secondary)
- loop L/R
- transport buttons: return-to-zero, rewind, forward, loop, stop, play, record
- metronome, precount, preroll, autopunch
- tempo and time signature (and key)
- Edit / Mix / Browse

| X | REAPER element | Notes |
|---|---|---|
| 8 | `trans.status` on `k_display`, 230×28 | Time display, large font (`w.font(5)`). REAPER shows the primary unit. Secondary unit **verify** (`View: Time unit for ruler: Measures.Beats / minutes:Seconds` 40366 sets the ruler dual display) |
| 246 | `trans.sel`, 220×28 (when `w≥960`) | REAPER shows time selection start/end/length. **Can't show the loop range L/R**, so label it as selection |
| centre −110 | `trans.rew` (start / return to zero) | REAPER's rew/fwd jump to the start and end of the project. Map S1 Return to Zero = rew |
| centre −76 | `trans.fwd` | to end |
| centre −38 | `trans.repeat` (loop) | lit = `accent` blue |
| centre −4 | `trans.stop` | — |
| centre +30 | `trans.play` | lit = `play` green |
| centre +64 | `trans.rec` | lit = `arm` red |
| — | `trans.pause` | `[0]`: S1 has no pause button |
| centre +104 | `trans.custom.kClick` → **40364** (metronome) | custom element with command id. Image `k_click` (3 frames). Lit state **verify** |
| centre +136 | `trans.custom.kPreroll` → **41819** "Pre-roll: Toggle pre-roll on record" | Precount has **no** REAPER toggle action. Use the metronome settings (40363) |
| centre +168 | `trans.custom.kPunch` → script `S1 Autopunch toggle` (3.6) | — |
| w−300 | `trans.bpm.tap` + `trans.bpm.edit` (tempo) | display box |
| w−224 | `trans.curtimesig` | shown when `trans_flags&4` |
| w−110 | `trans.custom.kEdit` / `kMix` / `kBrowse` → 40153 / 40078 / 50124 | 3 buttons, 34×26 |
| — | `trans.automode`, `trans.rate`, `trans.rate.fader` | `[0]` |

Header lines:
- `trans.size [1000 40]`
- `trans.size.dockedheight [40]`
- `trans.size.minmax [300 40 4000 144]`

### 2.5 Toolbar (`reaper-menu.ini`, `[Main toolbar]`)

Format: `item_N=<command id or _RS… id> <label>`, `icon_N=<icon name>` (**verify** format against a REAPER-saved file).
S1 order, left → right:

| # | Button | Command |
|---|---|---|
| 1 | Inspector | `_RS…` Assist Inspector (or a bridge call to show the Assist inspector) |
| 2 | Show automation (A) | 41151 "Envelope: Toggle show all envelopes for tracks" |
| 3–10 | Tools 1–8 | the eight tool scripts (toggle state shows the active tool) |
| 11 | Snap on/off (N) | 1157 |
| 12 | Snap/grid settings (S1 Quantize / Timebase / Snap menus) | 40071 |
| 13 | Quantize (Q) | 40316 (items) / script for MIDI items (3.6) |
| 14 | Autoscroll (F) | 40036 |
| 15 | Ripple | 1162 |
| 16 | Auto-crossfade | 40041 |
| 17 | Metronome (if not in the transport) | 40364 |

---

## 3. Function

### 3.1 Keymap encoding additions (`keyCode()` in `src/profiles/index.ts`)

New key names, with Windows virtual-key codes:

| Key name | Code |
|---|---|
| `Num0`…`Num9` | 96–105 |
| `Num+` | 107 |
| `Num-` | 109 |
| `Num.` | 110 (S1's "NumPad ,": decimal or comma key) |
| `Insert` | 45 |
| `Delete` | 46 |
| `Left`, `Up`, `Right`, `Down` | 37, 38, 39, 40 |
| `,` | 188 |
| `/` | 191 |

**Numpad Enter** may need a distinct REAPER code. **verify** by recording one binding in REAPER's Actions window.

Modifiers: S1's Ctrl = our `cmd`, S1's Alt = our `opt` (S1: "[Ctrl] on PC = [Cmd] on Mac, [Alt] on PC = [Option] on Mac" [S]).

Mac caveats:
- F-keys need Fn, unless "Use F1, F2… as standard function keys" is on.
- Cmd+Space is Spotlight.
- Laptops have no numpad; see the laptop extras below.

### 3.2 Default shortcuts → REAPER (main window, section 0)

Source for the key column: the PreSonus "Studio One 5 Key Shortcuts" sheet [S] unless marked otherwise. Win key shown; Mac = Cmd for Ctrl, Option for Alt.

**Core set (ship these; no duplicate key+mods):**

| Key (Win) | S1 command | REAPER action | Notes |
|---|---|---|---|
| Space | Toggle Start | **40328** Transport: Play/stop (move edit cursor on stop) | S1 stops in place. If the user enables S1's "Return to Start on Stop", use 40044 instead |
| Return | Start | 1007 Transport: Play | numpad Enter: verify code |
| Num0 | Stop | script **S1 Stop** (3.6); fallback 1016 | S1: a second Stop returns to start |
| Num* | Record | 1013 | — |
| Num/ | Toggle Loop | 1068 Transport: Toggle repeat | — |
| Num. | Return to Zero | 40042 Go to start of project | — |
| Num+ / Num- | Forward / Rewind | 40085 / 40084 | — |
| Num1 / Num2 | Goto Loop Start / End | 40632 / 40633 | — |
| Num3 … Num9 | Recall Marker 1…7 | 40161 … 40167 | — |
| C | Click | 40364 Options: Toggle metronome | — |
| I | Autopunch | script **S1 Autopunch toggle** (40076 ↔ 40252) | — |
| O | Preroll | 41819 Pre-roll: Toggle pre-roll on record | — |
| P | Loop Selection Snapped | script **S1 Loop selection** (3.6) | — |
| L | Locate Selection | 41173 Item navigation: Move cursor to start of items | uses the time selection when there are no items: script optional |
| Shift+N / Shift+B | Goto Next / Previous Marker | 40173 / 40172 | — |
| Insert | Insert marker | 40157 | Mac has no Insert key; see the laptop extras |
| Alt+X | Split at Cursor | 40757 Split items at edit cursor (no change selection) | 40012 splits at the play cursor during playback. **verify** which feels closer |
| Ctrl+Alt+X | Split Range | 40061 Split items at time selection or razor edit | — |
| D | Duplicate | 41295 Item: Duplicate items | — |
| Shift+D | Duplicate Shared | custom action: 41071, then 41295, then 41071 | pooled ("ghost") copy, MIDI only |
| G | Merge Events | 40362 Glue items, ignoring time selection | non-destructive alternative: 41996 (subproject) |
| Ctrl+B | Bounce Selection | 41588 Glue items, expanding to time selection if any | — |
| Q | Quantize | 40316 Item: Quantize item positions to grid… | MIDI note quantize from the arrange: script (3.6) |
| Shift+M | Toggle Mute (event) | 40175 Item properties: Toggle mute | — |
| N | Toggle Snap | 1157 Options: Toggle snapping | — |
| F | Autoscroll | 40036 View: Toggle auto-view-scroll during playback | — |
| T | Add Tracks | **41067** Track: Insert multiple new tracks… | S1 opens a dialog; 41067 is REAPER's dialog. Current profile uses 40001: change it |
| Shift+T | Remove Track | 40005 Track: Remove tracks | — |
| M | Mute (track) | 6 | overrides REAPER's default M |
| S | Solo (track) | 7 | overrides REAPER's default S (split) |
| R | Arm | 9 | — |
| U | Monitor | script **S1 Monitor toggle** (40492 ↔ 40493) | 40495 cycles off / on / auto: wrong for S1 |
| A | Show Envelopes | 41151 Envelope: Toggle show all envelopes for tracks | — |
| E / W | Zoom In / Out | 1012 / 1011 | — |
| Shift+E / Shift+W | Zoom In / Out Vertical | 40111 / 40112 | — |
| Alt+Z | Zoom Full | 40295 View: Zoom out project | — |
| Z | Toggle Zoom | 41622 View: Toggle zoom to selected items | S1 toggles to a stored zoom state; this is the closest |
| Shift+S | Zoom to Selection | 40031 View: Zoom time selection | — |
| F2 | Editor | 40153 Item: Open in built-in MIDI editor | docked editor (2.1) |
| F3 | Console | 40078 View: Toggle mixer visible | — |
| F4 | Inspector | Assist inspector (bridge) or a ReaImGui script | no native equivalent |
| F5 | Browser | 50124 Media explorer: Show/hide | — |
| F6 / F7 | Show Instruments / Effects | 40271 View: Show FX browser window | same action on both keys |
| F11 | Show Channel Editor | 40291 Track: View FX chain for current/last touched track | — |
| Ctrl+E | Export Mixdown | 40015 File: Render project to disk… | — |
| Ctrl+D | Deselect All | 40289 Item: Unselect all items | **the current profile wrongly puts Duplicate on Cmd+D** |
| Ctrl+Y | Redo | 40030 Edit: Redo | — |
| Alt+Left / Alt+Right | Nudge Back / Nudge | 40120 / 40119 | — |
| 1 … 8 | Tool 1–8 | eight tool scripts (3.3) | — |

**Extended set (optional; no clashes with the core set):**

| Key | S1 command | REAPER | Notes |
|---|---|---|---|
| Ctrl+Space | Locate Mouse Cursor | 40513 View: Move edit cursor to mouse cursor | Mac: Cmd+Space is Spotlight, so skip on macOS |
| Ctrl+T | Goto Time | 40069 | — |
| Shift+Insert | Insert Named marker | 40171 | — |
| Ctrl+Shift+X | Split Loop | custom action: 40623 then 40061 | — |
| Ctrl+Alt+B | Bounce To New Track [defkey] | 40788 Render tracks to stereo stem tracks (and mute originals) | verify fit |
| Alt+Q | Quantize 50% | script (3.6) | — |
| Shift+Q | Restore Timing | MIDI editor only (40402); arrange: script | — |
| Shift+L | Zoom to Loop | custom action: 40623 then 40031 | — |
| Alt+W / Alt+E | Undo / Redo Zoom | 40848 / 40762 | — |
| F12 | Toggle Floating Windows | 41079 | — |
| Ctrl+Shift+E | Export Stems | 40015 (choose "Selected tracks (stems)" in the dialog) | — |
| Ctrl+Alt+D | Delete Time | 40201 | — |
| Ctrl+Alt+I | Insert Silence | 40200 | — |
| Ctrl+I | Invert Selection | 41115 | — |
| Ctrl+L | Move to Cursor | 41205 | — |
| Ctrl+Alt+Left / Right | Nudge Bar Back / Nudge Bar | 40793 / 40794 (by grid) | — |
| Alt+R | Create Ranges | 40290 Time selection: Set time selection to items | — |
| Ctrl+Alt+R | Toggle Ripple Edit | 1162 | — |
| X | Create Crossfades | 41059 | — |
| Ctrl+R | Reverse Audio | 41051 | — |
| Alt+N | Normalize Audio | 40108 | — |
| Alt+F | Open Event FX Editor | 40638 | — |
| Ctrl+P | Insert Instrument Part | 40214 Insert new MIDI item… | — |
| Alt+L | Select All in Loop | 40717 (time selection) | — |
| Ctrl+G | Group Selected Tracks | 40772 Track: Set track grouping parameters… | verify fit |
| Alt+D | Duplicate and Insert | no equivalent | — |
| F8 / F9 / F10 | Loops / Files / Pool | 50124 / 50124 / 41157 (Project bay) | — |

**Laptop extras** (Assist additions, *not* S1 defaults; label them so in the UI):

| Key | REAPER | Notes |
|---|---|---|
| `,` | 40042 return to zero | some cheat sheets list "," for S1 too; verify |
| Ctrl+Shift+R | 1013 record | — |
| `/` | 1068 loop | Audeobox lists "/" for S1; verify |
| Shift+Y | 40157 insert marker | defkey lists Shift+Y as S1's alternative |

Do not ship conflicting Alt+number bindings: in S1, Alt+1…0 are "Suspend Group".

### 3.2b MIDI editor (section 32060)

S1's Note Editor tools, in order: Arrow, Range, Split, Eraser, Paint, Mute, Listen [S: Note Editor page]. That is **7 tools: no Bend**, so 7 = Listen in the editor.

| Key | S1 | REAPER 32060 action | Notes |
|---|---|---|---|
| 1 … 7 | editor tools | MIDI tool scripts (3.3) | — |
| Q | Quantize | 40469 Quantize notes position to grid | 40009 opens the dialog |
| Shift+Q | Restore Timing | 40402 Unquantize | — |
| Alt+Up / Alt+Down | Nudge up / down (transpose) | 40177 / 40178 Move notes up / down one semitone | verify step size |
| Alt+Left / Alt+Right | Nudge | 40183 / 40184 Move notes left / right one grid unit | — |
| D | Duplicate | 40882 Edit: Duplicate events | — |
| Ctrl+D | Deselect All | 40214 Edit: Unselect all | — |
| N | Toggle Snap | 1014 View: Toggle snap to grid | — |
| Shift+M | Toggle Mute | 40055 Edit: Mute events (toggle) | — |
| Alt+X | Split | 40046 Edit: Split notes | — |
| E / W | Zoom in / out | 1012 / 1011 | — |
| Shift+E / Shift+W | Zoom vertical | 40111 / 40112 | — |
| F2 | close editor (F2 toggles) | 2 File: Close window | — |
| F3, F5, Space, Num*, Num/, Num0, Num., C | pass to main | 40401 Misc: Pass through key to main window | one binding per key. Needed only where the MIDI editor otherwise eats the key: verify per key |

Other MIDI behaviour [S]:
- Double-click empty space creates a note, sized by the Quantize value; double-click a note deletes it. REAPER default: double-click in the piano roll inserts a note (verify), and double-click on a note deletes it (verify).
- Paint: drag up and down sets velocity.
- Ctrl (Cmd) switches to the Eraser; Ctrl+Shift switches to Split.

### 3.3 Tools 1–8 and mouse conventions

**Mechanism.** REAPER 7 API: `SetMouseModifier(context, flag, action)` and `GetMouseModifier`.
- Flag: 1 shift, 2 ctrl (Cmd on mac), 4 alt (Opt), 8 win (Ctrl on mac).
- Action forms:
  - a behaviour ID `"N m"`;
  - for click contexts, a command `"ID c"` or a custom action string;
  - or the unlocalised preference text, e.g. `"Move item"`.
- `-1` resets to default.

Context IDs exist for item, item click, item edge, track (empty area), MIDI note, piano roll and others. There are also four whole-arrange override slots `MM_CTX_ARRANGE_A…D`, with actions 42615–42634 (set, toggle, until next mouseup) and **42621** "Clear arrange view override mouse modifiers" (all from REAPER 7.82's built-in API descriptions).

**Design**: one library plus eight wrapper scripts (`Assist S1 Tool 1 Arrow.lua` … `8 Listen.lua`).
- On first use, save every context/flag the tools touch (via `GetMouseModifier`) into `ExtState("assist_s1","mm_backup")`.
- Each tool:
  1. restores the backup;
  2. applies its overrides;
  3. sets toggle states: its own on, the others off (`SetToggleCommandState` + `RefreshToolbar2`).
- **Restore REAPER** must call `SetMouseModifier` with the saved values. Never use `(-1,-1,-1)` blindly: that would wipe the user's own customisations.

All context and behaviour names below must be checked against REAPER's Mouse Modifiers dialog (**verify**).

| Tool (key) | S1 behaviour [S: Arrange View Mouse Tools] | REAPER mouse-modifier overrides (no modifier unless stated) |
|---|---|---|
| 1 Arrow | move/size events, fades, volume handle; drag in empty space = marquee; Shift-click adds | backup restored, plus the "S1 conventions" rows below |
| 2 Range | drag selects a range across tracks; Shift adds; double-click splits | `MM_CTX_ITEM` → "Select razor edit area"; `MM_CTX_TRACK` → "Select razor edit area"; Shift (1) → add razor area; `MM_CTX_ITEM_DBLCLK` → `"40061 c"` |
| 3 Split | click splits at the mouse (follows snap) | `MM_CTX_ITEM_CLK` → `"42575 c"` (Split item under mouse cursor (no change selection)); `MM_CTX_ITEM` drag → "Marquee select items" |
| 4 Eraser | click deletes; drag erases what it touches | `MM_CTX_ITEM_CLK` → custom action "40528 + 40006" (select item under mouse, remove). Drag-to-erase: **not native**; marquee then Delete |
| 5 Paint | draw an empty part on an instrument track; draw automation | `MM_CTX_TRACK` → "Draw an empty MIDI item"; `MM_CTX_ENVLANE` / `MM_CTX_ENVSEG` → freehand draw (verify name) |
| 6 Mute | click toggles event mute; drag mutes many | `MM_CTX_ITEM_CLK` → custom action "40528 + 40175". Drag: not native |
| 7 Bend | add and move bend (stretch) markers | `MM_CTX_ITEM_CLK` → custom action "40513 + 41842" (cursor to mouse, add stretch marker); `MM_CTX_ITEMSTRETCHMARKER` drag stays "Move stretch marker" |
| 8 Listen | hold on a track: solo it and play from there; release stops and unsolos | `MM_CTX_ITEM_CLK` and `MM_CTX_TRACK_CLK` → script **S1 Listen**. Release-to-stop needs `JS_Mouse_GetState` (js_ReaScriptAPI). Without it, a second click or Space stops and restores solo |

**S1 mouse conventions for the Arrow tool** (set once with the profile) [S: key sheet "Special Modifier Keys"]:

| S1 | REAPER context / flag → behaviour |
|---|---|
| Alt+drag event = copy | `MM_CTX_ITEM` 4 → "Copy item" |
| Ctrl/Cmd held = alternative tool (default Range [E]) | `MM_CTX_ITEM` 2 → "Select razor edit area"; `MM_CTX_TRACK` 2 → same |
| Shift after mouse-down disables snap | `MM_CTX_ITEM` 1 → "Move item ignoring snap" (REAPER reads modifiers at mouse-down: note the difference) |
| Ctrl+Alt drag = slip contents | `MM_CTX_ITEM` 6 → "Move item contents" |
| Ctrl drag instrument part = ghost copy | `MM_CTX_ITEM` 5 (Alt+Shift) → "Copy item, pooling MIDI source data" (verify name). Ctrl is taken by the alternative tool |
| Alt + resize event edge = timestretch | `MM_CTX_ITEMEDGE` 4 → "Stretch item" |
| Click in empty space does **not** move the cursor ("Locate When Clicked in Empty Space": off [S]) | `MM_CTX_TRACK_CLK` 0 → "Deselect all items" (not "…and move edit cursor") |
| Clicking an event selects it without moving the cursor [E] | `MM_CTX_ITEM_CLK` 0 → "Select item" (not "…and move edit cursor") |
| Ctrl+click on a control resets it to default | no REAPER mouse modifier for faders (REAPER: double-click resets). Mention in onboarding |
| Shift+drag on a control = fine tune | REAPER fine-tune is Ctrl/Cmd+drag (built in). Can't remap |
| Ctrl+drag on the track header duplicates the track; Alt also copies data [S] | not native. TCP drag reorders. Skip |
| Wheel scrolls vertically; Shift+wheel horizontally; Ctrl+wheel zooms vertically; Ctrl+Shift+wheel zooms horizontally [S] | Bind in the keymap: wheel → 989 (scroll vertically), Shift+wheel → 988, Ctrl+wheel → 991, Ctrl+Shift+wheel → 990. **verify** the `KEY` encoding for mousewheel by recording one in the Actions window |
| Right-click opens the tool list | REAPER right-click menus stay. Optional: `MM_CTX_ARRANGE_RMOUSE` stays marquee |

MIDI editor tools 1–7 work the same way, on `MM_CTX_MIDI_NOTE`, `MM_CTX_MIDI_NOTE_CLK`, `MM_CTX_MIDI_PIANOROLL` and `MM_CTX_MIDI_PIANOROLL_CLK`:
- Arrow: defaults.
- Range: marquee time selection.
- Split: note click → split notes at mouse (32060: 40052 "Edit: Split notes at mouse cursor").
- Eraser: click → delete note.
- Paint: piano-roll drag → "Insert note, drag to extend" (verify name).
- Mute: click → custom action that selects the note under the mouse, then 40055.
- Listen: script.

### 3.4 Drag and drop

| S1 habit | REAPER today | Action |
|---|---|---|
| Drag an instrument from the Browser to empty space → new instrument track | Drag an FX from the FX Browser onto empty TCP or arrange space → REAPER creates a track with that FX (verify for instruments). REAPER also prompts for multi-out instruments (per REAPER's preference text) | Optional bridge hook: when a new track's first FX is an instrument, set its input to MIDI All, monitor **on**, and turn on "automatic record-arm when track selected" (40737). That copies S1's "Instrument Input follows Selection" option [S] |
| Drag a loop or file from the Browser | Media Explorer drag works; dropping below the last track creates a track | none |
| Drag an event up or down across tracks; a new track is created if none exists [S] | REAPER creates tracks when items are dragged below the last track (pref "automatically delete empty tracks created by dragging items below the last track") | none |
| Alt+drag to copy, Shift for no snap | see 3.3 | set mouse modifiers |
| Drag a plug-in onto a channel or track | native | none |

### 3.5 Preferences

Set these through the **bridge** using toggle actions, reading the toggle state first (`GetToggleCommandState`), rather than unverified `reaper.ini` keys. Only use `reaper.ini` keys this repo already writes and has verified.

| Behaviour | S1 default | REAPER setting | How | Conf. |
|---|---|---|---|---|
| Stop behaviour | stops in place (pause-like); "Return to Start on Stop" option off; Alt+Num0 toggles [T] | Space → 40328 | keymap | T |
| Loop range independent of the Range selection | separate loop L/R | **unlink**: 40750 "Options: Unset loop points linked to time selection" | action | E |
| Snap | on, adaptive grid [E] | 1157 ON; grid 1/16 (40776) or measure | action | E |
| Autoscroll (F) | verify default | 40036 match S1 | action | verify |
| Metronome (C) | off [E] | 41746 (disable) | action | E |
| Pre-roll / precount | off | 41819 state off. Precount = count-in in metronome settings (40363) | action / dialog | E |
| Record mode | normal; autopunch off (I) | 40252 normal | action | E |
| Recording over existing material | S1: "Record Takes To Layers" option, "Expand Layers After Recording Takes" on [S] | REAPER 7 takes → fixed lanes: 41329 "Options: Toggle new recording adds lanes in layers" (verify fit) | action | verify |
| Crosshair cursor for tools | on [S] | no REAPER equivalent | — | S |
| Locate on empty click | off [S] | mouse modifier (3.3) | script | S |
| Colorize track controls | off: small swatch only [S] | kit strip (2.2) | theme | S |
| Show channel numbers in tracks | off [S] | no `tcp.trackidx` | theme | S |
| Auto-colorize tracks | on [S] | bridge colours new tracks from **our own** palette (not S1's) | bridge | S |
| Master on the right | always [S] | 40389 ON | action | S |
| Mixer: show inserts and sends | Large console shows the racks [S] | 40549 ON, 40557 ON | action | S |
| Transport at the bottom, mixer and editor docked, browser on the right | — | `transport_dock_pos=2`, `mixwnd_dock=1`, `[midiedit] dock=1`, docker right | `src/profiles/engine/workspace.ts` (verified keys) | S |
| New track defaults | Add Tracks dialog (count, type, input, colour) | 41067 dialog. Record monitoring on for instrument tracks: bridge hook (3.4) | — | E |
| Mousewheel | as 3.3 | keymap wheel bindings | keymap | verify |

### 3.6 Scripts and custom actions (exact behaviour)

**Custom actions (macros).** No script needed: write them as `ACT` lines in `reaper-kb.ini` and bind them like any other action.

| Name | Steps (main section) |
|---|---|
| S1 Duplicate Shared | 41071 → 41295 → 41071 |
| S1 Split Loop | 40623 → 40061 |
| S1 Zoom to Loop | 40623 → 40031 |
| S1 Erase under mouse | 40528 → 40006 |
| S1 Mute under mouse | 40528 → 40175 |
| S1 Bend marker at mouse | 40513 → 41842 |

**Lua ReaScripts** (each one is a single undo block, and each sets its toggle state where relevant):

1. **S1 Stop** (Num0).
   - If playing or recording: stop and leave the edit cursor at the stop position (40328 semantics). Use `OnStopButton()`, then `SetEditCurPos(play position)`.
   - If already stopped: go to the project start (40042). S1's second stop "returns".
2. **S1 Autopunch toggle** (I). If the record mode is time-selection auto-punch (`GetToggleCommandState(40076)==1`), run 40252; otherwise run 40076. Report the toggle state so the toolbar or transport button lights.
3. **S1 Loop selection** (P).
   - If a razor area exists, set the loop to its time span.
   - Else, if a time selection exists, run 40622.
   - Else, if items are selected, run 41039.
   - Snap both ends to the grid (`SnapToGrid`) for "Snapped".
   - Turn repeat on (1068) if it's off (S1's loop activates). **verify** that S1 activates the loop on P.
4. **S1 Monitor toggle** (U). For each selected track: if `I_RECMON` is 0, set it to 1; otherwise set 0 (40493 / 40492 semantics).
5. **S1 Quantize MIDI** (used by Q when the selected items are MIDI). For each selected MIDI take, quantize note starts to the project grid with `MIDI_GetNote` / `MIDI_SetNote` and `MIDI_GetProjQNFromPPQPos`; keep lengths; then `MIDI_Sort`. Audio items fall through to 40316.
6. **S1 Quantize 50%** (Alt+Q). Same as 5, but move each note halfway to the grid.
7. **S1 Restore Timing** (Shift+Q, arrange). Run 32060 action 40402 "Unquantize" on each selected MIDI take via `MIDIEditor_OnCommand` with the editor open, or keep a pre-quantize copy in the take's ExtState. **verify** approach.
8. **S1 Listen** (tool 8).
   - On click: remember the solo states; select the track under the mouse (41110); unsolo all (40340); solo it (40728); move the cursor to the mouse (40513); play (1007).
   - Defer-loop until the mouse is released (`JS_Mouse_GetState`), then stop and restore the solo states.
   - Without js_ReaScriptAPI: stop and restore on the next run or on transport stop.
9. **Tool scripts 1–8** and **MIDI tool scripts 1–7**: see 3.3.
10. **Inspector** (F4). Preferred: Assist panel. Show the last-touched or selected track: name, colour, input/output (`I_RECINPUT`, sends via `GetTrackNumSends`), FX list (`TrackFX_GetCount` / `GetFXName`), volume/pan (`D_VOL` / `D_PAN`), delay (FX-free: `D_PLAY_OFFSET` if available, verify), timebase (`C_BEATATTACHMODE`). Fallback without Assist: ReaImGui window docked left.

---

## 4. Glossary additions (S1 term → REAPER)

| Studio One | REAPER |
|---|---|
| Song (Studio Pro 8: Session) | project |
| Event / Audio Event | item |
| Instrument Part | MIDI item |
| Shared copy (Duplicate Shared) | pooled ("ghost") MIDI item |
| Merge Events / Bounce Selection | Glue (render), or move to subproject for non-destructive merging |
| Bounce to New Track / Transform to audio | Render tracks to stem tracks / Freeze |
| Range tool / range | razor edit area, or time selection |
| Loop range (L/R locators) | loop points (unlinked from the time selection in this profile) |
| Timeline cursor | edit cursor (and play cursor) |
| Inspector (F4) | Assist Inspector in the Assist panel; Track routing (I/O) and FX chain windows |
| Console | mixer |
| Channel Editor (F11) | FX chain window |
| Insert / Send device rack | FX inserts / sends in the extended mixer |
| Bus channel / FX channel | a track that receives sends |
| VCA channel | VCA leader in track grouping |
| Main (output) | master track |
| Browser: Instruments / Effects | FX Browser |
| Browser: Loops / Files | Media Explorer |
| Browser: Pool | Project Bay |
| Music Editor / Note Editor (F2) | MIDI editor (docked at the bottom) |
| Velocity lane | CC lane "Velocity" |
| Part Automation | MIDI CC lanes / take envelopes |
| Bend markers / Bend tool | stretch markers |
| Layers (track layers) | fixed item lanes / takes |
| Event FX | take FX |
| Arranger track (sections) | regions on the ruler (no drag-to-reorder sections without a script) |
| Marker track | markers (ruler marker lane) |
| Tempo track | master tempo envelope / tempo markers |
| Signature / Key track | time-signature markers / MIDI editor key snap |
| Autopunch / Preroll / Precount | time-selection auto-punch / pre-roll / count-in |
| Snap / Quantize value / Timebase | snapping / grid / timebase (item and track timebase) |
| Macros | custom actions |
| Track Presets | track templates |
| Groups (track groups) | track grouping |
| Scratch Pad | no twin: use a second project tab or extra fixed lanes |
| Project page (mastering) / Show page | no twin: a separate mastering project / no equivalent |
| Listen bus / Cue mix | monitoring FX chain / sends to a headphone output |

Also correct the existing `studioone` glossary entry "Arranger track → regions on the ruler" (fine), and add the entries above.

---

## 5. Do not copy

- No PreSonus, Fender or Studio One / Studio Pro **logos or names** in any artwork, theme name, image or splash. Use "REAPER Assist: Coming from Studio One" only as text saying who the profile is for.
- No icons traced or reproduced pixel for pixel: the tool icons, the transport glyphs and S1's distinctive arrow/range/split/bend icons must be drawn from our own simple shapes.
- No S1 track or event colour palette copied swatch by swatch. Use our own palette with a similar feel.
- No S1 key-command template files, `.keyscheme`, macros, presets, sounds, loops or bundled plug-ins. No screenshots shipped in the product.
- No S1 fonts.
- The sole exception is shortcut *functionality*: it is a feature mapping, not trade dress. We still write our own keymap; we don't ship S1's file.

---

## 6. Open items: verify before shipping

1. Mute colour in S1 7: red (current manual) or blue (older builds)? Settle it with a screenshot.
2. Track-header control order (buttons before or after the name; meter position) and the S1 7 transport order. The Edit/Mix/Browse location may have changed after S1 5.
3. All palette hexes (section 1): eyedrop on S1 7 after Appearance → Reset.
4. Whether WALTER `custom` transport buttons show the action's toggle (lit) state.
5. Mouse-modifier behaviour names, and the `MM_CTX_ARRANGE_A…D` semantics (whole-arrange override). Read them with `GetMouseModifier` on a clean REAPER.
6. Encodings in `reaper-kb.ini` for Numpad Enter and for mousewheel bindings.
7. The `reaper-menu.ini` toolbar item and icon format, and whether a theme can supply toolbar icons for scripts.
8. Whether F3, F5 and Space get through from the MIDI editor without 40401 bindings.
9. S1's default Autoscroll state, and whether P also activates looping.
10. The existing `studioone` profile in `src/profiles/index.ts` needs fixes:
    - Cmd+D is Deselect All in S1, not Duplicate (Duplicate is plain **D**).
    - T should be 41067 (the dialog), not 40001.
    - Space should be 40328.
    - Add the numpad transport and the F2/F4/F5/F11 views.

---

## 7. Sources

- PreSonus, *Studio One 5 Key Shortcuts* sheet (official, 2020; the key column in 3.2): https://pae-web.presonusmusic.com/downloads/products/pdf/STUDIO_ONE_-_KEY_COMMANDS_SHEET.pdf
- Fender Studio Pro manual (formerly the Studio One manual; `s1manual.presonus.com` redirects there):
  - Arrange View Mouse Tools: https://fenderstudiopromanual.fender.com/en/Content/Editing_Topics/Arrange_View_Mouse_Tools.htm
  - Note Editor: https://fenderstudiopromanual.fender.com/en/Content/Editing_Topics/Note%20Editor.htm
  - Navigating With Zoom: https://fenderstudiopromanual.fender.com/en/Content/Editing_Topics/Navigating_With_Zoom.htm
  - The Console: https://fenderstudiopromanual.fender.com/en/Content/Mixing_Topics/The_Console.htm
  - Advanced Options: https://fenderstudiopromanual.fender.com/en/Content/Setup_Topics/Advanced_Options.htm
  - General Options (Appearance): https://fenderstudiopromanual.fender.com/en/Content/Setup_Topics/General_Options.htm
  - Customization (toolbar top, transport bottom, inspector and track controls left, browser right): https://fenderstudiopromanual.fender.com/en/Content/Setup_Topics/Customization.htm
- defkey, Studio One 5.4 shortcuts (cross-check; also Bounce to New Track Ctrl+Alt+B, Insert-marker alternatives): https://defkey.com/studio-one-5-shortcuts
- Packt, *The Ultimate Studio One Pro Book*, "Exploring the editing tools" (tool order; 7 Bend, 8 Listen): https://subscription.packtpub.com/book/business-and-other/9781803241012/10/ch10lvl1sec42/exploring-the-editing-tools
- PCAudioLabs, Record and Monitor buttons (monitor lights blue): https://pcaudiolabs.com/record-and-monitor-buttons-in-studio-one/
- PCAudioLabs, Global Solo/Mute (solo yellow): https://pcaudiolabs.com/how-to-use-global-solo-mute-in-studio-one-4/
- PCAudioLabs, Customization Editor in Studio One 6: https://pcaudiolabs.com/customization-editor-in-studio-one-6/
- Computer Music via PressReader, "Customising Studio One 4's GUI" (M/S/Arm/Monitor moved to the top of console channels): https://www.pressreader.com/australia/computer-music/20180808/283025465451269
- Macworld, Studio One 5 review (Edit/Mix/Browse at bottom right): https://www.macworld.com/article/234617/studio-one-5-professional-revieww.html
- Sound On Sound, Studio One session navigation ("Return to Start on Stop", play/stop acts like pause): https://www.soundonsound.com/techniques/studio-one-session-navigation
- Wikipedia, Studio Pro (rename to Fender Studio Pro): https://en.wikipedia.org/wiki/Studio_Pro
- Secondary only (contains errors; used to cross-check): https://www.audeobox.com/learn/studio-one/studio-one-keyboard-shortcuts-cheat-sheet/, https://tutorialtactic.com/blog/presonus-studio-one-shortcuts/
- REAPER-side facts:
  - REAPER 7.82's action list
  - the WALTER docs (WALTER `custom` elements, `mcp_wantextmix`, fadermode)
  - REAPER's theme image list (`mcp_panbg`, `mcp_fxlist_*`, `mcp_sendlist_*`)
  - REAPER 7.82's built-in API/theme key descriptions (`SetMouseModifier` docs, `MM_CTX_*` contexts, theme key descriptions)
  - Default 7 `.ReaperTheme` key names
