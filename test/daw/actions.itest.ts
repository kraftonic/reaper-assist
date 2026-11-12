import { describe, expect, it } from "vitest";
import { ReaperConnection } from "@daw/reaper/reaper";

// REAPER's action list through the bridge (0.5). Isolated test instance only: bash scripts/reaper-test-instance.sh start
const dir = process.env.REAPER_ASSIST_BRIDGE_DIR;
const run = dir && dir.includes(".reaper-test") ? describe : describe.skip;

type Found = { action: number | string; name: string; on: boolean | null; shortcuts: string[] };
const data = (text: string) => JSON.parse(text).data as { actions: Found[]; total: number; on?: boolean | null; name?: string };

run("REAPER action list (isolated instance)", () => {
  const r = new ReaperConnection(dir!);

  it("finds the docker toggle with its state", async () => {
    const out = await r.run("findActions", { query: "show docker" });
    expect(out.ok, out.text).toBe(true);
    const hit = data(out.text).actions.find((a) => /^View: Show docker$/i.test(a.name));
    expect(hit, out.text).toBeTruthy();
    expect(typeof hit!.on).toBe("boolean");
  });

  it("toggles the docker on and back, and refuses a wrong name", async () => {
    const found = data((await r.run("findActions", { query: "show docker" })).text).actions.find((a) => /^View: Show docker$/i.test(a.name))!;
    const wrong = await r.run("runAction", { action: found.action, name: "View: Show mixer" });
    expect(wrong.ok).toBe(false);
    expect(wrong.text).toMatch(/not “View: Show mixer”/);
    const a = await r.run("runAction", { action: found.action, name: found.name });
    expect(a.ok, a.text).toBe(true);
    expect(data(a.text).on).toBe(!found.on);
    const b = await r.run("runAction", { action: found.action, name: found.name });
    expect(data(b.text).on).toBe(found.on);
  });

  it("finds what a key does", async () => {
    // Space is Transport: Play/stop in a default REAPER.
    const out = await r.run("findActions", { query: "transport", shortcut: "Space" });
    expect(out.ok, out.text).toBe(true);
    expect(data(out.text).actions.some((a) => /play\/stop/i.test(a.name)), out.text).toBe(true);
  });

  it("never quits REAPER", async () => {
    const q = data((await r.run("findActions", { query: "quit" })).text).actions.find((a) => /^File: Quit/i.test(a.name));
    expect(q).toBeTruthy();
    const out = await r.run("runAction", { action: q!.action, name: q!.name });
    expect(out.ok).toBe(false);
    expect(out.text).toMatch(/doesn't run/);
    expect((await r.status()).state).toBe("connected");
  });

  it("reports a missing shortcut instead of removing anything", async () => {
    const found = data((await r.run("findActions", { query: "show docker" })).text).actions.find((a) => /^View: Show docker$/i.test(a.name))!;
    const out = await r.run("removeShortcut", { action: found.action, name: found.name, key: "Ctrl+Alt+Shift+F12" });
    expect(out.ok).toBe(false);
    expect(out.text).toMatch(/has no shortcut/);
  });
});
