# Studio One profile

Studio One's dark look; tools on 1–8, Space stops in place, F2 editor, F3 console, F5 browser.

| Part | What it does | Where |
|---|---|---|
| Look | Original theme kit: palette, track headers, mixer strips, transport | `kit.ts` |
| Shortcuts | 134 key bindings | `profile.ts` → `shortcuts` |
| Mouse | 12 mouse behaviours | `profile.ts` → `mouse` |
| Scripts | 22 actions REAPER doesn't have built in | `scripts/`, `profile.ts` → `scripts` |
| Toolbar | 26 buttons with drawn icons | `profile.ts` → `toolbars`, icons in `kit.ts` |
| Layout | transport bottom, track headers on the left, FX Browser/Media Explorer docked right, mixer hidden, MIDI editor docked | `profile.ts` → `layout` |
| Preferences | 12 REAPER preferences | `profile.ts` → `prefs` |
| Glossary | 12 terms translated for the AI | `profile.ts` → `glossary` |

Research and sources: [docs/research/studioone.md](../../../docs/research/studioone.md). How profiles work and how to try one safely: [../README.md](../README.md).

## Can't be done in REAPER (today)

- No docked Inspector next to the track headers. A ReaImGui window could stand in for it.
- No real tools: tools 1–8 are faked by scripts that swap mouse modifiers. Drag-to-erase and drag-to-mute don't exist natively.
- Pan sliders can't fill from the centre outward; a theme fader is only a background plus a thumb.
- The transport can't show the loop L/R range (only the time selection), and the performance meter is a separate window, not part of the transport.
- No snap/quantize dropdowns in the toolbar, and no unified Browser (FX Browser, Media Explorer and Project Bay are separate).
- No trim state for faders, no metronome controls on the master strip, and the mixer can't print a track's output name.
- Precount has no toggle action (it lives in the metronome settings), and there's no equivalent for "Duplicate and Insert", the crosshair cursor, or Ctrl+drag on a track header to duplicate it.
- Ctrl+click to reset a control and Shift+drag to fine-tune can't be remapped (REAPER uses double-click and Ctrl/Cmd+drag).

Ideas for any of these (a REAPER extension, a ReaImGui window, a smarter script) are welcome: open an issue labelled `profile` first so we can agree on the approach.

## Checking your change

```sh
npx vitest run src/profiles/studioone
npm test
```

Then try it in a throwaway REAPER (see [docs/testing.md](../../../docs/testing.md#trying-a-profile)) and compare with the real Studio One side by side. Screenshots of Studio One can go in your issue or pull request as reference, but not into the repo.
