import type { ImageMime } from "@shared/types";
import { IMAGE_LIMITS } from "@shared/images";

/**
 * Images attached to chat messages. The panel downsizes and re-encodes them,
 * which already drops EXIF/GPS; this side checks the bytes again and strips
 * any metadata that is left before an image is stored or sent anywhere.
 */

/** Reads an attached image's bytes by id. Images live with the chat, not in the provider history. */
export type ImageLoader = (id: string) => { mime: ImageMime; base64: string } | null;

/** Stands in for the pixels inside saved provider history; swapped for the real data at request time. */
export const IMAGE_PLACEHOLDER = "ka-image:";
export const placeholderFor = (id: string) => `${IMAGE_PLACEHOLDER}${id}`;
export function placeholderId(v: unknown): string | null {
  return typeof v === "string" && v.startsWith(IMAGE_PLACEHOLDER) ? v.slice(IMAGE_PLACEHOLDER.length) : null;
}

export interface SniffedImage {
  mime: ImageMime;
  width: number;
  height: number;
}

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Format and size from the file's own header. Null for anything that isn't a PNG or JPEG. */
export function sniffImage(buf: Buffer): SniffedImage | null {
  if (buf.length >= 24 && buf.subarray(0, 8).equals(PNG_SIG) && buf.toString("latin1", 12, 16) === "IHDR") {
    return { mime: "image/png", width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 4 <= buf.length) {
      if (buf[i] !== 0xff) return null;
      const marker = buf[i + 1]!;
      if (marker === 0xff) {
        i++; // fill byte
        continue;
      }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2;
        continue;
      }
      if (marker === 0xd9 || marker === 0xda) return null; // reached the image data without a frame header
      const len = buf.readUInt16BE(i + 2);
      if (len < 2) return null;
      const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isFrame && i + 9 <= buf.length) return { mime: "image/jpeg", height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      i += 2 + len;
    }
  }
  return null;
}

/** PNG chunks that only affect how pixels look. Everything else ancillary (text, EXIF, time, animation) goes. */
const PNG_KEEP = new Set(["IHDR", "PLTE", "IDAT", "IEND", "tRNS", "gAMA", "cHRM", "sRGB", "iCCP", "sBIT", "pHYs"]);

/** JPEG segments worth keeping: JFIF header (APP0) and Adobe colour transform (APP14). ICC profiles (APP2) are kept too. */
function keepJpegSegment(marker: number, body: Buffer): boolean {
  if (marker === 0xfe) return false; // comment
  if (marker === 0xe0 || marker === 0xee) return true;
  if (marker === 0xe2) return body.toString("latin1", 0, 12) === "ICC_PROFILE\0";
  if (marker >= 0xe1 && marker <= 0xef) return false; // EXIF, XMP, IPTC, …
  return true;
}

/** The same image without metadata (EXIF, GPS, XMP, IPTC, comments, text chunks). */
export function stripMetadata(buf: Buffer, mime: ImageMime): Buffer {
  if (mime === "image/png") {
    const out: Buffer[] = [PNG_SIG];
    let i = 8;
    while (i + 12 <= buf.length) {
      const len = buf.readUInt32BE(i);
      const type = buf.toString("latin1", i + 4, i + 8);
      const end = i + 12 + len;
      if (end > buf.length) break;
      if (PNG_KEEP.has(type)) out.push(buf.subarray(i, end));
      i = end;
      if (type === "IEND") break;
    }
    return Buffer.concat(out);
  }
  const out: Buffer[] = [buf.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) break;
    const marker = buf[i + 1]!;
    if (marker === 0xff) {
      i++;
      continue;
    }
    if (marker === 0xda) {
      out.push(buf.subarray(i)); // scan data and everything after it, untouched
      return Buffer.concat(out);
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      out.push(buf.subarray(i, i + 2));
      i += 2;
      continue;
    }
    const len = buf.readUInt16BE(i + 2);
    const end = i + 2 + len;
    if (len < 2 || end > buf.length) break;
    if (keepJpegSegment(marker, buf.subarray(i + 4, end))) out.push(buf.subarray(i, end));
    i = end;
  }
  out.push(buf.subarray(i));
  return Buffer.concat(out);
}

export type CheckedImage = { ok: true; mime: ImageMime; width: number; height: number; data: Buffer } | { ok: false; message: string };

/** Decode, check and clean an image the panel sent. */
export function checkImage(base64: unknown): CheckedImage {
  if (typeof base64 !== "string" || !base64) return { ok: false, message: "The image was empty." };
  if (base64.length > Math.ceil((IMAGE_LIMITS.maxBytes * 4) / 3) + 8) return { ok: false, message: "That image is too large. Try a smaller screenshot." };
  const raw = Buffer.from(base64, "base64");
  const info = sniffImage(raw);
  if (!info) return { ok: false, message: "That file isn't a PNG or JPEG image." };
  if (info.width < 1 || info.height < 1 || info.width > IMAGE_LIMITS.maxDimension || info.height > IMAGE_LIMITS.maxDimension) {
    return { ok: false, message: `That image is ${info.width}×${info.height} pixels; the limit is ${IMAGE_LIMITS.maxDimension} on each side.` };
  }
  const data = stripMetadata(raw, info.mime);
  if (data.length > IMAGE_LIMITS.maxBytes) return { ok: false, message: "That image is too large. Try a smaller screenshot." };
  return { ok: true, ...info, data };
}
