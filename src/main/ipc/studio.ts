import { ipcMain, shell } from "electron";
import { scanPlugins } from "@studio/plugins";
import { ctx } from "../state";

/** Studio tab: beat templates and plug-ins. */
export function wireStudioIpc(): void {
  ipcMain.handle("tpl:build", async (_e, genre: unknown, bpm: unknown) => {
    try {
      const out = await ctx.reaper.loadTemplate(String(genre), typeof bpm === "number" && bpm >= 40 && bpm <= 220 ? bpm : undefined);
      let parsed: { message?: string; error?: string; note?: string };
      try {
        parsed = JSON.parse(out.text);
      } catch {
        parsed = { error: out.text };
      }
      return { ok: out.ok, message: out.ok ? (parsed.message ?? "Built.") : `${parsed.error ?? "Failed"}. ${parsed.note ?? ""}`, tracks: out.tracks, notes: out.notes };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  });
  ipcMain.handle("plugins:installed", () => scanPlugins());
  ipcMain.handle("open:external", (_e, url: string) => {
    if (typeof url === "string" && /^https:\/\//.test(url)) return shell.openExternal(url);
  });
}
