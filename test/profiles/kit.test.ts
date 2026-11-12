import { existsSync, readFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { KITS, PIXEL_READ, kitFiles, kitIniColors } from "@profiles/kit";
import { buildThemeZip, meterRangeFromIni, reaperColorInt } from "@profiles/engine/theme";
import { skinFromWorkflow } from "@profiles/skins";
import { WORKFLOWS } from "@profiles";

const BASE = "/Applications/REAPER.app/Contents/InstallFiles/ColorThemes/Default_7.0.ReaperThemeZip";
const skin = (id: string) => skinFromWorkflow(WORKFLOWS.find((w) => w.id === id)!, true);
const size = (b: Uint8Array) => {
  const p = PNG.sync.read(Buffer.from(b));
  return [p.width, p.height];
};

describe("FL and Ableton kits (own artwork + own layout)", () => {
  for (const id of ["fl", "ableton"]) {
    it(`${id}: every control is drawn at exactly the size the layout gives it, at 100/150/200%`, () => {
      const files = kitFiles(skin(id))!;
      const rt = Buffer.from(files.get("rtconfig.txt")!).toString("latin1");
      expect(rt).toContain('Layout "150" "150"');
      expect(rt).toContain('Layout "200" "200"');
      expect(rt).not.toMatch(/NaN|undefined/);
      const sections = [rt.split('Layout "150"')[0]!, rt.split('Layout "150"')[1]!.split("EndLayout")[0]!, rt.split('Layout "200"')[1]!.split("EndLayout")[0]!];
      const checks: [string, string][] = [
        ["tcp.mute", "track_mute_off"], ["tcp.solo", "track_solo_on"], ["tcp.recarm", "track_recarm_on"], ["tcp.fx", "track_fx_norm"],
        ["tcp.recmon", "track_monitor_off"], ["tcp.io", "track_io"], ["tcp.env", "track_env"], ["tcp.folder", "track_folder_off"],
        ["mcp.mute", "mcp_mute_off"], ["mcp.solo", "mcp_solo_off"], ["mcp.recarm", "mcp_recarm_off"], ["mcp.recmon", "mcp_monitor_off"], ["mcp.fx", "mcp_fx_norm"],
        ["master.mcp.menubutton", "mixer_menu"], ["trans.play", "transport_play"], ["trans.automode", "global_off"],
        ["envcp.arm", "envcp_arm_off"], ["envcp.hide", "envcp_hide"],
      ];
      ["", "150/", "200/"].forEach((dir, i) => {
        for (const [el, img] of checks) {
          // The element's rect (the last one on its line; earlier ones are hidden-state alternatives).
          const line = sections[i]!.split(/\r?\n/).find((l) => l.trim().startsWith(`set ${el} `));
          const m = line ? [...line.matchAll(/\[(-?\d+) (-?\d+) (\d+) (\d+)/g)].pop() : null;
          expect(m, `${el} @ ${dir || "100"}`).not.toBeNull();
          const [w, h] = size(files.get(`${dir}${img}.png`)!);
          expect([w! / 3, h], `${img} @ ${dir || "100"}`).toEqual([Number(m![3]), Number(m![4])]);
        }
      });
      // Every image a custom element names is drawn.
      for (const m of rt.matchAll(/^\s*custom \S+ '' 0 '' '([^']+)'/gm)) expect(files.has(`${m[1]}.png`), m[1]).toBe(true);
      // Meter colour maps exist only at 100 % (REAPER reads them pixel by pixel).
      expect(size(files.get("meter_strip_v.png")!)).toEqual([32, 2]);
      expect(files.has("150/meter_strip_v.png")).toBe(false);
      // The main toolbar is drawn too, at 30px per frame.
      expect(size(files.get("toolbar_snap_on.png")!)).toEqual([90, 30]);
      expect(size(files.get("200/toolbar_snap_on.png")!)).toEqual([180, 60]);
    });
  }

  it.runIf(existsSync(BASE))("replaces REAPER's layout and drops the overlays of redrawn controls", () => {
    const zip = unzipSync(buildThemeZip(new Uint8Array(readFileSync(BASE)), skin("ableton")));
    const rt = Buffer.from(zip["Default_7.0_unpacked/rtconfig.txt"]!).toString("latin1");
    expect(rt).toMatch(/^; REAPER Assist theme layout/);
    expect(zip["Default_7.0_unpacked/track_mute_off_ol.png"]).toBeUndefined();
    expect(zip["Default_7.0_unpacked/200/track_mute_off_ol.png"]).toBeUndefined();
    expect(zip["Default_7.0_unpacked/200/track_mute_off.png"]).toBeDefined();
    // Things the kit doesn't draw (items, MIDI editor) still come from REAPER's theme.
    expect(zip["Default_7.0_unpacked/item_bg.png"] ?? zip["Default_7.0_unpacked/item_bg_sel.png"]).toBeDefined();
    // The kit's meter colours go into the colour theme too.
    const ini = Buffer.from(Object.entries(zip).find(([n]) => n.endsWith(".ReaperTheme"))![1]).toString("latin1");
    expect(ini).toMatch(/^col_vubot=\d+/m);
    // Light arrange: muted / un-soloed lanes are washed toward the background, not darkened
    // (Ableton: 25 % from its reaperModes, which override the light skins' 50 %).
    expect(ini).toContain(`mute_overlay_mode=${0x20000 | (0x40 << 8)}`);
    expect(ini).toContain(`mute_overlay_col=${reaperColorInt("#8d8d8d")}`); // Ableton: Live 9's arrange surface
    // REAPER's light insert slots (with their dark text) are kept as drawn, not recoloured dark.
    const base = unzipSync(new Uint8Array(readFileSync(BASE)));
    expect(zip["Default_7.0_unpacked/mcp_fxlist_norm.png"]).toEqual(base["Default_7.0_unpacked/mcp_fxlist_norm.png"]);
  });

  it("Ableton: Live-style note colours in REAPER's colormap layout, at 100 % only", () => {
    const files = kitFiles(skin("ableton"))!;
    const png = PNG.sync.read(Buffer.from(files.get("midi_note_colormap.png")!));
    expect([png.width, png.height]).toEqual([157, 130]);
    expect(files.has("200/midi_note_colormap.png")).toBe(false);
    const px = (x: number, y: number) => [...png.data.slice((y * png.width + x) * 4, (y * png.width + x) * 4 + 3)];
    // Velocity 127 (column 139): unselected = Live's red, selected = the dark note colour.
    expect(px(139, 0)).toEqual([0xff, 0x12, 0x00]);
    expect(px(139, 70)).toEqual([0x23, 0x28, 0x34]);
    // Soft notes fade toward the row grey; edges are darker than fills.
    expect(px(12, 0)[1]!).toBeGreaterThan(px(139, 0)[1]! + 80);
    expect(px(139, 64)[0]!).toBeLessThan(px(139, 0)[0]!);
    // The FL kit draws its own (mint) map too.
    expect(kitFiles(skin("fl"))!.has("midi_note_colormap.png")).toBe(true);
  });

  it("Ableton mixer: dB marks sit where REAPER's meter shows that level", () => {
    const rt = Buffer.from(kitFiles(skin("ableton"))!.get("rtconfig.txt")!).toString("latin1").split('Layout "150"')[0]!;
    // Meter: top 48, bottom inset 4 → y = 48 + kE + f·(h − 52 − kE), f = (6 − dB) / 68; marks are 9 tall.
    const mark = (i: number) => rt.split(/\r?\n/).find((l) => l.startsWith(`set mcp.custom.kSc${i} `))!;
    expect(rt).toMatch(/^set mcp\.meter \+ kE2 \+ \[56 48 12 -52\] \[0 0 0 h\]/m);
    expect(mark(1)).toBe("set mcp.custom.kSc1 + * 0.9118 kE + [68 39 16 9] * 0.0882 [0 h 0 0]"); // 0 dB
    expect(mark(5)).toBe("set mcp.custom.kSc5 + * 0.5588 kE + [68 21 16 9] * 0.4412 [0 h 0 0]"); // −24 dB
    // A custom meter range (Preferences > Meters) moves the marks and drops ones outside it.
    expect(meterRangeFromIni("[REAPER]\r\nvumaxvol=0\r\nvuminvol=-48\r\n")).toEqual({ max: 0, min: -48 });
    expect(meterRangeFromIni("[REAPER]\nvumaxvol=6\n")).toEqual({ max: 6, min: -62 });
    expect(meterRangeFromIni("vumaxvol=5\nvuminvol=0\n")).toEqual({ max: 6, min: -62 });
    const rt2 = Buffer.from(kitFiles(skin("ableton"), { max: 0, min: -48 })!.get("rtconfig.txt")!).toString("latin1").split('Layout "150"')[0]!;
    expect(rt2).toContain("set mcp.custom.kSc1 + * 1 kE + [68 44 16 9] * 0 [0 h 0 0]"); // 0 dB at the top
    expect(rt2).not.toContain("mcp.custom.kSc0 "); // +6 is off the meter
  });
});

describe("every profile has a kit", () => {
  it("the registry holds one kit per profile, under its own id", () => {
    expect(Object.keys(KITS).sort()).toEqual(WORKFLOWS.map((w) => w.id).sort());
    for (const [id, def] of Object.entries(KITS)) {
      expect(def.id).toBe(id);
      expect(def.palette(WORKFLOWS.find((w) => w.id === id)!.panel).id).toBe(id);
    }
  });

  for (const w of WORKFLOWS) {
    it(`${w.id}: builds an rtconfig and every image at 100/150/200%`, () => {
      const s = skinFromWorkflow(w, true);
      expect(s.kit).toBe(w.id);
      const files = kitFiles(s)!;
      const rt = Buffer.from(files.get("rtconfig.txt")!).toString("latin1");
      expect(rt).toMatch(/^; REAPER Assist theme layout/);
      for (const sec of ["clear tcp.*", "clear master.tcp.*", "clear envcp.*", "clear mcp.*", "clear master.mcp.*", "clear trans.*"]) expect(rt).toContain(sec);
      expect(rt).toContain('Layout "150" "150"');
      expect(rt).toContain('Layout "200" "200"');
      expect(rt).not.toMatch(/NaN|undefined|Infinity/);
      const pngs = [...files.keys()].filter((p) => p.endsWith(".png"));
      expect(pngs.length).toBeGreaterThan(300);
      for (const p of pngs) {
        const [pw, ph] = size(files.get(p)!);
        expect(pw! > 0 && ph! > 0, p).toBe(true);
        // Everything but the pixel-read colour maps exists at every scale (meter badges too: Default 7 has 150 / 200 % ones).
        if (!p.includes("/") && !PIXEL_READ.test(p.replace(/\.png$/, ""))) for (const d of ["150/", "200/"]) expect(files.has(d + p), d + p).toBe(true);
      }
      for (const m of rt.matchAll(/^\s*custom \S+ '' 0 '' '([^']+)'/gm)) expect(files.has(`${m[1]}.png`), m[1]).toBe(true);
      expect(Object.keys(kitIniColors(s))).toHaveLength(6);
    }, 30000);
  }
});
