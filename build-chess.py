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
    # v1.2.1 (round-4 cleanup): Removed ui-audio.js, ui-board.js, ui-review.js,
    #   ui-toolbar.js — these were Phase-74 extracts that duplicated inline logic
    #   in ui.js / ai-bridge.js with subtly different conventions (rank order,
    #   move classification, audio state). They were never on the hot path and
    #   keeping them created two sources of truth.
    modules = [
        "game-logic.js",
        "chess960.js",
        "pgn-standard.js",
        "worker-pool.js",
        "state-store.js",      # v1.2.0 Phase 75: global state store (must be before ui.js)
        "ai-bridge.js",
        "tablebase.js",
        "eco-data.js",
        # v1.2.3 (God Class round-17): ui.js split — interaction handlers and
        #   game-flow/clock logic extracted into two global-scope modules.
        #   Concatenation order is safe: all extracted units are pure function
        #   declarations (hoisted bundle-wide); no top-level executable code
        #   was moved, so no TDZ/load-order change.
        "ui-gameflow.js",      # v1.2.3: game start + game-clock subsystem
        "ui-interactions.js",  # v1.2.3: clicks, move exec, toolbar, dialogs, back-press
        "ui.js",               # main UI (inline ChessAudioEngine + board rendering)
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

    # v1.2.3 round-13 (P2): removed the stats.html CSP sha256 hash auto-update
    #   block. As of stats.html v1.1.2 PHASE 71, the CSP switched from a fixed
    #   sha256- hash to 'unsafe-inline' (stats.html line ~41: script-src
    #   'unsafe-inline' blob:). The regex `csp_pattern` never matched, so the
    #   block was silent dead code providing no protection. If a future policy
    #   reverts to hash-based CSP, the block can be re-added at that time.


if __name__ == '__main__':
    main()

