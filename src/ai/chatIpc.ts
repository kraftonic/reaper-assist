import type { ChatInput, ContextPreview, ConversationView, ImageRef, SkillInfo, ToolPart } from "@shared/types";
import { IMAGE_LIMITS } from "@shared/images";
import { addPanelNote, lastUserIndex, rewindTo, view, type ConversationStore, type StoredConversation } from "./conversations";
import type { SendInput } from "./chatInput";
import { checkImage } from "./providers/images";

/**
 * The chat side of the IPC: sending (with images, skills, mentions and
 * context choices), retry, edit-and-resend, one-click undo and thumbnails.
 * Kept out of index.ts so it can be tested without Electron.
 */

export interface ChatIpcDeps {
  store: ConversationStore;
  agent: { send(convId: string, text: string, input?: SendInput): Promise<void>; isRunning(convId: string): boolean };
  /** Runs REAPER's undo for a change Assist made. */
  undo(expectLabel: string): Promise<{ ok: boolean; text: string }>;
  /** Skills for / commands, once they exist. */
  skills?: { list(): SkillInfo[]; load(id: string): string | null } | null;
  /** Reports a failure of a run that was already started. */
  onError(convId: string, message: string): void;
}

export type Reply = { ok: boolean; message?: string };

const MAX_TEXT = 100_000;

/** "/mixing-basics tame the vocal" → the skill and the rest of the text. */
export function parseSlash(text: string, skills: SkillInfo[]): { skill: SkillInfo; rest: string } | null {
  const m = /^\/([\w.-]+)(?:\s+([\s\S]*))?$/.exec(text.trim());
  if (!m) return null;
  const skill = skills.find((s) => s.id.toLowerCase() === m[1]!.toLowerCase());
  return skill ? { skill, rest: (m[2] ?? "").trim() } : null;
}

/** What the @-mentions in a message point at, for the model. Only mentions still present in the text count. */
export function mentionNotes(text: string, mentions: ChatInput["mentions"]): string | null {
  const used = (mentions ?? []).filter((m) => m && typeof m.label === "string" && typeof m.ref === "string" && text.includes(`@${m.label}`));
  const seen = new Set<string>();
  const lines = used.filter((m) => !seen.has(m.label) && seen.add(m.label)).map((m) => `@${m.label} = ${m.ref.slice(0, 400)}`);
  return lines.length ? `<mentions>\n${lines.join("\n")}\n</mentions>` : null;
}

const strings = (v: unknown, max = 20): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, max).map((s) => s.slice(0, 200)) : []);

export function createChatIpc(d: ChatIpcDeps) {
  const busy = (convId: string): Reply | null => (d.agent.isRunning(convId) ? { ok: false, message: "Still answering. Stop it first, or wait for it to finish." } : null);

  /** Check and store new images; keep only stored images that really belong to this chat. */
  function images(conv: StoredConversation, input: ChatInput): { ok: true; refs: ImageRef[] } | { ok: false; message: string } {
    const fresh = Array.isArray(input.images) ? input.images : [];
    const kept = (Array.isArray(input.keepImages) ? input.keepImages : []).filter((r) => r && typeof r.id === "string" && d.store.imagePath(conv.id, r));
    if (fresh.length + kept.length > IMAGE_LIMITS.perMessage) return { ok: false, message: `Up to ${IMAGE_LIMITS.perMessage} images per message.` };
    const checked = [];
    for (const img of fresh) {
      const c = checkImage(img?.data);
      if (!c.ok) return c;
      checked.push({ ...c, name: typeof img.name === "string" ? img.name : undefined });
    }
    const refs = [...kept.map((r) => ({ id: r.id, mime: r.mime, width: r.width, height: r.height, bytes: r.bytes, ...(r.name ? { name: r.name } : {}) }))];
    for (const c of checked) refs.push(d.store.addImage(conv.id, { mime: c.mime, data: c.data, width: c.width, height: c.height, name: c.name }));
    return { ok: true, refs };
  }

  /** Text, skill, mentions and context choices → what the agent gets. */
  function prepare(text: string, input: Partial<ChatInput>, refs: ImageRef[]): { text: string; input: SendInput } {
    const out: SendInput = {};
    if (refs.length) out.images = refs;
    let body = text;
    const slash = d.skills ? parseSlash(text, d.skills.list()) : null;
    if (slash) {
      const skillText = d.skills!.load(slash.skill.id);
      if (skillText) out.skill = { id: slash.skill.id, title: slash.skill.title, body: skillText };
      body = skillText ? slash.rest : text;
    }
    const notes = mentionNotes(body, input.mentions);
    if (notes) out.modelNotes = notes;
    const off = strings(input.contextOff);
    if (off.length) out.contextOff = off;
    const labels = strings(input.contextLabels);
    if (labels.length) out.contextLabels = labels;
    return { text: body, input: out };
  }

  function start(convId: string, text: string, input: SendInput): void {
    // Runs in the background; progress arrives as chat events.
    void d.agent.send(convId, text, input).catch((e) => d.onError(convId, String(e?.message ?? e)));
  }

  return {
    send(convId: string, raw: unknown): Reply {
      const input = (raw && typeof raw === "object" ? raw : {}) as ChatInput;
      const text = typeof input.text === "string" ? input.text.trim().slice(0, MAX_TEXT) : "";
      const conv = d.store.get(convId);
      if (!conv) return { ok: false, message: "That chat no longer exists. Start a new one." };
      const b = busy(convId);
      if (b) return b;
      const imgs = images(conv, input);
      if (!imgs.ok) return imgs;
      if (!text && !imgs.refs.length) return { ok: false, message: "Type a message or attach an image." };
      const p = prepare(text, input, imgs.refs);
      start(convId, p.text, p.input);
      return { ok: true };
    },

    /** Ask the last question again (with the project as it is now). */
    retry(convId: string, raw?: unknown): Reply {
      const conv = d.store.get(convId);
      if (!conv) return { ok: false, message: "That chat no longer exists." };
      const b = busy(convId);
      if (b) return b;
      const idx = lastUserIndex(conv.transcript);
      const item = idx >= 0 ? rewindTo(conv, idx) : null;
      if (!item) return { ok: false, message: "There's nothing to retry yet." };
      const input = (raw && typeof raw === "object" ? raw : {}) as Partial<ChatInput>;
      const text = item.skill ? `/${item.skill.id}${item.text ? ` ${item.text}` : ""}` : item.text;
      const p = prepare(text, input, item.images ?? []);
      start(convId, p.text, p.input);
      return { ok: true };
    },

    /** Replace the message at `index` and everything after it, then send. */
    editAndResend(convId: string, index: unknown, raw: unknown): Reply {
      const conv = d.store.get(convId);
      if (!conv) return { ok: false, message: "That chat no longer exists." };
      const b = busy(convId);
      if (b) return b;
      const input = (raw && typeof raw === "object" ? raw : {}) as ChatInput;
      const text = typeof input.text === "string" ? input.text.trim().slice(0, MAX_TEXT) : "";
      if (typeof index !== "number" || conv.transcript[index]?.role !== "user") return { ok: false, message: "That message can't be edited any more." };
      const imgs = images(conv, input);
      if (!imgs.ok) return imgs;
      if (!text && !imgs.refs.length) return { ok: false, message: "Type a message or attach an image." };
      rewindTo(conv, index);
      d.store.pruneImages(conv, imgs.refs.map((r) => r.id));
      const p = prepare(text, input, imgs.refs);
      start(convId, p.text, p.input);
      return { ok: true };
    },

    /** One-click undo from a tool card. */
    async undoTool(convId: string, toolId: string): Promise<Reply & { message: string; conversation?: ConversationView }> {
      const conv = d.store.get(convId);
      if (!conv) return { ok: false, message: "That chat no longer exists." };
      if (d.agent.isRunning(convId)) return { ok: false, message: "Wait for the answer to finish (or stop it), then undo." };
      const part = findTool(conv, toolId);
      if (!part) return { ok: false, message: "That change isn't in this chat any more." };
      if (part.undone) return { ok: false, message: "Already undone." };
      const label = undoLabelOf(part);
      if (!label || part.status !== "done") return { ok: false, message: "This change can't be undone from here. Use Undo in REAPER (⌘Z)." };
      let r: { ok: boolean; text: string };
      try {
        r = await d.undo(label);
      } catch (e) {
        r = { ok: false, text: e instanceof Error ? e.message : String(e) };
      }
      if (!r.ok) return { ok: false, message: readableResult(r.text) || "REAPER couldn't undo it." };
      part.undone = true;
      addPanelNote(conv, `The user undid “${part.summary}” (Undo button on its card).`);
      d.store.save(conv);
      return { ok: true, message: "Undone in REAPER.", conversation: view(conv) };
    },

    /** An attached image as a data: URL. */
    image(convId: string, imageId: string): string | null {
      const img = d.store.readImage(convId, imageId);
      return img ? `data:${img.mime};base64,${img.base64}` : null;
    },
  };
}

export function findTool(conv: StoredConversation, toolId: string): ToolPart | null {
  for (const it of conv.transcript) {
    if (it.role !== "assistant") continue;
    for (const p of it.parts) if (p.kind === "tool" && p.id === toolId) return p;
  }
  return null;
}

/** The undo label REAPER returned with a change (in the result JSON). */
export function undoLabelOf(part: Pick<ToolPart, "result">): string | null {
  try {
    const r = JSON.parse(part.result ?? "") as { undoLabel?: unknown };
    return typeof r.undoLabel === "string" && r.undoLabel ? r.undoLabel : null;
  } catch {
    return null;
  }
}

/** The human part of a command result ("message" or "error.message"), else the raw text. */
export function readableResult(text: string): string {
  try {
    const r = JSON.parse(text) as { message?: string; error?: { message?: string } };
    return r.error?.message ?? r.message ?? text;
  } catch {
    return text;
  }
}

/** Fallback context preview from a getProjectState read, for when nothing richer is available. */
export function previewFromState(p: Record<string, unknown> | null): ContextPreview {
  const none: ContextPreview = { connected: false, chips: [], mentions: [], has: { selectedTracks: 0, selectedItems: 0, timeSelection: false, armed: 0, midiEditor: false, recording: false } };
  if (!p) return none;
  const proj = (p.project ?? {}) as Record<string, unknown>;
  const tempo = (p.tempo ?? {}) as Record<string, unknown>;
  const tr = (p.transport ?? {}) as Record<string, unknown>;
  const tracks = ((p.tracks as Record<string, unknown>[] | undefined) ?? []).filter((t) => t && typeof t === "object");
  const name = (t: Record<string, unknown>) => (typeof t.name === "string" && t.name.trim() ? t.name.trim() : `Track ${t.index}`);
  const selected = tracks.filter((t) => t.selected);
  const armed = tracks.filter((t) => t.armed);
  const out: ContextPreview = { ...none, connected: true, has: { ...none.has, selectedTracks: selected.length, armed: armed.length, recording: tr.state === "recording" } };
  const projLabel = [typeof proj.name === "string" && proj.name ? proj.name : "Project", typeof tempo.bpm === "number" ? `${Math.round(tempo.bpm * 100) / 100} BPM` : null].filter(Boolean).join(" · ");
  out.chips.push({ id: "project", label: projLabel, detail: `${tracks.length} tracks, tempo and transport`, icon: "project" });
  if (selected.length) {
    const names = selected.map(name);
    out.chips.push({ id: "tracks", label: selected.length === 1 ? names[0]! : `${selected.length} tracks: ${names.slice(0, 2).join(", ")}${names.length > 2 ? "…" : ""}`, detail: `Selected: ${names.join(", ")}`, icon: "tracks" });
  }
  for (const t of tracks.slice(0, 200)) out.mentions.push({ kind: "track", name: name(t), hint: `track ${t.index}`, ref: `track ${t.index} “${name(t)}”${typeof t.id === "string" ? ` (id ${t.id})` : ""}` });
  return out;
}

/* ------------------------------------------------ chips from A's session context */

/** A span in seconds with its bar labels, as `ReaperConnection.sessionContext()` reports it. */
interface Span {
  start: number;
  end: number;
  startBar: string;
  endBar: string;
  label: string;
}
/** The parts of Agent A's SessionContext the chips and @-mentions use (structural, so either side can grow). */
export interface SessionLike {
  project: { name: string; bpm: number; timeSig?: string; transport?: string };
  selection: {
    tracks: { id: string; index: number; name: string }[];
    items: ({ track: string; kind?: string } & Span)[];
    itemCount: number;
    razor?: ({ track: string } & Span)[];
    timeSelection: Span | null;
    midiEditor: { track: string; notes: number; selectedNotes: number } | null;
  };
  sections: ({ name: string; kind: "region" | "marker" } & Span)[];
  /** Every track (for @-mentions), when the context includes it. */
  tracks?: { id?: string; index: number; name: string; armed?: boolean }[];
}

/** "9.1" → 9; an end at "17.1" means the span covers bars up to 16. */
function barsLabel(spans: Span[]): string {
  if (spans.length === 1) return spans[0]!.label;
  const labels = new Set(spans.map((s) => s.label));
  if (labels.size === 1) return spans[0]!.label;
  const first = spans.reduce((a, b) => (b.start < a.start ? b : a));
  const last = spans.reduce((a, b) => (b.end > a.end ? b : a));
  const [sb] = first.startBar.split(".").map(Number);
  const [eb, ebeat] = last.endBar.split(".").map(Number);
  const end = ebeat === 1 && (eb ?? 0) > (sb ?? 0) ? (eb ?? 0) - 1 : (eb ?? 0);
  return sb === end ? `bar ${sb}` : `bars ${sb}–${end}`;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Chips, @-mention targets and quick-action hints from the session context. Chip ids match A's ContextToggles. */
export function previewFromSession(ctx: SessionLike | null, extra: { recording?: boolean; armed?: number } = {}): ContextPreview {
  const base = previewFromState(null);
  if (!ctx) return base;
  const sel = ctx.selection;
  const out: ContextPreview = {
    connected: true,
    chips: [],
    mentions: [],
    has: {
      selectedTracks: sel.tracks.length,
      selectedItems: sel.itemCount + (sel.razor?.length ?? 0),
      timeSelection: !!sel.timeSelection,
      armed: extra.armed ?? (ctx.tracks ?? []).filter((t) => t.armed).length,
      midiEditor: !!sel.midiEditor,
      recording: extra.recording ?? ctx.project.transport === "recording",
    },
  };
  const bpm = Number.isFinite(ctx.project.bpm) ? `${Math.round(ctx.project.bpm * 100) / 100} BPM` : null;
  out.chips.push({ id: "project", label: [ctx.project.name || "Project", bpm].filter(Boolean).join(" · "), detail: "Project, tempo, tracks and sections", icon: "project" });
  if (sel.tracks.length) {
    const names = sel.tracks.map((t) => t.name || `Track ${t.index}`);
    out.chips.push({ id: "tracks", label: names.length === 1 ? names[0]! : `${names.length} tracks: ${names.slice(0, 2).join(", ")}${names.length > 2 ? "…" : ""}`, detail: `Selected tracks: ${names.join(", ")}`, icon: "tracks" });
  }
  const spans: (Span & { track: string })[] = [...sel.items, ...(sel.razor ?? [])];
  if (spans.length) {
    const n = sel.itemCount + (sel.razor?.length ?? 0);
    const what = sel.itemCount && sel.razor?.length ? plural(n, "selection") : sel.itemCount ? plural(sel.itemCount, "item") : plural(sel.razor!.length, "razor edit");
    const on = [...new Set(spans.map((s) => s.track))];
    out.chips.push({ id: "items", label: `${what} · ${barsLabel(spans)}`, detail: `Selected on ${on.join(", ")}`, icon: "items" });
  }
  if (sel.timeSelection) out.chips.push({ id: "timeSelection", label: `Time · ${sel.timeSelection.label}`, detail: `Time selection: ${sel.timeSelection.label}`, icon: "time" });
  if (sel.midiEditor) {
    const m = sel.midiEditor;
    out.chips.push({ id: "midi", label: `MIDI · ${m.selectedNotes ? `${m.selectedNotes} of ${plural(m.notes, "note")}` : plural(m.notes, "note")}`, detail: `MIDI editor open on ${m.track}`, icon: "midi" });
  }
  // @-mentions: sections first (they are what people say: "the chorus"), then tracks.
  const seen = new Map<string, number>();
  for (const s of ctx.sections.slice(0, 100)) {
    const k = s.name.trim() || (s.kind === "region" ? "Region" : "Marker");
    const n = (seen.get(k.toLowerCase()) ?? 0) + 1;
    seen.set(k.toLowerCase(), n);
    const name = n > 1 ? `${k} ${n}` : k;
    const occ = n > 1 ? `, occurrence ${n} (range: { section: "${k}", occurrence: ${n} })` : ` (range: { section: "${k}" })`;
    out.mentions.push({ kind: "section", name, hint: s.label, ref: `${s.kind} “${k}”, ${s.label}${occ}` });
  }
  const tracks = ctx.tracks ?? sel.tracks;
  for (const t of tracks.slice(0, 200)) {
    const name = t.name || `Track ${t.index}`;
    out.mentions.push({ kind: "track", name, hint: `track ${t.index}`, ref: `track ${t.index} “${name}”${t.id ? ` (id ${t.id})` : ""}` });
  }
  return out;
}

/**
 * The chat box's context preview. Uses `sessionContext()` when the REAPER connection has it (selection, items,
 * time selection, MIDI, sections). If that context has no full track list, the @-mention tracks and the armed
 * count come from the project state. Falls back to the project state alone if the session read fails.
 */
export async function readContextPreview(src: { session?: () => Promise<SessionLike | null>; state: () => Promise<Record<string, unknown> | null> }): Promise<ContextPreview> {
  if (src.session) {
    try {
      const ctx = await src.session();
      if (ctx) {
        const preview = previewFromSession(ctx);
        if (ctx.tracks) return preview;
        const state = previewFromState(await src.state().catch(() => null));
        if (!state.connected) return preview;
        const sections = preview.mentions.filter((m) => m.kind !== "track");
        return { ...preview, mentions: [...sections, ...state.mentions.filter((m) => m.kind === "track")], has: { ...preview.has, armed: state.has.armed } };
      }
    } catch {
      // An older bridge or a context shape this build doesn't know: use the project state.
    }
  }
  return previewFromState(await src.state());
}

/** Context chips switched off → A's ContextToggles ({ tracks: false, … }). "project" off withholds the whole block. */
export function togglesFromOff(off: string[] | undefined): Record<string, boolean> | undefined {
  if (!off?.length) return undefined;
  return Object.fromEntries(off.map((k) => [k, false]));
}

/** What the model gets instead of the project when the user switched the project chip off. */
export const CONTEXT_WITHHELD = "REAPER is connected. The user left the project details out of this message; read them with the tools only if the request needs them.";
