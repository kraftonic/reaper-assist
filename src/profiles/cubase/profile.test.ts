import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { KITS, kitFiles } from "../kit";
import { toolbarIconFiles, toolbarInk } from "../kit/toolbarIcons";
import { cubase } from "./profile";
import { skinFromWorkflow } from "../skins";

const DIR = join(__dirname, "scripts");

describe("Cubase profile", () => {
  it("every script and toolbar icon it names exists", () => {
    for (const s of cubase.scripts ?? []) expect(existsSync(join(DIR, s.file)), s.file).toBe(true);
    const ids = new Set((cubase.scripts ?? []).map((s) => `_${s.id}`));
    const named = [...cubase.shortcuts.map((s) => s.action), ...(cubase.toolbars ?? []).flatMap((t) => t.items.map((i) => i.action)), ...(cubase.startup ?? [])];
    for (const a of named) if (typeof a === "string" && a.startsWith("_RS_")) expect(ids.has(a), a).toBe(true);
    for (const t of cubase.toolbars ?? []) for (const i of t.items) if (i.icon) expect(KITS.cubase.toolbarGlyphs![i.icon], i.icon).toBeTypeOf("function");
  });

  it("starts tracks at Cubase's two-row height and hides REAPER's event buttons", () => {
    const pref = (k: string) => cubase.prefs?.find((p) => p.key === k);
    expect(pref("defvzoom")?.value).toBe(2);
    expect(KITS.cubase.globals?.tcp_heights).toBe("4 23 46 46");
    expect(pref("itemicons")).toMatchObject({ value: 0, bits: 16511 });
  });

  it("reads like Cubase's window: no play-state text, master on the right, bar-only ruler, unshaded muted lanes", () => {
    const pref = (k: string) => cubase.prefs?.find((p) => p.key === k);
    expect(pref("transflags")).toMatchObject({ value: 2, bits: 2 });
    expect(pref("mixrowflags")).toMatchObject({ value: 4, bits: 4 });
    expect(pref("projtimemode")?.value).toBe(6);
    expect(cubase.reaperModes?.mute_overlay_mode).toBe(0x20000 | (0x20 << 8));
    expect(KITS.cubase.toolbarInk?.on).toBe("#121212");
  });

  it("the kit draws Cubase's controls: joined M|S, R|W pairs, the framed transport group, event borders", () => {
    const files = kitFiles(skinFromWorkflow(cubase, true))!;
    for (const n of ["track_mute_on.png", "track_solo_on.png", "track_env_read.png", "mcp_env_write.png", "transport_stop.png", "transport_repeat_on.png", "toolbar_blank.png", "item_bg.png", "item_bg_sel.png", "midi_note_colormap.png", "k_time.png", "k_tempo.png", "animation_toolbar_highlight.png", "item_seldot.png", "k_fs_0.png", "k_sc_12.png"]) {
      expect(files.has(n), n).toBe(true);
    }
    const rt = Buffer.from(files.get("rtconfig.txt")!).toString("latin1");
    expect(rt).toContain("tcp_heights 4 23 46 46");
    expect(rt).toContain("set trans.size.dockedheight [40]");
    // Optional: KA_DUMP=<dir> writes the kit's files out for a look.
    const dump = process.env.KA_DUMP;
    const icons = toolbarIconFiles(cubase, KITS.cubase.toolbarGlyphs ?? {}, toolbarInk(cubase, KITS.cubase.toolbarInk), KITS.cubase.toolbarInk?.icons);
    expect(icons.size).toBeGreaterThan(0);
    if (dump) for (const [n, d] of [...files, ...[...icons].map(([n, d]) => [`icons/${n}`, d] as const)]) {
      const p = join(dump, n);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, d);
    }
  });
});
