# Regalia round-71 acceptance criteria (v5) — recovered specification

Created: 2026-11-22 (UTC). Base: PR #59 head `f78317919818a02c1fa169a99b85cad6ebf8a1fe`.

This version adds round-71 review remediation and final-artifact gates. It does not replace or edit v1-v3.

## Source and review remediation

1. Run mobsfscan 1.2.0 against the exact base before editing; record `android_logging` count and the SARIF span evidence for CR-1. Final source must also produce zero `android_logging` findings without a global suppression directive.
2. Rename all 12 underscore-prefixed Java method declarations and their references mechanically; no reflection or string-based reference may remain. Preserve behavior and version 10203 / 1.2.3.
3. Correct the Java license ledger to Mixed AGPL v3 and GPL v3 with per-file classification; correct round-70 audit/worklog statements about suppression limits and accepted PV moves. Preserve append-only audit history by adding errata rather than deleting evidence.
4. Restore CodeQL `c-cpp` with `build-mode: none`, disable checkout credential persistence, pin mobsfscan to 1.2.0, add Dependabot version-update configuration, and set git mode 100755 on `gradlew`.
5. Keep `LICENSE&NOTICE.zip`; add no network permission, engine replacement, new dependency, or unrelated cleanup.

## Regression and build gates

6. Existing harnesses pass v1 44/44, v2 27/27, v3 51/51; r62 thirteen negative gates pass; r67 benchmark passes. Every invocation is logged under `verifier/runs/`.
7. All chess.src JavaScript modules pass `node --check`. `build-chess.py` is deterministic across two runs; APK `assets/chess.html` is byte-identical to the final source bundle.
8. `assembleRelease` succeeds with JDK 17, compile/target SDK 35, min SDK 23, NDK 27.2.12479018 and CMake 3.31.6. ABI remains arm64-v8a. These are static compatibility checks for HyperOS 3; no physical-device claim is allowed without an attached device test.
9. The final APK uses the uploaded key and verifies with apksigner as v1=true, v2=true, v3=true. Certificate SHA-256 is `45bc6d36c9fcff8ef9e55f510b43bce44cb854ea4b2f235a0f4955da05a8d8bc`; version is 10203 / 1.2.3.
10. Embedded `lib/arm64-v8a/libstockfish.so` is exactly 100,695,968 bytes with SHA-256 `ffd8fc2004d3d19f9fdab95d84c92709aea92e8d3af405eda0b281b23cf1daf8`. The APK Signing Block is independently checked for v2 and v3 scheme IDs.

## Delivery gates

11. Deliver a release APK and a ZIP source backup. The ZIP must exclude `.git`, build/caches, `local.properties`, `src/main/jniLibs`, engine binaries, all keystores and signing secrets. It must include dotfiles (`.gitignore`, `.github`, `src/main/java/.mobsf`), verifier v4 and run records, and `LICENSE&NOTICE.zip`.
12. Scan both deliverables and the source tree for the uploaded passwords without printing them. Record SHA-256 and byte sizes. Final verifier run must pass after the exact delivery files are written.

## v5 addendum — executable MobSF evidence

- mobsfscan version must be exactly 1.2.0, with both mobsfscan and semgrep on PATH.
- Every SARIF invocation must have executionSuccessful=true and no driver error.
- Current tree: 8 total results, android_logging=0. Marker-stripped copy:
  android_logging=259. There are exactly 223 inline markers and no active global
  ignore-rules directive. The nine disputed spans in v4 are independently checked.
- The historical v4 wording remains unchanged; this v5 file corrects its method
  count and strengthens scanner validation rather than overwriting v4.
