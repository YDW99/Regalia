#!/usr/bin/env python3
"""Validate the exact round-71 release APK without accessing signing secrets."""
from __future__ import annotations

import argparse
import hashlib
import os
from pathlib import Path
import re
import struct
import subprocess
import tempfile
import zipfile

EXPECTED_CERT = "45bc6d36c9fcff8ef9e55f510b43bce44cb854ea4b2f235a0f4955da05a8d8bc"
EXPECTED_ENGINE = "ffd8fc2004d3d19f9fdab95d84c92709aea92e8d3af405eda0b281b23cf1daf8"
EXPECTED_BUNDLE = "cc69b869077a72dc1367461c6567a47fea159d292fd5e3d207a2afef84f167b5"
EXPECTED_NATIVE = {
    "lib/arm64-v8a/libstockfish.so",
    "lib/arm64-v8a/libengine_bridge.so",
    "lib/arm64-v8a/libc++_shared.so",
}
EXPECTED_PERMISSIONS = {
    "android.permission.INTERNET",
    "android.permission.WAKE_LOCK",
    "android.permission.VIBRATE",
    "android.permission.WRITE_EXTERNAL_STORAGE",
    "android.permission.READ_EXTERNAL_STORAGE",
    "android.permission.FOREGROUND_SERVICE",
    "android.permission.FOREGROUND_SERVICE_SPECIAL_USE",
    "android.permission.POST_NOTIFICATIONS",
}
V2_ID = 0x7109871A
V3_ID = 0xF05368C0


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sha256_member(archive: zipfile.ZipFile, name: str) -> tuple[int, str]:
    digest = hashlib.sha256()
    size = 0
    with archive.open(name) as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            size += len(chunk)
            digest.update(chunk)
    return size, digest.hexdigest()


def run(tool: Path, *args: str) -> str:
    env = os.environ.copy()
    env.setdefault("JAVA_HOME", "/mnt/agents/buildenv/jdk17")
    env["PATH"] = f"{env['JAVA_HOME']}/bin:{env.get('PATH', '')}"
    result = subprocess.run(
        [str(tool), *args], text=True, stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT, env=env, check=False,
    )
    print(f"$ {tool.name} {' '.join(args)}\n{result.stdout}", flush=True)
    if result.returncode != 0:
        raise AssertionError(f"{tool.name} exited {result.returncode}")
    return result.stdout


def parse_signing_block(apk: Path) -> dict[int, int]:
    """Locate and structurally parse APK Signing Block ID-value pairs."""
    size = apk.stat().st_size
    with apk.open("rb") as stream:
        tail_size = min(size, 65557)
        stream.seek(size - tail_size)
        tail = stream.read(tail_size)
        eocd = -1
        candidate = len(tail)
        while True:
            candidate = tail.rfind(b"PK\x05\x06", 0, candidate)
            if candidate < 0:
                raise AssertionError("ZIP EOCD not found")
            if candidate + 22 <= len(tail):
                comment_len = struct.unpack_from("<H", tail, candidate + 20)[0]
                if candidate + 22 + comment_len == len(tail):
                    eocd = candidate
                    break
        cd_offset = struct.unpack_from("<I", tail, eocd + 16)[0]
        if cd_offset == 0xFFFFFFFF:
            raise AssertionError("ZIP64 APK is outside this validator's contract")
        if cd_offset < 24:
            raise AssertionError("invalid central-directory offset")
        stream.seek(cd_offset - 24)
        footer = stream.read(24)
        block_size = struct.unpack_from("<Q", footer, 0)[0]
        if footer[8:] != b"APK Sig Block 42":
            raise AssertionError("APK Signing Block magic absent")
        block_start = cd_offset - block_size - 8
        if block_size < 24 or block_start < 0:
            raise AssertionError("invalid APK Signing Block size")
        stream.seek(block_start)
        if struct.unpack("<Q", stream.read(8))[0] != block_size:
            raise AssertionError("APK Signing Block size fields differ")
        pairs: dict[int, int] = {}
        pos = block_start + 8
        pairs_end = cd_offset - 24
        while pos < pairs_end:
            if pos + 12 > pairs_end:
                raise AssertionError("truncated pair header")
            stream.seek(pos)
            pair_len = struct.unpack("<Q", stream.read(8))[0]
            pair_id = struct.unpack("<I", stream.read(4))[0]
            next_pos = pos + 8 + pair_len
            if pair_len < 4 or next_pos > pairs_end:
                raise AssertionError(f"invalid pair length at {pos}")
            if pair_id in pairs:
                raise AssertionError(f"duplicate Signing Block ID 0x{pair_id:08x}")
            pairs[pair_id] = pair_len - 4
            pos = next_pos
        if pos != pairs_end:
            raise AssertionError("Signing Block pairs do not consume their region")
    for scheme, pair_id in (("v2", V2_ID), ("v3", V3_ID)):
        if pair_id not in pairs:
            raise AssertionError(f"{scheme} Signing Block absent")
    print(f"signing_block_offset={block_start}")
    print(f"signing_block_bytes={block_size + 8}")
    for pair_id, value_size in sorted(pairs.items()):
        print(f"signing_block_id=0x{pair_id:08x} value_bytes={value_size}")
    return pairs


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser()
    parser.add_argument("apk", type=Path)
    parser.add_argument("--source-bundle", type=Path, default=root / "src/main/assets/chess.html")
    parser.add_argument("--apksigner", type=Path, default=Path("/mnt/agents/buildenv/sdk/build-tools/35.0.0/apksigner"))
    parser.add_argument("--aapt", type=Path, default=Path("/mnt/agents/buildenv/sdk/build-tools/35.0.0/aapt"))
    args = parser.parse_args()
    apk = args.apk.resolve()
    bundle = args.source_bundle.resolve()
    if not apk.is_file() or not bundle.is_file():
        raise AssertionError("APK or source bundle missing")

    # v1.2.3 round-79 (CodeRabbit PR#60 #9): ONE private copy of the APK is made
    #   before the first check; every check below — the external SDK tools, the
    #   Signing Block parser, the ZIP checks and the reported size/SHA-256 —
    #   runs against that fixed copy, and the original path is never re-opened
    #   after the copy is made (a concurrent replacement of the path can no
    #   longer make the success line attest an unchecked file).
    with tempfile.TemporaryDirectory(prefix="apk-gate-") as work_dir:
        private_apk = Path(work_dir) / "candidate.apk"
        with apk.open("rb") as source_stream, private_apk.open("wb") as target_stream:
            for chunk in iter(lambda: source_stream.read(1024 * 1024), b""):
                target_stream.write(chunk)
        signed = run(args.apksigner, "verify", "--verbose", "--print-certs", str(private_apk))
        for scheme in (1, 2, 3):
            pattern = rf"Verified using v{scheme} scheme .*?: true"
            if not re.search(pattern, signed):
                raise AssertionError(f"apksigner v{scheme} is not true")
        if not re.search(r"Number of signers: 1(?:\s|$)", signed):
            raise AssertionError("APK does not have exactly one signer")
        cert_match = re.search(r"Signer #1 certificate SHA-256 digest: ([0-9a-f]{64})", signed)
        if not cert_match or cert_match.group(1) != EXPECTED_CERT:
            raise AssertionError("certificate SHA-256 mismatch")

        badging = run(args.aapt, "dump", "badging", str(private_apk))
        package = re.search(r"^package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'", badging, re.M)
        if not package or package.groups() != ("com.Regalia", "10203", "1.2.3"):
            raise AssertionError("applicationId/version mismatch")
        if "sdkVersion:'23'" not in badging or "targetSdkVersion:'35'" not in badging:
            raise AssertionError("min/target SDK mismatch")
        if "application-debuggable" in badging:
            raise AssertionError("release APK is debuggable")
        # v1.2.3 round-79 (CodeRabbit PR#60 #8): aapt dumps SDK-23-only permissions
        #   as uses-permission-sdk-23: — extract BOTH declaration kinds before
        #   comparing to the baseline set (an APK declaring the eight baseline
        #   permissions plus an sdk-23 extra must still fail the comparison).
        permissions = set(
            re.findall(r"^uses-permission(?:-sdk-23)?: name='([^']+)'", badging, re.M)
        )
        if permissions != EXPECTED_PERMISSIONS:
            raise AssertionError(f"baseline permission set mismatch: {sorted(permissions)}")
        native_codes = re.findall(r"^native-code: (.+)$", badging, re.M)
        if native_codes != ["'arm64-v8a'"]:
            raise AssertionError(f"unexpected aapt native-code declaration: {native_codes}")

        pairs = parse_signing_block(private_apk)
        if len(pairs) < 2:
            raise AssertionError("incomplete Signing Block")

        with zipfile.ZipFile(private_apk) as archive:
            names = archive.namelist()
            if len(names) != len(set(names)):
                raise AssertionError("duplicate APK ZIP entry")
            unsafe = [name for name in names if name.startswith(("/", "\\")) or ".." in Path(name).parts]
            if unsafe:
                raise AssertionError("unsafe APK ZIP path")
            corrupt = archive.testzip()
            if corrupt is not None:
                raise AssertionError(f"APK CRC failure: {corrupt}")
            native = {name for name in names if name.startswith("lib/") and not name.endswith("/")}
            if native != EXPECTED_NATIVE:
                raise AssertionError(f"native library set mismatch: {sorted(native)}")
            if any(not name.startswith("lib/arm64-v8a/") for name in native):
                raise AssertionError("non-arm64 native payload")
            engine_size, engine_hash = sha256_member(archive, "lib/arm64-v8a/libstockfish.so")
            if (engine_size, engine_hash) != (100_695_968, EXPECTED_ENGINE):
                raise AssertionError("embedded Stockfish identity mismatch")
            bundle_size, bundle_hash = sha256_member(archive, "assets/chess.html")
            if (bundle_size, bundle_hash) != (1_500_732, EXPECTED_BUNDLE):
                raise AssertionError("embedded chess.html identity mismatch")
            if archive.read("assets/chess.html") != bundle.read_bytes():
                raise AssertionError("embedded/source chess.html differ")
            if sha256_file(bundle) != EXPECTED_BUNDLE:
                raise AssertionError("source bundle hash mismatch")
            print(f"zip_entries={len(names)} crc_ok=true duplicate_entries=0")
            print(f"native_libraries={','.join(sorted(native))}")
            print(f"engine_bytes={engine_size}\nengine_sha256={engine_hash}")
            print(f"bundle_bytes={bundle_size}\nbundle_sha256={bundle_hash}")
        print(f"apk_bytes={private_apk.stat().st_size}")
        print(f"apk_sha256={sha256_file(private_apk)}")
        print("APK-V10-GATE OK: release, v1+v2+v3, certificate, version, SDK, ABI, baseline permissions, signing blocks, bundle and engine")
        print("HYPEROS3-STATIC-ONLY: no physical HyperOS 3 device test was performed")


if __name__ == "__main__":
    main()
