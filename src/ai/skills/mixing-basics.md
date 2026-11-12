---
title: Mixing basics
when: Balancing a mix: EQ, compression, saturation, reverb and delay, buses, stereo width, sidechain, a mix that sounds muddy, harsh, thin or flat.
tools: analyzeAudio, getTrackDetails, addFx, setFxParameter, createSend, configureSidechain, writeAutomation, setTrackVolume
---
## Order of work

1. Balance with faders and pan only, at a moderate volume. Most of a mix is level.
2. Clean up: high-pass anything that isn't bass or kick (start 80-150 Hz, check it in the full mix, not solo).
3. Fix problems with cuts, then shape with gentle boosts.
4. Control dynamics where the part needs it, not everywhere.
5. Add space with sends, then automation for movement.
6. Check in mono, quietly, and against a reference at matched loudness (see reference-tracks).

Keep master peaks around -6 to -3 dBFS while mixing.

## Starting points

| Job | Settings |
|---|---|
| Vocal compression | 3-4:1, attack 10-30 ms, release 50-100 ms, 3-6 dB |
| Bass compression | 4:1, attack 10-30 ms, release about 100 ms |
| Drum bus | 2-4:1, attack 10-30 ms (lets the hit through), fast release, 2-4 dB |
| Mix bus glue | 1.5-2:1, attack 30 ms, auto or 100-200 ms release, 1-2 dB |
| Parallel crush | 8:1 or more, fast attack, blended in 10-30 % |
| Sidechain duck | kick into bass: 2-4 dB, attack 0-5 ms, release 60-120 ms |

## Common problems

- Muddy: too much 200-500 Hz across many tracks. Cut 2-4 dB on pads, guitars and keys rather than on the one part that needs body.
- Harsh: 2-5 kHz build-up (cymbals, distorted guitars, bright vocals). Narrow cuts, de-essing, or darker reverbs.
- Thin: missing 100-250 Hz, or bass that only exists below 60 Hz. Saturate the bass so its harmonics show up on small speakers.
- Flat or small: everything at the same depth. Keep a dry, close lead and send the rest to shorter or longer spaces.
- Masking: two parts fighting for the same band. Carve one with a cut where the other is strong, or duck it with a sidechain.

## Space and width

- Reverbs: room 0.4-0.8 s for glue, plate 1-1.8 s for vocals and snare, hall 2-3 s for pads; pre-delay 10-40 ms; high-pass the return at 200-400 Hz and low-pass at 6-10 kHz.
- Delays: quarter note = 60000 / BPM ms; dotted eighth = 0.75 of a quarter.
- Kick, snare, bass and lead vocal in the centre; keep everything below about 120 Hz mono. Width from panning and double-tracking beats stereo wideners, which often collapse in mono.

## With Assist

- `analyzeAudio` on tracks gives post-FX loudness and peaks; on audio items it also gives tonal balance by band. Report the three biggest issues with numbers.
- `getTrackDetails` shows each chain, sends and sidechains; `createSend` builds reverb and delay buses; `configureSidechain` sets up a verified duck.
- `writeAutomation` for rides and section changes (e.g. +2 dB on the chorus vocal).
