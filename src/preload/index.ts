import { contextBridge, ipcRenderer } from "electron";
import type { SettingsView, AssistApi, ChatEvent, DawStatus } from "@shared/types";

function on<T>(channel: string, cb: (v: T) => void): () => void {
  const h = (_e: unknown, v: T) => cb(v);
  ipcRenderer.on(channel, h);
  return () => ipcRenderer.removeListener(channel, h);
}

const api: AssistApi = {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  updateSettings: (p) => ipcRenderer.invoke("settings:update", p),
  setApiKey: (id, key) => ipcRenderer.invoke("settings:setKey", id, key),
  listModels: (id) => ipcRenderer.invoke("models:list", id),
  testProvider: (id) => ipcRenderer.invoke("provider:test", id),
  cliStatus: (id) => ipcRenderer.invoke("cli:status", id),

  listConversations: () => ipcRenderer.invoke("conv:list"),
  getConversation: (id) => ipcRenderer.invoke("conv:get", id),
  newConversation: () => ipcRenderer.invoke("conv:new"),
  deleteConversation: (id) => ipcRenderer.invoke("conv:delete", id),
  send: (id, input) => ipcRenderer.invoke("chat:send", id, input),
  retry: (id, input) => ipcRenderer.invoke("chat:retry", id, input),
  editAndResend: (id, index, input) => ipcRenderer.invoke("chat:edit", id, index, input),
  stop: (id) => ipcRenderer.invoke("chat:stop", id),
  answerApproval: (toolId, answer) => ipcRenderer.invoke("chat:approve", toolId, answer),
  undoTool: (id, toolId) => ipcRenderer.invoke("chat:undo", id, toolId),
  getImage: (id, imageId) => ipcRenderer.invoke("conv:image", id, imageId),
  chatContext: () => ipcRenderer.invoke("chat:context"),
  listSkills: () => ipcRenderer.invoke("skills:list"),
  listActions: () => ipcRenderer.invoke("daw:actions"),
  onChatEvent: (cb) => on<ChatEvent>("chat:event", cb),

  dawStatus: () => ipcRenderer.invoke("daw:status"),
  installBridge: (o) => ipcRenderer.invoke("daw:install", o),
  revealBridgeScript: () => ipcRenderer.invoke("daw:reveal"),
  onDawStatus: (cb) => on<DawStatus>("daw:status", cb),
  onSettings: (cb) => on<SettingsView>("settings:changed", cb),

  applyWorkflow: (id) => ipcRenderer.invoke("look:apply", id),
  restoreReaper: (to?: "defaults") => ipcRenderer.invoke("look:restore", to ? { to } : undefined),
  quitReaperAndFinish: () => ipcRenderer.invoke("reaper:quitAndFinish"),
  buildTemplate: (g, bpm) => ipcRenderer.invoke("tpl:build", g, bpm),
  installedPlugins: () => ipcRenderer.invoke("plugins:installed"),
  setAlwaysOnTop: (v) => ipcRenderer.invoke("win:onTop", v),
  openExternal: (url) => ipcRenderer.invoke("open:external", url),
  platform: process.platform,
};

contextBridge.exposeInMainWorld("assist", api);
