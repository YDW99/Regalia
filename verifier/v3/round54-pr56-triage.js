// round-54 verifier: GitHub PR #56 AI-review triage acceptance checks.
// Structural assertions over the round-54 worktree:
//   (G1) build.gradle: a present-but-incomplete version.properties (missing or
//        blank VERSION_* key) counts as the fallback state;
//   (G2) game-logic.js: all four engineGo/engineGoNewGame dispatch-failure
//        branches (timed + untimed) reschedule doAIMove (cap 3, then ai_timeout);
//        round-55: doAIMove() is the SINGLE _aiRetryCount owner — no catch-side
//        increment (the round-54 ++ double-counted a failed dispatch so the
//        retry never re-dispatched);
//   (G3) ui-interactions.js: dlgChess960SPID reset sentinel is -1, not null;
//   (G4) ai-bridge.js: batch notification shows the current batch's completed
//        count (_reviewAnalyzeStep+1); openStatsPage re-checks the payload size
//        after dropping visualAnnotations (clipboard fallback);
//   (G5) stats.html: en-passant FEN target requires an opposing victim pawn;
//        explicit onStatsPGNFileError callback + pgn_read_failed i18n;
//   (G6) EngineProcessManager.java: timed Process.waitFor routed through
//        waitForBounded (API 26+ gate);
//   (G7) SafPickerHelper.java + StatsActivity.java: CR-aware chunked line
//        counting (prevWasCr folds CRLF pairs);
//   (G8) EngineService.java: wake lock setReferenceCounted(false) before
//        publication + acquire;
//   (G9) JsBridgeGateway/StockfishNative/FileIoHelper/ai-bridge.js: the
//        isPathBrowsable browse gate wiring, getDefaultPaths filesDir, and the
//        SAF-picker escape in the settings file browser.
//   (H1) round-55: StockfishNative.getParentPath gates the RESOLVED parent
//        ("" when the parent escapes the browsable set — JS treats "" as
//        "no parent", hiding the ".." button at a whitelisted root);
//   (H2) round-55: README.license per-file tags agree with the file headers
//        (no "(AGPL v3)" tags on GPL v3 files — CodeRabbit PR56 follow-up);
//   (H3) round-55: this script resolves paths from __dirname (like v1/v2),
//        not the process cwd.
// Run from anywhere: node verifier/v3/round54-pr56-triage.js
// (paths resolve relative to this script, not the caller's cwd)
//
// Copyright (C) 2026 Regalia
//
// AI-GEN: AI assisted
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.

'use strict';
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log('PASS', name); }
  else { fail++; console.log('FAIL', name); }
}
function read(p) {
  // round-55 (PR56 CR follow-up): resolve from this script's location like
  //   v1/v2 do — process.cwd() made every file report MISSING when the
  //   verifier was launched from any directory other than the repo root.
  const f = path.join(__dirname, '..', '..', p);
  if (!fs.existsSync(f)) { console.log('MISSING', p); fail++; return ''; }
  return fs.readFileSync(f, 'utf8');
}

// G1 — build.gradle
const bg = read('build.gradle');
ok('G1a requiredVersionKeys present', bg.includes("requiredVersionKeys"));
ok('G1b missing/blank key treated as fallback',
   /usingFallbackVersion\s*=\s*requiredVersionKeys\.any/.test(bg));
ok('G1c versionCode/Name derivation untouched (10203 contract)',
   bg.includes('Math.max(versionBuild, versionMajor * 10000 + versionMinor * 100 + versionPatch)'));

// G2 — game-logic.js AI retry
const gl = read('src/main/assets/chess.src/game-logic.js');
const goFallbacks = gl.match(/catch\(error\)\{[\s\S]{0,1600}?setTimeout\(\(\)=>\{if\(!gameOver&&gameState\.currentTurn!==playerColor\)doAIMove\(\);\},500\)/g) || [];
ok('G2a timed engineGo fallback reschedules doAIMove (both throw branches)',
   goFallbacks.length >= 2);
ok('G2b untimed engineGo branches reschedule doAIMove',
   (gl.match(/catch\(e\)\{console\.error\('engineGo(?:NewGame)? error:'[\s\S]{0,400}?doAIMove\(\);\},500\)/g) || []).length === 2);
ok('G2c retry counter NOT incremented in catch branches (round-55 single-counter)',
   (gl.match(/^\s*_aiRetryCount\+\+\s*;?\s*$/gm) || []).length === 1);
ok('G2d doAIMove keeps its entry increment + >=3 give-up cap',
   /_aiRetryCount\+\+;\s*\n\s*if\(_aiRetryCount>=3\)\{[\s\S]{0,300}?ai_timeout/.test(gl));

// G3 — Chess960 sentinel
const ui = read('src/main/assets/chess.src/ui-interactions.js');
ok('G3a dlgChess960SPID reset to -1', ui.includes('dlgChess960=false;dlgChess960SPID=-1;'));
ok('G3b no dlgChess960SPID=null reset remains', !ui.includes('dlgChess960SPID=null'));

// G4 — ai-bridge.js
const ab = read('src/main/assets/chess.src/ai-bridge.js');
ok('G4a notification uses per-batch completed count (_reviewAnalyzeStep)',
   // round-54b: _reviewAnalyzeStep is same-module (ai-bridge.js ~388) — the
   //   direct undefined comparison replaced the copy-pasted typeof guard.
   /_bgDone=\(_reviewAnalyzeStep!==undefined/.test(ab));
ok('G4b cache size no longer feeds the progress notification',
   !/analyzing_progress'\)\+'\('\+\s*_bgCached/.test(ab));
ok('G4c openStatsPage re-checks payload after annotation drop',
   /visualAnnotationsTruncated:true\}\);[\s\S]{0,700}?payload\.length>900\*1024[\s\S]{0,400}?safeCopyToClipboard\(pgn/.test(ab));

// G5 — stats.html
const st = read('src/main/assets/stats.html');
ok('G5a en-passant victim-pawn validation present',
   /_epVictim=board\[er\+pd\]\[ec\]/.test(st) && /_epVictim\.type==='pawn'&&_epVictim\.color!==currentTurn/.test(st));
ok('G5b explicit PGN failure callback exists',
   /function onStatsPGNFileError\(\)/.test(st));
ok('G5c pgn_read_failed i18n entry (zh+en)',
   /'pgn_read_failed':\{zh:'[^']+',en:'[^']+'\}/.test(st));

// G6 — EngineProcessManager.java
const epm = read('src/main/java/com/Regalia/EngineProcessManager.java');
ok('G6a waitForBounded helper present with API-26 gate',
   /private static void waitForBounded\(Process p\) throws InterruptedException \{\s*if \(Build\.VERSION\.SDK_INT >= 26\)/.test(epm));
ok('G6b no raw timed waitFor calls outside the waitForBounded helper',
   (() => {
     const helperIdx = epm.indexOf('private static void waitForBounded');
     if (helperIdx < 0) return false;
     const withoutHelper = epm.slice(0, helperIdx);
     return !/\.waitFor\(\s*\d/.test(withoutHelper);
   })());
ok('G6c both call sites routed through waitForBounded',
   (epm.match(/waitForBounded\(p2?\);/g) || []).length === 2);
ok('G6d no dangling Javadoc (round-54b, S8491) — every /** attaches to a declaration',
   (() => {
     const blocks = epm.match(/\/\*\*[\s\S]*?\*\//g) || [];
     return blocks.every(b => {
       const after = epm.slice(epm.indexOf(b) + b.length, epm.indexOf(b) + b.length + 400);
       return /^\s*(?:@\w+\s+)*(?:public|private|protected|static|final|class|void|int|long|boolean|String)[\s]/.test(after);
     });
   })());
ok('G6e S7741 — no typeof _reviewAnalyzeStep guard (same-module binding)',
   !/typeof _reviewAnalyzeStep/.test(ab));

// G7 — CR-aware line counting
// round-62 (dedup): the prevWasCr CR/LF/CRLF counting loop moved from
//   SafPickerHelper.readPgnFromUri / StatsActivity's inline import into
//   FileIoHelper.readCappedText (single implementation — see V2-25). The
//   sentinel now guards BOTH the surviving implementation (G7a) AND the
//   wiring of the PGN callers (G7b) — stronger than the old per-file
//   textual-presence check: a caller that silently regressed to an
//   uncapped/naive read would fail G7b even though G7a still passes.
const fioG7 = read('src/main/java/com/Regalia/FileIoHelper.java');
const safG7 = read('src/main/java/com/Regalia/SafPickerHelper.java');
const saG7 = read('src/main/java/com/Regalia/StatsActivity.java');
ok('G7a FileIoHelper.readCappedText: prevWasCr CR/LF/CRLF counting (sole implementation)',
   fioG7.includes('prevWasCr')
   && /chunk\[i\] == '\\n'\) \{\s*if \(!prevWasCr\) lineCount\+\+;/.test(fioG7.replace(/\s+/g, ' ').replace(/\\n/g, '\\n'))
   && fioG7.includes("chunk[i] == '\\r'"));
ok('G7b SafPickerHelper + StatsActivity wired to the shared CR-aware reader',
   /FileIoHelper\.readCappedText\(context\.getContentResolver\(\), uri,\s*\n\s*PGN_MAX_CHARS, PGN_MAX_LINES/.test(safG7)
   && /FileIoHelper\.readCappedText\(getContentResolver\(\), uri,\s*\n\s*MAX_CHARS, MAX_LINES/.test(saG7));

// G8 — EngineService.java wake lock
const es = read('src/main/java/com/Regalia/EngineService.java');
ok('G8a setReferenceCounted(false) before acquire in acquireEngineWakeLock',
   (() => {
     const i = es.indexOf('private static synchronized void acquireEngineWakeLock');
     if (i < 0) return false;
     const body = es.slice(i, i + 1500);
     return body.indexOf('setReferenceCounted(false)') > -1
         && body.indexOf('setReferenceCounted(false)') < body.indexOf('wl.acquire(30L');
   })());

// G9 — file browser gate
const jg = read('src/main/java/com/Regalia/JsBridgeGateway.java');
const sn = read('src/main/java/com/Regalia/StockfishNative.java');
const fio = read('src/main/java/com/Regalia/FileIoHelper.java');
ok('G9a isPathBrowsable gate present', /public boolean isPathBrowsable\(String path\)/.test(jg));
ok('G9b listFiles uses browse gate', /listFiles\(String dirPath\)[\s\S]{0,900}?isPathBrowsable\(dirPath\)/.test(sn));
ok('G9c getParentPath uses browse gate', /getParentPath\(String path\)[\s\S]{0,600}?isPathBrowsable\(path\)/.test(sn));
ok('G9d read/write still on strict sandbox',
   (sn.match(/isPathInSandbox/g) || []).length >= 2);
ok('G9e getDefaultPaths carries filesDir', fio.includes('paths.put("filesDir"'));
ok('G9f JS browser: no hardcoded /sdcard entry buttons, SAF button present',
   !ab.includes("_fileBrowserGoTo('/sdcard')") && ab.includes('settings_saf_button'));
ok('G9g settings i18n entries (zh+en)',
   /'settings_saf_button':\{zh:'[^']+',en:'[^']+'\}/.test(gl)
   && /'settings_saf_hint':\{zh:'[^']+',en:'[^']+'\}/.test(gl));

// H — round-55 (PR56 CodeRabbit follow-up email triage)
// H1 — getParentPath gates the RESOLVED parent (no escape-to-"[]" navigation)
ok('H1a getParentPath re-gates the resolved parent',
   /String parent = _fileIoHelper\.getParentPath\(path\);[\s\S]{0,800}?!_jsBridgeGateway\.isPathBrowsable\(parent\)[\s\S]{0,120}?return ""/.test(sn));
// H2 — README.license per-file tags agree with the file headers
const csr = read('src/main/assets/chess.src/README.license');
const jlr = read('src/main/java/com/Regalia/README.license');
ok('H2a chess.src ledger: no AGPL tag on GPL-classified modules',
   !/- (?:ai-bridge|ui-interactions|game-logic|pgn-standard|ui|worker-pool|tablebase)\.js \(AGPL/.test(csr)
   && !/- index\.html\.tpl \(AGPL/.test(csr));
ok('H2b java ledger: no AGPL tag on GPL-classified classes',
   !/- (?:EngineProcessManager|StockfishNative|JsBridgeGateway|FileIoHelper|SafPickerHelper|StatsActivity)\.java \(AGPL/.test(jlr)
   && !/SafPickerHelper\.java \+ StatsActivity\.java \(AGPL/.test(jlr));
// H2c/d — round-55 audit addendum: pin the 12 residual fixes across the
//   other recording locations (NOTICE + src/main + src/main/assets ledgers)
const nt = read('NOTICE');
const sml = read('src/main/README.license');
const sal = read('src/main/assets/README.license');
ok('H2c NOTICE: no live AGPL tags on GPL-classified files (StatsActivity/HapticManager/index.html.tpl)',
   !/StatsActivity\.java \(AGPL/.test(nt)
   && !/HapticManager\.java`? \(AGPL/.test(nt)
   && !/index\.html\.tpl \(AGPL/.test(nt));
ok('H2d src/main + assets ledgers: game-logic/pgn-standard not tagged AGPL',
   !/game-logic\.js \(AGPL/.test(sml) && !/pgn-standard\.js \(AGPL/.test(sml)
   && !/game-logic\.js \(AGPL/.test(sal) && !/pgn-standard\.js \(AGPL/.test(sal));
ok('H2e README.md: strict UTF-8 + round-55 section + license lists present',
   (() => {
     const rm = read('README.md');
     return rm.includes('### Round-55 update')
         && rm.includes('### GPL v3 Files') && rm.includes('### AGPL v3 Files')
         && rm.includes('License audit addendum');
   })());

// H2f — round-61 (R61-a): the REVERSE direction of the H2a/H2b sweeps.
//   H2a/b only guarded "GPL-classified files must not be tagged AGPL"; the
//   three round-58c/60 entries tagged MainActivity / EngineService /
//   StabilizationHelper — all AGPL v3 classes per the round-56 classification
//   list — as (GPL v3), and every existing checker was blind to the opposite
//   direction (the one-way-sentinel lesson, guide §6.2 #12: every "must not
//   be mislabeled" check has to be enumerated in BOTH directions).
ok('H2f reverse license sweep: no (GPL v3) tag on AGPL-classified classes/modules',
   !/- (?:MainActivity|ChessWebViewClient|EngineService|StabilizationHelper|ChessApp|TlsSecurityHelper|RootDetector)\.java \(GPL/.test(jlr)
   && !/- (?:chess960|eco-data|state-store)\.js \(GPL/.test(csr));

// V3-38 — round-60 (F-2): the recovery guide's §1 privacy line must describe
//   the real network posture (offline-first + the certificate-pinned Lichess
//   tablebase probe), never the stale "无网络权限" claim that contradicts the
//   manifest's INTERNET permission.
// round-61 (R61-b) fail-open fix: the guide lives outside the repo (session
//   scratch), so "absent" is the ONLY case that may skip. Before this, a
//   PRESENT guide with a missing privacy row, an unreadable file, or stale
//   wording all silently PASSED — three states conflated into one skip, i.e.
//   a fail-open sentinel is no sentinel (guide §6.2 #13). Now: absent →
//   skip; present-but-broken → FAIL. The guide path is configurable via the
//   REGALIA_V338_GUIDE_PATH env var (path.delimiter-separated candidate list,
//   first existing entry wins) so CI machines and new sandboxes can point
//   the sentinel at their own copy instead of relying on the legacy
//   /mnt/agents/temp default that only exists in the original sandbox.
ok('V3-38 guide §1 privacy line accurate (skip only when guide absent)',
   (() => {
     const cands = (process.env.REGALIA_V338_GUIDE_PATH || '')
       .split(path.delimiter).filter(Boolean);
     cands.push('/mnt/agents/temp/Regalia v1.2.3 开发进度恢复指南Pro.md');
     const gp = cands.find(p => fs.existsSync(p));
     if (!gp) return true; // absent everywhere → the only legitimate skip
     let g;
     try {
       g = fs.readFileSync(gp, 'utf8'); // unreadable present guide → FAIL below
     } catch (e) {
       console.warn('V3-38: guide present but unreadable (' + gp + '): ' + e.message);
       return false;
     }
     const row = g.split('\n').find(l => l.startsWith('| 隐私 |'));
     if (!row) return false; // present guide, missing privacy row → FAIL
     return row.includes('残局库') && !row.includes('无网络权限');
   })());
// V3-39 — round-63 (PR #57 CodeRabbit follow-up): the round-62 negative-test
//   script is the "guardian of the guardians" — if it fails open, all six
//   58b sentinels it verifies go naked silently. The four reviewed defects
//   (hardcoded sandbox paths, no trap recovery, no failure accumulation,
//   tail masking node's exit status) were each a §6.2 #13 recurrence
//   ("a fail-open verifier is no verifier") at the meta layer. This sentinel
//   pins the fixed properties permanently (methodology §2.7, round-63):
//   (a) no absolute sandbox paths — the root must self-resolve from the
//       script location;
//   (b) trap-based mutation recovery (EXIT/INT/TERM) over an exclusive
//       mktemp backup;
//   (c) failure accumulation with a real exit gate — mutated=no or
//       NOT-RED must fail the run;
//   (d) pipefail, so `node | tail` cannot mask node's exit status;
//   (e) the verifier README.license points at the committed script path
//       and carries no phantom sandbox-tree reference (the CR#1 fix).
ok('V3-39 r62-negative-tests.sh self-discipline (self-resolved root, trap recovery, exclusive backup, accumulated failures, real exit codes)',
   (() => {
     const s = read('verifier/runs/r62-negative-tests.sh');
     const vl = read('verifier/README.license');
     if (!s || !vl) return false;
     return !s.includes('/home/')
       && s.includes('BASH_SOURCE')
       && s.includes('mktemp')
       && /trap\s+'[^']*'\s+EXIT/.test(s)
       && /trap\s+'[^']*'\s+INT/.test(s)
       && /trap\s+'[^']*'\s+TERM/.test(s)
       && s.includes('FAILED=$((FAILED+1))')
       && s.includes('set -o pipefail')
       && s.includes('[ "$FAILED" -gt 0 ]')
       && vl.includes('verifier/runs/r62-negative-tests.sh')
       && !vl.includes('scripts/r62-negative-tests.sh');
   })());
// H3 — path resolution is __dirname-based (like v1/v2), not cwd-based
ok('H3 verifier resolves from __dirname (cwd-independent)',
   read('verifier/v3/round54-pr56-triage.js').includes("path.join(__dirname, '..', '..'"));

console.log('\n===== RESULT: ' + pass + ' passed, ' + fail + ' failed =====');
process.exit(fail === 0 ? 0 : 1);
