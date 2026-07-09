# Building Regalia v1.1.2 from source

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
game-logic → chess960 → pgn-standard → worker-pool → ai-bridge → tablebase → eco-data → ui)
into `src/main/assets/chess.html`, stripping `export` statements.
As of v1.1.2 Phase 67 (MED-3), the script wraps every file I/O in try/except
for clearer diagnostics and uses an `if __name__ == '__main__':` guard.

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
  VERSION_MINOR=1
  VERSION_PATCH=2
  VERSION_BUILD=112
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

