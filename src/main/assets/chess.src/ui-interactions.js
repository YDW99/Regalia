// ===================== MODULE: ui-interactions =====================
// Board click handling (sqClick/setupClick & helpers), move execution &
// undo/redo (executeMove/_clearAnimationState/undoMove/redoMove), toolbar
// actions (flipBoard/quickFreeOpening/toggleSound/doPromotion/getHint/
// setDifficultyLevel), setup-mode entry/exit (toggleSetup/exitSetup/
// _exitSetupImpl), PGN-save prompt chain (_withPGNSaveCheck/_savePGNYes/
// _savePGNNo/_savePGNCancel), back-press routing (handleBackPress), import
// wrappers (_doPastePGN/_importFENWithSaveCheck/_importPGNFileWithSaveCheck),
// player rename & stats-import prompt (_renameHumanPlayer/
// _showStatsImportBackPrompt) and resign (_resignGame).
// Depends on: game-logic, ai-bridge, ui (globals).
//
// Copyright (C) 2026 Regalia
//
// UI interaction patterns derived from DroidFish
// (Copyright (C) Peter Österlund, GPL v3)
// Modified by Regalia on 2026-06-15
//
// AI-GEN: AI assisted + DroidFish source code logic reference
// This code was AI-assisted and has been reviewed for GPL v3 compliance.
//
// v1.2.3 (God Class refactor round-17): extracted verbatim from ui.js to slim
//   the God Class. Same global-scope module pattern as the other chess.src
//   modules — all functions remain top-level globals; build-chess.py
//   concatenates the modules in MODULES order and strips the export statement
//   for the bundle. No behavior change intended: every function body is moved
//   verbatim.
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
// ============================================================================

// Regalia Chess — User interactions (ui-interactions.js)

// v1.2.3 round-23 (Q3 fix): clock snapshot helpers for stateHistory/redoStack.
//   gameClocks is a global from ui-gameflow.js (typeof guard follows the
//   round-11 cross-module defensive pattern). Returns a deep-ish copy of the
//   per-side clock state (remainingSec/displayRemainingSec/lastMoveTimestamp
//   + the type/baseSec/increment/delay fields) so undo/redo can restore it
//   exactly. v1.2.3 round-28: added baseSec to the snapshot (was missing —
//   only mattered for PGN [TimeControl] tag which reads gameClocks.baseSec,
//   but restoring it keeps the snapshot complete).
function _snapshotClocks(){
  if(typeof gameClocks==='undefined'||!gameClocks)return null;
  return {
    type:gameClocks.type,
    baseSec:gameClocks.baseSec||0,
    incrementSec:gameClocks.incrementSec||0,
    delaySec:gameClocks.delaySec||0,
    white:{
      remainingSec:gameClocks.white.remainingSec,
      displayRemainingSec:gameClocks.white.displayRemainingSec,
      lastMoveTimestamp:gameClocks.white.lastMoveTimestamp
    },
    black:{
      remainingSec:gameClocks.black.remainingSec,
      displayRemainingSec:gameClocks.black.displayRemainingSec,
      lastMoveTimestamp:gameClocks.black.lastMoveTimestamp
    }
  };
}
// Restore clocks from a snapshot, rebasing lastMoveTimestamp to Date.now()
//   so the resumed clock doesn't immediately deduct the elapsed wall-clock
//   time between snapshot and restore. Also clears gameClockExpired and
//   restarts the tick interval (initGameClocks is idempotent — it clears
//   any prior interval before starting a new one).
function _restoreClocks(snap){
  if(!snap){
    // No snapshot (pre-round-23 history entry or no clock game) — leave
    // gameClocks untouched.
    return;
  }
  if(typeof gameClocks==='undefined'||!gameClocks){
    // Clocks were torn down (e.g. between games); don't reinitialize.
    return;
  }
  const now=Date.now();
  gameClocks.type=snap.type;
  if(snap.baseSec!==undefined)gameClocks.baseSec=snap.baseSec;
  gameClocks.incrementSec=snap.incrementSec||0;
  gameClocks.delaySec=snap.delaySec||0;
  gameClocks.white.remainingSec=snap.white.remainingSec;
  gameClocks.white.displayRemainingSec=snap.white.displayRemainingSec;
  gameClocks.white.lastMoveTimestamp=now;
  gameClocks.black.remainingSec=snap.black.remainingSec;
  gameClocks.black.displayRemainingSec=snap.black.displayRemainingSec;
  gameClocks.black.lastMoveTimestamp=now;
  // Clear any prior timeout state so the resumed clock can tick afresh.
  if(typeof gameClockExpired!=='undefined')gameClockExpired=null;
  // Restart the tick interval if the clock UI is active (gameClockTimerId
  // is owned by ui-gameflow.js). typeof guard — round-11 cross-module safety.
  if(typeof gameClockTimerId!=='undefined'){
    if(gameClockTimerId){clearInterval(gameClockTimerId);gameClockTimerId=null;}
    if(typeof initGameClocks==='function'&&!gameOver){
      initGameClocks();
    }
  }
  if(typeof _updateClockDisplay==='function')_updateClockDisplay();
}

function sqClick(r,c){
if(animationInProgress)return;
// v1.0.5 Round-6 Rev49: if a long-press just fired (toggling stabilization),
// suppress this click so the square doesn't also get selected/deselected.
if(window._suppressNextBoardClick){
  window._suppressNextBoardClick=false;
  return;
}
if(setupMode){setupClick(r,c);return}
const pos={row:r,col:c};const p=gameState.board[r][c];
const canMove=!gameOver&&!isAIThinking&&!pendingPromotion&&!reviewMode&&gameState.currentTurn===playerColor;
// v1.0.6 NEW: King-then-rook castling gesture.
// When the user has selected a king that can castle, the castling-capable
// rooks are visually marked (see _getCastlingRookSquares() below). Clicking
// a marked rook triggers the castling move directly — this is essential for
// Chess960 where some positions can ONLY be castled this way (e.g. when the
// king's destination square is the same as the rook's source square, the
// standard "click the king's destination" gesture is ambiguous).
if(selectedSquare&&canMove){
  const _selPiece=gameState.board[selectedSquare.row]&&gameState.board[selectedSquare.row][selectedSquare.col];
  if(_selPiece?.type==='king'&&_selPiece.color===playerColor){
    // Check if the clicked square is a castling rook for the selected king.
    const _cr=_getCastlingRookForClick(selectedSquare,{row:r,col:c});
    if(_cr){
      // Trigger the castling move: king goes to col 6 (kingside) or col 2 (queenside).
      const _kingToCol=_cr.side==='kingside'?6:2;
      const _kingTo={row:selectedSquare.row,col:_kingToCol};
      // Verify this is a legal move (defensive — _getCastlingRookForClick
      // already checked legality, but double-check here).
      if(legalSet.has(_kingTo.row*8+_kingTo.col)){
        executeMove(selectedSquare,_kingTo);
        return;
      }
    }
  }
}
// Toggle deselection — clicking the already-selected piece deselects it.
// Previously, clicking the selected piece would re-select it (same legalMvs, same highlight),
// making it impossible to deselect. This was especially problematic after AI hint auto-selection,
// where the user had no way to clear the selection highlight.
if(selectedSquare?.row===r&&selectedSquare.col===c){
  selectedSquare=null;legalMvs=[];legalSet=new Set();
  HapticManager.fire('BUTTON_PRESS');
  // v1.0.8 PHASE 22 supplement: deselect sound (下行短音)
  try{if(typeof playSound==='function')playSound('deselect');}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
  _updateBoardLightweight();return
}
if(selectedSquare&&canMove){
  const isLegal=legalSet.has(r*8+c);
  if(isLegal){
    const mp=gameState.board[selectedSquare.row][selectedSquare.col];
    if(mp?.type==='pawn'){
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
  if(p?.color===playerColor){
    selectedSquare=pos;legalMvs=legalMoves(gameState,pos);legalSet=new Set(legalMvs.map(m=>m.row*8+m.col));
    HapticManager.fire('PIECE_SELECT');
    // v1.0.8 PHASE 22 supplement: piece-select sound (清脆短音)
    try{if(typeof playSound==='function')playSound('select');}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
    _updateBoardLightweight();return
  }
  // Clicked empty/opponent square that's not a legal move → deselect old & select new
  selectedSquare=pos;legalMvs=[];legalSet=new Set();
  HapticManager.fire('BUTTON_PRESS');_updateBoardLightweight();return
}
// No piece currently selected — allow selecting own piece or any square for control info
if(canMove&&p?.color===playerColor){selectedSquare=pos;legalMvs=legalMoves(gameState,pos);legalSet=new Set(legalMvs.map(m=>m.row*8+m.col));HapticManager.fire('PIECE_SELECT');
  // v1.0.8 PHASE 22 supplement: piece-select sound (清脆短音)
  try{if(typeof playSound==='function')playSound('select');}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
  _updateBoardLightweight();return}
// Clicked empty/opponent square with no selection — allow for control info, but prefer deselect
if(selectedSquare){selectedSquare=null;legalMvs=[];legalSet=new Set();HapticManager.fire('BUTTON_PRESS');_updateBoardLightweight();return}
selectedSquare=pos;legalMvs=[];legalSet=new Set();HapticManager.fire('BUTTON_PRESS');_updateBoardLightweight();return
}

// v1.0.6 NEW: King-then-rook castling gesture helpers.
// When a king is selected and can castle, we identify the rook(s) that
// participate in castling. These rooks are visually marked (golden ring)
// so the user can click them to trigger castling — essential for Chess960
// positions where the king's castling destination is occupied by the rook.
// v1.0.6 CLEANUP: _getCastlingRookSquares() was removed (dead code after
// renderInternal switched to calling _computeCastlingRookSetForSelection
// directly). The .side field it returned was never used by any caller.
/**
 * Given a clicked square, returns the castling side ('kingside'|'queenside')
 * if the clicked square is a castling rook for the selected king. Null otherwise.
 */
function _getCastlingRookForClick(kingPos,clickedPos){
  if(!kingPos||!clickedPos||!gameState||!gameState.board)return null;
  try{
  const _p=gameState.board[kingPos.row]&&gameState.board[kingPos.row][kingPos.col];
  if(!_p||_p.type!=='king'||_p.color!==playerColor)return null;
  const _moves=legalMvs||[];
  for(const m of _moves){
    if(m?.castle){
      let rookCol=-1;
      if(gameVariant !== undefined&&gameVariant==='chess960'&&typeof chess960CastlingRookMove==='function'){
        try{
          const rm=chess960CastlingRookMove(gameState,_p.color,m.castle);
          if(rm)rookCol=rm.rookFrom;
        }catch(e){console.warn('[UI]',e?.message?e.message:e);}
      }else{
        rookCol=m.castle==='kingside'?7:0;
      }
      if(rookCol>=0&&clickedPos.row===kingPos.row&&clickedPos.col===rookCol){
        return {side:m.castle};
      }
    }
  }
  return null;
  }catch(e){return null;}
}

function executeMove(from,to,promotion){
try{
// Handle Ponder mode — if engine is pondering, check if the move matches the ponder move
if(typeof AndroidBridge!=='undefined'&&typeof AndroidBridge.isEngineReady==='function'&&AndroidBridge.isEngineReady()&&typeof AndroidBridge.isPondering==='function'){
  if(AndroidBridge.isPondering()){
    // v1.0.2 CRITICAL FIX (audit): getLastPonderMove() is a one-shot read that
    // CLEARS the Java field after returning. onBestMove() already consumed it
    // (ai-bridge.js:778) and stored the value in _lastPonderMoveFromEngine.
    // Re-calling getLastPonderMove() here always returned null → ponderHit()
    // never fired → every player move stopPonder()'d and started a fresh
    // search, defeating the entire ponder optimization.
    // Fix: use the JS-side cached value (_lastPonderMoveFromEngine) instead.
    const ponderMove=(typeof _lastPonderMoveFromEngine!=='undefined'&&_lastPonderMoveFromEngine)?_lastPonderMoveFromEngine:null;
    // v1.0.2 FIX: Map promotion piece-type names to UCI letters (q/r/b/n).
    // Previously this appended the full piece name (e.g., "e7e8queen") which
    // never matched the engine's UCI ponder move (e.g., "e7e8q"), so ponderHit
    // never fired for any promotion move — every promotion fell back to
    // stopPonder() + a fresh search, defeating the ponder optimization.
    const promoChar=promotion?{queen:'q',rook:'r',bishop:'b',knight:'n'}[promotion]||'':'';
    const moveUCI=String.fromCodePoint(97+from.col)+(8-from.row)+String.fromCodePoint(97+to.col)+(8-to.row)+promoChar;
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
if(piece?.type==='pawn'&&!promotion){
const pr=piece.color==='white'?0:7;
if(to.row===pr){pendingPromotion={from,to,piece};render();return}
}
if(!piece)return;
// Defense-in-depth: only pawns can be promoted — discard spurious promotion
// from any source (e.g., corrupted UCI parsing, tablebase, etc.)
if(promotion&&piece.type!=='pawn')promotion=null;
stateHistory.push({state:cloneS(gameState),selectedSquare:selectedSquare?{...selectedSquare}:null,legalMvs:[...legalMvs],moveRecords:[...moveRecords],lastMove:lastMove?{...lastMove}:null,gameOver,clocks:_snapshotClocks()});
if(stateHistory.length>200)stateHistory.shift();
// v1.0.6 FIX: Build mv with the castle flag preserved from legalMvs.
// Without this, makeMv/moveAlg/_castleSide cannot detect Chess960 castling
// where the king moves only 1 column (e.g. f1→g1). We look up the matching
// legal move (same from/to) and copy its castle flag. This is O(n) but n is
// small (max ~27 legal moves for a king) and executeMove is called at most
// once per user interaction.
const mv={from,to,piece,promotion};
if(piece.type==='king'){
  // v1.1.2 PHASE 71 (bug fix): Primary source of the castle flag is now
  // `to.castle` (set by uciToCoords when it rewrites Chess960 castling UCI
  // moves, and by pseudoMoves for user-click castling). This covers AI moves
  // where `legalMvs` is empty (cleared after the player's previous move) —
  // previously the legalMvs lookup failed silently and `mv.castle` was
  // undefined, causing `_castleSide` to fall back to the distance heuristic
  // which rejects 0-distance king moves (king already on g1/c1) → king nulled
  // in `makeMv`. The legalMvs lookup remains as a fallback for the case where
  // `to` is a plain {row,col} object without the castle flag.
  if(to?.castle){
    mv.castle=to.castle;
  }else{
    for(const _lm of (legalMvs||[])){
      if(_lm?.castle&&_lm.row===to.row&&_lm.col===to.col){
        mv.castle=_lm.castle;
        break;
      }
    }
  }
}
const ns=makeMv(gameState,mv);const notation=moveAlg(gameState,mv,ns);
// v1.0.6: Use _castleSide() for Chess960 correctness (king may move 1 col).
const opp=OPP_COLOR[piece.color];const ic=inCheck(ns.board,opp,opp==='white'?ns.wk:ns.bk);const cast=!!(typeof _castleSide==='function'&&_castleSide(mv));
const epCap=piece.type==='pawn'&&gameState.enPassantTarget&&to.row===gameState.enPassantTarget.row&&to.col===gameState.enPassantTarget.col;
const _elapsed=((Date.now()-_turnStartTime)/1000).toFixed(1);moveRecords.push({notation,from:posAlg(from),to:posAlg(to),piece,captured:gameState.board[to.row][to.col]||(epCap?gameState.board[piece.color==='white'?to.row+1:to.row-1][to.col]:undefined),isCheck:ic,isCastling:cast,promotion:promotion||null,time:_elapsed});_turnStartTime=Date.now();
// v1.0.4 EXPANSION (this round): commit the elapsed time to the moving side's clock.
// This applies Fischer increment / Bronstein-US-delay deduction rules.
if(typeof recordMoveEnd==='function')recordMoveEnd(piece.color);
// v1.0.4 EXPANSION (this round): compute and cache visual annotations
// ([%csl]/[%cal]) for this move. The cache key is the moveRecords index.
// Selection rules:
//   - Blue arrows: top piece→square control paths (e.g., knight to center)
//   - Red arrow: if this move gives check, the checker → checked king path
//   - Green arrows: the checked king's escape squares
//   - Yellow arrows: if this move threatens the opponent's queen, the mover → queen path
if(typeof _computeAndCacheVisualAnnotations==='function')_computeAndCacheVisualAnnotations(moveRecords.length-1);
// v1.0.8 PHASE 22: Sound dispatch — animateMove now triggers the per-piece
// personified sound (playPawn/playKnight/playBishop/playRook/playQueen/
// playKing), the capture sound (playCapture), and the castle rook-move
// sound (playCastleRookMove) internally via _playPieceSound() /
// _playCastleSound(). So we only handle the SPECIAL cases here that
// animateMove doesn't cover:
//   - promote: playSound('promote')  — promotion arpeggio (animateMove doesn't
//                                       know about promotion; it animates the
//                                       pawn reaching the 8th rank)
//   - check:   playSound('check')    — check alert tone (overlaid on top of
//                                       the piece sound; animateMove plays the
//                                       mover's piece sound, then this adds
//                                       the check alert)
// Haptics for all move types are fired here (animateMove doesn't do haptics).
// v1.0.8 PHASE 26: piece-specific haptics for pawn/queen/king to match the
//   personified animation + sound. Pawn = light quiver (瑟瑟发抖),
//   queen = massive impact (铿锵有声), king = heavy regal (威严庄重).
// Sounds don't cancel — fire both promote+check if both apply.
// Haptics DO cancel (Android vibrator) — fire only one per turn.
if(promotion)playSound('promote');
if(ic)playSound('check');
// Haptics DO cancel (Android vibrator) — fire only one, priority: special > castle > capture > piece.
if(promotion)HapticManager.fire('PROMOTION');
else if(ic)HapticManager.fire('CHECK_ALERT');
else if(cast)HapticManager.fire('CASTLE');
else if(gameState.board[to.row][to.col]||epCap)HapticManager.fire('PIECE_CAPTURE');
else HapticManager.fire(piece.type.toUpperCase()+'_MOVE');
// v1.0.6: Set _lastAnimMv so animateMove can detect castling via _castleSide()
// (needed for Chess960 where the king may move only 1 column when castling).
_lastAnimMv=mv;
animateMove(from,to,SYM[piece.color][piece.type],piece.type,!!(gameState.board[to.row][to.col]||epCap),ic,piece.color);gameState=ns;_cachedStatus=null;_cachedStatusKey='';lastMove={from,to};selectedSquare=null;legalMvs=[];legalSet=new Set();
// v1.0.8 PHASE 24 (bug fix): Immediately mark eval as stale so the eval bar
// shows "分析中" during the 560ms animation window, NOT the pre-move eval.
// Previously only _updateEvalDisplay() was called (which re-renders with the
// STALE eval data); _resetEvalState() was deferred to requestEngineEval()
// inside the setTimeout callback, leaving the bar showing the old eval.
_resetEvalState();
_updateEvalDisplay();

// Heavy computation deferred until after animation completes
// v1.0.2 FIX (audit): Capture gameState.hash BEFORE the timeout — if the user
// undoes/redoes/flips during the 420ms animation window, the stale callback
// would otherwise compute gameStatus() on the OLD state and overwrite the new
// gameOver/_cachedStatus, manifesting as a "ghost" game-over banner.
// Also moved doAIMove() out of the rAF callback into setTimeout(0) so the
// browser can paint the post-move UI before the engine starts computing.
// v1.0.8 PHASE 26: ANIMATION_DEFER_MS=600 matches the v1.0.8 PHASE 26 animation
//   system. The two longest piece animations are King (560ms) and Queen (520ms).
//   King triggers heavy shake (SHAKE_HEAVY_DUR=450ms); Queen triggers massive
//   shake (SHAKE_MASSIVE_DUR=620ms). The massive shake extends beyond the queen
//   animation, so we use 600ms (queen 520 + 80 buffer) to let the shake settle
//   before the deferred callback fires. For king, 560+40=600 also works.
//   If this fires too early, updateAfterMove() calls render() which gets
//   throttled by the animationInProgress guard, so it is safe — but increasing
//   the delay avoids the unnecessary throttle cycle.
const ANIMATION_DEFER_MS=600;
// v1.0.8 PHASE 49: when prefers-reduced-motion is on, animateMove returns
//   immediately (no WAAPI motion, no shake) — see game-logic.js:1064-1073.
//   The 600ms defer was sized to let the longest animation + shake settle
//   before updateAfterMove fires. With no animation, 600ms is pure latency
//   that delays the AI's reply and the game-over check for no reason.
//   Reduce to 30ms (one frame + tiny buffer) under reduced-motion.
let _deferMs=ANIMATION_DEFER_MS;
try{if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)_deferMs=30;}catch(e){console.warn('[UI]',e?.message?e.message:e);}
const _hashAtSched=gameState.hash;
setTimeout(()=>{
try{
if(gameState.hash!==_hashAtSched)return; // stale — abort
const gsr=!setupMode&&gameStatus(gameState);
const _gsKey=gameState.hash+'|'+gameState.currentTurn;_cachedStatus=gsr;_cachedStatusKey=_gsKey;
if(gsr&&!gameOver){
gameOverSoundPlayed=false;_applyGameOver(gsr);
requestAnimationFrame(()=>{updateAfterMove();});
// v1.0.2 NEW FEATURE: After a player move, check if any pending engine PV
// has diverged from the actual game. This must be called AFTER the move is
// pushed to moveRecords (which happens before this setTimeout).
// We call it here (in the deferred callback) because the move record needs
// to be fully populated first.
try{if(typeof _checkPVDivergence==='function')_checkPVDivergence();}catch(e){console.warn('PVDivergence check failed:',e);}
try{if(typeof _checkPVDivergenceSANs==='function')_checkPVDivergenceSANs();}catch(e){console.warn('PVDivergenceSANs check failed:',e);}
if(!gameOver&&gameState.currentTurn!==playerColor){setTimeout(doAIMove,0);}
}
}catch(e){console.error('executeMove deferred callback error:',e)}
},_deferMs);
}catch(e){console.error('executeMove error:',e)}}

// P3: Common animation cleanup for undo/redo/flip operations
function _clearAnimationState(){
  // v1.0.8 PHASE 23: clear _activeAnimEls and remove any leftover .move-anim
  //   overlay nodes from the DOM. Without this, if the user undoes/flips during
  //   an animation, _reattachActiveAnimations() (called by render) would
  //   re-append the stale overlay to the new DOM, showing a ghost piece.
  //   Also bump _animGen so any in-flight _finishAnim closure self-invalidates.
  animationInProgress=false;
  _activeAnimEls=[];
  ++_animGen;
  try{
    const bwrap=_cachedBwrap||(_cachedBwrap=document.querySelector('.bwrap'));
    if(bwrap){
      const old=bwrap.querySelectorAll('.move-anim');
      for(let i=0;i<old.length;i++)old[i].remove();
    }
  }catch(e){console.warn('[UI]',e?.message?e.message:e);}
  if(_fullRenderTimer){clearTimeout(_fullRenderTimer);_fullRenderTimer=0;}
}

function undoMove(){
if(isAIThinking&&!setupMode)return;
// v1.0.2 FIX: When undo is at the end (no more history), give BUTTON_PRESS
// feedback instead of the normal undo (PIECE_SELECT) feedback.
if(stateHistory.length===0){
  HapticManager.fire('BUTTON_PRESS');
  // v1.0.8 PHASE 22 supplement: error sound (nothing to undo)
  try{if(typeof playSound==='function')playSound('error');}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
  return;
}
// v1.0.8 PHASE 22 supplement: undo sound (逆向回旋音)
try{if(typeof playSound==='function')playSound('undo');}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
_cachedStatus=null;_cachedStatusKey='';_updateEvalDisplay(); // _resetEvalState now inside requestEngineEval()
_clearAnimationState();
if(pendingPromotion)pendingPromotion=null;
let steps=0;
// Track the from-position of the most recent PLAYER move being undone.
// v1.0.1 FIX: We must capture `lastMove` BEFORE popping — that's the move actually
// being undone in this iteration. After the pop, gameState is restored to the
// PRE-move state, and the piece that moved is now BACK at lastMove.from.
// (The previous code read `prev.lastMove.from`, which is the move from BEFORE the
// one being undone — that pointed to the wrong square, so auto-select never fired.)
let _playerMoveFrom=null;
while(stateHistory.length>0&&steps<3){
// Capture the move being undone BEFORE we pop the state history entry.
// After we restore, gameState will be the pre-move state — and the piece
// that was moved will be back at this from-square.
const _undoneMove=lastMove?{from:{row:lastMove.from.row,col:lastMove.from.col},to:{row:lastMove.to.row,col:lastMove.to.col}}:null;
const prev=stateHistory.pop();
// Validate prev before using it — if invalid, push back and stop
if(!prev||!prev.state){
  console.error('undoMove: invalid stateHistory entry, stopping undo');
  // Push back the invalid entry to prevent data loss
  if(prev)stateHistory.push(prev);
  break;
}
// Push current state to redo stack BEFORE restoring
_redoStack.push({state:cloneS(gameState),moveRecords:[...moveRecords],lastMove:lastMove?{...lastMove}:null,clocks:_snapshotClocks()});
gameState=prev.state;
// If the move being undone was a PLAYER move, capture its from-position.
// The piece is now back at that square in the restored gameState.
if(_undoneMove?.from){
  const fromRow=_undoneMove.from.row,fromCol=_undoneMove.from.col;
  const pieceAtFrom=gameState.board[fromRow]&&gameState.board[fromRow][fromCol];
  if(pieceAtFrom?.color===playerColor){
    _playerMoveFrom={row:fromRow,col:fromCol};
  }
}
moveRecords=prev.moveRecords||[];lastMove=prev.lastMove;gameOver=null;_gameOverStatusKey=null;gameOverSoundPlayed=false;
// v1.2.3 round-23 (Q3 fix): restore clocks from snapshot so the clock
//   state stays in sync with the board state after undo.
_restoreClocks(prev.clocks);
steps++;
if(gameState.currentTurn===playerColor)break;
}
// v1.0.5 Round-6 Rev64 (2026.6.27): Invalidate cached PGN-related data for the
// undone moves. After undo, moveRecords is shorter; any cache entries keyed by
// move index beyond the new length correspond to moves that no longer exist.
// Without this, the user could undo a move, then re-play a different move at
// the same index, and see stale eval/annotation data from the undone move.
//
// Three caches are invalidated:
//   1. _reviewEvalCache — keyed by reviewStep (0-based since v1.0.8 Phase 15:
//      step 0 = initial position, steps 1..N = positions after each move).
//      Entries with key > moveRecords.length are for undone moves and must
//      be deleted. Step 0 is always retained (initial position doesn't
//      change on undo). This is the "后台实时缓存的PGN" the user referred
//      to — the real-time per-move evaluation cache that backs the
//      review-mode eval bar and the PGN's [%eval ...] annotations.
//   2. _visualAnnotationsCache — keyed by moveIdx (0-based). Entries with
//      key >= moveRecords.length are for undone moves and must be deleted.
//      These back the [%csl]/[%cal] annotations in the PGN.
//   3. _cachedOriginalPGN — if set (from a PGN import), it represents the
//      imported text. After undo, the current game diverges from the import,
//      so we null it to ensure _buildPGNString() (which reads moveRecords)
//      is used for all subsequent PGN operations (stats page, 📚 save, etc.).
//      This was already partially handled by openStatsPage()/_pgnCacheSaveCurrent()
//      which always use _buildPGNString(true), but nulling here is belt-and-
//      suspenders and makes the intent explicit.
//
// Note: _redoStack preserves the undone moves' data so redoMove() can restore
// them. We do NOT clear _redoStack here — that would make undo irreversible.
// If the user redoes, the cache entries will be re-created as needed (eval
// re-requested, annotations re-computed).
if(typeof _invalidateCachesForUndoneMoves==='function'){
  _invalidateCachesForUndoneMoves(moveRecords.length);
}else{
  // Inline fallback (in case the function isn't defined yet — defensive)
  try{
    if(_reviewEvalCache !== undefined&&_reviewEvalCache){
      const _keysToDelete=[];
      if(typeof _reviewEvalCache.keys==='function'){
        for(const k of _reviewEvalCache.keys()){
          if(typeof k==='number'&&k>moveRecords.length)_keysToDelete.push(k);
        }
      }
      for(const k of _keysToDelete)_reviewEvalCache.delete(k);
    }
  }catch(e){console.warn('undoMove: eval cache invalidation failed',e);}
  try{
    if(typeof _visualAnnotationsCache!=='undefined'&&_visualAnnotationsCache){
      const _vaKeysToDelete=[];
      for(const k of _visualAnnotationsCache.keys()){
        if(typeof k==='number'&&k>=moveRecords.length)_vaKeysToDelete.push(k);
      }
      for(const k of _vaKeysToDelete)_visualAnnotationsCache.delete(k);
    }
  }catch(e){console.warn('undoMove: visual annotation cache invalidation failed',e);}
  try{
    if(typeof _cachedOriginalPGN!=='undefined')_cachedOriginalPGN=null;
  }catch(e){console.warn('[UI]',e?.message?e.message:e);}
}
// After undo, select the piece at the player's original (from) position.
// This is the position the piece was at BEFORE the player moved it, so the user
// can see its legal moves and potentially make a different move.
// v1.0.1: Removed the fallback that selected lastMove.to — that was pointing
// to an AI piece (wrong color), so selection silently failed. Now we only
// select if we successfully tracked a player move's from-square.
if(_playerMoveFrom&&!gameOver){
  const tp=gameState.board[_playerMoveFrom.row]&&gameState.board[_playerMoveFrom.row][_playerMoveFrom.col];
  if(tp?.color===playerColor){
    selectedSquare={row:_playerMoveFrom.row,col:_playerMoveFrom.col};
    legalMvs=legalMoves(gameState,selectedSquare);legalSet=new Set(legalMvs.map(m=>m.row*8+m.col));
    HapticManager.fire('PIECE_SELECT');
  }else{
    selectedSquare=null;legalMvs=[];legalSet=new Set();
  }
}else{
  selectedSquare=null;legalMvs=[];legalSet=new Set();
}
render();requestEngineEval();if(!gameOver&&!setupMode&&gameState.currentTurn!==playerColor){doAIMove();}}

function redoMove(){
if(isAIThinking)return;
// v1.0.2 FIX: When redo is at the end (empty redo stack), give BUTTON_PRESS
// feedback instead of the normal redo feedback — consistent with undo behavior.
if(_redoStack.length===0){
  HapticManager.fire('BUTTON_PRESS');
  // v1.0.8 PHASE 22 supplement: error sound (nothing to redo)
  try{if(typeof playSound==='function')playSound('error');}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
  return;
}
// v1.0.8 PHASE 22 supplement: redo sound (正向回旋音)
try{if(typeof playSound==='function')playSound('redo');}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
_cachedStatus=null;_cachedStatusKey='';_updateEvalDisplay();
_clearAnimationState();
// Pop from redo stack and restore
const nxt=_redoStack.pop();
// Validate redo entry before using it
if(!nxt||!nxt.state){
  console.error('redoMove: invalid redoStack entry, discarding');
  render();return;
}
// Save current state to history so we can undo again
stateHistory.push({state:cloneS(gameState),moveRecords:[...moveRecords],lastMove:lastMove?{...lastMove}:null,selectedSquare:null,clocks:_snapshotClocks()});
gameState=nxt.state;
// Preserve selectedSquare after redo
if(selectedSquare){
  const sp=gameState.board[selectedSquare.row][selectedSquare.col];
  if(sp?.color===playerColor&&!gameOver){
    legalMvs=legalMoves(gameState,selectedSquare);legalSet=new Set(legalMvs.map(m=>m.row*8+m.col));
  }else{
    selectedSquare=null;legalMvs=[];legalSet=new Set();
  }
}else{legalMvs=[];legalSet=new Set();}
moveRecords=nxt.moveRecords;lastMove=nxt.lastMove;gameOver=null;_gameOverStatusKey=null;gameOverSoundPlayed=false;
// v1.2.3 round-23 (Q3 fix): restore clocks from snapshot after redo too.
_restoreClocks(nxt.clocks);
// v1.0.2 FIX (first-principles): Redo must NOT trigger AI.
// The redo stack contains moves that were ALREADY played (and then undone).
// Each redo pops one entry and restores the corresponding state. Undo always
// runs in pairs (player move + AI reply) so that after undo it's the player's
// turn; therefore redo also runs in pairs (AI reply + player move), so after
// redo it's STILL the player's turn — AI has nothing to do.
// The previous `if(gameState.currentTurn!==playerColor){doAIMove();}` was a
// misfire: in the rare case where the redo stack only had ONE entry (e.g.,
// player undid right after their own move, before AI replied), this would
// trigger a FRESH AI search instead of letting the user redo the AI's
// pre-recorded reply from the stack — corrupting the redo stack and losing
// the original AI move. Removed entirely; requestEngineEval() still refreshes
// the eval bar for the restored position.
render();requestEngineEval();
// v1.0.2: Haptic feedback for successful redo (matching undo's PIECE_SELECT)
HapticManager.fire('PIECE_SELECT');
}

function flipBoard(){
  // v1.0.8 PHASE 22 supplement: flip sound (嗖声)
  try{if(typeof playSound==='function')playSound('flip');}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
  // v1.0.8 PHASE 24 (bug fix): clear animation state so a mid-animation flip
  //   doesn't leave an overlay at the wrong orientation.
  _clearAnimationState();
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
  // v1.0.8 PHASE 7: If in setup mode, exit setup FIRST before starting a new
  // game. Previously, startGame() replaced gameState with initState() but
  // left setupMode=true. When the user then exited setup, exitSetup() ran
  // validateSetupPosition() on the new (standard) gameState which had no
  // setupCastleMarks — causing _validateSetupCastleMarks to reset ALL
  // castlingRights to false, making the 🔁 markers disappear.
  // Fix: clear setupMode and related state BEFORE calling startGame(), so
  // exitSetup() is never called on the new gameState.
  if(typeof setupMode!=='undefined'&&setupMode){
    setupMode=false;
    setupMarkerMode=null;
    setupPiece=null;
    setupErrors=[];
    setupHistory=[];
    setupRedoStack=[];
  }
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
  try{if(typeof Store!=='undefined'&&Store&&typeof Store.dispatch==='function')Store.dispatch('TOGGLE_SOUND',soundOn);}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
  const btn=document.getElementById('btnSound');
  if(btn)btn.innerHTML=soundOn?'<span style=\"font-size:1.4rem\">🔊</span> '+T('sound'):'<span style=\"font-size:1.4rem\">🔇</span> '+T('sound');
  HapticManager.fire(soundOn?'TOGGLE_ON':'TOGGLE_OFF');
  // v1.0.8 PHASE 22 (bug fix): Sync audioEngine.enabled with soundOn. The
  // ChessAudioEngine's play* methods check this.enabled, and _playPieceSound /
  // _playCastleSound in game-logic.js check soundOn. Both must be in sync so
  // that muting truly silences ALL sounds (including move/castle sounds that
  // bypass playSound()). setEnabled() smoothly ramps the master gain to 0.
  try{
    if(typeof audioEngine!=='undefined'&&audioEngine){
      audioEngine.setEnabled(soundOn);
    }
  }catch(e){console.warn('[UI]',e?.message?e.message:e);}
  // v1.0.8 PHASE 22 supplement: when turning sound ON, play a select sound
  // so the user immediately hears confirmation that sound is now active.
  // (When turning OFF, no sound — by definition.)
  if(soundOn){
    try{if(typeof playSound==='function')playSound('select');}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
  }
  showToast(soundOn?T('sound_on'):T('sound_off'),1200);
}

function doPromotion(type){if(pendingPromotion){try{executeMove(pendingPromotion.from,pendingPromotion.to,type);}finally{pendingPromotion=null;render();}}}

function getHint(){
  if(gameOver||isAIThinking||reviewMode||gameState.currentTurn!==playerColor)return;
  if(!_engineReady){showToast(T('engine_not_ready'));return;}
  // v1.0.8 PHASE 22 supplement: hint sound (柔和三角波) — requesting AI hint
  try{if(typeof playSound==='function')playSound('hint');}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
  isHintLoading=true;hintText='';_aiBarInfo='';aiThinkInfo=T('thinking');_hintBarInfo=T('thinking');
  // Clear stale ponder info when starting a new hint search
  _ponderGen++;_ponderBarInfo='';_ponderMoveSAN='';_pendingPonderMoveUCI=null;
  // Clear previous MultiPV data
  _multiPVLines=[];_multiPVResult=null;
  _updateAIThinkDisplay();
  render();
  setTimeout(()=>{
    if(typeof AndroidBridge!=='undefined'&&typeof AndroidBridge.isEngineReady==='function'&&AndroidBridge.isEngineReady()){
      try{AndroidBridge.engineHint((typeof _sanitizeFenForEngine==='function')?_sanitizeFenForEngine(generateFEN(gameState)):generateFEN(gameState));}catch(e){console.error('engineHint error:',e);isHintLoading=false;_hintBarInfo='';hintText=T('hint_request_failed');render();}
      return;
    }
    isHintLoading=false;hintText=T('engine_unavailable_hint');
    render();
  },10);
}

// === Set AI difficulty level (toolbar difficulty button) ===
// v1.2.3 P0 FIX (user-reported "Unexpected end of input" JS error):
//   Refactored from an inline onclick attribute to a named global function.
//   The previous inline onclick used a JS string literal of the form
//   console.warn("...") inside a double-quoted HTML attribute. The HTML
//   parser terminated the attribute at the first inner double quote,
//   producing a truncated JS expression that the browser evaluated as
//   "Uncaught SyntaxError: Unexpected end of input". Moving the logic
//   into a function eliminates the entire class of HTML/JS quote-nesting
//   bugs and makes the difficulty button testable.
function setDifficultyLevel(level){
  if(isAIThinking)return;
  if(level===8){
    openEngineConfig();
    return;
  }
  aiLevel=level;
  try{
    if(typeof AndroidBridge!=='undefined'&&AndroidBridge&&typeof AndroidBridge.syncGameDifficulty==='function'){
      AndroidBridge.syncGameDifficulty(level);
    }
  }catch(e){
    console.warn('[AI] syncGameDifficulty failed:',e?.message?e.message:e);
  }
  render();
}

function toggleSetup(){if(isAIThinking&&!setupMode)return;_cachedStatus=null;_cachedStatusKey='';setupMode=!setupMode;
// v1.0.8 PHASE 24 (bug fix): clear any in-progress animation.
_clearAnimationState();
// v1.0.8 PHASE 22 supplement: setup-toggle sound (木质放置音)
try{if(typeof playSound==='function')playSound('setupToggle');}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
// v1.0.2 FIX (audit): extract common reset out of both branches.
gameOver=null;_gameOverStatusKey=null;
if(setupMode){setupPiece='pawn';setupColor='white';selectedSquare=null;legalMvs=[];legalSet=new Set();lastMove=null;gameOverSoundPlayed=false;setupErrors=[];setupHistory=[];
// v1.0.8: Initialize castle-marker set and en-passant marker on gameState.
// If the user is entering setup mode from a normal game (e.g., to tweak the
// position), seed the markers from the existing castlingRights + enPassantTarget
// so the user sees the current state instead of an empty marker set.
// For Chess960 positions, the king may be on any column; the kingside rook is
// the rightmost same-color rook (col > king.col), the queenside rook is the
// leftmost (col < king.col).
if(!gameState.setupCastleMarks)gameState.setupCastleMarks=new Set();
else gameState.setupCastleMarks.clear();
if(typeof gameState.setupEpMark==='undefined')gameState.setupEpMark=null;
// Seed castle markers from existing castlingRights — Chess960-aware.
// For Chess960, the king may be on any column of the initial rank; the
// kingside rook is the closest same-color rook to the right of the king,
// the queenside rook is the closest to the left.
if(gameState.castlingRights){
  // White: scan rank 1 (row 7) for king and rooks
  if(gameState.wk&&gameState.wk.row===7){
    const wkCol=gameState.wk.col;
    if(gameState.castlingRights.whiteKingside){
      let best=-1;
      for(let c=wkCol+1;c<8;c++){
        const p=gameState.board[7][c];
        if(p?.type==='rook'&&p.color==='white'){best=c;break;}
      }
      if(best>=0)gameState.setupCastleMarks.add(String(7*8+best));
    }
    if(gameState.castlingRights.whiteQueenside){
      let best=-1;
      for(let c=wkCol-1;c>=0;c--){
        const p=gameState.board[7][c];
        if(p?.type==='rook'&&p.color==='white'){best=c;break;}
      }
      if(best>=0)gameState.setupCastleMarks.add(String(7*8+best));
    }
  }
  // Black: scan rank 8 (row 0) for king and rooks
  if(gameState.bk&&gameState.bk.row===0){
    const bkCol=gameState.bk.col;
    if(gameState.castlingRights.blackKingside){
      let best=-1;
      for(let c=bkCol+1;c<8;c++){
        const p=gameState.board[0][c];
        if(p?.type==='rook'&&p.color==='black'){best=c;break;}
      }
      if(best>=0)gameState.setupCastleMarks.add(String(0*8+best));
    }
    if(gameState.castlingRights.blackQueenside){
      let best=-1;
      for(let c=bkCol-1;c>=0;c--){
        const p=gameState.board[0][c];
        if(p?.type==='rook'&&p.color==='black'){best=c;break;}
      }
      if(best>=0)gameState.setupCastleMarks.add(String(0*8+best));
    }
  }
}
// v1.0.8 PHASE 12 FIX: Seed ep marker from existing enPassantTarget.
// BUG: The previous code did `{...gameState.enPassantTarget}` directly — but
// enPassantTarget is the SKIPPED square (where a capturing pawn lands), while
// setupEpMark must be the PAWN's current square (the double-stepped pawn).
// This caused the ⚡ marker to render on the wrong square (the en-passant
// capture target) when entering setup mode from an in-progress game.
// Fix: convert enPassantTarget back to the pawn's square.
//   White pawn (row 4) → enPassantTarget.row === 5
//   Black pawn (row 3) → enPassantTarget.row === 2
// We also defensively verify the pawn is actually on the expected square —
// if not (state inconsistency), we leave setupEpMark null.
if(gameState.enPassantTarget){
  const _epT=gameState.enPassantTarget;
  let _pawnRow=null;
  if(_epT.row===5){
    // White pawn just double-stepped; pawn sits on row 4
    const _p=gameState.board[4]&&gameState.board[4][_epT.col];
    if(_p?.type==='pawn'&&_p.color==='white')_pawnRow=4;
  }else if(_epT.row===2){
    // Black pawn just double-stepped; pawn sits on row 3
    const _p=gameState.board[3]&&gameState.board[3][_epT.col];
    if(_p?.type==='pawn'&&_p.color==='black')_pawnRow=3;
  }
  gameState.setupEpMark=_pawnRow!==null?{row:_pawnRow,col:_epT.col}:null;
}else{
  gameState.setupEpMark=null;
}
// Reset marker mode
setupMarkerMode=null;
}else{
// Leaving setup mode via the toggle button (not via "Done"/exitSetup).
// Re-validate castlingRights from setupCastleMarks before clearing them.
// (_refreshStateAfterSetup reset them to all-false during setup.)
if(gameState.setupCastleMarks&&gameState.setupCastleMarks.size>0){
  try{validateSetupPosition(gameState);}catch(e){console.warn('[UI]',e?.message?e.message:e);}
}
setupMarkerMode=null;
gameState.setupEpMark=null;
gameState.setupCastleMarks=new Set();
// v1.0.2 SIMPLIFY (audit): _applyGameOver() already no-ops for non-terminal
// statuses (returns null from _gameOverStrFromStatus for 'check'/'ongoing').
// The previous `if(_exitSt && _exitSt!=='play')` guard was checking against
// a 'play' value that gameStatus() never returns — dead check. Simplified to
// a direct call which internally decides whether to apply game-over.
_applyGameOver(gameStatus(gameState));
_sfEvalReady=false;_evalLoading=true;requestEngineEval();if(!gameOver&&gameState.currentTurn!==playerColor){doAIMove()}}render()}

function exitSetup(){setupErrors=validateSetupPosition(gameState);if(setupErrors.length>0){render();return}
_withPGNSaveCheck(_exitSetupImpl);}

// v1.0.8 PHASE 29 (task 4 verification): Castle rights + en passant marker
//   preservation audit. The full data flow has been verified end-to-end:
//
//   ENTER setup mode (toggleSetup, setupMode=false→true):
//     1. setupCastleMarks.clear() then seeded from castlingRights — for each
//        true right, find the same-color rook on the king's side (standard
//        Chess960 convention: king between two rooks, so exactly one rook
//        per side) and add its square to the Set.
//     2. setupEpMark seeded from enPassantTarget — convert the SKIPPED square
//        (enPassantTarget) back to the PAWN's square (row 4 for white, row 3
//        for black), defensively verifying the pawn is actually there.
//
//   DURING setup mode:
//     - _refreshStateAfterSetup resets castlingRights to all-false and
//       enPassantTarget to null on every board mutation (place/delete piece,
//       clear, reset, turn-side change, undo, redo). The markers
//       (setupCastleMarks / setupEpMark) are PRESERVED across these resets
//       so the user's input is not lost.
//     - Deleting a piece also clears any marker on that square (setupClick).
//
//   EXIT setup mode (exitSetup → validateSetupPosition → _exitSetupImpl):
//     1. _validateSetupCastleMarks: re-derives castlingRights from
//        setupCastleMarks. For each marker, validates the square holds a
//        same-color rook on its initial rank, with the king also on its
//        initial rank, and the rook on the correct side of the king. Sets
//        the corresponding right true; all others false.
//     2. _validateSetupEpMark: re-derives enPassantTarget from setupEpMark.
//        Validates the marked square holds a pawn of the correct color on
//        the correct rank (white row 4 / black row 3), that the pawn's color
//        is the OPPOSITE of currentTurn (the pawn just double-stepped), and
//        that an adjacent enemy pawn exists to actually capture en passant.
//        Sets enPassantTarget to the SKIPPED square.
//     3. syncHash(s) re-computes the Zobrist hash with the validated rights.
//     4. If validation passes, _exitSetupImpl:
//        - Generates _setupFEN from the validated gameState (castlingRights
//          and enPassantTarget are now correct, and generateFEN only emits
//          the ep target if an adjacent capturer exists — consistent with
//          the validation check).
//        - Clears setupEpMark=null and setupCastleMarks=new Set() (they're
//          setup-only transient fields; the authoritative state is now in
//          castlingRights / enPassantTarget).
//        - stateHistory=[{state:cloneS(gameState),...}] — cloneS deep-clones
//          castlingRights (spread) and enPassantTarget (spread), so the
//          initial state snapshot retains the validated rights.
//        - reviewBaseState=cloneS(gameState) — same deep-clone.
//
//   PLAY mode (after exit):
//     - computeVisibleCastleMarks: derives visible 🔁 markers from
//       castlingRights (finds the same-color rook on the king's side).
//     - computeVisibleEpMark: derives visible ⚡ marker from
//       enPassantTarget (converts back to the pawn's square).
//     - Both functions check setupCastleMarks / setupEpMark FIRST (for
//       setup-mode input), but in play mode these are empty/null, so they
//       fall through to the castlingRights / enPassantTarget derivation.
//
//   VERDICT: The round-trip is correct. castlingRights and enPassantTarget
//   are preserved through setup mode and correctly reflected in the FEN,
//   state history, and visible markers during play. No code change needed
//   for the core preservation logic — the existing implementation is sound.
//
//   The only defensive improvement added below: after validation succeeds,
//   explicitly assert that castlingRights is non-null and enPassantTarget
//   is either null or a valid {row,col} object before proceeding. This
//   catches any future regression that might leave these fields in an
//   inconsistent state.
function _exitSetupImpl(){
// v1.1.0 Phase 53: Call _resetGameUIState() to clear ALL stale UI state
// from the previous game — same as _applyImportedFEN and importPGN.
// Without this, the following would leak from the previous game:
// - _cachedOriginalPGN (old PGN text → stats page / PGN export pollution)
// - playerWhite/playerBlack (old player names from PGN import)
// - _visualAnnotationsCache (old [%csl]/[%cal] → new game's PGN export)
// - _aiBarInfo/_hintBarInfo/hintText (old AI/hint bar text)
// - _cachedStatus/_cachedStatusKey (old game status cache)
// - isAIThinking/_aiSafetyTimerId (AI thinking state)
// - _evalLoading/_sfEvalReady/_ponderGen (engine eval state)
// - showResignConfirm/_resignWinnerColor (resign state)
// - cachedCtrlKey (control map cache key)
// - _redoStack (old redo entries)
// - _mlistScrollState (old scroll position)
// - gameClockTimerId (old clock timer)
_resetGameUIState();
// v1.1.1 Phase 61: The manual clears below were redundant with the old
//   _resetGameUIState and are now fully covered by it (it clears
//   _pendingEngineSANs/_pendingEnginePVs, reviewCritical, _cachedOriginalPGN,
//   playerWhite/playerBlack, _ecoRecCache, _sfEval/_sfDepth/etc,
//   _evalLoading, _needNewGameForEngine, _tbLoading, _tbRetryCount, etc).
//   Removed to avoid duplication.
if(typeof _updateEvalDisplay==='function')_updateEvalDisplay();
// as the new starting position (step 0). This means:
// - moveRecords is cleared (no move history from before setup)
// - stateHistory is reset with the setup position as the initial state
// - reviewBaseState is set to the setup position
// - lastMove is cleared
// - _redoStack is cleared
// This ensures the user starts fresh from the setup position.
// v1.0.3: Cache the setup position FEN for PGN export with [FEN]/[SetUp] headers.
// v1.0.8 PHASE 3: If the setup position has castle rights on non-standard squares
// (king not on e1/e8, or rook not on a1/h1/a8/h8), use Shredder-FEN castling
// notation (file letters) instead of standard KQkq. Standard KQkq is ambiguous
// in that case — it would imply rook on h1/a1 etc., which is not the actual
// position. Shredder notation explicitly names the rook's source file, so the
// position can be losslessly round-tripped through PGN/FEN.
if(typeof _setupFEN!=='undefined'&&typeof generateFEN==='function'){
  _setupFEN=generateFEN(gameState);
  if(typeof toShredderCastling==='function'&&gameState.castlingRights){
    const cr=gameState.castlingRights;
    const hasRights=cr.whiteKingside||cr.whiteQueenside||cr.blackKingside||cr.blackQueenside;
    if(hasRights){
      let needsShredder=false;
      // Check king positions
      if(gameState.wk&&(gameState.wk.row!==7||gameState.wk.col!==4))needsShredder=true;
      if(gameState.bk&&(gameState.bk.row!==0||gameState.bk.col!==4))needsShredder=true;
      // Check rook positions for each right that's set
      if(!needsShredder&&cr.whiteKingside){
        const wr=gameState.board[7]&&gameState.board[7][7];
        if(!wr||wr.type!=='rook'||wr.color!=='white')needsShredder=true;
      }
      if(!needsShredder&&cr.whiteQueenside){
        const wr=gameState.board[7]&&gameState.board[7][0];
        if(!wr||wr.type!=='rook'||wr.color!=='white')needsShredder=true;
      }
      if(!needsShredder&&cr.blackKingside){
        const br=gameState.board[0]&&gameState.board[0][7];
        if(!br||br.type!=='rook'||br.color!=='black')needsShredder=true;
      }
      if(!needsShredder&&cr.blackQueenside){
        const br=gameState.board[0]&&gameState.board[0][0];
        if(!br||br.type!=='rook'||br.color!=='black')needsShredder=true;
      }
      if(needsShredder){
        const parts=_setupFEN.split(' ');
        if(parts.length>=3){
          parts[2]=toShredderCastling(gameState.castlingRights,gameState.board);
          _setupFEN=parts.join(' ');
        }
      }
    }
  }
}
// v1.0.3: Track the setup position's starting move number for display.
// When the user places pieces in setup mode, gameState.fullMoveNumber is
// preserved from the FEN-derived or default value (typically 1). Setting
// this explicitly ensures the move list uses correct numbering even when
// the user starts from a FEN with fullMoveNumber>1.
if(typeof _importedStartMoveNum!=='undefined'){
  _importedStartMoveNum=(gameState.fullMoveNumber&&gameState.fullMoveNumber>0)?gameState.fullMoveNumber:1;
}
// v1.0.8 PHASE 29 (task 4 defensive check): Assert that validateSetupPosition
//   has left castlingRights and enPassantTarget in a consistent state before
//   we snapshot the state into stateHistory/reviewBaseState. If any of these
//   invariants are violated, fix them defensively rather than crash. This
//   guards against future regressions in _validateSetupCastleMarks /
//   _validateSetupEpMark that might leave the state half-mutated.
if(!gameState.castlingRights||typeof gameState.castlingRights!=='object'){
  console.warn('[exitSetup] castlingRights missing after validation — restoring defaults');
  gameState.castlingRights={whiteKingside:false,whiteQueenside:false,blackKingside:false,blackQueenside:false};
}
if(gameState.enPassantTarget){
  if(typeof gameState.enPassantTarget!=='object'||typeof gameState.enPassantTarget.row!=='number'||typeof gameState.enPassantTarget.col!=='number'||gameState.enPassantTarget.row<0||gameState.enPassantTarget.row>7||gameState.enPassantTarget.col<0||gameState.enPassantTarget.col>7){
    console.warn('[exitSetup] enPassantTarget malformed after validation — clearing');
    gameState.enPassantTarget=null;
  }
}
moveRecords=[];
stateHistory=[{state:cloneS(gameState),selectedSquare:null,legalMvs:[],moveRecords:[],lastMove:null,gameOver:null}];
lastMove=null;
_redoStack=[];
gameOver=null;_gameOverStatusKey=null;
gameOverSoundPlayed=false;
_ecoEnabled=false; // Setup mode — disable ECO recognition
// Clear the setup-mode transient input fields. setupEpMark and
// setupCastleMarks are the user's marker placements during setup; after
// validation, the authoritative state is enPassantTarget / castlingRights
// (set by _validateSetupEpMark / _validateSetupCastleMarks). These
// transient fields are setup-only and must not leak into play/review mode.
gameState.setupEpMark=null;
gameState.setupCastleMarks=new Set();
reviewBaseState=cloneS(gameState);
_reviewEvalCache.clear();_reviewEvalRequestedStep=-1; // Clear eval cache on board setup complete
// v1.0.8 PHASE 4: Enable UCI_Chess960 on the engine if the setup position
// has any castling rights on non-standard squares (king not on e1/e8, or a
// castle-right rook not on a1/h1/a8/h8). Without UCI_Chess960=true, the
// engine cannot correctly interpret castling in such positions — it would
// assume standard king-on-e1/rook-on-a1h1 castling and either fail to
// generate castling moves or produce illegal ones.
// We ALSO keep UCI_Chess960 enabled for explicit Chess960 games (already
// handled in startGame). For standard-position setups we leave it disabled
// to preserve compatibility with the engine's standard-FEN parsing.
if(typeof setChess960Mode==='function'&&typeof isChess960Mode==='function'){
  const _cr=gameState.castlingRights||{};
  const _hasRights=_cr.whiteKingside||_cr.whiteQueenside||_cr.blackKingside||_cr.blackQueenside;
  let _needsChess960=false;
  if(_hasRights){
    if(gameState.wk&&(gameState.wk.row!==7||gameState.wk.col!==4))_needsChess960=true;
    if(gameState.bk&&(gameState.bk.row!==0||gameState.bk.col!==4))_needsChess960=true;
    if(!_needsChess960&&_cr.whiteKingside){
      const wr=gameState.board[7]&&gameState.board[7][7];
      if(!wr||wr.type!=='rook'||wr.color!=='white')_needsChess960=true;
    }
    if(!_needsChess960&&_cr.whiteQueenside){
      const wr=gameState.board[7]&&gameState.board[7][0];
      if(!wr||wr.type!=='rook'||wr.color!=='white')_needsChess960=true;
    }
    if(!_needsChess960&&_cr.blackKingside){
      const br=gameState.board[0]&&gameState.board[0][7];
      if(!br||br.type!=='rook'||br.color!=='black')_needsChess960=true;
    }
    if(!_needsChess960&&_cr.blackQueenside){
      const br=gameState.board[0]&&gameState.board[0][0];
      if(!br||br.type!=='rook'||br.color!=='black')_needsChess960=true;
    }
  }
  // Only call setChess960Mode if the desired state differs from the current
  // state, to avoid an unnecessary engine stop/wait cycle.
  if(_needsChess960&&!isChess960Mode()){
    setChess960Mode(true);
    if(gameVariant !== undefined)gameVariant='chess960'; // treat as Chess960 for PGN export
  }else if(!_needsChess960&&isChess960Mode()&&(gameVariant === undefined||gameVariant!=='chess960')){
    // Setup produced a standard position — disable Chess960 mode unless we're
    // in an explicit Chess960 game (gameVariant === 'chess960').
    setChess960Mode(false);
    // v1.2.3 round-23 (Q1 fix): clear gameSPID too. Previously the previous
    //   game's SP-ID persisted when a non-Chess960 setup was applied, so
    //   PGN export / Shredder-FEN generation could read a stale SP-ID.
    if(typeof gameSPID!=='undefined')gameSPID=null;
  }
}
// v1.0.2 FIX: Black-to-move opening move record fix.
// If the setup position has black to move, prepend null placeholder so the first
// real move (black's) lands in the black slot, not the white slot.
_prependBlackToMovePlaceholder();
toggleSetup()}

function setupClick(r,c){
if(!setupMode||isAIThinking)return;
HapticManager.fire('PIECE_SELECT');
// v1.0.8: Snapshot must also capture setupCastleMarks + setupEpMark so that
// undo/redo correctly restores the marker state alongside the board.
if(!gameState.setupCastleMarks)gameState.setupCastleMarks=new Set();
if(typeof gameState.setupEpMark==='undefined')gameState.setupEpMark=null;
// Save snapshot before each modification for undo
setupRedoStack=[];setupHistory.push({
  board:gameState.board.map(row=>row.map(cell=>cell?{...cell}:null)),
  wk:gameState.wk?{...gameState.wk}:null,
  bk:gameState.bk?{...gameState.bk}:null,
  castlingRights:{...gameState.castlingRights},
  currentTurn:gameState.currentTurn,
  hash:gameState.hash,
  setupCastleMarks:new Set(gameState.setupCastleMarks),
  setupEpMark:gameState.setupEpMark?{...gameState.setupEpMark}:null
});
if(setupHistory.length>50)setupHistory.shift();
// v1.0.8 PHASE 6: Marker mode and piece selection are INDEPENDENT.
// If BOTH are active, we apply the piece first, then toggle the marker.
// If only one is active, only that action is taken.
// Delete mode is exclusive — it clears the square and its markers.
if(setupPiece==='delete'){
if(gameState.board[r][c]&&gameState.board[r][c].type==='king'){
if(gameState.board[r][c].color==='white')gameState.wk=null;
else gameState.bk=null;
}
// v1.0.8: When deleting a piece, also clear any castle/ep markers on that square.
const key=String(r*8+c);
gameState.setupCastleMarks.delete(key);
if(gameState.setupEpMark&&gameState.setupEpMark.row===r&&gameState.setupEpMark.col===c)gameState.setupEpMark=null;
gameState.board[r][c]=null;_refreshStateAfterSetup(gameState);render();return
}
// Place piece if a piece is selected (not delete, not null)
if(setupPiece&&setupPiece!=='delete'){
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
_refreshStateAfterSetup(gameState);
// v1.0.8 PHASE 6: do NOT return here — fall through to marker toggle.
}
// Toggle marker if a marker mode is active
if(setupMarkerMode==='castle'){
  // Toggle castle marker on this square. Validation happens on "Done".
  const key=String(r*8+c);
  if(gameState.setupCastleMarks.has(key))gameState.setupCastleMarks.delete(key);
  else gameState.setupCastleMarks.add(key);
  setupErrors=[]; // clear stale errors so user sees fresh state
  render();return;
}
if(setupMarkerMode==='ep'){
  // Toggle ep marker. Only one allowed — clicking another square moves it.
  if(gameState.setupEpMark&&gameState.setupEpMark.row===r&&gameState.setupEpMark.col===c){
    gameState.setupEpMark=null;
  }else{
    gameState.setupEpMark={row:r,col:c};
  }
  setupErrors=[];
  render();return;
}
// If we placed a piece but no marker mode, render now.
if(setupPiece&&setupPiece!=='delete'){render();return}
}

function undoSetupClick(){
if(!setupMode||setupHistory.length===0)return;
// Save current state to redo stack before undoing
var _curSnap={board:gameState.board.map(r=>r.map(c=>c?{...c}:null)),wk:gameState.wk?{...gameState.wk}:null,bk:gameState.bk?{...gameState.bk}:null,castlingRights:{...gameState.castlingRights},currentTurn:gameState.currentTurn,hash:gameState.hash,setupCastleMarks:new Set(gameState.setupCastleMarks||[]),setupEpMark:gameState.setupEpMark?{...gameState.setupEpMark}:null};
setupRedoStack.push(_curSnap);if(setupRedoStack.length>50)setupRedoStack.shift();
const snap=setupHistory.pop();
gameState.board=snap.board;gameState.wk=snap.wk;gameState.bk=snap.bk;gameState.castlingRights=snap.castlingRights;gameState.currentTurn=snap.currentTurn;
// v1.0.8: Restore marker state from snapshot
gameState.setupCastleMarks=snap.setupCastleMarks?new Set(snap.setupCastleMarks):new Set();
gameState.setupEpMark=snap.setupEpMark?{...snap.setupEpMark}:null;
_refreshStateAfterSetup(gameState);
render();
}

function redoSetupClick(){if(!setupMode||setupRedoStack.length===0)return;
const snap=setupRedoStack.pop();
setupHistory.push({board:gameState.board.map(r=>r.map(c=>c?{...c}:null)),wk:gameState.wk?{...gameState.wk}:null,bk:gameState.bk?{...gameState.bk}:null,castlingRights:{...gameState.castlingRights},currentTurn:gameState.currentTurn,hash:gameState.hash,setupCastleMarks:new Set(gameState.setupCastleMarks||[]),setupEpMark:gameState.setupEpMark?{...gameState.setupEpMark}:null});
if(setupHistory.length>50)setupHistory.shift();
gameState.board=snap.board.map(r=>r.map(c=>c?{type:c.type,color:c.color}:null));
gameState.wk=snap.wk?{...snap.wk}:null;gameState.bk=snap.bk?{...snap.bk}:null;
gameState.castlingRights={...snap.castlingRights};
gameState.currentTurn=snap.currentTurn;
gameState.hash=snap.hash;
// v1.0.8: Restore marker state from redo snapshot
gameState.setupCastleMarks=snap.setupCastleMarks?new Set(snap.setupCastleMarks):new Set();
gameState.setupEpMark=snap.setupEpMark?{...snap.setupEpMark}:null;
setupErrors=[];render();}

/**
 * Start a new game based on dialog settings.
 * Called from the new game dialog button "开始游戏".
 */
// v1.0.2: PGN save prompt — called before clearing move records.
// Checks if there are any moves; if so, shows a "💾是否保存PGN文件？" dialog.
// The callback is executed after the user chooses (or immediately if no moves).
function _withPGNSaveCheck(callback){
  if(_skipPGNSavePrompt||!moveRecords||!moveRecords.some(function(r){return r!=null;})){
    callback();
    return;
  }
  _pendingActionAfterSave=callback;
  showSavePGNPrompt=true;
  render();
}

function _savePGNYes(){
  showSavePGNPrompt=false;
  _skipPGNSavePrompt=true;
  // v1.1.1 Phase 66: exportPGNToFile now shows an annotation dialog (async).
  //   We must defer the pending action until AFTER the dialog is dismissed,
  //   not on a fixed 200ms timer. The annotation dialog's callback handles
  //   the export; we schedule the pending action to run after the dialog
  //   is dismissed by wrapping it in a function that checks if the dialog
  //   is still active.
  var cb=_pendingActionAfterSave;
  _pendingActionAfterSave=null;
  try{exportPGNToFile();}catch(e){console.warn('PGN export during save prompt failed',e);}
  if(cb){
    // Wait for the annotation dialog to be dismissed before executing cb.
    // Poll every 200ms; if dialog is not active (never opened or dismissed),
    // execute immediately.
    function _waitForDialog(){
      if(typeof _pgnExportDialogActive!=='undefined'&&_pgnExportDialogActive){
        setTimeout(_waitForDialog,200);
      }else{
        cb();
        _skipPGNSavePrompt=false;
      }
    }
    setTimeout(_waitForDialog,200);
  }else{
    _skipPGNSavePrompt=false;
  }
  render();
}

function _savePGNNo(){
  showSavePGNPrompt=false;
  _skipPGNSavePrompt=true;
  var cb=_pendingActionAfterSave;
  _pendingActionAfterSave=null;
  if(cb){cb();}
  setTimeout(function(){_skipPGNSavePrompt=false;},100);
  render();
}

// v1.0.4 LATEST: Cancel button — returns to the original screen WITHOUT
// clearing any cache or executing the pending action. The user stays exactly
// where they were before the save prompt appeared.
function _savePGNCancel(){
  showSavePGNPrompt=false;
  _pendingActionAfterSave=null; // discard the pending action — do NOT execute it
  // Do NOT set _skipPGNSavePrompt=true — we want the prompt to appear again
  // next time the user tries to start a new game / import FEN / import PGN.
  render();
}

/**
 * Handle Android back button press.
 * Closes open dialogs/overlays, exits review/setup modes.
 */
function handleBackPress(){
  // v1.1.1 Phase 65: Export annotation dialog — back button = Cancel
  if(typeof _pgnExportDialogActive!=='undefined'&&_pgnExportDialogActive){
    if(typeof _pgnExportDialogDismiss==='function')_pgnExportDialogDismiss();
    return;
  }
  // v1.1.2 Phase 68: Partial-eval-coverage dialog — back button = Cancel
  //   (matches the export annotation dialog pattern).
  if(typeof _pgnPartialEvalDialogActive!=='undefined'&&_pgnPartialEvalDialogActive){
    if(typeof _pgnPartialEvalDialogDismiss==='function')_pgnPartialEvalDialogDismiss();
    return;
  }
  // v1.0.8 UI: Promotion dialog takes highest priority — it blocks all other
  // input and must be dismissed before any other overlay can be closed.
  if(pendingPromotion){
    pendingPromotion=null;
    render();
    return;
  }
  // v1.0.8 UI: Save-PGN prompt — back button = Cancel (matches the visible
  // "Cancel" button behavior, so the user is not surprised by an implicit
  // Yes/No decision).
  if(showSavePGNPrompt){
    if(typeof _savePGNCancel==='function')_savePGNCancel();
    else{showSavePGNPrompt=false;render();}
    return;
  }
  if(showPGNCacheManager){
    _pgnCacheClose();
    return;
  }
  // v1.0.4 Rev27: Close resign confirmation dialog on back press
  if(showResignConfirm){
    showResignConfirm=false;
    render();
    return;
  }
  // v1.0.8 PHASE 6: If ANY setup-mode selection is active (marker mode OR
  // piece selection OR delete mode OR color selection), back button cancels
  // the selection first (instead of exiting setup). This covers:
  //   - setupMarkerMode ('castle' / 'ep')
  //   - setupPiece (any piece type, including 'delete')
  // The user presses back again to actually exit setup mode.
  // We cancel in priority order: marker mode → piece selection.
  if(typeof setupMode!=='undefined'&&setupMode){
    if(typeof setupMarkerMode!=='undefined'&&setupMarkerMode){
      setupMarkerMode=null;
      render();
      return;
    }
    if(typeof setupPiece!=='undefined'&&setupPiece){
      setupPiece=null;
      render();
      return;
    }
  }
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
 * v1.0.4 Rev24 NEW: Rename the human player.
 * Opens a prompt pre-filled with the current name (or default "你"/"You").
 * The new name is:
 *   - Trimmed and length-capped (30 chars)
 *   - Persisted via AndroidBridge.persistentSet('Regalia_humanName', ...)
 *   - Stored in the global _humanPlayerName variable
 *   - Reflected in all subsequent PGN text ([White "..."] / [Black "..."])
 *   - Reflected in PGN cache archives and clipboard copies
 *
 * Passing an empty string or cancelling the prompt RESETS the name to the
 * default "你"/"You" (clears the persisted preference).
 */
function _renameHumanPlayer(){
  try{HapticManager.fire('BUTTON_PRESS');}catch(e){console.warn('[UI]',e?.message?e.message:e);}
  const _current=(typeof _humanPlayerName!=='undefined'&&_humanPlayerName)?_humanPlayerName:T('you');
  let _newName='';
  try{_newName=prompt(T('rename_player_prompt'),_current)||'';}catch(e){_newName='';}
  _newName=_newName.trim();
  if(_newName.length>30)_newName=_newName.substring(0,30);
  // If the user typed the default name or cancelled, clear the rename
  if(!_newName||_newName===T('you')||_newName==='你'||_newName==='You'){
    _humanPlayerName=null;
    try{if(typeof AndroidBridge!=='undefined'&&AndroidBridge.persistentRemove)AndroidBridge.persistentRemove('Regalia_humanName');}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
    showToast(T('rename_player_reset'),2000);
  }else{
    _humanPlayerName=_newName;
    try{if(typeof AndroidBridge!=='undefined'&&AndroidBridge.persistentSet)AndroidBridge.persistentSet('Regalia_humanName',_newName);}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
    showToast(T('rename_player_saved')+'：'+_newName,2000);
  }
  render();
}

/**
 * v1.0.4 Round-5 Rev28: Show the "💾 Save PGN file?" prompt before importing
 * a PGN that was imported on the stats page.
 *
 * Called from MainActivity.onResume() via evaluateJavascript when
 * StatsActivity.importedPGNOnStats is non-null (i.e., the user tapped "Yes"
 * on the stats page's "🗃️ Import PGN to game?" dialog).
 *
 * Flow:
 *   1. If the current game has move records, show the existing "💾 Save PGN
 *      file?" prompt (showSavePGNPrompt) with the import as the pending
 *      action. This gives the user a chance to save the current game's PGN
 *      before it gets replaced.
 *   2. If the current game is empty (no moves), skip the save prompt and
 *      import directly.
 *   3. The pending action (executed after the save prompt's Yes/No/Cancel)
 *      is: importPGN(pgn). Cancel = don't import (the user stays on the
 *      current game).
 *
 * @param {string} pgnText — The PGN text imported on the stats page.
 */
function _showStatsImportBackPrompt(pgnText){
  if(!pgnText){
    showToast(T('stats_import_back_no_pgn'));
    return;
  }
  // v1.0.8 PHASE 19 (bug fix): Close over pgnText directly instead of stashing
  // in a module-level global. The global stash had a race: if this function was
  // called twice before the first save-prompt resolved, the second call would
  // overwrite the stash and the first import would be silently lost.
  var importAction=function(){
    try{
      // v1.0.8 PHASE 34: use async import with worker offloading
      if(typeof importPGNAsync==='function'){
        importPGNAsync(pgnText);
      }else if(typeof importPGN==='function'){
        importPGN(pgnText);
      }else{
        console.error('importPGN function not available for stats import-back');
        showToast(T('pgn_invalid'));
      }
    }catch(e){
      console.error('Stats import-back failed:',e);
      showToast(T('pgn_invalid'));
    }
  };
  // Use the existing _withPGNSaveCheck mechanism: if there are move records,
  // show the "💾 Save PGN file?" prompt first; otherwise import directly.
  _withPGNSaveCheck(importAction);
}

/**
 * v1.0.4 Round-5 Rev27: Resign the current game (DeepSeek review 2.1).
 *
 * Called from the resign confirmation dialog when the user taps "Yes, Resign".
 * Implements PGN resignation per the 元宝 PGN report:
 *   - [Result "0-1"] if White (human) resigns → Black (AI) wins
 *   - [Result "1-0"] if Black (human) resigns → White (AI) wins
 *   - [Termination "Resignation"] supplementary tag
 *   - "{White resigns.}" / "{Black resigns.}" comment on the last move
 *
 * Side effects:
 *   - Sets gameOver and _gameOverStatusKey='resign' so the game-over overlay
 *     shows the correct message and the eval display shows win/lose emoji.
 *   - Sets _resignWinnerColor (the color that WINS) so _gameOverStrFromStatus
 *     and _buildPGNString can produce the correct text and tags.
 *   - Stops the engine: send 'stop' + isAIThinking=false so any in-flight
 *     search is aborted.
 *   - Stops the game clock (sets gameClocks.running=false).
 *   - Plays a soft "lose" sound if sound is enabled.
 */
function _resignGame(){
  if(gameOver)return; // Already over — no-op
  // v1.0.8 PHASE 22 supplement: resign sound (降旗音)
  try{if(typeof playSound==='function')playSound('resign');}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
  // The resigner is the human player (playerColor). The winner is the AI.
  _resignWinnerColor = (playerColor==='white') ? 'black' : 'white';
  // Stop any in-flight engine search
  try{
    isAIThinking=false;
    if(typeof _engineReady!=='undefined'&&_engineReady){
      // v1.0.4 Rev35: prefer engineStop() (hard stop, discards bestmove) over
      // sendToEngine('stop') (soft stop, bestmove still processed). engineStop()
      // was added in Rev35 specifically for cases like resign/game-over where
      // the engine's bestmove should be silently discarded.
      try{
        if(typeof AndroidBridge!=='undefined'&&typeof AndroidBridge.engineStop==='function'){
          AndroidBridge.engineStop();
        }else if(typeof AndroidBridge!=='undefined'&&AndroidBridge.sendToEngine){
          AndroidBridge.sendToEngine('stop');
        }
      }catch(e){console.warn('[UI]',e?.message?e.message:e);}
    }
  }catch(e){console.warn('[UI]',e?.message?e.message:e);}
  // Stop the game clock
  // v1.0.8 PHASE 19 (bug fix): gameClocks.running=false was a no-op (the field
  // doesn't exist). The 200ms interval kept firing for the rest of the session,
  // wasting CPU. Now properly clear the interval like _onGameClockExpired does.
  try{
    if(typeof gameClockTimerId!=='undefined'&&gameClockTimerId){
      clearInterval(gameClockTimerId);
      gameClockTimerId=null;
    }
  }catch(e){console.warn('[UI]',e?.message?e.message:e);}
  // Set game-over state
  _gameOverStatusKey='resign';
  gameOver=_gameOverStrFromStatus('resign');
  // Play a soft "gameover" sound for the loss.
  try{
    if(soundOn !== undefined&&soundOn&&typeof playSound==='function'){
      playSound('gameover');
    }
  }catch(e){console.warn('[UI]',e?.message?e.message:e);}
  // v1.0.8 PHASE 41: use GAME_OVER haptic (not ERROR) — resignation plays the
  //   same 'gameover' sound as natural game-over, so the haptic should match.
  //   ERROR had no Java case (fell to 15ms default); GAME_OVER has a proper
  //   430ms multi-stage pattern matching the somber arpeggio.
  try{HapticManager.fire('GAME_OVER');}catch(e){console.warn('[UI]',e?.message?e.message:e);}
  // Force a full re-render to show the game-over overlay
  //   (v1.2.3 round-20: markDirty removed as dead code — it always routed to
  //   render() anyway, so call render() directly.)
  render();
  // v1.1.1 Phase 66: Removed stale console.log (was left over from debugging).
}

// Paste PGN from clipboard — uses prompt() for simplicity
// v1.0.2: Wrapped with _withPGNSaveCheck to prompt save before clearing
function _doPastePGN(){
  _withPGNSaveCheck(function(){
    // v1.0.8 PHASE 18 Task 3 (bug fix): Reset virtual list state on PGN paste
    // so stale avgRowH / window from a previous long game don't carry over.
    _resetRvVirtualState();
    const text=prompt(T('pgn_paste_hint'));
    if(!text)return;
    const trimmed=text.trim();
    const hasPGNMoveNumbers=!!trimmed.match(/\d+\.\s*[a-zA-ZNBRQOKO]/);
    const hasPGNHeaders=/\[/.test(trimmed);
    const hasPGNVariations=/\(/.test(trimmed);
    const hasPGNMarkers=hasPGNMoveNumbers||hasPGNHeaders||hasPGNVariations;
    const isLikelyFEN=!hasPGNMarkers&&trimmed.includes('/')&&
      (trimmed.split('\n').length<=2)&&
      trimmed.split('/').length>=8;
    if(fenToState(trimmed)||isLikelyFEN){
      showToast(T('pgn_fen_rejected'),2500);
      return;
    }
    // v1.0.8 PHASE 34: use async import with worker offloading
    if(typeof importPGNAsync==='function'){
      importPGNAsync(text);
    }else{
      importPGN(text);
    }
  });
}

// v1.0.2: Wrapper for importFEN with PGN save check
function _importFENWithSaveCheck(){
  _withPGNSaveCheck(function(){
    // v1.0.8 PHASE 18 Task 3 (bug fix): Reset virtual list state on FEN import
    // so stale avgRowH / window from a previous long game don't carry over.
    _resetRvVirtualState();
    importFEN();
  });
}

// v1.0.2: Wrapper for importPGNFile with PGN save check
function _importPGNFileWithSaveCheck(){
  _withPGNSaveCheck(function(){
    // v1.0.8 PHASE 18 Task 3 (bug fix): Reset virtual list state on PGN file import.
    _resetRvVirtualState();
    importPGNFile();
  });
}

export {sqClick,_getCastlingRookForClick,executeMove,_clearAnimationState,undoMove,redoMove,flipBoard,quickFreeOpening,toggleSound,doPromotion,getHint,setDifficultyLevel,toggleSetup,exitSetup,_exitSetupImpl,setupClick,undoSetupClick,redoSetupClick,_withPGNSaveCheck,_savePGNYes,_savePGNNo,_savePGNCancel,handleBackPress,_doPastePGN,_importFENWithSaveCheck,_importPGNFileWithSaveCheck,_renameHumanPlayer,_showStatsImportBackPrompt,_resignGame};
