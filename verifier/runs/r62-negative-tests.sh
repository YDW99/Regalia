#!/usr/bin/env bash
# r62-negative-tests.sh — perl-mutation negative cases for the 58b sentinel set
# (N1–N6, round-62 charter) + N7 (round-66, F-9: the stats.html header-scanner
# kill must turn V3-45 RED). Backup/recovery hardening lineage: round-63
# CR#1–CR#6, round-64 byte-verified backup/restore + idempotent restore +
# failure propagation, round-66 multi-target generalization (one exclusive
# mktemp DIRECTORY with one byte-verified copy per mutable target —
# ai-bridge.js for N1–N6, stats.html for N7).
set -o pipefail
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
AB="$ROOT/src/main/assets/chess.src/ai-bridge.js"
STF="$ROOT/src/main/assets/stats.html"
VDIR="$ROOT/verifier"
FAILED=0

run_v1() { (cd "$VDIR" && node v1/eval-stale-harness.js 2>/dev/null | grep -E "FAIL |RESULT"); }
run_v2() { (cd "$VDIR" && node v2/round53-sonar-triage.js 2>/dev/null | grep -E "FAIL |RESULT"); }
run_v3() { (cd "$VDIR" && node v3/round54-pr56-triage.js 2>/dev/null | grep -E "FAIL |RESULT"); }

# [CR#3] Exclusive per-run backup DIRECTORY (concurrent runs cannot stomp each
# other's restore source) + exit/signal recovery, armed BEFORE the first
# mutation: a mid-run SIGTERM can no longer leave an injected regression in
# the worktree. Signal paths restore, then re-exit non-zero (130 = SIGINT,
# 143 = SIGTERM).
# [CR#5] Every target's backup must be byte-verified BEFORE any mutation: an
# unchecked cp on a full tmpfs (or an unreadable source) would hand every
# later restore an empty/partial copy to lay over the live file — the pre-run
# content, including uncommitted edits, would be unrecoverable. Aborting here
# is safe: the traps are not armed yet, so nothing has touched the worktree.
backup_one() { # $1=target  $2=backup-path — byte-verified copy
  cp "$1" "$2" && cmp -s "$1" "$2"
}
BAK=$(mktemp -d) || exit 1
if ! backup_one "$AB" "$BAK/ai-bridge.js" || ! backup_one "$STF" "$BAK/stats.html"; then
  rm -rf "$BAK"
  echo "backup failed, aborting before any mutation" >&2
  exit 1
fi
# [CR#6] Idempotent restore: an absent backup means already-restored (the
# signal-then-EXIT double call must NOT be misreported as failure); each
# backup is deleted only after cp + cmp -s prove the restore landed; on
# failure the backup is KEPT, its path printed, and the failure propagated
# (a non-zero exit) so the run can never report success over a dirty tree.
restore_one() { # $1=backup-path  $2=target
  [ -f "$1" ] || return 0
  if cp "$1" "$2" && cmp -s "$1" "$2"; then
    rm -f "$1"
  else
    echo "RESTORE FAILED — backup kept at: $1" >&2
    return 1
  fi
}
restore() {
  _rc=0
  restore_one "$BAK/ai-bridge.js" "$AB" || _rc=1
  restore_one "$BAK/stats.html" "$STF" || _rc=1
  return $_rc
}
trap 'restore || exit 1' EXIT
trap 'restore || exit 1; exit 130' INT
trap 'restore || exit 1; exit 143' TERM

neg() { # $1=name $2=perl-expr $3=verifier(v1|v2|v3) $4=target-FAIL-label $5=target-file (default: ai-bridge.js)
  _tgt="${5:-$AB}"
  _bak="$BAK/$(basename "$_tgt")"
  perl -0777 -pi -e "$2" "$_tgt"
  if ! diff -q "$_bak" "$_tgt" > /dev/null; then CHANGED=yes; else CHANGED=no; fi
  if [ "$3" = "v1" ]; then OUT=$(run_v1); elif [ "$3" = "v2" ]; then OUT=$(run_v2); else OUT=$(run_v3); fi
  if echo "$OUT" | grep -q "FAIL $4"; then ST=RED; else ST="NOT-RED"; fi
  echo "NEG[$1] mutated=$CHANGED sentinel=$ST"
  # [CR#4] An ineffective negative test IS a failure: mutated=no means the
  # perl expression no longer matches the source (the "tested" sentinel is
  # silently naked); NOT-RED means the sentinel failed to catch the injected
  # regression. Both must fail the run — the old script printed and moved on.
  if [ "$CHANGED" != yes ] || [ "$ST" != RED ]; then FAILED=$((FAILED+1)); fi
  # [CR#6] Per-item restore gets the same byte-verified check as restore():
  # on failure the mutation series aborts (FAILED++ then exit 1), and the
  # EXIT trap retries the recovery — if even that fails, the backup is kept
  # and its path printed. Never continue the series over a dirty tree.
  if ! cp "$_bak" "$_tgt" || ! cmp -s "$_bak" "$_tgt"; then
    echo "per-item restore failed after NEG[$1]; aborting mutations (EXIT trap will retry)" >&2
    FAILED=$((FAILED+1))
    exit 1
  fi
}

# N1: kill the same-position in-flight dedup gate (pre-58b Bug C regression)
neg "N1-dedup"   "s/if\(reviewMode&&_evalLoading&&_evalSafetyTimerId/if\(false\&\&reviewMode\&\&_evalLoading\&\&_evalSafetyTimerId/" v1 "S58-C1"

# N2: kill the completed-work rescue branch (pre-58b Bug E regression)
neg "N2-rescue"  "s/if\(_cbFenNav!==null&&_evalLastDispatchedFen!==null&&_cbFenNav===_evalLastDispatchedFen\)\{/if\(false\&\&_cbFenNav!==null\&\&_evalLastDispatchedFen!==null\&\&_cbFenNav===_evalLastDispatchedFen\)\{/" v1 "S58-E1"

# N3: unbounded watchdog retry (pre-58b semantics)
neg "N3-unbound" "s/_manualEvalAutoRetries<1\s*\n\s*&&typeof/_manualEvalAutoRetries<5\n\&\&typeof/" v1 "S58-D1"

# N4: unwire the normal-completion list refresh (pre-58b Bug B regression —
#     the call site did not exist before 58b, so DELETE the whole statement)
neg "N4-list"    "s/    if\(reviewMode&&typeof _refreshReviewMoveListEvals==='function'\)_refreshReviewMoveListEvals\(\);\n//" v2 "V2-24"

# N5: unwire the _manualLive gate (pre-58b Bug A regression)
neg "N5-manual"  "s/const _manualLive=\(!_batchLive&&_evalLoading/const _manualLive=\(false\&\&!_batchLive\&\&_evalLoading/" v2 "V2-22"

# N6: drop the watchdog disarm from onEngineRestarting (pre-58b Bug F regression)
neg "N6-watchdog" "s/^(  if\(_evalSafetyTimerId\)\{clearTimeout\(_evalSafetyTimerId\);_evalSafetyTimerId=null;\}\n  _ponderGen\+\+)/  \/\/ NEG-TEST removed watchdog disarm\n  \$2/m" v2 "V2-23a"

# N7 (round-66, F-9): kill the stats.html deterministic header scanner's
# tag-start lookup. V3-45 pins the scanner's implementation lines; breaking
# the scan (any regression back toward a regex, or a dead scanner) must turn
# the sentinel RED, not silently pass. Target: stats.html, verifier: v3.
neg "N7-f9scan" "s/const _b=text\.indexOf\('\[',_hs\);/const _b=-1;/" v3 "V3-45" "$STF"

# [CR#4] Final all-green must reflect the verifiers' REAL exit status: the
# original `node ... | tail -1` returned tail's 0 even when node failed, so a
# broken tree could sail through. pipefail propagates node's status through
# the pipeline. All three verifiers join the check — v3 reads ai-bridge.js
# AND stats.html/tablebase.js now, so a failed restore cannot hide anywhere.
echo "=== restored, final all-green check ==="
(cd "$VDIR" && node v1/eval-stale-harness.js 2>/dev/null | tail -1) || FAILED=$((FAILED+1))
(cd "$VDIR" && node v2/round53-sonar-triage.js 2>/dev/null | tail -1) || FAILED=$((FAILED+1))
(cd "$VDIR" && node v3/round54-pr56-triage.js 2>/dev/null | tail -1) || FAILED=$((FAILED+1))

if [ "$FAILED" -gt 0 ]; then
  echo "R62-NEG FAILED: $FAILED ineffective negative test(s) and/or non-green baseline"
  exit 1
fi
echo "R62-NEG OK: all seven mutations RED, sentinels effective, baseline green"
exit 0
