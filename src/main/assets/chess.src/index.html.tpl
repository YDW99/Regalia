<!--
  Copyright (C) 2026 Regalia

  This is a combined work: the HTML/CSS template is original (AGPL v3);
  embedded JavaScript modules include DroidFish-derived code (GPL v3) and
  original code (AGPL v3). Each component retains its respective license.
  Since AGPL v3 imposes stricter requirements, its obligations effectively
  cover the entire combined work.

  AI-GEN: AI assisted
  This code was AI-assisted and has been reviewed for AGPL v3 / GPL v3 compliance.

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.
-->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src https://tablebase.lichess.ovh; img-src data: file:; frame-ancestors 'none'; base-uri 'self'">
<title>Regalia v1.0.6</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{color-scheme:dark;--bg:#1a0a0a;--card:#221015;--border:#8b6914;--border2:#d4a017;--text:#f5e6c8;--muted:#a08050;--accent:#d4a017;--accent2:#ffd700;--blue:#4a90d9;--red:#c0392b;--purple:#8e44ad;--green:#27ae60;--danger:#c0392b}
body{font-family:system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;overflow-x:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);touch-action:pan-y;-webkit-tap-highlight-color:transparent}
#app{min-height:100vh;display:flex;flex-direction:column;position:relative;z-index:1}
.hdr{background:#1a0a0a;border-bottom:2px solid var(--border2);padding:10px 16px;position:relative;overflow:hidden}
.hdr-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}
.hdr-l{display:flex;align-items:center;gap:10px}
.hdr h1{font-family:system-ui,-apple-system,sans-serif;font-size:1.3rem;font-weight:900;color:#ffd700;text-shadow:none;letter-spacing:2px}
.ver{font-size:.6rem;color:var(--accent);background:rgba(212,160,23,.15);padding:2px 8px;border-radius:4px;margin-left:6px;border:1px solid rgba(212,160,23,.3);font-family:system-ui,-apple-system,sans-serif;letter-spacing:1px}
.ev{display:flex;align-items:center;gap:6px;padding:6px 14px;border-radius:6px;background:rgba(42,21,32,.8);font-size:.85rem;border:1px solid var(--border);box-shadow:none}
.ev-e{font-size:1.2rem}
.hdr-tools{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.btn{padding:9px 18px;border-radius:6px;border:1px solid var(--border);cursor:pointer;font-family:system-ui,-apple-system,sans-serif;font-size:.85rem;font-weight:600;transition:all .2s cubic-bezier(.4,0,.2,1);background:#221015;color:var(--text);min-height:40px;display:inline-flex;align-items:center;gap:4px;box-shadow:inset 0 1px 0 rgba(255,215,0,.1);touch-action:manipulation}
/* Active state for engine config tab buttons */
.btn-a{background:#c49512;color:#1a0a0a;border-color:#ffd700;box-shadow:none}
.btn-a:hover{background:#d4a017;border-color:#ffd700}
.btn:hover{background:#2d1a22;border-color:var(--accent2);box-shadow:none;transform:translateY(-1px)}
.btn:active{transform:translateY(0);box-shadow:inset 0 2px 4px rgba(0,0,0,.3)}
/* .btn-a: active state for engine config tab buttons */
.btn-g{background:#229954;border-color:#2ecc71;color:#fff;box-shadow:0 0 2px rgba(46,204,113,.06)}
.btn-p{background:#3a78b4;border-color:#5dade2;color:#fff;box-shadow:0 0 2px rgba(93,173,226,.06)}
.btn-p:hover{background:#4d9ccf}
.btn-s{background:#221015;border-color:var(--border)}
.btn-s:hover{background:#2d1a22}
.diff-sel{display:flex;gap:2px;background:#1a0a0a;border-radius:6px;padding:3px;border:1px solid var(--border)}
.diff-b{padding:6px 10px;border-radius:4px;border:1px solid transparent;cursor:pointer;font-family:system-ui,-apple-system,sans-serif;font-size:.75rem;font-weight:700;background:transparent;color:var(--muted);transition:all .2s;min-width:30px;text-align:center}
.diff-b.act{background:#c49512;color:#1a0a0a;border-color:#ffd700;box-shadow:none}
.diff-b:hover:not(.act){background:rgba(212,160,23,.15);color:var(--text);border-color:var(--border)}
.toggle{display:flex;align-items:center;gap:6px;font-family:system-ui,-apple-system,sans-serif;font-size:.75rem;color:var(--muted);cursor:pointer;padding:6px 10px;border-radius:4px;transition:background .2s;user-select:none}
.toggle:hover{background:rgba(212,160,23,.1)}
.toggle-sw{position:relative;width:40px;height:22px;background:#1a0a0a;border-radius:11px;border:1px solid var(--border);transition:all .3s;flex-shrink:0}
.toggle-sw.on{background:#c49512;border-color:#ffd700;box-shadow:none}
.toggle-sw::after{content:"";position:absolute;top:1px;left:1px;width:16px;height:16px;border-radius:50%;background:var(--accent2);transition:all .3s;box-shadow:0 1px 4px rgba(0,0,0,.5)}
.toggle-sw.on::after{left:19px;background:#1a0a0a}
.main{display:flex;flex:1;gap:14px;padding:14px;justify-content:center;flex-wrap:wrap}
.bsec{display:flex;flex-direction:column;gap:8px}
.pbar{display:flex;align-items:center;gap:10px;padding:8px 14px;background:#221015;border-radius:6px;border:1px solid var(--border);box-shadow:inset 0 1px 0 rgba(255,215,0,.05);max-width:100%;overflow:hidden}
.pico{font-size:1.4rem}
.pname{font-family:system-ui,-apple-system,sans-serif;font-weight:700;font-size:.85rem;color:var(--accent2)}
.pbar-sub{font-size:.7rem;color:var(--muted);font-family:system-ui,-apple-system,sans-serif}
.tind{margin-left:auto;font-size:.72rem;font-weight:700;color:var(--accent2);font-family:system-ui,-apple-system,sans-serif;letter-spacing:1px}
/* Ponder info line in AI bar — always right-aligned, small font, monospace.
   Defense-in-depth: CSS rule ensures consistent styling even if inline styles are lost during DOM updates.
   Uses flexbox justify-content:flex-end for robust right-alignment.
   Changed flex-basis from 100% to auto — in a flex-direction:column
   parent, flex-basis:100% means 100% of parent HEIGHT, causing the ponder info div to
   overlap with the first line (name+level). Using auto allows natural height sizing. */
#ai-ponder-info{display:flex!important;justify-content:flex-end!important;text-align:right!important;width:100%!important;min-width:100%!important;flex:0 0 auto!important;align-self:flex-end!important;font-size:.65rem!important;color:var(--muted);font-family:monospace,system-ui,-apple-system,sans-serif!important;letter-spacing:.5px;padding-top:2px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.flbl{display:flex;gap:0;margin-left:28px}
.flbl span{text-align:center;font-size:.7rem;color:var(--muted);font-family:system-ui,-apple-system,sans-serif;letter-spacing:1px}
.rlbl{display:flex;flex-direction:column}
.rlbl span{display:flex;align-items:center;justify-content:center;width:28px;font-size:.7rem;color:var(--muted);font-family:system-ui,-apple-system,sans-serif}
.bwrap{position:relative;border:4px solid var(--border2);border-radius:4px;overflow:hidden;box-shadow:0 0 6px rgba(212,160,23,.08),0 4px 14px rgba(0,0,0,.40),inset 0 0 4px rgba(0,0,0,.08);background:#1a0a0a;transform:translateZ(0)}
/* v1.0.4 ROUND-5 REV12: Removed will-change:transform from .bgrid — it was
   promoting the ENTIRE 8x8 grid to a GPU layer, causing jank on high-end
   displays. Only individual .move-anim elements need GPU promotion. */
.bgrid{display:grid;transform:translateZ(0);touch-action:none;backface-visibility:hidden}
.sq{display:flex;align-items:center;justify-content:center;cursor:pointer;position:relative;user-select:none;font-size:2rem;line-height:1;transition:background .15s;touch-action:manipulation;contain:layout style paint;transform:translateZ(0)}
.sq:hover{background-color:rgba(255,215,0,.04)}
.sq .lbl{position:absolute;top:1px;left:2px;font-size:9px;opacity:.95;font-family:"DejaVu Sans",system-ui,sans-serif;pointer-events:none;z-index:2;letter-spacing:0}
/* === 黑曜石棋子 — 清晰轮廓、全局可辨 === */
/* 黑子: 深曜石底色 + 亮金描边 + 亮金微光 (深色格上描边醒目可辨) */
/* 白子: 银曜石底色 + 浓棕描边 + 浓棕微光 (浅色格上描边醒目可辨) */
.sq .pc{pointer-events:none;font-size:2rem;z-index:1;transition:transform .1s;position:relative;font-variant-emoji:text;-webkit-font-variant-emoji:text;font-family:&#x27;DejaVu Sans&#x27;,&#x27;Noto Sans&#x27;,&#x27;Segoe UI Symbol&#x27;,sans-serif;font-weight:400;speak:none;transform:translateZ(0);backface-visibility:hidden;will-change:transform,opacity}
.sq:hover .pc{transform:scale(1.05) translateZ(0)}
/* 黑子 — 深曜石：亮金描边 + 亮金微光 (深/浅色背景上均可辨) */
.sq .pc.bk,.prom-btn.bk-prom,.setup-btn.sb,.move-anim.bk-piece,.rv-bk{color:#1A1A2E;-webkit-text-stroke:.3px rgba(255,230,150,.85);text-shadow:0 0 .8px rgba(255,230,150,.55)}
/* 白子 — 银曜石：浓棕描边 + 浓棕微光 (深/浅色背景上均可辨) */
.sq .pc.w,.prom-btn.w-prom,.setup-btn.sw,.move-anim.w-piece,.rv-w{color:#E8E8F0;-webkit-text-stroke:.3px rgba(30,15,0,.85);text-shadow:0 0 .8px rgba(30,15,0,.55)}
/* 复盘棋子：字体与棋盘一致，避免字形跳变 */
.rv-w,.rv-bk{font-family:&#x27;DejaVu Sans&#x27;,&#x27;Noto Sans&#x27;,&#x27;Segoe UI Symbol&#x27;,sans-serif;font-variant-emoji:text;-webkit-font-variant-emoji:text;font-weight:400}
.sq .dot{width:18px;height:18px;border-radius:50%;background:radial-gradient(circle,rgba(255,140,0,.6),rgba(255,140,0,.35));pointer-events:none;z-index:1;box-shadow:0 0 3px rgba(255,140,0,.2)}
.sq .ring{position:absolute;inset:3px;border-radius:50%;border:3px solid rgba(255,140,0,.55);pointer-events:none;z-index:1;box-shadow:0 0 2px rgba(255,140,0,.10)}
/* v1.0.6: Castling rook marker — golden dashed ring. Distinct from the orange
   capture ring (.ring) so the user can tell "click to castle" apart from
   "click to capture". Uses the same gold (#ffd700) as the app's accent color
   to maintain visual consistency with the toolbar/headers. Dashed border
   (3px, dash 6px/gap 4px) signals "special move" — a convention from
   chess.com/lichess where castling indicators use dashed outlines. */
.sq .castle-ring{position:absolute;inset:3px;border-radius:50%;border:3px dashed #ffd700;pointer-events:none;z-index:2;box-shadow:0 0 4px rgba(255,215,0,.5),inset 0 0 3px rgba(255,215,0,.3);animation:castlePulse 1.5s ease-in-out infinite}
@keyframes castlePulse{0%,100%{box-shadow:0 0 4px rgba(255,215,0,.5),inset 0 0 3px rgba(255,215,0,.3)}50%{box-shadow:0 0 8px rgba(255,215,0,.8),inset 0 0 5px rgba(255,215,0,.5)}}
/* Piece-specific animations */
.sq .pc.anim-pawn{animation:pawnStep .6s cubic-bezier(.4,0,.2,1);will-change:transform,opacity}
.sq .pc.anim-knight{animation:knightJump .8s cubic-bezier(.2,-.2,.2,1.2);will-change:transform,opacity}
.sq .pc.anim-bishop{animation:bishopGlide .7s cubic-bezier(.4,0,.2,1);will-change:transform,opacity}
.sq .pc.anim-rook{animation:rookSlide .6s cubic-bezier(.4,0,.2,1);will-change:transform,opacity}
.sq .pc.anim-queen{animation:queenGlide .8s cubic-bezier(.25,.1,.25,1);will-change:transform,opacity}
.sq .pc.anim-king{animation:kingStep .7s cubic-bezier(.4,0,.2,1);will-change:transform,opacity}
@keyframes pawnStep{0%{transform:translateY(6px) scale(.95);opacity:.8}40%{transform:translateY(-2px) scale(1.03)}100%{transform:translateY(0) scale(1);opacity:1}}
@keyframes knightJump{0%{transform:scale(.8) translateY(0);opacity:.7}30%{transform:scale(1.1) translateY(-14px);opacity:.85}60%{transform:scale(1.05) translateY(-4px)}100%{transform:scale(1) translateY(0);opacity:1}}
@keyframes bishopGlide{0%{transform:translate(-6px,6px) scale(.9);opacity:.7}50%{transform:translate(1px,-1px) scale(1.04);opacity:.9}100%{transform:translate(0,0) scale(1);opacity:1}}
@keyframes rookSlide{0%{transform:scaleX(.8);opacity:.8}50%{transform:scaleX(1.05)}100%{transform:scaleX(1);opacity:1}}
@keyframes queenGlide{0%{transform:scale(.85) rotate(-3deg);opacity:.7}30%{transform:scale(1.06) rotate(1deg);opacity:.85}60%{transform:scale(1.02) rotate(-1deg)}100%{transform:scale(1) rotate(0);opacity:1}}
@keyframes kingStep{0%{transform:scale(.85);opacity:.75}30%{transform:scale(1.08);opacity:.9}60%{transform:scale(1.02)}100%{transform:scale(1);opacity:1}}
/* Check animation on king — enhanced with background pulse + stronger glow */
.sq.in-check{animation:checkPulse 1.2s ease-in-out infinite;position:relative;z-index:1;transform:translateZ(0);will-change:box-shadow}
.sq.in-check::before{content:'';position:absolute;inset:0;animation:checkBgPulse 1.2s ease-in-out infinite;border-radius:inherit;z-index:-1;}
@keyframes checkPulse{
  0%,100%{box-shadow:inset 0 0 6px rgba(192,57,43,.4),0 0 4px rgba(192,57,43,.2),inset 0 0 20px rgba(192,57,43,.06)}
  50%{box-shadow:inset 0 0 18px rgba(192,57,43,.65),0 0 12px rgba(192,57,43,.35),0 0 4px rgba(255,0,0,.15),inset 0 0 40px rgba(192,57,43,.18)}}
@keyframes checkBgPulse{
  0%,100%{background:rgba(192,57,43,0)}
  50%{background:rgba(192,57,43,.22)}}
/* Capture flash — enhanced with stronger gold burst + white flash core */
.sq.capture-flash{animation:captureFlash 1.0s ease-out;position:relative;transform:translateZ(0);will-change:box-shadow}
.sq.capture-flash::before{content:'';position:absolute;inset:0;animation:captureCore .6s ease-out;border-radius:inherit;z-index:-1;}
@keyframes captureFlash{
  0%{box-shadow:inset 0 0 15px rgba(255,215,0,.7),0 0 10px rgba(255,215,0,.4),inset 0 0 50px rgba(255,200,50,.25)}
  30%{box-shadow:inset 0 0 25px rgba(255,215,0,.5),0 0 15px rgba(255,215,0,.25),inset 0 0 40px rgba(255,200,50,.15)}
  100%{box-shadow:none}}
@keyframes captureCore{
  0%{background:rgba(255,240,180,.55)}
  40%{background:rgba(255,215,0,.2)}
  100%{background:transparent}}
/* Board square baroque textures */
.panel{width:280px;display:flex;flex-direction:column;gap:10px}
.card{background:#221015;border:1px solid var(--border);border-radius:6px;padding:12px;overflow:hidden;box-shadow:inset 0 1px 0 rgba(255,215,0,.05)}
.card-t{font-family:system-ui,-apple-system,sans-serif;font-size:.8rem;font-weight:700;color:var(--accent2);margin-bottom:8px;display:flex;align-items:center;gap:6px;padding-bottom:6px;border-bottom:1px solid rgba(212,160,23,.3);letter-spacing:1px;text-transform:uppercase}
.card-t .ico{font-size:.9rem}
.crow{display:flex;justify-content:space-between;padding:3px 0;font-size:.78rem;font-family:system-ui,-apple-system,sans-serif}
.crow .lb{color:var(--muted)}
.crow .vl{font-weight:600}
.crow .vl.b{color:var(--blue)}
.crow .vl.r{color:var(--red)}
.plist{margin-top:4px;display:flex;flex-direction:column;gap:2px}
.pitem{font-size:.75rem;display:flex;align-items:center;gap:4px;font-family:system-ui,-apple-system,sans-serif}
.dot2{width:6px;height:6px;border-radius:50%;display:inline-block;box-shadow:0 0 4px currentColor}
.dot2.b{color:var(--blue);background:var(--blue)}
.dot2.r{color:var(--red);background:var(--red)}
.mlist{max-height:140px;overflow-y:auto;font-size:.75rem;scrollbar-width:thin;scrollbar-color:var(--border) transparent;font-family:system-ui,-apple-system,sans-serif;scroll-behavior:smooth;-webkit-overflow-scrolling:touch}
.mrow{display:flex;gap:4px;padding:3px 0;border-bottom:1px solid rgba(212,160,23,.1)}
.mnum{color:var(--muted);min-width:22px;font-weight:700}
.mw,.mb{padding:1px 5px;border-radius:3px;min-width:40px}
.mvar{font-size:.6rem;color:var(--accent);font-style:italic;padding:1px 5px 1px 26px;line-height:1.4;border-bottom:1px solid rgba(212,160,23,.05);cursor:pointer}
.rmv-var{font-size:.6rem;color:var(--accent);font-style:italic;padding:1px 0;line-height:1.4;margin-top:2px}
.hint-area{background:#221015;border:1px solid var(--accent2);border-radius:6px;padding:10px 12px;position:relative;overflow:hidden;box-shadow:none}
.hint-text{font-family:system-ui,-apple-system,sans-serif;font-size:.8rem;color:var(--accent2);margin-top:4px;line-height:1.5}
.dov{position:fixed;inset:0;background:rgba(26,10,10,.97);display:flex;align-items:center;justify-content:center;z-index:300;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
.dlg{background:#1a0a0a;border:2px solid var(--border2);border-radius:10px;padding:24px;max-width:500px;width:90%;max-height:85vh;overflow-y:auto;box-shadow:0 0 6px rgba(212,160,23,.06),0 6px 16px rgba(0,0,0,.40);position:relative}
.dlg h2{font-family:system-ui,-apple-system,sans-serif;font-size:1.2rem;font-weight:900;margin-bottom:14px;color:var(--accent2);letter-spacing:2px;text-shadow:0 0 3px rgba(255,215,0,.06)}
.dlg-sec{margin-bottom:14px}
.dlg-sec h3{font-family:system-ui,-apple-system,sans-serif;font-size:.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px}
.clr-row{display:flex;gap:10px;margin-bottom:8px}
.clr-btn{flex:1;padding:14px;border-radius:6px;border:1px solid var(--border);background:#221015;cursor:pointer;text-align:center;transition:all .2s;color:var(--text);font-family:system-ui,-apple-system,sans-serif}
.clr-btn.act{border-color:var(--accent2);background:rgba(212,160,23,.15);box-shadow:none}
.clr-btn:hover{border-color:var(--accent);box-shadow:none}
.clr-ico{font-size:1.5rem;margin-bottom:2px}
.clr-nm{font-size:.85rem;font-weight:700}
.clr-sub{font-size:.65rem;color:var(--muted)}
.op-list{display:flex;flex-direction:column;gap:3px;max-height:200px;overflow-y:auto}
.op-btn{padding:8px 10px;border-radius:4px;border:1px solid var(--border);background:#221015;cursor:pointer;text-align:left;transition:all .2s;color:var(--text);font-family:system-ui,-apple-system,sans-serif}
.op-btn.act{border-color:var(--accent2);background:rgba(212,160,23,.1);box-shadow:none}
.op-btn:active{transform:scale(.98);background:#2a1520}
.on{font-size:.8rem;font-weight:700}
.os{font-size:.65rem;color:var(--muted)}
.dlg-btns{display:flex;gap:10px;margin-top:16px}
.dlg-btns .btn{flex:1;padding:12px;justify-content:center}
.prom-dov{position:fixed;inset:0;background:rgba(26,10,10,.97);display:flex;align-items:center;justify-content:center;z-index:110;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
.prom-dlg{background:#221015;border:2px solid var(--border2);border-radius:8px;padding:18px;text-align:center;box-shadow:none}
.prom-dlg h3{margin-bottom:12px;font-family:system-ui,-apple-system,sans-serif;font-size:1rem;color:var(--accent2)}
.prom-row{display:flex;gap:10px}
.prom-btn{width:56px;height:56px;font-size:2rem;border-radius:6px;border:1px solid var(--border);background:#221015;cursor:pointer;transition:all .2s;font-family:&#x27;DejaVu Sans&#x27;,&#x27;Noto Sans&#x27;,&#x27;Segoe UI Symbol&#x27;,sans-serif;font-variant-emoji:text;-webkit-font-variant-emoji:text}

.prom-btn:hover{background:#2d1a22;border-color:var(--accent2);transform:scale(1.1);box-shadow:none}
.setup-panel{display:flex;flex-direction:column;gap:8px;padding:12px;background:#221015;border:1px solid var(--border);border-radius:6px;margin-top:8px}
.setup-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center;justify-content:center}
.setup-label{font-size:.75rem;color:var(--muted);min-width:48px;text-align:right;font-family:system-ui,-apple-system,sans-serif}
.setup-btn{width:44px;height:44px;font-size:1.8rem;border-radius:4px;border:1px solid var(--border);background:#221015;cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center;font-family:&#x27;DejaVu Sans&#x27;,&#x27;Noto Sans&#x27;,&#x27;Segoe UI Symbol&#x27;,sans-serif;font-variant-emoji:text;-webkit-font-variant-emoji:text}

.setup-btn.act{border-color:var(--accent2);background:rgba(212,160,23,.15);transform:scale(1.05);box-shadow:none}
.setup-btn:hover{border-color:var(--accent);background:rgba(212,160,23,.08)}
.setup-clr{width:64px;height:36px;font-size:.78rem;border-radius:4px;border:1px solid var(--border);cursor:pointer;transition:all .2s;font-weight:700;font-family:system-ui,-apple-system,sans-serif;background:#221015;color:var(--text)}
.setup-clr.act{border-color:var(--accent2);background:rgba(212,160,23,.15)}
.setup-del{width:44px;height:44px;font-size:1.2rem;border-radius:4px;border:2px solid var(--danger);background:rgba(192,57,43,.1);color:var(--danger);cursor:pointer;transition:all .2s}
.setup-del:hover{background:rgba(192,57,43,.2);transform:scale(1.05)}
.setup-errors{background:rgba(192,57,43,.12);border:2px solid var(--danger);border-radius:6px;padding:12px;margin:8px 0;font-size:.8rem;color:#f5a0a0;font-family:system-ui,-apple-system,sans-serif}
.setup-errors strong{color:#e74c3c;display:block;margin-bottom:6px;font-size:.85rem}
.setup-errors ul{margin:4px 0;padding-left:18px}
.setup-errors li{margin:3px 0}
.gover{position:absolute;inset:0;background:rgba(26,10,10,.95);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:20;border-radius:4px;gap:10px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);animation:gameOverFade 1.6s ease-out}
.ge{font-size:3.5rem;animation:gameOverIcon 1.2s cubic-bezier(.2,-.2,.2,1.2)}
.gt{font-family:system-ui,-apple-system,sans-serif;font-size:1.2rem;font-weight:900;color:var(--accent2);text-shadow:0 0 3px rgba(255,215,0,.08);letter-spacing:2px;animation:gtAnim 1.6s ease-out .3s both}
.gover .btn{min-width:120px;justify-content:center;animation:gtAnim 1.6s ease-out .6s both}
.review-overlay{position:fixed;inset:0;background:rgba(26,10,10,.98);z-index:200;display:flex;flex-direction:column}
.review-hdr{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:#221015;border-bottom:2px solid var(--border2)}
.review-hdr h2{font-family:system-ui,-apple-system,sans-serif;font-size:1rem;font-weight:700;color:var(--accent2);letter-spacing:2px}
.review-body{display:flex;flex:1;overflow:hidden}
.review-board{flex-shrink:0;padding:12px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:8px;position:relative}
/* v1.0.4 Round-5 Rev48: position:relative so the SVG arrow overlay (absolute)
   anchors to .review-board, not the viewport. */
/* P0: Review-left wraps board + controls; in portrait it stacks naturally,
   in landscape it becomes the left column via media query. */
.review-left{display:flex;flex-direction:column;align-items:center;gap:8px}
.review-moves{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:4px;-webkit-overflow-scrolling:touch}
.rmv-block{padding:10px 14px;border-radius:6px;background:#221015;border:1px solid var(--border);cursor:pointer;transition:all .2s;display:flex;align-items:flex-start;gap:8px;font-family:system-ui,-apple-system,sans-serif}
.rmv-block:hover{border-color:var(--accent);background:rgba(212,160,23,.08);box-shadow:none}
.rmv-block.act{border-color:var(--accent2);background:rgba(212,160,23,.12);box-shadow:0 0 3px rgba(212,160,23,.08)}
.rmv-num{font-size:.75rem;color:var(--muted);min-width:28px;font-weight:700;padding-top:2px}
.rmv-notation{font-size:.95rem;font-weight:700;flex:1}
.rmv-detail{display:flex;flex-direction:column;flex:1}
/* v1.0.3-p10: review nav buttons stretch full width in ALL orientations */
.review-nav{display:flex;gap:4px;width:100%}
.review-nav .btn{flex:1 1 0;min-width:0}
::-webkit-scrollbar{width:5px}
::-webkit-scrollbar-track{background:rgba(26,10,10,.5)}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:var(--accent)}
/* Navigation UI */
/* Portrait media query
   — the previous rule forced .main{flex-direction:column} even in landscape, which broke
   the side-by-side landscape layout. Now landscape uses its own @media(orientation:landscape)
   rules which correctly set flex-direction:row. */
@media(max-width:900px) and (orientation:portrait){.panel{width:100%;max-width:420px}.main{flex-direction:column;align-items:center}.hdr-tools{gap:4px}.btn{padding:6px 10px;font-size:.72rem}.review-body{flex-direction:column}.review-board{padding:8px}
/* v1.0.6: Portrait-optimized New Game dialog.
   - Full-width dialog with reduced horizontal padding for narrow screens.
   - Time Control inputs use full-width stacked layout (no inline labels).
   - Chess960 SP-ID input + Random button share a single row.
   - ECO search box + family filter stack vertically on very narrow phones.
   - The landscape layout (default .dlg{max-width:500px;width:90%}) remains
     unchanged for orientation:landscape. */
.dlg{max-width:460px;width:94%;padding:18px 16px}
.dlg h2{font-size:1.05rem;margin-bottom:10px;letter-spacing:1.5px}
.dlg-sec{margin-bottom:12px}
.dlg-sec h3{font-size:.7rem;letter-spacing:1.2px;margin-bottom:6px}
.clr-row{gap:8px;margin-bottom:6px}
.clr-btn{padding:10px 6px}
.clr-ico{font-size:1.3rem}
.clr-nm{font-size:.78rem}
.clr-sub{font-size:.6rem}
.op-list{max-height:180px}
.op-btn{padding:6px 8px}
.on{font-size:.76rem}
.os{font-size:.62rem}
.dlg-btns{margin-top:12px}
.dlg-btns .btn{padding:10px;font-size:.82rem}
/* v1.0.6: Time Control input rows — on portrait, make labels and inputs
   stack more compactly. The input width stays at 80px (enough for 3-digit
   minutes) but the label gets more room. */
.dlg-sec select{font-size:.8rem;padding:7px 10px}
/* v1.0.6: Chess960 SP-ID row — ensure the Random button, input, and 🎲
   button wrap gracefully on narrow screens. The flex-wrap is already set
   inline; this just tightens the gap. */
.dlg-sec > div[style*="flex-wrap:wrap"]{gap:4px}}
@media(max-width:480px) and (orientation:portrait){
  /* v1.0.6: Tighter spacing for very narrow portrait phones (<480px).
     The New Game dialog's Chess960 SP-ID row uses flex-wrap so the input
     and 🎲 button wrap to a new line if needed. The ECO search box and
     family filter also wrap on narrow screens. */
  .dlg{padding:14px 12px;max-width:96%;width:96%}
  .dlg h2{font-size:.95rem;letter-spacing:1px;margin-bottom:8px}
  .dlg-sec{margin-bottom:10px}
  .dlg-sec h3{font-size:.68rem;margin-bottom:5px}
  .clr-btn{padding:8px 4px}
  .clr-ico{font-size:1.2rem}
  .clr-nm{font-size:.72rem}
  .clr-sub{font-size:.58rem}
  .op-list{max-height:160px}
  .op-btn{padding:5px 6px}
  .on{font-size:.72rem}
  .os{font-size:.6rem}
  .dlg-btns{margin-top:10px;gap:6px}
  .dlg-btns .btn{padding:9px;font-size:.78rem}
  /* v1.0.6: Time Control inputs — on very narrow screens, reduce input
     width to 70px and make labels smaller so the row fits without
     horizontal scroll. */
  .dlg-sec input[type="number"]{width:70px!important;font-size:.8rem;padding:3px 6px}
  .dlg-sec select{font-size:.78rem;padding:6px 8px}
  /* v1.0.6: ECO search row — force the search input and family filter
     to stack vertically on very narrow screens (<480px portrait). The
     flex-wrap is already set inline; this ensures the form takes full
     width when wrapped. */
  .dlg-sec form{min-width:100%!important}
  .dlg-sec select{flex-basis:100%!important;margin-top:4px}
}
@media(max-width:480px){.hdr h1{font-size:1rem}.hdr-tools{gap:2px}.btn{padding:5px 7px;font-size:.68rem;min-height:32px}/* hint-btn removed, all buttons use .btn */.ev{font-size:.75rem;padding:4px 8px}.panel{gap:6px}.card{padding:8px}.diff-b{padding:4px 7px;font-size:.68rem;min-width:24px}.main{gap:8px;padding:8px}.bwrap{border-width:2px}.pbar{padding:5px 10px}.pname{font-size:.78rem}.setup-btn{width:36px;height:36px;font-size:1.4rem}.prom-btn{width:44px;height:44px;font-size:1.6rem}}
/* ============================================================
   LANDSCAPE LAYOUT
   Strategy: Board fills available height on left, panel uses
   remaining width on right. No wasted space on any screen.
   Key fix: Use flex-grow on board section, panel gets flex:1
   for remaining space. Board auto-sizes to max height.
   ============================================================ */

/* --- LANDSCAPE BASE (all sizes) --- */
@media (orientation: landscape) {
  /* Header: ultra-compact single row */
  .hdr {
    padding: 2px 10px;
    border-bottom-width: 1px;
    flex-shrink: 0;
  }
  .hdr-top {
    margin-bottom: 0;
    gap: 4px;
    flex-wrap: nowrap;
  }
  .hdr h1 { font-size: .85rem; letter-spacing: 1px; }
  .ver { font-size: .5rem; padding: 1px 5px; }
  .hdr-tools { gap: 3px; flex-wrap: nowrap; overflow-x: auto; }
  .btn { padding: 3px 7px; font-size: .62rem; min-height: 26px; gap: 2px; white-space: nowrap; }
  .ev { font-size: .68rem; padding: 2px 6px; gap: 3px; }
  .ev-e { font-size: .85rem; }

  /* Main layout: side-by-side, board left + panel right */
  .main {
    flex-direction: row !important;
    align-items: stretch;
    flex-wrap: nowrap;
    gap: 6px;
    padding: 4px 6px;
    flex: 1;
    min-height: 0;
    /* Fill entire available space */
    height: calc(100vh - 36px);
  }

  /* Board section: auto-size to fill available height */
  .bsec {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    gap: 3px;
    /* Board section auto-sizes based on its content (board) */
    align-self: flex-start;
    max-height: 100%;
    overflow: hidden;
  }
  .bwrap { flex-shrink: 0; }

  /* Panel: fills remaining width on the right, scrollable */
  .panel {
    flex: 1 1 0;
    width: auto;
    min-width: 160px;
    max-width: none;
    max-height: 100%;
    overflow-y: auto;
    gap: 6px;
  }
  .card { padding: 5px 7px; gap: 3px; }
  .card-t { font-size: .65rem; margin-bottom: 3px; padding-bottom: 3px; }
  .crow { font-size: .65rem; padding: 1px 0; }
  .pbar { padding: 3px 6px; gap: 4px; }
  .pico { font-size: 1rem; }
  .pname { font-size: .68rem; }
  .pbar-sub { font-size: .55rem; }
  .tind { font-size: .55rem; }
  .mlist { max-height: 80px; }
  .diff-sel { padding: 1px; }
  .diff-b { padding: 2px 5px; font-size: .58rem; min-width: 20px; }

  /* Review overlay: v1.0.3-p7 redesign — TWO-LAYER SCROLL.
     Layer 1 (outer): .review-body scrolls vertically (overflow-y:auto) so the
       user can scroll to see the chart, slider, eval bar, nav buttons, and
       analyze button when they don't all fit in the viewport.
     Layer 2 (inner): .review-moves has its OWN independent scroll viewport
       (overflow-y:auto with a height matching the board) so the move list
       scrolls independently of the page scroll.
     Board sizing: board width is ALWAYS greater than move-list width (board
     ~60% of viewport, moves ~40%). Board + moves together fill 100% of the
     viewport width, edge-to-edge, no gap.
     Layout:
       review-body (vertical flex, SCROLLABLE — overflow-y:auto)
       ├─ review-top (horizontal flex, flex:0 0 auto — height = board height)
       │  ├─ review-left (board, ~60% width)
       │  └─ review-moves (INDEPENDENT scroll, ~40% width, height = board height)
       └─ review-bottom (full-width chart + slider + eval + nav + analyze)
  */
  .review-overlay { flex-direction: column; height: 100vh; }
  .review-hdr {
    padding: 2px 8px;
    flex-shrink: 0;
    min-height: 24px;
  }
  .review-hdr h2 { font-size: .65rem; letter-spacing: 1px; }
  .review-hdr .btn { padding: 2px 10px; font-size: .5rem; min-height: 18px; min-width: 32px; }
  .review-body {
    flex-direction: column !important;
    overflow-y: auto;          /* v1.0.3-p7: LAYER 1 — whole body scrolls to reveal chart/buttons */
    overflow-x: hidden;
    gap: 0;
    flex: 1;
    min-height: 0;
    max-height: calc(100vh - 28px);
    width: 100%;
    padding: 0;
    /* v1.0.3-p7: edge-to-edge — no horizontal padding so board+moves AND chart
       all span full width with no gaps. */
  }
  /* Top section: board left + moves right — FILL 100% width, edge-to-edge.
     flex:0 0 auto so its height is determined by the board's intrinsic height
     (not stretched to fill). This lets the body scroll reveal the bottom
     controls when they don't fit. */
  .review-body > .review-top {
    display: flex;
    flex-direction: row;
    flex: 0 0 auto;            /* v1.0.3-p7: height = board height (intrinsic) */
    width: 100%;
    gap: 0;
    padding: 0;
    min-height: 0;
    align-items: flex-start;   /* v1.0.3-p7: top-align so board doesn't stretch */
  }
  /* v1.0.3-p7: board takes ~60% of viewport width (ALWAYS > move list width).
     flex:0 0 auto + width set by JS via --rv-board-w. */
  .review-left {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 0;
    gap: 0;
    overflow: hidden;
    min-width: unset !important;
    flex-shrink: 0;
    margin: 0;
  }
  .review-left .review-board { padding: 0; flex-shrink: 0; margin: 0; }
  .review-left .review-board .bgrid { max-width: none; }
  /* v1.0.3-p8: allow vertical pan (scroll) on the review board so the user
     can slide on the board to scroll the whole review body. The base .bgrid
     has touch-action:none (for the main game where board slides should NOT
     scroll the page); in review mode we override to touch-action:pan-y so
     vertical slides scroll the body. Horizontal slides are still blocked to
     avoid interfering with any potential horizontal gestures. */
  .review-left .review-board .bgrid { touch-action: pan-y; }
  /* v1.0.3-p7: move list takes ALL remaining width (flex:1 1 0) — board + moves
     together fill 100% of viewport width edge-to-edge. The move list has its
     OWN independent scroll viewport: height matches the board height (set via
     JS --rv-board-h), overflow-y:auto. Board width is always > move list width. */
  .review-moves {
    flex: 1 1 0;
    overflow-y: auto;          /* v1.0.3-p7: LAYER 2 — independent scroll */
    padding: 2px 2px 2px 4px;
    min-width: 80px;
    min-height: 0;
    height: var(--rv-board-h, 320px);  /* v1.0.3-p7: match board height, set by JS */
    margin: 0;
  }
  .rmv-block { padding: 3px 5px; }
  .rmv-notation { font-size: .72rem; }
  .rmv-num { font-size: .62rem; min-width: 20px; }
  /* Bottom section: full-width chart + controls, edge-to-edge. flex:0 0 auto
     so it takes its content height. Visible by scrolling the body. */
  .review-body > .review-bottom {
    display: flex;
    flex-direction: column;
    width: 100%;
    flex: 0 0 auto;
    padding: 4px 6px;
    gap: 4px;
  }
  .review-chart { min-height: 40px; overflow: hidden; flex-shrink: 1; width: 100%; }
  input[type="range"].review-slider { height: 18px; width: 100%; }
  /* v1.0.3-p7: nav buttons stretched horizontally for better space use */
  .review-bottom .review-nav {
    display: flex;
    gap: 4px;
    width: 100%;
  }
  .review-bottom .review-nav .btn {
    flex: 1 1 0;
    padding: 4px 8px;
    font-size: .7rem;
    min-height: 28px;
    min-width: 0;
  }
  .review-bottom #review-eval-bar {
    margin: 1px 0 !important;
    font-size: .7rem !important;
    padding: 2px 6px !important;
    width: 100%;
  }
  .review-bottom .btn { padding: 3px 10px; font-size: .55rem; min-height: 22px; min-width: 36px; }
}

/* --- VERY COMPACT LANDSCAPE (phone with keyboard overlay) --- */
@media (orientation: landscape) and (max-height: 380px) {
  .hdr { padding: 1px 6px; }
  .hdr h1 { font-size: .7rem; }
  .btn { padding: 2px 5px; font-size: .55rem; min-height: 22px; }
  .ev { font-size: .6rem; padding: 1px 4px; }
  .main { gap: 3px; padding: 2px 3px; height: calc(100vh - 24px); }
  .bsec { gap: 2px; }
  .panel { min-width: 120px; }
  .card { padding: 3px 4px; }
  .card-t { font-size: .58rem; }
  .crow { font-size: .58rem; }
  .pbar { padding: 2px 4px; }
  .pname { font-size: .6rem; }
  .mlist { max-height: 50px; }
  /* Review mode inherits from base landscape rule — the new layout
     (board+moves top, chart+controls bottom, vertical scroll) works
     at any height without per-size tweaks. */
}

/* --- STANDARD PHONE LANDSCAPE --- */
@media (orientation: landscape) and (min-height: 381px) and (max-height: 500px) {
  .panel { min-width: 150px; }
  .mlist { max-height: 100px; }
}

/* --- TABLET / TALL LANDSCAPE --- */
@media (orientation: landscape) and (min-height: 501px) {
  .hdr { padding: 6px 14px; }
  .hdr h1 { font-size: 1.05rem; }
  .btn { padding: 5px 10px; font-size: .72rem; min-height: 32px; }
  .ev { font-size: .78rem; padding: 4px 8px; }
  .main { gap: 10px; padding: 8px; height: calc(100vh - 56px); }
  .bsec { gap: 6px; }
  .panel { min-width: 200px; }
  .card { padding: 8px 10px; }
  .card-t { font-size: .72rem; margin-bottom: 5px; padding-bottom: 4px; }
  .crow { font-size: .72rem; padding: 2px 0; }
  .pbar { padding: 5px 8px; gap: 6px; }
  .pico { font-size: 1.2rem; }
  .pname { font-size: .78rem; }
  .mlist { max-height: 140px; }
  /* Review mode: larger fonts on tall tablets, layout unchanged */
  .review-hdr { padding: 6px 14px; min-height: 40px; }
  .review-hdr h2 { font-size: .85rem; }
  .review-hdr .btn { padding: 4px 8px; font-size: .65rem; min-height: 28px; }
  .rmv-block { padding: 6px 10px; }
  .rmv-notation { font-size: .82rem; }
  .rmv-num { font-size: .7rem; min-width: 24px; }
}

/* --- LARGE TABLET / CHROME OS --- */
@media (orientation: landscape) and (min-height: 701px) {
  .hdr { padding: 8px 18px; }
  .hdr h1 { font-size: 1.2rem; }
  .btn { padding: 7px 14px; font-size: .8rem; min-height: 36px; }
  .main { gap: 14px; padding: 12px; height: calc(100vh - 68px); }
  .panel { min-width: 260px; }
  .card { padding: 10px 14px; }
  .card-t { font-size: .78rem; }
  .crow { font-size: .78rem; }
  .mlist { max-height: 200px; }
}

/* Last move highlight - baroque gold glow */
.sq.last-from{box-shadow:inset 0 0 0 3px var(--accent2),inset 0 0 3px rgba(255,215,0,.06)!important}
.sq.last-to{box-shadow:inset 0 0 0 3px #27ae60,inset 0 0 3px rgba(39,174,96,.06)!important}
.tips{font-size:.75rem;color:var(--muted);line-height:1.6;font-family:system-ui,-apple-system,sans-serif}
.tip-item{margin-bottom:4px}
/* Move animation overlay - per-piece types, GPU-accelerated */
.move-anim{position:absolute;display:flex;align-items:center;justify-content:center;font-size:2rem;z-index:20;pointer-events:none;will-change:transform;backface-visibility:hidden;-webkit-backface-visibility:hidden;transform:translate3d(0,0,0);font-family:&#x27;DejaVu Sans&#x27;,&#x27;Noto Sans&#x27;,&#x27;Segoe UI Symbol&#x27;,sans-serif;font-variant-emoji:text;-webkit-font-variant-emoji:text;font-weight:400}

/* v1.0.5 Round-6 Rev49: High aspect-ratio screen adaptation.
   Goal: every interface scrolls VERTICALLY ONLY — never horizontal scroll,
   regardless of portrait or landscape, on any aspect ratio (including
   ultra-tall phones 21:9, 22:9, foldable inner screens, ultra-wide tablets).
   Strategy:
   1. Body and #app always have overflow-x:hidden (already set above).
   2. All flex containers use min-width:0 on children so they shrink instead
      of overflowing horizontally.
   3. The header toolbar (.hdr-tools) wraps to multiple rows on narrow
      widths instead of horizontal scroll.
   4. Long text elements use word-break:break-word and overflow-wrap:anywhere.
   5. Tables and code blocks use overflow-x:auto ONLY on their own container
      (not the whole page) so horizontal scroll is localized to where it's
      genuinely needed (e.g., PGN text), never the main layout.
   6. The board never overflows — it's sized to min(viewport-width, viewport-height).
*/
:root{
  /* v1.0.5 Rev49: Safe-area CSS variables for notch/cutout/R-corner.
     These read the system's safe-area insets (set by AndroidManifest's
     shortEdges mode + viewport-fit=cover) and expose them to JS for
     the anti-shake feature's max-displacement clamping. */
  --safe-top:env(safe-area-inset-top,0px);
  --safe-bottom:env(safe-area-inset-bottom,0px);
  --safe-left:env(safe-area-inset-left,0px);
  --safe-right:env(safe-area-inset-right,0px);
}
/* v1.0.5 Rev49: Ensure all flex children can shrink — prevents horizontal
   overflow when content is wider than the flex container. */
.hdr-top,.hdr-tools,.main,.bsec,.panel,.review-top,.review-bottom,.review-nav,.pbar,.card,.crow,.mlist,.review-body{min-width:0}
/* v1.0.5 Rev49: Header toolbar wraps instead of horizontal-scrolling.
   Previously .hdr-tools had overflow-x:auto in landscape, causing a
   horizontal scrollbar on ultra-wide screens. Now it wraps to multiple
   rows, keeping everything visible without horizontal scroll. */
@media(orientation:landscape){.hdr-tools{gap:3px;flex-wrap:wrap;overflow-x:hidden}}
/* v1.0.5 Rev49: Long text breaks instead of overflowing. */
.crow,.pname,.tind,.tips,.tip-item,.rmv-notation,.rmv-comment,.ec-name{word-break:break-word;overflow-wrap:anywhere}
/* v1.0.5 Rev49: Tables and PGN/code blocks keep LOCAL horizontal scroll
   (only when their own content is too wide), never triggering page-level
   horizontal scroll. */
.mlist,.review-moves,.dlg{overflow-wrap:break-word;word-break:break-word}

/* Anti-shake stabilization layer. When _stabilizationEnabled is true (toggled
   by long-pressing any board square), the .bwrap element gets a CSS class
   .stabilized that applies a CSS transform for translation anti-shake (±8px).
   Values are set dynamically by JS via CSS custom properties --stab-x, --stab-y. */
.bwrap.stabilized{
  transition:transform 16ms linear;
  transform:translate3d(var(--stab-x,0px),var(--stab-y,0px),0);
  will-change:transform;
}
/* v1.0.5 Rev49: Ultra-tall portrait (aspect ratio >= 2.0, e.g., 21:9 phones).
   On such screens the board would leave huge empty space above/below.
   Strategy: cap board size to a reasonable max (so it doesn't dominate),
   and let the panel below take more vertical space for move history. */
@media(orientation:portrait) and (min-aspect-ratio:2/1){
  .main{gap:10px;padding:8px}
  .bsec{align-self:center;max-width:90vw}
  .panel{max-width:480px;margin:0 auto;width:100%}
}
/* v1.0.5 Rev49: Ultra-wide landscape (aspect ratio >= 2.2, e.g., 21:9 phones
   in landscape, foldable inner screens). Cap panel width so the move list
   doesn't stretch absurdly wide; center the whole main row. */
@media(orientation:landscape) and (min-aspect-ratio:22/10){
  .main{justify-content:center;gap:16px}
  .panel{max-width:520px;flex:0 1 520px}
  .bsec{flex:0 0 auto}
}
/* v1.0.5 Rev49: Ultra-short landscape (aspect ratio <= 1.4 in landscape,
   e.g., some foldable outer screens, square-ish tablets in landscape).
   Stack board ABOVE panel (column layout) so neither is too cramped. */
@media(orientation:landscape) and (max-aspect-ratio:14/10){
  .main{flex-direction:column!important;align-items:center;height:auto}
  .bsec{align-self:center}
  .panel{width:100%;max-width:520px;max-height:none}
}

/* v1.0.4 ROUND-5 REV12: Match JS durations exactly (game-logic.js animateMove).
   180-260ms for smooth 120fps. will-change:transform ensures GPU compositing. */
.move-anim.anim-pawn{transition:transform .18s cubic-bezier(.25,.1,.25,1)}
.move-anim.anim-knight{transition:transform .24s cubic-bezier(.25,.1,.25,1)}
.move-anim.anim-bishop{transition:transform .21s cubic-bezier(.25,.1,.25,1)}
.move-anim.anim-rook{transition:transform .18s cubic-bezier(.25,.1,.25,1)}
.move-anim.anim-queen{transition:transform .26s cubic-bezier(.25,.1,.25,1)}
.move-anim.anim-king{transition:transform .21s cubic-bezier(.25,.1,.25,1)}
/* Opening display */
.opening-tag{background:linear-gradient(145deg,var(--purple),#6c3483);color:#ffd700;font-size:.72rem;padding:3px 12px;border-radius:4px;font-weight:700;white-space:nowrap;border:1px solid rgba(255,215,0,.3);font-family:system-ui,-apple-system,sans-serif;letter-spacing:1px;box-shadow:0 0 2px rgba(142,68,173,.08)}
/* Sound button integrated into toolbar - no longer floating */
.btn-d{background:#221015;border-color:var(--border)}
.ci{font-size:1.5rem;display:block;margin-bottom:2px}

.card:hover{border-color:rgba(212,160,23,.5);box-shadow:0 0 2px rgba(212,160,23,.04)}
@media(prefers-reduced-motion:reduce){.sq .pc.anim-pawn,.sq .pc.anim-knight,.sq .pc.anim-bishop,.sq .pc.anim-rook,.sq .pc.anim-queen,.sq .pc.anim-king{animation:none!important}.sq.in-check{animation:none!important}.sq.capture-flash{animation:none!important}.move-anim{transition:none!important}.ge,.gt,.gover .btn{animation:none!important}}
</style>
</head>
<body>
<div id="app"></div>
<script>/* __MODULE_SCRIPTS__ */</script>
</body>
</html>
