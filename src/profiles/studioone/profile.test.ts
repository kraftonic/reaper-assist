import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { studioone } from "./profile";
import { skinFromWorkflow } from "../skins";
import { mouseSlot } from "../index";
import { KITS, kitFiles } from "../kit";
import { toolbarIconFiles, toolbarInk } from "../kit/toolbarIcons";

const DIR = join(__dirname, "scripts");
const lua = (f: string) => readFileSync(join(DIR, f), "utf8");
/** The `{ MM_CTX_X = value, … }` table named `name` in studioone_tools.lua. */
function table(src: string, name: string): Record<string, string> {
  const body = new RegExp(`local ${name} = \\{([\\s\\S]*?)\\n\\}`).exec(src)![1]!;
  return Object.fromEntries([...body.matchAll(/(MM_CTX_\w+) = ("([^"]*)"|-1)/g)].map((m) => [m[1]!, m[3] ?? "-1"]));
}

describe("Studio One profile", () => {
  const src = lua("studioone_tools.lua");
  const base = { ...table(src, "BASE_ARRANGE"), ...table(src, "BASE_MIDI") };

  it("the tools' Arrow map is the profile's own mouse map", () => {
    for (const [ctx, v] of Object.entries(base)) {
      const m = studioone.mouse!.find((x) => x.ctx === ctx && x.mods.length === 0);
      expect(m?.value ?? "-1", ctx).toBe(v);
    }
  });

  it("lists every slot a tool changes, so Restore puts them back", () => {
    const slots = new Set(studioone.toolSlots!.map((s) => mouseSlot(s.ctx, s.mods)));
    for (const ctx of src.matchAll(/(MM_CTX_\w+) =/g)) expect(slots.has(`${ctx[1]}\t0`), ctx[1]).toBe(true);
    expect(Object.keys(base).length).toBe(slots.size);
  });

  it("every script, custom action and toolbar icon it names exists", () => {
    const ids = new Set([...studioone.scripts!.map((s) => `_${s.id}`), ...studioone.macros!.map((m) => `_${m.id}`)]);
    for (const s of studioone.scripts!) expect(existsSync(join(DIR, s.file)), s.file).toBe(true);
    const named = [
      ...studioone.shortcuts.map((s) => s.action),
      ...studioone.toolbars!.flatMap((t) => t.items.map((i) => i.action)),
      ...[...src.matchAll(/"(_(?:RS_)?assist_[\w]+)"(?!\s*\.\.)/g)].map((m) => m[1]!),
    ].filter((a): a is `_${string}` => typeof a === "string" && a.startsWith("_"));
    for (const a of named) expect(ids.has(a), a).toBe(true);
    for (const t of studioone.toolbars!) for (const i of t.items) if (i.icon) expect(KITS.studioone.toolbarGlyphs![i.icon], i.icon).toBeTypeOf("function");
    // Tools 1–8 in the arrange view, 1–7 in the note editor (no Bend tool there).
    expect(studioone.shortcuts.filter((s) => /^[1-8]$/.test(s.key) && !s.mods.length && !s.section)).toHaveLength(8);
    expect(studioone.shortcuts.filter((s) => /^[1-8]$/.test(s.key) && s.section === "midi")).toHaveLength(7);
  });

  it("keeps Studio One's own keys", () => {
    const key = (mods: string[], k: string, section?: string) => studioone.shortcuts.find((s) => s.key === k && s.mods.join() === mods.join() && s.section === section)?.action;
    expect(key([], "D")).toBe(41295); // Duplicate
    expect(key(["cmd"], "D")).toBe(40289); // Deselect all
    expect(key([], "T")).toBe(41067); // Add tracks (dialog)
    expect(key([], "Space")).toBe(40328); // stops in place
    expect(key(["opt"], "X")).toBe(40757);
    expect(key([], "F3")).toBe(40078);
    expect(key([], "Num*")).toBe(1013);
    expect(key([], "Num/")).toBe(1068);
    expect(key(["cmd"], "B")).toBe(41588);
    expect(key(["shift"], "M")).toBe(40175);
  });

  it("draws Studio One's look: one-row headers, a dark transport panel, event name tabs, a tool strip", () => {
    const files = kitFiles(skinFromWorkflow(studioone, true))!;
    for (const n of ["track_mute_on.png", "track_monitor_on.png", "k_s1_tpanel.png", "k_s1_tab_edit.png", "k_s1_cap_bars.png", "item_bg.png", "item_bg_sel.png", "toolbar_blank.png", "animation_toolbar_highlight.png", "transport_status_bg.png", "k_s1_ins.png", "mcp_fxlist_norm.png", "meter_unsolo.png"]) {
      expect(files.has(n), n).toBe(true);
    }
    const rt = files.get("rtconfig.txt")!.toString();
    expect(rt).toMatch(/^tcp_heights 4 26 39 39$/m);
    // The input row only on armed tracks; the monitor fill lights with the record arm.
    expect(rt).toMatch(/^set tcp\.recinput \?recarm /m);
    expect(rt).toMatch(/^set tcp\.custom\.kMon\.color \?recarm /m);
    // Transport captions don't share a (case-blind) name with the metronome button.
    const names = [...rt.matchAll(/^custom (trans\.custom\.\w+)/gm)].map((m) => m[1]!.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    // Console insert / send rows: three states stacked, each a row (SLOT_H) tall.
    expect(rt).toMatch(/^set mcp\.fxlist\.font \[\d+ 18\]$/m);
    const pref = (key: string) => studioone.prefs?.find((p) => p.key === key)?.value;
    expect([pref("itemicons"), pref("defvzoom"), pref("gridinbg"), pref("griddot"), pref("projtimemode")]).toEqual([0, 5, 2, 0, 6]);
    // Optional: KA_DUMP=<dir> writes the kit's files and toolbar icons out for a look.
    const ink = KITS.studioone.toolbarInk;
    expect(ink?.on).toBe("#ffffff");
    const icons = toolbarIconFiles(studioone, KITS.studioone.toolbarGlyphs ?? {}, toolbarInk(studioone, ink), ink?.icons);
    expect(icons.size).toBeGreaterThan(0);
    const dump = process.env.KA_DUMP;
    if (dump) for (const [n, d] of [...files, ...[...icons].map(([n, d]) => [`icons/${n}`, d] as const)]) {
      const p = join(dump, n);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, d);
    }
  });
});
