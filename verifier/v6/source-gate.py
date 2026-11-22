#!/usr/bin/env python3
"""Round-71 source gate, v6: correct four-component version parsing."""
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]
checks = 0

def check(name, condition):
    global checks
    checks += 1
    if not condition:
        raise AssertionError(name)
    print(f'PASS {checks:02d}: {name}')

def text(rel):
    return (ROOT / rel).read_text(encoding='utf-8')

def head(rel):
    return subprocess.check_output(['git', 'show', f'HEAD:{rel}'], cwd=ROOT).decode('utf-8')

codeql = text('.github/workflows/codeql.yml')
check('CodeQL c-cpp no-build coverage', bool(re.search(r'- language: c-cpp\s+build-mode: none', codeql)))
check('CodeQL checkout credentials disabled', 'persist-credentials: false' in codeql)
check('tracked native sources acknowledged', all(s in codeql for s in ('src/main/cpp/engine_jni.cpp', 'CMakeLists.txt')))
check('MobSF scanner pinned', 'pip install mobsfscan==1.2.0' in text('.github/workflows/mobsf.yml'))
dependabot = text('.github/dependabot.yml')
check('Dependabot ecosystems and schedules', all(s in dependabot for s in (
    'package-ecosystem: gradle', 'package-ecosystem: github-actions', 'interval: weekly',
    'day: monday', 'timezone: Asia/Shanghai', 'default-days: 7')))
mode = subprocess.check_output(['git', 'ls-files', '-s', 'gradlew'], cwd=ROOT, text=True).split()[0]
check('gradlew executable index mode', mode == '100755')
pmd = text('config/pmd-ruleset.xml')
check('project PMD ruleset preserved', 'rulesets/java/quickstart.xml' in pmd and '<exclude name="ControlStatementBraces"/>' in pmd)
build_files = ('build.gradle', 'settings.gradle', 'gradle.properties', 'gradle/wrapper/gradle-wrapper.properties')
check('unchanged build dependencies and configuration', all(text(rel) == head(rel) for rel in build_files))
check('protected license archive', (ROOT / 'LICENSE&NOTICE.zip').stat().st_size == 56011)
build = text('build.gradle')
check('SDK/NDK contract', all(s in build for s in ('compileSdk 35', 'minSdk 23', 'targetSdk 35', 'ndkVersion "27.2.12479018"')))
version = text('version.properties')
components = {k: int(v) for k, v in re.findall(r'(?m)^(VERSION_(?:MAJOR|MINOR|PATCH|BUILD))=(\d+)$', version)}
computed_code = max(components.get('VERSION_BUILD', 0), components.get('VERSION_MAJOR', 0) * 10000 + components.get('VERSION_MINOR', 0) * 100 + components.get('VERSION_PATCH', 0))
version_name = f"{components.get('VERSION_MAJOR')}.{components.get('VERSION_MINOR')}.{components.get('VERSION_PATCH')}"
check('version contract', computed_code == 10203 and version_name == '1.2.3')
check('arm64-only ABI', build.count("abiFilters 'arm64-v8a'") == 1 and 'armeabi-v7a' not in re.sub(r'//.*', '', build))
permission_re = re.compile(r'<uses-permission\s+android:name="([^"]+)"')
check('permissions unchanged', permission_re.findall(text('src/main/AndroidManifest.xml')) == permission_re.findall(head('src/main/AndroidManifest.xml')))
ledger = text('src/main/java/com/Regalia/README.license')
round71 = ledger.split('v1.2.3 round-68', 1)[0]
agpl = ('ChessApp', 'ChessWebViewClient', 'EngineService', 'MainActivity', 'RootDetector', 'StabilizationHelper', 'TlsSecurityHelper')
gpl = ('EngineConfigHelper', 'EngineHealthMonitor', 'EngineProcessManager', 'EngineSettingsHelper', 'FileIoHelper', 'HapticManager', 'JsBridgeGateway', 'PermissionHelper', 'PgnCacheManager', 'SafPickerHelper', 'StatsActivity', 'StockfishNative')
check('AGPL seven-file ledger', 'AGPL v3 (7)' in round71 and all(name in round71 for name in agpl))
check('GPL twelve-file ledger', 'GPL v3 (12)' in round71 and all(name in round71 for name in gpl))
check('mixed license correction', 'java/*.java (15 files, Mixed AGPL v3 and GPL v3; see per-file ledger)' in text('src/main/README.license'))
mobsf = text('src/main/java/.mobsf')
active = [line for line in mobsf.splitlines() if line.strip() and not line.lstrip().startswith('#')]
check('MobSF comment-only config and review boundary', not active and all(s in mobsf for s in ('postJsCallbackDirect', 'callbackEventName', 'already marked statement', 'PV moves', '0/259')))
old_names = ('_clearRestartInProgress', '_createEngineExecutor', '_safeExecute', '_compensateRacedStop', '_resetEngineRuntimeState', '_postJsCallbackDirect', '_callbackEventName', '_isHttpUrl', '_handleUrlOverride', '_applyImmersiveMode', '_applyLegacyImmersive', '_buildNotificationWithContent')
changed_java = ''.join(text(f'src/main/java/com/Regalia/{name}.java') for name in ('StockfishNative', 'StatsActivity', 'EngineService'))
check('old Java identifiers absent', not any(re.search(r'(?<![A-Za-z0-9_$])' + re.escape(name) + r'(?![A-Za-z0-9_$])', changed_java) for name in old_names))
check('no unrelated Java edits', set(subprocess.check_output(['git', 'diff', '--name-only', 'HEAD', '--', 'src/main/java/com/Regalia'], cwd=ROOT, text=True).splitlines()) == {
    'src/main/java/com/Regalia/StockfishNative.java', 'src/main/java/com/Regalia/StatsActivity.java',
    'src/main/java/com/Regalia/EngineService.java', 'src/main/java/com/Regalia/README.license'})
check('round-70 audit erratum appended', 'round-71 ERRATUM' in text('verifier/runs/round70-audit.md'))
check('recovery honesty record', 'NOT represented as surviving' in text('verifier/runs/recovery-round71.md'))
tracked = subprocess.check_output(['git', 'ls-files'], cwd=ROOT, text=True).splitlines()
forbidden_tracked = [p for p in tracked if p.startswith('src/main/jniLibs/') or p.endswith('libstockfish.so') or p.lower().endswith(('.jks', '.keystore')) or p in ('keystore-info.txt', 'keystore.properties', 'local.properties')]
check('no engine or signing material tracked', not forbidden_tracked)
assert checks == 22, checks
print('SOURCE-V5-GATE OK (22 checks) [historical label retained in v6 script]')
