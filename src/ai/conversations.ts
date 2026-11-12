import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import type { ConversationSummary, ConversationView, ImageMime, ImageRef, TranscriptItem, UserItem } from "@shared/types";

export interface StoredConversation extends ConversationView {
  /** The provider-native history, valid only for the session key it was made with. */
  session?: { key: string; native: unknown };
  /** Things the user did in the panel since the last message (e.g. undid a change), told to the model with the next one. */
  panelNotes?: string[];
}

const ID = /^[0-9a-f-]{36}$/;
const IMAGE_ID = /^[0-9a-f]{24}$/;
const EXT: Record<ImageMime, string> = { "image/png": "png", "image/jpeg": "jpg" };

/**
 * Chats on disk: `conversations/<id>.json`, and the images attached to a chat
 * in `conversations/<id>/`. The JSON only holds image references, so listing
 * and loading chats stays fast however many screenshots they have.
 */
export class ConversationStore {
  private dir: string;
  private cache = new Map<string, StoredConversation>();
  /** Recently used image bytes, as base64 (images are re-sent with every request of a chat). */
  private images = new Map<string, { mime: ImageMime; base64: string }>();

  constructor(root: string) {
    this.dir = join(root, "conversations");
    mkdirSync(this.dir, { recursive: true });
  }

  list(): ConversationSummary[] {
    const out: ConversationSummary[] = [];
    for (const f of readdirSync(this.dir)) {
      if (!f.endsWith(".json")) continue;
      const c = this.get(f.slice(0, -5));
      if (c) out.push({ id: c.id, title: c.title, updatedAt: c.updatedAt });
    }
    return out.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  get(id: string): StoredConversation | null {
    if (!ID.test(id)) return null;
    const hit = this.cache.get(id);
    if (hit) return hit;
    try {
      const c = JSON.parse(readFileSync(join(this.dir, `${id}.json`), "utf8")) as StoredConversation;
      this.cache.set(id, c);
      return c;
    } catch {
      return null;
    }
  }

  create(): StoredConversation {
    const c: StoredConversation = { id: randomUUID(), title: "New chat", updatedAt: Date.now(), transcript: [] };
    this.cache.set(c.id, c);
    return c;
  }

  save(c: StoredConversation): void {
    c.updatedAt = Date.now();
    this.cache.set(c.id, c);
    if (c.transcript.length === 0) return; // don't litter the list with empty chats
    const file = join(this.dir, `${c.id}.json`);
    writeFileSync(file + ".tmp", JSON.stringify(c));
    renameSync(file + ".tmp", file);
  }

  delete(id: string): void {
    if (!ID.test(id)) return;
    this.cache.delete(id);
    rmSync(join(this.dir, `${id}.json`), { force: true });
    rmSync(join(this.dir, id), { recursive: true, force: true });
    for (const k of this.images.keys()) if (k.startsWith(`${id}/`)) this.images.delete(k);
  }

  /* --------------------------------------------------------------- images */

  /** Store an image with a chat. `data` must already be checked and cleaned (see llm/images.ts). */
  addImage(convId: string, img: { mime: ImageMime; data: Buffer; width: number; height: number; name?: string }): ImageRef {
    if (!ID.test(convId)) throw new Error("Unknown chat.");
    const id = randomBytes(12).toString("hex");
    const folder = join(this.dir, convId);
    mkdirSync(folder, { recursive: true });
    const file = join(folder, `${id}.${EXT[img.mime]}`);
    writeFileSync(file + ".tmp", img.data);
    renameSync(file + ".tmp", file);
    const name = img.name?.replace(/[\u0000-\u001f]/g, "").slice(0, 120) || undefined;
    return { id, mime: img.mime, width: img.width, height: img.height, bytes: img.data.length, ...(name ? { name } : {}) };
  }

  /** Where an image is on disk, or null if it is gone. */
  imagePath(convId: string, ref: Pick<ImageRef, "id" | "mime">): string | null {
    if (!ID.test(convId) || !IMAGE_ID.test(ref.id) || !EXT[ref.mime]) return null;
    const file = join(this.dir, convId, `${ref.id}.${EXT[ref.mime]}`);
    return existsSync(file) ? file : null;
  }

  /** An image's bytes as base64, looked up by id among the chat's images. */
  readImage(convId: string, imageId: string): { mime: ImageMime; base64: string } | null {
    if (!ID.test(convId) || !IMAGE_ID.test(imageId)) return null;
    const key = `${convId}/${imageId}`;
    const hit = this.images.get(key);
    if (hit) {
      this.images.delete(key); // keep the most recent last
      this.images.set(key, hit);
      return hit;
    }
    for (const mime of Object.keys(EXT) as ImageMime[]) {
      const file = join(this.dir, convId, `${imageId}.${EXT[mime]}`);
      if (!existsSync(file)) continue;
      const v = { mime, base64: readFileSync(file).toString("base64") };
      this.images.set(key, v);
      while (this.images.size > 24) this.images.delete(this.images.keys().next().value!);
      return v;
    }
    return null;
  }

  /** Remove image files no message refers to any more (after an edit or retry dropped them). `keep` is about to be re-sent. */
  pruneImages(c: StoredConversation, keep: string[] = []): void {
    const folder = join(this.dir, c.id);
    if (!existsSync(folder)) return;
    const used = new Set([...keep, ...c.transcript.flatMap((t) => (t.role === "user" ? (t.images ?? []).map((i) => i.id) : []))]);
    for (const f of readdirSync(folder)) {
      const id = f.replace(/\.(png|jpg)$/, "");
      if (IMAGE_ID.test(id) && !used.has(id)) {
        rmSync(join(folder, f), { force: true });
        this.images.delete(`${c.id}/${id}`);
      }
    }
  }
}

export function view(c: StoredConversation): ConversationView {
  return { id: c.id, title: c.title, updatedAt: c.updatedAt, transcript: c.transcript };
}

export function titleFrom(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > 48 ? t.slice(0, 47) + "…" : t || "New chat";
}

export function lastAssistant(items: TranscriptItem[]) {
  const last = items[items.length - 1];
  return last && last.role === "assistant" ? last : null;
}

/** Index of the last message the user sent, or -1. */
export function lastUserIndex(items: TranscriptItem[]): number {
  for (let i = items.length - 1; i >= 0; i--) if (items[i]!.role === "user") return i;
  return -1;
}

/**
 * Take a chat back to just before the user message at `index` (for retry and
 * edit-and-resend) and return that message. The provider history can't be cut
 * (it is append-only), so the next turn starts a fresh session from the
 * transcript, the same way switching models mid-chat does.
 */
export function rewindTo(c: StoredConversation, index: number): UserItem | null {
  const item = c.transcript[index];
  if (!item || item.role !== "user") return null;
  c.transcript.splice(index);
  delete c.session;
  if (c.transcript.length === 0) c.title = "New chat";
  return item;
}

/** Remember something the user did in the panel, for the model to hear with the next message. */
export function addPanelNote(c: StoredConversation, note: string): void {
  (c.panelNotes ??= []).push(note);
}

/** Notes waiting for the next message, cleared once taken. */
export function takePanelNotes(c: StoredConversation): string | null {
  const notes = c.panelNotes ?? [];
  delete c.panelNotes;
  return notes.length ? notes.map((n) => `- ${n}`).join("\n") : null;
}
