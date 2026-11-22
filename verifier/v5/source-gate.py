#!/usr/bin/env python3
"""Historical v5 gate: intentionally preserved with its invalid key assumption."""
from pathlib import Path
p = Path(__file__).resolve().parents[2] / 'version.properties'
text = p.read_text(encoding='utf-8')
assert 'VERSION_CODE=10203' in text and 'VERSION_NAME=1.2.3' in text
print('SOURCE-V5-GATE OK')
