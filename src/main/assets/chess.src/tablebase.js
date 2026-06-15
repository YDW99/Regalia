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
gameState=ns;_resetGameUIState();gameOverSoundPlayed=false;
_cachedStatus=null;_cachedStatusKey='';
_sfEval=0;_sfMateDistance=0;_sfDepth=0;_sfEvalReady=false;_evalLoading=false;_updateEvalDisplay();
_reviewEvalCache.clear();_reviewEvalRequestedStep=-1;
reviewMode=false;setupMode=false;showNewGameDialog=false;
_needNewGameForEngine=true;
gameOver=null;_gameOverStatusKey=null;selectedSquare=null;legalMvs=[];legalSet=new Set();
lastMove=null;pendingPromotion=null;
_aiBarInfo='';_hintBarInfo='';
stateHistory=[];moveRecords=[];
hintText='';isHintLoading=false;
if(renderTimerId){cancelAnimationFrame(renderTimerId);renderTimerId=null;}renderPending=false;
_tbLoading=false;_tbRetryCount=0;
_ecoRecCache.clear();
setupHistory=[];setupErrors=[];
_ecoEnabled=false; // FEN import — disable ECO recognition
reviewBaseState=cloneS(gameState);
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
  
  // Remove header tags — handle multi-line headers and various formats
  let moveText=pgnText.replace(/\[[^\]]*\]/g,'').trim();
  // Remove line continuation markers (\ at end of line)
  moveText=moveText.replace(/\\\s*\n/g,' ');
  // Remove comments (brace-style { ... }) — handle nested braces gracefully by matching innermost first
  while(moveText.includes('{'))moveText=moveText.replace(/\{[^{}]*\}/g,'');
  // Remove semicolon-style comments (; to end of line) — DroidFish line comment handling
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
  // Also handle "1.e4" without dots after move number for non-standard PGN
  text=text.replace(/(\d+)(\.[^\d])/g,'$1.$2');
  // Handle move numbers without dots (e.g. "1 e4 e5 2 Nf3") — add a dot so the
  // move-number regex can detect them. Pattern: standalone number followed by a piece/pawn letter.
  text=text.replace(/(^|\s)(\d+)\s+(?=[a-hKQRBN])/g,'$1$2. ');
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
  
  // ---- Phase 1: Recursive-descent variation parsing (DroidFish GameTree.parsePgn style) ----
  // Build a tree of variations: main-line at depth 0, variations nested in parens.
  // Each variation is associated with the last main-line move before the '(' .
  const variations=new Map(); // moveIndex → array of { sanTokens: string[] }
  let moveIndexCounter=0; // counts main-line SAN moves at depth 0
  let varStack=[]; // stack: each entry = {tokens[], moveIndex, depth}
  
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
  
  // Recursive-descent: when '(' encountered, commit any pending main-line move
  // then parse the variation as a sibling (same logic as DroidFish Node.parsePgn)
  for(const token of rawTokens){
    if(token==='('){
      // Associate this variation with the LAST main-line move before it.
      const varMoveIdx=moveIndexCounter>0?moveIndexCounter-1:0;
      varStack.push({tokens:[],moveIndex:varMoveIdx});
      continue;
    }
    if(token===')'){
      // Pop the variation stack and store it
      if(varStack.length>0){
        const v=varStack.pop();
        // Clean variation tokens: remove standalone move numbers, ellipsis, results;
        // strip leading move number prefixes from combined tokens (e.g. "1.e4" → "e4");
        // strip annotation suffixes (!, ?, etc.)
        const vClean=v.tokens.filter(t=>
          !moveNumRe.test(t)&&!ellipsisRe.test(t)&&!skipTokens.has(t)&&t.length>0
        ).map(t=>t.replace(moveNumPrefixRe,'').replace(annotRe,''));
        if(vClean.length>0){
          const mi=v.moveIndex;
          if(!variations.has(mi))variations.set(mi,[]);
          variations.get(mi).push(vClean);
        }
      }
      continue;
    }
    if(varStack.length>0){
      // Inside a variation: accumulate tokens into the deepest stack frame
      varStack[varStack.length-1].tokens.push(token);
      continue;
    }
    // At depth 0: skip standalone move numbers and ellipsis, count SAN moves
    if(moveNumRe.test(token)||ellipsisRe.test(token)||skipTokens.has(token))continue;
    // Combined tokens like "1.e4" are NOT standalone move numbers — they contain the SAN move
    // We don't need to strip the prefix here since Phase 2 handles it, but we must count them
    moveIndexCounter++;
  }
  
  // ---- Phase 2: Rebuild clean main-line tokens ----
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
  
  // ---- Phase 3: Replay main-line moves using _applySANMove ----
  let state=startFEN?fenToState(startFEN):initState();
  if(!state)return null;
  
  const moves=[]; // array of { notation, move, state (post-move) }
  
  for(let ti=0;ti<mainTokens.length;ti++){
    const token=mainTokens[ti];
    const result=_applySANMove(state,token);
    if(!result){
      // Could not parse — skip this token (DroidFish-style lazy validation: silently drop invalid)
      continue;
    }
    moves.push(result);
    state=result.state;
  }
  
  if(moves.length===0)return null;
  return{moves,startFEN,variations};
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
  const upperSAN=cleanSAN.toUpperCase();
  if(upperSAN==='O-O'||cleanSAN==='0-0'){
    const row=state.currentTurn==='white'?7:0;
    const kingFrom={row,col:4};
    const kingTo={row,col:6};
    const move=_findLegalMove(state,kingFrom,kingTo,'king');
    if(move)return _executeAndRecord(state,move,'O-O');
    return null;
  }
  if(upperSAN==='O-O-O'||cleanSAN==='0-0-0'){
    const row=state.currentTurn==='white'?7:0;
    const kingFrom={row,col:4};
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
  const captured=undoInfo?undoInfo.capPiece:null;
  const isCapture=!!captured||move.enPassant;
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
  const startState=result.startFEN?fenToState(result.startFEN):initState();
  if(!startState){showToast(T('pgn_invalid'),2000);return;}
  
  // Reset game state
  gameState=startState;_resetGameUIState();gameOverSoundPlayed=false;
  _cachedStatus=null;_cachedStatusKey='';
  _sfEval=0;_sfMateDistance=0;_sfDepth=0;_sfEvalReady=false;_evalLoading=false;_updateEvalDisplay();
  _reviewEvalCache.clear();_reviewEvalRequestedStep=-1;
  reviewMode=false;setupMode=false;showNewGameDialog=false;
  _needNewGameForEngine=true;
  gameOver=null;_gameOverStatusKey=null;selectedSquare=null;legalMvs=[];legalSet=new Set();
  lastMove=null;pendingPromotion=null;
  _aiBarInfo='';_hintBarInfo='';
  stateHistory=[];moveRecords=[];
  hintText='';isHintLoading=false;
  if(renderTimerId){cancelAnimationFrame(renderTimerId);renderTimerId=null;}renderPending=false;
  _tbLoading=false;_tbRetryCount=0;
  _ecoRecCache.clear();
  setupHistory=[];setupErrors=[];
  _ecoEnabled=false;
  reviewBaseState=cloneS(gameState);
  
  // Replay all moves using the _parsePGN results which already have
  // validated moves with correct notation and post-move states.
  let moveIdx=0;
  let replayState=startState;
  
  for(const parsedMove of result.moves){
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
    const pgnVars=result.variations&&result.variations.get(moveIdx);
    const varEntries=[];
    if(pgnVars&&pgnVars.length>0){
      const postMoveState=replayState; // read-only: replayState already updated by makeMvInPlace
      const branchMoveIsWhite=preMoveState.currentTurn==='white';
      const branchMoveNum=preMoveState.fullMoveNumber||Math.floor(moveIdx/2)+1;
      for(let vi=0;vi<pgnVars.length;vi++){
        const vTokens=pgnVars[vi]; // array of pure SAN tokens
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
            // Attempt Type B: first token matches from postMoveState (opponent's side)
            const tryB=_applySANMove(cloneS(postMoveState),vTokens[0]);
            if(tryB){
              vState=tryB.state;
              vIsWhite=!branchMoveIsWhite;
              vMoveNum=branchMoveIsWhite?branchMoveNum:branchMoveNum+1;
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
                vMoveNum=branchMoveIsWhite?branchMoveNum:branchMoveNum+1;
                startIdx=1;
              }
            }
          }
        }
        if(!vState){continue;} // Cannot match first token — skip this variation
        const initialVIsWhite=vIsWhite;
        const initialVMoveNum=vMoveNum;

        for(let ti=startIdx;ti<vTokens.length;ti++){
          const vToken=vTokens[ti];
          const vResult=_applySANMove(vState,vToken);
          if(!vResult){
            const vAllMoves=legalMoves(vState,null);
            let vMatched=null;
            for(const vm of vAllMoves){
              const vAlg=moveAlg(vState,vm);
              if(vAlg.replace(/[+#!?]+$/,'')===vToken.replace(/[+#!?]+$/,'')){vMatched=vm;break;}
            }
            if(!vMatched)break;
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
            lineNum:vi+1
          });
        }
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
    moveRecords.push({
      notation:properNotation,
      from:fromAlg,
      to:toAlg,
      piece:piece,
      captured:capPiece,
      time:null,
      variations:varEntries
    });
    stateHistory.push({state:preMoveState,moveRecords:[...moveRecords],lastMove:lastMove?{...lastMove}:null,selectedSquare:null});
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
  
  // Check for game over
  const st=gameStatus(gameState);
  if(st&&st!=='play'){_applyGameOver(st);}
  
  render();
  showToast(T('pgn_imported'),2000);
  requestEngineEval();
  }catch(e){
    console.error('importPGN: error during import',e);
    showToast(T('pgn_invalid'),2000);
  }
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
    importPGN(sanitized);
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
if(ch>='1'&&ch<='8'){c+=parseInt(ch);continue}
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
const castlingRights={whiteKingside:crStr.includes('K'),whiteQueenside:crStr.includes('Q'),blackKingside:crStr.includes('k'),blackQueenside:crStr.includes('q')};
let enPassantTarget=null;
if(parts[3]&&parts[3]!=='-'){const ec=parts[3].charCodeAt(0)-97;const er=8-parseInt(parts[3][1]);if(er>=0&&er<8&&ec>=0&&ec<8){
// Validate: en passant row must be rank 6 (er=2) for white's turn or rank 3 (er=5) for black's turn
const validRow=(turn==='white'&&er===2)||(turn==='black'&&er===5);
if(validRow){
// Validate: an enemy pawn must be able to capture en passant
const opp=turn;const pd=opp==='white'?1:-1;let _epHasCap=false;for(const dc of[-1,1]){const cr=er+pd,cc=ec+dc;if(inB(cr,cc)&&board[cr][cc]&&board[cr][cc].type==='pawn'&&board[cr][cc].color===opp){_epHasCap=true;break;}}
if(_epHasCap)enPassantTarget={row:er,col:ec};
}
}}
const halfMoveClock=parts[4]?parseInt(parts[4])||0:0;
const fullMoveNumber=parts[5]?parseInt(parts[5])||1:1;
const s={board,currentTurn:turn,castlingRights,enPassantTarget,halfMoveClock,fullMoveNumber,moveHistory:[],posCount:new Map(),wk,bk,hash:0};
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
if(_tbCache.has(fen))return _tbCache.get(fen);
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
if(!resp.ok){_tbFailCount++;if(_tbFailCount>=3){_tbOffline=true;_tbOfflineSince=Date.now();}return null;}
const data=await resp.json();
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
