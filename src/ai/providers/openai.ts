import OpenAI from "openai";
import type { ImageRef, ProviderId } from "@shared/types";
import { PROVIDERS } from "@shared/types";
import { placeholderFor, placeholderId, type ImageLoader } from "./images";
import { ProviderError, type ChatSession, type PlainTurn, type ToolCall, type ToolResult, type TurnOptions, type TurnResult } from "./types";

type Msg = OpenAI.Chat.Completions.ChatCompletionMessageParam;
type Part = OpenAI.Chat.Completions.ChatCompletionContentPart;

const MISSING_IMAGE = "[An image the user attached here is no longer available.]";

/** A user turn: images first, then the text. Images are placeholders until the request is built. */
export function userContent(text: string, images?: ImageRef[]): string | Part[] {
  if (!images?.length) return text;
  const parts: Part[] = images.map((img) => ({ type: "image_url", image_url: { url: placeholderFor(img.id) } }));
  parts.push({ type: "text", text: text || "(image)" });
  return parts;
}

/** The history as sent: placeholders become data: URLs of the stored pixels (or a short note when one is gone). */
export function hydrateMessages(messages: Msg[], load: ImageLoader | undefined): Msg[] {
  return messages.map((m) => {
    if (m.role !== "user" || typeof m.content === "string" || !m.content.some((p) => p.type === "image_url" && placeholderId(p.image_url.url))) return m;
    const content = m.content.map((p): Part => {
      if (p.type !== "image_url") return p;
      const id = placeholderId(p.image_url.url);
      if (!id) return p;
      const img = load?.(id);
      return img ? { type: "image_url", image_url: { url: `data:${img.mime};base64,${img.base64}` } } : { type: "text", text: MISSING_IMAGE };
    });
    return { ...m, content };
  });
}

/** One client for OpenAI, Gemini, OpenRouter, Ollama and LM Studio: all speak chat completions. */
export function openaiClient(provider: ProviderId, apiKey: string | null, baseURL: string): OpenAI {
  return new OpenAI({
    apiKey: apiKey ?? "local", // local servers ignore it, but the client requires a value
    baseURL,
    maxRetries: 2,
    defaultHeaders: provider === "openrouter" ? { "X-Title": "REAPER Assist" } : undefined,
  });
}

export async function listOpenAIModels(client: OpenAI): Promise<string[]> {
  const out: string[] = [];
  for await (const m of client.models.list()) out.push(m.id.replace(/^models\//, ""));
  return out.sort();
}

export function describeOpenAIError(provider: ProviderId, e: unknown): ProviderError {
  const name = PROVIDERS[provider].label;
  if (e instanceof OpenAI.AuthenticationError) return new ProviderError(`${name} rejected the API key. Check it in Settings → AI.`);
  if (e instanceof OpenAI.NotFoundError) return new ProviderError(`${name} doesn't know that model. Pick one from the list in Settings → AI.`);
  if (e instanceof OpenAI.RateLimitError) return new ProviderError(`${name} is rate-limiting this key (or the account is out of credit).`, true);
  if (e instanceof OpenAI.BadRequestError && /\b(image|vision|multimodal|image_url)/i.test(e.message)) {
    return new ProviderError(`${name} couldn't read the attached image. Pick a model that accepts images in Settings → AI, or send without it. (${e.message})`);
  }
  if (e instanceof OpenAI.BadRequestError) return new ProviderError(`${name} couldn't accept the request: ${e.message}`);
  if (e instanceof OpenAI.APIConnectionError) {
    return new ProviderError(
      PROVIDERS[provider].needsKey ? `Couldn't reach ${name}. Check your connection.` : `Couldn't reach ${name}. Is it running? (${PROVIDERS[provider].defaultBaseUrl})`,
      true,
    );
  }
  if (e instanceof OpenAI.APIError) return new ProviderError(`${name} error ${e.status ?? ""}: ${e.message}`);
  return new ProviderError(e instanceof Error ? e.message : String(e));
}

export class OpenAISession implements ChatSession {
  readonly key: string;
  private messages: Msg[];

  constructor(
    private provider: ProviderId,
    private client: OpenAI,
    private model: string,
    restore?: unknown,
    plain?: PlainTurn[],
  ) {
    this.key = `${provider}:${model}`;
    if (Array.isArray(restore)) this.messages = restore as Msg[];
    else this.messages = (plain ?? []).map((t) => (t.role === "user" ? { role: "user", content: userContent(t.text, t.images) } : { role: "assistant", content: t.text }) as Msg);
  }

  serialize(): unknown {
    return this.messages;
  }

  addUser(text: string, images?: ImageRef[]): void {
    this.messages.push({ role: "user", content: userContent(text, images) });
  }

  addToolResults(results: ToolResult[]): void {
    for (const r of results) this.messages.push({ role: "tool", tool_call_id: r.id, content: r.isError ? `ERROR: ${r.content}` : r.content });
  }

  async turn(opts: TurnOptions): Promise<TurnResult> {
    const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = opts.tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.schema },
    }));
    let text = "";
    const calls = new Map<number, { id: string; name: string; args: string }>();
    let finish: string | null = null;
    try {
      const stream = await this.client.chat.completions.create(
        // An empty tools list is rejected by some servers, so leave it out when REAPER isn't connected.
        { model: this.model, messages: [{ role: "system", content: opts.system }, ...hydrateMessages(this.messages, opts.images)], ...(tools.length ? { tools } : {}), stream: true },
        { signal: opts.signal },
      );
      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (!choice) continue;
        const d = choice.delta;
        if (d?.content) {
          text += d.content;
          opts.onText(d.content);
        }
        for (const tc of d?.tool_calls ?? []) {
          const cur = calls.get(tc.index) ?? { id: "", name: "", args: "" };
          if (tc.id) cur.id = tc.id;
          if (tc.function?.name) cur.name += tc.function.name;
          if (tc.function?.arguments) cur.args += tc.function.arguments;
          calls.set(tc.index, cur);
        }
        if (choice.finish_reason) finish = choice.finish_reason;
      }
    } catch (e) {
      if (opts.signal.aborted) throw e;
      throw describeOpenAIError(this.provider, e);
    }

    if (finish === "content_filter") {
      const last = this.messages[this.messages.length - 1];
      if (last?.role === "user") this.messages.pop();
      return { stop: "refusal", toolCalls: [] };
    }

    const list = [...calls.entries()].sort((a, b) => a[0] - b[0]).map(([i, c]) => ({ ...c, id: c.id || `call_${Date.now()}_${i}` }));
    if (finish === "length" && list.length) {
      return { stop: "max_tokens", toolCalls: [], note: "The reply was cut off in the middle of an action, so nothing was run." };
    }

    this.messages.push({
      role: "assistant",
      content: text || null,
      ...(list.length ? { tool_calls: list.map((c) => ({ id: c.id, type: "function" as const, function: { name: c.name, arguments: c.args || "{}" } })) } : {}),
    });

    // Some servers report "stop" even when they called tools, so trust the calls themselves.
    if (list.length) {
      const toolCalls: ToolCall[] = list.map((c) => {
        let input: unknown;
        try {
          input = c.args ? JSON.parse(c.args) : {};
        } catch {
          input = { __invalidJson: c.args };
        }
        return { id: c.id, name: c.name, input };
      });
      return { stop: "tool_use", toolCalls };
    }
    return { stop: finish === "length" ? "max_tokens" : "end", toolCalls: [] };
  }
}
