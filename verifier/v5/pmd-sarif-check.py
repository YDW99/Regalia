#!/usr/bin/env python3
"""Validate PMD SARIF totals and selected rule counts."""
from collections import Counter
from pathlib import Path
import json
import sys

if len(sys.argv) != 4:
    raise SystemExit('usage: pmd-sarif-check.py SARIF EXPECTED_TOTAL EXPECTED_NAMING')
path = Path(sys.argv[1])
expected_total = int(sys.argv[2])
expected_naming = int(sys.argv[3])
data = json.loads(path.read_text(encoding='utf-8'))
results = [r for run in data.get('runs', []) for r in run.get('results', [])]
counts = Counter(r.get('ruleId', '') for r in results)
assert len(results) == expected_total, (len(results), expected_total)
assert counts['MethodNamingConventions'] == expected_naming, counts['MethodNamingConventions']
print(f'PMD-SARIF OK: total={len(results)} MethodNamingConventions={counts["MethodNamingConventions"]}')
for rule in ('ControlStatementBraces', 'MethodNamingConventions', 'UnusedPrivateMethod', 'SingularField'):
    print(f'{rule}={counts[rule]}')
