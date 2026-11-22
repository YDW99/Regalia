#!/usr/bin/env python3
"""Search delivered payload bytes for uploaded passwords without revealing them."""
from __future__ import annotations

import argparse
import io
import os
from pathlib import Path
import zipfile

from source_archive import payload_files


class SecretScanner:
    def __init__(self) -> None:
        values = []
        for variable in ("RELEASE_KEYSTORE_PASSWORD", "RELEASE_KEY_PASSWORD"):
            value = os.environ.get(variable, "")
            if not value:
                raise AssertionError(f"required signing secret variable is unset: {variable}")
            values.append(value.encode("utf-8"))
        self.values = sorted(set(values))
        self.patterns = set()
        for value in self.values:
            self.patterns.add(value)
            self.patterns.add(value.decode("utf-8").encode("utf-16le"))
            self.patterns.add(value.decode("utf-8").encode("utf-16be"))
        self.max_pattern = max(map(len, self.patterns))
        self.files = 0
        self.members = 0
        self.bytes = 0

    def stream(self, stream, label: str, member: bool = False) -> None:
        carry = b""
        size = 0
        while True:
            chunk = stream.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            data = carry + chunk
            if any(pattern in data for pattern in self.patterns):
                raise AssertionError(f"uploaded password match at {label}; value suppressed")
            carry = data[-(self.max_pattern - 1):] if self.max_pattern > 1 else b""
        self.bytes += size
        if member:
            self.members += 1
        else:
            self.files += 1

    def file(self, path: Path, label: str | None = None) -> None:
        label = label or str(path)
        with path.open("rb") as stream:
            self.stream(stream, label)

    def archive(self, path: Path, label: str) -> None:
        self.file(path, label + " [raw]")
        with zipfile.ZipFile(path) as archive:
            for info in archive.infolist():
                if info.is_dir():
                    continue
                member_label = f"{label}!/{info.filename}"
                with archive.open(info) as stream:
                    self.stream(stream, member_label, member=True)
                if info.filename.lower().endswith(".zip"):
                    if info.file_size > 20 * 1024 * 1024:
                        raise AssertionError(f"nested ZIP exceeds scan limit: {member_label}")
                    data = archive.read(info)
                    with zipfile.ZipFile(io.BytesIO(data)) as nested:
                        for nested_info in nested.infolist():
                            if nested_info.is_dir():
                                continue
                            with nested.open(nested_info) as stream:
                                self.stream(stream, f"{member_label}!/{nested_info.filename}", member=True)


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser()
    parser.add_argument("--apk", type=Path, required=True)
    parser.add_argument("--source-zip", type=Path, required=True)
    args = parser.parse_args()
    scanner = SecretScanner()
    files = payload_files(root)
    for path in files:
        scanner.file(path, "source/" + path.relative_to(root).as_posix())
        if path.suffix.lower() in (".zip", ".jar") and zipfile.is_zipfile(path):
            with zipfile.ZipFile(path) as archive:
                for info in archive.infolist():
                    if info.is_dir():
                        continue
                    with archive.open(info) as stream:
                        scanner.stream(
                            stream,
                            "source/" + path.relative_to(root).as_posix() + "!/" + info.filename,
                            member=True,
                        )
    scanner.archive(args.apk.resolve(), "delivered.apk")
    scanner.archive(args.source_zip.resolve(), "source.zip")
    print(f"password_variables_checked=2 distinct_passwords={len(scanner.values)} values_suppressed=true")
    print(f"raw_files_scanned={scanner.files} archive_members_scanned={scanner.members} bytes_scanned={scanner.bytes}")
    print("password_matches=0")
    print("SECRET-SCAN-V8 OK: source payload, raw/decompressed APK, raw/decompressed source ZIP and nested ZIPs")


if __name__ == "__main__":
    main()
