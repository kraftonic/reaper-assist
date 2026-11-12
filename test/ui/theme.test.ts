import { describe, expect, it } from "vitest";
import { THEME_TOKENS } from "@shared/types";
import { WORKFLOWS } from "@profiles";
import { REAPER_THEME, WORKFLOW_THEMES, themeFor } from "../../src/renderer/src/theme";

describe("panel look", () => {
  it("follows the DAW profile, and REAPER's own look without one", () => {
    expect(themeFor(null)).toBe(REAPER_THEME);
    for (const w of WORKFLOWS) expect(themeFor(w.id).id).toBe(`wf-${w.id}`);
    for (const t of [REAPER_THEME, ...WORKFLOW_THEMES]) for (const k of THEME_TOKENS) expect(t.colors[k], `${t.id}.${k}`).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
