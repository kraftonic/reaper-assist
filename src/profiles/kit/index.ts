import type { ReaperSkin, SkinUi } from "../skins";
import { drawImages } from "./art";
import { mixc, png, rgbHex } from "./raster";
import { KITS, kitFor } from "./registry";
import type { Draw, Kit, KitDef, MeterRange } from "./types";
import { DEFAULT_METER_RANGE, rtconfigFor } from "./walter";

export { KITS, kitFor } from "./registry";
export type { Kit, KitDef, KitId, MeterRange } from "./types";
export { DEFAULT_METER_RANGE } from "./walter";

/** Every image a kit draws, by REAPER image name. */
export const kitImages = (k: Kit): Record<string, Draw> => drawImages(KITS[k.id], k);

/** A kit's rtconfig.txt (its layout) for the user's meter range. */
export const kitRtconfig = (k: Kit, range: MeterRange = DEFAULT_METER_RANGE): string => rtconfigFor(KITS[k.id], k, range);

const SCALES: [number, string][] = [[1, ""], [1.5, "150/"], [2, "200/"]];

/**
 * The files a kit adds to the theme folder: rtconfig.txt and every image at
 * 100/150/200 %. Paths are relative to the theme's image folder. `meters` is the
 * user's meter range, for scales drawn beside meters.
 */
export function kitFiles(skin: ReaperSkin, meters: MeterRange = DEFAULT_METER_RANGE): Map<string, Uint8Array> | null {
  if (!skin.kit) return null;
  return kitFilesOf(KITS[skin.kit], skin.ui, meters);
}

/**
 * Images REAPER reads pixel by pixel (meter strips, backgrounds, clip marks, note colour maps): REAPER only
 * has them at 100 %. The meter badges (meter_mute, meter_unsolo, …) are drawn images with 150 / 200 %
 * versions in Default 7, so they're written at every scale like the rest.
 */
export const PIXEL_READ = /^meter_(strip|bg|clip)_|_colormap$/;

/** kitFiles for a kit definition (tests pin reference kits through this). */
export function kitFilesOf(def: KitDef, ui: SkinUi, meters: MeterRange = DEFAULT_METER_RANGE): Map<string, Uint8Array> {
  const k = def.palette(ui);
  const files = new Map<string, Uint8Array>();
  files.set("rtconfig.txt", Buffer.from(rtconfigFor(def, k, meters), "latin1"));
  // Aliased entries (the same drawing under two names) are drawn once per scale.
  const cache = new Map<unknown, Map<number, Uint8Array>>();
  for (const [name, draw] of Object.entries(drawImages(def, k))) {
    let byScale = cache.get(draw);
    if (!byScale) cache.set(draw, (byScale = new Map()));
    for (const [s, dir] of PIXEL_READ.test(name) ? SCALES.slice(0, 1) : SCALES) {
      let bytes = byScale.get(s);
      if (!bytes) byScale.set(s, (bytes = png(draw(s))));
      files.set(`${dir}${name}.png`, bytes);
    }
  }
  return files;
}

/** Names (without extension and scale folder) of the images a kit draws. Their Default 7 overlays must go. */
export function kitImageNames(files: Map<string, Uint8Array>): Set<string> {
  const names = new Set<string>();
  for (const p of files.keys()) if (p.endsWith(".png")) names.add(p.replace(/^(150|200)\//, "").replace(/\.png$/, ""));
  return names;
}

/** [color theme] keys a kit sets (meter colours), as #rrggbb. */
export function kitIniColors(skin: ReaperSkin): Record<string, string> {
  return skin.kit ? kitIniColorsOf(kitFor(skin.kit, skin.ui)) : {};
}

export function kitIniColorsOf(k: Kit): Record<string, string> {
  const m = k.c.meter;
  return {
    col_vubot: rgbHex(m.low), col_vumid: rgbHex(m.mid), col_vutop: rgbHex(m.high), col_vuclip: rgbHex(m.clip), col_vuintcol: rgbHex(m.off),
    // The thin MIDI activity bar beside track meters.
    col_vumidi: rgbHex(mixc(k.c.accent2, k.c.text, 0.25)),
  };
}
