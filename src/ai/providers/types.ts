import type { ImageRef } from "@shared/types";
import type { ImageLoader } from "./images";

export interface ToolDef {
  name: string;
  description: string;
  schema: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  input: unknown;
}

export type StopKind = "end" | "tool_use" | "refusal" | "max_tokens" | "other";

export interface TurnResult {
  stop: StopKind;
  toolCalls: ToolCall[];
  /** Short note for the user, e.g. why a refusal happened or which model answered. */
  note?: string;
}

export interface TurnOptions {
  system: string;
  tools: ToolDef[];
  onText: (delta: string) => void;
  signal: AbortSignal;
  /** Reads attached images by id; the history only holds placeholders. Without it, images are sent as a short note. */
  images?: ImageLoader;
  /** Web access is on: providers with their own web search and fetch add them to the tools. */
  web?: boolean;
}

export interface ToolResult {
  id: string;
  content: string;
  isError: boolean;
}

/** Plain-text history used to start a provider session from a saved transcript. User turns keep their images. */
export type PlainTurn = { role: "user" | "assistant"; text: string; images?: ImageRef[] };

/**
 * One conversation with one model. History is append-only: earlier turns are
 * never rewritten, which keeps prompt caching (and, on newer Claude models,
 * preserved reasoning) valid across the whole conversation.
 */
export interface ChatSession {
  readonly key: string;
  /** The provider searches and reads the web itself when `web` is on, so Assist's readWebPage isn't needed. */
  readonly nativeWeb?: boolean;
  /** A user turn. Images go before the text, the way the providers recommend. */
  addUser(text: string, images?: ImageRef[]): void;
  turn(opts: TurnOptions): Promise<TurnResult>;
  addToolResults(results: ToolResult[]): void;
  /** Native history, persisted so the same session can resume after restart. */
  serialize(): unknown;
}

export class ProviderError extends Error {
  constructor(message: string, readonly retryable = false) {
    super(message);
  }
}
