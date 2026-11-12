import { IMAGE_LIMITS, fitImage } from "@shared/images";
import type { ImageMime } from "@shared/types";
import { api } from "../api";

/** An image waiting in the chat box: already downsized and re-encoded (no EXIF, no GPS). */
export interface PendingImage {
  key: string;
  mime: ImageMime;
  /** Base64, no prefix. */
  data: string;
  /** data: URL for the thumbnail. */
  url: string;
  width: number;
  height: number;
  bytes: number;
  name?: string;
}

/** Images worth trying from a paste or drop (anything the browser may be able to decode). */
export function imageFiles(list: ArrayLike<File> | null | undefined): File[] {
  return Array.from(list ?? []).filter((f) => f.type.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|avif|heic|tiff?)$/i.test(f.name));
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** PNG stays sharp for screenshots; photos (and PNGs that come out huge) go JPEG. */
const PNG_MAX = 1_500_000;

/**
 * Read an image file, scale it to fit (1568 px long edge, ~1.15 MP), and
 * re-encode it. Drawing to a canvas drops all metadata and applies the photo's
 * rotation to the pixels.
 */
export async function prepareImage(file: Blob, name?: string): Promise<PendingImage> {
  if (file.size > IMAGE_LIMITS.maxSourceBytes) throw new Error("That image is too big to attach (40 MB max).");
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(`Couldn't read ${name ? `“${name}”` : "that image"}. Attach a PNG, JPEG, WebP or GIF.`);
  }
  const size = fitImage(bmp.width, bmp.height);
  const canvas = new OffscreenCanvas(size.width, size.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't prepare the image.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const draw = (background?: string) => {
    ctx.clearRect(0, 0, size.width, size.height);
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, size.width, size.height);
    }
    ctx.drawImage(bmp, 0, 0, size.width, size.height);
  };
  let mime: ImageMime = file.type === "image/jpeg" ? "image/jpeg" : "image/png";
  let blob: Blob;
  if (mime === "image/png") {
    draw();
    blob = await canvas.convertToBlob({ type: "image/png" });
    if (blob.size > PNG_MAX) mime = "image/jpeg";
  }
  if (mime === "image/jpeg") {
    draw("#ffffff"); // JPEG has no transparency
    blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.86 });
  }
  bmp.close();
  const data = toBase64(await blob!.arrayBuffer());
  if (blob!.size > IMAGE_LIMITS.maxBytes) throw new Error("That image is still too large after shrinking it. Try a smaller screenshot.");
  return {
    key: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    mime,
    data,
    url: `data:${mime};base64,${data}`,
    width: size.width,
    height: size.height,
    bytes: blob!.size,
    ...(name && !/^image\.(png|jpe?g)$/i.test(name) ? { name } : {}),
  };
}

/* ------------------------------------------------------------- thumbnails */

const cache = new Map<string, string>();
const loading = new Map<string, Promise<string | null>>();

/** Remember a preview under a key (used for images that are still being sent). */
export function seedImage(key: string, url: string): void {
  cache.set(key, url);
}

export function cachedImage(convId: string, imageId: string): string | null {
  return cache.get(`${convId}/${imageId}`) ?? cache.get(imageId) ?? null;
}

/** A stored image as a data: URL (fetched once, then cached for the session). */
export function loadImage(convId: string, imageId: string): Promise<string | null> {
  const key = `${convId}/${imageId}`;
  const hit = cachedImage(convId, imageId);
  if (hit) return Promise.resolve(hit);
  let p = loading.get(key);
  if (!p) {
    p = api
      .getImage(convId, imageId)
      .then((url) => {
        if (url) cache.set(key, url);
        while (cache.size > 80) cache.delete(cache.keys().next().value!);
        return url;
      })
      .catch(() => null)
      .finally(() => loading.delete(key));
    loading.set(key, p);
  }
  return p;
}
