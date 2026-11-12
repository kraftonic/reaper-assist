import { describe, expect, it } from "vitest";
import { withBridgeBlock } from "@daw/reaper/install";

const count = (s: string) => s.split("assist_bridge.lua").length - 1;

describe("bridge autostart block", () => {
  it("adds one block to a new start-up file", () => {
    const out = withBridgeBlock("");
    expect(count(out)).toBe(1);
    expect(out).toMatch(/^-- >>> REAPER Assist bridge/);
  });

  it("collapses blocks written by older builds and the dev installer into one, keeping the user's lines", () => {
    const existing = [
      "-- my line",
      "-- >>> REAPER Assist bridge (added by reaper-assist; remove with npm run reaper:install -- --uninstall)",
      'dofile(reaper.GetResourcePath() .. "/Scripts/ReaperAssist/assist_bridge.lua")',
      "-- <<< REAPER Assist bridge",
      "",
      "-- >>> REAPER Assist profile (added by REAPER Assist)",
      'dofile(reaper.GetResourcePath() .. "/Scripts/ReaperAssist/Profile/startup.lua")',
      "-- <<< REAPER Assist profile",
      "",
      "-- >>> REAPER Assist bridge (added by REAPER Assist; remove this block to stop autostart)",
      'dofile(reaper.GetResourcePath() .. "/Scripts/ReaperAssist/assist_bridge.lua")',
      "-- <<< REAPER Assist bridge",
      "",
    ].join("\r\n");
    const out = withBridgeBlock(existing);
    expect(count(out)).toBe(1);
    expect(out).toContain("-- my line");
    expect(out).toContain("Profile/startup.lua");
    expect(withBridgeBlock(out)).toBe(out);
  });
});
