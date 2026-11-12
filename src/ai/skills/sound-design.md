---
title: Sound design and synth basics
when: Making or shaping a sound: oscillators, filters, envelopes, LFOs, layering, movement, ReaSynth.
tools: getTrackDetails, listFxParameters, setFxParameter, writeAutomation, addFx
---
## Building blocks

- Oscillators: saw is bright (all harmonics), square is hollow (odd harmonics), triangle is soft, sine is pure. Pulse width changes a square's colour.
- Thickness: 2-7 unison voices detuned 5-15 cents; more detune sounds wider but less in tune.
- Filter: low-pass 12 dB/oct is gentle, 24 dB/oct is clubby. Resonance adds a peak at the cutoff; keep it below self-oscillation unless that's the point.
- Envelope amount on the filter is what makes a pluck "pluck".

## Envelope recipes (amp)

| Sound | Attack | Decay | Sustain | Release |
|---|---|---|---|---|
| Pluck, bell | 0-5 ms | 150-400 ms | 0 | 100-200 ms |
| Bass | 0-5 ms | 200-600 ms | high | 30-80 ms |
| Pad | 300-1500 ms | - | high | 1-3 s |
| Lead | 5-20 ms | - | high | 100-300 ms |

## Movement

- Vibrato: LFO on pitch at 5-6 Hz, a few cents deep, faded in after the attack.
- Wobble: LFO on filter cutoff synced to 1/4, 1/8 or 1/16.
- Tremolo and pulsing pads: LFO on volume, 1/8 or 1/16.
- Slow sweeps: automate cutoff over 4-8 bars into a drop.

`writeAutomation` with shape lfo writes these as envelope points on any plug-in parameter: periodBeats 1 = a quarter note, 0.5 = an eighth; low/high are 0-1 parameter values.

## Layering

Build big sounds from parts that each own a band: a sine sub, a saw mid layer, and a noise or air layer on top. Filter each layer to its band so they don't fight, and keep the sub mono.

## Effects

Chorus (0.3-1 Hz, shallow) for width, distortion before the filter for grit, delay and reverb on sends so the dry sound stays clear.

## With Assist

- `getTrackDetails` shows the instrument and preset; `listFxParameters` lists exact parameter names and current values (ReaSynth has attack, decay, sustain, release, waveform mixes, tuning and portamento).
- `setFxParameter` with display values ("250 ms", "-6 dB") is matched against what the plug-in shows.
