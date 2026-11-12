import { spawn, type ChildProcess } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ReaperConnection } from "@daw/reaper/reaper";
import { DEFAULT_SHORTCUTS } from "@profiles/engine/workspace";

// The live browser layout (bridge setupWorkspace), each case in its own THROWAWAY REAPER
// (-newinst, own -cfgfile, own bridge folder). Never touches the test instance or your REAPER.
//   KA_LIVE_LAYOUT=1 npx vitest run -c vitest.reaper.config.mts test/workspace.itest.ts
const REAPER = "/Applications/REAPER.app/Contents/MacOS/REAPER";
const SEED = resolve(".reaper-test/resource");
const BRIDGE = resolve("src/daw/reaper/bridge/assist_bridge.lua");
const run = process.env.KA_LIVE_LAYOUT === "1" && existsSync(REAPER) && existsSync(join(SEED, "reaper.ini")) ? describe : describe.skip;

let proc: ChildProcess | null = null;
let cfg = "";
afterEach(() => {
  // Only ever stop the instance this test started, with its own config.
  if (proc?.pid && !proc.killed && proc.spawnargs.includes(cfg)) proc.kill();
  proc = null;
});

async function start(extraIni: string, startup?: string): Promise<{ res: string; r: ReaperConnection }> {
  const res = mkdtempSync(join(tmpdir(), "ka-layout-"));
  const ini = readFileSync(join(SEED, "reaper.ini"), "latin1").split(/\r?\n/)
    .filter((l) => !/^(lastproject|lastprojuiref|faultyproject|recent\d+|projecttab\d+)=/i.test(l)).join("\n");
  writeFileSync(join(res, "reaper.ini"), ini + extraIni, "latin1");
  if (existsSync(join(SEED, "reaper-reginfo2.ini"))) copyFileSync(join(SEED, "reaper-reginfo2.ini"), join(res, "reaper-reginfo2.ini"));
  mkdirSync(join(res, "Scripts"));
  if (startup) writeFileSync(join(res, "Scripts", "__startup.lua"), startup);
  const bridge = join(res, "bridge");
  mkdirSync(bridge);
  cfg = join(res, "reaper.ini");
  proc = spawn(REAPER, ["-newinst", "-nosplash", "-new", "-cfgfile", cfg, BRIDGE], { stdio: "ignore", env: { ...process.env, REAPER_ASSIST_BRIDGE_DIR: bridge } });
  for (let i = 0; i < 80 && !existsSync(join(bridge, "status.json")); i++) await new Promise((d) => setTimeout(d, 250));
  const r = new ReaperConnection(bridge);
  expect((await r.status()).state).toBe("connected");
  return { res, r };
}

const plan = (res: string) => ({
  side: "left" as const, width: 320, startDir: res, shortcuts: [{ path: res, title: "Throwaway" }], defaults: DEFAULT_SHORTCUTS(),
});

run("live browser layout (throwaway REAPER + bridge)", () => {
  it("docks Media Explorer + FX Browser on the left and keeps the mixer docked", async () => {
    const { res, r } = await start("");
    const out = await r.setupWorkspace(plan(res));
    expect(out.ok, out.message).toBe(true);
    expect(out.data).toMatchObject({ side: "left", explorerDocked: true, fxBrowserDocked: true, mixerDocked: true });
    const ini = readFileSync(join(res, "reaper.ini"), "latin1");
    expect(ini).toMatch(/^Shortcut0=.*ka-layout-/m);
    expect(ini).toMatch(new RegExp(`^dockersel${out.data!.docker}=explorer$`, "m"));
  }, 60000);

  it("moves an explorer docked with the mixer into its own docker", async () => {
    const { res, r } = await start("\n[reaper_sexplorer]\ndocked=1\n\n[REAPERdockpref]\nexplorer=0.5 0\n", "reaper.OpenMediaExplorer('', false)\n");
    const out = await r.setupWorkspace(plan(res));
    expect(out.ok, out.message).toBe(true);
    expect(out.data).toMatchObject({ side: "left", explorerDocked: true });
    expect(out.data!.docker).not.toBe(0);
  }, 60000);

  it("Ableton layout: transport on top, track headers on the right, an open MIDI editor docked", async () => {
    // A MIDI item open in a floating MIDI editor.
    const startup = [
      "reaper.InsertTrackAtIndex(0, false)",
      "local it = reaper.CreateNewMIDIItemInProj(reaper.GetTrack(0, 0), 0, 4, false)",
      "reaper.SetMediaItemSelected(it, true)",
      "reaper.Main_OnCommand(40153, 0)",
      "reaper.defer(function() local ed = reaper.MIDIEditor_GetActive(); if ed and reaper.DockIsChildOfDock(ed) ~= -1 then reaper.MIDIEditor_OnCommand(ed, 40018) end end)",
    ].join("\n");
    const { res, r } = await start("", startup);
    const out = await r.setupWorkspace({ ...plan(res), transport: "top", tcpRight: true, midiDocked: true });
    expect(out.ok, out.message).toBe(true);
    expect(out.data).toMatchObject({ side: "left", explorerDocked: true, transportTop: true, tcpRight: true, midiEditorDocked: true });
    expect(readFileSync(join(res, "reaper.ini"), "latin1")).toMatch(/^\[midiedit\][^[]*^dock=1$/m);
  }, 60000);

  it("Cubase-style layout, then Restore puts every window back", async () => {
    const startup = [
      "reaper.SetMediaTrackInfo_Value(reaper.GetMasterTrack(0), 'B_MUTE', 1)",
      "reaper.InsertTrackAtIndex(0, false)",
      "local it = reaper.CreateNewMIDIItemInProj(reaper.GetTrack(0, 0), 0, 4, false)",
      "reaper.SetMediaItemSelected(it, true)",
    ].join("\n");
    const { res, r } = await start("", startup);
    const out = await r.setupWorkspace({ ...plan(res), side: "right", transport: "bottom", tcpRight: true, midiDocked: true });
    expect(out.ok, out.message).toBe(true);
    expect(out.data).toMatchObject({ side: "right", explorerDocked: true, transport: "bottom", tcpRight: true });
    const back = await r.restoreLayout({ transport: "below", tcpRight: false, explorerOpen: false, fxBrowserOpen: false, mixerVisible: true, mixerDocked: true, midiDocked: false });
    expect(back.ok, back.message).toBe(true);
    expect(back.data).toMatchObject({ transport: "below", tcpRight: false, explorerOpen: false, fxBrowserOpen: false, mixerVisible: true, mixerDocked: true });
    expect(readFileSync(join(res, "reaper.ini"), "latin1")).toMatch(/^\[midiedit\][^[]*^dock=0$/m);
  }, 60000);

  it("Restore undocks an open MIDI editor and hides a transport that was hidden", async () => {
    const startup = [
      "reaper.SetMediaTrackInfo_Value(reaper.GetMasterTrack(0), 'B_MUTE', 1)",
      "reaper.InsertTrackAtIndex(0, false)",
      "local it = reaper.CreateNewMIDIItemInProj(reaper.GetTrack(0, 0), 0, 4, false)",
      "reaper.SetMediaItemSelected(it, true)",
      "reaper.Main_OnCommand(40153, 0)",
      "reaper.defer(function() local ed = reaper.MIDIEditor_GetActive(); if ed and reaper.DockIsChildOfDock(ed) == -1 then reaper.MIDIEditor_OnCommand(ed, 40018) end end)",
    ].join("\n");
    const { r } = await start("", startup);
    await new Promise((d) => setTimeout(d, 800));
    const back = await r.restoreLayout({ transport: "hidden", midiDocked: false });
    expect(back.ok, back.message).toBe(true);
    expect(back.data).toMatchObject({ transport: "hidden", midiEditorDocked: false });
    const again = await r.restoreLayout({ transport: "below" });
    expect(again.data).toMatchObject({ transport: "below" });
  }, 60000);

  it("refuses safely when the explorer was opened floating this session", async () => {
    const { res, r } = await start("\n[reaper_sexplorer]\ndocked=0\n", "reaper.OpenMediaExplorer('', false)\n");
    const out = await r.setupWorkspace(plan(res));
    expect(out.ok).toBe(false);
    expect(out.message).toMatch(/floating/);
    const probe = await r.status();
    expect(probe.state).toBe("connected");
  }, 60000);
});
