// ===================== MODULE: worker-pool =====================
// Web Worker pool for offloading heavy computations from the UI thread.
//
// v1.0.8 PHASE 34: Originally wired into the PGN import path
//   (importPGNAsync) to offload PGN tokenization. v1.0.8 PHASE 49 removed
//   that call site because importPGNAsync discarded the worker result and
//   re-parsed synchronously anyway (zero offloading benefit, double CPU).
//   The pool is retained as infrastructure for future offloading and is
//   still exercised by stats.html's separate inline worker (which does
//   consume its result). The API (workerParsePGN / terminateWorkerPool)
//   remains stable.
//
// Design (first-principles robustness):
//   - Pool of N workers (N = min(hardwareConcurrency, 4)), created lazily.
//   - Each worker is a Blob-URL worker (CSP allows worker-src blob:).
//   - The worker source is a self-contained JS string with a fixed switch
//     statement for each task type. Adding a new task type requires adding
//     a new case (no dynamic evaluation — CSP 'unsafe-eval' not needed).
//   - Fallback: if Worker creation fails OR the task is unknown, tasks run
//     synchronously on the main thread via _syncFallback.
//   - Task cancellation: each task has a 30s timeout. If exceeded, the worker
//     is terminated and replaced.
//   - taskId map for concurrent task resolution (Phase 26 race-condition fix).
//   - Queue cap (_MAX_QUEUE_SIZE=50) prevents unbounded growth.
//   - pagehide cleanup terminates all workers + rejects pending promises.
//
// Copyright (C) 2026 Regalia
//
// PGN tokenization and chess control-map logic derived from DroidFish
// (Copyright (C) Peter Österlund, GPL v3)
// Modified by Regalia on 2026-06-15
//
// AI-GEN: AI assisted
// This code was AI-assisted and has been reviewed for GPL v3 compliance.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.

// === Pool state ===
let _workerPool = [];
let _poolSize = 0;
let _workerSupported = (typeof Worker !== 'undefined');
// v1.1.2 PHASE 71: consecutive-failure counter for _createWorker(). Reset to
// 0 on success; incremented on failure. When >= 3, _workerSupported is set
// false (pool disabled). This prevents a single transient OOM from
// permanently disabling the worker pool for the page lifetime.
let _workerCreateFailures = 0;
let _nextTaskId = 1;
const _pendingTasks = new Map(); // taskId -> {resolve, reject, worker, timeout}
const _MAX_QUEUE_SIZE = 50;

// === Worker source code (self-contained, no external deps, no eval) ===
// v1.0.8 PHASE 28: Functions are inlined as cases in a switch statement.
//   This avoids `new Function()` / `eval()` which require CSP 'unsafe-eval'.
// v1.0.8 PHASE 34: parsePGNText now does FULL tokenization (headers, comments,
//   variations, movetext) matching the main-thread _parsePGN lexer so the
//   result can be consumed by the structural parser without re-tokenizing.
const _WORKER_SRC = `
self.onmessage = function(e) {
  var msg = e.data;
  if (msg.type !== 'run') return;
  var taskId = msg.taskId;
  var fnName = msg.fnName;
  var args = msg.args;
  try {
    var result;
    if (fnName === 'parsePGNText') {
      result = _parsePGNText(args[0]);
    } else if (fnName === 'computeHeatmapStats') {
      result = _computeHeatmapStats(args[0]);
    } else {
      self.postMessage({type: 'error', taskId: taskId, error: 'Unknown function: ' + fnName});
      return;
    }
    // Use Promise.resolve to handle both sync and async return paths uniformly
    Promise.resolve(result).then(function(r) {
      self.postMessage({type: 'result', taskId: taskId, result: r});
    }).catch(function(err) {
      self.postMessage({type: 'error', taskId: taskId, error: String(err?.message || err)});
    });
  } catch (err) {
    self.postMessage({type: 'error', taskId: taskId, error: String(err?.message || err)});
  }
};
// === PGN tokenizer (full lexer — mirrors tablebase.js _parsePGN tokenization) ===
// Returns {headers, tokens, variations, comments, cslAnnotations, calAnnotations,
//          evals, startFEN, result} — all the raw data the structural parser needs.
function _parsePGNText(pgnText) {
  if (!pgnText || typeof pgnText !== 'string') return null;
  // Remove BOM
  if (pgnText.charCodeAt(0) === 0xFEFF) pgnText = pgnText.substring(1);
  // Normalize line endings
  var text = pgnText.replace(/\\r\\n/g, '\\n').replace(/\\r/g, '\\n');
  // Strip PGN escape lines (% in column 0)
  text = text.replace(/^%.*$/gm, '');
  // Replace non-breaking spaces
  text = text.replace(/\\u00a0/g, ' ');
  // Handle multiple games: only parse the first game
  var gameBlocks = text.split(/\\n\\s*\\n(?=\\[)/);
  if (gameBlocks.length > 1) text = gameBlocks[0];
  // Extract FEN from headers
  var startFEN = null;
  var fenMatch = text.match(/\\[FEN\\s+"([^"]+)"\\]/i);
  if (fenMatch) { startFEN = fenMatch[1]; }
  else {
    var fenNoQuoteMatch = text.match(/\\[FEN\\s+([^\\]\\n]+)\\]/i);
    if (fenNoQuoteMatch) { startFEN = fenNoQuoteMatch[1].trim(); }
  }
  // Extract headers
  var headers = {};
  // v1.2.3 round-18 (bug fix): consume the closing bracket too. Without
  //   the trailing bracket the replace below left a stray ']' token per
  //   header, polluting the movetext token stream (7-tag roster = 7 junk
  //   tokens). NOTE: no backticks here — inside the Worker template string.
  var headerRe = /\\[(\\w+)\\s+"((?:[^"\\\\]|\\\\.)*)"\\]/g;
  var m;
  while ((m = headerRe.exec(text)) !== null) {
    headers[m[1]] = m[2].replace(/\\\\"/g, '"').replace(/\\\\\\\\/g, '\\\\');
  }
  // Remove header lines
  text = text.replace(headerRe, '');
  // Remove rest-of-line comments (;)
  text = text.replace(/;[^\\n]*/g, '');
  // Remove brace comments, but extract [%csl], [%cal], [%eval] first
  var comments = [];
  var cslAnnotations = [];
  var calAnnotations = [];
  var evals = [];
  var cslRe = /\\[%csl\\s+([^\\]]*)\\]/g;
  var calRe = /\\[%cal\\s+([^\\]]*)\\]/g;
  var evalRe = /\\[%eval\\s+([^\\]]*)\\]/g;
  var iter = 0;
  // v1.2.3 round-38 (SonarCloud S7765): use .includes() instead of .indexOf() >= 0.
  while (text.includes('{') && iter++ < 20) {
    var prev = text;
    // Extract annotations from comments before removing them
    var cm;
    while ((cm = cslRe.exec(text)) !== null) { cslAnnotations.push(cm[1].trim()); }
    while ((cm = calRe.exec(text)) !== null) { calAnnotations.push(cm[1].trim()); }
    while ((cm = evalRe.exec(text)) !== null) { evals.push(cm[1].trim()); }
    text = text.replace(/\\{[^{}]*\\}/g, function(match) {
      comments.push(match.substring(1, match.length - 1));
      return '';
    });
    if (text === prev) break;
  }
  text = text.replace(/[{}]/g, ' ');
  // Extract variations (parenthesized)
  var variations = [];
  var depth = 0, start = -1;
  for (var i = 0; i < text.length; i++) {
    if (text[i] === '(') { if (depth === 0) start = i + 1; depth++; }
    else if (text[i] === ')') { depth--; if (depth === 0 && start >= 0) { variations.push(text.substring(start, i)); start = -1; } }
  }
  // Remove variations from movetext
  var movetext = '';
  depth = 0;
  for (var i = 0; i < text.length; i++) {
    if (text[i] === '(') { depth++; continue; }
    if (text[i] === ')') { if (depth > 0) depth--; continue; }
    if (depth === 0) movetext += text[i];
  }
  // Clean up movetext
  movetext = movetext.replace(/\\d+\\.+/g, ' '); // v1.2.3 (S8786): (\d+\.+)* 尾组对 replace 语义冗余，去除嵌套量词
  movetext = movetext.replace(/\\$\\d+/g, ' ');
  var result = '*';
  var resultMatch = movetext.match(/(1-0|0-1|1\\/2-1\\/2|\\*)/);
  if (resultMatch) { result = resultMatch[1]; }
  movetext = movetext.replace(/(1-0|0-1|1\\/2-1\\/2|\\*)/g, ' ');
  movetext = movetext.replace(/\\s+/g, ' ').trim();
  var tokens = movetext ? movetext.split(' ').filter(function(t) { return t.length > 0; }) : [];
  return {
    headers: headers,
    tokens: tokens,
    variations: variations,
    comments: comments,
    cslAnnotations: cslAnnotations,
    calAnnotations: calAnnotations,
    evals: evals,
    startFEN: startFEN,
    result: result
  };
}
// === Heatmap stats (mirrors stats.html worker logic) ===
function _computeHeatmapStats(boards) {
  function attacked(board, pos) {
    var p = board[pos.row][pos.col]; if (!p) return [];
    var r = pos.row, c = pos.col, co = p.color, mv = [];
    if (p.type === 'pawn') {
      var d = co === 'white' ? -1 : 1;
      if (r+d >= 0 && r+d < 8 && c-1 >= 0 && c-1 < 8) mv.push({row: r+d, col: c-1});
      if (r+d >= 0 && r+d < 8 && c+1 >= 0 && c+1 < 8) mv.push({row: r+d, col: c+1});
    } else if (p.type === 'knight') {
      var offs = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
      for (var i = 0; i < offs.length; i++) {
        var nr = r+offs[i][0], nc = c+offs[i][1];
        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) mv.push({row: nr, col: nc});
      }
    } else if (p.type === 'king') {
      for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        if (r+dr >= 0 && r+dr < 8 && c+dc >= 0 && c+dc < 8) mv.push({row: r+dr, col: c+dc});
      }
    } else {
      var dirs = p.type === 'rook' ? [[-1,0],[1,0],[0,-1],[0,1]]
        : p.type === 'bishop' ? [[-1,-1],[-1,1],[1,-1],[1,1]]
        : [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
      for (var i = 0; i < dirs.length; i++) {
        var nr = r+dirs[i][0], nc = c+dirs[i][1];
        while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
          mv.push({row: nr, col: nc}); if (board[nr][nc]) break;
          nr += dirs[i][0]; nc += dirs[i][1];
        }
      }
    }
    return mv;
  }
  var ctrlW = [[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0]];
  var ctrlB = [[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0]];
  var posCount = 0;
  for (var bi = 0; bi < boards.length; bi++) {
    var b = boards[bi];
    for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
      var p = b[r][c]; if (!p) continue;
      var atks = attacked(b, {row: r, col: c});
      for (var ai = 0; ai < atks.length; ai++) {
        var a = atks[ai];
        if (p.color === 'white') ctrlW[a.row][a.col]++; else ctrlB[a.row][a.col]++;
      }
    }
    posCount++;
  }
  return { ctrlW: ctrlW, ctrlB: ctrlB, posCount: posCount };
}
`;

// === Pool management ===
function _getPoolSize() {
  if (_poolSize > 0) return _poolSize;
  try {
    const hc = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 2;
    _poolSize = Math.max(1, Math.min(hc, 4));
  } catch (e) { _poolSize = 2; }
  return _poolSize;
}

function _createWorker() {
  if (!_workerSupported) return null;
  // v1.0.8 PHASE 49: hoist `url` so the catch block can revoke it if
  //   `new Worker(url)` throws. The old block-scoped declaration leaked the
  //   Blob URL on every failed worker-creation attempt.
  let url = null;
  try {
    const blob = new Blob([_WORKER_SRC], {type: 'application/javascript'});
    url = URL.createObjectURL(blob);
    const w = new Worker(url);
    w._url = url;
    url = null; // ownership transferred to w._url; revoke on worker teardown
    w._busy = false;
    w.onmessage = function(e) {
      const msg = e.data;
      if (!msg || !msg.taskId) return;
      const task = _pendingTasks.get(msg.taskId);
      if (!task) return;
      _pendingTasks.delete(msg.taskId);
      task.worker._busy = false;
      if (task.timeout) { clearTimeout(task.timeout); task.timeout = null; }
      if (msg.type === 'result') task.resolve(msg.result);
      else task.reject(new Error(msg.error || 'Worker error'));
      _dispatchNext();
    };
    w.onerror = function(e) {
      // Collect tasks to reject before mutating the map (avoid iterate-while-mutate)
      const toReject = [];
      for (const [tid, task] of _pendingTasks) {
        if (task.worker === w) toReject.push([tid, task]);
      }
      for (const [tid, task] of toReject) {
        _pendingTasks.delete(tid);
        if (task.timeout) { clearTimeout(task.timeout); task.timeout = null; }
        // v1.2.3 round-29 (PR52 S6551): use String(e) instead of bare `e` so
        //   ErrorEvent / Event objects stringify meaningfully instead of
        //   "[object Object]". When e is a string (legacy onerror contract)
        //   String(e) returns it unchanged.
        task.reject(new Error('Worker crashed: ' + (e?.message || String(e))));
      }
      w._busy = false;
      _removeWorker(w);
      _dispatchNext();
    };
    // v1.1.2 Phase 69 (Web Worker guide §6.1): onmessageerror fires when the
    //   message data cannot be deserialized (structured clone failure). Without
    //   this handler, such failures would silently leave the task's promise
    //   hanging until the 30s timeout. Now we reject immediately and recycle
    //   the worker (a serialization failure usually indicates a corrupted
    //   worker state — safer to terminate and replace).
    w.onmessageerror = function(e) {
      const toReject = [];
      for (const [tid, task] of _pendingTasks) {
        if (task.worker === w) toReject.push([tid, task]);
      }
      for (const [tid, task] of toReject) {
        _pendingTasks.delete(tid);
        if (task.timeout) { clearTimeout(task.timeout); task.timeout = null; }
        task.reject(new Error('Worker message serialization error'));
      }
      w._busy = false;
      _removeWorker(w);
      _dispatchNext();
    };
    // v1.1.2 PHASE 71: reset the consecutive-failure counter on success — a
    // single successful creation proves the pool is still functional.
    _workerCreateFailures = 0;
    return w;
  } catch (e) {
    if (url) { try { URL.revokeObjectURL(url); } catch (_) {} }
    // v1.1.2 PHASE 71 (robustness): do NOT permanently disable the worker pool
    // on a single transient failure (e.g. transient OOM, Blob URL quota
    // exhaustion). Previously `_workerSupported = false` was set on any error,
    // disabling the pool for the entire page lifetime — even if the next
    // _createWorker() call would have succeeded. We now track a consecutive-
    // failure counter and only disable after 3 consecutive failures. A
    // successful _createWorker() resets the counter. This mirrors the
    // resilience pattern recommended for transient resource-exhaustion errors.
    _workerCreateFailures = (_workerCreateFailures || 0) + 1;
    if (_workerCreateFailures >= 3) {
      _workerSupported = false;
    }
    return null;
  }
}

function _removeWorker(w) {
  const idx = _workerPool.indexOf(w);
  if (idx >= 0) _workerPool.splice(idx, 1);
  try { w.terminate(); } catch (e) {}
  try { if (w._url) URL.revokeObjectURL(w._url); } catch (e) {}
}

function _getIdleWorker() {
  for (const w of _workerPool) {
    if (!w._busy) return w;
  }
  if (_workerPool.length < _getPoolSize()) {
    const w = _createWorker();
    if (w) { _workerPool.push(w); return w; }
  }
  return null;
}

// === Task queue ===
const _taskQueue = [];

function _dispatchNext() {
  while (_taskQueue.length > 0) {
    const w = _getIdleWorker();
    if (!w) break;
    const task = _taskQueue.shift();
    w._busy = true;
    task.worker = w;
    _pendingTasks.set(task.taskId, task);
    w.postMessage({type: 'run', taskId: task.taskId, fnName: task.fnName, args: task.args});
  }
}

// === Public API ===

// v1.2.3 round-37 (SonarCloud S7760): use default parameter syntax
//   `timeoutMs = 30000` instead of `timeoutMs = timeoutMs || 30000`.
//   Default params apply only when the argument is `undefined` (not other
//   falsy values like 0), which is the correct semantics here — a caller
//   passing `timeoutMs = 0` previously got 30000 (bug!); now they get 0
//   (intentional, though unusual). No current caller passes 0, so behavior
//   is unchanged for all existing call sites.
function workerRun(fnName, args, timeoutMs = 30000) {
  if (!_workerSupported) {
    // v1.0.8 PHASE 35: defer into Promise chain so sync throws (unknown fnName)
    //   become rejected Promises instead of synchronous throws out of workerRun.
    return Promise.resolve().then(function() { return _syncFallback(fnName, args); });
  }
  return new Promise(function(resolve, reject) {
    const taskId = _nextTaskId++;
    const task = {
      taskId: taskId,
      fnName: fnName,
      args: args,
      worker: null,
      resolve: resolve,
      reject: reject,
      timeout: null
    };
    task.timeout = setTimeout(function() {
      _pendingTasks.delete(taskId);
      if (task.worker) {
        task.worker._busy = false;
        _removeWorker(task.worker);
      } else {
        // v1.0.8 PHASE 35: task was still queued (no worker assigned) — splice
        //   it from _taskQueue to prevent a ghost dispatch later.
        const idx = _taskQueue.indexOf(task);
        if (idx >= 0) _taskQueue.splice(idx, 1);
      }
      reject(new Error('Worker timeout after ' + timeoutMs + 'ms for ' + fnName));
      _dispatchNext();
    }, timeoutMs);
    // Cap the queue to prevent unbounded growth
    if (_taskQueue.length >= _MAX_QUEUE_SIZE) {
      clearTimeout(task.timeout);
      reject(new Error('Worker pool queue full (' + _MAX_QUEUE_SIZE + ') for ' + fnName));
      return;
    }
    _taskQueue.push(task);
    _dispatchNext();
  });
}

// Synchronous fallback — runs the function on the main thread
function _syncFallback(fnName, args) {
  if (fnName === 'parsePGNText') {
    return _syncParsePGNText(args[0]);
  } else if (fnName === 'computeHeatmapStats') {
    return _syncComputeHeatmapStats(args[0]);
  }
  throw new Error('Unknown worker function: ' + fnName);
}

// Inline sync implementations (mirror the worker source for fallback)
function _syncParsePGNText(pgnText) {
  if (!pgnText || typeof pgnText !== 'string') return null;
  if (pgnText.charCodeAt(0) === 0xFEFF) pgnText = pgnText.substring(1);
  var text = pgnText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  text = text.replace(/^%.*$/gm, '');
  text = text.replace(/\u00a0/g, ' ');
  var gameBlocks = text.split(/\n\s*\n(?=\[)/);
  if (gameBlocks.length > 1) text = gameBlocks[0];
  var startFEN = null;
  var fenMatch = text.match(/\[FEN\s+"([^"]+)"\]/i);
  if (fenMatch) { startFEN = fenMatch[1]; }
  else {
    var fenNoQuoteMatch = text.match(/\[FEN\s+([^\]\n]+)\]/i);
    if (fenNoQuoteMatch) { startFEN = fenNoQuoteMatch[1].trim(); }
  }
  var headers = {};
  // v1.2.3 round-18 (bug fix): consume the closing bracket too (sync mirror
  //   of the worker-side fix above — keep both copies semantically identical).
  var headerRe = /\[(\w+)\s+"((?:[^"\\]|\\.)*)"\]/g;
  var m;
  while ((m = headerRe.exec(text)) !== null) {
    headers[m[1]] = m[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  text = text.replace(headerRe, '');
  text = text.replace(/;[^\n]*/g, '');
  var comments = [];
  var cslAnnotations = [];
  var calAnnotations = [];
  var evals = [];
  var cslRe = /\[%csl\s+([^\]]*)\]/g;
  var calRe = /\[%cal\s+([^\]]*)\]/g;
  var evalRe = /\[%eval\s+([^\]]*)\]/g;
  var iter = 0;
  // v1.2.3 round-38 (SonarCloud S7765): use .includes() instead of .indexOf() >= 0.
  while (text.includes('{') && iter++ < 20) {
    var prev = text;
    var cm;
    while ((cm = cslRe.exec(text)) !== null) { cslAnnotations.push(cm[1].trim()); }
    while ((cm = calRe.exec(text)) !== null) { calAnnotations.push(cm[1].trim()); }
    while ((cm = evalRe.exec(text)) !== null) { evals.push(cm[1].trim()); }
    text = text.replace(/\{[^{}]*\}/g, function(match) {
      comments.push(match.substring(1, match.length - 1));
      return '';
    });
    if (text === prev) break;
  }
  text = text.replace(/[{}]/g, ' ');
  var variations = [];
  var depth = 0, start = -1;
  for (var i = 0; i < text.length; i++) {
    if (text[i] === '(') { if (depth === 0) start = i + 1; depth++; }
    else if (text[i] === ')') { depth--; if (depth === 0 && start >= 0) { variations.push(text.substring(start, i)); start = -1; } }
  }
  var movetext = '';
  depth = 0;
  for (var i = 0; i < text.length; i++) {
    if (text[i] === '(') { depth++; continue; }
    if (text[i] === ')') { if (depth > 0) depth--; continue; }
    if (depth === 0) movetext += text[i];
  }
  movetext = movetext.replace(/\d+\.+/g, ' '); // v1.2.3 (S8786): (\d+\.+)* 尾组对 replace 语义冗余，去除嵌套量词
  movetext = movetext.replace(/\$\d+/g, ' ');
  var result = '*';
  var resultMatch = movetext.match(/(1-0|0-1|1\/2-1\/2|\*)/);
  if (resultMatch) { result = resultMatch[1]; }
  movetext = movetext.replace(/(1-0|0-1|1\/2-1\/2|\*)/g, ' ');
  movetext = movetext.replace(/\s+/g, ' ').trim();
  var tokens = movetext ? movetext.split(' ').filter(function(t) { return t.length > 0; }) : [];
  return {
    headers: headers,
    tokens: tokens,
    variations: variations,
    comments: comments,
    cslAnnotations: cslAnnotations,
    calAnnotations: calAnnotations,
    evals: evals,
    startFEN: startFEN,
    result: result
  };
}

function _syncComputeHeatmapStats(boards) {
  function attacked(board, pos) {
    var p = board[pos.row][pos.col]; if (!p) return [];
    var r = pos.row, c = pos.col, co = p.color, mv = [];
    if (p.type === 'pawn') {
      var d = co === 'white' ? -1 : 1;
      if (r+d >= 0 && r+d < 8 && c-1 >= 0 && c-1 < 8) mv.push({row: r+d, col: c-1});
      if (r+d >= 0 && r+d < 8 && c+1 >= 0 && c+1 < 8) mv.push({row: r+d, col: c+1});
    } else if (p.type === 'knight') {
      var offs = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
      for (var i = 0; i < offs.length; i++) {
        var nr = r+offs[i][0], nc = c+offs[i][1];
        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) mv.push({row: nr, col: nc});
      }
    } else if (p.type === 'king') {
      for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        if (r+dr >= 0 && r+dr < 8 && c+dc >= 0 && c+dc < 8) mv.push({row: r+dr, col: c+dc});
      }
    } else {
      var dirs = p.type === 'rook' ? [[-1,0],[1,0],[0,-1],[0,1]]
        : p.type === 'bishop' ? [[-1,-1],[-1,1],[1,-1],[1,1]]
        : [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
      for (var i = 0; i < dirs.length; i++) {
        var nr = r+dirs[i][0], nc = c+dirs[i][1];
        while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
          mv.push({row: nr, col: nc}); if (board[nr][nc]) break;
          nr += dirs[i][0]; nc += dirs[i][1];
        }
      }
    }
    return mv;
  }
  var ctrlW = [[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0]];
  var ctrlB = [[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0]];
  var posCount = 0;
  for (var bi = 0; bi < boards.length; bi++) {
    var b = boards[bi];
    for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
      var p = b[r][c]; if (!p) continue;
      var atks = attacked(b, {row: r, col: c});
      for (var ai = 0; ai < atks.length; ai++) {
        var a = atks[ai];
        if (p.color === 'white') ctrlW[a.row][a.col]++; else ctrlB[a.row][a.col]++;
      }
    }
    posCount++;
  }
  return { ctrlW: ctrlW, ctrlB: ctrlB, posCount: posCount };
}

// === Convenience wrappers ===

function workerParsePGN(pgnText, timeoutMs) {
  return workerRun('parsePGNText', [pgnText], timeoutMs);
}

function workerComputeHeatmapStats(serializedBoards, timeoutMs) {
  return workerRun('computeHeatmapStats', [serializedBoards], timeoutMs);
}

function terminateWorkerPool() {
  for (const w of _workerPool) {
    try { w.terminate(); } catch (e) {}
    try { if (w._url) URL.revokeObjectURL(w._url); } catch (e) {}
  }
  _workerPool = [];
  // v1.0.8 PHASE 35: reject in-flight (dispatched) tasks
  for (const [tid, task] of _pendingTasks) {
    if (task.timeout) { clearTimeout(task.timeout); task.timeout = null; }
    try { task.reject(new Error('Pool terminated')); } catch (e) {}
  }
  _pendingTasks.clear();
  // v1.0.8 PHASE 35: reject queued (not-yet-dispatched) tasks too — previously
  //   these were silently dropped by `_taskQueue.length = 0`, leaving their
  //   promises hanging up to 30s. Now they reject immediately.
  for (const task of _taskQueue) {
    if (task.timeout) { clearTimeout(task.timeout); task.timeout = null; }
    try { task.reject(new Error('Pool terminated')); } catch (e) {}
  }
  _taskQueue.length = 0;
}

// v1.0.8 PHASE 34: Expose globally so callers in tablebase.js / ui.js can use
//   workerParsePGN without ES module imports (the bundled chess.html is a
//   non-module script where top-level function declarations ARE global, but
//   source-module mode requires explicit window assignment).
if (typeof window !== 'undefined') {
  window.workerParsePGN = workerParsePGN;
  window.workerComputeHeatmapStats = workerComputeHeatmapStats;
  window.terminateWorkerPool = terminateWorkerPool;
  window.workerRun = workerRun;
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', function() {
    try { terminateWorkerPool(); } catch (e) {}
  });
}
