#!/usr/bin/env python3
"""Recursive, bounded archive traversal shared by round-72 scanners.

Labels are opaque caller-supplied identifiers. Diagnostics never include input
paths or archive member names, which may themselves contain sensitive text.

v1.2.3 round-79 (CodeRabbit PR#60 hardening):
- The central directory is bounded BEFORE zipfile.ZipFile() parses it into
  memory (an EOCD tail preflight), and the member-count cap is applied to the
  ACTUAL parsed record count before traversal — a hostile ZIP declaring a
  huge central directory or tens of thousands of members can no longer spend
  unbounded parse memory before a cap fires.
- Duplicate-member detection covers directory entries as well.
- Every member — directories included — is validated for path safety and
  encryption BEFORE any skip; a directory entry that carries payload bytes
  (file_size != 0) is rejected instead of silently skipped.
"""
from __future__ import annotations

from dataclasses import dataclass
import os
from pathlib import PurePosixPath
import struct
import tempfile
from typing import BinaryIO, Callable, Iterable
import zipfile

MIB = 1024 * 1024


@dataclass(frozen=True)
class ArchiveLimits:
    max_depth: int = 6
    max_member_bytes: int = 128 * MIB
    max_total_bytes: int = 512 * MIB
    max_members: int = 20_000
    max_nested_archive_bytes: int = 128 * MIB
    # round-79 (CodeRabbit PR#60): bound the central directory itself before
    # zipfile materializes every ZipInfo into memory. 8 MiB accommodates the
    # 20k-member cap with generously-sized names.
    max_central_directory_bytes: int = 8 * MIB


class Budget:
    def __init__(self, limits: ArchiveLimits):
        self.limits = limits
        self.bytes = 0
        self.members = 0
        self.sequence = 0

    def reserve(self, info: zipfile.ZipInfo, label: str) -> None:
        self.members += 1
        if self.members > self.limits.max_members:
            raise AssertionError(f"archive member limit exceeded at {label}")
        if info.file_size < 0 or info.file_size > self.limits.max_member_bytes:
            raise AssertionError(f"archive member size limit exceeded at {label}")
        self.bytes += info.file_size
        if self.bytes > self.limits.max_total_bytes:
            raise AssertionError(f"archive cumulative size limit exceeded at {label}")

    def next_label(self, prefix: str) -> str:
        self.sequence += 1
        return f"{prefix}.m{self.sequence}"


def safe_member_name(name: str) -> bool:
    # Backslashes are rejected rather than normalized differently by platforms.
    path = PurePosixPath(name)
    return bool(name) and "\\" not in name and not path.is_absolute() and ".." not in path.parts


def _looks_like_zip_name(name: str) -> bool:
    return name.lower().endswith((".zip", ".jar", ".apk", ".aab"))


def _read_tail(source, tail_bytes: int) -> bytes:
    """Read the final `tail_bytes` of a path or binary stream; restore offset 0."""
    if isinstance(source, (str, bytes, os.PathLike)):
        with open(source, "rb") as stream:
            stream.seek(0, os.SEEK_END)
            size = stream.tell()
            start = max(0, size - tail_bytes)
            stream.seek(start)
            return stream.read(size - start)
    source.seek(0, os.SEEK_END)
    size = source.tell()
    start = max(0, size - tail_bytes)
    source.seek(start)
    data = source.read(size - start)
    source.seek(0)
    return data


def _central_directory_size(tail: bytes) -> int | None:
    """Extract the central-directory size the stdlib parser will actually use.

    v1.2.3 round-80 (CodeRabbit PR#60 re-review): CPython 3.11's _EndRecData
    unconditionally runs _EndRecData64, and a valid ZIP64 locator sitting in
    front of the EOCD makes the parser adopt the ZIP64 EOCD64 record's 64-bit
    sizes — regardless of the classic EOCD's 32-bit cd_size (the round-79
    form only consulted the EOCD64 when the classic value was exactly
    0xFFFFFFFF, so an archive pairing a small classic size with a hostile
    valid EOCD64 passed the preflight while the parser still materialized
    the oversized ZIP64 directory). The effective size now mirrors the
    parser: a locator signature in front of the EOCD means the parser goes
    ZIP64, so the EOCD64's size field is the value checked; without a locator
    the classic value is used. Anything ambiguous (missing/truncated EOCD,
    locator without a complete EOCD64 in the tail) returns None and the
    caller fails closed.
    """
    index = tail.rfind(b"PK\x05\x06")
    if index < 0 or len(tail) - index < 22:
        return None
    locator = index - 20
    if locator >= 0 and tail[locator:locator + 4] == b"PK\x06\x07":
        index64 = tail.rfind(b"PK\x06\x06")
        if index64 < 0 or len(tail) - index64 < 48:
            return None
        return struct.unpack_from("<Q", tail, index64 + 40)[0]
    return struct.unpack_from("<I", tail, index + 12)[0]


def _preflight_central_directory(source, limits: ArchiveLimits, label: str) -> None:
    """round-79 (CodeRabbit PR#60): bound the central directory BEFORE
    zipfile.ZipFile() parses it — zipfile materializes every ZipInfo while
    constructing, so a multi-gigabyte declared central directory would spend
    unbounded memory before any traversal-time cap could fire. Reads only the
    tail (EOCD locator); the file offset is restored afterwards.

    v1.2.3 round-80 (CodeRabbit PR#60 re-review): the preflight's own I/O
    errors enter the same opaque-diagnostic boundary as the parser's — a
    path source moved after a raw-byte scan used to raise a bare OSError
    whose traceback printed the original file path. An effective size that
    cannot be determined (missing EOCD, or a ZIP64 locator whose EOCD64
    record is absent from the tail) now rejects the archive instead of
    falling back to a smaller classic value the parser would not use.
    """
    try:
        tail = _read_tail(source, 131072)  # 64KiB comment cap + EOCD64 + locator
    except Exception:
        raise AssertionError(f"central directory preflight read failed at {label}") from None
    if not tail:
        return  # empty/tiny inputs are rejected by ZipFile itself
    cd_size = _central_directory_size(tail)
    if cd_size is None:
        raise AssertionError(f"central directory size indeterminable at {label}")
    if cd_size > limits.max_central_directory_bytes:
        raise AssertionError(f"central directory size limit exceeded at {label}")


def scan_archive(
    source,
    consume: Callable[[Iterable[bytes], str, str], None],
    label: str,
    *,
    depth: int = 0,
    budget: Budget | None = None,
    limits: ArchiveLimits | None = None,
) -> Budget:
    """Consume every decompressed ZIP member, recursively and within bounds.

    consume receives a one-pass chunk iterable, an opaque member label and the
    original member name. The name is for policy checks only and must never be
    copied into diagnostics by secret-scanning consumers.
    """
    limits = limits or ArchiveLimits()
    budget = budget or Budget(limits)
    _preflight_central_directory(source, limits, label)
    try:
        archive_context = zipfile.ZipFile(source)
    except Exception as exc:
        raise AssertionError(f"invalid archive at {label}") from None
    with archive_context as archive:
        infos = archive.infolist()
        # round-79 (CodeRabbit PR#60): cap the ACTUAL parsed record count
        # before any traversal — do not rely on declared counts or on the
        # per-member budget alone.
        if len(infos) > limits.max_members:
            raise AssertionError(f"archive member count {len(infos)} exceeds limit at {label}")
        # round-79 (CodeRabbit PR#60): duplicate detection covers directory
        # entries as well — two same-named empty directories are duplicates
        # exactly like two same-named files.
        names_seen = [info.filename for info in infos]
        if len(names_seen) != len(set(names_seen)):
            raise AssertionError(f"duplicate archive member at {label}")
        for info in infos:
            member_label = budget.next_label(label)
            # Directory entries consume the shared member budget even though
            # they have no payload to decompress.
            budget.reserve(info, member_label)
            # round-79 (CodeRabbit PR#60): path safety and encryption are
            # checked for EVERY member — directories included — before any
            # skip; a directory entry that carries payload bytes is rejected.
            if not safe_member_name(info.filename):
                raise AssertionError(f"unsafe archive member at {member_label}")
            if info.flag_bits & 0x1:
                raise AssertionError(f"encrypted archive member at {member_label}")
            if info.is_dir():
                if info.file_size != 0:
                    raise AssertionError(f"directory member with payload at {member_label}")
                continue
            spool = tempfile.SpooledTemporaryFile(max_size=4 * MIB)
            try:
                with archive.open(info) as stream:
                    def chunks(stream=stream, spool=spool):
                        while True:
                            chunk = stream.read(MIB)
                            if not chunk:
                                break
                            spool.write(chunk)
                            yield chunk

                    consume(chunks(), member_label, info.filename)
                # Extensions and PK prefixes are not ZIP proof: a valid ZIP may
                # carry a shebang or arbitrary leading data. Inspect the whole
                # bounded member before deciding whether recursion is required.
                spool.seek(0)
                try:
                    is_zip = zipfile.is_zipfile(spool)
                except Exception:
                    raise AssertionError(f"archive detection failed at {member_label}") from None
                if not is_zip:
                    if _looks_like_zip_name(info.filename):
                        raise AssertionError(f"invalid nested archive at {member_label}")
                else:
                    if info.file_size > limits.max_nested_archive_bytes:
                        raise AssertionError(f"nested archive size limit exceeded at {member_label}")
                    if depth + 1 > limits.max_depth:
                        raise AssertionError(f"archive depth limit exceeded at {member_label}")
                    spool.seek(0)
                    scan_archive(
                        spool, consume, member_label, depth=depth + 1,
                        budget=budget, limits=limits,
                    )
            except AssertionError:
                raise
            except Exception:
                raise AssertionError(f"archive read failed at {member_label}") from None
            finally:
                spool.close()
    return budget
