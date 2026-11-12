# REAPER configuration mechanics: research notes
These are the notes all six profiles were built from, checked against REAPER 7.82. They may be out of date — corrections welcome via PR.

How REAPER stores the settings that the six "Coming from" DAW profiles want to change: which files and keys to write, how to apply them while REAPER is running, and how to undo them.

Tags used below:
- **[confirmed]**: seen in REAPER 7.82 itself (binary strings, the action list, the bundled theme, the bundled changelog), or already verified by our code (`src/profiles/engine/workspace.ts`, `assist_bridge.lua`).
- **[source]**: documented by a third party (Ultraschall's file-format docs, public configs on GitHub), but not tested on 7.82.
- **[verify]**: not confirmed. The quick experiment that settles it is given with it.

Everything assumes REAPER 7.82 (build `7.82.0_3385784u`, macOS). Where an API arrived late, the version is given.

---

## 0. Summary: one table per file

| File (in the resource folder) | What it holds | Does REAPER rewrite it? | Live path from a ReaScript (bridge) | Restore |
|---|---|---|---|---|
| `reaper.ini` | prefs, window/dock layout, project defaults | Yes, on exit (team-verified) | `set_config_var_string(name, val, persist)` (7.74+), toggle actions, window actions | record the old value of each key (null = key was missing); put back with the same API live, or edit the file once REAPER has quit |
| `reaper-kb.ini` | shortcuts, custom actions (`ACT`), registered scripts (`SCR`) | Only if shortcuts were edited in that session (team-verified) | none for KEY lines (restart). `AddRemoveReaScript()` registers scripts live | existing `restoreKb()` |
| `reaper-mouse.ini` | mouse modifiers | When modifiers change [verify: also on exit?] | `SetMouseModifier` / `GetMouseModifier` (live, persistent) | record each touched (context, flag); live `SetMouseModifier(ctx, flag, old or -1)` |
| `reaper-menu.ini` | menus and toolbars | When "Customize menus/toolbars" saves [verify: not on exit] | none documented. Write it while REAPER is closed | per-section: put the old section back, or delete ours (missing section = REAPER default) |
| `reaper-screensets.ini` | window screensets (global) | When a screenset is saved [verify] | actions 40454-40463 (load) / 40474-40483 (save) | restore the one `[ssetN]` slot we used |
| `reaper-themeconfig.ini` | theme parameter values per theme (`define_parameter`) | When parameters change with persist | `ThemeLayout_SetParameter(..., persist=true)` | our own themes have their own section, so nothing to restore |
| `ColorThemes/*.ReaperThemeZip` | colours, fonts, WALTER layouts, images | No | `OpenColorThemeFile(path)` (team uses it) | `lastthemefn5` (already recorded) |
| `Data/toolbar_icons/*.png` | custom toolbar icons | No | picked up when a toolbar is drawn [verify: new files appear without restart] | delete our `assist_*.png` files |

---

## 1. Mouse modifiers

### 1.1 `reaper-mouse.ini` format [confirmed + source]

```ini
[hasimported]
MM_CTX_ARRANGE_MMOUSE=1
MM_CTX_ARRANGE_MMOUSE_CLK=1
MM_CTX_ARRANGE_RMOUSE=1
MM_CTX_CURSORHANDLE=1
MM_CTX_ENVLANE=1
MM_CTX_ENVPT=1
MM_CTX_ENVSEG=1
MM_CTX_ENVSEG_DBLCLK=1
MM_CTX_ITEM=1
MM_CTX_ITEM_CLK=1
MM_CTX_ITEM_DBLCLK=1
MM_CTX_ITEMEDGE=1
MM_CTX_MIDI_CCLANE=1
MM_CTX_MIDI_NOTE=1
MM_CTX_MIDI_NOTE_CLK=1
MM_CTX_MIDI_NOTE_DBLCLK=1
MM_CTX_MIDI_PIANOROLL_CLK=1
MM_CTX_MIDI_PIANOROLL_DBLCLK=1
MM_CTX_MIDI_RMOUSE=1
MM_CTX_MIDI_RULER=1
MM_CTX_RULER=1
MM_CTX_TRACK=1

[MM_CTX_MIDI_NOTE_CLK]
mm_0=1 m
mm_4=2 m
```

That is the whole file a fresh REAPER 7.82 wrote in our probe. The same content appears in other people's REAPER 7 configs on GitHub.

- **Sparse file.** A `[MM_CTX_*]` section lists only the modifier combinations that differ from REAPER's built-in defaults. A missing section or a missing `mm_N` key means "factory default". [confirmed by observation]
- **`[hasimported]`** is undocumented. Ultraschall says "purpose unknown". It lists exactly the 22 contexts that existed in REAPER 4.x and none of the newer ones (ITEMFADE, AREASEL, ARRANGE_A..D...). So it is most likely a one-time migration flag: "the pre-4.0 click preferences from reaper.ini were imported into this context". **Rule: never remove it, and write it (with the lines above) if the file doesn't exist.** [verify: delete `MM_CTX_ITEM=1` from a throwaway resource folder that has a changed `itemclickmovecurs`, start REAPER, and see whether `[MM_CTX_ITEM]` gets rewritten]
- **Section name** = context id (`MM_CTX_*`, list in 1.4). Each section can also hold `name=<text>`, the tooltip of the toolbar button for the arrange-view override contexts (7.0+). [source]
- **Key** `mm_<N>`, where N is the modifier flag 0-15 (see 1.2).
- **Value**, one of:
  - `<id> m`: a built-in mouse-modifier behaviour of that context (e.g. `4 m` in `MM_CTX_MIDI_PIANOROLL_CLK` = "Insert note"). IDs are **per context**: `3 m` means different things in different sections.
  - `<command id> c`: a built-in action, by number. Click and double-click contexts only.
  - `_<string id>`: a custom action or script (`_RS…`, `_SWS_…`, `_<custom-action id>`), with no suffix. Click and double-click contexts only.
  - `0 m` / `0`: "No action".
  - Old files have bare numbers (`mm_0=1`). REAPER still reads them as `m` IDs [source: johnnovak/configs `reaper-mouse.ini`]. Always write the suffix.

Example from a real REAPER 7 export (rewgs, 2023): `[MM_CTX_ITEMLOWER_CLK] mm_3=42388 c`.

### 1.2 Modifier flag → `mm_N` [confirmed, from REAPER's own API doc in the binary]

"Modifier flag is a number from 0 to 15: add 1 for shift, 2 for control, 4 for alt, 8 for win. (macOS: add 1 for shift, 2 for command, 4 for opt, 8 for control.)"

| N | Windows | macOS |
|---|---|---|
| 0 | (none) | (none) |
| 1 | Shift | Shift |
| 2 | Ctrl | Cmd |
| 3 | Shift+Ctrl | Shift+Cmd |
| 4 | Alt | Opt |
| 5 | Shift+Alt | Shift+Opt |
| 6 | Ctrl+Alt | Cmd+Opt |
| 7 | Shift+Ctrl+Alt | Shift+Cmd+Opt |
| 8 | Win | Control |
| 9-15 | +Win combos | +Control combos |

So a per-DAW spec written as "Cmd-drag" on Mac and "Ctrl-drag" on Windows maps to the same `mm_2`. Mac Control is `8`, not Cmd. (One public Nix module gets this wrong.) Ultraschall's note "there is no mm_8" is probably about Win-alone on Windows. [verify: `SetMouseModifier("MM_CTX_ITEM", 8, "4 m")` on macOS, then Ctrl-drag an item]

### 1.3 Applying modifiers live from the bridge (the main mechanism) [confirmed]

Native API, in REAPER since 4.0, with names supported since 7.0 and extended flags since 7.46:

```lua
-- set: context, modifier flag, action
reaper.SetMouseModifier("MM_CTX_MIDI_PIANOROLL_CLK", 0, "4 m")        -- by id
reaper.SetMouseModifier("MIDI piano roll left click", 0, "Insert note") -- by unlocalized names (7.0+)
reaper.SetMouseModifier("MM_CTX_ITEM_CLK", 0, "40746 c")             -- a built-in action (click contexts)
reaper.SetMouseModifier("MM_CTX_ITEM_CLK", 2, "_RS_assist_erase")  -- a script or custom action
reaper.SetMouseModifier("MM_CTX_ITEM_CLK", 0, -1)                     -- this combo back to default
reaper.SetMouseModifier("MM_CTX_ITEM_CLK", -1, -1)                    -- whole context back to default
-- reaper.SetMouseModifier(-1, -1, -1) resets EVERY context: never use it (it wipes the user's own map)

local cur = reaper.GetMouseModifier("MM_CTX_MIDI_NOTE", 0)   -- e.g. "1 m", "40746 c", "_RS…"
```

- Changes apply at once and persist across restarts (they are the user's mouse map, not a session state). [confirmed: API doc "create scripts to switch between mouse modifier setups"] [verify: whether `reaper-mouse.ini` is written immediately or at exit. Call SetMouseModifier, then `cat` the file]
- The name form is `<context label> <gesture>`, e.g. `"Media item left drag"` (REAPER's own example). Gestures: `left drag`, `left click`, `double click`, `right drag`, `middle drag`, `middle click`, `mouse wheel`, `mouse horizontal wheel`, `left click/drag` (MIDI CC event and segment). Context labels in the binary include `Media item`, `Media item bottom half`, `Media item edge`, `Media item fade/autocrossfade`, `Media item fade intersection`, `Track`, `Ruler`, `Arrange view`, `Arrange view override A`, `MIDI note`, `MIDI note edge`, `MIDI piano roll`, `MIDI editor`, `MIDI CC lane`, `Edit cursor handle`, `Razor edit area`. Behaviour names are the English texts shown in the Mouse Modifiers preferences ("Insert note", "Erase notes", "Paint notes", "Draw an empty MIDI item", "Delete notes/CC immediately (suppress right-click context menu)"…). **Recommended:** author the profile specs by name (readable, independent of IDs), then read the ID back with `GetMouseModifier` and store it. [verify: each name used. A failed set returns false or leaves `GetMouseModifier` unchanged]
- Extended flags (7.46): for click contexts mapped to an action, add `1024` to the flag to set "no-move (1)" and/or "no-select (2)", e.g. `SetMouseModifier("MM_CTX_ITEM_CLK", 0|1024, "3")` after the action itself was set. Use this so a "split" or "erase" click doesn't move the edit cursor. [confirmed doc] [verify: how it is written in the ini]
- Lua passes numbers as strings, so `SetMouseModifier(ctx, 0, 4)` is read as `"4"` (taken as a behaviour ID by the MyDaw scripts). Always pass `"4 m"` or `"40746 c"` explicitly.
- The Mouse Modifiers preferences page has a context-menu item "export modifiers for the current context as a ReaScript" (7.0+). Use it on a clean instance to get authoritative ID lists.

### 1.4 Behaviour IDs for the contexts the profiles need [source + cross-checks]

IDs are from Ultraschall's *Reaper-Filetype-Descriptions* (REAPER 6.x/7.x version, in the `ultraschall-lua-api-for-reaper` repo). IDs are persisted in users' files, so REAPER keeps them stable and only adds new ones. Cross-checks: the MyDaw "Mouse or Pen" script, two public REAPER 7 maps, and our probe all agree with the IDs marked ✓. **Dump the 7.82 defaults once** with *Help: Mouse modifier keys and action shortcuts* (action **40308**, generates an HTML page) on a clean instance before shipping.

**Arrange view, empty track area**
| Context | Gesture | IDs |
|---|---|---|
| `MM_CTX_TRACK` | left drag | 1 draw copy of selected item · 2 …ignoring snap · 3/4 …on same track · **5 Draw an empty MIDI item** · 6 …ignoring snap · **7 Select time** · 8 …ignoring snap · **9 Marquee select items** · 10 marquee items+time · 11 …ignoring snap · 12 marquee toggle · 13 marquee add · 14 move time selection · 15 …ignoring snap · 16-19 draw copy pooled · 20/21 edit loop points · 22 marquee zoom |
| `MM_CTX_TRACK_CLK` | left click | **1 Deselect all items and move edit cursor** · 2 …ignoring snap · **3 Deselect all items** (cursor stays) · 4 clear time selection · 5/6 extend time selection · 7/8 restore zoom · 25-30 razor-edit variants · or `<cmd> c` / `_id` |
| `MM_CTX_TRACK_DBLCLK` | double click | 0 none, or any action |
| `MM_CTX_ARRANGE_RMOUSE` | right drag | **1 Marquee select items** · 2 marquee items+time · 3 …ignoring snap · 4 select time · 5 …ignoring snap · 6 marquee toggle · 7 marquee add · **8 Hand scroll** · 9 scroll browser-style · 10 scrub · 11 jog · 12/13 looped scrub/jog · 14 marquee zoom · 15 hand scroll + h-zoom · 17 h-zoom · 19 set cursor + h-zoom · 21 set cursor + hand scroll · 22 set cursor + scroll + zoom · 24-35 razor/comp (24 select razor area) |
| `MM_CTX_ARRANGE_MMOUSE` | middle drag | 1 scrub · **2 Hand scroll** · 3 browser-style · 4 jog · 7 marquee zoom · 8 move edit cursor without scrub · 9 hand scroll + h-zoom · 11 h-zoom · … |
| `MM_CTX_ARRANGE_MMOUSE_CLK` | middle click | 1/2 restore zoom · 3 move edit cursor ignoring snap · actions |
| `MM_CTX_ARRANGE_A`…`_D` | left drag override (see 1.5) | 1 marquee items · 2/3 marquee items+time · 4/5 select time · 6/7 marquee toggle/add · 8 hand scroll · 9 browser scroll · 10-13 scrub/jog · 14 marquee zoom · 16-23 zoom/scroll variants · **24 Select razor edit area** · 25-33 razor variants · 34/35 create fixed-lane comp area |

**Media items**
| Context | IDs |
|---|---|
| `MM_CTX_ITEM` (left drag) | **1 Move item** · 2 Copy item · 3 Move item contents · 4 move ignoring snap · 5 copy ignoring snap · 6 move edges but not content · 9 move ignoring selection/grouping · 13 move ignoring time selection · 19 select time · 20/21 adjust item volume · 26 select time ignoring snap · **27 Marquee select items** · 28 marquee items+time · 32 move vertically · 36 copy vertically · 47 adjust take pan · 48 marquee zoom · 49-54 move with ripple off/per-track/all · 55-57 move contents with ripple. 7.x added "Move item horizontally…" variants and more (IDs not listed by the source, so set those by name) |
| `MM_CTX_ITEM_CLK` (left click) | **1 Select item and move edit cursor** · 2 …ignoring snap · **3 Select item** (no cursor move) · 4 toggle item selection · 5 add range · 8/9 extend time selection · 12 select ignoring grouping · 15 add stretch marker · 20 extend razor area · or `<cmd> c` / `_id` |
| `MM_CTX_ITEM_DBLCLK` | 1 open in external editor · 2 set time selection to item · 3 set loop to item · 4 item properties · 5 source properties · **6 MIDI: open in editor / subproject: open / audio: properties** · 7 take list · actions |
| `MM_CTX_ITEMLOWER*` | same lists as ITEM / ITEM_CLK / ITEM_DBLCLK for the item's bottom half. `ITEMLOWER_CLK` 0 = "pass through to item click" |
| `MM_CTX_ITEMEDGE` | **1 Move edge** · 2 Stretch item · 3 move edge ignoring snap · 4 stretch ignoring snap · 5-8 ignoring grouping · 9-12 relative edge edit · 13-18 "without changing fade time" |
| `MM_CTX_ITEMFADE_CLK` | 1 delete fade/crossfade · 3/4 next/previous shape · 7 crossfade editor |
| `MM_CTX_ITEMFADE_DBLCLK` | 1 delete fade · 2 crossfade editor |
| `MM_CTX_CROSSFADE*` | intersection: click 1/2 both fades next/prev shape, 5 editor. 7.0 default drag "moves the split point" |

**MIDI editor** (actions in these contexts are MIDI-editor-section commands)
| Context | IDs |
|---|---|
| `MM_CTX_MIDI_NOTE_CLK` | **1 Select note** · **2 Select note and move edit cursor** · 3 …ignoring snap · 4 toggle selection · 5 add to selection · **6 Erase note** ✓ · 7 toggle note mute · 10 double length · 11 halve length · 16 select all notes in measure. ⚠ REAPER 7.82 writes `mm_0=1 m`, `mm_4=2 m` as defaults, and 7.31 notes say "fix default MIDI note alt/opt-click to select note without moving edit cursor". That conflicts with the source's 1/2 labels, so **1 and 2 may be swapped [verify]**. |
| `MM_CTX_MIDI_NOTE` (left drag) | **1 Move note** · 2 …ignoring snap · **3 Erase notes** ✓ · 4 select time · 5/6 one axis only · **7 Copy note** · 8 copy ignoring snap · **9 Edit note velocity** · 10 velocity fine · 11/12 move horizontally · 13 move vertically · 15 marquee select notes · 18 marquee notes+time · 25-27 copy horiz/vert · 28 select touched · 30/31 move ignoring selection · 32 move vertically ignoring scale |
| `MM_CTX_MIDI_NOTE_DBLCLK` | 1 Erase note · 2 activate MIDI item |
| `MM_CTX_MIDI_NOTEEDGE` | 1 move note edge · 2 …ignoring snap · 3 stretch notes · 4 …ignoring snap · 5/6 ignoring selection |
| `MM_CTX_MIDI_PIANOROLL_CLK` (empty area click) | **1 Deselect all notes and move edit cursor** ✓ (default) · 2 …ignoring snap · **3 Deselect all notes** · **4 Insert note** ✓ · 5 insert ignoring snap · 8 insert note, leaving other notes selected · 9 …ignoring snap |
| `MM_CTX_MIDI_PIANOROLL` (empty area drag) | **1 Insert note, drag to extend or change pitch** · 2 …ignoring snap · **3 Erase notes** · 4 select time · 5 paint notes and chords · **7 Marquee select notes** · 10 marquee notes+time ✓ · **12 Insert note, drag to move** · 13 paint a row of same pitch · 14 insert, drag to extend · 16 scrub preview · 19 insert, drag to edit velocity · **22 Paint notes** ✓ · 23 paint straight line · 25 select touched · 27 copy selected · 29 move selected · 31 Insert note · 33-36 ignoring scale/key |
| `MM_CTX_MIDI_PIANOROLL_DBLCLK` | "Insert note" / "Insert note ignoring snap" (the source's numbering here is garbled, so set by name) |
| `MM_CTX_MIDI_RMOUSE` (MIDI editor right drag) | **1 Marquee select notes/CC** · 2 marquee+time · 4 select time · **6 Erase notes/CC** · 7 marquee toggle · 9 hand scroll · **10 Erase notes/CC immediately (suppresses right-click context menu)**, which is the FL "right-click deletes" behaviour · 11/12 touched-note selection |

Other contexts exist with their own lists (ENVPT, ENVSEG, ENVLANE, POOLEDENV, AREASEL*, LINKEDLANE*, FIXEDLANETAB*, RULER*, MARKERLANES, REGION*, TEMPOMARKER, MIDI_CCEVT/CCLANE/CCSEG, MIDI_RULER*, CURSORHANDLE, and the wheel contexts `MM_CTX_TCP_MOUSEWHEEL`, `MM_CTX_MCP_MOUSEWHEEL`, `MM_CTX_*_FADER_MOUSEWHEEL`, 7.46+). Envelope-draw IDs conflict between sources (ENVSEG "Freehand draw" is `3` per Ultraschall, `10` per MyDaw), so set those **by name**.

Factory defaults known from the changelog: 7.0 turned off the "right-click deletes notes" preference, made one MIDI editor per project the default, and made crossfade-intersection drag move the split point. Get everything else from the 40308 dump.

### 1.5 Emulating DAW "tools" (pointer / pencil / eraser / split / mute)

**A. REAPER's native tools are the "arrange view override" contexts (7.0+). [confirmed]** `MM_CTX_ARRANGE_A..D` replace *left-drag anywhere in the arrange view* (on items too) while active. Factory content: A = marquee selection, B = razor edit, C = comping, D = time selection. REAPER's default Main toolbar already has `42616 Marquee selection` and `42618 Razor editing` buttons, which are these toggles.

| Action id | Name |
|---|---|
| 42615 / 42616 | Mouse modifiers: Set / **Toggle** arrange view override mouse modifiers A |
| 42617 / 42618 | Set / Toggle … B |
| 42619 / 42620 | Set / Toggle … C |
| 42632 / 42633 | Set / Toggle … D |
| 42621 | Clear arrange view override mouse modifiers (back to the normal map) |
| 42622 / 42623 / 42624 / 42634 | Set A / B / C / D "until next mouseup" (momentary, for hold-key tools) |
| 42401 | Swap arrange view right-drag modifiers for marquee item selection and select razor edit area |
| 41356 | Options: Mouse modifier preferences… |

Override contexts only accept selection, scroll, zoom, scrub, razor and comp behaviours (the ID list in 1.4). **No draw, erase, split or mute.** Use them for "Select / Range (Pro Tools Selector) / Marquee / Razor (Cubase Range) / Comp" tools. Each override can carry its own tooltip via `name=` in its section. [verify: whether the active override survives a restart, by toggling A, restarting, and checking `GetToggleCommandState(42616)`]

**B. Everything else: a tool script that swaps a few contexts with `SetMouseModifier` and lights its toolbar button.** The MyDaw "Mouse or Pen" script uses this pattern in the wild.

```lua
-- Scripts/ReaperAssist/assist_tool_pencil.lua
-- registered in reaper-kb.ini as SCR 4 0 RS_assist_tool_pencil and SCR 4 32060 RS_assist_tool_pencil_midi
local TOOL = "pencil"
local MAP = {                                  -- context, modifier flag, value
  { "MM_CTX_TRACK",              0, "5 m" },   -- drag empty track = draw empty MIDI item
  { "MM_CTX_MIDI_PIANOROLL_CLK", 0, "4 m" },   -- click empty piano roll = insert note
  { "MM_CTX_MIDI_PIANOROLL",     0, "12 m" },  -- drag empty piano roll = insert note, drag to move
}
local NS = "assist_tool"
local _, _, sec, cmd = reaper.get_action_context()
local on = reaper.GetExtState(NS, "active") ~= TOOL
for _, m in ipairs(MAP) do
  local k = "prev|" .. m[1] .. "|" .. m[2]
  if on then
    if not reaper.HasExtState(NS, k) then reaper.SetExtState(NS, k, reaper.GetMouseModifier(m[1], m[2]), true) end
    reaper.SetMouseModifier(m[1], m[2], m[3])
  else
    reaper.SetMouseModifier(m[1], m[2], reaper.GetExtState(NS, k))  -- the value from before the tool
    reaper.DeleteExtState(NS, k, true)
  end
end
reaper.SetExtState(NS, "active", on and TOOL or "", true)
reaper.SetToggleCommandState(sec, cmd, on and 1 or 0)   -- lights the toolbar button
reaper.RefreshToolbar2(sec, cmd)
```

Tool recipes (IDs from 1.4):
- **Eraser.** MIDI: `MIDI_NOTE_CLK 6 m`, `MIDI_NOTE 3 m`, `MIDI_PIANOROLL 3 m`. Arrange: `ITEM_CLK` → custom action `ACT 0 0 "assist_erase_item" "Assist: Erase item under mouse" 40528 40006` (select item under mouse, remove items), so it doesn't delete other selected items. [verify: does a click context first select the clicked item? 7.46 added "no-select" flags, so by default it does]
- **Split / scissors.** `ITEM_CLK 0` → `42575 c` (Item: Split item under mouse cursor, no change selection), or `40746 c` (ignore grouping). Add the 1024 "no-move" flag.
- **Mute.** `ITEM_CLK 0` → `40175 c` (Item properties: Toggle mute, which acts on the selection after the click selects the item).
- **FL right-click delete.** `MIDI_RMOUSE 0` → `10 m`.
- **Drum-grid toggling (FL channel rack, Live drum rack).** `PIANOROLL_CLK 0 = 4 m`, `NOTE_CLK 0 = 6 m`, `PIANOROLL 0 = 13 m`. A public "Drums" map uses exactly this.

Caveats:
- Script toggle states (`SetToggleCommandState`) are **not** saved across restarts, but the mouse map **is**. On start, the bridge must reconcile: read `ExtState assist_tool/active` and either re-light the button or put the map back.
- "Restore REAPER" must run the same un-swap (or restore from the record in section 6).
- The deprecated actions "Set default mouse modifier action for '<context>' to '<behaviour>'" (numeric range around 39000-39999, e.g. 39291 = MIDI note drag → Erase notes) were hidden from the action list in 7.0. They "still work", but they are not in our 7.82 action list. Don't build on them.

### 1.6 `.ReaperMouseMap` import/export [source]

- A `.ReaperMouseMap` file uses the same format as `reaper-mouse.ini` without `[hasimported]`. Its default folder is `<resource>/MouseMaps/` (the folder exists in 7.82). Import/export is in Preferences → Mouse modifiers (button). The menu offers all contexts or the current one.
- **There is no API to import one.** For a live import, the bridge parses the file and calls `SetMouseModifier(section, N, value)` for every `mm_N=value` line. (Use `-1` for every other combo in a context that the map lists, if the map should replace rather than merge.)
- Ship each profile's map as a `.ReaperMouseMap` too, so users can see and import it by hand. That is the same pattern as our `.ReaperKeyMap`.

---

## 2. Toolbars and menus

### 2.1 `reaper-menu.ini` format [confirmed + source]

```ini
[Main toolbar]
default=58fbbc5960bcf836
icon_21=text_tt
item_0=40023 New project...
item_1=40025 Open project...
item_7=-1
item_8=42616 Marquee selection
item_12=1155 Enable ripple editing
item_17=42618 Razor editing
tbf_8=1
tbf_12=1
tbf_17=1
title=Main toolbar

[Floating toolbar 16]
title=Assist Tools
item_0=_RS_assist_tool_pointer Pointer
item_1=_RS_assist_tool_pencil Pencil
item_2=_RS_assist_tool_erase Eraser
item_3=-1
item_4=42616 Marquee
icon_0=assist_pointer.png
icon_1=assist_pencil.png
icon_2=assist_erase.png
icon_4=text_wide
```

- **Sections** (exact names; anything else is ignored): `Main toolbar`, `Floating toolbar 1` … `Floating toolbar 32` (actions to open 17-32 exist in 7.82: 42713-42728), `MIDI piano roll toolbar`, `MIDI event list toolbar`, `Floating MIDI toolbar 1` … `8`, `Media Explorer toolbar`, `Empty TCP area toolbar` (7.x), the menus `Main file|edit|view|insert|item|track|options|actions|extensions`, the context menus (`Ruler/arrange context`, `Track control panel context`, `Empty TCP context`, `Media item context`, `Envelope context`, `Envelope point context`, `Mixer context`, `Transport context`, `Automation item context`, …), and the MIDI menus (`MIDI main file` …, `MIDI piano roll context`, `MIDI CC lane context`, …). [source: Ultraschall list. 7.x names seen in real files]
- `item_N=<command> <label>`. N runs from 0 with **no gaps**: REAPER stops reading at the first missing index. `<command>` is one of:
  - a built-in action number (`40023`). In MIDI toolbars and menus these are **MIDI-editor-section** numbers.
  - a named id with leading underscore: `_RS<id>` (script), `_<custom action id>`, `_SWS_…` (extension).
  - `-1` = separator (toolbars and menus). In menus only: `-2 <label>` starts a submenu, `-3` ends it, `-4 <text>` is a greyed label.
  - `<label>` is the text and tooltip. Since 7.4x REAPER stores English names here. An `&` marks a menu accelerator.
- `icon_N=<value>` (toolbars only; N matches the item):
  - `<file>.png`: looked up in `<resource>/Data/toolbar_icons/` (see 2.3).
  - `text`, `text_wide` (double width), `text_tt` / `text_wide_tt` (show the label as text, "use as tooltip" variants). Seen in real 7.x files.
  - No `icon_N` means the action's default icon, or a text button.
- `tbf_N=<flags>`: per-button animation flags (7.0+), "Highlight with animation based on toggle state". The dialog offers: Do not animate / Animate if toggle state enabled / Animate if toggle state disabled, plus Highlight animation / Armed animation / Slow blink / Fast blink. Values seen: `1` (REAPER's default for 42616/42618/1155, i.e. "animate when on, highlight"), `5`, `13`. [verify the bits: set each option on a scratch toolbar and diff]
- `title=<name>`: the toolbar's display name.
- `default=<16 hex>` (7.08+): the hash of REAPER's default toolbar at the time it was customised (`Menu_GetHash(menuname, 2)`). It is used to notice new default items. Safe to omit for our own toolbars [verify: write a section without it, open Customize toolbars, check that no warning appears]. For `[Main toolbar]` we can copy the value of `reaper.Menu_GetHash("Main toolbar", 0)`.
- **A missing section means REAPER's default menu or toolbar.** That is how Restore resets one.
- Keep the file ANSI or UTF-8 **without BOM** (a BOM breaks the first section). [source]

### 2.2 Referencing our scripts and custom actions [confirmed format, readable ids = source]

Toolbar items, menu items and mouse-modifier values reference actions registered in `reaper-kb.ini`:

```ini
SCR 4 0 RS_assist_tool_pencil "Custom: REAPER Assist: Pencil tool" "ReaperAssist/assist_tool_pencil.lua"
SCR 4 32060 RS_assist_tool_pencil_midi "Custom: REAPER Assist: Pencil tool" "ReaperAssist/assist_tool_pencil.lua"
ACT 0 0 "assist_erase_item" "Custom: Assist: Erase item under mouse" 40528 40006
```

- Fields: `SCR <flags> <section> <id> "<description>" "<path relative to Scripts/>"`. REAPER writes `4` as the flags for scripts. `ACT <flags> <section> "<id>" "<description>" <cmd> <cmd> …`.
- Reference them as **`_` + id**: `_RS_assist_tool_pencil`, `_assist_erase_item`. REAPER-generated script IDs are `RS` + 40 hex digits (e.g. `_RS05dc5337c4ad7264c02ef511348f501f00254b24`), but public configs use readable ones (`RS_reavimsetup` in reavim, `"Ultraschall_Unselect_All"`). **Prefer stable readable ids** so menus, mouse maps and kb lines can be generated without running REAPER. [verify on 7.82: add the SCR line while REAPER is closed, start, and check `reaper.NamedCommandLookup("_RS_assist_tool_pencil") ~= 0`]
- A script must be registered once per section it is used in (0 = main, 32060 = MIDI editor). A toolbar button whose command doesn't exist is dropped or dead.
- Live registration: `local id = reaper.AddRemoveReaScript(true, 0, path, true)` returns the numeric id, and `reaper.ReverseNamedCommandLookup(id)` gives the `RS…` string (REAPER chooses it, and it differs per machine, so it's unsuitable for files written offline). [confirmed API]
- These lines belong to `reaper-kb.ini`, so the existing install and restore path (`mergeKb` / `restoreKb`) must add `SCR` and `ACT` lines to "our lines" alongside `KEY` lines.

### 2.3 Toolbar icons [confirmed from the 7.82 bundle]

- Folder: **`<resource>/Data/toolbar_icons/`** (REAPER ships 529 icons in `REAPER.app/Contents/InstallFiles/Data/toolbar_icons/`), plus **`150/`** and **`200/`** subfolders for HiDPI. REAPER also searches **`<resource>/ColorThemes/toolbar_icons/`** (path string in the binary) [verify the precedence].
- Image: **3 frames side by side**: normal, mouse-over, pressed/active (toggle on). PNG with alpha.

| Scale | File size | Frame |
|---|---|---|
| 100 % | **90 × 30** | 30 × 30 |
| 150 % (`150/`) | **135 × 45** | 45 × 45 |
| 200 % (`200/`) | **180 × 60** | 60 × 60 |

  (Seen in 527/529, 498/500 and 498/500 shipped icons. The exceptions are `animation_toolbar_armed/highlight`, which are 30 × 360 vertical animation strips.)
- REAPER draws these icons **over the theme's `toolbar_blank` and `composite_toolbar_overlay`**, so transparent icons pick up the theme's button chrome.
- Name ours `assist_*.png`, so we never overwrite a user icon and Restore can delete exactly ours. Subfolders inside `toolbar_icons` beyond 150/200: [verify].

**Can a theme ship toolbar icons?**
- Yes for the **built-in default-toolbar images and the chrome**. Theme image names include `toolbar_bg`, `toolbar_blank`, `composite_toolbar_overlay`, `animation_toolbar_armed`, `animation_toolbar_highlight`, and the default buttons `toolbar_new`, `toolbar_save`, `toolbar_load`, `toolbar_undo/redo`, `toolbar_grid_on/off`, `toolbar_metro_on/off`, `toolbar_lock_on/off`, `toolbar_group_on/off`, `toolbar_envitem_on/off`, `toolbar_midi_*` (Default 7 has about 40). These are sliced 3-frame buttons in the theme folder plus `150/` and `200/`.
- **Custom per-button icons (`icon_N=file.png`) come from `Data/toolbar_icons`**, not from the theme zip. Whether a theme zip's own `toolbar_icons/` folder is searched: [verify: put `toolbar_icons/assist_test.png` in a test theme zip, set `icon_0=assist_test.png`, and look]. So install our tool icons as files under `Data/toolbar_icons` (and `150/`, `200/`).

### 2.4 Showing and placing toolbars

- Open/close: `41651` Main toolbar · `41679`-`41686` toolbars 1-8 · `41936`-`41943` toolbars 9-16 · `42713`-`42728` toolbars 17-32 · `41687`-`41690`, `41944`-`41947` MIDI toolbars 1-8. Toggle state = open.
- Dock: floating toolbars are dock ids `toolbar:<N>` (seen in `reaper-screensets.ini` poslists). Live: `reaper.Dock_UpdateDockID("toolbar:16", dockerIndex)`, then open it, using the same pattern as the bridge's Media Explorer setup [verify].
- Switch the main-window toolbar: `41646` (main), `41105`-`41108` and `41647`-`41650` (toolbars 1-8).

### 2.5 Live reload of menus and toolbars

- **No documented API reloads `reaper-menu.ini`.** REAPER reads it at startup and rewrites it when the Customize dialog saves. Plan: write it while REAPER is closed (the same "after REAPER quits" step as `reaper-kb.ini`). [verify: edit `[Floating toolbar 16]` while REAPER runs, then close and reopen toolbar 16. Then open and save Customize, and check whether our edit survives]
- Semi-manual live path: export `Assist.ReaperMenuSet` (same format, one or several sections). In 7.x, importing via Customize menus/toolbars → Import is non-destructive with Apply/Cancel, and drag-dropping a `.ReaperMenuSet` onto REAPER is supported. [verify whether `reaper.Main_openProject(path_to.ReaperMenuSet)` triggers the same import]
- The 7.82 binary has `AddCustomMenuOrToolbarItem`, `DeleteCustomMenuOrToolbarItem` and `GetCustomMenuOrToolbarItem`, used by Playtime. **They are undocumented and probably C-plugin-only** (no doc string). [verify: `reaper.APIExists("AddCustomMenuOrToolbarItem")` from Lua]. `Menu_GetHash` is documented.
- Toggle state of script buttons is live: `SetToggleCommandState` + `RefreshToolbar2` (see 1.5).

---

## 3. Screensets, docking and window layout

### 3.1 `reaper-screensets.ini` format [source: a real 7.x file. Keys confirmed in the 7.82 binary]

```ini
[screensets]
nb=10

[sset0]
name=Main View
mask=-1025
dockersel=navigator
dockersel2=explorer
dockersel3=mastermixer
layouts=<"" 'trans' "Default 150" 'master_mcp' SidePanelV2 'mcp' Sidebar 'tcp' LONGNAME>
leftpanel_size=346
mainwnd_rect=BF030000370000008F0700005B020000EC
mainwnd_status=1
mixer_flag1=11
mixer_flag2=309
mixer_flag3=2
poslist_size=107
poslist28_id=explorer
poslist28_sz=20
poslist28_data=030300000000000000000000000000000000000006
poslist0_id=toolbar:1
poslist0_sz=28
poslist0_data=000000006104000082020000F3040000AC020000040000000000000092
```

- `[ssetN]` (N = 0-9) holds **window sets** ("Screenset: Load/Save window set #01-#10"). Window sets are global, not per project. Track views are saved in the project instead.
- `mask` = what the set restores (`sset_save_mask`). `layouts=` = the theme layout chosen per context. `leftpanel_size` = TCP width. `mixer_flag1-3` = mixer options. `dockerselN` = selected tab per docker.
- The `*_rect` and `poslist*_data` values are **binary structs written by `WritePrivateProfileStruct`**: hex bytes plus a trailing checksum byte (the sum of the bytes mod 256). Example: `mainwnd_rect` = four int32 (left, top, right, bottom) + `EC`. Each poslist entry holds the window's rect, dock state and docker index, in an undocumented layout.

**Recommendation:** don't author screensets by hand. Build the layout live (the bridge's `setupWorkspace` already does this robustly), then **save it into a free slot**:

| Action | Ids |
|---|---|
| Screenset: Load window set #01 … #10 | **40454 … 40463** |
| Screenset: Save window set #01 … #10 | **40474 … 40483** |
| Screenset: Load/Save track view #01-#10 | 40444-40453 / 40464-40473 (per project, not for us) |
| View: Show screensets/layouts window | 40422 |

- A free slot is an `[ssetN]` with `mask=0` and no `name`, or missing. Record which slot we took, and offer "Layout: <DAW>" as a one-key way back (bind 4045x in the profile keymap).
- **Is this more robust than reaper.ini dock keys?** Only after the first setup: a saved screenset restores everything (dockers, sizes, mixer flags, layouts) in one action, live, without restart. It can't be produced offline, and the blobs are monitor-specific. So: reaper.ini keys (closed) or the bridge (running) for the first apply, then a screenset for recall. [verify: whether the save action prompts for a name. Run 40483 on a scratch instance]
- `reaper-screensets.ini` is written when a set is saved [verify: also on exit when `screenset_autosave` is on].

### 3.2 Dock and window keys in `reaper.ini` `[REAPER]` (what we touch today)

| Key | Meaning | Status |
|---|---|---|
| `dockermode<N>` | position of docker N: 0 bottom, 1 left, 2 top, 3 right | confirmed (team). Floating or unattached dockers use other values [verify by detaching a docker and diffing] |
| `dockersel<N>` | selected tab ident in docker N (e.g. `explorer`) | confirmed |
| `dockheight` / `dockheight_l` / `dockheight_r` / **`dockheight_t`** | bottom height / left and right width / **top height** | `_t` is in the binary but not in our restore KEYS list. Add it if a profile puts a docker on top |
| `dockerpprio<N>`, `docker_autoopaque`, `dockcfg` | further docker state | present in binary, unknown |
| `[REAPERdockpref]` `ident=<float> <docker>` | written as `%.8f %d`: tab order, docker index. Idents: `explorer`, `fxbrowser`, `toolbar:N`, `mastermixer`, `navigator`, … | confirmed |
| `leftpanewid` | TCP width (px) | confirmed |
| `transport_vis`, `transport_dock`, `transport_dock_pos` (0 below arrange, 1 above ruler, 2 bottom of main, 3 top of main) | transport | confirmed (team) |
| `mixwnd_vis`, `mixwnd_dock` | mixer shown, docked | confirmed |
| `mixerflag` bit **32** | TCP on the right of the arrange (action **42373** "View: Show TCP on right side of arrange") | confirmed (team) |
| `[midiedit] dock=1` | new MIDI editors dock | confirmed (team) |
| `[reaper_sexplorer] docked, visible, lastdir, NbShortcuts, Shortcut<i>, ShortcutT<i>` | Media Explorer | confirmed |

Live equivalents (already in the bridge): `Dock_UpdateDockID`, `DockGetPosition`, `DockIsChildOfDock`, 41598-41601 (docker to bottom/left/top/right), 40083 (mixer dock), 41603-41606 (transport position), 42373.

---

## 4. What a theme can carry

### 4.1 `.ReaperTheme` `[REAPER]` section [confirmed from Default 7]

```ini
[REAPER]
ui_img=Default_7.0_unpacked
lb_font=F5FFFFFF000000000000000000000000900100000000000003020102496E746572006520446F776E007320536572696600000000000000000000000036
lb_font2=…      ; Track title font
user_font0=…    ; … user_font15 = "WALTER font 1" … "WALTER font 16"
tl_font=…       ; Timeline (ruler) font
trans_font=…    ; Transport status font
mi_font=…       ; Media item label font
```

- Keys: `ui_img` (image folder), and fonts `lb_font` ("Volume/pan label font"), `lb_font2` ("Track title font"), `user_font0`-`user_font15` (WALTER fonts 1-16), `tl_font`, `trans_font`, `mi_font`. The binary also has `ui_img_path` and a `%s_mac` suffix form (macOS-only overrides) [verify]. `[color theme]` holds the colours plus the `*_drawmode` / `*_mode` blend values (we already write these).
- **Font value** = a Win32 `LOGFONT` written by `WritePrivateProfileStruct`: 60 bytes of hex plus 1 checksum byte (sum of the 60 bytes mod 256).
  - bytes 0-3: `lfHeight`, int32 LE, **negative = pixel height at 100 %** (`F5FFFFFF` = −11 px)
  - bytes 16-19: `lfWeight` (`0x190` = 400 regular, `0x1F4` = 500 medium)
  - byte 20: italic
  - bytes 24-27: precision, quality and pitch
  - bytes 28-59: face name, NUL-terminated (`Inter`; junk after the NUL is harmless)

  To change a size: rewrite bytes 0-3 and recompute the checksum.
  ```ts
  function setFontPx(hex: string, px: number): string {
    const b = Buffer.from(hex.slice(0, 120), "hex"); // 60 bytes, checksum dropped
    b.writeInt32LE(-Math.round(px), 0);
    const sum = b.reduce((s, x) => (s + x) & 255, 0);
    return (b.toString("hex") + sum.toString(16).padStart(2, "0")).toUpperCase();
  }
  ```
- WALTER picks fonts with `<element>.font [N]`: 1..16 = user_font0..15, 0 = main, −1 = vol/pan. Our `walter.ts` already uses indices 1-5 at 100 %, 6-10 at 150 % and 11-15 at 200 %, the same scheme as Default 7.
- REAPER 7.70 added a user preference, "Font size adjustment for theme/arrange/ruler" (General > Advanced), which scales the theme's fonts on top. Key name: [verify by changing it and diffing reaper.ini].

### 4.2 `rtconfig.txt` global lines [confirmed: theme docs + Default 7]

```text
version 7.0
use_pngs 1
use_overlays 1
tinttcp 298            ; overrides reaper.ini tinttcp (track-colour tinting of TCP, items, peaks)
peaksedges 0           ; overrides reaper.ini peaksedges
tcp_heights 4 25 54 64 ; supercollapsed, small, medium, full default track heights
tcp_master_minheight 32
tcp_folderindent 0
envcp_min_height 27
mcp_min_height 220 80
tcp_voltext_flags 1 8  ; 1 no "dB", 2 no decimals, 4 no "+", 8 always two decimals; then max length
misc_dpi_translate 134 150    ; toolbar and misc image sets by DPI
layout_dpi_translate '' 1.34 '150%_A'
global_scale 1.0
want_os_type 1         ; 7.71+: make os_type report 3 on macOS, 4 on Linux
```

`tinttcp` bits (reaper.ini meaning, the theme overrides them): 1 label background uses track colour · 2 tint TCP backgrounds · 4 (inverted) tint peaks by track colour · 8 tint item background by track colour · 16/32 the same for item colour · 128/256 the same for take colour.

### 4.3 WALTER layouts and parameters [confirmed docs]

- `define_parameter "name" "Description" default min max`: a theme setting that ReaScript can read and set. Get it with `ThemeLayout_GetParameter(i)` and set it with `ThemeLayout_SetParameter(i, value, persist)`, then call `ThemeLayout_RefreshAll()`. Persisted values go to **`reaper-themeconfig.ini`** under `[<theme name>]` as `name=value` (e.g. `[Default_7.0] tcpBgColR=51`, `LayoutA-tcpMeterWidth=30`). An unsaved theme uses `[__def_unsaved]`.
- `Layout "Name" ["image subdir"] … EndLayout`: a named layout. **The default layout of each context is the top-level, unnamed one**. There is no directive that makes a named layout the default. `layout_dpi_translate '' 1.34 '150%_A'` maps the default to a scaled layout (our `walter.ts` does this). `GlobalLayout` lists a named layout in the global layout menu.
- Choosing layouts at runtime: `ThemeLayout_SetLayout(section, name)`, where section is `'global'`, `'tcp'`, `'mcp'`, `'envcp'`, `'trans'`, `'master_tcp'` or `'master_mcp'`. `ThemeLayout_GetLayout(section, -1)` returns the current one. Per-track layouts live in the project. Where the global choice is saved: the binary has a `layout_%s` key, and screensets save it in `layouts=`. [verify: set one, quit, grep `reaper.ini` and `reaper-themeconfig.ini` for `layout_`]

### 4.4 What a theme can and cannot change

| Wish | Theme? | How |
|---|---|---|
| TCP on the right | **No.** It is a global view option | action 42373 / `mixerflag` bit 32 (we do this) |
| Mixer strip width | Yes | `set mcp.size [w h minw minh]` (and `master.mcp.size`), or layouts per width. The user can still pick other layouts |
| Meter placement | Yes | positions of `tcp.meter`, `mcp.meter` and `master.*.meter` in WALTER (`mcp_altmeterpos` is deprecated) |
| Transport size | Yes | `trans.size`, `trans.size.minmax`, `trans.size.dockedheight` (we do this). Where it docks is a user setting (`transport_dock_pos`) |
| Default track heights | Yes | `tcp_heights` |
| Fonts and sizes | Yes | `[REAPER]` LOGFONT keys + `.font [N]` |
| Track and item tinting | Yes | `tinttcp`, `peaksedges` in rtconfig |
| Toolbar button chrome and default-toolbar images | Yes | theme images (2.3) |
| Mouse, keys, menus, prefs | No | sections 1, 2, 5 |

---

## 5. Preferences in `reaper.ini` (`[REAPER]`)

Two kinds of key:
- **Global prefs.** Set live with `set_config_var_string(name, value, 1)`.
- **Project settings** (`proj*`, `loop`). These live in each `.rpp`. The `reaper.ini` copy is only the *default for new projects*. `set_config_var_string(name, value)` changes the **current project** (return value 2). With `persist=2` it also writes the default. **Assist can't undo values that users save into their projects**, so change only defaults, and touch the current project only on an explicit request.

Bit numbers below come from Ultraschall's ConfigVariables doc (REAPER 5.95, so newer bits are missing) and are cross-checked with the 7.82 strings and action list.

| Setting (DAW wording) | Key / bits | Scope | Live toggle action(s) |
|---|---|---|---|
| Follow playhead / auto-scroll | `viewadvance` &1 auto-scroll during playback · &2 while recording · &4 (**inverted**) "don't auto-scroll when viewing other parts" · &8 scroll view to edit cursor on stop · &16 **continuous scrolling** (playhead fixed, page moves: Logic/Live style) | global | 40036 auto-scroll · 40262 while recording · **41817** continuous scrolling |
| Stop behaviour ("return to start on stop") | **No preference.** REAPER's Stop always returns the play cursor to the edit cursor (Pro Tools/Cubase "return to start" style). For "stop where I am" (Logic style), bind Space to **40328** "Transport: Play/stop (move edit cursor on stop)", or use Pause (**1008**) / Play/pause (**40073**). Related: `stopprojlen` (0/1: stop or repeat at end of project) · `stopendofloop` (stop at end of loop when repeat is off, action 41834) · `itemclickmovecurs` &16 move edit cursor to end of recording on record stop (action 40300) | global | via keymap |
| Loop / repeat | `loop` 0/1 (project state, action **1068**). `loopgran` is **not** loop: it is the snap setting "force selection to be multiples of" | project | 1068 |
| Snap on/off | `projshowgrid` &256 (**inverted**: set = snapping off) | project | **1157** |
| Grid lines | `projshowgrid` &1 | project | 40145 |
| Snap targets | `projshowgrid` &2 items→grid · &4 cursor→grid · &8 selection→grid · &16/32/64 to markers/cursor · &128 item to item · **&512 same grid in arrange and MIDI editor** · &1024 snap at any distance · &32768 (inverted) snap follows grid visibility | project | 40071 dialog |
| Grid size | `projgriddiv` (double, in quarter notes: 0.25 = 1/16, 0.5 = 1/8, 1 = 1/4, 4 = 1 bar). Swing `projgridswing`. Frame grid `projgridframe` | project | Grid: Set to … actions; `SetProjectGrid` / `GetSetProjectGrid` API |
| Ripple | `projripedit` 0 off / 1 per track / 2 all tracks (7.x also has `projripeditcfg`) | project | **40309** off · **40310** per-track · **40311** all · 1155 cycle |
| Auto-crossfade / trim behind | `autoxfade` &1 auto-crossfade · &2 trim content behind items | global | **40041** · 41117/41120/41121 trim |
| Recording over existing media | `autoxfade` &4 tape (trim) · &8 layers (lanes); 7.x lane modes are action toggles | global | 41330 takes · 41186 tape · 42677 item layers · 43151 lanes in layers · **43152** lanes exclusive · 43153 no lanes · 40114 loop recording always adds takes (the bridge already uses these) |
| Metronome / count-in | `projmetroen` &1 on · &2 during playback · &4 during record · &8 count-in before playback · &16 count-in before record. `projmetrocountin` = bars | project | 40364 toggle · 41745 on · 41746 off. **There is no count-in action**: set the bits with `set_config_var_string` |
| New-track defaults | `newtflag` &1 show in mixer · &2 main/parent send · &4 free item positioning. `deftrackvol`, `deftrackrecflags`, `deftrackrecinput`, `defsendflag`, `defsendvol`, `defautomode` | global | none |
| Mouse wheel zoom vs scroll | arrange wheel = **shortcuts** in `reaper-kb.ini`: `KEY 255 <code> <cmd> 0`, codes 248 wheel · 249 Ctrl/Cmd · 250 Alt/Opt · 251 Ctrl+Alt · 252 Shift · 253 Ctrl+Shift · 254 Alt+Shift (horizontal wheel 216-223). Commands: **990** zoom horizontally · 989 scroll vertically · 988 scroll horizontally · 1000 zoom vertically. REAPER's own mac map has `KEY 255 248 990 0` (wheel = zoom). `mousewheelmode` &1 wheel targets the focused window (else the window under the cursor) · &2/&4 ignore wheel on faders / TCP faders · &8 treat trackpad scroll as wheel. 7.46+: `MM_CTX_TCP_MOUSEWHEEL` / `_MCP_` / `_FADER_` mouse-modifier contexts | global | keymap (restart) |
| Edit cursor follows click | mouse modifiers `MM_CTX_TRACK_CLK` 1 (moves) vs 3 (doesn't) and `MM_CTX_ITEM_CLK` 1 vs 3 (1.4). `itemclickmovecurs` &4 move cursor to time-selection start on change (action **40276**) · &8 (inverted) move cursor when pasting · &64 clear time selection on click. Seeking: `seekmodes` &1 ruler · &2 below tracks · &4 empty track areas click seeks during playback | global | 40276, 40300 |
| Zoom centre | `zoommode` 0 edit or play cursor · 1 edit cursor · 2 centre of view · 3 **mouse cursor** (Live, FL) | global | none |
| Track selection by click | `trackselonmouse` &1 click in arrange selects track · &2 click on TCP controls selects · &4 (inverted) click below last track clears item selection | global | none |
| MIDI editor scope | `midieditor` &3: 0 one editor per item · 2 per track · **1 per project** (7.0 default); &4/&16 what "open" opens (both set = clicked item only) · &128 (inverted) active item follows arrange selection · &256 (inverted) only same-track items editable · … | global | none |
| MIDI editor docked | `[midiedit] dock=1` (team-verified) | global | MIDI 40018 |
| MIDI default view, note colours, grid, ghost notes | Per-editor state. Since **7.39** REAPER keeps a *default MIDI editor configuration*: open an editor, apply settings with `MIDIEditor_OnCommand`, then run **32060:43451** "Save default configuration (and disable auto-save…)" or turn on 32060:43452 "Auto-save default configuration when changing options". View: 40042 piano roll · 40043 named notes (drum map) · 40954 notation · 40056 event list. Colours: 40738 velocity · 40739 channel · 40740 pitch · 40741 source colormap · 40768 track colour · 40769 item colour. Grid: 40192 1/16 · 40197 1/8 · 40201 1/4. Snap 1014 · grid 1017. Note shape 40448 triangles · 40449 rectangles · 40450 diamonds | default config [verify: where 43451 stores it. Diff reaper.ini before and after] | MIDI section actions |
| Right-click in MIDI editor | 7.0 turned off the "right-click deletes notes" preference by default. Use the mouse modifier `MM_CTX_MIDI_RMOUSE` (1.4) instead of the pref [verify the pref key] | global | none |
| Auto-fade defaults | `deffadelen`, `deffadeshape`, `defsplitxfadelen`, `splitautoxfade`, `loopnewitems` | global | none |
| Track/item tinting | `tinttcp` (a theme can override it) | global | none |

**How to set them live (7.82).** `reaper.set_config_var_string(name, value, persist)` is native since **7.74**. Since **7.80** it also handles "generic .ini keys". It returns 1 for a global pref, 2 for a project setting, and 0 on failure. `persist=1` writes a global pref to reaper.ini, and `persist=2` writes a project default. `persist=3` writes keys that "can only be written with persist=3" (like WritePrivateProfileString, possibly not live), and the value `'=delete='` removes the key. Read with `reaper.get_config_var_string(name)`.

```lua
local function setBits(name, mask, on)          -- flip only our bits; keep the user's others
  local ok, cur = reaper.get_config_var_string(name)
  local v = tonumber(ok and cur or "0") or 0
  local nv = on and (v | mask) or (v & ~mask)
  if nv ~= v then reaper.set_config_var_string(name, tostring(nv), 1) end
  return v                                       -- old value, for the restore record
end
setBits("viewadvance", 1|16, true)               -- follow playhead, continuous
reaper.set_config_var_string("zoommode", "3", 1) -- zoom around the mouse
```

- **Prefer the toggle action when one exists** (`Main_OnCommand`, checked with `GetToggleCommandState`). It updates menus and toolbars and persists. Use `set_config_var_string` for prefs without an action (zoommode, newtflag, mousewheelmode, seekmodes, midieditor, count-in bits).
- `SetToggleCommandState` **does not change preferences**. It only sets the displayed state of *our script's* own command.
- SWS `SNM_SetIntConfigVar` / `SNM_SetDoubleConfigVar` change memory only. They are no longer needed on 7.74+.
- Live or restart: behaviour flags take effect at once, because REAPER reads the variable when it uses it (UI checkmarks may update only on the next redraw). Window and dock keys need the window actions. "Advanced UI tweaks" (UI scale, font adjust) note "some … require a restart". [verify per key the first time: set it live, use the feature, and check that `GetToggleCommandState` of the matching action agrees]

---

## 6. Undo / "Restore REAPER"

Extend the existing record (`reaper-original.json`, `ReaperOriginal`) with the same "old value or null" design:

```ts
interface ReaperOriginalV2 extends ReaperOriginal {
  /** more reaper.ini keys: "section\tkey" -> old value | null (already supported by `ini`) */
  /** Bits Assist owns per bitfield key; restore flips only these (like mixerflag & 32 today). */
  bits?: Record<string, number>;                       // e.g. { "reaper\tviewadvance": 17 }
  /** Mouse modifiers Assist set: "MM_CTX_X\tN" -> old value from GetMouseModifier, or null if the key was absent from reaper-mouse.ini. */
  mouse?: Record<string, string | null>;
  mouseFile?: string | null;                           // reaper-mouse.ini as it was (null = no file)
  /** reaper-menu.ini sections Assist wrote: name -> old section lines, or null (section absent = REAPER default). */
  menus?: Record<string, string[] | null>;
  /** screenset slot Assist used, with its old [ssetN] lines (null = empty slot). */
  screenset?: { slot: number; lines: string[] | null };
  /** files Assist added: toolbar icons, scripts, .ReaperMouseMap, .ReaperMenuSet */
  files?: string[];
}
```

| File | Edit while REAPER runs? | Back up | Put back |
|---|---|---|---|
| `reaper.ini` | **No** (REAPER rewrites it on exit), except the bridge's narrow, verified edits | per-key record (existing) + bits | live: `set_config_var_string(k, old, 1)` / toggle actions / window actions. Closed: `restoreIni` (existing). For bitfields restore only Assist's bits: `(cur & ~mask) \| (old & mask)`. A key that was absent: delete it (closed), or set REAPER's default value live |
| `reaper-kb.ini` | Yes (REAPER keeps it unless the user edits shortcuts in that session) | existing | existing `restoreKb`. Add our `SCR` / `ACT` lines to "our lines" |
| `reaper-mouse.ini` | **Use the API**, not the file, while running | `mouse` map + whole-file copy | live: for each key `SetMouseModifier(ctx, N, old ?? -1)` (`-1` = back to default, keeps the file sparse). Closed: surgical edit of the touched `mm_N` keys (delete if old was null), keeping `[hasimported]`. Use the whole-file copy only if the file is byte-identical to what Assist last wrote |
| `reaper-menu.ini` | **No** [verify] | `menus` per section | closed only: put the old section back, or delete it (null). Leave other sections alone. Write without BOM |
| `reaper-screensets.ini` | **No** | `screenset` slot | closed: put `[ssetN]` back. Live: nothing to undo unless the user loads it |
| `reaper-themeconfig.ini` | n/a | nothing (our themes have their own sections) | optionally delete `[Assist - …]` sections when deleting our themes |
| `Data/toolbar_icons/assist_*.png`, `Scripts/ReaperAssist/*`, `MouseMaps/Assist*`, `MenuSets/Assist*`, `KeyMaps/Assist*` | Yes | `files` | delete them |

Order for "Restore REAPER" with REAPER running:
1. Live: the bridge un-swaps tools (1.5), restores mouse modifiers (API), restores toggle-able prefs (actions) and other prefs (`set_config_var_string`), then the windows (existing `restoreLayout`) and the theme (`OpenColorThemeFile` on the original).
2. After quit: the files (`reaper.ini` remaining keys, `reaper-kb.ini`, `reaper-menu.ini`, `reaper-screensets.ini`), then delete Assist's added files.
3. Mark restored (existing `markRestored`).

Note: project-level values already saved into user projects (grid, ripple, metronome, loop) can't be restored. Say so in the UI, or don't change the current project's values at all.

---

## 7. Live vs restart, one line each

| Thing | Live from the bridge | Needs restart |
|---|---|---|
| Mouse modifiers | **Yes**: `SetMouseModifier` | only if written to the file |
| Arrange tools (overrides A-D) | **Yes**: actions 42615-42634 | none |
| Prefs with a toggle action | **Yes**: `Main_OnCommand` | none |
| Other prefs | **Yes**: `set_config_var_string` (7.74+) | a few "advanced" ones [verify] |
| Theme (colours, WALTER, fonts) | **Yes**: `OpenColorThemeFile`. Parameters: `ThemeLayout_SetParameter` + `ThemeLayout_RefreshAll` | none |
| Theme layout choice | **Yes**: `ThemeLayout_SetLayout` | none |
| Dock / window layout | **Yes**: dock and window actions (bridge) | reaper.ini edits need REAPER closed |
| Screensets | load/save **live** (actions) | hand-edited file [verify] |
| Toolbar button toggle state | **Yes**: `SetToggleCommandState` + `RefreshToolbar2` | none |
| Toolbar or menu *contents* | **No** (only manual Import of `.ReaperMenuSet`) | `reaper-menu.ini` |
| Shortcuts (`KEY`) | **No** (manual `.ReaperKeyMap` import) | `reaper-kb.ini` |
| Script registration (`SCR`) | **Yes**: `AddRemoveReaScript` (machine-specific id) | readable ids via `reaper-kb.ini` |
| New toolbar icon files | probably yes [verify] | none |

---

## 8. Verify list (quick experiments, all on a throwaway resource folder)

1. **MIDI_NOTE_CLK 1 vs 2:** `GetMouseModifier("MIDI note left click", 0)` and `…, 4)` on a fresh 7.82 install, then compare with the names in Preferences.
2. **Defaults dump:** run action 40308 on a clean instance and save the HTML. That gives every context's factory default per modifier for 7.82.
3. **Name-based set:** `SetMouseModifier("MIDI piano roll left click", 0, "Insert note")`, then `GetMouseModifier(...)`, which should be `"4 m"`. Repeat for each name in the profile specs.
4. **When `reaper-mouse.ini` is written:** set one modifier, then `cat` the file before and after quitting.
5. **`[hasimported]` necessity:** remove it, start, and diff.
6. **Readable `RS_` ids** in 7.82: add `SCR 4 0 RS_assist_test …` offline, start, and run `NamedCommandLookup`.
7. **`reaper-menu.ini` live:** edit while running, then reopen the toolbar or open Customize, and check whether the edit survives.
8. **`tbf_N` bits:** try each animation option and diff.
9. **Theme-zip `toolbar_icons/`:** is it searched?
10. **Screenset save prompt:** does 40474 prompt for a name? Does `reaper-screensets.ini` change at exit?
11. **MIDI editor default config storage (43451):** diff reaper.ini and `[midiedit]`.
12. **Global layout persistence** (`ThemeLayout_SetLayout`): grep for `layout_` after quitting.
13. **Arrange override persistence** across restart.
14. **`set_config_var_string` liveness** for `viewadvance` / `zoommode` / `projmetroen` (count-in): set it, use the feature, and check the toggle states.
15. **Font-size adjust and "right-click deletes notes" pref key names:** change each, then diff reaper.ini.

---

## Sources

- REAPER 7.82 app bundle (read only): binary strings (SetMouseModifier/GetMouseModifier, `set_config_var_string`, ThemeLayout_*, Menu_GetHash docs; context ids; file and key names), `InstallFiles/Data/toolbar_icons` (icon sizes), `InstallFiles/ColorThemes/Default_7.0.ReaperThemeZip` (`[REAPER]` fonts, rtconfig globals), `Scripts/Cockos/Default_7.0_theme_adjuster.lua`.
- REAPER changelog to 7.84 (`whatsnew.txt`): 7.0 overrides A-D and the hidden "set default mouse modifier" actions; 7.0 name-based Get/SetMouseModifier; 7.39 default MIDI editor config; 7.46 extended flags and wheel contexts; 7.74 `set_config_var_string`; 7.80 generic ini keys.
- REAPER 7.82's action list (all ids cited).
- A probe: the `reaper-mouse.ini` and `reaper.ini` a fresh 7.82 install writes.
- Cockos WALTER and theme image docs: https://www.reaper.fm/sdk/walter/walter.php, https://www.reaper.fm/sdk/walter/images.php
- Ultraschall *Reaper-Filetype-Descriptions* (mouse IDs, menu format, kb special keys): https://github.com/Ultraschall/ultraschall-lua-api-for-reaper (ultraschall_api/Documentation/Reaper-Filetype-Descriptions.html) and https://github.com/mespotine/ultraschall-and-reaper-docs (Docs/Filetype-Descriptions.html, Reaper-ConfigVariables-Documentation.txt).
- Public configs used for cross-checks: MyDaw "Mouse Or Pen.lua" (https://github.com/nappies/MydawConfig), JiaLong0209 and Luis-Licea `.ReaperMouseMap`, rewgs `.ReaperMouseMap`, lrestj and schapps `reaper-menu.ini`, DemianDeVante `reaper-screensets.ini`, lrestj `reaper-themeconfig.ini`, jcsteh/osara `reaper-kb.ini`, AntoineBalaine/reavim-ext `reaper-kb.ini.sample`.
