import { describe, expect, it } from "vitest";
import { DEFAULT_SHORTCUTS, workspaceIni, type WorkspacePlan } from "@profiles/engine/workspace";

const HOME = "/Users/test";
const plan: WorkspacePlan = {
  side: "left",
  width: 320,
  startDir: "/Lib/Kitroom",
  shortcuts: [{ path: "/Lib/Kitroom", title: "Kitroom" }, { path: `${HOME}/Music`, title: "Music" }],
};
const section = (ini: string, name: string) => {
  const m = new RegExp(`^\\[${name}\\]\\r?\\n([\\s\\S]*?)(?=^\\[|(?![\\s\\S]))`, "mi").exec(ini);
  return Object.fromEntries((m?.[1] ?? "").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
};
const BASE = "[audioconfig]\r\nmode=3\r\n\r\n[reaper]\r\nleftpanewid=427\r\nmixwnd_dock=0\r\nfoo=bar\r\n\r\n[Recent]\r\nrecent01=/x.RPP\r\n";

// Profiles no longer change REAPER's layout; this module stays for its ini helpers and the layout keys Restore REAPER knows.
describe("browser + mixer workspace (reaper.ini)", () => {
  it("docks the Media Explorer and FX Browser together on the left, mixer docked", () => {
    const out = workspaceIni(BASE, plan, HOME, DEFAULT_SHORTCUTS(HOME, "darwin"));
    const r = section(out, "reaper");
    expect(r).toMatchObject({ dockermode1: "1", dockheight_l: "320", dockersel1: "explorer", fxadd_vis: "1", fxadd_dock: "1", mixwnd_dock: "1", mixwnd_vis: "1" });
    expect(section(out, "REAPERdockpref")).toEqual({ explorer: "0.1 1", fxbrowser: "0.2 1" });
    const mx = section(out, "reaper_sexplorer");
    expect(mx).toMatchObject({ docked: "1", visible: "1", lastdir: "/Lib/Kitroom", Shortcut0: "/Lib/Kitroom", ShortcutT0: "Kitroom", Shortcut1: `${HOME}/Music` });
    // A new list keeps REAPER's own default shortcuts after ours.
    expect(Number(mx.NbShortcuts)).toBe(7);
    expect(mx.Shortcut6).toBe(`${HOME}/Documents`);
  });

  it("transport on top, track headers on the right, MIDI editor docked", () => {
    const out = workspaceIni(BASE.replace("foo=bar", "mixerflag=4"), { ...plan, transport: "top", tcpRight: true, midiDocked: true }, HOME, []);
    // mixerflag &32 = "Show TCP on right side of arrange"; other bits kept.
    expect(section(out, "reaper")).toMatchObject({ transport_vis: "1", transport_dock: "1", transport_dock_pos: "3", mixerflag: "36" });
    expect(section(out, "midiedit")).toMatchObject({ dock: "1" });
    // Profiles that don't ask for them leave those keys alone.
    const plain = section(workspaceIni(BASE, plan, HOME, []), "reaper");
    expect(plain.transport_dock_pos).toBeUndefined();
    expect(plain.mixerflag).toBeUndefined();
    expect(section(workspaceIni(BASE, plan, HOME, []), "midiedit").dock).toBeUndefined();
  });

  it("leaves a never-saved shortcut list alone where REAPER's defaults are unknown", () => {
    expect(DEFAULT_SHORTCUTS(HOME, "win32")).toEqual([]);
    const mx = section(workspaceIni(BASE, plan, HOME, []), "reaper_sexplorer");
    expect(mx.NbShortcuts).toBeUndefined();
    expect(mx).toMatchObject({ docked: "1", lastdir: "/Lib/Kitroom" });
  });

  it("keeps everything else byte for byte and is stable when applied twice", () => {
    const once = workspaceIni(BASE, plan, HOME);
    expect(workspaceIni(once, plan, HOME)).toBe(once);
    expect(once).toContain("[audioconfig]\r\nmode=3\r\n");
    expect(once).toContain("leftpanewid=427\r\n");
    expect(once).toContain("foo=bar");
    expect(once).toContain("[Recent]\r\nrecent01=/x.RPP");
    expect(once).not.toMatch(/(?<!\r)\n/); // CRLF stays CRLF
  });

  it("keeps the user's own shortcuts and adds only missing ones", () => {
    const ini = `${BASE}\r\n[reaper_sexplorer]\r\nNbShortcuts=2\r\nShortcut0=/Samples\r\nShortcutT0=My samples\r\nShortcut1=/Lib/Kitroom/\r\nShortcutT1=Kit\r\n`;
    const mx = section(workspaceIni(ini, plan, HOME), "reaper_sexplorer");
    expect(mx).toMatchObject({ NbShortcuts: "3", Shortcut0: "/Samples", ShortcutT0: "My samples", Shortcut1: "/Lib/Kitroom/", Shortcut2: `${HOME}/Music` });
  });

  it("uses a docker no other window is in", () => {
    const ini = `${BASE}\r\n[REAPERdockpref]\r\nmixer=0.5 0\r\nactions=0.3 1\r\nregmgr=0.2 2\r\n`;
    const out = workspaceIni(ini, plan, HOME);
    expect(section(out, "REAPERdockpref")).toMatchObject({ explorer: "0.1 3", fxbrowser: "0.2 3", actions: "0.3 1" });
    expect(section(out, "reaper")).toMatchObject({ dockermode3: "1", dockersel3: "explorer" });
  });

  it("puts the transport along the bottom of the main window", () => {
    expect(section(workspaceIni(BASE, { ...plan, transport: "bottom" }, HOME, []), "reaper")).toMatchObject({ transport_dock: "1", transport_dock_pos: "2" });
  });
});
