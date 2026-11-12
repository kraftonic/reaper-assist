# Contributing to REAPER Assist

Thanks for helping. You don't need to know the whole app: it's split into areas, and most changes stay inside one of them.

## Find your area

| You want to… | Work in | Start with |
|---|---|---|
| Make REAPER feel more like FL Studio, Ableton, Logic, Pro Tools, Cubase or Studio One | `src/profiles/<daw>/` | [src/profiles/README.md](src/profiles/README.md), then that DAW's `README.md` |
| Add a DAW profile (Bitwig, Reason, …) | `src/profiles/<new-id>/` | [Adding a profile](src/profiles/README.md#adding-a-profile) |
| Improve the shared theme drawing (knobs, faders, meters, WALTER layout) | `src/profiles/kit/` | [src/profiles/README.md](src/profiles/README.md#the-theme-kit) |
| Teach the AI studio know-how (mixing, recording, genres…) | `src/ai/skills/*.md` | [src/ai/README.md](src/ai/README.md#skills): Markdown only, no code |
| Improve how the AI thinks, its prompt or tools | `src/ai/` | [src/ai/README.md](src/ai/README.md) |
| Add an AI provider | `src/ai/providers/` | [src/ai/README.md](src/ai/README.md#providers) |
| Let the AI do something new in REAPER | `src/daw/reaper/` | [src/daw/reaper/README.md](src/daw/reaper/README.md) |
| Templates, samples, plug-in lists | `src/studio/` | [src/studio/README.md](src/studio/README.md) |
| The panel's UI | `src/renderer/src/` (`chat/`, `settings/`, `studio/`) | [docs/architecture.md](docs/architecture.md) |

## Set up

```sh
npm install
npm run dev     # run the app with hot reload
npm run check   # what every pull request must pass: typecheck + unit tests + build
```

You need Node 22+ and, for anything REAPER-related, REAPER 7 installed.

## Ground rules

1. **Never test against your own REAPER.** Integration tests and experiments run in a throwaway REAPER with its own config folder: [docs/testing.md](docs/testing.md). Unit tests never touch REAPER at all.
2. **Everything Assist changes in REAPER must be undoable.** Profile changes go through the installer and must be covered by *Restore REAPER* (`src/profiles/engine/restore.ts`). AI edits are single undo steps. No command deletes media or takes.
3. **No copied artwork or trade dress.** Profiles match colours, sizes, layout and behaviour; artwork is drawn in code. Don't add logos, screenshots, skins or images taken from another DAW or from third-party REAPER themes (even freely downloadable ones are reference only unless their licence says otherwise). DAW names may only say who a profile is for.
4. **Facts need a source.** REAPER action ids, ini keys and DAW shortcuts should be checked (REAPER's action list, the DAW's manual) and, where useful, noted in `docs/research/<daw>.md`.
5. **User-facing text is plain English.** Short sentences, no jargon a producer wouldn't use.

## How the code is organised

- Each area has an import alias: `@ai`, `@daw`, `@profiles`, `@studio`, `@shared`. Inside an area use relative imports; across areas use the alias.
- The panel (`src/renderer`) is a sandboxed web page. It may only import the *renderer-safe* modules: `@shared/types`, `@shared/images`, `@profiles` (and `types`, `keys`, `skins`, `<id>/profile`), `@studio/genres`, `@studio/catalog`. Those modules must not import Node, Electron, the theme kit or the installer. `test/architecture.test.ts` enforces this.
- The main process only wires things together (`src/main/`); logic belongs in an area.

More in [docs/architecture.md](docs/architecture.md).

## Tests

- Unit tests: `npm test`. They live in `test/<area>/` and, for DAW profiles, next to the profile (`src/profiles/<daw>/profile.test.ts`).
- REAPER integration tests (`*.itest.ts`): `npm run test:reaper` against a throwaway REAPER, see [docs/testing.md](docs/testing.md).
- Add a test with every behaviour change. For profiles, at least: every action/script the profile references exists, and Restore leaves nothing behind (the shared tests in `test/profiles/` cover the latter for every registered profile).

## Pull requests

- One topic per PR; keep unrelated formatting out.
- Fill in the PR template: what changed, how you checked it, screenshots for anything visual (taken in a throwaway REAPER, at 100 % scale).
- `npm run check` must pass.
- By contributing you agree that your contribution is licensed under the [MIT licence](LICENSE).

## Code style

TypeScript strict mode, 2-space indent, double quotes (see `.editorconfig`). Prefer small pure functions that can be unit-tested, and comments that say *why*. Lua scripts use REAPER's native API only (no extensions required) unless a profile documents otherwise.

## Conduct and security

Be kind: see [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Report security problems privately as described in [SECURITY.md](SECURITY.md), not in public issues.
