# Regalia v1.2.3 Round 77 acceptance

Created: 2026-11-23. This version supplements v11; it does not rewrite historical results.

## Scope

1. Restore the reviewed Round-76 CI metadata and `gradlew` index mode after the remote auto-unzip regression.
2. Fix BUG-01 and BUG-02 with one small API-23-compatible atomic UTF-8 file writer shared by eval JSON, PGN and tags.
3. Fix ROB-01: propagate synchronous SharedPreferences commit results and retain the JS dirty flag when no durable backend succeeds.
4. Fix BUG-03: use a per-process temporary file for concurrent `build-chess.py` runs.
5. Rebuild and sign a new Release APK because application code and the generated web bundle change. Deliver a complete engine-free source ZIP.

Explicitly out of scope: engine lifecycle/UI rewrites, dependency/SDK/NDK/AGP upgrades, new permissions, profiling-free performance changes, remote push/merge/issue operations, and physical-device claims.

## Acceptance criteria

A01. The authoritative starting point is remote `upload@6fe34dde16767b6b31fa2f8f1a6d3ab5e6f907b6`; only the verified Round-76 metadata overlay precedes Round-77 edits.
A02. `LICENSE&NOTICE.zip` remains the current remote bytes, is nonempty, passes bounded recursive checks/CRC, and is never restored from an older archive.
A03. `AtomicFileStore.writeUtf8` writes a unique same-directory temporary file, flushes and syncs it, then uses `android.system.Os.rename`; it contains no delete-before-replace or API-26-only `java.nio.file` fallback.
A04. Actual production `AtomicFileStore.java`, compiled with host-only Android API stubs, passes new-file, overwrite, Unicode and injected rename-failure tests. Failure preserves the old bytes and leaves no temporary file.
A05. `saveEvalCacheSync`, `PgnCacheManager.save` and both nonempty/empty-fallback `setTags` writes use the shared writer. Existing public cache entry points and LRU behavior remain.
A06. `persistentSetSync` returns `editor.commit()` and returns false on null key or failure. The JS persistence harness proves: file success clears dirty; legacy synchronous success clears dirty after file failure; localStorage-only success does not; all-backend failure retains dirty and a later flush retries; forced clear failure also retains dirty.
A07. Forty pairs of concurrent web builds all exit 0, produce identical `chess.html`, and leave no temporary files. Two sequential builds are deterministic. All modified JS and the generated inline scripts pass syntax checks.
A08. Existing v1/v2/v3, r62, r67 and v11 primitive-negative checks pass. The new v13 source gate passes; v11 integration is run at the restored baseline, while final integration uses the v13 archive contract.
A09. Version remains `10203` / `1.2.3`; minSdk 23, target/compile SDK 35, arm64-v8a only, existing permissions exactly unchanged, no new dependency, and Release is not debuggable.
A10. The final APK embeds the current source `chess.html`, the exact Stockfish 19 binary and exactly the three expected arm64 native libraries. `apksigner` reports v1=true, v2=true, v3=true, one signer and certificate SHA-256 `45bc6d36c9fcff8ef9e55f510b43bce44cb854ea4b2f235a0f4955da05a8d8bc`; v2/v3 Signing Block structures are present and valid.
A11. HyperOS 3 acceptance is static compatibility only (SDK/ABI/Manifest/Release/signature); no physical installation or runtime test is claimed.
A12. The final source ZIP has a Round-77 root prefix, complete manifest/digest equality, safe unique paths, CRC success, `gradlew` mode 0755, current license archive, all verifier versions and honest run records. It excludes `.git`, build/cache/IDE files, `src/main/jniLibs`, engines/ELF, APK/AAB/idsig, keystores/signing properties and local secrets, including recursively nested content.
A13. Secret scanning directly covers the final APK and source ZIP without printing passwords; password matches must be zero. Post-package evidence stays outside the verified ZIP.
A14. Every verifier execution appends a timestamped command/exit/result record under `verifier/runs/`; failures are retained. Final delivery files receive new Round-77 names and are never silently overwritten.
