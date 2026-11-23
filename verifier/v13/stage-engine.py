#!/usr/bin/env python3
"""Stage the pinned Stockfish 19 engine from the OFFICIAL sf_19 release asset.

v1.2.3 round-81: the engine acquisition channel moves from the inherited
round-72 APK to the official Stockfish GitHub release page, per the project
owner's instruction. The inherited round-72 APK is no longer publicly
retrievable, while the embedded engine binary is byte-identical to the
`stockfish-android-arm64-universal` asset of the official sf_19 release
(https://github.com/official-stockfish/Stockfish/releases/tag/sf_19,
asset id 545567324): 100,695,968 bytes,
sha256 ffd8fc2004d3d19f9fdab95d84c92709aea92e8d3af405eda0b281b23cf1daf8.
The ENGINE pins are unchanged — engine identity is preserved exactly; only
the channel that delivers the bytes is different. The whole .tar.gz is
digest-pinned as well, so a tampered or partial download cannot stage.
"""
from pathlib import Path
import hashlib
import os
import sys
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parents[2]
ASSET_SIZE = 80_233_187
ASSET_SHA256 = "ebb24051aa4a222b4daaf049b882ecf1163d370c128fe02316602643f4d5e426"
ASSET_URL = "https://github.com/official-stockfish/Stockfish/releases/download/sf_19/stockfish-android-arm64-universal.tar.gz"
MEMBER = "stockfish/stockfish-android-arm64-universal"
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
        raise SystemExit("usage: stage-engine.py SF19_ANDROID_ARM64_UNIVERSAL_TAR_GZ")
    source = Path(sys.argv[1])
    assert source.stat().st_size == ASSET_SIZE, "official sf_19 asset size mismatch"
    actual_asset_digest = file_digest(source)
    assert actual_asset_digest == ASSET_SHA256, "official sf_19 asset identity mismatch"
    with tarfile.open(source, "r:gz") as archive:
        member = archive.getmember(MEMBER)
        assert member.isfile(), "engine member is not a regular file"
        assert member.size == ENGINE_SIZE, "engine member size mismatch"
        extracted = archive.extractfile(member)
        assert extracted is not None, "engine member could not be extracted"
        payload = extracted.read()
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
    print(f"OFFICIAL_ASSET bytes={ASSET_SIZE} sha256={actual_asset_digest}")
    print(f"ASSET_URL={ASSET_URL}")
    print(f"ENGINE_MEMBER={MEMBER} bytes={len(payload)} sha256={actual_engine_digest}")
    print("ENGINE-STAGE-V13 OK: official sf_19 arm64-v8a universal engine staged byte-identically")
