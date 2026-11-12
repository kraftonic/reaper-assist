import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { jpegWith, pngWith } from "../fixtures/images";
import { IMAGE_LIMITS, fitImage } from "@shared/images";
import { checkImage, placeholderFor, placeholderId, sniffImage, stripMetadata } from "@ai/providers/images";

describe("image limits", () => {
  it("fits the long edge and the pixel budget, never upscales", () => {
    expect(fitImage(800, 600)).toEqual({ width: 800, height: 600, scaled: false });
    const wide = fitImage(3840, 2160);
    expect(wide.scaled).toBe(true);
    expect(Math.max(wide.width, wide.height)).toBeLessThanOrEqual(IMAGE_LIMITS.maxEdge);
    expect(wide.width * wide.height).toBeLessThanOrEqual(IMAGE_LIMITS.maxPixels);
    expect(wide.width / wide.height).toBeCloseTo(16 / 9, 1);
    const tall = fitImage(1000, 4000);
    expect(tall.height).toBeLessThanOrEqual(IMAGE_LIMITS.maxEdge);
    expect(fitImage(0, 10).width).toBe(0);
  });
});

describe("image bytes", () => {
  it("reads format and size from PNG and JPEG headers", () => {
    expect(sniffImage(pngWith(31, 17))).toEqual({ mime: "image/png", width: 31, height: 17 });
    expect(sniffImage(jpegWith(1280, 720))).toEqual({ mime: "image/jpeg", width: 1280, height: 720 });
    expect(sniffImage(Buffer.from("GIF89a......"))).toBeNull();
    expect(sniffImage(Buffer.from("<svg></svg>"))).toBeNull();
  });

  it("strips PNG text, EXIF and time chunks and keeps a valid image", () => {
    const dirty = pngWith(4, 3, [
      ["tEXt", "Author\0Jane Producer"],
      ["eXIf", "MM\0*GPS"],
      ["tIME", "\x07\xea\x0b\x05\x0c\x00\x00"],
      ["iTXt", "XML:com.adobe.xmp\0\0\0\0\0<x>owner</x>"],
      ["gAMA", "\0\0\xb1\x8f"],
    ]);
    const clean = stripMetadata(dirty, "image/png");
    const text = clean.toString("latin1");
    for (const gone of ["tEXt", "eXIf", "tIME", "iTXt", "Jane Producer", "GPS", "owner"]) expect(text).not.toContain(gone);
    expect(text).toContain("gAMA");
    const back = PNG.sync.read(clean);
    expect([back.width, back.height]).toEqual([4, 3]);
    expect([...back.data.subarray(0, 4)]).toEqual([200, 40, 90, 255]);
  });

  it("strips JPEG EXIF, XMP, IPTC and comments but keeps JFIF, ICC, the frame and the scan", () => {
    const clean = stripMetadata(jpegWith(640, 480), "image/jpeg");
    const text = clean.toString("latin1");
    for (const gone of ["Exif", "GPSLatitude", "secret-camera-serial", "owner@example.com", "IPTC", "a comment"]) expect(text).not.toContain(gone);
    expect(text).toContain("JFIF");
    expect(text).toContain("ICC_PROFILE");
    expect(sniffImage(clean)).toEqual({ mime: "image/jpeg", width: 640, height: 480 });
    expect(clean.subarray(-7)).toEqual(Buffer.from([0x12, 0x34, 0xff, 0x00, 0x56, 0xff, 0xd9]));
  });

  it("checks what the panel sends: real image, sane size, cleaned", () => {
    const ok = checkImage(pngWith(20, 10, [["tEXt", "Comment\0hello"]]).toString("base64"));
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok).toMatchObject({ mime: "image/png", width: 20, height: 10 });
      expect(ok.data.toString("latin1")).not.toContain("hello");
    }
    expect(checkImage("")).toMatchObject({ ok: false });
    expect(checkImage(Buffer.from("not an image at all").toString("base64"))).toMatchObject({ ok: false, message: expect.stringMatching(/PNG or JPEG/) });
    expect(checkImage(jpegWith(9000, 100).toString("base64"))).toMatchObject({ ok: false, message: expect.stringMatching(/9000×100/) });
    expect(checkImage("A".repeat(IMAGE_LIMITS.maxBytes * 2))).toMatchObject({ ok: false, message: expect.stringMatching(/too large/) });
  });

  it("marks image placeholders in saved history", () => {
    expect(placeholderId(placeholderFor("abc"))).toBe("abc");
    expect(placeholderId("iVBORw0KGgo")).toBeNull();
    expect(placeholderId(undefined)).toBeNull();
  });
});
