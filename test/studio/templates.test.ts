import { describe, expect, it } from "vitest";
import { GENRES, findGenre } from "@studio/genres";
import { chord, chordNotes, lowNotes, pickInstrument, planTemplate, stepNotes } from "@studio/templates/build";
import { validateArgs } from "@daw/reaper/commands";

const none = { drums: null, bass: null, keys: null, synth: "VSTi: ReaSynth (Cockos)" };

describe("genre templates", () => {
  it("every genre plans a valid batch under the bridge's 200-command limit", () => {
    for (const g of GENRES) {
      const p = planTemplate(g, none);
      expect(p.commands.length, g.id).toBeLessThanOrEqual(200);
      expect(p.tracks).toEqual(["Reverb", "Delay", "Drums", g.low === "808" ? "808" : "Bass", g.keys === "pad" ? "Pad" : g.keys === "pluck" ? "Pluck" : "Keys", "Melody", "Vocal"]);
      for (const c of p.commands.filter((c) => c.command === "insertMidiNotes")) {
        for (const n of c.args.notes as { pitch: number; start: number; length: number }[]) {
          expect(n.pitch).toBeGreaterThanOrEqual(0);
          expect(n.pitch).toBeLessThanOrEqual(127);
          expect(n.start).toBeGreaterThanOrEqual(0);
          expect(n.start).toBeLessThan(p.bars * 4);
          expect(n.length).toBeGreaterThan(0);
        }
      }
    }
  });
  it("builds diatonic chords in the genre key", () => {
    const pop = findGenre("pop")!; // C major, I–V–vi–IV
    expect(chord(pop, 1, 48)).toEqual([48, 52, 55]);
    expect(chord(pop, 5, 48)).toEqual([55, 59, 62]);
    expect(chord(findGenre("lofi")!, 2, 48)).toEqual([52, 55, 59, 62]); // D major ii7 = Em7
  });
  it("writes 808s an octave up for a synth and slides drill", () => {
    const trap = findGenre("trap")!;
    expect(lowNotes(trap, 4)[0]!.pitch).toBe(42); // F#1 (30) + 12
    const drill = lowNotes(findGenre("drill")!, 1);
    const [a, b] = drill.slice(-2);
    expect(a!.start + a!.length).toBeGreaterThan(b!.start); // overlap = glide
  });
  it("applies swing only to odd 16ths", () => {
    const bb = findGenre("boombap")!;
    const hats = stepNotes(bb, 1).filter((n) => n.pitch === 42).map((n) => n.start);
    expect(hats).toContain(0);
    expect(hats.some((s) => Math.abs(s - 3.79) < 1e-9)).toBe(true); // step 15 (odd) lands at 3.5 + 0.5 × 58 %
    expect(hats.some((s) => Math.abs(s - 3.75) < 1e-9)).toBe(false);
    expect(chordNotes(findGenre("trap")!, 4).length).toBeGreaterThan(0);
  });
  it("prefers VST3 when several formats are installed", () => {
    const fx = [
      { name: "AUi: Acme: Acme Synth", instrument: true },
      { name: "CLAPi: Acme Synth (Acme)", instrument: true },
      { name: "VST3i: Acme Synth (Acme)", instrument: true },
    ];
    expect(pickInstrument(fx, "acme synth")).toBe("VST3i: Acme Synth (Acme)");
    expect(pickInstrument(fx, "nothing")).toBeNull();
  });
  it("the AI tool accepts genre ids and rejects others", () => {
    expect(validateArgs("loadGenreTemplate", { genre: "drill", bpm: 141 }).ok).toBe(true);
    expect(validateArgs("loadGenreTemplate", { genre: "polka" }).ok).toBe(false);
  });
});
