import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

/** The standard plug-in folders of each OS (missing ones are skipped). */
export function pluginDirs(os: NodeJS.Platform = process.platform, env: NodeJS.ProcessEnv = process.env, home = homedir()): string[] {
  if (os === "darwin") return ["VST", "VST3", "Components", "CLAP"].flatMap((d) => [join("/Library/Audio/Plug-Ins", d), join(home, "Library/Audio/Plug-Ins", d)]);
  if (os === "win32") {
    const common = env.CommonProgramFiles ?? "C:\\Program Files\\Common Files";
    const pf = env.ProgramFiles ?? "C:\\Program Files";
    const local = env.LOCALAPPDATA ? [join(env.LOCALAPPDATA, "Programs", "Common", "VST3"), join(env.LOCALAPPDATA, "Programs", "Common", "CLAP")] : [];
    return [join(common, "VST3"), join(common, "CLAP"), join(pf, "VSTPlugins"), join(pf, "Steinberg", "VSTPlugins"), ...local];
  }
  return [".vst3", ".clap", ".vst", ".lxvst"].map((d) => join(home, d)).concat(["vst3", "clap", "vst", "lxvst"].flatMap((d) => [join("/usr/lib", d), join("/usr/local/lib", d)]));
}

const BUNDLE = /\.(vst3|vst|component|clap|dll|so)$/i;

/** Plug-in bundle names found in the standard folders (lower-case, no extension). Works without a DAW. */
export async function scanPlugins(): Promise<string[]> {
  const out = new Set<string>();
  // Vendors often use subfolders (VST3/Maker/Synth.vst3), so look a few levels down; a bundle is not opened.
  const walk = async (d: string, depth: number): Promise<void> => {
    let entries;
    try {
      entries = await readdir(d, { withFileTypes: true });
    } catch {
      return; // folder missing
    }
    for (const e of entries) {
      if (BUNDLE.test(e.name)) out.add(e.name.replace(BUNDLE, "").toLowerCase());
      else if (e.isDirectory() && depth < 3) await walk(join(d, e.name), depth + 1);
    }
  };
  for (const d of pluginDirs()) await walk(d, 0);
  return [...out].sort();
}
