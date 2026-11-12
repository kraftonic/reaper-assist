import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ChatEvent } from "@shared/types";
import { Agent, DAW_TOOLS, plainHistory } from "@ai/agent";
import { ConversationStore } from "@ai/conversations";
import { COMMAND_NAMES, commandJsonSchema, validateArgs } from "@daw/reaper/commands";
import type { ChatSession, ToolResult, TurnOptions, TurnResult } from "@ai/providers/types";

/** A scripted model: each turn returns the next scripted result and records what it was sent. */
class FakeSession implements ChatSession {
  key = "fake:model";
  users: string[] = [];
  results: ToolResult[][] = [];
  constructor(private script: (TurnResult & { text?: string })[]) {}
  addUser(t: string) {
    this.users.push(t);
  }
  addToolResults(r: ToolResult[]) {
    this.results.push(r);
  }
  serialize() {
    return [];
  }
  async turn(o: TurnOptions): Promise<TurnResult> {
    const next = this.script.shift() ?? { stop: "end", toolCalls: [] };
    if (next.text) o.onText(next.text);
    return next;
  }
}

function setup(script: ConstructorParameters<typeof FakeSession>[0], opts: { autoSafe?: boolean } = {}) {
  const store = new ConversationStore(mkdtempSync(join(tmpdir(), "ka-")));
  const session = new FakeSession(script);
  const events: ChatEvent[] = [];
  const ran: { name: string; args: unknown }[] = [];
  let agent!: Agent;
  agent = new Agent({
    store,
    permissions: () => ({ mode: (opts.autoSafe ?? true) ? "auto-edits" : "ask", rules: {} }),
    active: () => ({ provider: "anthropic", model: "fake", key: "fake:model" }),
    makeSession: () => session,
    emit: (e) => {
      events.push(e);
      // Auto-answer approvals: approve setTempo, deny addFx.
      if (e.type === "tool" && e.part.status === "awaiting-approval") queueMicrotask(() => agent.answerApproval(e.part.id, e.part.name === "setTempo"));
    },
    daw: {
      enabled: () => true,
      contextSummary: async () => "Project “Test”, 120 BPM",
      run: async (name, args) => {
        ran.push({ name, args });
        return { ok: true, text: JSON.stringify({ status: "verified", undoLabel: `Assist: ${name}` }) };
      },
    },
  });
  const conv = store.create();
  return { agent, conv, session, events, ran, store };
}

describe("agent", () => {
  it("streams text, runs safe actions without asking, and saves the chat", async () => {
    const t = setup([
      { stop: "tool_use", toolCalls: [{ id: "a", name: "setTrackMute", input: { track: { name: "Drums" }, muted: true } }], text: "Muting. " },
      { stop: "end", toolCalls: [], text: "Done." },
    ]);
    await t.agent.send(t.conv.id, "mute the drums");
    expect(t.ran).toEqual([{ name: "setTrackMute", args: { track: { name: "Drums" }, muted: true } }]);
    expect(t.session.users[0]).toContain("<reaper_project>");
    expect(t.session.results[0]![0]!.isError).toBe(false);
    const done = t.events.find((e) => e.type === "done");
    expect(done && done.type === "done" && done.conversation.title).toBe("mute the drums");
    expect(t.store.list()).toHaveLength(1);
  });

  it("asks before risky actions and never runs a denied one", async () => {
    const t = setup([
      {
        stop: "tool_use",
        toolCalls: [
          { id: "t1", name: "setTempo", input: { bpm: 140 } },
          { id: "t2", name: "addFx", input: { track: { index: 1 }, fx: "ReaComp" } },
        ],
      },
      { stop: "end", toolCalls: [] },
    ]);
    await t.agent.send(t.conv.id, "140 bpm and a compressor");
    expect(t.ran.map((r) => r.name)).toEqual(["setTempo"]);
    expect(t.session.results[0]!.map((r) => r.isError)).toEqual([false, true]);
    expect(t.session.results[0]![1]!.content).toMatch(/denied/);
  });

  it("rejects invalid arguments and unknown tools without touching the DAW", async () => {
    const t = setup([
      { stop: "tool_use", toolCalls: [{ id: "x", name: "setTempo", input: { bpm: 9000 } }, { id: "y", name: "deleteEverything", input: {} }] },
      { stop: "end", toolCalls: [] },
    ]);
    await t.agent.send(t.conv.id, "go");
    expect(t.ran).toEqual([]);
    expect(t.session.results[0]!.every((r) => r.isError)).toBe(true);
  });

  it("reports a refusal instead of running tools", async () => {
    const t = setup([{ stop: "refusal", toolCalls: [] }]);
    await t.agent.send(t.conv.id, "hi");
    expect(t.events.some((e) => e.type === "notice" && e.level === "warn")).toBe(true);
  });
});

describe("history", () => {
  it("turns a transcript into alternating plain turns without a dangling user turn", () => {
    const h = plainHistory([
      { role: "user", text: "a", at: 0 },
      { role: "assistant", at: 0, model: "m", provider: "openai", parts: [{ kind: "text", text: "b" }, { kind: "tool", id: "1", name: "x", input: {}, summary: "Mute “Drums”", risk: "safe", status: "done" }] },
      { role: "user", text: "c", at: 0 },
    ]);
    expect(h).toEqual([
      { role: "user", text: "a" },
      { role: "assistant", text: "b\n[REAPER: Mute “Drums” → done]" },
    ]);
  });
});

describe("commands", () => {
  it("every command has an object JSON schema the providers accept", () => {
    for (const n of COMMAND_NAMES) {
      const s = commandJsonSchema(n);
      expect(s.type, n).toBe("object");
      expect(s.$schema).toBeUndefined();
    }
    expect(DAW_TOOLS.length).toBe(COMMAND_NAMES.length);
  });
  it("is strict about unknown keys and ranges", () => {
    expect(validateArgs("setTrackVolume", { track: { index: 1 }, db: -6 }).ok).toBe(true);
    expect(validateArgs("setTrackVolume", { track: { index: 1 }, db: -6, changeDb: 1 }).ok).toBe(false);
    expect(validateArgs("setTempo", { bpm: 120, extra: 1 }).ok).toBe(false);
  });
});

describe("permissions", () => {
  function make(perm: { mode: "ask" | "auto-edits" | "full-auto"; rules?: Record<string, "allow" | "ask"> }, answer: (name: string) => "once" | "chat" | "always" | "deny") {
    const store = new ConversationStore(mkdtempSync(join(tmpdir(), "ka-")));
    const rules: Record<string, "allow" | "ask"> = { ...perm.rules };
    const asked: string[] = [];
    const ran: string[] = [];
    const calls: { name: string; input: unknown }[] = [];
    let agent!: Agent;
    agent = new Agent({
      store,
      permissions: () => ({ mode: perm.mode, rules }),
      allowAlways: (n) => (rules[n] = "allow"),
      active: () => ({ provider: "anthropic", model: "fake", key: "fake:model" }),
      makeSession: () => new FakeSession([{ stop: "tool_use", toolCalls: calls.map((c, i) => ({ id: `t${i}-${Math.random()}`, ...c })) }, { stop: "end", toolCalls: [] }]),
      emit: (e) => {
        if (e.type === "tool" && e.part.status === "awaiting-approval") {
          asked.push(e.part.name);
          queueMicrotask(() => agent.answerApproval(e.part.id, answer(e.part.name)));
        }
      },
      daw: { enabled: () => true, contextSummary: async () => null, run: async (n) => (ran.push(n), { ok: true, text: "ok" }) },
    });
    const conv = store.create();
    const send = async (...cs: { name: string; input: unknown }[]) => {
      calls.length = 0;
      calls.push(...cs);
      await agent.send(conv.id, "go");
    };
    return { agent, send, asked, ran, rules, store };
  }
  const tempo = { name: "setTempo", input: { bpm: 100 } };
  const mute = { name: "setTrackMute", input: { track: { name: "Drums" }, muted: true } };
  const read = { name: "getProjectState", input: {} };

  it("ask mode asks for every change but never for reads", async () => {
    const t = make({ mode: "ask" }, () => "once");
    await t.send(read, mute, tempo);
    expect(t.asked).toEqual(["setTrackMute", "setTempo"]);
    expect(t.ran).toEqual(["getProjectState", "setTrackMute", "setTempo"]);
  });

  it("auto-edits runs low-risk actions and asks for the rest", async () => {
    const t = make({ mode: "auto-edits" }, () => "once");
    await t.send(mute, tempo);
    expect(t.asked).toEqual(["setTempo"]);
  });

  it("full auto never asks", async () => {
    const t = make({ mode: "full-auto" }, () => "deny");
    await t.send(mute, tempo, { name: "loadGenreTemplate", input: { genre: "trap" } });
    expect(t.asked).toEqual([]);
    expect(t.ran).toEqual(["setTrackMute", "setTempo", "loadGenreTemplate"]);
  });

  it("“Yes, this chat” stops asking for that action in this chat only", async () => {
    const t = make({ mode: "ask" }, () => "chat");
    await t.send(tempo, tempo);
    await t.send(tempo);
    expect(t.asked).toEqual(["setTempo"]);
    expect(t.ran).toEqual(["setTempo", "setTempo", "setTempo"]);
    expect(t.rules).toEqual({});
  });

  it("“Always” saves a rule; rules beat the mode both ways", async () => {
    const t = make({ mode: "ask" }, () => "always");
    await t.send(tempo);
    await t.send(tempo);
    expect(t.asked).toEqual(["setTempo"]);
    expect(t.rules).toEqual({ setTempo: "allow" });

    const u = make({ mode: "full-auto", rules: { setTrackMute: "ask" } }, () => "deny");
    await u.send(mute, tempo);
    expect(u.asked).toEqual(["setTrackMute"]);
    expect(u.ran).toEqual(["setTempo"]);
  });
});
