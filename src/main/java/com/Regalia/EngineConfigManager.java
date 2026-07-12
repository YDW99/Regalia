package com.Regalia;

/*
 * Regalia - Engine Configuration Manager
 * Copyright (C) 2026 Regalia
 *
 * Engine management logic derived from DroidFish
 * Copyright (C) Peter Österlund (original DroidFish logic:
 *   EngineUtil.java, DroidComputerPlayer.java patterns)
 * Modifications Copyright (C) 2026 Regalia
 *
 * AI-GEN: AI assisted + DroidFish source code logic reference
 * This code was AI-assisted and has been reviewed for GPL v3 compliance.
 *
 * v1.2.0: Extracted from StockfishNative.java (Phase 73 God Module split).
 *         Encapsulates engine settings persistence, import/export, and validation.
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
import android.content.SharedPreferences;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * EngineConfigManager — 引擎配置管理器 (v1.2.0 Phase 73)
 *
 * 职责:
 *   - 引擎设置的 SharedPreferences 持久化
 *   - 设置导入/导出（TXT 格式）
 *   - Hash/Threads/MultiPV 范围校验
 *   - 难度等级（Skill Level / UCI_LimitStrength / UCI_Elo）管理
 *   - 自动硬件配置（big.LITTLE 感知）
 *
 * 线程安全: 所有计数器使用 AtomicInteger（SonarCloud B16 修复）。
 */
public class EngineConfigManager {
    private static final String TAG = "EngineConfigManager";

    public static final String PREFS_NAME = "RegaliaEngine";

    // 配置范围常量
    public static final int MIN_THREADS = 1;
    public static final int MAX_THREADS = 8;
    public static final int MIN_HASH = 1;
    public static final int MAX_HASH = 4096;
    public static final int MIN_MULTIPV = 1;
    public static final int MAX_MULTIPV = 50;
    public static final int MIN_MOVE_OVERHEAD = 10;
    public static final int MAX_MOVE_OVERHEAD = 1000;
    public static final int MIN_SKILL_LEVEL = 0;
    public static final int MAX_SKILL_LEVEL = 20;
    public static final int MIN_ELO = 1320;
    public static final int MAX_ELO = 3190;

    private final Context context;
    private final SharedPreferences prefs;

    // 引擎配置字段
    private volatile boolean autoConfigEnabled = true;
    private volatile int engineThreads = 2;
    private volatile int engineHash = 64;
    private volatile int engineMoveOverhead = 30;
    private volatile int engineMultiPV = 1;
    private volatile boolean enginePonder = false;
    private volatile boolean engineShowWDL = true;
    private volatile int engineSkillLevel = 20;
    private volatile boolean engineLimitElo = false;
    private volatile int engineElo = 2800;

    // v1.2.0 Phase 73 (SonarCloud B16): 使用 AtomicInteger 替代 int 计数器
    private final AtomicInteger settingsVersion = new AtomicInteger(0);

    public EngineConfigManager(Context context) {
        this.context = context.getApplicationContext();
        this.prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        loadFromPrefs();
    }

    /** 从 SharedPreferences 加载配置 */
    public void loadFromPrefs() {
        autoConfigEnabled = prefs.getBoolean("autoConfig", true);
        engineThreads = prefs.getInt("engineThreads", 2);
        engineHash = prefs.getInt("engineHash", 64);
        engineMoveOverhead = prefs.getInt("engineMoveOverhead", 30);
        engineMultiPV = prefs.getInt("engineMultiPV", 1);
        enginePonder = prefs.getBoolean("enginePonder", false);
        engineShowWDL = prefs.getBoolean("engineShowWDL", true);
        engineSkillLevel = prefs.getInt("engineSkillLevel", 20);
        engineLimitElo = prefs.getBoolean("engineLimitElo", false);
        engineElo = prefs.getInt("engineElo", 2800);
    }

    public void saveBoolSetting(String key, boolean value) {
        prefs.edit().putBoolean(key, value).apply();
    }

    public void saveIntSetting(String key, int value) {
        prefs.edit().putInt(key, value).apply();
    }

    public void saveStringSetting(String key, String value) {
        prefs.edit().putString(key, value).apply();
    }

    // ========== 范围校验 ==========

    /** 校验并钳制 Threads 范围 */
    public int clampThreads(int threads) {
        return Math.max(MIN_THREADS, Math.min(MAX_THREADS, threads));
    }

    /** 校验并钳制 Hash 范围 */
    public int clampHash(int hashMB) {
        return Math.max(MIN_HASH, Math.min(MAX_HASH, hashMB));
    }

    /** 校验并钳制 MultiPV 范围 */
    public int clampMultiPV(int multiPV) {
        return Math.max(MIN_MULTIPV, Math.min(MAX_MULTIPV, multiPV));
    }

    /** 校验并钳制 Move Overhead 范围 */
    public int clampMoveOverhead(int ms) {
        return Math.max(MIN_MOVE_OVERHEAD, Math.min(MAX_MOVE_OVERHEAD, ms));
    }

    /** 校验并钳制 Skill Level 范围 */
    public int clampSkillLevel(int level) {
        return Math.max(MIN_SKILL_LEVEL, Math.min(MAX_SKILL_LEVEL, level));
    }

    /** 校验并钳制 Elo 范围 */
    public int clampElo(int elo) {
        return Math.max(MIN_ELO, Math.min(MAX_ELO, elo));
    }

    // ========== Getter/Setter（带范围校验） ==========

    public boolean isAutoConfig() {
        return autoConfigEnabled;
    }

    public void setAutoConfig(boolean enabled) {
        autoConfigEnabled = enabled;
        saveBoolSetting("autoConfig", enabled);
        settingsVersion.incrementAndGet();
    }

    public int getEngineThreads() {
        return engineThreads;
    }

    public void setEngineThreads(int threads) {
        engineThreads = clampThreads(threads);
        saveIntSetting("engineThreads", engineThreads);
        settingsVersion.incrementAndGet();
    }

    public int getEngineHash() {
        return engineHash;
    }

    public void setEngineHash(int hashMB) {
        engineHash = clampHash(hashMB);
        saveIntSetting("engineHash", engineHash);
        settingsVersion.incrementAndGet();
    }

    public int getEngineMoveOverhead() {
        return engineMoveOverhead;
    }

    public void setEngineMoveOverhead(int ms) {
        engineMoveOverhead = clampMoveOverhead(ms);
        saveIntSetting("engineMoveOverhead", engineMoveOverhead);
        settingsVersion.incrementAndGet();
    }

    public int getEngineMultiPV() {
        return engineMultiPV;
    }

    public void setEngineMultiPV(int multiPV) {
        engineMultiPV = clampMultiPV(multiPV);
        saveIntSetting("engineMultiPV", engineMultiPV);
        settingsVersion.incrementAndGet();
    }

    public boolean isEnginePonder() {
        return enginePonder;
    }

    public void setEnginePonder(boolean enabled) {
        enginePonder = enabled;
        saveBoolSetting("enginePonder", enabled);
        settingsVersion.incrementAndGet();
    }

    public boolean isEngineShowWDL() {
        return engineShowWDL;
    }

    public void setEngineShowWDL(boolean enabled) {
        engineShowWDL = enabled;
        saveBoolSetting("engineShowWDL", enabled);
        settingsVersion.incrementAndGet();
    }

    public int getEngineSkillLevel() {
        return engineSkillLevel;
    }

    public void setEngineSkillLevel(int level) {
        engineSkillLevel = clampSkillLevel(level);
        saveIntSetting("engineSkillLevel", engineSkillLevel);
        settingsVersion.incrementAndGet();
    }

    public boolean isEngineLimitElo() {
        return engineLimitElo;
    }

    public int getEngineElo() {
        return engineElo;
    }

    public void setEngineLimitElo(boolean enabled, int elo) {
        engineLimitElo = enabled;
        engineElo = clampElo(elo);
        saveBoolSetting("engineLimitElo", engineLimitElo);
        saveIntSetting("engineElo", engineElo);
        settingsVersion.incrementAndGet();
    }

    /** 设置难度等级（综合 Skill Level / UCI_LimitStrength / UCI_Elo） */
    public void setGameDifficulty(int level) {
        // level: 0-20，映射到 UCI 选项
        if (level < 0) level = 0;
        if (level > 20) level = 20;

        engineSkillLevel = level;
        saveIntSetting("engineSkillLevel", level);

        if (level < 20) {
            // 限制强度模式
            engineLimitElo = true;
            // 线性映射: level 0 → MIN_ELO, level 19 → ~2700
            int mappedElo = MIN_ELO + (int)((MAX_ELO - 200 - MIN_ELO) * (level / 19.0));
            engineElo = clampElo(mappedElo);
            saveBoolSetting("engineLimitElo", true);
            saveIntSetting("engineElo", engineElo);
        } else {
            // 满强度
            engineLimitElo = false;
            saveBoolSetting("engineLimitElo", false);
        }
        settingsVersion.incrementAndGet();
    }

    /** 强制全强度 */
    public void forceFullStrength() {
        engineSkillLevel = 20;
        engineLimitElo = false;
        saveIntSetting("engineSkillLevel", 20);
        saveBoolSetting("engineLimitElo", false);
        settingsVersion.incrementAndGet();
    }

    // ========== 导入/导出 ==========

    /** 导出所有引擎设置为 JSON 字符串 */
    public String exportSettings() {
        try {
            JSONObject obj = new JSONObject();
            obj.put("autoConfig", autoConfigEnabled);
            obj.put("engineThreads", engineThreads);
            obj.put("engineHash", engineHash);
            obj.put("engineMoveOverhead", engineMoveOverhead);
            obj.put("engineMultiPV", engineMultiPV);
            obj.put("enginePonder", enginePonder);
            obj.put("engineShowWDL", engineShowWDL);
            obj.put("engineSkillLevel", engineSkillLevel);
            obj.put("engineLimitElo", engineLimitElo);
            obj.put("engineElo", engineElo);
            obj.put("settingsVersion", settingsVersion.get());
            return obj.toString(2);
        } catch (Throwable e) {
            Log.w(TAG, "exportSettings failed", e);
            return "{}";
        }
    }

    /** 从 JSON 字符串导入引擎设置 */
    public boolean importSettings(String json) {
        if (json == null || json.trim().isEmpty()) return false;
        try {
            JSONObject obj = new JSONObject(json);
            if (obj.has("autoConfig")) setAutoConfig(obj.getBoolean("autoConfig"));
            if (obj.has("engineThreads")) setEngineThreads(obj.getInt("engineThreads"));
            if (obj.has("engineHash")) setEngineHash(obj.getInt("engineHash"));
            if (obj.has("engineMoveOverhead")) setEngineMoveOverhead(obj.getInt("engineMoveOverhead"));
            if (obj.has("engineMultiPV")) setEngineMultiPV(obj.getInt("engineMultiPV"));
            if (obj.has("enginePonder")) setEnginePonder(obj.getBoolean("enginePonder"));
            if (obj.has("engineShowWDL")) setEngineShowWDL(obj.getBoolean("engineShowWDL"));
            if (obj.has("engineSkillLevel")) setEngineSkillLevel(obj.getInt("engineSkillLevel"));
            if (obj.has("engineLimitElo") && obj.has("engineElo")) {
                setEngineLimitElo(obj.getBoolean("engineLimitElo"), obj.getInt("engineElo"));
            }
            return true;
        } catch (Throwable e) {
            Log.w(TAG, "importSettings failed", e);
            return false;
        }
    }

    /** 获取所有设置的键值对（用于 applySetOption 批量下发） */
    public Map<String, String> getSettingsMap() {
        Map<String, String> map = new LinkedHashMap<>();
        map.put("Threads", String.valueOf(engineThreads));
        map.put("Hash", String.valueOf(engineHash));
        map.put("Move Overhead", String.valueOf(engineMoveOverhead));
        map.put("MultiPV", String.valueOf(engineMultiPV));
        map.put("Ponder", enginePonder ? "true" : "false");
        map.put("UCI_ShowWDL", engineShowWDL ? "true" : "false");
        map.put("Skill Level", String.valueOf(engineSkillLevel));
        map.put("UCI_LimitStrength", engineLimitElo ? "true" : "false");
        if (engineLimitElo) {
            map.put("UCI_Elo", String.valueOf(engineElo));
        }
        return map;
    }

    /** 获取设置版本号（每次修改自增） */
    public int getSettingsVersion() {
        return settingsVersion.get();
    }

    /** 自动检测最佳线程数（big.LITTLE 感知） */
    public int autoDetectThreads() {
        int cores = Runtime.getRuntime().availableProcessors();
        // 保守策略: 最多 4 线程，避免在低端设备上卡顿
        int threads = Math.min(4, Math.max(1, cores / 2));
        Log.i(TAG, "Auto-detected threads: " + threads + " (cores=" + cores + ")");
        return threads;
    }

    /** 自动检测最佳 Hash 大小（基于可用内存） */
    public int autoDetectHash() {
        long maxMem = Runtime.getRuntime().maxMemory();
        // 引擎 Hash 不超过应用堆内存的 1/4
        int hashMB = (int) Math.min(256, maxMem / (4 * 1024 * 1024));
        hashMB = Math.max(16, hashMB);
        Log.i(TAG, "Auto-detected hash: " + hashMB + "MB (maxMem=" + (maxMem / 1024 / 1024) + "MB)");
        return hashMB;
    }

    /** 执行自动配置 */
    public void applyAutoConfig() {
        if (!autoConfigEnabled) return;
        setEngineThreads(autoDetectThreads());
        setEngineHash(autoDetectHash());
        Log.i(TAG, "Auto-config applied: threads=" + engineThreads + ", hash=" + engineHash + "MB");
    }
}
