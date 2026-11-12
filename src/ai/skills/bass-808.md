---
title: Bass and 808s
when: 808 or bass tuning, key, glide, low-end mono, distortion, kick and bass clashing.
tools: readMidiNotes, editNotes, analyzeAudio, configureSidechain, setItemProperties, getTrackDetails
---
## Tuning and range

- The 808 is a pitched instrument: its notes must follow the song's key and chord roots. `readMidiNotes` gives the likely key and the 808's note range.
- Useful fundamentals: D1 36.7 Hz, E1 41.2 Hz, F#1 46.2 Hz, A1 55 Hz, C2 65.4 Hz. Most writing sits between about E1 and C2. Below D1 many speakers can't play it; above about G2 the weight goes.
- An 808 sample must be tuned to its note: if it plays C at C, pitch is right; if not, retune it (`setItemProperties` pitchSemitones for audio, or the sampler's tune for MIDI).
- Transpose a bassline with `editNotes` transpose; snap stray notes to the key with toScale.

## Glide and length

- Slides: portamento 30-80 ms, typically between the root and its octave or fifth (drill uses this constantly).
- Mono voice, or notes that end before the next one starts, so tails don't stack into mud. `editNotes` length { legato: true } joins notes for slides.
- Fast patterns need shorter decays; long sustains suit half-time trap.

## Making it translate

- Keep everything below 100-150 Hz mono.
- Saturation or distortion adds 2nd and 3rd harmonics (around 80-250 Hz) so the bass is heard on phones and laptops; blend it in parallel to keep the clean sub.
- `analyzeAudio` on the bass items: the tonal balance shows the sub (20-60 Hz) and low (60-250 Hz) share. A bass with almost nothing above 60 Hz disappears on small speakers.

## Kick against bass

Pick a job split:
1. The kick owns the click and punch (2-5 kHz, 80-100 Hz) and the 808 owns the sub; sidechain the 808 from the kick, 2-6 dB, release 50-100 ms (`configureSidechain`).
2. Or tune the kick to the 808's key and let them hit together as one sound, with the kick's tail short.

Avoid both peaking in the same narrow band: cut 2-3 dB in one where the other peaks.

## Bass guitar

High-pass 30-40 Hz, body 80-100 Hz, growl 600-900 Hz, definition 1.5-2.5 kHz; compress 4:1 with 10-30 ms attack.
