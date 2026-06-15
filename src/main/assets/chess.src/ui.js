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
document.addEventListener('click', function(e) {
  const btn = e.target.closest('.btn, .diff-b, .toggle, .clr-btn, .prom-btn, .setup-btn, .setup-del, .setup-clr');
  if (btn) {
    if (!(btn.classList.contains('toggle') || btn.closest('.toggle'))) {
      HapticManager.fire('BUTTON_PRESS');
    }
  }
}, true);

// Touch scroll prevention: block default scroll when touch moves >10px on board
(function(){
  let _touchStartX=0, _touchStartY=0, _touchOnBoard=false;
  document.addEventListener('touchstart',function(e){
    const t=e.touches[0];
    _touchStartX=t.clientX; _touchStartY=t.clientY;
    _touchOnBoard=!!(e.target.closest&&e.target.closest('.bgrid'));
  },{passive:true});
  document.addEventListener('touchmove',function(e){
    if(!_touchOnBoard)return;
    const t=e.touches[0];
    const dx=Math.abs(t.clientX-_touchStartX);
    const dy=Math.abs(t.clientY-_touchStartY);
    if(dx>10||dy>10){
      e.preventDefault();
    }
  },{passive:false});
})();


// ---- Exports ----


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

// ===================== DIRTY FLAG RENDERING SYSTEM =====================
const DIRTY_NONE = 0;
const DIRTY_BOARD = 1;       // Board grid squares changed
const DIRTY_TOOLBAR = 2;     // Header/toolbar changed
const DIRTY_EVAL = 4;        // Eval display changed
const DIRTY_PANEL = 8;       // Side panel changed
const DIRTY_MOVES = 16;      // Move history changed
const DIRTY_DIALOG = 32;     // Dialog state changed
const DIRTY_REVIEW = 64;     // Review mode changed
const DIRTY_FULL = DIRTY_BOARD | DIRTY_TOOLBAR | DIRTY_EVAL | DIRTY_PANEL | DIRTY_MOVES | DIRTY_DIALOG | DIRTY_REVIEW;

let _dirtyFlags = DIRTY_FULL; // Start with full render
let _renderScheduled = false;
let _rAFId = null;

/**
 * Mark components as needing re-render and schedule a batched update.
 * @param {number} flags - Bitmask of DIRTY_* flags indicating what changed
 */
function markDirty(flags) {
  _dirtyFlags |= flags;
  _scheduleRender();
}

/**
 * Schedule a batched render using requestAnimationFrame.
 * Multiple markDirty() calls between frames are coalesced into one render.
 */
function _scheduleRender() {
  if (_renderScheduled) return;
  _renderScheduled = true;
  _rAFId = requestAnimationFrame(function() {
    _renderScheduled = false;
    _rAFId = null;
    _performDirtyRender();
  });
}

/**
 * Perform incremental render based on dirty flags.
 * Only rebuilds the components that actually changed.
 */
function _performDirtyRender() {
  if (_dirtyFlags === DIRTY_NONE) return;

  // If dialog/review states changed, or many components are dirty, do full render
  if ((_dirtyFlags & DIRTY_DIALOG) || (_dirtyFlags & DIRTY_REVIEW) ||
      (_dirtyFlags & DIRTY_TOOLBAR) || (_dirtyFlags & DIRTY_PANEL) ||
      (_dirtyFlags & DIRTY_MOVES) ||
      // If more than 2 components are dirty, full render is likely faster
      Integer_bitcount(_dirtyFlags) > 2) {
    _dirtyFlags = DIRTY_NONE;
    renderInternal();
    return;
  }

  // Targeted updates only
  if (_dirtyFlags & DIRTY_BOARD) {
    _updateBoardIncremental();
  }
  if (_dirtyFlags & DIRTY_EVAL) {
    _updateEvalDisplayIncremental();
  }

  _dirtyFlags = DIRTY_NONE;
}

/** Count set bits in a number */
function Integer_bitcount(n) {
  let count = 0;
  while (n) { count++; n &= n - 1; }
  return count;
}

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

// Cached board square elements [row][col] — invalidated on full render
let _sqElCache = null;

/**
 * Get or build the cached board square elements array.
 * @returns {Array<Array<HTMLElement>>|null} 2D array: _sqElCache[displayRow][displayCol]
 */
function _getSqElCache() {
  if (_sqElCache) return _sqElCache;
  const grid = _el(_EL_BOARD_GRID);
  if (!grid) return null;
  const sqs = grid.querySelectorAll('.sq');
  if (sqs.length !== 64) return null;
  _sqElCache = [];
  for (let r = 0; r < 8; r++) {
    _sqElCache[r] = [];
    for (let c = 0; c < 8; c++) {
      _sqElCache[r][c] = sqs[r * 8 + c];
    }
  }
  return _sqElCache;
}

// ===================== INCREMENTAL BOARD UPDATE =====================
let _prevBoardState = null; // JSON string of last rendered board state

/**
 * Incrementally update only the board squares that changed.
 * Compares current gameState.board with previously rendered state.
 */
function _updateBoardIncremental() {
  const currentBoardJSON = JSON.stringify(gameState.board);
  if (currentBoardJSON === _prevBoardState) return; // No change

  const sqCache = _getSqElCache();
  if (!sqCache) { markDirty(DIRTY_FULL); return; }

  const flip = playerColor === 'black';
  const cm = showCtrlMap ? cachedCtrlMap : null;
  let _checkKingPos = getCheckKingPos(gameState);

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const rr = flip ? 7 - r : r;
      const cc = flip ? 7 - c : c;
      const el = sqCache[r][c];
      if (!el) continue;
      const p = gameState.board[rr][cc];
      const isL = (r + c) % 2 === 0;
      _updateSingleSq(el, p, rr, cc, cm, isL, lastMove, _checkKingPos);
    }
  }

  _prevBoardState = currentBoardJSON;
  _updateArrows(hoveredSquare || selectedSquare);
}

/**
 * Incrementally update eval display without full render.
 */
function _updateEvalDisplayIncremental() {
  const evalEl = _el(_EL_EVAL_DISP);
  if (!evalEl) { markDirty(DIRTY_FULL); return; }
  const _fe = formatEval();
  const pe = _fe.emoji, pd = _fe.desc, scoreStr = _fe.score;
  const _hdrDepthStr = _sfDepth > 0 ? '<span style="font-size:.65rem;color:var(--muted);margin-left:4px">D' + _sfDepth + '</span>' : '';
  if (setupMode) {
    evalEl.innerHTML = T('setup_label');
  } else if (isAIThinking) {
    evalEl.innerHTML = '<span class="ev-e">⏳</span><span>'+T('analyzing')+'</span>';
  } else {
    evalEl.innerHTML = '<span class="ev-e">' + pe + '</span><span>' + pd + '</span><span style="color:var(--muted)">(' + scoreStr + ')</span>' + _hdrDepthStr;
  }
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
      localStorage.setItem('Regalia_recovery', JSON.stringify(recoveryData));
    } catch(e) {}

    // If this is a render error (indicated by the stack trace), show recovery UI
    if (error && error.stack && error.stack.indexOf('renderInternal') !== -1) {
      const app = document.getElementById('app');
      if (app) {
        app.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#1a0a0a;color:#f5e6c8;padding:20px;text-align:center;font-family:system-ui,sans-serif">' +
          '<div style="font-size:3rem;margin-bottom:16px">♔</div>' +
          '<h2 style="color:#ffd700;margin-bottom:12px">'+T('app_name')+' v1.0.0</h2>' +
          '<p style="color:#a08050;margin-bottom:20px;max-width:300px">'+T('render_error')+'</p>' +
          '<button onclick="location.reload()" style="padding:12px 24px;background:#c49512;color:#1a0a0a;border:none;border-radius:6px;font-size:1rem;font-weight:700;cursor:pointer">'+T('refresh_page')+'</button>' +
          '</div>';
      }
    }

    // Call existing error handler if present
    if (_origOnError) _origOnError.call(this, msg, url, line, col, error);
    return true; // Suppress default error handling
  };
})();

// Auto-recover from localStorage on startup
(function _tryRecovery() {
  try {
    const saved = localStorage.getItem('Regalia_recovery');
    if (saved) {
      const data = JSON.parse(saved);
      if (data && data.gameState && Date.now() - data.timestamp < 3600000) {
        console.log('Recovery data found from', new Date(data.timestamp));
      }
      // Clear recovery data after successful load
      setTimeout(function() {
        if (_engineReady || document.getElementById('board-grid')) {
          localStorage.removeItem('Regalia_recovery');
        }
      }, 5000);
    }
  } catch(e) {}
})();

let audioCtx=null;
function getAudioCtx(){if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();return audioCtx}
window.addEventListener('beforeunload',()=>{if(audioCtx&&audioCtx.state!=='closed'){audioCtx.close();audioCtx=null;}});
function playSound(type){if(!soundOn)return;try{const ctx=getAudioCtx();if(ctx.state==='suspended')ctx.resume().catch(()=>{});const osc=ctx.createOscillator(),gain=ctx.createGain(),now=ctx.currentTime;osc.connect(gain);gain.connect(ctx.destination);switch(type){case'move':osc.type='sine';osc.frequency.setValueAtTime(300,now);osc.frequency.exponentialRampToValueAtTime(500,now+.06);gain.gain.setValueAtTime(.15,now);gain.gain.exponentialRampToValueAtTime(.01,now+.1);osc.start(now);osc.stop(now+.1);break;case'capture':osc.type='square';osc.frequency.setValueAtTime(200,now);osc.frequency.exponentialRampToValueAtTime(100,now+.12);gain.gain.setValueAtTime(.2,now);gain.gain.exponentialRampToValueAtTime(.01,now+.15);osc.start(now);osc.stop(now+.15);break;case'check':osc.type='sawtooth';osc.frequency.setValueAtTime(440,now);osc.frequency.setValueAtTime(554,now+.08);osc.frequency.setValueAtTime(659,now+.16);gain.gain.setValueAtTime(.18,now);gain.gain.exponentialRampToValueAtTime(.01,now+.25);osc.start(now);osc.stop(now+.25);break;case'castle':osc.type='triangle';osc.frequency.setValueAtTime(260,now);osc.frequency.exponentialRampToValueAtTime(520,now+.15);gain.gain.setValueAtTime(.15,now);gain.gain.exponentialRampToValueAtTime(.01,now+.18);osc.start(now);osc.stop(now+.18);break;case'promote':osc.type='sine';osc.frequency.setValueAtTime(523,now);osc.frequency.setValueAtTime(659,now+.08);osc.frequency.setValueAtTime(784,now+.16);osc.frequency.setValueAtTime(1047,now+.24);gain.gain.setValueAtTime(.15,now);gain.gain.exponentialRampToValueAtTime(.01,now+.3);osc.start(now);osc.stop(now+.3);break;case'gameover':osc.type='sine';osc.frequency.setValueAtTime(523,now);osc.frequency.setValueAtTime(440,now+.15);osc.frequency.setValueAtTime(349,now+.3);osc.frequency.setValueAtTime(262,now+.5);gain.gain.setValueAtTime(.2,now);gain.gain.exponentialRampToValueAtTime(.01,now+.7);osc.start(now);osc.stop(now+.7);break;case'hint':osc.type='sine';osc.frequency.setValueAtTime(600,now);osc.frequency.exponentialRampToValueAtTime(900,now+.1);gain.gain.setValueAtTime(.12,now);gain.gain.exponentialRampToValueAtTime(.01,now+.12);osc.start(now);osc.stop(now+.12);break;}}catch(e){}}


// ECO UI helper functions — already defined in game-logic.js with correct const declarations.

// ===================== KNOWLEDGE =====================
// P2 PERF: ECO_OPENINGS is lazily parsed on first access to avoid blocking main thread
// during initial page load. The JSON string (~125KB) is parsed only when first needed.
// ===================== EVAL TREND CHART =====================
/**
 * Build an SVG evaluation trend chart for review mode.
 * @param {number} width - Chart width in pixels
 * @param {number} height - Chart height in pixels
 * @returns {string} SVG string for the eval trend chart
 */
function _buildEvalTrendSVG(width, height) {
  if (!reviewStates || reviewStates.length < 2) return '';

  // Equal left/right padding so chart endpoints are equidistant
  // from borders. The chart should fully utilize the available width.
  const padding = {top: 12, right: 36, bottom: 4, left: 36};
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const midY = padding.top + chartH / 2;

  // Map eval to y coordinate: +10 → top, -10 → bottom, 0 → middle
  const maxEval = 10;
  function evalToY(ev) {
    const clamped = Math.max(-maxEval, Math.min(maxEval, ev / 100));
    return midY - (clamped / maxEval) * (chartH / 2);
  }

  // Local mode — show a window of steps around the current review step,
  // with the current step as the rightmost data point. This aligns with the progress
  // bar and shows checkmate distance numbers. Global mode shows all steps uniformly.
  let localStepMin = 0, localStepMax = reviewStates.length - 1;
  let displayStepCount = reviewStates.length;
  if (!_reviewEvalGlobal) {
    // Local mode: show ~15 steps centered on the current step, with current step
    // at the right edge so the user can see what led up to this position.
    const windowSize = Math.min(15, reviewStates.length);
    localStepMax = reviewStep;
    localStepMin = Math.max(0, localStepMax - windowSize + 1);
    displayStepCount = localStepMax - localStepMin + 1;
  }
  function stepToX(step) {
    if (_reviewEvalGlobal) {
      // Guard against division by zero when reviewStates has only 1 entry
      if (reviewStates.length <= 1) return padding.left + chartW / 2;
      return padding.left + (step / (reviewStates.length - 1)) * chartW;
    } else {
      // Local mode: uniform spacing for steps in the window
      const idx = step - localStepMin;
      const count = Math.max(1, displayStepCount);
      if (count <= 1) return padding.left + chartW; // Single point: place at right edge
      return padding.left + (idx / (count - 1)) * chartW;
    }
  }

  // Collect eval data points (only within the visible window)
  const points = [];
  for (let i = localStepMin; i <= localStepMax; i++) {
    const ev = _reviewEvalCache.get(i);
    if (ev != null) {
      points.push({step: i, eval: ev.eval || 0, mate: ev.mate, mateDistance: ev.mateDistance});
    }
  }

  if (points.length < 1) return '';

  // FIX: Use preserveAspectRatio="xMidYMid meet" instead of "none" — "none" causes
  // severe distortion in landscape where the container aspect ratio differs greatly
  // from the viewBox. "xMidYMid meet" scales the chart uniformly to fit the container,
  // maintaining proper line shapes and readable labels.
  let svg = '<svg width="100%" height="100%" viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="xMidYMid meet" style="display:block">';

  // 0-axis line (gray)
  svg += '<line x1="' + padding.left + '" y1="' + midY + '" x2="' + (width - padding.right) + '" y2="' + midY + '" stroke="#666" stroke-width="0.5" stroke-dasharray="2,2"/>';

  // In global mode: draw vertical grid lines at each step for alignment with progress bar
  if (_reviewEvalGlobal && reviewStates.length > 2) {
    for (let i = 0; i < reviewStates.length; i++) {
      const x = stepToX(i);
      svg += '<line x1="' + x.toFixed(1) + '" y1="' + padding.top + '" x2="' + x.toFixed(1) + '" y2="' + (height - padding.bottom) + '" stroke="#333" stroke-width="0.3"/>';
    }
  }

  // Build line segments with color based on eval sign
  for (let i = 1; i < points.length; i++) {
    const p0 = points[i-1];
    const p1 = points[i];
    const x0 = stepToX(p0.step);
    const y0 = evalToY(p0.eval);
    const x1 = stepToX(p1.step);
    const y1 = evalToY(p1.eval);

    // Determine color based on eval sign
    const avgEval = (p0.eval + p1.eval) / 2;
    let strokeColor;
    if (p0.eval * p1.eval < 0) {
      strokeColor = '#888';
    } else if (avgEval > 0) {
      strokeColor = '#E8E8F0';
    } else if (avgEval < 0) {
      strokeColor = '#4A4A6E';
    } else {
      strokeColor = '#666';
    }

    svg += '<line x1="' + x0.toFixed(1) + '" y1="' + y0.toFixed(1) + '" x2="' + x1.toFixed(1) + '" y2="' + y1.toFixed(1) + '" stroke="' + strokeColor + '" stroke-width="1.5" stroke-linecap="round"/>';

    // In global mode: fill the gap between consecutive points with a lighter line
    // to show the uniform spacing
    if (_reviewEvalGlobal && p1.step - p0.step > 1) {
      for (let s = p0.step + 1; s < p1.step; s++) {
        const t = (s - p0.step) / (p1.step - p0.step);
        const interpEval = p0.eval + (p1.eval - p0.eval) * t;
        const sx = stepToX(s);
        const sy = evalToY(interpEval);
        svg += '<circle cx="' + sx.toFixed(1) + '" cy="' + sy.toFixed(1) + '" r="1" fill="' + (interpEval > 0 ? '#E8E8F044' : '#4A4A6E44') + '"/>';
      }
    }
  }

  // Draw data points
  for (const p of points) {
    const x = stepToX(p.step);
    const y = evalToY(p.eval);
    let fillColor, strokeColor;
    if (p.eval > 0) {
      fillColor = '#E8E8F0';
      strokeColor = 'rgba(30,15,0,0.85)';
    } else if (p.eval < 0) {
      fillColor = '#1A1A2E';
      strokeColor = 'rgba(255,230,150,0.85)';
    } else {
      fillColor = '#888';
      strokeColor = '#666';
    }
    svg += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="2.5" fill="' + fillColor + '" stroke="' + strokeColor + '" stroke-width="0.5"/>';
  }

  // Checkmate distance labels — show in local mode (user request)
  // Also show eval score labels for all points when not in global mode
  // Prevent label overlap by tracking last label position
  // Current-step circle overlap avoidance,
  //   clamp label Y to SVG bounds, use #+N/#-N format for mate distances.
  // Two-pass label rendering to prevent overlap when switching
  //   from global mode to local mode. First pass: collect all candidate labels
  //   with priority (current step > mate > eval). Second pass: render only
  //   labels that don't overlap, also tracking Y proximity.
  if (!_reviewEvalGlobal) {
    // Pass 1: Collect all candidate labels with priority
    const _labelCandidates = [];
    for (const p of points) {
      const x = stepToX(p.step);
      const y = evalToY(p.eval);
      const ev = _reviewEvalCache.get(p.step);
      const _isCurrentStep = (p.step === reviewStep);
      if (!ev) continue;

      let label = '', textColor = '#666', fontSize = 6.5, fontWeight = '';
      let labelY;

      if (Math.abs(ev.eval) >= 90000) {
        const md = ev.mate != null ? ev.mate : (ev.mateDistance != null ? ev.mateDistance : 0);
        if (md !== 0 || Math.abs(ev.eval) >= 99999) {
          label = md > 0 ? '#+' + Math.abs(md) : md < 0 ? '#-' + Math.abs(md) : (ev.eval > 0 ? '#+' : '#-');
          textColor = '#ffd700';
          fontSize = 7;
          fontWeight = ' font-weight="bold"';
          const _extraY = _isCurrentStep ? 4 : 0;
          labelY = (p.eval > 0) ? Math.min(y + 12 + _extraY, height - 2) : Math.max(y - 4 - _extraY, 9);
        }
      } else {
        const cpVal = ev.eval || 0;
        const displayEval = (cpVal / 100).toFixed(cpVal % 100 === 0 ? 0 : 1);
        const sign = cpVal > 0 ? '+' : '';
        label = sign + displayEval;
        textColor = p.eval > 0 ? '#E8E8F0' : (p.eval < 0 ? '#8888aa' : '#666');
        const _extraY = _isCurrentStep ? 3 : 0;
        labelY = (p.eval > 0) ? Math.min(y + 11 + _extraY, height - 2) : Math.max(y - 3 - _extraY, 9);
      }

      if (label) {
        _labelCandidates.push({
          x, y: labelY,
          label, textColor, fontSize, fontWeight,
          priority: _isCurrentStep ? 3 : (Math.abs(ev.eval) >= 90000 ? 2 : 1),
          step: p.step
        });
      }
    }

    // Pass 2: Render labels with overlap prevention (both X and Y proximity)
    // Sort by priority descending — higher priority labels are placed first
    _labelCandidates.sort((a, b) => b.priority - a.priority);
    const _placedLabels = [];
    const _minLabelGapX = 36; // Minimum horizontal gap between labels
    const _minLabelGapY = 10; // Minimum vertical gap between overlapping X labels

    for (const cand of _labelCandidates) {
      let overlaps = false;
      for (const placed of _placedLabels) {
        const dx = Math.abs(cand.x - placed.x);
        const dy = Math.abs(cand.y - placed.y);
        if (dx < _minLabelGapX && dy < _minLabelGapY) {
          overlaps = true;
          break;
        }
      }
      if (!overlaps) {
        _placedLabels.push(cand);
      }
    }

    // Render placed labels (sort back by step for logical ordering)
    _placedLabels.sort((a, b) => a.step - b.step);
    for (const lbl of _placedLabels) {
      svg += '<text x="' + lbl.x.toFixed(1) + '" y="' + lbl.y.toFixed(1) + '" fill="' + lbl.textColor + '" font-size="' + lbl.fontSize + '"' + lbl.fontWeight + ' font-family="sans-serif" text-anchor="middle" paint-order="stroke" stroke="#1a0a0a" stroke-width="2">' + lbl.label + '</text>';
    }
  }

  // Current position marker (highlighted)
  if (reviewStep >= 0 && reviewStep < reviewStates.length) {
    const curEv = _reviewEvalCache.get(reviewStep);
    if (curEv != null) {
      const cx = stepToX(reviewStep);
      const cy = evalToY(curEv.eval);
      svg += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="4" fill="none" stroke="#ffd700" stroke-width="1.5"/>';
    }
  }

  // Last endpoint checkmate distance display — only in global mode
  // (In local mode, the main loop above already renders labels for all visible points,
  //  so showing another label here would cause overlap/duplication on the last point.)
  if (_reviewEvalGlobal && points.length > 0) {
    const lastP = points[points.length - 1];
    const lastEv = _reviewEvalCache.get(lastP.step);
    if (lastEv && Math.abs(lastEv.eval) >= 90000) {
      const lastMd = lastEv.mate != null ? lastEv.mate : (lastEv.mateDistance != null ? lastEv.mateDistance : 0);
      if (lastMd !== 0 || Math.abs(lastEv.eval) >= 99999) {
        const lx = stepToX(lastP.step);
        const ly = evalToY(lastP.eval);
        const cmLabel = lastMd > 0 ? '#+' + Math.abs(lastMd) : lastMd < 0 ? '#-' + Math.abs(lastMd) : (lastEv.eval > 0 ? '#+' : '#-');
        const cmLabelY = (lastP.eval > 0) ? Math.min(ly + 12, height - 2) : Math.max(ly - 4, 9);
        svg += '<text x="' + lx.toFixed(1) + '" y="' + cmLabelY.toFixed(1) + '" fill="#ffd700" font-size="7" font-weight="bold" font-family="sans-serif" text-anchor="middle" paint-order="stroke" stroke="#1a0a0a" stroke-width="2">' + cmLabel + '</text>';
      }
    }
  }

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
    if(_gameOverStatusKey==='checkmate'||gameOver.includes('将杀')||gameOver.toLowerCase().includes('checkmate')){
      const whiteWins=gameOver.includes(T('white_wins'))||gameOver.includes('White wins');
      const playerWins=(playerColor==='white')===whiteWins;
      // Checkmate already on the board — show mate distance if available
      const md=Math.abs(_sfMateDistance||0);
      const mateStr=md>0?(whiteWins?'#+'+md:'#-'+md):(whiteWins?'#+':'#-');
      return{emoji:playerWins?'🏆':'💀',desc:playerWins?T('winning'):T('losing'),score:mateStr};
    }
    return{emoji:'🤝',desc:T('draw_game'),score:'0.0'};
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
return null;
}
// Helper: apply game-over string and ensure checkmate notation (accepts cached status to avoid redundant gameStatus() call)
function _applyGameOver(cachedSt){
  const st=cachedSt||gameStatus(gameState);
  const goStr=_gameOverStrFromStatus(st);
  if(goStr){gameOver=goStr;_gameOverStatusKey=st;if((st==='checkmate'||goStr.includes('将杀')||goStr.includes('Checkmate'))&&moveRecords.length>0){const last=moveRecords[moveRecords.length-1];if(last.notation&&!last.notation.endsWith('#')){last.notation=last.notation.replace(/\+$/,'')+'#';}_sfMateDistance=0;_sfDepth=0;_sfEval=gameState.currentTurn==='black'?99999:-99999;_sfEvalReady=true;}}
}

// ===================== GAME STATE =====================
// Core game state
let gameState=initState(),stateHistory=[],playerColor='white',selectedSquare=null,
    legalMvs=[],legalSet=new Set(),moveRecords=[],gameOver=null,_gameOverStatusKey=null,lastMove=null,
    pendingPromotion=null,isAIThinking=false,showNewGameDialog=false,
    showCtrlMap=false,aiLevel=4;
// Setup mode state
let setupMode=false,setupPiece=null,setupColor='white',setupErrors=[],
    setupHistory=[],setupRedoStack=[];
// Hint & UI state
let hintText='',isHintLoading=false,hoveredSquare=null,aiThinkInfo='',
    gameOverSoundPlayed=false;
let soundOn=true;
// Review & cache state
let reviewBaseState=null,_cachedStatus=null,_cachedStatusKey='';
// Control map cache
let cachedCtrlMap=null,cachedCtrlKey='',renderPending=false,
    lastRenderTime=0,lastRenderRequest=0,renderTimerId=null;
let _heartbeatIntervalId=null; // Interval ID for engine heartbeat monitor
let _heartbeatRunning=false; // Flag for engine heartbeat monitor state
// Dialog state
let _turnStartTime=Date.now(),dlgPlayerColor='white',dlgOpeningId=null,
    dlgBookMoves=false;
let reviewMode=false,reviewStep=0,reviewStates=[],reviewCritical=[];
let _reviewAnalyzeAllActive=false; // Flag for reviewAnalyzeAll batch analysis
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
 * Compute captured pieces for a given color by comparing the current board
 * against the standard starting position piece counts.
 * Returns an array of piece type strings in order: queen, rook, bishop, knight, pawn.
 * Each type appears once for each captured piece of that type.
 */
function getCapturedPieces(board, color) {
  // Starting piece counts per color
  const startCounts = { queen:1, rook:2, bishop:2, knight:2, pawn:8 };
  // Count pieces currently on the board for this color
  const currentCounts = { queen:0, rook:0, bishop:0, knight:0, pawn:0 };
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.color === color && p.type !== 'king' && currentCounts[p.type] !== undefined) {
        currentCounts[p.type]++;
      }
    }
  }
  // Build captured list (order: queen, rook, bishop, knight, pawn)
  const order = ['queen','rook','bishop','knight','pawn'];
  const result = [];
  for (const t of order) {
    const diff = (startCounts[t] || 0) - (currentCounts[t] || 0);
    for (let i = 0; i < diff; i++) result.push(t);
  }
  return result;
}

/**
 * Render captured pieces HTML for a player bar.
 * Uses the same color/stroke/glow style as the ♔/♚ icon in the bar header.
 * Pieces are rendered at the same font-size as .pico (1.4rem desktop).
 * Left-aligned on first row; other bar info wraps below.
 */
function capturedPiecesHtml(board, pieceColor, playerColor) {
  const captured = getCapturedPieces(board, pieceColor);
  if (!captured.length) return '';
  // Style: same color scheme as the king icon in the bar
  const isW = pieceColor === 'white';
  const symStyle = isW
    ? 'color:#E8E8F0;-webkit-text-stroke:.3px rgba(30,15,0,.85);text-shadow:0 0 .8px rgba(30,15,0,.55)'
    : 'color:#1A1A2E;-webkit-text-stroke:.3px rgba(255,230,150,.85);text-shadow:0 0 .8px rgba(255,230,150,.55)';
  let html = '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:1px;padding-top:2px;line-height:1">';
  for (const t of captured) {
    html += '<span style="font-size:1.1rem;font-family:\'DejaVu Sans\',\'Noto Sans\',\'Segoe UI Symbol\',sans-serif;font-variant-emoji:text;' + symStyle + '">' + SYM[pieceColor][t] + '</span>';
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
function render(){if(renderPending){lastRenderRequest=Date.now();return}if(animationInProgress||_landingAnimActive){if(!renderPending){renderPending=true;setTimeout(()=>{renderPending=false;lastRenderTime=Date.now();render();},200);}return;}const now=Date.now();if(now-lastRenderTime<20){renderPending=true;renderTimerId=requestAnimationFrame(()=>{renderPending=false;renderTimerId=null;lastRenderTime=Date.now();lastRenderRequest=0;renderInternal()});return}lastRenderTime=now;renderInternal()}
/**
 * Internal render function — builds the entire UI HTML string and sets innerHTML.
 * @side-effect Rebuilds entire app DOM, invalidates element cache
 */
function renderInternal(){try{
// Defensive check — if gameState is undefined/corrupt, reset to initial state
if(!gameState||!gameState.board){console.error('renderInternal: gameState is invalid, resetting');gameState=initState();stateHistory=[];_redoStack=[];}
if(setupMode){gameOver=null;_gameOverStatusKey=null;}
// Re-localize gameOver text on every render
if(gameOver&&_gameOverStatusKey){const _reLocStr=_gameOverStrFromStatus(_gameOverStatusKey);if(_reLocStr)gameOver=_reLocStr;}
const app=document.getElementById('app');if(!app)return;
// Score from White's perspective (UCI side-to-move → White conversion done in onEngineEval); emoji/desc reflect player's advantage
const _fe=formatEval();const pe=_fe.emoji,pd=_fe.desc,scoreStr=_fe.score;const _hdrDepthStr=_sfDepth>0?'<span style="font-size:.65rem;color:var(--muted);margin-left:4px">D'+_sfDepth+'</span>':'';let _hdrProgressStr='';if(_evalLoading&&_sfDepth>0){let _hpp=[];if(_lastProgressNodes!=null){const _ns=_lastProgressNodes>=1000000?(_lastProgressNodes/1000000).toFixed(1)+'M':_lastProgressNodes>=1000?Math.round(_lastProgressNodes/1000)+'K':String(_lastProgressNodes);_hpp.push(_ns);}if(_lastProgressNps!=null){const _ns=_lastProgressNps>=1000000?(_lastProgressNps/1000000).toFixed(1)+'M/s':_lastProgressNps>=1000?Math.round(_lastProgressNps/1000)+'K/s':String(_lastProgressNps);_hpp.push(_ns);}if(_hpp.length)_hdrProgressStr='<span style="font-size:.6rem;color:var(--muted);margin-left:3px">'+_hpp.join(' ')+'</span>';}

if(!gameOver&&!setupMode&&!isAIThinking&&!reviewMode){const _gsKey=gameState.hash+'|'+gameState.currentTurn;if(_cachedStatusKey!==_gsKey){_cachedStatus=gameStatus(gameState);_cachedStatusKey=_gsKey;}_applyGameOver(_cachedStatus);}
const ctrlKey=showCtrlMap?gameState.hash:'off';if(ctrlKey!==cachedCtrlKey){cachedCtrlMap=showCtrlMap?getCtrlMap(gameState.board):null;cachedCtrlKey=ctrlKey}const cm=cachedCtrlMap;
const infoSq=hoveredSquare||selectedSquare;let infoCtrl=null;
if(infoSq&&cm){const e=cm[infoSq.row][infoSq.col];if(e)infoCtrl={white:e.white,black:e.black}}
const oppC=OPP_COLOR[playerColor];
const flip=playerColor==='black';
// Arrows computed separately by _updateArrows() — no inline computation needed

let h='<div class="hdr" role="banner"><div class="hdr-top"><div class="hdr-l"><span style="font-size:1.3rem;color:#E8E8F0;-webkit-text-stroke:.3px rgba(30,15,0,.85);text-shadow:0 0 .8px rgba(30,15,0,.55);font-family:&#x27;DejaVu Sans&#x27;,&#x27;Noto Sans&#x27;,&#x27;Segoe UI Symbol&#x27;,sans-serif;font-variant-emoji:text;border:3px solid transparent;border-image:linear-gradient(145deg,#8b6914,#d4a017,#ffd700,#fff8dc,#ffd700,#d4a017,#8b6914) 1;padding:3px 6px;background:linear-gradient(145deg,rgba(139,105,20,.18),rgba(255,215,0,.08),rgba(139,105,20,.18));box-shadow:0 0 6px rgba(212,160,23,.35),0 0 12px rgba(255,215,0,.12),inset 0 0 3px rgba(255,215,0,.1),inset 0 1px 0 rgba(255,248,220,.15);position:relative">♔&#xFE0E;</span><h1>'+T('app_name')+'<span class="ver">v1.0.0</span><button onclick="showAboutPage=true;render()" style="font-size:.6rem;color:var(--accent);background:rgba(212,160,23,.15);padding:2px 8px;border-radius:4px;border:1px solid rgba(212,160,23,.3);margin-left:4px;cursor:pointer;font-family:system-ui,-apple-system,sans-serif;letter-spacing:1px">ℹ️</button></h1></div><button onclick="toggleLang()" style="font-size:.65rem;color:var(--accent);background:rgba(212,160,23,.15);padding:2px 6px;border-radius:4px;border:1px solid rgba(212,160,23,.3);cursor:pointer;font-family:system-ui,-apple-system,sans-serif;letter-spacing:1px;flex-shrink:0">'+(_lang==='zh'?'↔️中':'↔️EN')+'</button><div class="ev" id="eval-disp" role="status" aria-label="'+T('evaluating')+'">'+(setupMode?T('setup_label'):(isAIThinking?'<span class="ev-e">⏳</span><span>'+T('analyzing')+'</span>':'<span class="ev-e">'+pe+'</span><span>'+pd+'</span><span style="color:var(--muted)">('+scoreStr+')</span>'+_hdrDepthStr+_hdrProgressStr))+'</div></div><div class="hdr-tools" role="toolbar" aria-label="'+T('ctrl_range')+'">'+(setupMode?'':'<div class="diff-sel" role="radiogroup" aria-label="AI">'+getAI_LEVELS().map(l=>'<button class="diff-b'+(getEffectiveAILevel()===l.id?' act':'')+'" onclick="if(!isAIThinking){'+(l.id===8?'openEngineConfig()':('aiLevel='+l.id+';try{AndroidBridge.syncGameDifficulty('+l.id+')}catch(e){}render()'))+'}" title="'+l.desc+'" role="radio" aria-checked="'+(getEffectiveAILevel()===l.id)+'">'+(l.id===8?'⚙️':l.id===7?'SL':l.id)+'</button>').join('')+'</div>')+'<button type="button" class="btn" onclick="showNewGameDialog=true;dlgPlayerColor=playerColor;dlgOpeningId=null;ecoShowCount=30;dlgBookMoves=useBookMoves;render()" aria-label="'+T('new_game')+'"><span style="font-size:1.4rem">⚔️</span> '+T('new_game')+'</button>'+'<button class="btn" onclick="quickFreeOpening()" aria-label="'+T('free_opening')+'">'+(playerColor==='white'?'<span style=\"font-size:1.4rem;font-weight:400;color:#E8E8F0;-webkit-text-stroke:.3px rgba(30,15,0,.85);text-shadow:0 0 .8px rgba(30,15,0,.55);font-family:&#x27;DejaVu Sans&#x27;,&#x27;Noto Sans&#x27;,&#x27;Segoe UI Symbol&#x27;,sans-serif;font-variant-emoji:text\">♔&#xFE0E;</span>':'<span style=\"font-size:1.4rem;font-weight:400;color:#1A1A2E;-webkit-text-stroke:.3px rgba(255,230,150,.85);text-shadow:0 0 .8px rgba(255,230,150,.55);font-family:&#x27;DejaVu Sans&#x27;,&#x27;Noto Sans Symbol&#x27;,sans-serif;font-variant-emoji:text\">♚&#xFE0E;</span>')+' '+T('free_opening')+'</button>'+(setupMode?'':'<button class="btn" onclick="undoMove()" aria-label="'+T('undo')+'"><span style="font-size:1.4rem">↩️</span> '+T('undo')+'</button><button class="btn" onclick="redoMove()" aria-label="'+T('redo')+'" id="redoBtn"><span style="font-size:1.4rem">↪️</span> '+T('redo')+'</button>')+'<button class="btn" onclick="flipBoard()" aria-label="'+T('flip')+'"><span style="font-size:1.4rem">🔃</span> '+T('flip')+'</button>'+'<button class="btn" onclick="getHint()" aria-label="'+T('ai_hint')+'"><span style="font-size:1.4rem">💡</span> '+T('ai_hint')+'</button>'+(setupMode?'':'<button class="btn" onclick="toggleSound()" id="btnSound" aria-label="'+T('sound')+'">'+(soundOn?'<span style="font-size:1.4rem">🔊</span> '+T('sound'):'<span style="font-size:1.4rem">🔇</span> '+T('sound'))+'</button>')+'<button class="btn" onclick="showCtrlMap=!showCtrlMap;cachedCtrlKey=&quot;&quot;;render()" aria-label="'+T('ctrl_range')+'" title="'+T('ctrl_range')+'">'+(showCtrlMap?'<span style="font-size:1.4rem">🌈</span> '+T('ctrl_range'):'<span style="font-size:1.4rem">🌗</span> '+T('ctrl_range'))+'</button>'+'<button class="btn" onclick="copyFEN()" title="'+T('copy_fen')+'" aria-label="'+T('copy_fen')+'"><span style="font-size:1.4rem">📝</span> FEN</button><button class="btn" onclick="showImportDialog=true;render()" title="'+T('import_fen')+'" aria-label="'+T('import_fen')+'"><span style="font-size:1.4rem">🗃️</span> '+T('import_label')+'</button><button class="btn" onclick="'+(setupMode?'exitSetup()':'toggleSetup()')+'" aria-label="'+(setupMode?T('setup_done'):T('setup_mode'))+'">'+(setupMode?'<span style="font-size:1.4rem">✓</span> '+T('setup_done'):'<span style="font-size:1.4rem">🏗️</span> '+T('setup_mode'))+'</button></div></div>';
h+=`<div class="main" role="main"><div class="bsec">`;
{const _aiCapHtml=capturedPiecesHtml(gameState.board,oppC,playerColor);h+=`<div class="pbar" id="ai-bar" role="status" aria-label="AI" style="flex-wrap:wrap"><span class="pico">${playerColor==='white'?'<span style="color:#1A1A2E;-webkit-text-stroke:.3px rgba(255,230,150,.85);text-shadow:0 0 .8px rgba(255,230,150,.55)">♚&#xFE0E;</span>':'<span style="color:#E8E8F0;-webkit-text-stroke:.3px rgba(30,15,0,.85);text-shadow:0 0 .8px rgba(30,15,0,.55)">♔&#xFE0E;</span>'}</span><div style="flex:1;min-width:0;display:flex;flex-direction:column"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><div class="pname">${T('ai_opponent')}</div><div class="pbar-sub">${getEffectiveAILevel()===8?T('manual_config'):getEffectiveAILevel()===7?'SL':('Lv.'+getEffectiveAILevel())}</div>${gameState.currentTurn!==playerColor&&!gameOver&&!isAIThinking?'<span class="tind">'+T('waiting')+'</span>':''}${isAIThinking?'<span class="tind">'+(_aiBarInfo||T('thinking'))+'</span>':''}</div>${_aiCapHtml}<div id="ai-ponder-info" style="display:flex;justify-content:flex-end;text-align:right;font-size:.65rem;color:var(--muted);font-family:monospace,system-ui,-apple-system,sans-serif;letter-spacing:.5px;padding-top:2px;line-height:1.3;min-height:1.3em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;flex:0 0 auto">${(!isAIThinking&&!isHintLoading&&!hintText&&_ponderMoveSAN&&_ponderBarInfo&&!gameOver&&!setupMode&&!reviewMode)?('🔮 '+_esc(_ponderMoveSAN)+' '+_esc(_ponderBarInfo)):''}</div></div></div>`;}
h+=`<div class="flbl" style="margin-left:28px">${(flip?'hgfedcba':'abcdefgh').split('').map(f=>`<span style="width:${CELL}px">${f}</span>`).join('')}</div>`;
h+=`<div style="display:flex"><div class="rlbl">${(flip?'12345678':'87654321').split('').map(r=>`<span style="height:${CELL}px">${r}</span>`).join('')}</div>`;
h+=`<div class="bwrap"><div class="bgrid" id="board-grid" role="grid" aria-label="${T('board')}" style="grid-template-columns:repeat(8,${CELL}px);grid-template-rows:repeat(8,${CELL}px)">`;
// Determine check state for king highlighting
let _checkKingPos=getCheckKingPos(gameState);
for(let r=0;r<8;r++){for(let c=0;c<8;c++){
const rr=flip?7-r:r;const cc=flip?7-c:c;
const p=gameState.board[rr][cc];const isL=(r+c)%2===0;
let bg=_getSqBg(rr,cc,cm,isL,lastMove);if(selectedSquare&&rr===selectedSquare.row&&cc===selectedSquare.col)bg=SQ_SEL;
const lastFrom=lastMove&&rr===lastMove.from.row&&cc===lastMove.from.col;
const lastTo=lastMove&&lastMove.to.row===rr&&lastMove.to.col===cc;
const isLegal=legalSet.has(rr*8+cc);
const isCheckSq=_checkKingPos&&rr===_checkKingPos.row&&cc===_checkKingPos.col;
const lbl=String.fromCharCode(97+cc)+(8-rr);
h+=`<div class="sq${lastFrom?' last-from':''}${lastTo?' last-to':''}${isCheckSq?' in-check':''}" role="gridcell" style="background:${bg}" data-r="${rr}" data-c="${cc}" onclick="sqClick(${rr},${cc})">`;
h+=`<span class="lbl" style="color:${isL?LBL_LIGHT:LBL_DARK};-webkit-text-stroke:.6px ${isL?LBL_STROKE_LIGHT:LBL_STROKE_DARK};paint-order:stroke fill;text-shadow:0 0 2px ${isL?LBL_STROKE_LIGHT:LBL_STROKE_DARK}">${lbl}</span>`;
if(p){
const animCls=(_lastAnimPieceType&&_lastAnimTarget&&lastTo&&rr===_lastAnimTarget.row&&cc===_lastAnimTarget.col&&p.type===_lastAnimPieceType)?' anim-'+p.type:'';
h+=`<span class="pc ${p.color==='white'?'w':'bk'}${animCls}">${SYM[p.color][p.type]}</span>`;
if(animCls){_landingAnimActive=true;_startLandingTimer(_lastAnimPieceType);}}
if(isLegal&&!p)h+=`<div class="dot"></div>`;
if(isLegal&&p)h+=`<div class="ring"></div>`;
h+=`</div>`}}
h+=`</div>`;
// Arrows are now handled by persistent SVG overlay via _updateArrows() — no inline SVG here
if(gameOver&&lastMove&&!gameOverSoundPlayed){gameOverSoundPlayed=true;playSound('gameover');HapticManager.fire('GAME_OVER');}
if(gameOver&&!setupMode){h+=`<div class="gover" role="alert" aria-live="assertive"><div class="ge">${_gameOverStatusKey==='checkmate'?(gameState.currentTurn==='black'?'♔\uFE0E':'♚\uFE0E'):'🤝'}</div><div class="gt">${gameOver}</div><button type="button" class="btn btn-p" onclick="showNewGameDialog=true;dlgPlayerColor=playerColor;dlgOpeningId=null;ecoShowCount=30;dlgBookMoves=useBookMoves;render()">${T('play_again')}</button><button type="button" class="btn btn-g" onclick="enterReview()">📑 ${T('review')}</button></div>`;}
if(setupMode){
const spPieces=[{t:'pawn',w:'♙\uFE0E',b:'♟\uFE0E'},{t:'knight',w:'♘\uFE0E',b:'♞\uFE0E'},{t:'bishop',w:'♗\uFE0E',b:'♝\uFE0E'},{t:'rook',w:'♖\uFE0E',b:'♜\uFE0E'},{t:'queen',w:'♕\uFE0E',b:'♛\uFE0E'},{t:'king',w:'♔\uFE0E',b:'♚\uFE0E'}];
h+=`<div class="setup-panel" style="width:${8*CELL+8}px;max-width:100%;box-sizing:border-box"><div class="setup-row" style="justify-content:flex-start"><span class="setup-label">${T('piece')}</span>`;
for(const p of spPieces)h+=`<button class="setup-btn${setupPiece===p.t?' act':''} ${setupColor==='white'?'sw':'sb'}" onclick="setupPiece='${p.t}';render()">${setupColor==='white'?p.w:p.b}</button>`;
h+=`<button class="setup-del${setupPiece==='delete'?' act':''}" onclick="setupPiece='delete';render()">🗑️</button></div>`;
h+=`<div class="setup-row"><span class="setup-label">${T('color')}</span><button class="setup-clr${setupColor==='white'?' act':''}" onclick="setupColor='white';render()">${T('white_side')}</button><button class="setup-clr${setupColor==='black'?' act':''}" onclick="setupColor='black';render()">${T('black_side')}</button></div>`;
h+=`<div class="setup-row"><span class="setup-label">${T('turn_side')}</span><button class="setup-clr${gameState.currentTurn==='white'?' act':''}" onclick="gameState.currentTurn='white';_refreshStateAfterSetup(gameState);render()">${T('white_side')}</button><button class="setup-clr${gameState.currentTurn==='black'?' act':''}" onclick="gameState.currentTurn='black';_refreshStateAfterSetup(gameState);render()">${T('black_side')}</button></div>`;
h+=`<div class="setup-row" style="justify-content:center;gap:12px"><button class="btn" onclick="undoSetupClick()"${setupHistory.length===0?' disabled style="opacity:0.4"':''}><span style="font-size:1.4rem">↩️</span> ${T('undo_setup')}</button><button class="btn" onclick="redoSetupClick()"${setupRedoStack.length===0?' disabled style="opacity:0.4"':''}><span style="font-size:1.4rem">↪️</span> ${T('redo_setup')}</button><button class="btn" onclick="gameState=initState();gameState.moveHistory=[];setupErrors=[];setupHistory=[];render()"><span style="font-size:1.4rem">♻️</span> ${T('reset_board')}</button><button class="btn" onclick="for(let r=0;r<8;r++)for(let c=0;c<8;c++)gameState.board[r][c]=null;gameState.wk=null;gameState.bk=null;gameState.enPassantTarget=null;gameState.halfMoveClock=0;_refreshStateAfterSetup(gameState);setupErrors=[];setupHistory=[];render()"><span style="font-size:1.4rem">🧹</span> ${T('clear_board')}</button></div><div class="setup-row" style="justify-content:center;gap:8px;margin-top:6px"><button class="btn" onclick="copyFEN()"><span style="font-size:1.4rem">📝</span> ${T('copy_fen_btn')}</button><button class="btn" onclick="importFEN()"><span style="font-size:1.4rem">📋</span> ${T('import_fen_btn')}</button></div></div>`;
if(setupErrors.length>0)h+=`<div class="setup-errors"><strong>${T('setup_error_title')}</strong><ul>${setupErrors.map(e=>`<li>${_esc(e)}</li>`).join('')}</ul><button class="btn" onclick="setupErrors=[];render()" style="margin-top:4px">${T('understood')}</button></div>`;
}
h+=`</div></div>`;
// Tablebase status bar (player turn only, ≤7 pieces, manual query)
if(!gameOver&&!reviewMode&&pieceCountLE7(gameState.board)){
const _tbFen=generateFEN(gameState);
let _tbBarHtml='';
const _cachedTb=_tbCache.get(_tbFen);
if(_tbLoading){_tbBarHtml='<span style="color:var(--accent)">'+T('tb_querying')+'</span>';}
else if(_cachedTb){
// API returns moves[] already sorted best-first; use moves[0] directly
const _cat=_cachedTb.category||'';
const _catMap={'win':T('tb_cat_win'),'syzygy-win':T('tb_cat_syzygy_win'),'maybe-win':T('tb_cat_maybe_win'),'cursed-win':T('tb_cat_cursed_win'),'draw':T('tb_cat_draw'),'blessed-loss':T('tb_cat_blessed_loss'),'maybe-loss':T('tb_cat_maybe_loss'),'syzygy-loss':T('tb_cat_syzygy_loss'),'loss':T('tb_cat_loss')};
const _catLabel=_catMap[_cat]||_cat;
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
_tbBarHtml=`<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span style="color:${(_cat==='win'||_cat==='syzygy-win')?'#27ae60':_cat==='draw'?'var(--accent)':'#c0392b'};font-weight:700">${_catLabel}</span><span style="color:var(--muted);font-size:.72rem">${_dtzLabel}</span>${_bestMoveLabel&&_best?'<span style="cursor:pointer;color:var(--accent2);font-size:.78rem" onclick="autoSelectTablebaseMove(\''+_best.uci+'\')">🌟 '+T('recommend')+': '+_bestMoveLabel+'</span>':''}</div>`;
}else if(isTbOffline()){_tbBarHtml='<span style="color:var(--muted)">'+T('tb_unavailable')+'</span>';}
else{_tbBarHtml='<span style="cursor:pointer;color:var(--accent);text-decoration:underline" onclick="_triggerTbQuery()">'+T('tb_query')+'</span>';}
h+=`<div style="padding:6px 12px;background:#221015;border:1px solid var(--border);border-radius:6px;font-size:.8rem;font-family:system-ui,-apple-system,sans-serif"><div style="display:flex;align-items:center;gap:6px;margin-bottom:3px"><span style="font-size:.85rem">🌐</span><span style="color:var(--accent2);font-weight:700;font-size:.75rem">${T('tb_library')}</span></div>${_tbBarHtml}</div>`;
}
// ECO Opening Recommendation bar (only when _ecoEnabled)
if(!setupMode&&!gameOver&&!reviewMode&&_ecoEnabled&&gameState.currentTurn===playerColor){
const _ecoRec=getECORecommendation(gameState);
if(_ecoRec){
h+=`<div style="padding:6px 12px;background:#221015;border:1px solid var(--purple);border-radius:6px;font-size:.8rem;font-family:system-ui,-apple-system,sans-serif"><div style="display:flex;align-items:center;gap:6px;margin-bottom:3px"><span style="font-size:.85rem">📖</span><span style="color:#ffd700;font-weight:700;font-size:.75rem">${T('opening_rec')}</span></div><span style="color:var(--muted);font-size:.85rem;margin-right:4px">🔍</span><span style="color:var(--text)">${_ecoRec.notation}</span><span style="color:var(--muted);font-size:.7rem;margin-left:6px">(${_ecoRec.name})</span></div>`;
}
}
// Hint area: only shown when user clicked hint button (isHintLoading or hintText set)
// Search info in hint area only shown during hint loading, NOT during AI thinking
{if(isHintLoading||hintText){h+='<div class="hint-area"><div style="display:flex;align-items:center;gap:8px"><span style="font-size:.85rem">💡</span><span style="font-size:.75rem;color:var(--accent2)">'+T('ai_hint')+'</span></div>';if(isHintLoading)h+='<div class="hint-text" style="animation:pulse 1.2s infinite">'+T('hint_thinking')+'</div>';else if(hintText)h+='<div class="hint-text">'+_esc(hintText)+'</div>';if(isHintLoading&&_hintBarInfo)h+='<div id="hint-search-info" style="font-size:.72rem;color:var(--accent);margin-top:4px;font-family:monospace;letter-spacing:.5px">'+_hintBarInfo+'</div>';
// Ponder move is now displayed inline in hintText (set by onHintMove)
// when the engine provides "bestmove X ponder Y". No separate display needed here.
// Show MultiPV alternative lines if available
if(_multiPVLines.length>=1){h+='<div style="margin-top:6px;border-top:1px solid rgba(212,160,23,.15);padding-top:6px"><div style="font-size:.65rem;color:var(--muted);margin-bottom:4px">'+T('multi_analysis')+'</div>';for(const pv of _multiPVLines){let scoreStr='';if(pv.scoreMate!=null&&pv.scoreMate!==null){const m=parseInt(pv.scoreMate);scoreStr=m>0?'#+'+Math.abs(m):m<0?'#-'+Math.abs(m):'#0';}else if(pv.scoreCp!=null&&pv.scoreCp!==null){const pd=(pv.scoreCp/100).toFixed(1);scoreStr=(pv.scoreCp>0?'+':'')+pd;} let pvSAN='';if(pv.pv){try{const _conv=_convertPVtoSAN(pv.pv,gameState);pvSAN=_conv.sanMoves.split(/\s+/).slice(0,3).join(' ');}catch(e){pvSAN=pv.pv.split(/\s+/).slice(0,3).join(' ');}} h+='<div style="font-size:.65rem;color:'+(pv.index===1?'var(--accent2)':'var(--muted)')+';margin-bottom:2px">'+(pv.index===1?'⭐':'·')+' '+scoreStr+(pvSAN?' <span style="font-family:monospace;font-size:.6rem">'+_esc(pvSAN)+'</span>':'')+'</div>';}h+='</div>';} h+='</div>';}}// Player bar
{const _plCapHtml=capturedPiecesHtml(gameState.board,playerColor,playerColor);h+=`<div class="pbar" id="player-bar" style="flex-wrap:wrap"><span class="pico">${playerColor==='white'?'<span style="color:#E8E8F0;-webkit-text-stroke:.3px rgba(30,15,0,.85);text-shadow:0 0 .8px rgba(30,15,0,.55)">♔&#xFE0E;</span>':'<span style="color:#1A1A2E;-webkit-text-stroke:.3px rgba(255,230,150,.85);text-shadow:0 0 .8px rgba(255,230,150,.55)">♚&#xFE0E;</span>'}</span><div style="flex:1;min-width:0;display:flex;flex-direction:column"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><div class="pname">${T('you')}</div></div>${_plCapHtml}</div>${gameState.currentTurn===playerColor&&!gameOver?'<span class="tind" style="color:#4ade80">'+T('your_turn')+'</span>':''}</div>`;}
h+=`</div>`;
// Side panel
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
if(_ecoEnabled){
const ecoInfo=queryECO(gameState);
if(ecoInfo){h+=`<div class="card"><div class="card-t"><span class="ico">📖</span>${T('eco_id')}</div><div style="padding:12px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span class="opening-tag">${_esc(ecoInfo.id)}</span><span style="font-weight:600;font-size:.9rem">${_esc(ecoInfo.name)}</span></div><div style="color:var(--muted);font-size:.82rem">${_esc(ecoInfo.family)}</div></div></div>`}
}

// Move history
h+=`<div class="card"><div class="card-t"><span class="ico">📜</span>${T('move_history')}<button class="btn" style="margin-left:auto;padding:3px 10px;font-size:.7rem;min-height:24px" onclick="copyMoveHistory()">📝 PGN</button><div class="toggle" style="margin-left:6px;padding:2px 6px;font-size:.65rem" onclick="showVariations=!showVariations;HapticManager.fire(showVariations?'TOGGLE_ON':'TOGGLE_OFF');render()"><span>${T('variation_toggle')}</span><div class="toggle-sw${showVariations?' on':''}" style="width:30px;height:16px"></div></div></div><div class="mlist">`;
const pairs=[];for(let i=0;i<moveRecords.length;i+=2){pairs.push({n:Math.floor(i/2)+1,w:moveRecords[i],b:moveRecords[i+1]})}
for(const pr of pairs){h+='<div class="mrow"><span class="mnum">'+pr.n+'.</span>';if(pr.w){h+='<span class="mw" onclick="if(!isAIThinking&&!setupMode&&!reviewMode){showNewGameDialog=false;enterReview();reviewGoTo('+(pr.n*2-1)+');event.stopPropagation()}">'+_esc(pr.w.notation)+(pr.w.time?'<span style="font-size:.6rem;color:var(--muted);margin-left:2px">'+pr.w.time+'s</span>':'')+'</span>';if(showVariations&&pr.w&&pr.w.variations&&pr.w.variations.length>0){h+=_formatVariationGroups(pr.w.variations,pr.n,true);}}if(pr.b){h+='<span class="mb" onclick="if(!isAIThinking&&!setupMode&&!reviewMode){showNewGameDialog=false;enterReview();reviewGoTo('+(pr.n*2)+');event.stopPropagation()}">'+_esc(pr.b.notation)+(pr.b.time?'<span style="font-size:.6rem;color:var(--muted);margin-left:2px">'+pr.b.time+'s</span>':'')+'</span>';if(showVariations&&pr.b&&pr.b.variations&&pr.b.variations.length>0){h+=_formatVariationGroups(pr.b.variations,pr.n,false);}}h+='</div>'}
if(!pairs.length)h+=`<div style="color:#64748b;font-size:.85rem">${T('no_moves')}</div>`;
h+=`</div></div>`;
// Tips
h+=`<div class="card"><div class="card-t"><span class="ico">💡</span>${T('chess_tips')}</div><div class="tips">`;
h+=_principlesHTML();
h+=`</div></div>`;
h+=`</div></div>`;

// New game dialog
if(showNewGameDialog){
h+=`<div class="dov" role="dialog" aria-modal="true" aria-label="${T('new_game_settings')}" onclick="if(event.target===this){showNewGameDialog=false;render()}"><div class="dlg"><h2>⚔️ ${T('new_game_settings')}</h2>`;
h+=`<div class="dlg-sec"><h3>${T('play_color')}</h3><div class="clr-row"><button class="clr-btn${dlgPlayerColor==='white'?' act':''}" onclick="dlgPlayerColor='white';render()"><span style="color:#E8E8F0;-webkit-text-stroke:.3px rgba(30,15,0,.85);text-shadow:0 0 .8px rgba(30,15,0,.55);font-family:&#x27;DejaVu Sans&#x27;,&#x27;Noto Sans&#x27;,&#x27;Segoe UI Symbol&#x27;,sans-serif;font-variant-emoji:text;font-size:1.6rem">♔&#xFE0E;</span>${T('white_first')}</button><button class="clr-btn${dlgPlayerColor==='black'?' act':''}" onclick="dlgPlayerColor='black';render()"><span style="color:#1A1A2E;-webkit-text-stroke:.3px rgba(255,230,150,.85);text-shadow:0 0 .8px rgba(255,230,150,.55);font-family:&#x27;DejaVu Sans&#x27;,&#x27;Noto Sans&#x27;,&#x27;Segoe UI Symbol&#x27;,sans-serif;font-variant-emoji:text;font-size:1.6rem">♚&#xFE0E;</span>${T('black_second')}</button></div></div>`;
h+=`<div class="dlg-sec"><h3>${T('ai_book')}</h3><div class="toggle" onclick="dlgBookMoves=!dlgBookMoves;HapticManager.fire(dlgBookMoves?'TOGGLE_ON':'TOGGLE_OFF');render()" style="margin-bottom:10px"><span>${T('book_moves')}</span><div class="toggle-sw${dlgBookMoves?' on':''}"></div></div></div><div style="font-size:.72rem;color:var(--muted);margin-bottom:10px">${T('eco_book_desc')}</div></div>`;
h+=`<div class="dlg-sec"><h3>${T('classic_openings')}</h3><div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap"><form onsubmit="event.preventDefault();if(!_ecoComposing){_ecoDoSearch()}" style="flex:1;min-width:200px;display:flex;gap:4px"><input id="ecoSearch" type="text" inputmode="search" placeholder="${T('eco_search_ph')}" style="flex:1;padding:8px 12px;border-radius:10px;border:1px solid var(--border);background:var(--card);color:var(--text);font-size:.85rem;touch-action:manipulation" enterkeyhint="search" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" oninput="if(!_ecoComposing){setEcoQuery(this.value)}" onfocus="_ecoSearchFocused=true;if(_ecoBlurTimer){clearTimeout(_ecoBlurTimer);_ecoBlurTimer=0}" onblur="_ecoBlurTimer=setTimeout(function(){_ecoSearchFocused=false;_ecoBlurTimer=0},200)" oncompositionstart="_ecoComposing=true" oncompositionend="_ecoComposing=false;setEcoQuery(this.value)" onkeydown="if((event.key==='Enter'||event.keyCode===13)&&!event.isComposing&&!_ecoComposing){event.preventDefault();setEcoQuery(this.value);_ecoDoSearch()}" value="${(window.ecoSearchQuery||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]))}"></form><select id="ecoFamily" style="padding:8px 12px;border-radius:10px;border:1px solid var(--border);background:var(--card);color:var(--text);font-size:.85rem;cursor:pointer" onchange="window.ecoFamilyFilter=this.value;ecoShowCount=30;_ecoUpdateResults()"><option value="">${T('all_categories')}</option>${Object.keys(ECO_BY_FAMILY).sort().map(f=>`<option value="${f}"${(window.ecoFamilyFilter||'')===f?' selected':''}>${f}</option>`).join('')}</select></div><div class="op-list"><button class="op-btn${!dlgOpeningId?' act':''}" onclick="dlgOpeningId=null;window.ecoSearchQuery='';window.ecoFamilyFilter='';ecoShowCount=30;_ecoUpdateResults()"><div class="on">${T('free_opening_btn')}</div><div class="os">${T('from_start')}</div></button>`;
_ensureEcoParsed();ecoDisplayList=ECO_OPENINGS;
if(window.ecoSearchQuery){const q=window.ecoSearchQuery.trim().toUpperCase();ecoDisplayList=searchEco(q)}
else if(window.ecoFamilyFilter){ecoDisplayList=ECO_BY_FAMILY[window.ecoFamilyFilter]||[]}
for(const o of ecoDisplayList.slice(0,ecoShowCount))h+=`<button class="op-btn${dlgOpeningId===o.id+'|'+o.name?' act':''}" onclick="dlgOpeningId='${_esc(o.id)}|${_esc(o.name)}';_ecoUpdateResults()"><div class="on">${_esc(o.id)} ${_esc(o.name)}</div><div class="os">${_esc(o.family)}</div></button>`;
if(ecoDisplayList.length>ecoShowCount)h+=`<button class="btn btn-d" style="width:100%;margin-top:4px" onclick="ecoShowCount+=30;_ecoUpdateResults()">${T('load_more')} (+${ecoDisplayList.length-ecoShowCount})</button>`;
h+=`</div></div>`;
h+=`<div class="dlg-btns"><button type="button" class="btn btn-s" onclick="showNewGameDialog=false;dlgOpeningId=null;render()">${T('cancel')}</button><button type="button" class="btn btn-p" onclick="startGame()">${T('start_game_pawn')}</button></div>`;
h+=`</div></div>`}

// Promotion dialog
if(showEngineConfig){h+=renderEngineConfig();}
if(showAboutPage){
// Load AGPL v3 SVG via AndroidBridge as base64 (CSP-compliant)
let _gplSvgSrc='';
try{if(typeof AndroidBridge!=='undefined'&&AndroidBridge.loadAssetAsBase64){const b64=AndroidBridge.loadAssetAsBase64('AGPLv3_Logo.svg');if(b64)_gplSvgSrc='data:image/svg+xml;base64,'+b64;}}catch(e){}
h+=`<div class="dov" role="dialog" aria-modal="true" aria-label="About"><div class="dlg" style="max-width:460px"><h2>${T('about_title')}</h2><div class="dlg-sec"><div class="crow"><span class="lb">${T('about_app')}</span><span class="vl">${T('app_name')} v1.0.0</span></div><div class="crow"><span class="lb">${T('about_engine')}</span><span class="vl">Stockfish 18 (arm64-v8a-dotprod)</span></div><div class="crow"><span class="lb">${T('about_platform')}</span><span class="vl">Android arm64-v8a</span></div></div><div class="dlg-sec"><h3>${T('copyright_license')}</h3>`+(_gplSvgSrc?`<div style="text-align:center;margin-bottom:10px"><img src="${_gplSvgSrc}" alt="AGPL v3 Logo" style="width:120px;height:auto;opacity:.9" /></div>`:'')+`<div style="font-size:.75rem;color:var(--text);line-height:1.6"><p style="margin-bottom:8px">${T('about_copyright')}</p><p style="margin-bottom:8px">${T('about_source_code')}</p><p style="margin-bottom:8px">${T('about_agpl')} <a href="https://www.gnu.org/licenses/agpl-3.0.html" style="color:var(--accent2);text-decoration:underline" target="_blank">GNU AGPL v3</a>${T('about_agpl_desc')}</p><p style="margin-bottom:8px">${T('about_droidfish')} <a href="https://www.gnu.org/licenses/gpl-3.0.html" style="color:var(--accent2);text-decoration:underline" target="_blank">GPL v3</a>${T('about_droidfish_desc')}</p><p style="margin-bottom:8px">${T('about_stockfish')} <a href="https://www.gnu.org/licenses/gpl-3.0.html" style="color:var(--accent2);text-decoration:underline" target="_blank">GPL v3</a> ${T('about_gplv3')}</p><p style="margin-bottom:8px;color:var(--muted)">${T('about_disclaimer')}</p><p style="margin-bottom:8px;color:var(--muted)">${T('about_ai')}</p></div></div><div class="dlg-btns"><button type="button" class="btn btn-p" onclick="showAboutPage=false;render()" style="flex:1;justify-content:center">${T('close')}</button></div></div></div>`;}
// Import dialog — paste FEN, paste PGN, or select PGN file
if(showImportDialog){
h+=`<div class="dov" role="dialog" aria-modal="true" aria-label="${T('import_title')}" onclick="if(event.target===this){showImportDialog=false;render()}"><div class="dlg" style="max-width:420px"><h2>${T('import_title')}</h2><div class="dlg-sec" style="gap:10px;display:flex;flex-direction:column">
<button class="btn" style="width:100%;justify-content:center;gap:8px;padding:12px;font-size:.9rem" onclick="showImportDialog=false;importFEN()"><span style="font-size:1.3rem">📋</span> ${T('paste_fen_opt')}</button>
<button class="btn" style="width:100%;justify-content:center;gap:8px;padding:12px;font-size:.9rem" onclick="showImportDialog=false;_doPastePGN()"><span style="font-size:1.3rem">📜</span> ${T('paste_pgn_opt')}</button>
<button class="btn" style="width:100%;justify-content:center;gap:8px;padding:12px;font-size:.9rem" onclick="showImportDialog=false;importPGNFile()"><span style="font-size:1.3rem">📂</span> ${T('select_pgn_file')}</button>
</div><div class="dlg-btns"><button type="button" class="btn btn-s" onclick="showImportDialog=false;render()" style="flex:1;justify-content:center">${T('cancel')}</button></div></div></div>`;
}
if(pendingPromotion){const co=pendingPromotion.piece.color;const pcls=co==='white'?'w-prom':'bk-prom';h+=`<div class="prom-dov" role="dialog" aria-modal="true" aria-label="${T('select_promotion')}" onclick="if(event.target===this){pendingPromotion=null;render()}"><div class="prom-dlg"><h3>${T('select_promotion')}</h3><div class="prom-row">`;for(const t of['queen','rook','bishop','knight'])h+=`<button class="prom-btn ${pcls}" onclick="doPromotion('${t}')">${SYM[co][t]}</button>`;h+=`</div><button class="btn" style="margin-top:12px;font-size:.8rem" onclick="pendingPromotion=null;render()">${T('cancel')}</button></div></div>`}

if(reviewMode){
const safeStep=Math.max(0,Math.min(reviewStep,reviewStates.length-1));
reviewStep=safeStep;
const rs=reviewStates[safeStep];
if(!rs){reviewMode=false;render();return}
const rBoard=rs.state.board;const rLast=rs.lastMove;
h+='<div class="review-overlay">';
h+=`<div class="review-hdr"><h2>${T('review_analysis')}</h2><div style="display:flex;gap:6px;align-items:center"><div class="toggle" style="padding:2px 6px;font-size:.65rem" onclick="showVariations=!showVariations;HapticManager.fire(showVariations?'TOGGLE_ON':'TOGGLE_OFF');render()"><span>${T('variation_toggle')}</span><div class="toggle-sw${showVariations?' on':''}" style="width:30px;height:16px"></div></div><button class="btn" onclick="copyReviewPGN()" title="${T('copy_review_pgn')}">📝 PGN</button><button class="btn" onclick="copyReviewFEN()" title="${T('copy_review_fen')}">📝 FEN</button><button class="btn" onclick="exitReview()">${T('return_game')}</button></div></div>`;
h+='<div class="review-body">';
// P0 FIX: Wrap board + controls in .review-left for proper landscape flex layout
h+='<div class="review-left">';
// Calculate REVIEW_CELL dynamically based on available viewport height.
// In landscape review mode, the board + eval bar + slider + chart + buttons must ALL fit
// within the viewport height. Previously, REVIEW_CELL=CELL*0.8 was too large, causing
// the chart to be pushed off-screen or invisible. Now we calculate the max cell size
// that leaves enough room for the chart (minimum 40px) and other controls (~160px total).
const _isLandscapeReview = window.innerWidth > window.innerHeight;
let _rvCell = REVIEW_CELL; // Default from game-logic.js
if (_isLandscapeReview) {
  // OPT: In landscape, maximize board size while ensuring chart + controls fit.
  // Available height = viewport height - review header (~28px).
  // Control budget: eval bar(~16px) + slider(~20px) + step label(~12px) + chart(min 30px)
  // + toggle row(~16px) + nav buttons(~20px) + analyze button(~22px) + gaps(~16px) = ~152px.
  const _rvAvailH = window.innerHeight - 28;
  const _rvCtrlBudget = 152;
  const _rvMaxCellH = Math.floor((_rvAvailH - _rvCtrlBudget) / 8);
  // Width: Use up to 45% of viewport width for the board (was 50%), leaving more room
  // for the moves list. The board doesn't need to be extremely large in landscape review.
  const _rvMaxCellW = Math.floor((Math.min(window.innerWidth * 0.45, 360)) / 8);
  _rvCell = Math.max(22, Math.min(_rvMaxCellH, _rvMaxCellW, REVIEW_CELL));
}
h+='<div class="review-board">';
h+='<div class="bgrid" style="grid-template-columns:repeat(8,'+_rvCell+'px);grid-template-rows:repeat(8,'+_rvCell+'px)">';
for(let r=0;r<8;r++){for(let c=0;c<8;c++){
const rr=flip?7-r:r;const cc=flip?7-c:c;
const p=rBoard[rr][cc];const isL=(r+c)%2===0;
let bg=isL?SQ_LIGHT:SQ_DARK;
// No last-move square coloring in review — CSS last-from/last-to borders are sufficient
h+='<div style="background:'+bg+';width:'+_rvCell+'px;height:'+_rvCell+'px;display:flex;align-items:center;justify-content:center;font-size:1.5rem">';
if(p){h+='<span class="'+(p.color==='white'?'rv-w':'rv-bk')+'" style="pointer-events:none">'+SYM[p.color][p.type]+'</span>';}
h+='</div>';
}}
h+='</div>';
h+='</div>';
// Rich eval display — reuse formatEval() for consistency with in-game eval bar
const _re=formatEval();
let _rDelta='';
if(_sfEvalReady&&!_evalLoading&&reviewStep>0){
  const _prevEv=_reviewEvalCache.get(reviewStep-1);
  if(_prevEv!=null) _rDelta=' '+_formatEvalDelta(_sfEval,_prevEv.eval);
}
const _rDepthStr=_sfDepth>0?'<span style="font-size:.65rem;color:var(--muted);margin-left:4px">D'+_sfDepth+'</span>':'';
// Build WDL string for review eval bar (same as main eval bar)
let _rWdlStr='';
if(_sfWdlW>=0&&_sfWdlD>=0&&_sfWdlL>=0){const _rt=_sfWdlW+_sfWdlD+_sfWdlL;const _rw=Math.round(_sfWdlW/_rt*100);const _rd=Math.round(_sfWdlD/_rt*100);const _rl=100-_rw-_rd;_rWdlStr='<span style="font-size:.65rem;color:var(--muted);margin-left:4px">('+_rw+'%W/'+_rd+'%D/'+_rl+'%L)</span>';}
h+='<div class="ev" id="review-eval-bar" style="margin:6px 0;font-size:.85rem"><span class="ev-e">'+_re.emoji+'</span><span>'+_re.desc+'</span><span style="color:var(--muted)">('+_re.score+')</span>'+_rDepthStr+_rWdlStr+_rDelta+'</div>';
// Review step slider
h+='<div style="width:100%;margin:6px 0">';
h+='<input type="range" class="review-slider" min="0" max="' + (reviewStates.length-1) + '" value="' + reviewStep + '" style="width:100%;accent-color:#d4a017" oninput="reviewGoTo(parseInt(this.value))">';
h+='<div style="display:flex;justify-content:space-between;font-size:.65rem;color:var(--muted)"><span>'+T('start_pos')+'</span><span>'+T('step_label')+' '+ reviewStep + ' / ' + (reviewStates.length-1) + '</span><span>'+T('end_pos')+'</span></div>';
h+='</div>';
// Eval trend chart
// Use full available width — the chart container is inside .review-left
// which takes the full width of the review body. Remove the 280px cap so the
// chart fully utilizes the right-side space.
// Calculate chart width based on actual container.
// In landscape review mode, the chart is in .review-left which is narrower.
// Use _rvCell (dynamically calculated) instead of REVIEW_CELL for board width.
const _isLandscapeTrend = window.innerWidth > window.innerHeight;
const _boardWidthPx = _rvCell * 8;
// Primary: use board width (always reliable). Fallback: clientWidth if available and non-zero.
const _trendContainer = document.querySelector('.review-left');
const _containerW = (_trendContainer && _trendContainer.clientWidth > 40) ? _trendContainer.clientWidth : 0;
const _estimatedTrendW = _isLandscapeTrend
  ? Math.max(120, (_containerW > 40 ? _containerW : _boardWidthPx) - 12)
  : Math.max(120, (_containerW > 40 ? _containerW : Math.min(window.innerWidth - 48, 400)) - 12);
const _trendW = _estimatedTrendW > 0 ? _estimatedTrendW : 300; // Fallback to 300px
// Dynamic chart height based on actual available space after board and controls.
// Uses _rvCell (dynamically sized for landscape) instead of REVIEW_CELL.
// Board = 8*_rvCell, controls ~90px (eval + slider + buttons). Remaining for chart.
const _landscapeAvailH = Math.max(0, window.innerHeight - 30 - (8 * _rvCell) - 100);
const _trendH = _isLandscapeTrend
  ? Math.max(40, Math.min(120, _landscapeAvailH))
  : Math.max(40, Math.min(120, window.innerHeight - 154));
const _trendSVG = _buildEvalTrendSVG(_trendW, _trendH);
if (_trendSVG) {
  // Toggle row above chart (left-aligned, independent of chart SVG)
  h+='<div style="display:flex;justify-content:flex-start;padding:0 4px">';
  h+='<div class="toggle" style="font-size:.6rem;padding:2px 4px" onclick="_reviewEvalGlobal=!_reviewEvalGlobal;HapticManager.fire(_reviewEvalGlobal?\'TOGGLE_ON\':\'TOGGLE_OFF\');render()"><span>'+T('chart_global')+'</span><div class="toggle-sw'+(_reviewEvalGlobal?' on':'')+'" style="width:28px;height:16px"><div style="position:absolute;top:1px;left:'+(_reviewEvalGlobal?'13px':'1px')+';width:12px;height:12px;border-radius:50%;background:'+(_reviewEvalGlobal?'#1a0a0a':'var(--accent2)')+';transition:all .3s;box-shadow:0 1px 4px rgba(0,0,0,.5)"></div></div></div>';
  h+='</div>';
  h+='<div class="review-chart" style="width:100%;height:'+_trendH+'px;margin:4px 0;background:#1a0a0a;border:1px solid var(--border);border-radius:4px;padding:2px;overflow:hidden">';
  h+=_trendSVG;
  h+='</div>';
}
h+='<div style="display:flex;gap:4px;margin-top:6px;flex-wrap:wrap">';
h+='<button class="btn btn-d" onclick="reviewGoTo(0)">⏮</button>';
h+='<button class="btn btn-d" onclick="reviewGoTo(Math.max(0,reviewStep-1))">◀</button>';
h+='<button class="btn btn-d" onclick="reviewGoTo(Math.min(reviewStates.length-1,reviewStep+1))">▶</button>';
h+='<button class="btn btn-d" onclick="reviewGoTo(reviewStates.length-1)">⏭</button>';
h+='</div>';
// Analyze all steps button
const _cachedCount=_reviewEvalCache.size;
const _totalSteps=reviewStates.length;
const _allCached=_cachedCount>=_totalSteps;
h+='<button class="btn" style="margin-top:4px;width:100%;font-size:.7rem;min-height:28px" onclick="reviewAnalyzeAll()">'+(_allCached?T('all_analyzed'):(T('analyze_all_steps')+' '+_totalSteps+(_cachedCount>0?' ('+_cachedCount+'/'+_totalSteps+')':'')))+'</button>';
h+='</div>'; // Close review-left — review-moves will be a sibling, not child
// Build a set of critical move steps for quick lookup
const _criticalSteps=new Set(reviewCritical.map(c=>c.step));
const _criticalReasons=new Map();reviewCritical.forEach(c=>_criticalReasons.set(c.step,c.reason));
h+='<div class="review-moves" id="reviewMovesList">';
for(let i=0;i<moveRecords.length;i++){
const mr=moveRecords[i];const isW=i%2===0;const moveNum=Math.floor(i/2)+1;
const isAct=reviewStep===i+1;
const isCritical=_criticalSteps.has(i+1);
const criticalFlag=isCritical?' style="border-left:3px solid var(--accent2);padding-left:7px"':'';
h+='<div class="rmv-block'+(isAct?' act':'')+'" onclick="reviewGoTo('+(i+1)+')" data-step="'+(i+1)+'"'+criticalFlag+'>';
h+='<span class="rmv-num">'+(isW?moveNum+'.':'')+'</span>';
h+='<div class="rmv-detail"><span class="rmv-notation">'+_esc(mr.notation)+'</span>';
if(isCritical&&_criticalReasons.has(i+1)){h+='<span style="font-size:.65rem;color:var(--accent);display:block;margin-top:1px">'+_criticalReasons.get(i+1)+'</span>';}
// Show proper variations array (🌿 line 1 = mainline prediction, 🌿 line 2+ = MultiPV).
// Ponder is fully decoupled from move records — never appears here.
if(showVariations&&mr.variations&&mr.variations.length>0){h+=_formatVariationGroups(mr.variations,moveNum,isW);}
// Show per-move eval if cached
const _mvEval=_reviewEvalCache.get(i+1);
const _prevMvEval=_reviewEvalCache.get(i);
if(_mvEval!=null&&_prevMvEval!=null){
  h+=_formatEvalDelta(_mvEval.eval,_prevMvEval.eval,'.6rem');
  // Move classification label — ALWAYS from mover's perspective
  // reviewStep parity: odd step = White moved, even step = Black moved
  // i+1 is the reviewStep for this move (move index i corresponds to step i+1)
  const _mvDelta=_mvEval.eval-(_prevMvEval?_prevMvEval.eval:0);
  const _isMoverWhite=((i+1)%2)===1; // step is odd → White moved
  const _mcls=_classifyMove(_mvDelta,_isMoverWhite);
  h+='<span style="font-size:.6rem;font-weight:700;color:'+_mcls.color+';margin-left:4px">'+_mcls.label+'</span>';
}
h+='</div></div>';
}
h+='</div></div></div>'; // review-moves, review-body, review-overlay
}
const _wasEcoFocused=_ecoSearchFocused;if(_ecoBlurTimer){clearTimeout(_ecoBlurTimer);_ecoBlurTimer=0}
app.innerHTML=h;
// Invalidate all cached DOM refs since DOM was rebuilt by full render
_cachedBwrap=null;_cachedSvgEl=null;_cachedSvgLines=[];_cachedArrowKey='';_cachedCtrlCard=null;
// Do NOT reset _prevSelSq/_prevLegalSet to null/empty after render().
// After render() rebuilds the DOM, we must preserve the tracking state so that
// the next _updateBoardLightweight() call can correctly identify what changed
// and clear old selection highlights. Previously, resetting these to null caused
// the old selected square to never be updated when the user clicked a different
// piece after an AI hint auto-selection (which calls both _updateBoardLightweight()
// and render()). The old highlight remained stuck, appearing as "two pieces selected".
_prevHoverSq=hoveredSquare?{row:hoveredSquare.row,col:hoveredSquare.col}:null;
_prevSelSq=selectedSquare?{row:selectedSquare.row,col:selectedSquare.col}:null;
_prevLegalSet=new Set();if(selectedSquare){for(const m of legalMvs)_prevLegalSet.add(m.row*8+m.col);}
// Review scrolling: scroll the active move into view after DOM rebuild.
// FIX: Use requestAnimationFrame + setTimeout to ensure layout is complete
// before scrolling. Synchronous scrollIntoView immediately after innerHTML
// can be lost because the browser hasn't performed layout yet.
if(reviewMode){
  requestAnimationFrame(function(){
    setTimeout(function(){
      const _rList=document.getElementById('reviewMovesList');
      if(_rList){
        const _rAct=_rList.querySelector('.rmv-block.act');
        if(_rAct)_rAct.scrollIntoView({block:'center',behavior:'instant'});
      }
    },0);
  });
}
// Render arrows into the new DOM using persistent SVG overlay
_updateArrows(hoveredSquare||selectedSquare);
// Invalidate DOM element cache and update board state tracking after full render
_invalidateElCache(); _sqElCache = null; _prevBoardState = JSON.stringify(gameState.board);
// Restore focus for ECO search input using pre-rebuild state
if(_wasEcoFocused){const el=document.getElementById('ecoSearch');if(el){el.focus();_ecoSearchFocused=true;try{el.setSelectionRange(el.value.length,el.value.length)}catch(e){}}}
// Auto-scroll opening list to selected opening (skip during review mode)
if(showNewGameDialog&&dlgOpeningId&&!reviewMode){setTimeout(()=>{const list=document.querySelector('.op-list');if(list){const active=list.querySelector('.op-btn.act');if(active)active.scrollIntoView({block:'center',behavior:'smooth'})}},50)}
}catch(e){const _app=document.getElementById('app');if(_app)_app.innerHTML='<div style="color:red;padding:20px;font-family:monospace;background:#1a0000;border:2px solid red;border-radius:8px;margin:20px"><h3>Render Error</h3><pre style="white-space:pre-wrap;font-size:12px">'+e.toString()+'\n\n'+e.stack+'</pre></div>';console.error('Render error:',e)}}



// Lightweight post-move update: targeted DOM updates instead of innerHTML rebuild
// Only updates squares that actually changed — avoids 5-15ms DOM rebuild per move
let _fullRenderTimer=0;

let _sqBgCache=null;function _getSqBg(rr,cc,cm,isL,lastMove){
  let bg=isL?SQ_LIGHT:SQ_DARK;
  let ctrlBg=null;
  if(cm){const e=cm[rr][cc];if(e){const wc=e.white.length,bc=e.black.length;const myC=playerColor==='white'?wc:bc;const opC=playerColor==='white'?bc:wc;const net=myC-opC;const total=myC+opC;const adv=total>0?net/total:0;const str=Math.min(1,total/8);let hue;if(myC===0&&opC===0){ctrlBg='#3a2020'}else{if(adv>=0)hue=280-adv*60;else hue=280-adv*80;if(hue>=360)hue-=360;const sat=0.50+str*0.40;const lit=0.48-str*0.12;ctrlBg=`hsl(${Math.round(hue)},${Math.round(sat*100)}%,${Math.round(lit*100)}%)`}}}
  let lastFrom=false,lastTo=false;if(lastMove){if(rr===lastMove.from.row&&cc===lastMove.from.col)lastFrom=true;if(rr===lastMove.to.row&&cc===lastMove.to.col)lastTo=true;}
  if(ctrlBg){bg=ctrlBg}
  return bg;
}

function _updateSingleSq(el,p,rr,cc,cm,isL,lastMove,_checkKingPos){
  const bg=_getSqBg(rr,cc,cm,isL,lastMove);
  const isSel=selectedSquare&&rr===selectedSquare.row&&cc===selectedSquare.col;
  const lastFrom=lastMove&&rr===lastMove.from.row&&cc===lastMove.from.col;
  const lastTo=lastMove&&lastMove.to.row===rr&&lastMove.to.col===cc;
  const isCheckSq=_checkKingPos&&rr===_checkKingPos.row&&cc===_checkKingPos.col;
  el.style.background=isSel?SQ_SEL:bg;
  el.className='sq'+(lastFrom?' last-from':'')+(lastTo?' last-to':'')+(isCheckSq?' in-check':'');
  const lbl=String.fromCharCode(97+cc)+(8-rr);
  const isLegal=legalSet.has(rr*8+cc);
  let inner=`<span class="lbl" style="color:${isL?LBL_LIGHT:LBL_DARK};-webkit-text-stroke:.6px ${isL?LBL_STROKE_LIGHT:LBL_STROKE_DARK};paint-order:stroke fill;text-shadow:0 0 2px ${isL?LBL_STROKE_LIGHT:LBL_STROKE_DARK}">${lbl}</span>`;
  if(p){
    const animCls=(_lastAnimPieceType&&_lastAnimTarget&&lastTo&&rr===_lastAnimTarget.row&&cc===_lastAnimTarget.col&&p.type===_lastAnimPieceType)?' anim-'+p.type:'';
    inner+=`<span class="pc ${p.color==='white'?'w':'bk'}${animCls}">${SYM[p.color][p.type]}</span>`;
    if(animCls){_landingAnimActive=true;_startLandingTimer(_lastAnimPieceType);}
  }
  if(isLegal&&!p)inner+=`<div class="dot"></div>`;
  if(isLegal&&p)inner+=`<div class="ring"></div>`;
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
  if(gameOver||setupMode||reviewMode||showNewGameDialog||pendingPromotion){_lastAnimPieceType='';_lastAnimTarget=null;render();return;}
  const gridEl=document.getElementById('board-grid');
  if(!gridEl){_lastAnimPieceType='';_lastAnimTarget=null;render();return;}
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
    for(let r=0;r<8;r++){for(let c=0;c<8;c++){
      const rr=flip?7-r:r;const cc=flip?7-c:c;
      const p=gameState.board[rr][cc];const isL=(r+c)%2===0;
      const bg=_getSqBg(rr,cc,cm,isL,lastMove);
      const isSel=selectedSquare&&rr===selectedSquare.row&&cc===selectedSquare.col;
      const lastFrom=lastMove&&rr===lastMove.from.row&&cc===lastMove.from.col;
      const lastTo=lastMove&&lastMove.to.row===rr&&lastMove.to.col===cc;
      const isCheckSq=_checkKingPos&&rr===_checkKingPos.row&&cc===_checkKingPos.col;
      const isLegal=legalSet.has(rr*8+cc);
      const lbl=String.fromCharCode(97+cc)+(8-rr);
      bh+=`<div class="sq${lastFrom?' last-from':''}${lastTo?' last-to':''}${isCheckSq?' in-check':''}" style="background:${isSel?SQ_SEL:bg}" data-r="${rr}" data-c="${cc}" onclick="sqClick(${rr},${cc})">`;
      bh+=`<span class="lbl" style="color:${isL?LBL_LIGHT:LBL_DARK};-webkit-text-stroke:.6px ${isL?LBL_STROKE_LIGHT:LBL_STROKE_DARK};paint-order:stroke fill;text-shadow:0 0 2px ${isL?LBL_STROKE_LIGHT:LBL_STROKE_DARK}">${lbl}</span>`;
      if(p){const _ac=(_lastAnimPieceType&&_lastAnimTarget&&lastTo&&rr===_lastAnimTarget.row&&cc===_lastAnimTarget.col&&p.type===_lastAnimPieceType)?' anim-'+p.type:'';bh+=`<span class="pc ${p.color==='white'?'w':'bk'}${_ac}">${SYM[p.color][p.type]}</span>`;if(_ac){_landingAnimActive=true;_startLandingTimer(_lastAnimPieceType);}}
      if(isLegal&&!p)bh+=`<div class="dot"></div>`;
      if(isLegal&&p)bh+=`<div class="ring"></div>`;
      bh+=`</div>`}}
    gridEl.innerHTML=bh;
    _sqElCache=null;
  }
  // Update eval display
  _updateEvalDisplay();
  // Invalidate arrow cache since board state changed
  _invalidateArrowCache();
  _updateArrows(hoveredSquare||selectedSquare);

  // Clear landing anim state so the delayed render() will NOT re-apply the anim class
  // (which would restart the CSS @keyframes animation)
  _lastAnimPieceType='';_lastAnimTarget=null;
  // Use markDirty for delayed panel/moves update
  // Schedule a full render later for move history + other side panel updates
  if(_fullRenderTimer)clearTimeout(_fullRenderTimer);
  _fullRenderTimer=setTimeout(()=>{if(!animationInProgress&&!_landingAnimActive&&!isAIThinking)markDirty(DIRTY_MOVES|DIRTY_PANEL|DIRTY_EVAL);},600);
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
  if(_cachedBwrap&&!_cachedBwrap.parentNode)_cachedBwrap=null;
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
  // Differentiate friend vs foe arrows with distinct colors.
  // Player's pieces: warm gold (#D4A017) — clearly "ours"
  // Opponent's pieces: cool silver (#8A9BAE) — clearly "theirs"
  // Previously both used the same #888888 gray, making them indistinguishable.
  const arrows=[];
  for(const c of e[playerColor])arrows.push({from:c.position,to:infoSq,isFriendly:true});
  for(const c of e[oppC])arrows.push({from:c.position,to:infoSq,isFriendly:false});
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
      try{_cachedSvgLines[i].remove();}catch(e){}
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
  // Collect logical positions that need updating
  const logicPositions=new Set();
  if(oldInfoSq)logicPositions.add(oldInfoSq.row*8+oldInfoSq.col);
  if(newInfoSq)logicPositions.add(newInfoSq.row*8+newInfoSq.col);
  // Old legal dots need removal, new legal dots need addition
  for(const pos of oldLegalSet)logicPositions.add(pos);
  for(const pos of newLegalSet)logicPositions.add(pos);
  // Also include selected square itself
  if(selectedSquare)logicPositions.add(selectedSquare.row*8+selectedSquare.col);
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
    el.style.background=bg;
    el.className='sq'+(lastFrom?' last-from':'')+(lastTo?' last-to':'')+(isCheckSq?' in-check':'');
    const lbl=String.fromCharCode(97+lc)+(8-lr);
    let inner=`<span class="lbl" style="color:${isL?LBL_LIGHT:LBL_DARK};-webkit-text-stroke:.6px ${isL?LBL_STROKE_LIGHT:LBL_STROKE_DARK};paint-order:stroke fill;text-shadow:0 0 2px ${isL?LBL_STROKE_LIGHT:LBL_STROKE_DARK}">${lbl}</span>`;
    if(p){inner+=`<span class="pc ${p.color==='white'?'w':'bk'}">${SYM[p.color][p.type]}</span>`;}
    if(isLegal&&!p)inner+=`<div class="dot"></div>`;
    if(isLegal&&p)inner+=`<div class="ring"></div>`;
    el.innerHTML=inner;
  }
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
  const _selChanged=!!selectedSquare!==!!_prevSelSq||(selectedSquare&&_prevSelSq&&(selectedSquare.row!==_prevSelSq.row||selectedSquare.col!==_prevSelSq.col));
  const _newHover=!oldInfoSq&&newInfoSq||!!oldInfoSq&&!newInfoSq||oldInfoSq&&newInfoSq&&(oldInfoSq.row!==newInfoSq.row||oldInfoSq.col!==newInfoSq.col);
  // Compute current legal positions
  const curLegalSet=new Set();
  if(selectedSquare){for(const m of legalMvs)curLegalSet.add(m.row*8+m.col);}
  // Check if legal moves changed
  let _legalChanged=_selChanged;
  if(!_legalChanged){if(curLegalSet.size!==_prevLegalSet.size){_legalChanged=true;}else{for(const p of curLegalSet){if(!_prevLegalSet.has(p)){_legalChanged=true;break;}}}}
  if(!_selChanged&&!_newHover&&!_legalChanged)return; // Nothing changed, skip
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
  if(infoSq&&cm){const e=cm[infoSq.row][infoSq.col];if(e)infoCtrl={white:e.white,black:e.black}}
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
    if(infoCtrl){h+=`<div class="plist">`;for(const c of infoCtrl[playerColor])h+=`<div class="pitem"><span class="dot2 b"></span>${pieceName(c.piece.type)}@${posAlg(c.position)}</div>`;for(const c of infoCtrl[oppC])h+=`<div class="pitem"><span class="dot2 r"></span>${pieceName(c.piece.type)}@${posAlg(c.position)}</div>`;h+=`</div>`}
    ctrlCard.innerHTML=h;
  }else{
    ctrlCard.innerHTML=`<div class="card-t"><span class="ico">📍</span>${T('ctrl_info')}</div><div style="color:#64748b;font-size:.85rem">${T('click_sq')}</div>`;
  }
}

function sqClick(r,c){
if(animationInProgress)return;
if(setupMode){setupClick(r,c);return}
const pos={row:r,col:c};const p=gameState.board[r][c];
const canMove=!gameOver&&!isAIThinking&&!pendingPromotion&&!reviewMode&&gameState.currentTurn===playerColor;
// Toggle deselection — clicking the already-selected piece deselects it.
// Previously, clicking the selected piece would re-select it (same legalMvs, same highlight),
// making it impossible to deselect. This was especially problematic after AI hint auto-selection,
// where the user had no way to clear the selection highlight.
if(selectedSquare&&selectedSquare.row===r&&selectedSquare.col===c){
  selectedSquare=null;legalMvs=[];legalSet=new Set();
  HapticManager.fire('BUTTON_PRESS');_updateBoardLightweight();return
}
if(selectedSquare&&canMove){
  const isLegal=legalSet.has(r*8+c);
  if(isLegal){
    const mp=gameState.board[selectedSquare.row][selectedSquare.col];
    if(mp&&mp.type==='pawn'){
      const pr=mp.color==='white'?0:7;
      if(r===pr){pendingPromotion={from:selectedSquare,to:pos,piece:mp};render();return}
    }
    executeMove(selectedSquare,pos);
    return
  }
  // Clicked a non-legal square while a piece is selected.
  // If it's another own piece, switch selection to it (not "simultaneous selection").
  // If it's an empty/opponent square (not a legal move target), deselect the old
  // piece AND select the new square in one step — this shows control info for the
  // clicked square while clearing the old selection highlight.
  if(p&&p.color===playerColor){
    selectedSquare=pos;legalMvs=legalMoves(gameState,pos);legalSet=new Set(legalMvs.map(m=>m.row*8+m.col));
    HapticManager.fire('PIECE_SELECT');_updateBoardLightweight();return
  }
  // Clicked empty/opponent square that's not a legal move → deselect old & select new
  selectedSquare=pos;legalMvs=[];legalSet=new Set();
  HapticManager.fire('BUTTON_PRESS');_updateBoardLightweight();return
}
// No piece currently selected — allow selecting own piece or any square for control info
if(canMove&&p&&p.color===playerColor){selectedSquare=pos;legalMvs=legalMoves(gameState,pos);legalSet=new Set(legalMvs.map(m=>m.row*8+m.col));HapticManager.fire('PIECE_SELECT');_updateBoardLightweight();return}
// Clicked empty/opponent square with no selection — allow for control info, but prefer deselect
if(selectedSquare){selectedSquare=null;legalMvs=[];legalSet=new Set();HapticManager.fire('BUTTON_PRESS');_updateBoardLightweight();return}
selectedSquare=pos;legalMvs=[];legalSet=new Set();HapticManager.fire('BUTTON_PRESS');_updateBoardLightweight();return
}
function executeMove(from,to,promotion){
try{
// Handle Ponder mode — if engine is pondering, check if the move matches the ponder move
if(typeof AndroidBridge!=='undefined'&&AndroidBridge.isEngineReady()&&typeof AndroidBridge.isPondering==='function'){
  if(AndroidBridge.isPondering()){
    // Check if the player's move matches the ponder move
    const ponderMove=typeof AndroidBridge.getLastPonderMove==='function'?AndroidBridge.getLastPonderMove():null;
    const moveUCI=String.fromCharCode(97+from.col)+(8-from.row)+String.fromCharCode(97+to.col)+(8-to.row)+(promotion||'');
    if(ponderMove&&ponderMove===moveUCI){
      // Player played the expected move — hit ponder and continue analysis
      AndroidBridge.ponderHit();
    }else{
      // Player played a different move — stop pondering
      AndroidBridge.stopPonder();
    }
  }
}
// Clear stale ponder info — player's move invalidates previous ponder data
// FIX: Also update DOM immediately to prevent stale ponder info from lingering
// in #ai-ponder-info until the next render() call
// Increment _ponderGen to invalidate any in-flight onPonderProgress() callbacks
_ponderGen++;_ponderBarInfo='';_ponderMoveSAN='';_pendingPonderMoveUCI=null;
if(typeof _updateAIThinkDisplay==='function')_updateAIThinkDisplay();
// Clear Stockfish bridge emergency timer (move is being executed)
const piece=gameState.board[from.row][from.col];
if(piece&&piece.type==='pawn'&&!promotion){
const pr=piece.color==='white'?0:7;
if(to.row===pr){pendingPromotion={from,to,piece};render();return}
}
if(!piece)return;
// Defense-in-depth: only pawns can be promoted — discard spurious promotion
// from any source (e.g., corrupted UCI parsing, tablebase, etc.)
if(promotion&&piece.type!=='pawn')promotion=null;
stateHistory.push({state:cloneS(gameState),selectedSquare:selectedSquare?{...selectedSquare}:null,legalMvs:[...legalMvs],moveRecords:[...moveRecords],lastMove:lastMove?{...lastMove}:null,gameOver});
if(stateHistory.length>200)stateHistory.shift();
const mv={from,to,piece,promotion};
const ns=makeMv(gameState,mv);const notation=moveAlg(gameState,mv,ns);
const opp=OPP_COLOR[piece.color];const ic=inCheck(ns.board,opp,opp==='white'?ns.wk:ns.bk);const cast=piece.type==='king'&&Math.abs(to.col-from.col)===2;
const epCap=piece.type==='pawn'&&gameState.enPassantTarget&&to.row===gameState.enPassantTarget.row&&to.col===gameState.enPassantTarget.col;
const _elapsed=((Date.now()-_turnStartTime)/1000).toFixed(1);moveRecords.push({notation,from:posAlg(from),to:posAlg(to),piece,captured:gameState.board[to.row][to.col]||(epCap?gameState.board[piece.color==='white'?to.row+1:to.row-1][to.col]:undefined),isCheck:ic,isCastling:cast,promotion:promotion||null,time:_elapsed});_turnStartTime=Date.now();
if(cast)playSound('castle');else if(promotion)playSound('promote');else if(ic){playSound('check');HapticManager.fire('CHECK_ALERT');}else if(gameState.board[to.row][to.col]||epCap){playSound('capture');HapticManager.fire('PIECE_CAPTURE');}else{playSound('move');HapticManager.fire('PIECE_MOVE');}
animateMove(from,to,SYM[piece.color][piece.type],piece.type,!!(gameState.board[to.row][to.col]||epCap),ic,piece.color);gameState=ns;_cachedStatus=null;_cachedStatusKey='';lastMove={from,to};selectedSquare=null;legalMvs=[];legalSet=new Set();
// Immediately mark eval as stale — show "分析中" until engine gives final evaluation
_updateEvalDisplay(); // _resetEvalState now called inside requestEngineEval()

// Heavy computation deferred until after animation completes
setTimeout(()=>{
const gsr=!setupMode&&gameStatus(gameState);
const _gsKey=gameState.hash+'|'+gameState.currentTurn;_cachedStatus=gsr;_cachedStatusKey=_gsKey;
if(gsr&&!gameOver){
gameOverSoundPlayed=false;_applyGameOver(gsr);
requestAnimationFrame(()=>{updateAfterMove();if(!gameOver&&gameState.currentTurn!==playerColor){doAIMove();}});
}},420);
}catch(e){console.error('executeMove error:',e)}}
let _redoStack=[]; // Stack for redo (stores states pushed by undoMove)
// P3: Common animation cleanup for undo/redo/flip operations
function _clearAnimationState(){
  animationInProgress=false;_landingAnimActive=false;
  _lastAnimPieceType='';_lastAnimTarget=null;
  if(_landingAnimTimer){clearTimeout(_landingAnimTimer);_landingAnimTimer=null;}
  if(_fullRenderTimer){clearTimeout(_fullRenderTimer);_fullRenderTimer=0;}
}
function undoMove(){
if(isAIThinking&&!setupMode)return;_cachedStatus=null;_cachedStatusKey='';_updateEvalDisplay(); // _resetEvalState now inside requestEngineEval()
_clearAnimationState();
if(pendingPromotion)pendingPromotion=null;
let steps=0;
// Track the from-position of the player's move being undone.
// After the undo loop, we select the piece at its original (pre-move) position
// so the user can see legal moves from there and potentially replay differently.
let _playerMoveFrom=null;
while(stateHistory.length>0&&steps<3){
const prev=stateHistory.pop();
// Validate prev before using it — if invalid, push back and stop
if(!prev||!prev.state){
  console.error('undoMove: invalid stateHistory entry, stopping undo');
  // Push back the invalid entry to prevent data loss
  if(prev)stateHistory.push(prev);
  break;
}
// Push current state to redo stack BEFORE restoring
_redoStack.push({state:cloneS(gameState),moveRecords:[...moveRecords],lastMove:lastMove?{...lastMove}:null});
gameState=prev.state;
if(prev.lastMove&&prev.lastMove.from){
  const fromRow=prev.lastMove.from.row,fromCol=prev.lastMove.from.col;
  const pieceAtFrom=gameState.board[fromRow]&&gameState.board[fromRow][fromCol];
  if(pieceAtFrom&&pieceAtFrom.color===playerColor){
    _playerMoveFrom={row:fromRow,col:fromCol};
  }
}
moveRecords=prev.moveRecords||[];lastMove=prev.lastMove;gameOver=null;_gameOverStatusKey=null;gameOverSoundPlayed=false;
steps++;
if(gameState.currentTurn===playerColor)break;
}
// After undo, select the piece at the player's original (from) position.
// This is the position the piece was at BEFORE the player moved it, so the user
// can see its legal moves and potentially make a different move.
if(_playerMoveFrom&&!gameOver){
  const tp=gameState.board[_playerMoveFrom.row]&&gameState.board[_playerMoveFrom.row][_playerMoveFrom.col];
  if(tp&&tp.color===playerColor){
    selectedSquare={row:_playerMoveFrom.row,col:_playerMoveFrom.col};
    legalMvs=legalMoves(gameState,selectedSquare);legalSet=new Set(legalMvs.map(m=>m.row*8+m.col));
  }else{
    selectedSquare=null;legalMvs=[];legalSet=new Set();
  }
}else if(lastMove&&lastMove.to&&!gameOver){
  // Fallback: if no player from-position was found, select the piece at lastMove.to
  const tp=gameState.board[lastMove.to.row]&&gameState.board[lastMove.to.row][lastMove.to.col];
  if(tp&&tp.color===playerColor){
    selectedSquare={row:lastMove.to.row,col:lastMove.to.col};
    legalMvs=legalMoves(gameState,selectedSquare);legalSet=new Set(legalMvs.map(m=>m.row*8+m.col));
  }else{
    selectedSquare=null;legalMvs=[];legalSet=new Set();
  }
}else{
  selectedSquare=null;legalMvs=[];legalSet=new Set();
}
render();requestEngineEval();if(!gameOver&&!setupMode&&gameState.currentTurn!==playerColor){doAIMove();}}
function redoMove(){
if(isAIThinking||_redoStack.length===0)return;
_cachedStatus=null;_cachedStatusKey='';_updateEvalDisplay(); // _resetEvalState now inside requestEngineEval()
_clearAnimationState();
// Pop from redo stack and restore
const nxt=_redoStack.pop();
// Validate redo entry before using it
if(!nxt||!nxt.state){
  console.error('redoMove: invalid redoStack entry, discarding');
  render();return;
}
// Save current state to history so we can undo again
stateHistory.push({state:cloneS(gameState),moveRecords:[...moveRecords],lastMove:lastMove?{...lastMove}:null,selectedSquare:null});
gameState=nxt.state;
// Preserve selectedSquare after redo
if(selectedSquare){
  const sp=gameState.board[selectedSquare.row][selectedSquare.col];
  if(sp&&sp.color===playerColor&&!gameOver){
    legalMvs=legalMoves(gameState,selectedSquare);legalSet=new Set(legalMvs.map(m=>m.row*8+m.col));
  }else{
    selectedSquare=null;legalMvs=[];legalSet=new Set();
  }
}else{legalMvs=[];legalSet=new Set();}
moveRecords=nxt.moveRecords;lastMove=nxt.lastMove;gameOver=null;_gameOverStatusKey=null;gameOverSoundPlayed=false;
render();requestEngineEval();if(!gameOver&&!setupMode&&gameState.currentTurn!==playerColor){doAIMove();}}
// === Flip board: switch player perspective ===
function flipBoard(){
  playerColor=OPP_COLOR[playerColor];
  selectedSquare=null;legalMvs=[];legalSet=new Set();
  _cachedBwrap=null;
  render();
  requestEngineEval();
  // If after flip it's AI's turn, trigger AI move
  if(!gameOver&&!setupMode&&!isAIThinking&&gameState.currentTurn!==playerColor){doAIMove();}
  showToast(playerColor==='white'?T('view_white'):T('view_black'));
}
// === Quick free opening: start new game with current color, no opening ===
function quickFreeOpening(){
  if(isAIThinking)return;
  showNewGameDialog=false;
  dlgPlayerColor=playerColor;
  dlgOpeningId=null;
  dlgBookMoves=useBookMoves;
  startGame();
  showToast(T('new_game_free'));
}
// === Toggle sound on/off (toolbar button) ===
function toggleSound(){
  soundOn=!soundOn;
  const btn=document.getElementById('btnSound');
  if(btn)btn.innerHTML=soundOn?'<span style=\"font-size:1.4rem\">🔊</span> '+T('sound'):'<span style=\"font-size:1.4rem\">🔇</span> '+T('sound');
  HapticManager.fire(soundOn?'TOGGLE_ON':'TOGGLE_OFF');
  showToast(soundOn?T('sound_on'):T('sound_off'),1200);
}
function doPromotion(type){if(pendingPromotion){try{executeMove(pendingPromotion.from,pendingPromotion.to,type);}finally{pendingPromotion=null;render();}}}
function getHint(){
  if(gameOver||isAIThinking||reviewMode||gameState.currentTurn!==playerColor)return;
  if(!_engineReady){showToast(T('engine_not_ready'));return;}
  isHintLoading=true;hintText='';_aiBarInfo='';aiThinkInfo=T('thinking');_hintBarInfo=T('thinking');
  // Clear stale ponder info when starting a new hint search
  _ponderGen++;_ponderBarInfo='';_ponderMoveSAN='';_pendingPonderMoveUCI=null;
  // Clear previous MultiPV data
  _multiPVLines=[];_multiPVResult=null;
  _updateAIThinkDisplay();
  render();
  setTimeout(()=>{
    if(typeof AndroidBridge!=='undefined'&&AndroidBridge.isEngineReady()){
      try{AndroidBridge.engineHint(generateFEN(gameState));}catch(e){console.error('engineHint error:',e);isHintLoading=false;_hintBarInfo='';hintText=T('hint_request_failed');render();}
      return;
    }
    isHintLoading=false;hintText=T('engine_unavailable_hint');
    render();
  },10);
}
function toggleSetup(){if(isAIThinking&&!setupMode)return;_cachedStatus=null;_cachedStatusKey='';setupMode=!setupMode;if(setupMode){setupPiece='pawn';setupColor='white';selectedSquare=null;legalMvs=[];legalSet=new Set();gameOver=null;_gameOverStatusKey=null;lastMove=null;gameOverSoundPlayed=false;setupErrors=[];setupHistory=[]}else{gameOver=null;_gameOverStatusKey=null;if(gameState.wk&&gameState.bk){_applyGameOver();}_sfEvalReady=false;_evalLoading=true;requestEngineEval();if(!gameOver&&gameState.currentTurn!==playerColor){doAIMove()}}render()}
function exitSetup(){setupErrors=validateSetupPosition(gameState);if(setupErrors.length>0){render();return}// When finishing setup mode, reset the game to use the setup position
// as the new starting position (step 0). This means:
// - moveRecords is cleared (no move history from before setup)
// - stateHistory is reset with the setup position as the initial state
// - reviewBaseState is set to the setup position
// - lastMove is cleared
// - _redoStack is cleared
// This ensures the user starts fresh from the setup position.
moveRecords=[];
stateHistory=[{state:cloneS(gameState),selectedSquare:null,legalMvs:[],moveRecords:[],lastMove:null,gameOver:null}];
lastMove=null;
_redoStack=[];
gameOver=null;_gameOverStatusKey=null;
gameOverSoundPlayed=false;
_ecoEnabled=false; // Setup mode — disable ECO recognition
reviewBaseState=cloneS(gameState);
_reviewEvalCache.clear();_reviewEvalRequestedStep=-1; // Clear eval cache on board setup complete
toggleSetup()}
function setupClick(r,c){
if(!setupMode||isAIThinking)return;
HapticManager.fire('PIECE_SELECT');
// Save snapshot before each modification for undo
setupRedoStack=[];setupHistory.push({board:gameState.board.map(row=>row.map(cell=>cell?{...cell}:null)),wk:gameState.wk?{...gameState.wk}:null,bk:gameState.bk?{...gameState.bk}:null,castlingRights:{...gameState.castlingRights},currentTurn:gameState.currentTurn,hash:gameState.hash});if(setupHistory.length>50)setupHistory.shift();
if(setupPiece==='delete'){
if(gameState.board[r][c]&&gameState.board[r][c].type==='king'){
if(gameState.board[r][c].color==='white')gameState.wk=null;
else gameState.bk=null;
}
gameState.board[r][c]=null;_refreshStateAfterSetup(gameState);render();return
}
if(setupPiece){
if(setupPiece==='king'){
// Remove existing king of same color before placing new one
if(setupColor==='white'&&gameState.wk){gameState.board[gameState.wk.row][gameState.wk.col]=null;gameState.wk=null}
else if(setupColor==='black'&&gameState.bk){gameState.board[gameState.bk.row][gameState.bk.col]=null;gameState.bk=null}
}
gameState.board[r][c]={type:setupPiece,color:setupColor};
if(setupPiece==='king'){
if(setupColor==='white')gameState.wk={row:r,col:c};
else gameState.bk={row:r,col:c};
}
_refreshStateAfterSetup(gameState);render()
}}
function undoSetupClick(){
if(!setupMode||setupHistory.length===0)return;
// Save current state to redo stack before undoing
var _curSnap={board:gameState.board.map(r=>r.map(c=>c?{...c}:null)),wk:gameState.wk?{...gameState.wk}:null,bk:gameState.bk?{...gameState.bk}:null,castlingRights:{...gameState.castlingRights},currentTurn:gameState.currentTurn,hash:gameState.hash};
setupRedoStack.push(_curSnap);if(setupRedoStack.length>50)setupRedoStack.shift();
const snap=setupHistory.pop();
gameState.board=snap.board;gameState.wk=snap.wk;gameState.bk=snap.bk;gameState.castlingRights=snap.castlingRights;gameState.currentTurn=snap.currentTurn;
_refreshStateAfterSetup(gameState);
render();
}
function redoSetupClick(){if(!setupMode||setupRedoStack.length===0)return;const snap=setupRedoStack.pop();setupHistory.push({board:gameState.board.map(r=>r.map(c=>c?{...c}:null)),wk:gameState.wk?{...gameState.wk}:null,bk:gameState.bk?{...gameState.bk}:null,castlingRights:{...gameState.castlingRights},currentTurn:gameState.currentTurn,hash:gameState.hash});if(setupHistory.length>50)setupHistory.shift();gameState.board=snap.board.map(r=>r.map(c=>c?{type:c.type,color:c.color}:null));gameState.wk=snap.wk?{...snap.wk}:null;gameState.bk=snap.bk?{...snap.bk}:null;gameState.castlingRights={...snap.castlingRights};gameState.currentTurn=snap.currentTurn;gameState.hash=snap.hash;setupErrors=[];render();}

/**
 * Enter review mode — replay all moves and prepare review states.
 * @side-effect Sets reviewMode=true, populates reviewStates, requests engine eval
 */
function enterReview(){_cachedStatus=null;_cachedStatusKey='';
if(moveRecords.length===0)return;
// Save a complete snapshot of the game state before entering review mode.
// exitReview() will restore from this snapshot so the player returns to the
// exact position they were at (not the initial position).
_preReviewSnapshot={
  gameState:cloneS(gameState),
  moveRecords:moveRecords.map(function(r){const c=Object.assign({},r);if(r.variations)c.variations=r.variations.map(function(v){return Object.assign({},v);});return c;}),
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
// FIX: Defensive fallback — if reviewBaseState was lost (e.g., startGame()
// threw before setting it), use the current gameState as a best-effort basis.
// This allows review even when the initial state snapshot is missing.
if(!reviewBaseState){
  if(stateHistory.length>0&&stateHistory[0].state){
    // Oldest snapshot in stateHistory is closest to the initial state
    reviewBaseState=cloneS(stateHistory[0].state);
    console.warn('enterReview: reviewBaseState was null, recovered from stateHistory[0]');
  }else if(stateHistory.length>0&&stateHistory[0].board){
    // Legacy format: stateHistory[0] is a raw gameState object (no .state wrapper)
    reviewBaseState=cloneS(stateHistory[0]);
    console.warn('enterReview: reviewBaseState was null, recovered from stateHistory[0] (raw format)');
  }else{
    reviewBaseState=cloneS(gameState);
    console.warn('enterReview: reviewBaseState was null, using current gameState as fallback');
  }
}
reviewMode=true;reviewStates=[];
_reviewEvalRequestedStep=-1; // Preserve _reviewEvalCache across review sessions
let s=reviewBaseState?cloneS(reviewBaseState):cloneS(gameState);
reviewStates.push({state:cloneS(s),lastMove:null});
for(let i=0;i<moveRecords.length;i++){
const mr=moveRecords[i];
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
  reviewStates.push({state:s,lastMove:null});
  continue;}
const piece=s.board[from.row][from.col];
if(piece){
  // Ensure promotion field is properly handled
  const promotion=(mr.promotion&&mr.promotion!=='null')?mr.promotion:null;
  s=makeMv(s,{from,to,piece,promotion});reviewStates.push({state:s,lastMove:{from,to}});
}else{console.error('enterReview: no piece at',mr.from,'for move',i,mr);
  // Bug 1 fix: Push placeholder to keep reviewStates indices aligned with moveRecords
  reviewStates.push({state:s,lastMove:null});
}
}
reviewStep=reviewStates.length-1;
// FIX: Stop any ongoing ponder before entering review mode.
// When entering review right after the AI makes a move, the engine might still
// be pondering. The eval request sends "stop" then "position fen X" then "go depth 22",
// but the ponder search's bestmove response (from the "stop") may interfere with
// the eval search. Stopping ponder explicitly prevents this race condition.
try{
  if(typeof AndroidBridge!=='undefined'&&typeof AndroidBridge.isPondering==='function'&&AndroidBridge.isPondering()){
    if(typeof AndroidBridge.stopPonder==='function')AndroidBridge.stopPonder();
  }
}catch(e){}
_ponderGen++;_ponderMoveSAN='';_ponderBarInfo='';_pendingPonderMoveUCI=null;
if(typeof _updateAIThinkDisplay==='function')_updateAIThinkDisplay();
reviewCritical=_findCriticalMoves();requestEngineEval();render(); // _resetEvalState now inside requestEngineEval()
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
    const ev=_reviewEvalCache.get(i);
    const prevEv=_reviewEvalCache.get(i-1);
    if(ev!=null&&prevEv!=null){
      const delta=ev.eval-prevEv.eval;
      const isMoverWhite=((i)%2)===1; // step is odd → White moved
      const moverDelta=isMoverWhite?delta:-delta;
      const ad=Math.abs(moverDelta);
      if(moverDelta<-300){
        const cls=_classifyMove(delta,isMoverWhite);
        critical.push({step:i,reason:cls.label+' ('+(moverDelta/100).toFixed(1)+')'});
      }else if(moverDelta>300){
        const cls=_classifyMove(delta,isMoverWhite);
        critical.push({step:i,reason:cls.label+' ('+(moverDelta>0?'+':'')+(moverDelta/100).toFixed(1)+')'});
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
 * Start a new game based on dialog settings.
 * Called from the new game dialog button "开始游戏".
 */
function startGame(){
  showNewGameDialog=false;
  playerColor=dlgPlayerColor;
  useBookMoves=dlgBookMoves;
  _ecoEnabled=true; // Free opening or ECO-selected — enable ECO recognition
  gameState=initState();
  stateHistory=[{state:cloneS(gameState),selectedSquare:null,legalMvs:[],moveRecords:[],lastMove:null,gameOver:null}];
  moveRecords=[];
  gameOver=null;_gameOverStatusKey=null;
  // If an opening is selected, apply ECO opening moves
  // dlgOpeningId format: "A00|Van Geet Opening" — parse ECO code + name,
  // look up the opening object from ECO_BY_ID, then iterate its moves array
  // (coordinate format: [fromRow, fromCol, toRow, toCol, ...]) and apply each move.
  if(dlgOpeningId){
    _ensureEcoParsed();
    const pipeIdx=dlgOpeningId.indexOf('|');
    const ecoCode=pipeIdx>=0?dlgOpeningId.substring(0,pipeIdx):dlgOpeningId;
    const ecoName=pipeIdx>=0?dlgOpeningId.substring(pipeIdx+1):'';
    // Find the specific opening variant by code + name
    const opList=ECO_BY_ID[ecoCode];
    if(opList&&opList.length>0){
      let opening=null;
      for(const op of opList){
        if(op.name===ecoName){opening=op;break;}
      }
      // Fallback: if exact name not found, use first variant with that code
      if(!opening)opening=opList[0];
      // Apply all moves from the opening's coordinate array
      const mv=opening.moves;
      for(let i=0;i+3<mv.length;i+=4){
        const from={row:mv[i],col:mv[i+1]};
        const to={row:mv[i+2],col:mv[i+3]};
        const piece=gameState.board[from.row]?gameState.board[from.row][from.col]:null;
        if(piece){
          const moveObj={from:from,to:to,piece:piece};
          gameState=makeMv(gameState,moveObj);
        }else{
          console.warn('[startGame] ECO move #'+(i/4+1)+' invalid at',from,'— skipping remaining moves');
          break;
        }
      }
    }else{
      console.warn('[startGame] ECO code not found:',ecoCode);
    }
  }
  _needNewGameForEngine=true;
  reviewBaseState=cloneS(gameState);
  _reviewEvalCache.clear();_reviewEvalRequestedStep=-1; // Clear eval cache on new game
  _resetGameUIState();
  _resetEvalState();
  render();
  requestEngineEval();
  if(gameState.currentTurn!==playerColor){
    doAIMove();
  }
}

/**
 * Reset all game UI state variables.
 * Called from startGame(), exitReview(), and tablebase.js importFEN().
 */
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
  animationInProgress=false;
  _landingAnimActive=false;
  if(_landingAnimTimer){clearTimeout(_landingAnimTimer);_landingAnimTimer=null;}
  _cachedStatus=null;
  _cachedStatusKey='';
  cachedCtrlKey='';
  if(renderTimerId){cancelAnimationFrame(renderTimerId);renderTimerId=null;}
  renderPending=false;
  // Clear redo stack on game reset to prevent stale redo entries
  // from corrupting gameState when redoMove() is called after a new game.
  _redoStack=[];
}

/**
 * Navigate to a specific review step.
 * @param {number} step - The review step index to navigate to
 */
function reviewGoTo(step){
  if(!reviewMode||!reviewStates||reviewStates.length===0)return;
  step=Math.max(0,Math.min(step,reviewStates.length-1));
  reviewStep=step;
  gameState=cloneS(reviewStates[reviewStep].state);
  // Update eval display from cache if available
  const cached=_reviewEvalCache.get(reviewStep);
  if(cached!=null){
    _sfEval=cached.eval;_sfMateDistance=cached.mate!=null?cached.mate:0;
    _sfWdlW=cached.wdlW!=null?cached.wdlW:-1;_sfWdlD=cached.wdlD!=null?cached.wdlD:-1;_sfWdlL=cached.wdlL!=null?cached.wdlL:-1;
    _sfDepth=cached.depth!=null?cached.depth:0;_sfEvalReady=true;_evalLoading=false;
  }else{
    _resetEvalState();
    // FIX: Auto-start analysis when selecting an unanalyzed move in review mode.
    // Previously, selecting an unanalyzed step would show "分析中" but never actually
    // request the engine eval. The user had to manually trigger analysis.
    // Now we immediately request engine evaluation for the selected step.
    requestEngineEval();
  }
  render();
  // Scroll the active move into view — must wait for render() DOM rebuild
  setTimeout(function(){
    try{
      const listEl=document.getElementById('reviewMovesList');
      if(!listEl)return;
      const activeEl=listEl.querySelector('.rmv-block.act');
      if(activeEl)activeEl.scrollIntoView({block:'center',behavior:'instant'});
    }catch(e){}
  },50);
}

/**
 * Analyze all steps in review mode using engine evaluation.
 * Uses callback-driven approach: requests eval for one step, advances on completion.
 */
function reviewAnalyzeAll(){
  if(!reviewMode||!reviewStates||reviewStates.length===0)return;
  _reviewAnalyzeAllActive=true;
  // Save the step the user was on so we can return to it after analysis
  let _preAnalyzeStep=reviewStep;
  // Find first un-analyzed step (skip cached steps for efficiency)
  let startStep=0;
  for(let i=0;i<reviewStates.length;i++){
    if(!_reviewEvalCache.has(i)){startStep=i;break;}
    if(i===reviewStates.length-1)startStep=0; // All cached — re-analyze from start
  }
  reviewStep=startStep;
  gameState=cloneS(reviewStates[reviewStep].state);
  // Set safety timeout to prevent infinite hang if engine stops responding
  // during batch analysis. Clears any previous safety timer first.
  if(_reviewAnalyzeSafetyTimer){clearTimeout(_reviewAnalyzeSafetyTimer);}
  _reviewAnalyzeSafetyTimer=setTimeout(function(){
    if(_reviewAnalyzeAllActive){
      _reviewAnalyzeAllActive=false;
      showToast(T('analysis_timeout'));
    }
    _reviewAnalyzeSafetyTimer=null;
  },Math.min(reviewStates.length*8000,300000)); // 8s per step max, capped at 5 minutes total
  // Store pre-analyze step for restoration on completion
  window._reviewAnalyzeReturnStep=_preAnalyzeStep;
  showToast(T('analyzing_all')+' (0/'+reviewStates.length+')');
  render();
  requestEngineEval();
}

/**
 * Advance to the next review step during analyze-all.
 * Called from onEngineEval when _reviewAnalyzeAllActive is true.
 */
function _reviewAnalyzeAdvance(){
  if(!_reviewAnalyzeAllActive)return;
  // Skip already-cached steps for efficiency
  let nextStep=reviewStep+1;
  while(nextStep<reviewStates.length){
    if(!_reviewEvalCache.has(nextStep))break; // Found un-analyzed step
    nextStep++;
  }
  if(nextStep>=reviewStates.length){
    _reviewAnalyzeAllActive=false;
    if(_reviewAnalyzeSafetyTimer){clearTimeout(_reviewAnalyzeSafetyTimer);_reviewAnalyzeSafetyTimer=null;}
    // Return to the step the user was viewing before analysis
    const returnStep=window._reviewAnalyzeReturnStep;
    if(typeof returnStep==='number'&&returnStep>=0&&returnStep<reviewStates.length){
      reviewStep=returnStep;
      gameState=cloneS(reviewStates[reviewStep].state);
    }
    showToast(T('analysis_done')+' '+reviewStates.length+' '+T('step'));
    render();
    return;
  }
  reviewStep=nextStep;
  gameState=cloneS(reviewStates[reviewStep].state);
  // Update progress toast periodically (every 3 steps or at end)
  if(reviewStep%3===0||nextStep>=reviewStates.length-1){
    const cachedCount=_reviewEvalCache.size;
    showToast(T('analyzing_progress')+' ('+cachedCount+'/'+reviewStates.length+')');
  }
  render();
  requestEngineEval();
}

/**
 * Exit review mode and restore the game state.
 */
function exitReview(){
  reviewMode=false;
  _reviewAnalyzeAllActive=false;
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

/**
 * Handle Android back button press.
 * Closes open dialogs/overlays, exits review/setup modes.
 */
function handleBackPress(){
  if(showEngineConfig){
    showEngineConfig=false;
    render();
    return;
  }
  if(showNewGameDialog){
    showNewGameDialog=false;
    render();
    return;
  }
  if(showAboutPage){
    showAboutPage=false;
    render();
    return;
  }
  if(showImportDialog){
    showImportDialog=false;
    render();
    return;
  }
  // File browser: Android back button navigates up one directory level
  // or closes the browser if already at root
  const fileBrowserOverlay=document.getElementById('_fileBrowserOverlay');
  if(fileBrowserOverlay){
    if(typeof _fileBrowserHandleBack==='function'){
      _fileBrowserHandleBack();
    }
    return;
  }
  if(reviewMode){
    exitReview();
    return;
  }
  if(setupMode){
    exitSetup();
    return;
  }
  // No action — could show exit confirmation in the future
}

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
  if(_landingAnimTimer){clearTimeout(_landingAnimTimer);_landingAnimTimer=null;}
  if(_fullRenderTimer){clearTimeout(_fullRenderTimer);_fullRenderTimer=0;}
  if(_reviewAnalyzeSafetyTimer){clearTimeout(_reviewAnalyzeSafetyTimer);_reviewAnalyzeSafetyTimer=null;}
  if(_reviewEvalDebounceTimer){clearTimeout(_reviewEvalDebounceTimer);_reviewEvalDebounceTimer=null;}
  if(_aiSafetyTimerId){clearTimeout(_aiSafetyTimerId);_aiSafetyTimerId=null;}
  // FIX: Clean up notification throttle timer to prevent callback after context destruction
  if(typeof _notificationThrottleTimer!=='undefined'&&_notificationThrottleTimer){clearTimeout(_notificationThrottleTimer);_notificationThrottleTimer=0;}
  renderPending=false;
}

// Paste PGN from clipboard — uses prompt() for simplicity
function _doPastePGN(){
  const text=prompt(T('pgn_paste_hint'));
  if(!text)return;
  // PGN-only: reject FEN input — FEN should be imported via the "Paste FEN" button instead
  const trimmed=text.trim();
  // Bug 5 fix: Improved FEN rejection heuristic.
  // Check for PGN-specific markers first (move numbers with dots, header tags, variations).
  // Only reject as FEN if it lacks ALL PGN markers AND looks like a FEN string.
  const hasPGNMoveNumbers=!!trimmed.match(/\d+\.\s*[a-zA-ZNBRQOKO]/);
  const hasPGNHeaders=/\[/.test(trimmed);
  const hasPGNVariations=/\(/.test(trimmed);
  const hasPGNMarkers=hasPGNMoveNumbers||hasPGNHeaders||hasPGNVariations;
  // A FEN has exactly one line with 8 ranks separated by '/', no PGN markers
  const isLikelyFEN=!hasPGNMarkers&&trimmed.includes('/')&&
    (trimmed.split('\n').length<=2)&& // FEN is typically single-line
    trimmed.split('/').length>=8; // 8 ranks
  if(fenToState(trimmed)||isLikelyFEN){
    showToast(T('pgn_fen_rejected'),2500);
    return;
  }
  importPGN(text);
}

// ---- Exports ----
export {render,markDirty,sqClick,executeMove,undoMove,redoMove,flipBoard,quickFreeOpening,toggleSound,doPromotion,getHint,toggleSetup,exitSetup,setupClick,enterReview,reviewGoTo,reviewAnalyzeAll,exitReview,startGame,_resetGameUIState,doAIMove,_requestStockfishMove,_buildEvalTrendSVG,handleBackPress,_startEngineHeartbeat,_cleanupEventListeners,_reviewAnalyzeAdvance,_doPastePGN};
