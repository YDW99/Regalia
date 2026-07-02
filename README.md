# Regalia ♔

<!-- AI-GEN: AI assisted
     This document was AI-assisted and has been reviewed for AGPL v3 compliance. -->

A standalone, open-source chess app for Android — play offline against Stockfish 18, analyze your games, and explore openings. No account, no network, no tracking. Now with **Chess960 (Fischer Random Chess)** support (v1.0.4).

"Regalia" is used solely as a project name for this open-source chess app. No trademark rights are claimed. Anyone is free to fork and rename their own version.

## Screenshots

Portrait mode — evaluation bar, move history, AI opponent display with ponder info, and Control heatmap. See the user manual (`Manual/Regalia-v1.0.8-manual-{zh,en}.html`) for wireframe diagrams of every screen.

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
│   │   │   ├── ai-bridge.js    # Engine communication, eval display, PGN export, FEN sanitization, theme detection
│   │   │   ├── tablebase.js    # Lichess Syzygy tablebase queries + PGN import
│   │   │   ├── eco-data.js     # ECO opening classification data
│   │   │   ├── ui.js           # Rendering, dialogs, interaction, review mode, castling gesture, ChessAudioEngine
│   │   │   ├── index.html.tpl  # CSS template (theme variables, responsive layout, animation keyframes)
│   │   │   └── README.license  # Per-file license classification for this directory
│   │   ├── chess.html          # Built output (combined JS+CSS+HTML)
│   │   ├── stats.html          # Statistics page (📊统计) — fullscreen WebView
│   │   ├── AGPLv3_Logo.svg     # AGPL logo for About page
│   │   ├── GPLv3_Logo.svg      # GPL logo for 💾HTML export dialog
│   │   └── README.license      # Per-file license classification for this directory
│   ├── java/com/Regalia/
│   │   ├── MainActivity.java   # WebView host, immersive mode, lifecycle, SAF file pickers
│   │   ├── StockfishNative.java # Engine process management, UCI protocol, SAF file I/O, 60+ JS interfaces
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
│   │   ├── values/strings.xml  # Application name ("Regalia v1.0.8")
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
│   ├── Regalia-v1.0.8-manual-zh.html  # Chinese user manual (current)
│   ├── Regalia-v1.0.8-manual-en.html  # English user manual (current)
│   ├── Regalia-v1.0.7-manual-zh.html  # Chinese user manual (v1.0.7, historical)
│   ├── Regalia-v1.0.7-manual-en.html  # English user manual (v1.0.7, historical)
│   ├── Regalia-v1.0.6-manual-zh.html  # Chinese user manual (v1.0.6, historical)
│   ├── Regalia-v1.0.6-manual-en.html  # English user manual (v1.0.6, historical)
│   ├── Regalia-v1.0.5-manual-zh.html  # Chinese user manual (v1.0.5, historical)
│   ├── Regalia-v1.0.5-manual-en.html  # English user manual (v1.0.5, historical)
│   ├── Regalia-v1.0.4-manual-zh.html  # Chinese user manual (v1.0.4, historical)
│   ├── Regalia-v1.0.4-manual-en.html  # English user manual (v1.0.4, historical)
│   └── README.license          # Manual license classification
├── gradle/wrapper/             # Gradle wrapper (8.11.1)
│   ├── gradle-wrapper.jar
│   └── gradle-wrapper.properties
├── NOTICE                      # Third-party component notices + version history
├── NOTICE-DroidFish            # Original DroidFish notice
├── NOTICE-gradle               # Gradle notice (Apache v2.0)
├── AUTHORS-stockfish           # Stockfish project authors list
├── LICENSE-AGPL v3             # AGPL v3 full text (application)
├── LICENSE-GPL v3              # GPL v3 full text (engine + DroidFish-derived components)
├── LICENSE-Apache v2.0         # Apache v2.0 full text (Gradle)
├── PRIVACY.md                  # Privacy policy
├── BUILDING.md                 # Build instructions
├── build.gradle                # Gradle build config (versionCode 108, v1/v2/v3 signing, NDK 27.2, cmake 3.22.1)
├── settings.gradle             # Gradle settings (plugin/repo config)
├── gradle.properties           # Gradle properties (JDK 21, Xmx2048m)
├── build-chess.py              # Python build script (merges JS modules → chess.html)
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

**v1.0.8** (versionCode 108) — current release

The v1.0.8 release completely redesigns the move animation and sound effect system
following the "Personified Chess Move Animation" and "Personified Chess Sound Effects"
reference documents. Each piece now has a unique personified motion characteristic
and matching timbre. Light mode support is also added following the "Android Dark
Theme Design Principles" and "Android Light Theme Design Principles" — light/dark
mode switches automatically with the system global setting, and the king icon on
the loading overlay and main header toolbar switches between ♔/♚ to match the
on-board pieces. See the v1.0.8 Phase 22 changelog below for full details.

**v1.0.7** (versionCode 107) — previous release

The v1.0.7 release is a code-quality and stability maintenance release based on
three independent code-review reports plus two comprehensive first-principles
code-review passes (Phase 18 and Phase 19). It introduces performance
breakthroughs (LRU cache eviction, virtual list) and fixes many latent bugs:

1. **Critical-move cache invalidation on undo** — `_invalidateCachesForUndoneMoves()`
   now also recomputes `reviewCritical` via `_findCriticalMoves()`, so review-mode
   critical-move markers no longer reference undone moves.
2. **Lightweight board update path gets castling-rook marker** — `_updateSingleSq()`
   (the high-frequency engine-progress render path) now reuses
   `_computeCastlingRookSetForSelection()` so all four render paths produce
   identical castling-rook marker output.
3. **Engine-notification throttle cache fix** — `_updateEngineNotification()` now
   only updates the cache when actually pushing the notification, preventing the
   notification bar from getting stuck on a stale value.
4. **Stats-page PGN comment XSS escape** — all `{...}` comments in
   `renderPGNText()` (mainline and variations) are now passed through `_escFEN()`.
5. **CSP allows Blob Workers** — added `worker-src blob:`, `script-src 'unsafe-inline' blob:`,
   and `img-src data: file: blob:` so `worker-pool.js`'s Blob-URL Worker cannot be
   blocked by strict CSP.
6. **Cross-game eval-cache invalidation** — `_reviewEvalCache.clear()` is now
   called at the entry of `_startGameImpl()` and `importPGN()` so switching games
   no longer returns stale evals for wrong positions.
7. **About dialog: clickable GitHub links** — `DroidFish` and `Stockfish` project
   names in the About dialog are now hyperlinks to their GitHub repositories,
   opened by the system default browser.
8. **Portrait "New Game Settings" dialog — complete redesign** — all label+input
   rows in the New Game dialog now use a `portrait-stack` CSS class that switches
   to `flex-direction:column` in portrait, making every input/select/form full-width.
   The Chess960 SP-ID row's input+🎲 button stay side-by-side (together ~120px, fits
   any phone). Engine Config and other dialogs are NOT affected. Landscape is unchanged.
9. **All-UI portrait layout optimization** — ensures no horizontal scrolling on tall
   narrow full-screen phones (e.g. Sony ~360×2400px): `overflow-x:hidden` on `.dov`/`.dlg`,
   `env(safe-area-inset-*)` padding for notch/punch-hole/R-corner screens, stats page
   board removes 360px cap, table containers get `overflow-x:auto` for in-table scroll.
10. **Android back-button handling** — `handleBackPress()` now closes promotion
    and save-PGN-prompt dialogs first; `StatsActivity` delegates to a new unified
    `handleStatsBackPress()` that also closes export/import overlays.
11. **Merged duplicate HTML-escape functions** — `_escapeHTML()` now delegates to
    `_esc()` (single-pass regex + lookup table); both names retained for backward
    compatibility.

### v1.0.7 Phase 2 (same-day supplement, 2026.6.28)

12. **Main-screen "Quick Toolbar"** — the Undo / Redo / Flip / AI-Hint / Control-Range
    buttons have been MOVED from the top header toolbar to a new "Quick Toolbar"
    placed below the board and above the player bar. The top toolbar is now focused
    on game-level actions (New Game, Free Play, Sound, FEN, Import, Setup Mode).
    In setup mode, Undo/Redo are hidden; Flip/Hint/Control-Range remain visible.
13. **Setup-mode 🔁 Castle-Rights Marker button** — a new "🔁" button in the setup-mode
    button bar toggles a small gold "🔁" marker on any board square. The old behavior
    of "automatically granting castling rights when king and rook are on standard
    starting squares" is REMOVED in favor of fully manual control. A legality check
    (Fischer Random Chess castling rule, which subsumes standard chess) runs on "Done":
    markers must share a square with a same-color rook, both king and rook must be on
    their initial rank (rank 1 for white, rank 8 for black), the rook must be on the
    correct side (kingside or queenside) of the king, and at most one marker per side
    per color is allowed.
14. **Setup-mode ⚡ En-Passant Marker button** — a new "⚡" button toggles a small purple
    "⚡" marker on any board square. At most one marker is allowed; it must share a
    square with a pawn on rank 4 (white) or rank 5 (black), and the pawn's color must
    differ from the side to move.
15. **Android back-button handles setupMarkerMode** — if a marker mode is active when
    back is pressed, the marker mode is cancelled first instead of exiting setup.
16. **First-principles portrait UI fixes** — (a) the portrait media-query threshold is
    raised from `max-width:900px` to `max-width:1200px` so it actually triggers on
    modern low-DPR phones; (b) `#app` gets `width:100%; min-width:0` and forces
    `box-sizing:border-box` on all descendants as a safety net against horizontal
    overflow; (c) `.dlg` uses expanded `margin-left:auto; margin-right:auto` +
    `align-self:center` to fix dialog-not-centered issues in flex containers; (d)
    portrait `.dlg` `max-width` is `100%` (was 600px) so the dialog fills the screen.
17. **Removed `recomputeCastlingRights()`** — the function and its `export` reference
    are deleted; `_refreshStateAfterSetup()` now resets castling rights to all-false
    and the rights are explicitly granted by `_validateSetupCastleMarks()` on "Done".
18. **Setup-mode undo/redo restores markers** — the snapshot now includes
    `setupCastleMarks` (deep-copied Set) and `setupEpMark` (deep-copied object).

### v1.0.7 Phase 3 (same-day second supplement, 2026.6.28)

19. **Portrait UI redesigned from scratch** — switched from
    `@media(max-width:Npx) and (orientation:portrait)` (which failed across 9
    prior attempts because CSS viewport width depends on DPR and Android density
    crop modes) to `@media(orientation:portrait)` with **NO width threshold**.
    Font sizes and paddings now scale via `vw` units + `clamp()` functions.
    A 360×800 phone (DPR 2.0) and a 1220×2712 phone (DPR 2.625, CSS viewport
    465×1035) both correctly apply the portrait layout.
20. **🔁/⚡ markers visible in ALL modes (play, review, setup)** — added
    `computeVisibleCastleMarks(s)` and `computeVisibleEpMark(s)` pure functions
    that derive markers from `castlingRights` + rook positions (or
    `enPassantTarget`). Markers auto-remove when rights/target are lost. Wired
    into all 5 render paths (renderInternal, _updateSingleSq,
    _updateChangedSquares, _updateBoardLightweight fallback, review board).
21. **Double-stepped pawn now auto-receives ⚡ marker** — `computeVisibleEpMark`
    reverse-maps the FEN `enPassantTarget` (the skipped square) back to the
    pawn's current square and displays ⚡ there.
22. **Castling now works for non-standard rook positions** — the old non-Chess960
    code path hard-coded king on e1 + rook on a1/h1. Switched to ALWAYS using
    the Chess960 castling rule (`isChess960CastlingLegal`), which is a strict
    superset of standard chess castling. Same change applied to `makeMv`,
    `makeMvInPlace`, `_applyMoveToBoard` (animation), and the rook-move/capture
    castling-rights-clearing logic (`findCastlingRooks` is now always used).
23. **FEN enPassantTarget reverse-mapping fix** — Phase 2 incorrectly set
    `enPassantTarget` to the pawn's current square; the FEN standard requires
    it to be the SKIPPED square. Fixed: white pawn on rank 4 → target on rank 3;
    black pawn on rank 3 → target on rank 2. Exported FENs now conform to the
    standard.
24. **Setup-mode FEN auto-switches to Shredder castling notation** — when the
    setup position has a king or 🔁-marked rook on non-standard squares, the
    standard KQkq notation is ambiguous. A new `_needsShredderFEN(s)` detection
    function triggers Shredder-FEN (file letters A-H/a-h) in both `_setupFEN`
    and the PGN export path, guaranteeing lossless round-trip. Standard
    positions continue to use KQkq for backward compatibility.

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

---

### v1.0.7 Phase 21 (bug fixes: portrait dialog positioning precision fix, landscape anti-shake clipping root-cause fix, move-history panel clipping fix, 2026.6.30)

50. **Portrait dialog positioning precision fix** (index.html.tpl) — Phase 20's
    `padding-top:18vh;padding-bottom:10px` placed the dialog center at ~59vh
    (BELOW center, not above). Root cause: `align-items:center` centers within
    the content area (after padding), so content center = 18 + (100-18-1)/2 ≈ 59vh.
    Fix: `padding-top:10px;padding-bottom:12vh` → content center = 10px + (100vh -
    10px - 12vh)/2 ≈ 44vh = "slightly above center". Fullscreen dialog negative
    margins updated to cancel both paddings.

51. **Landscape anti-shake clipping root-cause fix + rollback of ineffective margin**
    (index.html.tpl, game-logic.js) — Phase 20's `.bsec margin-right:10px` did NOT
    fix the clipping because the clip happens at `.bsec`'s own `overflow:hidden`
    boundary, not at the gap. Deeper root cause: `_recalcCellSize()` had
    `_antiShake=isLandscape?0:6` (landscape reserved 0). Fix: (1) rolled back
    `margin-right:10px`; (2) `.bsec overflow-x:visible; overflow-y:hidden` so
    `.bwrap.stabilized` `translate3d` is not clipped; (3) `_antiShake=8` in BOTH
    orientations (matches `StabilizationHelper.MAX_DISPLACEMENT_PX=8.0f`).

52. **Landscape move-history panel clipping fix** (index.html.tpl) — `.panel` had
    only `overflow-y:auto` with no `overflow-x` setting, so wide content was
    clipped by `.main`'s `overflow-x:hidden`. Fix: `.panel overflow-x:auto` so
    wide content scrolls WITHIN the panel instead of being clipped at the page
    level.

### v1.0.7 Phase 20 (UX refinements: review eval bar / analyze button enlarged, move animation slowed, landscape anti-shake clipping fix, portrait dialog positioning, 2026.6.30)

46. **Review eval bar and "Analyze All" button enlarged** (ui.js, index.html.tpl) —
    Eval bar font .75rem/.7rem → .85rem/.8rem (portrait/landscape); emoji .95rem →
    1.1rem/1.05rem; max-height 1.9em → 2.4em; padding 3px 8px → 5px 10px. Analyze
    button font .7rem → .8rem; min-height 28px → 34px. Text and emoji now display
    fully with comfortable breathing room. Landscape `.review-bottom` buttons also
    slightly enlarged for visual harmony.

47. **Move animation slowed ~30%** (game-logic.js, index.html.tpl) — Per-piece
    durations 180-260ms → 240-340ms (pawn 180→240, knight 240→320, bishop 210→280,
    rook 180→240, queen 260→340, king 210→280) so the human eye can clearly follow
    the smooth motion. CSS transition durations updated to match JS. **120fps
    high-frame-rate preserved** — GPU-composited via `will-change:transform` +
    `translate3d`; `cubic-bezier(.25,.1,.25,1)` easing unchanged.

48. **Landscape board right-side clearance increased** (index.html.tpl) — `.bsec`
    now has `margin-right:10px` to prevent the anti-shake ±8px `translate3d` from
    being clipped by `.main`'s `overflow-x:hidden`. 10px = 8px max displacement +
    2px breathing room. Previously the board's right edge could be partially cut
    off when anti-shake shifted it rightward.

49. **Portrait dialog positioning optimized** (index.html.tpl) — All non-fullscreen
    dialogs (resign, about, import, save-pgn, pgn-cache) repositioned from
    geometric dead-center to "slightly above center" via `.dov` asymmetric padding
    (`padding-top:18vh > padding-bottom:10px`). On tall phones with status bars /
    notches, the previous geometric center felt too high (cramped against the top).
    The fullscreen dialog (New Game Settings) uses negative margin to cancel the
    padding-top, maintaining true full-screen fill. CSS selector
    `.dlg:not([style*="max-width"])` distinguishes fullscreen from small dialogs.

### v1.0.7 Phase 19 (comprehensive first-principles code review: 7 subagents reviewed 28k lines in parallel, 20+ critical fixes, 2026.6.30)

45. **Comprehensive multi-agent code review** — 7 subagents reviewed all 20
    source files (28,281 lines) in parallel: game-logic.js + chess960.js,
    ai-bridge.js, ui.js (3 segments), PGN parsing files, HTML/CSS files,
    Java + JNI files. 20+ critical and high-priority fixes implemented by
    priority (bug fix > functionality > performance > redundancy > simplification).

    Critical bug fixes:
    - **`_reviewEvalCache` corruption race** (ai-bridge.js) — cache-hit and
      terminal-position fast paths in `requestEngineEval` didn't clear the
      pending debounce timer. A stale debounce timer capturing a PRIOR step's
      FEN could fire after the cache-hit return, pass the staleness filter,
      and overwrite the current step's correct cached eval. Fixed: clear
      `_reviewEvalDebounceTimer` + increment `_evalStaleGen` on both fast paths.
    - **Cross-mode stale callback race** (ai-bridge.js) — `onEngineEval`'s two
      filters are mode-exclusive; after `exitReview` a review-mode callback
      still in flight could pass the normal-mode gen check and overwrite the
      correct eval for up to 30s. Fixed: capture `_evalRequestReviewMode` at
      request time; reject cross-mode callbacks.
    - **animateMove reduced-motion path race** (game-logic.js) — Phase 18's
      `_animGen`/`_animFinishTimer` fix didn't cover the reduced-motion
      early-return path. Fixed: cancel timer + bump gen + set 3 missing flags.
    - **reviewAnalyzeAll completion didn't restore eval vars** (ui.js) — eval
      bar showed the LAST analyzed step's eval instead of the returned step's;
      `reviewCritical` not recomputed → 💥/❌ markers missing. Fixed: call
      `reviewGoTo(returnStep)` + `_findCriticalMoves()`.
    - **PGN `[%eval]` placeholder offset** (tablebase.js) — FEN-start PGNs
      where Black is to move had evals attach to the wrong step (off by 1
      from the null placeholder). Fixed: apply `_placeholderOffset` when
      populating eval/annotation/comment caches.
    - **setupRedoStack not cleared on Reset/Clear Board** (ui.js) — stale redo
      entries applied to empty board. Fixed: added `setupRedoStack=[]`.
    - **`_resignGame` clock leak** (ui.js) — `gameClocks.running=false` was a
      no-op; 200ms interval kept firing. Fixed: `clearInterval(gameClockTimerId)`.
    - **`_pendingStatsImportPGN` global race** (ui.js) — double-call lost
      first import. Fixed: close over `pgnText` directly.
    - **stats.html Backspace re-opened dismissed import-back dialog** — Fixed:
      check `_statsImportBackDialogVisible` flag.
    - **stats.html double safe-area-inset-top** — header jump on first scroll.
      Fixed: body top padding 0; `.hdr` owns safe-area.
    - **StockfishNative.java thread safety** — `engineProcess`/`engineReader`/
      `engineWriter`/`readerThread`/`_engineExecutor` all declared volatile.
    - **stopAndWaitForBestmove timeout stale-bestmove corruption** — Fixed:
      set `_discardingPonderBestmove=true` on timeout.
    - **ChessApp.java UncaughtExceptionHandler swallowed Error** — OOM/
      StackOverflow on worker threads left JVM in corrupted state. Fixed:
      chain Error subclasses to default handler.
    - **EngineService.java `lastStatusInfo` not volatile** — stale
      notification status. Fixed: declared volatile.
    - **probeTablebase JSON parse error miscounted as offline** — Fixed:
      separate try/catch for `resp.json()`.

    Performance & functionality:
    - Notification throttle buffers pending info (was silently dropped).
    - PGN export eval tag uses `peek()` not `get()` (avoids LRU churn).
    - WDL negative percentage fix (`lp=100-wp-dp` could be -1).
    - `onEngineError` restart timer leak (spurious restart after auto-recovery).
    - stats.html CSP added (defense-in-depth for XSS).

    Redundancy cleanup:
    - Removed stale "Unlimited cache size" comment in ai-bridge.js.
    - Removed dead `renderPGN()`/`renderMoveNotation()` in stats.html.
    - Removed duplicate body rule in stats.html portrait media query.
    - Added full Copyright + GPL v3 license block to stats.html `<head>`.

### v1.0.7 Phase 18 (_reviewEvalCache LRU eviction + review move-list virtual list + 11 first-principles code-review fixes, 2026.6.30)

44. **`_reviewEvalCache` LRU eviction** (ai-bridge.js, PERF) — The old "Unlimited
    cache size" design underestimated JSON persistence size (~400B/entry),
    main-thread `JSON.stringify` blocking (100-300ms on 24MB blob), and WebView
    localStorage ~5MB quota. Added `MAX_ENTRIES=2000` soft cap with
    `_evictIfOverCap()` on `set()`; Map.keys() iteration order = LRU order;
    skips `_reviewEvalRequestedStep`; persistence preserves LRU order;
    backward-compatible.

    **Review move-list virtual list** (ui.js, PERF) — When `moveRecords.length`
    > 80, only the visible window + 10-row overscan is rendered as DOM nodes;
    top/bottom spacer `<div>`s fill the scroll height. Shared
    `_buildReviewMovesInnerHTML()` eliminates ~40 lines of landscape/portrait
    duplication; passive scroll listener; 80ms-debounced
    `_refreshReviewMovesOnly()`; first-render measures `avgRowH` via rAF;
    `_resetRvVirtualState()` on enter/exit review, new game, import.

    Bug fixes:
    - Chess960 `unmakeMv` board corruption (critical) — ~half of SP-ID positions
      had make→unmake round-trip corrupting the board. Fixed: save rook piece
      in `undo.castlingRook.piece`; restore from saved piece.
    - `makeMvInPlace` castling-rights not cleared for rook move/capture. Fixed:
      snapshot delta before mutation.
    - `animateMove` stale-`_finishAnim` race. Fixed: `_animFinishTimer` +
      `_animGen` generation counter.
    - Single-step review eval missing safety timer. Fixed: 45s timer.
    - Virtual-list window forced back to active step on every render → flicker.
      Fixed: track `_lastRenderReviewStep`.
    - PGN/FEN import paths missing `_resetRvVirtualState`. Fixed.
    - pgn-standard.js comment-flattening polluted movetext (latent). Fixed.
    - worker-pool.js missing unclosed-brace handling (latent). Fixed.

### v1.0.7 Phase 17 (Chess960 castling "king self-capture" fix + review "Analyze All" button auto-refresh + Kimi-audit suggestions adoption, 2026.6.29)

30. **Chess960 castling "king self-capture" critical bug fix** — In Chess960
    mode, when the king's starting position happens to be its castling
    destination square (e.g. an SP-ID where the white king starts on g1),
    performing kingside castling previously caused the king to "capture
    itself" and vanish from the board. Root cause: `makeMv()` /
    `makeMvInPlace()` unconditionally executed
    `ns.board[to.row][to.col] = ns.board[from.row][from.col];
    ns.board[from.row][from.col] = null;` — when `from === to`, the second
    line nulls the king's own square AFTER the self-copy. Fix: when castling
    AND `from === to`, skip the king move entirely (only the rook moves);
    `unmakeMv` detects `castlingRook && from===to` and skips the king-position
    restore; `animateMove` skips the king overlay and only animates the rook.
    Matches the Fischer Random Chess rule: "castling in place — if the king
    or rook's initial position happens to be its castling destination,
    castling is still legal; that piece 'stays put' while the other piece
    moves to its designated position". A 20-case Node-sandbox regression
    test is added at `scripts/test-chess960-castling.js` (in the dev
    environment, not packaged in the APK).
31. **Review "Analyze All" button state auto-refresh** — After the user
    manually evaluates every step by clicking through the move list
    one-by-one, the "Analyze All" button now automatically switches to
    "All Analyzed" the moment the last step's eval completes. Previously
    the button stayed stuck at "Analyze All N (k/N)" until the next full
    render. Fix: the button now has `id="review-analyze-btn"`; the label
    is computed by a new pure function `_rvAnalyzeBtnLabel()`; a new
    `_updateReviewAnalyzeBtn()` refreshes the label via `textContent`
    (one `getElementById` + one `textContent` write — no DOM rebuild);
    `onEngineEval()` now calls `_updateReviewAnalyzeBtn()` after each
    eval (whether batch or manual).
32. **Kimi-audit reasonable suggestions adopted** — 5 of the 30+ suggestions
    from the Kimi audit report are adopted (consistent with existing code
    style, low risk, clear benefit):
    - `stats.html` `_escFEN` backtick escaping (` → &#96;) — closes a
      residual template-literal injection vector.
    - `stats.html` `selectVariationMove` uses hand-written
      `_cloneStatsState` instead of `JSON.parse(JSON.stringify(state))`
      (~10x faster, type-safe).
    - `chess.html` `.bgrid` gets `content-visibility:auto` (off-screen
      render skip; `contain:strict` NOT added to preserve responsive
      `CELL` recalculation).
    - `chess.html` `animateMove` honors `prefers-reduced-motion` on the
      JS side too (skips overlay `<div>` creation + transitionend
      listeners + double-rAF when the user has reduced-motion enabled).
    - `stats.html` board `max-width` raised 360px → 400px (modest
      relaxation; Kimi's full-cap-removal rejected to avoid the board
      dominating the stats panel on tablets).

    Rejected suggestions (architectural changes for uncertain benefit) — NOTE:
    two of these were later implemented in Phase 18 after deeper analysis:
    - ~~incremental DOM rendering / virtual scrolling for `.bgrid` and move
      list~~ → **Implemented in Phase 18** (review move-list virtual list for
      >80-move games; `.bgrid` incremental rendering still uses the existing
      `_updateBoardIncremental` dirty-check which is sufficient for typical use).
    - ~~LRU eviction for `_reviewEvalCache`~~ → **Implemented in Phase 18**
      (MAX_ENTRIES=2000 soft cap; first-principles analysis showed the old
      "unlimited" design underestimated JSON size, main-thread blocking, and
      localStorage quota risks).
    - Worker source modularization (build-chess.py already handles module combination)
    - AST-based `_stripFnBody` (would add ~200KB parser dependency)
    - error-boundary retry button (current `render()` try/catch already shows
      a red error panel with full stack).

### v1.0.7 Phase 5 (board sizing and portrait layout optimization, 2026.6.29)

25. **Portrait board h-file clipping fixed** — `_recalcCellSize()` now reads
    actual safe-area insets via `_readSafeInsets()` and subtracts ALL
    clearances: 28px row-label column + safe-area left/right + 3px finger-grip
    + 4px board border + 6px anti-shake margin. Previously the 28px row-label
    column and safe-area insets were not subtracted, causing the h-file to be
    clipped on notched phones.
26. **Board auto-enlarges when space is plentiful** — CELL cap raised from
    72px (landscape) / ~50px (portrait) to 90px. Portrait mode now considers
    BOTH width and height constraints (previously width-only), preventing the
    board from being too large on ultra-tall phones.
27. **Landscape right-edge content clipping fixed (regression)** — landscape
    toolbar changed from `overflow-x:auto` to `flex-wrap:wrap`; `.main` gets
    `max-width:100%;overflow-x:hidden` as a safety net.
28. **Anti-shake clearance double-counting fixed** — removed `.bwrap`'s
    `margin-right:6px` (anti-shake is now managed solely by
    `_recalcCellSize()`).
29. **New Game Settings portrait layout redesigned from scratch** — switched
    from force-stacked `flex-direction:column` to a 2-column grid layout
    (`grid-template-columns:1fr auto`), with labels in the left column and
    inputs/buttons in the right column. Openings list `max-height` raised to
    `40vh`.

**v1.0.6** (versionCode 106) — previous release

The v1.0.6 release adds:

1. **Chess960 ECO suppression** — ECO opening recognition and opening move
   recommendations are now hidden when Chess960 mode is active (Chess960 has
   no fixed opening theory).
2. **PGN `[SetUp]`/`[FEN]` round-trip preservation** — importing a PGN with
   a `[FEN]` header and then exporting now correctly preserves both the
   `[SetUp "1"]` and `[FEN "..."]` tags.
3. **Stats page per-move selection** — clicking a move or the initial FEN in
   the stats page's PGN text panel now shows the corresponding position on
   the board and the statistics computed up to that move only.
4. **Unified gray-out styling** — when a toggle or stepper is grayed out
   (disabled), only the control itself is dimmed; surrounding labels,
   descriptions, and explanations remain at full opacity. Added gray-out
   explanations in the New Game dialog.
5. **Portrait-optimized New Game dialog** — the dialog now has dedicated
   portrait-mode styling (tighter padding, stacked inputs, wrapped ECO
   search row) while the landscape layout is preserved.
6. **Scroll-position preservation** — fixed a bug where scrollable windows
   (dialogs, side panel, review move list, stats page) would suddenly jump
   back to the top after a state change triggered a re-render.
7. **Engine evaluation reliability** — added FEN sanitization that strips
   inconsistent castling rights (e.g. `q` with no black rook on a8) before
   sending to Stockfish, preventing the engine from hanging on positions
   like `4k3/8/8/8/8/8/8/r1K4R w q - 1 3`.
8. **King-then-rook castling gesture** — selecting a king that can castle
   now visually marks the participating rook(s) with a golden dashed ring;
   clicking a marked rook triggers castling directly. Essential for Chess960
   positions where the king's destination square is occupied by the rook.
9. **Chess960 castling detection fix** — replaced the legacy
   `Math.abs(to.col-from.col)===2` pattern (which only works for standard
   chess) with an explicit `castle` flag on castling moves plus a
   `_castleSide()` helper, fixing castling detection in Chess960 where the
   king may move only 1 column.
10. **SL mode skill-level display** — when the AI opponent is in SL (Skill
    Level) mode, the actual skill level value is now shown in the AI
    opponent bar and in PGN `[White]`/`[Black]` tags (e.g. "SL20" instead
    of just "SL").

**v1.0.5** (versionCode 105) — previous release

The v1.0.5 release adds (Round-6 Revision 49):

1. **High aspect-ratio screen adaptation** — every interface scrolls vertically only,
   never horizontally, on any aspect ratio (ultra-tall phones, foldable inner screens,
   ultra-wide tablets).
2. **Notch/cutout/R-corner adaptation** — `shortEdges` cutout mode in AndroidManifest,
   `viewport-fit=cover` + `env(safe-area-inset-*)` CSS, auto-avoids notches/cutouts/R-corners.
3. **Sensor-fusion board anti-shake (OIS-style)** — new `StabilizationHelper.java` fuses
   `TYPE_LINEAR_ACCELERATION` (gravity-free translation) + `TYPE_GAME_ROTATION_VECTOR`
   (preferred, no magnetometer) / `TYPE_ROTATION_VECTOR` (fallback) sensors;
   board counter-shifts in real time to cancel device shake, plus ±2° roll-only
   tilt compensation. Toggle by long-pressing any board square (Toast in zh/en).
4. **Stats page "PGN Text" → "PGN Text (After processing)"** — clarifies the PGN is
   reconstructed/processed, not raw.
5. **Review arrow shrink** — arrows shrunk (4→2px stroke, 8×6→5×4 head) with per-arrow
   angular offset when multiple arrows share a target, so they stay distinguishable.
6. **Phase analysis precision** — rewritten per 国际象棋三阶段精确区分.md: multi-criteria
   detection (undeveloped minors, king castled, queen present, king advanced) replaces
   the old fixed material threshold.
7. **Manual chapter reorder** — Legal chapter moved to ch.2; manual changelog newest-first.

### Patch revisions under v1.0.5 (version number unchanged — still v1.0.5 / versionCode 105)

Multiple patch revisions have been applied under the same v1.0.5 version number.
The most significant recent revisions are:

- **Round-6 Revision 50** — Version-number residual cleanup (`v1.0.4` → `v1.0.5`
  in 3 UI locations); anti-shake Y-axis direction correction; PGN comment-merge
  fix (comments now attach to the PRECEDING move per PGN spec; only same-move
  comments merge with " | ").
- **Round-6 Revision 51** — App-launcher icon label synchronized to
  "Regalia v1.0.5"; anti-shake Y-axis direction further corrected.
- **Round-6 Revision 52** — Anti-shake screen-orientation auto-adapt (4 display
  rotations: 0°/90°/180°/270°); visual-annotation null-reference fix when
  `moveRecords[moveIdx]` is null (now uses `{csl:[],cal:[]}`).
- **Round-6 Revision 53** — Precise sensor re-selection: only
  `TYPE_LINEAR_ACCELERATION` + `TYPE_ROTATION_VECTOR` + `Display.getRotation()`
  (removed accelerometer/gyroscope/gravity/game-rot/geomagnetic-rot sensors).
  ±2° tilt compensation via `getRotationMatrixFromVector()`+`getOrientation()`.
  Yellow arrows extended to bidirectional queen threats (both sides' queens).
  Blue arrows also bidirectional. New `_computeInitialPositionAnnotations()`
  for the initial position (reviewStep 0).
- **Round-6 Revision 54** — Six improvements per user spec:
  1. **Yellow arrow extension** — when the mover's just-moved piece is a queen
     and its destination is attacked by an opp piece ("主动把皇后移动到受威胁
     格"), that yellow arrow's priority is BOOSTED to survive the cap-6 dedup.
  2. **Blue arrow extension** — when the mover's moved piece is itself at a
     threatened square ("主动把任意棋子移到受威胁格") AND this causes an opp
     piece to have 2+ threats on mover pieces, those blue arrows are BOOSTED.
  3. **Per-color arrow offsets** — each color has a FIXED diagonal offset
     (Blue→Upper-Left, Yellow→Lower-Left, Red→Upper-Right, Green→Lower-Right)
     applied to both start and end so overlapping arrows of different colors
     are visually separable.
  4. **Yellow square rounded-rectangle style** — yellow squares now render as
     a separate rounded-rectangle overlay (2px solid border, ~15% border-
     radius, ~10% inset) above the cell, leaving four-corner gaps so other
     colors' box-shadow insets remain visible underneath.
  5. **Roll-only board rotation** — `StabilizationHelper` rotation restricted
     to SCREEN-ROLL only (the steering-wheel tilt). Screen-pitch (nodding)
     and screen-yaw (door-like horizontal turn) are NOT compensated.
  6. **First-principles anti-shake audit** — cross-checked every sensor
     choice against the two uploaded sensor reference docs. Key change:
     PREFER `TYPE_GAME_ROTATION_VECTOR` (no magnetometer → no magnetic
     drift near laptops/metal desks) with `TYPE_ROTATION_VECTOR` fallback.
     Verified: `SENSOR_DELAY_GAME`, α=0.15 low-pass filter, 0.3° dead zone,
     decay-based drift prevention, lifecycle pattern, null-sensor fallback.
     Confirmed: `TYPE_ORIENTATION` / `device_orientation` is deprecated —
     we correctly use `Display.getRotation()`.
- **Round-6 Revision 55** — Line-by-line code audit of every source
  file, prioritized: bug fixes > features > perf > redundancy > simplification.
  1. **StatsActivity security parity** (bug) — the stats WebView was missing
     the defense-in-depth security flags that MainActivity has
     (`setAllowFileAccess(false)`, `setAllowContentAccess(false)`,
     `setAllowFileAccessFromFileURLs(false)`,
     `setAllowUniversalAccessFromFileURLs(false)`,
     `setMixedContentMode(NEVER_ALLOW)`, `setFilterTouchesWhenObscured(true)`).
     Added all of them so the stats page has the same security posture as the
     main game.
  2. **StatsActivity FLAG_FULLSCREEN fix** (bug) — was using the deprecated
     `FLAG_FULLSCREEN` unconditionally, which conflicts with Edge-to-Edge
     enforcement on Android 15+ (same black-screen bug MainActivity fixed in
     v18.4.6). Now gated on `SDK_INT < R`, matching MainActivity.
  3. **StatsActivity immersive mode** (feature) — the stats page now hides
     system bars (status + navigation) just like the main game, using the
     same platform-aware approach (`WindowInsetsController` on API 30+,
     legacy flags on API 21-29).
  4. **engineGoDepth eval-mode options** (bug) — `StockfishNative.engineGoDepth`
     (used for deep eval / analyze-all) was missing the
     `applyEvalModeOptions()` call that `engineEval` has. Without it, deep
     eval ran with gameplay `Contempt=24` (biased toward avoiding draws) and
     the user's `MultiPV` setting (potentially >1, reducing depth). Fixed by
     adding the call; the bestmove handler already restores gameplay settings.
  5. **getCtrlMap perf** (perf) — hoisted the attacker-position object out of
     the inner loop. Was allocating ~256 objects per ctrl-map (per render
     tick when heatmap is on); now allocates max 32 (one per piece) and
     reuses.
  6. **EngineService notification builder** (redundancy) — extracted shared
     `_buildNotificationWithContent()` helper used by both
     `buildNotification()` and `updateNotification()`, eliminating ~50 lines
     of duplicated builder configuration.
  7. **worker-pool fenToState consistency** — worker's check was
     `parts.length<4`, main thread's is `<2`. Changed worker to `<2` so
     minimal FENs (board + side-to-move only) are accepted by both paths.
  8. **chess960.js stale comment cleanup** — removed a misleading comment
     that claimed a line was "dead code" (it had been consolidated in
     v1.0.4). Code was correct; only the comment was stale.
- **Round-6 Revision 56** — Audit of `ai-bridge.js` MultiPV
  processing path and `ui.js` dirty-flag render pipeline. Six improvements:
  1. **MultiPV toggle-off stale lines** (bug) — `setConfigMultiPV(1)` mid-search
     left stale secondary PV lines (index 2..N) visible until the next
     `onBestMove` (seconds away). Now `_multiPVLines` and the display cache
     are cleared immediately, and the display refreshes instantly.
  2. **MultiPV display signature cache** (perf) — `_updateMultiPVDisplay()`
     was re-converting ALL PV lines from UCI to SAN on every progress tick
     (10-50×/sec), wasting 80+ `makeMv` calls per tick when the PV content
     was identical. Added `_multiPVDisplayCache` (per-line signature) to
     skip the conversion + DOM write when nothing changed.
  3. **MultiPV sort skip** (perf) — `onMultiPVProgress()` +
     `onEngineProgress()` sorted `_multiPVLines` unconditionally on every
     tick. Now only sort when a new line was appended (indices don't change
     on in-place update).
  4. **Eval display signature cache** (perf) —
     `_updateEvalDisplayIncremental()` rebuilt `innerHTML` on every
     `DIRTY_EVAL` tick even when eval values were unchanged (common during
     deep search). Added `_evalDispPrevSig` signature check to skip the DOM
     write; invalidated on full render.
  5. **MultiPV cache invalidation** (robustness) — wired
     `_clearMultiPVDisplayCache()` into all three MultiPV-reset paths
     (`onBestMove`, `restartCurrentEngine`, engine-recovery) so a recovered
     engine doesn't inherit stale display-cache signatures.
  6. **Dirty-flag pipeline audit** — confirmed `_performDirtyRender`'s
     flag-routing is correct; the TOOLBAR/PANEL/MOVES → full-render branches
     are technically dead code (always accompanied by bitcount>2) but left
     as-is for intent clarity and future-proofing.
- **Round-6 Revision 57** — CRITICAL FIX for blank-screen-on-launch
  regression introduced in Rev55. The Rev55 comment added to
  `worker-pool.js fenToState()` (inside the `_WORKER_SOURCE` template literal)
  used backticks around `parts.length<4`. Since `_WORKER_SOURCE` is a JS
  template literal (delimited by backticks), the backtick inside the comment
  **prematurely terminated** the template literal, causing a `SyntaxError`
  that crashed the entire `chess.html` bundle at parse time. Symptom: app
  launches to a blank screen showing only the background color. Fix: removed
  the backticks from the comment text. The actual code change from Rev55
  (`parts.length<4` → `parts.length<2`) is correct and unchanged. Verified
  with `node --check` on the bundled JS (exit code 0).
- **Round-6 Revision 58** — Two improvements per user spec:
  1. **Review-board arrow offset redesign** (ui.js) — Redesigned the arrow
     offset logic so: (a) each color's start offset = end offset (same bias
     direction, arrow direction preserved); (b) reverse-overlap (A→B and
     B→A) only happens for same-color arrows (they land on the exact same
     line; different-color reverse arrows are parallel but never collinear);
     (c) different-color arrows never overlap on the same line (guaranteed
     by four distinct diagonal biases: B→UL, Y→LL, R→UR, G→LR). Removed the
     Rev49 perpendicular "fan" offset that broke same-color reverse-arrow
     overlap. Added arrow deduplication by (color, from, to).
  2. **Magnetic-field-aware sensor switching** (StabilizationHelper.java) —
     On start, uses `TYPE_ROTATION_VECTOR` (accurate baseline via
     magnetometer). Background-monitors `TYPE_MAGNETIC_FIELD`; when magnetic
     disturbance detected (|B| deviation > 15 µT from rolling baseline),
     switches to `TYPE_GAME_ROTATION_VECTOR` (no magnetometer, immune to
     interference). When field calms (< 8 µT for 2 seconds), switches back
     to `TYPE_ROTATION_VECTOR`. Hysteresis prevents oscillation. Both sensors
     registered simultaneously (no re-registration gap).

- **Round-6 Revision 59** — CRITICAL FIX for rotation-axis bug
  in landscape orientations. The board's tilt-compensation rotation was
  controlled by the WRONG axis — it responded to screen pitch (front-back nod)
  instead of screen roll (steering-wheel tilt). Root cause:
  `SensorManager.getOrientation()` was called on the raw device-frame rotation
  matrix, which returns angles in the DEVICE's natural coordinate system, not
  the screen's. In landscape (ROTATION_90/270), device pitch and roll are
  swapped relative to the screen. Fix: Added
  `SensorManager.remapCoordinateSystem()` to transform the rotation matrix
  from device frame to screen frame BEFORE calling `getOrientation()`. After
  remapping, `orientationAngles[2]` is ALWAYS screen-roll (steering-wheel)
  regardless of display rotation. Simplified `dispatchTransform()` rotation
  to `-(smoothRoll - baselineRoll)` for ALL 4 orientations. Verified correct
  for 0°/90°/180°/270°. Also verified the Rev58 arrow offset logic already
  satisfies the user's requirements (same color = same bias for start+end;
  different colors = different biases).

- **Round-6 Revision 70** (current, 2026.6.27 net-control algorithm consistency fix) —
  Per user spec: the [%csl] blue/red net-control algorithm must match the
  "Square Control" info panel's net control. One fix:
  1. **Net-control consistency** (ui.js, BUG FIX) — blue/red candidates changed
     from one-sided dominance (`pAtk>0 && aAtk===0` / `aAtk>0 && pAtk===0`) to
     netCtrl-based (`netCtrl>0` / `netCtrl<0`), where `netCtrl = pAtk - aAtk`.
     This matches the info panel's `myCtrl - opCtrl`. A square with 3 white +
     1 black (netCtrl=+2) now correctly marks blue; previously it didn't (AI
     had an attacker, failing the one-sided condition). Score ranks by
     `|netCtrl|`. Both `_computeAndCacheVisualAnnotations()` and
     `_computeInitialPositionAnnotations()` updated. Spec comment items 3-4
     updated.

- **Round-6 Revision 69** (2026.6.27 multi-color per square + heatmap text deletion) —
  Per user spec: allow multi-color highlights on the same square; delete the
  heatmap conditional-display text from manuals/code. Two changes:
  1. **Multi-color per square** (ui.js, FEATURE) — `_rvCslMap` changed from
     `{square: {color}}` (single-color overwrite) to `{square: [colors]}`
     (array preserving all colors). Render code iterates colors: B/R/G accumulate
     into comma-separated box-shadow inset; Y emits yellow rounded-rect overlay.
     A square can now show both blue box-shadow AND yellow rounded-rect.
  2. **Heatmap text deletion** (manuals + stats.html, DOC) — deleted
     "不含热力图控制统计数据的 PGN → 不显示热力图控制统计区块" / English
     equivalent from v1.0.5 + v1.0.4 manuals (zh+en) and stats.html code comment.

- **Round-6 Revision 68** (2026.6.27 review yellow rounded-rect position fix) —
  Per user report: review-board yellow [%csl] rounded-rect overlay mispositioned.
  One fix + documentation audit:
  1. **Yellow rounded-rect position fix** (ui.js, CRITICAL BUG) — the yellow
     overlay div was emitted AFTER the cell div's `</div>` instead of before,
     so `position:absolute` anchored to `.bgrid` (via `transform:translateZ(0)`)
     instead of the cell (`position:relative`). All yellow overlays stacked at
     the board origin. Fixed by moving the overlay emission to before the cell's
     `</div>` so it becomes a child of the cell div. Parameters unchanged.
  2. **README/LICENSE/NOTICE audit** — checked all 14 matching files; added
     Rev68 entries to chess.src/README.license, java/README.license,
     Manual/README.license, NOTICE, README.md; added Rev54-68 summary entries
     to src/main/README.license, src/main/assets/README.license,
     src/main/res/README.license, src/main/cpp/README.license (were stalled at
     Rev53). LICENSE-* and NOTICE-* original texts need no update.

- **Round-6 Revision 67** (2026.6.27 landscape translation direction fix) —
  Per user request: rigorously verify translation anti-shake direction via first
  principles. Found ROTATION_90/270 boardPxX sign inverted (landscape horizontal
  shake amplified instead of cancelled). One fix:
  1. **Landscape boardPxX sign fix** (StabilizationHelper.java, CRITICAL BUG) —
     ROTATION_90: `boardPxX = -dispY` → `+dispY`; ROTATION_270:
     `boardPxX = +dispY` → `-dispY`. ROTATION_0/180 already correct. Derived
     per-orientation from first principles: device-natural Dx/Dy → world-axis
     mapping, then OIS (device world-right → board screen-left CSS -x; device
     world-up → board screen-down CSS +y). Comment rewritten as derivation
     table. Impact: landscape anti-shake horizontal direction now correct;
     portrait unaffected.

- **Round-6 Revision 66** (2026.6.27 yellow overlap + comment cleanup) —
  Per user spec: allow yellow squares to overlap with blue/red; comprehensively
  delete outdated/redundant comments. Two changes:
  1. **Yellow overlap allowed** (ui.js, FEATURE) — Rev65 EXCLUDED blue/red
     squares from yellow contention. Rev66 removes that exclusion — yellow now
     simply takes the top 3 by total attacker count, regardless of whether
     they're also blue or red. Rendering layer (box-shadow inset + yellow
     rounded-rect overlay) already supports multi-color highlights. Both
     `_computeAndCacheVisualAnnotations()` and
     `_computeInitialPositionAnnotations()` updated. Spec comment item 5 updated.
  2. **Comment cleanup** (10 files, REDUNDANCY) — audited and cleaned ~120
     lines of stale comments: StabilizationHelper.java Rev64 tombstones +
     Rev61 Y-axis fix; MainActivity.java wrong public-contract; ui.js
     arrow-rendering Rev49/54/58 narrative + Rev65/66 yellow explanations +
     Rev62 resign-sound + Rev63 arrow markers; index.html.tpl CSS multi-rev;
     worker-pool.js Rev57 backtick; chess960.js Rev62 array-swap + Rev55 meta;
     pgn-standard.js Rev62 lineLen; ai-bridge.js Rev62 _importedStartColor +
     mate:0/null + depth>0. Principle: retained license headers, current-
     behavior docs, algorithm explanations, i18n, pitfall warnings; deleted
     tombstones describing deleted code / fixed bugs / multi-rev narratives.

- **Round-6 Revision 65** (2026.6.27 yellow-square logic fix) —
  Per user spec: yellow squares (non-arrow) should be the squares with the
  highest total control count (total attackers, regardless of piece color).
  One change:
  1. **Yellow-square logic fix** (ui.js, BUG FIX) — Rev61's condition
     `pAtk>0 && aAtk>0` (both sides must have attackers) was too strict,
     excluding high-total one-sided squares. Rev65 changes it to `total>=2`
     (all squares with 2+ total attackers are candidates), then excludes
     squares already chosen as blue/red (one-sided dominance), and picks the
     top 3 by total. This correctly implements "黄色格子=双方总控制数量最多的
     那几个格子". Both `_computeAndCacheVisualAnnotations()` and
     `_computeInitialPositionAnnotations()` updated. Spec comment item 5 updated.

- **Round-6 Revision 64** (2026.6.27 remove rotation + undo cache sync) —
  Per user spec: remove the rotation part of anti-shake (keep only translation),
  delete all rotation code/comments; and after undo, revert the corresponding
  content in the background real-time cached PGN. Two changes:
  1. **Anti-shake rotation removed** (StabilizationHelper.java + index.html.tpl,
     FEATURE) — `StabilizationHelper.java` completely refactored. Deleted
     sensors: `TYPE_ROTATION_VECTOR`, `TYPE_GAME_ROTATION_VECTOR`,
     `TYPE_MAGNETIC_FIELD` (only `TYPE_LINEAR_ACCELERATION` retained). Deleted
     methods: `processRotationVector()`, `processMagneticField()`. Deleted all
     rotation state fields, constants, scratch arrays. CSS `.bwrap.stabilized`
     `transform` changed from `translate3d(...) rotate(var(--stab-rot,0deg))` to
     `translate3d(var(--stab-x,0px),var(--stab-y,0px),0)` only. `applyTransform()`
     no longer sets `--stab-rot`; added `removeProperty('--stab-rot')` to clear
     residual values. File slimmed from 720 → 337 lines (53% reduction).
     Benefits: 4 sensors → 1 sensor, lower battery, eliminates the entire class
     of rotation-direction bugs from Rev59-63.
  2. **Undo reverts cached PGN content** (ui.js, BUG FIX) — `undoMove()` now
     calls new `_invalidateCachesForUndoneMoves(currentMoveCount)` after
     restoring `moveRecords`. Clears three caches: `_reviewEvalCache` (key >
     currentMoveCount), `_visualAnnotationsCache` (key >= currentMoveCount,
     '_initial' sentinel kept), `_cachedOriginalPGN` (set to null). This
     ensures stale eval/annotation data for undone moves doesn't leak into
     re-played moves, review mode, or PGN export. `_redoStack` is NOT cleared
     (undo must remain reversible).

- **Round-6 Revision 63** (2026.6.27 anti-shake + arrow optimization) —
  Per user spec: limit anti-shake rotation to ±10°, optimize arrow
  positioning and redesign arrow shape. Three changes:
  1. **Anti-shake rotation limit ±10°** (StabilizationHelper.java, FEATURE) —
     `MAX_ROTATION_DEG` reduced from ±30° (Rev61) to ±10°. First-principles:
     sensor floor ~1°, human perception ~0.5-1°, handheld tilt rarely >8°,
     1:1 mapping preserved in 1°-10° range. Dead zone 1.0° unchanged.
  2. **Arrow offset optimization** (ui.js, FEATURE) — offset magnitude changed
     from `Math.min(3, cellSize*0.08)` (3px cap + 8%) to `cellSize*0.12` (12%
     no cap). Scales proportionally with cell size so offset fraction is
     constant across screens. Verified safe for cellSize 20-60px (max radial
     offset = cellSize/2 - 2.75, we use 12% which is well within bound).
     Cell-center formula `col*cellSize + cellSize/2` confirmed exact for all
     cell sizes.
  3. **Arrow shape redesign** (ui.js, VISUAL) — minimal arrow: thin 1.5px
     line (was 2px) + compact 4×3 triangular arrowhead (was 5×4) + butt
     linecap + no origin dot. Line shorten 9→4px (matches new arrowhead).
     stroke-opacity 0.95→0.9 (pieces underneath remain readable). The minimal
     representation that still communicates origin, target, direction, type.

- **Round-6 Revision 62** (2026.6.27 second-pass audit) — Second-pass
  first-principles code audit. One critical bug fix + 5 bug fixes + 3 perf
  improvements + redundancy cleanup:
  1. **Chess960 SP-ID bishop-color array swap fix** (chess960.js, CRITICAL BUG)
     — `_CH960_LIGHT_BISHOP_FILES` and `_CH960_DARK_BISHOP_FILES` were swapped.
     a1/c1/e1/g1 are DARK squares (not light), b1/d1/f1/h1 are LIGHT (not dark).
     This broke 720/960 SP-IDs; SP-ID 518 produced "RNQBBKNR" instead of
     "RNBQKBNR". After fix, all 960 SP-IDs pass round-trip test. The parity
     checks in `backRankToSPID()` were fixed in sync.
  2. **Tablebase 404 misidentified as server-down** (tablebase.js, BUG) — 404
     means "position not in tablebase", not "server down". 3 × 404 falsely set
     `_tbOffline=true` for 60s. Now only 5xx + network errors count.
  3. **PGN move-number regex missing 'O'** (worker-pool.js + tablebase.js, BUG)
     — `(?=[a-hKQRBN])` didn't match 'O', so "1 O-O" wasn't normalized to
     "1. O-O" and "1" was mis-tokenized. Fixed to `[a-hKQRBNO]`.
  4. **Resign sound never played** (ui.js, BUG) — `_resignGame()` called
     undefined `_playSound('lose')`. Now calls `playSound('gameover')`.
  5. **mate:0 vs mate:null distinction lost** (ai-bridge.js, BUG) — `c.mate||0`
     lost the checkmate-now distinction. Fixed to `c.mate!=null?c.mate:0`.
  6. **worker-pool Map delete-during-iteration** (worker-pool.js, BUG) —
     `for...of` + `.delete()` risked skipping entries on some engines. Fixed
     to snapshot keys via `Array.from()` first.
  7. **ECO recommendation LRU no-refresh-on-hit** (game-logic.js, PERF) — cache
     hit returned without delete+re-insert, so hot entries could be evicted
     before cold ones. Fixed to refresh LRU on hit (matching `_tbCache` pattern).
  8. **MultiPV display wasted work during AI thinking** (ai-bridge.js, PERF) —
     computed hintParts/signatures/cache checks 10-50×/sec during AI thinking
     but discarded the result. Early-exit when `!isHintLoading`.
  9. **Eval chart label loop LRU churn** (ui.js, PERF) — used `get()` (refreshes
     LRU) instead of `peek()` in a read-only iteration. Fixed to `peek()`.
  10. **Redundancy cleanup** — removed dead `_importedStartColor` ternary
      (variable never declared, guard always true); removed dead `let lineLen=0`
      in composePGN; simplified redundant `depth>0` check; simplified two
      unreachable ternary branches.
  11. **chess960.js comment correction** — `randomSPID()` comment claimed
      "P(>8 retries) ≈ 0.4%"; actual is (256/65536)^8 ≈ 1.3e-19. Code correct,
      comment fixed.
  12. **Known Chess960 castling detection limitation** (DOCUMENTED, NOT FIXED)
      — `Math.abs(to.col-from.col)===2` only detects castling when king starts
      on col 4. In Chess960 (king can start on cols 1-6), ~78.8% of positions
      have broken castling detection. HIGH risk to fix (4 coordinated locations
      + Zobrist hash); deferred to a dedicated task. Standard chess unaffected.

- **Round-6 Revision 61** (2026.6.27) — Per the 2026.6.27
  development plan. Two critical bug fixes + one feature refinement +
  four additional bug fixes from a first-principles code audit:
  1. **Board anti-shake Y-axis direction reversal fix** (StabilizationHelper.java,
     CRITICAL BUG) — all 4 screen-orientation cases (ROTATION_0/90/180/270)
     in `dispatchTransform()` had the WRONG sign on `boardPxY`. OIS requires
     that when the device moves UP, the board moves DOWN (CSS +Y) to
     compensate; the original code moved the board UP — amplifying the shake.
     User report: "屏幕突然向上移动，棋盘不但不向下位移来抵消，反而也向上".
     X-axis signs were already correct.
  2. **Board rotation sensitivity adjustment** (StabilizationHelper.java,
     FEATURE COMPLETION) — `ROTATION_DEADZONE_DEG` 0.3° → 1.0° (filter
     sensor noise + sub-degree hand tremor); `MAX_ROTATION_DEG` 45° → 30°
     (covers normal handheld tilt, avoids visual abruptness). 1:1 ratio
     (|board rotation| = |screen roll delta|) strictly preserved within
     1°–30° range. User report: "棋盘旋转角度过于敏感，屏幕小幅度转动，
     棋盘就大幅度转动".
  3. **Review-board yellow-square logic fix** (ui.js, CRITICAL BUG) —
     yellow-square selection changed from `total>=2` to `pAtk>0 && aAtk>0`
     (both sides must have attackers). Previously, single-side-dominated
     squares (e.g. 5 white + 0 black = total 5) were misclassified as
     yellow — they should be BLUE. User spec: "黄色格=双方总控制高格(当前
     未正确实现)".
  4. **Arrow stroke-linecap changed to butt** (ui.js, VISUAL REFINEMENT) —
     changed from "round" to "butt" in review-board SVG arrows. The round
     linecap created a small semi-circle at the arrow's start that read as
     an "extra dot" — contradicting user spec "箭头末端没有多余的圆点".
  5. **Engine extraction progress percentage fix** (StockfishNative.java,
     BUG FIX) — `total / 114115752L * 13` truncated to 0 for total < 114 MB
     (Java left-to-right evaluation). Fixed to `total * 13L / 114115752L`.
  6. **stats.html unclosed-brace infinite-loop fix** (stats.html, CRITICAL
     BUG) — `while(moveText.includes('{'))...` would ANR on malformed PGN
     with unclosed `{`. Capped to 10 iterations.
  7. **StatsActivity stream leak fix** (StatsActivity.java, BUG FIX) —
     `loadAssetAsBase64()` switched to try-with-resources to guarantee
     InputStream closure on exception paths.

- **Round-6 Revision 60** — Three changes per user spec:
  1. **Arrow origin dot removed** (ui.js) — removed the small filled circle
     at each arrow's origin in the review-board SVG. The arrowhead suffices.
  2. **Arrow offset calibrated** (ui.js) — reduced per-color diagonal offset
     from 14%/6px-max to 8%/3px-max to prevent arrows from exceeding cell
     boundaries on small screens.
  3. **Rotation limit expanded** (StabilizationHelper.java) — increased
     from ±2° to ±45°. The board can now counter-rotate
     up to 45° to compensate for large device tilt.
     (Note: Rev61 later reduced this back to ±30° — see Rev61 entry above.)

**v1.0.4** (versionCode 104) — previous major release

The v1.0.4 release adds:

1. **Chess960 (Fischer Random Chess) mode** — full implementation with SP-ID selector,
   Shredder-FEN castling rights, 960 castling rules, `UCI_Chess960` engine option,
   and `[Variant "Chess960"]` PGN tag.
2. **Standardized PGN import/export** — Seven-Tag Roster always emitted, `[%eval]`
   / `[%clk]` annotations embedded, Result terminator enforced, tolerant parser
   auto-corrects malformed input.
3. **Heatmap-based control statistics** — per-square average control across all
   positions, strongest/weakest square detection, center-control trend.
4. **Version sync** — versionCode, versionName, AndroidManifest, build.gradle,
   every in-app UI display, Java file VERSION constants, README, NOTICE, every
   README.license file, and HTML manuals all synchronized to v1.0.4.

### Patch revisions (version number unchanged — still v1.0.4 / versionCode 104)

Multiple patch revisions have been applied under the same v1.0.4 version number.
The most significant recent revisions are:

- **Round-5 Revision 17** — Xiaomi HyperOS 3 cache-clearing fix: added a
  Java-side persistent storage layer (`AndroidBridge.persistentGet/Set/Remove`)
  backed by `SharedPreferences`, dual-written alongside WebView localStorage so
  the review-eval cache, language preference, and crash-recovery state survive
  HyperOS 3's aggressive cache wipes. Also added `AndroidManifest.xml` backup
  rules (`backup_rules.xml` + `data_extraction_rules.xml`) declaring
  SharedPreferences and WebView Local Storage as user data (not cache).
- **Round-5 Revision 18** — 📚 PGN Cache Manager: new modal dialog
  accessible from the review toolbar (📚 button next to 🌗/🌈). Lets users
  save the current PGN to a named entry, list all saved entries (with size +
  mtime), import any entry with one tap (syncs both review and main move
  list), and select multiple entries for batch deletion. Backed by
  `AndroidBridge.listPGNCaches/savePGNCache/getPGNCache/deletePGNCaches`
  writing to `/data/data/com.Regalia/files/pgn_cache/` (HyperOS-proof).
  Also removed the 200-entry cap on `_reviewEvalCache` — now unlimited.
- **Round-5 Revision 19** — onclick syntax fix + click-empty-moves-to-review:
  fixed HTML attribute-escaping bug that broke the cache manager's click
  handlers. Also made the "No moves yet" text in the main move list
  clickable to enter review mode (useful for users who just installed the
  app and want to import a PGN before playing any move).
- **Round-5 Revision 20** (current) — HyperOS 3 eval-cache root-cause fix +
  PGN cache rename/tags + review toolbar reorder:
  • **Eval cache**: first-principles analysis revealed that
    SharedPreferences.apply() is async — HyperOS 3 SIGKILLs the app before
    the disk flush, losing data. Fix: dedicated file
    (`/data/data/com.Regalia/files/eval_cache.json`) with atomic write
    (tmp + fsync + rename) + synchronous `saveEvalCacheSync()` Java
    interface. Critical-event flush on onPause/onStop/onUserLeaveHint +
    pagehide/visibilitychange/beforeunload. Debounce reduced 500ms→150ms.
    Eval cache now loads synchronously at JS module construction — **instant
    recovery** of all previously-analyzed evals when entering review mode.
  • **PGN Cache Manager**: new ✏️ Rename and 🔖 Add Tags buttons per entry.
    Tags stored in `<name>.tags.json`, displayed as gold capsule chips.
    Max 10 tags per entry, each ≤30 chars, case-insensitive dedup.
    listPGNCaches() returns all tags in one call.
  • **Review toolbar button order**: 🌗/🌈 moved to right of 💬Vars toggle,
    left of 📝 PGN — groups display buttons (Vars, Heatmap) before action
    buttons (PGN, Save, Cache, FEN).
  • New Java interfaces: persistentSetSync, persistentFlush,
    loadEvalCacheSync, saveEvalCacheSync, renamePGNCache, setPGNCacheTags,
    getPGNCacheTags.
  • backup_rules.xml + data_extraction_rules.xml: added eval_cache.json
    and pgn_cache/ as user data for cloud backup / device migration.
  • Dead code cleanup: removed unused `_pgnCacheToast` variable.
- **Round-5 Revision 21** — Eval cache writes now synchronous +
  PGN cache tag filter/search:
  • **Eval cache**: `_reviewEvalCache.set()` / `.delete()` / `.clear()` now
    trigger **immediate synchronous write** to `eval_cache.json` (no
    debounce). Each eval arrives ~1/sec via `onEngineEval`; sync write
    overhead is ~1-5ms — imperceptible. Completely eliminates the 150ms
    debounce window where new eval data could be lost if HyperOS 3
    SIGKILLed the app mid-debounce.
  • **PGN Cache Manager**: new 🔍 text search box + tag-chip quick-filter
    row at the top of the modal. Search matches entry names AND tags
    (case-insensitive substring). Tag chips collect all unique tags across
    all entries; click a chip to filter by that tag. Tag chips below each
    entry name are also clickable. Smart Select All/None operates only on
    visible (filtered) entries. Filter status bar shows match count.
    Auto-clears filter on close/reopen.
  • New JS functions: `_pgnCacheOnSearchInput`, `_pgnCacheApplyFilter`,
    `_pgnCacheClearFilter`, `_pgnCacheFilterByTag`,
    `_pgnCacheEntryMatchesFilter`, `_pgnCacheCollectAllTags`.
  • New i18n keys: `pgn_cache_search_placeholder`, `pgn_cache_search_apply`,
    `pgn_cache_search_clear`, `pgn_cache_filter_all`, `pgn_cache_filter_by_tag`,
    `pgn_cache_filter_status`, `pgn_cache_filter_no_match` (all zh/en).
- **Round-5 Revision 22** — New Game dialog layout + HyperOS 3
  defense strengthened + PGN cache search UX:
  • **New Game dialog**: Chess960 toggle moved to be directly below the
    "Play Color" section (was below AI Book Moves). Removed the redundant
    "Classic Openings (Optional)" residual title from the Chess960-OFF
    branch. The Chess960-ON dedicated-settings section heading is now
    `T('chess960_label')` (was `T('classic_openings')`).
  • **HyperOS 3 eval-cache defense**: `MainActivity.onDestroy()` now also
    calls `_flushReviewEvalCache()` + `persistentFlush()` before destroying
    the WebView. Previously onDestroy skipped the flush — any eval data
    that arrived between onStop and onDestroy could be lost. The four-layer
    defense is now: (1) dedicated file `eval_cache.json` with atomic write;
    (2) synchronous `saveEvalCacheSync()` using `FileDescriptor.sync()`;
    (3) critical-event flush on Java onPause/onStop/onUserLeaveHint/
    onDestroy AND JS pagehide/visibilitychange/beforeunload; (4) Rev21's
    per-set synchronous write (no debounce).
  • **PGN Cache Manager search**: removed the redundant 🔍 apply button
    (soft-keyboard Enter now triggers search directly via
    `enterkeyhint="search"`). Input type changed to `search` for native
    affordances. The ✏️/🔖/📥 buttons per entry now share the same row
    (was a vertical column).
  • **HTML manuals**: removed the obsolete "Stockfish engine binary"
    paragraph from the v1.0.3 changelog in both zh and en manuals.
- **Round-5 Revision 23** — First-principles code review fixes:
  • **Critical bug fix**: Engine restart (`onEngineRestarting()` /
    `restartCurrentEngine()`) no longer calls `_reviewEvalCache.clear()`,
    which previously destroyed the ENTIRE persisted eval cache (all games'
    data). Now only resets `_reviewEvalRequestedStep=-1` — Stockfish is
    deterministic, so other games' evals remain valid.
  • **Performance**: Eval cache writes restored to 150ms debounce (Rev21's
    per-set synchronous write serialized the entire ~12MB Map on every eval
    callback). `_flushSync()` from lifecycle handlers still forces immediate
    write, so the debounce window is covered by Rev22's onDestroy flush.
  • **Bug fix**: `saveEvalCacheSync()` now uses `Files.move()` with
    `ATOMIC_MOVE` + `REPLACE_EXISTING` on API 26+ — the old delete+rename
    sequence had a brief window where neither file existed.
  • **Redundancy**: Removed dead second cache check in `requestEngineEval()`,
    dead `moveNum` variable in `_buildPGNString()`, stale 🔍 comment.
- **Round-5 Revision 24** (current) — Analyze-all root-cause fix + instant
  PGN-comment eval recovery + player rename + PGN cache completeness:
  • **Analyze-all interruption root-cause fix**: First-principles analysis
    revealed FIVE distinct causes of "分析全部 interrupted at a certain
    point":
    (1) The old `startStep=0` fallback when all steps were cached caused
    `requestEngineEval()` to early-return on cache hit WITHOUT calling
    `_reviewAnalyzeAdvance()`, stalling the batch until the safety timer
    fired. Now `reviewAnalyzeAll()` detects the all-cached case up front
    and short-circuits to completion INSTANTLY (no engine calls, no timer).
    (2) The safety timer was set ONCE with `min(N*8s, 300s)` — capped at 5
    minutes. For long games with depth-22 evals (5-15s/step), the 5min cap
    fired mid-analysis. Now the per-step safety timer RESETS on every
    advance (60s/step, no global cap), and a stuck step is SKIPPED (not
    aborting the whole batch).
    (3) If the engine auto-recovered (`onEngineReady` after Java
    `recoverEngine()`), the batch was silently dropped. Now `onEngineReady`
    resumes the batch if `_reviewAnalyzeAllActive` is still true.
    (4) If `requestEngineEval()` hit cache during batch (rare race or
    re-entry), it returned without advancing. Now it detects
    `_reviewAnalyzeAllActive + cache hit` and calls `_reviewAnalyzeAdvance`.
    (5) `onEngineError` no longer clears `_reviewAnalyzeAllActive` — the
    per-step safety timer covers the recovery window, and the batch resumes
    on `onEngineReady`.
  • **Instant cache restoration from PGN comments**: `tablebase.js _parsePGN()`
    now extracts `[%eval ...]` tags from `{}` comments BEFORE stripping them,
    and `importPGN()` populates `_reviewEvalCache` from the extracted evals.
    When the user enters review mode after import, all positions with
    `[%eval ...]` annotations are shown INSTANTLY with their cached eval —
    the engine is only invoked for positions WITHOUT `[%eval ...]`. This
    implements the "instant recovery from cache (including PGN comments)"
    requirement. Supports all Lichess eval formats: `[%eval 0.35]`,
    `[%eval -1.5]`, `[%eval #5]`, `[%eval #-3]`, `[%eval M5]`.
  • **PGN cache archive completeness**: `_pgnCacheSaveCurrent()` now ALWAYS
    uses `_buildPGNString(true)` (forceIncludeVariations=true). The previous
    behavior preferred `_cachedOriginalPGN` (the imported text), which lost
    NEW moves played after import. `_buildPGNString()` now includes: all
    moveRecords (including post-import moves), variations (forced on
    independent of showVariations UI toggle), `[%eval ...]` from the review
    cache, `[%emt]/[%clk]/[%csl]/[%cal]`, Seven-Tag Roster + supplementary
    tags. The saved PGN archive contains the COMPLETE game record.
  • **Player rename feature**: Clicking the "你"/"You" name on the main
    interface player bar opens a rename prompt. The new name is:
    - Persisted via `AndroidBridge.persistentSet('Regalia_humanName', ...)`
      (HyperOS 3-proof)
    - Reflected in all PGN text (`[White "..."]` / `[Black "..."]`)
    - Reflected in PGN cache archives and clipboard copies
    - Loaded synchronously at JS module init (available before first render)
    Entering an empty string or the default name resets to "你"/"You".
    PGN import with explicit `[White "..."]`/`[Black "..."]` headers also
    populates `_humanPlayerName` if the human player's slot has a non-default
    name.
  • **Redundant 📥 button removed**: The 📥 Import button in the PGN Cache
    Manager was redundant — clicking the entry's name already imports it.
    Removed to save horizontal space; ✏️ Rename and 🔖 Tags buttons remain.
  • **New i18n keys**: `rename_player_hint`, `rename_player_prompt`,
    `rename_player_saved`, `rename_player_reset` (all zh/en).
  • **New globals**: `_humanPlayerName`, `playerWhite`, `playerBlack`.
  • **Stockfish 18 arm64-v8a-dotprod**: Engine binary updated to the
    official sf_18 release (NDK r27c build, 114 MB, NEON+dotprod
    acceleration).
- **Round-5 Revision 25** (current) — Stats page promotion symbols + Chess960
  dialog heading cleanup + first-principles review:
  • **Stats page promotion symbol fix (bug fix)**: In `stats.html
    renderPGNText()`, the `renderSAN()` function previously only prepended
    the pawn symbol for pawn moves (e.g., "e8=Q" → "♙e8=Q") but left the
    "=Q"/"=R"/"=B"/"=N" promotion suffix as a literal letter — inconsistent
    with non-pawn moves where the piece letter IS converted to a symbol.
    Now every promotion piece (Q/R/B/N after '=') is converted to its
    side-colored symbol (♕/♛, ♖/♜, ♗/♝, ♘/♞), regardless of whether the
    move is a pawn move or a piece move. Examples: "e8=Q+" → "♙e8=♕+"
    (White) / "♟e8=♛+" (Black); "exd8=R" → "♙exd8=♖" (White) / "♟exd8=♜"
    (Black). A shared `_replacePromo()` helper handles both the pawn-move
    and piece-move branches uniformly, including the rare theoretical case
    of a piece-letter move with a promotion suffix (not legal in standard
    chess, but defensive).
  • **Chess960 dialog heading removed (redundancy cleanup)**: In the New
    Game dialog, when Chess960 is enabled, the dedicated settings section
    (SP-ID input, back-rank preview, note) previously had a redundant
    `<h3>` heading showing "菲舍尔任意制象棋" / "Fischer Random Chess". The
    Chess960 toggle above (with its own label) already makes it clear what
    mode the user is in. Rev25 removes the heading so the settings appear
    directly under the toggle, saving vertical space. The heading is
    removed in both Chinese and English modes.
- **Round-5 Revision 26** — Stats page promotion symbol root-cause
  fix:
  • **Root cause of "e8=Q still shows letter" found and fixed**: Rev25 added
    a `_replacePromo()` helper to convert `=Q`/`=R`/`=B`/`=N` suffixes to
    piece symbols, but the promotion STILL showed as a letter because the
    underlying SAN regex in `stats.html renderPGNText()` never captured the
    promotion suffix for non-capture pawn promotions. The regex's pawn
    non-capture alternative was `[a-h][1-8][+#]?` (NO promotion group), so
    for "e8=Q" it matched only "e8" — leaving "=Q" to be rendered as raw
    literal characters via the "pass through other characters" fallback.
    Rev26 fixes the regex alternative to `[a-h][1-8](?:=[QRBN])?[+#]?`,
    which captures the full "e8=Q" so `renderSAN()` (and its `_replacePromo`
    helper) can convert the promotion piece to a symbol. The same fix is
    applied to the variation-move regex. Now ALL promotion formats render
    correctly: `e8=Q` → ♙e8=♕, `exd8=R` → ♙exd8=♖, `a8=N#` → ♟a8=♞#,
    `b1=B+` → ♙b1=♗+. Verified via regex test against 12 sample moves.
- **Round-5 Revision 27** — Hyperlinks open in system browser +
  Resign feature + Stats board display + multi-report P0/P1 fixes:
  • **Clickable hyperlinks (About page + everywhere)**: The About page's
    "Source code: https://github.com/YDW99/Regalia" is now a real `<a>`
    hyperlink (previously plain text). ALL hyperlinks anywhere in the app
    (About dialog's AGPL/GPL license links, stats.html links, etc.) are
    intercepted by a new global click handler that calls
    `AndroidBridge.openUrlInBrowser(url)` — a new `@JavascriptInterface`
    method in StockfishNative.java and StatsActivity.java that launches
    the system default browser via `Intent.ACTION_VIEW`. Defense-in-depth:
    `ChessWebViewClient.shouldOverrideUrlLoading()` and the stats WebView's
    WebViewClient also intercept http(s) URLs at the navigation layer, so
    links triggered by any means (JS `window.open`, meta refresh, etc.)
    are routed to the system browser. URLs are strictly validated to be
    http(s) only — file:, content:, javascript:, intent: schemes are
    silently rejected.
  • **🏳️ Resign feature (DeepSeek review 2.1)**: A new 🏳️ Resign button
    appears in the player bar next to the "Your turn" indicator. Tapping
    it opens a confirmation dialog; confirming ends the game with the
    opponent winning. PGN export follows the 元宝 PGN report convention:
    `[Result "0-1"]` if White resigns / `[Result "1-0"]` if Black resigns,
    `[Termination "Resignation"]` supplementary tag, and a
    `{White resigns.}` / `{Black resigns.}` comment on the last move.
    Stops the engine (`stop` command + isAIThinking=false) and the game
    clock. The game-over overlay shows the correct resign text and
    win/lose emoji.
  • **Stats page board display (DeepSeek review)**: A small chess board
    now appears ABOVE the PGN text panel in 📊统计, showing the position
    after the currently-selected move (or initial position if nothing is
    selected). The board uses the SAME color scheme as the main
    chess.html board (SQ_LIGHT/SQ_DARK gradients, coordinate labels with
    stroke, piece symbols with color/stroke/glow), with White at the
    bottom and Black at the top. Width is responsive (max 360px, aspect
    ratio 1:1).
  • **Kimi stats.html P0 fix — Backspace global interceptor**: The
    `keydown` listener that turns Backspace into "return to main game"
    now checks whether the key event originated from an INPUT, TEXTAREA,
    or contentEditable element. Previously, pressing Backspace while
    editing the PGN paste field or any prompt input would (1) prevent
    the character deletion AND (2) immediately bounce the user back to
    the main game — making text editing impossible.
  • **Kimi stats.html P0 fix — applySANMove king-safety validation**:
    `applySANMove` now validates that the moving side's king is NOT in
    check AFTER the candidate move, by calling a new `_isKingSafe()`
    helper. Previously, `canMoveTo` only checked pseudo-legal moves, so
    a pinned piece could "move" and leave its own king in check —
    corrupting the replayed position and all downstream statistics.
    Castling also now checks post-castle king safety. If a disambiguated
    piece fails the check, the scanner continues to the next matching
    piece (correct SAN disambiguation behavior).
  • **Kimi stats.html P1 fix — game complexity threshold**: Changed
    `validEvals.length>=3` to `>=2`. With 2 evals, `changes` has 1
    element — `avgChange` and `variance` are both well-defined
    (variance=0 for a single sample). The previous >=3 check skipped
    the entire complexity section for 2-eval games.
  • **Kimi stats.html P1 fix — _escFEN escaping**: Added `"` and `'`
    escaping to `_escFEN()`, matching chess.html's `_esc()` behavior.
    Closes a potential XSS vector where a malicious FEN imported via
    PGN could break out of HTML attribute context.
  • **Kimi stats.html P1 fix — exportFullHTML regex**: Replaced the
    lazy `[\s\S]*?\n}` regex (which could match a nested object
    literal's closing brace instead of the function's) with a new
    `_stripFnBody()` helper that does brace-depth counting to find the
    function's true closing brace. Prevents orphaned code from leaking
    into the exported HTML.
  • **Stats.html hyperlink interceptor**: New global click handler in
    stats.html routes `<a href="http(s)://...">` clicks to the new
    `AndroidBridge.openUrlInBrowser()` bridge method.
  • **formatEval resign fix**: The resign case in `formatEval()` now
    uses `_resignWinnerColor` directly (set by `_resignGame()`) instead
    of trying to detect "White wins" / "Black wins" in the gameOver
    text (which only contains "resigns"). Fixes a bug where the player
    always appeared to lose even when they won (e.g. AI resigns).
- **Round-5 Revision 28** (current) — Stats↔main PGN sync + resign emoji
  fix + stats board promotion fix:
  • **Stats↔main PGN sync**: Every time the user enters the stats page
    (📊 button), `openStatsPage()` now ALWAYS rebuilds the PGN from the
    current `moveRecords` via `_buildPGNString(true)` (forceIncludeVariations=true).
    Previously, it used `_cachedOriginalPGN` (the text from the last
    importPGN/importPGNFile call), which became STALE when the user played
    new moves after importing — the stats page would show the imported
    PGN's moves, not the current game's moves. Now the stats page always
    reflects the current main/review game state.
  • **Stats→main PGN import-back prompt**: When the user imports a PGN on
    the stats page (via 🗃️ Paste PGN or 📂 Select PGN File) and then
    returns to the main activity (back button or 返回对局 button), a new
    "🗃️ Import PGN to game?" dialog appears with Yes/No/Cancel:
    - **Cancel**: Stay on the stats page (don't return to main).
    - **No**: Return to main without importing (main keeps its current game).
    - **Yes**: Return to main AND trigger the existing "💾 Save PGN file?"
      prompt (to avoid losing the main/review's current PGN), then import
      the stats-page PGN via `importPGN()`.
    The dialog UI matches the app's existing dialog style (.dov/.dlg/.dlg-btns).
    The Android back button is intercepted: if the import-back dialog is
    visible, back = Cancel (dismiss); otherwise back = returnToGame()
    (which may show the import-back dialog if a PGN was imported).
  • **Resign game-over emoji fix**: The game-over overlay's emoji was
    hardcoded to show 🤝 for all non-checkmate terminations. Now it shows
    🏳️ when `_gameOverStatusKey==='resign'` (matching the resign button's
    icon), and 🤝 only for genuine draws (stalemate, 50-move, repetition,
    insufficient material, agreement).
  • **Stats board promotion fix**: The stats page board display (added in
    Rev27) showed a pawn on the back rank instead of the promoted piece
    (queen/rook/bishop/knight) for promotion moves. Root cause: the
    `moveRecords.push({...})` in `tablebase.js _parsePGN()` (the PGN import
    path) was missing the `promotion` field, so `openStatsPage()` serialized
    move records without promotion info, and the stats page's
    `executeMove()` couldn't apply the promotion. Fixed by adding
    `promotion: move.promotion||null` to the pushed move record.
- **Round-5 Revision 29** — PGN import failure root-cause fix + stats page
  en passant + comprehensive bug fixes:
  • **CRITICAL: PGN import failure fix**: Rev28's `promotion:
    move.promotion||null` referenced an undefined variable `move` (loop
    variable is `parsedMove`). The ReferenceError was caught by the
    surrounding try/catch and shown to the user as "Invalid PGN format" —
    EVERY PGN import failed. Fixed to `(parsedMove&&parsedMove.move&&
    parsedMove.move.promotion)||null`.
  • **CRITICAL: Stats page en passant support**: The simplified SAN parser's
    `canMoveTo()` and `executeMove()` did not handle en passant. Importing
    a PGN with en passant (e.g. move 48 `gxf6` in the user's
    Regalia_game 3Ω.pgn) caused parsing to fail at move 94 → side-to-move
    desync → 25 subsequent moves all rejected → stats page showed only 98
    moves. Added en passant branch to `canMoveTo()` and captured-pawn
    removal to `executeMove()`. Stats page now parses all 123 moves.
  • **Stats page checkmate symbol fix**: `buildSAN()` previously never
    emitted `#` (checkmate) — all checks shown as `+`. Added full
    checkmate detection via in-place simulation (mutate→check king
    safety→revert) to avoid the recursive executeMove→buildSAN→
    executeMove loop that caused stack overflow with the naive approach.
  • **NAG Black-side fix**: `ai-bridge.js _buildPGNString()` and
    `stats.html classifyMove()` used raw White-POV delta for mate
    thresholds. A BLACK mating move was misclassified as $4 (blunder)
    instead of $3 (brilliant). Fixed to use side-relative moverDelta.
  • **Stats page Black-to-move-start caption fix**: `_renderStatsBoard()`
    caption used `lastIdx%2===0` for White/Black, ignoring
    `parsed.isBlackToMoveStart`. For black-to-move-start games, the color
    was inverted. Fixed to respect `parsed.isBlackToMoveStart`.
  • **PGN parsing tolerance improvement**: Unclosed `{...}` comments
    previously survived the multi-iteration regex removal, and the
    residual content was tokenized into bogus move tokens generating
    meaningless NULL placeholders. Now follows PGN spec's tolerant
    behavior: an unclosed `{` consumes the rest of the movetext.
  • **Variation prefix number falsy-0 fix**: `v.prefixEllipsisNum||vmn`
    in `_buildPGNString()` incorrectly fell back to vmn when
    prefixEllipsisNum===0 (legitimate rare value). Fixed to explicit
    null check.
  • **stats.html PGN parse error i18n**: Was hardcoded English "PGN parse
    error". Added i18n key `pgn_parse_error` (zh: "PGN 解析失败").
  • **PGN import high-tolerance**: Invalid moves are skipped with NULL
    placeholders (shown as dimmed "—") and side-to-move is auto-advanced
    to avoid cascade failure. Nested variations supported via recursive
    descent parser. App self-exported PGN re-imports perfectly (123
    moves → export → re-import → 123 moves, lossless).
- **Round-5 Revision 30** (current) — Robustness hardening + scroll
  restoration bug fix:
  • **ROBUSTNESS: Scroll position restoration fix**: The .mlist move list
    repeatedly jumped back to top during re-renders. Root cause: with
    `scroll-behavior:smooth` on .mlist, programmatic `scrollTop`
    assignment during restore fired intermediate 'scroll' events that
    overwrote `_mlistScrollState.scrollTop`, causing the NEXT render to
    restore to a stale intermediate position. Fixed with a
    `_scrollRestoreGuard` flag that suppresses `_onMlistScroll` during
    programmatic restore, plus temporarily switching `scroll-behavior`
    to 'auto' for instant restoration. The save phase now also reads
    `scrollTop` DIRECTLY from the live DOM (not just from the event
    handler) for the most reliable snapshot. Same pattern applied to
    `.review-body` in review mode. `_scrollRestoreGuard` is reset on
    new game.
  • **ROBUSTNESS: ChessWebViewClient URL overload**: Now also overrides
    the newer `WebResourceRequest`-based `shouldOverrideUrlLoading`
    overload (API 24+). The deprecated String-based overload only fires
    on API 21-23; on API 24+ only the `WebResourceRequest` overload is
    invoked. Without this override, http(s) links clicked on API 24+
    devices would NOT be redirected to the system browser. The new
    overload delegates to the String overload for consistent behavior.
  • **ROBUSTNESS: chess960.js randomSPID() modulo bias elimination**:
    Previously `buf[0]%960` had a slight bias (65536 isn't a multiple of
    960; values 0..255 were ~0.03% more likely than 256..959). Now uses
    rejection sampling: only accept values < 65280 (the largest multiple
    of 960 ≤ 65536) before applying %960. Bounded retry count (8)
    prevents infinite loops; fallback to %960 if all retries exceed
    (extremely unlikely — P ≈ 0.4%).

See `NOTICE` (VERSION HISTORY SUMMARY → v1.0.4) and the per-module
`README.license` files for full details.
- **Round-5 Revision 31** (current) — Stats board piece sizing + review
  orientation scroll fix + UCI timed-ponder compliance + dead code cleanup:
  • **Stats board piece sizing fix**: `stats.html _renderStatsBoard()` piece
    font-size was `5.2vw` (viewport-relative). In landscape, the viewport is
    wide (e.g. 800px+) but the board container is capped at 360px, so pieces
    overflowed their squares. Fixed: piece font-size now uses a CSS variable
    `--piece-size` set via JS to `(boardWidth / 8 * 0.72)`. This scales
    correctly with the ACTUAL board container in both portrait and landscape,
    on all Android WebView versions (no container query support needed).
    Added `_updateStatsBoardPieceSize()` called after render and on
    resize/orientationchange.
  • **Review mode orientation-change scroll bug fix**: After orientation
    change, the review move list jumped to a wrong scroll position because
    the save phase read `scrollTop` from the OLD layout and the restore
    phase applied that pixel offset to the NEW layout (where it points to a
    different move). The review-moves-list scroll-into-view logic didn't
    fire either (no `reviewStep` change). Fixed: (1) on orientationchange,
    force `_lastReviewStepScrolled=-2` so the next render re-centers the
    active move in the NEW layout; (2) invalidate `_mlistScrollState.valid`
    so the main move list re-snapshots from the new DOM; (3) set
    `_skipReviewBodyScrollRestore` flag so the review-body doesn't restore
    the stale scrollTop (the active-move scroll-into-view handles
    re-centering instead).
  • **UCI COMPLIANCE: Timed-game ponder fix**: Per UCI spec, `go ponder`
    MUST include time params (wtime/btime/winc/binc) so the engine can
    switch to normal time management when `ponderhit` fires. Previously
    `startPonder()` sent only "go ponder" with no time params — breaking
    timed-game ponder (engine searched indefinitely or panicked after
    ponderhit). Fixed: `startPonder()` now accepts 4 time params; JS side
    passes current `gameClocks` values. For untimed games, all zeros are
    passed and Java side sends plain "go ponder". Added `@deprecated`
    legacy single-arg `startPonder()` overload for backward compat.
  • **Dead code cleanup**: Removed unused `_unclosed` flag in
    `tablebase.js _parsePGN` (was set but never read). Removed dead
    `oppKing` variable in `stats.html buildSAN()` (was always null, never
    read — leftover from abandoned check-detection). Removed dead
    `ch==='\s'` comparison in `pgn-standard.js` (a single char can never
    equal the 2-char string "\s" — typo for regex \s class). Fixed
    `composePGN()` to avoid leading blank lines when tagPairs is empty.
- **Round-5 Revision 32** (current) — ECO book move engine-unresponsive
  bug fix + UCI eval optimization:
  • **CRITICAL: ECO book move causing engine unresponsive**: When "AI
    prefers ECO opening book moves" is enabled, after 3 consecutive
    book-served AI moves, the engine appeared "unresponsive" — no AI
    move was made. Root cause: `doAIMove()` increments `_aiRetryCount`
    on every call (expecting it to be reset by `onBestMove`). When the
    ECO book provides a move, the engine is NOT called, so `onBestMove`
    never fires, and `_aiRetryCount` accumulates. After 3 book moves,
    `_aiRetryCount>=3` → `doAIMove()` falsely concludes "AI move failed
    after 3 consecutive timeouts" → shows `ai_timeout` toast and
    RETURNS WITHOUT CALLING THE ENGINE. Fix: reset `_aiRetryCount=0`
    on a successful book move (and tablebase move) — the "request" was
    satisfied, just by the book instead of the engine.
  • **UCI EVAL OPTIMIZATION (per SF18 best-practices doc)**:
    `engineEval()` and `engineEvalDeep()` now set `Contempt=0` (objective
    eval; default 24 biases scores by avoiding draws, distorting
    analysis), `MultiPV=1` (max search depth; MultiPV>1 reduces depth),
    `UCI_ShowWDL=true` (Win/Draw/Loss probability output) BEFORE the
    eval search. After the eval, `handleBestMove()`'s STATE_EVAL case
    calls `restoreGameplayOptions()` to restore `Contempt=24` (aggressive
    gameplay) and the user's MultiPV setting. New methods:
    `applyEvalModeOptions()`, `restoreGameplayOptions()`.
- **Round-5 Revision 33** (current) — Seldepth (SD) display throughout:
  • **Seldepth parsing & display**: Per SF18 eval best-practices doc, added
    seldepth (selective search depth / tactical depth) parsing and display.
    Seldepth reflects the actual max depth reached in tactical variations
    (usually >= depth). Displayed as "SD<N>" right after "D<N>" to match
    the existing abbreviated depth style (e.g., "D15 SD22").
  • **Main UI eval bar + AI opponent bar**: Both now show "D15 SD22" during
    engine search. SD only shown when > 0 AND > depth (seldepth == depth
    is redundant).
  • **Review mode eval bar**: Now shows real-time depth (D), seldepth (SD),
    nodes, and nps during analysis — previously only showed D with no
    nodes/nps. This gives the user full visibility into the engine's
    search progress while reviewing a position.
  • **PGN eval annotation**: formatEvalTag() now includes "SD<N>" in the
    `{SF18 D15 SD22 +0.5 50%W/30%D/20%L}` annotation when seldepth > depth.
  • **Implementation**: StockfishNative.java new SELDEPTH_PATTERN +
    processInfoLine() parsing + 9th/6th/7th params to onEngineProgress/
    onPonderProgress/onEngineEval. ai-bridge.js new _sfSeldepth global +
    cache storage. ui.js updated all 3 eval bar render paths.
- **Round-5 Revision 34** (current) — Chess960 castling own-piece capture
  fix + heatmap coordinate labels:
  • **CRITICAL: Chess960 castling could capture own pieces**:
    `isChess960CastlingLegal()` only checked squares BETWEEN the king and
    rook, not the king's/rook's destinations. In Chess960, the king and
    rook can start close together (e.g., king b1, rook c1), so the king's
    path extends far beyond the rook through occupied squares. `makeMv()`
    would overwrite those squares, destroying own pieces. Fix: now checks
    the UNION of the king's path and rook's path — every square must be
    empty except the king's and rook's own starting positions.
  • **stats.html Chess960 castling**: `applySANMove()` no longer hardcodes
    king from col 4 (e1) — scans the back rank for the king's actual
    column. `executeMove()` castling rook move is now Chess960-aware,
    finding the nearest rook on the castling side instead of always
    using col 7/0.
  • **stats.html heatmap coordinate labels**: Each heatmap cell now
    displays its coordinate (e.g., "a8", "e4") at the top, centered.
- **Round-5 Revision 35** (current) — Timed-game engine stop fix + AI bar
  seldepth label localization:
  • **CRITICAL: Timed-game engine search exceeded clock time**: Two root
    causes fixed:
    (1) Clock expiry didn't send "stop" to the engine. The engine kept
        searching past the GUI's 0-second mark. Fix: `_onGameClockExpired()`
        now calls `AndroidBridge.engineStop()` for an immediate hard-stop.
    (2) `wtime`/`btime` sent to the engine were stale (measured at JS call
        time, but "go" is sent up to 6s later after stopAndWait + ucinewgame
        + readyok). The engine over-allocated search time. Fix: `engineGoTimed()`
        now deducts the setup overhead + a safety margin from the clock
        values before sending "go".
  • **New @JavascriptInterface methods**: `engineStop()` (hard-stop any
    engine state, discards bestmove), `sendToEngine(String)` (raw UCI
    command fallback).
  • **AI opponent bar SD label localization**: The AI opponent bar now
    shows "选深" (Chinese) / "SelDepth" (English) instead of "SD". The
    eval bar keeps "SD" for compactness. New i18n key: `seldepth_label`.
- **Round-5 Revision 36** (current) — AI bar layout restructure + seldepth
  colon + critical bug fixes:
  • **AI opponent bar layout restructure**: Engine search real-time info
    (depth/seldepth/nodes/nps) moved to line 2 right-aligned. Ponder info
    moved to line 3 right-aligned. Line 1 shows only compact status.
  • **Seldepth label colon**: Added ':' between seldepth label and value
    (选深:22 / SelDepth:22) for format consistency.
  • **CRITICAL: engineStop() idle-state fix**: No longer sets
    _discardingPonderBestmove when engine is idle — prevents the next
    game's first bestmove from being silently discarded.
  • **CRITICAL: onPonderProgress score perspective fix**: was inverted
    (playerColor==='black' → should be 'white'). Ponder scores now display
    with correct sign.
  • **stats.html Chess960 castling detection**: Fixed to use destination
    column (6/2) instead of distance (===2) for Chess960 compatibility.
  • **Redundancy**: _updateAIThinkDisplay() no longer duplicates the
    "thinking" placeholder on line 2.
- **Round-5 Revision 37** (current) — AI bar captured pieces split at 7:
  • **AI opponent bar captured pieces split**: When the AI's captured pieces
    count exceeds 7, pieces 8+ are displayed on line 3 (left-aligned),
    sharing the line with ponder info (right-aligned). Pieces 1-7 remain
    on their original row. The player bar keeps the original single-row
    wrap behavior (unchanged). `capturedPiecesHtml()` gains a `splitAt`
    parameter (7 for AI bar, 0/omitted for player bar).
- **Round-5 Revision 38** (current) — AI opponent bar overflow fix:
  • **AI opponent bar overflow fix**: Some information was exceeding the AI
    bar's display width. Fixed by adding `overflow:hidden` to the inner
    column div, `max-width:100%` + `box-sizing:border-box` to
    `#ai-search-info`, `min-width:0` + `overflow:hidden` to the line-3
    container, `min-width:0` to `#ai-ponder-info`, and `max-width:100%` +
    `overflow:hidden` to `.pbar` CSS. All text now properly truncates with
    ellipsis when the bar is too narrow.
- **Round-5 Revision 39** (current) — Ponder info not displayed when captured
  pieces > 7:
  • **CRITICAL: Ponder info not displayed when captured pieces > 7**: The
    `#ai-cap-overflow` div had `width:100%` + `flex:0 0 auto`, causing it to
    take ALL available width in the line-3 flex container, pushing
    `#ai-ponder-info` off-screen. Fix: removed `width:100%`, changed to
    `flex:0 1 auto` (shrink-to-fit) + `min-width:0`. Now the overflow pieces
    only take the space they need, leaving room for ponder info on the right.
- **Round-5 Revision 40** (current) — Overflow pieces horizontal fix +
  ponder alignment fix:
  • **Overflow pieces vertical wrapping fix**: `#ai-cap-overflow` used
    `flex-wrap:wrap` causing pieces to stack vertically when container
    narrowed. Changed to `flex-wrap:nowrap` + `overflow:hidden` — pieces
    always stay horizontal. Reduced font-size to 0.85rem for overflow pieces.
  • **Ponder alignment fix**: Line-3 container used
    `justify-content:space-between` which put `#ai-ponder-info` at LEFT
    when no overflow (single child). Changed to `margin-left:auto` on
    `#ai-ponder-info` for always-right alignment.
- **Round-5 Revision 41** (current) — Player bar captured pieces font-size
  + stats board coordinate labels rework:
  • **Player bar captured pieces font-size**: Reduced from 1.1rem to 0.85rem
    to match AI opponent bar (both bars now visually consistent).
  • **Stats page board coordinate labels rework**: File labels (a-h) moved
    outside board on TOP, rank labels (1-8) moved outside board on LEFT,
    per-cell coordinate labels (e.g. "e4") added inside each cell — all
    matching main board style exactly (color, stroke, glow, paint-order).
- **Round-5 Revision 42** (current) — AI bar overflow pieces not displayed:
  • **CRITICAL: Overflow captured pieces not displayed**: `#ai-cap-overflow` had
    `overflow:hidden` (clipped pieces) + `flex:0 1 auto` (shrank to 0 width).
    Fix: removed `overflow:hidden`, changed to `flex:0 0 auto` (natural width,
    no shrink). All overflow pieces now display correctly.
- **Round-5 Revision 43** (current) — Exported stats HTML stuck at "Loading..." fix:
  • **CRITICAL: Exported stats HTML stuck at "Loading..."**: The `_stripFnBody()`
    function's brace-counting logic matched nested function closing braces
    (at depth 0 + next char \n/space), truncating the strip of `_exportFullHTML`
    mid-function. This left orphaned code in the exported JS → syntax error →
    page never executed → stuck at "Loading...". Fix: changed end condition to
    depth===0 AND '}' at start of line (preceded by \n) — standard JS convention
    for top-level function closing braces. All 9 stripped functions now strip
    correctly; full exported JS passes syntax validation.
- **Round-5 Revision 44** (current) — Eval bar stuck fix + Worker memory leak
  fix + _stripFnBody simplification:
  • **Eval bar stuck mid-analysis**: Added JS-side eval safety timer (10s) that
    resets `_evalLoading` if the engine doesn't respond. Prevents the eval bar
    from getting stuck at "分析中" when `stopAndWaitForBestmove` blocks or the
    engine fails to respond.
  • **Worker memory leak fix (review report item 1)**: Added `terminateWorker()`
    registered on `pagehide`/`beforeunload` — terminates the Web Worker and
    revokes its Blob URL on page exit, preventing OOM from accumulated Worker
    threads in Android WebView.
  • **_stripFnBody simplification (review report item 18)**: Replaced fragile
    brace-counting with simple regex `function name(){...}` → `function name(){}`
    via non-greedy match to next `\n}` at column 0. Verified for all 9 functions.
- **Round-5 Revision 45** (current) — Engine timeout threshold extended:
  • **AI safety timer**: Extended from 15s to 30s to accommodate timed-game
    mode where the engine may need 20-25s for complex positions at high
    difficulty levels.
  • **Eval safety timer**: Extended from 10s to 15s to match (eval searches
    at depth 15/22 can take 10-12s on complex positions).
- **Round-5 Revision 46** (current) — Timeout emoji fix + engine timeout 360s:
  • **Timeout emoji fix**: Game-over overlay and eval bar now show ⌛ for timeout
    wins (was 🤝 — fell through to default draw emoji).
  • **Engine timeout extended**: AI safety timer 30s→360s (6 min); eval safety
    timer 15s→30s. Fully accommodates long timed games.
- **Round-5 Revision 47** (current) — Timeout game-over text re-localization:
  • **Timeout text not re-localizing**: The timeout game-over text was set
    directly using `_lang` instead of `T()`, so switching language after
    game-over didn't update the text. Fix: added `'timeout'` branch to
    `_gameOverStrFromStatus()` with new `_timeoutWinnerColor` variable and
    new i18n key `timeout_win_suffix`. Now re-localizes correctly.
- **Round-5 Revision 48** (current) — PGN comment completeness + Blue/Yellow
  arrows + review board visual annotations + stats conditional display:
  • **PGN comment/visual-annotation completeness fix**: First-principles
    review revealed that `_parsePGN` in `tablebase.js` STRIPPED all brace
    comments during parsing — only `[%eval ...]` tags were extracted
    beforehand. This meant `[%csl ...]` (square highlights), `[%cal ...]`
    (arrows), AND free-text comments from imported PGNs were LOST. The user
    requirement "all valid () variations and {} comments must be fully
    received" was not met. Fix: added a pre-strip extraction pass that
    walks the movetext character-by-character (tracking paren depth for
    variation-internal comments), extracts `[%csl]`/`[%cal]` tags AND
    free-text comment bodies, and attaches them to the next main-line
    move. `importPGN()` now populates `_visualAnnotationsCache` and
    `mr.comment` from the extracted data. `_buildPGNString()` now includes
    `mr.comment` in the comment parts (with literal `{`/`}` escaped to
    Unicode full-width braces to avoid premature comment termination).
    PGN round-trip is now lossless for comments and visual annotations.
  • **NEW: Blue and Yellow arrows in visual annotations**: Per user spec
    (备忘1.md), added two new arrow colors:
    - Blue arrow = one side's piece simultaneously threatens multiple
      (>1) enemy pieces (arrows from threatening piece to each
      threatened piece)
    - Yellow arrow = one side's threat to the other side's queen
      (arrow from threatening piece to queen's square)
    `_computeAndCacheVisualAnnotations()` in `ui.js` now computes these
    from the post-move control map. Caps: top 3 attackers by threat
    count (blue), top 3 attackers by piece value (yellow), max 4 blue
    arrows per attacker.
  • **Stats page visual annotations section enhancement**: The visual
    annotations section in `stats.html` now displays all 4 arrow colors
    (Blue, Red, Yellow, Green) in the SAME left-to-right order as the 4
    square colors — so same colors align VERTICALLY (per user spec).
    New i18n keys: `blue_arrows_threats`, `yellow_arrows_queen` (zh+en).
    Updated `visual_annotations_desc` to mention all 4 arrow types.
  • **Stats page conditional display**: Per user spec, the visual
    annotations section is now ONLY shown if the PGN actually contains
    `[%csl]` or `[%cal]` tags. Similarly, the heatmap control statistics
    section heading is now inside the `_posCount>0` check.
  • **Review board visual annotations overlay**: Per user spec (备忘1.md),
    when the control heatmap is OFF in review mode, the review board now
    displays `[%csl]`/`[%cal]` annotations:
    - Square highlights via CSS box-shadow inset (3px, matching last-move
      hint width). Colors: B=#4a90d9, R=#e74c3c, Y=#f1c40f, G=#27ae60.
    - Arrows drawn in an SVG overlay layer (same style as the main board's
      `_updateArrows()`: 4px stroke, round linecap, 0.85 opacity,
      triangular arrowhead marker per color).
    The `.review-board` CSS rule now has `position:relative` so the SVG
    overlay's `position:absolute` anchors correctly.
