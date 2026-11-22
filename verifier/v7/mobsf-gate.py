#!/usr/bin/env python3
"""Round-71 MobSF current/stripped dual-SARIF acceptance gate."""
from pathlib import Path
from collections import Counter
import json
import os
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
if len(sys.argv) != 3:
    raise SystemExit('usage: mobsf-gate.py CURRENT.sarif STRIPPED.sarif')
assert shutil.which('mobsfscan') and shutil.which('semgrep'), 'scanner executable missing'
version = subprocess.run(['mobsfscan', '--version'], text=True, capture_output=True, check=True)
version_text = (version.stdout + version.stderr).strip()
assert '1.2.0' in version_text, version_text

def load(path):
    data = json.loads(Path(path).read_text(encoding='utf-8'))
    runs = data.get('runs', [])
    assert runs, 'SARIF has no runs'
    for run in runs:
        invocations = run.get('invocations', [])
        assert invocations, 'missing invocation evidence'
        for inv in invocations:
            assert inv.get('executionSuccessful') is True, 'scanner execution was not successful'
            for key in ('toolExecutionNotifications', 'toolConfigurationNotifications'):
                errors = [n for n in inv.get(key, []) if n.get('level') == 'error']
                assert not errors, f'driver errors: {errors}'
    return [r for run in runs for r in run.get('results', [])]

def loc(result):
    physical = result['locations'][0]['physicalLocation']
    uri = physical['artifactLocation']['uri'].replace('\\', '/')
    uri = uri.removeprefix('file://')
    region = physical['region']
    return uri, (region['startLine'], region.get('endLine', region['startLine']))

current = load(sys.argv[1])
stripped = load(sys.argv[2])
current_rules = Counter(r.get('ruleId', '') for r in current)
stripped_rules = Counter(r.get('ruleId', '') for r in stripped)
assert len(current) == 8, len(current)
assert current_rules['android_logging'] == 0, current_rules
assert stripped_rules['android_logging'] == 259, stripped_rules
for rule, count in current_rules.items():
    assert stripped_rules[rule] == count, (rule, count, stripped_rules[rule])

markers = []
for path in (ROOT / 'src/main/java').rglob('*.java'):
    for number, line in enumerate(path.read_text(encoding='utf-8').splitlines(), 1):
        if 'mobsf-ignore: android_logging' in line:
            markers.append((str(path.relative_to(ROOT)), number))
assert len(markers) == 223, len(markers)
active = [line for line in (ROOT / 'src/main/java/.mobsf').read_text(encoding='utf-8').splitlines()
          if line.strip() and not line.lstrip().startswith('#')]
assert not active, active

expected = {
    ('StockfishNative.java', (1242, 1262)),
    ('StockfishNative.java', (1251, 1262)),
    ('StockfishNative.java', (1252, 1262)),
    ('StockfishNative.java', (1253, 1262)),
    ('EngineSettingsHelper.java', (202, 254)),
    ('EngineSettingsHelper.java', (222, 229)),
    ('EngineSettingsHelper.java', (223, 229)),
    ('FileIoHelper.java', (247, 252)),
}
spans = {(Path(uri).name, span) for r in stripped if r.get('ruleId') == 'android_logging'
         for uri, span in [loc(r)]}
missing = expected - spans
assert not missing, f'missing disputed spans: {sorted(missing)}'
print(f'MOBSF-V7-GATE OK: version=1.2.0 markers={len(markers)} current_total={len(current)} current_logging=0 stripped_logging={stripped_rules["android_logging"]}')
