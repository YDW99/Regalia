#!/bin/bash
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

# Build chess.html from source modules
# Merges all .js files from chess.src/ into index.html.tpl

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC_DIR="$SCRIPT_DIR/src/main/assets/chess.src"
TPL="$SRC_DIR/index.html.tpl"
OUT="$SCRIPT_DIR/src/main/assets/chess.html"

python3 -c "
import sys, re

src_dir = '$SRC_DIR'
tpl_path = '$TPL'
out_path = '$OUT'

# Read template
with open(tpl_path, 'r') as f:
    template = f.read()

# Build combined JS - order matters!
js_parts = []
module_order = ['game-logic.js', 'chess960.js', 'pgn-standard.js', 'worker-pool.js', 'ai-bridge.js', 'tablebase.js', 'eco-data.js', 'ui.js']
for mod in module_order:
    with open(f'{src_dir}/{mod}', 'r') as f:
        js_parts.append(f.read())

# Combine with newlines
combined_js = '\n'.join(js_parts)

# Strip export statements (not needed in bundled file)
combined_js = re.sub(r'^export \{[^}]*\}', '', combined_js, flags=re.MULTILINE)
combined_js = re.sub(r'^export default\s+', '', combined_js, flags=re.MULTILINE)

# Replace placeholder with combined JS (EXACT string match, no glob)
placeholder = '/* __MODULE_SCRIPTS__ */'
result = template.replace(placeholder, combined_js, 1)

# Write output
with open(out_path, 'w') as f:
    f.write(result)

# Stats
lines = result.count('\n') + 1
bytes_len = len(result.encode('utf-8'))
print(f'Built chess.html ({lines} lines, {bytes_len} bytes)')
"
