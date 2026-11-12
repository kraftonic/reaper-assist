/**
 * Electron main process: start-up and wiring only. The pieces live in:
 *   window.ts      the panel window, global hotkey, dev screenshots
 *   providers.ts   Settings → the AI provider clients (src/ai/providers)
 *   reaperLink.ts  the REAPER connection and bridge status (src/daw/reaper)
 *   profiles.ts    applying DAW profiles and Restore REAPER (src/profiles)
 *   ipc/*.ts       what the panel can ask for, one file per area
 */
import { app, globalShortcut } from "electron";
import { join } from "node:path";
import { Agent, DAW_TOOLS } from "@ai/agent";
import { CONTEXT_WITHHELD, togglesFromOff } from "@ai/chatIpc";
import { ConversationStore } from "@ai/conversations";
import { workflowBackground } from "@ai/prompt";
import { runClaudeCli, runCodexCli } from "@ai/providers/cli";
import { startToolServer } from "@ai/toolServer";
import { BridgeUnavailable } from "@daw/reaper/reaper";
import { findWorkflow } from "@profiles";
import { wireChatIpc } from "./ipc/chat";
import { wireReaperIpc } from "./ipc/reaper";
import { wireSettingsIpc } from "./ipc/settings";
import { wireStudioIpc } from "./ipc/studio";
import { runPending, watchPending } from "./profiles";
import { active, isCli, makeSession } from "./providers";
import { connectReaper, dawStatus, refreshInstalledBridge } from "./reaperLink";
import { SettingsStore, personalCliAllowed } from "./settings";
import { ctx, send } from "./state";
import { migrateUserData } from "./migrate";
import { createWindow, registerHotkey } from "./window";

// Screenshot runs use a throwaway HOME without a login keychain. A mock keychain keeps safeStorage from
// blocking on (or showing) a keychain prompt, and keeps those runs away from the real keychain.
if (process.env.KA_SCREENSHOT && process.platform === "darwin") app.commandLine.appendSwitch("use-mock-keychain");

// Dev hook: an isolated profile (used for UI checks and screenshots).
if (process.env.KA_USER_DATA) app.setPath("userData", process.env.KA_USER_DATA);
// Settings, chats and the Restore REAPER record from before the rename (not for isolated dev profiles).
else migrateUserData(app.getPath("userData"));

function createAgent(): Agent {
  const { settings } = ctx;
  return new Agent({
    store: ctx.conversations,
    permissions: () => settings.raw.permissions,
    allowAlways: (name) => {
      settings.allowAlways(name);
      send("settings:changed", settings.view());
    },
    active,
    makeSession,
    emit: (e) => send("chat:event", e),
    background: () => workflowBackground(findWorkflow(settings.raw.workflow), process.platform === "darwin", process.platform === "linux"),
    web: { enabled: () => settings.raw.webAccess },
    cli: {
      runner: (p) => (isCli(p) && personalCliAllowed() ? (p === "claude-cli" ? runClaudeCli : runCodexCli) : null),
      mcp: (convId) => ({
        // Electron's own binary runs the tool server as plain Node.
        command: process.execPath,
        args: [join(__dirname, "mcp.js")],
        env: { ELECTRON_RUN_AS_NODE: "1", KA_URL: ctx.toolServer!.url, KA_TOKEN: ctx.toolServer!.token, KA_CONV: convId },
      }),
      cwd: join(app.getPath("userData"), "cli-workspace"),
    },
    daw: {
      enabled: () => settings.raw.daw.enabled,
      // Chips switched off in the chat box: "project" withholds the whole block, the rest are ContextToggles.
      contextSummary: async (opts) => {
        const reaper = ctx.reaper;
        if (opts?.off?.includes("project")) return (await reaper.status()).state === "connected" ? CONTEXT_WITHHELD : null;
        return (reaper.contextSummary as (t?: Record<string, boolean>) => Promise<string | null>).call(reaper, togglesFromOff(opts?.off));
      },
      run: async (name, args, signal) => {
        try {
          return await ctx.reaper.run(name, args, signal);
        } catch (e) {
          if (e instanceof BridgeUnavailable) return { ok: false, text: e.message };
          throw e;
        }
      },
    },
  });
}

app.whenReady().then(async () => {
  ctx.settings = new SettingsStore();
  await refreshInstalledBridge();
  void runPending().then((done) => done || watchPending());
  if (personalCliAllowed()) {
    ctx.toolServer = await startToolServer({
      tools: () => (ctx.settings.raw.daw.enabled ? DAW_TOOLS : []),
      call: (convId, name, input) => ctx.agent.cliToolCall(convId, name, input),
    });
  }
  ctx.conversations = new ConversationStore(app.getPath("userData"));
  connectReaper(ctx.settings.raw.daw.bridgeDir);
  ctx.agent = createAgent();
  wireSettingsIpc();
  wireChatIpc();
  wireReaperIpc();
  wireStudioIpc();
  createWindow();
  registerHotkey(ctx.settings.raw.hotkey);

  // Tell the panel when the REAPER connection changes.
  let last = "";
  setInterval(async () => {
    const s = await dawStatus().catch(() => null);
    const sig = JSON.stringify(s);
    if (s && sig !== last) {
      last = sig;
      send("daw:status", s);
    }
  }, 1500);

  app.on("activate", () => {
    if (!ctx.win) createWindow();
  });
});

app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
