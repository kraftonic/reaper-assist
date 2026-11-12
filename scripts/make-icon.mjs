// Draws the app icon (build/icon.png, 1024 x 1024) from code: a waveform on a dark rounded tile.
// electron-builder makes the macOS .icns and Windows .ico from it. Run: node scripts/make-icon.mjs
import { writeFileSync } from "node:fs";
import { PNG } from "pngjs";

const S = 1024;
const png = new PNG({ width: S, height: S });
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const inRound = (x, y, x0, y0, x1, y1, r) => {
  const cx = Math.min(Math.max(x, x0 + r), x1 - r), cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};
// Tile: macOS-style margin and corner radius.
const M = 100, R = 185;
const top = [36, 40, 50], bottom = [17, 19, 24];
// Bars: heights of a waveform, accent going from teal to violet.
const heights = [0.26, 0.48, 0.78, 0.56, 0.92, 0.62, 0.38, 0.2];
const bw = 58, gap = 34, total = heights.length * bw + (heights.length - 1) * gap, x0 = (S - total) / 2;
const c1 = [52, 211, 196], c2 = [129, 140, 248];
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    let px = [0, 0, 0, 0];
    // 4x supersampling for smooth edges.
    let acc = [0, 0, 0], cover = 0;
    for (const [dx, dy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
      const sx = x + dx, sy = y + dy;
      if (!inRound(sx, sy, M, M, S - M, S - M, R)) continue;
      let c = mix(top, bottom, (sy - M) / (S - 2 * M));
      for (let i = 0; i < heights.length; i++) {
        const bx = x0 + i * (bw + gap), h = heights[i] * 560;
        if (inRound(sx, sy, bx, S / 2 - h / 2, bx + bw, S / 2 + h / 2, bw / 2)) c = mix(c1, c2, i / (heights.length - 1));
      }
      acc = acc.map((v, k) => v + c[k]);
      cover++;
    }
    if (cover) px = [...acc.map((v) => Math.round(v / cover)), Math.round((255 * cover) / 4)];
    png.data.set(px, (y * S + x) * 4);
  }
}
writeFileSync(new URL("../build/icon.png", import.meta.url), PNG.sync.write(png));
