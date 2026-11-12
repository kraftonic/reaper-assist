import type { WorkflowId } from "@profiles";
/** Types shared by the main process, the preload bridge and the renderer. */

export type ProviderId = "claude-cli" | "codex-cli" | "anthropic" | "openai" | "gemini" | "openrouter" | "ollama" | "lmstudio";

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  /** Which client talks to it. Everything except Anthropic speaks the OpenAI chat-completions dialect. */
  kind: "anthropic" | "openai-compat" | "cli";
  defaultBaseUrl: string;
  needsKey: boolean;
  keyUrl?: string;
  /** Suggested models, shown before the live list is fetched. */
  suggestedModels: string[];
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  // Personal use only: the user's own installed CLI and subscription (dev builds). See src/ai/providers/cli.ts.
  "claude-cli": {
    id: "claude-cli",
    label: "My Claude subscription (via Claude Code)",
    kind: "cli",
    defaultBaseUrl: "",
    needsKey: false,
    suggestedModels: ["default", "opus", "sonnet", "haiku"],
  },
  "codex-cli": {
    id: "codex-cli",
    label: "My ChatGPT plan (via Codex)",
    kind: "cli",
    defaultBaseUrl: "",
    needsKey: false,
    suggestedModels: ["default"],
  },
  anthropic: {
    id: "anthropic",
    label: "Claude (Anthropic)",
    kind: "anthropic",
    defaultBaseUrl: "https://api.anthropic.com",
    needsKey: true,
    keyUrl: "https://platform.claude.com/settings/keys",
    suggestedModels: ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"],
  },
  openai: {
    id: "openai",
    label: "ChatGPT (OpenAI)",
    kind: "openai-compat",
    defaultBaseUrl: "https://api.openai.com/v1",
    needsKey: true,
    keyUrl: "https://platform.openai.com/api-keys",
    suggestedModels: [],
  },
  gemini: {
    id: "gemini",
    label: "Gemini (Google)",
    kind: "openai-compat",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
    needsKey: true,
    keyUrl: "https://aistudio.google.com/apikey",
    suggestedModels: [],
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    kind: "openai-compat",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    needsKey: true,
    keyUrl: "https://openrouter.ai/keys",
    suggestedModels: [],
  },
  ollama: {
    id: "ollama",
    label: "Ollama (local)",
    kind: "openai-compat",
    defaultBaseUrl: "http://localhost:11434/v1",
    needsKey: false,
    suggestedModels: [],
  },
  lmstudio: {
    id: "lmstudio",
    label: "LM Studio (local)",
    kind: "openai-compat",
    defaultBaseUrl: "http://localhost:1234/v1",
    needsKey: false,
    suggestedModels: [],
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

/* ---------------------------------------------------------------- themes */

export const THEME_TOKENS = [
  "bg",
  "panel",
  "panelAlt",
  "border",
  "text",
  "textDim",
  "accent",
  "accentText",
  "accent2",
  "ok",
  "warn",
  "danger",
  "userBubble",
  "codeBg",
] as const;
export type ThemeToken = (typeof THEME_TOKENS)[number];

export interface Theme {
  id: string;
  name: string;
  /** One line shown in the theme picker. */
  blurb: string;
  scheme: "dark" | "light";
  colors: Record<ThemeToken, string>;
  radius: number;
  fontFamily: string;
  fontSize: number;
  /** Spacing multiplier: 0.8 compact … 1.25 roomy. */
  density: number;
  /** Panel surface style. */
  surface: "flat" | "gradient" | "glass";
}

/* -------------------------------------------------------------- settings */

export interface ProviderSettingsView {
  baseUrl: string;
  model: string;
  hasKey: boolean;
  /** Last four characters of the stored key, for recognition only. */
  keyHint: string | null;
}

/** Like Claude Code / Codex: how much Assist may do in REAPER without asking. */
export type PermissionMode = "ask" | "auto-edits" | "full-auto";
export type PermissionRule = "allow" | "ask";
export interface Permissions {
  mode: PermissionMode;
  /** Per-action overrides, e.g. { addFx: "allow" }. Beat the mode. */
  rules: Record<string, PermissionRule>;
}
/** once = just this time; chat = this action for the rest of this chat; always = add an allow rule. */
export type ApprovalAnswer = "once" | "chat" | "always" | "deny";

export interface SettingsView {
  activeProvider: ProviderId;
  providers: Record<ProviderId, ProviderSettingsView>;
  effort: Effort;
  /** Let the assistant search the web and read pages (through the AI provider, or Assist's own page reader). */
  webAccess: boolean;
  permissions: Permissions;
  /** The DAW the user is coming from; REAPER's look, shortcuts and the assistant's wording follow it. */
  workflow: WorkflowId | null;
  daw: {
    enabled: boolean;
    bridgeDir: string;
    /** REAPER's resource folder, for a portable install; empty = the usual place for this OS. */
    resourcePath: string;
    /** Run read-only and low-risk DAW actions without asking. Edits to existing material always ask. */
    autoApproveSafe: boolean;
  };
  hotkey: string;
  alwaysOnTop: boolean;
  dock: "right" | "left" | "free";
  /** True when keys can be stored in the OS keychain. */
  secureStorage: boolean;
  /** Personal-subscription CLI providers are offered (dev builds / REAPER_ASSIST_PERSONAL_CLI=1 only). */
  cliAllowed: boolean;
}

export type SettingsPatch = Partial<Omit<SettingsView, "providers" | "daw" | "secureStorage" | "cliAllowed">> & {
  providers?: Partial<Record<ProviderId, Partial<Pick<ProviderSettingsView, "baseUrl" | "model">>>>;
  daw?: Partial<SettingsView["daw"]>;
};

/* ------------------------------------------------------------------ chat */

export type Risk = "read" | "safe" | "caution" | "destructive";

export type ToolStatus = "awaiting-approval" | "running" | "done" | "denied" | "failed";

export interface ToolPart {
  kind: "tool";
  id: string;
  name: string;
  input: unknown;
  /** Plain-language description of what the action does. */
  summary: string;
  risk: Risk;
  status: ToolStatus;
  result?: string;
  /** The user undid this change from its card. */
  undone?: boolean;
}

export type AssistantPart = { kind: "text"; text: string } | ToolPart | { kind: "notice"; level: "info" | "warn" | "error"; text: string };

/** Image formats every provider accepts. Everything else is converted in the panel first. */
export type ImageMime = "image/png" | "image/jpeg";

/** An image attached to a user message. The pixels live in the chat's folder, never in the transcript. */
export interface ImageRef {
  id: string;
  mime: ImageMime;
  width: number;
  height: number;
  bytes: number;
  /** Original file name, when there was one (pasted screenshots have none). */
  name?: string;
}

/** An image the panel has prepared (downsized, re-encoded) and is sending for the first time. */
export interface NewImage {
  mime: ImageMime;
  /** Base64, no data: prefix. */
  data: string;
  name?: string;
}

export interface UserItem {
  role: "user";
  text: string;
  at: number;
  images?: ImageRef[];
  /** Skill the message was sent with (a /command). */
  skill?: { id: string; title: string };
  /** Labels of the REAPER context that went with the message, e.g. "2 tracks: Bass, Drums". */
  context?: string[];
}

export type TranscriptItem = UserItem | { role: "assistant"; parts: AssistantPart[]; at: number; model: string; provider: ProviderId };

/** What goes with a message besides the text. */
export interface ChatInput {
  text: string;
  /** New images (prepared by the panel). */
  images?: NewImage[];
  /** Images already stored with this chat (re-sent when editing or retrying). */
  keepImages?: ImageRef[];
  /** Context parts the user switched off for this message (ContextChip ids). */
  contextOff?: string[];
  /** Labels of the context chips that were on, kept with the message. */
  contextLabels?: string[];
  /** @-mentions picked from the menu: `label` as typed after the @, `ref` what it means. */
  mentions?: { label: string; ref: string }[];
}

/** One toggleable piece of REAPER context shown above the chat box. */
export interface ContextChip {
  id: string;
  /** Short label, e.g. "2 tracks: Bass, Drums" or "Bars 9–16". */
  label: string;
  /** Longer text for the tooltip. */
  detail?: string;
  icon: "tracks" | "items" | "time" | "midi" | "section" | "project" | "record";
}

/** Something the user can @-mention: a track or a section (region or marker). */
export interface Mentionable {
  kind: "track" | "section";
  name: string;
  /** Short hint shown in the menu, e.g. "track 3" or "bars 17–24". */
  hint: string;
  /** What the model is told the mention refers to. */
  ref: string;
}

export interface ContextPreview {
  connected: boolean;
  chips: ContextChip[];
  mentions: Mentionable[];
  /** Flags quick actions use to decide what to offer. */
  has: { selectedTracks: number; selectedItems: number; timeSelection: boolean; armed: number; midiEditor: boolean; recording: boolean };
}

export interface SkillInfo {
  id: string;
  title: string;
  when: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: number;
}

export interface ConversationView extends ConversationSummary {
  transcript: TranscriptItem[];
}

export type ChatEvent =
  | { type: "text"; convId: string; delta: string }
  | { type: "tool"; convId: string; part: ToolPart }
  | { type: "notice"; convId: string; level: "info" | "warn" | "error"; text: string }
  | { type: "done"; convId: string; conversation: ConversationView };

/* ------------------------------------------------------------------- DAW */

export interface DawStatus {
  enabled: boolean;
  /** "connected": bridge heartbeat is fresh. "stale": REAPER closed or the script stopped. */
  state: "disabled" | "not-installed" | "waiting" | "connected" | "stale";
  reaperVersion?: string;
  project?: string;
  playState?: string;
  bridgeDir: string;
  installedAt?: string | null;
  /** REAPER is running an older Assist script; a REAPER restart picks up the new one. */
  bridgeOutdated?: boolean;
}

/* ------------------------------------------------------------- IPC shape */

export interface AssistApi {
  getSettings(): Promise<SettingsView>;
  updateSettings(patch: SettingsPatch): Promise<SettingsView>;
  setApiKey(provider: ProviderId, key: string | null): Promise<SettingsView>;
  listModels(provider: ProviderId): Promise<{ models: string[]; error?: string }>;
  testProvider(provider: ProviderId): Promise<{ ok: boolean; message: string }>;
  cliStatus(provider: ProviderId): Promise<{ installed: boolean; loggedIn: boolean; detail: string }>;

  listConversations(): Promise<ConversationSummary[]>;
  getConversation(id: string): Promise<ConversationView | null>;
  newConversation(): Promise<ConversationView>;
  deleteConversation(id: string): Promise<void>;
  send(convId: string, input: ChatInput): Promise<{ ok: boolean; message?: string }>;
  /** Drop the last answer and ask again (with the context chips as they are now). */
  retry(convId: string, input?: Pick<ChatInput, "contextOff" | "contextLabels">): Promise<{ ok: boolean; message?: string }>;
  /** Replace the user message at `index` (and everything after it) and send again. */
  editAndResend(convId: string, index: number, input: ChatInput): Promise<{ ok: boolean; message?: string }>;
  stop(convId: string): Promise<void>;
  answerApproval(toolId: string, answer: ApprovalAnswer): Promise<void>;
  /** Undo a change the assistant made, using the undo label REAPER returned for it. */
  undoTool(convId: string, toolId: string): Promise<{ ok: boolean; message: string; conversation?: ConversationView }>;
  /** An attached image as a data: URL, for thumbnails. */
  getImage(convId: string, imageId: string): Promise<string | null>;
  /** What REAPER context would go with the next message, plus @-mention targets. */
  chatContext(): Promise<ContextPreview>;
  /** Skills for / commands. */
  listSkills(): Promise<SkillInfo[]>;
  /** Actions REAPER can be asked to do, for the permissions list. */
  listActions(): Promise<{ name: string; summary: string; risk: "read" | "safe" | "caution"; alwaysConfirm: boolean }[]>;
  onChatEvent(cb: (e: ChatEvent) => void): () => void;

  dawStatus(): Promise<DawStatus>;
  installBridge(opts: { autostart: boolean }): Promise<{ ok: boolean; message: string; scriptPath?: string }>;
  revealBridgeScript(): Promise<void>;
  onDawStatus(cb: (s: DawStatus) => void): () => void;
  onSettings(cb: (s: SettingsView) => void): () => void;

  /** Make REAPER look, feel and work like the DAW the user came from (theme, keys, mouse, toolbar, layout, preferences). */
  applyWorkflow(id: WorkflowId): Promise<WorkflowResult>;
  /** Put back everything Assist changed in REAPER, as it was before Assist's first change. */
  /** Put back what Assist changed: as it was before Assist, or REAPER's own defaults. */
  restoreReaper(to?: "defaults"): Promise<WorkflowResult>;
  /** Quit REAPER (it asks to save), finish what waits for it to close, and open it again. */
  quitReaperAndFinish(): Promise<WorkflowResult>;
  buildTemplate(genre: string, bpm?: number): Promise<{ ok: boolean; message: string; tracks?: string[]; notes?: string[] }>;
  installedPlugins(): Promise<string[]>;

  setAlwaysOnTop(on: boolean): Promise<void>;
  openExternal(url: string): Promise<void>;
  platform: string;
}

export interface WorkflowResult {
  ok: boolean;
  steps: { label: string; ok: boolean; detail: string }[];
  /** REAPER was open: the rest is done as soon as it quits. */
  pending?: boolean;
}
