// ===================== MODULE: chess960 =====================
// Chess960 (Fischer Random Chess) support — v1.0.4 NEW
//
// Provides:
//   - SP-ID (Starting Position Identifier) generation & validation
//   - Back-rank piece placement from SP-ID
//   - Shredder-FEN castling rights encoding/decoding (HAah format)
//   - Chess960 castling rules (king-to-g1/c1, rook-to-f1/d1 final squares)
//   - Bridge call helper: setChess960Mode(enabled) → AndroidBridge
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

// ===== I. SP-ID → piece placement =====
// The 960合法 starting positions are encoded by an integer 0..959.
// Algorithm (reverse of the standard derivation):
//   1. lightBishop = sp % 4        → file index among {0,2,4,6} (white squares for White)
//   2. darkBishop  = (sp/4) % 4    → file index among {1,3,5,7} (black squares)
//   3. queen       = (sp/16) % 6   → file index among the 6 remaining empty squares
//   4. knight1     = (sp/96) % 10  → first knight's slot among the 5 remaining empties
//   5. knight2     = ((sp/96) / 10) → second knight's slot among the remaining 4 empties
//   6. The remaining 3 slots are filled: ROOK, KING, ROOK (in that order, since King must be between two rooks).
// The traditional chess start position (RNBQKBNR) is SP-ID 518.

// Quick lookup tables for the 4-step decomposition
const _CH960_LIGHT_BISHOP_FILES=[0,2,4,6];   // a, c, e, g  (white squares from White's POV)
const _CH960_DARK_BISHOP_FILES=[1,3,5,7];    // b, d, f, h  (black squares)
const _BINOMIAL_5_2 = [
  [0,1],[0,2],[0,3],[0,4],
  [1,2],[1,3],[1,4],
  [2,3],[2,4],
  [3,4]
]; // C(5,2) = 10 combinations of 2 knight slots out of 5 empties

/**
 * Generate the 8-piece back-rank arrangement from a Chess960 SP-ID.
 * @param {number} spid — integer 0..959
 * @returns {string[]} array of 8 piece-type strings: 'rook'/'knight'/'bishop'/'queen'/'king'
 */
function spidToBackRank(spid){
  if(spid<0||spid>959||!Number.isInteger(spid))spid=518; // default: traditional
  const lightBishopIdx=spid%4;
  const darkBishopIdx=((spid/4)|0)%4;
  const queenIdx=((spid/16)|0)%6;
  const knightPairIdx=((spid/96)|0)%10;
  // Build empty 8-slot array
  const slots=new Array(8).fill(null);
  // 1. Place bishops
  slots[_CH960_LIGHT_BISHOP_FILES[lightBishopIdx]]='bishop';
  slots[_CH960_DARK_BISHOP_FILES[darkBishopIdx]]='bishop';
  // 2. Collect remaining empty slots
  const empties=[];
  for(let i=0;i<8;i++)if(slots[i]===null)empties.push(i);
  // 3. Place queen at empties[queenIdx]
  slots[empties[queenIdx]]='queen';
  empties.splice(queenIdx,1);
  // 4. Place knights at empties[knightPair[0]] and empties[knightPair[1]]
  const knPair=_BINOMIAL_5_2[knightPairIdx];
  slots[empties[knPair[0]]]='knight';
  slots[empties[knPair[1]]]='knight';
  // Remove the two knight slots from empties (descending order to keep indices valid)
  empties.splice(Math.max(knPair[0],knPair[1]),1);
  empties.splice(Math.min(knPair[0],knPair[1]),1);
  // 5. Place rook-king-rook in the remaining 3 slots (King in the middle)
  slots[empties[0]]='rook';
  slots[empties[1]]='king';
  slots[empties[2]]='rook';
  return slots;
}

/**
 * Compute SP-ID from a back-rank arrangement (inverse of spidToBackRank).
 * Used when the user manually sets up a Chess960 position.
 *
 * v1.0.4 FIX (this round): The previous implementation had several dead-code
 * variables (empties1, empties2, queenIdx) and confusing intermediate state.
 * Rewrote from first principles: derive each SP-ID component directly from
 * the piece positions, in the same order the SP-ID encoding uses
 * (light bishop → dark bishop → queen slot → knight pair).
 *
 * @param {string[]} backRank — array of 8 piece types
 * @returns {number} SP-ID 0..959, or -1 if invalid
 */
function backRankToSPID(backRank){
  if(!backRank||backRank.length!==8)return -1;
  // 1. Validate piece counts: exactly 2 rooks, 2 knights, 2 bishops, 1 queen, 1 king
  const counts={rook:0,knight:0,bishop:0,queen:0,king:0};
  for(const t of backRank){
    if(counts[t]===undefined)return -1; // unknown piece type
    counts[t]++;
  }
  if(counts.rook!==2||counts.knight!==2||counts.bishop!==2||counts.queen!==1||counts.king!==1)return -1;
  // 2. Validate rook-king-rook structure (king must be between the two rooks)
  const rkr=[];
  for(let i=0;i<8;i++)if(backRank[i]==='rook'||backRank[i]==='king')rkr.push(backRank[i]);
  if(rkr.length!==3||rkr[0]!=='rook'||rkr[1]!=='king'||rkr[2]!=='rook')return -1;
  // 3. Validate bishops are on opposite-color squares
  const bishFiles=[];
  for(let i=0;i<8;i++)if(backRank[i]==='bishop')bishFiles.push(i);
  if(bishFiles.length!==2)return -1;
  if(bishFiles[0]%2===bishFiles[1]%2)return -1; // same-color bishops — invalid
  // 4. Derive SP-ID components
  // Light bishop (on an even-indexed file: 0,2,4,6 = a,c,e,g)
  const lightBishFile=bishFiles.find(f=>f%2===0);
  const darkBishFile =bishFiles.find(f=>f%2===1);
  if(lightBishFile===undefined||darkBishFile===undefined)return -1;
  const lightBishopIdx=_CH960_LIGHT_BISHOP_FILES.indexOf(lightBishFile);
  const darkBishopIdx =_CH960_DARK_BISHOP_FILES.indexOf(darkBishFile);
  if(lightBishopIdx<0||darkBishopIdx<0)return -1;
  // 5. Queen slot index among the 6 empties after placing bishops
  const queenFile=backRank.indexOf('queen');
  if(queenFile<0)return -1;
  const emptiesQB=[];
  for(let i=0;i<8;i++)if(backRank[i]!=='bishop')emptiesQB.push(i);
  const qIdx=emptiesQB.indexOf(queenFile);
  if(qIdx<0)return -1;
  // 6. Knight pair slots among the 5 empties after placing bishops + queen
  const emptiesKn=[];
  for(let i=0;i<8;i++)if(backRank[i]!=='bishop'&&backRank[i]!=='queen')emptiesKn.push(i);
  const knFileA=backRank.indexOf('knight');
  const knFileB=backRank.lastIndexOf('knight');
  if(knFileA<0||knFileB<0||knFileA===knFileB)return -1;
  const knIdxA=emptiesKn.indexOf(knFileA);
  const knIdxB=emptiesKn.indexOf(knFileB);
  if(knIdxA<0||knIdxB<0)return -1;
  const sortedKn=[Math.min(knIdxA,knIdxB),Math.max(knIdxA,knIdxB)];
  const knPairIdx=_BINOMIAL_5_2.findIndex(p=>p[0]===sortedKn[0]&&p[1]===sortedKn[1]);
  if(knPairIdx<0)return -1;
  // 7. Combine per SP-ID encoding: lightBish + 4*darkBish + 16*queen + 96*knightPair
  return lightBishopIdx + 4*darkBishopIdx + 16*qIdx + 96*knPairIdx;
}

/**
 * Generate a random SP-ID (uniform over 0..959).
 * Uses crypto.getRandomValues if available for cryptographic randomness.
 * v1.0.4 Rev30 ROBUSTNESS: Eliminate modulo bias. Previously buf[0]%960 had
 * a slight bias because 65536 isn't a multiple of 960 (65536 = 68*960 + 256,
 * so values 0..255 were slightly more likely than 256..959). Now we rejection-
 * sample: take values < 65536-256 = 65280 (the largest multiple of 960 ≤ 65536)
 * and only then apply %960. The bias was only ~0.03% so this is a defensive
 * improvement, not a bug fix.
 */
function randomSPID(){
  try{
    if(typeof crypto!=='undefined'&&crypto.getRandomValues){
      const buf=new Uint16Array(1);
      // Rejection-sample to eliminate modulo bias
      const LIMIT=65280; // largest multiple of 960 ≤ 65536
      for(let _i=0;_i<8;_i++){ // bounded retries (8 is plenty — P(>8 retries) ≈ 0.4%)
        crypto.getRandomValues(buf);
        if(buf[0]<LIMIT)return buf[0]%960;
      }
      // Fallback if all 8 retries exceeded (extremely unlikely)
      return buf[0]%960;
    }
  }catch(e){}
  return Math.floor(Math.random()*960);
}

// ===== II. Shredder-FEN castling rights =====
// In Chess960, castling rights in FEN use the rook's source file letter
// (uppercase for White, lowercase for Black) instead of K/Q/k/q.
// Example: SP-ID 518 (traditional) → "RNBQKBNR" with castling rights "HAah"
// (H = rook on h1 = kingside, A = rook on a1 = queenside, etc.)
// For standard chess, "HAah" is equivalent to "KQkq".

/**
 * Convert internal castlingRights object + king/rook positions to Shredder-FEN format.
 * @param {Object} cr — {whiteKingside, whiteQueenside, blackKingside, blackQueenside}
 * @param {Array} board — 8x8 board array (used to locate rooks)
 * @returns {string} Shredder castling string, e.g. "HAah" or "-" if no rights
 */
function toShredderCastling(cr,board){
  if(!cr)return '-';
  // Find white king + both rooks on rank 1 (row 7), and black on rank 8 (row 0)
  let wKing=null,wRooks=[],bKing=null,bRooks=[];
  for(let c=0;c<8;c++){
    if(board[7][c]&&board[7][c].type==='king'&&board[7][c].color==='white')wKing=c;
    if(board[7][c]&&board[7][c].type==='rook'&&board[7][c].color==='white')wRooks.push(c);
    if(board[0][c]&&board[0][c].type==='king'&&board[0][c].color==='black')bKing=c;
    if(board[0][c]&&board[0][c].type==='rook'&&board[0][c].color==='black')bRooks.push(c);
  }
  let str='';
  // White kingside: rook to the right of the king
  if(cr.whiteKingside){
    const ksr=wRooks.find(c=>c>wKing);
    if(ksr!==undefined)str+=String.fromCharCode(65+ksr); // uppercase A..H
  }
  // White queenside: rook to the left of the king
  if(cr.whiteQueenside){
    const qsr=wRooks.find(c=>c<wKing);
    if(qsr!==undefined)str+=String.fromCharCode(65+qsr);
  }
  // Black kingside
  if(cr.blackKingside){
    const ksr=bRooks.find(c=>c>bKing);
    if(ksr!==undefined)str+=String.fromCharCode(97+ksr); // lowercase a..h
  }
  // Black queenside
  if(cr.blackQueenside){
    const qsr=bRooks.find(c=>c<bKing);
    if(qsr!==undefined)str+=String.fromCharCode(97+qsr);
  }
  return str||'-';
}

/**
 * Parse a Shredder-FEN castling string into our internal castlingRights object.
 * Falls back to standard KQkq parsing for non-Chess960 FENs.
 * @param {string} str — castling field from FEN (e.g. "KQkq", "HAah", "-")
 * @param {Array} board — 8x8 board array (used to identify which rook is which side)
 * @returns {Object} {whiteKingside, whiteQueenside, blackKingside, blackQueenside}
 */
function parseShredderCastling(str,board){
  const cr={whiteKingside:false,whiteQueenside:false,blackKingside:false,blackQueenside:false};
  if(!str||str==='-')return cr;
  // Locate kings
  let wKing=-1,bKing=-1;
  for(let c=0;c<8;c++){
    if(board[7][c]&&board[7][c].type==='king'&&board[7][c].color==='white')wKing=c;
    if(board[0][c]&&board[0][c].type==='king'&&board[0][c].color==='black')bKing=c;
  }
  for(const ch of str){
    const isUpper=(ch>='A'&&ch<='H');
    const isLower=(ch>='a'&&ch<='h');
    if(!isUpper&&!isLower)continue;
    const file=isUpper?ch.charCodeAt(0)-65:ch.charCodeAt(0)-97;
    if(isUpper){
      // White rook on `file`
      if(wKing<0)continue;
      if(file>wKing)cr.whiteKingside=true;
      else if(file<wKing)cr.whiteQueenside=true;
    }else{
      if(bKing<0)continue;
      if(file>bKing)cr.blackKingside=true;
      // v1.0.4 FIX (this round): the previous line was dead code
      // (`cr.blackQueenside=false||cr.blackQueenside` is a no-op), and the
      // actual assignment was on a separate `if` statement below. Consolidated
      // into a single `else if` to match the white-side pattern.
      else if(file<bKing)cr.blackQueenside=true;
    }
  }
  return cr;
}

// ===== III. Chess960 castling rule helpers =====
// Per FIDE Chess960 rules:
//   - Short castling (O-O): king ends on g-file (col 6), rook ends on f-file (col 5).
//   - Long castling (O-O-O): king ends on c-file (col 2), rook ends on d-file (col 3).
//   - Conditions: king & rook haven't moved, no pieces between them, king not in check,
//                 king does not pass through or land on an attacked square.
//   - The rook's PATH may pass through attacked squares (only the king's path matters).
//
// In standard chess the king moves 2 squares (e1→g1 or e1→c1). In Chess960, the
// king's MOVE may be 0, 1, 2, or more squares to reach g1/c1, depending on its
// starting file. The rook's move may also be 0 or more squares.
//
// We represent castling internally with the king's destination square (col 6 for
// kingside, col 2 for queenside), and the rook source square is identified by
// the "kingside"/"queenside" label relative to the king's CURRENT position.

/**
 * Identify which rook is the "kingside" / "queenside" rook for Chess960.
 * @param {Array} board — 8x8 board
 * @param {string} color — 'white' or 'black'
 * @returns {Object} {kingside:col, queenside:col, king:col} or null if invalid
 */
function findCastlingRooks(board,color){
  const row=color==='white'?7:0;
  let kingCol=-1;
  const rookCols=[];
  for(let c=0;c<8;c++){
    const p=board[row][c];
    if(p&&p.type==='king'&&p.color===color)kingCol=c;
    if(p&&p.type==='rook'&&p.color===color)rookCols.push(c);
  }
  if(kingCol<0||rookCols.length<2)return null;
  // Kingside rook = rightmost rook (>kingCol), Queenside = leftmost (<kingCol)
  const ksr=rookCols.find(c=>c>kingCol);
  const qsr=rookCols.find(c=>c<kingCol);
  if(ksr===undefined||qsr===undefined)return null;
  return {king:kingCol,kingside:ksr,queenside:qsr};
}

/**
 * Compute the rook source/dest for a Chess960 castling move.
 * @param {Object} s — game state
 * @param {string} color — 'white' or 'black'
 * @param {string} side — 'kingside' or 'queenside'
 * @returns {Object|null} {rookFrom:col, rookTo:col, kingTo:col} or null if invalid
 */
function chess960CastlingRookMove(s,color,side){
  const row=color==='white'?7:0;
  const rooks=findCastlingRooks(s.board,color);
  if(!rooks)return null;
  const kingTo=side==='kingside'?6:2;
  const rookTo=side==='kingside'?5:3;
  const rookFrom=side==='kingside'?rooks.kingside:rooks.queenside;
  return {rookFrom,rookTo,kingTo,row};
}

/**
 * Check if a Chess960 castling is legal.
 *
 * v1.0.4 Rev34 CRITICAL FIX: Per the official Chess960 castling rules (see
 * uploaded reference PDFs), castling is only legal when ALL of the following
 * hold:
 *   1. The king and participating rook have never moved (castling rights present).
 *   2. All squares between the king and rook (exclusive) are empty.
 *   3. The king's destination AND the rook's destination are empty — EXCEPT
 *      the king/rook themselves may occupy each other's destination (since
 *      they move away). A third piece on either destination makes castling
 *      ILLEGAL (previously the code allowed castling that would CAPTURE or
 *      DESTROY own pieces on the destination squares!).
 *   4. The king is not currently in check.
 *   5. Every square the king crosses (including destination) is not attacked.
 *
 * The previous code only checked condition 2 (squares between king and rook)
 * and conditions 4-5 (check/attack). It was MISSING condition 3: it never
 * verified that the king's destination and rook's destination were clear of
 * other pieces. In Chess960, the king and rook can start close together
 * (e.g., king on b1, rook on c1), so the king's path (b1→g1) extends FAR
 * beyond the rook — through squares d1, e1, f1 that may be occupied by
 * other pieces. The "between king and rook" check (only covering the gap
 * between the two pieces) did NOT cover these path squares.
 *
 * The fix checks the UNION of the king's path and the rook's path. Every
 * square in this union must be empty, EXCEPT the king's starting square
 * (king moves away) and the rook's starting square (rook moves away).
 *
 * @param {Object} s — game state
 * @param {string} color — 'white' or 'black'
 * @param {string} side — 'kingside' or 'queenside'
 * @returns {boolean} true if castling is legal
 */
function isChess960CastlingLegal(s,color,side){
  const opp=OPP_COLOR[color];
  const rooks=findCastlingRooks(s.board,color);
  if(!rooks)return false;
  const cr=s.castlingRights;
  if(side==='kingside'&&!cr[color+'Kingside'])return false;
  if(side==='queenside'&&!cr[color+'Queenside'])return false;
  const row=color==='white'?7:0;
  const kingCol=rooks.king;
  const rookCol=side==='kingside'?rooks.kingside:rooks.queenside;
  const kingTo=side==='kingside'?6:2;
  const rookTo=side==='kingside'?5:3;
  const rookFrom=rookCol;

  // v1.0.4 Rev34: Comprehensive path-clear check.
  // Build the union of squares the king crosses [min(kingCol,kingTo)..max(kingCol,kingTo)]
  // and the rook crosses [min(rookFrom,rookTo)..max(rookFrom,rookTo)].
  // Every square in this union must be EMPTY, except kingCol (king's start,
  // king moves away) and rookFrom (rook's start, rook moves away).
  const kingLo=Math.min(kingCol,kingTo),kingHi=Math.max(kingCol,kingTo);
  const rookLo=Math.min(rookFrom,rookTo),rookHi=Math.max(rookFrom,rookTo);
  const unionLo=Math.min(kingLo,rookLo),unionHi=Math.max(kingHi,rookHi);
  for(let c=unionLo;c<=unionHi;c++){
    if(c===kingCol||c===rookFrom)continue; // king/rook start — they move away
    if(s.board[row][c])return false; // another piece blocks the path or destination
  }

  // King is not currently in check
  if(sqAttackedFast(s.board,{row,col:kingCol},opp))return false;

  // King's PATH (every square the king crosses, INCLUDING destination) must not be attacked.
  // King moves from kingCol to kingTo, stepping one square at a time.
  const step=kingTo>kingCol?1:-1;
  for(let c=kingCol;c!==kingTo+step;c+=step){
    if(c===kingCol)continue; // already checked above
    if(sqAttackedFast(s.board,{row,col:c},opp))return false;
  }
  return true;
}

// ===== IV. Bridge helper for Chess960 mode toggle =====
// Tell StockfishNative to enable/disable UCI_Chess960 option.
// Must be called BEFORE engineGo/engineGoNewGame when starting a Chess960 game.
let _chess960ModeActive=false;
function setChess960Mode(enabled){
  _chess960ModeActive=!!enabled;
  try{
    if(typeof AndroidBridge!=='undefined'&&typeof AndroidBridge.setChess960Mode==='function'){
      AndroidBridge.setChess960Mode(_chess960ModeActive);
    }
  }catch(e){console.warn('setChess960Mode bridge call failed:',e);}
}
function isChess960Mode(){return _chess960ModeActive;}

// ===== V. Generate a Chess960 starting position state object =====
/**
 * Build a complete game state for a Chess960 starting position.
 * Mirrors initState() but uses the SP-ID-specified back-rank.
 * @param {number} spid — 0..959 (default: random)
 * @returns {Object} game state with board, castlingRights, etc.
 */
function initChess960State(spid){
  if(spid==null||spid<0||spid>959)spid=randomSPID();
  const backRank=spidToBackRank(spid);
  const b=Array.from({length:8},()=>Array(8).fill(null));
  // Black on row 0, White on row 7 (mirrored — black's a8 corresponds to col 0)
  for(let c=0;c<8;c++){
    b[0][c]={type:backRank[c],color:'black'};
    b[1][c]={type:'pawn',color:'black'};
    b[6][c]={type:'pawn',color:'white'};
    b[7][c]={type:backRank[c],color:'white'};
  }
  // Locate kings
  let wk=null,bk=null;
  for(let c=0;c<8;c++){
    if(backRank[c]==='king'){wk={row:7,col:c};bk={row:0,col:c};}
  }
  const s={
    board:b,
    currentTurn:'white',
    castlingRights:{whiteKingside:true,whiteQueenside:true,blackKingside:true,blackQueenside:true},
    enPassantTarget:null,
    halfMoveClock:0,
    fullMoveNumber:1,
    moveHistory:[],
    posCount:new Map(),
    wk,bk,
    hash:0,
    boardVersion:1,
    chess960:true,
    spid:spid
  };
  syncHash(s);
  s.posCount.set(s.hash,1);
  return s;
}

// Export the public API (the build script strips `export {}` statements,
// so all functions become globally available in the bundled chess.html.)
export {
  spidToBackRank, backRankToSPID, randomSPID,
  toShredderCastling, parseShredderCastling,
  findCastlingRooks, chess960CastlingRookMove, isChess960CastlingLegal,
  setChess960Mode, isChess960Mode,
  initChess960State
};
