# The assistant (`src/ai`)

Everything that makes the chat work. Runs in Electron's main process (never in the panel), so API keys and REAPER access stay out of the web page.

| File | What it does |
|---|---|
| `agent.ts` | The agent loop: sends a turn, runs the tools the model asks for (with approvals), feeds results back, streams events to the panel. Also exposes the REAPER tools to the CLI providers. |
| `prompt.ts` | The system prompt (static, so it stays cached) and the per-message background (the user's old DAW, glossary). |
| `skills/` | Studio know-how as Markdown, plus the loader (`skills/index.ts`). |
| `providers/` | One client per provider family: `anthropic.ts` (Claude), `openai.ts` (OpenAI and every OpenAI-compatible API: Gemini, OpenRouter, Ollama, LM Studio), `cli.ts` (Claude Code / Codex, personal use only), `images.ts` (checks and re-encodes pasted images), `types.ts` (the `ChatSession` interface). |
| `web.ts` | The `readWebPage` tool for providers without their own web tools: fetches one public https page and returns its text, quoted as untrusted content. Refuses private and local addresses (checked on every DNS answer and redirect), with limits on time, size and type. |
| `chatIpc.ts`, `chatInput.ts` | What the panel can do with a chat (send, retry, edit, undo a change, context preview) and validation of its input. |
| `conversations.ts` | Chats and their images on disk. |
| `toolServer.ts`, `mcpServer.ts` | The loopback endpoint and stdio MCP server that let the CLI providers call Assist's REAPER tools. |

What the AI can do in REAPER is defined in [`src/daw/reaper/commands.ts`](../daw/reaper/README.md); the agent turns each command into a tool.

## Skills

A skill is one Markdown file in `skills/` that the model loads when a question needs it (only the index is in the system prompt). Front matter:

```markdown
---
title: Mixing basics
when: Balancing a mix: EQ, compression, … a mix that sounds muddy, harsh, thin or flat.
tools: analyzeAudio, getTrackDetails, addFx, setFxParameter
---
## Order of work
1. Balance with faders and pan only…
```

- `when` decides whether the model opens the skill: list the situations and the words producers actually use.
- `tools` (optional) names the REAPER commands the skill relies on.
- Write like a senior engineer explaining to a colleague: concrete numbers (Hz, dB, ms, LUFS), what to listen for, common mistakes. Keep it tight; every line costs tokens when loaded.
- Only write what you know to be true, in your own words. No copied text from books, courses or manuals.

`test/ai/skills.test.ts` checks every skill parses and only names real tools. Users can also type `/` in the chat box to pick a skill.

## Providers

To add a provider:

- **OpenAI-compatible API** (most are): add an entry to `PROVIDERS` in `src/shared/types.ts` with `kind: "openai"` and its base URL. Nothing else is usually needed.
- **A different API**: implement `ChatSession` (`providers/types.ts`): add user turns (text + images), run a turn with tools, take tool results, and serialize the native history so a chat can resume after a restart. Use `anthropic.ts` as the reference. Then add it to `makeSession` / `listModels` in `src/main/providers.ts`.
- Add unit tests to `test/ai/providers.test.ts` with a fake HTTP client. Tests must never call a paid API.

## Ground rules

- The model never gets a tool that runs arbitrary code, deletes media or reaches outside REAPER. The one exception is reading the public web, and only while *Web access* is on (Settings → AI).

## Web access

With *Web access* on (the default), each provider gets the best web tools it has:

- **Claude API**: Anthropic's server-side `web_search` and `web_fetch` tools (`_20260209` with dynamic filtering on Opus/Sonnet 4.6 and later, the basic versions on Haiku and 4.5 models), at most 5 searches and 5 fetches per reply. Searches are billed by Anthropic per search; the chat shows a note with the queries. Their result blocks stay in the saved history unchanged, so later turns (and restarts) still work.
- **OpenAI and OpenAI-compatible APIs** (Gemini, OpenRouter, Ollama, LM Studio): no search; `readWebPage` (`web.ts`) reads pages the user or the model names.
  An address that isn't already in the chat (typed by the user or returned by an earlier tool) needs the user's OK first, unless they chose *Full auto* or always allowed `readWebPage`; otherwise a page could get the model to leak chat details in a link.
- **Claude Code / Codex CLIs**: Claude Code's `WebSearch` and `WebFetch` tools (nothing else), Codex's web search.

Pages are always information, never instructions: the system prompt says so and `readWebPage` wraps the text in `<web_page>` markers.
- Anything that changes the project goes through the permission check in `agent.ts` and is one undo step.
- Project details only go to the model while REAPER is connected and the user hasn't switched them off.
