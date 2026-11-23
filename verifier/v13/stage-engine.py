#!/usr/bin/env python3
"""Extract only the pinned Stockfish member from the verified inherited APK."""
from pathlib import Path
import hashlib
import os
import sys
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[2]
APK_SIZE = 81_552_289
APK_SHA256 = "644919d57c690b54c56b26ed0ce91ec785d67a68e8e58eeaa6aed2946a5533fb"
MEMBER = "lib/arm64-v8a/libstockfish.so"
ENGINE_SIZE = 100_695_968
ENGINE_SHA256 = "ffd8fc2004d3d19f9fdab95d84c92709aea92e8d3af405eda0b281b23cf1daf8"


def file_digest(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(8 * 1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: stage-engine.py INHERITED_ROUND72_APK")
    source = Path(sys.argv[1])
    assert source.stat().st_size == APK_SIZE, "inherited APK size mismatch"
    actual_apk_digest = file_digest(source)
    assert actual_apk_digest == APK_SHA256, "inherited APK identity mismatch"
    with zipfile.ZipFile(source) as archive:
        info = archive.getinfo(MEMBER)
        assert info.file_size == ENGINE_SIZE, "engine member size mismatch"
        payload = archive.read(MEMBER)
    actual_engine_digest = hashlib.sha256(payload).hexdigest()
    assert len(payload) == ENGINE_SIZE and actual_engine_digest == ENGINE_SHA256, "engine payload identity mismatch"
    target = ROOT / "src/main/jniLibs/arm64-v8a/libstockfish.so"
    assert not target.exists(), "refusing to overwrite an existing engine"
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=target.name + ".", suffix=".tmp", dir=target.parent)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(temporary, 0o755)
        os.replace(temporary, target)
        temporary = None
    finally:
        if temporary is not None:
            try:
                os.remove(temporary)
            except FileNotFoundError:
                pass
    print(f"INHERITED_APK bytes={APK_SIZE} sha256={actual_apk_digest}")
    print(f"ENGINE_MEMBER={MEMBER} bytes={len(payload)} sha256={actual_engine_digest}")
    print("ENGINE-STAGE-V13 OK: exactly one pinned member extracted")


if __name__ == "__main__":
    main()
