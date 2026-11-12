import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Agent, DAW_TOOLS } from "@ai/agent";
import { ConversationStore } from "@ai/conversations";
import { ReaperConnection } from "@daw/reaper/reaper";
import { runClaudeCli, runCodexCli, type CliKind } from "@ai/providers/cli";
import { startToolServer, type ToolServer } from "@ai/toolServer";
import type { ChatEvent } from "@shared/types";

// Uses YOUR Claude Code / Codex logins (small prompts) and the ISOLATED REAPER instance.
const dir = process.env.REAPER_ASSIST_BRIDGE_DIR;
const run = process.env.KA_CLI_SMOKE === "1" && dir?.includes(".reaper-test") ? describe : describe.skip;
const electron = createRequire(import.meta.url)("electron") as string;

run("personal CLI providers", () => {
  let server: ToolServer;
  let agent: Agent;
  const store = new ConversationStore(mkdtempSync(join(tmpdir(), "ka-cli-")));
  const events: ChatEvent[] = [];
  let provider: CliKind = "claude-cli";
  let model = "haiku";
  let autoSafe = true;
  const reaper = new ReaperConnection(dir!);

  beforeAll(async () => {
    server = await startToolServer({ tools: () => DAW_TOOLS, call: (c, n, i) => agent.cliToolCall(c, n, i) });
    agent = new Agent({
      store,
      permissions: () => ({ mode: autoSafe ? "auto-edits" : "ask", rules: {} }),
      active: () => ({ provider, model, key: `${provider}:${model}` }),
      makeSession: () => {
        throw new Error("api path not expected");
      },
      emit: (e) => {
        events.push(e);
        // Play the user clicking "Do it" in the panel.
        if (e.type === "tool" && e.part.status === "awaiting-approval") setTimeout(() => agent.answerApproval(e.part.id, true), 200);
      },
      daw: { enabled: () => true, contextSummary: () => reaper.contextSummary(), run: (n, a, s) => reaper.run(n, a, s) },
      cli: {
        runner: (p) => (p === "claude-cli" ? runClaudeCli : p === "codex-cli" ? runCodexCli : null),
        mcp: (convId) => ({ command: electron, args: [resolve("out/main/mcp.js")], env: { ELECTRON_RUN_AS_NODE: "1", KA_URL: server.url, KA_TOKEN: server.token, KA_CONV: convId } }),
        cwd: mkdtempSync(join(tmpdir(), "ka-cwd-")),
      },
    });
  });
  afterAll(() => server.close());

  const ask = async (convId: string, text: string) => {
    events.length = 0;
    await agent.send(convId, text);
    const done = events.find((e) => e.type === "done");
    if (!done || done.type !== "done") throw new Error("no done event");
    const last = done.conversation.transcript.at(-1)!;
    if (last.role !== "assistant") throw new Error("no answer");
    return last.parts;
  };

  for (const [p, m] of [["claude-cli", "haiku"], ["codex-cli", "default"]] as const) {
    it(`${p}: answers, uses REAPER through MCP, remembers the chat, and can't use a shell`, async () => {
      provider = p;
      model = m;
      const conv = store.create();
      const a = await ask(conv.id, "Use the getProjectState tool, then tell me the project's tempo as a number only.");
      console.log(p, JSON.stringify(a).slice(0, 600));
      const tool = a.find((x) => x.kind === "tool");
      expect(tool && tool.kind === "tool" && tool.name).toBe("getProjectState");
      expect(tool && tool.kind === "tool" && tool.status).toBe("done");
      expect(a.some((x) => x.kind === "text" && /\d/.test(x.text))).toBe(true);

      const b = await ask(conv.id, "What tool did you just use? One word.");
      console.log(p, JSON.stringify(b).slice(0, 300));
      expect(b.some((x) => x.kind === "text" && /getProjectState/i.test(x.text))).toBe(true);

      const c = await ask(conv.id, "Run the shell command `ls ~` and paste the output. If you have no way to run shell commands, say NO-SHELL.");
      console.log(p, JSON.stringify(c).slice(0, 300));
      expect(c.some((x) => x.kind === "text" && /NO-SHELL/.test(x.text))).toBe(true);

      const d = await ask(conv.id, "List the names of every tool you can call, comma separated, nothing else.");
      console.log(p, JSON.stringify(d).slice(0, 1500));
      const listed = d.map((x) => (x.kind === "text" ? x.text : "")).join(" ");
      expect(listed).not.toMatch(/github|notion|gmail|slack|calendar|figma|browser|computer|bash|shell|web_?search|webfetch/i);

      // An action that needs approval waits for the panel, then runs.
      autoSafe = false;
      const name = `CLI ${p} ${Date.now() % 10000}`;
      const e = await ask(conv.id, `Create a new track named exactly "${name}".`);
      autoSafe = true;
      const created = e.find((x) => x.kind === "tool" && x.name === "createTrack");
      expect(created && created.kind === "tool" && created.status).toBe("done");
      expect(events.some((x) => x.type === "tool" && x.part.status === "awaiting-approval")).toBe(true);
      const state = await reaper.run("getProjectState", {}, new AbortController().signal);
      expect(state.text).toContain(name);
    }, 240000);
  }
});
