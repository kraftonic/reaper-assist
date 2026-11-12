# DAW profiles

A profile makes REAPER look, feel and work like another DAW, for people switching to REAPER. Applying one changes REAPER's theme, shortcuts, mouse behaviour, toolbar, window layout and a few preferences. **Restore REAPER** puts all of it back.

```
src/profiles/
  index.ts          the list of profiles (WORKFLOWS) + reaper-kb.ini line helpers      renderer-safe
  types.ts          what a profile can contain (Workflow, Shortcut, MouseMod, Pref, …)  renderer-safe
  keys.ts           how REAPER stores key combos per OS                                  renderer-safe
  skins.ts          profile colours → REAPER theme colours                               renderer-safe
  <daw>/            one folder per DAW: fl, ableton, logic, protools, cubase, studioone
    profile.ts        shortcuts, mouse, toolbar, layout, prefs, colours, glossary        renderer-safe
    kit.ts            the theme kit: palette, sizes, WALTER layout, artwork choices      main only
    scripts/*.lua     REAPER scripts for behaviour REAPER doesn't have built in
    profile.test.ts   checks for this profile
    README.md         status, what can't be done in REAPER, where to start
  kit/              the shared theme engine: drawing (art, icons, raster), WALTER layout, registry
  engine/           writes REAPER's files: install, restore, theme zip, window layout
```

"Renderer-safe" files are also loaded by the panel, so they must not import Node, Electron, `kit/` or `engine/` (enforced by `test/architecture.test.ts`).

Research behind each profile is in [`docs/research/<daw>.md`](../../docs/research), and how REAPER's config files work in [`docs/research/reaper-mechanics.md`](../../docs/research/reaper-mechanics.md).

## Working on an existing profile

Everything for one DAW is in its folder, so you can usually stay there.

- **Shortcuts** (`profile.ts`, `shortcuts`): `{ mods, key, action, does, section? }`. `action` is a REAPER action id (a number, or a `_SWS…`/`_RS…` string), checked against REAPER's action list (*Actions → Show action list*). `section` is `main` (default), `midi`, `explorer`, …
- **Mouse** (`mouse`): a REAPER mouse-modifier context (`MM_CTX_…`), the modifier keys, and the behaviour as REAPER stores it in `reaper-mouse.ini` (e.g. `"16 m"`, or an action id such as `"_RS_assist_fl_place_pattern"`). Set the behaviour once in *Preferences → Mouse modifiers* in a throwaway REAPER and read the value back from its `reaper-mouse.ini`.
- **Toolbar** (`toolbars`): buttons with an action and an icon. Icons are drawn in code (`kit.ts` → `toolbarGlyphs`).
- **Layout** (`layout`): transport top or bottom, track headers left or right, docked browser / mixer / MIDI editor.
- **Preferences** (`prefs`): `reaper.ini` keys, and for bit-field keys only the bits you set (`bits`). Every bit-field key needs an entry in `REAPER_DEFAULTS` (`engine/files.ts`) so Restore can put it back.
- **Scripts** (`scripts/` + `scripts:` in `profile.ts`): Lua for behaviour REAPER lacks (tool modes, Pro Tools edit modes, …). Name files `<daw>_<what>.lua`, register them with an id `RS_assist_<daw>_<what>`, and use REAPER's native API only. Helpers that aren't actions themselves (e.g. `protools_lib.lua`) are copied too.
- **Look** (`kit.ts`): the palette, element sizes, fonts and the WALTER layout of track headers, mixer strips and transport. Shared drawing code is in `kit/`; prefer adding an option there over copying code into a kit.
- **Glossary** (`glossary`): pairs of "their word" → "REAPER's word". The AI uses it to talk like the user's old DAW.

Then:

```sh
npx vitest run src/profiles/fl      # this profile's checks
npm test                            # everything, including install + Restore for every profile
```

To see it for real, install the profile into a **throwaway REAPER** (never your own): [docs/testing.md](../../docs/testing.md#trying-a-profile).

## The theme kit

A kit is an original REAPER theme drawn in code: `kit/walter.ts` writes the `rtconfig.txt` layout (REAPER's WALTER language) and `kit/art.ts` draws every button, knob, fader and meter at 100, 150 and 200 % scale. The result is built on the user's machine on top of REAPER's own Default 7 theme (which we never ship) and saved as `ColorThemes/Assist - <DAW> feel.ReaperThemeZip`.

Changes to shared kit code change every DAW's look. `test/profiles/kitSnapshot.test.ts` pins a digest of the generated files for two reference kits (`test/fixtures/kit-ref/`), so such changes are deliberate: update the pins in the same commit and say why.

What a theme can't do: add new windows, change menus and dialogs, or change how REAPER behaves. For those, see the "Can't be done in REAPER" list in each DAW's README.

## Adding a profile

1. Copy the closest DAW folder to `src/profiles/<id>/` (lowercase id, no spaces).
2. Add the id to `WorkflowId` in `types.ts`, then register the profile in `index.ts` (`WORKFLOWS`) and its kit in `kit/registry.ts` (`KITS`).
3. Rename the scripts (`<id>_*.lua`) and their `RS_assist_<id>_…` ids.
4. Write `docs/research/<id>.md` with the facts you used (shortcut list, colours, layout, behaviours) and their sources.
5. Run `npm test`: the shared tests install and restore every registered profile.
6. Add a `README.md` like the others.

## Rules for profiles

- No logos, product names in artwork, screenshots, skins or images from the DAW or third-party REAPER themes. Match colours, sizes and behaviour; draw everything.
- Everything a profile changes must be undone by Restore REAPER. If you add a new kind of change, extend `engine/restore.ts` and its tests.
- Prefer REAPER's own actions. Only write a script when no action or mouse behaviour does the job.
