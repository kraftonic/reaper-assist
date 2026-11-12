import { describe, expect, it } from "vitest";
import {
  describeBands, estimateKey, interpretLevels, noteLines, pitchName, recordingMinutes, recordingVerdicts, summarizeNotes, swingEstimate,
  type NoteRow,
} from "@daw/reaper/analysis";

/** Note rows as the bridge sends them; position labels derived from QN in 4/4. */
function row(qn: number, len: number, pitch: number, vel = 100, chan = 0): NoteRow {
  const bar = Math.floor(qn / 4) + 1;
  const beat = (qn % 4) + 1;
  const label = Number.isInteger(beat) ? `${bar}.${beat}` : `${bar}.${Math.floor(beat)}.${String(Math.round((beat % 1) * 100)).padStart(2, "0")}`;
  return [label, qn, len, pitch, vel, chan, 0, 0, 0];
}

describe("key estimate", () => {
  it("finds C major from a C major scale and A minor from an A minor melody", () => {
    const w = (pcs: number[], weights: number[]) => {
      const a = new Array(12).fill(0);
      pcs.forEach((p, i) => (a[p] += weights[i] ?? 1));
      return a;
    };
    const c = estimateKey(w([0, 2, 4, 5, 7, 9, 11, 0, 4, 7], [4, 1, 2, 1, 3, 1, 1, 4, 2, 3]))!;
    expect(`${c[0]!.tonic} ${c[0]!.mode}`).toBe("C major");
    expect(c[0]!.inScale).toBeCloseTo(1, 5);
    const am = estimateKey(w([9, 0, 4, 9, 7, 5, 4, 2, 9, 0], [4, 2, 3, 3, 1, 1, 2, 1, 4, 2]))!;
    expect(`${am[0]!.tonic} ${am[0]!.mode}`).toBe("A minor");
    expect(estimateKey([1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0])).toBeNull();
  });
  it("names pitches with middle C = C4", () => {
    expect(pitchName(60)).toBe("C4");
    expect(pitchName(36)).toBe("C2");
    expect(pitchName(70)).toBe("Bb4");
  });
});

describe("note summary", () => {
  it("summarizes a melodic part: range, key, velocity, timing, texture", () => {
    // A minor arpeggio in 8ths over 2 bars (8 notes a bar), slightly late, flat velocity.
    const pitches = [57, 60, 64, 69, 57, 60, 64, 69, 53, 57, 60, 65, 55, 59, 62, 67];
    const rows = pitches.map((p, i) => row(i * 0.5 + 0.01, 0.5, p, 90));
    const s = summarizeNotes(rows, { bpm: 120 });
    expect(s.notes).toBe(16);
    expect(s.range).toBe("F3–A4 (53–69)");
    expect((s.key as { likely: string }).likely).toMatch(/^(A minor|C major)$/);
    expect(s.velocity).toMatchObject({ min: 90, max: 90, note: expect.stringContaining("programmed") });
    // 0.01 QN at 120 BPM = 5 ms late.
    expect((s.timing as { averageOffsetMs: number }).averageOffsetMs).toBe(5);
    expect((s.timing as { tendency?: string }).tendency).toMatch(/^late/);
    expect(s.perBar).toMatchObject({ bars: 2, average: 8, busiest: 8 });
    expect(s.texture).toBe("single line");
  });
  it("counts drum hits by GM name instead of guessing a key", () => {
    const rows: NoteRow[] = [];
    for (let b = 0; b < 4; b++) {
      rows.push(row(b, 0.25, 36, 110, 9));
      if (b % 2 === 1) rows.push(row(b, 0.25, 38, 100, 9));
      rows.push(row(b, 0.25, 42, 80, 9), row(b + 0.5, 0.25, 42, 60, 9));
    }
    const s = summarizeNotes(rows, { bpm: 90 });
    expect(s.key).toBeUndefined();
    expect(String(s.drumHits)).toMatch(/^F#2 \(42 closed hat\) ×8, C2 \(36 kick\) ×4, D2 \(38 snare\) ×2$/);
    expect(s.maxSimultaneous).toBe(3);
    expect(s.texture).toBeUndefined();
  });
  it("estimates swing on 16ths and 8ths, but not on straight parts", () => {
    const swung16 = Array.from({ length: 16 }, (_, i) => Math.floor(i / 2) * 0.5 + (i % 2 ? 0.29 : 0));
    expect(swingEstimate(swung16, 0.5)).toBe(58);
    const straight16 = Array.from({ length: 16 }, (_, i) => i * 0.25);
    expect(swingEstimate(straight16, 0.5)).toBeNull();
    const swung8 = Array.from({ length: 8 }, (_, i) => Math.floor(i / 2) + (i % 2 ? 0.66 : 0));
    expect(swingEstimate(swung8, 1)).toBe(66);
    const s = summarizeNotes(swung8.map((q) => row(q, 0.25, 42, 90, 9)), { bpm: 90, drums: true });
    expect((s.timing as { swing8?: string }).swing8).toBe("66%");
  });
  it("lists notes compactly", () => {
    expect(noteLines([row(0, 0.5, 60, 100), row(4.5, 1, 38, 40, 9)], 10)).toEqual(["1.1 C4 0.5 v100", "2.1.50 D2 1 v40 ch10"]);
    expect(noteLines([row(0, 1, 60)], 0)).toEqual([]);
  });
});

describe("level verdicts", () => {
  it("flags a loud, clipping master and says what streaming does to it", () => {
    const { derived, verdicts } = interpretLevels({ kind: "master", lufsI: -8.2, peakDb: 0, lra: 2.1 });
    expect(derived).toEqual({ headroomDb: -0, peakToLoudness: 8.2 });
    expect(verdicts.join(" ")).toMatch(/clipping/);
    expect(verdicts.join(" ")).toMatch(/turn it down ~5\.8 dB \(-14\)/);
    expect(verdicts.join(" ")).toMatch(/Apple Music turn it down ~7\.8 dB/);
    expect(verdicts.join(" ")).toMatch(/very even/);
  });
  it("calls out heavy limiting and quiet masters", () => {
    expect(interpretLevels({ kind: "master", lufsI: -6, truePeakDb: -1.2 }).verdicts.join(" ")).toMatch(/heavily limited/);
    expect(interpretLevels({ kind: "master", lufsI: -20, peakDb: -3 }).verdicts.join(" ")).toMatch(/leave it at -20/);
    expect(interpretLevels({ kind: "track", lufsI: -90, peakDb: -150 }).verdicts).toContain("Silent (or nearly) in this range.");
  });
  it("judges recorded level and baked-in clipping on items", () => {
    const hot = interpretLevels({ kind: "item", lufsI: -9, peakDb: -0.3, source: { peakDb: -0.1, rmsDb: -12 }, sourceScan: { clipRuns: 3 } });
    expect(hot.derived.sourceCrestDb).toBe(11.9);
    expect(hot.verdicts.join(" ")).toMatch(/recorded very hot/);
    expect(hot.verdicts.join(" ")).toMatch(/3 clipped stretches/);
    const fine = interpretLevels({ kind: "item", source: { peakDb: -10, rmsDb: -24 } });
    expect(fine.verdicts.join(" ")).toMatch(/healthy recording level/);
    const low = interpretLevels({ kind: "item", source: { peakDb: -36, rmsDb: -50 } });
    expect(low.verdicts.join(" ")).toMatch(/recorded very low/);
  });
  it("describes tonal balance", () => {
    const t = describeBands({ centroidHz: 420, bands: [{ band: "sub", fromHz: 20, toHz: 60, share: 30 }, { band: "low", fromHz: 60, toHz: 250, share: 50 }, { band: "high", fromHz: 6000, toHz: 20000, share: 2 }] });
    expect(t).toBe("sub 30%, low 50%, air 2%; centre of energy 420 Hz (dark, low-heavy)");
    expect(describeBands(null)).toBeNull();
  });
});

describe("recording helpers", () => {
  it("estimates recording time from free space", () => {
    // 1 GB at 48 kHz, 24-bit, mono = 144000 bytes/s → 115 minutes.
    expect(recordingMinutes(1e9, 48000, 24, 1)).toBe(115);
    expect(recordingMinutes(0, 48000, 24, 1)).toBeNull();
  });
  it("judges latency, buffer and disk", () => {
    const v = recordingVerdicts({ roundTripMs: 23.4, bufferSize: 1024, freeGb: 2, armed: 0 }).join(" ");
    expect(v).toMatch(/23\.4 ms/);
    expect(v).toMatch(/too high for tracking/);
    expect(v).toMatch(/Only 2 GB free/);
    expect(v).toMatch(/No track is armed/);
    expect(recordingVerdicts({ roundTripMs: 5 }).join(" ")).toMatch(/fine for monitoring/);
  });
});
