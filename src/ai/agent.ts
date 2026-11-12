import type { ApprovalAnswer, AssistantPart, ChatEvent, ImageMime, Permissions, ProviderId, ToolPart, TranscriptItem, UserItem } from "@shared/types";
import { COMMANDS, COMMAND_NAMES, commandJsonSchema, describeCommand, isCommandName, validateArgs } from "@daw/reaper/commands";
import type { CommandOutcome } from "@daw/reaper/reaper";
import { takePanelNotes, titleFrom, view, type ConversationStore, type StoredConversation } from "./conversations";
import { composeUserText, fallbackTitle, type SendInput } from "./chatInput";
import { SYSTEM_PROMPT, wrapUserMessage } from "./prompt";
import { SKILL_TOOL, SKILL_TOOL_NAME, runSkillTool } from "./skills";
import { WEB_TOOL, WEB_TOOL_NAME, runWebTool, type WebDeps } from "./web";
import { ProviderError, type ChatSession, type PlainTurn, type ToolDef, type ToolResult } from "./providers/types";
import type { CliRunOptions, McpLaunch } from "./providers/cli";

export interface CliPort {
  /** The runner for a CLI provider, or null when the provider is an API. */
  runner(provider: ProviderId): ((o: CliRunOptions) => Promise<{ sessionId: string }>) | null;
  /** How the CLI should launch Assist's MCP tool server for this chat. */
  mcp(convId: string): McpLaunch;
  cwd: string;
}

export interface DawPort {
  enabled(): boolean;
  /** `off`: context parts the user switched off for this message (see the chips above the chat box). */
  contextSummary(opts?: { off?: string[] }): Promise<string | null>;
  run(name: (typeof COMMAND_NAMES)[number], args: Record<string, unknown>, signal: AbortSignal): Promise<CommandOutcome>;
}

export interface AgentDeps {
  store: ConversationStore;
  daw: DawPort;
  permissions(): Permissions;
  /** Persist an “always allow” rule for an action. */
  allowAlways?(name: string): void;
  /** Current provider + model; a new session is built when this key changes mid-conversation. */
  active(): { provider: ProviderId; model: string; key: string };
  makeSession(restore: unknown | undefined, plain: PlainTurn[] | undefined): ChatSession;
  emit(e: ChatEvent): void;
  cli?: CliPort;
  /** Extra context about the user (e.g. the DAW they're coming from). */
  background?(): string | null;
  /** Settings → AI → Web access. `deps` replaces the network in tests. */
  web?: { enabled(): boolean; deps?: WebDeps };
}

type AssistantItem = Extract<TranscriptItem, { role: "assistant" }>;

const MAX_TURNS = 24;

export const DAW_TOOLS: ToolDef[] = COMMAND_NAMES.map((name) => ({
  name,
  description: COMMANDS[name].summary,
  schema: commandJsonSchema(name),
}));

/** Earlier turns as plain text, for starting a different model on an existing chat. */
export function plainHistory(items: TranscriptItem[]): PlainTurn[] {
  const out: PlainTurn[] = [];
  for (const it of items) {
    if (it.role === "user") out.push({ role: "user", text: it.text, ...(it.images?.length ? { images: it.images } : {}) });
    else {
      const text = it.parts
        .map((p) => (p.kind === "text" ? p.text : p.kind === "tool" ? `[REAPER: ${p.summary} → ${p.status}]` : ""))
        .filter(Boolean)
        .join("\n")
        .trim();
      if (text) out.push({ role: "assistant", text });
    }
  }
  // A trailing user turn with no answer would make two user turns in a row on the next send.
  while (out.length && out[out.length - 1]!.role === "user") out.pop();
  return out;
}

export class Agent {
  private running = new Map<string, AbortController>();
  private approvals = new Map<string, { resolve: (ok: boolean) => void; convId: string; name: string }>();
  /** Actions allowed for the rest of a chat (“Allow for this chat”). */
  private chatAllowed = new Map<string, Set<string>>();
  /** Chats currently being answered by a CLI, so its MCP tool calls land in the right place. */
  private cliRuns = new Map<string, { conv: StoredConversation; item: AssistantItem; signal: AbortSignal }>();

  constructor(private deps: AgentDeps) {}

  isRunning(convId: string): boolean {
    return this.running.has(convId);
  }

  stop(convId: string): void {
    this.running.get(convId)?.abort();
  }

  answerApproval(toolId: string, answer: ApprovalAnswer | boolean): void {
    const a: ApprovalAnswer = answer === true ? "once" : answer === false ? "deny" : answer;
    const r = this.approvals.get(toolId);
    if (!r) return;
    this.approvals.delete(toolId);
    if (a === "chat") {
      const set = this.chatAllowed.get(r.convId) ?? new Set<string>();
      set.add(r.name);
      this.chatAllowed.set(r.convId, set);
    }
    if (a === "always") this.deps.allowAlways?.(r.name);
    r.resolve(a !== "deny");
    // Other actions of the same kind already waiting in this chat follow the same answer.
    if (a === "chat" || a === "always") {
      for (const [id, other] of this.approvals) if (other.convId === r.convId && other.name === r.name) this.answerApproval(id, "once");
    }
  }

  /** Does this action need the user's OK? Rules beat the chat allowance, which beats the mode. Reads never ask. */
  needsApproval(convId: string, name: string): boolean {
    if (!isCommandName(name)) return true;
    const spec = COMMANDS[name];
    if (spec.risk === "read") return false;
    const { mode, rules } = this.deps.permissions();
    const rule = rules[name];
    if (rule === "allow") return false;
    if (rule === "ask") return true;
    if (this.chatAllowed.get(convId)?.has(name)) return false;
    if (mode === "full-auto") return false;
    if (mode === "auto-edits") return spec.risk !== "safe" || !!spec.alwaysConfirm;
    return true;
  }

  async send(convId: string, text: string, input: SendInput = {}): Promise<void> {
    const { store, emit } = this.deps;
    const conv = store.get(convId);
    if (!conv) throw new Error("That chat no longer exists.");
    if (this.running.has(convId)) throw new Error("Still answering the previous message.");
    const ac = new AbortController();
    this.running.set(convId, ac);

    const active = this.deps.active();
    const assistant: Extract<TranscriptItem, { role: "assistant" }> = { role: "assistant", parts: [], at: Date.now(), model: active.model, provider: active.provider };
    const prior = conv.transcript.slice();
    const user: UserItem = { role: "user", text, at: Date.now() };
    if (input.images?.length) user.images = input.images;
    if (input.skill) user.skill = { id: input.skill.id, title: input.skill.title };
    if (input.contextLabels?.length) user.context = input.contextLabels;
    conv.transcript.push(user, assistant);
    if (conv.title === "New chat") conv.title = text.trim() ? titleFrom(text) : fallbackTitle(input);

    try {
      const project = this.deps.daw.enabled() ? await this.deps.daw.contextSummary(input.contextOff?.length ? { off: input.contextOff } : undefined) : null;
      const runner = this.deps.cli?.runner(active.provider);
      const wrapped = wrapUserMessage(composeUserText(text, input, takePanelNotes(conv)), project, this.deps.background?.() ?? null);
      if (runner) await this.runCli(conv, prior, assistant, runner, wrapped, active, ac.signal, input.images ?? []);
      else {
        const session = this.sessionFor(conv, prior, active.key);
        session.addUser(wrapped, input.images);
        await this.loop(conv, session, assistant, ac.signal);
      }
    } catch (e) {
      if (ac.signal.aborted) this.notice(conv, assistant, "info", "Stopped.");
      else this.notice(conv, assistant, "error", e instanceof ProviderError ? e.message : `Something went wrong: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      for (const p of assistant.parts) if (p.kind === "tool" && (p.status === "awaiting-approval" || p.status === "running")) p.status = p.status === "running" ? "failed" : "denied";
      this.running.delete(convId);
      store.save(conv);
      emit({ type: "done", convId, conversation: view(conv) });
    }
  }

  /** The CLI runs its own loop; Assist streams its text and serves its REAPER tool calls over MCP. */
  private async runCli(
    conv: StoredConversation,
    prior: TranscriptItem[],
    item: AssistantItem,
    runner: (o: CliRunOptions) => Promise<{ sessionId: string }>,
    prompt: string,
    active: { key: string },
    signal: AbortSignal,
    images: UserItem["images"] & {} = [],
  ) {
    const cli = this.deps.cli!;
    const resume = conv.session?.key === active.key ? ((conv.session.native as { sessionId?: string })?.sessionId ?? null) : null;
    let full = prompt;
    if (!resume) {
      // Switching to a CLI mid-chat: give it the earlier turns as plain text.
      const earlier = plainHistory(prior);
      const said = (t: PlainTurn) => `${t.text}${t.images?.length ? ` [${t.images.length === 1 ? "an image" : `${t.images.length} images`} attached]` : ""}`;
      if (earlier.length) full = `Earlier in this chat:\n${earlier.map((t) => `${t.role === "user" ? "User" : "Assistant"}: ${said(t)}`).join("\n\n")}\n\n---\n\n${prompt}`;
    }
    this.cliRuns.set(conv.id, { conv, item, signal });
    try {
      const out = await runner({
        prompt: full,
        system: SYSTEM_PROMPT,
        model: active.key.split(":").slice(1).join(":"),
        sessionId: resume,
        web: this.deps.web?.enabled() ?? false,
        // Always: loadSkill comes through MCP too (the tool server lists REAPER tools only when the DAW is on).
        mcp: cli.mcp(conv.id),
        cwd: cli.cwd,
        signal,
        images: images.flatMap((r) => {
          const path = this.deps.store.imagePath(conv.id, r);
          return path ? [{ path, mime: r.mime as ImageMime }] : [];
        }),
        onText: (delta) => {
          const last = item.parts[item.parts.length - 1];
          if (last?.kind === "text") last.text += delta;
          else item.parts.push({ kind: "text", text: delta.replace(/^\n+/, "") });
          this.deps.emit({ type: "text", convId: conv.id, delta });
        },
      });
      conv.session = { key: active.key, native: { sessionId: out.sessionId } };
    } finally {
      this.cliRuns.delete(conv.id);
    }
  }

  /** A REAPER tool call from the CLI's MCP server. Same validation and approvals as the API path. */
  async cliToolCall(convId: string, name: string, input: unknown): Promise<ToolResult> {
    const run = this.cliRuns.get(convId);
    if (!run) return { id: "", content: "No chat is waiting for this action, so it was not run.", isError: true };
    return this.runTool(run.conv, run.item, { id: `cli_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`, name, input }, run.signal);
  }

  private sessionFor(conv: StoredConversation, prior: TranscriptItem[], key: string): ChatSession {
    // Same model as last time: resume its native history (append-only).
    if (conv.session && conv.session.key === key) {
      const s = this.deps.makeSession(conv.session.native, undefined);
      conv.session = { key, native: s.serialize() };
      return s;
    }
    const s = this.deps.makeSession(undefined, plainHistory(prior));
    conv.session = { key, native: s.serialize() };
    return s;
  }

  private notice(conv: StoredConversation, item: Extract<TranscriptItem, { role: "assistant" }>, level: "info" | "warn" | "error", text: string) {
    item.parts.push({ kind: "notice", level, text });
    this.deps.emit({ type: "notice", convId: conv.id, level, text });
  }

  private async loop(conv: StoredConversation, session: ChatSession, item: Extract<TranscriptItem, { role: "assistant" }>, signal: AbortSignal) {
    const web = this.deps.web?.enabled() ?? false;
    // readWebPage for providers without their own web tools; Claude brings web search and fetch itself.
    const tools = [...(this.deps.daw.enabled() ? DAW_TOOLS : []), SKILL_TOOL, ...(web && !session.nativeWeb ? [WEB_TOOL] : [])];
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const res = await session.turn({
        system: SYSTEM_PROMPT,
        tools,
        web,
        signal,
        images: (id) => this.deps.store.readImage(conv.id, id),
        onText: (delta) => {
          const last = item.parts[item.parts.length - 1];
          if (last?.kind === "text") last.text += delta;
          else item.parts.push({ kind: "text", text: delta });
          this.deps.emit({ type: "text", convId: conv.id, delta });
        },
      });
      conv.session = { key: session.key, native: session.serialize() };
      if (res.note) this.notice(conv, item, res.stop === "refusal" ? "warn" : "info", res.note);

      if (res.stop === "refusal") {
        if (!res.note) this.notice(conv, item, "warn", "The model declined to answer this one. Try rephrasing, or switch models in Settings → AI.");
        return;
      }
      if (res.stop === "max_tokens" && !res.toolCalls.length) {
        if (!res.note) this.notice(conv, item, "warn", "The answer hit the length limit and was cut short.");
        return;
      }
      if (res.stop !== "tool_use") return;

      const results: ToolResult[] = [];
      for (const call of res.toolCalls) results.push(await this.runTool(conv, item, call, signal));
      session.addToolResults(results);
      conv.session = { key: session.key, native: session.serialize() };
      if (signal.aborted) throw new Error("aborted");
    }
    this.notice(conv, item, "warn", "Stopped after many steps in a row. Say “continue” if you want me to keep going.");
  }

  private async runTool(conv: StoredConversation, item: Extract<TranscriptItem, { role: "assistant" }>, call: { id: string; name: string; input: unknown }, signal: AbortSignal): Promise<ToolResult> {
    const part: ToolPart = { kind: "tool", id: call.id, name: call.name, input: call.input, summary: call.name, risk: "caution", status: "running" };
    item.parts.push(part);
    const update = () => this.deps.emit({ type: "tool", convId: conv.id, part: { ...part } });
    const finish = (status: ToolPart["status"], content: string, isError: boolean): ToolResult => {
      part.status = status;
      part.result = content;
      update();
      return { id: call.id, content, isError };
    };

    if (signal.aborted) return finish("denied", "Cancelled by the user before it ran.", true);
    if (call.name === SKILL_TOOL_NAME) {
      // Know-how, not a DAW action: a read that never asks.
      const s = runSkillTool(call.input);
      part.risk = "read";
      part.summary = s.summary;
      return finish(s.ok ? "done" : "failed", s.text, !s.ok);
    }
    if (call.name === WEB_TOOL_NAME) {
      // Reads a public page: never asks, never touches REAPER.
      part.risk = "read";
      part.summary = "Read a web page";
      if (!this.deps.web?.enabled()) return finish("failed", "Web access is off (Settings → AI), so the page wasn't read.", true);
      // A page could tell the model to put chat details into a web address. Addresses already in
      // the chat (the user's, or links on a page it read) are fine; a new one needs the user's OK.
      const url = typeof (call.input as { url?: unknown })?.url === "string" ? (call.input as { url: string }).url : "";
      const { mode, rules } = this.deps.permissions();
      const allowed = mode === "full-auto" || rules[WEB_TOOL_NAME] === "allow" || !!this.chatAllowed.get(conv.id)?.has(WEB_TOOL_NAME);
      if (url && !allowed && !urlSeen(conv, item, url)) {
        part.risk = "caution";
        part.summary = `Open ${url.length > 160 ? url.slice(0, 157) + "…" : url}`;
        part.status = "awaiting-approval";
        update();
        const ok = await new Promise<boolean>((resolve) => {
          this.approvals.set(call.id, { resolve, convId: conv.id, name: call.name });
          signal.addEventListener("abort", () => this.answerApproval(call.id, false), { once: true });
        });
        if (!ok) return finish("denied", "The user didn't allow opening that address. It was not read.", true);
        part.status = "running";
      }
      update();
      const w = await runWebTool(call.input, signal, this.deps.web.deps);
      part.summary = w.summary;
      return finish(w.ok ? "done" : "failed", w.text, !w.ok);
    }
    if (!isCommandName(call.name)) return finish("failed", `Unknown tool ${call.name}.`, true);
    const spec = COMMANDS[call.name];
    part.risk = spec.risk;
    const v = validateArgs(call.name, call.input);
    if (!v.ok) return finish("failed", `Invalid arguments, nothing was run: ${v.message}`, true);
    part.input = v.args;
    part.summary = describeCommand(call.name, v.args);

    if (this.needsApproval(conv.id, call.name)) {
      part.status = "awaiting-approval";
      update();
      const ok = await new Promise<boolean>((resolve) => {
        this.approvals.set(call.id, { resolve, convId: conv.id, name: call.name });
        signal.addEventListener("abort", () => this.answerApproval(call.id, false), { once: true });
      });
      if (!ok) return finish("denied", "The user denied this action. It was not run.", true);
    }

    part.status = "running";
    update();
    try {
      const out = await this.deps.daw.run(call.name, v.args, signal);
      return finish(out.ok ? "done" : "failed", out.text, !out.ok);
    } catch (e) {
      return finish("failed", e instanceof Error ? e.message : String(e), true);
    }
  }
}

export type { AssistantPart };

/** https addresses mentioned so far in a chat: the user's messages and every tool result. */
function seenUrls(conv: StoredConversation, current: Extract<TranscriptItem, { role: "assistant" }>): Set<string> {
  const out = new Set<string>();
  const add = (text: string | undefined) => {
    for (const m of text?.matchAll(/https:\/\/[^\s<>"'`)\]]+/g) ?? []) out.add(normUrl(m[0]));
  };
  for (const t of [...conv.transcript, current]) {
    if (t.role === "user") add(t.text);
    else for (const p of t.parts) if (p.kind === "tool") add(p.result);
  }
  return out;
}

const normUrl = (u: string) => u.replace(/#.*$/, "").replace(/[.,;:!?]+$/, "").replace(/\/$/, "");

function urlSeen(conv: StoredConversation, current: Extract<TranscriptItem, { role: "assistant" }>, url: string): boolean {
  return seenUrls(conv, current).has(normUrl(url));
}
