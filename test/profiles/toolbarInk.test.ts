import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { toolbarIconFiles, toolbarInk } from "@profiles/kit/toolbarIcons";
import { WORKFLOWS, type Workflow } from "@profiles";
import type { Glyph } from "@profiles/kit/types";
import { rect } from "@profiles/kit/raster";

// A glyph that fills its whole 30 px frame, so every frame's colour can be read at its centre.
const cell: Glyph = () => rect(0, 0, 30, 30);
const base = WORKFLOWS.find((w) => w.id === "protools")!;
const w: Workflow = {
  ...base,
  toolbars: [{ ...base.toolbars![0]!, items: [
    { action: 40001, label: "a", icon: "assist_test_tool" },
    { action: 40002, label: "b", icon: "assist_test_mode" },
  ] }],
};
// Centre pixel of frame f (0 normal, 1 hover, 2 on) as #rrggbb.
const frame = (png: Uint8Array, f: number) => {
  const p = PNG.sync.read(Buffer.from(png));
  const i = (15 * p.width + 15 + f * 30) * 4;
  return "#" + [...p.data.slice(i, i + 3)].map((v) => v.toString(16).padStart(2, "0")).join("");
};

describe("toolbar icon ink", () => {
  it("defaults to the panel's dim text, text and accent", () => {
    expect(toolbarInk(w)).toEqual({ normal: w.panel.textDim, hover: w.panel.text, on: w.panel.accent });
    expect(toolbarInk(w, { on: "#ffffff" })).toEqual({ normal: w.panel.textDim, hover: w.panel.text, on: "#ffffff" });
  });

  it("lets single icons light in their own colour", () => {
    const files = toolbarIconFiles(w, { assist_test_tool: cell, assist_test_mode: cell }, { normal: "#101010", hover: "#202020", on: "#2266dd" }, { assist_test_mode: { on: "#22cc44" } });
    expect(frame(files.get("assist_test_tool.png")!, 2)).toBe("#2266dd");
    expect(frame(files.get("assist_test_mode.png")!, 2)).toBe("#22cc44");
    expect(frame(files.get("assist_test_mode.png")!, 0)).toBe("#101010");
  });
});
