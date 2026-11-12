import { readFile, writeFile } from "node:fs/promises";
import type { DawStatus } from "@shared/types";
import { installedAt } from "@daw/reaper/install";
import { ReaperConnection } from "@daw/reaper/reaper";
import { bridgeLua } from "./paths";
import { ctx } from "./state";

/** Talk to REAPER through the bridge folder in Settings → DAW. */
export function connectReaper(bridgeDir: string): void {
  ctx.reaper = new ReaperConnection(bridgeDir);
}

let bundledBridgeVersion = "0";

/** Is the bridge REAPER is running older than the one this build ships? */
function bridgeOutdated(running: string | undefined): boolean {
  const n = (v: string) => v.split(".").map((x) => Number(x) || 0);
  const [a, b] = [n(running ?? "0"), n(bundledBridgeVersion)];
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) < (b[i] ?? 0);
  return false;
}

export async function dawStatus(): Promise<DawStatus> {
  const d = ctx.settings.raw.daw;
  if (!d.enabled) return { enabled: false, state: "disabled", bridgeDir: d.bridgeDir };
  const inst = await installedAt();
  const { state, status } = await ctx.reaper.status();
  return {
    enabled: true,
    state: state === "waiting" && !inst ? "not-installed" : state,
    reaperVersion: status?.reaperVersion,
    project: status?.project?.name,
    playState: status?.playState,
    bridgeDir: d.bridgeDir,
    installedAt: inst,
    bridgeOutdated: state === "connected" && bridgeOutdated(status?.bridgeVersion),
  };
}

/** Keep the copy of Assist's own script inside REAPER's Scripts folder current. Touches only that file. */
export async function refreshInstalledBridge(): Promise<void> {
  try {
    const src = await readFile(bridgeLua(), "utf8");
    bundledBridgeVersion = /BRIDGE_VERSION = "([\d.]+)"/.exec(src)?.[1] ?? "0";
    const inst = await installedAt();
    if (!inst) return;
    const cur = await readFile(inst, "utf8");
    if (cur !== src) await writeFile(inst, src);
  } catch {
    /* not installed or not readable: leave it */
  }
}
