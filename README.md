# Regalia ♔

<!-- AI-GEN: AI assisted
     This document was AI-assisted and has been reviewed for AGPL v3 compliance. -->

A standalone, open-source chess app for Android — play offline against Stockfish 18, analyze your games, and explore openings. No account, no network, no tracking. Now with **Chess960 (Fischer Random Chess)** support (v1.0.4).

"Regalia" is used solely as a project name for this open-source chess app. No trademark rights are claimed. Anyone is free to fork and rename their own version.

## Screenshots

<p align="center">
  <img src="assets/screenshot.jpg" alt="Regalia gameplay screenshot" width="280">
</p>

Portrait mode — evaluation bar, move history, AI opponent display with ponder info, and Control heatmap. See the user manual (`Manual/Regalia-v1.0.9-manual-{zh,en}.html`) for wireframe diagrams of every screen.

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
│   │   ├── values/strings.xml  # Application name ("Regalia v1.0.9")
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
│   ├── Regalia-v1.0.9-manual-zh.html  # Chinese user manual (current)
│   ├── Regalia-v1.0.9-manual-en.html  # English user manual (current)
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

During the development stage, the version number used was: **v18.x.x**. For future versions, once the version number exceeds **v17.x.x**, <span style="color:red; font-weight:bold;">**v18.x.x** should be skipped</span> and the next version should be **v19.x.x**.

**v1.0.9** (versionCode 109) — current release

The v1.0.9 release fixes two critical user-reported bugs (PGN single-line import
failure + review/stats "extra kings" board corruption) and improves the light-mode
evaluation chart color differentiation. See the v1.0.9 Phase 52 changelog below
for full details.

**v1.0.8** (versionCode 108) — previous release

The v1.0.8 release completely redesigns the move animation and sound effect system
following the "Personified Chess Move Animation" and "Personified Chess Sound Effects"
reference documents. Each piece now has a unique personified motion characteristic
and matching timbre. Light mode support is also added following the "Android Dark
Theme Design Principles" and "Android Light Theme Design Principles" — light/dark
mode switches automatically with the system global setting, and the king icon on
the loading overlay and main header toolbar switches between ♔/♚ to match the
on-board pieces. See the v1.0.8 Phase 22 changelog below for full details.

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

