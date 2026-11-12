import { app, BrowserWindow, globalShortcut, screen, shell } from "electron";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ctx } from "./state";

/** Dock the panel to the left or right edge of the screen the mouse is on (unless it floats). */
export function placeWindow(w: BrowserWindow): void {
  const dock = ctx.settings.raw.dock;
  if (dock === "free") return;
  const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const width = Math.max(360, Math.min(w.getBounds().width, 640));
  w.setBounds({ x: dock === "right" ? workArea.x + workArea.width - width : workArea.x, y: workArea.y, width, height: workArea.height });
}

export function applyOnTop(on: boolean): void {
  const win = ctx.win;
  if (!win) return;
  // "floating" keeps the panel above a DAW, including one in full screen on macOS.
  win.setAlwaysOnTop(on, "floating");
  if (process.platform === "darwin") win.setVisibleOnAllWorkspaces(on, { visibleOnFullScreen: on });
}

/** The global show/hide shortcut. False when the OS refused it. */
export function registerHotkey(accel: string): boolean {
  globalShortcut.unregisterAll();
  try {
    return globalShortcut.register(accel, () => {
      const win = ctx.win;
      if (!win) return createWindow();
      if (win.isVisible() && win.isFocused()) win.hide();
      else {
        win.show();
        win.focus();
      }
    });
  } catch {
    return false;
  }
}

export function createWindow(): void {
  const win = new BrowserWindow({
    width: 440,
    height: 800,
    minWidth: 340,
    minHeight: 420,
    show: false,
    title: "REAPER Assist",
    backgroundColor: "#16181d",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    trafficLightPosition: { x: 12, y: 14 },
    titleBarOverlay: process.platform === "darwin" ? undefined : { color: "#00000000", symbolColor: "#888", height: 44 },
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      // A screenshot window never takes focus, so keep it painting while it's in the background.
      ...(process.env.KA_SCREENSHOT ? { backgroundThrottling: false } : {}),
    },
  });
  ctx.win = win;
  placeWindow(win);
  applyOnTop(ctx.settings.raw.alwaysOnTop);
  // Screenshot runs float the window (without focus) so macOS doesn't treat it as hidden and stop painting it.
  if (process.env.KA_SCREENSHOT) win.setAlwaysOnTop(true, "floating");
  win.once("ready-to-show", () => {
    const shot = process.env.KA_SCREENSHOT;
    // Screenshot runs must not take focus from whatever the user is doing.
    if (shot) win.showInactive();
    else win.show();
    if (shot) setTimeout(() => void takeScreenshots(shot), Number(process.env.KA_SCREENSHOT_DELAY ?? 1500));
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  const hash = process.env.KA_VIEW ?? "";
  if (process.env.ELECTRON_RENDERER_URL) void win.loadURL(process.env.ELECTRON_RENDERER_URL + (hash ? `#${hash}` : ""));
  else void win.loadFile(join(__dirname, "../renderer/index.html"), { hash });
  win.on("closed", () => (ctx.win = null));
}

/**
 * Dev screenshots (scripts/shot.sh). KA_SCREENSHOT_JS optionally puts the panel in a state worth capturing
 * (open a menu, attach an image, …). KA_SCREENSHOT_STEPS can name a JSON file of more states,
 * `[{ "js": "/abs/script.js", "out": "/abs/out.png", "wait": 900 }]`, captured in order after the first.
 * The KA_SCREENSHOT file is written last, so "that file exists" still means the run is done.
 */
async function takeScreenshots(out: string): Promise<void> {
  const log = (m: string) => process.stderr.write(`[shot] ${m}\n`);
  const steps: { js?: string; out: string; wait?: number }[] = [{ js: process.env.KA_SCREENSHOT_JS, out, wait: Number(process.env.KA_SCREENSHOT_JS_WAIT ?? 900) }];
  let first: Buffer | null = null;
  log("capturing");
  try {
    if (process.env.KA_SCREENSHOT_STEPS) steps.push(...JSON.parse(await readFile(process.env.KA_SCREENSHOT_STEPS, "utf8")));
    for (const [i, s] of steps.entries()) {
      const win = ctx.win;
      if (!win || win.isDestroyed()) break;
      if (s.js) {
        await win.webContents.executeJavaScript(await readFile(s.js, "utf8")).catch((e) => log(`script ${s.js} failed: ${e}`));
        await new Promise((r) => setTimeout(r, s.wait ?? 900));
      }
      const png = (await win.webContents.capturePage()).toPNG();
      if (i === 0) first = png;
      else {
        await writeFile(s.out, png);
        log(`saved ${s.out}`);
      }
    }
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : e}`);
  }
  if (first) {
    await writeFile(out, first);
    log(`saved ${out}`);
  }
  app.quit();
}
