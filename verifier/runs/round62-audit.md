# round-62 audit trail (append-only)

Date: 2026-11-21 (UTC+8). Baseline source: GitHub main snapshot (HEAD
`efa4a99e`, guide-designated authoritative source). All commands run in the
fresh sandbox environment described in worklog round-62 (environment rebuilt
from zero; engine binary sourced from the official Stockfish sf_18
`stockfish-android-armv8-dotprod.tar` — SHA-256 matches the guide's hard
constraint byte-for-byte: `8f7116d3f1a7004a6581d4fb0c1ff891ce095bab6d45e52f1578897cf23b61b5`).

## 1. Baseline confirmation (before any change)

- main snapshot vs the surviving round-61 worktree: core sources (Java, JS
  modules, chess.html, verifier, worklog, manuals) **identical**; edge-file
  differences recorded in worklog round-62 §五 (verdict: follow main; no
  unauthorized restoration).
- Verifiers on the pristine baseline: v1 34/34, v2 21/21, v3 39/39 — matches
  the guide's round-61 baseline.

## 2. Sentinel additions and negative tests (six new sentinels)

Script: `verifier/runs/r62-negative-tests.sh` (perl-based mutations of
`ai-bridge.js`, each: mutate → run target verifier → expect target FAIL →
restore from backup → confirm all-green).

| # | Mutation (simulated pre-58b behavior) | Expected RED | Result |
|---|---|---|---|
| N1 | same-position in-flight dedup gate disabled | S58-C1 | RED as expected |
| N2 | completed-work rescue branch disabled | S58-E1 | RED as expected |
| N3 | watchdog retry budget `<1` → `<5` (unbounded) | S58-D1 | RED as expected |
| N4 | normal-completion list refresh statement DELETED | V2-24 | RED as expected |
| N5 | `_manualLive` gate disabled | V2-22 | RED as expected |
| N6 | onEngineRestarting watchdog disarm removed | V2-23a | RED as expected |

Post-restore: v1 44/44, v2 26/26 (before V2-25) — all green.

Iteration notes (kept for the record):
- N1 initially stayed green because the C1 assertion only waited 60ms — a
  regressed re-dispatch needs >300ms (the debounce) to become observable.
  Fixed by extending the wait to 400ms; sentinel timing must cover the full
  path of the behavior under test.
- N4 initially stayed green because the mutation only short-circuited the
  guard (`&&false&&`) while V2-24 counts the guard+call pattern — a negative
  test must reproduce the OLD CODE (delete the statement), not merely break
  the new one.
- V2-24's count-based check was kept (not made smarter) because its purpose
  is counting wiring points; the deletion-style negative test is the honest
  simulation.

## 3. Dedup + G7 migration

- v3 G7a/G7b went RED after the chunk-loop move (expected — sentinel pointed
  at the old files). Updated per military rule 3: G7a now guards the sole
  implementation in `FileIoHelper.readCappedText`; G7b guards both PGN
  caller wirings. Negative test for G7b: rewiring StatsActivity to a naive
  read → RED; restore → GREEN (39/39).
- V2-25 (dedup regression sentinel) passes; no negative run (its clauses are
  exact-count checks whose RED direction is self-evident from the G7b
  exercise and the count semantics).

## 4. Build + six-point APK verification (round-62, fresh environment)

- `BUILD SUCCESSFUL in 37s` (51 tasks; incremental after dependency
  convergence across 4 foreground segments — see worklog environment notes).
- APK: `build/outputs/apk/release/Regalia-release.apk`, 78,320,490 bytes.
- 1) apksigner v1 scheme: true. 2) v2 scheme: true. 3) v3 scheme: true.
- 4) Signer cert SHA-256:
  `45bc6d36c9fcff8ef9e55f510b43bce44cb854ea4b2f235a0f4955da05a8d8bc`
  (= the uploaded round-45 rebuilt keystore, as required).
- 5) aapt2 badging: `com.Regalia` versionCode='10203' versionName='1.2.3'
  (locked, unchanged). sdkVersion 23.
- 6) APK `assets/chess.html` vs source bundle: `cmp` byte-identical; APK
  `lib/arm64-v8a/libstockfish.so` SHA-256 = `8f7116d3…61b5` (three-way
  match: official tar = disk = APK).
- Bundle determinism: `python3 build-chess.py` rebuild → `cmp` no diff
  (24,208 lines / 1,488,718 bytes; zero JS module changes this round).

## 5. Things checked and found NOT broken (negative-space record)

- main snapshot's `android-ci.yml` suspected of broken YAML
  (`branches: ain, master]`) — **disproven**: the `[m` in `[main, master]`
  is swallowed by the bash tool's output rendering as an ANSI SGR reset.
  Byte-level Python check confirms `branches: [main, master]` ×2, intact.
  Corollary lesson recorded in worklog: bracket-bearing output must be
  verified via repr/bytes, never by eye.
- StatsActivity 123/175 "duplicate pair" (from the guide's §5.1 map):
  actually the round-48 deliberate callback/back-handler extraction
  (reuse, not duplication) — judged do-not-touch.
- The guide's "three-file shared segment" (SafPickerHelper/StatsActivity/
  MainActivity): MainActivity has no chunked read loop (stale line-number
 口径) — actual scope was two files, three copies.
- `.github` edge differences vs the round-61 worktree: left as-is on main's
  authority (recorded, not "fixed").

## 6. Final state

- Verifier triple: **44 / 27 / 39 all green** (new baseline).
- versionCode/versionName unchanged; no new permissions / network egress /
  data collection (Manifest untouched this round).
- Manuals zh/en: round-62 paragraph on top of Appendix A, intro line now
  "第六十二轮至第十八轮" / "sixty-second through eighteenth", div 365/365
  both languages (three-check discipline passed).
- Ledgers: verifier/ and src/main/java/com/Regalia/ README.license round-62
  entries on top; H2b/H2f bidirectional sweep re-run green immediately
  after writing (per §6.2 #18).
