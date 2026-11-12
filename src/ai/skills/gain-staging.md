---
title: Gain staging and recording levels
when: Setting input or plug-in levels, headroom, too loud or too quiet, clipping on the way in.
tools: getRecordingSetup, checkInputLevels, analyzeAudio, getMeters, setItemProperties, setTrackVolume
---
## Working numbers (24-bit recording)

| Stage | Aim for |
|---|---|
| Input, most sources | peaks -18 to -6 dBFS, average around -18 dBFS |
| Vocals | loudest phrase peaking -12 to -8 dBFS |
| Drums, percussion | peaks -10 to -6 dBFS (transients jump) |
| Into analog-style plug-ins | about -18 dBFS average (they treat that as 0 VU) |
| Mix bus while mixing | peaks -6 to -3 dBFS, no limiter needed |

24-bit gives far more range than any room or preamp, so recording "hot" buys nothing and clipping at the converter is permanent. Leave room for the performer getting excited.

## Method

1. Read the setup: `getRecordingSetup` (bit depth, sample rate, armed tracks and inputs).
2. Ask the performer to play or sing the loudest part, then `checkInputLevels` for 4-6 s.
   - Peak above -3 dBFS: lower the preamp gain about 6 dB and check again.
   - Peak below -30 dBFS: raise the preamp; quiet recordings get noisy once you add gain.
   - Assist cannot turn the interface's preamp: tell the user which knob and roughly how far.
3. After recording, `analyzeAudio` on the items: the source numbers show the recorded level, the clipped-stretch count shows overs that were baked in.
4. In the mix, set level with item gain (`setItemProperties` gainDb or changeGainDb) or a gain plug-in at the top of the chain, and keep faders near 0 dB for fine control.
5. Measure tracks and the master with `analyzeAudio`: post-FX peaks near 0 dBFS on a track mean a plug-in is pushing too hard; pull its output down.

## Things engineers check

- REAPER mixes in floating point, so a track meter over 0 is not yet damage. It becomes damage at plug-ins that clip internally (many analog emulations and some limiters), at the converter and when rendering to 16 or 24-bit.
- Many plug-ins sound different with level: compare bypassed and active at matched loudness.
- If the master clips but every track looks fine, the sum is too hot: lower all faders (or the folder) equally rather than putting a limiter on the master.
- `getMeters` only shows the current meter value; it is a quick "is there signal" check, not a level measurement.
