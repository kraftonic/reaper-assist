import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ContextPreview, ConversationView, SettingsView, ToolPart } from "@shared/types";
import { PROVIDER_IDS } from "@shared/types";
import { applyChatEvent, applyCompletion, canSend, contextChoice, findTrigger, menuItems, quickActions, toolOutcome, usedMentions } from "../../src/renderer/src/chat/chatLogic";
import { modelGroups } from "../../src/renderer/src/chat/models";
import { Chat } from "../../src/renderer/src/chat/Chat";
import { Composer } from "../../src/renderer/src/chat/Composer";

const preview = (over: Partial<ContextPreview["has"]> = {}): ContextPreview => ({
  connected: true,
  chips: [
    { id: "project", label: "Song · 92 BPM", icon: "project" },
    { id: "tracks", label: "Bass", icon: "tracks" },
    { id: "timeSelection", label: "Time · bars 9–16", icon: "time" },
  ],
  mentions: [
    { kind: "section", name: "Chorus", hint: "bars 17–24", ref: "region “Chorus”" },
    { kind: "track", name: "Lead Vox", hint: "track 4", ref: "track 4 “Lead Vox”" },
    { kind: "track", name: "Bass", hint: "track 2", ref: "track 2 “Bass”" },
  ],
  has: { selectedTracks: 1, selectedItems: 0, timeSelection: true, armed: 0, midiEditor: false, recording: false, ...over },
});

describe("composer menus", () => {
  it("opens / only at the start and @ after a space", () => {
    expect(findTrigger("/gai", 4)).toEqual({ kind: "slash", start: 0, query: "gai" });
    expect(findTrigger("hi /gai", 7)).toBeNull();
    expect(findTrigger("make @Lead V", 12)).toEqual({ kind: "mention", start: 5, query: "Lead V" });
    expect(findTrigger("mail@me", 7)).toBeNull();
    expect(findTrigger("@", 1)).toEqual({ kind: "mention", start: 0, query: "" });
    expect(findTrigger("@a\nb", 4)).toBeNull();
  });

  it("completes a mention in place and keeps the rest of the text", () => {
    const t = findTrigger("make @Le louder", 8)!;
    expect(applyCompletion("make @Le louder", 8, t, "@Lead Vox")).toEqual({ text: "make @Lead Vox louder", caret: 15 });
    const t2 = findTrigger("@ch", 3)!;
    expect(applyCompletion("@ch", 3, t2, "@Chorus")).toEqual({ text: "@Chorus ", caret: 8 });
  });

  it("lists quick actions and skills for /, tracks and sections for @, best match first", () => {
    const ctx = { actions: quickActions(preview()), skills: [{ id: "gain-staging", title: "Gain staging", when: "levels" }, { id: "mastering", title: "Mastering", when: "loudness" }], mentions: preview().mentions };
    const all = menuItems({ kind: "slash", start: 0, query: "" }, ctx, 20);
    expect(all.filter((i) => i.kind === "skill").map((i) => i.label)).toEqual(["/gain-staging", "/mastering"]);
    expect(menuItems({ kind: "slash", start: 0, query: "mast" }, ctx).map((i) => i.id)).toEqual(["mastering"]);
    expect(menuItems({ kind: "slash", start: 0, query: "levels" }, ctx)[0]).toMatchObject({ kind: "action", id: "levels" });
    expect(menuItems({ kind: "mention", start: 0, query: "vox" }, ctx).map((i) => i.label)).toEqual(["Lead Vox"]);
    expect(menuItems({ kind: "mention", start: 0, query: "b" }, ctx).map((i) => i.label)).toEqual(["Bass"]);
    expect(menuItems(null, ctx)).toEqual([]);
  });
});

describe("quick actions", () => {
  it("fit what's selected and what's going on", () => {
    expect(quickActions(null)).toEqual([]);
    const sel = quickActions(preview());
    expect(sel.map((a) => a.label)).toEqual(["Check my levels", "Why is this clipping?", "Tighten the drums", "Suggest chords", "Mix check"]);
    expect(sel[0]!.prompt).toContain("the selected tracks in the time selection");
    const none = quickActions(preview({ selectedTracks: 0, timeSelection: false }));
    expect(none.map((a) => a.id)).toContain("vocal-rec");
    expect(none[0]!.prompt).toMatch(/analyse the master/);
    const rec = quickActions(preview({ recording: true }));
    expect(rec).toHaveLength(1);
    expect(rec[0]!.prompt).toMatch(/Don't stop/);
  });
});

describe("sending from the composer", () => {
  it("needs text or an image, and waits for images being prepared", () => {
    expect(canSend("", 0, false)).toBe(false);
    expect(canSend("  ", 1, false)).toBe(true);
    expect(canSend("hi", 0, true)).toBe(false);
    expect(canSend("hi", 0, false, 1)).toBe(false);
  });

  it("sends the chips that are off by id, and the labels of those left on", () => {
    expect(contextChoice(preview(), new Set(["tracks"]))).toEqual({ contextOff: ["tracks"], contextLabels: ["Song · 92 BPM", "Time · bars 9–16"] });
    expect(contextChoice(null, new Set(["tracks"]))).toEqual({ contextOff: [], contextLabels: [] });
  });

  it("only sends mentions still in the text, once each", () => {
    const m = preview().mentions;
    expect(usedMentions("fix @Lead Vox and @Lead Vox", m)).toEqual([{ label: "Lead Vox", ref: "track 4 “Lead Vox”" }]);
    expect(usedMentions("no mention", m)).toEqual([]);
  });
});

describe("streaming", () => {
  const conv = (): ConversationView => ({
    id: "c",
    title: "t",
    updatedAt: 0,
    transcript: [
      { role: "user", text: "hi", at: 0 },
      { role: "assistant", at: 0, model: "m", provider: "anthropic", parts: [{ kind: "text", text: "He" }] },
    ],
  });

  it("appends text, updates tool cards in place, and leaves other rows untouched", () => {
    const c = conv();
    const a = applyChatEvent(c, { type: "text", convId: "c", delta: "llo" })!;
    expect(a.transcript[0]).toBe(c.transcript[0]);
    expect(a.transcript[1]).toMatchObject({ parts: [{ kind: "text", text: "Hello" }] });
    const tool: ToolPart = { kind: "tool", id: "t1", name: "setTempo", input: {}, summary: "Set tempo", risk: "safe", status: "running" };
    const b = applyChatEvent(a, { type: "tool", convId: "c", part: tool })!;
    const d = applyChatEvent(b, { type: "tool", convId: "c", part: { ...tool, status: "done" } })!;
    const parts = (d.transcript[1] as { parts: unknown[] }).parts;
    expect(parts).toHaveLength(2);
    expect(parts[0]).toBe((b.transcript[1] as { parts: unknown[] }).parts[0]);
    expect(applyChatEvent(d, { type: "text", convId: "other", delta: "x" })).toBe(d);
  });
});

describe("tool card results", () => {
  const part = (over: Partial<ToolPart>): ToolPart => ({ kind: "tool", id: "t", name: "setTempo", input: {}, summary: "Set tempo to 140 BPM", risk: "safe", status: "done", ...over });

  it("reads verified, unverified, failures, undo labels and undone", () => {
    expect(toolOutcome(part({ result: JSON.stringify({ status: "verified", undoLabel: "Assist: setTempo" }) }))).toMatchObject({ badge: "verified", undoLabel: "Assist: setTempo" });
    expect(toolOutcome(part({ result: JSON.stringify({ status: "unverified", note: "Check the tempo." }) }))).toMatchObject({ badge: "check", message: "Check the tempo." });
    expect(toolOutcome(part({ status: "failed", result: JSON.stringify({ status: "error", error: { message: "No track named Bass" } }) }))).toMatchObject({ badge: "failed", message: "No track named Bass" });
    expect(toolOutcome(part({ status: "denied", result: "The user denied this action." }))).toMatchObject({ badge: "skipped" });
    expect(toolOutcome(part({ undone: true, result: JSON.stringify({ status: "verified", undoLabel: "x" }) }))).toMatchObject({ badge: "undone", undoLabel: null });
    expect(toolOutcome(part({ status: "awaiting-approval" })).badge).toBe("waiting");
    expect(toolOutcome(part({ result: "plain text" })).badge).toBe("done");
  });
});

describe("model switcher", () => {
  const settings = (over: Partial<SettingsView> = {}): SettingsView => {
    const providers = Object.fromEntries(PROVIDER_IDS.map((id) => [id, { baseUrl: "", model: "", hasKey: false, keyHint: null }])) as SettingsView["providers"];
    providers.anthropic = { baseUrl: "", model: "claude-opus-5-5", hasKey: true, keyHint: "abcd" };
    return { activeProvider: "anthropic", providers, effort: "low", webAccess: true, permissions: { mode: "ask", rules: {} }, workflow: null, daw: { enabled: true, bridgeDir: "", resourcePath: "", autoApproveSafe: true }, hotkey: "", alwaysOnTop: false, dock: "right", secureStorage: true, cliAllowed: true, ...over };
  };

  it("offers providers that are set up (and the CLIs in personal builds)", () => {
    const g = modelGroups(settings());
    expect(g.map((x) => x.provider)).toEqual(["claude-cli", "codex-cli", "anthropic"]);
    expect(g.find((x) => x.provider === "anthropic")!.models.map((m) => m.label)).toEqual(["Opus 5.5", "Sonnet 5.5", "Haiku 5.5"]);
    expect(modelGroups(settings({ cliAllowed: false })).map((x) => x.provider)).toEqual(["anthropic"]);
  });
});

describe("panel rendering", () => {
  const noop = () => undefined;
  it("shows images, skill tags, context, verified results and an Undo button in the transcript", () => {
    const conv: ConversationView = {
      id: "c",
      title: "t",
      updatedAt: 0,
      transcript: [
        { role: "user", text: "check my vocal", at: 0, skill: { id: "gain-staging", title: "Gain staging" }, images: [{ id: "0123456789abcdef01234567", mime: "image/png", width: 800, height: 500, bytes: 120000, name: "comp.png" }], context: ["Song · 92 BPM", "Vox"] },
        {
          role: "assistant",
          at: 0,
          model: "claude-opus-5-5",
          provider: "anthropic",
          parts: [
            { kind: "text", text: "Lowered it **3 dB**." },
            { kind: "tool", id: "t1", name: "setTrackVolume", input: {}, summary: "Change “Vox” by -3 dB", risk: "safe", status: "done", result: JSON.stringify({ status: "verified", undoLabel: "Assist: setTrackVolume" }) },
            { kind: "notice", level: "error", text: "Claude rejected the API key. Check it in Settings → AI." },
          ],
        },
      ],
    };
    const html = renderToStaticMarkup(createElement(Chat, { conv, setConv: noop, daw: { enabled: true, state: "connected", bridgeDir: "" }, needsSetup: false, onSetup: noop, hidden: false, mode: "auto-edits", setMode: noop }));
    expect(html).toContain("/gain-staging");
    expect(html).toContain("with Song · 92 BPM · Vox");
    expect(html).toContain('class="thumb"');
    expect(html).toContain("<strong>3 dB</strong>");
    expect(html).toContain("Verified");
    expect(html).toMatch(/Undo<\/button>/);
    expect(html).toContain("Open Settings");
    expect(html).toContain("Retry");
    expect(html).toContain("Opus 5.5");
    expect(html).toContain('aria-label="Message"');
  });

  it("the chat box shows the context chips and the attach, actions and mention buttons", () => {
    const html = renderToStaticMarkup(
      createElement(Composer, {
        convId: "c",
        busy: false,
        connected: true,
        hidden: false,
        preview: preview(),
        skills: [{ id: "gain-staging", title: "Gain staging", when: "levels" }],
        mode: "ask",
        setMode: noop,
        error: "That image is too large.",
        setError: noop,
        onSend: async () => true,
        onStop: noop,
        onEditLast: noop,
        onFocus: noop,
        onShowImage: noop,
      }),
    );
    expect(html).toContain("Song · 92 BPM");
    expect(html).toContain("Time · bars 9–16");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("Attach images");
    expect(html).toContain("Quick actions and skills");
    expect(html).toContain("Mention a track or section");
    expect(html).toContain("That image is too large.");
    expect(html).toContain("Ask before changes");
  });
});
