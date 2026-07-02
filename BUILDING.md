# Building Regalia v1.0.8 from source

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
- Configure `gradle.properties`:
  - `org.gradle.java.home` → path to JDK 21
  - `org.gradle.java.installations.paths` → same path
- Configure `local.properties`:
  - `sdk.dir` → Android SDK path
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

## v1.0.8 build notes
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
*AI生成*

---
*AI生成*
