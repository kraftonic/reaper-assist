# Testing

```sh
npm run check          # typecheck + unit tests + build: what every PR must pass
npm test               # unit tests only (never touch REAPER)
npm run test:reaper    # integration tests against a throwaway REAPER (below)
```

## The one rule

**Never run experiments or integration tests against your own REAPER.** It may have unsaved work, and Assist's tests change settings, themes and projects. Every REAPER used for testing has its own settings folder (`-cfgfile`) and runs as a separate instance (`-newinst`). The scripts below do that for you.

## Trying a profile

```sh
bash scripts/try-profile.sh fl      # fl, ableton, logic, protools, cubase, studioone
```

This makes a fresh REAPER settings folder under `.reaper-test/try/`, installs the profile into it the same way Assist does, and opens a separate REAPER on it. Compare it side by side with the real DAW. Judge the look at 100 % scale with both a wide and a narrow track panel.

To check Restore on that folder:

```sh
KA_RESTORE=1 KA_RES=.reaper-test/try/res-fl-XXXXXX npx vitest run -c vitest.reaper.config.mts test/profiles/profilePrep.itest.ts
```

## Integration tests

```sh
bash scripts/reaper-test-instance.sh start     # isolated REAPER + bridge in .reaper-test/
export REAPER_ASSIST_BRIDGE_DIR="$PWD/.reaper-test/bridge"
npm run test:reaper
bash scripts/reaper-test-instance.sh stop
```

The test instance copies only your audio settings and licence file from your REAPER folder; it never writes there. Integration tests refuse to run unless the bridge folder is inside `.reaper-test`.

Some suites are opt-in because they're slow or use your accounts:

| Variable | Suite |
|---|---|
| `KA_LOOK_SMOKE=1` | `test/profiles/look.itest.ts`: every profile in a throwaway REAPER (theme + every shortcut) |
| `KA_CLI_SMOKE=1` | `test/ai/cli.itest.ts`: a few small prompts through *your* Claude Code and Codex logins |

No test may call a paid AI API. Provider tests use fake HTTP clients.

## Screenshots of the panel

```sh
bash scripts/shot.sh settings-look /tmp/look.png "$(mktemp -d)"
```

Runs the app with a throwaway home folder and data folder, so it can't reach your REAPER or your keys. Views: `chat`, `settings-look`, `settings-ai`, `studio-beats`, …
