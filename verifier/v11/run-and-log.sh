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

# v1.2.3 round-79 (CodeRabbit PR#60 #18): finish reports whether BOTH the log
#   write and the history append succeeded — a failed log write (disk full,
#   permissions) must NOT append a history entry that points at a missing or
#   truncated log. Returns 0 only when the evidence is fully recorded; on log
#   success the interrupted status and pre-signal output are still preserved
#   inside the log.
finish() {
  local rc="$1"
  local interrupted_by="${2:-}"
  if [ "$FINALIZED" -ne 0 ]; then
    return 0
  fi
  FINALIZED=1
  RC="$rc"
  # v1.2.3 round-80 (CodeRabbit PR#60 re-review): every log write reports its
  #   own status. The round-79 form checked only the command group's LAST
  #   command — a printf failing mid-group (disk full) with an empty TMP still
  #   ended in a successful cat, so a truncated log counted as a complete
  #   write and the history entry pointed at missing evidence. The writes now
  #   run in a set -e subshell: the first failure aborts the group, history is
  #   appended only after every write succeeded.
  if ! (
    set -e
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
  ) >"$LOG"; then
    printf '%s\n' "run-and-log: log write failed; evidence NOT saved, history NOT appended" >&2
    return 1
  fi
  if ! printf '%s\t%s\t%s\t%s\n' "$TS" "$SAFE_NAME" "$RC" "$LOG" >> verifier/runs/v11-history.tsv; then
    printf '%s\n' "run-and-log: history append failed; log saved but the run is not in history" >&2
    return 2
  fi
  # v1.2.3 round-80 (CodeRabbit PR#60 re-review): quote the log path —
  #   cat ""$LOG"" word-split paths containing spaces into several arguments,
  #   the log never printed, and the trailing return 0 hid the failure.
  cat "$LOG"
  return 0
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
  finish "$rc" "$signal" || \
    printf '%s\n' "run-and-log: evidence write failed for the interrupted run" >&2
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
# v1.2.3 round-79 (CodeRabbit PR#60 #19): preserve the child's real exit
#   status even when evidence writing fails, and never report verification
#   success for a successful child whose evidence could not be recorded
#   (75 = EX_TEMPFAIL-style distinct status for an evidence-only failure).
finish_status=0
finish "$RC" || finish_status=$?
if [ "$finish_status" -ne 0 ] && [ "$RC" -eq 0 ]; then
  printf '%s\n' "run-and-log: evidence write failed for a successful run; failing closed" >&2
  exit 75
fi
exit "$RC"
