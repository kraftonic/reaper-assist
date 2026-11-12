---
title: Genre playbooks
when: Tempo, key, drum pattern, sound palette and mix moves for a specific genre (trap, drill, boom bap, lo-fi, R&B, pop, afrobeats, reggaeton, house, drum and bass).
tools: loadGenreTemplate, readMidiNotes, editNotes, analyzeAudio
---
Each heading gives the loadGenreTemplate id, the usual tempo range and the template's default tempo and key. The template builds tracks, instruments, a starter loop and buses as one undo step; these notes are for what comes next.

## trap: 130-160 BPM (140, F# minor)
- Half-time feel: clap or snare on beat 3 of each bar; kicks follow the 808.
- Hats in 1/16 with 1/32 and triplet rolls, velocity ramps on the rolls.
- Long 808s tuned to the key, glides between roots and octaves; dark bells, plucks, choirs, pads.
- Mix: 808 and kick share the low end by sidechain or by tuning; hats bright but high-passed at 300-500 Hz; vocal loud and dry with delay throws.

## drill: 138-146 BPM (142, C minor)
- Snare on beat 3 plus off-grid snare hits; syncopated, sliding kick and 808 patterns.
- Triplet hat figures and short percussion; dark strings, piano, choir.
- 808 slides of 50-100 ms, saturated so they cut through.

## boombap: 84-98 BPM (90, A minor)
- Kick and snare backbeat (snare on 2 and 4), swung 16th hats around 56-60 %.
- Chopped soul, jazz or funk samples; 7th chords.
- Mix: saturated drum bus, low-pass the drums or the whole beat around 12-14 kHz for a sampled feel.

## lofi: 70-90 BPM (78, D major)
- Lazy swing (58-62 %), soft kicks, rimshots, brushed hats.
- Warm keys with 7ths and 9ths, vinyl crackle, tape wobble (pitch LFO about ±10 cents at 0.5-1 Hz).
- Mix: low-pass 8-12 kHz, gentle sidechain pump, masters often quieter (-14 to -11 LUFS).

## rnb: 60-80 BPM (68, Eb major)
- Slow and lush: snaps or claps on 2 and 4, rimshots, 808s or deep subs.
- Rich 7th and 9th chords, stacked vocal harmonies and ad-libs.
- Mix: wide pads, smooth top end, well de-essed vocals with a long plate.

## pop: 100-128 BPM (118, C major)
- Four-chord loop (I-V-vi-IV), big clap on 2 and 4, driving 8th-note bass.
- Everything serves the top line: the vocal sits 1-3 dB above the band.
- Mix bright and controlled; commercial masters often land around -9 to -7 LUFS.

## afrobeats: 95-115 BPM (105, A minor)
- Bouncy groove: rim or snare on a 3-3-2 (tresillo) figure, swung 16th shakers (about 55 %), log-drum style bass hits.
- Palette: clean guitars, plucks, pads, percussion layers.
- Mix: percussion spread wide, kick and bass warm rather than hard.

## reggaeton: 88-100 BPM (95, G minor)
- Dembow: kick on every beat; snare on the 4th and 7th sixteenth of each half bar (the 3-3-2 push).
- Minor progressions (i-VI-III-VII), plucks and synth leads.
- Mix: punchy, dry snare; vocal upfront.

## house: 120-128 BPM (124, F minor)
- Four on the floor, clap on 2 and 4, open hat on every off-beat, 16th shakers with slight swing (52-55 %).
- Chord stabs with 7ths, rolling sub bass; sidechain pumping with release about an 8th note.
- Arrange in 16 and 32-bar phrases with DJ-friendly intro and outro.

## dnb: 170-176 BPM (174, E minor)
- Two-step: kick on 1 and the "and" of 3, snare on 2 and 4; chopped breaks layered on top.
- Rolling sine sub plus a mid bass (detuned saws) that carries the movement.
- Mix: sub mono and steady, snare body around 200 Hz with crack at 4-6 kHz, high energy throughout.

## With Assist

`loadGenreTemplate` { genre: "drill", bpm: 144 } builds the start; then `readMidiNotes` and `editNotes` (swing, humanize, velocity) shape the groove, and `analyzeAudio` checks the low end and loudness against the genre's habits.
