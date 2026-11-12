#!/usr/bin/env bash
# Dev helper: capture the panel. Usage: scripts/shot.sh <view|chat> <out.png> <userDataDir>
# Runs with a throwaway HOME, so the app can't reach your real REAPER folder or its bridge
# (Assist derives both from HOME), and stops Electron itself afterwards (not just an npx wrapper).
set -euo pipefail
VIEW="${1:?view}"; OUT="${2:?out}"; UD="${3:?userdata}"
[ "$VIEW" = chat ] && VIEW=""
[ -f "$OUT" ] && mv "$OUT" "$OUT.old"
cd "$(dirname "$0")/.."
ELECTRON=$(node -p 'require("electron")')
SHOT_HOME=$(mktemp -d "${TMPDIR:-/tmp}/ka-shot-home-XXXXXX")
HOME="$SHOT_HOME" KA_VIEW="$VIEW" KA_USER_DATA="$UD" KA_SCREENSHOT="$OUT" "$ELECTRON" . >/dev/null 2>&1 &
P=$!
for _ in $(seq 1 30); do [ -f "$OUT" ] && break; sleep 1; done
kill "$P" 2>/dev/null || true
for _ in $(seq 1 10); do kill -0 "$P" 2>/dev/null || break; sleep 0.5; done
kill -9 "$P" 2>/dev/null || true
[ -f "$OUT" ] && echo "saved $OUT"
