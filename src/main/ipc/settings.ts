import { ipcMain } from "electron";
import type { SettingsPatch } from "@shared/types";
import { cliStatus } from "@ai/providers/cli";
import { personalCliAllowed } from "../settings";
import { isCli, isProvider, listModels } from "../providers";
import { defaultBridgeDir, setReaperResourcePath } from "@daw/reaper/reaper";
import { connectReaper } from "../reaperLink";
import { ctx } from "../state";
import { applyOnTop, placeWindow, registerHotkey } from "../window";

/** Settings, AI providers and the window. */
export function wireSettingsIpc(): void {
  ipcMain.handle("settings:get", () => ctx.settings.view());
  ipcMain.handle("settings:update", (_e, patch: SettingsPatch) => {
    const settings = ctx.settings;
    const prevHotkey = settings.raw.hotkey;
    const prevBridge = settings.raw.daw.bridgeDir;
    // A new REAPER folder moves the bridge folder with it, unless that was set by hand.
    if (patch.daw?.resourcePath !== undefined && patch.daw.resourcePath !== settings.raw.daw.resourcePath) {
      const followed = prevBridge === defaultBridgeDir();
      setReaperResourcePath(patch.daw.resourcePath);
      if (followed && patch.daw.bridgeDir === undefined) patch.daw.bridgeDir = defaultBridgeDir();
    }
    if (patch.activeProvider !== undefined && (!isProvider(patch.activeProvider) || (isCli(patch.activeProvider) && !personalCliAllowed()))) delete patch.activeProvider;
    const v = settings.update(patch);
    if (patch.alwaysOnTop !== undefined) applyOnTop(v.alwaysOnTop);
    if (patch.dock !== undefined && ctx.win) placeWindow(ctx.win);
    if (v.hotkey !== prevHotkey && !registerHotkey(v.hotkey)) {
      registerHotkey(prevHotkey);
      return settings.update({ hotkey: prevHotkey });
    }
    if (v.daw.bridgeDir !== prevBridge) connectReaper(v.daw.bridgeDir);
    return v;
  });
  ipcMain.handle("settings:setKey", (_e, id: unknown, key: unknown) => {
    if (!isProvider(id)) throw new Error("Unknown provider");
    return ctx.settings.setKey(id, typeof key === "string" && key.trim() ? key : null);
  });
  ipcMain.handle("models:list", (_e, id: unknown) => (isProvider(id) ? listModels(id) : { models: [], error: "Unknown provider" }));
  ipcMain.handle("provider:test", async (_e, id: unknown) => {
    if (!isProvider(id)) return { ok: false, message: "Unknown provider" };
    const r = await listModels(id);
    return r.error ? { ok: false, message: r.error } : { ok: true, message: `Connected. ${r.models.length} models available.` };
  });
  ipcMain.handle("cli:status", async (_e, id: unknown) => {
    if (!isProvider(id) || !isCli(id)) return { installed: false, loggedIn: false, detail: "Not a CLI provider." };
    if (!personalCliAllowed()) return { installed: false, loggedIn: false, detail: "Only available in personal (unpackaged) builds." };
    return cliStatus(id);
  });
  ipcMain.handle("win:onTop", (_e, on: boolean) => {
    ctx.settings.update({ alwaysOnTop: !!on });
    applyOnTop(!!on);
  });
}
