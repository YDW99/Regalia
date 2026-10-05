# Regalia round-52+ Verifier

Append-only index of verifier versions. One entry per version.

## v1 (2026-10-05, created)
Measures (acceptance criteria for round-52):
1. **JS syntax**: all 11 chess.src JS modules + rebuilt chess.html inline script pass `node --check`.
2. **JS behavior harness** (`v1/eval-stale-harness.js`): Node vm simulation of the
   onEngineEval stale-callback scenarios —
   (a) late previous-position callback after a new dispatch is dropped (display unchanged);
   (b) review-mode stale callback is cached under the MATCHED step (fen identity) with
       correct White-POV sign, not the current step;
   (c) legacy 7-arg callback path still works (gen-check fallback);
   (d) batch-path dispatch/callback round-trip unaffected;
   (e) duplicate callback for the current fen is idempotent (no cache corruption).
3. **Java structure** (`v1/java-checks.sh`): brace balance, presence of round-52 guards
   (discard-arm gated on state, info-line suppression while discarding, no fast-path
   flag clear, no discard-branch state clobber).
4. **Bundle determinism**: `python3 build-chess.py` rebuilds chess.html; modules order 11.
5. **Docs hygiene**: update-log entries newest-first in Manual zh/en, README.license files,
   NOTICE; version stays 1.2.3 / 10203.
6. **APK**: release build succeeds; apksigner v1+v2+v3 all true; cert SHA-256 matches
   keystore-info.txt; embedded libstockfish.so SHA-256 = 8f7116d3...; no engine files in
   the source tar; keystore-info.txt NOT in tar.
- 2026-10-05T0000Z · v1 · runs/2026-10-05T0000Z-v1/ · fixed=28/28 PASS; baseline(pre-fix)=FAIL as expected
- 2026-10-05T0300Z · v1 · runs/2026-10-05T0300Z-v1/ · final acceptance: harness 28/28, APK v1+v2+v3 signed (cert 45bc6d36...), engine SHA-256 8f7116d3..., tar 146 entries clean

## v2 (2026-10-05, created)
Round-53 acceptance (SonarCloud PR #56 triage):
- v2/round53-sonar-triage.js — 19 structural assertions: S9383 rejection
  handler + void markers, S6582/S7741/S4138 ai-bridge fixes, S6201 pattern
  instanceof, S1181 catch-Exception, S2696 static-synchronized wake-lock
  helpers (no residual instance writes), S116-kept markers.
- Regression gate: v1 harness must still pass 28/28.
- 2026-10-05T0400Z · v2 · runs/2026-10-05T0400Z-v2/ · round-53 triage 19/19 PASS + v1 regression 28/28 PASS
- 2026-10-05T0430Z · v2 · runs/2026-10-05T0430Z-v2/ · compileReleaseJavaWithJavac BUILD SUCCESSFUL (post MainActivity repair) + triage 19/19 PASS + v1 regression 28/28 PASS

## v3 (2026-10-05, created)
Round-54 acceptance (GitHub PR #56 AI-review triage):
- v3/round54-pr56-triage.js — 27 structural assertions: G1 build.gradle
  fallback-key detection; G2 engineGo failure-branch AI retry (timed +
  untimed); G3 dlgChess960SPID -1 sentinel; G4 per-batch notification
  count + openStatsPage Binder-cap re-check; G5 stats.html en-passant
  victim validation + onStatsPGNFileError; G6 waitForBounded API-26 gate;
  G7 CR-aware line counting (SafPickerHelper + StatsActivity); G8
  non-reference-counted wake lock; G9 isPathBrowsable wiring + filesDir +
  SAF-picker JS escape.
- Regression gates: v2 must still pass 19/19; v1 (with the new D3a
  batch-completion assertion) must pass 29/29.
- Harness-strengthening (accepted CodeRabbit test nitpicks): v1 gained
  D3a (batch-finished asserted, no longer read-and-discarded); v2 F2d now
  scans tablebase.js AND ui-interactions.js and only exempts
  void-prefixed/declaration sites; v2 F4b scopes the catch check to the
  try block containing onEvalDeepBatchEnded().
- 2026-10-05T0500Z · v3 · runs/2026-10-05T0500Z-v3/ · round-54 triage 27/27 PASS + v2 19/19 PASS + v1 29/29 PASS + compileReleaseJavaWithJavac BUILD SUCCESSFUL
- 2026-10-05T0530Z · v3 · runs/2026-10-05T0530Z-v3/ · round-54b SonarCloud follow-up: v3 strengthened to 29 assertions (G4a direct comparison, G6d dangling-Javadoc, G6e typeof-guard absence) 29/29 PASS + v2 19/19 + v1 29/29 + compile BUILD SUCCESSFUL
