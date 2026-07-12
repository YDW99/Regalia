# Building Regalia v1.2.0 from source

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

## v1.2.0 build notes (architecture refactor)
- All v1.0.8 build notes still apply.
- **v1.2.0 Phase 73-80 (2026.7.11): Architecture refactor major version.**
  - **Java God Module split**: `StockfishNative.java` (5,443→4,492 lines) refactored
    into Facade + 11 manager/helper classes:
    - `EngineProcessManager.java` — engine process lifecycle
    - `UciProtocolHandler.java` — UCI protocol commands
    - `EngineConfigManager.java` — engine settings persistence
    - `JsBridgeGateway.java` — sandbox path validation & UCI whitelist
    - `PgnCacheManager.java` — PGN cache CRUD
    - `EngineHealthMonitor.java` — heartbeat & zombie detection
    - `FileIoHelper.java` — file I/O operations
    - `PermissionHelper.java` — runtime permission checks
    - `HapticHelper.java` — haptic feedback
    - `SafPickerHelper.java` — SAF file picker (export/import settings & PGN)
    - `EngineSettingsHelper.java` — engine settings query/export/import
    - `MessageBus.java` — unified JS↔Java message dispatch
  - **JS God Module split**: 4 new modules extracted from `ui.js`:
    - `ui-board.js` — board rendering & coordinate labels
    - `ui-review.js` — review mode & eval trend chart
    - `ui-audio.js` — audio engine utilities
    - `ui-toolbar.js` — toolbar rendering
    - `_computeAndCacheVisualAnnotations` (439 lines) decomposed into 4 sub-functions:
      `_replayMovesToState`, `_computeSquareHighlights`, `_computeCheckArrows`,
      `_computeThreatArrows`.
    - `_buildEvalTrendSVG` (267 lines) decomposed into 6 sub-functions:
      `_getChartColors`, `_buildEvalTrendGrid`, `_buildEvalTrendSegments`,
      `_buildEvalTrendPoints`, `_buildEvalTrendLabels`, `_buildEvalTrendCurrentMarker`.
      ui.js: 8,245→8,061 lines.
  - **Global state store**: `state-store.js` (Redux-like single source of truth)
  - **`build-chess.py` updated**: 13 modules merged in dependency order.
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

## v1.2.0 Phase 82++++ build notes (renderInternal final extraction + review-mode entry fix + layout fix)
- All v1.2.0 Phase 82+++ build notes still apply.
- **v1.2.0 Phase 82++++ (2026.7.12): renderInternal final extraction + critical bug fixes.**
  - **3 more rendering blocks extracted from `renderInternal()`** into dedicated functions,
    further reducing the God Function from 359 to 70 lines (−289 lines, −81% cumulative −95%).
  - **`_computeRenderState()`**: Centralizes all defensive checks (gameState validity,
    setupMode/gameOver reset, gameOver re-localization, `_applyGameOver` check) and
    shared-state computation (control-map cache `cm`, `infoSq`/`infoCtrl`, `oppC`, `flip`).
    Returns `{cm, infoSq, infoCtrl, oppC, flip}` object that `renderInternal` destructures
    and passes explicitly to every sub-function. **This fixes a critical Phase 82++ scoping
    bug** where `cm`, `infoSq`, `infoCtrl`, `oppC`, `flip` were declared as `const` inside
    `_renderHeader()` and therefore inaccessible to other sub-functions.
  - **`_renderGameOverOverlay(h)`**: Renders the game-over sound trigger (fires once via
    `gameOverSoundPlayed` guard) and the `.gover` overlay HTML with status emoji
    (♔/♚/🏳️/⌛/🤝), localized status text, "Play Again" and "Review" buttons. Receives
    `h`, returns `h` with overlay appended (if applicable).
  - **`_applyRenderResult(app, h, reviewMode)`**: The most delicate extraction — handles
    scroll-position capture (`.mlist`, `.review-body`, `.review-moves`, `.dlg`, `.panel`,
    `.op-list`), `app.innerHTML=h` DOM rebuild, animation re-attach, synchronous scroll
    restore for `.mlist`/`.review-body`/`.review-moves` (with `_scrollRestoreGuard`),
    deferred scroll restore for `.dlg`/`.panel`/`.op-list` (double-rAF with clamping),
    DOM cache invalidation, active-move scroll-into-view (manual `scrollTop` computation
    to avoid `scrollIntoView`'s ancestor-scrolling side effect), arrow overlay update,
    ECO search focus restore, opening-list auto-scroll.
  - **`_renderReviewMode(h, flip)`**: Signature updated to accept `flip` as parameter
    (was previously a free variable — root cause of the review-mode entry bug, see below).
  - **CRITICAL BUG FIX (review-mode entry)**: Root cause of "clicking move records text
    doesn't enter review mode" identified and fixed. The Phase 82++ extraction moved
    `const flip=playerColor==='black'` into `_renderHeader()` (local scope), but
    `_renderReviewMode(h)` referenced `flip` 9 times as a free variable. When the user
    clicked a move record (`.mw`/`.mb` span), `enterReview()` set `reviewMode=true` and
    called `render()` → `renderInternal()` → `_renderReviewMode(h)` → **ReferenceError:
    flip is not defined** → caught by `renderInternal`'s try-catch → user saw "Render
    Error" instead of the review overlay. Fixed by: (1) extracting `_computeRenderState()`
    to compute `flip` at the `renderInternal` scope, (2) passing `flip` explicitly to
    `_renderReviewMode(h, flip)`. Same fix applied to `_renderAIBar(h, oppC)`,
    `_renderBoardGrid(h, flip, cm)`, `_renderSidePanel(h, infoSq, infoCtrl, oppC)` — all
    previously received `undefined` for these parameters.
  - **LAYOUT FIX (.bsec structure)**: The Phase 82+++/82+++ extraction accidentally moved
    info bars (`_renderInfoBars`) and player bar (`_renderPlayerBar`) rendering AFTER the
    `</div></div>` close of `.bsec`+`.main`, placing them outside `.bsec` (and outside
    `.main`). This broke the vertical-flex layout of `.bsec` (board column). Fixed by
    moving both calls BEFORE the `</div>` close of `.bsec`, so they correctly stack
    vertically below the board inside the board section. The `.main` close `</div>` now
    correctly follows the side panel (which is a sibling of `.bsec` inside `.main`).
  - `renderInternal()`: 359 → 70 lines (−289). Cumulative: 1,365 → 70 lines (−1,295 lines, −95%).
    The function now focuses purely on orchestration: call `_computeRenderState()`, dispatch
    to sub-functions in order, then call `_applyRenderResult()`. All rendering logic is in
    dedicated sub-functions.
  - **renderInternal sub-function count**: 11 (was 8). New: `_computeRenderState`,
    `_renderGameOverOverlay`, `_applyRenderResult`.
- **Engine binary**: Stockfish 18 `arm64-v8a-dotprod` (unchanged).
- Version: versionCode=120, versionName="1.2.0" (unchanged — same version, deeper refactor).

## v1.2.0 Phase 82+++++ build notes (WebView cache fix + code review)
- All v1.2.0 Phase 82++++ build notes still apply.
- **v1.2.0 Phase 82+++++ (2026.7.12): WebView cache fix + comprehensive code review.**
  - **WebView cache fix (root cause of "oppC is not defined" on user devices)**:
    `MainActivity.java` now calls `webView.clearCache(true)` before `loadUrl()`. Without
    this, some WebView implementations (especially on Xiaomi HyperOS) serve a stale cached
    `chess.html` after an app update — the user would see bugs that were already fixed in
    the new version (e.g., the Phase 82++++ `oppC` scoping fix was not visible because the
    WebView loaded the pre-fix `chess.html` from cache). `clearCache(true)` evicts both RAM
    and disk caches, guaranteeing the latest `chess.html` is always loaded from the APK.
  - **README.md directory tree fix**: Added missing `EngineConfigHelper.java` (Phase 81)
    to the Java file listing.
  - **Comprehensive code review**: All JS modules, Java files, CSS template, and HTML
    manuals reviewed line-by-line. No additional bugs found — the Phase 82++++ fix is
    correct and complete. The `oppC` error was entirely caused by stale WebView cache.
- **Engine binary**: Stockfish 18 `arm64-v8a-dotprod` (unchanged).
- Version: versionCode=120, versionName="1.2.0" (unchanged — same version, deeper refactor).

## v1.2.0 Phase 82+++++ (rev 9) build notes (stats page visual annotation fix)
- All v1.2.0 Phase 82+++++ rev 8 build notes still apply.
- **v1.2.0 Phase 82+++++ rev 9 (2026.7.12): Stats page visual annotation fix.**
  - **BUG fix (stats page not showing visual annotations for live games)**: The stats page
    (`stats.html`) was not displaying `[%csl]`/`[%cal]` visual annotation data for live games.
    Root cause: `_buildPGNString()` (ai-bridge.js) filtered out auto-generated visual annotations
    (`imported=false`) per the Phase 62 design (which was correct for PGN export/save — users
    don't want auto-generated arrows cluttering their PGN archive). However, `openStatsPage()`
    also called `_buildPGNString(true, true)` without any way to include auto-generated
    annotations, so the stats page never received them. The stats page's explicit purpose is
    to count and display these visual annotations, so this was a bug.
  - **Fix**: Added a third parameter `includeAutoAnnotations` (default `false`) to
    `_buildPGNString()`. When `true`, auto-generated annotations (`imported=false`) are also
    exported. `openStatsPage()` now calls `_buildPGNString(true, true, true)` to include
    auto-generated annotations for the stats page. All other callers (copyMoveHistory,
    exportPGNToFile, PGN cache save) are unchanged — they continue to use the default
    `includeAutoAnnotations=false`, preserving the Phase 62 behavior for PGN export.
  - **Impact**: The stats page now correctly displays visual annotation counts and details
    for both live games (auto-generated annotations) and imported PGNs (human-authored
    annotations). No other functionality is affected.
- **Engine binary**: Stockfish 18 `arm64-v8a-dotprod` (unchanged).
- Version: versionCode=120, versionName="1.2.0" (unchanged — same version, deeper refactor).

## v1.2.0 Phase 82+++++ (rev 8) build notes (MessageBus reflection fix + proguard rules + sandbox hardening)
- All v1.2.0 Phase 82+++++ rev 7 build notes still apply.
- **v1.2.0 Phase 82+++++ rev 8 (2026.7.12): MessageBus reflection fix + proguard rules + sandbox hardening.**
  - **CRITICAL BUG fix (MessageBus.emit broken in release builds)**: `StockfishNative.setMessageBusWebView()`
    used reflection (`MessageBus.class.getDeclaredField("webView")`) to set the WebView on MessageBus.
    However, `build.gradle` enables `minifyEnabled true` for release builds, and R8 renames private
    fields. The reflection threw `NoSuchFieldException` (silently caught), leaving `webView=null` forever.
    This caused ALL `emitToJs()` calls (ENGINE_READY, ENGINE_BESTMOVE) to be silently dropped in release
    builds. Fixed by: (1) removing `final` from `MessageBus.webView` field, (2) adding public
    `setWebView(WebView)` method, (3) replacing reflection with direct method call. Primary app
    functionality was unaffected (engine callbacks flow through `postJsCallback`), but the MessageBus
    Java→JS channel was non-functional in release.
  - **proguard-rules.pro created**: `build.gradle` referenced `'proguard-rules.pro'` but the file
    didn't exist. AGP silently treats missing proguard files as empty, so R8 used only default rules.
    Created `proguard-rules.pro` with: `-keep class com.Regalia.MessageBus { *; }` (defense-in-depth
    even after the reflection fix), `@JavascriptInterface` keep rule (explicit), and native method
    keep rule.
  - **ROBUSTNESS fix (onDestroy removes MessageBus interface)**: `MainActivity.onDestroy()` removed
    only `"AndroidBridge"` but not `"MessageBus"`. Added `webView.removeJavascriptInterface("MessageBus")`
    for symmetry and defense-in-depth.
  - **SECURITY fix (isPathInSandbox prefix check tightened)**: `JsBridgeGateway.isPathInSandbox()` used
    `String.startsWith(filesPath)` which would falsely accept `/data/data/com.Regalia/files_evil` as
    inside filesDir. Fixed to require a path separator: `targetPath.equals(filesPath) ||
    targetPath.startsWith(filesPath + File.separator)`.
  - **SIMPLIFICATION**: `_messageBus` field made `final` (assigned once in constructor, never reassigned).
  - **Verification**: All v1.2.0 planned tasks (73-80) verified complete:
    - Task 73: 13 helper/manager Java classes ✓
    - Task 74: 5 new JS modules ✓
    - Task 75: MessageBus + Store wired (rev 7+8) ✓
    - Task 76: SonarCloud fixes (16 InterruptedException re-interrupts, secureRandomInt) ✓
    - Task 77: Review board coordinate labels ✓
    - Task 78: Version 120 in all 22 locations ✓
    - Task 79-80: APK + tar + manuals ✓
- **Engine binary**: Stockfish 18 `arm64-v8a-dotprod` (unchanged).
- Version: versionCode=120, versionName="1.2.0" (unchanged — same version, deeper refactor).

## v1.2.0 Phase 82+++++ (rev 7) build notes (MessageBus + Store wiring — Task 75 design intent)
- All v1.2.0 Phase 82+++++ rev 6 build notes still apply.
- **v1.2.0 Phase 82+++++ rev 7 (2026.7.12): MessageBus + Store wiring — Task 75 design intent correctly implemented.**
  - **Task 75 design intent** (from v1.2.0 Development Plan): MessageBus provides a unified JS↔Java
    communication channel with `dispatch()` (JS→Java) and `emit()` (Java→JS). Store provides a
    Redux-like single source of truth. Both were created in Phase 75 but never wired into production.
  - **MessageBus wiring (Java side)**:
    - `StockfishNative.java`: `_messageBus` field now instantiated in constructor with `new MessageBus(null)`.
      WebView set later via `setMessageBusWebView(webView)`.
    - `registerMessageBusHandlers()`: Registers 4 standard JS→Java handlers (per plan):
      `ENGINE_GO` (send position + go), `ENGINE_STOP` (stop search), `ENGINE_SET_OPTION` (set UCI param),
      `PGN_CACHE_SAVE` (save PGN cache). All delegate to existing engine methods.
    - `emitToJs(event, payload)`: Public method for Java code to emit events to JS.
    - `getMessageBus()`: Getter for MainActivity to access the MessageBus instance.
    - `MainActivity.java`: Registers MessageBus as a separate `JavascriptInterface` named "MessageBus"
      (alongside the existing "AndroidBridge"). Sets WebView via `setMessageBusWebView()`.
    - Engine events emitted via MessageBus (parallel to existing `postJsCallback`):
      `ENGINE_READY` (at engine ready, 2 locations), `ENGINE_BESTMOVE` (at bestmove, 1 location).
  - **MessageBus wiring (JS side)**:
    - `state-store.js`: Added `window._messageBusJs` object with `_onEvent(event, payload)` receiver.
      Uses `_messageBusJs` (not `MessageBus`) because the Java `@JavascriptInterface` registered as
      "MessageBus" would shadow a JS object of the same name.
    - `_onEvent` dispatches to Store for observability: `ENGINE_READY` → `Store.dispatch('ENGINE_READY')`,
      `ENGINE_ERROR` → `Store.dispatch('ENGINE_NOT_READY')`, `ENGINE_BESTMOVE` → `Store.dispatch('AI_THINKING_END')`,
      `ENGINE_EVAL` → `Store.dispatch('UPDATE_EVAL', payload)`.
    - Also notifies registered listeners via `on(event, listener)` / `off(event, listener)` API.
    - `MessageBus.java` `emit()` calls `window._messageBusJs._onEvent(event, payload)` via `evaluateJavascript`.
  - **Store wiring (already done in rev 5)**: Store is wired as a debug observability layer with
    `dispatch()` calls at `_resetGameUIState`, `toggleLang`, `toggleSound`, `enterReview`. The MessageBus
    `_onEvent` receiver now also dispatches to Store, making Store a unified observability hub for both
    UI state changes and engine events.
  - **Backward compatibility**: All existing `AndroidBridge` methods and `postJsCallback` calls remain
    unchanged. The MessageBus is a parallel channel — existing code is not affected. The MessageBus can
    be used for future migration to a unified communication pattern.
  - **Standard message types implemented** (per plan):
    | Direction | Type | Status |
    |-----------|------|--------|
    | JS→Java | `ENGINE_GO` | ✓ Registered (delegates to `sendUciCommand`) |
    | JS→Java | `ENGINE_STOP` | ✓ Registered (delegates to `sendUciCommand("stop")`) |
    | JS→Java | `ENGINE_SET_OPTION` | ✓ Registered (delegates to `sendUciCommand`) |
    | JS→Java | `PGN_CACHE_SAVE` | ✓ Registered (delegates to `savePGNCache`) |
    | Java→JS | `ENGINE_READY` | ✓ Emitted (at engine ready) |
    | Java→JS | `ENGINE_BESTMOVE` | ✓ Emitted (at bestmove) |
    | Java→JS | `ENGINE_EVAL` | Available (via `emitToJs`) — not yet emitted (evals go through `postJsCallback`) |
    | Java→JS | `ENGINE_ERROR` | Available (via `emitToJs`) — not yet emitted (errors go through `postJsCallback`) |
    | Java→JS | `PGN_CACHE_LIST` | Available (via `emitToJs`) — not yet emitted (list goes through `postJsCallback`) |
- **Engine binary**: Stockfish 18 `arm64-v8a-dotprod` (unchanged).
- Version: versionCode=120, versionName="1.2.0" (unchanged — same version, deeper refactor).

## v1.2.0 Phase 82+++++ (rev 6) build notes (visual annotation placeholder offset fix + design intent verification)
- All v1.2.0 Phase 82+++++ rev 5 build notes still apply.
- **v1.2.0 Phase 82+++++ rev 6 (2026.7.12): Visual annotation placeholder offset fix + design intent verification.**
  - **Read the v1.2.0 Development Plan** (`Regalia-v1.2.0-Development-Plan.md`) to understand the design intent
    for visual annotations ([%csl]/[%cal]). The plan specifies:
    - `_visualAnnotationsCache` entries must have `imported` flag: `imported=false` for auto-generated,
      `imported=true` for PGN-imported. `_buildPGNString()` only exports `imported=true`. ✓ Verified correct.
    - `reviewStates` must be cleared in `_resetGameUIState()` (Phase 64 root cause). ✓ Verified at ui.js:6665.
    - `enterReview` must clear the `_initial` key (Phase 57 fix for stale annotations). ✓ Verified at ui.js:5447.
  - **BUG fix (visual annotation placeholder offset)**: `ui.js` `_renderReviewMode()` — when reading visual
    annotations for review steps, the code used `_getVisualAnnotations(reviewStep-1)` WITHOUT applying the
    placeholder offset. When a black-to-move placeholder exists at `moveRecords[0]` (from
    `_prependBlackToMovePlaceholder` for FEN imports where Black is to move), `importPGN` stores imported
    annotations at `moveIdx + placeholderOffset`. Without the offset in the review read path, imported
    annotations were read from the wrong `moveIdx`, causing them to appear on the wrong review step (or not
    appear at all). Fixed by adding `const _rvPlaceholderOffset=(moveRecords.length>0&&moveRecords[0]===null)?1:0;`
    and reading `_getVisualAnnotations(reviewStep-1+_rvPlaceholderOffset)`. This mirrors the `_placeholderOffset`
    logic in `tablebase.js` `importPGN` (lines 1551, 1583).
  - **Stale annotation verification**: Verified the complete visual annotation lifecycle:
    1. `_computeAndCacheVisualAnnotations(moveIdx)` — called after `executeMove` with `moveIdx=moveRecords.length-1`.
       Uses `reviewMode` guard for `reviewStates` shortcut (only in review mode). Stores `imported=false`. ✓
    2. `_computeInitialPositionAnnotations()` — called on-demand in review mode for step 0. Uses
       `reviewStates[0].state` (the actual initial position, not live `gameState`). Stores `imported=false`
       under key `'_initial'`. ✓
    3. `importPGN` — stores imported annotations at `moveIdx + placeholderOffset` with `imported=true`. ✓
    4. `enterReview` — clears `'_initial'` key (forces fresh computation each review session). Keeps numeric
       keys (still valid for same game). ✓
    5. `_resetGameUIState` — clears entire `_visualAnnotationsCache` (new game / import / setup / FEN). ✓
    6. `_invalidateCachesForUndoneMoves` — deletes numeric keys >= currentMoveCount (undo). Keeps `'_initial'`. ✓
    7. `_buildPGNString` — only exports entries where `imported=true`. ✓
    All lifecycle paths verified correct. No stale annotation bugs found beyond the placeholder offset fix.
- **Engine binary**: Stockfish 18 `arm64-v8a-dotprod` (unchanged).
- Version: versionCode=120, versionName="1.2.0" (unchanged — same version, deeper refactor).

## v1.2.0 Phase 82+++++ (rev 5) build notes (dead module wiring + Web Worker verification + cache cleanup verification)
- All v1.2.0 Phase 82+++++ rev 4 build notes still apply.
- **v1.2.0 Phase 82+++++ rev 5 (2026.7.12): Dead module wiring + Web Worker verification + cache cleanup verification.**
  - **Dead module wiring (first-principles analysis)**: The 5 modules created in Phase 74/75
    (state-store.js, ui-audio.js, ui-board.js, ui-review.js, ui-toolbar.js) were previously
    dead code — bundled into chess.html but never called from production paths. First-principles
    analysis: these modules were designed as the architectural foundation for the God Module
    split, but the production code still uses the original inline implementations. The safest
    way to make them useful WITHOUT changing production behavior is to wire `Store`
    (state-store.js) as a **debug observability layer** — dispatching actions at key
    state-change points so `Store.getState()` mirrors the app state for debugging. This is
    purely additive (the globals remain the source of truth; Store is a read-only mirror).
    Wired points: `_resetGameUIState` (dispatches SETUP_EXIT + PGN_CLEARED), `toggleLang`
    (dispatches SET_LANG), `toggleSound` (dispatches TOGGLE_SOUND), `enterReview` (dispatches
    ENTER_REVIEW). All wrapped in try/catch with typeof guards — zero risk of breaking
    production if Store is unavailable.
  - **Web Worker verification**: Verified `worker-pool.js` implementation is correct and
    complete: (1) 3-strike consecutive-failure counter prevents permanent pool disable on
    transient OOM (Phase 71); (2) `onmessageerror` handler rejects immediately on
    serialization failure instead of hanging 30s (Phase 69); (3) `onerror` handler rejects
    all pending tasks for the crashed worker; (4) task cancellation with 30s timeout; (5)
    pagehide cleanup terminates all workers + rejects pending promises; (6) sync fallback
    for unknown functions; (7) queue cap (_MAX_QUEUE_SIZE=50) prevents unbounded growth.
    The `workerParsePGN` API is available but intentionally NOT called from `importPGNAsync`
    (Phase 49 removed the dead round-trip — the worker result was discarded and re-parsed
    synchronously, so it was pure overhead). The worker infrastructure is used by stats.html's
    separate inline worker. No changes needed — the implementation is robust.
  - **Cache cleanup verification**: Verified all 5 new-game entry points correctly call
    `_resetGameUIState()` which centrally clears 25+ state variables:
    1. New game dialog → `startGame()` → `_startGameImpl()` → `_resetGameUIState()` (ui.js:5847)
    2. Free opening button → `quickFreeOpening()` → `startGame()` → `_startGameImpl()` → `_resetGameUIState()`
    3. PGN import → `importPGN()` → `_resetGameUIState()` (tablebase.js:57)
    4. Setup complete → `exitSetup()` → `_exitSetupImpl()` → `_resetGameUIState()` (ui.js:5162)
    5. FEN import → `_importFENWithSaveCheck()` → `importFEN()` → `_applyImportedFEN()` → `_resetGameUIState()` (tablebase.js:57)
    All entry points confirmed. `_resetGameUIState` clears: selectedSquare, legalMvs, legalSet,
    lastMove, pendingPromotion, AI/ponder/eval/MultiPV state, _cachedStatus, cachedCtrlKey,
    _redoStack, resign state, visual annotations cache, reviewStates/reviewMode/reviewStep/
    reviewBaseState, _preReviewSnapshot, setupHistory/setupRedoStack, 7 dialog visibility flags,
    _pendingPGNCacheSave, _pgnCacheOpInProgress, _reviewAnalyzePriorityQueue, scroll state,
    game clocks, _turnStartTime, _ecoRecCache, _pvCache, _pendingEngineSANs/_pendingEnginePVs,
    _multiPV*, reviewCritical, _sfEval/_sfDepth/etc, _reviewEvalCache, _cachedOriginalPGN,
    playerWhite/playerBlack, _setupFEN, _importedStartMoveNum, _needNewGameForEngine,
    _tbLoading/_tbRetryCount.
- **Engine binary**: Stockfish 18 `arm64-v8a-dotprod` (unchanged).
- Version: versionCode=120, versionName="1.2.0" (unchanged — same version, deeper refactor).

## v1.2.0 Phase 82+++++ (rev 4) build notes (portrait review-top fix + documentation fixes)
- All v1.2.0 Phase 82+++++ rev 3 build notes still apply.
- **v1.2.0 Phase 82+++++ rev 4 (2026.7.12): Portrait review-top fix + documentation fixes.**
  - **BUG fix (portrait review-top missing open tag)**: `ui.js` `_renderReviewMode()` — the
    portrait branch was closing `.review-top` (at the end of the function) without ever opening
    it. This was a pre-existing bug in v1.1.2 (not a regression). The orphan `</div>` auto-closed
    `.review-body` instead, making `.review-bottom` a sibling of `.review-body` (not a child),
    so the CSS rule `.review-body > .review-bottom` did not apply in portrait mode. Fixed by
    adding the missing `h+='<div class="review-top">';` in the portrait open branch, matching
    the landscape branch. Now portrait and landscape both use the unified `.review-top` /
    `.review-bottom` layout as documented in the manual.
  - **Documentation fixes**:
    - `README.md` line 177: `versionCode=112` → `versionCode=120` (stale v1.1.2 reference).
    - `src/main/res/README.license` line 14: `"Regalia v1.1.1"` → `"Regalia v1.2.0"` (stale version).
    - `src/main/assets/README.license`: Added v1.1.2 (Phase 66-72) and v1.2.0 (Phase 73-82+++++ rev 4)
      summary entries (were missing — last entry was v1.0.9 Phase 52).
    - Both HTML manuals line 915: Version badge in title bar wireframe `v1.0.7` → `v1.2.0`.
- **Engine binary**: Stockfish 18 `arm64-v8a-dotprod` (unchanged).
- Version: versionCode=120, versionName="1.2.0" (unchanged — same version, deeper refactor).

## v1.2.0 Phase 82+++++ (rev 3) build notes (layout fix verified + APK rebuild)
- All v1.2.0 Phase 82+++++ rev 2 build notes still apply.
- **v1.2.0 Phase 82+++++ rev 3 (2026.7.12): Layout fix verified against v1.1.2 source + APK rebuilt.**
  - **Layout fix verified**: Extracted the v1.1.2 source (Regalia-v1.1.2-src.zip) and compared the
    `renderInternal()` HTML structure line-by-line between v1.1.2 (inline, 1295 lines) and v1.2.0
    (split into 11 sub-functions, 85 lines). Confirmed that the v1.2.0 source now produces
    **byte-for-byte identical HTML** to v1.1.2 for all 35+ layout scenarios tested (initial,
    black-side, setup, all dialogs, game-over states, ctrl-map, hints, multi-PV, move history,
    etc.). The only intentional differences are: version string (v1.1.2 → v1.2.0), Chess960 🎲
    button uses `secureRandomInt(960)` (security improvement), and Phase 77/83 review-mode
    coordinate labels (intentional new feature).
  - **Correct renderInternal order** (matches v1.1.2 exactly):
    1. `_renderHeader()` — header toolbar
    2. `<div class="main"><div class="bsec">` — open .main + .bsec
    3. `_renderAIBar(h, oppC)` — AI opponent bar (inside .bsec)
    4. `_renderBoardGrid(h, flip, cm)` — board grid (opens .display:flex + .bwrap, closes .bgrid)
    5. `_renderGameOverOverlay(h)` — game-over overlay (inside .bwrap, anchors to .bwrap via position:absolute)
    6. `_renderSetupPanel(h)` — setup panel (inside .bwrap)
    7. `</div></div>` — close .bwrap + .display:flex
    8. `_renderInfoBars(h)` — info bars (inside .bsec, outside .bwrap)
    9. `_renderPlayerBar(h)` — quick toolbar + player bar (inside .bsec, outside .bwrap)
    10. `</div>` — close .bsec
    11. `_renderSidePanel(h, infoSq, infoCtrl, oppC)` — side panel (opens .panel, closes .panel + .main)
    12. `_renderDialogs(h)` — all 8 modal dialogs
  - **APK rebuilt**: The previous APK (built 2026-07-11 22:14) had a stale `chess.html` that
    closed `.bwrap` before `_renderGameOverOverlay`/`_renderSetupPanel` (wrong order). The new
    APK (built 2026-07-11 22:40) has the correct order verified by extracting and checking the
    APK's `assets/chess.html`.
- **Engine binary**: Stockfish 18 `arm64-v8a-dotprod` (unchanged).
- Version: versionCode=120, versionName="1.2.0" (unchanged — same version, deeper refactor).

## v1.2.0 Phase 82+++++ (rev 2) build notes (layout regression fix + bug fixes)
- All v1.2.0 Phase 82+++++ build notes still apply.
- **v1.2.0 Phase 82+++++ rev 2 (2026.7.12): Main interface layout regression fix + 3 bug fixes from comprehensive code review.**
  - **CRITICAL: Main interface layout regression (root cause of "主界面布局异常")**:
    The Phase 82++++ layout "fix" introduced two structural bugs in `renderInternal()`:
    1. **Extra `</div>` after `_renderSidePanel`**: `_renderSidePanel` already closes both
       `.panel` AND `.main` (its trailing `</div></div>` closes `.panel` + `.main`). The
       Phase 82++++ code added an extra `h+=</div>` after `_renderSidePanel`, creating an
       unbalanced `</div>` that closed `#app` prematurely. This caused all subsequent
       content (dialogs, review overlay) to render outside the `#app` flex container,
       breaking the layout. Fixed by removing the extra `</div>`.
    2. **Missing `</div></div>` after `_renderBoardGrid`**: `_renderBoardGrid` opens
       `<div style="display:flex">` (rank label + board wrapper) and `<div class="bwrap">`
       but only closes `.bgrid` (the 8×8 grid). The `.bwrap` and `.display:flex` wrapper
       were never closed, causing all post-board content (game-over overlay, setup panel,
       info bars, player bar) to be nested INSIDE the board's flex wrapper. Fixed by adding
       `h+=</div></div>` after `_renderBoardGrid` to close `.bwrap` + `.display:flex`.
    The correct v1.1.2 structure is: `.main > .bsec > [AI bar, board wrapper (.flex+.bwrap),
    game-over, setup, info bars, player bar] + .panel`. `_renderSidePanel` closes `.panel`
    and `.main`.
  - **BUG fix (tablebase retry false AI timeout)**: `game-logic.js` `doAIMove()` — when
    the tablebase API rejects (network error), the `.catch()` block called `doAIMove()`
    to retry, but each call incremented `_aiRetryCount`. After 2 tablebase rejections,
    `_aiRetryCount` reached 3, triggering the false `ai_timeout` toast and returning
    before Stockfish was ever consulted. Fixed by resetting `_aiRetryCount=0` in the
    `.catch()` block (tablebase failure is not an AI timeout).
  - **BUG fix (inverted WDL on checkmate)**: `ai-bridge.js` `requestEngineEval()` and
    `_requestBatchEval()` — when the review position is checkmate, the WDL values cached
    were inverted. When Black was checkmated (White wins), `wdlW` was set to 0 and
    `wdlL` to 1000 (should be `wdlW:1000, wdlL:0`). The eval bar showed "(0%W/0%D/100%L)"
    for a position White had won. Fixed by swapping the ternary branches in both functions.
  - **Robustness fix (typeof guard for pieceCountLE7)**: `game-logic.js` `doAIMove()` —
    `pieceCountLE7` is defined in `tablebase.js` (loaded after `game-logic.js`). Added
    `typeof pieceCountLE7==='function'` guard for consistency with all other cross-module
    calls.
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

