import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { osReaperResourcePath } from "@daw/reaper/reaper";
import { reaperInstallDirs, stockThemeIn } from "@daw/reaper/locate";
import { pickWindowsBin } from "@ai/providers/cli";

describe("REAPER on each OS", () => {
  it("knows the resource folder of a normal install", () => {
    expect(osReaperResourcePath("/Users/a", "darwin", {})).toBe(join("/Users/a", "Library", "Application Support", "REAPER"));
    expect(osReaperResourcePath("/home/a", "linux", {})).toBe(join("/home/a", ".config", "REAPER"));
    expect(osReaperResourcePath("/home/a", "linux", { XDG_CONFIG_HOME: "/x" })).toBe(join("/x", "REAPER"));
    expect(osReaperResourcePath("C:/Users/a", "win32", { APPDATA: "C:/Users/a/AppData/Roaming" })).toBe(join("C:/Users/a/AppData/Roaming", "REAPER"));
  });

  it("finds program folders that exist, and the stock theme inside them", () => {
    const home = mkdtempSync(join(tmpdir(), "ra-home-"));
    mkdirSync(join(home, "opt", "REAPER"), { recursive: true });
    expect(reaperInstallDirs("linux", { PATH: "" }, home)).toContain(join(home, "opt", "REAPER"));
    const pf = mkdtempSync(join(tmpdir(), "ra-pf-"));
    mkdirSync(join(pf, "REAPER (x64)"));
    expect(reaperInstallDirs("win32", { ProgramFiles: pf }, home)).toEqual([join(pf, "REAPER (x64)")]);
    expect(stockThemeIn("/Applications/REAPER.app")).toBe(join("/Applications/REAPER.app", "Contents", "InstallFiles", "ColorThemes", "Default_7.0.ReaperThemeZip"));
    expect(stockThemeIn("/opt/REAPER")).toBe(join("/opt/REAPER", "ColorThemes", "Default_7.0.ReaperThemeZip"));
  });

  it("uses a native .exe for the CLIs on Windows, never an npm .cmd shim", () => {
    expect(pickWindowsBin("C:\\Users\\a\\AppData\\Roaming\\npm\\claude.cmd\r\nC:\\Users\\a\\.local\\bin\\claude.exe\r\n")).toBe("C:\\Users\\a\\.local\\bin\\claude.exe");
    expect(pickWindowsBin("C:\\Users\\a\\AppData\\Roaming\\npm\\codex.cmd\r\n")).toBeNull();
  });
});
