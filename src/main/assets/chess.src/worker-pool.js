// ===================== MODULE: worker-pool =====================
// Web Worker pool for offloading heavy computations from the UI thread.
// v1.0.4 NEW (this round): introduces Web Workers for:
//   1. PGN parsing (tablebase.js _parsePGN — can take 100+ms for long games
//      with many variations)
//   2. Statistics computation (stats.html — the heatmap-control walk can take
//      1-2 seconds for 100+ move games)
//   3. Control-map computation (game-logic.js getCtrlMap — called on every
//      render tick when showCtrlMap is on; for Chess960 with many pieces
//      this is non-trivial)
//
// Implementation strategy: a single bundled worker script (created from a
// Blob URL at runtime) handles all three task types via a `cmd` field.
// This avoids CSP issues with separate .js files (the WebView CSP is
// `script-src 'unsafe-inline'` which permits blob: URLs in modern WebView).
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

// ===== Worker capability detection =====
let _workerSupported=typeof Worker!=='undefined'&&typeof URL!=='undefined'&&typeof URL.createObjectURL==='function';
// WebView on Android 5.0 (API 21) supports Workers, but some older devices
// may have it disabled. We always fall back to inline execution on failure.
let _workerBlobUrl=null;
let _workerInstance=null;
let _workerTaskId=0;
const _workerPending=new Map(); // taskId -> {resolve, reject, transferBack}

// ===== Worker source code (as a string; instantiated via Blob) =====
// The worker is self-contained: it has its own copy of the chess logic
// (board, moves, control map, FEN, SAN parsing) since Workers cannot share
// the main thread's scope. To keep the bundle small, we only inline the
// functions the worker actually needs: parsePGN, fenToState, stateToFEN,
// attacked, getCtrlMap, basic move execution for control-map computation.
const _WORKER_SOURCE = `
"use strict";
// ====== Inline chess primitives (subset of game-logic.js) ======
const KNIGHT_OFFSETS=[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
const DIR_ROOK=[[-1,0],[1,0],[0,-1],[0,1]];
const DIR_BISHOP=[[-1,-1],[-1,1],[1,-1],[1,1]];
const DIR_QUEEN=DIR_ROOK.concat(DIR_BISHOP);
const OPP_COLOR={white:'black',black:'white'};
const _PIECE_FEN={white:{king:'K',queen:'Q',rook:'R',bishop:'B',knight:'N',pawn:'P'},black:{king:'k',queen:'q',rook:'r',bishop:'b',knight:'n',pawn:'p'}};

function inB(r,c){return r>=0&&r<8&&c>=0&&c<8}
function posAlg(p){return String.fromCharCode(97+p.col)+(8-p.row)}
function algPos(a){if(!a)return null;const c=a.charCodeAt(0)-97;const r=8-parseInt(a[1]);if(c<0||c>7||r<0||r>7||isNaN(r))return null;return{row:r,col:c}}

function attacked(board,pos){
  const b=board,p=b[pos.row][pos.col];if(!p)return[];
  const r=pos.row,c=pos.col,co=p.color,mv=[];
  if(p.type==='pawn'){const d=co==='white'?-1:1;for(const dc of[-1,1])if(inB(r+d,c+dc))mv.push({row:r+d,col:c+dc})}
  else if(p.type==='knight'){for(const[dr,dc]of KNIGHT_OFFSETS)if(inB(r+dr,c+dc))mv.push({row:r+dr,col:c+dc})}
  else if(p.type==='king'){for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++)if((dr||dc)&&inB(r+dr,c+dc))mv.push({row:r+dr,col:c+dc})}
  else{const dirs=p.type==='rook'?DIR_ROOK:p.type==='bishop'?DIR_BISHOP:DIR_QUEEN;for(const[dr,dc] of dirs){let nr=r+dr,nc=c+dc;while(inB(nr,nc)){mv.push({row:nr,col:nc});if(b[nr][nc])break;nr+=dr;nc+=dc}}}
  return mv;
}

function sqAttackedFast(b,pos,byCo){
  if(!b||!pos||!inB(pos.row,pos.col))return false;
  const r=pos.row,c=pos.col;
  const pd=byCo==='white'?1:-1;
  if(inB(r+pd,c-1)&&b[r+pd][c-1]&&b[r+pd][c-1].color===byCo&&b[r+pd][c-1].type==='pawn')return true;
  if(inB(r+pd,c+1)&&b[r+pd][c+1]&&b[r+pd][c+1].color===byCo&&b[r+pd][c+1].type==='pawn')return true;
  for(const[dr,dc] of KNIGHT_OFFSETS){if(inB(r+dr,c+dc)&&b[r+dr][c+dc]&&b[r+dr][c+dc].color===byCo&&b[r+dr][c+dc].type==='knight')return true}
  for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){if(!dr&&!dc)continue;if(inB(r+dr,c+dc)&&b[r+dr][c+dc]&&b[r+dr][c+dc].color===byCo&&b[r+dr][c+dc].type==='king')return true}
  for(const[dr,dc] of DIR_ROOK){let nr=r+dr,nc=c+dc;while(inB(nr,nc)){const p=b[nr][nc];if(p){if(p.color===byCo&&(p.type==='rook'||p.type==='queen'))return true;break}nr+=dr;nc+=dc}}
  for(const[dr,dc] of DIR_BISHOP){let nr=r+dr,nc=c+dc;while(inB(nr,nc)){const p=b[nr][nc];if(p){if(p.color===byCo&&(p.type==='bishop'||p.type==='queen'))return true;break}nr+=dr;nc+=dc}}
  return false;
}

function getCtrlMap(b){
  const cm=[];
  for(let r=0;r<8;r++){cm[r]=[];for(let c=0;c<8;c++)cm[r][c]={white:[],black:[]}}
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){
    const p=b[r][c];
    if(!p)continue;
    const atks=attacked(b,{row:r,col:c});
    for(const a of atks){
      cm[a.row][a.col][p.color].push({piece:{type:p.type,color:p.color},position:{row:r,col:c}});
    }
  }
  return cm;
}

function initBoard(){
  const b=Array.from({length:8},()=>Array(8).fill(null));
  const backRank=['rook','knight','bishop','queen','king','bishop','knight','rook'];
  for(let c=0;c<8;c++){
    b[0][c]={type:backRank[c],color:'black'};
    b[1][c]={type:'pawn',color:'black'};
    b[6][c]={type:'pawn',color:'white'};
    b[7][c]={type:backRank[c],color:'white'};
  }
  return b;
}

function initState(){
  const s={board:initBoard(),currentTurn:'white',castlingRights:{whiteKingside:true,whiteQueenside:true,blackKingside:true,blackQueenside:true},enPassantTarget:null,halfMoveClock:0,fullMoveNumber:1,moveHistory:[],wk:{row:7,col:4},bk:{row:0,col:4}};
  return s;
}

function fenToState(fen){
  if(!fen||typeof fen!=='string')return null;
  // Accept minimal FENs (board + side-to-move only); castling/en-passant/clock
  // fields are optional and default sensibly. Consistent with the main-thread
  // fenToState in tablebase.js. NOTE: no backticks in this comment — it lives
  // inside the _WORKER_SOURCE template literal.
  const parts=fen.trim().split(/\\s+/);
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
      if(type==='king'){if(color==='white')wk={row:r,col:c};else bk={row:r,col:c}}
      c++;
    }
    if(c!==8)return null;
  }
  if(!wk||!bk)return null;
  const turn=parts[1]==='b'?'black':'white';
  const crStr=parts[2]||'-';
  // Support both standard KQkq and Shredder (HAah) formats
  let castlingRights;
  const isShredder=/[A-Ha-h]/.test(crStr)&&!/[KQkq]/.test(crStr.replace(/[A-Ha-h]/g,''));
  if(isShredder){
    castlingRights={whiteKingside:false,whiteQueenside:false,blackKingside:false,blackQueenside:false};
    for(const ch of crStr){
      const isUpper=(ch>='A'&&ch<='H');const isLower=(ch>='a'&&ch<='h');
      if(!isUpper&&!isLower)continue;
      const file=isUpper?ch.charCodeAt(0)-65:ch.charCodeAt(0)-97;
      if(isUpper){
        if(wk.col>=0&&file>wk.col)castlingRights.whiteKingside=true;
        else if(wk.col>=0&&file<wk.col)castlingRights.whiteQueenside=true;
      }else{
        if(bk.col>=0&&file>bk.col)castlingRights.blackKingside=true;
        else if(bk.col>=0&&file<bk.col)castlingRights.blackQueenside=true;
      }
    }
  }else{
    castlingRights={whiteKingside:crStr.includes('K'),whiteQueenside:crStr.includes('Q'),blackKingside:crStr.includes('k'),blackQueenside:crStr.includes('q')};
  }
  let enPassantTarget=null;
  if(parts[3]&&parts[3]!=='-'){const ec=parts[3].charCodeAt(0)-97;const er=8-parseInt(parts[3][1]);if(er>=0&&er<8&&ec>=0&&ec<8)enPassantTarget={row:er,col:ec}}
  const halfMoveClock=parts[4]?parseInt(parts[4])||0:0;
  const fullMoveNumber=parts[5]?parseInt(parts[5])||1:1;
  return {board,currentTurn:turn,castlingRights,enPassantTarget,halfMoveClock,fullMoveNumber,wk,bk};
}

function stateToFEN(s){
  if(!s||!s.board)return '';
  let fen='';
  for(let r=0;r<8;r++){
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
  let castle='';
  const cr=s.castlingRights||{};
  if(cr.whiteKingside)castle+='K';
  if(cr.whiteQueenside)castle+='Q';
  if(cr.blackKingside)castle+='k';
  if(cr.blackQueenside)castle+='q';
  fen+=' '+(castle||'-');
  fen+=' '+(s.enPassantTarget?posAlg(s.enPassantTarget):'-');
  fen+=' '+(s.halfMoveClock||0);
  fen+=' '+(s.fullMoveNumber||1);
  return fen;
}

// ====== Move application (simplified, in-place) ======
function makeMvInPlace(s,mv){
  const{from,to,piece,promotion}=mv;
  if(!piece||!s.board[from.row]||!s.board[from.row][from.col])return null;
  const capPiece=s.board[to.row][to.col];
  const undo={from:{r:from.row,c:from.col},to:{r:to.row,c:to.col},piece:{type:piece.type,color:piece.color},capPiece:capPiece?{type:capPiece.type,color:capPiece.color}:null,oldWk:s.wk?{r:s.wk.row,c:s.wk.col}:null,oldBk:s.bk?{r:s.bk.row,c:s.bk.col}:null,oldCastling:{...s.castlingRights},oldEnPassant:s.enPassantTarget?{r:s.enPassantTarget.row,c:s.enPassantTarget.col}:null,oldHalfMove:s.halfMoveClock,oldFullMove:s.fullMoveNumber,promotion:promotion||null};
  s.board[to.row][to.col]=s.board[from.row][from.col];
  s.board[from.row][from.col]=null;
  // En passant
  if(piece.type==='pawn'&&s.enPassantTarget&&to.row===s.enPassantTarget.row&&to.col===s.enPassantTarget.col){
    const cr=piece.color==='white'?to.row+1:to.row-1;
    if(s.board[cr]&&s.board[cr][to.col]&&s.board[cr][to.col].type==='pawn'&&s.board[cr][to.col].color!==piece.color){
      undo.epCaptured={r:cr,c:to.col};
      s.board[cr][to.col]=null;
    }
  }
  // Castling: standard chess only (king moves 2 squares)
  if(piece.type==='king'&&Math.abs(to.col-from.col)===2){
    if(to.col===6){s.board[from.row][5]=s.board[from.row][7];s.board[from.row][7]=null;undo.castlingRook={from:{r:from.row,c:7},to:{r:from.row,c:5}}}
    if(to.col===2){s.board[from.row][3]=s.board[from.row][0];s.board[from.row][0]=null;undo.castlingRook={from:{r:from.row,c:0},to:{r:from.row,c:3}}}
  }
  if(promotion)s.board[to.row][to.col]={type:promotion,color:piece.color};
  if(piece.type==='king'){if(piece.color==='white'){s.wk={row:to.row,col:to.col};s.castlingRights.whiteKingside=false;s.castlingRights.whiteQueenside=false}else{s.bk={row:to.row,col:to.col};s.castlingRights.blackKingside=false;s.castlingRights.blackQueenside=false}}
  if(piece.type==='rook'){if(from.row===7&&from.col===0)s.castlingRights.whiteQueenside=false;if(from.row===7&&from.col===7)s.castlingRights.whiteKingside=false;if(from.row===0&&from.col===0)s.castlingRights.blackQueenside=false;if(from.row===0&&from.col===7)s.castlingRights.blackKingside=false}
  if(capPiece&&capPiece.type==='rook'){if(capPiece.color==='white'){if(to.row===7&&to.col===0)s.castlingRights.whiteQueenside=false;if(to.row===7&&to.col===7)s.castlingRights.whiteKingside=false}else{if(to.row===0&&to.col===0)s.castlingRights.blackQueenside=false;if(to.row===0&&to.col===7)s.castlingRights.blackKingside=false}}
  if(piece.type==='pawn'&&Math.abs(to.row-from.row)===2){const epRow=(from.row+to.row)/2;s.enPassantTarget={row:epRow,col:from.col}}else{s.enPassantTarget=null}
  s.halfMoveClock=(piece.type==='pawn'||capPiece)?0:s.halfMoveClock+1;
  if(piece.color==='black')s.fullMoveNumber++;
  s.currentTurn=OPP_COLOR[s.currentTurn];
  return undo;
}

// ====== PGN parsing (subset of tablebase._parsePGN) ======
function parsePGN(pgnText){
  if(!pgnText||typeof pgnText!=='string')return null;
  try{if(pgnText.charCodeAt(0)===0xFEFF)pgnText=pgnText.substring(1);}catch(e){return null}
  pgnText=pgnText.replace(/\\r\\n/g,'\\n').replace(/\\r/g,'\\n');
  pgnText=pgnText.replace(/^%.*$/gm,'');
  pgnText=pgnText.replace(/\\u00a0/g,' ');
  const gameBlocks=pgnText.split(/\\n\\s*\\n(?=\\[)/);
  if(gameBlocks.length>1)pgnText=gameBlocks[0];
  let startFEN=null;
  const fenMatch=pgnText.match(/\\[FEN\\s+"([^"]+)"\\]/i);
  if(fenMatch)startFEN=fenMatch[1];
  else{const fenNoQuoteMatch=pgnText.match(/\\[FEN\\s+([^\\]\\n]+)\\]/i);if(fenNoQuoteMatch)startFEN=fenNoQuoteMatch[1].trim()}
  // Variant tag (Chess960)
  let variant=null;
  const variantMatch=pgnText.match(/\\[Variant\\s+"([^"]+)"\\]/i);
  if(variantMatch){const v=variantMatch[1].toLowerCase();if(v==='chess960'||v==='fischerandom'||v==='fischer random'||v==='frc')variant='chess960'}
  // Tags
  const tags={};
  const tagRe=/\\[(\\w+)\\s+"?((?:[^"\\\\]|\\\\.)*)"?"?\\s*\\]/g;
  let m;
  while((m=tagRe.exec(pgnText))!==null){tags[m[1]]=m[2]||''}
  let moveText=pgnText.replace(/^\\[[^\\]]*\\]/gm,'').trim();
  moveText=moveText.replace(/\\\\\\s*\\n/g,' ');
  {let _i=0;while(moveText.includes('{')&&_i++<10)moveText=moveText.replace(/\\{[^{}]*\\}/g,'');}
  moveText=moveText.replace(/;[^\\n]*/g,'');
  let text=moveText.replace(/\\$\\d+/g,'');
  text=text.replace(/\\b1-0\\b/g,'').replace(/\\b0-1\\b/g,'').replace(/\\b1\\/2-1\\/2\\b/g,'').replace(/\\*/g,'');
  text=text.replace(/\\b1\\s+-\\s+0\\b/g,'').replace(/\\b0\\s+-\\s+1\\b/g,'').replace(/\\b1\\/2\\s+-\\s+1\\/2\\b/g,'');
  text=text.replace(/\\s+/g,' ').trim();
  text=text.replace(/(\\d+\\.+(?=[a-zA-Z]))/g,'$1 ');
  // v1.0.5 Round-6 Rev62 (2026.6.27) FIX: add 'O' to the character class so
  // PGN move numbers followed by castling notation (e.g. "1 O-O" without a
  // dot) are correctly normalized to "1. O-O". Previously the regex
  // (?=[a-hKQRBN]) did not match 'O', so "1 O-O" would not get the ". "
  // inserted, causing the "1" to be mis-tokenized as a SAN move and skipped.
  // NOTE: no backticks in this comment — it lives inside the _WORKER_SOURCE
  // template literal, and backticks would prematurely terminate it (Rev57 bug).
  text=text.replace(/(^|\\s)(\\d+)\\s+(?=[a-hKQRBNO])/g,'$1$2. ');
  text=text.replace(/\\s[!?]{1,5}\\s/g,' ');
  text=text.replace(/^[!?]{1,5}\\s/g,'').replace(/\\s[!?]{1,5}$/g,'');
  if(!text)return null;
  text=text.replace(/\\(/g,' ( ').replace(/\\)/g,' ) ');
  const rawTokens=text.match(/\\(|\\)|\\S+/g)||[];
  if(rawTokens.length===0)return null;
  const moveNumRe=/^\\d+\\.+$/;
  const moveNumPrefixRe=/^\\d+\\.+\\s*/;
  const ellipsisRe=/^\\.\\.\\.+$/;
  const skipTokens=new Set(['1-0','0-1','1/2-1/2','*']);
  const annotRe=/[!?]+$/;
  const rootFrame={tokens:[],subVars:[],localMoveIdx:0,attachToMoveIdx:-1,mainMoveIdx:-1};
  const stack=[rootFrame];
  for(const token of rawTokens){
    if(token==='('){const parent=stack[stack.length-1];const attachIdx=parent.localMoveIdx>0?parent.localMoveIdx-1:0;const mainIdx=(parent===rootFrame)?attachIdx:parent.mainMoveIdx;const newFrame={tokens:[],subVars:[],localMoveIdx:0,attachToMoveIdx:attachIdx,mainMoveIdx:mainIdx};parent.subVars.push({tree:newFrame,attachToMoveIdx:attachIdx});stack.push(newFrame);continue}
    if(token===')'){if(stack.length>1)stack.pop();continue}
    if(moveNumRe.test(token)||ellipsisRe.test(token)||skipTokens.has(token))continue;
    const clean=token.replace(moveNumPrefixRe,'').replace(annotRe,'');
    if(!clean)continue;
    const frame=stack[stack.length-1];
    frame.tokens.push(clean);
    frame.localMoveIdx++;
  }
  const variations=new Map();
  function _flatten(frame,prefix){
    if(frame.tokens.length>0){const combined=prefix.concat(frame.tokens);const mi=frame.mainMoveIdx;if(!variations.has(mi))variations.set(mi,[]);variations.get(mi).push({sanTokens:combined})}
    for(const sv of frame.subVars){const subPrefix=prefix.concat(frame.tokens.slice(0,sv.attachToMoveIdx));_flatten(sv.tree,subPrefix)}
  }
  for(const sv of rootFrame.subVars)_flatten(sv.tree,[]);
  let mainTokens=[];let inVar=0;
  for(const token of rawTokens){
    if(token==='('){inVar++;continue}
    if(token===')'){inVar=Math.max(0,inVar-1);continue}
    if(inVar>0)continue;
    if(moveNumRe.test(token)||ellipsisRe.test(token)||skipTokens.has(token))continue;
    const clean=token.replace(moveNumPrefixRe,'').replace(annotRe,'');
    if(clean)mainTokens.push(clean);
  }
  if(mainTokens.length===0)return null;
  // Return raw main-line SAN tokens + variations map + startFEN + variant
  return {mainTokens,variations,startFEN,variant,tags};
}

// ====== Stats: heatmap control walk ======
// Given a parsed game (mainTokens + startFEN + a simple SAN→move matcher),
// walk every position and accumulate per-square attacker counts.
// We accept pre-parsed moves from the main thread (faster than re-parsing
// SAN inside the worker, since the main thread already has the parsed moves
// with from/to coordinates).
function computeHeatmapStats(initialState, moves){
  // moves: array of {from:{row,col}, to:{row,col}, piece:{type,color}, promotion?}
  const ctrlW=Array.from({length:8},()=>new Array(8).fill(0));
  const ctrlB=Array.from({length:8},()=>new Array(8).fill(0));
  let posCount=0;
  // Deep clone the initial state (we mutate it as we walk)
  const s={
    board:initialState.board.map(r=>r.map(p=>p?{type:p.type,color:p.color}:null)),
    currentTurn:initialState.currentTurn,
    castlingRights:{...initialState.castlingRights},
    enPassantTarget:initialState.enPassantTarget?{...initialState.enPassantTarget}:null,
    halfMoveClock:initialState.halfMoveClock||0,
    fullMoveNumber:initialState.fullMoveNumber||1,
    wk:initialState.wk?{...initialState.wk}:null,
    bk:initialState.bk?{...initialState.bk}:null
  };
  // Accumulate initial position
  const cm0=getCtrlMap(s.board);
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){ctrlW[r][c]+=cm0[r][c].white.length;ctrlB[r][c]+=cm0[r][c].black.length}
  posCount++;
  for(const mv of moves){
    if(!mv)continue;
    const undo=makeMvInPlace(s,mv);
    if(!undo)continue;
    const cm=getCtrlMap(s.board);
    for(let r=0;r<8;r++)for(let c=0;c<8;c++){ctrlW[r][c]+=cm[r][c].white.length;ctrlB[r][c]+=cm[r][c].black.length}
    posCount++;
  }
  return {ctrlW,ctrlB,posCount};
}

// ====== Worker message handler ======
self.onmessage=function(e){
  const msg=e.data;
  if(!msg||!msg.cmd){self.postMessage({taskId:msg&&msg.taskId,error:'Missing cmd'});return}
  const taskId=msg.taskId;
  try{
    let result;
    if(msg.cmd==='parsePGN'){
      result=parsePGN(msg.pgnText);
    }else if(msg.cmd==='computeHeatmapStats'){
      result=computeHeatmapStats(msg.initialState,msg.moves);
    }else if(msg.cmd==='getCtrlMap'){
      result=getCtrlMap(msg.board);
    }else{
      self.postMessage({taskId:taskId,error:'Unknown cmd: '+msg.cmd});
      return;
    }
    self.postMessage({taskId:taskId,result:result});
  }catch(err){
    self.postMessage({taskId:taskId,error:err.message||String(err),stack:err.stack});
  }
};
`;

// ====== Worker initialization ======
function _initWorker(){
  if(!_workerSupported)return false;
  try{
    const blob=new Blob([_WORKER_SOURCE],{type:'application/javascript'});
    _workerBlobUrl=URL.createObjectURL(blob);
    _workerInstance=new Worker(_workerBlobUrl);
    _workerInstance.onmessage=function(e){
      const msg=e.data;
      if(!msg||typeof msg.taskId!=='number')return;
      const pending=_workerPending.get(msg.taskId);
      if(!pending)return;
      _workerPending.delete(msg.taskId);
      if(msg.error){pending.reject(new Error(msg.error));}
      else{pending.resolve(msg.result);}
    };
    _workerInstance.onerror=function(e){
      console.error('Worker error:',e.message||e);
      // Reject ALL pending tasks — the worker is in an unknown state.
      // v1.0.5 Round-6 Rev62 (2026.6.27) FIX: collect keys first, then delete.
      // Modifying a Map during for...of iteration is spec-allowed but some
      // engines may skip entries or behave unexpectedly. Array.from() takes
      // a snapshot of the keys before any deletion, guaranteeing all pending
      // tasks are rejected.
      const ids=Array.from(_workerPending.keys());
      for(const id of ids){
        const pending=_workerPending.get(id);
        if(pending)pending.reject(new Error('Worker error: '+(e.message||'unknown')));
        _workerPending.delete(id);
      }
    };
    return true;
  }catch(e){
    console.warn('Worker init failed, falling back to inline:',e);
    _workerSupported=false;
    return false;
  }
}

// ====== Public API ======
// All public functions return Promises. If Workers are unavailable, they
// fall back to inline execution (which blocks the UI thread but produces
// identical results). This guarantees feature parity across all devices.

/**
 * Parse PGN text off the main thread.
 * @param {string} pgnText
 * @returns {Promise<Object>} parsed PGN result (mainTokens, variations, startFEN, variant, tags)
 */
function workerParsePGN(pgnText){
  return new Promise((resolve,reject)=>{
    if(!_workerSupported||(!_workerInstance&&!_initWorker())){
      // Fallback: parse inline using the worker's source via eval.
      // This is sub-optimal but ensures correctness on Worker-less devices.
      try{
        // The main thread already has _parsePGN() from tablebase.js in scope
        // (bundled in the same file). Use it directly.
        if(typeof _parsePGN==='function'){
          resolve(_parsePGN(pgnText));
        }else{
          reject(new Error('PGN parser unavailable'));
        }
      }catch(e){reject(e);}
      return;
    }
    const taskId=++_workerTaskId;
    _workerPending.set(taskId,{resolve,reject});
    try{
      _workerInstance.postMessage({cmd:'parsePGN',pgnText:pgnText,taskId:taskId});
    }catch(e){
      _workerPending.delete(taskId);
      reject(e);
    }
  });
}

/**
 * Compute heatmap statistics off the main thread.
 * @param {Object} initialState — initial game state (board, currentTurn, etc.)
 * @param {Array} moves — array of {from, to, piece, promotion?}
 * @returns {Promise<Object>} {ctrlW, ctrlB, posCount}
 */
function workerComputeHeatmapStats(initialState,moves){
  return new Promise((resolve,reject)=>{
    if(!_workerSupported||(!_workerInstance&&!_initWorker())){
      // Fallback: inline implementation (replicates the worker's logic)
      try{
        // Use the main-thread getCtrlMap + makeMvInPlace
        if(typeof getCtrlMap!=='function'||typeof makeMvInPlace!=='function'){
          reject(new Error('Required functions unavailable for inline fallback'));
          return;
        }
        const ctrlW=Array.from({length:8},()=>new Array(8).fill(0));
        const ctrlB=Array.from({length:8},()=>new Array(8).fill(0));
        let posCount=0;
        const s=cloneS(initialState);
        const cm0=getCtrlMap(s.board);
        for(let r=0;r<8;r++)for(let c=0;c<8;c++){ctrlW[r][c]+=cm0[r][c].white.length;ctrlB[r][c]+=cm0[r][c].black.length}
        posCount++;
        for(const mv of moves){
          if(!mv)continue;
          const undo=makeMvInPlace(s,mv);
          if(!undo)continue;
          const cm=getCtrlMap(s.board);
          for(let r=0;r<8;r++)for(let c=0;c<8;c++){ctrlW[r][c]+=cm[r][c].white.length;ctrlB[r][c]+=cm[r][c].black.length}
          posCount++;
        }
        resolve({ctrlW,ctrlB,posCount});
      }catch(e){reject(e);}
      return;
    }
    const taskId=++_workerTaskId;
    _workerPending.set(taskId,{resolve,reject});
    try{
      _workerInstance.postMessage({cmd:'computeHeatmapStats',initialState:initialState,moves:moves,taskId:taskId});
    }catch(e){
      _workerPending.delete(taskId);
      reject(e);
    }
  });
}

/**
 * Compute control map for a single board position off the main thread.
 * Useful when the main thread is busy with rendering and a control-map
 * refresh would cause a frame drop.
 * @param {Array} board — 8x8 board array
 * @returns {Promise<Object>} control map (8x8 of {white:[], black:[]})
 */
function workerGetCtrlMap(board){
  return new Promise((resolve,reject)=>{
    if(!_workerSupported||(!_workerInstance&&!_initWorker())){
      try{
        if(typeof getCtrlMap!=='function'){reject(new Error('getCtrlMap unavailable'));return}
        resolve(getCtrlMap(board));
      }catch(e){reject(e);}
      return;
    }
    const taskId=++_workerTaskId;
    _workerPending.set(taskId,{resolve,reject});
    try{
      _workerInstance.postMessage({cmd:'getCtrlMap',board:board,taskId:taskId});
    }catch(e){
      _workerPending.delete(taskId);
      reject(e);
    }
  });
}

/**
 * Check whether the worker pool is currently available.
 */
function isWorkerSupported(){return _workerSupported;}

/**
 * v1.0.4 Rev44: Terminate the Web Worker to prevent memory leaks.
 * Called from pagehide/beforeunload events. In Android WebView, Worker threads
 * are NOT automatically destroyed when the page is unloaded — they persist
 * until explicitly terminated, causing OOM after repeated page loads.
 * After termination, the worker can be re-created on next use via _initWorker().
 */
function terminateWorker(){
  if(_workerInstance){
    try{
      _workerInstance.terminate();
    }catch(e){console.warn('Worker terminate failed:',e);}
    _workerInstance=null;
  }
  if(_workerBlobUrl){
    try{URL.revokeObjectURL(_workerBlobUrl);}catch(e){}
    _workerBlobUrl=null;
  }
  _workerPending.clear();
  _workerSupported=true; // Re-enable for potential re-init
}

// v1.0.4 Rev44: Register lifecycle events to terminate the worker on page exit.
// This prevents the memory leak described in the review report (item 1).
if(typeof window!=='undefined'){
  window.addEventListener('pagehide',terminateWorker);
  window.addEventListener('beforeunload',terminateWorker);
}

// Export the public API (the build script strips `export {}` statements).
export {workerParsePGN, workerComputeHeatmapStats, workerGetCtrlMap, isWorkerSupported, terminateWorker};
