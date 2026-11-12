---
title: Arrangement and song structure
when: Song structure, sections, energy curve, transitions, a loop that needs to become a song.
tools: getProjectState, addRegion, copyItems, moveItems, setItemProperties, writeAutomation
---
## Common forms (bars)

| Style | Shape |
|---|---|
| Pop | Intro 4-8, Verse 8-16, Pre 4-8, Chorus 8, Verse, Pre, Chorus, Bridge 8, Chorus ×2, Outro |
| Rap | Intro 4-8, Hook 8, Verse 16, Hook 8, Verse 16, Hook 8, Outro |
| Club / EDM | Intro 16-32, Build 8-16, Drop 16-32, Breakdown 16-32, Build, Drop, Outro 16-32 |

Streaming-era pop and rap often run 2:30-3:30 with a short intro (under about 10 s). Club tracks keep DJ-friendly 16 and 32-bar phrases and plain intros and outros.

## Energy

- Contrast makes the chorus big: take things out of the verse (bass up an octave, no hats, filtered drums) rather than only adding to the chorus.
- Change something every 4-8 bars: add or drop a layer, a fill, a filter move, a one-shot.
- The last chorus should be the biggest: extra layer, octave double, ad-libs, a key or drum change.

## Transitions

- Risers or noise sweeps over 2-8 bars; a reverse cymbal into the downbeat.
- Drum fill or a snare roll in the last bar.
- A gap: mute everything for one beat (or half a bar) before the drop.
- Filter sweep: high-pass from 20 Hz up to 300-800 Hz over 4-8 bars, then release on the drop.

## From loop to song

1. Mark sections with regions (`addRegion`) so everyone can say "the second verse".
2. Repeat the loop to full length: `copyItems` with items on a track (or the selection) in bars 1-8, to bar 9, times 7.
3. Subtract per section: mute items (`setItemProperties` muted) or move parts.
4. Add movement with `writeAutomation` (volume rises, filter sweeps).

Sections in the context come from regions and markers; a marker section runs until the next marker.
