#!/usr/bin/env bash
# round-74: asynchronous wait lets wrapper-only signals interrupt promptly.
set -uo pipefail
if [ "$#" -lt 2 ]; then
  printf 'usage: %s NAME COMMAND [ARG ...]\n' "$0" >&2
  exit 64
fi
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT" || exit 70
NAME="$1"; shift
SAFE_NAME="$(printf '%s' "$NAME" | tr -cs 'A-Za-z0-9._-' '-')"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p verifier/runs || exit 73
LOG="$(mktemp "verifier/runs/${TS}-${SAFE_NAME}.XXXXXX.log")" || exit 73
TMP="$(mktemp)" || exit 73
cleanup() { rm -f -- "$TMP"; }
trap cleanup EXIT
printf -v CMD '%q ' "$@"
START="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
FINALIZED=0
CHILD_PID=""

finish() {
  local rc="$1"
  local interrupted_by="${2:-}"
  if [ "$FINALIZED" -ne 0 ]; then
    return 0
  fi
  FINALIZED=1
  RC="$rc"
  {
    printf 'timestamp_start=%s\n' "$START"
    printf 'timestamp_end=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    printf 'cwd=%s\n' "$ROOT"
    printf 'command=%s\n' "$CMD"
    printf 'exit_code=%s\n' "$RC"
    if [ -n "$interrupted_by" ]; then
      printf 'interrupted_by=%s\n' "$interrupted_by"
    fi
    printf '%s\n' '--- output ---'
    cat "$TMP"
  } >"$LOG"
  printf '%s\t%s\t%s\t%s\n' "$TS" "$SAFE_NAME" "$RC" "$LOG" >> verifier/runs/v11-history.tsv
  cat "$LOG"
}

handle_signal() {
  local rc="$1"
  local signal="$2"
  trap '' HUP INT TERM
  if [ -n "$CHILD_PID" ]; then
    # A wrapper-only signal must not leave the asynchronous child running.
    # Reap it before reading TMP so its final output is included in the log.
    kill -TERM "$CHILD_PID" 2>/dev/null || true
    wait "$CHILD_PID" 2>/dev/null || true
    CHILD_PID=""
  fi
  finish "$rc" "$signal"
  exit "$rc"
}
trap 'handle_signal 129 HUP' HUP
trap 'handle_signal 130 INT' INT
trap 'handle_signal 143 TERM' TERM

set +e
"$@" >"$TMP" 2>&1 <&0 &
CHILD_PID=$!
wait "$CHILD_PID"
RC=$?
CHILD_PID=""
set -e
trap '' HUP INT TERM
finish "$RC"
exit "$RC"
