import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { KITS, kitFiles } from "../kit";
import { toolbarIconFiles, toolbarInk } from "../kit/toolbarIcons";
import { fl } from "./profile";
import { skinFromWorkflow } from "../skins";

const SCRIPTS = resolve(__dirname, "scripts");

describe("FL Studio profile", () => {
  it("the tool script writes exactly the profile's tool slots, the Draw tool = the base map", () => {
    const lua = readFileSync(join(SCRIPTS, "fl_tool.lua"), "utf8");
    const slots = [...lua.match(/local SLOTS = \{([^}]+)\}/)![1]!.matchAll(/"(MM_CTX_\w+)"/g)].map((m) => m[1]);
    expect(slots).toEqual(fl.toolSlots!.map((s) => s.ctx));
    expect(fl.toolSlots!.every((s) => s.mods.length === 0)).toBe(true);
    const draw = [...lua.match(/draw = \{([^}]+)\}/)![1]!.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    const base = slots.map((ctx) => (fl.mouse ?? []).find((m) => m.ctx === ctx && m.mods.length === 0)?.value);
    expect(draw).toEqual(base);
    // Every tool has a value for every slot, and every tool has a key in both sections.
    for (const t of ["draw", "paint", "delete", "mute", "slice", "select"]) {
      const vals = [...lua.match(new RegExp(`\\b${t} = \\{([^}]+)\\}`))![1]!.matchAll(/"([^"]+)"/g)];
      expect(vals, t).toHaveLength(slots.length);
      expect(fl.shortcuts.some((s) => s.action === `_RS_assist_fl_tool_${t}` && !s.section)).toBe(true);
      expect(fl.shortcuts.some((s) => s.action === `_RS_assist_fl_tool_${t}_midi` && s.section === "midi")).toBe(true);
    }
  });

  it("every script file exists and every macro a tool uses is declared", () => {
    for (const s of fl.scripts ?? []) expect(() => readFileSync(join(SCRIPTS, s.file)), s.file).not.toThrow();
    const lua = readFileSync(join(SCRIPTS, "fl_tool.lua"), "utf8");
    for (const [, id] of lua.matchAll(/"_(assist_fl_\w+)"/g)) expect(fl.macros?.some((m) => m.id === id), id).toBe(true);
  });

  it("the kit draws FL's own art: PAT / SONG, LED mutes, mint notes, clip strips, one-row headers", () => {
    const files = kitFiles(skinFromWorkflow(fl, true))!;
    for (const n of ["transport_repeat_on.png", "transport_repeat_off.png", "track_mute_off.png", "mcp_volthumb.png", "midi_note_colormap.png", "k_lcd_light.png"]) {
      expect(files.has(n), n).toBe(true);
    }
    // FL's playlist look: clip title strips, the time display panel, the meter box, opaque solid grid under clips.
    for (const n of ["item_bg.png", "item_bg_sel.png", "transport_status_bg.png", "k_mbox.png", "k_mboxsel.png", "mcp_volbg.png"]) expect(files.has(n), n).toBe(true);
    const rt = files.get("rtconfig.txt")!.toString();
    expect(rt).toMatch(/^tcp_heights 4 26 56 56$/m);
    expect(rt).not.toContain("kName");
    expect(rt).toMatch(/^set trans\.status /m);
    const pref = (key: string) => fl.prefs?.find((p) => p.key === key)?.value;
    expect([pref("griddot"), pref("gridinbg"), pref("trackitemgap"), pref("defvzoom")]).toEqual([0, 2, 0, 2]);
    // Optional: KA_DUMP=<dir> writes the kit's files out for a look.
    const dump = process.env.KA_DUMP;
    const icons = toolbarIconFiles(fl, KITS.fl.toolbarGlyphs ?? {}, toolbarInk(fl, KITS.fl.toolbarInk), KITS.fl.toolbarInk?.icons);
    expect(icons.size).toBeGreaterThan(0);
    if (dump) for (const [n, d] of [...files, ...[...icons].map(([n, d]) => [`icons/${n}`, d] as const)]) {
      const p = join(dump, n);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, d);
    }
  });
});
