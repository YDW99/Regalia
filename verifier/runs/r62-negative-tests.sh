#!/bin/bash
# round-62: negative tests for the new 58b sentinels (perl-based, sed escaping avoided)
# round-63 (PR #57 CodeRabbit follow-up): this script guards the guardians, so
#   it must itself obey the verifier discipline it enforces (methodology §2.7,
#   guarded by v3 sentinel V3-39):
#   [CR#2] the repo root self-resolves from the script location — no
#          hardcoded sandbox paths that would fail the backup elsewhere or
#          silently mutate/verify a foreign checkout;
#   [CR#3] every mutation is recoverable — exclusive mktemp backup, traps
#          armed before the first mutation, per-item restore kept;
#   [CR#4] failures accumulate and the exit code is real — mutated=no (stale
#          perl expression) or sentinel=NOT-RED fails the run; the final
#          baseline propagates node's exit status (pipefail, not tail's 0).
# round-64 (PR #57 CodeRabbit follow-up 2): the round-63 hardening itself
#   opened two data-loss paths and left two sentinel checks bypassable
#   (methodology §1.2 — a defense mechanism's own side effects, shell edition;
#   full account in verifier/runs/round64-audit.md):
#   [CR#5] the initial backup copy ran UNCHECKED — a full tmpfs or an
#          unreadable source would leave an empty/partial BAK, and every
#          later restore (per-item AND the EXIT trap) would overwrite
#          ai-bridge.js with it, destroying the pre-run content including
#          uncommitted work. Now: cp + cmp -s byte-verification, abort
#          BEFORE any mutation (the abort precedes trap arming, so the
#          worktree is never touched);
#   [CR#6] restore() deleted the backup unconditionally (a failed cp still
#          rm'd the ONLY copy while 2>/dev/null swallowed the diagnosis) and
#          the EXIT trap did not propagate the failure (exit 0 after a
#          failed restore). Now: idempotent restore (absent BAK = success,
#          so the signal-then-EXIT double call cannot false-alarm), delete
#          the backup only after cp + cmp -s prove the restore landed, keep
#          the backup + print its path + exit non-zero otherwise; the
#          per-item restore in neg() gets the same check (failure aborts
#          the mutation series, leaving recovery to the EXIT trap).
#   The matching V3-39 upgrades (trap handlers must call restore; every
#   property line-anchored so comments cannot satisfy the sentinel) live in
#   verifier/v3/round54-pr56-triage.js.
# Run: bash verifier/runs/r62-negative-tests.sh
set -u
set -o pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
AB="$ROOT/src/main/assets/chess.src/ai-bridge.js"
VDIR="$ROOT/verifier"
FAILED=0

run_v1() { (cd "$VDIR" && node v1/eval-stale-harness.js 2>/dev/null | grep -E "FAIL |RESULT"); }
run_v2() { (cd "$VDIR" && node v2/round53-sonar-triage.js 2>/dev/null | grep -E "FAIL |RESULT"); }

# [CR#3] Exclusive per-run backup (concurrent runs cannot stomp each other's
# restore source) + exit/signal recovery, armed BEFORE the first mutation: a
# mid-run SIGTERM can no longer leave an injected regression in the worktree.
# Signal paths restore, then re-exit non-zero (130 = SIGINT, 143 = SIGTERM).
# [CR#5] The backup must be byte-verified BEFORE any mutation: an unchecked
# cp on a full tmpfs (or an unreadable source) would hand every later restore
# an empty/partial BAK to copy over ai-bridge.js — the pre-run content,
# including uncommitted edits, would be unrecoverable. Aborting here is
# safe: the traps are not armed yet, so nothing has touched the worktree.
BAK=$(mktemp) || exit 1
if ! cp "$AB" "$BAK" || ! cmp -s "$AB" "$BAK"; then
  rm -f "$BAK"
  echo "backup failed, aborting before any mutation" >&2
  exit 1
fi
# [CR#6] Idempotent restore: an absent backup means already-restored (the
# signal-then-EXIT double call must NOT be misreported as failure); the
# backup is deleted only after cp + cmp -s prove the restore landed; on
# failure the backup is KEPT, its path printed, and the failure propagated
# (a non-zero exit) so the run can never report success over a dirty tree.
restore() {
  [ -f "$BAK" ] || return 0
  if cp "$BAK" "$AB" && cmp -s "$BAK" "$AB"; then
    rm -f "$BAK"
  else
    echo "RESTORE FAILED — backup kept at: $BAK" >&2
    return 1
  fi
}
trap 'restore || exit 1' EXIT
trap 'restore || exit 1; exit 130' INT
trap 'restore || exit 1; exit 143' TERM

neg() { # $1=name $2=perl-expr $3=verifier $4=target-FAIL-label
  perl -0777 -pi -e "$2" "$AB"
  if ! diff -q "$BAK" "$AB" > /dev/null; then CHANGED=yes; else CHANGED=no; fi
  if [ "$3" = "v1" ]; then OUT=$(run_v1); else OUT=$(run_v2); fi
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
  if ! cp "$BAK" "$AB" || ! cmp -s "$BAK" "$AB"; then
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

# [CR#4] Final all-green must reflect the verifiers' REAL exit status: the
# original `node ... | tail -1` returned tail's 0 even when node failed, so a
# broken tree could sail through. pipefail propagates node's status through
# the pipeline. v3 joins the check because it also reads ai-bridge.js — a
# failed restore must not be able to hide there.
echo "=== restored, final all-green check ==="
(cd "$VDIR" && node v1/eval-stale-harness.js 2>/dev/null | tail -1) || FAILED=$((FAILED+1))
(cd "$VDIR" && node v2/round53-sonar-triage.js 2>/dev/null | tail -1) || FAILED=$((FAILED+1))
(cd "$VDIR" && node v3/round54-pr56-triage.js 2>/dev/null | tail -1) || FAILED=$((FAILED+1))

if [ "$FAILED" -gt 0 ]; then
  echo "R62-NEG FAILED: $FAILED ineffective negative test(s) and/or non-green baseline"
  exit 1
fi
echo "R62-NEG OK: all six mutations RED, sentinels effective, baseline green"
exit 0
