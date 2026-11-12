import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { skinFromWorkflow } from "@profiles/skins";
import { WORKFLOWS, type Shortcut } from "@profiles";
import { installShortcuts, setThemeForNextStart, writeTheme } from "@profiles/engine/theme";

/** How REAPER (macOS) describes a key, e.g. "Cmd+Opt+Shift+3", "NumPad *". */
function reaperDesc(s: Shortcut): string {
  const mods = (["cmd", "opt", "shift"] as const).filter((m) => s.mods.includes(m)).map((m) => ({ cmd: "Cmd", opt: "Opt", shift: "Shift" })[m]);
  const key = s.key === "Num*" ? "NumPad *" : s.key === "Num/" ? "NumPad /" : s.key;
  return [...mods, key].join("+");
}

// Each profile is applied the "REAPER closed" way to a THROWAWAY REAPER resource folder,
// then a separate REAPER instance (-newinst -cfgfile) starts on it and reports back.
const REAPER = "/Applications/REAPER.app/Contents/MacOS/REAPER";
const SEED = resolve(".reaper-test/resource/reaper.ini");
const run = process.env.KA_LOOK_SMOKE === "1" && existsSync(REAPER) && existsSync(SEED) ? describe : describe.skip;

/** Copy the test settings without any recent/last project, so a throwaway REAPER never opens a real project. */
function seed(res: string) {
  const ini = readFileSync(SEED, "latin1").split(/\r?\n/).filter((l) => !/^(lastproject|lastprojuiref|faultyproject|recent\d+|projecttab\d+)=/i.test(l)).join("\n");
  writeFileSync(join(res, "reaper.ini"), ini, "latin1");
}

function launch(resource: string, report: string): Promise<void> {
  return new Promise((done, fail) => {
    const p = spawn(REAPER, ["-newinst", "-nosplash", "-new", "-cfgfile", join(resource, "reaper.ini")], { stdio: "ignore" });
    const t = setTimeout(() => (p.kill(), existsSync(report) ? done() : fail(new Error("REAPER did not report"))), 40000);
    p.on("exit", () => (clearTimeout(t), done()));
  });
}

run("Coming from… profiles in real REAPER", () => {
  for (const w of WORKFLOWS) {
    it(`${w.daw}: theme loads at startup and every shortcut is bound to the right action`, async () => {
      const res = mkdtempSync(join(tmpdir(), `ka-look-${w.id}-`));
      seed(res);
      mkdirSync(join(res, "Scripts"));
      const theme = await writeTheme(res, skinFromWorkflow(w, true));
      await setThemeForNextStart(res, theme);
      await installShortcuts(res, w);
      const report = join(res, "report.json");
      const ids = [...new Set(w.shortcuts.map((s) => s.action))];
      writeFileSync(join(res, "Scripts", "__startup.lua"), `
local sec = reaper.SectionFromUniqueID(0)
local parts = {}
for _, id in ipairs({${ids.join(",")}}) do
  local keys = {}
  for i = 0, reaper.CountActionShortcuts(sec, id) - 1 do
    local _, d = reaper.GetActionShortcutDesc(sec, id, i)
    keys[#keys + 1] = string.format("%q", d)
  end
  parts[#parts + 1] = string.format('"%d":{"name":%q,"keys":[%s]}', id, reaper.kbd_getTextFromCmd(id, sec), table.concat(keys, ","))
end
local f = io.open(${JSON.stringify(report)}, "w")
f:write(string.format('{"theme":%q,"arrange":%d,"play":%d,"actions":{%s}}', reaper.GetLastColorThemeFile() or "", reaper.GetThemeColor("col_arrangebg", 0), reaper.GetThemeColor("playcursor_color", 0), table.concat(parts, ",")))
f:close()
reaper.Main_OnCommand(40004, 0)
`);
      await launch(res, report);
      const r = JSON.parse(readFileSync(report, "utf8")) as { theme: string; arrange: number; play: number; actions: Record<string, { name: string; keys: string[] }> };
      console.log(w.daw, JSON.stringify(Object.fromEntries(Object.entries(r.actions).map(([k, v]) => [k, `${v.name} ← ${v.keys.join(" | ")}`]))));
      expect(r.theme).toBe(theme);
      const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`; // GetThemeColor returns 0xRRGGBB
      expect(hex(r.arrange)).toBe(w.reaper.col_arrangebg);
      expect(hex(r.play)).toBe(w.reaper.playcursor_color);
      for (const s of w.shortcuts) {
        const a = r.actions[String(s.action)]!;
        expect(a.name, `action ${s.action}`).not.toBe("");
        expect(a.keys, `${s.does} → ${a.name}`).toContain(reaperDesc(s));
      }
    }, 60000);
  }
});

const bridge = process.env.REAPER_ASSIST_BRIDGE_DIR;
(bridge?.includes(".reaper-test") ? describe : describe.skip)("theme switch in a running REAPER (isolated test instance)", () => {
  it("loads the theme through the bridge, and refuses files outside ColorThemes", async () => {
    const { ReaperConnection } = await import("@daw/reaper/reaper");
    const reaper = new ReaperConnection(bridge!);
    const res = resolve(".reaper-test/resource");
    const w = WORKFLOWS[1]!;
    const theme = await writeTheme(res, skinFromWorkflow(w, true));
    expect(await reaper.loadColorTheme(theme)).toEqual({ ok: true, message: "Theme loaded in REAPER." });
    const bad = await reaper.loadColorTheme(join(res, "reaper.ini"));
    expect(bad.ok).toBe(false);
    const sneaky = await reaper.loadColorTheme(join(res, "ColorThemes", "..", "x.ReaperThemeZip"));
    expect(sneaky.ok).toBe(false);
  }, 60000);
});

