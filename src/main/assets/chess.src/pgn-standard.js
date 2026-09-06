// ===================== MODULE: pgn-standard =====================
// PGN (Portable Game Notation) standardization utilities
//
// Implements the 1994 PGN specification (Steven J. Edwards) plus modern
// de-facto extensions ([%eval], [%clk]) used by Lichess/Chessbase.
//
// Key functions:
//   - buildStandardPGN()  : compose a PGN-compliant game record
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
 * v1.2.3 round-36 (dedup): thresholds centralized in game-logic.js
 *   evalBucket(). Lookup uses _POV_LABEL_KEYS_WHITE[bucket] for the
 *   White-POV label. This eliminates the threshold-drift risk between
 *   posDesc() and _pgnWhitePerspectiveLabel().
 *
 * @param {number} ev — White-POV centipawn eval
 * @returns {string} localized label
 */
function _pgnWhitePerspectiveLabel(ev){
  const k=_POV_LABEL_KEYS_WHITE[evalBucket(ev)];
  return T(k!==undefined?k:'pgn_equal');
}

// v1.2.3 round-36 (dedup): zero-pad a number to 2 digits. Previously
//   inlined as `const pad=n=>(n<10?'0':'')+n;` at 3 sites (formatClkTag,
//   formatEmtTag in this file + formatClock in ui-gameflow.js).
//   Centralizing eliminates the risk of one site diverging (e.g., adding
//   a negative-number guard that the others lack).
function _pad2(n){return (n<10?'0':'')+n;}

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
  return '[%clk '+h+':'+_pad2(m)+':'+_pad2(s)+']';
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
  return '[%emt '+h+':'+_pad2(m)+':'+_pad2(s)+']';
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
  '=':'$10','∞':'$13','⩲':'$14','+/=':'$14','⩱':'$15','=/+':'$15',
  '±':'$16','+/-':'$16','∓':'$17','-/+':'$17','+-':'$18','-+':'$19'
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
  buildSupplementaryTagsObject
};
