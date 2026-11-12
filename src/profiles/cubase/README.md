# Cubase profile

Grey parts on dark lanes, yellow M / blue S, the transport at the bottom; numpad transport, tools on 1–9, Alt+X split, P locators, F3 MixConsole.

| Part | What it does | Where |
|---|---|---|
| Look | Original theme kit: palette, track headers, mixer strips, transport | `kit.ts` |
| Shortcuts | 177 key bindings | `profile.ts` → `shortcuts` |
| Mouse | 14 mouse behaviours | `profile.ts` → `mouse` |
| Scripts | 38 actions REAPER doesn't have built in | `scripts/`, `profile.ts` → `scripts` |
| Toolbar | 36 buttons with drawn icons | `profile.ts` → `toolbars`, icons in `kit.ts` |
| Layout | transport bottom, track headers on the left, FX Browser/Media Explorer docked right, mixer docked, MIDI editor docked | `profile.ts` → `layout` |
| Preferences | 12 REAPER preferences | `profile.ts` → `prefs` |
| Glossary | 12 terms translated for the AI | `profile.ts` → `glossary` |

Research and sources: [docs/research/cubase.md](../../../docs/research/cubase.md). How profiles work and how to try one safely: [../README.md](../README.md).

## Can't be done in REAPER (today)

- No Inspector or Channel zone that follows the selected track; the FX chain window is per track.
- No built-in channel EQ/Strip, Listen (AFL/PFL), Cue Sends, Quick Controls or Control Room.
- Cubase's separate R and W buttons become one automation-mode button; Lanes, Lock and Freeze have no track-header elements.
- Sliders can't fill with a value colour (Cubase's blue bars); REAPER only draws a thumb on a track image.
- Transport can't show punch positions, pre/post-roll amounts, record-mode selectors, a second time display or two-tone digits.
- No snap-type, grid-type or quantize-preset drop-downs on the toolbar.
- The loop band in the ruler can't change colour when cycle is on, and REAPER always has two cursors (edit and play) where Cubase has one.
- No equivalent for Combine Selection Tools, the Drumstick tool, Move Events to Front, Auto-Grid, Info Line, Overview or showing/hiding controller lanes.

Ideas for any of these (a REAPER extension, a ReaImGui window, a smarter script) are welcome: open an issue labelled `profile` first so we can agree on the approach.

## Checking your change

```sh
npx vitest run src/profiles/cubase
npm test
```

Then try it in a throwaway REAPER (see [docs/testing.md](../../../docs/testing.md#trying-a-profile)) and compare with the real Cubase side by side. Screenshots of Cubase can go in your issue or pull request as reference, but not into the repo.
