// ===================== MODULE: ai-bridge =====================
// Engine communication layer — AndroidBridge callbacks, engine config, eval display
// Depends on: game-logic (for generateFEN, uciToCoords, etc.)
//
// Copyright (C) 2026 Regalia
//
// Engine communication patterns derived from DroidFish
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


// Stockfish evaluation state (declared first to avoid TDZ issues)
let _sfEval=0,_sfEvalReady=false,_evalLoading=false,_engineReady=false;
// Actual search depth reached by Stockfish (0 = not yet computed)
let _sfDepth=0;
// v1.0.4 Rev33: seldepth (selective search depth / tactical depth) from Stockfish.
// Usually >= _sfDepth. 0 = not yet computed / not reported by engine.
let _sfSeldepth=0;
// WDL (Win/Draw/Loss) percentages from Stockfish UCI_ShowWDL — -1 means not available
let _sfWdlW=-1,_sfWdlD=-1,_sfWdlL=-1;
// Mate distance from White's perspective (UCI full moves): positive = White forces mate in N moves, negative = Black forces mate in N moves
// 0 = no mate detected. UCI score mate N gives full moves, not plies.
let _sfMateDistance=0;
// UCI scores are from the SIDE-TO-MOVE's perspective (not White's).
// We convert to White's perspective on receipt; this flag captures whose
// turn it was when the eval was requested, so we can negate correctly.
let _evalForBlackTurn=false;
// Review eval cache: maps reviewStep → {eval: cpValue, mate: mateDistance, depth, wdlW, wdlD, wdlL}
// Avoids re-requesting engine eval for previously visited steps.
// v1.0.2: Persisted to localStorage so it survives app backgrounding / process kill
// on aggressive memory managers (Xiaomi HyperOS 3). On page reload, the cache is
// restored from localStorage and the eval values are immediately available for
// review mode without re-running the engine.
let _reviewEvalCache=new function(){
  const m=new Map();
  // v1.0.7 PHASE 18: Soft cap MAX_ENTRIES=2000 with LRU eviction — see
  // _evictIfOverCap below. Normal single-game use (~80 steps) never triggers
  // eviction; the cap is a safety net for cross-session cache accumulation.
  const STORAGE_KEY='Regalia_reviewEvalCache';
  // v1.0.4 Round-5 Rev20: ROOT-CAUSE FIX for HyperOS 3 cache loss.
  //
  // FIRST-PRINCIPLES ANALYSIS:
  //   1. WebView localStorage is stored at /data/data/com.Regalia/app_webview/Local Storage/leveldb.
  //      HyperOS 3's memory manager classifies this directory as "cache" and clears it
  //      aggressively — sometimes within seconds of the app going to background.
  //   2. SharedPreferences (used by persistentGet/Set) is stored at
  //      /data/data/com.Regalia/shared_prefs/RegaliaEngine.xml — classified as user data,
  //      NOT cleared by HyperOS 3 cache management.
  //   3. BUT: persistentSet() uses SharedPreferences.Editor.apply() which is ASYNC.
  //      The write goes to an in-memory queue and is flushed to disk by a background
  //      thread. If the OS SIGKILLs the app before the flush, the data is LOST.
  //      HyperOS 3's aggressive killing means the flush often doesn't happen.
  //   4. The 500ms debounce in the old _saveToStorage meant rapid eval updates were
  //      coalesced — if the app died within 500ms of a new eval, that eval was never saved.
  //
  // FIX (this revision):
  //   - Use a DEDICATED FILE (/data/data/com.Regalia/files/eval_cache.json) instead of
  //     SharedPreferences. SharedPreferences is optimized for small primitive values;
  //     storing a multi-MB JSON blob in it slows down app startup (loads ALL keys
  //     into memory at construction) and burns memory. The dedicated file uses atomic
  //     write (tmp + fsync + rename) — crash-safe, fast, and never cleared by HyperOS 3.
  //   - Use SYNCHRONOUS writes (saveEvalCacheSync) for the file. This blocks until
  //     fsync completes — HyperOS 3 cannot kill the app fast enough to lose data.
  //   - v1.0.4 Rev21: set()/delete()/clear() trigger SYNCHRONOUS write IMMEDIATELY
  //     (no debounce). Each eval result is rare (~1/sec max), so the cost of sync
  //     write is acceptable. The previous 150ms debounce introduced a window where
  //     new eval data could be lost if HyperOS 3 SIGKILLed the app mid-debounce.
  //   - Add a _flushSync() method called from pagehide/visibilitychange/beforeunload
  //     AND from Java's onPause/onStop/onUserLeaveHint. This forces an immediate
  //     sync write before the OS can kill the app.
  //   - localStorage is still maintained as a fast in-memory read cache (it loads
  //     faster than a JNI call), but is NOT relied upon for durability.
  //
  // INSTANT RECOVERY:
  //   The cache is loaded SYNCHRONOUSLY at JS module construction. By the time
  //   any review-mode code runs, the cache is fully populated in memory. When
  //   enterReview() → requestEngineEval() is called, the cache check returns
  //   instantly (no async, no JNI round-trip). The user sees cached evals
  //   immediately, with NO "analyzing..." flash.

  function _readPersisted(){
    // Try the dedicated eval cache file FIRST (Rev20 — durable, fast).
    try{
      if(typeof AndroidBridge!=='undefined'&&AndroidBridge.loadEvalCacheSync){
        const json=AndroidBridge.loadEvalCacheSync();
        if(json){
          const arr=JSON.parse(json);
          if(Array.isArray(arr))return arr;
        }
      }
    }catch(e){}
    // Fall back to localStorage (fast in-memory, may be wiped by HyperOS)
    try{
      const saved=localStorage.getItem(STORAGE_KEY);
      if(saved){const arr=JSON.parse(saved);if(Array.isArray(arr))return arr;}
    }catch(e){}
    // Fall back to legacy SharedPreferences-backed persistentGet (Rev17 path)
    try{
      if(typeof AndroidBridge!=='undefined'&&AndroidBridge.persistentGet){
        const persisted=AndroidBridge.persistentGet(STORAGE_KEY);
        if(persisted){
          const arr=JSON.parse(persisted);
          if(Array.isArray(arr)){
            // Rehydrate localStorage so subsequent reads hit the fast path
            try{localStorage.setItem(STORAGE_KEY,persisted);}catch(e){}
            return arr;
          }
        }
      }
    }catch(e){}
    return null;
  }
  // Load from persisted storage on construction (instant — synchronous JNI call)
  try{
    const arr=_readPersisted();
    if(arr){
      for(const [k,v] of arr){
        m.set(k,v);
      }
    }
  }catch(e){}
  // v1.0.4 Round-5 Rev20: Save to disk. Strategy:
  //   - Debounced 150ms write using saveEvalCacheSync (atomic file write).
  //   - _flushSync() forces immediate write — called from critical event handlers.
  // v1.0.4 Round-5 Rev21: set() now triggers SYNCHRONOUS write immediately
  //   (no debounce). Rationale: HyperOS 3 can SIGKILL the app at any moment;
  //   debouncing introduces a window where new eval data could be lost. Since
  //   each set() is followed by an onEngineEval callback (relatively rare —
  //   max ~1 per second per review step), the cost of synchronous write is
  //   acceptable. For rapid batch operations (clear, analyze-all advancing
  //   through steps), the JS event loop is single-threaded so writes are
  //   naturally serialized — no risk of concurrent writes corrupting the file.
  //   clear() and delete() also use synchronous writes for the same reason.
  // v1.0.4 Round-5 Rev23 (this round): Reintroduced a HYBRID write strategy:
  //   set() uses a 150ms debounce (coalescing rapid batch analyze-all writes),
  //   while _flushSync() (called from lifecycle/visibility handlers) forces an
  //   immediate synchronous write. This restores the Rev20 debounce that Rev21
  //   removed — the Rev21 rationale (HyperOS 3 SIGKILL mid-debounce) is fully
  //   addressed by the Rev22 onDestroy flush + the pagehide/visibilitychange
  //   JS handlers, so the debounce window is now covered by multiple flush
  //   triggers. Performance win: for a 60k-entry cache (~12MB JSON), set()
  //   previously serialized the ENTIRE Map on every eval callback (~1/sec) —
  //   now rapid navigations during analyze-all coalesce into one write per
  //   150ms. The debounce is also cleared (forced immediate write) when
  //   _flushSync() is called, so no data is lost on app backgrounding.
  let _saveTimer=null;
  let _dirty=false;
  const DEBOUNCE_MS=150;
  function _saveToStorage(forceSync){
    if(_saveTimer){clearTimeout(_saveTimer);_saveTimer=null;}
    if(forceSync){
      // Synchronous write — blocks until fsync + rename complete
      _writeToDiskNow();
      _dirty=false;
      return;
    }
    // Debounced write — coalesces rapid set() calls into one disk write.
    _dirty=true;
    _saveTimer=setTimeout(function(){
      _saveTimer=null;
      if(_dirty){
        _writeToDiskNow();
        _dirty=false;
      }
    },DEBOUNCE_MS);
  }
  function _writeToDiskNow(){
    const arr=Array.from(m.entries());
    const json=JSON.stringify(arr);
    // Primary: dedicated eval cache file (atomic write, fsync, never cleared by HyperOS)
    let fileOk=false;
    try{
      if(typeof AndroidBridge!=='undefined'&&AndroidBridge.saveEvalCacheSync){
        fileOk=!!AndroidBridge.saveEvalCacheSync(json);
      }
    }catch(e){}
    // Always write to localStorage as a fast in-memory read cache (best-effort)
    try{localStorage.setItem(STORAGE_KEY,json);}catch(e){}
    // Also write to SharedPreferences persistentGet backing store (legacy compat)
    if(!fileOk){
      try{if(typeof AndroidBridge!=='undefined'&&AndroidBridge.persistentSetSync)AndroidBridge.persistentSetSync(STORAGE_KEY,json);}catch(e){}
    }
  }
  // Public flush method — called from Java onPause/onStop/onUserLeaveHint
  // and from JS pagehide/visibilitychange/beforeunload handlers.
  this._flushSync=function(){
    if(_saveTimer){clearTimeout(_saveTimer);_saveTimer=null;}
    if(_dirty)_writeToDiskNow();
    _dirty=false;
  };
  this.get=function(k){if(m.has(k)){const v=m.get(k);m.delete(k);m.set(k,v);return v;}return undefined;};
  // v1.0.2 PERF: peek() reads without refreshing LRU order. Use this in
  // tight loops that iterate over many entries (e.g., _buildEvalTrendSVG,
  // _findCriticalMoves) — calling get() in those loops would perform N
  // delete+set operations just to read cached values, churning the Map
  // and pushing other entries toward eviction for no benefit.
  this.peek=function(k){return m.get(k);};
  this.has=k=>m.has(k);
  // v1.0.7 PHASE 18 Task 1: LRU eviction. The previous "Unlimited cache size"
  // claim (v1.0.4 Rev18) underestimated JSON persistence size (~400B/entry,
  // not ~200B), synchronous JSON.stringify blocking on a 24MB blob (100-300ms
  // on mid-tier phones), and WebView localStorage ~5MB quota — exceeding the
  // quota throws QuotaExceededError, which the code silently swallowed, so the
  // localStorage backup path would silently fail with no user feedback.
  //
  // FIRST-PRINCIPLES FIX:
  //   - MAX_ENTRIES=2000 is a SOFT cap (~800KB JSON, well under any quota).
  //     Normal single-game use (~80 steps) never triggers eviction.
  //   - Map.keys() iteration order === insertion order, and get()/set()
  //     refresh insertion order by delete+set, so iteration order === LRU
  //     order. We evict from the front (oldest first).
  //   - SKIP the entry whose key matches _reviewEvalRequestedStep — that is
  //     the step the user is currently viewing. Evicting it would cause the
  //     in-flight engine eval to "miss" the cache on its return, producing a
  //     brief "analyzing..." flash for the step the user is staring at.
  //   - TDZ safety: _reviewEvalRequestedStep is declared with `let` LATER in
  //     this module (line 254 in the original layout). _evictIfOverCap is a
  //     closure that only reads _reviewEvalRequestedStep at runtime (when
  //     set() is called), by which point the module has fully loaded and the
  //     binding is initialized. The typeof guard + try/catch belt-and-braces
  //     any edge case (e.g., a set() called during module init by a future
  //     refactor).
  //   - Type-robust comparison: persisted JSON parses keys as strings, while
  //     fresh set() calls use numeric keys. Compare as String() on both sides
  //     so the current step is correctly skipped regardless of key type.
  //   - Backward compat: if a persisted file from a pre-Phase-18 version has
  //     >2000 entries, the constructor loads them all (no migration needed);
  //     the next set() call triggers _evictIfOverCap and trims back to 2000.
  //   - Persistence preserves LRU order: _writeToDiskNow uses
  //     Array.from(m.entries()), so the JSON array order === LRU order, and
  //     on reload the order is restored exactly.
  const MAX_ENTRIES=2000;
  function _evictIfOverCap(){
    if(m.size<=MAX_ENTRIES)return;
    let _toEvict=m.size-MAX_ENTRIES;
    const _victimKeys=[];
    for(const k of m.keys()){
      if(_toEvict<=0)break;
      // Skip the step the user is currently viewing (in-flight eval).
      let _isCurrent=false;
      try{
        if(typeof _reviewEvalRequestedStep!=='undefined'&&
           String(k)===String(_reviewEvalRequestedStep)){
          _isCurrent=true;
        }
      }catch(e){}
      if(_isCurrent)continue;
      _victimKeys.push(k);
      _toEvict--;
    }
    for(const k of _victimKeys)m.delete(k);
  }
  // v1.0.4 Rev23: set() now uses the debounced write path (150ms coalescing).
  // _flushSync() (called from lifecycle handlers) forces an immediate write
  // before the OS can kill the app, so the debounce window is safe.
  // v1.0.7 PHASE 18 Task 1: set() now also calls _evictIfOverCap() to enforce
  // the soft MAX_ENTRIES cap. Eviction happens BEFORE the debounced save, so
  // the persisted file never exceeds the cap (after the next flush).
  this.set=function(k,v){if(m.has(k))m.delete(k);m.set(k,v);_evictIfOverCap();_saveToStorage(false);};
  this.delete=function(k){const r=m.delete(k);_saveToStorage(false);return r;};
  Object.defineProperty(this,'size',{get:function(){return m.size;},configurable:true});
  this.clear=function(){m.clear();_saveToStorage(true);};
  this.keys=()=>m.keys();
  // v1.0.7 PHASE 18 Task 1: Expose _evictIfOverCap for tests / debug introspection.
  this._evictIfOverCap=_evictIfOverCap;
  this.MAX_ENTRIES=MAX_ENTRIES;
}();
// v1.0.4 Round-5 Rev20: Expose _flushReviewEvalCache globally so Java can call it
// via evaluateJavascript("if(typeof _flushReviewEvalCache==='function')_flushReviewEvalCache()").
window._flushReviewEvalCache=function(){
  try{
    if(typeof _reviewEvalCache!=='undefined'&&_reviewEvalCache&&typeof _reviewEvalCache._flushSync==='function'){
      _reviewEvalCache._flushSync();
    }
  }catch(e){}
};
// Critical event handlers — flush synchronously before app can be killed
(function(){
  function _flushOnExit(){
    try{window._flushReviewEvalCache();}catch(e){}
    // Also flush SharedPreferences pending writes (covers persistentSet async writes)
    try{if(typeof AndroidBridge!=='undefined'&&AndroidBridge.persistentFlush)AndroidBridge.persistentFlush();}catch(e){}
  }
  // pagehide: fired when the page is being unloaded (mobile browsers including WebView)
  window.addEventListener('pagehide',_flushOnExit);
  // visibilitychange: fired when tab/app becomes hidden (mobile background)
  document.addEventListener('visibilitychange',function(){
    if(document.visibilityState==='hidden')_flushOnExit();
  });
  // beforeunload: last-resort flush (some browsers don't fire pagehide on mobile)
  window.addEventListener('beforeunload',_flushOnExit);
})();
// Track which review step the eval was requested for — allows onEngineEval to
// discard stale callbacks when the user has navigated to a different step.
let _reviewEvalRequestedStep=-1;
// Debounce timer for review eval — prevents rapid navigation from triggering multiple engine evals
let _reviewEvalDebounceTimer=null;
// Flag: after startGame() or importFEN(), the first engineGo call must use engineGoNewGame()
// to send ucinewgame atomically on the same thread (fixes race condition bug)
let _needNewGameForEngine=true;
let showAboutPage=false;
let showEngineConfig=false;
let showImportDialog=false;
// v1.0.4 Round-5 Rev27: Resign confirmation dialog state + winner color.
// _resignWinnerColor is set when the human resigns: it stores the color that
// WINS (i.e. the AI's color). Used by _gameOverStrFromStatus() and _buildPGNString()
// to produce the correct display text and PGN [Result]/[Termination] tags.
let showResignConfirm=false;
let _resignWinnerColor=null;
// v1.0.4 Rev47: Timeout winner color — stores which color WINS by timeout.
// Used by _gameOverStrFromStatus('timeout') for re-localization on language toggle.
let _timeoutWinnerColor=null;
// v1.0.4 Round-5 Rev18: PGN cache manager dialog state
let showPGNCacheManager=false;
let _pgnCacheList=[]; // [{name, size, mtime, tags}]
let _pgnCacheSelected=new Set(); // set of names selected for deletion
// v1.0.4 Round-5 Rev21: Tag filter / search state for PGN cache manager.
// _pgnCacheFilter holds the currently-applied filter text (tag name or substring).
// _pgnCacheFilterInput holds the value currently in the search input box (before "apply").
// Empty string = no filter (show all entries).
let _pgnCacheFilter='';
let _pgnCacheFilterInput='';
let engineConfigData=null;
let engineSettingsData=null;
let engineConfigTab='engine';
// v1.0.3: Cache the original PGN text from imports so the stats page can
// access the complete PGN with all headers ([FEN], [SetUp], [TimeControl],
// [%clk] comments, etc.) — not just the rebuilt move text from _buildPGNString().
// Set by importPGN/importPGNFile, cleared by startGame.
let _cachedOriginalPGN=null;
// v1.0.3: Cached FEN from setup mode — when the user sets up a custom position
// and then plays moves, this FEN is included in the exported PGN as [FEN] and
// [SetUp "1"] headers. Set by exitSetup, cleared by startGame.
let _setupFEN=null;
// v1.0.3: Starting move number for display when a PGN with [FEN] header is
// imported (or a FEN with fullMoveNumber>1 is pasted). The move list and PGN
// export use Math.floor(i/2) + _importedStartMoveNum for the move pair number,
// so a PGN starting at FEN "... w ... 4" will display "4. Bxf7+ Kxf7 5. Ne5 ..."
// instead of "1. Bxf7+ Kxf7 2. Ne5 ...".
// Default 1 (standard initial position). Reset by startGame.
let _importedStartMoveNum=1;
let showVariations=false; // 💬显示变例 toggle state
let _reviewAnalyzeSafetyTimer=null; // Safety timeout for reviewAnalyzeAll (prevents infinite hang)
let _lastEngineCallbackTime=0; // Timestamp of last engine callback — used by heartbeat monitor
// v1.0.4 Rev24 NEW: Human player's custom name (rename feature).
// Loaded from persistent storage at module init. When non-null, used in:
//   - Player bar display (ui.js)
//   - PGN [White "..."] / [Black "..."] tags (_buildPGNString)
//   - PGN cache archives and clipboard copies
// Persists across sessions via AndroidBridge.persistentSet('Regalia_humanName', ...).
let _humanPlayerName=null;
// v1.0.4 Rev24 NEW: Explicit player names from PGN import.
// When set (non-undefined), _buildPGNString uses these verbatim for [White]/[Black]
// instead of the default "你"/"AI对手". Cleared by startGame().
let playerWhite=undefined;
let playerBlack=undefined;
// v1.0.4 Rev24: Load _humanPlayerName from persistent storage at module init.
// This runs synchronously, so the name is available before the first render.
try{
  if(typeof AndroidBridge!=='undefined'&&AndroidBridge.persistentGet){
    const _savedName=AndroidBridge.persistentGet('Regalia_humanName');
    if(_savedName&&typeof _savedName==='string'&&_savedName.trim()){
      _humanPlayerName=_savedName.trim();
    }
  }
}catch(e){}
// Declared globals for strict compliance
let scannedEngines=[];
let _pendingSwitchPath=null;
// Cached multiPV setting from engine config — avoids JNI call per progress tick
let _cachedMultiPV=1;

// ===================== HAPTIC FEEDBACK MANAGER =====================
// 5-level compatibility degradation chain for haptic feedback
// Level 1: Android 16+ (API 35+) — PWLE (Piecewise Linear Envelope) segmented vibrations
// Level 2: Android 12+ (API 31+) — Prebaked preset effects (click, heavy_click, etc.)
// Level 3: Android 8+ (API 26+)  — OneShot custom amplitude vibrations
// Level 4: Legacy                — vibrate(milliseconds)
// Level 5: No vibrator           — Silent fallback
const HapticManager = (function() {
  const THROTTLE = {
    BUTTON_PRESS: 50,
    PIECE_SELECT: 50,
    PIECE_MOVE: 35,
    PIECE_CAPTURE: 50,
    SLIDER_DRAG: 35,
    TAB_SWITCH: 50,
    TOGGLE_ON: 50,
    TOGGLE_OFF: 50,
    CHECK_ALERT: 100,
    GAME_OVER: 200
  };

  let _lastFireTime = {};
  let _apiLevel = 0;
  let _hasVibrator = false;
  let _userEnabled = true;

  function _init() {
    try {
      if (typeof AndroidBridge !== 'undefined') {
        _apiLevel = AndroidBridge.getApiLevel ? AndroidBridge.getApiLevel() : 0;
        _hasVibrator = AndroidBridge.hasVibrator ? AndroidBridge.hasVibrator() : false;
        _userEnabled = AndroidBridge.isHapticEnabled ? AndroidBridge.isHapticEnabled() : true;
      }
    } catch(e) { console.warn('HapticManager init error:', e); }
  }

  function _throttle(type) {
    const now = Date.now();
    const last = _lastFireTime[type] || 0;
    const minInterval = THROTTLE[type] || 50;
    if (now - last < minInterval) return false;
    _lastFireTime[type] = now;
    return true;
  }

  function fire(type) {
    if (!_userEnabled || !_hasVibrator) return;
    if (!_throttle(type)) return;
    try {
      if (typeof AndroidBridge !== 'undefined' && AndroidBridge.performHaptic) {
        AndroidBridge.performHaptic(type);
      }
    } catch(e) { /* silent */ }
  }

  function refreshSettings() {
    try {
      if (typeof AndroidBridge !== 'undefined' && AndroidBridge.isHapticEnabled) {
        _userEnabled = AndroidBridge.isHapticEnabled();
      }
    } catch(e) {}
  }

  // Initialize on creation
  _init();

  return { fire, refreshSettings, _init };
})();

// Stale eval detection: incremented by _resetEvalState() when game state changes,
// captured by requestEngineEval() when a fresh eval is requested.
// Prevents stale onEngineEval callbacks from overwriting _sfEval with wrong-position data.
// Uses monotonic counter instead of boolean to avoid race conditions in multi-thread
// environment (Java callbacks can interleave with JS main thread).
let _evalStaleGen=0;  // Generation counter — stale if onEngineEval's gen < current
let _evalRequestGen=0; // Generation at time of last requestEngineEval() call
// v1.0.7 PHASE 19 (bug fix): Capture the mode at request time so onEngineEval
// can reject cross-mode stale callbacks. Previously, a review-mode eval callback
// still in flight after exitReview() would pass the normal-mode gen check
// (both gens equal in normal mode) and overwrite the correct game-position eval
// with the wrong review-position eval for up to 30s.
let _evalRequestReviewMode=false;
// v1.0.4 Rev44: Safety timer for eval requests — prevents eval bar from
// getting stuck at "分析中" if the engine doesn't respond.
let _evalSafetyTimerId=null;

let _toastTimer=0;
function showToast(msg,duration=2500){const old=document.getElementById('_toast');if(old)old.remove();if(_toastTimer)clearTimeout(_toastTimer);const t=document.createElement('div');t.id='_toast';t.style.cssText='position:fixed;bottom:60px;left:50%;transform:translateX(-50%);background:rgba(42,21,32,.96);color:#f5e6c8;padding:10px 24px;border-radius:6px;font-size:.85rem;z-index:10000;border:1px solid #d4a017;box-shadow:0 0 4px rgba(212,160,23,.10);pointer-events:none;opacity:0;transition:opacity .3s;font-family:system-ui,-apple-system,sans-serif';t.textContent=msg;document.body.appendChild(t);requestAnimationFrame(()=>{t.style.opacity='1'});_toastTimer=setTimeout(()=>{t.style.opacity='0';setTimeout(()=>t.remove(),300)},duration)}

// Update the foreground service notification with engine process info.
// This prevents the OS from killing the engine process on aggressive
// memory managers (Xiaomi HyperOS 3, etc.) by keeping the notification
// actively updated with real-time engine status.
let _lastNotificationInfo='';
let _notificationThrottleTimer=0;
let _pendingNotificationInfo=''; // v1.0.7 PHASE 19: buffer last info during throttle window
function _updateEngineNotification(info){
  if(!info||info===_lastNotificationInfo)return;
  // v1.0.7 BUG FIX (audit: 棋局前端代码审查.docx §4):
  // Previously the cache was updated BEFORE the throttle check, so when a
  // second change arrived during the throttle window we'd early-return on the
  // (already-stale) cache compare and never push the new value to the system
  // notification. After the throttle timer expired, a subsequent call with
  // the same new value would be skipped because the cache already held it —
  // the notification bar was stuck on the first value seen.
  // Fix: only update the cache when we actually push the notification.
  if(_notificationThrottleTimer){
    // v1.0.7 PHASE 19 (bug fix): Buffer the latest info so it gets pushed when
    // the throttle window expires. Without this, if the engine stops emitting
    // progress during the 1s window, the last-seen info is silently dropped.
    _pendingNotificationInfo=info;
    return;
  }
  _lastNotificationInfo=info;
  // Throttle: update notification at most once per second
  _notificationThrottleTimer=setTimeout(function(){
    _notificationThrottleTimer=0;
    // v1.0.7 PHASE 19: Flush any pending info that arrived during the throttle window
    if(_pendingNotificationInfo&&_pendingNotificationInfo!==_lastNotificationInfo){
      _updateEngineNotification(_pendingNotificationInfo);
    }
    _pendingNotificationInfo='';
  },1000);
  try{
    if(typeof AndroidBridge!=='undefined'&&AndroidBridge.updateEngineNotification){
      AndroidBridge.updateEngineNotification('Stockfish 18 · '+info);
    }
  }catch(e){}
}

// Unified AndroidBridge call wrapper — prevents Native exceptions from hanging JS state
// @param {function} fn - Function receiving AndroidBridge object
// @param {function} [fallback] - Optional fallback when bridge unavailable
// @param {boolean} [requireEngine] - If true, only call fn when engine is ready (default: true for backward compat)
function _bridgeCall(fn,fallback,requireEngine){
  try{
    if(typeof AndroidBridge!=='undefined'){
      if(requireEngine===false||AndroidBridge.isEngineReady()){
        return fn(AndroidBridge);
      }
    }
  }catch(e){console.error('Bridge call error:',e);}
  if(typeof fallback==='function')return fallback();
  return null;
}

// Loading overlay for engine initialization — progress is REAL, driven by onEngineProgress callbacks
let _loadingPct=0;
function _showLoadingOverlay(){
  if(document.getElementById('_loadingOverlay'))return;
  const lo=document.createElement('div');lo.id='_loadingOverlay';
  lo.style.cssText='position:fixed;inset:0;background:rgba(26,10,10,.98);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:99999;font-family:system-ui,-apple-system,sans-serif';
  lo.innerHTML=`<div style="font-size:4rem;margin-bottom:16px;font-weight:400;color:#E8E8F0;-webkit-text-stroke:.3px rgba(30,15,0,.85);text-shadow:0 0 .8px rgba(30,15,0,.55);font-family:&#x27;DejaVu Sans&#x27;,&#x27;Noto Sans&#x27;,&#x27;Segoe UI Symbol&#x27;,sans-serif;font-variant-emoji:text">♔&#xFE0E;</div><div style="font-size:1.3rem;font-weight:900;color:#ffd700;letter-spacing:2px;margin-bottom:12px">${T('loading_title')}</div><div id="_loadingStatus" style="color:#a08050;font-size:.85rem;margin-bottom:20px">${T('loading_ui')}</div><div style="width:200px;height:4px;background:#1a0a0a;border-radius:2px;overflow:hidden;position:relative"><div id="_loadingBar" style="width:0%;height:100%;background:linear-gradient(90deg,#d4a017,#ffd700);border-radius:2px;transition:width .4s cubic-bezier(.4,0,.2,1)"></div></div><div id="_loadingPct" style="color:#ffd700;font-size:.7rem;margin-top:8px;font-weight:700;letter-spacing:1px">0%</div>`;
  document.body.appendChild(lo);
  _loadingPct=0;
}
function _updateLoadingStatus(msg,pct){
  const s=document.getElementById('_loadingStatus');
  if(s)s.textContent=msg;
  if(pct!=null){
    _loadingPct=Math.min(100,Math.max(0,Math.round(pct)));
    const b=document.getElementById('_loadingBar');
    if(b)b.style.width=_loadingPct+'%';
    const p=document.getElementById('_loadingPct');
    if(p)p.textContent=_loadingPct+'%';
  }
}
let _loadingOverlayHiding=false;
function _hideLoadingOverlay(){
  if(_loadingOverlayHiding)return;_loadingOverlayHiding=true;
  _updateLoadingStatus(T('engine_ready'),100);
  const lo=document.getElementById('_loadingOverlay');
  if(lo){lo.style.opacity='0';lo.style.transition='opacity .5s';setTimeout(()=>{if(lo.parentNode)lo.remove();},500);}
}
// Show loading overlay immediately — real progress comes from onEngineProgress callback
_showLoadingOverlay();

// CRITICAL FIX: Multi-layer startup protection to prevent infinite loading screen
// Layer 1: Self-init — call AndroidBridge.initEngine() when DOM is ready
// This ensures engine init starts even if onPageFinished doesn't fire properly
let _engineInitAttempted=false;
function _attemptEngineInit(){
  if(_engineInitAttempted)return;
  _engineInitAttempted=true;
  console.log('Attempting engine init...');
  // Request POST_NOTIFICATIONS permission on Android 13+ before starting engine.
  // This is required for the foreground service notification that keeps the engine alive.
  try{
    if(typeof AndroidBridge!=='undefined'&&typeof AndroidBridge.requestNotificationPermission==='function'){
      AndroidBridge.requestNotificationPermission();
    }
  }catch(e){}
  try{
    if(typeof AndroidBridge!=='undefined'&&typeof AndroidBridge.initEngine==='function'){
      AndroidBridge.initEngine();
      console.log('Engine init called via AndroidBridge');
    }else{
      console.warn('AndroidBridge.initEngine not available');
    }
  }catch(e){
    console.error('Engine init call failed:',e);
  }
}
// Try immediately (for already-loaded pages) and also on DOMContentLoaded
_attemptEngineInit();
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',_attemptEngineInit);
}else{
  _attemptEngineInit(); // DOM already ready
}

// Layer 2: Fallback — hide loading overlay after 25s even if engine hasn't responded
let _loadingFallbackTimerId=setTimeout(function(){
  _loadingFallbackTimerId=null;
  if(!_loadingOverlayHiding&&document.getElementById('_loadingOverlay')){
    console.warn('Engine init timeout (25s) — hiding loading overlay');
    _hideLoadingOverlay();
    // Render UI after hiding loading overlay
    render();
    if(!_engineReady) showToast(T('engine_loading_timeout'));
  }
},25000);

// Layer 3: Emergency fallback — force hide after 35s no matter what
let _emergencyFallbackTimerId=setTimeout(function(){
  _emergencyFallbackTimerId=null;
  if(document.getElementById('_loadingOverlay')){
    console.error('EMERGENCY: Force hiding loading overlay after 35s');
    _loadingOverlayHiding=true;
    const lo=document.getElementById('_loadingOverlay');
    if(lo){lo.style.opacity='0';lo.style.transition='opacity .3s';setTimeout(()=>{if(lo&&lo.parentNode)lo.remove();},300);}
    render();
    if(!_engineReady) showToast(T('engine_init_failed'));
  }
},35000);

// Layer 4: Click to skip — allow user to dismiss loading screen manually
(function _makeLoadingClickable(){
  const loCheck=setInterval(()=>{
    const lo=document.getElementById('_loadingOverlay');
    if(lo){
      clearInterval(loCheck);
      lo.style.cursor='pointer';
      lo.title=T('click_skip_loading');
      lo.addEventListener('click',function(e){
        if(!_loadingOverlayHiding){
          console.log('User clicked loading overlay — skipping');
          _hideLoadingOverlay();
          showToast(T('engine_skip'));
          render();
          // Clear all fallback timers
          if(_loadingFallbackTimerId){clearTimeout(_loadingFallbackTimerId);_loadingFallbackTimerId=null;}
          if(_emergencyFallbackTimerId){clearTimeout(_emergencyFallbackTimerId);_emergencyFallbackTimerId=null;}
        }
      });
    }
  },200);
})();
// v1.0.2 FEATURE (audit): extracted PGN-building logic into _buildPGNString() so
// it can be shared by copyMoveHistory (clipboard) and exportPGNToFile (SAF file).
// v1.0.4 STANDARDIZATION: PGN output now follows the 1994 PGN spec strictly:
//   - Seven-Tag Roster (Event/Site/Date/Round/White/Black/Result) always emitted
//   - [Variant "Chess960"] + [SetUp "1"] + [FEN "..."] for Chess960 games
//   - [SetUp "1"] + [FEN "..."] for non-standard starting positions
//   - [%eval ...] annotation tags inside comments (Lichess/Chessbase convention)
//   - [%clk ...] annotation tags when clock times are available
//   - Result terminator always appended at end of movetext
//   - Tags and movetext separated by exactly one blank line (spec §3)

// v1.0.4 LATEST: Build the AI opponent's display name with difficulty level suffix.
//   Levels 1-6: "AI对手 Lv.N" (zh) / "AI Opponent Lv.N" (en)
//   Level 7 (Skill Level): "AI对手 SL" / "AI Opponent SL"
//   Level 8 (Custom): "AI对手 Custom" / "AI Opponent Custom"
// v1.0.6 NEW: When level is 7 (SL mode), append the actual Skill Level value
//   from the engine config (e.g. "SL20" when skill level is 20). This makes
//   the PGN [White]/[Black] tags and the in-game AI opponent bar carry the
//   concrete strength value, which is useful for archival and review.
function _aiOpponentNameWithLevel(){
  const baseName=T('ai_opponent');
  let levelSuffix='';
  try{
    const effLevel=(typeof getEffectiveAILevel==='function')?getEffectiveAILevel():4;
    if(effLevel>=1&&effLevel<=6){
      levelSuffix=' Lv.'+effLevel;
    }else if(effLevel===7){
      // v1.0.6: Append the actual skill level value (0-20). Default to 20
      // if engineSettingsData is unavailable (e.g. before engine init).
      let _sl=20;
      try{
        if(typeof engineSettingsData!=='undefined'&&engineSettingsData&&engineSettingsData.skillLevel!=null){
          _sl=engineSettingsData.skillLevel;
        }else if(typeof AndroidBridge!=='undefined'&&AndroidBridge.getEngineSkillLevel){
          _sl=AndroidBridge.getEngineSkillLevel();
        }
      }catch(_e){}
      levelSuffix=' SL'+_sl;
    }else if(effLevel===8){
      levelSuffix=' '+(T('manual_config')||'Custom').replace(/^⚙️\s*/,'');
    }
  }catch(e){/* fallback: no suffix */}
  return baseName+levelSuffix;
}
//   - Movetext wrapped at ~78 columns (spec recommendation)
// v1.0.4 Rev24: Added forceIncludeVariations parameter. When true, variations
// are ALWAYS included in the output PGN regardless of the showVariations UI
// toggle. This is used by _pgnCacheSaveCurrent() so the saved PGN archive
// contains the complete game record (variations + comments + eval tags).
function _buildPGNString(forceIncludeVariations){
  if(!moveRecords||!moveRecords.length)return '';
  // v1.0.4: Determine the game result from the gameOver string.
  // Falls back to "*" if the game is still in progress.
  let result='*';
  // v1.0.4 Rev27: Resign — winner is _resignWinnerColor; result is "1-0" if
  // White wins, "0-1" if Black wins. Checked FIRST so the resign text (which
  // does not contain "White wins" / "Black wins") doesn't fall through to the
  // default "1/2-1/2" draw branch.
  if(gameOver&&typeof _gameOverStatusKey!=='undefined'&&_gameOverStatusKey==='resign'&&typeof _resignWinnerColor!=='undefined'&&_resignWinnerColor){
    result=(_resignWinnerColor==='white')?'1-0':'0-1';
  } else if(gameOver&&typeof _gameOverStatusKey!=='undefined'&&_gameOverStatusKey==='timeout'&&typeof _timeoutWinnerColor!=='undefined'&&_timeoutWinnerColor){
    // v1.0.4 Rev47: Timeout — use _timeoutWinnerColor (the color that WINS).
    result=(_timeoutWinnerColor==='white')?'1-0':'0-1';
  } else if(gameOver){
    if(gameOver.includes(T('white_wins'))||gameOver.includes('White wins'))result='1-0';
    else if(gameOver.includes(T('black_wins'))||gameOver.includes('Black wins'))result='0-1';
    else result='1/2-1/2';
  }
  // v1.0.4: Build the Seven-Tag Roster (STR) — always required by PGN spec.
  // Use today's date in YYYY.MM.DD format if no game date is tracked.
  const _today=new Date();
  const _todayStr=_today.getFullYear()+'.'+((_today.getMonth()+1)<10?'0':'')+(_today.getMonth()+1)+'.'+(_today.getDate()<10?'0':'')+(_today.getDate());
  const strInfo={
    event:typeof gameEvent!=='undefined'?gameEvent:'Regalia',
    site:typeof gameSite!=='undefined'?gameSite:'?',
    date:_todayStr,
    round:'?',
    // v1.0.4 LATEST: AI opponent name includes difficulty level suffix.
    //   Levels 1-6: "AI对手 Lv.N" / "AI Opponent Lv.N"
    //   Level 7 (Skill Level): "AI对手 SL" / "AI Opponent SL"
    //   Level 8 (Custom): "AI对手 Custom" / "AI Opponent Custom"
    // The human player is always "你" / "You".
    // If playerWhite/playerBlack are explicitly set (e.g. from PGN import), use those.
    // v1.0.4 Rev24: For the human player's slot, prefer _humanPlayerName (the
    // rename feature) over the default "你"/"You". This ensures PGN text,
    // clipboard copies, and PGN cache archives all use the renamed name.
    white:typeof playerWhite!=='undefined'?playerWhite:(playerColor==='white'?(_humanPlayerName||T('you')):(_aiOpponentNameWithLevel())),
    black:typeof playerBlack!=='undefined'?playerBlack:(playerColor==='black'?(_humanPlayerName||T('you')):(_aiOpponentNameWithLevel())),
    result:result
  };
  const strLines=sevenTagRoster(strInfo).split('\n');
  // v1.0.4: Build supplementary tags
  const supObj=buildSupplementaryTagsObject({
    variant:(typeof gameVariant!=='undefined')?gameVariant:null,
    startFEN:(typeof _setupFEN!=='undefined'&&_setupFEN)?_setupFEN:((typeof gameVariant!=='undefined'&&gameVariant==='chess960')?generateFEN(gameState):null),
    plyCount:moveRecords.length
  });
  // For Chess960, the FEN we emit must use Shredder castling rights.
  // v1.0.7 PHASE 3: Also use Shredder castling rights for non-Chess960 games
  // whose starting position came from Setup mode with 🔁 markers on non-
  // standard squares. In that case the standard "KQkq" notation is ambiguous
  // (it implies rook on h1/a1 etc.), so we emit Shredder (file letters) to
  // unambiguously identify which rook holds the rights. This is the only
  // way to losslessly round-trip such positions through PGN/FEN.
  // Detection: the setup position has a king or rook NOT on standard squares.
  function _needsShredderFEN(s){
    if(!s||!s.board||!s.castlingRights)return false;
    // If no castling rights at all, no need for Shredder.
    const cr=s.castlingRights;
    if(!cr.whiteKingside&&!cr.whiteQueenside&&!cr.blackKingside&&!cr.blackQueenside)return false;
    // Standard squares: white king e1 (7,4), white rooks a1 (7,0) & h1 (7,7);
    // black king e8 (0,4), black rooks a8 (0,0) & h8 (0,7).
    // If all rooks with rights are on standard squares AND king is on e1/e8,
    // standard KQkq notation is sufficient.
    if(cr.whiteKingside){
      const wr=s.board[7]&&s.board[7][7];
      if(!wr||wr.type!=='rook'||wr.color!=='white')return true; // not on h1
    }
    if(cr.whiteQueenside){
      const wr=s.board[7]&&s.board[7][0];
      if(!wr||wr.type!=='rook'||wr.color!=='white')return true; // not on a1
    }
    if(cr.blackKingside){
      const br=s.board[0]&&s.board[0][7];
      if(!br||br.type!=='rook'||br.color!=='black')return true;
    }
    if(cr.blackQueenside){
      const br=s.board[0]&&s.board[0][0];
      if(!br||br.type!=='rook'||br.color!=='black')return true;
    }
    // Also check king position
    if(s.wk&&(s.wk.row!==7||s.wk.col!==4))return true;
    if(s.bk&&(s.bk.row!==0||s.bk.col!==4))return true;
    return false;
  }
  if(typeof toShredderCastling==='function'&&(typeof gameVariant!=='undefined'&&gameVariant==='chess960'||_needsShredderFEN(gameState))){
    // Regenerate the FEN with Shredder castling for the [FEN] tag
    const stdFEN=generateFEN(gameState);
    // Replace the castling field (field 3, 0-indexed) with Shredder format
    const parts=stdFEN.split(' ');
    parts[2]=toShredderCastling(gameState.castlingRights,gameState.board);
    supObj.FEN=parts.join(' ');
    // Also update _setupFEN if it's the starting position, so the [FEN] tag
    // in the PGN header uses Shredder castling too.
    if(typeof _setupFEN!=='undefined'&&_setupFEN){
      try{
        const _sp=_setupFEN.split(' ');
        if(_sp.length>=3){
          // Re-parse the setup FEN to construct a state for toShredderCastling
          // Easier: just replace the castling field with Shredder of the same state.
          // Since _setupFEN was generated from the same gameState at setup time,
          // and toShredderCastling takes (cr, board), we can re-derive.
          // For simplicity, we leave _setupFEN as-is for now — it'll be regenerated
          // below if needed. The PGN [FEN] tag will be supObj.FEN which is correct.
        }
      }catch(e){}
    }
  }
  const supLines=supplementaryTags(supObj);
  // v1.0.4 EXPANSION (this round): Add [TimeControl] header when game is timed
  if(typeof gameClocks!=='undefined'&&gameClocks&&typeof formatTimeControl==='function'){
    // v1.0.4 FIX (this round): use gameClocks.baseSec (now stored on the clock
    // object) as the authoritative source. Previously fell back to
    // dlgTimeControl.baseSec which could be stale after a PGN import (the
    // imported game's time control may differ from the dialog's last setting).
    const tcObj={
      type:gameClocks.type,
      baseSec:gameClocks.baseSec||0,
      incrementSec:gameClocks.incrementSec||0,
      delaySec:gameClocks.delaySec||0
    };
    const tcStr=formatTimeControl(tcObj);
    if(tcStr&&tcStr!=='?'){
      supLines.push('[TimeControl "'+tcStr+'"]');
    }
  }
  // v1.0.4 Rev27: [Termination "Resignation"] tag when the game ended by resignation.
  // Per PGN spec, [Termination] is a supplementary tag (not part of the Seven-Tag
  // Roster) describing how the game ended. Values include "Normal" (default),
  // "Time forfeit", "Abandoned", "Resignation", etc. We only emit this tag for
  // resignation (other terminations like checkmate/timeout are already clear
  // from the [Result] + movetext).
  if(typeof _gameOverStatusKey!=='undefined'&&_gameOverStatusKey==='resign'){
    supLines.push('[Termination "Resignation"]');
  }
  const allTags=strLines.concat(supLines);
  // v1.0.4: Build halfMoves array for composePGN()
  // Use _importedStartMoveNum offset for FEN-started games (preserves original move numbers)
  const _pgnMvStartOffset=(typeof _importedStartMoveNum!=='undefined'&&_importedStartMoveNum>0)?_importedStartMoveNum:1;
  const halfMoves=[];
  // v1.0.4 EXPANSION (this round): For timed games, we need the clock-remaining
  // AFTER each move to emit [%clk]. We compute this by replaying the moves and
  // tracking the clock state.
  let _clkWhite=null,_clkBlack=null;
  if(typeof gameClocks!=='undefined'&&gameClocks){
    _clkWhite=gameClocks.white.remainingSec;
    _clkBlack=gameClocks.black.remainingSec;
  }
  for(let i=0;i<moveRecords.length;i++){
    const mr=moveRecords[i];
    if(!mr)continue;
    // Determine color: even index = White (when starting from move 1 with white to move).
    // For FEN-imported games where black moves first, the _prependBlackToMovePlaceholder()
    // mechanism in game-logic.js shifts this. We rely on the convention that moveRecords[i]
    // is the (i+1)-th half-move from the starting side.
    const color=i%2===0?'white':'black';
    // v1.0.4 Rev23: Removed dead variable `moveNum` — it was computed but never
    // read (the actual move number used below is `_moveNum`). The ternary on
    // line 641 already handles the black-start case correctly.
    // Compute move number correctly: for standard games, move N covers half-moves 2N-2 and 2N-1
    // For FEN-imported games starting at black's move N, half-moves 0..k all belong to move N, N, N+1, N+1, ...
    // v1.0.4 Rev23: `_isBlackStart` ternary is a no-op (both branches are identical),
    // but kept for readability — the formula _pgnMvStartOffset+Math.floor(i/2) works
    // for both white-start and black-start because floor(i/2) gives 0,0,1,1,2,2...
    const _moveNum=_pgnMvStartOffset+Math.floor(i/2);
    // v1.0.4 EXPANSION (this round): Build the comment with [%emt] OR [%clk]
    //   - If game is TIMED: use [%clk HH:MM:SS] (remaining clock AFTER this move)
    //   - If game is UNTIMED: use [%emt HH:MM:SS] (elapsed move time from mr.time)
    // We also include [%eval] when available, and [%csl]/[%cal] from the cache.
    let commentParts=[];
    // [%emt] for untimed games (mr.time is elapsed seconds as a string)
    if(!gameClocks&&mr.time){
      const emtTag=typeof formatEmtTag==='function'?formatEmtTag(parseFloat(mr.time)):null;
      if(emtTag)commentParts.push(emtTag);
    }
    // [%clk] for timed games — we need the post-move remaining time.
    // For the export to be accurate, we'd need to track the clock history per
    // move. Since gameClocks only has the CURRENT remaining, we approximate by
    // walking forward from the initial clock. To keep this simple and avoid
    // drift, we emit the CURRENT remaining as the [%clk] for the LAST move only,
    // and for earlier moves we omit [%clk] (the user can re-import the PGN and
    // the [%emt] tags from moveRecords[i].time will still be available).
    // For now: if this is the last move AND the game is timed, emit [%clk].
    if(gameClocks&&i===moveRecords.length-1){
      const clkSec=color==='white'?_clkWhite:_clkBlack;
      if(clkSec!=null&&typeof formatClkTag==='function'){
        const clkTag=formatClkTag(clkSec);
        if(clkTag)commentParts.push(clkTag);
      }
    }
    // [%eval] from cached review eval (if available)
    if(typeof _reviewEvalCache!=='undefined'&&_reviewEvalCache.size>0){
      // moveIdx i (0-based) → post-move reviewStep = i+1. (Step 0 = initial
      // position; cacheable since v1.0.7 Phase 15, but not written to PGN
      // as a per-move [%eval] — the initial position has its own [FEN] tag.)
      // v1.0.7 PHASE 19 (perf): Use peek() not get() — PGN export is a read-only
      // operation, not a review-session access. get() would refresh LRU order,
      // pushing the current game's evals to the newest end and evicting OTHER
      // games' evals toward the back. peek() reads without side effect.
      const cached=_reviewEvalCache.peek(i+1);
      if(cached){
        const evalTag=formatEvalTag(cached);
        if(evalTag)commentParts.push(evalTag);
      }
    }
    // v1.0.4 EXPANSION (this round): [%csl] and [%cal] from the visual annotations cache
    if(typeof _getVisualAnnotations==='function'){
      const va=_getVisualAnnotations(i);
      if(va){
        if(va.csl&&va.csl.length>0&&typeof formatCslTag==='function'){
          const cslTag=formatCslTag(va.csl);
          if(cslTag)commentParts.push(cslTag);
        }
        if(va.cal&&va.cal.length>0&&typeof formatCalTag==='function'){
          const calTag=formatCalTag(va.cal);
          if(calTag)commentParts.push(calTag);
        }
      }
    }
    // Also keep the legacy "{<sec>s}" inline format for backward compatibility
    // with stats.html's extractMoveTimes() — it looks for "<number>s" anywhere
    // in the comment.
    if(mr.time)commentParts.push(mr.time+'s');
    // v1.0.4 Round-5 Rev48: Preserve the free-text comment from imported PGNs.
    // mr.comment is populated by importPGN() from {} comments in the source
    // PGN. We append it AFTER all [%xxx] tags so the structured tags remain
    // at the front (some PGN readers expect [%xxx] tags first in a comment).
    // The "[var] " prefix (used for variation-internal comments) is preserved
    // as-is so downstream consumers can distinguish mainline vs variation
    // comments if needed.
    if(mr.comment){
      // Escape braces in the comment body — PGN spec forbids literal { or }
      // inside a brace comment (they would terminate the comment prematurely).
      // Replace with Unicode full-width braces (visually similar, semantically
      // distinct) so the comment text is still readable.
      const _escComment=mr.comment.replace(/\{/g,'｛').replace(/\}/g,'｝');
      commentParts.push(_escComment);
    }
    // v1.0.4 Rev27: On the LAST move of a resigned game, append the
    // "{White resigns.}" / "{Black resigns.}" annotation per the 元宝 PGN
    // report. The resigner is the OPPOSITE of _resignWinnerColor.
    if(typeof _gameOverStatusKey!=='undefined'&&_gameOverStatusKey==='resign'
       && typeof _resignWinnerColor!=='undefined'&&_resignWinnerColor
       && i===moveRecords.length-1){
      const resignerColor=_resignWinnerColor==='white'?'black':'white';
      // Use English for the PGN comment (PGN spec is language-neutral, but
      // English is the de-facto standard for inter-op). Format: "White resigns."
      const resignerStr=resignerColor==='white'?'White':'Black';
      commentParts.push(resignerStr+' resigns.');
    }
    const comment=commentParts.length>0?commentParts.join(' '):undefined;
    // Variations: include from moveRecords[i].variations if available
    // v1.0.4 Rev24: forceIncludeVariations (used by PGN cache save) bypasses
    // the showVariations UI toggle so the saved PGN archive always contains
    // the complete game record with variations.
    let variations=undefined;
    if((showVariations||forceIncludeVariations)&&mr.variations&&mr.variations.length>0){
      variations=mr.variations.filter(v=>v.san&&v.group!=='analysis'&&v.group!=='ponder').map(v=>{
        const vmn=(v.varMoveNum!=null)?v.varMoveNum:_moveNum;
        const fiw=(v.firstMoveIsWhite!=null)?v.firstMoveIsWhite:(color==='white'?false:true);
        // v1.0.4 Rev29 FIX: was `v.prefixEllipsisNum||vmn` — but if prefixEllipsisNum
        // is 0 (legitimate, though rare — move "0..." shouldn't normally occur, but
        // defensive), `||` would fall back to vmn. Use explicit null check instead.
        const prefix=v.prefixEllipsis?(((v.prefixEllipsisNum!=null)?v.prefixEllipsisNum:vmn)+'... '):'';
        return {san:prefix+_formatSANAsRAV(v.san,vmn,fiw)};
      });
      if(variations.length===0)variations=undefined;
    }
    halfMoves.push({
      moveNum:_moveNum,
      color:color,
      san:mr.notation||'?',
      comment:comment,
      variations:variations,
      // v1.0.4 ROUND-5 REV16: NAG from eval-delta classification
      // v1.0.4 Rev29 FIX: prev delta-based mate detection was broken for Black.
      //   Old: `if(delta>=90000)return 3; if(delta<=-90000)return 4;`
      //   This used the raw White-POV delta, so a BLACK move that delivers
      //   mate (delta goes from ~0 to -90000 in White POV, which is +90000
      //   in Black's favor) was incorrectly classified as $4 (blunder).
      //   Fix: use the side-relative `md` for ALL comparisons, including
      //   the mate threshold checks. Now Black's mating move correctly
      //   gets $3 (brilliant) and White's blunder getting mated gets $4.
      nag:(function(){
        if(typeof _reviewEvalCache==='undefined'||!_reviewEvalCache||_reviewEvalCache.size===0)return undefined;
        const cur=_reviewEvalCache.peek(i+1);
        const prev=_reviewEvalCache.peek(i);
        if(!cur||!prev)return undefined;
        const curEv=cur.mate?(cur.mate>0?90000:-90000):cur.eval;
        const prevEv=prev.mate?(prev.mate>0?90000:-90000):prev.eval;
        const delta=curEv-prevEv;
        const isW=(color==='white');
        const md=isW?delta:-delta;
        if(md>=90000)return 3;
        if(md<=-90000)return 4;
        if(md>200)return 3;
        if(md>50)return 1;
        if(md>-50)return undefined;
        if(md>-150)return 6;
        if(md>-300)return 2;
        return 4;
      })()
    });
  }
  // Compose the final PGN
  return composePGN({
    tagPairs:allTags,
    halfMoves:halfMoves,
    result:result
  });
}
// v1.0.2: Build a PGN comment for a move, combining thinking time + eval annotation.
// v1.0.3: Format uses a single space as separator between thinking time and eval
//   annotation (reverted from the earlier '——' em-dash proposal after user
//   feedback — the space-separated format is simpler and matches the v1.0.2
//   convention). Examples:
//     "{3.2s +0.5 略优}"   (time + short eval)
//     "{3.2s SF18 D22 +1.0 8%W/91%D/1%L}"  (time + full SF18 line, every 5 moves)
//     "{3.2s}"             (time only — NO trailing space inside the braces)
//     "{+0.5 略优}"         (eval only — no time available)
//   stats.html's extractMoveTimes() recognizes the "<number>s" pattern inside
//   {} comments regardless of separator, so both space-separated and the
//   earlier em-dash format parse correctly.
function _buildPGNComment(mr,reviewStep,moveNum){
  let timePart='';
  // 1. Thinking time (first item in the comment)
  if(mr&&mr.time){
    timePart=mr.time+'s';
  }
  // 2. Eval annotation
  const evalAnn=_formatPGNEvalAnnotation(reviewStep,moveNum);
  let evalInner='';
  if(evalAnn){
    // Strip the outer {} from the eval annotation
    evalInner=evalAnn.replace(/^\{/,'').replace(/\}$/,'');
  }
  // v1.0.3: Build the comment with a single space separator if both time and
  // eval are present.
  //   - time + eval → "{time eval}"
  //   - time only → "{time}"  (no trailing space)
  //   - eval only → "{eval}"
  //   - neither → ""
  if(timePart&&evalInner){
    return '{'+timePart+' '+evalInner+'}';
  }else if(timePart){
    return '{'+timePart+'}';
  }else if(evalInner){
    return '{'+evalInner+'}';
  }
  return '';
}
// v1.0.2 FEATURE: format a PGN comment annotation for the given review step.
// Returns either:
//   - `{+0.5 略优}` style (eval word only) for most moves
//   - `{SF18 D22 +1.0 8%W/91%D/1%L}` style (full engine info) every 5 moves
//   - empty string if no cached eval is available for this step
// `moveNum` is the 1-based move number (1 for the first full move pair).
// We use the actual move-pair count (n) so the "every 5 moves" cadence lines up
// with chess convention (after move 5, 10, 15, …), not the half-move index.
function _formatPGNEvalAnnotation(reviewStep,moveNum){
  if(typeof _reviewEvalCache==='undefined')return '';
  const cached=_reviewEvalCache.get(reviewStep);
  if(!cached)return '';
  // Format score: centipawns from White's perspective.
  // Mate scores (|eval|>=90000) are shown as #M.
  // v1.0.2 FIX (first-principles): parenthesize the mate-detection condition
  // explicitly. The previous `cached.mate&&cached.mate!==0||Math.abs(ev)>=90000`
  // parsed as `(cached.mate&&cached.mate!==0)||Math.abs(ev)>=90000` — which
  // happened to be correct, but relied on JS operator precedence and was hard
  // to read. Also normalize cached.mate to a number defensively (some callers
  // pass it as a string from JSON deserialization).
  const mateDist=Number(cached.mate)||0;
  const ev=Number(cached.eval)||0;
  const isMateScore=(mateDist!==0)||Math.abs(ev)>=90000;
  let scoreStr;
  if(isMateScore){
    // Stockfish reports mate as ±99999 with _sfMateDistance holding the
    // actual distance. If we have a real mate distance, use it; otherwise
    // derive a best-effort distance from the eval sign.
    const md=mateDist!==0?mateDist:(ev>0?1:-1);
    scoreStr='#'+Math.abs(md);
  }else{
    // Centipawns → pawns with 1 decimal, signed
    const pawns=(ev/100).toFixed(1);
    scoreStr=(ev>=0?'+':'')+pawns;
  }
  // Every 5 moves (moveNum is 1-based; we want moves 5,10,15,…): full annotation
  if(moveNum>0&&moveNum%5===0){
    let wdlStr='';
    if(cached.wdlW!=null&&cached.wdlW>=0&&cached.wdlD!=null&&cached.wdlD>=0&&cached.wdlL!=null&&cached.wdlL>=0){
      const total=cached.wdlW+cached.wdlD+cached.wdlL;
      if(total>0){
        const wp=Math.round(cached.wdlW/total*100);
        const dp=Math.round(cached.wdlD/total*100);
        // v1.0.7 PHASE 19 (bug fix): Compute lp directly from raw value to avoid
        // negative percentages at rounding boundaries (e.g. W=99.5,D=0.5,L=0 →
        // wp=100,dp=1,lp=100-100-1=-1). The three may sum to 99 or 101, which
        // is less visually jarring than a negative value.
        const lp=Math.round(cached.wdlL/total*100);
        wdlStr=wp+'%W/'+dp+'%D/'+lp+'%L';
      }
    }
    // v1.0.4 Rev33: include seldepth (SD) in the PGN eval annotation when > depth.
    const depthStr=cached.depth?('D'+cached.depth):'D?';
    const seldepthStr=(cached.seldepth!=null&&cached.seldepth>0&&cached.seldepth>cached.depth)?(' SD'+cached.seldepth):'';
    return '{SF18 '+depthStr+seldepthStr+' '+scoreStr+(wdlStr?(' '+wdlStr):'')+'}';
  }
  // Otherwise: short eval-word annotation
  // posDesc is defined in ui.js but is in scope (single bundled file)
  let word='';
  try{word=typeof posDesc==='function'?posDesc(ev):'';}catch(e){word='';}
  return '{'+scoreStr+(word?(' '+word):'')+'}';
}
function copyMoveHistory(){
  const pgn=_buildPGNString();
  if(!pgn){showToast(T('no_move_records'));return}
  safeCopyToClipboard(pgn,T('pgn_copied'));
}
// v1.0.2 FEATURE (audit): export the current game's PGN to a user-chosen file
// via Android SAF (ACTION_CREATE_DOCUMENT). Mirrors the settings-export flow.
function exportPGNToFile(){
  const pgn=_buildPGNString();
  if(!pgn){showToast(T('no_move_records'));return}
  _bridgeCall(function(bridge){
    if(typeof bridge.openPGNExportFilePicker==='function'){
      bridge.openPGNExportFilePicker(pgn);
    }else{
      // Fallback: copy to clipboard if SAF unavailable
      safeCopyToClipboard(pgn,T('pgn_copied'));
    }
  });
}
// v1.0.2 FEATURE: callback for PGN export result (mirrors onSettingsExported)
function onPGNExported(success,fileName){
  if(success){
    showToast(T('pgn_exported')+': '+fileName);
  }else{
    showToast(T('settings_clipboard_fallback'));
  }
}
// v1.0.2 NEW FEATURE: 📊统计 — open a fullscreen stats page that renders the
// current game's PGN with rich formatting + computes statistics (material
// balance per move, control map, move classifications from cached evals, etc.).
// The stats page is a separate HTML file (assets/stats.html) loaded into a new
// WebView activity by the Java side. The PGN is passed via the bridge and
// stored in a JS variable that stats.html reads on load.
function openStatsPage(){
  // v1.0.4 Rev28: ALWAYS sync the current main/review game state to the stats
  // page. Previously, this used _cachedOriginalPGN (the text from the last
  // importPGN/importPGNFile call) which became STALE when the user played new
  // moves after importing — the stats page would show the imported PGN's moves,
  // not the current game's moves.
  //
  // Now we ALWAYS rebuild the PGN from the current moveRecords via
  // _buildPGNString(true) (forceIncludeVariations=true). This includes:
  //   - All moves in moveRecords (including post-import moves)
  //   - Variations (forced on, independent of showVariations UI toggle)
  //   - [%eval] from the review cache
  //   - [%emt]/[%clk]/[%csl]/[%cal] annotations
  //   - Seven-Tag Roster + supplementary tags ([FEN], [SetUp], [Variant],
  //     [TimeControl], [Termination] for resignations, etc.)
  //
  // The only downside: if the user imported a PGN with rich annotations that
  // _buildPGNString() doesn't preserve (e.g., custom comments, NAGs not in
  // our cache), those are lost. This is an acceptable trade-off — the stats
  // page's job is to analyze the CURRENT game, not the original import text.
  // (The original import text is still preserved in _cachedOriginalPGN for
  // the PGN cache save 📚 feature.)
  let pgn=_buildPGNString(true);
  // v1.0.3 fallback: if _buildPGNString returned empty (e.g., no moveRecords),
  // try _cachedOriginalPGN as a last resort (e.g., FEN-only imports that didn't
  // generate moveRecords but did set _cachedOriginalPGN).
  if(!pgn&&_cachedOriginalPGN){
    pgn=_cachedOriginalPGN;
  }
  if(!pgn){showToast(T('no_move_records'));return}
  // Also gather per-move eval cache data so the stats page can show
  // classification + eval trend without re-running the engine.
  const evalData=[];
  if(typeof _reviewEvalCache!=='undefined'){
    for(let i=0;i<moveRecords.length;i++){
      // v1.0.2 PERF: use peek() — iterating over all moves, no need to refresh LRU.
      const c=_reviewEvalCache.peek(i+1);
      // Use !=null so mate:0 (checkmate-now) is distinct from mate:null (no mate).
      evalData.push(c?{eval:c.eval||0,mate:c.mate!=null?c.mate:0,depth:c.depth||0,wdlW:c.wdlW!=null?c.wdlW:-1,wdlD:c.wdlD!=null?c.wdlD:-1,wdlL:c.wdlL!=null?c.wdlL:-1}:null);
    }
  }
  // v1.0.2 FIX: Also send the parsed move records (from/to/piece/captured/promotion/notation)
  // so the stats page doesn't have to re-parse the PGN string with its simplified parser.
  // The simplified parser in stats.html (applySANMove/canMoveTo) doesn't handle check
  // detection, proper disambiguation, en passant edge cases, etc. — once one move fails
  // to parse, the state doesn't advance and all subsequent moves cascade-fail. This was
  // the root cause of the "total moves cannot exceed 98" bug: real games with complex
  // middlegame/endgame moves would hit a parse failure around move 98-99 (typically a
  // disambiguation or check-evasion move the simplified parser couldn't handle), and
  // every move after that was silently dropped.
  // By sending the authoritative move records from the main app (which uses the full
  // legalMoves/moveAlg logic), the stats page can replay them correctly via its
  // executeMove() (which correctly advances state) without any SAN parsing.
  const moveData=[];
  for(let i=0;i<moveRecords.length;i++){
    const mr=moveRecords[i];
    if(!mr){
      // null placeholder (Black-to-move start) — preserve as null
      moveData.push(null);
    }else{
      moveData.push({
        from:mr.from,
        to:mr.to,
        piece:mr.piece?{type:mr.piece.type,color:mr.piece.color}:null,
        captured:mr.captured?{type:mr.captured.type,color:mr.captured.color}:null,
        promotion:mr.promotion||null,
        notation:mr.notation||''
      });
    }
  }
  const payload=JSON.stringify({pgn:pgn,evals:evalData,moveRecords:moveData,playerColor:playerColor,lang:(typeof _lang!=='undefined'?_lang:'zh')});
  _bridgeCall(function(bridge){
    if(typeof bridge.openStatsPage==='function'){
      bridge.openStatsPage(payload);
    }else{
      // Fallback: copy PGN to clipboard if stats page unavailable
      safeCopyToClipboard(pgn,T('pgn_copied'));
    }
  });
}
// v1.0.2 NEW FEATURE: Stats page callbacks
function onStatsHTMLExported(success,fileName){
  if(success){
    showToast(T('stats_saved')+': '+fileName);
  }else{
    showToast(T('settings_clipboard_fallback'));
  }
}
// v1.0.2 NEW FEATURE: Stats page requests to enter review mode.
// (The onStatsRequestImport handler was removed in v1.0.2 — PGN import from
// the stats page now opens the SAF picker directly inside StatsActivity via
// statsSelectPGNFile(), so the main WebView no longer needs to participate.)
// v1.0.2 FIX: Show a toast when there are no moves to review, instead of
// silently doing nothing — the user otherwise has no feedback that the tap
// was registered but the request couldn't be honored.
function onStatsRequestReview(){
  if(moveRecords&&moveRecords.length>0){
    enterReview();
  }else{
    showToast(T('no_move_records'));
  }
}
function copyReviewPGN(){
  if(!moveRecords||!moveRecords.length){showToast(T('no_move_records'));return}
  copyMoveHistory();
}
function _fallbackCopy(text,successMsg){const ta=document.createElement('textarea');ta.value=text;ta.style.cssText='position:fixed;left:-9999px;top:-9999px';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');if(successMsg)showToast(successMsg)}catch(e){showToast(T('copy_failed'))}finally{document.body.removeChild(ta)}}
// Unified clipboard helper — handles WebView compatibility (secure context, user gesture)
function safeCopyToClipboard(text,successMsg){
  const fb=function(){_fallbackCopy(text,successMsg)};
  if(navigator.clipboard&&window.isSecureContext&&typeof navigator.clipboard.writeText==='function'){
    navigator.clipboard.writeText(text).then(function(){if(successMsg)showToast(successMsg)}).catch(fb);
  }else{fb()}
}
// HTML-escape helper: prevents XSS when inserting dynamic text into HTML/onclick attributes
// v1.0.2 PERF (first-principles): single-pass regex with callback instead of
// 5 chained .replace() calls. The previous version allocated 5 intermediate
// strings per escape; _esc is called on every move notation, every file path,
// every ECO name, etc. during render — at 64 squares × multiple labels per
// square, this was a measurable allocation hotspot.
const _ESC_MAP={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
const _ESC_RE=/[&<>"']/g;
function _esc(s){return String(s).replace(_ESC_RE,c=>_ESC_MAP[c]);}
// XSS-safe JS string escaper — for inserting paths into onclick='...' attributes
// _esc() escapes for HTML, but paths in onclick JS strings need JS-level escaping
// e.g. /sdcard/0'Brien/ — the single quote would break the onclick attribute
const _ESCJS_MAP={'\\':'\\\\',"'":"\\'",'"':'&quot;','\n':'\\n','\r':'\\r'};
const _ESCJS_RE=/[\\'"\n\r]/g;
function _escJs(s){return String(s).replace(_ESCJS_RE,c=>_ESCJS_MAP[c]);}

/**
 * Format a variation for display in move records and review panel.
 * Produces PGN RAV (Recursive Annotation Variation) compliant text.
 * Supports both the new variations array format (pre-computed SAN) and
 * legacy UCI string format (with optional game state for SAN conversion).
 *
 * PGN RAV rules:
 *   - Variations are enclosed in () parentheses
 *   - After white's move, variation starts with black's: 1. e4 (1...c5 2. Nc3)
 *   - After black's move, variation starts with white's: 1. e4 e5 (2. d4 exd4)
 *
 * @param {string|Object} variation - UCI variation string, or object { san, firstMoveIsWhite }
 * @param {number} moveNum - Starting move number for the variation
 * @param {boolean} isAfterWhiteMove - True if variation is attached after a white move
 * @param {Object} [state] - Game state for SAN conversion (optional, for legacy UCI strings)
 * @returns {string} PGN RAV formatted text (no HTML wrapping)
 */
function _formatVariation(variation, moveNum, isAfterWhiteMove, state){
  if(!variation)return '';

  // New format: variation object with pre-computed SAN
  if(typeof variation==='object'&&variation.san){
    // Use the variation's own varMoveNum if available
    const vMoveNum = (variation.varMoveNum!=null) ? variation.varMoveNum : moveNum;
    const rav=_formatSANAsRAV(variation.san, vMoveNum, variation.firstMoveIsWhite);
    return rav;
  }

  // Legacy format: UCI string — convert to SAN if state provided, else use _uciToSimple
  const uciStr=typeof variation==='string'?variation:'';
  if(!uciStr)return '';
  const moves=uciStr.trim().split(/\s+/);
  if(!moves.length)return '';

  let parts=[];
  let currentIsWhite=!isAfterWhiteMove; // First variation move is the opposite side
  // After black's move, the next move is white's at moveNum+1
  // After white's move, the variation starts with black's at the same moveNum.
  let currentNum=isAfterWhiteMove ? moveNum : moveNum + 1;
  let currentState=state||null; // Walk the state for SAN conversion

  for(let i=0;i<moves.length;i++){
    const mv=moves[i];
    if(!mv||mv.length<4)continue;

    let sanMove;
    if(currentState){
      // Full SAN conversion using game state
      const result=_uciToSAN(mv, currentState);
      sanMove=result.san;
      currentState=result.postState;
    }else{
      // Fallback: simplified notation (no disambiguation/check/checkmate)
      sanMove=_uciToSimple(mv);
    }

    if(currentIsWhite){
      parts.push(currentNum+'.'+sanMove);
    }else{
      if(i===0){
        // First move of variation starting with black's move
        parts.push(currentNum+'...'+sanMove);
      }else{
        parts.push(sanMove);
      }
      currentNum++;
    }
    currentIsWhite=!currentIsWhite;
  }
  return parts.join(' ');
}

/**
 * Format a pre-computed SAN string as PGN RAV text with move numbers.
 * @param {string} sanString - Space-separated SAN moves (e.g., "e5 Nf3 Nc6")
 * @param {number} moveNum - Starting move number
 * @param {boolean} firstMoveIsWhite - True if the first SAN move is white's
 * @returns {string} PGN RAV formatted text (e.g., "1...e5 2.Nf3 Nc6")
 */
function _formatSANAsRAV(sanString, moveNum, firstMoveIsWhite){
  if(!sanString)return '';
  const moves=sanString.trim().split(/\s+/);
  if(!moves.length)return '';
  // Strip any leading move number prefixes from individual moves (defensive —
  // should already be stripped during PGN parsing, but guard against edge cases)
  const cleanMoves=moves.map(m=>m.replace(/^\d+\.+\s*/,'')).filter(m=>m);
  if(!cleanMoves.length)return '';
  let parts=[];
  let currentIsWhite=firstMoveIsWhite;
  let currentNum=moveNum;
  for(let i=0;i<cleanMoves.length;i++){
    const sanMove=cleanMoves[i];
    if(currentIsWhite){
      parts.push(currentNum+'.'+sanMove);
    }else{
      if(i===0){
        // First move of variation starting with black's move
        parts.push(currentNum+'...'+sanMove);
      }else{
        parts.push(sanMove);
      }
      currentNum++;
    }
    currentIsWhite=!currentIsWhite;
  }
  return parts.join(' ');
}

/**
 * Format variation groups for parallel display.
 * ALL variations are 🌿 lines with unified format.
 *
 * v1.0.2 FIX: Line numbers are now assigned SEQUENTIALLY based on the order
 * of variations in the move record's variations array (1, 2, 3, ...).
 * Previously, the labels were derived from group/mpvIndex/lineNum fields,
 * which could COLLIDE — e.g., a mainline group and a multipv[0] group both
 * mapped to 线1, so when both were attached to the same move (a common case
 * after Flip, when divergent mainline + MultiPV predictions end up on the
 * same divergence-point move), the user saw two "🌿线1" labels. Sequential
 * numbering guarantees uniqueness regardless of how the variations were
 * produced.
 *
 * 'analysis' and 'ponder' groups are still skipped entirely.
 */
function _formatVariationGroups(variations, moveNum, isAfterWhiteMove){
  if(!variations||!variations.length)return '';
  // Collect all displayable variations in their original array order.
  const displayLines=[];
  for(const v of variations){
    // Skip analysis and ponder groups entirely
    if(v.group==='analysis'||v.group==='ponder')continue;
    if(!v.san)continue;
    displayLines.push({
      san:v.san,
      varMoveNum:v.varMoveNum,
      firstMoveIsWhite:v.firstMoveIsWhite,
      prefixEllipsis:!!v.prefixEllipsis,
      prefixEllipsisNum:v.prefixEllipsisNum||0
    });
  }
  if(!displayLines.length)return '';
  // Fallback: if varMoveNum is not stored on the variation, compute it from the
  // global isAfterWhiteMove (backward compatibility with existing move records).
  const defaultVarMoveNum = isAfterWhiteMove ? moveNum : moveNum + 1;
  function getVarMoveNum(v){ return (v.varMoveNum!=null) ? v.varMoveNum : defaultVarMoveNum; }
  // Fallback firstMoveIsWhite for legacy records
  function getFirstMoveIsWhite(v){ return (v.firstMoveIsWhite!=null) ? v.firstMoveIsWhite : !isAfterWhiteMove; }
  let h='';
  // Render ALL lines with unified 🌿 format, using SEQUENTIAL line numbers
  // (1, 2, 3, ...) based on array position. This guarantees unique labels.
  for(let i=0;i<displayLines.length;i++){
    const line=displayLines[i];
    const lineNum=i+1;
    const rav=_formatSANAsRAV(line.san, getVarMoveNum(line), getFirstMoveIsWhite(line));
    if(rav){
      // v1.0.2: If prefixEllipsis is set (Type B variation after Black's move),
      // prepend "N..." before the RAV text to indicate the branch point.
      // N is the owning move's number (prefixEllipsisNum), and the variation
      // content starts at N+1 for White's move.
      const prefix = line.prefixEllipsis ? (line.prefixEllipsisNum+'... ') : '';
      h+='<div class="mvar"><span style="color:#7eb8da;font-size:.6rem;font-weight:600">🌿 '+T('line_label')+' '+lineNum+'</span> <span style="font-size:.75rem">'+_esc(prefix+rav)+'</span></div>';
    }
  }
  return h;
}

// Convert a single UCI move to simplified algebraic notation for variation display
// e.g. "e2e4" -> "e4", "g1f3" -> "Nf3", "e7e8q" -> "e8=Q"
/**
 * Convert a single UCI move to simplified algebraic notation.
 * @param {string} uci - UCI move string (e.g., "e2e4", "g1f3", "e7e8q")
 * @returns {string} Simplified algebraic notation (e.g., "e4", "Nf3", "e8=Q")
 */
function _uciToSimple(uci){
  if(!uci||typeof uci!=='string'||uci.length<4)return (uci!=null?String(uci):'');
  const fromCol=uci.charCodeAt(0)-97;
  const fromRow=8-parseInt(uci[1]);
  const toCol=uci.charCodeAt(2)-97;
  const toRow=8-parseInt(uci[3]);
  const promo=uci.length>4?uci[4]:null;
  const toFile=String.fromCharCode(97+toCol);
  const toRank=String(8-toRow);
  // Try to determine piece type from current game state
  let pieceType='pawn';
  if(gameState&&gameState.board&&gameState.board[fromRow]){
    const p=gameState.board[fromRow][fromCol];
    if(p)pieceType=p.type;
  }
  const pieceChar={knight:'N',bishop:'B',rook:'R',queen:'Q',king:'K',pawn:''}[pieceType]||'';
  const promoStr=promo?{q:'=Q',r:'=R',b:'=B',n:'=N'}[promo]||'':'';
  // Handle castling
  // v1.0.6: Chess960-aware. In BOTH standard chess and Chess960, the king
  // always ends on col 6 (kingside) or col 2 (queenside) after castling.
  // However, a normal king move can also land on col 6/2, so we cannot
  // rely on destination column alone. The reliable signal is the DISTANCE:
  //   - Standard chess: king always moves exactly 2 cols to castle
  //   - Chess960: king may move 1-5 cols to castle, BUT a 1-col king move
  //     to g1/c1 is ambiguous (could be a normal king move). We only
  //     treat it as castling if the king moved 2+ cols. The 1-col Chess960
  //     castling case (e.g. king at f1 castling to g1) is handled by the
  //     primary _uciToSAN() path which uses the board state, not this
  //     fallback. This _uciToSimple fallback is only used when _uciToSAN
  //     fails (state desync), so the 1-col ambiguity is acceptable.
  // v1.0.7 PHASE 4: UCI_Chess960 "king-captures-rook" format. When the
  // engine sends castling as "e1h1" (king moves to rook's square), the
  // destination column is NOT 6/2 but the rook's column. We detect this
  // case by checking if the destination square holds a same-color rook
  // (in the current gameState) and the move is on the same rank. If so,
  // we treat it as castling based on the rook's position relative to the
  // king (right of king → kingside O-O; left → queenside O-O-O).
  if(pieceType==='king'){
    // v1.0.7 PHASE 4: Check for UCI_Chess960 king-captures-rook format first.
    if(gameState&&gameState.board&&gameState.board[fromRow]&&gameState.board[toRow]){
      const _fp=gameState.board[fromRow][fromCol];
      const _tp=gameState.board[toRow][toCol];
      if(_fp&&_fp.type==='king'&&_tp&&_tp.type==='rook'&&_fp.color===_tp.color&&fromRow===toRow){
        // King "captures" own rook → Chess960 castling notation.
        if(toCol>fromCol)return 'O-O';
        if(toCol<fromCol)return 'O-O-O';
      }
    }
    // Standard / post-rewrite detection: king moved 2+ cols and lands on
    // col 6 (kingside) or col 2 (queenside). This works for both standard
    // chess (e1g1) and Chess960 after uciToCoords rewrites the destination.
    if(Math.abs(toCol-fromCol)>=2){
      if(toCol===6)return 'O-O';
      if(toCol===2)return 'O-O-O';
    }
  }
  // Handle pawn moves
  if(pieceType==='pawn'){
    if(fromCol!==toCol){
      // Pawn capture
      return String.fromCharCode(97+fromCol)+'x'+toFile+toRank+promoStr;
    }
    return toFile+toRank+promoStr;
  }
  return pieceChar+toFile+toRank;
}

/**
 * Convert a single UCI move to full SAN notation using the chess game state.
 * Uses moveAlg() from game-logic.js for proper disambiguation, captures, castling,
 * promotion (=Q), check (+), and checkmate (#) suffixes.
 * @param {string} uci - UCI move string (e.g., "e2e4", "g1f3", "e7e8q")
 * @param {Object} state - Game state object for piece lookup and legality checks
 * @returns {Object} { san: string, postState: Object } - SAN notation and resulting game state
 */
function _uciToSAN(uci, state){
  if(!uci||typeof uci!=='string'||uci.length<4||!state||!state.board) return { san: _uciToSimple(uci), postState: state };
  const fromCol=uci.charCodeAt(0)-97;
  const fromRow=8-parseInt(uci[1]);
  let toCol=uci.charCodeAt(2)-97;
  let toRow=8-parseInt(uci[3]);
  // Bounds check
  if(fromRow<0||fromRow>7||fromCol<0||fromCol>7||toRow<0||toRow>7||toCol<0||toCol>7)
    return { san: _uciToSimple(uci), postState: state };
  if(!state.board[fromRow]) return { san: _uciToSimple(uci), postState: state };
  const piece=state.board[fromRow][fromCol];
  // v1.0.7 PHASE 4: UCI_Chess960 "king-captures-rook" castling format.
  // When UCI_Chess960=true, Stockfish sends castling as the king moving to
  // the ROOK's source square (e.g. "e1h1" for kingside with rook on h1).
  // We detect this case (king moves to a square occupied by a same-color
  // rook on the same rank) and rewrite the destination to the king's actual
  // castling destination (col 6 kingside, col 2 queenside). This makes the
  // downstream makeMv/moveAlg correctly detect castling via _castleSide().
  if(piece&&piece.type==='king'&&state.board[toRow]){
    const toPiece=state.board[toRow][toCol];
    if(toPiece&&toPiece.type==='rook'&&toPiece.color===piece.color&&fromRow===toRow){
      if(toCol>fromCol){
        // Kingside castling — king ends on col 6 (g1/g8)
        toCol=6;
      }else if(toCol<fromCol){
        // Queenside castling — king ends on col 2 (c1/c8)
        toCol=2;
      }
    }
  }
  if(!piece){
    // Piece not found — use _uciToSimple() as fallback for notation,
    // AND try to create a minimal postState by moving whatever is at from-square.
    // This prevents UCI leaks and state desync that cascades to all subsequent moves.
    const simpleNotation=_uciToSimple(uci);
    // Attempt minimal state update: if from-square is empty, try to infer piece type
    // from the move pattern (e.g., promotion suffix, castling pattern)
    const promo=uci.length>4?uci[4].toLowerCase():null;
    const inferredType=promo?{q:'queen',r:'rook',b:'bishop',n:'knight'}[promo]:null;
    if(inferredType){
      // Promotion move — the piece is a pawn
      const fromPiece={type:'pawn',color:(fromRow===1?'white':'black')}; // Row 1 = rank 7 = White pawn promoting; Row 6 = rank 2 = Black pawn promoting
      const mv={from:{row:fromRow,col:fromCol},to:{row:toRow,col:toCol},piece:fromPiece,promotion:inferredType};
      const postState=makeMv(state,mv);
      return { san: simpleNotation, postState };
    }
    return { san: simpleNotation, postState: state };
  }
  const promo=uci.length>4?uci[4].toLowerCase():null;
  const promotion=promo?{q:'queen',r:'rook',b:'bishop',n:'knight'}[promo]:null;
  const mv={from:{row:fromRow,col:fromCol},to:{row:toRow,col:toCol},piece,promotion};
  const postState=makeMv(state,mv);
  const san=moveAlg(state,mv,postState);
  return { san, postState };
}

/**
 * Convert a UCI PV (principal variation) string to SAN notation,
 * walking through the game state move by move.
 * Each move is converted using _uciToSAN() which provides full SAN with
 * disambiguation, check/checkmate suffixes, etc.
 * @param {string} pvString - Space-separated UCI moves (e.g., "e7e5 g1f3 b8c6")
 * @param {Object} state - Starting game state for the PV
 * @returns {Object} { sanMoves: string, finalState: Object }
 *   sanMoves: Space-separated SAN moves (e.g., "e5 Nf3 Nc6")
 *   finalState: Game state after all PV moves are applied
 */
function _convertPVtoSAN(pvString, state){
  if(!pvString||!state) return { sanMoves: '', finalState: state };
  const uciMoves=pvString.trim().split(/\s+/);
  const sanParts=[];
  let currentState=state;
  for(const uci of uciMoves){
    if(!uci||uci.length<4) continue;
    const result=_uciToSAN(uci, currentState);
    sanParts.push(result.san);
    currentState=result.postState;
  }
  return { sanMoves: sanParts.join(' '), finalState: currentState };
}

// v1.0.2 PERF (first-principles): PV variation cache + fork grafting.
//
// When MultiPV returns N PV lines, they typically share a common prefix
// (e.g. PV1=e4 e5 Nf3 Nc6, PV2=e4 e5 Nf3 d5 — they share "e4 e5 Nf3").
// Naively calling _convertPVtoSAN() on each line independently re-runs
// makeMv/moveAlg for the shared prefix N times. With 8 MultiPV lines of
// 10+ moves each, this is 80+ redundant state clones + moveAlg calls.
//
// _pvCache caches the converted SAN + post-state for every UCI prefix
// encountered during a single _processDeferredVariations() call. The cache
// is keyed by `(state.hash,uciPrefix)` so the same prefix from the same
// starting state is converted exactly once. _checkPVDivergence finds the
// longest shared prefix between two PV lines so the cache lookup is maximal.
//
// The cache is cleared at the start of each _processDeferredVariations()
// call (per-search scope) to bound memory usage.
let _pvCache=new Map();
const _PV_CACHE_MAX=200; // Bound: ~8 PV lines × ~25 moves = 200 entries max

// Convert a PV to SAN using the prefix cache. `stateHash` is the hash of
// `state` so cache hits are correct only when both the starting state AND
// the UCI prefix match — this is critical because the same UCI prefix
// (e.g. "e2e4") applied from different states produces different SAN.
function _convertPVtoSANCached(pvString, state, stateHash){
  if(!pvString||!state) return { sanMoves: '', finalState: state };
  const uciMoves=pvString.trim().split(/\s+/).filter(m=>m&&m.length>=4);
  if(uciMoves.length===0) return { sanMoves: '', finalState: state };
  const sanParts=[];
  let currentState=state;
  let currentHash=stateHash||state.hash||0;
  // Walk the UCI moves; for each prefix, check the cache. On a miss, convert
  // one move and store the result. On a hit, jump directly to the cached
  // post-state and SAN.
  for(let i=0;i<uciMoves.length;i++){
    const prefix=uciMoves.slice(0,i+1).join(' ');
    const cacheKey=currentHash+'|'+prefix;
    let cached=_pvCache.get(cacheKey);
    if(cached){
      // Hit — reuse the cached SAN for this move and the cached post-state
      sanParts.push(cached.san);
      currentState=cached.postState;
      currentHash=cached.postState.hash||currentHash;
      continue;
    }
    // Miss — convert just this one move from currentState
    const uci=uciMoves[i];
    const result=_uciToSAN(uci, currentState);
    sanParts.push(result.san);
    currentState=result.postState;
    currentHash=currentState.hash||currentHash;
    // Store in cache (with bound check)
    if(_pvCache.size<_PV_CACHE_MAX){
      _pvCache.set(cacheKey,{san:result.san,postState:result.postState});
    }
  }
  return { sanMoves: sanParts.join(' '), finalState: currentState };
}

// v1.0.2 CLEANUP: Removed the dead `_checkPVDivergence(pv1Moves, pv2Moves)`
// function (which found the shared-prefix length between two PV arrays). It
// was a no-arg-namesake of the active `_checkPVDivergence()` below (which
// iterates over `_pendingEnginePVs`), and the JS second-declaration-wins rule
// silently shadowed it — every call site used 0 args, so the dead version
// was never reachable. The active `_convertPVtoSANCached()` finds shared
// prefixes via its own `_pvCache` (keyed by hash+UCI-prefix), so it does not
// need a separate prefix-length helper. Removing this eliminates the
// confusion and the misleading "finds the longest shared prefix" comment.

// ===================== STOCKFISH BRIDGE CALLBACKS =====================

// Generate FEN string from game state
// v1.0.2 PERF (first-principles): hoist the PIECE_FEN lookup table out of
// generateFEN() into module scope. The previous code allocated a fresh
// {white:{...},black:{...}} object on every generateFEN() call — and
// generateFEN is called on every AI move, every hint, and every eval
// request. Module-scope hoisting eliminates the per-call allocation.
const _PIECE_FEN={white:{king:'K',queen:'Q',rook:'R',bishop:'B',knight:'N',pawn:'P'},black:{king:'k',queen:'q',rook:'r',bishop:'b',knight:'n',pawn:'p'}};
const _DEFAULT_FEN='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
/**
 * Generate a FEN string from game state.
 * @param {Object} s - Game state object with board, currentTurn, castlingRights, etc.
 * @returns {string} FEN string representation of the position
 */
function generateFEN(s){
  if(!s||!s.board)return _DEFAULT_FEN;
  if(!Array.isArray(s.board)||s.board.length!==8)return _DEFAULT_FEN;
  let fen='';
  for(let r=0;r<8;r++){
    if(!s.board[r])return _DEFAULT_FEN;
    let empty=0;
    for(let c=0;c<8;c++){
      const p=s.board[r][c];
      if(p&&_PIECE_FEN[p.color]&&_PIECE_FEN[p.color][p.type]){if(empty>0){fen+=empty;empty=0}fen+=_PIECE_FEN[p.color][p.type]}
      else{empty++}
    }
    if(empty>0)fen+=empty;
    if(r<7)fen+='/';
  }
  fen+=' '+(s.currentTurn==='white'?'w':'b');
  const cr=s.castlingRights||{};
  // v1.0.7 PHASE 4: Output Shredder-FEN (X-FEN) castling rights when:
  //   1. We're in explicit Chess960 mode (gameVariant === 'chess960' OR
  //      isChess960Mode() returns true), OR
  //   2. The position has castling rights on non-standard squares (king not
  //      on e1/e8, or a castling-rights rook not on a1/h1/a8/h8).
  // In both cases, standard KQkq notation is ambiguous (K implies rook on
  // h1, but the rook may be elsewhere). Shredder notation (file letters
  // A-H/a-h) explicitly names the rook's source file, which is the only
  // lossless way to represent the position.
  // Standard positions (king on e1/e8, rooks on a1/h1/a8/h8) continue to
  // use KQkq for backward compatibility with v1.0.6 and earlier.
  let _useShredder=false;
  const _is960=(typeof gameVariant!=='undefined'&&gameVariant==='chess960')||(typeof isChess960Mode==='function'&&isChess960Mode());
  if(_is960)_useShredder=true;
  else{
    const _hasRights=cr.whiteKingside||cr.whiteQueenside||cr.blackKingside||cr.blackQueenside;
    if(_hasRights){
      if(s.wk&&(s.wk.row!==7||s.wk.col!==4))_useShredder=true;
      if(s.bk&&(s.bk.row!==0||s.bk.col!==4))_useShredder=true;
      if(!_useShredder&&cr.whiteKingside){const wr=s.board[7]&&s.board[7][7];if(!wr||wr.type!=='rook'||wr.color!=='white')_useShredder=true;}
      if(!_useShredder&&cr.whiteQueenside){const wr=s.board[7]&&s.board[7][0];if(!wr||wr.type!=='rook'||wr.color!=='white')_useShredder=true;}
      if(!_useShredder&&cr.blackKingside){const br=s.board[0]&&s.board[0][7];if(!br||br.type!=='rook'||br.color!=='black')_useShredder=true;}
      if(!_useShredder&&cr.blackQueenside){const br=s.board[0]&&s.board[0][0];if(!br||br.type!=='rook'||br.color!=='black')_useShredder=true;}
    }
  }
  let castle;
  if(_useShredder&&typeof toShredderCastling==='function'){
    castle=toShredderCastling(cr,s.board);
  }else{
    let _std='';
    if(cr.whiteKingside)_std+='K';
    if(cr.whiteQueenside)_std+='Q';
    if(cr.blackKingside)_std+='k';
    if(cr.blackQueenside)_std+='q';
    castle=_std||'-';
  }
  fen+=' '+(castle||'-');
  let ep='-';
  if(s.enPassantTarget){const et=s.enPassantTarget;const capColor=s.currentTurn;const pd=capColor==='white'?1:-1;for(const dc of[-1,1]){const cr2=et.row+pd,cc2=et.col+dc;if(inB(cr2,cc2)&&s.board[cr2][cc2]&&s.board[cr2][cc2].type==='pawn'&&s.board[cr2][cc2].color===capColor){ep=String.fromCharCode(97+et.col)+(8-et.row);break;}}}
  fen+=' '+ep;
  fen+=' '+(s.halfMoveClock||0);
  fen+=' '+(s.fullMoveNumber||1);
  return fen;
}

// v1.0.6 NEW: Sanitize a FEN string before sending it to the Stockfish engine.
// Stockfish tolerates most FEN quirks, but certain inconsistent castling
// rights can cause the engine to enter a degraded state where it emits no
// `info` lines and no `bestmove` (just hangs until the safety timer fires),
// then retries indefinitely. The user reported this with the FEN
// `4k3/8/8/8/8/8/8/r1K4R w q - 1 3` — black has castling right `q` (black
// queenside) but no black rook on a8, so the right is meaningless.
//
// This function strips castling rights that don't match the actual board:
//   - White Kingside (K): requires white king on e1 AND white rook on h1
//   - White Queenside (Q): requires white king on e1 AND white rook on a1
//   - Black Kingside (k): requires black king on e8 AND black rook on h8
//   - Black Queenside (q): requires black king on e8 AND black rook on a8
// For Chess960 (Shredder-FEN with letter-file castling), the validation is
// more complex and left to the engine (Stockfish handles it natively).
//
// This is a defensive measure — under normal gameplay, generateFEN() always
// produces consistent castling rights because makeMv/makeMvInPlace clear
// them when the king or rook moves. The inconsistency can only arise from:
//   1. Setup mode where the user places pieces manually
//   2. Importing a FEN with inconsistent rights (fenToState doesn't validate)
//   3. PGN import where the [FEN] tag has stale rights
function _sanitizeFenForEngine(fen){
  if(!fen||typeof fen!=='string')return fen;
  const parts=fen.trim().split(/\s+/);
  if(parts.length<2)return fen;
  // Parse board
  const rows=parts[0].split('/');
  if(rows.length!==8)return fen;
  const board=Array.from({length:8},()=>Array(8).fill(null));
  for(let r=0;r<8;r++){
    let c=0;
    for(const ch of rows[r]){
      if(ch>='1'&&ch<='8'){c+=parseInt(ch);continue;}
      if(c>=8)break;
      const isWhite=ch===ch.toUpperCase();
      const type=ch.toLowerCase()==='p'?'pawn':ch.toLowerCase()==='n'?'knight':ch.toLowerCase()==='b'?'bishop':ch.toLowerCase()==='r'?'rook':ch.toLowerCase()==='q'?'queen':ch.toLowerCase()==='k'?'king':null;
      if(!type)return fen; // malformed FEN — let engine handle
      board[r][c]={type,color:isWhite?'white':'black'};
      c++;
    }
  }
  // Parse castling rights
  const crRaw=parts[2]||'-';
  if(crRaw==='-')return fen; // no castling rights — nothing to sanitize
  // v1.0.6 SIMPLIFIED: Shredder-FEN (Chess960) uses file letters (A-H for
  // white, a-h for black) instead of KQkq. If the castling field contains
  // ANY character other than K/Q/k/q/-, it's Shredder — let the engine
  // handle it (Stockfish validates Shredder natively).
  if(!/^[KQkq-]+$/.test(crRaw)){
    return fen; // Shredder-FEN or unknown format — let engine handle
  }
  // Validate standard KQkq rights
  let cr='';
  if(crRaw.includes('K')){
    // White kingside: white king on e1 (row 7, col 4) AND white rook on h1 (row 7, col 7)
    const wk=board[7][4], wr=board[7][7];
    if(wk&&wk.type==='king'&&wk.color==='white'&&wr&&wr.type==='rook'&&wr.color==='white'){
      cr+='K';
    }
  }
  if(crRaw.includes('Q')){
    // White queenside: white king on e1 (row 7, col 4) AND white rook on a1 (row 7, col 0)
    const wk=board[7][4], wr=board[7][0];
    if(wk&&wk.type==='king'&&wk.color==='white'&&wr&&wr.type==='rook'&&wr.color==='white'){
      cr+='Q';
    }
  }
  if(crRaw.includes('k')){
    // Black kingside: black king on e8 (row 0, col 4) AND black rook on h8 (row 0, col 7)
    const bk=board[0][4], br=board[0][7];
    if(bk&&bk.type==='king'&&bk.color==='black'&&br&&br.type==='rook'&&br.color==='black'){
      cr+='k';
    }
  }
  if(crRaw.includes('q')){
    // Black queenside: black king on e8 (row 0, col 4) AND black rook on a8 (row 0, col 0)
    const bk=board[0][4], br=board[0][0];
    if(bk&&bk.type==='king'&&bk.color==='black'&&br&&br.type==='rook'&&br.color==='black'){
      cr+='q';
    }
  }
  if(cr===crRaw)return fen; // no change needed
  parts[2]=cr||'-';
  return parts.join(' ');
}

// UCI move to internal coordinate converter (e.g., "e2e4" -> {from:{row:6,col:4},to:{row:4,col:4}})
function uciToCoords(uci){
  if(!uci||typeof uci!=='string'||uci.length<4)return null;
  const fc=uci.charCodeAt(0)-97, fr=8-parseInt(uci[1]);
  const tc=uci.charCodeAt(2)-97, tr=8-parseInt(uci[3]);
  if(isNaN(fc)||isNaN(fr)||isNaN(tc)||isNaN(tr))return null;
  if(fc<0||fc>7||fr<0||fr>7||tc<0||tc>7||tr<0||tr>7)return null;
  const result={from:{row:fr,col:fc},to:{row:tr,col:tc}};
  if(uci.length>=5){
    const promoMap={'q':'queen','r':'rook','b':'bishop','n':'knight'};
    result.promotion=promoMap[uci[4].toLowerCase()]||'queen';
  }
  // v1.0.7 PHASE 4: UCI_Chess960 "king-captures-rook" castling format.
  // When UCI_Chess960=true, Stockfish represents castling as the king moving
  // to the ROOK's source square (e.g. "e1h1" for kingside castling with the
  // rook on h1, or "e1b1" for queenside castling with the rook on b1) — NOT
  // to the king's final square (g1/c1). This disambiguates castling from a
  // normal king move to g1/c1 in Chess960 where the king may already be
  // close to g1/c1.
  //
  // We detect this case and rewrite the destination to the king's actual
  // castling destination (col 6 for kingside, col 2 for queenside), so that
  // downstream executeMove/makeMv correctly detect castling via _castleSide()
  // (which checks for the king landing on col 6 or col 2).
  //
  // Detection criteria (all must hold):
  //   1. The from-square holds a king of the side to move.
  //   2. The to-square holds a same-color rook (i.e. "king captures own rook").
  //   3. The king and rook are on the same rank (castling always happens on
  //      the home rank).
  //   4. The rook's column is on the king's RIGHT (→ kingside, king ends on
  //      col 6) or LEFT (→ queenside, king ends on col 2).
  //
  // This detection is SAFE for standard chess too — in standard chess, the
  // engine (with UCI_Chess960=false) sends "e1g1", which does NOT match
  // (g1 doesn't hold a rook), so we don't rewrite. The rewrite only happens
  // when the engine actually uses the Chess960 castling notation.
  if(gameState&&gameState.board&&gameState.board[fr]&&gameState.board[tr]){
    const fromPiece=gameState.board[fr][fc];
    const toPiece=gameState.board[tr][tc];
    if(fromPiece&&fromPiece.type==='king'&&toPiece&&toPiece.type==='rook'&&fromPiece.color===toPiece.color&&fr===tr){
      // King "captures" own rook on the same rank → Chess960 castling notation.
      if(tc>fc){
        // Rook is to the right of king → kingside castling, king ends on col 6.
        // Rewrite destination to (king's row, col 6) = g1/g8.
        result.to={row:tr,col:6};
      }else if(tc<fc){
        // Rook is to the left of king → queenside castling, king ends on col 2.
        result.to={row:tr,col:2};
      }
      // If tc === fc this is impossible (king and rook can't share a square).
    }
  }
  return result;
}

// Callback: Engine init progress (real progress from StockfishNative.startEngine)
function onInitProgress(pct, msg){
  console.log('Engine init progress:', pct, msg);
  if(!_loadingOverlayHiding){
    _updateLoadingStatus(msg||(T('loading_prefix')+pct+'%'), pct);
  }
}

// Callback: Engine is restarting (Java-side auto-recovery initiated)
// CRITICAL: This is called by Java recoverEngine() before the restart begins.
// It gives JS a chance to reset stale state that would otherwise block
// doAIMove()/requestEngineEval() when onEngineReady() fires after restart.
function onEngineRestarting(){
  console.log('Engine restarting (Java-side auto-recovery)');
  _engineReady=false;
  if(isAIThinking){isAIThinking=false;_aiBarInfo='';}
  if(isHintLoading){isHintLoading=false;_hintBarInfo='';}
  if(_evalLoading){_evalLoading=false;_sfEvalReady=false;}
  _ponderGen++;_ponderMoveSAN='';_ponderBarInfo='';_pendingPonderMoveUCI=null;
  // v1.0.2 FIX (audit): Parity with restartCurrentEngine() — clear review eval
  // cache + MultiPV state so the recovered engine's evaluations are re-fetched
  // instead of showing stale values from the pre-crash engine.
  // v1.0.4 Rev23 FIX: Do NOT call _reviewEvalCache.clear() here — that destroys
  // the ENTIRE persisted cache (all games' evals), not just the current game's.
  // The eval cache is keyed by reviewStep (a per-game index), so "stale" evals
  // from a pre-crash engine are only stale for the CURRENT game's steps. Other
  // games' evals in the cache are still valid (Stockfish is deterministic — the
  // same FEN always yields the same eval). Instead, we just reset the requested
  // step so requestEngineEval re-fetches the current step after recovery.
  _reviewEvalRequestedStep=-1;
  _multiPVLines=[];_multiPVResult=null;_lastEngineVariation=null;
  // v1.0.5 Rev56: Clear the MultiPV display cache (companion to _multiPVLines=[]).
  _clearMultiPVDisplayCache();
  if(_aiSafetyTimerId){clearTimeout(_aiSafetyTimerId);_aiSafetyTimerId=null;}
  // v1.0.2 FIX: Reset AI retry counter on engine restart. Without this, if the
  // engine crashed mid-AI-move (where _aiRetryCount had already incremented to
  // 1 or 2), the next doAIMove() after recovery would increment to 2 or 3 and
  // potentially hit the 3-retry cap immediately, showing "AI timeout" even
  // though the engine just recovered.
  _aiRetryCount=0;
  render();
}

// Callback: Engine ready
function onEngineReady(){
  console.log('Stockfish engine is ready');
  _engineReady=true;
  // Reset restart counter on successful engine init
  if(window._engineRestartCount)window._engineRestartCount=0;
  // v1.0.7 PHASE 19 (bug fix): Cancel any pending error-restart timer. If the
  // engine auto-recovered (Java recoverEngine) before the 1500ms onEngineError
  // timer fired, that timer would spuriously restart an already-ready engine.
  if(window._engineErrorRestartTimer){clearTimeout(window._engineErrorRestartTimer);window._engineErrorRestartTimer=null;}
  // FIX: After engine restart (crash recovery), the engine's internal hash
  // tables are empty. We MUST send ucinewgame before the next search to
  // prevent stale data from corrupting evaluations.
  _needNewGameForEngine=true;
  // CRITICAL FIX: Clear all fallback timers — engine is ready, no need for timeouts
  if(_loadingFallbackTimerId){clearTimeout(_loadingFallbackTimerId);_loadingFallbackTimerId=null;}
  if(_emergencyFallbackTimerId){clearTimeout(_emergencyFallbackTimerId);_emergencyFallbackTimerId=null;}
  // CRITICAL FIX: Reset all stale state from pre-crash.
  // When Java-side auto-recovery restarts the engine (recoverEngine()),
  // it does NOT call onEngineError() to JS — so JS state remains stale.
  // isAIThinding stuck=true would cause doAIMove() to early-return permanently.
  // _evalLoading stuck=true would prevent re-requesting eval.
  if(isAIThinking){isAIThinking=false;_aiBarInfo='';}
  if(isHintLoading){isHintLoading=false;_hintBarInfo='';}
  if(_evalLoading){_evalLoading=false;_sfEvalReady=false;}
  _ponderGen++;_ponderMoveSAN='';_ponderBarInfo='';_pendingPonderMoveUCI=null;
  if(_aiSafetyTimerId){clearTimeout(_aiSafetyTimerId);_aiSafetyTimerId=null;}
  // v1.0.2 FIX: Reset AI retry counter on engine ready (covers crash-recovery
  // path where onEngineRestarting → onEngineReady fires). Ensures the next
  // doAIMove() starts with a fresh retry budget.
  _aiRetryCount=0;
  _updateLoadingStatus(T('engine_ready'),100);
  // Sync language preference to SharedPreferences for notification i18n
  try{if(typeof AndroidBridge!=='undefined'&&AndroidBridge.saveLangPref)AndroidBridge.saveLangPref(_lang);}catch(e){}
  // Update foreground service notification with engine ready status
  _updateEngineNotification(T('engine_ready'));
  setTimeout(function(){
    _hideLoadingOverlay();
    // v1.0.4 Rev24: If analyze-all was active when the engine crashed, RESUME
    // the batch instead of silently dropping it. The user's "interrupted at a
    // certain point" symptom was partly caused by Java-side recoverEngine()
    // firing onEngineReady without restarting the batch.
    if(typeof _reviewAnalyzeAllActive!=='undefined'&&_reviewAnalyzeAllActive&&typeof reviewMode!=='undefined'&&reviewMode){
      // Resume the batch — requestEngineEval will check cache first (already-
      // analyzed steps are skipped) and call _reviewAnalyzeAdvance on hit.
      try{
        if(typeof _reviewAnalyzeResetSafetyTimer==='function')_reviewAnalyzeResetSafetyTimer();
        requestEngineEval();
        return;
      }catch(e){console.error('Analyze-all resume after engine ready failed:',e);}
    }
    // After engine auto-restart, resume the correct action based on game state.
    if(!gameOver&&!setupMode&&!reviewMode&&gameState.currentTurn!==playerColor){
      doAIMove();
    }else{
      requestEngineEval();
    }
  },300);
  // Refresh main UI to reflect engine ready state
  render();
}

// Callback: Best move received from engine (AI move)
function onBestMove(uciMove){
  console.log('onBestMove:',uciMove);
  // v1.0.3-p9 audit fix: check staleness BEFORE clearing the safety timer.
  // If a stale bestmove arrives, the real bestmove is still pending and the
  // safety timer must remain active to catch a potential timeout.
  if(_aiMoveRequestId!==_currentAiRequestId){console.warn('Discarding stale bestmove');return;}
  // Cancel safety timeout — engine responded (and it's the current request)
  if(_aiSafetyTimerId){clearTimeout(_aiSafetyTimerId);_aiSafetyTimerId=null;}
  isAIThinking=false;_aiBarInfo='';_aiRetryCount=0;

  // CRITICAL FIX: Always clear ponder display state at the start of onBestMove.
  // Increment _ponderGen to invalidate any in-flight onPonderProgress() callbacks
  // from the previous ponder session. Without this, old callbacks can re-populate
  // _ponderBarInfo with stale depth/nodes data after the new ponder starts.
  _ponderGen++;
  _ponderMoveSAN='';
  _ponderBarInfo='';
  _pendingPonderMoveUCI=null;
  _updateAIThinkDisplay();

  // Capture ponder move from engine's bestmove output for variation recording.
  // The Java side parses "bestmove e2e4 ponder e7e5" and stores the ponder move via
  // getLastPonderMove(). We fetch it here so we can record it as a variation.
  _lastPonderMoveFromEngine=null;
  try{
    if(typeof AndroidBridge!=='undefined'&&AndroidBridge.isEngineReady()&&typeof AndroidBridge.getLastPonderMove==='function'){
      const pm=AndroidBridge.getLastPonderMove();
      if(pm)_lastPonderMoveFromEngine=pm;
    }
  }catch(e){}

  // Clear MultiPV progress lines for next search
  _multiPVLines=[];
  // v1.0.5 Rev56: Also clear the MultiPV display cache so the next search's
  // first progress tick is not falsely skipped by a stale-signature hit.
  _clearMultiPVDisplayCache();

  // Process variations in onMultiPVResult() (called after onBestMove)
  // v1.0.2 FIX: Removed the `moveRecords.length > 0` guard — it skipped
  // variation tracking when the AI played the very first move of the game
  // (i.e., when the player chose Black). With the guard, _pendingBestMoveInfo
  // was never set → _processDeferredVariations() early-returned → no 🌿
  // variation lines were attached to the AI's first move. The fix uses
  // lastIdx = -1 in that case, which _processDeferredVariations() correctly
  // resolves to aiMoveIdx = 0 (the AI's first move record, added by
  // executeMove below).
  const lastIdx = moveRecords.length > 0 ? moveRecords.length - 1 : -1;
  const isAfterWhiteMove=(lastIdx%2===0);
  const moveNum=Math.floor(lastIdx/2)+1;
  // Save pre-move game state for SAN conversion later
  // Deep clone gameState to prevent mutation by executeMove()
  _pendingBestMoveInfo={
    uciMove:uciMove,
    lastIdx:lastIdx,
    isAfterWhiteMove:isAfterWhiteMove,
    moveNum:moveNum,
    preMoveState:cloneS(gameState),
    ponderMove:_lastPonderMoveFromEngine,
    ponderEnabled:!!(engineSettingsData&&engineSettingsData.ponder),
    multiPVEnabled:!!(engineSettingsData&&engineSettingsData.multiPV&&engineSettingsData.multiPV>1)
  };

  if(!uciMove||uciMove==='(none)'||uciMove==='0000'){
    render();
    return;
  }
  const coords=uciToCoords(uciMove);
  if(!coords){
    console.error('Failed to parse UCI move:',uciMove);
    render();
    return;
  }
  const from=coords.from, to=coords.to;
  if(!gameState.board[from.row]){console.error('Board row access error');render();return;}
  const piece=gameState.board[from.row][from.col];
  if(!piece){
    console.error('No piece at from square');
    render();
    return;
  }
  executeMove(from,to,coords.promotion);

  // After AI moves, start Ponder if enabled and we have a ponder move
  // This allows the engine to continue analyzing while the player thinks
  // FIX: Use _lastPonderMoveFromEngine instead of calling getLastPonderMove() again,
  // since getLastPonderMove() is now a one-shot read (clears after return).
  // The ponder move was already consumed and stored in _lastPonderMoveFromEngine above.
  // FIX: Don't start ponder on game-over positions (checkmate/stalemate).
  if(typeof AndroidBridge!=='undefined'&&AndroidBridge.isEngineReady()&&_lastPonderMoveFromEngine&&!gameOver){
    try{
      const ponderMove=_lastPonderMoveFromEngine;
      if(typeof AndroidBridge.startPonder==='function'){
        // Build FEN with the ponder move applied — engine will search this position
        const ponderFen=generateFEN(gameState);
        // Apply the ponder move to get the position the engine should analyze
        const pCoords=uciToCoords(ponderMove);
        if(pCoords&&gameState.board[pCoords.from.row]){
          const pPiece=gameState.board[pCoords.from.row][pCoords.from.col];
          if(pPiece){
            const ponderMv={from:pCoords.from,to:pCoords.to,piece:pPiece,promotion:pCoords.promotion};
            const ponderState=makeMv(gameState,ponderMv);
            const ponderFenAfterMove=generateFEN(ponderState);
            // v1.0.4 Rev31 UCI COMPLIANCE: pass current clock times to startPonder
            // so the engine's `go ponder` includes wtime/btime/winc/binc. When
            // ponderhit fires later, the engine uses these params to switch to
            // normal timed search. Without them, the engine doesn't know how
            // much time it has after ponderhit (broken timed-game ponder).
            // For untimed games (gameClocks===null), pass all zeros — Java side
            // detects this and sends plain "go ponder" (no time params).
            let _pwtime=0,_pbtime=0,_pwinc=0,_pbinc=0;
            if(typeof gameClocks!=='undefined'&&gameClocks){
              // After AI's move, it's player's turn. The ponder position is
              // AFTER the predicted player move, so it's AI's turn again.
              // wtime/btime are from the CURRENT gameClocks (before player moves).
              // Use displayRemainingSec for the most accurate current value.
              const _wRem=gameClocks.white.displayRemainingSec!=null?gameClocks.white.displayRemainingSec:gameClocks.white.remainingSec;
              const _bRem=gameClocks.black.displayRemainingSec!=null?gameClocks.black.displayRemainingSec:gameClocks.black.remainingSec;
              _pwtime=Math.round(_wRem*1000);
              _pbtime=Math.round(_bRem*1000);
              if(gameClocks.type==='fischer'){
                _pwinc=Math.round((gameClocks.incrementSec||0)*1000);
                _pbinc=Math.round((gameClocks.incrementSec||0)*1000);
              }
            }
            AndroidBridge.startPonder((typeof _sanitizeFenForEngine==='function')?_sanitizeFenForEngine(ponderFenAfterMove):ponderFenAfterMove,_pwtime,_pbtime,_pwinc,_pbinc);
            // DEFERRED PONDER DISPLAY: Do NOT set _ponderMoveSAN here.
            // Previously, setting _ponderMoveSAN immediately caused the AI bar to show
            // the ponder move SAN WITHOUT progress info (since _ponderBarInfo was still
            // empty until onPonderProgress fires). This created a brief partial display.
            // FIX: _ponderMoveSAN is now set in onPonderProgress() when the first
            // progress callback arrives, ensuring BOTH values are set simultaneously.
            // Store the ponder move UCI for later SAN conversion in onPonderProgress.
            // Also record the current generation so onPonderProgress() can verify
            // it's from the current ponder session, not a stale callback.
            _ponderGen++;
            _ponderStartGen=_ponderGen;
            _pendingPonderMoveUCI=ponderMove;
          }
        }
      }
    }catch(e){console.warn('Ponder start failed:',e);}
  }
}

// Callback: Hint move received from engine
// Converts UCI move to SAN (Standard Algebraic Notation) for FIDE PGN compliant display
// Also displays the ponder move (engine's predicted reply) alongside the bestmove
function onHintMove(uciMove){
  console.log('onHintMove:',uciMove);
  isHintLoading=false;_hintBarInfo='';
  // Increment _ponderGen to invalidate stale onPonderProgress() callbacks
  _ponderGen++;
  _ponderBarInfo='';
  _pendingPonderMoveUCI=null;

  if(!uciMove||uciMove==='(none)'||uciMove==='0000'){
    _ponderMoveSAN='';_lastPonderMoveFromEngine=null;
    _updateAIThinkDisplay();
    hintText=T('engine_unavailable');
    render();
    return;
  }
  const coords=uciToCoords(uciMove);
  if(!coords){
    _ponderMoveSAN='';_lastPonderMoveFromEngine=null;
    _updateAIThinkDisplay();
    hintText=T('hint_request_failed');
    render();
    return;
  }
  // Generate SAN notation for the bestmove (推荐走法)
  const piece=gameState.board[coords.from.row][coords.from.col];
  if(!piece){
    _ponderMoveSAN='';_lastPonderMoveFromEngine=null;
    _updateAIThinkDisplay();
    hintText='🔦 '+T('recommend')+': '+uciMove;
    render();
    return;
  }
  const mv={from:coords.from,to:coords.to,piece:piece,promotion:coords.promotion};
  const postState=makeMv(gameState,mv);
  const san=moveAlg(gameState,mv,postState);

  // Fetch ponder move from the Java side — engine may have provided "bestmove X ponder Y"
  // User requirement: "AI提示栏应该在显示推荐走法（bestmove）的同时显示预判走法（ponder）"
  _lastPonderMoveFromEngine=null;
  _ponderMoveSAN='';
  try{
    if(typeof AndroidBridge!=='undefined'&&AndroidBridge.isEngineReady()&&typeof AndroidBridge.getLastPonderMove==='function'){
      const pm=AndroidBridge.getLastPonderMove();
      if(pm)_lastPonderMoveFromEngine=pm;
    }
  }catch(e){}
  // Convert ponder move to SAN for display alongside the hint (bestmove).
  // The ponder move is the opponent's predicted reply AFTER the recommended move.
  // For correct SAN, we must convert from the post-hint-move position (postState).
  if(_lastPonderMoveFromEngine){
    try{
      const pCoords=uciToCoords(_lastPonderMoveFromEngine);
      if(pCoords&&postState.board[pCoords.from.row]){
        const pPiece=postState.board[pCoords.from.row][pCoords.from.col];
        if(pPiece){
          const pMv={from:pCoords.from,to:pCoords.to,piece:pPiece,promotion:pCoords.promotion};
          const afterPonder=makeMv(postState,pMv);
          _ponderMoveSAN=moveAlg(postState,pMv,afterPonder);
        }
      }
    }catch(e){_ponderMoveSAN='';}
  }

  // Build hint text: show bestmove, and ponder if available
  hintText='🔦 '+T('recommend')+': '+san;
  if(_ponderMoveSAN){
    hintText+='  🔮 '+T('ponder')+': '+_ponderMoveSAN;
  }
  _updateAIThinkDisplay();
  // Auto-select recommended piece and show legal move dots
  selectedSquare=coords.from;
  legalMvs=legalMoves(gameState,selectedSquare);
  legalSet=new Set(legalMvs.map(m=>m.row*8+m.col));
  HapticManager.fire('PIECE_SELECT');
  _updateBoardLightweight();
  render();
}

// Callback: Engine progress update
// Score is from side-to-move's perspective (UCI convention).
// Convert to White's perspective for consistent display.
// Updated: now accepts 8 params (added wdlW, wdlD, wdlL from Stockfish UCI_ShowWDL)
// Updated: also updates eval display depth during STATE_EVAL searches
// v1.0.4 Rev33: added seldepth (9th param) for "SD" display after "D".
// seldepth (selective search depth) is the tactical depth — usually >= depth.
// Per SF18 eval best-practices doc: depth is the main iteration depth, seldepth
// reflects the actual max depth reached in tactical variations. Displayed as
// "SD<N>" right after "D<N>" to match the existing abbreviated style.
function onEngineProgress(depth,nodes,nps,scoreCp,scoreMate,wdlW,wdlD,wdlL,seldepth){
  if(depth<=0)return;
  // DEFENSE IN DEPTH: Skip unrealistic depth values (>60) that could come from
  // stale info lines due to Java state machine race condition (see StockfishNative
  // processInfoLine for root cause analysis). Prevents showing "深度:200" etc.
  if(depth>60){console.warn('onEngineProgress: skipping unrealistic depth',depth);return;}
  let infoParts=[T('depth')+':'+depth];
  // v1.0.4 Rev33: add seldepth as "SD<N>" right after depth, only if > depth
  // (seldepth == depth is redundant; seldepth < depth shouldn't happen but
  // guard against it). seldepth=0/null means the engine didn't report it.
  // v1.0.4 Rev35: AI opponent bar uses localized label (选深 / SelDepth) instead
  // of the abbreviated "SD". The eval bar (in ui.js) keeps "SD" for compactness.
  // v1.0.4 Rev36: add ':' between label and value for format consistency with
  // depth/nodes/nps (all use "label:value" format).
  if(seldepth!=null&&seldepth>0&&seldepth>depth){
    infoParts.push(T('seldepth_label')+':'+seldepth);
  }
  if(nodes!=null){const nodesStr=nodes>=1000000?(nodes/1000000).toFixed(1)+'M':nodes>=1000?Math.round(nodes/1000)+'K':String(nodes);infoParts.push(T('nodes')+':'+nodesStr);}
  if(nps!=null){const npsStr=nps>=1000000?(nps/1000000).toFixed(1)+'M/s':nps>=1000?Math.round(nps/1000)+'K/s':String(nps);infoParts.push(npsStr);}
  // Determine which side is to move: STATE_GO=AI's turn, STATE_HINT=player's turn, STATE_EVAL=eval
  // P0 FIX: When both isAIThinking and isHintLoading are false, this is STATE_EVAL —
  // use gameState.currentTurn directly. When AI is thinking, AI plays for the opposite
  // color of the player. When hint is loading, it's the player's turn.
  let isBlackToMove;
  if(isAIThinking){isBlackToMove=(playerColor==='white');}
  else if(isHintLoading){isBlackToMove=(playerColor==='black');}
  else{isBlackToMove=gameState.currentTurn==='black';}
  // Convert score to White's perspective
  const wCp=isBlackToMove?-scoreCp:scoreCp;
  const wMate=isBlackToMove?-scoreMate:scoreMate;
  let scoreStr='';
  if(scoreMate!=null){const m=parseInt(wMate);scoreStr=m>0?' #+'+Math.abs(m):m<0?' #-'+Math.abs(m):' #0';}
  else if(scoreCp!=null){const pd=(wCp/100).toFixed(1);scoreStr=' '+T('eval_label')+':'+(wCp>0?'+':'')+pd;}
  if(scoreStr)infoParts.push(scoreStr.trim());
  aiThinkInfo=infoParts.join(' ');
  // Immediately sync bar info so subsequent render() uses latest values
  if(isAIThinking)_aiBarInfo=aiThinkInfo;
  if(isHintLoading)_hintBarInfo=aiThinkInfo;
  // Also update eval display depth during STATE_EVAL searches (position evaluation).
  // Previously, STATE_EVAL only stored values without dispatching onEngineProgress,
  // so the user saw "分析中" with no depth/nodes/speed info during eval searches.
  // Now Java dispatches onEngineProgress for all states, and we update the eval
  // display's depth indicator in real-time.
  if(_evalLoading&&depth<=30){
    _sfDepth=depth;
    // v1.0.4 Rev33: also track seldepth for the eval bar's "D15 SD22" display.
    _sfSeldepth=(seldepth!=null&&seldepth>0&&seldepth<=60)?seldepth:0;
    if(nodes!=null)_lastProgressNodes=nodes;
    if(nps!=null)_lastProgressNps=nps;
    _updateEvalDisplay();
  }
  if(isAIThinking||isHintLoading)_updateAIThinkDisplay();
  // Update foreground service notification with engine progress info
  // v1.0.1: Notification shows ONLY ready/analyzing/error states — no depth/speed.
  // The detailed depth/nps/score data is still shown in the in-app eval bar;
  // the notification is intentionally minimal to avoid distracting the user.
  if(isAIThinking&&depth>0){
    _updateEngineNotification(T('analyzing_ellipsis'));
  }
  // Ponder info: when not AI thinking, not hint loading, not eval loading, store as ponder info
  // Note: _ponderBarInfo is ONLY set by onPonderProgress(), not here.
  // onEngineProgress is for the main search; ponder progress comes via
  // a separate callback (onPonderProgress) from the Java side.
  // SAFETY: Ensure stale ponder info is never displayed during active AI/hint search
  if(isAIThinking||isHintLoading){if(_ponderMoveSAN||_ponderBarInfo){_ponderGen++;_ponderMoveSAN='';_ponderBarInfo='';_pendingPonderMoveUCI=null;_updateAIThinkDisplay();}}
  // Track primary PV line for MultiPV display when MultiPV is enabled
  // FIX: Use cached _cachedMultiPV instead of calling getEngineSettings() on every progress tick.
  // The JNI call + JSON.parse was causing significant overhead at 10-50 ticks/second.
  if(_cachedMultiPV>1){
    const primaryLine={index:1,depth:depth,scoreCp:scoreCp,scoreMate:scoreMate,wdlW:wdlW,wdlD:wdlD,wdlL:wdlL,pv:''};
    let found=false;
    for(let i=0;i<_multiPVLines.length;i++){
      if(_multiPVLines[i].index===1){_multiPVLines[i]=primaryLine;found=true;break;}
    }
    if(!found)_multiPVLines.push(primaryLine);
    // v1.0.5 Rev56 PERF: only sort when a new line was appended (same
    // optimization as onMultiPVProgress above).
    if(!found){
      _multiPVLines.sort(function(a,b){return a.index-b.index;});
    }
    _updateMultiPVDisplay();
  }
}

// Ponder progress is decoupled from move records (never appears as variation),
// but is displayed as 🔮 row in the AI opponent bar for real-time feedback.
// v1.0.4 Rev33: added seldepth (6th param) for "SD" display after "D".
function onPonderProgress(depth,nodes,nps,scoreCp,scoreMate,seldepth){
  if(depth<=0)return;
  if(depth>60)return; // Skip unrealistic depths from stale info lines
  // FIX: Generation-based staleness guard. If the ponder generation has changed
  // since this ponder session started (e.g., by requestEngineEval, executeMove,
  // or a new ponder starting), this callback is stale and must be discarded.
  // The old guard (!_pendingPonderMoveUCI && !_ponderMoveSAN) was insufficient:
  // when a new ponder starts, _pendingPonderMoveUCI is set, allowing old callbacks
  // to pass the guard. The old callback would then set _ponderMoveSAN from the
  // NEW _pendingPonderMoveUCI (correct) but set _ponderBarInfo with OLD depth/nodes
  // data from the previous search, creating a mix of new and stale data.
  if(_ponderStartGen!==_ponderGen)return;
  // FIX: Set _ponderMoveSAN on first ponder progress to ensure BOTH _ponderMoveSAN
  // and _ponderBarInfo are populated simultaneously. Previously _ponderMoveSAN was
  // set in onBestMove() while _ponderBarInfo was only set here, causing a brief
  // partial display where the ponder move showed without progress info.
  if(!_ponderMoveSAN&&_pendingPonderMoveUCI){
    try{const _pmc=_uciToSAN(_pendingPonderMoveUCI,gameState);_ponderMoveSAN=_pmc.san||'';}catch(e){_ponderMoveSAN='';}
    _pendingPonderMoveUCI=null; // One-shot: only convert once
  }
  let infoParts=[T('depth')+':'+depth];
  // v1.0.4 Rev33: add seldepth as "SD<N>" right after depth (same style as onEngineProgress).
  // v1.0.4 Rev35: AI opponent bar (ponder) uses localized label (选深 / SelDepth).
  // v1.0.4 Rev36: add ':' for format consistency.
  if(seldepth!=null&&seldepth>0&&seldepth>depth){
    infoParts.push(T('seldepth_label')+':'+seldepth);
  }
  if(nodes!=null){const nodesStr=nodes>=1000000?(nodes/1000000).toFixed(1)+'M':nodes>=1000?Math.round(nodes/1000)+'K':String(nodes);infoParts.push(T('nodes')+':'+nodesStr);}
  if(nps!=null){const npsStr=nps>=1000000?(nps/1000000).toFixed(1)+'M/s':nps>=1000?Math.round(nps/1000)+'K/s':String(nps);infoParts.push(npsStr);}
  // Ponder scores are from the side-to-move's perspective.
  // During ponder, the engine analyzes the position AFTER the player's predicted
  // move, so the side-to-move is the AI (opposite of playerColor).
  // v1.0.4 Rev36 FIX: was `(playerColor==='black')` — inverted! When player is
  // white, AI is black, ponder position is AI's turn (black) → isBlackToMove
  // should be true. Old code returned false (wrong sign on ponder score display).
  let isBlackToMove=(playerColor==='white'); // Ponder position = AI's turn; AI is black when player is white
  const wCp=isBlackToMove?-scoreCp:scoreCp;
  const wMate=isBlackToMove?-scoreMate:scoreMate;
  let scoreStr='';
  if(scoreMate!=null&&scoreMate!==0){const m=parseInt(wMate);scoreStr=m>0?' #+'+Math.abs(m):m<0?' #-'+Math.abs(m):'';}
  else if(scoreCp!=null){const pd=(wCp/100).toFixed(1);scoreStr=' '+T('eval_label')+':'+(wCp>0?'+':'')+pd;}
  if(scoreStr)infoParts.push(scoreStr.trim());
  _ponderBarInfo=infoParts.join(' ');
  _updateAIThinkDisplay();
  // Update foreground service notification with ponder progress
  // v1.0.1: Ponder is also "analyzing" from the user's POV — show the same minimal state.
  _updateEngineNotification(T('analyzing_ellipsis'));
}

// Callback: Engine evaluation result
// Stockfish UCI scores are from the SIDE-TO-MOVE's perspective.
// We convert to White's perspective here using _evalForBlackTurn.
// In review mode: caches result and discards stale callbacks.
// Updated: now accepts 6 params (scoreCp, scoreMate, depth, wdlW, wdlD, wdlL)
// v1.0.4 Rev33: added seldepth (7th param) for "SD" display in eval bar.
function onEngineEval(scoreCp,scoreMate,depth,wdlW,wdlD,wdlL,seldepth){
  // Update heartbeat timestamp — prevents false-positive engine death detection
  // during long eval searches (go depth 22 can take several seconds)
  _lastEngineCallbackTime=Date.now();
  // v1.0.7 PHASE 19 (bug fix): Cross-mode stale callback rejection. A review-mode
  // eval callback still in flight after exitReview() would previously pass the
  // normal-mode gen check (both gens equal in normal mode). Now we capture the
  // mode at request time and reject if the current mode doesn't match.
  if(_evalRequestReviewMode!==!!reviewMode){
    return; // Mode mismatch — stale callback from the other mode
  }
  // In review mode: discard stale callbacks from previous steps
  if(reviewMode&&_reviewEvalRequestedStep!==reviewStep){
    return; // Stale response — user has navigated to a different step
  }
  // In normal mode: discard stale callbacks when game state changed
  if(!reviewMode&&_evalStaleGen!==_evalRequestGen){
    return; // Stale response — position no longer matches eval request
  }
  _evalLoading=false;
  // v1.0.4 Rev44: Clear the eval safety timer — engine responded successfully.
  if(_evalSafetyTimerId){clearTimeout(_evalSafetyTimerId);_evalSafetyTimerId=null;}
  // Store WDL data (-1 means not available)
  _sfWdlW=(wdlW!=null&&wdlW>=0)?wdlW:-1;
  _sfWdlD=(wdlD!=null&&wdlD>=0)?wdlD:-1;
  _sfWdlL=(wdlL!=null&&wdlL>=0)?wdlL:-1;
  // Flip WDL from side-to-move to White's perspective if Black is to move
  if(_evalForBlackTurn&&_sfWdlW>=0){const tmp=_sfWdlW;_sfWdlW=_sfWdlL;_sfWdlL=tmp;}
  if(scoreMate!=null){
    const mateN=parseInt(scoreMate);
    const whiteWins=(_evalForBlackTurn?mateN<=0:mateN>0);
    _sfEval=whiteWins?99999:-99999;
    _sfMateDistance=_evalForBlackTurn?-mateN:mateN;
  }else{
    _sfEval=_evalForBlackTurn?-scoreCp:scoreCp;
    _sfMateDistance=0;
  }
  // DEFENSE IN DEPTH: Cap _sfDepth at reasonable maximum (30) — normal eval
  // searches use go depth 15 or go depth 22, so any depth > 30 is from a stale
  // info line that bypassed Java's sanity check (extremely rare but possible
  // in race conditions). Prevents eval bar showing "D200" etc.
  _sfDepth=(depth&&depth<=30)?depth:0;
  // v1.0.4 Rev33: store seldepth (cap at 60 for sanity).
  _sfSeldepth=(seldepth!=null&&seldepth>0&&seldepth<=60)?seldepth:0;
  _sfEvalReady=true;
  // Cache the result for review mode (now includes WDL, depth, and seldepth)
  if(reviewMode){
    _reviewEvalCache.set(reviewStep,{eval:_sfEval,mate:_sfMateDistance,wdlW:_sfWdlW,wdlD:_sfWdlD,wdlL:_sfWdlL,depth:_sfDepth,seldepth:_sfSeldepth});
  }
  // Callback-driven reviewAnalyzeAll: advance to next step when eval completes
  if(reviewMode&&_reviewAnalyzeAllActive){
    _reviewAnalyzeAdvance();
  }
  _updateAllEvalDisplays();
  // v1.0.7 PHASE 17: Also live-refresh the "Analyze All" button label so it
  // switches to "All Analyzed" the moment the last step's eval completes —
  // whether via the batch reviewAnalyzeAll() path OR via the user manually
  // clicking through moves one-by-one. Without this, the button stayed stuck
  // at "Analyze All N (k/N)" until the next full render.
  try{
    if(typeof _updateReviewAnalyzeBtn==='function')_updateReviewAnalyzeBtn();
  }catch(e){}
}

// Callback: Engine error
function renderEngineConfig(){
  if(!showEngineConfig)return '';
  const info=engineConfigData||{};
  const settings=engineSettingsData||{};
  let h='<div class="dov" role="dialog" aria-modal="true" aria-label="'+T('engine_config')+'" onclick="if(event.target===this){closeEngineConfig()}"><div class="dlg" style="max-width:520px"><h2>⚙️ '+T('engine_config')+'</h2>';
  // Tabs
  h+='<div style="display:flex;gap:2px;margin-bottom:14px;border-bottom:1px solid var(--border);padding-bottom:8px">';
  h+='<button class="btn'+(engineConfigTab==='engine'?' btn-a':'')+'" onclick="HapticManager.fire(\'TAB_SWITCH\');engineConfigTab=\'engine\';renderEngineConfigAndUpdate()" style="flex:1">'+(_lang==='zh'?T('import_settings_engine'):'Engine')+'</button>';
  h+='<button class="btn'+(engineConfigTab==='settings'?' btn-a':'')+'" onclick="HapticManager.fire(\'TAB_SWITCH\');engineConfigTab=\'settings\';renderEngineConfigAndUpdate()" style="flex:1">'+T('advanced_settings')+'</button>';
  h+='</div>';
  if(engineConfigTab==='engine'){
    // Engine info section — built-in engine only
    h+='<div class="dlg-sec"><h3>'+T('engine_info')+'</h3>';
    h+='<div style="background:#221015;border:1px solid var(--border);border-radius:6px;padding:10px;font-size:.8rem;line-height:1.6">';
    h+='<div><span style="color:var(--muted)">'+T('engine_name')+': </span><span style="font-weight:700">'+_esc(info.name||'Stockfish 18')+'</span><span style="color:var(--accent);font-size:.65rem;margin-left:6px">['+T('built_in')+']</span></div>';
    h+='<div><span style="color:var(--muted)">'+T('engine_author')+': </span><span>'+_esc(info.author||'--')+'</span></div>';
    if(info.threads!=null)h+='<div><span style="color:var(--muted)">'+T('engine_threads')+': </span><span>'+info.threads+'</span></div>';
    if(info.hash!=null)h+='<div><span style="color:var(--muted)">'+T('engine_hash')+': </span><span>'+info.hash+' MB</span></div>';
    h+='</div></div>';
    // Restart button only — import removed
    h+='<div class="dlg-sec"><div style="display:flex;gap:8px;flex-wrap:wrap">';
    h+='<button class="btn" onclick="restartCurrentEngine()">'+T('engine_restart')+'</button>';
    h+='</div></div>';
  }else{
    // Settings tab
    const auto=!!settings.autoConfig;
    h+='<div class="dlg-sec"><h3>'+T('auto_config')+'</h3>';
    h+='<div class="toggle" onclick="toggleAutoConfig()" style="margin-bottom:6px"><span>'+T('auto_config_hardware')+'</span><div class="toggle-sw'+(auto?' on':'')+'"></div></div>';
    h+='<div style="font-size:.72rem;color:var(--muted);margin-bottom:10px">'+T('auto_config_desc')+'</div>';
    h+='</div>';
    if(!auto){
      // Manual settings
      h+='<div class="dlg-sec"><h3>'+T('manual_settings')+'</h3>';
      // Threads
      h+='<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><span style="font-size:.8rem">'+T('thinking_threads')+'</span><div style="display:flex;align-items:center;gap:4px"><button class="btn" style="padding:2px 8px;min-height:28px;font-size:.9rem" onclick="setConfigThreads('+(settings.threads-1)+')">-</button><span style="min-width:24px;text-align:center;font-weight:700">'+(settings.threads||1)+'</span><button class="btn" style="padding:2px 8px;min-height:28px;font-size:.9rem" onclick="setConfigThreads('+(settings.threads+1)+')">+</button></div></div><div style="font-size:.7rem;color:var(--muted)">'+T('threads_rec')+'</div></div>';
      // Hash
      h+='<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><span style="font-size:.8rem">'+T('hash_mb')+'</span><div style="display:flex;align-items:center;gap:4px"><button class="btn" style="padding:2px 8px;min-height:28px;font-size:.9rem" onclick="setConfigHash('+(settings.hash-16)+')">-</button><span style="min-width:32px;text-align:center;font-weight:700">'+(settings.hash||128)+' MB</span><button class="btn" style="padding:2px 8px;min-height:28px;font-size:.9rem" onclick="setConfigHash('+(settings.hash+16)+')">+</button></div></div><div style="font-size:.7rem;color:var(--muted)">'+T('hash_rec')+'</div></div>';
      // MultiPV
      h+='<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><span style="font-size:.8rem">'+T('multipv_label')+'</span><div style="display:flex;align-items:center;gap:4px"><button class="btn" style="padding:2px 8px;min-height:28px;font-size:.9rem" onclick="setConfigMultiPV('+(settings.multiPV-1)+')">-</button><span style="min-width:24px;text-align:center;font-weight:700">'+(settings.multiPV||1)+'</span><button class="btn" style="padding:2px 8px;min-height:28px;font-size:.9rem" onclick="setConfigMultiPV('+(settings.multiPV+1)+')">+</button></div></div><div style="font-size:.7rem;color:var(--muted)">'+T('multipv_desc')+'</div></div>';
      // Move Overhead
      h+='<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><span style="font-size:.8rem">'+T('move_overhead_label')+'</span><div style="display:flex;align-items:center;gap:4px"><button class="btn" style="padding:2px 8px;min-height:28px;font-size:.9rem" onclick="setConfigMoveOverhead('+(settings.moveOverhead-10)+')">-</button><span style="min-width:36px;text-align:center;font-weight:700">'+(settings.moveOverhead||60)+' ms</span><button class="btn" style="padding:2px 8px;min-height:28px;font-size:.9rem" onclick="setConfigMoveOverhead('+(settings.moveOverhead+10)+')">+</button></div></div><div style="font-size:.7rem;color:var(--muted)">'+T('move_overhead_desc')+'</div></div>';
      h+='</div>';
    }
    // Ponder
    h+='<div class="dlg-sec"><div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:.8rem">'+T('ponder_hint')+'</span><div class="toggle" onclick="togglePonder()"><div class="toggle-sw'+(settings.ponder?' on':'')+'"></div></div></div><div style="font-size:.7rem;color:var(--muted)">'+T('ponder_desc')+'</div></div>';
    // Show WDL
    h+='<div class="dlg-sec"><div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:.8rem">'+T('show_wdl_label')+'</span><div class="toggle" onclick="toggleShowWDL()"><div class="toggle-sw'+(settings.showWDL?' on':'')+'"></div></div></div><div style="font-size:.7rem;color:var(--muted)">'+T('show_wdl_desc')+'</div></div>';
    // Skill Level
    // v1.0.6 GRAY-OUT UNIFICATION: Only the +/- stepper buttons are dimmed and
    // disabled when limitStrength is on — the label "技能等级"/"Skill Level",
    // the description "降低引擎技术水平…"/"Lower engine skill level…", and the
    // red warning "限制Elo开启时，Skill Level由UCI_Elo自动决定" remain at full
    // opacity. The red warning color matches the new-game dialog's gray-out
    // explanation color (var(--red)) for consistency across both dialogs.
    h+='<div class="dlg-sec"><div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><span style="font-size:.8rem">'+T('skill_level_label')+'</span><div style="display:flex;align-items:center;gap:4px;opacity:'+(settings.limitStrength?'0.4':'1')+';pointer-events:'+(settings.limitStrength?'none':'auto')+'"><button class="btn" style="padding:2px 8px;min-height:28px;font-size:.9rem" onclick="setConfigSkillLevel('+(settings.skillLevel-1)+')">-</button><span style="min-width:24px;text-align:center;font-weight:700">'+(settings.skillLevel!=null?settings.skillLevel:20)+'</span><button class="btn" style="padding:2px 8px;min-height:28px;font-size:.9rem" onclick="setConfigSkillLevel('+(settings.skillLevel+1)+')">+</button></div></div><div style="font-size:.7rem;color:var(--muted)">'+T('skill_level_desc')+(settings.limitStrength?'<br><span style="color:var(--red)">'+T('skill_elo_note')+'</span>':'')+'</div></div></div>';
    // Limit Elo
    h+='<div class="dlg-sec"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><span style="font-size:.8rem">'+T('limit_elo_label')+'</span><div class="toggle" onclick="toggleLimitElo()"><div class="toggle-sw'+(settings.limitStrength?' on':'')+'"></div></div></div>';
    if(settings.limitStrength){
      h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px"><span style="font-size:.8rem">'+T('elo_target')+'</span><div style="display:flex;align-items:center;gap:4px"><button class="btn" style="padding:2px 8px;min-height:28px;font-size:.9rem" onclick="setConfigElo('+(settings.elo-50)+')">-</button><span style="min-width:40px;text-align:center;font-weight:700">'+(settings.elo||2800)+'</span><button class="btn" style="padding:2px 8px;min-height:28px;font-size:.9rem" onclick="setConfigElo('+(settings.elo+50)+')">+</button></div></div>';
    }
    h+='</div>';
    // Export/Import buttons
    h+='<div class="dlg-sec"><div style="display:flex;gap:8px;flex-wrap:wrap">';
    h+='<button class="btn btn-s" onclick="exportEngineSettings()">'+T('export_settings_btn')+'</button>';
    h+='<button class="btn btn-s" onclick="importEngineSettings()">'+T('import_settings_btn')+'</button>';
    h+='</div></div>';
  }
  h+='<div class="dlg-btns"><button type="button" class="btn btn-s" onclick="closeEngineConfig()">'+T('close')+'</button></div>';
  h+='</div></div>';
  return h;
}
function renderEngineConfigAndUpdate(){
  const overlay=document.querySelector('.dov[role="dialog"]');
  if(overlay){
    const dlg=overlay.querySelector('.dlg');
    if(dlg){
      const h=renderEngineConfig();
      // Extract just the inner HTML (strip outer .dov wrapper)
      const temp=document.createElement('div');temp.innerHTML=h;
      const innerDlg=temp.querySelector('.dlg');
      if(innerDlg)dlg.innerHTML=innerDlg.innerHTML;
    }
  }
}
function openEngineConfig(){
  showEngineConfig=true;
  engineConfigData=null;
  engineSettingsData=null;
  // No engine scanning/import — only built-in engine info
  if(typeof AndroidBridge!=='undefined'){
    try{const info=AndroidBridge.getEngineInfo();if(info)engineConfigData=JSON.parse(info);}catch(e){engineConfigData={name:'Stockfish 18',author:'T. Romstad, M. Costalba, J. Kiiski, G. Linscott'};}
    try{const settings=AndroidBridge.getEngineSettings();if(settings)engineSettingsData=JSON.parse(settings);}catch(e){engineSettingsData=null;}
  }
  if(!engineSettingsData){
    engineSettingsData={threads:2,hash:128,moveOverhead:60,multiPV:1,ponder:false,showWDL:true,skillLevel:20,limitStrength:false,elo:2800,autoConfig:true};
  }
  // FIX: Cache multiPV setting to avoid per-tick JNI calls in onEngineProgress
  _cachedMultiPV=engineSettingsData.multiPV||1;
  render();
}
function closeEngineConfig(){showEngineConfig=false;render();}
// Only built-in engine is supported.
// Kept as stubs for compatibility
function switchEngine(path){
  showToast(T('built_in_only'));
}
function importExternalEngine(){
  showToast(T('built_in_only'));
}
// Only settings import — engine import removed
let _fileBrowserPath='';
let _fileBrowserMode=''; // 'settings' only now
// FIX: Navigation history stack for level-by-level back navigation.
// Each entry is the path string of a previously visited directory.
// When Android back button is pressed, pop from stack to go up one level.
// When stack is empty, close the file browser.
let _fileBrowserHistory=[];
function _openSettingsFileBrowser(){
  _fileBrowserMode='settings';
  _fileBrowserHistory=[];
  // FIX: Use requireEngine=false — file browsing doesn't need engine
  _bridgeCall(function(bridge){
    try{
      const paths=JSON.parse(bridge.getDefaultPaths());
      _fileBrowserPath=paths.downloads||paths.externalStorage||'/sdcard';
    }catch(e){_fileBrowserPath='/sdcard';}
    _showFileBrowser();
  },null,false);
}
function _showFileBrowser(){
  // FIX: Use requireEngine=false — file browsing doesn't need engine
  _bridgeCall(function(bridge){
    try{
      const files=JSON.parse(bridge.listFiles(_fileBrowserPath));
      // Get canonical parent path from Java (avoids /path/to/dir/.. issues)
      let parentPath='';
      try{
        parentPath=bridge.getParentPath(_fileBrowserPath)||'';
      }catch(e){}
      let h='<div class="dov" role="dialog" aria-modal="true" aria-label="'+T('file_browse_label')+'" onclick="if(event.target===this){_closeFileBrowser()}"><div class="dlg" style="max-width:520px;max-height:80vh;overflow-y:auto">';
      h+='<h2>'+T('import_settings_title')+'</h2>';
      h+='<div style="background:#221015;border:1px solid var(--border);border-radius:4px;padding:6px 10px;font-size:.72rem;color:var(--muted);margin-bottom:10px;word-break:break-all">'+_esc(_fileBrowserPath)+'</div>';
      // Navigation buttons
      h+='<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">';
      h+='<button class="btn" style="font-size:.72rem;padding:3px 8px" onclick="_fileBrowserGoTo(\'/sdcard\')">/sdcard</button>';
      h+='<button class="btn" style="font-size:.72rem;padding:3px 8px" onclick="_fileBrowserGoTo(\'/storage/emulated/0/Download\')">Download</button>';
      h+='<button class="btn" style="font-size:.72rem;padding:3px 8px" onclick="_fileBrowserGoTo(\'/storage/emulated/0/Documents\')">Documents</button>';
      h+='<button class="btn" style="font-size:.72rem;padding:3px 8px" onclick="_fileBrowserInputPath()">'+T('manual_path')+'</button>';
      h+='</div>';
      // Parent directory — use Java-resolved parent path instead of /..
      if(parentPath&&parentPath!==_fileBrowserPath){
        h+='<button class="btn" style="width:100%;text-align:left;margin-bottom:4px;font-size:.78rem" onclick="_fileBrowserGoUp()">📁 ..</button>';
      }
      // File list
      for(const f of files){
        if(f.isDirectory){
          h+='<button class="btn" style="width:100%;text-align:left;margin-bottom:2px;font-size:.78rem" onclick="_fileBrowserGoTo(\''+_escJs(f.path)+'\')">📁 '+_esc(f.name)+'</button>';
        }else{
          const isSettings=f.name.endsWith('.txt')||f.name.endsWith('.cfg');
          const highlight=_fileBrowserMode==='settings'&&isSettings;
          h+='<button class="btn'+(highlight?' btn-a':'')+'" style="width:100%;text-align:left;margin-bottom:2px;font-size:.78rem" onclick="_fileBrowserSelect(\''+_escJs(f.path)+'\')">'+(isSettings?'📋 ':'📄 ') +_esc(f.name)+' <span style="color:var(--muted);font-size:.65rem">'+(f.size>=1048576?(f.size/1048576).toFixed(1)+'MB':(f.size/1024).toFixed(0)+'KB')+'</span></button>';
        }
      }
      if(files.length===0){h+='<div style="color:var(--muted);font-size:.78rem;text-align:center;padding:20px">'+T('empty_dir')+'</div>';}
      h+='<div class="dlg-btns"><button type="button" class="btn btn-s" onclick="_closeFileBrowser()">'+T('cancel_btn')+'</button></div>';
      h+='</div></div>';
      // Render the browser as overlay
      const existing=document.getElementById('_fileBrowserOverlay');
      if(existing)existing.remove();
      const div=document.createElement('div');
      div.id='_fileBrowserOverlay';
      div.innerHTML=h;
      document.body.appendChild(div);
    }catch(e){showToast(T('file_browse_failed')+': '+e.message);}
  });
}
// FIX: Navigate to a subdirectory, pushing current path onto history stack
function _fileBrowserGoTo(path){
  _fileBrowserHistory.push(_fileBrowserPath);
  _fileBrowserPath=path;
  _showFileBrowser();
}
// FIX: Navigate up one level using history stack (proper back navigation)
function _fileBrowserGoUp(){
  if(_fileBrowserHistory.length>0){
    _fileBrowserPath=_fileBrowserHistory.pop();
  }else{
    // No history — use Java to get parent path
    // FIX: Use _bridgeCall instead of direct AndroidBridge reference for safety
    _bridgeCall(function(bridge){
      const parent=bridge.getParentPath(_fileBrowserPath);
      if(parent&&parent!==_fileBrowserPath){
        _fileBrowserPath=parent;
      }
    },null,false);
  }
  _showFileBrowser();
}
// FIX: Handle Android back button in file browser — go up one level or close
function _fileBrowserHandleBack(){
  if(_fileBrowserHistory.length>0){
    _fileBrowserGoUp();
    return true; // Handled — don't close browser
  }
  // No history — check if we can go to parent
  try{
    if(typeof AndroidBridge!=='undefined'){
      const parent=AndroidBridge.getParentPath(_fileBrowserPath);
      if(parent&&parent!==_fileBrowserPath){
        _fileBrowserGoUp();
        return true; // Handled — don't close browser
      }
    }
  }catch(e){}
  // No parent — close the file browser
  _closeFileBrowser();
  return true;
}
function _fileBrowserInputPath(){
  const path=prompt(T('manual_path')+':',_fileBrowserPath);
  if(path){_fileBrowserHistory.push(_fileBrowserPath);_fileBrowserPath=path;_showFileBrowser();}
}
function _fileBrowserSelect(filePath){
  const overlay=document.getElementById('_fileBrowserOverlay');
  if(overlay)overlay.remove();
  // v1.0.3 FIX: Close the settings dialog IMMEDIATELY when a file is selected
  // from the built-in browser, before the async importSettings starts.
  // The old approach waited for onSettingsImported (seconds later), during
  // which the dialog stayed open.
  showEngineConfig=false;
  var dov=document.querySelector('.dov[role="dialog"]');
  if(dov)dov.remove();
  render();
  // FIX: Use requireEngine=false — file reading doesn't need engine
  _bridgeCall(function(bridge){
    const content=bridge.readTextFile(filePath);
    if(content){
      // importSettings() is async on the Java side — onSettingsImported
      // callback will fire the success/failure toast.
      bridge.importSettings(content);
    }else{
      showToast(T('settings_read_fail'));
    }
  },null,false);
}
function _closeFileBrowser(){
  const overlay=document.getElementById('_fileBrowserOverlay');
  if(overlay)overlay.remove();
}
function restartCurrentEngine(){
  try{
    if(typeof AndroidBridge!=='undefined'){
      AndroidBridge.restartEngine();
      showToast(T('restarting_engine'));
      _engineReady=false; // Mark as not ready during restart
      _needNewGameForEngine=true; // Ensure ucinewgame is sent after restart
      // CRITICAL FIX: Reset stale state on manual restart
      isAIThinking=false;_aiBarInfo='';
      isHintLoading=false;_hintBarInfo='';
      _evalLoading=false;_sfEvalReady=false;
      _ponderGen++;_ponderMoveSAN='';_ponderBarInfo='';_pendingPonderMoveUCI=null;
      // v1.0.2 FIX (audit): Clear review eval cache so the new engine instance's
      // evaluations are re-fetched. Without this, stale eval values from the
      // pre-restart engine remained in the cache and were displayed in review
      // mode even after the engine was replaced.
      // v1.0.4 Rev23 FIX: Do NOT clear the entire cache — that destroys all
      // games' persisted evals. Just reset the requested step so the current
      // step is re-fetched. Stockfish is deterministic, so other games' evals
      // remain valid.
      _reviewEvalRequestedStep=-1;
      // v1.0.2 FIX (audit): Clear MultiPV variation state — the old engine's
      // in-flight PV lines are invalid after restart.
      _multiPVLines=[];_multiPVResult=null;_lastEngineVariation=null;
      // v1.0.5 Rev56: Clear the MultiPV display cache too (companion to the
      // _multiPVLines=[] reset above).
      _clearMultiPVDisplayCache();
      if(_aiSafetyTimerId){clearTimeout(_aiSafetyTimerId);_aiSafetyTimerId=null;}
    }else{
      showToast(T('engine_unavailable_bridge'));
    }
  }catch(e){showToast(T('restart_failed')+': '+e.message);}
  // Refresh engine info after a delay
  setTimeout(function(){
    if(typeof AndroidBridge!=='undefined'){
      try{const info=AndroidBridge.getEngineInfo();engineConfigData=JSON.parse(info);renderEngineConfigAndUpdate();}catch(e){}
    }
  },2500);
}
function setConfigThreads(v){v=Math.max(1,Math.min(64,parseInt(v)||1));if(engineSettingsData)engineSettingsData.threads=v;_bridgeCall(function(bridge){bridge.setEngineThreads(v);});renderEngineConfigAndUpdate();}
function setConfigHash(v){v=Math.max(1,Math.min(4096,parseInt(v)||64));if(engineSettingsData)engineSettingsData.hash=v;_bridgeCall(function(bridge){bridge.setEngineHash(v);});renderEngineConfigAndUpdate();}
function setConfigMultiPV(v){
  v=Math.max(1,Math.min(8,parseInt(v)||1));
  if(engineSettingsData)engineSettingsData.multiPV=v;
  _cachedMultiPV=v;
  // v1.0.5 Rev56 BUG FIX: When MultiPV is toggled OFF (set to 1) mid-search,
  // the stale secondary PV lines (index 2..N) from the previous MultiPV
  // search would persist in _multiPVLines and continue to be displayed via
  // _updateMultiPVDisplay. They were only cleared on the NEXT onBestMove,
  // which could be seconds away. Now we clear immediately when MultiPV is
  // disabled, so the display reverts to single-line mode instantly.
  if(v<=1){
    _multiPVLines=[];
    _clearMultiPVDisplayCache();
    // Trigger a display refresh so the stale secondary lines disappear now
    // rather than on the next progress tick (which won't come if MultiPV
    // is off — onEngineProgress only calls _updateMultiPVDisplay when
    // _cachedMultiPV>1).
    _hintBarInfo='';
    if(typeof _updateAIThinkDisplay==='function')_updateAIThinkDisplay();
  }
  _bridgeCall(function(bridge){bridge.setEngineMultiPV(v);});
  renderEngineConfigAndUpdate();
}
function setConfigMoveOverhead(v){v=Math.max(0,Math.min(5000,parseInt(v)||30));if(engineSettingsData)engineSettingsData.moveOverhead=v;_bridgeCall(function(bridge){bridge.setEngineMoveOverhead(v);});renderEngineConfigAndUpdate();}
function togglePonder(){
  const newVal=!(engineSettingsData&&engineSettingsData.ponder);
  if(engineSettingsData)engineSettingsData.ponder=newVal;
  HapticManager.fire(newVal?'TOGGLE_ON':'TOGGLE_OFF');
  _bridgeCall(function(bridge){bridge.setEnginePonder(newVal);});renderEngineConfigAndUpdate();
}
function toggleShowWDL(){
  const newVal=!(engineSettingsData&&engineSettingsData.showWDL);
  if(engineSettingsData)engineSettingsData.showWDL=newVal;
  HapticManager.fire(newVal?'TOGGLE_ON':'TOGGLE_OFF');
  _bridgeCall(function(bridge){bridge.setEngineShowWDL(newVal);});renderEngineConfigAndUpdate();
}
function setConfigSkillLevel(v){v=Math.max(0,Math.min(20,parseInt(v)||20));if(engineSettingsData)engineSettingsData.skillLevel=v;_bridgeCall(function(bridge){bridge.setEngineSkillLevel(v);});renderEngineConfigAndUpdate();}
function toggleLimitElo(){
  const newVal=!(engineSettingsData&&engineSettingsData.limitStrength);
  if(engineSettingsData)engineSettingsData.limitStrength=newVal;
  HapticManager.fire(newVal?'TOGGLE_ON':'TOGGLE_OFF');
  _bridgeCall(function(bridge){bridge.setEngineLimitElo(newVal,engineSettingsData?engineSettingsData.elo:2800);});renderEngineConfigAndUpdate();
}
function setConfigElo(v){v=Math.max(500,Math.min(3200,parseInt(v)||2800));if(engineSettingsData)engineSettingsData.elo=v;_bridgeCall(function(bridge){bridge.setEngineLimitElo(engineSettingsData?engineSettingsData.limitStrength:false,v);});renderEngineConfigAndUpdate();}
function toggleAutoConfig(){
  const newVal=!(engineSettingsData&&engineSettingsData.autoConfig);
  if(engineSettingsData)engineSettingsData.autoConfig=newVal;
  HapticManager.fire(newVal?'TOGGLE_ON':'TOGGLE_OFF');
  _bridgeCall(function(bridge){bridge.setAutoConfig(newVal);});renderEngineConfigAndUpdate();
}
function exportEngineSettings(){
  _bridgeCall(function(bridge){
    try{
      const txt=bridge.exportSettings();
      if(!txt){showToast(T('settings_clipboard_fallback'));return}
      // Primary: SAF file picker (ACTION_CREATE_DOCUMENT) — no permissions needed
      if(typeof bridge.openExportFilePicker==='function'){
        bridge.openExportFilePicker(txt);
        safeCopyToClipboard(txt);
        return;
      }
      // Fallback: try bridge-provided path first, then hardcoded path
      let saved=false;
      let savedPath='';
      try{
        const exportDir=bridge.getExportPath();
        if(exportDir){
          savedPath=exportDir+'/Regalia_engine_settings.txt';
          saved=bridge.writeTextFile(savedPath,txt);
        }
      }catch(e){}
      if(!saved){
        try{
          const downloadsPath='/storage/emulated/0/Download/Regalia_engine_settings.txt';
          saved=bridge.writeTextFile(downloadsPath,txt);
          if(saved) savedPath=downloadsPath;
        }catch(e){}
      }
      if(saved&&savedPath){
        showToast(T('settings_exported')+': '+savedPath);
        safeCopyToClipboard(txt);
      }else{
        safeCopyToClipboard(txt,T('settings_clipboard_fallback'));
      }
    }catch(e){showToast(T('settings_clipboard_fallback')+': '+e.message);}
  },null,false);
}
// SAF export result callback — called from Java after user picks a file location
function onSettingsExported(success,fileName){
  if(success){
    showToast(T('settings_exported')+': '+fileName);
  }else{
    showToast(T('settings_clipboard_fallback'));
  }
}
function importEngineSettings(){
  _bridgeCall(function(bridge){
    // Primary: SAF file picker (ACTION_OPEN_DOCUMENT) — no permissions needed
    if(typeof bridge.openSystemFilePicker==='function'){
      bridge.openSystemFilePicker();
      return;
    }
    // Fallback: built-in file browser
    _openSettingsFileBrowser();
  },null,false);
}
// JS callbacks from Java
function onEngineInfo(info){
  try{engineConfigData=JSON.parse(info);
    // v1.0.3 FIX: Only update the config dialog if showEngineConfig is still true.
    // After settings import, onSettingsImported sets showEngineConfig=false and
    // removes the dialog overlay. But onEngineInfo may fire BEFORE onSettingsImported
    // (both are posted via postJsCallback, in order). If onEngineInfo fires first,
    // it calls renderEngineConfigAndUpdate() which updates the dialog content —
    // but this is harmless because onSettingsImported will remove the overlay next.
    // The real issue is if onEngineInfo fires AFTER onSettingsImported (e.g., from
    // a delayed engine restart). In that case, showEngineConfig is already false,
    // so we should NOT re-render the dialog.
    if(showEngineConfig){renderEngineConfigAndUpdate();}
  }catch(e){console.error('onEngineInfo error:',e);}
}
// onEngineSwitched stub — engine switching removed
// Kept as a minimal stub to prevent JS errors if Java callback fires.
function onEngineSwitched(result){
  showToast(T('built_in_only'));
}
function onSettingsImported(result){
  try{
    const r=JSON.parse(result);
    if(r.success){
      const baseMsg=T('settings_imported');
      let suffix='';
      if(r.message){
        const m=r.message.match(/\(([^)]+)\)\s*$/);
        if(m)suffix=' ('+m[1]+')';
      }
      showToast(baseMsg+suffix);
      // v1.0.3: Close the config dialog aggressively and immediately.
      // Set state, remove dialog from DOM directly, then render.
      showEngineConfig=false;
      // Force-remove any open dialog overlay from the DOM
      var dov=document.querySelector('.dov[role="dialog"]');
      if(dov){dov.remove();}
      // Also remove any file-browser overlay that might still be open
      var fb=document.getElementById('_fileBrowserOverlay');
      if(fb){fb.remove();}
      // Refresh cached data
      if(typeof AndroidBridge!=='undefined'){
        try{var info=AndroidBridge.getEngineInfo();if(info)engineConfigData=JSON.parse(info);}catch(e){}
        try{var s=AndroidBridge.getEngineSettings();if(s)engineSettingsData=JSON.parse(s);}catch(e){}
      }
      if(engineSettingsData){
        _cachedMultiPV=engineSettingsData.multiPV||1;
      }
      // Call renderInternal directly to bypass any throttle
      if(typeof renderInternal==='function'){
        renderInternal();
      }else{
        render();
      }
      // v1.0.3: Safety net — force close again after 100ms AND 300ms to handle
      // late-arriving onEngineInfo callbacks that might re-render the dialog.
      setTimeout(function(){
        showEngineConfig=false;
        var dov2=document.querySelector('.dov[role="dialog"]');
        if(dov2){dov2.remove();}
        render();
      },100);
      setTimeout(function(){
        showEngineConfig=false;
        var dov3=document.querySelector('.dov[role="dialog"]');
        if(dov3){dov3.remove();}
      },300);
    }else{
      showToast(T('settings_import_fail')+': '+(r.message||'unknown'));
    }
  }catch(e){showToast(T('settings_import_done'));}
}

// MultiPV progress callback — receives secondary PV lines during search
// Used to display alternative engine suggestions in real-time
let _multiPVLines=[]; // Stores current MultiPV analysis lines
let _multiPVResult=null; // Stores the final MultiPV result from last search
function onMultiPVProgress(pvInfo){
  try{
    const info=typeof pvInfo==='string'?JSON.parse(pvInfo):pvInfo;
    // Update or add the PV line for this index
    const idx=info.index||0;
    let found=false;
    for(let i=0;i<_multiPVLines.length;i++){
      if(_multiPVLines[i].index===idx){_multiPVLines[i]=info;found=true;break;}
    }
    if(!found)_multiPVLines.push(info);
    // v1.0.5 Rev56 PERF: Only sort when a new line was appended (found=false).
    // When an existing line was updated in-place, the array order is already
    // correct (indices don't change). The sort was previously unconditional
    // on every progress tick (10-50×/sec) — for 8 MultiPV lines, the
    // Array.sort comparison runs ~25 comparisons per call, all wasted when
    // the array was already sorted.
    if(!found){
      _multiPVLines.sort(function(a,b){return a.index-b.index;});
    }
    // Update hint display with all PV lines
    _updateMultiPVDisplay();
  }catch(e){console.error('onMultiPVProgress error:',e);}
}

// MultiPV result callback — receives final PV data when bestmove arrives
function onMultiPVResult(result){
  try{
    const data=typeof result==='string'?JSON.parse(result):result;
    _multiPVResult=data;
    // Store the primary PV as the move's variation
    if(data&&data.length>0){
      const primary=data[0];
      if(primary.pv){
        // Store variation for the current/last move
        _lastEngineVariation=primary.pv;
      }
    }
    // Process deferred variations from onBestMove()
    // This is the correct place to process variations because at this point
    // _multiPVResult and _lastEngineVariation contain the CURRENT search data.
    _processDeferredVariations();
    // Update the display with final results
    _updateMultiPVDisplay();
  }catch(e){console.error('onMultiPVResult error:',e);}
}

// Process deferred variations using current PV data from onMultiPVResult().
// This function replaces the inline variation processing that was previously in onBestMove().
function _processDeferredVariations(){
  if(!_pendingBestMoveInfo)return;
  const info=_pendingBestMoveInfo;
  _pendingBestMoveInfo=null; // Clear immediately to prevent re-processing

  // v1.0.2 PERF: clear the PV cache at the start of each variation-processing
  // call. The cache is only valid within a single search's MultiPV result set;
  // keeping it across searches would bloat memory and risk stale-state hits
  // if the engine's hash happened to collide between unrelated positions.
  _pvCache.clear();

  const{uciMove,lastIdx,isAfterWhiteMove,moveNum,preMoveState,ponderMove,ponderEnabled,multiPVEnabled}=info;

  // The move record at lastIdx should exist (it was the last record before the bestmove was executed)
  // But after executeMove(), a new record was added. So the record we want is at lastIdx,
  // which is now the SECOND-TO-LAST record (or the ONLY record if it was the first move).
  // Actually: onBestMove() stores _pendingBestMoveInfo BEFORE executeMove() is called.
  // executeMove() adds a new move to moveRecords. So the record at lastIdx is the
  // PREVIOUS move (the one BEFORE the AI's move). The AI's move is at lastIdx+1.
  // We want to store variations on the AI's move (the new record added by executeMove).
  const aiMoveIdx=lastIdx+1;
  if(aiMoveIdx>=moveRecords.length){
    console.warn('_processDeferredVariations: AI move record not found');
    return;
  }
  const lastRec=moveRecords[aiMoveIdx];
  if(!lastRec)return;

  // Recalculate move metadata for the AI's move record
  const aiIsAfterWhiteMove=(aiMoveIdx%2===0);
  const aiMoveNum=Math.floor(aiMoveIdx/2)+1;

  // After the AI's move, the next move is from the opposite side:
  //   AI played white → continuation starts with black → firstMoveIsWhite=false, varMoveNum=aiMoveNum
  //   AI played black → continuation starts with white → firstMoveIsWhite=true, varMoveNum=aiMoveNum+1
  const contFirstIsWhite=!aiIsAfterWhiteMove;
  const contVarMoveNum=aiIsAfterWhiteMove?aiMoveNum:aiMoveNum+1;

  const variations=[];

  // Get primary PV data
  // v1.0.2 FIX: Fall back to _multiPVResult[0].pv when _lastEngineVariation is
  // empty. Previously, if the bestmove didn't carry a PV (some Stockfish builds
  // omit it when MultiPV is on), the mainline variation was silently dropped.
  const primaryPV=_lastEngineVariation||(_multiPVResult&&_multiPVResult.length>0?_multiPVResult[0].pv:null);

  // --- Mainline prediction: continuation after the played move ---
  // v1.0.2 FIX: The mainline prediction should NOT be displayed immediately.
  // Instead, it should be registered for divergence tracking and only displayed
  // when the actual game moves diverge from the prediction. This matches the
  // user's requirement: "在匹配到正确位置前缓存于后台，不显示"
  let primaryStartedWithBestmove=false;
  if(primaryPV){
    const uciMoves=primaryPV.trim().split(/\s+/);
    if(uciMoves.length>0 && uciMoves[0]===uciMove){
      primaryStartedWithBestmove=true;
      // Strip bestmove, convert remaining to SAN using post-bestmove state
      const afterBestResult=_uciToSAN(uciMove,preMoveState);
      const afterBestState=afterBestResult.postState;
      const afterBestHash=afterBestState.hash||0;
      if(_pvCache.size<_PV_CACHE_MAX){
        _pvCache.set((preMoveState.hash||0)+'|'+uciMove,{san:afterBestResult.san,postState:afterBestState});
      }
      const remainingUci=uciMoves.slice(1);
      if(remainingUci.length>0){
        const sanResult=_convertPVtoSANCached(remainingUci.join(' '),afterBestState,afterBestHash);
        if(sanResult.sanMoves){
          // v1.0.2: DON'T push to variations array. Instead, register for
          // divergence tracking. The variation will be displayed at the
          // divergence point via _checkPVDivergence.
          // We store it as a pending PV with the SAN already computed.
          _pendingEngineSANs.push({
            san:sanResult.sanMoves,
            fromMoveIdx:aiMoveIdx,
            firstMoveIsWhite:contFirstIsWhite,
            varMoveNum:contVarMoveNum,
            matchedUpTo:0
          });
        }
      }
      // Legacy field
      if(!lastRec.variation){
        lastRec.variation=remainingUci.join(' ');
      }
    }
  }
  _lastEngineVariation=null;

  // --- MultiPV secondary variations (and primary if it didn't start with bestmove) ---
  // v1.0.2 FIX: When the primary PV didn't start with bestmove, include it in
  // the iteration as an alternative line (mpvIndex=0). Otherwise iterate from
  // index 1 as before (primary was already handled as mainline above).
  // v1.0.2 PERF: each MultiPV line is converted via _convertPVtoSANCached()
  // which transparently reuses the converted SAN + post-state of any shared
  // prefix with previously-converted lines (including the mainline above).
  // For 8 lines sharing a 5-move prefix, this saves ~35 makeMv+moveAlg calls.
  if(_multiPVResult&&_multiPVResult.length>1){
    const startIdx=primaryStartedWithBestmove?1:0;
    // Pre-compute the preMoveState hash for cache keys
    const preMoveHash=preMoveState.hash||0;
    for(let vi=startIdx;vi<_multiPVResult.length;vi++){
      const mpv=_multiPVResult[vi];
      if(!mpv.pv)continue;
      const uciMoves=mpv.pv.trim().split(/\s+/);
      if(uciMoves.length===0)continue;

      // Secondary PV's first move is an alternative to bestmove (same side)
      // — UNLESS this is the primary that didn't start with bestmove, in which
      // case its first move is also an alternative (also same side).
      // Convert the ENTIRE PV to SAN starting from preMoveState.
      const sanResult=_convertPVtoSANCached(mpv.pv,preMoveState,preMoveHash);
      if(sanResult.sanMoves){
        // v1.0.2: DON'T push MultiPV to display array either. Cache for divergence.
        _pendingEngineSANs.push({
          san:sanResult.sanMoves,
          fromMoveIdx:aiMoveIdx,
          firstMoveIsWhite:aiIsAfterWhiteMove,
          varMoveNum:aiMoveNum,
          matchedUpTo:0
        });
      }
    }
    if(!lastRec.multiPVvariations){
      lastRec.multiPVvariations=_multiPVResult;
    }
  }

  // Ponder is fully decoupled from move records.
  // Ponder variation is NO LONGER created or stored in moveRecords.
  // Ponder functionality (engine background analysis of predicted opponent reply)
  // remains active for AI opponent speed improvement, but is invisible to the user
  // in move history and review. The ponder move is still used internally by
  // onBestMove() to start background analysis after AI moves.

  // Store variations on the move record
  if(variations.length>0){
    lastRec.variations=variations;
  }

  // v1.0.2 NEW FEATURE: Register the engine's primary PV for divergence tracking.
  // The PV will be compared against future actual game moves. If the game
  // diverges from the PV, the divergent portion will be attached as a variation
  // to the divergence-point move record.
  if(primaryPV&&primaryStartedWithBestmove){
    _registerEnginePVForDivergence(primaryPV,aiMoveIdx,preMoveState);
  }

  // v1.0.2 NEW FEATURE: Engine PV divergence detection.
  // After the AI's move is recorded, check if the engine's PV (stored in
  // _lastEnginePVBeforeMove) matches the actual game moves so far. If the
  // game has diverged from the PV, attach the divergent portion of the PV
  // as a variation to the move record AT THE DIVERGENCE POINT.
  // If the game hasn't diverged yet (still following the PV), cache the PV
  // for future comparison — don't display it yet.
  _checkPVDivergence();
  // v1.0.2: Also check SAN-based engine variations (mainline + MultiPV)
  _checkPVDivergenceSANs();

  // Re-render
  requestAnimationFrame(function(){render();});
}

// v1.0.2: Check pending SAN-based engine variations for divergence.
// Compare each pending variation's SAN moves against actual game moves.
// If divergence found, attach the remaining variation to the divergence-point move.
// If all match, remove (redundant). If game hasn't reached variation's start, keep cached.
function _checkPVDivergenceSANs(){
  if(_pendingEngineSANs.length===0)return;
  if(!moveRecords||moveRecords.length===0)return;
  const newPending=[];
  for(const pending of _pendingEngineSANs){
    const sanMoves=pending.san.trim().split(/\s+/).filter(s=>s);
    if(sanMoves.length===0)continue;
    let matchCount=pending.matchedUpTo||0;
    let divergeIdx=-1;
    for(let vi=matchCount;vi<sanMoves.length;vi++){
      const actualIdx=pending.fromMoveIdx+1+vi;
      if(actualIdx>=moveRecords.length){
        // Game hasn't reached this point yet — keep cached
        break;
      }
      const actualMr=moveRecords[actualIdx];
      if(!actualMr||actualMr===null)continue;
      const varSAN=sanMoves[vi].replace(/[+#!?]+$/,'');
      const actualSAN=(actualMr.notation||'').replace(/[+#!?]+$/,'');
      if(varSAN===actualSAN){
        matchCount=vi+1;
      }else{
        divergeIdx=actualIdx;
        break;
      }
    }
    if(divergeIdx>=0&&divergeIdx<moveRecords.length){
      // Divergence found — attach remaining SAN to the divergence-point move
      const remainingSAN=sanMoves.slice(matchCount).join(' ');
      if(remainingSAN.length>0){
        const targetMr=moveRecords[divergeIdx];
        if(targetMr){
          if(!targetMr.variations)targetMr.variations=[];
          // v1.0.2 FIX: Skip if an identical variation (same SAN content) is
          // already attached. Without this guard, the same divergence could
          // be attached multiple times if multiple pending PVs diverged at
          // the same move with the same SAN remainder — causing duplicate
          // 🌿 line entries.
          let alreadyExists=false;
          for(const ex of targetMr.variations){
            if(ex.san===remainingSAN){alreadyExists=true;break;}
          }
          if(!alreadyExists){
            const isWhite=(divergeIdx%2===0);
            const moveNum=Math.floor(divergeIdx/2)+1;
            targetMr.variations.push({
              group:'multipv',
              san:remainingSAN,
              varMoveNum:moveNum,
              firstMoveIsWhite:isWhite,
              lineNum:1,
              prefixEllipsis:false,
              prefixEllipsisNum:0
            });
          }
        }
      }
      // Don't keep in pending (resolved)
    }else if(matchCount>=sanMoves.length){
      // All matched — redundant, remove
    }else{
      // Still matching or game hasn't reached — keep cached
      pending.matchedUpTo=matchCount;
      if(newPending.length<10)newPending.push(pending);
    }
  }
  _pendingEngineSANs=newPending;
}

// v1.0.2 NEW FEATURE: Engine PV divergence tracker.
// _pendingEnginePVs stores PVs from recent engine analyses that haven't yet
// diverged from the actual game. Each entry: {pvUci, fromMoveIdx, preMoveState}
// — the PV in UCI format, the moveRecords index it started from, and the
// game state at that point (for SAN conversion).
// When a new move is played, we check each pending PV: if the new move matches
// the next PV move, the PV is still being followed (advance the pointer); if
// it doesn't match, the PV has diverged — attach the remaining PV moves as a
// variation to the divergence-point move record.
// If no divergence yet, keep cached (don't display).
let _pendingEnginePVs=[];

// v1.0.2: _pendingEngineSANs stores engine variations in SAN format (already
// converted from UCI). These are the mainline + MultiPV predictions that should
// NOT be displayed immediately — they're cached until divergence.
// Each entry: {san, fromMoveIdx, firstMoveIsWhite, varMoveNum, matchedUpTo}
let _pendingEngineSANs=[];

// Called from onBestMove (via _processDeferredVariations) to register a new
// PV for divergence tracking. The PV starts from the position BEFORE the
// bestmove was played, so the first PV move should be the bestmove itself.
function _registerEnginePVForDivergence(pvUci,fromMoveIdx,preMoveState){
  if(!pvUci||!preMoveState)return;
  // Don't track PVs that are too short (just the bestmove — no continuation)
  const moves=pvUci.trim().split(/\s+/).filter(m=>m&&m.length>=4);
  if(moves.length<2)return; // Need at least bestmove + 1 continuation move
  _pendingEnginePVs.push({
    pvUci:moves.join(' '),
    pvMoves:moves,
    fromMoveIdx:fromMoveIdx,
    preMoveState:cloneS(preMoveState),
    matchedUpTo:0 // index into pvMoves that has been matched (0 = bestmove)
  });
}

// Called after each move (player or AI) to check if any pending PV has
// diverged. If so, attach the divergent portion as a variation to the
// divergence-point move record.
function _checkPVDivergence(){
  if(_pendingEnginePVs.length===0)return;
  if(!moveRecords||moveRecords.length===0)return;

  const newPending=[];
  for(const pending of _pendingEnginePVs){
    // The PV started at fromMoveIdx. The bestmove (pvMoves[0]) was played as
    // moveRecords[fromMoveIdx]. Now check subsequent moves.
    // pending.matchedUpTo = how many PV moves have been matched so far.
    // Next expected: pvMoves[matchedUpTo+1] should be moveRecords[fromMoveIdx + matchedUpTo + 1]... wait, that's not quite right.
    // Actually: pvMoves[0] = bestmove = moveRecords[fromMoveIdx].
    // pvMoves[1] = opponent's predicted reply = should match moveRecords[fromMoveIdx+1] if played.
    // pvMoves[2] = our predicted next move = should match moveRecords[fromMoveIdx+2] if played.
    // So pvMoves[k] should match moveRecords[fromMoveIdx + k].
    // We check from pending.matchedUpTo+1 onwards (the first unmatched PV move).

    let stillMatching=true;
    let divergeAtIdx=-1; // moveRecords index where divergence happened
    let divergePVRemainder=[]; // remaining PV moves from divergence point

    for(let k=pending.matchedUpTo+1;k<pending.pvMoves.length;k++){
      const mrIdx=pending.fromMoveIdx+k;
      if(mrIdx>=moveRecords.length){
        // Not enough moves played yet — PV still potentially being followed
        stillMatching=true;
        break;
      }
      const mr=moveRecords[mrIdx];
      if(mr===null){
        // Placeholder — skip (treat as match for black-to-move scenarios)
        continue;
      }
      // Convert mr.from/mr.to to UCI for comparison
      const mrUci=_mrToUci(mr);
      const pvMove=pending.pvMoves[k];
      if(mrUci===pvMove){
        // Still matching — advance
        pending.matchedUpTo=k;
        continue;
      }else{
        // Divergence! The actual move (mrUci) differs from PV move (pvMove).
        // The divergence point is at moveRecords[mrIdx].
        // The PV remainder starts from pvMoves[k] (the predicted move that
        // wasn't played).
        stillMatching=false;
        divergeAtIdx=mrIdx;
        divergePVRemainder=pending.pvMoves.slice(k);
        break;
      }
    }

    if(!stillMatching&&divergeAtIdx>=0&&divergePVRemainder.length>0){
      // Divergence detected — attach the PV remainder as a variation to the
      // divergence-point move record.
      _attachDivergentPV(divergeAtIdx,divergePVRemainder,pending);
      // Don't keep this PV in pending — it's been resolved.
    }else if(stillMatching){
      // PV is still being followed or not enough moves yet — keep tracking.
      // But cap the number of pending PVs to avoid unbounded growth.
      if(newPending.length<5)newPending.push(pending);
    }
  }
  _pendingEnginePVs=newPending;
}

// Convert a move record's from/to to UCI format (e.g., "e2e4", "e7e8q").
// v1.0.2 FIX: Map promotion piece-type names to UCI letters explicitly.
// Previously this used mr.promotion[0] which produced 'k' for knight (correct
// UCI is 'n'), causing false divergence detection for any knight-promotion
// move — the comparison `mrUci === pvMove` would always fail because the
// engine PV uses 'n' for knight promotions. This silently attached spurious
// alternative-line variations to the divergence-point move record.
function _mrToUci(mr){
  if(!mr||!mr.from||!mr.to)return '';
  const promoMap={queen:'q',rook:'r',bishop:'b',knight:'n'};
  return mr.from+mr.to+(mr.promotion?(promoMap[mr.promotion]||''):'');
}

// Attach a divergent PV as a variation to the move record at divergeAtIdx.
// divergePVRemainder is an array of UCI moves starting from the predicted
// move that wasn't played.
function _attachDivergentPV(divergeAtIdx,pvRemainder,pending){
  if(divergeAtIdx<0||divergeAtIdx>=moveRecords.length)return;
  const mr=moveRecords[divergeAtIdx];
  if(!mr)return;

  // The PV remainder starts from the predicted move that diverged.
  // We need to convert it to SAN. The starting state is the game state
  // BEFORE the move at divergeAtIdx was played.
  // pending.preMoveState is the state before pvMoves[0] (the bestmove).
  // We need to replay pvMoves[0..k-1] to get the state before pvMoves[k].
  let state=cloneS(pending.preMoveState);
  for(let i=0;i<pending.matchedUpTo+1&&i<pending.pvMoves.length;i++){
    // Replay matched PV moves to advance the state
    const uci=pending.pvMoves[i];
    const coords=uciToCoords(uci);
    if(!coords)break;
    const piece=state.board[coords.from.row][coords.from.col];
    if(!piece)break;
    const mv={from:coords.from,to:coords.to,piece,promotion:coords.promotion};
    makeMvInPlace(state,mv);
  }
  // Now state is the position before the divergent PV move.
  // The divergent PV starts with the PREDICTED move (alternative to the
  // actual move). Convert the entire remainder to SAN from this state.
  const sanResult=_convertPVtoSANCached(pvRemainder.join(' '),state,state.hash||0);
  if(!sanResult.sanMoves)return;

  // Determine the move number and side at the divergence point.
  // divergeAtIdx is the moveRecords index. The move at this index was the
  // ACTUAL move. The PV remainder's first move is an ALTERNATIVE to it
  // (same side, same move number).
  const isWhite=(divergeAtIdx%2===0);
  const moveNum=Math.floor(divergeAtIdx/2)+1;

  // Build the variation entry — same format as PGN variations.
  const varEntry={
    group:'multipv', // treat engine PV as MultiPV-style alternative line
    san:sanResult.sanMoves,
    varMoveNum:moveNum,
    firstMoveIsWhite:isWhite,
    mpvIndex:0, // primary alternative
    lineNum:1
  };

  // Attach to the move record. If the record already has variations, append.
  if(!mr.variations)mr.variations=[];
  // Avoid duplicates — check if an identical engine variation already exists.
  let exists=false;
  for(const v of mr.variations){
    if(v.group==='multipv'&&v.san===varEntry.san){exists=true;break;}
  }
  if(!exists){
    mr.variations.push(varEntry);
  }
}

// Update display with MultiPV lines
// v1.0.5 Rev56 PERF: Added a per-line signature cache so we skip the expensive
// _convertPVtoSAN() call when a PV line's content hasn't changed since the last
// display update. Previously, _updateMultiPVDisplay was called on every
// onMultiPVProgress AND on every onEngineProgress (when _cachedMultiPV>1),
// re-converting ALL PV lines from UCI to SAN on every tick (10-50×/sec). Each
// conversion clones the game state and runs makeMv/moveAlg for every move in
// the PV — with 8 MultiPV lines of 10+ moves each, that's 80+ makeMv calls
// per tick, completely wasted when the PV content is identical to last tick.
// The signature is `(pv, scoreCp, scoreMate, index)` — if all four match the
// cached values, the line's display text is reused verbatim.
let _multiPVDisplayCache = {}; // {index: {sig, text}}
function _updateMultiPVDisplay(){
  if(_multiPVLines.length<1)return; // Show even single line when MultiPV enabled
  // v1.0.5 Round-6 Rev62 (2026.6.27) PERF: early-exit when !isHintLoading.
  // MultiPV display is only shown in the hint bar (`_hintBarInfo`), which is
  // hidden during AI thinking. Previously, every progress tick (10-50/sec)
  // during AI thinking would compute hintParts for all PV lines, build
  // signatures, and check the cache — all wasted work since `isHintLoading`
  // is false and the result is discarded at line 3044. Skip the entire
  // computation when the hint bar isn't active.
  if(typeof isHintLoading!=='undefined'&&!isHintLoading)return;
  // Build hint text with all PV lines
  let hintParts=[];
  let cacheDirty=false;
  for(const pv of _multiPVLines){
    // v1.0.5 Rev56: skip lines with no PV content — they contribute nothing
    // to the display except an empty score string, and would trigger a
    // wasteful _convertPVtoSAN('') call.
    const hasPV = pv.pv && pv.pv.length>0;
    // Build a cheap signature to detect whether this line actually changed
    const sig = (pv.index||0)+'|'+(pv.scoreCp!=null?pv.scoreCp:'')+'|'+(pv.scoreMate!=null?pv.scoreMate:'')+'|'+(hasPV?pv.pv:'');
    const cached = _multiPVDisplayCache[pv.index];
    if(cached && cached.sig === sig){
      // Cache hit — reuse the previously computed display text
      hintParts.push(cached.text);
      continue;
    }
    cacheDirty = true;
    // Cache miss — compute the display text for this line
    let scoreStr='';
    if(pv.scoreMate!=null){
      const m=parseInt(pv.scoreMate);
      scoreStr=m>0?'#+'+Math.abs(m):m<0?'#-'+Math.abs(m):'#0';
    }else if(pv.scoreCp!=null){
      const pd=(pv.scoreCp/100).toFixed(1);
      scoreStr=(pv.scoreCp>0?'+':'')+pd;
    }
    // Convert PV UCI moves to SAN format (only when PV is non-empty)
    let pvPreview='';
    if(hasPV){
      try{
        const _conv=_convertPVtoSAN(pv.pv,gameState);
        pvPreview=_conv.sanMoves.split(/\s+/).slice(0,4).join(' ');
      }catch(e){
        pvPreview=pv.pv.split(/\s+/).slice(0,4).join(' ');
      }
    }
    const text=(pv.index===1?'⭐':'📌')+' '+scoreStr+(pvPreview?' '+pvPreview:'');
    hintParts.push(text);
    _multiPVDisplayCache[pv.index]={sig:sig,text:text};
  }
  // v1.0.5 Rev56: if no line changed, skip the DOM write entirely.
  // _hintBarInfo / _aiBarInfo assignment + _updateAIThinkDisplay() would
  // rebuild innerHTML even though the content is byte-identical.
  if(!cacheDirty){
    // All lines identical to last update — nothing to do.
    return;
  }
  if(isHintLoading)_hintBarInfo=hintParts.join(' | ');
  _updateAIThinkDisplay();
}

// v1.0.5 Rev56: Clear the MultiPV display cache when a new search starts
// (called from onBestMove where _multiPVLines=[] is already reset).
// Without this, the cache would retain stale signatures from the previous
// search, causing the first progress tick of the new search to be skipped
// (false cache hit).
function _clearMultiPVDisplayCache(){
  _multiPVDisplayCache = {};
}

// Store the last engine variation (PV) for move records
let _lastEngineVariation=null;
// Store the ponder move from engine's bestmove output
let _lastPonderMoveFromEngine=null;
// Ponder move in SAN notation for display (opponent's predicted reply)
let _ponderMoveSAN='';
// Ponder session generation counter
// Incremented whenever ponder state is invalidated (cleared) or a new ponder starts.
// Root cause of stale ponder bug: after clearing ponder state and starting a new ponder,
// _pendingPonderMoveUCI is set, which allows old onPonderProgress() callbacks to pass
// the staleness guard. The old callback then sets _ponderMoveSAN from the NEW
// _pendingPonderMoveUCI (correct) but sets _ponderBarInfo with OLD depth/nodes data,
// creating a mix of new and stale data. Fix: track a generation counter.
let _ponderGen=0;       // Incremented on every ponder state change
let _ponderStartGen=-1; // The _ponderGen value when the current ponder session started
// Deferred variation processing — onBestMove() saves state here,
// onMultiPVResult() processes variations with the CURRENT PV data.
// ROOT CAUSE: onBestMove() is called BEFORE onMultiPVResult(), so
// _lastEngineVariation and _multiPVResult contain STALE data from the
// previous search. This caused UCI leaks and wrong move numbering.
let _pendingBestMoveInfo=null;

// Update AI thinking display (AI bar and hint area are INDEPENDENT)

// Receive UCI_Elo sync from Java when AI level changes.
// Updates engineSettingsData so the config panel always matches reality.
// Render after difficulty change
function onGameDifficultyChanged(limitStrength,elo){
  if(!engineSettingsData)return;
  engineSettingsData.limitStrength=!!limitStrength;
  if(elo>0)engineSettingsData.elo=parseInt(elo)||2800;
  // If config panel is open, refresh its display
  if(document.querySelector('.dov[role="dialog"]'))renderEngineConfigAndUpdate();
  // Re-render toolbar to reflect updated difficulty level immediately
  render();
}

function onEngineError(msg){
  console.error('Engine error:',msg);
  // CRITICAL FIX: Mark engine as NOT ready — prevents JS from continuously
  // calling AndroidBridge methods on a dead engine process, which would
  // trigger infinite "Engine not ready" error loops from the Java side.
  _engineReady=false;
  // v1.0.1: Reflect the error state in the persistent notification bar.
  // Truncate very long messages so the notification stays on one line.
  // The full message is still shown in the in-app toast below.
  try{
    const _errShort=(msg&&typeof msg==='string')?msg.slice(0,80):String(msg);
    _updateEngineNotification(T('engine_error')+': '+_errShort);
  }catch(e){}
  // Reset animation flags to prevent permanent UI freeze.
  // If an engine error occurs DURING an animation, render() and sqClick()
  // would block forever since animationInProgress/_landingAnimActive are
  // only cleared by successful animation completion.
  animationInProgress=false;
  _landingAnimActive=false;
  if(_landingAnimTimer){clearTimeout(_landingAnimTimer);_landingAnimTimer=null;}
  // Cancel safety timeout — engine responded (with error)
  if(_aiSafetyTimerId){clearTimeout(_aiSafetyTimerId);_aiSafetyTimerId=null;}
  isAIThinking=false;_aiBarInfo='';_aiRetryCount=0;
  isHintLoading=false;_hintBarInfo='';
  // FIX: Clear stale ponder state on engine error — prevents 🔮 ponder info
  // from persisting indefinitely after engine crash (the display guard in
  // _updateAIThinkDisplay checks !isAIThinking && !isHintLoading which are
  // both true after error cleanup, so stale ponder data would still render)
  _ponderGen++;_ponderMoveSAN='';_ponderBarInfo='';_pendingPonderMoveUCI=null;
  // FIX: Reset eval loading state so UI doesn't permanently show "分析中"
  _evalLoading=false;_sfEvalReady=false;
  _hideLoadingOverlay();
  if(showEngineConfig){renderEngineConfigAndUpdate();}
  // Clear loading fallback timers since engine responded (with error)
  if(_loadingFallbackTimerId){clearTimeout(_loadingFallbackTimerId);_loadingFallbackTimerId=null;}
  if(_emergencyFallbackTimerId){clearTimeout(_emergencyFallbackTimerId);_emergencyFallbackTimerId=null;}
  // FIX: Cancel in-flight review analyze-all to prevent hang
  // v1.0.4 Rev24: Do NOT clear _reviewAnalyzeAllActive here. If the engine
  // auto-recovers (Java recoverEngine → onEngineReady), the batch will resume.
  // The per-step safety timer (60s) covers the case where recovery fails.
  // The previous code set _reviewAnalyzeAllActive=false, silently dropping
  // the batch on any transient engine error.
  if(_reviewAnalyzeAllActive){
    // Reset the safety timer to give the engine time to recover
    if(typeof _reviewAnalyzeResetSafetyTimer==='function')_reviewAnalyzeResetSafetyTimer();
  }
  // P1 FIX: Auto-restart engine (max 2 retries) for mobile resilience
  // NOTE: Java-side recoverEngine() handles most restart cases with _restartLock.
  // This JS-side restart is a secondary safety net only. Don't over-retry here
  // because it conflicts with Java-side recovery and causes "Java exception" errors.
  if(!window._engineRestartCount)window._engineRestartCount=0;
  window._engineRestartCount++;
  if(window._engineRestartCount<=2){
    showToast(T('engine_error_restart')+' ('+window._engineRestartCount+'/2)...');
    // v1.0.7 PHASE 19 (bug fix): Track this timer so onEngineReady can cancel it.
    // Without this, if the engine auto-recovers (Java recoverEngine → onEngineReady)
    // before this 1500ms timer fires, the timer would call restartEngine() on an
    // already-recovered engine, causing a spurious restart and burning a retry budget.
    if(window._engineErrorRestartTimer){clearTimeout(window._engineErrorRestartTimer);}
    window._engineErrorRestartTimer=setTimeout(()=>{
      window._engineErrorRestartTimer=null;
      if(typeof AndroidBridge!=='undefined'&&typeof AndroidBridge.restartEngine==='function'){
        try{AndroidBridge.restartEngine();}catch(e){
          console.error('JS restart failed (executor likely shutdown):',e);
          // Don't retry further — Java-side recovery will handle it
          window._engineRestartCount=3; // Prevent further JS restart attempts
        }
      }
    },1500);
  }else{
    showToast(T('engine_error')+': '+msg);
    window._engineRestartCount=0;
  }
  _updateAllEvalDisplays();
  render();
}

// Request engine evaluation of current position
// In review mode: uses cache to avoid redundant engine calls, and debounces
// rapid navigation (only the latest step actually gets evaluated).
function requestEngineEval(){
  if(!_engineReady||setupMode)return;
  // CRITICAL FIX: In normal (non-review) mode, skip eval when AI is about to move.
  if(!reviewMode&&!gameOver&&gameState.currentTurn!==playerColor)return;
  // v1.0.4 ROUND-5 REV12: Check cache BEFORE _resetEvalState() to avoid
  // a brief "analyzing..." flash when returning from stats page to review.
  // The previous code called _resetEvalState() first (clearing the eval display),
  // THEN checked the cache. If the cache hit, the display was restored — but
  // the user saw a 1-frame "analyzing..." flicker. Now: check cache first,
  // only _resetEvalState() if we actually need to request a new eval.
  if(reviewMode&&reviewStates&&reviewStates.length>0&&reviewStep>=0&&reviewStep<reviewStates.length){
    const cachedEarly=_reviewEvalCache.get(reviewStep);
    if(cachedEarly!=null){
      _sfEval=cachedEarly.eval;_sfMateDistance=cachedEarly.mate!=null?cachedEarly.mate:0;_sfWdlW=cachedEarly.wdlW!=null?cachedEarly.wdlW:-1;_sfWdlD=cachedEarly.wdlD!=null?cachedEarly.wdlD:-1;_sfWdlL=cachedEarly.wdlL!=null?cachedEarly.wdlL:-1;_sfDepth=cachedEarly.depth!=null?cachedEarly.depth:0;_sfSeldepth=cachedEarly.seldepth!=null?cachedEarly.seldepth:0;_sfEvalReady=true;_evalLoading=false;
      _reviewEvalRequestedStep=reviewStep; // Mark as already evaluated
      // v1.0.7 PHASE 19 (critical bug fix): Clear any pending debounce timer and
      // invalidate in-flight callbacks. Without this, a stale debounce timer
      // capturing a PRIOR step's FEN could fire after this cache-hit return,
      // pass the staleness filter (reviewStep matches), and overwrite this
      // step's correct cached eval with the prior step's engine result —
      // permanently corrupting the cache.
      if(_reviewEvalDebounceTimer){clearTimeout(_reviewEvalDebounceTimer);_reviewEvalDebounceTimer=null;}
      _evalRequestReviewMode=true; // mark mode for cross-mode rejection
      _evalStaleGen++; _evalRequestGen=_evalStaleGen; // invalidate any in-flight callback
      _updateAllEvalDisplays();
      // v1.0.4 Rev24 FIX: If we're in batch analyze-all mode and hit cache,
      // we MUST advance to the next step. Previously this early-return stalled
      // the batch silently (the user's "interrupted at a certain point" bug
      // when re-running Analyze All on an already-cached game).
      if(typeof _reviewAnalyzeAllActive!=='undefined'&&_reviewAnalyzeAllActive&&typeof _reviewAnalyzeAdvance==='function'){
        _reviewAnalyzeAdvance();
      }
      return;
    }
  }
  // P0 FIX: Reset eval state BEFORE capturing _evalRequestGen.
  _resetEvalState();
  // FIX: Stop any ongoing ponder before starting an eval search.
  // If the engine is pondering and we request an eval, the "stop" command
  // will stop the ponder search and the resulting bestmove may interfere
  // with the eval search. Stopping ponder explicitly first prevents this.
  try{
    if(typeof AndroidBridge!=='undefined'&&typeof AndroidBridge.isPondering==='function'&&AndroidBridge.isPondering()){
      if(typeof AndroidBridge.stopPonder==='function')AndroidBridge.stopPonder();
    }
  }catch(e){}
  _ponderGen++;_ponderMoveSAN='';_ponderBarInfo='';_pendingPonderMoveUCI=null;
  _updateAIThinkDisplay(); // Immediately clear stale ponder from DOM
  _evalRequestGen=_evalStaleGen; // Fresh eval request — accept onEngineEval callbacks with this gen
  _evalRequestReviewMode=!!reviewMode; // v1.0.7 PHASE 19: capture mode for cross-mode rejection
  if(reviewMode&&reviewStates&&reviewStates.length>0&&reviewStep>=0&&reviewStep<reviewStates.length){
    // v1.0.4 Rev23: The cache was already checked above (before _resetEvalState).
    // If we reach here, the cache missed — no need to re-check.
    // BUG FIX: Check for checkmate/stalemate BEFORE calling the engine.
    // When Stockfish evaluates a position with no legal moves (checkmate/stalemate),
    // it outputs "bestmove (none)" WITHOUT any preceding info line containing a score.
    // The Java-side fallback in handleBestMove(STATE_EVAL) would then dispatch
    // onEngineEval(0, null, depth) — reporting 0cp — which is INCORRECT for checkmate
    // (should be ±99999 mate 0). By detecting terminal positions here, we set the
    // correct evaluation directly and avoid the engine call entirely.
    const _rs=reviewStates[reviewStep].state;
    const _termStatus=gameStatus(_rs);
    // v1.0.7 PHASE 19 (critical bug fix): Helper to invalidate in-flight callbacks
    // on terminal fast paths. Same rationale as the cache-hit path above: a stale
    // debounce timer or in-flight engine callback must not overwrite the terminal
    // eval (±99999 / 0) with the engine's 0cp fallback.
    const _invalidateInFlight=function(){
      if(_reviewEvalDebounceTimer){clearTimeout(_reviewEvalDebounceTimer);_reviewEvalDebounceTimer=null;}
      _evalRequestReviewMode=true;
      _evalStaleGen++; _evalRequestGen=_evalStaleGen;
    };
    if(_termStatus==='checkmate'){
      const _isBlackTurn=_rs.currentTurn==='black';
      _sfEval=_isBlackTurn?99999:-99999;
      _sfMateDistance=0;_sfDepth=0;_sfSeldepth=0;
      _sfEvalReady=true;_evalLoading=false;
      _invalidateInFlight();
      _reviewEvalCache.set(reviewStep,{eval:_sfEval,mate:0,depth:0,seldepth:0,wdlW:_isBlackTurn?0:1000,wdlD:0,wdlL:_isBlackTurn?1000:0});
      _updateAllEvalDisplays();
      if(_reviewAnalyzeAllActive){_reviewAnalyzeAdvance();}
      return;
    }
    if(_termStatus==='draw_stalemate'||_termStatus==='draw_insufficient'||_termStatus==='draw_5fold'||_termStatus==='draw_75move'||_termStatus==='draw_50move'||_termStatus==='draw_repetition'){
      _sfEval=0;_sfMateDistance=0;_sfDepth=0;_sfSeldepth=0;
      _sfEvalReady=true;_evalLoading=false;
      _invalidateInFlight();
      _reviewEvalCache.set(reviewStep,{eval:0,mate:0,depth:0,seldepth:0,wdlW:333,wdlD:334,wdlL:333});
      _updateAllEvalDisplays();
      if(_reviewAnalyzeAllActive){_reviewAnalyzeAdvance();}
      return;
    }
    // Invalidate any stale in-flight callbacks
    // v1.0.6: Sanitize the FEN before sending to the engine to strip
    // inconsistent castling rights (e.g. `q` with no black rook on a8)
    // that can cause the engine to hang or emit no bestmove.
    const fen=_sanitizeFenForEngine(generateFEN(_rs));
    _evalForBlackTurn=_rs.currentTurn==='black';
    _reviewEvalRequestedStep=reviewStep;
    if(typeof AndroidBridge!=='undefined'&&AndroidBridge.isEngineReady()){
      // Debounce: rapid navigation only evaluates the final position (300ms)
      // During batch analyze-all, skip debounce for maximum throughput
      if(_reviewAnalyzeAllActive){
        // No debounce — immediately request eval for batch analysis
        if(_reviewEvalDebounceTimer)clearTimeout(_reviewEvalDebounceTimer);
        _reviewEvalDebounceTimer=null;
        _evalLoading=true;
        _updateAllEvalDisplays();
        try{
          if(typeof AndroidBridge.engineEvalDeep==='function'){AndroidBridge.engineEvalDeep(fen);}
          else{AndroidBridge.engineEval(fen);}
        }catch(e){
          console.error('engineEvalDeep error:',e);
          _evalLoading=false;
          _updateEvalDisplay();
          // v1.0.4 Rev24: On synchronous engine call failure during batch,
          // advance to the next step instead of stalling. The safety timer
          // covers async failures (engine never responds).
          if(typeof _reviewAnalyzeAdvance==='function'){
            setTimeout(function(){try{_reviewAnalyzeAdvance();}catch(_e){}},100);
          }
        }
      }else{
        if(_reviewEvalDebounceTimer)clearTimeout(_reviewEvalDebounceTimer);
        _reviewEvalDebounceTimer=setTimeout(function(){
          _reviewEvalDebounceTimer=null;
          if(!reviewMode||reviewStep!==_reviewEvalRequestedStep)return; // stale
          _evalLoading=true;
          _updateAllEvalDisplays();
          // Review mode uses deeper analysis (depth 22) for more accurate positional evaluation
          try{
            if(typeof AndroidBridge.engineEvalDeep==='function'){AndroidBridge.engineEvalDeep(fen);}
            else{AndroidBridge.engineEval(fen);}
          }catch(e){console.error('engineEvalDeep error:',e);_evalLoading=false;_updateEvalDisplay();}
          // v1.0.7 PHASE 18 Task 3 (bug fix): Add safety timer for single-step
          // review eval. Previously, only normal game mode had a safety timer
          // (30s). Review mode (depth 22) had NO safety net — if the engine
          // hung, the eval bar stayed stuck at "analyzing..." forever and the
          // user had no way to recover short of exiting and re-entering review
          // mode. The batch analyze-all path has its own per-step timer
          // (_reviewAnalyzeSafetyTimer, 60s), but single-step review eval was
          // uncovered. 45s gives deep evals (20-25s on complex positions) a
          // 20s margin while still unsticking the user in reasonable time.
          // The timer is cleared by onEngineEval (line ~2358) on success.
          if(_evalSafetyTimerId)clearTimeout(_evalSafetyTimerId);
          _evalSafetyTimerId=setTimeout(function(){
            _evalSafetyTimerId=null;
            if(_evalLoading){
              console.warn('Review eval safety timer: engine did not respond within 45s, resetting');
              _evalLoading=false;_sfEvalReady=false;
              _updateAllEvalDisplays();
            }
          },45000);
        },300);
      }
    }
  }else{
    // v1.0.6: Sanitize the FEN before sending to the engine.
    const fen=_sanitizeFenForEngine(generateFEN(gameState));
    _evalForBlackTurn=gameState.currentTurn==='black';
    if(typeof AndroidBridge!=='undefined'&&AndroidBridge.isEngineReady()){
      _evalLoading=true;
      _updateEvalDisplay();
      try{AndroidBridge.engineEval(fen);}catch(e){console.error('engineEval error:',e);_evalLoading=false;_updateEvalDisplay();}
      // v1.0.4 Rev44: Eval safety timer — if the engine doesn't respond within
      // 30s (e.g. stopAndWaitForBestmove blocked, executor rejected, or engine
      // crash), reset _evalLoading so the eval bar doesn't stay stuck at
      // "分析中" forever. The timer is cleared by onEngineEval (which sets
      // _evalLoading=false). This is the JS-side counterpart to the Java-side
      // _safeExecute rejection handler.
      // v1.0.4 Rev45: Extended from 10s to 15s to match the AI safety timer.
      // v1.0.4 Rev46: Extended from 15s to 30s to match the AI safety timer
      // extension (360s for AI moves). Deep eval searches (depth 22) on
      // complex positions can take 20-25s.
      if(_evalSafetyTimerId)clearTimeout(_evalSafetyTimerId);
      _evalSafetyTimerId=setTimeout(function(){
        _evalSafetyTimerId=null;
        if(_evalLoading){
          console.warn('Eval safety timer: engine did not respond within 30s, resetting');
          _evalLoading=false;_sfEvalReady=false;
          _updateEvalDisplay();
        }
      },30000);
    }
  }
}

// Update eval display with Stockfish score
// During search (_evalLoading): shows depth/nodes/speed progress
// After search (_sfEvalReady): shows final eval with depth and WDL
let _lastProgressNodes=null;
let _lastProgressNps=null;
// P4: Build eval display innerHTML string — shared by main and review eval displays.
// Avoids duplicating WDL/progress/depth formatting logic in two places.
function _buildEvalHTML(e,opts){
  opts=opts||{};
  let s='<span class="ev-e">'+e.emoji+'</span><span>'+e.desc+'</span><span style="color:var(--muted)">('+e.score+')</span>';
  if(opts.sf18){s+='<span style="font-size:.55rem;color:var(--accent);margin-left:4px;border:1px solid rgba(212,160,23,.3);padding:1px 4px;border-radius:3px;background:rgba(212,160,23,.08)">SF18</span>';}
  const depthStr=_sfDepth>0?'<span style="font-size:.65rem;color:var(--muted);margin-left:4px">D'+_sfDepth+'</span>':'';
  s+=depthStr;
  let progressStr='';
  if(_evalLoading&&_sfDepth>0){
    let parts=[];
    if(_lastProgressNodes!=null){const ns=_lastProgressNodes>=1000000?(_lastProgressNodes/1000000).toFixed(1)+'M':_lastProgressNodes>=1000?Math.round(_lastProgressNodes/1000)+'K':String(_lastProgressNodes);parts.push(ns);}
    if(_lastProgressNps!=null){const ns=_lastProgressNps>=1000000?(_lastProgressNps/1000000).toFixed(1)+'M/s':_lastProgressNps>=1000?Math.round(_lastProgressNps/1000)+'K/s':String(_lastProgressNps);parts.push(ns);}
    if(parts.length)progressStr='<span style="font-size:.6rem;color:var(--muted);margin-left:3px">'+parts.join(' ')+'</span>';
  }
  s+=progressStr;
  let wdlStr='';
  if(_sfWdlW>=0&&_sfWdlD>=0&&_sfWdlL>=0){const total=_sfWdlW+_sfWdlD+_sfWdlL;const wP=Math.round(_sfWdlW/total*100);const dP=Math.round(_sfWdlD/total*100);const lP=Math.round(_sfWdlL/total*100);wdlStr='<span style="font-size:.65rem;color:var(--muted);margin-left:4px">('+wP+'%W/'+dP+'%D/'+lP+'%L)</span>';}
  s+=wdlStr;
  if(opts.delta)s+=opts.delta;
  return s;
}
function _updateEvalDisplay(){
  const el=document.getElementById('eval-disp');
  if(!el)return;
  // Make eval bar clickable to open engine config (when not in setup/gameOver)
  if(!setupMode&&!gameOver&&!reviewMode){
    el.style.cursor='pointer';
    el.title=T('click_engine_config');
    el.onclick=function(){openEngineConfig();};
  }else{
    el.style.cursor='default';
    el.onclick=null;
  }
  // When AI is thinking: eval bar shows "即将分析" — engine search info
  // (depth/nodes/speed) is displayed ONLY in the AI bar, not the eval bar
  if(isAIThinking){
    el.innerHTML='<span class="ev-e">⏳</span><span>'+T('analyzing')+'</span>';
    return;
  }
  const e=formatEval();
  // P4 SIMPLIFY: Use shared helper for consistent eval display formatting
  el.innerHTML=_buildEvalHTML(e,{sf18:true});
}

// Update review mode eval display (lightweight DOM update, no full render)
// Uses formatEval() for consistent emoji/desc/score display, plus eval delta
function _updateReviewEvalUI(){
  if(!reviewMode)return;
  const el=document.getElementById('review-eval-bar');
  if(!el)return;
  const e=formatEval();
  // Compute eval delta from previous step
  // Cap delta when mate scores are involved to avoid displaying huge numbers like +999.9
  let deltaStr='';
  if(_sfEvalReady&&!_evalLoading&&reviewStep>0){
    const prevEval=_reviewEvalCache.get(reviewStep-1);
    if(prevEval!=null) deltaStr=' '+_formatEvalDelta(_sfEval,prevEval.eval);
  }
  // P4 SIMPLIFY: Use shared helper for consistent eval display formatting
  el.innerHTML=_buildEvalHTML(e,{delta:deltaStr});
}
// Format eval delta between two eval values (centipawns, White's perspective).
// Consolidates mate-transition handling and threshold logic in one place.
function _formatEvalDelta(curEval,prevEval,fontSize){
  if(curEval==null||prevEval==null)return '';
  const _isM=Math.abs(curEval)>=90000,_wasM=Math.abs(prevEval)>=90000;
  const fs=fontSize?'font-size:'+fontSize+';':'';
  if(_isM||_wasM){
    if(_isM&&!_wasM)return '<span style="color:#27ae60;'+fs+'">'+T('checkmate_arrow')+'</span>';
    if(!_isM&&_wasM)return '<span style="color:#c0392b;'+fs+'">'+T('escape_mate')+'</span>';
    return '';
  }
  const d=curEval-prevEval,dp=(d/100).toFixed(1);
  if(d>2)return '<span style="color:#27ae60;'+fs+'">+'+dp+'</span>';
  if(d<-2)return '<span style="color:#c0392b;'+fs+'">'+dp+'</span>';
  return '';
}
function _resetEvalState(){_sfMateDistance=0;_sfWdlW=-1;_sfWdlD=-1;_sfWdlL=-1;_sfDepth=0;_sfSeldepth=0;_sfEvalReady=false;_evalLoading=true;_evalStaleGen++;_lastProgressNodes=null;_lastProgressNps=null;_ponderGen++;_ponderBarInfo='';_ponderMoveSAN='';_pendingPonderMoveUCI=null;_updateAIThinkDisplay();}
function _updateAllEvalDisplays(){_updateEvalDisplay();_updateReviewEvalUI();}

// Update AI thinking display (AI bar and hint area are INDEPENDENT)
// AI bar: shows search info when AI is thinking, shows 🔮 ponder info when pondering
// Hint area: only shows search info when hint is loading
let _aiBarInfo='';
let _hintBarInfo='';
let _ponderBarInfo='';
let _pendingPonderMoveUCI=null; // Stored UCI ponder move awaiting first onPonderProgress for deferred SAN conversion
function _updateAIThinkDisplay(){
  // v1.0.4 Rev36: Engine search info now goes in #ai-search-info (line 2,
  // right-aligned) instead of inline in .tind on line 1. The .tind on line 1
  // now only shows the compact "思考中..." / "Thinking..." status.
  if(isAIThinking){
    _aiBarInfo=aiThinkInfo;
    // Update line 2: engine search real-time info (depth/seldepth/nodes/nps).
    // v1.0.4 Rev36: Don't show the "thinking" placeholder on line 2 — line 1's
    // .tind already shows it. Only show actual search data (contains ":" which
    // the placeholder doesn't). This avoids redundant duplicate display.
    const searchEl=document.getElementById('ai-search-info');
    if(searchEl){
      const isPlaceholder=(_aiBarInfo===T('thinking')||_aiBarInfo===T('analyzing')||_aiBarInfo===T('analyzing_ellipsis'));
      searchEl.textContent=isPlaceholder?'':(_aiBarInfo||'');
    }
  }else{
    // Clear search info when not thinking
    const searchEl=document.getElementById('ai-search-info');
    if(searchEl)searchEl.textContent='';
  }
  if(isHintLoading){
    _hintBarInfo=aiThinkInfo;
    const el=document.getElementById('hint-search-info');
    if(el){el.textContent=_hintBarInfo||T('thinking');el.style.display='block';}
  }
  // Update ponder info in AI bar (line 3) — always stable small font right-aligned
  // Only display ponder info when BOTH ponder move (SAN) and ponder bar info exist.
  // When no ponder info, show nothing (not even the 🔮 icon).
  const ponderEl=document.getElementById('ai-ponder-info');
  if(ponderEl){
    if(!isAIThinking&&!isHintLoading&&!hintText&&_ponderMoveSAN&&_ponderBarInfo&&!gameOver&&!setupMode&&!reviewMode){
      ponderEl.textContent='🔮 '+_ponderMoveSAN+' '+_ponderBarInfo;
    }else{
      ponderEl.textContent='';
    }
  }
}


// ---- Exports ----
export {showToast,_bridgeCall,_showLoadingOverlay,_updateLoadingStatus,_hideLoadingOverlay,_attemptEngineInit,onInitProgress,onEngineReady,onBestMove,onHintMove,onEngineProgress,onPonderProgress,onEngineEval,onEngineInfo,onEngineSwitched,onSettingsImported,onSettingsExported,onPGNExported,onStatsHTMLExported,onStatsRequestReview,onGameDifficultyChanged,onEngineError,onMultiPVProgress,onMultiPVResult,copyMoveHistory,copyReviewPGN,exportPGNToFile,openStatsPage,playSound,handleBackPress,renderEngineConfig,renderEngineConfigAndUpdate,openEngineConfig,closeEngineConfig,scanEngines,switchEngine,importExternalEngine,restartCurrentEngine,setConfigThreads,setConfigHash,setConfigMultiPV,setConfigMoveOverhead,togglePonder,toggleShowWDL,setConfigSkillLevel,toggleLimitElo,setConfigElo,toggleAutoConfig,exportEngineSettings,importEngineSettings,requestEngineEval,_updateEvalDisplay,_updateReviewEvalUI,formatEval,_resetEvalState,_updateAllEvalDisplays,copyFEN,copyReviewFEN,importFEN,_startEngineHeartbeat,_cleanupEventListeners,_formatVariationGroups};
