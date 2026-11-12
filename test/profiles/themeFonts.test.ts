import { readFileSync, existsSync } from "node:fs";
import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { buildThemeZip, logfontHex, setThemeReaperKeys, themeFontLines } from "@profiles/engine/theme";
import { rtconfigFor } from "@profiles/kit/walter";
import { KITS } from "@profiles/kit";
import { skinFromWorkflow } from "@profiles/skins";
import { WORKFLOWS } from "@profiles";

// REAPER's own Default 7 theme; tests that compare against it skip where REAPER isn't installed (CI).
const BASE = "/Applications/REAPER.app/Contents/InstallFiles/ColorThemes/Default_7.0.ReaperThemeZip";
const baseIni = () => Buffer.from(unzipSync(new Uint8Array(readFileSync(BASE)))["Default_7.0_unpacked.ReaperTheme"]!).toString("latin1");

describe("theme fonts", () => {
  it.runIf(existsSync(BASE))("writes LOGFONTs the way REAPER does (checked against Default 7)", () => {
    const line = /^lb_font=([0-9A-F]+)/m.exec(baseIni())![1]!;
    const bytes = line.match(/../g)!.map((h) => parseInt(h, 16));
    // REAPER's checksum: the 60 bytes' sum mod 256.
    expect(bytes.slice(0, 60).reduce((a, b) => (a + b) & 255, 0)).toBe(bytes[60]);
    // Same height, weight, flags and face ("Inter\0") as Default 7's volume/pan font.
    const ours = logfontHex({ face: "Inter", px: 11, weight: 400 });
    expect(ours.slice(0, (28 + 6) * 2)).toBe(line.slice(0, (28 + 6) * 2));
    const ob = ours.match(/../g)!.map((h) => parseInt(h, 16));
    expect(ob.slice(0, 60).reduce((a, b) => (a + b) & 255, 0)).toBe(ob[60]);
  });

  it("sets the italic byte (and keeps the checksum right)", () => {
    const plain = logfontHex({ face: "Verdana", px: 12, weight: 700 }).match(/../g)!.map((h) => parseInt(h, 16));
    const ital = logfontHex({ face: "Verdana", px: 12, weight: 700, italic: true }).match(/../g)!.map((h) => parseInt(h, 16));
    expect(plain[20]).toBe(0);
    expect(ital[20]).toBe(1);
    expect(ital.slice(0, 60).reduce((a, b) => (a + b) & 255, 0)).toBe(ital[60]);
    expect(themeFontLines({ title: { face: "Verdana", px: 12, weight: 700, italic: true } }, true).lb_font2).toBe(logfontHex({ face: "Verdana", px: 12, weight: 700, italic: true }));
  });

  it("maps WALTER slots to user_font keys with 150 / 200 % twins, and named fonts", () => {
    const t = themeFontLines({ slots: { 1: { face: "Arial", px: 10 } }, transport: { face: "Courier New", mac: "Menlo", px: 14, weight: 700 } }, true);
    expect(Object.keys(t).sort()).toEqual(["trans_font", "user_font0", "user_font10", "user_font5"]);
    expect(t.user_font5!.slice(0, 8)).toBe("F1FFFFFF"); // -15 px at 150 %
    expect(t.user_font10!.slice(0, 8)).toBe("ECFFFFFF"); // -20 px at 200 %
    expect(Buffer.from(t.trans_font!.slice(56, 66), "hex").toString("latin1")).toBe("Menlo"); // macOS face
    expect(Buffer.from(themeFontLines({ transport: { face: "Courier New", mac: "Menlo", px: 14 } }, false).trans_font!.slice(56, 78), "hex").toString("latin1")).toBe("Courier New");
  });

  it("replaces [REAPER] keys and adds missing ones, leaving colours alone", () => {
    const ini = "[color theme]\r\ncol_main_bg=1\r\n[REAPER]\r\nlb_font=AA\r\nui_img=x\r\n";
    const out = setThemeReaperKeys(ini, { lb_font: "BB", tl_font: "CC" });
    expect(out).toContain("lb_font=BB");
    expect(out).toContain("ui_img=x\r\ntl_font=CC");
    expect(out).toContain("col_main_bg=1");
  });
});

describe("kit globals", () => {
  it("replace the frame's rtconfig lines or add new ones", () => {
    const def = { ...KITS.fl, globals: { tcp_heights: "4 22 44 66", tcp_label_alignment: "0" } };
    const w = WORKFLOWS.find((x) => x.id === "fl")!;
    const rt = rtconfigFor(def, def.palette(skinFromWorkflow(w, true).ui));
    expect(rt).toMatch(/^tcp_heights 4 22 44 66\r?$/m);
    expect(rt).not.toMatch(/^tcp_heights 4 26 52 76/m);
    expect(rt).toMatch(/^tcp_label_alignment 0\r?$/m);
  });
});

describe("raw theme modes", () => {
  it.runIf(existsSync(BASE))("writes a profile's reaperModes into [color theme] as raw integers", () => {
    const w = { ...WORKFLOWS.find((x) => x.id === "protools")!, reaperModes: { mute_overlay_mode: 0x20000 | (0x40 << 8), inactive_take_overlay_mode: 0x20000 } };
    const zip = buildThemeZip(new Uint8Array(readFileSync(BASE)), skinFromWorkflow(w, true));
    const files = unzipSync(zip);
    const ini = Buffer.from(Object.entries(files).find(([n]) => n.endsWith(".ReaperTheme"))![1]).toString("latin1");
    expect(ini).toMatch(new RegExp(`^mute_overlay_mode=${0x20000 | (0x40 << 8)}\\r?$`, "m"));
    expect(ini).toMatch(new RegExp(`^inactive_take_overlay_mode=${0x20000}\\r?$`, "m"));
  }, 30000); // builds a whole theme zip: ~2 s alone, over 5 s when the full suite runs in parallel
  it("keeps only arrange keys in colours-only mode", () => {
    const w = { ...WORKFLOWS.find((x) => x.id === "protools")!, reaperModes: { mute_overlay_mode: 1, midi_griddm2: 2 } };
    expect(skinFromWorkflow(w).reaperModes).toEqual({ midi_griddm2: 2 });
  });
});
