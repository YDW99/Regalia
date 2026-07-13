// state-store.js — Global State Store (v1.2.0 Phase 75)
//
// Regalia - Global State Store
// Copyright (C) 2026 Regalia
//
// AI-GEN: AI assisted
// This code was AI-assisted and has been reviewed for AGPL v3 compliance.
//
// v1.2.0: New module (Phase 75 — 全局状态 Store).
//         Provides a Redux-like single source of truth for all UI state.
//         All state mutations go through dispatch(), enabling:
//           - Predictable state transitions
//           - Centralized logging/debugging
//           - Selective re-rendering via subscriptions
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

/**
 * Store — 全局状态单一事实来源 (v1.2.0 Phase 75)
 *
 * 设计理念:
 *   - Redux-like 单向数据流: action → reducer → state → view
 *   - 所有状态变更通过 dispatch(action, payload) 触发
 *   - 订阅者通过 subscribe(listener) 监听状态变化
 *   - 状态分类: 游戏核心 / 复盘 / 引擎 / UI
 *
 * 使用示例:
 *   const state = Store.getState();
 *   const unsub = Store.subscribe((newState) => { ... });
 *   Store.dispatch('SET_THEME', { theme: 'light' });
 *   unsub(); // 取消订阅
 */
const Store = (function() {
    'use strict';

    // 初始状态
    const _initialState = {
        // 游戏核心状态
        gameState: null,           // 当前棋盘状态 (BoardState)
        moveRecords: [],           // 走法记录数组
        stateHistory: [],          // 棋盘状态历史
        redoStack: [],             // 悔棋重做栈

        // 复盘模式
        reviewMode: false,         // 是否在复盘模式
        reviewStep: 0,             // 复盘当前步骤索引
        reviewStates: [],          // 复盘模式下的状态序列
        reviewBaseState: null,     // 复盘基准状态
        reviewCritical: [],        // 复盘关键走法标记

        // 摆棋模式
        setupMode: false,          // 是否在摆棋模式
        setupHistory: [],          // 摆棋历史
        setupRedoStack: [],        // 摆棋重做栈

        // 引擎状态
        engineReady: false,        // 引擎是否就绪
        aiThinking: false,         // AI 是否在思考
        eval: {                    // 当前评估
            score: null,           // 分数 (centipawns)
            depth: 0,              // 搜索深度
            seldepth: 0,           // 选择性深度
            wdl: null,             // Win/Draw/Loss 概率
            mate: null             // 将杀步数 (如有)
        },

        // UI 偏好
        theme: 'dark',             // 主题: 'dark' | 'light'
        lang: 'zh',                // 语言: 'zh' | 'en'
        soundOn: true,             // 音效开关
        boardFlipped: false,       // 棋盘是否翻转
        chess960Mode: false,       // Chess960 模式
        chess960SPID: -1,          // Chess960 SP-ID (-1 表示未设置)

        // PGN 相关
        pgnLoaded: false,          // 是否已加载 PGN
        pgnPlayerWhite: '',        // 白方玩家
        pgnPlayerBlack: '',        // 黑方玩家
        pgnEvent: '',              // 赛事
        pgnDate: '',               // 日期

        // 对局时钟
        gameClocks: {              // 对局时钟
            white: 0,              // 白方剩余时间 (ms)
            black: 0,              // 黑方剩余时间 (ms)
            running: false
        },

        // 视觉注解
        visualAnnotationsCache: [], // 视觉注解缓存
        reviewEvalCache: {},        // 复盘评估缓存 (LRU)

        // 对话框状态
        dialogVisible: {
            pgnCache: false,
            settings: false,
            about: false,
            export: false,
            review: false
        }
    };

    // 订阅者列表
    const _listeners = [];

    // reducer 表
    const _reducers = {};

    /**
     * 深拷贝最大递归深度（防御性深度守卫）。
     *
     * ⚠️ 必须声明在任何对 _deepClone 的调用之前。v1.2.1 round-7 曾将
     * 此 const 放在 _deepClone 函数定义之后、IIFE 顶部初始化调用
     * `let _state = _deepClone(_initialState)` 之后，导致 TDZ
     * (Temporal Dead Zone) 违规：const 不像 var 那样有变量提升，函数
     * 体在执行时会访问尚未初始化的 DEEP_CLONE_MAX_DEPTH，抛出
     * `ReferenceError: Cannot access 'DEEP_CLONE_MAX_DEPTH' before
     * initialization`，state-store 模块初始化崩溃，所有依赖 Store 的
     * 模块（ui.js、ai-bridge.js 等）级联失败，整个 chess.html 渲染失败
     * → APP 白屏。
     *
     * v1.2.1 round-8 修复：将 const 声明移到 IIFE 顶部（在
     * `let _state = _deepClone(_initialState)` 之前），消除 TDZ。
     */
    const DEEP_CLONE_MAX_DEPTH = 64;

    /**
     * 深拷贝对象（避免引用共享）
     *
     * v1.2.1 round-7: 限制递归深度以防御栈溢出（理论场景——状态对象嵌套
     * 不会很深，但防御性编程无害）。同时将 RegExp 拷贝改为显式属性
     * 复制（new RegExp(obj.source, obj.flags)），消除 Semgrep
     * detect-non-literal-regexp 误报。
     */
    function _deepClone(obj, _depth) {
        if (obj === null || typeof obj !== 'object') return obj;
        // Depth guard — prevents stack overflow on pathological cyclic or
        // deeply-nested inputs. _depth is an internal parameter; callers
        // never pass it.
        if (typeof _depth !== 'number') _depth = 0;
        if (_depth > DEEP_CLONE_MAX_DEPTH) {
            if (typeof console !== 'undefined' && console.warn) {
                console.warn('[Store] _deepClone exceeded max depth, returning shallow copy');
            }
            return obj;
        }
        if (obj instanceof Date) return new Date(obj.getTime());
        // RegExp: use explicit source+flags construction (semantically
        // equivalent to `new RegExp(obj)` but avoids Semgrep FP on non-
        // literal-RegExp construction, since `obj` is already instanceof
        // RegExp and we only forward its string properties).
        if (obj instanceof RegExp) return new RegExp(obj.source, obj.flags);
        if (Array.isArray(obj)) return obj.map(function (v) { return _deepClone(v, _depth + 1); });
        const cloned = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                cloned[key] = _deepClone(obj[key], _depth + 1);
            }
        }
        return cloned;
    }

    // 当前状态（深拷贝初始状态）——必须在 _deepClone 与
    // DEEP_CLONE_MAX_DEPTH 都就绪后才能执行（否则 TDZ）。
    let _state = _deepClone(_initialState);

    /**
     * 注册 reducer
     * @param {string} actionType - action 类型
     * @param {Function} reducer - (state, payload) => newPartialState
     */
    function registerReducer(actionType, reducer) {
        if (typeof actionType !== 'string' || actionType.length === 0) {
            throw new Error('actionType must be a non-empty string');
        }
        if (typeof reducer !== 'function') {
            throw new Error('reducer must be a function');
        }
        if (_reducers[actionType] && typeof console !== 'undefined' && console.warn) console.warn('[Store] Reducer overwrite:', actionType);
        _reducers[actionType] = reducer;
    }

    /**
     * 派发 action
     * @param {string} action - action 类型
     * @param {*} payload - 负载数据
     * @returns {Object} 新状态
     */
    function dispatch(action, payload) {
        const reducer = _reducers[action];
        if (!reducer) {
            if (typeof console !== 'undefined' && console.warn) console.warn('[Store] No reducer for action:', action);
            return _deepClone(_state);
        }
        const partial = reducer(_state, payload);
        if (partial && typeof partial === 'object') {
            _state = Object.assign({}, _state, partial);
            _notifyListeners();
        }
        // v1.2.1: Return deep clone (P0-2)
        return _deepClone(_state);
    }

    /**
     * 获取当前状态（只读视图）
     * @returns {Object} 状态对象
     */
    function getState() {
        // v1.2.1: Return deep clone to prevent external mutation (P0-1)
        return _deepClone(_state);
    }

    /**
     * 订阅状态变化
     * @param {Function} listener - (newState) => void
     * @returns {Function} 取消订阅函数
     */
    function subscribe(listener) {
        if (typeof listener !== 'function') {
            throw new Error('listener must be a function');
        }
        _listeners.push(listener);
        return function unsubscribe() {
            const idx = _listeners.indexOf(listener);
            if (idx >= 0) _listeners.splice(idx, 1);
        };
    }

    /**
     * 通知所有订阅者
     */
    function _notifyListeners() {
        const snapshot = _state;
        const listeners = _listeners.slice();
        for (let i = 0; i < listeners.length; i++) {
            try {
                listeners[i](snapshot);
            } catch (e) {
                // 单个监听器异常不影响其他监听器
                console.error('[Store] listener error:', e);
            }
        }
    }

    /**
     * 重置状态到初始值
     * @param {Object} [overrides] - 需要覆盖的字段
     * @returns {Object} 新状态的深拷贝（与 getState()/dispatch() 一致，
     *                   调用者可安全修改返回值而不影响内部 _state）
     */
    function reset(overrides) {
        _state = Object.assign(_deepClone(_initialState), overrides || {});
        _notifyListeners();
        // v1.2.1 round-9: 返回深拷贝，与 getState()/dispatch() 保持一致。
        // 旧版直接返回 _state 引用，调用者修改返回值会污染内部状态。
        return _deepClone(_state);
    }

    // ========== 注册核心 reducers ==========

    // 游戏状态
    registerReducer('SET_GAME_STATE', (state, payload) => ({
        gameState: payload
    }));
    registerReducer('SET_MOVE_RECORDS', (state, payload) => ({
        moveRecords: payload
    }));
    registerReducer('SET_STATE_HISTORY', (state, payload) => ({
        stateHistory: payload
    }));
    registerReducer('SET_REDO_STACK', (state, payload) => ({
        redoStack: payload
    }));

    // 复盘模式
    registerReducer('ENTER_REVIEW', (state, payload) => ({
        reviewMode: true,
        reviewStep: 0,
        reviewStates: payload.states || [],
        reviewBaseState: payload.baseState || null
    }));
    registerReducer('EXIT_REVIEW', () => ({
        reviewMode: false,
        reviewStep: 0,
        reviewStates: [],
        reviewBaseState: null,
        reviewCritical: []
    }));
    registerReducer('SET_REVIEW_STEP', (state, payload) => ({
        reviewStep: payload
    }));
    registerReducer('SET_REVIEW_CRITICAL', (state, payload) => ({
        reviewCritical: payload
    }));

    // 摆棋模式
    registerReducer('SETUP_ENTER', () => ({
        setupMode: true,
        setupHistory: [],
        setupRedoStack: []
    }));
    registerReducer('SETUP_EXIT', () => ({
        setupMode: false,
        setupHistory: [],
        setupRedoStack: []
    }));

    // 引擎状态
    registerReducer('ENGINE_READY', () => ({
        engineReady: true
    }));
    registerReducer('ENGINE_NOT_READY', () => ({
        engineReady: false
    }));
    registerReducer('AI_THINKING_START', () => ({
        aiThinking: true
    }));
    registerReducer('AI_THINKING_END', () => ({
        aiThinking: false
    }));
    registerReducer('UPDATE_EVAL', (state, payload) => ({
        eval: Object.assign({}, state.eval, payload)
    }));

    // UI 偏好
    registerReducer('SET_THEME', (state, payload) => ({
        theme: payload
    }));
    registerReducer('SET_LANG', (state, payload) => ({
        lang: payload
    }));
    registerReducer('TOGGLE_SOUND', (state, payload) => ({
        soundOn: payload
    }));
    registerReducer('FLIP_BOARD', (state, payload) => ({
        boardFlipped: payload
    }));
    registerReducer('SET_CHESS960', (state, payload) => ({
        chess960Mode: payload.enabled || false,
        chess960SPID: payload.spid || -1
    }));

    // PGN
    registerReducer('PGN_LOADED', (state, payload) => ({
        pgnLoaded: true,
        pgnPlayerWhite: payload.playerWhite || '',
        pgnPlayerBlack: payload.playerBlack || '',
        pgnEvent: payload.event || '',
        pgnDate: payload.date || ''
    }));
    registerReducer('PGN_CLEARED', () => ({
        pgnLoaded: false,
        pgnPlayerWhite: '',
        pgnPlayerBlack: '',
        pgnEvent: '',
        pgnDate: ''
    }));

    // 对局时钟
    registerReducer('UPDATE_CLOCKS', (state, payload) => ({
        gameClocks: Object.assign({}, state.gameClocks, payload)
    }));

    // 视觉注解
    registerReducer('SET_VISUAL_ANNOTATIONS', (state, payload) => ({
        visualAnnotationsCache: payload
    }));
    registerReducer('SET_REVIEW_EVAL_CACHE', (state, payload) => ({
        reviewEvalCache: payload
    }));

    // 对话框
    // v1.2.1 round-9: payload 必须是字符串，否则 [payload] 会产生 "null"/"undefined"
    // 等垃圾键污染 dialogVisible。非字符串 payload 视为 no-op 返回 {}。
    registerReducer('SHOW_DIALOG', (state, payload) => {
        if (typeof payload !== 'string' || !payload) return {};
        return { dialogVisible: Object.assign({}, state.dialogVisible, { [payload]: true }) };
    });
    registerReducer('HIDE_DIALOG', (state, payload) => {
        if (typeof payload !== 'string' || !payload) return {};
        return { dialogVisible: Object.assign({}, state.dialogVisible, { [payload]: false }) };
    });
    registerReducer('HIDE_ALL_DIALOGS', (state) => {
        const cleared = {};
        for (const key in state.dialogVisible) {
            cleared[key] = false;
        }
        return { dialogVisible: cleared };
    });

    return {
        getState,
        dispatch,
        subscribe,
        registerReducer,
        reset,
        _deepClone // 暴露用于测试
    };
})();

// 导出到全局（用于非模块化合并）
if (typeof window !== 'undefined') {
    window.Store = Store;
}
