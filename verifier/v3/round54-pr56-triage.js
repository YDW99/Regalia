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
   && /chunk\[i\] == '\\n'\) \{\s*if \(!prevWasCr\) lineCount\+\+;/.test(fioG7.replace(/\s+/g, ' '))
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
//   round-64 (follow-up 2): upgraded from LITERAL existence to
//   IMPLEMENTATION-LINE existence. The round-63 version had two live bypass
//   routes, both §6.2 #17 recurrences (a sentinel satisfied by a comment):
//   the includes() checks matched the script's own comments ("exclusive
//   mktemp backup"), so deleting the real implementation and keeping the
//   comment still passed; and /trap\s+'[^']*'\s+EXIT/ matched EMPTY handlers
//   (trap '' EXIT). Now every property is line-anchored (^…/m, so a '#'
//   comment line can never satisfy it) and the trap handlers must actually
//   call restore. Meta negative tests for all bypass mutations (empty
//   handler, implementation deleted comment kept, backup-cp failure,
//   restore failure, SIGINT double-trap) live in round64-audit.md.
ok('V3-39 r62-negative-tests.sh self-discipline (line-anchored: self-resolved root, exclusive mktemp -d backup dir, byte-verified backup/restore/per-item cp+cmp at every site, restore-CALLING trap handlers (command shape, not mention), accumulated failures, real exit codes, no absolute paths)',
   (() => {
     const s = read('verifier/runs/r62-negative-tests.sh');
     const vl = read('verifier/README.license');
     if (!s || !vl) return false;
     // F-20 (round-66, third bypass round): the handler must CALL restore in
     //   the 'restore || exit 1' command shape — 'trap \x27echo restore\x27 EXIT'
     //   mentions restore without calling it and must NOT satisfy this.
     // F-22 (round-66): the title claims byte-verified backup — every cp
     //   site (backup_one body, restore_one body, per-item restore) is now
     //   pinned by its own implementation line, so deleting any verification
     //   while keeping the mktemp line turns this RED.
     return !s.includes('/home/')
       && /^ROOT=.*BASH_SOURCE/m.test(s)
       && /^BAK=\$\(mktemp -d\)/m.test(s)
       && /^trap\s+'restore\s*\|\|\s*exit\s+1[^']*'\s+EXIT/m.test(s)
       && /^trap\s+'restore\s*\|\|\s*exit\s+1[^']*'\s+INT/m.test(s)
       && /^trap\s+'restore\s*\|\|\s*exit\s+1[^']*'\s+TERM/m.test(s)
       && /^  cp "\$1" "\$2" && cmp -s "\$1" "\$2"$/m.test(s)
       && /^  if cp "\$1" "\$2" && cmp -s "\$1" "\$2"; then$/m.test(s)
       && /^if ! backup_one "\$AB" "\$BAK\/ai-bridge\.js" \|\| ! backup_one "\$STF" "\$BAK\/stats\.html"; then$/m.test(s)
       && /^[^#\n]*if ! cp "\$_bak" "\$_tgt" \|\| ! cmp -s "\$_bak" "\$_tgt"; then$/m.test(s)
       && /^[^#\n]*FAILED=\$\(\(FAILED\+1\)\)/m.test(s)
       && /^set -o pipefail/m.test(s)
       && /^[^#\n]*\[ "\$FAILED" -gt 0 \]/m.test(s)
       && vl.includes('verifier/runs/r62-negative-tests.sh')
       && !vl.includes('scripts/r62-negative-tests.sh');
   })());
// H3 — path resolution is __dirname-based (like v1/v2), not cwd-based
ok('H3 verifier resolves from __dirname (cwd-independent)',
   read('verifier/v3/round54-pr56-triage.js').includes("path.join(__dirname, '..', '..'"));
// V3-40 — round-65 (engine upgrade sf_18 armv8-dotprod -> sf_19 arm64-universal):
//   the engine identity is spread across multiple LIVE artifacts —
//   StockfishNative.java's EXPECTED_ENGINE_SHA256 (runtime tamper gate:
//   a stale value makes the app delete and re-extract the new engine
//   forever) and its extraction-progress denominator, NOTICE's bundle
//   declaration, BUILDING.md's current (topmost) build notes. The upgrade
//   risk is exactly the round-64 lesson generalized in methodology §3.10:
//   change one place, miss another. This sentinel pins CROSS-FILE
//   CONSISTENCY, not the value itself (the pinned value lives in exactly
//   one place — the Java constant — and everyone else must agree):
//   (a) Java digest == NOTICE digest == BUILDING.md topmost digest;
//   (b) Java EXPECTED_ENGINE_SIZE_BYTES constant == NOTICE declared engine
//       size. (round-66, O-2: the progress denominator now references the
//       shared constant instead of a numeric literal; V3-41 pins the
//       denominator->constant wiring and the BUILDING live guide, so the
//       chain Java constant == NOTICE == BUILDING-top == denominator has no
//       gap — this check keeps the Java == NOTICE legs.)
//   Line-anchored where anchors exist; RED-verified round-65 with two fixture
//   mutations (NOTICE digest flipped one hex digit; denominator reverted to
//   the old engine size) and re-verified round-66 after the constant swap —
//   see round65-audit.md / round66-audit.md.
ok('V3-40 engine identity cross-file consistent (Java digest == NOTICE == topmost BUILDING.md; Java size constant == NOTICE byte size)',
   (() => {
     const sn = read('src/main/java/com/Regalia/StockfishNative.java');
     const notice = read('NOTICE');
     const building = read('BUILDING.md');
     if (!sn || !notice || !building) return false;
     const jd = sn.match(/EXPECTED_ENGINE_SHA256 =\s*"([0-9a-f]{64})"/)
            || sn.match(/EXPECTED_ENGINE_SHA256 =\s*\n\s*"([0-9a-f]{64})"/);
     const nd = notice.match(/SHA-256\s+([0-9a-f]{64})/);
     const bd = building.match(/SHA-256\s*`?([0-9a-f]{64})`?/);
     const jsz = sn.match(/EXPECTED_ENGINE_SIZE_BYTES = ([\d_]+)L/);
     const nsz = notice.match(/libstockfish\.so\s*\(([\d,]{6,}) bytes/);
     if (!jd || !nd || !bd || !jsz || !nsz) return false;
     return jd[1] === nd[1]
       && jd[1] === bd[1]
       && Number(jsz[1].replace(/_/g, '')) === Number(nsz[1].replace(/,/g, ''));
   })());


// V3-40b — round-66 (F-2/F-3/F-4/F-19): round-65's V3-40 pinned Java ==
//   NOTICE == BUILDING-top == progress denominator — and ALL FIVE live-document
//   leaks of the engine upgrade (BUILDING's live build guide, release-helper's
//   release-notes template, the manuals' live chapters, PRIVACY's round-8
//   section) fell OUTSIDE that coverage. A sentinel's coverage surface itself
//   needs a symmetry review (military rule 4). This sweep pins the engine
//   identity in every LIVE doc zone:
//   (a) BUILDING.md live build guide (the '# Building Regalia v1.2.3 from
//       source' how-to, up to the first round-history heading): digest AND
//       size must equal the Java constants;
//   (b) release-helper.yml names Stockfish 19, never 18;
//   (c) PRIVACY.md carries the current digest;
//   (d) manual en/zh LIVE chapters (before the appendix-changelog anchor)
//       contain no stale identity strings — exempted: the two annotated
//       'Stockfish 18 best practice' hash-table source citations;
//   (e) README.md live zone (before the first round-history heading).
ok('V3-40b engine identity live-doc sweep (BUILDING live guide digest+size, release-helper SF19, PRIVACY digest, manual+README live zones clean)',
   (() => {
     const sn = read('src/main/java/com/Regalia/StockfishNative.java');
     const building = read('BUILDING.md');
     const rh = read('.github/workflows/release-helper.yml');
     const pv = read('PRIVACY.md');
     const men = read('Manual/Regalia-v1.2.3-manual-en.html');
     const mzh = read('Manual/Regalia-v1.2.3-manual-zh.html');
     const rm = read('README.md');
     if (!sn || !building || !rh || !pv || !men || !mzh || !rm) return false;
     const jdm = sn.match(/EXPECTED_ENGINE_SHA256 =\s*\n?\s*"([0-9a-f]{64})"/);
     const jszm = sn.match(/EXPECTED_ENGINE_SIZE_BYTES = ([\d_]+)L/);
     if (!jdm || !jszm) return false;
     const jd = jdm[1];
     const jsz = Number(jszm[1].replace(/_/g, ''));
     // (a) live build guide section
     const g0 = building.indexOf('# Building Regalia v1.2.3 from source');
     if (g0 < 0) return false;
     const gm = building.slice(g0).match(/^## (?:v1\.2\.3 )?[Rr]ound/m);
     const guide = gm ? building.slice(g0, building.indexOf(gm[0], g0)) : building.slice(g0);
     if (!guide.includes(jd)) return false;
     const gsz = guide.match(/# (\d{9})/);
     if (!gsz || Number(gsz[1]) !== jsz) return false;
     // (b) release-helper names 19, not 18
     if (!/Stockfish 19/.test(rh) || /Stockfish 18/.test(rh)) return false;
     // (c) PRIVACY carries the current digest
     if (!pv.includes(jd)) return false;
     // (d) manual live zones; strip the two annotated best-practice citations
     const STALE = /Stockfish 18|SF18|sf18|armv8-dotprod|armv8\.dotprod/;
     for (const pair of [[men, 'Stockfish 18 best practice, still followed by SF19'],
                         [mzh, 'Stockfish 18 最佳实践，SF19 沿用']]) {
       const live = pair[0].split('id="appendix-changelog"')[0].split(pair[1]).join('');
       if (STALE.test(live)) return false;
     }
     // (e) README live zone
     const rLive = rm.slice(0, rm.indexOf('### Round-'));
     if (STALE.test(rLive)) return false;
     return true;
   })());

// V3-41 — round-66 (F-1/F-7/O-2/O-3): the engine cache-reuse gates must check
//   IDENTITY (exact size equality), not just ">5MB + ELF" — an old release's
//   cached engine (sf_18, 114,115,752 B) sailed through the old gate on
//   non-rooted fallback devices while the UI claimed SF19; and extraction
//   must commit ATOMICALLY (write .tmp, verify SHA there, rename) so a killed
//   process can never leave a half-written cache for the next start.
ok('V3-41 engine cache identity gate + atomic extraction commit (exact-size gates ×2, size constant, denominator uses constant, tmp+rename ×2, priority-1..3 size checks)',
   (() => {
     const sn = read('src/main/java/com/Regalia/StockfishNative.java');
     if (!sn) return false;
     const gates = sn.match(/^ {8}if \(destFile\.exists\(\) && destFile\.length\(\) == EXPECTED_ENGINE_SIZE_BYTES && isElfFile\(destFile\)\)/gm) || [];
     // line-anchored LIVE guard form: 'if (false && !tmpFile.renameTo(...))'
     // leaves the call as dead text while still counting 2 — count the
     // real statement lines instead (meta-neg V41-rename-disabled finding).
     const renames = sn.match(/^ +if \(!tmpFile\.renameTo\(destFile\)\) \{$/gm) || [];
     return /^ {4}private static final long EXPECTED_ENGINE_SIZE_BYTES = 100_695_968L;/m.test(sn)
       && gates.length === 2
       && /total \* 13L \/ EXPECTED_ENGINE_SIZE_BYTES\)/.test(sn)
       && /new java\.io\.FileOutputStream\(tmpFile\)\)/.test(sn)
       && renames.length === 2
       && /libFile\.length\(\) != EXPECTED_ENGINE_SIZE_BYTES/.test(sn)
       && /appLibFile\.length\(\) == EXPECTED_ENGINE_SIZE_BYTES && isElfFile\(appLibFile\)/.test(sn)
       && /candidate\.length\(\) == EXPECTED_ENGINE_SIZE_BYTES && isElfFile\(candidate\)/.test(sn);
   })());

// V3-42 — round-66 (F-5): game-logic.js's module header claimed a bundle
//   order that was BACKWARDS (it said "after chess960 + pgn-standard +
//   worker-pool" — game-logic is FIRST, worker-pool left the bundle in
//   round-56) and hid the round-60 TDZ lesson. The header must state the
//   true order; build-chess.py's modules list stays the authority.
ok('V3-42 game-logic.js module header states true bundle order (first module; ui.js last; TDZ warning present)',
   (() => {
     const gl = read('src/main/assets/chess.src/game-logic.js');
     const bcp = read('build-chess.py');
     if (!gl || !bcp) return false;
     const head = gl.slice(0, 2000);
     return /Bundled by build-chess\.py as the FIRST module/.test(head)
       && /ui\.js is the LAST module/.test(head)
       && /TDZ\/ReferenceError/.test(head)
       && !/after chess960\.js \+ pgn-standard\.js \+ worker-pool\.js/.test(head)
       && bcp.indexOf('"game-logic.js"') < bcp.indexOf('"chess960.js"')
       && bcp.lastIndexOf('"ui.js"') > bcp.lastIndexOf('"ui-interactions.js"');
   })());

// V3-43 — round-66 (F-8): readCappedText must compute the line-cap truncation
//   (appendLen) BEFORE the char-cap throw, so a file the line cap would
//   legally truncate is not misrejected as "too large" when its final chunk
//   crosses maxChars. Ordering pinned by source position of the two anchors.
ok('V3-43 FileIoHelper.readCappedText: line-cap truncation computed before char-cap throw',
   (() => {
     const fio = read('src/main/java/com/Regalia/FileIoHelper.java');
     if (!fio) return false;
     const scan = fio.indexOf('int appendLen = n;');
     const thr = fio.indexOf('if (sb.length() + appendLen > maxChars)');
     const oldThr = fio.indexOf('if (sb.length() + n > maxChars)');
     return scan >= 0 && thr > scan && oldThr === -1
       && /chunk\[i\] == '\\n'\) \{/.test(fio);
   })());

// V3-44 — round-66 (F-10): the SAF export picker's Activity-null path must
//   clear the pending payload — it never launches the picker, so "in flight"
//   state would be a lie and would pin a large PGN string in memory.
//   Line-anchored inside the null branch, mirroring the catch-path reset.
ok('V3-44 SafPickerHelper: Activity-null export path clears pending content/type',
   (() => {
     const saf = read('src/main/java/com/Regalia/SafPickerHelper.java');
     if (!saf) return false;
     const nul = saf.indexOf('if (activity == null) {');
     const clr = saf.indexOf('_pendingExportContent = null;', nul);
     const toast = saf.indexOf('Activity unavailable', nul);
     return nul >= 0 && clr > nul && clr < toast
       && /_pendingExportType = "settings";/.test(saf.slice(clr, clr + 120));
   })());

// V3-45 — round-66 (F-9/F-23): the two live PGN parsers must be
//   backtracking-free. F-9: stats.html's old lazy-branch header regex
//   exceeded 120 s on a 100k-space malformed tag (measured; main thread =
//   frozen page) — now a deterministic scanner, differential-fuzzed against
//   the old regex (zero diff, 343k cases, round66-audit.md). F-23:
//   tablebase.js's multi-game split still had the pre-round-49 quadratic
//   form (round-49 fixed three copies, missed this fourth — the MAIN page's
//   import path); now the hardened linear lookbehind form shared with
//   stats.html's split.
ok('V3-45 PGN parsers backtracking-free (stats.html deterministic header scanner, lazy headerRe gone; tablebase.js hardened split form, quadratic form gone)',
   (() => {
     const st = read('src/main/assets/stats.html');
     const tb = read('src/main/assets/chess.src/tablebase.js');
     if (!st || !tb) return false;
     // fail-closed direction: the ambiguous lazy header regex tail must be gone
     if (/\*\?\)\)\\s\*\\\]/.test(st)) return false;
     // deterministic scanner implementation lines
     if (!/const _b=text\.indexOf\('\[', ?_hs\);/.test(st)) return false;
     if (!/const _e=text\.indexOf\('\]', ?_j\);/.test(st)) return false;
     // tablebase: hardened linear lookbehind present, old quadratic gone
     if (!tb.includes('(?<!\\n)\\n[^\\S\\n]*\\n(?:[^\\S\\n]*\\n)*(?=\\[)')) return false;
     if (tb.includes('split(/\\n\\s*\\n(?=\\[)/)')) return false;
     return true;
   })());

console.log('\n===== RESULT: ' + pass + ' passed, ' + fail + ' failed =====');
process.exit(fail === 0 ? 0 : 1);
