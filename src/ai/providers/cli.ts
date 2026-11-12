import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { promisify } from "node:util";
import type { ImageMime } from "@shared/types";
import { ProviderError } from "./types";

/**
 * PERSONAL USE ONLY. Runs the user's own installed Claude Code or Codex CLI,
 * signed in with their own subscription, the way the IDE extensions do.
 * Anthropic does not allow third-party products to offer claude.ai login
 * without approval, so this is only available in unpackaged (dev) builds or
 * with REAPER_ASSIST_PERSONAL_CLI=1. See README → "Your own subscription".
 *
 * Both CLIs are coding agents, so they are locked down to chat plus Assist's
 * REAPER tools: no built-in file, shell or browser tools, an empty working
 * folder, and none of the user's own MCP servers or settings. With Web access
 * on (Settings → AI) each gets its own web search and page reading, and
 * nothing else: Claude Code's WebSearch and WebFetch tools, Codex's web search.
 */

const run = promisify(execFile);

export type CliKind = "claude-cli" | "codex-cli";

export interface McpLaunch {
  command: string;
  args: string[];
  env: Record<string, string>;
}

export interface CliRunOptions {
  prompt: string;
  system: string;
  model: string;
  /** Resume this CLI session; null starts a new one. */
  sessionId: string | null;
  mcp: McpLaunch | null;
  cwd: string;
  onText: (delta: string) => void;
  signal: AbortSignal;
  /** Images attached to this message (files stored with the chat). */
  images?: { path: string; mime: ImageMime }[];
  /** Web access is on: allow the CLI's own web search and page reading (nothing else). */
  web?: boolean;
}

export interface CliStatus {
  installed: boolean;
  loggedIn: boolean;
  detail: string;
  path?: string;
}

const binCache = new Map<string, string | null>();

/** Tests point the runners at a fake CLI. */
export function setCliBinary(name: "claude" | "codex", path: string | null): void {
  if (path) binCache.set(name, path);
  else binCache.delete(name);
}

/**
 * Pick from `where` output on Windows: a real .exe first (the native installers), otherwise none. An npm
 * .cmd shim can't be started without cmd.exe, which would mangle the JSON arguments Assist passes.
 */
export function pickWindowsBin(whereOutput: string): string | null {
  const hits = whereOutput.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return hits.find((h) => /\.exe$/i.test(h)) ?? null;
}

/** Find a CLI the way the user's terminal would (apps started from Finder get a bare PATH). */
async function findBin(name: string): Promise<string | null> {
  if (binCache.has(name)) return binCache.get(name)!;
  let found: string | null = null;
  try {
    if (process.platform === "win32") {
      const { stdout } = await run("where.exe", [name], { timeout: 8000 });
      found = pickWindowsBin(stdout);
    } else {
      const shell = process.env.SHELL || "/bin/sh";
      const { stdout } = await run(shell, ["-lc", `command -v ${name}`], { timeout: 8000 });
      found = stdout.trim().split(/\r?\n/).pop() || null;
    }
  } catch {
    found = null;
  }
  binCache.set(name, found);
  return found;
}

/** Environment for the CLI: never pass API keys, so it uses the subscription login. */
function cliEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, ...extra };
  for (const k of Object.keys(env)) {
    if (/^(ANTHROPIC_API_KEY|ANTHROPIC_AUTH_TOKEN|OPENAI_API_KEY|CODEX_API_KEY|CLAUDECODE|CLAUDE_CODE_.*|ELECTRON_RUN_AS_NODE)$/.test(k)) delete env[k];
  }
  return env;
}

export async function cliStatus(kind: CliKind): Promise<CliStatus> {
  const name = kind === "claude-cli" ? "claude" : "codex";
  const path = await findBin(name);
  if (!path)
    return {
      installed: false,
      loggedIn: false,
      detail: process.platform === "win32" ? `${name}.exe wasn't found on PATH (an npm-installed .cmd can't be used; install the native ${name} for Windows).` : `${name} isn't installed (or isn't on your shell's PATH).`,
    };
  try {
    if (kind === "claude-cli") {
      const { stdout } = await run(path, ["auth", "status"], { timeout: 15000, env: cliEnv() });
      const s = JSON.parse(stdout) as { loggedIn?: boolean; authMethod?: string };
      if (!s.loggedIn) return { installed: true, loggedIn: false, path, detail: "Not signed in. Run `claude` in a terminal and log in." };
      if (s.authMethod !== "claude.ai") return { installed: true, loggedIn: true, path, detail: `Signed in with ${s.authMethod}, not a Claude subscription. Usage may be billed to that account.` };
      return { installed: true, loggedIn: true, path, detail: "Signed in with your Claude subscription." };
    }
    const { stdout, stderr } = await run(path, ["login", "status"], { timeout: 15000, env: cliEnv() });
    const text = `${stdout}${stderr}`.trim();
    const ok = /logged in/i.test(text);
    return { installed: true, loggedIn: ok, path, detail: ok ? `${text}.` : "Not signed in. Run `codex login` in a terminal." };
  } catch (e) {
    return { installed: true, loggedIn: false, path, detail: `Couldn't check the login: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}` };
  }
}

export const CLI_MODELS: Record<CliKind, string[]> = {
  "claude-cli": ["default", "opus", "sonnet", "haiku"],
  "codex-cli": ["default"],
};

/* ----------------------------------------------------------- process I/O */

function spawnLines(
  bin: string,
  args: string[],
  opts: { cwd: string; env: NodeJS.ProcessEnv; stdin: string; signal: AbortSignal; holdStdin?: boolean },
  onLine: (obj: Record<string, unknown>, endInput: () => void) => void,
): Promise<{ code: number | null; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd: opts.cwd, env: opts.env, stdio: ["pipe", "pipe", "pipe"] });
    let buf = "";
    let stderr = "";
    // On Windows the CLI's own children would outlive a plain kill.
    const kill = () =>
      process.platform === "win32" && child.pid
        ? void spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" }).on("error", () => undefined)
        : child.kill("SIGTERM");
    const endInput = () => {
      if (!child.stdin.writableEnded) child.stdin.end();
    };
    opts.signal.addEventListener("abort", kill, { once: true });
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (d: string) => {
      buf += d;
      let i: number;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line.startsWith("{")) continue;
        let obj: Record<string, unknown>;
        try {
          obj = JSON.parse(line) as Record<string, unknown>;
        } catch {
          continue; // not JSON
        }
        onLine(obj, endInput);
      }
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (d: string) => (stderr = (stderr + d).slice(-4000)));
    child.stdin.on("error", () => undefined); // the CLI quit before reading everything; its exit code says why
    child.on("error", reject);
    child.on("close", (code) => {
      opts.signal.removeEventListener("abort", kill);
      resolve({ code, stderr });
    });
    // Streaming input stays open until the CLI reports a result, the way its SDK drives it.
    if (opts.holdStdin) child.stdin.write(opts.stdin);
    else child.stdin.end(opts.stdin);
  });
}

/* ------------------------------------------------------------ Claude Code */

/**
 * Claude Code has no image flag. With images, the turn goes in as one stream-json user message
 * (`--input-format stream-json`) whose content is image blocks followed by the text.
 */
export function claudeInput(o: Pick<CliRunOptions, "prompt" | "images">): { format: "text" | "stream-json"; stdin: string } {
  if (!o.images?.length) return { format: "text", stdin: o.prompt };
  const content = [
    ...o.images.map((img) => ({ type: "image", source: { type: "base64", media_type: img.mime, data: readFileSync(img.path).toString("base64") } })),
    { type: "text", text: o.prompt || "(image)" },
  ];
  return { format: "stream-json", stdin: `${JSON.stringify({ type: "user", message: { role: "user", content } })}\n` };
}

/** Claude Code's only built-in tools Assist ever allows, and only with Web access on. */
export const CLAUDE_WEB_TOOLS = ["WebSearch", "WebFetch"];

/** Command line for `claude -p`. Exported for tests. */
export function claudeCliArgs(o: Pick<CliRunOptions, "system" | "model" | "sessionId" | "mcp" | "web">, sessionId: string, inputFormat: "text" | "stream-json"): string[] {
  const web = o.web ? CLAUDE_WEB_TOOLS : [];
  const args = [
    "-p",
    "--output-format", "stream-json",
    ...(inputFormat === "stream-json" ? ["--input-format", "stream-json"] : []),
    "--verbose",
    "--include-partial-messages",
    // Built-in tools: none, or with Web access only web search and page reading. Never files or shell.
    "--tools", web.join(","),
    "--strict-mcp-config", // ignore the user's own MCP servers
    "--setting-sources", "", // ignore user/project settings, hooks and CLAUDE.md
    "--system-prompt", o.system,
    ...(o.sessionId ? ["--resume", o.sessionId] : ["--session-id", sessionId]),
    ...(o.model && o.model !== "default" ? ["--model", o.model] : []),
  ];
  if (o.mcp) args.push("--mcp-config", JSON.stringify({ mcpServers: { reaper: { type: "stdio", ...o.mcp } } }));
  // Pre-approved, since a -p run can't ask: Assist's own tools (approvals happen in the panel) and the web tools.
  const allowed = [...(o.mcp ? ["mcp__reaper"] : []), ...web];
  if (allowed.length) args.push("--allowedTools", allowed.join(","));
  return args;
}

export async function runClaudeCli(o: CliRunOptions): Promise<{ sessionId: string }> {
  const bin = await findBin("claude");
  if (!bin) throw new ProviderError("Claude Code isn't installed. Install it from claude.com/code, sign in, then try again.");
  mkdirSync(o.cwd, { recursive: true });
  const sessionId = o.sessionId ?? randomUUID();
  const input = claudeInput(o);
  const args = claudeCliArgs(o, sessionId, input.format);

  let error: string | null = null;
  let gotDelta = false;
  let wroteText = false;
  const opts = { cwd: o.cwd, env: cliEnv({ MCP_TOOL_TIMEOUT: "900000" }), stdin: input.stdin, signal: o.signal, holdStdin: input.format === "stream-json" };
  const { code, stderr } = await spawnLines(bin, args, opts, (m, endInput) => {
    if (m.type === "result") endInput();
    if (m.type === "stream_event") {
      const ev = m.event as { type?: string; delta?: { type?: string; text?: string } };
      if (ev.type === "message_start") {
        gotDelta = false;
        if (wroteText) o.onText("\n\n");
      }
      if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta" && ev.delta.text) {
        gotDelta = true;
        wroteText = true;
        o.onText(ev.delta.text);
      }
    } else if (m.type === "assistant" && !gotDelta) {
      // Older CLIs without partial messages: take the text from the full message.
      const content = ((m.message as { content?: { type: string; text?: string }[] })?.content ?? []).filter((b) => b.type === "text" && b.text);
      for (const b of content) {
        o.onText(b.text!);
        wroteText = true;
      }
    } else if (m.type === "result" && m.is_error) {
      error = typeof m.result === "string" && m.result ? m.result : String(m.subtype ?? "error");
    }
  });
  if (o.signal.aborted) throw new Error("aborted");
  if (error) throw new ProviderError(`Claude Code: ${error}`);
  if (code !== 0) throw new ProviderError(`Claude Code stopped unexpectedly. ${lastLine(stderr)}`);
  return { sessionId };
}

/* ------------------------------------------------------------------ Codex */

/** Codex features that would give it reach beyond chat + REAPER. Checked against codex-cli 0.164. */
export const CODEX_DISABLED = [
  "shell_tool", "unified_exec", "computer_use", "browser_use", "browser_use_external", "in_app_browser",
  "apps", "plugins", "remote_plugin", "view_image", "image_generation", "multi_agent", "goals", "sleep_tool",
  "tool_suggest", "skill_search", "skill_mcp_dependency_install", "hooks",
];

const toml = (s: string) => JSON.stringify(s); // JSON strings are valid TOML basic strings

/**
 * `codex exec -i <file>` (and `exec resume -i`). The flag takes several comma-separated files, so
 * each path is given relative to the working folder; a path that would still contain a comma is
 * copied in first.
 */
export function codexImageArgs(images: CliRunOptions["images"], cwd: string): string[] {
  const out: string[] = [];
  for (const img of images ?? []) {
    let p = relative(cwd, img.path);
    if (p.includes(",")) {
      const dir = join(cwd, "images");
      mkdirSync(dir, { recursive: true });
      const copy = join(dir, basename(img.path).replace(/,/g, "_"));
      copyFileSync(img.path, copy);
      p = relative(cwd, copy);
    }
    out.push("-i", p);
  }
  return out;
}

/** Command line for `codex exec` (or `exec resume`). `images` are the -i flags. Exported for tests. */
export function codexCliArgs(o: Pick<CliRunOptions, "model" | "sessionId" | "mcp" | "web" | "cwd">, images: string[]): string[] {
  const mcpTable = o.mcp
    ? `{reaper={command=${toml(o.mcp.command)},args=[${o.mcp.args.map(toml).join(",")}],env={${Object.entries(o.mcp.env).map(([k, v]) => `${k}=${toml(v)}`).join(",")}},tool_timeout_sec=900,default_tools_approval_mode="approve"}}`
    : "{}";
  const common = [
    ...images,
    "--json",
    "--skip-git-repo-check",
    // Leave out the user's own config.toml: their plugins, connectors (GitHub, Notion, …), MCP servers and hooks.
    "--ignore-user-config",
    "--ignore-rules",
    "-c", 'approval_policy="never"',
    "-c", 'sandbox_mode="read-only"',
    // Codex's own web search only with Web access on; it reads pages but can't touch files or run commands.
    "-c", o.web ? 'web_search="live"' : 'web_search="disabled"',
    // Assist's tools only. Approval for them happens in Assist's panel, so Codex itself auto-approves.
    "-c", `mcp_servers=${mcpTable}`,
    // Codex's code mode (functions.exec) stays on: it is how Codex calls MCP tools, and it can't import fs or run commands.
    ...CODEX_DISABLED.flatMap((f) => ["--disable", f]),
    ...(o.model && o.model !== "default" ? ["-m", o.model] : []),
  ];
  return o.sessionId ? ["exec", "resume", ...common, o.sessionId, "-"] : ["exec", ...common, "-C", o.cwd, "-"];
}

export async function runCodexCli(o: CliRunOptions): Promise<{ sessionId: string }> {
  const bin = await findBin("codex");
  if (!bin) throw new ProviderError("Codex isn't installed. Install it (npm i -g @openai/codex), run `codex login`, then try again.");
  mkdirSync(o.cwd, { recursive: true });
  // Before --json, so the image list ends at a flag and never swallows the "-" (prompt on stdin).
  const args = codexCliArgs(o, codexImageArgs(o.images, o.cwd));
  const prompt = o.sessionId ? o.prompt : `${o.system}\n\n---\n\n${o.prompt}`;

  let threadId = o.sessionId ?? "";
  let error: string | null = null;
  const seen = new Map<string, string>();
  let wroteText = false;
  const { code, stderr } = await spawnLines(bin, args, { cwd: o.cwd, env: cliEnv(), stdin: prompt, signal: o.signal }, (m) => {
    if (m.type === "thread.started" && typeof m.thread_id === "string") threadId = m.thread_id;
    if ((m.type === "item.updated" || m.type === "item.completed") && m.item) {
      const it = m.item as { id?: string; type?: string; text?: string };
      if (it.type === "agent_message" && typeof it.text === "string") {
        const id = it.id ?? "msg";
        const before = seen.get(id);
        if (before === undefined && wroteText) o.onText("\n\n");
        const prev = before ?? "";
        if (it.text.startsWith(prev) && it.text.length > prev.length) o.onText(it.text.slice(prev.length));
        seen.set(id, it.text);
        wroteText = true;
      }
    }
    if (m.type === "turn.failed") error = ((m.error as { message?: string }) ?? {}).message ?? "turn failed";
    if (m.type === "error" && typeof m.message === "string") error = m.message;
  });
  if (o.signal.aborted) throw new Error("aborted");
  if (error) throw new ProviderError(`Codex: ${error}`);
  if (code !== 0) throw new ProviderError(`Codex stopped unexpectedly. ${lastLine(stderr)}`);
  if (!threadId) throw new ProviderError("Codex didn't report a session id.");
  return { sessionId: threadId };
}

function lastLine(s: string): string {
  return s.trim().split("\n").filter(Boolean).slice(-2).join(" ").slice(0, 300);
}
