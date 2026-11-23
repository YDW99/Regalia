#!/usr/bin/env python3
"""Create or verify the engine-free Round-77 source archive.

The archive is compared against the complete expected payload, not a small
required-file allowlist. Nested archives are recursively inspected. The current
LICENSE&NOTICE.zip is protected by validity and current-byte equality checks,
never by a historical fixed size or hash.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import os
from pathlib import Path, PurePosixPath
import stat
import tempfile
import zipfile

from archive_scan import ArchiveLimits, Budget, safe_member_name, scan_archive

PREFIX = "Regalia-v1.2.3-round77/"
ENGINE_SHA256 = "ffd8fc2004d3d19f9fdab95d84c92709aea92e8d3af405eda0b281b23cf1daf8"
KEYSTORE_SHA256 = "6a44f6607f4ed90fa6f4c52bedb8626d22ef285ba4127b68dd26975aaa522ccc"
BUNDLE_SHA256 = "ae15d2b699624e549745582b5835d35418ff77b51a08ae704915a0d643e6c9e0"
EXCLUDED_DIRS = {".git", ".gradle", ".cxx", "build", ".idea", "__pycache__", "node_modules"}
EXCLUDED_FILES = {"local.properties", "keystore.properties", "keystore-info.txt", "regalia-signing.env"}
FORBIDDEN_SUFFIXES = (".jks", ".keystore", ".p12", ".pfx", ".apk", ".aab", ".idsig", ".so")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _walk_error(error: OSError) -> None:
    raise error


def _is_jnilibs(parts: list[str]) -> bool:
    return any(tuple(parts[index:index + 3]) == ("src", "main", "jnilibs")
               for index in range(max(0, len(parts) - 2)))


def forbidden_name(path: PurePosixPath) -> bool:
    lower_parts = [part.lower() for part in path.parts]
    if not lower_parts:
        return True
    name = lower_parts[-1]
    if any(part in EXCLUDED_DIRS for part in lower_parts[:-1]):
        return True
    if _is_jnilibs(lower_parts):
        return True
    if name in EXCLUDED_FILES or name.endswith(FORBIDDEN_SUFFIXES):
        return True
    if name == "stockfish":
        return True
    if "stockfish" in name and name.endswith((".tar", ".tar.gz", ".tgz", ".zip", ".7z", ".xz")):
        return True
    return False


def _is_output_artifact(path: Path, root: Path, output: Path | None) -> bool:
    if output is None:
        return False
    output = output.resolve()
    resolved = path.resolve()
    if resolved == output or resolved == output.with_name(output.name + ".lock"):
        return True
    return (resolved.parent == output.parent and
            (path.name.startswith(output.name + ".tmp-") or path.name == output.name + ".lock"))


def payload_files(root: Path, output: Path | None = None) -> list[Path]:
    """Return the complete regular-file payload; directory read errors abort."""
    root = root.resolve()
    files: list[Path] = []
    for directory, dirnames, filenames in os.walk(root, onerror=_walk_error):
        current = Path(directory)
        kept = []
        for dirname in sorted(dirnames):
            candidate = current / dirname
            rel = candidate.relative_to(root)
            if dirname in EXCLUDED_DIRS or rel.as_posix().lower() == "src/main/jnilibs":
                continue
            if candidate.is_symlink():
                raise AssertionError("symlink directory outside payload contract")
            kept.append(dirname)
        dirnames[:] = kept
        for filename in sorted(filenames):
            path = current / filename
            rel = path.relative_to(root)
            if path.is_symlink() or not path.is_file():
                raise AssertionError("non-regular payload file")
            if _is_output_artifact(path, root, output):
                continue
            if forbidden_name(PurePosixPath(rel.as_posix())):
                continue
            files.append(path)
    return sorted(files, key=lambda path: path.relative_to(root).as_posix())


def is_archive_payload(path: Path, label: str) -> bool:
    """Detect ZIP content regardless of suffix; archive-shaped files fail closed."""
    try:
        with path.open("rb") as stream:
            detected = zipfile.is_zipfile(stream)
    except Exception:
        raise AssertionError(f"archive detection failed at {label}") from None
    return detected or path.suffix.lower() in (".zip", ".jar")


class BinaryInspector:
    """Reject signing material, engines, ELF and unsafe names at every depth."""

    def __init__(self) -> None:
        self.files = 0
        self.members = 0

    def consume(self, chunks, label: str, member_name: str | None = None) -> None:
        digest = hashlib.sha256()
        first = b""
        size = 0
        for chunk in chunks:
            if not first:
                first = chunk[:4]
            digest.update(chunk)
            size += len(chunk)
        if member_name is not None:
            self.members += 1
            path = PurePosixPath(member_name)
            if not safe_member_name(member_name) or forbidden_name(path):
                raise AssertionError(f"forbidden nested archive member at {label}")
        else:
            self.files += 1
        if first == b"\x7fELF":
            raise AssertionError(f"ELF content detected at {label}")
        value = digest.hexdigest()
        if value == ENGINE_SHA256:
            raise AssertionError(f"engine content detected at {label}")
        if value == KEYSTORE_SHA256:
            raise AssertionError(f"keystore content detected at {label}")
        if size == 0 and member_name is not None:
            # Empty non-archive documentation members are allowed.
            return

    def file(self, path: Path, label: str) -> None:
        with path.open("rb") as stream:
            self.consume(iter(lambda: stream.read(1024 * 1024), b""), label)

    def archive(self, source, label: str) -> Budget:
        return scan_archive(source, self.consume, label, limits=ArchiveLimits())


def protected_license_metadata(root: Path) -> tuple[int, str]:
    path = root / "LICENSE&NOTICE.zip"
    if not path.is_file() or path.stat().st_size == 0:
        raise AssertionError("current protected license archive is missing or empty")
    # Reject oversized or otherwise unsafe archives before testzip() performs
    # any unbounded decompression. CRC validation remains a separate gate.
    BinaryInspector().archive(path, "source.license")
    try:
        with zipfile.ZipFile(path) as archive:
            for info in archive.infolist():
                if not info.is_dir() and not safe_member_name(info.filename):
                    raise AssertionError("unsafe member in current protected license archive")
            if archive.testzip() is not None:
                raise AssertionError("current protected license archive CRC failure")
    except AssertionError:
        raise
    except Exception as exc:
        raise AssertionError("current protected license archive is invalid") from exc
    return path.stat().st_size, sha256_file(path)


def inspect_source_payload(files: list[Path]) -> BinaryInspector:
    inspector = BinaryInspector()
    for index, path in enumerate(files, 1):
        label = f"source.file{index}"
        inspector.file(path, label)
        if is_archive_payload(path, label):
            # Actual ZIP payloads recurse even with arbitrary suffixes or
            # leading data; malformed .zip/.jar payloads still fail closed.
            inspector.archive(path, label + ".archive")
    return inspector


def _required_entries() -> set[str]:
    required = {
        ".gitignore", ".github/dependabot.yml", ".github/workflows/codeql.yml",
        ".github/workflows/mobsf.yml", "build.gradle", "settings.gradle", "gradlew",
        "src/main/java/.mobsf", "src/main/cpp/engine_jni.cpp", "src/main/cpp/CMakeLists.txt",
        "src/main/assets/chess.html", "src/main/AndroidManifest.xml",
        "src/main/java/com/Regalia/MainActivity.java",
        "src/main/java/com/Regalia/AtomicFileStore.java",
        "src/main/java/com/Regalia/StockfishNative.java",
        "src/main/java/com/Regalia/PgnCacheManager.java",
        "verifier/README.md", "verifier/runs/recovery-round71.md", "verifier/runs/recovery-round72.md",
        "verifier/runs/recovery-round77.md",
        "verifier/runs/round71-audit.md", "verifier/runs/round72-audit.md",
        "verifier/v11/round72-acceptance.md", "verifier/v11/source_archive.py",
        "verifier/v11/secret_scan.py", "verifier/v11/archive_scan.py",
        "verifier/v11/negative-tests.py", "verifier/v11/integration-tests.py",
        "verifier/v11/browser-download.py", "verifier/v11/run-and-log.sh",
        "verifier/v11/verify-apk.py", "worklog.md", "LICENSE&NOTICE.zip",
    }
    for version in ("v4", "v5", "v6", "v7", "v8", "v9", "v10"):
        required.add(f"verifier/{version}/round71-acceptance.md")
    for name in ("acceptance.md", "run-and-log.sh", "source-checks.py", "atomic-file-store-test.py",
                 "eval-persistence-test.js", "build-concurrency.py", "syntax-checks.py", "source-gate.py",
                 "archive_scan.py", "source_archive.py", "verify-apk.py", "ndk-check.py", "stage-engine.py",
                 "integration-tests.py"):
        required.add(f"verifier/v13/{name}")
    return required


def pack(root: Path, output: Path) -> None:
    root = root.resolve()
    output = output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    license_size, license_hash = protected_license_metadata(root)
    lock_path = output.with_name(output.name + ".lock")
    try:
        lock_fd = os.open(lock_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError as exc:
        raise AssertionError("another pack invocation owns this output lock") from exc
    temporary = None
    try:
        os.close(lock_fd)
        files = payload_files(root, output)
        if not files:
            raise AssertionError("empty source payload")
        inspect_source_payload(files)
        fd, temporary_name = tempfile.mkstemp(prefix=output.name + ".tmp-", dir=output.parent)
        temporary = Path(temporary_name)
        os.close(fd)
        total = 0
        try:
            with zipfile.ZipFile(temporary, "w", compression=zipfile.ZIP_DEFLATED,
                                 compresslevel=9, allowZip64=True) as archive:
                for path in files:
                    rel = path.relative_to(root).as_posix()
                    archive.write(path, PREFIX + rel)
                    total += path.stat().st_size
            # Publish only our exclusively created temporary file while the
            # per-output lock prevents a concurrent replacement/stat race.
            os.replace(temporary, output)
            temporary = None
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)
        print(f"source_entries={len(files)}")
        print(f"source_uncompressed_bytes={total}")
        print(f"protected_license_archive_bytes={license_size}")
        print(f"protected_license_archive_sha256={license_hash}")
        print(f"source_zip_bytes={output.stat().st_size}")
        print(f"source_zip_sha256={sha256_file(output)}")
        print(f"SOURCE-PACK-V13 OK: {output}")
    finally:
        lock_path.unlink(missing_ok=True)


def verify(root: Path, archive_path: Path) -> None:
    root = root.resolve()
    archive_path = archive_path.resolve()
    if not archive_path.is_file():
        raise AssertionError("source ZIP missing")
    # The bounded walker must reject hostile sizes before any member digest,
    # CRC pass or archive.read() can decompress the delivery archive.
    inspector = BinaryInspector()
    budget = inspector.archive(archive_path, "delivery.source")
    license_size, license_hash = protected_license_metadata(root)
    expected_files = payload_files(root, archive_path)
    inspect_source_payload(expected_files)
    expected = {PREFIX + path.relative_to(root).as_posix(): path for path in expected_files}
    with zipfile.ZipFile(archive_path) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)):
            raise AssertionError("duplicate source-ZIP entry")
        if not names or any(not name.startswith(PREFIX) for name in names):
            raise AssertionError("source-ZIP prefix mismatch")
        actual = set(names)
        if actual != set(expected):
            raise AssertionError(
                f"complete source manifest mismatch: missing={len(set(expected)-actual)} "
                f"unexpected={len(actual-set(expected))}"
            )
        for name, path in expected.items():
            rel = name[len(PREFIX):]
            member_path = PurePosixPath(rel)
            if not rel or name.endswith("/") or member_path.is_absolute() or ".." in member_path.parts:
                raise AssertionError("unsafe or non-file source entry")
            if forbidden_name(member_path):
                raise AssertionError("forbidden source entry")
            with archive.open(name) as stream:
                archived_hash = hashlib.file_digest(stream, "sha256").hexdigest()
            if archived_hash != sha256_file(path):
                raise AssertionError(f"source content digest mismatch at entry {len(rel)}")
        if archive.testzip() is not None:
            raise AssertionError("source-ZIP CRC failure")
        missing = sorted(_required_entries() - {name[len(PREFIX):] for name in names})
        if missing:
            raise AssertionError(f"missing required source entries: {len(missing)}")
        protected = archive.read(PREFIX + "LICENSE&NOTICE.zip")
        if protected != (root / "LICENSE&NOTICE.zip").read_bytes():
            raise AssertionError("current protected license archive differs from archived current bytes")
        if hashlib.sha256(archive.read(PREFIX + "src/main/assets/chess.html")).hexdigest() != BUNDLE_SHA256:
            raise AssertionError("source bundle hash mismatch")
        gradlew = archive.getinfo(PREFIX + "gradlew")
        if stat.S_IMODE(gradlew.external_attr >> 16) != 0o755:
            raise AssertionError("gradlew source-ZIP mode is not exactly 0755")
    print(f"source_entries={len(names)} crc_ok=true duplicate_entries=0 manifest_exact=true")
    print(f"nested_archive_members_scanned={budget.members} nested_archive_bytes={budget.bytes}")
    print(f"protected_license_archive_bytes={license_size}")
    print(f"protected_license_archive_sha256={license_hash} current_byte_identical=true")
    print("engine_hash_matches=0 keystore_hash_matches=0 elf_entries=0 recursive_forbidden_members=0")
    print(f"source_zip_bytes={archive_path.stat().st_size}")
    print(f"source_zip_sha256={sha256_file(archive_path)}")
    print("SOURCE-ZIP-V13-GATE OK: exact current manifest, recursive binary inspection, no engine/build/signing material")


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    pack_parser = subparsers.add_parser("pack")
    pack_parser.add_argument("output", type=Path)
    verify_parser = subparsers.add_parser("verify")
    verify_parser.add_argument("archive", type=Path)
    args = parser.parse_args()
    if args.command == "pack":
        pack(root, args.output)
    else:
        verify(root, args.archive)


if __name__ == "__main__":
    main()
