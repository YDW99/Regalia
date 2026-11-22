# Round-71 environment recovery record

- Original worktree: /tmp/regalia-r71/repo. It disappeared when the sandbox was
  recreated; uncommitted source edits and original run-log files were lost.
- Recovery source: PR #59 upload head f78317919818a02c1fa169a99b85cad6ebf8a1fe,
  cloned afresh and checked against that exact commit. The protected root
  LICENSE&NOTICE.zip is present at exactly 56,011 bytes.
- /mnt/agents/.tmp/tool-results contains persisted command-output excerpts.
  They establish prior observations, but are NOT represented as surviving
  original verifier log files. No old timestamps or successful build are invented.
- v4 acceptance text is recovered verbatim from shell-66-73ef8b91b908c56e.txt.
  v5/v6 scripts and documentation are reconstructed from the persisted review
  specification; v4's known off-by-one wording remains historical.
- The first persistent-filesystem clone encountered checkout/index errors on
  the FUSE mount. The active build tree therefore uses the local build disk;
  verifier records, recovery materials and final artifacts are synchronized to
  persistent storage after each stage.
- Foreground online Gradle build previously exceeded its tool deadline before
  producing an APK; a later background attempt failed at configureCMakeRelease
  because the recovered NDK lacked build/cmake/android.toolchain.cmake. These
  are historical incidents, not final-build evidence. The NDK layout was repaired
  externally without changing project source.
- Every validation executed after this recovery writes a new timestamped command,
  exit code and output record under verifier/runs. Signing passwords are never
  logged or included in any deliverable.
