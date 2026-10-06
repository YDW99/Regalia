// round-52 verifier harness: stale engine-eval callback scenarios.
// Loads the 10-module bundle in a Node vm with browser stubs and asserts:
//   (a) late previous-position callback after a new dispatch is dropped;
//   (b) review-mode stale callback is cached under the MATCHED step (fen
//       identity) with correct White-POV sign — not the current step;
//   (c) legacy 7-arg callback path (no reqFen) still works via gen check;
//   (d) batch analyze-all dispatch/callback round-trip is unaffected;
//   (e) duplicate callback for the current fen is idempotent.
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
const vm = require('vm');

const SRC = path.join(__dirname, '..', '..', 'src', 'main', 'assets', 'chess.src');
const MODULES = ['game-logic.js','chess960.js','pgn-standard.js',
  'state-store.js','ai-bridge.js','tablebase.js','eco-data.js',
  'ui-gameflow.js','ui-interactions.js','ui.js'];
// round-56: worker-pool.js removed from the bundle (zero-caller dead code,
// 732 lines); MODULES mirrors build-chess.py.

// ---- concatenate modules, stripping export statements (mirrors build-chess.py)
let combined = '';
for (const m of MODULES) {
  let c = fs.readFileSync(path.join(SRC, m), 'utf8');
  c = c.replace(/^export\s*\{[^}]*\}\s*;?\s*$/gm, '');
  c = c.replace(/^export\s+default\s+.*$/gm, '');
  if (/^\s*export\s/m.test(c)) { console.error('residual export in ' + m); process.exit(2); }
  combined += c + '\n';
}

// ---- browser stubs ------------------------------------------------------
const androidCalls = { engineEval: [], engineEvalDeep: [], stopPonder: 0 };
const elStub = () => ({ style: {}, classList: { add(){}, remove(){}, toggle(){}, contains(){return false} },
  addEventListener(){}, removeEventListener(){}, appendChild(){}, setAttribute(){}, getAttribute(){return null},
  querySelector(){return null}, querySelectorAll(){return []}, innerHTML: '', textContent: '', title: '',
  clientHeight: 100, clientWidth: 100, getContext(){ return null; }, remove(){}, focus(){}, click(){},
  dataset: {}, disabled: false, value: '', checked: false });

const sandbox = {
  console, setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask,
  Date, Math, JSON, Number, String, Array, Object, Map, Set, Promise, RegExp, Error, Symbol,
  parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent,
  Intl, performance: { now: () => Date.now() },
  requestAnimationFrame: (fn) => setTimeout(fn, 0),
  cancelAnimationFrame: (id) => clearTimeout(id),
  localStorage: { _m: new Map(), getItem(k){ return this._m.has(k)?this._m.get(k):null; }, setItem(k,v){ this._m.set(k,String(v)); }, removeItem(k){ this._m.delete(k); }, clear(){ this._m.clear(); } },
  navigator: { language: 'zh-CN', userAgent: 'Mozilla/5.0 (Linux; Android 15) Chrome/120.0.0.0' },
  location: { href: 'file:///android_asset/chess.html', protocol: 'file:' },
  document: {
    getElementById(){ return null; },
    querySelector(){ return null; },
    querySelectorAll(){ return []; },
    createElement(){ return elStub(); },
    createTextNode(){ return {}; },
    addEventListener(){}, removeEventListener(){},
    body: elStub(), documentElement: elStub(), head: elStub(),
    hidden: false, visibilityState: 'visible',
  },
  AndroidBridge: {
    isEngineReady(){ return true; },
    isPondering(){ return false; },
    stopPonder(){ androidCalls.stopPonder++; },
    engineEval(fen){ androidCalls.engineEval.push(fen); },
    engineEvalDeep(fen){ androidCalls.engineEvalDeep.push(fen); },
    engineEvalDeepBeginBatch(){}, engineEvalDeepEndBatch(){},
    updateEngineNotification(){}, hapticFeedback(){}, isHapticEnabled(){ return false; },
    showToast(){}, getSetting(){ return null; }, setSetting(){},
    exitApp(){}, keepScreenOn(){}, logD(){},
  },
  AudioContext: undefined, webkitAudioContext: undefined,
  Worker: undefined, // force sync fallback paths
  Image: function(){ return {}; },
  fetch: undefined,
  addEventListener(){}, removeEventListener(){}, dispatchEvent(){ return true; },
  matchMedia(){ return { matches: false, addEventListener(){}, removeEventListener(){} }; },
  getComputedStyle(){ return { getPropertyValue(){ return ''; } }; },
  innerWidth: 400, innerHeight: 800, devicePixelRatio: 2,
  btoa(s){ return Buffer.from(s,'binary').toString('base64'); },
  atob(s){ return Buffer.from(s,'base64').toString('binary'); },
};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

try {
  vm.runInContext(combined, sandbox, { filename: 'bundle.js' });
} catch (e) {
  console.error('BUNDLE LOAD FAILED:', e.message);
  process.exit(3);
}

// ---- test helpers -------------------------------------------------------
let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}
function run(code) { return vm.runInContext(code, sandbox); }

// Wait until async init settles (engine ready path may be timer-driven)
function flushTimers() {
  return new Promise((resolve) => {
    const t = setInterval(() => {
      if (sandbox._engineReady === true) { clearInterval(t); resolve(); }
    }, 10);
    setTimeout(() => { clearInterval(t); resolve(); }, 2000);
  });
}

(async () => {
  await flushTimers();
  // Force engine-ready state in case init is stubbed out
  run(`if(typeof _engineReady!=='undefined') _engineReady=true;`);

  console.log('[suite] load & smoke');
  ok(run(`typeof onEngineEval`) === 'function', 'onEngineEval exported into scope');
  ok(run(`typeof requestEngineEval`) === 'function', 'requestEngineEval present');
  ok(run(`typeof _evalLastDispatchedFen`) !== 'undefined', 'round-52 _evalLastDispatchedFen declared');
  ok(run(`Array.isArray(_evalRecentDispatches)`), 'round-52 _evalRecentDispatches ring declared');

  // ---------- Scenario A: normal mode, fast move → stale previous-pos callback
  console.log('[A] normal mode: late previous-position callback dropped');
  // helper: apply a move at state level (bypasses UI-heavy executeMove)
  run(`
    function _hMv(s, fromSq, toSq){
      const f={row:8-parseInt(fromSq[1],10), col:fromSq.charCodeAt(0)-97};
      const t={row:8-parseInt(toSq[1],10), col:toSq.charCodeAt(0)-97};
      const p=s.board[f.row][f.col];
      const undo=makeMvInPlace(s,{from:f,to:t,piece:p,promotion:null});
      if(!undo) throw new Error('illegal move '+fromSq+toSq);
    }
    reviewMode=false; setupMode=false; gameOver=false; playerColor='white';
    gameState=initState();
    _sfEval=null; _sfEvalReady=false; _evalLoading=false;
    requestEngineEval();           // dispatches engineEval(fenStart)
  `);
  ok(androidCalls.engineEval.length === 1, 'A1: first eval dispatched');
  const fenStart = androidCalls.engineEval[0];
  ok(run(`_evalLastDispatchedFen`) === fenStart, 'A2: dispatched fen recorded');

  // user plays e2e4 and the reply comes back almost instantly → new dispatch
  run(`
    _hMv(gameState,'e2','e4');   // black to move (AI)
    _hMv(gameState,'e7','e5');   // white to move again — player's turn
    requestEngineEval();         // dispatches engineEval(fen2)
  `);
  ok(androidCalls.engineEval.length === 2, 'A3: second eval dispatched');
  const fen2 = androidCalls.engineEval[1];
  ok(fen2 !== fenStart, 'A4: fens differ');
  ok(run(`_evalLastDispatchedFen`) === fen2, 'A5: dispatched fen updated');

  // late callback for fenStart arrives — must be dropped
  run(`onEngineEval(150,null,15,400,350,250,20,${JSON.stringify(fenStart)});`);
  ok(run(`_sfEvalReady`) === false, 'A6: stale callback did NOT mark eval ready');
  ok(run(`_sfEval`) === null, 'A7: stale callback did NOT overwrite _sfEval');

  // the real callback for fen2 arrives — must be accepted
  run(`onEngineEval(33,null,15,450,350,200,20,${JSON.stringify(fen2)});`);
  ok(run(`_sfEvalReady`) === true, 'A8: current callback accepted');
  ok(run(`_sfEval`) === 33, 'A9: current callback value correct (got ' + run(`_sfEval`) + ')');

  // ---------- Scenario E: duplicate callback for current fen — idempotent
  console.log('[E] duplicate callback for current fen');
  run(`onEngineEval(33,null,15,450,350,200,20,${JSON.stringify(fen2)});`);
  ok(run(`_sfEval`) === 33, 'E1: duplicate harmless');

  // ---------- Scenario C: legacy 7-arg callback (no reqFen) still accepted
  console.log('[C] legacy 7-arg path');
  run(`requestEngineEval();`); // same fen → same dispatched fen, gen re-armed
  run(`onEngineEval(44,null,15,450,350,200,20);`);
  ok(run(`_sfEval`) === 44, 'C1: legacy callback accepted (got ' + run(`_sfEval`) + ')');

  // ---------- Scenario B: review mode stale callback cached under MATCHED step
  console.log('[B] review mode: stale callback cached under matched step');
  run(`
    // build a 3-move review session directly (enterReview's UI pipeline is
    // out of harness scope; reviewStates entries mirror its exact shape)
    var _s0=initState();
    var _s1=cloneS(_s0); _hMv(_s1,'e2','e4');
    var _s2=cloneS(_s1); _hMv(_s2,'e7','e5');
    var _s3=cloneS(_s2); _hMv(_s3,'g1','f3');
    reviewMode=true; reviewStep=0;
    reviewStates=[{state:_s0},{state:_s1},{state:_s2},{state:_s3}];
    moveRecords=[{san:'e4'},{san:'e5'},{san:'Nf3'}]; // reviewAnalyzeAll sizes from moveRecords.length
    _reviewEvalCache.clear();
    _evalRecentDispatches.length=0;
    _evalLastDispatchedFen=null;
    _sfEval=null; _sfEvalReady=false; _evalLoading=false;
  `);
  await new Promise(r => setTimeout(r, 50));
  const rsLen = run(`reviewStates.length`);
  ok(rsLen === 4, 'B1: review has 4 states (got ' + rsLen + ')');
  const fenStep0 = run(`_sanitizeFenForEngine(generateFEN(reviewStates[0].state))`);
  const fenStep2 = run(`_sanitizeFenForEngine(generateFEN(reviewStates[2].state))`);

  // navigate to step 0, let the 300ms debounce dispatch
  run(`reviewStep=0; requestEngineEval();`);
  await new Promise(r => setTimeout(r, 400));
  ok(androidCalls.engineEvalDeep.length >= 1, 'B2: step-0 eval dispatched');
  // quickly navigate to step 2 → new dispatch
  run(`reviewStep=2; requestEngineEval();`);
  await new Promise(r => setTimeout(r, 400));
  ok(androidCalls.engineEvalDeep.length >= 2, 'B3: step-2 eval dispatched');
  ok(run(`_evalLastDispatchedFen`) === fenStep2, 'B4: dispatched fen is step-2 fen');

  // stale step-0 callback arrives — must NOT display on step 2, MUST cache under step 0
  // step0: white to move next? step0 = initial position, white to move; score +120 cp white-POV
  run(`onEngineEval(120,null,22,500,300,200,28,${JSON.stringify(fenStep0)});`);
  ok(run(`reviewStep`) === 2, 'B5: still on step 2');
  const disp = run(`_sfEval`);
  ok(disp !== 120, 'B6: stale step-0 value NOT displayed on step 2 (sfEval=' + disp + ')');
  const cached0 = run(`_reviewEvalCache.get(0)`);
  ok(cached0 && cached0.eval === 120, 'B7: stale value cached under step 0 correctly');

  // POV check: stale callback for a BLACK-to-move step must be sign-flipped for that step.
  // Navigate to step 3 (white to move after Nf3? no: step3 = after 2.Nf3 → black to move).
  const fenStep3 = run(`_sanitizeFenForEngine(generateFEN(reviewStates[3].state))`);
  run(`reviewStep=1; requestEngineEval();`);   // dispatch for step1 (black to move)
  await new Promise(r => setTimeout(r, 400));
  const fenStep1 = run(`_sanitizeFenForEngine(generateFEN(reviewStates[1].state))`);
  run(`reviewStep=3; requestEngineEval();`);   // newer dispatch for step3
  await new Promise(r => setTimeout(r, 400));
  // stale callback for step1 (black to move), engine says cp=+50 (black POV) → white-POV −50
  run(`onEngineEval(50,null,22,400,300,300,28,${JSON.stringify(fenStep1)});`);
  const cached1 = run(`_reviewEvalCache.get(1)`);
  ok(cached1 && cached1.eval === -50, 'B8: black-to-move stale eval sign-flipped to White POV (got '
     + (cached1 ? cached1.eval : 'none') + ')');
  ok(run(`_reviewEvalCache.get(3)`) === undefined, 'B9: step 3 cache NOT poisoned by step-1 result');

  // the current step-3 callback still works
  run(`onEngineEval(60,null,22,450,300,250,28,${JSON.stringify(fenStep3)});`);
  ok(run(`_reviewEvalCache.get(3)`) && run(`_reviewEvalCache.get(3).eval`) === -60,
     'B10: step-3 (black to move) result cached with correct sign (got '
     + (run(`_reviewEvalCache.get(3)`)||{}).eval + ')');

  // ---------- Scenario D: batch analyze-all round-trip unaffected
  console.log('[D] batch path round-trip');
  run(`_reviewEvalCache.clear(); reviewAnalyzeAll();`);
  await new Promise(r => setTimeout(r, 300));
  const bd = run(`_batchLastDispatched`);
  ok(bd && typeof bd.fen === 'string' && bd.fen.length > 10, 'D1: batch dispatch recorded with fen');
  // answer the batch's step-0 callback with the correct fen
  run(`onEngineEval(25,null,22,460,320,220,28,_batchLastDispatched.fen);`);
  await new Promise(r => setTimeout(r, 100));
  ok(run(`_reviewEvalCache.get(0)`) && run(`_reviewEvalCache.get(0).eval`) === 25,
     'D2: batch step-0 cached and batch advanced');
  // drain the batch by answering until done
  for (let i = 0; i < 10; i++) {
    const b = run(`_batchLastDispatched`);
    if (!b) break;
    run(`onEngineEval(30,null,22,460,320,220,28,_batchLastDispatched.fen);`);
    await new Promise(r => setTimeout(r, 60));
  }
  // round-54 (PR56 CR#13): actually ASSERT the batch finished — previously the
  //   flag was read into doneTxt and discarded, so a still-active batch would
  //   have passed D3.
  ok(run(`_reviewAnalyzeAllActive`) === false, 'D3a: batch finished (active flag cleared)');
  ok(run(`_reviewEvalCache.size`) === 4, 'D3: batch cached all 4 steps (got ' + run(`_reviewEvalCache.size`) + ')');

  console.log('\n===== RESULT: ' + pass + ' passed, ' + fail + ' failed =====');
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('HARNESS ERROR:', e); process.exit(2); });
