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


---

## ERRATUM (round-66, F-21) — Gradle property precedence recorded upside-down above

The note above ("a GRADLE_USER_HOME gradle.properties does NOT outrank the
project gradle.properties — the command line does; round-62's lesson recorded
more precisely this round") is WRONG, and it "corrected" a round-62 worklog
record that was RIGHT. The actual precedence (high → low):

1. command line (`-P`, `-D`, `--project-prop`) — highest;
2. **`GRADLE_USER_HOME/gradle.properties` (user-level)**;
3. project-root `gradle.properties`;
4. `GRADLE_HOME/gradle.properties` — lowest.

The user-level file DOES override the project-level one (Gradle merges
user-level properties as overrides on top of project-level ones; this is also
how this project's 4GB-sandbox `-Xmx` workaround survives a project-level
`-Xmx4096m` when the daemon is launched with a user-level file present). The
round-62 worklog line ("GRADLE_USER_HOME 级优先于项目级") was correct as written;
the round-64 "more precisely" pass inverted it. What round-64 MEANT to record
survives: the command line outranks both, and the round-64 build used the
command-line form — which is why the build itself worked despite this note
being wrong.

The round-66 sandbox re-verified the precedence empirically on the same
Gradle 8.11.1, three independent methods (all reproducible, recorded in
round66-audit.md §4):
  (a) build property — GRADLE_USER_HOME sets my.prop=userValue, project root
      sets my.prop=projectValue → providers.gradleProperty('my.prop') ==
      userValue (USER wins);
  (b) live daemon Xmx — user-level org.gradle.jvmargs=-Xmx512m + project-level
      -Xmx384m → the daemon's actual command line (jcmd/ps) carries -Xmx512m
      (USER wins);
  (c) invalid-value matrix (--no-daemon) — user-level INVALID + project-level
      valid → JVM refuses to start (the user-level INVALID governs); user-level
      valid + project-level INVALID → build succeeds (project INVALID ignored);
      user-level INVALID + CLI -D valid → succeeds (CLI wins).
Consistent conclusion: command line > GRADLE_USER_HOME > project root >
GRADLE_HOME — for build properties AND for org.gradle.jvmargs alike.
Verification-process note (meta): the round-66 matrix was first run with a
malformed user-level file (bare value, missing the org.gradle.jvmargs= key),
which made the project-level value appear to win; the (b) jcmd cross-check
exposed the test's own bug. Every "empirical" result owes its reader the
cross-check — this erratum included.
This erratum is appended, not written over the history, per append-only
discipline.

---

## ERRATUM-2 (round-67, T11 / CodeRabbit r66-#6) — ERRATUM-1's list mixes two property namespaces

ERRATUM-1 (above) correctly restored the FILE precedence order (command line >
GRADLE_USER_HOME > project root > GRADLE_HOME) — but its first line, "command
line (`-P`, `-D`, `--project-prop`) — highest", lists `-P` and
`--project-prop` as command-line sources for **Gradle properties**. That mixes
two namespaces (Gradle docs: "Configuring the Build Environment" /
"Project Properties"):

1. **Gradle properties** (the `org.gradle.*` namespace — `org.gradle.jvmargs`,
   `org.gradle.java.home`, …): the ONLY command-line source is
   **`-D`** (`-Dorg.gradle.jvmargs=…`). `-P`/`--project-prop` do NOT reach
   this namespace — `-Porg.gradle.jvmargs=…` creates a PROJECT property that
   happens to be named `org.gradle.jvmargs` and never configures the daemon.
   File sources keep ERRATUM-1's order: GRADLE_USER_HOME > project root >
   GRADLE_HOME; `-D` outranks all of them (re-confirmed live in round-67: the
   build forked a single-use daemon "to honour the JVM settings" from the
   command line while GRADLE_USER_HOME carried a different jvmargs).
2. **Project properties** (everything else, `-P`/`--project-prop`, and
   non-`org.gradle.*` keys in any gradle.properties): their precedence is
   `-P`/`--project-prop` (command line) > GRADLE_USER_HOME/gradle.properties >
   project-root/gradle.properties > GRADLE_HOME/gradle.properties. These feed
   `providers.gradleProperty(...)`/`project.findProperty(...)` — round-66's
   method (a) measured exactly this file order.
3. JVM argument examples therefore use `-Dorg.gradle.jvmargs=…` on the command
   line or `org.gradle.jvmargs=…` in a gradle.properties file — never the
   `-P` form (the round-67 build script and guide §2.3 already used only the
   correct forms; ERRATUM-1's prose was the sole carrier of the mistake).

Empirical classification check (round-67 sandbox, Gradle 8.11.1):
`gradle -q properties -Porg.gradle.jvmargs=-Xmx123m` lists the key under
PROJECT properties (it is one) — while the same run's daemon keeps the
GRADLE_USER_HOME jvmargs; only the `-D` form produces the "To honour the JVM
settings for this build a single-use Daemon process will be forked" fork.
ERRATUM-1's list line is retained verbatim above (append-only discipline);
this erratum supersedes it. `grep` audit note: `-P`/`--project-prop` now
appear in this file only inside the historical ERRATUM-1 list, its
supersession note here, and the project-property section of this erratum.
### ERRATUM-3（round-68，T12）— 项目属性来源清单补全＋权威优先级表收口

ERRATUM-2 的项目属性节列了 `-P` 与三级 gradle.properties，**漏了两个来源**：
`-Dorg.gradle.project.<name>` 命令行系统属性与 `ORG_GRADLE_PROJECT_<name>` 环境
变量（两者均可覆盖任何 gradle.properties 里的同名 `<name>`）。同一记载已勘误三轮
（round-64 写反 → round-67 ERRATUM-2 → 本条），按"勘误递归封顶"原则，本条给出
**对照 Gradle 8.11.1 官方文档逐项核实＋沙箱实测裁决**的权威表，前两次勘误中被
取代的表述以本表为准（superseded；原文按 append-only 纪律保留在上文）。

**权威优先级表（Gradle 8.11.1，实测 E1–E11 全程可复现，见 round68-audit §T12）**

A. **Gradle 属性**（`org.gradle.*` 命名空间；官方文档 "Gradle properties" 表）：
   1. 命令行 `-D`（唯一命令行来源；`-P` 到不了该命名空间——ERRATUM-2 第 1 条不变）
   2. `GRADLE_USER_HOME/gradle.properties`
   3. 项目根（及父项目逐级向上）`gradle.properties`
   4. `GRADLE_HOME/gradle.properties`

B. **项目属性**（其余一切键，喂给 `project.findProperty`/`providers.gradleProperty`）：
   1. `-P`/`--project-prop`（命令行）— 实测 E4/E5
   2. `-Dorg.gradle.project.<name>`（命令行系统属性）— 实测 E3/E6/E14
   3. `gradle.properties` 文件内 **`systemProp.org.gradle.project.<name>`**
      形态：**有效**——单独生效（E12）；胜环境变量（E13）；胜同文件 plain
      条目（E15）；输给命令行 `-D`（E14）。`systemProp.` 前缀把文件条目装载
      为 JVM 系统属性、落入与第 2 条相同的通道，故占**系统属性层级的文件
      档位**：高于环境变量与 plain 文件条目、低于命令行。这正是官方文档
      "Project properties" 第 2 项 "or gradle.properties file" 所指的文件形态。
   4. `ORG_GRADLE_PROJECT_<name>`（环境变量）— 实测 E2/E5/E6/E11/E13
   5. gradle.properties 文件 plain `<name>` 条目（GRADLE_USER_HOME > 项目根
      > GRADLE_HOME）— 实测 E10/E13b/E15
   6. `gradle.properties` 文件内 `org.gradle.project.<name>` 形态（**无**
      systemProp. 前缀）：**8.11.1 实测无效**（E9：唯一来源时属性为 unset；
      round-69 复测仍 null）。该形态本就不在官方文档的承诺范围内。

   **round-70 勘误（CodeRabbit PR#59 #4）**：本表旧版把 systemProp. 形态列在
   第 6 位（环境变量之后），与实测矛盾——E13 证明该形态经系统属性通道**胜过**
   环境变量。旧排序按 append-only 纪律由本勘误取代（superseded），以本表为
   准；E13/E13b/E14/E15 配方与结果见下方 round-70 实测记录。round-69 勘误
   （E9 测错形态的更正）维持不变。

**文档 vs 实测的分歧点（如实记录）**：官方 "Project properties" 节的四选项列表
按 1`-P` 2系统属性 3属性文件 4环境变量 排序——实测第 3/4 位**相反**（E2：环境
变量胜过项目根文件；E11：胜过 GRADLE_USER_HOME 文件）。本表以实测为准；若后续
Gradle 版本变更行为，以同套实验（E1–E11 配方入 round68-audit §T12）重测。

round-68 沙箱实测记录（Gradle 8.11.1 + Temurin 17.0.21，/tmp/gradle-prio 最小
工程）：E3 `-Dorg.gradle.project.foo` 覆盖项目根文件条目生效（规划 T12 验收项）；
E5 `-P` 胜环境变量；E6 系统属性胜环境变量；E9 文件内 org.gradle.project 形态无效；
E10 GRADLE_USER_HOME 文件胜项目根文件；E11 环境变量胜 GRADLE_USER_HOME 文件。

round-69 沙箱实测记录（Gradle 8.11.1 + OpenJDK 21.0.13，/tmp/gradle-e12 最小
工程）：E12 项目根 gradle.properties 内 `systemProp.org.gradle.project.foo=bar`
→ `project.findProperty('foo')` 返回 `bar`（有效，官方文档所指形态）；E9 复测
无前缀形态仍 `null`（无效）；无文件基线 `null`（双向对照）。

round-70 沙箱实测记录（Gradle 8.11.1 + Temurin 17.0.21，/tmp/ge-* 最小工程、
隔离 GRADLE_USER_HOME、--no-daemon，驱动 round-70 勘误）：
- E13 项目根 `systemProp.org.gradle.project.foo=bar` 与环境变量
  `ORG_GRADLE_PROJECT_foo=env` 并存 → `bar`（**systemProp 形态胜环境变量**）；
- E13b 项目根 plain `foo=plain` 与同一环境变量并存 → `env`（E2 复现：环境
  变量胜 plain 文件条目）；
- E14 同 E13 文件与命令行 `-Dorg.gradle.project.foo=baz` 并存 → `baz`
  （**命令行 -D 胜文件 systemProp 形态**）；
- E15 同文件 `foo=plain` 与 `systemProp.org.gradle.project.foo=sysp` 并存 →
  `sysp`（**systemProp 形态胜同文件 plain 条目**）；
- 基线无任何来源 → `null`。
