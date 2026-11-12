# Architecture

REAPER Assist is an Electron app with three processes and four feature areas.

```
┌──────────────── panel (src/renderer) ────────────────┐   sandboxed web page, React
│  chat/      settings/      studio/                   │   no Node, no keys, no files
└───────────────▲──────────────────────────────────────┘
                │ window.assist (src/preload: typed IPC, src/shared/types.ts)
┌───────────────┴──────── main process (src/main) ─────┐   wiring only:
│  index.ts  window.ts  providers.ts  reaperLink.ts    │   start-up, window, IPC handlers
│  profiles.ts  ipc/{settings,chat,reaper,studio}.ts   │   (one ipc file per area)
└──┬──────────────┬────────────────┬───────────────┬───┘
   │              │                │               │
 src/ai        src/daw/reaper   src/profiles    src/studio
 agent, prompt, bridge client,  DAW profiles,   templates,
 providers,     commands,       theme kit,      samples,
 skills, chats  context         install/restore plug-ins
                    │                │
                    ▼                ▼
            REAPER (Lua bridge)   REAPER's config files
            via JSON files        (reaper.ini, reaper-kb.ini, themes…)
```

## Areas

| Area | Alias | Runs in | Owns |
|---|---|---|---|
| `src/ai` | `@ai` | main | Talking to AI providers, the agent loop and approvals, skills, chat storage |
| `src/daw/reaper` | `@daw` | main + REAPER | The Lua bridge and every command the AI can run in REAPER |
| `src/profiles` | `@profiles` | main (+ renderer-safe parts) | DAW profiles: definitions, theme kits, installing into REAPER and Restore |
| `src/studio` | `@studio` | main (+ renderer-safe parts) | Genre templates, plug-in and sample-source catalog |
| `src/shared` | `@shared` | everywhere | The IPC contract (`types.ts`) and small shared helpers |
| `src/renderer` | — | panel | The UI |
| `src/main`, `src/preload` | — | main / preload | App shell |

Rules:

- Code inside an area imports its neighbours relatively; other areas through the alias.
- `src/main` holds no feature logic: if a handler grows beyond a few lines, the logic belongs in an area.
- The panel only imports renderer-safe modules (listed in CONTRIBUTING.md, enforced by `test/architecture.test.ts`).
- Areas don't import `src/main`.

## Two flows worth knowing

**A chat message.** The panel calls `chat:send` → `src/ai/chatIpc.ts` stores it → `agent.ts` builds the turn (system prompt + project context from `src/daw/reaper/context.ts` + the user's old DAW from the active profile) → the provider streams a reply → tool calls are validated against `src/daw/reaper/commands.ts`, checked against the permission mode, sent to REAPER through the bridge, and their results go back to the model. With *Web access* on, Claude's own search/fetch run on Anthropic's side, the CLIs use their own web tools, and the other providers get `readWebPage` (`src/ai/web.ts`). Each change is one REAPER undo step, so the panel can offer *Undo*.

**Applying a profile.** `look:apply` → `src/main/profiles.ts`: record REAPER's current settings once (`engine/restore.ts`, kept in Assist's data folder), build the theme from REAPER's Default 7 plus the profile's kit (`engine/theme.ts`, `kit/`), then write shortcuts, mouse map, toolbar, layout and preferences (`engine/install.ts`). REAPER rewrites its config when it quits, so with REAPER open only the theme switches live and the rest waits in `reaper-pending.json` until REAPER closes (or the user clicks *Quit REAPER and finish*). *Restore REAPER* runs the same path backwards.

## Where data lives

Assist's data folder (Electron `userData`): `settings.json` (keys encrypted with the OS keychain), `conversations/`, `reaper-original.json` (the restore record), `reaper-pending.json`. REAPER's folder: Assist only writes its own files (`Scripts/ReaperAssist/`, `ColorThemes/Assist - *`, `Data/toolbar_icons/assist_*`) and the specific settings a profile changes, with dated `.before-assist-*` backups.
