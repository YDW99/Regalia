# Regalia round-72 acceptance criteria (v11)

Created: 2026-11-22 (UTC). Comparison base: pre-round-71 PR #59 head `f78317919818a02c1fa169a99b85cad6ebf8a1fe`. Current remote state inspected before implementation: `upload` at `a245de549b473812aa36f0158f3f8b1a98a4a3e5`.

v11 supersedes v10 as the authoritative verification and delivery-evidence gate. v4–v10 remain append-only history. Round-72 does not change chess behavior, Java application behavior, dependencies, SDK/ABI/version/permissions, or the signed APK.

## Source and CI gates

1. Rename-only and source comparisons use the explicit pre-change commit above, never current `HEAD`. A clean committed round-72 checkout must pass. Java changes relative to that base must be a subset of the four approved paths, not an exact working-tree set.
2. Build configuration, baseline permission names, SDK/NDK, version 1.2.3/10203 and arm64-only ABI remain unchanged. Out-of-scope changes are rejected; inherited round-71 evidence is accepted only when byte-identical to the inspected `a245de5` tree.
3. Restore the round-71 CodeQL C/C++ no-build entry and disabled checkout credentials, pin `mobsfscan==1.2.0`, restore Dependabot weekly Gradle/GitHub Actions checks, and restore `gradlew` index mode `100755`.
4. v9 is visibly marked historical/superseded. Its no-INTERNET and fixed-license-size statements are not current policy; v10's exact eight-name baseline permission set remains authoritative.

## Protected license archive

5. `LICENSE&NOTICE.zip` may be manually updated. Existence, nonzero size, safe paths, CRC validity, recursive content inspection and byte equality with the current reviewed tree are mandatory. No historical size or hash is an invariant. A change record, changed size, changed hash or failure of an old fixed-size validator is never a reason to restore an older archive.
6. The current `a245de5` archive is preserved independently before any round-72 packaging. The original round-71 source ZIP remains an immutable historical snapshot and must not overwrite the current license archive.

## Exact downloaded APK gate

7. Because round-72 changes no application payload, the delivered APK must remain exactly 81,552,289 bytes with SHA-256 `644919d57c690b54c56b26ed0ce91ec785d67a68e8e58eeaa6aed2946a5533fb`. It must be the actual file saved through the round-71 download entry, not merely an intermediate build output or a same-hash assertion.
8. The downloaded file itself must pass ZIP CRC/duplicate/path checks; apksigner v1=true, v2=true and v3=true; one signer; certificate SHA-256 `45bc6d36c9fcff8ef9e55f510b43bce44cb854ea4b2f235a0f4955da05a8d8bc`; applicationId/version `com.Regalia` 10203/1.2.3; minSdk 23; targetSdk 35; non-debuggable Release; exact baseline permission set; and arm64-v8a only.
9. Independent Signing Block parsing must validate size fields, magic, pair boundaries and exact consumption, with v2 ID `0x7109871a` and v3 ID `0xf05368c0`. Native entries must be exactly Stockfish, `libengine_bridge.so` and `libc++_shared.so` under `lib/arm64-v8a/`. Embedded engine and `chess.html` sizes/hashes remain the v10 values, and the bundle is byte-identical to source.
10. HyperOS 3 is static-compatibility assessment only. No physical HyperOS 3 device test is claimed.

## Recursive source, binary and secret gates

11. One bounded recursive ZIP walker serves source payload, source ZIP and nested archive inspection. It enforces depth, per-member, cumulative decompressed-size and member-count limits; rejects duplicates, unsafe paths, encryption, malformed archives and read errors; and fails closed without printing a zero-match success result.
12. Secret scanning covers raw source files, source-payload archives, the raw and recursively decompressed APK, and the raw and recursively decompressed source ZIP. UTF-8 and UTF-16LE/BE forms of both uploaded passwords are checked without printing values. Errors use opaque stage/member sequence labels, never source paths or archive member names.
13. Binary inspection rejects ELF magic, the engine hash, the uploaded keystore hash, keystore/APK/AAB/native-library suffixes, engine archives and any `src/main/jniLibs` member at every archive depth. Path matching uses normalized case-insensitive components.
14. Source packing enumerates the complete regular-file payload with `os.walk(..., onerror=...)`, rejects symlinks/non-regular files, uses an exclusive per-output lock and unique temporary file, and explicitly excludes the resolved output, lock and temporary names. Re-running with output inside the source tree must not include the previous ZIP.
15. Source-ZIP verification compares the complete entry set and every member's SHA-256 with the current approved payload, in addition to required-entry, CRC, path, executable-mode and recursive binary checks. Missing build files, launcher, application Java, verifier or license archive must fail even when the remaining manifest matches.

## Execution evidence and package boundary

16. The wrapper requires a name and a command, returns the child's real status, creates no success record for an empty invocation, and allocates each log with exclusive `mktemp` creation. Same-second and concurrent same-name runs must all survive independently.
17. Negative tests must prove rejection of empty wrapper invocation, log overwrite, deep nested password/keystore/engine/ELF, traversal-limit overflow, corrupt archives, secret-bearing diagnostic names, unreadable directories, mixed-case jniLibs, missing required source files, output self-inclusion, concurrent output ownership, clean-commit handling and extra/protected source edits.
18. v1/v2/v3, r62 and r67 regression evidence remains required. No failing historical validator is rewritten to obtain a green result.
19. Validation of an already-written source ZIP produces post-package evidence outside that ZIP to avoid self-reference. Those logs are preserved in the recovery/delivery evidence directory. A later intentional repack must be revalidated as a new artifact with a new final hash.
20. Final sizes, SHA-256 values and exit-zero logs are recorded only for actual output files. No PR merge, issue closure, branch deletion, review-thread resolution or remote push is part of round-72.
