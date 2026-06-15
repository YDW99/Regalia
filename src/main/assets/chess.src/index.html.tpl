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
<title>Regalia v1.0.0</title>
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
/* hint-btn removed — all buttons use consistent .btn styling */
.main{display:flex;flex:1;gap:14px;padding:14px;justify-content:center;flex-wrap:wrap}
.bsec{display:flex;flex-direction:column;gap:8px}
.pbar{display:flex;align-items:center;gap:10px;padding:8px 14px;background:#221015;border-radius:6px;border:1px solid var(--border);box-shadow:inset 0 1px 0 rgba(255,215,0,.05)}
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
.bgrid{display:grid;transform:translateZ(0);touch-action:none}
.sq{display:flex;align-items:center;justify-content:center;cursor:pointer;position:relative;user-select:none;font-size:2rem;line-height:1;transition:background .15s,box-shadow .3s;touch-action:manipulation}
.sq:hover{box-shadow:inset 0 0 3px rgba(255,215,0,.05)}
.sq .lbl{position:absolute;top:1px;left:2px;font-size:9px;opacity:.95;font-family:"DejaVu Sans",system-ui,sans-serif;pointer-events:none;z-index:2;letter-spacing:0}
/* === 黑曜石棋子 — 清晰轮廓、全局可辨 === */
/* 黑子: 深曜石底色 + 亮金描边 + 亮金微光 (深色格上描边醒目可辨) */
/* 白子: 银曜石底色 + 浓棕描边 + 浓棕微光 (浅色格上描边醒目可辨) */
.sq .pc{pointer-events:none;font-size:2rem;z-index:1;transition:transform .1s;position:relative;font-variant-emoji:text;-webkit-font-variant-emoji:text;font-family:&#x27;DejaVu Sans&#x27;,&#x27;Noto Sans&#x27;,&#x27;Segoe UI Symbol&#x27;,sans-serif;font-weight:400;speak:none}
.sq:hover .pc{transform:scale(1.05)}
/* 黑子 — 深曜石：亮金描边 + 亮金微光 (深/浅色背景上均可辨) */
.sq .pc.bk,.prom-btn.bk-prom,.setup-btn.sb,.move-anim.bk-piece,.rv-bk{color:#1A1A2E;-webkit-text-stroke:.3px rgba(255,230,150,.85);text-shadow:0 0 .8px rgba(255,230,150,.55)}
/* 白子 — 银曜石：浓棕描边 + 浓棕微光 (深/浅色背景上均可辨) */
.sq .pc.w,.prom-btn.w-prom,.setup-btn.sw,.move-anim.w-piece,.rv-w{color:#E8E8F0;-webkit-text-stroke:.3px rgba(30,15,0,.85);text-shadow:0 0 .8px rgba(30,15,0,.55)}
/* 复盘棋子：字体与棋盘一致，避免字形跳变 */
.rv-w,.rv-bk{font-family:&#x27;DejaVu Sans&#x27;,&#x27;Noto Sans&#x27;,&#x27;Segoe UI Symbol&#x27;,sans-serif;font-variant-emoji:text;-webkit-font-variant-emoji:text;font-weight:400}
.sq .dot{width:18px;height:18px;border-radius:50%;background:radial-gradient(circle,rgba(255,140,0,.6),rgba(255,140,0,.35));pointer-events:none;z-index:1;box-shadow:0 0 3px rgba(255,140,0,.2)}
.sq .ring{position:absolute;inset:3px;border-radius:50%;border:3px solid rgba(255,140,0,.55);pointer-events:none;z-index:1;box-shadow:0 0 2px rgba(255,140,0,.10)}
/* Piece-specific animations */
.sq .pc.anim-pawn{animation:pawnStep .6s cubic-bezier(.4,0,.2,1)}
.sq .pc.anim-knight{animation:knightJump .8s cubic-bezier(.2,-.2,.2,1.2)}
.sq .pc.anim-bishop{animation:bishopGlide .7s cubic-bezier(.4,0,.2,1)}
.sq .pc.anim-rook{animation:rookSlide .6s cubic-bezier(.4,0,.2,1)}
.sq .pc.anim-queen{animation:queenGlide .8s cubic-bezier(.25,.1,.25,1)}
.sq .pc.anim-king{animation:kingStep .7s cubic-bezier(.4,0,.2,1)}
@keyframes pawnStep{0%{transform:translateY(6px) scale(.95);opacity:.8}40%{transform:translateY(-2px) scale(1.03)}100%{transform:translateY(0) scale(1);opacity:1}}
@keyframes knightJump{0%{transform:scale(.8) translateY(0);opacity:.7}30%{transform:scale(1.1) translateY(-14px);opacity:.85}60%{transform:scale(1.05) translateY(-4px)}100%{transform:scale(1) translateY(0);opacity:1}}
@keyframes bishopGlide{0%{transform:translate(-6px,6px) scale(.9);opacity:.7}50%{transform:translate(1px,-1px) scale(1.04);opacity:.9}100%{transform:translate(0,0) scale(1);opacity:1}}
@keyframes rookSlide{0%{transform:scaleX(.8);opacity:.8}50%{transform:scaleX(1.05)}100%{transform:scaleX(1);opacity:1}}
@keyframes queenGlide{0%{transform:scale(.85) rotate(-3deg);opacity:.7}30%{transform:scale(1.06) rotate(1deg);opacity:.85}60%{transform:scale(1.02) rotate(-1deg)}100%{transform:scale(1) rotate(0);opacity:1}}
@keyframes kingStep{0%{transform:scale(.85);opacity:.75}30%{transform:scale(1.08);opacity:.9}60%{transform:scale(1.02)}100%{transform:scale(1);opacity:1}}
/* Check animation on king — enhanced with background pulse + stronger glow */
.sq.in-check{animation:checkPulse 1.2s ease-in-out infinite;position:relative;z-index:1;}
.sq.in-check::before{content:'';position:absolute;inset:0;animation:checkBgPulse 1.2s ease-in-out infinite;border-radius:inherit;z-index:-1;}
@keyframes checkPulse{
  0%,100%{box-shadow:inset 0 0 6px rgba(192,57,43,.4),0 0 4px rgba(192,57,43,.2),inset 0 0 20px rgba(192,57,43,.06)}
  50%{box-shadow:inset 0 0 18px rgba(192,57,43,.65),0 0 12px rgba(192,57,43,.35),0 0 4px rgba(255,0,0,.15),inset 0 0 40px rgba(192,57,43,.18)}}
@keyframes checkBgPulse{
  0%,100%{background:rgba(192,57,43,0)}
  50%{background:rgba(192,57,43,.22)}}
/* Capture flash — enhanced with stronger gold burst + white flash core */
.sq.capture-flash{animation:captureFlash 1.0s ease-out;position:relative;}
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
.dov{position:fixed;inset:0;background:rgba(26,10,10,.97);display:flex;align-items:center;justify-content:center;z-index:100;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
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
.review-board{flex-shrink:0;padding:12px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:8px}
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
::-webkit-scrollbar{width:5px}
::-webkit-scrollbar-track{background:rgba(26,10,10,.5)}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:var(--accent)}
/* Navigation UI */
/* Portrait media query
   — the previous rule forced .main{flex-direction:column} even in landscape, which broke
   the side-by-side landscape layout. Now landscape uses its own @media(orientation:landscape)
   rules which correctly set flex-direction:row. */
@media(max-width:900px) and (orientation:portrait){.panel{width:100%;max-width:420px}.main{flex-direction:column;align-items:center}.hdr-tools{gap:4px}.btn{padding:6px 10px;font-size:.72rem}.review-body{flex-direction:column}.review-board{padding:8px}}
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
  .ver { display: none; }
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

  /* Review overlay: board left, moves right — optimized for landscape */
  .review-overlay { flex-direction: column; height: 100vh; }
  .review-hdr {
    padding: 2px 8px;
    flex-shrink: 0;
    min-height: 24px;
  }
  .review-hdr h2 { font-size: .65rem; letter-spacing: 1px; }
  .review-hdr .btn { padding: 2px 5px; font-size: .5rem; min-height: 18px; }
  .review-body {
    flex-direction: row !important;
    overflow: hidden;
    gap: 4px;
    flex: 1;
    min-height: 0;
    /* Use full remaining height after header */
    max-height: calc(100vh - 28px);
  }
  .review-left {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2px 4px;
    gap: 2px;
    overflow-y: auto;
    min-width: unset !important;
    max-height: 100%;
    /* Optimize — let review-left shrink to fit its content,
       so the moves list gets maximum space */
    flex-shrink: 0;
  }
  /* Chart gets explicit height from JS via style attribute. min-height ensures
     it's never invisible. overflow:hidden clips SVG cleanly. */
  .review-chart { min-height: 30px; overflow: hidden; flex-shrink: 0; }
  input[type="range"].review-slider { height: 16px; }
  .review-board { padding: 0; }
  .review-board .bgrid { max-width: none; }
  .review-moves {
    flex: 1 1 0;
    overflow-y: auto;
    padding: 3px 4px;
    min-width: 120px;
    /* OPT: Use maximum available space */
    max-height: 100%;
    /* CONSTRAINT: moves list width must always be less than board width.
       Board = 8 * REVIEW_CELL ≈ 320px, so cap at 45% of viewport width
       to ensure it stays narrower than the board in landscape. */
    max-width: 45vw;
  }
  .rmv-block { padding: 3px 5px; }
  .rmv-notation { font-size: .72rem; }
  .rmv-num { font-size: .62rem; min-width: 20px; }
  .review-left #review-eval-bar {
    margin: 1px 0 !important;
    font-size: .6rem !important;
    padding: 1px 4px !important;
  }
  .review-left .btn { padding: 2px 5px; font-size: .5rem; min-height: 20px; }
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
  .review-hdr { min-height: 20px; }
  .review-body { gap: 3px; }
  .review-left { padding: 2px; gap: 2px; overflow-y: auto; }
  .review-moves { min-width: 100px; padding: 2px 3px; }
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
  .review-hdr { padding: 6px 14px; min-height: 40px; }
  .review-hdr h2 { font-size: .85rem; }
  .review-hdr .btn { padding: 4px 8px; font-size: .65rem; min-height: 28px; }
  .review-body { gap: 10px; }
  .review-left { padding: 8px; gap: 6px; overflow-y: auto; }
  .review-moves { min-width: 180px; padding: 8px; }
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
  .review-body { gap: 14px; }
  .review-left { padding: 12px; gap: 8px; overflow-y: auto; }
  .review-moves { min-width: 240px; padding: 12px; }
}

/* Last move highlight - baroque gold glow */
.sq.last-from{box-shadow:inset 0 0 0 3px var(--accent2),inset 0 0 3px rgba(255,215,0,.06)!important}
.sq.last-to{box-shadow:inset 0 0 0 3px #27ae60,inset 0 0 3px rgba(39,174,96,.06)!important}
.tips{font-size:.75rem;color:var(--muted);line-height:1.6;font-family:system-ui,-apple-system,sans-serif}
.tip-item{margin-bottom:4px}
/* Move animation overlay - per-piece types, GPU-accelerated */
.move-anim{position:absolute;display:flex;align-items:center;justify-content:center;font-size:2rem;z-index:20;pointer-events:none;will-change:transform;backface-visibility:hidden;-webkit-backface-visibility:hidden;transform:translate3d(0,0,0);font-family:&#x27;DejaVu Sans&#x27;,&#x27;Noto Sans&#x27;,&#x27;Segoe UI Symbol&#x27;,sans-serif;font-variant-emoji:text;-webkit-font-variant-emoji:text;font-weight:400}

.move-anim.anim-pawn{transition:transform .24s cubic-bezier(.25,.1,.25,1)}
.move-anim.anim-knight{transition:transform .30s cubic-bezier(.25,.1,.25,1)}
.move-anim.anim-bishop{transition:transform .27s cubic-bezier(.25,.1,.25,1)}
.move-anim.anim-rook{transition:transform .24s cubic-bezier(.25,.1,.25,1)}
.move-anim.anim-queen{transition:transform .32s cubic-bezier(.25,.1,.25,1)}
.move-anim.anim-king{transition:transform .27s cubic-bezier(.25,.1,.25,1)}
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
