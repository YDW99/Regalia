# round-63 audit trail (append-only)

Date: 2026-11-21 (UTC+8). Baseline source: GitHub upload-branch head
`e4f8f43e` (= the round-62 delivered tree, PR #57 head). Task: digest the
four CodeRabbit review findings on PR #57 (email 2026-11-21 11:39) — all
four target `verifier/runs/r62-negative-tests.sh` (41 lines) and its
ledger reference.

## 1. Baseline confirmation (before any change)

- Cloned `https://github.com/YDW99/Regalia.git`; checked out `e4f8f43e`.
  Branch state: main = `efa4a99e` (round-61), upload = `e4f8f43e`
  (round-62, PR #57 head).
- Verifiers on the pristine baseline: v1 44/44, v2 27/27, v3 39/39 —
  matches the round-62 delivered baseline.

## 2. The four findings, verified on the ground (all TRUE, no false positives)

| # | Severity | Finding | Ground truth at `e4f8f43e` |
|---|---|---|---|
| 1 | Minor | Ledger references a non-existent path | `verifier/README.license:22` named an uncommitted sandbox-tree location; the script is actually committed at `verifier/runs/r62-negative-tests.sh`. Line 21 also had a filename typo (ai-bridge.java → .js). |
| 2 | Major | Hardcoded absolute paths | Script lines 4/8/9/41 hardcoded the sandbox root — on other machines the backup fails; if that path exists, the script mutates and verifies a DIFFERENT checkout. |
| 3 | Minor | No exit recovery before mutation | No trap anywhere; a SIGTERM after the first perl mutation leaves the injected regression in the worktree. BAK was a fixed /tmp path — concurrent runs stomp each other's backup. |
| 4 | Major | Ineffective negative tests pass silently | mutated=no / NOT-RED were only echoed, never accumulated; the final `node … | tail -1` exits with tail's 0 — a stale perl expression or a renamed sentinel label makes the script announce success while all six sentinels go unguarded. |

Classification: the script is the "guardian of the guardians"; finding #4
is the same fail-open class as the round-61 R61-b V3-38 fix (guide §6.2
#13: a fail-open verifier is no verifier), recurring at the meta layer.

## 3. Fixes and live self-verification (military rule 8)

Fixes (one script + ledger + one new v3 sentinel; v1/v2 and the six
sentinel bodies untouched):

1. ROOT self-resolves from `BASH_SOURCE` (script lives two levels below
   the repo root); AB / run_v1 / run_v2 / final check all use ROOT.
2. Exclusive `mktemp` backup; `trap … EXIT/INT/TERM` armed BEFORE the
   first mutation (signal paths restore, then exit 130/143); per-item
   restore kept.
3. FAILED accumulator: any item with mutated≠yes or ST≠RED increments;
   final gate exits 1 when FAILED>0.
4. `set -o pipefail`: the final check propagates node's real exit status
   through `tail`; v3 joins the final check (it also reads ai-bridge.js,
   so a failed restore cannot hide there).
5. Ledger: round-62 entry corrected in place (committed script path,
   ai-bridge.js typo) per the R61-a precedent; round-63 entry on top.
6. NEW v3 sentinel V3-39 pins the fixed properties permanently (no
   absolute paths, self-resolved root, mktemp+trap recovery, failure
   accumulation, pipefail, ledger pointing at the committed path). v3
   baseline 39 → 40; triple baseline now **44/27/40**.

Live runs (all in this session, on this tree):

```
$ bash verifier/runs/r62-negative-tests.sh
NEG[N1-dedup] mutated=yes sentinel=RED
NEG[N2-rescue] mutated=yes sentinel=RED
NEG[N3-unbound] mutated=yes sentinel=RED
NEG[N4-list] mutated=yes sentinel=RED
NEG[N5-manual] mutated=yes sentinel=RED
NEG[N6-watchdog] mutated=yes sentinel=RED
=== restored, final all-green check ===
===== RESULT: 44 passed, 0 failed =====
===== RESULT: 27 passed, 0 failed =====
===== RESULT: 40 passed, 0 failed =====
R62-NEG OK: all six mutations RED, sentinels effective, baseline green
EXIT=0
```

Meta negative test 1 (proves fix #4): N1's perl expression broken to
match a non-existent literal, in a same-directory copy of the FIXED
script:

```
NEG[N1-dedup] mutated=no sentinel=NOT-RED     <- detected, not ignored
NEG[N2..N6]   mutated=yes sentinel=RED
R62-NEG FAILED: 1 ineffective negative test(s) and/or non-green baseline
EXIT=1                                         <- non-zero, as required
```

Meta negative test 2 (A/B control, the OLD bug demonstrated live): the
ORIGINAL script at `e4f8f43e` (git show) with the same broken N1:

```
NEG[N1-dedup] mutated=no sentinel=NOT-RED     <- printed, then ignored
NEG[N2..N6]   mutated=yes sentinel=RED
EXIT=0                                         <- the fail-open bug itself
```

Meta negative test 3 (proves fix #3): fixed script backgrounded, SIGTERM
delivered at t=9s (N1 done and logged, N2's mutation in flight):

```
SIGTERM-EXIT=143            (128+15, correct)
WORKTREE-CLEAN=yes          (git diff on ai-bridge.js empty — the in-flight
                             mutation was restored by the trap)
interrupted log tail: "NEG[N1-dedup] mutated=yes sentinel=RED" (then silence)
no leftover mktemp backups
```

Repeated at t=1.2s and t=3.0s (both inside the first verifier run, an
in-flight mutation in the file): identical outcome — 143 + clean worktree.

Fail-closed corollary (accidental but worth recording): a copy of the
fixed script placed at a different tree depth (/tmp) resolves ROOT to
the wrong root, every operation fails, and the script exits 1 — it
cannot silently verify a foreign tree. The old script, by contrast,
hardcoded the sandbox path and would happily mutate whatever checkout
happened to live there.

## 4. Build + six-point APK verification (round-63)

Round-63 build inputs are byte-identical to round-62 (zero Java/JS/assets
changes — this round touched only verifier scripts, ledgers, and docs),
but the build environment had to be rebuilt from zero again (sandbox
recycled; engine re-sourced from the official Stockfish sf_18
`stockfish-android-armv8-dotprod.tar` release — the tar carries the full
source release; the ELF binary `stockfish-android-armv8-dotprod` inside
is the engine, SHA-256 verified BEFORE use:
`8f7116d3f1a7004a6581d4fb0c1ff891ce095bab6d45e52f1578897cf23b61b5`,
114,115,752 bytes, "ELF 64-bit LSB executable, ARM aarch64, statically
linked, for Android 29, built by NDK r27c (12479018)" — byte-identical
to the hard constraint).

Environment (all fresh downloads, this sandbox): Zulu JDK 17.0.13,
Gradle 8.11.1, SDK platform-tools + platforms;android-35 +
build-tools;35.0.0/34.0.0 + cmake;3.31.6 + ndk;27.2.12479018 (sdkmanager
layout — `build/cmake/android.toolchain.cmake` already present, the
zip-layout fix from the guide was NOT needed). GRADLE_USER_HOME override
`-Xmx1536m` (4GB RAM sandbox, per the round-62 lesson). New-sandbox
network note: GitHub release CDN and services.gradle.org were throttled
to 14-34 KB/s — Gradle came from the Tencent mirror, JDK 17 from the
Azul CDN, the engine through a GitHub-release proxy (hash-verified, so
transport integrity is proven), and dl.google.com ran at ~2.8 MB/s.

- `BUILD SUCCESSFUL in 4m 45s` (51 tasks, single foreground segment —
  dependencies converged in one run this time; no daemon race).
- APK: `build/outputs/apk/release/Regalia-release.apk`, 78,320,567 bytes
  (round-62: 78,320,490 — the 77-byte delta is zip entry metadata; all
  content checks below are byte-exact).
- 1) apksigner v1 scheme: true. 2) v2 scheme: true. 3) v3 scheme: true.
- 4) Signer cert SHA-256:
  `45bc6d36c9fcff8ef9e55f510b43bce44cb854ea4b2f235a0f4955da05a8d8bc`
  (= the uploaded round-45 rebuilt keystore, as required).
- 5) aapt2 badging: `com.Regalia` versionCode='10203' versionName='1.2.3'
  (locked, unchanged). minSdk 23.
- 6) APK `assets/chess.html` vs source bundle: `cmp` byte-identical
  (1,488,718 bytes / 24,208 lines); APK `lib/arm64-v8a/libstockfish.so`
  SHA-256 = `8f7116d3…61b5` (three-way match: official tar = disk = APK).
- Bundle determinism: `python3 build-chess.py` rebuild → `cmp` no diff
  (24,208 lines / 1,488,718 bytes; zero JS module changes this round).
- Post-build tree state: the negative-test script re-run not required
  (no source input changed after the earlier green run), but the
  verifier triple was re-run after the build as the delivery gate:
  **44 / 27 / 40 all green**.

## 5. Things checked and found NOT broken (negative-space record)

- v1/v2 harness bodies: zero diff this round (the six 58b sentinels and
  their labels are untouched; only the driver script around them was
  hardened).
- The ledger's other round-62 statements (baseline numbers, G7a/G7b
  description, license classifications) re-checked against the tree —
  accurate; only the two corrected lines were wrong.
- V3-39's ledger clause deliberately tolerates the phrase
  "sandbox-tree location" (prose) but forbids the exact phantom path
  literal — following §6.2 #17, the sentinel's forbidden literal is not
  reproduced verbatim anywhere the sentinel reads.
- Repo has NO .gitignore (main-side edge difference, round-62 verdict:
  respect main) — after the build, a `git add -A` swept the 114MB engine
  binary AND 337 build artifacts (build/ 268, .cxx/ 46, .gradle/ 23)
  into the index. The cleanup itself became a three-step incident: the
  first fix chain began with `cat .gitignore` — the file does not exist,
  so the `&&` chain died at step one and the fix NEVER RAN while the
  trailing verification text still printed; the second fix removed the
  build artifacts but the engine stayed; the third fix verified with
  hard assertions (`git ls-tree -r HEAD`): HEAD tree = 161 files =
  e4f8f43e's 160 + round63-audit.md, jniLibs/build/.gradle/.cxx entries
  all 0. Lessons: run the tar-purity grep (§3.3) IMMEDIATELY after
  packing (the 398MB/82MB first-cut archives were caught by it and
  discarded); never place a fix and its verification in the same `&&`
  chain (a dead chain head skips the verification too); verify trees
  with ls-tree, not show --stat.
- trap/EXIT interactions: an EXIT trap that does not call exit preserves
  the script's intended status (verified: normal runs still exit 0);
  signal traps re-exit 130/143 explicitly.
- The mktemp backup is per-run and exclusive; two concurrent runs on one
  worktree still race on ai-bridge.js itself (inherent to mutating a
  shared tree) — out of scope for this fix; the reviewed defect was the
  shared FIXED backup path stomping.

## 6. Final state

- Verifier triple: **44 / 27 / 40 all green** (v3 includes V3-39).
- versionCode/versionName unchanged; Manifest untouched; no new
  permissions / network egress / data collection.
- chess.html unchanged (24,208 lines / 1,488,718 bytes — zero JS module
  changes this round; build inputs byte-identical to round-62).
- Manuals zh/en: round-63 paragraph on top of Appendix A, intro line now
  "第六十三轮至第十八轮" / "sixty-third through eighteenth", div 365/365
  both languages (three-check discipline passed).
- Ledgers: verifier/README.license round-63 entry on top + round-62
  entry corrected in place; H2b/H2f bidirectional sweep re-run green
  immediately after writing (per §6.2 #18).
