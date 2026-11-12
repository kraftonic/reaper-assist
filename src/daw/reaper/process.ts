import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";
import { reaperExecutable, reaperInstallDirs } from "./locate";
import { promisify } from "node:util";

const run = promisify(execFile);

/** Is any REAPER running? (Conservative: any REAPER process counts.) */
export async function reaperRunning(): Promise<boolean> {
  try {
    if (platform() === "win32") {
      const { stdout } = await run("tasklist", ["/FI", "IMAGENAME eq reaper.exe", "/NH"], { timeout: 5000 });
      return /reaper\.exe/i.test(stdout);
    }
    await run("pgrep", ["-x", platform() === "darwin" ? "REAPER" : "reaper"], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/** Start REAPER again (the app it ran from, when known: the bridge's `quitReaper` reports it). */
export async function openReaper(exe?: string): Promise<boolean> {
  try {
    if (process.platform === "darwin") {
      // REAPER reports the folder its app is in ("/Applications") or a path inside the .app.
      const inside = exe?.match(/^(.*?\.app)(\/|$)/)?.[1];
      const beside = exe && ["REAPER.app", "REAPER64.app"].map((n) => join(exe, n)).find((p) => existsSync(p));
      const bundle = inside ?? beside;
      spawn("open", bundle ? ["-a", bundle] : ["-b", "com.cockos.reaper"], { detached: true, stdio: "ignore" }).unref();
      return true;
    }
    // The folder REAPER reported when it quit, then the usual install folders.
    const bin = [exe, ...reaperInstallDirs()].map((d) => (d ? reaperExecutable(d) : null)).find((b): b is string => !!b);
    if (bin) {
      spawn(bin, [], { cwd: dirname(bin), detached: true, stdio: "ignore" }).unref();
      return true;
    }
    if (process.platform === "linux" && existsSync(join(homedir(), ".var", "app", "fm.reaper.Reaper"))) {
      // The Flatpak build has no program file to start.
      spawn("flatpak", ["run", "fm.reaper.Reaper"], { detached: true, stdio: "ignore" }).on("error", () => undefined).unref();
      return true;
    }
  } catch {
    /* fall through */
  }
  return false;
}
