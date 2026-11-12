# Pro Tools → REAPER research notes
These are the notes the Pro Tools profile was built from, checked against REAPER 7.82. They may be out of date — corrections welcome via PR.

Target: Avid Pro Tools 2024.10–2025.10, default **Dark** theme (introduced in 2020.11; the older grey look is now "Classic").
Related source files: `src/profiles/index.ts`, `src/shared/skins.ts`, `src/profiles/kit/{registry,walter,art,index}.ts`,
`src/profiles/engine/workspace.ts`. Shared notes: `reaper-mechanics.md`. Every action id was checked against
REAPER 7.82's action list. Section 0 = Main, 32060 = MIDI editor, **A1** = "Main (alt-1)".

**Tags.** **M** = sampled from an official Avid Dark-theme screenshot (What's New 2024.10 cover, pp. 14/39/41; What's New
2025.10 p. 22), using the dominant colour of a region. **D** = documented in the Avid Reference Guide or Shortcuts Guide
2025.10. **E** = estimate. The screenshots are scaled marketing images, so treat M values within about ±8 per channel.
**verify** = check on a live system before shipping.

---

## 0. What matters most

1. **Palette.** Pro Tools is a neutral charcoal theme with no blue tint. Headers are `#2d2d2d`, lanes mid-grey `#505050`,
   toolbars `#242424`, and every counter and readout is green digits on black (`#42ef8c` on `#000`). Today's profile
   (`#25272c` blue-slate, `#5f6fc9` items) reads as "not Pro Tools" at a glance.
2. **Track buttons.** Each button is a **lettered** box (R I S M). Lit colours carry the meaning: Record red,
   TrackInput green, Solo yellow, Mute orange. Today's kits draw icons or LEDs, so the art needs a letter-glyph mode.
3. **Clips.** A clip is a dark fill in the track colour with a light waveform in the same hue. A selected clip
   inverts to a bright fill with a dark waveform.
4. **⌘= toggles Edit ↔ Mix.** The Mix window is a separate, full-size window, not a docked panel. Use 40078 with the mixer undocked.
5. **Edit modes F1–F4.** These run a mode script that sets REAPER's ripple and snap options (Shuffle = ripple per track, Slip = no
   snap, Grid = snap, Spot = clicking a clip opens a "spot to" dialog). Tools F5–F10 and ⌘1–⌘7 switch mouse maps with
   `SetMouseModifier`. The **Smart Tool** is the default map: top half selects (razor + time), bottom half grabs, edges trim,
   corners fade.
6. **Keyboard Focus (⌘⌥1)** maps to REAPER's native "Main (alt-1)" key section (action 24803). Single-letter commands
   live there.
7. **Fix the existing profile.** Consolidate is **⌥⇧3**, not ⌘⌥⇧3. Use 41588, which expands to the selection as Consolidate
   does, not 40362. On macOS REAPER writes punctuation keys as character codes (`KEY 8 61` for ⌘=), so check
   `KEY 9 187` (§3.1).
8. **Gaps REAPER cannot close.** Post-roll, a second (sub) counter, grid and nudge value displays, the fixed A–J insert and send
   slots, per-strip group, Voice and comments rows, the Online and Dynamic Transport modes, and real playlists (fixed item lanes come close).

---

## 1. Look

### 1.1 `KitColors` for a new kit `"protools"`

| Role | Hex | Pro Tools element | Tag |
|---|---|---|---|
| `bg` | `#1c1c1c` | Empty area below the last track, and the docker / empty mixer area | M |
| `panel` | `#242424` | Edit toolbar, Mix-window strip body, Transport window | M |
| `track` | `#2d2d2d` | Edit-window track header | M |
| `trackSel` | `#333333` | The header barely changes. Selection shows on the **name plate** (see `nameSel`) | E verify |
| `face` | `#6b6b6b` | R/I/S/M button face at Medium height. Small heights use `#4c4c4c` | M |
| `line` | `#393939` | Dividers, the Inserts header bar, and frames between header columns | M |
| `deep` | `#141414` | Recessed wells, meter backs, and the shadow line of bevelled buttons | E |
| `text` | `#e0e0e0` | Button letters, track names, white "I/O" and "AUTO" labels | M |
| `dim` | `#a0a0a0` | Ruler numbers and popup text (`#c4c4c4` on popups) | M |
| `accent` | `#1e78b4` | Lit edit mode and tool buttons, and the stop button when lit (measured `#1e6e9a`–`#30a0e1`) | M/E |
| `accent2` | `#42ef8c` | Counter digits and green readouts (dimmer variant `#278c50`) | M |
| `solo` | `#e8cf2e` | Solo button lit (yellow) | D colour, E hex |
| `arm` | `#e8402f` | Record-enable lit. The Transport record button lit is `#ff3939` | D/M |
| `play` | `#6af9ab` | Transport Play lit (green) | M |
| `onInk` | `#111111` | Letter colour on a lit yellow, orange or green button | E |
| `display` | `#000000` | Counter wells and volume/pan readout boxes | M |
| `displayText` | `#42ef8c` | Counter and readout digits | M |
| `knob` | `#2a2a2a` body, `#bababa` ring | Mix pan knob | M |
| `notes` | off = track colour (default `#4090b8`), on `#a8d8f0`, bg `#505050` | MIDI notes and editor background | M / E (on) |
| `meter` | off `#262909`, low `#10d808`, mid `#d8dc2a`, high `#f2a52a`, clip `#e8231b` | Unlit meter (dark olive), green, then yellow and orange near the top, then red clip LED | M (off, low) / E rest verify |
| `env` | read `#54a864`, touch `#e0b030`, write `#e0453a`, latch `#b070d8`, preview `#6aa0d8` | Coloured text of the automation-mode popup | M (read) / E rest verify |

New fields needed (Pro Tools needs these and `KitColors` doesn't have them):

| New field | Hex | Use | Tag |
|---|---|---|---|
| `mute` | `#f08c1e` | Mute lit (orange). Today mute reuses `accent` | D colour, E hex |
| `input` | `#3cc85a` | TrackInput ("I") lit green | D colour, E hex |
| `recOff` | face `#6b5d5c`, glyph `#d6d0d0` | Record-enable off: reddish-grey face with a light circle | M |
| `popup` / `popupText` | `#545454` / `#c4c4c4` | Selectors such as Playlist ▾, "waveform", "dyn", "read", I/O and group popups | M |
| `nameField` | `#202020` + 1 px outline `#0f38ba` | Track name field (unselected) | M |
| `nameSel` / `nameSelText` | `#e3e3e3` / `#1a1a1a` | Selected track name plate: light, with dark text | M verify |
| `frame` | `#493d13` | Dark-gold hairline frames that group toolbar clusters | M |
| `clipLed` | `#e8231b` (internal >0 dBFS: `#e8cf2e`) | Meter clip indicator. Red = converter or file clip, yellow = internal overload | D |

### 1.2 Edit window → `reaperColors()` and `.ReaperTheme` keys

| Key (REAPER) | Value | Pro Tools element | Tag |
|---|---|---|---|
| `col_arrangebg` | `#1c1c1c` | Area below tracks | M |
| `col_tr1_bg` / `col_tr2_bg` | `#505050` / `#4d4d4d` | Track lane (playlist area). Pro Tools doesn't alternate, so keep the difference tiny | M |
| `selcol_tr1_bg` / `selcol_tr2_bg` | `#585858` | Lanes of selected tracks | E verify |
| `col_tl_bg` / `col_tl_fg` / `col_tl_fg2` | `#232323` / `#a0a0a0` / `#7a7a7a` | Rulers: background, numbers, and secondary units | M |
| `col_tl_bgsel` / `col_tl_bgsel2` | `#3d6fa6` / `#6f9fd8` (drawmode about 50 % alpha) | Timeline selection in the ruler, and edit selection over lanes (blue tint) | E verify |
| `areasel_fill` / `areasel_outline` | `#6f9fd8` (~35 %) / `#a9c8ee` | Razor area = Selector "edit selection" | E |
| `col_gridlines` / `2` / `3` | `#5a5a60` bar · `#55555a` beat · `#525256` sub | Grid lines are only a little lighter than the lane | M (bar) / E |
| `col_mi_bg` / `col_mi_bg2` | `#2a3a44` | Clip fill when untinted (dark blue) | M |
| `col_tr1_peaks` / `col_tr2_peaks` | `#5590b2` | Waveform (light tint of the clip hue) | M |
| `col_tr1_itembgsel` / `col_tr2_itembgsel` | `#468ebd` | Selected clip: bright fill | M |
| `col_tr1_ps2` / `col_peaksedgesel` | `#223a47` | Selected clip: dark waveform | M |
| `col_mi_label` / `col_mi_label_sel` | `#e0e0e0` / `#101010` | Clip name text | E |
| `col_cursor` / `col_cursor2` | `#e8e8e8` | Edit insertion cursor. Pro Tools makes it flash; REAPER can't | D/E |
| `playcursor_color` | `#f0f0f0` | Playback cursor, a solid line. Pro Tools' ruler locator is red when armed and blue otherwise | D, hex verify |
| `marker` / `marker_lane_bg` | `#e6ca29` / `#2b2b2b` | Marker glyph, and the thin line through all tracks (line about `#d8b43a`) | M |
| `region` / `region_lane_bg` | `#6c4c1c` / `#2b2b2b` | New memory-location colour defaults to amber. Ruler bands take the marker colour | M |
| `col_vubot` / `col_vumid` / `col_vutop` / `col_vuclip` / `col_vuintcol` | from `meter` above; `col_vuintcol` `#262909` | Meters | M/E |
| `midi_trackbg1` / `midi_trackbg2` / `midi_notebg` | `#505050` / `#444444` / `#4c4c4c` | Piano-roll rows for white and black keys, and the velocity lane | M |
| `col_main_text2`, `col_tracklistbg`, `col_mixerbg`, `docker_bg` | `#e0e0e0`, `#1c1c1c`, `#242424`, `#1c1c1c` | Window chrome | M |

Clip colouring: Pro Tools colours clips by track by default (dark fill, light waveform of the same hue). In the theme's
`rtconfig.txt`, set `tinttcp` so item backgrounds and peaks are tinted by track colour, but the TCP background and the
name-label background are not. The bit meanings are in `reaper-mechanics.md` §4.2, and the inverted peak bit needs checking (verify).
Turn on REAPER's "draw labels above items" so clips get a name bar, as Pro Tools has (pref key verify).

**Track colour palette.** Pro Tools' palette is 23 hues × 3 brightness rows. Ship **our own** 24-hue palette instead:
evenly spaced hues, mid row S≈0.70 V≈0.72, dark row V×0.55, light row S×0.6. This gives a similar spread without
copying Avid's swatch values. Assign colours automatically to new tracks (Pro Tools' default) via the bridge
(verify a REAPER pref exists before scripting it).

### 1.3 Control styles

| Control | Pro Tools style | Kit art |
|---|---|---|
| R / I / S / M | Square-ish boxes about 22×16 with a centred bold capital letter. Off: grey face `#6b6b6b`, letter `#e0e0e0`. On: full colour fill (arm, input, solo, mute) with `onInk` letter. Record off is reddish-grey with a light **circle** instead of a letter | New `glyph: "letter"` in `art.ts` `button()`; recarm uses a circle glyph |
| Selectors (Playlist ▾, view "waveform", "dyn", automation "read") | Flat `#545454` pill, radius about 2, `#c4c4c4` text, small ▾ on the right. The automation text takes the mode colour | `track_env*` / `mcp_env*` images with the **word** drawn in: `track_env` = "trim" dim, `_read` "read" green, `_touch`, `_latch`, `_write`, `_preview` |
| Name field | `#202020` box with a 1 px blue outline. Selected: light plate, dark text | `k_nameplate` variant, switching on `track_selected` |
| Mix fader | Thin dark slot with a ribbed **grey cap**, no coloured fill. dB scale to the left (+12, +6, 0, 5, 10, 15, 20, 30, 40, 60) | `mcp_volthumb`: grey cap with 3 ridges. `vTrack`: dark slot. Scale marks as in `ABL_MARKS` |
| Pan knob | Small dark knob, light ring `#bababa`, white pointer. Stereo tracks show **two** knobs (L/R) | `knob()` with ring; second knob = `mcp.width` (§2.3) |
| Meters | Dark olive when unlit, green bar, yellow and orange near the top, separate clip LED box on top, green hash mark at 0 dB. Peak hold 3 s | `meterLook()` with off/low/mid/high/clip; clip LED = the meter's clip area |
| Counters / readouts | Black well, bright green monospaced digits. Volume/pan readouts in Mix and Edit I/O look the same, smaller | Existing `k_display` with `display`/`displayText` |
| Toolbar | `#242424`, clusters in thin gold frames. Edit-mode block is a 2×2 grid of text buttons: green labels, blue fill when active | Toolbar chrome images (`toolbar_blank` etc.) + our own icons (§3.10) |
| Corners and depth | Nearly flat. A 1 px lighter top edge and a darker bottom edge, radius 2 | New `look: "bevel"` (flat + 1 px highlight/shadow) |

**Fonts.** Use a neutral sans: REAPER's bundled Inter, or the system UI font. Do not use Avid's font files. At 100 %:
track name 11 px semibold; button letters 10 px bold; popups 10 px; ruler 10 px; main counter 22 px (WALTER font
slot 5); sub-displays (Start/End/Length, tempo) 12 px; Mix labels ("I/O", "AUTO") 9 px bold caps; readouts 10 px.

---

## 2. Layout

### 2.1 Edit window map

```
┌ toolbar: [SHUF|SPOT / SLIP|GRID] [zoom] [tools ×7] [a-z] │ transport: [MAIN COUNTER] [start/end/len] [tempo|meter] [RTZ REW FF END ■ ▶ ●] [loop] ┐
├ Tracks/Groups list (left docker) ┬ rulers (bars|beats + min:sec, markers) ──────────────────────────────┬ Clips list (right docker) ┤
│ track manager / group manager     │ TCP: [colour|name ▾playlist|R I S M|waveform▾ read▾] [meter] [inserts]  [I/O]│ lanes…       │ project bay   │
└───────────────────────────────────┴──────────────────────────────────────────────────────────────────────────┴───────────────┘
   MIDI editor floats. ⌘= swaps to the Mix window (REAPER mixer, undocked and maximised)
```

| Pro Tools element | REAPER equivalent | How | Gap |
|---|---|---|---|
| Edit window | Arrange view | default | none |
| Tracks list + Groups list (left, toggled together) | Track Manager (40906) + Track group manager (40327) in a **left docker** | `[REAPERdockpref]` idents verify (run 40906, `Dock_UpdateDockID`, read the ident back) | Not a slim list. Track Manager is a table |
| Clips list (right) | Project Bay (41157) in a **right docker** | `[projbay_0] wnd_vis=1`, dock ident verify | Lists media and items rather than Pro Tools clips |
| Workspace / browser (⌥;) | Media Explorer (50124) | existing `WorkspacePlan` | none |
| Rulers (Bars\|Beats, Min:Secs, Tempo, Meter, Markers) | One ruler + 7.x ruler lanes | 40366 "Measures.Beats / minutes:Seconds", markers/regions lanes visible | One timeline with a secondary unit, not separate rulers |
| Universe view | Navigator (40268), optional, docked top | — | Not inline |
| Edit toolbar | Main toolbar (rebuilt) docked top + transport docked top | `transport_dock_pos=3` (top) | Two strips, not one bar |
| Mix window (⌘=) | Mixer **undocked**, maximised | `mixwnd_vis=0`, `mixwnd_dock=0`, `mixwnd_max=1` (verify the key) | REAPER draws it as a floating window, not a sibling main window |
| MIDI Editor (⌃=) | Built-in MIDI editor, floating | `[midiedit] dock=0` (docked variant ⌃⌥⇧= → `dock=1`) | none |
| Big Counter (⌘Num3) | Big clock (40378) | — | none |
| Memory Locations (⌘Num5) | Region/marker manager (40326) | — | none |
| Track height menu (micro … extreme) | `tcp_heights` + 41325/41326 | §2.2 | No named heights |

`WorkspacePlan` additions: `mixer: "window" | "docked"`, `left?: ("trackmgr" | "groups")[]`, `right?: ("projbay")[]`,
`toolbarTop?: boolean`. Restore needs `dockheight_t` and `mixwnd_max` added to the restore key list.

### 2.2 TCP (Edit window track header): WALTER

Sizes at 100 %, scaled by `w.n()`. `tcp_heights 4 24 64 96` (supercollapsed, small, medium = Pro Tools Medium, default).
Default TCP width `leftpanewid` ≈ 330.

| Element | Rect / rule | Notes |
|---|---|---|
| `tcp.custom.kStrip` | `[0 0 5 h]`, fill = track colour (`trackcolor_r/g/b`), else `face` | Colour strip down the left edge |
| `tcp.custom.kName` + `tcp.label` | `[8 3 118 18]`, `nameField`/`nameSel` by `track_selected` | Pro Tools name field |
| `tcp.custom.kPlaylist` | `[128 3 16 18]` ▾ button, command **42430** (Toggle fixed item lanes) | Playlists ≈ fixed lanes. Custom-with-command support: verify (§4) |
| `tcp.recarm` / `tcp.recmon` / `tcp.solo` / `tcp.mute` | row 2: `[8 24 22 16]`, `[32 24 22 16]`, `[56 24 22 16]`, `[80 24 22 16]` | Order R I S M. At height < 46, move them to row 1 (`[w-…]`) and narrow the name |
| `tcp.custom.kView` | row 3: `[8 44 70 16]`, `popup` face, text "waveform ▾", command `_RS_assist_pt_trackview` | Track View selector (§3.11). Hide when h < 64 |
| `tcp.env` | row 3: `[80 44 52 16]` | Automation mode popup showing the word in its colour |
| `tcp.folder` | `[134 44 12 16]` | Show or hide lanes. Pro Tools' ▸ arrow opens automation lanes; REAPER uses folder or envelope buttons |
| `tcp.meter` | `[150 3 8 h-6]`, vertical, `meterLook` | Header meter |
| `tcp.fxlist` | wide (w ≥ 300): `[162 3 82 h-6]`, header bar "INSERTS A-E" via custom text | Inserts column. REAPER lists as many FX as fit, with no fixed A–E slots |
| `tcp.recinput` / `tcp.io` | w ≥ 330: `[248 3 78 14]`, `[248 19 78 14]` | I/O column: input and output |
| `tcp.volume.label` / `tcp.pan.label` | `[248 35 38 14]`, `[288 35 38 14]`, green on black | Green readouts. Set `tcp.volume` to `[0]` (no fader in header); the label stays visible (verify) |
| `tcp.fx`, `tcp.phase`, `tcp.recmode`, `tcp.trackidx` | `[0]` (hidden) | Pro Tools shows none of these in the header |

Master track TCP (`master.tcp.*`): name `Master` field, `S`-less row (mute only), meter, I/O. Keep it short (24–40).

### 2.3 MCP (Mix window strip): WALTER, top → bottom

`MCP_W.protools = { track: 90, master: 90 }`. Also add a **"Narrow"** layout at 64 wide for ⌘⌥M (script
`ThemeLayout_SetLayout("mcp", "Narrow")`, verify persistence). `mcp_min_height 460 80`.

| # | Pro Tools row | REAPER element and rect | Gap |
|---|---|---|---|
| 1 | Colour bar | `mcp.custom.kTop [0 0 w 4]` track colour | none |
| 2 | Instrument view (MIDI controls) | — | no equivalent, omitted |
| 3 | Inserts A–E, F–J | `mcp.extmixer.mode [1]`, `extmixer.position [4 6 w-8 kE]`; FX inserts first | No fixed 10 slots; REAPER sizes the list |
| 4 | Sends A–E, F–J | Same extmixer; 40267 puts sends after inserts | Same |
| 5 | I/O: input, output | custom label "I/O" (white bold) `[4 y 82 10]`; `mcp.recinput [4 y+11 82 14]`; `mcp.io [4 y+27 82 14]` | REAPER's `io` is a routing button, not an output path popup |
| 6 | AUTO + mode popup | label "AUTO"; `mcp.env [4 … 82 14]` with mode-coloured word | none |
| 7 | Group popup ("no group") | `mcp.custom.kGroup`, command **40772** (grouping dialog for selected tracks) | No per-strip group name; verify clicking it acts on this track |
| 8 | Pan knob(s) + green pan readouts | Mono: `mcp.pan` centred 24×24. Stereo (`trackpanmode>=5`): `mcp.pan` left and `mcp.width` right, 22×22 each. `mcp.pan.label` (+ `mcp.width.label`) green on black below | Pro Tools shows L/R pans; REAPER's dual pan mode (6) is the closest. Don't change project pan mode (E) |
| 9 | Input Monitor + Record row | `mcp.recmon [6 … 38 16]`, `mcp.recarm [46 … 38 16]` | none |
| 10 | Solo + Mute row | `mcp.solo [6 … 38 16]`, `mcp.mute [46 … 38 16]` | none |
| 11 | dB scale · fader · meter (+ clip LEDs) | scale marks `[4 …]`, `mcp.volume [24 top 14 H]` grey cap, `mcp.meter [44 top 16 H]` stereo, clip LED = the meter's clip area | none |
| 12 | Voice / AutoMatch | — | no equivalent |
| 13 | Volume readout · peak readout | `mcp.volume.label [4 H-46 40 14]` and the meter readout (`mcp.meter.readout.color`) green on black | REAPER's peak readout position is tied to the meter (verify) |
| 14 | Track name | `mcp.label [4 H-30 82 16]` on `nameField` / `nameSel` | none |
| 15 | Comments, delay comp | — | no equivalent |
| 16 | Colour bar | `mcp.custom.kBot [0 H-4 w 4]` | none |

Master (Pro Tools Master Fader): no sends, pan or record. Show inserts, output, AUTO, fader, meter and name. Hide
`master.mcp.mono`/`menubutton`, or keep them small at the bottom (E).

### 2.4 Transport (right half of the Pro Tools Edit toolbar): WALTER `trans.*`, docked top

Order left → right. All displays are `display` wells with `displayText` digits. Gold `frame` hairlines group the clusters.

| Pro Tools | REAPER | Rect at 100 % (height 44) | Gap |
|---|---|---|---|
| Main counter (Bars\|Beats, large) | `trans.status`, font 22 px | `[8 4 200 36]` | none |
| Sub counter (Min:Sec) | — | — | **No equivalent.** Big clock (40378) is the fallback |
| Start / End / Length | `trans.sel` | `[214 4 210 36]` | REAPER shows start/end/length as text, not three fields (verify the look) |
| Grid / Nudge values | — | — | **No theme variable.** Use toolbar buttons 40071 / 41228 instead |
| Tempo / Meter | `trans.bpm.edit`, `trans.curtimesig` | `[430 4 64 16]`, `[430 22 64 16]` | none |
| RTZ, REW, FF, END | `trans.rew` (= go to start), custom **40084**, custom **40085**, `trans.fwd` (= go to end) | 28×20 each | Custom buttons inside `trans.*` (verify) |
| Stop, Play, Record | `trans.stop`, `trans.play`, `trans.rec` | 28×20 | Lit colours: stop `accent` blue, play `play`, rec `#ff3939` |
| Loop playback | `trans.repeat` | 28×20 | none |
| Pause, playrate, automode | `trans.pause [0]`, `trans.rate [0]`, `trans.automode [0]` | hidden | Pause stays on ⌃Space |
| Online, Dynamic Transport | — | — | No equivalent |

The floating **Transport window** (⌘Num1, Pro Tools' small window) maps to 40259. Pro Tools' button order inside it is
Online, RTZ, REW, FF, END, STOP, PLAY, REC, which the docked layout above keeps.

### 2.5 What REAPER can't do (state these in the UI)

- No **post-roll**: pre-roll only (41818/41819). No **sub counter**. The theme can't show **grid or nudge values**.
- No **edit vs timeline selection** split. REAPER has one time selection plus razor areas, so the "link timeline and
  edit selection" behaviour is always on.
- No **playlists**. Fixed item lanes (42430) plus comping are the closest.
- No fixed **A–J insert and send slots**, **Voice**, **comments** or **delay-comp** rows. No per-strip **group** popup.
- The **Mix window is not a second main window**. It's REAPER's mixer, undocked, toggled by 40078.
- No **flashing** edit cursor. No **Online**, **Dynamic Transport**, **TrackPunch** or **DestructivePunch**.
- Pro Tools tool chords such as **F6+F7 (Smart Tool)** and **F1+F4** are two keys pressed together; REAPER can't bind
  chords. Use ⌘7 and ⇧F4.

---

## 3. Function

### 3.1 Key encoding (extends `keyCode()` / `keymapLine()`)

Line: `KEY <flags> <key> <command> <section>`. **Virtual-key form**: flags = 1 + Shift 4 + ⌘/Ctrl 8 + ⌥/Alt 16 +
⌃/Win 32. This form applies to letters, digits, F-keys, keypad and navigation. Codes below are confirmed from a REAPER-written macOS
keymap (OSARA), except where marked.

| Key | Code | Key | Code |
|---|---|---|---|
| Num0–Num9 | 96–105 (e.g. `KEY 9 103` = ⌘Num7) | Num+ / Num− | 107 / 109 |
| Num* / Num/ / Num. | 106 / 111 / 110 (Num. inferred, verify) | **Num Enter** | **32781** |
| ← ↑ → ↓ | 32805 / 32806 / 32807 / 32808 | Home / End / PgUp / PgDn | 32804 / 32803 / 32801 / 32802 |
| Insert / Delete | 32813 / 32814 | Esc / Tab / Return / Backspace / Space | 27 / 9 / 13 / 8 / 32 |
| F1–F12 | 112–123 | digits / letters | 48–57 / 65–90 |

**Punctuation on macOS uses the character form**: no virtual-key bit and no Shift bit (Shift changes the character).
Flags are ⌘ 8, ⌥ 16, ⌃ 32. Codes: `=` 61, `-` 45, `[` 91, `]` 93, `;` 59, `'` 39, `,` 44, `.` 46, `/` 47,
`\` 92, `` ` `` 96, `+` 43, `_` 95. Examples REAPER wrote: `KEY 24 91` = ⌘⌥[, `KEY 32 96` = ⌃`, `KEY 0 43` = "+".
Today's profile writes ⌘= as `KEY 9 187` (Windows VK_OEM_PLUS), so **verify that line fires on macOS**. If it doesn't,
emit the character form on macOS. On Windows, check whether REAPER writes VK_OEM codes (186–222) or characters
(verify by recording one binding).

**Sections.** 0 Main, 100 Main (alt recording), 32060 MIDI editor. **A1 = "Main (alt-1)"**: its numeric id is
undocumented. The binary has `mainsec_alt%d`, so it is probably 1 (verify: bind any key in the Actions window under "Main
(alt-1)" on a throwaway resource folder and read `reaper-kb.ini`). Also verify that keys **not** bound in A1 fall through
to Main while the override is on.

Windows modifiers: ⌘→Ctrl, ⌥→Alt, ⌃→Win. This matches Pro Tools' own Windows mapping (Control→Start) and `shortcutLabel()`.
One `KEY` line serves both OSes, except rows whose Windows key is not that mechanical mapping (⌥Return → Ctrl+Enter,
⌥Tab → Ctrl+Tab) and rows marked "blocked": those need per-OS lines (`Shortcut` gets an optional `win` override).

### 3.2 Main section (0)

Script ids are `_RS_assist_pt_*` (§3.11). ACT = native custom action line (`ACT 0 0 "id" "desc" a b …`).

| Mac | Windows | Pro Tools command | REAPER |
|---|---|---|---|
| Space | Space | Play / Stop (respects Insertion Follows Playback) | `pt_playstop` → 40044 (IFP off) or 40328 (IFP on) |
| ⇧Space | Shift+Space | Half-speed playback | `pt_halfspeed` (rate 0.5, play; 40521 on stop) |
| ⌃Space | Win+Space | Pause | 1008 (OS conflict, §3.6) |
| ⌘Space | Ctrl+Space | Record | 1013 (macOS Spotlight conflict) |
| F12 | F12 | Record | 1013 |
| ⇧F12 | Shift+F12 | Half-speed record | `pt_halfspeed` record variant (verify feasibility) |
| ⌘. | Ctrl+. | Stop and discard take | 40668 |
| Return | Enter | Return to zero | 40042 |
| ⌥Return | Ctrl+Enter | Go to end of session | 40043 |
| ⌘⇧L | Ctrl+Shift+L | Loop playback | 1068 |
| ⌥L | Alt+L | Loop record toggle | `pt_looprec` |
| ⌘⇧P | Ctrl+Shift+P | QuickPunch toggle | `pt_quickpunch` |
| ⌘K | Ctrl+K | Pre/post-roll on/off | `pt_preroll` (pre-roll only) |
| ⌥[ | Alt+[ | Play edit selection | `pt_playsel` |
| ⌥] | Alt+] | Play timeline selection | `pt_playsel` (same; one selection in REAPER) |
| F1 / ⌥1 | F1 / Alt+1 | Shuffle mode | `pt_mode_shuffle` |
| F2 / ⌥2 | F2 / Alt+2 | Slip mode | `pt_mode_slip` |
| F3 / ⌥3 | F3 / Alt+3 | Spot mode | `pt_mode_spot` |
| F4 / ⌥4 | F4 / Alt+4 | Grid mode | `pt_mode_grid` |
| ⇧F4 | Shift+F4 | Snap to Grid in another mode | 1157 |
| ` | ` | Cycle edit modes | `pt_mode_cycle` |
| F5 / ⌘1 | F5 / Ctrl+1 | Zoomer tool | `pt_tool_zoom` |
| F6 / ⌘2 | F6 / Ctrl+2 | Trimmer tool | `pt_tool_trim` |
| F7 / ⌘3 | F7 / Ctrl+3 | Selector tool | `pt_tool_select` |
| F8 / ⌘4 | F8 / Ctrl+4 | Grabber tool | `pt_tool_grab` |
| F9 / ⌘5 | F9 / Ctrl+5 | Scrubber tool | `pt_tool_scrub` |
| F10 / ⌘6 | F10 / Ctrl+6 | Pencil tool | `pt_tool_pencil` |
| ⌘7 | Ctrl+7 | Smart Tool | `pt_tool_smart` |
| Esc | Esc | Cycle tools | `pt_tool_cycle` (Esc also closes dialogs; verify no clash) |
| ⌘Z / ⌘⇧Z | Ctrl+Z / Ctrl+Shift+Z | Undo / Redo | 40029 / 40030 |
| ⌘X / ⌘C / ⌘V | Ctrl+X / C / V | Cut / Copy / Paste | 41384 / 41383 / 42398 |
| ⌘B | Ctrl+B | Clear (no clipboard) | `pt_clear` |
| Backspace | Backspace | Clear | `pt_clear` |
| ⌘A | Ctrl+A | Select all | 40035 |
| ⌘D | Ctrl+D | Duplicate | `pt_duplicate` |
| ⌥R | Alt+R | Repeat… | `pt_repeat` |
| ⌘E | Ctrl+E | Separate clip | `pt_separate` |
| ⌘H | Ctrl+H | Heal separation | 40548 |
| ⌥⇧3 | Alt+Shift+3 | Consolidate clip | **41588** (fixes ⌘⌥⇧3 / 40362 in today's profile) |
| ⌘T | Ctrl+T | Trim clip to selection | 40508 |
| ⌥⇧7 / ⌥⇧8 | Alt+Shift+7 / 8 | Trim start / end to insertion | 41305 / 41311 |
| ⌘M | Ctrl+M | Mute / unmute clip | 40175 |
| ⌘L | Ctrl+L | Lock clip | 40687 |
| ⌘U | Ctrl+U | Strip Silence | 40315 |
| ⌘⇧E | Ctrl+Shift+E | Insert silence | 40200 |
| ⌘F | Ctrl+F | Fades dialog | `pt_fades` |
| ⌘⌃F | Ctrl+Win+F | Crossfade, no dialog | 40916 |
| ⌃D / ⌃G | (Win+D / Win+G blocked) | Fade to start / fade to end | 40509 / 40510. On Windows use Keyboard Focus D / G |
| ⌘0 | Ctrl+0 | Quantize clip to grid | 41184 |
| ⌥H | Alt+H | Shift… (move by amount) | 41228 |
| Tab | Tab | Tab to next clip boundary / transient | `pt_tab_next` |
| ⌥Tab | Ctrl+Tab | Tab back | `pt_tab_prev` |
| ⌘⌥Tab | Ctrl+Alt+Tab | Tab to Transients on/off | `pt_ttt` |
| ⌃Tab / ⌃⌥Tab | (Win+Tab blocked) | Select next / previous clip | 40417 / 40416 |
| ⌃P / ⌃; | (blocked) | Move edit to previous / next track | 40286 / 40285. On Windows use Keyboard Focus P / ; |
| ⌃⇧P / ⌃⇧; | (blocked) | Extend edit up / down | 40288 / 40287 |
| ⌃↑ / ⌃↓ | Win+↑ / Win+↓ | Track height larger / smaller | 41325 / 41326 (OS conflicts) |
| ⇧R / ⇧S / ⇧M / ⇧I | Shift+R / S / M / I | Record / Solo / Mute / Input on tracks in selection | 9 / 7 / 6 / 40495 |
| ⌥C | Alt+C | Clear clip indicators | 40527 |
| ⌥K | Alt+K | Auto Input / Input Only monitoring | `pt_inputmon` |
| ⌘] / ⌘[ | Ctrl+] / Ctrl+[ | Zoom in / out horizontally | 1012 / 1011 |
| ⌥F | Alt+F | Zoom to fill selection | 40031 |
| ⌥A | Alt+A | Zoom to entire session | 40295 |
| ⌃E | (Win+E blocked) | Zoom Toggle | `pt_zoomtoggle`. On Windows use Keyboard Focus E |
| ⌘⇧N | Ctrl+Shift+N | New tracks… | 41067 |
| ⌥⇧D | Alt+Shift+D | Duplicate tracks | 40062 |
| ⌘G | Ctrl+G | Group tracks | 40772 |
| ⌘= | Ctrl+= | Toggle Edit / Mix window | 40078 |
| ⌃= | (Win+= blocked) | MIDI Editor | 40153 |
| ⌘⌥M | Ctrl+Alt+M | Narrow mix | `pt_narrowmix` |
| ⌥; | Alt+; | Workspace browser | 50124 |
| ⌘Num1 | Ctrl+Num1 | Transport window | 40259 |
| ⌘Num3 | Ctrl+Num3 | Big Counter | 40378 |
| ⌘Num5 | Ctrl+Num5 | Memory Locations window | 40326 |
| ⌘⌥1 | Ctrl+Alt+1 | Commands Keyboard Focus | **24803** (toggle override to alt-1) |
| ⌘N / ⌘O / ⌘S | Ctrl+N / O / S | New / Open / Save | 40023 / 40025 / 40026 |
| ⌘⌃S | Ctrl+Win+S | Save As | 40022 |
| ⌘⌥B | Ctrl+Alt+B | Bounce Mix | 40015 |
| ⌘⇧I | Ctrl+Shift+I | Import Audio | 40018 |

### 3.3 Numeric keypad: Pro Tools "Transport" keypad mode (main section)

| Key | Pro Tools | REAPER |
|---|---|---|
| Num0 | Play / Stop | `pt_playstop` |
| Num1 / Num2 | Rewind / Fast forward | 40084 / 40085 |
| Num3 | Record | 1013 |
| Num4 | Loop playback on/off | 1068 |
| Num5 | Loop record on/off | `pt_looprec` |
| Num6 | QuickPunch on/off | `pt_quickpunch` |
| Num7 | Click on/off | 40364 |
| Num8 | Countoff on/off | `pt_countoff` |
| Num9 | MIDI Merge on/off | `pt_midimerge` |
| Num− / Num+ | Nudge earlier / later | 41250 / 41249 |
| ⌃⌥Num+ / ⌃⌥Num− | Grid value up / down | 40786 / 40783 (direction verify) |
| Num Enter | New memory location (dialog) | 40171 |
| ⌘Num Enter | Marker without dialog | 40157 (Pro Tools: "Command+Enter"; that it means keypad Enter is a verify) |
| Classic / Shuttle modes, `. n .` recall | — | **No equivalent** |

### 3.4 Commands Keyboard Focus = section A1 ("Main (alt-1)")

Toggle with ⌘⌥1 → 24803. **Also bind ⌘⌥1 → 24803 inside A1**, so the toggle works even if keys don't fall through.
Toolbar button "a–z" = 24803 with toggle highlight. Clear on Restore with 24800.

| Key | Pro Tools | REAPER |
|---|---|---|
| 1–5 | Recall zoom preset 1–5 | 40444–40448 (load track view #1–5; save with 40464+). Verify that track views hold zoom |
| 6 / 8 | Play to edit start / end | `pt_playto` start / end |
| 7 / 9 | Play from edit start / end | ACT `40630 1007` / ACT `40631 1007` |
| − | Toggle waveform / volume view | 40406 |
| E | Zoom Toggle | `pt_zoomtoggle` |
| R / T | Zoom out / in | 1011 / 1012 |
| P / ; | Edit to previous / next track | 40286 / 40285 |
| [ / ] | Play edit / timeline selection | `pt_playsel` |
| A / S | Trim start / end to insertion | 41305 / 41311 |
| D / G | Fade to start / to end | 40509 / 40510 |
| F | Crossfade, no dialog | 40916 |
| L / ' | Tab back / forward (clip boundary) | 41167 / 41168 |
| Z / ⇧Z | Undo / Redo | 40029 / 40030 |
| X / C / V | Cut / Copy / Paste | 41384 / 41383 / 42398 |
| B | Separate | `pt_separate` |
| N | Insertion Follows Playback on/off | `pt_ifp` |
| , / . | Nudge earlier / later | 41250 / 41249 |
| M · / | Nudge earlier / later by next nudge value | 41279 / 41275 (saved nudge setting 1, written by the bridge) |
| Q, W, Y, U, I, O, H, J, K, 0, \ | Display or spot to timecode, timeline↔edit, snap clip to play position | **No equivalent.** Leave unbound |

Without Keyboard Focus, REAPER's own single-letter defaults stay active in Main. Pro Tools users won't expect that, but
it's harmless. Don't mask them (Restore stays simple).

### 3.5 MIDI editor (32060)

These Pro Tools keys work in the Edit window's Notes view. In REAPER they go in the MIDI editor.

| Mac | Windows | Pro Tools | REAPER (32060) |
|---|---|---|---|
| ↑ / ↓ | ↑ / ↓ | Transpose ±1 semitone | 40177 / 40178 |
| ⇧↑ / ⇧↓ | Shift+↑ / ↓ | Transpose ±1 octave | 40179 / 40180 |
| ⌥⇧↑ / ⌥⇧↓ | Alt+Shift+↑ / ↓ | Copy and transpose ±octave | 40884 / 40885 |
| ⌥↑ / ⌥↓ | Alt+↑ / ↓ | Copy and transpose ±semitone | `pt_midi_copytranspose` |
| ⌃↑ / ⌃↓ | Win+↑ / ↓ | Transpose in key | 40177 / 40178 with key snap on (verify), else script |
| ⌘↑ / ⌘↓ | Ctrl+↑ / ↓ | Velocity ±5 | ACT `40462×5` / ACT `40464×5` |
| ⌘⇧↑ / ⌘⇧↓ | Ctrl+Shift+↑ / ↓ | Velocity ±15 | ACT `40463 40462×5` / ACT `40465 40464×5` |
| ← / → | ← / → | Select previous / next note | 40414 / 40413 |
| ⇧← / ⇧→ | Shift+← / → | Add previous / next note | 40421 / 40422 |
| ⌥← / ⌥→ | Alt+← / → | Trim note end left / right | 40447 / 40446 (by grid; Pro Tools uses nudge) |
| ⌃← / ⌃→ | Win+← / → | Trim note start left / right | `pt_midi_trimstart` |
| ⌘Z / ⌘⇧Z | Ctrl+Z / Ctrl+Shift+Z | Undo / Redo | 40013 / 40014 |
| ⌘X / ⌘C / ⌘V | Ctrl+X / C / V | Cut / Copy / Paste | 40012 / 40010 / 40011 |
| ⌘A | Ctrl+A | Select all | 40003 |
| ⌘D | Ctrl+D | Duplicate | 40886 |
| ⌘E | Ctrl+E | Separate | 40046 (split notes) |
| ⌘⌥0 | Ctrl+Alt+0 | Quantize MIDI to grid | 40469 |
| ⌥0 | Alt+0 | Quantize (MIDI Operations window) | 40009 |
| Space, Num0–Num9, Num Enter, Num+ / Num−, ⌘= | same | Transport, keypad, Edit/Mix | **40401** (pass through to main, so IFP and keypad behave as in Main) |
| ⌃= | (blocked) | Close the MIDI editor | 2 |

### 3.6 OS conflicts to flag in the UI

- **macOS**: ⌘Space (Spotlight; Pro Tools users usually remap it), ⌃Space (input source), ⌃↑/⌃↓/⌃←/⌃→ (Mission Control and
  Spaces), F9–F12 (media keys; need fn or the "standard function keys" setting).
- **Windows**: Win+D, Win+G, Win+E, Win+P, Win+Tab, Win+=, Win+arrows and Ctrl+Alt+Tab are taken by the OS. Pro Tools on Windows
  has the same problem, so offer the Keyboard Focus letters instead.

### 3.7 Edit modes (`pt_mode_*`)

| Mode | Pro Tools behaviour | REAPER settings |
|---|---|---|
| Shuffle | Clips butt together. Moving, trimming or deleting ripples later clips on that track | 40310 (ripple per-track) + 40753 (snap off) |
| Slip | Free placement; no ripple, no snap | 40309 + 40753 |
| Spot | Clicking or dragging a clip opens a "move to" dialog | 40309 + 40753, and `MM_CTX_ITEM_CLK` mod 0 → `_RS_assist_pt_spot` (dialog showing the clip start in ruler units; move the selected items; undo block) |
| Grid | Snap to grid (absolute) | 40309 + 40754 |
| ⇧F4 in another mode | Snap on top of Shuffle / Slip / Spot | 1157 (keep the mode) |

Each mode script stores `ExtState assist_pt/mode`, sets its own toggle state, clears the other three
(`SetToggleCommandState` + `RefreshToolbar2`) and calls `pt_tool_apply` (Spot changes the click map). On start, the bridge
re-lights the buttons from ExtState. Pro Tools "Relative Grid" has **no equivalent** (REAPER snaps absolutely). The
"Shuffle lock" (⌘-click) isn't needed.

### 3.8 Tools and the Smart Tool (mouse modifiers, all **verify**)

Mechanism: one script per tool calls `SetMouseModifier(context, flag, value)` and saves the user's previous values
(pattern in `reaper-mechanics.md` §1.5). Flags: 0 none, 1 ⇧, 2 ⌘/Ctrl, 4 ⌥/Alt, 8 ⌃/Win. Use behaviour **names** and
read the ids back.

**Smart Tool (the default map, ⌘7):**

| Context | Mod | Behaviour | Pro Tools equivalent |
|---|---|---|---|
| `MM_CTX_ITEM` (top half, left drag) | 0 | "Select razor edit area and time" (exists in 7.82 strings; check the context accepts it) | Selector in the upper half |
| `MM_CTX_ITEM` | 1 | "Select razor edit area and time ignoring snap" | Shift-extend (approx) |
| `MM_CTX_ITEMLOWER` (bottom half) | 0 | 1 "Move item" | Grabber in the lower half |
| `MM_CTX_ITEMLOWER` | 4 | 2 "Copy item" | ⌥-drag copies |
| `MM_CTX_ITEMLOWER` | 2 | 4 "Move item ignoring snap" | ⌘ temporary Grid↔Slip (approx) |
| `MM_CTX_ITEMLOWER` | 8 | leave default | ⌃ = temporary Scrubber in Pro Tools. Item contexts have no scrub (see middle drag) |
| `MM_CTX_ITEMEDGE` | 0 | 1 "Move edge" (default) | Trim near clip start and end |
| `MM_CTX_ITEMFADE` / fade handles | 0 | default (drag the top corner handles) | Smart Tool fade zones at the top corners |
| `MM_CTX_CROSSFADE` | 0 | default (moves the split point) | Crossfade zone between clips (approx) |
| `MM_CTX_ITEM_CLK` | 0 | 1 "Select item and move edit cursor" | Click sets the insertion point |
| `MM_CTX_ITEMLOWER_CLK` | 0 | `ACT 40528 40290` (select item under mouse + time selection to item) | Grabber click selects the whole clip |
| `MM_CTX_ITEM_DBLCLK` | 0 | 2 "Set time selection to item" | Double-click with the Selector selects the clip |
| `MM_CTX_TRACK` (empty lane, left drag) | 0 | "Select razor edit area and time" | Selector on an empty track |
| `MM_CTX_TRACK_CLK` | 0 | 1 "Deselect all items and move edit cursor" (default) | Insertion point |
| `MM_CTX_ARRANGE_MMOUSE` | 0 | 1 scrub | No Pro Tools equivalent. Gives the ⌃ temporary scrubber a home (item contexts have no scrub) |

**Other tools** (each restores the Smart map first, then changes only these):

| Tool | REAPER |
|---|---|
| Selector (F7) | Arrange override **B or D** (42617 razor / 42632 time). Set content by name to "Select razor edit area and time" |
| Grabber (F8) | 42621 (clear overrides) + `MM_CTX_ITEM` 0 → 1 "Move item" (whole clip) |
| Trimmer (F6) | `MM_CTX_ITEM` and `ITEMLOWER` 0 → "Marquee select items" (body does nothing harmful); edges trim. Pro Tools trims the **nearest edge from anywhere**, which has no equivalent |
| Scrubber (F9) | Override A set to "scrub" (override contexts accept scrub) |
| Zoomer (F5) | Override C set to "marquee zoom" |
| Pencil (F10) | `MM_CTX_TRACK` 0 → 5 "Draw an empty MIDI item"; envelope lanes: freehand draw (by name); MIDI editor: `MM_CTX_MIDI_PIANOROLL` 0 → 1 insert note. Pro Tools waveform repair drawing has no equivalent |
| Esc | `pt_tool_cycle` (Smart → Zoomer → … → Pencil) |

Overrides A–D are global factory slots. Write their content with `SetMouseModifier("MM_CTX_ARRANGE_A", 0, …)` and record it
for Restore. MIDI-editor Smart behaviour (marquee on empty, move on note, trim on edges, ⌘ velocity, ⌃ pencil, ⌥⌃ eraser)
uses `MM_CTX_MIDI_PIANOROLL` 0 → 7 marquee; 8 → 1 insert; `MM_CTX_MIDI_NOTE` 2 → 9 velocity; 12 → 3 erase (verify).

### 3.9 Preferences

| Pro Tools setting (default) | REAPER | Key / action | Confidence |
|---|---|---|---|
| Insertion Follows Playback (off) | Space runs `pt_playstop`. REAPER's stop always returns to the edit cursor = IFP off | ExtState + 40044 / 40328 | High |
| Link timeline and edit selection | Always linked | — | High |
| Scrolling: Page (default) | Auto-scroll on, continuous off | `viewadvance` &1 on, &16 off (40036, 41817) | High |
| Scrolling: Continuous / Center | Continuous scrolling | 41817 | High |
| Scroll while recording | on | `viewadvance` &2 (40262) | High |
| Stop at end of session | REAPER keeps playing past the end by default | `stopprojlen` 1 | Medium verify |
| Loop playback | Repeat | `loop` / 1068 (project) | High |
| Pre-roll (off; 1–2 bars typical) | Pre-roll on play and on record | 41818 / 41819, length in 40363 dialog (`prerollmeas` verify) | Medium |
| Post-roll | — | no equivalent | — |
| Count-off (off, 2 bars) | Count-in before record | `projmetroen` &16, `projmetrocountin` 2 (no action exists) | Medium verify |
| Click | Metronome | 40364 / `projmetroen` &1 | High |
| Normal record with selection = punch | Auto-punch time selection | 40076 (default while QuickPunch is off) | Medium (verify behaviour with no selection) |
| QuickPunch | Normal record mode; record during playback punches in | 40252 | Medium verify |
| Loop record (new take per pass) | Repeat + loop recording adds takes | 1068 + 40114 | High |
| Recording over clips = new clips stacked | Takes (default) | 41330 | High |
| Auto fades (off; Pro Tools has none by default) | Disable default item fades | 41196 · `deffadelen` 0 (verify) | High |
| Auto-crossfade on edit (off) | Disable | 41119 (`autoxfade` &1 off) | High |
| Overlapping clips trim the one underneath | Trim content behind | 41120 (`autoxfade` &2) | High |
| Edit cursor moves on selection | Move edit cursor to time-selection start | 40276 (`itemclickmovecurs` &4) | High |
| New track default: mono audio, input 1 | New-track dialog | 41067. `deftrackrecinput` verify | Low |
| Track colours automatic | Bridge assigns our palette on track add | script | Low |
| Ruler: Bars\|Beats + Min:Sec | 40366 (or 40367 + 42361 secondary) | project | High |
| Mix window: inserts and sends shown | 40549 + 40557 on, 40267 sends after inserts, 41209 master visible, 40389 master on right | mixer flags | High |
| Meter peak hold 3 s | Pref (verify key) | — | Low |

### 3.10 Toolbars

**Main toolbar (docked top, replaces REAPER's)**: own 30×30 3-frame icons named `assist_pt_*.png` in
`Data/toolbar_icons` (+150/200). Edit modes use text buttons (`icon_N=text`) with `tbf_N=1` (highlight when on).
Draw the chrome images `toolbar_blank`, `composite_toolbar_overlay` and `toolbar_bg` in `panel` with `frame` gold hairlines.

| # | Button | Command |
|---|---|---|
| 0–3 | SHUFFLE · SPOT · SLIP · GRID | `_RS_assist_pt_mode_shuffle` / `_spot` / `_slip` / `_grid` |
| 4 | separator | −1 |
| 5–7 | Zoom out · Zoom in · Zoom to selection | 1011 · 1012 · 40031 |
| 8–14 | Zoomer · Trimmer · Selector · Grabber · Scrubber · Pencil · Smart | `_RS_assist_pt_tool_*` |
| 15 | separator | −1 |
| 16 | Keyboard Focus "a–z" | 24803 |
| 17 | Insertion Follows Playback | `_RS_assist_pt_ifp` |
| 18 | Tab to Transients | `_RS_assist_pt_ttt` |
| 19 | Snap | 1157 |
| 20 / 21 | Grid… · Nudge… | 40071 · 41228 |
| 22 | separator | −1 |
| 23–28 | Click · Count-off · Pre-roll · Loop playback · QuickPunch · Loop record | 40364 · `pt_countoff` · `pt_preroll` · 1068 · `pt_quickpunch` · `pt_looprec` |
| 29 | separator | −1 |
| 30–33 | Mix · MIDI Editor · Memory Locations · Big Counter | 40078 · 40153 · 40326 · 40378 |

### 3.11 Lua scripts (`Scripts/ReaperAssist/pt/`, registered as `SCR 4 0 RS_assist_pt_* …`)

Every toggle script: state in `ExtState("assist_pt", …, true)`, `SetToggleCommandState` + `RefreshToolbar2`,
one undo block when it edits.

| Script | What it does |
|---|---|
| `pt_playstop` | If playing or recording: stop. Run 40328 when `ifp==1`, else 40044. If stopped: run 1007. Also clears half-speed (40521) |
| `pt_ifp` | Toggle `ifp`. Optionally also flip `seekmodes` &4 (click seeks during playback) (verify) |
| `pt_halfspeed` | `CSurf_OnPlayRateChange(0.5)`, then play (or record for ⇧F12/⌘⇧Space). On the next stop, `pt_playstop` restores 1.0 (40521) |
| `pt_playsel` | If a time selection exists: move the edit cursor to its start (40630), turn repeat off for this pass, play, and stop at the end via a `defer` loop watching `GetPlayPosition()`. Otherwise play |
| `pt_playto` | Play from (selection start or end − 2 s) and stop at that point (defer loop). The pre-roll length matches Pro Tools' 2 s default (E) |
| `pt_mode_*`, `pt_mode_cycle` | §3.7. Cycle order: Shuffle → Slip → Spot → Grid |
| `pt_spot` | Click handler (Spot mode only). Select the item under the mouse (40528), prompt `GetUserInputs("Spot", 1, "Start", format_timestr_pos(pos, "", -1))`, parse with `parse_timestr_pos`, move the selected items keeping offsets |
| `pt_tool_*`, `pt_tool_cycle`, `pt_tool_apply` | §3.8. Save the user's map once, apply the tool map, light one of 7 buttons |
| `pt_clear` | If razor areas exist: 40697. Else if a time selection exists: 40312 (in Shuffle mode 40201, which closes the gap). Else 40697 |
| `pt_duplicate` | If a time selection or razor area exists: 41296. Else 41295 |
| `pt_repeat` | Ask "Number of repeats" (default 1), then run `pt_duplicate` n times in one undo block |
| `pt_separate` | If razor areas or a time selection exist: 40061. Else 40757. Pro Tools also separates at the selection edges, which 40061 does |
| `pt_fades` | Look at the selection. If it spans a boundary between two items: 40916. If it touches an item start: fade in to the selection end. If it touches an item end: fade out from the selection start (`SetMediaItemInfo_Value` `D_FADEINLEN`/`D_FADEOUTLEN`). A shape dialog is optional (E) |
| `pt_preroll` | Toggle 41818 and 41819 together so they stay in sync. Pro Tools ⌘K also implies post-roll, which isn't available, so show that in the tooltip |
| `pt_quickpunch` | Toggle between 40252 (on) and 40076 (off) |
| `pt_looprec` | On: 1068 on, 40114 on, record mode 40252, set a time selection from the loop if empty. Off: put the previous state back |
| `pt_countoff` | Flip `projmetroen` &16 with `set_config_var_string` (project scope; record the old value) |
| `pt_midimerge` | On: 40503 (MIDI overdub) on armed MIDI tracks; off: 40504 (replace). Store the default for new arms |
| `pt_inputmon` | Toggle the monitor mode of armed tracks between 40494 (auto/tape = Auto Input) and 40493 (on = Input Only) |
| `pt_tab_next` / `pt_tab_prev` | If `ttt==1`: 40375 / 40376. Else 41168 / 41167 |
| `pt_ttt` | Toggle `ttt` |
| `pt_zoomtoggle` | On: save the arrange view (`GetSet_ArrangeView2`) and selected track heights, then 40031 + 40723. Off: put them back. Store in ExtState |
| `pt_trackview` | Popup menu (`gfx.showmenu`): waveform / volume / pan / "show all". Toggle 40406 / 40407 for the track under the click and 40891. The click needs the track context (verify that custom-button actions get the track) |
| `pt_narrowmix` | Switch `ThemeLayout_SetLayout("mcp", "")` ↔ `"Narrow"`, then `ThemeLayout_RefreshAll` |
| `pt_midi_copytranspose` (32060) | Copy the selected notes in place and transpose the copies ±1 (`MIDI_GetNote` / `MIDI_InsertNote`); the originals stay selected |
| `pt_midi_trimstart` (32060) | Move the start of the selected notes by one grid step, keeping their end (`MIDI_SetNote`). ⇧ variant = 4 steps (E) |

ACT lines needed (A1 and 32060): play-from-start `40630 1007`, play-from-end `40631 1007`, grabber click `40528 40290`,
and velocity steps (5× 40462, 5× 40464, 40463 + 5× 40462, 40465 + 5× 40464).

---

## 4. Kit features Pro Tools needs (engineering list)

1. `KitId = "protools"`, plus entries in `SIZES`, `MCP_W` and `kitFor()`. Allow `kit: "protools"` in `skins.ts` `skinFromWorkflow`.
2. `look: "bevel"`: flat, radius 2, 1 px top highlight (+10 % L) and 1 px bottom shadow (`deep`).
3. New colour fields: `mute`, `input`, `recOff`, `popup`/`popupText`, `nameField`, `nameSel`/`nameSelText`, `frame`, `clipLed`.
4. **Letter glyphs** in `art.ts` (`R`, `I`, `S`, `M` drawn as vector paths, not a font), plus a circle glyph for record-off.
   Solo, mute and input use their own colours (today, mute = accent).
5. **Words in automation-mode images** (`track_env*` / `mcp_env*`: "trim", "read", "touch", "latch", "write", "prev").
6. A **colour-strip** custom element (left edge of the TCP, top and bottom of the MCP) filled from `trackcolor_*`.
7. A **custom button with a command** in `walter.ts` (`custom name "" <cmd> "desc" image`). Needed for the playlist ▾,
   view selector, group popup, and the transport REW/FF. Verify: named `_RS…` ids, use inside `trans.*`, and whether the click
   targets that track.
8. Dual pan knobs (`mcp.width` beside `mcp.pan` when `trackpanmode>=5`), with green-on-black `*.label` readouts.
9. A "Narrow" MCP layout (64 px).
10. A gold-hairline cluster frame around transport groups (`framedBox` with `frame` colour).
11. Keymap: new key codes (§3.1), **section A1**, macOS character-form punctuation, and `SCR`/`ACT` lines in `mergeKb`/`restoreKb`.
12. Workspace: undocked, maximised mixer; left docker (track manager and group manager); right docker (project bay); toolbar
    docked on top; transport top. Restore keys `mixwnd_max`, `dockheight_t`.
13. Mouse-map engine (tool scripts) and Restore of overrides A–D (shared with other profiles).
14. Extra `reaperColors()` keys: `col_tr1_ps2`, `col_peaksedgesel`, `col_tl_bgsel(2)`, `areasel_*`, `col_mi_label*`, the
    `marker_lane_bg` / `region_lane_bg` / `marker` / `region` lane keys, and selected-track lane keys.

---

## 5. Glossary additions (Pro Tools term → REAPER)

| Pro Tools | REAPER |
|---|---|
| Session · Playback cursor · Insertion point | Project (.rpp) · Play cursor · Edit cursor |
| Edit selection / Timeline selection | Time selection, or a razor area for per-track ranges |
| Separate (⌘E) · Heal · Clear (⌘B) | Split · Heal splits · Remove (Delete) |
| Shuffle / Slip / Spot / Grid mode | Ripple per track / snap off / "Spot" dialog script / snap on |
| Smart Tool, Selector, Grabber, Trimmer | Mouse-modifier map: top half selects, bottom half moves, edges trim |
| Memory Location | Marker or region |
| Commands Keyboard Focus | Main (alt-1) key section |
| TrackInput button | Record monitoring |
| QuickPunch | Normal record mode, punching in during playback |
| Loop Record | Repeat + loop recording adds takes |
| Pre/post-roll | Pre-roll (no post-roll) |
| Nudge | Nudge (41249/41250, nudge dialog) |
| Tab to Transients | Move cursor to next transient |
| Strip Silence | Auto trim/split items |
| Master Fader · Aux Input / Bus · Instrument track | Master track · a track with receives · a track with a virtual instrument |
| Clip Gain | Item volume / take volume envelope |
| Commit / Bounce track | Freeze / render (apply FX) |
| AudioSuite | Apply FX to items |
| Universe · Clips List · Workspace · Big Counter | Navigator · Project Bay · Media Explorer · Big clock |
| Track View selector ("waveform", "volume") | Envelope lanes |

---

## 6. Do not copy

- Avid and Pro Tools **logos**, wordmarks or product names inside any artwork, icon, splash or theme name. Profile text may
  say "Coming from Pro Tools" (nominative use only).
- Pro Tools **icon art** pixel for pixel: the Smart Tool glyph, tool icons, transport glyphs, the edit-mode block artwork. Draw
  our own vector shapes. Generic symbols (▶ ■ ●, letters R/I/S/M) are fine.
- Avid's exact **colour palette swatches** as a set (§1.2 rule instead), and Avid's **fonts**.
- Trademarked feature names as our button labels: QuickPunch™, TrackPunch, Elastic Audio, AudioSuite, AutoMatch. Use
  generic labels ("Punch on the fly") and put the Pro Tools word in the tooltip or glossary.
- Any **bundled content**: Avid loops, plug-ins, presets, session or track templates, and Avid's PDF guide text or screenshots.
  Never ship the guides; link to them.
- A screenshot-faithful copy of the whole Edit window (trade dress). Match function and colour mood, not the exact geometry.

---

## 7. Verify list (throwaway resource folder; never `~/Library/Application Support/REAPER`)

1. The numeric section id of "Main (alt-1)", and fall-through to Main while 24803 is on. Is the override restored after a restart?
2. Does `KEY 9 187` (⌘=) fire on macOS, or is the character form `KEY 8 61` required? On Windows, VK_OEM or character?
3. Num. code 110. Does ⌘ Num Enter fire `KEY 9 32781`?
4. Which contexts accept "Select razor edit area and time". The `MM_CTX_ITEMLOWER_CLK` ACT, and whether the click selects first.
5. WALTER `custom` with command ids: named `_RS…` ids, inside `trans.*`, and the track targeted by an MCP/TCP click.
6. Whether `tcp.volume.label` shows with `tcp.volume [0]`, and where `mcp.meter.readout` draws.
7. Peak-colour behaviour of the `tinttcp` bits; the pref key for labels above items.
8. Behaviour of 40076 auto-punch with no time selection, and record pressed during playback (QuickPunch).
9. `stopprojlen`, `prerollmeas`, `deffadelen`, the peak-hold pref and the `deftrackrecinput` key names.
10. Docker idents for the track manager, group manager and project bay; `mixwnd_max`.
11. Unmeasured colours: solo, mute and input lit hexes; meter yellow/orange/red; playhead; selected track name plate; automation
    mode colours other than "read".
12. Grid "Adjust by 2 / 1/2" direction vs Pro Tools ⌃⌥Num+/−.

---

## 8. Sources

- Avid, *Pro Tools Keyboard Shortcuts 2025.10*: https://resources.avid.com/SupportFiles/PT/Pro_Tools_Shortcuts_2025.10.pdf
  (edit modes and tools p. 25, nudge and grid p. 28, MIDI note editing p. 29, memory locations p. 35, file menu, transport keypad).
- Avid, *Pro Tools Reference Guide 2025.10*: https://resources.avid.com/SupportFiles/PT/Pro_Tools_Reference_Guide_2025.10.pdf
  (edit modes, Smart Tool zones, meters and clip indicators, scrolling options, button colours, track heights, Mix strip).
- Avid, *What's New in Pro Tools 2024.10*: https://resources.avid.com/SupportFiles/PT/Whats_New_in_Pro_Tools_2024.10.pdf
  (Dark-theme Edit window on the cover; pp. 14, 39, 41 for sampled colours).
- Avid, *What's New in Pro Tools 2025.10*: https://resources.avid.com/SupportFiles/PT/Whats_New_in_Pro_Tools_2025.10.pdf (p. 22, Mix strip).
- Production Expert, "Pro Tools 2020.11 released" (Dark theme, Classic theme, UI customisation):
  https://www.production-expert.com/home-page/pro-tools-2020-11-released
- Production Expert, "Pro Tools 2024.10 released: everything you need to know":
  https://www.production-expert.com/production-expert-1/pro-tools-2024-10-released-everything-you-need-to-know
- Avid, "Color coding tracks and clips" (user guide page): https://www.avid.com/pro-tools/user-guide/color-coding-tracks-clips
- REAPER 7.82's action list, shared mechanics (`reaper-mechanics.md`), the Cockos WALTER and theme image docs, and
  REAPER's Default 7 theme keys.
- REAPER 7 summary (mouse-modifier contexts, razor edits): https://www.reaper.fm/userguide/WhatsNewReaper7Summary_r2.pdf
- ProRec, REAPER razor-edit and mouse-modifier tutorial: https://ProRec.com/?p=3021
- Ultraschall, *Reaper Filetype Descriptions* (`reaper-kb.ini` KEY/SCR/ACT format, sections):
  https://github.com/Ultraschall/ultraschall-lua-api-for-reaper
- OSARA macOS keymap (REAPER-written key codes: Num Enter 32781, arrows 3280x, character-form punctuation):
  https://github.com/jcsteh/osara (`config/mac/reaper-kb.ini`).
