import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { skinFromWorkflow } from "@profiles/skins";
import { WORKFLOWS, keyEncoding, keymapLine, profileKbLines, shortcutLabel } from "@profiles";
import { buildThemeZip, installShortcuts, keymapText, mergeKb, reaperColorInt, recolorThemeIni, themeFileName } from "@profiles/engine/theme";
import { workflowBackground, wrapUserMessage } from "@ai/prompt";

const BASE = "/Applications/REAPER.app/Contents/InstallFiles/ColorThemes/Default_7.0.ReaperThemeZip";

describe("workflow profiles", () => {
  it("are complete and never bind the same key twice", () => {
    expect(WORKFLOWS.map((w) => w.id)).toEqual(["fl", "ableton", "logic", "protools", "cubase", "studioone"]);
    for (const w of WORKFLOWS) {
      for (const os of ["mac", "win"] as const) {
        const slots = w.shortcuts.map((s) => keymapLine(s, os)).filter((l) => l !== null).map((l) => l.split(" ").filter((_, i) => i !== 0 && i !== 3).join(" ")); // flags, key, section
        expect([...new Set(slots)].length, `${w.id} ${os}: ${slots.filter((x, i) => slots.indexOf(x) !== i)}`).toBe(slots.length);
      }
      for (const v of Object.values(w.reaper)) expect(v).toMatch(/^#[0-9a-f]{6}$/);
      expect(w.glossary.length).toBeGreaterThan(5);
      // ⌘Q quits and ⌘W closes on macOS: never take them.
      expect(w.shortcuts.some((s) => s.mods.join() === "cmd" && (s.key === "Q" || s.key === "W"))).toBe(false);
    }
  });

  it("encodes keys the way REAPER's keymaps do", () => {
    expect(keyEncoding([], "E", "mac")).toEqual([1, 69]);
    expect(keyEncoding([], "F9", "mac")).toEqual([1, 120]);
    expect(keyEncoding([], "Num*", "win")).toEqual([1, 106]);
    // Checked in REAPER 7.82 (GetActionShortcutDesc): 0x8000 marks the arrow / navigation block and numpad Enter.
    expect(keyEncoding([], "Left", "mac")).toEqual([1, 32805]);
    expect(keyEncoding([], "Delete", "win")).toEqual([1, 32814]);
    expect(keyEncoding([], "NumEnter", "mac")).toEqual([1, 32781]);
    expect(keyEncoding(["shift"], "Wheel", "mac")).toEqual([255, 252]);
    // Punctuation: the character itself on macOS (Shift folded in), VK_OEM codes on Windows.
    expect(keyEncoding(["cmd"], "=", "mac")).toEqual([8, 61]);
    expect(keyEncoding(["cmd", "shift"], "=", "mac")).toEqual([8, 43]);
    expect(keyEncoding(["cmd"], "=", "win")).toEqual([9, 187]);
    expect(keyEncoding([], "Num=", "win")).toBeNull();
    expect(keymapLine({ mods: ["cmd"], key: "E", action: 40757, does: "" })).toBe("KEY 9 69 40757 0");
    expect(keymapLine({ mods: [], key: "K", action: "_RS_assist_x", does: "" })).toBe("KEY 1 75 _RS_assist_x 0");
    expect(keymapLine({ mods: ["cmd", "opt", "shift"], key: "3", action: 40362, does: "" })).toBe("KEY 29 51 40362 0");
    expect(keymapLine({ mods: [], key: "Tab", action: 40078, does: "" })).toBe("KEY 1 9 40078 0");
    expect(keymapLine({ mods: [], key: "Tab", action: 40401, section: "midi", does: "" })).toBe("KEY 1 9 40401 32060");
    expect(shortcutLabel({ mods: ["shift", "cmd"], key: "T", action: 1, does: "" }, true)).toBe("⇧⌘T");
    expect(shortcutLabel({ mods: ["shift", "cmd"], key: "T", action: 1, does: "" }, false)).toBe("Ctrl+Shift+T");
  });

  it("tells the assistant where the user is coming from", () => {
    const bg = workflowBackground(WORKFLOWS[0]!, true)!;
    expect(bg).toContain("FL Studio");
    expect(bg).toContain("Piano roll = the MIDI editor");
    expect(wrapUserMessage("hi", null, bg)).toMatch(/^<user_background>[\s\S]+<\/user_background>\n\nhi$/);
    expect(wrapUserMessage("hi", null, null)).toBe("hi");
  });
});

describe("REAPER theme and shortcuts", () => {
  it("stores colours red-low like REAPER", () => {
    expect(reaperColorInt("#339887")).toBe(0x879833);
  });

  it("recolours only [color theme] keys and keeps the rest", () => {
    const ini = "[color theme]\r\ncol_arrangebg=1\r\nother=5\r\n[REAPER]\r\ncol_arrangebg=9\r\nui_img=x";
    const out = recolorThemeIni(ini, { col_arrangebg: "#010203", newkey: "#000001" });
    expect(out).toBe(`[color theme]\r\ncol_arrangebg=${0x030201}\r\nother=5\r\nnewkey=${0x010000}\r\n[REAPER]\r\ncol_arrangebg=9\r\nui_img=x`);
  });

  it("merges shortcuts without dropping the user's others", () => {
    const merged = mergeKb("ACT 0 0 \"x\" \"y\" 1\r\nKEY 9 69 40001 0\r\nKEY 9 69 40001 32060\r\nKEY 1 82 1068 0\r\n", ["KEY 9 69 40757 0"]);
    expect(merged.split("\r\n").filter(Boolean)).toEqual(['ACT 0 0 "x" "y" 1', "KEY 9 69 40001 32060", "KEY 1 82 1068 0", "KEY 9 69 40757 0"]);
  });

  it("installs shortcuts with a backup", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ka-kb-"));
    writeFileSync(join(dir, "reaper-kb.ini"), "KEY 1 82 1068 0\r\n");
    const w = WORKFLOWS[1]!;
    const { backup } = await installShortcuts(dir, w);
    expect(backup && readFileSync(backup, "latin1")).toBe("KEY 1 82 1068 0\r\n");
    const kb = readFileSync(join(dir, "reaper-kb.ini"), "latin1");
    // The user's own key stays unless the profile binds the same key; every profile line is there.
    const ours = profileKbLines(w);
    if (!ours.some((l) => l.startsWith("KEY 1 82 ") && l.endsWith(" 0"))) expect(kb).toContain("KEY 1 82 1068 0");
    for (const l of ours) expect(kb).toContain(l);
    expect(readdirSync(dir).filter((f) => f.endsWith(".tmp"))).toEqual([]);
    expect(keymapText(w).trim().split("\r\n")).toEqual(ours);
  });

  it.runIf(existsSync(BASE))("profile colours change only colour keys: REAPER's images, layout and panels stay", () => {
    const base = unzipSync(new Uint8Array(readFileSync(BASE)));
    for (const w of WORKFLOWS) {
      const skin = skinFromWorkflow(w);
      expect(skin.colorsOnly, w.id).toBe(true);
      expect(Object.keys(skin.reaper).some((k) => /^(col_main_|genlist_|docker_|col_mixerbg|col_tracklistbg)/.test(k)), w.id).toBe(false);
      const files = unzipSync(buildThemeZip(new Uint8Array(readFileSync(BASE)), skin));
      for (const [name, data] of Object.entries(base)) {
        if (name === "Default_7.0_unpacked.ReaperTheme") continue;
        expect(Buffer.compare(Buffer.from(files[name]!), Buffer.from(data)), name).toBe(0);
      }
      const ini = Buffer.from(files[themeFileName(skin).replace(/Zip$/, "")]!).toString("latin1");
      expect(ini).toContain(`col_arrangebg=${reaperColorInt(w.reaper.col_arrangebg!)}`);
      expect(ini).toContain("ui_img=Default_7.0_unpacked");
    }
    expect(themeFileName(skinFromWorkflow(WORKFLOWS[1]!))).toBe("Assist - Ableton Live colours.ReaperThemeZip");
  });

  it.runIf(existsSync(BASE))("builds a theme zip from REAPER's own default theme", () => {
    const w = WORKFLOWS.find((x) => x.id === "logic")!;
    // Without its kit: the full restyle of REAPER's own Default 7 (artwork and rtconfig recoloured).
    const skin = { ...skinFromWorkflow(w, true), kit: undefined };
    const zip = buildThemeZip(new Uint8Array(readFileSync(BASE)), skin);
    const files = unzipSync(zip);
    const name = themeFileName(skin).replace(/Zip$/, "");
    expect(Object.keys(files)).toContain(name);
    expect(Object.keys(files)).not.toContain("Default_7.0_unpacked.ReaperTheme");
    expect(Object.keys(files).filter((f) => f.endsWith(".png")).length).toBeGreaterThan(500);
    const ini = Buffer.from(files[name]!).toString("latin1");
    expect(ini).toContain(`col_arrangebg=${reaperColorInt(w.reaper.col_arrangebg!)}`);
    expect(ini).toContain("ui_img=Default_7.0_unpacked");
    const rt = Buffer.from(files["Default_7.0_unpacked/rtconfig.txt"]!).toString("latin1");
    const r = parseInt(w.panels.track.slice(1, 3), 16);
    expect(rt).toMatch(new RegExp(`^define_parameter\\s+tcpBgColR\\s+'[^']*'\\s+${r}\\s`, "m"));
    expect(rt).not.toMatch(/\[0 0 0 [01] 38 38 38[ \]]/);
    expect(rt).not.toMatch(/\[(200|220) \1 \1\]/);
    expect(rt).toMatch(/define_parameter\s+textBrightness/);
    expect(rt).toMatch(new RegExp(`^define_parameter\\s+transBgColB\\s+'[^']*'\\s+${parseInt(w.panels.transport.slice(5, 7), 16)}\\s`, "m"));
  });
});



describe("shortcuts on Linux", () => {
  it("stores punctuation like macOS and drops keys SWELL doesn't map", async () => {
    const { keyEncoding } = await import("@profiles");
    expect(keyEncoding(["cmd"], "=", "linux")).toEqual([8, 61]);
    expect(keyEncoding(["cmd", "shift"], "=", "linux")).toEqual([8, 43]);
    expect(keyEncoding(["cmd"], "=", "win")).toEqual([9, 187]);
    expect(keyEncoding([], "Num=", "linux")).toBeNull();
    expect(keyEncoding([], "F13", "linux")).toBeNull();
    expect(keyEncoding([], "F12", "linux")).toEqual([1, 123]);
    expect(shortcutLabel({ mods: ["ctrl"], key: "T", action: 1, does: "" }, false, true)).toBe("Super+T");
  });
});
