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


def _code_only(source: str) -> str:
    """v1.2.3 round-80 (CodeRabbit PR#60 re-review): reduce Java source to its
    code shape — // and /* */ comments plus string/char literals removed — so
    identifiers can be counted where they are CODE, not prose. (A single-pass
    scanner; these files use no text blocks.)"""
    out = []
    i, n = 0, len(source)
    while i < n:
        ch = source[i]
        if ch == "/" and source[i:i + 2] == "//":
            nl = source.find("\n", i)
            if nl < 0:
                break
            i = nl
            continue
        if ch == "/" and source[i:i + 2] == "/*":
            end = source.find("*/", i + 2)
            i = n if end < 0 else end + 2
            continue
        if ch == '"':
            j = i + 1
            while j < n:
                if source[j] == "\\":
                    j += 2
                    continue
                if source[j] == '"':
                    break
                j += 1
            i = j + 1
            continue
        if ch == "'":
            j = i + 1
            while j < n:
                if source[j] == "\\":
                    j += 2
                    continue
                if source[j] == "'":
                    break
                j += 1
            i = j + 1
            continue
        out.append(ch)
        i += 1
    return "".join(out)


def _method_declarations(name: str, code_only_source: str) -> int:
    """v1.2.3 round-80 (CodeRabbit PR#60 re-review): count Java method
    DECLARATION sites of `name` in comment/string-free source. A declaration
    is `TYPE name(params) {` — `return name(...)` calls and comment mentions do
    not match (no body brace follows), and a cast `(Type) name(` does not
    match either (the paren breaks the TYPE-whitespace-name shape). Only an
    actual declaration of the old name proves the baseline still carries the
    rename's subject."""
    return len(re.findall(
        rf"(?<![A-Za-z0-9_$])[A-Za-z_][\w<>\[\],.]*\s+{re.escape(name)}\s*\([^(){{}}]*\)\s*\{{",
        code_only_source))


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
        # v1.2.3 round-80 (CodeRabbit PR#60 re-review): the baseline must still
        #   carry a method DECLARATION for every renamed identifier — re.subn
        #   counts every lexical hit, so a baseline whose declaration was
        #   already renamed but whose comments still mention the identifier
        #   satisfied the round-79 hits>=1 check without proving anything (and
        #   when the current file updated the same comment, the whole-file
        #   comparison passed as well). The declaration check is lexical
        #   (comments/strings stripped); the subn transform and whole-file
        #   comparison are retained unchanged below.
        old_code_only = _code_only(old)
        for name in names:
            if _method_declarations(name, old_code_only) < 1:
                raise AssertionError(f"rename baseline lacks a method declaration for '{name}' in {rel}")
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
