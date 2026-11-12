---
title: Comparing with a reference track
when: Comparing a mix with a commercial reference: level matching, tonal balance, loudness, width, low end.
tools: analyzeAudio, listTrackItems, setItemProperties, setTrackMute
---
## Pick references

Two or three released songs in the same genre, at a similar tempo and arrangement density, ideally lossless files the user owns. Put them on their own track, muted while mixing, so they don't play through the mix bus processing.

## Level-match before judging

Louder always sounds better for a moment. Compare at the same integrated loudness:
1. `analyzeAudio` on the reference item and on the mix (the master, or a rendered bounce of the mix on another track).
2. Lower the reference by the difference: a -8 LUFS reference against a -13 LUFS mix gets changeGainDb -5 (`setItemProperties`).
3. Switch between them at the same spot (chorus against chorus: give both reads the same section range).

## What to compare

| Aspect | How |
|---|---|
| Loudness and density | LUFS-I, short-term max and peak-to-loudness ratio of each |
| Dynamics | loudness range (LRA): a much smaller number than the reference means over-compressed |
| Tonal balance | band shares from `analyzeAudio` on audio items (sub, low, low-mid, mid, high-mid, air) |
| Low end | sub vs low share; is the kick or the bass the loudest low element |
| Width | listen in mono; how much sits in the centre |
| Vocal level | how loud the lead is against the drums in the chorus |

Tonal balance is measured from audio files (before track FX). To compare a whole mix's tone, render the mix (File → Render) and import the file next to the reference, then measure both items.

## Use the differences

Make small moves (1-2 dB shelves, a fader change) toward the reference, re-measure, and stop when it sounds right rather than when the numbers match. Different songs, different keys and different arrangements will never match exactly.
