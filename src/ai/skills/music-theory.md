---
title: Music theory for producers
when: Keys and scales, chord progressions, voicings, writing melodies or basslines that fit, what key a part is in.
tools: readMidiNotes, createMidiClip, insertMidiNotes, editNotes
---
## Scales by feel

| Scale | Steps from the root | Feel |
|---|---|---|
| Major | 0 2 4 5 7 9 11 | bright, settled |
| Natural minor | 0 2 3 5 7 8 10 | dark, emotional |
| Dorian | 0 2 3 5 7 9 10 | minor with a hopeful 6th (funk, lo-fi) |
| Phrygian | 0 1 3 5 7 8 10 | tense, dark (drill, metal) |
| Lydian | 0 2 4 6 7 9 11 | dreamy, floating |
| Mixolydian | 0 2 4 5 7 9 10 | bluesy major |
| Harmonic minor | 0 2 3 5 7 8 11 | exotic, strong pull to the root |
| Minor pentatonic | 0 3 5 7 10 | safe for hooks and solos |

## Chords in a key

- Major: I ii iii IV V vi vii°. Minor: i ii° III iv v VI VII (borrow V from harmonic minor for a stronger pull home).
- Progressions that work: I-V-vi-IV (pop), vi-IV-I-V, i-VI-III-VII (minor pop, trap), i-iv-v, ii-V-I with 7ths and 9ths (R&B, lo-fi, jazz), i-VI-iv-V.

## Voicing

- Keep chords roughly between C3 and C5; thirds below C3 sound muddy.
- Move each voice as little as possible between chords (voice leading); inversions help.
- Add 7ths and 9ths for R&B and lo-fi; spread voicings wide for pads.
- Let the bass play roots on downbeats; an approach note in the last eighth leads into the next chord.

## Melody

- Chord tones on strong beats, passing notes on weak ones.
- A sung melody usually spans about an octave to a tenth.
- Short motifs (1-2 bars), repeated with small changes, call and response between phrases.

## With Assist

- `readMidiNotes` estimates the key (with a confidence and runner-up keys) and shows how much of the part is in that scale.
- `editNotes` toScale moves stray notes to the nearest scale note; transpose moves a part by semitones.
- To write chords: `createMidiClip`, then `insertMidiNotes` with start and length in beats from the clip start (pitch 60 = C4, middle C). Some setups label MIDI 60 as C3, so give the number when it matters.
