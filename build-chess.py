#!/usr/bin/env python3
# Copyright (C) 2026 Regalia
#
# AI-GEN: AI assisted
# This code was AI-assisted and has been reviewed for AGPL v3 compliance.
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program. If not, see <https://www.gnu.org/licenses/>.

"""Build chess.html from source modules - merges all .js files from chess.src/ into index.html.tpl"""
import os, re, sys

SRC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "src", "main", "assets", "chess.src")
TPL = os.path.join(SRC_DIR, "index.html.tpl")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "src", "main", "assets", "chess.html")


def main():
    # v1.1.2 Phase 67 (MED-3): wrap all file I/O in try/except for clearer build diagnostics.
    try:
        with open(TPL, 'r', encoding='utf-8') as f:
            template = f.read()
    except FileNotFoundError:
        print(f"ERROR: template not found: {TPL}", file=sys.stderr)
        sys.exit(1)
    except OSError as e:
        print(f"ERROR: cannot read template {TPL}: {e}", file=sys.stderr)
        sys.exit(1)

    # Build the combined JS - order matters!
    # v1.2.0 Phase 74/75: Added state-store.js, ui-board.js, ui-review.js,
    #   ui-audio.js, ui-toolbar.js (God Module split + global state store)
    modules = [
        "game-logic.js",
        "chess960.js",
        "pgn-standard.js",
        "worker-pool.js",
        "state-store.js",      # v1.2.0 Phase 75: global state store (must be before ui*.js)
        "ai-bridge.js",
        "tablebase.js",
        "eco-data.js",
        "ui-audio.js",         # v1.2.0 Phase 74: audio utilities
        "ui-board.js",         # v1.2.0 Phase 74: board rendering utilities
        "ui-review.js",        # v1.2.0 Phase 74: review mode utilities
        "ui-toolbar.js",       # v1.2.0 Phase 74: toolbar utilities
        "ui.js",               # main UI (uses the above modules)
    ]

    js_parts = []
    for mod in modules:
        path = os.path.join(SRC_DIR, mod)
        try:
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
        except FileNotFoundError:
            print(f"ERROR: module not found: {path}", file=sys.stderr)
            sys.exit(1)
        except OSError as e:
            print(f"ERROR: cannot read module {path}: {e}", file=sys.stderr)
            sys.exit(1)
        # Strip export statements (not needed in bundled file)
        content = re.sub(r'^export\s*\{[^}]*\}\s*;?\s*$', '', content, flags=re.MULTILINE)
        content = re.sub(r'^export\s+default\s+.*$', '', content, flags=re.MULTILINE)
        js_parts.append(content)

    combined_js = "\n".join(js_parts)

    # Replace ONLY the exact placeholder (not partial matches in JS code)
    placeholder = "/* __MODULE_SCRIPTS__ */"
    if placeholder not in template:
        print(f"ERROR: placeholder {placeholder!r} not found in template {TPL}", file=sys.stderr)
        sys.exit(2)
    result = template.replace(placeholder, combined_js, 1)

    try:
        with open(OUT, 'w', encoding='utf-8') as f:
            f.write(result)
    except OSError as e:
        print(f"ERROR: cannot write output {OUT}: {e}", file=sys.stderr)
        sys.exit(1)

    line_count = result.count('\n') + 1
    byte_count = len(result.encode('utf-8'))
    print(f"Built chess.html ({line_count} lines, {byte_count} bytes)")

    # v1.1.2 Phase 69 (Bug 4): Auto-fix stats.html CSP hash. stats.html has an
    # inline <script> whose SHA-256 must match the 'sha256-...' in the CSP
    # <meta> tag. If the script changes but the hash isn't updated, the browser
    # refuses to execute it → stats page blank. We compute the actual hash and
    # update the CSP tag automatically so this can't break again.
    stats_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "src", "main", "assets", "stats.html")
    try:
        with open(stats_path, 'r', encoding='utf-8') as f:
            stats_content = f.read()
        stats_scripts = re.findall(r'<script[^>]*>([\s\S]*?)</script>', stats_content)
        if stats_scripts:
            import hashlib, base64
            actual_hash = 'sha256-' + base64.b64encode(
                hashlib.sha256(stats_scripts[0].encode('utf-8')).digest()
            ).decode('ascii')
            csp_pattern = r"(script-src ')(sha256-[A-Za-z0-9+/=]+)(')"
            m = re.search(csp_pattern, stats_content)
            if m and m.group(2) != actual_hash:
                new_stats = stats_content[:m.start(2)] + actual_hash + stats_content[m.end(2):]
                with open(stats_path, 'w', encoding='utf-8') as f:
                    f.write(new_stats)
                print(f"Updated stats.html CSP hash to {actual_hash}")
    except Exception as e:
        print(f"WARN: stats.html CSP hash update failed: {e}", file=sys.stderr)


if __name__ == '__main__':
    main()

