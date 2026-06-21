# Building Regalia v1.0.3 from source

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
cd src/main/assets/chess.src/
bash build-chess.sh
```

## Build APK
```
./gradlew assembleRelease
```

## Requirements
- Android SDK API 35, NDK r27c, Gradle 8.x, JDK 21
