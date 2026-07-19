package com.Regalia;

/*
 * Regalia - Engine Config Helper
 * Copyright (C) 2026 Regalia
 *
 * Engine configuration patterns derived from DroidFish (EngineOptionsDialog.java)
 * Copyright (C) Peter Österlund (original DroidFish logic)
 * Modifications Copyright (C) 2026 Regalia
 *
 * AI-GEN: AI assisted + DroidFish source code logic reference
 * This code was AI-assisted and has been reviewed for GPL v3 compliance.
 *
 * v1.2.0 Phase 81: Extracted from StockfishNative.java to reduce God Module size.
 *                   Encapsulates engine configuration: setAutoConfig, hardware detection
 *                   (big.LITTLE aware), applySettings, UCI option setters (Threads/Hash/
 *                   Move Overhead/MultiPV/Ponder/ShowWDL/Skill Level/UCI_LimitStrength/
 *                   UCI_Elo), game difficulty mapping (1-7 → ELO), and forceFullStrength
 *                   for evaluation/hint searches. All @JavascriptInterface signatures are
 *                   preserved as thin delegates on StockfishNative.
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
import android.util.Log;

/**
 * EngineConfigHelper — 引擎配置辅助类 (v1.2.0 Phase 81)
 *
 * 职责:
 *   - 自动/手动配置切换 (setAutoConfig)
 *   - 硬件检测与配置 (detectHardwareAndConfigure — big.LITTLE 感知)
 *   - 应用所有引擎设置到 UCI (applySettings)
 *   - UCI 选项设置器 (Threads/Hash/MoveOverhead/MultiPV/Ponder/ShowWDL/
 *     SkillLevel/UCI_LimitStrength/UCI_Elo)
 *   - 游戏难度映射 (setGameDifficulty — 1-7 级 → ELO_MAP)
 *   - 强制全强度 (forceFullStrength — 用于评估/提示搜索)
 *
 * 设计原则:
 *   - 所有 @JavascriptInterface 方法签名在 StockfishNative 中保持不变（薄委托）
 *   - 通过 Callbacks 接口访问 StockfishNative 的引擎状态、字段写入器和 UCI 操作
 *   - 字段写入器（setThreadsField 等）仅更新字段 + 持久化，不发送 UCI 命令
 *     （UCI 命令由本类的业务逻辑负责发送，避免双重发送）
 *
 * 安全设计:
 *   - threads 上限 2×CPU 核心（v1.1.2 Phase 69 UCI 指南 §1.1）
 *   - hash 上限 50% JVM 堆（v1.1.2 Phase 69 UCI 指南 §1.2）
 *   - moveOverhead 上限 1000ms（v1.1.2 Phase 69 UCI 指南 §2.2）
 *   - multiPV 上限 8（v1.1.2 Phase 69 UCI 指南 §2.1）
 *   - skillLevel 0-20, elo 500-3500
 *   - detectBigCoreCount 结果缓存（CPU 拓扑在设备生命周期内不变）
 */
public class EngineConfigHelper {
    private static final String TAG = "EngineConfigHelper";

    private final Context context;
    private final Callbacks callbacks;

    /**
     * v18.4.0: ELO_MAP synced with JS ELO_MATCH for consistent level display.
     * Moved from StockfishNative.java in v1.2.0 Phase 81 — only used by
     * setGameDifficulty(), so co-locating reduces StockfishNative's footprint.
     * Index 0 unused; indices 1-7 map to ELO 800/1350/1700/2000/2200/2350/2800.
     */
    private static final int[] ELO_MAP = {0, 800, 1350, 1700, 2000, 2200, 2350, 2800};

    /**
     * v1.0.2 PERF (audit): cache detectBigCoreCount() result — CPU topology
     * is fixed for the device's lifetime, no need to re-parse /proc/cpuinfo
     * every time detectHardwareAndConfigure() is called.
     */
    private volatile int _cachedBigCoreCount = -1;

    /** 回调接口 — 由 StockfishNative 实现 */
    public interface Callbacks {
        // ----- 引擎状态查询 -----
        boolean isEngineReady();
        boolean isAutoConfigEnabled();
        int getEngineThreads();
        int getEngineHash();
        int getEngineMoveOverhead();
        int getEngineMultiPV();
        boolean getEnginePonder();
        boolean getEngineShowWDL();
        int getEngineSkillLevel();
        boolean getEngineLimitElo();
        int getEngineElo();

        // ----- 字段写入器（更新字段 + 持久化，不发送 UCI 命令） -----
        void setThreadsField(int v);
        void setHashField(int v);
        void setMoveOverheadField(int v);
        void setMultiPVField(int v);
        void setPonderField(boolean v);
        void setShowWDLField(boolean v);
        void setSkillLevelField(int v);
        void setLimitEloField(boolean v);
        void setEloField(int v);
        void setAutoConfigField(boolean v);

        // ----- 引擎操作 -----
        boolean engineSupportsOption(String name);
        void sendSetOptionAndWait(String name, String value);
        void sendUciCommand(String command);
        void notifyEngineInfo();
        void postJsCallback(String jsExpression);
        // v1.2.3: structured postJsCallback overload — JSON-encodes args via
        //   JSONArray so callers don't need to manually escape/concatenate.
        //   Matches StockfishNative.postJsCallback(String, Object...).
        void postJsCallback(String eventName, Object... args);
    }

    public EngineConfigHelper(Context context, Callbacks callbacks) {
        this.context = context.getApplicationContext();
        this.callbacks = callbacks;
    }

    // ===================== AUTO / MANUAL CONFIG =====================

    /**
     * Enable or disable auto-config. When enabled and engine is ready, triggers
     * hardware detection to set optimal Threads/Hash values.
     */
    public void setAutoConfig(boolean enabled) {
        callbacks.setAutoConfigField(enabled);
        Log.i(TAG, "Auto config " + (enabled ? "enabled" : "disabled"));
        if (enabled && callbacks.isEngineReady()) {
            detectHardwareAndConfigure();
        }
    }

    /**
     * Detect hardware capabilities and configure engine accordingly.
     * Sets optimal Threads and Hash values based on CPU cores and available memory.
     *
     * Stockfish 18 best practice: keep hashfull < 30% for optimal strength.
     * On mobile, 64MB is the sweet spot; cap at 128MB to avoid OOM on low-RAM devices.
     */
    public void detectHardwareAndConfigure() {
        try {
            int availableProcessors = Runtime.getRuntime().availableProcessors();

            int bigCoreCount = detectBigCoreCount();
            int effectiveCores;
            if (bigCoreCount > 0) {
                effectiveCores = bigCoreCount;
                Log.i(TAG, "big.LITTLE detected: " + bigCoreCount + " big cores out of "
                        + availableProcessors + " total");
            } else {
                effectiveCores = availableProcessors / 2;
            }

            int optimalThreads = Math.max(1, effectiveCores);
            optimalThreads = Math.min(optimalThreads, 16);

            long maxMemory = Runtime.getRuntime().maxMemory();
            long optimalHashMB = Math.max(16, maxMemory / (16 * 1024 * 1024));
            optimalHashMB = Math.min(optimalHashMB, 128);
            optimalHashMB = Math.max(16, (optimalHashMB / 16) * 16);

            Log.i(TAG, "Hardware detection: processors=" + availableProcessors
                    + " (bigCores=" + bigCoreCount + ")"
                    + " -> threads=" + optimalThreads
                    + ", maxMemory=" + (maxMemory / 1024 / 1024) + "MB"
                    + " -> hash=" + optimalHashMB + "MB");

            if (callbacks.isEngineReady()) {
                callbacks.sendSetOptionAndWait("Threads", String.valueOf(optimalThreads));
                callbacks.sendSetOptionAndWait("Hash", String.valueOf(optimalHashMB));
                callbacks.setThreadsField(optimalThreads);
                callbacks.setHashField((int) optimalHashMB);
                callbacks.notifyEngineInfo();
            }
        } catch (Throwable e) {
            Log.e(TAG, "Hardware detection failed", e);
        }
    }

    /**
     * Detect the number of "big" cores on big.LITTLE ARM architectures.
     * Reads /proc/cpuinfo, extracts per-core max frequency, and counts cores
     * whose frequency is >= 90% of the highest observed frequency (when the
     * highest is at least 20% above the median — indicating asymmetric topology).
     *
     * Result is cached for the lifetime of the helper instance (CPU topology
     * does not change at runtime).
     */
    private int detectBigCoreCount() {
        if (_cachedBigCoreCount >= 0) return _cachedBigCoreCount;
        int bigCores = 0;
        try {
            java.util.List<Long> frequencies = new java.util.ArrayList<>();

            try (java.io.BufferedReader reader = new java.io.BufferedReader(
                    new java.io.InputStreamReader(new java.io.FileInputStream("/proc/cpuinfo")))) {
                String line;
                long currentFreq = 0;
                while ((line = reader.readLine()) != null) {
                    if (line.startsWith("processor")) {
                        if (currentFreq > 0) {
                            frequencies.add(currentFreq);
                        }
                        currentFreq = 0;
                    } else if (line.contains("CPU max MHz")) {
                        // v1.2.3 round-30 (bug fix): split the previous combined
                        //   `|| line.contains("BogoMIPS")` branch. The old code
                        //   unconditionally set currentFreq, so on ARM64 kernels
                        //   that emit BOTH "CPU max MHz" and "BogoMIPS" for the
                        //   same core, the LAST one wins — often BogoMIPS, which
                        //   is a rough proxy not actual MHz. Now "CPU max MHz"
                        //   (authoritative) always wins, and BogoMIPS only fills
                        //   in when no MHz reading was seen for this core.
                        try {
                            String[] parts = line.split(":");
                            if (parts.length >= 2) {
                                double freq = Double.parseDouble(parts[1].trim());
                                currentFreq = (long) (freq * 1000);
                            }
                        } catch (NumberFormatException ignored) {}
                    } else if (line.contains("BogoMIPS")) {
                        // Fallback only — don't overwrite a real MHz reading.
                        try {
                            String[] parts = line.split(":");
                            if (parts.length >= 2 && currentFreq == 0) {
                                double freq = Double.parseDouble(parts[1].trim());
                                currentFreq = (long) (freq * 1000);
                            }
                        } catch (NumberFormatException ignored) {}
                    } else if (line.contains("cpu MHz")) {
                        try {
                            String[] parts = line.split(":");
                            if (parts.length >= 2) {
                                double freq = Double.parseDouble(parts[1].trim());
                                if (currentFreq == 0) {
                                    currentFreq = (long) (freq * 1000);
                                }
                            }
                        } catch (NumberFormatException ignored) {}
                    }
                }
                if (currentFreq > 0) {
                    frequencies.add(currentFreq);
                }
            }

            if (frequencies.size() >= 2) {
                java.util.Collections.sort(frequencies);
                long medianFreq = frequencies.get(frequencies.size() / 2);
                long highestFreq = frequencies.get(frequencies.size() - 1);

                if (highestFreq > medianFreq * 1.2) {
                    for (long freq : frequencies) {
                        if (freq >= highestFreq * 0.9) {
                            bigCores++;
                        }
                    }
                }
            }
        } catch (Throwable e) {
            Log.d(TAG, "big.LITTLE detection failed (non-fatal): " + e.getMessage());
            // v1.2.1 round-10 (review-E P2): Do NOT cache the failure result.
            //   The catch block leaves bigCores=0, but the failure may be
            //   transient (e.g. /proc/cpuinfo briefly unreadable due to a
            //   SELinux denials flush). Caching 0 would prevent retries and
            //   permanently degrade thread autoconfig. Keep _cachedBigCoreCount
            //   at -1 so the next call attempts detection again.
            return 0;
        }
        _cachedBigCoreCount = bigCores; // v1.0.2 PERF: cache result (only on success)
        return bigCores;
    }

    // ===================== APPLY ALL SETTINGS =====================

    /**
     * Apply all current settings to the engine in the correct order.
     *
     * v1.0.2 SIMPLIFY (audit): consolidated the two near-identical branches
     * (autoConfig on/off) into one. The ONLY difference was how Threads/Hash
     * are determined: autoConfig calls detectHardwareAndConfigure() (which
     * sets Threads/Hash from device hardware); the else branch applies the
     * user-specified Threads/Hash directly. All other options (Move Overhead,
     * MultiPV, Ponder, UCI_ShowWDL, Skill Level, UCI_LimitStrength, UCI_Elo)
     * were applied identically in both branches — duplicated ~50 lines.
     */
    public void applySettings() {
        if (!callbacks.isEngineReady()) {
            Log.w(TAG, "Cannot apply settings - engine not ready");
            return;
        }

        Log.i(TAG, "Applying engine settings (autoConfig=" + callbacks.isAutoConfigEnabled() + ")");

        // Threads + Hash: source depends on autoConfig
        if (callbacks.isAutoConfigEnabled()) {
            detectHardwareAndConfigure();
            if (!callbacks.isEngineReady()) return;
        } else {
            if (callbacks.engineSupportsOption("Threads")) {
                callbacks.sendSetOptionAndWait("Threads", String.valueOf(callbacks.getEngineThreads()));
                if (!callbacks.isEngineReady()) return;
            }
            if (callbacks.engineSupportsOption("Hash")) {
                callbacks.sendSetOptionAndWait("Hash", String.valueOf(callbacks.getEngineHash()));
                if (!callbacks.isEngineReady()) return;
            }
        }

        // Common options (applied identically regardless of autoConfig)
        if (callbacks.engineSupportsOption("Move Overhead")) {
            callbacks.sendSetOptionAndWait("Move Overhead", String.valueOf(callbacks.getEngineMoveOverhead()));
            if (!callbacks.isEngineReady()) return;
        }
        if (callbacks.engineSupportsOption("MultiPV")) {
            callbacks.sendSetOptionAndWait("MultiPV", String.valueOf(callbacks.getEngineMultiPV()));
            if (!callbacks.isEngineReady()) return;
        }
        if (callbacks.engineSupportsOption("Ponder")) {
            callbacks.sendSetOptionAndWait("Ponder", String.valueOf(callbacks.getEnginePonder()));
            if (!callbacks.isEngineReady()) return;
        }
        if (callbacks.engineSupportsOption("UCI_ShowWDL")) {
            callbacks.sendSetOptionAndWait("UCI_ShowWDL", String.valueOf(callbacks.getEngineShowWDL()));
            if (!callbacks.isEngineReady()) return;
        }
        if (callbacks.engineSupportsOption("Skill Level")) {
            callbacks.sendSetOptionAndWait("Skill Level", String.valueOf(callbacks.getEngineSkillLevel()));
            if (!callbacks.isEngineReady()) return;
        }
        if (callbacks.engineSupportsOption("UCI_LimitStrength")) {
            callbacks.sendSetOptionAndWait("UCI_LimitStrength", String.valueOf(callbacks.getEngineLimitElo()));
            if (!callbacks.isEngineReady()) return;
            if (callbacks.getEngineLimitElo() && callbacks.engineSupportsOption("UCI_Elo")) {
                callbacks.sendSetOptionAndWait("UCI_Elo", String.valueOf(callbacks.getEngineElo()));
            }
        }

        Log.i(TAG, "Engine settings applied successfully");
    }

    // ===================== UCI OPTION SETTERS =====================

    /**
     * Set engine Threads count.
     * v1.1.2 Phase 69 (UCI guide §1.1): cap Threads at 2x available processors.
     * The UCI guide warns that exceeding physical core count causes thread
     * contention, reducing NPS. We allow up to 2x for hyperthreading benefit
     * but no higher. The old cap of 512 was a spec ceiling.
     *
     * When autoConfig is enabled, the value is persisted but the UCI command
     * is NOT sent — autoConfig owns Threads/Hash and will re-detect on next
     * applySettings().
     */
    public void setEngineThreads(int threads) {
        if (threads < 1) threads = 1;
        int cpuCores = Runtime.getRuntime().availableProcessors();
        int threadsCap = Math.max(1, cpuCores * 2);
        if (threads > threadsCap) {
            Log.w(TAG, "setEngineThreads: " + threads + " exceeds 2x CPU cores (" + threadsCap + "), capping");
            threads = threadsCap;
        }
        callbacks.setThreadsField(threads);
        if (callbacks.isAutoConfigEnabled()) {
            Log.w(TAG, "setEngineThreads ignored - autoConfig is enabled");
            return;
        }
        if (callbacks.isEngineReady()) {
            callbacks.sendSetOptionAndWait("Threads", String.valueOf(threads));
        }
    }

    /**
     * Set engine Hash size in MB.
     * v1.1.2 Phase 69 (UCI guide §1.2): cap Hash at 50% of available JVM heap
     * memory. The UCI guide warns that exceeding 50% of physical RAM causes
     * virtual memory swapping, drastically slowing the engine. On Android,
     * the JVM heap is the relevant limit (not total device RAM). The old cap
     * of 33554432 MB (32TB) was a spec ceiling with no practical use.
     */
    public void setEngineHash(int hashMB) {
        if (hashMB < 1) hashMB = 1;
        long maxMemoryMB = Runtime.getRuntime().maxMemory() / (1024 * 1024);
        long hashCap = Math.max(16, maxMemoryMB / 2); // 50% of heap, min 16MB
        if (hashMB > hashCap) {
            Log.w(TAG, "setEngineHash: " + hashMB + "MB exceeds 50% of heap (" + hashCap + "MB), capping");
            hashMB = (int) hashCap;
        }
        callbacks.setHashField(hashMB);
        if (callbacks.isAutoConfigEnabled()) {
            Log.w(TAG, "setEngineHash ignored - autoConfig is enabled");
            return;
        }
        if (callbacks.isEngineReady()) {
            callbacks.sendSetOptionAndWait("Hash", String.valueOf(hashMB));
        }
    }

    /**
     * Set engine Move Overhead in milliseconds.
     * v1.1.2 Phase 69 (UCI guide §2.2): cap Move Overhead at 1000ms. The UCI
     * guide recommends 10-30ms for local play, 50-150ms for network play.
     * Values above 1000ms waste thinking time with no benefit. The old cap
     * of 5000ms was excessive.
     */
    public void setEngineMoveOverhead(int ms) {
        if (ms < 0) ms = 0;
        if (ms > 1000) ms = 1000;
        callbacks.setMoveOverheadField(ms);
        if (callbacks.isEngineReady()) {
            callbacks.sendSetOptionAndWait("Move Overhead", String.valueOf(ms));
        }
    }

    /**
     * Set engine MultiPV count.
     * v1.1.2 Phase 69 (UCI guide §2.1): cap MultiPV at 8. The UCI optimization
     * guide recommends 3-5 for review analysis; values above 8 severely
     * reduce search depth with diminishing returns. The old cap of 500 was
     * a spec ceiling, not a practical limit.
     */
    public void setEngineMultiPV(int multiPV) {
        if (multiPV < 1) multiPV = 1;
        if (multiPV > 8) multiPV = 8;
        callbacks.setMultiPVField(multiPV);
        if (callbacks.isEngineReady()) {
            callbacks.sendSetOptionAndWait("MultiPV", String.valueOf(multiPV));
        }
    }

    /** Set engine Ponder flag (thinking on opponent's time). */
    public void setEnginePonder(boolean enabled) {
        callbacks.setPonderField(enabled);
        if (callbacks.isEngineReady()) {
            callbacks.sendSetOptionAndWait("Ponder", String.valueOf(enabled));
        }
    }

    /** Set engine UCI_ShowWDL flag (Win/Draw/Loss probability display). */
    public void setEngineShowWDL(boolean enabled) {
        callbacks.setShowWDLField(enabled);
        if (callbacks.isEngineReady()) {
            callbacks.sendSetOptionAndWait("UCI_ShowWDL", String.valueOf(enabled));
        }
    }

    /**
     * v18.5.0: Alias for setEngineShowWDL — matches the JS API contract.
     * Preserved for backward compatibility with JS callers.
     */
    public void setShowWDL(boolean enabled) {
        setEngineShowWDL(enabled);
    }

    /**
     * Set engine Skill Level (0-20). Lower values weaken the engine by
     * intentionally playing suboptimal moves.
     */
    public void setEngineSkillLevel(int level) {
        // v1.2.1: Inline Skill Level range (0-20). Previously referenced
        //   EngineConfigManager.MIN/MAX_SKILL_LEVEL, but that class was deleted
        //   in round-4 (its only external callers were these two constants).
        //   Stockfish's UCI "Skill Level" option accepts 0..20.
        if (level < 0) level = 0;
        if (level > 20) level = 20;
        callbacks.setSkillLevelField(level);
        if (callbacks.isEngineReady()) {
            callbacks.sendSetOptionAndWait("Skill Level", String.valueOf(level));
        }
    }

    /**
     * v1.0.6 NEW: JS-side getter for the current Skill Level value.
     * Used by _aiOpponentNameWithLevel() to render "SL<N>" in the AI opponent
     * bar and in PGN [White]/[Black] tags when the AI is in SL mode.
     */
    public int getEngineSkillLevel() {
        return callbacks.getEngineSkillLevel();
    }

    /**
     * Set engine UCI_LimitStrength flag and UCI_Elo value together.
     * When enabled, the engine plays at the specified ELO (500-3500).
     * When disabled, the engine plays at full strength (modified only by
     * Skill Level).
     */
    public void setEngineLimitElo(boolean enabled, int elo) {
        if (elo < 500) elo = 500;
        if (elo > 3500) elo = 3500;
        callbacks.setLimitEloField(enabled);
        callbacks.setEloField(elo);
        if (callbacks.isEngineReady()) {
            callbacks.sendSetOptionAndWait("UCI_LimitStrength", String.valueOf(enabled));
            if (enabled) {
                callbacks.sendSetOptionAndWait("UCI_Elo", String.valueOf(elo));
            }
        }
    }

    /**
     * v18.5.0: Convenience alias matching the JS API contract.
     */
    public void setLimitStrength(boolean enabled, int elo) {
        setEngineLimitElo(enabled, elo);
    }

    /**
     * v18.5.0: Set the engine ELO independently.
     * Only effective when UCI_LimitStrength is true.
     */
    public void setElo(int elo) {
        if (elo < 500) elo = 500;
        if (elo > 3500) elo = 3500;
        callbacks.setEloField(elo);
        if (callbacks.isEngineReady() && callbacks.getEngineLimitElo()) {
            callbacks.sendSetOptionAndWait("UCI_Elo", String.valueOf(elo));
        }
    }

    // ===================== GAME DIFFICULTY =====================

    /**
     * Set game difficulty level (1-7). Controls UCI_LimitStrength + UCI_Elo only.
     *
     * Levels 1-6: enable UCI_LimitStrength and set UCI_Elo to ELO_MAP[level].
     * Level 7 (or any other value): disable UCI_LimitStrength, fall back to
     * Skill Level for strength control.
     *
     * The current engineElo field is preserved when falling back to Skill Level
     * (so the UI can still display the last-set ELO), but UCI_LimitStrength is
     * set to false so the engine ignores it.
     *
     * Notifies JS via onGameDifficultyChanged(limitElo, elo) callback so the
     * UI can update the difficulty selector display.
     */
    public void setGameDifficulty(int level) {
        // v1.2.1 round-10 (review-E P2): mid-search context note.
        //   This method is invoked from JS both before a search starts AND
        //   mid-search (e.g. when the user changes difficulty while the AI
        //   is thinking). For that reason we use sendUciCommand (fire-and-
        //   forget) and NOT sendSetOptionAndWait — the latter would block
        //   on the engine's readyok handshake, which cannot complete while
        //   a search is in progress, causing a 10s timeout deadlock. The
        //   engine applies setoption immediately even mid-search per UCI
        //   spec §3.4 ("must be applied as soon as possible"). The peer
        //   setters (setEngineThreads/setEngineHash) use sendSetOptionAndWait
        //   because they are only called from applySettings() which itself
        //   is only called when the engine is idle.
        if (level >= 1 && level <= 6) {
            // v1.2.3 round-13 (P3): removed dead `: 1500` ternary fallback.
            //   The outer guard restricts level to [1, 6] and ELO_MAP has
            //   length 8 (indices 0-7), so `level < ELO_MAP.length` is always
            //   true here — the fallback was unreachable.
            int elo = ELO_MAP[level];
            callbacks.setLimitEloField(true);
            callbacks.setEloField(elo);
            if (callbacks.engineSupportsOption("UCI_LimitStrength")) {
                callbacks.sendUciCommand("setoption name UCI_LimitStrength value true");
            }
            if (callbacks.engineSupportsOption("UCI_Elo")) {
                callbacks.sendUciCommand("setoption name UCI_Elo value " + elo);
            }
        } else {
            callbacks.setLimitEloField(false);
            if (callbacks.engineSupportsOption("UCI_LimitStrength")) {
                callbacks.sendUciCommand("setoption name UCI_LimitStrength value false");
            }
            if (callbacks.engineSupportsOption("Skill Level")) {
                callbacks.sendUciCommand("setoption name Skill Level value " + callbacks.getEngineSkillLevel());
            }
        }
        // v1.2.3 first-principles: use the structured postJsCallback(eventName, args...)
        //   overload instead of the raw string-concat overload. The structured
        //   overload JSON-encodes args via JSONArray, guaranteeing correct
        //   type serialization (boolean as true/false, int as number) and
        //   eliminating any theoretical injection via the elo field. The raw
        //   overload was safe here because getEngineLimitElo() returns a
        //   boolean and getEngineElo() returns an int (no quotes to escape),
        //   but the structured overload is the recommended pattern for all
        //   non-hardcoded-literal callbacks (per StockfishNative.postJsCallback
        //   Javadoc, v1.2.1 round-7 R3).
        callbacks.postJsCallback("onGameDifficultyChanged",
                callbacks.getEngineLimitElo(), callbacks.getEngineElo());
    }

    /**
     * Force full-strength engine play for evaluation and hint searches.
     *
     * Temporarily overrides Skill Level (set to 20) and UCI_LimitStrength
     * (set to false) so that evaluation/hint searches run at maximum strength.
     * The caller is responsible for restoring the user's settings afterwards
     * (typically by calling applySettings()).
     */
    public void forceFullStrength() {
        // v1.2.1 round-10 (review-E P2): mid-search context note.
        //   Called from engineGoDepth (eval/hint paths) DURING an active
        //   search — using sendUciCommand (fire-and-forget) is intentional
        //   for the same reason as setGameDifficulty above. The caller
        //   (typically ai-bridge.js) is responsible for restoring gameplay
        //   settings via applySettings() once the eval/hint search ends.
        if (callbacks.engineSupportsOption("Skill Level")) {
            callbacks.sendUciCommand("setoption name Skill Level value 20");
        }
        if (callbacks.engineSupportsOption("UCI_LimitStrength")) {
            callbacks.sendUciCommand("setoption name UCI_LimitStrength value false");
        }
    }

    /**
     * Sync game difficulty level from JS-side difficulty selector to engine.
     * Thin wrapper around setGameDifficulty with logging for debugging.
     */
    public void syncGameDifficulty(int level) {
        Log.i(TAG, "syncGameDifficulty: level=" + level);
        setGameDifficulty(level);
    }
}
