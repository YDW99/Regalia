<!--
  Privacy Policy — Regalia
  Copyright (C) 2026 Regalia
  Licensed under GNU Affero General Public License v3 (AGPL v3)

  AI-GEN: AI assisted
  This document was AI-assisted and has been reviewed for AGPL v3 compliance.
-->
# Privacy Policy — Regalia

Regalia is a fully offline chess application. This policy applies to the Regalia Android application (current version: **v1.2.0**, versionCode 120).

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

### v1.2.0 Phase 82+++++ (rev 9): Stats page visual annotation fix

The v1.2.0 Phase 82+++++ rev 9 change (2026.7.12) fixes a bug where the statistics page was not displaying visual annotation ([%csl]/[%cal]) data for live games. This is a pure bug-fix change — **no new permissions, no new network access, no new data collection, no changes to how data is stored or transmitted**.

Fix: `_buildPGNString()` now accepts an optional third parameter `includeAutoAnnotations` (default false). When true, auto-generated visual annotations are included in the PGN text. `openStatsPage()` passes true so the stats page receives live-game annotations. PGN export/save flows are unchanged (default false preserves Phase 62 behavior).

Version: `versionCode=120`, `versionName="1.2.0"` (unchanged — same version, deeper refactor).

### v1.2.0 Phase 82+++++ (rev 8): MessageBus reflection fix + proguard rules + sandbox hardening

The v1.2.0 Phase 82+++++ rev 8 change (2026.7.12) fixes a critical release-build bug in MessageBus, creates missing proguard rules, and hardens the sandbox path check. This is a pure bug-fix + hardening change — **no new permissions, no new network access, no new data collection, no changes to how data is stored or transmitted**.

Fixes:
1. **MessageBus.emit broken in release**: R8 (minifyEnabled=true) renamed the private `webView` field, causing reflection to fail. Replaced with a public setter.
2. **proguard-rules.pro created**: Was referenced by build.gradle but missing. Now includes keep rules for MessageBus, @JavascriptInterface methods, and native methods.
3. **onDestroy cleanup**: Added `removeJavascriptInterface("MessageBus")` for symmetry.
4. **Sandbox path check**: Tightened `isPathInSandbox()` to require path separator after sandbox root (prevents `/files_evil` false positive).

Version: `versionCode=120`, `versionName="1.2.0"` (unchanged — same version, deeper refactor).

### v1.2.0 Phase 82+++++ (rev 7): MessageBus + Store wiring — Task 75 design intent

The v1.2.0 Phase 82+++++ rev 7 change (2026.7.12) wires the MessageBus (Java) and Store (JS) into production, correctly implementing the Task 75 design intent from the v1.2.0 Development Plan. This is a pure enhancement change — **no new permissions, no new network access, no new data collection, no changes to how data is stored or transmitted**.

The MessageBus is registered as a separate `@JavascriptInterface` named "MessageBus" (alongside the existing "AndroidBridge"). It provides a parallel communication channel — all existing `AndroidBridge` methods and `postJsCallback` calls remain unchanged. The MessageBus can be used for future migration to a unified communication pattern but does not affect current behavior.

Version: `versionCode=120`, `versionName="1.2.0"` (unchanged — same version, deeper refactor).

### v1.2.0 Phase 82+++++ (rev 6): Visual annotation placeholder offset fix + design intent verification

The v1.2.0 Phase 82+++++ rev 6 change (2026.7.12) fixes a visual annotation placeholder offset bug and verifies the complete visual annotation lifecycle against the v1.2.0 Development Plan. This is a pure bug-fix + verification change — **no new permissions, no new network access, no new data collection, no changes to how data is stored or transmitted**.

Fix: The review mode visual annotation read path was not applying the placeholder offset when a black-to-move placeholder exists at `moveRecords[0]`. This caused imported annotations to be read from the wrong move index, appearing on the wrong review step. Fixed by applying the same placeholder offset used in `importPGN`.

Version: `versionCode=120`, `versionName="1.2.0"` (unchanged — same version, deeper refactor).

### v1.2.0 Phase 82+++++ (rev 5): Dead module wiring + Web Worker verification + cache cleanup verification

The v1.2.0 Phase 82+++++ rev 5 change (2026.7.12) wires the previously-dead `Store` module (state-store.js) as a debug observability layer, verifies the Web Worker implementation, and confirms all 5 new-game entry points correctly clear caches. This is a pure enhancement/verification change — **no new permissions, no new network access, no new data collection, no changes to how data is stored or transmitted**.

The `Store` dispatch calls are purely additive — the global variables remain the source of truth, and `Store` is a read-only mirror for debugging. All dispatch calls are wrapped in try/catch with typeof guards, so they cannot break production even if `Store` is unavailable.

Version: `versionCode=120`, `versionName="1.2.0"` (unchanged — same version, deeper refactor).

### v1.2.0 Phase 82+++++ (rev 4): Portrait review-top fix + documentation fixes

The v1.2.0 Phase 82+++++ rev 4 change (2026.7.12) fixes a pre-existing portrait review-mode layout bug and several documentation issues. This is a pure bug-fix + documentation change — **no new permissions, no new network access, no new data collection, no changes to how data is stored or transmitted**.

Fix: The portrait review-mode branch was missing a `<div class="review-top">` open tag, causing the closing `</div>` to auto-close `.review-body` instead. This made `.review-bottom` a sibling of `.review-body` (not a child), so the CSS rule `.review-body > .review-bottom` did not apply in portrait mode. Fixed by adding the missing open tag, matching the landscape branch.

Version: `versionCode=120`, `versionName="1.2.0"` (unchanged — same version, deeper refactor).

### v1.2.0 Phase 82+++++ (rev 3): Layout fix verified + APK rebuild

The v1.2.0 Phase 82+++++ rev 3 change (2026.7.12) verifies the layout fix against the v1.1.2 source and rebuilds the APK. This is a pure verification/rebuild change — **no new permissions, no new network access, no new data collection, no changes to how data is stored or transmitted**. The v1.2.0 source was confirmed to produce byte-for-byte identical HTML to v1.1.2 for all layout scenarios.

Version: `versionCode=120`, `versionName="1.2.0"` (unchanged — same version, deeper refactor).

### v1.2.0 Phase 82+++++ (rev 2): Layout regression fix + bug fixes

The v1.2.0 Phase 82+++++ rev 2 change (2026.7.12) fixes a main interface layout regression and 3 bugs found during comprehensive code review. This is a pure bug-fix change — **no new permissions, no new network access, no new data collection, no changes to how data is stored or transmitted**.

Fixes:
1. **Main interface layout regression**: The Phase 82++++ layout "fix" introduced an extra `</div>` (closing `#app` prematurely) and a missing `</div></div>` (leaving board wrapper unclosed). Both fixed — the HTML structure now matches the v1.1.2 layout exactly.
2. **Tablebase retry false AI timeout**: `game-logic.js` — tablebase API failures no longer count toward the AI timeout retry counter, preventing false "AI timeout" toasts.
3. **Inverted WDL on checkmate**: `ai-bridge.js` — WDL (Win/Draw/Loss) values for checkmate positions are now correctly oriented (White-perspective), fixing the eval bar display.
4. **typeof guard for pieceCountLE7**: `game-logic.js` — added defensive `typeof` guard for cross-module function call consistency.

Version: `versionCode=120`, `versionName="1.2.0"` (unchanged — same version, deeper refactor).

### v1.2.0 Phase 82+++++: WebView cache fix + code review

The v1.2.0 Phase 82+++++ change (2026.7.12) adds `webView.clearCache(true)` to `MainActivity.onCreate()` before loading `chess.html`. This ensures the WebView always loads the latest `chess.html` from the APK, fixing a issue where some WebView implementations (especially on Xiaomi HyperOS) would serve a stale cached `chess.html` after an app update, causing the user to see bugs that were already fixed. This is a pure bug-fix change — **no new permissions, no new network access, no new data collection, no changes to how data is stored or transmitted**. The cache clear only affects the WebView's internal content cache (RAM + disk), not any user data.

Version: `versionCode=120`, `versionName="1.2.0"` (unchanged — same version, deeper refactor).

### v1.2.0 Phase 82++++: renderInternal final extraction + review-mode entry fix + layout fix

The v1.2.0 Phase 82++++ change (2026.7.12) extracts 3 more rendering blocks from `renderInternal()` into dedicated functions: `_computeRenderState()`, `_renderGameOverOverlay(h)`, and `_applyRenderResult(app, h, reviewMode)`. `renderInternal()` was further reduced from 359 to 70 lines (cumulative: 1,365 → 70 lines, −95%). This is a pure code-organization + bug-fix change — **no new permissions, no new network access, no new data collection, no changes to how data is stored or transmitted**.

Two critical bugs were fixed in this phase:

1. **Review-mode entry bug (root cause)**: The Phase 82++ extraction moved `const flip=playerColor==='black'` into `_renderHeader()` (local scope), but `_renderReviewMode(h)` referenced `flip` 9 times as a free variable. When the user clicked a move record (`.mw`/`.mb` span) to enter review mode, `_renderReviewMode(h)` threw `ReferenceError: flip is not defined`, caught by `renderInternal`'s try-catch, displaying "Render Error" instead of the review overlay. Fixed by extracting `_computeRenderState()` to compute `flip` (and `cm`, `infoSq`, `infoCtrl`, `oppC`) at the `renderInternal` scope, and passing these values explicitly to all sub-functions (including `_renderReviewMode(h, flip)`). The same scoping bug also silently broke `_renderAIBar(h, oppC)`, `_renderBoardGrid(h, flip, cm)`, and `_renderSidePanel(h, infoSq, infoCtrl, oppC)` — all previously received `undefined` for these parameters, causing: board never flipped for black player, control-map coloring missing, AI captured-pieces display degraded, side-panel control-info card silently skipped. All fixed.

2. **Layout fix (.bsec structure)**: The Phase 82+++/82+++ extraction accidentally moved info bars (`_renderInfoBars`) and player bar (`_renderPlayerBar`) rendering after the `</div></div>` close of `.bsec`+`.main`, placing them outside the `.bsec` vertical-flex container. Fixed by moving both calls before the `</div>` close of `.bsec`, restoring the intended board-column layout.

All extracted functions use global state only (with `app`, `h`, `reviewMode`, `flip` passed as parameters where needed); the `h` string concatenation pattern is preserved. The `_applyRenderResult` function handles scroll-position save/restore, DOM rebuild, animation re-attach, and focus restoration — logic unchanged from the original inline code in `renderInternal`.

Version: `versionCode=120`, `versionName="1.2.0"` (unchanged — same version, deeper refactor).

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
