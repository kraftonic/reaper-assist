# Ableton Live profile

Live's light-grey Arrangement: headers on the right, Tab for the mixer, ⌘E split, ⌘J consolidate, B draw mode.

| Part | What it does | Where |
|---|---|---|
| Look | Original theme kit: palette, track headers, mixer strips, transport | `kit.ts` |
| Shortcuts | 120 key bindings | `profile.ts` → `shortcuts` |
| Mouse | 16 mouse behaviours | `profile.ts` → `mouse` |
| Scripts | 24 actions REAPER doesn't have built in | `scripts/`, `profile.ts` → `scripts` |
| Toolbar | 27 buttons with drawn icons | `profile.ts` → `toolbars`, icons in `kit.ts` |
| Layout | transport top, track headers on the right, Media Explorer/FX Browser docked left, mixer hidden, MIDI editor docked | `profile.ts` → `layout` |
| Preferences | 16 REAPER preferences | `profile.ts` → `prefs` |
| Glossary | 12 terms translated for the AI | `profile.ts` → `glossary` |

Research and sources: [docs/research/ableton.md](../../../docs/research/ableton.md). How profiles work and how to try one safely: [../README.md](../README.md).

## Can't be done in REAPER (today)

- A real Session view clip launcher: no per-track looping clips of different lengths, launch quantization, clip stop buttons, follow actions or scene capture. Fixed lanes and regions are only approximations.
- Global launch quantization (`⌘6`–`⌘0`) and the zoom-adaptive grid (`⌘5`): no equivalent.
- Per-bar shading of the arrangement background (Live's alternating bar tiles); a stronger measure line is used instead.
- Session mixer sends as knobs: REAPER's send list is sliders only.
- Moving the peak-level readout out of the meter (Live's peak pill above the volume box).
- A blinking insert marker, and Live's horizontal device chain (REAPER's FX chain is a vertical list).
- Live's MIDI/Key Map modes, the quantization menu, KEY/MIDI/CPU/D control-bar items, and a fit-all-tracks-vertically key (`H`).
- Splitting one modifier drag by direction (Live's velocity vs un-snapped horizontal move); velocity wins.

Ideas for any of these (a REAPER extension, a ReaImGui window, a smarter script) are welcome: open an issue labelled `profile` first so we can agree on the approach.

## Checking your change

```sh
npx vitest run src/profiles/ableton
npm test
```

Then try it in a throwaway REAPER (see [docs/testing.md](../../../docs/testing.md#trying-a-profile)) and compare with the real Ableton Live side by side. Screenshots of Ableton Live can go in your issue or pull request as reference, but not into the repo.
