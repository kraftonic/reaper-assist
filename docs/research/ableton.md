# Ableton Live → REAPER research notes
These are the notes the Ableton Live profile was built from, checked against REAPER 7.82. They may be out of date — corrections welcome via PR.

The target look is Live 9's classic light-grey theme (a reference Live 9 screenshot of the Session view). The target function is Live's current behaviour (Live 11/12 keys and mouse), with Live 9 differences noted.
Everything here is for an **original** kit: our own vector artwork and WALTER layout. Live's skin values are reference only.

Notation:
- `⌘` is Cmd on macOS and Ctrl on Windows. This is the profile's `cmd` mod, REAPER flag 8.
- `⌥` is Option/Alt (`opt`, flag 16). `⇧` is Shift. `⌃` is the `ctrl` mod (flag 32): Control on macOS, Win on Windows.
- **Section 0** is the main window and **32060** is the MIDI editor.
- Every action id below comes from REAPER 7.82's action list. "script" means a Lua ReaScript we write (§4.8).
- "verify" marks anything not proven in REAPER 7.82 or in a primary Live source.

---

## 0. Biggest gaps between today's Ableton kit/profile and real Live

| # | Today | Real Live | Fix (section) |
|---|---|---|---|
| 1 | `⌘0` = deactivate clip | **`0`** deactivates. `⌘0` = global quantization *off* | §4.2: rebind `0`, drop `⌘0` |
| 2 | `⌘E`/`⌘J`/`⌘L`/`⌘U`/`⌘D` exist only in the main section. The MIDI editor gets only Tab | All of these also work in the clip (MIDI) editor | §4.3 |
| 3 | `⌘E` = 40757 splits at the edit cursor only | Splits at the selection edges, else at the insert marker | script `k_split` |
| 4 | `⌘J` = 40362 ignores time selection | Consolidate = the selection becomes one clip | 41588 |
| 5 | `⌘L` = 41039 sets loop to items but leaves loop off | Sets the loop brace to the selection **and turns loop on** | script `k_loop_selection` |
| 6 | `⌘⇧T` = 40701 opens the instrument picker | Inserts an empty MIDI track (All Ins, auto-arm) | script `k_insert_midi_track` |
| 7 | Missing: `O` `B` `S` `C` `F1–F8` `⌘1–4` `Z` `X` `W` `+/-` `⌘I` `⌘⇧D` `⌘⌥T` `⌘G` `R` `⌘⌥M/I/S` `⇧Tab` | All are core Live keys | §4.2 |
| 8 | No mouse map | Double-click empty MIDI track → clip. Double-click empty piano roll → note, on a note → delete. Velocity = ⌘-drag (mac) / Alt-drag (Win). Copy = ⌥-drag (mac) / Ctrl-drag (Win). Title bar moves, body selects time | §4.5 |
| 9 | Track activator is a speaker icon, with the track number drawn beside it | The activator **is** the number in a yellow box | §3.1 |
| 10 | TCP: the name is a 20px row, plus a slider, a knob and an FX/IO/env icon row | Live: a full-height name column in the track colour, then `[number][S][●]` / `[vol box][pan box]` / sends, then a thin meter | §3.1 |
| 11 | Transport has rew/fwd/pause | Live has none. It has metronome, follow, draw, loop/punch and computer-keyboard buttons instead | §3.3 |
| 12 | One `display` colour (#bfbfbf) for everything | Control-bar fields are #999999 on a #767676 bar. Only mixer value boxes are #bfbfbf | §2.1 |
| 13 | Meter: green → lime only | Has a yellow >0 dB band (#ffd00a) before red | §2.1 |
| 14 | `lane1`/`lane2` alternate **per track** | Live alternates **per bar** (vertical tiles) and never per track | §2.2 |
| 15 | Note colours: unselected #232834, selected #ff1200 | Live: unselected notes are **red, shaded by velocity**. Selected colour: verify. Today's kit may have them swapped | §2.2 |
| 16 | Session view: glossary says "no direct twin" | No clip launcher is possible natively. Three honest approximations are given | §3.6 |

---

## 1. Version notes

| | Live 9 (target look) | Live 10/11 | Live 12 |
|---|---|---|---|
| Default theme | light grey ("Live 9" skin, §2.1) | light/mid themes, e.g. "Mid Light" (values in §2.1) | "Default" theme with Tone/Contrast/Dark-Light settings. **Default is Dark** (verify exact name) |
| UI font | Live's own pre-Ableton-Sans face. Titles look bold/italic in the ref (verify) | **Ableton Sans** (introduced in Live 10) | Ableton Sans |
| Session title bars | grey; selected = light #b5b2b1 (ref) | in track colour (verify) | in track colour |
| Arrangement vol/pan in header | plain value boxes `0.00` / `C` | value box with a fill bar (blue/cyan) plus `C` box (Live 11 manual, Mixing chapter) | same. Live 12 also adds a full mixer in Arrangement (`⌘⌥M`) |
| Follow key | `⌘⇧F` (Ctrl+Shift+F) | `⌘⇧F` | Mac `⌥⇧F` (`⌘⇧F` was reused for note filters) |
| `⌘E` in the MIDI editor | split notes | chop on grid / split at selection (11.1+) | same as 11 |
| Take lanes / comping | no | Live 11+ (`⌘⌥U`) | yes |

---

## 2. Look

### 2.1 Palette mapped to `KitColors`

"Skin" means the stock Live 9 skin key (reference only; not shipped). "Ref" means sampled from a reference Live 9 screenshot.

| KitColors role | **Live 9 hex** | Source | Live 11 Mid Light | Live 12 Light Neutral Med | Today's kit | Change? |
|---|---|---|---|---|---|---|
| `bg` (window chrome, control-bar background) | **#767676** | skin `Desktop`. Ref outer frame/bar #767676 | #707070 | #818181 | #8d8d8d | yes |
| `panel` (browser, mixer, session headers) | **#8d8d8d** | `SurfaceBackground`. Ref #8d8d8d | #8f8f8f | #a5a5a5 | #8d8d8d | – |
| `track` (TCP background) | **#8d8d8d** | same | | | #8d8d8d | – |
| `trackSel` | **#b5b2b1** | `SurfaceHighlight`. Ref selected header #b5b2b1 | #aaaaaa | #bcbcbc | #b5b2b1 | – |
| `face` (button off, empty boxes) | **#999999** | `ControlBackground`. Ref S/arm face #999999 | #b7b7b7 | #cfcfcf | #999999 | – |
| `line` (panel gaps, dividers) | **#5c5c5c** | `SurfaceArea`. Ref gaps #515151–#5c5c5c | #505050 | #6e6e6e | #5a5a5a | ~ |
| `deep` (1px control outline) | **#323232** | `ControlContrastFrame` | #444444 | #4f4f4f | #323232 | – |
| `text` | **#000000** | `ControlForeground` | #000000 | #121212 | #111111 | ~ |
| `dim` | **#5a5a5a** | `TextDisabled` | #696969 | #6e6e6e | #3d3d3d | yes |
| `accent` (lit toggles: activator, loop, follow) | **#ffc907** | `ChosenDefault`. Ref activator #ffc907 | #ffb100 | #ffb901 | #ffc907 | – |
| `accent2` (selection, focused) | **#7fffff** | `SelectionBackground`. Ref selected scene #7fffff | #bfe9ff | #cdf8ff | #5cd9e8 | yes |
| *new* `selStandby` (selection, unfocused) | **#9ad1c9** | `StandbySelectionBackground` | #a5b9c6 | #abc6cb | (genlist only) | add |
| `solo` | **#2883c9** | `ChosenPreListen` | #3873ff | #1a7df1 | #2883c9 | – |
| `arm` | **#ff3223** | `ChosenRecord` | #ff563f | #ff595f | #ff3223 | – |
| `play` | **#50ff1e** | `ChosenPlay` | #18e27d | #00faa3 | #50fe1e | ~ |
| `onInk` | **#000000** | `ControlOnForeground` | | | #111111 | ~ |
| `display` (control-bar fields: TAP, tempo, position) | **#999999** | `TransportOffBackground`. Ref tempo box #999999 | #aaaaaa | #a5a5a5 | #bfbfbf | **yes** |
| *new* `valueBox` (mixer/TCP number boxes) | **#bfbfbf** | `ControlTextBack`. Ref vol box #c0c0c0 | #dcdcdc | #dfdfdf | (uses display) | add |
| `displayText` | **#000000** | | | | text | – |
| `knob` (value arc) | **#f26000** | `RangeDefault`. Ref pan arc ≈#dd5703 | #55def6 | #00eeff | #f26000 | – |
| *new* `knobRing` / needle | **#141414** | `Poti`, `PotiNeedle` | #191919 | #242424 | mix(text, face) | add |
| *new* `knobCentre` (outlined centre triangle) | **#636363** | `BipolarPotiTriangle` | #191919 | #242424 | derived | add |
| `meter.off` | **#181e23** | `MeterBackground`. Ref #171d22 | #191919 | #242424 | #181e23 | – |
| `meter.low` | **#0af864** | Live 9 skin, `StandardVuMeter.Minimum` | #0af864 | #00f758 | #0af864 | – |
| `meter.mid` (0 dB) | **#c6f864** | `…ZeroDecibel` | #c6f864 | #ffd100 | #5ff864 | yes |
| `meter.high` (>0 dB) | **#ffd00a** | `…AboveZeroDecibel` | #ffd00a | #ff0a0a | #c6f864 | yes |
| `meter.clip` | **#ff0a0a** | `…Maximum` | #ff0a0a | #ff0a0a | #ff0a0a | – |
| `notes.off` (unselected) | **red by velocity**: `mix(row, #ff1200, 0.2 + 0.8·vel/127)` | `MidiNoteMaxVelocity` #ff1200, `MinVelocityNoteBlendFactor` 0.2. Lower velocity draws lighter ([trainer][mg]) | #e95449 | #e95449 | #232834 | **verify/swap** |
| `notes.on` (selected) | **verify**. Best guess dark slate #232834 (the ref's notes in the Envelopes tab are #232834) | `LoopColor` #232834 | | | #ff1200 | verify |
| `notes.bg` | #b4b4b4 | `DetailViewBackground` | #aaaaaa | #c6c6c6 | #b4b4b4 | – |

Engine notes:
- Add `valueBox`, `selStandby`, `knobRing` and `knobCentre` to `KitColors`. The kit currently uses one `display` for both transport fields and TCP/MCP boxes.
- Leave `env` (automation modes) as is. Live's automation colour is #ff1200 (`AutomationColor`); disabled is #545454.

### 2.2 Arrangement, MIDI editor and REAPER colour keys

| Role | Live 9 | REAPER theme keys | Notes |
|---|---|---|---|
| Track lane | **#b4b4b4** (verify for the arrangement; it is the Detail View value, ref) | `col_tr1_bg` = `col_tr2_bg` (**same value**) | Live never alternates per track |
| Selected track lane | #bebcbb (verify) | `selcol_tr1_bg`, `selcol_tr2_bg` | subtle |
| Area below the last track | #8d8d8d | `col_arrangebg` | |
| Bar tiles | `ArrangerGridTiles` #00000009 → bars alternate #b4b4b4 / ≈#a9a9a9 (ref Detail View) | *not possible* | REAPER has no per-bar shading. Use a stronger measure line instead |
| Grid: measure / beat / sub-beat | black at ~25 / 12 / 6 % on the lane → **#878787 / #9e9e9e / #a9a9a9** | `col_gridlines2` / `col_gridlines3` / `col_gridlines` | `GridLineBase` #000 with alpha |
| Ruler background | **#7d7d7d** (ref) | `col_tl_bg`, `region_lane_bg`, `ts_lane_bg`, `midi_rulerbg` | |
| Ruler text | #000000 | `col_tl_fg`, `col_tl_fg2`, `*_lane_text`, `ruler_header_text`, `midi_rulerfg` | |
| Time selection | #7fffff at ≈35 % | `col_tl_bgsel` (+ `timesel_drawmode`), `midi_selbg` | standby #9ad1c9 |
| Loop region on the ruler | **#232834** (loop on). #2328344b when off | `col_tl_bgsel2` | Live's dark loop brace |
| Insert marker | #000000 | `col_cursor`, `col_cursor2`, `midi_editcurs` | Live blinks it; REAPER cannot |
| Play cursor | #000000, 1px | `playcursor_color` | |
| Clip title bar | clip colour, full strength, black 9px text | item label strip (Prefs › Appearance › Media items: "draw labels above items" + label background; verify) | |
| Clip body | clip colour, lighter (`ClipBlendFactor` 0.75) | `col_mi_bg*`, `col_tr*_itembgsel` + tint by take/track colour | |
| Waveform / MIDI dashes | **#141414** | `col_tr1_peaks`, `col_tr2_peaks` | `WaveformColor` |
| Clip border | #000000, 1px, square | item edge keys | `ClipBorder` |
| Locators (markers) | small dark triangles, black labels | `marker` #232834, `marker_lane_text` #000 | Live 9 has no regions. Use `region` #ffc907 sparingly |
| Automation | #ff1200 | track envelope colours | |
| Piano roll: white-key rows | #b4b4b4 | `midi_trackbg1` | |
| Piano roll: black-key rows | #a9a9a9 | `midi_trackbg2` | |
| Piano roll: outside the clip | #999999 / #939393 | `midi_trackbg_outer1/2` | |
| Selected pitch row | #c3c0bf | `midi_selpitch1/2` | |
| Piano-key pane | #8d8d8d | `midi_leftbg` | |
| Browser/list selection | #7fffff focused, #9ad1c9 unfocused, ink #000 | `genlist_selbg`, `genlist_seliabg`, `col_explorer_sel` | today's #9ad1c9 is the *standby* colour |

**Clip palette.** Live 9 track and clip colours are saturated pastels: cyan, cream, lime, lavender, magenta, salmon, sky, mint (see the ref). Give Assist its **own** 16-colour palette in that spirit. Do not copy Live's 60-swatch chooser.

### 2.3 Control style

- **Flat, square corners, no gradients or shadows.** `look: "flat"`, `radius: 0`.
  - Every control is a fill plus a 1px `deep` (#323232) outline.
  - The only rounded element in Live 9 is the peak-level pill above the mixer volume box.
- **Track activator.**
  - 28×22 box (mixer) or 56×20 (track header) holding the track **number** in black.
  - On (track plays): yellow #ffc907. Off (muted): `face` #999999, number still black.
- **Solo:** "S" in black. Off: #999999 face. On: #2883c9 fill, black ink.
- **Arm:** black dot. Off: #999999 face. On: #ff3223 fill, black dot.
  - Live 9 draws it as a filled circle. Live 11 uses a ◑ glyph for MIDI tracks (seen in a reference screenshot, track 1).
- **Pan knob** (mixer, 28px):
  - Open dark ring, 270°, ~2px #141414, with a needle from the centre.
  - The value is an orange #f26000 arc from 12 o'clock.
  - A small triangle sits above: outlined #636363 when centred, filled orange when off-centre.
  - Today's `knob()` flat branch already does this.
- **Mixer volume:**
  - A light outlined triangle (◁) beside the meter, pointing at it. No visible fader track.
  - Meter: two thin bars (≈5px each, 1px gap) on #181e23, green → lime → yellow → red.
  - dB scale: black 7–8px numbers 6, 0, 6, 12, 18, 24, 36, 48 (no minus signs).
  - Today's `marker()` and `scaleMark()` match this.
- **Value boxes:**
  - #bfbfbf fill, #323232 outline, black text centred.
  - Live 9 shows "0.00" (no "dB") and "C"/"25L". REAPER shows "0.00dB"/"center". This is acceptable.
- **Control bar:**
  - #767676 background.
  - Each field is a #999999 box with a #323232 outline and black text. Bars.beats position looks like "23. 2. 2".
  - Icons are black. Lit toggles are a yellow fill with black glyph.
  - Play when running: green ▶ glyph on a grey box (ref). Record when on: red. Verify whether Live 9 fills the record box or only the glyph.
- **Clips:** title bar ≈12px, body below, 1px black border, square corners (§2.2).
- **Fonts** (use system sans: Helvetica Neue / Segoe UI / Arial; never Ableton Sans):

  | Text | Size at 100 % | Weight |
  |---|---|---|
  | Track and title names | ≈10px | bold. The ref titles look bold-italic (verify; do not fake italics unless confirmed) |
  | Values and buttons | 9px | regular |
  | Meter scale | 7px | regular |
  | Control-bar numbers | 11px | regular |

  Set REAPER theme user fonts 1–8 accordingly (`.font [n]` in WALTER).
- **Sizes** (base units, ×1.5 / ×2 for HiDPI):
  - The ref is downscaled (≈0.69). Measured there: activator ≈18px tall vs S/arm ≈12px, so ≈26px vs ≈17px at real size.
  - Today's `SIZES.ableton` (`mcpMute 28×22`, `mcpBtn 28×16`, knob 28) is right.

---

## 3. Layout

### 3.1 Arrangement track header (TCP) on the right

**REAPER side:**
- `[reaper] mixerflag |= 32` puts the TCP on the right of the arrange view. This is already in `src/profiles/engine/workspace.ts` as `tcpRight`. Make it **default on** for this profile.
- The layout is the same for either side.

**Live 11 header** (Live 11 manual, Mixing chapter), left → right:
- `[▾ name column, full height, track colour]`
- `[I/O column (optional): input chooser / In-Auto-Off / output]`
- `[mixer column: (activator number)(S)(arm) / (vol box)(pan box) / (send boxes)]`
- `[thin stereo meter]`

The I/O, Sends and Mixer columns are shown/hidden by `⌘⌥I`, `⌘⌥S`, `⌘⌥M`.

**WALTER spec** (base units, 4px grid, 20px rows):
- `M = 136` (mixer column). `IO = 128` when `k_io` is on, else 0.
- `define_parameter` entries `k_io` (default 0), `k_sends` (0), `k_mix` (1), `k_live9` (1 = grey session titles).
- The scripts in §4.8 flip these with `ThemeLayout_SetParameter` + `ThemeLayout_RefreshAll`.

| Element | Rect `[x y w h]` | Notes |
|---|---|---|
| `tcp.custom.kName` (fill) | `[0 0 (w−M·k_mix−IO) (h−1)]` | track colour (`trackcolor_valid`), else `face`. **Full height**, not a row. Selected track: the whole TCP background uses `tcp_bgsel` (#b5b2b1) |
| `tcp.foldercomp` / `tcp.env` | `[2 4 18 18]` | the "▾": fold for folders (`folderstate==1`), automation (`tcp.env`) otherwise |
| `tcp.label` | `[22 3 (nameW−26) 20]` | bold, black, or `ON_COLOR` on dark track colours |
| `tcp.recinput` | `[xI+4 4 120 20]` | only if `k_io`. `xI = w−M−IO` |
| `tcp.recmon` / `tcp.io` / `tcp.fx` | `[xI+4 28 36 20]` / `[xI+44 28 36 20]` / `[xI+84 28 40 20]` | only if `k_io`. Live has no FX button; FX opens by double-clicking the name (§4.5) |
| `tcp.mute` = **activator** | `[xm 4 56 20]` | `xm = w−M`. Art: blank yellow/grey box (no speaker glyph) |
| `tcp.trackidx` | `[xm 4 56 20]`, `front` | **verify click-through.** `walter.ts` notes REAPER gives clicks on the number to the number. If REAPER 7.82 still does this when `tcp.mute` is listed after it, fall back to a 14px-wide trackidx in the box's left gutter and a 42px mute box beside it. Do **not** emulate with 99 custom buttons: mute state is not shown and there is a `MAX_CUSTOM_CONTROLS` cap |
| `tcp.solo` | `[xm+60 4 28 20]` | |
| `tcp.recarm` | `[xm+92 4 28 20]` | |
| `tcp.volume` + `.label` | `[xm 28 56 20]`, `fadermode [-1]` | `tcp_volbg` = a `valueBox` image. `tcp_volthumb` = 2px dark tick (Live 10+ look) or transparent (Live 9 look). Label centred on top. h ≥ 48 only |
| `tcp.pan` + `.label` | `[xm+60 28 60 20]`, `fadermode [-1]` | same trick. Label shows "center" / "25%L" |
| `tcp.sendlist` | `[xm 52 120 (h−56)]` | only if `k_sends` and h ≥ 72 (REAPER 7 TCP send list) |
| `tcp.meter` | `[w−12 2 8 (h−4)]`, `vu.div [1 1]` | no readout, no scale |
| `tcp.fxparm` / `fxembed` | hidden | not Live |

Master TCP:
- Name "Master" in a `face` box.
- No activator or arm.
- `master.tcp.mono` in the arm slot; volume/pan boxes as above.

### 3.2 Session mixer strip (MCP)

Live 9 strip, top → bottom (reference screenshot; Live manual "Mixing"):
1. Title (in the clip grid header)
2. Optional In/Out (input type and channel, In/Auto/Off, output)
3. Sends: small knobs, two per row, labelled A/B, with a "Sends" caption
4. Mixer:
   - **left column:** peak pill (e.g. "-0.46"), volume box ("-7.0"), pan knob, activator, S, arm
   - **right:** volume ◁ beside the meter, then the dB scale

Today's `mcpAbleton` already matches the main section (volume box, pan, activator/solo/arm, marker, meter, scale). Changes:

| Item | Change |
|---|---|
| Title row `[0 0 w 20]` | Live 9 = grey `face`, black bold text, selected = #b5b2b1. Live 10+ = track colour. Switch with `k_live9` |
| FX/IO/env/monitor icon row (y 23) | Show only when `k_io`. Live's equivalents are choosers. `mcp.recinput [4 22 76 16]`, `mcp.recmon [4 40 24 16]`, `mcp.io [30 40 24 16]`, `mcp.fx [56 40 24 16]` |
| Sends | REAPER's extended mixer `sendlist` is a list of sliders, not knobs. Cannot be Live's knobs. Style the rows as `valueBox` fields; show with `k_sends` |
| Activator | number inside the yellow box (same click-through test as §3.1). Drop the separate `mcp.trackidx` above the button |
| Button stack | Live places activator/S/arm right under the pan knob, with the meter running to the bottom. Either keep today's bottom-pinned stack or stack from `T+60`. Both read correctly |
| Peak pill | REAPER cannot move the meter readout out of the meter (`.readout.color` only). Omit, or show REAPER's readout inside the meter top |
| Width | 84 is fine (Live's strip width varies with track width) |
| Master | no activator; "Solo" (cue) and a cue-volume knob in Live → REAPER `master.mcp.mono` + `menubutton`. Fine as is |

### 3.3 Control bar (transport, docked at the top)

**Live 9** (reference screenshot), left → right:
- `EXT` (only when synced), `TAP`, tempo `130.00`, nudge `−`/`+`, signature `4 / 4`, global groove `130%` (only when grooves are used; Live 12 manual), metronome `○●` + `▾`, quantization `1 Bar ▾`
- follow, position `23. 2. 2`, ▶, ■, ●, MIDI overdub `+`, automation arm, re-enable automation `←`, session record `○`, `NEW`
- loop start, punch-in, loop switch, punch-out, loop length
- draw ✎, computer MIDI keyboard, `KEY`, `MIDI`, CPU %, `D`, MIDI I/O lights

Settings: `transport_vis=1`, `transport_dock=1`, `transport_dock_pos=3` (top of main window; already supported). `trans.size` height 32. Fields 20 tall, buttons 24×20. `c0 = w/2`.

| Live | REAPER element / action | Rect | Notes |
|---|---|---|---|
| TAP | `trans.bpm.tap` | `[8 6 36 20]` | REAPER draws its own label |
| Tempo | `trans.bpm.edit` on `k_display` | `[48 6 56 20]` | |
| Nudge −/+ | `custom trans.custom.kNudgeDn '' 41130 '' 'k_nudge_dn'` / `41129` | `[108 6 16 20]`, `[124 6 16 20]` | REAPER changes tempo by 1 BPM. Live nudges momentarily. Approximation; optional. **Verify custom buttons work in `trans.*`** |
| Signature | `trans.curtimesig` | `[144 6 40 20]` | |
| Metronome | custom button → **40364** | `[188 6 24 20]` | verify toggle-state display; else use the toolbar (§4.7) |
| Quantization menu | — | — | **no equivalent** (no launch quantize) |
| Follow | custom → **40036** | `[c0−174 6 24 20]` | |
| Position | `trans.status` | `[c0−146 6 104 20]` | Run once: 40411 (Measures.Beats), 42366 (no secondary unit). If 40532 is on, run it to hide "[Stopped]" |
| ▶ ■ ● | `trans.play` / `trans.stop` / `trans.rec` | `[c0−38…]`, `[c0−10…]`, `[c0+18…]` | |
| Automation arm | `trans.automode` | `[c0+50 6 24 20]` | ≈ global override (latch = 40881) |
| Loop switch | `trans.repeat` | `[c0+90 6 24 20]` | yellow when on |
| Loop start / length | `trans.sel` | `[c0+118 6 220 20]` | Shows the **time selection** once loop is unlinked from it (§4.6). Accept, or keep them linked (decision) |
| Punch in/out | custom → **40076** (Record: Set record mode to time selection auto-punch). 40252 sets the mode back to normal | — | optional. REAPER punches the time selection; Live has separate in/out switches |
| Draw ✎ | custom → script `k_draw_mode` | `[w−84 6 24 20]` | |
| Computer MIDI keyboard | custom → 40637 | `[w−56 6 24 20]` | §4.2 `M` |
| KEY / MIDI map, CPU, D | — | — | no equivalent. CPU: dock the performance meter (40240) if wanted |
| rew / fwd / pause | **`[0]` (hide)** | | Live has none (today's kit shows them) |

### 3.4 Browser, Detail View, Info View, Overview

| Live | REAPER | Settings (already in `src/profiles/engine/workspace.ts` unless marked) |
|---|---|---|
| Browser, left, ≈300px: Categories + Places | Media Explorer docked left, FX Browser as a second tab | `dockermodeN=1`, `dockheight_l=300`, `dockerselN=explorer`, `fxadd_dock=1`, `[REAPERdockpref] explorer/fxbrowser` |
| Sounds / Drums / Instruments | FX Browser › Instruments + Track Templates (`<Track Templates>` in Media Explorer) | |
| Audio Effects / MIDI Effects / Plug-ins | FX Browser categories (JSFX MIDI for MIDI effects) | |
| Clips / Samples | Media Explorer | |
| Places: Packs / User Library / Current Project | Media Explorer shortcuts: Kitroom, Splice, Music… (`sampleFolders`) and `<Project Directory>` | add a "User Library" shortcut to the Assist folder |
| Detail View, bottom: Clip View | MIDI editor docked bottom | `[midiedit] dock=1` |
| Detail View, bottom: Device View (horizontal device chain) | FX chain window docked bottom (vertical list + plug-in UI; there is no horizontal rack). Embedded FX UIs in the MCP are an option | `⇧Tab` script (§4.8) |
| Info View (bottom-left hover help) | none in REAPER. **Proposal:** an "Info" strip in the Assist panel. The bridge polls `GetThingFromPoint(GetMousePosition())` and shows a one-line description | new |
| Overview (top) | Navigator window (40268), docked thin at the top | optional |
| Main toolbar | Live has none | hide it, or keep a slim one (§4.7) |

### 3.5 The Tab view switch

Live's Tab swaps the main area between Arrangement and Session. Browser and Detail View stay. REAPER cannot replace the arrange view.

Options, best first:
- **A. Tested today:** Tab → 40078 (toggle mixer, docked). The MIDI-editor section passes Tab through with 32060/40401.
  - Problem: if the mixer and the docked MIDI editor share docker 0 they become **tabs** of one docker.
  - Put the mixer in its own docker at the **top** (`dockermode<k>=2`). Tab then shows a tall mixer above the arrangement while the Detail View stays at the bottom. That is closest to Live (verify the two-docker behaviour).
- **B.** Screensets: window set #1 = "Arrangement", #2 = "Session/Mixer" (mixer docker tall).
  - Script `k_view_toggle` alternates 40454 / 40455 (Screenset: Load window set #01/#02) using ExtState.
  - Assist must author the two sets (stored in `reaper-screensets.ini`, verify) while REAPER is closed.
- `⇧Tab` = clip ↔ device, script `k_detail_toggle` (§4.8).

### 3.6 Session view: honest assessment

REAPER has **no clip launcher**. It cannot have per-track independently looping clips of different lengths, launch quantization, clip stop buttons, follow actions, legato or scene capture.

Closest native approximations:

| Live idea | REAPER approximation | Fidelity |
|---|---|---|
| Clip slots of one track; one plays at a time | **Fixed item lanes** (42431 "Track properties: Set fixed item lanes"). Each lane = a slot holding a clip at the loop range. "Play only this lane" is exclusive per track, like Live. Mouse: *Fixed lane header button* click → "Play only this lane". Actions 42478–42484 / 42490 | Medium. Switching is immediate, not quantized (verify). All lanes share the project loop |
| Scenes (launch a row) | **Regions** as scenes. "Regions: Go to region NN after current region finishes playing (smooth seek)" = 41761–41800 (regions 01–40). Prefs › Audio › Seeking › smooth seek (40390) | Medium. Quantized to the region end. Linear song, not free-form |
| Clip grid UI | **Proposal:** a grid in the Assist panel (tracks × lanes/regions). Clicking a cell asks the bridge to set the lane-play state or queue a region jump | Medium–good UX; scripted |
| A real clip launcher | **Playtime 2** by Helgoboss (commercial, part of Helgobox, launched July 2024) | Good, third-party, paid. Mention only; do not bundle |

Glossary wording: "Session view → no built-in twin. Use fixed lanes as slots and regions as scenes, or the Assist clip grid."

---

## 4. Function

### 4.1 Key encoding to-dos (`src/profiles/index.ts`)

- **Add key names to `keyCode()`** (Windows VK codes; REAPER uses them on macOS too, verify each on mac):
  - `Home` 36, `End` 35, `Left` 37, `Up` 38, `Right` 39, `Down` 40
  - `Delete` 46, `Backspace` 8 (the mac "delete" key)
  - `-` 189 (`=` is 187)
- **Add `os?: "mac" | "win"` to `Shortcut`.** Live differs per platform:
  - Redo: ⌘⇧Z (mac) vs Ctrl+Y (Win)
  - Play from insert marker: ⌥Space (mac) vs Ctrl+Space (Win)
  - All mouse modifiers in §4.5
- **Mouse-wheel bindings** use special key codes in `reaper-kb.ini`. Bind each once in the Actions window and copy the `KEY` line (verify).
  - Main: wheel → 989 (scroll vertically), ⇧wheel → 988 (scroll horizontally), ⌘wheel → 990 (zoom horizontally).
  - MIDI (32060): wheel → 40432, ⇧wheel → 40433, ⌘wheel → 40431, ⌥wheel → 40430 (key-track zoom, as in Live).
- **macOS system clashes to verify:**
  - `⌘⌥M` (some apps' minimize-all)
  - `F9`–`F12` and `⌘F10`/`⌘F11` (media keys / Mission Control unless "Use F1–F12 as standard function keys" is on)

### 4.2 Main section (0)

| Live key (mac / Win) | Live meaning | REAPER | Status |
|---|---|---|---|
| Space | play from insert marker / stop | **40044** Transport: Play/stop | REAPER default; same behaviour |
| ⇧Space | continue from stop point | **40073** Play/pause | approx. Exact: script `k_continue` (§4.8) |
| F9 | record (arrangement) | **1013** Transport: Record | ✓ |
| Home | insert marker to start | **40042** Go to start of project | ✓ |
| Tab | Session ↔ Arrangement | **40078** View: Toggle mixer visible | ✓ (option B: script `k_view_toggle`) |
| ⇧Tab | Clip ↔ Device view | script `k_detail_toggle` | needs script |
| O | metronome | **40364** Options: Toggle metronome | ✓ |
| ⌘⇧F (Live 9–11) | follow | **40036** View: Toggle auto-view-scroll during playback | ✓ |
| ⌥⇧F (Live 12 mac) | follow | **40036** | ✓ (second key) |
| ⌘⌥B | browser | **50124** Media explorer: Show/hide | ✓ |
| ⌘⌥M | show/hide mixer section | script `k_tcp_section mix` (theme param) | needs script; fallback 40078 |
| ⌘⌥I | show/hide In/Out | script `k_tcp_section io` | needs script |
| ⌘⌥S | show/hide Sends | script `k_tcp_section sends` | needs script |
| ⌘⌥P | show/hide plug-in windows | **41074** Toggle show all floating windows | approx |
| ⌘, | settings | **40016** Options: Preferences… | REAPER mac default |
| ⌘⇧S | save as | **40022** File: Save project as… | ✓ |
| ⌘⇧R | export audio | **40015** File: Render project to disk… | ✓ |
| ⌘⇧E | export MIDI file | **40849** File: Export project MIDI… | ✓ |
| ⌘⇧Z (mac) / Ctrl+Y (Win, `os:"win"`) | redo | **40030** Edit: Redo | needs the `os` field |
| ⌘D | duplicate | script `k_duplicate` (fallback **41295** Item: Duplicate items) | script for time-selection case |
| ⌘⇧D | duplicate time | script `k_duplicate_time` | needs script |
| ⌘E | split at selection / insert marker | script `k_split` (40061 or 40757) | needs script |
| ⌘J | consolidate | **41588** Item: Glue items, expanding to time selection if any | ✓ (replaces 40362) |
| ⌘⇧J | crop | **40508** Item: Trim items to selected area | ✓ |
| ⌘L | loop selection (Live 12: toggle loop brace) | script `k_loop_selection` | needs script (replaces 41039) |
| ⌘⇧L | select loop contents | custom action: **40623** (Move time selection to loop points) + **40717** (Select all items in current time selection) | custom action |
| ⌘I | insert silence | **40200** Time selection: Insert empty space at time selection | ✓ |
| ⌘⇧X | cut time | script `k_time_clip cut` | needs script |
| ⌘⇧C | copy time | script `k_time_clip copy` | needs script |
| ⌘⇧V | paste time | script `k_time_paste` | needs script |
| ⌘⇧Delete (mac Backspace) | delete time | **40201** Time selection: Remove contents of time selection (moving later items) | ✓ |
| ⌘⌥F | create fade/crossfade | **40916** Item: Crossfade items within time selection | approx |
| ⌘⌥Delete | delete fades | **41193** Item: Remove fade in and fade out | ✓ |
| R | reverse audio clip | **41051** Item properties: Toggle take reverse | ✓ |
| **0** | deactivate selection (clip or track) | script `k_deactivate` (fallback **40175** Item properties: Toggle mute) | **fix: today uses ⌘0** |
| ⌘1 | narrow grid | **40783** Grid: Adjust by 1/2 | ✓ |
| ⌘2 | widen grid | **40786** Grid: Adjust by 2 | ✓ |
| ⌘3 | triplet grid | script `k_triplet` (40782 / 40785) | needs script |
| ⌘4 | snap to grid | **1157** Options: Toggle snapping | ✓ |
| ⌘5 | fixed / zoom-adaptive grid | — | **no equivalent** (partial: §4.6 grid min spacing) |
| ⌘6–⌘9, ⌘0 | global launch quantization | — | **no equivalent**; leave unbound |
| ⌘T | insert audio track | **40001** Track: Insert new track | ✓ |
| ⌘⇧T | insert MIDI track | script `k_insert_midi_track` (fallback 40701) | needs script |
| ⌘⌥T | insert return track | script `k_insert_return` | needs script |
| ⌘R | rename | **40696** Track: Rename last touched track | ✓ (tracks only) |
| ⌘G | group tracks | **42785** Track: Move tracks to new folder | ✓ |
| ⌘⇧G | ungroup | script `k_ungroup` | needs script |
| U | fold/unfold (group) | **1042** Track: Cycle folder collapsed state | approx |
| C | arm selected tracks | **9** Track: Toggle record arm for selected tracks | ✓ |
| S | solo selected tracks | **7** Track: Toggle solo for selected tracks | ✓ (replaces REAPER's split-on-S) |
| F1…F8 | activator, tracks 1–8 | **22, 30, 38, 46, 54, 62, 70, 78** Track: Toggle mute for track 01…08 | ✓ |
| ⌘⇧M | insert MIDI clip | script `k_insert_midi_clip` (fallback **40214** Insert new MIDI item…, verify whether it opens a dialog) | script preferred |
| Z | zoom to time selection | **40031** View: Zoom time selection | ✓ |
| X | zoom back | **40848** View: Restore previous zoom/scroll position | ✓ |
| W | optimise width | **40295** View: Zoom out project | ✓ |
| H | optimise height | — | no native fit-vertical; skip |
| = (+) / − | zoom in / out | **1012** / **1011** View: Zoom in/out horizontal | ✓ (new key codes) |
| ⌥= / ⌥− | track height up / down | **41325** / **41326** View: Increase/Decrease selected track heights | ✓ |
| ⌘F10 / ⌘F11 | loop start / end at insert marker | **40222** / **40223** Loop points: Set start/end point | ✓ (mac F-key verify) |
| B | draw mode | script `k_draw_mode` | needs script |
| M | computer MIDI keyboard | **40637** Virtual MIDI keyboard: Send all input to VKB | verify (may capture M itself; keep a toolbar button to exit) |
| ⌘⌥⇧F | freeze/unfreeze | script `k_freeze` (41223 / 41644) | needs script |
| ⌘⌥U | show take lanes | **42430** Track properties: Toggle fixed item lanes | ✓ |
| ⌘M / ⌘K | MIDI / key map mode | — | no equivalent (REAPER learns per parameter; Actions window for keys) |

### 4.3 MIDI editor (32060)

| Live key | Live meaning | REAPER (32060) | Status |
|---|---|---|---|
| Tab, ⇧Tab, F9, O, ⌘⇧F, ⌘⌥B, M | global keys | **40401** Misc: Pass through key to main window | ✓ (one line per key) |
| B | draw mode | script `k_draw_mode` (register in 32060 too) | needs script |
| ⌘D | duplicate | **40886** Edit: Duplicate events within time selection, if any (smart duplicate) | ✓ |
| ⌘E | chop/split notes | **40641** Split notes on grid (Live 11+). Live 9: **40046** Edit: Split notes | ✓ |
| ⌘J | join notes | **40456** Edit: Join notes | ✓ |
| ⌘U | quantize | **40469** Quantize notes position to grid | ✓ |
| ⌘⇧U | quantize settings | **40009** Quantize… | ✓ |
| ⌘L | loop selection | **40753** Edit: Set loop points to selected notes | approx (does not turn repeat on) |
| 0 | deactivate notes | **40055** Edit: Mute events (toggle) | ✓ |
| ⌘A | select all notes | **40003** Edit: Select all notes | ✓ |
| ⌘⇧A | invert selection | **40501** Invert selection | ✓ |
| ⌘1 / ⌘2 | narrow / widen grid | **40212** / **40210** Grid: Multiply grid size by 1/2 / by 2 | ✓ |
| ⌘3 | triplet | script `k_triplet` (41004 / 41003 Grid: Set grid type to triplet/straight) | needs script |
| ⌘4 | snap | **1014** View: Toggle snap to grid | ✓ |
| ↑ / ↓ | transpose a semitone | **40177** / **40178** | ✓ |
| ⇧↑ / ⇧↓ | transpose an octave | **40179** / **40180** | ✓ |
| ← / → | move by grid | **40183** / **40184** Edit: Move notes left/right one grid unit | ✓ |
| ⇧← / ⇧→ | shorten / lengthen | **40447** / **40446** Edit: Shorten/Lengthen notes one grid unit | ✓ |
| ⌘↑ / ⌘↓ | velocity ±10 | **40463** / **40465** | ✓ |
| ⌘⇧↑ / ⌘⇧↓ | velocity ±1 | **40462** / **40464** | ✓ |
| Z | zoom to selection | **40725** View: Zoom to selected notes/CC | ✓ |
| W | fit to width | **40466** View: Zoom to content | ✓ |
| = / − | zoom | **1012** / **1011** | ✓ |

### 4.4 Remove or fix in today's profile

- Remove `⌘0 → 40175`; bind `0`.
- Replace `⌘J 40362` with 41588.
- Replace `⌘L 41039` with the script.
- Replace `⌘E 40757` with the script.
- Replace `⌘⇧T 40701` with the script.
- Keep `F9`, `Tab`, `Tab@32060→40401`, `⌘D`, `⌘T`, `⌘R`, `⌘U`, `⌘⌥B`, `⌘⇧R`.
- Re-check for duplicate key+mods per section after merging: the tables in §4.2 and §4.3 are unique within each section.

### 4.5 Mouse modifiers

Set them with `reaper.SetMouseModifier(context, flag, action)`.
- Flag: +1 shift, +2 control (**Cmd on macOS**), +4 alt/opt, +8 win (**Control on macOS**).
- Click and double-click contexts accept a command id + `" c"` or a script id `"_RS…"` (REAPER API text).
- Behaviour names are REAPER's own strings (found in REAPER 7.82). Every row is **verify**: test that the behaviour exists in that context.
- Live uses **different physical modifiers per OS**, so write two maps:
  - copy: ⌥ (mac, flag 4) vs Ctrl (Win, flag 2)
  - velocity / ignore grid: ⌘ (mac, flag 2) vs Alt (Win, flag 4)

| Live gesture | REAPER context | Flag mac / win | Behaviour |
|---|---|---|---|
| Click empty arrangement: set insert marker | `MM_CTX_TRACK_CLK` | 0 | Deselect all items and move edit cursor |
| Drag empty arrangement: time selection | `MM_CTX_TRACK` (left drag) | 0 | Select time |
| Double-click empty MIDI track: new clip (Live 10+; Live 12 manual) | `MM_CTX_TRACK_DBLCLK` | 0 | `_RS…` k_insert_midi_clip (at mouse) |
| Drag clip title bar: move | `MM_CTX_ITEM` (upper half) | 0 | Move item |
| Copy a clip | `MM_CTX_ITEM` | 4 / 2 | Copy item |
| Ignore grid | `MM_CTX_ITEM` | 2 / 4 | Move item ignoring snap |
| ⇧⌥-drag: slide contents | `MM_CTX_ITEM` | 5 / 5 | Move item contents |
| Drag clip body: select time inside the clip | `MM_CTX_ITEMLOWER` | 0 | Select time (verify it is offered here). Lower the `itemlowerhalf_minheight` pref (default ≈44) to ≈28 |
| Click clip: select it and place insert marker | `MM_CTX_ITEM_CLK` | 0 | Select item and move edit cursor |
| Double-click clip: Clip View | `MM_CTX_ITEM_DBLCLK` | 0 | REAPER default ("MIDI: open in editor, … Audio: show media item properties") |
| Drag clip edge: trim/extend (loops if looping) | `MM_CTX_ITEMEDGE` | 0 | Move edge. Set "loop source" on new MIDI items (§4.6) |
| ⇧-drag: stretch | `MM_CTX_ITEMEDGE` | 1 / 1 | Stretch item |
| Drag fade handle (top corner) | `MM_CTX_ITEMFADE` | 0 | Move fade |
| Fade curve | `MM_CTX_ITEMFADE` | 4 / 4 | Adjust fade curve |
| ⌥-drag automation segment: curve | `MM_CTX_ENVSEG` | 4 / 4 | Edit envelope segment curvature |
| Double-click track name: Device View | `MM_CTX_TCP_DBLCLK` | 0 | `40291 c` (Track: View FX chain for current/last touched track) |
| Drag beat-time ruler: zoom (vertical) / scroll (horizontal) | `MM_CTX_RULER` | 0 | Hand scroll and horizontal zoom. **Optional**: it costs REAPER's ruler loop-drag |
| **MIDI editor, Draw mode OFF** | | | |
| Click empty: deselect + insert marker | `MM_CTX_MIDI_PIANOROLL_CLK` | 0 | Deselect all notes and move edit cursor |
| Drag empty: select notes and time | `MM_CTX_MIDI_PIANOROLL` | 0 | Marquee select notes and time |
| Double-click empty: add note | `MM_CTX_MIDI_PIANOROLL_DBLCLK` | 0 | Insert note |
| Drag note: move | `MM_CTX_MIDI_NOTE` | 0 | Move note |
| Velocity | `MM_CTX_MIDI_NOTE` | **2 / 4** | Edit note velocity. Live also uses this modifier for a horizontal un-snapped move; REAPER cannot split by direction, so velocity wins |
| Copy notes | `MM_CTX_MIDI_NOTE` | **4 / 2** | Copy note |
| Double-click note: delete | `MM_CTX_MIDI_NOTE_DBLCLK` | 0 | Erase note |
| Click note | `MM_CTX_MIDI_NOTE_CLK` | 0 | Select note and move edit cursor |
| ⇧-click: add to selection | `MM_CTX_MIDI_NOTE_CLK` | 1 / 1 | Toggle note selection |
| Drag note edge: length | `MM_CTX_MIDI_NOTEEDGE` | 0 | Move note edge |
| …without grid | `MM_CTX_MIDI_NOTEEDGE` | 2 / 4 | Move note edge ignoring snap |
| **MIDI editor, Draw mode ON (B)** | | | set by `k_draw_mode` |
| Click/drag empty: draw notes | `MM_CTX_MIDI_PIANOROLL` / `_CLK` | 0 | Paint notes / Insert note |
| Click a note: delete | `MM_CTX_MIDI_NOTE_CLK` | 0 | Erase note |
| **Arrange, Draw mode ON** | | | |
| Draw automation | `MM_CTX_ENVLANE` (drag) | 0 | Freehand draw envelope |
| (Assist extra) drag empty track: new MIDI clip | `MM_CTX_TRACK` | 0 | Draw an empty MIDI item |

REAPER 7 also has **arrange-view override sets A–D** (actions 42615–42634). Their defaults (A marquee, B razor, C comping, D time selection) are user territory, so `k_draw_mode` sets contexts directly. Restore REAPER's defaults with `SetMouseModifier(ctx, -1, -1)`.

### 4.6 Preferences and options

**Method:** at setup, for each toggle action read `GetToggleCommandState(id)` and run it only if the state is wrong. This is exact and needs no guessing at ini bits. `src/profiles/engine/restore.ts` records the prior states.

| Live behaviour | REAPER setting | How | Confidence |
|---|---|---|---|
| Space plays from the insert marker; stop jumps back; ⇧Space continues | 40044 default. Keep "move edit cursor on stop" **off** | default | high (Live manual: playback begins from the insert marker; ⇧Space continues) |
| Double-click Stop / Home → 1.1.1 | Home → 40042 | key | high |
| Follow on by default, page-flip (Live 9) | 40036 → **on**; 41817 continuous scrolling → **off** (Live 10+ users may prefer on) | toggle state | high |
| Loop brace independent of selection | **40750** Options: Unset loop points linked to time selection (state of 40621 = 0) | action | high (behaviour) / decision (§3.3) |
| Playback continues past the end (loop off) | 41834 → **off**; `[reaper] stopprojlen=0` "stop at end of project" | toggle / ini | medium (ini key semantics: verify) |
| Snap on, grid 1/16 | project template: `GetSetProjectGrid` 1/16, 1157 on | template | high |
| "Adaptive grid" (`⌘5`) | Snap/Grid settings: "Show grid, line spacing **minimum** 12–16 px" (`projgridmin`) + "Grid snap settings follow grid visibility" on. Thins lines when zoomed out; does **not** refine when zoomed in | project setting | medium |
| Metronome off; count-in None | REAPER defaults. Count-in lives in the metronome settings (40363; `projmetrocountin`) | default | high |
| Clips cannot overlap (dropping one truncates the other) | **41120** Options: Enable trim content behind media items when editing; **41119** Disable auto-crossfades | action | high (Live 11 arrangement chapter) |
| "Create fades on clip edges" (4 ms) | `[reaper] deffadelen=0.004` (seconds; default 0.01). Keep 41194 default fades **on** | ini | medium |
| Recording over material → take lanes (Live 11+) | **41330** New recording splits existing items and adds takes (REAPER default) | default | high |
| Chase MIDI notes on | **41992** Options: Chase MIDI note-on/CC/PC/pitch → on | toggle | high |
| MIDI track auto-arm when selected | **40737** Track: Set automatic record-arm when track selected (per new MIDI track) | script | high |
| MIDI clips loop when extended | Prefs › Media › "Loop source for new MIDI items" (`loopnewitems` bitmask; verify bits) | pref | low on bits |
| New audio track: input 1/2, monitor Auto | `deftrackrecinput`, `deftrackrecflags` (verify encoding). Or set in `k_insert_*` scripts | ini / script | low on ini; high via script |
| Wheel scrolls; ⇧wheel scrolls horizontally; ⌘wheel zooms | §4.1 wheel bindings | keymap | medium |
| Time display bars.beats | 40411, 42366 | action | high |

### 4.7 Toolbar buttons

Live has no toolbar. These live in a slim main toolbar, or as transport custom buttons once verified.

Each entry is `item_N=<id> <label>` in `reaper-menu.ini [Main toolbar]`, with our own `toolbar_*` icons.

Order: Metronome **40364** · Follow **40036** · Draw `k_draw_mode` · Loop selection `k_loop_selection` · Snap **1157** · Narrow grid **40783** · Widen grid **40786** · Triplet `k_triplet` · Computer keyboard **40637** · Tap tempo **1134** · Capture MIDI ≈ **40686** (MIDI: Insert recent retroactively recorded MIDI for armed tracks) · Punch (record mode time-selection auto-punch) **40076** · Mixer **40078** · Browser **50124** · Detail `k_detail_toggle`.

Scripts call `SetToggleCommandState` + `RefreshToolbar2` so their buttons light up.

### 4.8 Scripts and custom actions

All scripts:
- Wrap their work in `Undo_BeginBlock` / `Undo_EndBlock`.
- Live in `Scripts/Assist/`.
- Are registered in section 0, and also in 32060 where marked.

`reaper-kb.ini` line formats:
- Script: `SCR 4 <section> <id> "Assist: …" path`
- Custom action: `ACT 0 <section> "<id>" "Assist: …" id id …`

| Script | Key | Behaviour |
|---|---|---|
| `k_split` | ⌘E | Read the time selection (`GetSet_LoopTimeRange(false,false,…)`). If non-empty and it overlaps a selected item, or any item on selected tracks: **40061**. Otherwise **40757**. |
| `k_loop_selection` | ⌘L | If there is a time selection: set loop = time selection (`GetSet_LoopTimeRange(true,true,…)`). Else if items are selected: **41039**. Then `GetSetRepeat(1)`. If neither exists: toggle repeat (Live 12 "toggle loop brace"). |
| `k_duplicate` | ⌘D | If a time selection overlaps selected items: **41296** (Duplicate selected area of items), then shift the time selection right by its length (Live moves the selection onto the copy). Else: **41295**. |
| `k_duplicate_time` | ⌘⇧D | Needs a time selection [s, e]. Select all items in it (**40717**), copy area (**40060**), set time selection to [e, e+len] and insert space (**40200**), set the edit cursor to e, paste (**42398** Item: Paste items/tracks). Finally select [e, e+len]. |
| `k_time_clip cut/copy` | ⌘⇧X / ⌘⇧C | **40717**, **40060**. For cut also **40201**. Store the length in `SetExtState("Assist","timeclip_len")`. |
| `k_time_paste` | ⌘⇧V | At the edit cursor c: time selection [c, c+len], **40200**, cursor to c, **42398**. |
| `k_triplet` | ⌘3 | Main: `GetSetProjectGrid(0,false)` → division d. If d is a triplet value, set d·1.5, else d/1.5 (equivalent to 40785 / 40782). MIDI: `GetToggleCommandStateEx(32060, 41004)` → run 41003 or 41004 through `MIDIEditor_OnCommand`. |
| `k_draw_mode` | B (0 + 32060) | Toggle ExtState `draw`. Apply the Draw ON/OFF rows of §4.5 with `SetMouseModifier`. `SetToggleCommandState`. Show a brief tooltip ("Draw mode on"). |
| `k_insert_midi_track` | ⌘⇧T | `InsertTrackAtIndex` after the last selected track. Name "N MIDI". `I_RECINPUT` = 4096 + (63 << 5) = **6112** (all MIDI inputs, all channels; verify). `I_RECMON=1`. `I_RECMODE=0`. Select only it, then **40737**. No instrument (Live inserts an empty MIDI track; the browser adds one). |
| `k_insert_return` | ⌘⌥T | Add a track at the end named "A Return", "B Return"… Tag it with `P_EXT:assist_return=1`. For every non-return track: `CreateTrackSend(src, ret)`, `D_VOL=0` (−inf, like Live's sends), `I_SENDMODE=0` (post-fader). |
| `k_insert_midi_clip` | ⌘⇧M, track double-click | Track = the one under the mouse (`GetTrackFromPoint(GetMousePosition())`), else the selected track. If there is a time selection: `CreateNewMIDIItemInProj(tr, s, e)`. Else start at the edit cursor (after **40513** for double-click) floored to the bar, length one bar (`TimeMap_GetMeasureInfo`). Select the new item. |
| `k_deactivate` | 0 | `GetCursorContext()`: 0 (track panel) → **6** Toggle mute for selected tracks; 1 (items) → **40175**; 2 (envelope) → toggle envelope bypass. |
| `k_tcp_section` io / sends / mix | ⌘⌥I / ⌘⌥S / ⌘⌥M | Find the `k_io` / `k_sends` / `k_mix` parameter (`ThemeLayout_GetParameter` loop), flip it with `ThemeLayout_SetParameter(i, v, true)`, then `ThemeLayout_RefreshAll()`. |
| `k_detail_toggle` | ⇧Tab | If the docked MIDI editor is active: close it (`MIDIEditor_OnCommand(ed, 2)`) and open the FX chain for the selected track (**40291**). Else close the FX chain (`TrackFX_Show(tr, 0, 0)`) and open the selected item in the MIDI editor (**40153**). Remember the state in ExtState. |
| `k_view_toggle` | Tab (option B) | Alternate **40454** / **40455** (Screenset: Load window set #01/#02). |
| `k_continue` | ⇧Space | The bridge's defer loop records the play position when playback stops (ExtState). The script saves the edit cursor, moves it to the stop position, plays (**1007**), then restores the edit cursor without seeking. |
| `k_ungroup` | ⌘⇧G | For a selected folder track: move its children out (fix `I_FOLDERDEPTH` on the folder and its last child), then delete the folder track. Live deletes the group track. |
| `k_freeze` | ⌘⌥⇧F | If the selected track's state chunk contains `<FREEZE`: **41644**. Else **41223**. |
| Custom action "Select loop contents" | ⌘⇧L | `ACT … 40623 40717` |

---

## 5. Glossary additions (`src/profiles/index.ts` → ableton)

| Live term | REAPER wording |
|---|---|
| Track Activator (the yellow number) | the track's mute switch, inverted: lit = playing |
| Insert marker | the edit cursor |
| Loop brace / Loop switch | loop points on the ruler / the Repeat button |
| Locator | a marker |
| Scrub area / beat-time ruler | the ruler |
| Detail View: Clip View | the MIDI editor docked at the bottom (audio: item properties) |
| Detail View: Device View | the track's FX chain |
| Instrument / Drum / Audio Effect Rack | an FX container (REAPER 7) / Kitroom pads or ReaSamplOmatic5000 per pad / an FX container |
| Group track | a folder track |
| Return track, Send A/B | a bus track that every track sends to (sends start at −inf) |
| Solo / Cue | solo (REAPER has no cue bus by default) |
| Warp, Warp markers, Warp modes | stretch markers; the item's timebase; the stretch mode (élastique) |
| Crop | Trim items to selected area |
| Freeze / Flatten | Freeze / Freeze, then keep the frozen audio (Apply track FX) |
| Take lanes / comping (Live 11+) | fixed item lanes and comp areas |
| Global quantization | none: REAPER quantizes edits, not launches |
| Groove Pool | swing grid and the Quantize dialog's swing |
| Capture MIDI | Insert retroactively recorded MIDI |
| Computer MIDI keyboard | the Virtual MIDI keyboard |
| MIDI Map / Key Map mode | MIDI learn on each parameter / the Actions window |
| Session view, scenes, clip slots | no twin: fixed lanes as slots and regions as scenes (§3.6) |

Keep the existing rows: Clip → item, Arrangement → arrange view, Device → FX, Consolidate → Glue, Freeze → Track › Freeze.

---

## 6. Do not copy

- **Brand assets:** Ableton logos, the "Live" wordmark, Ableton's name in any artwork, theme name, file name or tooltip. DAW names appear only in "Coming from Ableton Live" text.
- **Fonts and skins:**
  - Ableton Sans: proprietary; use system sans.
  - Live's `.ask` theme files: consulted for reference only and not shipped. Do not ship them, convert them, or embed their key names or structure.
  - Hex values are facts about a look and may be reused. Live's 60-swatch clip-colour chooser should not be reproduced.
- **Icon art, pixel for pixel:** follow, automation arm, re-enable, session record, the Live 9 metronome ○●, the draw pencil, the computer-keyboard glyph, the clip-slot play triangles. Draw our own from simple shapes. A triangle for play or a circle for record are generic.
- **Content:** Max for Live devices, Live Packs, Core Library samples or presets, Live's device UIs (e.g. Simpler, Operator layouts), and manual screenshots in shipped material.
- **Trade dress:** the exact *combination* of Live's control-bar ordering and iconography as a pixel replica. Our layout follows the same reading order with our own art. Per the project's direction, keep it "feels like", not "looks identical".

---

## 7. Sources

**Live manuals**
- Live 12 manual, ch. 42 "Live Keyboard Shortcuts" (fetched 2026-11-05): https://www.ableton.com/en/manual/live-keyboard-shortcuts/
- Live 12 manual, ch. 10 "Editing MIDI" (clip creation, double-click, Draw Mode, velocity Alt/Cmd-drag, copy Ctrl/Option-drag, chop/join, quantize): https://www.ableton.com/en/manual/editing-midi/
- Live 11 manual (arrangement view, session view, mixing, clip view):
  - https://www.ableton.com/en/live-manual/11/arrangement-view/
  - https://www.ableton.com/en/live-manual/11/session-view/
  - https://www.ableton.com/en/live-manual/11/mixing/
  - https://www.ableton.com/en/live-manual/11/clip-view/
- Live 11 arrangement and session mixer images in the Live 11 "Mixing" chapter
- Live 12 "Using Grooves" (Global Amount slider in the Control Bar, up to 130 %): https://www.ableton.com/es/live-manual/12/using-grooves/

**Third-party Live sources**
- Live 9 global groove beside the time signature: https://forum.ableton.com/viewtopic.php?p=1492366
- Live 9 shortcuts (B draw mode): https://ask.audio/articles/essentials-ableton-live-9-shortcuts
- Live 9 manual copy (follow = Ctrl+Shift+F): https://www.scribd.com/document/259853929/Live-Keyboard-Shortcuts-Ableton-Reference-Manual-Version-9-Ableton
- Note colour by velocity (trainer lesson) [mg]: https://www.musicgurus.com/courses/create-new-parts-audio-midi-in-ableton-live-online-course-with-isaac-cotec/lessons/how-to-edit-midi-ableton-live/
- Ableton Sans (Live 10+): https://lettersfromsweden.se/ableton
- Playtime 2: https://www.kvraudio.com/product/playtime-2-by-helgoboss-projects and https://www.kvraudio.com/forum/viewtopic.php?p=8938272

**Colour and REAPER references**
- Stock Live skin values (`.ask` theme files; reference only, not shipped): Live 9, Live 11 Mid Light, Live 12 Default Light Neutral Medium and Classic Medium Light
- A reference Live 9 screenshot and crops: pixel samples quoted in §2
- REAPER 7.82's action list (all ids)
- The WALTER docs: https://www.reaper.fm/sdk/walter/walter.php
- From the REAPER 7.82 binary strings:
  - `SetMouseModifier` API text: https://www.reaper.fm/sdk/reascript/reascripthelp.html
  - mouse-modifier behaviour names and contexts
  - ini key names
- REAPER changelog (whatsnew): WALTER `custom` controls; arrange override modifiers A–D; "Grid: optionally divide arrange view vertically by measures"
- REAPER's theme colour key list
- Assist code read: `src/profiles/index.ts`, `src/shared/skins.ts`, `src/profiles/kit/{registry,walter,art}.ts`, `src/profiles/engine/workspace.ts`
