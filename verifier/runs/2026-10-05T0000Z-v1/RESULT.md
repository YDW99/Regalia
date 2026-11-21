# verifier run 2026-10-05T0000Z · v1
- harness-fixed.log: node v1/eval-stale-harness.js on round-52 fixed worktree => 28 passed, 0 failed
- baseline check: same harness on pre-fix source (/tmp/baseline, round-51 state) => FAIL at
  "round-52 _evalLastDispatchedFen declared" + ReferenceError in scenario B (stale review eval accepted,
  poisoning current step) — confirms the harness detects the original defect.
- java structural assertions: PASS 8/8 (J1-J4 present)
