import { readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { app, safeStorage } from "electron";
import { PROVIDERS, PROVIDER_IDS, type Permissions, type Effort, type ProviderId, type SettingsPatch, type SettingsView } from "@shared/types";
import { defaultBridgeDir, setReaperResourcePath } from "@daw/reaper/reaper";
import type { WorkflowId } from "@profiles";

interface StoredProvider {
  baseUrl: string;
  model: string;
  /** base64 of safeStorage-encrypted key. Never plaintext. */
  keyEnc?: string;
  keyHint?: string;
}

interface Stored {
  version: 1;
  activeProvider: ProviderId;
  providers: Record<ProviderId, StoredProvider>;
  effort: Effort;
  webAccess: boolean;
  permissions: Permissions;
  workflow: WorkflowId | null;
  daw: SettingsView["daw"];
  hotkey: string;
  alwaysOnTop: boolean;
  dock: SettingsView["dock"];
}

/** Using a personal subscription through the CLIs is for the owner's own machine, never a shipped build. */
export function personalCliAllowed(): boolean {
  return !app.isPackaged || process.env.REAPER_ASSIST_PERSONAL_CLI === "1";
}

function defaults(): Stored {
  const providers = {} as Record<ProviderId, StoredProvider>;
  for (const id of PROVIDER_IDS) providers[id] = { baseUrl: PROVIDERS[id].defaultBaseUrl, model: PROVIDERS[id].suggestedModels[0] ?? "" };
  return {
    version: 1,
    activeProvider: personalCliAllowed() ? "claude-cli" : "anthropic",
    providers,
    effort: "low",
    webAccess: true,
    permissions: { mode: "auto-edits", rules: {} },
    workflow: null,
    daw: { enabled: true, bridgeDir: defaultBridgeDir(), resourcePath: "", autoApproveSafe: true },
    hotkey: "CommandOrControl+Shift+Space",
    alwaysOnTop: true,
    dock: "right",
  };
}

export class SettingsStore {
  private file: string;
  private data: Stored;

  constructor(dir = app.getPath("userData")) {
    mkdirSync(dir, { recursive: true });
    this.file = join(dir, "settings.json");
    let raw: Partial<Stored> | null = null;
    try {
      raw = JSON.parse(readFileSync(this.file, "utf8")) as Partial<Stored>;
    } catch {
      raw = null;
    }
    // The REAPER folder decides the default bridge folder, so it is set before the defaults are made.
    setReaperResourcePath(raw?.daw?.resourcePath);
    const d = defaults();
    if (!raw) {
      this.data = d;
      return;
    }
    try {
      this.data = { ...d, ...raw, providers: { ...d.providers }, daw: { ...d.daw, ...raw.daw } };
      // Builds before the rename used <REAPER>/KraftonicAssist/bridge; the bridge now uses ReaperAssist.
      if (/[\\/]KraftonicAssist[\\/]bridge[\\/]?$/.test(this.data.daw.bridgeDir)) this.data.daw.bridgeDir = d.daw.bridgeDir;
      // Skins (panel looks, tints, custom themes) were removed; the panel follows the DAW profile.
      for (const k of ["themeId", "skinReaper", "customThemes", "adjust"]) delete (this.data as unknown as Record<string, unknown>)[k];
      for (const id of PROVIDER_IDS) this.data.providers[id] = { ...d.providers[id], ...raw.providers?.[id] };
      // Older settings had one switch for low-risk actions.
      if (!raw.permissions) this.data.permissions = { mode: raw.daw?.autoApproveSafe === false ? "ask" : "auto-edits", rules: {} };
      else this.data.permissions = { mode: raw.permissions.mode ?? "auto-edits", rules: { ...raw.permissions.rules } };
      // A subscription provider picked in a dev build is not available in a shipped one.
      if (!PROVIDERS[this.data.activeProvider] || (PROVIDERS[this.data.activeProvider].kind === "cli" && !personalCliAllowed())) this.data.activeProvider = d.activeProvider;
    } catch {
      this.data = d;
    }
  }

  private save(): void {
    const tmp = this.file + ".tmp";
    writeFileSync(tmp, JSON.stringify(this.data, null, 2), { mode: 0o600 });
    renameSync(tmp, this.file);
  }

  get raw(): Readonly<Stored> {
    return this.data;
  }

  view(): SettingsView {
    const providers = {} as SettingsView["providers"];
    for (const id of PROVIDER_IDS) {
      const p = this.data.providers[id];
      providers[id] = { baseUrl: p.baseUrl, model: p.model, hasKey: !!p.keyEnc, keyHint: p.keyHint ?? null };
    }
    const { version: _v, providers: _p, ...rest } = this.data;
    return { ...rest, providers, secureStorage: safeStorage.isEncryptionAvailable(), cliAllowed: personalCliAllowed() };
  }

  update(patch: SettingsPatch): SettingsView {
    const { providers, daw, ...rest } = patch;
    Object.assign(this.data, rest);
    if (rest.webAccess !== undefined) this.data.webAccess = !!rest.webAccess;
    if (daw) this.data.daw = { ...this.data.daw, ...daw };
    if (providers) {
      for (const [id, p] of Object.entries(providers) as [ProviderId, Partial<StoredProvider>][]) {
        if (!PROVIDERS[id] || !p) continue;
        const cur = this.data.providers[id];
        if (typeof p.baseUrl === "string") cur.baseUrl = p.baseUrl.trim() || PROVIDERS[id].defaultBaseUrl;
        if (typeof p.model === "string") cur.model = p.model.trim();
      }
    }
    this.save();
    return this.view();
  }

  allowAlways(name: string): void {
    this.data.permissions = { ...this.data.permissions, rules: { ...this.data.permissions.rules, [name]: "allow" } };
    this.save();
  }

  setKey(id: ProviderId, key: string | null): SettingsView {
    const p = this.data.providers[id];
    if (!key) {
      delete p.keyEnc;
      delete p.keyHint;
    } else {
      if (!safeStorage.isEncryptionAvailable()) throw new Error("This system has no secure key storage, so the key was not saved.");
      const k = key.trim();
      p.keyEnc = safeStorage.encryptString(k).toString("base64");
      p.keyHint = k.slice(-4);
    }
    this.save();
    return this.view();
  }

  /** Decrypted key, main process only. Never send this to the renderer. */
  getKey(id: ProviderId): string | null {
    const enc = this.data.providers[id].keyEnc;
    if (!enc) return null;
    try {
      return safeStorage.decryptString(Buffer.from(enc, "base64"));
    } catch {
      return null;
    }
  }
}
