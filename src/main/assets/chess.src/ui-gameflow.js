// Regalia Chess — Game flow & clocks (ui-gameflow.js)
// v1.2.3 (God Class refactor round-17): extracted from ui.js to slim the God
//   Class. Same global-scope module pattern as the other chess.src modules —
//   all functions remain top-level globals; build-chess.py concatenates the
//   modules in MODULES order and strips the export statement for the bundle.
//   No behavior change intended: every function body is moved verbatim.
// Contents: game start (startGame/_startGameImpl) and the game-clock
//   subsystem (initGameClocks/_tickGameClock/_onGameClockExpired/recordMoveEnd/
//   formatClock/_updateClockDisplay).
function startGame(){
  _withPGNSaveCheck(_startGameImpl);
}

function _startGameImpl(){
  // v1.0.8 PHASE 22 supplement: new-game sound (号角式三音和弦)
  try{if(typeof playSound==='function')playSound('newgame');}catch(e){console.warn('[UI]',e&&e.message?e.message:e);}
  showNewGameDialog=false;
  playerColor=dlgPlayerColor;
  useBookMoves=dlgBookMoves;
  // v1.0.8 PHASE 18 Task 2: Reset virtual list state on new game.
  _resetRvVirtualState();
  // v1.0.8 BUG FIX:
  // _reviewEvalCache is keyed by reviewStep (0-based per-game index since
  // v1.0.8 Phase 15: step 0 = initial position, steps 1..N = post-move).
  // When the user starts a new game, the new game's reviewStep 0,1,2,...
  // map to completely different positions than the previous game's, so the
  // cache would return stale evals for the wrong positions. Clear the cache
  // on every new game so review mode re-evaluates from scratch.
  // Note: This intentionally trades cross-session eval persistence for
  // correctness. The previous design assumed "same step index → same
  // position", which is only true within ONE game.
  try{
    if(_reviewEvalCache !== undefined&&_reviewEvalCache){
      _reviewEvalCache.clear();
    }
    if(typeof _reviewEvalRequestedStep!=='undefined')_reviewEvalRequestedStep=-1;
  }catch(e){console.warn('_startGameImpl: review eval cache clear failed',e);}
  // v1.0.6: Disable ECO recognition entirely in Chess960 mode. The new-game
  // dialog already grays out the ECO book toggle when Chess960 is on; this
  // mirror ensures imported Chess960 PGNs (which never set dlgChess960) and
  // any other entry point also keep ECO off. The UI gates in render() check
  // gameVariant==='chess960' for defense in depth, but _ecoEnabled=false
  // here is the primary switch so getECORecommendation() is never even
  // called for Chess960 positions (saves CPU).
  // v1.2.1 round-12 (S2757 false-positive refactor): The original
  // `!(dlgChess960 !== undefined&&dlgChess960)` triggered SonarCloud's
  // '=!' operator typo detector. Rewrite using De Morgan's law for the same
  // semantics: ECO is enabled when dlgChess960 is undefined OR falsy.
  _ecoEnabled=dlgChess960 === undefined||!dlgChess960;
  // v1.0.3: Clear cached original PGN and setup FEN — new game means no imported PGN.
  if(typeof _cachedOriginalPGN!=='undefined')_cachedOriginalPGN=null;
  if(typeof _setupFEN!=='undefined')_setupFEN=null;
  // v1.0.3: Reset the imported-start-move-number offset — a fresh game from the
  // initial position starts at move 1. Subsequent ECO opening moves (if any)
  // also start from move 1.
  if(typeof _importedStartMoveNum!=='undefined')_importedStartMoveNum=1;
  // v1.0.4 Rev24: Clear imported player names — a new game uses the default
  // "你"/"AI对手" (or _humanPlayerName if set via rename). Don't clear
  // _humanPlayerName itself — that's a persistent user preference.
  if(typeof playerWhite!=='undefined')playerWhite=undefined;
  if(typeof playerBlack!=='undefined')playerBlack=undefined;
  // v1.0.4 NEW: Chess960 mode handling.
  // - If dlgChess960 is true, build a Chess960 starting position.
  // - If dlgChess960SPID is set (0..959), use it; otherwise pick a random SP-ID.
  // - Tell StockfishNative to enable UCI_Chess960 so castling works correctly.
  // - For Chess960 we skip ECO openings (they assume the standard start position).
  if(dlgChess960 !== undefined&&dlgChess960){
    const spid=(typeof dlgChess960SPID!=='undefined'&&dlgChess960SPID>=0&&dlgChess960SPID<960)?dlgChess960SPID:randomSPID();
    if(typeof setChess960Mode==='function')setChess960Mode(true);
    gameState=initChess960State(spid);
    // Track game variant for PGN export
    if(gameVariant !== undefined)gameVariant='chess960';
    if(typeof gameSPID!=='undefined')gameSPID=spid;
    // v1.0.8 PHASE 24 (bug fix): Store the Chess960 starting FEN so PGN export
    //   emits the correct [FEN] tag. Previously _setupFEN was null for Chess960
    //   games started from the New Game dialog, causing _buildPGNString to
    //   fall back to generateFEN(gameState) (the CURRENT mid-game state),
    //   producing a corrupt [FEN] tag that re-imports to the wrong position.
    if(typeof _setupFEN!=='undefined')_setupFEN=generateFEN(gameState);
  }else{
    if(typeof setChess960Mode==='function')setChess960Mode(false);
    gameState=initState();
    if(gameVariant !== undefined)gameVariant=null;
    if(typeof gameSPID!=='undefined')gameSPID=null;
  }
  stateHistory=[{state:cloneS(gameState),selectedSquare:null,legalMvs:[],moveRecords:[],lastMove:null,gameOver:null}];
  moveRecords=[];
  gameOver=null;_gameOverStatusKey=null;
  // If an opening is selected AND we're NOT in Chess960 mode, apply ECO opening moves.
  // (ECO openings assume the standard start position — they don't make sense in Chess960.)
  if(dlgOpeningId&&!(dlgChess960 !== undefined&&dlgChess960)){
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
      // Apply all moves from the opening's coordinate array.
      // v1.0.2 NEW FEATURE: ECO openings record every move in their `moves` array,
      // so we auto-fill the in-game moveRecords with proper SAN notation as we
      // replay each move. This means the user sees the full opening sequence in
      // the move history from move #1, with correct PGN numbering — no "..."
      // placeholder is needed even when the opening's last move was Black's.
      // (The black-to-move placeholder only kicks in when NO ECO moves are
      // applied — i.e., for FEN/setup/PGN imports with black to move.)
      const mv=opening.moves;
      for(let i=0;i+3<mv.length;i+=4){
        const from={row:mv[i],col:mv[i+1]};
        const to={row:mv[i+2],col:mv[i+3]};
        const piece=gameState.board[from.row]?gameState.board[from.row][from.col]:null;
        if(piece){
          const moveObj={from:from,to:to,piece:piece};
          // Snapshot state BEFORE the move (matches executeMove's order)
          stateHistory.push({state:cloneS(gameState),selectedSquare:null,legalMvs:[],moveRecords:[...moveRecords],lastMove:lastMove?{...lastMove}:null,gameOver:null});
          if(stateHistory.length>200)stateHistory.shift();
          // Apply the move
          const ns=makeMv(gameState,moveObj);
          const notation=moveAlg(gameState,moveObj,ns);
          const opp=OPP_COLOR[piece.color];
          const ic=inCheck(ns.board,opp,opp==='white'?ns.wk:ns.bk);
          const cast=!!(typeof _castleSide==='function'&&_castleSide(moveObj));
          const epCap=piece.type==='pawn'&&gameState.enPassantTarget&&to.row===gameState.enPassantTarget.row&&to.col===gameState.enPassantTarget.col;
          // Build the move record exactly like executeMove (without the time field
          // since these are pre-played opening moves, not user/AI moves)
          moveRecords.push({
            notation:notation,
            from:posAlg(from),
            to:posAlg(to),
            piece:piece,
            captured:gameState.board[to.row][to.col]||(epCap?gameState.board[piece.color==='white'?to.row+1:to.row-1][to.col]:undefined),
            isCheck:ic,
            isCastling:cast,
            promotion:null,
            time:null
          });
          gameState=ns;
          lastMove={from:{...from},to:{...to}};
        }else{
          console.warn('[startGame] ECO move #'+(i/4+1)+' invalid at',from,'— skipping remaining moves');
          break;
        }
      }
      // If the opening had moves, clear the stale stateHistory[0] entry so that
      // undo back to the start position correctly restores the initial position
      // (stateHistory[0] is still the initial state, which is correct).
    }else{
      console.warn('[startGame] ECO code not found:',ecoCode);
    }
  }
  _needNewGameForEngine=true;
  reviewBaseState=cloneS(gameState);
  // v1.1.1 Phase 61: _resetGameUIState() now clears ALL per-game caches
  //   centrally (including _reviewEvalCache, _pendingEngineSANs/_pendingEnginePVs,
  //   _multiPV*, reviewCritical, _sfEval, _cachedOriginalPGN, playerWhite/
  //   playerBlack, _setupFEN, _importedStartMoveNum, _needNewGameForEngine,
  //   etc). The manual clears that were here are now redundant.
  _resetGameUIState();
  _resetEvalState();
  // v1.0.4 EXPANSION (this round): Initialize the game clocks based on dlgTimeControl.
  // If type === 'off', gameClocks remains null and PGN export will use [%emt] (elapsed
  // move time). Otherwise, both clocks start at baseSec and tick down on each move.
  initGameClocks();
  // v1.0.2 FIX: Black-to-move opening move record fix.
  // Only relevant when NO ECO moves were applied — e.g., a free opening with
  // a custom starting FEN that has black to move. When ECO moves ARE applied
  // (the common case), moveRecords already has all moves correctly placed
  // and _prependBlackToMovePlaceholder() is a no-op (moveRecords is non-empty).
  _prependBlackToMovePlaceholder();
  render();
  requestEngineEval();
  if(gameState.currentTurn!==playerColor){
    doAIMove();
  }
}

function initGameClocks(){
  // Stop any existing clock timer
  if(gameClockTimerId){clearInterval(gameClockTimerId);gameClockTimerId=null;}
  gameClockExpired=null;
  if(!dlgTimeControl||dlgTimeControl.type==='off'){
    gameClocks=null;
    return;
  }
  const base=dlgTimeControl.baseSec||300;
  gameClocks={
    white:{remainingSec:base,displayRemainingSec:base,lastMoveTimestamp:Date.now()},
    black:{remainingSec:base,displayRemainingSec:base,lastMoveTimestamp:Date.now()},
    type:dlgTimeControl.type,
    baseSec:base, // v1.0.4 FIX (this round): store baseSec on gameClocks so PGN export can emit the correct [TimeControl] header without relying on dlgTimeControl (which may be stale after import).
    incrementSec:dlgTimeControl.incrementSec||0,
    delaySec:dlgTimeControl.delaySec||0
  };
  // Start a 200ms-poll timer (the actual deduction happens on each move; the
  // timer is only for refreshing the displayed clock so the user sees the
  // seconds tick down live for the side to move).
  gameClockTimerId=setInterval(_tickGameClock,200);
}

// Tick function: deduct time from the side-to-move's clock based on wall-clock
// elapsed since the last move. This is the source of truth for "time remaining".
// On each tick we also check for flag-fall (remaining <= 0).
function _tickGameClock(){
  if(!gameClocks||gameClockExpired)return;
  if(gameOver||setupMode||reviewMode)return;
  const color=gameState.currentTurn;
  const clock=gameClocks[color];
  if(!clock)return;
  const now=Date.now();
  const elapsedMs=now-clock.lastMoveTimestamp;
  const elapsedSec=elapsedMs/1000;
  // For US delay / Bronstein: subtract delay first
  let deductSec=elapsedSec;
  if(gameClocks.type==='bronstein'||gameClocks.type==='usdelay'){
    deductSec=Math.max(0,elapsedSec-gameClocks.delaySec);
  }
  // Update the displayed remaining time (NOT the committed remaining; the
  // committed remaining is updated only on each move via recordMoveEnd).
  clock.displayRemainingSec=Math.max(0,clock.remainingSec-deductSec);
  // Check for flag fall
  if(clock.displayRemainingSec<=0&&!gameClockExpired){
    gameClockExpired=color;
    _onGameClockExpired(color);
  }
  // Update the clock display in the header (lightweight DOM update)
  _updateClockDisplay();
}

// Called when a side's clock runs out
function _onGameClockExpired(color){
  if(gameClockTimerId){clearInterval(gameClockTimerId);gameClockTimerId=null;}
  // v1.0.4 Rev35 FIX (CRITICAL): Stop the engine IMMEDIATELY when the clock
  // expires. Previously, the engine continued searching after flag-fall
  // because no "stop" command was sent. The engine's internal wtime-based
  // time management may not align perfectly with the GUI's wall-clock
  // deduction (especially under HyperOS 3's aggressive CPU throttling),
  // causing the engine to search far past the 0-second mark. This made
  // timed games feel "broken" — the engine kept thinking after time was up.
  // Now we send a hard "stop" via engineStop() so the engine returns
  // bestmove immediately and the game-over overlay shows promptly.
  try{
    if(typeof AndroidBridge!=='undefined'&&typeof AndroidBridge.isEngineReady==='function'&&AndroidBridge.isEngineReady()){
      if(typeof AndroidBridge.engineStop==='function'){
        AndroidBridge.engineStop();
      }else if(typeof AndroidBridge.sendToEngine==='function'){
        // Fallback for older builds: send raw "stop"
        AndroidBridge.sendToEngine('stop');
      }
    }
    // Clear AI thinking state so UI updates promptly
    isAIThinking=false;
    if(typeof _aiBarInfo!=='undefined')_aiBarInfo='';
    if(typeof _aiSafetyTimerId!=='undefined'&&_aiSafetyTimerId){clearTimeout(_aiSafetyTimerId);_aiSafetyTimerId=null;}
  }catch(e){console.warn('engineStop on clock expiry failed:',e);}
  // Game over: the OTHER side wins by time
  // v1.0.4 Rev47: Use _gameOverStrFromStatus() for proper T()-based localization
  // instead of hardcoding _lang. This ensures the text re-localizes when the
  // user toggles language after the game-over overlay is shown.
  const winner=color==='white'?'black':'white';
  if(typeof _timeoutWinnerColor!=='undefined')_timeoutWinnerColor=winner;
  _gameOverStatusKey='timeout';
  gameOver=_gameOverStrFromStatus('timeout');
  render();
}

// Called by executeMove() right AFTER applying a move: commits the elapsed time
// deduction to the moving side's clock, applies increment for Fischer, and
// resets the timestamp for the next side.
function recordMoveEnd(color){
  if(!gameClocks||gameClockExpired)return;
  const clock=gameClocks[color];
  if(!clock)return;
  const now=Date.now();
  const elapsedSec=(now-clock.lastMoveTimestamp)/1000;
  let deductSec=elapsedSec;
  if(gameClocks.type==='bronstein'||gameClocks.type==='usdelay'){
    deductSec=Math.max(0,elapsedSec-gameClocks.delaySec);
  }
  clock.remainingSec=Math.max(0,clock.remainingSec-deductSec);
  // Fischer increment: add AFTER the deduction
  if(gameClocks.type==='fischer'){
    clock.remainingSec+=gameClocks.incrementSec||0;
  }
  clock.displayRemainingSec=clock.remainingSec;
  clock.lastMoveTimestamp=now;
  // Reset the OTHER side's timestamp too (it'll start ticking from now)
  const otherColor=color==='white'?'black':'white';
  if(gameClocks[otherColor])gameClocks[otherColor].lastMoveTimestamp=now;
}

// Format a clock value as M:SS or H:MM:SS
function formatClock(sec){
  if(sec==null||!Number.isFinite(sec))return '--:--';
  const s=Math.max(0,Math.floor(sec));
  const h=Math.floor(s/3600);
  const m=Math.floor((s%3600)/60);
  const ss=s%60;
  const pad=n=>(n<10?'0':'')+n;
  if(h>0)return h+':'+pad(m)+':'+pad(ss);
  return m+':'+pad(ss);
}

// Lightweight DOM update for clock display (avoid full render() on every tick)
function _updateClockDisplay(){
  if(!gameClocks)return;
  const wEl=document.getElementById('clock-white');
  const bEl=document.getElementById('clock-black');
  const wRem=gameClocks.white.displayRemainingSec!=null?gameClocks.white.displayRemainingSec:gameClocks.white.remainingSec;
  const bRem=gameClocks.black.displayRemainingSec!=null?gameClocks.black.displayRemainingSec:gameClocks.black.remainingSec;
  if(wEl)wEl.textContent=formatClock(wRem);
  if(bEl)bEl.textContent=formatClock(bRem);
  // Highlight low-time clocks (< 30s)
  if(wEl)wEl.style.color=(wRem<30)?'#e74c3c':'var(--text)';
  if(bEl)bEl.style.color=(bRem<30)?'#e74c3c':'var(--text)';
}

export {startGame,_startGameImpl,initGameClocks,_tickGameClock,_onGameClockExpired,recordMoveEnd,formatClock,_updateClockDisplay};
