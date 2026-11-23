#!/usr/bin/env python3
"""Round-77 source gate using a direct, fixed external comparison tree."""
from __future__ import annotations

import argparse
import hashlib
import os
from pathlib import Path
import re
import subprocess

from source_archive import protected_license_metadata

ROOT = Path(__file__).resolve().parents[2]
EXPECTED_BASE_TREE_SHA256 = "be6778e492a799129fc4c36f603de80f7b69fda23749e6d33456f7f632e6a4c5"
EXPECTED_LICENSE_SHA256 = "d4bd3cd4752421aac192475bda7bdb5042964b5eec3102c836265c25f666595b"
checks = 0


def check(name: str, condition: bool) -> None:
    global checks
    checks += 1
    if not condition:
        raise AssertionError(name)
    print(f"PASS {checks:02d}: {name}")


def git(*args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True)


def text(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def snapshot(root: Path, current: bool = False) -> dict[str, str]:
    result: dict[str, str] = {}
    generated = (".git/", ".gradle/", "build/", "app/build/", ".cxx/", "src/main/jniLibs/")
    for path in sorted(root.rglob("*")):
        if path.is_symlink():
            raise AssertionError(f"unexpected symlink in source tree: {path}")
        if not path.is_file():
            continue
        rel = path.relative_to(root).as_posix()
        if current and rel.startswith(generated):
            continue
        result[rel] = hashlib.sha256(path.read_bytes()).hexdigest()
    return result


def tree_digest(files: dict[str, str], root: Path) -> str:
    digest = hashlib.sha256()
    for rel in sorted(files, key=Path):
        payload = (root / rel).read_bytes()
        digest.update(rel.encode("utf-8"))
        digest.update(b"\0")
        digest.update(len(payload).to_bytes(8, "big"))
        digest.update(payload)
        digest.update(b"\0")
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default=os.environ.get("REGALIA_R77_BASE"),
                        help="fixed external f783179 source tree; never the current HEAD")
    args = parser.parse_args()
    if not args.base:
        raise SystemExit("REGALIA_R77_BASE or --base is required")
    base = Path(args.base).resolve()
    check("comparison baseline is an external directory", base.is_dir() and base != ROOT.resolve())
    base_files = snapshot(base)
    base_digest = tree_digest(base_files, base)
    print(f"FIXED_BASE files={len(base_files)} tree_sha256={base_digest}")
    check("fixed baseline complete-tree digest", base_digest == EXPECTED_BASE_TREE_SHA256)
    current_files = snapshot(ROOT, current=True)
    all_changed = {rel for rel in base_files.keys() | current_files.keys()
                   if base_files.get(rel) != current_files.get(rel)}

    def base_text(rel: str) -> str:
        return (base / rel).read_text(encoding="utf-8")

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
    check("unchanged build dependencies and configuration", all(text(rel) == base_text(rel) for rel in build_files))
    build = text("build.gradle")
    check("SDK/NDK contract", all(s in build for s in ('compileSdk 35', 'minSdk 23', 'targetSdk 35', 'ndkVersion "27.2.12479018"')))
    version = text("version.properties")
    components = {k: int(v) for k, v in re.findall(r"(?m)^(VERSION_(?:MAJOR|MINOR|PATCH|BUILD))=(\d+)$", version)}
    computed_code = max(components.get("VERSION_BUILD", 0), components.get("VERSION_MAJOR", 0) * 10000 + components.get("VERSION_MINOR", 0) * 100 + components.get("VERSION_PATCH", 0))
    version_name = f"{components.get('VERSION_MAJOR')}.{components.get('VERSION_MINOR')}.{components.get('VERSION_PATCH')}"
    check("version contract", computed_code == 10203 and version_name == "1.2.3")
    check("arm64-only ABI", build.count("abiFilters 'arm64-v8a'") == 1 and "armeabi-v7a" not in re.sub(r"//.*", "", build))
    permission_re = re.compile(r'<uses-permission\s+android:name="([^"]+)"')
    check("permissions unchanged from fixed base", permission_re.findall(text("src/main/AndroidManifest.xml")) == permission_re.findall(base_text("src/main/AndroidManifest.xml")))

    ledger = text("src/main/java/com/Regalia/README.license")
    round77 = ledger.split("v1.2.3 round-71", 1)[0]
    agpl = ("ChessApp", "ChessWebViewClient", "EngineService", "MainActivity", "RootDetector", "StabilizationHelper", "TlsSecurityHelper")
    gpl = ("AtomicFileStore", "EngineConfigHelper", "EngineHealthMonitor", "EngineProcessManager", "EngineSettingsHelper", "FileIoHelper", "HapticManager", "JsBridgeGateway", "PermissionHelper", "PgnCacheManager", "SafPickerHelper", "StatsActivity", "StockfishNative")
    check("Round-77 AGPL seven-file ledger", "AGPL v3 (7)" in round77 and all(name in round77 for name in agpl))
    check("Round-77 GPL thirteen-file ledger", "GPL v3 (13)" in round77 and all(name in round77 for name in gpl))
    check("Round-71 historical license counts retained", "GPL v3 (12)" in ledger and "java/*.java (15 files" in text("src/main/README.license"))
    check("mixed license count updated", "java/*.java (16 files, Mixed AGPL v3 and GPL v3; see per-file ledger)" in text("src/main/README.license"))

    license_path = ROOT / "LICENSE&NOTICE.zip"
    check("current protected license archive exists and is nonempty", license_path.is_file() and license_path.stat().st_size > 0)
    try:
        license_size, license_digest = protected_license_metadata(ROOT)
        license_ok = license_digest == EXPECTED_LICENSE_SHA256
    except Exception:
        license_size, license_digest, license_ok = 0, "unavailable", False
    check("current remote license archive bounded scan, CRC and identity", license_ok)
    print(f"CURRENT_LICENSE bytes={license_size} sha256={license_digest}")

    mobsf = text("src/main/java/.mobsf")
    active = [line for line in mobsf.splitlines() if line.strip() and not line.lstrip().startswith("#")]
    check("MobSF comment-only config and review boundary", not active and all(s in mobsf for s in ("postJsCallbackDirect", "callbackEventName", "already marked statement", "PV moves", "0/259")))
    old_names = ("_clearRestartInProgress", "_createEngineExecutor", "_safeExecute", "_compensateRacedStop", "_resetEngineRuntimeState", "_postJsCallbackDirect", "_callbackEventName", "_isHttpUrl", "_handleUrlOverride", "_applyImmersiveMode", "_applyLegacyImmersive", "_buildNotificationWithContent")
    changed_java = "".join(text(f"src/main/java/com/Regalia/{name}.java") for name in ("StockfishNative", "StatsActivity", "EngineService"))
    check("old Java identifiers absent", not any(re.search(r"(?<![A-Za-z0-9_$])" + re.escape(name) + r"(?![A-Za-z0-9_$])", changed_java) for name in old_names))

    java_changed = {rel for rel in all_changed if rel.startswith("src/main/java/com/Regalia/")}
    allowed_java = {
        "src/main/java/com/Regalia/AtomicFileStore.java",
        "src/main/java/com/Regalia/StockfishNative.java",
        "src/main/java/com/Regalia/PgnCacheManager.java",
        "src/main/java/com/Regalia/StatsActivity.java",
        "src/main/java/com/Regalia/EngineService.java",
        "src/main/java/com/Regalia/README.license",
    }
    check("Java changes are an allowed subset", java_changed <= allowed_java)

    allowed_exact = {
        ".github/workflows/codeql.yml", ".github/workflows/mobsf.yml", ".github/dependabot.yml", ".github/README.license",
        "gradlew", "build-chess.py", "src/main/README.license", "src/main/java/.mobsf",
        "src/main/java/com/Regalia/AtomicFileStore.java", "src/main/java/com/Regalia/EngineService.java",
        "src/main/java/com/Regalia/PgnCacheManager.java", "src/main/java/com/Regalia/README.license",
        "src/main/java/com/Regalia/StatsActivity.java", "src/main/java/com/Regalia/StockfishNative.java",
        "src/main/assets/chess.html", "src/main/assets/chess.src/ai-bridge.js",
        "verifier/README.md", "verifier/runs/round70-audit.md", "worklog.md",
        "Manual/README.license", "Manual/Regalia-v1.2.3-manual-en.html", "Manual/Regalia-v1.2.3-manual-zh.html",
        "LICENSE&NOTICE.zip",
    }
    allowed_prefixes = ("verifier/v4/", "verifier/v5/", "verifier/v6/", "verifier/v7/", "verifier/v8/",
                        "verifier/v9/", "verifier/v10/", "verifier/v11/", "verifier/v13/", "verifier/runs/")
    out_of_scope = sorted(rel for rel in all_changed
                          if rel not in allowed_exact and not rel.startswith(allowed_prefixes))
    if out_of_scope:
        print("OUT_OF_SCOPE " + "\nOUT_OF_SCOPE ".join(out_of_scope))
    check("no out-of-scope repository changes against fixed base", not out_of_scope)
    check("round-70 audit erratum appended", "round-71 ERRATUM" in text("verifier/runs/round70-audit.md"))
    check("round-71 recovery honesty record", "NOT represented as surviving" in text("verifier/runs/recovery-round71.md"))
    check("round-77 recovery honesty record", "NOT represented as surviving" in text("verifier/runs/recovery-round77.md"))
    check("v9 marked superseded without deleting history", "superseded by v10" in text("verifier/v9/round71-acceptance.md").lower())
    check("round-72 twenty-comment triage exists", (ROOT / "verifier/runs/round72-audit.md").is_file())

    tracked = git("ls-files").splitlines()
    forbidden_tracked = [p for p in tracked if p.lower().startswith("src/main/jnilibs/") or p.endswith("libstockfish.so") or p.lower().endswith((".jks", ".keystore")) or p in ("keystore-info.txt", "keystore.properties", "local.properties")]
    check("no engine or signing material tracked", not forbidden_tracked)
    engine = ROOT / "src/main/jniLibs/arm64-v8a/libstockfish.so"
    if engine.exists():
        engine_rel = "src/main/jniLibs/arm64-v8a/libstockfish.so"
        untracked = engine_rel not in tracked
        ignored = subprocess.run(["git", "check-ignore", "-q", engine_rel], cwd=ROOT).returncode == 0
        engine_ok = untracked and ignored
    else:
        engine_ok = True
    check("local engine input is absent or untracked and ignored", engine_ok)
    assert checks == 31, checks
    print(f"SOURCE-V13-GATE OK ({checks} checks), fixed_base={base}")


if __name__ == "__main__":
    main()
