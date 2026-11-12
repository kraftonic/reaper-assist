#!/usr/bin/env bash
#
# Starts (or stops) an ISOLATED REAPER instance for integration tests.
#
#   bash scripts/reaper-test-instance.sh start   # new instance, fresh saved project, bridge running
#   bash scripts/reaper-test-instance.sh stop
#   bash scripts/reaper-test-instance.sh status
#
# Isolation:
#   * -newinst: never talks to a REAPER you already have open.
#   * -cfgfile: its own resource folder in .reaper-test/resource (seeded once from
#     your REAPER's reaper.ini so the audio device matches, and your licence file so
#     no evaluation dialog blocks the run). Your own REAPER folder is never written.
#   * Its own bridge directory (.reaper-test/bridge) via REAPER_ASSIST_BRIDGE_DIR, so
#     the tests can never reach a project you are working on.
#   * A fresh project saved in .reaper-test/projects; test recordings land there.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEST_DIR="${REAPER_ASSIST_REAPER_TEST_DIR:-$ROOT/.reaper-test}"
RES="$TEST_DIR/resource"
BRIDGE_DIR="$TEST_DIR/bridge"
PID_FILE="$TEST_DIR/reaper.pid"
BRIDGE_LUA="$ROOT/src/daw/reaper/bridge/assist_bridge.lua"

case "$(uname -s)" in
  Darwin)
    REAPER_BIN="${REAPER_BIN:-/Applications/REAPER.app/Contents/MacOS/REAPER}"
    USER_RES="$HOME/Library/Application Support/REAPER"
    ;;
  Linux)
    REAPER_BIN="${REAPER_BIN:-$(command -v reaper || echo "$HOME/opt/REAPER/reaper")}"
    USER_RES="${XDG_CONFIG_HOME:-$HOME/.config}/REAPER"
    ;;
  *)
    echo "Unsupported platform for this script; start REAPER manually with -newinst -cfgfile." >&2
    exit 2
    ;;
esac

running_pid() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid="$(cat "$PID_FILE")"
    if kill -0 "$pid" 2>/dev/null && ps -p "$pid" -o command= | grep -q -- "-cfgfile $RES/reaper.ini"; then
      echo "$pid"
      return 0
    fi
  fi
  return 1
}

cmd="${1:-start}"
case "$cmd" in
  start)
    if pid="$(running_pid)"; then
      echo "Test REAPER already running (pid $pid). Bridge: $BRIDGE_DIR"
      exit 0
    fi
    [[ -x "$REAPER_BIN" ]] || { echo "REAPER not found at $REAPER_BIN (set REAPER_BIN)" >&2; exit 2; }
    mkdir -p "$RES" "$BRIDGE_DIR" "$TEST_DIR/projects"
    if [[ ! -f "$RES/reaper.ini" ]]; then
      if [[ -f "$USER_RES/reaper.ini" ]]; then cp "$USER_RES/reaper.ini" "$RES/reaper.ini"; else : > "$RES/reaper.ini"; fi
    fi
    if [[ ! -f "$RES/reaper-reginfo2.ini" && -f "$USER_RES/reaper-reginfo2.ini" ]]; then
      cp "$USER_RES/reaper-reginfo2.ini" "$RES/reaper-reginfo2.ini"
    fi
    # Old messages from a previous run must not be picked up.
    rm -rf "$BRIDGE_DIR"/{inbox,outbox,processing,tmp,events} "$BRIDGE_DIR/status.json"
    PROJECT="$TEST_DIR/projects/itest-$(date +%Y%m%d-%H%M%S).rpp"
    REAPER_ASSIST_BRIDGE_DIR="$BRIDGE_DIR" nohup "$REAPER_BIN" -newinst -nosplash -ignoreerrors \
      -cfgfile "$RES/reaper.ini" -new -saveas "$PROJECT" "$BRIDGE_LUA" >"$TEST_DIR/reaper.log" 2>&1 &
    echo $! >"$PID_FILE"
    for _ in $(seq 1 60); do
      [[ -f "$BRIDGE_DIR/status.json" ]] && break
      sleep 0.5
    done
    if [[ -f "$BRIDGE_DIR/status.json" ]]; then
      echo "Test REAPER running (pid $(cat "$PID_FILE")). Project: $PROJECT"
      echo "export REAPER_ASSIST_BRIDGE_DIR=\"$BRIDGE_DIR\""
    else
      echo "REAPER started (pid $(cat "$PID_FILE")) but the bridge has not reported yet; see $TEST_DIR/reaper.log" >&2
      exit 1
    fi
    ;;
  stop)
    if pid="$(running_pid)"; then
      kill -TERM "$pid" || true
      for _ in $(seq 1 20); do kill -0 "$pid" 2>/dev/null || break; sleep 0.5; done
      kill -0 "$pid" 2>/dev/null && kill -KILL "$pid" || true
      echo "Stopped test REAPER (pid $pid)."
    else
      echo "No test REAPER running."
    fi
    rm -f "$PID_FILE"
    ;;
  status)
    if pid="$(running_pid)"; then echo "running (pid $pid), bridge $BRIDGE_DIR"; else echo "not running"; fi
    ;;
  *)
    echo "usage: $0 start|stop|status" >&2
    exit 2
    ;;
esac
