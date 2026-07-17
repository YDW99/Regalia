// ===================== MODULE: ui =====================
// Rendering, interaction, dialog management
// Depends on: game-logic, eco-data, tablebase, ai-bridge
//
// Copyright (C) 2026 Regalia
//
// UI layout and interaction patterns derived from DroidFish
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

// Global haptic feedback for all interactive elements
// v1.0.8 PHASE 22 (supplement): Also play a 'select' sound for all button clicks.
// This provides unified audio feedback for EVERY interactive element without
// needing to modify each inline onclick. Specific functions (undoMove, redoMove,
// flipBoard, etc.) already play their own specialized sounds; this global
// 'select' sound complements them (the compressor prevents clipping overlap).
document.addEventListener('click', function(e) {
  const btn = e.target.closest('.btn, .btn-compact, .diff-b, .toggle, .clr-btn, .prom-btn, .setup-btn, .setup-del, .setup-clr, .hdr-btn, .hdr-btn-lg');
  if (btn) {
    if (!(btn.classList.contains('toggle') || btn.closest('.toggle'))) {
      HapticManager.fire('BUTTON_PRESS');
    }
    // v1.0.8 PHASE 22 supplement: unified button-click sound
    try{if(typeof playSound==='function')playSound('select');}catch(_e){}
  }
}, true);

// v1.0.4 Round-5 Rev27: Global hyperlink interceptor.
// Any <a href="http(s)://..."> clicked anywhere in the document (About dialog,
// license links, etc.) is routed to AndroidBridge.openUrlInBrowser() which
// launches the system default browser. The default WebView navigation is
// suppressed via preventDefault() so the WebView itself never tries to load
// the external URL (which would either fail or be blocked by CSP).
// Internal anchor links (href="#...") and empty hrefs are left alone.
document.addEventListener('click', function(e) {
  const a = e.target.closest && e.target.closest('a[href]');
  if (!a) return;
  const href = a.getAttribute('href') || '';
  // Skip in-page anchors and empty links
  if (!href || href.charAt(0) === '#') return;
  // Only intercept http(s) links — let mailto:/tel: etc. be handled by the OS
  // through shouldOverrideUrlLoading in ChessWebViewClient.
  if (href.indexOf('http://') !== 0 && href.indexOf('https://') !== 0) return;
  e.preventDefault();
  try {
    if (typeof AndroidBridge !== 'undefined' && AndroidBridge.openUrlInBrowser) {
      AndroidBridge.openUrlInBrowser(href);
    } else {
      // Fallback for desktop debugging: open in a new tab
      try { window.open(href, '_blank'); } catch (err) {}
    }
  } catch (err) {
    console.error('openUrlInBrowser failed:', err);
  }
}, true);

// Touch scroll prevention: block default scroll when touch moves >10px on board
// (main game mode only). In REVIEW mode, we WANT the board to be scrollable
// (the whole review body scrolls when the user slides on the board), so we
// skip the preventDefault.
//
// v1.0.5 Round-6 Rev49 NEW: Long-press on any board square toggles the
// board anti-shake stabilization on/off. The long-press is detected by
// holding the touch for ≥500ms without moving >10px. When triggered, we
// call AndroidBridge.toggleStabilization() (Java handles sensor registration
// and shows a Toast in the current language). A haptic feedback is fired
// so the user knows the long-press was registered.
(function(){
  let _touchStartX=0, _touchStartY=0, _touchOnBoard=false;
  // v1.0.5 Rev49: long-press detection state
  let _longPressTimer=null;
  let _longPressFired=false;
  const _LONG_PRESS_MS=500; // 500ms hold = long-press
  const _LONG_PRESS_MOVE_TOLERANCE=10; // px — cancel if moved more than this
  document.addEventListener('touchstart',function(e){
    const t=e.touches[0];
    _touchStartX=t.clientX; _touchStartY=t.clientY;
    _touchOnBoard=!!(e.target.closest&&e.target.closest('.bgrid'));
    // v1.0.5 Rev49: start long-press timer if touch is on the board
    if(_touchOnBoard){
      _longPressFired=false;
      if(_longPressTimer)clearTimeout(_longPressTimer);
      _longPressTimer=setTimeout(function(){
        _longPressFired=true;
        // Fire haptic feedback so the user knows the long-press registered
        try{if(typeof HapticManager!=='undefined'&&HapticManager.fire)HapticManager.fire('BUTTON_PRESS');}catch(_e){}
        // Toggle stabilization via the Java bridge
        try{
          if(typeof AndroidBridge!=='undefined'&&AndroidBridge.toggleStabilization){
            AndroidBridge.toggleStabilization();
          }
        }catch(_e){console.warn('toggleStabilization bridge call failed',_e);}
      },_LONG_PRESS_MS);
    }
  },{passive:true});
  document.addEventListener('touchmove',function(e){
    if(!_touchOnBoard)return;
    const t=e.touches[0];
    const dx=Math.abs(t.clientX-_touchStartX);
    const dy=Math.abs(t.clientY-_touchStartY);
    // v1.0.5 Rev49: cancel long-press if moved too much
    if(dx>_LONG_PRESS_MOVE_TOLERANCE||dy>_LONG_PRESS_MOVE_TOLERANCE){
      if(_longPressTimer){clearTimeout(_longPressTimer);_longPressTimer=null;}
    }
    // v1.0.3-p8: in review mode, allow touch-slide on the board to scroll the
    // whole review body (the user explicitly requested this). Only block the
    // default scroll in non-review modes (main game, setup) where board slides
    // should NOT scroll the page.
    if(reviewMode!==undefined&&reviewMode)return;
    if(dx>10||dy>10){
      e.preventDefault();
    }
  },{passive:false});
  document.addEventListener('touchend',function(e){
    // v1.0.5 Rev49: clear long-press timer on touch end
    if(_longPressTimer){clearTimeout(_longPressTimer);_longPressTimer=null;}
    // If long-press fired, suppress the click (so the square doesn't also
    // get selected/deselected). We do this by setting a flag that sqClick()
    // checks. Since click fires after touchend, we use a short-lived flag.
    if(_longPressFired){
      _longPressFired=false;
      // Set a flag to suppress the next click on a board square
      window._suppressNextBoardClick=true;
      setTimeout(function(){window._suppressNextBoardClick=false;},300);
    }
  },{passive:true});
  document.addEventListener('touchcancel',function(e){
    if(_longPressTimer){clearTimeout(_longPressTimer);_longPressTimer=null;}
  },{passive:true});
})();


// ===================== CHESS ENGINE =====================
// =====================================================================
// MODULE BOUNDARIES (for future splitting):
// [STORE]     - State management, dirty flags, DOM cache
// [GAME]      - Chess rules, move generation, position evaluation
// [AI]        - Stockfish/AndroidBridge communication
// [UI]        - Rendering, interaction, dialog management
// [ECO]       - ECO opening data and lookup
// [REVIEW]    - Review mode logic and rendering
// [ENGINE_CFG] - Engine configuration panel
// =====================================================================

// ===================== RENDER SCHEDULING NOTE =====================
// v1.2.3 round-20 (known-issue C): the DIRTY_* incremental-render subsystem
//   (constants/markDirty/_scheduleRender/_performDirtyRender/Integer_bitcount,
//   ~80 lines) was REMOVED as dead code. Every markDirty() call site passed
//   DIRTY_FULL or DIRTY_MOVES|DIRTY_PANEL|DIRTY_EVAL — both always routed to
//   a full render() via _performDirtyRender's full-render branch, so the
//   granular board/eval incremental path was unreachable. markDirty(x) call
//   sites now call render() directly (identical behavior; render() has its
//   own rAF throttle). The shared square-rendering primitives
//   (_updateSingleSq/_updateChangedSquares/_getSqElCache) remain — used by
//   the live _updateBoardLightweight selection/hover path.

// ===================== DOM ELEMENT CACHE =====================
let _cachedElements = {};
const _EL_BOARD_GRID = 'board-grid';
const _EL_EVAL_DISP = 'eval-disp';
const _EL_AI_BAR = 'ai-bar';
const _EL_PLAYER_BAR = 'player-bar';
const _EL_APP = 'app';

/**
 * Get a cached DOM element reference. Returns null if not found.
 * Cache is invalidated on full render (innerHTML rebuild).
 * @param {string} id - Element ID to look up
 * @returns {HTMLElement|null}
 */
function _el(id) {
  if (!_cachedElements[id]) {
    _cachedElements[id] = document.getElementById(id);
  }
  return _cachedElements[id];
}

/** Invalidate all cached element references (call after innerHTML rebuild) */
function _invalidateElCache() {
  _cachedElements = {};
}

// v1.0.2 (qw3.7max audit): Cached board square elements — 1D array indexed by
// (row*8+col) instead of 2D array-of-arrays. A 1D array has better memory
// locality (contiguous) and avoids the second pointer dereference on every
// access. With 10-50 engine progress callbacks/sec, this shaves a small but
// measurable amount off the hot incremental-update path.
// Invalidated on full render.
let _sqElCache = null;
// v1.0.2 (qw3.7max audit): Cached review-moves-list element — avoids
// getElementById('reviewMovesList') on every render's scroll-into-view path.
// Assigned after full render (when the element is freshly created), cleared
// on cache invalidation.
let _rListEl = null;

// v1.0.4 ROUND-5 REV13: Persistent .mlist scroll state — the scroll EVENT
// LISTENER is the AUTHORITATIVE source. The save phase only seeds on first render.
// v1.0.4 Rev30 ROBUSTNESS FIX: Added _scrollRestoreGuard flag. When we
// programmatically set scrollTop during the restore phase, the browser fires
// 'scroll' events with INTERMEDIATE values (especially with scroll-behavior:
// smooth on .mlist). These intermediate events were overwriting
// _mlistScrollState.scrollTop, causing the NEXT render to restore to a stale
// intermediate position — manifesting as "list repeatedly jumps back to top".
// The guard suppresses scroll-event handling during programmatic restoration.
let _mlistScrollState={scrollTop:0,atBottom:false,valid:false};
let _scrollRestoreGuard=false; // true while we're programmatically restoring scroll
function _onMlistScroll(e){
  if(_scrollRestoreGuard)return; // ignore events from our own programmatic scroll
  const el=e.target;
  if(!el||el.scrollHeight===0||el.clientHeight===0)return;
  _mlistScrollState.scrollTop=el.scrollTop;
  _mlistScrollState.atBottom=(el.scrollTop+el.clientHeight>=el.scrollHeight-40);
  _mlistScrollState.valid=true;
}

/**
 * Get or build the cached board square elements array.
 * @returns {Array<HTMLElement>|null} 1D array: _sqElCache[displayRow*8 + displayCol]
 */
function _getSqElCache() {
  if (_sqElCache) return _sqElCache;
  const grid = _el(_EL_BOARD_GRID);
  if (!grid) return null;
  const sqs = grid.querySelectorAll('.sq');
  if (sqs.length !== 64) return null;
  // v1.0.2 (qw3.7max audit): 1D array — single contiguous allocation, no
  // nested array objects. Index as _sqElCache[r*8 + c].
  _sqElCache = new Array(64);
  for (let i = 0; i < 64; i++) {
    _sqElCache[i] = sqs[i];
  }
  return _sqElCache;
}

// ===================== STATE MANAGEMENT =====================

// ===================== ERROR BOUNDARY =====================
/**
 * Global error boundary — catches rendering errors and shows
 * user-friendly recovery UI instead of white screen.
 */
(function _installErrorBoundary() {
  const _origOnError = window.onerror;
  window.onerror = function(msg, url, line, col, error) {
    console.error('Global error caught:', error || msg);

    // Save current game state to localStorage for recovery
    try {
      const recoveryData = {
        gameState: gameState,
        moveRecords: moveRecords,
        playerColor: playerColor,
        aiLevel: aiLevel,
        timestamp: Date.now()
      };
      const recoveryJson = JSON.stringify(recoveryData);
      localStorage.setItem('Regalia_recovery', recoveryJson);
      // v1.0.4 Round-5 Rev16: Also persist to Java side (HyperOS 3 cache-wipe proof)
      try{if(typeof AndroidBridge!=='undefined'&&AndroidBridge.persistentSet)AndroidBridge.persistentSet('Regalia_recovery',recoveryJson);}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
    } catch(e){console.warn('[UI]',e&&e.message?e.message:e);}

    // If this is a render error (indicated by the stack trace), show recovery UI
    if (error && error.stack && error.stack.indexOf('renderInternal') !== -1) {
      const app = document.getElementById('app');
      if (app) {
        app.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:var(--bg);color:var(--text);padding:20px;text-align:center;font-family:system-ui,sans-serif">' +
          '<div style="font-size:3rem;margin-bottom:16px">♔</div>' +
          '<h2 style="color:var(--accent2);margin-bottom:12px">'+T('app_name')+' v1.2.3</h2>' +
          '<p style="color:#a08050;margin-bottom:20px;max-width:300px">'+T('render_error')+'</p>' +
          '<button onclick="location.reload()" style="padding:12px 24px;background:var(--btn-a-bg);color:var(--bg);border:none;border-radius:6px;font-size:1rem;font-weight:700;cursor:pointer">'+T('refresh_page')+'</button>' +
          '</div>';
      }
    }

    // Call existing error handler if present
    if (_origOnError) _origOnError.call(this, msg, url, line, col, error);
    return true; // Suppress default error handling
  };
})();

// Auto-recover from localStorage on startup
// v1.2.1 round-9: This IIFE previously loaded recovery data and parsed it
// but the if-block body was EMPTY (dead code) — data was never applied to
// gameState/moveRecords. The save side in _installErrorBoundary (line 408)
// was therefore wasted effort. Rather than implement an unsafe late-restore
// (which would race with normal init paths and could resurrect a stale
// gameState that caused the original crash), we keep the IIFE for its
// STILL-USEFUL cleanup behavior (clearing stale recovery data after 5s if
// the engine started successfully) and document that the load-and-apply
// path is intentionally not implemented. The save side is retained as a
// diagnostic artifact — developers can inspect localStorage/Java persistent
// store after a crash to see what state triggered it.
(function _tryRecovery() {
  try {
    let saved = localStorage.getItem('Regalia_recovery');
    // v1.0.4 Round-5 Rev16: Fall back to persistent Java store if HyperOS 3 wiped localStorage
    if(!saved){
      try{if(typeof AndroidBridge!=='undefined'&&AndroidBridge.persistentGet){const persisted=AndroidBridge.persistentGet('Regalia_recovery');if(persisted){saved=persisted;try{localStorage.setItem('Regalia_recovery',persisted);}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}}}}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
    }
    if (saved) {
      // v1.2.1 round-9: Parse to validate the data shape, but do NOT apply
      // it to gameState/moveRecords — late restoration would race with the
      // normal init path and could resurrect the very state that caused the
      // original crash. The data is retained in storage for 5s (below) as a
      // diagnostic artifact, then cleared if the engine started successfully.
      let data = null;
      try { data = JSON.parse(saved); } catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
      if (data && data.gameState && Date.now() - data.timestamp < 3600000) {
        // Recovery data is valid and fresh — available for inspection via
        // DevTools if needed, but intentionally not auto-applied.
      }
      // Clear recovery data after successful load
      setTimeout(function() {
        if (typeof _engineReady !== 'undefined' && (_engineReady || document.getElementById('board-grid'))) {
          try{localStorage.removeItem('Regalia_recovery');}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
          try{if(typeof AndroidBridge!=='undefined'&&AndroidBridge.persistentRemove)AndroidBridge.persistentRemove('Regalia_recovery');}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
        }
      }, 5000);
    }
  } catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
})();

// AI-GEN: AI assisted
// This code was AI-assisted and has been reviewed for AGPL v3 compliance.
//
// v1.0.8 PHASE 22: ChessAudioEngine — personified piece-move sound engine.
// Redesigned per "国际象棋拟人化音效方案" reference. Pure Web Audio API
// synthesis (no audio files), with each piece's timbre matching its animated
// personality. Sound timing is aligned with the animation keyframe timeline.
//
// Piece timbres (matching the animation personalities):
//   pawn  (胆小 timid)      — triangle wave three-stage: hesitate-squeak, wood-tap, soft-landing
//   knight(灵活 agile)      — sine frequency sweep + crisp ding landing
//   bishop(机敏 sharp)      — sawtooth glide + bandpass filter sweep
//   rook  (生猛 fierce)     — square charge + noise dash + impact burst
//   queen (潇洒 elegant)    — three-frequency harmony + LFO vibrato + high overtone
//   king  (庄严 solemn)     — bell partials + four heavy footstep pulses
//
// Interactive sounds (selection, hint, capture, castle rook move/land,
// game-over) are also implemented. All sounds are routed through a master
// gain → dry/reverb → compressor → destination chain for spatial feel and
// anti-clipping protection.
//
// Performance & robustness:
//   - _activeNodes set tracks all live oscillators; onended auto-cleans
//   - All exponentialRampToValueAtTime targets >= 0.0001 (no NaN)
//   - Mobile unlock on first pointerdown/keydown (silent buffer activation)
//   - DynamicsCompressor prevents multi-voice clipping (threshold=-14dB)
//   - Convolution reverb impulse is generated once and shared
//   - Graceful degradation: if init() fails, all play* methods silently no-op
//
// API compatibility:
//   - playSound(type) signature preserved (type ∈ move/capture/check/castle/
//     promote/gameover/hint). Internal dispatch maps to the new engine.
//   - soundOn global + toggleSound() function + toolbar button preserved.
//   - audioEngine is the global engine instance (read by game-logic.js for
//     per-piece sound triggers during animateMove).
class ChessAudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.compressor = null;
    this.reverb = null;
    this.reverbGain = null;
    this.dryGain = null;
    this.enabled = true;
    this.volume = 0.45;
    this._noiseBuf = null;
    this._unlocked = false;
    this._activeNodes = new Set();
  }

  // ============ Initialization & routing ============

  /** Lazy init. Must be called from a user-gesture handler on mobile. */
  init() {
    if (this.ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      // Compressor: prevent multi-voice clipping
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -14;
      this.compressor.knee.value = 8;
      this.compressor.ratio.value = 4;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.12;
      // Convolution reverb: gives the board spatial depth
      this.reverb = this.ctx.createConvolver();
      this.reverb.buffer = this._createImpulse(1.4, 2.8);
      this.reverbGain = this.ctx.createGain();
      this.reverbGain.gain.value = 0.18;
      this.dryGain = this.ctx.createGain();
      this.dryGain.gain.value = 0.88;
      // Routing: master → [dry] + [reverb→reverbGain] → compressor → destination
      this.master.connect(this.dryGain);
      this.master.connect(this.reverb);
      this.reverb.connect(this.reverbGain);
      this.dryGain.connect(this.compressor);
      this.reverbGain.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);
      return true;
    } catch (e) {
      // v1.1.0 Phase 54: Reset ALL fields on partial-init failure so a retry
      // can start fresh. Previously, this.ctx stayed set after a partial
      // failure, making the early `if(this.ctx) return true` guard skip
      // re-init — permanently locking the engine in a broken state.
      console.warn('[ChessAudio] init failed:', e);
      try { if (this.ctx) this.ctx.close(); } catch(_){}
      this.ctx = null;
      this.master = null;
      this.compressor = null;
      this.reverb = null;
      this.reverbGain = null;
      this.dryGain = null;
      this._noiseBuf = null;
      return false;
    }
  }

  /**
   * Generate reverb impulse response buffer.
   * SECURITY-AUDIT (v1.2.1 round-16): Math.random() is intentionally used
   *   for audio noise synthesis (reverb impulse response). This is NOT a
   *   security-sensitive use case — uniform distribution is the only
   *   requirement, and crypto.getRandomValues() would add ~100x overhead
   *   with no security benefit for audio effects.
   */
  _createImpulse(duration, decay) {
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * duration);
    const buf = this.ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  /**
   * White-noise buffer (cached & reused).
   * SECURITY-AUDIT (v1.2.1 round-16): Math.random() is intentionally used
   *   for white-noise synthesis. Audio synthesis does not require
   *   cryptographically secure randomness — uniform distribution is the
   *   only requirement. Using crypto.getRandomValues() here would add
   *   unnecessary CPU overhead on every buffer fill.
   */
  _getNoise() {
    if (this._noiseBuf) return this._noiseBuf;
    const sr = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, Math.floor(sr * 0.8), sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this._noiseBuf = buf;
    return buf;
  }

  /** Unlock AudioContext (mobile requires this in a user gesture). */
  unlock() {
    if (!this.init()) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(function(){});
    }
    // Play a silent buffer to force activation
    const buf = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.ctx.destination);
    src.start(0);
    this._unlocked = true;
  }

  setEnabled(v) {
    this.enabled = v;
    // v1.1.0 Phase 54: Guard both master AND ctx — after a partial-init
    // failure, master is null but ctx might still be set (now fixed in init(),
    // but defensive guard remains for safety).
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(v ? this.volume : 0, this.ctx.currentTime, 0.02);
    }
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master && this.ctx && this.enabled) {
      this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
    }
  }

  now() { return this.ctx ? this.ctx.currentTime : 0; }

  // ============ Generic building blocks ============

  /** Create oscillator, connect to target, schedule start/stop. */
  _osc(type, freq, t0, dur, target) {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    osc.connect(target);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
    this._activeNodes.add(osc);
    osc.onended = () => { this._activeNodes.delete(osc); };
    return osc;
  }

  /** ADSR envelope on a gain node. */
  _env(gainNode, t0, attack, peak, decay, sustainLevel, sustainTime, release) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t0);
    g.linearRampToValueAtTime(Math.max(0.0001, peak), t0 + attack);
    g.linearRampToValueAtTime(Math.max(0.0001, peak * sustainLevel), t0 + attack + decay);
    g.setValueAtTime(Math.max(0.0001, peak * sustainLevel), t0 + attack + decay + sustainTime);
    g.exponentialRampToValueAtTime(0.0001, t0 + attack + decay + sustainTime + release);
  }

  /** Noise source + biquad filter combo. */
  _noise(t0, dur, filterType, freqStart, freqEnd, q, peak) {
    const src = this.ctx.createBufferSource();
    src.buffer = this._getNoise();
    const filt = this.ctx.createBiquadFilter();
    filt.type = filterType;
    filt.frequency.setValueAtTime(freqStart, t0);
    if (freqEnd !== freqStart) {
      filt.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
    }
    filt.Q.value = q;
    const g = this.ctx.createGain();
    src.connect(filt); filt.connect(g); g.connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
    this._env(g, t0, 0.002, peak, 0.04, 0.3, dur * 0.5, dur * 0.4);
    this._activeNodes.add(src);
    src.onended = () => { this._activeNodes.delete(src); };
    return { src: src, filt: filt, g: g };
  }

  // ============ Interactive sounds ============

  /** Selection: crisp short tone. */
  playSelect() {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.now();
    const g = this.ctx.createGain();
    g.connect(this.master);
    const osc = this._osc('sine', 880, t0, 0.1, g);
    osc.frequency.exponentialRampToValueAtTime(1320, t0 + 0.08);
    this._env(g, t0, 0.005, 0.22, 0.02, 0.4, 0.04, 0.05);
  }

  /** Hint: soft triangle wave. */
  playHint() {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.now();
    const g = this.ctx.createGain();
    g.connect(this.master);
    this._osc('triangle', 660, t0, 0.12, g);
    this._env(g, t0, 0.008, 0.1, 0.04, 0.3, 0.05, 0.06);
  }

  /** Capture: noise burst + low-freq impact. */
  playCapture() {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.now();
    this._noise(t0, 0.22, 'bandpass', 1000, 400, 0.8, 0.35);
    const g = this.ctx.createGain();
    g.connect(this.master);
    const osc = this._osc('square', 130, t0, 0.18, g);
    osc.frequency.exponentialRampToValueAtTime(55, t0 + 0.14);
    this._env(g, t0, 0.002, 0.28, 0.04, 0.3, 0.06, 0.1);
  }

  // ============ Piece-move sounds (aligned with animation timeline) ============

  /** Pawn · timid (animation 250ms in v1.0.8; reference 430ms)
   *  0ms: hesitate squeak (freq dips slightly)
   *  ~80ms: mid-section wood tap
   *  ~160ms: soft landing "da" */
  playPawn() {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.now();
    // v1.0.8 PHASE 26: pawn sound now "瑟瑟发抖" (quivering/shivering) to match
    //   the trembling animation. Three quick wavering squeaks (frequency jitter)
    //   + a soft feather-light landing. Low gain throughout (the pawn is timid).
    // Tremor squeaks: three short triangle tones with slight pitch jitter
    for (let i = 0; i < 3; i++) {
      const ts = t0 + i * 0.045;
      const g = this.ctx.createGain();
      g.connect(this.master);
      const baseFreq = 360 + i * 20;
      const o = this._osc('triangle', baseFreq, ts, 0.04, g);
      // Frequency jitter (the "发抖" quiver)
      o.frequency.setValueAtTime(baseFreq, ts);
      o.frequency.linearRampToValueAtTime(baseFreq + 15, ts + 0.01);
      o.frequency.linearRampToValueAtTime(baseFreq - 10, ts + 0.025);
      o.frequency.linearRampToValueAtTime(baseFreq + 8, ts + 0.04);
      this._env(g, ts, 0.002, 0.06, 0.01, 0.2, 0.008, 0.02);
    }
    // Soft feather-light landing (sine, low gain, quick decay)
    const tL = t0 + 0.16;
    const gL = this.ctx.createGain();
    gL.connect(this.master);
    const oL = this._osc('sine', 240, tL, 0.08, gL);
    oL.frequency.exponentialRampToValueAtTime(160, tL + 0.06);
    this._env(gL, tL, 0.002, 0.10, 0.02, 0.15, 0.02, 0.05);
  }

  /** Knight · agile (animation 380ms; reference 680ms)
   *  0ms: rising "whoosh" (300→900→600Hz)
   *  ~250ms: crisp landing "ding" (1200Hz + 2400Hz overtone) */
  playKnight() {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.now();
    // Rising whoosh
    const g1 = this.ctx.createGain();
    g1.connect(this.master);
    const o1 = this._osc('sine', 300, t0, 0.24, g1);
    o1.frequency.exponentialRampToValueAtTime(900, t0 + 0.12);
    o1.frequency.exponentialRampToValueAtTime(600, t0 + 0.22);
    this._env(g1, t0, 0.01, 0.16, 0.1, 0.5, 0.1, 0.07);
    // Crisp ding
    const t1 = t0 + 0.25;
    const g2 = this.ctx.createGain();
    g2.connect(this.master);
    this._osc('sine', 1200, t1, 0.13, g2);
    this._env(g2, t1, 0.001, 0.22, 0.05, 0.3, 0.04, 0.08);
    // High overtone
    const g3 = this.ctx.createGain();
    g3.connect(this.master);
    this._osc('sine', 2400, t1, 0.09, g3);
    this._env(g3, t1, 0.001, 0.08, 0.03, 0.2, 0.03, 0.05);
  }

  /** Bishop · sharp (animation 270ms; reference 460ms)
   *  0ms: sawtooth glide (500→1400→900Hz)
   *       lowpass filter sweep (800→3000→1200Hz, Q=6) */
  playBishop() {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.now();
    const g = this.ctx.createGain();
    g.connect(this.master);
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(500, t0);
    osc.frequency.exponentialRampToValueAtTime(1400, t0 + 0.09);
    osc.frequency.exponentialRampToValueAtTime(900, t0 + 0.25);
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(800, t0);
    filt.frequency.exponentialRampToValueAtTime(3000, t0 + 0.12);
    filt.frequency.exponentialRampToValueAtTime(1200, t0 + 0.27);
    filt.Q.value = 6;
    osc.connect(filt); filt.connect(g);
    osc.start(t0);
    osc.stop(t0 + 0.29);
    this._activeNodes.add(osc);
    osc.onended = () => { this._activeNodes.delete(osc); };
    this._env(g, t0, 0.005, 0.18, 0.05, 0.6, 0.16, 0.06);
  }

  /** Rook · fierce (animation 290ms; reference 500ms)
   *  0ms: charge low-freq (80→60Hz square)
   *  ~50ms: dash whoosh (noise + bandpass sweep 400→1500Hz)
   *  ~250ms: heavy impact (140→50Hz square + lowpass noise) */
  playRook() {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.now();
    // Charge low-freq
    const g1 = this.ctx.createGain();
    g1.connect(this.master);
    const o1 = this._osc('square', 80, t0, 0.06, g1);
    o1.frequency.linearRampToValueAtTime(60, t0 + 0.05);
    this._env(g1, t0, 0.003, 0.22, 0.04, 0.2, 0.01, 0.025);
    // Dash whoosh
    const t1 = t0 + 0.05;
    const src = this.ctx.createBufferSource();
    src.buffer = this._getNoise();
    const nf = this.ctx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.setValueAtTime(400, t1);
    nf.frequency.exponentialRampToValueAtTime(1500, t1 + 0.18);
    nf.Q.value = 2;
    const ng = this.ctx.createGain();
    src.connect(nf); nf.connect(ng); ng.connect(this.master);
    src.start(t1);
    src.stop(t1 + 0.22);
    this._env(ng, t1, 0.01, 0.14, 0.05, 0.7, 0.13, 0.05);
    this._activeNodes.add(src);
    src.onended = () => { this._activeNodes.delete(src); };
    // Heavy impact
    const t2 = t0 + 0.25;
    const g2 = this.ctx.createGain();
    g2.connect(this.master);
    const o2 = this._osc('square', 140, t2, 0.09, g2);
    o2.frequency.exponentialRampToValueAtTime(50, t2 + 0.07);
    this._env(g2, t2, 0.001, 0.38, 0.03, 0.3, 0.03, 0.06);
    this._noise(t2, 0.09, 'lowpass', 600, 300, 0.5, 0.28);
  }

  /** Queen · resounding/heavy (animation 520ms in v1.0.8; reference 740ms)
   *  v1.0.8 PHASE 26: queen sound now "铿锵有声、掷地有声" (clanking/resounding,
   *    ground-shaking) to match the heavier-than-rook animation + massive shake.
   *  0ms: low brass-like growl (110Hz sawtooth + 165Hz fifth) — the "铿锵" weight
   *  ~80ms: metallic clang (880+1320Hz square, bandpass, quick decay) — the "clank"
   *  ~400ms: massive impact (60Hz square + lowpass noise burst) — the "掷地有声" */
  playQueen() {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.now();
    // Low brass-like growl (the weight of the queen)
    const gG = this.ctx.createGain();
    gG.connect(this.master);
    const oG1 = this._osc('sawtooth', 110, t0, 0.45, gG);
    const oG2 = this._osc('sawtooth', 165, t0, 0.45, gG); // perfect fifth
    oG1.frequency.linearRampToValueAtTime(90, t0 + 0.4);
    oG2.frequency.linearRampToValueAtTime(135, t0 + 0.4);
    this._env(gG, t0, 0.03, 0.22, 0.08, 0.4, 0.3, 0.1);
    // Metallic clang (the "铿锵" clank)
    const tC = t0 + 0.08;
    const gC = this.ctx.createGain();
    gC.connect(this.master);
    const oC1 = this._osc('square', 880, tC, 0.15, gC);
    const oC2 = this._osc('square', 1320, tC, 0.12, gC);
    const fC = this.ctx.createBiquadFilter();
    fC.type = 'bandpass';
    fC.frequency.value = 1100;
    fC.Q.value = 4;
    oC1.connect(fC); oC2.connect(fC);
    fC.connect(gC);
    this._env(gC, tC, 0.001, 0.18, 0.04, 0.5, 0.08, 0.06);
    // Massive impact (the "掷地有声" ground-shaking landing) — synced with animation
    const tI = t0 + 0.42;
    const gI = this.ctx.createGain();
    gI.connect(this.master);
    const oI = this._osc('square', 60, tI, 0.12, gI);
    oI.frequency.exponentialRampToValueAtTime(35, tI + 0.10);
    this._env(gI, tI, 0.001, 0.32, 0.03, 0.4, 0.04, 0.08);
    // Lowpass noise burst for the impact "thud"
    this._noise(tI, 0.14, 'lowpass', 500, 200, 0.6, 0.3);
  }

  /** King · solemn/regal (animation 560ms in v1.0.8; reference 920ms)
   *  v1.0.8 PHASE 26: king sound now "威严庄重" (regal/majestic) to match the
   *    more solemn-than-rook animation. Deeper bell partials (90Hz fundamental),
   *    longer decay, four measured footsteps (slower, deeper — the king does
   *    not hurry). The footsteps are synced with the animation's 4-step wobble. */
  playKing() {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.now();
    // Deeper bell partials (90Hz fundamental — more regal than 110Hz)
    const partials = [
      { f: 90,  g: 0.26, d: 0.58 },
      { f: 180, g: 0.16, d: 0.46 },
      { f: 270, g: 0.09, d: 0.32 },
      { f: 360, g: 0.05, d: 0.25 },
      { f: 450, g: 0.03, d: 0.19 }
    ];
    partials.forEach((p) => {
      const g = this.ctx.createGain();
      g.connect(this.master);
      this._osc('sine', p.f, t0, p.d, g);
      this._env(g, t0, 0.06, p.g, 0.12, 0.3, p.d * 0.4, p.d * 0.4);
    });
    // Four measured footsteps (slower + deeper — synced with 560ms animation's
    // 4-step wobble at ~140ms intervals). Deeper freq (80Hz) than before (95Hz).
    for (let i = 0; i < 4; i++) {
      const t = t0 + 0.10 + i * 0.12;
      const g = this.ctx.createGain();
      g.connect(this.master);
      const osc = this._osc('sine', 80, t, 0.06, g);
      osc.frequency.exponentialRampToValueAtTime(50, t + 0.05);
      this._env(g, t, 0.002, 0.13, 0.02, 0.22, 0.015, 0.03);
    }
  }

  // ============ Castle sounds (three-stage narrative) ============
  // v1.0.8 PHASE 29: Castle rook move redesigned to be RAPID and IMPACTFUL.
  //   Previous design: a soft 200→350Hz triangle wave rising over 250ms —
  //   sounded more like a gentle slide than a decisive royal maneuver.
  //   New design: two-stage "snap + slam" within ~135ms:
  //     Stage 1 (0-45ms): sharp low-frequency impact (sine 110Hz thump +
  //                       bandpass noise crack) — the rook snapping to attention
  //     Stage 2 (45-135ms): metallic crash (sawtooth 220→80Hz down-sweep +
  //                        highpass noise burst) — the rook slamming into place
  //   The haptic feedback (CASTLE in StockfishNative.java) mirrors this:
  //     Stage 1: short intense burst (amplitude 255, 35ms)
  //     Stage 2: longer heavy rumble (amplitude 200, 60ms)
  //   Together they convey the king's decisive command and the rook's heavy
  //   obedience — "威严的迅猛".

  /** Castle rook move: rapid snap + slam (two-stage impact). */
  playCastleRookMove() {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.now();
    // Stage 1: low-freq thump (110Hz sine, 45ms) — the "snap"
    const g1 = this.ctx.createGain();
    g1.connect(this.master);
    const osc1 = this._osc('sine', 110, t0, 0.05, g1);
    osc1.frequency.exponentialRampToValueAtTime(80, t0 + 0.04);
    this._env(g1, t0, 0.001, 0.42, 0.005, 0.3, 0.01, 0.03);
    // Stage 1 companion: bandpass noise crack (1000Hz center, 35ms)
    this._noise(t0, 0.04, 'bandpass', 1800, 600, 1.2, 0.32);
    // Stage 2: metallic down-sweep (sawtooth 220→80Hz, 90ms) — the "slam"
    const t1 = t0 + 0.045;
    const g2 = this.ctx.createGain();
    g2.connect(this.master);
    const osc2 = this._osc('sawtooth', 220, t1, 0.10, g2);
    osc2.frequency.exponentialRampToValueAtTime(80, t1 + 0.08);
    this._env(g2, t1, 0.002, 0.30, 0.01, 0.4, 0.04, 0.05);
    // Stage 2 companion: highpass noise burst (2500Hz, 80ms) — metallic shimmer
    this._noise(t1, 0.08, 'highpass', 2500, 1200, 0.7, 0.22);
  }

  // (v1.0.8 PHASE 30: playCastleRookLand() removed — Phase 29 combined into playCastleRookMove.)

  /** Promotion: ascending major arpeggio (C-E-G-C). */
  playPromote() {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.now();
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      const t = t0 + i * 0.08;
      const g = this.ctx.createGain();
      g.connect(this.master);
      this._osc('sine', freq, t, 0.18, g);
      this._env(g, t, 0.005, 0.15, 0.03, 0.3, 0.06, 0.09);
    });
  }

  /** Check: attention-grabbing two-tone alert. */
  playCheck() {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.now();
    const g = this.ctx.createGain();
    g.connect(this.master);
    const osc = this._osc('sawtooth', 440, t0, 0.18, g);
    osc.frequency.setValueAtTime(554, t0 + 0.06);
    osc.frequency.setValueAtTime(659, t0 + 0.12);
    this._env(g, t0, 0.005, 0.18, 0.04, 0.4, 0.08, 0.08);
  }

  /** Game over: descending minor arpeggio (C-A-F-C low). */
  playGameover() {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.now();
    const notes = [523, 440, 349, 262];
    const durs = [0.12, 0.14, 0.18, 0.30];
    notes.forEach((freq, i) => {
      const t = t0 + (i === 0 ? 0 : [0.12, 0.26, 0.44][i - 1] || 0);
      const g = this.ctx.createGain();
      g.connect(this.master);
      this._osc('sine', freq, t, durs[i], g);
      this._env(g, t, 0.01, 0.20, 0.04, 0.3, durs[i] * 0.4, durs[i] * 0.5);
    });
  }

  /** Stop all active nodes immediately. */
  stopAll() {
    if (!this.ctx) return;
    this._activeNodes.forEach(function(node) {
      try { node.stop(); } catch (e) {}
    });
    this._activeNodes.clear();
  }

  // ============ v1.0.8 PHASE 22 (supplement): Scene / interaction sounds ============
  //延续拟人化音效风格：每个音效都用 Web Audio API 纯合成，与棋子音效共享
  //   同一套路由链（master → dry+reverb → compressor → destination）。音色设计
  //   遵循「典雅庄重」美学——金色调 + 木质质感 + 空间混响。
  // Note: playSelect / playHint / playCapture 等已在上方"Interactive sounds"段定义。

  /** 取消选中：下行短音（选中音的逆行）。 */
  playDeselect() {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.now();
    const g = this.ctx.createGain();
    g.connect(this.master);
    const osc = this._osc('sine', 880, t0, 0.08, g);
    osc.frequency.exponentialRampToValueAtTime(560, t0 + 0.06);
    this._env(g, t0, 0.005, 0.16, 0.02, 0.4, 0.03, 0.04);
  }

  /** 悔棋：逆向回旋音（高→低，体现"撤回"）。 */
  playUndo() {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.now();
    const g = this.ctx.createGain();
    g.connect(this.master);
    const osc = this._osc('triangle', 660, t0, 0.18, g);
    osc.frequency.exponentialRampToValueAtTime(330, t0 + 0.14);
    this._env(g, t0, 0.005, 0.18, 0.04, 0.4, 0.06, 0.08);
  }

  /** 撤悔：正向回旋音（低→高，体现"重做"）。 */
  playRedo() {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.now();
    const g = this.ctx.createGain();
    g.connect(this.master);
    const osc = this._osc('triangle', 330, t0, 0.18, g);
    osc.frequency.exponentialRampToValueAtTime(660, t0 + 0.14);
    this._env(g, t0, 0.005, 0.18, 0.04, 0.4, 0.06, 0.08);
  }

  /** 翻转棋盘：嗖声（带通滤波器扫频，体现"旋转"）。 */
  playFlip() {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.now();
    const g = this.ctx.createGain();
    g.connect(this.master);
    const osc = this._osc('sawtooth', 200, t0, 0.22, g);
    osc.frequency.exponentialRampToValueAtTime(800, t0 + 0.10);
    osc.frequency.exponentialRampToValueAtTime(200, t0 + 0.20);
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(400, t0);
    filt.frequency.exponentialRampToValueAtTime(2000, t0 + 0.10);
    filt.frequency.exponentialRampToValueAtTime(400, t0 + 0.20);
    filt.Q.value = 3;
    osc.disconnect();
    osc.connect(filt);
    filt.connect(g);
    this._env(g, t0, 0.01, 0.14, 0.05, 0.5, 0.08, 0.08);
  }

  /** 新游戏开始：号角式三音和弦（C-E-G，庄重开局）。 */
  playNewGame() {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.now();
    const notes = [392, 523, 659]; // G-C-E (号角感)
    notes.forEach((freq, i) => {
      const t = t0 + i * 0.04;
      const g = this.ctx.createGain();
      g.connect(this.master);
      this._osc('triangle', freq, t, 0.30, g);
      this._env(g, t, 0.02, 0.16, 0.06, 0.5, 0.12, 0.12);
    });
  }

  /** 进入复盘：沉思音（低频钟声 + 混响，体现"回顾"）。 */
  playEnterReview() {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.now();
    const g = this.ctx.createGain();
    g.connect(this.master);
    this._osc('sine', 220, t0, 0.50, g);
    this._env(g, t0, 0.05, 0.20, 0.10, 0.4, 0.20, 0.20);
    const g2 = this.ctx.createGain();
    g2.connect(this.master);
    this._osc('sine', 330, t0 + 0.08, 0.40, g2);
    this._env(g2, t0 + 0.08, 0.05, 0.12, 0.08, 0.4, 0.16, 0.16);
  }

  /** 退出复盘：归位音（上行二音，体现"返回"）。 */
  playExitReview() {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.now();
    const g1 = this.ctx.createGain();
    g1.connect(this.master);
    this._osc('sine', 330, t0, 0.12, g1);
    this._env(g1, t0, 0.01, 0.16, 0.03, 0.4, 0.05, 0.05);
    const g2 = this.ctx.createGain();
    g2.connect(this.master);
    this._osc('sine', 440, t0 + 0.08, 0.15, g2);
    this._env(g2, t0 + 0.08, 0.01, 0.18, 0.03, 0.4, 0.06, 0.06);
  }

  /** 进入/退出摆棋：木质放置音（短促三角波，体现"摆放棋子"）。 */
  playSetupToggle() {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.now();
    const g = this.ctx.createGain();
    g.connect(this.master);
    const osc = this._osc('triangle', 180, t0, 0.06, g);
    osc.frequency.exponentialRampToValueAtTime(120, t0 + 0.04);
    this._env(g, t0, 0.002, 0.20, 0.02, 0.3, 0.02, 0.03);
  }

  /** 认输：降旗音（下行三音，庄重而哀伤）。 */
  playResign() {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.now();
    const notes = [440, 349, 262]; // A-F-C
    const durs = [0.18, 0.22, 0.40];
    notes.forEach((freq, i) => {
      const t = t0 + (i === 0 ? 0 : [0.18, 0.40][i - 1] || 0);
      const g = this.ctx.createGain();
      g.connect(this.master);
      this._osc('sine', freq, t, durs[i], g);
      this._env(g, t, 0.02, 0.18, 0.05, 0.3, durs[i] * 0.4, durs[i] * 0.5);
    });
  }

  /** 复制成功：清脆叮声（高频正弦波短促上行）。 */
  playCopy() {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.now();
    const g = this.ctx.createGain();
    g.connect(this.master);
    const osc = this._osc('sine', 1200, t0, 0.08, g);
    osc.frequency.exponentialRampToValueAtTime(1800, t0 + 0.05);
    this._env(g, t0, 0.002, 0.16, 0.02, 0.3, 0.03, 0.04);
  }

  /** 操作错误：低沉错误音（方波下行 + 噪声爆破）。 */
  playError() {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.now();
    const g = this.ctx.createGain();
    g.connect(this.master);
    const osc = this._osc('square', 220, t0, 0.15, g);
    osc.frequency.exponentialRampToValueAtTime(110, t0 + 0.10);
    this._env(g, t0, 0.003, 0.20, 0.04, 0.3, 0.05, 0.07);
    this._noise(t0, 0.08, 'bandpass', 800, 400, 1.5, 0.12);
  }

  /** AI 开始思考：轻微滴声（短促高频，体现"引擎启动"）。 */
  playAiThinkStart() {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.now();
    const g = this.ctx.createGain();
    g.connect(this.master);
    this._osc('sine', 1000, t0, 0.05, g);
    this._env(g, t0, 0.002, 0.10, 0.01, 0.3, 0.02, 0.02);
  }

  /** AI 找到走法：轻微答声（中频双音，体现"有了"）。 */
  playAiThinkEnd() {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.now();
    const g1 = this.ctx.createGain();
    g1.connect(this.master);
    this._osc('sine', 600, t0, 0.06, g1);
    this._env(g1, t0, 0.002, 0.12, 0.02, 0.3, 0.02, 0.03);
    const g2 = this.ctx.createGain();
    g2.connect(this.master);
    this._osc('sine', 800, t0 + 0.04, 0.06, g2);
    this._env(g2, t0 + 0.04, 0.002, 0.10, 0.02, 0.3, 0.02, 0.03);
  }

  /** Release resources. */
  dispose() {
    this.stopAll();
    if (this.ctx) {
      this.ctx.close().catch(function(){});
      this.ctx = null;
    }
  }
}

// v1.0.8 PHASE 22: Global audio engine instance.
// Lazy-initialized on first user gesture (see _unlockAudio below).
let audioEngine = null;
function _ensureAudioEngine() {
  if (audioEngine) return audioEngine;
  try {
    audioEngine = new ChessAudioEngine();
  } catch (e) {
    audioEngine = null;
  }
  return audioEngine;
}

// v1.0.8 PHASE 22: Unlock audio on first user gesture (mobile requirement).
// Attached as one-shot listeners on pointerdown/keydown. After unlock, the
// engine is ready for all subsequent playSound calls.
function _unlockAudio() {
  const eng = _ensureAudioEngine();
  if (eng) eng.unlock();
  document.removeEventListener('pointerdown', _unlockAudio);
  document.removeEventListener('keydown', _unlockAudio);
}
document.addEventListener('pointerdown', _unlockAudio, { once: false, passive: true });
document.addEventListener('keydown', _unlockAudio, { once: false });

// v1.0.8 PHASE 22: playSound(type) — preserved signature for ui.js callers.
// Maps the legacy 7 sound types + v1.0.8 supplement scene sounds to the new
// personified engine. For 'move', the actual piece-type sound is triggered by
// game-logic.js's animateMove via audioEngine.play<pieceType>() — this 'move'
// case is a fallback for any caller that doesn't go through animateMove.
// v1.0.8 supplement: added deselect/undo/redo/flip/newgame/enterReview/
//   exitReview/setupToggle/resign/copy/error/aiThinkStart/aiThinkEnd.
function playSound(type) {
  if (!soundOn) return;
  const eng = _ensureAudioEngine();
  if (!eng) return;
  try {
    switch (type) {
      case 'move':         eng.playPawn();          break; // fallback (animateMove triggers per-piece)
      case 'capture':      eng.playCapture();       break;
      case 'check':        eng.playCheck();         break;
      case 'castle':       eng.playCastleRookMove();break;
      case 'promote':      eng.playPromote();       break;
      case 'gameover':     eng.playGameover();      break;
      case 'hint':         eng.playHint();          break;
      case 'select':       eng.playSelect();        break;
      case 'deselect':     eng.playDeselect();      break;
      case 'undo':         eng.playUndo();          break;
      case 'redo':         eng.playRedo();          break;
      case 'flip':         eng.playFlip();          break;
      case 'newgame':      eng.playNewGame();       break;
      case 'enterReview':  eng.playEnterReview();   break;
      case 'exitReview':   eng.playExitReview();    break;
      case 'setupToggle':  eng.playSetupToggle();   break;
      case 'resign':       eng.playResign();        break;
      case 'copy':         eng.playCopy();          break;
      case 'error':        eng.playError();         break;
      case 'aiThinkStart': eng.playAiThinkStart();  break;
      case 'aiThinkEnd':   eng.playAiThinkEnd();    break;
      default: break;
    }
  } catch (e) {}
}

// v1.0.8 PHASE 22: Close audio context on page unload (resource cleanup).
window.addEventListener('beforeunload', function() {
  if (audioEngine) {
    try { audioEngine.dispose(); } catch (e) {}
    audioEngine = null;
  }
});



// ECO UI helper functions — already defined in game-logic.js with correct const declarations.

// ===================== PHASE 18 TASK 2: VIRTUAL LIST HELPERS =====================
// v1.0.8 PHASE 18 Task 2: Virtual list helpers for the review move list.
// These are module-level so they can be called from render() (full rebuild),
// from _refreshReviewMovesOnly() (scroll-driven partial refresh), and from
// reviewGoTo() (force window to contain the new active step).
//
// The helpers operate on the module-level _rvVirtualState and read
// moveRecords / reviewStep / reviewCritical directly. They are NO-OPs when
// the virtual list is disabled (moveRecords.length <= RV_VIRTUAL_THRESHOLD).

// Reset virtual state. Called from enterReview/exitReview/startGame/_doPastePGN
// so each new review session starts with a fresh window.
function _resetRvVirtualState(){
  _rvVirtualState.avgRowH=44;
  _rvVirtualState.scrollTop=0;
  _rvVirtualState.windowStart=0;
  _rvVirtualState.windowEnd=Infinity;
  _rvVirtualState.measured=false;
  _rvVirtualState.enabled=false;
  if(_rvScrollRefreshTimer){clearTimeout(_rvScrollRefreshTimer);_rvScrollRefreshTimer=0;}
}

// v1.1.0 Phase 54 rev14: _computeVirtualWindow removed (dead code after
//   virtual list disabled). When virtual list is off, the full range
//   [0, moveRecords.length) is always used.

// Build the inner HTML for the review move list, rendering only rows in
// [startIdx, endIdx). When the virtual list is enabled, top/bottom spacer
// <div>s are added so the total scroll height matches the full list.
//
// This function is the SINGLE SOURCE OF TRUTH for review-moves row rendering
// — it replaces the two duplicated for-loops that previously existed in the
// landscape and portrait branches of render(). Both branches now call this
// helper, eliminating ~40 lines of code duplication.
function _buildReviewMovesInnerHTML(startIdx,endIdx){
  // v1.1.0 Phase 54 rev14: Virtual list disabled — spacers never render.
  const _end=Math.min(endIdx,moveRecords.length);
  const _start=Math.max(0,Math.min(startIdx,_end));
  let h='';
  // Critical-move lookup tables (computed once, used for every row).
  const _criticalSteps=new Set(reviewCritical.map(c=>c.step));
  const _criticalReasons=new Map();
  reviewCritical.forEach(c=>_criticalReasons.set(c.step,c.reason));
  // v1.0.3: Use _importedStartMoveNum offset for move-pair display numbering.
  const _rvMvStartOffset=(typeof _importedStartMoveNum!=='undefined'&&_importedStartMoveNum>0)?_importedStartMoveNum:1;
  for(let i=_start;i<_end;i++){
    const mr=moveRecords[i];const isW=i%2===0;const moveNum=Math.floor(i/2)+_rvMvStartOffset;
    if(mr===null){
      h+='<div class="rmv-block" style="opacity:.5" data-step="'+(i+1)+'"><span class="rmv-num">'+(isW?moveNum+'.':'')+'</span><div class="rmv-detail"><span class="rmv-notation" style="font-style:italic">...</span></div></div>';
      continue;
    }
    const isAct=reviewStep===i+1;
    const isCritical=_criticalSteps.has(i+1);
    // v1.1.2 Phase 68 (Issue 30 P2): Add long-press handler to prioritize
    //   this step's eval during an active analyze-all batch. The handler is
    //   attached via oncontextmenu (right-click / long-press on Android) —
    //   this is the most reliable cross-platform long-press signal in WebView
    //   (touchstart-based timers conflict with the existing board long-press
    //   handler in the global touchstart listener). Returning false prevents
    //   the default context menu.
    const criticalFlag=isCritical?' style="border-left:3px solid var(--accent2);padding-left:7px"':'';
    h+='<div class="rmv-block'+(isAct?' act':'')+'" onclick="reviewGoTo('+(i+1)+')" oncontextmenu="_prioritizeReviewStep('+(i+1)+');return false" data-step="'+(i+1)+'"'+criticalFlag+'>';
    h+='<span class="rmv-num">'+(isW?moveNum+'.':'')+'</span>';
    h+='<div class="rmv-detail"><span class="rmv-notation">'+_esc(mr.notation)+'</span>';
    if(isCritical&&_criticalReasons.has(i+1)){h+='<span style="font-size:.65rem;color:var(--accent);display:block;margin-top:1px">'+_criticalReasons.get(i+1)+'</span>';}
    if(showVariations&&mr.variations&&mr.variations.length>0){h+=_formatVariationGroups(mr.variations,moveNum,isW);}
    const _mvEval=_reviewEvalCache.peek(i+1);
    const _prevMvEval=_reviewEvalCache.peek(i);
    if(_mvEval!=null&&_prevMvEval!=null){
      h+=_formatEvalDelta(_mvEval.eval,_prevMvEval.eval,'.6rem');
      const _mvDelta=_mvEval.eval-_prevMvEval.eval;
      const _isMoverWhite=(i%2)===0;
      const _mcls=_classifyMove(_mvDelta,_isMoverWhite);
      h+=`<span style="font-size:.6rem;font-weight:700;color:${_esc(_mcls.color)};margin-left:4px">${_esc(_mcls.label)}</span>`;
    }
    h+='</div></div>';
  }
  return h;
}

// v1.1.0 Phase 54 rev14: Virtual list scroll-driven refresh functions removed.
//   _suppressScrollRefresh, _refreshReviewMovesOnly, _onReviewMovesScroll,
//   _forceReviewWindowToStep were all dead code after RV_VIRTUAL_THRESHOLD=Infinity.
//   The virtual list is disabled — all moves are always in the DOM, so there's
//   no need for scroll-driven partial refresh, window forcing, or suppression
//   guards. These functions caused numerous bugs (pull-back, selection loss,
//   >90 steps revert) and are now eliminated at the source.

// ===================== KNOWLEDGE ====================
// P2 PERF: ECO_OPENINGS is lazily parsed on first access to avoid blocking main thread
// during initial page load. The JSON string (~125KB) is parsed only when first needed.
// ===================== EVAL TREND CHART =====================
/**
 * v1.2.3 (S2703 fix): Shared review-chart height formula, extracted to top
 *   level. Previously _refreshEvalTrendChart referenced `_trendH`, which is a
 *   const LOCAL to _renderReviewMode — an undeclared global in this scope.
 *   The reference was only reached when the container had zero layout height
 *   (clientHeight falsy), producing a latent ReferenceError on that path.
 *   Formula mirrors the render path: landscape 120-200px (30% of height-28),
 *   portrait 100-120px (18% of height-200).
 */
function _computeTrendChartHeight(){
  return window.innerWidth > window.innerHeight
    ? Math.max(120, Math.min(200, Math.floor((window.innerHeight - 28) * 0.30)))
    : Math.max(100, Math.min(120, Math.floor((window.innerHeight - 200) * 0.18)));
}
/**
 * v1.1.1 Phase 59 Task 59.3: Lightweight refresh of the eval trend chart's
 *   SVG content without triggering a full render(). Called from onEngineEval
 *   when a stale callback (e.g. step 0's eval) gets cached — the chart
 *   previously didn't update until the next full render, leaving step 0's
 *   data point missing. This function rebuilds the SVG from the current
 *   _reviewEvalCache and replaces the .review-chart container's innerHTML.
 *   Safe to call when not in review mode or when the chart container
 *   doesn't exist (no-op).
 */
function _refreshEvalTrendChart(){
  if(!reviewMode||!reviewStates||reviewStates.length<2)return;
  const _container=document.querySelector('.review-chart');
  if(!_container)return;
  // Measure the container's current pixel width (same logic as the render path)
  let _w=Math.max(120,window.innerWidth-28);
  const _actualW=_container.clientWidth;
  if(_actualW>0)_w=_actualW;
  const _h=_container.clientHeight||_computeTrendChartHeight();
  // Rebuild the SVG
  const _svg=_buildEvalTrendSVG(_w,_h);
  if(_svg){
    _container.innerHTML=_svg;
  }
}

/**
 * Build an SVG evaluation trend chart for review mode.
 * v1.1.0 Phase 54 rev11: Uses preserveAspectRatio="xMidYMid slice" with a
 *   DYNAMIC viewBox that matches the container's pixel aspect ratio. The
 *   viewBox is "0 0 <width> <height>" where width is measured from the
 *   existing .review-chart container (or estimated on first render) and
 *   height is _trendH. Since the viewBox aspect ratio matches the container,
 *   "slice" scales 1:1 with NO cropping and NO centering gaps. Data points
 *   at x=0 and x=width are at the left/right edges (clipped by overflow:hidden
 *   for symmetric edge alignment with the slider).
 * @param {number} trendW - Chart width in pixels (measured from container)
 * @param {number} trendH - Chart height in pixels
 * @returns {string} SVG string for the eval trend chart
 */
// v1.2.0 Phase 76+: Extracted chart color reading from _buildEvalTrendSVG.
function _getChartColors(){
  const _cs = getComputedStyle(document.documentElement);
  return {
    line: _cs.getPropertyValue('--chart-line').trim() || '#5dade2',
    fill: _cs.getPropertyValue('--chart-fill').trim() || '#e74c3c',
    grid: _cs.getPropertyValue('--chart-grid').trim() || '#4a3020',
    axis: _cs.getPropertyValue('--chart-axis').trim() || '#8a6a3a',
    stroke: _cs.getPropertyValue('--chart-text-stroke').trim() || '#1a0a0a',
    critical: _cs.getPropertyValue('--chart-critical').trim() || '#ffd700',
    label: _cs.getPropertyValue('--chart-label').trim() || '#f5e6c8'
  };
}

// v1.2.0 Phase 76+: Extracted grid-line rendering.
function _buildEvalTrendGrid(svg, colors, width, height, padding, midY, _reviewEvalGlobal, reviewStates, stepToX){
  svg += '<line x1="' + padding.left + '" y1="' + midY + '" x2="' + (width - padding.right) + '" y2="' + midY + '" stroke="'+colors.axis+'" stroke-width="0.5" stroke-dasharray="2,2"/>';
  if (_reviewEvalGlobal && reviewStates.length > 2) {
    for (let i = 0; i < reviewStates.length; i++) {
      const x = stepToX(i);
      svg += '<line x1="' + x.toFixed(1) + '" y1="' + padding.top + '" x2="' + x.toFixed(1) + '" y2="' + (height - padding.bottom) + '" stroke="'+colors.grid+'" stroke-width="0.3"/>';
    }
  }
  return svg;
}

// v1.2.0 Phase 76+: Extracted line-segment rendering with color-by-sign.
function _buildEvalTrendSegments(svg, colors, points, stepToX, evalToY, _reviewEvalGlobal){
  for (let i = 1; i < points.length; i++) {
    const p0 = points[i-1];
    const p1 = points[i];
    const x0 = stepToX(p0.step);
    const y0 = evalToY(p0.eval);
    const x1 = stepToX(p1.step);
    const y1 = evalToY(p1.eval);
    const avgEval = (p0.eval + p1.eval) / 2;
    let strokeColor;
    if (p0.eval * p1.eval < 0) {
      strokeColor = colors.axis;
    } else if (avgEval > 0) {
      strokeColor = colors.line;
    } else if (avgEval < 0) {
      strokeColor = colors.fill;
    } else {
      strokeColor = colors.axis;
    }
    svg += '<line x1="' + x0.toFixed(1) + '" y1="' + y0.toFixed(1) + '" x2="' + x1.toFixed(1) + '" y2="' + y1.toFixed(1) + '" stroke="' + strokeColor + '" stroke-width="1.5" stroke-linecap="round"/>';
    // In global mode: fill gaps with interpolated dots
    if (_reviewEvalGlobal && p1.step - p0.step > 1) {
      for (let s = p0.step + 1; s < p1.step; s++) {
        const t = (s - p0.step) / (p1.step - p0.step);
        const interpEval = p0.eval + (p1.eval - p0.eval) * t;
        const sx = stepToX(s);
        const sy = evalToY(interpEval);
        svg += '<circle cx="' + sx.toFixed(1) + '" cy="' + sy.toFixed(1) + '" r="1" fill="' + (interpEval > 0 ? colors.line+'44' : colors.fill+'44') + '"/>';
      }
    }
  }
  return svg;
}

// v1.2.0 Phase 76+: Extracted data-point circle rendering.
function _buildEvalTrendPoints(svg, colors, points, stepToX, evalToY){
  for (const p of points) {
    const x = stepToX(p.step);
    const y = evalToY(p.eval);
    let fillColor, strokeColor;
    if (p.eval > 0) {
      fillColor = colors.line;
      strokeColor = colors.stroke;
    } else if (p.eval < 0) {
      fillColor = colors.fill;
      strokeColor = colors.stroke;
    } else {
      fillColor = colors.axis;
      strokeColor = colors.axis;
    }
    svg += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="2.5" fill="' + fillColor + '" stroke="' + strokeColor + '" stroke-width="0.5"/>';
  }
  return svg;
}

// v1.2.0 Phase 76+: Extracted label rendering with two-pass overlap prevention.
function _buildEvalTrendLabels(svg, colors, points, stepToX, evalToY, width, height, reviewStep){
  // Pass 1: Collect candidates with priority
  const candidates = [];
  for (const p of points) {
    const x = stepToX(p.step);
    const y = evalToY(p.eval);
    const ev = _reviewEvalCache.peek(p.step);
    const isCurrentStep = (p.step === reviewStep);
    if (!ev) continue;
    let label = '', textColor = colors.label, fontSize = 6.5, fontWeight = '';
    let labelY;
    if (Math.abs(ev.eval) >= 90000) {
      const md = ev.mate != null ? ev.mate : (ev.mateDistance != null ? ev.mateDistance : 0);
      if (md !== 0 || Math.abs(ev.eval) >= 99999) {
        label = md > 0 ? '#+' + Math.abs(md) : md < 0 ? '#-' + Math.abs(md) : (ev.eval > 0 ? '#+' : '#-');
        textColor = colors.critical;
        fontSize = 7;
        fontWeight = ' font-weight="bold"';
        const extraY = isCurrentStep ? 4 : 0;
        labelY = (p.eval > 0) ? Math.min(y + 12 + extraY, height - 2) : Math.max(y - 4 - extraY, 9);
      }
    } else {
      const cpVal = ev.eval || 0;
      const displayEval = (cpVal / 100).toFixed(cpVal % 100 === 0 ? 0 : 1);
      const sign = cpVal > 0 ? '+' : '';
      label = sign + displayEval;
      textColor = colors.label;
      const extraY = isCurrentStep ? 3 : 0;
      labelY = (p.eval > 0) ? Math.min(y + 11 + extraY, height - 2) : Math.max(y - 3 - extraY, 9);
    }
    if (label) {
      const estHalfW = fontSize * label.length * 0.32;
      const clampedX = Math.max(estHalfW, Math.min(x, width - estHalfW));
      candidates.push({
        x: clampedX, y: labelY,
        label, textColor, fontSize, fontWeight,
        priority: isCurrentStep ? 3 : (Math.abs(ev.eval) >= 90000 ? 2 : 1),
        step: p.step
      });
    }
  }
  // Pass 2: Render with overlap prevention
  candidates.sort((a, b) => b.priority - a.priority);
  const placed = [];
  const minGapX = 36, minGapY = 10;
  for (const cand of candidates) {
    let overlaps = false;
    for (const p of placed) {
      if (Math.abs(cand.x - p.x) < minGapX && Math.abs(cand.y - p.y) < minGapY) {
        overlaps = true;
        break;
      }
    }
    if (!overlaps) placed.push(cand);
  }
  placed.sort((a, b) => a.step - b.step);
  for (const lbl of placed) {
    svg += '<text x="' + lbl.x.toFixed(1) + '" y="' + lbl.y.toFixed(1) + '" fill="' + lbl.textColor + '" font-size="' + lbl.fontSize + '"' + lbl.fontWeight + ' font-family="sans-serif" text-anchor="middle" paint-order="stroke" stroke="'+colors.stroke+'" stroke-width="2">' + lbl.label + '</text>';
  }
  return svg;
}

// v1.2.0 Phase 76+: Extracted current-position marker rendering.
function _buildEvalTrendCurrentMarker(svg, colors, reviewStep, reviewStates, stepToX, evalToY){
  if (reviewStep < 0 || reviewStep >= reviewStates.length) return svg;
  const curEv = _reviewEvalCache.get(reviewStep);
  if (curEv == null) return svg;
  const cx = stepToX(reviewStep);
  const cy = evalToY(curEv.eval);
  svg += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="4" fill="none" stroke="'+colors.critical+'" stroke-width="1.5"/>';
  return svg;
}

function _buildEvalTrendSVG(trendW, trendH) {
  if (!reviewStates || reviewStates.length < 2) return '';
  if (!trendW || trendW < 10) trendW = 300;
  if (!trendH || trendH < 10) trendH = 120;
  const width = trendW;
  const height = trendH;
  const colors = _getChartColors();
  const padding = {top: 12, right: 0, bottom: 4, left: 0};
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const midY = padding.top + chartH / 2;
  const maxEval = 10;
  function evalToY(ev) {
    const clamped = Math.max(-maxEval, Math.min(maxEval, ev / 100));
    return midY - (clamped / maxEval) * (chartH / 2);
  }
  // Determine visible window (local vs global mode)
  let localStepMin = 0, localStepMax = reviewStates.length - 1;
  let displayStepCount = reviewStates.length;
  if (!_reviewEvalGlobal) {
    const windowSize = Math.min(15, reviewStates.length);
    localStepMax = reviewStep;
    localStepMin = Math.max(0, localStepMax - windowSize + 1);
    displayStepCount = localStepMax - localStepMin + 1;
  }
  function stepToX(step) {
    if (_reviewEvalGlobal) {
      if (reviewStates.length <= 1) return padding.left + chartW / 2;
      return padding.left + (step / (reviewStates.length - 1)) * chartW;
    } else {
      const idx = step - localStepMin;
      const count = Math.max(1, displayStepCount);
      if (count <= 1) return padding.left + chartW;
      return padding.left + (idx / (count - 1)) * chartW;
    }
  }
  // Collect eval data points
  const points = [];
  for (let i = localStepMin; i <= localStepMax; i++) {
    const ev = _reviewEvalCache.peek(i);
    if (ev != null) {
      points.push({step: i, eval: ev.eval || 0, mate: ev.mate, mateDistance: ev.mateDistance});
    }
  }
  if (points.length < 1) return '';
  // Build SVG using sub-functions
  let svg = '<svg width="100%" height="100%" viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="xMidYMid slice" style="display:block;overflow:hidden">';
  svg = _buildEvalTrendGrid(svg, colors, width, height, padding, midY, _reviewEvalGlobal, reviewStates, stepToX);
  svg = _buildEvalTrendSegments(svg, colors, points, stepToX, evalToY, _reviewEvalGlobal);
  svg = _buildEvalTrendPoints(svg, colors, points, stepToX, evalToY);
  if (!_reviewEvalGlobal) {
    svg = _buildEvalTrendLabels(svg, colors, points, stepToX, evalToY, width, height, reviewStep);
  }
  svg = _buildEvalTrendCurrentMarker(svg, colors, reviewStep, reviewStates, stepToX, evalToY);
  svg += '</svg>';
  return svg;
}
function posDesc(ev){if(ev>600)return T('you_winning');if(ev>350)return T('huge_adv');if(ev>150)return T('advantage');if(ev>50)return T('slight_adv');if(ev>-50)return T('equal_pos');if(ev>-150)return T('slight_dis');if(ev>-350)return T('disadvantage');if(ev>-600)return T('huge_dis');return T('you_losing')}

// Helper: get position of king that is currently in check, or null (eliminates 3x duplication)
function getCheckKingPos(s){
  if(gameOver||setupMode)return null;
  const k=s.currentTurn==='white'?s.wk:s.bk;
  return(k&&inCheck(s.board,s.currentTurn,k))?k:null;
}

// Helper: format eval display as {emoji, desc, score} — shared by render and _updateEvalDisplay
// _sfEval is always from White's perspective (converted in onEngineEval).
// score: displayed from White's perspective (+/- pawn units)
// emoji/desc: from the player's perspective via evP
function formatEval(){
  if(gameOver&&!reviewMode){
    // v1.2.3 P1 (Round 18 i18n-P1-2): Rely solely on _gameOverStatusKey for
    //   branching. The previous code also did `gameOver.includes('将杀')` /
    //   `.includes('Checkmate')` as a fallback, which breaks when the UI is
    //   English (gameOver would say "Checkmate!", not "将杀!") and silently
    //   fell through to the wrong branch. _gameOverStatusKey is the language-
    //   independent status set by _applyGameOver() / _gameOverStrFromStatus(),
    //   so it is the authoritative source.
    if(_gameOverStatusKey==='checkmate'){
      const whiteWins=gameOver.includes(T('white_wins'))||gameOver.includes('White wins');
      const playerWins=(playerColor==='white')===whiteWins;
      // Checkmate already on the board — show mate distance if available
      // v1.2.1 round-12 (S3358): refactored nested ternary into if/else for clarity.
      const md=Math.abs(_sfMateDistance||0);
      const mateSign=whiteWins?'+':'-';
      const mateStr=md>0?('#'+mateSign+md):('#'+mateSign);
      return{emoji:playerWins?'🏆':'💀',desc:playerWins?T('winning'):T('losing'),score:mateStr};
    }
    // v1.0.4 LATEST FIX: timeout win was incorrectly showing as draw (🤝).
    // The timeout case has _gameOverStatusKey==='timeout' and gameOver text
    // like "白方超时胜" / "White wins by timeout". Detect it and show the
    // correct win/lose emoji (🏆/💀) instead of the draw emoji (🤝).
    // v1.0.4 Rev46: changed eval bar emoji from 🏆/💀 to ⌛ for timeout —
    // the game-over overlay also shows ⌛ for timeout (not 🤝).
    if(_gameOverStatusKey==='timeout'){
      const whiteWins=gameOver.includes(T('white_wins'))||gameOver.includes('White wins')||gameOver.includes(T('white_short'));
      const playerWins=(playerColor==='white')===whiteWins;
      return{emoji:'⌛',desc:playerWins?T('winning'):T('losing'),score:playerWins?'+∞':'-∞'};
    }
    // v1.0.4 FIX: resignation also needs win/lose emoji, not draw.
    if(_gameOverStatusKey==='resign'){
      // v1.0.4 Rev27: Use _resignWinnerColor directly (set by _resignGame()).
      // The gameOver text only contains "resigns", not "wins", so the old
      // .includes('White wins') check always returned false — making the
      // player always appear to lose even when they won (e.g. AI resigns).
      const whiteWins=(typeof _resignWinnerColor!=='undefined'&&_resignWinnerColor==='white');
      const playerWins=(playerColor==='white')===whiteWins;
      return{emoji:playerWins?'🏆':'💀',desc:playerWins?T('winning'):T('losing'),score:playerWins?'+∞':'-∞'};
    }
    // Genuine draws (stalemate, 50-move, repetition, insufficient material, agreement)
    return{emoji:'🤝',desc:T('draw_game'),score:'0.0'};
  }
  // v1.0.4 ROUND-5 REV15: In review mode, check cache FIRST before showing "analyzing".
  // If the cache has the eval for the current reviewStep, return it immediately —
  // don't show "analyzing" even if _evalLoading is true (e.g. from a stale debounce
  // timer or a race condition between reviewGoTo and render throttle).
  if(reviewMode&&reviewStep!==undefined&&_reviewEvalCache !== undefined){
    const cachedReview=_reviewEvalCache.peek(reviewStep);
    if(cachedReview!=null){
      const evP=playerColor==='white'?cachedReview.eval:-cachedReview.eval;
      if(Math.abs(cachedReview.eval)>=90000){
        const md=cachedReview.mate!=null?cachedReview.mate:0;
        const mateLabel=md>0?'#+'+Math.abs(md):md<0?'#-'+Math.abs(md):(cachedReview.eval>0?'#+':'#-');
        return{emoji:posEmoji(evP),desc:posDesc(evP),score:mateLabel};
      }
      return{emoji:posEmoji(evP),desc:posDesc(evP),score:(evP/100).toFixed(2)};
    }
  }
  if(_evalLoading||!_sfEvalReady)return{emoji:'🔬',desc:T('analyzing_ellipsis'),score:'--'};
  const evP=playerColor==='white'?_sfEval:-_sfEval;
  if(Math.abs(_sfEval)>=90000){
    // Show mate distance — White's perspective: #+N means White forces mate, #-N means Black forces mate
    const _absMd=Math.abs(_sfMateDistance||0);
    const mateLabel=_sfMateDistance>0?'#+'+Math.abs(_sfMateDistance):_sfMateDistance<0?'#-'+Math.abs(_sfMateDistance):(_sfEval>0?'#+':'#-');
    return{emoji:posEmoji(evP),desc:posDesc(evP),score:mateLabel};
  }
  const raw=_sfEval/100;
  let s=raw.toFixed(1);
  if(s==='0.0'||s==='+0.0'||s==='-0.0')s='0.0';
  else if(raw>0)s='+'+s;
  return{emoji:posEmoji(evP),desc:posDesc(evP),score:s};
}

// Helper: convert game status string to game-over display text
function _gameOverStrFromStatus(st){
if(st==='checkmate'){const w=gameState.currentTurn==='white'?T('black_side'):T('white_short');return T('checkmate_excl')+w+T('wins_excl');}
// Note: _gameOverStrFromStatus already returns 'Checkmate!' with capital C;
if(st==='draw_stalemate')return T('stalemate');
if(st==='draw_50move')return T('fifty_move_draw');
if(st==='draw_75move')return T('seventy_five_move_draw');
if(st==='draw_repetition')return T('threefold_draw');
if(st==='draw_5fold')return T('fivefold_draw');
if(st==='draw_insufficient')return T('insufficient_draw');
// v1.0.4 Rev27: Resign — display "白方认输" / "White resigns" style.
// The resigner color is stored in _resignWinnerColor ('white' or 'black'
// meaning which color WINS). The loser is the opposite.
if(st==='resign'){
  if(typeof _resignWinnerColor!=='undefined'&&_resignWinnerColor){
    // The winner is _resignWinnerColor; the resigner is the opposite color.
    const resignerColor=_resignWinnerColor==='white'?'black':'white';
    const resignerStr=resignerColor==='white'?T('white_short'):T('black_side');
    // Returns e.g. "⚪ 白方认输" / "⚪ White resigns"
    return resignerStr+T('resigns_suffix');
  }
  return T('resigns_suffix');
}
// v1.0.4 Rev47: Timeout — display "白方超时胜" / "White wins by timeout" style.
// The winner color is stored in _timeoutWinnerColor ('white' or 'black').
// This was previously set directly in _onGameClockExpired() using _lang
// instead of T(), so switching language didn't re-localize the text.
// Now _gameOverStrFromStatus handles it, and the render-time re-localization
// (line ~1019: `if(gameOver&&_gameOverStatusKey){const _reLocStr=...}`)
// will call this function to re-localize on language toggle.
if(st==='timeout'){
  if(typeof _timeoutWinnerColor!=='undefined'&&_timeoutWinnerColor){
    const winnerStr=_timeoutWinnerColor==='white'?T('white_short'):T('black_side');
    return winnerStr+T('timeout_win_suffix');
  }
  return T('timeout_win_suffix');
}
return null;
}
// Helper: apply game-over string and ensure checkmate notation (accepts cached status to avoid redundant gameStatus() call)
function _applyGameOver(cachedSt){
  const st=cachedSt||gameStatus(gameState);
  const goStr=_gameOverStrFromStatus(st);
  if(goStr){gameOver=goStr;_gameOverStatusKey=st;
    // v1.2.3 P1 (Round 18 i18n-P1-2): Use _gameOverStatusKey instead of
    //   `goStr.includes('将杀')` — the localized text varies with language,
    //   but the status key is language-independent. Patching the move
    //   notation with '#' is correct whenever st==='checkmate'.
    if(st==='checkmate'&&moveRecords.length>0){
      const last=moveRecords[moveRecords.length-1];// v1.0.2 FIX: null-safe — last entry may be the black-to-move null placeholder
      // in pathological edge cases (no real moves executed). Skip notation patching if so.
      if(last&&last.notation&&!last.notation.endsWith('#')){last.notation=last.notation.replace(/\+$/,'')+'#';}
      _sfMateDistance=0;_sfDepth=0;_sfSeldepth=0;_sfEval=gameState.currentTurn==='black'?99999:-99999;_sfEvalReady=true;
    }
  }
}

// v1.2.1 round-12 (S3358): Extracted game-over icon + style computation into
// helpers to eliminate a 4-way nested ternary in renderInternal's game-over
// overlay. Behavior is identical to the previous inline expression; the helpers
// just give each branch a name so the dispatch is readable.
function _gameOverIconStyle(){
  // Checkmate: render the losing side's king glyph in its color.
  // Other endings (resign/timeout/draw) use the system emoji font.
  if(_gameOverStatusKey==='checkmate'){
    if(gameState.currentTurn==='black'){
      // White gave checkmate — black king on light backdrop
      return 'color:#E8E8F0;-webkit-text-stroke:.3px rgba(30,15,0,.85);text-shadow:0 0 .8px rgba(30,15,0,.55)';
    }
    // Black gave checkmate — white king on dark backdrop
    return 'color:#1A1A2E;-webkit-text-stroke:.3px rgba(255,230,150,.85);text-shadow:0 0 .8px rgba(255,230,150,.55)';
  }
  return 'font-family:system-ui,sans-serif';
}
function _gameOverIconChar(){
  if(_gameOverStatusKey==='checkmate'){
    return gameState.currentTurn==='black'?'♔\uFE0E':'♚\uFE0E';
  }
  if(_gameOverStatusKey==='resign') return '🏳️';
  if(_gameOverStatusKey==='timeout') return '⌛';
  return '🤝'; // draw / stalemate / unknown
}

// ===================== GAME STATE =====================
// Core game state
let gameState=initState(),stateHistory=[],playerColor='white',selectedSquare=null,
    legalMvs=[],legalSet=new Set(),moveRecords=[],gameOver=null,_gameOverStatusKey=null,lastMove=null,
    pendingPromotion=null,isAIThinking=false,showNewGameDialog=false,
    showCtrlMap=false,aiLevel=4;
// v1.0.2: PGN save prompt state — when true, shows "💾是否保存PGN文件？" dialog
let showSavePGNPrompt=false,_pendingActionAfterSave=null,_skipPGNSavePrompt=false;
// Setup mode state
let setupMode=false,setupPiece=null,setupColor='white',setupErrors=[],
    setupHistory=[],setupRedoStack=[];
// v1.0.8: setupMarkerMode — when active, clicking a board square toggles a
// 🔁 castle-rights marker ('castle') or a ⚡ en-passant marker ('ep') instead
// of placing the currently-selected piece. setupPiece and setupMarkerMode
// are mutually exclusive: activating one clears the other.
let setupMarkerMode=null;
// Hint & UI state
let hintText='',isHintLoading=false,hoveredSquare=null,aiThinkInfo='',
    gameOverSoundPlayed=false;
let soundOn=true;
// Review & cache state
let reviewBaseState=null,_cachedStatus=null,_cachedStatusKey='';
// Control map cache
let cachedCtrlMap=null,cachedCtrlKey='',renderPending=false,
    lastRenderTime=0,lastRenderRequest=0,renderTimerId=null;
let _animRetryCount=0; // v1.1.0 Phase 54: guard against stuck animationInProgress
// v1.2.3 round-18 (bug fix): tracks "user is typing in the Chess960 SP-ID
//   input" so the full re-render triggered by each keystroke can restore
//   focus afterwards (mirrors the _ecoSearchFocused mechanism). Previously
//   every keystroke destroyed the input → focus/soft-keyboard lost →
//   multi-digit SP-IDs were effectively un-typeable.
let _spidEditing=false;
let _heartbeatIntervalId=null; // Interval ID for engine heartbeat monitor
let _heartbeatRunning=false; // Flag for engine heartbeat monitor state
// Dialog state
let _turnStartTime=Date.now(),dlgPlayerColor='white',dlgOpeningId=null,
    dlgBookMoves=false;
// v1.0.4 NEW: Chess960 (Fischer Random Chess) dialog state
//   dlgChess960      — boolean: is the user starting a Chess960 game?
//   dlgChess960SPID  — integer 0..959: the user-selected SP-ID, or -1 for random
//   gameVariant      — 'chess960' or null: tracks the current game's variant for PGN export
//   gameSPID         — the actual SP-ID of the current game (set when dlgChess960SPID is -1 → random)
let dlgChess960=false,dlgChess960SPID=-1;
let gameVariant=null,gameSPID=null;
// v1.0.4 EXPANSION (this round): Time Control state
//   dlgTimeControl      — object describing the chosen time control (null = untimed)
//                          {type:'off'|'sudden'|'fischer'|'bronstein'|'usdelay', baseSec, incrementSec, delaySec}
//   gameClocks          — {white:{remainingSec, lastMoveTimestamp}, black:{...}}
//                          null when game is untimed
//   gameClockTimerId    — interval ID for the per-second clock display refresh
//   gameClockExpired    — 'white' | 'black' | null  (which side flagged out)
let dlgTimeControl={type:'off',baseSec:300,incrementSec:3,delaySec:3};
let gameClocks=null;
let gameClockTimerId=null;
let gameClockExpired=null;
let reviewMode=false,reviewStep=0,reviewStates=[],reviewCritical=[];
// v1.0.3-p6: track the last reviewStep we scrolled into view, so scrollIntoView
// only fires when the user navigates to a DIFFERENT step — not on every render
// (which would yank the move list back to the active move and prevent the user
// from scrolling the move list independently).
let _lastReviewStepScrolled=-2;
let _reviewAnalyzeAllActive=false; // Flag for reviewAnalyzeAll batch analysis
// v1.1.2 Phase 68 (Issue 30 P2): Priority queue for long-press-to-prioritize
//   during analyze-all. When the user long-presses an uncached move while a
//   batch is running, the step index is pushed here. The batch's advance
//   function checks this queue BEFORE continuing the normal sequence and
//   evaluates the prioritized step first. Entries are deduplicated (a second
//   long-press on an already-queued step is a no-op). The queue is cleared on
//   batch completion, batch cancel (exitReview/new game), and engine restart.
let _reviewAnalyzePriorityQueue=[];
// v1.1.0 Phase 54 rev14: _lastRenderReviewStep removed (dead code after virtual
//   list disabled). Was used to detect reviewStep changes for window recompute.
// v1.0.8 PHASE 18 Task 2: Virtual list state for the review move list.
// When a game has more than RV_VIRTUAL_THRESHOLD moves, only the visible
// window (plus RV_OVERSCAN rows above/below) is rendered as DOM nodes; the
// rest are represented by two tall placeholder <div>s (top spacer + bottom
// spacer) so the scrollbar still reflects the full content height and the
// user can scroll naturally.
//
// FIRST-PRINCIPLES ANALYSIS:
//   - The existing render pipeline builds a single HTML string and assigns to
//     app.innerHTML, which recreates the entire DOM. For a 200-move game this
//     is ~400 DOM nodes for the move list alone, rebuilt on every render().
//   - The cost scales with O(total moves), not O(visible moves), so long
//     games (analyzed endgames, 200+ moves) feel sluggish during navigation.
//   - A virtual list reduces the move-list DOM cost to O(visible + overscan),
//     decoupling render cost from game length.
//   - Threshold 80 is conservative — short games never pay the virtual-list
//     overhead (window math + scroll listener + spacer measurement); long
//     games get the full benefit.
//   - avgRowH is INITIALLY estimated at 44px (typical .rmv-block height
//     without variations). After the first virtual render, we measure the
//     actual height of the first few rendered rows and update avgRowH. This
//     makes the spacer heights accurate even when variations (🌿) expand
//     rows to 2-3x normal height.
//   - The scroll listener is passive — it does NOT call preventDefault or
//     stopPropagation, so it cannot break the existing scroll-restore
//     mechanism (_savedContainerScrolls). It only schedules a debounced
//     _refreshReviewMovesOnly() that swaps .review-moves innerHTML.
//   - _refreshReviewMovesOnly ONLY replaces .review-moves innerHTML, NOT
//     app.innerHTML — so the board, eval bar, chart, nav buttons, and dialog
//     state are all preserved. The scroll position is captured BEFORE the
//     swap and restored AFTER, so the user sees no jump.
// v1.1.0 Phase 54 rev14: DISABLED the virtual list entirely.
//   The virtual list (windowed rendering with spacers) caused numerous bugs:
//   - Can't scroll past ~40 moves (window computation with inaccurate avgRowH)
//   - Fast nav-button clicks cause pull-back (throttled render + window recompute)
//   - Selection state lost (active move outside virtual window)
//   - >90 steps revert (window recompute discarding scroll-based window)
//   - Periodic pull-back from _refreshReviewMovesOnly innerHTML rebuilds
//   First-principles analysis: the virtual list optimizes for >80 moves, but
//   a typical chess game has 40-80 moves (20-40 pairs). Even a 200-move game
//   renders fine as a full list — each row is a simple <div> with text, and
//   modern WebView handles 200 DOM nodes trivially. The complexity of virtual
//   list (window tracking, spacer heights, scroll-driven refresh, measurement
//   rAF, suppression guards) far outweighs the negligible performance gain.
//   Setting threshold to Infinity disables virtual list for ALL games —
//   eliminating ALL virtual-list-related bugs at once.
const RV_VIRTUAL_THRESHOLD=Infinity;   // v1.1.0 rev14: disabled — render full list always
let _rvVirtualState={
  avgRowH:44,
  scrollTop:0,
  windowStart:0,
  windowEnd:Infinity,
  measured:false,
  enabled:false,
};
let _rvScrollRefreshTimer=0;
// Track the game-over status key so we can re-localize gameOver on language switch.
// Toggle for global eval trend display in review mode.
// When true: shows the entire game's eval trend uniformly aligned with the progress bar.
// When false: shows only evaluated positions (sparse, with gaps).
let _reviewEvalGlobal=true;
// Snapshot of game state before entering review mode.
// Used by exitReview() to restore the exact position the player was at,
// instead of reverting to the initial position (reviewBaseState).
let _preReviewSnapshot=null;
let useBookMoves=false; // ECO BookMove: off by default, player opts in via New Game dialog
let _ecoEnabled=true; // ECO opening recognition enabled — only true for free/ECO-selected openings

// ===================== CAPTURED PIECES DISPLAY =====================
/**
 * Compute captured pieces for a given color.
 *
 * v1.0.4 FIX (this round): The previous implementation compared the current
 * board piece counts against the standard starting counts. This was WRONG in
 * two scenarios involving pawn promotion:
 *
 *   1. Pawn promotes to Queen: board shows 2Q + 7P (started 1Q + 8P).
 *      Old code: diff_Q = 1-2 = -1 → 0 captured queens (correct, but
 *      coincidentally); diff_P = 8-7 = 1 → 1 captured pawn (WRONG: the
 *      pawn wasn't captured, it promoted).
 *
 *   2. Pawn promotes to Rook/Knight/Bishop: e.g. promote to Rook → board
 *      shows 3R + 7P. Old code: diff_R = 2-3 = -1 → 0 captured rooks
 *      (coincidentally correct); diff_P = 8-7 = 1 → 1 captured pawn (WRONG).
 *
 *   3. A queen is captured AND a pawn promotes to queen: board shows 1Q + 7P.
 *      Old code: diff_Q = 1-1 = 0 → 0 captured queens (WRONG: 1 queen was
 *      captured, but the promoted pawn masked it); diff_P = 1 → 1 captured
 *      pawn (WRONG: the pawn promoted, wasn't captured).
 *
 * The fix: use moveRecords (which records the ACTUAL captured piece for each
 * move, including the promoted-piece type at the moment of capture) as the
 * source of truth. The board-diff method is retained ONLY as a fallback for
 * setup-mode / FEN-imported positions where no moveRecords exist.
 *
 * @param {Array} board — 8x8 board array (used only for fallback)
 * @param {string} color — color of the captured pieces to return
 * @param {Array} [moveRecordsArg] — optional moveRecords array; if present,
 *        used as the authoritative source (handles promotion correctly).
 * @returns {Array} piece type strings in order: queen, rook, bishop, knight, pawn
 */
function getCapturedPieces(board, color, moveRecordsArg) {
  // v1.0.4 FIX: prefer moveRecords-based accounting when available.
  // moveRecords[i].captured is the actual piece object {type, color} that was
  // captured on move i (or undefined if no capture). This correctly handles:
  //   - pawn promotion (the captured piece is whatever was on the destination,
  //     which may be a promoted queen/rook/etc.)
  //   - en passant (captured is the enemy pawn)
  //   - no-capture moves (captured is undefined, skipped)
  // The color parameter is the color of the pieces we want to DISPLAY as
  // captured — i.e., the OPPONENT of the side whose bar we're rendering.
  // moveRecords[i].captured.color tells us which side lost the piece.
  if (moveRecordsArg && Array.isArray(moveRecordsArg) && moveRecordsArg.length > 0) {
    const order = ['queen','rook','bishop','knight','pawn'];
    const counts = { queen:0, rook:0, bishop:0, knight:0, pawn:0 };
    for (let i = 0; i < moveRecordsArg.length; i++) {
      const mr = moveRecordsArg[i];
      if (!mr || !mr.captured) continue;
      // mr.captured is {type, color} — verify color matches the requested color
      if (mr.captured.color !== color) continue;
      const t = mr.captured.type;
      if (t && counts[t] !== undefined) counts[t]++;
    }
    // Build captured list in canonical order
    const result = [];
    for (const t of order) {
      for (let i = 0; i < counts[t]; i++) result.push(t);
    }
    return result;
  }
  // v1.0.8 PHASE 38: When there are no moveRecords (setup mode / FEN import /
  //   PGN import initial position), we CANNOT know which pieces were "captured"
  //   vs "never placed" — the board-diff method assumed standard starting counts
  //   (1Q, 2R, 2B, 2N, 8P) which is wrong for custom positions. For example,
  //   a FEN with only K+Q vs K would show "captured: 1Q, 2R, 2B, 2N, 8P" which
  //   is misleading. Return empty — no captures to display when there's no
  //   move history.
  return [];
}

/**
 * Render captured pieces HTML for a player bar.
 * Uses the same color/stroke/glow style as the ♔/♚ icon in the bar header.
 * Pieces are rendered at the same font-size as .pico (1.4rem desktop).
 * Left-aligned on first row; other bar info wraps below.
 *
 * v1.0.4 FIX (this round): now passes moveRecords to getCapturedPieces() so
 * pawn promotions are handled correctly (the captured list reflects ACTUAL
 * captures, not board-diff inferences).
 *
 * v1.0.4 Rev37: AI opponent bar captured pieces split into two rows when
 * count > 7. Pieces 1-7 on the first captured row; pieces 8+ on a second
 * captured row (which becomes line 3 of the AI bar, left-aligned). The
 * player bar keeps the original single-row wrap behavior (unchanged).
 * The `splitAt` parameter controls the split point (0 = no split).
 */
function capturedPiecesHtml(board, pieceColor, playerColor, splitAt) {
  // v1.0.4 FIX: pass moveRecords (global) as the authoritative source
  const captured = getCapturedPieces(board, pieceColor, (moveRecords !== undefined) ? moveRecords : null);
  if (!captured.length) return '';
  // Style: same color scheme as the king icon in the bar
  const isW = pieceColor === 'white';
  const symStyle = isW
    ? 'color:#E8E8F0;-webkit-text-stroke:.3px rgba(30,15,0,.85);text-shadow:0 0 .8px rgba(30,15,0,.55)'
    : 'color:#1A1A2E;-webkit-text-stroke:.3px rgba(255,230,150,.85);text-shadow:0 0 .8px rgba(255,230,150,.55)';

  // v1.0.4 Rev37: If splitAt > 0 and captured count exceeds splitAt, render
  // two separate flex rows. The first row contains pieces 1..splitAt; the
  // second row contains pieces splitAt+1..end. Each row is a separate div
  // so the AI bar layout can place search/ponder info on the same lines
  // (right-aligned) via the parent flex container.
  if (splitAt > 0 && captured.length > splitAt) {
    let html = '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:1px;padding-top:2px;line-height:1">';
    for (let i = 0; i < splitAt; i++) {
      html += '<span style="font-size:.85rem;font-family:\'DejaVu Sans\',\'Noto Sans\',\'Segoe UI Symbol\',sans-serif;font-variant-emoji:text;' + symStyle + '">' + SYM[pieceColor][captured[i]] + '</span>';
    }
    html += '</div>';
    // Second row: pieces 8+ (left-aligned, will be on line 3 of AI bar)
    // v1.0.4 Rev39 FIX: was width:100% + flex:0 0 auto — caused overflow div to
    // take ALL width, pushing #ai-ponder-info off-screen.
    // v1.0.4 Rev40 FIX: was flex-wrap:wrap — caused pieces to stack VERTICALLY.
    // v1.0.4 Rev42 FIX: overflow:hidden was CLIPPING the overflow pieces so they
    // didn't display at all. Removed overflow:hidden from this div — the parent
    // line-3 container handles clipping. Also removed flex:0 1 auto (which caused
    // shrink-to-fit that could make pieces invisible when space was tight).
    // Now using flex:0 0 auto (natural width, no shrink) so all pieces display.
    // The parent container's overflow:hidden clips anything truly exceeding the
    // bar width, but the pieces themselves are never hidden by their own div.
    html += '<div id="ai-cap-overflow" style="display:flex;flex-wrap:nowrap;align-items:center;gap:1px;padding-top:1px;line-height:1;flex:0 0 auto">';
    for (let i = splitAt; i < captured.length; i++) {
      html += '<span style="font-size:.85rem;font-family:\'DejaVu Sans\',\'Noto Sans\',\'Segoe UI Symbol\',sans-serif;font-variant-emoji:text;' + symStyle + '">' + SYM[pieceColor][captured[i]] + '</span>';
    }
    html += '</div>';
    return html;
  }

  // Default: single flex-wrap row (player bar, or AI bar with ≤7 pieces)
  // v1.0.4 Rev41: font-size reduced from 1.1rem to 0.85rem to match AI bar
  // overflow pieces font-size (Rev40), keeping both bars visually consistent.
  let html = '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:1px;padding-top:2px;line-height:1">';
  for (const t of captured) {
    html += '<span style="font-size:.85rem;font-family:\'DejaVu Sans\',\'Noto Sans\',\'Segoe UI Symbol\',sans-serif;font-variant-emoji:text;' + symStyle + '">' + SYM[pieceColor][t] + '</span>';
  }
  html += '</div>';
  return html;
}

// ===================== RENDER =====================
/**
 * Render the full application UI. Triggers renderInternal() with throttling.
 * Multiple rapid calls are coalesced via requestAnimationFrame.
 * @side-effect Rebuilds the entire app DOM
 */
// v1.0.8 PHASE 22: Header king icon — switches ♔ (dark mode) / ♚ (light mode).
// _isLightMode() is defined in ai-bridge.js (loaded before ui.js); reuse it
// to avoid duplicate definitions. The piece styling matches the on-board
// pieces exactly (same color, stroke, glow). The icon is wrapped in a gold
// gradient border (unchanged in both modes) — only the king symbol and its
// piece styling change with the theme.
// _KING_PIECE_STYLE: shared piece-styling constants for _hdrKingIconHTML
// (ui.js) and _loadingKingIconHTML (ai-bridge.js). Extracted to avoid
// duplicating the color/stroke/shadow values across two functions.
const _KING_PIECE_STYLE={
  white:{color:'#E8E8F0',stroke:'rgba(30,15,0,.85)',shadow:'rgba(30,15,0,.55)',sym:'\u2654'},
  black:{color:'#1A1A2E',stroke:'rgba(255,230,150,.85)',shadow:'rgba(255,230,150,.55)',sym:'\u265A'}
};
function _hdrKingIconHTML(){
  // Gold gradient border + piece-styled king. Same border in both modes; only
  // the king symbol + piece color/stroke/glow differ.
  const borderStyle='border:3px solid transparent;border-image:linear-gradient(145deg,#8b6914,#d4a017,#ffd700,#fff8dc,#ffd700,#d4a017,#8b6914) 1;padding:3px 6px;background:linear-gradient(145deg,rgba(139,105,20,.18),rgba(255,215,0,.08),rgba(139,105,20,.18));box-shadow:0 0 6px rgba(212,160,23,.35),0 0 12px rgba(255,215,0,.12),inset 0 0 3px rgba(255,215,0,.1),inset 0 1px 0 rgba(255,248,220,.15);position:relative';
  const fontSpec='font-family:\'DejaVu Sans\',\'Noto Sans\',\'Segoe UI Symbol\',sans-serif;font-variant-emoji:text';
  // Dark mode → white king ♔; Light mode → black king ♚
  const ps=_isLightMode()?_KING_PIECE_STYLE.black:_KING_PIECE_STYLE.white;
  return '<span style="font-size:1.3rem;color:'+ps.color+';-webkit-text-stroke:.3px '+ps.stroke+';text-shadow:0 0 .8px '+ps.shadow+';'+fontSpec+';'+borderStyle+'">'+ps.sym+'\uFE0E</span>';
}
// v1.0.4 ROUND-5 REV12: Unified render throttle — 8ms (120fps cap), single
// renderInternal per frame (removed the double-renderInternal that caused
// the scroll-to-top bug). The previous code called renderInternal() TWICE
// in the same rAF callback when _reqAtTick>lastRenderTime — the second
// call's save phase read scrollTop=0 from the just-rebuilt DOM.
function render(){
  if(renderPending){lastRenderRequest=Date.now();return;}
  // v1.0.8 PHASE 22: throttle render while piece-move animation is in
  //   progress (Web Animations API overlay is on screen). Landing anim is
  //   no longer a separate phase — the overlay covers the destination
  //   square until animateMove's _finishAnim removes it.
  // v1.1.0 Phase 54: Added _animRetryCount guard (max 10 retries = 2s) to
  //   prevent infinite loop if animationInProgress gets stuck true.
  if(animationInProgress){
    if(!renderPending){
      _animRetryCount=(_animRetryCount||0)+1;
      if(_animRetryCount>10){
        // Stuck — force-clear and render immediately
        animationInProgress=false;_animRetryCount=0;
        lastRenderTime=Date.now();
        renderInternal();
        return;
      }
      renderPending=true;
      // v1.2.3 round-18 (bug fix): do NOT reset _animRetryCount here — the
      //   reset made the counter oscillate 0→1 so the ">10 retries →
      //   force-clear stuck animationInProgress" guard above could never
      //   fire (dead code, infinite 200ms spin instead of 2s self-heal).
      //   The healthy-path reset at the non-animating branch below suffices.
      setTimeout(()=>{renderPending=false;lastRenderTime=Date.now();render();},200);
    }
    return;
  }
  _animRetryCount=0;
  const now=Date.now();
  if(now-lastRenderTime<8){
    renderPending=true;
    renderTimerId=requestAnimationFrame(()=>{
      renderPending=false;renderTimerId=null;
      lastRenderTime=Date.now();
      // v1.0.4 REV12: Only call renderInternal() ONCE per frame.
      // The previous "if(_reqAtTick>lastRenderTime){renderInternal()}" double-call
      // was the root cause of the recurring scroll-to-top bug.
      renderInternal();
    });
    return;
  }
  lastRenderTime=now;
  renderInternal();
}

/**
 * v1.2.0 Phase 82: Render all modal dialogs as a single group.
 *
 * Extracted from renderInternal() to reduce God Function size. Each dialog is
 * triggered by an independent boolean flag and produces self-contained HTML
 * overlay markup appended to the `h` string. All dialogs use global state only
 * (no local variables from renderInternal's main body), making this extraction
 * safe and reversible.
 *
 * Dialogs rendered (in order):
 *   - showNewGameDialog: New game settings (color, Chess960, time control, openings)
 *   - showEngineConfig: Engine configuration (delegates to renderEngineConfig)
 *   - showResignConfirm: Resignation confirmation
 *   - showAboutPage: About / license information
 *   - showImportDialog: FEN/PGN import options
 *   - pendingPromotion: Pawn promotion piece selector
 *   - showSavePGNPrompt: Save PGN before clearing move records
 *   - showPGNCacheManager: PGN cache manager (delegates to _renderPGNCacheManager)
 *
 * @param {string} h - Current HTML string
 * @returns {string} h with dialog HTML appended
 */
/**
 * v1.2.1 round-14 (S3776): Render the New Game dialog.
 *
 * Extracted from _renderDialogs() to reduce its cognitive complexity (was CC=71).
 * This is the largest dialog (~118 lines) and the primary source of complexity
 * due to the Chess960-vs-Classic-Openings if/else, the time-control conditional
 * inputs, and the mutual-exclusivity gray-out logic.
 *
 * @param {string} h - Current HTML string
 * @returns {string} h with New Game dialog HTML appended
 */
function _renderNewGameDialog(h){
h+=`<div class="dov" role="dialog" aria-modal="true" aria-label="${T('new_game_settings')}" onclick="if(event.target===this){showNewGameDialog=false;render()}"><div class="dlg"><h2>⚔️ ${T('new_game_settings')}</h2><div class="dlg-content">`;
h+=`<div class="dlg-sec"><h3>${T('play_color')}</h3><div class="clr-row"><button class="clr-btn${dlgPlayerColor==='white'?' act':''}" onclick="dlgPlayerColor='white';render()"><span style="color:#E8E8F0;-webkit-text-stroke:.3px rgba(30,15,0,.85);text-shadow:0 0 .8px rgba(30,15,0,.55);font-family:&#x27;DejaVu Sans&#x27;,&#x27;Noto Sans&#x27;,&#x27;Segoe UI Symbol&#x27;,sans-serif;font-variant-emoji:text;font-size:1.6rem">♔&#xFE0E;</span>${T('white_first')}</button><button class="clr-btn${dlgPlayerColor==='black'?' act':''}" onclick="dlgPlayerColor='black';render()"><span style="color:#1A1A2E;-webkit-text-stroke:.3px rgba(255,230,150,.85);text-shadow:0 0 .8px rgba(255,230,150,.55);font-family:&#x27;DejaVu Sans&#x27;,&#x27;Noto Sans&#x27;,&#x27;Segoe UI Symbol&#x27;,sans-serif;font-variant-emoji:text;font-size:1.6rem">♚&#xFE0E;</span>${T('black_second')}</button></div></div>`;
const _ch960Grayed=dlgBookMoves;
h+=`<div class="dlg-sec"><h3>${T('chess960_label')}</h3><div class="toggle" onclick="${_ch960Grayed?'':`dlgChess960=!dlgChess960;HapticManager.fire(dlgChess960?'TOGGLE_ON':'TOGGLE_OFF');if(dlgChess960){dlgOpeningId=null;}render()`}" style="margin-bottom:10px;${_ch960Grayed?'opacity:.4;pointer-events:none':''}"><span>${T('chess960_enable')}</span><div class="toggle-sw${dlgChess960?' on':''}"></div></div>${_ch960Grayed?`<div style="font-size:.7rem;color:var(--red);margin-top:-4px;margin-bottom:6px">${T('gray_disabled_by_eco_book')}</div>`:''}</div>`;
h+=`<div class="dlg-sec"><h3>${T('time_control_label')}</h3>`;
h+=`<select id="timeControlType" style="width:100%;padding:8px 12px;border-radius:10px;border:1px solid var(--border);background:var(--card);color:var(--text);font-size:.85rem;cursor:pointer;margin-bottom:10px" onchange="HapticManager.fire('BUTTON_PRESS');dlgTimeControl.type=this.value;render()">`;
const _tcTypes=[['off','time_control_off'],['sudden','time_control_sudden'],['fischer','time_control_fischer'],['bronstein','time_control_bronstein'],['usdelay','time_control_usdelay']];
for(const [v,key] of _tcTypes){
  h+=`<option value="${v}"${dlgTimeControl.type===v?' selected':''}>${T(key)}</option>`;
}
h+=`</select>`;
if(dlgTimeControl.type!=='off'){
  h+=`<div class="portrait-stack" style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><label style="font-size:.78rem;color:var(--muted);flex:1">${T('time_control_base_min')}</label><input type="number" min="1" max="600" value="${Math.round((dlgTimeControl.baseSec||300)/60)}" style="width:80px;padding:4px 8px;border-radius:6px;border:1px solid var(--border);background:var(--card);color:var(--text);font-size:.85rem;text-align:center" oninput="const v=Number.parseInt(this.value,10);if(!Number.isNaN(v)&&v>=1){dlgTimeControl.baseSec=v*60;}"></div>`;
  if(dlgTimeControl.type==='fischer'){
    h+=`<div class="portrait-stack" style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><label style="font-size:.78rem;color:var(--muted);flex:1">${T('time_control_inc_sec')}</label><input type="number" min="0" max="60" value="${dlgTimeControl.incrementSec||0}" style="width:80px;padding:4px 8px;border-radius:6px;border:1px solid var(--border);background:var(--card);color:var(--text);font-size:.85rem;text-align:center" oninput="const v=Number.parseInt(this.value,10);if(!Number.isNaN(v)&&v>=0){dlgTimeControl.incrementSec=v;}"></div>`;
  }
  if(dlgTimeControl.type==='bronstein'||dlgTimeControl.type==='usdelay'){
    h+=`<div class="portrait-stack" style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><label style="font-size:.78rem;color:var(--muted);flex:1">${T('time_control_delay_sec')}</label><input type="number" min="0" max="60" value="${dlgTimeControl.delaySec||0}" style="width:80px;padding:4px 8px;border-radius:6px;border:1px solid var(--border);background:var(--card);color:var(--text);font-size:.85rem;text-align:center" oninput="const v=Number.parseInt(this.value,10);if(!Number.isNaN(v)&&v>=0){dlgTimeControl.delaySec=v;}"></div>`;
  }
}
h+=`<div style="font-size:.7rem;color:var(--muted);margin-top:4px">${T('time_control_note')}</div>`;
h+=`</div>`;
const _ecoGrayed=dlgChess960;
h+=`<div class="dlg-sec"><h3>${T('ai_book')}</h3><div class="toggle" onclick="${_ecoGrayed?'':`dlgBookMoves=!dlgBookMoves;HapticManager.fire(dlgBookMoves?'TOGGLE_ON':'TOGGLE_OFF');render()`}" style="margin-bottom:10px;${_ecoGrayed?'opacity:.4;pointer-events:none':''}"><span>${T('book_moves')}</span><div class="toggle-sw${dlgBookMoves?' on':''}"></div></div>${_ecoGrayed?`<div style="font-size:.7rem;color:var(--red);margin-top:-4px;margin-bottom:6px">${T('gray_disabled_by_chess960')}</div>`:''}</div><div style="font-size:.72rem;color:var(--muted);margin-bottom:10px">${T('eco_book_desc')}</div></div>`;
if(dlgChess960&&!dlgBookMoves){
  h=_renderChess960Settings(h);
}else{
  h=_renderClassicOpeningsList(h);
}
h+=`</div>`; // close .dlg-content
h+=`<div class="dlg-btns"><button type="button" class="btn btn-s" onclick="showNewGameDialog=false;dlgOpeningId=null;render()">${T('cancel')}</button><button type="button" class="btn btn-p" onclick="startGame()">${T('start_game_pawn')}</button></div>`;
h+=`</div></div>`;
return h;
}

/**
 * v1.2.1 round-14 (S3776): Render Chess960 SP-ID settings section (inside New Game dialog).
 * Extracted from _renderNewGameDialog to further reduce cognitive complexity.
 */
function _renderChess960Settings(h){
  const curSPID=dlgChess960SPID>=0?dlgChess960SPID:-1;
  const previewSPID=curSPID>=0?curSPID:518;
  const backRank=spidToBackRank(previewSPID);
  const pieceSym={rook:'♖',knight:'♘',bishop:'♗',queen:'♕',king:'♔'};
  h+=`<div class="dlg-sec">`;
  h+=`<div class="portrait-stack" style="display:flex;gap:6px;align-items:center;margin-bottom:8px;flex-wrap:wrap">`;
  h+=`<label style="font-size:.78rem;color:var(--muted)">${T('chess960_spid')}: </label>`;
  h+=`<button class="btn" style="padding:4px 10px;font-size:.78rem;${curSPID===-1?'background:var(--accent);color:var(--bg);font-weight:700':''}" onclick="HapticManager.fire('BUTTON_PRESS');dlgChess960SPID=-1;render()">${T('chess960_random')}</button>`;
  h+=`<div style="display:flex;gap:6px;align-items:center;flex:1;min-width:120px">`;
  // v1.2.3 round-18: id + _spidEditing flag so _postRenderFinalize can
  //   restore focus after the keystroke-triggered re-render (see declaration).
  h+=`<input id="spidInput" type="number" min="0" max="959" value="${curSPID>=0?curSPID:''}" placeholder="0-959" style="flex:1;width:80px;min-width:0;padding:4px 8px;border-radius:6px;border:1px solid var(--border);background:var(--card);color:var(--text);font-size:.85rem;text-align:center" oninput="_spidEditing=true;const v=Number.parseInt(this.value,10);if(!Number.isNaN(v)&&v>=0&&v<960){dlgChess960SPID=v;render();}else if(this.value===''){dlgChess960SPID=-1;render();}">`;
  // v1.2.1 round-16: secureRandomInt is exported by game-logic.js (loaded
  //   before ui.js), so the typeof guard is unreachable defensive code.
  //   Simplified to direct call (removes Math.random() that triggered
  //   security-scanner flags; secureRandomInt uses crypto.getRandomValues
  //   with safe failure to 0, never returns undefined).
  h+=`<button class="btn" style="padding:4px 10px;font-size:.78rem;flex-shrink:0" onclick="HapticManager.fire('BUTTON_PRESS');dlgChess960SPID=secureRandomInt(960);render();">🎲</button>`;
  h+=`</div>`;
  h+=`</div>`;
  const _wPieceStyle="color:#E8E8F0;-webkit-text-stroke:.3px rgba(30,15,0,.85);text-shadow:0 0 .8px rgba(30,15,0,.55);font-family:'DejaVu Sans','Noto Sans','Segoe UI Symbol',sans-serif;font-variant-emoji:text;font-weight:400";
  h+=`<div style="background:var(--card);border:1px solid var(--border);border-radius:6px;padding:6px;margin-bottom:6px"><div style="font-size:.7rem;color:var(--muted);margin-bottom:4px">${T('chess960_preview')} (SP-ID ${previewSPID})</div><div style="display:grid;grid-template-columns:repeat(8,1fr);gap:0;font-size:1.4rem;background:#3a2a1a;padding:4px;border-radius:4px">`;
  for(let c=0;c<8;c++){
    const p=backRank[c];
    h+=`<span style="text-align:center;${_wPieceStyle}">${pieceSym[p]||''}</span>`;
  }
  h+=`</div><div style="display:grid;grid-template-columns:repeat(8,1fr);gap:0;font-size:.6rem;color:var(--muted);margin-top:2px">`;
  for(let c=0;c<8;c++)h+=`<span style="text-align:center">${'abcdefgh'[c]}</span>`;
  h+=`</div></div>`;
  h+=`<div style="font-size:.7rem;color:var(--muted);margin-top:4px">${T('chess960_note')}</div>`;
  h+=`</div>`;
  return h;
}

/**
 * v1.2.1 round-14 (S3776): Render Classic Openings list section (inside New Game dialog).
 * Extracted from _renderNewGameDialog to further reduce cognitive complexity.
 */
function _renderClassicOpeningsList(h){
  h+=`<div class="dlg-sec"><div class="portrait-stack" style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap"><form onsubmit="event.preventDefault();if(!_ecoComposing){_ecoDoSearch()}" style="flex:1;min-width:160px;display:flex;gap:4px"><input id="ecoSearch" type="text" inputmode="search" aria-label="${T('eco_search_ph')}" placeholder="${T('eco_search_ph')}" style="flex:1;padding:8px 12px;border-radius:10px;border:1px solid var(--border);background:var(--card);color:var(--text);font-size:.85rem;touch-action:manipulation" enterkeyhint="search" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" oninput="if(!_ecoComposing){setEcoQuery(this.value)}" onfocus="_ecoSearchFocused=true;if(_ecoBlurTimer){clearTimeout(_ecoBlurTimer);_ecoBlurTimer=0}" onblur="_ecoBlurTimer=setTimeout(function(){_ecoSearchFocused=false;_ecoBlurTimer=0},200)" oncompositionstart="_ecoComposing=true" oncompositionend="_ecoComposing=false;setEcoQuery(this.value)" onkeydown="if((event.key==='Enter'||event.keyCode===13)&&!event.isComposing&&!_ecoComposing){event.preventDefault();setEcoQuery(this.value);_ecoDoSearch()}" value="${(window.ecoSearchQuery||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]))}"></form><select id="ecoFamily" style="padding:8px 12px;border-radius:10px;border:1px solid var(--border);background:var(--card);color:var(--text);font-size:.85rem;cursor:pointer;flex-shrink:0" onchange="window.ecoFamilyFilter=this.value;ecoShowCount=30;_ecoUpdateResults()"><option value="">${T('all_categories')}</option>${Object.keys(ECO_BY_FAMILY).sort((a,b)=>a.localeCompare(b)).map(f=>`<option value="${f}"${(window.ecoFamilyFilter||'')===f?' selected':''}>${f}</option>`).join('')}</select></div><div class="op-list"><button class="op-btn${!dlgOpeningId?' act':''}" onclick="dlgOpeningId=null;window.ecoSearchQuery='';window.ecoFamilyFilter='';ecoShowCount=30;_ecoUpdateResults()"><div class="on">${T('free_opening_btn')}</div><div class="os">${T('from_start')}</div></button>`;
  _ensureEcoParsed();ecoDisplayList=ECO_OPENINGS;
  if(window.ecoSearchQuery){const q=window.ecoSearchQuery.trim().toUpperCase();ecoDisplayList=searchEco(q)}
  else if(window.ecoFamilyFilter){ecoDisplayList=ECO_BY_FAMILY[window.ecoFamilyFilter]||[]}
  for(const o of ecoDisplayList.slice(0,ecoShowCount))h+=`<button class="op-btn${dlgOpeningId===o.id+'|'+o.name?' act':''}" onclick="dlgOpeningId='${_escJs(o.id)}|${_escJs(o.name)}';_ecoUpdateResults()"><div class="on">${_esc(o.id)} ${_esc(o.name)}</div><div class="os">${_esc(o.family)}</div></button>`;
  if(ecoDisplayList.length>ecoShowCount)h+=`<button class="btn btn-d" style="width:100%;margin-top:4px" onclick="ecoShowCount+=30;_ecoUpdateResults()">${T('load_more')} (+${ecoDisplayList.length-ecoShowCount})</button>`;
  h+=`</div></div>`;
  return h;
}

/**
 * v1.2.1 round-14 (S3776): Render the Resign confirmation dialog.
 * Extracted from _renderDialogs() to reduce its cognitive complexity.
 */
function _renderResignConfirmDialog(h){
h+=`<div class="dov" role="dialog" aria-modal="true" aria-label="${T('resign_confirm_title')}" onclick="if(event.target===this){showResignConfirm=false;render()}"><div class="dlg" style="max-width:380px"><h2>${T('resign_confirm_title')}</h2><div class="dlg-sec"><p style="font-size:.9rem;line-height:1.6;color:var(--text)">${T('resign_confirm_msg')}</p></div><div class="dlg-btns"><button type="button" class="btn" onclick="HapticManager.fire(&apos;BUTTON_PRESS&apos;);showResignConfirm=false;render()" style="flex:1;justify-content:center">${T('resign_no')}</button><button type="button" class="btn btn-p" onclick="HapticManager.fire(&apos;BUTTON_PRESS&apos;);showResignConfirm=false;_resignGame();render()" style="flex:1;justify-content:center;background:#c0392b;border-color:#a93226;color:#fff">${T('resign_yes')}</button></div></div></div>`;
return h;
}

/**
 * v1.2.1 round-14 (S3776): Render the About / license dialog.
 * Extracted from _renderDialogs() to reduce its cognitive complexity.
 */
function _renderAboutDialog(h){
let _gplSvgSrc='';
try{if(typeof AndroidBridge!=='undefined'&&AndroidBridge.loadAssetAsBase64){const b64=AndroidBridge.loadAssetAsBase64('AGPLv3_Logo.svg');if(b64)_gplSvgSrc='data:image/svg+xml;base64,'+b64;}}catch(e){console.warn('[About] AGPL SVG load failed:',e.message);_gplSvgSrc='';}
h+=`<div class="dov" role="dialog" aria-modal="true" aria-label="${T('about_title')}"><div class="dlg" style="max-width:460px"><h2>${T('about_title')}</h2><div class="dlg-sec"><div class="crow"><span class="lb">${T('about_app')}</span><span class="vl">${T("app_name")} v1.2.3</span></div><div class="crow"><span class="lb">${T('about_engine')}</span><span class="vl">Stockfish 18 (arm64-v8a-dotprod)</span></div><div class="crow"><span class="lb">${T('about_platform')}</span><span class="vl">Android arm64-v8a</span></div></div><div class="dlg-sec"><h3>${T('copyright_license')}</h3>`+(_gplSvgSrc?`<div style="text-align:center;margin-bottom:10px"><img src="${_gplSvgSrc}" alt="AGPL v3 Logo" style="width:120px;height:auto;opacity:.9" /></div>`:'')+`<div style="font-size:.75rem;color:var(--text);line-height:1.6"><p style="margin-bottom:8px">${T('about_copyright')}</p><p style="margin-bottom:8px">${T('about_source_code_prefix')}<a href="${T('about_source_code_url')}" style="color:var(--accent2);text-decoration:underline;word-break:break-all" target="_blank" rel="noopener">${T('about_source_code_url')}</a></p><p style="margin-bottom:8px">${T('about_agpl')} <a href="https://www.gnu.org/licenses/agpl-3.0.html" style="color:var(--accent2);text-decoration:underline" target="_blank" rel="noopener">GNU AGPL v3</a>${T('about_agpl_desc')}</p><p style="margin-bottom:8px">${T('about_droidfish')}<a href="https://github.com/peterosterlund2/droidfish" style="color:var(--accent2);text-decoration:underline;word-break:break-all" target="_blank" rel="noopener">DroidFish</a>${T('about_droidfish_desc')} <a href="https://www.gnu.org/licenses/gpl-3.0.html" style="color:var(--accent2);text-decoration:underline" target="_blank" rel="noopener">GPL v3</a>${T('about_droidfish_tail')}</p><p style="margin-bottom:8px">${T('about_stockfish')}<a href="https://github.com/official-stockfish/Stockfish" style="color:var(--accent2);text-decoration:underline;word-break:break-all" target="_blank" rel="noopener">Stockfish</a>${T('about_stockfish_desc')} <a href="https://www.gnu.org/licenses/gpl-3.0.html" style="color:var(--accent2);text-decoration:underline" target="_blank" rel="noopener">GPL v3</a> ${T('about_gplv3')}</p><p style="margin-bottom:8px;color:var(--muted)">${T('about_disclaimer')}</p><p style="margin-bottom:8px;color:var(--muted)">${T('about_ai')}</p></div></div><div class="dlg-btns"><button type="button" class="btn btn-p" onclick="showAboutPage=false;render()" style="flex:1;justify-content:center">${T('close')}</button></div></div></div>`;
return h;
}

/**
 * v1.2.1 round-14 (S3776): Render the Import (FEN/PGN) dialog.
 * Extracted from _renderDialogs() to reduce its cognitive complexity.
 */
function _renderImportDialog(h){
h+=`<div class="dov" role="dialog" aria-modal="true" aria-label="${T('import_title')}" onclick="if(event.target===this){showImportDialog=false;render()}"><div class="dlg" style="max-width:420px"><h2>${T('import_title')}</h2><div class="dlg-sec" style="gap:10px;display:flex;flex-direction:column">
<button class="btn" style="width:100%;justify-content:center;gap:8px;padding:12px;font-size:.9rem" onclick="showImportDialog=false;_importFENWithSaveCheck()"><span style="font-size:1.3rem">📋</span> ${T('paste_fen_opt')}</button>
<button class="btn" style="width:100%;justify-content:center;gap:8px;padding:12px;font-size:.9rem" onclick="showImportDialog=false;_doPastePGN()"><span style="font-size:1.3rem">📜</span> ${T('paste_pgn_opt')}</button>
<button class="btn" style="width:100%;justify-content:center;gap:8px;padding:12px;font-size:.9rem" onclick="showImportDialog=false;_importPGNFileWithSaveCheck()"><span style="font-size:1.3rem">📂</span> ${T('select_pgn_file')}</button>
</div><div class="dlg-btns"><button type="button" class="btn btn-s" onclick="showImportDialog=false;render()" style="flex:1;justify-content:center">${T('cancel')}</button></div></div></div>`;
return h;
}

/**
 * v1.2.1 round-14 (S3776): Render the pawn-promotion piece-selector dialog.
 * Extracted from _renderDialogs() to reduce its cognitive complexity.
 */
function _renderPromotionDialog(h){
const co=pendingPromotion.piece.color;const pcls=co==='white'?'w-prom':'bk-prom';
h+=`<div class="prom-dov" role="dialog" aria-modal="true" aria-label="${T('select_promotion')}" onclick="if(event.target===this){pendingPromotion=null;render()}"><div class="prom-dlg"><h3>${T('select_promotion')}</h3><div class="prom-row">`;
for(const t of['queen','rook','bishop','knight'])h+=`<button class="prom-btn ${pcls}" onclick="doPromotion('${t}')">${SYM[co][t]}</button>`;
h+=`</div><button class="btn" style="margin-top:12px;font-size:.8rem" onclick="pendingPromotion=null;render()">${T('cancel')}</button></div></div>`;
return h;
}

/**
 * v1.2.1 round-14 (S3776): Render the "Save PGN?" prompt dialog.
 * Extracted from _renderDialogs() to reduce its cognitive complexity.
 */
function _renderSavePGNPromptDialog(h){
h+=`<div class="dov" role="dialog" aria-modal="true" aria-label="${T('save_pgn_prompt')}" onclick="if(event.target===this){_savePGNCancel()}"><div class="dlg" style="max-width:320px"><h2>${T('save_pgn_prompt')}</h2><div class="dlg-btns" style="flex-wrap:wrap;gap:6px"><button type="button" class="btn btn-p" onclick="HapticManager.fire('BUTTON_PRESS');_savePGNYes()">${T('save_pgn_yes')}</button><button type="button" class="btn btn-s" onclick="HapticManager.fire('BUTTON_PRESS');_savePGNNo()">${T('save_pgn_no')}</button><button type="button" class="btn" onclick="HapticManager.fire('BUTTON_PRESS');_savePGNCancel()" style="flex:1 1 100%;margin-top:4px">${T('cancel')}</button></div></div></div>`;
return h;
}

/**
 * v1.2.1 round-14 (S3776): Render all modal dialogs.
 *
 * Refactored from a 181-line function (CC=71) into a thin dispatcher that
 * delegates to per-dialog helpers. Each dialog is triggered by an independent
 * boolean flag and produces self-contained HTML overlay markup.
 *
 * @param {string} h - Current HTML string
 * @returns {string} h with any active dialog HTML appended
 */
function _renderDialogs(h){
if(showNewGameDialog){h=_renderNewGameDialog(h);}
if(showEngineConfig){h+=renderEngineConfig();}
if(showResignConfirm){h=_renderResignConfirmDialog(h);}
if(showAboutPage){h=_renderAboutDialog(h);}
if(showImportDialog){h=_renderImportDialog(h);}
if(pendingPromotion){h=_renderPromotionDialog(h);}
if(showSavePGNPrompt){h=_renderSavePGNPromptDialog(h);}
if(showPGNCacheManager){h+=_renderPGNCacheManager();}
return h;
}

/**
 * Internal render function — builds the entire UI HTML string and sets innerHTML.
 * @side-effect Rebuilds entire app DOM, invalidates element cache
 */
/**
 * v1.2.1 round-15 (S3776): Build the review board's file labels (a-h row).
 * Extracted from _renderReviewMode to reduce its cognitive complexity.
 * @param {boolean} flip - Whether the board is flipped (black perspective)
 * @param {number} labelW - Label area width in px
 * @param {number} labelGap - Gap between label and board in px
 * @param {number} boardPx - Board pixel size (cell*8)
 * @param {number} labelH - Label area height in px
 * @param {number} fontSize - Label font size in px
 * @returns {string} HTML string for the file labels row
 */
function _buildRvFileLabels(flip,labelW,labelGap,boardPx,labelH,fontSize){
  let s='<div style="position:absolute;left:'+(labelW+labelGap)+'px;top:0;width:'+boardPx+'px;height:'+labelH+'px;display:flex;flex-direction:row;pointer-events:none;z-index:11">';
  for(let fc=0;fc<8;fc++){
    const fileChar=flip?String.fromCodePoint(104-fc):String.fromCodePoint(97+fc);
    s+='<div style="flex:1;display:flex;align-items:center;justify-content:center;font:'+fontSize+'px sans-serif;color:var(--text,#f5e6c8);user-select:none">'+fileChar+'</div>';
  }
  s+='</div>';
  return s;
}

/**
 * v1.2.1 round-15 (S3776): Build the review board's rank labels (1-8 column).
 * Extracted from _renderReviewMode to reduce its cognitive complexity.
 * @param {boolean} flip - Whether the board is flipped (black perspective)
 * @param {number} labelW - Label area width in px
 * @param {number} labelH - Label area height in px
 * @param {number} labelGap - Gap between label and board in px
 * @param {number} boardPx - Board pixel size (cell*8)
 * @param {number} fontSize - Label font size in px
 * @returns {string} HTML string for the rank labels column
 */
function _buildRvRankLabels(flip,labelW,labelH,labelGap,boardPx,fontSize){
  let s='<div style="position:absolute;left:0;top:'+(labelH+labelGap)+'px;width:'+labelW+'px;height:'+boardPx+'px;display:flex;flex-direction:column;pointer-events:none;z-index:11">';
  for(let fr=0;fr<8;fr++){
    const rankNum=flip?(fr+1):(8-fr);
    s+='<div style="flex:1;display:flex;align-items:center;justify-content:center;font:'+fontSize+'px sans-serif;color:var(--text,#f5e6c8);user-select:none">'+rankNum+'</div>';
  }
  s+='</div>';
  return s;
}

/**
 * v1.2.1 round-15 (S3776): Prepare visual annotations ([%csl]/[%cal]) for the
 * review board. Extracted from _renderReviewMode to reduce its cognitive complexity.
 *
 * Returns {va, cslMap, calList}:
 *   - va: the raw visual annotations object (or null)
 *   - cslMap: {squareKey -> [colors]} for O(1) lookup during cell render
 *   - calList: array of {color, from, to} for SVG rendering
 *
 * When showCtrlMap is true (heatmap mode), returns all-null (annotations are
 * not shown — the heatmap replaces them).
 */
function _prepareRvVisualAnnotations(showCtrlMap){
  let va=null;
  let cslMap=null;
  let calList=null;
  if(showCtrlMap||typeof _getVisualAnnotations!=='function'||typeof reviewStep==='undefined'){
    return {va,cslMap,calList};
  }
  if(reviewStep>0){
    va=_getVisualAnnotations(reviewStep-1);
  }else if(reviewStep===0){
    va=_getVisualAnnotations('_initial');
    if(!va&&typeof _computeInitialPositionAnnotations==='function'){
      _computeInitialPositionAnnotations();
      va=_getVisualAnnotations('_initial');
    }
  }
  if(va){
    if(va.csl&&va.csl.length>0){
      cslMap={};
      for(const h of va.csl){
        if(h&&h.color&&h.square){
          if(!cslMap[h.square])cslMap[h.square]=[];
          cslMap[h.square].push(h.color);
        }
      }
    }
    if(va.cal&&va.cal.length>0){
      calList=va.cal;
    }
  }
  return {va,cslMap,calList};
}

/**
 * v1.2.0 Phase 82+: Render review mode UI (board, eval bar, slider, chart, nav, analyze).
 *
 * Extracted from renderInternal() to further reduce God Function size. This block
 * renders the entire review-mode overlay: the review board (with coordinate labels,
 * control map, visual annotations, SVG arrows), the eval bar, the move slider, the
 * eval trend chart, the navigation buttons, and the analyze-all button.
 *
 * Uses global state only (no local variables from renderInternal's main body),
 * making this extraction safe and reversible. The h string concatenation pattern
 * is preserved (receives h, returns h with review HTML appended).
 *
 * @param {string} h - Current HTML string
 * @returns {{h: string, done: boolean}} - {h: updated HTML, done: true if early-return triggered (invalid review state, caller should return immediately)}
 */
function _renderReviewMode(h, flip){
const safeStep=Math.max(0,Math.min(reviewStep,reviewStates.length-1));
reviewStep=safeStep;
const rs=reviewStates[safeStep];
if(!rs){reviewMode=false;render();return{h,done:true}}
const rBoard=rs.state.board;const rLast=rs.lastMove;
h+='<div class="review-overlay">';
h+=`<div class="review-hdr"><h2>${T('review_analysis')}</h2><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><div class="toggle" style="padding:2px 6px;font-size:.65rem" onclick="showVariations=!showVariations;HapticManager.fire(showVariations?'TOGGLE_ON':'TOGGLE_OFF');render()"><span>${T('variation_toggle')}</span><div class="toggle-sw sm${showVariations?' on':''}"></div></div><button class="btn" onclick="showCtrlMap=!showCtrlMap;cachedCtrlKey=&quot;&quot;;render()" title="${T('ctrl_range')}">${showCtrlMap?'🌈':'🌗'}</button><button class="btn" onclick="copyReviewPGN()" title="${T('copy_review_pgn')}">📝 PGN</button><button class="btn" onclick="exportPGNToFile()" title="${T('export_pgn')||'Export PGN to file'}">💾</button><button class="btn" onclick="openPGNCacheManager()" title="${T('pgn_cache_manager')}" style="font-weight:700">📚</button><button class="btn" onclick="copyReviewFEN()" title="${T('copy_review_fen')}">📝 FEN</button><button class="btn" onclick="showImportDialog=true;render()" title="${T('import_label')}">🗃️</button><button class="btn" onclick="openStatsPage()" title="${T('stats')}">📊</button><button class="btn" onclick="exitReview()">${T('return_game')}</button></div></div>`;
// v1.0.3 FIX: Move _rvCell calculation BEFORE its first use (the --rv-board-w
// CSS variable on .review-body below). Previously, _rvCell was declared with
// `let` on line 944 but referenced on line 935 — causing a ReferenceError
// (temporal dead zone) when entering review mode.
const _isLandscapeReview = window.innerWidth > window.innerHeight;
let _rvCell = REVIEW_CELL; // Default from game-logic.js
if (_isLandscapeReview) {
  // v1.0.3-p7 redesign: TWO-LAYER SCROLL. Board width is ALWAYS > move-list
  // width. Board takes ~60% of viewport width, move list takes ~40%. Together
  // they fill 100% of viewport width edge-to-edge.
  //
  // v1.0.3-p7: the board is sized to 60% of viewport width (so board > moves),
  // NOT capped by viewport height. If the board is taller than the viewport,
  // the user scrolls the body (layer 1) to see the board's bottom edge + the
  // chart + controls. This is the "two-layer scroll" design the user requested:
  //   - Layer 1 (body scroll): reveals chart, slider, eval, nav, analyze (and
  //     the board's bottom edge if the board is taller than the viewport).
  //   - Layer 2 (move list independent scroll): scrolls the move list without
  //     affecting the board.
  //
  // We do NOT cap by REVIEW_CELL here — REVIEW_CELL is sized for the main-game
  // layout (which reserves width for the side panel) and would unnecessarily
  // limit the review board to a small size.
  const _rvMaxCellW = Math.floor((window.innerWidth * 0.60) / 8);
  _rvCell = Math.max(22, _rvMaxCellW);
}
// v1.2.0 Phase 83: Pre-compute coordinate label dimensions for the review board.
// Labels are positioned absolutely OUTSIDE .bgrid (in .review-board's padding area),
// so .review-board needs padding-top + padding-left to reserve space, and --rv-board-h
// (used by .review-moves height) must include the label height so the move list
// aligns with the board's full visual height.
const _rvLabelW=Math.floor(_rvCell*0.4);
const _rvLabelH=Math.floor(_rvCell*0.4);
const _rvLabelGap=2;
const _rvBoardPx=_rvCell*8;
const _rvFullBoardH=_rvBoardPx+_rvLabelH+_rvLabelGap; // board + top label row
// v1.1.0 Phase 53: Portrait and landscape now use the same DOM skeleton.
// The _isLandscapeReview flag is still used later for board sizing (cell width)
// and two-layer scroll decisions, but the initial DOM structure is identical.
// v1.2.1 round-12 (S3923): Removed duplicate if/else — both branches produced
// the exact same markup, leaving a redundant conditional that hid the unified
// layout intent. The .review-top wrapper is now always emitted (it was
// previously missing in the portrait branch — a v1.1.2 bug fixed in round-1).
h+='<div class="review-body" style="--rv-board-h:'+_rvFullBoardH+'px">';
h+='<div class="review-top">';
// .review-left holds ONLY the board (no inline controls — they moved to .review-bottom)
h+='<div class="review-left">';
// v1.2.0 Phase 83: inline padding reserves space for absolute-positioned coordinate labels.
// Overrides CSS .review-board{padding:12px} (portrait) and .review-left .review-board{padding:0} (landscape).
h+='<div class="review-board" style="padding-top:'+(_rvLabelH+_rvLabelGap)+'px;padding-left:'+(_rvLabelW+_rvLabelGap)+'px;padding-right:0;padding-bottom:0">';
h+='<div class="bgrid" style="grid-template-columns:repeat(8,'+_rvCell+'px);grid-template-rows:repeat(8,'+_rvCell+'px)">';
// v1.0.2: When showCtrlMap is enabled (🌈), color the review board squares with
// the control map — same as the main board. Compute the control map for the
// review position's board state.
const _rvCtrlKey=showCtrlMap?(rs.state.hash||'rv'):'off';
let _rvCm=null;
if(showCtrlMap){
  // Use a separate cache key for review positions to avoid collision with main board cache
  if(cachedCtrlKey!==_rvCtrlKey){
    cachedCtrlMap=getCtrlMap(rBoard);
    cachedCtrlKey=_rvCtrlKey;
  }
  _rvCm=cachedCtrlMap;
}
// v1.0.4 Round-5 Rev48 NEW: When heatmap is OFF, display [%csl]/[%cal] visual
// annotations on the review board. Per user spec (备忘1.md):
//   - High-highlight squares use CSS box-shadow inset (3px, matching the
//     last-move hint width)
//   - Arrows drawn in an SVG overlay layer (same style as the main board's
//     heatmap-on selected-square arrows)
// The visual annotations come from _visualAnnotationsCache (populated either
// by _computeAndCacheVisualAnnotations during play, or by importPGN from PGN
// comments). The cache key is moveRecords index (0-based); review step N
// corresponds to moveIdx = N-1 for N≥1. Step 0 (initial position) uses the
// '_initial' sentinel key (handled at line ~1618).
let _rvVa=null;
let _rvCslMap=null; // {squareKey -> color} for O(1) lookup during cell render
let _rvCalList=null; // array of {color, from, to} for SVG rendering
const _rvAnnResult=_prepareRvVisualAnnotations(showCtrlMap);
_rvVa=_rvAnnResult.va;
_rvCslMap=_rvAnnResult.cslMap;
_rvCalList=_rvAnnResult.calList;
// v1.0.4 Round-5 Rev48: Color palette for visual annotations — must match
// stats.html's per-color value colors exactly so the visual association is
// consistent across the app.
const _RV_VA_COLORS={B:'#4a90d9',R:'#e74c3c',Y:'#f1c40f',G:'#27ae60'};
// v1.0.8 PHASE 3: compute visible 🔁/⚡ markers for the review position.
// reviewStates[safeStep].state is the source-of-truth game state at step N.
const _rvVisibleCastle=(typeof computeVisibleCastleMarks==='function')?computeVisibleCastleMarks(rs.state):new Set();
const _rvVisibleEp=(typeof computeVisibleEpMark==='function')?computeVisibleEpMark(rs.state):null;
// v1.2.0 Phase 77 → Phase 83 FIX: 添加复盘棋盘坐标标注（左侧1-8数字 + 上方a-h字母 + 格子坐标）
// 与主界面棋盘和统计数据界面棋盘同款，颜色/位置/字体完全一致。
//
// ⚠️ Phase 77 BUG FIX (Phase 83): 原实现将 flex 布局的标签 div 放在 .bgrid（CSS Grid）
// 内部，破坏了网格布局（Grid 期望 64 个直接子节点，却得到了 flex 包装器），导致棋盘
// 格子排列异常。同时 SVG 箭头叠加层的 position:absolute 锚点也因此错位。
//
// 修复方案：坐标标签改为 position:absolute 定位，放在 .bgrid 外部（.review-board 内部），
// 不影响网格布局。.review-board 添加 padding 为标签预留空间。SVG 叠加层位置同步调整。
//
// 标签尺寸 (_rvLabelW/_rvLabelH/_rvLabelGap/_rvBoardPx) 已在上方 .review-board 开启前
// 计算（Phase 83），此处仅计算字体大小和构建标签 HTML 字符串。
const _rvCoordFontSize=Math.max(8,Math.floor(_rvCell*0.25));
const _rvLabelFontSize=Math.max(10,Math.floor(_rvCell*0.25));
// 标签 HTML 字符串（稍后在 .bgrid 关闭后插入，作为 .review-board 的绝对定位子元素）
// 标签位于 .review-board 的 padding 区域：上方 a-h 行（top:0，padding-top 区域），
// 左侧 1-8 列（left:0，padding-left 区域）。.bgrid 自然流动到 padding 之后，即
// (padding-left, padding-top) = (_rvLabelW+_rvLabelGap, _rvLabelH+_rvLabelGap) 位置。
const _rvFileLabelsHtml=_buildRvFileLabels(flip,_rvLabelW,_rvLabelGap,_rvBoardPx,_rvLabelH,_rvLabelFontSize);
const _rvRankLabelsHtml=_buildRvRankLabels(flip,_rvLabelW,_rvLabelH,_rvLabelGap,_rvBoardPx,_rvLabelFontSize);
for(let r=0;r<8;r++){for(let c=0;c<8;c++){
const rr=flip?7-r:r;const cc=flip?7-c:c;
const p=rBoard[rr][cc];const isL=(r+c)%2===0;
let bg=isL?SQ_LIGHT:SQ_DARK;
// v1.0.2: Apply control map coloring in review mode
if(_rvCm){
  const e=_rvCm[rr][cc];
  if(e){
    const wc=e.white.length,bc=e.black.length;
    const myC=playerColor==='white'?wc:bc;
    const opC=playerColor==='white'?bc:wc;
    const net=myC-opC;
    const total=myC+opC;
    const adv=total>0?net/total:0;
    const str=Math.min(1,total/8);
    let hue;
    if(myC===0&&opC===0){
      bg='#3a2020';
    }else{
      if(adv>=0)hue=280-adv*60;else hue=280-adv*80;
      if(hue>=360)hue-=360;
      const sat=0.50+str*0.40;
      const lit=0.48-str*0.12;
      bg='hsl('+Math.round(hue)+','+Math.round(sat*100)+'%,'+Math.round(lit*100)+'%)';
    }
  }
}
// [%csl] square highlights. A square can carry MULTIPLE colors simultaneously
// (e.g. both B and Y). B/R/G use CSS box-shadow inset (3px) on the cell div,
// stacked via comma-separated shadows. Y uses a separate rounded-rect overlay
// div INSIDE the cell (emitted before the cell's </div> so position:absolute
// anchors correctly). The yellow overlay insets ~10% leaving corner gaps so
// B/R/G insets remain visible underneath.
let _boxShadowParts=[];
let _isYellowSquare=false;
if(_rvCslMap){
  const _sqKey=String.fromCodePoint(97+cc)+(8-rr);
  const _colors=_rvCslMap[_sqKey];
  if(_colors&&Array.isArray(_colors)){
    for(const _color of _colors){
      if(_color==='Y'){
        _isYellowSquare=true;
      }else{
        const _col=_RV_VA_COLORS[_color]||'#ffffff';
        _boxShadowParts.push('inset 0 0 0 3px '+_col+',inset 0 0 6px '+_col+'66');
      }
    }
  }
}
let _boxShadow=_boxShadowParts.length?'box-shadow:'+_boxShadowParts.join(',')+';':'';
h+='<div style="background:'+bg+';'+_boxShadow+'width:'+_rvCell+'px;height:'+_rvCell+'px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;position:relative">';
// v1.2.0 Phase 77: 格子内坐标标注（与主界面同款，左上角偏移2px）
{
  const _sqName=String.fromCodePoint(97+cc)+(8-rr);
  const _coordColor=isL?'#4a3a0a':'#f0dcb0';
  const _coordStroke=isL?'rgba(255,230,150,.85)':'rgba(30,15,0,.85)';
  h+='<span style="position:absolute;left:2px;top:2px;font:'+_rvCoordFontSize+'px/'+_rvCoordFontSize+'px sans-serif;color:'+_coordColor+';text-shadow:0 0 2px '+_coordStroke+',0 0 2px '+_coordStroke+';pointer-events:none;z-index:1;user-select:none">'+_sqName+'</span>';
}
if(p){h+='<span class="'+(p.color==='white'?'rv-w':'rv-bk')+'" style="pointer-events:none;z-index:2">'+SYM[p.color][p.type]+'</span>';}
// Yellow rounded-rect overlay INSIDE the cell div (before </div>) so
// position:absolute anchors to THIS cell (position:relative). Multiple B/R/G
// box-shadow insets are on the cell div itself; the yellow overlay paints on
// top of them but insets ~10% so the B/R/G insets remain visible at corners.
// z-index:5 keeps it above cell background but below SVG arrow layer (z-index:10).
if(_isYellowSquare){
  const _inset=Math.max(3, _rvCell*0.10);
  const _radius=Math.max(3, _rvCell*0.15);
  const _yw=_rvCell-_inset*2;
  const _yh=_rvCell-_inset*2;
  h+='<div style="position:absolute;left:'+_inset.toFixed(1)+'px;top:'+_inset.toFixed(1)+'px;width:'+_yw.toFixed(1)+'px;height:'+_yh.toFixed(1)+'px;border-radius:'+_radius.toFixed(1)+'px;border:2px solid '+_RV_VA_COLORS.Y+';box-shadow:0 0 4px '+_RV_VA_COLORS.Y+'66;pointer-events:none;z-index:5"></div>';
}
// v1.0.8 PHASE 3: visible 🔁/⚡ markers on the review board
if(_rvVisibleCastle.has(String(rr*8+cc))){
  h+='<span class="setup-castle-mark" aria-hidden="true" style="font-size:'+(_rvCell*0.4).toFixed(1)+'px">🔁</span>';
}
if(_rvVisibleEp&&_rvVisibleEp.row===rr&&_rvVisibleEp.col===cc){
  h+='<span class="setup-ep-mark" aria-hidden="true" style="font-size:'+(_rvCell*0.4).toFixed(1)+'px">⚡</span>';
}
h+='</div>';
}}
h+='</div>'; // close .bgrid
// v1.2.0 Phase 83: Insert coordinate labels as absolute-positioned siblings of .bgrid.
// Labels are OUTSIDE .bgrid (in .review-board's padding area), so they don't
// participate in the CSS Grid layout. This fixes the Phase 77 bug where flex
// label wrappers inside .bgrid broke the grid's 64-cell layout.
h+=_rvFileLabelsHtml;
h+=_rvRankLabelsHtml;
// SVG arrow overlay for [%cal] visual annotations. Drawn when heatmap is OFF
// and the current review step has cached visual annotations with arrows. The
// SVG uses the same coordinate system as the bgrid (8*_rvCell pixels square),
// positioned absolutely over the board.
//
// v1.2.0 Phase 83: SVG position offset by (_rvLabelW+_rvLabelGap, _rvLabelH+_rvLabelGap)
// to align with .bgrid (which is in .review-board's padding box, after the label space).
//
// Arrow design (minimal): a thin colored line + small triangular arrowhead at
// the target end. The line's color communicates the type (B/Y/R/G). No origin
// dot, no round linecap — those added visual noise without information.
//
// Per-color diagonal offset (applied equally to start and end so arrow
// direction is preserved):
//   Blue  (B) → Upper-Left  (−X, −Y)
//   Yellow(Y) → Lower-Left  (−X, +Y)
//   Red   (R) → Upper-Right (+X, −Y)
//   Green (G) → Lower-Right (+X, +Y)
// These four distinct diagonal biases guarantee different-color arrows never
// overlap on the same line (they become parallel-but-distinct lines). Same-
// color arrows sharing the same source+target pair overlap exactly (correct —
// they represent the same threat). The offset magnitude is 12% of cell size,
// which scales proportionally across screen sizes and stays within cell bounds.
if(_rvCalList&&_rvCalList.length>0){
  // v1.2.0 Phase 83: _rvBoardPx already computed above; re-declaring would shadow.
  // SVG offset aligns it with .bgrid (after .review-board's padding for labels).
  const _rvSvgLeft=_rvLabelW+_rvLabelGap;
  const _rvSvgTop=_rvLabelH+_rvLabelGap;
  h+='<svg style="position:absolute;left:'+_rvSvgLeft+'px;top:'+_rvSvgTop+'px;width:'+_rvBoardPx+'px;height:'+_rvBoardPx+'px;pointer-events:none;z-index:10" width="'+_rvBoardPx+'" height="'+_rvBoardPx+'" viewBox="0 0 '+_rvBoardPx+' '+_rvBoardPx+'">';
  // Compact 4×3 triangular arrowhead per color. 4×3 is the smallest size that
  // still reads as a clear triangle at typical cell sizes (30-60px). refX=3.5
  // so the tip extends ~0.5px past the line endpoint (clean point, no overshoot).
  h+='<defs>';
  for(const _col of ['B','R','Y','G']){
    const _hex=_RV_VA_COLORS[_col];
    h+='<marker id="rvah-'+_col+'" markerWidth="4" markerHeight="3" refX="3.5" refY="1.5" orient="auto"><polygon points="0 0,4 1.5,0 3" fill="'+_hex+'"/></marker>';
  }
  h+='</defs>';
  // Offset magnitude: 12% of cell size (scales proportionally, no fixed cap).
  // Safety: max radial offset = |offset|*sqrt(2); safe bound = cellSize/2 - 2.75
  // (with strokeWidth=1.5, markerWidth=4). 12% is well within bound for all
  // realistic cell sizes (≥20px): cellSize=30 → 3.6px (max 8.66px); cellSize=60
  // → 7.2px (max 19.26px); cellSize=20 → 2.4px (max 5.12px).
  const _colorOffsetMag=_rvCell*0.12;
  const _colorOffset={
    B:{x:-_colorOffsetMag, y:-_colorOffsetMag}, // Upper-Left
    Y:{x:-_colorOffsetMag, y: _colorOffsetMag}, // Lower-Left
    R:{x: _colorOffsetMag, y:-_colorOffsetMag}, // Upper-Right
    G:{x: _colorOffsetMag, y: _colorOffsetMag}  // Lower-Right
  };
  // Deduplicate arrows by (color, from, to).
  const _seenArrowKeys=new Set();
  const _allArrows=[];
  for(const _a of _rvCalList){
    if(!_a||!_a.color||!_a.from||!_a.to)continue;
    if(_a.from.length!==2||_a.to.length!==2)continue;
    const _fc=_a.from.charCodeAt(0)-97, _fr=8-Number.parseInt(_a.from[1],10);
    const _tc=_a.to.charCodeAt(0)-97, _tr=8-Number.parseInt(_a.to[1],10);
    if(_fc<0||_fc>7||_fr<0||_fr>7||_tc<0||_tc>7||_tr<0||_tr>7)continue;
    const _dedupKey=_a.color+'|'+_a.from+'|'+_a.to;
    if(_seenArrowKeys.has(_dedupKey))continue;
    _seenArrowKeys.add(_dedupKey);
    _allArrows.push(_a);
  }
  // Render each arrow with the per-color diagonal offset.
  for(const _a of _allArrows){
    const _fc=_a.from.charCodeAt(0)-97, _fr=8-Number.parseInt(_a.from[1],10);
    const _tc=_a.to.charCodeAt(0)-97, _tr=8-Number.parseInt(_a.to[1],10);
    // Apply flip (display position)
    const _dfc=flip?7-_fc:_fc, _dfr=flip?7-_fr:_fr;
    const _dtc=flip?7-_tc:_tc, _dtr=flip?7-_tr:_tr;
    // Pixel centers — exact cell-center formula (scales with any cell size).
    let _fx=_dfc*_rvCell+_rvCell/2, _fy=_dfr*_rvCell+_rvCell/2;
    let _tx=_dtc*_rvCell+_rvCell/2, _ty=_dtr*_rvCell+_rvCell/2;
    // Apply per-color diagonal offset to BOTH start and end equally.
    const _co=_colorOffset[_a.color]||{x:0,y:0};
    _fx+=_co.x; _fy+=_co.y;
    _tx+=_co.x; _ty+=_co.y;
    // Shorten the line by 4px so the 4×3 arrowhead doesn't overshoot the
    // target cell center.
    const _dx=_tx-_fx, _dy=_ty-_fy, _len=Math.sqrt(_dx*_dx+_dy*_dy);
    const _sh=4, _rt=_len>0?(_len-_sh)/_len:1;
    const _ex=_fx+_dx*_rt, _ey=_fy+_dy*_rt;
    const _hex=_RV_VA_COLORS[_a.color]||'#ffffff';
    // Minimal arrow: 1.5px stroke, butt linecap, 0.9 opacity, 4×3 arrowhead.
    h+='<line x1="'+_fx.toFixed(1)+'" y1="'+_fy.toFixed(1)+'" x2="'+_ex.toFixed(1)+'" y2="'+_ey.toFixed(1)+'" stroke="'+_hex+'" stroke-width="1.5" stroke-opacity="0.9" stroke-linecap="butt" marker-end="url(#rvah-'+_a.color+')"/>';
  }
  h+='</svg>';
}
// v1.2.0 Phase 83: close .review-board (Phase 77's flex wrapper closing divs removed —
// the flex wrappers were inside .bgrid and broke the grid layout; labels are now
// absolute-positioned siblings of .bgrid, no extra wrappers to close).
h+='</div>'; // close .review-board

// v1.0.3 patch: build the eval bar, slider, chart, nav buttons, and analyze
// button HTML as STRINGS so they can be placed in either .review-left (portrait)
// or .review-bottom (landscape) depending on orientation.

// Rich eval display — reuse formatEval() for consistency with in-game eval bar
const _re=formatEval();
let _rDelta='';
if(_sfEvalReady&&!_evalLoading&&reviewStep>0){
  const _prevEv=_reviewEvalCache.get(reviewStep-1);
  if(_prevEv!=null) _rDelta=' '+_formatEvalDelta(_sfEval,_prevEv.eval);
}
// v1.0.4 Rev33: review eval bar now shows real-time depth (D), seldepth (SD),
// nodes, and nps — matching the main eval bar's display style. During active
// analysis (_evalLoading), the depth/seldepth/nodes/nps update in real-time
// via onEngineProgress; when analysis completes, the final values are shown.
// SD only shown when > 0 AND > depth (seldepth == depth is redundant).
// v1.0.8 PHASE 14: removed the .65rem font-size override so D/SD inherit the
// eval-bar title size (.75rem / .7rem). Keeps the bar visually uniform.
const _rDepthStr=_sfDepth>0?'<span style="color:var(--muted);margin-left:4px">D'+_sfDepth+'</span>'+(_sfSeldepth>0&&_sfSeldepth>_sfDepth?'<span style="color:var(--muted);margin-left:2px">SD'+_sfSeldepth+'</span>':''):'';
// v1.0.4 Rev33: real-time nodes + nps display during review analysis.
// v1.0.8 PHASE 14: removed the .6rem override (inherit title size).
let _rProgressStr='';
if(_evalLoading&&_sfDepth>0){
  let _rpp=[];
  if(_lastProgressNodes!=null){const _ns=_lastProgressNodes>=1000000?(_lastProgressNodes/1000000).toFixed(1)+'M':_lastProgressNodes>=1000?Math.round(_lastProgressNodes/1000)+'K':String(_lastProgressNodes);_rpp.push(_ns);}
  if(_lastProgressNps!=null){const _ns=_lastProgressNps>=1000000?(_lastProgressNps/1000000).toFixed(1)+'M/s':_lastProgressNps>=1000?Math.round(_lastProgressNps/1000)+'K/s':String(_lastProgressNps);_rpp.push(_ns);}
  if(_rpp.length)_rProgressStr='<span style="color:var(--muted);margin-left:3px">'+_rpp.join(' ')+'</span>';
}
// Build WDL string for review eval bar (same as main eval bar).
// v1.0.8 PHASE 14: removed the .65rem override (inherit title size).
let _rWdlStr='';
if(_sfWdlW>=0&&_sfWdlD>=0&&_sfWdlL>=0){const _rt=_sfWdlW+_sfWdlD+_sfWdlL;const _rw=Math.round(_sfWdlW/_rt*100);const _rd=Math.round(_sfWdlD/_rt*100);const _rl=100-_rw-_rd;_rWdlStr='<span style="color:var(--muted);margin-left:4px">('+_rw+'%W/'+_rd+'%D/'+_rl+'%L)</span>';}
// v1.0.8 PHASE 14: enlarge review eval-bar fonts and cap the bar's height
// so it never grows beyond a single line of text. Previously the bar used
// .62rem / .58rem with flex-wrap:wrap, which let long content (emoji + desc
// + score + D + SD + progress + WDL + delta) wrap to 2-3 lines and eat
// vertical space. Now:
//   - Title font: .75rem (portrait) / .7rem (landscape) — was .62 / .58
//   - Emoji: .95rem — was .78rem
//   - All child spans inherit the title size (removed the .58/.6/.65rem
//     overrides on depth/progress/WDL/delta so the bar reads uniformly)
//   - max-height + overflow:hidden + white-space:nowrap force exactly one
//     line; content that doesn't fit is clipped rather than wrapped
//   - flex-wrap removed (no longer needed)
// The landscape CSS override (.review-bottom #review-eval-bar) is updated
// to match — see index.html.tpl.
//
// v1.0.8 PHASE 20 (UX): Further enlarged fonts and min-height so text + emoji
// display fully with comfortable breathing room (was feeling cramped).
//   - Portrait eval bar: .75rem → .85rem; emoji .95rem → 1.1rem
//   - Landscape eval bar: .7rem → .8rem; emoji .95rem → 1.05rem
//   - max-height 1.9em → 2.4em (accommodate larger font + slight padding)
//   - padding 3px 8px → 5px 10px (more vertical breathing room)
//   - Analyze button font .7rem → .8rem; min-height 28px → 34px
// v1.1.0 Phase 53: Use the SAME font sizes for both portrait and landscape
// (previously portrait used .85rem/1.1rem, landscape used .8rem/1.05rem).
// The .review-bottom #review-eval-bar CSS rule also sets .8rem via !important,
// so this inline style is the fallback for when .review-bottom CSS hasn't
// loaded yet (first render).
const _rvEvalFontSize='.8rem';
const _rvEvalEmojiSize='1.05rem';
const _rvEvalBarHTML='<div class="ev" id="review-eval-bar" style="margin:2px 0;width:100%;box-sizing:border-box;font-size:'+_rvEvalFontSize+'!important;padding:5px 10px!important;gap:5px;max-height:2.4em;overflow:hidden;white-space:nowrap"><span class="ev-e" style="font-size:'+_rvEvalEmojiSize+'">'+_re.emoji+'</span><span>'+_re.desc+'</span><span style="color:var(--muted)">('+_re.score+')</span>'+_rDepthStr+_rProgressStr+_rWdlStr+_rDelta+'</div>';
// v1.2.3 round-20 (relocation): the round-19 standalone #review-batch-hint
//   line under the eval bar was replaced by a hint RIGHT-ALIGNED INSIDE the
//   "Analyze All" button itself (see _rvAnalyzeBtnInnerHTML below) — shown
//   only while _reviewAnalyzeAllActive. No separate DOM line anymore.

// Review step slider — custom slider with pixel-perfect alignment to chart data points.
// v1.1.0 Phase 54: Replaced the native <input type="range"> visual with a custom
// track/fill/thumb rendered as divs. The native input is now a transparent overlay
// (opacity:0) that handles all touch/drag/keyboard interaction.
//
// v1.1.0 Phase 54 (revision 2): Edge-to-edge alignment. Both the chart and slider
// now fill the full width — first data point at x=0 (left edge), last at x=width
// (right edge). The slider thumb center goes from 0% to 100%, matching the chart
// points exactly. The thumb (6px wide) overflows the container by 3px on each side
// at min/max; the container's overflow:visible lets the thumb show. The chart's
// first/last data point circles (r=2.75) are half-clipped by the chart container's
// overflow:hidden — this is the intended edge-to-edge look.
//
// ALIGNMENT MATH:
//   The slider wrapper has IDENTICAL CSS to the chart container (border:1px,
//   padding:2px, box-sizing:border-box, width:100%). So both have the same content
//   box width = W-6 (where W = .review-bottom content width).
//   The chart's SVG viewBox is 0 0 (W-6) _trendH with padding=0 (left/right), so:
//     - First data point at viewBox x=0 → at the left edge of the SVG content area
//     - Last data point at viewBox x=W-6 → at the right edge of the SVG content area
//   The slider container fills the wrapper's content box (width = W-6).
//   The thumb CENTER is at: calc(ratio * 100%) where ratio = reviewStep / maxStep.
//     - At ratio=0: thumbCenter = 0% = left edge = first data point ✓
//     - At ratio=1: thumbCenter = 100% = right edge = last data point ✓
//   The fill spans from 0 to the thumb's center.
const _rvSliderMax=reviewStates.length-1;
// Compute ratio for initial CSS calc positioning (avoids flicker before rAF).
// calc(ratio * 100%) places the thumb's CENTER at the correct position,
// matching the chart's data points at x=0 and x=width.
const _rvSliderRatio=_rvSliderMax>0?reviewStep/_rvSliderMax:0;
const _rvSliderThumbLeft='calc('+_rvSliderRatio+' * 100%)';
const _rvSliderFillW='calc('+_rvSliderRatio+' * 100%)';
const _rvSliderHTML='<div class="rv-slider-wrap">'+
  '<div class="rv-slider-container" id="rvSliderContainer">'+
    '<div class="rv-slider-base"></div>'+
    '<div class="rv-slider-fill" id="rvSliderFill" style="width:'+_rvSliderFillW+'"></div>'+
    '<div class="rv-slider-thumb" id="rvSliderThumb" style="left:'+_rvSliderThumbLeft+'"></div>'+
    '<input type="range" class="rv-slider-input" min="0" max="'+_rvSliderMax+'" value="'+reviewStep+'" oninput="reviewGoTo(Number.parseInt(this.value))" aria-label="'+T('review_move_slider')+'">'+
  '</div>'+
  '<div class="rv-slider-labels"><span>'+T('start_pos')+'</span><span>'+T('step_label')+' '+ reviewStep + ' / ' + _rvSliderMax + '</span><span>'+T('end_pos')+'</span></div>'+
  '</div>';

// v1.1.0 Phase 54: The slider thumb and fill positions are set via CSS calc()
// in the inline style (see _rvSliderHTML above). CSS calc() automatically
// adjusts on resize/orientation change (since 100% tracks the container width),
// so no JS post-render update is needed. This eliminates flicker on render
// and handles layout changes without requiring a re-render.

// Eval trend chart — v1.0.3 patch: in landscape, the chart now lives in
// .review-bottom which spans the FULL viewport width. This gives the chart
// a much wider canvas (edge-to-edge) than the previous design where it was
// squeezed under the board.
// v1.1.0 Phase 54 rev8: _buildEvalTrendSVG no longer takes width/height —
//   it uses a fixed viewBox="0 0 100 100" with preserveAspectRatio="xMidYMid
//   slice", so the SVG always fills the container edge-to-edge regardless of
//   the container's pixel dimensions. No width measurement needed. The chart
//   container's height (_trendH) is still needed for the container's CSS height.
// v1.0.8 PHASE 25 (portrait chart height fix): In portrait, the chart was
//   too tall (up to 200px), leaving too little room for the move list. Reduced
//   the portrait max to 120px (from 200px). Landscape unchanged (120-200px).
//   min stays 120px so the trend line + labels remain readable.
// v1.2.3 (S2703 fix): formula shared with _refreshEvalTrendChart via helper.
const _trendH = _computeTrendChartHeight();
// v1.1.0 Phase 54 rev11: Measure the existing .review-chart container's
//   clientWidth so the viewBox width == container pixel width. With
//   preserveAspectRatio="xMidYMid slice", when the viewBox aspect ratio
//   matches the container, "slice" scales 1:1 — no cropping, no gaps.
//   On first render (.review-chart doesn't exist yet), estimate from window.
let _trendW = Math.max(120, window.innerWidth - 28);
try{
  const _existingChart=document.querySelector('.review-chart');
  if(_existingChart){
    // clientWidth = content-box width (padding=0, so = border-box - 2px border)
    const _actualW=_existingChart.clientWidth;
    if(_actualW>0)_trendW=_actualW;
  }
}catch(e){/* measurement failed — use estimate */}
const _trendSVG = _buildEvalTrendSVG(_trendW, _trendH);
let _rvChartHTML='';
if (_trendSVG) {
  _rvChartHTML+='<div style="display:flex;justify-content:flex-start;padding:0 4px">';
  // v1.0.8 PHASE 25 (toggle fix): The previous code created a CUSTOM inline
  //   dot <div> inside .toggle-sw, which conflicted with the .toggle-sw::after
  //   CSS pseudo-element (both rendered a dot → two dots, visual glitch).
  //   Fix: use the standard .toggle / .toggle-sw classes without the inline
  //   dot div — the ::after pseudo-element handles the dot correctly, with
  //   proper theme colors via --toggle-dot / --toggle-dot-on / --toggle-on-bg.
  _rvChartHTML+='<div class="toggle" style="font-size:.6rem;padding:2px 4px;gap:4px" onclick="_reviewEvalGlobal=!_reviewEvalGlobal;HapticManager.fire(_reviewEvalGlobal?\'TOGGLE_ON\':\'TOGGLE_OFF\');render()"><span>'+T('chart_global')+'</span><div class="toggle-sw sm'+(_reviewEvalGlobal?' on':'')+'"></div></div>';
  _rvChartHTML+='</div>';
  _rvChartHTML+='<div class="review-chart" style="width:100%;height:'+_trendH+'px;margin:4px 0;background:var(--input-bg);border:1px solid var(--border);border-radius:4px;padding:0;overflow:hidden">';
  _rvChartHTML+=_trendSVG;
  _rvChartHTML+='</div>';
}

// Nav buttons — v1.0.3 patch: wrapped in .review-nav for landscape stretching
const _rvNavHTML='<div class="review-nav" style="display:flex;gap:4px;margin-top:6px">'+
  '<button class="btn btn-d" onclick="reviewGoTo(0)">⏮</button>'+
  '<button class="btn btn-d" onclick="reviewGoTo(Math.max(0,reviewStep-1))">◀</button>'+
  '<button class="btn btn-d" onclick="reviewGoTo(Math.min(reviewStates.length-1,reviewStep+1))">▶</button>'+
  '<button class="btn btn-d" onclick="reviewGoTo(reviewStates.length-1)">⏭</button>'+
  '</div>';
// v1.1.0 Phase 54 rev16: nav buttons now force scrollIntoView even when the
//   target step equals the current step (e.g. ▶ at last step, ⏮ at step 0).
//   reviewGoTo() clamps the step, so calling reviewGoTo(reviewStep) at the
//   boundary is a no-op for reviewStep but still triggers render(). The
//   _lastReviewStepScrolled guard would skip scrollIntoView in that case.
//   Fix: force _lastReviewStepScrolled=-2 in reviewGoTo so the guard always
//   fires and scrollIntoView runs.

// Analyze-all button.
// v1.0.6 FIX: _totalSteps was moveRecords.length (off-by-one — reviewStates
// includes the initial position at index 0, so a fully-analyzed game has
// moveRecords.length cache entries for steps 1..N). This caused
// "全部分析完成" to never display after PGN re-import.
// v1.0.8 PHASE 15: Analyze-all now includes step 0 (the initial position).
// Rationale: the eval of the initial position is genuinely useful — it's
// the baseline against which the first move's delta is computed, and
// without it the first move in the move list shows no delta/classification
// (the _prevMvEval=peek(0) lookup returns null). Including step 0 makes
// the move list complete and the trend chart start from x=0 with a real
// data point instead of a gap.
// _totalSteps is now moveRecords.length + 1 (steps 0..N, inclusive).
// v1.0.8 PHASE 17: Button now has id="review-analyze-btn" so _updateReviewAnalyzeBtn()
// can refresh its label in-place after each manual eval (without a full re-render).
// Previously, when the user manually evaluated each step by clicking through the
// move list, the cache was filled by onEngineEval but the button text stayed at
// "Analyze All Steps N (k/N+1)" instead of switching to "All Analyzed" once
// complete. The id + helper function close this gap.
const _cachedCount=_reviewEvalCache.size;
const _totalSteps=moveRecords.length+1;
const _allCached=_cachedCount>=_totalSteps;
// v1.0.8 PHASE 20 (UX): Enlarged font .7rem → .8rem and min-height 28px → 34px
// so the button text + emoji display fully with comfortable breathing room.
const _rvAnalyzeHTML='<button id="review-analyze-btn" class="btn" style="margin-top:4px;width:100%;font-size:.8rem;min-height:34px;padding:6px 10px;display:flex;align-items:center;justify-content:space-between;gap:8px" onclick="reviewAnalyzeAll()">'+_rvAnalyzeBtnInnerHTML()+'</button>';

// v1.0.8 PHASE 18 Task 2: Enable virtual list when the move list exceeds the
// threshold. When enabled, only the visible window (plus overscan) is rendered
// as DOM nodes; the rest are represented by top/bottom spacer <div>s so the
// scrollbar still reflects the full content height.
//
// v1.0.8 PHASE 18 Task 3 (bug fix): Only force the window to contain the
// active step when reviewStep CHANGED (not on every render). Previously, every
// render forced the window to the active step — discarding the user's scroll
// position and causing a flicker (active-step rows → blank spacer → user-scrolled
// rows). Now we track _lastRenderReviewStep and only re-center when the step
// v1.1.0 Phase 54 rev14: Virtual list disabled (RV_VIRTUAL_THRESHOLD=Infinity).
//   Always render the full move list — no windowing, no spacers.
_rvVirtualState.enabled=moveRecords.length>RV_VIRTUAL_THRESHOLD;
_rvVirtualState.windowStart=0;
_rvVirtualState.windowEnd=moveRecords.length;
const _rvStart=_rvVirtualState.windowStart;
const _rvEnd=_rvVirtualState.windowEnd;

// v1.1.0 Phase 53 (round-12 S3923 cleanup): Unified layout — both portrait and
// landscape close .review-left, emit .review-moves, close .review-top, then open
// .review-bottom with the eval bar + slider + chart + nav + analyze controls.
// The previous if/else produced identical markup in both branches; the only
// remaining orientation-specific logic is the cell-width calculation above.
h+='</div>'; // close .review-left
// v1.0.8 PHASE 18 Task 2: _buildReviewMovesInnerHTML centralizes the row-rendering
// code and the virtual-list spacer logic in one place.
h+='<div class="review-moves" id="reviewMovesList">';
h+=_buildReviewMovesInnerHTML(_rvStart,_rvEnd);
h+='</div>'; // close .review-moves
h+='</div>'; // close .review-top
// .review-bottom: full-width chart + controls, edge-to-edge
h+='<div class="review-bottom">';
h+=_rvEvalBarHTML;
h+=_rvSliderHTML;
h+=_rvChartHTML;
h+=_rvNavHTML;
h+=_rvAnalyzeHTML;
h+='</div>'; // close .review-bottom
h+='</div></div>'; // close .review-body, .review-overlay
return{h,done:false};
} // end _renderReviewMode

/**
 * v1.2.0 Phase 82++: Render the main game board grid (file/rank labels + 8×8 cells).
 *
 * Extracted from renderInternal() to further reduce God Function size. Renders:
 *   - File labels (a-h) row above the board
 *   - Rank labels (1-8) column left of the board
 *   - .bgrid container with 8×8 square cells
 *   - Per cell: background color, piece glyph, legal-move dot/ring, castling-rook
 *     marker, check highlight, castle-rights (🔁) and en-passant (⚡) badges,
 *     square coordinate label
 *
 * Uses global state only (gameState, selectedSquare, legalMvs, legalSet, lastMove,
 * reviewMode, CELL, SQ_SEL, LBL_*, SYM, etc.). The flip flag and control map (cm)
 * are passed as parameters because they are local to renderInternal.
 *
 * @param {string} h - Current HTML string
 * @param {boolean} flip - Whether the board is flipped (playerColor === 'black')
 * @param {Object|null} cm - Cached control map (from cachedCtrlMap)
 * @returns {string} h with board grid HTML appended
 */
function _renderBoardGrid(h, flip, cm){
h+=`<div class="flbl" style="margin-left:28px">${(flip?'hgfedcba':'abcdefgh').split('').map(f=>`<span style="width:${CELL}px">${f}</span>`).join('')}</div>`;
h+=`<div style="display:flex"><div class="rlbl">${(flip?'12345678':'87654321').split('').map(r=>`<span style="height:${CELL}px">${r}</span>`).join('')}</div>`;
h+=`<div class="bwrap"><div class="bgrid" id="board-grid" role="grid" aria-label="${T('board')}" style="grid-template-columns:repeat(8,${CELL}px);grid-template-rows:repeat(8,${CELL}px)">`;
// Determine check state for king highlighting
let _checkKingPos=getCheckKingPos(gameState);
// v1.0.6: Identify castling rook squares for the selected king (if any).
// These squares get a distinct golden ring marker so the user knows they
// can click the rook to trigger castling (essential for Chess960).
// v1.0.6 OPTIMIZATION: _getCastlingRookSquares() was redundantly re-iterating
// legalMvs and re-calling chess960CastlingRookMove() to reconstruct the 'side'
// field that _computeCastlingRookSetForSelection already computed but discarded.
// Since renderInternal only needs the Set of row*8+col keys (the .side field
// was never used), we now call _computeCastlingRookSetForSelection directly.
const _castlingRookSet=_computeCastlingRookSetForSelection(selectedSquare,legalMvs);
// v1.0.8 PHASE 3: Compute visible 🔁 / ⚡ markers ONCE per render pass.
// These are derived from gameState.castlingRights / gameState.enPassantTarget
// (during play) or from the user's setupCastleMarks / setupEpMark (during
// setup mode). See computeVisibleCastleMarks/computeVisibleEpMark in
// game-logic.js. The markers display in setup and play modes.
// In review mode the main board is covered by the .review-overlay (a
// 98%-opaque fixed-position layer), so we skip the computation for the main
// board here as a minor performance optimization — the review board renders
// its own markers from rs.state.
const _visibleCastleMarks=(!reviewMode&&typeof computeVisibleCastleMarks==='function')?computeVisibleCastleMarks(gameState):new Set();
const _visibleEpMark=(!reviewMode&&typeof computeVisibleEpMark==='function')?computeVisibleEpMark(gameState):null;
for(let r=0;r<8;r++){for(let c=0;c<8;c++){
const rr=flip?7-r:r;const cc=flip?7-c:c;
const p=gameState.board[rr][cc];const isL=(r+c)%2===0;
let bg=_getSqBg(rr,cc,cm,isL,lastMove);if(selectedSquare&&rr===selectedSquare.row&&cc===selectedSquare.col)bg=SQ_SEL;
const lastFrom=lastMove&&rr===lastMove.from.row&&cc===lastMove.from.col;
const lastTo=lastMove&&lastMove.to.row===rr&&lastMove.to.col===cc;
const isLegal=legalSet.has(rr*8+cc);
const isCheckSq=_checkKingPos&&rr===_checkKingPos.row&&cc===_checkKingPos.col;
const isCastlingRook=_castlingRookSet.has(rr*8+cc);
// v1.0.8 PHASE 3: visible markers (work in all modes — setup, play, review)
const hasCastleMark=_visibleCastleMarks.has(String(rr*8+cc));
const hasEpMark=_visibleEpMark&&_visibleEpMark.row===rr&&_visibleEpMark.col===cc;
const lbl=String.fromCodePoint(97+cc)+(8-rr);
h+=`<div class="sq${lastFrom?' last-from':''}${lastTo?' last-to':''}${isCheckSq?' in-check':''}${isCastlingRook?' castle-rook':''}" role="gridcell" style="background:${bg}" data-r="${rr}" data-c="${cc}" onclick="sqClick(${rr},${cc})">`;
h+=`<span class="lbl" style="color:${isL?LBL_LIGHT:LBL_DARK};-webkit-text-stroke:.6px ${isL?LBL_STROKE_LIGHT:LBL_STROKE_DARK};paint-order:stroke fill;text-shadow:0 0 2px ${isL?LBL_STROKE_LIGHT:LBL_STROKE_DARK}">${lbl}</span>`;
// v1.0.8 PHASE 22: landing animation removed — the Web Animations API
//   overlay (created in animateMove) handles the entire piece-move motion.
//   The destination square's piece is rendered normally here; the overlay
//   sits on top until animateMove's _finishAnim removes it.
if(p){
h+=`<span class="pc ${p.color==='white'?'w':'bk'}">${SYM[p.color][p.type]}</span>`;
}
if(isLegal&&!p)h+=`<div class="dot"></div>`;
if(isLegal&&p&&!isCastlingRook)h+=`<div class="ring"></div>`;
// v1.0.6: Castling rook marker — a golden dashed ring (distinct from the
// solid green capture ring) that signals "click me to castle". Style
// matches the existing ring/dot design language (CSS in index.html.tpl).
if(isCastlingRook)h+=`<div class="castle-ring"></div>`;
// v1.0.8 PHASE 3: 🔁 castle-rights marker and ⚡ en-passant marker.
// Both render as a small badge anchored to the bottom-right corner of the
// square, so they don't obstruct the piece glyph (centered) or the legal-
// move ring (also centered). See .sq .setup-castle-mark / .sq .setup-ep-mark
// in index.html.tpl for the styling.
// These markers now display in ALL modes (setup, play, review), derived from
// gameState.castlingRights / gameState.enPassantTarget by computeVisibleCastleMarks
// / computeVisibleEpMark (called once per render pass above). Markers auto-
// remove when the underlying rights/target are lost (e.g., after the king or
// rook moves, or after the en-passant opportunity passes).
if(hasCastleMark)h+=`<span class="setup-castle-mark" aria-hidden="true">🔁</span>`;
if(hasEpMark)h+=`<span class="setup-ep-mark" aria-hidden="true">⚡</span>`;
h+=`</div>`}}
h+=`</div>`;
return h;
} // end _renderBoardGrid

/**
 * v1.2.0 Phase 82++: Render the setup mode panel (piece buttons, color/turn selectors,
 * undo/redo/reset/clear buttons, copy/import FEN buttons, setup errors).
 *
 * Extracted from renderInternal() to further reduce God Function size. Renders the
 * setup-mode control panel below the board when setupMode is true. The panel allows
 * the user to place/remove pieces, toggle castle-rights (🔁) and en-passant (⚡)
 * markers, select piece color and side-to-move, undo/redo setup actions, reset/clear
 * the board, and copy/import FEN.
 *
 * Uses global state only (setupMode, gameState, CELL, T, setupPiece, setupColor,
 * setupMarkerMode, setupHistory, setupRedoStack, setupErrors, etc.).
 *
 * @param {string} h - Current HTML string
 * @returns {string} h with setup panel HTML appended (if setupMode is true)
 */
function _renderSetupPanel(h){
if(setupMode){
const spPieces=[{t:'pawn',w:'♙\uFE0E',b:'♟\uFE0E'},{t:'knight',w:'♘\uFE0E',b:'♞\uFE0E'},{t:'bishop',w:'♗\uFE0E',b:'♝\uFE0E'},{t:'rook',w:'♖\uFE0E',b:'♜\uFE0E'},{t:'queen',w:'♕\uFE0E',b:'♛\uFE0E'},{t:'king',w:'♔\uFE0E',b:'♚\uFE0E'}];
// v1.0.8: Ensure setupCastleMarks (Set) and setupEpMark ({row,col}|null) exist
// on gameState. They are the source of truth for the manual 🔁 castle markers
// and the ⚡ en-passant marker. Initialize once per setup session if missing.
if(!gameState.setupCastleMarks||!(gameState.setupCastleMarks instanceof Set))gameState.setupCastleMarks=new Set();
if(typeof gameState.setupEpMark==='undefined')gameState.setupEpMark=null;
h+=`<div class="setup-panel" style="width:${8*CELL+8}px;max-width:100%;box-sizing:border-box"><div class="setup-row" style="justify-content:flex-start"><span class="setup-label">${T('piece')}</span>`;
// v1.0.8 PHASE 8: piece buttons toggle — clicking the already-selected piece
// again deselects it (sets setupPiece=null). This matches the behavior of the
// 🔁 and ⚡ marker buttons.
for(const p of spPieces)h+=`<button class="setup-btn${setupPiece===p.t?' act':''} ${setupColor==='white'?'sw':'sb'}" onclick="setupPiece=(setupPiece==='${p.t}'?null:'${p.t}');render()">${setupColor==='white'?p.w:p.b}</button>`;
// v1.0.8: 🔁 castle-rights marker toggle + ⚡ en-passant marker toggle.
// v1.0.8 PHASE 8: 🗑️ delete button is MUTUALLY EXCLUSIVE with 🔁 and ⚡ markers.
// Selecting 🗑️ clears any active marker mode, and selecting a marker clears 🗑️.
// Piece selection and marker selection remain independent (can co-exist),
// but 🗑️ cannot co-exist with either marker because deleting a piece also
// clears its markers — mixing them would be confusing.
h+=`<button class="setup-btn${setupMarkerMode==='castle'?' act':''}" onclick="HapticManager.fire(&apos;BUTTON_PRESS&apos;);setupMarkerMode=(setupMarkerMode==='castle'?null:'castle');if(setupMarkerMode&&setupPiece==='delete')setupPiece=null;render()" title="${T('setup_castle_marker_tip')}" aria-label="${T('setup_castle_marker')}" style="font-size:1.2rem">🔁</button>`;
h+=`<button class="setup-btn${setupMarkerMode==='ep'?' act':''}" onclick="HapticManager.fire(&apos;BUTTON_PRESS&apos;);setupMarkerMode=(setupMarkerMode==='ep'?null:'ep');if(setupMarkerMode&&setupPiece==='delete')setupPiece=null;render()" title="${T('setup_ep_marker_tip')}" aria-label="${T('setup_ep_marker')}" style="font-size:1.2rem;font-variant-emoji:emoji;-webkit-font-variant-emoji:emoji">⚡</button>`;
h+=`<button class="setup-del${setupPiece==='delete'?' act':''}" onclick="setupPiece=(setupPiece==='delete'?null:'delete');if(setupPiece==='delete')setupMarkerMode=null;render()">🗑️</button></div>`;
// v1.0.8: small-font usage hints for the two new marker buttons.
h+=`<div class="setup-row" style="justify-content:center;gap:8px;margin-top:2px"><span style="font-size:.62rem;color:var(--muted);line-height:1.3;text-align:center;flex:1 1 100%;word-break:break-word">${T('setup_castle_marker_tip')}</span></div>`;
h+=`<div class="setup-row" style="justify-content:center;gap:8px;margin-top:2px"><span style="font-size:.62rem;color:var(--muted);line-height:1.3;text-align:center;flex:1 1 100%;word-break:break-word">${T('setup_ep_marker_tip')}</span></div>`;
h+=`<div class="setup-row"><span class="setup-label">${T('color')}</span><button class="setup-clr${setupColor==='white'?' act':''}" onclick="setupColor='white';render()">${T('white_side')}</button><button class="setup-clr${setupColor==='black'?' act':''}" onclick="setupColor='black';render()">${T('black_side')}</button></div>`;
h+=`<div class="setup-row"><span class="setup-label">${T('turn_side')}</span><button class="setup-clr${gameState.currentTurn==='white'?' act':''}" onclick="gameState.currentTurn='white';_refreshStateAfterSetup(gameState);render()">${T('white_side')}</button><button class="setup-clr${gameState.currentTurn==='black'?' act':''}" onclick="gameState.currentTurn='black';_refreshStateAfterSetup(gameState);render()">${T('black_side')}</button></div>`;
h+=`<div class="setup-row" style="justify-content:center;gap:12px"><button class="btn" onclick="undoSetupClick()"${setupHistory.length===0?' disabled style="opacity:0.4"':''}><span style="font-size:1.4rem">↩️</span> ${T('undo_setup')}</button><button class="btn" onclick="redoSetupClick()"${setupRedoStack.length===0?' disabled style="opacity:0.4"':''}><span style="font-size:1.4rem">↪️</span> ${T('redo_setup')}</button><button class="btn" onclick="gameState=initState();gameState.moveHistory=[];setupErrors=[];setupHistory=[];setupRedoStack=[];gameState.setupCastleMarks=new Set([String(7*8+0),String(7*8+7),String(0*8+0),String(0*8+7)]);gameState.setupEpMark=null;render()"><span style="font-size:1.4rem">♻️</span> ${T('reset_board')}</button><button class="btn" onclick="for(let r=0;r<8;r++)for(let c=0;c<8;c++)gameState.board[r][c]=null;gameState.wk=null;gameState.bk=null;gameState.enPassantTarget=null;gameState.halfMoveClock=0;gameState.setupCastleMarks=new Set();gameState.setupEpMark=null;_refreshStateAfterSetup(gameState);setupErrors=[];setupHistory=[];setupRedoStack=[];render()"><span style="font-size:1.4rem">🧹</span> ${T('clear_board')}</button></div><div class="setup-row" style="justify-content:center;gap:8px;margin-top:6px"><button class="btn" onclick="copyFEN()"><span style="font-size:1.4rem">📝</span> ${T('copy_fen_btn')}</button><button class="btn" onclick="_importFENWithSaveCheck()"><span style="font-size:1.4rem">📋</span> ${T('import_fen_btn')}</button></div></div>`;
if(setupErrors.length>0)h+=`<div class="setup-errors"><strong>${T('setup_error_title')}</strong><ul>${setupErrors.map(e=>`<li>${_esc(e)}</li>`).join('')}</ul><button class="btn" onclick="setupErrors=[];render()" style="margin-top:4px">${T('understood')}</button></div>`;
}
return h;
} // end _renderSetupPanel

/**
 * v1.2.0 Phase 82++: Render the side panel (control info, ECO info, move history, tips).
 *
 * Extracted from renderInternal() to further reduce God Function size. Renders the
 * right-side .panel container with four cards:
 *   1. Control info card (when showCtrlMap is on) — square control breakdown
 *   2. ECO opening info card (when _ecoEnabled and not Chess960)
 *   3. Move history card — PGN-format move list with copy/export/stats buttons
 *   4. Tips card — chess principles
 *
 * Uses global state only (showCtrlMap, gameState, playerColor, _ecoEnabled,
 * gameVariant, moveRecords, showVariations, etc.). The infoSq, infoCtrl, and oppC
 * values are passed as parameters because they are local to renderInternal.
 *
 * @param {string} h - Current HTML string
 * @param {Object|null} infoSq - Hovered or selected square ({row, col} or null)
 * @param {Object|null} infoCtrl - Control map entry for infoSq ({white, black} or null)
 * @param {string} oppC - Opponent color ('white' or 'black')
 * @returns {string} h with side panel HTML appended
 */
function _renderSidePanel(h, infoSq, infoCtrl, oppC){
h+=`<div class="panel" role="complementary">`;
// Control info
if(showCtrlMap){
h+=`<div class="card" id="ctrl-info-card"><div class="card-t"><span class="ico">📍</span>${T('ctrl_info')}</div>`;
if(infoSq){const al=posAlg(infoSq);const pc=gameState.board[infoSq.row][infoSq.col];const wt=infoCtrl?infoCtrl.white.length:0;const bt=infoCtrl?infoCtrl.black.length:0;
const myCtrl=playerColor==='white'?wt:bt;const opCtrl=playerColor==='white'?bt:wt;const netCtrl=myCtrl-opCtrl;
h+=`<div class="crow"><span class="lb">${T('cur_square')}</span><span class="vl">${al} ${pc?pieceName(pc.type):''}</span></div>`;
h+=`<div class="crow"><span class="lb">${T('total_ctrl')}</span><span class="vl">${wt+bt}</span></div>`;
h+=`<div class="crow"><span class="lb">${T('my_ctrl')}</span><span class="vl b">${myCtrl}</span></div>`;
h+=`<div class="crow"><span class="lb">${T('op_ctrl')}</span><span class="vl r">${opCtrl}</span></div>`;
h+=`<div class="crow"><span class="lb">${T('net_ctrl')}</span><span class="vl ${netCtrl>0?'b':netCtrl<0?'r':''}">${netCtrl>0?'+':''}${netCtrl}</span></div>`;
if(infoCtrl){h+=`<div class="plist">`;for(const c of infoCtrl[playerColor])h+=`<div class="pitem"><span class="dot2 b"></span>${pieceName(c.piece.type)}@${posAlg(c.position)}</div>`;for(const c of infoCtrl[oppC])h+=`<div class="pitem"><span class="dot2 r"></span>${pieceName(c.piece.type)}@${posAlg(c.position)}</div>`;h+=`</div>`}}
else{h+=`<div style="color:#64748b;font-size:.85rem">${T('click_sq')}</div>`}
h+=`</div>`;}
// ECO Opening Info (only when _ecoEnabled)
// v1.0.6: Also suppress in Chess960 mode (no fixed opening theory).
if(_ecoEnabled&&!(gameVariant !== undefined&&gameVariant==='chess960')){
const ecoInfo=queryECO(gameState);
if(ecoInfo){h+=`<div class="card"><div class="card-t"><span class="ico">📖</span>${T('eco_id')}</div><div style="padding:12px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span class="opening-tag">${_esc(ecoInfo.id)}</span><span style="font-weight:600;font-size:.9rem">${_esc(ecoInfo.name)}</span></div><div style="color:var(--muted);font-size:.82rem">${_esc(ecoInfo.family)}</div></div></div>`}
}

// Move history
h+=`<div class="card"><div class="card-t"><span class="ico">📜</span>${T('move_history')}<button class="btn" style="margin-left:auto;padding:3px 10px;font-size:.7rem;min-height:24px" onclick="copyMoveHistory()" title="${T('pgn_copied')||'Copy PGN'}">📝 PGN</button><button class="btn" style="margin-left:4px;padding:3px 10px;font-size:.7rem;min-height:24px" onclick="exportPGNToFile()" title="${T('export_pgn')||'Export PGN to file'}">💾</button><button class="btn" style="margin-left:4px;padding:3px 10px;font-size:.7rem;min-height:24px" onclick="openStatsPage()" title="${T('stats')}">📊</button><div class="toggle" style="margin-left:6px;padding:2px 6px;font-size:.65rem" onclick="showVariations=!showVariations;HapticManager.fire(showVariations?'TOGGLE_ON':'TOGGLE_OFF');render()"><span>${T('variation_toggle')}</span><div class="toggle-sw sm${showVariations?' on':''}"></div></div></div><div class="mlist">`;
// v1.0.3: Use _importedStartMoveNum as the move-pair number offset, so PGN
// imports with [FEN "... w ... 4"] display "4. <move> 5. <move>" instead of
// "1. <move> 2. <move>". Defaults to 1 (standard initial position).
const _mvStartOffset=(typeof _importedStartMoveNum!=='undefined'&&_importedStartMoveNum>0)?_importedStartMoveNum:1;
// v1.0.3: pairs store the moveRecords index `i` so the onclick handlers can
// compute the correct reviewStep (= i + 1, since reviewStates[0] is the
// starting position) regardless of the FEN-based move-number offset.
const pairs=[];for(let i=0;i<moveRecords.length;i+=2){pairs.push({n:Math.floor(i/2)+_mvStartOffset,wi:i,bi:i+1,w:moveRecords[i],b:moveRecords[i+1]})}
for(const pr of pairs){h+='<div class="mrow"><span class="mnum">'+pr.n+'.</span>';if(pr.w){h+='<span class="mw" onclick="if(!isAIThinking&&!setupMode&&!reviewMode){showNewGameDialog=false;enterReview();reviewGoTo('+(pr.wi+1)+');event.stopPropagation()}">'+_esc(pr.w.notation)+(pr.w.time?'<span style="font-size:.6rem;color:var(--muted);margin-left:2px">'+pr.w.time+'s</span>':'')+'</span>';if(showVariations&&pr.w&&pr.w.variations&&pr.w.variations.length>0){h+=_formatVariationGroups(pr.w.variations,pr.n,true);}}else if(pr.w===null){h+='<span class="mw" style="opacity:.55;font-style:italic" title="'+T('white_concedes_move')+'">...</span>';}if(pr.b){h+='<span class="mb" onclick="if(!isAIThinking&&!setupMode&&!reviewMode){showNewGameDialog=false;enterReview();reviewGoTo('+(pr.bi+1)+');event.stopPropagation()}">'+_esc(pr.b.notation)+(pr.b.time?'<span style="font-size:.6rem;color:var(--muted);margin-left:2px">'+pr.b.time+'s</span>':'')+'</span>';if(showVariations&&pr.b&&pr.b.variations&&pr.b.variations.length>0){h+=_formatVariationGroups(pr.b.variations,pr.n,false);}}h+='</div>'}
if(!pairs.length)h+=`<div style="color:#64748b;font-size:.85rem;cursor:pointer;padding:4px 0;text-decoration:underline dotted rgba(100,116,139,.4);text-underline-offset:3px" onclick="if(!isAIThinking&&!setupMode&&!reviewMode){showNewGameDialog=false;enterReview();event.stopPropagation()}" title="${T('enter_review_hint')}">${T('no_moves')}</div>`;
h+=`</div></div>`;
// Tips
h+=`<div class="card"><div class="card-t"><span class="ico">💡</span>${T('chess_tips')}</div><div class="tips">`;
h+=_principlesHTML();
h+=`</div></div>`;
h+=`</div></div>`;
return h;
} // end _renderSidePanel

/**
 * v1.2.1: Compute the render state shared across all render sub-functions.
 * Fixes critical scoping bug where oppC/flip/cm/infoSq/infoCtrl were declared
 * inside _renderHeader() and inaccessible to other sub-functions.
 */
function _computeRenderState(){
if(!gameState||!gameState.board){console.error('renderInternal: gameState is invalid, resetting');gameState=initState();stateHistory=[];_redoStack=[];}
if(setupMode){gameOver=null;_gameOverStatusKey=null;}
if(gameOver&&_gameOverStatusKey){const _reLocStr=_gameOverStrFromStatus(_gameOverStatusKey);if(_reLocStr)gameOver=_reLocStr;}
if(!gameOver&&!setupMode&&!isAIThinking&&!reviewMode){const _gsKey=gameState.hash+'|'+gameState.currentTurn;if(_cachedStatusKey!==_gsKey){_cachedStatus=gameStatus(gameState);_cachedStatusKey=_gsKey;}_applyGameOver(_cachedStatus);}
// v1.2.3 round-18 (perf): skip the main-board control map entirely in review
//   mode — the main board isn't rendered then, and the review board maintains
//   its own cache key below. Previously both paths shared cachedCtrlKey/
//   cachedCtrlMap and ping-ponged between the main and review position
//   hashes, forcing TWO full getCtrlMap() recomputes per render while
//   reviewing with 🌈 enabled.
let cm=null;
if(showCtrlMap&&!reviewMode){
  const ctrlKey=gameState.hash;
  if(ctrlKey!==cachedCtrlKey){cachedCtrlMap=getCtrlMap(gameState.board);cachedCtrlKey=ctrlKey;}
  cm=cachedCtrlMap;
}
const infoSq=hoveredSquare||selectedSquare;let infoCtrl=null;
if(infoSq&&cm){const e=cm[infoSq.row][infoSq.col];if(e)infoCtrl=e;}
const oppC=OPP_COLOR[playerColor];
const flip=playerColor==='black';
return {cm, infoSq, infoCtrl, oppC, flip};
} // end _computeRenderState

/**
 * v1.2.0 Phase 82++: Render the header toolbar (app title, eval display, difficulty
 * selector, new game / free play / sound / FEN / import / setup buttons).
 *
 * Extracted from renderInternal() to further reduce God Function size. Computes the
 * eval display (emoji, description, score, depth, seldepth, nodes, nps) and builds
 * the .hdr toolbar HTML string. This is the FIRST h contribution — the function
 * initializes h and returns it.
 *
 * Uses global state only (formatEval, _sfDepth, _sfSeldepth, _evalLoading,
 * _lastProgressNodes, _lastProgressNps, T, _lang, setupMode, isAIThinking,
 * getAI_LEVELS, getEffectiveAILevel, playerColor, soundOn, etc.).
 *
 * @returns {string} h — the header toolbar HTML string (caller continues appending)
 */
function _renderHeader(){
const _fe=formatEval();const pe=_fe.emoji,pd=_fe.desc,scoreStr=_fe.score;
// v1.0.4 Rev33: display "D15 SD22" — depth + seldepth (tactical depth).
// SD only shown when > 0 AND > depth (seldepth == depth is redundant).
const _hdrDepthStr=_sfDepth>0?'<span style="font-size:.65rem;color:var(--muted);margin-left:4px">D'+_sfDepth+'</span>'+(_sfSeldepth>0&&_sfSeldepth>_sfDepth?'<span style="font-size:.65rem;color:var(--muted);margin-left:2px">SD'+_sfSeldepth+'</span>':''):'';
let _hdrProgressStr='';if(_evalLoading&&_sfDepth>0){let _hpp=[];if(_lastProgressNodes!=null){const _ns=_lastProgressNodes>=1000000?(_lastProgressNodes/1000000).toFixed(1)+'M':_lastProgressNodes>=1000?Math.round(_lastProgressNodes/1000)+'K':String(_lastProgressNodes);_hpp.push(_ns);}if(_lastProgressNps!=null){const _ns=_lastProgressNps>=1000000?(_lastProgressNps/1000000).toFixed(1)+'M/s':_lastProgressNps>=1000?Math.round(_lastProgressNps/1000)+'K/s':String(_lastProgressNps);_hpp.push(_ns);}if(_hpp.length)_hdrProgressStr='<span style="font-size:.6rem;color:var(--muted);margin-left:3px">'+_hpp.join(' ')+'</span>';}

// v1.2.1: Defensive checks, _applyGameOver, and cm/infoSq/infoCtrl/oppC/flip computation
// moved to _computeRenderState() to fix critical scoping bug.

let h='<div class="hdr" role="banner"><div class="hdr-top"><div class="hdr-l">'+_hdrKingIconHTML()+'<h1>'+T('app_name')+'<span class="ver">v1.2.3</span><button onclick="HapticManager.fire(&apos;BUTTON_PRESS&apos;);showAboutPage=true;render()" class="hdr-btn" style="margin-left:4px;cursor:pointer" aria-label="'+T('about')+'">ℹ️</button></h1></div><button onclick="toggleLang()" class="hdr-btn-lg" style="cursor:pointer">'+(_lang==='zh'?'↔️中':'↔️EN')+'</button><div class="ev" id="eval-disp" role="status" aria-label="'+T('evaluating')+'">'+(setupMode?T('setup_label'):(isAIThinking?'<span class="ev-e">⏳</span><span>'+T('analyzing')+'</span>':'<span class="ev-e">'+pe+'</span><span>'+pd+'</span><span style="color:var(--muted)">('+scoreStr+')</span>'+_hdrDepthStr+_hdrProgressStr))+'</div></div><div class="hdr-tools" role="toolbar" aria-label="'+T('ctrl_range')+'">'+(setupMode?'':'<div class="diff-sel" role="radiogroup" aria-label="AI">'+getAI_LEVELS().map(l=>'<button class="diff-b'+(getEffectiveAILevel()===l.id?' act':'')+'" onclick="setDifficultyLevel('+l.id+')" title="'+l.desc+'" role="radio" aria-checked="'+(getEffectiveAILevel()===l.id)+'">'+(l.id===8?'⚙️':l.id===7?('SL'+(function(){try{let _sl=20;if(typeof engineSettingsData!=='undefined'&&engineSettingsData&&engineSettingsData.skillLevel!=null)_sl=engineSettingsData.skillLevel;else if(typeof AndroidBridge!=='undefined'&&AndroidBridge.getEngineSkillLevel)_sl=AndroidBridge.getEngineSkillLevel();return _sl;}catch(e){return 20;}})()):l.id)+'</button>').join('')+'</div>')+'<button type="button" class="btn" onclick="showNewGameDialog=true;dlgPlayerColor=playerColor;dlgOpeningId=null;ecoShowCount=30;dlgBookMoves=useBookMoves;render()" aria-label="'+T('new_game')+'"><span style="font-size:1.4rem">⚔️</span> '+T('new_game')+'</button>'+'<button class="btn" onclick="quickFreeOpening()" aria-label="'+T('free_opening')+'">'+(playerColor==='white'?'<span style=\"font-size:1.4rem;font-weight:400;color:#E8E8F0;-webkit-text-stroke:.3px rgba(30,15,0,.85);text-shadow:0 0 .8px rgba(30,15,0,.55);font-family:&#x27;DejaVu Sans&#x27;,&#x27;Noto Sans&#x27;,&#x27;Segoe UI Symbol&#x27;,sans-serif;font-variant-emoji:text\">♔&#xFE0E;</span>':'<span style=\"font-size:1.4rem;font-weight:400;color:#1A1A2E;-webkit-text-stroke:.3px rgba(255,230,150,.85);text-shadow:0 0 .8px rgba(255,230,150,.55);font-family:&#x27;DejaVu Sans&#x27;,&#x27;Noto Sans Symbol&#x27;,sans-serif;font-variant-emoji:text\">♚&#xFE0E;</span>')+' '+T('free_opening')+'</button>'+(setupMode?'':'<button class="btn" onclick="toggleSound()" id="btnSound" aria-label="'+T('sound')+'">'+(soundOn?'<span style="font-size:1.4rem">🔊</span> '+T('sound'):'<span style="font-size:1.4rem">🔇</span> '+T('sound'))+'</button>')+'<button class="btn" onclick="copyFEN()" title="'+T('copy_fen')+'" aria-label="'+T('copy_fen')+'"><span style="font-size:1.4rem">📝</span> FEN</button><button class="btn" onclick="showImportDialog=true;render()" title="'+T('import_fen')+'" aria-label="'+T('import_fen')+'"><span style="font-size:1.4rem">🗃️</span> '+T('import_label')+'</button><button class="btn" onclick="'+(setupMode?'exitSetup()':'toggleSetup()')+'" aria-label="'+(setupMode?T('setup_done'):T('setup_mode'))+'">'+(setupMode?'<span style="font-size:1.4rem">✓</span> '+T('setup_done'):'<span style="font-size:1.4rem">🏗️</span> '+T('setup_mode'))+'</button></div></div>';
return h;
} // end _renderHeader

/**
 * v1.2.0 Phase 82+++: Render the AI opponent bar (name, level, clock, captured
 * pieces, search info, ponder info).
 *
 * Extracted from renderInternal() to further reduce God Function size. Renders
 * the .pbar#ai-bar element with:
 *   - AI opponent icon + name + level (Lv.N / SLN / ⚙️ manual config)
 *   - Clock display (when game is timed)
 *   - Waiting/thinking indicators
 *   - Captured pieces (split at 7: pieces 1-7 on line 2, pieces 8+ on line 3)
 *   - Engine search info (#ai-search-info, right-aligned)
 *   - Ponder info (#ai-ponder-info, right-aligned on line 3)
 *
 * Uses global state only (gameState, playerColor, gameClocks, formatClock, T,
 * getEffectiveAILevel, engineSettingsData, AndroidBridge, isAIThinking, gameOver,
 * _aiBarInfo, _esc, isHintLoading, hintText, _ponderMoveSAN, _ponderBarInfo,
 * setupMode, reviewMode, capturedPiecesHtml). The oppC (opponent color) value
 * is passed as a parameter because it is local to renderInternal.
 *
 * @param {string} h - Current HTML string
 * @param {string} oppC - Opponent color ('white' or 'black')
 * @returns {string} h with AI bar HTML appended
 */
function _renderAIBar(h, oppC){
// v1.0.4 Rev37: AI bar captured pieces split at 7 — pieces 8+ go to line 3.
{const _aiCapHtml=capturedPiecesHtml(gameState.board,oppC,playerColor,7);
// v1.0.4 FIX (this round): render the AI's clock display element when the game is timed.
// The element has id="clock-black" or "clock-white" depending on which color the AI plays.
// _updateClockDisplay() updates its textContent live (200ms poll) without full re-render.
const _aiClockColor=oppC;
const _aiClockId=_aiClockColor==='white'?'clock-white':'clock-black';
const _aiClockHtml=(gameClocks !== undefined&&gameClocks)?`<span id="${_aiClockId}" style="font-family:monospace,system-ui,-apple-system,sans-serif;font-size:.85rem;font-weight:700;color:var(--text);background:rgba(0,0,0,.3);padding:2px 8px;border-radius:4px;border:1px solid var(--border);min-width:48px;text-align:center">${formatClock(gameClocks[_aiClockColor]?gameClocks[_aiClockColor].remainingSec:0)}</span>`:'';
// v1.0.4 Rev36 LAYOUT: AI opponent bar restructured for cleaner multi-line display.
// Line 1: AI name + level + clock + waiting/thinking indicator (compact status).
// Line 2: Engine search real-time info (_aiBarInfo / _hintBarInfo) — right-aligned.
// Line 3: Ponder info (🔮 move + progress) — right-aligned.
// v1.0.4 Rev37: When AI captured pieces > 7, pieces 8+ go on line 3 left-aligned
// (sharing the line with ponder info which is right-aligned). The _aiCapHtml
// may contain two divs: the first (pieces 1-7) and #ai-cap-overflow (pieces 8+).
// We extract the overflow div and place it in line 3 alongside #ai-ponder-info.
// v1.0.4 Rev38 FIX: Overflow issues — search info and ponder info could exceed
// the bar width because the inner column div didn't have overflow:hidden, and
// the search/ponder text used white-space:nowrap without a bounded max-width.
// Fix: add overflow:hidden to the inner column, add max-width:100% to search/
// ponder info, and make the line-3 container properly shrinkable (min-width:0).
// v1.0.4 Rev40 FIX: Line-3 layout — was justify-content:space-between which put
// #ai-ponder-info at LEFT when no overflow (single child). Changed to
// margin-left:auto on #ai-ponder-info so it's ALWAYS right-aligned regardless
// of whether overflow pieces exist. Also removed justify-content from container.
// Extract overflow captured pieces (if any) from _aiCapHtml for line 3 placement.
const _aiCapOverflowMatch=_aiCapHtml.match(/<div id="ai-cap-overflow"[^>]*>[\s\S]*?<\/div>/);
const _aiCapOverflow=_aiCapOverflowMatch?_aiCapOverflowMatch[0]:'';
const _aiCapMain=_aiCapOverflowMatch?_aiCapHtml.replace(_aiCapOverflowMatch[0],''):_aiCapHtml;
h+=`<div class="pbar" id="ai-bar" role="status" aria-label="AI" style="flex-wrap:wrap"><span class="pico">${playerColor==='white'?'<span style="color:#1A1A2E;-webkit-text-stroke:.3px rgba(255,230,150,.85);text-shadow:0 0 .8px rgba(255,230,150,.55)">♚&#xFE0E;</span>':'<span style="color:#E8E8F0;-webkit-text-stroke:.3px rgba(30,15,0,.85);text-shadow:0 0 .8px rgba(30,15,0,.55)">♔&#xFE0E;</span>'}</span><div style="flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><div class="pname">${T('ai_opponent')}</div><div class="pbar-sub">${getEffectiveAILevel()===8?T('manual_config'):getEffectiveAILevel()===7?('SL'+(function(){try{let _sl=20;if(typeof engineSettingsData!=='undefined'&&engineSettingsData&&engineSettingsData.skillLevel!=null)_sl=engineSettingsData.skillLevel;else if(typeof AndroidBridge!=='undefined'&&AndroidBridge.getEngineSkillLevel)_sl=AndroidBridge.getEngineSkillLevel();return _sl;}catch(e){return 20;}})()):('Lv.'+getEffectiveAILevel())}</div>${_aiClockHtml}${gameState.currentTurn!==playerColor&&!gameOver&&!isAIThinking?'<span class="tind">'+T('waiting')+'</span>':''}${isAIThinking?'<span class="tind">'+T('thinking')+'</span>':''}</div>${_aiCapMain}<div id="ai-search-info" style="display:flex;justify-content:flex-end;text-align:right;font-size:.65rem;color:var(--accent2);font-family:monospace,system-ui,-apple-system,sans-serif;letter-spacing:.5px;padding-top:2px;line-height:1.3;min-height:1.3em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;width:100%;box-sizing:border-box">${isAIThinking&&_aiBarInfo?_esc(_aiBarInfo):''}</div><div style="display:flex;align-items:center;width:100%;gap:6px;min-width:0;overflow:hidden">${_aiCapOverflow}<div id="ai-ponder-info" style="text-align:right;font-size:.65rem;color:var(--muted);font-family:monospace,system-ui,-apple-system,sans-serif;letter-spacing:.5px;padding-top:1px;line-height:1.3;min-height:1.3em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:0 1 auto;min-width:0;margin-left:auto">${(!isAIThinking&&!isHintLoading&&!hintText&&_ponderMoveSAN&&_ponderBarInfo&&!gameOver&&!setupMode&&!reviewMode)?('🔮 '+_esc(_ponderMoveSAN)+' '+_esc(_ponderBarInfo)):''}</div></div></div></div>`;}
return h;
} // end _renderAIBar

/**
 * v1.2.0 Phase 82+++: Render the quick toolbar and player bar.
 *
 * Extracted from renderInternal() to further reduce God Function size. Renders:
 *   - Quick toolbar (.qtoolbar) with 5 buttons: undo / redo / flip / hint /
 *     control-map toggle. Hidden in review mode. Undo/redo hidden in setup mode.
 *   - Player bar (.pbar#player-bar) with player icon, name (clickable to rename),
 *     clock display, captured pieces, your-turn indicator, resign button.
 *
 * Uses global state only (capturedPiecesHtml, gameState, playerColor, gameClocks,
 * formatClock, _humanPlayerName, T, _escapeHTML, reviewMode, setupMode,
 * HapticManager, undoMove, redoMove, flipBoard, getHint, showCtrlMap, cachedCtrlKey,
 * render, isAIThinking, gameOver, showResignConfirm).
 *
 * @param {string} h - Current HTML string
 * @returns {string} h with quick toolbar + player bar HTML appended
 */
function _renderPlayerBar(h){
{const _plCapHtml=capturedPiecesHtml(gameState.board,playerColor,playerColor);
// v1.0.4 FIX (this round): render the player's clock display element when timed.
const _plClockColor=playerColor;
const _plClockId=_plClockColor==='white'?'clock-white':'clock-black';
const _plClockHtml=(gameClocks !== undefined&&gameClocks)?`<span id="${_plClockId}" style="font-family:monospace,system-ui,-apple-system,sans-serif;font-size:.85rem;font-weight:700;color:var(--text);background:rgba(0,0,0,.3);padding:2px 8px;border-radius:4px;border:1px solid var(--border);min-width:48px;text-align:center">${formatClock(gameClocks[_plClockColor]?gameClocks[_plClockColor].remainingSec:0)}</span>`:'';
// v1.0.4 Rev24: Player name display — uses _humanPlayerName (rename feature)
// if set, otherwise the default "你"/"You". Clicking the name opens a rename
// prompt. The name is persisted via AndroidBridge.persistentSet and used in
// all PGN text ([White "..."] / [Black "..."]).
const _plName=(typeof _humanPlayerName!=='undefined'&&_humanPlayerName)?_humanPlayerName:T('you');
const _plNameEsc=_escapeHTML(_plName);
// v1.0.8: Quick Toolbar — sits between the board and the player bar.
// Originally these 5 buttons (↩️悔棋 / ↪️撤悔 / 🔃翻转 / 💡AI提示 / 🌗🌈控制范围)
// lived in the top header toolbar. They have been MOVED here so the header
// stays focused on game-level actions (New Game, Free Play, Sound, FEN,
// Import, Setup) while in-game / over-the-board actions live next to the
// board where the user's thumb naturally rests.
// In setup mode, ↩️/↪️ are hidden (no moves to undo/redo), but 🔃/💡/🌗🌈 stay.
// Review mode has its own toolbar inside .review-hdr, so this quick toolbar
// is hidden entirely when reviewMode === true.
if(!reviewMode){
  h+=`<div class="qtoolbar" role="toolbar" aria-label="${T('quick_toolbar')}">`;
  if(!setupMode){
    h+=`<button class="btn" onclick="HapticManager.fire(&apos;BUTTON_PRESS&apos;);undoMove()" aria-label="${T('undo')}" title="${T('undo')}"><span style="font-size:1.4rem">↩️</span> ${T('undo')}</button>`;
    h+=`<button class="btn" onclick="HapticManager.fire(&apos;BUTTON_PRESS&apos;);redoMove()" aria-label="${T('redo')}" id="redoBtnQt" title="${T('redo')}"><span style="font-size:1.4rem">↪️</span> ${T('redo')}</button>`;
  }
  h+=`<button class="btn" onclick="HapticManager.fire(&apos;BUTTON_PRESS&apos;);flipBoard()" aria-label="${T('flip')}" title="${T('flip')}"><span style="font-size:1.4rem">🔃</span> ${T('flip')}</button>`;
  h+=`<button class="btn" onclick="HapticManager.fire(&apos;BUTTON_PRESS&apos;);getHint()" aria-label="${T('ai_hint')}" title="${T('ai_hint')}"><span style="font-size:1.4rem">💡</span> ${T('ai_hint')}</button>`;
  h+=`<button class="btn" onclick="HapticManager.fire(&apos;BUTTON_PRESS&apos;);showCtrlMap=!showCtrlMap;cachedCtrlKey=&quot;&quot;;render()" aria-label="${T('ctrl_range')}" title="${T('ctrl_range')}">${showCtrlMap?'<span style="font-size:1.4rem">🌈</span> '+T('ctrl_range'):'<span style="font-size:1.4rem">🌗</span> '+T('ctrl_range')}</button>`;
  h+=`</div>`;
}
h+=`<div class="pbar" id="player-bar" style="flex-wrap:wrap"><span class="pico">${playerColor==='white'?'<span style="color:#E8E8F0;-webkit-text-stroke:.3px rgba(30,15,0,.85);text-shadow:0 0 .8px rgba(30,15,0,.55)">♔&#xFE0E;</span>':'<span style="color:#1A1A2E;-webkit-text-stroke:.3px rgba(255,230,150,.85);text-shadow:0 0 .8px rgba(255,230,150,.55)">♚&#xFE0E;</span>'}</span><div style="flex:1;min-width:0;display:flex;flex-direction:column"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><div class="pname" style="cursor:pointer;text-decoration:underline dotted rgba(212,160,23,.5);text-underline-offset:3px" onclick="_renameHumanPlayer()" title="${T('rename_player_hint')}">${_plNameEsc}</div>${_plClockHtml}</div>${_plCapHtml}</div>${gameState.currentTurn===playerColor&&!gameOver&&!setupMode?'<span class="tind" style="color:#4ade80">'+T('your_turn')+'</span><button type="button" class="btn" onclick="HapticManager.fire(&apos;BUTTON_PRESS&apos;);showResignConfirm=true;render()" title="'+T('resign_btn')+'" aria-label="'+T('resign_btn')+'" style="padding:4px 10px;font-size:.75rem;min-height:30px;border-color:rgba(192,57,43,.6);color:#e57373;background:rgba(192,57,43,.12)">'+T('resign_btn')+'</button>':''}</div>`;}
return h;
} // end _renderPlayerBar

/**
 * v1.2.0 Phase 82+++: Render the info bars below the board (tablebase status,
 * ECO opening recommendation, AI hint with MultiPV).
 *
 * Extracted from renderInternal() to further reduce God Function size. Renders
 * three optional info bars between the board and the player bar:
 *   1. Tablebase status bar (when ≤7 pieces and player's turn) — shows Syzygy
 *      category (win/draw/loss), DTZ/DTM distance, best move recommendation.
 *   2. ECO opening recommendation bar (when _ecoEnabled, not Chess960, player's
 *      turn) — shows the recommended opening move from the ECO book.
 *   3. AI hint area (when isHintLoading or hintText set) — shows hint text,
 *      search info, and MultiPV alternative lines.
 *
 * Uses global state only (gameOver, reviewMode, pieceCountLE7, gameState,
 * generateFEN, _tbCache, _tbLoading, T, isTbOffline, _triggerTbQuery,
 * _jsAttrEncode, _esc, setupMode, _ecoEnabled, gameVariant, playerColor,
 * getECORecommendation, isHintLoading, hintText, _hintBarInfo, _multiPVLines,
 * _convertPVtoSAN).
 *
 * @param {string} h - Current HTML string
 * @returns {string} h with info bars HTML appended
 */
function _renderInfoBars(h){
// Tablebase status bar (player turn only, ≤7 pieces, manual query)
// v1.2.3 round-18: typeof guard for cross-module symbol (round-11 defensive
//   pattern, same as game-logic.js:2794 — a failed tablebase.js load should
//   not cascade into a full-page render error).
if(!gameOver&&!reviewMode&&typeof pieceCountLE7==='function'&&pieceCountLE7(gameState.board)){
const _tbFen=generateFEN(gameState);
let _tbBarHtml='';
const _cachedTb=_tbCache.get(_tbFen);
if(_tbLoading){_tbBarHtml='<span style="color:var(--accent)">'+T('tb_querying')+'</span>';}
else if(_cachedTb){
// API returns moves[] already sorted best-first; use moves[0] directly
const _cat=_cachedTb.category||'';
const _catMap={'win':T('tb_cat_win'),'syzygy-win':T('tb_cat_syzygy_win'),'maybe-win':T('tb_cat_maybe_win'),'cursed-win':T('tb_cat_cursed_win'),'draw':T('tb_cat_draw'),'blessed-loss':T('tb_cat_blessed_loss'),'maybe-loss':T('tb_cat_maybe_loss'),'syzygy-loss':T('tb_cat_syzygy_loss'),'loss':T('tb_cat_loss')};
// v1.2.3 round-18 (XSS hardening): escape the fallback — an unknown
//   `category` from the tablebase API would otherwise flow raw into
//   innerHTML below (same threat model as the _best.uci escaping noted in
//   the v1.0.8 PHASE 30 comment below).
const _catLabel=_catMap[_cat]||_esc(_cat);
let _dtzLabel='';
const _dtm=_cachedTb.dtm;
const _dtz=_cachedTb.precise_dtz!=null?_cachedTb.precise_dtz:_cachedTb.dtz;
const _isWinCat=_cat==='win'||_cat==='syzygy-win'||_cat==='maybe-win'||_cat==='cursed-win';
const _isLossCat=_cat==='loss'||_cat==='syzygy-loss'||_cat==='maybe-loss'||_cat==='blessed-loss';
if(_isWinCat){
  if(_dtm!=null&&_dtm>0){_dtzLabel=T('tb_mate_dist')+': '+Math.ceil(Math.abs(_dtm)/2)+T('tb_steps');}
  else if(_dtz!=null&&_dtz>0){_dtzLabel=T('tb_dtz_dist')+': '+Math.ceil(_dtz/2)+T('tb_steps');}
}else if(_cat==='draw'){_dtzLabel=T('tb_theory_draw');}
else if(_isLossCat){
  if(_dtm!=null&&_dtm<0){_dtzLabel=T('tb_mate_dist')+': '+Math.ceil(Math.abs(_dtm)/2)+T('tb_steps');}
  else if(_dtz!=null&&_dtz<0){_dtzLabel=T('tb_resist_dist')+': '+Math.ceil(Math.abs(_dtz)/2)+T('tb_steps');}
}
// Declare _best outside the if-block to avoid ReferenceError
let _bestMoveLabel='';
let _best=null;
if(_cachedTb.moves&&_cachedTb.moves.length){
_best=_cachedTb.moves[0]; // API sorts best-first
_bestMoveLabel=_best.san||_best.uci;
}
// v1.0.8 PHASE 30: escape _best.uci (in onclick attr) and _bestMoveLabel (in
//   text content) — both come from the tablebase.lichess.ovh API response and
//   could be XSS vectors if the API is compromised or returns malformed data.
_tbBarHtml=`<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span style="color:${(_cat==='win'||_cat==='syzygy-win')?'#27ae60':_cat==='draw'?'var(--accent)':'#c0392b'};font-weight:700">${_catLabel}</span><span style="color:var(--muted);font-size:.72rem">${_dtzLabel}</span>${_bestMoveLabel&&_best?'<span style="cursor:pointer;color:var(--accent2);font-size:.78rem" onclick="autoSelectTablebaseMove('+_jsAttrEncode(_best.uci)+')">🌟 '+T('recommend')+': '+_esc(_bestMoveLabel)+'</span>':''}</div>`;
}else if(isTbOffline()){_tbBarHtml='<span style="color:var(--muted)">'+T('tb_unavailable')+'</span>';}
else{_tbBarHtml='<span style="cursor:pointer;color:var(--accent);text-decoration:underline" onclick="_triggerTbQuery()">'+T('tb_query')+'</span>';}
h+=`<div style="padding:6px 12px;background:var(--card);border:1px solid var(--border);border-radius:6px;font-size:.8rem;font-family:system-ui,-apple-system,sans-serif"><div style="display:flex;align-items:center;gap:6px;margin-bottom:3px"><span style="font-size:.85rem">🌐</span><span style="color:var(--accent2);font-weight:700;font-size:.75rem">${T('tb_library')}</span></div>${_tbBarHtml}</div>`;
}
// ECO Opening Recommendation bar (only when _ecoEnabled)
// v1.0.6: Suppress in Chess960 mode — Chess960 has no fixed opening theory,
// so ECO recommendations are meaningless and were already disabled in the
// new-game dialog (the ECO book toggle is grayed out when Chess960 is on).
// This same gate now also covers the in-game recommendation bar so a game
// that started as Chess960 (or was imported from a Chess960 PGN) never
// shows ECO recommendations.
if(!setupMode&&!gameOver&&!reviewMode&&_ecoEnabled&&!(gameVariant !== undefined&&gameVariant==='chess960')&&gameState.currentTurn===playerColor){
const _ecoRec=getECORecommendation(gameState);
if(_ecoRec){
// v1.0.8 PHASE 30: escape _ecoRec.notation and _ecoRec.name for defense-in-depth
//   (ECO data is bundled/trusted, but consistent escaping is safer).
h+=`<div style="padding:6px 12px;background:var(--card);border:1px solid var(--purple);border-radius:6px;font-size:.8rem;font-family:system-ui,-apple-system,sans-serif"><div style="display:flex;align-items:center;gap:6px;margin-bottom:3px"><span style="font-size:.85rem">📖</span><span style="color:var(--accent2);font-weight:700;font-size:.75rem">${T('opening_rec')}</span></div><span style="color:var(--muted);font-size:.85rem;margin-right:4px">🔍</span><span style="color:var(--text)">${_esc(_ecoRec.notation)}</span><span style="color:var(--muted);font-size:.7rem;margin-left:6px">(${_esc(_ecoRec.name)})</span></div>`;
}
}
// Hint area: only shown when user clicked hint button (isHintLoading or hintText set)
// Search info in hint area only shown during hint loading, NOT during AI thinking
{if(isHintLoading||hintText){h+='<div class="hint-area"><div style="display:flex;align-items:center;gap:8px"><span style="font-size:.85rem">💡</span><span style="font-size:.75rem;color:var(--accent2)">'+T('ai_hint')+'</span></div>';if(isHintLoading)h+='<div class="hint-text" style="animation:pulse 1.2s infinite">'+T('hint_thinking')+'</div>';else if(hintText)h+='<div class="hint-text">'+_esc(hintText)+'</div>';if(isHintLoading&&_hintBarInfo)h+='<div id="hint-search-info" style="font-size:.72rem;color:var(--accent);margin-top:4px;font-family:monospace;letter-spacing:.5px">'+_esc(_hintBarInfo)+'</div>';
// Ponder move is now displayed inline in hintText (set by onHintMove)
// when the engine provides "bestmove X ponder Y". No separate display needed here.
// Show MultiPV alternative lines if available
if(_multiPVLines.length>=1){h+='<div style="margin-top:6px;border-top:1px solid rgba(212,160,23,.15);padding-top:6px"><div style="font-size:.65rem;color:var(--muted);margin-bottom:4px">'+T('multi_analysis')+'</div>';for(const pv of _multiPVLines){let scoreStr='';if(pv.scoreMate!=null&&pv.scoreMate!==null){const m=Number.parseInt(pv.scoreMate,10);if(!Number.isNaN(m))scoreStr=m>0?'#+'+Math.abs(m):m<0?'#-'+Math.abs(m):'#0';}else if(pv.scoreCp!=null&&pv.scoreCp!==null){const pd=(pv.scoreCp/100).toFixed(1);scoreStr=(pv.scoreCp>0?'+':'')+pd;} let pvSAN='';if(pv.pv){try{const _conv=_convertPVtoSAN(pv.pv,gameState);pvSAN=_conv.sanMoves.split(/\s+/).slice(0,3).join(' ');}catch(e){pvSAN=pv.pv.split(/\s+/).slice(0,3).join(' ');}} h+='<div style="font-size:.65rem;color:'+(pv.index===1?'var(--accent2)':'var(--muted)')+';margin-bottom:2px">'+(pv.index===1?'⭐':'·')+' '+scoreStr+(pvSAN?' <span style="font-family:monospace;font-size:.6rem">'+_esc(pvSAN)+'</span>':'')+'</div>';}h+='</div>';} h+='</div>';}}// Player bar
return h;
} // end _renderInfoBars

/**
 * v1.2.1 round-13 (S3776): Build the full HTML string for the current render.
 *
 * Extracted from renderInternal() to reduce its cognitive complexity (was CC=122).
 * Delegates to the existing _renderHeader / _renderAIBar / _renderBoardGrid /
 * _renderSetupPanel / _renderInfoBars / _renderPlayerBar / _renderSidePanel /
 * _renderDialogs / _renderReviewMode helpers (each already extracted in earlier
 * rounds). This function just sequences them and inserts the game-over overlay
 * at the correct DOM position (inside .bwrap, after the board grid).
 *
 * Returns {h, done} — when done=true, the review state was invalid and a
 * re-render has already been triggered; renderInternal must return immediately
 * to skip the scroll-save/innerHTML/scroll-restore logic (which would operate
 * on stale DOM state).
 *
 * @param {Object} _rs - Render state from _computeRenderState()
 * @returns {{h: string, done: boolean}}
 */
function _buildRenderHTML(_rs){
const {cm, infoSq, infoCtrl, oppC, flip}=_rs;
let h=_renderHeader();
h+=`<div class="main" role="main"><div class="bsec">`;
h=_renderAIBar(h, oppC);
h=_renderBoardGrid(h, flip, cm);
// Game-over overlay renders INSIDE .bwrap (anchors to .bwrap via position:absolute)
if(gameOver&&lastMove&&!gameOverSoundPlayed){gameOverSoundPlayed=true;playSound('gameover');HapticManager.fire('GAME_OVER');}
if(gameOver&&!setupMode){h+=`<div class="gover" role="alert" aria-live="assertive"><div class="ge" style="${_gameOverIconStyle()};font-family:'DejaVu Sans','Noto Sans','Segoe UI Symbol',sans-serif;font-variant-emoji:text;font-weight:400">${_gameOverIconChar()}</div><div class="gt">${gameOver}</div><button type="button" class="btn btn-p" onclick="showNewGameDialog=true;dlgPlayerColor=playerColor;dlgOpeningId=null;ecoShowCount=30;dlgBookMoves=useBookMoves;render()">⚔️ ${T('play_again')}</button><button type="button" class="btn btn-g" onclick="enterReview()">📑 ${T('review')}</button></div>`;}
h=_renderSetupPanel(h);
h+=`</div></div>`; // close .bwrap + .display:flex
h=_renderInfoBars(h);
h=_renderPlayerBar(h);
h+=`</div>`; // close .bsec
h=_renderSidePanel(h, infoSq, infoCtrl, oppC); // opens .panel, closes .panel + .main
h=_renderDialogs(h);
if(reviewMode){
  const _rvResult=_renderReviewMode(h, flip);
  h=_rvResult.h;
  if(_rvResult.done) return {h, done:true};
}
return {h, done:false};
}

/**
 * v1.2.1 round-13 (S3776): Snapshot scroll positions of all scrollable containers
 * BEFORE the DOM is rebuilt (app.innerHTML=h resets all scrollTop to 0).
 *
 * Extracted from renderInternal() to reduce its cognitive complexity. Captures:
 *   - .mlist scrollTop + atBottom flag (main-UI move list)
 *   - .review-body scrollTop (outer review scroll container)
 *   - .review-moves scrollTop (inner review move list)
 *   - .dlg / .panel / .op-list scrollTop (dialogs, side panel, opening list)
 *
 * Returns a context object consumed by _restoreScrollState().
 */
function _saveScrollState(){
const ctx={
  wasEcoFocused:_ecoSearchFocused,
  reviewBodyScroll:0,
  reviewMovesScroll:0,
  containerScrolls:[],
};
if(_ecoBlurTimer){clearTimeout(_ecoBlurTimer);_ecoBlurTimer=0}
if(_rvScrollRefreshTimer){clearTimeout(_rvScrollRefreshTimer);_rvScrollRefreshTimer=0;}
try{
  const _selectors=['.dlg','.panel','.op-list'];
  for(const _sel of _selectors){
    const _els=document.querySelectorAll(_sel);
    for(let _i=0;_i<_els.length;_i++){
      const _el=_els[_i];
      if(_el&&_el.scrollHeight>0&&_el.clientHeight>0&&_el.scrollTop>0){
        ctx.containerScrolls.push({sel:_sel,idx:_i,scrollTop:_el.scrollTop,scrollHeight:_el.scrollHeight,clientHeight:_el.clientHeight});
      }
    }
  }
}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
if(!reviewMode){
  const _oldMlist=document.querySelector('.mlist');
  if(_oldMlist&&_oldMlist.scrollHeight>0&&_oldMlist.clientHeight>0){
    _mlistScrollState.scrollTop=_oldMlist.scrollTop;
    _mlistScrollState.atBottom=(_oldMlist.scrollTop + _oldMlist.clientHeight >= _oldMlist.scrollHeight - 40);
    _mlistScrollState.valid=true;
  }
}else{
  const _oldReviewBody=document.querySelector('.review-body');
  if(_oldReviewBody){ctx.reviewBodyScroll=_oldReviewBody.scrollTop;}
  const _oldReviewMoves=document.getElementById('reviewMovesList');
  if(_oldReviewMoves){ctx.reviewMovesScroll=_oldReviewMoves.scrollTop;}
}
return ctx;
}

/**
 * v1.2.1 round-13 (S3776): Restore scroll positions AFTER the DOM is rebuilt.
 *
 * Extracted from renderInternal() to reduce its cognitive complexity. Restores
 * all scroll positions captured by _saveScrollState(), in the correct order:
 *   1. Re-attach active animations (must happen before any scroll restore)
 *   2. .mlist (main-UI move list) — synchronous, with scroll-restore guard
 *   3. .review-body (outer review scroll) — synchronous
 *   4. .review-moves (inner review move list) — synchronous
 *   5. .dlg / .panel / .op-list — deferred to rAF (non-critical)
 *
 * @param {Object} ctx - Context from _saveScrollState()
 */
function _restoreScrollState(ctx){
if(typeof _reattachActiveAnimations==='function'){try{_reattachActiveAnimations();}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}}
if(!reviewMode){
  const _newMlist=document.querySelector('.mlist');
  if(_newMlist){
    _newMlist.addEventListener('scroll',_onMlistScroll,{passive:true});
    if(_mlistScrollState.valid){
      _scrollRestoreGuard=true;
      const _savedBehavior=_newMlist.style.scrollBehavior;
      _newMlist.style.scrollBehavior='auto';
      try{
        if(_mlistScrollState.atBottom){
          _newMlist.scrollTop=_newMlist.scrollHeight;
        }else{
          const _maxScroll=Math.max(0,_newMlist.scrollHeight-_newMlist.clientHeight);
          _newMlist.scrollTop=Math.min(_mlistScrollState.scrollTop,_maxScroll);
        }
      }catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
      _newMlist.style.scrollBehavior=_savedBehavior;
      requestAnimationFrame(()=>{requestAnimationFrame(()=>{_scrollRestoreGuard=false;});});
    }
  }
}
if(reviewMode&&ctx.reviewBodyScroll>0&&!_skipReviewBodyScrollRestore){
  const _newReviewBody=document.querySelector('.review-body');
  if(_newReviewBody){
    _newReviewBody.style.scrollBehavior='auto';
    try{_newReviewBody.scrollTop=ctx.reviewBodyScroll;}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
    _newReviewBody.style.scrollBehavior='';
  }
}
_skipReviewBodyScrollRestore=false;
if(reviewMode&&ctx.reviewMovesScroll>0){
  const _newReviewMoves=document.getElementById('reviewMovesList');
  if(_newReviewMoves){
    _newReviewMoves.style.scrollBehavior='auto';
    try{
      const _maxScroll=Math.max(0,_newReviewMoves.scrollHeight-_newReviewMoves.clientHeight);
      _newReviewMoves.scrollTop=Math.min(ctx.reviewMovesScroll,_maxScroll);
    }catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
    _newReviewMoves.style.scrollBehavior='';
  }
}
if(ctx.containerScrolls.length>0){
  const _toRestore=ctx.containerScrolls;
  requestAnimationFrame(function(){
    for(const _entry of _toRestore){
      try{
        const _els=document.querySelectorAll(_entry.sel);
        const _el=_els[_entry.idx];
        if(!_el)continue;
        const _maxScroll=Math.max(0,_el.scrollHeight-_el.clientHeight);
        const _target=Math.min(_entry.scrollTop,_maxScroll);
        if(_target>0){
          const _savedBehavior=_el.style.scrollBehavior;
          _el.style.scrollBehavior='auto';
          _el.scrollTop=_target;
          _el.style.scrollBehavior=_savedBehavior;
        }
      }catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
    }
  });
}
}

/**
 * v1.2.1 round-13 (S3776): Post-render finalization.
 *
 * Extracted from renderInternal() to reduce its cognitive complexity. Runs
 * AFTER the DOM is rebuilt and scroll positions are restored:
 *   1. Invalidate cached DOM refs (rebuilt DOM has new element identities)
 *   2. Update prev-state tracking for _updateBoardLightweight diffing
 *   3. Center the active review move in the .review-moves viewport (double-rAF)
 *   4. Render arrows into the new SVG overlay
 *   5. Invalidate eval-display signature + cache review-moves-list element
 *   6. Restore ECO search input focus
 *   7. Auto-scroll opening list to selected opening
 *
 * @param {boolean} wasEcoFocused - Whether ECO search was focused before render
 */
// v1.2.3 round-19: One-time startup hint — "long-press the board toggles
//   board anti-shake" (the sensor stabilization added in v1.0.5 Rev49, see
//   the long-press handler at the top of this file). Fires once per app
//   launch (page load) on the first completed render after the loading
//   overlay is gone — i.e. the moment the board is actually visible.
//   _hideLoadingOverlay (ai-bridge.js) also schedules a delayed call so the
//   hint still appears when no render follows soon (e.g. a long first AI
//   think before onBestMove triggers the next render).
let _boardDebounceHintShown=false;
function _maybeShowBoardDebounceHint(){
  if(_boardDebounceHintShown)return;
  if(document.getElementById('_loadingOverlay'))return;
  _boardDebounceHintShown=true;
  setTimeout(function(){
    try{showToast(T('board_debounce_hint'),4500);}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
  },400);
}

function _postRenderFinalize(wasEcoFocused){
_cachedBwrap=null;_cachedSvgEl=null;_cachedSvgLines=[];_cachedArrowKey='';_cachedCtrlCard=null;
_prevHoverSq=hoveredSquare?{row:hoveredSquare.row,col:hoveredSquare.col}:null;
_prevSelSq=selectedSquare?{row:selectedSquare.row,col:selectedSquare.col}:null;
_prevLegalSet=new Set();if(selectedSquare){for(const m of legalMvs)_prevLegalSet.add(m.row*8+m.col);}
if(reviewMode && reviewStep !== _lastReviewStepScrolled){
  _lastReviewStepScrolled = reviewStep;
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){
      const _rList=_rListEl||document.getElementById('reviewMovesList');
      if(_rList){
        const _rAct=_rList.querySelector('.rmv-block.act');
        if(_rAct){
          const _listH=_rList.clientHeight;
          const _actH=_rAct.offsetHeight||0;
          let _actTop=-1;
          try{
            const _listRect=_rList.getBoundingClientRect();
            const _actRect=_rAct.getBoundingClientRect();
            if(_listRect.width>0||_listRect.height>0){
              _actTop=(_actRect.top-_listRect.top)+_rList.scrollTop;
            }
          }catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
          if(_actTop>=0){
            const _target=Math.max(0,_actTop+(_actH/2)-(_listH/2));
            _rList.style.scrollBehavior='auto';
            try{_rList.scrollTop=_target;}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
            _rList.style.scrollBehavior='';
          }
        }
      }
    });
  });
}
_updateArrows(hoveredSquare||selectedSquare);
_invalidateElCache(); _sqElCache = null;
_rListEl = document.getElementById('reviewMovesList');
if(wasEcoFocused){const el=document.getElementById('ecoSearch');if(el){el.focus();_ecoSearchFocused=true;try{el.setSelectionRange(el.value.length,el.value.length)}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}}}
// v1.2.3 round-18: restore SP-ID input focus after keystroke-triggered
//   re-render (same pattern as the ECO search restore above).
if(_spidEditing){_spidEditing=false;const _spEl=document.getElementById('spidInput');if(_spEl&&document.activeElement!==_spEl){_spEl.focus();try{_spEl.setSelectionRange(_spEl.value.length,_spEl.value.length)}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}}}
if(showNewGameDialog&&dlgOpeningId&&!reviewMode){setTimeout(()=>{const list=document.querySelector('.op-list');if(list){const active=list.querySelector('.op-btn.act');if(active)active.scrollIntoView({block:'center',behavior:'smooth'})}},50)}
// v1.2.3 round-19: fire the one-time board anti-shake hint once the board
//   is visible (no-op until the loading overlay is gone; see above).
_maybeShowBoardDebounceHint();
}

// v1.2.1 round-13 (S3776): renderInternal refactored into a thin orchestrator.
//   The God Function (CC=122, ~347 lines) is split into 4 named helpers:
//     1. _buildRenderHTML(_rs) — sequences the existing _render* helpers
//     2. _saveScrollState() — snapshots all scroll positions before DOM rebuild
//     3. _restoreScrollState(ctx) — restores scroll positions after DOM rebuild
//     4. _postRenderFinalize(wasEcoFocused) — cache invalidation + arrows + focus
//   renderInternal now just coordinates the 4 phases + the error catch.
//   Behavior is byte-identical to the pre-refactor version; only the structure
//   changed. See the long comments in each helper for the original rationale.
function renderInternal(){try{
const _rs=_computeRenderState();
const app=document.getElementById('app');if(!app)return;
const _htmlResult=_buildRenderHTML(_rs);
if(_htmlResult.done) return;
const _scrollCtx=_saveScrollState();
app.innerHTML=_htmlResult.h;
_restoreScrollState(_scrollCtx);
_postRenderFinalize(_scrollCtx.wasEcoFocused);
}catch(e){const _app=document.getElementById('app');if(_app)_app.innerHTML='<div style="color:red;padding:20px;font-family:monospace;background:#1a0000;border:2px solid red;border-radius:8px;margin:20px"><h3>'+T('render_error_title')+'</h3><pre style="white-space:pre-wrap;font-size:12px">'+_esc(e.toString())+'\n\n'+_esc(e.stack)+'</pre></div>';console.error('Render error:',e)}}



// Lightweight post-move update: targeted DOM updates instead of innerHTML rebuild
// Only updates squares that actually changed — avoids 5-15ms DOM rebuild per move
let _fullRenderTimer=0;

// v1.0.2 REDUNDANCY (first-principles): removed unused `_sqBgCache` declaration
// — it was declared but never assigned or read (leftover from an abandoned
// caching attempt). The actual background computation is cheap enough that
// per-square caching wasn't worth the bookkeeping, especially now that
// _updateSingleSq skips the DOM write entirely when the square's signature
// hasn't changed.
function _getSqBg(rr,cc,cm,isL,lastMove){
  let bg=isL?SQ_LIGHT:SQ_DARK;
  let ctrlBg=null;
  if(cm){const e=cm[rr][cc];if(e){const wc=e.white.length,bc=e.black.length;const myC=playerColor==='white'?wc:bc;const opC=playerColor==='white'?bc:wc;const net=myC-opC;const total=myC+opC;const adv=total>0?net/total:0;const str=Math.min(1,total/8);let hue;if(myC===0&&opC===0){ctrlBg='#3a2020'}else{if(adv>=0)hue=280-adv*60;else hue=280-adv*80;if(hue>=360)hue-=360;const sat=0.50+str*0.40;const lit=0.48-str*0.12;ctrlBg=`hsl(${Math.round(hue)},${Math.round(sat*100)}%,${Math.round(lit*100)}%)`}}}
  if(ctrlBg){bg=ctrlBg}
  return bg;
}

function _updateSingleSq(el,p,rr,cc,cm,isL,lastMove,_checkKingPos){
  // v1.0.2 PERF (first-principles): build a cheap signature string capturing
  // everything that affects this square's visual state. Only when the signature
  // changes do we touch the DOM (style.background, className, innerHTML).
  // Previously this function unconditionally rebuilt innerHTML for all 64
  // squares on every engine-progress callback (~10-50/sec), even though most
  // squares don't change between callbacks.
  const isSel=selectedSquare&&rr===selectedSquare.row&&cc===selectedSquare.col;
  const lastFrom=lastMove&&rr===lastMove.from.row&&cc===lastMove.from.col;
  const lastTo=lastMove&&lastMove.to.row===rr&&lastMove.to.col===cc;
  const isCheckSq=_checkKingPos&&rr===_checkKingPos.row&&cc===_checkKingPos.col;
  const isLegal=legalSet.has(rr*8+cc);
  // v1.0.8 BUG FIX:
  // This lightweight single-square update path was missing the castle-rook
  // marker logic that renderInternal() and _updateChangedSquares() have.
  // Although the auto-clear-selection behavior after a move usually prevents
  // this path from rendering the marker, the inconsistency is a latent bug
  // that would surface if selection clearing changes. Use the same source of
  // truth (_computeCastlingRookSetForSelection) so all four render paths
  // produce identical output for castling-rook squares.
  const isCastlingRook=(function(){
    try{
      if(!selectedSquare||!legalMvs||!legalMvs.length)return false;
      const sp=gameState.board[selectedSquare.row]&&gameState.board[selectedSquare.row][selectedSquare.col];
      if(!sp||sp.type!=='king')return false;
      // Compute lazily and cache for the duration of one render pass via a
      // closure-scoped field on the function object (cheap, avoids leaking
      // to global scope and avoids recompute per square).
      if(_updateSingleSq._cachedSelKey!==selectedSquare){
        _updateSingleSq._cachedSelKey=selectedSquare;
        _updateSingleSq._cachedSet=_computeCastlingRookSetForSelection(selectedSquare,legalMvs);
      }
      return _updateSingleSq._cachedSet.has(rr*8+cc);
    }catch(e){return false;}
  })();
  // v1.0.8 PHASE 22: landing animation removed (Web Animations API handles motion)
  // v1.0.8 PHASE 3: visible 🔁/⚡ markers (computed once per render pass and
  // cached on the function object — see caller). Added to the signature so
  // the marker is added/removed when the underlying rights/target change.
  if(!_updateSingleSq._vmCache || _updateSingleSq._vmState!==gameState){
    _updateSingleSq._vmCache={
      castle:(typeof computeVisibleCastleMarks==='function')?computeVisibleCastleMarks(gameState):new Set(),
      ep:(typeof computeVisibleEpMark==='function')?computeVisibleEpMark(gameState):null
    };
    _updateSingleSq._vmState=gameState;
  }
  const hasCM=_updateSingleSq._vmCache.castle.has(String(rr*8+cc));
  const hasEM=_updateSingleSq._vmCache.ep&&_updateSingleSq._vmCache.ep.row===rr&&_updateSingleSq._vmCache.ep.col===cc;
  // Signature: piece color+type, selection, last-move from/to, check, legal,
  // control-map presence (cm), castling-rook marker, visible 🔁/⚡.
  // v1.0.8: isCastlingRook added to signature so the marker flips on/off
  // correctly when selection changes.
  // v1.0.8 PHASE 3: hasCM/hasEM added so markers flip on/off when rights/target change.
  // v1.0.8 PHASE 22: animCls removed from signature (landing animation removed —
  //   Web Animations API overlay handles piece-move motion independently).
  const sig=(p?p.color[0]+p.type:'--')+'|'+(isSel?1:0)+(lastFrom?1:0)+(lastTo?1:0)+(isCheckSq?1:0)+(isLegal?1:0)+(cm?1:0)+(isCastlingRook?1:0)+(hasCM?1:0)+(hasEM?1:0);
  if(el._sig===sig)return; // No change — skip DOM writes entirely
  el._sig=sig;
  // Compute background only when we're going to write
  const bg=_getSqBg(rr,cc,cm,isL,lastMove);
  el.style.background=isSel?SQ_SEL:bg;
  el.className='sq'+(lastFrom?' last-from':'')+(lastTo?' last-to':'')+(isCheckSq?' in-check':'')+(isCastlingRook?' castle-rook':'');
  const lbl=String.fromCodePoint(97+cc)+(8-rr);
  let inner=`<span class="lbl" style="color:${isL?LBL_LIGHT:LBL_DARK};-webkit-text-stroke:.6px ${isL?LBL_STROKE_LIGHT:LBL_STROKE_DARK};paint-order:stroke fill;text-shadow:0 0 2px ${isL?LBL_STROKE_LIGHT:LBL_STROKE_DARK}">${lbl}</span>`;
  if(p){
    inner+=`<span class="pc ${p.color==='white'?'w':'bk'}">${SYM[p.color][p.type]}</span>`;
  }
  if(isLegal&&!p&&!isCastlingRook)inner+=`<div class="dot"></div>`;
  if(isLegal&&p&&!isCastlingRook)inner+=`<div class="ring"></div>`;
  // v1.0.8: castle-ring marker, identical to renderInternal / _updateChangedSquares.
  if(isCastlingRook)inner+=`<div class="castle-ring"></div>`;
  // v1.0.8 PHASE 3: visible 🔁/⚡ markers (all modes)
  if(hasCM)inner+=`<span class="setup-castle-mark" aria-hidden="true">🔁</span>`;
  if(hasEM)inner+=`<span class="setup-ep-mark" aria-hidden="true">⚡</span>`;
  el.innerHTML=inner;
}

/**
 * Update the UI after a move is made. Uses incremental DOM updates for the board
 * and eval display, then schedules a full render for move history updates.
 * @side-effect Modifies DOM incrementally, schedules delayed full render
 */
function updateAfterMove(){requestEngineEval();
  try{
  // If game over or in special modes, fall back to full render
  // v1.0.8 PHASE 22: landing animation state removed (Web Animations API)
  if(gameOver||setupMode||reviewMode||showNewGameDialog||pendingPromotion){render();return;}
  const gridEl=document.getElementById('board-grid');
  if(!gridEl){render();return;}
  // Update control map cache (board has changed after a move)
  const ctrlKey=showCtrlMap?gameState.hash:'off';
  if(ctrlKey!==cachedCtrlKey){cachedCtrlMap=showCtrlMap?getCtrlMap(gameState.board):null;cachedCtrlKey=ctrlKey;}
  const flip=playerColor==='black';
  let _checkKingPos=getCheckKingPos(gameState);
  const cm=showCtrlMap?cachedCtrlMap:null;
  // Targeted update: only update squares that actually changed
  const sqEls=gridEl.querySelectorAll('.sq');
  if(sqEls.length===64){
    for(let r=0;r<8;r++){for(let c=0;c<8;c++){
      const rr=flip?7-r:r;const cc=flip?7-c:c;
      const el=sqEls[r*8+c];
      const p=gameState.board[rr][cc];
      const isL=(r+c)%2===0;
      _updateSingleSq(el,p,rr,cc,cm,isL,lastMove,_checkKingPos);
    }}
  }else{
    // Fallback: rebuild if grid structure is wrong
    let bh='';
    // v1.0.8 PHASE 3: compute visible markers once per fallback rebuild
    const _fbCastleMarks=(typeof computeVisibleCastleMarks==='function')?computeVisibleCastleMarks(gameState):new Set();
    const _fbEpMark=(typeof computeVisibleEpMark==='function')?computeVisibleEpMark(gameState):null;
    for(let r=0;r<8;r++){for(let c=0;c<8;c++){
      const rr=flip?7-r:r;const cc=flip?7-c:c;
      const p=gameState.board[rr][cc];const isL=(r+c)%2===0;
      const bg=_getSqBg(rr,cc,cm,isL,lastMove);
      const isSel=selectedSquare&&rr===selectedSquare.row&&cc===selectedSquare.col;
      const lastFrom=lastMove&&rr===lastMove.from.row&&cc===lastMove.from.col;
      const lastTo=lastMove&&lastMove.to.row===rr&&lastMove.to.col===cc;
      const isCheckSq=_checkKingPos&&rr===_checkKingPos.row&&cc===_checkKingPos.col;
      const isLegal=legalSet.has(rr*8+cc);
      const _hasCM=_fbCastleMarks.has(String(rr*8+cc));
      const _hasEM=_fbEpMark&&_fbEpMark.row===rr&&_fbEpMark.col===cc;
      const lbl=String.fromCodePoint(97+cc)+(8-rr);
      bh+=`<div class="sq${lastFrom?' last-from':''}${lastTo?' last-to':''}${isCheckSq?' in-check':''}" style="background:${isSel?SQ_SEL:bg}" data-r="${rr}" data-c="${cc}" onclick="sqClick(${rr},${cc})">`;
      bh+=`<span class="lbl" style="color:${isL?LBL_LIGHT:LBL_DARK};-webkit-text-stroke:.6px ${isL?LBL_STROKE_LIGHT:LBL_STROKE_DARK};paint-order:stroke fill;text-shadow:0 0 2px ${isL?LBL_STROKE_LIGHT:LBL_STROKE_DARK}">${lbl}</span>`;
      if(p){bh+=`<span class="pc ${p.color==='white'?'w':'bk'}">${SYM[p.color][p.type]}</span>`;}
      if(isLegal&&!p)bh+=`<div class="dot"></div>`;
      if(isLegal&&p)bh+=`<div class="ring"></div>`;
      if(_hasCM)bh+=`<span class="setup-castle-mark" aria-hidden="true">🔁</span>`;
      if(_hasEM)bh+=`<span class="setup-ep-mark" aria-hidden="true">⚡</span>`;
      bh+=`</div>`}}
    gridEl.innerHTML=bh;
    _sqElCache=null;
    // v1.0.2 (qw3.7max audit): clear _rListEl too — the board-only rebuild
    // path doesn't touch the review-moves list, but clearing keeps the cache
    // honest if the element was removed from the DOM by a higher-level rebuild.
    _rListEl=null;
  }
  // Update eval display
  _updateEvalDisplay();
  // Invalidate arrow cache since board state changed
  _invalidateArrowCache();
  _updateArrows(hoveredSquare||selectedSquare);

  // v1.0.8 PHASE 22: landing animation state removed (Web Animations API).
  // Schedule a full render later for move history + other side panel updates.
  //   (v1.2.3 round-20: markDirty removed as dead code — it always routed to
  //   render() anyway, so call render() directly.)
  if(_fullRenderTimer)clearTimeout(_fullRenderTimer);
  _fullRenderTimer=setTimeout(()=>{if(!animationInProgress&&!isAIThinking)render();},350);
  }catch(e){render();}
}

// ===================== INTERACTIONS =====================
// Fast arrow-only update: persistent SVG with pre-built markers, only line elements change
let _cachedSvgEl=null;    // persistent SVG element
let _cachedSvgLines=[];   // cached line elements for quick removal
let _cachedArrowKey='';   // cache key to skip redundant updates
let _prevHoverSq=null;    // track previous hovered square for targeted update
let _prevSelSq=null;      // track previous selected square for targeted update

// Initialize or retrieve the persistent SVG overlay
function _getSvgOverlay(){
  // Validate cached bwrap: if detached from DOM, re-query
  // v1.0.2 FIX (audit): use document.body.contains() instead of parentNode —
  // parentNode is still set if the node was moved into an off-DOM fragment.
  if(_cachedBwrap&&!document.body.contains(_cachedBwrap))_cachedBwrap=null;
  const bwrapEl=_cachedBwrap||(_cachedBwrap=document.querySelector('.bwrap'));
  if(!bwrapEl)return null;
  if(_cachedSvgEl&&_cachedSvgEl.parentNode===bwrapEl){_cachedSvgEl.setAttribute('width',8*CELL);_cachedSvgEl.setAttribute('height',8*CELL);return _cachedSvgEl;}
  // Create persistent SVG with pre-built defs/markers (created once, never recreated)
  const svgEl=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svgEl.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:10';
  svgEl.setAttribute('width',8*CELL);svgEl.setAttribute('height',8*CELL);
  const defs=document.createElementNS('http://www.w3.org/2000/svg','defs');
  const mk1=document.createElementNS('http://www.w3.org/2000/svg','marker');
  mk1.setAttribute('id','ah-b');mk1.setAttribute('markerWidth','8');mk1.setAttribute('markerHeight','6');
  mk1.setAttribute('refX','7');mk1.setAttribute('refY','3');mk1.setAttribute('orient','auto');
  // Arrow marker colors match the arrow stroke colors.
  // ah-b (friendly/player): warm gold (#D4A017) — matches friendly arrow stroke
  // ah-r (opponent): cool silver-blue (#8A9BAE) — matches opponent arrow stroke
  const pg1=document.createElementNS('http://www.w3.org/2000/svg','polygon');
  pg1.setAttribute('points','0 0,8 3,0 6');pg1.setAttribute('fill','#D4A017');
  mk1.appendChild(pg1);defs.appendChild(mk1);
  const mk2=document.createElementNS('http://www.w3.org/2000/svg','marker');
  mk2.setAttribute('id','ah-r');mk2.setAttribute('markerWidth','8');mk2.setAttribute('markerHeight','6');
  mk2.setAttribute('refX','7');mk2.setAttribute('refY','3');mk2.setAttribute('orient','auto');
  const pg2=document.createElementNS('http://www.w3.org/2000/svg','polygon');
  pg2.setAttribute('points','0 0,8 3,0 6');pg2.setAttribute('fill','#8A9BAE');
  mk2.appendChild(pg2);defs.appendChild(mk2);
  svgEl.appendChild(defs);
  // Insert SVG after bgrid
  const bgrid=bwrapEl.querySelector('.bgrid');
  if(bgrid&&bgrid.nextSibling){bwrapEl.insertBefore(svgEl,bgrid.nextSibling)}
  else{bwrapEl.appendChild(svgEl)}
  _cachedSvgEl=svgEl;_cachedSvgLines=[];
  return svgEl;
}

// Update only arrow lines in the persistent SVG (fast path)
function _updateArrows(infoSq){
  const cm=showCtrlMap?cachedCtrlMap:null;
  const flip=playerColor==='black';
  // Build cache key to skip redundant updates
  const arrowKey=(!infoSq||!cm)?'none':infoSq.row+','+infoSq.col;
  if(arrowKey===_cachedArrowKey)return; // nothing changed, skip
  _cachedArrowKey=arrowKey;
  // If no arrows needed, just clear existing ones
  if(!infoSq||!cm){
    for(let i=0;i<_cachedSvgLines.length;i++)_cachedSvgLines[i].remove();
    _cachedSvgLines=[];
    return;
  }
  const svgEl=_getSvgOverlay();
  if(!svgEl)return;
  // Remove old lines quickly (no DOM search, just cached refs)
  for(let i=0;i<_cachedSvgLines.length;i++)_cachedSvgLines[i].remove();
  _cachedSvgLines=[];
  const e=cm[infoSq.row][infoSq.col];
  if(!e)return;
  const oppC=OPP_COLOR[playerColor];
  // v1.1.0 Phase 53 (revision): Exclude arrows from a king whose destination
  //   (infoSq) is controlled by the opponent — the king cannot legally move
  //   there, so showing an arrow to it would misrepresent an illegal king
  //   move as a valid control/threat. This applies to BOTH player's king and
  //   opponent's king (a king never moves into check, regardless of side).
  //   For non-king pieces, all control arrows are shown (they represent
  //   attacks/defenses, not moves — a pinned piece still "controls" squares).
  const arrows=[];
  for(const c of e[playerColor]){
    // Skip king→infoSq arrow if infoSq is controlled by opponent (illegal king move)
    if(c.piece.type==='king' && e[oppC].length>0)continue;
    arrows.push({from:c.position,to:infoSq,isFriendly:true});
  }
  for(const c of e[oppC]){
    // Skip king→infoSq arrow if infoSq is controlled by player (illegal king move for opponent)
    if(c.piece.type==='king' && e[playerColor].length>0)continue;
    arrows.push({from:c.position,to:infoSq,isFriendly:false});
  }
  for(const ar of arrows){
    const _afc=flip?7-ar.from.col:ar.from.col,_afr=flip?7-ar.from.row:ar.from.row;
    const _atc=flip?7-ar.to.col:ar.to.col,_atr=flip?7-ar.to.row:ar.to.row;
    const fx=_afc*CELL+CELL/2,fy=_afr*CELL+CELL/2,tx=_atc*CELL+CELL/2,ty=_atr*CELL+CELL/2;
    const dx=tx-fx,dy=ty-fy,len=Math.sqrt(dx*dx+dy*dy),sh=14,rt=len>0?(len-sh)/len:1;
    const ex=fx+dx*rt,ey=fy+dy*rt;
    const line=document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('x1',fx);line.setAttribute('y1',fy);
    line.setAttribute('x2',ex);line.setAttribute('y2',ey);
    // Friendly arrows: warm gold; Opponent arrows: cool silver-blue
    line.setAttribute('stroke',ar.isFriendly?'#D4A017':'#8A9BAE');
    line.setAttribute('stroke-width','4');line.setAttribute('stroke-opacity','0.85');line.setAttribute('stroke-linecap','round');
    line.setAttribute('marker-end',ar.isFriendly?'url(#ah-b)':'url(#ah-r)');
    svgEl.appendChild(line);
    _cachedSvgLines.push(line);
  }
}

// Invalidate arrow cache (call when board state changes)
function _invalidateArrowCache(){
  // Remove old line elements from DOM before clearing cache
  if(_cachedSvgEl){
    for(let i=0;i<_cachedSvgLines.length;i++){
      try{_cachedSvgLines[i].remove();}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
    }
  }
  _cachedArrowKey='';_cachedSvgLines=[];
}

// Update only the squares that visually changed (old hover/sel → new hover/sel)
// oldLegalSet/newLegalSet track legal move dots that need adding/removing
function _updateChangedSquares(oldInfoSq,newInfoSq,oldLegalSet,newLegalSet){
  const gridEl=document.getElementById('board-grid');
  if(!gridEl){return;}
  const flip=playerColor==='black';
  let _checkKingPos=getCheckKingPos(gameState);
  const cm=showCtrlMap?cachedCtrlMap:null;
  const sqEls=gridEl.querySelectorAll('.sq');
  if(sqEls.length!==64)return; // safety check
  // v1.0.6 FIX: Compute the castling-rook square set for the CURRENT selection
  // state. This must match the logic in renderInternal() so the golden dashed
  // ring marker stays in sync with selection changes. Without this, the marker
  // was only added during full renders (renderInternal) and never updated by
  // the lightweight path — causing it to not appear on king selection, and to
  // get stuck after appearing (since _updateChangedSquares didn't remove it).
  const _curCastlingRookSet=_computeCastlingRookSetForSelection(selectedSquare,legalMvs);
  // Compute the PREVIOUS castling-rook set (based on the old selection state).
  // We need this to know which squares to CLEAR the marker from when the
  // selection changes away from a castling-capable king.
  // v1.0.6 PERF: Instead of recomputing legalMoves() for the previous selection
  // (which calls pseudoMoves + makeMvInPlace/unmakeMv for every candidate —
  // expensive on rapid clicks), we derive the castling rooks from _prevLegalSet
  // (the Set of row*8+col keys we already track). If the previous selection was
  // a king and _prevLegalSet contains col 6 (kingside) or col 2 (queenside) on
  // the home row, we know castling was legal and can compute the rook column
  // without re-running the full legal-move generator.
  let _prevCastlingRookSet=new Set();
  if(_prevSelSq){
    try{
      const _prevPiece=gameState.board[_prevSelSq.row]&&gameState.board[_prevSelSq.row][_prevSelSq.col];
      if(_prevPiece&&_prevPiece.type==='king'&&_prevPiece.color===playerColor){
        const _homeRow=_prevPiece.color==='white'?7:0;
        if(_prevSelSq.row===_homeRow){
          // Check if kingside (col 6) or queenside (col 2) was in the legal set
          const _ksKey=_homeRow*8+6;
          const _qsKey=_homeRow*8+2;
          if(_prevLegalSet.has(_ksKey)){
            // Kingside castling was legal — find the rook column
            let rCol=7; // standard chess default
            if(gameVariant !== undefined&&gameVariant==='chess960'&&typeof chess960CastlingRookMove==='function'){
              const rm=chess960CastlingRookMove(gameState,_prevPiece.color,'kingside');
              if(rm)rCol=rm.rookFrom;
            }
            _prevCastlingRookSet.add(_homeRow*8+rCol);
          }
          if(_prevLegalSet.has(_qsKey)){
            let rCol=0; // standard chess default
            if(gameVariant !== undefined&&gameVariant==='chess960'&&typeof chess960CastlingRookMove==='function'){
              const rm=chess960CastlingRookMove(gameState,_prevPiece.color,'queenside');
              if(rm)rCol=rm.rookFrom;
            }
            _prevCastlingRookSet.add(_homeRow*8+rCol);
          }
        }
      }
    }catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
  }
  // Collect logical positions that need updating
  const logicPositions=new Set();
  if(oldInfoSq)logicPositions.add(oldInfoSq.row*8+oldInfoSq.col);
  if(newInfoSq)logicPositions.add(newInfoSq.row*8+newInfoSq.col);
  // Old legal dots need removal, new legal dots need addition
  for(const pos of oldLegalSet)logicPositions.add(pos);
  for(const pos of newLegalSet)logicPositions.add(pos);
  // Also include selected square itself
  if(selectedSquare)logicPositions.add(selectedSquare.row*8+selectedSquare.col);
  // v1.0.6 FIX: Include castling-rook squares (both old and new) so the
  // marker is added when a king is selected and removed when deselected.
  for(const pos of _curCastlingRookSet)logicPositions.add(pos);
  for(const pos of _prevCastlingRookSet)logicPositions.add(pos);
  // v1.0.8 PHASE 3: Include squares with visible 🔁/⚡ markers so they get
  // updated by the lightweight path (not just by full re-renders). Also
  // include any PREVIOUS marker squares (we'd need a previous-state cache
  // for that — for simplicity we rely on the signature check inside
  // _updateSingleSq / _updateChangedSquares to skip unchanged squares).
  const _ucsCastleMarks=(typeof computeVisibleCastleMarks==='function')?computeVisibleCastleMarks(gameState):new Set();
  const _ucsEpMark=(typeof computeVisibleEpMark==='function')?computeVisibleEpMark(gameState):null;
  for(const pos of _ucsCastleMarks)logicPositions.add(pos);
  if(_ucsEpMark)logicPositions.add(_ucsEpMark.row*8+_ucsEpMark.col);
  for(const posKey of logicPositions){
    const lr=Math.floor(posKey/8),lc=posKey%8; // logical row, col
    // Convert logical position to display position (same formula as renderInternal)
    const dr=flip?7-lr:lr; const dc=flip?7-lc:lc;
    // Display position to grid index
    const el=sqEls[dr*8+dc];
    if(!el)continue;
    const p=gameState.board[lr][lc];
    const isL=(dr+dc)%2===0;
    let bg=_getSqBg(lr,lc,cm,isL,lastMove);
    const isSel=selectedSquare&&lr===selectedSquare.row&&lc===selectedSquare.col;
    if(isSel)bg=SQ_SEL;
    const isLegal=newLegalSet.has(lr*8+lc);
    const isCheckSq=_checkKingPos&&lr===_checkKingPos.row&&lc===_checkKingPos.col;
    const lastFrom=lastMove&&lr===lastMove.from.row&&lc===lastMove.from.col;
    const lastTo=lastMove&&lastMove.to.row===lr&&lastMove.to.col===lc;
    // v1.0.6 FIX: Add castle-rook class when this square is a castling rook
    // for the currently-selected king. This keeps the marker in sync with
    // selection changes via the lightweight update path.
    const isCastlingRook=_curCastlingRookSet.has(lr*8+lc);
    // v1.0.8 PHASE 3: visible markers
    const _hasCM=_ucsCastleMarks.has(String(lr*8+lc));
    const _hasEM=_ucsEpMark&&_ucsEpMark.row===lr&&_ucsEpMark.col===lc;
    el.style.background=bg;
    el.className='sq'+(lastFrom?' last-from':'')+(lastTo?' last-to':'')+(isCheckSq?' in-check':'')+(isCastlingRook?' castle-rook':'');
    const lbl=String.fromCodePoint(97+lc)+(8-lr);
    let inner=`<span class="lbl" style="color:${isL?LBL_LIGHT:LBL_DARK};-webkit-text-stroke:.6px ${isL?LBL_STROKE_LIGHT:LBL_STROKE_DARK};paint-order:stroke fill;text-shadow:0 0 2px ${isL?LBL_STROKE_LIGHT:LBL_STROKE_DARK}">${lbl}</span>`;
    if(p){inner+=`<span class="pc ${p.color==='white'?'w':'bk'}">${SYM[p.color][p.type]}</span>`;}
    if(isLegal&&!p&&!isCastlingRook)inner+=`<div class="dot"></div>`;
    if(isLegal&&p&&!isCastlingRook)inner+=`<div class="ring"></div>`;
    // v1.0.6 FIX: Add castle-ring marker when this square is a castling rook.
    // This matches renderInternal's logic. The marker is a golden dashed ring
    // that signals "click me to castle".
    if(isCastlingRook)inner+=`<div class="castle-ring"></div>`;
    // v1.0.8 PHASE 3: visible 🔁/⚡ markers (all modes)
    if(_hasCM)inner+=`<span class="setup-castle-mark" aria-hidden="true">🔁</span>`;
    if(_hasEM)inner+=`<span class="setup-ep-mark" aria-hidden="true">⚡</span>`;
    el.innerHTML=inner;
  }
}

// v1.0.6 NEW: Pure helper that computes the castling-rook square set for a
// given selection + legalMoves, WITHOUT mutating global state. Used by both
// _updateChangedSquares (for current and previous selection) to keep the
// marker in sync. Returns a Set of row*8+col keys.
function _computeCastlingRookSetForSelection(selPos,moves){
  const result=new Set();
  if(!selPos||!gameState||!gameState.board)return result;
  try{
    const _p=gameState.board[selPos.row]&&gameState.board[selPos.row][selPos.col];
    if(!_p||_p.type!=='king'||_p.color!==playerColor)return result;
    if(gameOver||isAIThinking||reviewMode||setupMode||pendingPromotion)return result;
    if(gameState.currentTurn!==playerColor)return result;
    const _moves=moves||[];
    for(const m of _moves){
      if(m&&m.castle){
        let rookCol=-1;
        if(gameVariant !== undefined&&gameVariant==='chess960'&&typeof chess960CastlingRookMove==='function'){
          try{
            const rm=chess960CastlingRookMove(gameState,_p.color,m.castle);
            if(rm)rookCol=rm.rookFrom;
          }catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
        }else{
          rookCol=m.castle==='kingside'?7:0;
        }
        if(rookCol>=0){
          result.add(selPos.row*8+rookCol);
        }
      }
    }
  }catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
  return result;
}

// Fast combined update for hover/selection changes: arrows + changed squares only
// Also need to track previous legal moves for proper dot/ring cleanup
let _prevLegalSet=new Set();
/**
 * Lightweight board update for hover/selection changes.
 * Only updates arrows and changed squares, avoiding full DOM rebuild.
 * @side-effect Updates DOM incrementally via _updateChangedSquares and _updateArrows
 */
function _updateBoardLightweight(){
  const oldInfoSq=_prevHoverSq||_prevSelSq;
  const newInfoSq=hoveredSquare||selectedSquare;
  // P2 PERF: Early-exit when nothing meaningful changed (avoids unnecessary DOM work)
  // v1.0.2 (qw3.7max audit): use optional chaining for cleaner null-safe comparison.
  // When both are null, undefined !== undefined is false — covers all edge cases.
  // Renamed _newHover → _infoChanged (the variable tracks info-square changes, not just hover).
  const _selChanged=(selectedSquare?.row!==_prevSelSq?.row)||(selectedSquare?.col!==_prevSelSq?.col);
  const _infoChanged=(oldInfoSq?.row!==newInfoSq?.row)||(oldInfoSq?.col!==newInfoSq?.col);
  // Compute current legal positions
  const curLegalSet=new Set();
  if(selectedSquare){for(const m of legalMvs)curLegalSet.add(m.row*8+m.col);}
  // Check if legal moves changed
  let _legalChanged=_selChanged;
  if(!_legalChanged){if(curLegalSet.size!==_prevLegalSet.size){_legalChanged=true;}else{for(const p of curLegalSet){if(!_prevLegalSet.has(p)){_legalChanged=true;break;}}}}
  if(!_selChanged&&!_infoChanged&&!_legalChanged)return; // Nothing changed, skip
  // Invalidate arrow cache if selection changed
  if(_selChanged)_invalidateArrowCache();
  // Update only changed squares
  _updateChangedSquares(oldInfoSq,newInfoSq,_prevLegalSet,curLegalSet);
  // Update arrows (uses cache internally)
  _updateArrows(newInfoSq);
  // Update control info panel
  _updateCtrlInfoPanel();
  // Track state for next update
  _prevHoverSq=hoveredSquare?{row:hoveredSquare.row,col:hoveredSquare.col}:null;
  _prevSelSq=selectedSquare?{row:selectedSquare.row,col:selectedSquare.col}:null;
  _prevLegalSet=curLegalSet;
}

// Cached reference to control info card (invalidated on full render)
let _cachedCtrlCard=null;
function _updateCtrlInfoPanel(){
if(!showCtrlMap){var cc=document.getElementById('ctrl-info-card');if(cc)cc.style.display='none';return;}var cc2=document.getElementById('ctrl-info-card');if(cc2)cc2.style.display='';
  // Try cached card first; if detached from DOM, re-query
  let ctrlCard=_cachedCtrlCard;
  if(!ctrlCard||!ctrlCard.parentNode){
    const cards=document.querySelectorAll('.card');
    ctrlCard=null;
    for(const cd of cards){const t=cd.querySelector('.card-t');if(t&&(t.textContent.includes('控制')||t.textContent.includes('Control'))){ctrlCard=cd;break;}}
    _cachedCtrlCard=ctrlCard;
  }
  if(!ctrlCard)return;
  const infoSq=hoveredSquare||selectedSquare;
  const cm=showCtrlMap?cachedCtrlMap:null;
  let infoCtrl=null;
  // v1.0.2 FIX (audit): reuse the control-map entry directly (no new object).
  if(infoSq&&cm){const e=cm[infoSq.row][infoSq.col];if(e)infoCtrl=e;}
  const oppC=OPP_COLOR[playerColor];
  if(infoSq){
    const al=posAlg(infoSq);const pc=gameState.board[infoSq.row][infoSq.col];
    const wt=infoCtrl?infoCtrl.white.length:0;const bt=infoCtrl?infoCtrl.black.length:0;
    const myCtrl=playerColor==='white'?wt:bt;const opCtrl=playerColor==='white'?bt:wt;const netCtrl=myCtrl-opCtrl;
    let h=`<div class="card-t"><span class="ico">📍</span>${T('ctrl_info')}</div>`;
    h+=`<div class="crow"><span class="lb">${T('cur_square')}</span><span class="vl">${al} ${pc?pieceName(pc.type):''}</span></div>`;
    h+=`<div class="crow"><span class="lb">${T('total_ctrl')}</span><span class="vl">${wt+bt}</span></div>`;
    h+=`<div class="crow"><span class="lb">${T('my_ctrl')}</span><span class="vl b">${myCtrl}</span></div>`;
    h+=`<div class="crow"><span class="lb">${T('op_ctrl')}</span><span class="vl r">${opCtrl}</span></div>`;
    h+=`<div class="crow"><span class="lb">${T('net_ctrl')}</span><span class="vl ${netCtrl>0?'b':netCtrl<0?'r':''}">${netCtrl>0?'+':''}${netCtrl}</span></div>`;
    if(infoCtrl){
      h+=`<div class="plist">`;
      // v1.1.0 Phase 53 (revision): Exclude a king from the control list if
      //   the target square (infoSq) is controlled by the opposite color —
      //   the king cannot legally move there, so listing it as a controller
      //   would misrepresent an illegal king move as a valid control.
      for(const c of infoCtrl[playerColor]){
        if(c.piece.type==='king' && infoCtrl[oppC].length>0)continue;
        h+=`<div class="pitem"><span class="dot2 b"></span>${pieceName(c.piece.type)}@${posAlg(c.position)}</div>`;
      }
      for(const c of infoCtrl[oppC]){
        if(c.piece.type==='king' && infoCtrl[playerColor].length>0)continue;
        h+=`<div class="pitem"><span class="dot2 r"></span>${pieceName(c.piece.type)}@${posAlg(c.position)}</div>`;
      }
      h+=`</div>`;
    }
    ctrlCard.innerHTML=h;
  }else{
    ctrlCard.innerHTML=`<div class="card-t"><span class="ico">📍</span>${T('ctrl_info')}</div><div style="color:#64748b;font-size:.85rem">${T('click_sq')}</div>`;
  }
}


let _redoStack=[]; // Stack for redo (stores states pushed by undoMove)

/**
 * Enter review mode — replay all moves and prepare review states.
 * @side-effect Sets reviewMode=true, populates reviewStates, requests engine eval
 */
function enterReview(){_cachedStatus=null;_cachedStatusKey='';
// v1.0.8 PHASE 24 (bug fix): clear any in-progress animation so the overlay
//   doesn't persist into review mode.
_clearAnimationState();
// v1.0.8 PHASE 22 supplement: enter-review sound (沉思音)
try{if(typeof playSound==='function')playSound('enterReview');}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
// v1.1.0 Phase 57 FIX (visual annotation residue): Clear the '_initial' key
//   from the visual annotations cache to ensure fresh computation. The cached
//   '_initial' annotations may be stale from a previous review session:
//     - The '_initial' key is populated lazily by _computeInitialPositionAnnotations()
//       on the first render at reviewStep=0.
//     - That function (after the Phase 57 fix below) reads reviewStates[0].state
//       (the initial position), but in PREVIOUS review sessions it may have read
//       the LIVE gameState (mid-game), producing annotations for the mid-game
//       position rather than the initial position.
//     - The '_initial' key is NEVER cleared by _invalidateCachesForUndoneMoves
//       (which only deletes NUMERIC keys >= N). It IS cleared by _resetGameUIState
//       (called by new game / import / setup-complete / FEN import), but if the
//       user re-enters review WITHOUT one of those entry points in between
//       (e.g., continues playing the same game and re-enters review), the stale
//       '_initial' cache would persist and the wrong annotations would render.
//   We deliberately do NOT clear the NUMERIC keys (0..N-1) — those were computed
//   during play (via _computeAndCacheVisualAnnotations after each move) and are
//   still valid for the current moveRecords.
if(typeof _visualAnnotationsCache!=='undefined'&&_visualAnnotationsCache){
  try{_visualAnnotationsCache.delete('_initial');}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
}
// v1.0.8 PHASE 18 Task 2: Reset virtual list state on entering review mode.
// Each new review session starts with a fresh window centered on reviewStep=0.
_resetRvVirtualState();
// v1.0.4 Round-5 Rev19: Allow entering review mode with zero move records.
// Previously this returned early, blocking the user from reaching the review
// toolbar (which hosts the 📚 PGN Cache Manager and 🗃️ import buttons) when
// no moves had been played yet. Now we fall through — reviewStates will have
// exactly one entry (the starting position), reviewStep=0, and the user can
// immediately use 📚/🗃️ to import a PGN. After import, exitReview()+enterReview()
// re-run with the new moveRecords.
// Save a complete snapshot of the game state before entering review mode.
// exitReview() will restore from this snapshot so the player returns to the
// exact position they were at (not the initial position).
_preReviewSnapshot={
  gameState:cloneS(gameState),
  moveRecords:moveRecords.map(function(r){if(r===null)return null;const c=Object.assign({},r);if(r.variations)c.variations=r.variations.map(function(v){return Object.assign({},v);});return c;}),
  lastMove:lastMove?{from:{row:lastMove.from.row,col:lastMove.from.col},to:{row:lastMove.to.row,col:lastMove.to.col}}:null,
  stateHistory:stateHistory.map(function(s){return{state:cloneS(s.state),selectedSquare:s.selectedSquare?{row:s.selectedSquare.row,col:s.selectedSquare.col}:null,legalMvs:s.legalMvs?[].concat(s.legalMvs):[],moveRecords:s.moveRecords?[].concat(s.moveRecords):[],lastMove:s.lastMove?(s.lastMove.from?{from:{row:s.lastMove.from.row,col:s.lastMove.from.col},to:{row:s.lastMove.to.row,col:s.lastMove.to.col}}:s.lastMove):null,gameOver:s.gameOver};}),
  _redoStack:_redoStack.map(function(s){return{state:cloneS(s.state),moveRecords:[].concat(s.moveRecords),lastMove:s.lastMove?(s.lastMove.from?{from:{row:s.lastMove.from.row,col:s.lastMove.from.col},to:{row:s.lastMove.to.row,col:s.lastMove.to.col}}:s.lastMove):null};}),
  gameOver:gameOver,
  selectedSquare:selectedSquare?{row:selectedSquare.row,col:selectedSquare.col}:null,
  legalMvs:[].concat(legalMvs),
  legalSet:new Set(legalSet),
  playerColor:playerColor,
  reviewBaseState:reviewBaseState?cloneS(reviewBaseState):null
};
// Derive reviewBaseState from stateHistory[0] (the initial position captured
// at game start). Review replays moves from the initial position, so the
// base must be the initial position — not the current gameState (which may
// be mid-game after an undo). Falls back to gameState only if stateHistory
// is empty (e.g., entering review immediately after game start with no
// stateHistory entries yet).
if(stateHistory.length>0&&stateHistory[0].state){
  reviewBaseState=cloneS(stateHistory[0].state);
}else if(stateHistory.length>0&&stateHistory[0].board){
  reviewBaseState=cloneS(stateHistory[0]);
}else{
  reviewBaseState=cloneS(gameState);
}
reviewMode=true;reviewStates=[];
_reviewEvalRequestedStep=-1; // Preserve _reviewEvalCache across review sessions
let s=cloneS(reviewBaseState);
reviewStates.push({state:cloneS(s),lastMove:null});
for(let i=0;i<moveRecords.length;i++){
const mr=moveRecords[i];
// v1.0.2 FIX: null placeholder (black-to-move opening) — push current state unchanged
// so reviewStates indices stay aligned with moveRecords. No move is applied.
// cloneS is required here because `s` is not reassigned in this branch —
// without it, all null-placeholder entries would share the same `s` reference.
if(mr===null){reviewStates.push({state:cloneS(s),lastMove:null});continue;}
// Robust from/to parsing: mr.from/mr.to may be strings ("e2") or objects ({row:6,col:4}).
// After PGN import they're always strings (posAlg output). During play they may be objects.
let from=null,to=null;
try{
  if(typeof mr.from==='string'){from=algPos(mr.from);}
  else if(mr.from&&typeof mr.from==='object'&&('row' in mr.from)&&('col' in mr.from)){from=mr.from;}
  if(typeof mr.to==='string'){to=algPos(mr.to);}
  else if(mr.to&&typeof mr.to==='object'&&('row' in mr.to)&&('col' in mr.to)){to=mr.to;}
  // Validate bounds
  if(from&&(typeof from.row!=='number'||typeof from.col!=='number'||from.row<0||from.row>7||from.col<0||from.col>7))from=null;
  if(to&&(typeof to.row!=='number'||typeof to.col!=='number'||to.row<0||to.row>7||to.col<0||to.col>7))to=null;
}catch(e){from=null;to=null;console.error('enterReview: charCodeAt error for move',i,mr,e);}
if(!from||!to){console.error('enterReview: invalid move at index',i,'from=',mr.from,'to=',mr.to);
  // Bug 1 fix: Push a placeholder reviewState entry so indices stay aligned with moveRecords.
  // moveRecords[i] must map to reviewStates[i+1]; skipping would desynchronize them.
  // cloneS required (same reason as the null-placeholder branch above).
  reviewStates.push({state:cloneS(s),lastMove:null});
  continue;}
const piece=s.board[from.row][from.col];
if(piece){
  // Ensure promotion field is properly handled
  const promotion=(mr.promotion&&mr.promotion!=='null')?mr.promotion:null;
  // v1.1.0 Phase 53: Pass the castle flag for Chess960 castling moves
  // (king may move only 1 col, so _castleSide's fallback detection is
  // needed — but the explicit flag is more reliable and consistent with
  // the _computeAndCacheVisualAnnotations replay path).
  const mv={from,to,piece,promotion};
  if(mr.isCastling&&piece.type==='king'){
    mv.castle=(to.col===6)?'kingside':'queenside';
  }
  // makeMv returns a fresh clone, so `s` here is already a new object;
  // the cloneS is defensive (harmless if redundant) and keeps the three
  // push sites uniform.
  const ns=makeMv(s,mv);
  if(ns){
    s=ns;
    reviewStates.push({state:cloneS(s),lastMove:{from,to}});
  }else{
    // v1.1.0 Phase 53: makeMv failed — push placeholder (stale state)
    // but do NOT update `s`, so subsequent moves at least start from the
    // last known-good state. This prevents cascading corruption.
    console.error('enterReview: makeMv failed for move',i,mr);
    reviewStates.push({state:cloneS(s),lastMove:null});
  }
}else{console.error('enterReview: no piece at',mr.from,'for move',i,mr);
  // Bug 1 fix: Push placeholder to keep reviewStates indices aligned with moveRecords.
  // cloneS required (same reason as the null-placeholder branch above — `s`
  // is not reassigned in this branch).
  reviewStates.push({state:cloneS(s),lastMove:null});
}
}
reviewStep=0;
// v1.1.0 Phase 54 rev16: Enter review at step 0 (initial position), not the
//   last step. This matches the ⏮ button (which goes to step 0) and ensures
//   the eval trend chart starts from step 0 with a real data point.
//   The user can press ⏭ to jump to the last step if desired.
// v1.0.3-p6: reset _lastReviewStepScrolled so the first render after entering
// review mode scrolls the active move into view (rather than skipping the
// scroll because _lastReviewStepScrolled happens to equal reviewStep).
_lastReviewStepScrolled=-2;
// FIX: Stop any ongoing ponder before entering review mode.
// When entering review right after the AI makes a move, the engine might still
// be pondering. The eval request sends "stop" then "position fen X" then "go depth 22",
// but the ponder search's bestmove response (from the "stop") may interfere with
// the eval search. Stopping ponder explicitly prevents this race condition.
try{
  if(typeof AndroidBridge!=='undefined'&&typeof AndroidBridge.isPondering==='function'&&AndroidBridge.isPondering()){
    if(typeof AndroidBridge.stopPonder==='function')AndroidBridge.stopPonder();
  }
}catch(e){console.warn('[Review] stopPonder on enterReview failed:',e.message);}
_ponderGen++;_ponderMoveSAN='';_ponderBarInfo='';_pendingPonderMoveUCI=null;
// v1.0.4 ROUND-5 REV14: Clear stale AI thinking state before entering review.
// When returning from stats page, isAIThinking might be true if the AI was
// thinking when the user opened stats. enterReview() must clear it to prevent
// the eval bar from showing "⏳ analyzing" even when the cache has the eval.
isAIThinking=false;_aiBarInfo='';
if(typeof _updateAIThinkDisplay==='function')_updateAIThinkDisplay();
reviewCritical=_findCriticalMoves();requestEngineEval();render();
  try{if(typeof Store!=='undefined'&&Store&&typeof Store.dispatch==='function')Store.dispatch('ENTER_REVIEW',{states:reviewStates,baseState:reviewBaseState});}catch(e){console.warn('[State] ENTER_REVIEW dispatch failed:',e.message);} // _resetEvalState now inside requestEngineEval()
}
/**
 * Find critical moves in the game — moves where the evaluation changed significantly.
 * Returns an array of {step, reason} objects.
 * Uses cached eval data from _reviewEvalCache if available, otherwise returns
 * an empty array (critical moves will be discovered as evals arrive).
 */
function _findCriticalMoves(){
  const critical=[];
  if(!reviewStates||reviewStates.length<2)return critical;
  let prevEval=0;
  for(let i=1;i<reviewStates.length;i++){
    // v1.0.2 PERF: use peek() — this loop iterates over all review steps to
    // find critical moves, so refreshing LRU on each access is wasteful.
    const ev=_reviewEvalCache.peek(i);
    const prevEv=_reviewEvalCache.peek(i-1);
    if(ev!=null&&prevEv!=null){
      const delta=ev.eval-prevEv.eval;
      // v1.0.2 (qw3.7max audit): simplified — i%2===1 is equivalent to
      // (i+1)%2===0; since i is 1-based here (loop starts at i=1), odd i
      // means White moved (step 1 = White's first move).
      const isMoverWhite=(i%2)===1; // step is odd → White moved
      const moverDelta=isMoverWhite?delta:-delta;
      const ad=Math.abs(moverDelta);
      if(moverDelta<-300){
        const cls=_classifyMove(delta,isMoverWhite);
        critical.push({step:i,reason:cls.label+' ('+(moverDelta/100).toFixed(1)+')'});
      }else if(moverDelta>300){
        const cls=_classifyMove(delta,isMoverWhite);
        // moverDelta>0 is always true in this branch (entry condition moverDelta>300)
        critical.push({step:i,reason:cls.label+' (+'+(moverDelta/100).toFixed(1)+')'});
      }
    }
  }
  return critical;
}

// Classify a move based on eval delta — ALWAYS from the MOVER's perspective.
// evalDelta is in centipawns from White's perspective.
// For White's move: evalDelta > 0 means White improved → good move
// For Black's move: evalDelta < 0 means Black improved → good move
// This ensures consistent evaluation regardless of which side the player is on.
function _classifyMove(evalDelta,isMoverWhite){
  // Convert to mover's perspective: if Black moved, flip the sign
  const moverDelta=isMoverWhite?evalDelta:-evalDelta;
  const ad=Math.abs(moverDelta);
  // Positive moverDelta = move improved mover's position (good)
  // Negative moverDelta = move worsened mover's position (bad)
  const isGood=moverDelta>=0;
  if(ad>=300){
    if(isGood)return{cls:'brilliant',label:T('brilliant'),color:'#00cfff'};
    return{cls:'blunder',label:T('blunder'),color:'#c0392b'};
  }
  if(ad>=150){
    if(isGood)return{cls:'great',label:T('great'),color:'#27ae60'};
    return{cls:'mistake',label:T('mistake'),color:'#e67e22'};
  }
  if(ad>=50){
    if(isGood)return{cls:'good',label:T('good'),color:'#a0c060'};
    return{cls:'inaccuracy',label:T('inaccuracy'),color:'#f0c040'};
  }
  return{cls:'book',label:T('book'),color:'var(--muted)'};
}

// ===================== MISSING CRITICAL FUNCTIONS =====================


/**
 * Reset all game UI state variables.
 * Called from startGame(), exitReview(), and tablebase.js importFEN().
 *
 * v1.0.2 FIX: Also reset stale AI/ponder/eval/MultiPV state. Previously, if
 * the user started a new game (or imported FEN/PGN) while the AI was thinking,
 * isAIThinking stayed true → the new game's doAIMove() early-returned → the
 * AI never moved on the new game; the old 15s safety timer was still pending
 * and could fire on the new gameState; and stale ponder/MultiPV data leaked
 * into the new game's UI. Resetting everything here ensures a clean slate.
 */
// v1.0.4 EXPANSION (this round): Time Control management
//
// We support 4 time control types:
//   - 'sudden'    : Sudden Death — fixed base time, no increment
//   - 'fischer'   : Fischer Increment — base time + increment sec/move (added AFTER each move)
//   - 'bronstein' : Bronstein Delay — base time + delay sec/move (delay not added to remaining)
//   - 'usdelay'   : US Delay — base time + delay sec/move (delay deducted BEFORE clock starts)
//
// Implementation notes:
//   - The clock only ticks for the side-to-move; we update gameClocks[color].remainingSec
//     on every render tick (1s interval) when it's that color's turn.
//   - For 'fischer': after a move, remaining += incrementSec
//   - For 'bronstein': if elapsedThisMove <= delaySec, no time deducted; otherwise
//     remaining -= (elapsedThisMove - delaySec)
//   - For 'usdelay': remaining -= max(0, elapsedThisMove - delaySec)
//   - For 'sudden': remaining -= elapsedThisMove
//   - When remaining <= 0: gameClockExpired = color, game ends with timeout result
//
// The PGN export uses gameClocks[color].remainingSec AFTER each move to emit [%clk HH:MM:SS].
// For untimed games, moveRecords[i].time (elapsedSec) is emitted as [%emt HH:MM:SS].







// v1.0.4 EXPANSION (this round): Visual Annotations cache & selector
// ===========================================================================
// Per spec extension: [%csl ...] highlights squares, [%cal ...] draws arrows.
// We compute these on each move and cache by moveRecords index, so PGN export
// can include them without recomputing.
//
// v1.0.4 LATEST REVISION (Round-5 Rev48) — full color semantics:
//   SQUARE HIGHLIGHTS ([%csl]):
//     B (Blue)   — player's net-control strong squares (player controls, AI doesn't)
//     R (Red)    — AI opponent's net-control strong squares (AI controls, player doesn't)
//     Y (Yellow) — high total-control squares (both sides combined have many attackers)
//     G (Green)  — center-area squares with NO control from either side (neutral center)
//   ARROWS ([%cal]):
//     B (Blue)   — mover's piece threatens 2+ enemy pieces (multi-threat):
//                  arrows from threatening piece to each threatened piece
//     R (Red)    — checker → checked king path (when current move gives check)
//     Y (Yellow) — mover's piece threatens enemy queen:
//                  arrow from threatening piece to queen's square
//     G (Green)  — checked king position → escape square (avoidance paths)
//
// "Player" = playerColor (the human's color); "AI" = opponent of playerColor.
// The moverColor (side that just moved) is used to determine check/escape logic.
//
// Selection algorithm:
//   1. Compute the control map for the POST-MOVE position.
//   2. For each square, compute: playerAttackers, aiAttackers, totalAttackers.
//   3. Blue squares: top 3 where netCtrl > 0 (player has more attackers than AI).
//      Ranked by netCtrl magnitude, center squares preferred. Consistent with
//      the heatmap control-info panel's "net control" definition.
//   4. Red squares: top 3 where netCtrl < 0 (AI has more attackers than player).
//      Ranked by |netCtrl| magnitude, center squares preferred.
//   5. Yellow squares: top 3 where totalAttackers is highest (both sides combined),
//      ALLOWED to overlap with blue/red. Per user spec: "黄色格子应该为双方总控制
//      数量(攻击该格子的棋子总数，无论棋子颜色)最多的那几个格子" and "应该允许
//      被标记为黄色的格子同时被标记为其它颜色".
//   6. Green squares: center squares (d4/e4/d5/e5) where totalAttackers === 0 (neutral center).
//   7. Red arrow (if check): mover → opponent king.
//   8. Green arrows (if check): opponent king position → each escape square.
//   9. Yellow arrows: for each mover piece threatening an enemy queen, draw
//      arrow from attacker to queen (cap: top 3 attackers by piece value).
//  10. Blue arrows: for each mover piece threatening 2+ enemy pieces, draw
//      arrows from attacker to each threatened piece (cap: top 3 attackers
//      by threat count, max 4 targets per attacker).
// v1.1.1 Phase 62: Each cache entry is {csl:[...], cal:[...], imported:boolean}.
//   - imported=true: extracted from an imported PGN's [%csl]/[%cal] comments
//     (human-authored annotations that SHOULD be exported in PGN).
//   - imported=false: auto-generated by _computeAndCacheVisualAnnotations
//     (UI display aids — arrows/highlights — that should NOT pollute PGN export).
//   _buildPGNString() only exports entries where imported=true, preventing
//   auto-generated annotations from contaminating the PGN.
const _visualAnnotationsCache=new Map(); // moveIdx → {csl:[...], cal:[...], imported:boolean}

// v1.2.0 Phase 76+: Extracted from _computeAndCacheVisualAnnotations to reduce
//   cognitive complexity. Replays moves from the starting position to obtain
//   the post-move state at moveIdx. Returns null if replay fails.
function _replayMovesToState(moveIdx){
  try{
    let st=(typeof _setupFEN!=='undefined'&&_setupFEN)?fenToState(_setupFEN):initState();
    if(!st)return null;
    for(let i=0;i<=moveIdx;i++){
      const mr=moveRecords[i];
      // v1.2.3 round-18 (bug fix): skip the intentional null placeholder
      //   (moveRecords[0] for black-to-move starts) instead of aborting the
      //   whole replay — previously EVERY black-first game got no visual
      //   annotations because the replay bailed at index 0.
      if(!mr)continue;
      const from=algPos(mr.from);
      const to=algPos(mr.to);
      if(!from||!to)return null;
      const piece=st.board[from.row][from.col];
      if(!piece)return null;
      const mv={from,to,piece,promotion:mr.promotion};
      if(mr.isCastling&&piece.type==='king'){
        mv.castle=(to.col===6)?'kingside':'queenside';
      }
      st=makeMv(st,mv);
      if(!st)return null;
    }
    return st;
  }catch(e){
    console.warn('_replayMovesToState: failed to replay moves',e);
    return null;
  }
}

// v1.2.0 Phase 76+: Extracted square-highlight computation (Blue/Red/Yellow/Green).
function _computeSquareHighlights(cm, playerCol, aiCol){
  if(!cm)return [];
  const csl=[];
  const centerSquares=[[3,3],[3,4],[4,3],[4,4]];
  const isCenter=(r,c)=>(r===3||r===4)&&(c===3||c===4);
  const isExtendedCenter=(r,c)=>r>=2&&r<=5&&c>=2&&c<=5;
  const blueCandidates=[];
  const redCandidates=[];
  const yellowCandidates=[];
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){
    const entry=cm[r][c];
    if(!entry)continue;
    const pAtk=entry[playerCol].length;
    const aAtk=entry[aiCol].length;
    const total=pAtk+aAtk;
    const netCtrl=pAtk-aAtk;
    if(netCtrl>0){
      let score=netCtrl*2;
      if(isCenter(r,c))score+=3;
      else if(isExtendedCenter(r,c))score+=1;
      blueCandidates.push({r,c,score});
    }
    if(netCtrl<0){
      let score=(-netCtrl)*2;
      if(isCenter(r,c))score+=3;
      else if(isExtendedCenter(r,c))score+=1;
      redCandidates.push({r,c,score});
    }
    if(total>=2){
      yellowCandidates.push({r,c,total});
    }
  }
  blueCandidates.sort((a,b)=>b.score-a.score);
  redCandidates.sort((a,b)=>b.score-a.score);
  yellowCandidates.sort((a,b)=>b.total-a.total);
  for(const sq of blueCandidates.slice(0,3)){
    csl.push({color:'B',square:posAlg({row:sq.r,col:sq.c})});
  }
  for(const sq of redCandidates.slice(0,3)){
    csl.push({color:'R',square:posAlg({row:sq.r,col:sq.c})});
  }
  for(const sq of yellowCandidates.slice(0,3)){
    csl.push({color:'Y',square:posAlg({row:sq.r,col:sq.c})});
  }
  for(const [r,c] of centerSquares){
    const entry=cm[r][c];
    if(entry&&entry.white.length===0&&entry.black.length===0){
      csl.push({color:'G',square:posAlg({row:r,col:c})});
    }
  }
  return csl;
}

// v1.2.0 Phase 76+: Extracted check-arrow computation (Red + Green arrows).
function _computeCheckArrows(cm, postState, oppKingPos, moverColor, oppColor, moveIdx){
  if(!oppKingPos||!moveRecords[moveIdx].isCheck)return [];
  const cal=[];
  if(cm){
    const checkers=cm[oppKingPos.row][oppKingPos.col][moverColor]||[];
    const checkerSeen=new Set();
    for(const checker of checkers){
      const ck=checker.position.row+','+checker.position.col;
      if(checkerSeen.has(ck))continue;
      checkerSeen.add(ck);
      cal.push({color:'R',from:posAlg(checker.position),to:posAlg(oppKingPos)});
    }
  }else{
    const moverTo=algPos(moveRecords[moveIdx].to);
    if(moverTo){
      cal.push({color:'R',from:posAlg(moverTo),to:posAlg(oppKingPos)});
    }
  }
  try{
    const allLegalMoves=legalMoves(postState, null);
    for(const m of allLegalMoves){
      if(m.from.row===oppKingPos.row&&m.from.col===oppKingPos.col){
        cal.push({color:'G',from:posAlg(oppKingPos),to:posAlg(m.to)});
      }
    }
    if(cm){
      const checkers=cm[oppKingPos.row][oppKingPos.col][moverColor]||[];
      if(checkers.length>0){
        const movesByDest=new Map();
        for(const m of allLegalMoves){
          const k=m.to.row+','+m.to.col;
          let list=movesByDest.get(k);
          if(!list){list=[];movesByDest.set(k,list);}
          list.push(m);
        }
        const checkerSeen=new Set();
        for(const checker of checkers){
          const ck=checker.position.row+','+checker.position.col;
          if(checkerSeen.has(ck))continue;
          checkerSeen.add(ck);
          const captures=movesByDest.get(ck);
          if(!captures)continue;
          for(const m of captures){
            if(m.piece.type==='king')continue;
            cal.push({color:'G',from:posAlg(m.from),to:posAlg(m.to)});
          }
        }
      }
    }
  }catch(e){
    console.warn('visualAnnotations: green arrows (respond-to-check) failed',e);
  }
  return cal;
}

// v1.2.0 Phase 76+: Extracted threat-arrow computation (Yellow + Blue arrows).
function _computeThreatArrows(cm, postState, moverColor, oppColor, _movedToPos, _isQueenMovedIntoThreat){
  if(!cm)return [];
  const cal=[];
  const threatByMover=new Map();
  const threatByOpp=new Map();
  let moverQueens=[];
  let oppQueens=[];
  let _movedPieceThreatened=false;
  if(_movedToPos){
    const _atkOnMoved=cm[_movedToPos.row][_movedToPos.col][oppColor]||[];
    if(_atkOnMoved.length>0)_movedPieceThreatened=true;
  }
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){
    const p=postState.board[r][c];
    if(!p||p.type==='king')continue;
    if(p.color===moverColor){
      const oppAttackers=cm[r][c][oppColor]||[];
      if(oppAttackers.length>0){
        const _legalOppAttackers=oppAttackers.filter(atk=>
          atk.piece.type!=='king'||(cm[r][c][moverColor]||[]).length===0
        );
        for(const atk of _legalOppAttackers){
          const k=atk.position.row+','+atk.position.col;
          if(!threatByOpp.has(k))threatByOpp.set(k,{attacker:atk,targets:[]});
          threatByOpp.get(k).targets.push({piece:p,position:{row:r,col:c}});
        }
        if(p.type==='queen'){
          moverQueens.push({position:{row:r,col:c},attackers:_legalOppAttackers.slice()});
        }
      }
    }else if(p.color===oppColor){
      const moverAttackers=cm[r][c][moverColor]||[];
      if(moverAttackers.length>0){
        const _legalMoverAttackers=moverAttackers.filter(atk=>
          atk.piece.type!=='king'||(cm[r][c][oppColor]||[]).length===0
        );
        for(const atk of _legalMoverAttackers){
          const k=atk.position.row+','+atk.position.col;
          if(!threatByMover.has(k))threatByMover.set(k,{attacker:atk,targets:[]});
          threatByMover.get(k).targets.push({piece:p,position:{row:r,col:c}});
        }
        if(p.type==='queen'){
          oppQueens.push({position:{row:r,col:c},attackers:_legalMoverAttackers.slice()});
        }
      }
    }
  }
  const _pieceVal={pawn:1,knight:3,bishop:3,rook:5,queen:9,king:0};
  const yellowAttackers=[];
  for(const q of oppQueens){
    for(const atk of q.attackers){
      const _isAtMovedDest=_movedToPos&&q.position.row===_movedToPos.row&&q.position.col===_movedToPos.col;
      yellowAttackers.push({attacker:atk,queen:q.position,boost:_isAtMovedDest?1:0});
    }
  }
  for(const q of moverQueens){
    for(const atk of q.attackers){
      const _isMovedQueen=_isQueenMovedIntoThreat
        &&_movedToPos
        &&q.position.row===_movedToPos.row
        &&q.position.col===_movedToPos.col;
      yellowAttackers.push({attacker:atk,queen:q.position,boost:_isMovedQueen?1:0});
    }
  }
  const yaSeen=new Set();
  const yaDedup=[];
  for(const ya of yellowAttackers){
    const k=ya.attacker.position.row+','+ya.attacker.position.col+'->'+ya.queen.row+','+ya.queen.col;
    if(yaSeen.has(k))continue;
    yaSeen.add(k);
    yaDedup.push(ya);
  }
  yaDedup.sort((a,b)=>{
    if(a.boost!==b.boost)return b.boost-a.boost;
    return _pieceVal[b.attacker.piece.type]-_pieceVal[a.attacker.piece.type];
  });
  for(const ya of yaDedup.slice(0,6)){
    cal.push({color:'Y',from:posAlg(ya.attacker.position),to:posAlg(ya.queen)});
  }
  const multiThreats=[];
  for(const v of threatByMover.values()){
    if(v.targets.length>=2)multiThreats.push({attacker:v.attacker,targets:v.targets,boost:0});
  }
  for(const v of threatByOpp.values()){
    if(v.targets.length>=2){
      let _boost=_movedPieceThreatened?1:0;
      if(_movedToPos&&_boost){
        const _threatensMoved=v.targets.some(t=>t.position.row===_movedToPos.row&&t.position.col===_movedToPos.col);
        if(!_threatensMoved)_boost=0;
      }
      multiThreats.push({attacker:v.attacker,targets:v.targets,boost:_boost});
    }
  }
  multiThreats.sort((a,b)=>{
    if(a.boost!==b.boost)return b.boost-a.boost;
    return b.targets.length-a.targets.length;
  });
  for(const mt of multiThreats.slice(0,3)){
    for(const tgt of mt.targets.slice(0,4)){
      cal.push({color:'B',from:posAlg(mt.attacker.position),to:posAlg(tgt.position)});
    }
  }
  return cal;
}

function _computeAndCacheVisualAnnotations(moveIdx){
  if(!moveRecords||moveIdx<0||moveIdx>=moveRecords.length)return;
  if(!moveRecords[moveIdx]){_visualAnnotationsCache.set(moveIdx,{csl:[],cal:[],imported:false});return;}
  // v1.2.0 Phase 76+: Obtain post-move state (reviewStates shortcut or replay)
  let postState=null;
  if(typeof reviewMode!=='undefined'&&reviewMode&&typeof reviewStates!=='undefined'&&reviewStates[moveIdx+1]){
    postState=reviewStates[moveIdx+1].state;
  }
  if(!postState){
    postState=_replayMovesToState(moveIdx);
    if(!postState){
      console.warn('_computeAndCacheVisualAnnotations: replay failed at moveIdx',moveIdx);
      return;
    }
  }
  const moverColor=postState.currentTurn==='white'?'black':'white';
  const oppColor=moverColor==='white'?'black':'white';
  const oppKingPos=moverColor==='white'?postState.bk:postState.wk;
  const playerCol=(typeof playerColor!=='undefined')?playerColor:'white';
  const aiCol=playerCol==='white'?'black':'white';
  const _movedToAlg=moveRecords[moveIdx].to;
  const _movedToPos=algPos(_movedToAlg);
  const _movedPiece=_movedToPos?postState.board[_movedToPos.row][_movedToPos.col]:null;
  const _isQueenMovedIntoThreat=_movedPiece&&_movedPiece.type==='queen'&&_movedPiece.color===moverColor;
  let cm=null;
  try{
    if(typeof getCtrlMap==='function')cm=getCtrlMap(postState.board);
  }catch(e){cm=null;}
  const csl=_computeSquareHighlights(cm, playerCol, aiCol);
  const checkArrows=_computeCheckArrows(cm, postState, oppKingPos, moverColor, oppColor, moveIdx);
  const threatArrows=_computeThreatArrows(cm, postState, moverColor, oppColor, _movedToPos, _isQueenMovedIntoThreat);
  const cal=checkArrows.concat(threatArrows);
  _visualAnnotationsCache.set(moveIdx,{csl,cal,imported:false});
}

// Get cached visual annotations for a move (returns {csl:[], cal:[]} or null)
function _getVisualAnnotations(moveIdx){
  return _visualAnnotationsCache.get(moveIdx)||null;
}

// v1.0.5 Rev53: Compute visual annotations for the INITIAL position
// (reviewStep 0). Per user spec, annotations must be computed for the
// initial position too (setup complete / FEN import / PGN with FEN import).
// We inline a simplified version of _computeAndCacheVisualAnnotations's logic
// (which can't be called directly because it reads moveRecords[moveIdx]).
// The result is cached under key '_initial'.
//
// v1.1.0 Phase 57 FIX (visual annotation residue): Use reviewStates[0].state
//   (the actual initial position shown at reviewStep=0) instead of gameState
//   (the LIVE mid-game state). Previously, this function read gameState, which
//   is the LIVE game state — NOT the initial position. When the user entered
//   review during a mid-game, the annotations cached under '_initial' were
//   computed for the mid-game position (e.g., threats to a queen on d4), but
//   the board at reviewStep=0 shows the INITIAL position (queen on d1). The
//   mismatch caused stale, irrelevant annotations to appear at step 0 —
//   perceived by the user as "残留旧对局的过时视觉注解".
//
//   Chess960 compatibility: reviewStates[0].state is built by enterReview()
//   from stateHistory[0].state (captured at game start) or from reviewBaseState
//   (which is the initial position). For Chess960 games, this state has the
//   Chess960 starting position (with spid set). getCtrlMap and attacked both
//   operate on the board state regardless of variant, so the annotations are
//   computed correctly for Chess960 initial positions too.
function _computeInitialPositionAnnotations(){
  if(_visualAnnotationsCache.has('_initial'))return; // already computed
  try{
    // v1.1.0 Phase 57: Prefer reviewStates[0].state (the actual initial
    // position shown at reviewStep=0). Fall back to reviewBaseState (also
    // the initial position), then gameState (defensive — should not happen
    // in review mode, but guards against undefined reviewStates).
    let st=null;
    if(typeof reviewStates!=='undefined'&&reviewStates&&reviewStates.length>0&&reviewStates[0]&&reviewStates[0].state){
      st=reviewStates[0].state;
    }else if(typeof reviewBaseState!=='undefined'&&reviewBaseState){
      st=reviewBaseState;
    }else if(typeof gameState!=='undefined'&&gameState){
      st=gameState; // last-resort fallback
    }
    if(!st)return;
    // Determine "mover" and "opp" for the initial position. At the start,
    // it's the side to move's turn. We compute annotations from BOTH sides'
    // perspectives (the threat detection below examines both directions for
    // blue/yellow arrows). No red/green check arrows are generated for the
    // initial position (no move was just made).
    const csl=[];  // [{color, square}]
    const cal=[];  // [{color, from, to}]
    const moverColor=st.currentTurn||'white';
    const oppColor=moverColor==='white'?'black':'white';
    const playerCol=(typeof playerColor!=='undefined')?playerColor:'white';
    const aiCol=playerCol==='white'?'black':'white';
    let cm=null;
    try{
      if(typeof getCtrlMap==='function')cm=getCtrlMap(st.board);
    }catch(e){cm=null;}
    if(cm){
      const centerSquares=[[3,3],[3,4],[4,3],[4,4]];
      const isCenter=(r,c)=>(r===3||r===4)&&(c===3||c===4);
      const isExtendedCenter=(r,c)=>r>=2&&r<=5&&c>=2&&c<=5;
      const blueCandidates=[],redCandidates=[],yellowCandidates=[];
      for(let r=0;r<8;r++)for(let c=0;c<8;c++){
        const entry=cm[r][c];
        if(!entry)continue;
        const pAtk=entry[playerCol].length;
        const aAtk=entry[aiCol].length;
        const total=pAtk+aAtk;
        const netCtrl=pAtk-aAtk; // same as heatmap panel's myCtrl-opCtrl
        // Blue/red: net control (consistent with heatmap control-info panel).
        // (See _computeAndCacheVisualAnnotations for the full rationale.)
        if(netCtrl>0){
          let score=netCtrl*2;
          if(isCenter(r,c))score+=3;else if(isExtendedCenter(r,c))score+=1;
          blueCandidates.push({r,c,score});
        }
        if(netCtrl<0){
          let score=(-netCtrl)*2;
          if(isCenter(r,c))score+=3;else if(isExtendedCenter(r,c))score+=1;
          redCandidates.push({r,c,score});
        }
        // Yellow = top squares by TOTAL attacker count (both sides combined,
        // regardless of piece color), ALLOWED to overlap with blue/red.
        // (See _computeAndCacheVisualAnnotations for the full rationale.)
        if(total>=2)yellowCandidates.push({r,c,total});
      }
      blueCandidates.sort((a,b)=>b.score-a.score);
      redCandidates.sort((a,b)=>b.score-a.score);
      yellowCandidates.sort((a,b)=>b.total-a.total);
      for(const sq of blueCandidates.slice(0,3))csl.push({color:'B',square:posAlg({row:sq.r,col:sq.c})});
      for(const sq of redCandidates.slice(0,3))csl.push({color:'R',square:posAlg({row:sq.r,col:sq.c})});
      for(const sq of yellowCandidates.slice(0,3))csl.push({color:'Y',square:posAlg({row:sq.r,col:sq.c})});
      for(const [r,c] of centerSquares){
        const entry=cm[r][c];
        if(entry&&entry.white.length===0&&entry.black.length===0){
          csl.push({color:'G',square:posAlg({row:r,col:c})});
        }
      }
      // Arrows: blue (multi-threat) + yellow (queen threat) from both sides.
      // (No red/green check arrows for initial position — no move was just made.)
      const threatByWhite=new Map();
      const threatByBlack=new Map();
      let whiteQueensThreatened=[],blackQueensThreatened=[];
      for(let r=0;r<8;r++)for(let c=0;c<8;c++){
        const p=st.board[r][c];
        if(!p||p.type==='king')continue; // skip kings as TARGETS
        const enemyColor=p.color==='white'?'black':'white';
        const enemyAttackers=cm[r][c][enemyColor]||[];
        if(enemyAttackers.length===0)continue;
        // v1.1.0 Phase 53 (revision): Filter out king-as-attacker arrows whose
        //   target (r,c) is controlled by the opposite color (p.color) — the king
        //   cannot legally move there, so the arrow would misrepresent an illegal
        //   king move as a valid threat.
        const _friendlyCtrl = cm[r][c][p.color]||[];
        const _legalEnemyAttackers = enemyAttackers.filter(atk =>
          atk.piece.type!=='king' || _friendlyCtrl.length===0
        );
        if(_legalEnemyAttackers.length===0)continue;
        const map=p.color==='white'?threatByWhite:threatByBlack;
        for(const atk of _legalEnemyAttackers){
          const k=atk.position.row+','+atk.position.col;
          if(!map.has(k))map.set(k,{attacker:atk,targets:[]});
          map.get(k).targets.push({piece:p,position:{row:r,col:c}});
        }
        if(p.type==='queen'){
          if(p.color==='white')whiteQueensThreatened.push({position:{row:r,col:c},attackers:_legalEnemyAttackers.slice()});
          else blackQueensThreatened.push({position:{row:r,col:c},attackers:_legalEnemyAttackers.slice()});
        }
      }
      const _pieceVal={pawn:1,knight:3,bishop:3,rook:5,queen:9,king:0};
      const yellowAttackers=[];
      for(const q of whiteQueensThreatened)for(const atk of q.attackers)yellowAttackers.push({attacker:atk,queen:q.position});
      for(const q of blackQueensThreatened)for(const atk of q.attackers)yellowAttackers.push({attacker:atk,queen:q.position});
      const yaSeen=new Set();
      const yaDedup=[];
      for(const ya of yellowAttackers){
        const k=ya.attacker.position.row+','+ya.attacker.position.col+'->'+ya.queen.row+','+ya.queen.col;
        if(yaSeen.has(k))continue;
        yaSeen.add(k);yaDedup.push(ya);
      }
      yaDedup.sort((a,b)=>_pieceVal[b.attacker.piece.type]-_pieceVal[a.attacker.piece.type]);
      for(const ya of yaDedup.slice(0,6))cal.push({color:'Y',from:posAlg(ya.attacker.position),to:posAlg(ya.queen)});
      const multiThreats=[];
      for(const v of threatByWhite.values())if(v.targets.length>=2)multiThreats.push(v);
      for(const v of threatByBlack.values())if(v.targets.length>=2)multiThreats.push(v);
      multiThreats.sort((a,b)=>b.targets.length-a.targets.length);
      for(const mt of multiThreats.slice(0,3)){
        for(const tgt of mt.targets.slice(0,4)){
          cal.push({color:'B',from:posAlg(mt.attacker.position),to:posAlg(tgt.position)});
        }
      }
    }
    // v1.1.1 Phase 62: Mark as auto-generated (imported=false)
    _visualAnnotationsCache.set('_initial',{csl,cal,imported:false});
  }catch(e){
    console.warn('_computeInitialPositionAnnotations failed',e);
  }
}

// v1.0.5 Round-6 Rev64 (2026.6.27): Invalidate cached PGN-related data for
// undone moves. Called from undoMove() after moveRecords is restored to a
// shorter length. Removes cache entries whose key (move index) is beyond the
// new moveRecords length — those correspond to moves that no longer exist.
// See the detailed comment in undoMove() for the rationale.
function _invalidateCachesForUndoneMoves(currentMoveCount){
  try{
    // 1. _reviewEvalCache — keyed by reviewStep (0-based since v1.0.8 Phase 15:
    //    step 0 = initial position, steps 1..N = positions after each move).
    //    Delete entries with key > currentMoveCount. Step 0 (the initial
    //    position) is always retained — it doesn't change on undo.
    if(_reviewEvalCache !== undefined&&_reviewEvalCache){
      const _keysToDelete=[];
      if(typeof _reviewEvalCache.keys==='function'){
        for(const k of _reviewEvalCache.keys()){
          if(typeof k==='number'&&k>currentMoveCount)_keysToDelete.push(k);
        }
      }
      for(const k of _keysToDelete)_reviewEvalCache.delete(k);
    }
  }catch(e){console.warn('_invalidateCachesForUndoneMoves: eval cache failed',e);}
  try{
    // 2. _visualAnnotationsCache — keyed by moveIdx (0-based). Delete entries
    //    with key >= currentMoveCount. The '_initial' sentinel is ALWAYS kept
    //    (it describes the starting position, which doesn't change on undo).
    //    It is cleared separately by _resetGameUIState (new game / import /
    //    setup / FEN) and by enterReview (Phase 57: forces fresh computation
    //    each review session to avoid stale-annotation residue).
    if(typeof _visualAnnotationsCache!=='undefined'&&_visualAnnotationsCache){
      const _vaKeysToDelete=[];
      for(const k of _visualAnnotationsCache.keys()){
        if(k==='_initial')continue;
        if(typeof k==='number'&&k>=currentMoveCount)_vaKeysToDelete.push(k);
      }
      for(const k of _vaKeysToDelete)_visualAnnotationsCache.delete(k);
    }
  }catch(e){console.warn('_invalidateCachesForUndoneMoves: visual annotation cache failed',e);}
  try{
    // 3. _cachedOriginalPGN — null it so subsequent PGN operations use
    //    _buildPGNString() (which reads the current, shorter moveRecords).
    if(typeof _cachedOriginalPGN!=='undefined')_cachedOriginalPGN=null;
  }catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
  // v1.0.8 BUG FIX:
  // After undo, the critical-moves list (reviewCritical) still contained
  // entries for the now-undone moves, causing misaligned critical-move
  // markers in review mode. Recompute reviewCritical from the new
  // (shorter) moveRecords so review-mode annotations stay consistent.
  try{
    if(typeof _findCriticalMoves==='function'){
      reviewCritical=_findCriticalMoves();
    }
  }catch(e){console.warn('_invalidateCachesForUndoneMoves: reviewCritical recompute failed',e);}
}

function _resetGameUIState(){
  selectedSquare=null;
  legalMvs=[];
  legalSet=new Set();
  lastMove=null;
  pendingPromotion=null;
  _aiBarInfo='';
  _hintBarInfo='';
  hintText='';
  isHintLoading=false;
  aiThinkInfo='';
  gameOverSoundPlayed=false;
  // v1.0.8 PHASE 24 (bug fix): use _clearAnimationState() instead of just
  //   setting animationInProgress=false. This also clears _activeAnimEls and
  //   removes leftover .move-anim overlay nodes, preventing ghost pieces from
  //   being re-attached by _reattachActiveAnimations() on the next render.
  _clearAnimationState();
  _cachedStatus=null;
  _cachedStatusKey='';
  cachedCtrlKey='';
  if(renderTimerId){cancelAnimationFrame(renderTimerId);renderTimerId=null;}
  renderPending=false;
  // Clear redo stack on game reset to prevent stale redo entries
  // from corrupting gameState when redoMove() is called after a new game.
  _redoStack=[];
  // v1.0.4 Rev27: Reset resign state — prevent the previous game's resign
  // result from leaking into the new game's PGN / display.
  showResignConfirm=false;
  if(typeof _resignWinnerColor!=='undefined'){_resignWinnerColor=null;}
  // v1.0.4 Rev47: Reset timeout winner color too
  if(typeof _timeoutWinnerColor!=='undefined'){_timeoutWinnerColor=null;}
  // v1.0.2 FIX: Reset stale AI/ponder/eval/MultiPV state to prevent leak
  // into the new game. Without this, starting a new game during AI thinking
  // left isAIThinking=true (blocking new doAIMove calls) and kept the old
  // safety timer running (which could fire on the new gameState).
  isAIThinking=false;
  if(typeof _aiSafetyTimerId!=='undefined'&&_aiSafetyTimerId){clearTimeout(_aiSafetyTimerId);_aiSafetyTimerId=null;}
  if(typeof _aiRetryCount!=='undefined')_aiRetryCount=0;
  if(typeof _evalLoading!=='undefined')_evalLoading=false;
  if(typeof _sfEvalReady!=='undefined')_sfEvalReady=false;
  if(typeof _ponderGen!=='undefined')_ponderGen++;
  if(typeof _ponderMoveSAN!=='undefined')_ponderMoveSAN='';
  if(typeof _ponderBarInfo!=='undefined')_ponderBarInfo='';
  if(typeof _pendingPonderMoveUCI!=='undefined')_pendingPonderMoveUCI=null;
  if(typeof _multiPVLines!=='undefined')_multiPVLines=[];
  if(typeof _multiPVResult!=='undefined')_multiPVResult=null;
  if(typeof _lastEngineVariation!=='undefined')_lastEngineVariation=null;
  // v1.0.4 FIX (this round): clear the visual annotations cache on game reset.
  // Without this, stale [%csl]/[%cal] entries from a previous game could leak
  // into the new game's PGN export (the cache is keyed by moveRecords index,
  // and a new game reuses indices 0, 1, 2, ... starting from 0).
  if(typeof _visualAnnotationsCache!=='undefined'&&_visualAnnotationsCache)_visualAnnotationsCache.clear();
  // v1.1.1 Phase 64 ROOT CAUSE FIX: Clear reviewStates and reviewMode.
  //   _computeAndCacheVisualAnnotations (called after each move via
  //   executeMove) checks reviewStates[moveIdx+1] FIRST as a shortcut to
  //   get the post-move state. If reviewStates still holds entries from a
  //   PREVIOUS game's review session (because the user entered review on
  //   game A, exited, then started game B), the function uses the OLD
  //   game's board state at the same move index — producing annotations
  //   that match the old game at that step (not the new game). This is
  //   the TRUE root cause of "old game's visual annotations appearing in
  //   new game's PGN": the annotations are freshly generated but from
  //   stale reviewStates data, not from stale _visualAnnotationsCache.
  //   Fix: clear reviewStates, reviewMode, reviewStep, and reviewBaseState
  //   in _resetGameUIState so _computeAndCacheVisualAnnotations falls
  //   through to the correct replay-from-moveRecords path.
  if(typeof reviewStates!=='undefined')reviewStates=[];
  if(typeof reviewMode!=='undefined')reviewMode=false;
  if(reviewStep!==undefined)reviewStep=0;
  if(typeof reviewBaseState!=='undefined')reviewBaseState=null;
  // v1.1.1 Phase 65: Clear _preReviewSnapshot — if the user was in review mode
  //   when a new game started, this snapshot holds references to the old game's
  //   state (gameState, moveRecords, stateHistory, etc.), preventing GC and
  //   potentially confusing exitReview if it's somehow called later.
  if(typeof _preReviewSnapshot!=='undefined')_preReviewSnapshot=null;
  // v1.1.1 Phase 65: Clear setup history — if the user was in setup mode,
  //   these hold undo/redo snapshots of the setup board that are meaningless
  //   for the new game.
  if(typeof setupHistory!=='undefined')setupHistory=[];
  if(typeof setupRedoStack!=='undefined')setupRedoStack=[];
  // v1.1.1 Phase 65: Clear dialog visibility flags — if a dialog was open
  //   when a new game started, it should be dismissed.
  if(typeof showNewGameDialog!=='undefined')showNewGameDialog=false;
  if(typeof showAboutPage!=='undefined')showAboutPage=false;
  if(typeof showImportDialog!=='undefined')showImportDialog=false;
  if(typeof showEngineConfig!=='undefined')showEngineConfig=false;
  if(typeof showPGNCacheManager!=='undefined')showPGNCacheManager=false;
  if(typeof showSavePGNPrompt!=='undefined')showSavePGNPrompt=false;
  if(typeof showResignConfirm!=='undefined')showResignConfirm=false;
  if(typeof _pendingActionAfterSave!=='undefined')_pendingActionAfterSave=null;
  // v1.1.2 Phase 67 Task 67.2: Clear any pending PGN cache save (set by the
  //   partial-eval-coverage dialog when the user chose "Analyze All first").
  //   A new game invalidates the pending save because the moveRecords it was
  //   tied to no longer exist.
  if(typeof _pendingPGNCacheSave!=='undefined')_pendingPGNCacheSave=null;
  // v1.1.2 Phase 69 (Bug 3): Clear the PGN cache op-in-progress flag — a new
  //   game invalidates any in-flight cache operation.
  if(typeof _pgnCacheOpInProgress!=='undefined')_pgnCacheOpInProgress=false;
  // v1.1.2 Phase 68 (Issue 30 P2): Clear the long-press priority queue — a
  //   new game invalidates queued step indices because reviewStates will be
  //   rebuilt for the new game.
  _reviewAnalyzePriorityQueue=[];
  // v1.2.3 round-18 (bug fix): terminate any in-flight analyze-all batch.
  //   Previously _resetGameUIState cleared reviewMode/reviewStates but left
  //   the batch state machine running: _reviewAnalyzeAllActive stayed true,
  //   the safety timer kept firing toast+render every 60s (ghost loop), and
  //   the Java-side _evalDeepBatchActive flag was never ended — leaving the
  //   engine in eval-mode options for the next game until engine restart.
  //   Mirror the exitReview() cleanup (function decls are bundle-hoisted).
  if(typeof _reviewAnalyzeAllActive!=='undefined'&&_reviewAnalyzeAllActive){
    _reviewAnalyzeAllActive=false;
    try{if(typeof _endEvalDeepBatchIfActive==='function')_endEvalDeepBatchIfActive();}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
    if(typeof _reviewAnalyzeSafetyTimer!=='undefined'&&_reviewAnalyzeSafetyTimer){clearTimeout(_reviewAnalyzeSafetyTimer);_reviewAnalyzeSafetyTimer=null;}
    if(typeof _evalRequestBatchGen!=='undefined')_evalRequestBatchGen=0;
  }
  // v1.2.3 round-18 (bug fix): also clear the pending open-stats flag/timer —
  //   exitReview() does this, but _resetGameUIState can run WITHOUT exitReview
  //   (FEN/PGN import from the review dialog). A stale flag would spuriously
  //   open the stats page when the NEXT game's analysis completes.
  if(typeof window!=='undefined'){
    window._pendingOpenStats=false;
    if(window._pendingOpenStatsTimer){clearTimeout(window._pendingOpenStatsTimer);window._pendingOpenStatsTimer=null;}
  }
  // v1.0.4 REV13: Reset scroll state on new game
  // v1.0.4 Rev30: also reset the restore guard (in case a render is in flight)
  if(typeof _mlistScrollState!=='undefined'){_mlistScrollState.scrollTop=0;_mlistScrollState.atBottom=false;_mlistScrollState.valid=false;}
  if(typeof _scrollRestoreGuard!=='undefined')_scrollRestoreGuard=false;
  // v1.0.4 FIX (this round): also clear the game clocks on game reset.
  // Without this, a timed game's clock timer would keep running after the
  // user starts a new untimed game (or a new timed game with different
  // settings). initGameClocks() is called separately from _startGameImpl()
  // to set up the new game's clocks; here we just stop the old timer.
  if(gameClockTimerId!==undefined&&gameClockTimerId){clearInterval(gameClockTimerId);gameClockTimerId=null;}
  if(typeof gameClockExpired!=='undefined')gameClockExpired=null;
  // v1.1.0 Phase 56 FIX: Reset _turnStartTime so the FIRST move of the new
  //   game (or the first move after FEN/PGN import / setup-complete) has an
  //   accurate [%emt]/{Xs} annotation. Previously _turnStartTime was NEVER
  //   reset at any game-start entry point — it was only set at module-load
  //   time (ui.js line 1781) and re-assigned inside executeMove() after each
  //   move. This meant the first move's elapsed time included the wall-clock
  //   duration since the PREVIOUS game's last move (or since app launch if
  //   no previous game), which could be minutes, hours, or days.
  //   The reset belongs here (in _resetGameUIState) because EVERY game-start
  //   entry point calls _resetGameUIState: _startGameImpl (new game dialog),
  //   quickFreeOpening (free opening button), _exitSetupImpl (setup complete),
  //   _applyImportedFEN (FEN import), importPGN (PGN import). This ensures
  //   _turnStartTime is synchronized with the start of the new game, and —
  //   for timed games — with initGameClocks()'s lastMoveTimestamp reset
  //   (which also happens at game start).
  if(typeof _turnStartTime!=='undefined'){_turnStartTime=Date.now();}
  // v1.1.0 Phase 56 FIX: Null gameClocks for non-dialog entry points.
  //   Previously, _resetGameUIState only stopped the timer interval but did
  //   NOT null the gameClocks object itself. So after FEN/PGN import or
  //   setup-complete, gameClocks retained the PREVIOUS game's clock state
  //   (or null if the previous game was untimed). This caused:
  //     (a) Stale [%clk] annotations in PGN export (using the old game's
  //         remaining time).
  //     (b) Stale wtime/btime sent to the engine if the imported position
  //         triggered an AI move.
  //   _startGameImpl() calls initGameClocks() AFTER _resetGameUIState() to
  //   set up fresh clocks for the new timed game — so nulling here is safe
  //   for the dialog path (initGameClocks will overwrite the null). For
  //   non-dialog paths (FEN/PGN/setup), the imported game is treated as
  //   untimed unless the user explicitly starts a new timed game.
  if(gameClocks !== undefined){gameClocks=null;}
  // v1.1.1 Phase 61: Clear ALL remaining per-game caches that could pollute
  //   the new game's PGN records, eval display, and statistics. Previously
  //   these were cleared inconsistently across the 5 entry points
  //   (_startGameImpl / quickFreeOpening / _exitSetupImpl / _applyImportedFEN /
  //   importPGN), leading to stale-data leaks. Centralizing them here ensures
  //   every entry point gets the same clean slate.
  //   - _ecoRecCache: ECO recommendation cache (keyed by position hash, but
  //     a new game from the standard start position could collide with a
  //     previous game's hash if both start from the initial position).
  //   - _pvCache: PV-line SAN conversion cache (keyed by hash+UCI-prefix;
  //     low risk but cleared for consistency).
  //   - _pendingEngineSANs/_pendingEnginePVs: engine PV variations indexed
  //     by moveRecords indices — a new game reuses indices 0,1,2,... so
  //     stale entries would attach to the wrong moves.
  //   - _multiPVLines/_multiPVResult/_lastEngineVariation: MultiPV display
  //     state from the previous game's engine search.
  //   - reviewCritical: critical-move markers from the previous game's
  //     review session.
  //   - _sfEval/_sfMateDistance/_sfDepth/_sfSeldepth/_sfWdl*/_sfEvalReady:
  //     eval display variables — reset to defaults so the eval bar starts
  //     fresh instead of showing the previous game's last eval.
  //   - _reviewEvalCache: the LRU eval cache (keyed by per-game reviewStep).
  //     Previously cleared separately in each entry point; now centralized.
  //   - _reviewEvalRequestedStep: the step currently being evaluated.
  //   - _cachedOriginalPGN: the imported PGN text (for stats page / PGN
  //     cache save). Must be nulled so the new game doesn't inherit the
  //     old game's PGN.
  //   - playerWhite/playerBlack: imported player names — a new game uses
  //     the default "你"/"AI对手" (or _humanPlayerName if set via rename).
  //   - _setupFEN: the setup-position FEN — a new game from the initial
  //     position has no setup FEN.
  //   - _importedStartMoveNum: the imported FEN/PGN's starting move number
  //     — a new game from the initial position starts at move 1.
  //   - _needNewGameForEngine: tells the engine to send ucinewgame before
  //     the next search (clears the engine's internal hash tables).
  //   - _tbLoading/_tbRetryCount: tablebase query state.
  //   - _humanPlayerName is NOT cleared here — it's a persistent user
  //     preference (the rename feature) that should survive across games.
  if(typeof _ecoRecCache!=='undefined'&&_ecoRecCache&&typeof _ecoRecCache.clear==='function')_ecoRecCache.clear();
  if(typeof _pvCache!=='undefined'&&_pvCache&&typeof _pvCache.clear==='function')_pvCache.clear();
  if(typeof _pendingEngineSANs!=='undefined')_pendingEngineSANs=[];
  if(typeof _pendingEnginePVs!=='undefined')_pendingEnginePVs=[];
  // v1.2.3 round-18 (cleanup): removed duplicate resets of _multiPVLines/
  //   _multiPVResult/_lastEngineVariation/_sfEvalReady/_evalLoading — each was
  //   already reset earlier in this function (see the AI/ponder/eval block).
  if(typeof reviewCritical!=='undefined')reviewCritical=[];
  if(typeof _sfEval!=='undefined')_sfEval=0;
  if(typeof _sfMateDistance!=='undefined')_sfMateDistance=0;
  if(typeof _sfDepth!=='undefined')_sfDepth=0;
  if(typeof _sfSeldepth!=='undefined')_sfSeldepth=0;
  if(typeof _sfWdlW!=='undefined')_sfWdlW=-1;
  if(typeof _sfWdlD!=='undefined')_sfWdlD=-1;
  if(typeof _sfWdlL!=='undefined')_sfWdlL=-1;
  if(_reviewEvalCache !== undefined&&_reviewEvalCache&&typeof _reviewEvalCache.clear==='function'){
    try{_reviewEvalCache.clear();}catch(e){console.warn('_resetGameUIState: review eval cache clear failed',e);}
  }
  if(typeof _reviewEvalRequestedStep!=='undefined')_reviewEvalRequestedStep=-1;
  if(typeof _cachedOriginalPGN!=='undefined')_cachedOriginalPGN=null;
  if(typeof playerWhite!=='undefined')playerWhite=undefined;
  if(typeof playerBlack!=='undefined')playerBlack=undefined;
  if(typeof _setupFEN!=='undefined')_setupFEN=null;
  if(typeof _importedStartMoveNum!=='undefined')_importedStartMoveNum=1;
  if(typeof _needNewGameForEngine!=='undefined')_needNewGameForEngine=true;
  if(typeof _tbLoading!=='undefined')_tbLoading=false;
  if(typeof _tbRetryCount!=='undefined')_tbRetryCount=0;
  try{if(typeof Store!=='undefined'&&Store&&typeof Store.dispatch==='function'){Store.dispatch('SETUP_EXIT');Store.dispatch('PGN_CLEARED');}}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
}

/**
 * Navigate to a specific review step.
 * @param {number} step - The review step index to navigate to
 */
function reviewGoTo(step){
  if(!reviewMode||!reviewStates||reviewStates.length===0)return;
  step=Math.max(0,Math.min(step,reviewStates.length-1));
  // v1.1.0 Phase 54 rev16: Force _lastReviewStepScrolled=-2 so that even when
  //   the step doesn't change (e.g. ▶ at last step, ⏮ at step 0), the
  //   scrollIntoView in render() still fires and re-centers the active move.
  //   Previously, the guard `reviewStep !== _lastReviewStepScrolled` would skip
  //   scrollIntoView when the step was the same, causing the selection to be
  //   scrolled out of view after DOM rebuild.
  _lastReviewStepScrolled=-2;
  reviewStep=step;
  gameState=cloneS(reviewStates[reviewStep].state);
  // v1.0.8 PHASE 18 Task 3 (perf): Removed the redundant _forceReviewWindowToStep
  // call. render()'s window-computation block (search for "_stepChanged")
  // already detects that reviewStep changed and forces the window to contain
  // the new active step. The old call here did an extra innerHTML replacement
  // that was immediately overwritten by render()'s app.innerHTML=h — pure waste.
  // Update eval display from cache if available
  const cached=_reviewEvalCache.get(reviewStep);
  if(cached!=null){
    _sfEval=cached.eval;_sfMateDistance=cached.mate!=null?cached.mate:0;
    _sfWdlW=cached.wdlW!=null?cached.wdlW:-1;_sfWdlD=cached.wdlD!=null?cached.wdlD:-1;_sfWdlL=cached.wdlL!=null?cached.wdlL:-1;
    _sfDepth=cached.depth!=null?cached.depth:0;_sfSeldepth=cached.seldepth!=null?cached.seldepth:0;_sfEvalReady=true;_evalLoading=false;
    // v1.2.3 round-18 (bug fix): also restore _sfSeldepth from the cache —
    //   the live-eval path (ai-bridge.js) restores all six fields; omitting
    //   seldepth here left the previous step's value on screen (stale SD).
  }else{
    _resetEvalState();
    // FIX: Auto-start analysis when selecting an unanalyzed move in review mode.
    // Previously, selecting an unanalyzed step would show "分析中" but never actually
    // request the engine eval. The user had to manually trigger analysis.
    // Now we immediately request engine evaluation for the selected step.
    requestEngineEval();
  }
  render();
  // v1.0.3-p6: removed redundant setTimeout scrollIntoView — renderInternal()
  // now handles the scroll via the _lastReviewStepScrolled guard, which only
  // fires when reviewStep changes. The old setTimeout(50) here was redundant
  // and could fight with the renderInternal scroll, causing scroll jank.
}

/**
 * Analyze all steps in review mode using engine evaluation.
 * Uses callback-driven approach: requests eval for one step, advances on completion.
 *
 * v1.0.4 Rev24 FIRST-PRINCIPLES REWRITE — fixes "interrupted at a certain point":
 *   Root cause 1: The old startStep loop set startStep=0 when ALL steps were
 *     cached, but requestEngineEval() then early-returned on the cache hit
 *     WITHOUT calling _reviewAnalyzeAdvance(), stalling the batch silently
 *     until the safety timer fired ("analysis_timeout"). Now we detect the
 *     all-cached case up front and short-circuit to completion instantly.
 *   Root cause 2: The safety timer was set ONCE with min(N*8s, 300s) — capped
 *     at 5 minutes. For long games with depth-22 evals (5-15s/step), the 5min
 *     cap fired mid-analysis. Now the per-step safety timer RESETS on every
 *     advance, and the cap is 60s/step (generous) with no global cap.
 *   Root cause 3: If the engine auto-recovered (onEngineReady after restart)
 *     the batch was silently dropped. Now onEngineReady resumes the batch
 *     if _reviewAnalyzeAllActive is still true.
 *   Root cause 4: If requestEngineEval() hit cache during batch (rare race
 *     or re-entry), it returned without advancing. Now requestEngineEval
 *     detects _reviewAnalyzeAllActive + cache hit and calls _reviewAnalyzeAdvance.
 */
/**
 * v1.0.8 PHASE 17: Compute the "Analyze All" button label.
 * Pulled out so _updateReviewAnalyzeBtn() can re-derive the label without
 * rebuilding the whole review panel HTML.
 *
 * Mirrors the original inline ternary from renderInternal:
 *   all-analyzed      if _cachedCount >= _totalSteps
 *   "Analyze All N (k/N)" if some steps are cached
 *   "Analyze All N"   if none cached
 * Returns the localized HTML string.
 */
function _rvAnalyzeBtnLabel(){
  if(!reviewMode)return '';
  const _cachedCount=_reviewEvalCache.size;
  const _totalSteps=(moveRecords?moveRecords.length:0)+1;
  const _allCached=_cachedCount>=_totalSteps;
  if(_allCached)return T('all_analyzed');
  return T('analyze_all_steps')+' '+_totalSteps+(_cachedCount>0?' ('+_cachedCount+'/'+_totalSteps+')':'');
}
/**
 * v1.2.3 round-20 (user request, supersedes round-19's hint line): inner
 * HTML of the "Analyze All" button. While an analyze-all batch is running
 * (_reviewAnalyzeAllActive), the button shows the label on the LEFT and the
 * hint "批量分析进行中… 长按走法可设为优先 / Batch analysis in progress…
 * Long-press a move to prioritize it" RIGHT-ALIGNED on the same button —
 * surfacing the existing long-press-to-prioritize feature
 * (_prioritizeReviewStep) exactly when it is useful. When no batch runs,
 * the button is just the plain label. Rendered from state on full renders
 * (_rvAnalyzeHTML) and kept in sync in place by _updateReviewAnalyzeBtn().
 */
function _rvAnalyzeBtnInnerHTML(){
  const _label=_rvAnalyzeBtnLabel();
  if(!_reviewAnalyzeAllActive)return _esc(_label);
  return '<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+_esc(_label)+'</span>'
    +'<span style="color:var(--accent);font-size:.66rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex-shrink:1;min-width:0">'+T('review_batch_analyzing_hint')+'</span>';
}
/**
 * v1.0.8 PHASE 17: Live-refresh the "Analyze All" button label without
 * triggering a full render. Called from onEngineEval after each manual eval
 * completes — fixes the bug where the button stayed at "Analyze All (k/N)"
 * even after the user had individually evaluated every step.
 *
 * First-principles analysis: the root cause was that onEngineEval calls
 * _updateAllEvalDisplays() (which only updates the eval bar / move list),
 * never the analyze button. The button label is recomputed ONLY inside the
 * full renderInternal pass. After the user manually evaluates the LAST step
 * by clicking its row, no event triggers a render, so the button never
 * refreshes.
 *
 * Fix: re-derive the label and write it directly to the button's textContent.
 * Cheap (one getElementById + one textContent write per eval), no DOM rebuild,
 * no risk of interfering with the user's current scroll position.
 */
function _updateReviewAnalyzeBtn(){
  if(!reviewMode)return;
  const btn=document.getElementById('review-analyze-btn');
  if(!btn)return;
  // v1.2.3 round-20: innerHTML (not textContent) — while a batch runs the
  //   button carries the right-aligned hint span (_rvAnalyzeBtnInnerHTML).
  btn.innerHTML=_rvAnalyzeBtnInnerHTML();
}

/**
 * v1.1.2 Phase 68 (Issue 30 P2): Long-press-to-prioritize a step during
 *   analyze-all. When the user long-presses a move in the review move list
 *   while an analyze-all batch is running, this function:
 *   1. Validates the step is uncached and the batch is active.
 *   2. Pushes the step onto _reviewAnalyzePriorityQueue.
 *   3. Aborts the current in-flight batch eval via engineStop() so the
 *      priority step can be evaluated next. The in-flight eval's result is
 *      NOT lost — onEngineEval's user-nav stale path caches it for the
 *      original _reviewEvalRequestedStep.
 *   4. Fires a Toast notification + haptic feedback.
 *   5. Triggers _reviewAnalyzeAdvance after a short delay; the advance
 *      function checks the priority queue first and evaluates the prioritized
 *      step before continuing the normal sequence.
 *
 * If no batch is active, the function falls back to navigating to the step
 * and triggering a single eval (graceful degradation).
 *
 * @param {number} step - the review step index to prioritize (1..moveRecords.length)
 */
function _prioritizeReviewStep(step){
  // Validate: must be in review mode
  if(!reviewMode){
    try{showToast(T('priority_eval_not_in_review'),2500);}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
    return;
  }
  // Validate: step must be in range
  if(!reviewStates||step<0||step>=reviewStates.length)return;
  // Validate: step must be uncached (no point prioritizing an already-analyzed step)
  if(_reviewEvalCache.has(step)){
    try{showToast(T('priority_eval_already_cached'),2000);}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
    try{HapticManager.fire('BUTTON_PRESS');}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
    return;
  }
  // Fire haptic feedback (matches the existing long-press pattern)
  try{HapticManager.fire('BUTTON_PRESS');}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
  // If no batch is active, just navigate to the step and trigger a single eval
  // (the user can manually inspect it). This is a graceful fallback.
  if(!_reviewAnalyzeAllActive){
    reviewGoTo(step);
    try{requestEngineEval();}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
    try{showToast(T('priority_eval_toast'),2500);}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
    return;
  }
  // Deduplicate: don't add the same step twice
  if(_reviewAnalyzePriorityQueue.indexOf(step)>=0){
    try{showToast(T('priority_eval_toast'),2500);}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
    return;
  }
  // Push onto the priority queue
  _reviewAnalyzePriorityQueue.push(step);
  // Show toast notification
  try{showToast(T('priority_eval_toast'),2500);}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
  // Abort the current in-flight batch eval so the priority step can be
  // evaluated next. We bump _reviewAnalyzeGen and clear _evalRequestBatchGen
  // so the in-flight onEngineEval callback is treated as stale (its result
  // will be cached for _reviewEvalRequestedStep via the user-nav stale path,
  // NOT lost). The safety timer (60s) will eventually fire if the engine
  // doesn't respond to the stop, advancing the batch.
  if(typeof _evalRequestBatchGen!=='undefined')_evalRequestBatchGen=0;
  if(typeof _reviewAnalyzeGen!=='undefined')_reviewAnalyzeGen++;
  // Clear the safety timer — _reviewAnalyzeAdvance will reset it when it
  // picks up the priority entry. Without this clear, the old safety timer
  // could fire and skip the priority step.
  if(_reviewAnalyzeSafetyTimer){clearTimeout(_reviewAnalyzeSafetyTimer);_reviewAnalyzeSafetyTimer=null;}
  // Send engine "stop" — the engine will respond with bestmove, which fires
  // onEngineEval. Because _evalRequestBatchGen is now 0, the batch path in
  // onEngineEval is skipped; the user-nav stale path caches the result for
  // _reviewEvalRequestedStep (the step that was being evaluated when the
  // user long-pressed).
  try{
    if(typeof AndroidBridge!=='undefined'&&typeof AndroidBridge.engineStop==='function'){
      AndroidBridge.engineStop();
    }
  }catch(e){console.warn('engineStop for priority failed',e);}
  // Trigger _reviewAnalyzeAdvance after a short delay to pick up the priority
  // entry. The delay (100ms) gives the engine time to process the stop
  // command and fire its bestmove callback. If the callback hasn't arrived
  // by then, _reviewAnalyzeAdvance will still pick up the priority entry
  // (because the priority queue check happens BEFORE the normal sequence).
  // We use a flag to prevent multiple advance triggers if the bestmove
  // callback also fires.
  const _advanceFlag='_priorityAdvancePending';
  if(!window[_advanceFlag]){
    window[_advanceFlag]=true;
    setTimeout(function(){
      window[_advanceFlag]=false;
      if(_reviewAnalyzeAllActive){
        try{_reviewAnalyzeAdvance();}catch(e){console.error('Priority advance failed:',e);}
      }
    },150);
  }
}

// v1.2.3 P1 (Round 17 P1-3 / Round 18 A-P1-2): Helper to end the Java-side
//   eval-deep batch. Idempotent — safe to call when no batch was started.
//   Feature-detected so older AndroidBridge (without engineEvalDeepEndBatch)
//   degrades gracefully to the per-step setoption path.
function _endEvalDeepBatchIfActive(){
  try{
    if(typeof AndroidBridge!=='undefined'&&AndroidBridge&&typeof AndroidBridge.engineEvalDeepEndBatch==='function'){
      AndroidBridge.engineEvalDeepEndBatch();
    }
  }catch(e){console.warn('[UI] engineEvalDeepEndBatch failed:',e&&e.message?e.message:e);}
}

function reviewAnalyzeAll(){
  if(!reviewMode||!reviewStates||reviewStates.length===0)return;
  // v1.2.3 P1 (Round 17 P1-3 / Round 18 A-P1-2): Begin the Java-side batch
  //   flag so engineEvalDeep() skips the per-step forceFullStrength() +
  //   applyEvalModeOptions() setoption storm. The begin-hook sets the
  //   eval-mode UCI options exactly once; the matching end-hook (called
  //   from every batch-termination path) restores gameplay options via
  //   applySettings(). Wrapped in try/catch + feature-detect so older
  //   AndroidBridge without the new methods still works (per-step fallback).
  try{
    if(typeof AndroidBridge!=='undefined'&&AndroidBridge&&typeof AndroidBridge.engineEvalDeepBeginBatch==='function'){
      AndroidBridge.engineEvalDeepBeginBatch();
    }
  }catch(e){console.warn('[UI] engineEvalDeepBeginBatch failed:',e&&e.message?e.message:e);}
  // v1.0.4 Rev24: If every step is already cached, complete INSTANTLY.
  // v1.0.8 PHASE 15: Analyze-all now includes step 0 (the initial position).
  const _lastStep=moveRecords.length; // = reviewStates.length - 1
  let _uncachedCount=0;
  for(let i=0;i<=_lastStep;i++){
    if(!_reviewEvalCache.has(i))_uncachedCount++;
  }
  if(_uncachedCount===0){
    // v1.2.3 P1: We called engineEvalDeepBeginBatch() above but no actual
    //   eval ran (everything cached). End the batch immediately so the
    //   Java-side flag is cleared and gameplay options are restored.
    _endEvalDeepBatchIfActive();
    showToast(T('analysis_done')+' '+(_lastStep+1)+' '+T('step'));
    try{HapticManager.fire('BUTTON_PRESS');}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
    render();
    return;
  }
  _reviewAnalyzeAllActive=true;
  // v1.2.3 round-20: immediately switch the analyze button to
  //   label + right-aligned "batch in progress" hint (no full render
  //   happens at batch start; the helper rewrites the button in place).
  _updateReviewAnalyzeBtn();
  // v1.1.2 Phase 68 (Issue 30 P2): Clear any stale priority queue at batch
  //   start (defensive — should already be empty if the previous batch
  //   completed normally, but a crashed/canceled batch might have left entries).
  _reviewAnalyzePriorityQueue=[];
  // v1.1.1 Phase 59 Task 59.6: Save the step the user was on so we can return
  //   to it after analysis. The batch runs in the background (decoupled from
  //   reviewStep) — the user can navigate freely during the batch.
  let _preAnalyzeStep=reviewStep;
  window._reviewAnalyzeReturnStep=_preAnalyzeStep;
  // Find first un-analyzed step (skip cached steps for efficiency)
  let startStep=-1;
  for(let i=0;i<=_lastStep;i++){
    if(!_reviewEvalCache.has(i)){startStep=i;break;}
  }
  if(startStep<0)startStep=0;
  // v1.1.1 Phase 59 Task 59.6: Don't hijack reviewStep — the batch runs in
  //   the background. The user sees their current step on the board, and
  //   progress is shown via toast. After the batch completes, we return to
  //   the user's pre-batch step (which is the same as their current step
  //   unless they navigated during the batch).
  showToast(T('analyzing_all')+' ('+_reviewEvalCache.size+'/'+(_lastStep+1)+')');
  try{HapticManager.fire('BUTTON_PRESS');}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
  // Start the batch via _requestBatchEval (always exported by ai-bridge.js).
  _requestBatchEval(startStep);
}

/**
 * v1.0.4 Rev24: Reset the per-step safety timer. Called on every advance
 * so a stuck engine on step N doesn't abort the entire batch — only step N.
 * 60 seconds per step is generous; depth-22 evals typically finish in 5-15s.
 * v1.1.1 Phase 59 Task 59.6: Log uses _reviewAnalyzeStep (not reviewStep).
 */
function _reviewAnalyzeResetSafetyTimer(){
  if(_reviewAnalyzeSafetyTimer){clearTimeout(_reviewAnalyzeSafetyTimer);}
  _reviewAnalyzeSafetyTimer=setTimeout(function(){
    if(_reviewAnalyzeAllActive){
      // v1.0.4 Rev24: Don't abort the whole batch — skip the stuck step and
      // continue. This is more resilient than the old behavior (abort all).
      console.warn('Analyze-all: step '+_reviewAnalyzeStep+' timed out, skipping');
      // v1.1.1 Phase 59 Task 59.6: Clear the batch gen so the stale callback
      //   (if it ever arrives) doesn't double-advance.
      if(typeof _evalRequestBatchGen!=='undefined')_evalRequestBatchGen=0;
      _reviewAnalyzeAdvance();
    }else{
      _reviewAnalyzeSafetyTimer=null;
    }
  },60000); // 60s per step
}

/**
 * Advance to the next review step during analyze-all.
 * Called from onEngineEval when _reviewAnalyzeAllActive is true.
 * v1.0.4 Rev24: Also called from requestEngineEval() when a cache hit occurs
 *   during batch mode (previously stalled silently).
 * v1.1.1 Phase 59 Task 59.6: Uses _reviewAnalyzeStep (decoupled from
 *   reviewStep) so user navigation during the batch doesn't hijack progress.
 *   The batch runs in the background; the user's reviewStep is restored
 *   only when the batch completes.
 */
function _reviewAnalyzeAdvance(){
  if(!_reviewAnalyzeAllActive)return;
  const _lastStep=moveRecords.length;
  // v1.1.2 PHASE 72 (bug fix): The completion check previously ONLY walked
  //   forward from _reviewAnalyzeStep+1. When the user long-pressed a step
  //   to prioritize it (Phase 68), the batch would evaluate that single
  //   step, then advance forward and find all subsequent steps already
  //   cached (or reach _lastStep), incorrectly reporting "all analysis
  //   complete" — even though steps BEFORE the prioritized step were still
  //   uncached. The user saw a "完成 N 步" toast with N < total, and the
  //   batch ended prematurely, leaving earlier steps un-analyzed.
  //   Root cause: the completion check was a forward-only walk; it never
  //   scanned steps 0.._reviewAnalyzeStep-1 for uncached entries.
  //   Fix: walk the ENTIRE range [0.._lastStep] to find the next uncached
  //   step. This correctly resumes the batch from the lowest uncached step
  //   after a priority eval completes, regardless of where the priority
  //   step sat in the sequence. The forward-only optimization (skip cached
  //   steps ahead of _reviewAnalyzeStep) is preserved as a fast-path, but
  //   the full-range scan is the source of truth for completion.
  //
  // v1.1.1 Phase 59 Task 59.6 (historical): Walk forward from
  //   _reviewAnalyzeStep (NOT reviewStep) to find the next uncached step.
  //   This decouples batch progress from user navigation. Still correct
  //   under Phase 72 — the full-range scan below supersedes it for the
  //   completion decision but preserves the "start from _reviewAnalyzeStep"
  //   intent for the common (no-priority) case via the fast-path.
  //
  // v1.1.2 Phase 68 (Issue 30 P0): Eval cache skip — if a step somehow has
  //   a cached entry (e.g., prioritized eval just completed for this step),
  //   advance immediately without sending a new engine request. This is the
  //   "breakpoint resume" mechanism: the batch never re-evaluates a step
  //   that already has a cached eval, so an interrupted batch resumes from
  //   the next uncached step.
  // Fast path: try forward from _reviewAnalyzeStep+1 first (common case —
  //   no priority interruption, steps are analyzed in order). If that finds
  //   an uncached step, use it. If it reaches _lastStep, fall through to the
  //   full-range scan to catch any uncached steps BEFORE _reviewAnalyzeStep
  //   (priority-interruption case).
  let nextStep=_reviewAnalyzeStep+1;
  while(nextStep<=_lastStep){
    if(!_reviewEvalCache.has(nextStep))break; // Found un-analyzed step (forward)
    nextStep++;
  }
  if(nextStep>_lastStep){
    // Forward scan found nothing — but steps BEFORE _reviewAnalyzeStep may
    // still be uncached (e.g., after a priority eval jumped ahead). Scan
    // the full range [0.._lastStep] to find the lowest uncached step.
    // v1.1.2 PHASE 72: This is the fix for the "false completion" bug.
    let _lowestUncached=-1;
    for(let i=0;i<=_lastStep;i++){
      if(!_reviewEvalCache.has(i)){_lowestUncached=i;break;}
    }
    if(_lowestUncached>=0){
      // Resume the batch from the lowest uncached step (before
      // _reviewAnalyzeStep). This handles the priority-interruption case.
      nextStep=_lowestUncached;
    }
    // else: truly all steps cached → fall through to completion branch below
  }
  if(nextStep>_lastStep){
    _reviewAnalyzeAllActive=false;
    // v1.2.3 P1: Batch completed normally — restore gameplay UCI options
    //   that were overridden by engineEvalDeepBeginBatch().
    _endEvalDeepBatchIfActive();
    if(_reviewAnalyzeSafetyTimer){clearTimeout(_reviewAnalyzeSafetyTimer);_reviewAnalyzeSafetyTimer=null;}
    // v1.1.1 Phase 59 Task 59.6: Reset batch state
    _reviewAnalyzeStep=-1;
    if(typeof _evalRequestBatchGen!=='undefined')_evalRequestBatchGen=0;
    // v1.1.2 Phase 68 (Issue 30): Clear any prioritized-step queue (defensive —
    //   should already be empty when batch completes normally).
    _reviewAnalyzePriorityQueue=[];
    // v1.0.8 PHASE 19 (bug fix): Recompute reviewCritical now that the eval cache
    // is fully populated.
    try{if(typeof _findCriticalMoves==='function')reviewCritical=_findCriticalMoves();}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
    // v1.1.2 Phase 67 Task 67.2: If a PGN cache save is pending (user chose
    //   "Analyze All first" in the partial-eval dialog), trigger it now.
    //   The save will use the now-fully-populated _reviewEvalCache so every
    //   move gets a [%eval] annotation. Clear the pending flag BEFORE invoking
    //   the save so the save's own coverage check (defensive) doesn't recurse.
    const _pendingSave=_pendingPGNCacheSave;
    _pendingPGNCacheSave=null;
    // v1.2.1 round-11 (Bug #2 fix): If openStatsPage() deferred opening the
    //   stats page until analyze-all completed, the cache is now fully
    //   populated — re-invoke openStatsPage() so it builds the payload with
    //   the complete evals array. Clear the flag BEFORE the call so the
    //   second invocation takes the normal "all cached → open stats" path.
    const _pendingStats=(typeof window!=='undefined'&&window._pendingOpenStats)?true:false;
    if(typeof window!=='undefined'){
      window._pendingOpenStats=false;
      // v1.2.1 round-11 (Bug #2 fix hardening): clear the safety timeout
      //   since the batch completed normally — no need to fire the 10min
      //   timeout warning.
      if(window._pendingOpenStatsTimer){clearTimeout(window._pendingOpenStatsTimer);window._pendingOpenStatsTimer=null;}
    }
    // Return to the step the user was viewing before analysis (or their
    // current step if they navigated during the batch — reviewGoTo restores
    // eval vars from cache).
    const returnStep=window._reviewAnalyzeReturnStep;
    // v1.1.1 Phase 59 Task 59.6: If the user navigated during the batch,
    //   return to their CURRENT step (reviewStep), not the pre-batch step.
    //   This respects the user's intent. If they didn't navigate, reviewStep
    //   === returnStep, so reviewGoTo(returnStep) is correct.
    const _targetStep=(typeof reviewStep==='number'&&reviewStep>=0&&reviewStep<reviewStates.length)?reviewStep:returnStep;
    if(typeof _targetStep==='number'&&_targetStep>=0&&_targetStep<reviewStates.length){
      reviewGoTo(_targetStep);
      showToast(T('analysis_done')+' '+_reviewEvalCache.size+' '+T('step'));
      // v1.1.2 Phase 67 Task 67.2: trigger pending save AFTER reviewGoTo so
      //   the UI shows the user's pre-batch step (not the last analyzed step).
      if(_pendingSave){
        try{setTimeout(function(){
          try{_pgnCacheSaveCurrentImpl_SkipCoverageCheck(_pendingSave.name,_pendingSave.includeAnn);}
          catch(e){showToast(T('pgn_cache_save_failed'),2500);}
        },150);}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
      }
      // v1.2.1 round-11 (Bug #2 fix): trigger deferred stats page open AFTER
      //   reviewGoTo so the user's pre-batch step is restored first. The
      //   150ms delay mirrors the pending-save pattern: gives the UI time to
      //   paint the restored step before the stats Activity is pushed.
      if(_pendingStats){
        // v1.2.3 P2 (Issue #47 path 4): Show a completion toast BEFORE the
        //   stats Activity is pushed. This is the transition the user most
        //   needs to know about — from "waiting for analysis" to "results
        //   ready". Previously this moment had zero feedback.
        try{showToast(T('analysis_complete_opening_stats'),2500);}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
        try{setTimeout(function(){
          try{if(typeof openStatsPage==='function')openStatsPage();}
          catch(e){console.error('Deferred openStatsPage failed:',e);}
        },150);}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
      }
      return;
    }
    showToast(T('analysis_done')+' '+_reviewEvalCache.size+' '+T('step'));
    render();
    if(_pendingSave){
      try{setTimeout(function(){
        try{_pgnCacheSaveCurrentImpl_SkipCoverageCheck(_pendingSave.name,_pendingSave.includeAnn);}
        catch(e){showToast(T('pgn_cache_save_failed'),2500);}
      },150);}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
    }
    if(_pendingStats){
      // v1.2.3 P2 (Issue #47 path 4): same completion toast as the
      //   _targetStep-valid branch above.
      try{showToast(T('analysis_complete_opening_stats'),2500);}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
      try{setTimeout(function(){
        try{if(typeof openStatsPage==='function')openStatsPage();}
        catch(e){console.error('Deferred openStatsPage failed:',e);}
      },150);}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
    }
    return;
  }
  _reviewAnalyzeStep=nextStep;
  // v1.0.4 Rev24: Reset the per-step safety timer for the new step.
  _reviewAnalyzeResetSafetyTimer();
  // Update progress toast periodically (every 3 steps or at end)
  if(nextStep%3===0||nextStep>=_lastStep){
    const cachedCount=_reviewEvalCache.size;
    showToast(T('analyzing_progress')+' ('+cachedCount+'/'+(_lastStep+1)+')');
  }
  // v1.1.2 Phase 68 (Issue 30 P1): Incremental UI update — instead of calling
  //   render() on every step (which rebuilds the entire DOM and causes memory
  //   pressure on long games per Issue 30 root cause A), use lightweight
  //   updates: refresh the eval trend chart + analyze-all button label, and
  //   only call full render() every 10 steps (or at the end, which is handled
  //   by the completion branch above).
  //   - _refreshEvalTrendChart() rebuilds ONLY the SVG inside .review-chart
  //     (one DOM write), keeping the chart visually in sync with new evals.
  //   - _updateReviewAnalyzeBtn() updates the button label (one textContent).
  //   - Full render() every 10 steps handles: move-list row updates (eval
  //     delta colors, critical-move markers), scroll-into-view for active step,
  //     and any layout shifts. 10 was chosen as a balance: frequent enough
  //     that the move list feels responsive, infrequent enough to avoid the
  //     O(n) DOM rebuild cost that caused WebView memory pressure on 100+
  //     step games.
  try{if(typeof _updateReviewAnalyzeBtn==='function')_updateReviewAnalyzeBtn();}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
  try{if(typeof _refreshEvalTrendChart==='function')_refreshEvalTrendChart();}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
  if(nextStep%10===0){
    try{render();}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
  }
  // v1.1.2 Phase 68 (Issue 30 P1): Main-thread yield — wrap the next
  //   _requestBatchEval call in setTimeout(0) so the JS main thread can
  //   process pending UI events (touch events, scroll, paint) between batch
  //   steps. Without this yield, a 100-step batch would monopolize the main
  //   thread for 5-15 minutes, making the UI feel frozen and increasing the
  //   risk of ANR (Application Not Responding) triggers on aggressive OEM ROMs.
  //   The 0ms delay is enough for the event loop to drain pending microtasks
  //   and macrotasks (including requestAnimationFrame-driven paints) without
  //   measurably slowing the batch (the engine's search time dominates).
  //   The batch gen counter is preserved across the setTimeout boundary
  //   because _evalRequestBatchGen is only reset by user-nav requests and
  //   onEngineEval batch-path completion, neither of which fire here.
  const _batchStep=nextStep;
  setTimeout(function(){
    if(!_reviewAnalyzeAllActive)return; // batch was canceled during the yield
    if(_reviewAnalyzeStep!==_batchStep)return; // batch was hijacked (e.g., long-press priority)
    // v1.1.2 Phase 68 (Issue 30 P2): Prioritized-step injection — if the user
    //   long-pressed a move to prioritize it, evaluate that step FIRST before
    //   continuing the normal batch sequence. The priority queue is drained
    //   one entry at a time; each entry is a step index that was uncached at
    //   long-press time.
    if(_reviewAnalyzePriorityQueue.length>0){
      const _priorityStep=_reviewAnalyzePriorityQueue.shift();
      // Skip if it got cached in the meantime (e.g., the batch reached it
      // before the priority queue did — unlikely but defensive).
      if(_reviewEvalCache.has(_priorityStep)){
        // Re-invoke _reviewAnalyzeAdvance to either pick up the next priority
        // entry or continue the normal sequence.
        try{_reviewAnalyzeAdvance();}catch(e){console.error('Analyze-all priority advance failed:',e);}
        return;
      }
      _reviewAnalyzeStep=_priorityStep;
      // Don't reset the safety timer here — _requestBatchEval does it.
      _requestBatchEval(_priorityStep);
      return;
    }
    // v1.1.1 Phase 59 Task 59.6: Use _requestBatchEval (NOT requestEngineEval)
    //   so the callback is correctly identified as a batch callback.
    _requestBatchEval(_batchStep);
  },0);
}

/**
 * Exit review mode and restore the game state.
 */
function exitReview(){
  // v1.0.8 PHASE 22 supplement: exit-review sound (归位音)
  try{if(typeof playSound==='function')playSound('exitReview');}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
  // v1.0.8 PHASE 24 (bug fix): clear any in-progress animation.
  _clearAnimationState();
  reviewMode=false;
  _reviewAnalyzeAllActive=false;
  // v1.2.3 P1: Exiting review cancels any in-flight batch — restore the
  //   gameplay UCI options that engineEvalDeepBeginBatch() overrode.
  _endEvalDeepBatchIfActive();
  // v1.1.1 Phase 59 Task 59.6: Clear batch session state so a stale
  //   in-flight callback (if any) doesn't try to advance a canceled batch.
  _reviewAnalyzeStep=-1;
  if(typeof _evalRequestBatchGen!=='undefined')_evalRequestBatchGen=0;
  if(typeof _reviewAnalyzeGen!=='undefined')_reviewAnalyzeGen++;
  // v1.1.2 Phase 68 (Issue 30 P2): Clear the priority queue — exiting review
  //   mode invalidates any pending long-press prioritization because the
  //   reviewStates array it indexes is about to be cleared.
  _reviewAnalyzePriorityQueue=[];
  // v1.1.2 Phase 67 Task 67.2: Clear any pending PGN cache save — exiting
  //   review mode invalidates the save because the rebuild path requires
  //   reviewMode===true and a fully-populated _reviewEvalCache.
  if(typeof _pendingPGNCacheSave!=='undefined')_pendingPGNCacheSave=null;
  // v1.2.1 round-11 (Bug #2 fix): Clear the pending-open-stats flag —
  //   exiting review mode invalidates the deferred stats-page opening
  //   because openStatsPage() in review mode requires reviewMode===true
  //   to trigger analyze-all. Without this clear, a stale flag would
  //   cause the next reviewAnalyzeAll() completion (in a future review
  //   session) to spuriously open the stats page.
  // v1.2.1 round-11 (Bug #2 fix hardening): also clear the safety timeout
  //   so it doesn't fire after exit and confuse the user with a stale
  //   "timed out" toast.
  if(typeof window!=='undefined'){
    window._pendingOpenStats=false;
    if(window._pendingOpenStatsTimer){clearTimeout(window._pendingOpenStatsTimer);window._pendingOpenStatsTimer=null;}
  }
  // v1.1.2 Phase 69 (Bug 3): Clear the PGN cache op-in-progress flag — a new
  //   game invalidates any in-flight cache operation.
  if(typeof _pgnCacheOpInProgress!=='undefined')_pgnCacheOpInProgress=false;
  // v1.0.8 PHASE 18 Task 2: Reset virtual list state on exiting review mode.
  // Clears the scroll timer and window so the next review session starts fresh.
  _resetRvVirtualState();
  if(_reviewAnalyzeSafetyTimer){clearTimeout(_reviewAnalyzeSafetyTimer);_reviewAnalyzeSafetyTimer=null;}
  // Restore the complete game state from the pre-review snapshot.
  // Previously, exitReview() only restored gameState from reviewBaseState (the
  // initial position), which caused all moves to be lost when returning from
  // review mode. Now we restore the full game state including move history,
  // redo stack, and game-over status, so the player returns to exactly where
  // they were before entering review mode.
  if(_preReviewSnapshot){
    gameState=_preReviewSnapshot.gameState;
    moveRecords=_preReviewSnapshot.moveRecords;
    lastMove=_preReviewSnapshot.lastMove;
    stateHistory=_preReviewSnapshot.stateHistory;
    _redoStack=_preReviewSnapshot._redoStack;
    gameOver=_preReviewSnapshot.gameOver;
    selectedSquare=_preReviewSnapshot.selectedSquare;
    legalMvs=_preReviewSnapshot.legalMvs;
    legalSet=_preReviewSnapshot.legalSet;
    playerColor=_preReviewSnapshot.playerColor;
    // Restore reviewBaseState so future enterReview() calls work correctly
    if(_preReviewSnapshot.reviewBaseState){
      reviewBaseState=_preReviewSnapshot.reviewBaseState;
    }
    _preReviewSnapshot=null;
    // Validate selectedSquare — piece must still exist and be player's
    if(selectedSquare){
      const sp=gameState.board[selectedSquare.row]&&gameState.board[selectedSquare.row][selectedSquare.col];
      if(!sp||sp.color!==playerColor||gameOver){
        selectedSquare=null;legalMvs=[];legalSet=new Set();
      }
    }
  }else if(reviewBaseState){
    // Fallback: no snapshot (shouldn't happen, but safe default)
    gameState=cloneS(reviewBaseState);
  }
  _resetEvalState();
  _cachedBwrap=null; // Invalidate cached board HTML
  render();
  requestEngineEval();
  if(!gameOver&&gameState.currentTurn!==playerColor){
    doAIMove();
  }
}

// ===================== PGN CACHE MANAGER (v1.0.4 Round-5 Rev18) =====================
// Modal dialog that lets the user:
//   - View all saved PGN cache entries (name, size, mtime)
//   - Save the current game's PGN to the cache with a user-chosen name
//   - Click an entry to import it (review + main move list are both updated)
//   - Select multiple entries via checkbox and delete them
//
// Backed by Java-side AndroidBridge.listPGNCaches / savePGNCache / getPGNCache /
// deletePGNCaches (files in /data/data/com.Regalia/files/pgn_cache/, HyperOS-proof).
// v1.1.2 Phase 69 (Bug 3): _pgnCacheOpInProgress guards against re-entrant
//   operations (save/import/delete/rename/tags) to prevent race conditions
//   where a user clicks multiple operations before the first completes.
let _pgnCacheOpInProgress=false;
function openPGNCacheManager(){
  try{HapticManager.fire('BUTTON_PRESS');}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
  _pgnCacheSelected=new Set();
  // v1.0.4 Rev21: Reset filter state when (re)opening the manager.
  _pgnCacheFilter='';
  _pgnCacheFilterInput='';
  _refreshPGNCacheList();
  showPGNCacheManager=true;
  render();
}

function _refreshPGNCacheList(){
  try{
    if(typeof AndroidBridge==='undefined'||!AndroidBridge.listPGNCaches){
      _pgnCacheList=[];
      return;
    }
    const json=AndroidBridge.listPGNCaches();
    _pgnCacheList=JSON.parse(json||'[]');
  }catch(e){
    _pgnCacheList=[];
  }
}

function _formatPGNCacheSize(bytes){
  if(bytes<1024)return bytes+' B';
  if(bytes<1024*1024)return (bytes/1024).toFixed(1)+' KB';
  return (bytes/(1024*1024)).toFixed(1)+' MB';
}

function _formatPGNCacheMtime(mtime){
  try{
    const d=new Date(mtime);
    const now=new Date();
    const yyyy=d.getFullYear();
    const mm=String(d.getMonth()+1).padStart(2,'0');
    const dd=String(d.getDate()).padStart(2,'0');
    const hh=String(d.getHours()).padStart(2,'0');
    const mi=String(d.getMinutes()).padStart(2,'0');
    if(yyyy===now.getFullYear()){
      return mm+'-'+dd+' '+hh+':'+mi;
    }
    return yyyy+'-'+mm+'-'+dd;
  }catch(e){return '';}
}

function _pgnCacheToggleSel(name){
  if(_pgnCacheSelected.has(name))_pgnCacheSelected.delete(name);
  else _pgnCacheSelected.add(name);
  try{HapticManager.fire('TOGGLE_ON');}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
  render();
}

function _pgnCacheSelectAll(){
  // v1.0.4 Rev21: Only select visible (filtered) entries, not all entries.
  // Rationale: if a filter is active, "select all" should mean "select all
  // visible" — selecting hidden entries would be confusing (the delete count
  // wouldn't match what the user sees).
  const list=_pgnCacheFilter
    ? _pgnCacheList.filter(e=>_pgnCacheEntryMatchesFilter(e,_pgnCacheFilter))
    : _pgnCacheList;
  for(const e of list)_pgnCacheSelected.add(e.name);
  render();
}

function _pgnCacheSelectNone(){
  _pgnCacheSelected.clear();
  render();
}

function _pgnCacheSaveCurrent(){
  // v1.1.2 Phase 69 (Bug 3): Guard against re-entrant operations.
  // The guard is set here and reset in all completion paths:
  //   - _pgnCachePersistSave (synchronous save completes)
  //   - _pgnCacheShowPartialEvalDialog cancel/overlay-click (dialog dismissed without save)
  //   - export annotation dialog cancel (includeAnn===null)
  //   - _reviewAnalyzeAdvance pending-save completion (async save after analyze-all)
  //   - _pgnCacheClose / _resetGameUIState (UI teardown)
  if(_pgnCacheOpInProgress)return;
  let name='';
  try{name=prompt(T('pgn_cache_name_prompt'),T('pgn_cache_save_default'))||'';}catch(e){name='';}
  name=name.trim();
  if(!name)return;
  // v1.2.1: 与 _renameHumanPlayer 保持一致的输入校验 —— 长度上限 60、禁止
  //   文件系统危险字符 / \ : * ? " < > | 与控制字符。否则恶意/误输入可能
  //   逃逸出沙箱路径或破坏 PGN 缓存索引。
  if(name.length>60){
    try{showToast(T('pgn_cache_name_too_long')||'Name too long (max 60)');}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
    return;
  }
  if(/[\/\\:*?"<>|\x00-\x1f\x7f]/.test(name)){
    try{showToast(T('pgn_cache_name_invalid')||'Name contains invalid characters');}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
    return;
  }
  _pgnCacheOpInProgress=true;
  try{
    // v1.1.1 Phase 63: Ask whether to include annotations
    if(typeof _showPGNExportAnnotationDialog==='function'){
      _showPGNExportAnnotationDialog(function(includeAnn){
        if(includeAnn===null){_pgnCacheOpInProgress=false;return;} // cancelled
        _pgnCacheSaveCurrentImpl(name,includeAnn);
        // _pgnCacheSaveCurrentImpl may have: (a) saved synchronously via
        // _pgnCachePersistSave (which resets the guard), or (b) shown the
        // partial-eval dialog (async — guard is reset by the dialog's dismiss
        // handlers). If it returned without doing either (e.g. empty PGN),
        // reset here as a safety net.
        if(!_pendingPGNCacheSave && !_pgnPartialEvalDialogActive){
          _pgnCacheOpInProgress=false;
        }
      });
    }else{
      // Fallback (shouldn't happen — _showPGNExportAnnotationDialog is always exported)
      _pgnCacheSaveCurrentImpl(name,true);
      if(!_pendingPGNCacheSave && !_pgnPartialEvalDialogActive){
        _pgnCacheOpInProgress=false;
      }
    }
  }catch(e){
    _pgnCacheOpInProgress=false;
    throw e;
  }
}
function _pgnCacheSaveCurrentImpl(name,includeAnn){
  // v1.1.1 Phase 61: Fix "imported PGN cannot be correctly saved to PGN cache".
  //   For a pure import (no new moves played after import), use _cachedOriginalPGN
  //   to preserve the original PGN's full text. Otherwise rebuild via _buildPGNString.
  // v1.1.1 Phase 63: Pass includeAnn to _buildPGNString. For pure imports,
  //   _cachedOriginalPGN is used as-is (it already contains whatever annotations
  //   the original PGN had — the user's choice doesn't affect it).
  // v1.1.2 Phase 67 Task 67.2: ROOT-CAUSE FIX for "save with annotations loses [%eval]".
  //   When the user is in review mode and saves with includeAnn=true via the rebuild
  //   path (not pure import), _buildPGNString can only emit [%eval] for steps that
  //   already have an entry in _reviewEvalCache. If the user hasn't navigated to
  //   every step OR run "Analyze All", some steps lack cached evals, and the saved
  //   PGN is missing those [%eval] annotations. We detect this coverage gap and
  //   prompt the user to run "Analyze All" first (with options to save as-is or cancel).
  // v1.1.2 Phase 69 Bug 1+2 ROOT-CAUSE FIX: The Phase 67 coverage check was gated
  //   on `!_useOriginal`, but `_useOriginal` is almost always true for imported PGNs
  //   (because importPGN sets time:null on all moves). This meant the dialog never
  //   appeared (Bug 1) AND the pure-import path saved _cachedOriginalPGN verbatim,
  //   ignoring _reviewEvalCache (Bug 2 — [%eval] lost after reload).
  //   Fix: decouple the coverage check from _useOriginal. When the user has ANY
  //   cached evals (_reviewEvalCache.size > 0) and is in review mode with
  //   includeAnn=true, we (a) run the coverage check regardless of _useOriginal,
  //   and (b) force the rebuild path so [%eval] annotations are included. The
  //   pure-import (_cachedOriginalPGN) path is now only used when there are NO
  //   cached evals at all (truly un-analyzed import).
  const _ctx=_pgnCacheBuildSaveContext(includeAnn);
  // Coverage check (may show dialog and return early)
  if(_ctx.needsCoverageCheck && !_pendingPGNCacheSave){
    const _missing=(_ctx.totalSteps+1)-_ctx.cachedCount;
    if(_missing>0){
      _pgnCacheShowPartialEvalDialog(name, includeAnn, _ctx.totalSteps+1, _ctx.cachedCount);
      return;
    }
  }
  // Build the PGN text
  const pgn=_pgnCacheBuildPGNText(_ctx, includeAnn);
  if(!pgn){
    showToast(T('pgn_cache_save_failed'),2500);
    return;
  }
  _pgnCachePersistSave(name, pgn);
}

// v1.1.2 Phase 69: Build the save context — shared by _pgnCacheSaveCurrentImpl
//   and _pgnCacheSaveCurrentImpl_SkipCoverageCheck. Centralizes the pure-import
//   detection and eval-cache coverage analysis so both paths use identical logic.
//   Returns { useOriginal, hasCachedEvals, needsCoverageCheck, totalSteps, cachedCount }.
function _pgnCacheBuildSaveContext(includeAnn){
  let _useOriginal=false;
  if(typeof _cachedOriginalPGN!=='undefined'&&_cachedOriginalPGN&&moveRecords&&moveRecords.length>0){
    let _allImported=true;
    for(let i=0;i<moveRecords.length;i++){
      const mr=moveRecords[i];
      if(mr&&mr.time!==null&&mr.time!==undefined){_allImported=false;break;}
    }
    if(_allImported)_useOriginal=true;
  }
  // Phase 69: Check eval-cache coverage. This is INDEPENDENT of _useOriginal.
  const _inReview = typeof reviewMode!=='undefined' && reviewMode
    && typeof reviewStates!=='undefined' && reviewStates && reviewStates.length>0
    && _reviewEvalCache !== undefined && _reviewEvalCache;
  let _cachedCount=0;
  const _totalSteps = (moveRecords&&moveRecords.length>0) ? moveRecords.length : 0;
  if(_inReview){
    for(let i=0;i<=_totalSteps;i++){
      if(_reviewEvalCache.has(i))_cachedCount++;
    }
  }
  const _hasCachedEvals = _cachedCount>0;
  // v1.1.2 Phase 70 (Bug 2 edge case fix): if _reviewEvalCache has ANY entries
  //   (even if the user exited review mode — reviewMode=false but the cache
  //   persists until _resetGameUIState), force rebuild path so [%eval] annotations
  //   are included. _buildPGNString reads _reviewEvalCache.peek(i+1) regardless
  //   of reviewMode (it only checks size>0), so the evals WILL be emitted.
  //   Previously, the force was gated on _inReview, which meant exiting review
  //   mode before saving would lose all [%eval] annotations.
  const _hasAnyCachedEvals = _reviewEvalCache !== undefined && _reviewEvalCache && _reviewEvalCache.size>0;
  if(_hasAnyCachedEvals && _useOriginal){
    _useOriginal=false;
  }
  // Coverage check is needed when: includeAnn=true, in review mode, has cached
  // evals (meaning user cares about evals), and there are uncached steps.
  // We only run the coverage dialog when _inReview is true because the dialog's
  // "Analyze All first" option requires review mode to work. If the user exited
  // review mode, we silently force rebuild (no dialog) — the evals from the
  // previous review session are included as-is.
  const _needsCoverageCheck = includeAnn && _inReview && _hasCachedEvals;
  return {
    useOriginal: _useOriginal,
    hasCachedEvals: _hasCachedEvals,
    needsCoverageCheck: _needsCoverageCheck,
    totalSteps: _totalSteps,
    cachedCount: _cachedCount
  };
}

// v1.1.2 Phase 69: Build the PGN text from the save context.
function _pgnCacheBuildPGNText(_ctx, includeAnn){
  let pgn='';
  if(_ctx.useOriginal){
    // Use the original imported PGN text — preserves all comments/tags/NAGs.
    // Only reached when there are NO cached evals (truly un-analyzed import).
    pgn = (typeof _cachedOriginalPGN!=='undefined') ? _cachedOriginalPGN : '';
  }else{
    try{
      if(typeof _buildPGNString==='function')pgn=_buildPGNString(true,includeAnn);
    }catch(e){pgn='';}
  }
  return pgn;
}

// v1.1.2 Phase 69: Persist the PGN save via AndroidBridge + post-save UI update.
//   Shared by _pgnCacheSaveCurrentImpl and _pgnCacheSaveCurrentImpl_SkipCoverageCheck.
function _pgnCachePersistSave(name, pgn){
  if(!pgn){
    showToast(T('pgn_cache_save_failed'),2500);
    _pgnCacheOpInProgress=false; // Phase 69 (Bug 3): reset guard on failure
    return;
  }
  let ok=false;
  try{
    if(typeof AndroidBridge!=='undefined'&&AndroidBridge.savePGNCache){
      ok=!!AndroidBridge.savePGNCache(name,pgn);
    }
  }catch(e){ok=false;}
  if(ok){
    _refreshPGNCacheList();
    showToast(T('pgn_cache_saved')+'：'+name,2000);
    try{HapticManager.fire('BUTTON_PRESS');}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
    render();
  }else{
    showToast(T('pgn_cache_save_failed'),2500);
  }
  _pgnCacheOpInProgress=false; // Phase 69 (Bug 3): reset guard on completion
}

// v1.1.2 Phase 67 Task 67.2: Pending save state — set when user chooses
// "Analyze All first" in the partial-eval dialog. The analyze-all completion
// path (_reviewAnalyzeAdvance) checks this and triggers the deferred save.
let _pendingPGNCacheSave=null;
// v1.1.2 Phase 68: Partial-eval dialog active flag + dismiss handler — registered
//   so handleBackPress() can dismiss the dialog on Android back-button press
//   (matches the pattern used by _pgnExportDialogActive/_pgnExportDialogDismiss).
let _pgnPartialEvalDialogActive=false;
let _pgnPartialEvalDialogDismiss=null;

// v1.1.2 Phase 67 Task 67.2 + Phase 68: Partial-eval-coverage dialog. Shows
//   total/cached step counts and offers three actions: analyze-all-first /
//   save-as-is / cancel. The title now includes a 💾 emoji prefix (Phase 68),
//   and the dialog supports Android back-button dismissal (Phase 68).
function _pgnCacheShowPartialEvalDialog(name, includeAnn, totalSteps, cachedCount){
  // Build a modal dialog similar to _showPGNExportAnnotationDialog in ai-bridge.js.
  // We use a DHTML overlay so it works without any framework.
  try{
    // Remove any existing dialog (defensive)
    const _old=document.getElementById('_pgnPartialEvalDlg');
    if(_old)_old.remove();
    const overlay=document.createElement('div');
    overlay.id='_pgnPartialEvalDlg';
    overlay.className='dov';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-label',T('pgn_cache_partial_eval_title'));
    overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:100000';
    const dlg=document.createElement('div');
    dlg.className='dlg';
    dlg.style.cssText='max-width:440px;background:var(--card,#221015);border:1px solid var(--border,#3a1a1a);border-radius:12px;padding:20px;width:90%;color:var(--text,#f5e6c8)';
    const title=document.createElement('h2');
    title.textContent=T('pgn_cache_partial_eval_title');
    title.style.cssText='color:var(--accent2,#ffd700);margin:0 0 14px 0;font-size:1.05rem';
    dlg.appendChild(title);
    const msg=document.createElement('p');
    msg.style.cssText='font-size:.9rem;line-height:1.6;margin:0 0 16px 0';
    msg.textContent=T('pgn_cache_partial_eval_msg')
      .replace('N1',String(totalSteps))
      .replace('N2',String(cachedCount));
    dlg.appendChild(msg);
    const btns=document.createElement('div');
    btns.style.cssText='display:flex;flex-direction:column;gap:8px';
    // v1.1.2 Phase 68: Centralized dismiss function — used by all buttons AND
    //   the back-button handler. Sets the active flag to false BEFORE removing
    //   the overlay so a synchronous back-press during a button click doesn't
    //   double-dismiss.
    // v1.1.2 Phase 69 (Bug 3): Also reset _pgnCacheOpInProgress so the cancel
    //   path doesn't leave the guard locked.
    const _dismiss=function(){
      _pgnPartialEvalDialogActive=false;
      _pgnPartialEvalDialogDismiss=null;
      if(typeof _pgnCacheOpInProgress!=='undefined')_pgnCacheOpInProgress=false;
      if(overlay.parentNode)overlay.remove();
    };
    _pgnPartialEvalDialogActive=true;
    _pgnPartialEvalDialogDismiss=_dismiss;
    const makeBtn=function(label, isPrimary, onClick){
      const b=document.createElement('button');
      b.type='button';
      b.className='btn'+(isPrimary?' btn-p':'');
      b.textContent=label;
      b.style.cssText='width:100%;justify-content:center;gap:8px;padding:12px;font-size:.9rem';
      b.onclick=function(){
        try{HapticManager.fire('BUTTON_PRESS');}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
        _dismiss();
        onClick();
      };
      return b;
    };
    btns.appendChild(makeBtn(T('pgn_cache_partial_eval_analyze_first'), true, function(){
      // Set pending save; reviewAnalyzeAll() will trigger the save on completion.
      _pendingPGNCacheSave={name:name, includeAnn:includeAnn};
      showToast(T('pgn_cache_analyze_then_save'),2500);
      try{
        if(typeof reviewAnalyzeAll==='function'){
          reviewAnalyzeAll();
        }else{
          // Fallback — shouldn't happen
          _pendingPGNCacheSave=null;
          _pgnCacheSaveCurrentImpl(name, includeAnn);
        }
      }catch(e){
        _pendingPGNCacheSave=null;
        showToast(T('pgn_cache_save_failed'),2500);
      }
    }));
    btns.appendChild(makeBtn(T('pgn_cache_partial_eval_save_as_is'), false, function(){
      // Save with whatever is cached (current behavior pre-fix).
      _pgnCacheSaveCurrentImpl_SkipCoverageCheck(name, includeAnn);
    }));
    btns.appendChild(makeBtn(T('cancel'), false, function(){
      // Just dismiss — no action.
    }));
    dlg.appendChild(btns);
    overlay.appendChild(dlg);
    // Click on overlay (outside dialog) = cancel
    overlay.addEventListener('click', function(e){
      if(e.target===overlay){
        try{HapticManager.fire('BUTTON_PRESS');}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
        _dismiss();
      }
    });
    document.body.appendChild(overlay);
  }catch(e){
    // Fallback: just save as-is if dialog fails to render
    _pgnPartialEvalDialogActive=false;
    _pgnPartialEvalDialogDismiss=null;
    _pgnCacheSaveCurrentImpl_SkipCoverageCheck(name, includeAnn);
  }
}

// v1.1.2 Phase 67 Task 67.2 + Phase 69: Inner save routine that skips the
//   coverage check. Called by the "Save anyway" button OR by the post-analyze-all
//   pending-save path. Phase 69: refactored to use _pgnCacheBuildSaveContext +
//   _pgnCacheBuildPGNText + _pgnCachePersistSave so the PGN-building logic is
//   identical to the with-coverage-check path (fixes Bug 2 — previously this
//   function had its own copy of the pure-import detection that didn't force
//   rebuild when cached evals existed).
function _pgnCacheSaveCurrentImpl_SkipCoverageCheck(name, includeAnn){
  const _ctx=_pgnCacheBuildSaveContext(includeAnn);
  const pgn=_pgnCacheBuildPGNText(_ctx, includeAnn);
  _pgnCachePersistSave(name, pgn);
}


function _pgnCacheImport(name){
  // v1.1.2 Phase 69 (Bug 3): Guard against re-entrant operations.
  if(_pgnCacheOpInProgress)return;
  if(!name)return;
  _pgnCacheOpInProgress=true;
  let pgn=null;
  try{
    if(typeof AndroidBridge!=='undefined'&&AndroidBridge.getPGNCache){
      pgn=AndroidBridge.getPGNCache(name);
    }
  }catch(e){pgn=null;}
  if(!pgn){
    _pgnCacheOpInProgress=false;
    showToast(T('pgn_cache_import_failed'),2500);
    return;
  }
  showPGNCacheManager=false;
  // Import via the standard PGN import path — this updates both the main move
  // list (moveRecords) and (if currently in review mode) the review state.
  // After importPGN, if we were in review mode we re-enter review on the new game.
  const wasReviewMode=typeof reviewMode!=='undefined'&&reviewMode;
  try{
    if(wasReviewMode&&typeof exitReview==='function')exitReview();
  }catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
  // v1.0.8 PHASE 34: use async import with worker offloading to prevent UI jank
  //   on large PGN files. Falls back to sync importPGN if importPGNAsync unavailable.
  // v1.1.2 Phase 69 (Bug 3): The .then callback checks _pgnCacheOpInProgress to
  //   ensure the operation wasn't superseded. It also resets the flag on completion.
  try{
    if(typeof importPGNAsync==='function'){
      importPGNAsync(pgn).then(function(ok){
        if(!_pgnCacheOpInProgress)return; // superseded by another operation
        _pgnCacheOpInProgress=false;
        // v1.0.8 PHASE 35: check success flag — importPGN shows its own error
        //   toast on invalid PGN, so only show success UI if import succeeded.
        if(!ok){
          showToast(T('pgn_cache_import_failed'),2500);
          render();
          return;
        }
        // After import, if we were in review mode, re-enter review on the new game
        if(wasReviewMode){
          try{
            if(typeof enterReview==='function'){
              setTimeout(()=>{try{enterReview();}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}},100);
            }
          }catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
        }
        showToast(T('pgn_cache_imported')+'：'+name,2000);
        try{HapticManager.fire('BUTTON_PRESS');}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
        render();
      }).catch(function(e){
        _pgnCacheOpInProgress=false;
        // v1.0.8 PHASE 35: defensive catch in case .then() callback throws
        console.error('PGN cache import .then failed:',e);
        showToast(T('pgn_cache_import_failed'),2500);
        render();
      });
      return;
    }
    if(typeof importPGN==='function')importPGN(pgn);
    _pgnCacheOpInProgress=false;
  }catch(e){
    _pgnCacheOpInProgress=false;
    showToast(T('pgn_cache_import_failed'),2500);
    return;
  }
  // After import, if we were in review mode, re-enter review on the new game
  if(wasReviewMode){
    try{
      if(typeof enterReview==='function'){
        // Slight delay to let importPGN settle
        setTimeout(()=>{try{enterReview();}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}},100);
      }
    }catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
  }
  showToast(T('pgn_cache_imported')+'：'+name,2000);
  try{HapticManager.fire('BUTTON_PRESS');}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
  render();
}

function _pgnCacheDeleteSelected(){
  // v1.1.2 Phase 69 (Bug 3): Guard against re-entrant operations.
  if(_pgnCacheOpInProgress)return;
  if(_pgnCacheSelected.size===0)return;
  let ok=confirm(T('pgn_cache_confirm_delete'));
  if(!ok)return;
  _pgnCacheOpInProgress=true;
  const names=Array.from(_pgnCacheSelected);
  let deleted=0;
  try{
    if(typeof AndroidBridge!=='undefined'&&AndroidBridge.deletePGNCaches){
      deleted=AndroidBridge.deletePGNCaches(JSON.stringify(names));
    }
  }catch(e){deleted=0;}
  _pgnCacheSelected.clear();
  _refreshPGNCacheList();
  _pgnCacheOpInProgress=false;
  try{HapticManager.fire('BUTTON_PRESS');}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
  showToast(T('pgn_cache_deleted')+'：'+deleted,2000);
  render();
}

function _pgnCacheClose(){
  // v1.1.2 Phase 69 (Bug 3): Reset the op-in-progress flag on close so a
  //   stale async operation (e.g. importPGNAsync .then) doesn't lock the UI.
  _pgnCacheOpInProgress=false;
  showPGNCacheManager=false;
  _pgnCacheSelected.clear();
  // v1.0.4 Rev21: Reset filter state on close so next open shows all entries.
  _pgnCacheFilter='';
  _pgnCacheFilterInput='';
  render();
}

// v1.0.4 Round-5 Rev20: Rename a PGN cache entry.
// Prompts for a new name; refuses to overwrite an existing entry.
function _pgnCacheRename(oldName){
  // v1.1.2 Phase 69 (Bug 3): Guard against re-entrant operations.
  if(_pgnCacheOpInProgress)return;
  if(!oldName)return;
  let newName='';
  try{newName=prompt(T('pgn_cache_rename_prompt'),oldName)||'';}catch(e){newName='';}
  newName=newName.trim();
  if(!newName||newName===oldName)return;
  _pgnCacheOpInProgress=true;
  let ok=false;
  try{
    if(typeof AndroidBridge!=='undefined'&&AndroidBridge.renamePGNCache){
      ok=!!AndroidBridge.renamePGNCache(oldName,newName);
    }
  }catch(e){ok=false;}
  if(ok){
    _refreshPGNCacheList();
    showToast(T('pgn_cache_renamed')+'：'+newName,2000);
    try{HapticManager.fire('BUTTON_PRESS');}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
    render();
  }else{
    showToast(T('pgn_cache_rename_failed'),2500);
  }
  _pgnCacheOpInProgress=false;
}

// v1.0.4 Round-5 Rev20: Tag editor for a PGN cache entry.
// Shows a prompt pre-filled with current tags (comma-separated);
// the user can add/remove tags. Tags are stored as a JSON array on the Java side.
function _pgnCacheEditTags(name){
  // v1.1.2 Phase 69 (Bug 3): Guard against re-entrant operations.
  if(_pgnCacheOpInProgress)return;
  if(!name)return;
  // Find current tags from the in-memory list
  let currentTags=[];
  for(const e of _pgnCacheList){
    if(e.name===name&&Array.isArray(e.tags)){currentTags=e.tags;break;}
  }
  const promptStr=T('pgn_cache_tags_prompt');
  const defaultStr=currentTags.join(', ');
  let input='';
  try{input=prompt(promptStr,defaultStr)||'';}catch(e){input='';}
  // Parse comma-separated input into tags (trim, dedupe, limit length)
  const tags=[];
  const seen=new Set();
  for(const raw of input.split(',')){
    const t=raw.trim();
    if(!t)continue;
    if(t.length>30)continue; // Skip overly long tags
    if(seen.has(t.toLowerCase()))continue; // Dedupe (case-insensitive)
    seen.add(t.toLowerCase());
    tags.push(t);
    if(tags.length>=10)break; // Max 10 tags per entry
  }
  _pgnCacheOpInProgress=true;
  let ok=false;
  try{
    if(typeof AndroidBridge!=='undefined'&&AndroidBridge.setPGNCacheTags){
      ok=!!AndroidBridge.setPGNCacheTags(name,JSON.stringify(tags));
    }
  }catch(e){ok=false;}
  if(ok){
    _refreshPGNCacheList();
    showToast(T('pgn_cache_tags_saved')+'：'+name,2000);
    try{HapticManager.fire('BUTTON_PRESS');}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
    render();
  }else{
    showToast(T('pgn_cache_tags_save_failed'),2500);
  }
  _pgnCacheOpInProgress=false;
}

// v1.0.4 Round-5 Rev21: Tag filter / search functions.
// _pgnCacheFilterInput handles live typing in the search box (no re-render
// to preserve cursor focus). _pgnCacheApplyFilter commits the input as the
// active filter (re-renders the list). _pgnCacheClearFilter clears it.
// _pgnCacheFilterByTag(tag) sets the filter to a specific tag (used when
// clicking a tag chip).
function _pgnCacheOnSearchInput(v){
  _pgnCacheFilterInput=v||'';
  // No render — would lose input focus. The user must press Enter (search key
  // on soft keyboard, via enterkeyhint="search") to apply the filter
  // (calls _pgnCacheApplyFilter). Rev22 removed the redundant 🔍 button.
}
function _pgnCacheApplyFilter(){
  _pgnCacheFilter=_pgnCacheFilterInput.trim();
  // Clear selection — selected items might no longer be visible after filter.
  _pgnCacheSelected.clear();
  try{HapticManager.fire('BUTTON_PRESS');}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
  render();
}
function _pgnCacheClearFilter(){
  _pgnCacheFilter='';
  _pgnCacheFilterInput='';
  try{HapticManager.fire('BUTTON_PRESS');}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
  render();
}
function _pgnCacheFilterByTag(tag){
  if(!tag)return;
  _pgnCacheFilter=String(tag);
  _pgnCacheFilterInput=String(tag);
  _pgnCacheSelected.clear();
  try{HapticManager.fire('BUTTON_PRESS');}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
  render();
}
// v1.0.8 PHASE 39: Filter by tag presence (has any tags / has no tags)
function _pgnCacheFilterByTagPresence(hasTags){
  _pgnCacheFilter=hasTags?'__has_tags__':'__no_tags__';
  _pgnCacheFilterInput='';
  _pgnCacheSelected.clear();
  try{HapticManager.fire('BUTTON_PRESS');}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
  render();
}
// Returns true if an entry matches the current filter.
// Filter matches if any tag matches case-insensitively OR the entry name
// contains the filter (case-insensitive substring match).
// v1.0.8 PHASE 39: special filter values '__has_tags__' and '__no_tags__'
//   filter by tag presence rather than tag content.
function _pgnCacheEntryMatchesFilter(entry,filter){
  if(!filter)return true; // No filter = match all
  // v1.0.8 PHASE 39: tag-presence filters
  if(filter==='__has_tags__'){
    return Array.isArray(entry.tags)&&entry.tags.length>0;
  }
  if(filter==='__no_tags__'){
    return !Array.isArray(entry.tags)||entry.tags.length===0;
  }
  const fl=filter.toLowerCase();
  // Check name (substring)
  if(entry.name&&String(entry.name).toLowerCase().includes(fl))return true;
  // Check tags (exact match preferred, but substring also works for partial typing)
  if(Array.isArray(entry.tags)){
    for(const t of entry.tags){
      if(String(t).toLowerCase().includes(fl))return true;
    }
  }
  return false;
}
// Collect all unique tags across all entries (for the tag-chips quick filter row).
function _pgnCacheCollectAllTags(){
  const set=new Set();
  for(const e of _pgnCacheList){
    if(Array.isArray(e.tags)){
      for(const t of e.tags){
        if(t)set.add(t);
      }
    }
  }
  return Array.from(set).sort((a,b)=>a.localeCompare(b));
}

function _renderPGNCacheManager(){
  if(!showPGNCacheManager)return '';
  // Use the same .dov / .dlg modal pattern as the rest of the app
  const total=_pgnCacheList.length;
  const selCount=_pgnCacheSelected.size;
  // v1.0.4 Rev21: Apply filter to get the visible subset.
  const filtered=_pgnCacheFilter
    ? _pgnCacheList.filter(e=>_pgnCacheEntryMatchesFilter(e,_pgnCacheFilter))
    : _pgnCacheList;
  const visibleCount=filtered.length;
  const allTags=_pgnCacheCollectAllTags();
  // Build search/filter row HTML (Rev21)
  let filterHtml='';
  if(total>0){
    // Search box with enterkeyhint="search" (keyboard Enter shows as 🔍 search key).
    // v1.0.4 FIX (this round): Removed the redundant 🔍 button — Enter key on the
    // soft keyboard now triggers the search directly (handled by onkeydown + the
    // input's enterkeyhint="search" attribute which makes the IME show a search
    // icon instead of "Enter"). The ✕ clear button still appears when a filter
    // is active.
    const filterActive=_pgnCacheFilter!=='';
    // Encode current filter input for safe embedding in the input value attribute
    const filterInputEsc=_escapeHTML(_pgnCacheFilterInput);
    filterHtml=`<div style="display:flex;gap:6px;margin:8px 0;align-items:center;flex-wrap:wrap">
      <input type="search" id="_pgnCacheSearchInput" placeholder="${T('pgn_cache_search_placeholder')}" value="${filterInputEsc}" enterkeyhint="search" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" oninput="_pgnCacheOnSearchInput(this.value)" onkeydown="if(event.key==='Enter'||event.keyCode===13){event.preventDefault();_pgnCacheApplyFilter()}" style="flex:1;min-width:120px;background:var(--input-bg);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:5px 8px;font-size:.78rem;font-family:inherit" />
      ${filterActive?`<button class="btn" style="padding:5px 10px;font-size:.75rem;color:#ff8080;border-color:rgba(255,100,100,.4)" onclick="_pgnCacheClearFilter()" title="${T('pgn_cache_search_clear')}">✕</button>`:''}
    </div>`;
    // Tag-chip quick filter row — always show (even if no tags yet) so the
    // "All" + "Tagged" + "Untagged" buttons are always available.
    // v1.0.8 PHASE 38: horizontal layout — buttons flow left-to-right, wrap only when needed
    // v1.0.8 PHASE 39: added "Tagged" and "Untagged" filter buttons after "All"
    {
      let chipsHtml=`<div class="btn-row" style="display:flex;flex-wrap:wrap;gap:4px;margin:4px 0 8px;font-size:.68rem;align-items:center">`;
      // "All" chip to clear the filter
      const allActive=_pgnCacheFilter==='';
      chipsHtml+=`<button class="btn-compact ${allActive?'chip-active':'chip-inactive'}" style="padding:2px 8px;font-size:.68rem;border-radius:4px;border:1px solid var(--border);cursor:pointer" onclick="_pgnCacheClearFilter()">${T('pgn_cache_filter_all')}</button>`;
      // v1.0.8 PHASE 39: "Tagged" and "Untagged" buttons
      const hasTagsActive=_pgnCacheFilter==='__has_tags__';
      const noTagsActive=_pgnCacheFilter==='__no_tags__';
      chipsHtml+=`<button class="btn-compact ${hasTagsActive?'chip-active':'chip-inactive'}" style="padding:2px 8px;font-size:.68rem;border-radius:4px;border:1px solid var(--border);cursor:pointer" onclick="_pgnCacheFilterByTagPresence(true)">${T('pgn_cache_filter_has_tags')}</button>`;
      chipsHtml+=`<button class="btn-compact ${noTagsActive?'chip-active':'chip-inactive'}" style="padding:2px 8px;font-size:.68rem;border-radius:4px;border:1px solid var(--border);cursor:pointer" onclick="_pgnCacheFilterByTagPresence(false)">${T('pgn_cache_filter_no_tags')}</button>`;
      // Individual tag chips (only if there are tags)
      for(const t of allTags){
        // Encode tag for safe embedding in onclick attribute
        const tagJs=_jsAttrEncode(t);
        const isActive=_pgnCacheFilter===t;
        chipsHtml+=`<button class="btn-compact ${isActive?'chip-active':'chip-inactive'}" style="padding:2px 8px;font-size:.68rem;border-radius:4px;border:1px solid var(--border);cursor:pointer" onclick="_pgnCacheFilterByTag(${tagJs})" title="${T('pgn_cache_filter_by_tag')}">${_escapeHTML(t)}</button>`;
      }
      chipsHtml+=`</div>`;
      filterHtml+=chipsHtml;
    }
    // Filter status line (when filter active)
    if(filterActive){
      // v1.0.8 PHASE 39: show localized label for tag-presence filters
      let filterLabel=_pgnCacheFilter;
      if(filterLabel==='__has_tags__')filterLabel=T('pgn_cache_filter_has_tags');
      else if(filterLabel==='__no_tags__')filterLabel=T('pgn_cache_filter_no_tags');
      filterHtml+=`<div style="font-size:.72rem;color:var(--muted);margin:0 0 6px;padding:3px 8px;background:rgba(212,160,23,.08);border-radius:3px;border-left:2px solid var(--accent)">${T('pgn_cache_filter_status').replace('{count}',visibleCount).replace('{total}',total).replace('{filter}',_escapeHTML(filterLabel))}</div>`;
    }
  }
  let listHtml='';
  if(total===0){
    listHtml=`<div style="text-align:center;padding:30px 10px;color:var(--muted);font-size:.85rem;line-height:1.6">${T('pgn_cache_empty')}</div>`;
  }else if(visibleCount===0){
    // Filter active but no matches
    listHtml=`<div style="text-align:center;padding:30px 10px;color:var(--muted);font-size:.85rem;line-height:1.6">${T('pgn_cache_filter_no_match')}</div>`;
  }else{
    listHtml='<div style="display:flex;flex-direction:column;gap:6px;max-height:50vh;overflow-y:auto;padding:4px 4px 4px 0">';
    for(const e of filtered){
      const checked=_pgnCacheSelected.has(e.name);
      const sizeStr=_formatPGNCacheSize(e.size);
      const timeStr=_formatPGNCacheMtime(e.mtime);
      // v1.0.4 Round-5 Rev19 FIX: HTML-escape the JSON string's double quotes
      // so they don't terminate the double-quoted onclick attribute.
      const nameJs=_jsAttrEncode(e.name);
      // v1.0.4 Round-5 Rev20: Display tags (if any) below the name.
      // v1.0.4 Rev21: Tag chips are now CLICKABLE to filter by that tag.
      const tagsArr=Array.isArray(e.tags)?e.tags:[];
      const tagsHtml=tagsArr.length>0
        ?'<div style="font-size:.68rem;color:var(--accent);margin-top:2px;display:flex;flex-wrap:wrap;gap:3px">'
          +tagsArr.map(t=>{
            const tagJs=_jsAttrEncode(t);
            return `<span style="background:rgba(212,160,23,.18);padding:1px 6px;border-radius:8px;border:1px solid rgba(212,160,23,.3);white-space:nowrap;cursor:pointer" onclick="event.stopPropagation();_pgnCacheFilterByTag(${tagJs})" title="${T('pgn_cache_filter_by_tag')}">${_escapeHTML(t)}</span>`;
          }).join('')
          +'</div>'
        :'';
      listHtml+=`<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:rgba(42,21,32,.5);border:1px solid rgba(212,160,23,.25);border-radius:6px;cursor:pointer" onclick="_pgnCacheToggleSel(${nameJs})">`;
      listHtml+=`<input type="checkbox" ${checked?'checked':''} onclick="event.stopPropagation();_pgnCacheToggleSel(${nameJs})" style="cursor:pointer;flex-shrink:0;width:18px;height:18px;margin-top:2px" />`;
      listHtml+=`<div style="flex:1;min-width:0" onclick="event.stopPropagation();_pgnCacheImport(${nameJs})">`;
      listHtml+=`<div style="font-weight:600;color:var(--text);font-size:.9rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_escapeHTML(e.name)}</div>`;
      // v1.0.8 PHASE 38: use var(--text) with opacity for better contrast (was var(--muted) which is too faint)
      listHtml+=`<div style="font-size:.72rem;color:var(--text);opacity:.75;margin-top:2px">${sizeStr} · ${timeStr}</div>`;
      listHtml+=tagsHtml;
      listHtml+=`</div>`;
      // v1.0.4 Rev24: Removed the redundant 📥 Import button. Clicking the
      // entry's name (the inner div above with onclick="_pgnCacheImport(...)")
      // already imports the entry — the separate 📥 button was redundant and
      // took horizontal space. The ✏️ Rename and 🔖 Tags buttons remain.
      // Horizontal layout matches the toolbar pattern.
      listHtml+=`<div style="display:flex;flex-direction:row;gap:4px;flex-shrink:0;align-items:flex-start">`;
      listHtml+=`<button class="btn" style="padding:4px 8px;font-size:.7rem" onclick="event.stopPropagation();_pgnCacheRename(${nameJs})" title="${T('pgn_cache_rename')}">✏️</button>`;
      listHtml+=`<button class="btn" style="padding:4px 8px;font-size:.7rem" onclick="event.stopPropagation();_pgnCacheEditTags(${nameJs})" title="${T('pgn_cache_tags')}">🔖</button>`;
      listHtml+=`</div>`;
      listHtml+=`</div>`;
    }
    listHtml+='</div>';
  }
  // Toolbar: select all/none, count info
  let toolbarHtml='';
  if(total>0){
    // v1.0.8 PHASE 38: horizontal layout — buttons use plain styling (no .btn class
    //   which has min-height:40px wasting vertical space). Buttons flow left-to-right.
    // v1.0.8 PHASE 50: added .btn-row class — opts out of the portrait grid
    //   transform so the buttons shrink to content width instead of stretching.
    toolbarHtml=`<div class="btn-row" style="display:flex;align-items:center;gap:6px;margin:8px 0;font-size:.78rem;color:var(--muted);flex-wrap:wrap">
      <button class="btn-compact" style="padding:4px 10px;font-size:.75rem;border-radius:4px;border:1px solid var(--border);cursor:pointer;background:var(--btn-bg);color:var(--text)" onclick="_pgnCacheSelectAll()">${T('pgn_cache_select_all')}</button>
      <button class="btn-compact" style="padding:4px 10px;font-size:.75rem;border-radius:4px;border:1px solid var(--border);cursor:pointer;background:var(--btn-bg);color:var(--text)" onclick="_pgnCacheSelectNone()">${T('pgn_cache_select_none')}</button>
      <span style="margin-left:auto">${visibleCount===total?total+' '+T('pgn_cache_count'):visibleCount+'/'+total+' '+T('pgn_cache_count')}${selCount>0?(' · '+selCount+' '+T('pgn_cache_delete_sel')):''}</span>
    </div>`;
  }
  // Bottom buttons
  let bottomBtns='';
  bottomBtns+=`<button type="button" class="btn btn-p" onclick="_pgnCacheSaveCurrent()" style="flex:1;justify-content:center"><span style="font-size:1.1rem">💾</span> ${T('pgn_cache_save_current')}</button>`;
  if(selCount>0){
    bottomBtns+=`<button type="button" class="btn" onclick="_pgnCacheDeleteSelected()" style="flex:1;justify-content:center;color:#ff8080;border-color:rgba(255,100,100,.4)"><span style="font-size:1.1rem">🗑️</span> ${T('pgn_cache_delete_sel')} (${selCount})</button>`;
  }
  bottomBtns+=`<button type="button" class="btn btn-s" onclick="_pgnCacheClose()" style="flex:1;justify-content:center">${T('pgn_cache_close')}</button>`;
  return `<div class="dov" role="dialog" aria-modal="true" aria-label="${T('pgn_cache_manager')}" onclick="if(event.target===this){_pgnCacheClose()}"><div class="dlg" style="max-width:520px"><h2>${T('pgn_cache_manager')}</h2><div class="dlg-sec" style="padding-top:8px">${filterHtml}${toolbarHtml}${listHtml}</div><div class="dlg-btns" style="flex-wrap:wrap;gap:6px">${bottomBtns}</div></div></div>`;
}

// Simple HTML escape for cache names (prevent XSS from user-controlled strings)
// v1.0.8 REDUNDANCY: Unified with
// _esc() (defined in ai-bridge.js). _esc uses a single-pass regex + lookup
// table (faster, less allocation); _escapeHTML previously duplicated the
// same logic with a slower 5-case replace callback. Now _escapeHTML simply
// delegates to _esc, so there is one source of truth for HTML escaping.
// Both names are kept for backward compatibility with existing call sites.
function _escapeHTML(s){
  if(s==null)return '';
  return _esc(s);
}

// v1.0.4 Round-5 Rev19: Encode a string for safe embedding as a JS string literal
// inside a double-quoted HTML attribute (e.g. onclick="func(ENCODED)").
// Produces a JSON string ("...") with all double quotes HTML-escaped to &quot;,
// so the HTML attribute parser doesn't terminate early. When the browser parses
// the attribute, it decodes &quot; back to " before passing to the JS engine,
// so JS sees a valid string literal: func("name").
// Also handles & < > to be safe in attribute context.
function _jsAttrEncode(s){
  if(s==null)s='';
  return JSON.stringify(String(s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}



// v1.0.8 PHASE 30: expose globally so Java's evaluateJavascript("typeof _showStatsImportBackPrompt==='function'...")
//   works. ES module exports aren't global; the bundled chess.html masks this (top-level funcs become global).
window._showStatsImportBackPrompt=_showStatsImportBackPrompt;


/**
 * Start a heartbeat monitor to detect engine crashes.
 * Checks every 30s if the engine has responded; if no response for 120s,
 * attempts to restart the engine.
 */
function _startEngineHeartbeat(){
  _heartbeatRunning=true;
  _lastEngineCallbackTime=Date.now();
  if(_heartbeatIntervalId){clearInterval(_heartbeatIntervalId);}
  _heartbeatIntervalId=setInterval(function(){
    if(!_heartbeatRunning)return;
    const elapsed=Date.now()-_lastEngineCallbackTime;
    if(elapsed>120000){
      console.warn('Engine heartbeat: no response for 120s, attempting restart');
      try{
        if(typeof AndroidBridge!=='undefined'&&typeof AndroidBridge.restartEngine==='function'){
          AndroidBridge.restartEngine();
          // CRITICAL FIX: Reset stale state on heartbeat-initiated restart
          _engineReady=false;
          isAIThinking=false;_aiBarInfo='';
          isHintLoading=false;_hintBarInfo='';
          _evalLoading=false;_sfEvalReady=false;
          _ponderGen++;_ponderMoveSAN='';_ponderBarInfo='';_pendingPonderMoveUCI=null;
          _lastEngineCallbackTime=Date.now();
        }
      }catch(e){console.error('Heartbeat restart failed:',e);}
    }
  },30000);
}

/**
 * Clean up event listeners, timers, and intervals on destroy.
 */
function _cleanupEventListeners(){
  _heartbeatRunning=false;
  if(_heartbeatIntervalId){clearInterval(_heartbeatIntervalId);_heartbeatIntervalId=null;}
  if(renderTimerId){cancelAnimationFrame(renderTimerId);renderTimerId=null;}
  // v1.0.8 PHASE 22: landing animation timer removed (Web Animations API)
  if(_fullRenderTimer){clearTimeout(_fullRenderTimer);_fullRenderTimer=0;}
  if(_reviewAnalyzeSafetyTimer){clearTimeout(_reviewAnalyzeSafetyTimer);_reviewAnalyzeSafetyTimer=null;}
  if(_reviewEvalDebounceTimer){clearTimeout(_reviewEvalDebounceTimer);_reviewEvalDebounceTimer=null;}
  if(_aiSafetyTimerId){clearTimeout(_aiSafetyTimerId);_aiSafetyTimerId=null;}
  // FIX: Clean up notification throttle timer to prevent callback after context destruction
  if(typeof _notificationThrottleTimer!=='undefined'&&_notificationThrottleTimer){clearTimeout(_notificationThrottleTimer);_notificationThrottleTimer=0;}
  // v1.2.3 round-13 (P1): clear the game-clock interval so a timed game in
  //   progress doesn't keep firing _tickGameClock (200ms) after the Activity
  //   is destroyed. The interval is set at _startGameClock and was previously
  //   only cleared in the resign/timeout paths, not in the destroy-cleanup.
  if(gameClockTimerId!==undefined&&gameClockTimerId){clearInterval(gameClockTimerId);gameClockTimerId=null;}
  renderPending=false;
}




// ---- Exports ----
// v1.2.1 round-9: Removed doAIMove and _requestStockfishMove — both are
// defined in game-logic.js, NOT ui.js. In source-module mode the previous
// list would throw SyntaxError; in bundled mode build-chess.py strips the
// whole `export {...}` line via regex, so there was no production impact,
// but the list was misleading. Verified by grep — neither symbol is
// declared in ui.js.
export {render,enterReview,reviewGoTo,reviewAnalyzeAll,exitReview,_resetGameUIState,_buildEvalTrendSVG,_refreshEvalTrendChart,_startEngineHeartbeat,_cleanupEventListeners,_reviewAnalyzeAdvance,_rvAnalyzeBtnLabel,_updateReviewAnalyzeBtn,
// v1.2.3 round-18: added posDesc — defined in this module and previously
//   (incorrectly) exported from game-logic.js.
posDesc};
