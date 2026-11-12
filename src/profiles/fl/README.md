# FL Studio profile

Blue-grey playlist, mint piano roll, FL tools (P B D T C E); F5–F9 windows, L pattern/song.

| Part | What it does | Where |
|---|---|---|
| Look | Original theme kit: palette, track headers, mixer strips, transport | `kit.ts` |
| Shortcuts | 115 key bindings | `profile.ts` → `shortcuts` |
| Mouse | 24 mouse behaviours | `profile.ts` → `mouse` |
| Scripts | 19 actions REAPER doesn't have built in | `scripts/`, `profile.ts` → `scripts` |
| Toolbar | 27 buttons with drawn icons | `profile.ts` → `toolbars`, icons in `kit.ts` |
| Layout | transport top, track headers on the left, Media Explorer/FX Browser docked left, mixer hidden, MIDI editor window | `profile.ts` → `layout` |
| Preferences | 15 REAPER preferences | `profile.ts` → `prefs` |
| Glossary | 11 terms translated for the AI | `profile.ts` → `glossary` |

Research and sources: [docs/research/fl.md](../../../docs/research/fl.md). How profiles work and how to try one safely: [../README.md](../README.md).

## Can't be done in REAPER (today)

- FL's tool modes aren't native: the profile fakes them with scripts that swap REAPER's mouse map.
- An FL pattern spans many channels; a REAPER item belongs to one track, so a pattern becomes several grouped MIDI items.
- The mixer fader cap can't change colour for selected or armed tracks; only the strip background can.
- Clicks on track/mixer buttons can't be remapped, so Ctrl-click or right-click on the mute LED can't solo; a separate solo button stays.
- No CPU panel, oscilloscope, snap selector or pattern selector inside the transport bar.
- No built-in step-sequencer grid or Picker Panel (Project Bay is the nearest).
- Left Shift and Right Shift can't be told apart (FL's Right-Shift+click slice).

Ideas for any of these (a REAPER extension, a ReaImGui window, a smarter script) are welcome: open an issue labelled `profile` first so we can agree on the approach.

## Checking your change

```sh
npx vitest run src/profiles/fl
npm test
```

Then try it in a throwaway REAPER (see [docs/testing.md](../../../docs/testing.md#trying-a-profile)) and compare with the real FL Studio side by side. Screenshots of FL Studio can go in your issue or pull request as reference, but not into the repo.
