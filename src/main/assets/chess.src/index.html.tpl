<!--
  Copyright (C) 2026 Regalia

  v1.0.8 PHASE 37/49: This HTML/CSS template is classified GPL v3 to match
  the license of the DroidFish-derived JavaScript modules it bundles (via
  build-chess.py). The CSS layout patterns and theme-variable structure
  follow DroidFish-derived conventions; bundling them under a different
  license would fragment the combined work. The GPL v3 boilerplate below
  is authoritative; earlier comments describing the template as "original
  (AGPL v3)" were stale and have been corrected.

  AI-GEN: AI assisted
  This code was AI-assisted and has been reviewed for GPL v3 compliance.

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.
-->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; worker-src blob:; connect-src https://tablebase.lichess.ovh; img-src data: file: blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'none'; object-src 'none'">
<title>Regalia v1.2.1</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
/* v1.0.8 PHASE 22: Light/Dark theme system following Material Design
   principles. Dark mode is the default (warm brown-red + gold, baroque chess
   aesthetic); light mode activates via prefers-color-scheme:light (system
   global setting) and uses an elegant silver palette (silver-gray bg + deep
   slate text + soft silver accents) — "典雅庄重的白银色调".
   Board squares (SQ_LIGHT/SQ_DARK) and pieces (.sq .pc.w/.bk) keep their
   colors UNCHANGED in both modes for chess-readability consistency.
   All other component colors use CSS variables so the theme switch is
   comprehensive. The king icon (♔ dark / ♚ light) is swapped by JS
   (see ui.js _hdrKingIconHTML + ai-bridge.js _loadingKingIconHTML). */
:root{color-scheme:dark light;--bg:#1a0a0a;--card:#221015;--card2:#2a1418;--hdr-bg:#1a0a0a;--border:#8b6914;--border2:#d4a017;--text:#f5e6c8;--muted:#a08050;--placeholder:#c0a070;--accent:#d4a017;--accent2:#ffd700;--blue:#4a90d9;--red:#c0392b;--purple:#8e44ad;--green:#27ae60;--danger:#c0392b;--btn-bg:#221015;--btn-bg-hover:#2d1a22;--btn-a-bg:#c49512;--btn-a-hover:#d4a017;--btn-g-bg:#229954;--btn-g-border:#2ecc71;--btn-p-bg:#3a78b4;--btn-p-hover:#4d9ccf;--btn-p-border:#5dade2;--btn-shadow:inset 0 1px 0 rgba(255,215,0,.1);--overlay-bg:rgba(26,10,10,.97);--overlay-card-bg:#221015;--input-bg:#1a0a0a;--toggle-bg:#1a0a0a;--toggle-on-bg:#c49512;--toggle-dot:#ffd700;--toggle-dot-on:#1a0a0a;--toggle-dot-shadow:0 1px 4px rgba(0,0,0,.5);--bwrap-bg:#1a0a0a;--diffsel-bg:#1a0a0a;--ev-bg:rgba(42,21,32,.8);--panel-shadow:0 0 6px rgba(212,160,23,.08),0 4px 14px rgba(0,0,0,.40),inset 0 0 4px rgba(0,0,0,.08);--sq-sel:#5a4030;--sq-hover:rgba(255,215,0,.04);--scrollbar-track:rgba(26,10,10,.5);--op-active-bg:#2a1520;--setup-del-hover:rgba(192,57,43,.2);--setup-err-color:#ff6b5a;--mvar-color:rgba(212,160,23,.05);--mnum-color:rgba(212,160,23,.1);--last-to:#8bc34a;--last-from:#ffd700;--last-to-glow:rgba(139,195,74,.15);--castle-ring:#ffd700;--setup-castle-mark:#ffd700;--setup-ep-mark:#9b59b6;--chart-line:#5dade2;--chart-fill:#e74c3c;--chart-grid:#4a3020;--chart-axis:#8a6a3a;--chart-text-stroke:#1a0a0a;--chart-critical:#ffd700;--chart-critical-text:#ffd700;--chart-label:#f5e6c8}
/* v1.0.8 PHASE 22 (third supplement): Light mode redesigned to elegant silver tones.
   Design goal: "典雅庄重的白银色调" — silver-gray background + deep slate text +
   soft silver accents. Every color (except board squares & pieces) differs from
   dark mode. The board keeps its wood tones (SQ_LIGHT/SQ_DARK) and pieces keep
   their obsidian colors in BOTH modes for chess-readability consistency.
   Silver palette: #f0f0f3 (bg) / #e0e0e5 (card) / #2c2c34 (text) / #5a5a66 (muted) /
   #6a6a76 (accent) / #4a4a52 (accent2). Inspired by polished silver chess sets. */
/* v1.0.8 PHASE 22 (bug fix): Light theme triggers via BOTH:
   1. @media (prefers-color-scheme: light) — standard CSS media query (works
      when WebView correctly passes isLightTheme)
   2. html[data-theme="light"] — JS-driven attribute selector (works on ALL
      devices including Xiaomi HyperOS 3 where prefers-color-scheme may be
      stuck on dark). JS sets data-theme based on AndroidBridge.isSystemDarkMode().
   Both selectors use the same silver palette. The :root dark-mode variables
   are the default; light-mode variables override when either selector matches. */
@media (prefers-color-scheme: light){
  :root{color-scheme:light dark;--bg:#f0f0f3;--card:#e0e0e5;--card2:#d4d4da;--hdr-bg:#f0f0f3;--border:#8a8a94;--border2:#5a5a66;--text:#2c2c34;--muted:#6a6a76;--placeholder:#4a4a52;--accent:#4a4a52;--accent2:#2c2c34;--blue:#2c5f8d;--red:#a02818;--purple:#6a2c8e;--green:#1e7e34;--danger:#a02818;--btn-bg:#e0e0e5;--btn-bg-hover:#d4d4da;--btn-a-bg:#6a6a76;--btn-a-hover:#5a5a66;--btn-g-bg:#229954;--btn-g-border:#2ecc71;--btn-p-bg:#3a78b4;--btn-p-hover:#4d9ccf;--btn-p-border:#5dade2;--btn-shadow:inset 0 1px 0 rgba(255,255,255,.6);--overlay-bg:rgba(240,240,243,.97);--overlay-card-bg:#e0e0e5;--input-bg:#f0f0f3;--toggle-bg:#d4d4da;--toggle-on-bg:#5a5a66;--toggle-dot:#5a5a66;--toggle-dot-on:#f0f0f3;--toggle-dot-shadow:0 1px 3px rgba(0,0,0,.25);--bwrap-bg:#e8d5b0;--diffsel-bg:#e0e0e5;--ev-bg:rgba(208,208,214,.8);--panel-shadow:0 0 6px rgba(90,90,102,.10),0 4px 14px rgba(0,0,0,.10),inset 0 0 4px rgba(0,0,0,.03);--sq-sel:#b8b8c0;--sq-hover:rgba(90,90,102,.06);--scrollbar-track:rgba(208,208,214,.6);--op-active-bg:#d4d4da;--setup-del-hover:rgba(160,40,24,.15);--setup-err-color:#a02818;--mvar-color:rgba(90,90,102,.06);--mnum-color:rgba(90,90,102,.1);--last-to:#8bc34a;--last-from:#ffd700;--last-to-glow:rgba(139,195,74,.15);--castle-ring:#5a5a66;--setup-castle-mark:#5a5a66;--setup-ep-mark:#6a2c8e;--chart-line:#2c5f8d;--chart-fill:#c0392b;--chart-grid:#b0b0b8;--chart-axis:#8a8a94;--chart-text-stroke:#f0f0f3;--chart-critical:#d4a017;--chart-critical-text:#2c2c34;--chart-label:#2c2c34}
}
/* JS-driven light theme (Xiaomi HyperOS 3 compatibility) — same silver palette */
html[data-theme="light"]{color-scheme:light;--bg:#f0f0f3;--card:#e0e0e5;--card2:#d4d4da;--hdr-bg:#f0f0f3;--border:#8a8a94;--border2:#5a5a66;--text:#2c2c34;--muted:#6a6a76;--placeholder:#4a4a52;--accent:#4a4a52;--accent2:#2c2c34;--blue:#2c5f8d;--red:#a02818;--purple:#6a2c8e;--green:#1e7e34;--danger:#a02818;--btn-bg:#e0e0e5;--btn-bg-hover:#d4d4da;--btn-a-bg:#6a6a76;--btn-a-hover:#5a5a66;--btn-g-bg:#229954;--btn-g-border:#2ecc71;--btn-p-bg:#3a78b4;--btn-p-hover:#4d9ccf;--btn-p-border:#5dade2;--btn-shadow:inset 0 1px 0 rgba(255,255,255,.6);--overlay-bg:rgba(240,240,243,.97);--overlay-card-bg:#e0e0e5;--input-bg:#f0f0f3;--toggle-bg:#d4d4da;--toggle-on-bg:#5a5a66;--toggle-dot:#5a5a66;--toggle-dot-on:#f0f0f3;--toggle-dot-shadow:0 1px 3px rgba(0,0,0,.25);--bwrap-bg:#e8d5b0;--diffsel-bg:#e0e0e5;--ev-bg:rgba(208,208,214,.8);--panel-shadow:0 0 6px rgba(90,90,102,.10),0 4px 14px rgba(0,0,0,.10),inset 0 0 4px rgba(0,0,0,.03);--sq-sel:#b8b8c0;--sq-hover:rgba(90,90,102,.06);--scrollbar-track:rgba(208,208,214,.6);--op-active-bg:#d4d4da;--setup-del-hover:rgba(160,40,24,.15);--setup-err-color:#a02818;--mvar-color:rgba(90,90,102,.06);--mnum-color:rgba(90,90,102,.1);--last-to:#8bc34a;--last-from:#ffd700;--last-to-glow:rgba(139,195,74,.15);--castle-ring:#5a5a66;--setup-castle-mark:#5a5a66;--setup-ep-mark:#6a2c8e;--chart-line:#2c5f8d;--chart-fill:#c0392b;--chart-grid:#b0b0b8;--chart-axis:#8a8a94;--chart-text-stroke:#f0f0f3;--chart-critical:#d4a017;--chart-critical-text:#2c2c34;--chart-label:#2c2c34}
/* JS-driven dark theme (Xiaomi HyperOS 3 compatibility) — restores the FULL dark
   palette when the system reports light but JS forces dark via data-theme="dark".
   v1.0.8 PHASE 24 (bug fix): previously only restored 7 chart variables, leaving
   the rest of the page light when the system was light but JS forced dark. */
html[data-theme="dark"]{color-scheme:dark;--bg:#1a0a0a;--card:#221015;--card2:#2a1418;--hdr-bg:#1a0a0a;--border:#8b6914;--border2:#d4a017;--text:#f5e6c8;--muted:#a08050;--placeholder:#c0a070;--accent:#d4a017;--accent2:#ffd700;--blue:#4a90d9;--red:#c0392b;--purple:#8e44ad;--green:#27ae60;--danger:#c0392b;--btn-bg:#221015;--btn-bg-hover:#2d1a22;--btn-a-bg:#c49512;--btn-a-hover:#d4a017;--btn-g-bg:#229954;--btn-g-border:#2ecc71;--btn-p-bg:#3a78b4;--btn-p-hover:#4d9ccf;--btn-p-border:#5dade2;--btn-shadow:inset 0 1px 0 rgba(255,215,0,.1);--overlay-bg:rgba(26,10,10,.97);--overlay-card-bg:#221015;--input-bg:#1a0a0a;--toggle-bg:#1a0a0a;--toggle-on-bg:#c49512;--toggle-dot:#ffd700;--toggle-dot-on:#1a0a0a;--toggle-dot-shadow:0 1px 4px rgba(0,0,0,.5);--bwrap-bg:#1a0a0a;--diffsel-bg:#1a0a0a;--ev-bg:rgba(42,21,32,.8);--panel-shadow:0 0 6px rgba(212,160,23,.08),0 4px 14px rgba(0,0,0,.40),inset 0 0 4px rgba(0,0,0,.08);--sq-sel:#5a4030;--sq-hover:rgba(255,215,0,.04);--scrollbar-track:rgba(26,10,10,.5);--op-active-bg:#2a1520;--setup-del-hover:rgba(192,57,43,.2);--setup-err-color:#ff6b5a;--mvar-color:rgba(212,160,23,.05);--mnum-color:rgba(212,160,23,.1);--last-to:#8bc34a;--last-from:#ffd700;--last-to-glow:rgba(139,195,74,.15);--castle-ring:#ffd700;--setup-castle-mark:#ffd700;--setup-ep-mark:#9b59b6;--chart-line:#5dade2;--chart-fill:#e74c3c;--chart-grid:#4a3020;--chart-axis:#8a6a3a;--chart-text-stroke:#1a0a0a;--chart-critical:#ffd700;--chart-critical-text:#ffd700;--chart-label:#f5e6c8}
/* v1.0.7: html + body + #app ALL get overflow-x:hidden. html uses max-width:100%
   (NOT 100vw — 100vw includes safe-area insets and causes overflow on notched phones).
   body gets padding for safe-area only (NOT the 3px finger-grip — that's handled
   by #app's margin-right so content isn't clipped by body's overflow:hidden).
   #app gets margin-right:calc(env(safe-area-inset-right) + 3px) for the 3px
   finger-grip clearance, and margin-left for safe-area. This way body's
   overflow:hidden doesn't clip content — the margin creates visible space. */
html{overflow-x:hidden;max-width:100%}
body{font-family:system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;overflow-x:hidden;max-width:100%;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom) 0;touch-action:pan-y;-webkit-tap-highlight-color:transparent}
/* v1.0.7 PHASE 6 FIRST-PRINCIPLES FIX for "right-edge content cut off".
   ROOT CAUSE (after 10+ prior failed attempts): #app used
   `width:100% + margin-right:calc(env(safe-area-inset-right)+3px)`.
   In the CSS box model, `width:100%` makes the element's content-box equal
   to the parent's content-width. Adding a non-zero `margin-right` then
   pushes the element's RIGHT EDGE past the parent's right edge by exactly
   the margin amount. With body's `overflow-x:hidden`, the rightmost 3px+
   of content gets CLIPPED — exactly the "h-file / right edge cut off"
   symptom users reported in both portrait AND landscape.
   FIX: Move the safe-area + 3px grip clearance from MARGIN to PADDING on
   #app. With `box-sizing:border-box`, `width:100%` now INCLUDES the padding,
   so the element's border-box exactly fits the parent (body) content area.
   The content inside #app is then constrained to (100% - padding), and
   nothing overflows. This is the standard responsive-layout pattern.
   We also keep `min-width:0` so flex children can shrink below their
   intrinsic min-content width (the universal flexbox "allow shrink" signal). */
#app{min-height:100vh;display:flex;flex-direction:column;position:relative;z-index:1;overflow-x:hidden;max-width:100%;width:100%;min-width:0;padding-right:calc(env(safe-area-inset-right) + 3px);padding-left:env(safe-area-inset-left);box-sizing:border-box}
#app *{box-sizing:border-box}
/* v1.0.7: Defensive — clamp all direct children of #app to viewport width.
   This is a SAFETY NET; the per-component CSS below already constrains
   widths, but if any single child overshoots, this rule stops it from
   forcing the entire page into horizontal-scroll mode. */
#app > *{max-width:100%;min-width:0;overflow-x:hidden}
.hdr{background:var(--hdr-bg);border-bottom:2px solid var(--border2);padding:10px 16px;position:relative;overflow:hidden}
.hdr-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}
.hdr-l{display:flex;align-items:center;gap:10px}
.hdr h1{font-family:system-ui,-apple-system,sans-serif;font-size:1.3rem;font-weight:900;color:var(--accent2);text-shadow:none;letter-spacing:2px}
.ver{font-size:.6rem;color:var(--accent);background:var(--ev-bg);padding:2px 8px;border-radius:4px;margin-left:6px;border:1px solid var(--border);font-family:system-ui,-apple-system,sans-serif;letter-spacing:1px}
/* v1.0.8 PHASE 22 (third supplement): Theme-aware utility classes for inline-styled
   buttons/chips in ui.js. These replace hardcoded rgba(212,160,23,...) colors so
   the silver light-mode palette applies consistently. Using classes (not inline
   styles) lets CSS variables cascade automatically in both themes. */
.hdr-btn{font-size:.6rem;color:var(--accent);background:var(--ev-bg);padding:2px 8px;border-radius:4px;border:1px solid var(--border);cursor:pointer;font-family:system-ui,-apple-system,sans-serif;letter-spacing:1px}
.hdr-btn-lg{font-size:.65rem;color:var(--accent);background:var(--ev-bg);padding:2px 6px;border-radius:4px;border:1px solid var(--border);cursor:pointer;font-family:system-ui,-apple-system,sans-serif;letter-spacing:1px;flex-shrink:0}
.chip-active{background:var(--btn-a-bg);color:var(--bg);border-color:var(--accent2)}
.chip-inactive{background:var(--ev-bg);color:var(--accent);border-color:var(--border)}
.ev{display:flex;align-items:center;gap:6px;padding:6px 14px;border-radius:6px;background:var(--ev-bg);font-size:.85rem;border:1px solid var(--border);box-shadow:none}
.ev-e{font-size:1.2rem}
.hdr-tools{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.btn{padding:9px 18px;border-radius:6px;border:1px solid var(--border);cursor:pointer;font-family:system-ui,-apple-system,sans-serif;font-size:.85rem;font-weight:600;transition:all .2s cubic-bezier(.4,0,.2,1);background:var(--btn-bg);color:var(--text);min-height:40px;display:inline-flex;align-items:center;gap:4px;box-shadow:var(--btn-shadow);touch-action:manipulation}
/* Active state for engine config tab buttons */
.btn-a{background:var(--btn-a-bg);color:var(--bg);border-color:var(--accent2);box-shadow:none}
.btn-a:hover{background:var(--btn-a-hover);border-color:var(--accent2)}
.btn:hover{background:var(--btn-bg-hover);border-color:var(--accent2);box-shadow:none;transform:translateY(-1px)}
.btn:active{transform:translateY(0);box-shadow:inset 0 2px 4px rgba(0,0,0,.3)}
/* .btn-a: active state for engine config tab buttons */
.btn-g{background:var(--btn-g-bg);border-color:var(--btn-g-border);color:#fff;box-shadow:0 0 2px rgba(46,204,113,.06)}
.btn-p{background:var(--btn-p-bg);border-color:var(--btn-p-border);color:#fff;box-shadow:0 0 2px rgba(93,173,226,.06)}
.btn-p:hover{background:var(--btn-p-hover)}
.btn-s{background:var(--btn-bg);border-color:var(--border)}
.btn-s:hover{background:var(--btn-bg-hover)}
/* v1.0.8 PHASE 48: .btn-compact — content-width button that NEVER stretches
   to fill its flex parent. Use !important to defeat:
   - .dlg-btns .btn{flex:1}           (line ~320, specificity 0,2,0)
   - .dlg:not([style*="max-width"]) > .dlg-btns .btn{flex:1}  (portrait, 0,3,0)
   - any responsive .btn{...} overrides inside @media blocks
   flex:none == flex:0 0 auto but is parsed more reliably by legacy WebView
   builds; combining with width:auto & min-width:0 guarantees content sizing. */
.btn-compact{flex:none !important;flex-grow:0 !important;flex-shrink:0 !important;flex-basis:auto !important;width:auto !important;min-width:0 !important;display:inline-flex !important;white-space:nowrap}
/* v1.0.8 PHASE 50: .btn-row — marker class for multi-button rows inside .dlg-sec.
   The portrait @media rule `.dlg-sec > div[style*="display:flex"]` (specificity
   0,2,1 — 1 class + 1 attribute + 1 type) converts such divs to display:grid
   with grid-template-columns:1fr auto (designed for the label+input row
   pattern). That grid transform STRETCHES buttons into the 1fr column (grid
   default justify-items:stretch), which is why Phase 44/47/48/49's flex-based
   fixes never worked — the buttons were GRID items, not flex items, so
   flex:none / width:auto had no effect on their grid-track sizing.
   .btn-row opts the container OUT of the grid transform. The override lives
   INSIDE the @media(orientation:portrait) block (just after the grid transform
   rule) so it has later source order AND higher specificity (0,3,1) — both
   needed to beat the grid transform's !important declarations. The override
   restores display:flex and neutralizes grid-template-columns, so children are
   laid out by flexbox again and the .btn-compact children shrink to content
   width as designed. Applied to: engine config Export/Import/Restart rows +
   PGN cache filter-chip row + Select All/None toolbar row. */
.btn-row{display:flex;flex-direction:row;flex-wrap:wrap;align-items:center;gap:6px;width:auto;max-width:100%}
.diff-sel{display:flex;gap:2px;background:var(--diffsel-bg);border-radius:6px;padding:3px;border:1px solid var(--border)}
.diff-b{padding:6px 10px;border-radius:4px;border:1px solid transparent;cursor:pointer;font-family:system-ui,-apple-system,sans-serif;font-size:.75rem;font-weight:700;background:transparent;color:var(--muted);transition:all .2s;min-width:30px;text-align:center}
.diff-b.act{background:var(--btn-a-bg);color:var(--bg);border-color:var(--accent2);box-shadow:none}
.diff-b:hover:not(.act){background:rgba(212,160,23,.15);color:var(--text);border-color:var(--border)}
.toggle{display:flex;align-items:center;gap:6px;font-family:system-ui,-apple-system,sans-serif;font-size:.75rem;color:var(--muted);cursor:pointer;padding:6px 10px;border-radius:4px;transition:background .2s;user-select:none}
.toggle:hover{background:var(--mvar-color)}
.toggle-sw{position:relative;width:40px;height:22px;background:var(--toggle-bg);border-radius:11px;border:1px solid var(--border);transition:all .3s;flex-shrink:0}
.toggle-sw.on{background:var(--toggle-on-bg);border-color:var(--accent2);box-shadow:none}
.toggle-sw::after{content:"";position:absolute;top:1px;left:1px;width:16px;height:16px;border-radius:50%;background:var(--toggle-dot);transition:all .3s;box-shadow:var(--toggle-dot-shadow)}
.toggle-sw.on::after{left:19px;background:var(--toggle-dot-on)}
/* v1.0.8 PHASE 25: Small toggle variant for compact toolbars (review header,
   chart global toggle, move-history card). 30x16 switch with a 12px dot.
   The default ::after (16px dot, left:1px/19px) overflows a 30px-wide switch;
   this variant sizes the dot and travel correctly for the smaller switch. */
.toggle-sw.sm{width:30px;height:16px;border-radius:8px}
.toggle-sw.sm::after{width:12px;height:12px;top:1px;left:1px}
.toggle-sw.sm.on::after{left:17px}
.main{display:flex;flex:1;gap:14px;padding:14px;justify-content:center;flex-wrap:wrap}
.bsec{display:flex;flex-direction:column;gap:8px}
.pbar{display:flex;align-items:center;gap:10px;padding:8px 14px;background:var(--btn-bg);border-radius:6px;border:1px solid var(--border);box-shadow:inset 0 1px 0 rgba(255,215,0,.05);max-width:100%;overflow:hidden}
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
.bwrap{position:relative;border:4px solid var(--border2);border-radius:4px;overflow:hidden;box-shadow:var(--panel-shadow);background:var(--bwrap-bg);transform:translateZ(0)}
/* v1.0.4 ROUND-5 REV12: Removed will-change:transform from .bgrid — it was
   promoting the ENTIRE 8x8 grid to a GPU layer, causing jank on high-end
   displays. Only individual .move-anim elements need GPU promotion. */
/* v1.0.7 PHASE 17 (Kimi audit suggestion 2.1 — adopted, with caveat):
   Added `content-visibility:auto` so when the board is scrolled off-screen
   (e.g. long stats panels on small phones, or future split-view layouts)
   the browser skips its rendering work. We do NOT add `contain:strict`
   because .bgrid's grid sizing depends on its parent .bwrap (which itself
   is sized by JS via CELL px). `contain:strict` would freeze the grid's
   intrinsic size and break the responsive CELL recalculation. The .sq
   cells already have `contain:layout style paint` so child-paint cost is
   already optimized. */
.bgrid{display:grid;transform:translateZ(0);touch-action:none;backface-visibility:hidden;content-visibility:auto;contain-intrinsic-size:auto}
.sq{display:flex;align-items:center;justify-content:center;cursor:pointer;position:relative;user-select:none;font-size:2rem;line-height:1;transition:background .15s;touch-action:manipulation;contain:layout style paint;transform:translateZ(0)}
.sq:hover{background-color:var(--sq-hover)}
.sq .lbl{position:absolute;top:1px;left:2px;font-size:9px;opacity:.95;font-family:"DejaVu Sans",system-ui,sans-serif;pointer-events:none;z-index:2;letter-spacing:0}
/* === 黑曜石棋子 — 清晰轮廓、全局可辨 === */
/* 黑子: 深曜石底色 + 亮金描边 + 亮金微光 (深色格上描边醒目可辨) */
/* 白子: 银曜石底色 + 浓棕描边 + 浓棕微光 (浅色格上描边醒目可辨) */
.sq .pc{pointer-events:none;font-size:2rem;z-index:1;position:relative;font-variant-emoji:text;-webkit-font-variant-emoji:text;font-family:'DejaVu Sans','Noto Sans','Segoe UI Symbol',sans-serif;font-weight:400;speak:none;transform:translateZ(0);backface-visibility:hidden}
.sq:hover .pc{transform:scale(1.05) translateZ(0)}
/* 黑子 — 深曜石：亮金描边 + 亮金微光 (深/浅色背景上均可辨) */
.sq .pc.bk,.prom-btn.bk-prom,.setup-btn.sb,.move-anim.bk-piece,.rv-bk{color:#1A1A2E;-webkit-text-stroke:.3px rgba(255,230,150,.85);text-shadow:0 0 .8px rgba(255,230,150,.55)}
/* 白子 — 银曜石：浓棕描边 + 浓棕微光 (深/浅色背景上均可辨) */
.sq .pc.w,.prom-btn.w-prom,.setup-btn.sw,.move-anim.w-piece,.rv-w{color:#E8E8F0;-webkit-text-stroke:.3px rgba(30,15,0,.85);text-shadow:0 0 .8px rgba(30,15,0,.55)}
/* 复盘棋子：字体与棋盘一致，避免字形跳变 */
.rv-w,.rv-bk{font-family:'DejaVu Sans','Noto Sans','Segoe UI Symbol',sans-serif;font-variant-emoji:text;-webkit-font-variant-emoji:text;font-weight:400}
.sq .dot{width:18px;height:18px;border-radius:50%;background:radial-gradient(circle,rgba(255,140,0,.6),rgba(255,140,0,.35));pointer-events:none;z-index:1;box-shadow:0 0 3px rgba(255,140,0,.2)}
.sq .ring{position:absolute;inset:3px;border-radius:50%;border:3px solid rgba(255,140,0,.55);pointer-events:none;z-index:1;box-shadow:0 0 2px rgba(255,140,0,.10)}
/* v1.0.6: Castling rook marker — golden dashed ring. Distinct from the orange
   capture ring (.ring) so the user can tell "click to castle" apart from
   "click to capture". Uses the same gold (#ffd700) as the app's accent color
   to maintain visual consistency with the toolbar/headers. Dashed border
   (3px, dash 6px/gap 4px) signals "special move" — a convention from
   chess.com/lichess where castling indicators use dashed outlines. */
.sq .castle-ring{position:absolute;inset:3px;border-radius:50%;border:3px dashed var(--castle-ring);pointer-events:none;z-index:2;box-shadow:0 0 4px rgba(255,215,0,.5),inset 0 0 3px rgba(255,215,0,.3);animation:castlePulse 1.5s ease-in-out infinite}
@keyframes castlePulse{0%,100%{box-shadow:0 0 4px rgba(255,215,0,.5),inset 0 0 3px rgba(255,215,0,.3)}50%{box-shadow:0 0 8px rgba(255,215,0,.8),inset 0 0 5px rgba(255,215,0,.5)}}
/* v1.0.8 PHASE 22: Landing animation keyframes removed — piece-move
     motion is now driven by Web Animations API in animateMove() (see
     game-logic.js). CSS only handles:
     - .sq.in-check: pulsing red glow on the checked king's square
     - .bwrap.shake-light / .shake-heavy: board tremor on rook/king landing
   The old per-piece landing keyframes (pawnStep/knightJump/bishopGlide/
   rookSlide/queenGlide/kingStep) and capture-flash keyframes are removed
   because the new animation system handles landing impact via board shake
   + Web Animations API scale keyframes. */
/* Check animation on king — pulsing red glow + background tint */
.sq.in-check{animation:checkPulse 1.2s ease-in-out infinite;position:relative;z-index:1;transform:translateZ(0);will-change:box-shadow}
.sq.in-check::before{content:'';position:absolute;inset:0;animation:checkBgPulse 1.2s ease-in-out infinite;border-radius:inherit;z-index:-1;}
@keyframes checkPulse{
  0%,100%{box-shadow:inset 0 0 6px rgba(192,57,43,.4),0 0 4px rgba(192,57,43,.2),inset 0 0 20px rgba(192,57,43,.06)}
  50%{box-shadow:inset 0 0 18px rgba(192,57,43,.65),0 0 12px rgba(192,57,43,.35),0 0 4px rgba(255,0,0,.15),inset 0 0 40px rgba(192,57,43,.18)}}
@keyframes checkBgPulse{
  0%,100%{background:rgba(192,57,43,0)}
  50%{background:rgba(192,57,43,.22)}}
/* v1.0.8 PHASE 22: Board shake on piece landing (rook = light, king = heavy).
   v1.0.8 PHASE 26: queen = massive (heaviest, > king's heavy).
   Triggered by _triggerBoardShake() in game-logic.js. Uses void offsetWidth
   trick to restart the animation on rapid successive calls. */
.bwrap.shake-light{animation:shakeLight .28s cubic-bezier(.36,.07,.19,.97)}
.bwrap.shake-heavy{animation:shakeHeavy .45s cubic-bezier(.36,.07,.19,.97)}
.bwrap.shake-massive{animation:shakeMassive .62s cubic-bezier(.36,.07,.19,.97)}
@keyframes shakeLight{
  0%,100%{transform:translate3d(0,0,0)}
  20%{transform:translate3d(-2px,1px,0)}
  40%{transform:translate3d(2px,-1px,0)}
  60%{transform:translate3d(-1px,1px,0)}
  80%{transform:translate3d(1px,-1px,0)}}
@keyframes shakeHeavy{
  0%,100%{transform:translate3d(0,0,0)}
  10%{transform:translate3d(-3px,2px,0)}
  25%{transform:translate3d(4px,-2px,0)}
  40%{transform:translate3d(-4px,2px,0)}
  55%{transform:translate3d(3px,-2px,0)}
  70%{transform:translate3d(-2px,1px,0)}
  85%{transform:translate3d(1px,-1px,0)}}
/* v1.0.8 PHASE 26: shakeMassive — the heaviest shake, for queen landing.
   Larger amplitude (±6px) and longer decay than shakeHeavy. The queen is
   the most powerful piece; her landing should feel "掷地有声" (ground-shaking). */
@keyframes shakeMassive{
  0%,100%{transform:translate3d(0,0,0)}
  8%{transform:translate3d(-5px,3px,0)}
  18%{transform:translate3d(6px,-3px,0)}
  30%{transform:translate3d(-6px,4px,0)}
  42%{transform:translate3d(5px,-3px,0)}
  54%{transform:translate3d(-4px,2px,0)}
  66%{transform:translate3d(3px,-2px,0)}
  78%{transform:translate3d(-2px,1px,0)}
  90%{transform:translate3d(1px,-1px,0)}}
/* Board square baroque textures */
.panel{width:280px;display:flex;flex-direction:column;gap:10px}
.card{background:var(--card);border:1px solid var(--border);border-radius:6px;padding:12px;overflow:hidden;box-shadow:inset 0 1px 0 rgba(255,215,0,.05)}
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
.mrow{display:flex;gap:4px;padding:3px 0;border-bottom:1px solid var(--mnum-color)}
.mnum{color:var(--muted);min-width:22px;font-weight:700}
.mw,.mb{padding:1px 5px;border-radius:3px;min-width:40px}
.mvar{font-size:.6rem;color:var(--accent);font-style:italic;padding:1px 5px 1px 26px;line-height:1.4;border-bottom:1px solid rgba(212,160,23,.05);cursor:pointer}
.hint-area{background:var(--card);border:1px solid var(--accent2);border-radius:6px;padding:10px 12px;position:relative;overflow:hidden;box-shadow:none}
.hint-text{font-family:system-ui,-apple-system,sans-serif;font-size:.8rem;color:var(--accent2);margin-top:4px;line-height:1.5}
/* v1.0.7: .dov (dialog overlay) — position:fixed covering full viewport.
   Uses padding to respect safe-area + 3px finger-grip clearance. The dialog
   inside is centered via justify-content:center. */
.dov{position:fixed;inset:0;background:var(--overlay-bg);display:flex;align-items:center;justify-content:center;z-index:300;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);overflow-x:hidden;padding:10px calc(env(safe-area-inset-right) + 3px) 10px env(safe-area-inset-left);box-sizing:border-box}
/* v1.0.7: .dlg base — width:100% so dialog fills overlay content area.
   max-width:500px prevents it from getting too wide on tablets.
   box-sizing:border-box so padding is included in width.
   margin:0 auto for centering (works with justify-content:center).
   v1.0.7 FIRST-PRINCIPLES FIX for "dialog not centered / cut off on right
   side of slim phones": The previous attempt used max-width:500px on the
   base and max-width:600px inside the portrait media query. On ultra-tall
   phones with CSS viewport ~360-420px, BOTH values leave the dialog
   narrower than the viewport, but the right-side asymmetry reported by
   the user (left=24px, right=732px in the screenshot) suggests the dialog
   was being left-aligned. Root cause: when a flex item has `width:100%`
   inside a `justify-content:center` flex container, AND the item's
   max-width is < container width, the item's `margin:0 auto` is what
   actually centers it horizontally. If margin:auto fails (e.g. due to
   a parent's `padding` asymmetry), the dialog snaps left.
   Fix: use `margin-left:auto; margin-right:auto` explicitly (not the
   shorthand `margin:0 auto` which sets top/bottom to 0 — this can interact
   badly with flex item alignment). Also add `align-self:center` as a
   belt-and-suspenders fallback for flex item alignment. */
.dlg{background:var(--card);border:2px solid var(--border2);border-radius:10px;padding:24px;max-width:500px;width:100%;max-height:85vh;overflow-y:auto;overflow-x:hidden;box-shadow:0 0 6px rgba(212,160,23,.06),0 6px 16px rgba(0,0,0,.40);position:relative;box-sizing:border-box;margin-left:auto;margin-right:auto;align-self:center}
.dlg h2{font-family:system-ui,-apple-system,sans-serif;font-size:1.2rem;font-weight:900;margin-bottom:14px;color:var(--accent2);letter-spacing:2px;text-shadow:0 0 3px rgba(255,215,0,.06)}
.dlg-sec{margin-bottom:14px}
.dlg-sec h3{font-family:system-ui,-apple-system,sans-serif;font-size:.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px}
.clr-row{display:flex;gap:10px;margin-bottom:8px}
.clr-btn{flex:1;padding:14px;border-radius:6px;border:1px solid var(--border);background:var(--btn-bg);cursor:pointer;text-align:center;transition:all .2s;color:var(--text);font-family:system-ui,-apple-system,sans-serif}
.clr-btn.act{border-color:var(--accent2);background:rgba(212,160,23,.15);box-shadow:none}
.clr-btn:hover{border-color:var(--accent);box-shadow:none}
.clr-ico{font-size:1.5rem;margin-bottom:2px}
.clr-nm{font-size:.85rem;font-weight:700}
.clr-sub{font-size:.65rem;color:var(--muted)}
.op-list{display:flex;flex-direction:column;gap:3px;max-height:200px;overflow-y:auto}
.op-btn{padding:8px 10px;border-radius:4px;border:1px solid var(--border);background:var(--btn-bg);cursor:pointer;text-align:left;transition:all .2s;color:var(--text);font-family:system-ui,-apple-system,sans-serif}
.op-btn.act{border-color:var(--accent2);background:rgba(212,160,23,.1);box-shadow:none}
.op-btn:active{transform:scale(.98);background:var(--op-active-bg)}
.on{font-size:.8rem;font-weight:700}
.os{font-size:.65rem;color:var(--muted)}
.dlg-btns{display:flex;gap:10px;margin-top:16px}
.dlg-btns .btn{flex:1;padding:12px;justify-content:center}
.prom-dov{position:fixed;inset:0;background:var(--overlay-bg);display:flex;align-items:center;justify-content:center;z-index:110;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
.prom-dlg{background:var(--card);border:2px solid var(--border2);border-radius:8px;padding:18px;text-align:center;box-shadow:none}
.prom-dlg h3{margin-bottom:12px;font-family:system-ui,-apple-system,sans-serif;font-size:1rem;color:var(--accent2)}
.prom-row{display:flex;gap:10px}
.prom-btn{width:56px;height:56px;font-size:2rem;border-radius:6px;border:1px solid var(--border);background:var(--btn-bg);cursor:pointer;transition:all .2s;font-family:'DejaVu Sans','Noto Sans','Segoe UI Symbol',sans-serif;font-variant-emoji:text;-webkit-font-variant-emoji:text}

.prom-btn:hover{background:var(--btn-bg-hover);border-color:var(--accent2);transform:scale(1.1);box-shadow:none}
.setup-panel{display:flex;flex-direction:column;gap:8px;padding:12px;background:var(--card);border:1px solid var(--border);border-radius:6px;margin-top:8px}
.setup-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center;justify-content:center}
.setup-label{font-size:.75rem;color:var(--muted);min-width:48px;text-align:right;font-family:system-ui,-apple-system,sans-serif}
.setup-btn{width:44px;height:44px;font-size:1.8rem;border-radius:4px;border:1px solid var(--border);background:var(--btn-bg);cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center;font-family:'DejaVu Sans','Noto Sans','Segoe UI Symbol',sans-serif;font-variant-emoji:text;-webkit-font-variant-emoji:text}

.setup-btn.act{border-color:var(--accent2);background:rgba(212,160,23,.15);transform:scale(1.05);box-shadow:none}
.setup-btn:hover{border-color:var(--accent);background:rgba(212,160,23,.08)}
.setup-clr{width:64px;height:36px;font-size:.78rem;border-radius:4px;border:1px solid var(--border);cursor:pointer;transition:all .2s;font-weight:700;font-family:system-ui,-apple-system,sans-serif;background:var(--btn-bg);color:var(--text)}
.setup-clr.act{border-color:var(--accent2);background:rgba(212,160,23,.15)}
.setup-del{width:44px;height:44px;font-size:1.2rem;border-radius:4px;border:2px solid var(--danger);background:rgba(192,57,43,.1);color:var(--danger);cursor:pointer;transition:all .2s}
.setup-del:hover{background:var(--setup-del-hover);transform:scale(1.05)}
/* v1.0.7 PHASE 6: selected state for the delete button — same highlight
   style as .setup-btn.act (gold border + tinted background), but keeping
   the red icon color so the user knows it's the delete tool. */
.setup-del.act{border-color:var(--accent2);background:rgba(212,160,23,.15);transform:scale(1.05);box-shadow:none}
.setup-errors{background:rgba(192,57,43,.12);border:2px solid var(--danger);border-radius:6px;padding:12px;margin:8px 0;font-size:.8rem;color:var(--setup-err-color);font-family:system-ui,-apple-system,sans-serif}
.setup-errors strong{color:var(--setup-err-color);display:block;margin-bottom:6px;font-size:.85rem;font-weight:700}
.setup-errors ul{margin:4px 0;padding-left:18px}
.setup-errors li{margin:3px 0;color:var(--setup-err-color);font-weight:500}
/* v1.0.8 PHASE 29: Standardized placeholder color for ALL inputs. Previously
   inputs inherited the browser-default 50%-opacity text color for placeholders,
   which in light mode produced a near-invisible #96969a on the #f0f0f3 card.
   Now --placeholder is explicitly defined per theme (dark: #c0a070 warm muted,
   light: #4a4a52 deep slate) and applied globally via ::placeholder with
   opacity:1 so the variable's value is used verbatim (no browser alpha hack). */
::placeholder{color:var(--placeholder);opacity:1}
::-webkit-input-placeholder{color:var(--placeholder);opacity:1}
:-ms-input-placeholder{color:var(--placeholder);opacity:1}
.gover{position:absolute;inset:0;background:var(--overlay-bg);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:20;border-radius:4px;gap:10px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);animation:gameOverFade 1.6s ease-out}
.ge{font-size:3.5rem;animation:gameOverIcon 1.2s cubic-bezier(.2,-.2,.2,1.2)}
.gt{font-family:system-ui,-apple-system,sans-serif;font-size:1.2rem;font-weight:900;color:var(--accent2);text-shadow:0 0 3px rgba(255,215,0,.08);letter-spacing:2px;animation:gtAnim 1.6s ease-out .3s both}
.gover .btn{min-width:120px;justify-content:center;animation:gtAnim 1.6s ease-out .6s both}
.review-overlay{position:fixed;inset:0;background:var(--overlay-bg);z-index:200;display:flex;flex-direction:column}
/* v1.0.8 PHASE 26: review header gets safe-area top + bottom padding for
   notch/cutout/R-corner screens. The overlay covers the full viewport
   (inset:0), so the header must reserve space for the status bar / notch. */
.review-hdr{display:flex;align-items:center;justify-content:space-between;padding:calc(14px + env(safe-area-inset-top)) calc(18px + env(safe-area-inset-right)) 14px calc(18px + env(safe-area-inset-left));background:var(--card);border-bottom:2px solid var(--border2)}
.review-hdr h2{font-family:system-ui,-apple-system,sans-serif;font-size:1rem;font-weight:700;color:var(--accent2);letter-spacing:2px}
.review-body{display:flex;flex:1;overflow:hidden}
.review-board{flex-shrink:0;padding:12px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:8px;position:relative}
/* v1.0.4 Round-5 Rev48: position:relative so the SVG arrow overlay (absolute)
   anchors to .review-board, not the viewport. */
/* P0: Review-left wraps board + controls; in portrait it stacks naturally,
   in landscape it becomes the left column via media query. */
.review-left{display:flex;flex-direction:column;align-items:center;gap:8px}
.review-moves{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:4px;-webkit-overflow-scrolling:touch}
.rmv-block{padding:10px 14px;border-radius:6px;background:var(--btn-bg);border:1px solid var(--border);cursor:pointer;transition:all .2s;display:flex;align-items:flex-start;gap:8px;font-family:system-ui,-apple-system,sans-serif;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;touch-action:manipulation}
.rmv-block:hover{border-color:var(--accent);background:rgba(212,160,23,.08);box-shadow:none}
.rmv-block.act{border-color:var(--accent2);background:rgba(212,160,23,.12);box-shadow:0 0 3px rgba(212,160,23,.08)}
.rmv-num{font-size:.75rem;color:var(--muted);min-width:28px;font-weight:700;padding-top:2px}
.rmv-notation{font-size:.95rem;font-weight:700;flex:1}
.rmv-detail{display:flex;flex-direction:column;flex:1}
/* v1.0.3-p10: review nav buttons stretch full width in ALL orientations */
.review-nav{display:flex;gap:4px;width:100%}
.review-nav .btn{flex:1 1 0;min-width:0;justify-content:center}
::-webkit-scrollbar{width:5px}
::-webkit-scrollbar-track{background:var(--scrollbar-track)}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:var(--accent)}
/* Navigation UI */
/* v1.0.7 PHASE 3 — PORTRAIT UI COMPLETE REDESIGN (from-scratch).
   Previous attempts used `@media(max-width:Npx) and (orientation:portrait)`
   with various N values (900, 1200). All failed on certain devices because
   the CSS viewport width depends on DPR and Android's density crop modes,
   which can produce values like 412, 480, 915, or 1220px on what are all
   "portrait phones". Hard-coded width thresholds cannot reliably classify
   these devices.
   First-principles fix: use `@media(orientation:portrait)` with NO width
   threshold. ANY portrait orientation is a portrait layout, period. The
   width-specific tweaks (font-size, padding) are now driven by
   aspect-ratio media queries (which are DPR-independent) and by
   `vw`-relative units (which scale with the actual viewport width).
   This means:
   - A 360×800 phone (DPR 2.0) gets the same portrait layout as
   - A 1220×2712 phone (DPR 2.625, CSS viewport 465×1035) — both are portrait.
   The layout adapts to the CSS viewport via vw units, not via hard-coded
   pixel breakpoints. */
@media(orientation:portrait){
  /* Layout: vertical stack. Board on top, panel below. No side-by-side. */
  .main{flex-direction:column;align-items:center;gap:8px;padding:8px}
  .panel{width:100%;max-width:520px;margin:0 auto}
  .bsec{align-self:center;max-width:100%}
  /* Header: compact single column with wrapping toolbar. */
  .hdr{padding:6px 8px;overflow:hidden}
  .hdr-top{flex-wrap:wrap;gap:4px;margin-bottom:2px}
  .hdr-l{flex:0 1 auto;min-width:0;overflow:hidden}
  .hdr h1{font-size:1rem;letter-spacing:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .ver{font-size:.55rem;padding:1px 6px;margin-left:4px}
  .hdr-tools{gap:4px;flex-wrap:wrap;min-width:0}
  .hdr-tools .btn{min-width:0;padding:5px 8px;font-size:.7rem;min-height:30px}
  .btn{padding:5px 8px;font-size:.7rem;min-height:30px}
  /* Eval display: full-width row below the title. Content wraps. */
  .ev{flex:1 1 100%;min-width:0;max-width:100%;overflow:hidden;flex-wrap:wrap;font-size:.72rem;padding:4px 8px;gap:4px;order:99}
  .ev-e{font-size:.95rem}
  .ev span{white-space:nowrap}
  /* Difficulty selector: wraps to multiple rows on narrow screens. */
  .diff-sel{flex-wrap:wrap;max-width:100%;gap:2px;padding:2px}
  .diff-b{padding:4px 7px;font-size:.68rem;min-width:24px}
  /* Board container: v1.0.7 PHASE 5 — removed margin-right:6px because
     _recalcCellSize already reserves the anti-shake clearance in CELL
     calculation (the _antiShake=6 term in _rightClearance). Adding a
     6px margin on top of that would double-count the clearance and make
     the board smaller than necessary. The border is slightly thinner in
     portrait to maximize board area. */
  .bwrap{border-width:3px}
  /* Review mode: stacked layout in portrait. */
  /* v1.1.0 Phase 53: Add overflow-y:auto + max-height so .review-bottom
     controls are reachable by scrolling (same as landscape). Previously,
     portrait had no scroll on .review-body, so if the board + moves
     filled the viewport, the chart/slider/nav buttons were cut off. */
  .review-body{flex-direction:column;overflow-y:auto;overflow-x:hidden;max-height:calc(100vh - 28px)}
  .review-board{padding:6px}
  /* Quick Toolbar (v1.0.7 PHASE 3): compact in portrait. */
  .qtoolbar{gap:4px;padding:5px 6px}
  .qtoolbar .btn{padding:5px 8px;font-size:.7rem;min-height:30px}
  /* Setup-mode marker badges: smaller in portrait. */
  .setup-castle-mark,.setup-ep-mark{font-size:.85rem;bottom:1px;right:1px}
  /* === DIALOG (New Game Settings, etc.) — v1.0.7 PHASE 7 from-scratch redesign ===
     Goal: dialog fills the ENTIRE .dov content area (which already accounts
     for safe-area + 3px grip via .dov's padding). The Cancel / Start buttons
     are pinned to the bottom as a sticky footer, so the content area above
     can use the full width without competing with the buttons for horizontal
     space.
     Layout:
       .dlg (flex column, fills .dov content)
       ├─ h2 (header, fixed)
       ├─ .dlg-content (scrollable, flex:1)
       │   └─ .dlg-sec × N
       └─ .dlg-btns (sticky footer, fixed, full width)
     This is the standard mobile-app modal pattern and uses screen space
     efficiently — no wasted horizontal space next to the buttons.
     v1.0.7 PHASE 7 FIX: use width:100%;height:100% (NOT 100vh) so the dialog
     fills .dov's content area, not the raw viewport. The previous height:100vh
     caused the dialog to overflow .dov's padding, making buttons appear
     outside the dialog window.
     v1.0.7 PHASE 20 (UX): Only the FULLSCREEN dialog (New Game Settings, which
     has NO inline max-width) gets height:100%. Smaller dialogs (resign, about,
     import, save-pgn, pgn-cache — all have inline style="max-width:Npx") keep
     their natural content height and are positioned "slightly above center"
     by the .dov asymmetric padding rule (see Phase 21 fix below). */
  .dlg:not([style*="max-width"]){max-width:100%;width:100%;height:100%;max-height:100%;padding:0;margin:0;border-radius:0;border:none;display:flex;flex-direction:column;overflow:hidden;align-self:stretch}
  /* v1.0.7 PHASE 21 (bug fix): Fullscreen dialog cancels the .dov asymmetric
     padding (padding-top:10px + padding-bottom:12vh) so it truly fills the
     entire overlay (not just the content area between paddings). Negative
     margins on all four sides cancel .dov's padding + safe-area insets. */
  .dlg:not([style*="max-width"]){margin-top:-10px;margin-bottom:calc(-12vh);margin-left:calc(-1 * (env(safe-area-inset-right) + 3px));margin-right:calc(-1 * env(safe-area-inset-left))}
  .dlg:not([style*="max-width"]) > h2{padding:14px 16px 10px;margin:0;border-bottom:2px solid var(--border2);flex-shrink:0;background:var(--card);position:sticky;top:0;z-index:2}
  .dlg:not([style*="max-width"]) > .dlg-content{flex:1 1 auto;overflow-y:auto;padding:12px 14px;-webkit-overflow-scrolling:touch;min-height:0}
  .dlg:not([style*="max-width"]) > .dlg-btns{display:flex;gap:8px;padding:10px 14px;border-top:2px solid var(--border2);background:var(--card);margin:0;flex:0 0 auto}
  .dlg:not([style*="max-width"]) > .dlg-btns .btn{flex:1;padding:14px;font-size:.9rem;min-height:44px;justify-content:center}
  /* v1.0.7 PHASE 6: when .dlg-content wrapper is NOT used (older dialogs
     like About / Import / Resign that put .dlg-sec directly inside .dlg),
     fall back to the old scrollable behavior. */
  .dlg > .dlg-sec{padding:0 14px}
  .dlg > .dlg-sec:first-of-type{padding-top:12px}
  .dlg h2{font-size:1.05rem;margin-bottom:10px;letter-spacing:1.5px;overflow-wrap:break-word}
  .dlg-sec{margin-bottom:12px;max-width:100%}
  .dlg-sec h3{font-size:.7rem;letter-spacing:1.2px;margin-bottom:6px}
  .clr-row{gap:8px;margin-bottom:6px}
  .clr-btn{padding:10px 6px;min-width:0}
  .clr-ico{font-size:1.3rem}
  .clr-nm{font-size:.78rem}
  .clr-sub{font-size:.6rem}
  .op-list{max-height:50vh;overflow-x:hidden;overflow-y:auto}
  .op-btn{padding:6px 8px;max-width:100%}
  .on{font-size:.76rem;overflow-wrap:break-word;word-break:break-word}
  .os{font-size:.62rem}
  .dlg-btns{margin-top:12px}
  .dlg-btns .btn{padding:10px;font-size:.82rem;min-width:0}
  /* ALL inputs/selects/forms inside .dlg-sec: force full width. */
  .dlg-sec input[type="number"],
  .dlg-sec input[type="text"],
  .dlg-sec select,
  .dlg-sec form,
  .dlg-sec form > input{
    width:100%!important;
    max-width:100%!important;
    min-width:0!important;
    flex:1 1 100%!important;
    flex-basis:100%!important;
    box-sizing:border-box!important;
  }
  .dlg-sec input[type="number"]{padding:6px 10px;text-align:left}
  /* v1.0.7 PHASE 7: Portrait dialog layout — better space utilization.
     Uses a 2-column grid for label+input rows (label on left, input on right).
     v1.0.7 PHASE 7 FIX: ECO search row (which contains a form + select) now
     stacks vertically — search box full width on top, family filter below —
     instead of being forced into a 2-column grid that clipped the search box.
     The grid layout is only applied to rows that have a label + input pattern. */
  .dlg-sec > div.portrait-stack,
  .dlg-sec > div[style*="display:flex"]{
    display:grid!important;
    grid-template-columns:1fr auto!important;
    align-items:center!important;
    gap:8px 12px!important;
    max-width:100%!important;
  }
  .dlg-sec > div.portrait-stack > *,
  .dlg-sec > div[style*="display:flex"] > *{
    max-width:100%!important;
    min-width:0!important;
    width:auto!important;
    flex:0 0 auto!important;
  }
  /* Labels take the left column (1fr), inputs/buttons take the right (auto). */
  .dlg-sec > div.portrait-stack > label,
  .dlg-sec > div[style*="display:flex"] > label{
    grid-column:1;
    width:100%!important;
  }
  .dlg-sec > div.portrait-stack > form,
  .dlg-sec > div[style*="display:flex"] > form{
    /* v1.0.7 PHASE 7: form (ECO search box) gets FULL width on its own row. */
    grid-column:1/-1;
    width:100%!important;
    display:flex!important;
    gap:4px;
    max-width:100%!important;
  }
  .dlg-sec > div.portrait-stack > input[type="number"],
  .dlg-sec > div[style*="display:flex"] > input[type="number"]{
    grid-column:2;
    width:90px!important;
    max-width:40%!important;
    text-align:center;
  }
  .dlg-sec > div.portrait-stack > input[type="text"],
  .dlg-sec > div[style*="display:flex"] > input[type="text"]{
    grid-column:1/-1;
    width:100%!important;
  }
  .dlg-sec > div.portrait-stack > select,
  .dlg-sec > div[style*="display:flex"] > select{
    /* v1.0.7 PHASE 7: select (ECO family filter) gets FULL width on its own row. */
    grid-column:1/-1;
    width:100%!important;
    max-width:100%!important;
  }
  .dlg-sec > div.portrait-stack > .btn,
  .dlg-sec > div[style*="display:flex"] > .btn{
    grid-column:2;
    justify-content:center;
    width:auto!important;
  }
  /* v1.0.8 PHASE 50: .btn-row override — multi-button rows opt OUT of the grid
     transform above. The grid transform (specificity 0,2,1) is designed for the
     label+input row pattern; when a row contains ONLY buttons (engine config
     Export/Import/Restart, PGN cache filter chips, PGN cache Select All/None),
     the grid's 1fr column stretches every button to full row width. This
     override restores display:flex so the row is a flexbox again and the
     .btn-compact children shrink to content width.
     Specificity: .dlg-sec(1) + div(1 type) + [style*](1 attr) + .btn-row(1) =
     (0,3,1) > grid transform (0,2,1), AND this rule comes LATER in source
     order, so both specificity and source-order tiebreaks favor it. */
  .dlg-sec > div.btn-row,
  .dlg-sec > div.portrait-stack.btn-row,
  .dlg-sec > div[style*="display:flex"].btn-row{
    display:flex!important;
    grid-template-columns:none!important;
    grid-auto-flow:row!important;
    flex-direction:row!important;
    flex-wrap:wrap!important;
    align-items:center!important;
    width:auto!important;
    max-width:100%!important;
  }
  /* v1.0.8 PHASE 50: .btn-compact children of a .btn-row must keep content width.
     The grid-item `> *` rule above (line ~548) sets flex:0 0 auto (harmless in a
     flex context), but we reinforce content-width sizing here for clarity. */
  .dlg-sec > div.btn-row > .btn-compact{
    flex:none!important;
    width:auto!important;
    min-width:0!important;
  }
  /* Nested flex sub-wrappers (Chess960 input+🎲): keep side-by-side, spanning
     both grid columns. */
  .dlg-sec > div.portrait-stack > div[style*="display:flex"],
  .dlg-sec > div[style*="display:flex"] > div[style*="display:flex"]{
    grid-column:1/-1;
    flex-direction:row!important;
    max-width:100%!important;
    display:flex!important;
  }
  .dlg-sec > div.portrait-stack > div[style*="display:flex"] > *,
  .dlg-sec > div[style*="display:flex"] > div[style*="display:flex"] > *{
    min-width:0!important;
  }
  /* ECO search row: search box + family filter now stack vertically (each
     full width). The .op-list below gets a taller max-height. */
  .dlg-sec .op-list{max-height:40vh}
  /* Chess960 back-rank preview grid: constrain to dialog width. */
  .dlg-sec div[style*="grid-template-columns:repeat(8,1fr)"]{
    max-width:100%!important;
  }
  /* About dialog: .crow rows stack vertically. */
  .dlg .crow{flex-direction:column;gap:2px;align-items:stretch;max-width:100%}
  .dlg .crow .lb{font-size:.7rem}
  .dlg .crow .vl{font-size:.8rem;overflow-wrap:break-word}
}
/* v1.0.7 PHASE 3: Width-relative adjustments inside portrait.
   Use vw units so font sizes scale with the actual viewport width —
   no hard-coded pixel thresholds. The clamp() function ensures the
   sizes stay within readable bounds on extreme aspect ratios. */
@media(orientation:portrait){
  .hdr h1{font-size:clamp(.85rem, 3.6vw, 1.1rem)}
  .btn{font-size:clamp(.65rem, 2.8vw, .8rem);padding:clamp(4px, 1.4vw, 7px) clamp(7px, 2.4vw, 11px)}
  .diff-b{font-size:clamp(.6rem, 2.5vw, .75rem);padding:clamp(3px, 1vw, 5px) clamp(6px, 2vw, 9px)}
  .ev{font-size:clamp(.65rem, 2.8vw, .82rem)}
  .ev-e{font-size:clamp(.85rem, 3.5vw, 1.1rem)}
  .pname{font-size:clamp(.7rem, 3vw, .9rem)}
  .qtoolbar .btn{font-size:clamp(.65rem, 2.8vw, .8rem)}
  /* v1.0.7 PHASE 21 (bug fix): Portrait dialog positioning — "slightly above
     center" (弹窗中心约在屏幕 45vh 处).
     PREVIOUS Phase 20 attempt used padding-top:18vh + padding-bottom:10px with
     align-items:center. That placed the dialog center at 18 + (100-18-1)/2 ≈ 59vh
     — i.e. BELOW center, not above. User reported "中央稍偏下".
     CORRECT FIX: use align-items:center with padding-top:10px (small) and
     padding-bottom:12vh (large). The effective content area is
     [10px .. 100vh-12vh], whose center is at 10px + (88vh-10px)/2 ≈ 44vh.
     This places the dialog center at ~44vh = "slightly above center".
     Math: center = P_top + (100vh - P_top - P_bottom) / 2
                     = 10px + (100vh - 10px - 12vh) / 2
                     = 10px + (88vh - 10px) / 2
                     ≈ 10px + 44vh - 5px = 44vh + 5px.
     The fullscreen dialog (New Game Settings) uses negative margins to cancel
     both paddings so it truly fills 100vh. */
  .dov{align-items:center;padding-top:10px;padding-bottom:12vh}
}
/* v1.0.7 PHASE 3: Ultra-narrow portrait (<360px CSS viewport, e.g., Sony 21:9).
   Further compact spacing. */
@media(orientation:portrait) and (max-width:360px){
  .hdr{padding:4px 6px}
  .hdr h1{font-size:.85rem;letter-spacing:.5px}
  .ver{font-size:.5rem;padding:1px 4px;margin-left:3px}
  .ev{font-size:.65rem;padding:3px 6px;gap:3px}
  .ev-e{font-size:.85rem}
  .diff-b{padding:3px 6px;font-size:.62rem;min-width:20px}
  .btn{padding:4px 7px;font-size:.65rem;min-height:28px}
  .hdr-tools{gap:2px}
  .dlg{padding:12px 10px}
  .dlg h2{font-size:.95rem;letter-spacing:1px;margin-bottom:8px}
  .dlg-sec{margin-bottom:10px}
  .dlg-sec h3{font-size:.68rem;margin-bottom:5px}
  .clr-btn{padding:8px 4px}
  .clr-ico{font-size:1.2rem}
  .clr-nm{font-size:.72rem}
  .clr-sub{font-size:.58rem}
  .op-list{max-height:40vh}
  .op-btn{padding:5px 6px}
  .on{font-size:.72rem}
  .os{font-size:.6rem}
  .dlg-btns{margin-top:10px;gap:6px}
  .dlg-btns .btn{padding:9px;font-size:.78rem}
  .dlg-sec input[type="number"]{font-size:.8rem;padding:5px 8px}
  .dlg-sec select{font-size:.78rem;padding:6px 8px}
  .dlg-sec div[style*="grid-template-columns:repeat(8,1fr)"]{
    font-size:1.2rem!important;
    overflow:hidden;
  }
  .qtoolbar{gap:3px;padding:4px 5px}
  .qtoolbar .btn{padding:4px 6px;font-size:.65rem;min-height:28px}
  .setup-castle-mark,.setup-ep-mark{font-size:.7rem}
}
/* v1.0.7 PHASE 3: removed legacy @media(max-width:480px) blocks — subsumed by orientation-specific rules above. */
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
    padding: 2px 8px;
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
  /* v1.0.7 PHASE 5: allow header toolbar to wrap to a second row instead of
     overflowing horizontally. The previous `overflow-x:auto` caused content
     to be clipped by #app's overflow-x:hidden on some devices. Wrapping is
     more robust and keeps all buttons visible. */
  .hdr-tools { gap: 3px; flex-wrap: wrap; overflow-x: hidden; max-width:100%; }
  .btn { padding: 3px 7px; font-size: .62rem; min-height: 26px; gap: 2px; white-space: nowrap; }
  .ev { font-size: .68rem; padding: 2px 6px; gap: 3px; }
  .ev-e { font-size: .85rem; }

  /* Main layout: side-by-side, board left + panel right */
  .main {
    flex-direction: row !important;
    align-items: stretch;
    flex-wrap: nowrap;
    gap: 6px;
    /* v1.0.7 PHASE 5: account for safe-area right + 3px grip in padding.
       Previously only 6px right padding, which could cause the panel to
       touch the screen edge (or be clipped by #app's margin on notched
       devices). Now: safe-area-right + 3px grip + 6px gap. */
    padding: 4px 6px 4px 6px;
    flex: 1;
    min-height: 0;
    /* Fill entire available space */
    height: calc(100vh - 36px);
    max-width:100%;
    overflow-x:hidden;
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
    /* v1.0.7 PHASE 21 (bug fix): overflow-x:visible so the anti-shake
       transform (translate3d ±8px on .bwrap.stabilized) is NOT clipped by
       .bsec. overflow-y:hidden remains to prevent vertical overflow from
       breaking the landscape layout. The previous overflow:hidden clipped
       the board's right edge when anti-shake shifted it rightward — adding
       margin-right did NOT help because the clip happens at .bsec's own
       boundary, not at the gap between .bsec and .panel. */
    overflow-x: visible;
    overflow-y: hidden;
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
    /* v1.0.7 PHASE 21 (bug fix): overflow-x:auto so wide content (long move
       notation, PGN text) scrolls WITHIN the panel instead of being clipped
       by .main's overflow-x:hidden. Previously the panel had no overflow-x
       setting, so wide content overflowed into .main and got cut off —
       making the move history "显示不全" (partially hidden). */
    overflow-x: auto;
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
  /* v1.1.0 Phase 53: .review-top, .review-left, .review-moves, and .review-bottom
     rules are now OUTSIDE the landscape media query (global) so they apply to BOTH
     portrait and landscape. This ensures the slider, chart, nav buttons, and eval
     bar have identical styling in both orientations. */
}

/* v1.1.0 Phase 53: Review layout — shared between portrait and landscape.
   Previously, .review-top, .review-left (landscape overrides), and .review-moves
   (landscape overrides) were inside @media(orientation:landscape) only.
   Now .review-top and the .review-bottom rules apply to ALL orientations so
   the layout structure is identical in both portrait and landscape. The only
   orientation-specific differences are the board width (set by JS) and the
   eval-bar font size (set by JS inline style). */

/* Top section: board left + moves right — FILL 100% width, edge-to-edge.
   flex:0 0 auto so its height is determined by the board's intrinsic height
   (not stretched to fill). This lets the body scroll reveal the bottom
   controls when they don't fit. */
.review-body > .review-top {
  display: flex;
  flex-direction: row;
  flex: 0 0 auto;
  width: 100%;
  gap: 0;
  padding: 0;
  min-height: 0;
  align-items: flex-start;
}
/* Board container: flex:0 0 auto + width set by JS via --rv-board-w. */
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
  /* v1.2.1 round-9: removed redundant flex-shrink:0 — the shorthand
     `flex: 0 0 auto` above already sets flex-shrink:0 (same pattern
     round-7 cleaned up elsewhere; this instance was missed). */
  margin: 0;
}
.review-left .review-board { padding: 0; flex-shrink: 0; margin: 0; }
.review-left .review-board .bgrid { max-width: none; }
.review-left .review-board .bgrid { touch-action: pan-y; }
/* Move list takes ALL remaining width (flex:1 1 0). Has its OWN independent
   scroll viewport: height matches the board height (set via JS --rv-board-h). */
.review-moves {
  flex: 1 1 0;
  overflow-y: auto;
  padding: 2px 2px 2px 4px;
  min-width: 80px;
  min-height: 0;
  height: var(--rv-board-h, 320px);
  margin: 0;
}
.rmv-block { padding: 3px 5px; }
.rmv-notation { font-size: .72rem; }
.rmv-num { font-size: .62rem; min-width: 20px; }

/* Review bottom section — shared between portrait and landscape.
   These rules ensure the progress bar, chart, nav buttons, and eval bar
   have identical appearance in both portrait and landscape. */
.review-body > .review-bottom {
  display: flex;
  flex-direction: column;
  width: 100%;
  flex: 0 0 auto;
  /* v1.1.0 Phase 54 rev5: horizontal padding 8px (> 4.75px thumb overflow)
     so the 9.5px slider thumb is never clipped at min/max in either
     portrait or landscape. Vertical padding 4px for breathing room. */
  padding: 4px 8px;
  gap: 4px;
  overflow: visible;
}
.review-chart { min-height: 120px; overflow: hidden; flex-shrink: 1; width: 100%; }
/* v1.1.0 Phase 54: Custom review slider — pixel-perfect alignment with chart.
   v1.2.1 round-9: The previous comment claimed "IDENTICAL CSS to .review-chart
   (border:1px, padding:2px, ...)" but .review-chart (line ~933) has neither
   border nor padding — the comment was stale. The actual design: both
   .review-chart and .rv-slider-wrap use width:100% + box-sizing:border-box
   so their OUTER boxes match. The transparent 1px border on .rv-slider-wrap
   is intentional (compensates for .review-chart's 1px overflow:hidden
   rounding) but the padding is 0 (not 2px as the old comment claimed).
   Inside, a container holds: base track, fill track, thumb (all visual-only,
   pointer-events:none), and a transparent native <input type="range"> overlay
   (opacity:0) that handles all touch/drag/keyboard interaction.
   Thumb and fill positions are set by JS (_updateRvSliderVisual) to align
   the thumb's CENTER with the chart's data points. */
.rv-slider-wrap {
  width: 100%;
  margin: 6px 0;
  box-sizing: border-box;
  border: 1px solid transparent;
  padding: 0;
  border-radius: 4px;
  /* v1.1.0 Phase 54 rev4: explicit overflow:visible so the 10px thumb
     (which overflows 5px at min/max) is never clipped by the wrap. */
  overflow: visible;
}
.rv-slider-container {
  position: relative;
  height: 20px;
  width: 100%;
  touch-action: none;
  /* v1.1.0 Phase 54 rev6: overflow:hidden so the thumb (9.5px outer) is
     CLIPPED at min/max — matching the chart's data point circles which
     are also clipped at the edges. Both centers align at the edge, and
     both are clipped symmetrically, achieving strict pixel-level alignment. */
  overflow: hidden;
}
.rv-slider-base {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  height: 4px;
  background: var(--border);
  border-radius: 2px;
  pointer-events: none;
}
.rv-slider-fill {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  height: 4px;
  background: var(--accent);
  border-radius: 2px;
  pointer-events: none;
  width: 0;
}
.rv-slider-thumb {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  /* v1.1.0 Phase 54 rev5: thumb outer diameter = 9.5px to STRICTLY match
     the chart's current-position marker circle (SVG r=4 + stroke-width=1.5
     → outer radius 4.75 → outer diameter 9.5px). The thumb is 7.5px wide
     with a 1px border on each side → outer diameter = 7.5 + 2 = 9.5px.
     This achieves exact pixel-level alignment with the chart's marker.
     The thumb overflows 4.75px at min/max — the .review-bottom's 6px
     horizontal padding accommodates this without clipping. */
  width: 7.5px;
  height: 7.5px;
  border-radius: 50%;
  background: var(--accent);
  border: 1px solid var(--bg);
  box-shadow: 0 1px 3px rgba(0,0,0,.4);
  pointer-events: none;
  left: 0;
}
.rv-slider-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  -webkit-appearance: none;
  appearance: none;
  opacity: 0;
  cursor: pointer;
}
.rv-slider-input::-webkit-slider-runnable-track {
  background: transparent;
  border: none;
  height: 20px;
}
.rv-slider-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  background: transparent;
  border: none;
  cursor: pointer;
}
.rv-slider-input::-moz-range-track {
  background: transparent;
  border: none;
  height: 20px;
}
.rv-slider-input::-moz-range-thumb {
  width: 20px;
  height: 20px;
  background: transparent;
  border: none;
  cursor: pointer;
}
.rv-slider-labels {
  display: flex;
  justify-content: space-between;
  font-size: .65rem;
  color: var(--muted);
  /* v1.1.0 Phase 54 rev3: padding so labels aren't flush with the edge.
     The slider track itself is edge-to-edge (padding:0 on wrap), but the
     text labels need a small horizontal margin for readability. */
  padding: 2px 3px;
}
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
  justify-content: center;
}
/* v1.0.7 PHASE 14: eval-bar override — match the inline style
   (font .8rem, padding 5px 10px, max-height 2.4em, single-line clip). */
.review-bottom #review-eval-bar {
  margin: 1px 0 !important;
  font-size: .8rem !important;
  padding: 5px 10px !important;
  max-height: 2.4em !important;
  overflow: hidden !important;
  white-space: nowrap !important;
  width: 100%;
}
/* v1.0.7 PHASE 20 (UX): slightly larger bottom buttons to match the
   enlarged eval bar and analyze button. */
.review-bottom .btn { padding: 4px 10px; font-size: .65rem; min-height: 26px; min-width: 36px; }

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
  /* Review mode: larger fonts on tall tablets, layout unchanged.
     v1.0.8 PHASE 28 (bug fix): preserve env(safe-area-inset-top) from the
     base rule — landscape override was stripping it, causing the header to
     render under the status bar/notch on notch-tablet devices. */
  .review-hdr { padding: calc(6px + env(safe-area-inset-top)) 14px 6px 14px; min-height: 40px; }
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

/* Last move highlight - high-saturation yellow-green for visibility */
.sq.last-from{box-shadow:inset 0 0 0 3px var(--last-from),inset 0 0 6px rgba(255,215,0,.15)!important;z-index:2}
.sq.last-to{box-shadow:inset 0 0 0 3px var(--last-to),inset 0 0 6px var(--last-to-glow)!important;z-index:2}
.tips{font-size:.75rem;color:var(--muted);line-height:1.6;font-family:system-ui,-apple-system,sans-serif}
.tip-item{margin-bottom:4px}
/* Move animation overlay - per-piece types, GPU-accelerated.
   v1.0.8 PHASE 23 (smoothness): A single static `filter: drop-shadow` is
   applied here so the overlay's shadow layer is computed ONCE when the
   element is composited, then cached. The per-piece keyframe animations
   only mutate `transform` (a GPU-composited property), so each animation
   frame is a pure layer translation — no per-frame pixel ops. This
   eliminates the jank caused by the previous design which set a different
   `filter: drop-shadow(...)` value on every keyframe of knight/bishop/
   queen/king animations, forcing the browser to re-rasterize the alpha
   mask every frame. */
.move-anim{position:absolute;display:flex;align-items:center;justify-content:center;font-size:2rem;z-index:20;pointer-events:none;will-change:transform;backface-visibility:hidden;-webkit-backface-visibility:hidden;transform:translate3d(0,0,0);font-family:'DejaVu Sans','Noto Sans','Segoe UI Symbol',sans-serif;font-variant-emoji:text;-webkit-font-variant-emoji:text;font-weight:400;filter:drop-shadow(0 4px 5px rgba(0,0,0,0.45))}

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
/* v1.0.8 PHASE 49: removed dead .rmv-comment and .ec-name selectors from the
   group (no element uses these classes — verified across chess.src + stats.html). */
.crow,.pname,.tind,.tips,.tip-item,.rmv-notation{word-break:break-word;overflow-wrap:anywhere}
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

/* v1.0.8 PHASE 22: Per-piece CSS transitions removed — piece-move motion
   is now driven by Web Animations API (el.animate()) in game-logic.js
   animateMove(). The .move-anim class still defines the overlay's base
   style (position, font, GPU compositing) but no longer has per-piece
   transition rules. The new animation system uses keyframe-based motion
   with per-piece easing curves (ANIM_EASINGS in game-logic.js). */
/* Opening display */
.opening-tag{background:linear-gradient(145deg,var(--purple),#6c3483);color:#ffd700;font-size:.72rem;padding:3px 12px;border-radius:4px;font-weight:700;white-space:nowrap;border:1px solid rgba(255,215,0,.3);font-family:system-ui,-apple-system,sans-serif;letter-spacing:1px;box-shadow:0 0 2px rgba(142,68,173,.08)}
/* Sound button integrated into toolbar - no longer floating */
.btn-d{background:var(--btn-bg);border-color:var(--border)}

.card:hover{border-color:var(--border2);box-shadow:0 0 2px var(--mvar-color)}
/* v1.0.8 PHASE 22: prefers-reduced-motion disables all non-essential
   animations. The Web Animations API motion in animateMove is also
   skipped on the JS side (see animateMove _reducedMotion check). */
@media(prefers-reduced-motion:reduce){.sq.in-check{animation:none!important}.bwrap.shake-light,.bwrap.shake-heavy,.bwrap.shake-massive{animation:none!important}.ge,.gt,.gover .btn{animation:none!important}.sq .castle-ring{animation:none!important}}

/* v1.0.7 — Quick Toolbar (below board, above player bar).
   Holds the 5 over-the-board actions moved out of the header toolbar:
   ↩️悔棋, ↪️撤悔, 🔃翻转, 💡AI提示, 🌗/🌈控制范围.
   Layout: flex row, wraps on narrow screens, centered.
   Visual: same .btn styling as the header toolbar — no new chrome. */
.qtoolbar{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;align-items:center;padding:6px 8px;background:var(--card);border:1px solid var(--border);border-radius:6px;max-width:100%;box-sizing:border-box;box-shadow:inset 0 1px 0 rgba(255,215,0,.05)}
.qtoolbar .btn{flex:0 1 auto;min-width:0;justify-content:center}
.qtoolbar .btn span{flex-shrink:0}

/* v1.0.7 — Setup-mode castle-rights (🔁) and en-passant (⚡) markers.
   Anchored to the bottom-right corner of the square so they don't obscure
   the piece glyph (centered) or the legal-move ring (also centered).
   Small font size (.55em of the square's piece font-size ~2rem → ~1.1rem)
   makes them "小巧玲珑" as the spec requires.
   v1.0.8 PHASE 23: Apply to BOTH main board (.sq ancestor) and review board
   (no .sq ancestor) — previously the review board skipped this rule, causing
   inconsistent rendering (review board fell back to colorful emoji ⚡ while
   main board rendered text-mode ⚡ with heavy text-shadow+drop-shadow that
   produced a muddy, blurry glyph on Android WebView). Now both boards use
   the same clean text-mode rendering with an ultra-thin dark outline so the
   glyph stays crisp on both light and dark squares in both themes. */
/* v1.0.8 PHASE 26 (⚡ emoji fix): The ⚡ marker was forced to text-mode
   (font-variant-emoji:text) with color:var(--setup-ep-mark) (purple #9b59b6),
   which made it render as a wrong-colored purple glyph instead of the proper
   yellow/orange emoji lightning bolt. Fix: render ⚡ as a standard COLOR EMOJI
   (remove font-variant-emoji:text + remove color). The outline is preserved
   via text-shadow (which works on color emoji) instead of -webkit-text-stroke
   (which does NOT work on color emoji — it's ignored by the emoji renderer).
   🔁 (castle-rights marker) is NOT an emoji — it's a text glyph (U+1F501),
   so it keeps the old text-mode rendering with color + -webkit-text-stroke. */
.setup-castle-mark,
.setup-ep-mark{position:absolute;bottom:1px;right:2px;font-size:1rem;line-height:1;pointer-events:none;z-index:3;font-family:'DejaVu Sans','Noto Sans','Segoe UI Symbol',sans-serif}
.setup-castle-mark{font-variant-emoji:text;-webkit-font-variant-emoji:text;color:var(--setup-castle-mark);-webkit-text-stroke:.3px rgba(0,0,0,.85);paint-order:stroke fill}
.setup-ep-mark{text-shadow:0 0 1px rgba(0,0,0,.85),0 0 2px rgba(0,0,0,.6)}
</style>
</head>
<body>
<div id="app"></div>
<script>/* __MODULE_SCRIPTS__ */</script>
</body>
</html>
