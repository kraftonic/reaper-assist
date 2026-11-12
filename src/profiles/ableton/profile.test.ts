import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { KITS, kitFiles } from "../kit";
import { toolbarIconFiles, toolbarInk } from "../kit/toolbarIcons";
import { ableton } from "./profile";
import { skinFromWorkflow } from "../skins";

const SCRIPTS = resolve(__dirname, "scripts");
const files = () => kitFiles(skinFromWorkflow(ableton, true))!;
/** The 100 % section of the kit's layout. */
const layout = () => Buffer.from(files().get("rtconfig.txt")!).toString("latin1").split('Layout "150"')[0]!;
const line = (rt: string, el: string) => rt.split(/\r?\n/).find((l) => l.startsWith(`set ${el} `));
const size = (b: Uint8Array) => {
  const p = PNG.sync.read(Buffer.from(b));
  return [p.width, p.height];
};

describe("Ableton Live profile", () => {
  it("every script file exists", () => {
    for (const s of ableton.scripts ?? []) expect(() => readFileSync(join(SCRIPTS, s.file)), s.file).not.toThrow();
  });

  it("clips are plain (no badges, no volume knob) with the name inside the clip; no play-state text", () => {
    const pref = (k: string) => ableton.prefs?.find((p) => p.key === k);
    expect(pref("itemicons")).toMatchObject({ value: 0, bits: 16511 });
    expect(pref("labelitems2")).toMatchObject({ value: 1, bits: 9 });
    expect(pref("transflags")).toMatchObject({ value: 2 });
    expect(pref("griddot")).toMatchObject({ value: 0 });
    expect(pref("trackitemgap")).toMatchObject({ value: 0 });
    expect(pref("deftrackrecflags")).toMatchObject({ value: 512, bits: 768 }); // monitoring: Auto
    expect(pref("mixrowflags")).toMatchObject({ value: 4, bits: 4 }); // master strip at the right
    // Live's 216 px header (In/Out hidden until ⌘⌥I); a 96 px ruler area gives the toolbar above it three rows.
    expect(ableton.layout?.tcpWidth).toBe(216);
    expect(pref("toppane")).toMatchObject({ value: 96 });
    expect(KITS.ableton.faces?.slots?.[1]).toMatchObject({ weight: 700, italic: true }); // track names: bold italic
    // Solid grid, see-through time selection, a light (25 %) wash for muted / un-soloed tracks.
    expect(ableton.reaperModes).toMatchObject({ col_gridlines2dm: 0x2ff00, timesel_drawmode: 0x24c00, mute_overlay_mode: 0x24000 });
    expect(Object.keys(ableton.reaper).some((k) => /dm$|drawmode|_mode$/.test(k))).toBe(false);
  });

  it("track header at Live's sizes: 17 px rows, 13 px controls, the mixer section on the right", () => {
    const rt = layout();
    expect(rt).toContain("tcp_heights 4 19 36 36");
    expect(line(rt, "tcp.mute")).toBe("set tcp.mute + [-118 2 47 13] [w 0 0 0]");
    expect(line(rt, "tcp.solo")).toBe("set tcp.solo + [-66 2 21 13] [w 0 0 0]");
    expect(line(rt, "tcp.recarm")).toBe("set tcp.recarm + [-40 2 21 13] [w 0 0 0]");
    // The name field takes the track colour, or a Live hue by track number when the track has none.
    expect(line(rt, "tcp.custom.kName.color")).toMatch(/^set tcp\.custom\.kName\.color \?trackcolor_valid \[0 0 0 0 trackcolor_r/);
    expect(line(rt, "tcp.custom.kName.color")).toContain("kTI{0}==8");
    // In/Out, Sends and the mixer part follow Live's ⌘⌥I / ⌘⌥S / ⌘⌥M (theme parameters the scripts flip).
    for (const p of ["k_io", "k_sends", "k_nomix"]) expect(rt).toContain(`define_parameter "${p}"`);
    for (const p of ["k_io", "k_sends", "k_nomix"]) expect(readFileSync(join(SCRIPTS, "ableton_tcp_section.lua"), "utf8")).toContain(p);
    expect(rt).not.toMatch(/NaN|undefined/);
  });

  it("the volume box's orange level: the fader is two boxes wide, its thumb one box", () => {
    const f = files();
    const [tw, th] = size(f.get("tcp_volthumb.png")!);
    expect([tw, th]).toEqual([47, 13]);
    expect(line(layout(), "tcp.volume")).toContain("[-118 19 94 13]");
  });

  it("clips: the title strip is see-through (the clip colour), the body covered", () => {
    const png = PNG.sync.read(Buffer.from(files().get("item_bg.png")!));
    const a = (x: number, y: number) => png.data[(y * png.width + x) * 4 + 3]!;
    expect(a(10, 8)).toBe(0); // title strip
    expect(a(10, 20)).toBe(255); // body
    expect(a(10, 1)).toBe(255); // the hairline round the title
  });

  it("toolbar icons and kit files (KA_DUMP=<dir> writes them out for a look)", () => {
    const f = files();
    const icons = toolbarIconFiles(ableton, KITS.ableton.toolbarGlyphs ?? {}, toolbarInk(ableton, KITS.ableton.toolbarInk), KITS.ableton.toolbarInk?.icons);
    expect(icons.size).toBeGreaterThan(0);
    // Live's switch plates: grey under every icon, yellow (not REAPER's teal glow) under a lit one.
    const px = (b: Uint8Array, x: number, y: number) => { const p = PNG.sync.read(Buffer.from(b)); const i = (y * p.width + x) * 4; return [...p.data.subarray(i, i + 4)]; };
    expect(size(f.get("toolbar_blank.png")!)).toEqual([90, 30]);
    expect(px(f.get("toolbar_blank.png")!, 6, 6)).toEqual([0x99, 0x99, 0x99, 255]);
    expect(size(f.get("animation_toolbar_highlight.png")!)).toEqual([30, 360]);
    expect(px(f.get("animation_toolbar_highlight.png")!, 6, 30 * 5 + 6)).toEqual([0xff, 0xc9, 0x07, 255]);
    const dump = process.env.KA_DUMP;
    if (dump) for (const [n, d] of [...f, ...[...icons].map(([n, d]) => [`icons/${n}`, d] as const)]) {
      const p = join(dump, n);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, d);
    }
  });
});
