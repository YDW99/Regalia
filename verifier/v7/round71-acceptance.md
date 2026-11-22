# Regalia round-71 acceptance criteria (v7)

Created: 2026-11-22 (UTC). Base: PR #59 head `f78317919818a02c1fa169a99b85cad6ebf8a1fe`.

This version preserves v4–v6 and adds final delivery verification plus two validator corrections. It does not relax any source, regression, security, signing or packaging requirement.

## Validator corrections

1. The actual remediation covers twelve methods, not the thirteen stated by historical v4.
2. MobSF disputed evidence comprises eight unique SARIF spans. The earlier persisted console excerpt displayed `EngineSettingsHelper.java (202,254)` once in each of two end-line groups; that repetition is not two SARIF results. v7 retains all eight unique span assertions, both execution-success checks, 223 markers, current total/logging 8/0 and stripped logging 259.
3. The source gate derives versionCode/name from the four actual version.properties components and prints a v7 label rather than the copied v5 label.

## Final artifact acceptance

4. `assembleRelease` completes successfully with JDK 17, SDK 35, NDK 27.2.12479018 and CMake 3.31.6. The source SDK/ABI/version/permission contracts remain unchanged.
5. The exact delivered APK verifies with apksigner: v1=true, v2=true, v3=true; certificate SHA-256 is `45bc6d36c9fcff8ef9e55f510b43bce44cb854ea4b2f235a0f4955da05a8d8bc`; versionCode/name are 10203/1.2.3.
6. Independent APK Signing Block parsing finds scheme IDs 0xf04768a0 (v2) and 0xf05368c0 (v3). APK native libraries are exclusively `lib/arm64-v8a/libstockfish.so`.
7. Embedded engine size/SHA-256 are exactly 100,695,968 bytes and `ffd8fc2004d3d19f9fdab95d84c92709aea92e8d3af405eda0b281b23cf1daf8`. Embedded `assets/chess.html` is byte-identical to the final 1,500,732-byte deterministic bundle.
8. HyperOS 3 is assessed only through static min/target SDK, ABI, manifest and packaging compatibility. No physical HyperOS 3 device was attached and no device-test claim is made.
9. The delivered source ZIP excludes VCS metadata, build/cache directories, local/signing properties, all engine binaries, `src/main/jniLibs`, all keystores and secrets. It includes dotfiles, all verifier versions and honest run/recovery records, plus the unchanged 56,011-byte `LICENSE&NOTICE.zip`.
10. Uploaded passwords are searched in source, APK and ZIP without printing their values; no match is allowed. Final sizes and SHA-256 hashes are recorded only after the exact output files are written.
11. Every post-recovery validation, including rejected scanner exit-code wrappers and failed gates, has a timestamped command, exit-code and output record. Older lost logs are not fabricated.
