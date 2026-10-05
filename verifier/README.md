# Regalia round-52 Verifier

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
