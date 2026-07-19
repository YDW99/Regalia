// ===================== MODULE: pgn-standard =====================
// PGN (Portable Game Notation) standardization utilities
//
// Implements the 1994 PGN specification (Steven J. Edwards) plus modern
// de-facto extensions ([%eval], [%clk]) used by Lichess/Chessbase.
//
// Key functions:
//   - buildStandardPGN()  : compose a PGN-compliant game record
//   - parseStandardPGN()  : tolerant parser that auto-corrects common errors
//   - normalizeTagValue() : escape backslashes and quotes in tag values
//   - sevenTagRoster()    : build the mandatory 7-tag roster
//
// Copyright (C) 2026 Regalia
//
// PGN encoding/decoding patterns derived from DroidFish PGN parsing
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

// ===== I. Tag-pair encoding =====

/**
 * Escape backslashes and double-quotes per PGN spec §3.2 ("Tag Pair section"):
 *   - Backslash \ → \\
 *   - Double-quote " → \"
 * Also strips bare newlines (a tag value MUST be a single line).
 */
function normalizeTagValue(v){
  if(v==null)return '?';
  let s=String(v);
  s=s.replace(/\\/g,'\\\\').replace(/"/g,'\\"');
  // v1.1.1 Phase 60 (audit P1-4.16): Also strip tab characters — PGN spec
  //   requires tag values to be single-line, and tab is not allowed.
  s=s.replace(/[\r\n\t]+/g,' '); // single-line, no tabs
  return s;
}

/**
 * Build the mandatory Seven-Tag Roster (STR) per PGN spec.
 * Event/Site/Round/White/Black default to "?" when unknown.
 * Date defaults to "????.??.??". Result is required and must match movetext terminator.
 *
 * @param {Object} info — {event, site, date, round, white, black, result}
 *   result must be one of "1-0","0-1","1/2-1/2","*"
 * @returns {string} multi-line tag-pair section (no trailing newline)
 */
function sevenTagRoster(info){
  // v1.1.2 PHASE 71 (robustness): guard against null/undefined info (a caller
  // passing `null` would previously throw a TypeError at `info.result`).
  // Defensive — callers should always pass an object, but the cost is trivial.
  info=info||{};
  const r=info.result||'*';
  // Validate Result — only the 4 legal values are allowed
  const validResults=['1-0','0-1','1/2-1/2','*'];
  const result=validResults.includes(r)?r:'*';
  const tags=[
    ['Event',info.event||'?'],
    ['Site',info.site||'?'],
    ['Date',info.date||'????.??.??'],
    ['Round',info.round||'?'],
    ['White',info.white||'?'],
    ['Black',info.black||'?'],
    ['Result',result]
  ];
  return tags.map(([k,v])=>'['+k+' "'+normalizeTagValue(v)+'"]').join('\n');
}

/**
 * Build a supplementary tag-pair line list (one per tag).
 * Used for: WhiteElo, BlackElo, TimeControl, ECO, Opening, Variant, FEN, SetUp, PlyCount, Annotator, Termination
 *
 * @param {Object} tags — {key:value, ...}
 * @returns {string[]} array of "[Key \"Value\"]" strings, suitable for joining
 */
function supplementaryTags(tags){
  if(!tags)return [];
  const out=[];
  for(const k of Object.keys(tags)){
    if(!tags[k])continue;
    out.push('['+k+' "'+normalizeTagValue(tags[k])+'"]');
  }
  return out;
}

// ===== II. Movetext assembly =====

/**
 * Format a half-move with proper move-number prefix per PGN spec §8.1.
 *   - White's move: "N. SAN"
 *   - Black's move starting fresh: "N... SAN"  (rare; only if leading)
 *   - Black's move following White's: "SAN"  (no number prefix)
 *
 * @param {number} moveNum  — full-move number (1-based)
 * @param {string} color    — 'white' or 'black'
 * @param {string} san      — SAN of the move (already validated)
 * @param {boolean} isFirst — true if this is the very first half-move in the movetext
 * @returns {string}
 */
function formatHalfMove(moveNum,color,san,isFirst){
  if(color==='white'){
    return moveNum+'. '+san;
  }else{
    // Black to move: prefix with "N... " only if it's the very first half-move of the game
    if(isFirst)return moveNum+'... '+san;
    return san;
  }
}

/**
 * Escape a PGN comment body per spec §8.2.2:
 *   - No nested braces allowed (strip them)
 *   - Backslash is not special in comments (NOT escaped)
 *   - Bare newlines → spaces (comments are single-line in this implementation;
 *     the spec allows multi-line but most parsers tolerate single-line)
 */
function normalizeCommentBody(c){
  if(!c)return '';
  let s=String(c);
  // Strip any inner braces (forbidden by spec)
  s=s.replace(/[{}]/g,'');
  // Collapse whitespace
  s=s.replace(/\s+/g,' ').trim();
  return s;
}

/**
 * Build a [%eval ...] comment annotation from cached engine evaluation.
 * Format follows Lichess convention:
 *   - Centipawn:    [%eval 0.35]
 *   - Mate for White: [%eval #5]
 *   - Mate for Black: [%eval #-3]
 *
 * @param {Object} cached — {eval:number (centipawns, White POV), mate:number|null}
 * @returns {string} e.g. "[%eval 0.35]" or "" if no eval available
 */
function formatEvalTag(cached){
  if(!cached)return '';
  const mateDist=Number(cached.mate)||0;
  const ev=Number(cached.eval)||0;
  if(mateDist!==0||Math.abs(ev)>=90000){
    const md=mateDist!==0?mateDist:(ev>0?1:-1);
    return '[%eval #'+md+']';
  }
  // Convert to pawns with up to 2 decimals, preserving sign
  const pawns=(ev/100).toFixed(2);
  const sign=ev>0?'+':'';
  return '[%eval '+sign+pawns+']';
}

/**
 * v1.1.0 Phase 58: Build a human-readable, White-perspective eval annotation
 * for the every-5-moves PGN {} comment. Format mirrors the eval bar:
 *   "<desc> (<score>) D<depth> SD<seldepth> (<W%>W/<D%>D/<L%>L)"
 * e.g. "均势 (-0.10) D22 SD34 (1%W/96%D/3%L)"  (Chinese mode)
 *      "Equal (-0.10) D22 SD34 (1%W/96%D/3%L)" (English mode)
 *
 * Language is auto-selected via T() which reads the global _lang variable.
 * All eval/WDL/depth values are White-perspective (the engine → White
 * conversion is done in onEngineEval before caching).
 *
 * Missing components are gracefully omitted:
 *   - No depth → omit "D## SD##"
 *   - No WDL (all -1 or sum<=0) → omit "(%W/%D/%L)"
 *   - Mate → use "#+N" / "#-N" score + "White mates" / "Black mates" label
 *
 * @param {Object} cached — {eval, mate, depth, seldepth, wdlW, wdlD, wdlL}
 * @returns {string} annotation text (empty string if cached is falsy)
 */
function formatEvalAnnotation(cached){
  if(!cached)return '';
  const mateDist=Number(cached.mate)||0;
  const ev=Number(cached.eval)||0;
  const depth=Number(cached.depth)||0;
  const seldepth=Number(cached.seldepth)||0;
  const wW=Number(cached.wdlW);  // may be NaN if undefined
  const wD=Number(cached.wdlD);
  const wL=Number(cached.wdlL);
  // White-perspective description label (matches posDesc thresholds, but
  // from White's POV rather than the player's POV).
  let label, scoreStr;
  if(mateDist!==0||Math.abs(ev)>=90000){
    // Mate — determine which side mates.
    // ev>=90000 → White wins; ev<=-90000 → Black wins.
    // mateDist>0 (White POV) → White mates in N; mateDist<0 → Black mates in N.
    const whiteMates=(mateDist!==0)?mateDist>0:ev>0;
    label=T(whiteMates?'pgn_mate_white':'pgn_mate_black');
    // v1.2.1: 修复 malformed `[%eval #+]`/`[%eval #-]` —— 此前 absMd=0 时
    //   `0||''` 求值为 ''，产生无数字的 `#+` / `#-` 标签。与 formatEvalTag
    //   (line 156) 保持一致：mateDist=0 但 |ev|≥90000 时默认 ±1。
    const absMd=mateDist!==0?Math.abs(mateDist):1;
    scoreStr=whiteMates?('#+'+absMd):('#-'+absMd);
  }else{
    // Centipawn eval — White-POV (ev is already White-POV from onEngineEval).
    label=_pgnWhitePerspectiveLabel(ev);
    const pawns=(ev/100).toFixed(2);
    scoreStr=ev>0?('+'+pawns):pawns;  // negative already has sign; 0.00 stays
  }
  let s=label+' ('+scoreStr+')';
  // Depth / seldepth — mirror eval bar "D15 SD22" format.
  if(depth>0){
    s+=' D'+depth;
    if(seldepth>0&&seldepth>depth)s+=' SD'+seldepth;
  }
  // WDL — only when all three are non-negative AND sum > 0.
  if(!Number.isNaN(wW)&&!Number.isNaN(wD)&&!Number.isNaN(wL)&&wW>=0&&wD>=0&&wL>=0){
    const total=wW+wD+wL;
    if(total>0){
      const wP=Math.round(wW/total*100);
      const dP=Math.round(wD/total*100);
      const lP=Math.round(wL/total*100);
      s+=' ('+wP+'%W/'+dP+'%D/'+lP+'%L)';
    }
  }
  return s;
}

/**
 * v1.1.0 Phase 58: Map a White-POV centipawn eval to a White-perspective
 * description label, using the same thresholds as posDesc() in ui.js but
 * returning White-POV strings (e.g. "白方占优" / "White advantage") instead
 * of player-POV strings ("你占优" / "Advantage").
 *
 * @param {number} ev — White-POV centipawn eval
 * @returns {string} localized label
 */
function _pgnWhitePerspectiveLabel(ev){
  if(ev>600)return T('pgn_white_winning');
  if(ev>350)return T('pgn_white_huge_adv');
  if(ev>150)return T('pgn_white_advantage');
  if(ev>50)return T('pgn_white_slight_adv');
  if(ev>-50)return T('pgn_equal');
  if(ev>-150)return T('pgn_black_slight_adv');
  if(ev>-350)return T('pgn_black_advantage');
  if(ev>-600)return T('pgn_black_huge_adv');
  return T('pgn_black_winning');
}

/**
 * Build a [%clk H:MM:SS] comment annotation from remaining clock seconds.
 *
 * @param {number} remainingSec — remaining clock time in seconds (null if unknown)
 * @returns {string} e.g. "[%clk 0:05:23]" or ""
 */
function formatClkTag(remainingSec){
  if(remainingSec==null||remainingSec<0||!Number.isFinite(remainingSec))return '';
  const h=Math.floor(remainingSec/3600);
  const m=Math.floor((remainingSec%3600)/60);
  const s=Math.floor(remainingSec%60);
  const pad=n=>(n<10?'0':'')+n;
  return '[%clk '+h+':'+pad(m)+':'+pad(s)+']';
}

// v1.0.4 EXPANSION (this round): additional PGN comment tags per
// "Modern engine & de-facto standards" reference.

/**
 * Build a [%emt H:MM:SS] comment annotation for elapsed move time.
 * Per PGN spec §10.2.7 (Elapsed Move Time): "Elapsed time for the current
 * move, not the remaining time on the clock." This is what we already
 * record in moveRecords[i].time (in seconds with one decimal). For
 * non-time-control games (untimed / casual), [%emt] is the appropriate
 * tag — it does NOT require a [TimeControl] header and does NOT track
 * running clock totals.
 *
 * @param {number} elapsedSec — seconds spent on this move (float ok)
 * @returns {string} e.g. "[%emt 0:00:03]" or "" if elapsedSec is null/0
 */
function formatEmtTag(elapsedSec){
  if(elapsedSec==null||elapsedSec<0||!Number.isFinite(elapsedSec))return '';
  // Round to nearest second for the HH:MM:SS format
  const total=Math.round(elapsedSec);
  if(total===0)return ''; // skip zero-time moves (e.g., pre-played opening moves)
  const h=Math.floor(total/3600);
  const m=Math.floor((total%3600)/60);
  const s=total%60;
  const pad=n=>(n<10?'0':'')+n;
  return '[%emt '+h+':'+pad(m)+':'+pad(s)+']';
}

// ===== II-B. NAG (Numeric Annotation Glyphs) =====
// Per PGN spec §10.3, NAGs are $0-$139. We support the most common ones
// (move-quality $1-$9, position-evaluation $10-$19, plus a few thematic
// NAGs). NAGs are emitted as bare $N tokens AFTER the SAN, BEFORE the
// comment {} — per spec §8.2.4.

const NAG_MAP={
  // Move quality (spec §10.3.1)
  '!':'$1','?':'$2','!!':'$3','??':'$4','!?':'$5','?!':'$6',
  // Position evaluation (spec §10.3.2)
  '=':'$10','∞':'$11','⩲':'$13','+/=':'$13','⩱':'$14','=/+':'$14',
  '±':'$15','+/-':'$15','∓':'$16','-/+':'$16','+-':'$17','-+':'$18'
};

/**
 * Convert a NAG code ($N) to its symbolic form, or return the original
 * code if no mapping exists.
 * @param {string} nagStr — e.g. "$1", "$14"
 * @returns {string} e.g. "!", "+/=", or "$99" (unmapped)
 */
function nagToSymbol(nagStr){
  if(!nagStr||!nagStr.startsWith('$'))return nagStr||'';
  for(const [sym,nag] of Object.entries(NAG_MAP)){
    if(nag===nagStr)return sym;
  }
  return nagStr; // unmapped — return the raw $N
}

/**
 * Convert a symbol to its NAG code.
 * @param {string} sym — e.g. "!", "+/-"
 * @returns {string|null} e.g. "$1", "$15", or null if no mapping
 */
function symbolToNag(sym){
  if(!sym)return null;
  return NAG_MAP[sym]||null;
}

/**
 * Format a NAG token for inclusion in PGN movetext.
 * Per spec §8.2.4, NAGs come AFTER the move's SAN and AFTER any suffix
 * annotations (!, ?, !!, ??, !?, ?!) but BEFORE the comment {}.
 *
 * @param {string|number} nag — NAG code as "$N" string or N as number
 * @returns {string} e.g. "$1" or "" if invalid
 */
function formatNagToken(nag){
  if(!nag)return '';
  if(typeof nag==='number'){
    if(nag<0||nag>139)return '';
    return '$'+nag;
  }
  if(typeof nag==='string'){
    // Already a $N string?
    if(/^\$\d+$/.test(nag))return nag;
    // Symbolic form → look up
    const converted=symbolToNag(nag);
    return converted||'';
  }
  return '';
}

// ===== II-C. Visual Annotations: [%csl] and [%cal] =====
// Per Lichess/Chessbase de-facto standard (also documented in the PGN spec
// extension docs):
//   [%csl Gb4]      → highlight square b4 with Green
//   [%csl Gb4,Rc5]  → highlight b4 Green, c5 Red
//   [%cal Ge2e4]    → draw Green arrow from e2 to e4
//   [%cal Ge2e4,Rg1f3] → multiple arrows
//
// Color codes (case-sensitive first letter) — v1.0.4 Round-5 Rev48 full semantics:
//   SQUARE HIGHLIGHTS ([%csl]):
//     B = Blue   — player's net-control strong squares (player controls, AI doesn't)
//     R = Red    — AI opponent's net-control strong squares (AI controls, player doesn't)
//     Y = Yellow — high total-control squares (both sides combined have many attackers)
//     G = Green  — center-area squares with NO control from either side (neutral center)
//   ARROWS ([%cal]):
//     B = Blue   — mover's piece threatens 2+ enemy pieces (multi-threat):
//                  arrows from threatening piece to each threatened piece
//     R = Red    — checker → checked king path (current move gives check)
//     Y = Yellow — mover's piece threatens enemy queen (arrow from attacker to queen)
//     G = Green  — checked king position → escape square (avoidance paths)

const _CSL_COLOR_CODES={G:'G',R:'R',B:'B',Y:'Y'};

/**
 * Build a [%csl ...] comment annotation for square highlights.
 * @param {Array} highlights — array of {color:'G'|'R'|'B'|'Y', square:'b4'}
 * @returns {string} e.g. "[%csl Gb4,Rc5]" or "" if empty
 */
function formatCslTag(highlights){
  if(!highlights||!highlights.length)return '';
  const parts=[];
  for(const h of highlights){
    if(!h||!h.color||!h.square)continue;
    const code=_CSL_COLOR_CODES[h.color];
    if(!code)continue;
    // Validate square format (a-h followed by 1-8)
    if(!/^[a-h][1-8]$/.test(h.square))continue;
    parts.push(code+h.square);
  }
  if(!parts.length)return '';
  return '[%csl '+parts.join(',')+']';
}

/**
 * Build a [%cal ...] comment annotation for arrows.
 * @param {Array} arrows — array of {color:'G'|'R'|'B'|'Y', from:'e2', to:'e4'}
 * @returns {string} e.g. "[%cal Ge2e4,Rg1f3]" or "" if empty
 */
function formatCalTag(arrows){
  if(!arrows||!arrows.length)return '';
  const parts=[];
  for(const a of arrows){
    if(!a||!a.color||!a.from||!a.to)continue;
    const code=_CSL_COLOR_CODES[a.color];
    if(!code)continue;
    if(!/^[a-h][1-8]$/.test(a.from)||!/^[a-h][1-8]$/.test(a.to))continue;
    if(a.from===a.to)continue; // zero-length arrow
    parts.push(code+a.from+a.to);
  }
  if(!parts.length)return '';
  return '[%cal '+parts.join(',')+']';
}

/**
 * Parse a [%csl ...] tag back into a highlights array.
 * @param {string} tagStr — e.g. "[%csl Gb4,Rc5]"
 * @returns {Array} [{color:'G',square:'b4'},...]
 */
function parseCslTag(tagStr){
  if(!tagStr)return [];
  const m=tagStr.match(/\[%csl\s+([^\]]+)\]/);
  if(!m)return [];
  const out=[];
  for(const part of m[1].split(',')){
    const pm=part.trim().match(/^([GRBY])([a-h][1-8])$/);
    if(pm)out.push({color:pm[1],square:pm[2]});
  }
  return out;
}

/**
 * Parse a [%cal ...] tag back into an arrows array.
 * @param {string} tagStr — e.g. "[%cal Ge2e4,Rg1f3]"
 * @returns {Array} [{color:'G',from:'e2',to:'e4'},...]
 */
function parseCalTag(tagStr){
  if(!tagStr)return [];
  const m=tagStr.match(/\[%cal\s+([^\]]+)\]/);
  if(!m)return [];
  const out=[];
  for(const part of m[1].split(',')){
    const pm=part.trim().match(/^([GRBY])([a-h][1-8])([a-h][1-8])$/);
    if(pm)out.push({color:pm[1],from:pm[2],to:pm[3]});
  }
  return out;
}

// ===== II-D. TimeControl tag parsing =====
// Per PGN spec §10.6, [TimeControl] supports:
//   "300"       — sudden death, 5 minutes
//   "300+3"     — Fischer increment, 5 minutes + 3 sec/move
//   "300d3"     — Bronstein delay, 5 minutes + 3 sec/move (non-cumulative)
//   "300i3"     — US delay, 5 minutes + 3 sec delay before clock starts
//   "40/7200"   — 40 moves in 2 hours (then sudden death or next stage)
//   "40/7200:3600" — staged: 40/7200 then sudden-death 3600
//   "*300"      — hourglass/sandclock (rare)
//   "?"         — unknown

/**
 * Parse a [TimeControl] tag value into a structured object.
 * @param {string} tcStr — e.g. "300+3", "40/7200:3600", "?"
 * @returns {Object} {type, baseSec, incrementSec, delaySec, movesPerSession, stages}
 *   type: 'sudden'|'fischer'|'bronstein'|'usdelay'|'staged'|'hourglass'|'unknown'
 */
function parseTimeControl(tcStr){
  if(!tcStr||tcStr==='?')return {type:'unknown'};
  // Hourglass
  if(tcStr.startsWith('*'))return {type:'hourglass',baseSec:Number.parseInt(tcStr.substring(1),10)||0};
  // Staged: "40/7200:3600" or "40/7200:20/3600:3600"
  if(tcStr.includes('/')||tcStr.includes(':')){
    const stages=[];
    const parts=tcStr.split(':');
    for(const p of parts){
      const sm=p.match(/^(\d+)\/(\d+)$/);
      if(sm){stages.push({moves:Number.parseInt(sm[1],10),baseSec:Number.parseInt(sm[2],10)});}
      else{const n=Number.parseInt(p,10);if(!Number.isNaN(n))stages.push({baseSec:n});}
    }
    return {type:'staged',stages:stages};
  }
  // Fischer increment
  const fm=tcStr.match(/^(\d+)\+(\d+)$/);
  if(fm)return {type:'fischer',baseSec:Number.parseInt(fm[1],10),incrementSec:Number.parseInt(fm[2],10)};
  // Bronstein delay
  const bm=tcStr.match(/^(\d+)d(\d+)$/i);
  if(bm)return {type:'bronstein',baseSec:Number.parseInt(bm[1],10),delaySec:Number.parseInt(bm[2],10)};
  // US delay
  const um=tcStr.match(/^(\d+)i(\d+)$/i);
  if(um)return {type:'usdelay',baseSec:Number.parseInt(um[1],10),delaySec:Number.parseInt(um[2],10)};
  // Sudden death
  const sm=tcStr.match(/^(\d+)$/);
  if(sm)return {type:'sudden',baseSec:Number.parseInt(sm[1],10)};
  return {type:'unknown'};
}

/**
 * Format a [TimeControl] tag value from a structured object.
 * @param {Object} tc — output of parseTimeControl()
 * @returns {string} PGN-compliant TimeControl tag value
 */
function formatTimeControl(tc){
  if(!tc||tc.type==='unknown')return '?';
  if(tc.type==='sudden')return String(tc.baseSec||0);
  if(tc.type==='fischer')return (tc.baseSec||0)+'+'+(tc.incrementSec||0);
  if(tc.type==='bronstein')return (tc.baseSec||0)+'d'+(tc.delaySec||0);
  if(tc.type==='usdelay')return (tc.baseSec||0)+'i'+(tc.delaySec||0);
  if(tc.type==='hourglass')return '*'+(tc.baseSec||0);
  if(tc.type==='staged'&&Array.isArray(tc.stages)){
    return tc.stages.map(s=>s.moves?(s.moves+'/'+s.baseSec):String(s.baseSec||0)).join(':');
  }
  return '?';
}

// ===== III. PGN composition =====

/**
 * Compose a complete PGN game record from parts.
 *
 * Layout (per PGN spec §3):
 *   <tag pairs, one per line>
 *   <empty line>
 *   <movetext>
 *   <result>
 *
 * Movetext is wrapped at ~80 columns (spec recommendation, not requirement).
 *
 * @param {Object} params
 *   {string[]} tagPairs   — pre-formatted "[Key \"Value\"]" lines (NO trailing newlines)
 *   {Object[]} halfMoves  — [{moveNum, color:'white'|'black', san, comment?:string, variations?:Object[]}]
 *   {string}   result     — one of "1-0","0-1","1/2-1/2","*"
 *   {Object[]} variations — top-level variations (rare; usually attached to moves)
 * @returns {string} complete PGN text
 */
function composePGN(params){
  // v1.1.2 PHASE 71 (robustness): guard against null/undefined params (a
  // caller passing `null` would previously throw a TypeError at
  // `params.tagPairs`). Defensive — the AI-bridge caller always passes an
  // object, but this protects against future regressions.
  params=params||{};
  const tagPart=((params.tagPairs)||[]).join('\n');
  // Build movetext
  const tokens=[];
  // v1.1.1 Phase 61: Insert a pre-move comment (if provided) BEFORE the first
  //   move. This is used for the initial-position eval annotation, which
  //   semantically applies to the position before any moves are played.
  //   PGN spec allows comments anywhere in movetext, including before the
  //   first move. The comment is normalized (braces escaped) and wrapped in {}.
  if(params.preMoveComment){
    const preBody=normalizeCommentBody(params.preMoveComment);
    if(preBody)tokens.push('{'+preBody+'}');
  }
  const moves=params.halfMoves||[];
  for(let i=0;i<moves.length;i++){
    const m=moves[i];
    const isFirst=(i===0);
    const prefix=formatHalfMove(m.moveNum,m.color,m.san,isFirst);
    tokens.push(prefix);
    // v1.0.4 ROUND-5 REV16: NAG token ($N) after SAN per PGN spec
    if(m.nag){
      const nagTok=formatNagToken(m.nag);
      if(nagTok)tokens.push(nagTok);
    }
    // Inline variation (RAV) attached to this move
    if(m.variations&&m.variations.length>0){
      for(const v of m.variations){
        if(!v.san)continue;
        tokens.push('('+_formatRAV(v)+')');
      }
    }
    // Comment — may include [%eval] / [%clk] tags
    if(m.comment){
      const body=normalizeCommentBody(m.comment);
      if(body)tokens.push('{'+body+'}');
    }
  }
  tokens.push(params.result||'*');
  // Wrap movetext at ~78 columns (PGN spec recommends ≤80)
  const lines=[];
  let curLine='';
  for(const tok of tokens){
    if((curLine.length+tok.length+1)>78&&curLine.length>0){
      lines.push(curLine);
      curLine=tok;
    }else{
      curLine=curLine?(curLine+' '+tok):tok;
    }
  }
  if(curLine)lines.push(curLine);
  const movetextPart=lines.join('\n');
  // v1.0.4 Rev31 CLEANUP: avoid leading blank lines when tagPairs is empty.
  // Previously returned '\n\n<movetext>\n' (leading blank line) for tagless PGNs.
  if(tagPart){
    return tagPart+'\n\n'+movetextPart+'\n';
  }
  return movetextPart+'\n';
}

// Format a variation (RAV) as a flat SAN sequence.
// Per spec §8.2.5, an RAV is a sequence of movetext starting from the position
// BEFORE the move it replaces. We accept pre-formatted SAN strings (already
// including move-number prefixes) and just join them with spaces.
function _formatRAV(v){
  if(typeof v.san==='string')return v.san;
  if(Array.isArray(v.sanTokens))return v.sanTokens.join(' ');
  return '';
}

// ===== IV. Tolerant PGN parser (auto-correction) =====
//
// This parser is designed to handle "wild" PGN text from arbitrary sources
// (chess.com, lichess, chessbase, hand-typed, OCR'd, etc.). It applies the
// following auto-corrections:
//
//   1. Strip BOM, normalize \r\n → \n
//   2. Strip PGN escape lines (% at column 0) per spec §4
//   3. Strip non-breaking spaces (\u00a0) per DroidFish PgnScanner
//   4. Flatten nested brace comments (spec violation): {a {b} c} → {a b c}
//   5. Tolerate missing close-brace at EOF (auto-close)
//   6. Tolerate missing Result token (default to "*")
//   7. Skip malformed SAN tokens rather than aborting (graceful degradation)
//   8. Accept "0-0"/"0-0-0" (numeric zeros) as castling, normalize to "O-O"/"O-O-O"
//   9. Strip ";..." line-comments per spec §8.2.3
//  10. Strip "$N" NAG tokens (we don't preserve NAGs in the simplified parser)
//  11. Accept tag pairs with missing quotes: [FEN rnbq...] → [FEN "rnbq..."]
//
// Returns: { tags:{}, movetext:string, halfMoves:[{moveNum,color,san,comment,variations?}],
//            startFEN:string|null, variant:string|null, errors:string[] }

/**
 * Tolerant PGN parser. Auto-corrects common spec violations.
 *
 * @param {string} pgnText — raw PGN text (single or multi-game)
 * @returns {Object|null} parsed game record, or null if completely unparseable
 */
function parseStandardPGN(pgnText){
  // v1.2.3 round-18 audit notes (function currently has no call sites —
  //   production PGN import uses tablebase.js _parsePGN):
  //   FIXED: stray '}' in movetext caused an infinite tokenizer loop.
  //   KNOWN LIMITATIONS (documented, not worth churn while unused):
  //   - RAV variations attach to the FOLLOWING move instead of the preceding
  //     move required by the PGN spec.
  //   - Tag pairs with missing quotes (e.g. [FEN rnbq...]) are extracted into
  //     `tags` but not stripped from movetext, leaving pseudo-SAN tokens.
  if(!pgnText||typeof pgnText!=='string')return null;
  const errors=[];
  // 1. Strip BOM
  try{if(pgnText.charCodeAt(0)===0xFEFF)pgnText=pgnText.substring(1);}catch(e){return null;}
  // 2. Normalize line endings
  pgnText=pgnText.replace(/\r\n/g,'\n').replace(/\r/g,'\n');
  // 3. Strip PGN escape lines
  pgnText=pgnText.replace(/^%.*$/gm,'');
  // 4. Non-breaking spaces
  pgnText=pgnText.replace(/\u00a0/g,' ');
  // 5. Multi-game: keep only the first game
  const gameBlocks=pgnText.split(/\n\s*\n(?=\[)/);
  if(gameBlocks.length>1)pgnText=gameBlocks[0];

  // === Parse tag pairs ===
  const tags={};
  // Match [Key "Value"] with optional missing quotes
  const tagRe=/\[(\w+)\s+"?((?:[^"\\]|\\.)*)"?\s*\]/g;
  let m;
  while((m=tagRe.exec(pgnText))!==null){
    const key=m[1];
    let val=m[2]||'';
    // Unescape \" → " and \\ → \
    val=val.replace(/\\"/g,'"').replace(/\\\\/g,'\\');
    tags[key]=val;
  }
  // Remove all tag-pair lines from the working text
  // v1.0.8 PHASE 49: tag-value regex was `[^\]]*` which stops at the first
  //   `]` inside a value, leaving residual text. Use a non-greedy `[\s\S]*?`
  //   so values containing `]` (rare but legal per PGN spec when escaped)
  //   are handled, and anchor to the line start so movetext `[Nf3]`-style
  //   annotations (which never start a line) are not stripped.
  // v1.1.0 PHASE 57+: The previous `/^\[[\s\S]*?\]/gm` pattern relied on
  //   `^` with the `gm` flags to anchor tags to line starts. In single-line
  //   PGN (all tags + movetext on ONE line, e.g. PGN 2Kbug.pgn) `^` only
  //   matches the very start of the string, so the first `]` (closing the
  //   first tag) is the only match — the remaining tags survive as garbage
  //   tokens in moveText. Replaced with an unanchored, format-strict regex
  //   `/\[[A-Za-z]\w*\s+"(?:[^"\\]|\\.)*"\]/g` that requires the canonical
  //   PGN tag shape (key + whitespace + quoted value), so movetext comments
  //   like `[Nf3]` (no quotes) are never stripped.
  //   v1.2.1 round-9: Updated the value pattern from `[^"]*` to
  //   `(?:[^"\\]|\\.)*` to correctly handle escaped quotes inside tag values
  //   (e.g. `[Event "Some \"Fun\" Event"]`). The tag-EXTRACTION regex at
  //   line ~658 already handles escaped quotes; this brings the removal
  //   regex into parity so a tag with escaped quotes is fully stripped from
  //   movetext (otherwise residual garbage tokens survive).
  let moveText=pgnText.replace(/\[[A-Za-z]\w*\s+"(?:[^"\\]|\\.)*"\]/g,'').trim();
  // Remove line continuation markers
  moveText=moveText.replace(/\\\s*\n/g,' ');
  // v1.0.8 PHASE 49: Flatten brace comments BEFORE removing line comments.
  //   The old order (line-comments first) truncated `{...; ...}` brace
  //   comments at the `;`, losing the rest of the comment and any moves
  //   on the same line. Brace comments must be removed first so that any
  //   `;` inside them is gone before the line-comment pass runs.
  // v1.0.7 PHASE 18 Task 3 (bug fix): Flatten nested brace comments by REMOVING
  // them entirely (braces + body), matching the proven-correct pattern in
  // tablebase.js's _parsePGN. The old code stripped only the
  // braces and left the comment body as bare text in moveText — the tokenizer
  // then classified each whitespace-delimited comment word as a spurious SAN
  // token, polluting the move list. (Latent: parseStandardPGN is currently
  // unused, but this prevents a landmine if it's ever wired in.)
  {
    let _iter=0;
    while(moveText.includes('{')&&_iter++<20){
      const prev=moveText;
      moveText=moveText.replace(/\{[^{}]*\}/g,'');
      if(prev===moveText)break; // no more progress
    }
    // Truncate at any unclosed brace (tolerant per PGN spec)
    if(moveText.includes('{'))moveText=moveText.substring(0,moveText.indexOf('{'));
  }
  // Remove line-comments (;...) — must run AFTER brace-comment flattening
  //   so `;` inside `{...}` is already gone.
  moveText=moveText.replace(/;[^\n]*/g,'');
  // Extract comments inline as we tokenize (so we don't lose them)
  // Strategy: tokenize the movetext into a stream of {type, value} tokens
  const tokens=[];
  let i=0;
  while(i<moveText.length){
    const ch=moveText[i];
    // v1.0.4 Rev31 CLEANUP: removed dead `ch==='\s'` comparison (a single char
    // can never equal the 2-char string "\s" — it was a typo for the regex \s
    // class, but the explicit ' ' / '\t' / '\n' checks already cover all cases).
    if(ch===' '||ch==='\t'||ch==='\n'){
      i++;continue;
    }
    if(ch==='{'){
      // Read until matching '}'
      let j=i+1,depth=1,body='';
      while(j<moveText.length&&depth>0){
        if(moveText[j]==='{')depth++;
        else if(moveText[j]==='}')depth--;
        if(depth>0)body+=moveText[j];
        j++;
      }
      if(depth>0){
        // Missing close brace — auto-close
        errors.push('Auto-closed unclosed comment at EOF');
        body=moveText.slice(i+1);
        i=moveText.length;
      }else{
        i=j+1;
      }
      tokens.push({type:'comment',value:body});
      continue;
    }
    if(ch==='('){
      tokens.push({type:'openVar'});i++;continue;
    }
    if(ch===')'){
      tokens.push({type:'closeVar'});i++;continue;
    }
    // v1.2.3 round-18 (bug fix): skip a stray close-brace. Previously a `}`
    //   without a matching `{` (malformed movetext) reached the token reader
    //   below, which breaks immediately on '}' with an EMPTY token — the
    //   `if(!tok)continue;` then looped forever without advancing i.
    if(ch==='}'){
      errors.push('Skipped stray close brace in movetext');
      i++;continue;
    }
    // Read a whitespace/paren/brace-delimited token
    let j=i;
    let tok='';
    while(j<moveText.length){
      const c2=moveText[j];
      if(c2===' '||c2==='\t'||c2==='\n'||c2==='{'||c2==='}'||c2==='('||c2===')')break;
      tok+=c2;j++;
    }
    i=j;
    if(!tok)continue;
    // Classify the token
    if(/^\$\d+$/.test(tok)){tokens.push({type:'nag',value:tok});continue;}
    if(tok==='1-0'||tok==='0-1'||tok==='1/2-1/2'||tok==='*'){
      tokens.push({type:'result',value:tok});continue;
    }
    if(/^\d+\.+$/.test(tok)){tokens.push({type:'moveNum',value:tok});continue;}
    if(/^\.\.\.+$/.test(tok)){tokens.push({type:'ellipsis'});continue;}
    tokens.push({type:'san',value:tok});
  }

  // === Build halfMoves array ===
  // Walk the token stream, tracking:
  //   - current move number (defaults to 1, but may be set by [FEN] start)
  //   - current side to move (defaults to white; flipped if FEN says black)
  //   - variation stack (for nested RAVs)
  let startMoveNum=1;
  let startColor='white';
  if(tags.FEN){
    // FEN field 6 is the full-move number, field 1 is side to move
    const fenParts=tags.FEN.split(/\s+/);
    if(fenParts[1]==='b')startColor='black';
    const fenMove=Number.parseInt(fenParts[5],10);
    if(fenMove>0)startMoveNum=fenMove;
  }
  const halfMoves=[];
  let curMoveNum=startMoveNum;
  let curColor=startColor;
  let pendingComment='';
  let pendingVariations=[];

  function _emitSan(sanTok){
    // Auto-correct common SAN errors:
    //   - "0-0" → "O-O", "0-0-0" → "O-O-O"
    let s=sanTok;
    if(/^0-0-0$/i.test(s))s='O-O-O';
    else if(/^0-0$/i.test(s))s='O-O';
    // Strip check/mate/annotation suffixes for storage (we re-add them at render)
    const bareSAN=s.replace(/[+#!?]+$/,'');
    halfMoves.push({
      moveNum:curMoveNum,
      color:curColor,
      san:bareSAN,
      comment:pendingComment||undefined,
      variations:pendingVariations.length>0?pendingVariations:undefined
    });
    pendingComment='';
    pendingVariations=[];
    // Advance side
    if(curColor==='black'){curMoveNum++;curColor='white';}
    else{curColor='black';}
  }

  // Simple variation buffer (we only support flat variations for now — nested
  // variations are flattened into the parent's variation list)
  let varBuf=null;
  let varDepth=0;
  for(const tok of tokens){
    if(varDepth>0){
      if(tok.type==='openVar'){varDepth++;if(varBuf)varBuf.push('(');continue;}
      if(tok.type==='closeVar'){varDepth--;if(varDepth===0){
        // Close out the variation
        if(varBuf?.length>0){
          pendingVariations.push({san:varBuf.join(' ')});
        }
        varBuf=null;
      }else{if(varBuf)varBuf.push(')');}
      continue;}
      if(varBuf){
        if(tok.type==='san')varBuf.push(tok.value);
        else if(tok.type==='moveNum')varBuf.push(tok.value);
        else if(tok.type==='comment'){/* drop comments inside variations for simplicity */}
        else if(tok.type==='result'){/* ignore results inside variations */}
      }
      continue;
    }
    if(tok.type==='openVar'){varDepth=1;varBuf=[];continue;}
    if(tok.type==='closeVar'){errors.push('Unmatched )');continue;}
    if(tok.type==='comment'){pendingComment=(pendingComment?pendingComment+' ':'')+tok.value;continue;}
    if(tok.type==='nag'){/* drop NAGs in simplified parser */continue;}
    if(tok.type==='moveNum'){
      // Extract the move number and side indicator from "N." or "N..."
      const mm=tok.value.match(/^(\d+)(\.+)$/);
      if(mm){
        const num=Number.parseInt(mm[1],10);
        const dots=mm[2];
        if(dots.length>=3){
          // "N..." — black to move, advance move number
          curMoveNum=num;curColor='black';
        }else{
          // "N." — white to move
          curMoveNum=num;curColor='white';
        }
      }
      continue;
    }
    if(tok.type==='ellipsis'){curColor='black';continue;}
    if(tok.type==='result'){continue;} // result is appended at the end
    if(tok.type==='san'){
      try{_emitSan(tok.value);}catch(e){errors.push('Skipping invalid SAN: '+tok.value);}
      continue;
    }
  }

  if(halfMoves.length===0){
    errors.push('No half-moves parsed');
    // Still return the tags so the caller can salvage metadata
  }

  // Determine the result
  const result=tags.Result||(function(){
    // Look at the last token
    for(let k=tokens.length-1;k>=0;k--){
      if(tokens[k].type==='result')return tokens[k].value;
    }
    return '*';
  })();

  return {
    tags:tags,
    movetext:moveText,
    halfMoves:halfMoves,
    startFEN:tags.FEN||null,
    variant:tags.Variant||null,
    setUp:tags.SetUp||null,
    result:result,
    errors:errors
  };
}

// ===== V. Convenience: convert internal game state to a PGN tags object =====
/**
 * Build a tags object suitable for supplementaryTags() from the current game state.
 *
 * @param {Object} ctx — {
 *   variant: 'chess960'|null,
 *   startFEN: string|null,   // non-standard start position
 *   whiteElo: number, blackElo: number,
 *   timeControl: string,     // e.g. "300+3"
 *   eco: string, opening: string,
 *   annotator: string,
 *   termination: string,     // "normal"|"time forfeit"|...
 *   plyCount: number
 * }
 */
function buildSupplementaryTagsObject(ctx){
  if(!ctx)return {};
  const t={};
  if(ctx.whiteElo)t.WhiteElo=String(ctx.whiteElo);
  if(ctx.blackElo)t.BlackElo=String(ctx.blackElo);
  if(ctx.timeControl)t.TimeControl=ctx.timeControl;
  if(ctx.eco)t.ECO=ctx.eco;
  if(ctx.opening)t.Opening=ctx.opening;
  if(ctx.annotator)t.Annotator=ctx.annotator;
  if(ctx.termination)t.Termination=ctx.termination;
  if(ctx.plyCount!=null)t.PlyCount=String(ctx.plyCount);
  // Chess960: emit [Variant "Chess960"], [SetUp "1"], [FEN "..."]
  if(ctx.variant==='chess960'){
    t.Variant='Chess960';
    if(ctx.startFEN){
      t.SetUp='1';
      t.FEN=ctx.startFEN;
    }
  }else if(ctx.startFEN){
    // Non-standard position but standard variant
    t.SetUp='1';
    t.FEN=ctx.startFEN;
  }
  return t;
}

// Public API
export {
  normalizeTagValue,
  sevenTagRoster,
  supplementaryTags,
  formatHalfMove,
  normalizeCommentBody,
  formatEvalTag,
  formatClkTag,
  formatEmtTag,
  // v1.2.3 round-13 (P3): added formatEvalAnnotation + _pgnWhitePerspectiveLabel
  //   to the export list. In bundled mode (build-chess.py) the export line is
  //   stripped and all top-level functions become global, so production is
  //   unaffected. In source-module mode the missing export caused the typeof
  //   check in ai-bridge.js to return 'undefined', silently skipping the
  //   every-5-moves PGN annotation. Adding them here makes both modes consistent.
  formatEvalAnnotation,
  _pgnWhitePerspectiveLabel,
  NAG_MAP, nagToSymbol, symbolToNag, formatNagToken,
  formatCslTag, formatCalTag, parseCslTag, parseCalTag,
  parseTimeControl, formatTimeControl,
  composePGN,
  parseStandardPGN,
  buildSupplementaryTagsObject
};
