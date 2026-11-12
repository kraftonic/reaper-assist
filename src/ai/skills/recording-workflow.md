---
title: Recording sessions: punch, takes, comping
when: Punch-ins, loop recording, count-in and pre-roll, takes and lanes, picking the best take, latency and monitoring.
tools: getRecordingSetup, setRecordMode, setPreroll, setCountIn, setLoopRegion, chooseTake, markTake, listTrackItems
---
## Set up

- `getRecordingSetup`: buffer 64-256 samples for tracking; round-trip latency under about 10 ms; 24-bit WAV (or 32-bit float) at the project rate.
- Disk: one channel at 24-bit/48 kHz is about 8.6 MB a minute (about 0.5 GB an hour). The setup read shows free space and time left.
- Count-in 1-2 bars with the metronome on (`setCountIn`) for first takes. For punch-ins prefer pre-roll (`setPreroll` record on, 1-2 bars): the performer hears the song leading in.
- Monitoring: "auto" hears the input while armed (tape style); "off" when the interface's direct monitoring is used.

## Punch-in

- Time-selection punch: `setRecordMode` mode time-selection-punch with range = the bars to replace (e.g. fromBar 17, toBar 20). REAPER records only inside it; everything outside stays as it was. Add pre-roll so the take starts in time.
- Item punch: records only over the selected items, handy for replacing one phrase.
- Switch back to normal (`setRecordMode` normal) afterwards so the next full take isn't silently cut short.

## Takes and lanes

- Loop recording: set a loop over the section (`setLoopRegion` with repeat) and record; each pass becomes a new take, or a new lane with fixed lanes in REAPER 7.
- Choose what plays with `chooseTake`: itemId + takeIndex for takes inside an item, track + lane for fixed lanes. Nothing is deleted.
- Label keepers with `markTake` ("best chorus", "keeper") so they're easy to find later.

## Comping method

1. Listen phrase by phrase, not take by take; note the best take per line.
2. Cut on breaths, consonants or just before a downbeat; avoid cutting inside sustained vowels.
3. Crossfade every edit 5-20 ms (`setItemProperties` fadeInMs/fadeOutMs); longer on sustained notes.
4. Check the comp at the original level of each take: `analyzeAudio` on the pieces and match them with changeGainDb.

## Latency of recorded audio

REAPER shifts recordings by the latency the driver reports. If overdubs land consistently early or late, measure a loopback and set the manual offset in Options → Preferences → Audio → Recording.

Recording is sacred: Assist starts or stops recording only when asked, and stopping always keeps what was recorded.
