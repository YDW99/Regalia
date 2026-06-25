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
import os, re

SRC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "src", "main", "assets", "chess.src")
TPL = os.path.join(SRC_DIR, "index.html.tpl")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "src", "main", "assets", "chess.html")

with open(TPL, 'r') as f:
    template = f.read()

# Build the combined JS - order matters!
modules = [
    "game-logic.js",
    "chess960.js",
    "pgn-standard.js",
    "worker-pool.js",
    "ai-bridge.js",
    "tablebase.js",
    "eco-data.js",
    "ui.js",
]

js_parts = []
for mod in modules:
    path = os.path.join(SRC_DIR, mod)
    with open(path, 'r') as f:
        content = f.read()
    # Strip export statements (not needed in bundled file)
    content = re.sub(r'^export\s*\{[^}]*\}\s*;?\s*$', '', content, flags=re.MULTILINE)
    content = re.sub(r'^export\s+default\s+.*$', '', content, flags=re.MULTILINE)
    js_parts.append(content)

combined_js = "\n".join(js_parts)

# Replace ONLY the exact placeholder (not partial matches in JS code)
placeholder = "/* __MODULE_SCRIPTS__ */"
# We need to replace only the placeholder inside the <script> tag
# Find it in the template and replace
result = template.replace(placeholder, combined_js, 1)

with open(OUT, 'w') as f:
    f.write(result)

line_count = result.count('\n') + 1
byte_count = len(result.encode('utf-8'))
print(f"Built chess.html ({line_count} lines, {byte_count} bytes)")
