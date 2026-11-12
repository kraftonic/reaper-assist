---
title: Troubleshooting audio problems
when: Latency, crackles, dropouts, CPU overload, no sound, phase problems, clipping or distortion you didn't want.
tools: getRecordingSetup, analyzeAudio, getTrackDetails, getMeters, freezeTrack, getProjectState
---
Start by reading, not guessing: `getRecordingSetup` (device, sample rate, buffer, latency), `getProjectState` (mutes, solos, routing), `getTrackDetails` on the suspect track.

## Latency while recording

- Buffer 64-256 samples for tracking, 512-2048 for mixing.
- Round-trip under about 10 ms feels immediate; above about 12 ms singers and drummers notice.
- Plug-ins with look-ahead (linear-phase EQs, mastering limiters, some amp sims) add delay: bypass them on the track being recorded.
- Bluetooth headphones add 150-300 ms: use wired ones for recording.
- Or monitor through the interface (direct monitoring) and set the track's monitoring off.

## Crackles, dropouts, CPU

- Raise the buffer one step and listen again.
- View → Performance meter (Cmd+Option+P / Ctrl+Alt+P) shows CPU and which tracks cost most; freeze heavy tracks (`freezeTrack`).
- Device sample rate different from the project's forces resampling; match them.
- Laptops: plug in power, turn off low-power mode; avoid unpowered USB hubs for the interface.

## No sound

Check in this order: transport and track meters (`getMeters`), master or track muted, a solo somewhere, the track's master send off, the output device closed (the setup read shows device open false), monitoring off on an armed track, a MIDI track with no instrument.

## Phase

- Thin or hollow when two mics play together: flip polarity on one (snare bottom, kick inside/outside), then nudge alignment by 0.5-3 ms.
- DI and amp on bass: align the amp track to the DI.
- A mix that loses its centre in mono: a stereo widener or phase-shifting plug-in; check by summing to mono.

## Clipping and unwanted distortion

Find the stage with `analyzeAudio`:
1. Items: the source peak and clipped-stretch count show clipping recorded at the input. Turning down can't remove it; re-record or use a de-clipper.
2. Tracks: post-FX peaks at 0 dBFS mean a plug-in output is too hot or clips internally; lower its output or the item gain going in.
3. Master: the sum is too loud; pull all faders down equally and keep a limiter for the final stage only.

## Noise and hum

Mains hum at 50 or 60 Hz and its multiples (100/150 or 120/180): narrow notches, or fix the ground loop. A gate or expander for spill between phrases; high-pass 20-30 Hz removes rumble and DC offset.
