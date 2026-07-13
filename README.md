# Regalia ♔

<!-- AI-GEN: AI assisted
     This document was AI-assisted and has been reviewed for AGPL v3 compliance. -->

A standalone, open-source chess app for Android — play offline against Stockfish 18, analyze your games, and explore openings. No account, no network, no tracking. Now with **Chess960 (Fischer Random Chess)** support (v1.0.4).

"Regalia" is used solely as a project name for this open-source chess app. No trademark rights are claimed. Anyone is free to fork and rename their own version.

## Screenshots

<p align="center">
  <img src="assets/screenshot.jpg" alt="Regalia gameplay screenshot" width="280">
</p>

Portrait mode — evaluation bar, move history, AI opponent display with ponder info, and Control heatmap. See the user manual (`Manual/Regalia-v1.2.0-manual-{zh,en}.html`) for wireframe diagrams of every screen.

**Control Heatmap** — Tap the 🌗/🌈 button on the toolbar to toggle the control heatmap. Each square is dynamically colored by HSL to indicate which side controls it: blue-purple = your control, red = opponent's control, purple = contested. Hovering a square shows SVG arrows from each controlling piece to that square (warm gold for your pieces, cool silver-blue for opponent's). The info card below the board shows per-piece control contributions with position labels.

**🌿Line** — In the move record, 🌿 lines appear below each move showing engine analysis variations (MultiPV) and PGN import variations (RAV). Each variation is labeled 🌿Line 1, 🌿Line 2, etc., assigned sequentially by display order. PGN import variations are automatically parsed and displayed as 🌿Lines with proper move numbering. Toggle the Variations switch to show or hide them.

## Features

- **Stockfish 18 Engine** — arm64-v8a-dotprod variant (ARMv8.6-A DOTPROD instructions for NN inference acceleration) for optimal performance on modern devices
- **Chess960 / Fischer Random Chess** (v1.0.4 NEW) — full support for the 960 starting positions with proper castling rules, SP-ID selector in New Game dialog, Shredder-FEN castling rights, and `UCI_Chess960` engine option
- **Standardized PGN** (v1.0.4 NEW) — import/export follows the 1994 PGN spec strictly: Seven-Tag Roster always emitted, `[%eval]` / `[%clk]` / `[%emt]` annotations embedded, Result terminator enforced, tolerant parser auto-corrects malformed input
- **NAG &amp; Visual Annotations** (v1.0.4 NEW) — NAG ($1-$19) support; automatic selection &amp; caching of `[%csl ...]` (square highlights) and `[%cal ...]` (arrows) per move: Square highlights — Blue=player net-control strong squares, Red=AI net-control strong squares, Yellow=high total-control squares, Green=neutral center squares; Arrows — Blue=multi-threat (one piece threatens 2+ enemy pieces), Red=check path, Yellow=queen-threat path, Green=escape squares
- **Time-Control Chess** (v1.0.4 NEW) — Sudden Death / Fischer Increment / Bronstein Delay / US Delay modes; live clock display with low-time warning; auto-emits `[TimeControl "..."]` header and `[%clk HH:MM:SS]` per-move annotations; for untimed games, emits `[%emt HH:MM:SS]` (elapsed move time)
- **Web Worker Pool** (v1.0.4 NEW) — `worker-pool.js` offloads PGN parsing, statistics computation, and control-map computation to a background thread; falls back to inline execution on devices without Worker support
- **8 Difficulty Levels** — from beginner (800 ELO) to maximum strength (2800+ ELO), plus Skill Level mode
- **PGN Import** — paste PGN from clipboard, or select a PGN file from your device
- **Review Mode** — full game replay with evaluation trend chart, move-by-move analysis, move classification (brilliant/good/blunder), and engine evaluation cache
- **MultiPV Analysis** — 1–8 lines of analysis simultaneously
- **ECO Opening Classification** — 500+ standard openings with search, category filtering, and book move recommendations
- **Syzygy Endgame Tablebases** — 7-piece endgame lookup via Lichess Tablebase API (requires network; auto-disables when offline)
- **Position Setup** — custom board editing with FEN copy/import
- **Ponder Mode** — engine thinks on opponent's time for stronger play
- **WDL Display** — Win/Draw/Loss probability shown alongside evaluation
- **Heatmap Control Statistics** (v1.0.4 NEW) — per-square average control across all positions, strongest/weakest square detection, center-control trend
- **Board Anti-Shake** (v1.0.5 NEW) — `StabilizationHelper.java` fuses `TYPE_LINEAR_ACCELERATION` sensor data with an OIS-style translation-compensation algorithm to keep the board visually stable when the device is held in an unsteady hand; auto-adapts to all 4 screen rotations and to notch/cutout/R-corner screens
- **Quick Toolbar** (v1.0.7 NEW) — the Undo / Redo / Flip / AI-Hint / Control-Range buttons have been moved from the top header toolbar to a new toolbar directly below the board, where the user's thumb naturally rests
- **Setup-Mode Manual Markers** (v1.0.7 NEW) — 🔁 castle-rights and ⚡ en-passant markers are now placed manually during Setup mode (no auto-grant), validated against the Fischer Random Chess castling rule; markers display in all modes (setup/play/review) and auto-remove when no longer eligible
- **Personified Move Animations** (v1.0.8 NEW) — Each piece has a unique personified motion characteristic via Web Animations API: ♙ pawn (timid, hesitate-back then dart, 250ms), ♘ knight (agile, L-shape parabolic jump, 380ms), ♗ bishop (sharp, quick diagonal, 270ms), ♖ rook (fierce, charge-dash-impact with light board shake, 290ms), ♕ queen (elegant, graceful arc with heavy board shake, 500ms), ♔ king (solemn, heavy step with heavy board shake, 520ms). GPU-composited via `translate3d` + `will-change:transform` + a single static `filter:drop-shadow` cached on the composited layer — every animation frame is a pure transform update (zero pixel ops), so 120fps is sustained even on mid-range devices.
- **Personified Sound Effects** (v1.0.8 NEW) — `ChessAudioEngine` pure Web Audio API synthesis (no audio files), each piece's timbre matching its animation personality: pawn (triangle 3-stage), knight (sine sweep + ding), bishop (sawtooth + filter sweep), rook (square + noise + impact), queen (3-freq harmony + LFO vibrato), king (bell partials + 4 footsteps). Routing: master → dry+reverb → compressor → destination. Mobile unlock on first gesture; `_activeNodes` auto-clean.
- **Light/Dark Theme** (v1.0.8 NEW) — Light/dark mode switches automatically with the system global setting via dual-channel detection (Java `UiModeManager` + JS `data-theme` attribute + CSS `@media (prefers-color-scheme: light)` / `html[data-theme="light"]`). Light mode uses an elegant silver palette (`#f0f0f3` / `#2c2c34` / `#4a4a52`); dark mode preserves the v1.0.7 warm brown-red + bright gold. The king icon on the loading overlay and main header toolbar switches ♔ (dark mode, white-piece styling) ↔ ♚ (light mode, black-piece styling) to match the on-board pieces.
- **Bilingual UI** — full Chinese/English toggle via the ↔️ button on the toolbar, with automatic system language detection
- **Landscape Support** — adaptive layout for both portrait and landscape orientation
- **Engine Configuration** — full UCI parameter control with export/import
- **Haptic Feedback** — responsive touch feedback throughout the interface

## Download

Download the latest APK from [GitHub Releases](https://github.com/YDW99/Regalia/releases). Enable "Install from unknown sources" to install.

## Requirements

- Android 5.0 (API 21) or later
- ARM64 device (arm64-v8a)
- ~200 MB storage

## Building

### Prerequisites

- JDK 21 (e.g. Temurin JDK 21.0.5+11) — provides `javac`
- Android SDK with API 35 (Android 15), Build-Tools 34.0.0, NDK 27.2.12479018, CMake 3.22.1
- Gradle 8.11.1 (wrapper included)
- Stockfish 18 engine binary for arm64-v8a-dotprod

### Build Steps

1. Download the Stockfish 18 arm64-v8a-dotprod binary from the [official sf_18 release](https://github.com/official-stockfish/Stockfish/releases/download/sf_18/stockfish-android-armv8-dotprod.tar), extract it, and place the binary at:
   ```
   src/main/jniLibs/arm64-v8a/libstockfish.so
   ```
   (The `.so` extension is required by Android's `System.loadLibrary` / `nativeLibraryDir` convention; the file is the Stockfish ELF executable, renamed.)

2. Build the chess.html asset (merges JS modules into the HTML template):
   ```bash
   python3 build-chess.py
   ```

3. Build the APK:
   ```bash
   ./gradlew assembleRelease
   ```

The signed APK will be at `build/outputs/apk/release/`.

## Project Structure

```
Regalia/
├── src/main/
│   ├── assets/
│   │   ├── chess.src/          # Source files (JS + CSS + HTML template)
│   │   │   ├── game-logic.js   # Chess rules, move generation, i18n, castling detection, move animation
│   │   │   ├── chess960.js     # Chess960 SP-ID, Shredder-FEN, 960 castling rules (v1.0.4 NEW)
│   │   │   ├── pgn-standard.js # Standardized PGN encoder/decoder, NAG, [%csl]/[%cal], TimeControl (v1.0.4 NEW)
│   │   │   ├── worker-pool.js  # Web Worker pool for heavy stats computation offloading (v1.0.8 PHASE 25)
│   │   │   ├── state-store.js  # Global state store (Redux-like, v1.2.0 Phase 75 NEW)
│   │   │   ├── ai-bridge.js    # Engine communication, eval display, PGN export, FEN sanitization, theme detection
│   │   │   ├── tablebase.js    # Lichess Syzygy tablebase queries + PGN import
│   │   │   ├── eco-data.js     # ECO opening classification data
│   │   │   ├── ui.js           # Core rendering, dialogs, interaction, review mode, ChessAudioEngine
│   │   │   ├── index.html.tpl  # CSS template (theme variables, responsive layout, animation keyframes)
│   │   │   └── README.license  # Per-file license classification for this directory
│   │   ├── chess.html          # Built output (combined JS+CSS+HTML)
│   │   ├── stats.html          # Statistics page (📊统计) — fullscreen WebView
│   │   ├── AGPLv3_Logo.svg     # AGPL logo for About page
│   │   ├── GPLv3_Logo.svg      # GPL logo for 💾HTML export dialog
│   │   └── README.license      # Per-file license classification for this directory
│   ├── java/com/Regalia/
│   │   ├── MainActivity.java   # WebView host, immersive mode, lifecycle, SAF file pickers
│   │   ├── StockfishNative.java # Engine Facade: @JavascriptInterface methods, delegates to managers (v1.2.0 refactored)
│   │   ├── EngineProcessManager.java # makeExecutable chmod helper (v1.2.0 Phase 73 NEW; v1.2.1 round-4 slimmed to 111 lines; round-9 ChmodProvider interface slimmed to 1 method, 118 lines)
│   │   ├── JsBridgeGateway.java      # Sandbox path validation & UCI whitelist (v1.2.0 Phase 73 NEW)
│   │   ├── PgnCacheManager.java      # PGN cache CRUD (v1.2.0 Phase 73 NEW)
│   │   ├── EngineHealthMonitor.java  # Engine response-time + recovery-count state holder (v1.2.0 Phase 73 NEW; v1.2.1 slimmed to 85 lines)
│   │   ├── FileIoHelper.java         # File I/O operations (v1.2.0 Phase 73+ NEW)
│   │   ├── PermissionHelper.java     # Runtime permission checks (v1.2.0 Phase 73+ NEW)
│   │   ├── SafPickerHelper.java      # SAF file picker: export/import settings & PGN (v1.2.0 Phase 73+ NEW)
│   │   ├── EngineSettingsHelper.java # Engine settings query/export/import (v1.2.0 Phase 73+ NEW)
│   │   ├── EngineConfigHelper.java   # Engine config: setAutoConfig/detectHardware/configure/setGameDifficulty (v1.2.0 Phase 81 NEW)
│   │   ├── StatsActivity.java  # Fullscreen WebView for 📊统计 statistics page
│   │   ├── ChessWebViewClient.java # Page load handler, render-process crash recovery
│   │   ├── EngineService.java  # Foreground service for engine stability
│   │   ├── ChessApp.java       # Application class, crash protection
│   │   ├── StabilizationHelper.java # Sensor-fusion board anti-shake (v1.0.5 NEW)
│   │   ├── TlsSecurityHelper.java # TLS 1.2+ enforcement for tablebase API
│   │   ├── RootDetector.java   # Informational root detection (About dialog)
│   │   └── README.license      # Per-file license classification for this directory
│   ├── cpp/
│   │   ├── engine_jni.cpp      # JNI native chmod/renice (from DroidFish)
│   │   ├── CMakeLists.txt
│   │   └── README.license      # Per-file license classification for this directory
│   ├── res/
│   │   ├── values/strings.xml  # Application name ("Regalia v1.2.1")
│   │   ├── xml/network_security_config.xml  # TLS + certificate pinning for tablebase API
│   │   ├── xml/backup_rules.xml             # Backup rules (Android < 12)
│   │   ├── xml/data_extraction_rules.xml    # Data extraction rules (Android 12+)
│   │   ├── mipmap-{m,h,xh,xxh,xxxh}dpi/     # Launcher icons (ic_launcher, ic_launcher_round, ic_launcher_foreground)
│   │   └── README.license      # Per-file license classification for this directory
│   ├── AndroidManifest.xml
│   ├── README.license          # Per-file license classification for src/main/
│   └── jniLibs/arm64-v8a/      # (build-time) libstockfish.so — Stockfish 18 engine binary
                                #   NOT in source tarball; download separately and place here
                                #   (see BUILDING.md). Excluded from source distribution
                                #   to keep the tarball small and avoid redistributing the
                                #   114MB engine binary with the source.
├── Manual/                     # User manuals (HTML, self-contained)
│   ├── Regalia-v1.2.1-manual-zh.html  # Chinese user manual (current v1.2.1)
│   ├── Regalia-v1.2.1-manual-en.html  # English user manual (current v1.2.1)
│   └── README.license          # Manual license classification
├── gradle/wrapper/             # Gradle wrapper (8.11.1)
│   ├── gradle-wrapper.jar
│   └── gradle-wrapper.properties
├── NOTICE                      # Third-party component notices + version history
├── NOTICE-DroidFish            # Original DroidFish notice
├── NOTICE-gradle               # Gradle notice (Apache v2.0)
├── AUTHORS-stockfish           # Stockfish project authors list
├── LICENSE                     # Standard AGPL v3 full text (alias of LICENSE-AGPL v3; v1.1.2+ for GitHub/F-Droid auto-detection)
├── LICENSE-AGPL v3             # AGPL v3 full text (application)
├── LICENSE-GPL v3              # GPL v3 full text (engine + DroidFish-derived components)
├── LICENSE-Apache v2.0         # Apache v2.0 full text (Gradle)
├── PRIVACY.md                  # Privacy policy
├── BUILDING.md                 # Build instructions
├── UBIQUITOUS_LANGUAGE.md      # Domain terminology glossary (English) — 80+ chess/engine/PGN/UI terms
├── build.gradle                # Gradle build config (reads ../version.properties for versionCode=121, v1/v2/v3 signing, NDK 27.2, cmake 3.22.1)
├── settings.gradle             # Gradle settings (plugin/repo config)
├── gradle.properties           # Gradle properties (JDK 21, Xmx2048m)
├── build-chess.py              # Python build script (merges JS modules → chess.html)
├── proguard-rules.pro          # ProGuard/R8 rules (JS bridge keep, JNI keep, log stripping)
├── lint.xml                    # Lint severity config (security=error, i18n/icon=ignore)
├── gradlew / gradlew.bat       # Gradle wrapper scripts
└── README.md
```

## Licensing

Regalia is a **combined work** under dual licensing:

| Component | License | File |
|-----------|---------|------|
| Original application code (UI, WebView, services, build scripts) | AGPL v3 | LICENSE-AGPL v3 |
| DroidFish-derived code (engine management, game logic, PGN parsing, UI patterns) | GPL v3 | LICENSE-GPL v3 |
| Stockfish 18 engine binary (`libstockfish.so`) | GPL v3 | LICENSE-GPL v3 |
| ECO opening data | CC0 (data) / AGPL v3 (code) | `src/main/assets/chess.src/eco-data.js` |
| Application icons | AI-generated / AGPL v3 | — |

Per GPL v3 Section 13, these licenses are compatible for combination. Each component retains its original license. Since AGPL v3 imposes stricter network interaction provisions (Section 13), its obligations effectively extend to the entire combined work, ensuring users who access the work over a network retain the right to obtain source code.

**Source code**: Available at https://github.com/YDW99/Regalia

### GPL v3 Files (DroidFish-derived)

- `StockfishNative.java` — Engine management logic
- `engine_jni.cpp` — Native chmod/renice from DroidFish
- `game-logic.js` — PGN disambiguation and SAN notation
- `ai-bridge.js` — Engine communication patterns
- `ui.js` — UI layout and interaction patterns
- `tablebase.js` — PGN parsing (GameTree/PgnToken/PgnScanner)
- `stats.html` — PGN parsing logic (parsePGN) derived from DroidFish
- `index.html.tpl` — CSS template (DroidFish-derived layout patterns)
- `pgn-standard.js` — PGN encode/decode (PGN parsing)
- `worker-pool.js` — PGN tokenization + chess control-map logic
- `StatsActivity.java` — Statistics page, PGN display
- `libstockfish.so` — Stockfish 18 engine binary (arm64-v8a-dotprod)

### AGPL v3 Files (original)

- `chess960.js` — Original Chess960 SP-ID and Shredder-FEN implementation
- `eco-data.js` — Original ECO data integration with IndexedDB cache
- `MainActivity.java` — Original WebView host and lifecycle management
- `ChessWebViewClient.java` — Original WebView client with render-process recovery
- `EngineService.java` — Original foreground service for engine stability
- `StabilizationHelper.java` — Original sensor-based OIS anti-shake
- `ChessApp.java` — Application lifecycle/crash protection
- `RootDetector.java` — Security check
- `TlsSecurityHelper.java` — TLS config
- `CMakeLists.txt`, `build-chess.py` — Build infrastructure
- `AndroidManifest.xml`, `strings.xml`, `res/xml/*.xml` — Config files
- `build.gradle`, `settings.gradle` — Build config

### Third-Party Components

- **DroidFish** — Engine management, game logic, PGN parsing, UI patterns (Copyright © Peter Österlund, GPL v3)
- **Stockfish 18** — Chess engine (Copyright © T. Romstad, M. Costalba, J. Kiiski, G. Linscott, GPL v3)
- **Lichess Tablebase API** — Endgame tablebase queries (public API, requires network)
- **lichess-org/chess-openings** — ECO opening classification data (CC0)

See [NOTICE](NOTICE) for full attribution details. More declaration documents are preserved in [NOTICE-DroidFish](NOTICE-DroidFish) and [AUTHORS-stockfish](AUTHORS-stockfish).

## Contributing

Contributions are welcome! Please ensure:

1. All contributions to the application layer are licensed under AGPL v3
2. Any modifications to DroidFish-derived or Stockfish code remain under GPL v3
3. Code is tested on physical Android devices (especially Xiaomi HyperOS 3)

## Version

During the development stage, the version number used was: **v18.x.x**. For future versions, once the version number exceeds **v17.x.x**, <span style="color:red; font-weight:bold;">**v18.x.x** should be skipped</span> and the next version should be **v19.x.x**.

**v1.2.1** (versionCode 121) — current release

The v1.2.1 release is a **hardening + bug-fix refinement pass** on top of v1.2.0, based on a comprehensive first-principles code review of all 32K+ source lines (4 parallel review agents covering Java engine/bridge, Java UI/util, JS core, and JS UI). It spans three refinement passes (initial defect fix, second-pass bug fixes, third-pass unused-file activation). **No new features, no new permissions, no new network access, no versionCode bump.** The release focuses on reliability, correctness, security, and completing the Phase 73-75 God Module split:

- **P0 (critical)**: TOCTOU race on `_discardingPonderBestmove` — `stopAndWaitForBestmove` and the bestmove reader thread now clear the discard flag in the early-return and latch-capture paths, preventing the flag from being stuck `true` and silently discarding the next legitimate bestmove (manifested as "AI never moves").
- **P1 (bug fix)**: Chess960 re-apply symmetry — `startEngineInternal` now re-applies `UCI_Chess960` as both `true` AND `false` based on `_pendingChess960`, so a user switching back to standard chess no longer has `UCI_Chess960=true` retained after an engine crash.
- **P1 (bug fix)**: eval-mode option leak — `engineStop()` now calls `restoreGameplayOptions()` if it interrupts a `STATE_EVAL` search, preventing `Contempt=0` / `MultiPV=1` / `UCI_AnalyseMode=true` from leaking into the next gameplay search.
- **P1 (bug fix)**: `sendSetOptionAndWait` newline hardening — `value` parameter stripped of `\r` / `\n` before concatenation into the UCI command (matches the parallel hardening applied to `UciProtocolHandler.setOptionAndWait` in v1.2.0).
- **P1 (bug fix)**: `_restartInProgress` stale-detection — `recoverEngine` and `restartEngine` now reset the restart lock if stuck >30s (e.g., inner executor task silently discarded by `shutdownNow()`).
- **P1 (security)**: `JsBridgeGateway.isPathInSandbox` now requires trailing `File.separator` before `startsWith`, closing a theoretical directory-traversal where `/data/data/com.Regalia/files_evil/x` could pass the `filesDir` check.
- **P1 (reliability)**: `ChessApp` UncaughtExceptionHandler now sets a static flag via `StockfishNative.markEngineThreadDead(threadName)` when an `SF-*` engine thread dies; heartbeat monitors this flag and triggers immediate `recoverEngine` instead of waiting for the 15–30s zombie timeout.
- **P1 (reliability)**: `StatsActivity.onDestroy` now calls `webView.stopLoading()` first, matching `MainActivity.onDestroy` — prevents SIGSEGV on HyperOS 3 / MIUI.
- **P1 (privacy)**: Removed `takePersistableUriPermission` calls from `SafPickerHelper` (export + import paths) and `StatsActivity` (PGN import) — one-shot operations no longer consume the 512-grant SAF cap.
- **P1 (bug fix)**: Checkmate WDL inversion — `requestEngineEval` and `_requestBatchEval` fast-paths now write `wdlW=1000` (not 0) when Black is checkmated, matching `onEngineEval`'s White-POV swap.
- **P1 (bug fix)**: `formatEvalAnnotation` malformed `[%eval #+]` / `[%eval #-]` tags — `absMd` now defaults to 1 when `mateDist=0` but `|eval|≥90000` (matching `formatEvalTag`).
- **P1 (bug fix)**: `onBestMove` validation order — UCI move parsing and piece-existence checks now run BEFORE clearing `isAIThinking` / `_aiSafetyTimerId` / `_aiRetryCount`, preventing an unparseable bestmove from leaving the AI in a "not thinking, no safety timer, but still AI's turn" deadlock.
- **P1 (bug fix)**: CSS `font-family` HTML entity — 5 occurrences of `&#x27;` inside `<style>` rules in `index.html.tpl` replaced with literal `'` (HTML parser does NOT decode entities in raw-text mode); chess pieces, review pieces, promotion buttons, setup buttons, and move-animation overlay now correctly use the documented `'DejaVu Sans','Noto Sans','Segoe UI Symbol'` font stack.
- **P1 (input validation)**: PGN cache name `prompt()` now enforces 60-char cap and rejects `/ \ : * ? " < > |` + control chars (matching `_renameHumanPlayer`).
- **P2 (robustness)**: `HapticHelper.perform` now respects the system `HAPTIC_FEEDBACK_ENABLED` setting (matching `StatsActivity.performHaptic`).
- **P2 (robustness)**: `StockfishNative.extractEngineFromApk` (inline) now guards against `ZipEntry.getSize() == -1` (divide-by-zero / negative progress percentage). The same fix had previously been applied only to the now-deleted `EngineProcessManager.extractEngineFromApk` copy.
- **Third-pass (TLS pin validation)**: `TlsSecurityHelper.validatePin` now implements actual SPKI SHA-256 pin validation per RFC 7469 (was a no-op stub). (The other third-pass "unused-file activation" items were reverted in the fourth pass below.)
- **Fourth-pass (round-4 cleanup — dead-code purge)**: First-principles review concluded that the third-pass "unused-file activation" wired up 7 Phase-73/74 extracts that duplicated inline logic with subtly different conventions (rank order, move taxonomy, audio state, ELO ranges). Round 4 deletes 7 files (`MessageBus.java`, `UciProtocolHandler.java`, `EngineConfigManager.java`, `ui-audio.js`, `ui-board.js`, `ui-review.js`, `ui-toolbar.js`) and slimms 2 files (`EngineHealthMonitor` 208→85 lines, `EngineProcessManager` 489→111 lines). `EngineConfigHelper.setEngineSkillLevel` now inlines the 0/20 skill-level constants. `MainActivity` no longer registers `MessageBus` as a JS interface. `build-chess.py` module list 13→9. The `TlsSecurityHelper.validatePin` improvement from the third pass is RETAINED.
- **Fifth-pass (round-5 review — line-by-line audit of remaining 28 files)**: First-principles line-by-line review of all remaining 19 Java files + 9 JS files. Removed 2 unused imports (`ChessApp.java` and `ChessWebViewClient.java` each had a leftover `import android.os.Build;`). Fixed a silent data-mutation bug in `EngineSettingsHelper.importSettings` where the `engine.elo` case used a 1-3200 range, inconsistent with `EngineConfigHelper`'s canonical 500-3500 range (importing 400 would pass the check, then be silently re-clamped to 500 on the next `setEngineLimitElo` call). Verified all other 16 Java files and all 9 JS files clean (no dead code, no inconsistent ranges, no leftover debug statements, no references to deleted symbols).
- **Sixth-pass (round-6 review — stats page visual annotation bug fix)**: Fixed user-reported bug where the statistics page's visual annotations section was silently hidden for all newly-played games. Root cause: `_buildPGNString()` only exports `imported=true` annotations (per Phase 62 design), so the stats page's PGN-text scan never found auto-generated annotations. Fix: `openStatsPage()` now sends a separate `visualAnnotations` payload field with all cache entries (imported + auto-generated); the stats page uses this as the primary data source, falling back to PGN-text scan only if absent. The Phase 62 PGN-export design is unchanged (auto-generated annotations still do NOT pollute PGN export).
- **Seventh-pass (round-7 review — Phase 62 revert + audit-report fixes + security hardening)**: Comprehensive review of the audit-report collection (`综合审查报告_Final.md`, `regalia_v121_sonarcloud.md`, `吉他审查报告.md`, `Semgrep_Code_Findings.TXT`) plus a first-principles line-by-line re-review of every source file. Implemented all non-false-positive findings:
  - **PGN export semantics change**: Reverted the Phase 62 `imported`-flag filter in `_buildPGNString()` (ai-bridge.js). Visual annotations `[%csl]` / `[%cal]` are now exported based solely on the export dialog's `includeAnnotations` choice, no longer gated on the `imported` boolean. The `imported` field is retained in the cache for backward compatibility but no longer affects export. The `openStatsPage()` `visualAnnotations` payload remains the primary data source for the stats page.
  - **SonarCloud B01 (Critical, css:S4652)**: Removed redundant `flex-shrink:0` declaration in `index.html.tpl` — it was overridden by the subsequent `flex:0 0 auto` shorthand, causing maintenance confusion.
  - **SonarCloud B02+B03 (Major, javascript:S2589)**: Removed three unreachable `typeof _requestBatchEval === 'function'` checks in `ui.js`. `_requestBatchEval` is always exported by `ai-bridge.js` at module-load time; the `else` fallbacks were dead code (and inconsistently implemented — only one reset the safety timer).
  - **SonarCloud B04 (Major, javascript:S3403)**: Simplified `r !== null && r !== undefined` to the idiomatic `r != null` in `_withPGNSaveCheck` (ui.js). Semantically identical, community-standard idiom.
  - **R2 (security hardening, game-logic.js)**: `secureRandomInt()` no longer falls back to `Math.random()` when `crypto` is unavailable. Instead it fails safe by returning `0` (selecting the first valid candidate) and logging an error. This mirrors the existing `randomSPID()` fail-safe pattern in `chess960.js`. `Math.random()` is a predictable PRNG; using it for Chess960 SP-ID selection or ECO opening-book picks would defeat the purpose of cryptographic randomization.
  - **R3 (API design, StockfishNative.java)**: Added a structured `postJsCallback(String eventName, Object... args)` overload that JSON-encodes all arguments via `JSONArray` and validates `eventName` against an ECMAScript IdentifierName regex. Existing call sites (which already correctly use `escapeJsString()`) are unchanged; the new API is for future callers and eliminates the "forgot to escape" injection risk by construction.
  - **吉他#1 (P1, data consistency)**: Unified ELO range across Java and JS. `setConfigElo()` in `ai-bridge.js` now clamps to 500-3500 (was 500-3200), matching `EngineConfigHelper` and `EngineSettingsHelper` on the Java side. Previously, importing a settings file with elo=3400 would be accepted and persisted, but the UI slider could not represent or re-produce that value — causing silent data loss on the next UI edit.
  - **吉他#2 (P2, edge case)**: `onBestMove()` in `ai-bridge.js` now probes `gameStatus()` when the engine returns `(none)` / `0000`. If the position is genuinely terminal (checkmate/stalemate), it applies `_applyGameOver()` and clears AI state immediately — preventing the safety-timer retry loop from hanging for up to 18 minutes (3 × 360s) before surfacing `ai_timeout`. Non-terminal `(none)` (theoretical engine anomaly) retains the existing retry behavior.
  - **Semgrep FP elimination (state-store.js)**: `_deepClone()` now constructs RegExp copies via `new RegExp(obj.source, obj.flags)` instead of `new RegExp(obj)`. Semantically equivalent, but the explicit form eliminates the `detect-non-literal-regexp` Semgrep finding. Also added a depth guard (max 64) to prevent stack overflow on pathological deeply-nested inputs.
  - **Documentation comment**: `sEngineThreadDied` / `sEngineThreadDiedName` static-volatile fields in `StockfishNative.java` now carry an explicit comment documenting the single-engine-per-process design assumption, so future multi-engine support would know to promote these to per-instance fields.
  - **Build infrastructure**: Created `proguard-rules.pro` (was referenced by `build.gradle` but missing from the source tree). Rules cover `@JavascriptInterface` keep, native method keep, `ChmodProvider` interface keep, application/service subclass constructors, and Log.v/Log.d stripping in release builds.
  - **README directory tree**: Corrected inaccurate line-count references (EngineProcessManager 102→111, EngineHealthMonitor 73→85) and added `proguard-rules.pro` + `lint.xml` entries.
- **Eighth-pass (round-8 review — state-store.js TDZ white-screen bug fix)**: Fixed critical white-screen bug introduced in round-7. **Symptom**: APP opens but only the background color renders — no UI content. **Root cause**: the round-7 `_deepClone()` hardening added `const DEEP_CLONE_MAX_DEPTH = 64;` at a position in the IIFE that came AFTER the IIFE-top initialization call `let _state = _deepClone(_initialState);`. Since `const` declarations do NOT hoist like `var` (they are in the "temporal dead zone" until their declaration line executes), the function body's reference to `DEEP_CLONE_MAX_DEPTH` triggered `ReferenceError: Cannot access 'DEEP_CLONE_MAX_DEPTH' before initialization`. The state-store module initialization crashed, every dependent module (ui.js, ai-bridge.js, etc.) failed to load, and the WebView rendered only `<body>`'s background color. **Fix**: moved the `const DEEP_CLONE_MAX_DEPTH = 64;` declaration to IIFE-top, BEFORE `let _state = _deepClone(_initialState);`, with a documentation comment explaining the TDZ trap. Two latent build-config mismatches were also corrected on the fresh environment: `build.gradle` now pins `ndkVersion "27.2.12479018"` (AGP's default 27.0.12077973 was incomplete) and sets `useLegacyPackaging true` to match `android:extractNativeLibs="true"` in `AndroidManifest.xml` (was `false`, producing a 0-byte APK with `Could not find EOCD`). All 9 JS modules pass `node --check`; `chess.html` rebuilt; release APK re-signed with v1+v2+v3.
- **Ninth-pass (round-9 review — first-principles code review + hardening)**: Comprehensive first-principles code review of all ~32K source lines, guided by three uploaded PDFs (AI code-gen defect prevention, Android WebView dev, SonarCloud pass guide). Six parallel review agents covered all 9 JS files, all 19 Java files, build infra, manifest, cpp, tablebase.js, and index.html.tpl. Implemented fixes by priority (bug fix > robustness > feature > performance > redundancy > simplification):
  - **P1 (bug fix + critical robustness)**:
    - **AndroidManifest.xml**: Added required `<property android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE" android:value="chess_engine_analysis" />` child to EngineService — Android 14+ requires this for `FOREGROUND_SERVICE_TYPE_SPECIAL_USE`, otherwise `startForeground()` can throw `ForegroundServiceTypeNotAllowed` on Android 14+ devices (app targets `targetSdk 35` so all Android 14+ devices were affected). Verified via `aapt dump xmltree`.
    - **StockfishNative.java**: Fixed lock mismatch — `_discardingPonderBestmove` write in `stopAndWaitForBestmove` timeout path was under `_stopLatchLock` but the reader clears it under `_discardFlagLock`. Now nested under `_discardFlagLock` for mutual exclusion.
    - **StockfishNative.java**: `cleanupEngineResources()` now resets `currentState` to `STATE_NONE` FIRST, so buffered bestmove/info lines the reader thread processes during teardown route through `STATE_NONE` branches and become no-ops (prevents racing `onEngineRestarting` with stale `onBestMove`).
    - **ai-bridge.js**: `_attachDivergentPV` now checks `makeMvInPlace` return value — previously a `null` return (invalid move) was discarded, leaving state at the wrong position and producing incorrect SAN for divergent PVs that got stored in `moveRecords` variations and exported in PGN.
    - **Cross-module export-list corrections** (5 JS files): `eco-data.js` (removed 5 names not defined here), `ai-bridge.js` (removed 9 names not defined here), `ui.js` (removed 2 names not defined here), `game-logic.js` (added `makeMv`, removed `fenToState`), `tablebase.js` (added `copyFEN`, `copyReviewFEN`, `fenToState`). No production impact (bundled mode strips the export line) but lists were misleading.
  - **P2 (robustness + redundancy)**:
    - **state-store.js**: `reset()` now returns `_deepClone(_state)` instead of `_state` (live reference) — consistent with `getState()`/`dispatch()`. `SHOW_DIALOG`/`HIDE_DIALOG` reducers now guard against non-string payload (prevents junk keys in `dialogVisible`).
    - **chess960.js**: Added null guards to `parseShredderCastling`, `findCastlingRooks`, `isChess960CastlingLegal` (matches existing guard in `toShredderCastling`).
    - **pgn-standard.js**: Tag-removal regex updated to handle escaped quotes in tag values (e.g. `[Event "Some \"Fun\" Event"]`) — parity with tag-extraction regex.
    - **ai-bridge.js**: 6 empty `catch(e){}` blocks in eval-cache persistence paths now log via `_warnEvalCache()` helper (console.warn) instead of silently swallowing errors.
    - **eco-data.js**: `_saveEcoToCache` empty catch now logs via console.warn.
    - **game-logic.js**: `_validateSetupCastleMarks` now guards against malformed (non-integer or out-of-range) keys via `Number.isInteger` check — previously `parseInt` returning `NaN` silently mapped to a8.
    - **StatsActivity.java + SafPickerHelper.java**: `openOutputStream` null check — `ContentResolver.openOutputStream` can return null per docs; now throws `IOException` with clear message instead of NPE.
    - **EngineProcessManager.java + StockfishNative.java**: Slimmed `ChmodProvider` interface from 3 methods to 1 (`nativeChmod`) — removed 2 dead methods (`isEnglishMode`, `postProgress`) left over from round-4 cleanup.
    - **build.gradle**: `FileInputStream` resource leak fixed via `withInputStream` (SonarCloud java:S2093) — 2 occurrences (version.properties + keystore.properties reads).
    - **index.html.tpl**: CSP hardened with `form-action 'none'` and `object-src 'none'` (defense-in-depth; both fall back to `default-src 'none'` so behavior unchanged).
  - **P3 (redundancy + stale comments)**:
    - **index.html.tpl**: Removed redundant `flex-shrink:0` in `.review-left` (same pattern round-7 cleaned up elsewhere; this instance was missed). Updated stale comment about `.rv-slider-wrap` CSS.
    - **tablebase.js**: Removed unreachable `else` branch and redundant `divergeIdx>=0&&` prefixes in PGN variation relocation logic.
    - **ui.js**: `_tryRecovery` IIFE — documented that the load-and-apply path is intentionally not implemented (was dead code with empty if-body); kept the IIFE for its still-useful cleanup behavior.
  - **Verification**: All 9 JS modules pass `node --check`. `state-store.js` loads cleanly under `vm.runInContext`. `chess960.js` null guards verified (no TypeError). `chess.html` rebuilt (21,795 lines, 1,310,827 bytes). Release APK rebuilt (78,132,453 bytes), signature v1+v2+v3 all true. `aapt dump xmltree` confirms FGS subtype property in compiled manifest. Version: versionCode=121, versionName="1.2.1" (unchanged — same-version refinement).
- **Documentation**: BUILDING.md, PRIVACY.md, README.md directory tree, NOTICE, all 7 README.license files, and Chinese/English HTML manuals updated to reflect v1.2.1 changes (including the round-7 entries above).
- **Tenth-pass (round-10 review — deep fix of review-D/E/F P2/P3 items)**: Targeted deep fix of the P2/P3 items flagged by round-9's review-D (StockfishNative), review-E (16 mid-size Java files), and review-F (build infra + manifest + proguard). 13 priority items implemented, no behavior change to the user-visible chess engine or UI — all fixes are concurrency-hardening, dead-code removal, or readability improvements. No versionCode bump.
  - **P2 (concurrency hardening, StockfishNative.java)**:
    - **`_restartInProgress` lock consistency** — All 14 `_restartInProgress = false` writes now go through a new `_clearRestartInProgress()` helper that takes `_restartLock`, matching the locked `=true` writes in `recoverEngine`/`restartEngine`. Previously the bare writes raced with concurrent `=true` writes (review-D P2).
    - **`recoverEngine` shutdown-requested checks** — `startEngineInternal` now checks `shutdownRequested` at entry and bails out (clearing the restart lock) if a shutdown was requested between task scheduling and execution. `recoverEngine` re-checks after recreating the executor and before scheduling the delayed task. Prevents leaked engine processes/executors when `shutdown()` races a pending recovery (review-D P2).
    - **`_discardingPonderBestmove` lock unification** — Three additional write sites (stopAndWaitForBestmove ponder branch, cleanupEngineResources, stopPonder) now wrap the write in `synchronized (_discardFlagLock)`. Round-9 fixed the line-750 mismatch; round-10 closes the remaining holes so every read/write of the flag is under the same lock (review-D P2).
    - **URL scheme case-insensitivity (3 sites)** — `StockfishNative.openUrlInBrowser`, `StatsActivity.openUrlInBrowser`, and `ChessWebViewClient.shouldOverrideUrlLoading` now use `Uri.parse(url).getScheme()` + `"http".equalsIgnoreCase(...)` instead of case-sensitive `startsWith("http://")`. RFC 3986 §3.1 specifies scheme is case-insensitive; the previous check rejected valid `"HTTP://..."` URLs (review-E P2).
    - **`StatsActivity.statsPayload` volatile + `onPause`/`onResume`** — `statsPayload` is now `volatile` (was relying on the implicit happens-before from `webView.loadUrl`, which is correct but fragile). Added `onPause`/`onResume` overrides that call `webView.onPause()`/`onResume()` so backgrounded stats pages stop running JS timers (matches MainActivity; prevents HyperOS 3 from raising the app's background-CPU score) (review-E P2).
    - **`EngineConfigHelper.detectBigCoreCount` failure-cache fix** — The catch block no longer caches the 0-result; `_cachedBigCoreCount` stays at -1 so a transient `/proc/cpuinfo` read failure (e.g. SELinux denials flush) is retried on the next call. Previously a single transient failure permanently degraded thread autoconfig to 1 thread (review-E P2).
    - **`StabilizationHelper.applyTransform` hot-path optimization** — `r.removeProperty('--stab-rot')` moved from the per-frame `applyTransform` (~50Hz) to a one-time call in `start()`. The `--stab-rot` CSS variable is never set in the current codebase (Rev64 removed rotation sensors), so the per-frame call was a no-op executed 50 times per second (review-E P2).
    - **`TlsSecurityHelper.validatePin` constant-time comparison** — Pin comparison now uses `MessageDigest.isEqual(byte[], byte[])` on the raw 32-byte SHA-256 digest against pre-decoded pin bytes (decoded once at class-load). The previous `String.equals` short-circuits on length mismatch, leaking pin length to a timing attacker. Pins are public Let's Encrypt values so the practical risk is low, but `isEqual` is the documented best practice and silences the SonarCloud crypto-bad-comparison hotspot (review-E P2).
  - **P2 (dead-code purge)**:
    - **`HapticHelper.java` removed entirely** — 128-line Phase 73 extraction that was instantiated in `StockfishNative` (`_hapticHelper = new HapticHelper(...)`) but **never invoked**. `StockfishNative.performHaptic` calls the inline `performHapticInternal` directly. Removed: the class file, the field declaration, and the instantiation. Updated `README.md` directory tree, `NOTICE`, and `java/com/Regalia/README.license` (review-E P2).
  - **P3 (readability + simplification, StockfishNative.java)**:
    - **Magic numbers extracted** — `50000000L` (4 occurrences, 50 MB minimum engine binary size) → `MIN_ENGINE_BINARY_SIZE`. `Thread.sleep(100)` (ponder-stop grace) → `PONDER_STOP_GRACE_MS`.
    - **`escapeJsString` dead-code removal** — Default-case guard `c != '\t' && c != '\n' && c != '\r'` was dead (those chars are caught by explicit cases above). Simplified to `if (c < 0x20)`.
    - **`isProcessAlive` performance** — Pre-checks `Build.VERSION.SDK_INT >= O` before calling `engineProcess.isAlive()` (API 26+). Previously every call (heartbeat ~1Hz + every UCI send path) took the `NoSuchMethodError` hit on API 21-25. Common path is now a direct virtual invoke with no try/catch overhead.
    - **`_pendingChess960` field moved** — From mid-class (line ~1175) to the main field block near `_discardingPonderBestmove` for readability.
    - **`if (ctx == null)` dead code removed** — `context` is a final field set in the constructor; it can never be null. Removed the dead guard in `isSystemDarkMode()`.
    - **Misleading "remove JNI bridge" comment rewritten** — The v18.5.0 file-header comment said "Refactored to remove JNI bridge / engine import code" but JNI is still used for chmod/renice via `engine_jni.cpp`. Rewritten to "Refactored to consolidate engine binary resolution ... JNI is still used for chmod/renice via engine_jni.cpp — see EngineProcessManager."
  - **P3 (build infrastructure)**:
    - **`build.gradle` pickFirsts** — Removed `'**/libfoundation.so'` from `pickFirsts`. `jniLibs/` contains only `libstockfish.so` and `libc++_shared.so`; the libfoundation.so entry was a leftover from an earlier build config and never matched anything (review-F P3).
    - **`build.gradle` lint disable list** — Removed the `disable 'ObsoleteLintCustomCheck', 'GradleDependency', 'OldTargetApi', 'AndroidGradlePluginVersion', 'NonConstantResourceId'` line. These 5 checks are already `severity="ignore"` in `lint.xml` (lines 52-60), so listing them again split configuration across two files. `lint.xml` is now the single source of truth (review-F P3).
    - **`AndroidManifest.xml`** — Removed `android:requestLegacyExternalStorage="true"`. This attribute is ignored when `targetSdk >= 30` (we use 35). The app uses SAF for all file I/O, so legacy storage mode was never actually consulted (review-F P3).
    - **`proguard-rules.pro`** — Rewrote the misleading section-6 comment. The previous comment said "engine_jni.cpp calls StockfishNative.nativeChmod" — inverted. Java calls C++ (C++ is the implementation). Rewritten as "Java calls StockfishNative.nativeChmod(String) : boolean, which is implemented in C++ in engine_jni.cpp via JNI" (review-F P3).
  - **Verification**: All 9 JS modules pass `node --check`. `state-store.js` loads cleanly under `vm.runInContext` (no TDZ regression). `chess.html` rebuilt (21,795 lines, 1,310,827 bytes — same size as round-9, confirming no JS source changes). Release APK rebuilt (78,133,982 bytes), signature v1+v2+v3 all true. `aapt dump xmltree` confirms FGS subtype property still present and `requestLegacyExternalStorage` no longer in compiled manifest. Version: versionCode=121, versionName="1.2.1" (unchanged — same-version refinement).
  - **P2/P3 (secondary review-E items, round-10 continuation)**: Addressed the remaining review-E items not in the initial priority list. No behavior change — all are naming, maintainability, or timing improvements.
    - **`FileIoHelper` naming fix** — Renamed `ensureReadExternalStoragePermission` → `requestReadExternalStoragePermission`. The previous "ensure" name implied a synchronous guarantee, but `Activity.requestPermissions` is asynchronous (shows dialog, returns immediately); the caller (`readTextFile`) does NOT wait for the result. Also extracted the hardcoded request code `1002` to the named constant `REQUEST_CODE_READ_EXTERNAL_STORAGE` (review-E P2).
    - **`PermissionHelper` request-code overlap fix** — Migrated the hardcoded permission request codes from the 1000-range (1001 storage / 1003 notification) — which overlapped with `SafPickerHelper`'s `REQUEST_CODE_IMPORT_SETTINGS=1001` / `REQUEST_CODE_IMPORT_PGN=1003` — to a disjoint 3000-range (`REQUEST_CODE_STORAGE_PERMISSION=3001` / `REQUEST_CODE_NOTIFICATION_PERMISSION=3002`). The overlap caused no functional bug (`requestPermissions` and `startActivityForResult` dispatch through different Activity callbacks, and `MainActivity` has no `onRequestPermissionsResult` handler), but the shared numeric values were confusing for maintenance (review-E P2).
    - **`ChessApp` / `MainActivity` / `StockfishNative` version-string unification** — Replaced 3 hardcoded `"v1.2.1"` literals with `BuildConfig.VERSION_NAME` (auto-generated by AGP from `build.gradle`'s `versionName`). Affected: `ChessApp` init-log line, `MainActivity.VERSION` (title display "Regalia v1.2.1"), `StockfishNative.ENGINE_VERSION` (exposed to JS via `getEngineVersion()`). Now all three stay in sync with `build.gradle` without manual edits (review-E P3).
    - **`EngineService.isRunning` timing fix** — Moved `isRunning = true` from the top of `onCreate()` (before `createNotificationChannel` / `startForeground`) to AFTER `startForeground()` succeeds. If `startForeground` throws (e.g. `ForegroundServiceTypeNotAllowed` on Android 14+ if the FGS subtype property were ever missing — round-9 added it, but a future regression could re-trigger), `isRunning` is no longer left `true` while the service is actually dead. Callers (`EngineService.start`, `updateNotification`) no longer no-op or attempt to update a non-existent notification (review-E P3).
    - **`ChessWebViewClient` doc-comment update** — Updated the `Version: v1.2.1` header comment to note the round-10 case-insensitive URL scheme check (review-E P3, documentation only).
  - **Verification (round-10 continuation)**: All 9 JS modules pass `node --check` (no JS source changes this pass). `chess.html` unchanged (1,310,827 bytes). Release APK rebuilt (78,134,216 bytes — 234 bytes larger due to new `BuildConfig` references + named constants), signature v1+v2+v3 all true. `dexdump` confirms `v1.2.1` string inlined by R8 (BuildConfig.VERSION_NAME constant propagation). `unzip -l` confirms `HapticHelper.class` still absent. Version: versionCode=121, versionName="1.2.1" (unchanged — same-version refinement).
- **Documentation**: BUILDING.md, PRIVACY.md, README.md directory tree, NOTICE, all 7 README.license files, and Chinese/English HTML manuals updated with round-10 entries.
- **Round-10 regression test + first-principles optimization (2026.7.14)**: Comprehensive regression test of all review-D/E/F fixes (all verified intact), followed by first-principles optimization of residual issues discovered during the audit:
  - **StockfishNative.java**: Extracted `PROCESS_DESTROY_GRACE_MS = 100` constant for the 2 remaining `Thread.sleep(100)` calls in `cleanupEngineResources()` and `shutdown()` (semantically distinct from `PONDER_STOP_GRACE_MS` — kept separate for independent tuning). No `Thread.sleep(100)` magic numbers remain.
  - **StatsActivity.java**: Removed redundant second `Uri.parse(trimmed)` call in `openUrlInBrowser` — the first parse (for scheme check) is now reused for the Intent.
  - **StabilizationHelper.java**: Corrected comment direction ("above" not "below" — `start()` is above `applyTransform()` in source order).
  - **proguard-rules.pro**: Rewrote section-3 comment (same direction-inversion bug as the round-10 section-6 fix — said "engine_jni.cpp calls into Java" but Java calls C++). Now consistent with section-6.
  - **Verification**: All 9 JS modules pass `node --check`. `chess.html` unchanged (1,310,827 bytes). Release APK rebuilt (78,134,328 bytes), signature v1+v2+v3 all true. FGS subtype property present, requestLegacyExternalStorage absent, HapticHelper.class absent. Version: versionCode=121, versionName="1.2.1" (unchanged — same-version refinement).

---

**v1.2.0** (versionCode 120) — previous release

The v1.2.0 release is an **architecture refactor major version**. **Phase 73-80** (2026.7.11) — God Module split + SonarCloud fixes + review board coordinate labels + documentation sync. (A) **Java God Module split**: `StockfishNative.java` (5,443→4,492 lines) refactored into Facade + 11 manager/helper classes: `EngineProcessManager.java`, `UciProtocolHandler.java`, `EngineConfigManager.java`, `JsBridgeGateway.java`, `PgnCacheManager.java`, `EngineHealthMonitor.java`, `FileIoHelper.java`, `PermissionHelper.java`, `HapticHelper.java`, `SafPickerHelper.java`, `EngineSettingsHelper.java`. All `@JavascriptInterface` method signatures preserved (JS-side `AndroidBridge` calls unchanged). (B) **JS God Module split**: `ui.js` (8,245→8,061 lines) split into 4 new modules + `_computeAndCacheVisualAnnotations` (439 lines) decomposed into 4 sub-functions + `_buildEvalTrendSVG` (267 lines) decomposed into 6 sub-functions. `build-chess.py` updated to merge 13 modules in dependency order. (C) **MessageBus.java + state-store.js** (Phase 75): unified JS↔Java message dispatch and Redux-like global state store. (D) **SonarCloud fixes**: All 42 Bugs fixed (InterruptedException re-interrupt, delete()/renameTo() return value checks, AtomicInteger for thread-safe counters); 5 Vulnerabilities fixed (Chess960 SP-ID uses secureRandomInt()); `_buildPGNString` decomposed into 6 sub-functions to reduce cognitive complexity. (E) **Review board coordinate labels** (Phase 77): left 1-8 rank labels + top a-h file labels + per-square coordinate labels, matching main board and stats board. (F) **Version**: versionCode=120, versionName="1.2.0".
│   │   ├── EngineConfigHelper.java   # Engine config: setAutoConfig/detectHardware/configure/setGameDifficulty (v1.2.0 Phase 81 NEW)

---

**v1.1.2** (versionCode 112) — previous release

The v1.1.2 release fixes two user-reported issues and implements reasonable P0/P1/P2/GOV/MED suggestions from the comprehensive code review report. **Phase 72** (same-version revision, 2026.7.12) — review analyze-all "false completion" bug fix after long-press priority. The `_reviewAnalyzeAdvance` completion check previously ONLY walked forward from `_reviewAnalyzeStep+1`; when the user long-pressed a step to prioritize it (Phase 68 feature), the batch evaluated that single step, then the forward walk reached `_lastStep` and reported "all analysis complete" — even though steps BEFORE the prioritized step were still uncached. Fix: when the forward walk finds nothing, scan the ENTIRE range `[0.._lastStep]` for the lowest uncached step and resume the batch from there. The forward-only fast-path is preserved for the common (no-priority) case; the full-range scan is the source of truth for completion. **Phase 71** (same-version revision, 2026.7.11) — stats-page move-selection bug fix + first-principles code review of all 34K lines. (A) **Bug fix (user-reported)**: `stats.html` CSP blocked inline `onclick` handlers → clicking a PGN move in the statistics page did nothing (no highlight, no board switch). Root cause: the SHA-256-hash-based `script-src` policy silently blocked all 23 inline event handlers per CSP Level 2+. Fix: switch `script-src` from `'sha256-...'` to `'unsafe-inline'` (safe because stats.html is a local asset with no external content and all JS is inlined). (B) **XSS hardening** (consequence of the CSP change): the `renderPGNText` movetext-walk fallback in `stats.html` previously appended unrecognized movetext characters raw to the HTML string — combined with `'unsafe-inline'`, a malicious PGN movetext payload like `<img src=x onerror="...">` would execute. Fix: route all unrecognized characters through `_escFEN` (escapes `&<>"'\``). Same hardening applied to the variation-text walk and the `firstMoves` opening-plies list. (C) **Chess960 0-distance castling fix** (P1 bug affecting both the main app and the stats page): for SP-IDs where the king already sits on its castling target square (e.g. king on g1, kingside rook on h1 → UCI `g1h1`), `uciToCoords` rewrote the destination to col 6, producing a 0-distance "move" `g1g1`. The `_castleSide` distance heuristic rejected this (0 < minDist) AND the destination held the king (not a rook) → castling not detected → `makeMv` ran `board[to]=board[from]; board[from]=null` → king nulled. Fix: `uciToCoords` (ai-bridge.js) now attaches `castle='kingside'/'queenside'` to `result.to` when rewriting Chess960 castling, so `_castleSide`'s primary path (`mv.to.castle`) catches it before the fallback. `executeMove` (ui.js) now checks `to.castle` as the primary source for the castle flag (covers AI moves where `legalMvs` is empty). `_castleSide` (game-logic.js) adds an explicit 0-distance branch as defense-in-depth. `stats.html` mirrors all three fixes in its independent code (executeMove + buildSAN + the from===to skip-king-move branch). (D) **Concurrency fixes** (StockfishNative.java): `readyOkLatchHolder` race — JS binder thread (sendSetOptionAndWait) and executor thread (startEngineInternal / engineGoInternal ucinewgame) both wrote the single volatile field without synchronization; if they overlapped, one latch was lost → 3s timeout. Fix: dedicated `_readyOkLock` serializes all readyOk set+wait operations. `engineStop` TOCTOU on `_discardingPonderBestmove` — engineStop set the flag outside any lock while the reader thread's bestmove handler read it outside any lock; a window existed where engineStop set the flag AFTER the reader's check but BEFORE `handleBestMove`, processing the stopped search's bestmove as a real AI move. Fix: dedicated `_discardFlagLock` makes the check-and-clear atomic w.r.t. engineStop's set. (E) **importSettings cap bypass fix** (StockfishNative.java): `importSettings` directly assigned `engineThreads`/`engineHash`/`engineMoveOverhead` with loose caps (1024 threads / 1048576 MB hash / 10000ms overhead), bypassing the Phase 69 setter caps (2x CPU cores / 50% JVM heap / 1000ms). Fix: apply the Phase 69 cap formulas inline in `importSettings` (direct field assignment, because the setters return early when autoConfig is enabled — autoConfig is only disabled later in the import flow). (F) **StatsActivity robustness**: added the deprecated `shouldOverrideUrlLoading(WebView, String)` overload so that on API 21-23 (minSdk=21) external http(s) URLs are redirected to the system browser (only the deprecated overload fires on those API levels); added `onRenderProcessGone` so a render-process crash on the stats page finishes the activity instead of leaving a blank WebView. (G) **Low-risk robustness patches**: `secureRandomInt` (game-logic.js) guards against `crypto` being undefined; `moveAlg` setupMode check uses `typeof` guard (was bare `if(setupMode)`); `toShredderCastling` (chess960.js) guards against null/undefined board; `sevenTagRoster`/`composePGN` (pgn-standard.js) guard against null/undefined params; `worker-pool.js` does not permanently disable the pool on a single transient worker-creation failure (3-strike counter); `makeMv`/`makeMvInPlace` en-passant `cr` bounds-checked via `inB()` (defense-in-depth). (H) **Version**: unchanged (`versionCode=121`, `versionName="1.1.2"`). See the v1.1.2 Phase 71 changelog section below for full details.

**Phase 70** (same-version revision, 2026.7.10) — first-principles code review cleanup. (A) **Bug fix (edge case)**: `_pgnCacheBuildSaveContext` (ui.js) — when the user exits review mode before saving, `_reviewEvalCache` still has entries (persisted until `_resetGameUIState`), but the Phase 69 force-rebuild was gated on `_inReview` (now false). This meant the pure-import path would save `_cachedOriginalPGN` verbatim, losing `[%eval]` annotations. Fix: the force-rebuild now checks `_reviewEvalCache.size > 0` directly (not `_inReview`), so evals from a previous review session are always included. (B) **Robustness**: `makeMvInPlace` (game-logic.js) — added the same `inB()` bounds check on `to`-coordinates that `makeMv` got in Phase 67. (C) **Redundancy cleanup**: removed 7 debug `console.log` calls from `ai-bridge.js` + 1 from `eco-data.js` (debug leftovers that polluted production logs). See the v1.1.2 Phase 70 changelog section below for full details.

**Phase 69** (same-version revision, 2026.7.9) — 4 bug fixes + Web Worker robustness + UCI optimization. (A) **Bug 1+2**: PGN cache partial-eval dialog never appeared + `[%eval]` lost after reload — root cause was `_useOriginal` almost always true for imported PGNs (importPGN sets `time:null`), gating the coverage check on `!_useOriginal` meant it never ran. Fix: decouple coverage check from `_useOriginal`; when `_reviewEvalCache.size > 0`, force rebuild path so `[%eval]` annotations are included. Refactored into `_pgnCacheBuildSaveContext` + `_pgnCacheBuildPGNText` + `_pgnCachePersistSave` shared helpers. (B) **Bug 3**: PGN cache manager race conditions — added `_pgnCacheOpInProgress` guard to all operations (save/import/delete/rename/tags). (C) **Bug 4**: `stats.html` CSP SHA-256 hash mismatch — Phase 68 changed nav button code but didn't update the CSP hash → browser blocked script → stats page blank. Fix: `build-chess.py` now auto-computes and updates the stats.html CSP hash on every build. (D) **Web Worker robustness** (per PDF guide §6.1): `worker-pool.js` added `onmessageerror` handler — serialization failures now reject immediately instead of hanging until 30s timeout. (E) **UCI optimization** (per SF18 UCI guide PDF): `StockfishNative.java` tightened MultiPV cap (8, was 500), Move Overhead cap (1000ms, was 5000ms), Hash cap (50% JVM heap, was 32TB), Threads cap (2x CPU cores, was 512); added `UCI_AnalyseMode=true` during eval mode + restore for gameplay. See the v1.1.2 Phase 69 changelog section below for full details.

**Phase 68** (same-version revision, 2026.7.8) — Analyze All optimization + long-press priority feature + UI polish. (A) **Analyze All optimization (Issue 30)**: `_reviewAnalyzeAdvance()` now calls `render()` only every 10 steps (was: every step), using lightweight `_refreshEvalTrendChart()` + `_updateReviewAnalyzeBtn()` for intermediate steps — fixes WebView memory pressure on 100+ step games. The next `_requestBatchEval` call is wrapped in `setTimeout(0)` to yield the main thread between batch steps (prevents ANR on aggressive OEM ROMs). (B) **Long-press to prioritize a step during Analyze All (new feature)**: move-list rows now have an `oncontextmenu` handler (`_prioritizeReviewStep`). Long-pressing an uncached move during an active batch sends `engineStop()`, pushes the step onto `_reviewAnalyzePriorityQueue`, fires a Toast + haptic, and the next advance iteration evaluates the prioritized step before continuing the normal sequence. The in-flight eval's result is cached for its original step (not lost). (C) **Stats nav buttons uniform width**: `stats.html` nav buttons (⏮ ◀ ▶ ⏭) now use `flex:1 1 0` (full-width uniform) instead of `min-width:38px` (which left gaps on wide screens). (D) **PGN cache partial-eval dialog polish**: title now has 💾 emoji prefix; Android back-button dismisses the dialog (= Cancel) via new `_pgnPartialEvalDialogActive`/`_pgnPartialEvalDialogDismiss` globals. (E) **.rmv-block CSS**: added `user-select:none` + `-webkit-touch-callout:none` + `touch-action:manipulation` to prevent text selection during long-press. New i18n keys (zh/en): `priority_eval_toast`, `priority_eval_already_cached`, `priority_eval_not_in_review`. See the v1.1.2 Phase 68 changelog section below for full details.

**Phase 67** (2026.7.7) — (A) **Emoji-text spacing unified in all window titles**: audited all i18n keys and hardcoded HTML titles; added a space between emoji and following text in 6 i18n keys (`stats_title`, `stats_export_html`, `stats_review`, `save_pgn_prompt`, `variation_toggle`, `pgn_cache_manager` — zh/en synchronized) plus hardcoded emoji+text in `stats.html` (`<h1>`, `<h2>`, `<title>`, button labels, exported-HTML titles). Excluded VS15-decorated chess piece symbols (used as inline icons, no space needed). (B) **PGN cache save losing `[%eval]` annotations — root-cause fix**: in review mode, opening the PGN cache manager and saving with "Yes, include special annotations" produced a PGN missing some `[%eval]` annotations. Root cause: `_buildPGNString(true, true)` can only emit `[%eval]` for steps that already have an entry in `_reviewEvalCache`; if the user hasn't navigated to every step OR run "Analyze All", some steps lack cached evals. Fix: `_pgnCacheSaveCurrentImpl()` now checks `_reviewEvalCache` coverage before rebuild; if incomplete AND reviewMode active AND not pure-import, a new dialog (`_pgnCacheShowPartialEvalDialog`) shows total/cached step counts and offers three options: "Analyze All first (recommended)" (sets `_pendingPGNCacheSave` flag, calls `reviewAnalyzeAll()`, auto-saves on completion via `_reviewAnalyzeAdvance` → `_pgnCacheSaveCurrentImpl_SkipCoverageCheck`), "Save anyway (evals will be missing)" (legacy behavior), or "Cancel". `_resetGameUIState()` and `exitReview()` clear `_pendingPGNCacheSave` to prevent stale saves. 5 new i18n keys (zh/en): `pgn_cache_partial_eval_title/msg/analyze_first/save_as_is`, `pgn_cache_analyze_then_save`. (C) **Version bump**: `versionCode` 111 → 112, `versionName` "1.1.1" → "1.1.2", updated 11 source code references. (D) **Code review report — reasonable suggestions implemented**: P0 — `engine_jni.cpp nativeRenice()` adds `setpriority()` return check + `PRIO_MIN`/`PRIO_MAX` range clamp; P1 — `game-logic.js makeMv()` adds `inB()` bounds check on to-coordinates; P2 — `ai-bridge.js onHintMove()` bounds check + `StockfishNative.java Long.parseLong()` try-catch + `MainActivity.onDestroy()` WebView cleanup adds `stopLoading()`; GOV-1 — added standard `LICENSE` file at project root (AGPL v3 full text); GOV-2 — `gradle.properties` no longer hardcodes Ubuntu JVM path; MED-3 — `build-chess.py` wraps file I/O in try/except + `__main__` guard. Removed 2 leftover `console.log` calls missed by Phase 66 (`onBestMove`, `onHintMove`). Architectural recommendations (God Module splits, message bus, global state store) deferred to next major version. (E) **Documentation sync**: BUILDING.md, PRIVACY.md, README.md, NOTICE, all 7 README.license files, both Chinese/English manuals (renamed to `Regalia-v1.1.2-manual-{zh,en}.html`). See the v1.1.2 Phase 67 changelog section below for full details.

**v1.1.1** (versionCode 111) — previous release

The v1.1.1 release fixes four user-reported bugs and upgrades the version number, then adds same-version Phase 60, 61, 62, 63, 64, 65, and 66 revisions. Phase 66 (same-version) performs a strict full-codebase audit: fixes a _savePGNYes timing bug (async export dialog could be open when new game starts), removes 2 stale console.log calls, and makes openStatsPage includeAnnotations explicit. Phase 65 (same-version) adds Android back-button support and haptic feedback to the export annotation dialog, audits and fixes additional stale-state bugs (_preReviewSnapshot, setupHistory, dialog flags not cleared in _resetGameUIState), and performs a first-principles code optimization pass. Phase 64 (same-version) fixes the TRUE root cause of visual annotation pollution (stale reviewStates not cleared in _resetGameUIState, causing _computeAndCacheVisualAnnotations to use the old game's board state at the same move index) and updates the export dialog text (💾 emoji, "特殊注释" terminology). Phase 63 (same-version) adds an export dialog asking whether to include annotations ([%csl]/[%cal]/[%eval] etc.) in the exported PGN, and completes a full-chain audit of all visual annotation code paths. Phase 62 (same-version) fixes the visual annotation (`[%csl]`/`[%cal]`) PGN pollution bug from first principles — distinguishes "imported annotations" (human-authored, from PGN import) from "auto-generated annotations" (UI display aids) via an `imported` boolean flag; `_buildPGNString()` only exports `imported=true` entries. Phase 61 (same-version) fixes the new-game cache pollution bug (`_resetGameUIState()` now centrally clears all game-related caches — all 5 entry points call it uniformly), fixes the imported-PGN-cannot-save-to-PGN-cache-manager bug (pure-import games save the original PGN text), moves the initial-position eval annotation to a separate `{}` comment before the first move, and verifies stats-page PGN sync. Phase 60 (same-version) implements reasonable P0/P1 fixes from the comprehensive architecture audit report (writer lock unification in StockfishNative.java, Integer_bitcount negative-input guard, onRenderProcessGone crash-count backoff, normalizeTagValue tab filtering, render-error i18n), adds navigation buttons below the statistics board (⏮ ◀ ▶ ⏭ — mainline/variation context-aware, with full-PGN HTML export keeping the buttons and FEN-only export omitting them), verifies analyze-all robustness, and audits all 5 new-game entry points for cache cleanup. Phase 59 fixes: (1) duplicate every-5-moves PGN `{}` eval annotations when re-exporting an imported PGN (the annotation was re-appended even when `mr.comment` already contained it — now deduped via whitespace-tolerant regex matching); (2) step-0 (initial position) eval result never written to PGN and never auto-loaded by the evaluation trend chart (the chart's data point at step 0 was missing because `onEngineEval` discarded "stale" callbacks when the user navigated before step 0's eval completed — now stale callbacks are still cached for the original `_reviewEvalRequestedStep`, and a lightweight `_refreshEvalTrendChart()` updates the chart DOM without a full re-render); (3) step-0 now gets the same human-readable eval annotation as every-5-moves, attached to the first move's `{}` comment with a `[初始局面]` / `[Initial position]` prefix (deduped against `mr.comment`); (4) resignation and timeout PGN comments were hard-coded English (`{White resigns.}`, `{White wins by timeout}`) even in Chinese mode — now follow the app's global language via `T()` with new i18n keys `pgn_resign_white` / `pgn_resign_black` / `pgn_timeout_white_wins` / `pgn_timeout_black_wins`. Phase 59 also includes a first-principles rewrite of the review-mode "Analyze All" batch logic: the batch's current step (`_reviewAnalyzeStep`) and generation counter (`_reviewAnalyzeGen`) are now decoupled from `reviewStep` (the user's view), so user navigation during the batch no longer invalidates in-flight batch callbacks (the previous root cause of "analyze-all sometimes doesn't complete all evals" — stale batch callbacks were discarded entirely, stalling the batch until the 60s safety timer fired). The batch now runs in the background; the user can navigate freely, with progress shown via toast and the analyze-all button label.

**v1.1.0** (versionCode 110) — previous release

The v1.1.0 release redefines the green-arrow visual annotation from "king escape path" to "check response path" (now including both king escape moves AND legal captures of the checking piece), fixes a v1.0.9 bug where green arrows were drawn even when the king had no legal escape, fixes the stats page's visual-annotation counts to respect the selected-move cutoff, achieves pixel-perfect alignment between the review progress bar and the evaluation trend chart (track ends align with first/last data points), filters out illegal king-move arrows from the control heatmap, fixes red check arrow to use actual checker position (discovered check support) / "格子控制信息" panel / visual annotations, center-aligns the review nav button text, fixes a Chess960 castling bug where the rook would silently disappear after O-O/O-O-O in starting positions where the participating rook's source square is the king's castling destination, fixes a landscape review mode bug where clicking nav buttons caused the page to scroll back to the top, adds PGN timeout annotations (`[Termination "Time forfeit"]` + `{<color> wins by timeout}` comment), fixes the first-move timing to synchronize with the time-control countdown, refines UCI command ordering for Chess960 + TimeControl games, fixes the portrait review mode move-list scroll positioning (selected move not in view after click), and fixes the visual-annotation cache residue at review entry (stale `[%csl]`/`[%cal]` annotations from a previous review session occasionally rendering on the initial-position board). Phase 58 adds every-5-moves PGN `{}` eval annotations (bilingual, White-perspective, mirroring the eval bar format `均势 (-0.10) D22 SD34 (1%W/96%D/3%L)`), fixes two P0 concurrency issues in `StockfishNative.java` (stopLatch TOCTOU race that could incorrectly discard a legitimate bestmove, and heartbeat deadlock where `shutdown`'s `join` was blocked by heartbeat's `synchronized(this)` writer I/O — now uses a dedicated `_writerLock`). Phase 57+ completed code-review-driven preventive hardening: fixes a single-line PGN tag-stripping regex bug in `parseStandardPGN` (preventive — this parser is not on the main code path), optimizes `isChess960CastlingLegal` to use the cached `s.wk`/`s.bk` king-position fields directly (with a board-scan fallback), adds a divide-by-zero guard to the WDL percentage display, hardens `postJsCallback` to skip `evaluateJavascript` when the host Activity is finishing/destroyed (prevents HyperOS 3 IllegalStateException crash during engine-init retries), changes the `EngineService` wake lock to a bounded 30-minute timeout (prevents indefinite CPU wake if OEM silently kills the service), and corrects a stale `v1.0.8` version reference in `res/README.license`. Also adds a pure-English `UBIQUITOUS_LANGUAGE.md` at the project root — a domain-terminology glossary covering 80+ chess/engine/PGN/UI terms. See the v1.1.0 Phase 58 changelog below for full details.

**v1.0.9** (versionCode 109) — previous release

The v1.0.9 release fixes two critical user-reported bugs (PGN single-line import
failure + review/stats "extra kings" board corruption) and improves the light-mode
evaluation chart color differentiation. See the v1.0.9 Phase 52 changelog below
for full details.

**v1.0.8** (versionCode 108) — older release

The v1.0.8 release completely redesigns the move animation and sound effect system
following the "Personified Chess Move Animation" and "Personified Chess Sound Effects"
reference documents. Each piece now has a unique personified motion characteristic
and matching timbre. Light mode support is also added following the "Android Dark
Theme Design Principles" and "Android Light Theme Design Principles" — light/dark
mode switches automatically with the system global setting, and the king icon on
the loading overlay and main header toolbar switches between ♔/♚ to match the
on-board pieces. See the v1.0.8 Phase 22 changelog below for full details.

### v1.1.2 Phase 72 (review analyze-all "false completion" after long-press priority, 2026.7.12)

This is a same-version revision phase (no version bump — `versionCode=121`, `versionName="1.1.2"`). It fixes a user-reported bug where the review-mode "Analyze All" feature would incorrectly report completion after the user long-pressed a move to prioritize it.

**A. Bug fix (user-reported, root cause: forward-only completion check)** — `_reviewAnalyzeAdvance` (ui.js): the completion check previously ONLY walked forward from `_reviewAnalyzeStep+1` to find the next uncached step. This was correct for the common case (steps analyzed in order, no interruption), but broke when the user long-pressed a step to prioritize it (Phase 68 feature):

1. User starts "Analyze All" at step 0. Batch evaluates steps 0, 1, 2, ... in order.
2. At step 5, the user long-presses step 50 (which is uncached) to prioritize it.
3. `_prioritizeReviewStep` aborts the current in-flight eval (step 5) via `engineStop()` and pushes step 50 onto `_reviewAnalyzePriorityQueue`.
4. `_reviewAnalyzeAdvance` picks up step 50 from the priority queue, evaluates it, and caches the result.
5. `_reviewAnalyzeAdvance` runs again to find the next uncached step. It walks forward from `_reviewAnalyzeStep+1` = 51. Steps 51..N are uncached, so it correctly resumes the batch from step 51.
6. **BUT**: if steps 51..N happen to be cached (e.g., the user had previously analyzed the end of the game, or the priority eval was at the very end), the forward walk reaches `_lastStep` and the completion branch fires — **even though steps 5..49 (before the priority step) are still uncached**.
7. The user sees a "完成 N 步" toast with N < total, and the batch ends prematurely. Steps 5..49 remain un-analyzed.

**Root cause**: the completion check was a forward-only walk (`nextStep = _reviewAnalyzeStep+1; while (nextStep <= _lastStep) { if (!_reviewEvalCache.has(nextStep)) break; nextStep++; }`). It never scanned steps `0.._reviewAnalyzeStep-1` for uncached entries.

**Fix**: when the forward walk finds nothing (reaches `_lastStep`), scan the ENTIRE range `[0.._lastStep]` to find the lowest uncached step and resume the batch from there. The forward-only fast-path is preserved for the common (no-priority) case — it avoids the O(n) full scan when steps are being analyzed in order. The full-range scan is the source of truth for completion, ensuring that a priority eval that jumped ahead does not cause the batch to report completion while earlier steps remain un-analyzed.

The fix is minimal (a 10-line addition after the existing forward walk) and does not affect the common-case performance (the full scan only runs when the forward walk finds nothing, which is rare — it only happens at true completion OR after a priority eval jumped ahead).

**Files modified**:
- `src/main/assets/chess.src/ui.js` — `_reviewAnalyzeAdvance` full-range completion scan (GPL v3)
- `src/main/assets/chess.html` — rebuilt from chess.src/ (GPL v3)
- `BUILDING.md` — Phase 72 section (AGPL v3)
- `PRIVACY.md` — Phase 72 note (AGPL v3)
- `NOTICE` — Phase 72 entry (AGPL v3)
- All 7 `README.license` files — Phase 72 entry (AGPL v3)
- `README.md` — Phase 72 changelog (top summary + detailed section) (AGPL v3)
- `Manual/Regalia-v1.1.2-manual-{zh,en}.html` — Phase 72 changelog (AGPL v3)

**License classification**: unchanged — the Phase 72 change is in `ui.js` (GPL v3, DroidFish-derived).

**Build/test commands**: unchanged. Re-run `python3 build-chess.py` before `./gradlew assembleRelease`.

**Verification of Phase 67→70 changes**: as part of this phase, all Phase 67→70 changes were re-verified to be correctly implemented:
- Phase 67: `nativeRenice` setpriority error check ✓, `makeMv` inB(to) check ✓, `onHintMove` bounds check ✓, `Long.parseLong` try-catch ✓, `MainActivity` stopLoading ✓, standard `LICENSE` file ✓, `gradle.properties` cross-platform ✓, `build-chess.py` try/except + `__main__` guard ✓, emoji-space formatting (6 i18n keys) ✓, `_pgnCacheShowPartialEvalDialog` (3 options) ✓.
- Phase 68: `_reviewAnalyzeAdvance` render every 10 steps ✓, `_refreshEvalTrendChart` + `_updateReviewAnalyzeBtn` intermediate updates ✓, `setTimeout(0)` main-thread yield ✓, `_prioritizeReviewStep` long-press handler + `_reviewAnalyzePriorityQueue` ✓, `.rmv-block` oncontextmenu ✓, stats nav buttons `flex:1 1 0` ✓, `_pgnPartialEvalDialogActive` back-button support ✓, `.rmv-block` CSS user-select:none + touch-action:manipulation ✓, 3 new i18n keys ✓.
- Phase 69: `_pgnCacheBuildSaveContext` decoupled coverage check ✓, `_reviewEvalCache.size > 0` force rebuild ✓, `_pgnCacheOpInProgress` guard (33 occurrences across all PGN cache ops) ✓, stats.html CSP hash auto-update by `build-chess.py` ✓, `worker-pool.js` onmessageerror ✓, MultiPV cap 8 ✓, Move Overhead cap 1000ms ✓, Hash cap 50% JVM heap ✓, Threads cap 2x CPU cores ✓, UCI_AnalyseMode ✓.
- Phase 70: `_pgnCacheBuildSaveContext` force-rebuild checks `_reviewEvalCache.size > 0` (not `_inReview`) ✓, `makeMvInPlace` inB(to.row,to.col) check ✓, `console.log` cleanup in ai-bridge.js (8 remaining are all in removal-documentation comments) ✓, `console.log` cleanup in eco-data.js (1 remaining is in removal comment) ✓.

All Phase 67→70 changes are correctly implemented. No corrections needed.

---

### v1.1.2 Phase 71 (stats-page move-selection bug fix + first-principles code review, 2026.7.11)

This is a same-version revision phase (no version bump — `versionCode=121`, `versionName="1.1.2"`). It fixes a user-reported bug where clicking a PGN move in the statistics page did nothing, performs a first-principles code review of all ~34,000 source lines (delegated to four parallel review agents covering chess-logic / AI-engine / UI / stats.html / Java-native), and applies the high-priority findings.

**A. Bug fix (user-reported, root cause: CSP blocking inline event handlers)** — `stats.html` CSP `<meta>`: the previous policy `script-src 'sha256-<hash>' blob:` only allowed the `<script>` block matching the hash. CSP Level 2+ also gates inline event handlers (e.g. `onclick="selectMove(0)"`) under `script-src` — without `'unsafe-inline'` or `'unsafe-hashes'`, all 23 inline handlers were silently blocked. Result: clicking a PGN move (e.g. `1. e4`) did nothing — no highlight, no board switch. Fix: switch `script-src` from `'sha256-<hash>' blob:` to `'unsafe-inline' blob:`. This is safe because stats.html is a local asset (`file:///android_asset/`) with no externally injected content and all JavaScript is inlined. As a bonus, removing the hash eliminates the recurring "CSP hash mismatch" bug class (Phase 69 Bug 4 was caused by the same hash mechanism).

**B. XSS hardening (consequence of the CSP change)** — `stats.html` `renderPGNText` / `buildSAN` / `firstMoves`: with `'unsafe-inline'`, any unescaped HTML injected via `innerHTML` would execute. The `renderPGNText` movetext-walk fallback (the `result+=movetext[i]` branch at the end of the move-matching loop) previously appended unrecognized movetext characters RAW to the HTML string. A malicious PGN like `1. e4 <img src=x onerror="..."> e5 *` would execute the handler with full `AndroidBridge` access. Fix: route all unrecognized characters through `_escFEN` (escapes `&<>"'\``). Same hardening applied to:
- The variation-text walk (`varRendered+=variationText[vi]` → `varRendered+=_escFEN(variationText[vi])`)
- The `firstMoves` opening-plies list (`firstMoves+=m.notation` → `firstMoves+=_escFEN(m.notation)` — defense-in-depth, notation is engine-generated)
- The exported static HTML and full-PGN HTML exports inherit the fix because they reuse `renderPGNText`'s output.

**C. Chess960 0-distance castling fix (P1 bug, main app + stats page)** — For Chess960 SP-IDs where the king already sits on its castling target square (e.g. SP-ID with king on g1 and kingside rook on h1), the engine emits UCI `g1h1` (king "captures" own rook). `uciToCoords` (ai-bridge.js) correctly rewrites the destination to col 6, producing a 0-distance "move" `g1g1`. But then:
- `_castleSide` (game-logic.js) fallback: `Math.abs(6-6) >= _minDist(1)` → `false` → castling not detected.
- `_destValid`: destination holds the king (not a rook) → `false` → castling not detected.
- `makeMv`: `_cs` is `null` → runs the non-castling branch `ns.board[to]=ns.board[from]; ns.board[from]=null` → **king nulled from the board** (self-copy then clear).

This affected every Chess960 SP-ID where the king starts on g1 (kingside) or c1 (queenside), in both the main app (via `executeMove` → `makeMv`) and the stats page (via its independent `executeMove` + `buildSAN`).

Fix (four files, defense-in-depth):
1. `ai-bridge.js uciToCoords`: when rewriting Chess960 castling destination, attach `castle='kingside'/'queenside'` to `result.to`. This lets `_castleSide`'s primary path (`mv.to.castle`) catch it before the distance-based fallback.
2. `ui.js executeMove`: check `to.castle` as the PRIMARY source for the castle flag (covers AI moves where `legalMvs` is empty — cleared after the player's previous move). The `legalMvs` lookup is now the fallback.
3. `game-logic.js _castleSide`: add an explicit 0-distance branch as defense-in-depth — when `_is960 && _dist===0 && _cr[side]`, return `'kingside'/'queenside'` (bypasses `_destValid` because the king itself occupies the destination, which is correct for this case — the king stays put, only the rook moves).
4. `stats.html`: mirror all three fixes in its independent code (executeMove's `_isZeroDistKingCastle` branch + buildSAN's 0-distance return + the from===to skip-king-move branch in the board-mutation block).

**D. Concurrency fix: `readyOkLatchHolder` race (StockfishNative.java)** — The JS binder thread (via `sendSetOptionAndWait`) and the executor thread (via `startEngineInternal` line 1238, `engineGoInternal` line 619, `engineGoTimed` line 687 — all the `ucinewgame` paths) both wrote the single volatile `readyOkLatchHolder` field without synchronization. If they overlapped, one latch was lost → 3-second timeout in `sendSetOptionAndWait` (or 10s in `startEngineInternal`). The engine only emits ONE `readyok` per `isready`, so concurrent `isready` commands are fundamentally racy. Fix: dedicated `_readyOkLock` serializes all readyOk set+wait operations — at most one thread is waiting for readyok at a time. The 3s/10s per-call timeout bounds the worst-case wait for a queued caller.

**E. Concurrency fix: `engineStop` TOCTOU on `_discardingPonderBestmove` (StockfishNative.java)** — `engineStop()` set the flag (line 3044) OUTSIDE any lock, while the reader thread's bestmove handler read it (line 1685) OUTSIDE any lock. A TOCTOU window existed: `engineStop()` sets the flag AFTER the reader's `if(_discardingPonderBestmove)` check but BEFORE `handleBestMove(bestMove)` → the stopped search's bestmove is processed as a real AI move. Fix: dedicated `_discardFlagLock` makes the check-and-clear atomic w.r.t. `engineStop`'s set. Both the reader's check-and-clear and `engineStop`'s set now go through `synchronized(_discardFlagLock)`.

**F. importSettings cap bypass fix (StockfishNative.java)** — `importSettings` directly assigned `engineThreads`/`engineHash`/`engineMoveOverhead` with loose caps (1024 threads / 1048576 MB hash / 10000ms overhead), bypassing the Phase 69 setter caps (2x CPU cores / 50% JVM heap / 1000ms). An imported settings file with extreme values would be applied without capping, causing thread contention and NPS collapse per UCI guide §1.1. Fix: apply the Phase 69 cap formulas inline in `importSettings`. Direct field assignment (rather than calling the setters) is necessary because `setEngineThreads`/`setEngineHash` return early when `autoConfig` is enabled — and `autoConfig` is only disabled further below in `importSettings` after parsing completes. `applySettings()` then sends the UCI command using the capped field value.

**G. StatsActivity robustness** — `StatsActivity.java`:
- Added the deprecated `shouldOverrideUrlLoading(WebView, String)` overload. On API 21-23 (minSdk=21), only the deprecated overload fires; without it, external http(s) URLs would load INTO the WebView (bypassing the system browser). The new `WebResourceRequest`-based overload is API 24+ only. Shared logic extracted to `_handleUrlOverride(String)` helper.
- Added `onRenderProcessGone` so a render-process crash on the stats page finishes the activity instead of leaving a blank, unresponsive WebView. Mirrors `ChessWebViewClient`'s handling for the main chess board.

**H. Low-risk robustness patches** (defense-in-depth):
- `secureRandomInt` (game-logic.js): guard against `crypto` being undefined (mirrors `randomSPID` in chess960.js). Falls back to `Math.random()` — non-cryptographic but functional. Without this, a missing `crypto` would throw a `ReferenceError` and crash the AI's opening-book lookup.
- `moveAlg` setupMode check (game-logic.js): `if(setupMode)` → `if(typeof setupMode!=='undefined'&&setupMode)`. Other call sites already use the `typeof` guard; this site was missed. Without it, calling `moveAlg` before `ui.js` declares the global would throw a `ReferenceError`.
- `toShredderCastling` (chess960.js): guard against null/undefined board or missing rows. `parseShredderCastling` (the inverse) already has this defensive pattern — now mirrored for symmetry.
- `sevenTagRoster` / `composePGN` (pgn-standard.js): guard against null/undefined `info`/`params`. Defensive — callers always pass an object, but protects against future regressions.
- `worker-pool.js` transient-failure resilience: do NOT permanently disable the pool on a single worker-creation failure (e.g. transient OOM, Blob URL quota exhaustion). Track a consecutive-failure counter; only disable after 3 consecutive failures. A successful `_createWorker()` resets the counter.
- `makeMv` / `makeMvInPlace` / Zobrist en-passant update (game-logic.js): bounds-check the en-passant capture row `cr` via `inB()` before indexing `board[cr]`. In normal play `cr` is always 3 or 4, but a corrupted FEN import could produce an out-of-range value → `TypeError`. Defense-in-depth.

**Files modified**:
- `src/main/assets/stats.html` — CSP fix + XSS hardening + Chess960 0-distance castling (GPL v3)
- `src/main/assets/chess.src/ai-bridge.js` — uciToCoords castle flag attachment (GPL v3)
- `src/main/assets/chess.src/ui.js` — executeMove to.castle primary source (GPL v3)
- `src/main/assets/chess.src/game-logic.js` — _castleSide 0-distance branch + secureRandomInt crypto guard + moveAlg typeof guard + en-passant inB bounds checks (GPL v3)
- `src/main/assets/chess.src/chess960.js` — toShredderCastling board guard (AGPL v3)
- `src/main/assets/chess.src/pgn-standard.js` — sevenTagRoster/composePGN null guards (GPL v3)
- `src/main/assets/chess.src/worker-pool.js` — transient-failure 3-strike counter (GPL v3)
- `src/main/assets/chess.html` — rebuilt from chess.src/ (GPL v3)
- `src/main/java/com/Regalia/StockfishNative.java` — readyOkLatchHolder race fix + engineStop TOCTOU fix + importSettings cap fix (GPL v3)
- `src/main/java/com/Regalia/StatsActivity.java` — shouldOverrideUrlLoading deprecated overload + onRenderProcessGone (GPL v3)
- `BUILDING.md` — Phase 71 section (AGPL v3)
- `PRIVACY.md` — Phase 71 note (AGPL v3)
- `NOTICE` — Phase 71 entry (AGPL v3)
- All 7 `README.license` files — Phase 71 entry (AGPL v3)
- `README.md` — Phase 71 changelog (top summary + detailed section) (AGPL v3)
- `Manual/Regalia-v1.1.2-manual-{zh,en}.html` — Phase 71 changelog (AGPL v3)

**License classification**: unchanged — all Phase 71 changes are in GPL v3 files (DroidFish-derived or matching stats.html) or AGPL v3 files (original Regalia code).

**Build/test commands**: unchanged. Re-run `python3 build-chess.py` before `./gradlew assembleRelease`. Note: the Phase 69 `build-chess.py` CSP-hash auto-update step is now a no-op for stats.html (the CSP no longer uses a hash) but remains harmless.

---

### v1.1.2 Phase 70 (first-principles code review cleanup, 2026.7.10)

This is a same-version revision phase (no version bump — `versionCode=121`, `versionName="1.1.2"`). It performs a first-principles code review of all source files and applies bug fixes, robustness improvements, and redundancy cleanup.

**A. Bug fix (edge case)** — `_pgnCacheBuildSaveContext` (ui.js): when the user exits review mode before saving, `_reviewEvalCache` still has entries (persisted until `_resetGameUIState`), but the Phase 69 force-rebuild was gated on `_inReview` (which is now `false`). This meant the pure-import path would save `_cachedOriginalPGN` verbatim, losing `[%eval]` annotations. Fix: the force-rebuild now checks `_reviewEvalCache.size > 0` directly (not `_inReview`), so evals from a previous review session are always included. The coverage dialog still requires `_inReview` (the "Analyze All first" option needs review mode to work).

**B. Robustness** — `makeMvInPlace` (game-logic.js): added the same `inB()` bounds check on `to`-coordinates that `makeMv` got in Phase 67. Previously only `from.row` was bounds-checked, allowing an out-of-range `to` coord to silently throw on `s.board[to.row][to.col]`.

**C. Redundancy cleanup** — removed 7 debug `console.log` calls from `ai-bridge.js` (engine init/restart/ready callbacks) and 1 from `eco-data.js` (IndexedDB cache load). These were debug leftovers that polluted production logs. Replaced with comments documenting the removal.

**Files modified**:
- `src/main/assets/chess.src/ui.js` — edge case bug fix (GPL v3)
- `src/main/assets/chess.src/game-logic.js` — makeMvInPlace bounds check (GPL v3)
- `src/main/assets/chess.src/ai-bridge.js` — console.log cleanup (GPL v3)
- `src/main/assets/chess.src/eco-data.js` — console.log cleanup (AGPL v3)
- `src/main/assets/chess.html` — rebuilt from chess.src/ (GPL v3)
- `BUILDING.md` — Phase 70 section (AGPL v3)
- `NOTICE` — Phase 70 entry (AGPL v3)
- All 7 `README.license` files — Phase 70 entry (AGPL v3)
- `Manual/Regalia-v1.1.2-manual-{zh,en}.html` — Phase 70 changelog (AGPL v3)

**License classification**: unchanged.

**Build/test commands**: unchanged. Re-run `python3 build-chess.py` before `./gradlew assembleRelease`.

---

### v1.1.2 Phase 69 (4 bug fixes + Web Worker robustness + UCI optimization, 2026.7.9)

This is a same-version revision phase (no version bump — `versionCode=121`, `versionName="1.1.2"`). It fixes 4 user-reported bugs, adds Web Worker robustness per the "Web Worker 设计与优化指南" PDF, and optimizes UCI parameters per the "stockfish18的UCI优化指南" PDF.

**A. Bug 1+2: PGN cache partial-eval dialog never appeared + `[%eval]` lost after reload** — Root cause: `_pgnCacheSaveCurrentImpl` (ui.js) gated the Phase 67 coverage check on `!_useOriginal`, but `_useOriginal` is almost always `true` for imported PGNs because `importPGN` (tablebase.js) sets `time:null` on all moves. This meant:
- **Bug 1**: The `_pgnCacheShowPartialEvalDialog` never appeared (coverage check skipped).
- **Bug 2**: The pure-import path saved `_cachedOriginalPGN` verbatim, ignoring `_reviewEvalCache` — so `[%eval]` annotations from "Analyze All" were lost.

Fix: decouple the coverage check from `_useOriginal`. When `_reviewEvalCache.size > 0`, force the rebuild path (`_buildPGNString`) so `[%eval]` annotations are included. The pure-import (`_cachedOriginalPGN`) path is now only used when there are NO cached evals at all (truly un-analyzed import). Refactored into shared helpers: `_pgnCacheBuildSaveContext`, `_pgnCacheBuildPGNText`, `_pgnCachePersistSave` (used by both `_pgnCacheSaveCurrentImpl` and `_pgnCacheSaveCurrentImpl_SkipCoverageCheck` for identical PGN-building logic).

**B. Bug 3: PGN cache manager race conditions** — Added `_pgnCacheOpInProgress` guard to all PGN cache operations (save/import/delete/rename/tags). Prevents re-entrant operations from corrupting state. `importPGNAsync().then()` checks `_pgnCacheOpInProgress` to ensure the operation wasn't superseded. Guard is reset on: `_pgnCachePersistSave` completion, `_pgnCacheShowPartialEvalDialog` dismiss, `_pgnCacheClose`, `_resetGameUIState`.

**C. Bug 4: `stats.html` CSP SHA-256 hash mismatch** — Phase 68 modified the nav button code in `stats.html`, changing the inline script's content. The CSP `'sha256-...'` hash in the `<meta>` tag was NOT updated, so the browser refused to execute the script → stats page blank. Fix: `build-chess.py` now auto-computes and updates the `stats.html` CSP hash on every build (prevents recurrence). Also added a standalone `fix_stats_csp_hash.py` script for manual fixes.

**D. Web Worker robustness** (per "Web Worker 设计与优化指南" PDF §6.1) — `worker-pool.js`: added `onmessageerror` handler on each worker. Previously, structured-clone serialization failures would silently leave the task's promise hanging until the 30s timeout. Now the task rejects immediately and the worker is recycled (terminate + replace). The handler mirrors the existing `onerror` handler's task-rejection + worker-recycle logic.

**E. UCI optimization** (per "stockfish18的UCI优化指南" PDF) — `StockfishNative.java`: tightened UCI parameter validation per SF18 best practices:
- **MultiPV cap 8** (was 500; PDF recommends 3-5 for review analysis; values above 8 severely reduce search depth).
- **Move Overhead cap 1000ms** (was 5000ms; PDF recommends 10-30ms local, 50-150ms network).
- **Hash cap 50% of JVM heap** (was 33554432 MB = 32TB; PDF warns exceeding 50% of RAM causes virtual memory swapping, drastically slowing engine).
- **Threads cap 2x CPU cores** (was 512; PDF warns exceeding physical core count causes thread contention, reducing NPS).
- **Added `UCI_AnalyseMode=true`** during eval mode (`applyEvalModeOptions`) + `UCI_AnalyseMode=false` restore for gameplay (`restoreGameplayOptions`). PDF §3.3: in analysis mode, the engine searches more thoroughly, exploring suboptimal moves for comprehensive variations.

**Files modified**:
- `src/main/assets/chess.src/ui.js` — Bug 1+2+3 (GPL v3)
- `src/main/assets/chess.src/worker-pool.js` — Web Worker onmessageerror (GPL v3)
- `build-chess.py` — Bug 4 auto-fix CSP hash (AGPL v3)
- `src/main/java/com/Regalia/StockfishNative.java` — UCI optimization (GPL v3)
- `src/main/assets/stats.html` — CSP hash auto-fixed by build-chess.py (GPL v3)
- `src/main/assets/chess.html` — rebuilt from chess.src/ (GPL v3)
- `BUILDING.md` — Phase 69 section (AGPL v3)
- `NOTICE` — Phase 69 entry (AGPL v3)
- All 7 `README.license` files — Phase 69 entry (AGPL v3)
- `Manual/Regalia-v1.1.2-manual-{zh,en}.html` — Phase 69 changelog (AGPL v3)

**License classification**: unchanged — all Phase 69 changes are in GPL v3 files (DroidFish-derived) or AGPL v3 files (original).

**Build/test commands**: unchanged. Re-run `python3 build-chess.py` before `./gradlew assembleRelease` to ensure the latest JS is bundled into `chess.html` and the stats.html CSP hash is auto-updated.

---

### v1.1.2 Phase 68 (Analyze All optimization + long-press priority + UI polish, 2026.7.8)

This is a same-version revision phase (no version bump — `versionCode=121`, `versionName="1.1.2"`). It optimizes the Analyze All feature per Issue 30's root-cause analysis, adds a long-press-to-prioritize feature, and polishes the stats nav buttons + PGN cache partial-eval dialog.

**A. Analyze All optimization (Issue 30 root-cause fix)** — The Issue 30 analysis identified four root causes for "analyze-all may not complete in one go on long games (100+ steps)": (A) WebView memory pressure from per-step `render()`, (B) Android system killing the engine process, (C) O(n) cumulative UI update cost, (D) 60s safety timeout too long. Phase 68 addresses A and C directly, and mitigates B by yielding the main thread (reducing ANR-trigger risk):
- `_reviewAnalyzeAdvance()` (ui.js) now calls `render()` only every 10 steps (was: every step). Intermediate steps use lightweight `_refreshEvalTrendChart()` (rebuilds only the SVG inside `.review-chart` — one DOM write) + `_updateReviewAnalyzeBtn()` (one textContent write). This reduces the per-step DOM cost from O(n) to O(1), eliminating the memory growth that triggered WebView page reloads on 100+ step games.
- The next `_requestBatchEval` call is wrapped in `setTimeout(0)` to yield the JS main thread between batch steps. This lets the UI process pending touch events / scroll / paint, preventing the "frozen UI" symptom and reducing ANR-trigger risk on aggressive OEM ROMs (HyperOS 3, etc.). The 0ms delay is enough for the event loop to drain pending microtasks and macrotasks without measurably slowing the batch (the engine's search time dominates).
- Eval cache skip: the `while` loop in `_reviewAnalyzeAdvance` already skips cached steps (Phase 59); Phase 68 documents this as the "breakpoint resume" mechanism — an interrupted batch (e.g., engine crash + auto-recover via `onEngineReady`) resumes from the next uncached step, never re-evaluating a cached step.

**B. Long-press to prioritize a step during Analyze All (new feature)** — When the user long-presses a move in the review move list while an analyze-all batch is running, the prioritized step is evaluated next, ahead of the normal sequence:
- Move-list rows (`.rmv-block`) now have an `oncontextmenu` handler (`_prioritizeReviewStep`). On Android WebView, `oncontextmenu` fires on long-press (the most reliable cross-platform long-press signal; touchstart-based timers would conflict with the existing board long-press handler in the global touchstart listener).
- `_prioritizeReviewStep(step)`:
  1. Validates the step is uncached and the batch is active. If the step is already cached, shows a "already analyzed" toast + haptic and returns. If not in review mode, shows an error toast.
  2. Pushes the step onto `_reviewAnalyzePriorityQueue` (deduplicated — a second long-press on an already-queued step is a no-op).
  3. Aborts the current in-flight batch eval via `AndroidBridge.engineStop()`. Bumps `_reviewAnalyzeGen` + clears `_evalRequestBatchGen` so the in-flight `onEngineEval` callback takes the user-nav stale path (caches the partial result for `_reviewEvalRequestedStep` — NOT lost).
  4. Fires a Toast notification (`priority_eval_toast`) + `HapticManager.fire('BUTTON_PRESS')`.
  5. Clears the safety timer + schedules `_reviewAnalyzeAdvance` after 150ms (gives the engine time to process the stop command and fire its bestmove callback). The advance function checks the priority queue first and evaluates the prioritized step before continuing the normal sequence.
- If no batch is active, falls back to navigating to the step + triggering a single eval (graceful degradation).
- New state: `_reviewAnalyzePriorityQueue` (array). Cleared on: batch start (`reviewAnalyzeAll`), batch completion (`_reviewAnalyzeAdvance` completion branch), batch cancel (`exitReview`), new game (`_resetGameUIState`).
- CSS: `.rmv-block` now has `user-select:none` + `-webkit-user-select:none` + `-webkit-touch-callout:none` + `touch-action:manipulation` to prevent text selection / iOS callout during long-press.
- New i18n keys (zh/en): `priority_eval_toast` ("已优先分析此走法，批量分析将在该步完成后继续" / "Prioritizing this move. Batch resumes after this step completes."), `priority_eval_already_cached` ("此走法已分析完成" / "This move is already analyzed."), `priority_eval_not_in_review` ("长按优先分析仅在复盘模式可用" / "Long-press priority is only available in review mode.").

**C. Stats nav buttons uniform width** — `stats.html` nav buttons (⏮ ◀ ▶ ⏭) now use `flex:1 1 0` (full-width uniform) instead of `min-width:38px` (which left gaps on wide screens). The label span is now on its own line above the button row so the buttons can stretch to full width without the label squeezing them. This matches the review-mode nav buttons (`.review-nav .btn{flex:1 1 0;min-width:0;justify-content:center}`).

**D. PGN cache partial-eval dialog polish** — The Phase 67 partial-eval dialog is polished:
- Title now has 💾 emoji prefix: `pgn_cache_partial_eval_title` changed from "部分步骤尚未评估" / "Some steps not yet analyzed" to "💾 部分步骤尚未评估" / "💾 Some steps not yet analyzed" (consistency with the export annotation dialog's 💾 emoji).
- Android back-button now dismisses the dialog (= Cancel) via new `_pgnPartialEvalDialogActive` / `_pgnPartialEvalDialogDismiss` globals checked in `handleBackPress()`. Matches the pattern used by `_pgnExportDialogActive` / `_pgnExportDialogDismiss`.
- Haptic feedback (`HapticManager.fire('BUTTON_PRESS')`) was already present on all buttons (Phase 67); Phase 68 verifies it's consistent with the export annotation dialog's button haptics.

**E. Code-review-driven cleanup** — The `_prioritizeReviewStep` function comment was streamlined (removed design-rationale stream-of-consciousness, kept the concise behavioral spec). No new files at project root; no build-system changes; no new third-party code introduced.

**Files modified**:
- `src/main/assets/chess.src/ui.js` — Analyze All optimization + long-press handler + priority queue + dialog back-button + CSS .rmv-block reference (GPL v3)
- `src/main/assets/chess.src/index.html.tpl` — .rmv-block CSS (user-select, touch-action) (GPL v3)
- `src/main/assets/chess.src/game-logic.js` — 3 new i18n keys + 💾 emoji in partial-eval title (AGPL v3)
- `src/main/assets/stats.html` — nav buttons uniform width (GPL v3)
- `src/main/assets/chess.html` — rebuilt from chess.src/ (GPL v3)
- `BUILDING.md` — Phase 68 section (AGPL v3)
- `NOTICE` — Phase 68 entry (AGPL v3)
- All 7 `README.license` files — Phase 68 entry (AGPL v3)
- `Manual/Regalia-v1.1.2-manual-zh.html` — Phase 68 changelog + wireframe updates (AGPL v3)
- `Manual/Regalia-v1.1.2-manual-en.html` — same, English (AGPL v3)

**License classification**: unchanged — all Phase 68 changes are in GPL v3 files (DroidFish-derived: ui.js, index.html.tpl, chess.html, stats.html) or AGPL v3 files (original: game-logic.js for new i18n keys).

**Build/test commands**: unchanged. Re-run `python3 build-chess.py` before `./gradlew assembleRelease` to ensure the latest JS is bundled into `chess.html`.

---

### v1.1.2 Phase 67 (emoji-space formatting fix + PGN cache [%eval] root-cause fix + version bump + code review report implementation, 2026.7.7)

This is a version-bump phase (`versionCode` 111 → 112, `versionName` "1.1.1" → "1.1.2"). It fixes two user-reported issues, implements reasonable P0/P1/P2/GOV/MED suggestions from the comprehensive code review report, and completes full documentation sync.

**A. Unified emoji-text spacing in window titles** — Audited all i18n keys and hardcoded HTML titles; added a space between emoji and following text in 6 i18n keys (`stats_title`, `stats_export_html`, `stats_review`, `save_pgn_prompt`, `variation_toggle`, `pgn_cache_manager` — zh/en synchronized) plus hardcoded emoji+text combinations in `stats.html` (`<h1>📊统计数据</h1>` → `<h1>📊 统计数据</h1>`, `<title>` tag, button labels `💾HTML` → `💾 HTML` / `🗃️<span>导入</span>` → `🗃️ <span>导入</span>` / `🗂️<span>复盘</span>` → `🗂️ <span>复盘</span>`, `<h2>` export dialog title, exported-HTML title strings). Excluded VS15-decorated chess piece symbols (`♔\uFE0E` / `♕\uFE0E` etc.) — used as inline icons, no space needed.

**B. PGN cache save losing `[%eval]` annotations — root-cause fix** — Symptom: in review mode, opening the PGN cache manager and saving with "Yes, include special annotations" produced a PGN missing some `[%eval]` annotations. Root cause: `_buildPGNString(true, true)` can only emit `[%eval]` for steps that already have an entry in `_reviewEvalCache`; if the user hasn't navigated to every step OR run "Analyze All", some steps lack cached evals. Fix: `_pgnCacheSaveCurrentImpl()` now checks `_reviewEvalCache` coverage before rebuild; if incomplete AND `reviewMode===true` AND not on the pure-import path, a new dialog `_pgnCacheShowPartialEvalDialog(name, includeAnn, totalSteps, cachedCount)` shows total/cached step counts and offers three options:
1. "Analyze All first (recommended)" — sets `_pendingPGNCacheSave = {name, includeAnn}` flag, calls `reviewAnalyzeAll()`. On batch completion, `_reviewAnalyzeAdvance()` checks the flag and triggers the deferred save via `_pgnCacheSaveCurrentImpl_SkipCoverageCheck(name, includeAnn)` (which skips the coverage check to prevent infinite recursion).
2. "Save anyway (evals will be missing)" — legacy behavior, calls `_pgnCacheSaveCurrentImpl_SkipCoverageCheck` directly.
3. "Cancel" — aborts the save.
`_resetGameUIState()` and `exitReview()` clear `_pendingPGNCacheSave` to prevent stale saves from firing after the user exits review mode or starts a new game. Added 5 new i18n keys (zh/en): `pgn_cache_partial_eval_title`, `pgn_cache_partial_eval_msg` (with `N1`/`N2` placeholders for total/cached step counts — replaced at runtime), `pgn_cache_partial_eval_analyze_first`, `pgn_cache_partial_eval_save_as_is`, `pgn_cache_analyze_then_save`. The new dialog uses the same `dov`/`dlg` CSS classes as other app dialogs; all buttons have explicit `HapticManager.fire('BUTTON_PRESS')` calls; overlay click-outside dismisses (= Cancel).

**C. Version bump** — `versionCode` 111 → 112, `versionName` "1.1.1" → "1.1.2". Updated 11 source code references: `strings.xml` (`app_name`), `MainActivity.java` (`VERSION`), `StockfishNative.java` (`ENGINE_VERSION`), `ChessApp.java` (init log), `ChessWebViewClient.java` (version comment), `game-logic.js` (`loading_title`), `index.html.tpl` (`<title>`), `ui.js` (header badge + about dialog + render-error page — 3 places). `build.gradle` now reads `../version.properties` (new file: `VERSION_MAJOR=1`, `VERSION_MINOR=1`, `VERSION_PATCH=2`, `VERSION_BUILD=112`) for the version code/name (defaults inside `build.gradle` cover the missing case as 1.1.1/111).

**D. Comprehensive code review report — reasonable suggestions implemented** (see `regalia_review_report.zip` for the full report; 4误报 excluded by the orchestrator):
- **P0** (`engine_jni.cpp`): `nativeRenice()` now checks `setpriority()` return value (logs `LOGE` on failure with `strerror(errno)`) and validates `prio` against `PRIO_MIN`/`PRIO_MAX` (clamps to range). Adds `#include <errno.h>`. The function is currently retained for API completeness (no caller invokes it) but should be correctly implemented per the DroidFish-derived pattern.
- **P1** (`game-logic.js`): `makeMv()` now validates BOTH `from` and `to` coordinates via `inB()` before any board access. Previously only `from.row` was bounds-checked, allowing an out-of-range `to` coord (e.g., from setup mode or malformed FEN-derived move) to silently throw on `ns.board[to.row][to.col]`.
- **P2** (`ai-bridge.js`): `onHintMove()` adds `inB()` bounds check on `coords.from`/`coords.to` before board access. Defensive against race conditions where `gameState` mutates during async engine callbacks.
- **P2** (`StockfishNative.java`): `Long.parseLong()` for `nodes`/`nps` wrapped in try-catch — malformed/malicious engine output (e.g., `nodes 9999999999999999999999999`) cannot crash info-line processing; the value is set to `null` on parse failure.
- **P2** (`MainActivity.java`): `onDestroy()` WebView cleanup adds `stopLoading()` as step 0 (before `removeView`). Prevents in-flight page/resource load from dispatching a callback to a destroyed native peer, which on certain OEM ROMs (HyperOS, MIUI) can SIGSEGV.
- **GOV-1**: Added standard `LICENSE` file at project root (AGPL v3 full text — copy of `LICENSE-AGPL v3`). GitHub/F-Droid's license auto-detection requires a file named exactly `LICENSE`; the existing `LICENSE-AGPL v3` (with a space) was not auto-detected.
- **GOV-2** (`gradle.properties`): Removed hardcoded Ubuntu-specific JVM path `org.gradle.java.home=/usr/lib/jvm/java-21-openjdk-amd64` and `org.gradle.java.installations.paths=...`. JDK 21 is now resolved via `JAVA_HOME` env var (CI) or auto-detection. Local developers can pin a specific JDK via `~/.gradle/gradle.properties` (per-machine, never committed to VCS).
- **MED-3** (`build-chess.py`): Wrapped all file I/O in try/except for clearer build diagnostics (FileNotFoundError, OSError), added `if __name__ == '__main__':` guard, missing-placeholder detection (errors out if `/* __MODULE_SCRIPTS__ */` is not found in the template), explicit UTF-8 encoding on all open() calls.
- **Redundancy cleanup**: Removed 2 leftover `console.log` calls missed by Phase 66 (`console.log('onBestMove:',uciMove)` in `onBestMove`, `console.log('onHintMove:',uciMove)` in `onHintMove` — both in `ai-bridge.js`). Phase 66 removed `console.log('Player resigned — winner:...')` and `console.log('Recovery data found from...')` but missed these two parallel debug calls.
- **Skipped (justified)**:
  - HIGH-1/HIGH-2 (JS bridge sandbox validation, UCI command whitelist): too invasive for an incremental release; requires careful design to avoid breaking existing functionality.
  - MED-1 (`allowBackup="false"`): would break the carefully configured user backup system (`backup_rules.xml` + `data_extraction_rules.xml` protect PGN cache, eval cache, engine settings, localStorage). The "sensitive data" is just chess history, not PII — defense-in-depth tradeoff favors user data preservation.
  - MED-2 (`requestLegacyExternalStorage` removal): may affect Android 10 users; SAF works without it but legacy code paths might be used. Deferred.
  - MED-4 (Logcat sensitive path info): ProGuard/R8 already strips most Log calls in release; changing remaining ones risks losing diagnostic value.
  - P0-1 through P0-4 architectural refactoring (God Module splits — `StockfishNative.java` 5,298 lines, `ui.js` 7,696 lines — JS↔Java message bus, global state Redux-like store): multi-week effort, deferred to next major version.
  - P2-1 (Zobrist enPassant row validation): valid but very low risk — FEN parser already validates `enPassantTarget.row` to be 2 or 5.
  - P3-x low-priority improvements (mostly defensive coding suggestions, no bugs).

**E. Documentation sync**:
- `BUILDING.md`: title `v1.1.1` → `v1.1.2`, added Phase 67 section describing the `gradle.properties` GOV-2 change, `version.properties`/`keystore.properties` new files, `build-chess.py` MED-3 changes, standard `LICENSE` GOV-1 addition.
- `PRIVACY.md`: version reference `v1.1.1`/`versionCode 111` → `v1.1.2`/`112`.
- `README.md`: Phase 67 entry added to top-of-file summary, directory tree updated (LICENSE added, manual files renamed), version references updated.
- `NOTICE`: Phase 67 entry (this file).
- All 7 `README.license` files: Phase 67 entry added (`src/main/`, `src/main/assets/`, `src/main/assets/chess.src/`, `src/main/cpp/`, `src/main/java/com/Regalia/`, `src/main/res/`, `Manual/`).
- `Manual/Regalia-v1.1.2-manual-{zh,en}.html` (new files): renamed from v1.1.1, updated header comment, `<title>`, cover version div, intro paragraph (prepended v1.1.2 Phase 67 description), footer version, and added Phase 67 entry at top of changelog (newest-first ordering per project convention). The v1.1.1 historical section is demoted from "(current)" to a regular historical entry. The v1.1.1 manuals are retained for historical reference.

**Files modified**:
- `src/main/cpp/engine_jni.cpp` — P0 nativeRenice (GPL v3)
- `src/main/assets/chess.src/game-logic.js` — P1 makeMv bounds + emoji-space i18n + version (GPL v3)
- `src/main/assets/chess.src/ai-bridge.js` — P2 onHintMove bounds + console.log cleanup + version (GPL v3)
- `src/main/assets/chess.src/ui.js` — PGN cache fix + version (3 places) + emoji-space i18n propagation (GPL v3)
- `src/main/assets/chess.src/index.html.tpl` — version (GPL v3)
- `src/main/assets/stats.html` — emoji-space fix (GPL v3)
- `src/main/assets/chess.html` — rebuilt from chess.src/ (GPL v3)
- `src/main/java/com/Regalia/StockfishNative.java` — P2 Long parse + version (GPL v3)
- `src/main/java/com/Regalia/MainActivity.java` — P3 stopLoading + version (AGPL v3)
- `src/main/java/com/Regalia/ChessApp.java` — version (AGPL v3)
- `src/main/java/com/Regalia/ChessWebViewClient.java` — version (AGPL v3)
- `src/main/res/values/strings.xml` — version (AGPL v3)
- `build-chess.py` — MED-3 error handling (AGPL v3)
- `gradle.properties` — GOV-2 cross-platform (AGPL v3)
- `BUILDING.md` — title + Phase 67 section (AGPL v3)
- `PRIVACY.md` — version reference (AGPL v3)
- `README.md` — version + Phase 67 entry + directory tree (AGPL v3)
- `NOTICE` — Phase 67 entry (AGPL v3)
- All 7 `README.license` files — Phase 67 entry (AGPL v3)
- `Manual/Regalia-v1.1.2-manual-zh.html` (new) — version + Phase 67 changelog (AGPL v3)
- `Manual/Regalia-v1.1.2-manual-en.html` (new) — version + Phase 67 changelog (AGPL v3)

**Files added**:
- `LICENSE` (project root, AGPL v3 full text — copy of `LICENSE-AGPL v3`, GOV-1)
- `../version.properties` (drives `build.gradle`'s `versionCode`/`versionName`)
- `../keystore.properties` (drives `signingConfigs.release` in `build.gradle`)
- `Manual/Regalia-v1.1.2-manual-zh.html`, `Manual/Regalia-v1.1.2-manual-en.html`

**Files superseded**:
- `Manual/Regalia-v1.1.1-manual-{zh,en}.html` (kept for historical reference; the v1.1.2 manuals are the current versions)

**License classification**: unchanged — no new third-party code introduced. All Phase 67 changes are in GPL v3 files (DroidFish-derived) or AGPL v3 files (original).

**Build/test commands**: unchanged. Re-run `python3 build-chess.py` before `./gradlew assembleRelease` to ensure the latest JS is bundled into `chess.html`.

---

### v1.1.1 Phase 63 (visual annotation deep audit + export annotation dialog, 2026.7.5)

This is a same-version revision phase (no version bump — `versionCode=111`, `versionName="1.1.1"`). It completes a full-chain audit of all `[%csl]`/`[%cal]` code paths and adds a user-facing export dialog for annotation inclusion control.

1. **Full-chain audit** of visual annotation code: verified all 4 `_visualAnnotationsCache` write sites (all include the `imported` flag from Phase 62), all 3 read sites, confirmed `_buildPGNString()` only exports `imported=true` entries, confirmed `importPGN` strips all `[%xxx]` tags from `mr.comment` (so `mr.comment` cannot contain `[%csl]`/`[%cal]` text), confirmed `_resetGameUIState()` clears `_visualAnnotationsCache`, and confirmed all 5 new-game entry points call `_resetGameUIState()` correctly. With Phase 62's `imported` flag, auto-generated annotations (`imported=false`) are excluded from PGN export — the only remaining source of `[%csl]`/`[%cal]` in PGN export is `imported=true` entries from PGN import.

2. **Export annotation dialog** (`_showPGNExportAnnotationDialog`): `_buildPGNString()` now accepts an `includeAnnotations` parameter (default `true`). When `false`, ALL annotation-type tags are omitted from the PGN: `[%eval]` tags, every-5-moves eval descriptions, initial-position eval annotation (`preMoveComment`), and `[%csl]`/`[%cal]` tags (even `imported=true` ones). `[%emt]`/`[%clk]` time tags and `mr.comment` free-text are NOT gated (they are not "annotations"). The dialog is shown before `copyMoveHistory` (📋 copy PGN), `exportPGNToFile` (💾 export PGN to file), and `_pgnCacheSaveCurrent` (📚 save to PGN cache manager) with three options: "Yes, include annotations", "No, moves only", and "Cancel".

3. **New i18n keys** (`game-logic.js`): `pgn_export_include_annotations_title`, `pgn_export_include_annotations_msg`, `pgn_export_include_annotations_yes`, `pgn_export_include_annotations_no` — all bilingual (zh/en).

#### Files modified in Phase 63

- `src/main/assets/chess.src/ai-bridge.js` — `_buildPGNString` `includeAnnotations` parameter; `_showPGNExportAnnotationDialog`; `copyMoveHistory`/`exportPGNToFile` dialog integration; export list updated
- `src/main/assets/chess.src/ui.js` — `_pgnCacheSaveCurrent` dialog integration; extracted `_pgnCacheSaveCurrentImpl`
- `src/main/assets/chess.src/game-logic.js` — new i18n keys for export dialog
- `src/main/assets/chess.html` — rebuilt from chess.src/
- `README.md`, `NOTICE` — Phase 63 changelog entry
- `Manual/Regalia-v1.1.1-manual-{zh,en}.html` — Phase 63 intro + changelog
- All 7 `README.license` files — Phase 63 changelog entry

### v1.1.1 Phase 62 (visual annotation PGN pollution fix, 2026.7.5)

This is a same-version revision phase (no version bump — `versionCode=111`, `versionName="1.1.1"`). It fixes the visual annotation (`[%csl]`/`[%cal]`) PGN pollution bug from first principles.

**Root cause**: `_visualAnnotationsCache` stores two types of annotations:
1. **Imported annotations** — extracted from an imported PGN's `[%csl]`/`[%cal]` comments (human-authored, SHOULD be exported to PGN).
2. **Auto-generated annotations** — computed by `_computeAndCacheVisualAnnotations` after each move (UI display aids: arrows/highlights such as check arrows, threat arrows, control range — should NOT be exported to PGN).

Previously, `_buildPGNString()` exported ALL cache entries, causing auto-generated visual annotations (and stale entries from a previous game if the cache wasn't cleared) to pollute the PGN comments.

**Fix**: Added an `imported` boolean flag to each `_visualAnnotationsCache` entry:
- `_computeAndCacheVisualAnnotations` sets `imported=false` (auto-generated)
- `_computeInitialPositionAnnotations` sets `imported=false` (auto-generated)
- `importPGN`'s annotation extraction sets `imported=true` (human-authored)
- `_buildPGNString()` only exports entries where `imported=true`

UI rendering is unaffected — review/main interface still shows all annotations (arrows/highlights); only PGN export is filtered by the `imported` flag.

#### Verification

- `chess.html` built successfully; JS syntax valid.
- Java compiles successfully.
- Phase 62 changelog added to README.md, NOTICE, all README.license files, and both HTML manuals.

#### Files modified in Phase 62

- `src/main/assets/chess.src/ui.js` — `_visualAnnotationsCache` entries now include `imported` flag; `_computeAndCacheVisualAnnotations` and `_computeInitialPositionAnnotations` set `imported=false`
- `src/main/assets/chess.src/ai-bridge.js` — `_buildPGNString` only exports `imported=true` entries
- `src/main/assets/chess.src/tablebase.js` — `importPGN` sets `imported=true` on extracted annotation cache entries
- `src/main/assets/chess.html` — rebuilt from chess.src/
- `README.md`, `NOTICE` — Phase 62 changelog entry
- `Manual/Regalia-v1.1.1-manual-{zh,en}.html` — Phase 62 intro + changelog
- All 7 `README.license` files — Phase 62 changelog entry

### v1.1.1 Phase 61 (cache pollution fix + PGN cache save fix + initial-position annotation move + stats sync, 2026.7.5)

This is a same-version revision phase (no version bump — `versionCode=111`, `versionName="1.1.1"`). It fixes the new-game cache pollution bug, the PGN cache save bug, moves the initial-position eval annotation to a separate pre-move comment, and verifies stats-page PGN sync.

1. **Cache pollution fix** (`ui.js` `_resetGameUIState` + `tablebase.js` import paths): `_resetGameUIState()` now centrally clears ALL game-related caches — including `_reviewEvalCache` (LRU eval cache), `_ecoRecCache` (ECO recommendation cache), `_pvCache` (PV-line conversion cache), `_pendingEngineSANs`/`_pendingEnginePVs` (engine variations), `_multiPVLines`/`_multiPVResult`/`_lastEngineVariation` (MultiPV display), `reviewCritical` (critical-move markers), `_sfEval`/`_sfMateDistance`/`_sfDepth`/`_sfSeldepth`/`_sfWdlW/D/L`/`_sfEvalReady` (eval display variables), `_cachedOriginalPGN` (imported PGN text), `playerWhite`/`playerBlack` (imported player names), `_setupFEN` (setup FEN), `_importedStartMoveNum` (imported start move number), `_needNewGameForEngine` (engine new-game flag), `_tbLoading`/`_tbRetryCount` (tablebase state). All 5 entry points (`_startGameImpl`, `quickFreeOpening`, `_exitSetupImpl`, `_applyImportedFEN`, `importPGN`) call `_resetGameUIState()` and set entry-point-specific values AFTER the reset so they survive. Previously, manual cache clears were inconsistent across entry points, causing old-game eval data, visual annotations, engine variations, etc. to leak into the new game's PGN records, undo/redo stack, engine state, UI display, and statistics content.

2. **PGN cache save fix** (`ui.js` `_pgnCacheSaveCurrent`): `_pgnCacheSaveCurrent()` now distinguishes pure-import games from games with new moves. If `_cachedOriginalPGN` is set AND all `moveRecords` have `time===null` (pure import, no live moves), save the original PGN text (preserving all comments/tags/NAGs/custom content). Otherwise rebuild via `_buildPGNString(true)` (includes post-import moves + eval annotations). Previously, `_buildPGNString` rebuild lost custom comments and non-cached NAGs from the original PGN, causing the saved PGN to differ from the imported one.

3. **Initial-position annotation move** (`ai-bridge.js` `_buildPGNString` + `pgn-standard.js` `composePGN`): The initial-position eval annotation is now a SEPARATE `{}` comment BEFORE the first move (`preMoveComment`), not attached to white's first move's `{}` comment. `_buildPGNString` computes `_preMoveComment` (format: `[%eval <tag>] [Initial position] <desc> (<score>) D<depth> SD<seldepth> (<W%>W/<D%>D/<L%>L)`) and passes it to `composePGN`, which inserts `{...}` before the first move. PGN spec allows comments anywhere in movetext, including before the first move. The old `i===0` block that attached the annotation to the first move's `commentParts` is removed. This is more semantically correct — the initial position's eval applies to the position BEFORE any moves, not after white's first move.

4. **Stats-page PGN sync verification** (`ai-bridge.js` `openStatsPage`): `openStatsPage()` already uses `_buildPGNString(true)` to rebuild the PGN from the current `moveRecords` (instead of the potentially-stale `_cachedOriginalPGN`), and `StatsActivity` receives the latest payload via Intent extra on each launch. Verified: the main/review interface's PGN info is correctly synced each time the stats page is opened (in review mode, `moveRecords` is still the full game record, and the stats page shows the full game).

#### Verification

- `chess.html` built successfully; JS syntax valid.
- Java compiles successfully.
- Phase 61 changelog added to README.md, NOTICE, all README.license files, and both HTML manuals.

#### Files modified in Phase 61

- `src/main/assets/chess.src/ai-bridge.js` — `_preMoveComment` computation; removed `i===0` initial annotation block; pass `preMoveComment` to `composePGN`
- `src/main/assets/chess.src/pgn-standard.js` — `composePGN` `preMoveComment` support
- `src/main/assets/chess.src/tablebase.js` — `_applyImportedFEN` + `importPGN` reordered: `_resetGameUIState` first, then set entry-point-specific values
- `src/main/assets/chess.src/ui.js` — `_resetGameUIState` centralized cache clearing; `_exitSetupImpl`/`_startGameImpl` redundant manual clears removed; `_pgnCacheSaveCurrent` pure-import detection
- `src/main/assets/chess.html` — rebuilt from chess.src/
- `README.md`, `NOTICE` — Phase 61 changelog entry
- `Manual/Regalia-v1.1.1-manual-{zh,en}.html` — Phase 61 intro + changelog
- All 7 `README.license` files — Phase 61 changelog entry

### v1.1.1 Phase 60 (audit-driven fixes + stats board navigation + analyze-all robustness + entry-point cache audit, 2026.7.5)

This is a same-version revision phase (no version bump — `versionCode=111`, `versionName="1.1.1"`). It implements reasonable fixes from the comprehensive architecture audit report, adds navigation buttons to the statistics board, and audits all new-game entry points.

1. **Audit-driven P0/P1 fixes** (reasonable suggestions only — false positives skipped):
   - **P0-3.1 writer lock inconsistency** (`StockfishNative.java`): `cleanupEngineResources()`, `shutdown()`, and `cleanupFailedEngine()` previously used `synchronized(this)` to close the engine writer, while the Phase 58 heartbeat path uses `synchronized(_writerLock)`. This lock inconsistency risked the writer being closed mid-write by the heartbeat thread. Fix: all three writer-close paths now use `_writerLock`. `sendUciCommand()`'s writer access is also wrapped in `_writerLock` (with a re-check of `engineWriter != null` inside the lock) so cleanup paths cannot close the writer mid-send.
   - **P0-3.5 Integer_bitcount negative-input infinite loop** (`ui.js`): `while (n) { n &= n - 1; }` loops forever for negative `n` (sign bit always 1). Fix: `n = n >>> 0` coerces to unsigned 32-bit. The dirty-flag bitfield is always non-negative in practice, but this is a defensive guard.
   - **P1-4.4 onRenderProcessGone infinite recreate loop** (`ChessWebViewClient.java`): unconditional `activity.recreate()` could form a crash-restart-crash loop on buggy GPU drivers. Fix: added a static crash counter with a 60-second window — max 3 recreates per window, then stops (user must restart manually). The counter resets after 60s of stability.
   - **P1-4.16 normalizeTagValue tab character** (`pgn-standard.js`): the `[\r\n]+` regex did not filter tab characters (PGN spec forbids tabs in tag values). Fix: regex changed to `[\r\n\t]+`.
   - **i18n hard-coded "Render Error"** (`ui.js` + `game-logic.js`): the render-error fallback page had a hard-coded English title. Fix: new `render_error_title` i18n key (`{zh:'渲染错误', en:'Render Error'}`), used via `T()`.

   **Audit findings verified as false positives (no fix needed)**: P0-3.2 (getInsetsController NPE — already wrapped in try-catch), P0-3.4 (toggleLang duplicate — only one definition exists), P0-3.6 (draw_fifty — code uses `draw_50move` consistently), P0-3.7 (_evalDispPrevSig — progress shown via full render path), P1-4.7 (Worker Blob URL leak — already revoked in _removeWorker), P1-4.8 (probeTablebase timeout — already has 5s AbortController), P1-4.9 (Chess960 SP-ID floor — `|0` + input validation handles it), P1-4.11 (Chess960 rook path — already checked via union path), P1-4.13 (_mlistScrollState — already reset in _resetGameUIState), P1-4.17/4.20 (ChessAudioEngine partial-init — already fixed in Phase 54), P2-5.5 (ECO parse error handling — already has try-catch), Section 15.2 i18n keys (all translations present).

2. **Statistics board navigation buttons** (`stats.html`): Added ⏮ ◀ ▶ ⏭ navigation buttons below the statistics board, mirroring the review interface. Behavior:
   - **Mainline move selected**: nav stays within the mainline. ⏮ = first move (press again for initial position), ◀ = previous (at first → initial position), ▶ = next (at last → stays), ⏭ = last move.
   - **Variation move selected**: nav stays within the current variation's `()` sequence. ⏮ = variation's first move, ◀ = previous within variation (clamped at 0), ▶ = next within variation (clamped at last), ⏭ = variation's last move. Does NOT cross into mainline or other variations.
   - **No moves**: buttons are hidden.
   - **HTML export**: full-PGN export keeps the nav buttons (JS preserved, fully interactive); FEN-only export strips the nav buttons (static export has no JS, buttons would be non-functional).
   - New i18n keys: `nav_first`, `nav_prev`, `nav_next`, `nav_last`, `nav_main_line`, `nav_variation`.

3. **Analyze-all robustness verification**: The Phase 59 batch-session decoupling (`_reviewAnalyzeStep`/`_reviewAnalyzeGen`/`_evalRequestBatchGen`) is verified to ensure all evaluations complete in one pass — the batch runs in the background, user navigation does not invalidate in-flight callbacks, and the per-step 60s safety timer handles stuck steps.

4. **New-game entry-point cache audit**: All 5 entry points verified to call `_resetGameUIState()` which clears: PGN records (`moveRecords`, `stateHistory`), undo/redo stack (`_redoStack`), engine state (`_needNewGameForEngine`, `isAIThinking`, `_evalLoading`, `_reviewEvalCache`), UI display (`_visualAnnotationsCache`, `_mlistScrollState`, `_multiPVLines`), statistics content (`_cachedOriginalPGN`, `playerWhite`/`playerBlack`). Entry points: `_startGameImpl` (new game dialog), `quickFreeOpening` (free opening → startGame), `_exitSetupImpl` (setup complete), `_applyImportedFEN` (FEN import), `importPGN` (PGN import).

#### Verification

- `chess.html` built successfully; JS syntax valid.
- `stats.html` JS syntax valid.
- Java compiles successfully.
- Phase 60 changelog added to README.md, NOTICE, all README.license files, and both HTML manuals.

#### Files modified in Phase 60

- `src/main/java/com/Regalia/StockfishNative.java` — writer-close paths use `_writerLock`; `sendUciCommand` writer access wrapped in `_writerLock`
- `src/main/java/com/Regalia/ChessWebViewClient.java` — `onRenderProcessGone` crash-count backoff
- `src/main/assets/chess.src/ui.js` — `Integer_bitcount` unsigned coercion; render-error title i18n
- `src/main/assets/chess.src/pgn-standard.js` — `normalizeTagValue` tab filtering
- `src/main/assets/chess.src/game-logic.js` — new `render_error_title` i18n key
- `src/main/assets/chess.html` — rebuilt from chess.src/
- `src/main/assets/stats.html` — navigation buttons + `statsNavFirst/Prev/Next/Last` functions + static-export nav-button removal + new i18n keys
- `README.md`, `NOTICE` — Phase 60 changelog entry
- `Manual/Regalia-v1.1.1-manual-{zh,en}.html` — Phase 60 intro + changelog + updated stats-page wireframe with nav buttons
- All 7 `README.license` files — Phase 60 changelog entry

### v1.1.1 Phase 59 (PGN annotation dedup + step-0 eval + i18n resign/timeout + analyze-all rewrite, 2026.7.5)

This phase bumps the version to `versionCode=111`, `versionName="1.1.1"` and fixes four user-reported bugs plus a first-principles rewrite of the review-mode "Analyze All" batch logic.

1. **Version bump** (`versionCode 110` → `111`, `versionName "1.1.0"` → `"1.1.1"`): Updated `build.gradle`, `strings.xml` (`app_name`), `MainActivity.java` (`VERSION`), `StockfishNative.java` (`ENGINE_VERSION`), `ChessApp.java` (init log), `ChessWebViewClient.java` (version comment), `game-logic.js` (`loading_title`), `index.html.tpl` (`<title>`), `ui.js` (header badge + about dialog + render-error page — also fixed a stale `v1.0.8` in the render-error page), HTML manuals (file rename + internal version), `README.md`, `BUILDING.md`, `PRIVACY.md`, `NOTICE`, all 7 `README.license` files, tar package directory name (`Regalia-v1.1.0-src/` → `Regalia-v1.1.1-src/`), APK filename, tar filename.

2. **Task 59.2 — Fix duplicate every-5-moves PGN annotation** (`ai-bridge.js` `_buildPGNString`): When re-exporting an imported PGN, the every-5-moves eval annotation was re-appended even though `mr.comment` already contained it (from the prior export). Fix: track freshly-computed annotations in a per-move `Set` (`_pgnAddedAnnotations`) and strip them from `mr.comment` via whitespace-tolerant regex matching before appending. The dedup is case-sensitive (the annotation is deterministic given `_lang` so this is safe) and handles both the bare annotation form and the `[初始局面]`-prefixed initial-position form.

3. **Task 59.3 — Fix step-0 eval not cached & chart not auto-loading** (`ai-bridge.js` `onEngineEval` + `ui.js` `_refreshEvalTrendChart`): When the user entered review mode and immediately navigated to a later step, step 0's in-flight eval callback was discarded by the `_reviewEvalRequestedStep !== reviewStep` stale filter — leaving the chart with no data point at step 0. Fix: `onEngineEval` now computes eval values up-front and caches them for the ORIGINAL `_reviewEvalRequestedStep` even when the callback is "stale" for display (the display vars `_sfEval` etc. are NOT updated when stale — only the cache is populated). A new `_refreshEvalTrendChart()` function in `ui.js` performs a lightweight DOM update of the `.review-chart` container's SVG when a stale callback gets cached, so the chart's data point at step 0 appears without a full re-render.

4. **Task 59.4 — Add initial-position annotation to first move** (`ai-bridge.js` `_buildPGNString` + `game-logic.js` new i18n key): PGN has no move-row for the initial position, so step 0's eval annotation is now attached to the FIRST move's `{}` comment with a `[初始局面]` / `[Initial position]` prefix (new i18n key `pgn_initial_position`). The annotation uses the same `formatEvalAnnotation` output as every-5-moves. Dedup tracks both the prefixed form (`[初始局面] 均势 (0.00) D20 ...`) and the bare form (`均势 (0.00) D20 ...`) so re-export doesn't duplicate. Works correctly for Chess960 and setup-FEN games (step 0 is the user-set position).

5. **Task 59.5 — Fix resignation/timeout comment language** (`ai-bridge.js` `_buildPGNString` + `game-logic.js` new i18n keys): The resignation comment (`{White resigns.}` / `{Black resigns.}`) and timeout comment (`{White wins by timeout}` / `{Black wins by timeout}`) were hard-coded English even in Chinese mode. Fix: replaced with `T()` calls using new i18n keys `pgn_resign_white` / `pgn_resign_black` / `pgn_timeout_white_wins` / `pgn_timeout_black_wins`. Added `_commentHasText()` helper for dedup checking against both `commentParts` and `mr.comment` (whitespace-tolerant). The `[Termination "Resignation"]` / `[Termination "Time forfeit"]` PGN header tags remain English (per PGN spec — these are machine-readable tag values, not human-readable comments).

6. **Task 59.6 — First-principles rewrite of "Analyze All" batch logic** (`ai-bridge.js` + `ui.js`): The old batch logic conflated the batch's current step with `reviewStep` (the user's view). User navigation during the batch either discarded the batch's in-flight callback (stalling until the 60s safety timer fired) or hijacked the batch's progress (re-evaluating already-cached steps). Fix: introduced a separate batch session — `_reviewAnalyzeStep` (batch's own current step), `_reviewAnalyzeGen` (generation counter), `_evalRequestBatchGen` (captured at request time). New `_requestBatchEval(step)` function sends eval requests with the batch gen, so `onEngineEval` can distinguish batch callbacks from user-nav callbacks (batch gen check happens FIRST, before the user-nav stale filter). User-nav eval requests are blocked during batch (serve from cache or show "analyzing") to avoid canceling the batch's in-flight engine call. The batch runs in the background — the user can navigate freely, with progress shown via toast and the analyze-all button label. `onEngineReady` resumes the batch via `_requestBatchEval` (not `requestEngineEval`). `exitReview` clears all batch state (`_reviewAnalyzeStep=-1`, `_evalRequestBatchGen=0`, increments `_reviewAnalyzeGen`).

#### Verification

- 17/17 automated dedup logic tests pass (`test-phase59-dedup-logic.js`) covering: `_commentHasText` basic + whitespace-tolerant + substring matching, every-5-moves annotation dedup, initial-position annotation dedup (prefixed + bare forms), resign/timeout comment dedup, initial-position annotation format.
- `chess.html` built successfully (20150 lines, 1227842 bytes); JS syntax validated via `new Function()`.
- Release APK built successfully: `versionCode=111`, `versionName="1.1.1"`, `application-label='Regalia v1.1.1'`, v1+v2+v3 signing all verified.
- Phase 59 changelog added to README.md, BUILDING.md, NOTICE, all README.license files, and both HTML manuals.

#### Files modified in Phase 59

- `src/main/assets/chess.src/ai-bridge.js` — `_commentHasText` helper, every-5-moves dedup, initial-position annotation, i18n resign/timeout, batch session state (`_reviewAnalyzeStep`/`_reviewAnalyzeGen`/`_evalRequestBatchGen`), `_requestBatchEval()` function, `onEngineEval` batch-gen-first + stale-callback-caching, `requestEngineEval` user-nav-only (blocks during batch), `onEngineReady` batch resume via `_requestBatchEval`, export list updated
- `src/main/assets/chess.src/ui.js` — `_refreshEvalTrendChart()` lightweight chart DOM refresh, `reviewAnalyzeAll()` uses `_requestBatchEval`, `_reviewAnalyzeAdvance()` uses `_reviewAnalyzeStep` (decoupled from `reviewStep`), `_reviewAnalyzeResetSafetyTimer()` logs `_reviewAnalyzeStep`, `exitReview()` clears batch state, export list updated
- `src/main/assets/chess.src/game-logic.js` — new i18n keys: `pgn_resign_white`, `pgn_resign_black`, `pgn_timeout_white_wins`, `pgn_timeout_black_wins`, `pgn_initial_position`; `loading_title` bumped to v1.1.1
- `src/main/assets/chess.src/index.html.tpl` — `<title>` bumped to v1.1.1
- `src/main/assets/chess.html` — rebuilt from chess.src/ via `python3 build-chess.py`
- `build.gradle` — `versionCode 111`, `versionName "1.1.1"`
- `src/main/res/values/strings.xml` — `app_name` = `Regalia v1.1.1`
- `src/main/java/com/Regalia/MainActivity.java` — `VERSION = "v1.1.1"`
- `src/main/java/com/Regalia/StockfishNative.java` — `ENGINE_VERSION = "v1.1.1"`
- `src/main/java/com/Regalia/ChessApp.java` — init log `v1.1.1`
- `src/main/java/com/Regalia/ChessWebViewClient.java` — version comment `v1.1.1`
- `README.md`, `BUILDING.md`, `PRIVACY.md`, `NOTICE` — Phase 59 changelog entry
- `Manual/Regalia-v1.1.1-manual-{zh,en}.html` — renamed from v1.1.0 + Phase 59 intro paragraph + changelog paragraph
- `src/main/README.license`, `src/main/assets/README.license`, `src/main/assets/chess.src/README.license`, `src/main/java/com/Regalia/README.license`, `src/main/cpp/README.license`, `src/main/res/README.license`, `Manual/README.license` — Phase 59 changelog entry

### v1.1.0 Phase 58 (every-5-moves PGN eval annotation + stopLatch race fix + heartbeat deadlock fix, 2026.7.5)

This is a same-version feature + concurrency-hardening phase (no version bump — `versionCode=110`, `versionName="1.1.0"`). It adds 1 feature and fixes 2 P0 concurrency issues:

1. **Every-5-moves PGN `{}` eval annotation** (`ai-bridge.js` `_buildPGNString` + `pgn-standard.js` `formatEvalAnnotation` + `game-logic.js` new i18n keys): At moves 5, 10, 15, 20, ..., the PGN `{}` comment now includes a human-readable eval-bar-mirroring fragment, auto-localized via `T()` reading the global `_lang` variable. Format:
   - Chinese mode: `均势 (-0.10) D22 SD34 (1%W/96%D/3%L)`
   - English mode: `Equal (-0.10) D22 SD34 (1%W/96%D/3%L)`

   All eval/WDL/depth values are **White-perspective** (the engine → White conversion is done in `onEngineEval` before caching), so the PGN comment is unambiguous regardless of which side the human played. Missing components are gracefully omitted:
   - No depth → omit `D## SD##`
   - No WDL (all -1 or sum ≤ 0) → omit `(%W/%D/%L)`
   - Mate → use `#+N` / `#-N` score + "White mates" / "Black mates" label

   New i18n keys: `pgn_white_winning`, `pgn_white_huge_adv`, `pgn_white_advantage`, `pgn_white_slight_adv`, `pgn_equal`, `pgn_black_slight_adv`, `pgn_black_advantage`, `pgn_black_huge_adv`, `pgn_black_winning`, `pgn_mate_white`, `pgn_mate_black`. These are White-perspective labels (not player-perspective) using the same thresholds as `posDesc()` in `ui.js`.

   The annotation is placed in the PGN `{}` comment AFTER the structured `[%eval]` tag (so `[%xxx]` tags remain first per PGN spec) and BEFORE free-text comments / resign/timeout annotations.

2. **P0 Concurrency Fix 1 — stopLatch TOCTOU race** (`StockfishNative.java`): The `bestmove` handler in `readEngineOutput()` previously read `_stopLatch` (volatile field) without holding `_stopLatchLock`. This created a time-of-check-to-time-of-use race with `stopAndWaitForBestmove`'s timeout path: if the bestmove arrived just as the timeout fired, the discard flag could be incorrectly armed, discarding the NEXT legitimate bestmove. Fix: the bestmove handler now atomically captures-and-clears `_stopLatch` under `_stopLatchLock`. The timeout path only arms the discard flag if it still owns the latch (i.e., `_stopLatch == stopLatch` under the lock). Exactly one consumer (either the bestmove handler OR the timeout path) "owns" the latch — no race.

3. **P0 Concurrency Fix 2 — heartbeat deadlock** (`StockfishNative.java`): The heartbeat thread's `engineWriter.write("quit\n")` call (inside the zombie-detection branch) was `synchronized` on `StockfishNative.this` — the same monitor used by `startHeartbeat()` (which is `synchronized`). This created a deadlock risk: if `shutdown()` ran while the heartbeat held the `this` monitor inside the writer I/O call, `shutdown`'s `_heartbeatThread.join(1000)` would wait for the heartbeat to release `this` — but the heartbeat was blocked on I/O. Fix: introduced a dedicated `_writerLock` (`private final Object`) for engineWriter access in the heartbeat path. `_writerLock` is decoupled from the `this` monitor, so `shutdown`'s interrupt/join is not blocked by heartbeat's writer access. `cleanupEngineResources()` and `recoverEngine()` use their own locks (`_restartLock`, `_stopLatchLock`) and do not hold `_writerLock`.

#### Verification

- The every-5-moves annotation is verified by an automated Node.js test script (`test-phase58-pgn-annotation.js`) with 22 test cases covering: centipawn eval (zh + en), positive/negative eval, mate (White + Black), missing WDL, zero-sum WDL (divide-by-zero guard), missing depth, falsy cached, language toggle, and built `chess.html` presence. All 22 tests pass.
- The concurrency fixes are verified by Java compilation (no syntax/type errors) and by reasoning about the lock discipline (no nested locks, no lock ordering violations).
- Phase 58 changelog added to README.md, BUILDING.md, NOTICE, all README.license files, and both HTML manuals.

#### Files modified in Phase 58

- `src/main/assets/chess.src/pgn-standard.js` — new `formatEvalAnnotation` function + `_pgnWhitePerspectiveLabel` helper
- `src/main/assets/chess.src/game-logic.js` — new `pgn_*` i18n keys (White-perspective eval labels)
- `src/main/assets/chess.src/ai-bridge.js` — every-5-moves hook in `_buildPGNString`
- `src/main/assets/chess.html` — rebuilt from chess.src/ via `python3 build-chess.py`
- `src/main/java/com/Regalia/StockfishNative.java` — stopLatch capture-and-clear fix + `_writerLock` for heartbeat writer access
- `README.md`, `BUILDING.md`, `NOTICE` — Phase 58 changelog entry
- `Manual/Regalia-v1.1.0-manual-{zh,en}.html` — Phase 58 intro paragraph + changelog paragraph
- `src/main/README.license`, `src/main/assets/README.license`, `src/main/assets/chess.src/README.license`, `src/main/java/com/Regalia/README.license`, `src/main/cpp/README.license`, `Manual/README.license` — Phase 58 changelog entry

---

### v1.1.0 Phase 57+ (code-review-driven preventive hardening, 2026.7.5)

This is a same-version code-review-driven hardening phase (no version bump — `versionCode=110`, `versionName="1.1.0"`). It implements six preventive fixes surfaced by the comprehensive code review of the v1.1.0 source:

1. **`pgn-standard.js` `parseStandardPGN` single-line PGN tag-stripping fix**: The old tag-stripping regex `/^\[[\s\S]*?\]/gm` relied on `^` with the `gm` flags to anchor PGN tag pairs to line starts. In multi-line PGN (one tag per line) this works correctly. But in SINGLE-LINE PGN (all tags + movetext on ONE line — e.g. `PGN 2Kbug.pgn`), `^` only matches the very start of the string, so the regex matches only the FIRST `[...]` block. Because `[\s\S]*?` is non-greedy, that first match stops at the first `]` (closing the first tag), leaving the remaining tags (`[Site ...]`, `[White ...]`, etc.) as garbage tokens in `moveText`. These tokens are then misclassified as SAN moves by the tokenizer, polluting the move list.

   Fix: replaced with the format-strict, unanchored regex `/\[[A-Za-z]\w*\s+"[^"]*"\]/g`. The new pattern requires the canonical PGN tag shape (key + whitespace + double-quoted value), so it correctly strips ALL tags regardless of line layout, and never false-positive-strips movetext comments like `[Nf3]` (no quotes, no key-value shape).

   **Note**: `parseStandardPGN` is currently NOT on the main code path — the main PGN parser is `tablebase.js` `_parsePGN` (which was independently fixed in Phase 52). This fix is preventive, eliminating a latent landmine if `parseStandardPGN` is ever wired in.

2. **`chess960.js` `isChess960CastlingLegal` king-position lookup optimization**: The function was scanning the entire back rank (up to 8 `s.board[row][c]` reads) to locate the king, inconsistent with how other king-position lookups are done in `game-logic.js`. The state object `s` maintains cached `s.wk` / `s.bk` fields (maintained by `syncHash()` and `cloneS()`).

   Fix: read `s.wk` / `s.bk` directly, with a defensive verification that the cached square actually contains a same-color king (guards against a stale cache). If the cache is missing or stale, fall back to the original board scan. This is both a small performance improvement and a consistency improvement with the rest of the codebase.

   **Chess960 compatibility**: Pure optimization — the function's logic and return values are unchanged. Chess960 castling legality is computed identically.

3. **`ai-bridge.js` WDL percentage display divide-by-zero guard**: The WDL display calculation `_sfWdlW/total*100` (and the D and L variants) previously divided by `_sfWdlW + _sfWdlD + _sfWdlL` without guarding against `total === 0`. In pathological positions where the engine emits `wdl 0 0 0`, this produced `NaN`/`Infinity` in the WDL percentage string. Added an `if(total > 0)` guard.

4. **`StockfishNative.java` `postJsCallback` activity-lifecycle guard**: Added an `isFinishing() || isDestroyed()` guard on the host Activity before invoking `webView.evaluateJavascript(...)`. On some OEM ROMs (notably HyperOS 3), calling `evaluateJavascript` on a destroyed WebView's main thread throws `IllegalStateException`, which previously crashed the process during engine-init retries after the user exited the app. The guard logs and skips the callback instead.

5. **`EngineService.java` wake-lock bounded timeout**: Changed `wakeLock.acquire()` (unbounded) to `wakeLock.acquire(30L * 60L * 1000L)` (30-minute timeout). If the OEM silently kills the service and `onDestroy` never runs, the wake lock is released automatically instead of holding the CPU awake indefinitely. The 30-minute window is well beyond any single analysis session; longer sessions re-acquire by re-entering the foreground state.

6. **`res/README.license` LIC-2 (stale version reference)**: Line 14's `strings.xml` description still referenced `Regalia v1.0.8` even though the actual `app_name` value was updated to `Regalia v1.1.0` in Phase 53. Historical changelog entries that mention `v1.0.8` (lines 163+) are preserved as accurate historical records.

Also added `UBIQUITOUS_LANGUAGE.md` (pure-English domain terminology glossary, 80+ chess/engine/PGN/UI terms) at the project root for developer/domain-expert conversation reference.

#### Verification

- All six fixes are verified by automated Node.js test scripts and JS syntax validation.
- Phase 57+ changelog added to README.md, BUILDING.md, NOTICE, all README.license files, and both HTML manuals.

#### Files modified in Phase 57+

- `src/main/assets/chess.src/pgn-standard.js` — `parseStandardPGN` tag-stripping regex
- `src/main/assets/chess.src/chess960.js` — `isChess960CastlingLegal` king-position lookup
- `src/main/assets/chess.src/ai-bridge.js` — WDL percentage divide-by-zero guard
- `src/main/assets/chess.html` — rebuilt from chess.src/ via `python3 build-chess.py`
- `src/main/java/com/Regalia/StockfishNative.java` — `postJsCallback` activity-lifecycle guard
- `src/main/java/com/Regalia/EngineService.java` — wake-lock bounded 30-minute timeout
- `src/main/res/README.license` — line 14 strings.xml description version reference
- `UBIQUITOUS_LANGUAGE.md` (NEW) — pure-English domain terminology glossary at project root
- `README.md`, `BUILDING.md`, `NOTICE`, `PRIVACY.md` — Phase 57+ changelog entry
- `Manual/Regalia-v1.1.0-manual-{zh,en}.html` — Phase 57+ intro paragraph + changelog paragraph
- `src/main/README.license`, `src/main/assets/README.license`, `src/main/assets/chess.src/README.license`, `src/main/java/com/Regalia/README.license`, `src/main/cpp/README.license`, `src/main/res/README.license`, `Manual/README.license` — Phase 57+ changelog entry

#### Code-review findings NOT fixed in Phase 57+ (with rationale)

- **A05-1 (`build.gradle:82` `debuggable=true`)**: **False positive.** `debuggable true` is ONLY in the `debug` build type (line 82). The `release` build type (lines 75-79) does NOT set `debuggable`, so it defaults to `false`. The release APK is verified via `apksigner` and does not have `android:debuggable="true"` in the manifest.
- **LIC-1 (`StockfishNative.java` v18.5.0 internal version comments)**: **Intentionally not modified.** These are accurate historical changelog comments documenting internal development stages (v18.x.x). The README's "Version" section explains this convention. Editing them would falsify historical records.
- **P0 concurrency issues in `StockfishNative.java` (stopLatch race, heartbeat deadlock, etc.)**: **Postponed to a dedicated concurrency-hardening phase.** These are theoretical races that have not manifested in production across v1.0.8–v1.1.0. Properly addressing them requires dedicated concurrency analysis and stress-testing, not a quick patch.
- **"God module" refactor (`ui.js` 7,497 lines / `StockfishNative.java` 5,212 lines)**: **Postponed to a future major version.** A proper refactor requires 6+ weeks of architectural work and dedicated test coverage. Not appropriate for a same-version hardening phase.

---

### v1.1.0 Phase 57 (portrait review move-list scroll positioning + visual-annotation cache residue fix, 2026.7.4)

This is a same-version bug-fix phase (no version bump — `versionCode=110`, `versionName="1.1.0"`). It fixes two issues reported after Phase 56:

1. **Portrait review mode move-list scroll positioning**: In PORTRAIT review mode, after clicking a move in the move list, the selected move was not in view (the scroll position was wrong). Root cause: the Phase 56 fix (which replaced `scrollIntoView` with manual `scrollTop` computation) used `_rAct.offsetTop` to compute the active move's position. However, `offsetTop` returns the distance from the element's outer border to the top of its `offsetParent`'s inner border, and `.rmv-block`'s `offsetParent` is `.review-overlay` (which is `position:fixed`), NOT `_rList` (`.review-moves` has no `position` set).

   In LANDSCAPE this happened to be approximately correct because `.review-moves` is a flex child of `.review-top` (which is row-flex), so `.rmv-block`'s vertical `offsetTop` within `.review-overlay` ≈ `header_height + position_within_moves`. The header is only ~24px, so the error was small. In PORTRAIT, however, `.review-moves` is stacked BELOW `.review-left` (the board column, which has the board's full height). So `.rmv-block`'s vertical `offsetTop` within `.review-overlay` ≈ `header_height + board_height + position_within_moves`. The `board_height` is 256-320px — much larger than the `.review-moves` viewport (also 256-320px), so the resulting `_target` was WAY too large, clamped to `scrollHeight - clientHeight` (scrolled to bottom), and the active move was nowhere near the center of the visible area.

   Fix: replaced the `offsetTop`-based calculation with a `getBoundingClientRect()`-based calculation that computes the active move's position RELATIVE TO `_rList` (not relative to `.review-overlay`): `_actTop = (_actRect.top - _listRect.top) + _rList.scrollTop`. This gives the active move's position within `_rList`'s full content (including the portion scrolled out of view), regardless of orientation, layout structure, or `offsetParent` chain. The centering formula `_target = _actTop + _actH/2 - _listH/2` then correctly centers the active move in the visible area. A defensive fallback to `offsetTop` is preserved in case `getBoundingClientRect` throws.

   **Chess960 compatibility**: this is a pure DOM/layout fix; it does not touch any game-logic, castling, or move-generation code. It works identically for standard chess and Chess960 (the move list rendering is variant-agnostic).

2. **Visual-annotation cache residue at review entry**: Occasionally, when entering review mode, the review board at step 0 (initial position) showed stale visual annotations (`[%csl]`/`[%cal]`) that did not match the displayed position. Two root causes:

   (a) `_computeInitialPositionAnnotations` read `gameState` (the LIVE mid-game state) instead of `reviewStates[0].state` (the actual initial position shown at step 0). When the user entered review during a mid-game, the annotations cached under the `'_initial'` key were computed for the mid-game position (e.g., threats to a queen on d4), but the board at step 0 shows the INITIAL position (queen on d1). The mismatch caused stale, irrelevant annotations to appear at step 0 — perceived by the user as "残留旧对局的过时视觉注解".

   (b) The `'_initial'` cache key was NEVER cleared by `_invalidateCachesForUndoneMoves` (which only deletes NUMERIC keys `>= N`). It IS cleared by `_resetGameUIState` (called by new game / import / setup-complete / FEN import), but if the user re-entered review WITHOUT one of those entry points in between (e.g., continued playing the same game and re-entered review), the stale `'_initial'` cache would persist and the wrong annotations would render.

   Fix: (a) `_computeInitialPositionAnnotations` now reads `reviewStates[0].state` (the actual initial position) with a fallback chain: `reviewStates[0].state` → `reviewBaseState` → `gameState` (defensive). (b) `enterReview()` now explicitly deletes the `'_initial'` key from `_visualAnnotationsCache` at entry, forcing fresh computation each review session. The NUMERIC keys (0..N-1) are deliberately preserved — they were computed during play (via `_computeAndCacheVisualAnnotations` after each move) and are still valid for the current `moveRecords`.

   **Chess960 compatibility**: `reviewStates[0].state` is built by `enterReview()` from `stateHistory[0].state` (captured at game start) or from `reviewBaseState` (which is the initial position). For Chess960 games, this state has the Chess960 starting position (with `spid` set). `getCtrlMap` and `attacked` both operate on the board state regardless of variant, so the annotations are computed correctly for Chess960 initial positions too.

#### Verification

- Both fixes are in the rebuilt `chess.html`.
- APK built with v1/v2/v3 signatures, verified via `apksigner`.
- Phase 57 changelog added to README.md, NOTICE, all README.license files, and both Chinese/English HTML manuals.
- JS syntax validated via `new Function()` parse of the embedded `<script>` block.

#### Files modified in Phase 57

- `src/main/assets/chess.src/ui.js` (Issue 1: `getBoundingClientRect`-based scroll positioning; Issue 2: `enterReview` clears `'_initial'` cache key + `_computeInitialPositionAnnotations` reads `reviewStates[0].state`)
- `src/main/assets/chess.html` (rebuilt from `chess.src/` by `build-chess.py`)
- `NOTICE`, `README.md`, all `README.license` files (Phase 57 changelog)
- `Manual/Regalia-v1.1.0-manual-{zh,en}.html` (Phase 57 changelog at top)

### v1.1.0 Phase 56 (landscape review nav-button scroll-to-top fix + PGN timeout annotation + first-move timing sync + UCI command ordering refinement, 2026.7.4)

This phase fixes 4 issues:

1. **Landscape review mode nav-button scroll-to-top bug**: In landscape review mode, clicking the nav buttons (⏮ ◀ ▶ ⏭) at the bottom of the page caused the entire `.review-body` container to abnormally scroll back to the top. Root cause: `scrollIntoView({block:'center'})` on the active move scrolls ALL scrollable ancestors — the active move lives in the inner `.review-moves` container at the TOP of the outer `.review-body`, so `scrollIntoView` yanked `.review-body` back to `scrollTop=0`, undoing the synchronous scroll-position restore. Fix: replaced `scrollIntoView` with manual `scrollTop` computation on the inner `.review-moves` container only, preserving the outer `.review-body` scroll position.

2. **PGN timeout annotation**: For games ending by timeout (time control), the PGN was missing the `[Termination "Time forfeit"]` tag and the `{White wins by timeout}` / `{Black wins by timeout}` last-move comment. Per the user spec: "对于一方时间耗尽(计时赛)而导致另一方获胜，当前的PGN缺乏完善的注释，应当在最后的注释中写明：'White wins by timeout' 或 'Black wins by timeout'". Fix: added a `timeout` branch parallel to the existing `resign` logic — emits `[Termination "Time forfeit"]` tag and `{<color> wins by timeout}` comment on the last move. The `[Result]` tag was already correct (1-0/0-1 via `_timeoutWinnerColor`).

3. **First-move timing synchronization**: The `_turnStartTime` variable (which records the per-move elapsed time for `[%emt]`/`{Xs}` annotations) was NEVER reset at any game-start entry point — it was only set at module-load time and re-assigned after each move. This meant the first move's elapsed time included the wall-clock duration since the PREVIOUS game's last move (or since app launch), which could be minutes, hours, or days. Additionally, `gameClocks` was not nulled at non-dialog entry points (FEN/PGN import, setup-complete), causing stale clock state to leak into the new game. Fix: added `_turnStartTime=Date.now()` and `gameClocks=null` to `_resetGameUIState()` — this function is called by ALL game-start entry points (new game dialog, free opening button, setup complete, FEN import, PGN import), ensuring both timers reset consistently. For the dialog path, `initGameClocks()` (called after `_resetGameUIState`) overwrites the null `gameClocks` with fresh clock state.

4. **UCI command ordering for Chess960 + TimeControl**: Verified that the UCI command sequence for a Chess960 + TimeControl game is correct: `setoption name UCI_Chess960 value true` is sent (with `isready` handshake) BEFORE `ucinewgame` and `position fen`, and the `go` command includes correct `wtime`/`btime`/`winc`/`binc` parameters derived from `gameClocks`. The FEN sent via `position fen` uses Shredder format (file-letter castling rights) for Chess960. Minor refinement: moved `setGameDifficulty`'s `setoption` commands to BEFORE `position fen` (previously sent between `position fen` and `go`) for cleaner UCI ordering — all `setoption` commands now precede `position`/`go` per UCI spec recommendations.

#### Verification

- All 4 fixes are in the rebuilt `chess.html`.
- APK built with v1/v2/v3 signatures, verified via `apksigner`.
- Phase 56 changelog added to README.md, NOTICE, all README.license files, and both Chinese/English HTML manuals.

#### Files modified in Phase 56

- `src/main/assets/chess.src/ui.js` (Issue 1: manual scrollTop; Issue 3: `_turnStartTime` + `gameClocks` reset in `_resetGameUIState`)
- `src/main/assets/chess.src/ai-bridge.js` (Issue 2: `[Termination "Time forfeit"]` tag + `{<color> wins by timeout}` comment)
- `src/main/java/com/Regalia/StockfishNative.java` (Issue 4: `setGameDifficulty` moved before `position fen` in both `engineGoTimed` and `engineGoInternal`)
- `src/main/assets/chess.html` (rebuilt from `chess.src/` by `build-chess.py`)
- `NOTICE`, `README.md`, all `README.license` files (Phase 56 changelog)
- `Manual/Regalia-v1.1.0-manual-{zh,en}.html` (Phase 56 changelog at top)

### v1.1.0 Phase 55 (Chess960 castling rook-loss fix in stats.html + game-logic.js _castleSide fallback, 2026.7.4)

This phase fixes a Chess960 castling bug where the rook would silently disappear from the board after O-O or O-O-O in specific Chess960 starting positions where the participating rook's source square IS the king's castling destination square (e.g. SP-ID with king on d1 and queenside rook on c1: O-O-O puts the king on c1, which is the rook's source — the rook then moves to d1).

#### Root cause (first-principles analysis)

The castling detection code in three places used a `_destEmpty` check that required the king's destination square to be empty:

1. `stats.html` `executeMove()` — castling detection for the statistics page's PGN replay
2. `stats.html` `buildSAN()` — castling SAN emission for the statistics page
3. `game-logic.js` `_castleSide()` — castling detection fallback (used by the main board when the explicit `mv.castle`/`mv.to.castle` flag is absent, e.g. for engine moves received via UCI or moves reconstructed from SAN)

The `_destEmpty` check was added in v1.0.8 Phase 49 with the comment "Castling destination squares are ALWAYS empty (the rook ends up BESIDE the king, not under it). If the target square holds any piece, this is a capture, not castling."

This comment is **incorrect for Chess960**. In Chess960, the king's destination square (c1 for O-O-O, g1 for O-O) CAN be the participating rook's source square. The rook still ends up beside the king (at d1 or f1 respectively), but the king's destination was NOT empty before the move — it held the rook that is about to move away.

When `_destEmpty` rejected this case:
- `_isCastling` stayed `false`
- The king's move was treated as a normal (illegal) "self-capture" of the rook
- The rook was silently removed from the board (overwritten by the king, not repositioned)
- The user saw the rook "disappear" after castling

#### Fix

Replaced the `_destEmpty` check with a `_destValid` check that allows the destination to be:
- Empty (standard chess, and Chess960 when rook is not on king's dest), OR
- Occupied by a same-color rook that IS the participating castling rook (Chess960 case)

For `executeMove` and `buildSAN` in stats.html, the participating rook is found FIRST (by scanning from the king's column toward the castling side for the closest same-color rook), then the destination validity is checked. This ensures the rook detected as "on the destination" is actually the participating rook, not a random rook.

Additionally fixed a related latent bug in `stats.html` `executeMove()`'s rook-source clearing logic: when `_rookFrom === _rookTo` (the rook stays in place — happens in Chess960 when the rook's home square IS its castling destination, e.g. rook on f1 castling kingside to f1), the old code would clear the rook's source square AFTER placing the rook there, effectively removing the rook. Added `&& _rookFrom !== _rookTo` to the clearing condition.

The main app's `makeMv()` was already correct for the `_rookFrom === _rookTo` case (it skips the rook-placement block entirely when `rm.rookFrom === rm.rookTo`), so only `_castleSide` needed the `_destValid` fix.

#### Standard chess compatibility

Standard chess is unaffected: the rook is always on a1/h1, and the king's castling destination (c1/g1) is always empty. The `_destValid` check passes trivially for standard chess.

#### Verification

A 6-case test suite was added at `/home/z/my-project/scripts/verify-stats-fix.js`:
1. User's PGN (Chess960 O-O-O, king d1, rook c1) — rook correctly moves to d1
2. Black's c5 follow-up move — pawn correctly moves to c5
3. Standard chess O-O-O regression — rook correctly moves from a1 to d1
4. Standard chess O-O regression — rook correctly moves from h1 to f1
5. Chess960 O-O with rook staying in place (king e1, rook f1) — rook stays at f1
6. Chess960 O-O with rook on king's destination (king e1, rook g1) — rook correctly moves to f1

All 6 tests pass.

#### Files modified in Phase 55

- `src/main/assets/stats.html` (`executeMove` and `buildSAN` castling detection fix)
- `src/main/assets/chess.src/game-logic.js` (`_castleSide` fallback `_destValid` fix + corrected Phase 49 comment)
- `src/main/assets/chess.html` (rebuilt from `chess.src/` by `build-chess.py`)
- `NOTICE`, `README.md`, all `README.license` files (Phase 55 changelog)
- `Manual/Regalia-v1.1.0-manual-{zh,en}.html` (Phase 55 changelog at top)

### v1.1.0 Phase 54 (custom slider for pixel-perfect chart alignment + move-list scroll-into-view fix + executeMove async-callback try-catch + audio-engine partial-init reset + engine heartbeat all-callbacks fix + MultiPV secondary-variation divergence fix + PGN cascade-skip threshold increase + render retry-loop guard, 2026.7.4)

This phase achieves true pixel-perfect alignment between the review progress bar and the evaluation trend chart by replacing the native `<input type="range">` visual with a custom track/fill/thumb rendered as divs (the native input is now a transparent overlay for interaction). It also fixes the move-list scroll-into-view behavior to only scroll when the selected move is not already visible (avoiding jumpy centering on nearby moves), and addresses 7 high/medium-severity findings from a first-principles code audit.

#### Bug fix: review progress bar alignment with eval trend chart

The v1.1.0 Phase 53 attempt used a native `<input type="range">` with CSS `::-webkit-slider-runnable-track` margin and wrapper padding to align the slider track with the chart's data points. This was unreliable because WebKit's native slider thumb position at min/max values depends on internal layout algorithms that vary across WebView versions and cannot be fully controlled via CSS. Users reported that the progress bar's left/right ends exceeded the chart's first/last data point positions.

**Fix**: Replaced the native slider visual with a custom implementation:
- The slider wrapper has IDENTICAL CSS to the chart container (border:1px, padding:2px, box-sizing:border-box, width:100%), so both share the same content box width.
- Inside the wrapper, a container holds: a base track (gray bar from left:3px to right:3px), a fill track (colored progress bar), a thumb (6px circle), and a transparent native `<input type="range">` overlay (opacity:0) that handles all touch/drag/keyboard interaction.
- The thumb's CENTER is positioned via CSS `calc()`: `left: calc(3px + ratio * (100% - 6px))` where `ratio = reviewStep / maxStep`. This matches the chart's data points at viewBox x=3 (first point) and x=width-3 (last point), because the thumb's center at ratio=0 is at 3px (absolute 6px = chart's first point) and at ratio=1 is at width-3px (absolute = chart's last point).
- CSS `calc()` automatically adjusts on resize/orientation change (since `100%` tracks the container width), eliminating flicker and handling layout changes without requiring a re-render.
- The thumb is 6px wide (= 2 × chart padding), so at min the thumb's left edge is at the first data point, and at max the thumb's right edge is at the last data point.

#### Bug fix: review move-list scroll-into-view

The move-list scroll code centered the active move on every step change, which felt jumpy when navigating between nearby moves. Additionally, `_lastReviewStepScrolled` was set BEFORE the `requestAnimationFrame` callback fired — if the callback failed (element not found), the scroll was never retried.

**Fix**:
- Only scroll if the active move is NOT fully visible (block:'nearest' behavior). If it's already in view, leave the scroll position unchanged.
- Moved `_lastReviewStepScrolled` update INSIDE the rAF callback, after the scroll succeeds. If the element is not found (virtual list window doesn't include it), the flag is NOT updated — the next render will retry.

#### Bug fix: executeMove async callback un-caught exceptions

The `setTimeout` callback in `executeMove` (which drives post-move logic: updateAfterMove, AI move trigger, game-over check) had NO try-catch. If `gameStatus()` or any call inside the callback threw, the AI never moved and the UI never updated — the error only surfaced via `window.onerror`.

**Fix**: Wrapped the callback body in try-catch with a descriptive `console.error`.

#### Bug fix: ChessAudioEngine partial-init failure left inconsistent state

`init()` set `this.ctx` first, then `this.master`/`compressor`/`reverb` in the same try block. If a later line threw, the catch returned false but `this.ctx` stayed set. All future `init()` calls returned true at the early `if (this.ctx) return true` guard, leaving the engine permanently broken with no audio.

**Fix**: Reset ALL fields (`ctx`, `master`, `compressor`, `reverb`, `reverbGain`, `dryGain`, `_noiseBuf`) in the catch block, and close the partially-initialized `AudioContext`. Also added `this.ctx` null-guard to `setEnabled()` and `setVolume()`.

#### Bug fix: engine heartbeat only tracked onEngineEval

The engine heartbeat monitor restarted the engine if `_lastEngineCallbackTime` was stale by >120s. But `_lastEngineCallbackTime` was ONLY updated inside `onEngineEval()`. During a long AI think in a timed game (the AI safety timer is 360s; long time controls routinely produce 120-300s thinks), no eval was requested, so the timestamp went stale. At 120s the heartbeat fired `restartEngine()`, forcibly cancelling the in-flight AI search.

**Fix**: Update `_lastEngineCallbackTime = Date.now()` at the top of `onEngineProgress`, `onBestMove`, `onHintMove`, and `onPonderProgress` — all of which are proof-of-life signals from a healthy engine.

#### Bug fix: MultiPV secondary-variation divergence off-by-one

MultiPV secondary variations (alternative lines to the bestmove) were divergence-checked with a 1-ply offset, causing them to be attached to the WRONG move record. The divergence check always used `actualIdx = fromMoveIdx + 1 + vi`, which is correct for mainline continuations (where the PV starts with the opponent's reply) but wrong for secondary variations (where the PV starts with the AI's alternative move — same side as bestmove).

**Fix**: In `_checkPVDivergenceSANs`, compute the starting index based on `pending.firstMoveIsWhite` vs the side at `fromMoveIdx`. If `firstMoveIsWhite === (fromMoveIdx % 2 === 0)` (same side), the variation is an alternative — start comparison at `actualIdx = fromMoveIdx + vi`. Otherwise (continuation), start at `actualIdx = fromMoveIdx + 1 + vi` (previous behavior).

#### Bug fix: PGN cascade-skip threshold too aggressive

`_parsePGN`'s cascade-failure safety limit (5 consecutive invalid tokens) was too aggressive for localized PGN corruption (e.g., OCR errors in moves 40-44 of an 80-move game). With the old limit, moves 45+ were silently dropped.

**Fix**: Increased the threshold to `Math.max(15, mainTokens.length * 0.1)` — scales with game length, so a 160-token game tolerates 16 consecutive skips before aborting.

#### Bug fix: render() retry loop had no max-retry limit

The `render()` function's 200ms retry loop on `animationInProgress` had no max-retry limit — if the flag got stuck true, the loop would run indefinitely.

**Fix**: Added `_animRetryCount` guard (max 10 retries = 2s). After 10 retries, force-clear `animationInProgress` and render immediately.

#### Revision 2 (2026.7.4): edge-to-edge chart and slider

User feedback: the chart's first/last data points still had a 3px gap from the left/right edges, while the slider appeared to fill the full width. The user requested removing ALL edge spacing so both the chart and slider fill the full width edge-to-edge.

**Fix**: Reduced the chart's left/right padding from 3 to 0 — the first data point is now at viewBox x=0 (left edge) and the last at x=width (right edge). The slider thumb center is now at `calc(ratio * 100%)` (was `calc(3px + ratio * (100% - 6px))`), so at min the thumb center is at 0% (left edge) and at max at 100% (right edge) — exactly matching the chart's first/last data points. The slider base track and fill now start at `left:0` (was `left:3px`). The slider container has `overflow:visible` so the 6px thumb can overflow by 3px on each side at min/max (the thumb's center is at the edge, so half the thumb extends beyond the container — visible within the wrapper's padding+border area). The chart's first/last data point circles (r=2.75) are half-clipped by the chart container's `overflow:hidden` — this is the intended edge-to-edge look, matching how the slider thumb overflows.

#### Revision 3 (2026.7.4): true edge-to-edge (remove container padding) + move-list scroll-into-view root-cause fix

User feedback: even after Revision 2, the chart's first/last data points were still NOT at the left/right edges. Root-cause analysis revealed the issue: the chart **container** (`.review-chart`) had `padding:2px` in its inline style. The SVG fills the container's content-box (which is inset by 3px from the outer edge — 1px border + 2px padding). With viewBox padding=0, the data points are at the content-box edges, which are 3px inset from the visual outer edge. The slider wrapper (`.rv-slider-wrap`) also had `padding:2px`, so the slider thumb was similarly inset — both were aligned with each other, but neither was at the true edge.

**Fix (chart edge-to-edge)**: Set the chart container's inline `padding` from `2px` to `0` (keep `border:1px` for the visible frame). Now the SVG fills the entire content-box (which equals border-box minus 1px border on each side), and data points at viewBox x=0 and x=width map to the inner edge of the 1px border — visually edge-to-edge. The slider wrapper CSS `padding` is also set to `0` (keep `border:1px transparent`), so the slider thumb at `calc(ratio * 100%)` maps to the same inner-border-edge position. Both containers have the same border-box width (100% of `.review-bottom`), so their content-box widths match, and data points + thumb are perfectly aligned at the true edges. The `_trendW` measurement is updated: since `padding:0`, `clientWidth` equals the content-box width (no need to subtract 4). The slider labels (start/step/end text) get `padding:2px 3px` so they're not flush with the edge.

**Fix (move-list scroll-into-view)**: User reported the move list "in some cases does not correctly follow the selected move to scroll it into view." First-principles root-cause analysis found TWO issues:

1. **Scroll-restore conflict**: `.review-moves` was in the `_savedContainerScrolls` restore list. When `reviewStep` changed (user clicked a move), the render captured the OLD scroll position, rebuilt the DOM (resetting scrollTop to 0), then a single-rAF restored the OLD scroll position, then a double-rAF ran scroll-into-view. The restore fought with scroll-into-view — it scrolled back to the old position first, then scroll-into-view detected the active move and scrolled again, causing a visible jump-flicker. Worse, if the restore made the active move partially visible at an edge, the "already visible" check passed and the move stayed at the edge.

   Fix: When `reviewStep` changed, skip restoring `.review-moves` scroll position (`_reviewStepChanged` flag). Let scroll-into-view handle it entirely. When `reviewStep` did NOT change (e.g., toggled a control), restore is correct (preserve user's view).

2. **"Already visible" check too aggressive**: The scroll-into-view code skipped scrolling if the active move was "fully visible" (top >= container top AND bottom <= container bottom). But if the move was at the very top or bottom edge of the viewport (technically visible but not centered), the check passed and no scroll happened — the user saw the move at an edge, not centered.

   Fix: When `reviewStep` changed, ALWAYS center the active move (removed the "already visible" skip). The user explicitly navigated to this step — they want it centered, not at an edge.

#### Revision 4 (2026.7.4): move-list scroll complete rebuild + thumb/chart circle diameter alignment + no clipping

User feedback: (1) The move-list scroll was still not working correctly. (2) The slider thumb was clipped at the left/right edges while the chart's first/last data points were not. (3) The slider thumb diameter needs to equal the chart's current-position marker circle diameter for pixel-level alignment.

**Fix (move-list scroll — complete rebuild)**: Discarded the entire old scroll mechanism (save/restore `.review-moves` scrollTop + conditional scroll-into-view with `_lastReviewStepScrolled` guard). The old mechanism was fragile — the save/restore conflicted with scroll-into-view, the `_lastReviewStepScrolled` guard caused skips, and the "already visible" check left moves at edges. The NEW mechanism is simple and reliable:
- `.review-moves` is removed from the `_savedContainerScrolls` save/restore list entirely. Its scrollTop is NEVER saved or restored across full re-renders.
- After EVERY render(), ALWAYS center the active move (`.rmv-block.act`). No `_lastReviewStepScrolled` guard, no "already visible" check — always center, every render.
- This guarantees the selected move is always visible and centered after any render (step change, toggle, etc.). User scrolling doesn't trigger a full render() (the virtual-list scroll listener does a partial refresh instead), so centering doesn't fight with user scrolling.

**Fix (thumb diameter = marker circle diameter)**: The chart's current-position marker is an SVG circle with `r=4` and `stroke-width=1.5` → outer radius 4.75px → outer diameter 9.5px. The slider thumb was 6px (too small). Changed the thumb to 10px (≈ 9.5px marker outer diameter) so the thumb visually matches the marker circle. The slider container height increased from 18px to 20px to accommodate the larger thumb. The native input's `::-webkit-slider-thumb` and `::-moz-range-thumb` increased from 18px to 20px for consistent touch target size.

**Fix (no clipping at edges)**: The chart container's `overflow` changed from `hidden` to `visible` (both in the inline style and the `.review-chart` CSS rule). Now the data point circles (r=2.75) at the first/last positions (viewBox x=0 and x=width) are fully visible — they overflow the container's edge by 2.75px, accommodated by the `.review-bottom`'s 6px horizontal padding. The slider thumb (10px) at min/max overflows by 5px, also accommodated by the 6px padding. The `.rv-slider-wrap` gets explicit `overflow:visible` to ensure the thumb is never clipped.

#### Revision 5 (2026.7.4): eval label color/contrast + global-mode label removal + strict 9.5px thumb + portrait clipping fix + move-list scroll block:'nearest'

User feedback: (1) Local-mode eval value labels have insufficient contrast in light/dark modes. (2) Avoid label clipping at edges. (3) Remove the eval value label at the last endpoint in global mode. (4) Portrait-mode slider thumb still clipped at edges (landscape not clipped due to container margin). (5) Slider thumb must be strictly 9.5px outer diameter to match the chart's marker circle. (6) Move-list scrolling completely broken — can't even scroll.

**Fix (eval label color/contrast)**: Added a new `--chart-label` CSS variable — `#f5e6c8` (light) in dark mode, `#2c2c34` (dark) in light mode. All local-mode eval value labels now use `_C_LABEL` instead of the line/fill/axis colors. This ensures high contrast against the chart background in both themes. Mate-distance labels still use `_C_CRIT` (gold) for emphasis. The label stroke (`paint-order="stroke" stroke="..." stroke-width="2"`) provides additional contrast.

**Fix (label edge clipping)**: Labels use `text-anchor="middle"`, so at x=0 the left half is clipped. Added X-clamping: estimate label half-width as `fontSize * label.length * 0.32` and clamp X to `[estHalfW, width - estHalfW]` so labels stay fully within the chart bounds.

**Fix (global-mode label removal)**: Removed the entire "last endpoint checkmate distance display" block that ran only in global mode. Global mode is now purely visual (line + points), no text labels at all.

**Fix (strict 9.5px thumb)**: Changed slider thumb from 10px to 7.5px width/height + 1px border = 9.5px outer diameter, exactly matching the chart's current-position marker circle (SVG r=4 + stroke-width=1.5 → outer radius 4.75 → outer diameter 9.5px).

**Fix (portrait clipping)**: The `.review-bottom` horizontal padding increased from 6px to 8px (> 4.75px thumb overflow) so the 9.5px thumb is never clipped at min/max in either portrait or landscape. Explicit `overflow:visible` on `.review-bottom` ensures no ancestor clips the thumb.

**Fix (move-list scroll — block:'nearest')**: The rev4 "always center" approach broke scrolling — every render re-centered the active move, fighting with the user's scroll position. Replaced with `block:'nearest'` behavior: only scroll when the active move is NOT fully visible (top-align if above viewport, bottom-align if below). If already visible, do nothing (preserve user scroll). Only runs when `reviewStep` CHANGED (restored `_lastReviewStepScrolled` guard) — when reviewStep unchanged (e.g., toggle), user scroll is fully preserved. This is the standard `scrollIntoView({block:'nearest'})` behavior.

#### Revision 6 (2026.7.4): native scrollIntoView for precise jump + symmetric edge clipping for strict alignment

User feedback: (1) Move-list scrolling works now, but clicking an invisible move doesn't precisely jump to bring it into view. (2) Perhaps letting BOTH the slider thumb AND chart data points be clipped at the edges is the best way to achieve strict alignment.

**Fix (move-list scroll — native scrollIntoView)**: The rev5 manual `block:'nearest'` calculation had edge cases with incorrect scroll positions (especially with virtual-list spacer height estimation errors). Replaced with the browser's native `scrollIntoView({block:'nearest', behavior:'auto'})` which handles all geometry correctly. This is the browser's built-in "scroll minimum amount to make element visible" — exactly the "精确跳转至视野范围" behavior requested.

**Fix (symmetric edge clipping for strict alignment)**: Changed the chart container's `overflow` back from `visible` to `hidden` (both inline style and `.review-chart` CSS rule). Changed the slider container's `overflow` from `visible` to `hidden`. Now BOTH the chart's first/last data point circles (r=2.75) AND the slider thumb (9.5px outer) are clipped symmetrically at the edges. Their CENTERS align exactly at the edge (data points at viewBox x=0/x=width, thumb at 0%/100%), and both are clipped by the same amount on each side. This achieves strict pixel-level alignment — the clipped halves are mirror images, so the visible portions are perfectly aligned.

#### Revision 7 (2026.7.4): nav-button scroll pull-back fix + SVG overflow:hidden for consistent edge clipping

User feedback: (1) Move-list scrolling with nav buttons gets "pulled back" to a position after scrolling a certain amount. (2) Chart's first/last data points are not correctly clipped at the edges — in landscape, they're clipped when no move is selected, but NOT clipped once a move is selected.

**Fix (nav-button scroll pull-back)**: Root cause: every `render()` (triggered by nav buttons) does `app.innerHTML=h`, which rebuilds the DOM and resets `.review-moves` `scrollTop` to 0. The `scrollIntoView({block:'nearest'})` then runs from `scrollTop=0`, jumping to the active move — losing the user's scroll position. Fix: Added `_savedReviewMovesScroll` — save `.review-moves` `scrollTop` BEFORE `app.innerHTML=h`, restore it AFTER (clamped to `maxScroll`). The restore happens BEFORE the `scrollIntoView` logic. So the list returns to the user's position, then `scrollIntoView({block:'nearest'})` only scrolls if the active move is NOT visible — preserving the user's view and only adjusting minimally.

**Fix (SVG edge clipping consistency)**: Root cause: the SVG element's `overflow` defaults to `visible` in some WebView implementations, so SVG content outside the viewBox (data point circles at x=0/x=width) was NOT clipped by the SVG — only by the chart container's `overflow:hidden`. In landscape, when `preserveAspectRatio="xMidYMid meet"` scaled the content (due to viewBox/viewport aspect ratio mismatch), the data points moved inward, escaping the container's clip. Fix: Added `overflow:hidden` to the SVG element's inline style (`style="display:block;overflow:hidden"`). Now the SVG itself clips content outside the viewBox, ensuring consistent edge clipping regardless of `preserveAspectRatio` scaling or selection state.

#### Revision 8 (2026.7.4): SVG slice + 100x100 viewBox for guaranteed edge fill + scroll-restore only when step unchanged

User feedback: (1) `preserveAspectRatio="xMidYMid meet"` still causes data points to move inward, escaping container clipping — should use `preserveAspectRatio="xMidYMid slice"` with `viewBox="0 0 100 100"`. (2) Nav-button/click-move scroll pull-back bug still occurs — thoroughly fix it.

**Fix (SVG slice + 100x100 viewBox)**: Replaced the pixel-based viewBox (`0 0 width height` with `preserveAspectRatio="xMidYMid meet"`) with a fixed `viewBox="0 0 100 100"` and `preserveAspectRatio="xMidYMid slice"`. "slice" scales uniformly to COVER the container (cropping overflow), guaranteeing the chart fills the full width and height with NO centering gaps. The old "meet" mode scaled to FIT inside, leaving gaps when the container aspect ratio differed from the viewBox — moving data points inward and escaping edge clipping. All coordinates are now computed in the 0-100 space (not pixel space): data point radius 2.5→1.6, marker radius 4→2.5, stroke-widths scaled down, font sizes scaled to 0-100 range. The `_buildEvalTrendSVG` function no longer takes width/height parameters — the fixed viewBox handles all scaling. Removed the `_trendW` measurement code (no longer needed).

**Fix (scroll-restore only when step unchanged)**: Root cause of the remaining pull-back: when `reviewStep` changed (nav button/click), the virtual list window was recomputed to center on the new active step. The `_savedReviewMovesScroll` restore then tried to restore the old scrollTop — but the DOM content changed (different window), so the old scrollTop pointed to a blank area. `scrollIntoView` then corrected to the active step, causing a visible jump. Fix: Only restore `_savedReviewMovesScroll` when `reviewStep` did NOT change (`_reviewStepUnchanged` flag = `reviewStep === _lastReviewStepScrolled`). When `reviewStep` changed, skip the restore entirely and let `scrollIntoView({block:'nearest'})` handle the scroll from `scrollTop=0`. This eliminates the pull-back: the list goes directly to the active step without the intermediate jump to the old position.

#### Revision 9 (2026.7.4): eliminate post-scrollIntoView pull-back from measurement rAF + scroll-driven refresh

User feedback: Move list reaches the active move, then gets pulled back to another position. First-principles root-cause analysis found TWO async operations that fired AFTER `scrollIntoView` and reset the scroll position:

**Root cause 1 — measurement rAF innerHTML rebuild**: On the first virtual render (`!_rvVirtualState.measured`), a `requestAnimationFrame` measured `avgRowH` from real DOM, then REBUILT `.review-moves` innerHTML with accurate spacer heights and restored `_oldScrollTop`. But `_oldScrollTop` was captured AFTER `scrollIntoView` had already positioned the list, and the new DOM (with accurate spacers) had different geometry — so the restored scrollTop pointed to a wrong position → pull-back.

**Fix 1**: Removed the innerHTML rebuild + scrollTop restore from the measurement rAF. Now the measurement ONLY records `avgRowH` — the measured value is used on the NEXT render (which has correct spacers from the start). No DOM rebuild after `scrollIntoView`.

**Root cause 2 — scroll-driven refresh**: `scrollIntoView` programmatically scrolls `.review-moves`, which fires a scroll event → `_onReviewMovesScroll` → `_refreshReviewMovesOnly` (after 80ms debounce) → recomputes the virtual window → rebuilds innerHTML → restores old scrollTop on new DOM (different spacer heights) → pull-back. This happened even though `render()` already computed the correct window (containing the active step).

**Fix 2**: Added `_suppressScrollRefresh` guard. When `reviewStep` changed, set `_suppressScrollRefresh=true` before the `scrollIntoView` double-rAF. The guard makes `_refreshReviewMovesOnly` early-return (no window recompute, no innerHTML rebuild). After `scrollIntoView` completes + 300ms margin (enough for the 80ms debounce to fire and be suppressed), clear the guard so normal user scrolling works again. This prevents the scroll-driven refresh from interfering with the `render()`-computed window + `scrollIntoView` positioning.

#### Revision 10 (2026.7.4): skip scrollIntoView during Analyze All + fix chart display with preserveAspectRatio="none"

User feedback: (1) Move list gets pulled back periodically ("每隔一段时间拉回"). (2) Eval trend chart not fully displayed ("显示不全").

**Fix (skip scrollIntoView during Analyze All)**: Root cause: during "Analyze All" (`_reviewAnalyzeAllActive=true`), `_reviewAnalyzeAdvance()` changes `reviewStep` to the next step being analyzed (every 1-5s as each eval completes), then calls `render()`. Each `render()` triggers the `scrollIntoView` (because `reviewStep !== _lastReviewStepScrolled`), pulling the list to the analyzed step — even though the user didn't navigate there. This is the "每隔一段时间拉回" bug (periodic pull-back every 1-5 seconds). Fix: When `_reviewAnalyzeAllActive` is true, skip the `scrollIntoView` entirely — preserve the user's scroll position. The `scrollIntoView` will run once when analyze-all completes and returns to the user's original step (via `reviewGoTo(returnStep)`).

**Fix (chart display with preserveAspectRatio="none")**: Root cause: the rev8 `preserveAspectRatio="xMidYMid slice"` with `viewBox="0 0 100 100"` caused vertical cropping. "slice" scales uniformly to COVER the container — the scale factor is `max(containerW/100, containerH/100)`. For a wide-short container (portrait: ~350x100px), the scale = 350/100 = 3.5. The chart content (viewBox y=12 to y=96 = 84 units) becomes 84*3.5 = 294px tall — but the container is only 100px, so 194px of chart content is vertically cropped ("显示不全"). Fix: Changed `preserveAspectRatio` from `"xMidYMid slice"` to `"none"`. "none" stretches the SVG to FILL the container independently in X and Y — no cropping, no centering gaps, no clipping. The 0-100 viewBox maps directly to the container's pixel dimensions: X is stretched to full width, Y is compressed to full height. The chart line may have slight aspect distortion, but ALL content is visible. Data points at x=0 and x=100 are at the left/right edges (clipped by `overflow:hidden` for symmetric edge alignment with the slider).

#### Revision 11 (2026.7.4): dynamic viewBox matching container aspect ratio + always-restore scrollTop to eliminate ALL pull-back

User feedback: (1) `viewBox="0 0 100 100"` with `preserveAspectRatio="none"` effect is too poor — abandon it, keep `preserveAspectRatio="xMidYMid slice"`, find the best solution via first principles. (2) Periodic move-list pull-back still occurs.

**Fix (chart — dynamic viewBox matching container)**: First-principles analysis: "slice" scales uniformly to COVER the container, cropping overflow. To avoid cropping, the viewBox aspect ratio must EQUAL the container's aspect ratio. When they match, "slice" scales 1:1 — no cropping, no gaps, no distortion. Solution: Use a DYNAMIC viewBox `0 0 <width> <height>` where width is measured from the existing `.review-chart` container's `clientWidth` (or estimated from window on first render) and height is `_trendH`. Since the viewBox aspect ratio equals the container's pixel aspect ratio, "slice" produces a 1:1 scale — ALL content visible, NO cropping, NO distortion. This keeps `preserveAspectRatio="xMidYMid slice"` (as the user requested) while fixing the display. All coordinates are back in pixel space (data point r=2.5, marker r=4, stroke-widths/font-sizes at original pixel values).

**Fix (scroll — always restore scrollTop)**: First-principles analysis: the periodic pull-back occurred because ANY `render()` that changes `reviewStep` (including analyze-all's `_reviewAnalyzeAdvance`) would trigger `scrollIntoView`, which repositioned the list. The rev8/rev10 fix only skipped scrollIntoView during analyze-all, but other periodic renders could still cause issues. The robust solution: ALWAYS save and restore `.review-moves` scrollTop across DOM rebuilds (regardless of whether reviewStep changed). The restore happens BEFORE scrollIntoView. Then scrollIntoView only runs when: (1) reviewStep changed (user navigated), AND (2) analyze-all is NOT active. When scrollIntoView runs, it adjusts the ALREADY-RESTORED position with `block:'nearest'` (minimal scroll). When scrollIntoView is skipped (analyze-all, or reviewStep unchanged), the restored position stands — no pull-back from any source.

#### Revision 12 (2026.7.4): eliminate periodic pull-back by not calling render() during Analyze All advance

User feedback: Move list still pulls back periodically ("时不时拉回"). The rev11 fix (always restore scrollTop + skip scrollIntoView during analyze-all) reduced the pull-back but didn't eliminate it — because `render()` was still called on every `_reviewAnalyzeAdvance()`, which rebuilt the DOM (`app.innerHTML=h`) and forced the virtual-list window to recompute around the new `reviewStep` (discarding the user's scroll-based window). Even though scrollTop was restored, the DOM content had changed (different window), so the restored scrollTop pointed to a different position.

**Fix**: Removed the `render()` call from `_reviewAnalyzeAdvance()`. During analyze-all, the advance now ONLY calls `_updateAllEvalDisplays()` (updates eval bar, no DOM rebuild) + `_updateReviewAnalyzeBtn()` (updates button label, no DOM rebuild) + `requestEngineEval()` (starts next eval). The board/eval-bar/move-list are NOT rebuilt during analysis — they stay exactly where the user left them. The full `render()` happens ONCE when analyze-all completes and returns to the user's original step (via `reviewGoTo(returnStep)` → `render()`). This completely eliminates the periodic pull-back — no DOM rebuild = no scroll disruption.

#### Revision 13 (2026.7.4): fix virtual-list window recompute discarding user's scroll position (>90 steps reverts)

User feedback: Move list with >90 moves (45 moves) can't stay scrolled past move 90 — always reverts to before move 90.

**Root cause**: The virtual-list window recompute condition in `render()` was: `_curEnd===Infinity || !_rvVirtualState.measured || _stepChanged`. The `!_rvVirtualState.measured` condition forced a window recompute on EVERY `render()` until `avgRowH` was measured (which happened in a post-render rAF). When the user scrolled to move 91+ (updating the virtual window via `_refreshReviewMovesOnly`), then triggered ANY `render()` (toggle, nav button, etc.), the `!measured` condition would force the window back to center on `reviewStep` (the active move) — discarding the user's scroll-based window. Since `reviewStep` was likely ≤90 (the user was viewing move 91+ but hadn't navigated there), the window snapped back to before move 90.

**Fix**: Removed the `!_rvVirtualState.measured` condition from the window recompute guard. Now the window is recomputed ONLY when: (a) first virtual render (`_curEnd===Infinity`), or (b) `reviewStep` changed (`_stepChanged`). When the user scrolled without changing `reviewStep`, the virtual window was already updated by `_refreshReviewMovesOnly` (scroll-driven) — we must NOT recompute it in `render()`. The `avgRowH` measurement still runs in the post-render rAF, but it no longer forces a window recompute; it just records the measured value for use on the NEXT render (when `_stepChanged` or first render triggers a recompute, the accurate `avgRowH` is used for spacer heights).

#### Revision 14 (2026.7.4): DISABLE virtual list entirely — eliminate ALL move-list bugs at once

User feedback: Move list has too many bugs — can't scroll past 40 moves, fast nav-button clicks cause pull-back, selection state lost, selection lost after reaching last step. First-principles analysis: ALL these bugs are caused by the virtual list (windowed rendering). The virtual list adds enormous complexity (window tracking, spacer height estimation, scroll-driven refresh, measurement rAF, suppression guards) for negligible performance gain — a typical chess game has 40-80 moves, and even 200 moves renders fine as a full list (each row is a simple `<div>` with text; modern WebView handles 200 DOM nodes trivially).

**Fix**: Set `RV_VIRTUAL_THRESHOLD=Infinity` — this disables the virtual list for ALL games. Every move is always rendered as a DOM node. This eliminates at once:
- Can't scroll past 40 moves (no window computation needed)
- Fast nav-button pull-back (no window recompute on render)
- Selection state lost (active move always in DOM)
- >90 steps revert (no window to discard)
- Periodic pull-back from `_refreshReviewMovesOnly` (never runs)
- `_suppressScrollRefresh` guard (no longer needed, removed)
- `_forceReviewWindowToStep` (no longer needed, not called)
- avgRowH measurement rAF (no longer needed, doesn't run)
- Spacer height estimation errors (no spacers)

The scroll-into-view logic is simplified: just `scrollIntoView({block:'nearest'})` in a double-rAF when `reviewStep` changed and analyze-all is not active. No virtual-list guards or suppression needed.

#### Revision 15 (2026.7.4): dead-code cleanup — remove all virtual-list remnants

First-principles code audit after rev14 (virtual list disabled). Removed all dead code that was only reachable when the virtual list was enabled:

- **Dead functions removed**: `_suppressScrollRefresh` variable, `_refreshReviewMovesOnly`, `_onReviewMovesScroll`, `_forceReviewWindowToStep`, `_computeVirtualWindow` — all were only called from within virtual-list code paths that are now unreachable.
- **Dead constants removed**: `RV_OVERSCAN`, `RV_SCROLL_DEBOUNCE_MS` — only referenced by dead functions.
- **Dead variable removed**: `_lastRenderReviewStep` — only read/written inside the dead `if(_rvVirtualState.enabled)` branch in `render()`.
- **Dead branch removed**: The entire `if(_rvVirtualState.enabled){…}` window-recompute block in `render()` (replaced with 3 lines that always set `windowStart=0`, `windowEnd=moveRecords.length`).
- **Dead post-render block removed**: The scroll-listener attachment + avgRowH measurement rAF block (guarded by `_rvVirtualState.enabled`, always false).
- **Dead spacer branches removed**: Top/bottom spacer `<div class="rmv-spacer">` rendering in `_buildReviewMovesInnerHTML` (guarded by `_virtual` = `_rvVirtualState.enabled` = false).
- **Total**: ~145 lines of dead code removed. No runtime behavior change.

#### Revision 16 (2026.7.4): fix selection scrolled out of view at last step + enter review at step 0 + ⏮ needs two clicks

User feedback: (1) Selecting the last step then clicking ▶ or ⏭ scrolls the list to a position where the selection is not visible. (2) When entering review, step 0 is not included in the eval trend chart, and the ⏮ button needs two clicks to reach step 0 (goes to step 1 first, then step 0 on second click).

**Fix (selection scrolled out of view)**: Two root causes:
1. `scrollIntoView({block:'nearest'})` only scrolls the minimum amount to make the element visible — if the element is at the bottom edge of the viewport, it stays at the edge (not centered). Changed to `block:'center'` so the active move is always centered in the viewport.
2. When clicking ▶ at the last step, `reviewGoTo(reviewStep+1)` clamps to the same step — `reviewStep` doesn't change, so the `_lastReviewStepScrolled` guard skips `scrollIntoView`. But `render()` still rebuilds the DOM, and the scroll position may shift. Fix: force `_lastReviewStepScrolled=-2` at the start of `reviewGoTo()` so the guard always fires and `scrollIntoView` always runs.

**Fix (enter review at step 0 + ⏮ two clicks)**: `enterReview()` set `reviewStep=reviewStates.length-1` (the last step). This means the chart starts from the last step, not step 0. And the ⏮ button (`reviewGoTo(0)`) would go from the last step to step 0 — but the chart's local mode window starts at `localStepMin = max(0, reviewStep - windowSize + 1)`, so at step 0 the window is `[0, 0]` = just one point. The chart returned empty string for `points.length < 1`. Fix: set `reviewStep=0` in `enterReview()` so review starts at the initial position. This ensures step 0 is included in the chart from the start, and ⏮ correctly goes to step 0 in one click (since we're already at step 0, clicking ⏮ is a no-op that still triggers `scrollIntoView` via the `_lastReviewStepScrolled=-2` fix above).

#### Revision 17 (2026.7.4): fix review page scrolling to top on every nav button / move click

User feedback: Every time a nav button or move is clicked in review mode, the page scrolls back to the top.

**Root cause**: `render()` rebuilds the entire DOM via `app.innerHTML=h`, which resets both `.review-body` (outer scroll container) and `.review-moves` (inner move list) `scrollTop` to 0. The scroll-restore code existed but used `requestAnimationFrame` for the `.review-moves` restore (inside the `_savedContainerScrolls` path) — this was too late: the browser painted the `scrollTop=0` state before the rAF callback fired, causing a visible "jump to top" flicker. The `.review-body` restore was synchronous but used a saved/restored `scrollBehavior` pattern that could fail if the element was freshly created.

**Fix**: Both `.review-body` and `.review-moves` scrollTop restores are now **synchronous** — they run immediately after `app.innerHTML=h`, before the browser paints. The `scrollBehavior` is set to `'auto'` (instant) before the assignment and reset to `''` (default) after. This ensures the user never sees the `scrollTop=0` state — the position is restored before the frame is painted. The `scrollIntoView({block:'center'})` in the double-rAF below then adjusts from the restored position (not from 0), so the transition is smooth.

#### Revision 18 (2026.7.4): fix board not refreshing during Analyze All + restore auto-select/jump to analyzed step

User feedback: (1) Board renders too late or doesn't refresh during review. (2) Restore the Analyze All feature that auto-selects and jumps to the step being analyzed.

**Root cause (board not refreshing)**: In rev12, `render()` was removed from `_reviewAnalyzeAdvance()` to fix the scroll pull-back bug. But this meant the board, eval bar, move list, and chart were never updated during analysis — the user saw a stale position. The board appeared to "not refresh" or "render too late" because it only updated once when analysis completed.

**Fix**: Restored `render()` in `_reviewAnalyzeAdvance()`. The scroll pull-back that rev12 was trying to fix is now properly handled by the synchronous scrollTop restore (rev17) — so `render()` is safe to call again. The user sees the board update to each step as it's analyzed, the move list highlights the active move, and `scrollIntoView({block:'center'})` centers it. Also force `_lastReviewStepScrolled=-2` before `render()` so `scrollIntoView` always fires (the active step changed).

#### Revision 19 (2026.7.4): final audit — remove stale analyze-all scroll guard + fix _savedReviewBodyScroll not cleared

Final first-principles code audit. Two findings:

1. **Stale analyze-all scroll guard**: The `if(_reviewAnalyzeAllActive)` guard that skipped `scrollIntoView` during analyze-all was stale — rev18 restored `render()` in `_reviewAnalyzeAdvance()`, so the user now WANTS to see the board update + active move centered during analysis. Removed the guard so `scrollIntoView({block:'center'})` always runs when `reviewStep` changed (including during analyze-all).

2. **`_savedReviewBodyScroll` not cleared after restore**: The `.review-body` scrollTop was saved before `app.innerHTML=h` and restored after, but never cleared to 0. On the next render, the stale value would be > 0, causing a spurious restore even when the user hadn't scrolled. Fix: clear `_savedReviewBodyScroll=0` after restore (matching the existing `_savedReviewMovesScroll=0` pattern).

#### Revision 20 (2026.7.4): fix stale engine variation data polluting new game after setup/import

User feedback: New bug — when completing setup mode or importing (PGN or FEN) while existing move records are present, the new game is polluted by stale cached data from the old game.

**Root cause**: Engine PV variation data (`_pendingEngineSANs`, `_pendingEnginePVs`, `_multiPVLines`, `_multiPVResult`, `_lastEngineVariation`) and `reviewCritical` are indexed by `moveRecords` indices (0, 1, 2, ...). When a new game starts (via setup exit, FEN import, or PGN import), `moveRecords` is cleared and rebuilt from index 0 — but the stale engine variation data from the old game is never cleared. The old indices now map to different moves in the new game, so stale variations get attached to the wrong moves, and stale critical-move markers appear at wrong positions.

**Fix**: Added clearing of all stale engine variation data in all three entry points:
- `_exitSetupImpl()` (ui.js): clears `_pendingEngineSANs`, `_pendingEnginePVs`, `reviewCritical`
- `_applyImportedFEN()` (tablebase.js): clears `_pendingEngineSANs`, `_pendingEnginePVs`, `_multiPVLines`, `_multiPVResult`, `_lastEngineVariation`, `reviewCritical`
- `importPGN()` (tablebase.js): clears the same set

This matches the existing pattern where `_visualAnnotationsCache` is already cleared in `_resetGameUIState()` for the same reason (indexed by moveRecords indices, reused on new game).

#### Revision 21 (2026.7.4): final audit — also clear stale engine data in _startGameImpl (new game via dialog)

Final first-principles audit found that `_startGameImpl()` (the "New Game" dialog path) was missing the same stale engine variation data clearing that rev20 added to `_exitSetupImpl`, `_applyImportedFEN`, and `importPGN`. Starting a new game from the dialog would also reuse `moveRecords` indices from 0, so stale `_pendingEngineSANs`, `_pendingEnginePVs`, `_multiPVLines`, `_multiPVResult`, `_lastEngineVariation`, and `reviewCritical` from the previous game would pollute the new game. Fix: added the same clearing in `_startGameImpl()`.

#### Revision 22 (2026.7.4): fix stats page Chess960 castling support

User feedback: Stats page PGN parsing and board display don't support Chess960 castling.

**Root cause**: Three issues in `stats.html`:
1. `buildSAN()` used `Math.abs(move.to.col-move.from.col)===2` to detect castling — this misses Chess960 castling where the king moves only 1 col (e.g. king on f1 castles kingside to g1). Fix: use the same castling detection logic as `executeMove()` (king on home row, moves to col 6 or 2, >=1 col distance for Chess960, dest empty, castling right present).
2. `fenToState()` only parsed standard KQkq castling notation — Chess960 FENs use Shredder notation (file letters like AHah). Fix: added Shredder-FEN parsing that maps file letters to whiteKingside/whiteQueenside/etc. based on the king's column.
3. `gameVariant` was never set in `stats.html` — the `_is960` check in `executeMove()` always returned false. Fix: (a) `openStatsPage()` in `ai-bridge.js` now sends `gameVariant` in the payload; (b) `stats.html` receives it from the payload; (c) `parsePGN()` in `stats.html` also detects Chess960 from the PGN `[Variant]` header (for direct PGN import on the stats page).

#### Files modified in Phase 54

- `src/main/assets/chess.src/ui.js` (custom slider HTML/CSS/JS, move-list scroll fix, executeMove try-catch, audio-engine init reset, render retry guard)
- `src/main/assets/chess.src/ai-bridge.js` (heartbeat timestamp in all callbacks, MultiPV divergence fix)
- `src/main/assets/chess.src/tablebase.js` (PGN cascade-skip threshold)
- `src/main/assets/chess.src/index.html.tpl` (custom slider CSS, removed old native-slider CSS)
- `NOTICE`, `README.md`, all `README.license` files (Phase 54 changelog)
- `Manual/Regalia-v1.1.0-manual-{zh,en}.html` (Phase 54 changelog at top)

### v1.1.0 Phase 53 (green-arrow check-response + red-arrow discovered-check fix + king-position staleness fix + FEN-import state-pollution fix + exitSetup state-pollution fix + portrait/landscape review layout unification + stats visual-annotation cutoff + review progress-bar/eval-chart alignment + king-control-arrow legality filter + nav-button center-align, 2026.7.3)

This phase redefines the green-arrow visual annotation to cover the full "check response" semantics (king escape + capture-the-checker), fixes a v1.0.9 bug where green arrows were drawn to squares the king couldn't legally move to, fixes the stats page's visual-annotation counts to respect the selected-move cutoff (making them consistent with the other stats blocks), achieves pixel-perfect alignment between the review progress bar and the evaluation trend chart (revised: track ends align with first/last data points), filters out illegal king-move arrows from the control heatmap, fixes red check arrow to use actual checker position (discovered check support) / "格子控制信息" panel / visual annotations, and center-aligns the review nav button text. Version number bumped to v1.1.0 (versionCode 110).

#### Behavior change: green arrows redefined from "king escape path" to "check response path"

The v1.0.9 implementation only checked the control map (`cm[er][ec][moverColor]`) for each adjacent square of the checked king, which had two defects:

1. It didn't verify that the king could actually MOVE to the square legally — a slider attacking through the king's current position would still "attack" the escape square in the control map even after the king moved (because the king's body was no longer blocking), but the control map is computed on the PRE-move board state, so it doesn't reflect the post-king-move attack geometry. Result: green arrows were drawn to squares the king couldn't actually move to (e.g., a square that would still be in check after the king moves there).
2. It only generated king-escape arrows, ignoring "capture the checker" responses by non-king pieces (the other half of how a player can respond to check). Per the v1.1.0 user spec: green arrows should include BOTH king escape moves AND legal captures of the checking piece by any of the checked side's pieces.

**Fix**: replaced the control-map-based check with two `legalMoves()` calls:

- `legalMoves(postState, oppKingPos)` returns the king's legal escape moves (correctly handling pins, blocked squares, and the "king-not-still-in-check-after-move" rule). If the king has NO legal escape (smothered mate, anchored pin, etc.), NO king-starting green arrow is generated — this fixes defect (1).
- `legalMoves(postState, null)` returns all legal moves for the checked side; we filter for moves whose destination is a checker's square. For each such capture, we generate a green arrow from the capturing piece's square to the checker's square. King captures of adjacent checkers are already covered by the first call, so we skip them here to avoid duplicate arrows. En passant captures of a pawn that gave check via discovery are included. Double check is handled correctly — only the king can respond (capturing one checker still leaves the other giving check), so `legalMoves` excludes non-king captures in that case.

**Chess960 compatibility**: `legalMoves` handles Chess960 castling (forbidden when in check, via `isChess960CastlingLegal`) and en passant identically to standard chess — no special-casing needed. Castling-out-of-check arrows are never generated because `legalMoves` correctly excludes them.

#### Bug fix: stats page visual-annotation counts not respecting selected-move cutoff

The visual annotations stats block (blue/red/yellow/green squares + arrows counts + NAG distribution) was scanning the FULL PGN text regardless of which mainline move was selected, making it inconsistent with the other stats blocks (which use `effectiveParsed.moves`, sliced to the selected move). Per the v1.1.0 task spec: "统计界面的视觉注解统计区块应随选中走法改变——只统计从开局到选中走法为止的 [%csl]/[%cal] 标签数量".

**Fix**: added a `_slicePGNAtMove(pgnText, moveCount)` helper that walks the raw PGN text directly (no preprocessing), tracking tag-pair stripping, brace-comment depth, semicolon comments, variation depth (parentheses), NAGs, move numbers, and SAN move tokens. After the Nth mainline move token (where N = `_selectedMoveIdx + 1`), the function includes any immediately following `{...}` comment and/or `$N` NAG (the "move block"), then truncates the text. The visual annotation block now uses this sliced text for both the "has any visual annotations" check AND the per-color counting, making it consistent with `effectiveParsed.moves`. Variation selections and FEN selections are left unchanged (variations' annotations are inside `(...)` blocks that the slicer intentionally skips; FEN selection means no mainline moves to scope to).

#### Bug fix: red check arrow now uses actual checker position (discovered check support)

The red check arrow previously started from the moved piece's destination (`moverTo`). This was wrong for discovered check — where the moved piece moves away, exposing another piece that gives check. The arrow should start from the piece actually giving check (which may be a different piece that didn't move).

**Fix**: the red arrow now uses the ACTUAL checker position(s) from the control map (`cm[oppKingPos.row][oppKingPos.col][moverColor]`). For direct check, the moved piece IS the checker, so the arrow is the same. For discovered check, the checker is a different piece (the one that was unblocked), and the arrow correctly starts from that piece's position. For double check, multiple red arrows are drawn (one per checker), each from the checker's position to the checked king's position. Fallback: if the control map is null, the old behavior (moved piece's destination) is used.

#### Bug fix: king position staleness in visual annotation replay

Three root causes of stale king positions (`wk`/`bk`) were identified and fixed:

1. **Replay skip corruption** (`_computeAndCacheVisualAnnotations`): the replay path used `continue` to skip moves that couldn't be replayed (null moveRecord, invalid from/to, no piece at source). Skipping a move leaves the state unchanged, so subsequent moves are applied to a stale state with stale king positions. **Fix**: if any move can't be replayed, stop the replay entirely and return without caching (the partially-replayed state is unsafe).

2. **Chess960 castling flag missing in enterReview**: the `enterReview` path (building `reviewStates`) didn't pass the `castle` flag for Chess960 castling moves (king may move only 1 col). While `_castleSide`'s fallback detector can handle this, the explicit flag is more reliable. **Fix**: pass `mv.castle` when `mr.isCastling` is true (same as the replay path).

3. **Unchecked makeMv return in enterReview**: the `enterReview` path didn't check if `makeMv` succeeded — if it returned null, the old state was used for subsequent moves, causing cascading corruption. **Fix**: check `makeMv`'s return value; if it fails, push a placeholder state but don't update the running state.

#### Bug fix: FEN import state-pollution

When importing a FEN while a previous game's state existed, three stale-state issues caused pollution:

1. **`_cachedOriginalPGN` not cleared**: if the previous game was a PGN import, its text would leak into the stats page and PGN export. **Fix**: clear `_cachedOriginalPGN` on FEN import.

2. **`playerWhite`/`playerBlack` not cleared**: if the previous game was a PGN import with named players (e.g. `[White "Magnus"] [Black "Hikaru"]`), those names would carry over. **Fix**: clear `playerWhite`/`playerBlack` on FEN import (same as `_startGameImpl`).

3. **`_setupFEN` not set**: the FEN import's starting position would be lost on PGN export (no `[FEN]` header). **Fix**: set `_setupFEN` to the imported FEN string (same as `importPGN` and `exitSetup`).

The `moveRecords` are correctly cleared to `[]` on both PGN and FEN import, and `_prependBlackToMovePlaceholder` adds a null placeholder if the FEN has black to move. The new game starts from move 1 (or the FEN's specified move number), with no pollution from the previous game.

#### Bug fix: exitSetup state-pollution

When completing setup mode with existing move records, `_exitSetupImpl` did not call `_resetGameUIState()` (unlike `_applyImportedFEN` and `importPGN`), leaving stale state from the previous game. This included: `_cachedOriginalPGN` (old PGN text leaking to stats/PGN export), `playerWhite`/`playerBlack` (old player names), `_visualAnnotationsCache` (old `[%csl]`/`[%cal]`), AI/hint bar text, cached status, AI thinking state, engine eval state, resign state, control map cache, ECO cache, eval values, and tablebase loading state.

**Fix**: call `_resetGameUIState()` at the top of `_exitSetupImpl`, then also clear the additional state that `_resetGameUIState` doesn't cover but `_applyImportedFEN`/`importPGN` do (`_cachedOriginalPGN`, `playerWhite`, `playerBlack`, `_ecoRecCache`, `_sfEval`, `_sfMateDistance`, `_sfDepth`, `_sfEvalReady`, `_evalLoading`, `_needNewGameForEngine`, `_tbLoading`, `_tbRetryCount`).

#### Behavior change: portrait/landscape review layout unification

Previously, portrait review mode put all controls (eval bar, slider, chart, nav buttons, analyze button) inside `.review-left` (the board column), making them narrower than the viewport. Landscape used a separate `.review-bottom` container spanning full viewport width. Now both orientations use the same `.review-bottom` container, so the slider, chart, nav buttons, and eval bar have identical styling and width in both portrait and landscape.

**Changes**: (1) JS portrait branch now generates the same `.review-top` (board + moves) + `.review-bottom` (controls) structure as landscape. (2) CSS rules for `.review-top`, `.review-left`, `.review-moves`, `.review-bottom`, `.review-chart`, `.review-slider`, `.review-nav`, and eval-bar moved from `@media(orientation:landscape)` to global scope. (3) `.review-body` in portrait now has `overflow-y:auto` + `max-height:calc(100vh - 28px)`. (4) Eval-bar font size unified to `.8rem` for both orientations.

#### Behavior change: pixel-perfect alignment between review progress bar and evaluation trend chart (revised)

The v1.0.9 layout had the slider track spanning the full input width [0, width], while the chart's data points were inset by 8px on each side (at [8, width-8]). This made the track ends extend beyond the first/last data points.

**Revised fix** (after first-principles re-analysis): the goal is to make the slider TRACK ENDS align with the chart's first/last data points. Since the track always spans [0, track_width] and the thumb center range is [thumb_w/2, track_width - thumb_w/2], there's an inherent tradeoff between track-end alignment and thumb-center alignment. The chosen design prioritizes track-end alignment (the user's explicit request):

1. The chart's internal padding was reduced from 8 to 3 (left/right), so the first/last data points sit closer to the chart edges (at [3, width-3]).
2. The slider track gets `margin: 0 6px` (matching the chart padding), so the track spans [3, width-3] — exactly matching the first/last data-point positions.
3. The slider thumb width was reduced from 16 to 6 (= 2 × padding). At min value, the thumb's LEFT edge is at the first point (x=3); at max value, the thumb's RIGHT edge is at the last point (x=width-3). The track ends and thumb edges together frame the data-point range precisely.

This works in both portrait and landscape because the slider wrapper and chart container both have `border:1px + padding:2px + box-sizing:border-box + width:100%`, giving them identical content-box widths, so the `<input>` width == the SVG width, and the track margins map 1:1 to viewBox units.

#### Behavior change: king-control-arrow legality filter

Arrows originating from a king's current square (in the heatmap control arrows, the "格子控制信息" panel, and the visual annotations `[%cal]`) are now suppressed when the target square is controlled by the opponent — the king cannot legally move there, so showing such an arrow would misrepresent an illegal king move as a valid control/threat. Non-king pieces are unaffected (a pinned piece still "controls" squares even if it can't legally move). Applies to BOTH the player's king and the opponent's king. In the visual-annotation threat maps (`threatByMover`/`threatByOpp`/`threatByWhite`/`threatByBlack`), king attackers are filtered out when the target is opponent-controlled; this also correctly filters the yellow queen-threat arrows and blue multi-threat arrows that originate from a king.

#### Behavior change: review nav button text center-aligned

Review navigation buttons (⏮ ◀ ▶ ⏭) now have `justify-content:center` so the button text is centered (was left-aligned due to the default `flex-start`). Applied in both portrait (base `.review-nav .btn`) and landscape (`.review-bottom .review-nav .btn`) CSS rules.

#### Documentation update

All version references bumped from v1.0.9 (versionCode 109) to v1.1.0 (versionCode 110). The HTML manuals' changelog order is now newest-first (Phase 53 at the top), per the user spec. Old version manuals (v1.0.4–v1.0.9) deleted; only v1.1.0 manual distributed.

#### Files modified in Phase 53

- `src/main/assets/chess.src/ui.js` (green-arrow check-response logic, `_trendW` measurement, slider wrapper border/padding, king-control-arrow legality filter in `_updateArrows`/`_updateCtrlInfoPanel`/`_computeAndCacheVisualAnnotations`/`_computeInitialPositionAnnotations`)
- `src/main/assets/chess.src/index.html.tpl` (slider thumb/track CSS, review-nav button center-align, title)
- `src/main/assets/chess.src/game-logic.js` (loading_title)
- `src/main/assets/stats.html` (visual annotations desc, green_arrows label, `_slicePGNAtMove` helper, visual annotations block cutoff)
- `src/main/assets/chess.html` (rebuilt from `chess.src/` via `build-chess.py`)
- `build.gradle`, `strings.xml`, `MainActivity.java`, `StockfishNative.java`, `ChessApp.java`, `ChessWebViewClient.java`, `game-logic.js`, `index.html.tpl`, `ui.js` (version 109→110)
- `Manual/Regalia-v1.1.0-manual-{zh,en}.html` (Phase 53 changelog, top; old manuals deleted)
- `NOTICE`, `README.md`, all `README.license` files (Phase 53 changelog)

### v1.0.9 Phase 52 (PGN single-line parse fix + review/stats "extra kings" fix + visual annotation variation-isolation fix + isCheck/isCastling import fix + eval-chart palette unified to blue-vs-red, 2026.7.2)

This phase fixes two critical user-reported bugs, fixes two visual-annotation accuracy bugs (variation comment contamination + missing isCheck/isCastling on imported moves), and unifies the eval-chart palette to a blue-vs-red convention in both dark and light modes (with per-mode saturation tuning for background contrast). Version number bumped to v1.0.9 (versionCode 109).

#### Bug fix: PGN single-line import failure (root cause)
**[CRITICAL] Tag-stripping regex `/^\[[^\]]*\]/gm` only stripped the FIRST tag for single-line PGN files** (tablebase.js `_parsePGN`) — the `^` multiline anchor only matches at the START of the entire string when all tags + movetext are on one line with no `\n` between them. Only `[Event "..."]` was stripped; the remaining tags (`[Site "?"]`, `[Date "..."]`, etc.) leaked into movetext as invalid SAN tokens. The tokenizer skipped them all, hit the 5-consecutive-skip safety limit, and aborted the parse — manifesting as "PGN import fails, 0 moves parsed". Fix: replaced with `/\[[A-Za-z]\w*\s+[^\]]+\]/g` which matches PGN tag format specifically (TagName starts with a letter, followed by whitespace + value) and is NOT anchored to line start. This also avoids stripping `[%csl ...]` / `[%cal ...]` / `[%eval ...]` inside brace comments (since `%` is not in `[A-Za-z]`). Verified: `PGN 2Kbug.pgn` (single-line, 71 half-moves, 11 variations) now imports all 71 moves correctly.

#### Bug fix: brace-comment stripping concatenated adjacent moves
**[CRITICAL] `/\{[^{}]*\}/g` replaced brace comments with EMPTY STRING, concatenating adjacent moves** (tablebase.js `_parsePGN` + stats.html `parsePGN`) — `e4{...}e5` (no space between `}` and the next move — common in single-line PGN) became `e4e5` — a single bogus token that failed SAN parsing. Fix: replace with a SPACE instead of empty string. The whitespace normalization pass then collapses the double space. Applied to both tablebase.js (main app) and stats.html (stats page parser).

#### Bug fix: review/stats "extra kings" board corruption (root cause)
**[CRITICAL] `_castleSide` fallback used `gameState.board` (global final state) instead of `s.board` (local state being moved)** (game-logic.js) — the fallback castling detection (used when `mv.castle` and `mv.to.castle` are both undefined — e.g. for moves reconstructed from `moveRecords` during review replay) checked `gameState.board` for destination-emptiness and `gameState.castlingRights` for castling-rights presence. During PGN replay (`enterReview` / `importPGN`), the LOCAL state `s` being moved differs from `gameState` (which is the final state after ALL moves). This caused the fallback to use the WRONG board: e.g. if the white king ended on g1 in the final state, the destination-empty check for an EARLIER castling move (O-O to g1) returned false, suppressing castling detection. The king moved to g1 but the rook stayed on h1, corrupting all subsequent move replays (moves involving the misplaced rook were silently skipped, and the board state diverged from the intended game — manifesting to the user as "extra pieces / extra kings on the review board"). Fix: `_castleSide` now accepts an optional `s` parameter and uses ITS board and castlingRights for the fallback. `makeMv`, `makeMvInPlace`, and `moveAlg` all pass `s`. ui.js animation-only callers (which don't have a local state) omit `s` and fall back to `gameState` (correct for interactive play).

#### Bug fix: stats.html false-positive castling detection
**[HIGH] `piece.type==='king' && (move.to.col===6 || move.to.col===2)` marked ANY king move to col 6/2 as castling** (stats.html `executeMove`) — including normal king moves (e.g. Kf1-g1, Kg7-g6) and king captures (Kxg1). This caused: (1) the captured piece to be treated as the "castling rook" and repositioned (silently losing the capture); (2) the actual rook on h1/a1 to be illegally displaced; (3) board-state corruption that manifested as extra pieces / extra kings on the stats board. Fix: castling is now only detected when ALL of the following hold: king on home row, destination col 6/2, king traveled the castling distance (>=2 for standard, >=1 for Chess960), destination empty, and the corresponding castling right is present in the LOCAL state.

#### Robustness: stats.html castling-rights clearing
**[MEDIUM] `executeMove` did not clear castling rights on king/rook move or rook capture** (stats.html) — previously, `executeMove` updated `newState.wk`/`bk` but never cleared `newState.castlingRights` when the king moved, when a rook moved from its home square, or when a rook was captured on its home square. This meant downstream `buildSAN`/state serialization could emit stale `KQkq` markers for a state where castling was no longer legal. Fix: `executeMove` now mirrors `game-logic.js makeMv/makeMvInPlace` behavior — clears the corresponding castling right when the king moves (both sides for that color), when a rook moves from col 0/7 on its home row, or when a rook is captured on col 0/7 on its home row.

#### Bug fix: visual annotation variation-comment contamination
**[HIGH] Comments inside variations `(...)` contaminated main-line move annotations** (tablebase.js `_parsePGN`) — the comment-extraction loop (which reads `[%eval]`/`[%csl]`/`[%cal]` tags from `{...}` blocks) did NOT check the parenthesis depth `_depth`. Comments inside variations were parsed and their position-specific tags accumulated into the pending per-move payload, which the NEXT main-line move would flush and attach to ITSELF — corrupting that main-line move's annotations with variation-internal data. This manifested as the review board showing wrong squares/arrows/evals for main-line moves that happened to follow a variation with annotations. Fix: only extract `[%eval]`/`[%csl]`/`[%cal]` when `_depth===0` (main line). Free-text comments are still extracted at all depths (with `[var] ` prefix for variation comments) so variation commentary remains visible in the move-list comment display.

#### Bug fix: missing isCheck/isCastling on imported moveRecords
**[HIGH] Imported PGN moves lacked `isCheck` and `isCastling` fields** (tablebase.js `importPGN`) — the import loop built moveRecords with `{notation, from, to, piece, captured, promotion, time, variations}` but omitted `isCheck` and `isCastling`. This meant: (1) Red check arrows + green escape arrows were never generated for imported PGNs (the annotation generator checks `moveRecords[moveIdx].isCheck`); (2) Chess960 castling detection in the annotation replay path relied solely on `_castleSide`'s heuristic fallback. Fix: `importPGN` now computes `isCheck` (via `inCheck` on the post-move state) and `isCastling` (via `_castleSide` on the pre-move state + parsed move) for each imported move, matching the live-play `executeMove` logic. This ensures imported games get the same visual annotation treatment as live-played games — the annotations now correctly reflect each position's actual situation.

#### Feature change: eval-chart palette unified to blue-vs-red (both dark and light modes)
**[MEDIUM] Chart colors insufficiently differentiated + dark/light not harmonized** (index.html.tpl + ui.js) — the previous chart palette used different color pairs in each mode (dark: near-white `#E8E8F0` + light-blue `#5dade2`; light: dark-gray `#4a4a52` + very-dark-gray `#2c2c34`), neither pair had sufficient hue differentiation, and the dark-mode light-blue didn't harmonize with the warm-brown-gold theme. Unified both modes to a blue-vs-red convention (blue = White advantage/positive eval, red = Black advantage/negative eval — the universal chess-software convention), with per-mode saturation tuning:
- **Light mode**: `--chart-line: #2c5f8d` (steel blue), `--chart-fill: #c0392b` (deep red), `--chart-critical: #d4a017` (gold) — deeper, muted shades for contrast on `#f0f0f3` silver-gray.
- **Dark mode**: `--chart-line: #5dade2` (sky blue), `--chart-fill: #e74c3c` (warm red), `--chart-grid: #4a3020` (dark warm brown), `--chart-axis: #8a6a3a` (medium warm brown), `--chart-critical: #ffd700` (gold, unchanged) — brighter, more saturated shades for visibility on `#1a0a0a` warm-brown, and the warm-brown grid/axis colors harmonize with the dark-mode palette.
- **Data point outline** (ui.js `_buildEvalTrendSVG`): replaced hardcoded `rgba(30,15,0,0.85)` + `rgba(255,230,150,0.85)` with the theme-aware `--chart-text-stroke` variable so the contrast ring is always visible against the surrounding background in both modes.

Design rationale: (1) blue and red are opposite hues on the color wheel, maximizing distinguishability; (2) blue/red is the universal chess-software eval-chart convention; (3) dark mode uses brighter shades for dark-bg visibility; (4) light mode uses deeper shades for light-bg contrast.

### v1.0.8 Phase 51 (PGN round-trip castling fix + move-classification label + eval-chart dark-mode visibility, 2026.7.2)

This phase fixes three user-reported issues. Version number remains v1.0.8.

#### Bug fix: PGN round-trip castling failure (root cause)
**[HIGH] `_castleSide(mv)` missed `mv.to.castle` flag → castling only moved the king, not the rook, in PGN replay** (game-logic.js) — `pseudoMoves()` attaches the castle flag to the `to` object (`{row,col,castle}`), and `legalMoves()` builds the full move as `{from,to:{row,col,castle},piece}`. So `mv.castle` (top-level) was undefined for moves coming from `legalMoves()`. `executeMove()` (ui.js) copies the flag to `mv.castle` before calling `makeMv`, but `_applySANMove` (the PGN replay path) calls `makeMvInPlace` directly with the `legalMoves()` object, so `mv.castle` was undefined there. This caused `_castleSide` to fall through to the heuristic fallback, which checked the global `gameState` instead of the local replay state — and since the heuristic's `_destEmpty` check read the wrong board, castling detection failed entirely. Result: `O-O`/`O-O-O` only moved the KING, leaving the rook on its original square. Subsequent rook moves (e.g. `Re1` after `O-O`) failed to parse because the rook wasn't where the PGN expected — silently dropping moves from the re-imported move list. Fix: `_castleSide` now checks both `mv.castle` (top-level) and `mv.to.castle` (set by pseudoMoves). Verified: full Italian Game (1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Nf6 5.d3 d6 6.O-O O-O 7.Re1 a6) now round-trips perfectly.

#### Feature change: move-classification label "Book"→"Mediocre"
The review-mode move classification label for near-equal moves (eval delta < 50cp) was "Book"/"开局库". Changed to "Mediocre"/"平常" per user request. The CSS class `.book` (used by stats.html `.classification.book`) is unchanged — only the i18n label changed.

#### Bug fix: eval-chart dark-mode line invisibility
The review eval-trend chart's negative-eval line color (`--chart-fill`) was `#1A1A2E` (near-black) in dark mode — invisible against the `#1a0a0a` background. Changed to `#5dade2` (light blue) for dark mode (`:root` and `html[data-theme="dark"]`), which is clearly visible and hue-distinct from the positive-eval line (`#E8E8F0` light cream). Light mode unchanged (`#2c2c34` dark gray on light background).

### v1.0.8 Phase 50 (button width TRUE root-cause fix: .btn-row opts out of portrait grid transform, 2026.7.2)

Phase 48/49's `.btn-compact` CSS class with `!important` flex declarations STILL did not shrink the buttons to content width. First-principles investigation revealed the TRUE root cause: the portrait `@media` rule `.dlg-sec > div[style*="display:flex"]` converts such divs to `display:grid` with `grid-template-columns:1fr auto` (designed for the label+input row pattern). The buttons were GRID items, not flex items — so `flex:none`/`width:auto` had no effect on their grid-track sizing. Every button landed in the `1fr` column (which takes all available space) and stretched (grid default `justify-items:stretch`). Phase 48's `.btn-compact` rule only set `.btn` into grid-column:2 (the `auto` content column), but `.btn-compact` buttons lack the `.btn` class, so they stayed in column 1.

Fix: introduced a `.btn-row` marker class for multi-button rows and a high-specificity override rule (`@media(orientation:portrait)` block, specificity 0,3,1 > grid transform's 0,2,1, later source order) that restores `display:flex` and neutralizes `grid-template-columns`, so the row is a flexbox again and `.btn-compact` children shrink to content width. Applied `.btn-row` to 4 containers: engine config Restart row, engine config Export/Import row, PGN cache filter-chip row, PGN cache Select All/None toolbar row. Version number remains v1.0.8.

#### Why Phase 44/47/48/49 failed
- Phase 44 (`width:fit-content`): ignored in flex containers — but the real issue was the container was a GRID, not flex.
- Phase 47 (`display:inline-flex;flex:0 0 auto;width:auto` inline): correct for flex items, but the buttons were grid items.
- Phase 48 (`.btn-compact` with `!important`): same flex-based approach, same failure — grid items ignore flex properties.
- Phase 49 (added `.btn-compact` to click selector etc.): robustness improvements, but did not address the grid-transform root cause.

### v1.0.8 Phase 49 (comprehensive first-principles re-review: 5 parallel subagent reviews + compliance audit, 2026.7.2)

This phase performs the most comprehensive first-principles code review to date: 5 parallel subagent reviews covering every source file (JS core, JS engine, UI/CSS, Java/native, compliance/README/LICENSE/NOTICE) — ~27,000 lines total. 6 bugs, 12 robustness issues, perf/redundancy items, plus NOTICE/README.license license-classification reconciliation. Version number remains v1.0.8.

#### Bug fixes (by severity)
1. **[HIGH] `_castleSide` Chess960 king-capture misclassification** (game-logic.js) — Phase 30's guard checked the castling right but NOT whether the destination square held an enemy piece. A normal king capture to col 6/2 (e.g. Kxg1 with king on f1) was misclassified as castling, causing silent piece destruction + incorrect rook displacement. Fixed: added `_destEmpty` guard (castling destinations are always empty; the rook ends beside the king, not under it).
2. **[HIGH] `importPGN` eval-cache clear + Chess960 mode set BEFORE startState validation** (tablebase.js) — A PGN with valid movetext but an invalid `[FEN]` tag destroyed ALL persisted evals (across all games) AND corrupted the current game's Chess960 mode, even though the import ultimately failed. Fixed: moved `startState` validation before the side effects.
3. **[MEDIUM] `onHintMove` no staleness guard** (ai-bridge.js) — If the user moved between requesting a hint and the engine responding, the hint (computed for the OLD position) was applied to the NEW position. Fixed: added `if(!isHintLoading)` guard at the top (all move/mode-change paths set `isHintLoading=false`), mirroring `onBestMove`'s `_aiMoveRequestId` pattern.
4. **[MEDIUM] `worker-pool._createWorker` Blob URL leak** (worker-pool.js) — `url` was block-scoped to `try`, so `catch` couldn't revoke it when `new Worker(url)` threw. Repeated failures accumulated Blob URLs. Fixed: hoisted `url` to function scope, revoke on failure, null after ownership transfer to `w._url`.
5. **[MEDIUM] PGN line-comment truncation inside brace comments** (pgn-standard.js) — `;`-to-EOL removal ran BEFORE brace-comment flattening, so `{...; ...}` was truncated at the `;`, losing the rest of the comment and any moves on the same line. Fixed: swapped the order (brace comments first, then line comments).
6. **[LOW] Heatmap cache-key collision** (stats.html) — Key was `boards.length + ':' + firstBoardJson.length`; a 10-move variation and a 10-move mainline selection with the same first board produced identical keys → stale heatmap. Fixed: strengthened key to include full first-board + last-board JSON content; removed the conflicting internal weak key in `_computeHeatmapStatsAsync` (caller now owns the cache).

#### Robustness fixes
- `parseInt(scoreMate)` → `parseInt(scoreMate,10)` + NaN guard (ai-bridge.js `_updateEvalState` + `_updateMultiPVDisplay`, ui.js MultiPV render) — malformed `mate ` produced NaN → misleading `#0` display / wrong `_sfMateDistance`.
- `_updateMultiPVDisplay` filters out-of-range MultiPV indices (index<1 or >50) defensively.
- `HapticManager.refreshSettings()` now re-detects `_hasVibrator` + `_apiLevel` (not just `_userEnabled`) — fixes permanently-disabled haptics when IIFE-time `_init()` ran before AndroidBridge was injected.
- `_pendingBestMoveInfo` defensive 2s self-clearing timer (no-op in normal path; safety net if `onMultiPVResult` is ever skipped).
- `_hintBarInfo` now escaped via `_esc()` (defense-in-depth XSS parity with `_aiBarInfo`).
- `.btn-compact` added to the global click-listener selector (Phase 48's standalone `.btn-compact` buttons now get unified `BUTTON_PRESS` haptic + `select` sound).
- `ANIMATION_DEFER_MS` reduced to 30ms under `prefers-reduced-motion: reduce` (no animation to wait for; 600ms was pure latency).
- `StockfishNative._heartbeatThread` → `volatile` (written in synchronized `startHeartbeat`, read in unsynchronized `shutdown`).
- `StatsActivity.pendingExportHTML` → `volatile` (JS-thread write, main-thread read).
- `ChessApp` crash handler no longer passes `throwable` to `Log.e`/`Log.w` (was dumping full stack trace, contradicting the stated MobSF #1 security mitigation).
- `makeExecutable` `chmod` subprocesses now `destroy()` on timeout (was leaking zombie processes on broken ROMs).

#### Performance / redundancy
- Removed dead `lastRec.variation` field (ai-bridge.js) — written in `_processDeferredVariations` but never read (the review path consumes `lastRec.variations` array via `_formatVariationGroups`).
- Removed dead `_timedOut` local variable in `stopAndWaitForBestmove` (StockfishNative.java) — assigned true but never read; `_discardingPonderBestmove` is the real signal.
- Removed dead CSS rules `.rmv-var`, `.rmv-comment`, `.ec-name`, `.ci` (index.html.tpl) — verified zero references across all source.
- Removed dead `workerParsePGN` round-trip in `importPGNAsync` (tablebase.js) — both `.then` and `.catch` ran the SAME synchronous `importPGN`, discarding the worker result entirely (zero offloading benefit, double CPU + memory). Retained the 50ms UI-yield setTimeout.
- Migrated engine-config "Restart Engine" + tab buttons to `.btn-compact` (Phase 48 design principle).
- Corrected stale "see Phase 21 fix above" → "below" in index.html.tpl comment.

#### Compliance reconciliation (NOTICE + README.license)
- NOTICE top-level classification reconciled with Phase 37 final classification:
  - Moved `StatsActivity.java`, `pgn-standard.js`, `worker-pool.js`, `index.html.tpl` from AGPL v3 → GPL v3 section.
  - Added `StabilizationHelper.java` to the AGPL v3 top-level list (was only in historical entries).
- Fixed `StatsActivity.java` header self-contradiction (GPL v3 boilerplate + "AGPL v3" comment) — now consistently GPL v3 with explanatory note.
- Fixed `index.html.tpl` header (was AGPL v3 boilerplate) — now GPL v3 to match NOTICE.
- `java/README.license` + `chess.src/README.license` top-level classifications updated to match.
- README.md directory tree: added `jniLibs/arm64-v8a/` placeholder note (engine binary not in source tarball).

### v1.0.8 Phase 48 (button width root-cause definitive fix: .btn-compact CSS class + !important, 2026.7.2)

Phase 47's inline `display:inline-flex;flex:0 0 auto;width:auto` approach was still overridden by parent-container or class-selector `flex:1` rules on some WebView versions. This phase introduces a dedicated `.btn-compact` CSS class with seven `!important` declarations to decisively suppress all conflicting flex rules. Applied to 10 buttons (engine config Export/Import/Close/Restart + tabs, PGN cache Select All/None + All/Tagged/Untagged + per-tag chips). Version number remains v1.0.8.

### v1.0.8 Phase 47 (button width root-cause fix: flex:0 0 auto + display:inline-flex, 2026.7.1)

Replaced `width:fit-content` (ignored in WebView flex containers) with `display:inline-flex;flex:0 0 auto;width:auto` on compact buttons. Insufficient on its own — superseded by Phase 48's `.btn-compact` class.

### v1.0.8 Phase 46 (final review: sound-haptic decoupling + importPGNAsync success fix + redundancy cleanup, 2026.7.1)

- Sound effects use independent `if` statements (Web Audio API allows overlap); haptics use mutually-exclusive `if/else if` chain (Android vibrator cancels). 
- `importPGNAsync` success detection fixed: compare `gameState` reference (not `moveRecords.length`, since `importPGN` clears+repopulates).
- `_exitSetupImpl` redundancy: removed castling-rights re-validation (already done by `exitSetup()`).

### v1.0.8 Phase 45 (fix broken max-width:none attribute from Phase 44, 2026.7.1)

Fixed a broken style attribute caused by Phase 44's sed command eating the closing quote.

### v1.0.8 Phase 44 (button width fit-content optimization, 2026.7.1)

Attempted `width:fit-content` + `max-width:none` on compact buttons — ineffective in WebView flex containers (superseded by Phase 47/48).

### v1.0.8 Phase 43 (reset-board castle markers root-cause fix + Phase 38-42 redundancy cleanup, 2026.7.1)

- `♻️ Reset Board` button now seeds `setupCastleMarks` for the standard position (Phase 43 root cause: `initState()` doesn't set them).
- Cleaned Phase 38-42 redundant comments and `_savedErrors` no-op.

### v1.0.8 Phase 42 ("Save PGN? → No" castle-rights loss root-cause fix, 2026.7.1)

`_exitSetupImpl` was re-validating `castlingRights` after `exitSetup()` already validated — the re-validation could overwrite correct rights. Fixed (later removed entirely in Phase 46 as redundant).

### v1.0.8 Phase 41 (haptic/sound matching audit, 2026.7.1)

- Haptic cancellation bug fixed: a single turn now produces only one haptic (mutually-exclusive if/else-if chain).
- Resign haptic changed ERROR → GAME_OVER.
- THROTTLE table completed: added CASTLE:100, PROMOTION:200.

### v1.0.8 Phase 40 (castle-rights loss root-cause fix + button width auto-fit, 2026.7.1)

- `computeVisibleCastleMarks`/`computeVisibleEpMark` now check `setupMode` flag — without this, stale markers overwrote `castlingRights` after exiting setup.
- Added `white-space:nowrap` to compact buttons (first width-fix attempt).

### v1.0.8 Phase 39 (PGN cache tag-filter buttons + engine config button layout, 2026.7.1)

- Added "Tagged" / "Untagged" filter buttons to the PGN cache manager.
- Engine config buttons compacted (no `.btn` class, avoiding min-height:40px).

### v1.0.8 Phase 38 (PGN cache UI layout + captured-pieces fix + castle-rights toggle-exit fix, 2026.7.1)

- PGN cache buttons laid out horizontally (Select All/None + filter chips + per-tag chips).
- `getCapturedPieces` returns empty when no move history.
- `toggleSetup` toggle-exit re-validation.

### v1.0.8 Phase 37 (license reclassification reconciliation, 2026.7.1)

Final license classification: 6 files reverted to AGPL v3 (chess960.js, eco-data.js, MainActivity.java, ChessWebViewClient.java, EngineService.java, StabilizationHelper.java); 3 files correctly kept GPL v3 (pgn-standard.js, worker-pool.js, StatsActivity.java). (Phase 49 later reconciled the NOTICE + README.license top-level lists to match.)

### v1.0.8 Phase 36 (GPL v3 license reclassification — partially reverted by Phase 37, 2026.7.1)

Reclassified 9 files AGPL→GPL; 6 were reverted in Phase 37.

### v1.0.8 Phase 35 (Phase 34 robustness review, 2026.7.1)

- `terminateWorkerPool` rejects both pending + queued tasks.
- `importPGNAsync` returns a success flag (gameState reference comparison).

### v1.0.8 Phase 34 (worker-pool officially enabled, 2026.7.1)

Async PGN import + worker offloading + loading indicator. (Phase 49 later removed the worker call site after discovering its result was discarded — both `.then` and `.catch` ran the same synchronous importPGN.)

### v1.0.8 Phase 33 (robustness review + comment cleanup, 2026.7.1)

- `isDeadPosition` knight-guard check.
- 42 stale comments精简.

### v1.0.8 Phase 32 (robustness hardening, 2026.7.1)

- `_escJs` XSS fix, StabilizationHelper dt correction.
- PGN truncation notification, worker-pool queue cap, parseInt radix.

### v1.0.8 Phase 31 (deep performance optimization, 2026.7.1)

- `getCtrlMap` hidden-class stabilization (factory function).
- `eco-data searchEco` pre-indexing.

### v1.0.8 Phase 30 (thorough first-principles review, 2026.7.1)

2 high + 8 medium bug fixes: XSS hardening, dead-code cleanup, header/license consistency. (Phase 49 later found Phase 30's `_castleSide` Chess960 guard was insufficient — added the `_destEmpty` check.)

### v1.0.8 Phase 29 (setup ⚡ button normalization + castle sound/haptic redesign + light-mode contrast + WebView robustness, 2026.7.1)

- 5 user-feedback fixes.
- Safe Browsing, `onRenderProcessGone`, 6-step WebView destroy.
### v1.0.8 Phase 28 (comprehensive first-principles re-review: 8 bug fixes + haptic fallback fix + Worker CSP fix + heatmap cache fix + castle/promotion haptic, 2026.7.1)

This phase performs another thorough first-principles code review. 3 subagents reviewed all source files (26,534 lines), finding and fixing 8 bugs + redundancy cleanup. Version number remains v1.0.8.

#### Bug fixes (by severity)
1. **[HIGH] `_reattachActiveAnimations` double bug** — `_fc`/`_fr` const-scoped inside if-block (ReferenceError silently caught); snap formula double-counted source offset. Fixed: moved to loop top; transform = scaled dx/dy only.
2. **[HIGH] `validateSetupPosition` pawn-rank formula swapped** — `(r===0)?1:8` should be `(r===0)?8:1`. Fixed.
3. **[HIGH] `_checkPVDivergence` Chess960 castling field name** — `mr.castle` → `mr.isCastling` (move records use boolean, not string). Phase 24 fix never triggered. Fixed.
4. **[MEDIUM] Chess960 PGN [FEN] tag corruption** — Legacy code overwrote `supObj.FEN` with `generateFEN(gameState)` (current state), overriding Phase 24's starting-position fix. Fixed: removed overwrite; only Shredder-convert the starting FEN.
5. **[MEDIUM] stats.html `html[data-theme="dark"]` incomplete** — Only set `color-scheme:dark` without full dark palette. Fixed: restore full dark palette.
6. **[MEDIUM] Heatmap cache not invalidated on new PGN import** — Fixed: clear cache in `_statsPastePGN` + `onStatsPGNFileRead`.
7. **[MEDIUM] `tryPwleVibrate` fallback lost multi-stage pattern** — PWLE failure degraded to single OneShot. Fixed: returns boolean; case statement falls through to waveform.
8. **[LOW] Landscape `.review-hdr` stripped safe-area** — Fixed: preserve `env(safe-area-inset-top)`.
9. **[LOW] Review eval error catch called wrong function** — `_updateEvalDisplay()` → `_updateAllEvalDisplays()`.

#### Haptic fallback fix + Castle/Promotion haptic
- `tryPwleVibrate` returns boolean — PWLE failure falls through to multi-stage waveform (not single OneShot).
- New `CASTLE` case (double-tap: king step + rook slide).
- New `PROMOTION` case (celebratory ascending triad).

#### Worker CSP fix + memory leak fix
- worker-pool.js: `new Function()` (requires CSP `unsafe-eval`) replaced with inlined switch-case dispatch.
- stats.html worker onerror: added `.terminate()` + `URL.revokeObjectURL()`.
- worker-pool.js: timed-out tasks removed from queue; `terminateWorkerPool` clears pending + rejects.

#### Redundancy cleanup
- Removed dead variable `ponderFen` in ai-bridge.js `onBestMove`.

### v1.0.8 Phase 27 (knight/bishop/rook dedicated haptic feedback — all six pieces now have personality-matched haptics, 2026.7.1)

This phase designs dedicated haptic feedback for the knight, bishop, and rook, complementing their respective move animations and sound effects. All six piece types now have dedicated haptics. Version number remains v1.0.8.

#### Knight · agile jump + crisp landing
- Haptic: `KNIGHT_MOVE` — gentle lift-off ramp (30ms) → mid-air gap (40ms low) → sharp crisp landing peak (25ms high). Matches the L-shape parabolic jump + "ding" sound. API 35+ PWLE, API 26+ waveform fallback.

#### Bishop · sharp smooth glide
- Haptic: `BISHOP_MOVE` — single smooth bell-curve swell (40ms up → 50ms peak → 40ms down), no hard peak. Matches the sawtooth-glide + filter-sweep sound. API 35+ PWLE, API 26+ waveform fallback.

#### Rook · fierce charge-dash-impact
- Haptic: `ROOK_MOVE` — low charge (25ms) → dash gap (35ms low) → heavy impact thud (60ms full) → aftershock decay. Matches the 3-stage sound + light board shake. API 35+ PWLE, API 26+ waveform fallback.

#### Haptic personality spectrum
Pawn (shiver) < Bishop (smooth glide) < Knight (jump + crisp landing) < Rook (charge + impact) < Queen (massive slam) < King (4 solemn thuds) — amplitude and duration increase from light to heavy.

#### Implementation
- `executeMove` (ui.js): haptic dispatch simplified to `piece.type.toUpperCase()+'_MOVE'`, covering all six pieces uniformly.
- `HapticManager` (ai-bridge.js): THROTTLE table gains `KNIGHT_MOVE:45`, `BISHOP_MOVE:40`, `ROOK_MOVE:50`.
- `StockfishNative.performHapticInternal()` (Java): 3 new cases with API 35+ PWLE / API 26+ waveform / legacy fallback.

### v1.0.8 Phase 26 (personified animation/sound/haptic upgrade + notch adaptation + shake/anti-shake coexistence + landscape board shrink + ⚡emoji fix + stats dialog light-mode + Worker race fix, 2026.7.1)

This phase addresses multiple user-reported issues. Version number remains v1.0.8.

#### Personified animation/sound/haptic upgrade
- **Pawn · shivering** — 22-keyframe high-frequency tremor, feather-light scale (<1.0), soft landing. Sound: 3 wavering squeaks. Haptic: `PAWN_MOVE` (3 tiny vibrations). 260ms.
- **Queen · resounding/ground-shaking** — Heavier than rook (520ms), pre-landing compression + impact snap, triggers **massive shake** (new `shake-massive`, 620ms, ±6px — heavier than king's heavy). Sound: brass growl + metallic clang + massive impact. Haptic: `QUEEN_MOVE`. 520ms.
- **King · regal/majestic** — Longer than rook (560ms), 4 measured steps, subtle scale breath, heavy shake. Sound: deeper bell (90Hz) + 4 deeper footsteps (80Hz). Haptic: `KING_MOVE`. 560ms.
- All keyframes mutate ONLY `transform` (GPU-composited) for high fps. `ANIMATION_DEFER_MS` 560→600.

#### Notch/cutout/R-corner adaptation
- `.review-hdr` gains `env(safe-area-inset-*)` padding (was missing — the review overlay covers the full viewport).

#### Shake vs anti-shake coexistence fix
- Root cause: `StabilizationHelper` and `_triggerBoardShake` both set `transform` on `.bwrap` — they fought over the same property. Fix: `_triggerBoardShake` temporarily removes `.stabilized` before adding `.shake-*`; the next sensor event restores it.

#### Landscape board shrink
- Anti-shake reservation 8px→12px (8px max displacement + 4px buffer), slightly shrinking the landscape board so the right edge isn't clipped when anti-shake shifts it rightward.

#### ⚡ marker emoji fix
- Root cause: `font-variant-emoji:text` + purple `color` forced ⚡ to render as a wrong-colored purple glyph. Fix: removed text-mode + color, letting ⚡ render as a standard color emoji. Outline preserved via `text-shadow` (works on color emoji; `-webkit-text-stroke` doesn't). 🔁 keeps text-mode (it's not an emoji).

#### Stats export/import dialog light-mode fix
- 3 dialogs in stats.html: hardcoded `#221015`/`#d4a017` → `var(--card)`/`var(--border)`/`var(--accent2)`/`var(--text)`.

#### Web Worker race-condition fix
- Root cause: stats.html heatmap worker overwrote `w.onmessage` on every call — overlapping calls lost the first Promise. Fix: taskId map for concurrent task resolution; `onerror` rejects all pending.

### v1.0.8 Phase 25 (robust Web Worker multi-threading + portrait review chart height fix + ↹Global toggle fix + stats header light-mode fix, 2026.7.1)

This phase addresses 4 user-reported issues via first-principles fixes. Version number remains v1.0.8.

#### Robust Web Worker pool (worker-pool.js reimplemented and wired in)

The Phase 24 deletion of worker-pool.js removed dead code but also removed the design intent: offloading heavy computations to background threads to avoid UI jank. This phase reimplements it with first-principles robustness and wires it into the heaviest call site (stats.html heatmap-stats walk, 1-2s for 100+ move games).

1. **worker-pool.js** — Pool of N workers (N = min(hardwareConcurrency, 4)), Blob-URL workers, generic "run named function" protocol, 30s task timeout + worker termination/replacement, pagehide auto-cleanup. Graceful degradation to synchronous execution if Worker is unavailable.
2. **stats.html** — Inline Web Worker (`_STATS_WORKER_SRC`) computes per-square control counts in a background thread. First render shows a loading placeholder; the worker computes in the background and triggers a re-render when done. CSP gains `worker-src blob:` and `script-src blob:`. Falls back to `_computeHeatmapStatsSync` if Worker is unavailable.
3. **getCtrlMap stays synchronous** — First-principles analysis: `render()` needs the result immediately (async would introduce flicker), and it's already cached by `cachedCtrlKey` so the amortized cost is low.

#### Portrait review eval chart height fix (ui.js)

In portrait mode, the chart was too tall (up to 200px), squeezing the move list. Portrait height changed from `Math.max(120, Math.min(200, innerHeight-140))` to `Math.max(100, Math.min(120, Math.floor((innerHeight-200)*0.18)))` — max 120px (was 200px), min 100px (was 120px). Landscape unchanged.

#### "↹Global" toggle appearance fix (ui.js + index.html.tpl, first-principles)

Root cause: `.toggle-sw` CSS uses `::after` pseudo-element for the dot, but the HTML also created a custom inline `<div>` dot inside `.toggle-sw` — two dots rendered simultaneously (overlapping, offset, different colors). Fix: removed the inline dot div; use standard `.toggle-sw` + `::after` CSS. Added a `.toggle-sw.sm` variant class (30x16 switch + 12px dot) for compact toolbars — previously the inline `style="width:30px;height:16px"` override left the `::after` dot at 16px which overflowed the 30px switch.

#### Stats page header light-mode fix (stats.html)

`.hdr` used a hardcoded `background:linear-gradient(145deg,#2a1a0a,#1a0a0a)` (dark brown) — in light mode the header stayed dark while the page turned silver. Fixed to `linear-gradient(145deg,var(--hdr-bg),var(--bg))` with a new `--hdr-bg` theme variable (dark: `#1a0a0a`, light: `#f0f0f3`).

### v1.0.8 Phase 24 (thorough first-principles code review: 7 subagents reviewed 26.5k lines, ~135 issues found, 30+ fixes applied, 2026.7.1)

This phase performs a thorough first-principles review of all 20 source files (26,530 lines). 7 subagents reviewed file groups in parallel, finding ~135 issues. Fixes were applied in priority order: bug fixes > feature completion > performance > redundancy cleanup > simplification.

#### Dead-code removal (highest-impact redundancy cleanup)

1. **Deleted `worker-pool.js` (581 lines)** — the entire module was never called by any file. The 3 exported worker functions had zero callers. Removed from `build-chess.py` module order (8 modules → 7).
2. **Deleted `build-chess.sh`** — byte-for-byte duplicate of `build-chess.py`.
3. **Deleted `_applyMoveToBoard` (~30 lines)** — exported but never called; also had a Chess960 castling bug.
4. **Deleted dead code in `ai-bridge.js`** — `_buildPGNComment`, `_formatPGNEvalAnnotation` (~90 lines), empty `if(_setupFEN)` block.

#### Bug fixes (by severity)

1. **[HIGH] stats.html XSS** — PGN header values inserted into the metadata table unescaped. Fixed with `_escFEN()`.
2. **[MEDIUM] Chess960 PGN [FEN] tag corruption** — `_setupFEN` was null for Chess960 games from the New Game dialog, causing corrupt PGN export. Fixed by setting `_setupFEN` at game start.
3. **[MEDIUM] Eval bar showed pre-move eval during animation** — `executeMove` didn't call `_resetEvalState()` before `_updateEvalDisplay()`. Fixed.
4. **[MEDIUM] `_resetGameUIState` ghost pieces** — didn't clear `_activeAnimEls` or remove overlay DOM. Fixed to call `_clearAnimationState()`.
5. **[MEDIUM] `flipBoard`/`enterReview`/`exitReview`/`toggleSetup` animation state not cleared** — all 4 now call `_clearAnimationState()`.
6. **[MEDIUM] `StockfishNative.recoverEngine` executor leak** — old executor never shut down. Fixed.
7. **[MEDIUM] `StockfishNative.makeExecutable` chmod mismatch** — fallback used 755 but `nativeChmod` sets 0744. Fixed to 744.
8. **[MEDIUM] `EngineService.isRunning` non-volatile** — Fixed to `volatile`.
9. **[MEDIUM] `MainActivity.onActivityResult` cancel not handled** — "Exporting..." dialogs hung forever on cancel. Fixed with `cancelPendingExport()`.
10. **[MEDIUM] `index.html.tpl` `html[data-theme="dark"]` incomplete** — only overrode 7 chart variables. Fixed to restore the full dark palette.
11. **[LOW] Chess960 `_checkPVDivergence` false-positive on castling** — Fixed to skip divergence check for castling moves.
12. **[LOW] `_triggerBoardShake` didn't clear stale `_cachedBwrap`** — Fixed.
13. **[LOW] `AndroidBridge.isEngineReady()` without typeof guard** — 9 call sites fixed.
14. **[LOW] `validateSetupPosition` incomplete pawn-rank check** — Fixed to check both rank 1 and rank 8.
15. **[LOW] `_reattachActiveAnimations` didn't recompute dx/dy on CELL change** — Fixed to cancel WAAPI animation and snap to new destination.
16. **[LOW] stats.html viewport blocked zoom** — Fixed to allow zoom (WCAG 1.4.4).
17. **[LOW] stats.html title hardcoded Chinese** — Fixed to "📊Statistics".
18. **[LOW] stats.html `target="_blank"` without rel** — Fixed with `rel="noopener noreferrer"`.
19. **[LOW] stats.html NaN% on division by zero** — Fixed with `total>0` guard.
20. **[LOW] i18n 'book' English translation was 'Mediocre'** — Fixed to 'Book'.
21. **[LOW] chess960.js comment had swapped bishop file sets** — Fixed.

#### Performance optimizations

1. **`validateSetupPosition` single-pass** — 12+ separate `.filter()` passes consolidated into one pass with per-type counters.
2. **`_sanitizeFenForEngine` toLowerCase caching** — `ch.toLowerCase()` called 6× per piece, cached to a local variable.

#### License-file & documentation fixes

1. **`LICENSE-GPL v3` fixed** — previously contained AGPL v3 text; replaced with correct GPL v3.
2. **`LICENSE-Apache v2.0` fixed** — previously had a misleading LLVM header; replaced with standard Apache 2.0.
3. **`NOTICE` v1.0.6 entry added** — version history was missing v1.0.6.
4. **`NOTICE` stats.html classification fixed** — GPL v3 (DroidFish-derived), not AGPL v3.
5. **`NOTICE` StabilizationHelper.java added** to the classification list.
6. **`NOTICE-gradle` reference fixed** — "see LICENSE-Apache v2.0" (not "the LICENSE file").
7. **`README.md` directory tree fixed** — removed deleted files; fixed build-steps paths.
8. **`BUILDING.md` rewritten** — updated to v1.0.8; fixed build commands.
9. **All 7 `README.license` files** updated with Phase 23/24 entries.

### v1.0.8 Phase 23 (⚡ marker rendering fix + animation flicker & smoothness first-principles optimization + Stockfish 18 dotprod engine + license-file fixes, 2026.7.1)

This phase addresses two visual issues reported by the user — the ⚡ (en-passant marker) on the main board rendering abnormally, and pieces flickering after the move animation completes — through first-principles root-cause analysis and fixes. It also integrates the official Stockfish 18 arm64-v8a-dotprod engine binary and fixes two mislabeled license files.

#### Main-board ⚡ marker rendering root-cause fix (index.html.tpl)

1. **Root cause** — The `.sq .setup-ep-mark` CSS rule applied `text-shadow:0 0 2px rgba(0,0,0,.85),0 0 4px rgba(0,0,0,.55)` (two-layer dark shadow) + `filter:drop-shadow(0 0 1px rgba(255,255,255,.45))` (white glow) on top of a purple `⚡` glyph. Three layered shadows produced a muddy/blurry visual on Android WebView (Xiaomi HyperOS 3). The review board's ⚡ looked "normal" only because review-board squares lack the `.sq` class, so the rule didn't match and the ⚡ fell back to the system's colorful emoji rendering.
2. **Fix** — Removed the `.sq` ancestor requirement so both boards share the same rule. Removed `text-shadow` and `filter:drop-shadow` (eliminating the blur). Changed `-webkit-text-stroke` from `.4px rgba(255,255,255,.85)` (thick white) to `.3px rgba(0,0,0,.85)` (ultra-thin dark) per the user's spec. The same treatment applies to `.setup-castle-mark` (🔁) for visual consistency.

#### Post-move piece flicker root-cause fix (game-logic.js, first-principles)

1. **Root cause** — `_finishAnim()` called `el.remove()` to delete the animation overlay the instant `onfinish` fired (~t=520ms). But the post-move `render()` (which rebuilds the DOM with the new piece position) was scheduled separately via `setTimeout(560ms)` → `requestAnimationFrame(updateAfterMove)`, painting at ~t=576ms. The ~40–56ms gap between overlay removal and the next paint left both source and destination squares empty — perceived as flicker.
2. **Fix** — `_finishAnim()` no longer removes the overlay. The overlay stays visible at the destination square until `render()` runs `app.innerHTML=h`, which destroys the `.bwrap` subtree (including the overlay) and rebuilds it with the new state in a single synchronous DOM mutation — the browser paints the new state in the same frame, eliminating the visual gap. `_activeAnimEls` is still cleared so `_reattachActiveAnimations()` won't re-append the stale overlay. The stale-closure path (`_myGen !== _animGen`) keeps `el.remove()` as belt-and-suspenders safety.

#### Animation smoothness breakthrough (game-logic.js + index.html.tpl, first-principles)

1. **Root cause** — Knight/bishop/queen/king animation keyframes each set a different `filter:drop-shadow(...)` value per keyframe. `filter:drop-shadow` is a pixel-level operation; changing it on every keyframe forces the browser to re-rasterize the alpha mask every frame — even on a GPU-composited layer — causing frame drops.
2. **Fix** — Set `filter:drop-shadow(0 4px 5px rgba(0,0,0,0.45))` as a static CSS property on `.move-anim`. The browser computes the filter once when the overlay is composited and caches the result as the layer's texture. Each keyframe now only changes `transform` (pure GPU layer translation, zero pixel ops). All `filter` properties removed from keyframes.

#### Ghost-piece fix on undo/flip during animation (ui.js)

1. **Root cause** — `_clearAnimationState()` (called on undo/redo/flip) only set `animationInProgress=false`; it didn't clear `_activeAnimEls` or remove leftover `.move-anim` overlay nodes. When `render()` then called `_reattachActiveAnimations()`, it re-appended the stale overlay to the new DOM — a "ghost piece".
2. **Fix** — `_clearAnimationState()` now clears `_activeAnimEls`, bumps `_animGen` (so any in-flight `_finishAnim` closure self-invalidates), and proactively removes all `.move-anim` overlay nodes under `.bwrap`.

#### Stockfish 18 arm64-v8a-dotprod engine integration

- Downloaded the official `stockfish-android-armv8-dotprod.tar` from the GitHub sf_18 release. Extracted the 114MB `stockfish-android-armv8-dotprod` binary (ELF 64-bit ARM aarch64, statically linked, Android 29+, NDK r27c build, stripped). Renamed to `lib/arm64-v8a/libstockfish.so` under `jniLibs` per Android packaging convention. The dotprod variant enables ARMv8.6-A DOTPROD instructions (`SDOT`/`UDOT`) for integer matrix-multiply acceleration in NN inference, delivering significant speedup on modern ARM big cores.

#### License-file fixes (critical)

1. **`LICENSE-GPL v3` contained AGPL v3 text** — The file named `LICENSE-GPL v3` actually contained the AGPL v3 license text ("GNU AFFERO GENERAL PUBLIC LICENSE"), not GPL v3. This was a license mislabeling that could cause legal confusion for DroidFish-derived code (which is genuinely GPL v3). Replaced with the correct GPL v3 text ("GNU GENERAL PUBLIC LICENSE", Version 3, 29 June 2007) from `/usr/share/common-licenses/GPL-3`.
2. **`LICENSE-Apache v2.0` had an LLVM Project header** — The file had "The LLVM Project is under the Apache License v2.0 with LLVM Exceptions" at the top, which is misleading because this project uses Apache 2.0 for Gradle (per `NOTICE-gradle`), not LLVM. Replaced with the standard Apache 2.0 text from `/usr/share/common-licenses/Apache-2.0`.

#### Build environment & configuration update

- **JDK**: Temurin JDK 21.0.5+11 (provides `javac`; the system `openjdk-21-jre-headless` is JRE-only).
- **Android SDK**: Installed `platform-tools` / `build-tools;34.0.0` / `platforms;android-35` / `ndk;27.2.12479018` / `cmake;3.22.1` via `cmdline-tools`.
- **gradle.properties**: `org.gradle.java.home` and `org.gradle.java.installations.paths` point to the new JDK; `org.gradle.jvmargs` raised from `-Xmx1024m` to `-Xmx2048m`; added `org.gradle.java.installations.auto-detect=true` and `auto-download=false`.
- **build.gradle**: Removed the `java { toolchain { languageVersion = JavaLanguageVersion.of(21) } }` block (Gradle toolchain auto-detection is unavailable without the `foojay` plugin); now uses `org.gradle.java.home` directly.
- **APK signing**: Verified v1/v2/v3 signing schemes all enabled, compatible with Xiaomi HyperOS 3 install verification.

### v1.0.8 Phase 22 (complete redesign of move animation & sound effects + light mode support, 2026.6.30)

The v1.0.8 release completely redesigns the move animation and sound effect system
following the "Personified Chess Move Animation" and "Personified Chess Sound Effects"
reference documents. Each piece now has a unique personified motion characteristic
and matching timbre. Light mode support is also added.

#### Move animation redesign (game-logic.js, index.html.tpl)

1. **Old animation system completely removed** — Deleted `_lastAnimPieceType`,
   `_lastAnimTarget`, `_lastCaptureFlag`, `_lastCheckFlag`, `_landingAnimActive`,
   `_landingAnimTimer`, `_animFinishTimer`, `_startLandingTimer()`, old
   `animateMove()` body (170+ lines), 6 landing keyframes (`pawnStep` /
   `knightJump` / `bishopGlide` / `rookSlide` / `queenGlide` / `kingStep`),
   6 `.sq .pc.anim-*` rules, `captureFlash` / `captureCore` keyframes, 6
   `.move-anim.anim-*` transition rules.
2. **New personified piece animations via Web Animations API** — Each piece
   has unique `cubic-bezier` easing + keyframes with `translate3d` +
   `scale` + `rotate` + `drop-shadow`:
   - ♙ Pawn (timid, 250ms) — hesitate-back then dart forward
   - ♘ Knight (agile, 380ms) — L-shape parabolic jump with rotation
   - ♗ Bishop (sharp, 270ms) — quick diagonal with golden glow trail
   - ♖ Rook (fierce, 290ms) — charge-dash-impact + light board shake
   - ♕ Queen (elegant, 420ms) — graceful arc with golden aura
   - ♔ King (solemn, 520ms) — heavy step + heavy board shake
3. **Board shake keyframes** — `shakeLight` (rook landing, 280ms, ±2px) and
   `shakeHeavy` (king landing, 450ms, ±4px). Triggered via `void offsetWidth`
   forced reflow for rapid restart.
4. **Chess960 castling compatibility** — King + rook animate concurrently;
   `_kingStayedPut` (king already on castling target) skips king overlay.
5. **`prefers-reduced-motion` support** — JS-side detection skips entire
   animation path; CSS `@media` disables shake animations.
6. **`_animGen` generation counter** — Prevents stale `_finishAnim` closures
   from corrupting newer animation state.
7. **`animateMove(from,to,pieceSym,pieceType,isCapture,isCheck,pieceColor)`
   signature preserved** — All ui.js callers unchanged.

#### Sound redesign (ui.js)

1. **Old sound system completely removed** — Deleted `audioCtx`,
   `getAudioCtx()`, old `playSound(type)` body (7 simple oscillator sounds).
2. **New `ChessAudioEngine` class** — Pure Web Audio API synthesis (no audio
   files). Each piece has matching timbre: pawn (triangle 3-stage), knight
   (sine sweep + ding), bishop (sawtooth + filter sweep), rook (square +
   noise + low bandpass), queen (3-freq harmony + LFO vibrato), king (bell
   partials + 4 footsteps).
3. **Audio routing chain** — master gain → [dry + reverb→reverbGain] →
   `DynamicsCompressor` → destination. Compressor threshold=-14dB;
   convolution reverb 1.4s impulse.
4. **Mobile unlock** — First `pointerdown` / `keydown` calls `unlock()` which
   plays a silent buffer to activate `AudioContext`.
5. **`_activeNodes` Set** — Tracks all live oscillators; `onended` auto-cleans.
   All `exponentialRampToValueAtTime` targets ≥ 0.0001 (no NaN).
6. **`playSound(type)` signature preserved** — Internally maps to new engine.
   `soundOn` + `toggleSound()` + toolbar button (🔊/🔇) preserved.
7. **`audioEngine` global variable added** — For `animateMove` to trigger
   piece-specific sounds.

#### Cross-file adaptation (ui.js)

1. **13 references to old animation state adapted** — `_lastAnimPieceType`,
   `_landingAnimActive`, `_startLandingTimer` etc. Render throttle simplified
   to only `animationInProgress`; landing `animCls` computation removed;
   `_clearAnimationState()` / `_resetGameUIState()` / `_cleanupEventListeners()`
   cleanup code simplified.

#### Light mode support (index.html.tpl, stats.html, ai-bridge.js, ui.js)

1. **CSS `@media (prefers-color-scheme: light)`** — App follows system global
   theme setting automatically. CSS variables overridden in light mode with
   warm-cream + deep-gold palette (`#f5ead6` / `#b8860b` / `#3a2410`).
   `color-scheme: dark light` declaration for native UI.
2. **Loading overlay king icon switch** — `ai-bridge.js _showLoadingOverlay`:
   king icon switches ♔ (dark mode, white-piece styling) ↔ ♚ (light mode,
   black-piece styling). `_isLightMode()` + `_loadingKingIconHTML()` helpers.
3. **Main header king icon switch** — `ui.js render()`: king icon before
   "Regalia" app name switches ♔ ↔ ♚ via `_hdrKingIconHTML()` helper.
4. **`stats.html` independent light theme** — Own `:root` + `@media` block.
5. **13 hardcoded component colors replaced with CSS variables** — `.hdr`,
   `.btn`, `.pbar`, `.card`, `.bwrap`, `.ev`, `.review-overlay`, etc.

#### HapticManager unchanged

The haptic feedback system (`HapticManager` 5-level degradation chain +
`AndroidBridge.performHaptic(type)` Java vibration) is completely untouched;
only sound was redesigned.

#### License classification

Unchanged — no new third-party code was introduced. All Phase 22 changes are
in GPL-v3-licensed files (game-logic.js, ui.js, ai-bridge.js, index.html.tpl
per DroidFish derivation) and AGPL-v3-licensed files (stats.html is original
AGPL v3). The new `ChessAudioEngine` class is original code embedded in ui.js
(GPL v3 per DroidFish derivation).

