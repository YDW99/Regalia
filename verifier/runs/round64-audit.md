# round-64 audit trail (append-only)

Date: 2026-11-21 (UTC+8). Baseline source: GitHub upload-branch head
`94efed9e` (= the round-63 delivered tree, PR #57 head, committed
04:51:47 UTC). Task: digest the second CodeRabbit review wave on PR #57
(email 2026-11-21 12:58) plus one live-bypass finding CodeRabbit missed —
three comments plus the extra one all target the round-63 hardening of
`verifier/runs/r62-negative-tests.sh` and its v3 guard V3-39.

Environment note (this round only): the sandbox filesystem had been
recycled to a pre-round-62 state (worktree lost round-62/63 files); the
authoritative tree was re-cloned from the GitHub upload branch —
confirming the guide's stance that the remote branch, not any local
sandbox copy, is the recovery source of record. Verifiers on the pristine
`94efed9e` clone: v1 44/44, v2 27/27, v3 40/40 — matches the round-63
delivered baseline.

## 1. The findings, verified on the ground (all TRUE, no false positives)

| # | Severity | Finding | Ground truth at `94efed9e` |
|---|---|---|---|
| 1 | Major | Initial backup `cp` unchecked (data-loss path) | `BAK=$(mktemp) \|\| exit 1` then `cp "$AB" "$BAK"` bare: a full tmpfs or unreadable source leaves an empty/partial BAK; every later restore (per-item AND the EXIT trap) then overwrites ai-bridge.js with it — the pre-run content, including uncommitted edits, is unrecoverable. The round-63 audit's "recovery guarantee" was itself the destruction vector. |
| 2 | Major | `restore()` deletes the backup unconditionally; EXIT trap does not propagate failure (data-loss path) | `cp "$BAK" "$AB" 2>/dev/null` then unconditional `rm -f "$BAK"` (no set -e): a failed cp destroys the ONLY copy while the 2>/dev/null swallows the diagnosis; the EXIT trap calls `restore` but keeps the script's exit status — a failed restore can still report success. Signal paths restore (deleting BAK) then exit, so the EXIT re-entry would misreport if cp-failure simply returned non-zero — the idempotency requirement was real. The per-item restore at the old line 51 was the same bare-cp class. |
| 3 | Minor | V3-39 trap regex satisfied by EMPTY handlers | `/trap\s+'[^']*'\s+EXIT/` etc. match `trap '' EXIT` (the `[^']*` admits zero characters): deleting the handler bodies keeps V3-39 green while the guards are gone. |
| 4 | live bypass (user-found, missed by CodeRabbit) | V3-39 `includes()` checks satisfied by COMMENTS | `s.includes('mktemp')` matches the header comment "exclusive mktemp backup" (script line 9): delete the real `BAK=$(mktemp)` line, keep the comment, V3-39 stays green — a ready-made bypass, not a hypothesis. Third recurrence of guide §6.2 #17 (V2-21 indexOf hit by a quoted comment, V3-38's guide-path default), this time on the meta-guard itself. `BASH_SOURCE`/`pipefail`/`FAILED` clauses share the same shape (no full-literal comment match today, but one comment edit away). |

Classification: findings #1/#2 are DATA-LOSS paths, not style issues —
the backup/restore mechanism built to make mutations recoverable had
itself become the most reliable way to destroy the file it protects
(methodology §1.2, "a defense mechanism's own side effects", shell
edition). Findings #3/#4 are the third structural recurrence of the
same recursion: script fails open → fix → add a meta-sentinel → the
meta-sentinel is bypassed by an empty handler / a comment. Round-64
closes the loop by upgrading V3-39 from literal existence to
implementation-line existence (line-anchored regexes, handler must call
restore) and by RED-verifying those upgrades this same round.

## 2. Fixes (one fixup-sized changeset: guard script + v3 sentinel; v1/v2 and the six sentinel bodies untouched; baseline 44/27/40 unchanged)

1. [CR#5] Backup is byte-verified BEFORE any mutation:
   `if ! cp "$AB" "$BAK" || ! cmp -s "$AB" "$BAK"; then rm -f "$BAK";
   echo "backup failed, aborting before any mutation" >&2; exit 1; fi`
   — the cmp double-check follows the project byte discipline; the abort
   happens before the traps are armed, so the worktree is never touched.
2. [CR#6] Idempotent restore + success-gated delete + failure
   propagation:
   `restore()` returns 0 when BAK is absent (the signal→EXIT double call
   cannot false-alarm); deletes the backup only after
   `cp && cmp -s` prove the restore landed; on failure keeps the backup,
   prints `RESTORE FAILED — backup kept at: $BAK`, returns 1.
   Traps: `trap 'restore || exit 1' EXIT`, `trap 'restore || exit 1;
   exit 130' INT`, `trap 'restore || exit 1; exit 143' TERM` — a failed
   restore can no longer exit 0.
   The per-item restore in neg() gets the same `cp + cmp -s` check: on
   failure it prints, increments FAILED, and exits 1 mid-series — the
   EXIT trap retries recovery and, if even that fails, keeps the backup.
3. V3-39 upgraded from literal existence to implementation-line
   existence: every property is line-anchored (`^ROOT=.*BASH_SOURCE/m`,
   `^BAK=\$\(mktemp\)/m`, `^set -o pipefail/m`,
   `^[^#\n]*FAILED=\$\(\(FAILED\+1\)\)/m`,
   `^[^#\n]*\[ "\$FAILED" -gt 0 \]/m` — the `[^#\n]*` prefix admits
   indentation but never a '#' comment start), and the trap handlers
   must actually call restore
   (`^trap\s+'[^']*\brestore\b[^']*'\s+(EXIT|INT|TERM)/m`). A comment
   line can no longer satisfy any clause; an empty handler no longer
   matches. The ok() title now carries "line-anchored" and
   "restore-calling trap handlers" so a future reader knows which
   generation of the check they are looking at.

## 3. Meta negative tests — all injections on /tmp fixture copies, the real worktree never touched (military rule 8: no fix counts until it fails when it should)

Driver script (session-local, not committed): 25 assertions across five
scenarios, all PASS:

```
===== Test A: backup cp failure -> abort before any mutation =====
PASS: A: non-zero exit (1)
PASS: A: abort message on stderr            ("backup failed, aborting before any mutation")
PASS: A: ai-bridge.js untouched             (sha256 identical after the run)
PASS: A: partial backup removed             (dedicated TMPDIR empty — rm -f ran)

===== Test B: restore failure (target read-only) -> backup kept =====
PASS: B: injection point in place           (chmod 555 "$AB" inserted after the N1
                                             mutation+verifier run, before the per-item restore)
PASS: B: non-zero exit (1)
PASS: B: per-item restore failure reported  ("per-item restore failed after NEG[N1-dedup];
                                             aborting mutations (EXIT trap will retry)")
PASS: B: EXIT-trap restore failure reported ("RESTORE FAILED — backup kept at: <mktemp path>")
PASS: B: backup kept on disk                (the mktemp file still exists)
PASS: B: backup content == pre-run content  (cmp — the data is recoverable by hand)
PASS: B: no fake success                    (target honestly left in the mutated state,
                                             never silently overwritten or reported clean)

===== Test C: SIGINT mid-run -> 130, double-restore not misreported =====
PASS: C: SIGINT delivered mid-run           (t=2.5s, inside the first verifier run)
PASS: C: exit 130 (128+SIGINT)
PASS: C: no false alarm on EXIT re-entry    (no "RESTORE FAILED" — absent BAK = success)
PASS: C: worktree restored byte-identical   (cmp against the pre-run copy)
PASS: C: backup cleaned up after successful restore
PASS: C: run genuinely interrupted          (0/6 items logged at the kill point)

===== Test D1: empty trap handlers -> V3-39 must go RED =====
PASS: D1: three handlers emptied            (trap '' EXIT/INT/TERM)
PASS: D1: V3-39 RED on empty handlers
PASS: D1: v3 exits non-zero (1)             (===== RESULT: 39 passed, 1 failed =====)

===== Test D2: implementation deleted, comments kept -> V3-39 RED =====
PASS: D2: comment 'mktemp backup' still present
PASS: D2: implementation line deleted       (BAK=$(mktemp), set -o pipefail, ROOT= lines removed)
PASS: D2: V3-39 RED on comment-only script
PASS: D2: v3 exits non-zero (1)             (===== RESULT: 39 passed, 1 failed =====)

===== A/B demo: the OLD includes() check WAS bypassed by a comment =====
old includes(mktemp) on comment-only script: TRUE (bypassed — the live bug)
new /^BAK=$(mktemp)/m         : false (correctly RED)
PASS: D2-demo: old check bypassed by comment, new check catches it
```

The D2 A/B demo is the live-bypass finding reproduced end-to-end: the
round-63 `includes('mktemp')` returns TRUE on the implementation-deleted
script (the header comment satisfies it) while the round-64 line-anchored
check returns false — that gap is exactly what CodeRabbit missed and
what V3-39 now closes.

## 4. Bash/POSIX signal semantics discovered while building Test C (recorded for the guide's pitfalls section)

A shell started as a background job (`&`) with job control OFF gets
SIGINT set to SIG_IGN by the PARENT shell (POSIX asynchronous-lists
rule), and bash refuses to trap any signal that was ignored at startup —
`script & kill -INT <pid>` therefore never reaches the INT trap: the
first two runs of Test C exited 0 with the script simply running to
completion (the clean worktree afterwards was normal completion, not
signal recovery — a testing trap that silently passes). setsid does NOT
help: the ignored disposition survives exec. SIGTERM is not in the
POSIX ignore set, which is why the round-63 SIGTERM meta test worked
and why INT needed its own treatment here. Fix: `set -m` around the
`&` launch (job control on → the job gets its own process group and
keeps the default SIGINT disposition). This also means: when the guard
script is run as a true background job (no job control), its INT trap
is legitimately inert by POSIX design — EXIT/TERM remain the effective
recovery paths there; the INT trap serves foreground/Ctrl-C use.

## 5. Live self-verification on the real worktree (delivery gate)

```
$ bash verifier/runs/r62-negative-tests.sh
NEG[N1-dedup] mutated=yes sentinel=RED
NEG[N2-rescue] mutated=yes sentinel=RED
NEG[N3-unbound] mutated=yes sentinel=RED
NEG[N4-list]   mutated=yes sentinel=RED
NEG[N5-manual] mutated=yes sentinel=RED
NEG[N6-watchdog] mutated=yes sentinel=RED
=== restored, final all-green check ===
===== RESULT: 44 passed, 0 failed =====
===== RESULT: 27 passed, 0 failed =====
===== RESULT: 40 passed, 0 failed =====
R62-NEG OK: all six mutations RED, sentinels effective, baseline green
EXIT=0
```

`git status` immediately after: only the two intended files modified
(the guard script and the v3 sentinel) — zero residue from the mutation
series, proving the recovery paths ran clean on the happy path too.

## 6. Build + six-point APK verification (round-64)

Build inputs are byte-identical to round-63 (zero Java/JS/assets changes
— this round touched only the guard script, the v3 sentinel, ledgers and
docs). The build environment was rebuilt from zero again (sandbox had
been recycled to a pre-round-62 state); this sandbox's network was the
MIRROR IMAGE of round-63's: dl.google.com throttled to ~4.4KB/s (so the
official-first repositories in settings.gradle would crawl and never
reach their Aliyun fallbacks — an init script stripped the official
repos so the fallbacks took over), GitHub releases unreachable directly
(the engine came through gh-proxy.com with parallel ranged downloads,
hash-verified before use), Tencent mirrors fast (SDK components +
Gradle ~1GB in about a minute), Tsinghua Adoptium for the JDK.

Environment (all fresh, this sandbox): Temurin JDK 17.0.21
(round-63 used Zulu 17.0.13 — same 17 LTS line; javac is what matters,
the system "JDK 21" turned out to be a JRE without a compiler),
Gradle 8.11.1 (Tencent mirror), SDK platform-tools +
platforms;android-35 + build-tools;35.0.0/34.0.0 + cmake;3.31.6 +
ndk;27.2.12479018 (all from the Tencent AndroidSDK mirror, assembled
manually with sdkmanager-equivalent layout + license hashes), engine
re-sourced from the official Stockfish sf_18
`stockfish-android-armv8-dotprod.tar` release — ELF SHA-256 verified
BEFORE use:
`8f7116d3f1a7004a6581d4fb0c1ff891ce095bab6d45e52f1578897cf23b61b5`,
114,115,752 bytes, "ELF 64-bit LSB executable, ARM aarch64, statically
linked, for Android 29, built by NDK r27c (12479018)" — byte-identical
to the hard constraint. GRADLE memory override via command line
`-Dorg.gradle.jvmargs=-Xmx1536m` (4GB RAM sandbox; NOTE: a
GRADLE_USER_HOME gradle.properties does NOT outrank the project
gradle.properties — the command line does; round-62's lesson recorded
more precisely this round). First invocation converged all dependencies
from the mirrors during a failed configuration (system JRE lacking
javac), second invocation ran clean:

- `BUILD SUCCESSFUL in 1m 24s` (51 tasks, single foreground segment).
- `python3 build-chess.py` rebuild → `cmp` byte-identical BEFORE the
  build (24,208 lines / 1,488,718 bytes; zero JS module changes).
- APK: `build/outputs/apk/release/Regalia-release.apk`, 78,320,546
  bytes (round-63: 78,320,567 — a 21-byte zip-metadata delta; all
  content checks below are byte-exact).
- 1) apksigner v1 scheme: true. 2) v2 scheme: true. 3) v3 scheme: true.
- 4) Signer cert SHA-256:
  `45bc6d36c9fcff8ef9e55f510b43bce44cb854ea4b2f235a0f4955da05a8d8bc`
  (= the uploaded round-45 rebuilt keystore, unchanged).
- 5) aapt2 badging: `com.Regalia` versionCode='10203'
  versionName='1.2.3' (locked, unchanged). minSdk 23, targetSdk 35.
- 6) APK `assets/chess.html` vs source bundle: `cmp` byte-identical
  (1,488,718 bytes); APK `lib/arm64-v8a/libstockfish.so` SHA-256 =
  `8f7116d3…61b5` (three-way match: official tar = disk = APK).
- Post-build tree state: the guard script was re-run AFTER the build as
  the delivery gate — six mutations RED, baseline **44/27/40 all green**,
  exit 0 (see §5).

## 7. Things checked and found NOT broken (negative-space record)

- The round-63 fixes themselves (ROOT self-resolution, mktemp
  exclusivity, trap arming order, FAILED accumulator, pipefail gate)
  were re-verified intact under the round-64 rewrites — the new
  `if ! cp … || ! cmp -s` forms preserve the original semantics on the
  happy path (live run above: six RED + 44/27/40 + exit 0).
- The `!s.includes('/home/')` clause of V3-39 is deliberately kept
  un-anchored: it is an exclusion (fail-closed direction) — a comment
  mentioning such a path SHOULD trip it; only affirmative checks need
  implementation-line anchoring.
- v1/v2 harness bodies: zero diff this round.
- The two V3-39 clauses reading the ledger (`vl.includes` /
  `!vl.includes`) are literal by design — they pin exact committed
  path strings, not properties; a comment in the ledger mentioning the
  phantom path would (correctly) fail them, which is the fail-closed
  direction again.

## 8. Final state

- Verifier triple: **44 / 27 / 40 all green** (v3 includes the
  line-anchored V3-39), re-run as the delivery gate AFTER the build.
- Meta negative-test suite: **25/25 PASS** (all five scenarios, zero
  residue in the real worktree).
- versionCode/versionName unchanged; Manifest untouched; no new
  permissions / network egress / data collection.
- chess.html unchanged (24,208 lines / 1,488,718 bytes — zero JS module
  changes; deterministic rebuild proven before the build).
- APK built, signed with the uploaded keystore, six-point verified
  (this file, §6).
- Changeset for the PR: `verifier/runs/r62-negative-tests.sh`,
  `verifier/v3/round54-pr56-triage.js` (V3-39 upgrade), NEW
  `verifier/runs/round64-audit.md`, `verifier/README.license` (round-64
  entry), `worklog.md` (round-64 entry),
  `Regalia-bug-hunting-methodology.md` (§2.7 round-64 instantiation +
  §4 baseline row + closure line), `Manual/Regalia-v1.2.3-manual-zh.html`
  + `-en.html` (round-64 paragraph on top of Appendix A, intro line
  "第六十四轮至第十八轮" / "sixty-fourth through eighteenth", div 365/365
  both languages, three-check discipline passed).
- Deliveries: source archive, signed APK, recovery guide (the usual
  trio), plus the round-64 mirror-strategy environment notes carried
  into the guide's pitfalls section.
