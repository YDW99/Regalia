package com.Regalia;

/*
 * Regalia - Haptic Feedback Helper
 * Copyright (C) 2026 Regalia
 *
 * Haptic feedback patterns derived from DroidFish (EngineUtil.java vibration)
 * Copyright (C) Peter Österlund (original DroidFish logic)
 * Modifications Copyright (C) 2026 Regalia
 *
 * AI-GEN: AI assisted + DroidFish source code logic reference
 * This code was AI-assisted and has been reviewed for GPL v3 compliance.
 *
 * v1.2.0 Phase 73+: Extracted from StockfishNative.java to reduce God Module size.
 *                   Encapsulates haptic feedback (vibration) operations.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import android.content.Context;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;
import android.util.Log;

/**
 * HapticHelper — 触觉反馈辅助类 (v1.2.0 Phase 73+)
 *
 * 职责:
 *   - 触觉反馈开关管理（isHapticEnabled / setHapticEnabled）
 *   - 执行各类触觉反馈（performHaptic）
 *
 * 触觉类型:
 *   - BUTTON_PRESS: 按钮按下（短振动 10ms）
 *   - PIECE_MOVE: 棋子移动（中振动 20ms）
 *   - CAPTURE: 吃子（强振动 30ms）
 *   - CHECK: 将军（双振动）
 *   - GAME_END: 游戏结束（长振动 50ms）
 *   - ERROR: 错误（警告振动模式）
 *
 * 兼容性:
 *   - Android 8+ (API 26+) 使用 VibrationEffect.createOneShot
 *   - Android 7 及以下使用 deprecated vibrate(long) API
 */
public class HapticHelper {
    private static final String TAG = "HapticHelper";

    private final Context context;
    private final Vibrator vibrator;
    private volatile boolean enabled = true;

    public HapticHelper(Context context) {
        this.context = context.getApplicationContext();
        this.vibrator = (Vibrator) this.context.getSystemService(Context.VIBRATOR_SERVICE);
    }

    /** 检查触觉反馈是否启用 */
    public boolean isEnabled() {
        return enabled;
    }

    /** 设置触觉反馈开关 */
    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    /**
     * 执行触觉反馈。
     * @param type 触觉类型字符串（BUTTON_PRESS / PIECE_MOVE / CAPTURE / CHECK / GAME_END / ERROR）
     */
    public void perform(String type) {
        if (!enabled || vibrator == null || !vibrator.hasVibrator()) return;
        // v1.2.1: 与 StatsActivity.performHaptic 保持一致 —— 检查系统触觉反馈
        //   总开关。用户在系统设置中关闭"触摸时振动"后，APP 内的触觉也应被抑制，
        //   否则会产生不一致的体验（设置页静默、对局页振动）。
        try {
            if (Settings.System.getInt(context.getContentResolver(),
                    Settings.System.HAPTIC_FEEDBACK_ENABLED, 0) == 0) return;
        } catch (Throwable ignored) {
            // 读取系统设置失败时不阻断触觉反馈
        }
        try {
            int duration = getDurationForType(type);
            if (duration <= 0) return;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                VibrationEffect effect = VibrationEffect.createOneShot(duration, VibrationEffect.DEFAULT_AMPLITUDE);
                vibrator.vibrate(effect);
            } else {
                // Android 7 及以下（deprecated 但 minSdk=23 需要）
                vibrator.vibrate(duration);
            }
        } catch (Throwable e) {
            Log.w(TAG, "perform haptic failed: " + type, e);
        }
    }

    /** 根据触觉类型获取振动时长（毫秒） */
    private int getDurationForType(String type) {
        if (type == null) return 0;
        switch (type) {
            case "BUTTON_PRESS": return 10;
            case "PIECE_MOVE": return 20;
            case "CAPTURE": return 30;
            case "CHECK": return 25;
            case "GAME_END": return 50;
            case "ERROR": return 40;
            default: return 15; // 默认短振动
        }
    }

    /** 检查设备是否支持振动 */
    public boolean hasVibrator() {
        return vibrator != null && vibrator.hasVibrator();
    }
}
