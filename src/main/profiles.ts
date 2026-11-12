import { app } from "electron";
import { existsSync } from "node:fs";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join, sep } from "node:path";
import type { WorkflowResult } from "@shared/types";
import { openReaper, reaperRunning } from "@daw/reaper/process";
import { defaultReaperResourcePath } from "@daw/reaper/reaper";
import { findWorkflow, type Workflow, type WorkflowId } from "@profiles";
import { installProfile, type ProfileInstall } from "@profiles/engine/install";
import { defaultsOriginal, ensureOriginal, layoutTargets, loadOriginal, markRestored, noteFolders, originalTheme, restoreFiles, restoreShortcutFile } from "@profiles/engine/restore";
import { writeTheme } from "@profiles/engine/theme";
import { DEFAULT_SHORTCUTS, sampleFolders } from "@profiles/engine/workspace";
import { KITS } from "@profiles/kit";
import { skinFromWorkflow } from "@profiles/skins";
import { kitToolbarIcons } from "@profiles/kit/toolbarIcons";
import { profileScriptsDir } from "./paths";
import { ctx } from "./state";

/*
 * Applying a DAW profile to REAPER, and putting REAPER back ("Restore REAPER").
 * The file work lives in src/profiles/engine; this module decides what to do when, given that
 * REAPER may be open.
 */

type Step = WorkflowResult["steps"][number];
const userData = () => app.getPath("userData");

/** Switch the running REAPER to a theme Assist wrote (via the bridge). */
async function loadThemeLive(theme: string, name: string): Promise<Step> {
  const label = "Look";
  const where = `Options → Themes → “${basename(theme).replace(/\.ReaperThemeZip$/i, "")}”`;
  try {
    const st = await ctx.reaper.status();
    if (st.state !== "connected") return { label, ok: true, detail: `The ${name} theme is ready. Assist isn't connected to REAPER right now, so it switches when REAPER restarts (or pick it now: ${where}).` };
    // Every bridge since 0.3 can load a theme, so an older running bridge still switches it now.
    const r = await ctx.reaper.loadColorTheme(theme);
    return { label, ok: true, detail: r.ok ? `REAPER now has the ${name} look.` : `The ${name} theme switches when REAPER restarts, or pick it now: ${where}. (${r.message})` };
  } catch (e) {
    return { label, ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

/** Everything installProfile needs for a profile: its theme file, toolbar icons, scripts and Media Explorer folders. */
async function profileAssets(w: Workflow): Promise<ProfileInstall> {
  const resource = defaultReaperResourcePath();
  const theme = await writeTheme(resource, skinFromWorkflow(w, true));
  const icons = kitToolbarIcons(w, KITS[w.id]);
  const folders = sampleFolders();
  return {
    theme,
    icons,
    scriptsDir: profileScriptsDir(w.id),
    explorer: { startDir: folders[0]?.path ?? homedir(), shortcuts: folders, defaults: DEFAULT_SHORTCUTS() },
  };
}

/** Apply a profile to REAPER's files. REAPER must be closed. */
async function installProfileNow(w: Workflow): Promise<void> {
  const resource = defaultReaperResourcePath();
  const o = await ensureOriginal(userData(), resource, true, assistFolders());
  const assets = await profileAssets(w);
  const docks = w.layout?.browser ? [w.layout.browser].flat() : [];
  if (docks.some((d) => d.tabs.includes("explorer"))) await noteFolders(userData(), o, assets.explorer!.shortcuts.map((f) => f.path));
  await installProfile(resource, w, o, assets);
}

/** What a profile changes, in a few words, for the result card. */
function profileSummary(w: Workflow): string {
  const parts = [`${w.shortcuts.length} shortcuts`];
  if (w.mouse?.length) parts.push("mouse behaviour");
  if (w.toolbars?.length) parts.push("toolbar");
  if (w.layout) parts.push("window layout");
  if (w.prefs?.length) parts.push("preferences");
  return parts.join(", ").replace(/, ([^,]*)$/, " and $1");
}

/** REAPER's Default 7 theme in its ColorThemes folder, if it's there. */
const defaultThemePath = (resource: string) => {
  const p = join(resource, "ColorThemes", "Default_7.0.ReaperThemeZip");
  return existsSync(p) ? p : null;
};

/** Media Explorer folders earlier Assist versions added (for Restore when there's no record). */
const assistFolders = () => sampleFolders().map((f) => f.path);

/* ------------------------------------------------------------ waiting jobs */

/*
 * REAPER rewrites reaper.ini (and reaper-kb.ini, if shortcuts were edited) when it quits, so
 * some changes can only be finished while it's closed. They wait in reaper-pending.json and run
 * as soon as no REAPER is running (checked every few seconds, and at Assist's start).
 */
/** "shortcuts" is what older versions queued; it now means the whole profile. */
type ReaperPending = { kind: "profile" | "shortcuts"; workflow: WorkflowId } | { kind: "restore"; defaults?: boolean };
const pendingPath = () => join(userData(), "reaper-pending.json");
let pendingTimer: NodeJS.Timeout | null = null;
let pendingBusy = false;

async function setPending(p: ReaperPending | null): Promise<void> {
  if (!p) return void (await unlink(pendingPath()).catch(() => undefined));
  await writeFile(pendingPath(), JSON.stringify(p));
  watchPending();
}

/** Finish what's waiting if REAPER is closed. True when nothing is left to do. */
export async function runPending(): Promise<boolean> {
  if (pendingBusy) return false;
  pendingBusy = true;
  try {
    let p: ReaperPending;
    try {
      p = JSON.parse(await readFile(pendingPath(), "utf8")) as ReaperPending;
    } catch {
      return true;
    }
    if (await reaperRunning()) return false;
    const resource = defaultReaperResourcePath();
    const o = await loadOriginal(userData(), resource);
    if (p.kind !== "restore") {
      const w = findWorkflow(p.workflow);
      if (w) await installProfileNow(w);
    } else if (o && (!o.restoredAt || p.defaults)) {
      await restoreFiles(resource, p.defaults ? defaultsOriginal(o, defaultThemePath(resource)) : o);
      await markRestored(userData(), o);
    }
    await setPending(null);
    return true;
  } catch {
    return false;
  } finally {
    pendingBusy = false;
  }
}

export function watchPending(): void {
  if (pendingTimer) return;
  pendingTimer = setInterval(() => {
    void runPending().then((done) => {
      if (done && pendingTimer) {
        clearInterval(pendingTimer);
        pendingTimer = null;
      }
    });
  }, 4000);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * "Quit REAPER and finish": REAPER quits the normal way (asking to save), the waiting job runs the
 * moment it's closed, and REAPER opens again.
 */
export async function quitAndFinish(): Promise<WorkflowResult> {
  const label = "REAPER";
  let exe: string | undefined;
  if (await reaperRunning()) {
    const st = await ctx.reaper.status();
    if (st.state !== "connected") return { ok: false, pending: true, steps: [{ label, ok: false, detail: "Assist isn't connected to REAPER. Quit REAPER yourself (save your project first); Assist finishes the moment it closes." }] };
    const q = await ctx.reaper.quitReaper();
    if (!q.ok) return { ok: false, pending: true, steps: [{ label, ok: false, detail: q.message }] };
    exe = q.exe;
    for (let i = 0; i < 120 && (await reaperRunning()); i++) await sleep(1000);
    if (await reaperRunning()) return { ok: false, pending: true, steps: [{ label, ok: false, detail: "REAPER is still open, maybe waiting for you to save. Assist finishes the moment it closes." }] };
  }
  let done = false;
  for (let i = 0; i < 20 && !(done = await runPending()); i++) await sleep(1000);
  if (!done) return { ok: false, pending: true, steps: [{ label, ok: false, detail: "Assist couldn't finish yet. It tries again on its own while REAPER is closed." }] };
  const opened = await openReaper(exe);
  return { ok: true, steps: [{ label, ok: true, detail: opened ? "Done. REAPER is opening again with everything in place." : "Done. Open REAPER again to see it." }] };
}

/* ------------------------------------------------------------ apply / restore */

export async function applyProfile(id: string): Promise<WorkflowResult> {
  const w = findWorkflow(id);
  if (!w) return { ok: false, steps: [{ label: "Profile", ok: false, detail: "Unknown profile." }] };
  const settings = ctx.settings;
  const resource = defaultReaperResourcePath();
  const open = await reaperRunning();
  // Record REAPER as it is before the first change, so "Restore REAPER" can put it back.
  try {
    await ensureOriginal(userData(), resource, settings.raw.workflow != null, assistFolders());
  } catch (e) {
    return { ok: false, steps: [{ label: "REAPER", ok: false, detail: `Assist couldn't record REAPER's current setup, so it changed nothing. ${e instanceof Error ? e.message : String(e)}` }] };
  }
  const steps: Step[] = [];
  let pending = false;
  try {
    if (!open) {
      await installProfileNow(w);
      await setPending(null);
      steps.push({ label: w.daw, ok: true, detail: `REAPER opens looking and working like ${w.daw}: theme, ${profileSummary(w)}.` });
    } else {
      // REAPER rewrites its settings when it quits, so the rest is done the moment it closes.
      const assets = await profileAssets(w);
      steps.push(await loadThemeLive(assets.theme!, w.daw));
      await setPending({ kind: "profile", workflow: w.id });
      pending = true;
      steps.push({ label: "Quit and reopen REAPER", ok: true, detail: `To finish, quit REAPER (save your project first). The moment it closes, Assist sets up the ${profileSummary(w)}; reopen REAPER and it works like ${w.daw}.` });
    }
  } catch (e) {
    steps.push({ label: w.daw, ok: false, detail: e instanceof Error ? e.message : String(e) });
  }
  if (steps.every((x) => x.ok)) settings.update({ workflow: w.id as WorkflowId });
  return { ok: steps.every((x) => x.ok), steps, pending };
}

/** Put REAPER back: to how it was before Assist, or (`toDefaults`) to a fresh REAPER's settings. */
export async function restoreReaper(toDefaults: boolean): Promise<WorkflowResult> {
  const settings = ctx.settings;
  const resource = defaultReaperResourcePath();
  const dir = userData();
  const have = await loadOriginal(dir, resource);
  if (have?.restoredAt && !toDefaults) return { ok: true, steps: [{ label: "REAPER", ok: true, detail: "REAPER is already back to how it was. Assist hasn't changed it since." }] };
  let o;
  try {
    o = have ?? (await ensureOriginal(dir, resource, settings.raw.workflow != null, assistFolders()));
  } catch (e) {
    return { ok: false, steps: [{ label: "REAPER", ok: false, detail: e instanceof Error ? e.message : String(e) }] };
  }
  if (!have && !o.fallback && !toDefaults) return { ok: true, steps: [{ label: "REAPER", ok: true, detail: "Assist hasn't changed REAPER, so there's nothing to put back." }] };
  const steps: Step[] = [];
  const target = toDefaults ? defaultsOriginal(o, defaultThemePath(resource)) : o;
  const theme = originalTheme(target);
  const themeName = theme ? basename(theme).replace(/\.ReaperTheme(Zip)?$/i, "") : "REAPER's default theme";
  const intro = toDefaults ? "" : o.fallback ? "Assist changed REAPER before it kept a record of your setup, so these go back to REAPER's defaults. " : "";
  try {
    if (!(await reaperRunning())) {
      await restoreFiles(resource, target);
      await markRestored(dir, o);
      await setPending(null);
      steps.push({ label: "Theme", ok: true, detail: `REAPER opens with ${theme ? `“${themeName}”` : themeName} again.` });
      steps.push({ label: "Shortcuts and mouse", ok: true, detail: toDefaults ? "Your own shortcuts are back; mouse behaviour, toolbars and preferences are REAPER's defaults; Assist's scripts and icons are gone." : "Your own shortcuts, mouse behaviour, toolbars and preferences are back; Assist's scripts and icons are gone." });
      steps.push({ label: "Layout", ok: true, detail: `${intro}Transport, track headers, browser, mixer and MIDI editor are ${toDefaults ? "where a fresh REAPER has them" : "back where they were"}.` });
    } else {
      await restoreShortcutFile(resource, o);
      await setPending({ kind: "restore", ...(toDefaults ? { defaults: true } : {}) });
      const st = await ctx.reaper.status();
      const live = st.state === "connected";
      // Theme: switch now when the file is one REAPER can load from its ColorThemes folder.
      const themes = join(resource, "ColorThemes") + sep;
      const loadable = theme ?? join(resource, "ColorThemes", "Default_7.0.ReaperThemeZip");
      if (live && loadable.startsWith(themes)) {
        const r = await ctx.reaper.loadColorTheme(loadable);
        steps.push({ label: "Theme", ok: r.ok, detail: r.ok ? `REAPER is back on “${basename(loadable).replace(/\.ReaperThemeZip$/i, "")}”.` : `${r.message} Pick it in REAPER: Options → Themes.` });
      } else {
        steps.push({ label: "Theme", ok: true, detail: `REAPER goes back to ${theme ? `“${themeName}”` : themeName} once it restarts.` });
      }
      steps.push({ label: "Shortcuts and mouse", ok: true, detail: "Assist's shortcuts are taken out. Your mouse behaviour, toolbars and preferences go back the moment REAPER quits; your own shortcuts work again from its next start." });
      const r = live ? await ctx.reaper.restoreLayout(layoutTargets(target)) : null;
      steps.push({
        label: "Layout",
        ok: true,
        detail: r?.ok
          ? `${intro}REAPER's windows are back where they were. Assist finishes the saved settings as soon as REAPER quits.`
          : `${intro}Quit REAPER to finish: Assist puts the layout back the moment REAPER closes${r && !r.supported ? " (REAPER is still running Assist's previous script, so it can't be done live)" : ""}.`,
      });
    }
  } catch (e) {
    steps.push({ label: "Restore", ok: false, detail: e instanceof Error ? e.message : String(e) });
  }
  if (steps.every((s) => s.ok)) settings.update({ workflow: null });
  return { ok: steps.every((s) => s.ok), steps, pending: existsSync(pendingPath()) };
}
