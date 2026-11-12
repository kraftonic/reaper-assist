import type { BrowserWindow } from "electron";
import type { Agent } from "@ai/agent";
import type { ConversationStore } from "@ai/conversations";
import type { ToolServer } from "@ai/toolServer";
import type { ReaperConnection } from "@daw/reaper/reaper";
import type { SettingsStore } from "./settings";

/** The app's long-lived objects. index.ts creates them once at start-up; everything else reads them from here. */
export const ctx = {
  win: null as BrowserWindow | null,
  settings: null as unknown as SettingsStore,
  reaper: null as unknown as ReaperConnection,
  agent: null as unknown as Agent,
  conversations: null as unknown as ConversationStore,
  toolServer: null as ToolServer | null,
};

/** Send an event to the panel, if it's open. */
export function send(channel: string, payload: unknown): void {
  const w = ctx.win;
  if (w && !w.isDestroyed()) w.webContents.send(channel, payload);
}
