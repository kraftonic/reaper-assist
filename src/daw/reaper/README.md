# REAPER connection (`src/daw/reaper`)

How Assist reads and changes the REAPER project.

```
Assist (main process)                         REAPER
  commands.ts  ── validated request ──►  bridge/assist_bridge.lua
  reaper.ts    ◄── JSON response ─────      (runs inside REAPER, deferred loop)
        transport.ts: JSON files in a shared folder
```

REAPER's Lua has no sockets, so the two sides talk through JSON files in a bridge folder (`transport.ts` explains the race-free claim / cancel scheme). The bridge runs from REAPER's `Scripts/__startup.lua`, installed by *Settings → DAW → Install* (`install.ts`).

| File | What it does |
|---|---|
| `bridge/assist_bridge.lua` | The bridge: a handler `H.<command>` per command, plus theme / layout / quit helpers. Bump `BRIDGE_VERSION` when you change it; Assist tells the user when REAPER runs an older copy. |
| `commands.ts` | Every command the AI may run: summary, Zod schema for its arguments (strict), risk level, timeout. |
| `reaper.ts` | `ReaperConnection`: runs commands, batches, undo, theme loading, project state. |
| `context.ts`, `analysis.ts` | The project summary sent with each message, and analysis in words a producer understands: key and groove of MIDI, levels and frequency balance of audio, recording headroom and latency. |
| `install.ts` | Installs the bridge and its start-up block. |

Beyond the dedicated commands, `findActions` / `runAction` reach REAPER's whole action list (with a short blocklist: quitting, closing projects, deleting files), and `assignShortcut` opens REAPER's own shortcut window, since REAPER has no call to set a key directly.
| `process.ts` | Is REAPER running; start it again. |

## Adding a command

1. Add a handler `H.myCommand = function(a) … end` to the bridge. Validate `a` again in Lua, wrap changes in one undo block, and return `verified(ok, data, observed, message)`. Bump `BRIDGE_VERSION`.
2. Add `myCommand: cmd({ summary, args: z.strictObject({…}), risk, timeoutMs })` to `COMMANDS` in `commands.ts`. The summary is what the model reads: say what it does and when to use it.
3. Pick the risk honestly: `read` (never asks), `safe`, `caution` or `destructive`; set `alwaysConfirm` when it changes existing material.
4. Unit-test the schema and the agent wiring (`test/ai/editing.test.ts`), and add an integration test against a throwaway REAPER (`test/daw/*.itest.ts`, see [docs/testing.md](../../../docs/testing.md)).

Never add a command that runs arbitrary Lua, deletes media files or takes, or touches files outside REAPER's folders.
