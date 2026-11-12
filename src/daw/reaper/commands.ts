import { z } from "zod";
import type { Risk } from "@shared/types";
import { GENRES } from "@studio/genres";

/**
 * Everything the assistant may do in the DAW. Each command maps 1:1 to a
 * handler in src/daw/reaper/bridge/assist_bridge.lua. Arguments are validated
 * here (strict: unknown keys are rejected) and again inside REAPER. There is
 * deliberately no command that runs code, deletes media or deletes takes.
 */

export interface CommandSpec<S extends z.ZodType = z.ZodType> {
  summary: string;
  args: S;
  risk: Risk;
  /** Ask even when "auto-approve safe actions" is on: it changes existing material. */
  alwaysConfirm?: boolean;
  /** May run while REAPER is recording. Everything else waits until recording stops. */
  allowedWhileRecording?: boolean;
  timeoutMs: number;
}

/* ------------------------------------------------------------- references */

export const TrackRef = z.union([
  z.strictObject({ name: z.string().min(1).max(256) }).describe("Track by its exact name (case-insensitive)"),
  z.strictObject({ index: z.number().int().min(1).max(10000) }).describe("Track by its 1-based number"),
  z.strictObject({ id: z.string().min(1).max(128) }).describe("Track by the id from getProjectState"),
]);
export type TrackRef = z.infer<typeof TrackRef>;

export const Position = z.union([
  z.strictObject({ bar: z.number().int().min(1).max(100000), beat: z.number().min(1).max(64).optional() }).describe("Bar/beat as the ruler shows them (1-based)"),
  z.strictObject({ seconds: z.number().min(0).max(7 * 24 * 3600) }),
]);
export type Position = z.infer<typeof Position>;

const ClipRef = z.strictObject({ id: z.string().min(1).max(128).describe("Item id returned by createMidiClip or listTrackItems") });

const FxRef = z.union([
  z.strictObject({ index: z.number().int().min(0).max(1023) }).describe("0-based slot in the FX chain"),
  z.strictObject({ name: z.string().min(1).max(256) }).describe("Name of an effect already on the track"),
]);

const TakeRef = z.union([
  z.strictObject({ last: z.literal(true) }).describe("The take(s) from the most recent recording pass"),
  z.strictObject({ itemId: z.string().min(1).max(128), takeIndex: z.number().int().min(0).max(1023).optional() }),
]);

const TrackInput = z.union([
  z.strictObject({ type: z.literal("none") }),
  z.strictObject({
    type: z.literal("audio"),
    channel: z.number().int().min(1).max(512).describe("1-based hardware input channel"),
    stereo: z.boolean().optional().describe("Use channel and channel+1 as a stereo pair"),
  }),
  z.strictObject({
    type: z.literal("midi"),
    device: z.union([z.literal("all"), z.number().int().min(0).max(61)]).optional(),
    channel: z.number().int().min(0).max(16).optional().describe("0 = all channels"),
  }),
]);

const MidiNote = z.strictObject({
  start: z.number().min(0).max(100000).describe("Start in quarter-note beats from the clip start"),
  length: z.number().gt(0).max(100000).describe("Length in quarter-note beats"),
  pitch: z.number().int().min(0).max(127),
  velocity: z.number().int().min(1).max(127),
  channel: z.number().int().min(0).max(15).optional().describe("0-based MIDI channel (9 = GM drums)"),
});

const FxParamRef = z.union([
  z.strictObject({ name: z.string().min(1).max(128).describe("Parameter name as the plug-in reports it") }),
  z.strictObject({ index: z.number().int().min(0).max(100000) }),
]);

const FxParamValue = z.union([
  z.strictObject({ normalized: z.number().min(0).max(1) }),
  z.strictObject({
    display: z.number().min(-1e6).max(1e6).describe("Target in the plug-in's displayed unit, e.g. -18 for -18 dB"),
    unit: z.string().max(16).optional(),
  }),
  z.strictObject({ option: z.string().min(1).max(128).describe("Named option, matched against the plug-in's displayed values") }),
]);

/* ------------------------------------------- places: sections, bars, selection */

const BarNo = z.number().int().min(1).max(100000);
const SectionRef = z.strictObject({
  section: z.string().min(1).max(256),
  occurrence: z.number().int().min(1).max(999).optional().describe("Which one, when the name repeats (1 = first)"),
});

/** A stretch of the timeline. Resolved inside REAPER against the live project (tempo map, regions, markers). */
export const RangeRef = z.union([
  SectionRef.describe("A song section by region or marker name, e.g. \"Chorus\"; a marker section runs to the next marker"),
  z.strictObject({ fromBar: BarNo, toBar: BarNo }).refine((r) => r.toBar >= r.fromBar, "toBar must not be before fromBar")
    .describe("Whole bars, inclusive: fromBar 9 + toBar 16 = 8 bars, ending where bar 17 starts"),
  z.strictObject({ timeSelection: z.literal(true) }).describe("REAPER's current time selection"),
  z.strictObject({ start: Position, end: Position }).describe("Exact start and end"),
]);
export type RangeRef = z.infer<typeof RangeRef>;

/** A point on the timeline: bar/beat, seconds, or where a section starts. */
export const PlaceRef = z.union([...Position.options, SectionRef.describe("Where a section (region or marker) starts")]);

const ItemId = z.string().min(1).max(128);

/** A set of items. */
export const ItemsRef = z.union([
  z.strictObject({ ids: z.array(ItemId).min(1).max(500) }).describe("Item ids from the context, getSelection or listTrackItems"),
  z.strictObject({ selected: z.literal(true) }).describe("The items selected in REAPER"),
  z.strictObject({ track: TrackRef, range: RangeRef.optional() }).describe("Items on a track; with range, only the items overlapping it"),
]);

/** A set of MIDI notes: one source (track, items or the selection), optionally narrowed by range and pitch. */
export const NotesRef = z
  .strictObject({
    track: TrackRef.optional().describe("Every MIDI item on this track"),
    items: z.array(ItemId).min(1).max(200).optional().describe("Specific MIDI items by id"),
    selected: z.enum(["notes", "items"]).optional().describe("notes = notes selected in the open MIDI editor; items = the selected MIDI items"),
    range: RangeRef.optional().describe("Only notes that start inside this range"),
    pitch: z.strictObject({ min: z.number().int().min(0).max(127), max: z.number().int().min(0).max(127) }).optional()
      .describe("Only notes in this pitch range (60 = C4), e.g. one drum lane"),
  })
  .refine((n) => [n.track, n.items, n.selected].filter((x) => x !== undefined).length === 1, "Give exactly one of track, items or selected");

const Offset = z
  .strictObject({
    bars: z.number().min(-10000).max(10000).optional(),
    beats: z.number().min(-100000).max(100000).optional(),
    seconds: z.number().min(-86400).max(86400).optional(),
  })
  .refine((o) => o.bars !== undefined || o.beats !== undefined || o.seconds !== undefined, "Give bars, beats or seconds");

const EnvelopeRef = z.union([
  z.strictObject({ kind: z.enum(["volume", "pan", "mute"]) }).describe("Track volume (dB), pan (-1 left to 1 right) or mute (1 = muted)"),
  z.strictObject({ fx: FxRef, param: FxParamRef }).describe("An effect parameter, values normalized 0 to 1"),
]);

export const NOTE_NAMES = ["C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"] as const;
export const SCALE_MODES = [
  "major", "minor", "dorian", "phrygian", "lydian", "mixolydian", "locrian",
  "harmonic-minor", "melodic-minor", "major-pentatonic", "minor-pentatonic", "blues",
] as const;

const Velocity = z.number().int().min(1).max(127);
const AutoValue = z.number().min(-150).max(24);

/** A REAPER action: a number for REAPER's own actions, "_ID" for scripts, SWS and custom actions. */
const ActionId = z.union([z.number().int().min(1).max(2 ** 31 - 1), z.string().regex(/^_[A-Za-z0-9_.-]{1,200}$/)]).describe("Action id from findActions");
/** The action's exact name from findActions. Shown to the user when asking; REAPER refuses if it doesn't match the id. */
const ActionName = z.string().min(1).max(300).describe("The action's exact name from findActions");
const ActionSection = z.enum(["main", "midi", "midilist", "explorer"]).describe("Action list section: main (default), midi = MIDI editor, midilist = MIDI event list, explorer = Media Explorer");

const empty = z.strictObject({});
const cmd = <S extends z.ZodType>(s: CommandSpec<S>) => s;
const atLeastOne = (keys: string[]) => (a: Record<string, unknown>) => keys.some((k) => a[k] !== undefined);

/* --------------------------------------------------------------- commands */

export const COMMANDS = {
  getProjectState: cmd({
    summary: "Read the open REAPER project: tracks (with FX, sends, volume, pan, arm state), transport, tempo, markers, recording settings and audio inputs. Call this before acting on tracks.",
    args: empty, risk: "read", allowedWhileRecording: true, timeoutMs: 5000,
  }),
  listInstalledFx: cmd({
    summary: "Search the effects and instruments installed in REAPER.",
    args: z.strictObject({ filter: z.string().max(128).optional(), kind: z.enum(["any", "instrument", "effect"]).optional(), limit: z.number().int().min(1).max(500).optional() }),
    risk: "read", allowedWhileRecording: true, timeoutMs: 10000,
  }),
  listFxParameters: cmd({
    summary: "List the parameters of an effect on a track with their current displayed values.",
    args: z.strictObject({ track: TrackRef, fx: FxRef }), risk: "read", allowedWhileRecording: true, timeoutMs: 5000,
  }),
  listTrackItems: cmd({
    summary: "List the items on a track with ids, bars, gain, fades, pitch, playrate and takes (optionally only those overlapping a range).",
    args: z.strictObject({ track: TrackRef, range: RangeRef.optional() }), risk: "read", allowedWhileRecording: true, timeoutMs: 5000,
  }),
  getSelection: cmd({
    summary: "Read what is selected in REAPER right now: tracks, items (ids and bars), razor edits, the time selection, notes in the open MIDI editor and the selected envelope.",
    args: empty, risk: "read", allowedWhileRecording: true, timeoutMs: 5000,
  }),
  getTrackDetails: cmd({
    summary: "Read one track in depth: the instrument or samples it plays, FX chain with presets, input FX, sends and receives, folder, envelopes, items by bar and MIDI note range.",
    args: z.strictObject({ track: TrackRef }), risk: "read", allowedWhileRecording: true, timeoutMs: 8000,
  }),
  readMidiNotes: cmd({
    summary: "Read MIDI notes in a place (bar.beat, pitch name, length in beats, velocity) with a summary: likely key and scale, note range, velocity spread, notes per bar.",
    args: z.strictObject({ notes: NotesRef, limit: z.number().int().min(0).max(2000).optional().describe("Most notes to list (default 200; 0 = summary only)") }),
    risk: "read", allowedWhileRecording: true, timeoutMs: 10000,
  }),
  readAutomation: cmd({
    summary: "Read the automation points of a track's volume, pan or mute envelope, or of an effect parameter, optionally in a range.",
    args: z.strictObject({ track: TrackRef, envelope: EnvelopeRef, range: RangeRef.optional() }), risk: "read", allowedWhileRecording: true, timeoutMs: 5000,
  }),
  analyzeAudio: cmd({
    summary: "Measure without playing anything: integrated, short-term and momentary loudness (LUFS), peak, true peak, RMS, crest factor, loudness range, clipping and tonal balance (sub to air) for the master, tracks or items over a range. The master and tracks are measured after their FX (offline dry-run render); items also report their recorded source level and tonal balance.",
    args: z.strictObject({
      target: z.union([
        z.strictObject({ master: z.literal(true) }),
        z.strictObject({ tracks: z.array(TrackRef).min(1).max(32) }),
        z.strictObject({ items: ItemsRef }),
      ]),
      range: RangeRef.optional().describe("Default: the whole project (master, tracks) or each whole item"),
    }),
    risk: "read", timeoutMs: 180000,
  }),
  getRecordingSetup: cmd({
    summary: "Read the recording setup: audio device, sample rate, buffer and round-trip latency, record mode (normal or punch), pre-roll, count-in, metronome, recording format, folder and free disk space, and each armed track's input, monitoring, input FX and record mode.",
    args: empty, risk: "read", allowedWhileRecording: true, timeoutMs: 8000,
  }),
  checkInputLevels: cmd({
    summary: "Listen to the inputs of armed tracks for a few seconds (nothing is played or recorded) and report peak level and headroom per track. Ask the performer to play their loudest part while it listens.",
    args: z.strictObject({
      tracks: z.array(TrackRef).min(1).max(32).optional().describe("Default: every armed track"),
      seconds: z.number().min(1).max(10).optional().describe("Default 4"),
    }),
    risk: "read", allowedWhileRecording: true, timeoutMs: 16000,
  }),
  getMeters: cmd({
    summary: "Read current peak levels of tracks (e.g. to check an input signal is arriving).",
    args: z.strictObject({ tracks: z.array(TrackRef).max(64).optional() }), risk: "read", allowedWhileRecording: true, timeoutMs: 5000,
  }),

  setTempo: cmd({ summary: "Set the project tempo in BPM.", args: z.strictObject({ bpm: z.number().min(20).max(400) }), risk: "caution", timeoutMs: 5000 }),
  setTimeSignature: cmd({
    summary: "Set the project time signature.",
    args: z.strictObject({ numerator: z.number().int().min(1).max(32), denominator: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(8), z.literal(16), z.literal(32)]) }),
    risk: "caution", timeoutMs: 5000,
  }),
  saveProject: cmd({ summary: "Save the project to its existing file.", args: empty, risk: "safe", timeoutMs: 20000 }),
  setCursor: cmd({ summary: "Move the edit cursor.", args: z.strictObject({ position: Position }), risk: "safe", timeoutMs: 5000 }),
  addMarker: cmd({
    summary: "Add a project marker (defaults to the play/edit position).",
    args: z.strictObject({ position: Position.optional(), name: z.string().max(256).optional() }), risk: "safe", allowedWhileRecording: true, timeoutMs: 5000,
  }),
  addRegion: cmd({ summary: "Add a named region.", args: z.strictObject({ start: Position, end: Position, name: z.string().max(256).optional() }), risk: "safe", timeoutMs: 5000 }),
  setLoopRegion: cmd({ summary: "Set the loop range and optionally turn repeat on.", args: z.strictObject({ start: Position, end: Position, repeat: z.boolean().optional() }), risk: "safe", timeoutMs: 5000 }),
  clearLoopRegion: cmd({ summary: "Turn repeat off.", args: empty, risk: "safe", timeoutMs: 5000 }),
  setCountIn: cmd({ summary: "Turn the recording count-in on or off and set its length in bars.", args: z.strictObject({ enabled: z.boolean(), bars: z.number().min(0.25).max(16).optional() }), risk: "safe", timeoutMs: 5000 }),
  setMetronome: cmd({ summary: "Turn the metronome on or off.", args: z.strictObject({ enabled: z.boolean() }), risk: "safe", allowedWhileRecording: true, timeoutMs: 5000 }),

  startPlayback: cmd({ summary: "Start playback, optionally from a position.", args: z.strictObject({ from: Position.optional() }), risk: "safe", timeoutMs: 5000 }),
  pausePlayback: cmd({ summary: "Pause playback.", args: empty, risk: "safe", allowedWhileRecording: true, timeoutMs: 5000 }),
  stopPlayback: cmd({ summary: "Stop the transport. Recordings in progress are kept, never discarded.", args: empty, risk: "safe", allowedWhileRecording: true, timeoutMs: 10000 }),
  startRecording: cmd({
    summary: "Start recording on the armed tracks. Existing takes are preserved.",
    args: z.strictObject({ from: Position.optional(), countInBars: z.number().min(0).max(16).optional() }), risk: "caution", timeoutMs: 8000,
  }),
  stopRecording: cmd({ summary: "Stop recording and keep everything recorded.", args: empty, risk: "safe", allowedWhileRecording: true, timeoutMs: 10000 }),
  markTake: cmd({ summary: "Label a recorded take with a take marker (audio is unchanged).", args: z.strictObject({ take: TakeRef, label: z.string().min(1).max(64) }), risk: "safe", timeoutMs: 5000 }),

  createTrack: cmd({
    summary: "Create a track.",
    args: z.strictObject({ name: z.string().min(1).max(256), kind: z.enum(["audio", "midi", "bus"]).optional(), position: z.number().int().min(1).max(10000).optional().describe("1-based track number to insert at; default end") }),
    risk: "safe", timeoutMs: 5000,
  }),
  renameTrack: cmd({ summary: "Rename a track.", args: z.strictObject({ track: TrackRef, name: z.string().min(1).max(256) }), risk: "safe", timeoutMs: 5000 }),
  selectTrack: cmd({ summary: "Select a track (deselecting others).", args: z.strictObject({ track: TrackRef }), risk: "safe", allowedWhileRecording: true, timeoutMs: 5000 }),
  setTrackInput: cmd({ summary: "Set a track's recording input.", args: z.strictObject({ track: TrackRef, input: TrackInput }), risk: "safe", timeoutMs: 5000 }),
  armTrack: cmd({ summary: "Arm or disarm a track for recording.", args: z.strictObject({ track: TrackRef, armed: z.boolean() }), risk: "safe", timeoutMs: 5000 }),
  setMonitoring: cmd({ summary: "Set input monitoring: off, on, or auto.", args: z.strictObject({ track: TrackRef, mode: z.enum(["off", "on", "auto"]) }), risk: "safe", allowedWhileRecording: true, timeoutMs: 5000 }),

  setTrackVolume: cmd({
    summary: "Set a track's fader in dB (db), or change it relatively (changeDb). Give exactly one.",
    args: z.strictObject({ track: TrackRef, db: z.number().min(-150).max(12).optional(), changeDb: z.number().min(-48).max(24).optional() })
      .refine((a) => (a.db === undefined) !== (a.changeDb === undefined), "Give exactly one of db or changeDb"),
    risk: "safe", allowedWhileRecording: true, timeoutMs: 5000,
  }),
  setTrackPan: cmd({ summary: "Set a track's pan from -1 (left) to 1 (right).", args: z.strictObject({ track: TrackRef, pan: z.number().min(-1).max(1) }), risk: "safe", allowedWhileRecording: true, timeoutMs: 5000 }),
  setTrackMute: cmd({ summary: "Mute or unmute a track.", args: z.strictObject({ track: TrackRef, muted: z.boolean() }), risk: "safe", allowedWhileRecording: true, timeoutMs: 5000 }),
  setTrackSolo: cmd({ summary: "Solo or unsolo a track.", args: z.strictObject({ track: TrackRef, soloed: z.boolean() }), risk: "safe", allowedWhileRecording: true, timeoutMs: 5000 }),

  createMidiClip: cmd({
    summary: "Create an empty MIDI clip on a track. Returns its id for insertMidiNotes.",
    args: z.strictObject({ track: TrackRef, start: Position, lengthBars: z.number().gt(0).max(1024), name: z.string().max(256).optional() }),
    risk: "caution", timeoutMs: 5000,
  }),
  insertMidiNotes: cmd({ summary: "Insert notes into a MIDI clip; existing notes are kept.", args: z.strictObject({ clip: ClipRef, notes: z.array(MidiNote).min(1).max(5000) }), risk: "caution", timeoutMs: 15000 }),
  quantizeMidiClip: cmd({
    summary: "Quantize note starts in a MIDI clip to a grid (gridBeats 0.25 = 1/16).",
    args: z.strictObject({ clip: ClipRef, gridBeats: z.number().min(1 / 64).max(4), strength: z.number().min(0).max(1).optional() }),
    risk: "caution", alwaysConfirm: true, timeoutMs: 15000,
  }),

  addFx: cmd({
    summary: "Insert an installed effect or instrument on a track (name must match listInstalledFx).",
    args: z.strictObject({ track: TrackRef, fx: z.string().min(1).max(512), position: z.number().int().min(0).max(1023).optional() }),
    risk: "caution", timeoutMs: 15000,
  }),
  setFxParameter: cmd({
    summary: "Set an effect parameter by name; display targets are matched against the plug-in's own displayed values.",
    args: z.strictObject({ track: TrackRef, fx: FxRef, param: FxParamRef, value: FxParamValue }), risk: "caution", timeoutMs: 8000,
  }),
  setFxEnabled: cmd({ summary: "Bypass or enable an effect.", args: z.strictObject({ track: TrackRef, fx: FxRef, enabled: z.boolean() }), risk: "caution", timeoutMs: 5000 }),

  createSend: cmd({
    summary: "Send audio from one track to another.",
    args: z.strictObject({
      from: TrackRef, to: TrackRef,
      volumeDb: z.number().min(-150).max(12).optional(),
      mode: z.enum(["post-fader", "pre-fader", "pre-fx"]).optional(),
      sourceChannel: z.number().int().min(1).max(127).optional(),
      destChannel: z.number().int().min(1).max(127).optional().describe("3 for a sidechain input"),
    }),
    risk: "caution", timeoutMs: 5000,
  }),
  configureSidechain: cmd({
    summary: "Duck the target track with a compressor keyed from the source track (4 channels, send into 3/4, compressor on aux input). Every part is verified.",
    args: z.strictObject({
      source: TrackRef, target: TrackRef,
      compressor: z.strictObject({ thresholdDb: z.number().min(-60).max(0).optional(), ratio: z.number().min(1).max(100).optional(), attackMs: z.number().min(0).max(500).optional(), releaseMs: z.number().min(1).max(5000).optional() }).optional(),
      sendDb: z.number().min(-60).max(12).optional(),
    }),
    risk: "caution", alwaysConfirm: true, timeoutMs: 15000,
  }),

  splitItems: cmd({
    summary: "Split items at positions, or at the start and end of a range (e.g. a section). Nothing is removed.",
    args: z.strictObject({ items: ItemsRef, at: z.array(PlaceRef).min(1).max(64).optional(), atRangeEdges: RangeRef.optional() })
      .refine((a) => (a.at === undefined) !== (a.atRangeEdges === undefined), "Give exactly one of at or atRangeEdges"),
    risk: "caution", timeoutMs: 10000,
  }),
  moveItems: cmd({
    summary: "Move items by an amount (bars, beats or seconds) or to a place (the earliest item lands there, the rest keep their spacing), and/or onto another track.",
    args: z.strictObject({ items: ItemsRef, by: Offset.optional(), to: PlaceRef.optional(), toTrack: TrackRef.optional() })
      .refine((a) => !(a.by && a.to), "Give by or to, not both")
      .refine(atLeastOne(["by", "to", "toTrack"]), "Say where to move them (by, to or toTrack)"),
    risk: "caution", timeoutMs: 10000,
  }),
  copyItems: cmd({
    summary: "Copy items to a place, optionally several times in a row (e.g. repeat bars 1-4 four times). When the items are given with a range, only the part inside the range is copied and the range start lands on 'to'. Refuses to write over existing items.",
    args: z.strictObject({ items: ItemsRef, to: PlaceRef, toTrack: TrackRef.optional(), times: z.number().int().min(1).max(64).optional() }),
    risk: "caution", timeoutMs: 20000,
  }),
  trimItems: cmd({
    summary: "Trim items: crop them to a range, or move their start and/or end edge. Trimmed audio stays in the file and can be dragged back.",
    args: z.strictObject({ items: ItemsRef, toRange: RangeRef.optional(), start: PlaceRef.optional(), end: PlaceRef.optional() })
      .refine((a) => (a.toRange !== undefined) !== (a.start !== undefined || a.end !== undefined), "Give toRange, or start and/or end"),
    risk: "caution", timeoutMs: 10000,
  }),
  setItemProperties: cmd({
    summary: "Change items' gain (dB, or relative), fade-in/out length and shape, pitch (semitones), playrate, preserve-pitch, reverse, mute or name. Only the properties given change.",
    args: z
      .strictObject({
        items: ItemsRef,
        gainDb: z.number().min(-150).max(24).optional(),
        changeGainDb: z.number().min(-48).max(24).optional(),
        fadeInMs: z.number().min(0).max(600000).optional(),
        fadeOutMs: z.number().min(0).max(600000).optional(),
        fadeShape: z.enum(["linear", "fast-start", "fast-end", "s-curve"]).optional(),
        pitchSemitones: z.number().min(-48).max(48).optional().describe("Take pitch shift; fractions are cents (0.5 = 50 cents)"),
        playrate: z.number().min(0.1).max(10).optional(),
        preservePitch: z.boolean().optional().describe("Keep the pitch when the playrate changes"),
        reversed: z.boolean().optional(),
        muted: z.boolean().optional(),
        name: z.string().min(1).max(256).optional(),
      })
      .refine((a) => !(a.gainDb !== undefined && a.changeGainDb !== undefined), "Give gainDb or changeGainDb, not both")
      .refine(atLeastOne(["gainDb", "changeGainDb", "fadeInMs", "fadeOutMs", "fadeShape", "pitchSemitones", "playrate", "preservePitch", "reversed", "muted", "name"]), "Give at least one property to change"),
    risk: "caution", timeoutMs: 10000,
  }),
  glueItems: cmd({
    summary: "Glue items on one track into a single new item (REAPER renders a new file; the old files stay on disk and undo brings the items back). Refuses items with more than one take, so no take is lost.",
    args: z.strictObject({ items: ItemsRef }), risk: "caution", alwaysConfirm: true, timeoutMs: 120000,
  }),
  editNotes: cmd({
    summary: "Edit MIDI notes in a place. Applied in this order: snap to scale, transpose, quantize (grid, strength, swing), length, velocity, humanize. One undo step; the result is read back.",
    args: z
      .strictObject({
        notes: NotesRef,
        toScale: z.strictObject({ tonic: z.enum(NOTE_NAMES), mode: z.enum(SCALE_MODES) }).optional().describe("Move out-of-scale notes to the nearest scale note"),
        transpose: z.number().int().min(-48).max(48).optional().describe("Semitones (12 = up an octave)"),
        quantize: z.strictObject({
          gridBeats: z.number().min(1 / 64).max(4).describe("0.25 = 1/16, 0.5 = 1/8, 1/3 = 1/8 triplet"),
          strength: z.number().min(0).max(1).optional().describe("1 = fully on the grid; 0.5-0.8 keeps some feel"),
          swing: z.number().min(50).max(75).optional().describe("Percent: 50 straight, 55-58 light, 62-66 heavy/triplet"),
          ends: z.boolean().optional().describe("Also quantize note ends"),
        }).optional(),
        length: z.union([
          z.strictObject({ beats: z.number().min(1 / 64).max(64) }),
          z.strictObject({ scalePercent: z.number().min(1).max(1000) }),
          z.strictObject({ legato: z.literal(true) }).describe("Stretch each note to the next note"),
        ]).optional(),
        velocity: z.union([
          z.strictObject({ set: Velocity }),
          z.strictObject({ change: z.number().int().min(-126).max(126) }),
          z.strictObject({ scalePercent: z.number().min(1).max(400) }),
          z.strictObject({ compressTo: z.strictObject({ min: Velocity, max: Velocity }) }).describe("Squeeze velocities into this range, keeping their order"),
          z.strictObject({ ramp: z.strictObject({ from: Velocity, to: Velocity }) }).describe("Crescendo or fade across the notes in time order"),
        ]).optional(),
        humanize: z.strictObject({
          timingMs: z.number().min(0).max(50).optional().describe("Max random shift, e.g. 5-12 ms"),
          velocity: z.number().int().min(0).max(40).optional().describe("Max random velocity change, e.g. 6-12"),
          seed: z.number().int().min(0).max(1e9).optional(),
        }).optional(),
      })
      .refine(atLeastOne(["toScale", "transpose", "quantize", "length", "velocity", "humanize"]), "Give at least one edit"),
    risk: "caution", timeoutMs: 20000,
  }),
  deleteNotes: cmd({
    summary: "Delete the MIDI notes in a place (e.g. the hats in bars 9-16). Always asks first; undo brings them back.",
    args: z.strictObject({ notes: NotesRef }), risk: "caution", alwaysConfirm: true, timeoutMs: 15000,
  }),
  writeAutomation: cmd({
    summary: "Write automation in a range: a constant value (set), a ramp (from → to), explicit points, a repeating lfo shape, or clear. Points outside the range are kept and the value at the range edges is preserved. Values: volume dB, pan -1 (left) to 1 (right), mute 0/1, effect parameters 0 to 1.",
    args: z
      .strictObject({
        track: TrackRef,
        envelope: EnvelopeRef,
        range: RangeRef,
        shape: z.enum(["set", "ramp", "points", "lfo", "clear"]),
        value: AutoValue.optional().describe("For set"),
        from: AutoValue.optional().describe("For ramp"),
        to: AutoValue.optional().describe("For ramp"),
        points: z.array(z.strictObject({ at: PlaceRef, value: AutoValue })).min(1).max(512).optional().describe("For points"),
        lfo: z.strictObject({
          wave: z.enum(["sine", "triangle", "saw-up", "saw-down", "square"]),
          periodBeats: z.number().min(1 / 16).max(64),
          low: AutoValue,
          high: AutoValue,
        }).optional(),
      })
      .refine((a) => a.shape !== "set" || a.value !== undefined, "set needs value")
      .refine((a) => a.shape !== "ramp" || (a.from !== undefined && a.to !== undefined), "ramp needs from and to")
      .refine((a) => a.shape !== "points" || a.points !== undefined, "points needs points")
      .refine((a) => a.shape !== "lfo" || a.lfo !== undefined, "lfo needs lfo"),
    risk: "caution", timeoutMs: 10000,
  }),
  setRecordMode: cmd({
    summary: "Set the record mode: normal; time-selection punch (records only inside the time selection; give range to set it); or item punch (records only over the selected items).",
    args: z.strictObject({ mode: z.enum(["normal", "time-selection-punch", "item-punch"]), range: RangeRef.optional() }),
    risk: "safe", timeoutMs: 5000,
  }),
  setPreroll: cmd({
    summary: "Turn pre-roll on or off before recording and/or playback, and set its length in bars.",
    args: z.strictObject({ record: z.boolean().optional(), play: z.boolean().optional(), bars: z.number().min(0).max(16).optional() })
      .refine(atLeastOne(["record", "play", "bars"]), "Give record, play or bars"),
    risk: "safe", timeoutMs: 5000,
  }),
  chooseTake: cmd({
    summary: "Choose what plays: a take inside an item (itemId + takeIndex), or a comp lane on a fixed-lane track (track + lane). Other takes and lanes are kept, never deleted.",
    args: z
      .strictObject({
        itemId: ItemId.optional(),
        takeIndex: z.number().int().min(0).max(1023).optional().describe("0-based take number"),
        track: TrackRef.optional(),
        lane: z.number().int().min(0).max(1023).optional().describe("0-based lane number"),
      })
      .refine(
        (a) => (a.itemId !== undefined && a.takeIndex !== undefined && a.track === undefined && a.lane === undefined)
          || (a.track !== undefined && a.lane !== undefined && a.itemId === undefined && a.takeIndex === undefined),
        "Give itemId + takeIndex, or track + lane",
      ),
    risk: "safe", timeoutMs: 5000,
  }),
  freezeTrack: cmd({
    summary: "Freeze a track (renders it to audio and parks its FX to save CPU; reversible), or unfreeze it.",
    args: z.strictObject({ track: TrackRef, frozen: z.boolean(), channels: z.enum(["stereo", "mono", "multichannel"]).optional() }),
    risk: "caution", alwaysConfirm: true, timeoutMs: 180000,
  }),

  loadGenreTemplate: cmd({
    summary: `Set up a beat in the open project for a genre: tempo, song-section markers, Drums/808-or-Bass/Keys/Melody/Vocal tracks with REAPER's ReaSynth on the 808/bass, keys and melody (the Drums track is left for the user's drum sampler), a playable starter loop (drums, low end, chords in the genre's key), EQ/compression and Reverb/Delay buses. Adds to the current project as ONE undo step. Genres: ${GENRES.map((g) => `${g.id} (${g.name}, ${g.bpm} BPM, ${g.key.tonic} ${g.key.mode})`).join(", ")}.`,
    args: z.strictObject({
      genre: z.enum(GENRES.map((g) => g.id) as [string, ...string[]]),
      bpm: z.number().min(40).max(220).optional().describe("Override the genre's default tempo"),
    }),
    risk: "caution", alwaysConfirm: true, timeoutMs: 60000,
  }),
  /* REAPER's action list (bridge 0.5): everything else REAPER can do. */
  findActions: cmd({
    summary: "Search REAPER's action list (thousands of actions: show/hide windows and the docker, zoom, editing, transport, views, SWS and script actions). Returns each action's id, name, on/off state and current shortcuts. Use it whenever no dedicated command fits, before runAction or assignShortcut, and to answer \"what's the shortcut for…\". REAPER names actions like \"View: Show docker\", \"Item: Split items at edit cursor\"; search with 1–3 plain words. Pass `shortcut` to find what a key does.",
    args: z.strictObject({
      query: z.string().min(1).max(200),
      section: ActionSection.optional(),
      shortcut: z.string().min(1).max(64).optional().describe("Only actions bound to this key, e.g. \"Shift+D\" or \"Cmd+E\""),
      limit: z.number().int().min(1).max(100).optional(),
    }),
    risk: "read", allowedWhileRecording: true, timeoutMs: 10000,
  }),
  runAction: cmd({
    summary: "Run one REAPER action by its id from findActions (e.g. show/hide the docker, the mixer, the FX browser, toggle snap, zoom to project). For things a dedicated command does (volume, FX, items, notes, recording) use that command instead: it's checked and reversible. MIDI-editor actions need section \"midi\" and an open MIDI editor. Quitting, closing projects and deleting files are refused.",
    args: z.strictObject({ action: ActionId, name: ActionName, section: ActionSection.optional() }),
    risk: "caution", timeoutMs: 15000,
  }),
  assignShortcut: cmd({
    summary: "Help the user add a keyboard shortcut to a REAPER action: opens REAPER's own shortcut window for that action, where the user presses the key (REAPER has no way to set a key without it). Give `key` to check first whether that key is already used. Tell the user which key to press and to click OK.",
    args: z.strictObject({ action: ActionId, name: ActionName, section: ActionSection.optional(), key: z.string().min(1).max(64).optional() }),
    risk: "safe", timeoutMs: 15000,
  }),
  removeShortcut: cmd({
    summary: "Remove one keyboard shortcut from a REAPER action (the key as findActions shows it, e.g. \"Shift+D\").",
    args: z.strictObject({ action: ActionId, name: ActionName, section: ActionSection.optional(), key: z.string().min(1).max(64) }),
    risk: "caution", alwaysConfirm: true, timeoutMs: 10000,
  }),
  undo: cmd({
    summary: "Undo the most recent Assist change. expectLabel must be the undoLabel that change returned; REAPER refuses if the newest undo point is something else.",
    args: z.strictObject({ expectLabel: z.string().min(1).max(512) }), risk: "caution", timeoutMs: 8000,
  }),
} as const satisfies Record<string, CommandSpec>;

export type CommandName = keyof typeof COMMANDS;
export const COMMAND_NAMES = Object.keys(COMMANDS) as CommandName[];

export function isCommandName(v: unknown): v is CommandName {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(COMMANDS, v);
}

/** JSON Schema for an LLM tool definition. */
export function commandJsonSchema(name: CommandName): Record<string, unknown> {
  const s = z.toJSONSchema(COMMANDS[name].args, { unrepresentable: "any" }) as Record<string, unknown>;
  delete s.$schema;
  return s;
}

export type Validated = { ok: true; args: Record<string, unknown> } | { ok: false; message: string };

export function validateArgs(name: CommandName, args: unknown): Validated {
  const r = COMMANDS[name].args.safeParse(args ?? {});
  if (r.success) return { ok: true, args: r.data as Record<string, unknown> };
  return { ok: false, message: r.error.issues.map((i) => `${i.path.join(".") || "(args)"}: ${i.message}`).join("; ") };
}

/* -------------------------------------------------------- human summaries */

function trackLabel(t: unknown): string {
  if (!t || typeof t !== "object") return "a track";
  const r = t as Record<string, unknown>;
  if (typeof r.name === "string") return `“${r.name}”`;
  if (typeof r.index === "number") return `track ${r.index}`;
  return "a track";
}
function pos(p: unknown): string {
  if (!p || typeof p !== "object") return "";
  const r = p as Record<string, unknown>;
  if (typeof r.bar === "number") return r.beat && r.beat !== 1 ? `bar ${r.bar} beat ${r.beat}` : `bar ${r.bar}`;
  if (typeof r.seconds === "number") return `${r.seconds.toFixed(2)} s`;
  return "";
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const signed = (n: unknown) => `${Number(n) > 0 ? "+" : ""}${n}`;

/** "bars 9–16", "“Chorus” (2nd)", "the time selection". */
export function rangeLabel(r: unknown): string {
  const x = obj(r);
  if (typeof x.section === "string") return `“${x.section}”${typeof x.occurrence === "number" ? ` (#${x.occurrence})` : ""}`;
  if (typeof x.fromBar === "number") return x.fromBar === x.toBar ? `bar ${x.fromBar}` : `bars ${x.fromBar}–${x.toBar}`;
  if (x.timeSelection) return "the time selection";
  if (x.start) return `${pos(x.start)} → ${pos(x.end)}`;
  return "";
}
function placeLabel(p: unknown): string {
  const x = obj(p);
  return typeof x.section === "string" ? `the start of ${rangeLabel(x)}` : pos(x);
}
function itemsLabel(i: unknown): string {
  const x = obj(i);
  if (Array.isArray(x.ids)) return x.ids.length === 1 ? "an item" : `${x.ids.length} items`;
  if (x.selected) return "the selected items";
  if (x.track) return `items on ${trackLabel(x.track)}${x.range ? ` in ${rangeLabel(x.range)}` : ""}`;
  return "items";
}
function notesLabel(n: unknown): string {
  const x = obj(n);
  const src = x.selected === "notes" ? "the selected notes" : x.selected === "items" ? "notes in the selected clips"
    : Array.isArray(x.items) ? `notes in ${x.items.length === 1 ? "a clip" : `${x.items.length} clips`}` : `notes on ${trackLabel(x.track)}`;
  const p = obj(x.pitch);
  const pitch = typeof p.min === "number" ? (p.min === p.max ? ` (pitch ${p.min})` : ` (pitches ${p.min}–${p.max})`) : "";
  return `${src}${x.range ? ` in ${rangeLabel(x.range)}` : ""}${pitch}`;
}
/** 0.25 → "1/16", 1/3 → "1/8T". */
export function gridLabel(beats: number): string {
  const d = 4 / beats;
  if (Math.abs(d - Math.round(d)) < 1e-6) {
    const n = Math.round(d);
    return n % 3 === 0 && n >= 3 ? `1/${(n / 3) * 2}T` : `1/${n}`;
  }
  return `${beats} beats`;
}
function envelopeLabel(e: unknown): string {
  const x = obj(e);
  return typeof x.kind === "string" ? x.kind : "effect parameter";
}
function editNotesLabel(a: Record<string, unknown>): string {
  const ops: string[] = [];
  const sc = obj(a.toScale);
  if (sc.tonic) ops.push(`fit to ${sc.tonic} ${sc.mode}`);
  if (typeof a.transpose === "number") ops.push(`transpose ${signed(a.transpose)}`);
  const q = obj(a.quantize);
  if (typeof q.gridBeats === "number") {
    const extra = [typeof q.strength === "number" && q.strength < 1 ? `${Math.round(q.strength * 100)}%` : "", typeof q.swing === "number" && q.swing !== 50 ? `swing ${q.swing}%` : ""].filter(Boolean).join(", ");
    ops.push(`quantize to ${gridLabel(q.gridBeats)}${extra ? ` (${extra})` : ""}`);
  }
  const l = obj(a.length);
  if (l.legato) ops.push("legato");
  else if (typeof l.beats === "number") ops.push(`length ${l.beats} beats`);
  else if (typeof l.scalePercent === "number") ops.push(`length ×${l.scalePercent}%`);
  const v = obj(a.velocity);
  if (typeof v.set === "number") ops.push(`velocity ${v.set}`);
  else if (typeof v.change === "number") ops.push(`velocity ${signed(v.change)}`);
  else if (typeof v.scalePercent === "number") ops.push(`velocity ×${v.scalePercent}%`);
  else if (v.compressTo) ops.push(`velocity into ${obj(v.compressTo).min}–${obj(v.compressTo).max}`);
  else if (v.ramp) ops.push(`velocity ramp ${obj(v.ramp).from}→${obj(v.ramp).to}`);
  if (a.humanize) ops.push("humanize");
  const s = ops.join(", ");
  return `${s.charAt(0).toUpperCase()}${s.slice(1)}: ${notesLabel(a.notes)}`;
}
function itemPropsLabel(a: Record<string, unknown>): string {
  const ops: string[] = [];
  if (typeof a.gainDb === "number") ops.push(`gain ${a.gainDb} dB`);
  if (typeof a.changeGainDb === "number") ops.push(`gain ${signed(a.changeGainDb)} dB`);
  if (typeof a.fadeInMs === "number") ops.push(`fade-in ${a.fadeInMs} ms`);
  if (typeof a.fadeOutMs === "number") ops.push(`fade-out ${a.fadeOutMs} ms`);
  if (typeof a.pitchSemitones === "number") ops.push(`pitch ${signed(a.pitchSemitones)} st`);
  if (typeof a.playrate === "number") ops.push(`rate ×${a.playrate}`);
  if (typeof a.reversed === "boolean") ops.push(a.reversed ? "reverse" : "un-reverse");
  if (typeof a.muted === "boolean") ops.push(a.muted ? "mute" : "unmute");
  if (typeof a.name === "string") ops.push(`rename “${a.name}”`);
  if (!ops.length) ops.push("change properties");
  return `${ops.join(", ")} on ${itemsLabel(a.items)}`;
}
function analyzeLabel(a: Record<string, unknown>): string {
  const t = obj(a.target);
  const what = t.master ? "the master" : Array.isArray(t.tracks) ? (t.tracks.length === 1 ? trackLabel(t.tracks[0]) : `${t.tracks.length} tracks`) : itemsLabel(t.items);
  return `Measure ${what}${a.range ? ` in ${rangeLabel(a.range)}` : ""}`;
}

/** One line a musician can approve or deny without reading JSON. */
export function describeCommand(name: CommandName, a: Record<string, unknown>): string {
  const t = trackLabel(a.track);
  switch (name) {
    case "getSelection": return "Read the selection";
    case "getTrackDetails": return `Read ${t} in detail`;
    case "readMidiNotes": return `Read ${notesLabel(a.notes)}`;
    case "readAutomation": return `Read ${envelopeLabel(a.envelope)} automation on ${t}`;
    case "analyzeAudio": return analyzeLabel(a);
    case "getRecordingSetup": return "Read the recording setup";
    case "checkInputLevels": return `Listen to input levels for ${a.seconds ?? 4} s`;
    case "splitItems": return `Split ${itemsLabel(a.items)} ${a.atRangeEdges ? `at the edges of ${rangeLabel(a.atRangeEdges)}` : `at ${(a.at as unknown[] | undefined)?.map(placeLabel).join(", ") ?? ""}`}`;
    case "moveItems": {
      const by = obj(a.by);
      const amount = [by.bars !== undefined && `${signed(by.bars)} bars`, by.beats !== undefined && `${signed(by.beats)} beats`, by.seconds !== undefined && `${signed(by.seconds)} s`].filter(Boolean).join(" ");
      return `Move ${itemsLabel(a.items)}${amount ? ` by ${amount}` : ""}${a.to ? ` to ${placeLabel(a.to)}` : ""}${a.toTrack ? ` onto ${trackLabel(a.toTrack)}` : ""}`;
    }
    case "copyItems": return `Copy ${itemsLabel(a.items)} to ${placeLabel(a.to)}${a.toTrack ? ` on ${trackLabel(a.toTrack)}` : ""}${typeof a.times === "number" && a.times > 1 ? ` ×${a.times}` : ""}`;
    case "trimItems": return `Trim ${itemsLabel(a.items)}${a.toRange ? ` to ${rangeLabel(a.toRange)}` : `${a.start ? ` start to ${placeLabel(a.start)}` : ""}${a.end ? ` end to ${placeLabel(a.end)}` : ""}`}`;
    case "setItemProperties": return `Set ${itemPropsLabel(a)}`;
    case "glueItems": return `Glue ${itemsLabel(a.items)} into one item`;
    case "editNotes": return editNotesLabel(a);
    case "deleteNotes": return `Delete ${notesLabel(a.notes)}`;
    case "writeAutomation": return `${a.shape === "clear" ? "Clear" : `Write ${a.shape}`} ${envelopeLabel(a.envelope)} automation on ${t} in ${rangeLabel(a.range)}`;
    case "setRecordMode": return `Record mode: ${String(a.mode).replace(/-/g, " ")}${a.range ? ` (${rangeLabel(a.range)})` : ""}`;
    case "setPreroll": return `Pre-roll${a.record !== undefined ? ` ${a.record ? "on" : "off"} for recording` : ""}${a.play !== undefined ? ` ${a.play ? "on" : "off"} for playback` : ""}${a.bars !== undefined ? `, ${a.bars} bars` : ""}`;
    case "chooseTake": return a.track ? `Play lane ${Number(a.lane) + 1} on ${t}` : `Play take ${Number(a.takeIndex) + 1} of an item`;
    case "findActions": return a.shortcut ? `Find what ${a.shortcut} does` : `Search REAPER actions for “${a.query}”`;
    case "runAction": return `Run “${a.name}”${a.section && a.section !== "main" ? ` (${a.section} section)` : ""}`;
    case "assignShortcut": return `Add a shortcut${a.key ? ` (${a.key})` : ""} to “${a.name}”`;
    case "removeShortcut": return `Remove ${a.key} from “${a.name}”`;
    case "freezeTrack": return `${a.frozen ? "Freeze" : "Unfreeze"} ${t}`;
    case "getProjectState": return "Read the project";
    case "listInstalledFx": return a.filter ? `Search installed plug-ins for “${a.filter}”` : "List installed plug-ins";
    case "listFxParameters": return `Read effect parameters on ${t}`;
    case "listTrackItems": return `List items on ${t}`;
    case "getMeters": return "Read track meters";
    case "setTempo": return `Set tempo to ${a.bpm} BPM`;
    case "setTimeSignature": return `Set time signature to ${a.numerator}/${a.denominator}`;
    case "saveProject": return "Save the project";
    case "setCursor": return `Move cursor to ${pos(a.position)}`;
    case "addMarker": return `Add marker${a.name ? ` “${a.name}”` : ""}${a.position ? ` at ${pos(a.position)}` : ""}`;
    case "addRegion": return `Add region${a.name ? ` “${a.name}”` : ""} ${pos(a.start)} → ${pos(a.end)}`;
    case "setLoopRegion": return `Loop ${pos(a.start)} → ${pos(a.end)}`;
    case "clearLoopRegion": return "Turn loop off";
    case "setCountIn": return a.enabled ? `Count-in on${a.bars ? ` (${a.bars} bars)` : ""}` : "Count-in off";
    case "setMetronome": return a.enabled ? "Metronome on" : "Metronome off";
    case "startPlayback": return `Play${a.from ? ` from ${pos(a.from)}` : ""}`;
    case "pausePlayback": return "Pause";
    case "stopPlayback": return "Stop";
    case "startRecording": return `Start recording${a.from ? ` from ${pos(a.from)}` : ""}`;
    case "stopRecording": return "Stop recording (keep takes)";
    case "markTake": return `Mark take as “${a.label}”`;
    case "createTrack": return `Create ${a.kind ?? "audio"} track “${a.name}”`;
    case "renameTrack": return `Rename ${t} to “${a.name}”`;
    case "selectTrack": return `Select ${t}`;
    case "setTrackInput": return `Set input of ${t}`;
    case "armTrack": return `${a.armed ? "Arm" : "Disarm"} ${t}`;
    case "setMonitoring": return `Monitoring ${a.mode} on ${t}`;
    case "setTrackVolume": return typeof a.db === "number" ? `Set ${t} to ${a.db} dB` : `Change ${t} by ${Number(a.changeDb) > 0 ? "+" : ""}${a.changeDb} dB`;
    case "setTrackPan": return `Pan ${t} to ${a.pan}`;
    case "setTrackMute": return `${a.muted ? "Mute" : "Unmute"} ${t}`;
    case "setTrackSolo": return `${a.soloed ? "Solo" : "Unsolo"} ${t}`;
    case "createMidiClip": return `Create a ${a.lengthBars}-bar MIDI clip on ${t} at ${pos(a.start)}`;
    case "insertMidiNotes": return `Insert ${Array.isArray(a.notes) ? a.notes.length : "some"} MIDI notes`;
    case "quantizeMidiClip": return `Quantize a MIDI clip to ${a.gridBeats} beats`;
    case "addFx": return `Add “${a.fx}” to ${t}`;
    case "setFxParameter": return `Change an effect parameter on ${t}`;
    case "setFxEnabled": return `${a.enabled ? "Enable" : "Bypass"} an effect on ${t}`;
    case "createSend": return `Send ${trackLabel(a.from)} → ${trackLabel(a.to)}`;
    case "configureSidechain": return `Sidechain ${trackLabel(a.target)} from ${trackLabel(a.source)}`;
    case "undo": return `Undo “${a.expectLabel}”`;
    case "loadGenreTemplate": return `Build a ${GENRES.find((g) => g.id === a.genre)?.name ?? a.genre} beat template${a.bpm ? ` at ${a.bpm} BPM` : ""}`;
  }
}
