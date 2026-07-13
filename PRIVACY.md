<!--
  Privacy Policy — Regalia
  Copyright (C) 2026 Regalia
  Licensed under GNU Affero General Public License v3 (AGPL v3)

  AI-GEN: AI assisted
  This document was AI-assisted and has been reviewed for AGPL v3 compliance.
-->
# Privacy Policy — Regalia

Regalia is a fully offline chess application. This policy applies to the Regalia Android application (current version: **v1.2.1**, versionCode 121).

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

## Contact

For questions about this privacy policy, please open an issue on the GitHub repository.

---
*AI-GEN*
