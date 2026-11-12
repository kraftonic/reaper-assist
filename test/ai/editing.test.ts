import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ChatEvent } from "@shared/types";
import { Agent } from "@ai/agent";
import { ConversationStore } from "@ai/conversations";
import { COMMANDS, commandJsonSchema, describeCommand, gridLabel, rangeLabel, validateArgs, type CommandName } from "@daw/reaper/commands";
import { mapTrackRefs, postProcess } from "@daw/reaper/reaper";
import type { WireResponse } from "@daw/reaper/transport";
import type { ChatSession, ToolDef, TurnOptions, TurnResult } from "@ai/providers/types";

const ok = (name: CommandName, args: unknown) => validateArgs(name, args).ok;

describe("places and editing commands (schemas)", () => {
  it("accepts every way of saying where", () => {
    for (const range of [{ section: "Chorus" }, { section: "Chorus", occurrence: 2 }, { fromBar: 9, toBar: 16 }, { timeSelection: true }, { start: { bar: 9 }, end: { seconds: 40 } }]) {
      expect(ok("listTrackItems", { track: { name: "Bass" }, range }), JSON.stringify(range)).toBe(true);
    }
    expect(ok("listTrackItems", { track: { index: 1 }, range: { fromBar: 9, toBar: 8 } })).toBe(false);
    expect(ok("listTrackItems", { track: { index: 1 }, range: { section: "" } })).toBe(false);
    expect(ok("listTrackItems", { track: { index: 1 }, range: { timeSelection: false } })).toBe(false);
    expect(ok("splitItems", { items: { selected: true }, at: [{ bar: 5 }, { section: "Chorus" }, { seconds: 3.5 }] })).toBe(true);
    expect(ok("splitItems", { items: { ids: ["{A}"] }, atRangeEdges: { section: "Chorus" } })).toBe(true);
    expect(ok("splitItems", { items: { selected: true } })).toBe(false);
    expect(ok("splitItems", { items: { selected: true }, at: [{ bar: 5 }], atRangeEdges: { fromBar: 1, toBar: 2 } })).toBe(false);
  });

  it("is strict about item, note and move arguments", () => {
    expect(ok("moveItems", { items: { track: { name: "Drums" }, range: { fromBar: 1, toBar: 4 } }, by: { bars: 4 } })).toBe(true);
    expect(ok("moveItems", { items: { selected: true }, by: { bars: 1 }, to: { bar: 3 } })).toBe(false);
    expect(ok("moveItems", { items: { selected: true } })).toBe(false);
    expect(ok("moveItems", { items: { selected: true }, by: {} })).toBe(false);
    expect(ok("moveItems", { items: { selected: true }, toTrack: { index: 2 } })).toBe(true);
    expect(ok("copyItems", { items: { selected: true }, to: { section: "Verse", occurrence: 2 }, times: 4 })).toBe(true);
    expect(ok("copyItems", { items: { selected: true }, to: { bar: 9 }, times: 65 })).toBe(false);
    expect(ok("trimItems", { items: { selected: true }, toRange: { fromBar: 1, toBar: 4 } })).toBe(true);
    expect(ok("trimItems", { items: { selected: true }, start: { bar: 2 } })).toBe(true);
    expect(ok("trimItems", { items: { selected: true } })).toBe(false);
    expect(ok("trimItems", { items: { selected: true }, toRange: { fromBar: 1, toBar: 4 }, end: { bar: 3 } })).toBe(false);
    expect(ok("setItemProperties", { items: { selected: true }, gainDb: -3, changeGainDb: 1 })).toBe(false);
    expect(ok("setItemProperties", { items: { selected: true } })).toBe(false);
    expect(ok("setItemProperties", { items: { ids: ["a"] }, fadeInMs: 10, fadeShape: "s-curve", reversed: true, playrate: 1.05, preservePitch: false })).toBe(true);
    expect(ok("readMidiNotes", { notes: { track: { name: "Keys" }, range: { section: "Verse" }, pitch: { min: 42, max: 46 } }, limit: 0 })).toBe(true);
    expect(ok("readMidiNotes", { notes: { track: { index: 1 }, selected: "notes" } })).toBe(false);
    expect(ok("readMidiNotes", { notes: {} })).toBe(false);
    expect(ok("deleteNotes", { notes: { selected: "notes" } })).toBe(true);
  });

  it("validates note edits, automation and recording settings", () => {
    expect(ok("editNotes", { notes: { selected: "notes" }, quantize: { gridBeats: 0.25, strength: 0.8, swing: 58 }, humanize: { timingMs: 5, velocity: 8, seed: 3 } })).toBe(true);
    expect(ok("editNotes", { notes: { selected: "notes" } })).toBe(false);
    expect(ok("editNotes", { notes: { selected: "notes" }, quantize: { gridBeats: 0.25, swing: 80 } })).toBe(false);
    expect(ok("editNotes", { notes: { selected: "notes" }, toScale: { tonic: "F#", mode: "minor" }, transpose: -12 })).toBe(true);
    expect(ok("editNotes", { notes: { selected: "notes" }, toScale: { tonic: "H", mode: "minor" } })).toBe(false);
    expect(ok("editNotes", { notes: { selected: "notes" }, velocity: { ramp: { from: 60, to: 110 } }, length: { legato: true } })).toBe(true);
    expect(ok("writeAutomation", { track: { name: "Vox" }, envelope: { kind: "volume" }, range: { section: "Chorus" }, shape: "ramp", from: -6, to: 0 })).toBe(true);
    expect(ok("writeAutomation", { track: { name: "Vox" }, envelope: { kind: "volume" }, range: { section: "Chorus" }, shape: "ramp", from: -6 })).toBe(false);
    expect(ok("writeAutomation", { track: { index: 1 }, envelope: { fx: { name: "ReaEQ" }, param: { name: "Freq-Band 1" } }, range: { fromBar: 1, toBar: 8 }, shape: "lfo", lfo: { wave: "sine", periodBeats: 1, low: 0.2, high: 0.8 } })).toBe(true);
    expect(ok("writeAutomation", { track: { index: 1 }, envelope: { kind: "width" }, range: { fromBar: 1, toBar: 8 }, shape: "clear" })).toBe(false);
    expect(ok("setRecordMode", { mode: "time-selection-punch", range: { fromBar: 17, toBar: 20 } })).toBe(true);
    expect(ok("setPreroll", {})).toBe(false);
    expect(ok("chooseTake", { itemId: "{A}", takeIndex: 1 })).toBe(true);
    expect(ok("chooseTake", { track: { name: "Vox" }, lane: 2 })).toBe(true);
    expect(ok("chooseTake", { itemId: "{A}", lane: 2 })).toBe(false);
    expect(ok("analyzeAudio", { target: { master: true }, range: { section: "Chorus" } })).toBe(true);
    expect(ok("analyzeAudio", { target: { tracks: [{ name: "Bass" }] } })).toBe(true);
    expect(ok("analyzeAudio", { target: { items: { selected: true } } })).toBe(true);
    expect(ok("analyzeAudio", { target: {} })).toBe(false);
  });

  it("gives every new command an object schema and a safe risk level", () => {
    const edits: CommandName[] = ["splitItems", "moveItems", "copyItems", "trimItems", "setItemProperties", "glueItems", "editNotes", "deleteNotes", "writeAutomation", "freezeTrack"];
    for (const n of edits) {
      expect(commandJsonSchema(n).type, n).toBe("object");
      expect(COMMANDS[n].risk, n).toBe("caution");
    }
    for (const n of ["glueItems", "deleteNotes", "freezeTrack"] as const) expect(COMMANDS[n].alwaysConfirm, n).toBe(true);
    for (const n of ["getSelection", "getTrackDetails", "readMidiNotes", "readAutomation", "analyzeAudio", "getRecordingSetup", "checkInputLevels"] as const) expect(COMMANDS[n].risk, n).toBe("read");
    expect(COMMANDS.analyzeAudio.allowedWhileRecording).toBeUndefined();
    expect(COMMANDS.getRecordingSetup.allowedWhileRecording).toBe(true);
  });

  it("describes each edit in one plain line", () => {
    const d = (n: CommandName, a: Record<string, unknown>) => describeCommand(n, a);
    expect(d("copyItems", { items: { track: { name: "Drums" }, range: { fromBar: 1, toBar: 4 } }, to: { bar: 5 }, times: 4 })).toBe("Copy items on “Drums” in bars 1–4 to bar 5 ×4");
    expect(d("editNotes", { notes: { track: { name: "Drums" }, range: { section: "Verse", occurrence: 2 }, pitch: { min: 42, max: 46 } }, quantize: { gridBeats: 0.25, strength: 0.8, swing: 58 }, humanize: {} }))
      .toBe("Quantize to 1/16 (80%, swing 58%), humanize: notes on “Drums” in “Verse” (#2) (pitches 42–46)");
    expect(d("deleteNotes", { notes: { selected: "notes" } })).toBe("Delete the selected notes");
    expect(d("writeAutomation", { track: { name: "Vox" }, envelope: { kind: "volume" }, range: { section: "Chorus" }, shape: "ramp" })).toBe("Write ramp volume automation on “Vox” in “Chorus”");
    expect(d("analyzeAudio", { target: { master: true }, range: { fromBar: 9, toBar: 16 } })).toBe("Measure the master in bars 9–16");
    expect(d("setItemProperties", { items: { selected: true }, changeGainDb: -3, fadeOutMs: 20 })).toBe("Set gain -3 dB, fade-out 20 ms on the selected items");
    expect(d("chooseTake", { track: { name: "Vox" }, lane: 1 })).toBe("Play lane 2 on “Vox”");
    expect(d("glueItems", { items: { selected: true } })).toBe("Glue the selected items into one item");
    expect(gridLabel(0.25)).toBe("1/16");
    expect(gridLabel(1 / 3)).toBe("1/8T");
    expect(gridLabel(1 / 6)).toBe("1/16T");
    expect(rangeLabel({ timeSelection: true })).toBe("the time selection");
  });
});

describe("track references inside places", () => {
  it("resolves tracks at any depth, and from/to only where they are tracks", () => {
    const seen: unknown[] = [];
    const mark = (r: unknown) => {
      seen.push(r);
      return { by: "id", id: "X" };
    };
    expect(mapTrackRefs("moveItems", { items: { track: { name: "Drums" }, range: { fromBar: 1, toBar: 2 } }, to: { bar: 5 }, toTrack: { index: 3 } }, mark))
      .toEqual({ items: { track: { by: "id", id: "X" }, range: { fromBar: 1, toBar: 2 } }, to: { bar: 5 }, toTrack: { by: "id", id: "X" } });
    expect(mapTrackRefs("analyzeAudio", { target: { tracks: [{ name: "A" }, { index: 2 }] } }, mark)).toEqual({ target: { tracks: [{ by: "id", id: "X" }, { by: "id", id: "X" }] } });
    expect(mapTrackRefs("analyzeAudio", { target: { items: { track: { name: "A" } } } }, mark)).toEqual({ target: { items: { track: { by: "id", id: "X" } } } });
    expect(mapTrackRefs("editNotes", { notes: { track: { name: "Keys" } }, velocity: { ramp: { from: 60, to: 100 } } }, mark))
      .toEqual({ notes: { track: { by: "id", id: "X" } }, velocity: { ramp: { from: 60, to: 100 } } });
    expect(mapTrackRefs("createSend", { from: { name: "A" }, to: { name: "B" } }, mark)).toEqual({ from: { by: "id", id: "X" }, to: { by: "id", id: "X" } });
    expect(mapTrackRefs("configureSidechain", { source: { name: "A" }, target: { name: "B" } }, mark)).toEqual({ source: { by: "id", id: "X" }, target: { by: "id", id: "X" } });
    expect(mapTrackRefs("startPlayback", { from: { bar: 3 } }, mark)).toEqual({ from: { bar: 3 } });
    expect(mapTrackRefs("writeAutomation", { track: { name: "V" }, shape: "ramp", from: -6, to: 0 }, mark)).toEqual({ track: { by: "id", id: "X" }, shape: "ramp", from: -6, to: 0 });
  });
});

describe("post-processing of readings", () => {
  const wire = (data: Record<string, unknown>): WireResponse => ({ v: 1, id: "1", session: "s", status: "ok", data });

  it("turns raw notes into a summary and a capped list", async () => {
    const notes = Array.from({ length: 12 }, (_, i) => [`${Math.floor(i / 4) + 1}.${(i % 4) + 1}`, i, 1, [57, 60, 64][i % 3], 100 - i, 0, 0, 0, 0]);
    const r = wire({ clips: [{ itemId: "{I}", track: "Keys", trackId: "{T}", name: "chords", label: "bars 1–3", notes: 12 }], notes, total: 12, truncated: false, range: null, bpm: 100, timeSig: "4/4" });
    await postProcess("readMidiNotes", r, { notes: { track: { name: "Keys" } }, limit: 5 });
    const d = r.data!;
    expect(d.notes).toEqual(["1.1 A3 1 v100", "1.2 C4 1 v99", "1.3 E4 1 v98", "1.4 A3 1 v97", "2.1 C4 1 v96"]);
    expect(d).toMatchObject({ listed: 5, total: 12, clips: [{ itemId: "{I}", track: "Keys", bars: "bars 1–3", notes: 12 }] });
    expect((d.summary as { key: { likely: string } }).key.likely).toMatch(/A minor|C major/);
    const quiet = wire({ clips: [], notes, total: 12, bpm: 100 });
    await postProcess("readMidiNotes", quiet, { limit: 0 });
    expect(quiet.data!.notes).toBeUndefined();
    expect(quiet.data!.summary).toBeTruthy();
  });

  it("adds engineering verdicts to loudness readings and drops empty fields", async () => {
    const r = wire({ results: [{ name: "Master", kind: "master", lufsI: -7.9, peakDb: 0.1, truePeakDb: null, lra: 4, sourceScan: null }], notes: [] });
    await postProcess("analyzeAudio", r, {});
    const m = (r.data!.results as Record<string, unknown>[])[0]!;
    expect(m.truePeakDb).toBeUndefined();
    expect(m.headroomDb).toBe(-0.1);
    expect(String(m.verdicts)).toMatch(/clipping/);
    const items = wire({ results: [{ name: "vox", kind: "item", lufsI: -18, peakDb: -6, source: { peakDb: -6, rmsDb: -22, truePeakDb: -5.8 }, sourceScan: { clipRuns: 0, centroidHz: 1800, bands: [{ band: "mid", fromHz: 500, toHz: 2000, share: 60 }] } }] });
    await postProcess("analyzeAudio", items, {});
    const it0 = (items.data!.results as Record<string, unknown>[])[0]!;
    expect(it0.tonalBalanceBeforeFx).toBe("mid 60%; centre of energy 1800 Hz (present)");
    expect(it0.sourceScan).toBeUndefined();
    expect(it0.sourceCrestDb).toBe(16.2);
  });

  it("adds free disk space and recording time to the setup", async () => {
    const r = wire({ device: { sampleRate: 48000, bufferSize: 128 }, latency: { roundTripMs: 7.2 }, projectSampleRate: 48000, recordFormat: { type: "WAV", bitDepth: 24 }, recordPath: join(tmpdir(), "no", "such", "folder"), armed: [{ input: { type: "audio", stereo: true } }] });
    await postProcess("getRecordingSetup", r, {});
    const disk = r.data!.disk as { path: string; freeGb: number; recordingTimeLeft: string };
    expect(disk.freeGb).toBeGreaterThan(0);
    expect(disk.recordingTimeLeft).toMatch(/at 24-bit\/48 kHz, 2 channels$/);
  });
});

/* ------------------------------------------------ agent: loadSkill tool */

class OneToolSession implements ChatSession {
  key = "fake:model";
  tools: ToolDef[][] = [];
  results: { content: string; isError?: boolean }[][] = [];
  private turns = 0;
  addUser() {}
  addToolResults(r: { content: string; isError?: boolean }[]) {
    this.results.push(r);
  }
  serialize() {
    return [];
  }
  async turn(o: TurnOptions): Promise<TurnResult> {
    this.tools.push(o.tools);
    return this.turns++ === 0 ? { stop: "tool_use", toolCalls: [{ id: "t1", name: "loadSkill", input: { id: "drums" } }] } : { stop: "end", toolCalls: [] };
  }
}

describe("agent and skills", () => {
  for (const enabled of [true, false]) {
    it(`offers loadSkill and runs it without approval or REAPER (DAW ${enabled ? "on" : "off"})`, async () => {
      const store = new ConversationStore(mkdtempSync(join(tmpdir(), "ka-")));
      const session = new OneToolSession();
      const events: ChatEvent[] = [];
      const ran: string[] = [];
      const agent = new Agent({
        store,
        permissions: () => ({ mode: "ask", rules: {} }),
        active: () => ({ provider: "anthropic", model: "fake", key: "fake:model" }),
        makeSession: () => session,
        emit: (e) => events.push(e),
        daw: { enabled: () => enabled, contextSummary: async () => null, run: async (n) => (ran.push(n), { ok: true, text: "{}" }) },
      });
      const conv = store.create();
      await agent.send(conv.id, "how do I tighten my drums?");
      expect(session.tools[0]!.some((t) => t.name === "loadSkill")).toBe(true);
      expect(session.tools[0]!.some((t) => t.name === "editNotes")).toBe(enabled);
      expect(session.results[0]![0]!.content).toMatch(/^# Drums: programming and mixing/);
      expect(ran).toEqual([]);
      const tool = events.filter((e) => e.type === "tool").map((e) => (e as Extract<ChatEvent, { type: "tool" }>).part).at(-1)!;
      expect(tool).toMatchObject({ name: "loadSkill", status: "done", risk: "read", summary: "Read the “Drums: programming and mixing” guide" });
      expect(events.some((e) => e.type === "tool" && e.part.status === "awaiting-approval")).toBe(false);
    });
  }
});
