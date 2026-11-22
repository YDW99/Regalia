#!/usr/bin/env python3
"""Deterministic negative tests for the round-72 shared verification primitives."""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
import hashlib
import io
import os
from pathlib import Path
import stat
import subprocess
import tempfile
from unittest import mock
import zipfile

import archive_scan
from archive_scan import ArchiveLimits, scan_archive
from secret_scan import SecretScanner
import source_archive
from source_archive import BinaryInspector, forbidden_name, payload_files

ROOT = Path(__file__).resolve().parents[2]
checks = 0


def passed(name: str) -> None:
    global checks
    checks += 1
    print(f"PASS V11-N{checks:02d}: {name}")


def expect_failure(call, forbidden: tuple[str, ...] = ()) -> str:
    try:
        call()
    except (AssertionError, zipfile.BadZipFile, OSError) as exc:
        message = str(exc)
        for value in forbidden:
            if value in message:
                raise AssertionError("sensitive text leaked in a negative-test diagnostic")
        return message
    raise AssertionError("negative fixture was accepted")


def nested_archive(payload_name: str, payload: bytes, depth: int = 5) -> bytes:
    data = payload
    name = payload_name
    for level in range(depth):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr(name, data)
        data = buffer.getvalue()
        name = f"level-{level}.zip"
    return data


def consume_all(chunks, _label: str, _name: str) -> None:
    for _chunk in chunks:
        pass


def test_wrapper() -> None:
    runs = ROOT / "verifier/runs"
    runs.mkdir(parents=True, exist_ok=True)
    before = set(runs.glob("*wrapper-negative*.log"))
    result = subprocess.run(
        ["bash", str(ROOT / "verifier/v11/run-and-log.sh"), "wrapper-negative"],
        cwd=ROOT, text=True, capture_output=True,
    )
    after = set(runs.glob("*wrapper-negative*.log"))
    if result.returncode == 0 or after != before or "usage:" not in result.stderr:
        raise AssertionError("missing command was not rejected without a success log")
    passed("missing command exits nonzero and creates no run record")

    failed = subprocess.run(
        ["bash", str(ROOT / "verifier/v11/run-and-log.sh"), "wrapper-negative", "sh", "-c", "exit 7"],
        cwd=ROOT, text=True, capture_output=True,
    )
    if failed.returncode != 7 or "exit_code=7" not in failed.stdout:
        raise AssertionError("wrapper failed to propagate a child failure")
    passed("child exit code is preserved in output and process status")

    with tempfile.TemporaryDirectory(prefix="v11-clock-") as temporary:
        fake_bin = Path(temporary)
        date = fake_bin / "date"
        date.write_text(
            "#!/bin/sh\ncase \"$2\" in\n"
            "  *%Y%m%d*) printf '20261122T235959Z\\n' ;;\n"
            "  *) printf '2026-11-22T23:59:59Z\\n' ;;\n"
            "esac\n", encoding="utf-8")
        date.chmod(0o755)
        env = dict(os.environ, PATH=str(fake_bin) + os.pathsep + os.environ["PATH"])
        label = f"wrapper-negative-concurrent-{os.getpid()}"

        def invoke(index: int):
            return subprocess.run(
                ["bash", str(ROOT / "verifier/v11/run-and-log.sh"),
                 label, "sh", "-c", f"printf 'run-{index}\\n'; exit {index % 3}"],
                cwd=ROOT, env=env, text=True, capture_output=True,
            )

        with ThreadPoolExecutor(max_workers=8) as executor:
            results = list(executor.map(invoke, range(1, 9)))
        if any(result.returncode != (index % 3) for index, result in enumerate(results, 1)):
            raise AssertionError("concurrent wrapper returned a wrong child status")
        logs = list(runs.glob(f"20261122T235959Z-{label}*.log"))
        if len(logs) != 8 or len({path.name for path in logs}) != 8:
            raise AssertionError("same-second logs were overwritten")
        contents = [path.read_text(encoding="utf-8") for path in logs]
        for index in range(1, 9):
            if sum(f"run-{index}\n" in content for content in contents) != 1:
                raise AssertionError("concurrent wrapper output was lost or duplicated")
    passed("eight same-second concurrent invocations retain eight independent logs")


def test_recursive_secrets() -> None:
    first = "V11-TEST-SENTINEL-ALPHA-7f91"
    second = "V11-TEST-SENTINEL-BETA-26c4"
    with mock.patch.dict(os.environ, {
        "RELEASE_KEYSTORE_PASSWORD": first,
        "RELEASE_KEY_PASSWORD": second,
    }):
        deep = nested_archive(f"member-{first}.txt", b"prefix-" + first.encode() + b"-suffix")
        scanner = SecretScanner()
        message = expect_failure(
            lambda: scanner.archive(io.BytesIO(deep), "opaque.fixture.secret"),
            forbidden=(first, second),
        )
        if "opaque.fixture.secret" not in message:
            raise AssertionError("opaque failure identifier missing")
        passed("five-level nested password is detected without path/member/value leakage")

        for codec in ("utf-16le", "utf-16be"):
            scanner = SecretScanner()
            deep = nested_archive("wide.bin", second.encode(codec))
            expect_failure(lambda: scanner.archive(io.BytesIO(deep), "opaque.fixture.wide"), forbidden=(first, second))
        passed("nested UTF-16LE/BE secret forms fail closed")

        secret_path = Path(ROOT) / f"uncreated-{first}.zip"
        scanner = SecretScanner()
        message = expect_failure(lambda: scanner.file(secret_path, "opaque.fixture.path"), forbidden=(first, second))
        if first in message:
            raise AssertionError("secret-bearing source path leaked")
        passed("file-open diagnostics do not copy secret-bearing paths")


def test_recursive_binaries() -> None:
    engine = b"round72 synthetic engine sentinel" * 17
    keystore = b"round72 synthetic keystore sentinel" * 19
    with mock.patch.object(source_archive, "ENGINE_SHA256", hashlib.sha256(engine).hexdigest()), \
         mock.patch.object(source_archive, "KEYSTORE_SHA256", hashlib.sha256(keystore).hexdigest()):
        for label, payload in (("engine", engine), ("keystore", keystore)):
            inspector = BinaryInspector()
            deep = nested_archive("payload.dat", payload)
            expect_failure(lambda: inspector.archive(io.BytesIO(deep), f"opaque.{label}"))
            passed(f"five-level nested {label} digest is rejected")
    inspector = BinaryInspector()
    deep = nested_archive("payload.bin", b"\x7fELF" + b"\x00" * 31)
    expect_failure(lambda: inspector.archive(io.BytesIO(deep), "opaque.elf"))
    passed("five-level nested ELF magic is rejected")
    inspector = BinaryInspector()
    deep = nested_archive("src/main/jniLibs/README.txt", b"not an ELF and no forbidden suffix")
    expect_failure(lambda: inspector.archive(io.BytesIO(deep), "opaque.jnilibs"))
    passed("nested src/main/jniLibs content is rejected independent of suffix")
    for name in ("src/main/jniLibs/file.dat", "SRC/MAIN/JNILIBS/file.txt", "x/src/main/JniLibs/nested/file"):
        if not forbidden_name(Path(name)):
            raise AssertionError("mixed-case jniLibs policy mismatch")
    passed("mixed-case jniLibs matching uses normalized path components")


def test_archive_limits() -> None:
    deep = nested_archive("payload.txt", b"A" * 64, depth=5)
    expect_failure(lambda: scan_archive(io.BytesIO(deep), consume_all, "opaque.depth",
                                        limits=ArchiveLimits(max_depth=2)))
    passed("archive depth overflow fails closed")
    expect_failure(lambda: scan_archive(io.BytesIO(deep), consume_all, "opaque.member-size",
                                        limits=ArchiveLimits(max_member_bytes=16)))
    passed("member-size limit fails closed")
    expect_failure(lambda: scan_archive(io.BytesIO(deep), consume_all, "opaque.total-size",
                                        limits=ArchiveLimits(max_total_bytes=128)))
    passed("cumulative decompressed-size limit fails closed")
    expect_failure(lambda: scan_archive(io.BytesIO(deep), consume_all, "opaque.members",
                                        limits=ArchiveLimits(max_members=2)))
    passed("archive member-count limit fails closed")

    corrupt = io.BytesIO()
    with zipfile.ZipFile(corrupt, "w") as archive:
        archive.writestr("broken.zip", b"PK-not-a-real-archive")
    corrupt.seek(0)
    expect_failure(lambda: scan_archive(corrupt, consume_all, "opaque.corrupt"))
    passed("corrupt archive-shaped nested member fails closed")


def test_walk_errors() -> None:
    def failing_walk(_root, onerror=None):
        error = PermissionError(13, "simulated unreadable directory")
        if onerror is not None:
            onerror(error)
        return iter(())

    with mock.patch.object(source_archive.os, "walk", failing_walk):
        expect_failure(lambda: payload_files(ROOT))
    passed("directory traversal errors invoke onerror and abort payload enumeration")


def main() -> None:
    test_wrapper()
    test_recursive_secrets()
    test_recursive_binaries()
    test_archive_limits()
    test_walk_errors()
    assert checks == 17, checks
    print(f"V11-NEGATIVE-PRIMITIVES OK: {checks}/{checks}")


if __name__ == "__main__":
    main()
