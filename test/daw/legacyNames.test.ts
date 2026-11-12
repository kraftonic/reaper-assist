import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { removeLegacyBridge, withBridgeBlock } from "@daw/reaper/install";
import { allProfileKeymapLines, isAssistKbLine } from "@profiles";
import { withoutStartupBlock } from "@profiles/engine/files";
import { removeAssistFiles, removeAssistThemes } from "@profiles/engine/restore";

// Installs made before the rename (Kraftonic Assist) must be cleaned up by this build.
describe("names from before the rename", () => {
  it("replaces the old bridge start-up block with the new one", () => {
    const old = ["-- mine", "-- >>> Kraftonic Assist bridge (added by Kraftonic Assist)", 'dofile(reaper.GetResourcePath() .. "/Scripts/KraftonicAssist/kraftonic_bridge.lua")', "-- <<< Kraftonic Assist bridge", ""].join("\n");
    const out = withBridgeBlock(old);
    expect(out).not.toContain("kraftonic_bridge");
    expect(out).toContain("-- mine");
    expect(out).toContain("Scripts/ReaperAssist/assist_bridge.lua");
  });

  it("removes the old profile start-up block", () => {
    const old = "-- mine\n\n-- >>> Kraftonic Assist profile (added by Kraftonic Assist)\ndofile(x)\n-- <<< Kraftonic Assist profile\n";
    expect(withoutStartupBlock(old)).toBe("-- mine\n");
  });

  it("recognises the old shortcut and script lines", () => {
    expect(isAssistKbLine('SCR 4 0 RS_kraftonic_fl_tool_draw "Custom: Kraftonic: Draw" "KraftonicAssist/Profile/fl_tool.lua"')).toBe(true);
    expect(isAssistKbLine("KEY 1 66 _RS_kraftonic_fl_tool_draw 0")).toBe(true);
    expect(isAssistKbLine("KEY 1 66 _RS_assist_fl_tool_draw 0")).toBe(true);
    expect(isAssistKbLine("KEY 1 66 _RS_someone_else 0")).toBe(false);
    const lines = allProfileKeymapLines();
    const renamed = lines.filter((l) => l.includes("assist_")).map((l) => l.replaceAll("assist_", "kraftonic_"));
    for (const l of renamed) expect(lines).toContain(l);
  });

  it("deletes the old bridge, themes, icons and profile scripts, and nothing else", async () => {
    const r = mkdtempSync(join(tmpdir(), "ra-legacy-"));
    mkdirSync(join(r, "Scripts", "KraftonicAssist", "Profile"), { recursive: true });
    writeFileSync(join(r, "Scripts", "KraftonicAssist", "kraftonic_bridge.lua"), "");
    writeFileSync(join(r, "Scripts", "KraftonicAssist", "Profile", "fl_tool.lua"), "");
    mkdirSync(join(r, "KraftonicAssist", "bridge"), { recursive: true });
    mkdirSync(join(r, "ColorThemes"));
    for (const n of ["Kraftonic - FL.ReaperThemeZip", "Assist - FL.ReaperThemeZip", "Mine.ReaperThemeZip"]) writeFileSync(join(r, "ColorThemes", n), "");
    mkdirSync(join(r, "Data", "toolbar_icons"), { recursive: true });
    for (const n of ["kraftonic_fl_x.png", "assist_fl_x.png", "mine.png"]) writeFileSync(join(r, "Data", "toolbar_icons", n), "");

    await removeAssistFiles(r);
    await removeAssistThemes(r, null);
    await removeLegacyBridge(r);

    expect(existsSync(join(r, "Scripts", "KraftonicAssist"))).toBe(false);
    expect(existsSync(join(r, "KraftonicAssist"))).toBe(false);
    expect(readdirSync(join(r, "ColorThemes"))).toEqual(["Mine.ReaperThemeZip"]);
    expect(readdirSync(join(r, "Data", "toolbar_icons"))).toEqual(["mine.png"]);
  });
});
