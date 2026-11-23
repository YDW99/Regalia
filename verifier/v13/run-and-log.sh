#!/usr/bin/env bash
# round-77: preserve the reviewed bounded process-group runner; keep a separate v13 history.
set -uo pipefail
if [ "$#" -lt 2 ]; then
  printf 'usage: %s NAME COMMAND [ARG ...]\n' "$0" >&2
  exit 64
fi
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT" || exit 70
# Post-package evidence may be redirected outside the source tree so a run log
# cannot invalidate an already packed archive's complete manifest.
EVIDENCE_ROOT="${REGALIA_EVIDENCE_ROOT:-$ROOT}"
RUN_DIR="$EVIDENCE_ROOT/verifier/runs"
NAME="$1"; shift
SAFE_NAME="$(printf '%s' "$NAME" | tr -cs 'A-Za-z0-9._-' '-')"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$RUN_DIR" || exit 73
LOG="$(mktemp "$RUN_DIR/${TS}-${SAFE_NAME}.XXXXXX.log")" || exit 73
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
  if ! {
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
  } >"$LOG"; then
    printf '%s\n' "run-and-log: log write failed; evidence NOT saved, history NOT appended" >&2
    return 1
  fi
  if ! printf '%s\t%s\t%s\t%s\n' "$TS" "$SAFE_NAME" "$RC" "$LOG" >> "$RUN_DIR/v13-history.tsv"; then
    printf '%s\n' "run-and-log: history append failed; log saved but the run is not in history" >&2
    return 2
  fi
  cat ""$LOG""
  return 0
}

handle_signal() {
  local rc="$1"
  local signal="$2"
  if [ -z "$CHILD_PID" ]; then
    PENDING_RC="$rc"
    PENDING_SIGNAL="$signal"
    trap '' HUP INT QUIT TERM
    return
  fi
  trap '' HUP INT QUIT TERM
  local command_pid="$CHILD_PID"
  kill -TERM "$command_pid" 2>/dev/null || true
  kill -TERM -- "-$command_pid" 2>/dev/null || true
  (
    trap - HUP INT QUIT TERM
    sleep "$TERM_GRACE_SECONDS"
    kill -KILL -- "-$command_pid" 2>/dev/null || true
  ) </dev/null >/dev/null 2>&1 &
  local watchdog_pid=$!
  wait "$command_pid" 2>/dev/null || true
  CHILD_PID=""
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
