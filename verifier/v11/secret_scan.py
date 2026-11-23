#!/usr/bin/env python3
"""Recursively scan delivered bytes without exposing secrets or secret-bearing names."""
from __future__ import annotations

import argparse
import os
from pathlib import Path

from archive_scan import ArchiveLimits, scan_archive
from source_archive import is_archive_payload, payload_files


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
        self.carry = b""
        self.current_label = None

    def _begin(self, label: str) -> None:
        self.carry = b""
        self.current_label = label

    def _feed(self, chunk: bytes) -> None:
        data = self.carry + chunk
        if any(pattern in data for pattern in self.patterns):
            # Opaque identifiers only: paths and member names may contain the secret.
            raise AssertionError(f"uploaded password match at {self.current_label}; value suppressed")
        self.carry = data[-(self.max_pattern - 1):] if self.max_pattern > 1 else b""
        self.bytes += len(chunk)

    def file(self, path: Path, label: str) -> None:
        self._begin(label)
        try:
            with path.open("rb") as stream:
                for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                    self._feed(chunk)
        except AssertionError:
            raise
        except Exception:
            raise AssertionError(f"file read failed at {label}; path suppressed") from None
        self.files += 1

    def consume(self, chunks, label: str, _member_name: str) -> None:
        self._begin(label)
        for chunk in chunks:
            self._feed(chunk)
        self.members += 1

    def archive(self, source, label: str):
        return scan_archive(source, self.consume, label, limits=ArchiveLimits())


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser()
    parser.add_argument("--apk", type=Path, required=True)
    parser.add_argument("--source-zip", type=Path, required=True)
    args = parser.parse_args()
    scanner = SecretScanner()
    try:
        files = payload_files(root, args.source_zip)
    except OSError as exc:
        # v1.2.3 round-79 (CodeRabbit PR#60 #20): enumeration failures are
        #   reported WITHOUT the path — an unreadable directory's name may
        #   itself carry the signing password, and the raw OSError traceback
        #   would print it. The scan still fails; unreadable directories are
        #   never skipped silently.
        raise AssertionError(
            f"source enumeration failed ({type(exc).__name__}); path suppressed"
        ) from None
    for index, path in enumerate(files, 1):
        label = f"source.file{index}"
        scanner.file(path, label)
        if is_archive_payload(path, label):
            scanner.archive(path, label + ".archive")
    scanner.file(args.apk.resolve(), "delivery.apk.raw")
    apk_budget = scanner.archive(args.apk.resolve(), "delivery.apk")
    scanner.file(args.source_zip.resolve(), "delivery.source.raw")
    source_budget = scanner.archive(args.source_zip.resolve(), "delivery.source")
    print(f"password_variables_checked=2 distinct_passwords={len(scanner.values)} values_suppressed=true")
    print(f"raw_files_scanned={scanner.files} archive_members_scanned={scanner.members} bytes_scanned={scanner.bytes}")
    print(f"apk_archive_members={apk_budget.members} source_archive_members={source_budget.members}")
    print("password_matches=0")
    print("SECRET-SCAN-V11 OK: recursive bounded source/APK/source-ZIP scan with opaque diagnostics")


if __name__ == "__main__":
    main()
