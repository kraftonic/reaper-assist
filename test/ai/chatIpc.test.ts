import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import type { ChatEvent, SkillInfo, ToolPart, UserItem } from "@shared/types";
import { Agent } from "@ai/agent";
import { ConversationStore, rewindTo } from "@ai/conversations";
import { CONTEXT_WITHHELD, createChatIpc, mentionNotes, parseSlash, previewFromSession, previewFromState, readContextPreview, togglesFromOff, undoLabelOf, type SessionLike } from "@ai/chatIpc";
import { composeUserText } from "@ai/chatInput";
import { AnthropicSession } from "@ai/providers/anthropic";
import type { CliRunOptions } from "@ai/providers/cli";
import type { ChatSession, PlainTurn, ToolResult, TurnOptions, TurnResult } from "@ai/providers/types";
import { jpegWith, pngWith } from "../fixtures/images";

const PNG64 = pngWith(8, 6, [["tEXt", "Author\0Someone"]]).toString("base64");

/** A scripted model that records what it was given, including the image loader. */
class FakeSession implements ChatSession {
  key = "fake:model";
  users: { text: string; images?: unknown[] }[] = [];
  loaded: (string | null)[] = [];
  constructor(
    private script: (TurnResult & { text?: string })[] = [],
    readonly plain?: PlainTurn[],
  ) {}
  addUser(text: string, images?: UserItem["images"]) {
    this.users.push({ text, images });
  }
  addToolResults(_r: ToolResult[]) {}
  serialize() {
    return [];
  }
  async turn(o: TurnOptions): Promise<TurnResult> {
    for (const img of this.users.at(-1)?.images ?? []) this.loaded.push(o.images?.((img as { id: string }).id)?.base64 ?? null);
    const next = this.script.shift() ?? { stop: "end", toolCalls: [], text: "ok" };
    if (next.text) o.onText(next.text);
    return next;
  }
}

const SKILLS: SkillInfo[] = [{ id: "gain-staging", title: "Gain staging", when: "levels" }];

function setup(opts: { session?: () => ChatSession; cli?: boolean } = {}) {
  const root = mkdtempSync(join(tmpdir(), "ka-chat-"));
  const store = new ConversationStore(root);
  const sessions: FakeSession[] = [];
  const events: ChatEvent[] = [];
  const summaries: ({ off?: string[] } | undefined)[] = [];
  const undos: string[] = [];
  const runs: CliRunOptions[] = [];
  let undoOk = true;
  const agent = new Agent({
    store,
    permissions: () => ({ mode: "full-auto", rules: {} }),
    active: () => (opts.cli ? { provider: "codex-cli", model: "default", key: "codex-cli:default" } : { provider: "anthropic", model: "fake", key: "fake:model" }),
    makeSession: (_restore, plain) => {
      if (opts.session) return opts.session();
      const s = new FakeSession([], plain);
      sessions.push(s);
      return s;
    },
    emit: (e) => events.push(e),
    daw: {
      enabled: () => true,
      contextSummary: async (o) => (summaries.push(o), "Project “Song”, 120 BPM"),
      run: async (name) => ({ ok: true, text: JSON.stringify({ status: "verified", message: `${name} done`, undoLabel: `Assist: ${name}` }), undoLabel: `Assist: ${name}` }),
    },
    cli: opts.cli
      ? {
          runner: () => async (o) => (runs.push(o), o.onText("seen"), { sessionId: "th-1" }),
          mcp: () => ({ command: "node", args: [], env: {} }),
          cwd: join(root, "cli"),
        }
      : undefined,
  });
  const chat = createChatIpc({
    store,
    agent,
    undo: async (label) => (undos.push(label), undoOk ? { ok: true, text: JSON.stringify({ status: "verified" }) } : { ok: false, text: JSON.stringify({ status: "error", error: { message: "The newest undo point is something else." } }) }),
    skills: { list: () => SKILLS, load: (id) => (id === "gain-staging" ? "# Gain staging\nAim for -18 dBFS average." : null) },
    onError: () => undefined,
  });
  const conv = store.create();
  const settle = async () => {
    for (let i = 0; i < 50 && agent.isRunning(conv.id); i++) await new Promise((r) => setTimeout(r, 5));
  };
  return { root, store, agent, chat, conv, sessions, events, summaries, undos, runs, settle, failUndo: () => (undoOk = false) };
}

describe("sending images", () => {
  it("stores them with the chat (refs only in the JSON), cleans them, and hands them to the model", async () => {
    const t = setup();
    expect(t.chat.send(t.conv.id, { text: "What plug-in is this?", images: [{ mime: "image/png", data: PNG64, name: "plugin.png" }] })).toEqual({ ok: true });
    await t.settle();
    const user = t.store.get(t.conv.id)!.transcript[0] as UserItem;
    expect(user.images).toHaveLength(1);
    expect(user.images![0]).toMatchObject({ mime: "image/png", width: 8, height: 6, name: "plugin.png" });
    // The session got the ref, and the loader returned the cleaned bytes.
    expect(t.sessions[0]!.users[0]!.images).toEqual(user.images);
    const sent = Buffer.from(t.sessions[0]!.loaded[0]!, "base64");
    expect(sent.toString("latin1")).not.toContain("Someone");
    // On disk: one image file, and a JSON without pixels.
    const json = readFileSync(join(t.root, "conversations", `${t.conv.id}.json`), "utf8");
    expect(json).not.toContain(PNG64.slice(0, 40));
    expect(readdirSync(join(t.root, "conversations", t.conv.id))).toEqual([`${user.images![0]!.id}.png`]);
    // A fresh store (app restart) finds the image again.
    const again = new ConversationStore(t.root);
    expect(again.readImage(t.conv.id, user.images![0]!.id)?.base64).toBe(t.sessions[0]!.loaded[0]);
    expect(t.chat.image(t.conv.id, user.images![0]!.id)).toMatch(/^data:image\/png;base64,/);
  });

  it("lets an image go alone, and titles the chat after it", async () => {
    const t = setup();
    expect(t.chat.send(t.conv.id, { text: "", images: [{ mime: "image/jpeg", data: jpegWith(32, 32).toString("base64"), name: "mixer.jpg" }] }).ok).toBe(true);
    await t.settle();
    expect(t.store.get(t.conv.id)!.title).toBe("mixer.jpg");
    expect(t.sessions[0]!.users[0]!.text).toContain("Take a look at this image.");
  });

  it("refuses what isn't an image, too many images, and empty messages", () => {
    const t = setup();
    expect(t.chat.send(t.conv.id, { text: "hi", images: [{ mime: "image/png", data: Buffer.from("<svg/>").toString("base64") }] })).toMatchObject({ ok: false, message: expect.stringMatching(/PNG or JPEG/) });
    expect(t.chat.send(t.conv.id, { text: "hi", images: Array.from({ length: 7 }, () => ({ mime: "image/png" as const, data: PNG64 })) })).toMatchObject({ ok: false, message: expect.stringMatching(/Up to 6/) });
    expect(t.chat.send(t.conv.id, { text: "   " })).toMatchObject({ ok: false });
    expect(t.chat.send("nope", { text: "hi" })).toMatchObject({ ok: false });
    expect(t.store.get(t.conv.id)!.transcript).toEqual([]);
  });

  it("gives a CLI provider the stored image files", async () => {
    const t = setup({ cli: true });
    t.chat.send(t.conv.id, { text: "read this", images: [{ mime: "image/png", data: PNG64 }] });
    await t.settle();
    expect(t.runs[0]!.images).toHaveLength(1);
    expect(existsSync(t.runs[0]!.images![0]!.path)).toBe(true);
    expect(t.runs[0]!.images![0]!.mime).toBe("image/png");
  });

  it("keeps images when switching models mid-chat (plain history carries them)", async () => {
    const t = setup();
    t.chat.send(t.conv.id, { text: "look", images: [{ mime: "image/png", data: PNG64 }] });
    await t.settle();
    const c = t.store.get(t.conv.id)!;
    c.session = { key: "other:model", native: [] }; // as if another model answered last
    t.chat.send(t.conv.id, { text: "and now?" });
    await t.settle();
    const plain = t.sessions[1]!.plain!;
    expect(plain[0]).toMatchObject({ role: "user", text: "look" });
    expect(plain[0]!.images).toHaveLength(1);
  });

  it("saves only image placeholders in a real Claude session's history", async () => {
    const reqs: { messages: { content: unknown }[] }[] = [];
    const client = {
      beta: {
        messages: {
          stream(params: { messages: { content: unknown }[] }) {
            reqs.push(structuredClone(params));
            return { on: () => undefined, finalMessage: async () => ({ content: [{ type: "text", text: "ok" }], stop_reason: "end_turn", model: "m" }) };
          },
        },
      },
    } as unknown as Anthropic;
    const t = setup({ session: () => new AnthropicSession(client, "claude-x", "low", "https://api.anthropic.com") });
    t.chat.send(t.conv.id, { text: "what is this", images: [{ mime: "image/png", data: PNG64 }] });
    await t.settle();
    const sent = JSON.stringify(reqs[0]!.messages);
    const saved = readFileSync(join(t.root, "conversations", `${t.conv.id}.json`), "utf8");
    const pixels = t.store.readImage(t.conv.id, (t.store.get(t.conv.id)!.transcript[0] as UserItem).images![0]!.id)!.base64;
    expect(sent).toContain(pixels);
    expect(saved).not.toContain(pixels);
    expect(saved).toContain("ka-image:");
  });
});

describe("slash commands, mentions and context chips", () => {
  it("expands a /skill for the model and keeps the short form in the chat", async () => {
    const t = setup();
    t.chat.send(t.conv.id, { text: "/gain-staging check my vocal" });
    await t.settle();
    const user = t.store.get(t.conv.id)!.transcript[0] as UserItem;
    expect(user.text).toBe("check my vocal");
    expect(user.skill).toEqual({ id: "gain-staging", title: "Gain staging" });
    const sent = t.sessions[0]!.users[0]!.text;
    expect(sent).toContain('<skill id="gain-staging" title="Gain staging">');
    expect(sent).toContain("Aim for -18 dBFS average.");
    expect(sent.trim().endsWith("check my vocal")).toBe(true);
  });

  it("tells the model what @-mentions point at and passes the context choice", async () => {
    const t = setup();
    t.chat.send(t.conv.id, {
      text: "make @Bass louder in @Chorus 2",
      mentions: [
        { label: "Bass", ref: "track 3 “Bass” (id {A})" },
        { label: "Chorus 2", ref: "region “Chorus”, bars 33–40" },
        { label: "Drums", ref: "track 1" },
      ],
      contextOff: ["items"],
      contextLabels: ["Song · 120 BPM", "Bass"],
    });
    await t.settle();
    const sent = t.sessions[0]!.users[0]!.text;
    expect(sent).toContain("<mentions>\n@Bass = track 3 “Bass” (id {A})\n@Chorus 2 = region “Chorus”, bars 33–40\n</mentions>");
    expect(sent).not.toContain("@Drums =");
    expect(t.summaries[0]).toEqual({ off: ["items"] });
    expect((t.store.get(t.conv.id)!.transcript[0] as UserItem).context).toEqual(["Song · 120 BPM", "Bass"]);
  });

  it("parses / commands and mentions", () => {
    expect(parseSlash("/Gain-Staging  hi there", SKILLS)).toEqual({ skill: SKILLS[0], rest: "hi there" });
    expect(parseSlash("/unknown hi", SKILLS)).toBeNull();
    expect(parseSlash("half/way", SKILLS)).toBeNull();
    expect(mentionNotes("no mentions", [{ label: "Bass", ref: "x" }])).toBeNull();
    expect(togglesFromOff(["tracks", "midi"])).toEqual({ tracks: false, midi: false });
    expect(togglesFromOff([])).toBeUndefined();
    expect(CONTEXT_WITHHELD).toMatch(/connected/);
    expect(composeUserText("", { skill: { id: "a", title: "A <b>", body: "x" } })).toBe('<skill id="a" title="A &lt;b&gt;">\nx\n</skill>\n\nUse the A <b> skill on my session.');
  });
});

describe("retry and edit-and-resend", () => {
  it("retry asks the last question again from a fresh session, with its images", async () => {
    const t = setup();
    t.chat.send(t.conv.id, { text: "first" });
    await t.settle();
    t.chat.send(t.conv.id, { text: "second", images: [{ mime: "image/png", data: PNG64 }] });
    await t.settle();
    const before = (t.store.get(t.conv.id)!.transcript[2] as UserItem).images!;
    expect(t.chat.retry(t.conv.id)).toEqual({ ok: true });
    await t.settle();
    const tr = t.store.get(t.conv.id)!.transcript;
    expect(tr.map((x) => x.role)).toEqual(["user", "assistant", "user", "assistant"]);
    expect((tr[2] as UserItem).text).toBe("second");
    expect((tr[2] as UserItem).images).toEqual(before);
    const last = t.sessions.at(-1)!;
    expect(last.plain!.map((p) => p.text)).toEqual(["first", "ok"]);
    expect(last.loaded).toHaveLength(1);
  });

  it("edit replaces a message and everything after it, and drops images no longer used", async () => {
    const t = setup();
    t.chat.send(t.conv.id, { text: "one", images: [{ mime: "image/png", data: PNG64 }] });
    await t.settle();
    t.chat.send(t.conv.id, { text: "two" });
    await t.settle();
    const folder = join(t.root, "conversations", t.conv.id);
    expect(readdirSync(folder)).toHaveLength(1);
    expect(t.chat.editAndResend(t.conv.id, 0, { text: "one, edited" })).toEqual({ ok: true });
    await t.settle();
    const tr = t.store.get(t.conv.id)!.transcript;
    expect(tr.map((x) => (x.role === "user" ? x.text : "·"))).toEqual(["one, edited", "·"]);
    expect(readdirSync(folder)).toHaveLength(0);
    expect(t.chat.editAndResend(t.conv.id, 1, { text: "x" })).toMatchObject({ ok: false });
  });

  it("an edit can keep the images that were on the message", async () => {
    const t = setup();
    t.chat.send(t.conv.id, { text: "one", images: [{ mime: "image/png", data: PNG64 }] });
    await t.settle();
    const kept = (t.store.get(t.conv.id)!.transcript[0] as UserItem).images!;
    t.chat.editAndResend(t.conv.id, 0, { text: "one again", keepImages: kept });
    await t.settle();
    expect((t.store.get(t.conv.id)!.transcript[0] as UserItem).images).toEqual(kept);
    expect(readdirSync(join(t.root, "conversations", t.conv.id))).toHaveLength(1);
  });

  it("rewinding resets the provider session and the title of an emptied chat", () => {
    const t = setup();
    const c = t.store.get(t.conv.id)!;
    c.transcript.push({ role: "user", text: "a", at: 0 });
    c.title = "a";
    c.session = { key: "k", native: [1] };
    expect(rewindTo(c, 0)?.text).toBe("a");
    expect(c.session).toBeUndefined();
    expect(c.title).toBe("New chat");
    expect(rewindTo(c, 0)).toBeNull();
  });
});

describe("one-click undo", () => {
  async function withChange() {
    const t = setup();
    const sess = new FakeSession([{ stop: "tool_use", toolCalls: [{ id: "t1", name: "setTempo", input: { bpm: 140 } }] }, { stop: "end", toolCalls: [], text: "Set." }]);
    const t2 = { ...t };
    (t.agent as unknown as { deps: { makeSession: () => ChatSession } }).deps.makeSession = () => sess;
    t.chat.send(t.conv.id, { text: "140 bpm" });
    await t.settle();
    return { ...t2, sess };
  }

  it("undoes with the change's undo label, marks the card and tells the model next time", async () => {
    const t = await withChange();
    const part = (t.store.get(t.conv.id)!.transcript[1] as { parts: ToolPart[] }).parts.find((p) => p.kind === "tool")!;
    expect(undoLabelOf(part)).toBe("Assist: setTempo");
    const r = await t.chat.undoTool(t.conv.id, part.id);
    expect(r).toMatchObject({ ok: true });
    expect(t.undos).toEqual(["Assist: setTempo"]);
    const card = (r.conversation!.transcript[1] as { parts: ToolPart[] }).parts.find((p) => p.kind === "tool")!;
    expect(card.undone).toBe(true);
    expect(await t.chat.undoTool(t.conv.id, part.id)).toMatchObject({ ok: false, message: "Already undone." });

    (t.agent as unknown as { deps: { makeSession: () => ChatSession } }).deps.makeSession = () => t.sess;
    t.chat.send(t.conv.id, { text: "thanks" });
    await t.settle();
    const sent = t.sess.users.at(-1)!.text;
    expect(sent).toContain("<panel_events>");
    expect(sent).toContain("The user undid “Set tempo to 140 BPM”");
    expect(t.store.get(t.conv.id)!.panelNotes).toBeUndefined();
  });

  it("shows REAPER's reason when it can't undo", async () => {
    const t = await withChange();
    t.failUndo();
    const part = (t.store.get(t.conv.id)!.transcript[1] as { parts: ToolPart[] }).parts.find((p) => p.kind === "tool")!;
    expect(await t.chat.undoTool(t.conv.id, part.id)).toMatchObject({ ok: false, message: "The newest undo point is something else." });
    expect(await t.chat.undoTool(t.conv.id, "nope")).toMatchObject({ ok: false });
  });
});

describe("context preview", () => {
  const session: SessionLike = {
    project: { name: "Song", bpm: 92, transport: "stopped" },
    selection: {
      tracks: [{ id: "{T2}", index: 2, name: "Bass" }],
      items: [
        { track: "Bass", kind: "audio", start: 16, end: 24, startBar: "9.1", endBar: "13.1", label: "bars 9–12" },
        { track: "Bass", kind: "audio", start: 24, end: 32, startBar: "13.1", endBar: "17.1", label: "bars 13–16" },
      ],
      itemCount: 2,
      razor: [],
      timeSelection: { start: 16, end: 32, startBar: "9.1", endBar: "17.1", label: "bars 9–16" },
      midiEditor: { track: "Keys", notes: 12, selectedNotes: 4 },
    },
    sections: [
      { name: "Chorus", kind: "region", start: 32, end: 48, startBar: "17.1", endBar: "25.1", label: "bars 17–24" },
      { name: "Chorus", kind: "region", start: 64, end: 80, startBar: "33.1", endBar: "41.1", label: "bars 33–40" },
    ],
    tracks: [
      { id: "{T1}", index: 1, name: "Drums" },
      { id: "{T2}", index: 2, name: "Bass", armed: true },
    ],
  };

  it("builds chips (ids = context toggles), mentions with occurrences, and flags", () => {
    const p = previewFromSession(session);
    expect(p.chips.map((c) => [c.id, c.label])).toEqual([
      ["project", "Song · 92 BPM"],
      ["tracks", "Bass"],
      ["items", "2 items · bars 9–16"],
      ["timeSelection", "Time · bars 9–16"],
      ["midi", "MIDI · 4 of 12 notes"],
    ]);
    expect(p.mentions.map((m) => m.name)).toEqual(["Chorus", "Chorus 2", "Drums", "Bass"]);
    expect(p.mentions[1]!.ref).toContain("occurrence: 2");
    expect(p.has).toMatchObject({ selectedTracks: 1, selectedItems: 2, timeSelection: true, armed: 1, midiEditor: true, recording: false });
    expect(previewFromSession(null).connected).toBe(false);
  });

  it("falls back to a getProjectState read", () => {
    const p = previewFromState({ project: { name: "Beat" }, tempo: { bpm: 140 }, transport: { state: "recording" }, tracks: [{ index: 1, name: "Vox", selected: true, armed: true, id: "{V}" }, { index: 2, name: "" }] });
    expect(p.chips.map((c) => c.label)).toEqual(["Beat · 140 BPM", "Vox"]);
    expect(p.has.armed).toBe(1);
    expect(p.mentions.map((m) => m.name)).toEqual(["Vox", "Track 2"]);
    expect(p.has.recording).toBe(true);
  });

  it("prefers the session context, fills track mentions from the project state, and falls back cleanly", async () => {
    const state = { project: { name: "Song" }, tempo: { bpm: 92 }, tracks: [{ index: 1, name: "Drums" }, { index: 2, name: "Bass", armed: true }, { index: 3, name: "Keys", armed: true }] };
    let stateReads = 0;
    const readState = async () => (stateReads++, state);
    // Full context: one read, nothing else.
    const full = await readContextPreview({ session: async () => session, state: readState });
    expect(full.chips.map((c) => c.id)).toEqual(["project", "tracks", "items", "timeSelection", "midi"]);
    expect(stateReads).toBe(0);
    // No track list in the context: sections from it, every track from the project state.
    const { tracks: _all, ...partial } = session;
    const mixed = await readContextPreview({ session: async () => partial, state: readState });
    expect(mixed.chips.map((c) => c.id)).toEqual(["project", "tracks", "items", "timeSelection", "midi"]);
    expect(mixed.mentions.map((m) => m.name)).toEqual(["Chorus", "Chorus 2", "Drums", "Bass", "Keys"]);
    expect(mixed.has.armed).toBe(2);
    // A context shape this build can't read, or none at all: the project state alone.
    const broken = await readContextPreview({ session: async () => ({ project: { name: "Song", bpm: 92 } }) as unknown as SessionLike, state: readState });
    expect(broken.chips.map((c) => c.label)).toEqual(["Song · 92 BPM"]);
    expect(broken.mentions.map((m) => m.name)).toEqual(["Drums", "Bass", "Keys"]);
    expect((await readContextPreview({ state: readState })).connected).toBe(true);
  });
});
