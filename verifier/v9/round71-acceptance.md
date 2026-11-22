# Regalia round-71 acceptance criteria (v9)

> **Historical record — superseded by v10 and v11.** This document is preserved for audit, not used as the current acceptance gate. In particular, v10 corrects the no-INTERNET assertion and v11 replaces the fixed license-archive size/hash expectation with current-byte validation.

Created: 2026-11-22 (UTC). Base: PR #59 head `f78317919818a02c1fa169a99b85cad6ebf8a1fe`.

This is the authoritative final-artifact gate. It preserves v4–v8 and makes one evidence-based correction to v8's native-library set. No source, regression, security, signing or packaging requirement is relaxed.

## Erratum to v8

1. The actual Release native-merge output contains three libraries, all under `lib/arm64-v8a/`: `libstockfish.so`, `libengine_bridge.so`, and `libc++_shared.so`. The last is required by the unchanged `ANDROID_STL=c++_shared` configuration and must not be removed as redundant. The exact APK native set is these three files; no other native file or ABI is accepted.

## Final artifact acceptance

2. `assembleRelease` completes successfully with JDK 17, SDK 35, NDK 27.2.12479018 and CMake 3.31.6. Source SDK/ABI/version/permission contracts remain unchanged.
3. The exact delivered APK passes ZIP CRC and duplicate/path-safety checks and apksigner verification with v1=true, v2=true and v3=true. It has one signer and certificate SHA-256 `45bc6d36c9fcff8ef9e55f510b43bce44cb854ea4b2f235a0f4955da05a8d8bc`.
4. aapt reports applicationId `com.Regalia`, versionCode/name 10203/1.2.3, minSdk 23, targetSdk 35, native-code arm64-v8a, no debuggable marker and no INTERNET permission.
5. Independent APK Signing Block parsing validates both size fields, the magic, pair boundaries and exact consumption, and finds one v2 block `0x7109871a` and one v3 block `0xf05368c0`.
6. Embedded Stockfish size/SHA-256 are exactly 100,695,968 bytes and `ffd8fc2004d3d19f9fdab95d84c92709aea92e8d3af405eda0b281b23cf1daf8`. Embedded `assets/chess.html` is exactly 1,500,732 bytes, SHA-256 `cc69b869077a72dc1367461c6567a47fea159d292fd5e3d207a2afef84f167b5`, and byte-identical to the final source bundle.
7. HyperOS 3 is assessed only through static min/target SDK, ABI, manifest and packaging compatibility. No physical HyperOS 3 device was attached and no device-test claim is made.
8. The delivered source ZIP excludes VCS metadata, build/cache directories, local/signing properties, all engine binaries, `src/main/jniLibs`, all keystores and secrets. It includes dotfiles, every verifier version and honest run/recovery records, plus the unchanged 56,011-byte `LICENSE&NOTICE.zip`.
9. Uploaded passwords are searched in source payload, raw APK, every decompressed APK member, raw source ZIP and every decompressed source-ZIP member without printing their values; no match is allowed. The uploaded keystore hash and engine hash are also forbidden in the source archive.
10. Every post-recovery validation, including rejected scanner exit-code wrappers and failed gates, has a timestamped command, exit-code and output record. Older lost logs are not fabricated. Logs produced by validating an already-written final ZIP necessarily remain outside that ZIP to avoid a self-referential package; they are preserved in the recovery record.
11. Final byte sizes and SHA-256 hashes are recorded only after the exact output files are written. The exact delivered files, not merely intermediate build outputs, must pass the final validators.
