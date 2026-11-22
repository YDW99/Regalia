# Regalia round-71 acceptance criteria (v10)

Created: 2026-11-22 (UTC). Base: PR #59 head `f78317919818a02c1fa169a99b85cad6ebf8a1fe`.

This is the authoritative final-artifact gate. It preserves v4–v9 and corrects the prospective permission assertion. No source, regression, security, signing or packaging requirement is relaxed.

## Errata incorporated from v8/v9

1. Exact native set: `lib/arm64-v8a/libstockfish.so`, `lib/arm64-v8a/libengine_bridge.so`, and `lib/arm64-v8a/libc++_shared.so`. No other native file or ABI is allowed. The C++ runtime is required by unchanged `ANDROID_STL=c++_shared`.
2. The source manifest is byte-unchanged from PR head and already declares `android.permission.INTERNET`. The task prohibits adding network permission/egress; it does not authorize removing baseline functionality. Therefore v9's prospective no-INTERNET assertion was wrong. The APK permission-name set must exactly equal the eight baseline names: INTERNET, WAKE_LOCK, VIBRATE, WRITE_EXTERNAL_STORAGE, READ_EXTERNAL_STORAGE, FOREGROUND_SERVICE, FOREGROUND_SERVICE_SPECIAL_USE and POST_NOTIFICATIONS. No additional permission is accepted.

## Final artifact acceptance

3. `assembleRelease` completes successfully with JDK 17, SDK 35, NDK 27.2.12479018 and CMake 3.31.6. Source SDK/ABI/version/permission contracts remain unchanged.
4. The exact delivered APK passes ZIP CRC and duplicate/path-safety checks and apksigner verification with v1=true, v2=true and v3=true. It has one signer and certificate SHA-256 `45bc6d36c9fcff8ef9e55f510b43bce44cb854ea4b2f235a0f4955da05a8d8bc`.
5. aapt reports applicationId `com.Regalia`, versionCode/name 10203/1.2.3, minSdk 23, targetSdk 35, native-code arm64-v8a, no debuggable marker and exactly the baseline permission set above.
6. Independent APK Signing Block parsing validates both size fields, the magic, pair boundaries and exact consumption, and finds one v2 block `0x7109871a` and one v3 block `0xf05368c0`.
7. Embedded Stockfish size/SHA-256 are exactly 100,695,968 bytes and `ffd8fc2004d3d19f9fdab95d84c92709aea92e8d3af405eda0b281b23cf1daf8`. Embedded `assets/chess.html` is exactly 1,500,732 bytes, SHA-256 `cc69b869077a72dc1367461c6567a47fea159d292fd5e3d207a2afef84f167b5`, and byte-identical to the final source bundle.
8. HyperOS 3 is assessed only through static min/target SDK, ABI, manifest and packaging compatibility. No physical HyperOS 3 device was attached and no device-test claim is made.
9. The delivered source ZIP excludes VCS metadata, build/cache directories, local/signing properties, all engine binaries, `src/main/jniLibs`, all keystores and secrets. It includes dotfiles, every verifier version and honest run/recovery records, plus the unchanged 56,011-byte `LICENSE&NOTICE.zip`.
10. Uploaded passwords are searched in source payload, raw APK, every decompressed APK member, raw source ZIP and every decompressed source-ZIP member without printing their values; no match is allowed. The uploaded keystore hash and engine hash are also forbidden in the source archive.
11. Every post-recovery validation, including rejected scanner exit-code wrappers and failed gates, has a timestamped command, exit-code and output record. Older lost logs are not fabricated. Logs produced by validating an already-written final ZIP necessarily remain outside that ZIP to avoid a self-referential package; they are preserved in the recovery record.
12. Final byte sizes and SHA-256 hashes are recorded only after the exact output files are written. The exact delivered files, not merely intermediate build outputs, must pass the final validators.
