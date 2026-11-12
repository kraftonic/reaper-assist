import { describe, expect, it } from "vitest";
import { artKind } from "@profiles/kit/skinArt";
import { drawKnobStack, restyleButtons, restyleThumb, type Img } from "@profiles/kit/skinStyle";
import { skinFromWorkflow, type ArtStyle } from "@profiles/skins";
import { WORKFLOWS } from "@profiles";

const MAGENTA = [255, 0, 255, 255];

/** A Default 7 style button strip: 1px guide border, 3 frames of a bevelled translucent body with a "+" glyph. */
function button(): Img {
  const fw = 40, h = 40, W = fw * 3 + 2, H = h + 2;
  const data = new Uint8Array(W * H * 4);
  const set = (x: number, y: number, c: number[]) => data.set(c, (y * W + x) * 4);
  set(0, 0, MAGENTA);
  for (let y = H - 5; y < H; y++) set(W - 1, y, MAGENTA);
  for (let f = 0; f < 3; f++)
    for (let y = 1; y <= h; y++)
      for (let x = 1; x <= fw; x++) {
        const lx = x - 1, ly = y - 1;
        if (lx === 0 || lx === fw - 1) continue; // gap between frames
        const shade = 70 - ly + f * 15; // vertical gradient, lighter hover
        const plus = (Math.abs(lx - 20) <= 1 && ly >= 12 && ly <= 28) || (Math.abs(ly - 20) <= 1 && lx >= 12 && lx <= 28);
        set(x + f * fw, y, plus ? [230, 230, 230, 255] : [shade, shade, shade, 190]);
      }
  return { width: W, height: H, data };
}

const at = (img: Img, x: number, y: number) => [...img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 4)];
const pill: ArtStyle = { corner: 0.5, surface: "glass", light: false };
const square: ArtStyle = { corner: 0, surface: "flat", light: false };

describe("button shapes", () => {
  it("redraws the body in the skin's shape and keeps size, guides and glyph", () => {
    const src = button();
    const a: Img = { ...src, data: new Uint8Array(src.data) };
    const b: Img = { ...src, data: new Uint8Array(src.data) };
    expect(restyleButtons(a, src, pill, 2)).toBe(true);
    expect(restyleButtons(b, src, square, 2)).toBe(true);
    for (const img of [a, b]) {
      expect(img.data.length).toBe(src.data.length);
      expect(at(img, 0, 0)).toEqual(MAGENTA);
      expect(at(img, img.width - 1, img.height - 1)).toEqual(MAGENTA);
      // The "+" is still there, in every frame.
      for (let f = 0; f < 3; f++) expect(at(img, 1 + f * 40 + 20, 1 + 20)[0]).toBeGreaterThan(150);
    }
    // Corner of the first frame's body: empty on the pill, filled on the square button.
    expect(at(a, 4, 4)[3]).toBeLessThan(120);
    expect(at(b, 4, 4)[3]).toBeGreaterThan(120);
  });

  it("leaves bare icons alone", () => {
    const W = 120, H = 40, data = new Uint8Array(W * H * 4);
    for (let i = 0; i < 30; i++) data.set([200, 200, 200, 255], ((20 * W) + 45 + i) * 4); // a thin line, no body
    const img: Img = { width: W, height: H, data };
    const before = new Uint8Array(data);
    expect(restyleButtons(img, { ...img, data: before }, square, 1)).toBe(false);
    expect(img.data).toEqual(before);
  });
});

describe("knobs and thumbs", () => {
  it("draws every rotation frame, pointer moving from lower left to lower right", () => {
    const s = 40, n = 25;
    const img: Img = { width: s, height: s * n, data: new Uint8Array(s * s * n * 4) };
    const k = { body: [80, 80, 80] as [number, number, number], rim: [20, 20, 20] as [number, number, number], pointer: [255, 255, 255] as [number, number, number], arc: [255, 150, 0] as [number, number, number], track: [40, 40, 40] as [number, number, number] };
    expect(drawKnobStack(img, { corner: 0.3, surface: "gradient", light: false }, k, 2, false)).toBe(true);
    const bright = (frame: number, x: number, y: number) => at(img, x, frame * s + y)[0]!;
    expect(bright(0, 12, 27)).toBeGreaterThan(200); // pointer toward 7:30 in the first frame
    expect(bright(n - 1, 27, 27)).toBeGreaterThan(200); // toward 4:30 in the last
    expect(bright(0, 27, 27)).toBeLessThan(200);
  });

  it("turns a fader cap into the skin's cap, keeping guide pixels", () => {
    const W = 30, H = 31, data = new Uint8Array(W * H * 4);
    data.set(MAGENTA, ((H - 1) * W) * 4);
    for (let y = 2; y < 28; y++) for (let x = 8; x < 22; x++) data.set([180, 180, 180, 255], (y * W + x) * 4);
    const img: Img = { width: W, height: H, data };
    expect(restyleThumb(img, square, [240, 240, 240], [255, 140, 0], 1, false)).toBe(true);
    expect(at(img, 0, H - 1)).toEqual(MAGENTA);
    expect([13, 14, 15, 16].some((x) => { const [r, g, b] = at(img, x, 15); return r! > 240 && g! < 170 && b! < 60; })).toBe(true); // orange centre line
    expect(at(img, 9, 15)[3]).toBe(0); // square skins get a slim cap
  });
});

describe("which artwork gets reshaped", () => {
  it("classifies Default 7 file names", () => {
    expect(artKind("200/track_mute_off_ol.png")).toBe("button");
    expect(artKind("transport_play_ol.png")).toBe("button");
    expect(artKind("150/tcp_vol_knob_stack.png")).toBe("knob");
    expect(artKind("mcp_volthumb.png")).toBe("thumb");
    expect(artKind("tcp_volbg.png")).toBeNull();
    expect(artKind("meter_mute.png")).toBeNull();
    expect(artKind("tcp_fxlist_norm.png")).toBeNull();
  });

  it("gives each full profile kit a shape style", () => {
    for (const w of WORKFLOWS) expect(skinFromWorkflow(w, true).art, w.id).toBeDefined();
    expect(skinFromWorkflow(WORKFLOWS.find((w) => w.id === "ableton")!, true).art!.corner).toBeLessThan(0.1);
  });
});
