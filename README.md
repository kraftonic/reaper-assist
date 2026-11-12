# REAPER Assist

An AI side panel for music producers. It docks next to REAPER, answers studio questions so you don't have to dig through manuals, edits your project when you ask, and can make REAPER look, feel and work like the DAW you're coming from.

Runs on **macOS, Windows and Linux**. Electron + React + TypeScript, MIT licensed. Status: early (v0.3); built and tested most on macOS, so Windows and Linux reports are very welcome.

## What it does

- **Chat that knows your session.** Ask in plain words ("tighten the drums in the chorus", "why is my vocal harsh?"). The assistant sees the live REAPER project (tracks, FX, sections, selection), can analyse audio, and edits through 65 checked commands, plus anything in REAPER's action list (show or hide the docker, toggle windows, zoom…). It can also find and add keyboard shortcuts. Every change is one undo step; recordings and media are never deleted.
- **Studio know-how.** Built-in skills on mixing, mastering, gain staging, recording vocals, sound design, arrangement, genre playbooks and more (`src/ai/skills/*.md`), loaded when a question needs them.
- **Paste screenshots.** Drop or paste images into the chat (a plug-in, an error, a mixer) with any provider that supports images.
- **Your own AI provider.** Claude, OpenAI, Gemini, OpenRouter, or local Ollama / LM Studio, with your own key. Keys are encrypted with the OS keychain and never leave the main process.
- **Permissions like a coding agent.** *Ask before changes*, *Auto low-risk* (default) or *Full auto*, plus per-action rules. Reading the project never asks.
- **Make REAPER feel like home.** Pick FL Studio, Ableton Live, Logic Pro, Pro Tools, Cubase or Studio One: REAPER gets that DAW's look (an original theme kit), shortcuts, mouse behaviour, toolbar, window layout and preferences, as far as REAPER allows. **Restore REAPER** undoes all of it, either to how your REAPER was or to REAPER's defaults.
- **Studio tab.** One-click genre beat templates (10 genres, one undo step, built from REAPER's own plug-ins) and a curated list of free plug-ins and sample sources.

DAW names only say who a profile is for. Profiles use no logos, product names in artwork, or copied images: all artwork is drawn in code.

## Install

You need [REAPER](https://www.reaper.fm) 7 or later (any licence, including the evaluation).

Download the installer for your system from the [latest release](https://github.com/kraftonic/reaper-assist/releases/latest):

| System | File | First start |
|---|---|---|
| macOS (Apple Silicon) | `REAPER-Assist-<version>-mac-arm64.dmg` | Drag it to Applications. The app isn't notarized yet, so macOS says it can't check it: right-click the app → **Open** → **Open** (or run `xattr -cr "/Applications/REAPER Assist.app"` once). |
| macOS (Intel) | `REAPER-Assist-<version>-mac-x64.dmg` | As above. |
| Windows 10/11 | `REAPER-Assist-<version>-win-x64.exe` | The installer isn't code-signed yet, so SmartScreen may warn: **More info** → **Run anyway**. |
| Linux (Debian, Ubuntu…) | `REAPER-Assist-<version>-linux-amd64.deb` | `sudo apt install ./REAPER-Assist-*.deb` |
| Linux (any) | `REAPER-Assist-<version>-linux-x86_64.AppImage` | `chmod +x REAPER-Assist-*.AppImage` and run it. On Ubuntu 24.04 and later, AppArmor may block it: use the `.deb`, or start it with `--no-sandbox`. |

Assist finds REAPER's folder on its own (`~/Library/Application Support/REAPER`, `%APPDATA%\REAPER`, `~/.config/REAPER`, or the Flatpak's). For a **portable REAPER**, set its folder in **Settings → DAW → REAPER folder**.

## Get started

In the panel: **Settings → AI** to add a provider key, **Settings → DAW** to install the REAPER bridge (a small Lua script REAPER runs on start-up), and **Settings → Look** to pick a DAW profile.

Show or hide the panel from any app with **⌘/Ctrl+Shift+Space** (on Linux under Wayland, global shortcuts may not be available; use the window as usual).

## Build from source

Needs [Node.js](https://nodejs.org) 22 or later.

```sh
git clone https://github.com/kraftonic/reaper-assist.git
cd reaper-assist
npm install
npm run dev        # the app, with hot reload
npm run check      # typecheck + unit tests + production build
npm run dist       # installers for this OS into dist/ (dist:mac, dist:win, dist:linux)
```

Pushing a tag like `v0.3.0` makes GitHub Actions build the installers for all three systems and attach them to a draft release (`.github/workflows/release.yml`).

## Repository map

| Area | Folder | What's there |
|---|---|---|
| AI | [`src/ai`](src/ai/README.md) | agent loop, system prompt, providers, skills, chat storage |
| REAPER | [`src/daw/reaper`](src/daw/reaper/README.md) | the Lua bridge and the typed commands the AI can run |
| DAW profiles | [`src/profiles`](src/profiles/README.md) | one folder per DAW (`fl/`, `ableton/`, …), the theme kit engine and the installer / Restore |
| Studio | [`src/studio`](src/studio/README.md) | genre templates, plug-in and sample-source catalog |
| UI | `src/renderer` | the React panel: `chat/`, `settings/`, `studio/` |
| App shell | `src/main`, `src/preload` | Electron start-up, window, IPC (one file per area in `src/main/ipc/`) |
| Docs | [`docs/`](docs) | [architecture](docs/architecture.md), [testing with a throwaway REAPER](docs/testing.md), [DAW research notes](docs/research) |

Want to help? Read [CONTRIBUTING.md](CONTRIBUTING.md). FL Studio fans can live in `src/profiles/fl/`, Logic users in `src/profiles/logic/`, producers who know their craft can improve the skills in `src/ai/skills/` without touching code.

## Using your Claude or ChatGPT subscription (personal use only)

Development builds can also chat through the **Claude Code** or **Codex** CLI you already have installed and signed in, instead of an API key. Assist runs `claude -p` / `codex exec` as a child process, locked down to chat plus Assist's REAPER tools (no files, shell, plug-ins or connectors; with *Web access* on, only the CLI's own web search and page reading are added; details in `src/ai/providers/cli.ts`).

These providers only appear in unpackaged builds or with `REAPER_ASSIST_PERSONAL_CLI=1`. Third-party products may not offer claude.ai login without Anthropic's approval, so anything you distribute must use API keys.

## Privacy

Assist has no servers and no telemetry. Chats, images and settings stay in your OS's app-data folder; your messages go only to the AI provider you pick. Project details are shared with the model only while REAPER is connected, and you can switch each kind off from the chat box.

## Licence

[MIT](LICENSE). Profile colours are matched by eye to each DAW, and all artwork is drawn in code; nothing is copied from the DAWs themselves. REAPER is a trademark of Cockos Incorporated; the other DAW names are trademarks of their owners. This project isn't affiliated with any of them.
