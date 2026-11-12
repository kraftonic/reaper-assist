---
title: Sampling and chopping
when: Chopping a sample or loop, flipping, re-pitching, time-stretching, slicing to a sampler.
tools: listTrackItems, splitItems, setItemProperties, copyItems, moveItems, analyzeAudio
---
## Rights first

Only sample material the user may use: their own recordings, royalty-free or CC0 packs, or cleared samples. A commercial record needs clearance before release.

## Fitting the tempo

- Playrate ratio = song BPM / sample BPM. 90 → 95 BPM is 1.056.
- Without preserve-pitch the pitch moves with the speed: semitones = 12 × log2(ratio) (1.056 is about +0.94; 2.0 is +12, an octave).
- With preserve-pitch on, the pitch stays and the timing changes; past about ±15 % stretching artefacts get audible.
- Classic flips speed a soul loop up by a few semitones on purpose (no preserve-pitch) for the brighter, chipmunk tone.

## Chopping

1. `listTrackItems` to get the sample item and where it sits in bars.
2. Split on transients or on the grid: `splitItems` at a list of positions (bar/beat), or at a section's edges.
3. Fade every chop 2-10 ms in and out (`setItemProperties` fadeInMs/fadeOutMs) so edits don't click.
4. Rearrange with `moveItems` (by beats or to a bar) and `copyItems` (with times for repeats).
5. Reverse a chop for a swell (`setItemProperties` reversed).
6. Level-match chops: `analyzeAudio` on the items, then changeGainDb.

## Re-pitching chords

Shifting by ±1-5 semitones keeps a natural tone; ±12 is an octave. Larger shifts with preserve-pitch move the formants and sound processed: that can be the effect.

## Making room for new parts

High-pass the sample at 150-250 Hz when you add your own bass and kick, and low-pass it around 8-12 kHz for a darker, older sound.

## Playing chops from MIDI

Load slices into ReaSamplOmatic5000 (stock sampler), one instance per slice or one per pad, and choose whether it plays pitched across the keyboard or triggers the slice as is.
