#!/usr/bin/env python3
"""Isolated integration tests for round-72 source archives and Git baselines."""
from __future__ import annotations

import contextlib
import io
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import zipfile

from source_archive import pack, payload_files, verify

ROOT = Path(__file__).resolve().parents[2]
PREFIX = "Regalia-v1.2.3-round72/"
checks = 0


def passed(name: str) -> None:
    global checks
    checks += 1
    print(f"PASS V11-I{checks:02d}: {name}")


def quiet(call):
    output = io.StringIO()
    with contextlib.redirect_stdout(output):
        result = call()
    return result, output.getvalue()


def expect_assertion(call, marker: str | None = None) -> str:
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            call()
    except AssertionError as exc:
        message = str(exc)
        if marker is not None and marker not in message:
            raise AssertionError(f"expected failure marker absent: {marker}; actual={message}")
        return message
    raise AssertionError("integration negative fixture was accepted")


def copy_payload(destination: Path) -> None:
    for source in payload_files(ROOT):
        relative = source.relative_to(ROOT)
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)


def pruned_archive(source: Path, destination: Path, remove: str) -> None:
    with zipfile.ZipFile(source) as original, zipfile.ZipFile(destination, "w") as rewritten:
        for info in original.infolist():
            if info.filename != PREFIX + remove:
                rewritten.writestr(info, original.read(info.filename))


def run_source_gate(root: Path) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["python3", str(root / "verifier/v11/source-gate.py")],
        cwd=root, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
    )


def test_archives() -> None:
    with tempfile.TemporaryDirectory(prefix="v11-archive-integration-") as temporary:
        base = Path(temporary)
        source = base / "source"
        source.mkdir()
        copy_payload(source)
        baseline_zip = base / "baseline.zip"
        quiet(lambda: pack(source, baseline_zip))
        _, output = quiet(lambda: verify(source, baseline_zip))
        if "manifest_exact=true" not in output or "SOURCE-ZIP-V11-GATE OK" not in output:
            raise AssertionError("baseline complete archive did not pass")
        passed("complete current source payload packs and verifies")

        unexpected_zip = base / "unexpected.zip"
        shutil.copyfile(baseline_zip, unexpected_zip)
        with zipfile.ZipFile(unexpected_zip, "a") as archive:
            archive.writestr(PREFIX + "unexpected.txt", b"unexpected")
        expect_assertion(lambda: verify(source, unexpected_zip), "complete source manifest mismatch")
        passed("unexpected archive member is rejected by exact manifest comparison")

        missing_zip = base / "missing.zip"
        pruned_archive(baseline_zip, missing_zip, "build.gradle")
        expect_assertion(lambda: verify(source, missing_zip), "complete source manifest mismatch")
        passed("missing archive member is rejected by exact manifest comparison")

        changed_zip = base / "changed.zip"
        pruned_archive(baseline_zip, changed_zip, "build.gradle")
        with zipfile.ZipFile(changed_zip, "a") as archive:
            archive.writestr(PREFIX + "build.gradle", b"changed content\n")
        expect_assertion(lambda: verify(source, changed_zip), "source content digest mismatch")
        passed("same-name modified content is rejected by per-member SHA-256")

        for relative in (
            "build.gradle", "gradlew", "src/main/java/com/Regalia/MainActivity.java",
            "verifier/v11/secret_scan.py",
        ):
            original_bytes = (source / relative).read_bytes()
            original_mode = (source / relative).stat().st_mode
            case_zip = base / ("required-" + relative.replace("/", "_") + ".zip")
            pruned_archive(baseline_zip, case_zip, relative)
            (source / relative).unlink()
            try:
                expect_assertion(lambda: verify(source, case_zip), "missing required source entries")
            finally:
                (source / relative).write_bytes(original_bytes)
                (source / relative).chmod(original_mode)
            passed(f"required-entry gate rejects removal of {relative}")

        original_license = (source / "LICENSE&NOTICE.zip").read_bytes()
        updated_license = base / "manual-license-update.zip"
        with zipfile.ZipFile(updated_license, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("LICENSE&NOTICE/MANUAL-UPDATE.txt",
                             "Maintainer update: different bytes and a different size.\n" * 7)
        (source / "LICENSE&NOTICE.zip").write_bytes(updated_license.read_bytes())
        updated_source_zip = base / "manual-license-source.zip"
        quiet(lambda: pack(source, updated_source_zip))
        _, update_output = quiet(lambda: verify(source, updated_source_zip))
        if "current_byte_identical=true" not in update_output:
            raise AssertionError("manual license update was not accepted as current bytes")
        passed("valid manually updated license archive passes without historical size/hash lock")
        (source / "LICENSE&NOTICE.zip").write_bytes(original_license)

        self_zip = source / "verifier/runs/round72-selftest-source.zip"
        quiet(lambda: pack(source, self_zip))
        quiet(lambda: pack(source, self_zip))
        quiet(lambda: verify(source, self_zip))
        with zipfile.ZipFile(self_zip) as archive:
            names = archive.namelist()
        forbidden_output_members = [name for name in names if name.endswith("round72-selftest-source.zip") or ".tmp-" in name or name.endswith(".lock")]
        if forbidden_output_members:
            raise AssertionError("source archive contains its previous output or temporary file")
        passed("in-tree repack excludes previous ZIP, lock and temporary artifacts")

        locked_output = base / "locked.zip"
        locked_output.write_bytes(b"preexisting approved bytes")
        lock = base / "locked.zip.lock"
        lock.write_text("owned by another test process", encoding="utf-8")
        expect_assertion(lambda: pack(source, locked_output), "output lock")
        if locked_output.read_bytes() != b"preexisting approved bytes" or not lock.is_file():
            raise AssertionError("contended output or another owner's lock was modified")
        passed("preexisting output lock fails closed without touching output or owner lock")


def test_git_baseline() -> None:
    with tempfile.TemporaryDirectory(prefix="v11-git-integration-") as temporary:
        worktree = Path(temporary) / "worktree"
        subprocess.run(["git", "worktree", "add", "--detach", str(worktree), "HEAD"],
                       cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
        try:
            clean = run_source_gate(worktree)
            if clean.returncode != 0 or "SOURCE-V11-GATE OK (27 checks)" not in clean.stdout:
                raise AssertionError("clean committed checkout failed fixed-base source gate")
            passed("clean committed checkout passes with a base independent of HEAD")

            main_activity = worktree / "src/main/java/com/Regalia/MainActivity.java"
            original = main_activity.read_bytes()
            main_activity.write_bytes(original + b"\n// unapproved integration-test edit\n")
            changed = run_source_gate(worktree)
            if changed.returncode == 0 or "Java changes are an allowed subset" not in changed.stdout:
                raise AssertionError("uncommitted extra Java edit was accepted")
            subprocess.run(["git", "add", "src/main/java/com/Regalia/MainActivity.java"], cwd=worktree, check=True)
            subprocess.run(["git", "-c", "user.name=V11 Negative Test", "-c", "user.email=negative@localhost",
                            "commit", "-m", "negative test committed extra edit"],
                           cwd=worktree, check=True, stdout=subprocess.DEVNULL)
            committed = run_source_gate(worktree)
            if committed.returncode == 0 or "Java changes are an allowed subset" not in committed.stdout:
                raise AssertionError("committed extra Java edit was accepted")
            passed("uncommitted and committed out-of-scope Java edits both fail")
            subprocess.run(["git", "reset", "--hard", "HEAD~1"], cwd=worktree, check=True, stdout=subprocess.DEVNULL)

            build = worktree / "build.gradle"
            original_build = build.read_bytes()
            build.write_bytes(original_build + b"\n// protected configuration negative test\n")
            protected = run_source_gate(worktree)
            if protected.returncode == 0 or "unchanged build dependencies and configuration" not in protected.stdout:
                raise AssertionError("protected build configuration edit was accepted")
            passed("protected build configuration edit fails against fixed base")
            build.write_bytes(original_build)

            license_path = worktree / "LICENSE&NOTICE.zip"
            original_license = license_path.read_bytes()
            with zipfile.ZipFile(license_path, "w") as archive:
                archive.writestr("LICENSE&NOTICE/NEW.txt", "new maintainer bytes\n" * 11)
            updated = run_source_gate(worktree)
            if updated.returncode != 0 or "CURRENT_LICENSE" not in updated.stdout:
                raise AssertionError("valid manual license update triggered a rollback-style failure")
            passed("manual license update is accepted without comparing historical hash")
            license_path.write_bytes(original_license)
        finally:
            subprocess.run(["git", "worktree", "remove", "--force", str(worktree)],
                           cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def main() -> None:
    test_archives()
    test_git_baseline()
    assert checks == 15, checks
    print(f"V11-INTEGRATION OK: {checks}/{checks}")


if __name__ == "__main__":
    main()
