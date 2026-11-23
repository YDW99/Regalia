#!/usr/bin/env python3
"""Download the single APK link in a real Chromium page and verify its identity."""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
from pathlib import Path
import tempfile

from playwright.async_api import async_playwright


async def download(url: str, output: Path) -> dict:
    # v1.2.3 round-80 (CodeRabbit PR#60 re-review): the temporary's ownership
    #   scope covers BOTH the browser AND the Playwright teardown. Round-79
    #   handed the temp path to main() from inside the inner try — a failure
    #   in the finally's browser.close() escaped the inner except, download()
    #   never returned, and the downloaded temp file stayed behind where
    #   main() could not clean it. The path is only handed over after both
    #   teardown steps succeed; any teardown failure deletes the temp first.
    temp_path: Path | None = None
    result: dict | None = None
    try:
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(
                executable_path=os.environ.get("CHROMIUM_EXECUTABLE", "/usr/bin/chromium"),
                headless=True,
                args=["--no-sandbox"],
            )
            try:
                page = await browser.new_page(accept_downloads=True)
                page.set_default_timeout(240_000)
                response = await page.goto(url, wait_until="networkidle", timeout=60_000)
                if response is None or response.status != 200:
                    raise AssertionError("download page did not return HTTP 200")
                link = page.locator("a[download]")
                if await link.count() != 1:
                    raise AssertionError("download page must contain exactly one download link")
                async with page.expect_download(timeout=240_000) as event:
                    await link.click()
                item = await event.value
                # v1.2.3 round-79 (CodeRabbit PR#60 #13): the download goes to a UNIQUE
                #   temporary file in the target directory first — save_as() used to
                #   overwrite the target directly, and a page returning the WRONG
                #   file destroyed a previously correct APK while the identity check
                #   afterwards merely reported the mismatch. Only when BOTH the size
                #   and SHA-256 match is the temporary atomically moved onto the
                #   target (done by main); a mismatch cleans the temporary up.
                fd, temp_name = tempfile.mkstemp(prefix=output.name + ".tmp-", dir=output.parent)
                os.close(fd)
                temp_path = Path(temp_name)
                try:
                    await item.save_as(str(temp_path))
                    failure = await item.failure()
                    if failure is not None:
                        raise AssertionError(f"browser download failed: {failure}")
                    digest = hashlib.sha256()
                    with temp_path.open("rb") as stream:
                        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                            digest.update(chunk)
                    result = {
                        "page_title": await page.title(),
                        "suggested_filename": item.suggested_filename,
                        "download_url": item.url,
                        "saved_bytes": temp_path.stat().st_size,
                        "saved_sha256": digest.hexdigest(),
                        "failure": failure,
                        "temp_path": str(temp_path),
                    }
                except BaseException:
                    temp_path.unlink(missing_ok=True)
                    temp_path = None
                    raise
            finally:
                # v1.2.3 round-80 (CodeRabbit): browser teardown lives INSIDE the
                #   temp-file ownership scope — a close() failure removes the
                #   temporary and propagates instead of orphaning it.
                try:
                    await browser.close()
                except BaseException:
                    if temp_path is not None:
                        temp_path.unlink(missing_ok=True)
                    raise
        return result
    except BaseException:
        # Covers the Playwright context exit as well: if __aexit__ raises
        # after browser.close() succeeded, the temporary is still removed
        # before the exception escapes download().
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)
        raise


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("url")
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    result = asyncio.run(download(args.url, args.output))
    temp_path = Path(result.pop("temp_path"))
    # v1.2.3 round-80 (CodeRabbit PR#60 re-review): the JSON output moved
    #   INSIDE the temporary's cleanup scope — printing before the try let a
    #   disk-full print failure strand the fully downloaded temporary in the
    #   output directory. The existing target stays untouched either way;
    #   the temporary must not leak. Identity check and replacement stay in
    #   the same scope (round-79 #13 semantics preserved).
    try:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        # v1.2.3 round-79 (CodeRabbit PR#60 #13): the target is replaced ONLY when
        #   the downloaded bytes carry the approved identity; any other download
        #   leaves the existing target untouched and its temporary is removed.
        if (result["saved_bytes"], result["saved_sha256"]) != (
            81_552_289,
            "644919d57c690b54c56b26ed0ce91ec785d67a68e8e58eeaa6aed2946a5533fb",
        ):
            raise AssertionError("browser-downloaded APK identity mismatch")
        os.replace(temp_path, args.output)
        print("BROWSER-DOWNLOAD-V11 OK")
    finally:
        temp_path.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
