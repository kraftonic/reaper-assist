import Anthropic from "@anthropic-ai/sdk";
import type { Effort, ImageRef } from "@shared/types";
import { placeholderFor, placeholderId, type ImageLoader } from "./images";
import { ProviderError, type ChatSession, type PlainTurn, type ToolResult, type TurnOptions, type TurnResult } from "./types";

type Msg = Anthropic.Beta.BetaMessageParam;
type Block = Anthropic.Beta.BetaContentBlockParam;

const MISSING_IMAGE = "[An image the user attached here is no longer available.]";

/** A user turn: images first, then the text. Images are placeholders until the request is built. */
export function userContent(text: string, images?: ImageRef[]): Anthropic.Beta.BetaMessageContentParam {
  if (!images?.length) return text;
  const blocks: Block[] = images.map((img) => ({ type: "image", source: { type: "base64", media_type: img.mime, data: placeholderFor(img.id) } }));
  blocks.push({ type: "text", text: text || "(image)" });
  return blocks;
}

/** The history as sent: placeholders swapped for the stored pixels (or a short note when one is gone). */
export function hydrateMessages(messages: Msg[], load: ImageLoader | undefined): Msg[] {
  return messages.map((m) => {
    if (m.role !== "user" || typeof m.content === "string" || !m.content.some((b) => b.type === "image" && b.source.type === "base64" && placeholderId(b.source.data))) return m;
    const content = m.content.map((b): Block => {
      if (b.type !== "image" || b.source.type !== "base64") return b;
      const id = placeholderId(b.source.data);
      if (!id) return b;
      const img = load?.(id);
      return img ? { type: "image", source: { type: "base64", media_type: img.mime, data: img.base64 } } : { type: "text", text: MISSING_IMAGE };
    });
    return { role: "user", content };
  });
}

/** A user message the person typed (not tool results), which a refusal takes back out of the history. */
function isUserInput(m: Msg | undefined): boolean {
  if (!m || m.role !== "user") return false;
  return typeof m.content === "string" || !m.content.some((b) => b.type === "tool_result");
}

const FALLBACK_BETA = "server-side-fallback-2026-07-01";

/** Models that take `output_config.effort`. */
function supportsEffort(model: string): boolean {
  const m = /^claude-(fable|mythos|opus|sonnet|haiku)-(\d+)(?:-(\d+))?/.exec(model);
  if (!m) return false;
  const major = Number(m[2]);
  const minor = Number(m[3] ?? 0);
  return major >= 5 || (m[1] === "opus" && major === 4 && minor >= 5) || (major === 4 && minor >= 6);
}

/** Models that accept the server-side refusal fallback in its "default" form (Claude API only). */
function supportsDefaultFallback(model: string, baseURL: string): boolean {
  if (!/^https:\/\/api\.anthropic\.com\/?$/.test(baseURL)) return false;
  return /^claude-(fable-5|mythos-5|opus-5|sonnet-5-5)/.test(model);
}

/** Which version of Anthropic's web search and web fetch tools a model takes, or null for none. */
export function webToolKind(model: string): "dynamic" | "basic" | null {
  // The minor version is one or two digits, so a date suffix (claude-sonnet-4-20250514) isn't read as one.
  const m = /^claude-(fable|mythos|opus|sonnet|haiku)-(\d+)(?:-(\d{1,2})(?!\d))?/.exec(model);
  if (!m) return null;
  const family = m[1]!;
  const major = Number(m[2]);
  const minor = Number(m[3] ?? 0);
  if (family === "fable" || family === "mythos") return "dynamic";
  // Dynamic filtering (the _20260209 tools) needs Opus or Sonnet 4.6 or later; Haiku takes the basic tools.
  if (family !== "haiku" && (major >= 5 || (major === 4 && minor >= 6))) return "dynamic";
  if (major >= 5 || (major === 4 && (family !== "haiku" || minor >= 5))) return "basic";
  return null;
}

/** Anthropic's server-side web tools. Searches are billed per search, so each reply gets a few at most. */
export function webTools(kind: "dynamic" | "basic" | null): Anthropic.Beta.BetaToolUnion[] {
  if (kind === "dynamic") {
    return [
      { type: "web_search_20260209", name: "web_search", max_uses: 5 },
      { type: "web_fetch_20260209", name: "web_fetch", max_uses: 5, max_content_tokens: 25000 },
    ];
  }
  if (kind === "basic") {
    return [
      { type: "web_search_20250305", name: "web_search", max_uses: 5 },
      { type: "web_fetch_20250910", name: "web_fetch", max_uses: 5, max_content_tokens: 25000 },
    ];
  }
  return [];
}

/** Earlier web searches or fetches in the history (they stay in it, encrypted, so later turns can use them). */
function hasWebBlocks(messages: Msg[]): boolean {
  return messages.some((m) => m.role === "assistant" && typeof m.content !== "string" && m.content.some((b) => b.type === "server_tool_use" && (b.name === "web_search" || b.name === "web_fetch")));
}

/** Short note on the searches a reply ran, so the user can see (and is never surprised by) per-search billing. */
function searchNote(blocks: Anthropic.Beta.BetaContentBlock[], billed: number): string | undefined {
  const queries = blocks.flatMap((b) => (b.type === "server_tool_use" && b.name === "web_search" && typeof (b.input as { query?: unknown })?.query === "string" ? [(b.input as { query: string }).query] : []));
  if (queries.length) return `Searched the web: ${queries.map((q) => `“${q}”`).join(", ")}.`;
  if (billed > 0) return `Searched the web ${billed === 1 ? "once" : `${billed} times`}.`;
  return undefined;
}

const MAX_PAUSES = 5;

export function anthropicClient(apiKey: string, baseURL: string): Anthropic {
  return new Anthropic({ apiKey, baseURL, maxRetries: 2 });
}

export async function listAnthropicModels(client: Anthropic): Promise<string[]> {
  const out: string[] = [];
  for await (const m of client.models.list({ limit: 100 })) out.push(m.id);
  return out;
}

export function describeAnthropicError(e: unknown): ProviderError {
  if (e instanceof Anthropic.AuthenticationError) return new ProviderError("Claude rejected the API key. Check it in Settings → AI.");
  if (e instanceof Anthropic.PermissionDeniedError) return new ProviderError("This API key isn't allowed to use that model.");
  if (e instanceof Anthropic.NotFoundError) return new ProviderError("Claude doesn't know that model name. Pick one from the list in Settings → AI.");
  if (e instanceof Anthropic.RateLimitError) return new ProviderError("Claude is rate-limiting this key. Wait a moment and try again.", true);
  if (e instanceof Anthropic.BadRequestError && /\bimage/i.test(e.message)) return new ProviderError(`Claude couldn't use the attached image (${e.message}). Try a smaller PNG or JPEG, or send without it.`);
  if (e instanceof Anthropic.BadRequestError) return new ProviderError(`Claude couldn't accept the request: ${e.message}`);
  if (e instanceof Anthropic.APIConnectionError) return new ProviderError("Couldn't reach Claude. Check your internet connection.", true);
  if (e instanceof Anthropic.APIError) return new ProviderError(`Claude error ${e.status ?? ""}: ${e.message}`, (e.status ?? 0) >= 500);
  return new ProviderError(e instanceof Error ? e.message : String(e));
}

export class AnthropicSession implements ChatSession {
  readonly key: string;
  private messages: Msg[];
  /** Code-execution container the web tools' filtering ran in; reused for the rest of this reply. */
  private container: string | null = null;

  constructor(
    private client: Anthropic,
    private model: string,
    private effort: Effort,
    private baseURL: string,
    restore?: unknown,
    plain?: PlainTurn[],
  ) {
    this.key = `anthropic:${model}`;
    if (Array.isArray(restore)) this.messages = restore as Msg[];
    else this.messages = (plain ?? []).map((t): Msg => (t.role === "user" ? { role: "user", content: userContent(t.text, t.images) } : { role: "assistant", content: t.text }));
  }

  /** Claude searches and reads pages itself (server tools) when web access is on. */
  get nativeWeb(): boolean {
    return webToolKind(this.model) !== null;
  }

  serialize(): unknown {
    return this.messages;
  }

  addUser(text: string, images?: ImageRef[]): void {
    this.messages.push({ role: "user", content: userContent(text, images) });
  }

  addToolResults(results: ToolResult[]): void {
    // All results of one turn go back in a single user message.
    this.messages.push({
      role: "user",
      content: results.map((r) => ({ type: "tool_result", tool_use_id: r.id, content: r.content, is_error: r.isError || undefined })),
    });
  }

  async turn(opts: TurnOptions): Promise<TurnResult> {
    const tools: Anthropic.Beta.BetaToolUnion[] = opts.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.schema as Anthropic.Beta.BetaTool.InputSchema,
      // Inputs stream as generated; they are validated against the schema before anything runs.
      eager_input_streaming: true,
    }));
    // Server tools last, so turning web access on or off leaves the client tools' order alone.
    tools.push(...webTools(opts.web ? webToolKind(this.model) : null));
    const fallback = supportsDefaultFallback(this.model, this.baseURL);
    const ran: Anthropic.Beta.BetaContentBlock[] = [];
    let billed = 0;
    let pauses = 0;

    for (let attempt = 0; ; attempt++) {
      let message: Anthropic.Beta.BetaMessage;
      try {
        const stream = this.client.beta.messages.stream(
          {
            model: this.model,
            max_tokens: 64000,
            system: opts.system,
            tools,
            messages: hydrateMessages(this.messages, opts.images),
            // Caches the stable prefix (system + tools + earlier turns) automatically.
            cache_control: { type: "ephemeral" },
            ...(supportsEffort(this.model) ? { output_config: { effort: this.effort } } : {}),
            ...(fallback ? { betas: [FALLBACK_BETA], fallbacks: "default" as const } : {}),
            ...(this.container ? { container: this.container } : {}),
          },
          { signal: opts.signal },
        );
        stream.on("text", (d) => opts.onText(d));
        message = await stream.finalMessage();
      } catch (e) {
        if (opts.signal.aborted) throw e;
        // A tool input that could not be parsed at all: re-issue the turn (nothing was appended).
        if (!(e instanceof Anthropic.APIError) && attempt < 2) continue;
        if (e instanceof Anthropic.BadRequestError && /web[ _](search|fetch)/i.test(e.message)) {
          if (opts.web && /not enabled|disabled/i.test(e.message)) {
            throw new ProviderError("Web search is switched off for this Claude account (Claude Console → Settings → Capabilities). Ask the account's admin, or turn off Web access in Settings → AI.");
          }
          if (!opts.web && hasWebBlocks(this.messages)) {
            throw new ProviderError("This chat searched the web earlier, so Claude needs Web access to carry on. Turn it back on in Settings → AI, or start a new chat.");
          }
        }
        throw describeAnthropicError(e);
      }

      if (message.container?.id) this.container = message.container.id;
      ran.push(...message.content);
      billed += message.usage?.server_tool_use?.web_search_requests ?? 0;
      const fellBack = message.content.find((b) => b.type === "fallback");
      const notes = [fellBack && message.stop_reason !== "refusal" ? `Answered by ${message.model} after the first model declined.` : undefined, searchNote(ran, billed)].filter(Boolean);
      const note = notes.length ? notes.join(" ") : undefined;

      if (message.stop_reason === "refusal") {
        // Never run tools from a refused turn. Drop the unanswered user message so history stays clean.
        if (isUserInput(this.messages[this.messages.length - 1])) this.messages.pop();
        const why = message.stop_details?.explanation;
        return { stop: "refusal", toolCalls: [], note: why ?? undefined };
      }

      const toolUses = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
      if (message.stop_reason === "max_tokens" && toolUses.length) {
        return { stop: "max_tokens", toolCalls: [], note: "The reply was cut off in the middle of an action, so nothing was run." };
      }

      // Append the whole content unchanged (thinking and fallback blocks included).
      this.messages.push({ role: "assistant", content: message.content });

      // A long server-side search paused: send it back as it is and the server carries on.
      if (message.stop_reason === "pause_turn" && ++pauses <= MAX_PAUSES) continue;
      if (message.stop_reason === "pause_turn") return { stop: "end", toolCalls: [], note: [note, "Stopped a long web search part-way. Ask again to carry on."].filter(Boolean).join(" ") };
      if (toolUses.length) return { stop: "tool_use", toolCalls: toolUses.map((b) => ({ id: b.id, name: b.name, input: b.input })), note };
      return { stop: message.stop_reason === "max_tokens" ? "max_tokens" : "end", toolCalls: [], note };
    }
  }
}
