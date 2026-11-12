import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ChatEvent } from "@shared/types";
import { Agent, DAW_TOOLS } from "@ai/agent";
import { ConversationStore } from "@ai/conversations";
import type { CliRunOptions } from "@ai/providers/cli";
import { startToolServer } from "@ai/toolServer";

describe("tool server", () => {
  it("refuses requests without the launch token and forwards the chat id", async () => {
    const calls: [string, string][] = [];
    const s = await startToolServer({ tools: () => DAW_TOOLS, call: async (c, n) => (calls.push([c, n]), { id: "", content: "ok", isError: false }) });
    try {
      expect((await fetch(`${s.url}/tools`)).status).toBe(401);
      expect((await fetch(`${s.url}/tools`, { headers: { authorization: "Bearer nope" } })).status).toBe(401);
      const tools = (await (await fetch(`${s.url}/tools`, { headers: { authorization: `Bearer ${s.token}` } })).json()) as { name: string }[];
      expect(tools.map((t) => t.name)).toContain("createTrack");
      const r = await fetch(`${s.url}/call`, { method: "POST", headers: { authorization: `Bearer ${s.token}`, "x-ka-conv": "c1" }, body: JSON.stringify({ name: "setTempo", input: { bpm: 90 } }) });
      expect(await r.json()).toMatchObject({ content: "ok", isError: false });
      expect(calls).toEqual([["c1", "setTempo"]]);
      expect(s.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    } finally {
      s.close();
    }
  });
});

describe("agent with a CLI provider", () => {
  function setup(fake: (o: CliRunOptions, agent: Agent, convId: string) => Promise<{ sessionId: string }>) {
    const store = new ConversationStore(mkdtempSync(join(tmpdir(), "ka-")));
    const events: ChatEvent[] = [];
    const runs: CliRunOptions[] = [];
    const ran: string[] = [];
    let agent!: Agent;
    const conv = store.create();
    agent = new Agent({
      store,
      permissions: () => ({ mode: "ask", rules: {} }),
      active: () => ({ provider: "claude-cli", model: "sonnet", key: "claude-cli:sonnet" }),
      makeSession: () => {
        throw new Error("the API path must not be used");
      },
      emit: (e) => {
        events.push(e);
        if (e.type === "tool" && e.part.status === "awaiting-approval") queueMicrotask(() => agent.answerApproval(e.part.id, e.part.name === "setTempo"));
      },
      daw: { enabled: () => true, contextSummary: async () => "Project, 120 BPM", run: async (n) => (ran.push(n), { ok: true, text: "done" }) },
      cli: {
        runner: (p) => (p === "claude-cli" ? (o) => (runs.push(o), fake(o, agent, conv.id)) : null),
        mcp: (id) => ({ command: "node", args: ["mcp.js"], env: { KA_CONV: id } }),
        cwd: "/tmp/x",
      },
    });
    return { agent, conv, store, events, runs, ran };
  }

  it("streams text, routes MCP tool calls through approvals, and resumes the CLI session", async () => {
    let n = 0;
    const { agent, conv, store, runs, ran } = setup(async (o, a, convId) => {
      o.onText("Setting it. ");
      const ok = await a.cliToolCall(convId, "setTempo", { bpm: 140 });
      const no = await a.cliToolCall(convId, "addFx", { track: { name: "Drums" }, fx: "ReaEQ" });
      o.onText(`${ok.isError ? "fail" : "ok"} / ${no.isError ? "denied" : "ran"}`);
      return { sessionId: `sess-${++n}` };
    });
    await agent.send(conv.id, "140 bpm please");
    expect(ran).toEqual(["setTempo"]);
    const item = store.get(conv.id)!.transcript[1]!;
    if (item.role !== "assistant") throw new Error("expected answer");
    expect(item.parts.map((p) => p.kind)).toEqual(["text", "tool", "tool", "text"]);
    expect(item.parts.filter((p) => p.kind === "tool").map((p) => p.kind === "tool" && p.status)).toEqual(["done", "denied"]);
    expect(runs[0]!.sessionId).toBeNull();
    expect(runs[0]!.model).toBe("sonnet");
    expect(runs[0]!.prompt).toContain("140 bpm please");
    expect(runs[0]!.mcp?.env.KA_CONV).toBe(conv.id);

    await agent.send(conv.id, "thanks");
    expect(runs[1]!.sessionId).toBe("sess-1");
    expect(runs[1]!.prompt).not.toContain("Earlier in this chat");
  });

  it("refuses tool calls for a chat that isn't running", async () => {
    const { agent } = setup(async () => ({ sessionId: "s" }));
    const r = await agent.cliToolCall("nope", "setTempo", { bpm: 100 });
    expect(r.isError).toBe(true);
  });

  it("shows CLI failures as an error notice", async () => {
    const { agent, conv, store } = setup(async () => {
      throw new Error("not logged in");
    });
    await agent.send(conv.id, "hi");
    const item = store.get(conv.id)!.transcript[1]!;
    expect(item.role === "assistant" && item.parts.some((p) => p.kind === "notice" && /not logged in/.test(p.text))).toBe(true);
  });
});
