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
ok('V3-39 r62-negative-tests.sh self-discipline (line-anchored: self-resolved root, flock workspace mutex BEFORE first backup held to exit, exclusive mktemp -d backup dir covering all four mutable targets, byte-verified backup/restore/per-item cp+cmp at every site, restore-CALLING trap handlers (command shape, not mention), accumulated failures, real exit codes, no absolute paths; N8 bench gate + N8a-d benchmark self-protection negatives + N9 lock negative wired; bench runs fd-9-closed so children never inherit the workspace mutex)',
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
     // round-67 (T10/T17, CodeRabbit r66-#5): the workspace mutex is pinned
     //   by its three implementation lines, and the lock must be taken
     //   BEFORE the first backup (source order) — a lock added after the
     //   mutations would not close the shared-target race it exists for.
     // round-68 (T1/T2/T3): the backup set grew to four targets (tablebase.js
     //   and r67-bench.js joined as mutation targets for the benchmark
     //   self-protection negatives); the pinned invocation line grew with
     //   it, and the new gates + their restore discipline are pinned too.
     const lockIdx = s.indexOf('flock -n 9');
     const bakIdx = s.indexOf('BAK=$(mktemp -d)');
     return !s.includes('/home/')
       && /^ROOT=.*BASH_SOURCE/m.test(s)
       && lockIdx >= 0 && bakIdx > lockIdx
       && /^LOCK="\/tmp\/r62neg\.\$\(echo "\$ROOT" \| md5sum \| cut -c1-16\)\.lock"$/m.test(s)
       && /^exec 9>"\$LOCK" \|\| \{ echo "cannot open lock file: \$LOCK" >&2; exit 1; \}$/m.test(s)
       && /^flock -n 9 \|\| \{ echo "another r62-negative-tests\.sh run holds the workspace lock: \$LOCK" >&2; exit 1; \}$/m.test(s)
       && s.includes('node runs/r67-bench.js')
       && s.includes('bash "$0" >"$_N9LOG" 2>&1')
       && s.includes('TREE MODIFIED by the second instance')
       // round-68 (T1/T2/T3): the benchmark self-protection negatives are
       // wired and named (gate labels), the bench runs without the lock fd
       // (9>&- — its node children must not inherit the workspace mutex),
       // and the mutation gates carry their own byte-verified restore
       // discipline (mutcheck/restore_mut with cp+cmp).
       && s.includes('NEG[N8a-split-oldform]')
       && s.includes('NEG[N8b-scan-oldform]')
       && s.includes('NEG[N8c-meta-newline]')
       && s.includes('NEG[N8d-deadloop]')
       && /^run_bench\(\) \{ \( cd "\$VDIR" && node runs\/r67-bench\.js 9>&- \); \}$/m.test(s)
       && /^  if ! cp "\$BAK\/\$\(basename "\$1"\)" "\$1" \|\| ! cmp -s "\$BAK\/\$\(basename "\$1"\)" "\$1"; then$/m.test(s)
       && /^BAK=\$\(mktemp -d\)/m.test(s)
       && /^trap\s+'restore\s*\|\|\s*exit\s+1[^']*'\s+EXIT/m.test(s)
       && /^trap\s+'restore\s*\|\|\s*exit\s+1[^']*'\s+INT/m.test(s)
       && /^trap\s+'restore\s*\|\|\s*exit\s+1[^']*'\s+TERM/m.test(s)
       && /^  cp "\$1" "\$2" && cmp -s "\$1" "\$2"$/m.test(s)
       && /^  if cp "\$1" "\$2" && cmp -s "\$1" "\$2"; then$/m.test(s)
       && /^if ! backup_one "\$AB" "\$BAK\/ai-bridge\.js" \|\| ! backup_one "\$STF" "\$BAK\/stats\.html" \|\| ! backup_one "\$TBF" "\$BAK\/tablebase\.js" \|\| ! backup_one "\$BEN" "\$BAK\/r67-bench\.js"; then$/m.test(s)
       && /^[^#\n]*if ! cp "\$_bak" "\$_tgt" \|\| ! cmp -s "\$_bak" "\$_tgt"; then$/m.test(s)
       && /^[^#\n]*FAILED=\$\(\(FAILED\+1\)\)/m.test(s)
       && /^set -o pipefail/m.test(s)
       && /^[^#\n]*\[ "\$FAILED" -gt 0 \]/m.test(s)
       && vl.includes('verifier/runs/r62-negative-tests.sh')
       && vl.includes('verifier/runs/r67-bench.js')
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

// V3-41 — round-66 (F-1/F-7/O-2/O-3), rewritten round-67 (T1/T2/T14): the
//   engine cache-reuse gates must check IDENTITY (exact size equality), not
//   just ">5MB + ELF" — an old release's cached engine (sf_18, 114,115,752 B)
//   sailed through the old gate on non-rooted fallback devices while the UI
//   claimed SF19; and extraction must commit ATOMICALLY (write .tmp, verify
//   SHA there, rename). round-67 de-twinned the two byte-identical cascades
//   (PR #57 new-code duplication 13.2% > 3% gate): ONE shared
//   cachedEngineAcceptable() + ONE shared commitExtractedEngine(), each
//   called from BOTH extraction paths (military rule 4: symmetric faces get
//   ONE implementation, not two matching patches). Predicates pin the helper
//   implementation lines (line-anchored, early-return shape), BOTH call
//   sites, and — new, CodeRabbit r66-#8 — the verify-BEFORE-rename order
//   inside the shared cascade (deleting the SHA call must turn this RED;
//   the verify/rename adjacency pins containment, not just order). Text
//   sentinels are tripwires, not proofs: a literal 'if (false'/'if (0)'
//   wrapper would keep the text while killing the statement — banned below
//   as a cheap death-guard; deeper wrappers (if (0==1)) remain a documented
//   residual (methodology §3.10 five-level lineage; the behavioral property
//   is covered by fixture review + this script's negative mutations).
ok('V3-41 engine cache identity gate + atomic extraction commit, single shared implementation (exact-size gate + rooted-SHA gate in cachedEngineAcceptable, both rejection bodies pinned to return null; verify-SHA-then-rename adjacency inside commitExtractedEngine; reject arms share rejectExtractedEngine with the Extracted-engine literal single-sourced; label call sites ×2 each; LOG constant single-source; tmp sibling streams ×2; priority-1..3 size checks; no dead-literal wrappers)',
   (() => {
     const sn = read('src/main/java/com/Regalia/StockfishNative.java');
     if (!sn) return false;
     // (1) size constant (V3-40 pins its cross-file identity)
     if (!/^ {4}private static final long EXPECTED_ENGINE_SIZE_BYTES = 100_695_968L;$/m.test(sn)) return false;
     // (2) shared cache-gate helper: identity gate in early-return shape
     if (!/^ {8}if \(!destFile\.exists\(\) \|\| destFile\.length\(\) != EXPECTED_ENGINE_SIZE_BYTES \|\| !isElfFile\(destFile\)\) \{$/m.test(sn)) return false;
     // (3) rooted-device SHA gate inside the helper
     if (!/^ {8}if \(shouldVerifyCachedEngine\(\) && !verifyEngineSha256\(destFile\)\) \{$/m.test(sn)) return false;
     // round-68 (T11, CodeRabbit r67): the rejection branch BODIES must
     //   actually return null. The round-67 pins matched only the if-LINES —
     //   a `return destFile;` in a branch body kept the sentinel green while
     //   releasing a bad cache (the method returns File, so return destFile
     //   compiles fine). Adjacency-pinned on both rejection branches.
     if (!/!isElfFile\(destFile\)\) \{\n            return null;\n        \}/.test(sn)) return false;
     // round-70 (T-mobsf): the per-line migration replaced the global .mobsf
     //   android_logging rule; flagged Log lines now carry a trailing
     //   `// mobsf-ignore: android_logging` marker. The adjacency pin keeps
     //   its exact shape; exactly that one marker (nothing else) is tolerated
     //   between the statement end and the newline.
     if (!/getAbsolutePath\(\)\);(?: \/\/ mobsf-ignore: android_logging)?\n            return null;\n        \}/.test(sn)) return false;
     // (4) helper called from BOTH extraction paths (exact labels)
     if ((sn.match(/cachedEngineAcceptable\(destFile, "extracted"\)/g) || []).length !== 1) return false;
     if ((sn.match(/cachedEngineAcceptable\(destFile, "asset-extracted"\)/g) || []).length !== 1) return false;
     // (5) shared commit cascade: verify + rename exist exactly once
     if ((sn.match(/^ {16}if \(verifyEngineSha256\(tmpFile\)\) \{$/gm) || []).length !== 1) return false;
     if ((sn.match(/^ {20}if \(!tmpFile\.renameTo\(destFile\)\) \{$/gm) || []).length !== 1) return false;
     // (6) ORDER + containment (CodeRabbit r66-#8): the rename sits directly
     //     inside the verify-success branch — source adjacency
     if (!/if \(verifyEngineSha256\(tmpFile\)\) \{\n {20}if \(!tmpFile\.renameTo\(destFile\)\) \{/.test(sn)) return false;
     // (7) commit cascade called from BOTH extraction paths
     if ((sn.match(/return commitExtractedEngine\(tmpFile, destFile, "APK"\);/g) || []).length !== 1) return false;
     if ((sn.match(/return commitExtractedEngine\(tmpFile, destFile, "assets"\);/g) || []).length !== 1) return false;
     // (8) the delete-failure log literal exists ONLY as the shared constant (S1192)
     if (!/^ {4}private static final String LOG_DELETE_FAILED = "Failed to delete: ";$/m.test(sn)) return false;
     if ((sn.match(/Log\.w\(TAG, "Failed to delete: " \+/g) || []).length !== 0) return false;
     // round-68 (T10, Sonar S3776/S1192): the three reject arms share ONE
     //   rejectExtractedEngine() helper — three call sites, one declaration,
     //   and the "Extracted engine (" literal exists exactly once (in the
     //   helper), replacing the former three inline copies.
     if ((sn.match(/rejectExtractedEngine\(tmpFile, label/g) || []).length !== 3) return false;
     if (!/^    private File rejectExtractedEngine\(File tmpFile, String label, String reason\) \{$/m.test(sn)) return false;
     if ((sn.match(/"Extracted engine \("/g) || []).length !== 1) return false;
     // (9) extraction still writes the .tmp sibling in both paths
     if ((sn.match(/new java\.io\.FileOutputStream\(tmpFile\)\)/g) || []).length !== 2) return false;
     // (10) priority-1..3 resolution gates unchanged (F-1/O-3)
     if (!/libFile\.length\(\) != EXPECTED_ENGINE_SIZE_BYTES/.test(sn)) return false;
     if (!/appLibFile\.length\(\) == EXPECTED_ENGINE_SIZE_BYTES && isElfFile\(appLibFile\)/.test(sn)) return false;
     if (!/candidate\.length\(\) == EXPECTED_ENGINE_SIZE_BYTES && isElfFile\(candidate\)/.test(sn)) return false;
     // (11) cheap death-guard (T15): literal 'if (false' / 'if (0)' wrappers
     //     are banned outright; the residual (if (0==1) etc.) is documented
     //     in methodology §3.10 — behavior is covered by fixtures + negatives
     if (/if \(false|if \(0\)/.test(sn)) return false;
     return true;
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

// V3-43 — round-66 (F-8), upgraded round-67 (T13, CodeRabbit r66-#9):
//   readCappedText must compute the line-cap truncation (appendLen) BEFORE
//   the char-cap throw, so a file the line cap would legally truncate is
//   not misrejected as "too large" when its final chunk crosses maxChars.
//   round-66 pinned only the DECLARATION position — moving the char-cap
//   check between the declaration and the truncation assignment kept the
//   sentinel green while re-breaking F-8 (appendLen would still hold the
//   whole chunk length). Now the truncation ASSIGNMENT itself is pinned
//   before the throw, by source position of both anchors.
ok('V3-43 FileIoHelper.readCappedText: line-cap truncation ASSIGNMENT (appendLen = i + 1) precedes char-cap throw (declaration, assignment and throw pinned by order; old untruncated form gone)',
   (() => {
     const fio = read('src/main/java/com/Regalia/FileIoHelper.java');
     if (!fio) return false;
     const decl = fio.indexOf('int appendLen = n;');
     const trunc = fio.indexOf('appendLen = i + 1; break; }');
     const thr = fio.indexOf('if (sb.length() + appendLen > maxChars)');
     const oldThr = fio.indexOf('if (sb.length() + n > maxChars)');
     return decl >= 0 && trunc > decl && thr > trunc && oldThr === -1
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

// V3-45 — round-66 (F-9/F-23), rewritten round-67 (T6/T7): the two live
//   PGN parsers must be backtracking-free AND single-pass linear. Round-66
//   replaced stats.html's lazy header regex with a deterministic scanner
//   and tablebase.js's quadratic split with a hardened lookbehind — but
//   CodeRabbit r66-#2/#3/#4 proved both round-66 forms were STILL
//   super-linear: the lookbehind did not restrict match starts inside
//   spaces-only blank-line runs (Θ(n²) when no '[' follows), and the
//   scanner's ']' lookup + trailing-ws trim rescanned overlapping
//   suffixes (~4n² on '[Event x'.repeat(n); a 10MB single-line input could
//   hang the page for minutes). round-67: the split is a shared-shape
//   _pgnFirstGameSplit() isomorphic twin (tablebase.js and stats.html share
//   no bundle, so ONE shared function is impossible — the twins are pinned
//   byte-identical instead), and the scanner runs on monotonic caches
//   (next-']' with its ws-run start + next-'\n', consulted before any
//   slice). Text predicates are tripwires against the known-bad forms; the
//   LINEARITY bound itself is behavioral and enforced by N8 (r67-bench.js).
ok('V3-45 PGN parsers single-pass linear (isomorphic _pgnFirstGameSplit twins byte-equal in tablebase.js+stats.html, semantic core lines pinned; lookbehind/pre-49 split forms gone; stats.html monotonic-cache scanner: next-] + ws-run start + next-\n checked before slice, no per-candidate ] rescan, no lazy headerRe; N8 bench gate wired)',
   (() => {
     const st = read('src/main/assets/stats.html');
     const tb = read('src/main/assets/chess.src/tablebase.js');
     const neg = read('verifier/runs/r62-negative-tests.sh');
     if (!st || !tb || !neg) return false;
     // (1) isomorphic twins: both bodies extracted, byte-equal
     const fnRe = /function _pgnFirstGameSplit\(text\)\{[\s\S]*?\n\}/;
     const a = tb.match(fnRe), b = st.match(fnRe);
     if (!a || !b || a[0] !== b[0]) return false;
     // (2) the semantic core lines inside the shared body
     if (!/^ {4}if\(_ls\[_i\]\.charAt\(0\)==='\['&&_run!==-1&&\(_run>=1\|\|_i>=2\)\)_cuts\.push\(\[_pos\[Math\.max\(_run,1\)\]-1,_pos\[_i\]\]\);$/m.test(a[0])) return false;
     if (!/^ {4}_run=_blankRunStart\(_ls\[_i\],_i,_run\);$/m.test(a[0])) return false;
     // round-68 (T7/T8): the blank-run tracker is a pinned local helper —
     //   a blank line keeps the first run start, a non-blank line resets.
     if (!/^ {2}const _blankRunStart=\(line,idx,run\)=>\/\^\\s\*\$\/\.test\(line\)\?\(run===-1\?idx:run\):-1;$/m.test(a[0])) return false;
     // (3) both files actually call it for the first-game split
     if (!/const gameBlocks=_pgnFirstGameSplit\(pgnText\);/.test(tb)) return false;
     if (!/const _gameBlocks=_pgnFirstGameSplit\(text\);/.test(st)) return false;
     // (4) known-bad forms gone from both parsers
     if (/\.split\(\/\(\?<!\\n/.test(tb) || /\.split\(\/\(\?<!\\n/.test(st)) return false;
     if (tb.includes('split(/\\n\\s*\\n(?=\\[)/')) return false;
     if (/\*\?\)\)\\s\*\\\]/.test(st)) return false;
     if (/text\.indexOf\('\]',_j\)/.test(st)) return false;
     if (/slice\(_j,_vEnd\)\.indexOf\('\\n'\)/.test(st)) return false;
     // (5) the monotonic-cache scanner implementation lines
     if (!/^  let _nb=text\.indexOf\('\]'\),_nbFrom=0,_nbWs=-1;$/m.test(st)) return false;
     if (!/^  let _nl=text\.indexOf\('\\n'\),_nlFrom=0;$/m.test(st)) return false;
     if (!/^    if\(from<_nbFrom\|\|\(_nb>=0&&_nb<from\)\)\{_nbFrom=from;_nb=text\.indexOf\('\]',from\);_nbWs=-1;\}$/m.test(st)) return false;
     if (!/^        const _vEnd=Math\.max\(_ws,_j\);$/m.test(st)) return false;
     if (!/^        if\(!\(_nlPos>=0&&_nlPos<_vEnd\)\)\{$/m.test(st)) return false;
     if (!/^    const _b=text\.indexOf\('\[',_hs\);$/m.test(st)) return false;
     // (6) the behavioral bound is wired into the negative gate (N8)
     if (!/node runs\/r67-bench\.js/.test(neg)) return false;
     return true;
   })());

// V3-46 — round-67 (T0/delivery completeness): round-66 deleted worker-pool.js
//   (732 lines, dead since the round-56 unbundling) and the chess.src ledger
//   records the deletion — but the zip-overlay upload channel CANNOT delete
//   files, so the remote tree silently kept it (found by round-67's
//   remote-vs-local diff; invisible to every round-66 sentinel — exactly the
//   blind-spot class V3-40b caught for release-helper.yml). Pin the absence
//   so any tree that still carries the file goes RED.
ok('V3-46 worker-pool.js absent from tree and build (round-66 deletion pinned; build-chess.py module list carries no worker-pool entry)',
   (() => {
     if (fs.existsSync(path.join(__dirname, '..', '..', 'src/main/assets/chess.src/worker-pool.js'))) return false;
     const bcp = read('build-chess.py');
     if (!bcp) return false;
     // quoted-module form only: the round-56 removal NOTE in build-chess.py
     // legitimately mentions the filename in a comment — the MODULE LIST
     // entries are quoted strings (see V3-42's list pins), so this bans a
     // re-add without banning the history.
     if (bcp.includes('"worker-pool.js"')) return false;
     return true;
   })());

// V3-47 — round-67 (T0/delivery completeness): .gitignore (round-56 SEC-02,
//   "signing material must never enter git") existed locally since round-56
//   and the round-66 change set claimed it finally landed remotely — it did
//   not (the zip carried it, the bot commit did not; root cause undetermined
//   between a stale upload and an extraction quirk — the mitigation is the
//   new post-upload remote re-check hard rule, guide §7). Pin its presence
//   and the never-commit exclusions so any tree lacking it goes RED.
ok('V3-47 .gitignore present with never-commit exclusions (keystore.properties, *.keystore, *.jks, local.properties, build/.cxx/.gradle, src/main/jniLibs)',
   (() => {
     if (!fs.existsSync(path.join(__dirname, '..', '..', '.gitignore'))) return false;
     const gi = read('.gitignore');
     if (!gi) return false;
     return /^keystore\.properties$/m.test(gi)
       && /^\*\.keystore$/m.test(gi)
       && /^\*\.jks$/m.test(gi)
       && /^local\.properties$/m.test(gi)
       && /^build\/$/m.test(gi)
       && /^\.cxx\/$/m.test(gi)
       && /^\.gradle\/$/m.test(gi)
       && /^src\/main\/jniLibs\/$/m.test(gi);
   })());

// V3-48 — round-68 (T4, CodeRabbit r67 Major) → round-69 (PR#57 Minor):
//   probeTablebase's 5s deadline must cover the response BODY read, not just
//   the headers. The round-66/67 form cleared the abort timer in an inner
//   finally right after fetch resolved — a server that sent headers then
//   stalled the body hung the probe forever. Pinned (position-anchored,
//   whole file, unique anchors):
//   (1) the timer decl sits OUTSIDE the try (so the outer finally covers
//       every path);
//   (2) the clearTimeout finally sits AFTER the body-parse anchor
//       (`return await r.json();`) — moving it back before the parse is the
//       exact regression class;
//   (3) the AbortError rethrow inside the JSON catch routes a deadline abort
//       during the body read into the EXISTING catch (fail-count semantics),
//       not the PHASE 19 malformed-payload path;
//   (4) the handled-outcome sentinel `if(data===undefined)return null;`
//       distinguishes 4xx/bad-JSON outcomes from a parsed payload;
//   (5) the legacy no-AbortController race wraps the whole _fetchProbe()
//       chain, not a bare fetch;
//   (6) the known-bad early-clear inner finally is gone.
//   round-69 additions (fail-count single accounting, CodeRabbit PR#57
//   Minor): (7) the server-side 5xx outcome RETURNS a frozen _TB_NETFAIL
//       sentinel from the fetch chain instead of counting inline — on the
//       legacy path a wall-clock timeout counted the query in the catch and
//       a LATE 5xx counted it AGAIN (two failed queries could trip the
//       3-strike offline); (8) the single accounting point
//       `if(data===_TB_NETFAIL){_tbFailCount++...}` sits AFTER the
//       undefined-sentinel gate; (9) the inline-count regression form
//       (`if(r.status>=500){` directly followed by `_tbFailCount++`) is
//       pinned gone.
//   Meta-negatives RED-verified (round68-audit.md §T6): early-clear
//   reintroduction, AbortError-rethrow removal, legacy race de-scoping.
ok('V3-48 tablebase probe: 5s deadline covers fetch AND response body; fail-count accounted ONCE post-race (timer outside try; clearTimeout AFTER body parse; AbortError rethrown to fail-count catch; handled-outcome sentinel; 5xx returns _TB_NETFAIL sentinel counted at the single post-race point; legacy race wraps whole chain; early-clear inner finally gone; inline 5xx counting gone)',
   (() => {
     const tb = read('src/main/assets/chess.src/tablebase.js');
     if (!tb) return false;
     const decl = tb.indexOf("const tmr=ctrl?setTimeout(()=>ctrl.abort(),5000):null;");
     const tryB = tb.indexOf('try{\nconst _tbUrl=');
     const parse = tb.indexOf('return await r.json();');
     const clear = tb.indexOf('finally{if(tmr)clearTimeout(tmr);}');
     if (decl < 0 || tryB < 0 || parse < 0 || clear < 0) return false;
     if (!(decl < tryB && parse < clear)) return false;
     if (!/if\(ctrl&&e&&e\.name==='AbortError'\)throw e;/.test(tb)) return false;
     if (!/^if\(data===undefined\)return null;$/m.test(tb)) return false;
     if (!/Promise\.race\(\[\n    _fetchProbe\(\),/.test(tb)) return false;
     if (/\}finally\{\n  if\(tmr\)clearTimeout\(tmr\);\n\}/.test(tb)) return false;
     if (/resp=await fetch\(/.test(tb)) return false;
     // round-69: sentinel declared once, frozen, before the try
     if (!/^const _TB_NETFAIL=Object\.freeze\(\{netfail:true\}\);$/m.test(tb)) return false;
     // round-69: 5xx branch RETURNS the sentinel — no inline counting
     if (!/if\(r\.status>=500\)\{\n[\s\S]{0,700}?return _TB_NETFAIL;\n[\s\S]{0,80}?\}\n[\s\S]{0,80}?return undefined;/.test(tb)) return false;
     // round-69: the single accounting point AFTER the undefined gate
     const gate = tb.indexOf('if(data===undefined)return null;');
     const acct = tb.indexOf('if(data===_TB_NETFAIL){_tbFailCount++;');
     if (!(gate >= 0 && acct > gate)) return false;
     // round-69: the inline-count regression form is pinned gone
     if (/if\(r\.status>=500\)\{\s*_tbFailCount\+\+/.test(tb)) return false;
     return true;
   })());

// V3-49 — round-68 (T5, CodeRabbit r67 Minor) → round-69 (PR#57 Minor):
//   the manual tablebase query's async callback must be IDENTITY-CHECKED
//   before it touches shared state. The probe is async; a callback returning
//   after the position changed must not autoSelect an OLD recommendation
//   onto the changed board, and must not lower a loading flag that now
//   belongs to a NEWER query. round-68 used the board REFERENCE as the
//   ownership token — round-69 replaces it with a FRESH OBJECT per query
//   (_tbLoadingOwner): the AI entry re-arms without a re-entry check, and
//   two in-flight queries saving the SAME board reference let the earlier
//   callback pass the identity check and lower the flag while the newer
//   probe was still airborne (CodeRabbit PR#57 Minor). Reference-equality
//   semantics are kept (military rule 2) — the reference is now to a
//   per-query token, never to a board.
//   Pinned: token declaration; manual-path board capture + fresh-token claim
//   + gated lowering on BOTH the then and catch arms; autoSelect gated on
//   board identity (PAYLOAD correctness — kept from round-68); the AI
//   path's arm-site fresh-token claim and BOTH gated lowerings; the old
//   board-reference token form (_tbLoadingBoard) is pinned GONE from both
//   files; the old ungated `then(function(d){\n_tbLoading=false;` form gone.
ok('V3-49 tablebase query callbacks ownership-gated (_tbLoadingOwner fresh-object token: manual path captures board + fresh token, lowers only-if-owning on both arms, autoSelect gated on board identity; AI path claims fresh token at arm and lowers only-if-owning on both arms; board-reference token form gone; old ungated lowering gone)',
   (() => {
     const tb = read('src/main/assets/chess.src/tablebase.js');
     const gl = read('src/main/assets/chess.src/game-logic.js');
     if (!tb || !gl) return false;
     if (!/^let _tbLoadingOwner=null;$/m.test(tb)) return false;
     if (!/const _boardAtQuery=gameState\.board;\n[\s\S]{0,400}?const _myOwnerToken=\{\};\n_tbLoadingOwner=_myOwnerToken;/.test(tb)) return false;
     const gatedLower = "if(_tbLoadingOwner===_myOwnerToken){_tbLoading=false;_tbLoadingOwner=null;}";
     if ((tb.match(new RegExp(gatedLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length !== 2) return false;
     if (!/if\(gameState\.board===_boardAtQuery\)\{\nif\(d\)\{const bm=bestMoveFromTablebase\(d\);if\(bm\)\{autoSelectTablebaseMove\(bm\.uci\);\}\}\n\}/.test(tb)) return false;
     if (/probeTablebase\(gameState\)\.then\(function\(d\)\{\n_tbLoading=false;/.test(tb)) return false;
     if (!/const _tbOwnerToken=\{\};_tbLoadingOwner=_tbOwnerToken;\n/.test(gl)) return false;
     const aiLower = "if(_tbLoadingOwner===_tbOwnerToken){_tbLoading=false;_tbLoadingOwner=null;}";
     if ((gl.match(new RegExp(aiLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length !== 2) return false;
     if (/\}\)\.catch\(function\(\)\{\n_tbLoading=false;\n_tbRetryCount\+\+/.test(gl)) return false;
     // round-69: the board-reference token regression form is pinned gone
     if (tb.includes('_tbLoadingBoard') || gl.includes('_tbLoadingBoard')) return false;
     return true;
   })());

console.log('\n===== RESULT: ' + pass + ' passed, ' + fail + ' failed =====');
process.exit(fail === 0 ? 0 : 1);
