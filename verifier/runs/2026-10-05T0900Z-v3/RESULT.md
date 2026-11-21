# RESULT — runs/2026-10-05T0900Z-v3 (round-55, post license-audit)

- Scope: full license-classification audit on top of the PR #56 CodeRabbit
  triage — every location that records open-source license classification
  re-checked against file-header ground truth; 12 residual live mislabels
  corrected (StatsActivity ×5, HapticManager ×1, StabilizationHelper ×1
  [reverse GPL→AGPL], index.html.tpl ×1, plus ledger/tag sweep fallout).
- v3: 37/37 PASS (repo-root run) — see v3-run.log
  (34 → 37: added H2c NOTICE live-tag sweep, H2d ledger AGPL sweep,
  H2e README.md round-55 section + classification lists)
- v3: 37/37 PASS (foreign cwd /tmp) — see v3-foreign-cwd.log
- v1 regression: 29/29 PASS — v1-run.log
- v2 regression: 19/19 PASS — v2-run.log
- compileReleaseJavaWithJavac: BUILD SUCCESSFUL, 0 errors — compile.log
  (SDK rebuilt at /tmp/sdk: platforms;android-35 + build-tools;35.0.0)
- chess.html: unchanged since round-55 rebuild (24,364 lines,
  md5 39c0e4c9cd4eac03711ab734078aa4e0, bundle node --check OK)
- Version unchanged: versionCode=10203, versionName="1.2.3"
