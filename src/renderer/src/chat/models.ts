import { PROVIDERS, type ProviderId, type SettingsView } from "@shared/types";

/** What the title bar chip says for the active provider. */
export function chipLabel(prov: ProviderId, model: string): string {
  if (prov === "claude-cli") return model && model !== "default" ? `${model[0]!.toUpperCase()}${model.slice(1)} · my plan` : "Claude · my plan";
  if (prov === "codex-cli") return model && model !== "default" ? `${model} · my plan` : "ChatGPT · my plan";
  return prettyModel(model) || PROVIDERS[prov].label;
}

/** "claude-opus-5-5" → "Opus 5.5"; other ids pass through, minus vendor prefixes. */
export function prettyModel(id: string): string {
  const m = /^claude-(\w+)-(\d+)(?:-(\d+))?$/.exec(id);
  if (m) return `${m[1]![0]!.toUpperCase()}${m[1]!.slice(1)} ${m[2]}${m[3] ? "." + m[3] : ""}`;
  return id.replace(/^.*\//, "");
}

/** Short provider names for the model menu. */
export const PROVIDER_SHORT: Record<ProviderId, string> = {
  "claude-cli": "Claude Code (my plan)",
  "codex-cli": "Codex (my ChatGPT plan)",
  anthropic: "Claude API",
  openai: "OpenAI API",
  gemini: "Gemini API",
  openrouter: "OpenRouter",
  ollama: "Ollama",
  lmstudio: "LM Studio",
};

const CLI_CHOICES: Partial<Record<ProviderId, { id: string; label: string }[]>> = {
  "claude-cli": [
    { id: "default", label: "Plan default" },
    { id: "opus", label: "Opus" },
    { id: "sonnet", label: "Sonnet" },
    { id: "haiku", label: "Haiku" },
  ],
  "codex-cli": [{ id: "default", label: "Plan default" }],
};

export interface ModelGroup {
  provider: ProviderId;
  label: string;
  /** False when the provider still needs a key (picking it opens Settings). */
  ready: boolean;
  models: { id: string; label: string }[];
}

/** Providers and models the switcher offers: everything set up, plus the active one. */
export function modelGroups(s: SettingsView): ModelGroup[] {
  const out: ModelGroup[] = [];
  for (const id of Object.keys(PROVIDERS) as ProviderId[]) {
    const info = PROVIDERS[id];
    if (info.kind === "cli" && !s.cliAllowed) continue;
    const p = s.providers[id];
    const ready = info.kind === "cli" || !info.needsKey || p.hasKey;
    const isLocal = info.kind === "openai-compat" && !info.needsKey;
    // Local servers only show once they've been picked (they need to be running).
    if (!ready && id !== s.activeProvider) continue;
    if (isLocal && !p.model && id !== s.activeProvider) continue;
    const ids = CLI_CHOICES[id]?.map((m) => m.id) ?? Array.from(new Set([p.model, ...info.suggestedModels].filter(Boolean)));
    const models = CLI_CHOICES[id] ?? ids.map((m) => ({ id: m, label: prettyModel(m) }));
    out.push({ provider: id, label: PROVIDER_SHORT[id], ready, models });
  }
  return out;
}
