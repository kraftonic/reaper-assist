---
title: Drums: programming and mixing
when: Drum patterns, tightening or loosening drums, kick and snare tone, drum bus, parallel compression.
tools: readMidiNotes, editNotes, deleteNotes, analyzeAudio, getTrackDetails, addFx, setFxParameter
---
## Programming that grooves

- Read first: `readMidiNotes` on the drum track shows hits per drum (GM: 36 kick, 38 snare, 39 clap, 42 closed hat, 46 open hat, 49 crash, 51 ride), velocity spread and how tight the timing is.
- Velocity carries the groove: hats alternating strong/weak (e.g. 100, 70, 85, 70), snare ghost notes at 25-50, accents on the downbeat of each bar.
- Tighten without killing the feel: kick and snare quantized at strength 0.9-1.0, hats and percussion at 0.6-0.8. Target one lane at a time with a pitch filter, e.g. notes { track: Drums, pitch: { min: 42, max: 46 } }.
- Swing: 54-58 % for house and pop shuffle, 56-62 % for boom bap and lo-fi, 66 % for a triplet feel. Apply it to hats and percussion first.
- Humanize: timing 2-6 ms and velocity ±6-10 on hats; leave the kick nearly alone.
- Feel: a snare 5-15 ms late lays the beat back; hats a few ms early push it forward.
- Rolls: 1/32 (gridBeats 0.125) or 1/16 triplets (1/6) with a velocity ramp (60 → 110).

## Mixing ranges

| Drum | Where to look |
|---|---|
| Kick | sub 50-60 Hz, punch 80-100 Hz, boxiness 300-500 Hz (cut), click 2-5 kHz |
| Snare | body 150-250 Hz, ring 400-900 Hz (narrow cut), crack 3-6 kHz |
| Hats, cymbals | high-pass 300-500 Hz, harshness 6-8 kHz, air 10-12 kHz |
| Toms | body 80-120 Hz, boxiness 300-600 Hz; gate or edit out the spill |
| Overheads, room | high-pass 150-300 Hz for cymbal-only overheads |

- Drum bus: 2-4:1, attack 10-30 ms so the hit gets through, fast release, 2-4 dB; a little saturation for weight.
- Parallel: a heavily squashed copy (8:1 or more, fast attack and release) blended 10-30 % adds sustain and energy.
- Several mics on one kit: check polarity (snare bottom is usually flipped) and listen for a thin sound when two mics are combined.

## With Assist

- `editNotes` quantize { gridBeats: 0.25, strength: 0.8, swing: 58 }, humanize { timingMs: 4, velocity: 8 }, velocity ramps and compressTo.
- `deleteNotes` removes a lane in a range (always asks; undo brings it back).
- `analyzeAudio` on drum items or the drum bus shows peaks and crest; a crest above 20 dB is very peaky, under 8 dB is squashed.
