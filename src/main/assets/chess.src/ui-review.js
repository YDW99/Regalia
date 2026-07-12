// ui-review.js — Review Mode Module (v1.2.0 Phase 74)
//
// Regalia - UI Review Module
// Copyright (C) 2026 Regalia
//
// Derived from DroidFish (Peter Österlund) review mode logic.
// Modifications Copyright (C) 2026 Regalia
//
// AI-GEN: AI assisted + DroidFish source code logic reference
// This code was AI-assisted and has been reviewed for GPL v3 compliance.
//
// v1.2.0: New module (Phase 74 — God Module split).
//         Extracts review mode utilities: evaluation trend chart,
//         move classification, and analyze-all helpers.
//         Also provides review board coordinate labeling (Phase 77).
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
 * UI Review Module (v1.2.0 Phase 74)
 *
 * 复盘模式工具模块 — 提供评估趋势图、走法分类、分析全部等可复用工具。
 */
const UIReview = (function() {
    'use strict';

    // 走法分类常量
    const MOVE_CLASS = {
        BEST: 'best',           // 最佳走法
        EXCELLENT: 'excellent', // 极好
        GOOD: 'good',           // 好走法
        OK: 'ok',               // 一般
        INACCURACY: 'inaccuracy', // 不准确
        MISTAKE: 'mistake',     // 失误
        BLUNDER: 'blunder'      // 严重失误
    };

    // 分数阈值（centipawns）
    const THRESHOLDS = {
        BEST: 0,        // 评估损失 0
        EXCELLENT: 10,  // ≤ 10
        GOOD: 25,       // ≤ 25
        OK: 50,         // ≤ 50
        INACCURACY: 100, // ≤ 100
        MISTAKE: 300,   // ≤ 300
        BLUNDER: 300    // > 300
    };

    /**
     * 根据评估损失分类走法
     * @param {number} evalLoss - 评估损失（centipawns，正数表示损失）
     * @returns {string} MOVE_CLASS 之一
     */
    function classifyMove(evalLoss) {
        if (evalLoss <= THRESHOLDS.BEST) return MOVE_CLASS.BEST;
        if (evalLoss <= THRESHOLDS.EXCELLENT) return MOVE_CLASS.EXCELLENT;
        if (evalLoss <= THRESHOLDS.GOOD) return MOVE_CLASS.GOOD;
        if (evalLoss <= THRESHOLDS.OK) return MOVE_CLASS.OK;
        if (evalLoss <= THRESHOLDS.INACCURACY) return MOVE_CLASS.INACCURACY;
        if (evalLoss <= THRESHOLDS.MISTAKE) return MOVE_CLASS.MISTAKE;
        return MOVE_CLASS.BLUNDER;
    }

    /**
     * 获取走法分类的显示名称
     * @param {string} cls - MOVE_CLASS 之一
     * @param {string} lang - 语言 ('zh' | 'en')
     * @returns {string} 本地化名称
     */
    function getMoveClassName(cls, lang) {
        const names = {
            zh: {
                best: '最佳',
                excellent: '极好',
                good: '好',
                ok: '一般',
                inaccuracy: '不准确',
                mistake: '失误',
                blunder: '严重失误'
            },
            en: {
                best: 'Best',
                excellent: 'Excellent',
                good: 'Good',
                ok: 'OK',
                inaccuracy: 'Inaccuracy',
                mistake: 'Mistake',
                blunder: 'Blunder'
            }
        };
        const langMap = names[lang] || names.zh;
        return langMap[cls] || cls;
    }

    /**
     * 获取走法分类的颜色
     * @param {string} cls - MOVE_CLASS 之一
     * @returns {string} CSS 颜色值
     */
    function getMoveClassColor(cls) {
        const colors = {
            best: '#4caf50',       // 绿色
            excellent: '#8bc34a',  // 浅绿
            good: '#cddc39',       // 黄绿
            ok: '#ffc107',         // 黄色
            inaccuracy: '#ff9800', // 橙色
            mistake: '#ff5722',    // 深橙
            blunder: '#f44336'     // 红色
        };
        return colors[cls] || '#888';
    }

    /**
     * 构建评估趋势图 SVG
     * @param {Array} evals - 评估值数组 [{score, depth, mate}]
     * @param {Object} opts - 选项 {width, height, theme}
     * @returns {string} SVG 字符串
     */
    function buildEvalTrendSVG(evals, opts) {
        opts = opts || {};
        const width = opts.width || 600;
        const height = opts.height || 120;
        const theme = opts.theme || 'dark';
        const isDark = theme === 'dark';

        const bgColor = isDark ? '#1a0a0a' : '#f0f0f3';
        const lineColor = isDark ? '#5dade2' : '#2c5f8d';
        const fillColor = isDark ? '#e74c3c' : '#c0392b';
        const gridColor = isDark ? '#4a3020' : '#b0b0b8';
        const axisColor = isDark ? '#8a6a3a' : '#8a8a94';
        const textColor = isDark ? '#f5e6c8' : '#2c2c34';

        if (!evals || evals.length === 0) {
            return '<svg width="' + width + '" height="' + height + '" xmlns="http://www.w3.org/2000/svg">' +
                   '<rect width="100%" height="100%" fill="' + bgColor + '"/>' +
                   '<text x="50%" y="50%" text-anchor="middle" fill="' + textColor + '" font-size="14">No data</text>' +
                   '</svg>';
        }

        const padding = 20;
        const chartW = width - padding * 2;
        const chartH = height - padding * 2;

        // 计算分数范围
        let minScore = Infinity, maxScore = -Infinity;
        for (const e of evals) {
            if (e && typeof e.score === 'number') {
                if (e.score < minScore) minScore = e.score;
                if (e.score > maxScore) maxScore = e.score;
            }
        }
        // 钳制到合理范围
        const range = Math.max(200, maxScore - minScore);
        const yMin = minScore - range * 0.1;
        const yMax = maxScore + range * 0.1;

        // 生成路径
        let pathD = '';
        const points = [];
        for (let i = 0; i < evals.length; i++) {
            const e = evals[i];
            if (!e || typeof e.score !== 'number') continue;
            const x = padding + (chartW * i) / Math.max(1, evals.length - 1);
            const y = padding + chartH * (1 - (e.score - yMin) / (yMax - yMin));
            points.push([x, y]);
            pathD += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
        }

        // 构建区域填充路径
        let areaD = pathD;
        if (points.length > 0) {
            areaD += 'L' + points[points.length - 1][0].toFixed(1) + ',' + (padding + chartH) + ' ';
            areaD += 'L' + points[0][0].toFixed(1) + ',' + (padding + chartH) + ' Z';
        }

        let svg = '<svg width="' + width + '" height="' + height + '" xmlns="http://www.w3.org/2000/svg">';
        svg += '<rect width="100%" height="100%" fill="' + bgColor + '"/>';

        // 网格线
        for (let i = 0; i <= 4; i++) {
            const y = padding + (chartH * i) / 4;
            svg += '<line x1="' + padding + '" y1="' + y + '" x2="' + (padding + chartW) +
                   '" y2="' + y + '" stroke="' + gridColor + '" stroke-width="0.5" opacity="0.5"/>';
        }

        // 0 线（如果范围跨越 0）
        if (yMin < 0 && yMax > 0) {
            const zeroY = padding + chartH * (1 - (0 - yMin) / (yMax - yMin));
            svg += '<line x1="' + padding + '" y1="' + zeroY + '" x2="' + (padding + chartW) +
                   '" y2="' + zeroY + '" stroke="' + axisColor + '" stroke-width="1" stroke-dasharray="3,3"/>';
        }

        // 区域填充
        svg += '<path d="' + areaD + '" fill="' + fillColor + '" opacity="0.2"/>';
        // 折线
        svg += '<path d="' + pathD + '" fill="none" stroke="' + lineColor + '" stroke-width="2"/>';

        // 数据点
        for (const p of points) {
            svg += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) +
                   '" r="2" fill="' + lineColor + '"/>';
        }

        svg += '</svg>';
        return svg;
    }

    /**
     * 为复盘棋盘添加坐标标注（Phase 77）
     * 委托给 UIBoard.addReviewBoardCoords
     */
    function addReviewBoardCoords(boardEl, flipped, squareSize) {
        if (typeof UIBoard !== 'undefined') {
            UIBoard.addReviewBoardCoords(boardEl, flipped, squareSize);
        }
    }

    return {
        MOVE_CLASS,
        THRESHOLDS,
        classifyMove,
        getMoveClassName,
        getMoveClassColor,
        buildEvalTrendSVG,
        addReviewBoardCoords
    };
})();

// 导出到全局
if (typeof window !== 'undefined') {
    window.UIReview = UIReview;
}
