# Pro Tools profile

Charcoal Edit window, green counters, R I S M buttons; F1–F4 modes, F5–F10 tools, ⌘= Mix.

| Part | What it does | Where |
|---|---|---|
| Look | Original theme kit: palette, track headers, mixer strips, transport | `kit.ts` |
| Shortcuts | 181 key bindings | `profile.ts` → `shortcuts` |
| Mouse | 13 mouse behaviours | `profile.ts` → `mouse` |
| Scripts | 34 actions REAPER doesn't have built in | `scripts/`, `profile.ts` → `scripts` |
| Toolbar | 31 buttons with drawn icons | `profile.ts` → `toolbars`, icons in `kit.ts` |
| Layout | transport top, track headers on the left, mixer window, MIDI editor window | `profile.ts` → `layout` |
| Preferences | 15 REAPER preferences | `profile.ts` → `prefs` |
| Glossary | 12 terms translated for the AI | `profile.ts` → `glossary` |

Research and sources: [docs/research/protools.md](../../../docs/research/protools.md). How profiles work and how to try one safely: [../README.md](../README.md).

## Can't be done in REAPER (today)

- Post-roll: REAPER only has pre-roll, so ⌘K toggles pre-roll alone.
- A second (sub) counter next to the main counter, and theme displays of the current grid and nudge values.
- Real playlists. Fixed item lanes plus comping are the closest match.
- Separate edit and timeline selections. REAPER has one time selection (plus razor areas), so they are always linked.
- Fixed A–J insert and send slots, and the per-strip group, Voice, comments and delay-comp rows in the mixer.
- The Mix window as a second main window. It is REAPER's mixer, undocked and toggled with ⌘=.
- Two-key tool chords (F6+F7 for the Smart Tool, F1+F4), a flashing edit cursor, Online and Dynamic Transport modes, TrackPunch and DestructivePunch.
- Trimmer that trims the nearest clip edge from anywhere in the clip, and Pro Tools' Relative Grid (REAPER snaps absolutely).

Ideas for any of these (a REAPER extension, a ReaImGui window, a smarter script) are welcome: open an issue labelled `profile` first so we can agree on the approach.

## Checking your change

```sh
npx vitest run src/profiles/protools
npm test
```

Then try it in a throwaway REAPER (see [docs/testing.md](../../../docs/testing.md#trying-a-profile)) and compare with the real Pro Tools side by side. Screenshots of Pro Tools can go in your issue or pull request as reference, but not into the repo.
