---
title: REAPER workflows
when: How to do something in REAPER: routing, folders, buses, sends, render and stems, freeze, the stock ReaPlugs, showing or hiding windows and the docker, actions, setting or finding keyboard shortcuts.
tools: findActions, runAction, assignShortcut, removeShortcut, getProjectState, getTrackDetails, createSend, configureSidechain, freezeTrack, setTrackVolume
---
## Routing

- Every track can send to any other: the track's Route (I/O) button opens its sends, receives and hardware outputs. `createSend` does it from chat (post-fader, pre-fader or pre-FX, with a level).
- Buses: either folder tracks (children play through the parent; use the folder icon on the track panel or drag tracks under a track) or a plain track fed by sends (for reverbs and parallel compression).
- "Master send" on a track decides whether it reaches the master directly; a track that only feeds a bus has it off.
- Sidechain: the compressed track gets 4 channels, the key track sends into channels 3/4, and the compressor listens to its auxiliary input. `configureSidechain` builds and verifies all of that with ReaComp.

## Render

File → Render (Ctrl+Alt+R, Cmd+Option+R on Mac):
- Source: Master mix for the song, Stems (selected tracks) for stems, Selected media items for clips.
- Bounds: Entire project, Time selection, or Project regions (one file per region; use the $region wildcard in the file name).
- 24-bit WAV at the project rate for masters and stems.
- The dry-run render statistics (loudness without writing a file) are what `analyzeAudio` uses.

## Freeze

Freezing renders a track to audio and parks its FX to save CPU; unfreezing brings everything back. Right-click the track → Freeze, or `freezeTrack` (asks first). Freeze heavy synths before mixing on a laptop.

## Stock plug-ins worth knowing

ReaEQ (parametric EQ), ReaComp (compressor with sidechain input), ReaXcomp (multiband, also a de-esser), ReaGate, ReaLimit (limiter), ReaDelay, ReaVerbate (algorithmic reverb), ReaVerb (convolution), ReaPitch, ReaTune (pitch correction), ReaSynth, ReaSamplOmatic5000 (sampler), ReaFIR (FFT EQ and noise reduction), plus many JS effects such as saturation.

## Actions and shortcuts

Doing it for the user (REAPER connected):
- Anything in REAPER's action list: `findActions` with 1–3 words from the action's name ("show docker", "toggle snap", "zoom project"), then `runAction` with the id **and exact name** it returned. Toggles report `on` before and after, so say what changed ("The docker is now hidden").
- Show / hide the docker: "View: Show docker" (a toggle). The mixer, FX browser, Media Explorer, transport, Region/Marker Manager and toolbars each have their own "View:" or "…: Show/hide" toggle.
- "What does Cmd+E do?" → `findActions` with `shortcut`. "What's the shortcut for X?" → `findActions`; the result lists its keys.
- New shortcut: `assignShortcut` with the key the user wants. If `keyAlreadyUsedBy` isn't empty, say what that key does now and ask before going on. Then tell the user to press the key in REAPER's window and click OK; REAPER saves it like any shortcut. Check afterwards with `findActions`.
- Prefer the dedicated commands (volume, FX, items, notes, recording) over raw actions: they're checked, targeted and undoable by name.

By hand:
- Actions → Show action list (?) finds any command by name, shows its shortcut and lets you add one. Custom actions chain several actions into one.
- Space play/stop, Ctrl/Cmd+R record, S split items at the cursor, Ctrl/Cmd+Z undo; Edit → Undo history shows every step (each Assist change is one step).
- Options → Preferences (Ctrl+P, Cmd+, on Mac) → Audio → Device for the interface, sample rate and buffer.
- File → Project settings for the project sample rate and the media folder.

## Lanes and takes (REAPER 7)

Recording passes can stack as takes in one item or as fixed lanes; with lanes you can swipe a comp across them. `chooseTake` picks which take or lane plays without deleting anything.
