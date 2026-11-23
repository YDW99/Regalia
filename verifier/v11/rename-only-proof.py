#!/usr/bin/env python3
"""Prove the twelve renames against an explicit pre-round-71 commit."""
from __future__ import annotations

import argparse
import os
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_BASE = "f78317919818a02c1fa169a99b85cad6ebf8a1fe"
RENAMES = {
    "src/main/java/com/Regalia/StockfishNative.java": [
        "_clearRestartInProgress", "_createEngineExecutor", "_safeExecute",
        "_compensateRacedStop", "_resetEngineRuntimeState",
        "_postJsCallbackDirect", "_callbackEventName", "_isHttpUrl",
    ],
    "src/main/java/com/Regalia/StatsActivity.java": [
        "_handleUrlOverride", "_applyImmersiveMode", "_applyLegacyImmersive",
    ],
    "src/main/java/com/Regalia/EngineService.java": [
        "_buildNotificationWithContent",
    ],
}
assert sum(map(len, RENAMES.values())) == 12


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default=os.environ.get("REGALIA_R71_BASE", DEFAULT_BASE))
    args = parser.parse_args()
    base = subprocess.check_output(
        ["git", "rev-parse", "--verify", args.base + "^{commit}"], cwd=ROOT, text=True,
    ).strip()
    current = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    if base == current:
        raise AssertionError("rename baseline must be the pre-change commit, not current HEAD")
    for rel, names in RENAMES.items():
        old = subprocess.check_output(["git", "show", f"{base}:{rel}"], cwd=ROOT).decode("utf-8")
        actual = (ROOT / rel).read_text(encoding="utf-8")
        expected = old
        for name in names:
            # v1.2.3 round-79 (CodeRabbit PR#60 #17): re.subn with a
            #   minimum-hit assertion — if --base points at a commit where one
            #   identifier was already renamed (absent from the baseline),
            #   re.sub silently skipped it and the proof could report
            #   "OK (12 renames)" after verifying only 11. Each name must hit
            #   at least once; the final whole-file comparison is retained.
            expected, hits = re.subn(
                rf"(?<![A-Za-z0-9_$]){re.escape(name)}(?![A-Za-z0-9_$])",
                name[1:], expected,
            )
            if hits < 1:
                raise AssertionError(f"rename baseline lacks identifier '{name}' in {rel}")
        if rel.endswith("/StatsActivity.java"):
            expected = expected.replace("StockfishNative._isHttpUrl", "StockfishNative.isHttpUrl")
        if actual != expected:
            raise AssertionError(f"rename-only mismatch for {rel}")
        if actual == old:
            raise AssertionError(f"renames absent for {rel}")
        print(f"PASS rename-only: {rel}")
    print(f"RENAME-ONLY-V11 OK (12 renames), fixed_base={base}")


if __name__ == "__main__":
    main()
