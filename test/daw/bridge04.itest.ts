import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { validateArgs, type CommandName } from "@daw/reaper/commands";
import { ReaperConnection } from "@daw/reaper/reaper";

/*
 * Bridge 0.4 against a THROWAWAY REAPER only: started by the agent launcher with the fixture
 * `startup.lua` (master muted; tracks Sine bars 1-2 at -6 dBFS, Hot bars 3-4 clipped, Quiet bars 1-2
 * at -34 dBFS and selected, Takes bar 5 with two takes; project saved inside the test folder).
 * Nothing plays and nothing records. Run with REAPER_ASSIST_BRIDGE_DIR=<res>/ReaperAssist/bridge.
 */
const dir = process.env.REAPER_ASSIST_BRIDGE_DIR;
const run = dir && dir.includes(".reaper-test") ? describe : describe.skip;
const T = 60000;

interface Reply {
  ok: boolean;
  body: { status: string; data?: any; error?: { code: string; message: string; hint?: string }; undoLabel?: string; warnings?: string[] };
  data: any;
  undo?: string;
}

run("bridge 0.4: places, edits, analysis, recording (isolated instance)", () => {
  const r = new ReaperConnection(dir!);
  const res = dirname(dirname(dir!));
  let mediaInside = false;
  afterAll(() => writeFileSync(join(res, "quit.flag"), "done"));

  /** Same path as the agent: validate with the schema, then run. */
  async function call(name: CommandName, args: Record<string, unknown> = {}): Promise<Reply> {
    const v = validateArgs(name, args);
    if (!v.ok) throw new Error(`${name}: ${v.message}`);
    const out = await r.run(name, v.args);
    let body: Reply["body"];
    try {
      body = JSON.parse(out.text);
    } catch {
      body = { status: "error", error: { code: "TEXT", message: out.text } };
    }
    return { ok: out.ok, body, data: body.data, undo: out.undoLabel };
  }
  const items = async (track: string) => (await call("listTrackItems", { track: { name: track } })).data.items as any[];
  const labels = (list: any[]) => list.map((i) => i.label);

  it("connects to bridge 0.4.0", async () => {
    for (let i = 0; i < 60 && (await r.status()).state !== "connected"; i++) await new Promise((ok) => setTimeout(ok, 500));
    const st = await r.status();
    expect(st.state).toBe("connected");
    expect(st.status!.bridgeVersion).toMatch(/^0\.4\./);
  }, T);

  it("keeps recordings and renders inside the test folder", async () => {
    const s = await call("getRecordingSetup");
    expect(s.ok, JSON.stringify(s.body)).toBe(true);
    mediaInside = typeof s.data.recordPath === "string" && s.data.recordPath.startsWith(res);
    console.log("recording setup", JSON.stringify({ ...s.data, armed: s.data.armed.length }));
    expect(mediaInside).toBe(true);
    expect(s.data.recordFormat.type).toBe("WAV");
    expect(s.data.disk.freeGb).toBeGreaterThan(0);
    expect(s.data.latency.roundTripMs).toBeGreaterThan(0);
  }, T);

  it("names sections and resolves them, refusing an ambiguous name", async () => {
    for (const [name, s, e] of [["Intro", 1, 3], ["Chorus", 3, 5], ["Chorus", 7, 9]] as const) {
      expect((await call("addRegion", { start: { bar: s }, end: { bar: e }, name })).ok).toBe(true);
    }
    expect((await call("addMarker", { position: { bar: 11 }, name: "Hook" })).ok).toBe(true);
    expect((await call("addMarker", { position: { bar: 13 }, name: "Outro" })).ok).toBe(true);
    const ctx = (await r.sessionContext())!;
    expect(ctx.sections.slice(0, 4).map((s) => `${s.name} ${s.label} ${s.startBar}-${s.endBar}`)).toEqual([
      "Intro bars 1–2 1.1-3.1", "Chorus bars 3–4 3.1-5.1", "Chorus bars 7–8 7.1-9.1", "Hook bars 11–12 11.1-13.1",
    ]);
    const amb = await call("listTrackItems", { track: { name: "Sine" }, range: { section: "chorus" } });
    expect(amb.ok).toBe(false);
    expect(amb.body.status).toBe("rejected");
    expect(amb.body.error!.code).toBe("AMBIGUOUS_TARGET");
    expect(amb.body.error!.message).toMatch(/bars 3–4.*bars 7–8/);
    const first = await call("listTrackItems", { track: { name: "Hot" }, range: { section: "Chorus", occurrence: 1 } });
    expect(first.data.range.label).toBe("bars 3–4");
    expect(first.data.items).toHaveLength(1);
    const none = await call("listTrackItems", { track: { name: "Sine" }, range: { section: "Bridge" } });
    expect(none.body.error!.code).toBe("SECTION_NOT_FOUND");
    expect(none.body.error!.hint).toContain("Intro (bars 1–2)");
    const text = (await r.contextSummary())!;
    console.log(text);
    expect(text).toContain("Sections: Intro bars 1–2, Chorus bars 3–4, Chorus (#2) bars 7–8, Hook bars 11–12");
    expect(text).toMatch(/1\. Sine: items: 1 audio in bars 1–2/);
  }, T);

  it("reads the selection and acts on { selected: true }", async () => {
    expect((await call("selectTrack", { track: { name: "Quiet" } })).ok).toBe(true);
    const s = await call("getSelection");
    expect(s.data.tracks.map((t: any) => t.name)).toEqual(["Quiet"]);
    expect(s.data.items.map((i: any) => `${i.track} ${i.kind} ${i.label}`)).toEqual(["Quiet audio bars 1–2"]);
    const g = await call("setItemProperties", { items: { selected: true }, changeGainDb: -3 });
    expect(g.body.status).toBe("verified");
    expect(g.data.items[0].gainDb).toBeCloseTo(-3, 1);
    expect((await call("undo", { expectLabel: g.undo! })).ok).toBe(true);
    expect((await items("Quiet"))[0].gainDb).toBeCloseTo(0, 1);
    const ctx = (await r.sessionContext())!;
    expect(ctx.project).toMatchObject({ bpm: 120, timeSig: "4/4" });
    expect(ctx.tracks.map((t) => t.name)).toEqual(["Sine", "Hot", "Quiet", "Takes"]);
    expect(ctx.selection.items[0]).toMatchObject({ startBar: "1.1", endBar: "3.1", label: "bars 1–2" });
  }, T);

  it("measures tracks, items and the master offline", async () => {
    const tr = await call("analyzeAudio", { target: { tracks: [{ name: "Quiet" }, { name: "Hot" }] } });
    expect(tr.ok, JSON.stringify(tr.body)).toBe(true);
    console.log("tracks", JSON.stringify(tr.data.results));
    const [hot, quiet] = tr.data.results;
    expect(hot.name).toBe("Hot");
    expect(hot.peakDb).toBeGreaterThan(-0.5);
    expect(String(hot.verdicts)).toMatch(/clipping/);
    expect(quiet.name).toBe("Quiet");
    expect(quiet.peakDb).toBeLessThan(-30);
    const ids = [(await items("Sine"))[0].id, (await items("Hot"))[0].id, (await items("Quiet"))[0].id];
    const it = await call("analyzeAudio", { target: { items: { ids } } });
    console.log("items", JSON.stringify(it.data.results));
    const [sine, hotItem, quietItem] = it.data.results;
    expect(sine.track).toBe("Sine");
    expect(sine.source.peakDb).toBeCloseTo(-6, 0);
    expect(sine.tonalBalanceBeforeFx).toMatch(/(^|, )mid (9\d|100)%/);
    expect(hotItem.track).toBe("Hot");
    expect(hotItem.clippedStretches).toBeGreaterThan(0);
    expect(quietItem.source.peakDb).toBeCloseTo(-34, 0);
    expect(quietItem.tonalBalanceBeforeFx).toMatch(/low-mid (9\d|100)%/);
    const m = await call("analyzeAudio", { target: { master: true }, range: { section: "Chorus", occurrence: 1 } });
    console.log("master", JSON.stringify(m.data));
    expect(m.data.results[0].kind).toBe("master");
    expect(m.data.range.label).toBe("bars 3–4");
    expect(m.data.results[0].peakDb).toBeGreaterThan(-0.5);
  }, T);

  it("splits, moves, copies, trims and changes items by bars, one undo step each", async () => {
    const split = await call("splitItems", { items: { track: { name: "Sine" } }, at: [{ bar: 2 }] });
    expect(split.body.status, JSON.stringify(split.body)).toBe("verified");
    expect(split.undo).toBeTruthy();
    expect(labels(split.data.items)).toEqual(["bar 1", "bar 2"]);
    const mv = await call("moveItems", { items: { track: { name: "Sine" }, range: { fromBar: 2, toBar: 2 } }, by: { bars: 4 } });
    expect(mv.body.status).toBe("verified");
    expect(labels(mv.data.items)).toEqual(["bar 6"]);
    const cp = await call("copyItems", { items: { track: { name: "Sine" }, range: { fromBar: 1, toBar: 1 } }, to: { bar: 13 }, times: 2 });
    expect(cp.body.status, JSON.stringify(cp.body)).toBe("verified");
    expect(labels(cp.data.items)).toEqual(["bar 13", "bar 14"]);
    const before = (await items("Sine")).length;
    const clash = await call("copyItems", { items: { track: { name: "Sine" }, range: { fromBar: 1, toBar: 1 } }, to: { bar: 14 } });
    expect(clash.body.status).toBe("rejected");
    expect(clash.body.error!.code).toBe("PRECONDITION_FAILED");
    expect((await items("Sine")).length).toBe(before);
    const trim = await call("trimItems", { items: { track: { name: "Sine" }, range: { fromBar: 13, toBar: 13 } }, toRange: { start: { bar: 13 }, end: { bar: 13, beat: 3 } } });
    expect(trim.body.status).toBe("verified");
    expect(labels(trim.data.items)).toEqual(["13.1–13.3"]);
    const props = await call("setItemProperties", { items: { track: { name: "Sine" }, range: { fromBar: 14, toBar: 14 } }, gainDb: -6, fadeInMs: 10, fadeOutMs: 50, playrate: 2, reversed: true });
    expect(props.body.status, JSON.stringify(props.body)).toBe("verified");
    expect(props.data.items[0]).toMatchObject({ label: "14.1–14.3", reversed: true, playrate: 2, fadeInMs: 10, fadeOutMs: 50 });
    expect(props.data.items[0].gainDb).toBeCloseTo(-6, 1);
    expect((await call("undo", { expectLabel: props.undo! })).ok).toBe(true);
    const back = (await items("Sine")).find((i) => i.startBar === "14.1");
    expect(back).toMatchObject({ label: "bar 14", reversed: false, playrate: 1 });
  }, T);

  it("glues items into one item; undo brings them back", async () => {
    if (!mediaInside) return;
    const g = await call("glueItems", { items: { track: { name: "Sine" }, range: { fromBar: 13, toBar: 14 } } });
    expect(g.body.status, JSON.stringify(g.body)).toBe("verified");
    expect(g.data).toMatchObject({ glued: 2, item: { label: "bars 13–14" } });
    expect((await call("undo", { expectLabel: g.undo! })).ok).toBe(true);
    expect(labels((await items("Sine")).filter((i) => i.startBar.startsWith("13") || i.startBar.startsWith("14")))).toEqual(["13.1–13.3", "bar 14"]);
  }, T);

  it("writes a MIDI part, reads its key and edits it with one undo step per edit", async () => {
    expect((await call("createTrack", { name: "Keys", kind: "midi" })).ok).toBe(true);
    expect((await call("addFx", { track: { name: "Keys" }, fx: "ReaSynth" })).ok).toBe(true);
    const clip = await call("createMidiClip", { track: { name: "Keys" }, start: { bar: 1 }, lengthBars: 4 });
    const chords = [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]];
    const notes = chords.flatMap((c, b) => c.map((p) => ({ start: b * 4, length: 4, pitch: p, velocity: 90 })));
    const melody = [69, 72, 76, 74, 72, 69, 67, 69].map((p, i) => ({ start: i * 0.5 + 0.06, length: 0.45, pitch: p, velocity: 100 }));
    expect((await call("insertMidiNotes", { clip: { id: clip.data.clipId }, notes: [...notes, ...melody] })).ok).toBe(true);
    const all = await call("readMidiNotes", { notes: { track: { name: "Keys" } } });
    console.log("notes", JSON.stringify(all.data.summary));
    expect(all.data.summary.notes).toBe(20);
    expect(all.data.summary.key.likely).toMatch(/^(A minor|C major)$/);
    expect(all.data.clips[0]).toMatchObject({ track: "Keys", bars: "bars 1–4", notes: 20 });
    expect((await call("readMidiNotes", { notes: { track: { name: "Keys" }, range: { fromBar: 1, toBar: 1 } } })).data.summary.notes).toBe(11);
    expect((await call("readMidiNotes", { notes: { track: { name: "Keys" }, pitch: { min: 67, max: 127 } }, limit: 0 })).data.summary.notes).toBe(9);

    const q = await call("editNotes", { notes: { track: { name: "Keys" }, range: { fromBar: 1, toBar: 1 }, pitch: { min: 67, max: 127 } }, quantize: { gridBeats: 0.25 } });
    expect(q.body.status, JSON.stringify(q.body)).toBe("verified");
    expect(q.data).toMatchObject({ notes: 8, changed: 8 });
    expect((await call("readMidiNotes", { notes: { track: { name: "Keys" }, range: { fromBar: 1, toBar: 1 } } })).data.summary.timing.onGrid16Percent).toBe(100);
    expect((await call("undo", { expectLabel: q.undo! })).ok).toBe(true);
    expect((await call("readMidiNotes", { notes: { track: { name: "Keys" }, range: { fromBar: 1, toBar: 1 } } })).data.summary.timing.onGrid16Percent).toBe(27);

    const sw = await call("editNotes", { notes: { track: { name: "Keys" }, pitch: { min: 67, max: 127 }, range: { fromBar: 1, toBar: 1 } }, quantize: { gridBeats: 0.5, swing: 66 }, velocity: { ramp: { from: 60, to: 110 } } });
    expect(sw.body.status).toBe("verified");
    const swung = await call("readMidiNotes", { notes: { track: { name: "Keys" }, pitch: { min: 67, max: 127 }, range: { fromBar: 1, toBar: 1 } } });
    expect(swung.data.summary.timing.swing8).toBe("66%");
    expect(swung.data.summary.velocity).toMatchObject({ min: 60, max: 110 });

    const tr = await call("editNotes", { notes: { track: { name: "Keys" }, range: { fromBar: 4, toBar: 4 } }, transpose: 12, humanize: { timingMs: 5, velocity: 8, seed: 7 } });
    expect(tr.body.status, JSON.stringify(tr.body)).toBe("verified");
    expect((await call("readMidiNotes", { notes: { track: { name: "Keys" }, range: { fromBar: 4, toBar: 4 } } })).data.summary.range).toBe("G4–D5 (67–74)");

    const sc = await call("editNotes", { notes: { track: { name: "Keys" } }, toScale: { tonic: "C", mode: "major-pentatonic" } });
    expect(sc.body.status).toBe("verified");
    expect((await call("undo", { expectLabel: sc.undo! })).ok).toBe(true);

    // Bar 2 (bar 3 may hold a bar-4 note that humanize nudged a few ms early).
    const del = await call("deleteNotes", { notes: { track: { name: "Keys" }, range: { fromBar: 2, toBar: 2 } } });
    expect(del.body.status).toBe("verified");
    expect(del.data.deleted).toBe(3);
    expect((await call("readMidiNotes", { notes: { track: { name: "Keys" } }, limit: 0 })).data.summary.notes).toBe(17);
    expect((await call("undo", { expectLabel: del.undo! })).ok).toBe(true);
    expect((await call("readMidiNotes", { notes: { track: { name: "Keys" } }, limit: 0 })).data.summary.notes).toBe(20);
    const none = await call("deleteNotes", { notes: { track: { name: "Keys" }, range: { fromBar: 20, toBar: 21 } } });
    expect(none.body.status).toBe("rejected");

    const d = await call("getTrackDetails", { track: { name: "Keys" } });
    expect(d.data.instrument.name).toMatch(/ReaSynth/);
    expect(d.data.midi.notes).toBe(20);
  }, T);

  it("writes and reads automation in musician units, keeping the edges", async () => {
    const ramp = await call("writeAutomation", { track: { name: "Quiet" }, envelope: { kind: "volume" }, range: { fromBar: 1, toBar: 2 }, shape: "ramp", from: -12, to: 0 });
    expect(ramp.body.status, JSON.stringify(ramp.body)).toBe("verified");
    const rd = await call("readAutomation", { track: { name: "Quiet" }, envelope: { kind: "volume" }, range: { fromBar: 1, toBar: 2 } });
    console.log("volume", JSON.stringify(rd.data));
    expect(rd.data.valueAtStart).toBeCloseTo(-12, 0);
    expect(rd.data.valueAtEnd).toBeCloseTo(0, 0);
    const pan = await call("writeAutomation", { track: { name: "Quiet" }, envelope: { kind: "pan" }, range: { fromBar: 3, toBar: 4 }, shape: "set", value: 0.5 });
    expect(pan.body.status, JSON.stringify(pan.body)).toBe("verified");
    const pr = await call("readAutomation", { track: { name: "Quiet" }, envelope: { kind: "pan" }, range: { fromBar: 3, toBar: 4 } });
    expect(pr.data.valueAtStart).toBeCloseTo(0.5, 2);
    expect(pr.data.points.map((p: any) => p.display)).toContain("50%R");

    // Mute automation really mutes: the track measures silent in bar 1, and loud again after undo.
    const mute = await call("writeAutomation", { track: { name: "Sine" }, envelope: { kind: "mute" }, range: { fromBar: 1, toBar: 1 }, shape: "set", value: 1 });
    expect(mute.body.status, JSON.stringify(mute.body)).toBe("verified");
    const silent = await call("analyzeAudio", { target: { tracks: [{ name: "Sine" }] }, range: { fromBar: 1, toBar: 1 } });
    console.log("muted", JSON.stringify(silent.data.results[0]));
    expect(silent.data.results[0].lufsI ?? -150).toBeLessThan(-60);
    const um = await call("undo", { expectLabel: mute.undo! });
    expect(um.ok, JSON.stringify(um.body)).toBe(true);
    const loud = await call("analyzeAudio", { target: { tracks: [{ name: "Sine" }] }, range: { fromBar: 1, toBar: 1 } });
    expect(loud.data.results[0].lufsI).toBeGreaterThan(-12);

    const lfo = await call("writeAutomation", { track: { name: "Keys" }, envelope: { fx: { name: "ReaSynth" }, param: { index: 0 } }, range: { fromBar: 1, toBar: 2 }, shape: "lfo", lfo: { wave: "sine", periodBeats: 1, low: 0.2, high: 0.8 } });
    expect(lfo.body.status, JSON.stringify(lfo.body)).toBe("verified");
    const lr = await call("readAutomation", { track: { name: "Keys" }, envelope: { fx: { name: "ReaSynth" }, param: { index: 0 } }, range: { fromBar: 1, toBar: 2 } });
    expect(lr.data.points.length).toBeGreaterThan(100);
    const values = lr.data.points.map((p: any) => p.value).filter((v: number) => v > 0.15);
    expect(Math.min(...values)).toBeCloseTo(0.2, 1);
    expect(Math.max(...values)).toBeCloseTo(0.8, 1);
  }, T);

  it("chooses takes without deleting any", async () => {
    const [it0] = await items("Takes");
    expect(it0.takes).toHaveLength(2);
    const c = await call("chooseTake", { itemId: it0.id, takeIndex: 1 });
    expect(c.body.status).toBe("verified");
    expect(c.data.takeName).toBe("take b");
    const after = (await items("Takes"))[0];
    expect(after.takes.map((t: any) => t.active)).toEqual([false, true]);
    expect((await call("undo", { expectLabel: c.undo! })).ok).toBe(true);
    expect((await items("Takes"))[0].takes.map((t: any) => t.active)).toEqual([true, false]);
    const lanes = await call("chooseTake", { track: { name: "Takes" }, lane: 1 });
    expect(lanes.body.status).toBe("rejected");
  }, T);

  it("sets punch-in over a section and pre-roll", async () => {
    const p = await call("setRecordMode", { mode: "time-selection-punch", range: { section: "Chorus", occurrence: 2 } });
    expect(p.body.status, JSON.stringify(p.body)).toBe("verified");
    expect(p.data.punch.label).toBe("bars 7–8");
    expect((await r.sessionContext())!.selection.timeSelection!.label).toBe("bars 7–8");
    expect((await call("setRecordMode", { mode: "normal" })).body.status).toBe("verified");
    const pr = await call("setPreroll", { record: true, bars: 2 });
    expect(pr.body.status, JSON.stringify(pr.body)).toBe("verified");
    expect(pr.data).toMatchObject({ record: true, bars: 2 });
    expect((await call("setPreroll", { record: false })).body.status).toBe("verified");
  }, T);

  it("listens to an armed input without recording (track with no input)", async () => {
    expect((await call("createTrack", { name: "Mic", kind: "audio" })).ok).toBe(true);
    expect((await call("setTrackInput", { track: { name: "Mic" }, input: { type: "none" } })).ok).toBe(true);
    expect((await call("armTrack", { track: { name: "Mic" }, armed: true })).ok).toBe(true);
    const lv = await call("checkInputLevels", { seconds: 1 });
    expect(lv.ok, JSON.stringify(lv.body)).toBe(true);
    expect(lv.data.tracks.map((t: any) => t.name)).toEqual(["Mic"]);
    expect(lv.data.tracks[0].peakDb).toBeLessThan(-100);
    expect((await call("armTrack", { track: { name: "Mic" }, armed: false })).ok).toBe(true);
  }, T);

  it("freezes and unfreezes a track", async () => {
    if (!mediaInside) return;
    const f = await call("freezeTrack", { track: { name: "Keys" }, frozen: true });
    expect(f.body.status, JSON.stringify(f.body)).toBe("verified");
    expect((await call("getTrackDetails", { track: { name: "Keys" } })).data.frozen).toBe(true);
    const u = await call("freezeTrack", { track: { name: "Keys" }, frozen: false });
    expect(u.body.status, JSON.stringify(u.body)).toBe("verified");
    expect((await call("getTrackDetails", { track: { name: "Keys" } })).data.frozen).toBe(false);
  }, 120000);

  it("puts selection, sections and item spans into the project state", async () => {
    const p = await r.projectState();
    expect(p.selection).toBeTruthy();
    expect((p.sections as any[]).length).toBeGreaterThanOrEqual(4);
    const sine = (p.tracks as any[]).find((t) => t.name === "Sine");
    expect(sine.items.spans[0].label).toBe("bar 1");
    console.log((await r.contextSummary())!);
  }, T);
});
