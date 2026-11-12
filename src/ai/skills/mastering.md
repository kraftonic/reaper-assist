---
title: Mastering and loudness targets
when: Final loudness, true peak, streaming platform targets, limiter and master bus chain, preparing a release.
tools: analyzeAudio, getTrackDetails, addFx, setFxParameter
---
## Loudness references (integrated LUFS)

| Where | Playback reference | Peak ceiling |
|---|---|---|
| Spotify, YouTube, TIDAL, Amazon Music | about -14 (louder songs are turned down) | -1 dBTP; -2 dBTP if the master is louder than -14 |
| Apple Music (Sound Check) | about -16 | -1 dBTP |
| Club and EDM masters | often -9 to -6 | -1 dBTP or lower |
| Acoustic, jazz, classical | -18 to -12 | -1 dBTP |
| Podcasts (Apple) | -16 ±1 | -1 dBTP |
| Broadcast EBU R128 / US ATSC A/85 | -23 / -24 | -1 / -2 dBTP |

Normalisation means a louder master doesn't play louder on streaming; it only loses punch. Master for the sound the genre expects, keep true peaks at or below -1 dBTP, and don't chase -14 if the genre is denser.

## A simple chain

1. Corrective EQ: narrow cuts only where something sticks out.
2. Tonal EQ: broad shelves of ±0.5-2 dB.
3. Glue compression: 1.5-2:1, attack about 30 ms, auto or 100-200 ms release, 1-2 dB.
4. Optional saturation for density.
5. Limiter: ceiling -1 dB (true-peak mode if available), 1-4 dB of gain reduction. More than about 6 dB starts flattening transients.

Stock REAPER: ReaEQ, ReaComp, ReaLimit on the Master track's FX.

## Checks

- `analyzeAudio` with target master: integrated, short-term and momentary max loudness, peak and loudness range. Measure the loudest section too (range = the last chorus).
- Peak-to-loudness ratio (peak minus LUFS-I): under 7 dB means heavily limited; 8-12 dB is typical for modern pop and rap; over 14 dB is very dynamic.
- Compare with references at matched loudness (see reference-tracks).
- Listen in mono and at low volume; check the low end on headphones.

## Delivery

- 24-bit WAV at the project rate (or 32-bit float); dither only when going down to 16-bit.
- File → Render: source Master mix, bounds Entire project (or regions for an EP).

Assist measures the master but doesn't put plug-ins on the Master track: say what to insert (Master track → FX) and which settings to try.
