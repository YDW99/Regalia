<!--
  Privacy Policy — Regalia
  Copyright (C) 2026 Regalia
  Licensed under GNU Affero General Public License v3 (AGPL v3)

  AI-GEN: AI assisted
  This document was AI-assisted and has been reviewed for AGPL v3 compliance.
-->
# Privacy Policy — Regalia

Regalia is a fully offline chess application. This policy applies to the Regalia Android application (current version: **v1.2.3**, versionCode 123).

## Data Collection

**Regalia collects no personal data.** The application:

- Does not collect, transmit, or store any personal information
- Does not require user registration or accounts
- Does not include advertising SDKs or analytics services
- Does not track user behavior or game history remotely

## Network Access

Regalia's core features work entirely offline. The only network-dependent features are:

- **Syzygy Endgame Tablebase**: Queries the public Lichess Tablebase API (`tablebase.lichess.ovh`) for positions with 7 or fewer pieces. This is optional and automatically disabled when offline. No personal data is sent in these queries — only chess position data (FEN strings). All network traffic is forced over TLS 1.2+ via `TlsSecurityHelper.java` and `network_security_config.xml` (cleartext traffic is blocked entirely).
- **External hyperlinks (v1.0.4 Rev27+)**: When the user taps a hyperlink in the About dialog (e.g. the GitHub source code link, AGPL v3 / GPL v3 license links) or anywhere else in the app, the URL is handed to the system default browser via `Intent.ACTION_VIEW`. Regalia itself does not make any HTTP request — the browser app handles the URL fetch. Only http(s) URLs are allowed; other schemes are silently rejected. No Regalia data is sent to the browser; the URL itself is the only datum transmitted.

All other features, including AI gameplay, review analysis, PGN import/export, and engine configuration, work without any network connection.

## Local Data

Game data (board positions, move records, engine settings, PGN cache entries, eval cache) is stored locally on the device using browser localStorage, Android SharedPreferences, and app-private files. The on-device storage locations are:

- `/data/data/com.Regalia/app_webview/Local Storage/` — WebView localStorage (may be wiped by aggressive OEM memory managers like Xiaomi HyperOS 3)
- `/data/data/com.Regalia/shared_prefs/RegaliaEngine.xml` — SharedPreferences (engine settings, language preference, persistent kv_* fallback store)
- `/data/data/com.Regalia/files/eval_cache.json` — Eval cache (per-move Stockfish evaluations for review mode, v1.0.4 Rev20+)
- `/data/data/com.Regalia/files/pgn_cache/<name>.pgn` — PGN cache entries (saved via 📚 PGN Cache Manager)
- `/data/data/com.Regalia/files/pgn_cache/<name>.tags.json` — Tag files for PGN cache entries (v1.0.4 Rev20+)

### v1.0.4 Rev28: Stats↔main PGN sync

The stats page (`StatsActivity`) and the main/review page (`MainActivity`) now synchronize PGN data bidirectionally:

- **Entering stats page**: `openStatsPage()` always rebuilds the PGN from the current `moveRecords` and passes it to the stats page via the Intent extra `statsPayload`. No PGN data leaves the device.
- **Returning from stats page**: If the user imported a PGN on the stats page and tapped "Yes" on the "🗃️ Import PGN to game?" dialog, the imported PGN text is stashed in a static volatile field `StatsActivity.importedPGNOnStats` (in-memory only, never written to disk) and read by `MainActivity.onResume()` (one-shot — cleared immediately after read). The PGN is then imported into the main game via `importPGN()`. If the user tapped "No" or "Cancel", no data crosses the activity boundary.

This data:

- Never leaves the device
- Can be cleared by uninstalling the app or clearing app data
- Is not shared with any third party
- The PGN cache entries contain only chess game records (PGN format) — no personal or device-identifying information. They are never uploaded.
- The eval cache (`eval_cache.json`) contains per-move Stockfish evaluation scores (centipawn values, mate distances, search depths, WDL probabilities) keyed by review step index. It contains no personal or position-identifying information beyond the chess evaluation data itself. (v1.0.7+: capped at 2000 entries via LRU eviction — the currently-viewed step is never evicted; eviction order is preserved across app restarts.)
- The tag files contain user-defined tag strings (e.g., "opening", "tactics") for organizing PGN cache entries. They contain no personal or device-identifying information.

### v1.2.3 round-17: SonarCloud cleanup + God Class refactor (HapticManager / ui split)

The v1.2.3 round-17 change (2026.7.17) is a pure code-quality and code-organization change: SonarCloud-driven cleanups (`Number.*` conversions, arrow functions, `catch (Exception)` narrowing, `dataset`, `Math.trunc`, `replaceAll`, regex simplification) and a God Class refactor extracting `HapticManager.java` from StockfishNative.java plus `ui-gameflow.js` / `ui-interactions.js` from ui.js. **No new permissions, no new network access, no new data collection, no changes to how data is stored or transmitted.** All extracted code runs with the same privileges and data access as before; the JS↔Java bridge API surface is unchanged (thin `@JavascriptInterface` delegates).

Version: `versionCode=123`, `versionName="1.2.3"` (unchanged — same version, quality/refactor round).

### v1.2.0 Phase 82+++: renderInternal AI/player/info bars extraction

The v1.2.0 Phase 82+++ change (2026.7.12) extracts 3 more rendering blocks from `renderInternal()` into dedicated functions: `_renderAIBar(h, oppC)`, `_renderPlayerBar(h)`, and `_renderInfoBars(h)`. `renderInternal()` was further reduced from 476 to 359 lines. This is a pure code-organization change — **no new permissions, no new network access, no new data collection, no changes to how data is stored or transmitted**. All extracted functions use global state only (with `oppC` passed as a parameter where needed); the `h` string concatenation pattern is preserved.

Version: `versionCode=120`, `versionName="1.2.0"` (unchanged — same version, deeper refactor).

### v1.2.0 Phase 82++: renderInternal main-board extraction

The v1.2.0 Phase 82++ change (2026.7.12) extracts 4 more rendering blocks from `renderInternal()` into dedicated functions: `_renderHeader()`, `_renderBoardGrid(h, flip, cm)`, `_renderSetupPanel(h)`, and `_renderSidePanel(h, infoSq, infoCtrl, oppC)`. `renderInternal()` was further reduced from 619 to 476 lines. This is a pure code-organization change — **no new permissions, no new network access, no new data collection, no changes to how data is stored or transmitted**. All extracted functions use global state only (with `flip`, `cm`, `infoSq`, `infoCtrl`, `oppC` passed as parameters where needed); the `h` string concatenation pattern is preserved.

Version: `versionCode=120`, `versionName="1.2.0"` (unchanged — same version, deeper refactor).

### v1.2.0 Phase 82+: renderInternal review mode extraction

The v1.2.0 Phase 82+ change (2026.7.12) extracts the entire review-mode rendering block from `renderInternal()` (615 lines) into a new `_renderReviewMode(h)` function. `renderInternal()` was further reduced from 1,224 to 619 lines. The block renders the complete review-mode overlay (board, eval bar, slider, chart, nav buttons, analyze button). This is a pure code-organization change — **no new permissions, no new network access, no new data collection, no changes to how data is stored or transmitted**. The extracted function uses global state only; the `h` string concatenation pattern is preserved. The early-return path (invalid review state) is handled via a `{h, done}` return value so the caller can skip stale-DOM scroll-save/restore logic.

Version: `versionCode=120`, `versionName="1.2.0"` (unchanged — same version, deeper refactor).

### v1.2.0 Phase 81-83: Deep refactor continuation (EngineConfigHelper + renderInternal split + review board fix)

The v1.2.0 Phase 81-83 changes (2026.7.11) continue the architecture refactor. `StockfishNative.java` was further reduced from 4,492 to 4,245 lines by extracting engine configuration methods into a new `EngineConfigHelper.java` (13th helper class). `renderInternal()` in `ui.js` was reduced from 1,365 to 1,224 lines by extracting 8 modal dialog blocks into `_renderDialogs(h)`. The review board display regression (Phase 77's flex-layout coordinate labels breaking the CSS Grid) was fixed. This is a pure code-organization + bug-fix change — **no new permissions, no new network access, no new data collection, no changes to how data is stored or transmitted**. Specifically:

- **Engine configuration methods** (`setAutoConfig`, `detectHardwareAndConfigure`, `applySettings`, `setEngineThreads`, `setEngineHash`, `setEngineMoveOverhead`, `setEngineMultiPV`, `setEnginePonder`, `setEngineShowWDL`, `setEngineSkillLevel`, `setEngineLimitElo`, `setElo`, `setGameDifficulty`, `forceFullStrength`, `syncGameDifficulty`, etc.) moved from `StockfishNative.java` to `EngineConfigHelper.java`. Logic unchanged — all range capping (threads ≤ 2×CPU cores, hash ≤ 50% JVM heap, moveOverhead ≤ 1000ms, multiPV ≤ 8, skillLevel 0-20, elo 500-3500) and big.LITTLE hardware detection are preserved. All `@JavascriptInterface` method signatures on `StockfishNative` are preserved as thin delegates.
- **Modal dialog rendering** (new game, engine config, resign confirm, about, import, promotion, save PGN, PGN cache manager) extracted from `renderInternal()` into `_renderDialogs(h)`. Logic unchanged — the `h` string concatenation pattern is preserved.
- **Review board coordinate label fix** (Phase 83): The Phase 77 flex-layout label wrappers inside `.bgrid` (CSS Grid) broke the 64-cell grid layout. Fixed by moving labels to `position:absolute` siblings of `.bgrid`. This is a pure visual/layout fix — no data implications.

Version: `versionCode=120`, `versionName="1.2.0"` (unchanged — same version, deeper refactor).

### v1.2.0 Phase 73-80: Architecture refactor (God Module split)

The v1.2.0 architecture refactor (2026.7.11) restructured the codebase to reduce technical debt. `StockfishNative.java` was split into 11 manager/helper classes, and `ui.js` was split into 4 JS modules + `_computeAndCacheVisualAnnotations` was decomposed into 4 sub-functions + `_buildEvalTrendSVG` was decomposed into 6 sub-functions. This is a pure code-organization change — **no new permissions, no new network access, no new data collection, no changes to how data is stored or transmitted**. Specifically:

- **File I/O operations** (`writeTextFile`, `readTextFile`, `listFiles`, `loadAssetAsBase64`, etc.) moved from `StockfishNative.java` to `FileIoHelper.java`. The `loadAssetAsBase64` method gained a `..` path-traversal check (defense-in-depth; the only existing call site uses a literal `'AGPLv3_Logo.svg'` which is unaffected).
- **Permission checks** (`hasStoragePermission`, `requestStoragePermission`, `hasNotificationPermission`, `requestNotificationPermission`) moved to `PermissionHelper.java`. Logic unchanged.
- **Haptic feedback** moved to `HapticHelper.java`. Logic unchanged.
- **SAF file picker operations** (export settings/PGN, import settings/PGN, cancel pending export) moved to `SafPickerHelper.java`. Logic unchanged — the PGN import 5000-line truncation guard and control-character sanitization are preserved.
- **Engine settings query/export/import** (`getEngineInfo`, `getEngineSettings`, `exportSettings`, `exportEngineSettings`, `importSettings`, `importEngineSettings`) moved to `EngineSettingsHelper.java`. Logic unchanged — the Phase 71 range capping (threads ≤ 2×CPU cores, hash ≤ 50% JVM heap, moveOverhead ≤ 1000ms) and autoConfig-override-on-explicit-import behavior are preserved.
- **PGN cache CRUD** moved to `PgnCacheManager.java`. Logic unchanged.
- **MessageBus.java** and **state-store.js** are new infrastructure for unified JS↔Java communication and global state management. They process only in-memory game state (board positions, move lists, UI preferences) — no personal data, no network access.
- **Review board coordinate labels** (Phase 77): Added left 1-8 rank labels, top a-h file labels, and per-square coordinate labels to the review-mode board. This is a pure visual enhancement — no data implications.

Version: `versionCode=120`, `versionName="1.2.0"`.

### v1.2.0 Phase 72: review analyze-all "false completion" bug fix

The Phase 72 change (2026.7.12) is a pure bug fix in `_reviewAnalyzeAdvance` (ui.js) — the review-mode "Analyze All" batch completion check. No new permissions, no new network access, no new data collection, no changes to how data is stored or transmitted. The fix only affects the in-memory `_reviewEvalCache` scan logic (when to stop the batch and report completion). Version unchanged: `versionCode=120`, `versionName="1.1.2"`.

### v1.2.0 Phase 71: CSP relaxation + XSS hardening on stats page

The stats page (`stats.html`) Content-Security-Policy was relaxed from a fixed SHA-256 hash to `'unsafe-inline'` (Phase 71, 2026.7.11) to unblock the 23 inline `onclick` event handlers used for move selection (the previous hash-based policy silently blocked them per CSP Level 2+). This is safe because:

- `stats.html` is a local asset (`file:///android_asset/`) with no externally injected content.
- All JavaScript in `stats.html` is inlined — no external script loading.
- The `connect-src 'none'` directive remains, preventing any network fetch from the stats page.
- As defense-in-depth, all unrecognized movetext/variation-text/notation characters are now HTML-escaped via `_escFEN` before insertion into `innerHTML`, neutralizing any `<img onerror>`, `<script>`, or similar payload that might be present in a user-pasted PGN. No user data leaves the device — the hardening is purely a local-rendering safety measure.

No new permissions, no new network access, no new data collection. Version unchanged: `versionCode=120`, `versionName="1.1.2"`.

### v1.2.1 fourth-pass: Round-4 cleanup — dead-code purge (2026.7.13)

The v1.2.1 fourth-pass refinement (2026.7.13) is a first-principles cleanup that reverts the third-pass "unused-file activation" round (above) and slimms two manager classes. **No new permissions, no new network access, no new data collection, no changes to how data is stored or transmitted.** Specifically:

- **Deleted 7 files** (3 Java + 4 JS): `MessageBus.java` / `UciProtocolHandler.java` / `EngineConfigManager.java` / `ui-audio.js` / `ui-board.js` / `ui-review.js` / `ui-toolbar.js`. These were Phase-73/74 extracts that duplicated inline logic in `StockfishNative.java` / `ui.js` / `ai-bridge.js` with subtly different conventions (rank order, move taxonomy, audio state, ELO ranges). The third-pass "activation" wired them in via `typeof` guards and `try-catch` wrappers, but the activation was "for activation's sake" — no user-facing feature depended on them, and several introduced semantic-drift risks.
- **Slimmed 2 files**: `EngineHealthMonitor.java` (208 → 85 lines) and `EngineProcessManager.java` (489 → 111 lines). The deleted methods (heartbeat thread, zombie detection, `extractEngineFromApk`, `startProcess`, etc.) were all dead code — `StockfishNative` keeps its own inline copies for direct field access.
- **TlsSecurityHelper.validatePin retained**: The actual SPKI SHA-256 pin validation implemented in the third pass is KEPT (it was a real security improvement; only the dead-code activation was reverted).
- **Bug fix retained and propagated**: `StockfishNative.extractEngineFromApk` (inline) now guards against `ZipEntry.getSize() == -1` — the same fix that had been applied only to the now-deleted `EngineProcessManager.extractEngineFromApk` copy.

No user data is collected, stored, or transmitted by any of these changes. The cleanup reduces the codebase by ~1,300 lines and eliminates 7 dead modules.

Version: `versionCode=121`, `versionName="1.2.1"` (unchanged — same-version refinement).

### v1.2.1 fifth-pass: Round-5 review — line-by-line audit of remaining 28 files (2026.7.13)

The v1.2.1 fifth-pass refinement (2026.7.13) is a first-principles line-by-line audit of all remaining 19 Java files + 9 JS files. **No new permissions, no new network access, no new data collection, no changes to how data is stored or transmitted.** Specifically:

- **Removed 2 unused imports**: `ChessApp.java` and `ChessWebViewClient.java` each had a leftover `import android.os.Build;` that was never referenced after earlier refactors. Pure dead-code removal — no behavioral change.
- **Bug fix**: `EngineSettingsHelper.importSettings` — the `engine.elo` case used a 1-3200 range, inconsistent with `EngineConfigHelper`'s canonical 500-3500 range. Importing a value like 400 would pass the 1-3200 check, then be silently re-clamped to 500 on the next `setEngineLimitElo` call. Fixed to `Math.max(500, Math.min(3500, ...))`. **No user data is transmitted** — the fix only affects local ELO validation on settings import.
- **Verified clean**: All other 16 Java files and all 9 JS files were audited line-by-line. No dead code, no inconsistent ranges, no leftover debug statements, no references to deleted symbols, no `debugger;` statements, no `TODO`/`FIXME`/`HACK` markers.

No user data is collected, stored, or transmitted by any of these changes.

Version: `versionCode=121`, `versionName="1.2.1"` (unchanged — same-version refinement).

### v1.2.1 sixth-pass: Round-6 review — stats page visual annotation bug fix (2026.7.13)

The v1.2.1 sixth-pass refinement (2026.7.13) fixes a user-reported bug where the statistics page's visual annotations section was silently hidden for all newly-played games. **No new permissions, no new network access, no new data collection, no changes to how data is stored or transmitted.** Specifically:

- **Bug fix**: `openStatsPage()` (ai-bridge.js) now sends a `visualAnnotations` field in the payload to the stats page, containing all visual annotation cache entries (both imported and auto-generated). The stats page uses this field as the primary data source instead of scanning the PGN text (which only contained imported annotations per the Phase 62 design). **No user data is transmitted** — the visual annotations are computed locally from the board state and were already displayed in the review board; this fix merely makes them visible in the stats page too.

No user data is collected, stored, or transmitted by this change.

Version: `versionCode=121`, `versionName="1.2.1"` (unchanged — same-version refinement).

### v1.2.1: Hardening + bug-fix revision (same version line)

The v1.2.1 release (2026.7.13) is a hardening + bug-fix revision. **No new permissions, no new network access, no new data collection, no changes to how data is stored or transmitted.** Specifically:

- **JsBridgeGateway sandbox path check hardened**: `isPathInSandbox()` now requires a trailing `File.separator` before `startsWith`, closing a theoretical directory-traversal where `/data/data/com.Regalia/files_evil/x` could pass the `filesDir` check. No file ever left the sandbox in practice — the fix is defense-in-depth.
- **SAF persistable URI permission grants removed**: One-shot PGN/settings import/export operations no longer call `takePersistableUriPermission`. The transient `FLAG_GRANT_READ/WRITE_URI_PERMISSION` from the SAF picker Intent is sufficient and no longer consumes the 512-grant cap. **No data leaves the device; the change reduces standing app privileges.**
- **PGN cache name input validation**: The `prompt()` for PGN cache name now enforces a 60-character length cap and rejects filesystem-dangerous characters (`/ \ : * ? " < > |` and control characters), matching the existing validation in `_renameHumanPlayer`.
- **Engine thread-death detection**: `ChessApp`'s `UncaughtExceptionHandler` now sets a static flag via `StockfishNative.markEngineThreadDead(threadName)` when an `SF-*` engine thread dies. The heartbeat monitors this flag and triggers `recoverEngine()` — previously, a dead reader thread could leave the engine process alive but unresponsive, manifesting as a 15–30s silent hang. **No data is collected or transmitted** — the flag is in-memory only and reset on successful engine restart.
- **`_restartInProgress` stale-detection**: `recoverEngine()` and `restartEngine()` now reset the restart lock if it has been stuck for >30s (e.g., the inner executor task was silently discarded by `shutdownNow()`). Pure reliability fix — no data implications.
- **`_discardingPonderBestmove` TOCTOU**: `stopAndWaitForBestmove()` and the bestmove reader thread now clear the discard flag in the early-return and latch-capture paths, preventing the flag from being stuck `true` and silently discarding the next legitimate bestmove (manifesting as "AI never moves"). Pure reliability fix.
- **Chess960 re-apply symmetry**: After an engine crash/recovery, `UCI_Chess960` is now re-applied as both `true` AND `false` based on `_pendingChess960` — previously only `true` was re-applied, so a user who switched from Chess960 back to standard chess could have `UCI_Chess960=true` erroneously retained after a crash.
- **eval-mode option leak fix**: `engineStop()` now calls `restoreGameplayOptions()` if it interrupts a `STATE_EVAL` search, preventing `Contempt=0` / `MultiPV=1` / `UCI_AnalyseMode=true` from leaking into the next gameplay search. Pure gameplay-correctness fix.
- **`sendSetOptionAndWait` newline hardening**: The `value` parameter is now stripped of `\r` / `\n` before concatenation into the UCI command, matching the parallel hardening applied to `UciProtocolHandler.setOptionAndWait` in v1.2.0. Prevents UCI command injection via a malicious option value.
- **Checkmate WDL inversion fix**: The fast-path WDL cache writes in `requestEngineEval` and `_requestBatchEval` now write `wdlW=1000` (not 0) when Black is checkmated, matching the White-POV swap in `onEngineEval`'s normal path. The eval bar and PGN `[%eval #N]` tags now display correct WDL percentages for mate positions.
- **`[%eval #N]` tag format fix**: `formatEvalAnnotation` now defaults `absMd` to 1 (matching `formatEvalTag`) when `mateDist=0` but `|eval|≥90000`, eliminating malformed `[%eval #+]` / `[%eval #-]` tags that some PGN readers reject.
- **`onBestMove` validation order**: UCI move parsing and piece-existence checks now run BEFORE clearing `isAIThinking` / `_aiSafetyTimerId` / `_aiRetryCount`, so an unparseable bestmove keeps the safety timer active for retry instead of leaving the AI in a "not thinking, no safety timer, but still AI's turn" deadlock.
- **CSS `font-family` entity fix**: The 5 `&#x27;` HTML entities inside `<style>` rules in `index.html.tpl` (which the HTML parser does NOT decode in raw-text mode) have been replaced with literal `'` characters. The chess pieces, review pieces, promotion buttons, setup buttons, and move-animation overlay now correctly use the documented `'DejaVu Sans','Noto Sans','Segoe UI Symbol'` font stack instead of falling back to the inherited font.
- **`StatsActivity.onDestroy` parity**: Added `webView.stopLoading()` as the first step of WebView teardown, matching `MainActivity.onDestroy` — prevents a SIGSEGV on certain OEM ROMs (HyperOS 3, MIUI) when the WebView dispatches a load callback to a destroyed native peer.
- **`HapticHelper` system-setting check**: The main-game haptic feedback now respects the system `HAPTIC_FEEDBACK_ENABLED` setting, matching `StatsActivity.performHaptic` — previously the main game vibrated even when the user had disabled system haptic feedback.
- **`EngineProcessManager.extractEngineFromApk` divide-by-zero guard**: `ZipEntry.getSize()` may return -1 (unknown size); the progress percentage calculation now falls back to a fixed 25% in that case instead of producing negative/incorrect values.

Version: `versionCode=121`, `versionName="1.2.1"`.

## Permissions

| Permission | Purpose | Required |
|-----------|---------|----------|
| INTERNET | Tablebase API queries | No (only for tablebase feature) |
| ACCESS_NETWORK_STATE | Detect offline status | No |
| WAKE_LOCK | Keep engine process alive during analysis | Yes (foreground service) |
| VIBRATE | Haptic feedback (personified per-piece haptics, v1.0.8+) | No |
| FOREGROUND_SERVICE | Engine stability notification | Yes (Android 14+) |
| FOREGROUND_SERVICE_SPECIAL_USE | Engine foreground service type (`specialUse`, Android 14+) | Yes (Android 14+) |
| POST_NOTIFICATIONS | Engine foreground service notification (Android 13+) | Yes (Android 13+, runtime-requested) |
| READ_EXTERNAL_STORAGE | PGN file import from shared storage (legacy, `maxSdkVersion=32`) | No (SAF used on Android 13+) |
| WRITE_EXTERNAL_STORAGE | PGN/settings file export to shared storage (legacy, `maxSdkVersion=28`) | No (SAF used on Android 9+) |

> **Note on sensors (v1.0.5+):** The board anti-shake feature (`StabilizationHelper.java`) reads the `TYPE_LINEAR_ACCELERATION` sensor for OIS-style translation compensation. This sensor does **not** require any Android permission and the raw motion data is **never** stored or transmitted — it is consumed in real time to apply a `transform: translate()` on the board element and discarded. No permission declaration is needed in the manifest for this sensor.

> **Note on the wake lock (v1.1.0 Phase 57+):** The `EngineService` foreground service acquires a partial wake lock with a **30-minute timeout** as a safety net. If the OEM silently kills the service and `onDestroy` never runs, the wake lock is released automatically after 30 minutes — preventing indefinite CPU wake on misbehaving OEM ROMs. Normal analysis sessions are well under this window; longer sessions re-acquire by re-entering the foreground state.

## Haptic Feedback (v1.0.8+)

v1.0.8 introduces personified haptic feedback — each of the six piece types (pawn, knight, bishop, rook, queen, king) plus castling and promotion has a dedicated vibration pattern. Haptics are:

- Triggered locally via `Vibrator`/`VibrationEffect` (API 26+) or PWLE (API 35+)
- Controlled by the user's system haptic-feedback preference (`Settings → Sound & vibration → Haptic feedback`)
- Throttled per-event-type to avoid vibration fatigue
- Never recorded or transmitted — the vibration is the only output

## Engine Binary Integrity

The Stockfish 18 engine binary (`libstockfish.so`) is shipped as an arm64-v8a native library inside the APK. On first launch, `StockfishNative.java` validates the binary:

- **ELF magic check** (first 4 bytes = `\x7fELF`) — guards against corrupted downloads.
- **SHA-256 hash verification** against a baked-in expected hash — guards against tampering.

If either check fails, the engine refuses to start and reports the error to the user via the UI. The binary is never downloaded at runtime; it is statically embedded in the APK.

## v1.2.3 round-13 refinement (2026.7.16)

The round-13 refinement re-enabled CMake (resolving the round-12 build workaround) and applied a comprehensive first-principles per-file/per-line code review using 6 parallel review agents. **No new permissions, no new data collection, no new network access, no changes to data flow or storage.** All changes are internal bug fixes and robustness improvements with zero privacy impact:

- **`JsBridgeGateway.java` UCI command injection guard (P0)**: Added CR/LF rejection in `isUciCommandAllowed` before the whitelist lookup. A JS caller could previously inject arbitrary UCI commands (including `quit`) via `sendToEngine("setoption name X value 1\nquit")`. No privacy impact — defense-in-depth for engine process integrity.
- **`StockfishNative.java` restartEngine fix (P0)**: Reset `shutdownRequested` flag after `shutdown()` so `startEngine()` can proceed. Previously, a user-initiated engine restart would leave the engine permanently dead. No privacy impact — internal engine lifecycle fix.
- **`StockfishNative.java` _evalDeepBatchActive clear (P1)**: Added `_evalDeepBatchActive = false` to `cleanupEngineResources()` so a crashed engine doesn't leak the batch flag to the new engine, producing biased eval results. No privacy impact — internal correctness fix.
- **`SafPickerHelper.java` + `StatsActivity.java` openInputStream null-check (P1)**: `ContentResolver.openInputStream(Uri)` can return null; two read methods now throw a descriptive `IOException` instead of a confusing NPE. No privacy impact — better error diagnostics for file imports.
- **`StabilizationHelper.java` registerListener return check (P1)**: Now checks `SensorManager.registerListener` return value; logs a warning on failure instead of silently reporting stabilization as active. No privacy impact — sensor anti-shake feature reliability.
- **`AndroidManifest.xml` `<queries>` element (P1)**: Added targeted `<queries>` block listing 12 root-detection package names so `RootDetector.checkRootPackages` works on Android 11+ (API 30+ package visibility restrictions). No privacy impact — the root detection is informational-only (app never refuses to run on rooted devices); the `<queries>` declaration is a manifest-level visibility grant, not a new permission. The declared packages are common root-detection app package names (Magisk, SuperSU, etc.) — declaring them does NOT install or query them unless they're already present on the device.
- **`ChessWebViewClient.java` render-crash fallback UI (P1)**: After 4+ render-process crashes in 60s, the user now sees a bilingual recovery message instead of a frozen screen. No privacy impact — UX improvement.
- **`ChessWebViewClient.java` fallback context (P2)**: When opening an external URL and the Activity is destroyed, now uses `getApplicationContext()` instead of the dead Activity context. No privacy impact — prevents silent URL-open failures.
- **`ui.js` gameClockTimerId cleanup (P1)**: Added `clearInterval(gameClockTimerId)` to `_cleanupEventListeners` so a timed game's 200ms interval doesn't keep firing after Activity destroy. No privacy impact — resource cleanup.
- **`StockfishNative.java` PROCESS_DESTROY_GRACE_MS alignment (P2)**: `shutdown()` now uses the named constant instead of a bare `200` literal. No privacy impact — consistency fix.
- **`PgnCacheManager.java` delete return value (P2)**: Now returns `true` if any deletion occurred (PGN and/or tags), not only when the PGN file was deleted. No privacy impact — accurate batch-deletion counting.
- **`eco-data.js` cache pollution guard (P2)**: Added `if(_ecoData.length>0)` guard before saving to IndexedDB, preventing a parse failure from overwriting valid cached data with an empty array. No privacy impact — ECO data is bundled in the app (not user data); the cache is a performance optimization.
- **`tablebase.js` variation moveNum offset (P2)**: Applied `_importedStartMoveNum` offset to relocated variation move numbers so they display correctly for FEN-started games. No privacy impact — display correctness.
- **`build.gradle` empty-keystore-path guard (P2)**: Added `!releaseKeystorePath.isEmpty()` check. No privacy impact — better error message for fresh checkouts.
- **`gradle.properties` dead property removal (P2)**: Removed `android.enablePngCrunchInReleaseBuildsLibs=false` (not a recognized AGP property). No privacy impact — config cleanup.
- **`build-chess.py` dead CSP hash block removal (P2)**: Removed the stats.html CSP sha256 hash auto-update block (stats.html now uses `'unsafe-inline'`). No privacy impact — dead code removal.
- **`AndroidManifest.xml` allowBackup resolution (P2)**: Removed `android:fullBackupContent` and `android:dataExtractionRules` attributes (dead config when `allowBackup="false"`). The two XML rule files are retained in `res/xml/` for reference. No privacy impact — `allowBackup="false"` (the documented v1.0.4 design decision) is unchanged; the app still does not participate in Android backup/restore. Removing the dead references just makes the manifest accurately reflect the actual behavior.
- **P3 cleanup (stale comments, dead code)**: 11 minor fixes across `MainActivity.java`, `EngineService.java`, `TlsSecurityHelper.java`, `network_security_config.xml`, `ai-bridge.js`, `FileIoHelper.java`, `StockfishNative.java`, `EngineConfigHelper.java`, `tablebase.js`, `pgn-standard.js`. All are documentation-only or dead-code removal. No privacy impact.

Version: `versionCode=123`, `versionName="1.2.3"` (unchanged — bug-fix round, no version bump).

## v1.2.3 round-12 refinement (2026.7.16)

The round-12 refinement addresses two open SonarCloud bugs and applies a first-principles code review guided by three uploaded PDFs (AI code-gen defect prevention, Android WebView dev, SonarCloud pass guide). **No new permissions, no new data collection, no new network access, no changes to data flow or storage.** All changes are internal to the app and have zero privacy impact:

- **`game-logic.js` + `ui.js` slider aria-label (SonarCloud Bug #1, Web:InputWithoutLabelCheck)**: The review-mode slider's `<input type="range">` overlay (transparent, handles touch/keyboard) now uses a descriptive `aria-label` (`T('review_move_slider')` → "复盘步数" / "Review move number") instead of the terse `T('step_label')` ("Step" / "第"). WCAG 2.1 Level A 4.1.2 (Name, Role, Value) compliance. No privacy impact — accessibility-only change.
- **`StockfishNative.java` InterruptedException handling (SonarCloud Bug #2, java:S2142)**: `recoverEngine()` auto-recovery sleep now restores `Thread.currentThread().interrupt()` + clears the restart lock + returns early on `InterruptedException`. Previously the catch (Throwable t) swallowed the interrupt flag, risking engine process leaks on shutdown. No privacy impact — internal concurrency hardening.
- **`build.gradle` CMake workaround**: `externalNativeBuild` blocks temporarily commented out due to AGP 8.7.3 + CMake 3.22.1 re-run loop bug ("manifest 'build.ninja' still dirty after 100 tries"). `libengine_bridge.so` pre-built with the same NDK r27c clang++ + flags and placed in `jniLibs/`. No source code (CMakeLists.txt, engine_jni.cpp) changes. No privacy impact — build-time workaround only.
- **First-principles code review**: Audited all 11 `Thread.sleep` / `Thread.join` locations in `StockfishNative.java` (all now consistent), all 93 `@JavascriptInterface`-annotated methods (all properly annotated), `MainActivity.java` WebView setup (fully aligned with PDF best practices: `setAllowFileAccess(false)`, `MIXED_CONTENT_NEVER_ALLOW`, Safe Browsing, full `onDestroy` cleanup), 27 empty catch blocks in JS modules (all narrow defensive catches with intent-documenting comments). No additional changes needed — codebase already polished through v1.2.1's 11 rounds + v1.2.2's 8 rounds + v1.2.3's prior optimization pass.

Version: `versionCode=123`, `versionName="1.2.3"` (unchanged — bug-fix round, no version bump).

## v1.2.1 round-7 refinement (2026.7.13)

The seventh-pass refinement is a code-quality and security-hardening pass. **No new permissions, no new data collection, no new network access, no changes to data flow or storage.** All changes are internal to the app and have zero privacy impact:

- **PGN export semantics change**: Reverting the Phase 62 `imported`-flag filter in `_buildPGNString()` does NOT change what data is collected or stored — it only changes which annotations are included when the user explicitly chooses "Yes, include special annotations" in the export dialog. The user's existing annotation cache is unaffected; only the export output includes more annotations when the user opts in.
- **`secureRandomInt()` fail-safe**: When the `crypto` API is unavailable (theoretical scenario — Android WebView has supported Web Crypto API since 2015), the function now returns `0` instead of falling back to `Math.random()`. This is a security improvement (no predictable PRNG for Chess960 SP-ID selection) with no privacy impact.
- **`postJsCallback` structured API**: The new `postJsCallback(String eventName, Object... args)` overload is an internal Java-to-JS bridge helper. It does not access, store, or transmit any new data. Existing call sites are unchanged.
- **ELO range unification**: `setConfigElo()` JS-side clamp changed from 500-3200 to 500-3500 to match the Java side. This fixes a data-consistency bug where imported ELO values 3201-3500 were accepted by Java but not representable in the UI. No new data is collected; the change only ensures the UI can display all values Java accepts.
- **`onBestMove` terminal-position probe**: When the engine returns `(none)` (no legal move), the app now checks `gameStatus()` and applies game-over immediately for terminal positions. This is a reliability fix (prevents up to 18-minute hang) with no privacy impact.
- **`_deepClone` depth guard**: Defensive programming to prevent stack overflow on pathological inputs. No privacy impact.
- **`proguard-rules.pro` creation**: Build infrastructure file. The Log.v/Log.d stripping rule actually *improves* privacy by removing verbose/diagnostic logging from release builds (only w/i/e levels are retained for crash diagnostics).

Version: `versionCode=121`, `versionName="1.2.1"` (unchanged).



## v1.2.1 round-8 refinement (2026.7.13)

The eighth-pass refinement fixes a critical white-screen bug in `state-store.js`. **No new permissions, no new data collection, no new network access, no changes to data flow or storage.** All changes are internal to the app and have zero privacy impact:

- **TDZ (Temporal Dead Zone) bug fix**: The round-7 `_deepClone()` hardening added a `const DEEP_CLONE_MAX_DEPTH = 64;` declaration at a position in the IIFE that came AFTER the IIFE-top initialization call `let _state = _deepClone(_initialState);`. Because `const` declarations do NOT hoist (they are in TDZ until their declaration line executes), the function body's reference to `DEEP_CLONE_MAX_DEPTH` triggered `ReferenceError: Cannot access 'DEEP_CLONE_MAX_DEPTH' before initialization`, crashing the state-store module initialization, cascading to all dependent modules (ui.js, ai-bridge.js, etc.), and leaving the WebView showing only the background color. The fix moves the `const` declaration to IIFE-top, BEFORE the initialization call. This is purely a code-organization fix with no privacy impact.
- **`build.gradle` alignment**: Two latent build-config mismatches were corrected so the round-8 APK can be assembled cleanly on a fresh environment:
  - Pinned `ndkVersion "27.2.12479018"` (AGP's default 27.0.12077973 was incomplete on fresh install).
  - Set `useLegacyPackaging true` in `packagingOptions.jniLibs` to match `android:extractNativeLibs="true"` in `AndroidManifest.xml`. This keeps `.so` files uncompressed in the APK so the system can memory-map them at install time — no behavioral or privacy impact (the .so is the same Stockfish 18 arm64-v8a-dotprod binary, just stored differently inside the APK).
- **No new logging, no new telemetry, no new file I/O.**

Version: `versionCode=121`, `versionName="1.2.1"` (unchanged).


## v1.2.1 round-9 refinement (2026.7.13)

The ninth-pass refinement is a code-quality and hardening pass based on a first-principles code review of all source files (~32K lines), guided by three uploaded PDFs (AI code-gen defect prevention, Android WebView dev, SonarCloud pass guide). **No new permissions, no new data collection, no new network access, no changes to data flow or storage.** All changes are internal to the app and have zero privacy impact:

- **AndroidManifest FGS subtype property**: Added `<property android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE" android:value="chess_engine_analysis" />` to EngineService. This is a required declaration for `FOREGROUND_SERVICE_TYPE_SPECIAL_USE` on Android 14+ — it identifies the foreground service subtype to the system. No privacy impact (the value is a static string embedded in the manifest; not user data).
- **StockfishNative lock fix + cleanupEngineResources state reset**: Internal concurrency hardening. No privacy impact.
- **ai-bridge.js _attachDivergentPV return check**: Correctness fix for PGN variation SAN. No privacy impact.
- **Cross-module export-list corrections** (5 JS files): No runtime impact (bundled mode strips the export line). No privacy impact.
- **state-store.js reset deep-clone + dialog payload guard**: Internal state-management hardening. No privacy impact.
- **chess960.js null guards**: Defensive programming. No privacy impact.
- **pgn-standard.js escaped-quote regex**: PGN parsing correctness. No privacy impact.
- **ai-bridge.js + eco-data.js error logging**: Empty `catch(e){}` blocks now log via `console.warn`. Logs are local-only (Android logcat, not transmitted). No new data collection — the errors were previously silently swallowed; now they're visible for debugging.
- **game-logic.js malformed key guard**: Internal validation. No privacy impact.
- **StatsActivity + SafPickerHelper openOutputStream null check**: Error-message clarity improvement. No privacy impact.
- **EngineProcessManager ChmodProvider slim**: Dead interface method removal. No privacy impact.
- **build.gradle FileInputStream leak fix**: Resource leak fix in build script. No runtime/privacy impact.
- **index.html.tpl CSP hardening**: Added `form-action 'none'` and `object-src 'none'` to CSP. Both fall back to `default-src 'none'` (behavior unchanged), but explicit declarations are defense-in-depth. The WebView dev guide PDF emphasized CSP hardening as a core security practice.
- **index.html.tpl + tablebase.js + ui.js redundancy cleanup**: Stale comment fixes, dead code removal. No privacy impact.

Version: `versionCode=121`, `versionName="1.2.1"` (unchanged).


## v1.2.1 round-10 refinement (2026.7.14)

The tenth-pass refinement is a deep fix of the P2/P3 items flagged by round-9's review-D (StockfishNative.java), review-E (16 mid-size Java files), and review-F (build infra + manifest + proguard). 13 priority items implemented. **No new permissions, no new data collection, no new network access, no changes to data flow or storage.** All changes are internal to the app and have zero privacy impact:

- **StockfishNative.java concurrency hardening** (`_restartInProgress` lock consistency, `recoverEngine` shutdown-requested checks, `_discardingPonderBestmove` lock unification): Internal threading hardening. No privacy impact.
- **URL scheme case-insensitivity** (3 sites: `StockfishNative.openUrlInBrowser`, `StatsActivity.openUrlInBrowser`, `ChessWebViewClient.shouldOverrideUrlLoading`): The check now accepts `"HTTP://..."` (case-insensitive scheme per RFC 3986 §3.1). No privacy impact — the same set of URLs is accepted/rejected, just case-insensitively.
- **StatsActivity `statsPayload` volatile + `onPause`/`onResume`**: Internal threading fix + battery optimization (backgrounded stats page now pauses JS timers). No privacy impact.
- **EngineConfigHelper `detectBigCoreCount` failure-cache fix + mid-search comments**: Internal retry logic. No privacy impact.
- **StabilizationHelper `applyTransform` hot-path optimization**: Performance fix. No privacy impact.
- **TlsSecurityHelper `validatePin` constant-time comparison**: Pin comparison now uses `MessageDigest.isEqual` instead of `String.equals`. The pins are public Let's Encrypt values (not user data). No privacy impact — purely a defensive coding practice.
- **HapticHelper.java removed entirely**: Dead-code purge. The class was instantiated but never invoked. No behavior change. No privacy impact.
- **StockfishNative.java P3 cleanup** (magic numbers extracted, `escapeJsString` dead-code simplified, `isProcessAlive` `SDK_INT` pre-check, `_pendingChess960` field relocated, `if(ctx==null)` dead code removed, "remove JNI bridge" comment rewritten): Readability + minor performance. No privacy impact.
- **build.gradle cleanup** (pickFirsts removed libfoundation.so, lint disable list dedup with lint.xml): Build config cleanup. No runtime/privacy impact.
- **AndroidManifest.xml**: Removed `android:requestLegacyExternalStorage="true"`. This attribute was already ignored (targetSdk=35 ≥ 30) and the app uses SAF for all file I/O. No behavior change, no privacy impact.
- **proguard-rules.pro**: Comment rewrite for clarity. No rule changes. No privacy impact.

Version: `versionCode=121`, `versionName="1.2.1"` (unchanged).


## v1.2.1 round-10 continuation (2026.7.14)

This pass addresses the remaining review-E items not in the initial round-10 priority list. 4 secondary items implemented. **No new permissions, no new data collection, no new network access, no changes to data flow or storage.** All changes are internal to the app and have zero privacy impact:

- **FileIoHelper naming fix** (`ensureReadExternalStoragePermission` → `requestReadExternalStoragePermission`): Pure rename for accuracy. The method's behavior (asynchronously request the READ_EXTERNAL_STORAGE permission dialog) is unchanged. No privacy impact.
- **PermissionHelper request-code migration** (1001/1003 → 3001/3002): The numeric codes passed to `Activity.requestPermissions` are changed to a disjoint 3000-range so they no longer overlap with `SafPickerHelper`'s `startActivityForResult` codes (1001-1004). The codes are never transmitted off-device; they are internal dispatch identifiers. No privacy impact.
- **ChessApp / MainActivity / StockfishNative version-string unification**: Three hardcoded `"v1.2.1"` literals replaced with `BuildConfig.VERSION_NAME` (auto-generated by AGP from `build.gradle`'s `versionName`). The version string was already visible in logs and the title display; this change just makes it auto-sync with `build.gradle`. No privacy impact — the version number is not sensitive data.
- **EngineService `isRunning` timing fix**: Moved `isRunning = true` to after `startForeground()` succeeds. Pure internal state-management improvement; no user-visible behavior change. No privacy impact.
- **ChessWebViewClient doc-comment update**: Documentation-only change. No privacy impact.

Version: `versionCode=121`, `versionName="1.2.1"` (unchanged).


## v1.2.1 round-10 regression test + first-principles optimization (2026.7.14)

This pass performs a regression test of all review-D/E/F fixes from the initial round-10 and its continuation, then applies first-principles optimization to eliminate residual magic numbers, redundant operations, and misleading comments discovered during the regression audit. **No new permissions, no new data collection, no new network access, no changes to data flow or storage.** All changes are internal to the app and have zero privacy impact:

- **Regression test**: All review-D/E/F fixes verified intact — `_restartInProgress` lock consistency (14 writes), `recoverEngine` shutdown checks, `_discardingPonderBestmove` lock unification (8 writes), URL scheme case-insensitivity (3 sites), HapticHelper removal, StatsActivity volatile + lifecycle, EngineConfigHelper retry, StabilizationHelper hot-path, TlsSecurityHelper constant-time, FileIoHelper rename, PermissionHelper 3000-range codes, BuildConfig.VERSION_NAME unification, EngineService isRunning timing, build.gradle cleanup, AndroidManifest cleanup, proguard-rules comment fixes. No privacy impact — purely a verification pass.
- **StockfishNative.java `PROCESS_DESTROY_GRACE_MS` extraction**: 2 remaining `Thread.sleep(100)` calls in process-destroy paths extracted to a named constant (semantically distinct from `PONDER_STOP_GRACE_MS`). No privacy impact.
- **StatsActivity.java redundant `Uri.parse` removal**: The second `Uri.parse` call in `openUrlInBrowser` was removed (the first parse is now reused for the Intent). No privacy impact — same URL validation, just no double-parse.
- **StabilizationHelper.java comment direction fix**: Corrected a comment that said "below" when referring to `start()` which is actually above `applyTransform()` in source order. No privacy impact.
- **proguard-rules.pro section-3 comment fix**: Rewrote the section-3 comment (same direction-inversion bug as the round-10 section-6 fix). No privacy impact.

Version: `versionCode=121`, `versionName="1.2.1"` (unchanged).

## v1.2.1 round-11 (2026.7.14) — 2 user-reported bugs + review-report defects + first-principles optimization

This pass fixes 2 user-reported bugs in the review-mode eval chart and stats page, plus the remaining non-false-positive defects from the round-2 review-report collection, plus a first-principles optimization pass on the changed files. **No new permissions, no new data collection, no new network access, no changes to data flow or storage.** All changes are internal to the app and have zero privacy impact:

- **Bug #1 fix (review eval chart refresh, `ai-bridge.js`)**: Added a `_refreshEvalTrendChart()` call after the eval cache is updated in `onEngineEval`'s non-stale path. Previously the chart only refreshed on the stale-callback path; the common case "user stays on the analyzed step" left the chart missing the point until the next full render. No privacy impact — purely a UI refresh timing fix.
- **Bug #2 fix (stats page data completeness, `ai-bridge.js` + `ui.js`)**: `openStatsPage` now triggers `reviewAnalyzeAll()` if any review step is uncached, deferring the stats page opening until the batch completes. This ensures the stats page always receives a complete `evals` array. `exitReview` clears the pending-stats flag. No privacy impact — the stats page already had access to the full PGN and move records; only the eval cache completeness changed.
- **`game-logic.js` `pieceCountLE7` typeof guard restored**: Defensive guard against `tablebase.js` load failure. No privacy impact — only affects whether the tablebase probe runs.
- **`ai-bridge.js` `onBestMove` isAIThinking reset on validation failure**: Resets the AI-thinking flag when bestmove parsing fails, preventing a soft-lock. No privacy impact.
- **`ai-bridge.js` `_visualAnnotationsCache` iteration safety**: Switched from `for...of` to `forEach` with a plain-object fallback. No privacy impact — the visual annotations are locally-generated UI aids, not user data.
- **`FileIoHelper.java` `getDefaultPaths` deprecated API fix**: On API 29+, returns `context.getExternalFilesDir(null)` (app-private external storage, always accessible) for the `externalStorage` key instead of the deprecated `Environment.getExternalStorageDirectory()` (which points to inaccessible paths on Android 11+). No privacy impact — these paths are only starting points for the SAF file picker; actual file I/O always uses SAF content URIs.
- **`state-store.js` `_deepClone` nosemgrep comment + Map/Set support**: Added a `// nosemgrep` comment with justification for the `new RegExp(obj.source, obj.flags)` line, plus Map/Set deep-clone branches. No privacy impact — the state store only holds in-memory UI state, never user PII.
- **First-principles optimization**: Race-condition guard for concurrent batch, double-click guard for 📊 button, `exitReview` pending-stats clear, 10-minute safety timeout on the pending-stats flag (prevents permanent lockout if the engine hangs). No privacy impact — purely internal state-management improvements.

Version: `versionCode=121`, `versionName="1.2.1"` (unchanged — same-version refinement).

## v1.2.1 round-12 (2026.7.14) — SonarCloud PR #43 bugs + code smells cleanup

This pass fixes the 3 SonarCloud Bugs reported on PR #43 (2 real S3923 "if/else identical" issues + 1 S2757 false-positive refactor) and applies the P0/P1/P2 code-smells cleanup from the `Regalia_v1.2.1_CodeSmells_修复指南.md` guide. **No new permissions, no new data collection, no new network access, no changes to data flow or storage.** All changes are internal to the app and have zero privacy impact:

- **S3923 if/else identical branches removed (`ui.js`)**: Two `if (_isLandscapeReview) { ... } else { ... }` blocks in `_renderReviewMode` had byte-identical branches (legacy from the v1.1.0 Phase 53 portrait/landscape unification). Removed the conditional, kept one copy. No privacy impact — pure markup-cleanup.
- **S2757 false-positive refactor (`ui.js`)**: Rewrote `_ecoEnabled = !(typeof dlgChess960 !== 'undefined' && dlgChess960)` as `_ecoEnabled = typeof dlgChess960 === 'undefined' || !dlgChess960` (De Morgan's law, identical semantics). No privacy impact — ECO recognition is a local opening-classification lookup, no user data involved.
- **S108 empty catch blocks filled with `console.warn` (~146 sites)**: Empty `catch(e){}` blocks across `ui.js` (93), `ai-bridge.js` (30), `game-logic.js` (19), `tablebase.js` (3), `chess960.js` (1) now log a module-tagged warning. No privacy impact — `console.warn` writes to the WebView JavaScript console (visible only via `adb logcat` or Chrome DevTools); it does NOT transmit any data over the network, does NOT write to persistent storage, and does NOT include user PII (only `e.message` — typically a generic JS error string like "Cannot read property 'x' of undefined"). The catches using `catch(_){}` / `catch(_e){}` (intentionally-unused parameter — a SonarCloud-recognized idiom) were preserved. Catches inside inline HTML event-handler attributes were skipped because expanding them inline would break attribute quoting.
- **S3358 nested ternary operators refactored (`ui.js`, 2 sites)**: The 4-way nested ternary selecting the game-over icon character + style was extracted into two helper functions `_gameOverIconChar()` / `_gameOverIconStyle()` with explicit `if` branches. The 2-way nested ternary computing the mate-score suffix in `formatEval` was refactored to compute `mateSign` once. No privacy impact — pure readability refactors.
- **S3646 duplicate CSS selectors merged (`index.html.tpl`, 2 sites)**: Merged two adjacent `.dlg:not([style*="max-width"])` rules and two adjacent `.review-left .review-board .bgrid` rules. No privacy impact — pure CSS cleanup.
- **S3523 `parseFloat` → `Number.parseFloat` (7 sites)**: Pure ES2015 namespace form. No privacy impact.
- **S1154 `String.fromCharCode` → `String.fromCodePoint` (18 sites)**: All call sites pass ASCII code points < 128 (chess coordinate labels `a`-`h`, SP-ID letters `A`/`a`); behavior is identical. No privacy impact.

Version: `versionCode=121`, `versionName="1.2.1"` (unchanged — same-version refinement).

## v1.2.1 round-13 (2026.7.14) — S3776 cognitive complexity: renderInternal God Function refactor

This pass addresses the highest-priority S3776 Cognitive Complexity violation deferred from round-12: the `renderInternal` God Function (CC=122, ~347 lines) is split into 4 named helpers (`_buildRenderHTML`, `_saveScrollState`, `_restoreScrollState`, `_postRenderFinalize`), reducing `renderInternal` to a 23-line thin orchestrator. **No new permissions, no new data collection, no new network access, no changes to data flow or storage.** All changes are internal to the app and have zero privacy impact:

- **`renderInternal` God Function refactor (`ui.js`)**: The 347-line function is split into 4 named helpers, each with a single responsibility (HTML building, scroll-state snapshot, scroll-state restore, post-render finalization). Behavior is byte-identical to the pre-refactor version; only the structure changed. No privacy impact — the refactor touches only render orchestration; no data is read, written, or transmitted differently.
- **No new globals**: All 4 helpers are module-scoped functions (not exported). They access the same module-level state as the original inline code. No privacy impact.
- **Error handling preserved**: The `try/catch` wrapper around the entire render remains in `renderInternal`. If any helper throws, the error display UI is shown exactly as before. No privacy impact — error messages are displayed locally, never transmitted.
- **Early return preserved**: The `_renderReviewMode` `done=true` early return (which skips scroll-save/innerHTML/scroll-restore to avoid operating on stale DOM) is preserved. No privacy impact.

Version: `versionCode=121`, `versionName="1.2.1"` (unchanged — same-version refinement).

## v1.2.1 round-14 (2026.7.14) — S3776 _renderDialogs extraction + S2703 typeof audit

This pass completes the remaining S3776 Cognitive Complexity items deferred from round-13 (`_renderDialogs` CC=71 → ~5) plus the S2703 `typeof` audit deferred from round-12 (53 safe conversions). **No new permissions, no new data collection, no new network access, no changes to data flow or storage.** All changes are internal to the app and have zero privacy impact:

- **`_renderDialogs` refactor (`ui.js`)**: The 181-line function (CC=71) is refactored into a 10-line thin dispatcher that delegates to 8 per-dialog helpers (`_renderNewGameDialog`, `_renderChess960Settings`, `_renderClassicOpeningsList`, `_renderResignConfirmDialog`, `_renderAboutDialog`, `_renderImportDialog`, `_renderPromotionDialog`, `_renderSavePGNPromptDialog`). Behavior is byte-identical. No privacy impact — pure structural refactor of render orchestration.
- **S2703 `typeof` audit (53 sites across 4 JS files)**: Converted `typeof <var> === 'undefined'` / `!== 'undefined'` to direct `=== undefined` / `!== undefined` comparison for variables guaranteed to be declared via module-scoped `let`/`var` (`soundOn`, `gameClocks`, `_gameOverStatusKey`, `_reviewEvalCache`, `gameVariant`, `dlgChess960`, and other module-scoped variables). True globals (`crypto`, `AndroidBridge`) correctly preserved with `typeof` to avoid `ReferenceError`. No privacy impact — pure style modernization with identical semantics.

Version: `versionCode=121`, `versionName="1.2.1"` (unchanged — same-version refinement).

## v1.2.3 (2026.7.16) — Round 17/18 review fixes + P0 JS error fix + Toast UX

This version addresses a user-reported P0 JS error, Round 17 (Issue #48) and Round 18 (Issue #49) multi-skill review findings, and Issue #47 Toast UX optimization. **No new permissions, no new data collection, no new network access, no changes to data flow or storage.** All changes are internal to the app and have zero privacy impact:

- **P0 JS error fix (`ui.js`)**: AI difficulty button inline `onclick` refactored into a named global function `setDifficultyLevel(level)`. Previously the inline `onclick` contained `console.warn("[AI] ...")` with double quotes that collided with the HTML attribute delimiter, causing `Uncaught SyntaxError: Unexpected end of input`. No privacy impact — pure UI bug fix; no data transmitted or stored.
- **Round 17 P1 — cloneS Chess960 fields (`game-logic.js`)**: `cloneS()` now copies `chess960` and `spid` fields. No privacy impact — pure correctness fix for Chess960 state cloning.
- **Round 17 P1 — sendSetOptionAndWait Pattern caching (`StockfishNative.java`)**: Pre-compiled `NEWLINE_PATTERN` + `stripNewlines()` helper. No privacy impact — performance optimization only.
- **Round 17 P1 — saveEvalCacheSync .tmp leak (`StockfishNative.java`)**: `finally` block guarantees `.tmp` cleanup. The eval cache is a local-only file in `context.getFilesDir()` containing engine evaluation data (no PII). The fix prevents stale `.tmp` file accumulation; no data leaves the device.
- **Round 17 P1 — C++ standard mismatch (`CMakeLists.txt`)**: `cxx_std_17` → `cxx_std_20` to match `build.gradle`. No privacy impact — build config alignment.
- **Round 18 i18n P1 — aria-label, game-over detection, html lang (`ui.js`, `game-logic.js`)**: Three i18n fixes for accessibility and language consistency. No privacy impact — UI text/accessibility only.
- **Round 18 P1 — analyze-all setoption redundancy (`StockfishNative.java`, `ui.js`)**: Added `engineEvalDeepBeginBatch()` / `engineEvalDeepEndBatch()` Java methods to skip redundant UCI setoption calls during batch analysis. No privacy impact — performance optimization; engine communication is local-only.
- **Issue #47 Toast UX (`ai-bridge.js`, `ui.js`, `game-logic.js`)**: Path 3 staged intent+progress toasts; Path 4 completion toast before deferred stats open. New i18n key `analysis_complete_opening_stats`. No privacy impact — Toast text is rendered locally.
- **Round 17 P2 — StabilizationHelper, engine_jni.cpp errno, stopAndWaitForBestmove health**: Three robustness fixes. No privacy impact — internal diagnostics and recovery.
- **False positives excluded**: Round 17 P1-4 (EngineConfigManager — already deleted), P1-5 (StatsActivity JS Bridge — onDestroy already cleans up), P2-1 (UciProtocolHandler — already deleted), P2-2 (RootDetector deprecated API — informational only). Round 18 i18n-P2-1 (`placeholder="0-959"` — numeric), A-P1-1/2/3/4 (God Class refactors — deferred).

Version: `versionCode=123`, `versionName="1.2.3"` (version bump from v1.2.2).

## v1.2.3 optimization pass (2026.7.16) — first-principles line-by-line review

A line-by-line first-principles review of every source file was performed after the Round 17/18 fix pass. **No versionCode bump.** **No new permissions, no new data collection, no new network access, no changes to data flow or storage.** All changes are internal code-quality, documentation-accuracy, and redundancy-cleanup improvements with zero privacy impact:

- **Stale API version comments corrected** (`StockfishNative.java`, `ChessWebViewClient.java`, `network_security_config.xml`): "API 21" references updated to "API 23" to match the actual `minSdk 23`. Documentation-only; no code behavior change. No privacy impact.
- **Version string comments updated** (`MainActivity.java`, `ChessWebViewClient.java`): Example version references updated from "v1.2.1"/"v1.2.2" to "v1.2.3". No privacy impact — comments only.
- **`EngineConfigHelper.setGameDifficulty` callback**: Converted raw string-concatenation `postJsCallback` to the structured `postJsCallback(eventName, args...)` overload. No privacy impact — the callback only passes a boolean and an int (limitElo, elo) to JS; no PII, no network, no storage.
- **`StatsActivity` JS bridge comment**: Added a clarifying comment documenting why the anonymous JS bridge is safe (onDestroy cleanup + Java GC). No privacy impact — comment only.
- **`gradle.properties`**: Removed redundant `android.enableR8.fullMode=true` (default in AGP 8.x). No privacy impact — build config only.
- **HTML manuals renamed + wireframe version badge fixed**: `Regalia-v1.2.2-manual-{zh,en}.html` → `Regalia-v1.2.3-manual-{zh,en}.html`; header-bar wireframe badge updated from `v1.0.7` to `v1.2.3` to match the actual app rendering. No privacy impact — documentation only.
- **README.md directory tree accuracy fixes**: `strings.xml` comment "v1.2.1" → "v1.2.3"; `build.gradle` comment "versionCode=121" → "versionCode=123"; manual filename references updated. No privacy impact — documentation only.

Version: `versionCode=123`, `versionName="1.2.3"` (unchanged — optimization pass, no version bump).

## v1.2.2 (2026.7.14) — Comprehensive audit-report non-false-positive fix + version bump

This version is based on the uploaded comprehensive audit-report collection (`Regalia_v1.2.1_全技能审查报告.zip`). After rigorous code-level verification, 7 of the audit's findings were confirmed as false positives (based on stale code from deleted files or already-fixed issues), and 1 real defect was fixed. **No new permissions, no new data collection, no new network access, no changes to data flow or storage.** All changes are internal to the app and have zero privacy impact:

- **FEN parsing length limit (`tablebase.js`)**: `fenToState()` now rejects FEN strings longer than 200 characters (standard FEN ≤87 chars). This is a DoS-prevention hardening measure — a pathologically long FEN string could previously cause unnecessary string processing before validation rejected it. No privacy impact — FEN strings are chess position notation with no PII; the length limit simply fails faster on invalid input.
- **Version bump (v1.2.1→v1.2.2)**: 11 version-number locations updated (version.properties, build.gradle, strings.xml, ChessWebViewClient.java, game-logic.js, index.html.tpl, ui.js 3 places, HTML manuals). No privacy impact — version numbers are public information.
- **Audit-report false positives confirmed (no action taken)**: RED-1 (getStatsPayload XSS — stats.html already escapes via `_escFEN`), RED-2 (javascript: protocol — already blocked), RED-3 (i18n XSS — static strings + double escaping), YELLOW-2 (sendToEngine — already has UCI whitelist), YELLOW-3 (allowBackup — already false), YELLOW-5 (ProGuard — MessageBus deleted), P0 #4-5 (empty catches — round-16 fixed), P1 #12 (HapticHelper — round-10 deleted).

Version: `versionCode=122`, `versionName="1.2.2"` (version bump from v1.2.1).

## v1.2.1 round-16 (2026.7.14) — User-reported UX clarity + audit-report non-false-positive defect fixes

This round addresses two user-reported UX-clarity issues plus 3 non-false-positive defects from the uploaded audit report. **No new permissions, no new data collection, no new network access, no changes to data flow or storage.** All changes are internal to the app and have zero privacy impact:

- **📊 Toast clarity in review mode (`ai-bridge.js`, `game-logic.js`)**: When the user clicks 📊 in review mode and a background analysis batch is needed, the Toast now appends "分析完成后将进入统计页面 / Statistics will open after analysis completes" so the user knows to wait. Two new i18n keys (`stats_will_open_after_analysis`, `analysis_timed_out_retry`) added to `game-logic.js`. No privacy impact — Toast text is rendered locally; no data is transmitted or stored.
- **Visual annotation wording fix (`stats.html`)**: The description for green arrows (应将路径) was reordered from "王避将或吃将军棋子" to "吃将军棋子或王避将" to eliminate a parsing ambiguity. Documentation-only change. No privacy impact.
- **Empty `catch(e){}` blocks filled (`game-logic.js`, `ui.js`)**: The `_ecoRestoreFocus` catch and the inline `AndroidBridge.syncGameDifficulty` catch now log `console.warn(...)`. No privacy impact — `console.warn` writes to the WebView JavaScript console (visible only via `adb logcat` or Chrome DevTools); it does NOT transmit any data over the network, does NOT write to persistent storage, and does NOT include user PII.
- **Chess960 SPID `Math.random()` fallback removed (`ui.js`)**: The unreachable `typeof secureRandomInt==='function'?...:Math.floor(Math.random()*960)` is simplified to `secureRandomInt(960)`. `secureRandomInt` uses `crypto.getRandomValues()` (already used elsewhere) — this change actually *improves* the cryptographic strength of the SPID generation by removing the insecure fallback. No privacy impact.
- **SECURITY-AUDIT comments added (`ui.js`)**: Two comments added above `_createImpulse()` and `_getNoise()` explaining that `Math.random()` is intentionally used for audio noise synthesis. No privacy impact — comments only.

Version: `versionCode=121`, `versionName="1.2.1"` (unchanged — same-version refinement).

## v1.2.1 round-15 (2026.7.14) — Final perfection: S3776 _renderReviewMode partial extraction + stats.html S108 + comprehensive PDF-guided audit

This is the **final perfection round** — a comprehensive, first-principles audit of every source file guided by the three uploaded PDFs (AI Code Generation Defect Prevention Guide, Android WebView Development Guide, SonarCloud Perfect Review Guide). **No new permissions, no new data collection, no new network access, no changes to data flow or storage.** All changes are internal to the app and have zero privacy impact:

- **`_renderReviewMode` partial extraction (`ui.js`)**: Extracted 3 self-contained helpers (`_buildRvFileLabels`, `_buildRvRankLabels`, `_prepareRvVisualAnnotations`) from the 612-line function, reducing it to 561 lines. Byte-identical behavior. No privacy impact — pure structural refactor of review-board rendering.
- **stats.html S108 empty catch blocks (6 sites)**: Added `console.warn('[Stats]', e.message)` to 6 empty `catch(e){}` blocks in `stats.html`. No privacy impact — `console.warn` writes to the WebView JavaScript console (visible only via `adb logcat` or Chrome DevTools); it does NOT transmit any data over the network, does NOT write to persistent storage, and does NOT include user PII.
- **PDF-guided audit verified**: WebView security settings (`setAllowFileAccess(false)`, `setAllowFileAccessFromFileURLs(false)`, `setAllowUniversalAccessFromFileURLs(false)`) confirmed correct. `@JavascriptInterface` annotation on all exposed methods. `onDestroy` cleanup complete. Debug mode never enabled (system default = disabled). TLS pinning implemented. No hardcoded secrets. PGN/FEN input escaped for XSS prevention. No privacy impact — all findings confirm existing security posture is correct.

Version: `versionCode=121`, `versionName="1.2.1"` (unchanged — same-version refinement).

## Contact

For questions about this privacy policy, please open an issue on the GitHub repository.

---
*AI-GEN*
