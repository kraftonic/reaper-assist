import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import type OpenAI from "openai";
import type { ImageRef } from "@shared/types";
import { AnthropicSession, webToolKind } from "@ai/providers/anthropic";
import { OpenAISession } from "@ai/providers/openai";
import { claudeCliArgs, codexCliArgs, codexImageArgs, runClaudeCli, runCodexCli, setCliBinary, type CliRunOptions } from "@ai/providers/cli";
import type { ImageLoader } from "@ai/providers/images";
import type { ChatSession, TurnOptions } from "@ai/providers/types";
import { pngWith } from "../fixtures/images";

const REF: ImageRef = { id: "0123456789abcdef01234567", mime: "image/png", width: 4, height: 3, bytes: 99 };
const PIXELS = pngWith(4, 3).toString("base64");
const loader: ImageLoader = (id) => (id === REF.id ? { mime: "image/png", base64: PIXELS } : null);
const opts = (images: ImageLoader | undefined = loader, tools: TurnOptions["tools"] = [], web = false): TurnOptions => ({ system: "sys", tools, onText: () => undefined, signal: new AbortController().signal, images, web });

/* ------------------------------------------------------------ fake SDKs */

function fakeAnthropic(replies: { content: Anthropic.Beta.BetaContentBlock[] | { type: string; text?: string; [k: string]: unknown }[]; stop_reason: string; [k: string]: unknown }[]) {
  const requests: Record<string, unknown>[] = [];
  const client = {
    beta: {
      messages: {
        stream(params: Record<string, unknown>) {
          requests.push(structuredClone(params));
          const msg = { model: "claude-test", stop_details: null, ...replies.shift()! };
          const onText: ((d: string) => void)[] = [];
          return {
            on(ev: string, cb: (d: string) => void) {
              if (ev === "text") onText.push(cb);
              return this;
            },
            async finalMessage() {
              for (const b of msg.content) if (b.type === "text") onText.forEach((cb) => cb((b as { text: string }).text));
              return msg;
            },
          };
        },
      },
    },
  } as unknown as Anthropic;
  return { client, requests };
}

function fakeOpenAI(text = "ok") {
  const requests: Record<string, unknown>[] = [];
  const client = {
    chat: {
      completions: {
        async create(params: Record<string, unknown>) {
          requests.push(structuredClone(params));
          return (async function* () {
            yield { choices: [{ index: 0, delta: { content: text }, finish_reason: null }] };
            yield { choices: [{ index: 0, delta: {}, finish_reason: "stop" }] };
          })();
        },
      },
    },
  } as unknown as OpenAI;
  return { client, requests };
}

type Msgs = { role: string; content: unknown }[];

describe("Claude API: image blocks", () => {
  const end = { content: [{ type: "text", text: "A compressor." }], stop_reason: "end_turn" };

  it("sends images as base64 image blocks before the text, and saves only placeholders", async () => {
    const { client, requests } = fakeAnthropic([end, end]);
    const s = new AnthropicSession(client, "claude-sonnet-5-5", "low", "https://api.anthropic.com");
    s.addUser("What plug-in is this?", [REF]);
    await s.turn(opts());
    const first = (requests[0]!.messages as Msgs)[0]!;
    expect(first.content).toEqual([
      { type: "image", source: { type: "base64", media_type: "image/png", data: PIXELS } },
      { type: "text", text: "What plug-in is this?" },
    ]);
    const saved = JSON.stringify(s.serialize());
    expect(saved).not.toContain(PIXELS);
    expect(saved).toContain(`ka-image:${REF.id}`);

    // Resumed after a restart: same bytes go out again (cache-friendly), the new turn is appended.
    const resumed = new AnthropicSession(client, "claude-sonnet-5-5", "low", "https://api.anthropic.com", JSON.parse(saved));
    resumed.addUser("Thanks, and the threshold?");
    await resumed.turn(opts());
    const second = requests[1]!.messages as Msgs;
    expect(second[0]).toEqual(first);
    expect(second.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
  });

  it("starts from a plain transcript with its images, and survives a missing file", async () => {
    const { client, requests } = fakeAnthropic([end]);
    const s = new AnthropicSession(client, "claude-sonnet-5-5", "low", "https://api.anthropic.com", undefined, [
      { role: "user", text: "Look", images: [REF, { ...REF, id: "ffffffffffffffffffffffff" }] },
      { role: "assistant", text: "I see it." },
    ]);
    s.addUser("And now?");
    await s.turn(opts());
    const content = (requests[0]!.messages as Msgs)[0]!.content as { type: string; text?: string }[];
    expect(content.map((b) => b.type)).toEqual(["image", "text", "text"]);
    expect(content[1]!.text).toMatch(/no longer available/);
  });

  it("drops a refused message that had images, so the history stays valid", async () => {
    const { client } = fakeAnthropic([{ content: [], stop_reason: "refusal" }]);
    const s = new AnthropicSession(client, "claude-sonnet-5-5", "low", "https://api.anthropic.com");
    s.addUser("look", [REF]);
    const r = await s.turn(opts());
    expect(r.stop).toBe("refusal");
    expect(s.serialize()).toEqual([]);
  });
});

describe("OpenAI-compatible: image inputs", () => {
  it("sends image_url data URLs before the text, without an empty tools list", async () => {
    const { client, requests } = fakeOpenAI();
    const s = new OpenAISession("openai", client, "gpt-test");
    s.addUser("Read this error dialog", [REF]);
    await s.turn(opts());
    const req = requests[0]!;
    expect(req.tools).toBeUndefined();
    const msgs = req.messages as Msgs;
    expect(msgs[0]).toEqual({ role: "system", content: "sys" });
    expect(msgs[1]!.content).toEqual([
      { type: "image_url", image_url: { url: `data:image/png;base64,${PIXELS}` } },
      { type: "text", text: "Read this error dialog" },
    ]);
    expect(JSON.stringify(s.serialize())).not.toContain(PIXELS);
  });

  it("keeps tools when there are some, and images from a plain transcript", async () => {
    const { client, requests } = fakeOpenAI();
    const s = new OpenAISession("gemini", client, "gemini-test", undefined, [
      { role: "user", text: "chord sheet", images: [REF] },
      { role: "assistant", text: "C – Am – F – G" },
    ]);
    s.addUser("transpose it up 2");
    await s.turn(opts(loader, [{ name: "getProjectState", description: "read", schema: { type: "object" } }]));
    const req = requests[0]!;
    expect((req.tools as unknown[]).length).toBe(1);
    const msgs = req.messages as Msgs;
    expect((msgs[1]!.content as { type: string }[]).map((p) => p.type)).toEqual(["image_url", "text"]);
    expect(msgs[2]).toEqual({ role: "assistant", content: "C – Am – F – G" });
  });
});

/* ------------------------------------------------------------ fake CLIs */

const bin = mkdtempSync(join(tmpdir(), "ka-fakecli-"));
const node = `#!${process.execPath}\n`;

/** Records argv, cwd and stdin; answers like `claude -p --output-format stream-json`. Exits only when stdin ends, like the real CLI. */
const FAKE_CLAUDE = `${node}
const fs = require("fs");
const args = process.argv.slice(2);
const streaming = args.includes("--input-format");
let input = "", replied = false;
const reply = () => {
  replied = true;
  for (const l of [
    { type: "system", subtype: "init" },
    { type: "stream_event", event: { type: "message_start" } },
    { type: "stream_event", event: { type: "content_block_delta", delta: { type: "text_delta", text: "I see " } } },
    { type: "stream_event", event: { type: "content_block_delta", delta: { type: "text_delta", text: "a compressor." } } },
    { type: "result", subtype: "success", is_error: false, result: "I see a compressor." },
  ]) process.stdout.write(JSON.stringify(l) + "\\n");
};
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => { input += d; if (streaming && !replied && input.includes("\\n")) reply(); });
process.stdin.on("end", () => {
  fs.writeFileSync(process.env.FAKE_LOG, JSON.stringify({ args, input, cwd: process.cwd(), repliedBeforeEnd: replied }));
  if (!streaming) reply();
});
`;

/** Records argv, cwd and stdin; answers like `codex exec --json`. */
const FAKE_CODEX = `${node}
const fs = require("fs");
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  fs.writeFileSync(process.env.FAKE_LOG, JSON.stringify({ args: process.argv.slice(2), input, cwd: process.cwd() }));
  for (const l of [
    { type: "thread.started", thread_id: "th-1" },
    { type: "item.completed", item: { id: "m1", type: "agent_message", text: "A Pro-Q style EQ." } },
    { type: "turn.completed" },
  ]) process.stdout.write(JSON.stringify(l) + "\\n");
});
`;

function fake(name: "claude" | "codex", src: string) {
  const p = join(bin, name);
  writeFileSync(p, src);
  chmodSync(p, 0o755);
  setCliBinary(name, p);
}

function cliRun(over: Partial<CliRunOptions> = {}) {
  const log = join(mkdtempSync(join(tmpdir(), "ka-log-")), "log.json");
  process.env.FAKE_LOG = log;
  const text: string[] = [];
  const o: CliRunOptions = { prompt: "What is this?", system: "SYS", model: "default", sessionId: null, mcp: null, cwd: mkdtempSync(join(tmpdir(), "ka-cwd-")), signal: new AbortController().signal, onText: (d) => text.push(d), ...over };
  return { o, text, read: () => JSON.parse(readFileSync(log, "utf8")) as { args: string[]; input: string; cwd: string; repliedBeforeEnd?: boolean } };
}

const imgDir = mkdtempSync(join(tmpdir(), "ka-img-"));
const imgPath = join(imgDir, `${REF.id}.png`);
writeFileSync(imgPath, Buffer.from(PIXELS, "base64"));

afterEach(() => {
  setCliBinary("claude", null);
  setCliBinary("codex", null);
});

describe("Claude Code CLI: images via stream-json input", () => {
  it("sends one stream-json user message with image blocks and closes input after the result", async () => {
    fake("claude", FAKE_CLAUDE);
    const r = cliRun({ images: [{ path: imgPath, mime: "image/png" }] });
    const out = await runClaudeCli(r.o);
    const log = r.read();
    expect(log.args).toEqual(expect.arrayContaining(["-p", "--input-format", "stream-json", "--output-format", "--system-prompt", "SYS", "--tools", ""]));
    expect(log.repliedBeforeEnd).toBe(true);
    const msg = JSON.parse(log.input.trim()) as { type: string; message: { role: string; content: { type: string; source?: { data: string; media_type: string }; text?: string }[] } };
    expect(msg.type).toBe("user");
    expect(msg.message.role).toBe("user");
    expect(msg.message.content.map((b) => b.type)).toEqual(["image", "text"]);
    expect(msg.message.content[0]!.source).toEqual({ type: "base64", media_type: "image/png", data: PIXELS });
    expect(msg.message.content[1]!.text).toBe("What is this?");
    expect(r.text.join("")).toBe("I see a compressor.");
    expect(out.sessionId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("keeps plain text input when there are no images", async () => {
    fake("claude", FAKE_CLAUDE);
    const r = cliRun({ sessionId: "11111111-2222-3333-4444-555555555555" });
    await runClaudeCli(r.o);
    const log = r.read();
    expect(log.args).not.toContain("--input-format");
    expect(log.args).toEqual(expect.arrayContaining(["--resume", "11111111-2222-3333-4444-555555555555"]));
    expect(log.input).toBe("What is this?");
  });
});

describe("Codex CLI: images via -i", () => {
  it("attaches each image with -i before the other flags, relative to its working folder", async () => {
    fake("codex", FAKE_CODEX);
    const r = cliRun({ images: [{ path: imgPath, mime: "image/png" }, { path: imgPath, mime: "image/png" }] });
    const out = await runCodexCli(r.o);
    const log = r.read();
    expect(log.args[0]).toBe("exec");
    const at = log.args.indexOf("-i");
    expect(at).toBe(1);
    expect(log.args.indexOf("-i", at + 2)).toBe(3);
    expect(log.args[5]).toBe("--json");
    expect(log.args.at(-1)).toBe("-");
    expect(existsSync(resolve(log.cwd, log.args[at + 1]!))).toBe(true);
    expect(readFileSync(resolve(log.cwd, log.args[at + 1]!)).toString("base64")).toBe(PIXELS);
    expect(log.input).toContain("SYS");
    expect(out.sessionId).toBe("th-1");
    expect(r.text.join("")).toBe("A Pro-Q style EQ.");
  });

  it("attaches images when resuming too", async () => {
    fake("codex", FAKE_CODEX);
    const r = cliRun({ sessionId: "th-1", images: [{ path: imgPath, mime: "image/png" }] });
    await runCodexCli(r.o);
    const log = r.read();
    expect(log.args.slice(0, 3)).toEqual(["exec", "resume", "-i"]);
    expect(log.args.slice(-2)).toEqual(["th-1", "-"]);
    expect(log.input).toBe("What is this?");
  });

  it("copies an image whose path has a comma (the flag splits on commas)", () => {
    const odd = join(mkdtempSync(join(tmpdir(), "ka-a,b-")), "x,y.png");
    writeFileSync(odd, "png");
    const cwd = mkdtempSync(join(tmpdir(), "ka-cwd-"));
    mkdirSync(cwd, { recursive: true });
    const args = codexImageArgs([{ path: odd, mime: "image/png" }], cwd);
    expect(args[0]).toBe("-i");
    expect(args[1]).not.toContain(",");
    expect(readFileSync(resolve(cwd, args[1]!), "utf8")).toBe("png");
  });
});

/* ------------------------------------------------------------ web access */

describe("web access: Claude API server tools", () => {
  const end = { content: [{ type: "text", text: "Done." }], stop_reason: "end_turn" };
  const TOOL = [{ name: "loadSkill", description: "read", schema: { type: "object" } }];
  const toolTypes = (req: Record<string, unknown>) => (req.tools as { type?: string; name: string }[]).map((t) => t.type ?? t.name);

  it("adds web search and fetch (dynamic filtering) only when web access is on", async () => {
    const { client, requests } = fakeAnthropic([end, end]);
    const s = new AnthropicSession(client, "claude-sonnet-5-5", "low", "https://api.anthropic.com");
    expect(s.nativeWeb).toBe(true);
    s.addUser("latest Serum version?");
    await s.turn(opts(loader, TOOL, true));
    expect(toolTypes(requests[0]!)).toEqual(["loadSkill", "web_search_20260209", "web_fetch_20260209"]);
    const search = (requests[0]!.tools as Record<string, unknown>[])[1]!;
    expect(search).toMatchObject({ name: "web_search", max_uses: 5 });
    expect(search.eager_input_streaming).toBeUndefined();
    s.addUser("thanks");
    await s.turn(opts(loader, TOOL, false));
    expect(toolTypes(requests[1]!)).toEqual(["loadSkill"]);
  });

  it("picks the tool version each model takes", () => {
    for (const m of ["claude-opus-5-5", "claude-sonnet-5", "claude-opus-4-6", "claude-sonnet-4-6", "claude-fable-5-1"]) expect(webToolKind(m), m).toBe("dynamic");
    for (const m of ["claude-haiku-5-5", "claude-haiku-4-5", "claude-haiku-4-5-20251001", "claude-opus-4-5-20251101", "claude-sonnet-4-5", "claude-sonnet-4-20250514"]) expect(webToolKind(m), m).toBe("basic");
    for (const m of ["claude-3-7-sonnet-latest", "gpt-5", "my-proxy-model"]) expect(webToolKind(m), m).toBeNull();
  });

  it("uses the basic tools on Haiku and none on unknown models", async () => {
    const { client, requests } = fakeAnthropic([end, end]);
    const haiku = new AnthropicSession(client, "claude-haiku-4-5", "low", "https://api.anthropic.com");
    haiku.addUser("hi");
    await haiku.turn(opts(loader, TOOL, true));
    expect(toolTypes(requests[0]!)).toEqual(["loadSkill", "web_search_20250305", "web_fetch_20250910"]);
    const other = new AnthropicSession(client, "some-proxy-model", "low", "https://example.com");
    expect(other.nativeWeb).toBe(false);
    other.addUser("hi");
    await other.turn(opts(loader, TOOL, true));
    expect(toolTypes(requests[1]!)).toEqual(["loadSkill"]);
  });

  it("keeps server tool blocks in the history unchanged, continues paused searches in the same container, and notes the searches", async () => {
    const searched = [
      { type: "text", text: "Checking. " },
      { type: "server_tool_use", id: "srvtoolu_1", name: "web_search", input: { query: "Serum 2 latest version" } },
      { type: "web_search_tool_result", tool_use_id: "srvtoolu_1", content: [{ type: "web_search_result", url: "https://xferrecords.com", title: "Xfer", encrypted_content: "ENC==", page_age: null }] },
    ];
    const answered = [{ type: "text", text: "Serum 2.0.17.", citations: [{ type: "web_search_result_location", url: "https://xferrecords.com", title: "Xfer", encrypted_index: "IDX", cited_text: "2.0.17" }] }];
    const { client, requests } = fakeAnthropic([
      { content: searched, stop_reason: "pause_turn", container: { id: "cntr_1", expires_at: "x" }, usage: { server_tool_use: { web_search_requests: 1 } } },
      { content: answered, stop_reason: "end_turn", container: null },
    ]);
    const s = new AnthropicSession(client, "claude-opus-5-5", "medium", "https://api.anthropic.com");
    s.addUser("What's the latest Serum?");
    const r = await s.turn(opts(loader, TOOL, true));
    expect(r.stop).toBe("end");
    expect(r.note).toBe("Searched the web: “Serum 2 latest version”.");
    expect(requests).toHaveLength(2);
    expect(requests[0]!.container).toBeUndefined();
    expect(requests[1]!.container).toBe("cntr_1");
    // The paused turn went back exactly as received.
    expect((requests[1]!.messages as Msgs)[1]).toEqual({ role: "assistant", content: searched });

    // Saved and resumed: encrypted results and citations survive the round trip.
    const saved = JSON.parse(JSON.stringify(s.serialize())) as Msgs;
    expect(saved.map((m) => m.role)).toEqual(["user", "assistant", "assistant"]);
    expect(JSON.stringify(saved)).toContain("ENC==");
    expect(JSON.stringify(saved)).toContain("IDX");
    const again = fakeAnthropic([end]);
    const resumed = new AnthropicSession(again.client, "claude-opus-5-5", "medium", "https://api.anthropic.com", structuredClone(saved));
    resumed.addUser("And Vital?");
    await resumed.turn(opts(loader, TOOL, true));
    expect((again.requests[0]!.messages as Msgs).slice(0, 3)).toEqual(saved);
  });

  it("explains a chat that searched before when web access is now off", async () => {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = {
      beta: {
        messages: {
          stream() {
            throw new Anthropic.BadRequestError(400, { type: "error", error: { type: "invalid_request_error", message: "web_search tool use found but no web_search tool was provided" } }, "web_search tool use found but no web_search tool was provided", new Headers());
          },
        },
      },
    } as unknown as Anthropic;
    const history = [
      { role: "user", content: "hi" },
      { role: "assistant", content: [{ type: "server_tool_use", id: "srvtoolu_1", name: "web_search", input: { query: "x" } }, { type: "web_search_tool_result", tool_use_id: "srvtoolu_1", content: [] }, { type: "text", text: "ok" }] },
    ];
    const s = new AnthropicSession(client, "claude-opus-5-5", "low", "https://api.anthropic.com", history);
    s.addUser("again");
    await expect(s.turn(opts(loader, TOOL, false))).rejects.toThrow(/searched the web earlier/);
  });
});

describe("web access: OpenAI-compatible APIs", () => {
  it("adds no provider web tools (Assist's readWebPage comes from the agent)", async () => {
    const { client, requests } = fakeOpenAI();
    const s = new OpenAISession("openai", client, "gpt-test");
    expect((s as ChatSession).nativeWeb).toBeUndefined();
    s.addUser("hi");
    await s.turn(opts(loader, [{ name: "readWebPage", description: "read", schema: { type: "object" } }], true));
    expect((requests[0]!.tools as { type: string; function: { name: string } }[]).map((t) => `${t.type}:${t.function.name}`)).toEqual(["function:readWebPage"]);
    expect(requests[0]!.web_search_options).toBeUndefined();
  });
});

describe("web access: CLI flags", () => {
  const base = { system: "SYS", model: "default", sessionId: null, mcp: { command: "node", args: ["mcp.js"], env: {} }, cwd: "/tmp/w" };
  const after = (args: string[], flag: string) => args[args.indexOf(flag) + 1];

  it("Claude Code: no built-in tools, or only WebSearch and WebFetch with web access", () => {
    const off = claudeCliArgs({ ...base, web: false }, "sid", "text");
    expect(after(off, "--tools")).toBe("");
    expect(after(off, "--allowedTools")).toBe("mcp__reaper");
    expect(off.join(" ")).not.toMatch(/WebSearch|WebFetch/);

    const on = claudeCliArgs({ ...base, web: true }, "sid", "text");
    expect(after(on, "--tools")).toBe("WebSearch,WebFetch");
    expect(after(on, "--allowedTools")).toBe("mcp__reaper,WebSearch,WebFetch");
    expect(on.join(" ")).not.toMatch(/Bash|Read|Write|Edit/);
    // The rest of the lock-down stays.
    for (const a of [off, on]) {
      expect(a).toEqual(expect.arrayContaining(["--strict-mcp-config", "--setting-sources", "--system-prompt"]));
      expect(after(a, "--setting-sources")).toBe("");
    }
    expect(after(claudeCliArgs({ ...base, mcp: null, web: true }, "sid", "text"), "--allowedTools")).toBe("WebSearch,WebFetch");
    expect(claudeCliArgs({ ...base, mcp: null, web: false }, "sid", "text")).not.toContain("--allowedTools");
  });

  it("Codex: web search only with web access, every other feature still off", () => {
    const off = codexCliArgs({ ...base, web: false }, []);
    const on = codexCliArgs({ ...base, web: true }, []);
    expect(off).toContain('web_search="disabled"');
    expect(on).toContain('web_search="live"');
    expect(on).not.toContain('web_search="disabled"');
    for (const a of [off, on]) {
      expect(a).toEqual(expect.arrayContaining(["--ignore-user-config", "--ignore-rules", 'sandbox_mode="read-only"', 'approval_policy="never"', "--disable", "shell_tool", "browser_use"]));
    }
  });

  it("passes the setting through to the real runners", async () => {
    fake("claude", FAKE_CLAUDE);
    const r = cliRun({ web: true });
    await runClaudeCli(r.o);
    expect(r.read().args).toEqual(expect.arrayContaining(["--tools", "WebSearch,WebFetch"]));
    fake("codex", FAKE_CODEX);
    const c = cliRun({ web: false });
    await runCodexCli(c.o);
    expect(c.read().args).toContain('web_search="disabled"');
  });
});
