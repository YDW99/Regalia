package com.Regalia;

/*
 * Regalia - Engine Health Monitor
 * Copyright (C) 2026 Regalia
 *
 * Engine management logic derived from DroidFish
 * Copyright (C) Peter Österlund (original DroidFish logic)
 * Modifications Copyright (C) 2026 Regalia
 *
 * AI-GEN: AI assisted + DroidFish source code logic reference
 * This code was AI-assisted and has been reviewed for GPL v3 compliance.
 *
 * v1.2.0: Extracted from StockfishNative.java (Phase 73 God Module split).
 *         Encapsulates heartbeat monitoring, zombie detection, and auto-recovery backoff.
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

import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import java.util.concurrent.atomic.AtomicInteger;

/**
 * EngineHealthMonitor — 引擎健康监控器 (v1.2.0 Phase 73)
 *
 * 职责:
 *   - 心跳线程管理（5 秒间隔检测引擎响应）
 *   - 僵尸进程检测（30 秒空闲 / 120 秒搜索超时）
 *   - 自动恢复退避策略（最多 3 次，2 分钟后重置计数器）
 *   - HyperOS 3 兼容的保守恢复策略
 *
 * 线程安全: 所有计数器使用 AtomicInteger 或 volatile，确保跨线程可见性。
 */
public class EngineHealthMonitor {
    private static final String TAG = "EngineHealthMonitor";

    /** 心跳间隔（毫秒）- 5 秒，快速检测 OEM 进程杀手 */
    public static final long HEARTBEAT_INTERVAL_MS = 5000;

    /** 保留: 30 秒空闲超时（当前未使用） */
    public static final long ZOMBIE_TIMEOUT_MS = 30000;

    /** 活跃搜索超时: 2 分钟 */
    public static final long ZOMBIE_SEARCH_TIMEOUT_MS = 120000;

    /** 最大自动恢复次数 - 保守值，防止 HyperOS 3 上的重启循环 */
    public static final int MAX_AUTO_RECOVERY = 3;

    /** 恢复计数器重置间隔: 2 分钟稳定运行后重置 */
    public static final long RECOVERY_COUNT_RESET_INTERVAL_MS = 120000;

    private final Object heartbeatLock = new Object();
    private volatile boolean heartbeatRunning = false;
    private volatile Thread heartbeatThread = null;
    private volatile long lastResponseTime = System.currentTimeMillis();

    // v1.2.0 Phase 73 (SonarCloud B16/B36): 使用 AtomicInteger 替代 volatile int
    private final AtomicInteger autoRecoveryCount = new AtomicInteger(0);
    private volatile long lastRecoveryTimestamp = 0;

    private final RecoveryCallback callback;

    /** 恢复回调接口 - 由 StockfishNative 实现 */
    public interface RecoveryCallback {
        /** 检查引擎是否正在搜索（用于区分空闲/搜索超时） */
        boolean isEngineSearching();
        /** 检查引擎是否就绪 */
        boolean isEngineReady();
        /** 触发引擎恢复 */
        void triggerRecovery(String reason, String userMessage);
        /** 获取当前 UI 语言模式（true=英文） */
        boolean isEnglishMode();
    }

    public EngineHealthMonitor(RecoveryCallback callback) {
        this.callback = callback;
    }

    /** 更新最后响应时间（引擎有任何输出时调用） */
    public void onResponseReceived() {
        lastResponseTime = System.currentTimeMillis();
    }

    /** 启动心跳监控线程 */
    public void startHeartbeat() {
        synchronized (heartbeatLock) {
            if (heartbeatRunning) return;
            heartbeatRunning = true;
            heartbeatThread = new Thread(() -> {
                while (heartbeatRunning) {
                    try {
                        Thread.sleep(HEARTBEAT_INTERVAL_MS);
                    } catch (InterruptedException e) {
                        // v1.2.0 Phase 73 (SonarCloud B07): 重新设置中断标志
                        Thread.currentThread().interrupt();
                        break;
                    }
                    if (!heartbeatRunning) break;
                    checkEngineHealth();
                }
            }, "SF-Heartbeat");
            heartbeatThread.setDaemon(true);
            heartbeatThread.start();
        }
    }

    /** 停止心跳监控线程 */
    public void stopHeartbeat() {
        synchronized (heartbeatLock) {
            heartbeatRunning = false;
            if (heartbeatThread != null) {
                heartbeatThread.interrupt();
                try {
                    heartbeatThread.join(1000);
                } catch (InterruptedException e) {
                    // v1.2.0 Phase 73 (SonarCloud B08): 重新设置中断标志
                    Thread.currentThread().interrupt();
                }
                heartbeatThread = null;
            }
        }
    }

    /** 检查引擎健康状态，必要时触发恢复 */
    private void checkEngineHealth() {
        if (!callback.isEngineReady()) return;
        long now = System.currentTimeMillis();
        long idleTime = now - lastResponseTime;

        // 根据引擎状态选择超时阈值
        long timeout = callback.isEngineSearching()
                ? ZOMBIE_SEARCH_TIMEOUT_MS
                : ZOMBIE_TIMEOUT_MS;

        if (idleTime > timeout) {
            // 检查是否已达到最大恢复次数
            int currentCount = autoRecoveryCount.get();
            if (currentCount >= MAX_AUTO_RECOVERY) {
                // 检查是否已过重置间隔
                if (now - lastRecoveryTimestamp > RECOVERY_COUNT_RESET_INTERVAL_MS) {
                    autoRecoveryCount.set(0);
                    Log.i(TAG, "Recovery count reset after stable interval");
                } else {
                    Log.w(TAG, "Max auto-recovery reached (" + currentCount
                            + "), skipping recovery. Idle: " + idleTime + "ms");
                    return;
                }
            }

            // 触发恢复
            int newCount = autoRecoveryCount.incrementAndGet();
            lastRecoveryTimestamp = now;
            String reason = "Engine zombie detected (idle=" + idleTime + "ms)";
            String userMessage = callback.isEnglishMode()
                    ? "Engine unresponsive, restarting..."
                    : "\u5f15\u64ce\u65e0\u54cd\u5e94\uff0c\u6b63\u5728\u91cd\u542f...";
            Log.w(TAG, reason + " - recovery #" + newCount);
            callback.triggerRecovery(reason, userMessage);
        }
    }

    /** 重置恢复计数器（引擎稳定运行后调用） */
    public void resetRecoveryCount() {
        autoRecoveryCount.set(0);
    }

    /** 获取当前恢复次数 */
    public int getRecoveryCount() {
        return autoRecoveryCount.get();
    }

    /** 检查心跳是否正在运行 */
    public boolean isHeartbeatRunning() {
        return heartbeatRunning;
    }
}
