import { PROVIDERS, PROVIDER_IDS, type ProviderId } from "@shared/types";
import { AnthropicSession, anthropicClient, describeAnthropicError, listAnthropicModels } from "@ai/providers/anthropic";
import { CLI_MODELS, cliStatus, type CliKind } from "@ai/providers/cli";
import { OpenAISession, describeOpenAIError, listOpenAIModels, openaiClient } from "@ai/providers/openai";
import { ProviderError } from "@ai/providers/types";
import { ctx } from "./state";

/*
 * Glue between Settings (which provider, model and key) and the provider clients in src/ai/providers.
 * Keys never leave the main process.
 */

export const isCli = (id: ProviderId): id is CliKind => PROVIDERS[id].kind === "cli";

export function isProvider(v: unknown): v is ProviderId {
  return typeof v === "string" && (PROVIDER_IDS as string[]).includes(v);
}

function requireKey(id: ProviderId): string | null {
  const key = ctx.settings.getKey(id);
  if (PROVIDERS[id].needsKey && !key) throw new ProviderError(`Add your ${PROVIDERS[id].label} API key in Settings → AI to start chatting.`);
  return key;
}

/** The provider and model chats use right now. `key` changes whenever either does. */
export function active() {
  const provider = ctx.settings.raw.activeProvider;
  const model = ctx.settings.raw.providers[provider].model;
  return { provider, model, key: `${provider}:${model}` };
}

/** A chat session with the active API provider, resuming `restore` (its native history) or a plain transcript. */
export function makeSession(restore: unknown, plain: { role: "user" | "assistant"; text: string }[] | undefined) {
  const { provider, model } = active();
  if (isCli(provider)) throw new ProviderError("That provider runs through its CLI.");
  if (!model) throw new ProviderError(`Pick a model for ${PROVIDERS[provider].label} in Settings → AI.`);
  const key = requireKey(provider);
  const s = ctx.settings.raw;
  const baseUrl = s.providers[provider].baseUrl;
  if (PROVIDERS[provider].kind === "anthropic") return new AnthropicSession(anthropicClient(key!, baseUrl), model, s.effort, baseUrl, restore, plain);
  return new OpenAISession(provider, openaiClient(provider, key, baseUrl), model, restore, plain);
}

export async function listModels(id: ProviderId): Promise<{ models: string[]; error?: string }> {
  if (isCli(id)) {
    const st = await cliStatus(id);
    return st.loggedIn ? { models: CLI_MODELS[id] } : { models: CLI_MODELS[id], error: st.detail };
  }
  try {
    const key = requireKey(id);
    const baseUrl = ctx.settings.raw.providers[id].baseUrl;
    if (PROVIDERS[id].kind === "anthropic") return { models: await listAnthropicModels(anthropicClient(key!, baseUrl)) };
    return { models: await listOpenAIModels(openaiClient(id, key, baseUrl)) };
  } catch (e) {
    const err = e instanceof ProviderError ? e : PROVIDERS[id].kind === "anthropic" ? describeAnthropicError(e) : describeOpenAIError(id, e);
    return { models: [], error: err.message };
  }
}
