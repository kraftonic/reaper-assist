---
title: Vocal recording and the vocal chain
when: Recording or mixing vocals: mic setup, levels, comping, the vocal FX chain, de-essing, tuning.
tools: getRecordingSetup, checkInputLevels, getTrackDetails, analyzeAudio, addFx, setFxParameter, writeAutomation
---
## Before the take

- Mic: large-diaphragm condenser for most pop and R&B; a dynamic (broadcast style) for untreated rooms, loud singers and rap.
- Distance 15-25 cm, pop filter 5-10 cm in front of the capsule. Aim at the chin or slightly off-axis if plosives or "s" sounds are harsh.
- Treat the wall behind the singer first (duvet, reflection screen); the mic hears that side most.
- Level: loudest phrase peaking -12 to -8 dBFS. Use `checkInputLevels` while they sing the biggest line.
- Monitoring: round-trip latency under about 10 ms feels natural. Above that, use the interface's direct monitoring and set the track's monitoring off so they don't hear themselves twice.
- Headphone reverb helps pitch and confidence. Put it on the track FX or a send, not the input FX: REAPER's input FX are recorded into the file.
- Record 3-5 full takes (or loop the section), then comp (see recording-workflow).

## A typical chain (adjust by ear)

1. High-pass 70-100 Hz (deep voices) or 100-120 Hz (higher voices), 12-18 dB/oct.
2. Tuning (ReaTune or your tuner) before any compression.
3. Cuts: mud 200-400 Hz (-2 to -4 dB, Q about 1.5), boxiness 500-800 Hz, nasal 1-1.5 kHz, harshness 2.5-5 kHz with narrow cuts.
4. Levelling compressor: 3-4:1, attack 10-30 ms, release 50-100 ms, 3-6 dB of reduction.
5. De-esser at 5-8 kHz (higher voices 6-9 kHz), 3-6 dB on the "s" only. Stock option: ReaXcomp with one band there.
6. Tone: presence +1 to +3 dB around 3-5 kHz, air shelf +2 to +4 dB from 10-12 kHz, warmth around 150-250 Hz if thin.
7. Peak compressor: fast attack 1-5 ms, 4-8:1, 2-3 dB, for consistency or attitude.
8. Light saturation for density.
9. Sends: plate 1.0-1.8 s with 20-40 ms pre-delay; 1/8 or 1/4 note delay with 15-30 % feedback. Filter both returns (high-pass 200-300 Hz, low-pass 8-10 kHz) so they sit behind the voice.

Quarter-note delay in ms = 60000 / BPM (at 90 BPM: 667 ms; 1/8 = 333 ms).

## With Assist

- `getTrackDetails` shows the chain and presets already on the vocal; `listFxParameters` gives exact parameter names before `setFxParameter`.
- `analyzeAudio` on the takes compares recorded levels; even them out with `setItemProperties` changeGainDb before compression.
- Ride the vocal with volume automation (1-3 dB moves per phrase) using `writeAutomation` points; rides before compression sound most natural.
