#!/usr/bin/env python3
"""Round-72 source gate with an independent pre-round-71 comparison baseline."""
from __future__ import annotations

import argparse
import os
from pathlib import Path
import re
import subprocess
import sys
import xml.etree.ElementTree as ET

from source_archive import protected_license_metadata

DEFAULT_BASE = "f78317919818a02c1fa169a99b85cad6ebf8a1fe"
ROUND72_START = "a245de549b473812aa36f0158f3f8b1a98a4a3e5"
ROOT = Path(__file__).resolve().parents[2]
checks = 0


def check(name: str, condition: bool) -> None:
    global checks
    checks += 1
    if not condition:
        raise AssertionError(name)
    print(f"PASS {checks:02d}: {name}")


def git(*args: str, text: bool = True):
    return subprocess.check_output(["git", *args], cwd=ROOT, text=text)


def git_paths(*args: str) -> set[str]:
    """v1.2.3 round-79 (CodeRabbit PR#60 #25): read NUL-separated raw paths.

    git quotes-and-escapes unusual pathnames in its text output; splitlines()
    keeps the ESCAPED text, so such a path never matched an allowlist and the
    gate mis-rejected a legitimate commit (e.g. a verifier/v11/说明.md added
    inside the allowed prefix). Callers place "-z" at its correct position in
    the argument list; entries are decoded with os.fsdecode, which round-trips
    arbitrary bytes exactly.
    """
    raw = subprocess.check_output(["git", *args], cwd=ROOT)
    return {os.fsdecode(entry) for entry in raw.split(b"\0") if entry}


def manifest_permissions(source: str) -> set[tuple[str, str, str]]:
    """v1.2.3 round-79 (CodeRabbit PR#60 #24): parse the manifest as XML.

    Compares the permission ELEMENTS — both uses-permission and
    uses-permission-sdk-23, with android:maxSdkVersion where present — instead
    of regexing only <uses-permission android:name="...">, which left an added
    sdk-23-only permission element invisible to the comparison (Android
    honors it on API 23+).
    """
    root = ET.fromstring(source)
    android = "{http://schemas.android.com/apk/res/android}"
    found: set[tuple[str, str, str]] = set()
    for tag in ("uses-permission", "uses-permission-sdk-23"):
        for element in root.iter(tag):
            name = element.get(f"{android}name") or element.get("name") or ""
            max_sdk = element.get(f"{android}maxSdkVersion") or element.get("maxSdkVersion")
            found.add((tag, name, "" if max_sdk is None else str(max_sdk)))
    return found


def text(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def base_text(base: str, rel: str) -> str:
    return subprocess.check_output(["git", "show", f"{base}:{rel}"], cwd=ROOT).decode("utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default=os.environ.get("REGALIA_R71_BASE", DEFAULT_BASE),
                        help="pre-change commit; never defaults to current HEAD")
    args = parser.parse_args()
    base = git("rev-parse", "--verify", args.base + "^{commit}").strip()
    current_head = git("rev-parse", "HEAD").strip()
    check("comparison baseline is independent of current HEAD", base != current_head)

    codeql = text(".github/workflows/codeql.yml")
    check("CodeQL c-cpp no-build coverage", bool(re.search(r"- language: c-cpp\s+build-mode: none", codeql)))
    check("CodeQL checkout credentials disabled", "persist-credentials: false" in codeql)
    check("tracked native sources acknowledged", all(s in codeql for s in ("src/main/cpp/engine_jni.cpp", "CMakeLists.txt")))
    check("MobSF scanner pinned", "pip install mobsfscan==1.2.0" in text(".github/workflows/mobsf.yml"))
    dependabot = text(".github/dependabot.yml")
    check("Dependabot ecosystems and schedules", all(s in dependabot for s in (
        "package-ecosystem: gradle", "package-ecosystem: github-actions", "interval: weekly",
        "day: monday", "timezone: Asia/Shanghai", "default-days: 7")))
    mode = git("ls-files", "-s", "gradlew").split()[0]
    check("gradlew executable index mode", mode == "100755")
    pmd = text("config/pmd-ruleset.xml")
    check("project PMD ruleset preserved", "rulesets/java/quickstart.xml" in pmd and '<exclude name="ControlStatementBraces"/>' in pmd)

    build_files = ("build.gradle", "settings.gradle", "gradle.properties", "gradle/wrapper/gradle-wrapper.properties")
    check("unchanged build dependencies and configuration", all(text(rel) == base_text(base, rel) for rel in build_files))
    build = text("build.gradle")
    check("SDK/NDK contract", all(s in build for s in ('compileSdk 35', 'minSdk 23', 'targetSdk 35', 'ndkVersion "27.2.12479018"')))
    version = text("version.properties")
    components = {k: int(v) for k, v in re.findall(r"(?m)^(VERSION_(?:MAJOR|MINOR|PATCH|BUILD))=(\d+)$", version)}
    computed_code = max(components.get("VERSION_BUILD", 0), components.get("VERSION_MAJOR", 0) * 10000 + components.get("VERSION_MINOR", 0) * 100 + components.get("VERSION_PATCH", 0))
    version_name = f"{components.get('VERSION_MAJOR')}.{components.get('VERSION_MINOR')}.{components.get('VERSION_PATCH')}"
    check("version contract", computed_code == 10203 and version_name == "1.2.3")
    check("arm64-only ABI", build.count("abiFilters 'arm64-v8a'") == 1 and "armeabi-v7a" not in re.sub(r"//.*", "", build))
    check("permissions unchanged from fixed base",
          manifest_permissions(text("src/main/AndroidManifest.xml"))
          == manifest_permissions(base_text(base, "src/main/AndroidManifest.xml")))

    ledger = text("src/main/java/com/Regalia/README.license")
    round71 = ledger.split("v1.2.3 round-68", 1)[0]
    agpl = ("ChessApp", "ChessWebViewClient", "EngineService", "MainActivity", "RootDetector", "StabilizationHelper", "TlsSecurityHelper")
    gpl = ("EngineConfigHelper", "EngineHealthMonitor", "EngineProcessManager", "EngineSettingsHelper", "FileIoHelper", "HapticManager", "JsBridgeGateway", "PermissionHelper", "PgnCacheManager", "SafPickerHelper", "StatsActivity", "StockfishNative")
    check("AGPL seven-file ledger", "AGPL v3 (7)" in round71 and all(name in round71 for name in agpl))
    check("GPL twelve-file ledger", "GPL v3 (12)" in round71 and all(name in round71 for name in gpl))
    check("mixed license correction", "java/*.java (15 files, Mixed AGPL v3 and GPL v3; see per-file ledger)" in text("src/main/README.license"))

    license_path = ROOT / "LICENSE&NOTICE.zip"
    check("current protected license archive exists and is nonempty", license_path.is_file() and license_path.stat().st_size > 0)
    try:
        license_size, license_digest = protected_license_metadata(ROOT)
        license_ok = True
    except Exception:
        license_ok = False
    check("current protected license archive bounded scan and CRC; no historical size/hash lock", license_ok)
    print(f"CURRENT_LICENSE bytes={license_size} sha256={license_digest}")

    mobsf = text("src/main/java/.mobsf")
    active = [line for line in mobsf.splitlines() if line.strip() and not line.lstrip().startswith("#")]
    check("MobSF comment-only config and review boundary", not active and all(s in mobsf for s in ("postJsCallbackDirect", "callbackEventName", "already marked statement", "PV moves", "0/259")))
    old_names = ("_clearRestartInProgress", "_createEngineExecutor", "_safeExecute", "_compensateRacedStop", "_resetEngineRuntimeState", "_postJsCallbackDirect", "_callbackEventName", "_isHttpUrl", "_handleUrlOverride", "_applyImmersiveMode", "_applyLegacyImmersive", "_buildNotificationWithContent")
    changed_java = "".join(text(f"src/main/java/com/Regalia/{name}.java") for name in ("StockfishNative", "StatsActivity", "EngineService"))
    check("old Java identifiers absent", not any(re.search(r"(?<![A-Za-z0-9_$])" + re.escape(name) + r"(?![A-Za-z0-9_$])", changed_java) for name in old_names))

    java_diff = git_paths("diff", "--name-only", "-z", base, "--", "src/main/java/com/Regalia")
    java_untracked = git_paths("ls-files", "--others", "--exclude-standard", "-z", "--", "src/main/java/com/Regalia")
    allowed_java = {
        "src/main/java/com/Regalia/StockfishNative.java", "src/main/java/com/Regalia/StatsActivity.java",
        "src/main/java/com/Regalia/EngineService.java", "src/main/java/com/Regalia/README.license",
    }
    check("Java changes are an allowed subset, not an exact working-tree set", (java_diff | java_untracked) <= allowed_java)

    allowed_exact = {
        ".github/workflows/codeql.yml", ".github/workflows/mobsf.yml", ".github/dependabot.yml", ".github/README.license",
        "gradlew", "src/main/README.license", "src/main/java/.mobsf", "src/main/java/com/Regalia/EngineService.java",
        "verifier/v9/round71-acceptance.md",
        "src/main/java/com/Regalia/README.license", "src/main/java/com/Regalia/StatsActivity.java",
        "src/main/java/com/Regalia/StockfishNative.java", "verifier/README.md", "verifier/runs/round70-audit.md",
        "worklog.md", "Manual/README.license", "Manual/Regalia-v1.2.3-manual-en.html", "Manual/Regalia-v1.2.3-manual-zh.html",
        "LICENSE&NOTICE.zip",  # Manual updates are allowed; never restore the old bytes.
    }
    allowed_prefixes = ("verifier/v11/", "verifier/runs/round72", "verifier/runs/recovery-round72", "verifier/runs/v11-", "verifier/runs/2026")
    changed = git_paths("diff", "--name-only", "-z", base)
    untracked = git_paths("ls-files", "--others", "--exclude-standard", "-z")
    all_changed = changed | untracked

    def index_mode(path: str) -> str | None:
        entry = git("ls-files", "-s", "--", path).strip()
        return entry.split()[0] if entry else None

    def tree_mode(revision: str, path: str) -> str | None:
        entry = git("ls-tree", revision, "--", path).strip()
        return entry.split()[0] if entry else None

    def inherited_unchanged(path: str) -> bool:
        try:
            inherited = subprocess.check_output(["git", "show", f"{ROUND72_START}:{path}"], cwd=ROOT)
            if (ROOT / path).read_bytes() != inherited:
                return False
        except (subprocess.CalledProcessError, OSError):
            return False
        # v1.2.3 round-79 (CodeRabbit PR#60 #26): content equality alone let a
        #   mode-only change (100644 -> 100755) pass as "unchanged" — git lists
        #   the path as changed while read_bytes() still equals the blob. The
        #   gate now requires BOTH the content and the index/tree mode to
        #   match the starting commit; unchanged content AND mode still pass.
        return index_mode(path) == tree_mode(ROUND72_START, path)

    out_of_scope = sorted(
        path for path in all_changed
        if path not in allowed_exact and not path.startswith(allowed_prefixes)
        and not inherited_unchanged(path)
    )
    check("no out-of-scope repository changes against fixed base", not out_of_scope)
    check("round-70 audit erratum appended", "round-71 ERRATUM" in text("verifier/runs/round70-audit.md"))
    check("recovery honesty record", "NOT represented as surviving" in text("verifier/runs/recovery-round71.md"))
    check("v9 marked superseded without deleting history", "superseded by v10" in text("verifier/v9/round71-acceptance.md").lower())
    check("round-72 twenty-comment triage exists", (ROOT / "verifier/runs/round72-audit.md").is_file())

    tracked = git_paths("ls-files", "-z")
    forbidden_tracked = [p for p in tracked if p.lower().startswith("src/main/jnilibs/") or p.endswith("libstockfish.so") or p.lower().endswith((".jks", ".keystore")) or p in ("keystore-info.txt", "keystore.properties", "local.properties")]
    check("no engine or signing material tracked", not forbidden_tracked)
    assert checks == 27, checks
    print(f"SOURCE-V11-GATE OK ({checks} checks), fixed_base={base}")


if __name__ == "__main__":
    main()
