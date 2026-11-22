#!/usr/bin/env bash
# round-76: defer startup signals and keep the watchdog through group escalation.
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
PENDING_RC=""
PENDING_SIGNAL=""
TERM_GRACE_SECONDS=2

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
  if [ -z "$CHILD_PID" ]; then
    # The command PID is not recorded yet. Defer cleanup without making the
    # new command inherit ignored signals; its launch subshell resets them.
    PENDING_RC="$rc"
    PENDING_SIGNAL="$signal"
    trap '' HUP INT QUIT TERM
    return
  fi
  trap '' HUP INT QUIT TERM
  local command_pid="$CHILD_PID"
  # The direct PID covers the tiny window before setsid execs; the PGID covers
  # every descendant without ever signaling the caller's process group.
  kill -TERM "$command_pid" 2>/dev/null || true
  kill -TERM -- "-$command_pid" 2>/dev/null || true
  (
    trap - HUP INT QUIT TERM
    sleep "$TERM_GRACE_SECONDS"
    kill -KILL -- "-$command_pid" 2>/dev/null || true
  ) </dev/null >/dev/null 2>&1 &
  local watchdog_pid=$!
  # Reap the direct child before reading TMP so its final output is retained.
  wait "$command_pid" 2>/dev/null || true
  CHILD_PID=""
  # A direct-child exit does not prove the group is empty. Keep the watchdog
  # until its bounded grace expires and its group-level KILL has been issued.
  wait "$watchdog_pid" 2>/dev/null || true
  finish "$rc" "$signal"
  exit "$rc"
}
trap 'handle_signal 129 HUP' HUP
trap 'handle_signal 130 INT' INT
trap 'handle_signal 131 QUIT' QUIT
trap 'handle_signal 143 TERM' TERM

set +e
(
  trap - HUP INT QUIT TERM
  exec setsid -- "$@"
) >"$TMP" 2>&1 <&0 &
CHILD_PID=$!
if [ -n "$PENDING_SIGNAL" ]; then
  handle_signal "$PENDING_RC" "$PENDING_SIGNAL"
fi
wait "$CHILD_PID"
RC=$?
trap '' HUP INT QUIT TERM
CHILD_PID=""
set -e
finish "$RC"
exit "$RC"
