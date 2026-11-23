#!/usr/bin/env python3
"""Recursive, bounded archive traversal shared by round-72 scanners.

Labels are opaque caller-supplied identifiers. Diagnostics never include input
paths or archive member names, which may themselves contain sensitive text.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import PurePosixPath
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
    try:
        archive_context = zipfile.ZipFile(source)
    except Exception as exc:
        raise AssertionError(f"invalid archive at {label}") from None
    with archive_context as archive:
        infos = archive.infolist()
        file_names = [info.filename for info in infos if not info.is_dir()]
        if len(file_names) != len(set(file_names)):
            raise AssertionError(f"duplicate archive member at {label}")
        for info in infos:
            member_label = budget.next_label(label)
            # Directory entries consume the shared member budget even though
            # they have no payload to decompress.
            budget.reserve(info, member_label)
            if info.is_dir():
                continue
            if not safe_member_name(info.filename):
                raise AssertionError(f"unsafe archive member at {member_label}")
            if info.flag_bits & 0x1:
                raise AssertionError(f"encrypted archive member at {member_label}")
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
