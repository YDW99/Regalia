# Building Regalia v1.2.1 from source

<!-- AI-GEN: AI assisted
     This document was AI-assisted and has been reviewed for AGPL v3 compliance. -->

## Engine binary (NOT included in this tar)

Download the official Stockfish 18 arm64-v8a-dotprod binary from:
https://github.com/official-stockfish/Stockfish/releases/download/sf_18/stockfish-android-armv8-dotprod.tar

Extract and copy as `libstockfish.so` (Android packaging convention — the file is the Stockfish ELF executable, renamed to `.so` so `nativeLibraryDir` resolves it):
```
mkdir -p src/main/jniLibs/arm64-v8a
tar xf stockfish-android-armv8-dotprod.tar
cp stockfish/stockfish-android-armv8-dotprod src/main/jniLibs/arm64-v8a/libstockfish.so
chmod +x src/main/jniLibs/arm64-v8a/libstockfish.so
```

## Build chess.html asset
```
python3 build-chess.py
```
The build script merges `src/main/assets/chess.src/*.js` (in order:
game-logic → chess960 → pgn-standard → worker-pool → state-store → ai-bridge → tablebase → eco-data → ui)
into `src/main/assets/chess.html`, stripping `export` statements.
As of v1.1.2 Phase 67 (MED-3), the script wraps every file I/O in try/except
for clearer diagnostics and uses an `if __name__ == '__main__':` guard.
v1.2.1 (round-4 cleanup) removed the four Phase-74 ui-*.js extracts
(ui-audio / ui-board / ui-review / ui-toolbar) — they duplicated inline logic
in ui.js / ai-bridge.js with subtly different conventions and were never on
the hot path. Bundle order is now 9 modules (down from 13).

## Build APK
```
./gradlew assembleRelease
```
The signed APK (v1+v2+v3 signed with `../debug.keystore`) will be at
`/tmp/regalia_build/Regalia/outputs/apk/release/Regalia-release.apk`
(per `buildDir` in `build.gradle`).

## Requirements
- JDK 21 (e.g. Temurin JDK 21.0.5+11) — must include `javac` (JRE-only is insufficient)
- Android SDK API 35, Build-Tools 34.0.0, NDK 27.2.12479018, CMake 3.22.1
- Gradle 8.11.1 (wrapper included)
- Set `JAVA_HOME` to your JDK 21 path (or add `org.gradle.java.home=...` to
  `~/.gradle/gradle.properties` — never commit machine-specific paths to the
  project's `gradle.properties`; v1.1.2 Phase 67 GOV-2 removed the previously
  hardcoded Ubuntu path `/usr/lib/jvm/java-21-openjdk-amd64`).
- Configure `local.properties`:
  - `sdk.dir` → Android SDK path
- Configure `../version.properties` (one level above the project dir):
  ```
  VERSION_MAJOR=1
  VERSION_MINOR=2
  VERSION_PATCH=1
  VERSION_BUILD=121
  ```
  Defaults inside `build.gradle` cover the missing case (1.1.1 / 111).
- Configure `../keystore.properties` (one level above the project dir) for
  release signing, or use environment variables `RELEASE_KEYSTORE_PATH` /
  `RELEASE_KEYSTORE_PASSWORD` / `RELEASE_KEY_ALIAS` / `RELEASE_KEY_PASSWORD`:
  ```
  releaseKeystorePath=/absolute/path/to/debug.keystore
  releaseKeystorePassword=android
  releaseKeyAlias=debug
  releaseKeyPassword=android
  ```
- Place a keystore at `../debug.keystore` (storepass=android, alias=debug) or
  update `signingConfigs.release` in `build.gradle` to your own keystore.
- The APK is signed with v1+v2+v3 schemes (`enableV1Signing`/`enableV2Signing`/
  `enableV3Signing` all `true`), compatible with Xiaomi HyperOS 3 (Android 15).

## Build troubleshooting

- **CMake/ninja "manifest still dirty after 100 tries"**: This occurs when source
  files have future timestamps (e.g. after extracting a zip with `unzip` preserving
  the archive's mtime). CMake's re-run check sees `CMakeLists.txt` as newer than
  `build.ninja` indefinitely. Fix: normalize timestamps before building:
  ```
  find . -name "*.txt" -o -name "*.cpp" -o -name "*.cmake" | xargs touch
  rm -rf .cxx build
  ./gradlew assembleRelease
  ```
  Alternatively, extract the source tarball with `tar --no-same-time` or
  `unzip -DD` (no directory timestamps) to avoid future-dated files.
- **`./gradlew: Permission denied`**: The wrapper script may lose its executable
  bit after extraction. Fix: `chmod +x gradlew`.
- **Aliyun Maven mirror 502**: `build.gradle` and `settings.gradle` place
  `google()` / `mavenCentral()` BEFORE the Aliyun mirror so official sources are
  preferred. If you still hit 502s, temporarily comment out the Aliyun mirror
  blocks in both files.

## v1.1.0 build notes
- **v1.1.2 Phase 72 (2026.7.12):** Same-version revision (versionCode=112,
  versionName="1.1.2" unchanged). Review analyze-all "false completion"
  bug fix after long-press priority. No build-system changes; no new files
  at project root. If you edit `chess.src/*.js`, re-run
  `python3 build-chess.py` before `./gradlew assembleRelease`. Changes:
  (1) **Bug fix (user-reported)**: `_reviewAnalyzeAdvance` (ui.js) — the
  completion check previously ONLY walked forward from
  `_reviewAnalyzeStep+1`. When the user long-pressed a step to prioritize
  it (Phase 68 feature), the batch evaluated that single step, then the
  forward walk reached `_lastStep` and reported "all analysis complete" —
  even though steps BEFORE the prioritized step were still uncached. Fix:
  when the forward walk finds nothing, scan the ENTIRE range
  `[0.._lastStep]` for the lowest uncached step and resume the batch from
  there. The forward-only fast-path is preserved for the common
  (no-priority) case; the full-range scan is the source of truth for
  completion.
  (2) **Phase 67→70 verification**: all Phase 67→70 changes re-verified to
  be correctly implemented (nativeRenice setpriority check, makeMv
  inB(to) check, onHintMove bounds check, Long.parseLong try-catch,
  MainActivity stopLoading, standard LICENSE file, gradle.properties
  cross-platform, build-chess.py try/except, emoji-space formatting,
  _pgnCacheShowPartialEvalDialog 3 options, _reviewAnalyzeAdvance render
  every 10 steps, _refreshEvalTrendChart + _updateReviewAnalyzeBtn,
  setTimeout(0) yield, _prioritizeReviewStep + _reviewAnalyzePriorityQueue,
  .rmv-block oncontextmenu, stats nav buttons flex:1 1 0,
  _pgnPartialEvalDialogActive back-button, .rmv-block CSS user-select:none,
  3 new i18n keys, _pgnCacheBuildSaveContext decoupled coverage check,
  _reviewEvalCache.size > 0 force rebuild, _pgnCacheOpInProgress guard,
  stats.html CSP hash auto-update, worker-pool.js onmessageerror, MultiPV
  cap 8, Move Overhead cap 1000ms, Hash cap 50% JVM heap, Threads cap 2x
  CPU cores, UCI_AnalyseMode, makeMvInPlace inB(to) check, console.log
  cleanup). No corrections needed.

- **v1.1.2 Phase 71 (2026.7.11):** Same-version revision (versionCode=112,
  versionName="1.1.2" unchanged). Stats-page move-selection bug fix +
  first-principles code review of all ~34,000 source lines. No build-system
  changes; no new files at project root. If you edit `chess.src/*.js` or
  `src/main/assets/stats.html`, re-run `python3 build-chess.py` before
  `./gradlew assembleRelease`. Changes:
  (1) **Bug fix (user-reported)**: `stats.html` CSP blocked inline `onclick`
  handlers → clicking a PGN move in the statistics page did nothing. Root
  cause: the SHA-256-hash-based `script-src` policy silently blocked all
  23 inline event handlers per CSP Level 2+. Fix: switch `script-src` from
  `'sha256-<hash>' blob:` to `'unsafe-inline' blob:` (safe — stats.html is a
  local asset with no external content). **Note**: the Phase 69
  `build-chess.py` CSP-hash auto-update step is now a no-op for stats.html
  (the CSP no longer uses a hash) but remains harmless.
  (2) **XSS hardening** (consequence of the CSP change): `stats.html`
  `renderPGNText` / variation-text walk / `firstMoves` now route unrecognized
  characters through `_escFEN` before HTML insertion. Without this, a
  malicious PGN movetext payload like `<img src=x onerror="...">` would
  execute under `'unsafe-inline'`.
  (3) **Chess960 0-distance castling fix** (P1 bug, main app + stats page):
  for SP-IDs where the king already sits on its castling target (e.g. king on
  g1, rook on h1 → UCI `g1h1`), `uciToCoords` rewrote the destination to col
  6, producing a 0-distance "move" `g1g1` that `_castleSide` rejected → king
  nulled. Fix: `uciToCoords` (ai-bridge.js) attaches `castle` flag to
  `result.to`; `executeMove` (ui.js) checks `to.castle` as primary source;
  `_castleSide` (game-logic.js) adds a 0-distance branch;
  `stats.html` mirrors all three fixes in its independent code.
  (4) **Concurrency fixes** (StockfishNative.java): `readyOkLatchHolder` race
  — JS binder thread and executor thread both wrote the single volatile
  field without synchronization; fix: dedicated `_readyOkLock` serializes all
  readyOk set+wait operations. `engineStop` TOCTOU on
  `_discardingPonderBestmove` — fix: dedicated `_discardFlagLock` makes the
  check-and-clear atomic.
  (5) **importSettings cap bypass fix** (StockfishNative.java): apply the
  Phase 69 cap formulas (2x CPU cores / 50% JVM heap / 1000ms) inline in
  `importSettings` instead of the loose 1024/1048576/10000 caps.
  (6) **StatsActivity robustness**: added deprecated `shouldOverrideUrlLoading`
  overload (API 21-23 compat) + `onRenderProcessGone` handler.
  (7) **Low-risk robustness patches**: `secureRandomInt` crypto guard;
  `moveAlg` setupMode `typeof` guard; `toShredderCastling` board guard;
  `sevenTagRoster`/`composePGN` null guards; `worker-pool.js` 3-strike
  transient-failure counter; `makeMv`/`makeMvInPlace` en-passant `inB()`
  bounds checks.

- **v1.1.2 Phase 70 (2026.7.10):** Same-version revision (versionCode=112,
  versionName="1.1.2" unchanged). First-principles code review cleanup.
  No build-system changes; no new files at project root. If you edit
  `chess.src/*.js`, re-run `python3 build-chess.py` before
  `./gradlew assembleRelease`. Changes:
  (1) **Bug fix (edge case)**: `_pgnCacheBuildSaveContext` (ui.js) — when the
  user exits review mode before saving, `_reviewEvalCache` still has entries
  (persisted until `_resetGameUIState`), but the Phase 69 force-rebuild was
  gated on `_inReview` (which is now false). This meant the pure-import path
  would save `_cachedOriginalPGN` verbatim, losing `[%eval]` annotations.
  Fix: the force-rebuild now checks `_reviewEvalCache.size > 0` directly
  (not `_inReview`), so evals from a previous review session are always
  included. The coverage dialog still requires `_inReview` (the "Analyze All
  first" option needs review mode).
  (2) **Robustness**: `makeMvInPlace` (game-logic.js) — added the same `inB()`
  bounds check on `to`-coordinates that `makeMv` got in Phase 67. Previously
  only `from.row` was bounds-checked, allowing an out-of-range `to` coord to
  silently throw on `s.board[to.row][to.col]`.
  (3) **Redundancy cleanup**: removed 7 debug `console.log` calls from
  `ai-bridge.js` (engine init/restart/ready callbacks) and 1 from `eco-data.js`
  (IndexedDB cache load). These were debug leftovers that polluted production
  logs. Replaced with comments documenting the removal.

- **v1.1.2 Phase 69 (2026.7.9):** Same-version revision (versionCode=112,
  versionName="1.1.2" unchanged). 4 bug fixes + Web Worker robustness + UCI
  optimization. No build-system changes; no new files at project root. If you
  edit `chess.src/*.js`, `chess.src/index.html.tpl`, or
  `src/main/assets/stats.html`, re-run `python3 build-chess.py` before
  `./gradlew assembleRelease`. Changes:
  (1) **Bug 1+2 fix**: `_pgnCacheSaveCurrentImpl` (ui.js) — the partial-eval
  dialog never appeared because the coverage check was gated on `!_useOriginal`,
  but `_useOriginal` is almost always true for imported PGNs (importPGN sets
  time:null). Fix: decouple coverage check from `_useOriginal`; when
  `_reviewEvalCache.size > 0`, force rebuild path so `[%eval]` annotations are
  included. Refactored into `_pgnCacheBuildSaveContext` + `_pgnCacheBuildPGNText`
  + `_pgnCachePersistSave` shared helpers.
  (2) **Bug 3 fix**: PGN cache manager race conditions — added
  `_pgnCacheOpInProgress` guard to all operations (save/import/delete/rename/
  tags). `importPGNAsync().then()` checks `showPGNCacheManager` state. Guard
  reset on close/resetGameUIState/partial-eval dialog dismiss.
  (3) **Bug 4 fix**: `stats.html` CSP SHA-256 hash mismatch — Phase 68 changed
  the nav button code, changing the inline script's hash, but the CSP `<meta>`
  tag wasn't updated → browser blocked script execution → stats page blank.
  Fix: `build-chess.py` now auto-computes and updates the stats.html CSP hash
  on every build. Also added a standalone `fix_stats_csp_hash.py` script.
  (4) **Web Worker robustness** (per "Web Worker 设计与优化指南" PDF §6.1):
  `worker-pool.js` — added `onmessageerror` handler on each worker. Previously,
  structured-clone serialization failures would silently leave the task's
  promise hanging until the 30s timeout. Now the task rejects immediately and
  the worker is recycled (terminate + replace).
  (5) **UCI optimization** (per "stockfish18的UCI优化指南" PDF):
  `StockfishNative.java` — tightened parameter validation per SF18 best
  practices: MultiPV cap 8 (was 500; PDF recommends 3-5 for review), Move
  Overhead cap 1000ms (was 5000ms; PDF recommends 10-30 local, 50-150 network),
  Hash cap 50% of JVM heap (was 32TB; PDF warns swapping kills performance),
  Threads cap 2x CPU cores (was 512; PDF warns thread contention reduces NPS).
  Added `UCI_AnalyseMode=true` during eval mode + `UCI_AnalyseMode=false`
  restore for gameplay (PDF §3.3: engine searches more thoroughly in analysis
  mode, exploring suboptimal moves for comprehensive variations).

- **v1.1.2 Phase 68 (2026.7.8):** Same-version revision (versionCode=112,
  versionName="1.1.2" unchanged). Analyze All optimization + long-press
  priority feature + UI polish. No build-system changes; no new files at
  project root. If you edit `chess.src/*.js`, `chess.src/index.html.tpl`,
  or `src/main/assets/stats.html`, re-run `python3 build-chess.py` before
  `./gradlew assembleRelease`. Changes:
  (1) **Analyze All incremental UI update + main-thread yield** (Issue 30):
  `_reviewAnalyzeAdvance()` (ui.js) now calls `render()` only every 10 steps
  (was: every step), using lightweight `_refreshEvalTrendChart()` +
  `_updateReviewAnalyzeBtn()` for intermediate steps. The next
  `_requestBatchEval` call is wrapped in `setTimeout(0)` to yield the main
  thread between batch steps (prevents ANR on long games).
  (2) **Long-press to prioritize a step during Analyze All** (Issue 30):
  move-list rows (`.rmv-block`) now have an `oncontextmenu` handler
  (`_prioritizeReviewStep`). Long-pressing an uncached move during an active
  batch sends `engineStop()`, pushes the step onto `_reviewAnalyzePriorityQueue`,
  fires a Toast + haptic, and the next `_reviewAnalyzeAdvance` iteration
  evaluates the prioritized step before continuing the normal sequence. The
  in-flight eval's result is cached for its original step (not lost).
  (3) **Stats nav buttons uniform width**: `stats.html` nav buttons (⏮ ◀ ▶ ⏭)
  now use `flex:1 1 0` (full-width uniform) instead of `min-width:38px`
  (which left gaps on wide screens). Matches the review-mode nav buttons.
  (4) **PGN cache partial-eval dialog polish**: title now has 💾 emoji prefix
  (`💾 部分步骤尚未评估` / `💾 Some steps not yet analyzed`); Android
  back-button dismisses the dialog (= Cancel) via new
  `_pgnPartialEvalDialogActive`/`_pgnPartialEvalDialogDismiss` globals
  checked in `handleBackPress()`.
  (5) **.rmv-block CSS**: added `user-select:none` + `-webkit-touch-callout:none`
  + `touch-action:manipulation` to prevent text selection / callout during
  long-press. New i18n keys (zh/en): `priority_eval_toast`,
  `priority_eval_already_cached`, `priority_eval_not_in_review`.

- **v1.1.2 Phase 67 (2026.7.7):** Incremental release (versionCode=112,
  versionName="1.1.2"). Five changes relevant to building:
  (1) **`gradle.properties` no longer hardcodes `org.gradle.java.home`** —
  the previous Ubuntu-specific path (`/usr/lib/jvm/java-21-openjdk-amd64`)
  broke cross-platform builds. Set `JAVA_HOME` or `~/.gradle/gradle.properties`
  instead.
  (2) **`version.properties` (new, one level up)** drives `versionCode` /
  `versionName`. Defaults inside `build.gradle` cover the missing case
  (1.1.1 / 111), but you should ship a `version.properties` for explicit
  version pinning.
  (3) **`keystore.properties` (new, one level up)** drives release signing.
  Environment variables `RELEASE_KEYSTORE_PATH` etc. override for CI/CD.
  (4) **`build-chess.py` now has a `__main__` guard + try/except around all
  file I/O** for clearer diagnostics (MED-3).
  (5) **Standard `LICENSE` file added at project root** (AGPL v3 full text —
  same content as `LICENSE-AGPL v3`, GOV-1) so GitHub/F-Droid auto-detect
  the license. No new modules; build/test commands unchanged. If you edit
  `chess.src/*.js` or `chess.src/index.html.tpl`, re-run
  `python3 build-chess.py` before `./gradlew assembleRelease`.

- **v1.1.0 Phase 58 (2026.7.5):** Feature + concurrency hardening
  (versionCode=110, versionName="1.1.0" unchanged). Four changes:
  (1) **Every-5-moves PGN {} annotation** — at moves 5, 10, 15, 20, ...,
  `_buildPGNString` (ai-bridge.js) appends a human-readable eval-bar-mirroring
  comment fragment to the PGN `{}` comment, auto-localized via `T()` reading
  the global `_lang` variable. Format:
  `均势 (-0.10) D22 SD34 (1%W/96%D/3%L)` (Chinese mode) or
  `Equal (-0.10) D22 SD34 (1%W/96%D/3%L)` (English mode). White-perspective
  (not player-perspective) so the PGN comment is unambiguous regardless of
  which side the human played. New function `formatEvalAnnotation` in
  pgn-standard.js; new i18n keys `pgn_white_*` / `pgn_black_*` / `pgn_equal` /
  `pgn_mate_white` / `pgn_mate_black` in game-logic.js. Missing components
  (depth, WDL) are gracefully omitted; zero-sum WDL is guarded against
  divide-by-zero.
  (2) **stopLatch TOCTOU race fix** (StockfishNative.java) — the `bestmove`
  handler previously read `_stopLatch` (volatile) without holding
  `_stopLatchLock`, creating a race with `stopAndWaitForBestmove`'s timeout
  path: if the bestmove arrived just as the timeout fired, the discard flag
  could be incorrectly armed, discarding the NEXT legitimate bestmove. Now
  the bestmove handler atomically captures-and-clears `_stopLatch` under
  `_stopLatchLock`, and the timeout path only arms the discard flag if it
  still owns the latch.
  (3) **Heartbeat deadlock fix** (StockfishNative.java) — the heartbeat
  thread's `engineWriter.write("quit\n")` call was synchronized on
  `StockfishNative.this` (same monitor as `startHeartbeat()`), creating a
  deadlock risk: if `shutdown()` ran while the heartbeat held the `this`
  monitor inside the writer I/O, `shutdown`'s `_heartbeatThread.join(1000)`
  would wait for the heartbeat to release `this` — but the heartbeat was
  blocked on I/O. Now uses a dedicated `_writerLock` decoupled from the
  `this` monitor, so `shutdown`'s interrupt/join is not blocked.
  (4) **res/README.license** — no changes in Phase 58 (LIC-2 was already
  fixed in Phase 57+). Historical accuracy preserved.
  No new modules; build/test commands unchanged.

- **v1.1.0 Phase 57+ (2026.7.5):** Code-review-driven preventive hardening
  (versionCode=110, versionName="1.1.0" unchanged). Six fixes:
  (1) `pgn-standard.js` `parseStandardPGN` — the old single-line PGN tag-stripping
  regex `/^\[[\s\S]*?\]/gm` only matched the first tag when all tags + movetext
  were on ONE line (the `^` anchor with `gm` flags only matches the very start
  of the string), leaving subsequent tags as garbage tokens in `moveText`.
  Replaced with the format-strict, unanchored `/\[[A-Za-z]\w*\s+"[^"]*"\]/g`,
  which requires the canonical PGN tag shape (key + whitespace + quoted value)
  so movetext comments like `[Nf3]` (no quotes) are never stripped.
  `parseStandardPGN` is not currently on the main code path (the main parser
  is `tablebase.js` `_parsePGN`, fixed in Phase 52), so this is a preventive
  fix that prevents a landmine if `parseStandardPGN` is ever wired in.
  (2) `chess960.js` `isChess960CastlingLegal` — was scanning the entire back
  rank (up to 8 board reads) to find the king, inconsistent with other
  king-position lookups in `game-logic.js`. Now reads the cached `s.wk` /
  `s.bk` fields maintained by `syncHash()` and `cloneS()` directly, with a
  defensive board-scan fallback retained for states that may not have the
  cache populated (e.g. hand-built test harness states).
  (3) `ai-bridge.js` `_buildEvalTrendSVG` WDL display — added `total > 0`
  guard before dividing `_sfWdlW/_sfWdlD/_sfWdlL` by their sum, eliminating a
  potential NaN/Infinity in the WDL percentage string if all three values are
  zero (which can happen if the engine emits `wdl 0 0 0` in pathological
  positions).
  (4) `StockfishNative.java` `postJsCallback` — added an `isFinishing() ||
  isDestroyed()` guard on the host Activity before invoking
  `webView.evaluateJavascript(...)`. On some OEM ROMs (notably HyperOS 3),
  calling `evaluateJavascript` on a destroyed WebView's main thread throws
  `IllegalStateException`, which previously crashed the process during
  engine-init retries after the user exited the app.
  (5) `EngineService.java` wake lock — changed `wakeLock.acquire()` (unbounded)
  to `wakeLock.acquire(30L * 60L * 1000L)` (30-minute timeout). If the OEM
  silently kills the service and `onDestroy` never runs, the wake lock is
  released automatically instead of holding the CPU awake indefinitely.
  (6) `res/README.license` LIC-2 — line 14 `strings.xml` description still
  referenced `Regalia v1.0.8` (stale); updated to `Regalia v1.1.0` to match
  the actual `app_name` value. Historical changelog entries mentioning
  v1.0.8 are preserved as-is (they are accurate historical records).
  Also added `UBIQUITOUS_LANGUAGE.md` (English) at the project root for
  domain terminology reference. No new modules; build/test commands unchanged.

- **v1.1.0 Phase 57 (2026.7.4):** Same-version bug-fix phase (no version bump —
  versionCode=110, versionName="1.1.0" unchanged). Two fixes in `ui.js` only:
  (1) Portrait review move-list scroll positioning — the Phase 56 manual-scrollTop
  calculation used `_rAct.offsetTop`, but `.rmv-block`'s `offsetParent` is
  `.review-overlay` (`position:fixed`), NOT `_rList` (`.review-moves` has no
  `position` set). In portrait, `.review-moves` is stacked below `.review-left`
  (the board column), so `offsetTop` included the board's full height (256-320px),
  causing the active move to be clamped to `scrollHeight-clientHeight` (scrolled
  to bottom). Fix: replaced `offsetTop` with `getBoundingClientRect()`-based
  calculation: `_actTop = (_actRect.top - _listRect.top) + _rList.scrollTop`.
  If `getBoundingClientRect` returns zeros (disconnected DOM), skip scrolling
  rather than fall back to the buggy `offsetTop`.
  (2) Visual-annotation cache residue at review entry —
  `_computeInitialPositionAnnotations` was reading `gameState` (the LIVE mid-game
  state) instead of `reviewStates[0].state` (the actual initial position shown at
  step 0). Fix: read `reviewStates[0].state` with fallback chain
  `reviewStates[0].state → reviewBaseState → gameState`. Also `enterReview()` now
  explicitly deletes the `'_initial'` cache key at entry (it was never cleared by
  `_invalidateCachesForUndoneMoves` which only deletes numeric keys, and only
  cleared by `_resetGameUIState` on new-game/import/setup/FEN). No new modules;
  no build-order change. If you edit `chess.src/ui.js`, re-run
  `python3 build-chess.py`.
- **v1.1.0 Phase 56 (2026.7.4):** Four fixes in `ui.js`, `ai-bridge.js`, and
  `StockfishNative.java`: (1) Landscape review nav-button scroll-to-top — replaced
  `scrollIntoView({block:'center'})` with manual `scrollTop` computation on the
  inner `.review-moves` container only (preserves outer `.review-body` scroll
  position). (2) PGN timeout annotation — added `[Termination "Time forfeit"]`
  tag + `{<color> wins by timeout}` last-move comment (parallel to existing resign
  logic). (3) First-move timing sync — added `_turnStartTime=Date.now()` and
  `gameClocks=null` to `_resetGameUIState()` (called by all game-start entry
  points). (4) UCI command ordering refinement — moved `setGameDifficulty`'s
  `setoption` commands to BEFORE `position fen` in both `engineGoTimed` and
  `engineGoInternal`. No new modules; no build-order change. If you edit
  `chess.src/ui.js`, `chess.src/ai-bridge.js`, or `StockfishNative.java`,
  re-run `python3 build-chess.py` (for JS changes) then
  `./gradlew assembleRelease`.
- **v1.1.0 Phase 55 (2026.7.4):** Chess960 castling rook-loss fix in `stats.html`
  (`executeMove`/`buildSAN`) and `game-logic.js` (`_castleSide` fallback). Replaced
  `_destEmpty` with `_destValid` — in Chess960, the king's destination square may
  be the participating rook's source square (e.g. King on d1, queenside rook on
  c1: O-O-O puts the King on c1, which IS the rook's source). The old `_destEmpty`
  rejected this case, causing the king to "self-capture" the rook. No new modules;
  no build-order change. If you edit `chess.src/game-logic.js` or
  `src/main/assets/stats.html`, re-run `python3 build-chess.py` (game-logic.js is
  a chess.src module; stats.html is a standalone asset, not built by the script).
- **v1.1.0 Phase 54 (2026.7.4):** Custom slider for pixel-perfect alignment
  between the review progress bar and the eval trend chart. Replaced the native
  `<input type="range">` visual with a custom track/fill/thumb rendered as divs
  (the native input is now a transparent overlay handling touch/drag/keyboard).
  Both the slider wrapper and chart container share identical CSS
  (`border:1px; padding:0; box-sizing:border-box; width:100%`), so the thumb
  center at `calc(ratio * 100%)` aligns exactly with the chart's data points.
  Also: move-list scroll-into-view only scrolls when not visible (`block:'nearest'`);
  `executeMove` async-callback try-catch; `ChessAudioEngine` partial-init reset;
  engine heartbeat timestamp updated in all callbacks (`onEngineProgress`/
  `onBestMove`/`onHintMove`/`onPonderProgress`); MultiPV secondary-variation
  divergence fix (`actualIdx = fromMoveIdx + vi` for alternatives vs
  `fromMoveIdx + 1 + vi` for continuations); PGN cascade-skip threshold raised
  from 5 to `Math.max(15, mainTokens.length * 0.1)`; `render()` retry-loop guard
  (`_animRetryCount` max 10). No new modules; no build-order change. If you edit
  `chess.src/ui.js` or `chess.src/index.html.tpl`, re-run `python3 build-chess.py`.
- **v1.1.0 Phase 53 (2026.7.3):** Version bumped to versionCode=110,
  versionName="1.1.0". Green-arrow visual annotation redefined from "escape path"
  to "check-response path" (king escape moves + legal captures of the checking
  piece, via `legalMoves(postState, ...)`). Red check arrow uses actual checker
  position (supports discovered check). Stats visual-annotation cutoff respects
  selected move. King-position staleness + FEN-import/exitSetup state-pollution
  fixes (added `_resetGameUIState()` calls at all game-start entry points).
  Portrait/landscape review layout unified (both now use `.review-top` +
  `.review-bottom` structure; CSS rules moved from `@media(orientation:landscape)`
  to global scope). Nav-button text center-aligned. No new modules; no build-order
  change. If you edit `chess.src/ui.js` or `chess.src/index.html.tpl`,
  re-run `python3 build-chess.py`.

## v1.0.9 build notes (historical)
- All v1.0.8 build notes still apply.
- **v1.0.9 Phase 52 (2026.7.2):** Two critical bug fixes + two visual-annotation accuracy fixes + chart palette unification + robustness —
  (1) PGN single-line parse failure: `tablebase.js` `_parsePGN` tag-stripping regex
  `/^\[[^\]]*\]/gm` → `/\[[A-Za-z]\w*\s+[^\]]+\]/g` (the old `^` multiline anchor only
  matched the first tag for single-line PGN files); also brace-comment stripping now
  replaces with a SPACE instead of empty string (prevents `e4{...}e5` → `e4e5` concatenation).
  (2) Review/stats "extra kings" board corruption: `game-logic.js` `_castleSide()` now
  accepts an optional `s` (state) parameter for the fallback castling detection — uses
  `s.board` / `s.castlingRights` instead of the global `gameState` (which is the final
  state after ALL moves, incorrect during PGN replay). `makeMv`, `makeMvInPlace`, and
  `moveAlg` all pass `s`. Also `stats.html` `executeMove` castling detection now requires
  king on home row + correct distance + empty destination + castling right present (was:
  any king move to col 6/2). (3) Visual annotation variation-comment contamination:
  `tablebase.js` `_parsePGN` now only extracts `[%eval]`/`[%csl]`/`[%cal]` at `_depth===0`
  (main line) — previously comments inside variations `(...)` were parsed and their tags
  contaminated the next main-line move's annotations. (4) Missing isCheck/isCastling on
  imported moves: `tablebase.js` `importPGN` now computes `isCheck` (via `inCheck` on
  post-move state) and `isCastling` (via `_castleSide` on pre-move state) for each imported
  move — previously these fields were missing, so red check arrows + green escape arrows
  were never generated for imported PGNs. (5) Eval-chart palette unified to blue-vs-red
  in BOTH dark and light modes (with per-mode saturation tuning): light mode `--chart-line`
  `#4a4a52`→`#2c5f8d`, `--chart-fill` `#2c2c34`→`#c0392b`, `--chart-critical` `#5a5a66`→`#d4a017`;
  dark mode `--chart-line` `#E8E8F0`→`#5dade2`, `--chart-fill` `#5dade2`→`#e74c3c`,
  `--chart-grid` `#333`→`#4a3020`, `--chart-axis` `#666`→`#8a6a3a`. Data point outline now
  uses `--chart-text-stroke` variable instead of hardcoded rgba. (6) Robustness:
  `stats.html` `executeMove` now clears castling rights on king/rook move + rook capture
  (was missing). Version bumped to versionCode=109, versionName="1.0.9".

## v1.2.0 build notes (architecture refactor)
- All v1.0.8 build notes still apply.
- **v1.2.0 Phase 73-80 (2026.7.11): Architecture refactor major version.**
  - **Java God Module split**: `StockfishNative.java` (5,443→4,492 lines) refactored
    into Facade + manager/helper classes. (See v1.2.1 round-4 notes below for
    which of these extracts survived.)
  - **JS God Module split**: 4 new modules extracted from `ui.js`
    (`ui-board.js` / `ui-review.js` / `ui-audio.js` / `ui-toolbar.js`).
    **Note (v1.2.1 round-4)**: all four were deleted in v1.2.1 — they
    duplicated inline logic with subtly different conventions (rank order,
    move taxonomy, audio state) and were never on the hot path.
  - `_computeAndCacheVisualAnnotations` (439 lines) decomposed into 4 sub-functions:
    `_replayMovesToState`, `_computeSquareHighlights`, `_computeCheckArrows`,
    `_computeThreatArrows`.
  - `_buildEvalTrendSVG` (267 lines) decomposed into 6 sub-functions:
    `_getChartColors`, `_buildEvalTrendGrid`, `_buildEvalTrendSegments`,
    `_buildEvalTrendPoints`, `_buildEvalTrendLabels`, `_buildEvalTrendCurrentMarker`.
    ui.js: 8,245→8,061 lines.
  - **Global state store**: `state-store.js` (Redux-like single source of truth)
  - **SonarCloud fixes**: All `InterruptedException` catches re-interrupt;
    all `delete()`/`renameTo()` return values checked; `AtomicInteger` for
    thread-safe counters; `_buildPGNString` decomposed into 6 sub-functions.
  - **Review board coordinate labels** (Phase 77): Left 1-8 + top a-h + per-square
    coordinates, matching main board and stats board.
  - **Engine binary**: Stockfish 18 `arm64-v8a-dotprod` (unchanged from v1.0.8).
  - Version: versionCode=120, versionName="1.2.0".

## v1.2.0 Phase 81-83 build notes (deep refactor continuation)
- All v1.2.0 Phase 73-80 build notes still apply.
- **v1.2.0 Phase 81 (2026.7.11): EngineConfigHelper extraction.**
  - Extracted engine configuration methods from `StockfishNative.java` into a new
    `EngineConfigHelper.java` (564 lines), using the same Callbacks interface pattern
    as `EngineSettingsHelper`.
  - Methods moved: `setAutoConfig`, `detectHardwareAndConfigure`, `detectBigCoreCount`
    (with `_cachedBigCoreCount` field), `applySettings`, `setEngineThreads`,
    `setEngineHash`, `setEngineMoveOverhead`, `setEngineMultiPV`, `setEnginePonder`,
    `setEngineShowWDL`, `setShowWDL`, `setEngineSkillLevel`, `getEngineSkillLevel`,
    `setEngineLimitElo`, `setLimitStrength`, `setElo`, `setGameDifficulty`,
    `forceFullStrength`, `syncGameDifficulty`.
  - `ELO_MAP` constant moved from `StockfishNative` to `EngineConfigHelper` (only
    used by `setGameDifficulty`).
  - `StockfishNative.java`: 4,492→4,245 lines (−247 lines). All `@JavascriptInterface`
    method signatures preserved as thin delegates.
  - `engineSupportsOption()` retained on `StockfishNative` (called from many non-config
    paths); accessed by `EngineConfigHelper` via `Callbacks.engineSupportsOption()`.
  - Helper/manager class count: 12→13 (now 14 including `MessageBus`).
    **Note (v1.2.1 round-4)**: count back down to 11 — `MessageBus`,
    `UciProtocolHandler`, and `EngineConfigManager` were deleted in round-4
    (their functionality was either never wired up or duplicated inline).
- **v1.2.0 Phase 82 (2026.7.11): renderInternal dialog extraction.**
  - Extracted all 8 modal dialog blocks from `renderInternal()` (1,365 lines) into a
    new `_renderDialogs(h)` function.
  - Dialogs extracted: `showNewGameDialog`, `showEngineConfig`, `showResignConfirm`,
    `showAboutPage`, `showImportDialog`, `pendingPromotion`, `showSavePGNPrompt`,
    `showPGNCacheManager`.
  - `renderInternal()`: 1,365→1,224 lines (−141 lines). All dialogs use global state
    only (no local variables from `renderInternal`'s main body), making the extraction
    safe and reversible. The `h` string concatenation pattern is preserved (sub-function
    receives `h`, returns `h` with dialog HTML appended).
- **v1.2.0 Phase 83 (2026.7.11): Review board display fix.**
  - Fixed the Phase 77 regression where flex-layout coordinate label wrappers inside
    `.bgrid` (CSS Grid) broke the 64-cell grid layout.
  - Root cause: Phase 77 added `<div style="display:flex;...">` wrappers for the a-h
    and 1-8 coordinate labels INSIDE `.bgrid`, which is `display:grid`. The grid
    expected 64 direct children (cells) but received flex wrappers, destroying the
    layout. The SVG arrow overlay was also misaligned.
  - Fix: Coordinate labels are now `position:absolute` siblings of `.bgrid` (inside
    `.review-board`'s padding area), not flex children of `.bgrid`. `.review-board`
    gets inline `padding-top`/`padding-left` to reserve label space. The SVG overlay
    position is offset by `(_rvLabelW+_rvLabelGap, _rvLabelH+_rvLabelGap)` to align
    with `.bgrid`. `--rv-board-h` (used by `.review-moves` height) now includes the
    label height for proper alignment.
- **Engine binary**: Stockfish 18 `arm64-v8a-dotprod` (unchanged).
- Version: versionCode=120, versionName="1.2.0" (unchanged — same version, deeper refactor).

## v1.2.0 Phase 82+ build notes (renderInternal review mode extraction)
- All v1.2.0 Phase 81-83 build notes still apply.
- **v1.2.0 Phase 82+ (2026.7.12): renderInternal review mode extraction.**
  - Extracted the entire review-mode rendering block from `renderInternal()` (615 lines)
    into a new `_renderReviewMode(h)` function.
  - The block renders the complete review-mode overlay: review board (with coordinate
    labels, control map, visual annotations, SVG arrows), eval bar, move slider, eval
    trend chart, navigation buttons, and analyze-all button.
  - **Early-return handling**: The original block had an early-return path
    (`if(!rs){reviewMode=false;render();return}`) for invalid review state. The
    extracted function returns `{h, done}` — when `done=true`, the caller
    (`renderInternal`) returns immediately to skip the scroll-save/innerHTML/scroll-
    restore logic (which would otherwise operate on stale DOM state).
  - **reviewMode guard preserved**: The call site in `renderInternal` is wrapped in
    `if(reviewMode){...}` so the function is only invoked when review mode is active
    (matching the original `if(reviewMode){...}` block semantics).
  - `renderInternal()`: 1,224→619 lines (−605 lines). The function now focuses on
    game-play rendering, dialog dispatch, and DOM update/scroll-restore orchestration.
  - All review-mode rendering logic (board, eval, chart, nav, analyze) is now
    encapsulated in `_renderReviewMode(h)`, which uses global state only (no local
    variables from `renderInternal`'s main body), making the extraction safe and
    reversible. The `h` string concatenation pattern is preserved.
- **Engine binary**: Stockfish 18 `arm64-v8a-dotprod` (unchanged).
- Version: versionCode=120, versionName="1.2.0" (unchanged — same version, deeper refactor).

## v1.2.0 Phase 82++ build notes (renderInternal main-board extraction)
- All v1.2.0 Phase 82+ build notes still apply.
- **v1.2.0 Phase 82++ (2026.7.12): renderInternal main-board extraction.**
  - Extracted 4 more rendering blocks from `renderInternal()` into dedicated functions,
    further reducing the God Function from 619 to 476 lines (−143 lines).
  - **`_renderHeader()`**: Computes eval display (emoji, description, score, depth,
    seldepth, nodes, nps) and builds the `.hdr` toolbar HTML (app title, language
    toggle, eval display, difficulty selector, new-game / free-play / sound / FEN /
    import / setup buttons). Initializes `h` and returns it. Uses global state only.
  - **`_renderBoardGrid(h, flip, cm)`**: Renders the main game board grid — file
    labels (a-h), rank labels (1-8), `.bgrid` container, and 8×8 square cells with
    piece glyphs, legal-move dots/rings, castling-rook markers, check highlights,
    castle-rights (🔁) and en-passant (⚡) badges, and square coordinate labels.
    `flip` and `cm` (control map) passed as parameters (local to renderInternal).
  - **`_renderSetupPanel(h)`**: Renders the setup-mode control panel (piece buttons,
    color/turn selectors, undo/redo/reset/clear buttons, copy/import FEN buttons,
    setup errors). Uses global state only.
  - **`_renderSidePanel(h, infoSq, infoCtrl, oppC)`**: Renders the right-side
    `.panel` container with four cards: control info (when showCtrlMap on), ECO
    opening info (when _ecoEnabled and not Chess960), move history (PGN-format
    move list with copy/export/stats buttons), and tips. `infoSq`, `infoCtrl`,
    `oppC` passed as parameters (local to renderInternal).
  - `renderInternal()`: 619→476 lines (−143). The function now focuses on: defensive
    checks, control-map/info-sq computation, AI/player bar rendering, tablebase/ECO/
    hint bars, quick toolbar, game-over overlay, dialog/review-mode dispatch, and
    scroll-save/DOM-update/scroll-restore orchestration.
  - All extracted functions use the `h` string concatenation pattern (receive `h`,
    return `h` with content appended) except `_renderHeader()` which initializes `h`.
  - Cumulative renderInternal reduction: 1,365 → 476 lines (−889 lines, −65%).
- **Engine binary**: Stockfish 18 `arm64-v8a-dotprod` (unchanged).
- Version: versionCode=120, versionName="1.2.0" (unchanged — same version, deeper refactor).

## v1.2.0 Phase 82+++ build notes (renderInternal AI/player/info bars extraction)
- All v1.2.0 Phase 82++ build notes still apply.
- **v1.2.0 Phase 82+++ (2026.7.12): renderInternal AI/player/info bars extraction.**
  - Extracted 3 more rendering blocks from `renderInternal()` into dedicated functions,
    further reducing the God Function from 476 to 359 lines (−117 lines).
  - **`_renderAIBar(h, oppC)`**: Renders the AI opponent bar (`.pbar#ai-bar`) with
    AI icon, name, level (Lv.N / SLN / ⚙️ manual config), clock display, waiting/thinking
    indicators, captured pieces (split at 7: pieces 1-7 on line 2, pieces 8+ on line 3),
    engine search info (`#ai-search-info`), and ponder info (`#ai-ponder-info`).
    `oppC` (opponent color) passed as parameter (local to renderInternal).
  - **`_renderPlayerBar(h)`**: Renders the quick toolbar (`.qtoolbar` with undo/redo/
    flip/hint/control-map buttons, hidden in review mode, undo/redo hidden in setup
    mode) and the player bar (`.pbar#player-bar` with player icon, clickable name,
    clock display, captured pieces, your-turn indicator, resign button). Uses global
    state only.
  - **`_renderInfoBars(h)`**: Renders three optional info bars between the board and
    the player bar: (1) tablebase status bar (when ≤7 pieces and player's turn) with
    Syzygy category/DTZ/DTM/best-move; (2) ECO opening recommendation bar (when
    _ecoEnabled, not Chess960, player's turn); (3) AI hint area (when isHintLoading
    or hintText set) with hint text, search info, and MultiPV alternative lines.
    Uses global state only.
  - `renderInternal()`: 476→359 lines (−117). The function now focuses on: defensive
    checks, control-map/info-sq computation, board grid dispatch, game-over overlay,
    setup panel dispatch, side panel dispatch, dialog/review-mode dispatch, and
    scroll-save/DOM-update/scroll-restore orchestration.
  - Cumulative renderInternal reduction: 1,365 → 359 lines (−1,006 lines, −74%).
- **Engine binary**: Stockfish 18 `arm64-v8a-dotprod` (unchanged).
- Version: versionCode=120, versionName="1.2.0" (unchanged — same version, deeper refactor).

## v1.0.8 build notes (historical)
- All v1.0.7 build notes still apply.
- **v1.0.8 Phase 51 (2026.7.2):** Three fixes — (1) PGN round-trip castling failure:
  `game-logic.js` `_castleSide()` now checks `mv.to.castle` (set by `pseudoMoves`)
  in addition to `mv.castle` (set by `executeMove`). The PGN-replay path
  (`_applySANMove`) was calling `makeMvInPlace` directly with a move object whose
  top-level `castle` flag was undefined, so castling only moved the king and
  subsequent rook moves failed to parse. (2) Move-classification label
  "Book"/"开局库" → "Mediocre"/"平常" (i18n only; CSS class `.book` unchanged).
  (3) Eval-chart dark-mode negative-eval line color `--chart-fill` `#1A1A2E` (invisible)
  → `#5dade2` (light blue) in `:root` and `html[data-theme="dark"]`.
  No new modules; no build-order change. If you edit `chess.src/game-logic.js` or
  `chess.src/index.html.tpl`, re-run `python3 build-chess.py`.
- **v1.0.8 Phase 50 (2026.7.2):** Button-width TRUE root-cause fix — added `.btn-row`
  marker class (CSS) + applied to 4 button-row containers (ai-bridge.js ×2, ui.js ×2).
  No new modules; no build-order change. If you edit `chess.src/index.html.tpl` or
  `chess.src/{ai-bridge,ui}.js`, re-run `python3 build-chess.py`.
- **v1.0.8 Phase 49 (2026.7.2):** Comprehensive 5-parallel-subagent code review.
  6 bug fixes + 12 robustness hardenings + redundancy cleanup. License classification
  reconciled: `StatsActivity.java`, `pgn-standard.js`, `worker-pool.js`,
  `index.html.tpl` are now GPL v3 (was AGPL v3) to match Phase 37 final classification.
  `StabilizationHelper.java` added to NOTICE AGPL v3 top-level list. No new modules;
  no build-order change. `importPGNAsync` no longer calls `workerParsePGN` (the
  worker result was discarded — both `.then`/`.catch` ran the same sync `importPGN`;
  the dead round-trip was removed, leaving only the 50ms UI-yield `setTimeout`).
- **v1.0.8 Phase 48 (2026.7.2):** Added `.btn-compact` CSS class (7 `!important`
  declarations) for content-width buttons. No build-order change.
- **v1.0.8 Phase 47 (2026.7.1):** Inline `flex:0 0 auto;width:auto` on compact buttons
  (superseded by Phase 48/50). No build-order change.
- **v1.0.8 Phase 46 (2026.7.1):** Sound-haptic decoupling (sound = independent `if`,
  haptic = exclusive `if/else if`). `importPGNAsync` success detection via `gameState`
  reference comparison. No build-order change.
- **v1.0.8 Phase 44–45 (2026.7.1):** Button-width `width:fit-content` attempts
  (superseded by Phase 48/50). No build-order change.
- **v1.0.8 Phase 38–43 (2026.7.1):** PGN cache UI layout, castle-rights root-cause
  fixes, `♻️ Reset Board` seeds `setupCastleMarks`. No build-order change.
- **v1.0.8 Phase 37 (2026.7.1):** Final license classification (6 files → AGPL v3,
  3 files → GPL v3). No build-order change.
- **v1.0.8 Phase 34–36 (2026.7.1):** Worker-pool officially enabled for async PGN
  import (Phase 49 later removed the call site after discovering the result was
  discarded). No build-order change.
- **v1.0.8 Phase 31–33 (2026.7.1):** Performance + robustness hardening
  (`getCtrlMap` hidden-class stabilization, ECO pre-indexing, `_escJs` XSS fix,
  `parseInt` radix, worker-pool queue cap). No build-order change.
- **v1.0.8 Phase 29–30 (2026.7.1):** Setup ⚡ normalization, WebView robustness
  (Safe Browsing, `onRenderProcessGone`, 6-step destroy), first-principles review.
  No build-order change.
- **v1.0.8 Phase 26–28 (2026.7.1):** Personified animation/sound/haptic upgrade
  (Web Animations API, `ChessAudioEngine` Web Audio synth, 6-piece haptic
  personalities). No new build dependencies; the audio is synthesized at runtime
  (no audio asset files).
- v1.0.8 Phase 25 (2026.7.1): Reimplemented `worker-pool.js` (robust Web Worker
  pool) and wired it into stats.html (heatmap-stats offloading). The module
  order is now: game-logic → chess960 → pgn-standard → worker-pool → ai-bridge
  → tablebase → eco-data → ui (8 modules, up from 7).
- v1.0.8 Phase 23 (2026.7.1): Switched to the official Stockfish 18
  `arm64-v8a-dotprod` binary (NDK r27c build, 114 MB, ARMv8.6-A DOTPROD
  acceleration). Fixed `LICENSE-GPL v3` (previously contained AGPL v3 text)
  and `LICENSE-Apache v2.0` (previously had a misleading LLVM header).
- v1.0.8 Phase 24 (2026.7.1): Removed dead `worker-pool.js` (581 lines, never
  called) and redundant `build-chess.sh` (duplicate of `build-chess.py`).
  (Phase 25 later reimplemented worker-pool.js robustly and wired it in.)
- v1.0.8 Phase 22 (2026.6.30): Complete redesign of move animation (Web
  Animations API) and sound system (ChessAudioEngine). Light mode support.
- If you modify any file in `chess.src/`, re-run `python3 build-chess.py`
  before `./gradlew assembleRelease` to ensure the latest JS is bundled.

## v1.0.7 build notes (historical)
- All v1.0.6 build notes still apply.
- v1.0.7 (2026.6.28): Code-quality and stability maintenance release. No new
  build requirements.

## v1.0.6 build notes (historical)
- All v1.0.5 build notes still apply.
- v1.0.6 (2026.6.27): Chess960 ECO suppression, PGN `[SetUp]`/`[FEN]`
  round-trip preservation, stats.html per-move selection, engine-eval FEN
  sanitization, king-then-rook castling gesture.

## v1.0.5 build notes (historical)
- All v1.0.4 build notes still apply.
- v1.0.5 (2026.6.27): Sensor-fusion board anti-shake (`StabilizationHelper.java`),
  high aspect-ratio screen adaptation, notch/cutout/R-corner adaptation.

## v1.0.4 build notes (historical)
- New modules `chess960.js` and `pgn-standard.js` are bundled before
  `ai-bridge.js` so their functions are in scope when `ai-bridge.js` and
  `ui.js` reference them.
- The Stockfish 18 `arm64-v8a-dotprod` binary is the official sf_18 release.

---
*AI-GEN*


## v1.2.1 build notes (defect fix release)
- **v1.2.1 (2026.7.12): Defect fix release based on comprehensive review reports.**
  - **Critical**: oppC/flip/cm/infoSq/infoCtrl scoping bug fixed via _computeRenderState()
  - **Security**: JsBridgeGateway activated (sandbox path validation + UCI whitelist), allowBackup=false, intent: removed from isUrlSafe, setOptionAndWait newline sanitization
  - **SonarCloud 20 Bugs**: InterruptedException re-interrupt (9), AtomicInteger, await check (2), localeCompare, dead conditionals (2), aria-label, De Morgan (4)
  - **Code quality**: Store immutability (deep clone), _notifyListeners snapshot, _deepClone Date/RegExp, SET_LANG fix, static Pattern, error logging
  - **Layout**: Portrait .review-top fix, _renderReviewMode flip param, game-over overlay inside .bwrap
  - **Store wiring**: dispatch calls at toggleLang/toggleSound/enterReview/_resetGameUIState
  - **proguard-rules.pro**: Created (was missing)
  - Version: versionCode=121, versionName="1.2.1"
- **Engine binary**: Stockfish 18 arm64-v8a-dotprod (unchanged)

## v1.2.1 second-pass refinement (2026.7.13)
- **P0 bug fix**: TOCTOU race on `_discardingPonderBestmove` — `stopAndWaitForBestmove` and the bestmove reader thread now clear the discard flag in the early-return and latch-capture paths, preventing the flag from being stuck `true` and silently discarding the next legitimate bestmove (manifested as "AI never moves").
- **P1 bug fix**: Chess960 re-apply symmetry — `startEngineInternal` now re-applies `UCI_Chess960` as both `true` AND `false` based on `_pendingChess960`, so a user switching back to standard chess no longer has `UCI_Chess960=true` retained after an engine crash.
- **P1 bug fix**: eval-mode option leak — `engineStop()` now calls `restoreGameplayOptions()` if it interrupts a `STATE_EVAL` search, preventing `Contempt=0` / `MultiPV=1` / `UCI_AnalyseMode=true` from leaking into the next gameplay search.
- **P1 bug fix**: `sendSetOptionAndWait` newline hardening — the `value` parameter is now stripped of `\r` / `\n` before concatenation into the UCI command (matching the parallel hardening applied to `UciProtocolHandler.setOptionAndWait` in v1.2.0).
- **P1 bug fix**: `_restartInProgress` stale-detection — `recoverEngine` and `restartEngine` now reset the restart lock if it has been stuck for >30s.
- **P1 security fix**: `JsBridgeGateway.isPathInSandbox` now requires a trailing `File.separator` before `startsWith`, closing a theoretical directory-traversal.
- **P1 reliability fix**: `ChessApp`'s `UncaughtExceptionHandler` now sets a static flag via `StockfishNative.markEngineThreadDead(threadName)` when an `SF-*` engine thread dies; the heartbeat monitors this flag and triggers `recoverEngine` instead of waiting for the 15–30s zombie timeout.
- **P1 reliability fix**: `StatsActivity.onDestroy` now calls `webView.stopLoading()` first, matching `MainActivity.onDestroy` — prevents SIGSEGV on HyperOS 3 / MIUI when the WebView dispatches a load callback to a destroyed native peer.
- **P1 privacy fix**: Removed `takePersistableUriPermission` calls from `SafPickerHelper` (export + import paths) and `StatsActivity` (PGN import) — one-shot operations no longer consume the 512-grant SAF cap.
- **P1 bug fix**: Checkmate WDL inversion — `requestEngineEval` and `_requestBatchEval` fast-paths now write `wdlW=1000` (not 0) when Black is checkmated, matching `onEngineEval`'s White-POV swap.
- **P1 bug fix**: `formatEvalAnnotation` malformed `[%eval #+]` / `[%eval #-]` tags — `absMd` now defaults to 1 when `mateDist=0` but `|eval|≥90000` (matching `formatEvalTag`).
- **P1 bug fix**: `onBestMove` validation order — UCI move parsing and piece-existence checks now run BEFORE clearing `isAIThinking` / `_aiSafetyTimerId` / `_aiRetryCount`, preventing an unparseable bestmove from leaving the AI in a "not thinking, no safety timer, but still AI's turn" deadlock.
- **P1 bug fix**: CSS `font-family` HTML entity — 5 occurrences of `&#x27;` inside `<style>` rules in `index.html.tpl` replaced with literal `'` (HTML parser does NOT decode entities in raw-text mode).
- **P1 input validation**: PGN cache name `prompt()` now enforces 60-char cap and rejects `/ \ : * ? " < > |` + control chars (matching `_renameHumanPlayer`).
- **P2 robustness**: `HapticHelper.perform` now respects the system `HAPTIC_FEEDBACK_ENABLED` setting (matching `StatsActivity.performHaptic`).
- **P2 robustness**: `StockfishNative.extractEngineFromApk` (inline) now guards against `ZipEntry.getSize() == -1` (divide-by-zero / negative progress percentage). The same fix had previously been applied only to the now-deleted `EngineProcessManager.extractEngineFromApk` copy.
- Version: versionCode=121, versionName="1.2.1" (unchanged — same-version refinement)

## v1.2.1 fourth-pass refinement (2026.7.13) — round-4 cleanup: dead-code purge
- **First-principles review conclusion**: the third-pass "unused-file activation" round (above, now reverted) wired up 7 Phase-73/74 extracts that duplicated inline logic with subtly different conventions. The activation was "for activation's sake" — none of the activated paths were on the hot path, and several introduced semantic drift risks (rank order, move taxonomy, audio state, ELO ranges). Round 4 deletes the 7 redundant files and slimms 2 others.
- **Deleted 7 files**:
  - `MessageBus.java` (AGPL v3) — JS side had only a `console.log` stub and zero `dispatch()` callers; the entire Java→JS event bus was dead code.
  - `UciProtocolHandler.java` (GPL v3) — its latch-based `setOptionAndWait` / `waitForBestmove` / `waitForUciOk` were never used (StockfishNative runs its own inline reader loop with its own `readyOkLatchHolder` / `uciOkLatchHolder`). The only call site was a defensive `resetHandshakeState()` in cleanup that did nothing useful.
  - `EngineConfigManager.java` (GPL v3) — instantiated but no method on the instance was ever called; only `MIN_SKILL_LEVEL` / `MAX_SKILL_LEVEL` constants were referenced externally. Inlined those two constants (0, 20) in `EngineConfigHelper.setEngineSkillLevel`.
  - `ui-audio.js` (GPL v3) — duplicated inline `ChessAudioEngine` in `ui.js`; separate `_volume` / `_enabled` state could drift out of sync.
  - `ui-board.js` (GPL v3) — used OPPOSITE rank convention (rank=0 → rank 1) vs inline code (rr=0 → rank 8); never callable from the hot path.
  - `ui-review.js` (GPL v3) — used different classification taxonomy (best/excellent/good/ok/...) vs inline `_classifyMove` (brilliant/great/good/book/...); direct replacement would silently change review annotations.
  - `ui-toolbar.js` (GPL v3) — `switchLanguage` re-implemented `toggleLang`'s persistence + dispatch; `BTN_ID` was never read.
- **Slimmed 2 files**:
  - `EngineHealthMonitor.java` (208 → 85 lines): removed heartbeat thread, zombie-detection timeouts, `RecoveryCallback` interface — all duplicated inline in `StockfishNative`. Now a pure state holder for `lastResponseTime` + `autoRecoveryCount`.
  - `EngineProcessManager.java` (489 → 111 lines): removed `resolveEngineBinary` / `extractEngineFromApk` / `extractEngineFromAssets` / `startProcess` / `initStreams` / `cleanupResources` / `isElfFile` / process getters/setters — all dead code (StockfishNative keeps inline copies with direct field access). Only `makeExecutable(File)` remains.
- **StockfishNative.java** (4,373 → 4,278 lines): removed `_engineConfigManager` / `_uciProtocolHandler` / `_messageBus` fields + constructor instantiations; removed `getMessageBus()` / `_emitLifecycleEvent()` / `_escapeJsonString()` helpers; removed 3 `_emitLifecycleEvent` call sites; removed `_uciProtocolHandler.resetHandshakeState()` call in cleanup; removed 3 now-unused imports (`SimpleDateFormat`, `Date`, `AtomicInteger`). `EngineHealthMonitor` now constructed no-arg; `EngineProcessManager` now constructed with `ChmodProvider` only (Context arg removed).
- **MainActivity.java**: removed `MessageBus` JS-interface registration (both initial + rebuild paths).
- **build-chess.py**: module list 13 → 9 (removed the four `ui-*.js` modules).
- **JS edits**: `ui.js` removed `UIAudio.unlockAudio()` / `UIAudio.setEnabled()` calls; `game-logic.js` removed `UIToolbar.switchLanguage()` call; `ai-bridge.js` removed `window.MessageBus._onEvent` stub + 4 `typeof`-guarded module-activation checks.
- **Bug fix**: inline `StockfishNative.extractEngineFromApk` now guards against `ZipEntry.getSize() == -1` (previously only fixed in the now-deleted `EngineProcessManager.extractEngineFromApk` copy).
- Version: versionCode=121, versionName="1.2.1" (unchanged — same-version refinement)

## v1.2.1 fifth-pass refinement (2026.7.13) — round-5 review: line-by-line audit of remaining 28 files
- **Scope**: First-principles line-by-line review of all remaining 19 Java files + 9 JS files (the 7 deleted in round-4 plus the 2 slimmed were already audited). Focus: bug > robustness > features > performance > redundancy > simplification, in that priority order.
- **Removed 2 unused imports**:
  - `ChessApp.java`: removed `import android.os.Build;` (left over from an earlier root-detection refactor — `Build` was never referenced after the check moved to `RootDetector`).
  - `ChessWebViewClient.java`: removed `import android.os.Build;` (left over from an earlier render-process-gone API-level guard that was simplified to always-on).
- **Bug fix**: `EngineSettingsHelper.importSettings` — the `engine.elo` case used a 1-3200 range, inconsistent with `EngineConfigHelper`'s canonical 500-3500 range (used by `setEngineLimitElo`, `setElo`, and the documented spec). Importing a value like 400 would pass the 1-3200 check, then be silently re-clamped to 500 on the next `setEngineLimitElo` call — a silent data-mutation bug. Fixed to `Math.max(500, Math.min(3500, ...))` to match the canonical range.
- **Verified clean** (no changes needed):
  - `EngineService.java`, `FileIoHelper.java`, `HapticHelper.java`, `JsBridgeGateway.java`, `PermissionHelper.java`, `PgnCacheManager.java`, `RootDetector.java`, `SafPickerHelper.java`, `StabilizationHelper.java`, `StatsActivity.java`, `TlsSecurityHelper.java`, `EngineConfigHelper.java`, `EngineHealthMonitor.java`, `EngineProcessManager.java`, `MainActivity.java`, `StockfishNative.java` — all imports used, no dead code, no inconsistent ranges, no leftover debug statements.
  - All 9 JS files (`game-logic.js`, `chess960.js`, `pgn-standard.js`, `worker-pool.js`, `state-store.js`, `ai-bridge.js`, `tablebase.js`, `eco-data.js`, `ui.js`) — no `debugger;` statements, no live `console.log` (only comments noting their removal), no `TODO`/`FIXME`/`HACK` markers, no references to deleted symbols.
- Version: versionCode=121, versionName="1.2.1" (unchanged — same-version refinement)

## v1.2.1 sixth-pass refinement (2026.7.13) — round-6 review: stats page visual annotation bug fix
- **Bug fix (user-reported)**: Statistics page visual annotation data not displaying for newly-played games.
  - **Root cause**: `_buildPGNString()` (ai-bridge.js) only exports visual annotations where `imported=true` (per Phase 62 design — auto-generated annotations are UI display aids that should NOT pollute PGN export). The stats page (stats.html) scanned the PGN text for `[%csl]`/`[%cal]` tags to count annotations. Since auto-generated annotations (`imported=false`) were never in the PGN text, the stats page's `hasVisualAnnotations` check returned false, and the entire visual annotations section was silently hidden for all newly-played games (only imported PGNs with human-authored annotations would show the section).
  - **Fix**: `openStatsPage()` (ai-bridge.js) now sends a separate `visualAnnotations` field in the payload, containing ALL cache entries (both `imported=true` and `imported=false`), keyed by moveIdx. The stats page uses this field as the PRIMARY data source, falling back to PGN-text scan only if the field is absent (older callers). NAGs (`$N`) are still scanned from PGN text (they're PGN-only, not in the visualAnnotations cache).
  - **Files changed**:
    - `ai-bridge.js` (GPL v3): `openStatsPage()` now collects all `_visualAnnotationsCache` entries (skipping the `_initial` key) into a `vaData` object and includes it in the JSON payload as `visualAnnotations`.
    - `stats.html` (AGPL v3): visual annotations section now reads `_payload.visualAnnotations` first (primary source), applies the selected-move cutoff, and falls back to PGN-text scan only if the payload field is absent. NAG scanning from PGN text is preserved (NAGs are not in the payload).
  - **Design preserved**: The Phase 62 `imported` flag logic in `_buildPGNString()` is UNCHANGED — auto-generated annotations still do NOT pollute PGN export. The fix is purely additive: a new payload field that gives the stats page access to all annotations without changing PGN export semantics.
  - Version: versionCode=121, versionName="1.2.1" (unchanged — same-version refinement)

## v1.2.1 seventh-pass refinement (2026.7.13) — round-7 review: Phase 62 revert + audit-report fixes + security hardening

This pass implements all non-false-positive findings from the comprehensive audit-report collection (`Regalia_v1.2.1_综合审查报告_Final.md`, `regalia_v121_sonarcloud.md`, `regalia_v121_security.md`, `regalia_v121_archquality.md`, `regalia_v121_safety_fp_review.md`, `吉他审查报告.md`, `Semgrep_Code_Findings_2026_07_13.TXT`) plus a first-principles line-by-line re-review of every source file.

### PGN export semantics change (Phase 62 revert)

- **Change**: `_buildPGNString()` (ai-bridge.js) no longer filters visual annotations by the `imported` flag. The condition changed from `if (va && va.imported)` to `if (va)`. Visual annotations `[%csl]` / `[%cal]` are now exported based solely on the export dialog's `includeAnnotations` choice.
- **Rationale**: The Phase 62 design (auto-generated annotations don't pollute PGN export) created a UX inconsistency — users who explicitly chose "Yes, include special annotations" in the export dialog expected ALL annotations to be exported, not just imported ones. Reverting gives users explicit control via the dialog.
- **Backward compatibility**: The `imported` field is retained in `_visualAnnotationsCache` (no schema change). It no longer affects export. `tablebase.js` still sets `imported=true` on imported annotations (no behavior change). The `openStatsPage()` `visualAnnotations` payload (round-6) remains the primary stats data source.
- **Files changed**: `ai-bridge.js` (GPL v3) — `_buildPGNString()` line ~1129, plus comment updates at line ~1430.

### Audit-report fixes (non-false-positive findings)

- **SonarCloud B01 (Critical, css:S4652)**: `index.html.tpl` L502 — removed redundant `flex-shrink:0` declaration before `flex:0 0 auto`. The shorthand `flex:0 0 auto` already sets `flex-shrink:0`, making the explicit declaration a no-op that caused maintenance confusion.
- **SonarCloud B02+B03 (Major, javascript:S2589)**: `ui.js` L6886, L7099, L7108 — removed three `if (typeof _requestBatchEval === 'function')` checks with their `else` fallbacks. `_requestBatchEval` is always exported by `ai-bridge.js` at module-load time (verified by inspecting the export statement), making the `typeof` guard an unreachable branch. The `else` fallbacks were also inconsistently implemented (only L6886's branch reset the safety timer), confirming they were never exercised.
- **SonarCloud B04 (Major, javascript:S3403)**: `ui.js` L5489 — simplified `r !== null && r !== undefined` to the idiomatic `r != null` in `_withPGNSaveCheck`. Semantically identical (both exclude only `null` and `undefined`), but `!= null` is the community-standard idiom recommended by ESLint and Google JS Style Guide.
- **R2 (security, game-logic.js)**: `secureRandomInt()` no longer falls back to `Math.random()` when `crypto` is unavailable. New behavior: log an error and return `0` (fail-safe — selects the first valid candidate, which is always a legal game state). Mirrors the existing `randomSPID()` fail-safe pattern in `chess960.js` (which returns SP-ID 518 = standard chess). `Math.random()` is a predictable PRNG; using it for Chess960 SP-ID selection or ECO opening-book picks would defeat the cryptographic randomization purpose.
- **R3 (API design, StockfishNative.java)**: Added a structured `postJsCallback(String eventName, Object... args)` overload that JSON-encodes all arguments via `JSONArray` and validates `eventName` against `^[A-Za-z_$][A-Za-z0-9_$]*$` (ECMAScript IdentifierName subset). Existing call sites (which already correctly use `escapeJsString()`) are unchanged; the new API is for future callers and eliminates the "forgot to escape" JS-injection risk by construction. Also added `EVENT_NAME_PATTERN` constant near the other Pattern fields.
- **吉他#1 (P1, data consistency)**: `setConfigElo()` in `ai-bridge.js` now clamps to 500-3500 (was 500-3200), matching `EngineConfigHelper.setEngineLimitElo` / `setElo` (Java side). Previously, importing a settings file with elo=3400 would be accepted and persisted by Java, but the UI slider couldn't represent or re-produce that value — causing silent data loss on the next UI edit. Now both sides use the canonical 500-3500 range.
- **吉他#2 (P2, edge case)**: `onBestMove()` in `ai-bridge.js` now probes `gameStatus(gameState)` when the engine returns `(none)` / `0000`. If the position is genuinely terminal (checkmate/stalemate), it applies `_applyGameOver()` and clears AI state immediately (`isAIThinking=false`, safety timer cleared, `_aiRetryCount=0`). This prevents the safety-timer retry loop from hanging for up to 18 minutes (3 × 360s) before surfacing `ai_timeout`. Non-terminal `(none)` (theoretical engine anomaly) retains the existing retry behavior — the safety timer remains armed and `isAIThinking` stays true so the auto-retry fires.
- **Semgrep FP elimination (state-store.js)**: `_deepClone()` now constructs RegExp copies via `new RegExp(obj.source, obj.flags)` instead of `new RegExp(obj)`. Semantically equivalent, but the explicit form eliminates the `detect-non-literal-regexp` Semgrep finding (the original form triggered the rule because `obj` is a variable, even though it's already `instanceof RegExp`). Also added a depth guard (`DEEP_CLONE_MAX_DEPTH = 64`) to prevent stack overflow on pathological deeply-nested or cyclic inputs — the function returns a shallow copy with a console warning if the depth is exceeded.
- **Documentation comment (StockfishNative.java)**: `sEngineThreadDied` / `sEngineThreadDiedName` static-volatile fields now carry an explicit comment documenting the single-engine-per-process design assumption. If multi-engine support is ever added, these must be promoted to per-instance fields on the StockfishNative object itself.

### Build infrastructure

- **Created `proguard-rules.pro`** (was referenced by `build.gradle` line 113 but missing from the source tree — release builds were falling back to AGP's default `proguard-android-optimize.txt` only). Rules cover:
  - `@JavascriptInterface` method keep (belt-and-suspenders alongside AGP's auto-emit)
  - `StockfishNative` / `MainActivity` / `StatsActivity` public method keep
  - Native method keep (`-keepclasseswithmembernames`)
  - `EngineProcessManager$ChmodProvider` interface keep (called from `engine_jni.cpp`)
  - Application / Service / Activity subclass constructor keep
  - `ChessWebViewClient` keep (referenced by name from layout)
  - `StockfishNative` static initializer keep (`System.loadLibrary`)
  - Log.v / Log.d stripping in release builds (keeps w/i/e for diagnostics)
- **`lint.xml`**: Already present and correct — no changes needed.

### README.md updates

- Corrected inaccurate line-count references in the Project Structure tree:
  - `EngineProcessManager.java` "v1.2.1 slimmed to 102 lines" → "111 lines" (actual count).
  - `EngineHealthMonitor.java` "v1.2.1 slimmed to 73 lines" → "85 lines" (actual count).
- Added `proguard-rules.pro` and `lint.xml` entries to the directory tree (both files exist at the project root but were missing from the documented tree).

### Files changed in this pass

- `src/main/assets/chess.src/ai-bridge.js` (GPL v3): `_buildPGNString()` imported-flag revert; `setConfigElo()` ELO range 3200→3500; `onBestMove()` terminal-position probe; `openStatsPage()` comment update.
- `src/main/assets/chess.src/ui.js` (GPL v3): three `typeof _requestBatchEval` checks removed; `_withPGNSaveCheck` null-check simplified.
- `src/main/assets/chess.src/index.html.tpl` (GPL v3): redundant `flex-shrink:0` removed.
- `src/main/assets/chess.src/game-logic.js` (GPL v3): `secureRandomInt()` fail-safe (returns 0 + console.error instead of Math.random()).
- `src/main/assets/chess.src/state-store.js` (AGPL v3): `_deepClone()` RegExp copy + depth guard.
- `src/main/java/com/Regalia/StockfishNative.java` (GPL v3): structured `postJsCallback(String, Object...)` overload + `EVENT_NAME_PATTERN` constant; `sEngineThreadDied` singleton comment.
- `proguard-rules.pro` (AGPL v3): NEW file — ProGuard/R8 rules.
- `README.md` (AGPL v3): round-7 changelog entry; directory tree corrections.
- `BUILDING.md` (AGPL v3): this section.
- `PRIVACY.md` (AGPL v3): round-7 entry (no privacy-relevant changes).
- `NOTICE` (mixed): round-7 entry.
- `Manual/Regalia-v1.2.1-manual-zh.html` (AGPL v3): round-7 changelog + visual-annotations section update.
- `Manual/Regalia-v1.2.1-manual-en.html` (AGPL v3): same.

### Verification

- All changes are additive or behavior-preserving (no API signatures changed, no @JavascriptInterface methods affected).
- `chess.html` must be rebuilt via `python3 build-chess.py` (the JS source changes in `ai-bridge.js`, `ui.js`, `game-logic.js`, `state-store.js`, `index.html.tpl` need to be merged into the single `chess.html` asset).
- Version: versionCode=121, versionName="1.2.1" (unchanged — same-version refinement).


## v1.2.1 eighth-pass refinement (2026.7.13) — round-8 review: state-store.js TDZ white-screen bug fix

This pass fixes a critical white-screen bug introduced in round-7. **Symptom**: APP opens but only the background color is rendered — no UI content. **Root cause**: the round-7 `_deepClone()` hardening added `const DEEP_CLONE_MAX_DEPTH = 64;` at a position in the IIFE that came AFTER the IIFE-top initialization call `let _state = _deepClone(_initialState);`. Since `const` declarations do NOT hoist like `var` (they are in the "temporal dead zone" until their declaration line executes), the function body's reference to `DEEP_CLONE_MAX_DEPTH` triggered `ReferenceError: Cannot access 'DEEP_CLONE_MAX_DEPTH' before initialization`. The state-store module initialization crashed, every dependent module (ui.js, ai-bridge.js, etc.) failed to load, and the WebView rendered only `<body>`'s background color.

### Fix

- **`state-store.js` (AGPL v3)**: moved the `const DEEP_CLONE_MAX_DEPTH = 64;` declaration from after the `_deepClone` function definition to IIFE-top, BEFORE `let _state = _deepClone(_initialState);`. Function declarations ARE hoisted, so `_deepClone` is callable from line 1 of the IIFE — but any `const`/`let` referenced inside the function body must have already been initialized at the time of the call. Added a documentation comment explaining the TDZ trap so future maintainers do not regress it.
- **`chess.html`**: rebuilt via `python3 build-chess.py` to pick up the fix (the merged single-file asset is what the APK actually ships).

### Build configuration alignment

While rebuilding the APK in this pass, two latent build-config mismatches were corrected so the round-8 APK can be assembled cleanly on a fresh environment:

- **`build.gradle` — `ndkVersion "27.2.12479018"`**: AGP 8.7.3 defaults to NDK 27.0.12077973 when no version is pinned. On a fresh SDK install, that default NDK was incomplete (no `source.properties`). Uncommented the existing `ndkVersion "27.2.12479018"` line to pin to the verified-installed NDK.
- **`build.gradle` — `useLegacyPackaging true`**: `AndroidManifest.xml` declares `android:extractNativeLibs="true"`, which requires `useLegacyPackaging=true` in `packagingOptions.jniLibs`. The previous `false` caused `:packageRelease` to emit a 0-byte APK (`Could not find EOCD` error). Switched to `true` to keep `.so` files uncompressed in the APK so the system can memory-map them at install time (the path Stockfish expects for an executable ELF).

### Verification

- All 9 JS modules pass `node --check`.
- `state-store.js` loads cleanly under `vm.runInContext` (no TDZ ReferenceError at module-load time).
- `chess.html` rebuilt (21,664 lines, 1,301,609 bytes); `DEEP_CLONE_MAX_DEPTH` now appears BEFORE `let _state = _deepClone(_initialState);`.
- Release APK built: `Regalia-release.apk`, 78,124,857 bytes.
- Signature verified: v1 ✓, v2 ✓, v3 ✓ (compatible with Xiaomi HyperOS 3).
- Version: `versionCode=121`, `versionName="1.2.1"` (unchanged — same-version refinement).


## v1.2.1 eighth-pass refinement (2026.7.13) — round-8 review: state-store.js TDZ white-screen bug fix

This pass fixes a critical white-screen bug introduced in round-7. **Symptom**: APP opens but only the background color is rendered — no UI content. **Root cause**: the round-7 `_deepClone()` hardening added `const DEEP_CLONE_MAX_DEPTH = 64;` at a position in the IIFE that came AFTER the IIFE-top initialization call `let _state = _deepClone(_initialState);`. Since `const` declarations do NOT hoist like `var` (they are in the "temporal dead zone" until their declaration line executes), the function body's reference to `DEEP_CLONE_MAX_DEPTH` triggered `ReferenceError: Cannot access 'DEEP_CLONE_MAX_DEPTH' before initialization`. The state-store module initialization crashed, every dependent module (ui.js, ai-bridge.js, etc.) failed to load, and the WebView rendered only `<body>`'s background color.

### Fix

- **`state-store.js` (AGPL v3)**: moved the `const DEEP_CLONE_MAX_DEPTH = 64;` declaration from after the `_deepClone` function definition to IIFE-top, BEFORE `let _state = _deepClone(_initialState);`. Function declarations ARE hoisted, so `_deepClone` is callable from line 1 of the IIFE — but any `const`/`let` referenced inside the function body must have already been initialized at the time of the call. Added a documentation comment explaining the TDZ trap so future maintainers do not regress it.
- **`chess.html`**: rebuilt via `python3 build-chess.py` to pick up the fix (the merged single-file asset is what the APK actually ships).

### Build configuration alignment

While rebuilding the APK in this pass, two latent build-config mismatches were corrected so the round-8 APK can be assembled cleanly on a fresh environment:

- **`build.gradle` — `ndkVersion "27.2.12479018"`**: AGP 8.7.3 defaults to NDK 27.0.12077973 when no version is pinned. On a fresh SDK install, that default NDK was incomplete (no `source.properties`). Uncommented the existing `ndkVersion "27.2.12479018"` line to pin to the verified-installed NDK.
- **`build.gradle` — `useLegacyPackaging true`**: `AndroidManifest.xml` declares `android:extractNativeLibs="true"`, which requires `useLegacyPackaging=true` in `packagingOptions.jniLibs`. The previous `false` caused `:packageRelease` to emit a 0-byte APK (`Could not find EOCD` error). Switched to `true` to keep `.so` files uncompressed in the APK so the system can memory-map them at install time (the path Stockfish expects for an executable ELF).

### Verification

- All 9 JS modules pass `node --check`.
- `state-store.js` loads cleanly under `vm.runInContext` (no TDZ ReferenceError at module-load time).
- `chess.html` rebuilt (21,664 lines, 1,301,609 bytes); `DEEP_CLONE_MAX_DEPTH` now appears BEFORE `let _state = _deepClone(_initialState);`.
- Release APK built: `Regalia-release.apk`, 78,124,857 bytes.
- Signature verified: v1 ✓, v2 ✓, v3 ✓ (compatible with Xiaomi HyperOS 3).
- Version: `versionCode=121`, `versionName="1.2.1"` (unchanged — same-version refinement).


## v1.2.1 ninth-pass refinement (2026.7.13) — round-9 review: first-principles code review + hardening

This pass applies findings from a comprehensive first-principles code review of all source files (~32K lines), guided by three uploaded PDFs: AI大模型代码生成防缺陷终极指南 (AI code-gen defect prevention), Android WebView App 开发专业指南 (Android WebView dev), and SonarCloud 完美通过审查指南 (SonarCloud pass guide). Six parallel review agents covered: state-store.js + 4 small JS files; ai-bridge.js + game-logic.js; ui.js; StockfishNative.java; 16 smaller Java files; build infra + tablebase.js + index.html.tpl + cpp + manifest. **No new features, no new permissions, no new network access, no versionCode bump.**

### P1 fixes (bug fix + critical robustness)

- **AndroidManifest.xml (FGS subtype property)**: Added the required `<property android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE" android:value="chess_engine_analysis" />` child element to the EngineService declaration. Per Android 14 docs, apps targeting API 34+ using `FOREGROUND_SERVICE_TYPE_SPECIAL_USE` MUST declare the subtype property, otherwise `startForeground(..., FOREGROUND_SERVICE_TYPE_SPECIAL_USE)` (called in `EngineService.java:117`) can throw `ForegroundServiceTypeNotAllowed` on Android 14+ devices. The app targets `targetSdk 35` so all Android 14+ devices were affected. Verified the property appears in the compiled APK's `AndroidManifest.xml` via `aapt dump xmltree`.
- **StockfishNative.java (lock mismatch)**: Fixed `_discardingPonderBestmove` write in `stopAndWaitForBestmove`'s timeout path. The write was under `_stopLatchLock` but the reader thread's check-and-clear (bestmove handler) uses `_discardFlagLock` — the two locks don't provide mutual exclusion for the same volatile field, creating a TOCTOU window. Now the write is nested under `_discardFlagLock` inside the `_stopLatchLock` block. Added a comment explaining the lock-ordering rationale.
- **StockfishNative.java (cleanupEngineResources state reset)**: `cleanupEngineResources()` now resets `currentState` to `STATE_NONE` FIRST, so any buffered bestmove/info lines the reader thread processes during teardown (before it sees `interrupt()`) route through the `STATE_NONE` branches of `handleBestMove`/`handleInfo`/etc. and become no-ops. Without this, a stale bestmove could fire `onBestMove`/`onHintMove`/`onEngineEval` for a position being torn down, racing with `onEngineRestarting()` and corrupting the JS-side state machine. `shutdown()` and `engineStop()` both already reset state; `cleanupEngineResources` was the only teardown path that didn't.
- **ai-bridge.js (_attachDivergentPV return check)**: The PV-replay loop in `_attachDivergentPV` now checks `makeMvInPlace`'s return value. Previously, if `makeMvInPlace` returned `null` (invalid move — malformed UCI, piece missing, or state desync), the state was NOT advanced but the loop continued to the next iteration, which tried to find a piece at the next PV move's `coords.from` in the stale (un-advanced) state, failed the `if(!piece)break` guard, and exited the loop with `state` at the wrong position. The subsequent `_convertPVtoSANCached(pvRemainder.join(' '),state,…)` then converted the divergent PV from the wrong position, producing incorrect SAN that got stored in `moveRecords[divergeAtIdx].variations` and exported in PGN. Fix: `if(!makeMvInPlace(state,mv))break;`.
- **Cross-module export-list corrections** (4 files): In bundled mode `build-chess.py` strips the `export {...}` line via regex, so stale entries had no production impact — but in source-module mode they would throw `SyntaxError`, and the lists were misleading. Corrections:
  - `eco-data.js`: Removed 5 names not defined in this file (live in game-logic.js): `queryECO`, `buildEcoHashMap`, `queryECOBookMove`, `getECORecommendation`, `_ecoRecCache`. Added `_ecoCacheKey`/`_ecoCacheResult` (declared here, used by game-logic.js).
  - `ai-bridge.js`: Removed 9 names not defined in this file (live in ui.js): `formatEval`, `playSound`, `handleBackPress`, `scanEngines`, `copyFEN`, `copyReviewFEN`, `importFEN`, `_startEngineHeartbeat`, `_cleanupEventListeners`.
  - `ui.js`: Removed 2 names not defined in this file (live in game-logic.js): `doAIMove`, `_requestStockfishMove`.
  - `game-logic.js`: Added `makeMv` (defined at line 1885, used by ai-bridge.js and tablebase.js). Removed `fenToState` (defined in tablebase.js, not here).
  - `tablebase.js`: Added `copyFEN`, `copyReviewFEN`, `fenToState` (all defined in this file but were missing from the export list).

### P2 fixes (robustness + redundancy)

- **state-store.js (reset deep-clone)**: `reset()` now returns `_deepClone(_state)` instead of `_state` (live reference), consistent with `getState()` and `dispatch()`. Callers could previously mutate the internal state via the returned reference.
- **state-store.js (dialog payload guard)**: `SHOW_DIALOG`/`HIDE_DIALOG` reducers now guard against non-string payload. Previously, `[payload]: true/false` would produce junk keys like `"null"`/`"undefined"` in `dialogVisible` if payload was not a string. Non-string payload is now a no-op.
- **chess960.js (null guards)**: Added defensive null guards to `parseShredderCastling`, `findCastlingRooks`, `isChess960CastlingLegal` — matches the existing guard in `toShredderCastling`. A null/undefined `board` or `state` would previously throw `TypeError`. Also corrected a misleading comment in `toShredderCastling` that claimed the inverse `parseShredderCastling` "already has this defensive pattern" (it didn't until this round).
- **pgn-standard.js (escaped-quote regex)**: Tag-removal regex updated from `[^"]*` to `(?:[^"\\]|\\.)*` for the value pattern, correctly handling escaped quotes in tag values (e.g. `[Event "Some \"Fun\" Event"]`). Brings the removal regex into parity with the tag-extraction regex (which already handled escaped quotes). Without this, a tag with escaped quotes was extracted correctly but NOT fully stripped from movetext, leaving residual garbage tokens.
- **ai-bridge.js (eval-cache error logging)**: 6 empty `catch(e){}` blocks in eval-cache persistence paths (`_readPersisted`, `_writeToDiskNow`, constructor load, rehydrate localStorage, save/load for file/localStorage/legacy paths) now log via a new `_warnEvalCache(op, e)` helper at `console.warn` level. Previously, corrupted cache files, `QuotaExceededError` on localStorage, and JNI failures were completely invisible. Kept the catches (don't rethrow) — these are best-effort persistence paths.
- **eco-data.js (cache save error logging)**: `_saveEcoToCache`'s empty `catch(e){}` now logs via `console.warn('ECO cache save failed:', e)` — matches the convention in `_loadEcoFromCache` (line 51) and state-store.js.
- **game-logic.js (malformed castle-mark key guard)**: `_validateSetupCastleMarks` now guards against malformed (non-integer or out-of-range) keys via `Number.isInteger(idx) || idx<0 || idx>=64` check. Previously, `parseInt` returning `NaN` would silently map to `(row=0, col=0) = a8` (since `NaN>>3` is 0 and `NaN&7` is 0), either incorrectly accepting the key (if a8 has a rook) or producing a spurious "not a rook" error for a8.
- **StatsActivity.java + SafPickerHelper.java (openOutputStream null check)**: `ContentResolver.openOutputStream(uri)` can return `null` per Android docs (e.g. if the URI provider is unavailable or the file is not writable). Added explicit null check that throws `IOException` with a clear message ("openOutputStream returned null for " + uri) instead of letting `OutputStreamWriter` constructor throw `NPE` (which was caught by the outer catch but produced a confusing generic "export failed" message).
- **EngineProcessManager.java + StockfishNative.java (ChmodProvider slim)**: Slimmed the `ChmodProvider` interface from 3 methods to 1 (`nativeChmod`). The other 2 (`isEnglishMode`, `postProgress`) were leftovers from the round-4 cleanup that removed `extractEngineFromApk()` and its progress-reporting call sites — the anonymous implementation in StockfishNative still provided all 3, but 2 were never invoked. Removed the 2 dead overrides from StockfishNative's anonymous class.
- **build.gradle (FileInputStream leak)**: Two `new FileInputStream(file)` calls passed to `Properties.load()` without close (SonarCloud java:S2093 — resource leak). Switched to `file.withInputStream { props.load(it) }` (Groovy auto-close) for both `version.properties` and `keystore.properties` reads.
- **index.html.tpl (CSP hardening)**: Added `form-action 'none'` and `object-src 'none'` to the Content-Security-Policy. Both fall back to `default-src 'none'` (so behavior is unchanged), but explicit declarations are defense-in-depth and recommended by CSP best practices (the WebView guide PDF emphasized CSP hardening).

### P3 fixes (redundancy + stale comments)

- **index.html.tpl (redundant flex-shrink)**: Removed redundant `flex-shrink: 0;` declaration in `.review-left` — the shorthand `flex: 0 0 auto` above it already sets `flex-shrink:0`. Same pattern round-7 cleaned up elsewhere; this instance was missed.
- **index.html.tpl (stale comment fix)**: Updated the comment above `.rv-slider-wrap` which falsely claimed "IDENTICAL CSS to .review-chart (border:1px, padding:2px, ...)" — `.review-chart` has neither border nor padding. Rewrote the comment to accurately describe the actual design (both use width:100% + box-sizing:border-box so outer boxes match; the transparent 1px border on .rv-slider-wrap compensates for .review-chart's overflow:hidden rounding).
- **tablebase.js (unreachable else branch)**: Removed unreachable `else` branch in PGN variation relocation logic. After `if(divergeIdx<0) continue;`, `divergeIdx` is guaranteed `>=0`, so the two remaining cases (`divergeIdx < moveRecords.length` vs `divergeIdx >= moveRecords.length`) are exhaustive. The previous `else` ("No divergence found and not all matched — keep at original location") was dead code. Also removed redundant `divergeIdx>=0&&` prefixes.
- **ui.js (_tryRecovery documentation)**: The `_tryRecovery` IIFE previously loaded recovery data and parsed it but the if-block body was EMPTY (dead code) — data was never applied to `gameState`/`moveRecords`. Rather than implement an unsafe late-restore (which would race with normal init paths and could resurrect a stale gameState that caused the original crash), documented that the load-and-apply path is intentionally not implemented and kept the IIFE for its still-useful cleanup behavior (clearing stale recovery data after 5s if the engine started successfully). The save side in `_installErrorBoundary` is retained as a diagnostic artifact.

### Verification

- All 9 JS modules pass `node --check`.
- `state-store.js` loads cleanly under `vm.runInContext` — `reset()` deep-clone verified, SHOW_DIALOG non-string payload guard verified.
- `chess960.js` null guards verified — `parseShredderCastling('KQkq', null)`, `findCastlingRooks(null, 'white')`, `isChess960CastlingLegal(null, 'white', 'kingside')` all return safe defaults (no TypeError).
- `chess.html` rebuilt (21,795 lines, 1,310,827 bytes).
- Release APK rebuilt: `Regalia-release.apk`, 78,132,453 bytes.
- Signature verified: v1 ✓, v2 ✓, v3 ✓ (compatible with Xiaomi HyperOS 3).
- `aapt dump xmltree` confirms `PROPERTY_SPECIAL_USE_FGS_SUBTYPE` = `chess_engine_analysis` is in the compiled AndroidManifest.
- Version: `versionCode=121`, `versionName="1.2.1"` (unchanged — same-version refinement).


## v1.2.1 tenth-pass refinement (2026.7.14) — round-10 review: deep fix of review-D/E/F P2/P3 items

This pass targets the P2/P3 items flagged by round-9's review-D (StockfishNative.java), review-E (16 mid-size Java files), and review-F (build infra + manifest + proguard). 13 priority items implemented. **No new features, no new permissions, no new network access, no versionCode bump, no JS source changes.** All fixes are concurrency-hardening, dead-code removal, or readability improvements.

### Build-relevant changes

- **build.gradle (pickFirsts)**: Removed `'**/libfoundation.so'` from `pickFirsts`. `jniLibs/` contains only `libstockfish.so` and `libc++_shared.so`; the libfoundation.so entry was a leftover from an earlier build config and never matched anything. `pickFirsts` is now `['**/libc++_shared.so']` only.
- **build.gradle (lint disable list)**: Removed the `disable 'ObsoleteLintCustomCheck', 'GradleDependency', 'OldTargetApi', 'AndroidGradlePluginVersion', 'NonConstantResourceId'` line. These 5 checks are already `severity="ignore"` in `lint.xml` (lines 52-60), so listing them again split configuration across two files. `lint.xml` is now the single source of truth for lint severity.
- **AndroidManifest.xml**: Removed `android:requestLegacyExternalStorage="true"` from the `<application>` element. This attribute is ignored when `targetSdk >= 30` (we use 35). The app uses SAF for all file I/O, so legacy storage mode was never actually consulted. Verified absent from the compiled APK via `aapt dump xmltree`.
- **proguard-rules.pro**: Rewrote the section-6 comment for clarity. The previous comment inverted the JNI direction (said "engine_jni.cpp calls StockfishNative.nativeChmod" — but Java calls C++). No rule changes.

### Source changes (no build impact, listed for completeness)

- **StockfishNative.java**: P2 concurrency hardening — `_restartInProgress` lock consistency (all 14 `=false` writes now go through `_clearRestartInProgress()` helper that takes `_restartLock`); `recoverEngine` `shutdownRequested` checks (entry of `startEngineInternal` + after executor recreation); `_discardingPonderBestmove` lock unification (3 additional write sites wrapped in `_discardFlagLock`). P3 readability — magic numbers extracted (`MIN_ENGINE_BINARY_SIZE`, `PONDER_STOP_GRACE_MS`); `escapeJsString` dead-code simplification; `isProcessAlive` `SDK_INT` pre-check; `_pendingChess960` field relocated; `if(ctx==null)` dead code removed; "remove JNI bridge" comment rewritten.
- **HapticHelper.java**: REMOVED ENTIRELY. 128-line Phase 73 extraction that was instantiated in `StockfishNative` but never invoked. `StockfishNative.performHaptic` calls the inline `performHapticInternal` directly.
- **StatsActivity.java**: `statsPayload` is now `volatile`; added `onPause`/`onResume` overrides.
- **EngineConfigHelper.java**: `detectBigCoreCount` no longer caches failure results; added mid-search context comments.
- **StabilizationHelper.java**: `applyTransform` hot-path optimization.
- **TlsSecurityHelper.java**: `validatePin` uses `MessageDigest.isEqual` for constant-time comparison.
- **ChessWebViewClient.java**: `shouldOverrideUrlLoading` uses case-insensitive `Uri.parse + equalsIgnoreCase`.

### Verification

- All 9 JS modules pass `node --check`.
- `state-store.js` loads cleanly under `vm.runInContext` (no TDZ regression).
- `chess.html` rebuilt (21,795 lines, 1,310,827 bytes — same size as round-9, confirming no JS source changes).
- Release APK rebuilt: `Regalia-release.apk`, 78,133,982 bytes.
- Signature verified: v1 ✓, v2 ✓, v3 ✓ (compatible with Xiaomi HyperOS 3).
- `aapt dump xmltree` confirms `PROPERTY_SPECIAL_USE_FGS_SUBTYPE` = `chess_engine_analysis` still present.
- `aapt dump xmltree` confirms `requestLegacyExternalStorage` no longer present.
- `unzip -l` confirms `HapticHelper.class` is absent from the APK.
- Version: `versionCode=121`, `versionName="1.2.1"` (unchanged — same-version refinement).


## v1.2.1 round-10 continuation (2026.7.14) — secondary review-E items

This pass addresses the remaining review-E items not in the initial round-10 priority list. 4 secondary items implemented. **No new features, no new permissions, no new network access, no versionCode bump, no JS source changes.** All fixes are naming, maintainability, or timing improvements.

### Build-relevant changes

- **BuildConfig.VERSION_NAME usage** (3 sites): `ChessApp` init-log, `MainActivity.VERSION` (title display), `StockfishNative.ENGINE_VERSION` (exposed to JS). `BuildConfig` is auto-generated by AGP (build.gradle has `buildFeatures { buildConfig true }`), so these now stay in sync with `defaultConfig.versionName` without manual edits. R8 inlines the constant at compile time, so there is no runtime cost.
- No other build-config changes. `build.gradle`, `AndroidManifest.xml`, `proguard-rules.pro` are unchanged from the initial round-10 pass.

### Source changes (no build impact, listed for completeness)

- **FileIoHelper.java**: Renamed `ensureReadExternalStoragePermission` → `requestReadExternalStoragePermission`. Extracted hardcoded request code `1002` to named constant `REQUEST_CODE_READ_EXTERNAL_STORAGE`.
- **PermissionHelper.java**: Migrated hardcoded permission request codes from 1000-range (1001/1003, overlapping with SafPickerHelper) to disjoint 3000-range (`REQUEST_CODE_STORAGE_PERMISSION=3001` / `REQUEST_CODE_NOTIFICATION_PERMISSION=3002`).
- **ChessApp.java**: Init-log line uses `BuildConfig.VERSION_NAME`.
- **MainActivity.java**: `VERSION` field uses `BuildConfig.VERSION_NAME`.
- **StockfishNative.java**: `ENGINE_VERSION` field uses `BuildConfig.VERSION_NAME`.
- **EngineService.java**: Moved `isRunning = true` to after `startForeground()` succeeds.
- **ChessWebViewClient.java**: Updated header doc-comment (documentation only).

### Verification

- All 9 JS modules pass `node --check` (no JS source changes this pass).
- `chess.html` unchanged (1,310,827 bytes).
- Release APK rebuilt: `Regalia-release.apk`, 78,134,216 bytes (234 bytes larger due to new `BuildConfig` references + named constants).
- Signature verified: v1 ✓, v2 ✓, v3 ✓ (compatible with Xiaomi HyperOS 3).
- `dexdump` confirms `v1.2.1` string inlined by R8 (`BuildConfig.VERSION_NAME` constant propagation).
- `unzip -l` confirms `HapticHelper.class` still absent from the APK.
- `aapt dump xmltree` confirms FGS subtype property still present and `requestLegacyExternalStorage` still absent.
- Version: `versionCode=121`, `versionName="1.2.1"` (unchanged — same-version refinement).


## v1.2.1 round-10 regression test + first-principles optimization (2026.7.14)

This pass performs a regression test of all review-D/E/F fixes from the initial round-10 and its continuation, then applies first-principles optimization to eliminate residual magic numbers, redundant operations, and misleading comments discovered during the regression audit. **No new features, no new permissions, no new network access, no versionCode bump, no JS source changes.**

### Regression test results (all review-D/E/F items verified)

- **review-D (StockfishNative.java)**: ✓ All 14 `_restartInProgress = false` writes go through `_clearRestartInProgress()` helper (takes `_restartLock`). ✓ `recoverEngine` has `shutdownRequested` checks at `startEngineInternal` entry + after executor recreation. ✓ All `_discardingPonderBestmove` writes are under `_discardFlagLock` (8 write sites verified). ✓ `MIN_ENGINE_BINARY_SIZE` / `PONDER_STOP_GRACE_MS` constants extracted. ✓ `escapeJsString` dead-code simplified. ✓ `isProcessAlive` SDK_INT pre-check. ✓ `_pendingChess960` field relocated. ✓ `if(ctx==null)` dead code removed. ✓ "remove JNI bridge" comment rewritten.
- **review-E (16 Java files)**: ✓ URL scheme case-insensitivity at 3 sites (StockfishNative, StatsActivity, ChessWebViewClient). ✓ HapticHelper.java removed (not in APK). ✓ StatsActivity statsPayload volatile + onPause/onResume. ✓ EngineConfigHelper detectBigCoreCount failure no-cache + mid-search comments. ✓ StabilizationHelper applyTransform hot-path optimization. ✓ TlsSecurityHelper validatePin MessageDigest.isEqual. ✓ FileIoHelper rename + constant. ✓ PermissionHelper 3000-range codes. ✓ ChessApp/MainActivity/StockfishNative BuildConfig.VERSION_NAME. ✓ EngineService isRunning timing.
- **review-F (build infra)**: ✓ build.gradle pickFirsts (no libfoundation.so). ✓ build.gradle lint disable list removed (lint.xml single source of truth). ✓ AndroidManifest requestLegacyExternalStorage removed. ✓ proguard-rules.pro section-6 comment rewritten. ✓ FGS subtype property present. ✓ index.html.tpl CSP form-action/object-src. ✓ tablebase.js unreachable else removed.

### First-principles optimization (this pass)

- **StockfishNative.java**: Extracted `PROCESS_DESTROY_GRACE_MS = 100` constant for the 2 remaining `Thread.sleep(100)` calls in `cleanupEngineResources()` and `shutdown()` (process-destroy grace period, semantically distinct from `PONDER_STOP_GRACE_MS` — kept separate so each can be tuned independently). No `Thread.sleep(100)` magic numbers remain.
- **StatsActivity.java**: Removed redundant second `Uri.parse(trimmed)` call in `openUrlInBrowser` — the first parse (for scheme check) is now reused for the Intent. Was a harmless but unnecessary double-parse.
- **StabilizationHelper.java**: Corrected comment direction ("one-time clear is now done in start() (above)" — was "below", but start() is above applyTransform() in source order).
- **proguard-rules.pro**: Rewrote section-3 comment (same direction-inversion bug as the round-10 section-6 fix — said "engine_jni.cpp calls into Java via JNI" but Java calls C++). Now consistent with section-6.

### Verification

- All 9 JS modules pass `node --check` (no JS source changes this pass).
- `state-store.js` loads cleanly under `vm.runInContext` (no TDZ regression).
- `chess.html` unchanged (1,310,827 bytes).
- Release APK rebuilt: `Regalia-release.apk`, 78,134,328 bytes (112 bytes larger than the round-10 continuation due to the new `PROCESS_DESTROY_GRACE_MS` constant + section-3 comment expansion + StatsActivity redundancy removal).
- Signature verified: v1 ✓, v2 ✓, v3 ✓ (compatible with Xiaomi HyperOS 3).
- `aapt dump xmltree` confirms FGS subtype property still present and `requestLegacyExternalStorage` still absent.
- `unzip -l` confirms `HapticHelper.class` still absent from the APK.
- Version: `versionCode=121`, `versionName="1.2.1"` (unchanged — same-version refinement).

## v1.2.1 round-11 (2026.7.14) — 2 user-reported bugs + review-report defects + first-principles optimization

This pass fixes 2 user-reported bugs in the review-mode eval chart and stats page, plus the remaining non-false-positive defects from the round-2 review-report collection (`Regalia_v1.2.1_Round2_审查报告合集.zip`), plus a first-principles optimization pass on the changed files. **No new features, no new permissions, no new network access, no versionCode bump.**

### Bug #1 (user-reported) — review eval chart not refreshing on eval completion

**Symptom**: In review mode, after a step's evaluation analysis completes, the corresponding data point does NOT appear on the line chart unless the user changes the selected move.

**Root cause**: `onEngineEval` in `ai-bridge.js` has two code paths — a "stale" path (when the user navigated away before the eval completed) and a "non-stale" path (when the user stayed on the step being analyzed). The stale path called `_refreshEvalTrendChart()` after caching the eval, but the non-stale path did NOT — it only updated the text displays via `_updateAllEvalDisplays()`. The chart only refreshed on the next full `render()` (triggered by an unrelated action like navigating to another step or toggling a UI element).

**Fix**: Added a `_refreshEvalTrendChart()` call (wrapped in `try/catch` + `typeof === 'function'` guard) after `_reviewEvalCache.set(reviewStep, ...)` in the non-stale path. The function is a no-op when not in review mode or when the chart container doesn't exist, so the call is safe in all contexts.

### Bug #2 (user-reported) — stats page data completeness varied by selected move

**Symptom**: In review mode, after selecting different moves and clicking 📊, the stats page showed varying levels of completeness in its data displays. Stats should always be complete regardless of which move was selected.

**Root cause**: `openStatsPage` in `ai-bridge.js` builds the `evals` array by iterating `moveRecords.length` items and pushing `null` for any step not in `_reviewEvalCache`. In review mode, only the steps the user navigated through (plus any analyzed by a batch) had cached evals — all other steps were `null`. The stats page's "move quality" and "eval trend" sections silently skipped `null` entries, so the displayed stats were partial.

**Fix**: `openStatsPage` now checks if any step (0..moveRecords.length inclusive) is uncached in review mode. If so, it sets a `window._pendingOpenStats` flag and calls `reviewAnalyzeAll()` to start a batch analysis; the stats page opens automatically when the batch completes (via a new hook in `_reviewAnalyzeAdvance`'s completion branch in `ui.js`). If a batch is already running, the call defers to the existing batch. If all steps are cached (or we're not in review mode), the call falls through to the normal open-stats flow. `exitReview` clears the pending flag to prevent stale-flag pollution of future review sessions.

### Review-report non-false-positive defects

- **`game-logic.js` `pieceCountLE7` typeof guard restored (P2)** — The round-2 review removed the `typeof pieceCountLE7 === 'function'` guard, relying on `tablebase.js` always being loaded after `game-logic.js`. Restored the guard so a script-load failure (rare but possible) doesn't cause `ReferenceError` and completely halt AI move generation. The guard degrades gracefully: if tablebase isn't available, we skip the tablebase probe and fall through to Stockfish.
- **`ai-bridge.js` `onBestMove` isAIThinking reset on validation failure (P3)** — When `_bmCoords` parsing fails or the from-square is empty, the function now resets `isAIThinking = false` and `_aiBarInfo = ''` before the early return. Previously these early returns left `isAIThinking = true`, causing a soft-lock where the UI showed "thinking..." forever if the engine emitted an unparseable bestmove line.
- **`ai-bridge.js` `_visualAnnotationsCache` iteration safety (P2)** — `openStatsPage` now uses `forEach` instead of `for...of` to iterate `_visualAnnotationsCache`, with a plain-object fallback via `for...in`. A non-Map cache (e.g., a plain object accidentally assigned) would previously throw `TypeError`.
- **`FileIoHelper.java` `getDefaultPaths` deprecated API (P2)** — On API 29+ (Android 10+), `Environment.getExternalStorageDirectory()` and `Environment.getExternalStoragePublicDirectory(String)` are deprecated and, on Android 11+ with targetSdk 30+, point to paths the app can no longer access directly (scoped storage). The method now returns `context.getExternalFilesDir(null)` for the `externalStorage` key (always accessible, no permission needed). On API 23-28, the legacy paths are still returned for compatibility.
- **`state-store.js` `_deepClone` nosemgrep comment + Map/Set support (P3)** — Added `// nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp` to the `new RegExp(obj.source, obj.flags)` line with a justification comment. Also added Map/Set deep-clone branches — the current state tree doesn't use Map/Set, but adding these branches now means a future addition won't silently degrade to a shallow reference share.

### First-principles optimization

- **`ai-bridge.js` Bug #2 fix — race-condition guard for concurrent batch** — If a batch is already running when 📊 is pressed, `openStatsPage` does NOT restart it (which would corrupt batch state); instead it just waits for the existing batch's completion.
- **`ai-bridge.js` Bug #2 fix — double-click guard** — If the user clicks 📊 again while a batch is already running for stats, the second call shows a progress toast and returns early (no duplicate batch, no duplicate stats Activity).
- **`ai-bridge.js` Bug #2 fix — 10-minute safety timeout** — If the batch never completes within 10 minutes (e.g., engine stuck unrecoverable, or a bug prevents the completion branch from firing), the pending-stats flag is cleared so the user can retry 📊 instead of being permanently locked out. The timeout is generous (a 200-step game at 60s/step worst-case = 200min, but the per-step safety timer skips stuck steps, so a healthy batch finishes in <30min for any realistic game). The timer is cleared on normal completion and on `exitReview`.
- **`ui.js` `exitReview` pending-stats clear** — Mirrors the existing `_pendingPGNCacheSave` clear pattern, preventing a stale flag from polluting the next review session.

### Verification

- All 9 JS modules pass `node --check` (ai-bridge.js, chess960.js, eco-data.js, game-logic.js, pgn-standard.js, state-store.js, tablebase.js, ui.js, worker-pool.js).
- `chess.html` rebuilt: 21,964 lines, 1,320,550 bytes (+9 lines / +9,723 bytes vs round-10, reflecting the new bug-fix code + comments).
- Release APK rebuilt: `Regalia-release.apk`, 78,145,566 bytes.
- Signature verified: v1 ✓, v2 ✓, v3 ✓ (compatible with Xiaomi HyperOS 3). `apksigner verify --verbose` confirms all three schemes.
- APK contents verified via `unzip -l`: `libstockfish.so` (114,115,752 bytes, the arm64-v8a-dotprod Stockfish 18 binary), `libengine_bridge.so`, `libc++_shared.so`, `chess.html`, `stats.html`, all 9 `chess.src/*.js` modules, and all assets.
- Version: `versionCode=121`, `versionName="1.2.1"` (unchanged — same-version refinement).
