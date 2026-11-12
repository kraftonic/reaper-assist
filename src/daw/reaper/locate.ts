import { existsSync, realpathSync } from "node:fs";
import { homedir, platform } from "node:os";
import { delimiter, dirname, join } from "node:path";

/**
 * Where REAPER's program files usually are, per OS (only folders that exist). Used to find the stock
 * Default 7 theme (Windows and Linux keep it next to the program, not in the resource folder) and to
 * start REAPER again after Assist asked it to quit.
 */
export function reaperInstallDirs(os: NodeJS.Platform = platform(), env: NodeJS.ProcessEnv = process.env, home = homedir()): string[] {
  const dirs: string[] = [];
  if (os === "darwin") {
    for (const base of ["/Applications", join(home, "Applications")]) for (const app of ["REAPER.app", "REAPER64.app"]) dirs.push(join(base, app));
  } else if (os === "win32") {
    for (const pf of [env.ProgramFiles, env.ProgramW6432, env["ProgramFiles(x86)"], "C:\\Program Files"]) {
      if (pf) dirs.push(join(pf, "REAPER (x64)"), join(pf, "REAPER (ARM64)"), join(pf, "REAPER"));
    }
    if (env.LOCALAPPDATA) dirs.push(join(env.LOCALAPPDATA, "Programs", "REAPER"));
  } else {
    dirs.push("/opt/REAPER", join(home, "opt", "REAPER"), "/usr/local/REAPER", "/usr/lib/REAPER", "/usr/local/lib/REAPER");
    // The install script can also put a `reaper` link on the PATH.
    for (const p of (env.PATH ?? "").split(delimiter)) {
      const bin = join(p, "reaper");
      if (p && existsSync(bin)) {
        try {
          dirs.push(dirname(realpathSync(bin)));
        } catch {
          /* broken link */
        }
      }
    }
  }
  return [...new Set(dirs)].filter((d) => existsSync(d));
}

/** The stock theme inside a program folder (macOS keeps it inside the app bundle). */
export function stockThemeIn(dir: string): string {
  return dir.endsWith(".app") ? join(dir, "Contents", "InstallFiles", "ColorThemes", "Default_7.0.ReaperThemeZip") : join(dir, "ColorThemes", "Default_7.0.ReaperThemeZip");
}

/** REAPER's program in a folder REAPER reported (GetExePath) or found by reaperInstallDirs, if it is there. */
export function reaperExecutable(dir: string, os: NodeJS.Platform = platform()): string | null {
  const exe = join(dir, os === "win32" ? "reaper.exe" : "reaper");
  return existsSync(exe) ? exe : null;
}
