import type { GenreTemplate } from "../genres";

/** A MIDI note, in quarter notes from the clip start. */
export interface Note {
  start: number;
  length: number;
  pitch: number;
  velocity: number;
  channel: number;
}

/* ---------------------------------------------------------------- notes */

const SCALES = { minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11] };

/** Diatonic chord on a scale degree (1-7), as MIDI pitches around the given root octave. */
export function chord(g: GenreTemplate, degree: number, baseOctaveMidi: number): number[] {
  const scale = SCALES[g.key.mode];
  const tonicPc = g.key.midi % 12;
  const tones = g.sevenths ? [0, 2, 4, 6] : [0, 2, 4];
  return tones.map((t) => {
    const idx = degree - 1 + t;
    return baseOctaveMidi + tonicPc + scale[idx % 7]! + 12 * Math.floor(idx / 7);
  });
}

function rootPc(g: GenreTemplate, degree: number): number {
  return (g.key.midi % 12) + SCALES[g.key.mode][degree - 1]!;
}

function swingPos(step: number, swing: number): number {
  const pair = Math.floor(step / 2) * 0.5;
  return step % 2 === 0 ? pair : pair + 0.5 * (swing / 100);
}

export function stepNotes(g: GenreTemplate, bars: number): Note[] {
  const out: Note[] = [];
  for (const lane of g.drums) {
    const pattern = lane.steps.length >= 64 ? lane.steps : lane.steps.repeat(4);
    for (let bar = 0; bar < bars; bar++) {
      for (let s = 0; s < 16; s++) {
        const c = pattern[(bar % 4) * 16 + s];
        if (c !== "x" && c !== "o") continue;
        const vel = c === "x" ? 108 + ((s * 7 + bar * 3) % 12) : 58 + ((s * 5) % 14);
        out.push({ start: bar * 4 + swingPos(s, g.swing), length: 0.2, pitch: lane.note, velocity: vel, channel: 9 });
      }
    }
  }
  return out;
}

export function chordNotes(g: GenreTemplate, bars: number): Note[] {
  const out: Note[] = [];
  for (let bar = 0; bar < bars; bar++) {
    const deg = g.progression[bar % g.progression.length]!;
    const pitches = chord(g, deg, 48); // around C3–C5
    if (g.keys === "pluck") {
      // Off-beat stabs give plucks their bounce.
      for (const beat of [0, 0.75, 1.5, 2.5, 3.25]) for (const p of pitches) out.push({ start: bar * 4 + beat, length: 0.4, pitch: p + 12, velocity: 92, channel: 0 });
    } else {
      for (const p of pitches) out.push({ start: bar * 4, length: g.keys === "pad" ? 4 : 3.75, pitch: p, velocity: g.keys === "pad" ? 80 : 88, channel: 0 });
    }
  }
  return out;
}

/**
 * The 808 or bass line: every hit of the rhythm plays the bar's chord root.
 */
export function lowNotes(g: GenreTemplate, bars: number): Note[] {
  const out: Note[] = [];
  const steps = g.lowRhythm;
  for (let bar = 0; bar < bars; bar++) {
    const pc = rootPc(g, g.progression[bar % g.progression.length]!);
    let pitch = g.low === "808" ? 24 + (pc % 12) : 36 + (pc % 12); // 808 in octave 1, bass in octave 2
    if (g.low === "808" && pitch < 28) pitch += 12;
    if (g.low === "808") pitch += 12; // an octave up on a synth so small speakers hear it
    const hits = [...steps].map((c, i) => (c === "x" ? i : -1)).filter((i) => i >= 0);
    hits.forEach((s, i) => {
      const next = hits[i + 1] ?? 16;
      const start = bar * 4 + s / 4;
      let length = Math.max(0.25, (next - s) / 4 - 0.05);
      // Drill slide: the last hit of each bar jumps a fifth and overlaps the previous note.
      if (g.slides && i === hits.length - 1 && i > 0) {
        out[out.length - 1]!.length += 0.25;
        out.push({ start, length, pitch: pitch + 7, velocity: 112, channel: 0 });
        return;
      }
      if (g.low === "bass") length = Math.min(length, 0.45);
      out.push({ start, length, pitch, velocity: 112, channel: 0 });
    });
  }
  return out;
}

/* ----------------------------------------------------------------- plan */

export interface Instruments {
  drums: string | null; // e.g. "VST3i: My Drums (Maker)"
  bass: string | null;
  keys: string | null;
  synth: string | null; // REAPER's ReaSynth as the fallback
}

export interface PlannedCommand {
  command: string;
  args: Record<string, unknown>;
}

export interface Plan {
  commands: PlannedCommand[];
  bars: number;
  tracks: string[];
  notes: string[];
}

const ref = (step: number) => ({ by: "batch", step });

export function planTemplate(g: GenreTemplate, inst: Instruments, bpm = g.bpm): Plan {
  const cmds: PlannedCommand[] = [];
  const push = (command: string, args: Record<string, unknown>) => cmds.push({ command, args }) && cmds.length;
  const notes: string[] = [];
  const tracks: string[] = [];
  const bars = 4;

  push("setTempo", { bpm });
  push("setTimeSignature", { numerator: 4, denominator: 4 });
  for (const [name, bar] of g.sections) push("addMarker", { position: { bar }, name });

  const track = (name: string, kind: "audio" | "midi" | "bus", instrument: string | null, fx: string[], volumeDb: number) => {
    const step = push("createTrack", { name, kind });
    tracks.push(name);
    if (instrument) push("addFx", { track: ref(step), fx: instrument });
    for (const f of fx) push("addFx", { track: ref(step), fx: f });
    if (volumeDb !== 0) push("setTrackVolume", { track: ref(step), db: volumeDb });
    return step;
  };
  const clip = (trackStep: number, name: string, n: Note[]) => {
    if (!n.length) return;
    const c = push("createMidiClip", { track: ref(trackStep), start: { bar: 1 }, lengthBars: bars, name });
    push("insertMidiNotes", { clip: ref(c), notes: n.map((x) => ({ ...x, start: round(x.start), length: round(x.length) })) });
  };

  const reverb = track("Reverb", "bus", null, ["ReaVerbate"], -6);
  const delay = track("Delay", "bus", null, ["ReaDelay"], -10);

  const drums = track("Drums", "midi", inst.drums, ["ReaEQ"], -4);
  clip(drums, `${g.name} drums`, stepNotes(g, bars));
  if (!inst.drums) notes.push("No drum instrument found: load a drum sampler on “Drums” (General MIDI notes 36–51).");

  const lowName = g.low === "808" ? "808" : "Bass";
  const lowInst = inst.bass ?? inst.synth;
  const low = track(lowName, "midi", lowInst, ["ReaEQ"], -6);
  clip(low, `${g.name} ${lowName.toLowerCase()}`, lowNotes(g, bars));

  const keysName = g.keys === "pad" ? "Pad" : g.keys === "pluck" ? "Pluck" : "Keys";
  const keys = track(keysName, "midi", inst.keys ?? inst.synth, ["ReaEQ"], -10);
  clip(keys, `${g.name} chords`, chordNotes(g, bars));
  push("createSend", { from: ref(keys), to: ref(reverb), volumeDb: -12 });

  const melody = track("Melody", "midi", inst.synth, ["ReaEQ"], -12);
  push("createSend", { from: ref(melody), to: ref(reverb), volumeDb: -14 });
  push("createSend", { from: ref(melody), to: ref(delay), volumeDb: -16 });

  const vox = track("Vocal", "audio", null, ["ReaEQ", "ReaComp"], 0);
  push("createSend", { from: ref(vox), to: ref(reverb), volumeDb: -14 });
  push("createSend", { from: ref(vox), to: ref(delay), volumeDb: -18 });

  return { commands: cmds, bars, tracks, notes };
}

function round(v: number): number {
  return Math.round(v * 10000) / 10000;
}

/** Prefer VST3, then CLAP, AU and VST, among installed plug-ins whose name contains the query. */
export function pickInstrument(installed: { name: string; instrument?: boolean }[], query: string): string | null {
  const q = query.toLowerCase();
  const hits = installed.filter((f) => f.instrument && f.name.toLowerCase().includes(q));
  const order = ["VST3i:", "CLAPi:", "AUi:", "VSTi:"];
  hits.sort((a, b) => rank(a.name) - rank(b.name));
  function rank(n: string) {
    const i = order.findIndex((o) => n.startsWith(o));
    return i < 0 ? 9 : i;
  }
  return hits[0]?.name ?? null;
}
