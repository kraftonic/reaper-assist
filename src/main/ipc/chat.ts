import { ipcMain } from "electron";
import type { ChatEvent } from "@shared/types";
import { createChatIpc, previewFromState, readContextPreview, type SessionLike } from "@ai/chatIpc";
import { view } from "@ai/conversations";
import { listSkills, loadSkill } from "@ai/skills";
import { ctx, send } from "../state";

/** Conversations, sending messages, approvals and skills. */
export function wireChatIpc(): void {
  const { conversations, agent } = ctx;
  ipcMain.handle("conv:list", () => conversations.list());
  ipcMain.handle("conv:get", (_e, id: string) => {
    const c = conversations.get(id);
    return c ? view(c) : null;
  });
  ipcMain.handle("conv:new", () => view(conversations.create()));
  ipcMain.handle("conv:delete", (_e, id: string) => {
    agent.stop(id);
    conversations.delete(id);
  });
  const chat = createChatIpc({
    store: conversations,
    agent,
    undo: async (expectLabel) => {
      try {
        return await ctx.reaper.run("undo", { expectLabel });
      } catch (e) {
        return { ok: false, text: e instanceof Error ? e.message : String(e) };
      }
    },
    skills: { list: listSkills, load: loadSkill },
    onError: (convId, text) => send("chat:event", { type: "notice", convId, level: "error", text } satisfies ChatEvent),
  });
  ipcMain.handle("chat:send", (_e, id: string, input: unknown) => chat.send(String(id), typeof input === "string" ? { text: input } : input));
  ipcMain.handle("chat:retry", (_e, id: string, input: unknown) => chat.retry(String(id), input));
  ipcMain.handle("chat:edit", (_e, id: string, index: unknown, input: unknown) => chat.editAndResend(String(id), index, input));
  ipcMain.handle("chat:undo", (_e, id: string, toolId: string) => chat.undoTool(String(id), String(toolId)));
  ipcMain.handle("conv:image", (_e, id: string, imageId: string) => chat.image(String(id), String(imageId)));
  ipcMain.handle("skills:list", () => listSkills());
  ipcMain.handle("chat:context", async () => {
    if (!ctx.settings.raw.daw.enabled) return previewFromState(null);
    const reaper = ctx.reaper;
    try {
      if ((await reaper.status()).state !== "connected") return previewFromState(null);
      const live = reaper as unknown as { sessionContext?: () => Promise<SessionLike | null> };
      return await readContextPreview({
        session: typeof live.sessionContext === "function" ? () => live.sessionContext!.call(reaper) : undefined,
        state: () => reaper.projectState(),
      });
    } catch {
      return previewFromState(null);
    }
  });
  ipcMain.handle("chat:stop", (_e, id: string) => agent.stop(id));
  ipcMain.handle("chat:approve", (_e, toolId: string, answer: unknown) => {
    const a = answer === "once" || answer === "chat" || answer === "always" ? answer : "deny";
    agent.answerApproval(toolId, a);
  });
}
