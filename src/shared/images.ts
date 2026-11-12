/**
 * Limits for images attached to chat messages. Shared by the panel (which
 * downsizes before sending) and the main process (which checks again).
 */
export const IMAGE_LIMITS = {
  /** Longest edge after downsizing. Claude reads up to this size without scaling again. */
  maxEdge: 1568,
  /** Pixel budget after downsizing (Claude's sweet spot, about 1.15 megapixels). */
  maxPixels: 1_150_000,
  /** Largest image the main process accepts, in bytes (keeps base64 under every provider's 5 MB cap). */
  maxBytes: 3_700_000,
  /** Largest source the panel will try to read, in bytes. */
  maxSourceBytes: 40_000_000,
  /** Images per message. */
  perMessage: 6,
  /** Largest width or height the main process accepts. */
  maxDimension: 8000,
} as const;

/** The size an image is scaled to before sending: fits the long edge and the pixel budget, never upscales. */
export function fitImage(width: number, height: number, maxEdge: number = IMAGE_LIMITS.maxEdge, maxPixels: number = IMAGE_LIMITS.maxPixels): { width: number; height: number; scaled: boolean } {
  if (!(width > 0 && height > 0)) return { width: 0, height: 0, scaled: false };
  const scale = Math.min(1, maxEdge / Math.max(width, height), Math.sqrt(maxPixels / (width * height)));
  if (scale >= 1) return { width, height, scaled: false };
  return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)), scaled: true };
}

/** "1.2 MB", "340 KB". */
export function formatBytes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1000))} KB`;
}
