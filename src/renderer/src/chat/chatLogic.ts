import type { ChatEvent, ContextPreview, ConversationView, Mentionable, SkillInfo, ToolPart } from "@shared/types";

/**
 * Pure logic behind the chat box: the / and @ menus, quick actions, and how
 * streamed chat events update the transcript. No DOM here, so it is tested in node.
 */

/* ------------------------------------------------------------ menus */

export type Trigger = { kind: "slash" | "mention"; start: number; query: string };

/** Is the caret inside a "/command" (only at the very start) or an "@mention"? */
export function findTrigger(text: string, caret: number): Trigger | null {
  const before = text.slice(0, caret);
  const slash = /^\/([\w.-]*)$/.exec(before);
  if (slash) return { kind: "slash", start: 0, query: slash[1]! };
  const at = before.lastIndexOf("@");
  if (at < 0 || (at > 0 && !/\s/.test(before[at - 1]!))) return null;
  const query = before.slice(at + 1);
  if (query.length > 40 || /[\n@]/.test(query) || /\s\s/.test(query)) return null;
  return { kind: "mention", start: at, query };
}

/** Replace the trigger text with the picked value; returns the new text and caret. */
export function applyCompletion(text: string, caret: number, t: Trigger, insert: string): { text: string; caret: number } {
  const head = text.slice(0, t.start);
  const tail = text.slice(caret).replace(/^\S*/, "");
  const spaced = tail.startsWith(" ");
  const ins = `${insert}${spaced ? "" : " "}`;
  return { text: head + ins + tail, caret: head.length + ins.length + (spaced ? 1 : 0) };
}

const norm = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, " ").trim();

/** Best matches first: prefix, then word-start, then anywhere. */
function rank<T>(items: T[], query: string, keys: (t: T) => string[]): T[] {
  const q = norm(query);
  if (!q) return items;
  const score = (t: T) => {
    let best = 99;
    for (const k of keys(t).map(norm)) {
      if (k.startsWith(q)) best = Math.min(best, 0);
      else if (k.split(" ").some((w) => w.startsWith(q))) best = Math.min(best, 1);
      else if (k.includes(q)) best = Math.min(best, 2);
    }
    return best;
  };
  return items
    .map((t, i) => ({ t, i, s: score(t) }))
    .filter((x) => x.s < 99)
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .map((x) => x.t);
}

export type MenuItem =
  | { kind: "action"; id: string; label: string; hint: string; prompt: string }
  | { kind: "skill"; id: string; label: string; hint: string }
  | { kind: "mention"; id: string; label: string; hint: string; mention: Mentionable };

/** What the open menu lists for the current trigger. */
export function menuItems(t: Trigger | null, ctx: { actions: QuickAction[]; skills: SkillInfo[]; mentions: Mentionable[] }, limit = 8): MenuItem[] {
  if (!t) return [];
  if (t.kind === "mention") {
    return rank(ctx.mentions, t.query, (m) => [m.name]).slice(0, limit).map((m) => ({ kind: "mention", id: `${m.kind}:${m.name}:${m.hint}`, label: m.name, hint: m.hint, mention: m }));
  }
  const actions: MenuItem[] = rank(ctx.actions, t.query, (a) => [a.label, a.id]).map((a) => ({ kind: "action", id: a.id, label: a.label, hint: "Quick action", prompt: a.prompt }));
  const skills: MenuItem[] = rank(ctx.skills, t.query, (s) => [s.id, s.title]).map((s) => ({ kind: "skill", id: s.id, label: `/${s.id}`, hint: s.title === s.id ? s.when : `${s.title}: ${s.when}` }));
  return [...actions, ...skills].slice(0, limit);
}

/* ------------------------------------------------------- quick actions */

export interface QuickAction {
  id: string;
  label: string;
  prompt: string;
}

/** One-tap requests that fit what's going on in REAPER right now (labels agreed with the tools/skills side). */
export function quickActions(p: ContextPreview | null): QuickAction[] {
  if (!p?.connected) return [];
  const h = p.has;
  const sel = h.selectedItems > 0 ? "the selected items" : h.selectedTracks > 0 ? "the selected tracks" : null;
  const range = h.timeSelection ? " in the time selection" : "";
  if (h.recording) {
    return [{ id: "rec-levels", label: "Is my input level OK?", prompt: "I'm recording. Check the input levels and headroom of the armed tracks and tell me if the gain is right. Don't stop or change the recording." }];
  }
  const out: QuickAction[] = [
    {
      id: "levels",
      label: "Check my levels",
      prompt: sel || range
        ? `Check my levels on ${sel ?? "the mix"}${range}: loudness, peaks, headroom and clipping. Tell me what to fix, most important first.`
        : "Check my levels: analyse the master and the loudest tracks, tell me about headroom, clipping and loudness.",
    },
    { id: "clipping", label: "Why is this clipping?", prompt: `Something is clipping${sel ? ` on ${sel}` : ""}${range}. Find where and why, and fix it if it's simple.` },
  ];
  if (h.armed > 0 || h.selectedTracks === 0) {
    out.push({ id: "vocal-rec", label: "Prep vocal recording", prompt: "Get me ready to record vocals: check the setup, input level and latency, and suggest the chain. Ask before arming anything." });
  }
  out.push({ id: "tighten", label: "Tighten the drums", prompt: `Tighten the drums ${sel ? `in ${sel}` : "(the selection, or the whole drum track)"}${range}: quantize with feel, not robotic. Tell me what you'll change first.` });
  out.push({ id: "chords", label: "Suggest chords", prompt: `Suggest chords that fit what's here${range} (key, mood) and offer to write them in.` });
  out.push({ id: "mix-check", label: "Mix check", prompt: `Listen to the ${sel ? `balance of ${sel}` : "mix balance"}${range} and tell me the three biggest problems.` });
  return out;
}

/** Plain questions for when REAPER isn't connected. */
export const OFFLINE_SUGGESTIONS = ["How do I sidechain in REAPER?", "Starting EQ for a dull kick?", "What loudness should I master to for streaming?", "Explain parallel compression on drums"];

/* -------------------------------------------------------- sending */

/** Can the current draft be sent? */
export function canSend(draft: string, images: number, busy: boolean, preparing = 0): boolean {
  return !busy && preparing === 0 && (draft.trim().length > 0 || images > 0);
}

/** Context chips → what to send: the ids switched off and the labels of those left on. */
export function contextChoice(p: ContextPreview | null, off: ReadonlySet<string>): { contextOff: string[]; contextLabels: string[] } {
  const chips = p?.chips ?? [];
  return { contextOff: chips.filter((c) => off.has(c.id)).map((c) => c.id), contextLabels: chips.filter((c) => !off.has(c.id)).map((c) => c.label) };
}

/** The @-mentions still in the text, as the main process wants them. */
export function usedMentions(text: string, picked: Mentionable[]): { label: string; ref: string }[] {
  const seen = new Set<string>();
  return picked.filter((m) => text.includes(`@${m.name}`) && !seen.has(m.name) && seen.add(m.name)).map((m) => ({ label: m.name, ref: m.ref }));
}

/* ------------------------------------------------- streaming updates */

/** Apply a streamed chat event to the conversation shown. Untouched parts keep their identity, so memoised rows don't re-render. */
export function applyChatEvent(c: ConversationView | null, e: ChatEvent): ConversationView | null {
  if (!c || e.convId !== c.id) return c;
  if (e.type === "done") return e.conversation;
  const transcript = c.transcript.slice();
  const last = transcript[transcript.length - 1];
  if (!last || last.role !== "assistant") return c;
  const parts = last.parts.slice();
  if (e.type === "text") {
    const tail = parts[parts.length - 1];
    if (tail?.kind === "text") parts[parts.length - 1] = { ...tail, text: tail.text + e.delta };
    else parts.push({ kind: "text", text: e.delta });
  } else if (e.type === "tool") {
    const i = parts.findIndex((p) => p.kind === "tool" && p.id === e.part.id);
    if (i >= 0) parts[i] = e.part;
    else parts.push(e.part);
  } else if (e.type === "notice") {
    parts.push({ kind: "notice", level: e.level, text: e.text });
  }
  transcript[transcript.length - 1] = { ...last, parts };
  return { ...c, transcript };
}

/* -------------------------------------------------------- tool cards */

export interface ToolOutcome {
  /** What the card says about the result. */
  badge: "verified" | "done" | "check" | "failed" | "skipped" | "waiting" | "running" | "undone";
  message: string | null;
  undoLabel: string | null;
  /** Pretty-printed result for the details view. */
  detail: string;
}

/** Read a tool result: REAPER's status (verified / ok / unverified), its message and undo label. */
export function toolOutcome(part: ToolPart): ToolOutcome {
  type Result = { status?: string; message?: string; note?: string; error?: { message?: string }; undoLabel?: string };
  let parsed: Result | null = null;
  try {
    const v = JSON.parse(part.result ?? "") as unknown;
    if (v && typeof v === "object" && !Array.isArray(v)) parsed = v as Result;
  } catch {
    parsed = null;
  }
  const detail = parsed ? JSON.stringify(parsed, null, 2) : (part.result ?? "");
  const undoLabel = typeof parsed?.undoLabel === "string" && parsed.undoLabel ? parsed.undoLabel : null;
  const msg = parsed ? (parsed.error?.message ?? parsed.message ?? null) : null;
  if (part.undone) return { badge: "undone", message: null, undoLabel: null, detail };
  switch (part.status) {
    case "awaiting-approval":
      return { badge: "waiting", message: null, undoLabel: null, detail };
    case "running":
      return { badge: "running", message: null, undoLabel: null, detail };
    case "denied":
      return { badge: "skipped", message: msg ?? (part.result || null), undoLabel: null, detail };
    case "failed":
      return { badge: "failed", message: msg ?? (part.result || null), undoLabel: null, detail };
    case "done":
      if (parsed?.status === "unverified") return { badge: "check", message: parsed.note ?? msg ?? "REAPER couldn't confirm this. Check it.", undoLabel, detail };
      return { badge: parsed?.status === "verified" ? "verified" : "done", message: part.risk === "read" ? null : msg, undoLabel, detail };
  }
}
