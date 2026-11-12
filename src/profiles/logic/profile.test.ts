import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { KITS, kitFiles } from "../kit";
import { toolbarIconFiles, toolbarInk } from "../kit/toolbarIcons";
import { logic } from "./profile";
import { skinFromWorkflow } from "../skins";

const SCRIPTS = resolve(__dirname, "scripts");
const rtconfig = () => Buffer.from(kitFiles(skinFromWorkflow(logic, true))!.get("rtconfig.txt")!).toString("latin1");
/** The 100 % section of the layout (before the 150 % twin). */
const at100 = () => rtconfig().split('Layout "150"')[0]!;

describe("Logic Pro profile", () => {
  it("every script file exists and every scripted toolbar / control-bar action is a profile script", () => {
    for (const s of logic.scripts ?? []) expect(() => readFileSync(join(SCRIPTS, s.file)), s.file).not.toThrow();
    const ids = new Set((logic.scripts ?? []).map((s) => `_${s.id}`));
    for (const [, id] of at100().matchAll(/'' (_RS_\w+) /g)) expect(ids.has(id!), id).toBe(true);
  });

  it("the track header is Logic's: number column, name, M|S R|I, volume pill with its meter, pan knob, nothing else", () => {
    const rt = at100();
    for (const el of ["tcp.custom.kNum", "tcp.trackidx", "tcp.label", "tcp.mute", "tcp.solo", "tcp.recarm", "tcp.recmon", "tcp.volume", "tcp.meter", "tcp.pan"]) {
      expect(rt, el).toMatch(new RegExp(`^set ${el.replace(/\./g, "\\.")} `, "m"));
    }
    // REAPER-only clutter stays hidden (the frame clears tcp.* and the kit never places these).
    for (const el of ["tcp.recinput", "tcp.io", "tcp.env", "tcp.fx", "tcp.phase", "tcp.recmode", "tcp.width"]) {
      expect(rt, el).not.toMatch(new RegExp(`^set ${el.replace(/\./g, "\\.")} [[+h]`, "m"));
    }
    // Uncoloured tracks get Logic's instrument green; tracks are Logic's 44 px tall at their smallest normal size.
    expect(rt).toMatch(/^set tcp\.custom\.kNum\.color \?trackcolor_valid \[0 0 0 0 trackcolor_r trackcolor_g trackcolor_b 255\] \[0 0 0 0 26 163 49 255\]/m);
    expect(rtconfig()).toMatch(/^tcp_heights 4 28 44 44\r?$/m);
  });

  it("the control bar has the LCD in the centre, the transport plate and view buttons at both ends", () => {
    const rt = at100();
    expect(rt).toMatch(/^custom trans\.custom\.kLcd '' 0 '' 'k_lcd'/m);
    for (const a of ["40271", "40078", "50124", "40211", "40364", "_RS_assist_logic_count_in"]) expect(rt, a).toContain(`'' ${a} '`);
    for (const el of ["trans.stop", "trans.play", "trans.rec", "trans.repeat", "trans.status", "trans.bpm.edit", "trans.curtimesig"]) {
      expect(rt, el).toMatch(new RegExp(`^set ${el.replace(/\./g, "\\.")} \\+ `, "m"));
    }
    // REAPER paints the position element last, over whatever it overlaps: it stays inside the
    // LCD's position column (left of the tempo at x 103) and grows only its text box (negative
    // margins) for Logic's big digits.
    const [, x, , wd] = /^set trans\.status \+ \[(-?\d+) (\d+) (\d+) (\d+)\]/m.exec(rt)!.map(Number);
    const lcdX = Number(/^set trans\.custom\.kLcd \+ \[(-?\d+) /m.exec(rt)![1]);
    expect(x! - lcdX).toBeGreaterThanOrEqual(0);
    expect(x! - lcdX + wd!).toBeLessThan(103);
    expect(rt).toMatch(/^set trans\.status\.margin \[\d+ -\d+ -\d+ -\d+ 0\]/m);
  });

  it("channel strips show the track icon under the Automation slot", () => {
    expect(at100()).toMatch(/^set mcp\.custom\.kIcon \+ kE /m);
  });

  it("regions lose REAPER's item buttons and keep their names on their colour", () => {
    const pref = (k: string) => logic.prefs?.find((p) => p.key === k);
    expect(pref("itemicons")).toMatchObject({ value: 0, bits: 16511 });
    expect(pref("labelitems2")).toMatchObject({ value: 0, bits: 8 });
    expect(logic.reaper.col_mi_bg).toBe("#1aa331");
  });

  it("the kit draws Logic's own art (and KA_DUMP=<dir> writes it out for a look)", () => {
    const files = kitFiles(skinFromWorkflow(logic, true))!;
    for (const n of ["track_mute_off.png", "track_recmon_on.png".replace("recmon", "monitor"), "tcp_pan_knob_stack.png", "tcp_volbg.png", "mcp_volthumb.png", "k_lcd.png", "k_plate.png", "item_bg.png", "item_bg_sel.png", "toolbar_blank.png", "midi_note_colormap.png", "200/k_lcd.png",
      "transport_status_bg.png", "meter_mute.png", "meter_unsolo.png", "item_seldot.png"]) {
      expect(files.has(n), n).toBe(true);
    }
    // Lit toolbar buttons get white glyphs on Logic's blue plate.
    expect(toolbarInk(logic, KITS.logic.toolbarInk).on).toBe("#ffffff");
    const icons = toolbarIconFiles(logic, KITS.logic.toolbarGlyphs ?? {}, toolbarInk(logic, KITS.logic.toolbarInk), KITS.logic.toolbarInk?.icons);
    expect(icons.size).toBeGreaterThan(0);
    const dump = process.env.KA_DUMP;
    if (dump) for (const [n, d] of [...files, ...[...icons].map(([n, d]) => [`icons/${n}`, d] as const)]) {
      const p = join(dump, n);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, d);
    }
  });
});
