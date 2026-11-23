#!/usr/bin/env python3
"""Validate the official Android NDK r27c archive used to repair the build host."""
from pathlib import Path
import hashlib
import sys
import zipfile

EXPECTED_SIZE = 663_987_688
EXPECTED_SHA256 = "59c2f6dc96743b5daf5d1626684640b20a6bd2b1d85b13156b90333741bad5cc"
PREFIX = "android-ndk-r27c/"
REQUIRED = (
    PREFIX + "source.properties",
    PREFIX + "build/cmake/android.toolchain.cmake",
    PREFIX + "toolchains/llvm/prebuilt/linux-x86_64/bin/clang",
    PREFIX + "toolchains/llvm/prebuilt/linux-x86_64/sysroot/usr/lib/aarch64-linux-android/libc++_shared.so",
)


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: ndk-check.py ANDROID_NDK_ZIP")
    path = Path(sys.argv[1])
    size = path.stat().st_size
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(8 * 1024 * 1024), b""):
            digest.update(block)
    actual_digest = digest.hexdigest()
    print(f"NDK_ZIP bytes={size} sha256={actual_digest}")
    assert size == EXPECTED_SIZE, "NDK archive size mismatch"
    assert actual_digest == EXPECTED_SHA256, "NDK archive digest mismatch"
    with zipfile.ZipFile(path) as archive:
        names = set(archive.namelist())
        for name in REQUIRED:
            assert name in names, f"missing required NDK member: {name}"
        source = archive.read(PREFIX + "source.properties").decode("utf-8")
        assert "Pkg.Revision = 27.2.12479018" in source, "NDK revision mismatch"
        runtime = archive.getinfo(REQUIRED[-1])
        assert runtime.file_size == 1_794_776, "aarch64 libc++ runtime size mismatch"
        bad = archive.testzip()
        assert bad is None, f"NDK ZIP CRC failure: {bad}"
        print(f"NDK_REVISION=27.2.12479018 members={len(names)} libc++_bytes={runtime.file_size}")
    print("NDK-ZIP-V13 OK: full CRC, identity, toolchain and correct aarch64 runtime path")


if __name__ == "__main__":
    main()
