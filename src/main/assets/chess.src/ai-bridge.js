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
// WDL (Win/Draw/Loss) percentages from Stockfish UCI_ShowWDL — -1 means not available
let _sfWdlW=-1,_sfWdlD=-1,_sfWdlL=-1;
// Mate distance from White's perspective (UCI full moves): positive = White forces mate in N moves, negative = Black forces mate in N moves
// 0 = no mate detected. UCI score mate N gives full moves, not plies.
let _sfMateDistance=0;
// UCI scores are from the SIDE-TO-MOVE's perspective (not White's).
// We convert to White's perspective on receipt; this flag captures whose
// turn it was when the eval was requested, so we can negate correctly.
let _evalForBlackTurn=false;
// Review eval cache: maps reviewStep → {eval: cpValue, mate: mateDistance}
// Avoids re-requesting engine eval for previously visited steps
let _reviewEvalCache=new function(){const m=new Map();const MAX=200;this.get=function(k){if(m.has(k)){const v=m.get(k);m.delete(k);m.set(k,v);return v;}return undefined;};this.has=k=>m.has(k);this.set=function(k,v){if(m.has(k))m.delete(k);m.set(k,v);if(m.size>MAX){const first=m.keys().next().value;m.delete(first);}};this.delete=function(k){const r=m.delete(k);return r;};Object.defineProperty(this,'size',{get:function(){return m.size;},configurable:true});this.clear=function(){m.clear();};this.keys=()=>m.keys();}();
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
let engineConfigData=null;
let engineSettingsData=null;
let engineConfigTab='engine';
let showVariations=false; // 💬显示变例 toggle state
let _reviewAnalyzeSafetyTimer=null; // Safety timeout for reviewAnalyzeAll (prevents infinite hang)
let _lastEngineCallbackTime=0; // Timestamp of last engine callback — used by heartbeat monitor
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

let _toastTimer=0;
function showToast(msg,duration=2500){const old=document.getElementById('_toast');if(old)old.remove();if(_toastTimer)clearTimeout(_toastTimer);const t=document.createElement('div');t.id='_toast';t.style.cssText='position:fixed;bottom:60px;left:50%;transform:translateX(-50%);background:rgba(42,21,32,.96);color:#f5e6c8;padding:10px 24px;border-radius:6px;font-size:.85rem;z-index:10000;border:1px solid #d4a017;box-shadow:0 0 4px rgba(212,160,23,.10);pointer-events:none;opacity:0;transition:opacity .3s;font-family:system-ui,-apple-system,sans-serif';t.textContent=msg;document.body.appendChild(t);requestAnimationFrame(()=>{t.style.opacity='1'});_toastTimer=setTimeout(()=>{t.style.opacity='0';setTimeout(()=>t.remove(),300)},duration)}

// Update the foreground service notification with engine process info.
// This prevents the OS from killing the engine process on aggressive
// memory managers (Xiaomi HyperOS 3, etc.) by keeping the notification
// actively updated with real-time engine status.
let _lastNotificationInfo='';
let _notificationThrottleTimer=0;
function _updateEngineNotification(info){
  if(!info||info===_lastNotificationInfo)return;
  _lastNotificationInfo=info;
  // Throttle: update notification at most once per second
  if(_notificationThrottleTimer)return;
  _notificationThrottleTimer=setTimeout(function(){_notificationThrottleTimer=0;},1000);
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
function copyMoveHistory(){
  if(!moveRecords||!moveRecords.length){showToast(T('no_move_records'));return}
  let pgn='';
  for(let i=0;i<moveRecords.length;i+=2){
    const n=Math.floor(i/2)+1;
    const w=moveRecords[i];
    const b=moveRecords[i+1];
    pgn+=n+'. '+(w?w.notation:'...');
    // PGN RAV variations after white's move
    // Mainline group → skip (not standard PGN, only for in-app display)
    // All variations are 🌿 lines (including line 1 = mainline prediction).
    // Ponder is fully decoupled from move records — never recorded as a variation.
    // Skip 'analysis' group and 'ponder' group.
    if(showVariations&&w&&w.variations&&w.variations.length>0){
      for(const v of w.variations){
        if(!v.san)continue;
        if(v.group==='analysis'||v.group==='ponder')continue;
        const vmn = (v.varMoveNum!=null) ? v.varMoveNum : n;
        const fiw = (v.firstMoveIsWhite!=null) ? v.firstMoveIsWhite : false;
        pgn+=' ('+_formatSANAsRAV(v.san,vmn,fiw)+')';
      }
    }
    if(b){
      pgn+=' '+b.notation;
      // PGN RAV variations after black's move
      // Ponder is fully decoupled from move records.
      if(showVariations&&b&&b.variations&&b.variations.length>0){
        for(const v of b.variations){
          if(!v.san)continue;
          if(v.group==='analysis'||v.group==='ponder')continue;
          const vmn = (v.varMoveNum!=null) ? v.varMoveNum : (n+1);
          const fiw = (v.firstMoveIsWhite!=null) ? v.firstMoveIsWhite : true;
          pgn+=' ('+_formatSANAsRAV(v.san,vmn,fiw)+')';
        }
      }
    }
    pgn+=' ';
  }
  pgn=pgn.trim();
  if(gameOver){
    if(gameOver.includes(T('white_wins'))||gameOver.includes('White wins'))pgn+=' 1-0';
    else if(gameOver.includes(T('black_wins'))||gameOver.includes('Black wins'))pgn+=' 0-1';
    else pgn+=' 1/2-1/2';
  }
  safeCopyToClipboard(pgn,T('pgn_copied'));
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
function _esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
// XSS-safe JS string escaper — for inserting paths into onclick='...' attributes
// _esc() escapes for HTML, but paths in onclick JS strings need JS-level escaping
// e.g. /sdcard/0'Brien/ — the single quote would break the onclick attribute
function _escJs(s){return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'&quot;').replace(/\n/g,'\\n').replace(/\r/g,'\\r');}

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
 * ALL variations are 🌿 lines with unified format:
 *   - mainline group (mpvIndex -1) → 🌿线1 (engine's predicted continuation)
 *   - multipv group (mpvIndex 1,2,3...) → 🌿线2, 🌿线3, etc. (alternative lines)
 * Ponder is fully decoupled from move records — never appears here.
 * 'analysis' group is skipped.
 */
function _formatVariationGroups(variations, moveNum, isAfterWhiteMove){
  if(!variations||!variations.length)return '';
  // Collect all displayable variations into a single unified list
  const displayLines=[];
  for(const v of variations){
    // Skip analysis and ponder groups entirely
    if(v.group==='analysis'||v.group==='ponder')continue;
    // Mainline prediction → line 1
    if(v.group==='mainline'){
      displayLines.push({san:v.san, varMoveNum:v.varMoveNum, firstMoveIsWhite:v.firstMoveIsWhite, lineNum:1});
    }
    // Secondary MultiPV → line 2, 3, etc.
    else if(v.group==='multipv'&&v.mpvIndex>0){
      displayLines.push({san:v.san, varMoveNum:v.varMoveNum, firstMoveIsWhite:v.firstMoveIsWhite, lineNum:v.mpvIndex+1});
    }
    // PGN imported variations → 🌿 line N
    else if(v.group==='pgn'){
      displayLines.push({san:v.san, varMoveNum:v.varMoveNum, firstMoveIsWhite:v.firstMoveIsWhite, lineNum:v.lineNum||1});
    }
  }
  if(!displayLines.length)return '';
  // Fallback: if varMoveNum is not stored on the variation, compute it from the
  // global isAfterWhiteMove (backward compatibility with existing move records).
  const defaultVarMoveNum = isAfterWhiteMove ? moveNum : moveNum + 1;
  function getVarMoveNum(v){ return (v.varMoveNum!=null) ? v.varMoveNum : defaultVarMoveNum; }
  // Fallback firstMoveIsWhite for legacy records
  function getFirstMoveIsWhite(v){ return (v.firstMoveIsWhite!=null) ? v.firstMoveIsWhite : !isAfterWhiteMove; }
  let h='';
  // Render ALL lines with unified 🌿 format
  for(const line of displayLines){
    const rav=_formatSANAsRAV(line.san, getVarMoveNum(line), getFirstMoveIsWhite(line));
    if(rav){
      h+='<div class="mvar"><span style="color:#7eb8da;font-size:.6rem;font-weight:600">🌿 '+T('line_label')+' '+line.lineNum+'</span> <span style="font-size:.75rem">'+_esc(rav)+'</span></div>';
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
  if(pieceType==='king'&&Math.abs(toCol-fromCol)===2){
    return toCol>fromCol?'O-O':'O-O-O';
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
  const toCol=uci.charCodeAt(2)-97;
  const toRow=8-parseInt(uci[3]);
  // Bounds check
  if(fromRow<0||fromRow>7||fromCol<0||fromCol>7||toRow<0||toRow>7||toCol<0||toCol>7)
    return { san: _uciToSimple(uci), postState: state };
  if(!state.board[fromRow]) return { san: _uciToSimple(uci), postState: state };
  const piece=state.board[fromRow][fromCol];
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

// ===================== STOCKFISH BRIDGE CALLBACKS =====================

// Generate FEN string from game state
/**
 * Generate a FEN string from game state.
 * @param {Object} s - Game state object with board, currentTurn, castlingRights, etc.
 * @returns {string} FEN string representation of the position
 */
function generateFEN(s){
  if(!s||!s.board)return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  if(!Array.isArray(s.board)||s.board.length!==8)return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const PIECE_FEN={white:{king:'K',queen:'Q',rook:'R',bishop:'B',knight:'N',pawn:'P'},black:{king:'k',queen:'q',rook:'r',bishop:'b',knight:'n',pawn:'p'}};
  let fen='';
  for(let r=0;r<8;r++){
    if(!s.board[r])return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    let empty=0;
    for(let c=0;c<8;c++){
      const p=s.board[r][c];
      if(p&&PIECE_FEN[p.color]&&PIECE_FEN[p.color][p.type]){if(empty>0){fen+=empty;empty=0}fen+=PIECE_FEN[p.color][p.type]}
      else{empty++}
    }
    if(empty>0)fen+=empty;
    if(r<7)fen+='/';
  }
  fen+=' '+(s.currentTurn==='white'?'w':'b');
  let castle='';
  const cr=s.castlingRights||{};
  if(cr.whiteKingside)castle+='K';
  if(cr.whiteQueenside)castle+='Q';
  if(cr.blackKingside)castle+='k';
  if(cr.blackQueenside)castle+='q';
  fen+=' '+(castle||'-');
  let ep='-';
  if(s.enPassantTarget){const et=s.enPassantTarget;const capColor=s.currentTurn;const pd=capColor==='white'?1:-1;for(const dc of[-1,1]){const cr2=et.row+pd,cc2=et.col+dc;if(inB(cr2,cc2)&&s.board[cr2][cc2]&&s.board[cr2][cc2].type==='pawn'&&s.board[cr2][cc2].color===capColor){ep=String.fromCharCode(97+et.col)+(8-et.row);break;}}}
  fen+=' '+ep;
  fen+=' '+(s.halfMoveClock||0);
  fen+=' '+(s.fullMoveNumber||1);
  return fen;
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
  if(_aiSafetyTimerId){clearTimeout(_aiSafetyTimerId);_aiSafetyTimerId=null;}
  render();
}

// Callback: Engine ready
function onEngineReady(){
  console.log('Stockfish engine is ready');
  _engineReady=true;
  // Reset restart counter on successful engine init
  if(window._engineRestartCount)window._engineRestartCount=0;
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
  _updateLoadingStatus(T('engine_ready'),100);
  // Sync language preference to SharedPreferences for notification i18n
  try{if(typeof AndroidBridge!=='undefined'&&AndroidBridge.saveLangPref)AndroidBridge.saveLangPref(_lang);}catch(e){}
  // Update foreground service notification with engine ready status
  _updateEngineNotification(T('engine_ready'));
  setTimeout(function(){
    _hideLoadingOverlay();
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
  // Cancel safety timeout — engine responded
  if(_aiSafetyTimerId){clearTimeout(_aiSafetyTimerId);_aiSafetyTimerId=null;}
  // Discard stale responses from previous engine searches
  if(_aiMoveRequestId!==_currentAiRequestId){console.warn('Discarding stale bestmove');return;}
  isAIThinking=false;_aiBarInfo='';_aiRetryCount=0; // Reset retry count on successful bestmove

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

  // Process variations in onMultiPVResult() (called after onBestMove)
  if(moveRecords.length>0){
    const lastIdx=moveRecords.length-1;
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
  }

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
            AndroidBridge.startPonder(ponderFenAfterMove);
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
function onEngineProgress(depth,nodes,nps,scoreCp,scoreMate,wdlW,wdlD,wdlL){
  if(depth<=0)return;
  // DEFENSE IN DEPTH: Skip unrealistic depth values (>60) that could come from
  // stale info lines due to Java state machine race condition (see StockfishNative
  // processInfoLine for root cause analysis). Prevents showing "深度:200" etc.
  if(depth>60){console.warn('onEngineProgress: skipping unrealistic depth',depth);return;}
  let infoParts=[T('depth')+':'+depth];
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
  if(_evalLoading&&depth>0&&depth<=30){
    _sfDepth=depth;
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
    _multiPVLines.sort(function(a,b){return a.index-b.index;});
    _updateMultiPVDisplay();
  }
}

// Ponder progress is decoupled from move records (never appears as variation),
// but is displayed as 🔮 row in the AI opponent bar for real-time feedback.
function onPonderProgress(depth,nodes,nps,scoreCp,scoreMate){
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
  if(nodes!=null){const nodesStr=nodes>=1000000?(nodes/1000000).toFixed(1)+'M':nodes>=1000?Math.round(nodes/1000)+'K':String(nodes);infoParts.push(T('nodes')+':'+nodesStr);}
  if(nps!=null){const npsStr=nps>=1000000?(nps/1000000).toFixed(1)+'M/s':nps>=1000?Math.round(nps/1000)+'K/s':String(nps);infoParts.push(npsStr);}
  // Ponder scores are from the side-to-move's perspective.
  // During ponder, the engine analyzes the opponent's predicted position,
  // so the side-to-move is the player (opposite of AI).
  let isBlackToMove=(playerColor==='black'); // Ponder position = player's turn, so black moves if player is black
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
function onEngineEval(scoreCp,scoreMate,depth,wdlW,wdlD,wdlL){
  // Update heartbeat timestamp — prevents false-positive engine death detection
  // during long eval searches (go depth 22 can take several seconds)
  _lastEngineCallbackTime=Date.now();
  // In review mode: discard stale callbacks from previous steps
  if(reviewMode&&_reviewEvalRequestedStep!==reviewStep){
    return; // Stale response — user has navigated to a different step
  }
  // In normal mode: discard stale callbacks when game state changed
  if(!reviewMode&&_evalStaleGen!==_evalRequestGen){
    return; // Stale response — position no longer matches eval request
  }
  _evalLoading=false;
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
  _sfEvalReady=true;
  // Cache the result for review mode (now includes WDL and depth)
  if(reviewMode){
    _reviewEvalCache.set(reviewStep,{eval:_sfEval,mate:_sfMateDistance,wdlW:_sfWdlW,wdlD:_sfWdlD,wdlL:_sfWdlL,depth:_sfDepth});
  }
  // Callback-driven reviewAnalyzeAll: advance to next step when eval completes
  if(reviewMode&&_reviewAnalyzeAllActive){
    _reviewAnalyzeAdvance();
  }
  _updateAllEvalDisplays();
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
    h+='<div class="dlg-sec"><div style="margin-bottom:10px;opacity:'+(settings.limitStrength?'0.4':'1')+';pointer-events:'+(settings.limitStrength?'none':'auto')+'"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><span style="font-size:.8rem">'+T('skill_level_label')+'</span><div style="display:flex;align-items:center;gap:4px"><button class="btn" style="padding:2px 8px;min-height:28px;font-size:.9rem" onclick="setConfigSkillLevel('+(settings.skillLevel-1)+')">-</button><span style="min-width:24px;text-align:center;font-weight:700">'+(settings.skillLevel!=null?settings.skillLevel:20)+'</span><button class="btn" style="padding:2px 8px;min-height:28px;font-size:.9rem" onclick="setConfigSkillLevel('+(settings.skillLevel+1)+')">+</button></div></div><div style="font-size:.7rem;color:var(--muted)">'+T('skill_level_desc')+(settings.limitStrength?'<br><span style="color:var(--red)">'+T('skill_elo_note')+'</span>':'')+'</div></div></div>';
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
  // FIX: Use requireEngine=false — file reading doesn't need engine
  _bridgeCall(function(bridge){
    const content=bridge.readTextFile(filePath);
    if(content){
      bridge.importSettings(content);
      // FIX: Update _cachedMultiPV after settings import, since multiPV may have changed
      try{const s=JSON.parse(bridge.getEngineSettings());_cachedMultiPV=s.multiPV||1;}catch(e){}
      showToast(T('settings_imported_ok'));
      openEngineConfig();
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
function setConfigMultiPV(v){v=Math.max(1,Math.min(8,parseInt(v)||1));if(engineSettingsData)engineSettingsData.multiPV=v;_cachedMultiPV=v;_bridgeCall(function(bridge){bridge.setEngineMultiPV(v);});renderEngineConfigAndUpdate();}
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
  try{engineConfigData=JSON.parse(info);renderEngineConfigAndUpdate();}catch(e){console.error('onEngineInfo error:',e);}
}
// onEngineSwitched stub — engine switching removed
// Kept as a minimal stub to prevent JS errors if Java callback fires.
function onEngineSwitched(result){
  showToast(T('built_in_only'));
}
function onSettingsImported(result){
  try{const r=JSON.parse(result);showToast(r.success?T('settings_imported'):T('settings_import_fail')+': '+r.message);if(r.success){openEngineConfig();}}catch(e){showToast(T('settings_import_done'));}
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
    // Sort by index
    _multiPVLines.sort(function(a,b){return a.index-b.index;});
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
  const primaryPV=_lastEngineVariation||(_multiPVResult&&_multiPVResult.length>0?_multiPVResult[0].pv:null);

  // --- Mainline prediction: continuation after the played move ---
  // Primary PV starts with the bestmove. Strip it to get continuation.
  if(primaryPV){
    const uciMoves=primaryPV.trim().split(/\s+/);
    if(uciMoves.length>0 && uciMoves[0]===uciMove){
      // Strip bestmove, convert remaining to SAN using post-bestmove state
      const afterBestState=_uciToSAN(uciMove,preMoveState).postState;
      const remainingUci=uciMoves.slice(1);
      if(remainingUci.length>0){
        const sanResult=_convertPVtoSAN(remainingUci.join(' '),afterBestState);
        if(sanResult.sanMoves){
          variations.push({
            type:'mainline',
            san:sanResult.sanMoves,
            firstMoveIsWhite:contFirstIsWhite,
            varMoveNum:contVarMoveNum,
            group:'mainline',
            mpvIndex:-1
          });
        }
      }
      // Legacy field
      if(!lastRec.variation){
        lastRec.variation=remainingUci.join(' ');
      }
    }else if(uciMoves.length>1){
      // PV doesn't start with bestmove — strip first move as alternative
      // The remaining moves are the continuation from the opposite side
      const afterFirstState=_uciToSAN(uciMoves[0],preMoveState).postState;
      const remainingUci=uciMoves.slice(1);
      const sanResult=_convertPVtoSAN(remainingUci.join(' '),afterFirstState);
      if(sanResult.sanMoves){
        variations.push({
          type:'mainline',
          san:sanResult.sanMoves,
          firstMoveIsWhite:contFirstIsWhite,
          varMoveNum:contVarMoveNum,
          group:'mainline',
          mpvIndex:-1
        });
      }
    }
  }
  _lastEngineVariation=null;

  // --- MultiPV secondary variations (index 1+) ---
  // These start with alternative first moves (NOT the bestmove)
  if(_multiPVResult&&_multiPVResult.length>1){
    for(let vi=1;vi<_multiPVResult.length;vi++){
      const mpv=_multiPVResult[vi];
      if(!mpv.pv)continue;
      const uciMoves=mpv.pv.trim().split(/\s+/);
      if(uciMoves.length===0)continue;

      // Secondary PV's first move is an alternative to bestmove (same side)
      // Convert the ENTIRE PV to SAN starting from preMoveState
      const sanResult=_convertPVtoSAN(mpv.pv,preMoveState);
      if(sanResult.sanMoves){
        variations.push({
          type:'multipv',
          san:sanResult.sanMoves,
          firstMoveIsWhite:aiIsAfterWhiteMove, // First move is from the same side as AI's move
          varMoveNum:aiMoveNum,  // Same move number as the played move
          group:'multipv',
          mpvIndex:vi
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

  // Re-render
  requestAnimationFrame(function(){render();});
}

// Update display with MultiPV lines
function _updateMultiPVDisplay(){
  if(_multiPVLines.length<1)return; // Show even single line when MultiPV enabled
  // Build hint text with all PV lines
  let hintParts=[];
  for(const pv of _multiPVLines){
    let scoreStr='';
    if(pv.scoreMate!=null){
      const m=parseInt(pv.scoreMate);
      scoreStr=m>0?'#+'+Math.abs(m):m<0?'#-'+Math.abs(m):'#0';
    }else if(pv.scoreCp!=null){
      const pd=(pv.scoreCp/100).toFixed(1);
      scoreStr=(pv.scoreCp>0?'+':'')+pd;
    }
    // Convert PV UCI moves to SAN format
    let pvPreview='';
    if(pv.pv){try{const _conv=_convertPVtoSAN(pv.pv,gameState);pvPreview=_conv.sanMoves.split(/\s+/).slice(0,4).join(' ');}catch(e){pvPreview=pv.pv.split(/\s+/).slice(0,4).join(' ');}}
    hintParts.push((pv.index===1?'⭐':'📌')+' '+scoreStr+(pvPreview?' '+pvPreview:''));
  }
  if(isHintLoading)_hintBarInfo=hintParts.join(' | ');
  _updateAIThinkDisplay();
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
  if(_reviewAnalyzeAllActive){
    _reviewAnalyzeAllActive=false;
    if(_reviewAnalyzeSafetyTimer){clearTimeout(_reviewAnalyzeSafetyTimer);_reviewAnalyzeSafetyTimer=null;}
  }
  // P1 FIX: Auto-restart engine (max 2 retries) for mobile resilience
  // NOTE: Java-side recoverEngine() handles most restart cases with _restartLock.
  // This JS-side restart is a secondary safety net only. Don't over-retry here
  // because it conflicts with Java-side recovery and causes "Java exception" errors.
  if(!window._engineRestartCount)window._engineRestartCount=0;
  window._engineRestartCount++;
  if(window._engineRestartCount<=2){
    showToast(T('engine_error_restart')+' ('+window._engineRestartCount+'/2)...');
    setTimeout(()=>{
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
  // When requestEngineEval() and doAIMove() are called in the same event loop tick,
  // both start concurrent Java threads that send interleaved UCI commands:
  //   Thread A (engineEval): stop → position fen X → forceFullStrength() → go depth 15
  //   Thread B (engineGo):   stop → position fen X → setGameDifficulty(N) → go movetime T
  // This causes: (1) Thread B's stop interrupts Thread A's search, losing the eval;
  // (2) Both threads change currentState, causing score misrouting;
  // (3) Interleaved position/skill commands corrupt engine state.
  // Fix: don't start the eval at all when doAIMove() will run next — the eval
  // will be requested after the AI makes its move (in updateAfterMove).
  if(!reviewMode&&!gameOver&&gameState.currentTurn!==playerColor)return;
  // P0 FIX: Reset eval state BEFORE capturing _evalRequestGen.
  // Previously _evalRequestGen was set before _resetEvalState() in some callers,
  // causing stale detection to immediately invalidate the eval.
  // Now: _resetEvalState() increments _evalStaleGen, then _evalRequestGen captures it.
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
  if(reviewMode&&reviewStates&&reviewStates.length>0&&reviewStep>=0&&reviewStep<reviewStates.length){
    // Check cache first
    const cached=_reviewEvalCache.get(reviewStep);
    if(cached!=null){
      _sfEval=cached.eval;_sfMateDistance=cached.mate!=null?cached.mate:0;_sfWdlW=cached.wdlW!=null?cached.wdlW:-1;_sfWdlD=cached.wdlD!=null?cached.wdlD:-1;_sfWdlL=cached.wdlL!=null?cached.wdlL:-1;_sfDepth=cached.depth!=null?cached.depth:0;_sfEvalReady=true;_evalLoading=false;
      _updateAllEvalDisplays();
      return;
    }
    // BUG FIX: Check for checkmate/stalemate BEFORE calling the engine.
    // When Stockfish evaluates a position with no legal moves (checkmate/stalemate),
    // it outputs "bestmove (none)" WITHOUT any preceding info line containing a score.
    // The Java-side fallback in handleBestMove(STATE_EVAL) would then dispatch
    // onEngineEval(0, null, depth) — reporting 0cp — which is INCORRECT for checkmate
    // (should be ±99999 mate 0). By detecting terminal positions here, we set the
    // correct evaluation directly and avoid the engine call entirely.
    const _rs=reviewStates[reviewStep].state;
    const _termStatus=gameStatus(_rs);
    if(_termStatus==='checkmate'){
      const _isBlackTurn=_rs.currentTurn==='black';
      _sfEval=_isBlackTurn?99999:-99999;
      _sfMateDistance=0;_sfDepth=0;
      _sfEvalReady=true;_evalLoading=false;
      _reviewEvalCache.set(reviewStep,{eval:_sfEval,mate:0,depth:0,wdlW:_isBlackTurn?0:1000,wdlD:0,wdlL:_isBlackTurn?1000:0});
      _updateAllEvalDisplays();
      if(_reviewAnalyzeAllActive){_reviewAnalyzeAdvance();}
      return;
    }
    if(_termStatus==='draw_stalemate'||_termStatus==='draw_insufficient'||_termStatus==='draw_5fold'||_termStatus==='draw_75move'||_termStatus==='draw_50move'||_termStatus==='draw_repetition'){
      _sfEval=0;_sfMateDistance=0;_sfDepth=0;
      _sfEvalReady=true;_evalLoading=false;
      _reviewEvalCache.set(reviewStep,{eval:0,mate:0,depth:0,wdlW:333,wdlD:334,wdlL:333});
      _updateAllEvalDisplays();
      if(_reviewAnalyzeAllActive){_reviewAnalyzeAdvance();}
      return;
    }
    // Invalidate any stale in-flight callbacks
    const fen=generateFEN(_rs);
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
        }catch(e){console.error('engineEvalDeep error:',e);_evalLoading=false;_updateEvalDisplay();}
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
        },300);
      }
    }
  }else{
    const fen=generateFEN(gameState);
    _evalForBlackTurn=gameState.currentTurn==='black';
    if(typeof AndroidBridge!=='undefined'&&AndroidBridge.isEngineReady()){
      _evalLoading=true;
      _updateEvalDisplay();
      try{AndroidBridge.engineEval(fen);}catch(e){console.error('engineEval error:',e);_evalLoading=false;_updateEvalDisplay();}
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
  if(_sfWdlW>=0&&_sfWdlD>=0&&_sfWdlL>=0){const total=_sfWdlW+_sfWdlD+_sfWdlL;const wP=Math.round(_sfWdlW/total*100);const dP=Math.round(_sfWdlD/total*100);const lP=100-wP-dP;wdlStr='<span style="font-size:.65rem;color:var(--muted);margin-left:4px">('+wP+'%W/'+dP+'%D/'+lP+'%L)</span>';}
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
function _resetEvalState(){_sfMateDistance=0;_sfWdlW=-1;_sfWdlD=-1;_sfWdlL=-1;_sfDepth=0;_sfEvalReady=false;_evalLoading=true;_evalStaleGen++;_lastProgressNodes=null;_lastProgressNps=null;_ponderGen++;_ponderBarInfo='';_ponderMoveSAN='';_pendingPonderMoveUCI=null;_updateAIThinkDisplay();}
function _updateAllEvalDisplays(){_updateEvalDisplay();_updateReviewEvalUI();}

// Update AI thinking display (AI bar and hint area are INDEPENDENT)
// AI bar: shows search info when AI is thinking, shows 🔮 ponder info when pondering
// Hint area: only shows search info when hint is loading
let _aiBarInfo='';
let _hintBarInfo='';
let _ponderBarInfo='';
let _pendingPonderMoveUCI=null; // Stored UCI ponder move awaiting first onPonderProgress for deferred SAN conversion
function _updateAIThinkDisplay(){
  if(isAIThinking){
    _aiBarInfo=aiThinkInfo;
    const el=document.getElementById('ai-bar');
    if(el){
      let tind=el.querySelector('.tind');
      if(!tind){
        tind=document.createElement('span');tind.className='tind';
        // Append .tind to the first-row flex container (the child div
        // with display:flex;align-items:center), NOT to #ai-bar itself. Appending
        // to #ai-bar made .tind a sibling of the inner column div, breaking the
        // layout and causing ponder info on the second line to misalign.
        const firstRow=el.querySelector('div[style*="align-items:center"]')||el.querySelector('div[style*="flex-direction:column"]>div');
        if(firstRow){firstRow.appendChild(tind);}else{el.appendChild(tind);}
      }
      tind.textContent=_aiBarInfo||T('thinking');
    }
  }
  if(isHintLoading){
    _hintBarInfo=aiThinkInfo;
    const el=document.getElementById('hint-search-info');
    if(el){el.textContent=_hintBarInfo||T('thinking');el.style.display='block';}
  }
  // Update ponder info in AI bar second line — always stable small font right-aligned
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
export {showToast,_bridgeCall,_showLoadingOverlay,_updateLoadingStatus,_hideLoadingOverlay,_attemptEngineInit,onInitProgress,onEngineReady,onBestMove,onHintMove,onEngineProgress,onPonderProgress,onEngineEval,onEngineInfo,onEngineSwitched,onSettingsImported,onSettingsExported,onGameDifficultyChanged,onEngineError,onMultiPVProgress,onMultiPVResult,copyMoveHistory,copyReviewPGN,playSound,handleBackPress,renderEngineConfig,renderEngineConfigAndUpdate,openEngineConfig,closeEngineConfig,scanEngines,switchEngine,importExternalEngine,restartCurrentEngine,setConfigThreads,setConfigHash,setConfigMultiPV,setConfigMoveOverhead,togglePonder,toggleShowWDL,setConfigSkillLevel,toggleLimitElo,setConfigElo,toggleAutoConfig,exportEngineSettings,importEngineSettings,requestEngineEval,_updateEvalDisplay,_updateReviewEvalUI,formatEval,_resetEvalState,_updateAllEvalDisplays,copyFEN,copyReviewFEN,importFEN,_startEngineHeartbeat,_cleanupEventListeners,_formatVariationGroups};
