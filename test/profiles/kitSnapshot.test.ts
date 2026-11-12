import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { kitFilesOf, kitIniColorsOf, type KitDef, type MeterRange } from "@profiles/kit";
import type { SkinUi } from "@profiles/skins";
import refAbleton from "../fixtures/kit-ref/ableton";
import refFl from "../fixtures/kit-ref/fl";

/**
 * Guards the SHARED kit code (walter.ts, art.ts, raster.ts, icons.ts): two reference kits — frozen
 * copies of the FL and Ableton kits as they were when the per-DAW modules were split out
 * (test/fixtures/kit-ref) — must still produce exactly the output recorded before the split.
 * The real DAW kits (src/profiles/<id>/kit.ts) are free to change; this only fails when shared code does.
 * rtconfig.txt is pinned byte for byte; images by size and pixels (not PNG bytes, which would
 * also change with Node's zlib), digested per name group so a failure says where to look.
 */

const sha = (b: Uint8Array | string) => createHash("sha256").update(b).digest("hex");

/** The panel colours the two profiles had when the output was recorded. */
const UI: Record<string, SkinUi> = {
  fl: { bg: "#2b353b", panel: "#34414a", panelAlt: "#3c4a53", border: "#222a2f", text: "#e4eaed", textDim: "#a1b0b8", accent: "#f59a23", accentText: "#1f1303", accent2: "#8fd16a" },
  ableton: { bg: "#8d8d8d", panel: "#999999", panelAlt: "#a3a3a3", border: "#5a5a5a", text: "#111111", textDim: "#3d3d3d", accent: "#ffc907", accentText: "#111111", accent2: "#5cd9e8" },
};
const REF: Record<string, KitDef> = { fl: refFl, ableton: refAbleton };

function digest(id: string, range?: MeterRange) {
  const files = kitFilesOf(REF[id]!, UI[id]!, range);
  const groups = new Map<string, string[]>();
  for (const [path, bytes] of [...files].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (!path.endsWith(".png")) continue;
    const group = path.replace(/^(150|200)\//, "").split("_")[0]!;
    const p = PNG.sync.read(Buffer.from(bytes));
    groups.set(group, [...(groups.get(group) ?? []), `${path} ${p.width}x${p.height} ${sha(p.data)}`]);
  }
  return {
    files: files.size,
    rtconfig: sha(files.get("rtconfig.txt")!),
    images: Object.fromEntries([...groups].map(([g, lines]) => [g, sha(lines.join("\n")).slice(0, 16)])),
  };
}

// 2026-11-05: the shared art now blanks REAPER's clip badges (item_props*, item_seldot): +15 files, new "item" group.
const PINS: Record<string, ReturnType<typeof digest>> = {
  fl: {
    files: 735,
    rtconfig: "233bc9392ee37c7d40a899723f05430219039166f34659e74b3c2daae558a015",
    images: { envcp: "83469e6ba9e2cc33", gen: "399fbe05fe807cc5", global: "98ab33d2c598fd94", item: "29937a9c1f399d7b", k: "09ad1d6b89b46b1d", knob: "1fb3af501dc55b3c", master: "613398ac29410081", mcp: "be052706b3ab8843", mixer: "edceed4e9d3a89fb", tcp: "3427a005f5b8f0a6", toolbar: "a00aafd1f648836b", track: "276afbcc2cfd9fa7", transport: "000e332fa5c90a6e", meter: "cb670a1d3177c687" },
  },
  ableton: {
    files: 763,
    rtconfig: "9e5265a1a1a7f135881d1546a37f0f806f394baa43441480eb8562f021db4de7",
    images: { envcp: "2c1f28c7ebc0638c", gen: "399fbe05fe807cc5", global: "0a5db1e69d81c23f", item: "29937a9c1f399d7b", k: "095cfa01db949094", knob: "43edde842d823ce9", master: "b09d6957e9860664", mcp: "32fe51a6851ce209", mixer: "f2f4b2c0c60684a6", tcp: "e4898e3b9cc7d453", toolbar: "ab1a2b46ade0c7f6", track: "88318a7bb8c26fd5", transport: "ba90892be03ac8f1", meter: "866dabbec918595f", midi: "9df8808d4555537b" },
  },
  "ableton:0..-48": {
    files: 763,
    rtconfig: "2db6984651fdb32337336e1bd4ace5373eb2396b1a172094e9fbe799e8a4aa0d",
    images: { envcp: "2c1f28c7ebc0638c", gen: "399fbe05fe807cc5", global: "0a5db1e69d81c23f", item: "29937a9c1f399d7b", k: "095cfa01db949094", knob: "43edde842d823ce9", master: "b09d6957e9860664", mcp: "32fe51a6851ce209", mixer: "f2f4b2c0c60684a6", tcp: "e4898e3b9cc7d453", toolbar: "ab1a2b46ade0c7f6", track: "88318a7bb8c26fd5", transport: "ba90892be03ac8f1", meter: "866dabbec918595f", midi: "9df8808d4555537b" },
  },
};

const INI: Record<string, Record<string, string>> = {
  fl: { col_vubot: "#8fd16a", col_vumid: "#d8e25a", col_vutop: "#f59a23", col_vuclip: "#ff4d3d", col_vuintcol: "#181d20", col_vumidi: "#a4d78b" },
  ableton: { col_vubot: "#0af864", col_vumid: "#5ff864", col_vutop: "#c6f864", col_vuclip: "#ff0a0a", col_vuintcol: "#181e23", col_vumidi: "#49a7b2" },
};

describe("shared kit code output is pinned (reference kits)", () => {
  for (const id of ["fl", "ableton"]) {
    it(`${id} reference: rtconfig and every image are unchanged`, () => {
      expect(digest(id)).toEqual(PINS[id]);
      expect(kitIniColorsOf(REF[id]!.palette(UI[id]!))).toEqual(INI[id]);
    });
  }

  it("Ableton reference with a custom meter range (scale marks move)", () => {
    expect(digest("ableton", { max: 0, min: -48 })).toEqual(PINS["ableton:0..-48"]);
  });
});
