#!/usr/bin/env python3
"""Download the single APK link in a real Chromium page and verify its identity."""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
from pathlib import Path

from playwright.async_api import async_playwright


async def download(url: str, output: Path) -> dict:
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
            await item.save_as(str(output))
            failure = await item.failure()
            if failure is not None:
                raise AssertionError(f"browser download failed: {failure}")
            digest = hashlib.sha256()
            with output.open("rb") as stream:
                for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                    digest.update(chunk)
            return {
                "page_title": await page.title(),
                "suggested_filename": item.suggested_filename,
                "download_url": item.url,
                "saved_bytes": output.stat().st_size,
                "saved_sha256": digest.hexdigest(),
                "failure": failure,
            }
        finally:
            await browser.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("url")
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    result = asyncio.run(download(args.url, args.output))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if (result["saved_bytes"], result["saved_sha256"]) != (
        81_552_289,
        "644919d57c690b54c56b26ed0ce91ec785d67a68e8e58eeaa6aed2946a5533fb",
    ):
        raise AssertionError("browser-downloaded APK identity mismatch")
    print("BROWSER-DOWNLOAD-V11 OK")


if __name__ == "__main__":
    main()
