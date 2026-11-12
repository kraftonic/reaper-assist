import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { KITS, kitFiles } from "../kit";
import { PNG } from "pngjs";
import { kitToolbarIcons } from "../kit/toolbarIcons";
import { protools } from "./profile";
import { skinFromWorkflow } from "../skins";

const SCRIPTS = resolve(__dirname, "scripts");

describe("Pro Tools profile", () => {
  it("every script file exists", () => {
    for (const s of protools.scripts ?? []) expect(() => readFileSync(join(SCRIPTS, s.file)), s.file).not.toThrow();
  });

  it("hides REAPER's clip badges, shows the INSERTS column and a plain counter", () => {
    const pref = (key: string) => protools.prefs?.find((p) => p.key === key);
    expect(pref("itemicons")).toMatchObject({ value: 0, bits: 16767 });
    expect(pref("tcpalign")).toMatchObject({ value: 2, bits: 2 });
    expect(pref("transflags")).toMatchObject({ value: 2, bits: 2 });
  });

  it("opens like a Pro Tools session: medium tracks, tempo / meter rulers, Auto Input, Mix window inserts", () => {
    const pref = (key: string) => protools.prefs?.find((p) => p.key === key);
    // REAPER 7.82, measured with this theme: vertical zoom 0 / 1 / 2 = 26 / 42 / 59 px tracks.
    expect(pref("defvzoom")?.value).toBe(2);
    expect(pref("projtimemode2")?.value).toBe(2);
    expect(pref("rulerlayout")).toMatchObject({ value: 4, bits: 4 });
    // The ruler's height; the docked Edit toolbar beside it gets three rows.
    expect(pref("toppane")?.value).toBe(100);
    // Sends hidden (bit 32), master strip on the right (bit 4).
    expect(pref("mixrowflags")).toMatchObject({ value: 4, bits: 36 });
    // New tracks' monitoring lives in bits 8-9: 2 = tape auto-style (Pro Tools' Auto Input).
    expect(pref("deftrackrecflags")).toMatchObject({ value: 512, bits: 768 });
  });

  it("the edit modes are wide green cells (bright when lit), the tools are drawn icons", () => {
    const items = protools.toolbars![0]!.items;
    for (const m of ["SHUFFLE", "SPOT", "SLIP", "GRID"]) expect(items.find((i) => i.label === m)?.icon).toBe(`assist_protools_mode_${m.toLowerCase()}`);
    expect(items.filter((i) => i.icon?.startsWith("assist_protools_")).length).toBeGreaterThan(10);
    const icons = kitToolbarIcons(protools, KITS.protools);
    // 3 frames of 60 × 30 at 100 %, 90 × 45 at 150 %, 120 × 60 at 200 % (REAPER sizes the button to the frame).
    for (const [dir, w, h] of [["", 180, 30], ["150/", 270, 45], ["200/", 360, 60]] as const) {
      const p = PNG.sync.read(Buffer.from(icons.get(`${dir}assist_protools_mode_slip.png`)!));
      expect([p.width, p.height]).toEqual([w, h]);
    }
    // Plate colour a little inside the left edge of each frame: dark green, dark green (hover), bright green (lit).
    const p = PNG.sync.read(Buffer.from(icons.get("assist_protools_mode_slip.png")!));
    const at = (x: number) => [...p.data.slice((8 * p.width + x) * 4, (8 * p.width + x) * 4 + 3)];
    expect(at(3)).toEqual([0x04, 0x27, 0x12]);
    expect(at(120 + 3)).toEqual([0x38, 0xd1, 0x77]);
  });

  it("the kit draws Pro Tools' own art: R I S M, popups, inserts, readouts, an olive meter", () => {
    const files = kitFiles(skinFromWorkflow(protools, true))!;
    for (const n of ["track_recarm_off.png", "track_monitor_on.png", "track_solo_on.png", "track_mute_on.png", "track_env_read.png", "track_io.png", "tcp_fxlist_norm.png", "mcp_fxlist_empty.png", "mcp_volthumb.png", "mcp_pan_knob_stack.png", "toolbar_blank.png", "animation_toolbar_highlight.png", "k_display.png", "rtconfig.txt"]) {
      expect(files.has(n), n).toBe(true);
    }
    const rt = new TextDecoder().decode(files.get("rtconfig.txt")!);
    // The track header's pan is a readout, never a knob over its own label (the round-1 overlap).
    expect(rt).toContain("set tcp.pan.fadermode [-1]");
    expect(rt).toMatch(/^tcp_heights 4 26 59 59/m);
    // Volume readouts without "dB", as Pro Tools shows them.
    expect(rt).toMatch(/^mcp_voltext_flags 1 5/m);
    // The main counter: REAPER sizes its digits to the text box, so negative margins make them big.
    expect(rt).toMatch(/^set trans\.status\.margin \[56 -2 -205 -2 0\]/m);
    expect(files.has("transport_status_bg.png")).toBe(true);
    // Optional: KA_DUMP=<dir> writes the kit's files out for a look.
    const dump = process.env.KA_DUMP;
    const icons = kitToolbarIcons(protools, KITS.protools);
    expect(icons.size).toBeGreaterThan(0);
    if (dump) for (const [n, d] of [...files, ...[...icons].map(([n, d]) => [`icons/${n}`, d] as const)]) {
      const p = join(dump, n);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, d);
    }
  });
});
