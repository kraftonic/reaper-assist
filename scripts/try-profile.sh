#!/usr/bin/env bash
#
# Try a DAW profile in a throwaway REAPER, never your own.
#
#   bash scripts/try-profile.sh fl        # or ableton, logic, protools, cubase, studioone
#
# Creates a fresh REAPER settings folder under .reaper-test/try/, installs the profile into it
# exactly the way Assist does while REAPER is closed, and opens a separate REAPER instance on it
# (-newinst -cfgfile). Your own REAPER, its settings and any open project are not touched; the
# only thing read from your REAPER folder is the licence file, so no evaluation nag appears.
# Quit that REAPER when you're done. Delete .reaper-test/try/ whenever you like.
#
# NO_OPEN=1 only prepares the folder (prints its path) without starting REAPER.
set -euo pipefail

ID="${1:?usage: $0 <profile id: fl|ableton|logic|protools|cubase|studioone>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
[[ -d "$ROOT/src/profiles/$ID" && -f "$ROOT/src/profiles/$ID/profile.ts" ]] || { echo "No profile '$ID' in src/profiles/." >&2; exit 2; }

case "$(uname -s)" in
  Darwin)
    APP="${REAPER_APP:-/Applications/REAPER.app}"
    USER_RES="$HOME/Library/Application Support/REAPER"
    ;;
  Linux)
    REAPER_BIN="${REAPER_BIN:-$(command -v reaper || echo "$HOME/opt/REAPER/reaper")}"
    USER_RES="${XDG_CONFIG_HOME:-$HOME/.config}/REAPER"
    ;;
  *) echo "On Windows, start REAPER with -newinst -cfgfile <folder>\\reaper.ini yourself after running the vitest command below." >&2; exit 2 ;;
esac

mkdir -p "$ROOT/.reaper-test/try"
RES="$(mktemp -d "$ROOT/.reaper-test/try/res-$ID-XXXXXX")"
mkdir -p "$RES/ColorThemes" "$RES/Scripts"
printf '[reaper]\n' > "$RES/reaper.ini"
[[ -f "$USER_RES/reaper-reginfo2.ini" ]] && cp "$USER_RES/reaper-reginfo2.ini" "$RES/"

cd "$ROOT"
KA_PROFILE="$ID" KA_RES="$RES" npx vitest run -c vitest.reaper.config.mts test/profiles/profilePrep.itest.ts >/dev/null \
  || { echo "Installing the profile failed; run the command again without >/dev/null to see why:" >&2; echo "KA_PROFILE=$ID KA_RES=$RES npx vitest run -c vitest.reaper.config.mts test/profiles/profilePrep.itest.ts" >&2; exit 1; }

echo "$RES"
[[ -n "${NO_OPEN:-}" ]] && exit 0
if [[ "$(uname -s)" == Darwin ]]; then
  open -n -a "$APP" --args -newinst -nosplash -new -cfgfile "$RES/reaper.ini"
else
  "$REAPER_BIN" -newinst -nosplash -new -cfgfile "$RES/reaper.ini" >/dev/null 2>&1 &
fi
echo "Started a throwaway REAPER with the $ID profile. Quit it when you're done."
