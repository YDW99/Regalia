#!/usr/bin/env bash
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT" || exit 70
NAME="$1"; shift
SAFE_NAME="$(printf '%s' "$NAME" | tr -cs 'A-Za-z0-9._-' '-')"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
LOG="verifier/runs/${TS}-${SAFE_NAME}.log"
TMP="$(mktemp)"
printf -v CMD '%q ' "$@"
START="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
set +e
"$@" >"$TMP" 2>&1
RC=$?
set -e
{
  printf 'timestamp_start=%s
' "$START"
  printf 'timestamp_end=%s
' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf 'cwd=%s
' "$ROOT"
  printf 'command=%s
' "$CMD"
  printf 'exit_code=%s
' "$RC"
  printf '%s
' '--- output ---'
  cat "$TMP"
} >"$LOG"
printf '%s	%s	%s	%s
' "$TS" "$SAFE_NAME" "$RC" "$LOG" >> verifier/runs/v7-history.tsv
cat "$LOG"
rm -f "$TMP"
exit "$RC"
