# round-65 audit trail (append-only)

Date: 2026-11-21 (UTC+8). Baseline source: the local worktree (round-64
complete state — the sandbox survived this time; GitHub upload-branch head
is still `94efed9e`, i.e. round-63: the round-64 changeset has NOT been
uploaded yet, so the round-65 upload package carries BOTH rounds).
Task: upgrade the bundled engine to Stockfish 19 and synchronize every
engine-related fact across code and documents, SHA-256 checks included.

## 1. Release-form verification (the "dotprod" nuance)

The sf_19 official release does NOT ship a `stockfish-android-armv8-
dotprod.tar`. Since sf_17 the Android arm64 asset is a UNIVERSAL build —
`stockfish-android-arm64-universal.tar.gz`, 80,233,187 bytes — that
detects CPU features (dotprod and other ARMv8 extensions) at runtime.
The user's intent ("Stockfish 19 dotprod") is satisfied by the universal
package, which additionally brings a real compatibility win: devices
without ARMv8.6-A DOTPROD (A53/A55/A72/A75) that would CRASH on the old
dotprod-only build now fall back to the baseline path. All documentation
wording reflects this fact (no phantom "sf_19 dotprod tar" references).

## 2. New engine identity (verified before use)

- Source: official sf_19 `stockfish-android-arm64-universal.tar.gz`
  (fetched via gh-proxy.com with 8-way parallel ranged downloads; HEAD
  first for the true tar size — tar size != ELF size, the round-64
  lesson applied).
- ELF `stockfish-android-arm64-universal`: **100,695,968 bytes**, SHA-256
  `ffd8fc2004d3d19f9fdab95d84c92709aea92e8d3af405eda0b281b23cf1daf8`,
  file(1): "ELF 64-bit LSB executable, ARM aarch64, statically linked,
  for Android 29, built by NDK r27c (12479018)" — same load target as
  sf_18 (Android 29 / NDK r27c), so runtime loading compatibility is
  unchanged.
- Prior identity (historical, preserved in the round-by-round records):
  sf_18 armv8-dotprod, 114,115,752 bytes,
  `8f7116d3f1a7004a6581d4fb0c1ff891ce095bab6d45e52f1578897cf23b61b5`.

## 3. Distribution of engine facts (survey before touching anything)

grep survey of the old hash / size / version strings across the tree:
- LIVE code: StockfishNative.java EXPECTED_ENGINE_SHA256 (runtime tamper
  gate — a stale value makes the app delete and re-extract the new engine
  forever) and the extraction-progress denominator `total * 13L /
  114115752L` (progress scale must track the bundled engine size);
  ai-bridge.js notification text / sf18 eval-badge key+display+call site
  / two engine-config fallback names; ui.js About dialog row;
  game-logic.js timed-game comment.
- LIVE docs: README.md top matter, NOTICE, PRIVACY.md, LICENSES/README.md,
  UBIQUITOUS_LANGUAGE.md, release-helper.yml release-notes template,
  BUILDING.md (all-new topmost round-65 notes; older per-round notes are
  append-only history).
- Append-only histories (NOT rewritten): worklog old rounds, manual
  appendix-A historical rounds, round5x-audit.md files, BUILDING.md
  per-round notes, README.md round records, ledger historical entries,
  "Per SF18 eval best-practices doc" source-citation comments (they cite
  the source document, not the current engine).
- Verifiers v1/v2: zero anchors on engine strings (surveyed BEFORE the
  JS edits — no sentinel would trip on the sf18->sf19 string changes).

## 4. Changes and their verification

1. StockfishNative.java: digest constant + progress denominator
   (114115752L -> 100695968L, Rev61 multiply-first ordering preserved) +
   the "~114MB" comment updated to "~100MB".
2. chess.src (ai-bridge.js x4 lines, ui.js, game-logic.js): user-facing
   engine identity strings -> Stockfish 19 / sf19 / SF19 / "arm64-v8a
   universal". `node --check` all three modules; chess.html rebuilt
   deterministically: **24,208 lines / 1,488,720 bytes** (round-64:
   1,488,718; +2 bytes from the About-dialog wording).
3. NEW v3 sentinel V3-40 — engine identity CROSS-FILE consistency (Java
   digest == NOTICE digest == topmost BUILDING.md digest; progress
   denominator == NOTICE declared byte size). v3 baseline 40 -> **41**;
   triple baseline **44/27/41**.
4. LIVE docs updated in place (README.md top matter incl. the sf_19
   download URL, NOTICE engine section, PRIVACY.md integrity section,
   LICENSES/README.md, UBIQUITOUS_LANGUAGE.md, release-helper.yml).
   BUILDING.md: round-65 build notes inserted at the top (authoritative
   current build flow) with an explicit note that older sf_18 passages
   below are historical. Also removed the README directory-tree entry
   for About_v18.x.x_.md — a file that does not exist in the repo
   (stale description; removal is the honest fix).
5. Five per-directory ledgers got round-65 entries (lib/arm64-v8a with
   the live description paragraph updated, java/, src/main/, assets/,
   chess.src/), plus the verifier ledger for V3-40.
   **H2a caught a live mistake this round**: the new chess.src ledger
   entry initially tagged ai-bridge.js as AGPL v3 (it is GPL v3) — the
   bidirectional sentinel flagged it immediately; corrected, then 41/41
   green. Third on-record catch of its kind (round-61 H2b was the first).
6. Manuals zh/en: nine live-section replacements each (cover, features,
   license table, components table, disclaimer, time-control chapter
   title+body, footer); the functional chapter and a historical appendix
   paragraph share identical wording, so the replacement used a combined
   h3+paragraph anchor to hit only the live one. Appendix A: round-65
   paragraph on top, intro line "第六十五轮至第十八轮" /
   "sixty-fifth through eighteenth", three checks passed (div 365/365
   both languages).

## 5. RED-verified (military rule §3.10 — a new sentinel must be proven to fail)

All mutations on a /tmp fixture copy (worktree untouched):

```
mutation 1: NOTICE digest, one hex digit flipped
  -> FAIL V3-40 engine identity cross-file consistent ...
  -> ===== RESULT: 40 passed, 1 failed =====

mutation 2: progress denominator reverted to the old engine size
  -> FAIL V3-40 engine identity cross-file consistent ...
  -> ===== RESULT: 40 passed, 1 failed =====

clean control: ===== RESULT: 41 passed, 0 failed =====
```

Operational note: the first fixture attempt exhausted the sandbox disk
(98% full — 226MB free; the round-64 build outputs alone were 416MB).
Fixture copies MUST exclude build/, .cxx/, .gradle/ and jniLibs/ (the
verifiers do not read them). Space recovered (~2.0GB free) by removing
the round-64 build outputs, the already-installed component archives
(~1GB of SDK/NDK/JDK/Gradle zips), and the extracted sf_18 engine tree.

## 6. Build + six-point APK verification (round-65)

Build environment: the round-64 environment survived the session
(Temurin JDK 17.0.21, Gradle 8.11.1, Tencent-mirror SDK
platforms;android-35 + build-tools;35.0.0/34.0.0 + cmake;3.31.6 +
ndk;27.2.12479018, Aliyun-maven init script, -Xmx1536m command-line
override); only the engine was replaced.

- `python3 build-chess.py` rebuild -> cmp byte-identical BEFORE the
  build (24,208 lines / 1,488,720 bytes).
- `BUILD SUCCESSFUL in 1m 4s` (51 tasks).
- APK: `build/outputs/apk/release/Regalia-release.apk`, **81,548,307
  bytes** (round-64: 78,320,546). The engine shrank 114.1MB -> 100.7MB
  yet the APK grew ~3.2MB: `useLegacyPackaging` stores the .so
  compressed, and the universal binary compresses noticeably worse than
  the dotprod-only build (multi-path code). Content checks are
  byte-exact below; the size delta is a compression-property fact, not
  an anomaly.
- 1) apksigner v1 scheme: true. 2) v2 scheme: true. 3) v3 scheme: true.
- 4) Signer cert SHA-256:
  `45bc6d36c9fcff8ef9e55f510b43bce44cb854ea4b2f235a0f4955da05a8d8bc`
  (= the uploaded round-45 rebuilt keystore, unchanged).
- 5) aapt2 badging: `com.Regalia` versionCode='10203'
  versionName='1.2.3' (locked, unchanged). minSdk 23.
- 6) APK `assets/chess.html` vs source bundle: `cmp` byte-identical
  (1,488,720 bytes); APK `lib/arm64-v8a/libstockfish.so` SHA-256 =
  `ffd8fc20…cf1daf8`, 100,695,968 bytes — **three-way match: official
  tar = disk = APK**.
- Post-build delivery gate: the guard script re-run AFTER the build —
  six mutations RED, baseline **44/27/41 all green**, exit 0.

## 7. Things checked and found NOT broken (negative-space record)

- v1/v2 verifier bodies: zero diff this round (no engine-string anchors
  — surveyed before the JS edits, confirmed after).
- The four historical "Per SF18 eval best-practices doc" comments
  (ai-bridge.js x2, StockfishNative.java x2 regions,
  EngineConfigHelper.java) kept verbatim: they cite the source document
  the optimization came from, not the current engine version.
- Manual appendix-A historical rounds and README/BUILDING/worklog
  historical passages with sf_18 references: untouched (append-only).
- UCI integration: zero protocol changes — the engine is driven by the
  same UCI command surface; only identity strings and the integrity
  constants moved.
- versionCode/versionName: 10203/"1.2.3" locked; Manifest untouched; no
  new permissions / network egress / data collection.

## 8. Final state

- Verifier triple: **44 / 27 / 41 all green** (v3 includes V3-40),
  re-run as the delivery gate AFTER the build.
- Engine: sf_19 arm64-universal, three-way byte-identical.
- chess.html: 24,208 lines / 1,488,720 bytes (deterministic rebuild
  proven).
- APK: 81,548,307 bytes, signed with the uploaded keystore, six-point
  verified.
- Changeset for the PR (round-65 layer on top of the un-uploaded
  round-64 layer): StockfishNative.java, ai-bridge.js, ui.js,
  game-logic.js, chess.html (rebuilt), v3 (V3-40), verifier/README.license,
  five content ledgers, README.md, NOTICE, PRIVACY.md, LICENSES/README.md,
  UBIQUITOUS_LANGUAGE.md, .github/workflows/release-helper.yml,
  BUILDING.md (topmost notes), Manual zh/en, worklog.md, plus this file.
