# verifier run 2026-10-05T0300Z · v1 (final acceptance)

- JS harness: node v1/eval-stale-harness.js => 28/28 PASS (fixed worktree)
- Bundle: chess.html rebuilt via build-chess.py = 24,290 lines / 1,477,911 bytes;
  all 11 chess.src modules + inline script pass node --check
- Release APK (Regalia-v1.2.3-round52-release.apk, 78,299,071 bytes):
  - apksigner: v1=true, v2=true, v3=true; signers=1
  - cert SHA-256 45bc6d36c9fcff8ef9e55f510b43bce44cb854ea4b2f235a0f4955da05a8d8bc (matches uploaded keystore)
  - versionCode=10203, versionName=1.2.3; minSdk 23 / targetSdk 35
  - embedded lib/arm64-v8a/libstockfish.so SHA-256 = 8f7116d3f1a7004a6581d4fb0c1ff891ce095bab6d45e52f1578897cf23b61b5 (official SF18 android-armv8-dotprod, three-way match)
  - bundle contains round-52 fix (_evalLastDispatchedFen x5, round-52 markers x6)
- Source tar: 146 entries; excludes src/main/jniLibs (engine), keystore-info.txt,
  *.keystore, build/.gradle/.cxx, local.properties, lint-baseline.xml, staging dirs
  (r46/, review/), plan-r50.md, sonar-issues-full.csv — matches round-51 tar convention
  plus the new verifier/ directory.
