---
title: MIDI programming and groove
when: Programming MIDI that feels played: quantize strength, swing, humanize, velocity, note lengths.
tools: readMidiNotes, editNotes, quantizeMidiClip, insertMidiNotes
---
## Read the part first

`readMidiNotes` reports how many notes sit within ±5 ms of the 1/16 grid, the average offset, any early or late tendency, a swing estimate, velocity spread and notes per bar. Decide from that, not from a guess.

## Grids (gridBeats)

1/4 = 1, 1/8 = 0.5, 1/16 = 0.25, 1/32 = 0.125, 1/8 triplet = 1/3, 1/16 triplet = 1/6.

## Quantize with feel

- Strength 1.0 for EDM, trap hats and anything machine-tight.
- 0.6-0.8 keeps the player's feel while fixing the worst timing.
- Quantize note ends only for staccato or rhythmic parts; leave them on pads.
- Swing (REAPER's percent): 50 straight, 54-58 light shuffle (house, pop), 58-62 hip-hop and lo-fi, 66 triplet feel.

## Humanize

- Timing: drums 2-6 ms, keys and bass 5-15 ms. Keep kick and snare tighter than hats and percussion.
- Velocity: ±5-12. A seed makes the result repeatable.
- Push and pull: a late snare (5-15 ms) lays back, early hats (about 5 ms) push.

## Velocity

- Accent the downbeats; hats alternate strong and weak; ghost notes at 20-50.
- `compressTo` narrows a wild range (e.g. 70-110) without losing the order of loud and soft.
- `ramp` builds rolls and crescendos (60 → 110 across a fill).
- A part with almost no velocity variation sounds programmed: add ±6-10.

## Length

- Plucky: about half the grid step. Legato for pads, slides and 808s (`length` { legato: true }).
- Mono synths and 808s: end each note before the next starts, unless you want a glide.

## With Assist

One `editNotes` call can do several things in this order: snap to scale, transpose, quantize, length, velocity, humanize. Narrow the target with a range (bars or a section) and a pitch filter, e.g. only hats { min: 42, max: 46 }. Each call is one undo step.
