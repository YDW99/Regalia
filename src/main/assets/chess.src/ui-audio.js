// ui-audio.js — Audio Engine Module (v1.2.0 Phase 74)
//
// Regalia - UI Audio Module
// Copyright (C) 2026 Regalia
//
// Derived from DroidFish (Peter Österlund) audio patterns.
// Modifications Copyright (C) 2026 Regalia
//
// AI-GEN: AI assisted + DroidFish source code logic reference
// This code was AI-assisted and has been reviewed for GPL v3 compliance.
//
// v1.2.0: New module (Phase 74 — God Module split).
//         Provides audio engine utilities and sound synthesis helpers.
//         The main ChessAudioEngine class remains in ui.js for backward
//         compatibility; this module provides additional utilities.
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
 * UI Audio Module (v1.2.0 Phase 74)
 *
 * 音频工具模块 — 提供音量管理、音频解锁、音效合成的辅助工具。
 * ChessAudioEngine 类保留在 ui.js 中以维持兼容性。
 */
const UIAudio = (function() {
    'use strict';

    // 音量常量
    const DEFAULT_VOLUME = 0.7;
    const MIN_VOLUME = 0;
    const MAX_VOLUME = 1;

    // 音效类型
    const SOUND_TYPE = {
        MOVE: 'move',
        CAPTURE: 'capture',
        CASTLE: 'castle',
        CHECK: 'check',
        CHECKMATE: 'checkmate',
        SELECT: 'select',
        HINT: 'hint',
        GAME_START: 'gameStart',
        GAME_END: 'gameEnd',
        ERROR: 'error'
    };

    // 棋子类型（与 game-logic.js 一致）
    const PIECE_TYPE = {
        PAWN: 'p',
        KNIGHT: 'n',
        BISHOP: 'b',
        ROOK: 'r',
        QUEEN: 'q',
        KING: 'k'
    };

    let _audioContext = null;
    let _masterGain = null;
    let _volume = DEFAULT_VOLUME;
    let _enabled = true;

    /**
     * 获取或创建 AudioContext
     */
    function getAudioContext() {
        if (!_audioContext) {
            try {
                const Ctor = window.AudioContext || window.webkitAudioContext;
                if (!Ctor) return null;
                _audioContext = new Ctor();
                _masterGain = _audioContext.createGain();
                _masterGain.gain.value = _volume;
                _masterGain.connect(_audioContext.destination);
            } catch (e) {
                console.warn('[UIAudio] AudioContext init failed:', e);
                return null;
            }
        }
        return _audioContext;
    }

    /**
     * 解锁音频（移动端需要在用户交互后恢复 AudioContext）
     */
    function unlockAudio() {
        const ctx = getAudioContext();
        if (!ctx) return;
        if (ctx.state === 'suspended') {
            ctx.resume().catch(function(e) {
                console.warn('[UIAudio] resume failed:', e);
            });
        }
    }

    /**
     * 设置主音量
     * @param {number} vol - 音量 (0-1)
     */
    function setVolume(vol) {
        _volume = Math.max(MIN_VOLUME, Math.min(MAX_VOLUME, vol));
        if (_masterGain) {
            _masterGain.gain.value = _volume;
        }
    }

    /**
     * 获取当前音量
     */
    function getVolume() {
        return _volume;
    }

    /**
     * 启用/禁用音效
     */
    function setEnabled(enabled) {
        _enabled = !!enabled;
        if (_masterGain) {
            _masterGain.gain.value = _enabled ? _volume : 0;
        }
    }

    /**
     * 是否启用
     */
    function isEnabled() {
        return _enabled;
    }

    /**
     * 合成简单的提示音（用于 UI 反馈）
     * @param {number} freq - 频率 (Hz)
     * @param {number} duration - 持续时间 (秒)
     * @param {string} type - 波形类型 ('sine' | 'square' | 'triangle' | 'sawtooth')
     */
    function playTone(freq, duration, type) {
        if (!_enabled) return;
        const ctx = getAudioContext();
        if (!ctx) return;
        try {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type || 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
            osc.connect(gain);
            gain.connect(_masterGain);
            osc.start();
            osc.stop(ctx.currentTime + duration);
        } catch (e) {
            console.warn('[UIAudio] playTone failed:', e);
        }
    }

    /**
     * 释放音频资源
     */
    function dispose() {
        if (_audioContext) {
            try {
                _audioContext.close();
            } catch (e) {
                // 忽略关闭错误
            }
            _audioContext = null;
            _masterGain = null;
        }
    }

    return {
        DEFAULT_VOLUME,
        SOUND_TYPE,
        PIECE_TYPE,
        getAudioContext,
        unlockAudio,
        setVolume,
        getVolume,
        setEnabled,
        isEnabled,
        playTone,
        dispose
    };
})();

// 导出到全局
if (typeof window !== 'undefined') {
    window.UIAudio = UIAudio;
}
