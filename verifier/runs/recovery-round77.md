# Round 77 recovery and evidence continuity

## Initial recovery

- Authoritative remote snapshot: `upload@6fe34dde16767b6b31fa2f8f1a6d3ab5e6f907b6`.
- Fixed comparison tree: `f78317919818a02c1fa169a99b85cad6ebf8a1fe`.
- Reviewed Round-76 metadata overlay restored Dependabot, CodeQL C/C++ no-build coverage with checkout credentials disabled, MobSF 1.2.0 pinning and `gradlew` mode 100755.
- The current remote `LICENSE&NOTICE.zip` was retained; no historical license archive was substituted.

## Sandbox loss during NDK validation

The first temporary Round-77 worktree and its in-tree run logs were destroyed by an environment reset while the official NDK archive was being checked. Those temporary logs are **NOT represented as surviving**. Earlier observed results remain historical context only; every required product regression and final artifact gate is rerun in this reconstructed tree.

Git Git-transport negotiation then failed before ref listing. Recovery therefore used CRC-valid codeload archives for the two exact commit IDs above. The reconstructed local Git commits are explicitly labeled local snapshots and do not impersonate upstream hashes. The fixed comparison tree is stored outside the deliverable and checked directly by the v13 source gate. GitHub read-only commit lookup independently confirmed both requested commit IDs and their messages/authors; no remote write operation occurred.

A persistent tarball of the reconstructed Round-76 baseline was saved outside the repository before product edits. Subsequent source, build and final-artifact evidence is also copied outside the temporary tree. No password, keystore or signing environment is included in recovery snapshots or delivery archives.

## Continuation and historical-baseline repair

Git transport remained unavailable during the continuation, so the exact Round-72 `cc05bb67bca70b495a053af4cf87eb1572d2a445` tree was obtained through a CRC-checked codeload archive and committed only as a clearly labeled local recovery snapshot. Its original v11 integration initially failed closed because the archive-channel tree lacked `.github/dependabot.yml`; subsequent diagnosis also found the reviewed CodeQL/MobSF overlay absent. Only those reviewed metadata files were restored. The unmodified v11 source gate then passed 27/27 and the unmodified v11 integration passed 15/15. All failed attempts remain in the Round-77 run records.

The installed NDK r27c lacked its whole `build/` directory. The official archive matched the expected byte count and SHA-256 before repair. Its 102 build-directory members contain 88 regular files and no symlinks; each file was read with ZIP CRC checking and restored without replacing an existing target. The mount rejected a directory-level rename with EXDEV, so the repair used direct creation of a previously absent target instead of claiming an atomic directory replacement. NDK revision, clang execution, CMake toolchain, build-file count and correct aarch64 runtime path were independently checked. The separately running full-archive CRC result is retained in its own runner log.

## Final build and persistent-storage readback

The detached official NDK check later completed normally with exit code 0: full CRC, 9,277 members, expected identity, revision, toolchain and aarch64 runtime path all passed. The signed `assembleRelease` runner also completed with exit code 0 and BUILD SUCCESSFUL. The actual build output passed the complete v13 APK gate.

The persistent FUSE mount then returned EIO when reading the newly published APK. The same EIO was reproduced on historical APK deliverables, while an existing source ZIP and the official NDK ZIP remained readable; this was not treated as evidence of APK corruption. Failed direct-path verification remains in `verifier/runs/`. The deliverable inode was renamed to a non-APK readback alias without copying its bytes, passed the complete v13 APK gate there with the same SHA-256 as the build output, and was renamed back to the final APK name with device/inode/size identity preserved. No password, keystore or signing environment was written to these records.
