#!/usr/bin/env python3
"""Deterministic negative tests for the round-72 shared verification primitives."""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
import hashlib
import io
import os
from pathlib import Path
import signal
import shutil
import stat
import subprocess
import sys
import tempfile
import time
from unittest import mock
import zipfile

import archive_scan
from archive_scan import ArchiveLimits, scan_archive
from secret_scan import SecretScanner
import source_archive
from source_archive import BinaryInspector, forbidden_name, payload_files

ROOT = Path(__file__).resolve().parents[2]
checks = 0


def passed(name: str) -> None:
    global checks
    checks += 1
    print(f"PASS V11-N{checks:02d}: {name}")


def expect_failure(call, forbidden: tuple[str, ...] = (), expected: str | None = None) -> str:
    """v1.2.3 round-79 (CodeRabbit PR#60 #14): fail for the EXPECTED reason.

    Any OSError / BadZipFile / AssertionError used to count as a pass — an I/O
    error reading the fixture would still report "digest rejected" /
    "depth exceeded". Callers now pass the expected diagnostic fragment; a
    failure whose message lacks it fails the test."""
    try:
        call()
    except (AssertionError, zipfile.BadZipFile, OSError) as exc:
        message = str(exc)
        for value in forbidden:
            if value in message:
                raise AssertionError("sensitive text leaked in a negative-test diagnostic")
        if expected is not None and expected not in message:
            raise AssertionError(f"negative fixture failed for an unexpected reason: {message}")
        return message
    raise AssertionError("negative fixture was accepted")


def nested_archive(payload_name: str, payload: bytes, depth: int = 5) -> bytes:
    data = payload
    name = payload_name
    for level in range(depth):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr(name, data)
        data = buffer.getvalue()
        name = f"level-{level}.zip"
    return data


def consume_all(chunks, _label: str, _name: str) -> None:
    for _chunk in chunks:
        pass


def test_wrapper() -> None:
    runs = ROOT / "verifier/runs"
    runs.mkdir(parents=True, exist_ok=True)
    before = set(runs.glob("*wrapper-negative*.log"))
    result = subprocess.run(
        ["bash", str(ROOT / "verifier/v11/run-and-log.sh"), "wrapper-negative"],
        cwd=ROOT, text=True, capture_output=True,
    )
    after = set(runs.glob("*wrapper-negative*.log"))
    if result.returncode == 0 or after != before or "usage:" not in result.stderr:
        raise AssertionError("missing command was not rejected without a success log")
    passed("missing command exits nonzero and creates no run record")

    failed = subprocess.run(
        ["bash", str(ROOT / "verifier/v11/run-and-log.sh"), "wrapper-negative", "sh", "-c", "exit 7"],
        cwd=ROOT, text=True, capture_output=True,
    )
    if failed.returncode != 7 or "exit_code=7" not in failed.stdout:
        raise AssertionError("wrapper failed to propagate a child failure")
    passed("child exit code is preserved in output and process status")

    with tempfile.TemporaryDirectory(prefix="v11-clock-") as temporary:
        fake_bin = Path(temporary)
        date = fake_bin / "date"
        date.write_text(
            "#!/bin/sh\ncase \"$2\" in\n"
            "  *%Y%m%d*) printf '20261122T235959Z\\n' ;;\n"
            "  *) printf '2026-11-22T23:59:59Z\\n' ;;\n"
            "esac\n", encoding="utf-8")
        date.chmod(0o755)
        env = dict(os.environ, PATH=str(fake_bin) + os.pathsep + os.environ["PATH"])
        label = f"wrapper-negative-concurrent-{os.getpid()}"

        def invoke(index: int):
            return subprocess.run(
                ["bash", str(ROOT / "verifier/v11/run-and-log.sh"),
                 label, "sh", "-c", f"printf 'run-{index}\\n'; exit {index % 3}"],
                cwd=ROOT, env=env, text=True, capture_output=True,
            )

        with ThreadPoolExecutor(max_workers=8) as executor:
            results = list(executor.map(invoke, range(1, 9)))
        if any(result.returncode != (index % 3) for index, result in enumerate(results, 1)):
            raise AssertionError("concurrent wrapper returned a wrong child status")
        logs = list(runs.glob(f"20261122T235959Z-{label}*.log"))
        if len(logs) != 8 or len({path.name for path in logs}) != 8:
            raise AssertionError("same-second logs were overwritten")
        contents = [path.read_text(encoding="utf-8") for path in logs]
        for index in range(1, 9):
            if sum(f"run-{index}\n" in content for content in contents) != 1:
                raise AssertionError("concurrent wrapper output was lost or duplicated")
    passed("eight same-second concurrent invocations retain eight independent logs")


def test_recursive_secrets() -> None:
    first = "V11-TEST-SENTINEL-ALPHA-7f91"
    second = "V11-TEST-SENTINEL-BETA-26c4"
    with mock.patch.dict(os.environ, {
        "RELEASE_KEYSTORE_PASSWORD": first,
        "RELEASE_KEY_PASSWORD": second,
    }):
        deep = nested_archive(f"member-{first}.txt", b"prefix-" + first.encode() + b"-suffix")
        scanner = SecretScanner()
        message = expect_failure(
            lambda: scanner.archive(io.BytesIO(deep), "opaque.fixture.secret"),
            forbidden=(first, second), expected="uploaded password match",
        )
        if "opaque.fixture.secret" not in message:
            raise AssertionError("opaque failure identifier missing")
        passed("five-level nested password is detected without path/member/value leakage")

        for codec in ("utf-16le", "utf-16be"):
            scanner = SecretScanner()
            deep = nested_archive("wide.bin", second.encode(codec))
            expect_failure(lambda: scanner.archive(io.BytesIO(deep), "opaque.fixture.wide"), forbidden=(first, second), expected="uploaded password match")
        passed("nested UTF-16LE/BE secret forms fail closed")

        secret_path = Path(ROOT) / f"uncreated-{first}.zip"
        scanner = SecretScanner()
        message = expect_failure(lambda: scanner.file(secret_path, "opaque.fixture.path"), forbidden=(first, second), expected="file read failed")
        if first in message:
            raise AssertionError("secret-bearing source path leaked")
        passed("file-open diagnostics do not copy secret-bearing paths")


def test_recursive_binaries() -> None:
    engine = b"round72 synthetic engine sentinel" * 17
    keystore = b"round72 synthetic keystore sentinel" * 19
    with mock.patch.object(source_archive, "ENGINE_SHA256", hashlib.sha256(engine).hexdigest()), \
         mock.patch.object(source_archive, "KEYSTORE_SHA256", hashlib.sha256(keystore).hexdigest()):
        for label, payload in (("engine", engine), ("keystore", keystore)):
            inspector = BinaryInspector()
            deep = nested_archive("payload.dat", payload)
            expect_failure(lambda: inspector.archive(io.BytesIO(deep), f"opaque.{label}"),
                            expected=f"{label} content detected")
            passed(f"five-level nested {label} digest is rejected")
    inspector = BinaryInspector()
    deep = nested_archive("payload.bin", b"\x7fELF" + b"\x00" * 31)
    expect_failure(lambda: inspector.archive(io.BytesIO(deep), "opaque.elf"), expected="ELF content detected")
    passed("five-level nested ELF magic is rejected")
    inspector = BinaryInspector()
    deep = nested_archive("src/main/jniLibs/README.txt", b"not an ELF and no forbidden suffix")
    expect_failure(lambda: inspector.archive(io.BytesIO(deep), "opaque.jnilibs"), expected="forbidden nested archive member")
    passed("nested src/main/jniLibs content is rejected independent of suffix")
    for name in ("src/main/jniLibs/file.dat", "SRC/MAIN/JNILIBS/file.txt", "x/src/main/JniLibs/nested/file"):
        if not forbidden_name(Path(name)):
            raise AssertionError("mixed-case jniLibs policy mismatch")
    passed("mixed-case jniLibs matching uses normalized path components")


def test_archive_limits() -> None:
    deep = nested_archive("payload.txt", b"A" * 64, depth=5)
    expect_failure(lambda: scan_archive(io.BytesIO(deep), consume_all, "opaque.depth",
                                        limits=ArchiveLimits(max_depth=2)),
                    expected="archive depth limit exceeded")
    passed("archive depth overflow fails closed")
    expect_failure(lambda: scan_archive(io.BytesIO(deep), consume_all, "opaque.member-size",
                                        limits=ArchiveLimits(max_member_bytes=16)),
                    expected="archive member size limit exceeded")
    passed("member-size limit fails closed")
    expect_failure(lambda: scan_archive(io.BytesIO(deep), consume_all, "opaque.total-size",
                                        limits=ArchiveLimits(max_total_bytes=128)),
                    expected="archive cumulative size limit exceeded")
    passed("cumulative decompressed-size limit fails closed")
    expect_failure(lambda: scan_archive(io.BytesIO(deep), consume_all, "opaque.members",
                                        limits=ArchiveLimits(max_members=2)),
                    expected="archive member limit exceeded")
    passed("archive member-count limit fails closed")

    corrupt = io.BytesIO()
    with zipfile.ZipFile(corrupt, "w") as archive:
        archive.writestr("broken.zip", b"PK-not-a-real-archive")
    corrupt.seek(0)
    expect_failure(lambda: scan_archive(corrupt, consume_all, "opaque.corrupt"),
                    expected="invalid nested archive")
    passed("corrupt archive-shaped nested member fails closed")


def test_walk_errors() -> None:
    def failing_walk(_root, onerror=None):
        error = PermissionError(13, "simulated unreadable directory")
        if onerror is not None:
            onerror(error)
        return iter(())

    with mock.patch.object(source_archive.os, "walk", failing_walk):
        expect_failure(lambda: payload_files(ROOT), expected="simulated unreadable directory")
    passed("directory traversal errors invoke onerror and abort payload enumeration")


def assert_interrupt_run(label: str, before_logs: set[Path], before_history: set[str],
                         process: subprocess.Popen, output: str, signal_name: str = "TERM") -> None:
    expected_status = {"HUP": 129, "INT": 130, "QUIT": 131, "TERM": 143}[signal_name]
    marker = f"child-before-{signal_name}\n"
    runs = ROOT / "verifier/runs"
    if (process.returncode != expected_status or f"exit_code={expected_status}" not in output
            or f"interrupted_by={signal_name}" not in output):
        raise AssertionError(f"{signal_name} did not produce an interrupted {expected_status} result")
    if marker not in output:
        raise AssertionError(f"{signal_name} discarded output produced before interruption")
    new_logs = set(runs.glob(f"*-{label}.*.log")) - before_logs
    if len(new_logs) != 1:
        raise AssertionError(f"{signal_name} did not preserve exactly one independent log")
    log = next(iter(new_logs))
    content = log.read_text(encoding="utf-8")
    if f"exit_code={expected_status}" not in content or marker not in content:
        raise AssertionError("interrupt log lacks status or pre-signal output")
    history = runs / "v11-history.tsv"
    # v1.2.3 round-80 (CodeRabbit PR#60 re-review): history rows are counted AS
    #   WRITTEN — the round-79 set comprehension folded two IDENTICAL appended
    #   rows into one element, so a wrapper that double-recorded this run still
    #   passed the ==1 uniqueness check. Rows are kept as a list (duplicates
    #   preserved), and only THIS case's rows are selected — by the FULL label
    #   field (TSV column 2), so other labels' concurrent rows stay ignored.
    after_lines = history.read_text(encoding="utf-8").splitlines() if history.is_file() else []
    new_rows = [line for line in after_lines if line not in before_history]
    label_rows = [line for line in new_rows
                  if len(line.split("\t")) >= 2 and line.split("\t")[1] == label]
    expected = f"\t{label}\t{expected_status}\t{log.relative_to(ROOT).as_posix()}"
    if len(label_rows) != 1 or expected not in label_rows[0]:
        raise AssertionError(f"interrupt history lacks the {expected_status} status or retained log path")


def assert_term_run(label: str, before_logs: set[Path], before_history: set[str],
                    process: subprocess.Popen, output: str) -> None:
    assert_interrupt_run(label, before_logs, before_history, process, output)


def test_wrapper_signal() -> None:
    runs = ROOT / "verifier/runs"
    label = f"wrapper-negative-term-{os.getpid()}"
    before_logs = set(runs.glob(f"*-{label}.*.log"))
    history = runs / "v11-history.tsv"
    before_history = set(history.read_text(encoding="utf-8").splitlines()) if history.is_file() else set()
    with tempfile.TemporaryDirectory(prefix="v11-term-") as temporary:
        ready = Path(temporary) / "ready"
        process = subprocess.Popen(
            ["bash", str(ROOT / "verifier/v11/run-and-log.sh"), label,
             "sh", "-c", "printf 'child-before-TERM\\n'; printf ready > \"$1\"; sleep 30",
             "sh", str(ready)],
            cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            start_new_session=True,
        )
        try:
            deadline = time.monotonic() + 10
            while not ready.is_file():
                if process.poll() is not None:
                    raise AssertionError("wrapper exited before the signal fixture became ready")
                if time.monotonic() > deadline:
                    raise AssertionError("timed out waiting for child output")
                time.sleep(0.02)
            os.killpg(process.pid, signal.SIGTERM)
            output = process.communicate(timeout=10)[0]
        finally:
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGKILL)
                process.communicate()
    assert_term_run(label, before_logs, before_history, process, output)
    passed("TERM preserves pre-signal output, history and exit status 143")


def test_wrapper_only_signal() -> None:
    runs = ROOT / "verifier/runs"
    label = f"wrapper-only-negative-term-{os.getpid()}"
    before_logs = set(runs.glob(f"*-{label}.*.log"))
    history = runs / "v11-history.tsv"
    before_history = set(history.read_text(encoding="utf-8").splitlines()) if history.is_file() else set()
    with tempfile.TemporaryDirectory(prefix="v11-wrapper-only-term-") as temporary:
        ready = Path(temporary) / "ready"
        child_pid_file = Path(temporary) / "child.pid"
        process = subprocess.Popen(
            ["bash", str(ROOT / "verifier/v11/run-and-log.sh"), label,
             "sh", "-c",
             "printf 'child-before-TERM\\n'; printf '%s' \"$$\" > \"$1\"; "
             "printf ready > \"$2\"; exec sleep 30",
             "sh", str(child_pid_file), str(ready)],
            cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            start_new_session=True,
        )
        try:
            deadline = time.monotonic() + 10
            while not ready.is_file():
                if process.poll() is not None:
                    raise AssertionError("wrapper exited before the wrapper-only fixture became ready")
                if time.monotonic() > deadline:
                    raise AssertionError("timed out waiting for wrapper-only child output")
                time.sleep(0.02)
            # Deliberately signal only Bash, not its process group or child.
            os.kill(process.pid, signal.SIGTERM)
            output = process.communicate(timeout=5)[0]
        finally:
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGKILL)
                process.communicate()
        child_pid = int(child_pid_file.read_text(encoding="ascii"))
    try:
        os.kill(child_pid, 0)
    except ProcessLookupError:
        pass
    else:
        raise AssertionError("wrapper-only TERM left its child running or unreaped")
    assert_term_run(label, before_logs, before_history, process, output)
    passed("wrapper-only TERM promptly terminates and reaps the child before finalizing evidence")


def assert_process_gone(pid: int, description: str) -> None:
    deadline = time.monotonic() + 2
    while True:
        try:
            os.kill(pid, 0)
        except ProcessLookupError:
            return
        if time.monotonic() >= deadline:
            raise AssertionError(f"{description} is still running or unreaped")
        time.sleep(0.02)


def test_wrapper_descendant_signal() -> None:
    runs = ROOT / "verifier/runs"
    label = f"wrapper-descendant-negative-term-{os.getpid()}"
    before_logs = set(runs.glob(f"*-{label}.*.log"))
    history = runs / "v11-history.tsv"
    before_history = set(history.read_text(encoding="utf-8").splitlines()) if history.is_file() else set()
    with tempfile.TemporaryDirectory(prefix="v11-descendant-term-") as temporary:
        ready = Path(temporary) / "ready"
        child_pid_file = Path(temporary) / "child.pid"
        descendant_pid_file = Path(temporary) / "descendant.pid"
        process = subprocess.Popen(
            ["bash", str(ROOT / "verifier/v11/run-and-log.sh"), label,
             "bash", "-c",
             "printf 'child-before-TERM\\n'; printf '%s' \"$$\" > \"$1\"; "
             "sleep 30 & descendant=$!; printf '%s' \"$descendant\" > \"$2\"; "
             "printf ready > \"$3\"; wait",
             "bash", str(child_pid_file), str(descendant_pid_file), str(ready)],
            cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            start_new_session=True,
        )
        child_pid = descendant_pid = None
        try:
            deadline = time.monotonic() + 10
            while not ready.is_file():
                if process.poll() is not None:
                    raise AssertionError("wrapper exited before the descendant fixture became ready")
                if time.monotonic() > deadline:
                    raise AssertionError("timed out waiting for descendant fixture")
                time.sleep(0.02)
            child_pid = int(child_pid_file.read_text(encoding="ascii"))
            descendant_pid = int(descendant_pid_file.read_text(encoding="ascii"))
            isolated_group = (os.getpgid(child_pid) == child_pid and
                              os.getpgid(child_pid) != os.getpgid(process.pid))
            os.kill(process.pid, signal.SIGTERM)
            output = process.communicate(timeout=8)[0]
            # Assert wrapper cleanup before the fallback can hide a leak.
            assert_process_gone(child_pid, "direct child")
            assert_process_gone(descendant_pid, "non-exec descendant")
            if not isolated_group:
                raise AssertionError("command lacked an isolated process group")
        finally:
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGKILL)
                process.communicate()
            for pid in (child_pid, descendant_pid):
                if pid is not None:
                    try:
                        os.kill(pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
    assert_term_run(label, before_logs, before_history, process, output)
    passed("wrapper-only TERM terminates the isolated group including non-exec descendants")


def test_wrapper_term_refusal() -> None:
    runs = ROOT / "verifier/runs"
    label = f"wrapper-stubborn-negative-term-{os.getpid()}"
    before_logs = set(runs.glob(f"*-{label}.*.log"))
    history = runs / "v11-history.tsv"
    before_history = set(history.read_text(encoding="utf-8").splitlines()) if history.is_file() else set()
    with tempfile.TemporaryDirectory(prefix="v11-stubborn-term-") as temporary:
        ready = Path(temporary) / "ready"
        child_pid_file = Path(temporary) / "child.pid"
        process = subprocess.Popen(
            ["bash", str(ROOT / "verifier/v11/run-and-log.sh"), label,
             "bash", "-c",
             "trap '' TERM; printf 'child-before-TERM\\n'; printf '%s' \"$$\" > \"$1\"; "
             "printf ready > \"$2\"; while :; do sleep 1; done",
             "bash", str(child_pid_file), str(ready)],
            cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            start_new_session=True,
        )
        child_pid = None
        try:
            deadline = time.monotonic() + 10
            while not ready.is_file():
                if process.poll() is not None:
                    raise AssertionError("wrapper exited before the TERM-refusal fixture became ready")
                if time.monotonic() > deadline:
                    raise AssertionError("timed out waiting for TERM-refusal fixture")
                time.sleep(0.02)
            child_pid = int(child_pid_file.read_text(encoding="ascii"))
            os.kill(process.pid, signal.SIGTERM)
            output = process.communicate(timeout=8)[0]
            # A stubborn child must be gone before fallback cleanup runs.
            assert_process_gone(child_pid, "TERM-refusing child")
        finally:
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGKILL)
                process.communicate()
            if child_pid is not None:
                try:
                    os.kill(child_pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
    assert_term_run(label, before_logs, before_history, process, output)
    passed("bounded TERM grace escalates to KILL and preserves interrupted evidence")


def test_wrapper_orphan_term_refusal() -> None:
    runs = ROOT / "verifier/runs"
    label = f"wrapper-orphan-stubborn-negative-term-{os.getpid()}"
    before_logs = set(runs.glob(f"*-{label}.*.log"))
    history = runs / "v11-history.tsv"
    before_history = set(history.read_text(encoding="utf-8").splitlines()) if history.is_file() else set()
    with tempfile.TemporaryDirectory(prefix="v11-orphan-stubborn-term-") as temporary:
        base = Path(temporary)
        ready = base / "ready"
        child_pid_file = base / "child.pid"
        descendant_pid_file = base / "descendant.pid"
        stubborn = base / "stubborn.py"
        stubborn.write_text(
            "import os, signal, sys, time\n"
            "from pathlib import Path\n"
            "signal.signal(signal.SIGHUP, signal.SIG_IGN)\n"
            "signal.signal(signal.SIGTERM, signal.SIG_IGN)\n"
            "Path(sys.argv[1]).write_text(str(os.getpid()), encoding='ascii')\n"
            "Path(sys.argv[2]).write_text('ready', encoding='ascii')\n"
            "while True: time.sleep(1)\n", encoding="utf-8")
        parent = base / "parent.py"
        parent.write_text(
            "import os, signal, subprocess, sys, time\n"
            "from pathlib import Path\n"
            "signal.signal(signal.SIGHUP, signal.SIG_IGN)\n"
            "signal.signal(signal.SIGTERM, lambda *_: os._exit(0))\n"
            "print('child-before-TERM', flush=True)\n"
            "child = subprocess.Popen([sys.executable, sys.argv[1], sys.argv[3], sys.argv[4]])\n"
            "Path(sys.argv[2]).write_text(str(os.getpid()), encoding='ascii')\n"
            "Path(sys.argv[3]).write_text(str(child.pid), encoding='ascii')\n"
            "while True: time.sleep(1)\n", encoding="utf-8")
        process = subprocess.Popen(
            ["bash", str(ROOT / "verifier/v11/run-and-log.sh"), label,
             sys.executable, str(parent), str(stubborn), str(child_pid_file),
             str(descendant_pid_file), str(ready)],
            cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            start_new_session=True,
        )
        child_pid = descendant_pid = None
        try:
            deadline = time.monotonic() + 10
            while not ready.is_file():
                if process.poll() is not None:
                    raise AssertionError("wrapper exited before the stubborn orphan became ready")
                if time.monotonic() > deadline:
                    raise AssertionError("timed out waiting for stubborn orphan fixture")
                time.sleep(0.02)
            child_pid = int(child_pid_file.read_text(encoding="ascii"))
            descendant_pid = int(descendant_pid_file.read_text(encoding="ascii"))
            os.kill(process.pid, signal.SIGTERM)
            output = process.communicate(timeout=8)[0]
            # The parent accepts TERM; its stubborn descendant still requires KILL.
            assert_process_gone(child_pid, "TERM-accepting direct child")
            assert_process_gone(descendant_pid, "orphaned TERM-refusing descendant")
        finally:
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGKILL)
                process.communicate()
            if child_pid is not None:
                try:
                    os.killpg(child_pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
            for pid in (child_pid, descendant_pid):
                if pid is not None:
                    try:
                        os.kill(pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
    assert_term_run(label, before_logs, before_history, process, output)
    passed("watchdog remains armed until KILL after the direct child leaves a stubborn orphan")


def test_wrapper_startup_signal() -> None:
    runs = ROOT / "verifier/runs"
    label = f"wrapper-startup-negative-term-{os.getpid()}"
    before_logs = set(runs.glob(f"*-{label}.*.log"))
    history = runs / "v11-history.tsv"
    before_history = set(history.read_text(encoding="utf-8").splitlines()) if history.is_file() else set()
    real_setsid = shutil.which("setsid")
    if real_setsid is None:
        raise AssertionError("setsid is required for the startup-signal regression")
    with tempfile.TemporaryDirectory(prefix="v11-startup-term-") as temporary:
        base = Path(temporary)
        fake_bin = base / "bin"
        fake_bin.mkdir()
        child_pid_file = base / "child.pid"
        shim = fake_bin / "setsid"
        shim.write_text(
            "#!/bin/bash\n"
            "printf 'child-before-TERM\\n'\n"
            "printf '%s' \"$$\" > \"$R76_CHILD_PID_FILE\"\n"
            f"exec {real_setsid} \"$@\"\n", encoding="utf-8")
        shim.chmod(0o755)
        # Inject TERM immediately before CHILD_PID=$!, after the launch but before
        # the assignment. The wait for the shim PID makes this window deterministic.
        debug_env = base / "bash-env"
        debug_env.write_text(
            "trap '\n"
            "if [[ $BASH_COMMAND == \"CHILD_PID=\\$!\" ]]; then\n"
            "  trap - DEBUG\n"
            "  while [ ! -s \"$R76_CHILD_PID_FILE\" ]; do :; done\n"
            "  kill -TERM \"$$\"\n"
            "fi\n"
            "' DEBUG\n", encoding="utf-8")
        env = dict(os.environ, PATH=str(fake_bin) + os.pathsep + os.environ["PATH"],
                   BASH_ENV=str(debug_env), R76_CHILD_PID_FILE=str(child_pid_file))
        process = subprocess.Popen(
            ["bash", str(ROOT / "verifier/v11/run-and-log.sh"), label,
             "bash", "-c", "exec sleep 30"],
            cwd=ROOT, env=env, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            start_new_session=True,
        )
        child_pid = None
        try:
            output = process.communicate(timeout=8)[0]
            child_pid = int(child_pid_file.read_text(encoding="ascii"))
            assert_process_gone(child_pid, "command signaled before PID assignment")
        finally:
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGKILL)
                process.communicate()
            if child_pid is None and child_pid_file.is_file():
                child_pid = int(child_pid_file.read_text(encoding="ascii"))
            if child_pid is not None:
                try:
                    os.killpg(child_pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                try:
                    os.kill(child_pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
    assert_term_run(label, before_logs, before_history, process, output)
    passed("a signal before CHILD_PID assignment is deferred and still cleans the command")


def test_wrapper_group_quit() -> None:
    runs = ROOT / "verifier/runs"
    label = f"wrapper-group-negative-quit-{os.getpid()}"
    before_logs = set(runs.glob(f"*-{label}.*.log"))
    history = runs / "v11-history.tsv"
    before_history = set(history.read_text(encoding="utf-8").splitlines()) if history.is_file() else set()
    with tempfile.TemporaryDirectory(prefix="v11-group-quit-") as temporary:
        ready = Path(temporary) / "ready"
        child_pid_file = Path(temporary) / "child.pid"
        process = subprocess.Popen(
            ["bash", str(ROOT / "verifier/v11/run-and-log.sh"), label,
             "sh", "-c",
             "printf 'child-before-QUIT\\n'; printf '%s' \"$$\" > \"$1\"; "
             "printf ready > \"$2\"; exec sleep 30",
             "sh", str(child_pid_file), str(ready)],
            cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            start_new_session=True,
        )
        child_pid = None
        try:
            deadline = time.monotonic() + 10
            while not ready.is_file():
                if process.poll() is not None:
                    raise AssertionError("wrapper exited before the QUIT fixture became ready")
                if time.monotonic() > deadline:
                    raise AssertionError("timed out waiting for QUIT fixture")
                time.sleep(0.02)
            child_pid = int(child_pid_file.read_text(encoding="ascii"))
            # The isolated command is not in this group; the wrapper must forward it.
            os.killpg(process.pid, signal.SIGQUIT)
            output = process.communicate(timeout=8)[0]
            assert_process_gone(child_pid, "command after process-group QUIT")
        finally:
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGKILL)
                process.communicate()
            if child_pid is not None:
                try:
                    os.killpg(child_pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                try:
                    os.kill(child_pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
    assert_interrupt_run(label, before_logs, before_history, process, output, "QUIT")
    passed("process-group QUIT triggers isolated cleanup and preserves status 131")


def test_leading_data_nested_secret() -> None:
    secret = "V11-TEST-SENTINEL-SHEBANG-71c2"
    inner = io.BytesIO()
    with zipfile.ZipFile(inner, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("compressed-note.txt", b"prefix-" + secret.encode() + b"-suffix")
    prefixed_zip = b"#!/bin/sh\n# leading data before a valid ZIP\nexit 0\n" + inner.getvalue()
    outer = io.BytesIO()
    with zipfile.ZipFile(outer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("payload.dat", prefixed_zip)
    with mock.patch.dict(os.environ, {
        "RELEASE_KEYSTORE_PASSWORD": secret,
        "RELEASE_KEY_PASSWORD": "V11-TEST-SENTINEL-OTHER-18d3",
    }):
        scanner = SecretScanner()
        message = expect_failure(
            lambda: scanner.archive(io.BytesIO(outer.getvalue()), "opaque.fixture.shebang"),
            forbidden=(secret, "payload.dat", "compressed-note.txt"),
            expected="uploaded password match",
        )
    if "uploaded password match" not in message:
        raise AssertionError("leading-data nested ZIP did not reach the secret scanner")
    passed("non-ZIP suffix and leading data cannot hide a compressed password")


def test_archive_member_preflights() -> None:
    # v1.2.3 round-79 (CodeRabbit PR#60 #10) + round-80 (re-review): the
    #   central directory is bounded BEFORE zipfile parses it. The fixture is
    #   built FIRST, then the module's ZipFile constructor is watched: a scan
    #   that parses the directory before rejecting would materialize it
    #   first, so the rejection must fire with the constructor never called.
    #   The error-text assertion is retained so another early failure is not
    #   mistaken for the pass.
    data = io.BytesIO()
    with zipfile.ZipFile(data, "w") as archive:
        archive.writestr("member.txt", b"x" * 64)
    zip_spy = mock.Mock(
        side_effect=AssertionError("zipfile.ZipFile must not run for a preflight rejection"))
    with mock.patch.object(archive_scan.zipfile, "ZipFile", zip_spy):
        expect_failure(lambda: scan_archive(io.BytesIO(data.getvalue()), consume_all, "opaque.cd",
                                            limits=ArchiveLimits(max_central_directory_bytes=16)),
                       expected="central directory size limit")
    if zip_spy.call_count != 0:
        raise AssertionError("central-directory rejection happened after zipfile parsing")
    passed("oversized central directory is rejected before zipfile parses it")

    # v1.2.3 round-79 (CodeRabbit PR#60 #11): duplicate DIRECTORY entries are
    #   rejected exactly like duplicate files.
    duplicate = io.BytesIO()
    with zipfile.ZipFile(duplicate, "w") as archive:
        archive.writestr("dup/", b"")
        archive.writestr("dup/", b"")
    expect_failure(lambda: scan_archive(io.BytesIO(duplicate.getvalue()), consume_all, "opaque.duplicate-dir"),
                    expected="duplicate archive member")
    passed("duplicate directory entries are rejected like files")

    # v1.2.3 round-79 (CodeRabbit PR#60 #12): a directory entry that carries
    #   payload bytes is rejected after path/encryption validation.
    weird = io.BytesIO()
    with zipfile.ZipFile(weird, "w") as archive:
        archive.writestr("payload-dir/", b"payload")
    expect_failure(lambda: scan_archive(io.BytesIO(weird.getvalue()), consume_all, "opaque.directory-payload"),
                    expected="directory member with payload")
    passed("directory entries carrying payload bytes are rejected")


def test_directory_member_budget() -> None:
    directories = io.BytesIO()
    with zipfile.ZipFile(directories, "w") as archive:
        for name in ("a/", "b/", "c/"):
            archive.writestr(name, b"")
    expect_failure(lambda: scan_archive(io.BytesIO(directories.getvalue()), consume_all,
                                        "opaque.directories", limits=ArchiveLimits(max_members=2)),
                    expected="archive member count")
    budget = scan_archive(io.BytesIO(directories.getvalue()), consume_all,
                          "opaque.directories", limits=ArchiveLimits(max_members=3))
    if budget.members != 3 or budget.bytes != 0:
        raise AssertionError("in-budget directory entries were not counted correctly")
    passed("directory entries consume member budget and valid directories pass")


def test_license_budget_order() -> None:
    with tempfile.TemporaryDirectory(prefix="v11-license-order-") as temporary:
        root = Path(temporary)
        with zipfile.ZipFile(root / "LICENSE&NOTICE.zip", "w") as archive:
            archive.writestr("LICENSE&NOTICE/test.txt", "synthetic test bytes\n")
        with mock.patch.object(source_archive.BinaryInspector, "archive",
                               side_effect=AssertionError("bounded license sentinel")) as bounded, \
             mock.patch.object(source_archive.zipfile.ZipFile, "testzip") as crc:
            message = expect_failure(lambda: source_archive.protected_license_metadata(root),
                                    expected="bounded license sentinel")
        if "bounded license sentinel" not in message or not bounded.called or crc.called:
            raise AssertionError("license CRC decompression ran before the bounded scanner")
    passed("protected license budget scan precedes CRC decompression")


def main() -> None:
    test_wrapper()
    test_wrapper_signal()
    test_wrapper_only_signal()
    test_wrapper_descendant_signal()
    test_wrapper_term_refusal()
    test_wrapper_orphan_term_refusal()
    test_wrapper_startup_signal()
    test_wrapper_group_quit()
    test_recursive_secrets()
    test_leading_data_nested_secret()
    test_recursive_binaries()
    test_archive_limits()
    test_archive_member_preflights()
    test_directory_member_budget()
    test_license_budget_order()
    test_walk_errors()
    assert checks == 30, checks
    print(f"V11-NEGATIVE-PRIMITIVES OK: {checks}/{checks}")


if __name__ == "__main__":
    main()
