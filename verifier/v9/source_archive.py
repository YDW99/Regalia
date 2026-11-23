#!/usr/bin/env python3
"""Create or validate the engine-free round-71 source archive."""
from __future__ import annotations

import argparse
import hashlib
import os
from pathlib import Path, PurePosixPath
import tempfile
import zipfile

PREFIX = "Regalia-v1.2.3-round71/"
ENGINE_SHA256 = "ffd8fc2004d3d19f9fdab95d84c92709aea92e8d3af405eda0b281b23cf1daf8"
KEYSTORE_SHA256 = "6a44f6607f4ed90fa6f4c52bedb8626d22ef285ba4127b68dd26975aaa522ccc"
BUNDLE_SHA256 = "cc69b869077a72dc1367461c6567a47fea159d292fd5e3d207a2afef84f167b5"
EXCLUDED_DIRS = {".git", ".gradle", ".cxx", "build", ".idea", "__pycache__", "node_modules"}
EXCLUDED_FILES = {"local.properties", "keystore.properties", "keystore-info.txt", "regalia-signing.env"}
FORBIDDEN_SUFFIXES = (".jks", ".keystore", ".p12", ".pfx", ".apk", ".aab", ".idsig", ".so")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def forbidden_name(path: PurePosixPath) -> bool:
    lower_parts = [part.lower() for part in path.parts]
    name = lower_parts[-1]
    if any(part in EXCLUDED_DIRS for part in lower_parts[:-1]):
        return True
    # v1.2.3 round-79 (CodeRabbit PR#60 #29): compare lowercased components on
    #   both sides — the previous form matched the literal "jniLibs" (capital L)
    #   against an already-lowercased path, so a delivered ZIP containing
    #   src/main/jniLibs/README.txt slipped past validation. Pack-side pruning
    #   (exact rel.as_posix() == "src/main/jniLibs") is case-exact by design;
    #   the ZIP validation side now matches at any case via the lower form.
    if "src/main/jnilibs" in path.as_posix().lower():
        return True
    if name in EXCLUDED_FILES or name.endswith(FORBIDDEN_SUFFIXES):
        return True
    if name == "stockfish":
        return True
    if "stockfish" in name and name.endswith((".tar", ".tar.gz", ".tgz", ".zip", ".7z", ".xz")):
        return True
    return False


def payload_files(root: Path) -> list[Path]:
    """Return the exact regular-file payload, pruning build/signing/engine trees."""
    files: list[Path] = []
    for directory, dirnames, filenames in os.walk(root):
        current = Path(directory)
        kept = []
        for dirname in sorted(dirnames):
            candidate = current / dirname
            rel = candidate.relative_to(root)
            if dirname in EXCLUDED_DIRS or rel.as_posix() == "src/main/jniLibs":
                continue
            if candidate.is_symlink():
                raise AssertionError(f"symlink directory outside payload contract: {rel}")
            kept.append(dirname)
        dirnames[:] = kept
        for filename in sorted(filenames):
            path = current / filename
            rel = path.relative_to(root)
            if path.is_symlink() or not path.is_file():
                raise AssertionError(f"non-regular payload file: {rel}")
            if forbidden_name(PurePosixPath(rel.as_posix())):
                continue
            files.append(path)
    return sorted(files, key=lambda path: path.relative_to(root).as_posix())


def pack(root: Path, output: Path) -> None:
    files = payload_files(root)
    if not files:
        raise AssertionError("empty source payload")
    output.parent.mkdir(parents=True, exist_ok=True)
    # v1.2.3 round-79 (CodeRabbit PR#60 #30): an EXCLUSIVE temporary per
    #   invocation (mkstemp) — the fixed ".tmp" sibling let a second pack
    #   delete the first pack's still-open temporary, publish an unfinished
    #   ZIP, or fail after its own path was moved away. Each call now replaces
    #   and cleans up only the file it created.
    fd, temporary_name = tempfile.mkstemp(prefix=output.name + ".tmp-", dir=output.parent)
    temporary = Path(temporary_name)
    os.close(fd)
    total = 0
    try:
        with zipfile.ZipFile(temporary, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9, allowZip64=True) as archive:
            for path in files:
                rel = path.relative_to(root).as_posix()
                archive.write(path, PREFIX + rel)
                total += path.stat().st_size
        os.replace(temporary, output)
    finally:
        temporary.unlink(missing_ok=True)
    print(f"source_entries={len(files)}")
    print(f"source_uncompressed_bytes={total}")
    print(f"source_zip_bytes={output.stat().st_size}")
    print(f"source_zip_sha256={sha256_file(output)}")
    print(f"SOURCE-PACK-V9 OK: {output}")


def verify(root: Path, archive_path: Path) -> None:
    # v1.2.3 round-79 (CodeRabbit PR#60 #7): ONE open file object serves the
    #   whole verification and the reported size/SHA-256 — the old code
    #   re-read the path after the with-block, so a concurrent os.replace
    #   could make the success line attest an unchecked file.
    with archive_path.open("rb") as raw:
        if not archive_path.is_file():
            raise AssertionError("source ZIP missing")
        with zipfile.ZipFile(raw) as archive:
            names = archive.namelist()
            if len(names) != len(set(names)):
                raise AssertionError("duplicate source-ZIP entry")
            if not names or any(not name.startswith(PREFIX) for name in names):
                raise AssertionError("source-ZIP prefix mismatch")
            for name in names:
                rel = name[len(PREFIX):]
                path = PurePosixPath(rel)
                if not rel or name.endswith("/") or path.is_absolute() or ".." in path.parts:
                    raise AssertionError(f"unsafe or non-file source entry: {name}")
                if forbidden_name(path):
                    raise AssertionError(f"forbidden source entry: {rel}")
            corrupt = archive.testzip()
            if corrupt is not None:
                raise AssertionError(f"source-ZIP CRC failure: {corrupt}")
            required = {
                ".gitignore",
                ".github/dependabot.yml",
                ".github/workflows/codeql.yml",
                ".github/workflows/mobsf.yml",
                "src/main/java/.mobsf",
                "src/main/cpp/engine_jni.cpp",
                "src/main/cpp/CMakeLists.txt",
                "src/main/assets/chess.html",
                "verifier/README.md",
                "verifier/runs/recovery-round71.md",
                "verifier/runs/round71-audit.md",
                "worklog.md",
                "LICENSE&NOTICE.zip",
            }
            for version in ("v4", "v5", "v6", "v7", "v8", "v9"):
                required.add(f"verifier/{version}/round71-acceptance.md")
            missing = sorted(required - {name[len(PREFIX):] for name in names})
            if missing:
                raise AssertionError(f"missing required source entries: {missing}")
            protected = archive.read(PREFIX + "LICENSE&NOTICE.zip")
            if len(protected) != 56011 or protected != (root / "LICENSE&NOTICE.zip").read_bytes():
                raise AssertionError("protected LICENSE&NOTICE.zip changed")
            if hashlib.sha256(archive.read(PREFIX + "src/main/assets/chess.html")).hexdigest() != BUNDLE_SHA256:
                raise AssertionError("source bundle hash mismatch")
            engine_hits = []
            keystore_hits = []
            elf_hits = []
            total = 0
            for name in names:
                digest = hashlib.sha256()
                size = 0
                with archive.open(name) as stream:
                    first = stream.read(4)
                    if first == b"\x7fELF":
                        elf_hits.append(name[len(PREFIX):])
                    digest.update(first)
                    size += len(first)
                    for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                        digest.update(chunk)
                        size += len(chunk)
                total += size
                value = digest.hexdigest()
                if value == ENGINE_SHA256:
                    engine_hits.append(name[len(PREFIX):])
                if value == KEYSTORE_SHA256:
                    keystore_hits.append(name[len(PREFIX):])
            if engine_hits or keystore_hits or elf_hits:
                raise AssertionError(
                    f"forbidden binary content: engine={engine_hits}, keystore={keystore_hits}, ELF={elf_hits}"
                )
        print(f"source_entries={len(names)} crc_ok=true duplicate_entries=0")
        print(f"source_uncompressed_bytes={total}")
        print("protected_license_archive_bytes=56011 byte_identical=true")
        print("engine_hash_matches=0 keystore_hash_matches=0 elf_entries=0")
        # v1.2.3 round-79 (CodeRabbit PR#60 #7): identity of the SAME verified
        # file object — size and SHA-256 are read from the already-open fd,
        # never by re-opening the path.
        raw.seek(0)
        archive_hash = hashlib.sha256()
        for chunk in iter(lambda: raw.read(1024 * 1024), b""):
            archive_hash.update(chunk)
        size = raw.tell()
        print(f"source_zip_bytes={size}")
        print(f"source_zip_sha256={archive_hash}")
        print("SOURCE-ZIP-V9-GATE OK: complete required payload, no engine/build/signing material")


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
        pack(root, args.output.resolve())
    else:
        verify(root, args.archive.resolve())


if __name__ == "__main__":
    main()
