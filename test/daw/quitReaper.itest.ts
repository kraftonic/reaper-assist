import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { ReaperConnection } from "@daw/reaper/reaper";

/*
 * "Quit REAPER and finish": the bridge quits REAPER the normal way. THROWAWAY REAPER ONLY (a saved
 * project, so no save dialog): REAPER_ASSIST_BRIDGE_DIR=<res>/ReaperAssist/bridge with ".reaper-test" in it.
 */
const dir = process.env.REAPER_ASSIST_BRIDGE_DIR;
const run = dir && dir.includes(".reaper-test") ? describe : describe.skip;
const wait = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

run("quitReaper (isolated instance)", () => {
  it("quits REAPER and reports where it runs from", async () => {
    const r = new ReaperConnection(dir!);
    for (let i = 0; i < 60 && (await r.status()).state !== "connected"; i++) await wait(500);
    const q = await r.quitReaper();
    expect(q.ok, q.message).toBe(true);
    expect(q.exe).toBeTruthy();
    // This instance only: the REAPER started with this test folder's own reaper.ini.
    const cfg = join(dirname(dirname(dir!)), "reaper.ini");
    const alive = () => {
      try {
        return execFileSync("pgrep", ["-f", "--", `-cfgfile ${cfg}`]).toString().trim() !== "";
      } catch {
        return false;
      }
    };
    expect(alive()).toBe(true);
    for (let i = 0; i < 40 && alive(); i++) await wait(500);
    expect(alive()).toBe(false);
  }, 60000);
});
