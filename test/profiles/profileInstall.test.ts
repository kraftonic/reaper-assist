import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WORKFLOWS, mouseSlot, profileKbLines, profileTouches, type Workflow } from "@profiles";
import { REAPER_DEFAULTS, applyPrefs, layoutIni, menuSections, mouseValues, setMenuSections, setMouseValues, toolbarLines } from "@profiles/engine/files";
import { installProfile } from "@profiles/engine/install";
import { defaultsOriginal, ensureOriginal, restoreFiles } from "@profiles/engine/restore";

describe("reaper-mouse.ini", () => {
  it("creates the file the way REAPER does and keeps it sparse", () => {
    const t = setMouseValues(null, { "MM_CTX_MIDI_RMOUSE\t0": "10 m" });
    expect(t).toMatch(/^\[hasimported\]\nMM_CTX_ARRANGE_MMOUSE=1\n/);
    expect(t).toContain("[MM_CTX_MIDI_RMOUSE]\nmm_0=10 m");
    expect(mouseValues(t, ["MM_CTX_MIDI_RMOUSE\t0", "MM_CTX_ITEM\t2"])).toEqual({ "MM_CTX_MIDI_RMOUSE\t0": "10 m", "MM_CTX_ITEM\t2": null });
    // Back to the default: the key goes, and the then-empty section with it.
    const back = setMouseValues(t, { "MM_CTX_MIDI_RMOUSE\t0": null });
    expect(back).not.toContain("MM_CTX_MIDI_RMOUSE]");
    expect(back).toContain("[hasimported]");
  });

  it("numbers modifier slots like REAPER (shift 1, cmd 2, opt 4, control 8)", () => {
    expect(mouseSlot("MM_CTX_ITEM", [])).toBe("MM_CTX_ITEM\t0");
    expect(mouseSlot("MM_CTX_ITEM", ["cmd", "opt"])).toBe("MM_CTX_ITEM\t6");
    expect(mouseSlot("MM_CTX_ITEM", ["ctrl", "shift"])).toBe("MM_CTX_ITEM\t9");
  });
});

describe("reaper-menu.ini", () => {
  it("writes toolbars with no gaps, icons and toggle highlights", () => {
    expect(toolbarLines({ section: "Main toolbar", title: "Tools", items: [
      { action: 40023, label: "New project" },
      { action: "-", label: "" },
      { action: "_RS_assist_fl_draw", label: "Draw", icon: "assist_fl_draw", toggle: true },
      { action: 1068, label: "Loop", icon: "text" },
    ] })).toEqual(["item_0=40023 New project", "item_1=-1", "item_2=_RS_assist_fl_draw Draw", "icon_2=assist_fl_draw.png", "tbf_2=1", "item_3=1068 Loop", "icon_3=text", "title=Tools"]);
  });

  it("replaces and removes whole sections, keeping the rest", () => {
    const text = "[Main toolbar]\nitem_0=40023 New\n\n[Media item context]\nitem_0=40001 X\n";
    const next = setMenuSections(text, { "Main toolbar": ["item_0=1007 Play"], "MIDI piano roll toolbar": ["item_0=40001 Y"] });
    expect(menuSections(next, ["Main toolbar", "Media item context", "MIDI piano roll toolbar", "Floating toolbar 9"])).toEqual({
      "Main toolbar": ["item_0=1007 Play"], "Media item context": ["item_0=40001 X"], "MIDI piano roll toolbar": ["item_0=40001 Y"], "Floating toolbar 9": null,
    });
    expect(setMenuSections(next, { "Main toolbar": ["item_0=40023 New"], "MIDI piano roll toolbar": null })).toBe(text);
  });
});

describe("reaper.ini preferences and layout", () => {
  it("changes only a preference's own bits", () => {
    const t = applyPrefs("[REAPER]\nviewadvance=6\nzoommode=0\n", [
      { key: "viewadvance", value: 17, bits: 17, does: "" },
      { key: "zoommode", value: 3, does: "" },
      { key: "projmetroen", value: 0, bits: 8, does: "" },
    ]);
    expect(t).toContain("viewadvance=23");
    expect(t).toContain("zoommode=3");
    expect(t).toContain("projmetroen=6"); // missing: REAPER's default 6, bit 8 already off
  });

  it("knows REAPER's default for every bit-field preference a profile changes", () => {
    // Without it, a key missing from reaper.ini would start from 0 and lose REAPER's other default bits.
    // Measure the default in a fresh REAPER (get_config_var_string) and add it to REAPER_DEFAULTS.
    const missing = Object.keys(profileTouches().bits).filter((k) => !(k in REAPER_DEFAULTS));
    expect(missing).toEqual([]);
  });

  it("starts a bit field missing from reaper.ini from REAPER's own default", () => {
    // autoxfade defaults to 129: the profile's two bits change, REAPER's bit 128 stays.
    expect(applyPrefs("[REAPER]\nzoommode=0\n", [{ key: "autoxfade", value: 2, bits: 3, does: "" }])).toContain("autoxfade=130");
    expect(applyPrefs("[REAPER]\n", [{ key: "viewadvance", value: 0, bits: 1, does: "" }])).toContain("viewadvance=2");
  });

  it("places the transport, track panel, mixer, MIDI editor and browser", () => {
    const t = layoutIni("[REAPER]\nmixerflag=2\n\n[REAPERdockpref]\nmastermixer=0.50000000 1\n", {
      transport: "bottom", tcp: "right", tcpWidth: 300, mixer: "window", midiEditor: "docked", browser: { side: "right", width: 320, tabs: ["fxbrowser", "explorer"] },
    }, { startDir: "/samples", shortcuts: [{ path: "/samples", title: "Samples" }], defaults: [] });
    for (const l of ["transport_dock_pos=2", "mixerflag=34", "leftpanewid=300", "mixwnd_vis=1", "mixwnd_dock=0", "dockermode2=3", "dockheight_r=320", "dockersel2=fxbrowser", "fxbrowser=0.10000000 2", "explorer=0.20000000 2", "lastdir=/samples"]) expect(t).toContain(l);
    expect(t).toMatch(/\[midiedit\]\ndock=1/);
  });

  it("sets the MIDI editor's note colours (and only when asked)", () => {
    const base = { transport: "top", tcp: "left", mixer: "docked", midiEditor: "docked" } as const;
    const ex = { startDir: "/s", shortcuts: [], defaults: [] };
    expect(layoutIni("[REAPER]\n", { ...base, midiNoteColor: "track" }, ex)).toMatch(/\[midiedit\][^[]*colorwhat=4/);
    expect(layoutIni("[REAPER]\n", { ...base, midiNoteColor: "item" }, ex)).toMatch(/\[midiedit\][^[]*colorwhat=5/);
    expect(layoutIni("[REAPER]\n[midiedit]\ncolorwhat=2\n", base, ex)).toContain("colorwhat=2");
  });

  it("gives a floating mixer a usable size the first time", () => {
    const t = layoutIni("[REAPER]\nwnd_x=10\nwnd_y=20\nwnd_w=2000\nwnd_h=1200\nmixwnd_w=0\nmixwnd_h=320\n", { mixer: "window" });
    expect(t).toMatch(/mixwnd_dock=0/);
    expect(t).toMatch(/mixwnd_x=10\n/);
    expect(t).toMatch(/mixwnd_y=20\n/);
    expect(t).toMatch(/mixwnd_w=2000\n/);
    expect(t).toMatch(/mixwnd_h=540\n/);
    // A size the user (or REAPER) already gave it stays.
    expect(layoutIni("[REAPER]\nmixwnd_w=1500\nmixwnd_h=700\n", { mixer: "window" })).toMatch(/mixwnd_w=1500\nmixwnd_h=700/);
  });

  it("puts the FX browser and the Media Explorer in dockers on opposite sides", () => {
    const t = layoutIni("[REAPER]\n", { browser: [{ side: "left", width: 250, tabs: ["fxbrowser"] }, { side: "right", width: 330, tabs: ["explorer"] }] });
    for (const l of ["dockermode1=1", "dockheight_l=250", "dockersel1=fxbrowser", "fxbrowser=0.10000000 1", "dockermode2=3", "dockheight_r=330", "dockersel2=explorer", "explorer=0.10000000 2"]) expect(t).toContain(l);
  });
});

/* ------------------------------------------------- install → switch → restore */

/** A profile with nothing but what each test gives it (the real profiles keep changing). */
const bare = (w: Workflow): Workflow => ({ id: w.id, daw: w.daw, blurb: w.blurb, reaper: w.reaper, panels: w.panels, panel: w.panel, shortcuts: [], glossary: w.glossary });

const TEST_A: Workflow = {
  ...bare(WORKFLOWS[0]!),
  scripts: [{ id: "RS_assist_test_tool", file: "test_tool.lua", name: "Test tool" }],
  macros: [{ id: "assist_test_macro", name: "Test macro", actions: [40001, 40002] }],
  shortcuts: [{ mods: [], key: "K", action: "_RS_assist_test_tool", does: "tool" }, { mods: ["cmd"], key: "=", action: 40078, does: "mixer" }],
  mouse: [{ ctx: "MM_CTX_MIDI_RMOUSE", mods: [], value: "10 m", does: "right-click deletes" }, { ctx: "MM_CTX_ITEM", mods: ["cmd"], value: "2 m", does: "copy" }],
  prefs: [{ key: "viewadvance", value: 17, bits: 17, does: "follow" }, { key: "zoommode", value: 3, does: "zoom at mouse" }],
  toolbars: [{ section: "Main toolbar", items: [{ action: "_RS_assist_test_tool", label: "Tool", icon: "assist_test" }] }],
  layout: { transport: "top", tcp: "right", mixer: "hidden", midiEditor: "docked", midiNoteColor: "track", browser: { side: "left", width: 300, tabs: ["explorer", "fxbrowser"] } },
  startup: ["_RS_assist_test_tool", 40001],
};
const BRIDGE = '-- >>> REAPER Assist bridge (added by REAPER Assist; remove this block to stop autostart)\ndofile(reaper.GetResourcePath() .. "/Scripts/ReaperAssist/assist_bridge.lua")\n-- <<< REAPER Assist bridge\n';
const TEST_B: Workflow = {
  ...bare(WORKFLOWS[1]!),
  mouse: [{ ctx: "MM_CTX_ITEM_DBLCLK", mods: [], value: "6 m", does: "open" }],
  prefs: [{ key: "zoommode", value: 2, does: "" }],
  toolbars: [{ section: "MIDI piano roll toolbar", items: [{ action: 40001, label: "X" }] }],
  layout: { transport: "bottom", tcp: "left", mixer: "docked", midiEditor: "window" },
};

describe("installing and restoring a profile", () => {
  const saved = WORKFLOWS.slice();
  beforeAll(() => WORKFLOWS.splice(0, 2, TEST_A, TEST_B));
  afterAll(() => WORKFLOWS.splice(0, WORKFLOWS.length, ...saved));

  it("touches only what profiles declare", () => {
    const t = profileTouches([TEST_A, TEST_B]);
    expect(t.bits).toEqual({ mixerflag: 32, viewadvance: 17 });
    expect(t.ini.sort()).toEqual(["viewadvance", "zoommode"]);
    expect(t.mouse.sort()).toEqual(["MM_CTX_ITEM\t2", "MM_CTX_ITEM_DBLCLK\t0", "MM_CTX_MIDI_RMOUSE\t0"]);
    expect(t.menus.sort()).toEqual(["MIDI piano roll toolbar", "Main toolbar"]);
  });

  it("puts every file back exactly as it was", async () => {
    const res = mkdtempSync(join(tmpdir(), "ka-profile-"));
    const dir = mkdtempSync(join(tmpdir(), "ka-record-"));
    const scripts = mkdtempSync(join(tmpdir(), "ka-scripts-"));
    writeFileSync(join(scripts, "test_tool.lua"), "-- tool\n");
    const files = {
      "reaper.ini": "[REAPER]\nlastthemefn5=/x/Mine.ReaperThemeZip\nviewadvance=6\nzoommode=0\nmixerflag=2\ntransport_dock_pos=0\n\n[REAPERdockpref]\nmastermixer=0.50000000 1\n\n[reaper_sexplorer]\nlastdir=/home\n",
      "reaper-kb.ini": "KEY 1 75 40044 0\nSCR 4 0 RS1234 \"Custom: mine\" \"mine.lua\"\n",
      "reaper-mouse.ini": "[hasimported]\nMM_CTX_ITEM=1\n\n[MM_CTX_ITEM]\nmm_2=36 m\n\n[MM_CTX_MIDI_NOTE_CLK]\nmm_0=1 m\nmm_4=2 m\n",
      "reaper-menu.ini": "[Main toolbar]\nitem_0=40023 New project...\nicon_0=toolbar_new.png\n\n[Media item context]\nitem_0=40001 Mine\n",
      "Scripts/__startup.lua": `-- mine\nreaper.ShowConsoleMsg("hi")\n\n${BRIDGE}`,
    };
    mkdirSync(join(res, "Scripts"));
    for (const [n, t] of Object.entries(files)) writeFileSync(join(res, n), t);
    mkdirSync(join(res, "Data", "toolbar_icons"), { recursive: true });
    writeFileSync(join(res, "Data", "toolbar_icons", "mine.png"), "user icon");

    const o = await ensureOriginal(dir, res, false);
    const icon = new Uint8Array([137, 80, 78, 71]);
    const opts = { theme: "/x/Assist - A.ReaperThemeZip", scriptsDir: scripts, icons: new Map([["assist_test.png", icon], ["200/assist_test.png", icon]]) };
    await installProfile(res, TEST_A, o, opts);

    const read = (n: string) => readFileSync(join(res, n), "latin1");
    expect(read("reaper.ini")).toContain("lastthemefn5=/x/Assist - A.ReaperThemeZip");
    expect(read("reaper.ini")).toContain("viewadvance=23");
    expect(read("reaper.ini")).toContain("mixerflag=34");
    expect(read("reaper-kb.ini")).toContain(profileKbLines(TEST_A, "mac").join("\r\n"));
    expect(read("reaper-kb.ini")).toContain("KEY 8 61 40078 0");
    expect(read("reaper-kb.ini")).toContain("KEY 1 75 _RS_assist_test_tool 0");
    expect(read("reaper-kb.ini")).not.toContain("KEY 1 75 40044 0"); // replaced by ours for now
    expect(read("reaper-mouse.ini")).toContain("[MM_CTX_MIDI_RMOUSE]\nmm_0=10 m");
    expect(read("reaper-mouse.ini")).toContain("[MM_CTX_ITEM]\nmm_2=2 m");
    expect(read("reaper-menu.ini")).toContain("item_0=_RS_assist_test_tool Tool");
    expect(read("reaper-menu.ini")).toContain("[Media item context]\nitem_0=40001 Mine");
    expect(read("Scripts/ReaperAssist/Profile/test_tool.lua")).toBe("-- tool\n");
    expect(existsSync(join(res, "Data/toolbar_icons/200/assist_test.png"))).toBe(true);
    // Start-up: the user's lines and the bridge block stay; the profile block runs Profile/startup.lua.
    expect(read("Scripts/__startup.lua")).toMatch(/^-- mine\n[^]*assist_bridge\.lua[^]*REAPER Assist profile[^]*Profile\/startup\.lua/);
    expect(read("Scripts/ReaperAssist/Profile/startup.lua")).toContain('{ "_RS_assist_test_tool", 40001 }');

    // Switching profiles leaves nothing of the first one behind.
    await installProfile(res, TEST_B, o, { ...opts, theme: "/x/Assist - B.ReaperThemeZip", icons: new Map() });
    expect(read("reaper.ini")).toContain("viewadvance=6");
    expect(read("reaper.ini")).toContain("zoommode=2");
    expect(read("reaper.ini")).toContain("mixerflag=2\n");
    expect(read("reaper-mouse.ini")).not.toContain("MM_CTX_MIDI_RMOUSE");
    expect(read("reaper-mouse.ini")).toContain("[MM_CTX_ITEM]\nmm_2=36 m");
    expect(read("reaper-menu.ini")).toContain("item_0=40023 New project...");
    expect(read("reaper-kb.ini")).not.toContain("assist_");
    expect(existsSync(join(res, "Scripts/ReaperAssist/Profile"))).toBe(false);
    expect(existsSync(join(res, "Data/toolbar_icons/assist_test.png"))).toBe(false);
    expect(read("Scripts/__startup.lua")).not.toContain("REAPER Assist profile");

    await installProfile(res, TEST_A, o, opts);
    await restoreFiles(res, o);
    for (const [n, t] of Object.entries(files)) {
      if (n === "reaper.ini") {
        // REAPER's own keys come back; the dock preferences Assist added for its browser are gone.
        for (const l of t.split("\n").filter(Boolean)) expect(read(n)).toContain(l);
        expect(read(n)).not.toMatch(/explorer=|fxbrowser=|transport_dock=|midiedit/);
      } else if (n === "reaper-kb.ini") {
        // Same lines (a user line Assist had replaced comes back at the end; REAPER doesn't mind the order).
        expect(read(n).split(/\r?\n/).filter(Boolean).sort()).toEqual(t.split("\n").filter(Boolean).sort());
      } else expect(read(n).replace(/\r\n/g, "\n"), n).toBe(t);
    }
    expect(read("Data/toolbar_icons/mine.png")).toBe("user icon");
  });

  it("takes Assist's themes out of ColorThemes and keeps the user's", async () => {
    const res = mkdtempSync(join(tmpdir(), "ka-profile-"));
    mkdirSync(join(res, "ColorThemes"));
    const theme = (n: string) => join(res, "ColorThemes", n);
    for (const n of ["Mine.ReaperThemeZip", "Assist - A feel.ReaperThemeZip", "Assist - B colours.ReaperThemeZip"]) writeFileSync(theme(n), "zip");
    writeFileSync(join(res, "reaper.ini"), `[REAPER]\nlastthemefn5=${theme("Mine.ReaperThemeZip")}\n`);
    const o = await ensureOriginal(mkdtempSync(join(tmpdir(), "ka-record-")), res, false);
    await installProfile(res, bare(TEST_A), o, { theme: theme("Assist - A feel.ReaperThemeZip"), scriptsDir: mkdtempSync(join(tmpdir(), "ka-scripts-")), icons: new Map() });
    expect(readFileSync(join(res, "reaper.ini"), "latin1")).toContain("Assist - A feel");
    await restoreFiles(res, o);
    expect(readdirSync(join(res, "ColorThemes"))).toEqual(["Mine.ReaperThemeZip"]);
    expect(readFileSync(join(res, "reaper.ini"), "latin1")).toContain(`lastthemefn5=${theme("Mine.ReaperThemeZip")}`);
  });

  it("can go back to REAPER's defaults instead of how it was, keeping the user's own shortcuts", async () => {
    const res = mkdtempSync(join(tmpdir(), "ka-profile-"));
    mkdirSync(join(res, "ColorThemes"));
    const def = join(res, "ColorThemes", "Default_7.0.ReaperThemeZip");
    writeFileSync(def, "zip");
    writeFileSync(join(res, "reaper.ini"), "[REAPER]\nlastthemefn5=/x/Mine.ReaperThemeZip\nleftpanewid=581\ndockheight=352\nfxadd_vis=1\nzoommode=1\n");
    writeFileSync(join(res, "reaper-kb.ini"), "KEY 1 75 40044 0\n");
    writeFileSync(join(res, "reaper-mouse.ini"), "[hasimported]\nMM_CTX_ITEM=1\n\n[MM_CTX_ITEM]\nmm_2=36 m\n");
    const o = await ensureOriginal(mkdtempSync(join(tmpdir(), "ka-record-")), res, false);
    await installProfile(res, TEST_A, o, { theme: "/x/Assist - A.ReaperThemeZip", scriptsDir: mkdtempSync(join(tmpdir(), "ka-scripts-")), icons: new Map() });
    await restoreFiles(res, defaultsOriginal(o, def));
    const ini = readFileSync(join(res, "reaper.ini"), "latin1");
    expect(ini).toContain(`lastthemefn5=${def}`);
    expect(ini).not.toMatch(/leftpanewid|dockheight|zoommode/);
    expect(ini).toContain("fxadd_vis=0");
    const kb = readFileSync(join(res, "reaper-kb.ini"), "latin1");
    expect(kb).toContain("KEY 1 75 40044 0");
    expect(kb).not.toContain("assist_");
    expect(readFileSync(join(res, "reaper-mouse.ini"), "latin1")).not.toContain("mm_2=");
  });

  it("removes a start-up file that only ran the profile", async () => {
    const res = mkdtempSync(join(tmpdir(), "ka-profile-"));
    writeFileSync(join(res, "reaper.ini"), "[REAPER]\n");
    const o = await ensureOriginal(mkdtempSync(join(tmpdir(), "ka-record-")), res, false);
    const scripts = mkdtempSync(join(tmpdir(), "ka-scripts-"));
    await installProfile(res, { ...bare(TEST_A), startup: [40001] }, o, { theme: null, scriptsDir: scripts, icons: new Map() });
    expect(readFileSync(join(res, "Scripts/__startup.lua"), "latin1")).toContain("Profile/startup.lua");
    await restoreFiles(res, o);
    expect(existsSync(join(res, "Scripts/__startup.lua"))).toBe(false);
    expect(existsSync(join(res, "Scripts/ReaperAssist/Profile"))).toBe(false);
  });
});
