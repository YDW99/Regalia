// ===================== MODULE: tablebase =====================
// Syzygy endgame tablebase integration + PGN parser
// Depends on: game-logic (for generateFEN, uciToCoords, inB, legalMoves, moveAlg, etc.)
//
// Copyright (C) 2026 Regalia
//
// PGN parsing logic derived from DroidFish GameTree/PgnToken/PgnScanner
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

// ===================== TABLEBASE INTEGRATION =====================

// Copy FEN to clipboard
function copyFEN(){
const f=generateFEN(gameState);
safeCopyToClipboard(f,T('fen_copy_prefix')+f);
}
// Copy FEN of current review position to clipboard
function copyReviewFEN(){
  if(!reviewMode||!reviewStates||reviewStep<0||reviewStep>=reviewStates.length){showToast(T('no_valid_review'));return;}
  const f=generateFEN(reviewStates[reviewStep].state);
  safeCopyToClipboard(f,T('fen_copy_prefix')+f);
}
function importFEN(){
const f=prompt(T('paste_fen'));if(!f)return;
_applyImportedFEN(f);
}

// Apply imported FEN string — shared by all import paths
function _applyImportedFEN(fenStr){
const ns=fenToState(fenStr);
if(ns){
// v1.1.1 Phase 61: _resetGameUIState() now clears ALL per-game caches
//   centrally (including _reviewEvalCache, _ecoRecCache, _pvCache,
//   _pendingEngineSANs/_pendingEnginePVs, _multiPV*, reviewCritical,
//   _sfEval/_sfDepth/etc, _cachedOriginalPGN, playerWhite/playerBlack,
//   _setupFEN, _importedStartMoveNum, _needNewGameForEngine, _tbLoading,
//   _tbRetryCount, gameClocks, _redoStack, etc).
//   We call it FIRST, then set the FEN-import-specific values AFTER so
//   they survive the reset.
gameState=ns;_resetGameUIState();gameOverSoundPlayed=false;
// v1.1.1 Phase 61: Now set the FEN-import-specific values (after reset).
// _importedStartMoveNum: Track FEN's starting move number for correct display numbering.
if(typeof _importedStartMoveNum!=='undefined'){
  _importedStartMoveNum=(ns.fullMoveNumber&&ns.fullMoveNumber>0)?ns.fullMoveNumber:1;
}
// _setupFEN: set to the imported FEN so PGN export includes the [FEN] header
if(typeof _setupFEN!=='undefined')_setupFEN=fenStr;
// FEN import has no player names — leave playerWhite/playerBlack undefined
// (already nulled by _resetGameUIState).
_cachedStatus=null;_cachedStatusKey='';
_updateEvalDisplay();
reviewMode=false;setupMode=false;showNewGameDialog=false;
gameOver=null;_gameOverStatusKey=null;selectedSquare=null;legalMvs=[];legalSet=new Set();
lastMove=null;pendingPromotion=null;
_aiBarInfo='';_hintBarInfo='';
stateHistory=[];moveRecords=[];
hintText='';isHintLoading=false;
setupHistory=[];setupErrors=[];
_ecoEnabled=false; // FEN import — disable ECO recognition
reviewBaseState=cloneS(gameState);
// v1.0.2 FIX: Black-to-move opening move record fix.
// If the imported FEN has black to move, prepend null placeholder so the first
// real move (black's) lands in the black slot (moveRecords[1]), not the white slot.
_prependBlackToMovePlaceholder();
render();requestEngineEval();
if(gameState.currentTurn!==playerColor)doAIMove();
}else{showToast(T('fen_invalid'),2000)}
}

// PGN parser — robust implementation with DroidFish-compatible variation handling
// Parses a PGN string and replays the moves to build game state + moveRecords
// Architecture derived from DroidFish GameTree.parsePgn() / PgnScanner (GPL v3)
// Uses recursive-descent for variations, constraint-based SAN matching,
// and lazy validation — gracefully skipping invalid moves.
//
// Key enhancements vs earlier version:
//   - Escape line stripping (% at column 0)
//   - Non-breaking space handling (\u00a0)
//   - Proper recursive variation parsing (DroidFish-style)
//   - Robust header extraction (handles broken quotes)
//   - NAG + annotation suffix handling
//   - Better text normalization for maximum format compatibility
function _parsePGN(pgnText){
  if(!pgnText||typeof pgnText!=='string')return null;
  // Remove BOM (byte order mark)
  try{if(pgnText.charCodeAt(0)===0xFEFF)pgnText=pgnText.substring(1);}catch(e){return null;}
  
  // Normalize line endings: \r\n → \n, \r → \n (Windows/classic Mac support)
  pgnText=pgnText.replace(/\r\n/g,'\n').replace(/\r/g,'\n');
  
  // Strip PGN escape lines: lines starting with '%' in column 0 (DroidFish PgnScanner)
  pgnText=pgnText.replace(/^%.*$/gm,'');
  
  // Replace non-breaking spaces with regular spaces (DroidFish treats \u00a0 as whitespace)
  pgnText=pgnText.replace(/\u00a0/g,' ');
  
  // Handle multiple games: only parse the first game.
  // PGN files with multiple games have header blocks starting with [Event ...].
  // Split on double-newline followed by a header tag to isolate the first game.
  const gameBlocks=pgnText.split(/\n\s*\n(?=\[)/);
  if(gameBlocks.length>1)pgnText=gameBlocks[0];
  
  // Extract FEN from headers if present (for custom starting positions)
  // Handle both [FEN "..."] and [FEN ...] (missing quotes)
  let startFEN=null;
  const fenMatch=pgnText.match(/\[FEN\s+"([^"]+)"\]/i);
  if(fenMatch){startFEN=fenMatch[1];}
  else{
    // FEN header without quotes: [FEN rnbqkbnr/pppppppp/...]
    const fenNoQuoteMatch=pgnText.match(/\[FEN\s+([^\]\n]+)\]/i);
    if(fenNoQuoteMatch){startFEN=fenNoQuoteMatch[1].trim();}
  }
  
  // v1.0.4 NEW: Extract Variant tag for Chess960 detection.
  //   [Variant "Chess960"]  → Fischer Random Chess
  //   [Variant "Fischerandom"] or [Variant "Fisher Random"] → also Chess960
  // When a Chess960 variant is detected, we set the global gameVariant flag
  // and call setChess960Mode(true) on the engine before the first AI move.
  let pgnVariant=null;
  const variantMatch=pgnText.match(/\[Variant\s+"([^"]+)"\]/i);
  if(variantMatch){
    const v=variantMatch[1].toLowerCase();
    if(v==='chess960'||v==='fischerandom'||v==='fischer random'||v==='frc'){
      pgnVariant='chess960';
    }
  }
  
  // v1.0.4 NEW: Extract SetUp tag (must be "1" if FEN is present, per spec)
  // We use this to validate the FEN/SetUp pairing, but don't reject malformed
  // PGNs that omit SetUp — auto-correct by treating the FEN as authoritative.
  // (Spec §10: "If the SetUp tag is set to "1", the FEN tag MUST be present.")
  // The inverse (FEN present but SetUp missing) is also auto-corrected silently.
  
  // Remove header tags — handle multi-line headers and various formats.
  // v1.0.9 PHASE 52 CRITICAL FIX: the previous regex /^\[[^\]]*\]/gm used
  //   line-start anchor `^` with the multiline flag. For SINGLE-LINE PGN
  //   files (where all tags + movetext are on one line with no \n between
  //   them), `^` only matches the START OF THE ENTIRE STRING once — so only
  //   the FIRST tag (e.g. [Event "..."]) was stripped, and the remaining
  //   tags ([Site "?"] [Date "..."] ...) leaked into movetext as invalid
  //   tokens. The tokenizer then skipped them all, hitting the 5-consecutive-
  //   skip safety limit and aborting the parse — manifesting as "PGN import
  //   fails, 0 moves parsed".
  //   Fix: use a regex that matches PGN header tag format specifically —
  //   `[TagName "value"]` or `[TagName value]` — where TagName starts with
  //   a letter. This avoids the `^` line-anchor issue (works for both
  //   single-line and multi-line PGN), and ALSO avoids stripping `[%csl ...]`
  //   / `[%cal ...]` / `[%eval ...]` / `[%emt ...]` inside brace comments
  //   (because `%` is not in `[A-Za-z]`).
  let moveText=pgnText.replace(/\[[A-Za-z]\w*\s+[^\]]+\]/g,'').trim();
  // Remove line continuation markers (\ at end of line)
  moveText=moveText.replace(/\\\s*\n/g,' ');
  
  // v1.0.4 Rev24 NEW: Normalize "1.e4" → "1. e4" and "2...Nf6" → "2... Nf6"
  // BEFORE the eval-extraction loop, so each move is a separate token. Without
  // this, "1.e4" starts with '1' and the loop's /[a-hKQRBNBO]/ check skips it,
  // missing the eval attachment for that move.
  moveText=moveText.replace(/(\d+\.+)(?=[a-hKQRBNBO])/gi,'$1 ');
  
  // v1.0.4 Rev24 NEW: Extract [%eval ...] tags from comments BEFORE stripping
  // them, so we can populate the review eval cache and skip engine analysis
  // for those positions. This implements the "instant recovery from PGN
  // comments" requirement.
  //
  // Format (Lichess convention):
  //   [%eval 0.35]    — 0.35 pawns (35 centipawns), White's perspective
  //   [%eval -1.5]    — -1.5 pawns (-150 cp)
  //   [%eval #5]      — mate in 5 for White
  //   [%eval #-3]     — mate in 3 for Black
  //   [%eval +M5]     — alternate mate notation (rare)
  //
  // Comments are attached to the move that FOLLOWS them in PGN. So a comment
  // like "1. e4 {[%eval 0.2]} e5 {[%eval 0.0]}" attaches the 0.2 eval to the
  // position AFTER e4 (reviewStep 1) and the 0.0 eval to the position AFTER
  // e5 (reviewStep 2). A comment BEFORE the first move attaches to the
  // starting position (reviewStep 0).
  //
  // We walk the movetext tracking "pending eval" — when we see a {[%eval X]},
  // we remember it; when we see the next move SAN, we attach the eval to the
  // post-move position (reviewStep = moveIdx + 1).
  const _extractedEvals=[]; // array of {reviewStep, eval, mate, ...}
  let _pendingEval=null;
  // v1.0.4 Round-5 Rev48 NEW: Extract [%csl ...] and [%cal ...] visual
  // annotation tags AND free-text comments from brace comments BEFORE
  // stripping them. This implements the user requirement: "all valid ()
  // variations and {} comments must be fully received".
  //
  // v1.0.5 Rev50 CRITICAL FIX — comment-to-move attachment:
  // The previous (Rev48) version attached each comment to the NEXT move
  // (treating comments as "pre-move" annotations). This was WRONG per the
  // PGN spec and caused the user-reported bug: "arrows belonging to White's
  // move were displayed on Black's position". In PGN, a comment `{...}`
  // appears AFTER the move it describes (post-move annotation). So:
  //   `1. e4 {[%cal Re4e8]} e5 {[%cal Ge5e1]}`
  //   - `{[%cal Re4e8]}` describes move e4 (moveIdx 0), NOT e5 (moveIdx 1)
  //   - `{[%cal Ge5e1]}` describes move e5 (moveIdx 1), NOT the next move
  // The fix: each comment is attached to the PRECEDING main-line move
  // (the last move seen before the comment). A comment BEFORE the first
  // move attaches to the starting position (moveIdx -1, which we store
  // separately and the display layer handles as "no move" / initial position).
  //
  // v1.0.5 Rev50 CRITICAL FIX — comment merging:
  // The previous version merged ALL pending comments (across different moves)
  // into a single payload. This caused comments from different moves to be
  // concatenated with " | ". The fix: comments are attached IMMEDIATELY when
  // seen (to the preceding move), and only comments that genuinely belong to
  // the SAME move (multiple consecutive `{...}` blocks with no move between
  // them) are merged with " | ". This preserves each comment's relative
  // position with respect to moves, so arrows correctly match their move.
  //
  // We extract three kinds of payload from each `{...}` block:
  //   1. [%csl ...] tags  → array of {color, square}
  //   2. [%cal ...] tags  → array of {color, from, to}
  //   3. Free-text comment (the body minus all [%xxx] tags, trimmed)
  //
  // Variation-internal comments (inside parentheses) are also captured:
  // they attach to the variation's owning main-line move (the last main-line
  // move seen before the variation started), with the comment body prefixed
  // by "[var]" so the display layer can show them inline. The visual
  // annotations from variation comments are MERGED with the main-line move's
  // own annotations (deduplicated by color+square / color+from+to).
  const _extractedAnnotations=[]; // array of {moveIdx, csl:[], cal:[]}
  const _extractedComments=[];    // array of {moveIdx, comment}
  // v1.0.5 Rev50: _lastMoveIdx tracks the index of the last main-line move
  // seen. -1 means "no move seen yet" (comment is pre-first-move → attaches
  // to starting position, stored as moveIdx -1).
  let _lastMoveIdx=-1;
  // v1.0.5 Rev50: per-move pending payload. When a comment is seen, it is
  // immediately attached to _lastMoveIdx. But if MULTIPLE consecutive
  // comments appear for the same move (no move between them), they merge.
  // We track _currentMoveCsl/_currentMoveCal/_currentMoveComment which
  // accumulate for the move at _lastMoveIdx. When a NEW move is seen,
  // we flush (finalize) the current per-move payload and start fresh.
  let _currentMoveCsl=[];         // [%csl] for the move at _lastMoveIdx
  let _currentMoveCal=[];         // [%cal] for the move at _lastMoveIdx
  let _currentMoveComment=null;   // free-text comment for the move at _lastMoveIdx
  let _currentMoveFlushed=true;   // true = no pending per-move payload
  // Walk character-by-character, identifying brace comments and SAN moves.
  // We use a simplified scan: find each `{` ... `}` block, extract any
  // [%eval ...] inside, then advance to the next SAN-like token.
  {
    let _moveCount=0; // main-line move count (will be set properly later)
    let _depth=0; // paren depth
    let _i=0;
    const _mt=moveText;
    // v1.0.5 Rev50: Helper to flush (finalize) the current per-move payload.
    // Called when a NEW move is seen (so the previous move's accumulated
    // comments are committed) or at end-of-loop (trailing comments).
    // If _currentMoveFlushed is true, there's nothing to flush (no comment
    // was seen since the last flush).
    function _flushCurrentMovePayload(){
      if(_currentMoveFlushed)return; // nothing pending
      if(_lastMoveIdx>=0){
        // Attach to the move at _lastMoveIdx
        if(_currentMoveCsl.length>0||_currentMoveCal.length>0){
          _extractedAnnotations.push({moveIdx:_lastMoveIdx,csl:_currentMoveCsl.slice(),cal:_currentMoveCal.slice()});
        }
        if(_currentMoveComment){
          _extractedComments.push({moveIdx:_lastMoveIdx,comment:_currentMoveComment});
        }
      }
      // else: comment before the first move — drop (no move to attach to;
      // the display layer has no "initial position annotation" concept).
      // Reset per-move accumulator
      _currentMoveCsl=[];
      _currentMoveCal=[];
      _currentMoveComment=null;
      _currentMoveFlushed=true;
    }
    while(_i<_mt.length){
      const _ch=_mt[_i];
      if(_ch==='{'){
        // Read until matching '}' (no nesting in standard PGN, but be tolerant)
        // v1.0.4 Rev29: If we reach end-of-string without finding the matching
        // '}', this is an UNCLOSED comment. We treat the rest as the comment
        // body (so any [%eval ...] inside is still extracted), then advance
        // _i past the end of the string to terminate the outer loop.
        let _j=_i+1,_d=1,_body='';
        while(_j<_mt.length&&_d>0){
          if(_mt[_j]==='{')_d++;
          else if(_mt[_j]==='}')_d--;
          if(_d>0)_body+=_mt[_j];
          _j++;
        }
        // v1.0.9 PHASE 52 CRITICAL FIX: only extract position-specific
        //   annotations ([%eval]/[%csl]/[%cal]) from comments at _depth===0
        //   (main line). Comments inside variations (...) describe the
        //   variation's positions, NOT the main-line position. Previously,
        //   a comment inside a variation was parsed and its [%eval]/[%csl]/
        //   [%cal] tags accumulated into the pending per-move payload, which
        //   the NEXT main-line move would flush and attach to ITSELF —
        //   corrupting that main-line move's annotations with variation-
        //   internal data. This manifested as the review board showing wrong
        //   squares/arrows/evals for main-line moves that happened to follow
        //   a variation with annotations.
        //   Fix: skip [%eval]/[%csl]/[%cal] extraction when _depth>0; still
        //   extract free-text comments (with [var] prefix) so variation
        //   commentary remains visible in the move-list comment display.
        //   Still advance _i past the comment body either way.
        if(_depth===0){
        // Extract [%eval ...] from body
        const _em=_body.match(/\[%eval\s+([^\]]+)\]/i);
        if(_em){
          const _val=_em[1].trim();
          let _ev=null,_mate=null;
          if(_val.startsWith('#')){
            // Mate notation: #5, #-3
            const _mn=parseInt(_val.substring(1),10);
            if(!isNaN(_mn)){
              _mate=_mn;
              _ev=_mn>0?99999:-99999;
            }
          }else if(/^[-+]?M\d+$/i.test(_val)){
            // Alternate mate notation: M5, -M3, +M5 (rare, some engines)
            const _sign=_val.startsWith('-')?-1:1;
            const _mn=parseInt(_val.replace(/^[-+]*M/i,''),10);
            if(!isNaN(_mn)){
              _mate=_sign*_mn;
              _ev=_sign>0?99999:-99999;
            }
          }else{
            // Centipawn / pawn value: 0.35, -1.5, +2.00
            const _pawns=parseFloat(_val);
            if(!isNaN(_pawns)){
              _ev=Math.round(_pawns*100);
              _mate=0;
            }
          }
          if(_ev!=null){
            _pendingEval={eval:_ev,mate:_mate||0,depth:0,wdlW:-1,wdlD:-1,wdlL:-1};
          }
        }
        // v1.0.5 Rev50: Extract [%csl ...] and [%cal ...] visual annotations
        // from the comment body. Multiple tags in the same comment are
        // concatenated. Tag format (Lichess/Chessbase standard):
        //   [%csl Gb4,Rc5]    — highlights b4 (Green), c5 (Red)
        //   [%cal Ge2e4,Rg1f3] — arrows e2→e4 (Green), g1→f3 (Red)
        // Color codes: G=Green, R=Red, B=Blue, Y=Yellow (case-sensitive).
        //
        // v1.0.5 Rev50: The extracted annotations accumulate into
        // _currentMoveCsl/_currentMoveCal (per-move, NOT global pending).
        // Multiple consecutive comments for the SAME move merge (because
        // _currentMoveFlushed is false after the first comment, and we keep
        // accumulating into the same arrays). A NEW move triggers a flush.
        {
          const _cslRe=/\[%csl\s+([^\]]+)\]/gi;
          let _cm;
          while((_cm=_cslRe.exec(_body))!==null){
            const _parts=_cm[1].split(',');
            for(const _p of _parts){
              const _pm=_p.trim().match(/^([GRBY])([a-h][1-8])$/);
              if(_pm){
                _currentMoveCsl.push({color:_pm[1],square:_pm[2]});
                _currentMoveFlushed=false;
              }
            }
          }
          const _calRe=/\[%cal\s+([^\]]+)\]/gi;
          while((_cm=_calRe.exec(_body))!==null){
            const _parts=_cm[1].split(',');
            for(const _p of _parts){
              const _pm=_p.trim().match(/^([GRBY])([a-h][1-8])([a-h][1-8])$/);
              if(_pm){
                _currentMoveCal.push({color:_pm[1],from:_pm[2],to:_pm[3]});
                _currentMoveFlushed=false;
              }
            }
          }
        }
        } // end if(_depth===0)
        // v1.0.5 Rev50: Extract free-text comment (body minus all [%xxx] tags).
        // Multiple consecutive comments for the SAME move merge with " | "
        // separator (only when _currentMoveFlushed is false, meaning a comment
        // was already seen for this move). Comments inside variations
        // (depth>0) get a "[var] " prefix so the user can distinguish them.
        // v1.0.9 PHASE 52: free-text comments are extracted at ALL depths
        // (including inside variations) so variation commentary remains
        // visible in the move-list comment display. Only the position-
        // specific [%eval]/[%csl]/[%cal] tags are depth-gated above.
        {
          let _ft=_body.replace(/\[%[a-zA-Z]+\s+[^\]]*\]/g,'').trim();
          // Also strip any leftover [CLK:...], [EMT:...] non-bracketed formats
          _ft=_ft.replace(/\[(?:CLK|EMT|CLOCK|TIME):[^\]]*\]/gi,'').trim();
          if(_ft){
            const _prefix=(_depth>0)?'[var] ':'';
            if(_currentMoveComment){
              _currentMoveComment+=' | '+_prefix+_ft;
            }else{
              _currentMoveComment=_prefix+_ft;
            }
            _currentMoveFlushed=false;
          }
        }
        _i=_j+1;
        continue;
      }
      if(_ch==='('){_depth++;_i++;continue;}
      if(_ch===')'){_depth=Math.max(0,_depth-1);_i++;continue;}
      // Outside parens (depth 0): a non-whitespace token starting a move
      if(_depth===0&&/[a-hKQRBNBO]/.test(_ch)){
        // Check if this looks like a SAN move (not a move number, result, etc.)
        // Read the token
        let _j=_i;
        let _tok='';
        while(_j<_mt.length&&!/[\s{}()]/.test(_mt[_j])){_tok+=_mt[_j];_j++;}
        // Skip move numbers (e.g., "1.", "2..."), results, NAGs
        const _isMoveNum=/^\d+\.+$/.test(_tok);
        const _isResult=/^(1-0|0-1|1\/2-1\/2|\*)$/.test(_tok);
        const _isNag=/^\$\d+$/.test(_tok);
        const _isEllipsis=/^\.+$/.test(_tok);
        if(!_isMoveNum&&!_isResult&&!_isNag&&!_isEllipsis&&_tok.length>0){
          // v1.0.5 Rev50: This is a NEW main-line move. First, flush the
          // per-move payload accumulated for the PREVIOUS move (comments
          // that appeared after the previous move but before this one).
          _flushCurrentMovePayload();
          // Now advance _lastMoveIdx to this new move.
          _moveCount++;
          _lastMoveIdx=_moveCount-1;
          // Reset per-move accumulator for the new move (already done by
          // _flushCurrentMovePayload, but be explicit for clarity).
          _currentMoveCsl=[];
          _currentMoveCal=[];
          _currentMoveComment=null;
          _currentMoveFlushed=true;
          // Attach pending eval to the post-move position.
          // v1.0.7 PHASE 16 BUG FIX: [%eval] in a comment AFTER move N
          // describes the position AFTER move N (Lichess/PGN convention).
          // At this point _moveCount has JUST been incremented for the NEW
          // move we're about to process, so the PREVIOUS move's post-position
          // is reviewStep = _moveCount - 1. The old code used _moveCount
          // (off-by-one — attached to the wrong position, and in the trailing
          // case wrote to a key beyond reviewStates.length).
          // Trace for `1. e4 {[%eval 0.2]} e5`: e4 → _moveCount=1; {[%eval]}
          // sets _pendingEval; e5 → _moveCount=2, then attach. The eval
          // describes the post-e4 position = reviewStep 1 = _moveCount-1. ✓
          // Trace for a leading `{[%eval 0.5]} 1. e4`: _pendingEval set before
          // any move; e4 → _moveCount=1, attach at _moveCount-1=0 = initial
          // position. ✓ (This is the Phase 15 "step 0 cacheable" goal.)
          if(_pendingEval){
            _extractedEvals.push({reviewStep:_moveCount-1,eval:_pendingEval.eval,mate:_pendingEval.mate,depth:_pendingEval.depth,wdlW:_pendingEval.wdlW,wdlD:_pendingEval.wdlD,wdlL:_pendingEval.wdlL});
            _pendingEval=null;
          }
        }
        _i=_j;
        continue;
      }
      _i++;
    }
    // v1.0.5 Rev50: End-of-loop — flush any trailing per-move payload
    // (comments that appeared after the LAST move). This attaches them to
    // the last move (_lastMoveIdx), which is correct per PGN spec.
    _flushCurrentMovePayload();
    // Trailing pending eval (comment after the last move) attaches to the
    // position after the last move. _moveCount = number of moves seen, so
    // the post-last-move position is reviewStep = _moveCount.
    // v1.0.7 PHASE 16 BUG FIX: was _moveCount+1 (off-by-one — wrote to a key
    // beyond reviewStates.length, which is moveRecords.length = _moveCount;
    // valid reviewSteps are 0.._moveCount).
    if(_pendingEval&&_moveCount>=0){
      _extractedEvals.push({reviewStep:_moveCount,eval:_pendingEval.eval,mate:_pendingEval.mate,depth:_pendingEval.depth,wdlW:_pendingEval.wdlW,wdlD:_pendingEval.wdlD,wdlL:_pendingEval.wdlL});
    }
    // Also handle pending eval at the START (before any move) — attaches to
    // reviewStep 0 (the starting position).
    // The above loop already handles this: if _pendingEval is set before
    // the first move, it gets attached when the first move is seen.
    // If no move was seen at all, _pendingEval is lost (acceptable — a PGN
    // with only comments and no moves is malformed anyway).
  }
  
  // Remove comments (brace-style { ... }) — match innermost first for nesting.
  // v1.0.3-p9 audit: iteration cap prevents infinite loop on unmatched `{`.
  // v1.0.4 Rev29: After 10 iterations of innermost-first removal, if any `{`
  // remains, it's an UNCLOSED comment. We must remove it AND everything after
  // it (to end of string) — otherwise the unclosed brace's content gets
  // tokenized as bogus move tokens (e.g. "1. e4 {unclosed comment e5 2. Nf3"
  // was producing tokens "{unclosed", "comment", "e5", "2.", "Nf3" — all
  // rejected as invalid SAN, generating useless NULL placeholders).
  // v1.0.9 PHASE 52 CRITICAL FIX: replace brace comments with a SPACE, not
  //   empty string. The previous empty-string replacement caused moves
  //   adjacent to a `}` (with no whitespace separator) to be CONCATENATED
  //   into a single bogus token. Example from PGN 2Kbug.pgn:
  //     `1. e4{[%emt ...] ...}e5 {[%emt ...] ...} 2. Bd3`
  //   After brace stripping (old): `1. e4e5  2. Bd3`  ← "e4e5" is one token!
  //   The tokenizer rejected "e4e5" as invalid SAN, triggering the 5-skip
  //   cascade-failure path and aborting the parse.
  //   After brace stripping (fixed): `1. e4 e5  2. Bd3`  ← two valid tokens.
  //   The whitespace normalization at line ~490 collapses the double space.
  {let _braceIter=0;while(moveText.includes('{')&&_braceIter++<10)moveText=moveText.replace(/\{[^{}]*\}/g,' ');}
  // v1.0.4 Rev29: Remove unclosed brace + everything to end-of-string.
  // This is the PGN spec's tolerant behavior: an unclosed comment consumes
  // the rest of the movetext. We log a warning so the user knows.
  if(moveText.includes('{')){
    console.warn('_parsePGN: unclosed brace comment detected — truncating movetext from first unclosed {');
    const _idx=moveText.indexOf('{');
    moveText=moveText.substring(0,_idx);
  }
  moveText=moveText.replace(/;[^\n]*/g,'');
  
  // Strip NAGs ($1, $2, etc.)
  let text=moveText.replace(/\$\d+/g,'');
  // Remove game terminators (comprehensive — handle edge cases like trailing spaces)
  text=text.replace(/\b1-0\b/g,'');
  text=text.replace(/\b0-1\b/g,'');
  text=text.replace(/\b1\/2-1\/2\b/g,'');
  text=text.replace(/\*/g,'');
  // Also strip result markers that may have spaces: "1 - 0", "0 - 1", "1/2 - 1/2"
  text=text.replace(/\b1\s+-\s+0\b/g,'');
  text=text.replace(/\b0\s+-\s+1\b/g,'');
  text=text.replace(/\b1\/2\s+-\s+1\/2\b/g,'');
  
  // Normalize whitespace: collapse multiple spaces/newlines into single space
  text=text.replace(/\s+/g,' ').trim();
  
  // Normalize: ensure space after move number dots (e.g. "1.e4" → "1. e4", "2...Nf6" → "2... Nf6")
  text=text.replace(/(\d+\.+(?=[a-zA-Z]))/g,'$1 ');
  // v1.0.3-p5 audit: removed a buggy regex here that added an extra dot to
  // move numbers (turned "1. e4" into "1.. e4"). The first regex above already
  // handles "1.e4" → "1. e4", and the next regex handles "1 e4" → "1. e4".
  // Handle move numbers without dots (e.g. "1 e4 e5 2 Nf3") — add a dot so the
  // move-number regex can detect them. Pattern: standalone number followed by a piece/pawn letter.
  // v1.0.5 Round-6 Rev62 (2026.6.27) FIX: add 'O' to character class. PGN move
  // numbers followed by castling "O-O" without a dot were not being normalized
  // to "1. O-O".
  text=text.replace(/(^|\s)(\d+)\s+(?=[a-hKQRBNO])/g,'$1$2. ');
  // Strip any remaining standalone annotation symbols that survived earlier cleaning
  // Handle 1-5 character annotations (!, !!, !?, ?!, ??, !!!, etc.)
  text=text.replace(/\s[!?]{1,5}\s/g,' ');
  // Also strip annotations at start/end of text
  text=text.replace(/^[!?]{1,5}\s/g,'');
  text=text.replace(/\s[!?]{1,5}$/g,'');
  
  if(!text)return null;
  
  // Tokenize: split into tokens while preserving parentheses as separate tokens.
  // CRITICAL FIX: Pad parentheses with spaces BEFORE tokenizing, so "exd5)" becomes
  // "exd5 )" and the regex can properly split them. Without this, \S+ greedily
  // matches "exd5)" as a single token, causing the variation parser to miss the
  // closing ')' and silently drop all variations (root cause of PGN 🌿Line bug).
  text=text.replace(/\(/g,' ( ').replace(/\)/g,' ) ');
  const rawTokens=text.match(/\(|\)|\S+/g)||[];
  if(rawTokens.length===0)return null;
  
  // ---- Phase 1: Recursive variation tree parser (PGN RAV spec-compliant) ----
  // PGN spec §8.2.5: "An RAV is a sequence of movetext containing one or more
  // moves enclosed in parentheses... the alternate move sequence given by an
  // RAV is one that may be legally played by first unplaying the move that
  // appears immediately prior to the RAV. Because the RAV is a recursive
  // construct, it may be nested."
  //
  // First-principles design:
  //   - Each '(' opens a new variation frame, attached to the LAST move played
  //     in the PARENT context (either the main line or an enclosing variation).
  //   - Each frame tracks its OWN local move index, so a nested '(' attaches
  //     to the correct move within the parent variation (not the main line).
  //   - The result is a tree: root (main line) → variations → sub-variations.
  //   - Phase 2 flattens the tree into the Map<mainMoveIdx, VariationEntry[]>
  //     that importPGN consumes.
  //
  // Bug being fixed (v1.0.1): the previous flat varStack design used a single
  // moveIndexCounter (main-line only). When '(' appeared inside a variation,
  // the inner variation was attached to moveIndexCounter-1 (the main-line
  // move before the OUTER '('), NOT to the correct move within the parent
  // variation. This caused nested RAVs to be misplaced at the wrong main-line
  // move, and they appeared in reverse order before the outer variation.
  // Symptom: "🌿 variations incomplete" after PGN import.

  // Regex to identify move number tokens (e.g. "1.", "2...", "12.")
  const moveNumRe=/^\d+\.+$/;
  // Regex to strip leading move number from combined tokens (e.g. "1.e4" → "e4", "2...Nf3" → "Nf3")
  const moveNumPrefixRe=/^\d+\.+\s*/;
  // Regex to identify ellipsis-only tokens
  const ellipsisRe=/^\.\.\.+$/;
  // Tokens to skip (not chess moves)
  const skipTokens=new Set(['1-0','0-1','1/2-1/2','*']);
  // Regex to identify annotation suffixes (!, ?, !!, ??, !?, ?!, also triple like !!!)
  const annotRe=/[!?]+$/;

  // Tree node structure:
  //   { tokens: string[],          // cleaned SAN tokens of this variation (excluding sub-vars)
  //     subVars: SubVarRef[],      // sub-variations branching from moves in this variation
  //     localMoveIdx: number,      // current move count within this frame (for attach target)
  //     attachToMoveIdx: number,   // index in parent's tokens where this var branches (0..n)
  //     mainMoveIdx: number }      // main-line move index this var ultimately attaches to
  // SubVarRef: { tree: TreeNode, attachToMoveIdx: number, parentPrefix: string[] }
  //
  // For the root (main line), tokens = main-line moves, mainMoveIdx is N/A.
  const rootFrame={tokens:[],subVars:[],localMoveIdx:0,attachToMoveIdx:-1,mainMoveIdx:-1};
  const stack=[rootFrame];

  for(const token of rawTokens){
    if(token==='('){
      // Open a new variation frame, attached to the LAST move in the current frame.
      const parent=stack[stack.length-1];
      // PGN spec: RAV attaches to "the move that appears immediately prior to the RAV".
      // If parent has 0 moves yet (very rare: '(' at start), attach to index 0 by convention.
      const attachIdx=parent.localMoveIdx>0?parent.localMoveIdx-1:0;
      // The main-line move index this variation ultimately attaches to:
      // - For top-level vars: parent.attachToMoveIdx === -1 means parent IS main line,
      //   so mainMoveIdx = attachIdx (the main-line move before this '(').
      // - For nested vars: inherit parent's mainMoveIdx (sub-vars attach to the SAME
      //   main-line move as their parent variation, but branch off mid-variation).
      const mainIdx=(parent===rootFrame)?attachIdx:parent.mainMoveIdx;
      const newFrame={tokens:[],subVars:[],localMoveIdx:0,
                      attachToMoveIdx:attachIdx,mainMoveIdx:mainIdx};
      parent.subVars.push({tree:newFrame,attachToMoveIdx:attachIdx});
      stack.push(newFrame);
      continue;
    }
    if(token===')'){
      if(stack.length>1)stack.pop();
      continue;
    }
    // Skip non-move tokens at any depth
    if(moveNumRe.test(token)||ellipsisRe.test(token)||skipTokens.has(token))continue;
    // Strip move number prefix from combined tokens and annotation suffixes
    const clean=token.replace(moveNumPrefixRe,'').replace(annotRe,'');
    if(!clean)continue;
    // Add to current frame's tokens and increment local move index
    const frame=stack[stack.length-1];
    frame.tokens.push(clean);
    frame.localMoveIdx++;
  }

  // ---- Phase 2: Flatten the variation tree into Map<mainMoveIdx, VariationEntry[]> ----
  // Each VariationEntry = { sanTokens: string[] } where sanTokens includes the
  // parent variation's prefix moves up to (but not including) the branching move,
  // so the resulting token array can be replayed from the start position.
  //
  // Rationale: importPGN replays each variation's tokens from a known state
  // (either preMoveState or postMoveState of the main-line move). For nested
  // variations, the "branching state" is reached by replaying the parent
  // variation's moves up to the branching point. We embed that prefix directly
  // in the sanTokens so the existing Type A/B matching logic in importPGN
  // handles them uniformly.
  const variations=new Map();
  function _flattenVariationTree(frame, parentPrefixTokens){
    // Emit this variation's own tokens (with parent prefix prepended)
    if(frame.tokens.length>0){
      const combinedSanTokens=parentPrefixTokens.concat(frame.tokens);
      const mi=frame.mainMoveIdx;
      if(!variations.has(mi))variations.set(mi,[]);
      variations.get(mi).push({sanTokens:combinedSanTokens});
    }
    // Recurse into sub-variations.
    // For each sub-var, the prefix is: parentPrefixTokens + frame.tokens[0..attachToMoveIdx-1]
    // (i.e., everything played BEFORE the branching move, since the sub-var's first
    // move REPLACES the branching move per PGN spec).
    for(const sv of frame.subVars){
      const subPrefix=parentPrefixTokens.concat(frame.tokens.slice(0, sv.attachToMoveIdx));
      _flattenVariationTree(sv.tree, subPrefix);
    }
  }
  // Flatten top-level variations (children of rootFrame).
  // For top-level vars, parentPrefixTokens is empty (they branch from the main line).
  for(const sv of rootFrame.subVars){
    _flattenVariationTree(sv.tree, []);
  }
  
  // ---- Phase 3: Rebuild clean main-line tokens ----
  // Walk rawTokens at depth 0 (outside all variations) and collect main-line SAN moves.
  let mainTokens=[];
  let inVar=0;
  for(const token of rawTokens){
    if(token==='('){inVar++;continue;}
    if(token===')'){inVar=Math.max(0,inVar-1);continue;}
    if(inVar>0)continue;
    if(moveNumRe.test(token)||ellipsisRe.test(token)||skipTokens.has(token))continue;
    // Strip leading move number prefix from combined tokens (e.g. "1.e4" → "e4")
    // and strip annotation suffixes from main-line tokens
    const clean=token.replace(moveNumPrefixRe,'').replace(annotRe,'');
    if(clean)mainTokens.push(clean);
  }
  
  if(mainTokens.length===0)return null;
  
  // ---- Phase 4: Replay main-line moves using _applySANMove ----
  let state=startFEN?fenToState(startFEN):initState();
  if(!state)return null;
  
  const moves=[]; // array of { notation, move, state (post-move), mainTokenIdx, skipped?:true }
  
  // v1.0.1 FIX: Track the original mainToken index for each valid move.
  // If a main-line token fails to parse (rare but possible with malformed PGN),
  // it's skipped in `moves` but its index is still used as a key in the
  // `variations` Map. Without this tracking, variations attached to moves
  // AFTER the invalid token would be looked up at the wrong index and silently
  // dropped — manifesting as "incomplete variations" after PGN import.
  //
  // v1.0.3 patch FIX (cascade-failure): when a token fails to parse, we now
  // (1) push a "skipped" placeholder entry so moveRecords indices stay aligned
  // with PGN move numbers (the display layer renders these as a dimmed "—"
  // marker, similar to the null black-to-move placeholder);
  // (2) ADVANCE the side-to-move (and fullMoveNumber if black was to move) so
  // subsequent tokens have a chance to parse.
  // Previously, a single invalid token would leave the side-to-move unchanged,
  // causing EVERY subsequent token to also fail (because it'd be the wrong
  // side's move) — manifesting as "only the first N moves import, the rest
  // are silently dropped". With this fix, a malformed PGN (e.g., one illegal
  // move) imports all the OTHER moves correctly, with a single "—" marker
  // where the illegal move was.
  let _consecutiveSkips=0;
  for(let ti=0;ti<mainTokens.length;ti++){
    const token=mainTokens[ti];
    const result=_applySANMove(state,token);
    if(!result){
      // Could not parse — skip this token (DroidFish-style lazy validation).
      // v1.0.3 patch: advance the side-to-move so subsequent tokens (which
      // belong to the OTHER side per PGN alternation) have a chance to
      // parse. Without this advance, a single bad token derails the entire
      // rest of the game. Also bump fullMoveNumber when black was to move,
      // so move-number display stays in sync with PGN move numbers.
      console.warn('_parsePGN: skipping invalid main-line token at index',ti,':',token);
      // Push a "skipped" placeholder so moveRecords indices stay aligned
      // with PGN move numbers. The display layer renders this as a dimmed
      // "—" marker, making it clear to the user that this specific move
      // failed to parse (rather than silently dropping it and shifting
      // all subsequent move numbers).
      moves.push({notation:null,move:null,state:state,mainTokenIdx:ti,skipped:true,skippedSAN:token});
      if(state.currentTurn==='black'){
        state.fullMoveNumber=(state.fullMoveNumber||1)+1;
      }
      state.currentTurn=state.currentTurn==='white'?'black':'white';
      _consecutiveSkips++;
      // v1.1.0 Phase 54: Increased cascade limit from 5 to 15 (proportional to
      //   token count). 5 was too aggressive for localized PGN corruption
      //   (e.g., OCR errors in moves 40-44 of an 80-move game) — moves 45+
      //   were silently dropped. With 15, localized glitches are skipped but
      //   truly hopeless PGNs still abort. The threshold scales with game
      //   length: Math.max(15, mainTokens.length * 0.1).
      const _skipLimit=Math.max(15, Math.floor(mainTokens.length*0.1));
      if(_consecutiveSkips>=_skipLimit){
        console.warn('_parsePGN: '+_skipLimit+' consecutive invalid tokens — stopping parse');
        break;
      }
      continue;
    }
    _consecutiveSkips=0;
    result.mainTokenIdx=ti;
    moves.push(result);
    state=result.state;
  }
  
  if(moves.length===0)return null;
  // v1.0.4 Round-5 Rev48: also return the extracted visual annotations and
  // free-text comments so importPGN can populate the visual annotations cache
  // and mr.comment field — preserving all {} comment information.
  return{moves,startFEN,variations,variant:pgnVariant,
         extractedEvals:_extractedEvals,
         extractedAnnotations:_extractedAnnotations,
         extractedComments:_extractedComments};
}

// Apply a single SAN move to a game state, returning the new state + notation + move
// Returns null if the move is invalid.
// Uses DroidFish-style constraint-based SAN matching (TextIO.stringToMove):
//   1. Parse piece type, disambiguation file/rank, destination, promotion from SAN
//   2. Match against all legal moves using those constraints
//   3. If multiple candidates remain, try requiring capture if 'x' present
//   4. If still ambiguous, try all legal moves and match by moveAlg output
function _applySANMove(state,san){
  if(!state||!san||typeof san!=='string')return null;
  // Strip leading move number prefix if present (e.g. "1.e4" → "e4", "2...Nf3" → "Nf3")
  san=san.replace(/^\d+\.+\s*/,'');
  // Clean up the SAN notation: strip check/mate/annotation suffixes
  let cleanSAN=san.replace(/[!?]+$/,'').replace(/[+#]+$/,'');
  if(!cleanSAN)return null;
  
  // Castling — support multiple common notations (O-O, 0-0, o-o, etc.)
  // v1.0.6: Chess960-aware — find the king's ACTUAL column instead of
  // hardcoding col 4 (e1). In Chess960, the king can start on any column
  // b1-g1. The king always castles to col 6 (kingside) or col 2 (queenside).
  const upperSAN=cleanSAN.toUpperCase();
  if(upperSAN==='O-O'||cleanSAN==='0-0'){
    const row=state.currentTurn==='white'?7:0;
    let kingCol=4; // default: standard chess
    for(let c=0;c<8;c++){const p=state.board[row][c];if(p&&p.type==='king'&&p.color===state.currentTurn){kingCol=c;break;}}
    const kingFrom={row,col:kingCol};
    const kingTo={row,col:6};
    const move=_findLegalMove(state,kingFrom,kingTo,'king');
    if(move)return _executeAndRecord(state,move,'O-O');
    return null;
  }
  if(upperSAN==='O-O-O'||cleanSAN==='0-0-0'){
    const row=state.currentTurn==='white'?7:0;
    let kingCol=4; // default: standard chess
    for(let c=0;c<8;c++){const p=state.board[row][c];if(p&&p.type==='king'&&p.color===state.currentTurn){kingCol=c;break;}}
    const kingFrom={row,col:kingCol};
    const kingTo={row,col:2};
    const move=_findLegalMove(state,kingFrom,kingTo,'king');
    if(move)return _executeAndRecord(state,move,'O-O-O');
    return null;
  }
  
  // Parse SAN: [Piece][disambiguation][x][destination][=Promotion]
  // Piece: K, Q, R, B, N (absent for pawn)
  let idx=0;
  let pieceType='pawn';
  if(cleanSAN[0]==='K'){pieceType='king';idx=1;}
  else if(cleanSAN[0]==='Q'){pieceType='queen';idx=1;}
  else if(cleanSAN[0]==='R'){pieceType='rook';idx=1;}
  else if(cleanSAN[0]==='B'){pieceType='bishop';idx=1;}
  else if(cleanSAN[0]==='N'){pieceType='knight';idx=1;}
  
  // Check for promotion at the end
  let promotion=null;
  const promoMatch=cleanSAN.match(/=([QRBN])/i);
  if(promoMatch){
    const promoChar=promoMatch[1].toUpperCase();
    promotion=promoChar==='Q'?'queen':promoChar==='R'?'rook':promoChar==='B'?'bishop':'knight';
    cleanSAN=cleanSAN.replace(/=[QRBN]/i,'');
  }
  // Also handle pawn promotion without = sign (e.g. e8Q instead of e8=Q)
  if(pieceType==='pawn'&&cleanSAN.length>=3){
    const lastChar=cleanSAN[cleanSAN.length-1];
    if(lastChar==='Q'||lastChar==='R'||lastChar==='B'||lastChar==='N'){
      promotion=lastChar==='Q'?'queen':lastChar==='R'?'rook':lastChar==='B'?'bishop':'knight';
      cleanSAN=cleanSAN.slice(0,-1);
    }
  }
  
  // Destination square is always the last two characters
  if(cleanSAN.length<2)return null;
  const destStr=cleanSAN.slice(-2);
  if(!destStr||typeof destStr!=='string'||destStr.length<2)return null;
  let destCol,destRow;
  try{
    destCol=destStr.charCodeAt(0)-97;
    destRow=8-parseInt(destStr[1],10);
  }catch(e){return null;}
  if(destCol<0||destCol>7||destRow<0||destRow>7||isNaN(destRow))return null;
  
  // Disambiguation: everything between piece letter and destination
  let disambig=cleanSAN.slice(idx,-2);
  // Remove capture markers ('x' and ':' — colon capture notation is rare but valid)
  disambig=disambig.replace(/[x:]/g,'');
  
  let disambigFile=-1,disambigRank=-1;
  for(const ch of disambig){
    if(ch>='a'&&ch<='h')disambigFile=ch.charCodeAt(0)-97;
    else if(ch>='1'&&ch<='8')disambigRank=8-parseInt(ch,10);
  }
  
  // Determine if capture was indicated in original SAN
  const hasCapture=san.includes('x')||san.includes(':');
  
  // Handle pawn capture disambiguation without 'x' (e.g. "ed5" — pawn on e-file takes on d5).
  // When pieceType is pawn, disambigFile is set, and no capture marker was present,
  // treat the file letter as the originating file for a capture move.
  const isPawnCaptureNoX=pieceType==='pawn'&&disambigFile>=0&&!hasCapture;
  
  // Find all legal moves for this piece type to the destination (constraint-based matching)
  const allMoves=legalMoves(state,null);
  let candidates=allMoves.filter(m=>{
    const piece=state.board[m.from.row][m.from.col];
    if(!piece||piece.type!==pieceType||piece.color!==state.currentTurn)return false;
    if(m.to.row!==destRow||m.to.col!==destCol)return false;
    if(disambigFile>=0&&m.from.col!==disambigFile)return false;
    if(disambigRank>=0&&m.from.row!==disambigRank)return false;
    if(promotion&&m.promotion!==promotion)return false;
    if(!promotion&&m.promotion&&pieceType==='pawn')return false; // non-promotion pawn move
    return true;
  });
  
  // DroidFish-style: if multiple candidates, try requiring capture
  if(candidates.length>1&&hasCapture){
    const capCandidates=candidates.filter(m=>{
      return !!state.board[m.to.row][m.to.col]||
        (pieceType==='pawn'&&state.enPassantTarget&&m.to.row===state.enPassantTarget.row&&m.to.col===state.enPassantTarget.col);
    });
    if(capCandidates.length===1)candidates=capCandidates;
  }
  
  // Pawn capture without 'x': if we have multiple pawn candidates and disambigFile is set,
  // prefer capture moves (piece on destination or en passant)
  if(candidates.length>1&&isPawnCaptureNoX){
    const capCandidates=candidates.filter(m=>{
      return !!state.board[m.to.row][m.to.col]||
        (state.enPassantTarget&&m.to.row===state.enPassantTarget.row&&m.to.col===state.enPassantTarget.col);
    });
    if(capCandidates.length===1)candidates=capCandidates;
  }
  
  // If still ambiguous, try matching by moveAlg output (DroidFish-style fallback)
  if(candidates.length>1){
    const sanClean=san.replace(/[+#!?]+$/,'');
    for(const m of candidates){
      try{
        const preState=state;
        const postState=makeMv(preState,m);
        const alg=moveAlg(preState,m,postState);
        if(alg===sanClean||alg.replace(/[+#!?]+$/,'')===sanClean){
          return _executeAndRecord(state,m,alg);
        }
      }catch(e){}
    }
  }
  
  if(candidates.length!==1)return null; // Ambiguous or no match
  
  const move=candidates[0];
  // Build proper notation using moveAlg (ensures correct disambiguation)
  try{
    const preState=state;
    const postState=makeMv(preState,move);
    const notation=moveAlg(preState,move,postState);
    return _executeAndRecord(state,move,notation);
  }catch(e){
    return _executeAndRecord(state,move,san);
  }
}

function _findLegalMove(state,from,to,pieceType){
  const allMoves=legalMoves(state,null);
  return allMoves.find(m=>{
    const piece=state.board[m.from.row][m.from.col];
    return piece&&piece.type===pieceType&&piece.color===state.currentTurn&&
           m.from.row===from.row&&m.from.col===from.col&&
           m.to.row===to.row&&m.to.col===to.col;
  })||null;
}

function _executeAndRecord(state,move,notation){
  // Defensive: validate move object before proceeding
  if(!move||!move.from||!move.to||typeof move.from.row!=='number'||typeof move.from.col!=='number'||typeof move.to.row!=='number'||typeof move.to.col!=='number')return null;
  const undoInfo=makeMvInPlace(state,move);
  // makeMvInPlace mutates state in place and returns undo info, NOT the post-move state.
  // After the call, 'state' IS the post-move state.
  // Determine check status using the mutated post-move state
  // After makeMvInPlace, currentTurn has already switched to the opponent's turn
  const oppColor=state.currentTurn; // side to move next (might be in check)
  const oppKing=oppColor==='white'?state.wk:state.bk;
  const isCheck=oppKing?inCheck(state.board,oppColor,oppKing):false;
  // Add check/mate symbols to notation if not already present
  if(!notation.includes('+')&&!notation.includes('#')){
    if(isCheck){
      if(!hasLegalMoves(state))notation+='#';
      else notation+='+';
    }
  }
  return{state,notation,move,time:null};
}

function importPGN(pgnText){
  if(!pgnText||typeof pgnText!=='string')return;
  try{
  // Reject FEN-only input — Paste PGN only accepts PGN format
  const trimmed=pgnText.trim();
  // Robust FEN detection: FEN has exactly 8 ranks separated by '/',
  // no PGN header tags, no move numbers, and no parenthesized variations
  const firstLine=trimmed.split('\n')[0].trim();
  const looksLikeFEN=firstLine.includes('/')&&firstLine.split('/').length===8&&!firstLine.includes('[')&&!firstLine.includes('(')&&!firstLine.match(/\d+\./);
  if(looksLikeFEN){
    showToast(T('pgn_fen_rejected'),2500);
    return;
  }
  // Additional heuristic: if the entire text can be parsed as FEN, reject it
  if(fenToState(trimmed)){
    showToast(T('pgn_fen_rejected'),2500);
    return;
  }
  const result=_parsePGN(pgnText);
  if(!result||!result.moves||!result.moves.length){showToast(T('pgn_invalid'),2000);return;}
  // Start from FEN or initial position
  // v1.0.8 PHASE 49: validate startState BEFORE clearing _reviewEvalCache and
  //   toggling Chess960 mode. The old order (clear cache + set Chess960 first,
  //   then validate startState) destroyed ALL persisted evals AND corrupted
  //   the current game's Chess960 mode when a PGN had a valid movetext but an
  //   invalid [FEN] tag — even though the import ultimately failed. Now the
  //   side effects only run once we know the import will succeed.
  const startState=result.startFEN?fenToState(result.startFEN):initState();
  if(!startState){showToast(T('pgn_invalid'),2000);return;}
  // v1.0.7 BUG FIX:
  // Clear _reviewEvalCache before importing a new PGN — see _startGameImpl()
  // for rationale (cache is keyed by per-game reviewStep, switching games
  // invalidates the entire key space).
  try{
    if(typeof _reviewEvalCache!=='undefined'&&_reviewEvalCache){
      _reviewEvalCache.clear();
    }
    if(typeof _reviewEvalRequestedStep!=='undefined')_reviewEvalRequestedStep=-1;
  }catch(e){console.warn('importPGN: review eval cache clear failed',e);}
  
  // v1.0.4 NEW: Detect Chess960 variant from PGN [Variant] tag.
  // If detected, enable Chess960 engine mode and set gameVariant for PGN round-trip.
  if(result.variant==='chess960'){
    if(typeof setChess960Mode==='function')setChess960Mode(true);
    if(typeof gameVariant!=='undefined')gameVariant='chess960';
    if(typeof gameSPID!=='undefined'){
      // Try to derive SP-ID from the starting FEN's back rank
      if(result.startFEN&&typeof backRankToSPID==='function'){
        // FEN row 8 (top) is for black; we look at row 1 (bottom) for white's pieces
        const fenRows=result.startFEN.split(' ')[0].split('/');
        if(fenRows.length===8){
          // White's back rank is fenRows[7] (last element, row 1 in chess notation)
          const whiteRow=fenRows[7];
          const backRank=[];
          let idx=0;
          for(const ch of whiteRow){
            if(ch>='1'&&ch<='8'){for(let k=0;k<parseInt(ch,10);k++){backRank[idx++]=null;}}
            else{
              const t=ch.toLowerCase()==='r'?'rook':ch.toLowerCase()==='n'?'knight':ch.toLowerCase()==='b'?'bishop':ch.toLowerCase()==='q'?'queen':ch.toLowerCase()==='k'?'king':null;
              if(t)backRank[idx++]=t;
            }
          }
          if(idx===8){
            const spid=backRankToSPID(backRank);
            if(spid>=0)gameSPID=spid;
          }
        }
      }
    }
  }else{
    if(typeof setChess960Mode==='function')setChess960Mode(false);
    if(typeof gameVariant!=='undefined')gameVariant=null;
    if(typeof gameSPID!=='undefined')gameSPID=null;
  }
  
  // v1.0.6 FIX: Preserve the imported start FEN so PGN round-trip export
  // includes the [SetUp "1"] and [FEN "..."] headers. Previously, importPGN()
  // consumed result.startFEN to build startState but never assigned it to
  // _setupFEN, so _buildPGNString() emitted neither header on export.
  // _startGameImpl() (ui.js) clears _setupFEN=null on new game, so this
  // assignment is safe — it only persists until the next new-game action.
  // v1.1.1 Phase 61: _setupFEN assignment moved AFTER _resetGameUIState()
  //   (which now clears _setupFEN as part of the centralized cache reset).
  //   We capture the value here and assign it after the reset below.
  const _importedSetupFEN = (result.startFEN && typeof _setupFEN!=='undefined') ? result.startFEN : null;
  // v1.0.4: If the PGN declared Chess960, mark the start state too
  if(result.variant==='chess960'){
    startState.chess960=true;
    if(typeof gameSPID!=='undefined'&&gameSPID!=null)startState.spid=gameSPID;
  }
  
  // v1.0.3: Track the FEN's starting move number so the move list / PGN export
  // can display correct move numbers (e.g., "4. Bxf7+ Kxf7 5. Ne5" instead of
  // "1. Bxf7+ Kxf7 2. Ne5" when the FEN starts at move 4). For the standard
  // initial position, this is 1 (no change in behavior).
  // v1.1.1 Phase 61: _importedStartMoveNum assignment moved AFTER _resetGameUIState().
  //   We capture the value here and assign it after the reset below.
  const _importedStartMoveNumVal = (startState.fullMoveNumber&&startState.fullMoveNumber>0)?startState.fullMoveNumber:1;
  
  // v1.1.1 Phase 61: _resetGameUIState() now clears ALL per-game caches centrally.
  //   We call it FIRST, then set the PGN-import-specific values AFTER so they
  //   survive the reset.
  gameState=startState;_resetGameUIState();gameOverSoundPlayed=false;
  // v1.1.1 Phase 61: Set PGN-import-specific values (after reset).
  if(_importedSetupFEN!==null&&typeof _setupFEN!=='undefined'){
    _setupFEN=_importedSetupFEN;
  }
  if(typeof _importedStartMoveNum!=='undefined'){
    _importedStartMoveNum=_importedStartMoveNumVal;
  }
  _cachedStatus=null;_cachedStatusKey='';
  _updateEvalDisplay();
  // _reviewEvalCache was cleared by _resetGameUIState() — we populate it
  // below from the PGN's [%eval ...] comments (if any).
  reviewMode=false;setupMode=false;showNewGameDialog=false;
  gameOver=null;_gameOverStatusKey=null;selectedSquare=null;legalMvs=[];legalSet=new Set();
  lastMove=null;pendingPromotion=null;
  _aiBarInfo='';_hintBarInfo='';
  stateHistory=[];moveRecords=[];
  hintText='';isHintLoading=false;
  setupHistory=[];setupErrors=[];
  _ecoEnabled=false;
  reviewBaseState=cloneS(gameState);
  
  // v1.0.4 Rev24: Extract player names from PGN headers — used by _buildPGNString
  // for [White "..."]/[Black "..."] tags, and to detect if the human player's
  // name should be updated. We use the global playerWhite/playerBlack variables
  // (declared in ai-bridge.js). If the PGN's White/Black matches the human
  // player's slot, we also update _humanPlayerName (the rename feature).
  try{
    if(typeof playerWhite!=='undefined'){
      // Parse headers from the raw PGN text (the result object doesn't expose them directly)
      const _wm=pgnText.match(/\[White\s+"([^"]*)"\]/i);
      const _bm=pgnText.match(/\[Black\s+"([^"]*)"\]/i);
      if(_wm)playerWhite=_wm[1];
      else playerWhite=undefined;
      if(_bm)playerBlack=_bm[1];
      else playerBlack=undefined;
      // If the human player's slot has a name (and it's not the default "你"/"You"
      // or "AI对手"/"AI Opponent"), persist it as the renamed human name.
      const _humanSlot=playerColor;
      const _humanName=_humanSlot==='white'?playerWhite:playerBlack;
      if(_humanName&&typeof _humanPlayerName!=='undefined'){
        const _isDefault=(_humanName===T('you')||_humanName==='你'||_humanName==='You'||_humanName===T('ai_opponent')||_humanName==='AI对手'||_humanName==='AI Opponent'||/Lv\.\d/.test(_humanName)||/SL/.test(_humanName));
        if(!_isDefault){
          _humanPlayerName=_humanName;
          try{if(typeof AndroidBridge!=='undefined'&&AndroidBridge.persistentSet)AndroidBridge.persistentSet('Regalia_humanName',_humanName);}catch(e){}
        }
      }
    }
  }catch(e){console.warn('importPGN: player name extraction failed',e);}
  
  // v1.0.2 FIX: Black-to-move opening move record fix.
  // If the PGN's [FEN] header (or the start position) has black to move, prepend
  // null placeholder so the first replayed move (black's) lands in the black slot.
  _prependBlackToMovePlaceholder();
  
  // Replay all moves using the _parsePGN results which already have
  // validated moves with correct notation and post-move states.
  let moveIdx=0;
  let replayState=startState;
  
  for(const parsedMove of result.moves){
    // v1.0.3 patch: handle "skipped" placeholder moves (invalid SAN that
    // couldn't be parsed). Push a null moveRecord so moveRecords indices
    // stay aligned with PGN move numbers. The display layer renders null
    // entries as a dimmed "—" marker (same as the black-to-move placeholder).
    if(parsedMove&&parsedMove.skipped){
      stateHistory.push({state:cloneS(replayState),moveRecords:[...moveRecords],lastMove:lastMove?{...lastMove}:null,selectedSquare:null});
      moveRecords.push(null);
      moveIdx++;
      continue;
    }
    // Bug 2 fix: Null check for parsedMove.move.from/to before accessing .row
    if(!parsedMove||!parsedMove.move||!parsedMove.move.from||!parsedMove.move.to){
      console.error('importPGN: skipping move with null from/to at index',moveIdx);
      moveIdx++;continue;
    }
    const from=parsedMove.move.from;
    const to=parsedMove.move.to;
    // Validate from/to have proper row/col before accessing board
    if(typeof from.row!=='number'||typeof from.col!=='number'||typeof to.row!=='number'||typeof to.col!=='number'){
      console.error('importPGN: skipping move with invalid from/to at index',moveIdx,'from=',from,'to=',to);
      moveIdx++;continue;
    }
    const piece=replayState.board[from.row][from.col];
    if(!piece){moveIdx++;continue;}
    
    // Save pre-move state for stateHistory and variations
    const preMoveState=cloneS(replayState);
    const undoInfo=makeMvInPlace(replayState,parsedMove.move);
    
    // Build proper notation using moveAlg for correct disambiguation per PGN spec
    let properNotation;
    try{properNotation=moveAlg(preMoveState,parsedMove.move,replayState);}catch(e){properNotation=parsedMove.notation||'';}
    
    // Build variations for this move from PGN
    // v1.0.1 FIX: Use parsedMove.mainTokenIdx (original main-line token index)
    // instead of moveIdx (which only counts valid moves). This ensures variations
    // are correctly looked up even if some main-line tokens were skipped during parsing.
    const _varKey=(parsedMove.mainTokenIdx!=null)?parsedMove.mainTokenIdx:moveIdx;
    const pgnVars=result.variations&&result.variations.get(_varKey);
    const varEntries=[];
    if(pgnVars&&pgnVars.length>0){
      const postMoveState=replayState; // read-only: replayState already updated by makeMvInPlace
      const branchMoveIsWhite=preMoveState.currentTurn==='white';
      const branchMoveNum=preMoveState.fullMoveNumber||Math.floor(moveIdx/2)+1;
      for(let vi=0;vi<pgnVars.length;vi++){
        let _typeBPrefixEllipsis=false; // v1.0.2: flag for Type B prefix "..."
        let _typeBPrefixNum=0; // v1.0.2: the move number for the "N..." prefix
        // v1.0.1: Each entry is now an object with .sanTokens (was a bare array).
        // For nested variations, sanTokens already includes the parent variation's
        // prefix moves, so the entire array replays from the start position.
        const vEntry=pgnVars[vi];
        const vTokens=(vEntry&&vEntry.sanTokens)?vEntry.sanTokens:vEntry; // backward-compatible
        const sanParts=[];
        let vState=null, vIsWhite, vMoveNum, startIdx=0;
        // PGN variations can start from either side:
        //   Type A: same side as branching move (alternative to the branching move itself)
        //   Type B: opponent's response (continuation after the branching move)
        if(vTokens.length>0){
          // Attempt Type A first: first token matches from preMoveState (same side)
          const tryA=_applySANMove(cloneS(preMoveState),vTokens[0]);
          if(tryA){
            vState=tryA.state;
            vIsWhite=branchMoveIsWhite;
            vMoveNum=branchMoveNum;
            startIdx=1; // first token already applied
            sanParts.push(tryA.notation);
          }else{
            // Fallback Type A: try moveAlg matching from preMoveState.
            // v1.0.1: Some PGNs use slightly non-standard SAN (e.g., missing
            // disambiguation, or check suffixes that confuse _applySANMove).
            // moveAlg-based matching is more forgiving and recovers these cases.
            const fbAState=cloneS(preMoveState);
            const fbAMoves=legalMoves(fbAState,null);
            let fbAMatch=null;
            for(const vm of fbAMoves){
              const vAlg=moveAlg(fbAState,vm);
              if(vAlg.replace(/[+#!?]+$/,'')===vTokens[0].replace(/[+#!?]+$/,'')){fbAMatch=vm;break;}
            }
            if(fbAMatch){
              sanParts.push(moveAlg(fbAState,fbAMatch));
              makeMvInPlace(fbAState,fbAMatch);
              vState=fbAState;
              vIsWhite=branchMoveIsWhite;
              vMoveNum=branchMoveNum;
              startIdx=1;
            }else{
              // Attempt Type B: first token matches from postMoveState (opponent's side)
              // v1.0.2 FIX (PGN spec): For Type B variations (continuation after the
              // branching move), the variation should start with the owning move's
              // move number. If the owning move is Black's and the variation starts
              // with White, the display is "N... (N+1).WhiteMove BlackMove ..." where
              // N... is the ellipsis prefix indicating the Black branch point.
              const tryB=_applySANMove(cloneS(postMoveState),vTokens[0]);
              if(tryB){
                vState=tryB.state;
                vIsWhite=!branchMoveIsWhite;
                // v1.0.2: varMoveNum should be the actual move number of the
                // variation's first move. If owning is Black (branchMoveIsWhite=false),
                // the variation's first White move is at branchMoveNum+1.
                // If owning is White (branchMoveIsWhite=true), the variation's
                // first Black move is at branchMoveNum.
                vMoveNum=branchMoveIsWhite?branchMoveNum:(branchMoveNum+1);
                // prefixEllipsis: show "N..." when the owning move is Black's
                // and the variation starts with White's next move.
                _typeBPrefixEllipsis=!branchMoveIsWhite;
                _typeBPrefixNum=branchMoveNum;
                startIdx=1;
                sanParts.push(tryB.notation);
              }else{
                // Fallback Type B: try moveAlg matching from postMoveState
                const fbState=cloneS(postMoveState);
                const fbMoves=legalMoves(fbState,null);
                let fbMatch=null;
                for(const vm of fbMoves){
                  const vAlg=moveAlg(fbState,vm);
                  if(vAlg.replace(/[+#!?]+$/,'')===vTokens[0].replace(/[+#!?]+$/,'')){fbMatch=vm;break;}
                }
                if(fbMatch){
                  sanParts.push(moveAlg(fbState,fbMatch));
                  makeMvInPlace(fbState,fbMatch);
                  vState=fbState;
                  vIsWhite=!branchMoveIsWhite;
                  vMoveNum=branchMoveIsWhite?branchMoveNum:(branchMoveNum+1);
                  _typeBPrefixEllipsis=!branchMoveIsWhite;
                  _typeBPrefixNum=branchMoveNum;
                  startIdx=1;
                }
              }
            }
          }
        }
        if(!vState){
          // v1.0.1: Log dropped variations for diagnostics — helps identify which
          // PGN inputs are losing variations and why.
          console.warn('importPGN: could not match first variation token, dropping. vTokens[0]=',vTokens[0],'branchMoveIsWhite=',branchMoveIsWhite);
          continue;
        }
        const initialVIsWhite=vIsWhite;
        const initialVMoveNum=vMoveNum;

        // v1.0.2 FIX: Replace the previous `break` on unparseable token with
        // `continue` so that ONE malformed SAN in the middle of a variation
        // doesn't TRUNCATE the entire variation. The previous behavior
        // manifest as "variation segments incomplete" — only the moves up to
        // the first unparseable token were displayed.
        // Also unified the moveAlg fallback so EVERY token (not just the first)
        // gets the same forgiving matching that the first token already had.
        // v1.0.2 FIX (first-principles re-audit): when a token is unparseable
        // and skipped, the side-to-move and move number MUST still advance —
        // otherwise the next token (which alternates side per PGN spec) would
        // be assigned to the wrong side, desynchronizing the entire remaining
        // variation. The skipped token still "occupies" a move slot in the
        // variation sequence even though no actual move was made on the board.
        for(let ti=startIdx;ti<vTokens.length;ti++){
          const vToken=vTokens[ti];
          const vResult=_applySANMove(vState,vToken);
          if(!vResult){
            const vAllMoves=legalMoves(vState,null);
            let vMatched=null;
            const vTokenClean=vToken.replace(/[+#!?]+$/,'');
            for(const vm of vAllMoves){
              const vAlg=moveAlg(vState,vm).replace(/[+#!?]+$/,'');
              if(vAlg===vTokenClean){vMatched=vm;break;}
            }
            if(!vMatched){
              // v1.0.2: skip this token but CONTINUE parsing the rest of the
              // variation — do not abort the whole variation. Advance the
              // side-to-move + move number so the next token is correctly
              // attributed (a skipped move still consumes a turn per PGN spec).
              console.warn('importPGN: skipping unparseable variation token at',ti,'token=',vToken);
              if(!vIsWhite)vMoveNum++;
              vIsWhite=!vIsWhite;
              continue;
            }
            sanParts.push(moveAlg(vState,vMatched));
            if(!vIsWhite)vMoveNum++;
            vIsWhite=!vIsWhite;
            makeMvInPlace(vState,vMatched);
          }else{
            sanParts.push(vResult.notation);
            if(!vIsWhite)vMoveNum++;
            vIsWhite=!vIsWhite;
            vState=vResult.state;
          }
        }

        if(sanParts.length>0){
          varEntries.push({
            group:'pgn',
            san:sanParts.join(' '),
            varMoveNum:initialVMoveNum,
            firstMoveIsWhite:initialVIsWhite,
            lineNum:vi+1,
            // v1.0.2: prefixEllipsis — when true, prepend "N..." before the
            // variation's first White move to indicate the Black move is the
            // branch point (per PGN spec and user requirement).
            prefixEllipsis:!!_typeBPrefixEllipsis,
            prefixEllipsisNum:_typeBPrefixNum
          });
        }
        _typeBPrefixEllipsis=false;
        _typeBPrefixNum=0;
      }
    }
    
    const capPiece=undoInfo?undoInfo.capPiece:null;
    // Validate from/to: must be valid algebraic strings (posAlg output) for consistent moveRecords format
    let fromAlg=typeof from==='object'&&from!==null&&('row' in from)&&('col' in from)?posAlg(from):String(from);
    let toAlg=typeof to==='object'&&to!==null&&('row' in to)&&('col' in to)?posAlg(to):String(to);
    // Bug 1 fix: Validate that fromAlg/toAlg are proper 2-char algebraic strings (e.g. "e2")
    const algRe=/^[a-h][1-8]$/;
    if(!algRe.test(fromAlg)){console.error('importPGN: invalid fromAlg at index',moveIdx,fromAlg);fromAlg=posAlg(from)||'??';}
    if(!algRe.test(toAlg)){console.error('importPGN: invalid toAlg at index',moveIdx,toAlg);toAlg=posAlg(to)||'??';}
    // v1.0.9 PHASE 52 FIX: compute isCheck and isCastling for imported moves.
    //   Previously, imported moveRecords lacked these fields, so:
    //   (1) Red check arrows + green escape arrows were never generated for
    //       imported PGNs (moveRecords[moveIdx].isCheck was undefined).
    //   (2) Chess960 castling detection in the annotation replay path relied
    //       solely on _castleSide's heuristic fallback.
    //   Now we compute both from the post-move replayState (same logic as
    //   executeMove in ui.js) so imported games get the same visual
    //   annotation treatment as live-played games.
    const _oppColor=replayState.currentTurn;
    const _oppKing=_oppColor==='white'?replayState.wk:replayState.bk;
    const _isCheck=_oppKing?inCheck(replayState.board,_oppColor,_oppKing):false;
    const _isCastling=!!(typeof _castleSide==='function'&&parsedMove&&parsedMove.move&&_castleSide(parsedMove.move,preMoveState));
    // v1.0.1 CRITICAL FIX: Push stateHistory BEFORE adding the current move to moveRecords.
    // Previously this was pushed AFTER moveRecords.push(), which meant each stateHistory
    // entry's moveRecords INCLUDES the move that was just added. When undoMove() restored
    // such an entry, the move was still in moveRecords — so undo didn't actually remove
    // the move from the move list (symptom: "can't undo white's first move from move records").
    // The correct order (matching executeMove in ui.js) is: snapshot first, then push the move.
    stateHistory.push({state:preMoveState,moveRecords:[...moveRecords],lastMove:lastMove?{...lastMove}:null,selectedSquare:null});
    moveRecords.push({
      notation:properNotation,
      from:fromAlg,
      to:toAlg,
      piece:piece,
      captured:capPiece,
      // v1.0.4 Rev28: Include promotion field so openStatsPage() serializes it
      // to the stats page. Without this, the stats page board shows a pawn on
      // the back rank instead of the promoted piece (queen/rook/bishop/knight).
      // The parsed move's promotion field comes from _applySANMove
      // (which extracts =Q/=R/=B/=N or trailing Q/R/B/N from the SAN).
      // v1.0.4 Rev29 FIX (CRITICAL): was `move.promotion` but `move` is NOT in
      // scope here — the loop variable is `parsedMove`. This ReferenceError
      // was caught by the surrounding try/catch and surfaced to the user as
      // "PGN invalid" — making EVERY PGN import fail. Fixed to use
      // parsedMove.move.promotion (the move object on the parsed result).
      promotion:(parsedMove&&parsedMove.move&&parsedMove.move.promotion)||null,
      isCheck:_isCheck,
      isCastling:_isCastling,
      time:null,
      variations:varEntries
    });
    lastMove={from,to};
    _cachedStatus=null;_cachedStatusKey='';
    moveIdx++;
  }
  
  // Validate that moveRecords has proper entries after import
  let _badRecords=0;
  for(let _ri=0;_ri<moveRecords.length;_ri++){
    const _mr=moveRecords[_ri];
    if(!_mr||typeof _mr.from!=='string'||typeof _mr.to!=='string'||_mr.from.length<2||_mr.to.length<2){
      console.error('importPGN: invalid moveRecord at index',_ri,_mr);
      _badRecords++;
    }
  }
  if(_badRecords>0){
    console.warn('importPGN:',_badRecords,'invalid moveRecords found out of',moveRecords.length);
  }
  
  gameState=replayState;
  
  // v1.0.2 FIX: Post-process PGN variations — relocate each variation to the
  // divergence point where the actual game moves diverge from the variation.
  // The variation's moves are compared against the actual game moves starting
  // from the move AFTER the owning move. Matching prefix is stripped. If the
  // game fully follows the variation, the variation is removed (redundant).
  // If the game diverges, the variation is moved to the divergence-point move.
  // v1.0.2 FIX (second pass): Mark moved variations with _relocated=true to
  // prevent them from being reprocessed when the loop reaches their new location.
  // Without this, a variation moved from moveRecord[mi] to moveRecord[divergeIdx]
  // would be processed AGAIN at divergeIdx, creating duplicates.
  //
  // v1.0.3 FIX (Type A vs Type B): The relocate logic only makes sense for
  // Type B variations (continuations after the owning move — firstMoveIsWhite
  // matches the side of mi+1). Type A variations (alternatives to the owning
  // move — firstMoveIsWhite matches the side of mi) must be KEPT at mi. The
  // previous code relocated Type A variations to mi+1 with the wrong side
  // label, producing nonsensical displays like "7... hxg3 Qxh1 8.Nc3 ..."
  // for a variation that is actually "7. hxg3 Qxh1 8.Nc3 ..." (alternative
  // to 7.Kf2, not a continuation after 7...h5).
  for(let mi=0;mi<moveRecords.length;mi++){
    const mr=moveRecords[mi];
    if(!mr||!mr.variations||mr.variations.length===0)continue;
    const remainingVars=[];
    for(const v of mr.variations){
      if(v.group!=='pgn'){remainingVars.push(v);continue;}
      // Skip variations that were already relocated from an earlier moveRecord
      if(v._relocated){remainingVars.push(v);continue;}
      // v1.0.3: Type A variation — alternative to owning move.
      //   owning move mi is white  ⇔  mi%2===0  ⇔  firstMoveIsWhite===true
      //   owning move mi is black  ⇔  mi%2===1  ⇔  firstMoveIsWhite===false
      // Type A means firstMoveIsWhite matches (mi%2===0). Keep at mi.
      const _owningSideIsWhite=(mi%2===0);
      if(v.firstMoveIsWhite===_owningSideIsWhite){
        remainingVars.push(v);
        continue;
      }
      // Parse the variation's SAN moves
      const sanMoves=v.san.trim().split(/\s+/).filter(s=>s);
      if(sanMoves.length===0){continue;}
      let matchCount=0;
      let divergeIdx=-1;
      for(let vi=0;vi<sanMoves.length;vi++){
        const actualIdx=mi+1+vi;
        if(actualIdx>=moveRecords.length){
          // Game ended before all variation moves were checked
          divergeIdx=actualIdx;
          break;
        }
        const actualMr=moveRecords[actualIdx];
        if(!actualMr||actualMr===null){
          // v1.0.2 FIX: Null placeholder means the actual move at this position
          // is a "pass" (black-to-move opening). This is NOT a match — treat as
          // divergence since the variation expects a real move here.
          divergeIdx=actualIdx;
          break;
        }
        const varSAN=sanMoves[vi].replace(/[+#!?]+$/,'');
        const actualSAN=(actualMr.notation||'').replace(/[+#!?]+$/,'');
        if(varSAN===actualSAN){
          matchCount++;
        }else{
          divergeIdx=actualIdx;
          break;
        }
      }
      if(divergeIdx<0) continue;
      if(divergeIdx>=0&&divergeIdx<moveRecords.length){
        // Move the variation to the divergence-point move
        const remainingSAN=sanMoves.slice(matchCount).join(' ');
        if(remainingSAN.length>0){
          const targetMr=moveRecords[divergeIdx];
          if(targetMr){
            if(!targetMr.variations)targetMr.variations=[];
            const isWhite=(divergeIdx%2===0);
            const moveNum=Math.floor(divergeIdx/2)+1;
            targetMr.variations.push({
              group:'pgn',
              san:remainingSAN,
              varMoveNum:moveNum,
              firstMoveIsWhite:isWhite,
              lineNum:v.lineNum,
              prefixEllipsis:false,
              prefixEllipsisNum:0,
              _relocated:true // Mark as relocated to prevent reprocessing
            });
          }
        }
        // Don't add to remainingVars (moved to new location)
      }else if(divergeIdx>=0&&divergeIdx>=moveRecords.length){
        // v1.0.2 FIX: Variation starts BEYOND the game end — the game hasn't
        // reached the variation's starting move. Cache it (don't display).
        // For PGN import, this means the variation is a hypothetical continuation
        // that was never reached. Don't add to remainingVars (remove from display).
        continue;
      }else{
        // No divergence found and not all matched — keep at original location
        remainingVars.push(v);
      }
    }
    mr.variations=remainingVars.length>0?remainingVars:undefined;
  }
  // Clean up _relocated flags (not needed for display)
  // v1.0.2: Also deduplicate variations — remove identical SAN content
  for(const mr of moveRecords){
    if(mr&&mr.variations){
      const seen=new Set();
      const deduped=[];
      for(const v of mr.variations){
        if(v._relocated)delete v._relocated;
        // v1.0.2: Deduplicate by group+san combination
        const key=(v.group||'')+'|'+(v.san||'');
        if(seen.has(key))continue; // Skip duplicate
        seen.add(key);
        deduped.push(v);
      }
      mr.variations=deduped.length>0?deduped:undefined;
    }
  }
  
  // Check for game over
  const st=gameStatus(gameState);
  if(st&&st!=='play'){_applyGameOver(st);}
  
  // v1.0.4 Rev24: Populate _reviewEvalCache from extracted [%eval ...] tags.
  // This implements the "instant recovery from PGN comments" requirement —
  // when the user enters review mode after import, all positions with
  // [%eval ...] annotations are immediately shown with their cached eval,
  // WITHOUT calling the engine. The engine is only invoked for positions
  // that have no [%eval ...] annotation.
  // v1.0.7 PHASE 16: The cache was already fully cleared at the top of
  // importPGN (line ~935), so no selective pre-clear is needed here.
  // The old code had a redundant loop deleting entries 0..moveRecords.length+1
  // "to preserve other games' entries" — but the full clear already removed
  // everything, so the loop was dead work and its comment was misleading.
  try{
    if(result.extractedEvals&&result.extractedEvals.length>0&&typeof _reviewEvalCache!=='undefined'){
      const _maxStep=moveRecords.length;
      // v1.0.7 PHASE 19 (critical bug fix): When a black-to-move placeholder
      // exists at moveRecords[0] (from _prependBlackToMovePlaceholder for FEN
      // imports where Black is to move), the eval reviewStep values computed
      // by _parsePGN are offset by 1 — _parsePGN doesn't know about the
      // placeholder that importPGN prepends AFTER parsing. Without this offset,
      // evals attach to the wrong step and are invisible on PGN re-export.
      const _placeholderOffset=(moveRecords.length>0&&moveRecords[0]===null)?1:0;
      for(const _e of result.extractedEvals){
        const _step=_e.reviewStep+_placeholderOffset;
        if(_step>=0&&_step<=_maxStep){
          _reviewEvalCache.set(_step,{eval:_e.eval,mate:_e.mate||0,depth:_e.depth||0,wdlW:_e.wdlW!=null?_e.wdlW:-1,wdlD:_e.wdlD!=null?_e.wdlD:-1,wdlL:_e.wdlL!=null?_e.wdlL:-1});
        }
      }
    }
  }catch(e){console.warn('importPGN: eval cache population failed',e);}

  // v1.0.4 Round-5 Rev48 NEW: Populate _visualAnnotationsCache from
  // extracted [%csl]/[%cal] tags. This implements the user requirement:
  // "all valid {} comments must be fully received" — previously, imported
  // PGNs with [%csl]/[%cal] tags had their visual annotation info LOST
  // during parsing (the comment-stripping phase removed them).
  //
  // Now: each move with [%csl]/[%cal] in its PGN comment gets the cache
  // entry set, so:
  //   - PGN re-export preserves the tags (via _getVisualAnnotations)
  //   - The review board can render the annotations (when heatmap is off)
  //   - The stats page can count them in the visual annotations section
  //
  // If a moveIdx has BOTH auto-generated annotations (from
  // _computeAndCacheVisualAnnotations, called during executeMove) AND
  // imported annotations, the IMPORTED ones take precedence (they came
  // from the PGN author's explicit annotation, not from our heuristic).
  // v1.1.1 Phase 62: Mark imported entries with imported=true so
  //   _buildPGNString() knows to export them (auto-generated entries have
  //   imported=false and are skipped during PGN export).
  try{
    if(result.extractedAnnotations&&result.extractedAnnotations.length>0&&typeof _visualAnnotationsCache!=='undefined'){
      // v1.0.7 PHASE 19: Apply same placeholder offset as eval cache above.
      const _placeholderOffset=(moveRecords.length>0&&moveRecords[0]===null)?1:0;
      for(const _a of result.extractedAnnotations){
        const _idx=_a.moveIdx+_placeholderOffset;
        if(_idx>=0&&_idx<moveRecords.length){
          // Merge with any existing cache entry (e.g., if there were multiple
          // comments for the same move). Deduplicate by color+square /
          // color+from+to.
          // v1.1.1 Phase 62: Ensure imported flag is set to true.
          const _existing=_visualAnnotationsCache.get(_idx)||{csl:[],cal:[],imported:false};
          _existing.imported=true; // Mark as human-authored (from PGN import)
          const _cslSeen=new Set(_existing.csl.map(x=>x.color+x.square));
          for(const _c of _a.csl){
            const _k=_c.color+_c.square;
            if(!_cslSeen.has(_k)){
              _existing.csl.push({color:_c.color,square:_c.square});
              _cslSeen.add(_k);
            }
          }
          const _calSeen=new Set(_existing.cal.map(x=>x.color+x.from+x.to));
          for(const _c of _a.cal){
            const _k=_c.color+_c.from+_c.to;
            if(!_calSeen.has(_k)){
              _existing.cal.push({color:_c.color,from:_c.from,to:_c.to});
              _calSeen.add(_k);
            }
          }
          _visualAnnotationsCache.set(_idx,_existing);
        }
      }
    }
  }catch(e){console.warn('importPGN: visual annotations cache population failed',e);}

  // v1.0.4 Round-5 Rev48 NEW: Populate mr.comment from extracted free-text
  // comments. This preserves the human-readable annotation text from the
  // PGN so it can be:
  //   - Displayed inline in the move list / review mode
  //   - Re-exported in _buildPGNString() (so PGN round-trip is lossless)
  try{
    if(result.extractedComments&&result.extractedComments.length>0){
      // v1.0.7 PHASE 19: Apply same placeholder offset as eval cache above.
      const _placeholderOffset=(moveRecords.length>0&&moveRecords[0]===null)?1:0;
      for(const _c of result.extractedComments){
        const _idx=_c.moveIdx+_placeholderOffset;
        if(_idx>=0&&_idx<moveRecords.length&&moveRecords[_idx]){
          if(moveRecords[_idx].comment){
            // Append to existing comment (multiple comments for the same move)
            moveRecords[_idx].comment+=' | '+_c.comment;
          }else{
            moveRecords[_idx].comment=_c.comment;
          }
        }
      }
    }
  }catch(e){console.warn('importPGN: comment population failed',e);}
  
  render();
  // v1.0.3: Cache the original PGN text so the stats page can access the
  // complete PGN with all headers ([FEN], [SetUp], [TimeControl], [%clk]
  // comments, etc.) — not just the rebuilt move text from _buildPGNString().
  // v1.0.4 Rev24: We still cache the original PGN for the stats page, BUT
  // for PGN cache save (📚) we use _buildPGNString() which includes the
  // latest moveRecords + variations + [%eval] from the review cache.
  if(typeof _cachedOriginalPGN!=='undefined'){
    _cachedOriginalPGN=pgnText;
  }
  showToast(T('pgn_imported'),2000);
  requestEngineEval();
  }catch(e){
    console.error('importPGN: error during import',e);
    showToast(T('pgn_invalid'),2000);
  }
}

// v1.0.8 PHASE 34: Async PGN import with worker offloading + loading indicator.
//   v1.0.8 PHASE 35: now resolves with a boolean success flag so callers can
//     distinguish success from failure (importPGN returns void but shows its
//     own error toast on invalid PGN; the boolean lets callers avoid showing
//     a misleading success toast).
//   Returns Promise<boolean>: true = import succeeded, false = import failed
//   (invalid PGN). The caller should check the flag before showing success UI.
function importPGNAsync(pgnText){
  if(!pgnText||typeof pgnText!=='string')return Promise.resolve(false);
  // If worker pool unavailable, fall back to sync immediately
  if(typeof workerParsePGN!=='function'){
    try{importPGN(pgnText);return Promise.resolve(true);}catch(e){
      // importPGN itself shows the error toast, but if it threw we report false
      return Promise.resolve(false);
    }
  }
  // Show loading indicator
  try{showToast(T('importing_pgn'),3000);}catch(e){}
  // v1.0.8 PHASE 49: removed the dead workerParsePGN round-trip. The old code
  //   called workerParsePGN(pgnText,30000) but discarded its result in BOTH
  //   .then and .catch — both branches ran the SAME synchronous importPGN(pgnText)
  //   afterward. The worker therefore burned CPU + memory tokenizing the PGN
  //   only for the result to be thrown away, then the main thread re-parsed
  //   it synchronously. Net effect: slower + more memory, zero offloading.
  //   The 50ms setTimeout yield (so the toast paints before the heavy parse)
  //   is the only meaningful part and is retained.
  return new Promise(function(resolve){
    setTimeout(function(){
      var _beforeState=gameState;
      try{
        importPGN(pgnText);
      }catch(e){
        console.error('importPGNAsync: sync import failed',e);
        try{showToast(T('pgn_invalid'),2000);}catch(_e){}
        resolve(false);
        return;
      }
      resolve(gameState!==_beforeState);
    },50); // 50ms yield for UI paint
  });
}

// Import PGN from file (SAF)
function importPGNFile(){
  try{
    if(typeof AndroidBridge!=='undefined'&&typeof AndroidBridge.openPGNFilePicker==='function'){
      AndroidBridge.openPGNFilePicker();
    }else{
      showToast(T('engine_unavailable_bridge'),2000);
    }
  }catch(e){
    showToast(T('engine_unavailable_bridge'),2000);
  }
}

// Callback from Java when PGN file content is read via SAF
function onPGNFileRead(content){
  try{
  if(!content||typeof content!=='string'){showToast(T('pgn_invalid'),2000);return;}
  // Sanitize: remove control characters that might remain after Java-side cleanup
  const sanitized=content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'');
  if(!sanitized.trim()){showToast(T('pgn_invalid'),2000);return;}
  // Always try PGN import. FEN-only files should use the FEN import button.
  // Check if the content looks like a FEN (8 ranks separated by /) vs PGN (has move text)
  const firstLine=sanitized.trim().split('\n')[0].trim();
  const looksLikeFEN=firstLine.includes('/')&&firstLine.split('/').length===8&&!firstLine.includes('[')&&!firstLine.includes('(');
  if(looksLikeFEN){
    _applyImportedFEN(sanitized.trim());
  }else{
    // v1.0.8 PHASE 34: use async import with worker offloading for large files
    if(typeof importPGNAsync==='function'){
      importPGNAsync(sanitized);
    }else{
      importPGN(sanitized);
    }
  }
  }catch(e){
    console.error('onPGNFileRead: error processing file',e);
    showToast(T('pgn_invalid'),2000);
  }
}

// Parse FEN string into game state (for import in setup mode)
function fenToState(fen){
if(!fen||typeof fen!=='string')return null;
const parts=fen.trim().split(/\s+/);
if(parts.length<2)return null;
const rows=parts[0].split('/');
if(rows.length!==8)return null;
const board=Array.from({length:8},()=>Array(8).fill(null));
let wk=null,bk=null;
for(let r=0;r<8;r++){
let c=0;
for(const ch of rows[r]){
if(ch>='1'&&ch<='8'){c+=parseInt(ch,10);continue}
const isWhite=ch===ch.toUpperCase();
const type=ch.toLowerCase()==='p'?'pawn':ch.toLowerCase()==='n'?'knight':ch.toLowerCase()==='b'?'bishop':ch.toLowerCase()==='r'?'rook':ch.toLowerCase()==='q'?'queen':ch.toLowerCase()==='k'?'king':null;
if(!type)return null;
const color=isWhite?'white':'black';
board[r][c]={type,color};
if(type==='king'){if(color==='white')wk={row:r,col:c};else bk={row:r,col:c};}
c++;
}
if(c!==8)return null;
}
// Validate that both kings exist on the board
if(!wk||!bk)return null;
const turn=parts[1]==='b'?'black':'white';
const crStr=parts[2]||'-';
// v1.0.7 PHASE 4: X-FEN castling rights parsing.
// X-FEN (the FEN extension used by Chess960) supports TWO notations:
//   1. Standard KQkq: K=White kingside (rook on h1), Q=White queenside (rook
//      on a1), k/q = Black equivalent.
//   2. Shredder (file letters): the letter of the file where the castling
//      rook sits, uppercase for White, lowercase for Black (e.g. "AHah" for
//      standard position, "Bf" for White queenside rook on b1 + White kingside
//      rook on f1).
// X-FEN allows MIXED notation (e.g. "KQah" — White uses KQ because its rooks
// are on a1/h1, Black uses Shredder "ah" because its rooks are elsewhere).
//
// The previous implementation used a brittle regex to distinguish Shredder
// from standard, and could not handle mixed notation. The new
// parseShredderCastling() (in chess960.js) handles ALL of these cases
// uniformly by treating K/Q/k/q as file letters h/a respectively. We just
// always call it (it returns all-false for "-").
let castlingRights;
if(typeof parseShredderCastling==='function'){
  castlingRights=parseShredderCastling(crStr,board);
}else{
  // Fallback if chess960.js failed to load: standard KQkq only.
  castlingRights={whiteKingside:crStr.includes('K'),whiteQueenside:crStr.includes('Q'),blackKingside:crStr.includes('k'),blackQueenside:crStr.includes('q')};
}
let enPassantTarget=null;
if(parts[3]&&parts[3]!=='-'){const ec=parts[3].charCodeAt(0)-97;const er=8-parseInt(parts[3][1],10);if(er>=0&&er<8&&ec>=0&&ec<8){
// Validate: en passant row must be rank 6 (er=2) for white's turn or rank 3 (er=5) for black's turn
const validRow=(turn==='white'&&er===2)||(turn==='black'&&er===5);
if(validRow){
// Validate: an enemy pawn must be able to capture en passant
const opp=turn;const pd=opp==='white'?1:-1;let _epHasCap=false;for(const dc of[-1,1]){const cr=er+pd,cc=ec+dc;if(inB(cr,cc)&&board[cr][cc]&&board[cr][cc].type==='pawn'&&board[cr][cc].color===opp){_epHasCap=true;break;}}
if(_epHasCap)enPassantTarget={row:er,col:ec};
}
}}
const halfMoveClock=parts[4]?parseInt(parts[4],10)||0:0;
const fullMoveNumber=parts[5]?parseInt(parts[5],10)||1:1;
const s={board,currentTurn:turn,castlingRights,enPassantTarget,halfMoveClock,fullMoveNumber,moveHistory:[],posCount:new Map(),wk,bk,hash:0,boardVersion:1};
syncHash(s);s.posCount.set(s.hash,1);
// Validate: the side NOT to move must not be in check (illegal position)
const nonMover=OPP_COLOR[turn];
const nonMoverKing=nonMover==='white'?s.wk:s.bk;
if(nonMoverKing&&inCheck(s.board,nonMover,nonMoverKing))return null;
return s;
}

// Tablebase offline flag (set true after repeated failures, auto-recover after 60s)
let _tbOffline=false;
let _tbFailCount=0;
let _tbOfflineSince=0;
function isTbOffline(){if(_tbOffline&&Date.now()-_tbOfflineSince>60000){_tbOffline=false;_tbFailCount=0;}return _tbOffline}
let _tbLoading=false;
let _tbRetryCount=0;
let _tbLastRequestTime=0;

// Tablebase result cache (LRU, keyed by FEN, max 50 entries)
const _tbCache = new Map();
const _TB_CACHE_MAX = 50;

// Helper: count total pieces on board
function countPieces(board){let n=0;for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(board[r][c])n++;return n}
function pieceCountLE7(board){return countPieces(board)<=7}

// Probe Syzygy tablebase API (with timeout + offline fallback + rate limiting)
async function probeTablebase(s){
if(isTbOffline())return null;
const fen=generateFEN(s);
// Check cache first
// v1.0.2 FIX: Refresh LRU order on cache hit. Previously a hit just returned
// the value without reordering, so frequently-accessed entries could be
// evicted before rarely-accessed ones — defeating the LRU cache's purpose.
// The delete+set pattern moves the entry to the "newest" position (Map
// preserves insertion order in JS).
if(_tbCache.has(fen)){
  const v=_tbCache.get(fen);
  _tbCache.delete(fen);
  _tbCache.set(fen,v);
  return v;
}
// Rate limit: ≥600ms between requests
// FIX: Reserve the time slot immediately (before async wait) to prevent TOCTOU race
// where two concurrent calls both compute wait=0 and bypass the rate limit.
const now=Date.now();const wait=Math.max(0,600-(now-_tbLastRequestTime));
_tbLastRequestTime=now+wait; // Reserve slot immediately
if(wait>0)await new Promise(r=>setTimeout(r,wait));
try{
const ctrl=typeof AbortController!=='undefined'?new AbortController():null;
const tmr=ctrl?setTimeout(()=>ctrl.abort(),5000):null;
const resp=await fetch(`https://tablebase.lichess.ovh/standard?fen=${encodeURIComponent(fen)}`,{signal:ctrl?ctrl.signal:undefined});
if(tmr)clearTimeout(tmr);
// v1.0.5 Round-6 Rev62 (2026.6.27) FIX: a 404 response means "position not in
// tablebase" (e.g., 8-piece position that slipped past the pieceCountLE7
// pre-filter), NOT "server is down". Previously, 3 consecutive 404s would
// falsely set _tbOffline=true for 60 seconds, blocking ALL tablebase queries
// even though the server is healthy. Now only 5xx errors and network errors
// (caught below) count toward _tbFailCount; 4xx errors return null silently.
if(!resp.ok){
  if(resp.status>=500){
    _tbFailCount++;
    if(_tbFailCount>=3){_tbOffline=true;_tbOfflineSince=Date.now();}
  }
  return null;
}
// v1.0.7 PHASE 19 (bug fix): Parse JSON in its own try/catch so a malformed
// response body (server reachable but bad payload) does NOT count toward
// _tbFailCount and trip _tbOffline. Previously, a JSON parse error threw into
// the generic catch below, incrementing the fail count — contradicting the
// Rev62 fix that excluded 4xx errors for the same reason (server is reachable).
let data;
try{
  data=await resp.json();
}catch(e){
  console.warn('probeTablebase: bad JSON response',e);
  return null;
}
// LRU cache: evict oldest when full
if(_tbCache.size>=_TB_CACHE_MAX){const firstKey=_tbCache.keys().next().value;_tbCache.delete(firstKey);}
_tbCache.set(fen,data);
_tbFailCount=0;
return data;
}catch(e){_tbFailCount++;if(_tbFailCount>=3){_tbOffline=true;_tbOfflineSince=Date.now();}return null}
}

// Get best move from tablebase
// Tablebase API returns moves[] already sorted best-first (verified via API docs + testing).
// moves[0] is always the optimal move for the side to move.
// No custom sorting needed — trusting the API ordering eliminates sorting bugs.
function bestMoveFromTablebase(data){
if(!data||!data.moves||!data.moves.length)return null;
return data.moves[0];
}
// Manual trigger: user clicks to query tablebase for current position
function _triggerTbQuery(){
if(_tbLoading||isTbOffline())return;
_tbLoading=true;render();
probeTablebase(gameState).then(function(d){
_tbLoading=false;
// Auto-select piece on tablebase recommendation
if(d){const bm=bestMoveFromTablebase(d);if(bm){autoSelectTablebaseMove(bm.uci);}}
render();
}).catch(function(){_tbLoading=false;render();});
}

// Auto-select the piece for a tablebase-recommended move
// Called both from _triggerTbQuery and when user clicks the recommended move in UI
// Auto-select piece for tablebase recommendation only during gameplay.
// In setup mode (setupMode=true), we must NOT auto-select pieces, since the user
// is freely arranging pieces and an unexpected selection would disrupt their workflow.
function autoSelectTablebaseMove(uciMove){
// No auto-selection in setup mode
if(setupMode)return;
if(!uciMove)return;
const coords=uciToCoords(uciMove);
if(!coords||!coords.from)return;
const piece=gameState.board[coords.from.row][coords.from.col];
// Only auto-select if it's the player's turn and the piece belongs to the player
if(piece&&gameState.currentTurn===playerColor&&piece.color===playerColor){
selectedSquare=coords.from;
legalMvs=legalMoves(gameState,selectedSquare);
legalSet=new Set(legalMvs.map(m=>m.row*8+m.col));
_updateBoardLightweight();
}
}

// ---- Exports ----
export {isTbOffline,countPieces,pieceCountLE7,probeTablebase,bestMoveFromTablebase,_triggerTbQuery,autoSelectTablebaseMove,importFEN,importPGN,importPGNFile,onPGNFileRead,_applyImportedFEN};
