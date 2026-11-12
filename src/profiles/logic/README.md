# Logic Pro profile

Charcoal tracks, light control bar with LCD; Space stops in place, T tools, X mixer, P piano roll.

| Part | What it does | Where |
|---|---|---|
| Look | Original theme kit: palette, track headers, mixer strips, transport | `kit.ts` |
| Shortcuts | 90 key bindings | `profile.ts` → `shortcuts` |
| Mouse | 19 mouse behaviours | `profile.ts` → `mouse` |
| Scripts | 24 actions REAPER doesn't have built in | `scripts/`, `profile.ts` → `scripts` |
| Toolbar | 35 buttons with drawn icons | `profile.ts` → `toolbars`, icons in `kit.ts` |
| Layout | transport top, track headers on the left, FX Browser docked left; Media Explorer docked right, mixer docked, MIDI editor docked | `profile.ts` → `layout` |
| Preferences | 17 REAPER preferences | `profile.ts` → `prefs` |
| Glossary | 12 terms translated for the AI | `profile.ts` → `glossary` |

Research and sources: [docs/research/logic.md](../../../docs/research/logic.md). How profiles work and how to try one safely: [../README.md](../README.md).

## Can't be done in REAPER (today)

- A real Inspector with two live channel strips and meters; a docked Lua panel is the closest.
- Mixer strip extras: channel-strip Setting button, gain-reduction meter, EQ thumbnail, MIDI FX slot, Group slot, and a green instrument slot.
- Track header extras: track On/Off power button, Freeze button, per-track "Configure Track Header" checkboxes, and icons tinted with the track colour.
- In the transport: master volume and meter, key signature field, and per-field LCD editing (drag bar/beat).
- Logic's Tuner, Note Pads, and control-bar region Solo mode.
- Audio File Editor, Step Sequencer, Drummer Editor, Flex Pitch, Live Loops, Chord Track, Stem Splitter, Mastering Assistant.
- Smart snap that adapts to zoom, and looping a region by dragging its upper-right corner.
- Join (Cmd-J) without rendering audio, and transposing MIDI with take pitch (Opt-Up/Down).

Ideas for any of these (a REAPER extension, a ReaImGui window, a smarter script) are welcome: open an issue labelled `profile` first so we can agree on the approach.

## Checking your change

```sh
npx vitest run src/profiles/logic
npm test
```

Then try it in a throwaway REAPER (see [docs/testing.md](../../../docs/testing.md#trying-a-profile)) and compare with the real Logic Pro side by side. Screenshots of Logic Pro can go in your issue or pull request as reference, but not into the repo.
