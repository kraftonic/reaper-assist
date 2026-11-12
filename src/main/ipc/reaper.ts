import { ipcMain, shell } from "electron";
import { COMMANDS, COMMAND_NAMES } from "@daw/reaper/commands";
import { installBridge, installedScriptPath } from "@daw/reaper/install";
import { bridgeLua } from "../paths";
import { applyProfile, quitAndFinish, restoreReaper } from "../profiles";
import { dawStatus } from "../reaperLink";

/** The REAPER connection, and DAW profiles ("Make REAPER feel like home"). */
export function wireReaperIpc(): void {
  ipcMain.handle("daw:status", () => dawStatus());
  ipcMain.handle("daw:install", (_e, opts: { autostart?: boolean }) => installBridge(bridgeLua(), { autostart: opts?.autostart === true }));
  ipcMain.handle("daw:reveal", () => shell.showItemInFolder(installedScriptPath()));
  ipcMain.handle("daw:actions", () =>
    COMMAND_NAMES.map((name) => ({ name, summary: COMMANDS[name].summary, risk: COMMANDS[name].risk, alwaysConfirm: !!COMMANDS[name].alwaysConfirm })),
  );
  ipcMain.handle("look:apply", (_e, id: unknown) => applyProfile(String(id)));
  ipcMain.handle("look:restore", (_e, opts: unknown) => restoreReaper((opts as { to?: string } | undefined)?.to === "defaults"));
  ipcMain.handle("reaper:quitAndFinish", () => quitAndFinish());
}
