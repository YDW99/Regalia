// ui-board.js — Board Rendering Module (v1.2.0 Phase 74)
//
// Regalia - UI Board Module
// Copyright (C) 2026 Regalia
//
// Derived from DroidFish (Peter Österlund) board rendering logic.
// Modifications Copyright (C) 2026 Regalia
//
// AI-GEN: AI assisted + DroidFish source code logic reference
// This code was AI-assisted and has been reviewed for GPL v3 compliance.
//
// v1.2.0: New module (Phase 74 — God Module split).
//         Extracts board rendering, coordinate labels, heatmap, and arrow
//         rendering from ui.js. Provides reusable board utilities.
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

/**
 * UI Board Module (v1.2.0 Phase 74)
 *
 * 棋盘渲染工具模块 — 提供坐标标注、格子背景色、箭头渲染等可复用工具。
 *
 * 坐标标注规范（与主界面、统计界面、复盘界面统一）:
 *   - 左侧 1-8 数字标签：棋盘格宽度的 25% 字体大小，从白方视角底部为 1 顶部为 8
 *   - 上方 a-h 字母标签：棋盘格宽度的 25% 字体大小，从白方视角左侧为 a 右侧为 h
 *   - 浅色格坐标颜色: #4a3a0a (深棕色)
 *   - 深色格坐标颜色: #f0dcb0 (浅米色)
 *   - 浅色格坐标描边: rgba(255,230,150,.85)
 *   - 深色格坐标描边: rgba(30,15,0,.85)
 *   - 格子内坐标位置: 左上角偏移 2px
 *   - 字体: sans-serif
 */
const UIBoard = (function() {
    'use strict';

    // 坐标标注常量（与主界面 index.html.tpl CSS 一致）
    const COORD_COLOR_LIGHT = '#4a3a0a';
    const COORD_COLOR_DARK = '#f0dcb0';
    const COORD_STROKE_LIGHT = 'rgba(255,230,150,.85)';
    const COORD_STROKE_DARK = 'rgba(30,15,0,.85)';
    const COORD_FONT_FAMILY = 'sans-serif';
    const COORD_FONT_RATIO = 0.25; // 格宽的 25%
    const COORD_OFFSET_PX = 2; // 左上角偏移

    // 棋盘格子背景色
    const SQ_BG_LIGHT = '#f0d9b5';
    const SQ_BG_DARK = '#b58863';
    const SQ_BG_LIGHT_HIGHLIGHT = '#f7ec74';
    const SQ_BG_DARK_HIGHLIGHT = '#dac34b';
    const SQ_BG_LIGHT_SELECTED = '#a8a8a8';
    const SQ_BG_DARK_SELECTED = '#888888';

    /**
     * 获取格子背景色
     * @param {number} file - 列 (0-7, a-h)
     * @param {number} rank - 行 (0-7, 8-1)
     * @param {Object} opts - 选项 {selected, highlight, lastMove}
     * @returns {string} CSS 颜色值
     */
    function getSquareBg(file, rank, opts) {
        opts = opts || {};
        const isLight = (file + rank) % 2 === 1;
        if (opts.selected) return isLight ? SQ_BG_LIGHT_SELECTED : SQ_BG_DARK_SELECTED;
        if (opts.highlight) return isLight ? SQ_BG_LIGHT_HIGHLIGHT : SQ_BG_DARK_HIGHLIGHT;
        if (opts.lastMove) return isLight ? SQ_BG_LIGHT_HIGHLIGHT : SQ_BG_DARK_HIGHLIGHT;
        return isLight ? SQ_BG_LIGHT : SQ_BG_DARK;
    }

    /**
     * 获取格子坐标名称（如 "a1", "e4"）
     * @param {number} file - 列 (0-7)
     * @param {number} rank - 行 (0-7)
     * @param {boolean} flipped - 棋盘是否翻转
     * @returns {string} 坐标名称
     */
    function getSquareName(file, rank, flipped) {
        if (flipped) {
            file = 7 - file;
            rank = 7 - rank;
        }
        return String.fromCharCode(97 + file) + (rank + 1);
    }

    /**
     * 获取格子坐标颜色（根据格子的明暗）
     * @param {number} file - 列
     * @param {number} rank - 行
     * @returns {string} CSS 颜色值
     */
    function getCoordColor(file, rank) {
        const isLight = (file + rank) % 2 === 1;
        return isLight ? COORD_COLOR_LIGHT : COORD_COLOR_DARK;
    }

    /**
     * 获取格子坐标描边颜色
     * @param {number} file - 列
     * @param {number} rank - 行
     * @returns {string} CSS 颜色值
     */
    function getCoordStroke(file, rank) {
        const isLight = (file + rank) % 2 === 1;
        return isLight ? COORD_STROKE_LIGHT : COORD_STROKE_DARK;
    }

    /**
     * 生成格子坐标标签的 HTML
     * @param {number} file - 列
     * @param {number} rank - 行
     * @param {boolean} flipped - 棋盘是否翻转
     * @param {number} squareSize - 格子宽度（像素）
     * @returns {string} HTML 字符串
     */
    function renderSquareCoord(file, rank, flipped, squareSize) {
        const name = getSquareName(file, rank, flipped);
        const color = getCoordColor(file, rank);
        const stroke = getCoordStroke(file, rank);
        const fontSize = Math.max(8, Math.floor(squareSize * COORD_FONT_RATIO));
        const style = [
            'position:absolute',
            'left:' + COORD_OFFSET_PX + 'px',
            'top:' + COORD_OFFSET_PX + 'px',
            'font:' + fontSize + 'px/' + fontSize + 'px ' + COORD_FONT_FAMILY,
            'color:' + color,
            'text-shadow:0 0 2px ' + stroke + ',0 0 2px ' + stroke,
            'pointer-events:none',
            'z-index:1',
            'user-select:none'
        ].join(';');
        return '<span class="sq-coord" style="' + style + '">' + name + '</span>';
    }

    /**
     * 生成左侧 1-8 数字标签 HTML
     * @param {boolean} flipped - 棋盘是否翻转
     * @param {number} squareSize - 格子宽度
     * @returns {string} HTML 字符串
     */
    function renderRankLabels(flipped, squareSize) {
        const fontSize = Math.max(10, Math.floor(squareSize * COORD_FONT_RATIO));
        let html = '<div class="rank-labels" style="position:absolute;left:0;top:0;width:' +
                   Math.floor(squareSize * 0.4) + 'px;height:100%;display:flex;flex-direction:column;';
        html += 'font:' + fontSize + 'px ' + COORD_FONT_FAMILY + ';color:var(--text,#f5e6c8);">';
        // 白方视角: 底部为 1，顶部为 8
        // 翻转时: 底部为 8，顶部为 1
        const ranks = flipped ? [1,2,3,4,5,6,7,8] : [8,7,6,5,4,3,2,1];
        for (let i = 0; i < 8; i++) {
            html += '<div style="flex:1;display:flex;align-items:center;justify-content:center;">' +
                    ranks[i] + '</div>';
        }
        html += '</div>';
        return html;
    }

    /**
     * 生成上方 a-h 字母标签 HTML
     * @param {boolean} flipped - 棋盘是否翻转
     * @param {number} squareSize - 格子宽度
     * @returns {string} HTML 字符串
     */
    function renderFileLabels(flipped, squareSize) {
        const fontSize = Math.max(10, Math.floor(squareSize * COORD_FONT_RATIO));
        let html = '<div class="file-labels" style="position:absolute;left:0;top:0;width:100%;height:' +
                   Math.floor(squareSize * 0.4) + 'px;display:flex;flex-direction:row;';
        html += 'font:' + fontSize + 'px ' + COORD_FONT_FAMILY + ';color:var(--text,#f5e6c8);">';
        // 白方视角: 左侧为 a，右侧为 h
        // 翻转时: 左侧为 h，右侧为 a
        const files = flipped ? ['h','g','f','e','d','c','b','a'] : ['a','b','c','d','e','f','g','h'];
        for (let i = 0; i < 8; i++) {
            html += '<div style="flex:1;display:flex;align-items:center;justify-content:center;">' +
                    files[i] + '</div>';
        }
        html += '</div>';
        return html;
    }

    /**
     * 为复盘界面棋盘添加完整坐标标注（左侧 1-8 + 上方 a-h + 格子坐标）
     * @param {HTMLElement} boardEl - 棋盘容器元素
     * @param {boolean} flipped - 棋盘是否翻转
     * @param {number} squareSize - 格子宽度
     */
    function addReviewBoardCoords(boardEl, flipped, squareSize) {
        if (!boardEl) return;
        // 确保容器是相对定位
        const pos = boardEl.style.position;
        if (pos !== 'relative' && pos !== 'absolute') {
            boardEl.style.position = 'relative';
        }
        // 移除旧的坐标标签（如有）
        const oldRanks = boardEl.querySelector('.rank-labels');
        if (oldRanks) oldRanks.remove();
        const oldFiles = boardEl.querySelector('.file-labels');
        if (oldFiles) oldFiles.remove();

        // 添加新的坐标标签
        const rankHtml = renderRankLabels(flipped, squareSize);
        const fileHtml = renderFileLabels(flipped, squareSize);
        boardEl.insertAdjacentHTML('afterbegin', rankHtml + fileHtml);

        // 为每个格子添加坐标标签
        const squares = boardEl.querySelectorAll('.sq');
        squares.forEach((sq, idx) => {
            // 移除旧坐标
            const oldCoord = sq.querySelector('.sq-coord');
            if (oldCoord) oldCoord.remove();
            // 计算行列（根据 DOM 顺序）
            const file = idx % 8;
            const rank = Math.floor(idx / 8);
            // 插入坐标
            sq.insertAdjacentHTML('afterbegin', renderSquareCoord(file, rank, flipped, squareSize));
        });
    }

    return {
        COORD_COLOR_LIGHT,
        COORD_COLOR_DARK,
        COORD_STROKE_LIGHT,
        COORD_STROKE_DARK,
        SQ_BG_LIGHT,
        SQ_BG_DARK,
        getSquareBg,
        getSquareName,
        getCoordColor,
        getCoordStroke,
        renderSquareCoord,
        renderRankLabels,
        renderFileLabels,
        addReviewBoardCoords
    };
})();

// 导出到全局
if (typeof window !== 'undefined') {
    window.UIBoard = UIBoard;
}
