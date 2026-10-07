// round-53 verifier: SonarCloud PR #56 triage acceptance checks.
// Structural assertions over the round-53 worktree:
//   (F1) game-logic.js: Promise.all animation wait has an explicit rejection handler (S9383);
//   (F2) tablebase.js + ui-interactions.js: all bare importPGNAsync call sites are void-marked (S9383);
//   (F3) ai-bridge.js: reviewStates?.length optional chain (S6582),
//        direct undefined comparison for same-module _reviewEvalCache (S7741),
//        T5 stale-eval ring iterated with for-of (S4138);
//   (F4) StockfishNative.java: pattern-matching instanceof for the batch-end dispatch (S6201),
//        catch (Exception) instead of catch (Throwable) at that dispatch (S1181);
//   (F5) EngineService.java: wakeLock is written ONLY from static synchronized helpers
//        (S2696 x2) — onCreate/onDestroy contain no direct `wakeLock =` assignment;
//   (F6) MainActivity.java: _activityResumed/_webViewPausedForBatch kept with an
//        in-source S116-kept justification comment (project `_xxx` convention).
// Exit code 0 = all pass.
//
// Copyright (C) 2026 Regalia
//
// AI-GEN: AI assisted
// This code was AI-assisted and has been reviewed for AGPL v3 compliance.
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
const ROOT = path.join(__dirname, '..', '..');

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log('PASS', name); }
  else { fail++; console.log('FAIL', name); }
}
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }

// F1 — S9383 game-logic.js
const gl = read('src/main/assets/chess.src/game-logic.js');
ok('F1a Promise.all has rejection handler (_finishAnim twice)',
   /Promise\.all\(promises\)\.then\(function\(\)\{_finishAnim\(\);\},function\(\)\{_finishAnim\(\);\}\)/.test(gl));

// F2 — S9383 bare importPGNAsync call sites void-marked
const tb = read('src/main/assets/chess.src/tablebase.js');
const ui = read('src/main/assets/chess.src/ui-interactions.js');
ok('F2a tablebase.js void importPGNAsync', /void importPGNAsync\(sanitized\)/.test(tb));
ok('F2b ui-interactions.js void importPGNAsync (stats import-back)', /void importPGNAsync\(pgnText\)/.test(ui));
ok('F2c ui-interactions.js void importPGNAsync (paste import)', /void importPGNAsync\(text\)/.test(ui));
ok('F2d no remaining bare importPGNAsync( call without void/.then receiver (tb + ui)',
   // round-54 (PR56 CR#14): tightened per CodeRabbit — scan BOTH tb and ui,
   //   and drop the permissive return/assignment prefixes: every call site
   //   must carry an explicit void (or be the function declaration itself).
   [...tb.matchAll(/importPGNAsync\(/g)].every(m => {
     const before = tb.slice(Math.max(0, m.index - 10), m.index);
     return /void $|function $/.test(before);
   }) &&
   [...ui.matchAll(/importPGNAsync\(/g)].every(m => {
     const before = ui.slice(Math.max(0, m.index - 10), m.index);
     return /void $|function $/.test(before);
   }));

// F3 — ai-bridge.js
const ab = read('src/main/assets/chess.src/ai-bridge.js');
ok('F3a S6582 reviewStates?.length optional chain',
   ab.includes("typeof reviewStates!=='undefined'&&reviewStates?.length"));
ok('F3b S7741 direct undefined comparison for _reviewEvalCache (same-module, spacing-tolerant)',
   // round-54: tolerant of whitespace — the round-53 _bgCached line was
   //   replaced in round-54 (PR56 CR#9), but the same-module pattern persists
   //   elsewhere in the file.
   /_reviewEvalCache\s*!==\s*undefined/.test(ab));
ok('F3c S4138 T5 ring uses for-of', /for\(const _d of _evalRecentDispatches\)/.test(ab));
ok('F3d T5 ring logic intact (states identity + fen match + step bounds)',
   ab.includes('_d.states===reviewStates&&_d.fen===_cbFenNav&&_d.step>=0&&_d.step<reviewStates.length'));

// F4 — StockfishNative.java
const sn = read('src/main/java/com/Regalia/StockfishNative.java');
ok('F4a S6201 pattern instanceof MainActivity',
   sn.includes('act instanceof MainActivity mainActivity'));
ok('F4b S1181 batch-end dispatch try block has NO catch (Throwable) and ends with catch (Exception t)',
   // round-54 (PR56 CR#15): scope the check to the try block that contains
   //   onEvalDeepBatchEnded() — the old [\s\S]{0,400} window could match an
   //   unrelated catch nearby. The block must end at catch (Exception t) with
   //   no Throwable catch inside the window.
   (() => {
     const i = sn.indexOf('mainActivity.onEvalDeepBatchEnded();');
     if (i < 0) return false;
     const window = sn.slice(i, i + 700);
     const j = window.indexOf('catch (Exception t)');
     if (j < 0) return false;
     return !window.slice(0, j).includes('catch (Throwable');
   })());

// F5 — EngineService.java S2696
const es = read('src/main/java/com/Regalia/EngineService.java');
const onCreateBody = es.slice(es.indexOf('public void onCreate()'), es.indexOf('public int onStartCommand'));
const onDestroyBody = es.slice(es.indexOf('public void onDestroy()'), es.indexOf('public IBinder onBind'));
ok('F5a onCreate contains no direct wakeLock write', !/wakeLock\s*=/.test(onCreateBody));
ok('F5b onDestroy contains no direct wakeLock write', !/wakeLock\s*=/.test(onDestroyBody));
ok('F5c static synchronized acquire helper present',
   es.includes('private static synchronized void acquireEngineWakeLock(Context ctx)'));
ok('F5d static synchronized release helper present',
   es.includes('private static synchronized void releaseEngineWakeLock()'));
ok('F5e refreshWakeLock now synchronized',
   es.includes('public static synchronized void refreshWakeLock()'));
ok('F5f wakeLock field still static volatile (BG-2 design kept)',
   es.includes('private static volatile PowerManager.WakeLock wakeLock'));

// F6 — MainActivity.java S116 kept with justification
const ma = read('src/main/java/com/Regalia/MainActivity.java');
ok('F6a _activityResumed kept + S116-kept note',
   ma.includes('private volatile boolean _activityResumed') && ma.includes('S116 kept'));
ok('F6b _webViewPausedForBatch kept',
   ma.includes('private volatile boolean _webViewPausedForBatch'));

// V2-20 — round-60 (F-1): _KING_PIECE_STYLE moved to game-logic.js (first
//   module) so ai-bridge.js's top-level _showLoadingOverlay() no longer hits
//   the TDZ; ai-bridge.js must not probe it with typeof (typeof on a TDZ
//   const throws instead of returning 'undefined').
const gl60 = read('src/main/assets/chess.src/game-logic.js');
const aib60 = read('src/main/assets/chess.src/ai-bridge.js');
const uijs60 = read('src/main/assets/chess.src/ui.js');
ok('V2-20 _KING_PIECE_STYLE declared in game-logic.js, absent from ui.js, no typeof probe in ai-bridge.js',
   gl60.includes('const _KING_PIECE_STYLE=')
   && !uijs60.includes('const _KING_PIECE_STYLE=')
   && !aib60.includes('typeof _KING_PIECE_STYLE'));

console.log(`===== RESULT: ${pass} passed, ${fail} failed =====`);
process.exit(fail ? 1 : 0);
