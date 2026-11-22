#!/usr/bin/env bash
# round-72: reject empty invocations and preserve every run with an exclusive log.
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
trap cleanup EXIT HUP INT TERM
printf -v CMD '%q ' "$@"
START="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
set +e
"$@" >"$TMP" 2>&1
RC=$?
set -e
{
  printf 'timestamp_start=%s\n' "$START"
  printf 'timestamp_end=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf 'cwd=%s\n' "$ROOT"
  printf 'command=%s\n' "$CMD"
  printf 'exit_code=%s\n' "$RC"
  printf '%s\n' '--- output ---'
  cat "$TMP"
} >"$LOG"
printf '%s\t%s\t%s\t%s\n' "$TS" "$SAFE_NAME" "$RC" "$LOG" >> verifier/runs/v11-history.tsv
cat "$LOG"
exit "$RC"
