import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { installShortcuts } from "@profiles/engine/theme";
import { captureOriginal, ensureOriginal, fallbackOriginal, layoutTargets, markRestored, restoreFiles, restoreIni, restoreKb } from "@profiles/engine/restore";
import { workspaceIni, type WorkspacePlan } from "@profiles/engine/workspace";
import { WORKFLOWS, profileKbLines } from "@profiles";

const HOME = "/Users/test";
const BASE = [
  "[audioconfig]", "mode=3", "",
  "[reaper]", "leftpanewid=427", "lastthemefn5=/R/ColorThemes/Mine.ReaperThemeZip", "mixerflag=4", "mixwnd_dock=1", "mixwnd_vis=1", "dockermode2=0", "foo=bar", "",
  "[REAPERdockpref]", "actions=0.3 2", "",
  "[Recent]", "recent01=/x.RPP", "",
].join("\r\n");
const plan = (p: Partial<WorkspacePlan> = {}): WorkspacePlan => ({ side: "left", width: 320, startDir: "/Lib/Kitroom", shortcuts: [{ path: "/Lib/Kitroom", title: "Kitroom" }], ...p });
const keys = (ini: string, name: string) => {
  const m = new RegExp(`^\\[${name}\\]\\r?\\n([\\s\\S]*?)(?=^\\[|(?![\\s\\S]))`, "mi").exec(ini);
  return m ? Object.fromEntries(m[1]!.split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])) : undefined;
};
const ableton = WORKFLOWS.find((w) => w.id === "ableton")!;
const fl = WORKFLOWS.find((w) => w.id === "fl")!;

describe("Restore REAPER: layout", () => {
  it("puts back exactly what a profile changed", () => {
    const o = captureOriginal(BASE, null, "/R");
    o.folders = ["/Lib/Kitroom"];
    const changed = workspaceIni(BASE.replace("mixerflag=4", "mixerflag=4"), plan({ transport: "top", tcpRight: true, midiDocked: true }), HOME, []);
    expect(keys(changed, "reaper")).toMatchObject({ transport_dock_pos: "3", mixerflag: "36" });
    expect(restoreIni(changed, o, { home: HOME })).toBe(BASE);
  });

  it("keeps what the user changed since, and only touches Assist's docker", () => {
    const o = captureOriginal(BASE, null, "/R");
    let changed = workspaceIni(BASE, plan({ tcpRight: true }), HOME, []);
    // Later the user resized their own docker 2, turned on another mixer flag and added a folder.
    changed = changed.replace("dockermode2=0", "dockermode2=3").replace("mixerflag=36", "mixerflag=37")
      .replace("lastdir=/Lib/Kitroom", "lastdir=/Lib/Kitroom\r\nNbShortcuts=2\r\nShortcut0=/Lib/Kitroom\r\nShortcutT0=Kitroom\r\nShortcut1=/Mine\r\nShortcutT1=Mine");
    o.folders = ["/Lib/Kitroom"];
    const back = restoreIni(changed, o, { home: HOME });
    expect(keys(back, "reaper")).toMatchObject({ dockermode2: "3", mixerflag: "5" });
    expect(keys(back, "reaper")!.dockermode1).toBeUndefined();
    expect(keys(back, "reaper_sexplorer")).toMatchObject({ NbShortcuts: "1", Shortcut0: "/Mine" });
  });

  it("switching profiles starts from the user's own layout, but keeps a theme chosen meanwhile", () => {
    const o = captureOriginal(BASE, null, "/R");
    const abl = workspaceIni(BASE, plan({ transport: "top", tcpRight: true, midiDocked: true }), HOME, []).replace("Mine.ReaperThemeZip", "Assist - X.ReaperThemeZip");
    const cubase = workspaceIni(restoreIni(abl, o, { keepTheme: true, home: HOME }), plan({ side: "right", transport: "bottom", midiDocked: true }), HOME, []);
    const r = keys(cubase, "reaper")!;
    expect(r).toMatchObject({ transport_dock_pos: "2", mixerflag: "4", dockermode1: "3", lastthemefn5: "/R/ColorThemes/Assist - X.ReaperThemeZip" });
  });

  it("without a record, goes back to REAPER's defaults for what profiles change", () => {
    const owner = BASE.replace("lastthemefn5=/R/ColorThemes/Mine.ReaperThemeZip", "lastthemefn5=/R/ColorThemes/Assist - FL Studio feel.ReaperThemeZip").replace("mixerflag=4", "mixerflag=36")
      + "[reaper_sexplorer]\r\nvisible=1\r\ndocked=1\r\n\r\n[midiedit]\r\ndock=1\r\n";
    const changed = owner.replace("foo=bar", "foo=bar\r\ntransport_dock=1\r\ntransport_dock_pos=3\r\nfxadd_vis=1\r\ndockheight=628\r\nleftpanewid=158\r\ndockheight_r=410\r\ndockermode3=3\r\ndockersel3=explorer")
      .replace("actions=0.3 2", "actions=0.3 2\r\nexplorer=0.1 3\r\nfxbrowser=0.2 3")
      .replace("docked=1\r\n", `docked=1\r\nNbShortcuts=3\r\nShortcut0=/Lib/Kitroom\r\nShortcutT0=Kitroom\r\nShortcut1=${HOME}/Music\r\nShortcutT1=Music\r\nShortcut2=/\r\nShortcutT2=/\r\n`);
    const o = fallbackOriginal(changed, null, null, "/R/ColorThemes/Default_7.0.ReaperThemeZip", "/R", new Date(), ["/Lib/Kitroom", `${HOME}/Music`]);
    const back = restoreIni(changed, o, { home: HOME });
    const r = keys(back, "reaper")!;
    expect(r).toMatchObject({ lastthemefn5: "/R/ColorThemes/Default_7.0.ReaperThemeZip", mixerflag: "4", fxadd_vis: "0" });
    expect(r.transport_dock_pos).toBeUndefined();
    // Sizes and dockers REAPER changed while the browser was docked go back to REAPER's defaults too.
    for (const k of ["dockheight", "leftpanewid", "dockheight_r", "dockermode3", "dockersel3"]) expect(r[k], k).toBeUndefined();
    expect(r.dockermode2).toBe("0"); // the user's own docker
    expect(keys(back, "REAPERdockpref")).toEqual({ actions: "0.3 2" });
    // Assist's folders go; only REAPER's own default ("/") was left, so the list goes back to never-saved.
    expect(keys(back, "reaper_sexplorer")).toEqual({ visible: "0" });
    expect(keys(back, "midiedit")).toBeUndefined();
    expect(layoutTargets(o)).toEqual({ transport: "below", tcpRight: false, explorerOpen: false, fxBrowserOpen: false, mixerVisible: true, mixerDocked: true, midiDocked: false });
  });

  it("reads where the transport was", () => {
    const at = (extra: string) => layoutTargets(captureOriginal(BASE.replace("foo=bar", extra), null, "/R")).transport;
    expect(at("foo=bar")).toBe("below");
    expect(at("transport_dock=1\r\ntransport_dock_pos=2")).toBe("bottom");
    expect(at("transport_dock=0\r\ntransport_dock_pos=768")).toBeUndefined();
    expect(at("transport_vis=0")).toBe("hidden");
  });
});

describe("Restore REAPER: shortcuts", () => {
  const user = 'SCR 4 0 RSabc "Custom: lyrics.lua" Cockos/lyrics.lua\r\nKEY 1 82 1068 0\r\n';

  it("takes Assist's lines out and puts the user's own back in their slots", () => {
    const now = user.replace("KEY 1 82 1068 0\r\n", "") + profileKbLines(fl).join("\r\n") + "\r\nKEY 1 77 40001 0\r\n";
    expect(restoreKb(now, user)).toBe('SCR 4 0 RSabc "Custom: lyrics.lua" Cockos/lyrics.lua\r\nKEY 1 77 40001 0\r\nKEY 1 82 1068 0\r\n');
  });

  it("removes a file Assist created when nothing else is in it", () => {
    expect(restoreKb(profileKbLines(ableton).join("\r\n"), null)).toBeNull();
  });

  it("switching profiles leaves only the new profile's keys", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ka-switch-"));
    writeFileSync(join(dir, "reaper-kb.ini"), user);
    await installShortcuts(dir, fl, new Date(), user);
    await installShortcuts(dir, ableton, new Date(), user);
    const kb = readFileSync(join(dir, "reaper-kb.ini"), "latin1");
    expect(kb).toContain("KEY 1 9 40078 0");
    expect(kb).toContain("KEY 1 9 40401 32060"); // Tab from the MIDI editor too
    expect(kb).not.toContain("KEY 1 120 40078 0"); // FL's F9
    expect(kb).toContain("KEY 1 82 1068 0"); // the user's own R (FL had taken it)
    expect(kb).toContain("Custom: lyrics.lua");
  });
});

describe("Restore REAPER: the record", () => {
  it("records a clean REAPER as it is, and REAPER's defaults when Assist changed it before", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ka-orig-"));
    const res = mkdtempSync(join(tmpdir(), "ka-res-"));
    writeFileSync(join(res, "reaper.ini"), BASE);
    const o = await ensureOriginal(dir, res, false);
    expect(o.fallback).toBe(false);
    expect(o.ini["reaper\tlastthemefn5"]).toBe("/R/ColorThemes/Mine.ReaperThemeZip");
    expect((await ensureOriginal(dir, res, true)).takenAt).toBe(o.takenAt); // kept, not re-taken

    const dir2 = mkdtempSync(join(tmpdir(), "ka-orig-"));
    writeFileSync(join(res, "reaper-kb.ini"), profileKbLines(fl).join("\r\n"));
    expect((await ensureOriginal(dir2, res, false)).fallback).toBe(true);

    // After a restore, REAPER is as it was: the next change records it afresh.
    await restoreFiles(res, o);
    await markRestored(dir, o);
    const again = await ensureOriginal(dir, res, true);
    expect(again.fallback).toBe(false);
    expect(again.restoredAt).toBeUndefined();
  });
});
