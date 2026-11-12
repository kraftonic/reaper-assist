# FL Studio → REAPER research notes
These are the notes the FL Studio profile was built from, checked against REAPER 7.82. They may be out of date — corrections welcome via PR.

Target: FL Studio 2024/2025 (current manual, "Default" theme). Repo read: `src/profiles/index.ts`,
`src/profiles/kit/{registry,walter,art}.ts`, `src/profiles/engine/workspace.ts`. Every action id below was checked
against REAPER 7.82's action list. Section 0 = main, 32060 = MIDI editor.

**Confidence tags for colours.** **T** = official theme swatch from the "(Default)" theme in FL's
Theme settings screenshot in the official manual. **M** = sampled from an official manual
screenshot (pixel histogram of the dominant colour in the region). **C** = matches the
community FL-20 clone *butterDAWg* CSS (cross-check only). **E** = estimate. The mixer, toolbar and playlist
screenshots may be from FL 20.x, but FL 21+ still uses the same "Default" theme. The browser
screenshot (with the Sounds tab) is 2024/25 and agrees with them. **Verify everything tagged E or
"verify" against a live FL 2025 install.**

---

## 0. Biggest gaps between today's FL kit/profile and real FL Studio

| Area | Today (repo) | Real FL Studio |
|---|---|---|
| Palette | Dark slate (`bg #2b353b`, header `#46555d`), orange accent `#f59a23`, green `#8fd16a` used for play, LED, notes and items | Lighter blue-grey. Playlist grid `#42545f`, track header `#586268`, mixer strip `#3e4e55`, toolbar `#6b757b`. Theme **Highlight `#ffaa54`**, **Selection `#c3ff5a`**, **Mute LED `#8def11`**, Option `#ff6135` (T) |
| Clips / notes | Green items `#5f7f52`, green notes `#8fd16a` | Default pattern clips are slate-violet (`#636b81` header, `#3a4958` body) (M). Notes are pale mint `#c6fbd0` (M). **Selected notes and clips turn red** (selection `#cf5859`) |
| Cursor | Orange edit cursor, green play | Lime play-position marker `#b8fa59`/`#d6ff85` and a faint green line (M). FL has no separate orange edit cursor |
| Lanes | Alternate per track (`lane1`/`lane2`) | Not per track. FL shades **alternate bar groups in time** (`#42545f` / `#3b4d58`) (M) |
| Playlist header (TCP) | Channel-rack-style row: index block, LED, pan + volume knobs, name plate, solo/arm/FX | Name (top-left) and **mute LED (bottom-right)**, with a lime **selector strip** on the right edge. No knobs or buttons, except input/monitor/arm in "track mode" |
| Mixer strip (MCP) | Name plate at the **bottom**; FX/IO/env near the top; meter beside the fader | Number row (track colour) at top, then the **vertical name**, meter, LED, pan, fader, phase/swap/stereo-sep, FX-on/latency/arm, send arrow. **FX slots appear only in the right-hand inspector for the selected track** |
| Transport | play, pause, stop, rec, repeat, rew, fwd, tap, tempo, sig, time, automode, sel | **PAT/SONG**, play/pause (one button), stop, rec, tempo LCD. The song-position LCD sits separately. No rew/fwd/loop buttons, because looping is implicit |
| LCDs | Near-black with lime digits | Song position: teal-grey `#647879` with white digits. Tempo and pattern selector: light `#deeff7` with dark digits (M, verify for 2025) |
| Shortcuts | F8 opens the Media Explorer | **F8 = Plugin Picker (FX Browser 40271); Alt+F8 = Browser (50124)**. Missing: L, Ctrl+Space, Backspace (snap), Ctrl+M, PgUp/PgDn, Home, F5/F6/F10–F12, Alt+M, Shift+G, Ctrl+N, and **no piano-roll (32060) bindings at all** |
| Windows | Mixer docked at the bottom and visible | FL mixer is a **floating window, hidden until F9**. The piano roll floats too |

---

## 1. Look

### 1.1 Default palette → `KitColors`

| KitColors role | Hex | Where in FL | Tag |
|---|---|---|---|
| `bg` | `#3f4b55` | Picker panel / side-panel background; use for docker, empty TCP area, mixer empty area | M |
| `panel` (mixer strip) | `#3e4e55` | Mixer insert strip body (alternate separator `#38484e`) | M |
| `track` (header) | `#586268` | Playlist track header plate (default, no track colour) | M |
| `trackSel` | `#636e74` | FL barely lightens the header; the lime selector strip carries the selection | E |
| `face` (button) | `#626b70` | Toolbar/channel buttons: soft gradient `#656e73` → `#545d62`; channel button `#6b757b` | M |
| `line` | `#4b555c` | Group/panel dividers and settings-panel background | M |
| `deep` | `#293238` | Dark rims/outlines (toolbar lines `#293238`, browser `#20292f`) | M |
| `text` | `#e7eef2` | Theme "Text" | T |
| `dim` | `#a7b0b4` | Default "Track N" names, hint text | E (M range `#a0a9af`–`#bdc2c6`) |
| `accent` | `#ffaa54` | Theme "Highlight" (lit toolbar buttons: gradient `#ffd780`–`#ffffb2`) | T |
| `accent2` | `#c3ff5a` | Theme "Selection" (selector strips, selected meter) | T |
| `solo` | `#c3ff5a` | FL has no solo button: solo leaves the soloed LED lit and turns the others off. Reuse Selection | E (taste) |
| `arm` | `#ff6135` | Theme "Option". Mixer arm ring `#fe774e`, toolbar record dot `#ff756d` | T/M |
| `play` | `#ffc15b` | Lit Play button (FL lights Play orange-yellow, not green). PAT lit `#f9842d` | M |
| `onInk` | `#5a3200` | Glyph on lit yellow/orange buttons (dark orange-brown) | E |
| `display` | `#647879` | Song-position LCD background | M |
| `displayText` | `#ffffff` | Song-position digits | M |
| `knob` (arc) | `#ffaa54` | Off-centre value arc on pan knobs. Some knobs draw violet/purple arcs per track colour | E |
| `notes.off` | `#c6fbd0` | Piano-roll note, unselected (soft vertical gradient `#c9ffd3`→`#bdf2c7`) | M |
| `notes.on` | `#ff8a8a` | Selected notes are red. Exact hex not measured | E (verify) |
| `notes.bg` | `#42545f` | Piano-roll grid | M |
| `meter.off` | `#202f36` | Meter background | M |
| `meter.low` | `#c9fc58` | Theme "Meters" bottom (mixer lit `#aafd43`) | T |
| `meter.mid` | `#ffe25e` | Theme "Meters" middle | T |
| `meter.high` | `#ff8d3e` | Theme "Meters" top | T |
| `meter.clip` | `#ff4b4b` | Master clip | E |

**Proposed `KitColors` additions.** None of these exist today.
- `led: #8def11` (T, "Mute"). LED off: `#3d4a3a` (E).
- `toolbar: #6b757b` (M). FL's transport/toolbar is much lighter than the mixer. Transport groups are darker `#424b4f`.
- `displayAlt: #deeff7` / `displayAltText: #2b3338` (M/E). Tempo LCD and pattern-selector LCD.
- `stepOdd: #aabcc7`, `stepEven: #d8a6a8` (T). Lit steps alternate in groups of 4 beats. Unlit grey `#696f74`, unlit maroon `#7c696a` (M).
- `menu: #728889` (M, main menu strip) and `hint: #4d565c` (M, hint bar).
- `mixHeader: #728187` (M, mixer number row), `mixSel: #3e5164` (M, selected strip body), `inspector: #6e7d82` / FX slot `#637479` (M).

### 1.2 Playlist / arrange colours (`reaperColors` params + extra theme keys)

| Param / theme key | Hex | FL source | Tag |
|---|---|---|---|
| `bg` | `#3f4b55` | side panel | M |
| `lane1` = `lane2` | `#42545f` | FL doesn't alternate per track. If a hint is wanted, use lane2 `#3f515c` | M |
| `sel` (selcol_tr1/2_bg) | `#465a66` | Selected track lane: FL leaves it nearly unchanged | E |
| `ruler` (col_tl_bg) | `#2b3840` | Bar-number ruler. The time-marker row below is `#27353c` | M |
| `rulerText` | `#c0c8cc` | Bar numbers | E |
| `grid`: `col_gridlines` (bar) | `#2e404b` | Bar lines | M |
| `col_gridlines2` (beat) | `#394b56` | Beat lines | M |
| `col_gridlines3` (sub) | `#3e505b` | Sub-beat lines | E |
| `col_tr1_divline`/`col_tr2_divline` | `#2e404b` | Thin dark line between tracks | E |
| `item` (col_mi_bg) | `#636b81` | Default pattern-clip colour (header). Clip body `#3a4958` | M |
| `col_tr1/2_itembgsel` | `#a8606c` | Selected clips get a red tint (mix of item and `#cf5859`) | E |
| `peaks` | `#d3d8ec` | Notes/waveform drawn in a light tint of the clip colour | E |
| `col_mi_label` / `_sel` | `#f1f4f7` | Clip name text on the header bar | M |
| `cursor` (col_cursor) | `#9fb3bd` | FL has no edit cursor. Keep REAPER's quiet so the lime play line dominates | E (taste) |
| `play` (playcursor_color) | `#b8fa59` | Play marker lime `#d6ff85`/`#b8fa59`. FL draws the line semi-transparent, so use `playcursor_drawmode` alpha ≈ 0.6 | M |
| `col_tl_bgsel` (time sel. in ruler) | `#cf5859` | Ctrl-drag selection in the ruler | M |
| time selection over lanes | `#cf5859` @ ~35% | Red translucent overlay (`#d2a0b2` on a light clip, `#6b3a47` on a dark one) | M (verify key: `timesel_drawmode`) |
| `marker` / `region` | `#aab4b9` / `#5f6a70` | Time markers are grey tabs `#535d62`–`#5f666c` with white text | M |
| `note` (midi_notebg) | `#c6fbd0` | See 1.3 | M |
| `text` | `#e7eef2` | | T |

FL's time-based shading alternates in 4-bar blocks at the zoom level measured: `#42545f` then
`#3b4d58`. **No REAPER setting for this was found (verify).** Lanes therefore stay one
colour, and the bar lines carry the rhythm.

### 1.3 Piano roll (MIDI editor theme keys)

| Key | Hex | Tag |
|---|---|---|
| `midi_trackbg1` (white-key rows) / `midi_trackbg2` (black-key rows) | `#42545f` / `#3b4d58` | M |
| `midi_trackbg_outer1/2` (outside the item) | `#36464f` / `#33434c` | E |
| `midi_grid1` (bar) / `midi_grid2` (beat) / `midi_grid3` | `#2e404b` / `#394b56` / `#3e505b` | M/M/E |
| `midi_gridh` / `midi_gridhc` (row lines / C rows) | `#394b56` / `#2e404b` | E |
| `midi_selpitch1/2` | `#4a5d69` / `#455863` | E |
| `midi_notebg` (unselected) / `midi_notefg` (selected) | `#c6fbd0` / `#ff8a8a` | M / E |
| `midi_notemute` / `midi_notemute_sel` | `#7d8a90` / `#b07c80` | E |
| note text (names on notes) | `#32424c` (dark on mint) | M |
| ghost notes (other patterns) | `#647681` | M |
| `midi_leftbg` (behind keys) / keyboard white / black | `#4e585e` / `#ffffff`→`#e6ebf2` / `#4a4b4d` | M |
| `midi_rulerbg` / `midi_rulerfg` | `#2a373f` / `#c0c8cc` | M / E |
| `midi_editcurs` | `#b8fa59` | M |
| velocity lane stems | note colour (`#c7ffcf`) on grid bg | M |
| window title strip (piano roll, playlist, browser) | `#4e585e` | M |

For `midi_note_colormap` (kit `noteColormap`): base `off #c6fbd0`, `on #ff8a8a`, `bg #42545f`.
FL dims soft notes, so keep the velocity blend toward the background.

### 1.4 Other windows (for the Assist panel and the REAPER list colours)
- **Browser.** List background `#20292f`/`#232d33`, tab row `#2b353a`, hover/selected row `#364045`, item text `#b8dffb` (blue-white), selected tab outlined in orange `#fda24e` (M). Map to `genlist_bg #20292f`, `genlist_fg #b8dffb`, `genlist_selbg #364045`, `genlist_hilite #fda24e`, `col_explorer_sel #364045`.
- **Channel rack.** Body `#727c81`, channel button `#6b757b`, routing-number box `#646e74`, selector lit lime `#c3ff5a`, missing-plugin button red `#b25553` (M).
- **Settings/dialogs.** `#5e686e`, group panels `#4b555c`, active tab text `#3fc3ff` (M).

### 1.5 Control style
- **Look.** Vector UI with soft vertical gradients (top about 6% lighter), a 1 px dark outline (`#293238`) and no specular highlight. FL's toolbar menu offers "Flat buttons", so the default is shaded. This sits between our `flat` and `gloss`. **Recommend** `look: "gloss"` with the top highlight and drop line turned off (or a new `"soft"` look). **Radius: 3 px** (track-header plates about 4, channel buttons about 3, toolbar buttons about 2, FX slots 0) (E from screenshots).
- **Knobs.** A dark disc (`#3a4146`→`#2a3035`) with a 1 px darker rim and a thin light pointer line (`#e7eef2`). An off-default value arc runs just outside the disc: orange for pan, a purple/track tint for stereo separation in the mixer screenshot (M). The current FL kit knob (accent arc + bevelled cap) is close. Drop the bright bevel.
- **Mixer fader.** A thin dark groove (`#27373e`, 2 px) and a **light-grey rectangular cap** (`#d2d8e2` → `#7c838b`, about 20×12 px) with a dark centre line. The cap turns **lime on the selected track** and **orange when armed** (manual: "Grey (default), Green (selected), Orange (armed)"). REAPER can't change the cap by state (see 2.5).
- **Mute.** A round **LED**, about 10–12 px: lit `#8def11` with a soft glow, dark when muted. Left-click mutes. **Ctrl-click or right-click solos**, Alt-click solos the track plus its routing, Shift-click locks.
- **Arm.** A small round dot: grey off, red-orange ring/dot `#fe774e` armed. **FX** is a "disable all FX" icon per strip, yellow when FX are active (M). **Send** is an up-arrow switch, replaced by a small send knob when active. Cables run at the strip bottom.
- **Playlist track header.** A rounded plate filled with the track colour (default `#586268`), separated by 1–2 px gaps (`#555f64`). Name at top-left in small dim text. A "…" grip bottom-left. The **mute LED bottom-right**. A **selector strip** (about 6 px) at the right edge, lime when selected (M).
- **Mixer strip (Compact layout, the manual's reference).** Strip pitch about 30 px at the screenshot scale. Number row (track colour, about 20 px), optional icon row, **vertical name** (reads bottom-to-top), stereo peak meter, LED, pan knob, fader, invert-phase, swap-L/R, stereo-separation knob, FX-on, latency clock, arm, send arrow. "C" (Current) and "M" (Master) sit at the far left. Right and left docks are separated by dividers. The **inspector** on the right shows input, 10 FX slots (name, wet knob, green LED), a 3-band EQ graph, PDC and output.
- **Fonts (estimates from 100% screenshots, verify).** UI/menu about 13 px. Track and channel names about 12 px. Mixer names about 11 px (vertical). Ruler bar numbers about 10–11 px. Song-position LCD digits about 24 px with a 9 px "B:S:T" caption. Tempo about 16–18 px. FL uses a narrow humanist sans. In WALTER use font index 1 for names (11–12 px), 3 for the tempo, 5 for the song position.

---

## 2. Layout

### 2.1 Playlist track header → `tcp.*` (layout "FL Playlist", the default)
FL header ≈ 150 px wide and the default track ≈ 84 px tall (M at screenshot scale, verify at 100%).
Base units below are at 100%; W/H are the panel width and height.

| Element | Rect `[x y w h]` | Rules |
|---|---|---|
| plate | whole panel, inset 1 px top/bottom, 8 px short of the right edge | Draw as the `tcp_bg`/`tcp_bgsel` image (radius 4, soft gradient) and colour it with `tinttcp` (WALTER fills are square) |
| `tcp.label` | `[6 4 W-34 16]` | Left-aligned, font 1. Colour `#c9d1d5`; `ON_COLOR` on track colour |
| `tcp.custom.kSel` (selector) | `[W-7 1 6 H-2]` | Fill `?track_selected #c3ff5a : #3c464c` |
| `tcp.mute` (LED) | `[W-24 H-20 14 14]` | When H<36: `[W-24 6 14 14]` |
| `tcp.solo` (non-FL helper) | `[W-42 H-20 16 14]` | Only when H≥40. Dim "S", lime when on |
| `tcp.recinput` | `[6 H-22 W-110 18]` | When H≥56 (FL "audio track" row: input, monitor, arm, left to right) |
| `tcp.recmon` / `tcp.recarm` | `[W-100 H-22 20 18]` / `[W-78 H-22 18 18]` | When H≥56. Arm is a round dot |
| `tcp.fx` | `[W-52 4 22 16]` | Optional extra (FL opens the plugin by double-clicking the header). Hide when W<200 |
| volume, pan, meter, io, env, folder | `[0]` | Not in FL's playlist header. Envelopes show only when H≥110: `tcp.env [6 H-44 20 18]` |

`tcp_heights 4 28 56 84` (directive already used by walter.ts) gives full = 84 like FL. Set default track height through the project
template (RPP `TRACKHEIGHT`).

**Second TCP layout, "FL Channel rack",** for instrument tracks. This mirrors the FL channel-rack row,
left to right: LED `[4 kY 14 14]`, pan knob `[22 kY 18 18]`, volume knob `[44 kY 18 18]`,
**routing-number box** (`tcp.trackidx` on a `#646e74` LCD, `[66 kY 28 18]`), channel-button name
plate (`#6b757b`, track-colour band, `[98 kY W-112 20]`), selector strip `[W-10 6 6 H-12]`. The
current kit's TCP is close to this. Move its index block from the left edge to between the knobs and
the name.

### 2.2 Mixer insert strip → `mcp.*` (Compact-style)
Strip width 44 (FL's 30 is too narrow for REAPER's fader + meter). Master 60, shown **left**
(REAPER's default places master on the left, verify). `mcp.size [44 360 0 260]`.

| y (top→bottom) | Element | Rect | Notes |
|---|---|---|---|
| 0 | `mcp.custom.kNum` + `mcp.trackidx` | `[0 0 W 18]` | Fill track colour, else `#728187`. Number centred |
| 20 | `mcp.label` | `[2 20 W-4 72]` | FL is vertical. **Verify whether REAPER rotates a tall `mcp.label`.** If not: `[2 20 W-4 16]`, horizontal, truncated |
| 96 | `mcp.meter` | `[(W-12)/2 96 12 M]`, `M = max(60, 0.35·(H-260)+60)` | Stereo, `vu.div [2]` |
| 100+M | `mcp.mute` (LED) | `[(W-14)/2 · 14 14]` | |
| +18 | `mcp.pan` | `[(W-22)/2 · 22 22]` | Knob |
| +26 → H-118 | `mcp.volume` | `[(W-24)/2 · 24 rest]` | Light cap, thin groove |
| H-114 | `mcp.phase` / `mcp.width` | `[4 H-112 18 16]` / `[W-24 H-114 20 20]` | Invert phase / stereo separation |
| H-90 | `mcp.fxbyp` / `mcp.recarm` | `[4 H-90 18 16]` / `[W-22 H-90 18 16]` | FX on (yellow) / arm (round) |
| H-68 | `mcp.io` | `[4 H-68 W-8 18]` | Stands in for FL's send arrow (routing) |
| H-46 | `mcp.env` | `[4 H-46 W-8 18]` | |
| H-24 | `mcp.fx` | `[4 H-24 W-8 18]` | Opens the FX chain (FL inspector) |

Use `mcp_bg #3e4e55` and `mcp_bgsel #3e5164`, with a dark right divider `#2f3c42`.
`mcp.extmixer`: **off by default**, because FL shows FX only in the inspector. If the user enables it,
place it between pan and fader. Master: same structure, no arm, a meter 16 wide, and `master.mcp.mono`
in place of the arm.

### 2.3 Toolbar / transport
FL: a two-row toolbar across the top (M; icon identities verify).
- **Row 1, left to right.** Menu (FILE EDIT ADD PATTERNS VIEW OPTIONS TOOLS HELP); recording options
  (metronome, wait-for-input, count-in "3.2.1", step edit, blend, loop record, typing-keyboard-to-piano,
  multilink); **song-position LCD** (`1:01:21`, B:S:T); output oscilloscope; peak meter; CPU/memory
  panel; shortcut icons (undo history, save, render…); news.
- **Row 2.** Hint bar; master volume and master pitch knobs; **PAT/SONG**, **Play/Pause**, **Stop**,
  **Record**; **tempo LCD** `130.000`; snap selector ("Line"); pattern selector (`▸ Pattern 1 +`);
  window buttons (Playlist, Piano roll, Channel rack, Mixer, Browser, Plugin picker…).

REAPER `trans.*` (dock at the top, `transport_dock_pos=3`, height 40). Rects are `[x y w h]` with y
centred and h=26:

| x | Element | Notes |
|---|---|---|
| 8 | `trans.custom.kPatSong` 56×26 | REAPER 7 `custom … command_id … button_image`, running the L script. **Verify** that named script ids (`_RS…`) are accepted and whether a custom button can show toggle state. Fallback: a toolbar toggle (toolbars do show state) |
| 70 / 104 / 138 | `trans.play` / `trans.stop` / `trans.rec` 32×26 | FL Play is play/pause. Set `trans.pause` `[0]` and use Ctrl+Space |
| 178 | `trans.bpm.edit` + `trans.custom.kTempo` 80×26 | `displayAlt` LCD (light, dark digits), font 3 |
| 266 | `trans.status` + `trans.custom.kStatus` 150×26 | Song-position LCD `#647879`, white, font 5 |
| — | `trans.rew`, `fwd`, `repeat`, `automode`, `curtimesig`, `bpm.tap`, `rate`, `sel` = `[0]` | FL shows none of these (tap is in the tempo right-click menu). `trans.sel` may come back when W≥1300 |

The snap selector, pattern selector, CPU meter and window buttons go on the **main toolbar** (§3.7).
REAPER can't put them in the transport.

### 2.4 Windows and a fresh project
FL "Desktop (default)" arrangement (View > Arrange windows), unconfirmed (verify): toolbar on
top; **Browser docked left** at full height (about 240 px); **Playlist** fills the rest; **Channel
rack floats** over the playlist; **Mixer and Piano roll closed**, opening as floating windows with
F9/F7. New project: Pattern 1 selected, empty playlist, 4/4, snap "Line", tempo 130 (seen in the
manual screenshot, verify).

| Item | REAPER setting | Key | Confidence |
|---|---|---|---|
| Browser left + FX Browser tab | existing `WorkspacePlan{side:"left", width≈240}` | `dockermodeN=1`, `dockheight_l`, `[REAPERdockpref] explorer/fxbrowser` | high (repo-verified) |
| Transport on top | `plan.transport="top"` | `transport_dock=1`, `transport_dock_pos=3` | high |
| Mixer floating and hidden (FL) | **new plan option** `mixer:"floating-hidden"` | `mixwnd_vis=0`, `mixwnd_dock=0`. Today the code forces `1/1` for every profile | high (keys known) |
| Piano roll floating | `midiDocked:false` | `[midiedit] dock=0` | high |
| TCP on the left | leave `mixerflag` bit 32 clear | `mixerflag` | high |
| Channel rack | F6 script window, floating; position kept in ExtState | — | n/a |
| Track height 84, tempo, grid, loop on | project template RPP (`TRACKHEIGHT`, `TEMPO`, `GRID`, `LOOP 1`) | RPP | high for RPP; grid flags verify |

### 2.5 What REAPER can't do (plainly)
1. **No tool modes.** FL's Draw/Paint/Delete/Mute/Slice/Slip/Select/Zoom/Playback tools (P B D T C S E Z Y) don't exist. REAPER has one fixed set of mouse modifiers, and the 7.82 list has no action to switch modifier presets.
2. **Patterns span channels in FL.** A REAPER item belongs to one track. A "pattern" becomes one MIDI item per track, grouped (Shift+G) or handled by the scripts in §3.8.
3. No time-based alternate-bar shading (verify).
4. Vertical mixer names: unknown (verify `mcp.label` behaviour).
5. The fader cap can't turn lime/orange for selected/armed tracks; only the strip background can (`mcp_bgsel`).
6. No selected-track-only FX inspector (script S5 approximates it).
7. You can't remap clicks on TCP/MCP buttons, so Ctrl-click or right-click on the LED can't solo. A solo button stays.
8. Right-click in the arrange opens REAPER's menu. Right-click-to-delete exists only if a right-drag "erase" behaviour exists (verify).
9. No CPU panel, oscilloscope, snap selector or pattern selector inside the transport.
10. No native step-sequencer grid (script S3) and no Picker Panel (Project Bay 41157 is the nearest).
11. Left-Shift and Right-Shift can't be told apart (FL's Right-Shift+click slice).
12. No action toggles the count-in; only the metronome dialog (40363) does.

---

## 3. Function

### 3.1 Shortcuts: main section (0)
Mods use the repo's `Mod`: FL Ctrl ⇒ `cmd` (Cmd on macOS), Alt ⇒ `opt`. Space (40044), Ctrl+S, Ctrl+O,
Ctrl+Z, Ctrl+C/X/V and Delete are already REAPER defaults that match FL, so they need no binding.

| FL key | FL does | REAPER id | Notes |
|---|---|---|---|
| Ctrl+Space | Start/pause | 40073 | macOS: Cmd+Space is Spotlight (FL's manual says the same) |
| R | Record on/off | 1013 | (existing) |
| L | Pattern/Song mode | script S1 | |
| Home | Playhead to start | 40042 | needs keyCode 36 |
| Backspace | Toggle snap | 1157 | keyCode 8 |
| Ctrl+M | Metronome | 40364 | |
| Ctrl+P | Count-in | 40363 (settings dialog) | no toggle action exists |
| Ctrl+H | Panic | 40345 | |
| Ctrl+T | Typing keyboard to piano | 40637 | FL Ctrl+T also adds a marker in the playlist. Alt+T covers markers |
| F5 | Playlist | script S4 | |
| F6 | Channel rack | script S3 (phase 1: 40906 Track manager) | |
| F7 | Piano roll | 40153 | (existing) |
| **F8** | **Plugin picker** | **40271** | fixes today's F8 |
| **Alt+F8** | **Browser** | **50124** | |
| F9 | Mixer | 40078 | (existing) |
| F10 | Settings | 40016 | |
| F11 | Song info / project settings | 40021 | |
| F12 | Close all windows | 41074 | toggle, not close |
| Ctrl+Shift+S | Save as | 40022 | (existing) |
| Ctrl+N | Save new version | 41895 | |
| Ctrl+R | Export WAV | 40015 | (existing) |
| Ctrl+Shift+M | Export MIDI | 40849 | |
| Ctrl+B | Duplicate selection right | 41295 | (existing). With pooling on (§3.6) copies stay linked like FL patterns |
| Ctrl+Shift+B | Clone playlist track | 40062 | |
| Alt+T | Add time marker | 40157 | (existing) |
| Insert | Slice at cursor | 40757 | keyCode 45. macOS FL uses fn+Return (verify REAPER key) |
| C | Slice (tool) | 40746 | (existing) immediate split under the mouse, as REAPER has no tools |
| Alt+M / Alt+Shift+M | Mute / unmute selection | 40719 / 40720 | |
| Shift+G / Alt+G | Group / ungroup | 40032 / 40033 | |
| Ctrl+Alt+C | Consolidate | 40362 | glue |
| Shift+C | Select all clips by source | 41611 | pooled siblings |
| Ctrl+D | Deselect | 40289 | |
| PgUp / PgDn | Zoom in / out | 1012 / 1011 | keyCodes 33/34 |
| Shift+4 / Shift+5 | Show all / zoom to selection | 40295 / 40031 | |
| Shift+←/→ | Move selection by grid | 40793 / 40794 | arrow keyCodes 37/39 |
| Shift+↑/↓ | Move selection up/down a track | 40117 / 40118 | 38/40 |
| F2 | Rename (mixer track) | 40696 | |

Optional extras: Shift+Q → 40316 (quantize dialog); 7/8 → 40205/40204 (verify that take pitch
transposes MIDI items); 9 → 41051; Ctrl+Ins/Ctrl+Del → 40200/40201; Shift+0 → 40150;
Alt+Num* / Alt+Num/ → 40173/40172; Shift+Alt+T → 40256; Ctrl+Shift+R → 40015.
**Leave B, P, D, E, T, S, Y and Z unbound.** They are FL tools.

**`keyCode()` needs these named keys:** Backspace 8, Home 36, PageUp 33, PageDown 34, Insert 45,
Delete 46, Left 37, Up 38, Right 39, Down 40, and digits for Shift+4/5.

### 3.2 Shortcuts: MIDI editor (32060)

| FL key | FL does | REAPER id |
|---|---|---|
| Ctrl+Space | Start/pause | 40017 |
| Ctrl+A / Ctrl+D | Select all / deselect | 40003 / 40214 |
| Ctrl+B | Duplicate selection right | 40882 |
| Alt+Q / Ctrl+Alt+Q | Quantize / quick quantize | 40009 / 40469 |
| Ctrl+↑ / Ctrl+↓ | Octave up / down | 40179 / 40180 |
| Shift+↑ / Shift+↓ | Move selection up / down | 40177 / 40178 |
| Shift+← / Shift+→ | Move selection left / right | 40183 / 40184 |
| Alt+← / Alt+→ | Nudge | 40181 / 40182 |
| Ctrl+L | Quick legato | 40405 |
| Ctrl+U | Quick chop | 40641 |
| Ctrl+G | Glue notes | 40456 |
| Shift+I | Invert selection | 40501 |
| Alt+M / Alt+Shift+M | Mute / unmute | 40057 / 40058 |
| Backspace | Toggle snap | 1014 |
| PgUp / PgDn | Zoom in / out | 1012 / 1011 |
| Shift+4 / Shift+5 | Show all / zoom to selection | 40466 / 40725 |
| Ctrl+E | Step edit | 40481 |
| F7 | Toggle piano roll (close) | 2 |

**Pass through to the main window (40401)** in 32060 so window keys work from the piano roll: R, L,
F5, F6, F8, Alt+F8, F9, Ctrl+M (in FL's piano roll Ctrl+M imports MIDI; metronome kept for consistency), Home. No FL equivalent for Alt+V ghost channels (REAPER draws other
visible items greyed), Shift+C select by colour, or the tool keys.

### 3.3 Mouse: playlist → REAPER Mouse Modifiers (all **verify** names in Preferences > Mouse modifiers)

| FL (default Draw tool) | REAPER context | Behaviour |
|---|---|---|
| Left-click empty grid places the current pattern | Arrange view: left click | Action: script S2 |
| Left-drag clip moves it; Alt bypasses snap | Media item: left drag (none / Alt) | Move item / Move item ignoring snap |
| Shift+left-click or drag a clip clones it | Media item: left drag + Shift | Copy item |
| Ctrl+left-drag marquee-selects | Arrange view: left drag + Ctrl | Marquee select items |
| Drag clip edge resizes | Media item edge: left drag | Move edge (default) |
| Double-click pattern opens piano roll | Media item: double click | Open in MIDI editor (default for MIDI) |
| Right-click / right-drag deletes clips | Arrange view: right drag | Erase/delete items, **if offered** (verify). Otherwise leave the menu |
| Ctrl+right-drag zooms to the area | Arrange view: right drag + Ctrl | Marquee zoom (verify) |
| Middle-drag pans the view | Arrange view: middle drag | Hand scroll (default) |
| Click ruler moves playhead; Ctrl+drag ruler selects time | Ruler: left click / left drag | default seek / edit loop points (loop is linked to time selection) |
| Double-click track header opens the instrument | Track control panel: double click | Action 40291 (verify the context exists) |

### 3.4 Mouse: piano roll (verify names)

| FL | REAPER context | Behaviour |
|---|---|---|
| Left-click empty adds a note | MIDI piano roll: left click | Insert note |
| Left-drag on add moves the new note | MIDI piano roll: left drag | Insert note, drag to move |
| Shift-drag paints/stretches notes | MIDI piano roll: left drag + Shift | Paint notes |
| Alt adds without snap | MIDI piano roll: left drag + Alt | Insert note ignoring snap |
| Ctrl-drag marquee-selects | MIDI piano roll: left drag + Ctrl | Marquee select notes |
| Right-click / right-drag deletes | MIDI piano roll: right drag | Erase notes (default is marquee; verify single right-click) |
| Shift+click on a note clones the selection | MIDI note: left drag + Shift | Copy note |
| Alt-drag a note moves without snap | MIDI note: left drag + Alt | Move note ignoring snap |
| Double-click a note opens note properties | MIDI note: double click | Action 40004 Event properties |
| Middle-drag pans | MIDI editor: middle drag | Hand scroll (default) |

### 3.5 Mouse wheel
FL: wheel scrolls vertically, Ctrl+wheel zooms horizontally at the mouse, Shift+wheel scrolls
horizontally, Alt+wheel zooms vertically in the playlist. Over notes, Alt+wheel changes velocity
(manual + forum; Shift and Alt are **verify**). Bind in the Actions dialog. **Capture the exact
reaper-kb.ini line by binding once and exporting**, because the wheel encoding is not confirmed.

| Context | Binding | Action |
|---|---|---|
| main | Wheel / Ctrl / Shift / Alt | 989 scroll V / 990 zoom H / 988 scroll H / 1000 zoom V |
| 32060 | Wheel / Ctrl / Shift | 40432 / 40431 / 40433 |
| 32060 | Alt+Wheel | 999 "Adjust value for events" (verify it targets note velocity) |

Also set Preferences > Editing behavior > horizontal zoom centre to **mouse cursor** (ini key unknown).

### 3.6 Preferences and behaviour
Prefer setting state from the bridge Lua (`GetToggleCommandState`, then `Main_OnCommand` to reach the
target state). That is reliable, whereas the ini key names below are mostly unknown.

| Behaviour (FL default) | REAPER | How / key | Confidence |
|---|---|---|---|
| Playback **loops**: pattern in PAT, whole song in SONG | Repeat on, loop points set by S1 | 1068 state 1; RPP `LOOP 1` | high |
| Stop returns to where play started | REAPER default (play cursor returns to edit cursor) | none | medium (verify FL "Remember seek time" default) |
| Clicking the timeline seeks, even while playing | REAPER default | Preferences > Audio > Seeking (`seekmodes`?) | low on key |
| Snap on, "Line" (adaptive); step = 1/16 | Snap on, adaptive grid | 40754; adaptive grid in template `GRID` (verify flags); fallback 40776 (1/16) | medium |
| Playlist auto-scrolls with the playhead | Auto-view-scroll | 40036 state 1 | high (action) |
| Metronome off; Ctrl+M toggles | Off | 40364 state 0 | high |
| Count-in (precount) | Metronome settings | 40363 | low (no toggle) |
| Copies of a pattern stay the same pattern | Pooled MIDI on copy | **41071 state 1**. "Make unique" = 41613 | high |
| MIDI keyboard plays the **selected channel** | New instrument tracks: input All MIDI, monitor on, auto-arm on select | Preferences > Project > Track/send defaults (names verify) + 40736 per track | medium |
| Notes record into the pattern (overdub while looping) | Record mode MIDI overdub | 40503 on instrument tracks | high |
| Piano roll follows the selected pattern | Active MIDI item follows selection | 32060 40826 state 1 | high |
| Ctrl+Z toggles undo/redo (FL default) | Undo 40029, redo Ctrl+Shift+Z 40030 | no toggle; acceptable | high |
| Default pattern length 1 bar (16 steps) | New MIDI item length 1 bar | S2 creates 1-bar items | high |

### 3.7 Main toolbar (FL order)
Pattern/Song (S1, toggle) · Metronome 40364 · Count-in settings 40363 · Typing keyboard 40637 | Snap
1157 · Grid settings 40071 | Playlist (S4) · Piano roll 40153 · Channel rack (S3) · Mixer 40078 ·
Browser 50124 · Plugin picker 40271 · Project bay ("picker") 41157 | Undo history 40072 · CPU
(performance meter) 40240 · Save 40026 · Render 40015 | Make unique 41613 · Linked copies 41071 ·
Auto-scroll 40036.

Also add a **custom action** "Clone pattern" = 41295 then 41613 (FL's Alt+C clone: duplicate and make
unique). It is native and stored as an `ACT` line.

### 3.8 Lua ReaScripts (native API only; no SWS or ReaImGui)

**S1 `fl_pattern_song.lua` (L, toolbar toggle).** Keeps `assist_fl.mode` in project ExtState.
- *Pattern mode:* the current pattern is the selected MIDI item, else the last one S2 placed, else the item under the edit cursor on the selected track. Set loop points to that item's bounds (`GetSet_LoopTimeRange2(…, true, true, …)`), turn repeat on (1068 if off), move the edit cursor to the loop start, and open the item in the piano roll (40153) only if one is already open.
- *Song mode:* loop from project start to the end of the last item, rounded up to a bar (`TimeMap2_timeToBeats`). Repeat stays on.
- In both modes, call `SetToggleCommandState(sec, cmd, pattern?1:0)` and `RefreshToolbar2`. While in Pattern mode, a cheap `defer` (about 10 Hz) re-loops when the selected MIDI item changes. Exit the defer in Song mode.

**S2 `fl_place_pattern.lua` (Arrange view left click).**
- Get the track under the mouse with `GetTrackFromPoint(GetMousePosition())`. If there is none, deselect all items (40289) and exit.
- Run 40514 (edit cursor to mouse, no snap), then take `pos = SnapToGrid(0, GetCursorPosition())`.
- If the click lands on an existing item, select it, make it the current pattern, and exit (the user may be about to drag).
- If a current pattern exists: select only it, copy (40698), set the cursor to `pos`, select only the target track, run 40914, then paste pooled (41072).
- Otherwise: `CreateNewMIDIItemInProj(track, pos, pos+1 bar)`. Name the take "Pattern N" (N = count + 1) and colour it `#636b81`.
- Wrap all of it in one undo block.

**S3 `fl_channel_rack.lua` (F6).** A floating `gfx` window that remembers its dock and position.
- One row per track with an instrument (`TrackFX_GetInstrument ≥ 0`), drawn left to right as: LED (B_MUTE; Ctrl-click solos), pan knob (D_PAN, vertical drag, Alt-click resets), volume knob (D_VOL), track-number box, name button (click runs `TrackFX_Show(tr, inst, 3)`; colour band = track colour), selector (selects the track).
- After that come **16 step pads** covering the current pattern's time span. A pad is on when the track has a note at pitch `P_EXT:fl_step_pitch` (default 60) on that 1/16 step. Clicking toggles it with `MIDI_InsertNote`/`MIDI_DeleteNote` + `MIDI_Sort`, creating a pooled 1-bar item if missing.
- Groups of 4 steps alternate `#696f74`/`#7c696a` off and `#aabcc7`/`#d8a6a8` on.
- Redraw on `GetProjectStateChangeCount` change.

**S4 `fl_show_playlist.lua` (F5).** Close the active MIDI editor if it floats (`MIDIEditor_GetActive` → `MIDIEditor_OnCommand(ed, 2)`). Hide the mixer if it is visible and floating (40078). Then `SetCursorContext(1)`.

**S5 `fl_mixer_inspector.lua` (optional).** A `defer`. When the first selected track changes, close the previous track's FX chain and `TrackFX_Show(tr, 0, 1)` the new one, so a docked chain window to the right of the mixer acts like FL's inspector.

**S6 `fl_next_pattern.lua` (Num+ / Num−, optional).** Step through the project's MIDI items in time/track order, making each the current pattern (select it, and update S1's loop when in Pattern mode).

---

## 4. Glossary additions (FL term → REAPER)
- **Pattern mode / Song mode** → loop the current MIDI item / play the arrangement (L).
- **Picker panel / Clip source** → Project Bay (41157). The "current pattern" is the last selected MIDI item.
- **Make unique** → Item > Remove from MIDI pool (41613). **Clone pattern** → duplicate + make unique.
- **Pattern instances** → pooled (ghost) copies of one MIDI item (41071 on).
- **Instrument track / Audio track (Track mode)** → any REAPER track. Instrument, playlist lane and mixer channel are all the same track.
- **Mixer insert / Master / Current track** → track / master / no equivalent.
- **Send switch / sidechain** → a send (IO button or routing matrix) / a send to channels 3–4.
- **Track inspector / FX slots** → the track's FX chain window. **Patcher** → FX container. **Wrapper** → FX window.
- **Plugin picker (F8)** → FX Browser. **Plugin database** → FX Browser folders and favourites.
- **Channel rack / Step sequencer** → F6 script, or the MIDI editor in named-notes mode (40043), or Kitroom pads.
- **Ghost notes** → other MIDI items shown greyed in the MIDI editor.
- **Time marker / Song loop marker / Start-stop recording marker** → marker / loop points / auto-punch (40076).
- **Snap "Line" / "(none)"** → adaptive grid / snap off (Backspace).
- **Consolidate** → Glue (Ctrl+Alt+C). **Arrangements** → project tabs or saved versions (Ctrl+N).
- **Automation clip** → envelope or automation item. **Audio clip** → audio item.
- **Typing keyboard to piano** → virtual MIDI keyboard, "send all input" (Ctrl+T).
- **Quick legato / Quick chop / Glue notes** → Legato / Split notes on grid / Join notes.
- **Performance mode, Riff machine, Hint bar** → no REAPER equivalent.

## 5. Do not copy
No fruit logo, which also rules out FL's large desktop watermark. No product or plugin names inside
artwork. No FL icon art: draw our own simple shapes (circle LED, rectangle cap, chevrons, a plain
keyboard glyph). No bundled FL samples or templates: the template channels use Kitroom CC0 samples.
"PAT"/"SONG" are plain words and fine; avoid FL's specific lettering. Matching hex values, layout order
and behaviour is the goal.

## 6. Sources
- Image-Line manual, shortcuts: https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/basics_shortcuts.htm
- Playlist: …/html/playlist.htm (tools, track headers, mute/solo, wheel, timeline)
- Piano roll: …/html/pianoroll.htm, …/html/pianoroll_menu.htm
- Mixer: …/html/mixer.htm, …/html/mixer_trackprops.htm
- Toolbar panels: …/html/toolbar_panels.htm
- Themes: …/html/envsettings_themes.htm (default swatches screenshot)
- General settings: …/html/envsettings_general.htm. Interface basics (knobs, Alt-click reset): …/html/basics_interface.htm
- Channel rack: …/html/channelrack.htm. Browser: …/html/browser.htm
- View menu (arrange windows): …/html/menu_view.htm. What's new: …/html/basics_new_25.htm, …/html/basics_new_24.htm, …/html/basics_new_21.htm
- Default grid colour (FL ≤20.5, RGB 52/68/78): https://support.image-line.com/action/knowledgebase?ans=632
- Song looping by default: https://forum.image-line.com/viewtopic.php?p=2078420
- Selected notes shown red: https://forum.image-line.com/viewtopic.php?p=1820177
- Community FL-20 clone, colour cross-check only: https://github.com/Jaybee18/butterDAWg (`styles/*.css`)
- REAPER WALTER docs: https://www.reaper.fm/sdk/walter/walter.php
- REAPER 7.82 action list (Actions window export). Theme key names: REAPER's stock Default 7.0 theme
- Mouse-wheel sources (weak, verify): https://forum.image-line.com/viewtopic.php?p=796558, https://www.pressreader.com/australia/future-music-9629/20161117/281973197236949
