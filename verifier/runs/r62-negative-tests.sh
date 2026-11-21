#!/bin/bash
# round-62: negative tests for the new 58b sentinels (perl-based, sed escaping avoided)
set -u
AB=/home/z/my-project/regalia/src/main/assets/chess.src/ai-bridge.js
BAK=/tmp/ai-bridge.r62neg.bak
cp "$AB" "$BAK"

run_v1() { (cd /home/z/my-project/regalia/verifier && node v1/eval-stale-harness.js 2>/dev/null | grep -E "FAIL |RESULT"); }
run_v2() { (cd /home/z/my-project/regalia/verifier && node v2/round53-sonar-triage.js 2>/dev/null | grep -E "FAIL |RESULT"); }

neg() { # $1=name $2=perl-expr $3=verifier $4=target-FAIL-label
  perl -0777 -pi -e "$2" "$AB"
  if ! diff -q "$BAK" "$AB" > /dev/null; then CHANGED=yes; else CHANGED=no; fi
  if [ "$3" = "v1" ]; then OUT=$(run_v1); else OUT=$(run_v2); fi
  echo "$OUT" | grep -q "FAIL $4" && ST=RED || ST="NOT-RED"
  echo "NEG[$1] mutated=$CHANGED sentinel=$ST"
  cp "$BAK" "$AB"
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

cp "$BAK" "$AB"
echo "=== restored, final all-green check ==="
(cd /home/z/my-project/regalia/verifier && node v1/eval-stale-harness.js 2>/dev/null | tail -1 && node v2/round53-sonar-triage.js 2>/dev/null | tail -1)
