import { describe, expect, it } from "vitest";
import { GENRES } from "@studio/genres";
import { ReaperConnection, summarizeProject } from "@daw/reaper/reaper";

// Runs only against the isolated test instance: bash scripts/reaper-test-instance.sh start
const dir = process.env.REAPER_ASSIST_BRIDGE_DIR;
const run = dir && dir.includes(".reaper-test") ? describe : describe.skip;

run("REAPER bridge (isolated instance)", () => {
  const r = new ReaperConnection(dir!);
  it("connects and reads the project", async () => {
    expect((await r.status()).state).toBe("connected");
    const p = await r.projectState();
    expect(summarizeProject(p)).toContain("BPM");
  });
  it("creates a track, resolves it by name, sets volume, and refuses ambiguity", async () => {
    const name = `Itest ${Date.now()}`;
    const c = await r.run("createTrack", { name, kind: "audio" });
    expect(c.ok, c.text).toBe(true);
    const v = await r.run("setTrackVolume", { track: { name }, db: -6 });
    expect(v.ok, v.text).toBe(true);
    const p = await r.projectState();
    const t = (p.tracks as { name: string; volumeDb: number }[]).find((x) => x.name === name)!;
    expect(Math.round(t.volumeDb)).toBe(-6);
    await r.run("createTrack", { name, kind: "audio" });
    const amb = await r.run("setTrackMute", { track: { name }, muted: true });
    expect(amb.ok).toBe(false);
    expect(amb.text).toMatch(/More than one/);
  });
  it("sets tempo and adds a stock effect", async () => {
    expect((await r.run("setTempo", { bpm: 142 })).ok).toBe(true);
    const fx = await r.run("addFx", { track: { index: 1 }, fx: "ReaEQ" });
    expect(fx.ok, fx.text).toBe(true);
  });
});

run("genre templates (isolated instance)", () => {
  const r = new ReaperConnection(dir!);
  for (const genre of GENRES.map((g) => g.id)) {
    it(`builds ${genre} as one undoable step with playable clips`, async () => {
      const before = ((await r.projectState()).tracks as unknown[]).length;
      const out = await r.loadTemplate(genre);
      expect(out.ok, out.text).toBe(true);
      const p = await r.projectState();
      const tracks = p.tracks as { name: string; itemCount: number; fx: { name: string }[] }[];
      expect(tracks.length - before).toBe(7);
      const drums = tracks.filter((t) => t.name === "Drums").at(-1)!;
      expect(drums.itemCount).toBe(1);
      console.log(genre, JSON.parse(out.text).instruments, JSON.parse(out.text).drums, drums.fx.map((f) => f.name));
      const undo = await r.run("undo", { expectLabel: out.undoLabel! });
      expect(undo.ok, undo.text).toBe(true);
      expect(((await r.projectState()).tracks as unknown[]).length).toBe(before);
    });
  }
});
