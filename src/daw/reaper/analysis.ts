/**
 * Pure helpers that turn raw bridge readings (MIDI notes, loudness statistics,
 * recording setup) into the numbers and short verdicts an engineer would quote.
 * No I/O here, so every rule is unit-tested.
 */

export const PITCH_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"] as const;

/** 60 → "C4" (middle C), 36 → "C2". */
export function pitchName(p: number): string {
  return `${PITCH_NAMES[((p % 12) + 12) % 12]}${Math.floor(p / 12) - 1}`;
}

const round = (x: number, d = 1) => Math.round(x * 10 ** d) / 10 ** d;

/* ------------------------------------------------------------------ keys */

// Krumhansl–Kessler probe-tone profiles (major, minor), index 0 = tonic.
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
// Key names as producers spell them (and as editNotes' toScale accepts them).
const MAJOR_TONIC = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const MINOR_TONIC = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];
const SCALE_STEPS: Record<"major" | "minor", number[]> = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };

export interface KeyGuess {
  tonic: string;
  mode: "major" | "minor";
  /** Correlation with the key profile, -1..1. Above ~0.75 is a clear fit. */
  score: number;
  /** Share of the note weight that falls inside the key's scale, 0..1. */
  inScale: number;
}

function pearson(a: number[], b: number[]): number {
  const n = a.length;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i]! - ma) * (b[i]! - mb);
    da += (a[i]! - ma) ** 2;
    db += (b[i]! - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

/**
 * Likely keys from 12 pitch-class weights (e.g. note durations), best first.
 * Null when there is too little to go on (fewer than 3 pitch classes).
 */
export function estimateKey(weights: number[]): KeyGuess[] | null {
  const total = weights.reduce((s, x) => s + x, 0);
  if (weights.length !== 12 || total <= 0 || weights.filter((w) => w > 0).length < 3) return null;
  const out: KeyGuess[] = [];
  for (let t = 0; t < 12; t++) {
    for (const mode of ["major", "minor"] as const) {
      const prof = mode === "major" ? MAJOR : MINOR;
      const rotated = weights.map((_, i) => prof[(i - t + 12) % 12]!);
      const inScale = SCALE_STEPS[mode].reduce((s, st) => s + weights[(t + st) % 12]!, 0) / total;
      out.push({ tonic: (mode === "major" ? MAJOR_TONIC : MINOR_TONIC)[t]!, mode, score: pearson(weights, rotated), inScale });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

/* ------------------------------------------------------------------ notes */

/** One note as the bridge sends it: position label, project QN, length (beats), pitch, velocity, channel (0-based), selected, muted, clip index. */
export type NoteRow = [string, number, number, number, number, number, number, number, number];

// General MIDI drum names for the notes drum programmers use most.
const GM_DRUMS: Record<number, string> = {
  35: "kick 2", 36: "kick", 37: "side stick", 38: "snare", 39: "clap", 40: "snare 2", 41: "low floor tom", 42: "closed hat",
  43: "floor tom", 44: "pedal hat", 45: "low tom", 46: "open hat", 47: "low-mid tom", 48: "hi-mid tom", 49: "crash",
  50: "high tom", 51: "ride", 52: "china", 53: "ride bell", 54: "tambourine", 55: "splash", 56: "cowbell", 57: "crash 2",
  59: "ride 2", 69: "cabasa", 70: "maracas", 75: "claves", 76: "hi wood block", 77: "low wood block",
};

export interface NoteSummaryOptions {
  bpm: number;
  /** The rows are drums (GM channel 10 or a drum track): no key, hits per drum instead. */
  drums?: boolean;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** Bar number from a ruler label like "9.2.50". */
const barOf = (label: string) => Number.parseInt(label, 10);

/**
 * What a producer wants to know about a part before touching it:
 * range, key, velocity spread, timing feel, density and how chordal it is.
 */
export function summarizeNotes(rows: NoteRow[], o: NoteSummaryOptions): Record<string, unknown> {
  if (!rows.length) return { notes: 0 };
  const pitches = rows.map((r) => r[3]);
  const lo = Math.min(...pitches), hi = Math.max(...pitches);
  const out: Record<string, unknown> = { notes: rows.length, range: lo === hi ? pitchName(lo) : `${pitchName(lo)}–${pitchName(hi)} (${lo}–${hi})` };
  const drums = o.drums ?? rows.every((r) => r[5] === 9);

  if (drums) {
    const hits = new Map<number, number>();
    for (const p of pitches) hits.set(p, (hits.get(p) ?? 0) + 1);
    out.drumHits = [...hits.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
      .map(([p, n]) => `${pitchName(p)} (${p}${GM_DRUMS[p] ? ` ${GM_DRUMS[p]}` : ""}) ×${n}`).join(", ");
  } else {
    const w = new Array<number>(12).fill(0);
    for (const r of rows) w[r[3] % 12]! += Math.max(r[2], 0.05);
    const keys = estimateKey(w);
    if (keys) {
      const [best, ...rest] = keys;
      const clear = best!.score >= 0.75 && best!.score - rest[0]!.score >= 0.05;
      out.key = {
        likely: `${best!.tonic} ${best!.mode}`,
        confidence: best!.score >= 0.75 ? (clear ? "clear" : "close call") : best!.score >= 0.6 ? "weak" : "unclear",
        score: round(best!.score, 2),
        inScalePercent: Math.round(best!.inScale * 100),
        alternatives: rest.slice(0, 2).map((k) => `${k.tonic} ${k.mode} (${round(k.score, 2)})`),
      };
    } else out.key = "not enough different notes to tell";
    const total = w.reduce((s, x) => s + x, 0);
    out.pitchClasses = w.map((x, i) => [PITCH_NAMES[i]!, x] as const).filter(([, x]) => x > 0).sort((a, b) => b[1] - a[1])
      .map(([n, x]) => `${n} ${Math.round((x / total) * 100)}%`).join(", ");
  }

  const vels = rows.map((r) => r[4]);
  const mean = vels.reduce((s, x) => s + x, 0) / vels.length;
  const sd = Math.sqrt(vels.reduce((s, x) => s + (x - mean) ** 2, 0) / vels.length);
  out.velocity = {
    min: Math.min(...vels), max: Math.max(...vels), average: Math.round(mean), spread: round(sd, 1),
    ...(rows.length >= 8 && sd < 3 ? { note: "almost no variation: sounds programmed" } : {}),
  };
  const lens = rows.map((r) => r[2]);
  out.lengthBeats = { shortest: round(Math.min(...lens), 3), typical: round(median(lens), 3), longest: round(Math.max(...lens), 3) };

  // Timing against the 1/16 grid, in milliseconds at the current tempo.
  const msPerBeat = 60000 / (o.bpm > 0 ? o.bpm : 120);
  const offs = rows.map((r) => (r[1] - Math.round(r[1] / 0.25) * 0.25) * msPerBeat);
  const tight = offs.filter((x) => Math.abs(x) <= 5).length / offs.length;
  const meanOff = offs.reduce((s, x) => s + x, 0) / offs.length;
  out.timing = {
    onGrid16Percent: Math.round(tight * 100),
    averageOffsetMs: round(offs.reduce((s, x) => s + Math.abs(x), 0) / offs.length, 1),
    ...(Math.abs(meanOff) >= 3 ? { tendency: meanOff > 0 ? `late (+${round(meanOff, 1)} ms)` : `early (${round(meanOff, 1)} ms)` } : {}),
  };
  const qns = rows.map((r) => r[1]);
  const near = (q: number, t: number) => Math.abs((((q % 1) + 1) % 1) - t) < 0.06;
  const sixteenths = qns.filter((q) => near(q, 0.25) || near(q, 0.75)).length / qns.length;
  const swing16 = swingEstimate(qns, 0.5);
  // A straight 16th at x.75 would look like a heavily swung 8th, so 8th swing is only judged on 8th-based parts.
  const swing8 = sixteenths < 0.1 ? swingEstimate(qns, 1) : null;
  if (swing16) (out.timing as Record<string, unknown>).swing16 = `${swing16}%`;
  if (swing8) (out.timing as Record<string, unknown>).swing8 = `${swing8}%`;

  // Density per bar and the most notes sounding at once.
  const perBar = new Map<number, number>();
  for (const r of rows) {
    const b = barOf(r[0]);
    if (Number.isFinite(b)) perBar.set(b, (perBar.get(b) ?? 0) + 1);
  }
  if (perBar.size) {
    const counts = [...perBar.values()];
    out.perBar = { bars: perBar.size, average: round(rows.length / perBar.size, 1), busiest: Math.max(...counts), quietest: Math.min(...counts) };
  }
  const edges = rows.flatMap((r) => [[r[1], 1], [r[1] + r[2] - 1e-6, -1]] as const).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let now = 0, most = 0;
  for (const [, d] of edges) most = Math.max(most, (now += d));
  out.maxSimultaneous = most;
  if (!drums) out.texture = most >= 3 ? "chords" : most === 2 ? "two-voice / intervals" : "single line";
  return out;
}

/**
 * Swing of the off-beat in pairs of `pair` quarter notes (0.5 = 16ths, 1 = 8ths), as REAPER's
 * swing percent (50 straight, 66 triplet feel). Null when there are too few off-beats or it's straight.
 */
export function swingEstimate(qns: number[], pair: number): number | null {
  const half = pair / 2;
  const offs: number[] = [];
  for (const q of qns) {
    const f = ((q % pair) + pair) % pair;
    // Off-beats sit between 40% and 80% of the pair; a straight one is at 50%.
    if (f >= pair * 0.4 && f <= pair * 0.8) offs.push(f / pair);
  }
  if (offs.length < 4) return null;
  const s = Math.round(median(offs) * 100);
  return s >= 53 && s <= 75 && Math.abs(median(offs) * pair - half) > 0.01 ? s : null;
}

/** Compact note list: "9.1 C3 0.5 v100" (+ "ch10", "sel", "muted"). */
export function noteLines(rows: NoteRow[], limit: number): string[] {
  return rows.slice(0, limit).map((r) => {
    const extra = [r[5] ? `ch${r[5] + 1}` : "", r[6] ? "sel" : "", r[7] ? "muted" : ""].filter(Boolean).join(" ");
    return `${r[0]} ${pitchName(r[3])} ${round(r[2], 3)} v${r[4]}${extra ? ` ${extra}` : ""}`;
  });
}

/* --------------------------------------------------------------- loudness */

/** Streaming and broadcast references (integrated LUFS, true-peak ceiling). Players turn louder masters down. */
export const LOUDNESS_TARGETS = [
  { name: "Spotify, YouTube, TIDAL, Amazon", lufs: -14, truePeak: -1 },
  { name: "Apple Music", lufs: -16, truePeak: -1 },
  { name: "Broadcast (EBU R128)", lufs: -23, truePeak: -1 },
] as const;

type Num = number | null | undefined;
const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);

export interface LevelReading {
  name?: string;
  kind?: "master" | "track" | "item" | string;
  lufsI?: Num; lufsSMax?: Num; lufsMMax?: Num; peakDb?: Num; truePeakDb?: Num; rmsDb?: Num; lra?: Num; clips?: Num;
  source?: { lufsI?: Num; peakDb?: Num; truePeakDb?: Num; rmsDb?: Num; channels?: number } | null;
  sourceScan?: { clipRuns?: number; centroidHz?: number; bands?: { band: string; fromHz: number; toHz: number; share: number }[] } | null;
  itemGainDb?: Num;
}

const BAND_NAMES: Record<string, string> = { sub: "sub", low: "low", lowMid: "low-mid", mid: "mid", highMid: "high-mid", high: "air" };

/** One-line tonal description from band shares (before FX). */
export function describeBands(scan: LevelReading["sourceScan"]): string | null {
  if (!scan?.bands?.length) return null;
  const parts = scan.bands.map((b) => `${BAND_NAMES[b.band] ?? b.band} ${Math.round(b.share)}%`).join(", ");
  const c = scan.centroidHz ?? 0;
  const feel = c <= 0 ? "" : c < 500 ? "dark, low-heavy" : c < 1500 ? "warm" : c < 3500 ? "present" : "bright";
  return `${parts}${c > 0 ? `; centre of energy ${Math.round(c)} Hz (${feel})` : ""}`;
}

/**
 * Derived numbers (headroom, peak-to-loudness ratio, crest) and plain verdicts for one measurement.
 * Thresholds are working rules of thumb, not standards; the wording says so where it matters.
 */
export function interpretLevels(r: LevelReading): { derived: Record<string, number>; verdicts: string[] } {
  const derived: Record<string, number> = {};
  const verdicts: string[] = [];
  const lufs = num(r.lufsI), peak = num(r.peakDb), tp = num(r.truePeakDb), lra = num(r.lra);
  const top = tp ?? peak;
  if (top !== null) derived.headroomDb = round(-top, 1);
  if (top !== null && lufs !== null) derived.peakToLoudness = round(top - lufs, 1);
  const master = r.kind === "master";

  if (top !== null) {
    if (top >= -0.1) verdicts.push(`${tp !== null ? "True peak" : "Peak"} ${round(top, 1)} dBFS after FX: it is clipping, or a limiter sits right at the ceiling.`);
    else if (master && top > -1) verdicts.push(`Peak ${round(top, 1)} dBFS: under 0 but above the -1 dBTP streaming ceiling, so lossy encodes may clip.`);
    else if (!master && r.kind === "track" && top > -3) verdicts.push(`Hot track (peak ${round(top, 1)} dBFS): little headroom into the mix bus.`);
  }
  if (master && lufs !== null && lufs > -70) {
    const turns = LOUDNESS_TARGETS.slice(0, 2).map((t) => {
      const d = round(lufs - t.lufs, 1);
      return d > 0 ? `${t.name} turn it down ~${d} dB (${t.lufs})` : `${t.name} leave it at ${round(lufs, 1)} (${t.lufs} reference${d < -1 ? "; quiet songs are only turned up a little, if at all" : ""})`;
    });
    verdicts.push(`Integrated ${round(lufs, 1)} LUFS: ${turns.join("; ")}.`);
  }
  if (derived.peakToLoudness !== undefined && lufs !== null && lufs > -70) {
    const plr = derived.peakToLoudness;
    if (plr < 7) verdicts.push(`Peak-to-loudness ratio ${plr} dB: heavily limited or compressed; transients may be flattened.`);
    else if (plr > 14 && master) verdicts.push(`Peak-to-loudness ratio ${plr} dB: very dynamic; it will sound quieter next to commercial references.`);
  }
  if (lra !== null && master) {
    if (lra > 12) verdicts.push(`Loudness range ${lra} LU: big contrast between quiet and loud parts.`);
    else if (lra < 3) verdicts.push(`Loudness range ${lra} LU: very even level throughout.`);
  }
  if (lufs !== null && lufs <= -70) verdicts.push("Silent (or nearly) in this range.");

  const s = r.source;
  if (s) {
    const sp = num(s.truePeakDb) ?? num(s.peakDb), rms = num(s.rmsDb);
    if (sp !== null && rms !== null) derived.sourceCrestDb = round(sp - rms, 1);
    if (sp !== null) {
      if (sp >= -0.5) verdicts.push(`Recorded peak ${round(sp, 1)} dBFS: recorded very hot; any clipping there is baked in.`);
      else if (sp < -30) verdicts.push(`Recorded peak ${round(sp, 1)} dBFS: recorded very low. Fine at 24-bit if the noise floor is quiet, but it needs a lot of gain.`);
      else if (sp <= -6 && sp >= -24) verdicts.push(`Recorded peak ${round(sp, 1)} dBFS: healthy recording level for 24-bit.`);
    }
    if (derived.sourceCrestDb !== undefined) {
      const c = derived.sourceCrestDb;
      if (c < 8) verdicts.push(`Crest ${c} dB: dense, already compressed or distorted source.`);
      else if (c > 20) verdicts.push(`Crest ${c} dB: very peaky (percussive); a fast compressor or clipper would tame it.`);
    }
  }
  const runs = r.sourceScan?.clipRuns ?? 0;
  if (runs > 0) verdicts.push(`${runs} clipped stretch${runs === 1 ? "" : "es"} (3+ samples pinned at full scale) in the recording: the clipping happened on the way in, so turning it down won't remove it.`);
  return { derived, verdicts };
}

/* --------------------------------------------------------------- recording */

/** Minutes of recording that fit in `freeBytes` at this rate, depth and channel count. */
export function recordingMinutes(freeBytes: number, sampleRate: number, bitDepth: number, channels: number): number | null {
  if (!(freeBytes > 0 && sampleRate > 0 && bitDepth > 0 && channels > 0)) return null;
  return Math.floor(freeBytes / (sampleRate * (bitDepth / 8) * channels) / 60);
}

/** Verdicts on device settings for tracking (not mixing). */
export function recordingVerdicts(s: { roundTripMs?: Num; bufferSize?: Num; sampleRate?: Num; armed?: number; freeGb?: Num }): string[] {
  const out: string[] = [];
  const rt = num(s.roundTripMs), buf = num(s.bufferSize), free = num(s.freeGb);
  if (rt !== null) {
    if (rt > 12) out.push(`Round-trip latency ${round(rt, 1)} ms: performers hear the delay when monitoring through REAPER. Lower the buffer (64-128) or use the interface's direct monitoring.`);
    else if (rt <= 6) out.push(`Round-trip latency ${round(rt, 1)} ms: fine for monitoring through FX.`);
  }
  if (buf !== null && buf >= 1024) out.push(`Buffer ${buf} samples: good for mixing, too high for tracking.`);
  if (free !== null && free < 5) out.push(`Only ${round(free, 1)} GB free where recordings go.`);
  if (s.armed === 0) out.push("No track is armed yet.");
  return out;
}
