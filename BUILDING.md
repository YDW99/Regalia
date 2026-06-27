# Building Regalia v1.0.5 from source

<!-- AI-GEN: AI assisted
     This document was AI-assisted and has been reviewed for AGPL v3 compliance. -->

## Engine binary (NOT included in this tar)

Download from:
https://github.com/official-stockfish/Stockfish/releases/download/sf_18/stockfish-android-armv8-dotprod.tar

Copy as `libstockfish.so`:
```
mkdir -p src/main/jniLibs/arm64-v8a
cp stockfish/stockfish-android-armv8-dotprod src/main/jniLibs/arm64-v8a/libstockfish.so
chmod +x src/main/jniLibs/arm64-v8a/libstockfish.so
```

## Build chess.html asset
```
bash build-chess.sh
# (or equivalently: python3 build-chess.py)
```
The build script merges `src/main/assets/chess.src/*.js` (in order:
game-logic → chess960 → pgn-standard → worker-pool → ai-bridge → tablebase → eco-data → ui)
into `src/main/assets/chess.html`, stripping `export` statements.

## Build APK
```
./gradlew assembleRelease
```
The signed APK (v1+v2+v3 signed with `../debug.keystore`) will be at
`build/outputs/apk/release/`.

## Requirements
- Android SDK API 35, NDK r27c, Gradle 8.x, JDK 21
- The APK is signed with a debug keystore by default. For production,
  replace `signingConfigs.release` in `build.gradle` with your own keystore.

## v1.0.5 build notes
- All v1.0.4 build notes still apply (chess960.js, pgn-standard.js, worker-pool.js
  are bundled before ai-bridge.js).
- The Stockfish 18 `arm64-v8a-dotprod` binary is the official sf_18 release
  (NDK r27c build, 114 MB, NEON+dotprod acceleration).
- v1.0.5 Round-6 Rev61 (2026.6.27): The `chess.src/` modules are merged by
  `build-chess.sh` into `chess.html`. If you modify any file in `chess.src/`,
  re-run `bash build-chess.sh` before `./gradlew assembleRelease` to ensure
  the latest JS is bundled into the APK.
- The APK is signed with a debug keystore by default. For production,
  replace `signingConfigs.release` in `build.gradle` with your own keystore.
  The default debug keystore produces a fully valid v1+v2+v3 signed APK
  that installs on Xiaomi HyperOS 3 (Android 15).

## v1.0.4 build notes (historical)
- New modules `chess960.js`, `pgn-standard.js`, and `worker-pool.js` are
  bundled before `ai-bridge.js` so their functions (e.g. `composePGN`,
  `sevenTagRoster`, `toShredderCastling`, `initChess960State`,
  `workerParsePGN`, `formatEmtTag`, `formatCslTag`, `formatCalTag`,
  `formatTimeControl`) are in scope when `ai-bridge.js` and `ui.js`
  reference them.
- The Stockfish 18 `arm64-v8a-dotprod` binary is the same version as
  v1.0.3 — no engine re-download is needed when upgrading from v1.0.3.
- The `worker-pool.js` module creates a Web Worker via Blob URL. This
  works under the WebView's `script-src 'unsafe-inline'` CSP. If the
  device's WebView does not support Workers (Android 4.4 / API 19
  predecessors — but minSdk is 21 so this is moot), all worker calls
  fall back to inline synchronous execution.
