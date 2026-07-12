// ui-toolbar.js — Toolbar Module (v1.2.0 Phase 74)
//
// Regalia - UI Toolbar Module
// Copyright (C) 2026 Regalia
//
// Derived from DroidFish (Peter Österlund) UI patterns.
// Modifications Copyright (C) 2026 Regalia
//
// AI-GEN: AI assisted + DroidFish source code logic reference
// This code was AI-assisted and has been reviewed for GPL v3 compliance.
//
// v1.2.0: New module (Phase 74 — God Module split).
//         Provides toolbar rendering utilities, button state management,
//         and language switching helpers.
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
 * UI Toolbar Module (v1.2.0 Phase 74)
 *
 * 工具栏模块 — 提供工具栏渲染、按钮状态管理、语言切换的辅助工具。
 */
const UIToolbar = (function() {
    'use strict';

    // 工具栏按钮 ID
    const BTN_ID = {
        NEW_GAME: 'btn-new-game',
        UNDO: 'btn-undo',
        REDO: 'btn-redo',
        HINT: 'btn-hint',
        FLIP: 'btn-flip',
        REVIEW: 'btn-review',
        SETUP: 'btn-setup',
        SETTINGS: 'btn-settings',
        PGN_CACHE: 'btn-pgn-cache',
        STATS: 'btn-stats',
        SOUND: 'btn-sound',
        THEME: 'btn-theme',
        LANG: 'btn-lang',
        ABOUT: 'btn-about'
    };

    // 按钮状态
    const BTN_STATE = {
        NORMAL: 'normal',
        ACTIVE: 'active',
        DISABLED: 'disabled',
        HIDDEN: 'hidden'
    };

    /**
     * 设置按钮状态
     * @param {string} btnId - 按钮 ID
     * @param {string} state - BTN_STATE 之一
     */
    function setButtonState(btnId, state) {
        const el = document.getElementById(btnId);
        if (!el) return;
        // 清除旧状态
        el.classList.remove('btn-active', 'btn-disabled');
        el.removeAttribute('disabled');
        el.style.display = '';
        switch (state) {
            case BTN_STATE.ACTIVE:
                el.classList.add('btn-active');
                break;
            case BTN_STATE.DISABLED:
                el.classList.add('btn-disabled');
                el.setAttribute('disabled', 'disabled');
                break;
            case BTN_STATE.HIDDEN:
                el.style.display = 'none';
                break;
            case BTN_STATE.NORMAL:
            default:
                // 正常状态，无需额外类
                break;
        }
    }

    /**
     * 切换语言（发送到 Java 层持久化）
     * @param {string} lang - 'zh' 或 'en'
     */
    function switchLanguage(lang) {
        try {
            if (typeof AndroidBridge !== 'undefined' && AndroidBridge.saveLangPref) {
                AndroidBridge.saveLangPref(lang);
            }
        } catch (e) {
            console.warn('[UIToolbar] saveLangPref failed:', e);
        }
        // 通过 Store 更新状态
        if (typeof Store !== 'undefined') {
            Store.dispatch('SET_LANG', lang);
        }
    }

    /**
     * 切换主题
     * @param {string} theme - 'dark' 或 'light'
     */
    function switchTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        if (typeof Store !== 'undefined') {
            Store.dispatch('SET_THEME', theme);
        }
    }

    /**
     * 切换音效开关
     * @param {boolean} enabled - 是否启用
     */
    function toggleSound(enabled) {
        if (typeof UIAudio !== 'undefined') {
            UIAudio.setEnabled(enabled);
        }
        if (typeof Store !== 'undefined') {
            Store.dispatch('TOGGLE_SOUND', enabled);
        }
    }

    /**
     * 更新所有工具栏按钮的状态
     * @param {Object} state - 应用状态
     */
    function updateToolbarState(state) {
        if (!state) return;
        // 悔棋按钮：有历史才可用
        setButtonState(BTN_ID.UNDO, state.stateHistory && state.stateHistory.length > 0
            ? BTN_STATE.NORMAL : BTN_STATE.DISABLED);
        // 重做按钮：有重做栈才可用
        setButtonState(BTN_ID.REDO, state.redoStack && state.redoStack.length > 0
            ? BTN_STATE.NORMAL : BTN_STATE.DISABLED);
        // 提示按钮：引擎就绪且非 AI 思考中
        setButtonState(BTN_ID.HINT, (state.engineReady && !state.aiThinking)
            ? BTN_STATE.NORMAL : BTN_STATE.DISABLED);
        // 复盘按钮：有走法记录才可用
        setButtonState(BTN_ID.REVIEW, state.moveRecords && state.moveRecords.length > 0
            ? BTN_STATE.NORMAL : BTN_STATE.DISABLED);
        // 音效按钮：反映当前状态
        setButtonState(BTN_ID.SOUND, state.soundOn ? BTN_STATE.ACTIVE : BTN_STATE.NORMAL);
    }

    return {
        BTN_ID,
        BTN_STATE,
        setButtonState,
        switchLanguage,
        switchTheme,
        toggleSound,
        updateToolbarState
    };
})();

// 导出到全局
if (typeof window !== 'undefined') {
    window.UIToolbar = UIToolbar;
}
