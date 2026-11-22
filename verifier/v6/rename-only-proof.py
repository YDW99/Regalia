#!/usr/bin/env python3
"""Prove that the three changed Java files differ only by declared renames."""
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]
RENAMES = {
    'src/main/java/com/Regalia/StockfishNative.java': [
        '_clearRestartInProgress', '_createEngineExecutor', '_safeExecute',
        '_compensateRacedStop', '_resetEngineRuntimeState',
        '_postJsCallbackDirect', '_callbackEventName', '_isHttpUrl',
    ],
    'src/main/java/com/Regalia/StatsActivity.java': [
        '_handleUrlOverride', '_applyImmersiveMode', '_applyLegacyImmersive',
    ],
    'src/main/java/com/Regalia/EngineService.java': [
        '_buildNotificationWithContent',
    ],
}
assert sum(map(len, RENAMES.values())) == 12
for rel, names in RENAMES.items():
    base = subprocess.check_output(['git', 'show', f'HEAD:{rel}'], cwd=ROOT).decode('utf-8')
    expected = base
    for old in names:
        new = old.lstrip('_')
        expected = re.sub(r'(?<![A-Za-z0-9_$])' + re.escape(old) + r'(?![A-Za-z0-9_$])', new, expected)
    if rel.endswith('/StatsActivity.java'):
        expected = expected.replace('StockfishNative._isHttpUrl', 'StockfishNative.isHttpUrl')
    actual = (ROOT / rel).read_text(encoding='utf-8')
    assert actual == expected, f'non-rename edit detected: {rel}'
    assert actual != base, f'no rename applied: {rel}'
print('RENAME-ONLY PROOF V2 OK: 12 methods, 3 files, no other byte changes')
